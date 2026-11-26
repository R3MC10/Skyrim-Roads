/* The live trade window [OURS] (b358): trade face to face with a player standing in the same place.
   Async offers for friends far away stay as they were (mp.js / social.js); this is the "both of us here, right now" trade.

   How it works (each side only ever writes its OWN record, so two phones never overwrite each other):
   - One record per player per trade in the shared "trades" collection: id lt-<sess>-<uid>, kind "live",
     { sess, uid, name, them, themName, place, rev, items, gold, ready, confirm, status, beat }.
     status: "invite" (asked, waiting) → "open" (window open) → "done" (exchanged) or "cancel" (called off).
   - What you offer leaves your pack at once and sits in your save (s.lt.items / s.lt.gold) until the trade ends,
     so it can't be worn, sold, crafted or listed meanwhile. Worn gear must come off first; bound (noTrade) things
     can't go in; stolen things stay stolen.
   - Every change to your side bumps your rev and clears your Ready/Confirm. When the other side's rev changes, your
     Ready and Confirm clear too (with a "they changed their offer" flash).
   - Confirm is only possible when both are Ready, and it names both revs (key "A:3|B:5"). The swap happens when both
     records carry the same key: each phone takes the other's offered things exactly once and marks itself "done".
   - Once you Confirm you can't take it back on your own: the other phone may already have finished the swap. You wait
     until they finish too (you finish as well), change their side (your confirm clears) or call it off (you get
     everything back). Before you Confirm, Cancel always gives everything back.
   - Disconnect: if the other side goes quiet for 30 s before you've confirmed, the trade is called off and everything
     comes back. If you'd confirmed, your things stay safely held until they're back, then the trade finishes or is
     called off on both phones together: all or nothing. A finished swap stays finished.
   Pure part (node-tested in tests/test_tradewin.js) + screen part (mount/open/draw). */
const TRADEWIN = (() => {
  const AWAY = 30, LONG = 6 * 86400, INVITE_TTL = 90, BEAT = 6, MAX_ROWS = 12, MAX_GOLD = 1e6;
  const nowS = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const docId = (sess, uid) => `lt-${sess}-${uid}`;
  const keyOf = (uidA, revA, uidB, revB) => (String(uidA) < String(uidB) ? `${uidA}:${revA}|${uidB}:${revB}` : `${uidB}:${revB}|${uidA}:${revA}`);
  const live = (lt) => !!lt && (lt.status === "invite" || lt.status === "open");
  const rowCopy = (r, n) => ({ item: r.item, qty: n, charge: r.charge ?? null, temper: r.temper || 0, tq: r.tq || 0, stolen: !!r.stolen, ...(r.cv != null || r.nm ? { cv: r.cv, nm: r.nm } : {}) });
  function giveRow(s, x) {
    const id = G.give(s, x.item, x.qty, x.charge), r = G.invRow(s, id);
    if (r && (x.temper || x.tq || x.stolen)) Object.assign(r, { temper: x.temper || 0, tq: x.tq || 0, ...(x.stolen ? { stolen: true } : {}) });
    if (typeof CRAFTFAIR !== "undefined") CRAFTFAIR.carry(s, id, x, x.qty);
    return id;
  }
  const rowOk = (x) => x && typeof D !== "undefined" && D.ITEMS[x.item] && !x.worn && !x.eq && Number.isFinite(+x.qty) && x.qty >= 1 && !D.ITEMS[x.item].noTrade;
  const sideOk = (d) => Array.isArray(d?.items) && d.items.length <= MAX_ROWS && d.items.every(rowOk) && Number.isFinite(+d.gold) && d.gold >= 0 && d.gold <= MAX_GOLD;

  /* the record this player shares */
  function doc(s, t = nowS()) {
    const lt = s.lt; if (!lt) return null;
    const side = lt.status === "done" && lt.gave ? lt.gave : lt;   // a finished record still shows what was handed over: the other phone takes it from there
    return { kind: "live", sess: lt.sess, uid: s.id, name: s.name, them: lt.them, themName: lt.themName, place: lt.place, rev: lt.rev, items: side.items.map((x) => ({ ...x })), gold: side.gold,
      ready: !!lt.ready, confirm: lt.confirm || null, status: lt.status, beat: Math.floor(t), t: lt.t0 };
  }
  function fresh(s, sess, card, place, status, t) {
    s.lt = { sess, them: card.id, themName: card.name, place: place || "", rev: 0, items: [], gold: 0, ready: false, confirm: null, status, t0: Math.floor(t), seenRev: null, lastSeen: Math.floor(t), flash: 0, note: "" };
    return s.lt;
  }
  /* ask a player here to trade */
  function invite(s, card, place, t = nowS()) {
    if (!card || card.id === s.id) return { err: "Pick someone to trade with." };
    if (live(s.lt)) return { err: "Finish the trade you're in first." };
    if (s.lt && s.lt.status === "wait") return { err: "Your last trade is still settling. Wait for the other player to come back." };
    fresh(s, `${s.id}-${Math.floor(t)}`, card, place, "invite", t);
    return { ok: true, text: `You ask ${card.name} to trade.` };
  }
  /* the other player says yes to an invite record */
  function join(s, inv, t = nowS()) {
    if (!inv || inv.kind !== "live" || inv.them !== s.id || inv.status !== "invite") return { err: "That trade invite is gone." };
    if (t - (inv.beat || 0) > INVITE_TTL) return { err: "That trade invite ran out." };
    if (live(s.lt) && s.lt.sess !== inv.sess) return { err: "Finish the trade you're in first." };
    if (s.lt && s.lt.status === "wait") return { err: "Your last trade is still settling. Wait for the other player to come back." };
    fresh(s, inv.sess, { id: inv.uid, name: inv.name }, inv.place, "open", t);
    s.lt.seenRev = inv.rev || 0;
    return { ok: true, text: `You open a trade with ${inv.name}.` };
  }
  /* a "no" to an invite: a cancelled record with nothing in it, so the asker's window closes */
  function declineDoc(s, inv, t = nowS()) {
    return { kind: "live", sess: inv.sess, uid: s.id, name: s.name, them: inv.uid, themName: inv.name, place: inv.place, rev: 0, items: [], gold: 0, ready: false, confirm: null, status: "cancel", beat: Math.floor(t), t: Math.floor(t) };
  }
  const editable = (lt) => (lt && lt.status === "open" ? (lt.confirm ? "You've confirmed. Wait for the other side, or for them to change their offer." : "") : "The trade window is closed.");
  function bump(lt) { lt.rev++; lt.ready = false; lt.confirm = null; }
  /* put something from your pack into your side */
  function add(s, rowId, qty = null) {
    const lt = s.lt, no = editable(lt); if (no) return { err: no };
    const r = G.invRow(s, rowId);
    if (!r || !D.ITEMS[r.item]) return { err: "You don't have that." };
    if (D.ITEMS[r.item].noTrade) return { err: "That's bound to you. It can't be traded." };
    const free = G.freeQty ? G.freeQty(s, rowId) : r.qty;
    if (free <= 0) return { err: "You're wearing that. Take it off first." };
    const n = Math.max(1, Math.min(free, Math.floor(+qty || free)));
    if (lt.items.length >= MAX_ROWS) return { err: `A trade holds up to ${MAX_ROWS} different things.` };
    const x = rowCopy(r, n);
    if (!G.take(s, rowId, n)) return { err: "You don't have that." };
    lt.items.push(x); bump(lt);
    return { ok: true };
  }
  /* take something back out of your side */
  function drop(s, idx) {
    const lt = s.lt, no = editable(lt); if (no) return { err: no };
    const x = lt.items[idx]; if (!x) return { err: "That's not in your offer." };
    lt.items.splice(idx, 1); giveRow(s, x); bump(lt);
    return { ok: true };
  }
  function setGold(s, n) {
    const lt = s.lt, no = editable(lt); if (no) return { err: no };
    n = Math.max(0, Math.min(MAX_GOLD, Math.floor(+n || 0)));
    const have = s.gold + lt.gold; if (n > have) n = have;
    if (n === lt.gold) return { ok: true, same: true };
    s.gold = have - n; lt.gold = n; bump(lt);
    return { ok: true };
  }
  function ready(s, theirs) {
    const lt = s.lt, no = editable(lt); if (no) return { err: no };
    if (!theirs || theirs.sess !== lt.sess || theirs.status !== "open") return { err: "Waiting for the other player." };
    lt.ready = true; lt.seenRev = theirs.rev;
    return { ok: true };
  }
  function confirm(s, theirs) {
    const lt = s.lt; if (!lt || lt.status !== "open") return { err: "The trade window is closed." };
    if (lt.confirm) return { ok: true, same: true };
    if (!lt.ready) return { err: "Press Ready first." };
    if (!theirs || theirs.sess !== lt.sess || theirs.status !== "open" || !theirs.ready) return { err: "Wait until they're Ready too." };
    if (theirs.rev !== lt.seenRev) return { err: "They changed their offer. Look again." };
    if (!sideOk(theirs)) return { err: "Something in their offer can't be traded." };
    lt.confirm = keyOf(s.id, lt.rev, theirs.uid, theirs.rev);
    return { ok: true };
  }
  /* give back everything on your side and close */
  function refund(s, note) {
    const lt = s.lt;
    for (const x of lt.items) giveRow(s, x);
    s.gold += lt.gold; lt.items = []; lt.gold = 0; lt.ready = false; lt.confirm = null; lt.status = "cancel"; lt.note = note || "The trade was called off. Your things are back in your pack.";
    return lt.note;
  }
  /* call it off yourself: only before you've confirmed */
  function cancel(s) {
    const lt = s.lt; if (!lt) return { err: "No trade." };
    if (lt.status === "done" || lt.status === "cancel") return { ok: true, closed: true };
    if (lt.status === "wait" || lt.confirm) return { err: "You've confirmed, so the trade may already be going through. Wait for the other side to finish or change their offer." };
    return { ok: true, text: refund(s, "You called off the trade. Your things are back in your pack.") };
  }
  /* the swap: their side comes to you, your side is gone (it's in their pack now). Runs once. */
  function commit(s, theirs) {
    const lt = s.lt;
    for (const x of theirs.items) giveRow(s, x);
    s.gold += theirs.gold;
    lt.gave = { items: lt.items, gold: lt.gold }; lt.got = { items: theirs.items.map((x) => ({ ...x })), gold: theirs.gold };
    lt.items = []; lt.gold = 0; lt.status = "done"; lt.ready = false;
    lt.note = `Trade done with ${lt.themName}.`;
    return lt.note;
  }
  /* the heart of it: look at the other side's latest record and move on. Safe to call any number of times.
     -> { changed, text, flash } */
  function step(s, theirs, t = nowS()) {
    const lt = s.lt, out = { changed: false };
    if (!lt || lt.status === "done" || lt.status === "cancel") return out;
    if (theirs && theirs.sess !== lt.sess) theirs = null;
    if (theirs && theirs.uid !== lt.them) theirs = null;
    if (!theirs) {
      if (lt.status === "invite") { if (t - lt.t0 > INVITE_TTL) { refund(s, `${lt.themName} didn't answer.`); out.changed = true; out.text = lt.note; } return out; }
      if (t - lt.lastSeen > AWAY) {
        if (!lt.confirm) { out.text = refund(s, `${lt.themName} went away. The trade is off and your things are back in your pack.`); out.changed = true; }
        else if (t - lt.lastSeen > LONG) { out.text = refund(s, `${lt.themName} never came back to finish the trade, so your things are back in your pack.`); out.changed = true; }
        else if (lt.status !== "wait") { lt.status = "wait"; out.changed = true; }
      }
      return out;
    }
    if (theirs.status === "cancel") { out.text = refund(s, lt.status === "invite" ? `${lt.themName} doesn't want to trade right now.` : `${lt.themName} called off the trade. Your things are back in your pack.`); out.changed = true; return out; }
    if (theirs.status === "done") {
      if (lt.confirm && theirs.confirm === lt.confirm && sideOk(theirs)) out.text = commit(s, theirs);
      else out.text = refund(s);   // can't happen between honest phones: they only finish on our own confirm
      out.changed = true; return out;
    }
    if (lt.status === "invite") { if (theirs.status === "open") { lt.status = "open"; lt.seenRev = theirs.rev; lt.lastSeen = Math.max(lt.lastSeen, theirs.beat || 0); out.changed = true; } return out; }
    if (lt.status === "wait") lt.status = "open";
    if (theirs.beat > lt.lastSeen) { lt.lastSeen = theirs.beat; }
    if (theirs.rev !== lt.seenRev) {
      if (lt.seenRev != null && (lt.ready || lt.confirm || theirs.rev > lt.seenRev)) { out.flash = true; lt.flash = t; }
      lt.seenRev = theirs.rev; lt.ready = false; lt.confirm = null; out.changed = true;
    }
    if (lt.confirm && theirs.confirm === lt.confirm && lt.confirm === keyOf(s.id, lt.rev, theirs.uid, theirs.rev) && sideOk(theirs)) { out.text = commit(s, theirs); out.changed = true; return out; }
    if (t - lt.lastSeen > AWAY) {
      if (!lt.confirm) { out.text = refund(s, `${lt.themName} went away. The trade is off and your things are back in your pack.`); out.changed = true; }
      else if (lt.status !== "wait") { lt.status = "wait"; out.changed = true; }
    }
    return out;
  }
  /* how much each side is worth (the items' base value + gold), for the scam warnings */
  const worth = (side) => (side ? (side.gold || 0) + (side.items || []).reduce((a, x) => a + ((D.ITEMS[x.item]?.value || 0) * (x.qty || 1)), 0) : 0);
  function warnings(lt, theirs) {
    const out = [], mine = worth(lt), back = worth(theirs);
    if (!theirs) return out;
    if ((lt.items.length || lt.gold) && !(theirs.items || []).length && !theirs.gold) out.push("You get nothing back. That makes it a gift.");
    else if (mine > back * 3 && mine - back >= 200) out.push(`You give about ${mine - back} gold more in value than you get.`);
    else if (back > mine * 3 && back - mine >= 200 && (lt.items.length || lt.gold)) out.push(`They give about ${back - mine} gold more in value than you do.`);
    return out;
  }
  /* trade invites for me, for the invite cards (invites.js) */
  function invitesFor(docs, uid, t = nowS()) {
    return (docs || []).filter((d) => d && d.kind === "live" && d.them === uid && d.status === "invite" && t - (d.beat || 0) <= INVITE_TTL);
  }

  /* ================================================================ screen part */
  let ctx = null, docs = [], lastHtml = "", tick = null, beatT = 0, showing = false, drawer = false, pickCat = "all", lastFlash = 0, busy = false;
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const S = () => ctx?.S?.();
  const theirDoc = () => { const s = S(), lt = s?.lt; return lt ? docs.find((d) => d.id === docId(lt.sess, lt.them)) || null : null; };
  function mount(c) {
    ctx = c;
    if (typeof Store !== "undefined" && Store.watch) Store.watch("trades", (list) => { docs = (list || []).filter((d) => d && d.kind === "live"); onDocs(); });
    clearInterval(tick); tick = setInterval(() => onDocs(true), 2000);
    if (typeof document !== "undefined") document.addEventListener("keydown", onKey, true);
    const s = S(); if (s?.lt && (live(s.lt) || s.lt.status === "wait")) { showing = s.lt.status !== "invite"; setTimeout(() => onDocs(), 500); }
    tidy();
  }
  function publish(force) {
    const s = S(); if (!s?.lt || typeof Store === "undefined" || !Store.online) return;
    const d = doc(s); beatT = nowS();
    Store.put("trades", docId(s.lt.sess, s.id), d);
  }
  /* my old finished records: gone after an hour */
  function tidy() {
    const s = S(); if (!s || typeof Store === "undefined") return;
    const t = nowS();
    for (const d of docs) if (d.uid === s.id && (d.status === "done" || d.status === "cancel") && t - (d.beat || 0) > 3600 && (!s.lt || s.lt.sess !== d.sess)) Store.remove("trades", d.id);
  }
  function onDocs(fromTick) {
    const s = S(); if (!s) return;
    ctx.invRefresh?.();
    const lt = s.lt; if (!lt) return;
    if (lt.status === "done" || lt.status === "cancel") { if (showing) draw(); return; }
    const before = JSON.stringify([lt.status, lt.rev, lt.ready, lt.confirm]);
    const r = step(s, theirDoc());
    if (r.flash && lt.flash !== lastFlash) { lastFlash = lt.flash; ctx.toast?.(`${lt.themName} changed their offer. Look again before you confirm.`); ctx.sound?.("page"); }
    if (r.changed) {
      ctx.persist?.(true); publish();
      if (lt.status === "open" && !showing) { showing = true; ctx.sound?.("page"); }
      if (r.text) { ctx.toast?.(r.text); if (lt.status === "done") ctx.sound?.("coin"); }
    } else if (live(lt) || lt.status === "wait") { if (nowS() - beatT >= BEAT) publish(); }
    if (showing) draw(); else if (JSON.stringify([lt.status, lt.rev, lt.ready, lt.confirm]) !== before) draw();
  }
  /* start a trade with a card (from the party list, a friend's row or a traveller's card) */
  function start(card) {
    const s = S(); if (!s) return;
    if (s.lt && live(s.lt) && s.lt.them === card.id) { showing = s.lt.status === "open"; draw(); return; }
    if (s.lt && (s.lt.status === "done" || s.lt.status === "cancel")) s.lt = null;
    const r = invite(s, card, ctx.place?.() || "");
    if (r.err) return ctx.toast?.(r.err);
    ctx.persist?.(); publish(); ctx.toast?.(`${r.text} The window opens when they say yes.`);
  }
  /* an invite card (invites.js) was answered */
  async function answer(id, yes) {
    const s = S(), inv = docs.find((d) => d.id === id);
    if (!s || !inv) return ctx.toast?.("That trade invite is gone.");
    if (!yes) { Store.put("trades", docId(inv.sess, s.id), declineDoc(s, inv)); ctx.toast?.(`You turn down ${inv.name}'s trade.`); return; }
    if (ctx.near && !ctx.near(inv.uid)) return ctx.toast?.(`You have to be in the same place as ${inv.name} to trade face to face.`);
    if (s.lt && !live(s.lt) && s.lt.status !== "wait") s.lt = null;
    const r = join(s, inv); if (r.err) return ctx.toast?.(r.err);
    ctx.persist?.(true); publish(); showing = true; drawer = false; draw();
  }
  function cards(t = nowS()) {
    const s = S(); if (!s) return [];
    return invitesFor(docs, s.id, t).filter((d) => !(s.lt && s.lt.sess === d.sess)).map((d) => ({ key: "tradewin:" + d.id, kind: "tradewin", id: d.id, from: d.name, t: d.beat || 0,
      text: `${d.name} wants to trade with you`, sub: "Face to face: you both put things in, check, and confirm", can: true }));
  }
  function close() {
    const s = S(); showing = false; drawer = false;
    if (s?.lt && (s.lt.status === "done" || s.lt.status === "cancel")) { s.lt = null; ctx.persist?.(); }
    if (typeof document !== "undefined") document.getElementById("twin")?.remove();
  }
  /* ---- drawing */
  function rar(x) { return typeof RARITY !== "undefined" ? RARITY.of(x.item, x) : "common"; }
  function nameOf(x) { const base = (typeof NM !== "undefined" && NM.item ? NM.item(x.item) : D.ITEMS[x.item]?.name || x.item); return (typeof NAMES !== "undefined" ? NAMES.improved(base, x) : base) + (x.nm ? ` “${x.nm}”` : ""); }
  function itemCard(x, i, mine, locked) {
    const it = D.ITEMS[x.item] || {}, r = rar(x), stats = G.itemStats ? G.itemStats(x.item) : "";
    const bits = [typeof RARITY !== "undefined" ? (RARITY.NAME || {})[r] || r : "", x.tq ? `forged +${x.tq}` : "", x.stolen ? "stolen" : "", `worth ${(it.value || 0) * (x.qty || 1)}`].filter(Boolean).map((b) => `<i>${esc(b)}</i>`).join(" · ");
    return `<div class="tw-it rar-${r}">${typeof ICONART !== "undefined" ? ICONART.item(x.item, 38, x) : ""}<div class="tw-t"><b class="q-${r}">${esc(nameOf(x))}</b>${x.qty > 1 ? `<i class="tw-q">×${x.qty}</i>` : ""}<span>${esc(stats)}</span><span class="tw-m">${bits}</span></div>${mine && !locked ? `<button class="btn sm" data-tw="drop" data-i="${i}" aria-label="Take back">✕</button>` : ""}</div>`;
  }
  function side(title, d, mine, locked, st) {
    const items = d ? d.items || [] : [], gold = d ? d.gold || 0 : 0;
    return `<section class="tw-side ${mine ? "tw-mine" : "tw-theirs"}${st === "confirm" ? " tw-conf" : st === "ready" ? " tw-ready" : ""}"><h3>${esc(title)}<span class="tw-st">${st === "confirm" ? "Confirmed" : st === "ready" ? "Ready" : st === "wait" ? "Away" : "Choosing"}</span></h3>
      <div class="tw-list">${items.map((x, i) => itemCard(x, i, mine, locked)).join("") || `<p class="sub">${mine ? "Nothing yet. Add things from your pack." : "Nothing yet."}</p>`}</div>
      <div class="tw-gold">${mine ? `<label>Gold <input id="twgold" inputmode="numeric" value="${gold || ""}" placeholder="0" ${locked ? "disabled" : ""} aria-label="Gold you give"></label>${locked ? "" : `<button class="btn sm" data-tw="gold">Set</button>`}` : `<b class="gold">${gold}</b> gold`}</div></section>`;
  }
  function drawerHTML(s) {
    const loose = (G.handable ? G.handable(s) : s.inv).filter((r) => D.ITEMS[r.item] && !D.ITEMS[r.item].noTrade);
    const kinds = [["all", "All"], ["weapon", "Weapons"], ["armor", "Armour"], ["potion", "Potions"], ["mats", "Materials"], ["other", "Other"]];
    const kOf = (it) => { const k = typeof MARKET !== "undefined" ? MARKET.kindOf(it) : "other"; return ["weapon", "armor", "potion", "mats"].includes(k) ? k : "other"; };
    const rows = loose.filter((r) => pickCat === "all" || kOf(r.item) === pickCat).slice(0, 80);
    return `<div class="tw-drawer" role="dialog" aria-label="Pick from your pack"><div class="tw-dh"><b>Your pack</b><button class="btn sm" data-tw="drawer">Done</button></div>
      <div class="chips">${kinds.map(([k, l]) => `<button class="chip ${k === pickCat ? "on" : ""}" data-tw="cat" data-k="${k}">${l}</button>`).join("")}</div>
      <div class="tw-plist">${rows.map((r) => `<button class="tw-pick rar-${rar(r)}" data-tw="add" data-id="${r.id}">${typeof ICONART !== "undefined" ? ICONART.item(r.item, 30, r) : ""}<span class="q-${rar(r)}">${esc(nameOf(r))}${r.qty > 1 ? ` ×${r.qty}` : ""}</span></button>`).join("") || `<p class="sub">Nothing you can trade here. Worn gear has to come off first; bound things can't be traded.</p>`}</div></div>`;
  }
  function draw() {
    if (typeof document === "undefined") return;
    const s = S(), lt = s?.lt;
    if (!lt || !showing) { document.getElementById("twin")?.remove(); return; }
    let e = document.getElementById("twin");
    if (!e) { lastHtml = ""; e = document.createElement("div"); e.id = "twin"; e.className = "twin"; e.setAttribute("role", "dialog"); e.setAttribute("aria-label", "Trade"); e.addEventListener("click", onClick); document.body.appendChild(e); }
    const th = theirDoc(), done = lt.status === "done", off = lt.status === "cancel", locked = !!lt.confirm || done || off;
    const thSt = !th ? "wait" : th.confirm ? "confirm" : th.ready ? "ready" : lt.status === "wait" ? "wait" : "";
    const mySt = lt.confirm ? "confirm" : lt.ready ? "ready" : "";
    const flash = nowS() - (lt.flash || 0) < 6;
    const warn = th ? warnings(lt, th) : [];
    let foot;
    if (done || off) foot = `<p class="tw-note">${esc(lt.note)}</p><button class="btn pri" data-tw="close">Close</button>`;
    else if (lt.status === "wait") foot = `<p class="tw-note">${esc(lt.themName)} went quiet. You've confirmed, so your things stay safely held: the trade finishes or is called off when they're back.</p><button class="btn" data-tw="hide">Hide</button>`;
    else if (!lt.ready) foot = `<button class="btn pri" data-tw="ready" ${th ? "" : "disabled"}>Ready</button><button class="btn" data-tw="cancel">Cancel</button>`;
    else if (!lt.confirm) foot = `<button class="btn pri" data-tw="confirm" ${th?.ready && th.rev === lt.seenRev ? "" : "disabled"}>${th?.ready ? "Confirm trade" : "Waiting for them…"}</button><button class="btn" data-tw="cancel">Cancel</button>`;
    else foot = `<p class="tw-note">You confirmed. Waiting for ${esc(lt.themName)}…</p><button class="btn" data-tw="hide">Hide</button>`;
    const html = `<div class="tw-box"><header class="tw-head"><h2>Trading with ${esc(lt.themName)}</h2><button class="invx" data-tw="${done || off ? "close" : "hide"}" aria-label="Hide">✕</button></header>
      ${flash ? `<div class="tw-flash" role="alert">${esc(lt.themName)} changed their offer. Check it again.</div>` : ""}
      <div class="tw-sides">${side(`${lt.themName} gives`, done ? lt.got : th, false, true, thSt)}${side("You give", done ? lt.gave : lt, true, locked, mySt)}</div>
      ${!locked ? `<button class="btn tw-add" data-tw="drawer">＋ Add from your pack</button>` : ""}
      ${warn.length && !done && !off ? `<p class="tw-warn">${warn.map(esc).join(" ")}</p>` : ""}
      <p class="sub tw-help">${done || off ? "" : "Both press Ready, check both sides, then both Confirm. Any change un-readies you both. Enter = Ready/Confirm, Esc = Cancel."}</p>
      <footer class="tw-foot">${foot}</footer>${drawer && !locked ? drawerHTML(s) : ""}</div>`;
    if (html === lastHtml || document.activeElement?.id === "twgold") return;
    const sc = e.querySelector(".tw-plist")?.scrollTop || 0;
    lastHtml = html; e.innerHTML = html;
    const pl = e.querySelector(".tw-plist"); if (pl) pl.scrollTop = sc;
  }
  function act(a, el) {
    const s = S(), lt = s?.lt; if (!lt || busy) return;
    let r = null;
    if (a === "hide") { showing = false; draw(); return; }
    if (a === "close") { close(); return; }
    if (a === "drawer") { drawer = !drawer; draw(); return; }
    if (a === "cat") { pickCat = el.dataset.k; draw(); return; }
    if (a === "add") r = add(s, +el.dataset.id);
    else if (a === "drop") r = drop(s, +el.dataset.i);
    else if (a === "gold") r = setGold(s, document.getElementById("twgold")?.value);
    else if (a === "ready") r = ready(s, theirDoc());
    else if (a === "confirm") r = confirm(s, theirDoc());
    else if (a === "cancel") r = cancel(s);
    if (!r) return;
    if (r.err) { ctx.toast?.(r.err); return; }
    if (r.text) ctx.toast?.(r.text);
    ctx.sound?.("click"); ctx.persist?.(a !== "ready"); publish();
    if (a === "confirm") onDocs();
    if (document.activeElement?.id === "twgold") document.activeElement.blur();
    draw();
  }
  function onClick(ev) { const b = ev.target.closest("[data-tw]"); if (!b || b.disabled) return; ev.stopPropagation(); act(b.dataset.tw, b); }
  function onKey(ev) {
    if (!showing || !document.getElementById("twin")) return;
    const lt = S()?.lt; if (!lt) return;
    if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); if (lt.status === "done" || lt.status === "cancel") close(); else if (drawer) { drawer = false; draw(); } else act("cancel"); }
    else if (ev.key === "Enter") {
      if (document.activeElement?.id === "twgold") { ev.preventDefault(); act("gold"); return; }
      ev.preventDefault();
      if (lt.status === "done" || lt.status === "cancel") close(); else if (!lt.ready) act("ready"); else if (!lt.confirm) act("confirm");
    }
  }
  const open = () => { const s = S(); if (s?.lt && s.lt.status !== "invite") { showing = true; draw(); } };

  return { AWAY, INVITE_TTL, MAX_ROWS, docId, keyOf, live, doc, invite, join, declineDoc, add, drop, setGold, ready, confirm, cancel, step, worth, warnings, invitesFor, sideOk,
    mount, start, answer, cards, open, close, get busy() { const s = S(); return !!(s?.lt && (live(s.lt) || s.lt.status === "wait")); }, _set: (d) => { docs = d; } };
})();
