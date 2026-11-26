/* Initiative and the turn roster. [OURS module] (initiative)
   Owner: "Make turns like in Baldur's Gate 3. The turn roster should change depending on speed or if crowd controlled.
   Do it smart." The rules were worked out with ChatGPT; every number lives in CFG below.
   (Baldur's Gate 3 is named here only: players never see the name.)

   1. Initiative is rolled ONCE when a fight starts: 1d4 + speed. Speed is 5, +1 in light armour (or none), -1 in
      heavy, +0..+2 from perks and gear (Quick Start, First Move, Swiftness), +2 hasted, -2 slowed, kept within 1-10.
      Highest goes first; ties are broken the same way on every phone (speed, then heroes, then a fixed key).
   2. Live changes: the roll is kept all fight. When a speed changes (haste, slow, chill), the turns still to come are
      re-sorted. Nobody who already acted acts again, and nothing jumps ahead of the group acting now.
   3. Crowd control, on the statuses that already exist:
        stunned (shield bash, f.tbStunLeft)  skips its next slot
        frozen  (paralysis, f.eParalyzed)    skips its next slot, then thaws
        staggered (f.stagger)                its next slot moves back 2 places (it still acts)
        slowed (f.slowed, Chill, Numbing Cold) -2 speed;   hasted (Haste stacks) +2 speed
        knocked down (thrown from the saddle, f.kitApLoss)  1 of the turn's 3 AP goes into standing up
        knocked out / dead                   its slots are taken out
   4. No stun-lock: after losing a slot to a stun or a freeze, the fighter shrugs off stuns and freezes through the next
      round. Bosses always have two slots, so they lose one, never the whole round. A slot moves back at most 2 places
      a round. Speed decides WHEN you act, never how many AP you get (3 a turn, followers 2).
   5. Shared turns: heroes next to each other in the order (players, followers, pets, summons) form one group and act at
      the same time. Followers act on their orders automatically; every player picks their own moves, each move
      resolving when it's made, the leader's phone keeping the order. A skipped foe slot between two groups joins them.
   6. No timer (owner's call): a shared turn waits until everyone in it has spent their AP or ended their turn.
      A player whose phone dropped out guards by themselves; after 30 s with no move from a player the leader gets a
      "Skip <name>" button, and that player's unused AP turn into guard.
   7. Fast foes (a trait: bosses, tough foes, beasts, dragons) have two slots, the 2nd at initiative -4; the foe's moves
      for the round are shared out over its slots: each slot gets its own set number of moves (foeSlots), never a
      hero's 3 AP twice.
   The leader's phone owns all of this (tbfight.js Session); teammates' phones only show it (sharedfight.js). Every slot
   has its own id (uid) so nothing runs twice. Pure maths here; the strip on screen is initroster.js.
   Checked by tests/test_initiative.js (rules + the seeded party round-time sims). */
const INIT = (() => {
  const CFG = {
    die: 4,                        // 1d4 once, at the start of the fight
    base: 5, min: 1, max: 10,      // speed
    armour: { none: 1, light: 1, medium: 0, heavy: -1 },
    perkPer: 3, perkMax: 2,        // perk/gear initiative points (tbinit) per +1 speed: Quick Start 3/6, First Move 4, Swiftness 4..6
    haste: 2, slow: -2,
    foe: { beast: 1, big: -1, construct: -1 },   // foes: base speed + these tags
    ally: { player: 5, follower: 5, pet: 6, summon: 5 },
    fastSlots: 2, slotGap: 4,      // a fast foe's 2nd slot sits 4 initiative lower
    stagger: 2, pushMax: 2,        // staggered: back 2 places; at most 2 places a round per slot
    immune: 1,                     // rounds of shrugging off stuns and freezes after losing a slot to one
    standUp: 1,                    // AP it takes to get back on your feet
    skipAfter: 30,                 // party fights: no timer; after 30 s with no move from a player the leader may skip them (guard)
    lostAfter: 20,                 // a player's phone that never picked up its turn in 20 s (and shows offline) has dropped out: guard
    slideMs: 220, skipMs: 700,     // roster animation (initroster.js)
    strip: { phone: 6, pc: 12, px: 44 }, maxFighters: 16,
    /* the round-time sim (tests/test_initiative.js): seconds a player takes to choose (log-normal: median, spread),
       a foe move or an automatic ally move on screen */
    sim: { think: 9, spread: 0.5, foeMove: 2.2, autoMove: 1.2, skip: 0.6, afk: 0.03, react: 5 },
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pfx = (s, k) => (typeof PFX !== "undefined" && s ? PFX.num(s, k) || 0 : 0);
  const tags = (f) => f?.tags || new Set(f?.e?.tags || []);
  const hasTag = (f, t) => { const g = tags(f); return g.has ? g.has(t) : false; };

  // ------------------------------------------------------------------ speed
  /* what you mostly wear: none, light, medium or heavy (more pieces wins, a tie goes to the heavier) */
  function armourOf(s, f) {
    let list = f && f.armor ? Object.values(f.armor) : null;
    if (!list && s && typeof G !== "undefined" && G.equipment && typeof D !== "undefined") {
      try { const eq = G.equipment(s); list = (G.ARMOR_SLOTS || ["head", "chest", "hands", "feet", "shield"]).map((sl) => eq[sl] && D.ITEMS[eq[sl].item]).filter(Boolean); } catch (e) { list = []; }
    }
    const n = { light: 0, medium: 0, heavy: 0 };
    for (const a of list || []) if (a && n[a.type] != null) n[a.type]++;
    const best = ["heavy", "medium", "light"].reduce((b, k) => (n[k] > n[b] ? k : b), "heavy");
    return n[best] > 0 ? best : "none";
  }
  /* your speed and what makes it: { speed, parts: [[label, value]] } (haste and slow come on top, live) */
  function heroSpeed(s, f) {
    const kind = armourOf(s, f);
    let arm = CFG.armour[kind] || 0;
    if (arm < 0) arm = Math.round(arm * (1 - Math.min(1, pfx(s, "tbheavy"))));   // Drilled in Steel: heavy armour doesn't slow you
    const perks = clamp(Math.floor(pfx(s, "tbinit") / CFG.perkPer), 0, CFG.perkMax);
    const parts = [["Base", CFG.base], [kind === "none" ? "No armour" : kind[0].toUpperCase() + kind.slice(1) + " armour", arm], ["Perks and gear", perks]];
    return { speed: clamp(CFG.base + arm + perks, CFG.min, CFG.max), parts, armour: kind };
  }
  function foeSpeed(f) {
    let v = CFG.base;
    for (const [t, d] of Object.entries(CFG.foe)) if (hasTag(f, t)) v += d;
    if (f?.e?.speed) v += f.e.speed;
    return clamp(v, CFG.min, CFG.max);
  }
  function allySpeed(al) {
    if (al.speed != null) return clamp(al.speed, CFG.min, CFG.max);
    const k = al.summon || al.fsum ? "summon" : al.pet || al.partyPet ? "pet" : al.player ? "player" : "follower";
    return CFG.ally[k];
  }
  /* live speed changes: [label, value] lists */
  const foeSlowed = (f) => !!f && (f.slowed > 0 || !!f.foeSt?.chill || (f._numb != null && f._numb >= (f.turn || 0)));
  const meHasted = (f) => !!f && ((f.stk && f.stk.me && f.stk.me.haste) || 0) > 0;
  function liveMods(sess, o) {
    const f = sess.f, out = [];
    if (o.side === "foe") { if (foeSlowed(f)) out.push(["Slowed", CFG.slow]); }
    else if (o.id === "me") { if (meHasted(f)) out.push(["Hasted", CFG.haste]); if (f.slowed2 > 0) out.push(["Slowed", CFG.slow]); }
    else if (o.al) { if ((o.al.stk && o.al.stk.haste) > 0) out.push(["Hasted", CFG.haste]); if (o.al.slowed > 0) out.push(["Slowed", CFG.slow]); }
    return out;
  }
  /* the speed this fighter has right now */
  function speedOf(sess, o) {
    const st = state(sess);
    const base = o.side === "foe" ? foeSpeed(sess.f) : o.id === "me" ? st.me : o.al ? allySpeed(o.al) : CFG.ally.summon;
    return clamp(base + liveMods(sess, o).reduce((a, [, v]) => a + v, 0), CFG.min, CFG.max);
  }

  // ------------------------------------------------------------------ rolls (once a fight)
  const rnd = () => Math.random();
  function state(sess) {
    if (!sess.ini) sess.ini = { roll: {}, me: heroSpeed(sess.s || sess.f.s, sess.f).speed, imm: 0, pushed: {}, flash: {}, said: {}, seq: 0 };
    return sess.ini;
  }
  const keyOf = (o, f) => o.id === "me" ? "me" : o.side === "foe" ? "foe" : o.id === "sum" ? "sum" : o.al ? (o.al.pid ? "p:" + o.al.pid : o.al.fid ? "f:" + o.al.fid : "n:" + o.al.name) : String(o.id);
  function rollOf(sess, key, rng = rnd) {
    const st = state(sess);
    if (st.roll[key] == null) st.roll[key] = 1 + Math.floor(rng() * CFG.die);
    return st.roll[key];
  }

  // ------------------------------------------------------------------ the order
  /* fast foes: two slots (a trait, never from speed) */
  const fast = (sess) => { const f = sess.f, e = f.e || {}; return !!(e.boss || e.fast || sess.kind === "boss" || sess.kind === "tough" || hasTag(f, "beast") || hasTag(f, "dragon")); };
  function foeSlots(sess, n) {
    if (n <= 0) return [];
    const k = Math.min(n, fast(sess) ? CFG.fastSlots : 1), out = [];
    for (let i = 0; i < k; i++) out.push(Math.floor(n / k) + (i < n % k ? 1 : 0));
    return out;
  }
  /* which comes first: higher initiative, then higher speed, then heroes, then you, then a fixed key; a foe's 1st slot before its 2nd */
  function cmp(a, b) {
    return b.init - a.init || b.spd - a.spd || (a.side === b.side ? 0 : a.side === "hero" ? -1 : 1)
      || (a.key === "me" ? -1 : b.key === "me" ? 1 : 0) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) || (a.slot || 0) - (b.slot || 0);
  }
  /* units (one fighter's slot) for a round. n = the foe's moves this round. */
  function units(sess, n, rng) {
    const f = sess.f, out = [];
    const add = (o) => { o.key = o.key || keyOf(o, f); o.d = rollOf(sess, o.key, rng); o.spd = speedOf(sess, o); o.init = o.d + o.spd - (o.gap || 0); out.push(o); };
    add({ id: "me", name: (sess.s || f.s).name || "You", side: "hero" });
    f.allies.forEach((al, i) => { if (!al.down && !al.gone && al.hp !== 0) add({ id: "al" + i, al, name: al.name, side: "hero" }); });
    if (f.summonTurns > 0) add({ id: "sum", name: f.summonName || "Summon", side: "hero" });
    const foeKey = "foe:" + (sess.wave || 1);
    foeSlots(sess, n).forEach((k, i) => add({ id: "foe", name: f.e.name, side: "foe", key: foeKey, slot: i + 1, moves: k, gap: CFG.slotGap * i }));
    return out.sort(cmp);
  }
  /* flatten units into the order list the session plays: a foe slot with k moves is k entries side by side */
  function flatten(sess, us) {
    const st = state(sess), out = [];
    for (const u of us) {
      if (!u.uid) u.uid = `${sess.round}.${++st.seq}`;
      const k = u.side === "foe" ? Math.max(1, u.moves || 1) : 1;
      for (let m = 0; m < k; m++) out.push({ id: u.id, name: u.name, al: u.al, side: u.side, key: u.key, d: u.d, spd: u.spd, init: u.init, gap: u.gap || 0, slot: u.slot || 0, moves: k, mv: m + 1, u: u.uid, uid: `${u.uid}.${m + 1}`, push: u.push || 0, why: u.why || null, skip: u.skip || null });
    }
    return number(out);
  }
  /* foe entries named in the order they come: foe, foe2, foe3...; slots ①② in the order they come */
  function number(ord) {
    let k = 0, s = 0, lastU = null;
    for (const o of ord) if (o.side === "foe") { o.id = k ? "foe" + (k + 1) : "foe"; o.extra = k > 0; k++; if (o.u !== lastU) { s++; lastU = o.u; } o.slot = s; }
    return ord;
  }
  /* the order for a new round (n: the foe's moves this round) */
  function build(sess, n, rng) {
    const st = state(sess);
    st.pushed = {}; st.flash = {};
    const us = units(sess, n, rng);
    let ord = flatten(sess, us);
    const f = sess.f;
    if (f._stagCarry) { f._stagCarry = false; ord = pushFoe(sess, ord, 0, "stagger") || ord; }   // staggered after its last slot: the first one this round moves back
    groups(ord);
    return ord;
  }
  /* what the next round will look like if nothing changes (dimmed after the round marker) */
  function predict(sess) {
    if (!sess.ini) return [];
    const n = (sess.order || []).filter((o) => o.side === "foe" || String(o.id).startsWith("foe")).length || 1;
    const f = sess.f, us = [];
    const add = (o) => { o.key = keyOf(o, f); o.d = state(sess).roll[o.key] ?? 0; o.spd = speedOf(sess, o); o.init = o.d + o.spd - (o.gap || 0); us.push(o); };
    add({ id: "me", name: (sess.s || f.s).name || "You", side: "hero" });
    f.allies.forEach((al, i) => { if (!al.down && !al.gone) add({ id: "al" + i, al, name: al.name, side: "hero" }); });
    if (f.summonTurns > 1) add({ id: "sum", name: f.summonName || "Summon", side: "hero" });
    foeSlots(sess, n).forEach((k, i) => add({ id: "foe", name: f.e.name, side: "foe", key: "foe:" + (sess.wave || 1), slot: i + 1, moves: k, gap: CFG.slotGap * i }));
    return us.sort(cmp).map((u) => ({ ...u, uid: "nx." + u.key + "." + (u.slot || 0) }));
  }

  // ------------------------------------------------------------------ groups (shared turns)
  const hero = (o) => !!o && (o.side ? o.side === "hero" : !String(o.id).startsWith("foe"));
  /* number the runs of heroes side by side (knocked-out entries and skipped foe slots don't split a run) */
  function groups(ord) {
    let g = 0, open = false;
    for (const o of ord) {
      if (o.out || (o.skip && !hero(o))) { o.grp = open ? g : 0; continue; }
      if (hero(o)) { if (!open) { g++; open = true; } o.grp = g; } else { open = false; o.grp = 0; }
    }
    return ord;
  }
  /* the group that starts at index i: { start, end, members, skips } (end: the index after it) */
  function groupAt(sess, i) {
    const ord = sess.order, members = [], skips = [];
    let j = i;
    for (; j < ord.length; j++) {
      const o = ord[j];
      if (o.out || o.done) continue;
      if (o.skip && !hero(o)) { skips.push(o); continue; }
      if (!hero(o)) break;
      members.push(o);
    }
    while (j > i && skips.length && ord[j - 1] === skips[skips.length - 1]) { skips.pop(); j--; }   // a skipped slot at the end belongs to what comes after
    return { start: i, end: j, members, skips, uid: members[0]?.u || `${sess.round}.${i}` };
  }

  // ------------------------------------------------------------------ live changes
  /* where the order may still change: after the group (or the fighter) acting now */
  function lockFrom(sess) {
    if (sess.gr) return sess.gr.end;
    const ord = sess.order || [];
    let i = sess.idx || 0;
    while (i > 0 && i < ord.length && ord[i].u && ord[i].u === ord[i - 1].u && ord[i - 1].done) i++;   // a foe slot half played stays in one piece
    return i;
  }
  /* units in ord from index i on: [[entries]] */
  function unitsFrom(ord, i) {
    const out = [];
    for (let j = i; j < ord.length; j++) { const o = ord[j]; const last = out[out.length - 1]; if (last && last[0].u === o.u) last.push(o); else out.push([o]); }
    return out;
  }
  /* move the first pending foe slot from index i back by up to CFG.stagger places; null if there is none */
  function pushFoe(sess, ord, i, why) {
    const us = unitsFrom(ord, i), st = state(sess);
    const k = us.findIndex((u) => u[0].side === "foe" && !u[0].skip && !u[0].out && !u[0].done);
    if (k < 0) return null;
    const uid = us[k][0].u, room = CFG.pushMax - (st.pushed[uid] || 0), by = Math.min(CFG.stagger, room, us.length - 1 - k);
    if (by <= 0) return ord;
    const [u] = us.splice(k, 1); us.splice(k + by, 0, u);
    st.pushed[uid] = (st.pushed[uid] || 0) + by;
    for (const o of u) { o.push = (o.push || 0) + by; o.why = why; }
    st.flash[uid] = why;
    return number([...ord.slice(0, i), ...us.flat()]);
  }
  /* re-sort what's still to come when a speed changed (the pushes a slot already took stay) */
  function resort(sess, from) {
    const ord = sess.order, us = unitsFrom(ord, from).filter((u) => !u[0].done);
    if (us.length < 2) return false;
    let moved = false;
    for (const u of us) {
      const o = u[0];
      if (o.out || o.skip) continue;
      const spd = speedOf(sess, o);
      if (spd !== o.spd) { const why = spd > o.spd ? (o.side === "foe" ? "fast" : "haste") : "slow"; for (const x of u) { x.spd = spd; x.init = x.d + spd - (x.gap || 0); x.why = why; } state(sess).flash[o.u] = why; moved = true; }
    }
    if (!moved) return false;
    const was = us.map((u) => u[0].u);
    const sorted = us.slice().sort((a, b) => cmp(a[0], b[0]));
    // a slot that was pushed back keeps that many places behind where it would sort
    for (const u of sorted.filter((x) => x[0].push > 0)) { const k = sorted.indexOf(u); sorted.splice(k, 1); sorted.splice(Math.min(sorted.length, k + u[0].push), 0, u); }
    sess.order = number([...ord.slice(0, from), ...ord.slice(from).filter((o) => o.done), ...sorted.flat()]);
    return sorted.some((u, k) => u[0].u !== was[k]);
  }
  /* look at everyone's statuses and fix the order up. Called by the session after every move and before every turn.
     Returns lines for the fight log. */
  function refresh(sess) {
    if (!sess.ini || sess.mirror || !sess.order) return [];
    const f = sess.f, st = state(sess), lines = [], from = lockFrom(sess);
    let ord = sess.order, changed = false;
    // knocked out or gone: their slots are taken out
    for (let j = sess.idx || 0; j < ord.length; j++) {
      const o = ord[j]; if (o.done || o.out) continue;
      if (o.al && (o.al.down || o.al.gone || !f.allies.includes(o.al))) { o.out = "down"; o.outAt = Date.now(); changed = true; }
      else if (o.id === "sum" && !(f.summonTurns > 0)) { o.out = "gone"; o.outAt = Date.now(); changed = true; }
    }
    // stunned or frozen: the next slot is skipped (or shrugged off while still recovering from the last one)
    const hard = f.ehp > 0 && !f.endWon ? (f.tbStunLeft > 0 ? "stun" : f.eParalyzed > 0 ? "freeze" : null) : null;
    if (hard) {
      const next = unitsFrom(ord, from).find((u) => u[0].side === "foe" && !u[0].out && !u[0].done);
      if (next && next[0].skip) { /* already losing that one */ }
      else if (st.imm >= (sess.round || 0)) {
        f.tbStunLeft = 0; f.tbStunRound = null; f.eParalyzed = 0;
        lines.push(`The ${String(f.e.name).toLowerCase()} is still bracing from the last one and shrugs it off`);
      } else if (next) {
        for (const o of next) { o.skip = hard; o.why = hard; }
        st.flash[next[0].u] = hard; st.imm = (sess.round || 0) + CFG.immune; changed = true;
      }
    }
    // staggered: its next slot moves back (it still acts; the stagger is spent when it does)
    if (f.stagger && !f._stagUsed && f.ehp > 0) {
      const o2 = pushFoe(sess, ord, from, "stagger");
      f._stagUsed = true;
      if (o2) { sess.order = ord = o2; changed = true; } else f._stagCarry = true;
    }
    if (!f.stagger) f._stagUsed = false;
    // speed changes (haste, slow, chill): only what's still to come is re-sorted
    if (resort(sess, from)) changed = true;
    if (changed) groups(sess.order);
    return lines;
  }
  /* a skipped slot comes up: the status is spent ("then thaws") */
  function spend(sess, o) {
    const f = sess.f, nm = String(f.e?.name || "foe");
    const first = !o.mv || o.mv === 1;
    o.done = true; o.skipAt = Date.now();
    if (o.mv >= (o.moves || 1)) {
      if (o.skip === "stun") { f.tbStunLeft = 0; f.tbStunRound = null; }
      if (o.skip === "freeze") f.eParalyzed = 0;
    }
    if (!first) return "";
    return o.skip === "freeze" ? `${nm} is frozen solid and loses this turn, then thaws` : `${nm} is stunned and loses this turn`;
  }
  /* knocked down: AP that go into getting up this turn */
  const standUp = (f) => (f && f.kitApLoss > 0 ? CFG.standUp : 0);

  // ------------------------------------------------------------------ what the roster shows
  /* statuses that move someone in the order: [{k, ic, nm}] (icons from fxicons.js) */
  function marks(sess, o) {
    const f = sess.f, out = [], st = sess.ini || {};
    const ic = (k) => (typeof FXICONS !== "undefined" && FXICONS.TYPES[k] ? FXICONS.TYPES[k][0] : "•");
    if (o.side === "foe" || String(o.id).startsWith("foe")) {
      if (o.skip === "stun") out.push({ k: "stunned", ic: ic("stunned"), nm: "Stunned: skips this turn" });
      if (o.skip === "freeze") out.push({ k: "paralyzed", ic: ic("paralyzed"), nm: "Frozen: skips this turn, then thaws" });
      if (o.push > 0) out.push({ k: "staggered", ic: ic("staggered"), nm: `Staggered: moved back ${o.push} place${o.push === 1 ? "" : "s"}` });
      if (foeSlowed(f)) out.push({ k: "slowed", ic: ic("slowed"), nm: `Slowed: speed ${CFG.slow}` });
      if (st.imm >= (sess.round || 0) && !o.skip) out.push({ k: "resolve", ic: ic("resolve"), nm: "Bracing: shrugs off stuns and freezes until the next round ends" });
    } else if (o.id === "me") {
      if (meHasted(f)) out.push({ k: "haste", ic: ic("haste"), nm: `Hasted: speed +${CFG.haste}` });
      if (standUp(f)) out.push({ k: "down", ic: ic("down"), nm: "Knocked down: 1 AP goes into getting up" });
    } else if (o.al) {
      if ((o.al.stk && o.al.stk.haste) > 0) out.push({ k: "haste", ic: ic("haste"), nm: `Hasted: speed +${CFG.haste}` });
      if (o.out) out.push({ k: "down", ic: ic("down"), nm: "Knocked down" });
    }
    return out;
  }
  /* the plain words for "why did this move": the icon that flashes on a portrait */
  const WHY = { stagger: "staggered", stun: "stunned", freeze: "paralyzed", slow: "slowed", haste: "haste", fast: "haste" };

  // ------------------------------------------------------------------ the round-time sim (tests, tuning)
  /* one seeded party round: np players (gear tiers set their armour and perks), fol followers, a foe with n moves.
     Returns { groups: [sizes], secs, foeSlots } */
  function simRound(o) {
    const rng = o.rng, sim = { ...CFG.sim, ...(o.sim || {}) };
    const pl = [];
    for (let i = 0; i < o.np; i++) {
      const tier = o.tiers ? o.tiers[i % o.tiers.length] : 1;
      const arm = ["light", "medium", "heavy"][Math.floor(rng() * 3)];
      const perks = clamp(Math.floor(rng() * (tier + 1)), 0, CFG.perkMax);
      pl.push({ side: "hero", key: "p" + i, spd: clamp(CFG.base + CFG.armour[arm] + perks, CFG.min, CFG.max), human: true });
    }
    for (let i = 0; i < (o.fol || 0); i++) pl.push({ side: "hero", key: "f" + i, spd: CFG.ally.follower, human: false });
    for (const p of pl) { p.d = 1 + Math.floor(rng() * CFG.die); p.init = p.d + p.spd; }
    const fe = { side: "foe", key: "foe", spd: clamp(CFG.base + (o.foeSpd || 0), CFG.min, CFG.max), d: 1 + Math.floor(rng() * CFG.die) };
    const n = o.moves, k = Math.min(n, o.fast ? CFG.fastSlots : 1), us = pl.slice();
    for (let i = 0; i < k; i++) us.push({ ...fe, slot: i + 1, gap: CFG.slotGap * i, init: fe.d + fe.spd - CFG.slotGap * i, moves: Math.floor(n / k) + (i < n % k ? 1 : 0) });
    us.sort(cmp);
    // no timer: a player takes as long as they take; now and then one looks away and the leader skips them after 30 s
    const think = () => (rng() < sim.afk ? CFG.skipAfter + sim.react : sim.think * Math.exp(sim.spread * gauss(rng)));
    let secs = 0; const gs = []; let cur = null;
    const close = () => { if (!cur) return; gs.push(cur.n); secs += Math.max(cur.h ? Math.max(...cur.h) : 0, cur.a * sim.autoMove); cur = null; };
    for (const u of us) {
      if (u.side === "hero") { if (!cur) cur = { n: 0, h: [], a: 0 }; cur.n++; if (u.human) cur.h.push(think()); else cur.a++; }
      else { close(); secs += sim.foeMove * u.moves; }
    }
    close();
    return { groups: gs, secs, foeSlots: k };
  }
  function gauss(rng) { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  return { CFG, armourOf, heroSpeed, foeSpeed, allySpeed, speedOf, liveMods, foeSlowed, meHasted, rollOf, fast, foeSlots, cmp, units, build, predict, groups, groupAt, hero,
    refresh, spend, standUp, marks, WHY, pushFoe, resort, lockFrom, state, keyOf, simRound };
})();
if (typeof module !== "undefined") module.exports = INIT;
