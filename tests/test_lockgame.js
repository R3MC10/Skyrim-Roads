/* test_lockgame.js: the painted lockpicking game (lockgame.js). W=/path/to/game/ node test_lockgame.js — prints "lockgame ok".
   Checks: the rules are deterministic (seed + events replay exactly), aiming at the spot opens the lock, forcing far off
   snaps picks, Unbreakable never snaps, lock faces follow the place, Steady Pick widens the spot and steadies the pick,
   an average-player bot on the real rules opens about as many locks as the old roll did, and immerse.js points here. */
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const W = __GAME;
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, URLSearchParams };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "immerse.js", "lockgame.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
c.__files = fs.readdirSync(W);
vm.runInContext(`
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };
const L = LOCKGAME, HZ = L.HZ;
// 1. immerse.js points at the new game
ok(IMM.open === L.open && IMM.pick === L.pick && IMM.wantsGame === L.wants, "IMM.open/pick/wantsGame are the painted game");
ok(IMM.lock === null, "no lock open: IMM.lock is null");
// 2. lock faces by place
ok(L.faceFor({ theme: "barrow", tier: 0 }) === "nordic" && L.faceFor({ theme: "temple", tier: 4 }) === "nordic", "barrows and temples: Nordic");
ok(L.faceFor({ theme: "dwemer", tier: 1 }) === "dwemer", "ruins: Dwemer");
ok(L.faceFor({ theme: "thalmor", tier: 0 }) === "noble" && L.faceFor({ tier: 4 }) === "noble" && L.faceFor({ rich: true }) === "noble", "rich places and master locks: noble");
ok(L.faceFor({ tier: 2 }) === "steel" && L.faceFor({ tier: 3 }) === "steel" && L.faceFor({ theme: "fort", tier: 0 }) === "steel", "adept/expert and forts: steel");
ok(L.faceFor({ theme: "cave", tier: 0 }) === "iron" && L.faceFor({ tier: 1 }) === "iron" && L.faceFor({}) === "iron", "otherwise iron");
for (const f of L.FACES) ok(__files.includes("lock-" + f + ".webp"), "painting lock-" + f + ".webp is in the game folder");
ok(__files.includes("tool-lockpick.webp") && __files.includes("tool-tension-wrench.webp"), "tool paintings are in the game folder");
// 3. determinism: same seed + events = same lock, every time
const o = { w: 6, picks: 3, unbreakable: false, feel: 0, zone: 1 };
const rnd = L.rng(99);
for (let k = 0; k < 40; k++) {
  const seed = (rnd() * 1e9) | 0, evs = []; let t = 0;
  for (let i = 0; i < 30; i++) { t += 1 + ((rnd() * 20) | 0); const r = rnd(); evs.push(r < 0.5 ? [t, "a", Math.round(rnd() * 360) / 2] : r < 0.8 ? [t, "d"] : [t, "u"]); }
  const a = L.replay(seed, o, evs, 900), b = L.replay(seed, o, evs, 900);
  ok(JSON.stringify([a.tick, a.rot, a.picks, a.broken, a.opened, a.angle, a.strain]) === JSON.stringify([b.tick, b.rot, b.picks, b.broken, b.opened, b.angle, b.strain]), "replay " + k + " is exact");
  const live = L.make(seed, o); for (let tk = 0; tk <= 900 && !live.over; tk += 7) L.advance(live, evs, tk);   // fed in chunks, like a watch screen
  L.advance(live, evs, 900);
  ok(live.opened === a.opened && live.broken === a.broken && live.tick === a.tick && live.rot === a.rot, "chunked advance matches replay " + k);
}
// 4. aim at the spot and hold: it opens in about half a second, no pick lost
{ const st = L.make(5, o); L.input(st, [0, "a", st.spot]); L.input(st, [0, "d"]); for (let i = 0; i < HZ && !st.over; i++) L.step(st);
  ok(st.opened && st.broken === 0 && st.tick <= 17, "on the spot it opens (" + st.tick + " ticks)"); }
// 5. force it far off: picks snap one by one, then it's over
{ const st = L.make(6, o), far = st.spot > 90 ? 0 : 180; L.input(st, [0, "a", far]);
  let snaps = 0; for (let i = 0; i < HZ * 10 && !st.over; i++) { if (!st.holding && st.cool <= 0) L.input(st, [st.tick, "d"]); const b = st.broken; L.step(st); if (st.broken > b) snaps++; }
  ok(st.over && !st.opened && st.broken === 3 && st.picks === 0 && snaps === 3, "far off: three picks snap and the lock wins"); }
// 6. Unbreakable never snaps
{ const st = L.make(7, { ...o, unbreakable: true }); L.input(st, [0, "a", st.spot > 90 ? 0 : 180]); L.input(st, [0, "d"]);
  for (let i = 0; i < HZ * 5; i++) L.step(st); ok(!st.over && st.broken === 0, "Unbreakable: no snaps"); }
// 7. the further off, the less it turns (the shake follows 1 - target)
{ const st = L.make(8, o); const at = (d) => { st.angle = Math.min(180, st.spot + d); L.step(st); return st.target; };
  ok(at(0) === 1 && at(o.w + 2) > at(o.w + 6) && at(o.w + 40) === 0, "turn shrinks with distance"); }
// 8. walking away ends it unopened, no picks lost
{ const st = L.make(9, o); L.input(st, [3, "q"]); ok(st.over && !st.opened && st.broken === 0 && st.left, "leave it"); }
// 9. Steady Pick: a real perk with real effects, old ids kept
const tree = PERKS.TREES.Lockpicking.map((p) => p[0]);
ok(tree.includes("steady_pick"), "Steady Pick is in the Lockpicking tree");
for (const id of ["novice_locks", "apprentice_locks", "adept_locks", "expert_locks", "master_locks", "unbreakable", "quick_hands", "wax_key", "wayfarers_nose", "dwemer_lore"]) ok(tree.includes(id), "old perk kept: " + id);
const s = G.newSave("Lk", "Lk", "nord"); s.skills.Lockpicking.lvl = 70;
const base = L.optsFor(s, { chance: G.lockChance(s, 3), picks: 3, unbreakable: false });
ok(base.feel === 0, "no perk: no help");
s.perks = s.perks || {}; s.perks.steady_pick = 2;
const help = L.optsFor(s, { chance: G.lockChance(s, 3), picks: 3, unbreakable: false });
ok(Math.abs(help.feel - 0.3) < 1e-9, "rank 2 reads lockfeel 0.3 (" + help.feel + ")");
const s0 = L.make(1, base), s1 = L.make(1, help);
ok(s1.w > s0.w * 1.25 && s1.smax > s0.smax * 1.45, "Steady Pick: wider spot and a longer bend (" + s0.w.toFixed(2) + "→" + s1.w.toFixed(2) + ", " + s0.smax + "→" + s1.smax.toFixed(2) + ")");
// 10. the skill widens the spot, like it raised the old odds
{ const a = G.newSave("A", "A", "nord"), b = G.newSave("B", "B", "nord"); a.skills.Lockpicking.lvl = 15; b.skills.Lockpicking.lvl = 80;
  const wa = L.optsFor(a, { chance: G.lockChance(a, 2), picks: 3 }).w, wb = L.optsFor(b, { chance: G.lockChance(b, 2), picks: 3 }).w;
  ok(wb > wa, "Lockpicking 80 has a wider spot than 15 (" + wa.toFixed(2) + " vs " + wb.toFixed(2) + ")"); }
// 11. an average player on the real rules (same habits as immerse.js's sim) opens about as often as the old roll
function bot(seed, opt) {
  const st = L.make(seed, opt), r = L.rng(seed ^ 0x5bd1e995);
  let best = null, pend = [], a = 15 + r() * 150;
  const fall = (w) => 4 + 2.5 * w;
  while (!st.over && st.tick < HZ * 120) {
    L.input(st, [st.tick, "a", a]); L.input(st, [st.tick, "d"]);
    let k = 0; while (!st.over && k < 5) { L.step(st); k++; }   // feel it for about 0.15 s
    if (st.over) break;
    if (st.target >= 1 && st.holding) { for (let j = 0; j < HZ * 2 && !st.over; j++) L.step(st); continue; }   // it turns freely: keep holding
    const rr = st.target, b0 = st.broken;
    L.input(st, [st.tick, "u"]); for (let j = 0; j < 4 && !st.over; j++) L.step(st);
    if (st.broken !== b0) { best = null; pend = []; }
    if (!best || rr > best.r) { best = { a, r: rr }; if (rr > 0) { const est = (st.w + fall(st.w) * (1 - rr)) * (1 + (r() - 0.5) * 0.5); pend = [a + est, a - est].filter((x) => x >= 0 && x <= 180); if (r() < 0.5) pend.reverse(); } else pend = []; }
    a = pend.length ? pend.shift() : 5 + r() * 170;
    while (st.cool > 0 && !st.over) L.step(st);
  }
  return st.opened;
}
const rows = []; let worst = 0;
for (const lp of [15, 50, 90]) for (const tier of [0, 2, 4]) {
  const sv = G.newSave("S", "S", "nord"); sv.skills.Lockpicking.lvl = lp;
  const ch = G.lockChance(sv, tier), opt = L.optsFor(sv, { chance: ch, picks: 3, unbreakable: false });
  let won = 0; const N = 300; for (let i = 0; i < N; i++) if (bot(1000 + i * 7919 + tier * 31 + lp, opt)) won++;
  const old = IMM.oldOdds(ch, 3), got = won / N; worst = Math.max(worst, Math.abs(got - old));
  rows.push(lp + "/" + tier + ": old " + old.toFixed(2) + " game " + got.toFixed(2));
}
console.log(rows.join(" | "));
ok(worst <= 0.1, "average player within 10 points of the old odds (worst " + worst.toFixed(2) + ")");
console.log(fails ? "lockgame FAILED " + fails + "/" + n : "lockgame ok (" + n + " checks)");
if (fails) throw new Error("lockgame failed");
`, c);
