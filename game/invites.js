/* Invite cards [OURS]: every invite a player gets (party, co-op dungeon run, clan, Arena challenge, trade offer) pops up as
   a small SkyUI card at the top of the screen with Accept and Decline right there, so nobody has to dig through menus.
   - Pure part (node-tested): list() turns what ui.js knows into cards; nos()/notes() carry "Kacper declined your invite"
     back to whoever sent it; remember()/forgot() keep a declined clan invite from popping up again.
   - Screen part: mount(ctx) draws the stack (#invbar). Each card answers once (buttons lock while it's busy, so no double
     accept); cards whose invite went away (expired, withdrawn, answered on another screen) drop off by themselves.
   - Phone: when an invite arrives while the app is in the background, app.js (window.ROTN_NATIVE) raises an Android
     notification with Accept / Decline buttons; tapping one opens the game and answers it (answer()). */
const INVITES = (() => {
  const MAX_PARTY = 8;
  const NOS_KEEP = 8;            // a party/run keeps the last few "declined" notes for its leader
  const NO_MEMORY = 86400;       // a declined clan invite stays hidden for a day (seconds)
  const SHOW = 3;                // cards on screen at once; the rest wait behind a "+N more" line
  const ICON = { party: "\uE106", coop: "\uE101", clan: "\uE13E", duel: "\uE101", trade: "\uE198", join: "\uE106" };
  const nowS = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);

  /* ---------------------------------------------------------------- pure part
     src: { parties, runs, clans, duels, trades, gold, inClan, joins, face(uid) }, each already "for me" (ui.js filters them);
     face(uid) gives a player's round portrait (avatar.js) for party invites; join cards bring their own (pic).
     -> [{ key, kind, id, from, text, sub, can, why, pic }] newest first */
  function list(s, src = {}) {
    const out = [], no = (s && s.invNo) || {};
    const add = (c) => { if (!no[c.key]) out.push(c); };
    for (const p of src.parties || []) {
      const n = (p.members || []).length, full = n >= MAX_PARTY;
      add({ key: "party:" + p.id, kind: "party", id: p.id, from: p.leaderName, pic: src.face ? src.face(p.leader) : "", t: p.t || 0, text: `${p.leaderName} invites you to their party`,
        sub: full ? `The party is full (${n}/${MAX_PARTY})` : `${n}/${MAX_PARTY} heroes · the leader makes the choices`, can: true, full });
    }
    for (const r of src.runs || []) {
      const n = (r.members || []).filter((m) => !m.left).length, full = n >= MAX_PARTY;
      add({ key: "coop:" + r.id, kind: "coop", id: r.id, from: r.leaderName, t: r.t || 0, text: `${r.leaderName} asks you to raid ${r.place} together`,
        sub: full ? `The run is full (${n}/${MAX_PARTY})` : `${n}/${MAX_PARTY} heroes · ${r.status === "in" ? "already inside" : "waiting at the door"}`, can: true, full });
    }
    for (const c of src.clans || []) {
      add({ key: "clan:" + c.id, kind: "clan", id: c.id, from: c.founderName, t: c.t || 0, text: `${c.founderName} invites you to the clan ${c.name} [${c.tag}]`,
        sub: src.inClan ? "Joining means leaving your clan" : "Clan chat, a tag by your name, a banner over your houses", can: true });
    }
    for (const d of src.duels || []) {
      const can = (src.gold ?? 0) >= (d.stake || 0);
      add({ key: "duel:" + d.id, kind: "duel", id: d.id, from: d.fromName, t: d.t || 0, text: `${d.fromName} challenges you in the Windhelm Arena`,
        sub: d.stake ? `Stake ${d.stake} gold each · winner takes ${d.stake * 2}` : "A friendly bout, no bet", can, why: can ? "" : `You need ${d.stake} gold` });
    }
    for (const d of src.trades || []) {
      const can = (src.gold ?? 0) >= (d.ask || 0);
      add({ key: "trade:" + d.id, kind: "trade", id: d.id, from: d.fromName, t: d.t || d.arrive || 0, text: `${d.fromName} offers you a trade`,
        sub: `Offer: ${d.what || "something"} · ${d.ask ? `for ${d.ask} gold` : "as a gift"}`, can, why: can ? "" : `You need ${d.ask} gold` });
    }
    for (const c of src.joins || []) add(c);   // "Kacper asks to join your party" (friendjoin.js)
    return out.sort((a, b) => b.t - a.t);
  }
  /* the invitee says no: leave a short note on the party/run record for its leader */
  function nos(doc, me, t = nowS()) {
    const keep = (doc.nos || []).filter((x) => x && x.id !== me.id).slice(-(NOS_KEEP - 1));
    return [...keep, { id: me.id, name: me.name, t }];
  }
  /* notes for the sender. docs: parties or runs; seen: a Set of keys already shown; since: ignore older notes
     -> ["Kacper declined your party invite."] */
  function notes(docs, myId, seen, since = 0, kind = "party") {
    const out = [], what = kind === "coop" ? "dungeon invite" : "party invite";
    for (const d of docs || []) {
      if (!d || d.leader !== myId) continue;
      for (const n of d.nos || []) {
        const k = `${d.id}:${n.id}:${n.t}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if ((n.t || 0) >= since) out.push(`${n.name || "Someone"} declined your ${what}.`);
      }
    }
    return out;
  }
  /* clan invites: the invitee can't write the founder's clan record, so the "no" rides on their own clanmem record */
  function clanNotes(mems, clanId, seen, since = 0) {
    const out = [];
    for (const m of mems || []) {
      const n = m && m.no;
      if (!n || n.clan !== clanId) continue;
      const k = `${m.id}:${n.t}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ id: m.id, text: `${m.name || "Someone"} declined your clan invite.`, fresh: (n.t || 0) >= since });   // old ones: just tidy the invite list
    }
    return out;
  }
  function remember(s, key, t = nowS()) { s.invNo = { ...(s.invNo || {}), [key]: t }; forgot(s, t); }
  function forgot(s, t = nowS()) { for (const [k, v] of Object.entries(s.invNo || {})) if (t - v > NO_MEMORY) delete s.invNo[k]; }
  /* a short number for the phone notification of this invite (same key, same notification) */
  function noteId(key) { let h = 7; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0; return 7000 + (h % 900); }

  /* ---------------------------------------------------------------- screen part */
  let ctx = null, cards = [], busy = new Set(), done = new Set(), hidden = new Set(), known = null, tick = null;
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const native = () => (typeof window !== "undefined" ? window.ROTN_NATIVE : null);

  function mount(c) {
    ctx = c;
    if (typeof document === "undefined") return;
    clearInterval(tick); tick = setInterval(refresh, 2500);   // Arena challenges time out; keep the stack honest
    document.addEventListener("visibilitychange", () => { if (!document.hidden && !native()?.bg) native()?.clearInvites?.(); });
  }
  function el() {
    let e = document.getElementById("invbar");
    if (!e) {
      e = document.createElement("div"); e.id = "invbar"; e.className = "invbar"; e.setAttribute("role", "region"); e.setAttribute("aria-label", "Invites");
      e.addEventListener("click", onClick);
      document.body.appendChild(e);
    }
    return e;
  }
  function refresh() {
    if (!ctx || typeof document === "undefined") return;
    let now = [];
    try { now = ctx.list() || []; } catch (e) { console.warn("invites", e); }
    const live = new Set(now.map((c) => c.key));
    for (const k of [...done]) if (!live.has(k)) done.delete(k);       // gone from the world: forget we answered it
    for (const k of [...hidden]) if (!live.has(k)) hidden.delete(k);
    // brand-new invites: a phone notification when the app is in the background
    if (known) for (const c of now) if (!known.has(c.key)) {
      if (document.hidden || native()?.bg) native()?.invite?.({ key: c.key, id: noteId(c.key), title: c.text, body: c.sub });
      ctx.onNew?.(c);
    }
    if (known) for (const k of known) if (!live.has(k)) native()?.cancelInvite?.(noteId(k));
    known = live;
    cards = now.filter((c) => !done.has(c.key));
    draw();
  }
  function draw() {
    if (typeof document === "undefined") return;
    const show = cards.filter((c) => !hidden.has(c.key));
    const blocked = ["title", "tbf", "modal", "nickbox"].some((id) => document.getElementById(id));   // never over the title screen, a fight or a pop-up (they come back after)
    if (!show.length || blocked) { document.getElementById("invbar")?.remove(); return; }
    const e = el(), more = show.length - SHOW;
    const html = show.slice(0, SHOW).map((c) => {
      const b = busy.has(c.key) ? "disabled" : "";
      return `<div class="invcard" data-key="${esc(c.key)}" data-kind="${c.kind}">
        <div class="invhead">${c.pic ? `<span class="invic invpic" aria-hidden="true">${c.pic}</span>` : `<span class="invic" aria-hidden="true">${ICON[c.kind] || "\uE13A"}</span>`}<div class="invt"><b>${esc(c.text)}</b><span>${esc(c.why || c.sub)}</span></div>
          <button class="invx" data-inv="hide" aria-label="Hide for now" title="Hide for now">✕</button></div>
        <div class="invbtns"><button class="btn sm pri" data-inv="yes" ${b || (c.can ? "" : "disabled")}>Accept</button><button class="btn sm" data-inv="no" ${b}>Decline</button></div></div>`;
    }).join("") + (more > 0 ? `<button class="invmore" data-inv="more">+${more} more invite${more > 1 ? "s" : ""} in \uE106 Social</button>` : "");
    if (e.innerHTML !== html) e.innerHTML = html;
  }
  async function onClick(ev) {
    const b = ev.target.closest("[data-inv]"); if (!b) return;
    ev.stopPropagation();
    const a = b.dataset.inv;
    if (a === "more") { ctx?.openSocial?.(); return; }
    const key = b.closest(".invcard")?.dataset.key; if (!key) return;
    if (a === "hide") { hidden.add(key); draw(); return; }
    await answer(key, a === "yes");
  }
  /* answer one invite (from a card, the Social list or a phone notification). Returns false if it's gone or already busy. */
  async function answer(key, yes) {
    if (!ctx || busy.has(key) || done.has(key)) return false;
    const c = cards.find((x) => x.key === key) || (ctx.list() || []).find((x) => x.key === key);
    if (!c) { ctx.toast?.("That invite is gone."); return false; }
    if (yes && !c.can) { ctx.toast?.(c.why || "You can't accept that right now."); return false; }
    busy.add(key); draw();
    try { await ctx.answer(c.kind, c.id, yes, c); }
    catch (e) { console.warn("invite answer", e); }
    finally { busy.delete(key); done.add(key); native()?.cancelInvite?.(noteId(key)); refresh(); }
    return true;
  }
  const has = (key) => !!ctx && (ctx.list() || []).some((x) => x.key === key);
  /* the Social lists mark a card answered too, so it doesn't linger on top */
  function handled(key) { done.add(key); native()?.cancelInvite?.(noteId(key)); refresh(); }

  return { MAX_PARTY, NO_MEMORY, list, nos, notes, clanNotes, remember, forgot, noteId, mount, refresh, answer, handled, has, open: () => ctx?.openSocial?.(), get cards() { return cards.slice(); } };
})();
