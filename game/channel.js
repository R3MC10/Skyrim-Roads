/* channel.js: everyone sees a move being prepared. [OURS] (channel-bars)
   Owner: "When a player plays its turn and casts some magic, for other players it should look like channelling a spell,
   with a channelling bar filling while the player does their minigame. The same should apply to all attacks and skills
   granted by items."
   Every move with a minigame (minigame.js: blows, power attacks, bows, guards, shield bashes, spells, staffs, scrolls,
   the oil flask) is one "action preparation":
   - START {id, actor, name, ab (the move), tg (target), look, icon, t0, est (ms, 0 = unknown), cost}
   - PROGRESS (at most 4 a second, only when it changed; only games that can measure it: the rune's points, the bow's draw)
   - END {res: hit | crit | miss | fail | cancel}
   Never minigame inputs or frames. Each message carries a growing seq, so repeats and old ones are dropped.
   Who sends what (sharedfight.js / tbfight.js): the player's own phone writes its channel to tbf/<fight>~ch~<player>;
   the leader's phone (the host) takes it in, gives finished moves their order and puts every channel in its fight record
   (ch). Teammates fill bars from the start/progress they see, but a RESULT only counts when it comes from the host's
   record. A phone that comes back (reconnects, or opens the fight late) gets the live channels from that record.
   The bar: real progress when the game can measure it, else it fills over the estimated time and stops at 90 % until
   the result; unknown length pulses. Never 100 % before the result. Looks per type (same bar, different pose, icon,
   colour): fire embers orange, frost crystals ice blue, shock sparks violet-blue, healing motes gold, melee wind-up steel
   grey, bow draw muted green, item skills by effect. A small bar (56 px) above the hero with the move's icon, in place
   of the name over their head, fixed to where they stand (it doesn't bob with the animation).
   A move's cost is reserved when its channel starts (Session.canAfford sees it), so it can't be spent twice. A hard
   12 s deadline: a minigame can't stall the fight; on timeout the move is cancelled and the player guards.
   Solo fights: the same pose and bar, only on your own screen. Reduced motion: the bar, icon and a still pose.
   Pure parts (hub) are checked in tests/test_channel.js; tests/channel_ui.py checks two phones in a party fight. */
const CHANNEL = (() => {
  const DOM = typeof document !== "undefined";
  const DEADLINE = 12000, LINGER = 1400, GAP = 250, CAP_EST = 0.9, CAP_REAL = 0.95, TOMB = 60000;
  const RES = new Set(["hit", "crit", "miss", "fail", "cancel"]);
  /* the look of each kind of move: colour, pose (how the figure stands while it prepares), motes */
  const LOOK = {
    fire: { c: "#ff8a3d", pose: "cast", mu: 0.42, mote: ["#ffb347", "#ff7a2a", "#ffd27a"], rise: 1, fx: "fire" },
    frost: { c: "#9fdcff", pose: "cast", mu: 0.44, mote: ["#e8f8ff", "#9fdcff", "#cfefff"], rise: 0.25, fx: "frost" },
    shock: { c: "#8f8cff", pose: "cast", mu: 0.44, mote: ["#cfc4ff", "#ffffff", "#8f8cff"], rise: 0, fx: "shock" },
    heal: { c: "#ffd76a", pose: "cast", mu: 0.3, mote: ["#fff2b0", "#ffd76a"], rise: 1.3, fx: "shield" },
    ward: { c: "#8ad1ff", pose: "cast", mu: 0.3, mote: ["#d8f0ff", "#8ad1ff"], rise: 0.6, fx: "shield" },
    illusion: { c: "#c99bff", pose: "cast", mu: 0.38, mote: ["#e6d2ff", "#c99bff"], rise: 0.5, fx: "shock" },
    conjure: { c: "#7ee0a0", pose: "cast", mu: 0.38, mote: ["#d4ffe2", "#7ee0a0"], rise: 0.8, fx: "shield" },
    melee: { c: "#aab4be", pose: "melee", mote: null, fx: "shield" },
    bow: { c: "#8fae7a", pose: "bow", mote: null, fx: "shield" },
    guard: { c: "#c9ccd2", pose: "block", mote: null, fx: "shield" },
    bash: { c: "#c8a46a", pose: "bash", mote: null, fx: "shield" },
    oil: { c: "#d9a441", pose: "toss", mote: ["#e8c27a"], rise: 0.4, fx: "fire" },
  };
  const tr = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* which look a move has (from its minigame) */
  function lookOf(f, a) {
    const g = typeof MINIGAME !== "undefined" ? MINIGAME.kindFor(f, a) : null;
    if (!g) return null;
    if (g.kind === "rune") {
      const sp = g.spell || {};
      if (sp.school === "Restoration") return "heal";
      if (sp.school === "Alteration") return "ward";
      if (sp.school === "Illusion") return "illusion";
      if (sp.school === "Conjuration") return "conjure";
      return sp.element === "frost" || sp.element === "shock" ? sp.element : "fire";
    }
    if (g.kind === "aim") return "bow";
    if (g.kind === "parry") return g.shove ? "bash" : "guard";
    if (g.toss) return "oil";
    return "melee";
  }
  /* how long the game usually takes (ms); 0 = unknown (the bar pulses until progress comes) */
  function estOf(f, a) {
    const g = typeof MINIGAME !== "undefined" ? MINIGAME.kindFor(f, a) : null;
    if (!g) return 0;
    let w = 1; try { w = MINIGAME.width(f, a, g) || 1; } catch (e) { w = 1; }
    if (g.kind === "rune") return Math.round((MINIGAME.SCHOOLS[g.school]?.time || 3000) * Math.min(1.6, w) * 0.8);
    if (g.kind === "aim") return 0;   // the draw only starts when they press: real progress from then on
    if (g.kind === "parry") return Math.round(1400 / Math.min(1.4, 0.8 + w * 0.2) * 1.1);
    return g.kind === "power" ? 1300 : 1500;
  }

  // ------------------------------------------------------------------ the pure part: one hub of channels per phone
  /* o.clock(): ms (tests pass their own); role "host" gives finished moves their order */
  function hub(o = {}) {
    const clock = o.clock || (() => Date.now());
    const M = new Map(), tomb = new Map();
    let ord = 0, n = 0;
    const live = () => [...M.values()].filter((c) => c.st === "live");
    /* a wire message (with the sender's clock at sending, sent) into this phone's clock */
    function fromWire(w, sentS) {
      if (!w) return null;
      const t = clock(), sent = sentS ? sentS * 1000 : null;
      const off = sent != null && isFinite(sent) ? t - sent : 0;   // sender's clock → ours (network delay ignored)
      return { ...w, t0: (w.t0 ?? t) + off, te: w.te != null ? w.te + off : null };
    }
    function wire(c) {
      const o2 = { id: c.id, seq: c.seq, st: c.st, actor: c.actor, name: c.name, ab: c.ab, tg: c.tg ?? null, look: c.look, ic: c.ic || "", est: c.est || 0, t0: Math.round(c.t0), ta: c.ta };
      if (c.prog != null) o2.prog = c.prog;
      if (c.cost) o2.cost = c.cost;
      if (c.st === "end") { o2.res = c.res; o2.te = Math.round(c.te); if (c.ord) o2.ord = c.ord; if (c.why) o2.why = c.why; }
      return o2;
    }
    /* take in one message. src: "local" (this phone's own move), "host" (from the host, or this phone IS the host),
       "peer" (a teammate's own write: start and progress only, results wait for the host). Returns true if it changed. */
    function apply(m, src = "peer") {
      if (!m || !m.id || !m.actor) return false;
      const t = clock(), c = M.get(m.id), seq = m.seq | 0;
      if (c && seq <= c.seq && !(src === "host" && m.st === "end" && c.st === "live")) return false;   // a repeat, or older than what we have
      if (!c && tomb.has(m.id)) return false;   // long gone
      if (m.st === "end" && src === "peer") {   // a result from someone else's phone: only the host decides
        if (!c) return false;
        if (m.prog != null && c.st === "live") c.prog = Math.max(c.prog || 0, Math.min(1, +m.prog || 0));   // keep how far it got
        return false;
      }
      if (m.st === "end" && !RES.has(m.res)) return false;
      if (!c && m.st === "live") {   // a new channel: one at a time per player; an older one of theirs is dropped
        for (const x of live()) if (x.actor === m.actor) {
          if ((x.ta || 0) > (m.ta || 0)) return false;   // a stale start that lost to a newer one
          end0(x, "cancel", "superseded");
        }
      }
      const x = c || { id: m.id, seq: 0, mine: src === "local" };
      Object.assign(x, { seq, st: m.st, actor: m.actor, name: m.name || x.name || "", ab: m.ab, tg: m.tg ?? null, look: LOOK[m.look] ? m.look : x.look || "melee",
        ic: m.ic != null ? String(m.ic).slice(0, 4) : x.ic || "", est: Math.max(0, +m.est || 0), ta: m.ta ?? x.ta ?? 0, cost: m.cost || x.cost || null });
      if (x.t0 == null || !c) x.t0 = m.t0 != null ? m.t0 : t;
      if (m.prog != null) x.prog = Math.max(x.prog || 0, Math.min(1, +m.prog || 0));
      if (m.st === "end") {
        x.res = m.res; x.why = m.why || null; x.te = m.te != null ? m.te : t;
        if (src === "host" || src === "local") x.ord = m.ord || x.ord || (o.role === "host" ? ++ord : 0);
        if (m.ord) ord = Math.max(ord, m.ord);
        if (t - x.te > LINGER) { M.delete(x.id); tomb.set(x.id, t); return true; }   // a result from long ago (a reconnect): nothing to show
      }
      M.set(x.id, x);
      return true;
    }
    function end0(x, res, why) {
      x.seq++; x.st = "end"; x.res = res; x.why = why || null; x.te = clock();
      if (o.role === "host" || x.mine) x.ord = x.ord || (o.role === "host" ? ++ord : 0);
    }
    /* this phone starts a move: {actor, name, ab, tg, look, ic, est, cost} */
    function begin(p) {
      const t = clock();
      const m = { ...p, id: `${p.actor}.${t.toString(36)}.${++n}`, seq: 1, st: "live", t0: t, ta: t + n / 1000 };
      apply(m, "local");
      const c = M.get(m.id); c.mine = true; c.sentAt = t; c.sentP = -1;
      return c;
    }
    /* how far the game got (0..1). Returns true when it's worth sending (changed by 5 %+, at most 4 a second) */
    function progress(c, p) {
      if (!c || c.st !== "live") return false;
      const q = Math.round(Math.max(0, Math.min(1, p)) * 20) / 20;
      if (q <= (c.prog ?? -1)) return false;
      c.prog = q;
      const t = clock();
      if (t - (c.sentAt || 0) < GAP && q < 1) return false;
      c.seq++; c.sentAt = t; return true;
    }
    function end(c, res, why) { if (!c || c.st !== "live" || !RES.has(res)) return false; end0(c, res, why); return true; }
    /* the deadline, and tidying: returns the channels that just timed out */
    function sweep() {
      const t = clock(), out = [];
      for (const c of [...M.values()]) {
        if (c.st === "live" && t - c.t0 > DEADLINE) { end0(c, "cancel", "timeout"); out.push(c); }
        else if (c.st === "end" && t - c.te > LINGER) { M.delete(c.id); tomb.set(c.id, t); }
      }
      for (const [id, at] of tomb) if (t - at > TOMB) tomb.delete(id);
      return out;
    }
    /* what the bar shows now: {frac 0..1, pulse, st, res, fade 0..1} */
    function shown(c) {
      const t = clock();
      if (!c) return null;
      if (c.st === "end") {
        const k = Math.max(0, Math.min(1, (t - c.te) / LINGER));
        const frac = c.res === "hit" || c.res === "crit" ? 1 : c.last ?? 0;
        return { frac, pulse: false, st: "end", res: c.res, fade: c.res === "cancel" ? k : Math.max(0, (k - 0.6) / 0.4), k };
      }
      let frac, pulse = false;
      if (c.prog != null && c.prog > 0) frac = Math.min(CAP_REAL, c.prog);
      else if (c.est > 0) frac = Math.min(CAP_EST, Math.max(0, (t - c.t0) / c.est));
      else { frac = 0; pulse = true; }
      c.last = frac;
      return { frac, pulse, st: "live", res: null, fade: 0, k: 0 };
    }
    /* what one player has tied up in moves they're still preparing */
    function reserved(actor) {
      const r = { sp: 0, mp: 0, hp: 0, n: 0 };
      for (const c of live()) if (c.actor === actor && c.cost) { r.sp += c.cost.sp || 0; r.mp += c.cost.mp || 0; r.hp += c.cost.hp || 0; r.n++; }
      return r;
    }
    /* can they still pay cost with what they have, after what's reserved? */
    function canSpend(actor, have, cost) {
      const r = reserved(actor), c = cost || {};
      if ((c.mp || 0) > 0 && (c.mp || 0) + r.mp > (have.mp || 0) + 0.01) return false;
      if ((c.sp || 0) > 0 && (c.sp || 0) + r.sp > (have.sp || 0) + 0.01) return false;
      if ((c.hp || 0) > 0 && (c.hp || 0) + r.hp >= (have.hp || 0)) return false;
      return true;
    }
    /* every channel to show (live, and finished ones fading out), finished ones in the host's order */
    const list = () => [...M.values()].sort((a, b) => (a.ord || 1e9) - (b.ord || 1e9) || a.t0 - b.t0);
    const snapshot = () => list().map(wire);
    function restore(arr, sentS, src = "host") { let ch = false; for (const w of arr || []) ch = apply(fromWire(w, sentS), src) || ch; return ch; }
    const byActor = (actor) => list().filter((c) => c.actor === actor).pop() || null;
    const byName = (name) => list().filter((c) => c.name === name && !c.mine).pop() || null;
    function clear() { M.clear(); tomb.clear(); }
    return { apply, begin, progress, end, sweep, shown, reserved, canSpend, list, snapshot, restore, wire, fromWire, byActor, byName, live, clear, get size() { return M.size; }, role: (r) => { if (r) o.role = r; return o.role; } };
  }

  // ------------------------------------------------------------------ this phone
  const H = hub({ role: "solo" });
  let store = null, watching = false, raf = 0, wrote = null, lastFight = null;
  const myId = (sess) => (sess && sess.f && sess.f.s && sess.f.s.id) || "me";
  /* who this phone is in the fight it shows */
  function ctxOf(sess) {
    if (!sess) return { role: "solo" };
    if (sess.mirror) return { role: "mirror", fid: sess.fid, me: sess.me || myId(sess) };
    const fid = sess.remote && typeof sess.remote.fid === "function" ? sess.remote.fid() : null;
    return fid ? { role: "host", fid, me: myId(sess) } : { role: "solo", me: myId(sess) };
  }
  const session = () => (typeof TB !== "undefined" && TB.open ? TB.session : null);
  function fresh(sess) {   // a new fight: forget the last one's channels
    if (sess !== lastFight) { lastFight = sess; H.clear(); }
    H.role(ctxOf(sess).role === "host" ? "host" : "solo");
  }
  function send(sess, c) {
    const x = ctxOf(sess);
    try {
      if (x.role === "mirror" && store && x.fid) { wrote = { id: `${x.fid}~ch~${x.me}` }; store.put("tbf", wrote.id, { ch: H.wire(c), t: Date.now() / 1000 }); }
      else if (x.role === "host" && sess.remote && sess.remote.sync) sess.remote.sync(sess);   // in the fight record (forRecord)
    } catch (e) { /* the bar is a nicety: never break a move */ }
  }

  /* tbfight.js: you start a move's minigame. Returns the channel (or null: this move has none) */
  function begin(sess, a, tgt, icon) {
    if (!sess || !sess.f || typeof MINIGAME === "undefined") return null;
    const f = sess.f, look = lookOf(f, a); if (!look) return null;
    fresh(sess);
    let c0 = {}; try { c0 = typeof TB !== "undefined" && TB.cost ? TB.cost(f, a, sess) : {}; } catch (e) { c0 = {}; }
    const c = H.begin({ actor: myId(sess), name: f.s.name || "You", ab: a, tg: tgt ?? null, look, ic: icon || "", est: estOf(f, a), cost: { sp: c0.sp || 0, mp: c0.mp || 0, hp: c0.hp || 0 } });
    send(sess, c); kick();
    return c;
  }
  function progress(sess, c, p) { if (H.progress(c, p)) send(sess, c); }
  /* the minigame's grade → the result (null: it went in without a game) */
  function resOf(g, c) {
    if (!g) return "hit";
    if (g.cls === "perfect") return "crit";
    if (g.cls === "poor") return LOOK[c?.look]?.pose === "cast" ? "fail" : "miss";
    return "hit";
  }
  function done(sess, c, g) { if (H.end(c, resOf(g, c))) { send(sess, c); kick(); } }
  function cancel(sess, c, why) { if (H.end(c, "cancel", why)) { send(sess, c); kick(); } }
  /* any of your own still preparing (a stuck minigame was cleared) */
  function cancelMine(sess, why) { for (const c of H.live()) if (c.mine) cancel(sess, c, why || "dropped"); }
  /* the deadline: the minigame's promise, or TIMEOUT after 12 s */
  const TIMEOUT = { timeout: true };
  function race(c, game) {
    if (!c || !game || typeof game.then !== "function") return game;
    let tid = 0;
    const cut = new Promise((r) => { tid = setTimeout(() => r(TIMEOUT), Math.max(0, DEADLINE - (Date.now() - c.t0))); });
    return Promise.race([game.then((g) => { clearTimeout(tid); return g; }), cut]);
  }

  // ------------------------------------------------------------------ the network side
  /* the host's fight record carries every channel (tbfight.js shared) */
  function forRecord(sess) {
    if (!H.size || ctxOf(sess).role !== "host") return {};
    return { ch: H.snapshot() };
  }
  /* sharedfight.js Mirror.sync: the host's record came in (also restores channels after a reconnect) */
  function fromHost(sess, d) {
    if (!d) return;
    fresh(sess);
    const me = ctxOf(sess).me;
    const arr = (d.ch || []).filter((w) => w && w.actor !== me);   // your own moves: your phone is the source
    if (H.restore(arr, d.t, "host")) kick();
  }
  function onDocs(docs) {
    const sess = session(); if (!sess) { if (wrote && store) { try { store.remove && store.remove("tbf", wrote.id); } catch (e) { /* tidied by time */ } wrote = null; } return; }
    const x = ctxOf(sess); if (!x.fid) return;
    fresh(sess);
    const pre = x.fid + "~ch~"; let ch = false;
    for (const d of docs) {
      if (!d || typeof d.id !== "string" || !d.id.startsWith(pre) || !d.ch || d.ch.actor === x.me) continue;
      ch = H.apply(H.fromWire(d.ch, d.t), x.role === "host" ? "host" : "peer") || ch;
    }
    if (ch) { if (x.role === "host" && sess.remote && sess.remote.sync) { try { sess.remote.sync(sess); } catch (e) { /* next push */ } } kick(); }
  }
  function mount(h) {
    store = h && h.store;
    if (!store || !store.watch || watching) return;
    watching = true; store.watch("tbf", onDocs);
  }

  // ------------------------------------------------------------------ costs: a move being prepared is already spoken for
  if (typeof TB !== "undefined" && TB.Session && TB.Session.prototype.canAfford && !TB.Session.prototype.canAfford.__ch) {
    const orig = TB.Session.prototype.canAfford;
    TB.Session.prototype.canAfford = function (a) {
      if (!orig.call(this, a)) return false;
      if (a === "end" || a === "flee" || !this.f || !H.size) return true;
      const actor = myId(this); if (!H.reserved(actor).n) return true;
      let c = {}; try { c = TB.cost(this.f, a, this); } catch (e) { return true; }
      return H.canSpend(actor, { sp: this.f.sp, mp: this.f.mp, hp: this.f.hp }, c);
    };
    TB.Session.prototype.canAfford.__ch = true;
  }

  // ------------------------------------------------------------------ the fight scene (fightart.js asks every frame)
  const ease = (k) => k * k * (3 - 2 * k);
  /* how strongly the channel pose holds (1 while preparing; blends out after it ends) */
  function poseW(c) {
    const v = H.shown(c); if (!v) return 0;
    if (v.st === "live") return Math.min(1, 0.1 + Math.max(0, Date.now() - c.t0) / 220);   // eases in
    if (v.res === "cancel") return 1 - ease(Math.min(1, v.k * 2.5));   // blends back to idle
    if (v.res === "fail" || v.res === "miss") return 1 - ease(Math.min(1, v.k * 2));
    return 0;   // a hit: the normal move plays from the fight's events
  }
  const meC = () => { const s = session(); return s ? H.byActor(myId(s)) : null; };
  /* your own hero (heroP from fightart.js poses), when no move of yours is playing */
  function heroPose(P, wt) {
    const c = meC(); if (!c) return false;
    const w = poseW(c); if (!(w > 0.01)) return false;
    const L = LOOK[c.look] || LOOK.melee, v = H.shown(c);
    const fum = v.st === "end" && (v.res === "fail" || v.res === "miss");
    if (L.pose === "cast" || L.pose === "toss") { P.move = "cast"; P.mu = (L.mu || 0.4) * w; }
    else if (L.pose === "bow") { P.move = wt === "crossbow" ? "crossbow" : "bow"; P.mu = (0.12 + 0.3 * Math.min(1, v.frac / 0.9)) * w; }
    else if (L.pose === "block") { P.move = "block"; P.mu = 0.3 * w; }
    else if (L.pose === "bash") { P.move = "bash"; P.mu = 0.22 * w; }
    else { P.move = wt && !/bow|staff/.test(wt) ? wt : "sword"; P.mu = (wt === "dagger" || wt === "spear" || wt === "fist" ? 0.17 : 0.28) * w; }
    P.hitU = null; P.power = false;
    if (fum) { P.lean = (P.lean || 0) - 0.12 * w; P.dx = (P.dx || 0) - 3 * w; }   // a fumble: a step back
    return true;
  }
  /* an ally (another player) preparing: their clip in the shared rig (allyanim.js format) */
  function allyAnim(name) {
    if (!name) return null;
    const c = H.byName(name); if (!c) return null;
    const w = poseW(c); if (!(w > 0.01)) return null;
    const L = LOOK[c.look] || LOOK.melee, v = H.shown(c);
    if (v.st === "end" && (v.res === "fail" || v.res === "miss")) return { clip: "hit", u: Math.min(0.99, v.k * 2), from: "idle", fu: 0, w };   // a fumble
    if (L.pose === "cast" || L.pose === "toss") return { clip: "cast", u: L.mu || 0.4, from: "idle", fu: 0, w };
    if (L.pose === "bow") return { clip: "attack", u: 0.14 + 0.28 * Math.min(1, v.frac / 0.9), from: "idle", fu: 0, w, shoot: false, chan: true };
    if (L.pose === "block" || L.pose === "bash") return { clip: "block", u: 0.3, from: "idle", fu: 0, w };
    return { clip: "attack", u: 0.36, from: "idle", fu: 0, w, chan: true };
  }
  /* is this ally preparing a move (its name tag over its head gives way to the bar) */
  const busy = (name) => { const c = name ? H.byName(name) : null; return !!c && (c.st === "live" || H.shown(c).fade < 1); };
  /* weather and other ambient particles thin out when many are preparing at once */
  function ambient() { const n = H.live().length; return n >= 6 ? 0.2 : n >= 4 ? 0.5 : 1; }
  /* motes at the hands, and a crit's gold flash. o = {spawn, ffx, hero:[x,y], allyAt(name)→[x,y], foe:[x,y], s, pmul, rm, flash(a,c), shake(v)} */
  function scene(o) {
    if (!H.size) return;
    const many = H.live().length, rate = (many >= 6 ? 0.06 : many >= 4 ? 0.1 : 0.18) * (o.pmul || 1);
    const s = o.s || 1;
    for (const c of H.list()) {
      const at = c.mine || (session() && c.actor === myId(session())) ? o.hero : o.allyAt ? o.allyAt(c.name) : null;
      const L = LOOK[c.look] || LOOK.melee, v = H.shown(c);
      if (v.st === "end" && c.res === "crit" && !c.fxDone) {   // a crit: a stronger impact and a short gold flash
        c.fxDone = true;
        if (o.flash && !o.rm) o.flash(0.22, "#ffd76a");
        if (o.shake && !o.rm) o.shake(4);
        if (o.ffx && o.foe) o.ffx.add(L.fx || "shield", o.foe[0], o.foe[1], -1, true);
      }
      if (v.st === "end" && (c.res === "fail" || c.res === "miss") && !c.fxDone && at && o.spawn) {   // a fizzle: a grey puff at the hands
        c.fxDone = true;
        if (!o.rm) for (let i = 0; i < 6; i++) o.spawn(4, "#9a9690", at[0] + 8 * s, at[1] - 10 * s, (Math.random() - 0.5) * 30 * s, -20 * s * Math.random(), 0.5, 1.4, -10);
      }
      if (o.rm || !at || !o.spawn || v.st !== "live" || !L.mote || Math.random() > rate) continue;
      const hx = at[0] + 9 * s, hy = at[1] - 14 * s;   // about where the hands are
      const col = L.mote[(Math.random() * L.mote.length) | 0];
      if (c.look === "shock") o.spawn(1, col, hx + (Math.random() - 0.5) * 10 * s, hy + (Math.random() - 0.5) * 8 * s, (Math.random() - 0.5) * 60 * s, (Math.random() - 0.5) * 40 * s, 0.18, 1, 0);   // sparks between the hands
      else if (c.look === "frost") o.spawn(3, col, hx + (Math.random() - 0.5) * 22 * s, hy + (Math.random() - 0.5) * 18 * s, (hx - at[0]) * 0, 4 * s, 0.6, 1.2, 0);   // crystals gathering
      else o.spawn(4, col, hx + (Math.random() - 0.5) * 8 * s, hy, (Math.random() - 0.5) * 10 * s, -(14 + 10 * (L.rise || 0.5)) * s, 0.7, 1.1, 0);   // embers / motes rising
    }
  }

  // ------------------------------------------------------------------ the bars (plain HTML over the fight picture, reused)
  const reduce = () => DOM && ((typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) || document.documentElement.classList.contains("a11y-still"));
  const els = new Map();
  function host() {
    const tbf = DOM ? document.getElementById("tbf") : null; if (!tbf) return null;
    let box = tbf.querySelector(":scope > .chbars");
    if (!box) { box = document.createElement("div"); box.className = "chbars"; box.setAttribute("aria-live", "polite"); tbf.appendChild(box); els.clear(); }
    return box;
  }
  /* where a fighter's bar goes (page px), or null: over their head, kept inside the battlefield */
  function spot(cv, c) {
    if (typeof FIGHTPOS === "undefined" || !cv) return null;
    const s = session(), mine = s && c.actor === myId(s);
    const p = FIGHTPOS.screenOf(cv, mine ? "me" : c.name); if (!p) return null;
    let x = p.x, y = p.top - 6;
    const rc = cv.getBoundingClientRect();
    const b = typeof FIGHTZONES !== "undefined" ? FIGHTZONES.bands() : null, by = typeof FIGHTZONES !== "undefined" ? FIGHTZONES.bannerY() : null;
    const l = Math.max(rc.left, b ? b.x[0] : rc.left) + 32, r = Math.min(rc.right, b ? b.x[1] : rc.right) - 32;
    const top = Math.max(rc.top, by ? by.y - 30 : rc.top) + 22;
    x = Math.max(l, Math.min(r, x)); y = Math.max(top, Math.min(rc.bottom - 8, y));
    return { x, y };
  }
  function draw() {
    raf = 0;
    if (!DOM) return;
    const sess = session();
    if (!sess) { H.clear(); els.clear(); return; }
    for (const c of H.sweep()) if (c.mine) send(sess, c);   // the deadline (tbfight.js also guards)
    const box = host(); if (!box) return;
    const cv = document.querySelector("#tbf .fscene canvas"), rm = reduce();
    const seen = new Set();
    for (const c of H.list()) {
      const v = H.shown(c), p = spot(cv, c);
      let el = els.get(c.id);
      if (!el) {
        el = document.createElement("div");
        el.innerHTML = `<i class="chb-ic">${esc(c.ic || "✦")}</i><b class="chb-tr"><i class="chb-fl"></i></b>`;
        el.setAttribute("role", "status"); el.setAttribute("aria-label", `${c.name}: ${tr("preparing a move")}`);
        el.style.setProperty("--chc", (LOOK[c.look] || LOOK.melee).c);
        box.appendChild(el); els.set(c.id, el); el._fl = el.querySelector(".chb-fl");
      }
      seen.add(c.id);
      el.className = `chb lk-${c.look}${v.pulse ? " pulse" : ""}${v.st === "end" ? " end r-" + v.res : ""}${c.mine ? " mine" : ""}${rm ? " still" : ""}`;
      el.dataset.actor = c.actor; el.dataset.name = c.name; el.dataset.st = v.st; el.dataset.frac = v.frac.toFixed(2); if (v.res) el.dataset.res = v.res; else delete el.dataset.res; if (c.why) el.dataset.why = c.why; else delete el.dataset.why;
      if (!p) { el.hidden = true; continue; }
      el.hidden = false;
      el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-100%)`;
      el.style.opacity = String(1 - v.fade);
      el._fl.style.transform = `scaleX(${v.pulse ? 1 : v.frac.toFixed(3)})`;
    }
    for (const [id, el] of els) if (!seen.has(id)) { el.remove(); els.delete(id); }
    if (H.size) raf = requestAnimationFrame(draw);
  }
  function kick() { if (DOM && !raf && typeof requestAnimationFrame === "function") raf = requestAnimationFrame(draw); }

  return { hub, LOOK, lookOf, estOf, begin, progress, done, cancel, cancelMine, race, TIMEOUT, resOf, forRecord, fromHost, mount, onDocs,
    heroPose, allyAnim, busy, ambient, scene, DEADLINE, LINGER, CAP_EST, CAP_REAL, get hub0() { return H; } };
})();
if (typeof module !== "undefined") module.exports = CHANNEL;
