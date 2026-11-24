// Fear and foe healing limits (foecap.js): Battle Cry / Dismay / fear no longer stall bosses and elites for 8 turns,
// foe mages and healers can't heal back to full, and the fights stay fair. Runs the same fights with and without
// foecap.js (two game copies) and prints before → after. node test_balfear.js [--quick]
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const quick = process.argv.includes("--quick");
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const LIST = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).filter((f) => f !== "tbfight.js" && f !== "foeintent.js")
  .concat(["foeperks.js", "dragons.js", "priests.js", "daedric.js", "foekit.js", "fightread.js", "foeintent.js", "tbfight.js", "bossfight.js"]);
function game(withCap) {
  const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RUNS: 10 });
  for (const f of [...new Set(LIST)]) if ((withCap || f !== "foecap.js") && fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
  vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
  return c;
}
const A = game(true), Z = game(false);   // after / before
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
ok(typeof A.FOECAP === "object" && typeof Z.FOECAP === "undefined", "two copies: with and without foecap.js");

/* a dungeon's end boss / elite, the way dungeons.js makes them */
function foe(c, s, key, boss) {
  const { G, DUNGEONS } = c, base = typeof key === "object" ? key : DUNGEONS.ENEMY[key];
  const e = G.scaleEnemy({ ...base, tags: [...base.tags] }, G.fightLevel ? G.fightLevel(s) : s.level);
  if (boss) { e.health = Math.round(e.health * 0.8); e.hp = e.health; e.damage = Math.round(e.damage * 8) / 10; e.boss = true; }
  return e;
}
/* the same dice for the fight with and without foecap.js (both game copies share this Math) */
const realRandom = Math.random;
const seed = (n) => { let x = (n * 2654435761) >>> 0 || 1; Math.random = () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
/* the foe's health through the fight log: a rise on the foe's own line is healing (a ward or shield soaking your
   blow shows on your line and isn't counted); also how high it climbs back after dropping below half */
function heals(ss, m) {
  const w = { healed: 0, low: 1, peakAfterLow: 0 }; let v = null;
  for (const e of ss.ev) {
    if (typeof e.ehp !== "number") continue;
    if (v != null && e.ehp > v && e.who === "foe") { w.healed += e.ehp - v; if (w.low < 0.5) w.peakAfterLow = Math.max(w.peakAfterLow, e.ehp / m); }
    v = e.ehp; w.low = Math.min(w.low, v / m);
  }
  return w;
}
const lostTurn = (t) => /isn't fighting|cowers in fear/.test(t || "");
function sim(c, build, L, key, boss, n) {
  const { G, TB } = c; seed(n);
  const s = c.make(build, L); s.health = G.maxHealth(s); s.healthTs = G.now();
  const f = new G.Fight(s, foe(c, s, key, boss)); f.allies = [];
  const ss = new TB.Session(f, { trySneak: false, auto: true }); ss.begin();
  let guard = 0; while (!ss.done && guard++ < 500) ss.advance();
  Math.random = realRandom;
  const m = ss.ehpMax || f.ehp0 || 1, w = heals(ss, m);
  return { won: f.ehp <= 0 && f.hp > 0, rounds: ss.round, w, f0: m, capped: (f.fcap ? f.fcap.healed : 0) / m, lost: ss.ev.filter((e) => e.who === "foe" && lostTurn(e.text)).length,
    bigHit: Math.max(0, ...ss.ev.filter((e) => e.who === "me").map((e) => (e.dmg || 0) / m)) };
}

// ---- 1. Battle Cry on a boss: turns lost, scripted (a Nord shouts, then the foe takes 10 turns)
function cryStall(c, key, boss, extra) {
  const { G } = c, s = c.make("warrior", 25); s.race = "nord"; if (extra) s.perks.aspect_of_terror = 1;
  const f = new G.Fight(s, foe(c, s, key, boss)); f.allies = [];
  f.act("power:race");
  let lost = 0; for (let i = 0; i < 10; i++) { f.turn++; if (lostTurn(f.enemyTurn())) lost++; f.hp = 1e6; }
  return lost;
}
{
  const rows = [["boss (Bandit chief)", "chief", true], ["boss (Dragon priest)", "lich", true], ["elite (Hagraven)", "hagraven", false], ["normal (Bandit)", "bandit", false]];
  for (const [label, key, boss] of rows) {
    const b = cryStall(Z, key, boss), a = cryStall(A, key, boss), t = cryStall(A, key, boss, true);
    console.log(`Battle Cry, turns lost: ${label}: ${b} → ${a} (with Aspect of Terror ${t})`);
    if (boss) ok(b >= 8 && a <= 2 && t === 3, `bosses lose at most 2 turns (3 with Aspect of Terror): ${label} ${b} → ${a}/${t}`);
    else if (/elite/.test(label)) ok(a === 3 && t === 4, `elites lose 3 turns: ${a}/${t}`);
    else ok(a === b && a >= 8, `normal foes still run for the full time: ${b} → ${a}`);
  }
  // a second Dismay in the same fight: the boss's fight budget (3) runs out
  const { G, POWERS } = A, s = A.make("warrior", 25); const f = new G.Fight(s, foe(A, s, "chief", true)); f.allies = [];
  let lost = 0;
  for (let r = 0; r < 3; r++) { f.calmTurns = 8; A.FOECAP.clamp(f); for (let i = 0; i < 3; i++) { f.turn++; if (lostTurn(f.enemyTurn())) lost++; } }
  ok(lost === 3, `a boss loses at most 3 turns to fear in a whole fight (${lost})`);
}

// ---- 2. foe healing: never back above ~65% once below half, at most a third of its health a fight
const VIGILANT = { name: "Vigilant of Stendarr", health: 150, damage: 20, tags: ["humanoid", "elite"], gold: [0, 0], level: 12, danger: "high", text: "" };
const MAGES = ["necroMaster", "hagraven", "justiciar", "necro", VIGILANT];
const BUILDS = ["warrior", "twohand", "archer", "mage", "spellsword"];
const NM = quick ? 6 : 14;
for (const L of [10, 25, 40]) {
  const acc = { a: { r: 0, win: 0, heal: 0, peak: 0, over: 0 }, z: { r: 0, win: 0, heal: 0, peak: 0, over: 0 } }; let k = 0;
  for (const key of MAGES) for (let i = 0; i < NM; i++) {
    const b = BUILDS[(i + k) % BUILDS.length]; k++;
    for (const [tag, c] of [["a", A], ["z", Z]]) {
      const r = sim(c, b, L, key, i % 2 === 0, 1000 * L + k), o = acc[tag];
      o.r += r.rounds; o.win += r.won; o.heal += r.w.healed / r.f0; o.most = Math.max(o.most || 0, r.w.healed / r.f0); o.capped = Math.max(o.capped || 0, r.capped); o.peak = Math.max(o.peak, r.w.peakAfterLow); if (r.w.peakAfterLow > 0.7) o.over++;
    }
  }
  const m = k, f = (o) => `rounds ${(o.r / m).toFixed(1)}, win ${(100 * o.win / m).toFixed(0)}%, healed ${(100 * o.heal / m).toFixed(0)}% of its health a fight (most ${(100 * o.most).toFixed(0)}%), best heal-back after dropping below half ${(100 * o.peak).toFixed(0)}%, fights healed past 70% ${o.over}`;
  console.log(`mages level ${L}: before ${f(acc.z)}\n                after  ${f(acc.a)} (${m} fights each)`);
  ok(acc.a.over === 0, `level ${L}: no foe heals back past 70% after dropping below half`);
  ok(acc.a.capped <= 0.36 && acc.a.most <= 0.9, `level ${L}: healing spells, potions and drain give at most 35% of its health a fight (${(100 * acc.a.capped).toFixed(0)}%; regeneration and Avoid Death come on top)`);
  ok(acc.a.r >= acc.z.r * 0.8, `level ${L}: mage fights don't suddenly end too quickly`);
  ok(acc.a.win >= acc.z.win - 0.1 * m && acc.a.win / m <= 0.98 || L >= 40, `level ${L}: mage fights stay fair`);
}

// ---- 3. bosses: Nord players (Battle Cry ready) with the Smart AI; win rate, turns lost, rounds, one-shots
const BOSSES = ["chief", "deathlord", "centurion", "necroMaster", "giantSpider", "dragon", "lich", "master"];
const NB = quick ? 4 : 8;
for (const L of [10, 25, 40]) {
  const acc = { a: { r: 0, win: 0, lost: 0, big: 0 }, z: { r: 0, win: 0, lost: 0, big: 0 } }; let k = 0;
  for (const key of BOSSES) for (let i = 0; i < NB; i++) {
    const b = BUILDS[(i + k) % BUILDS.length]; k++;
    for (const [tag, c] of [["a", A], ["z", Z]]) {
      const r = sim(c, b, L, key, true, 7000 * L + k), o = acc[tag];
      o.r += r.rounds; o.win += r.won; o.lost += r.lost; o.big = Math.max(o.big, r.bigHit);
    }
  }
  const m = k, f = (o) => `win ${(100 * o.win / m).toFixed(0)}%, rounds ${(o.r / m).toFixed(1)}, turns lost to fear/calm ${(o.lost / m).toFixed(2)}, biggest blow ${(100 * o.big).toFixed(0)}% of its health`;
  console.log(`bosses level ${L}: before ${f(acc.z)}\n                after  ${f(acc.a)} (${m} fights each)`);
  ok(acc.a.lost / m <= 3, `level ${L}: bosses lose at most 3 turns a fight`);
  ok(acc.a.big < 0.5, `level ${L}: no blow takes half a boss's health`);
  ok(acc.a.win / m <= 0.98 || L >= 40, `level ${L}: bosses aren't trivial`);
  ok(L < 20 ? acc.a.win >= acc.z.win - 0.12 * m : acc.a.win / m >= 0.4, `level ${L}: bosses stay winnable`);
}
console.log(fails ? `failed: ${fails}` : `balfear: all ok · ${n} checks`);
process.exit(fails ? 1 : 0);
