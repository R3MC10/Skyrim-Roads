/* greet.js: other players are Strangers until you've greeted each other. [OURS]
   On the map (and the compass) a player outside your party shows their real look but the label "Stranger".
   When you're in the same place (the same town, or the same spot on the road), click their hero → Greet. They get an
   Accept / Not now prompt; once they accept you both know each other's names for good.
   Who you know lives in your save (S.known = { id: { name, t } }) and in the shared "greets" collection (one record per
   pair, id "a~b"), so a lost save or a second phone learns it again. Party members and friends are always known.
   Pure parts (knows, label, canGreet, ask, accept, sync) are tested in node: tests/test_greet.js. */
const GREET = (() => {
  const TTL = 10 * 60;            // an unanswered greeting lapses after 10 minutes (game seconds = real seconds)
  const NEAR = 40;                // same spot on the road: within this many map pixels (like MP.NEAR_PX)
  /* words in the player's language (Polish lines live in i18n_pcmap.js); {name} filled in after */
  const L = (en, v) => { let s = en; try { if (typeof I18N !== "undefined" && I18N.lang() === "pl" && typeof I18N_EXTRA !== "undefined" && I18N_EXTRA.words[en]) s = I18N_EXTRA.words[en]; } catch { /* English */ } return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : s; };
  const nowS = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const pairId = (a, b) => [String(a), String(b)].sort().join("~");
  const inParty = (party, id) => !!party?.members?.some((m) => m.id === id);
  const friend = (S, id) => { try { return typeof SOCIAL !== "undefined" && !!SOCIAL.isFriend?.(S, id); } catch { return false; } };

  /* do I know this player's name? */
  function knows(S, id, party) {
    if (!S || !id) return false;
    if (id === S.id) return true;
    if (inParty(party, id)) return true;
    if (S.known && S.known[id]) return true;
    return friend(S, id);
  }
  /* what to call them on the map */
  function label(S, o, party) {
    if (!o) return "";
    if (!knows(S, o.id, party)) return L("Stranger");
    return (o.clan ? `[${o.clan}] ` : "") + (o.name || S?.known?.[o.id]?.name || "?") + (inParty(party, o.id) ? " ⚑" : "");
  }
  function learn(S, id, name) {
    if (!S || !id || id === S.id) return false;
    S.known = S.known || {};
    const had = !!S.known[id];
    S.known[id] = { name: String(name || S.known[id]?.name || "?").slice(0, 40), t: S.known[id]?.t || Math.round(nowS()) };
    return !had;
  }
  /* are we in the same place? both in the same town, or both out on the land close together (never inside a dungeon) */
  function samePlace(S, myPos, o, theirPos, near = NEAR) {
    if (!S || !o) return false;
    if (S.dungeon || o.dungeon) return false;
    if (S.location || o.loc) return !!S.location && S.location === o.loc;
    if (!myPos || !theirPos) return false;
    const MW = typeof G !== "undefined" && G.MAP_W ? G.MAP_W : 1000, MH = typeof G !== "undefined" && G.MAP_H ? G.MAP_H : 700;
    return Math.hypot((myPos[0] - theirPos[0]) * MW, (myPos[1] - theirPos[1]) * MH) <= near;
  }
  /* can I greet them right now? { ok } or { ok: false, why } */
  function canGreet(S, o, myPos, theirPos, party, docs = []) {
    if (!o || !o.id || o.id === S?.id) return { ok: false, why: "" };
    if (knows(S, o.id, party)) return { ok: false, why: L("You already know each other.") };
    if (!samePlace(S, myPos, o, theirPos)) return { ok: false, why: L("Get to the same place to greet them.") };
    const d = docs.find((x) => x && x.id === pairId(S.id, o.id));
    if (d && d.status === "ask" && d.from === S.id && nowS() - (d.t || 0) < TTL) return { ok: false, why: L("You greeted them. Waiting for an answer.") };
    return { ok: true };
  }
  /* the record to put: I greet them */
  function ask(S, o) {
    return { id: pairId(S.id, o.id), doc: { from: S.id, fromName: S.name, fromRace: S.race || "", fromLevel: S.level || 1, to: o.id, toName: o.name || "", status: "ask", t: Math.round(nowS()) } };
  }
  /* they greeted me and I accept: both names known */
  function accept(S, doc) {
    learn(S, doc.from, doc.fromName);
    return { id: pairId(doc.from, doc.to), doc: { from: doc.from, fromName: doc.fromName, to: doc.to, toName: S.name, status: "ok", t: doc.t, at: Math.round(nowS()) } };
  }
  function decline(S, doc) {
    return { id: pairId(doc.from, doc.to), doc: { from: doc.from, fromName: doc.fromName, to: doc.to, toName: S.name, status: "no", t: doc.t, at: Math.round(nowS()) } };
  }
  /* read the shared records: learn every accepted pair I'm in; list greetings waiting for my answer */
  function sync(S, docs, t = nowS()) {
    const learned = [], incoming = [];
    if (!S) return { learned, incoming };
    for (const d of docs || []) {
      if (!d || !d.from || !d.to || (d.from !== S.id && d.to !== S.id)) continue;
      if (d.status === "ok") {
        const other = d.from === S.id ? d.to : d.from, name = d.from === S.id ? d.toName : d.fromName;
        if (learn(S, other, name)) learned.push({ id: other, name });
      } else if (d.status === "ask" && d.to === S.id && t - (d.t || 0) < TTL && !(S.known && S.known[d.from])) incoming.push(d);
    }
    return { learned, incoming };
  }

  // ------------------------------------------------------------ in the game
  let ctx = null, docs = [], answered = new Set(), card = null;
  const live = typeof document !== "undefined" && typeof document.createElement === "function";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* ctx = { S, Store, toast, persist, others, party, otherPos, livePos } (functions) */
  function mount(c) {
    ctx = c;
    if (!live || !c.Store?.watch) return;
    c.Store.watch("greets", (ds) => { docs = (ds || []).filter((d) => d && d.from && d.to); onDocs(); });
  }
  function onDocs() {
    const S = ctx?.S(); if (!S) return;
    const r = sync(S, docs);
    if (r.learned.length) { ctx.persist?.(); for (const p of r.learned) ctx.toast?.(L("You and {name} know each other now.", { name: p.name })); }
    const ask1 = r.incoming.find((d) => !answered.has(d.id + ":" + d.t));
    if (ask1) prompt(ask1); else if (!r.incoming.length) document.getElementById("greetask")?.remove();
  }
  function put(rec) { try { ctx.Store.put("greets", rec.id, rec.doc); } catch { /* offline: try again next time */ } const i = docs.findIndex((d) => d.id === rec.id); const d = { ...rec.doc, id: rec.id }; if (i >= 0) docs[i] = d; else docs.push(d); }
  function prompt(d) {
    if (document.getElementById("greetask")) return;
    const el = document.createElement("div"); el.id = "greetask"; el.className = "greetask"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", L("A stranger greets you"));
    const who = [d.fromRace ? d.fromRace[0].toUpperCase() + d.fromRace.slice(1) : "", d.fromLevel ? `${L("level")} ${d.fromLevel}` : ""].filter(Boolean).join(", ");
    el.innerHTML = `<b>${esc(L("A stranger greets you"))}</b><span>${esc(who ? `${L("Stranger")} (${who})` : L("Stranger"))} · ${esc(L("Greet them back and you'll both know each other's names."))}</span>
      <div class="gk-row"><button class="btn pri sm" data-g="yes">${esc(L("Accept"))}</button><button class="btn sm" data-g="no">${esc(L("Not now"))}</button></div>`;
    el.onclick = (e) => {
      const b = e.target.closest("[data-g]"); if (!b) return;
      const S = ctx.S(); answered.add(d.id + ":" + d.t); el.remove();
      if (b.dataset.g === "yes") { put(accept(S, d)); ctx.persist?.(); ctx.toast?.(L("You and {name} know each other now.", { name: d.fromName })); }
      else put(decline(S, d));
      onDocs();
    };
    document.body.appendChild(el);
  }
  /* a click on the map: was it on another hero? then show their card. v = the map's view (others with id, pos) */
  function tap(v, sx, sy) {
    if (!ctx || !v?.transform || !v.others?.length) return false;
    const { k, ox, oy } = v.transform, W = 1000, H = 700;
    let best = null, bd = 22;
    for (const o of v.others) {
      if (!o.id) continue;
      const x = (o.drawX ?? o.pos[0]) * W * k + ox, y = (o.drawY ?? o.pos[1]) * H * k + oy - 14;   // the figure stands above its feet
      const d = Math.hypot(x - sx, y - sy); if (d < bd) { bd = d; best = o; }
    }
    if (!best) return false;
    show(best.id);
    return true;
  }
  /* their panel (mapsheet.js): who they are, and Greet / Invite / Trade / Friend (ctx.acts gives the ui.js rows) */
  function show(id) {
    const S = ctx.S(), o = (ctx.others() || []).find((x) => x.id === id); if (!S || !o) return;
    const party = ctx.party(), kn = knows(S, o.id, party), can = canGreet(S, o, ctx.livePos(), ctx.otherPos(o), party, docs);
    const race = o.race ? o.race[0].toUpperCase() + o.race.slice(1) : "";
    const where = o.loc || (typeof G !== "undefined" && G.holdAt ? G.holdAt(ctx.otherPos(o)) : "");
    const acts = [];
    if (!kn) acts.push({ act: "greet", label: L("Greet"), sub: can.ok ? L("Say hello: once they answer, you'll both know each other's names") : can.why, pri: true, off: !can.ok });
    try { for (const a of (ctx.acts ? ctx.acts(o, kn) : []) || []) acts.push(a); } catch { /* no extra rows */ }
    if (typeof MAPSHEET === "undefined") return;
    MAPSHEET.open({ id: "hero:" + o.id, owner: "hero", domId: "greetcard", label: kn ? label(S, o, party) : L("Stranger"),
      icon: o.look && typeof AVATAR !== "undefined" ? AVATAR.portrait(o, 40) : "",
      title: kn ? label(S, o, party) : L("Stranger"), sub: [race, o.level ? `${L("level")} ${o.level}` : ""].filter(Boolean).join(" · "),
      rows: [where ? [L("Where"), where + (o.moving ? " · " + L("travelling") : "") + (o.dungeon ? " · " + L("in a dungeon") : "")] : null,
        [L("Between you"), kn ? (inParty(party, o.id) ? L("In your party.") : L("You know each other.")) : L("Strangers"), kn ? "good" : ""]],
      actions: acts,
      onClick: (e, b) => {
        if (b.dataset.wg === "greet") { e.stopPropagation(); const S2 = ctx.S(); const c2 = canGreet(S2, o, ctx.livePos(), ctx.otherPos(o), ctx.party(), docs); if (c2.ok) { put(ask(S2, o)); ctx.toast?.(L("You greet the stranger. Wait for them to answer.")); } else ctx.toast?.(c2.why); return close(); }
        if (b.dataset.act && ctx.onAct) { ctx.onAct(e); if (b.dataset.keep == null) close(); }
      },
      onClose: (why) => { if (why === "swap" && MAPSHEET.isOpen("hero")) return; card = null; } });
    card = id;
  }
  const close = () => { if (typeof MAPSHEET !== "undefined") MAPSHEET.close("hero"); card = null; };
  return { TTL, NEAR, pairId, knows, label, learn, samePlace, canGreet, ask, accept, decline, sync, mount, tap, show, close, docs: () => docs, _setDocs: (d) => { docs = d; } };
})();
if (typeof module !== "undefined") module.exports = GREET;
