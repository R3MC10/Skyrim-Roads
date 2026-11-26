/* defeat.js: losing a fight costs nothing (owner decision, 25 Nov 2026 survey: "no defeat penalty, you just retry").

   - Every fight remembers the hero as they were when it started (G.Fight.prototype.run is wrapped, outermost). When a
     personal fight is lost, engine.js die() asks knockout(): the hero goes back to that moment. Gold, items, potions,
     XP and skill practice won or used during the lost fight are rolled back; everything from before it is kept.
   - On screen (tbfight.js call): a lost fight puts the save back to just before the action that started it and opens
     the defeat screen: Retry (the same foes, same setup), Adjust gear (Hero -> Items, then back), Retreat (on the road:
     back on the road past it; in a dungeon: out of this room, cleared rooms stay cleared; anywhere else: walk away).
     Difficulty (difficulty.js) can be changed here, between fights, never during one. The next try takes its own
     snapshot when the fight starts.
   - A short honest line says why you lost ("The troll's Heavy Swing did most of the damage (62%).").
   - Party fights: one phone can't reset everyone's fight. The leader's phone opens a party vote (partyvote.js: majority,
     tie -> leader) on Retry / Retreat in the shared "tbf" collection (doc id dv~leader~time). Members who were knocked
     down just get back up; their own save never took the lost fight's results (sharedfight.js finish).
   - Public fights (world events, world bosses, raid dragons, other players: DIFF.shared) have no defeat screen and no
     rollback: you get back up where you are and the event goes on; what you did in it still counts.
   - Followers and horses are only ever knocked down (the fight engine); nothing here touches them.
   Pure parts (knockout, lostFight, why, retreatState, stepBack, vote helpers) are node-testable (tests/test_defeat.js). */
const DEFEAT = (() => {
  const clone = (o) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
  const tr = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cap = (t) => { t = String(t || ""); return t.charAt(0).toUpperCase() + t.slice(1); };
  const DOM = typeof document !== "undefined";
  const FRESH_MS = 5000;          // a knock-down this soon after a fight started belongs to that fight
  const VOTE_KEEP_MS = 20000;     // the settled vote record stays this long, then the leader removes it
  const VOTE_OPTS = [["retry", "Retry"], ["retreat", "Retreat"]];

  // ------------------------------------------------------------------ the snapshot every fight takes
  let last = null;   // { s, f, pre, at }
  function mark(f) {
    if (!f || !f.s || typeof f.s !== "object") return;
    try { last = { s: f.s, f, pre: clone(f.s), at: Date.now() }; } catch (e) { last = null; }
  }
  function wrap() {
    if (typeof G === "undefined" || !G.Fight || G.Fight.prototype.run.dfWrapped) return;
    const inner = G.Fight.prototype.run;
    G.Fight.prototype.run = function (opts) { mark(this); return inner.call(this, opts); };
    G.Fight.prototype.run.dfWrapped = true;
  }
  wrap();
  const forget = () => { last = null; };
  const shared = (e) => (typeof DIFF !== "undefined" && DIFF.shared ? DIFF.shared(e) : !!(e && (e.player || e.pool || e.gev || e.wev)));
  const friendlyFight = (f) => !!(f && (f.friendly || f.nonlethal || f.arena || f.e?.friendly || f.e?.pvp));
  /* a personal fight that was lost (not won, not run away from, not a festival bout, not a public or PvP fight) */
  function lostFight(f) {
    if (!f || f.won || f.fled || f.ranAway || f.escaped || friendlyFight(f) || shared(f.e)) return false;
    return (f.hp ?? 1) <= 0 || f.won === false;
  }
  /* keep the same inner objects (code may already hold s.trip, s.dungeon...) while putting the values back */
  const plain = (o) => o && typeof o === "object" && !Array.isArray(o) && Object.prototype.toString.call(o) === "[object Object]";
  function syncInPlace(target, src) {
    for (const k of Object.keys(target)) if (!(k in src)) delete target[k];
    for (const k of Object.keys(src)) {
      const a = target[k], b = src[k];
      if (plain(a) && plain(b)) syncInPlace(a, b);
      else if (Array.isArray(a) && Array.isArray(b)) { a.length = 0; for (const x of b) a.push(clone(x)); }
      else target[k] = b && typeof b === "object" ? clone(b) : b;
    }
  }

  /* engine.js die(): knocked down. Never a corpse run, never a lost item, never gold. */
  function knockout(s, cause, t, byPlayer = false) {
    t = t ?? G.now();
    const L = last && last.s === s && Date.now() - last.at < FRESH_MS && !last.f.won ? last : null;
    last = null;
    const who = cap(`${byPlayer ? "" : /^(the|a|an)\s/i.test(String(cause)) ? "" : "the "}${cause}`);
    let msg, rolledBack = false;
    if (L && !shared(L.f.e)) {
      syncInPlace(s, L.pre); rolledBack = true;
      if (G.curHealth(s, t) < 1) G.setHealth(s, G.maxHealth(s) * 0.5, t);
      msg = `${who} knocked you down. You lose nothing: everything is as it was before the fight, so try again or go another way.`;
    } else {
      G.setHealth(s, Math.max(G.curHealth(s, t), G.maxHealth(s) * 0.5), t);
      msg = L ? `${who} knocked you down. You lose nothing: you get back up right here and the fight goes on.`
        : `${who} knocked you down. You lose nothing: get your breath back and carry on.`;
    }
    if (G.note) G.note(s, " " + msg);
    return { msg, bag: null, rolledBack };
  }

  // ------------------------------------------------------------------ why you lost (one honest line)
  function why(f, sess) {
    if (!f) return "";
    const foe = G.theFoe ? G.theFoe(f.e, true) : cap(f.e?.name || "The foe");
    const ev = (sess?.ev || []).filter((x) => x && x.who === "foe" && x.dmg > 0);
    if (ev.length) {
      const tot = ev.reduce((a, x) => a + x.dmg, 0), by = {};
      for (const x of ev) { const k = String(x.act?.name || "").trim(); if (k) by[k] = (by[k] || 0) + x.dmg; }
      const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] / tot >= 0.4 && ev.length > 1) return `${foe}'s ${top[0]} did most of the damage (${Math.round(100 * top[1] / tot)}%).`;
      const big = Math.max(...ev.map((x) => x.dmg)), rounds = Math.max(1, sess.round || ev.length);
      if (big >= 0.4 * tot && ev.length > 1) return `${foe} landed one huge blow: ${big} damage at once.`;
      return `${foe} wore you down over ${rounds} round${rounds > 1 ? "s" : ""}; its hardest blow took ${big} health.`;
    }
    const n = f.turn || (f.log || []).length;
    if (n) return `${foe} outlasted you over ${n} round${n > 1 ? "s" : ""}.`;
    return `${foe} was too strong this time.`;
  }
  /* one small tip, only when it's true */
  function tip(f, sess) {
    if (!f || !f.s) return "";
    const isHeal = (id) => /^potion_health/.test(String(id || ""));
    const have = (f.s.inv || []).some((r) => r && isHeal(r.item) && r.qty > 0), drank = Object.keys(f.used || {}).some((k) => {
      const r = (f.s.inv || []).find((x) => x && String(x.id) === k); return r ? isHeal(r.item) : isHeal(k); });
    if (have && !drank) return "You still had healing potions: drink one when your health runs low.";
    return "";
  }

  // ------------------------------------------------------------------ Retreat
  /* step back out of the current dungeon room (cleared rooms stay cleared; this room is fresh next time) */
  function stepBack(d) {
    if (!d || !d.room || d.room.type === "camp") return false;
    d.room = null;
    if (Array.isArray(d.path) && d.path.length && d.path[d.path.length - 1][0] === d.row && d.path[d.path.length - 1][1] === d.col) {
      d.path.pop(); if (d.cstep) d.cstep = Math.max(0, d.cstep - 1);
    }
    if (d.row <= 0) { d.row = -1; d.col = 0; return true; }
    const prev = d.rows?.[d.row - 1] || [], col = d.col;
    d.row -= 1; d.col = Math.max(0, prev.findIndex((n) => (n.links || []).includes(col)));
    return true;
  }
  /* what Retreat means here (before the save changes) */
  function retreatWhat(S) {
    if (S?.dungeon?.room && S.dungeon.room.type !== "camp") return "Step back out of this room. Rooms you cleared stay cleared.";
    if (S?.trip && (S.trip.status === "encounter" || S.trip.status === "event")) return "Back on the road, past the fight.";
    return "Walk away for now. It will still be there later.";
  }
  function retreatState(S, t) {
    t = t ?? G.now();
    if (S?.dungeon?.room && stepBack(S.dungeon)) return "You back out of the room and catch your breath. The rooms you cleared stay cleared.";
    const tr0 = S?.trip;
    if (tr0 && (tr0.status === "encounter" || tr0.status === "event")) {
      tr0.status = "travel"; tr0.encounter = null; tr0.event = null; tr0.lastTick = t;
      return "You fall back, find another way round and you're back on the road.";
    }
    return "You walk away for now. You can come back to it any time.";
  }

  // ------------------------------------------------------------------ party vote (pure)
  const partyOf = (sess) => (sess ? [...new Set([...(sess.everyone || []), ...(sess.f?.allies || []), ...(sess.f?._downed || [])])]
    .filter((a) => a && a.player && a.pid && !a.gone && !a.follower) : []);
  function voteDoc(leader, mates, info, t) {
    const members = [{ id: leader.id, name: leader.name || "Leader" }, ...mates.map((a) => ({ id: a.pid, name: a.name || "?" }))].slice(0, 8);
    const base = { dv: 1, leader: leader.id, leaderName: leader.name || "", members, foe: info.foe || "", why: info.why || "", place: info.place || "", t };
    const did = `defeat|${leader.id}|${t}`;
    return typeof PARTYVOTE !== "undefined" ? PARTYVOTE.open(base, leader.id, { did, kind: "defeat", title: "The party was beaten. What now?", opts: VOTE_OPTS }, t) : base;
  }

  // ------------------------------------------------------------------ the screen
  let hooks = {}, cur = null, voteT = null, myVote = null, seenVotes = {}, voteDocs = [];
  const S = () => (hooks.S ? hooks.S() : cur?.S);
  function mount(h) {
    hooks = h || {};
    wrap();
    const st = hooks.Store;
    if (st?.watch && DOM && !mount.watching) { mount.watching = true; st.watch("tbf", onDocs); }
  }
  function diffHTML(s) {
    if (typeof DIFF === "undefined" || !s) return "";
    const ld = DIFF.leaderOf ? DIFF.leaderOf(s) : null;
    if (ld) return `<p class="sub dft-diffnote">${esc(tr("Difficulty"))}: <b>${esc(DIFF.nameOf(ld))}</b> (${esc(tr("your party leader's"))})</p>`;
    const on = DIFF.own(s);
    return `<div class="dft-diff" role="radiogroup" aria-label="${esc(tr("Difficulty"))}"><span>${esc(tr("Difficulty for the next try"))}</span>${DIFF.IDS.map((id) =>
      `<button class="dft-chip ${id === on ? "on" : ""}" data-dfd="${id}" role="radio" aria-checked="${id === on}">${esc(DIFF.nameOf(id))}</button>`).join("")}</div>`;
  }
  function el() {
    let d = document.getElementById("dft");
    if (!d) { d = document.createElement("div"); d.id = "dft"; d.className = "dft ink"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Defeated"); document.body.appendChild(d); d.addEventListener("click", onClick); }
    return d;
  }
  function btn(k, label, sub, cls = "") {
    return `<button class="btn dft-b ${cls}" data-dft="${k}"><b>${esc(tr(label))}</b><small>${esc(tr(sub))}</small></button>`;
  }
  function render() {
    if (!DOM || !cur) return;
    const o = cur, s = o.S, v = o.vote, d = el();
    d.style.display = "";
    const foe = o.f ? (G.theFoe ? G.theFoe(o.f.e, true) : o.f.e?.name) : o.foe || "";
    const whyL = o.why || "", tipL = o.tip || "";
    let body;
    if (v) {   // a party vote (leader or member)
      const pv = v.pv, PV = typeof PARTYVOTE !== "undefined" ? PARTYVOTE : null;
      const tl = PV && pv ? PV.tally(pv) : {}, left = PV && pv ? PV.left(pv) : 0;
      const names = (ids) => (ids || []).map((id) => (v.members || []).find((m) => m.id === id)?.name || "?").join(", ");
      const mine = pv?.votes?.[s?.id];
      const vb = (k, label, sub) => `<button class="btn dft-b ${mine === k ? "pri on" : ""}" data-dfv="${k}"><b>${esc(tr(label))}</b><small>${esc(tr(sub))}</small><span class="dft-tl">${tl[k]?.length ? esc(names(tl[k])) : ""}</span></button>`;
      body = `<p class="dft-vote">${esc(tr("The party decides together: most votes wins, a tie goes the leader's way."))} <span class="num">${pv && !pv.res ? left + "s" : ""}</span></p>
        <div class="dft-btns">${vb("retry", "Retry", "The same fight again, everyone back on their feet")}${vb("retreat", "Retreat", o.retreatSub || "Fall back and go another way")}
        ${btn("gear", "Adjust gear", "Change weapons, armour or spells while the party votes")}</div>
        ${o.leader && pv && !pv.res ? `<button class="btn dft-now" data-dft="now">${esc(tr("Decide now"))}</button>` : ""}
        ${pv?.res ? `<p class="dft-res">${esc(tr(pv.res.key === "retry" ? "The party tries again." : "The party falls back."))}</p>` : ""}`;
    } else {
      body = `<div class="dft-btns">${btn("retry", "Retry", "The same foe, a fresh start", "pri")}${btn("gear", "Adjust gear", "Change weapons, armour or spells, then come back")}${btn("retreat", "Retreat", o.retreatSub)}</div>`;
    }
    d.innerHTML = `<div class="dft-card" role="document"><h2>${esc(tr("Defeated"))}</h2>
      ${foe ? `<p class="dft-foe">${esc(tr("Beaten by"))} <b>${esc(foe)}</b></p>` : ""}
      ${whyL ? `<p class="dft-why">${esc(tr(whyL))}</p>` : ""}${tipL ? `<p class="sub dft-tip">${esc(tr(tipL))}</p>` : ""}
      <p class="dft-safe">${esc(tr("You lose nothing: gold, items, XP and progress are just as they were before the fight."))}</p>
      ${!v || o.leader ? diffHTML(s) : ""}${body}</div>`;
  }
  function close() {
    clearInterval(voteT); voteT = null;
    if (!DOM) return;
    document.getElementById("dft")?.remove();
    document.getElementById("dfbar")?.remove();
  }
  /* Adjust gear: Hero -> Items, with a bar to come back */
  function gear() {
    if (!DOM) return;
    const d = document.getElementById("dft"); if (d) d.style.display = "none";
    if (hooks.openItems) hooks.openItems();
    let b = document.getElementById("dfbar");
    if (!b) { b = document.createElement("div"); b.id = "dfbar"; b.className = "dfbar ink"; document.body.appendChild(b); b.addEventListener("click", onClick); }
    const party = !!cur?.vote;
    b.innerHTML = `<span>${esc(tr("Change what you need, then:"))}</span>${party ? "" : `<button class="btn pri" data-dft="retry">${esc(tr("Retry"))}</button>`}<button class="btn" data-dft="back">${esc(tr(party ? "Back to the vote" : "Back"))}</button>`;
  }
  function back() {
    if (DOM) document.getElementById("dfbar")?.remove();
    if (hooks.closeItems) hooks.closeItems();
    render();
  }
  function save() { try { hooks.persist?.(true); } catch (e) { /* fine */ } }
  function doRetry() {
    const o = cur; if (!o) return;
    cur = null; myVote = null; close();
    if (hooks.closeItems) hooks.closeItems();
    save();
    o.retry && o.retry();
  }
  function doRetreat() {
    const o = cur; if (!o) return;
    cur = null; myVote = null; close();
    if (hooks.closeItems) hooks.closeItems();
    const text = retreatState(o.S);
    save();
    if (o.retreat) o.retreat(text); else hooks.toast?.(tr(text));
    hooks.refresh?.();
  }
  function onClick(ev) {
    const b = ev.target.closest("button"); if (!b || !cur) return;
    const k = b.dataset.dft, dfd = b.dataset.dfd, dfv = b.dataset.dfv;
    if (dfd && typeof DIFF !== "undefined") { DIFF.set(cur.S, dfd); save(); render(); return; }
    if (dfv) return castVote(dfv);
    if (k === "retry") return cur.vote ? null : doRetry();
    if (k === "retreat") return doRetreat();
    if (k === "gear") return gear();
    if (k === "back") return back();
    if (k === "now") return tickVote(true);
  }

  /* tbfight.js: a lost personal fight. o = { S, f, sess, retry(), retreat(text) } */
  function offer(o) {
    const s = o.S;
    cur = { ...o, why: why(o.f, o.sess), tip: tip(o.f, o.sess), retreatSub: retreatWhat(s) };
    if (typeof SOUND !== "undefined" && SOUND.fx) try { SOUND.fx("death"); } catch (e) { /* fine */ }
    save();
    const mates = partyOf(o.sess), st = hooks.Store;
    if (mates.length && st?.online && st.put && typeof PARTYVOTE !== "undefined") startVote(mates);
    render();
    return cur;
  }

  // ------------------------------------------------------------------ party vote (on screen)
  const nowS = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const onlineIds = (doc) => (doc.members || []).map((m) => m.id).filter((id) => id === doc.leader || (hooks.online ? hooks.online(id) : true));
  function startVote(mates) {
    const s = cur.S, t = nowS();
    const doc = voteDoc({ id: s.id, name: s.name }, mates, { foe: cur.f ? (G.theFoe ? G.theFoe(cur.f.e, true) : cur.f.e?.name) : "", why: cur.why, place: s.dungeon?.place || "" }, t);
    const id = `dv~${s.id}~${Math.floor(t * 1000)}`;
    cur.vote = doc; cur.voteId = id; cur.leader = true;
    hooks.Store.put("tbf", id, doc);
    clearInterval(voteT); voteT = setInterval(() => tickVote(false), 500);
  }
  async function castVote(key) {
    const o = cur; if (!o?.vote || !o.voteId || !hooks.Store?.change) return;
    const s = o.S, w = typeof PARTYVOTE !== "undefined" ? PARTYVOTE.weightOf(s) : 1;
    myVote = key;
    o.vote = PARTYVOTE.cast(o.vote, s.id, key, nowS(), w); render();
    try { await hooks.Store.change("tbf", o.voteId, (x) => (x ? PARTYVOTE.cast(x, s.id, key, nowS(), w) : x)); } catch (e) { /* the next tap tries again */ }
  }
  async function tickVote(force) {
    const o = cur; if (!o?.vote || !o.leader) return;
    const pv = o.vote.pv;
    if (pv?.res) return;
    render();
    if (!force && !PARTYVOTE.due(pv, onlineIds(o.vote), nowS())) return;
    let after = null;
    try { after = (await hooks.Store.change("tbf", o.voteId, (x) => (x ? PARTYVOTE.settle(x, o.S.id, onlineIds(x), nowS(), force) : x)))?.after; } catch (e) { return; }
    if (!after?.pv?.res || cur !== o) return;
    o.vote = after; clearInterval(voteT); voteT = null;
    const id = o.voteId, st = hooks.Store;
    setTimeout(() => { try { st.remove?.("tbf", id); } catch (e) { /* fine */ } }, VOTE_KEEP_MS);
    hooks.toast?.(tr(after.pv.res.key === "retry" ? "The party tries again." : "The party falls back."));
    if (after.pv.res.key === "retry") doRetry(); else doRetreat();
  }
  /* members: the leader's vote record */
  function onDocs(docs) {
    voteDocs = docs || [];
    const s = S(); if (!s) return;
    const me = s.id, t = nowS();
    if (cur?.vote && cur.leader) {   // my own vote: other phones' taps
      const d = voteDocs.find((x) => x.id === cur.voteId);
      if (d && d.pv) { cur.vote = d; render(); }
      return;
    }
    if (cur?.vote && !cur.leader) {   // a member's screen: follow the record
      const d = voteDocs.find((x) => x.id === cur.voteId);
      if (!d) { cur = null; close(); return; }
      cur.vote = d;
      if (d.pv?.res && !seenVotes[d.id]) { seenVotes[d.id] = 1; memberResult(d); return; }
      render(); return;
    }
    if (cur) return;
    const d = voteDocs.find((x) => x.dv && x.leader !== me && (x.members || []).some((m) => m.id === me) && !x.pv?.res && !seenVotes[x.id] && t - (x.t || 0) < 120);
    if (!d) return;
    if (typeof TB !== "undefined" && TB.open && typeof SHAREDFIGHT !== "undefined" && SHAREDFIGHT.active?.done) TB.close();   // the lost fight's last screen: the vote takes over
    cur = { S: s, vote: d, voteId: d.id, leader: false, foe: d.foe, why: d.why, retreatSub: retreatWhat(s) };
    render();
  }
  function memberResult(d) {
    const s = cur?.S || S();
    cur = null; myVote = null; close();
    if (hooks.closeItems) hooks.closeItems();
    const key = d.pv.res.key;
    if (key === "retreat" && s?.dungeon && (!d.place || s.dungeon.place === d.place)) { retreatState(s); save(); }
    hooks.toast?.(tr(key === "retry" ? "The party tries again." : "The party falls back."));
    hooks.refresh?.();
  }

  return { knockout, lostFight, forget, why, tip, offer, mount, retreatState, retreatWhat, stepBack, voteDoc, partyOf, syncInPlace,
    get current() { return cur; }, retry: doRetry, retreat: doRetreat, gear, back, castVote, _mark: mark, get _last() { return last; } };
})();
