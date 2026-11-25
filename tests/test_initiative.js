/* Initiative and the turn roster (initiative.js, initroster.js, tbfight.js). [initiative]
   Owner: turns that change with speed and crowd control, done smart. Checks:
   - the roll: 1d4 + speed, once a fight; speed 5, light +1, heavy -1, perks +0..+2, kept within 1-10
   - haste +2 / slow -2 re-sort only what's still to come; nobody acts twice, nobody jumps the group acting now
   - stunned / frozen skip the next slot (frozen thaws), staggered moves back 2 places (at most 2 a round),
     knocked down spends a move getting up, knocked out loses its slots
   - no stun-lock: after losing a slot the foe shrugs off stuns and freezes through the next round; a boss loses one slot
   - fast foes: two slots, the 2nd at initiative -4; speed never gives more moves
   - shared turns: heroes side by side form one group; no timer in a party fight (it waits), the leader can skip a player
     who's been quiet for 30 s, a dropped phone guards by itself
   - the roster: portraits, brackets, the round marker and the next round, the +N sheet
   - seeded sims, parties of 1-8 with gear tiers: the average shared-turn size and the round time; the median round
     with 8 players must stay under 40 s
   W=/path/to/game/ node test_initiative.js   (SIMS=rounds per party size, default 400) */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
let seed = 4242;
const M = Object.create(Math); M.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
const c = { console, Math: M, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, process, structuredClone };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {}, removeItem() {} };
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
const { G, TB, INIT, INITUI, COOP, SHAREDFIGHT } = c;
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
ok(INIT && INITUI && TB, "initiative.js, initroster.js and tbfight.js loaded");
const CFG = INIT.CFG;
const FOE = { name: "Bandit outlaw", health: 60, damage: 10, tags: ["humanoid"] };
const BOSS = { name: "Bandit chief", health: 400, damage: 22, tags: ["humanoid", "elite"], boss: true };
function fight(L = 20, foe = FOE, build = "warrior") {
  const s = c.make(build, L); s.id = "p1"; s.name = "Alfa"; s.health = G.maxHealth(s);
  const e = G.scaleEnemy({ ...foe, tags: [...foe.tags], level: L, gold: [0, 0], text: "" }, L); if (foe.boss) e.boss = true;
  const f = new G.Fight(s, e); f.allies = [];
  return { s, f };
}
const follower = (name, extra = {}) => ({ name, hp: 200, maxHp: 200, dmg: 10, follower: true, fid: name.toLowerCase(), ...extra });
const player = (pid, name) => { const al = COOP.allyFromCard({ id: pid, name, cur: 300, coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: "fighter" } } }); al.pid = pid; return al; };
const foesIn = (ord) => ord.filter((o) => o.side === "foe");

// ---------------------------------------------------------------- 1. the roll and speed
{ const { s, f } = fight();
  const sp = (armor) => INIT.heroSpeed(s, { armor }).speed;
  const L = { a: { type: "light" }, b: { type: "light" } }, H = { a: { type: "heavy" }, b: { type: "heavy" } }, Md = { a: { type: "medium" } };
  ok(sp(L) === CFG.base + 1 && sp(Md) === CFG.base && sp(H) === CFG.base - 1, `speed: light ${sp(L)}, medium ${sp(Md)}, heavy ${sp(H)} (base ${CFG.base})`);
  ok(INIT.heroSpeed(s, { armor: {} }).armour === "none" && sp({}) === CFG.base + 1, "no armour moves like light armour");
  const ss = new TB.Session(f, { trySneak: false });
  ss.begin();
  const me = ss.order.find((o) => o.id === "me");
  ok(me && me.d >= 1 && me.d <= CFG.die && me.init === me.d + me.spd, `you: 1d4 (${me.d}) + speed (${me.spd}) = ${me.init}`);
  ok(ss.order.every((o) => o.spd >= CFG.min && o.spd <= CFG.max), "every speed is within 1-10");
  const d0 = { ...ss.ini.roll };
  ss.endRound(); ss.startRound();
  ok(JSON.stringify(ss.ini.roll) === JSON.stringify(d0), "the roll is kept all fight (rolled once)");
  for (let i = 1; i < ss.order.length; i++) if (INIT.cmp(ss.order[i - 1], ss.order[i]) > 0 && !ss.order[i].push) { ok(false, "the order is sorted by initiative"); break; }
  // ties are broken the same way every time: speed, then heroes, then you, then a fixed key
  const a = { init: 7, spd: 5, side: "foe", key: "foe" }, b = { init: 7, spd: 5, side: "hero", key: "p:x" }, m2 = { init: 7, spd: 5, side: "hero", key: "me" };
  ok(INIT.cmp(b, a) < 0 && INIT.cmp(m2, b) < 0 && [a, b, m2].sort(INIT.cmp)[0] === m2, "ties: heroes before the foe, you before your teammates");
  // perks: Quick Start / First Move / Swiftness (tbinit) give +1 per 3 points, at most +2
  const s2 = c.make("archer", 20); s2.perks = { ...(s2.perks || {}), quick_start: 2, first_move: 1 };
  const hs = INIT.heroSpeed(s2, { armor: L });
  ok(hs.parts.find((p) => /Perks/.test(p[0]))[1] <= CFG.perkMax && hs.speed <= CFG.max, "perks add at most +2: " + JSON.stringify(hs.parts));
  // speed never decides how many moves you get
  const st = TB.stats(s, f); ok(st.acts === TB.MAX_ACTS, "speed never gives more moves");
}
// ---------------------------------------------------------------- 2. haste and slow, live
{ const { f } = fight(); const ss = new TB.Session(f, { trySneak: false }); ss.begin();
  const me = ss.order.find((o) => o.id === "me"), foe = foesIn(ss.order)[0];
  f.stk = f.stk || {}; f.stk.me = { ...(f.stk.me || {}), haste: 1 };
  ok(INIT.speedOf(ss, me) === Math.min(CFG.max, me.spd + CFG.haste), "hasted: speed +2");
  f.slowed = 2;
  ok(INIT.speedOf(ss, foe) === Math.max(CFG.min, INIT.foeSpeed(f) + CFG.slow), "slowed: speed -2");
  f.slowed = 0; f.stk.me.haste = 0;
  // re-sort: only what's still to come, nobody ahead of the group acting now
  const { f: f2 } = fight(); f2.allies.push(follower("Lydia"), follower("Faendal"));
  const s2 = new TB.Session(f2, { trySneak: false }); s2.begin();
  const before = s2.order.map((o) => o.uid);
  const lock = INIT.lockFrom(s2), locked = s2.order.slice(0, lock).map((o) => o.uid);
  f2.slowed = 3; s2.tidy();
  ok(JSON.stringify(s2.order.slice(0, lock).map((o) => o.uid)) === JSON.stringify(locked), "a slow never moves what's already acting or done");
  ok(new Set(s2.order.map((o) => o.uid)).size === s2.order.length && s2.order.length === before.length, "nothing doubled, nothing lost in a re-sort");
}
// ---------------------------------------------------------------- 3. crowd control
{ // stunned: the next slot is lost; then no stun-lock
  const { f } = fight(25, BOSS); const ss = new TB.Session(f, { trySneak: false }); ss.begin();
  const slots = () => [...new Set(foesIn(ss.order).map((o) => o.u))];
  ok(slots().length === 2, "a boss has two slots (①②)");
  const fo = foesIn(ss.order), s1 = fo.filter((o) => o.slot === 1), s2 = fo.filter((o) => o.slot === 2);
  ok(s1.length && s2.length && s1[0].init - s2[0].init === CFG.slotGap, `the 2nd slot sits ${CFG.slotGap} lower (${s1[0].init} → ${s2[0].init})`);
  ss.order = INIT.build(ss, 2); ss.idx = 0;   // a fresh round: both slots still to come
  const pending = () => foesIn(ss.order).filter((o) => !o.done && !o.skip);
  const pend0 = pending().length;
  f.tbStunLeft = 1; ss.tidy();
  const sk = foesIn(ss.order).filter((o) => o.skip === "stun");
  ok(sk.length > 0 && new Set(sk.map((o) => o.u)).size === 1, "stunned: exactly one slot is lost (a boss never loses the whole round)");
  ok(pending().length < pend0 && pending().length > 0, "the boss still has its other slot");
  // spend it
  const o = sk[0]; const t = INIT.spend(ss, o); for (const x of sk.slice(1)) INIT.spend(ss, x);
  ok(/stunned and loses this turn/.test(t) && !(f.tbStunLeft > 0), "the stun is spent when the slot is lost: " + t);
  // stunned again in the same and the next round: shrugged off
  f.tbStunLeft = 1; const lines = INIT.refresh(ss);
  ok(lines.some((l) => /shrugs it off/.test(l)) && foesIn(ss.order).filter((o) => o.skip).length === sk.length, "no stun-lock: a second stun this round is shrugged off");
  ss.round++; f.tbStunLeft = 1; ss.idx = 0; ss.order = INIT.build(ss, 2); const l2 = INIT.refresh(ss);
  ok(l2.some((l) => /shrugs it off/.test(l)), "and through the next round");
  ss.round++; f.tbStunLeft = 1; ss.order = INIT.build(ss, 2); INIT.refresh(ss);
  ok(foesIn(ss.order).some((o) => o.skip === "stun"), "after that a stun works again");
}
{ // frozen: skips its next slot, then thaws
  const { f } = fight(); const ss = new TB.Session(f, { trySneak: false }); ss.begin();
  f.eParalyzed = 3; ss.tidy();
  const sk = foesIn(ss.order).filter((o) => o.skip === "freeze" && !o.done);
  ok(sk.length > 0, "frozen: the next slot is lost");
  let t = ""; for (const o of sk) t = INIT.spend(ss, o) || t;
  ok(/frozen solid.*thaws/.test(t) && !(f.eParalyzed > 0), "then it thaws: " + t);
}
{ // staggered: back 2 places, at most 2 a round
  const { f } = fight(); f.allies.push(follower("Lydia"), follower("Faendal"), follower("Jenassa"), follower("Marcurio"));
  const ss = new TB.Session(f, { trySneak: false });
  // put the foe first so there is room behind it
  ss.round = 1; f.turn = 1; ss.ini = null; INIT.state(ss).roll["foe:1"] = 4; ss.order = INIT.build(ss, 1); ss.idx = 0;
  const posOf = () => { const us = INITUI.units(ss).filter((x) => !x.done); return us.findIndex((x) => x.o.side === "foe"); };
  const p0 = posOf();
  f.stagger = 1; ss.tidy();
  const p1 = posOf();
  ok(p1 - p0 === Math.min(CFG.stagger, INITUI.units(ss).length - 1 - p0), `staggered: its slot moved back ${p1 - p0} places`);
  const fo = foesIn(ss.order)[0];
  ok(fo.why === "stagger" && fo.push === p1 - p0, "the slot remembers why it moved (the stagger icon flashes)");
  f.stagger = 0; ss.tidy(); f.stagger = 1; ss.tidy();
  ok(posOf() - p0 <= CFG.pushMax, "a slot moves back at most 2 places a round");
}
{ // knocked down: a move goes into standing up; knocked out: its slots are taken out
  ok(INIT.standUp({ kitApLoss: 1 }) === CFG.standUp && INIT.standUp({}) === 0, "knocked down: one move to get up");
  const { f } = fight(); const ly = follower("Lydia"); f.allies.push(ly);
  const ss = new TB.Session(f, { trySneak: false }); ss.begin();
  const e = ss.order.find((o) => o.al === ly && !o.done);
  if (e) { ly.down = true; ss.tidy(); ok(e.out === "down", "a knocked-out follower's slot is taken out"); }
  else ok(true, "(Lydia already acted)");
}
// ---------------------------------------------------------------- 4. groups (shared turns) and no double turns
{ const { f } = fight(); f.allies.push(follower("Lydia"), follower("Faendal"));
  const ss = new TB.Session(f, { trySneak: false }); ss.begin();
  const gs = INIT.groups(ss.order.map((o) => ({ ...o })));
  for (let i = 1; i < gs.length; i++) if (INIT.hero(gs[i]) && INIT.hero(gs[i - 1]) && gs[i].grp !== gs[i - 1].grp) { ok(false, "heroes side by side share a group"); break; }
  ok(gs.filter((o) => !INIT.hero(o)).every((o) => !o.grp), "a foe is never in a group");
}
{ // full fights (auto): every slot plays at most once a round, and every foe move is played
  let twice = 0, fights = 0, rounds = 0;
  for (let k = 0; k < 12; k++) {
    const { f } = fight([10, 20, 30][k % 3], k % 2 ? BOSS : FOE, ["warrior", "mage", "archer"][k % 3]); f.allies.push(follower("Lydia"));
    const ss = new TB.Session(f, { trySneak: false, auto: true });
    const seen = new Set(), orig = ss.autoActor.bind(ss);
    ss.autoActor = (o) => { const key = ss.round + "|" + o.uid; if (seen.has(key)) twice++; seen.add(key); return orig(o); };
    let r = ss.begin(), g = 0; while (!ss.done && g++ < 4000) { r = r.turn === "me" ? (ss.autoTurn(), ss.advance()) : ss.advance(); }
    fights++; rounds += ss.round;
  }
  ok(twice === 0, "no double turns (" + twice + ")");
  console.log(`auto fights: ${fights}, ${(rounds / fights).toFixed(1)} rounds on average`);
  ok(rounds / fights >= 3, "fights don't end too fast");
}
// ---------------------------------------------------------------- 5. party fights: no timer, Skip, dropped phones
{ const { f } = fight(); const b = player("p2", "Beta"), cc = player("p3", "Ceta"); f.allies.push(b, cc);
  const ss = new TB.Session(f, { trySneak: false }); let asks = 0; ss.remote = { ask() { asks++; }, end() {}, live: () => true, online: () => true };
  let r = ss.begin(), g = 0;
  while (r.turn !== "wait" && !ss.done && g++ < 80) { r = r.turn === "me" ? ss.act("end") : ss.advance(); if (r.turn === "next") r = ss.advance(); }
  ok(r.turn === "wait" && r.until === 0, "a party turn has no timer");
  const w = ss.waiting; w.t0 -= 10 * 60 * 1000; w.seen = w.t0 + 1;   // ten minutes later, no move from them: still waiting
  w.ack = true;
  const r2 = ss.advance();
  ok(r2.turn === "wait", "it waits for everyone (no time-out)");
  ok(ss.quiet().some((x) => x.pid === w.pid) && r2.quiet.some((x) => x.pid === w.pid), "after 30 s with no move the leader may skip them");
  w.seen = Date.now(); ok(!ss.quiet().some((x) => x.pid === w.pid), "a move resets that");
  const nm = w.name; ok(ss.skipPlayer(w.pid), "Skip");
  let r3 = ss.advance(); for (let i = 0; i < 4 && r3.turn === "wait"; i++) { ss.waiting.skip = true; r3 = ss.advance(); }
  ok(ss.ev.some((e) => new RegExp(nm + " is skipped and keeps their guard up").test(e.text)), "a skipped player guards, and the log says so");
  // a phone that dropped out: guards on its own
  let r4 = r3, g4 = 0; while (r4.turn !== "wait" && !ss.done && g4++ < 80) { r4 = r4.turn === "me" ? ss.act("end") : ss.advance(); if (r4.turn === "next") r4 = ss.advance(); }
  if (r4.turn === "wait") {
    ss.remote.online = () => false; for (const x of ss.gr.waits) x.t0 -= (CFG.lostAfter + 1) * 1000;
    ss.advance();
    ok(ss.ev.some((e) => /lost the connection and keeps their guard up/.test(e.text)), "a phone that dropped out guards by itself");
  } else ok(true, "(the fight ended first)");
  // the record: no deadline
  const d = TB.fightState(ss); ok((d.turns || []).every((t) => t.until === 0), "the record has no deadline");
}
{ // teammates in one shared turn: all asked at once, the record lists each of them
  const { f } = fight(); const ps = ["Beta", "Ceta", "Dita"].map((nm, i) => player("p" + (i + 2), nm)); f.allies.push(...ps);
  const ss = new TB.Session(f, { trySneak: false }); ss.remote = { ask() {}, end() {}, live: () => true, online: () => true };
  // everyone next to each other: the foe rolls last
  ss.round = 1; f.turn = 1; INIT.state(ss).roll["foe:1"] = 1; for (const p of ps) INIT.state(ss).roll["p:" + p.pid] = 4; INIT.state(ss).roll.me = 4;
  ss.order = INIT.build(ss, 1); ss.idx = 0; f.e.health;
  const r = ss.advance();
  const d = TB.fightState(ss);
  ok(ss.gr && ss.gr.waits.length >= 2 && (d.turns || []).length === ss.gr.waits.length, "a shared turn waits for several players at once (" + (d.turns || []).length + ")");
  ok(r.turn === "me", "and you play yours at the same time");
  // a teammate's phone: it's her turn, no timer
  const s2 = c.make("mage", 20); s2.id = d.turns[0].pid; s2.name = d.turns[0].name;
  const m = SHAREDFIGHT.build(s2, { id: "fid", owner: "p1", ...d }, () => {});
  ok(m.advance().turn === "me" && !m.until, "on her phone: her turn, no countdown");
  let beats = 0; m.beatTo = () => beats++; m.startTurn({ tid: d.turns[0].tid, until: 0 });
  ok(beats === 1, "her phone tells the leader she's there");
}
// ---------------------------------------------------------------- 6. the roster
{ const { f } = fight(25, BOSS); f.allies.push(follower("Lydia"), follower("Faendal"));
  const ss = new TB.Session(f, { trySneak: false }); ss.begin();
  const h = INITUI.strip(ss, {});
  ok((h.match(/class="tbini ini2 /g) || []).length >= ss.order.length - foesIn(ss.order).length + 2 - 1, "one portrait per slot");
  ok(/inislot">①/.test(h) && /inislot">②/.test(h), "a fast foe's two slots are marked ① ②");
  ok(/class="inisep"/.test(h) && /tbini ini2 nx/.test(h), "the round marker, then the next round dimmed");
  ok(/data-tip="[^"]*initiative \d+ \(roll \d \+ speed \d+/.test(h), "tapping a portrait tells its initiative (roll + speed)");
  ok(/data-tbx="roster"/.test(INITUI.more(ss, false)), "+N opens the whole order");
  const sh = INITUI.sheet(ss);
  ok(/data-tbx="rosterx"/.test(sh) && (sh.match(/class="inirow/g) || []).length >= ss.order.length - 1, "the sheet lists everyone");
  f.tbStunLeft = 1; ss.tidy();
  ok(/ini2[^"]* skip/.test(INITUI.strip(ss, {})) && /inicross/.test(INITUI.strip(ss, {})), "a lost turn gets a cross");
  // 16 fighters fit (8 players + followers + the foe's slots)
  const { f: f2 } = fight(); for (let i = 0; i < 7; i++) f2.allies.push(player("q" + i, "P" + i)); for (let i = 0; i < 6; i++) f2.allies.push(follower("F" + i));
  const s2 = new TB.Session(f2, { trySneak: false }); s2.begin();
  ok(INITUI.units(s2).length <= CFG.maxFighters + 2 && INITUI.units(s2).length >= 15, "up to 16 fighters on the roster (" + INITUI.units(s2).length + ")");
}
// ---------------------------------------------------------------- 7. Polish
{ const strs = ["Beta is skipped and keeps their guard up.", "Beta lost the connection and keeps their guard up.", "Whole turn order", "Shared turn", "Next round, if nothing changes", "Turn order", "Skip Beta", "Beta, Ceta are choosing…",
    "Bandit is stunned and loses this turn", "Bandit is frozen solid and loses this turn, then thaws", "You get back on your feet (one move)", "Staggered: moved back 2 places", "A smarter turn order"];
  const pl = (t) => { c.__lang = "pl"; try { return c.I18N && c.I18N.tr ? c.I18N.tr(t) : null; } finally { c.__lang = "en"; } };
  const miss = strs.filter((t) => !pl(t) || pl(t) === t);
  ok(miss.length === 0, "Polish for the new words: missing " + miss.join(" | "));
}
// ---------------------------------------------------------------- 8. the seeded round-time sims (parties of 1-8, gear tiers)
{ const R = +(process.env.SIMS || 400);
  let s = 777; const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x80000000; };
  const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  console.log("party  fol  avg group  median round  p90 round  (no timer; think median " + CFG.sim.think + " s, " + (CFG.sim.afk * 100) + "% look away and get skipped at " + CFG.skipAfter + " s)");
  const out = {};
  for (let np = 1; np <= 8; np++) {
    const gs = [], secs = [];
    for (let i = 0; i < R; i++) {
      const r = INIT.simRound({ rng, np, fol: Math.min(np, 1 + Math.floor(rng() * 2)), tiers: [0, 1, 2], moves: 2 + Math.floor(rng() * 2), fast: rng() < 0.35 });
      gs.push(...r.groups); secs.push(np === 1 ? r.secs : r.secs);
    }
    const avg = gs.reduce((a, b) => a + b, 0) / gs.length, b = secs.slice().sort((x, y) => x - y);
    out[np] = { avg, med: med(secs), p90: b[Math.floor(b.length * 0.9)] };
    console.log(`  ${np}     ≤2   ${avg.toFixed(2).padStart(5)}      ${out[np].med.toFixed(1).padStart(5)} s     ${out[np].p90.toFixed(1).padStart(5)} s`);
  }
  ok(out[8].med < 40, "the median round with 8 players is under 40 s (" + out[8].med.toFixed(1) + " s)");
  ok(out[8].avg > out[1].avg, "bigger parties act together in bigger groups");
}
console.log(fails ? "FAILED " + fails + " of " + n : "ALL OK (" + n + ")");
process.exit(fails ? 1 : 0);
