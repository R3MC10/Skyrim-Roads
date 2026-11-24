/* Fight minigames (minigame.js). W=/path/to/game/ node test_minigame.js [runs] — prints a table and ALL OK.
   Which move gets which game, grades, skill widening the zone, what a Perfect adds (+1 stack), and a balance sim:
   the same builds and foes as test_strategy.js, played by Auto, once with plain hits and once with every blow and
   spell graded like an average player (a quarter Perfect, a fifth Miss). Fights must not get much shorter and no
   single move may take a big chunk of a strong foe at once. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const RUNS = +(process.env.RUNS || process.argv[2] || 8);
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RUNS, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "stacks.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "foeintent.js", "minigame.js", "tbfight.js", "followers2.js", "followerai.js", "strategy.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
// the sim characters (make(), gear, perks, rules) are shared with test_strategy.js: run its setup block here
const ST = fs.readFileSync(require("path").join(__dirname, "test_strategy.js"), "utf8");
const a0 = ST.indexOf("vm.runInContext(`") + "vm.runInContext(`".length, a1 = ST.indexOf("`, c);", a0);
vm.runInContext(ST.slice(a0, a1), c);

vm.runInContext(`(() => {
const { fresh, enc, boss, ok } = H, M = MINIGAME;
// 1. which game each move gets
const s0 = fresh("warrior", 20), f0 = new G.Fight(s0, enc("Bandit outlaw", 20));
ok(M.kindFor(f0, "attack").kind === "strike", "a weapon blow is the strike game");
ok(M.kindFor(f0, "power_attack").kind === "power", "a power attack is the harder power game");
ok(M.kindFor(f0, "block").kind === "parry" && M.kindFor(f0, "bash").kind === "parry", "guard and shield bash are a parry");
ok(M.kindFor(f0, "potion:health") === null && M.kindFor(f0, "end") === null && M.kindFor(f0, "recover") === null, "potions, Breathe and End turn have no game");
const fb = Object.assign(Object.create(Object.getPrototypeOf(f0)), f0, { wt: "bow" });
ok(M.kindFor(fb, "attack").kind === "aim" && M.kindFor(fb, "power_attack").hard, "bows aim and release (power shots are harder)");
const fire = Object.keys(D.SPELLS).find((k) => D.SPELLS[k].school === "Destruction" && D.SPELLS[k].element === "fire" && D.SPELLS[k].kind === "damage");
const heal = Object.keys(D.SPELLS).find((k) => D.SPELLS[k].school === "Restoration" && D.SPELLS[k].kind === "heal");
ok(M.kindFor(f0, "spell:" + fire).kind === "rune" && M.kindFor(f0, "spell:" + fire).school === "Destruction", "a Destruction spell draws the Destruction rune");
ok(M.kindFor(f0, "spell:" + heal).school === "Restoration", "a healing spell draws the Restoration rune");
for (const k of ["Destruction", "Restoration", "Alteration", "Illusion", "Conjuration"]) ok(M.SCHOOLS[k] && M.SCHOOLS[k].pts.length >= 3, k + " has its own rune");

// 2. grades: Good is today's normal hit; power attacks swing wider
const g = { kind: "strike" }, p = { kind: "power" };
ok(M.grade(0.5, g).mult === 1 && M.grade(0.9, g).cls === "perfect" && M.grade(0.1, g).cls === "poor", "strike: Good = normal, Perfect and Miss");
ok(M.grade(0.9, p).mult > M.grade(0.9, g).mult && M.grade(0.1, p).mult < M.grade(0.1, g).mult, "power: bigger Perfect, worse Miss");
ok(M.grade(0.1, { kind: "rune" }).label === "Fizzled" && M.grade(0.1, { kind: "parry" }).label === "Late", "spell misses fizzle, guards are late");
// 3. skill widens the zone
const lo = fresh("warrior", 5), hi = fresh("warrior", 40);
ok(M.width(new G.Fight(hi, enc("Bandit outlaw", 40)), "attack", g) > M.width(new G.Fight(lo, enc("Bandit outlaw", 5)), "attack", g), "more skill = a wider sweet zone");
ok(M.width(new G.Fight(hi, enc("Bandit outlaw", 40)), "attack", g) <= 1.9, "the zone never gets silly wide");
// 4. a Perfect adds a stack
{ const f = new G.Fight(fresh("warrior", 20), enc("Bandit outlaw", 20)); const b = f.ehp; f.ehp -= 5; const t = M.perfect(f, "attack", b);
  ok(/\\+1/.test(t) && (STACKS.get(f, "foe", "bleed") + STACKS.get(f, "foe", "sunder")) === 1, "a Perfect blow adds 1 stack (" + t + ")"); }
{ const f = new G.Fight(fresh("warrior", 20), enc("Bandit outlaw", 20)); M.perfect(f, "block", f.ehp);
  ok(STACKS.get(f, "me", "might") === 1 && STACKS.get(f, "me", "haste") === 1, "a Perfect guard gives Might and Haste"); }
{ const f = new G.Fight(fresh("mage", 20), enc("Bandit outlaw", 20)); M.perfect(f, "spell:" + fire, f.ehp);
  ok(STACKS.get(f, "foe", "burn") >= 1, "a Perfect fire spell adds a Burn stack"); }
{ const f = new G.Fight(fresh("mage", 20), enc("Bandit outlaw", 20)); M.perfect(f, "spell:" + heal, f.ehp);
  ok(STACKS.get(f, "me", "regen") === 1, "a Perfect healing spell adds Regen"); }
// 5. average accuracy is a touch above normal, not a big jump
let sum = 0; for (let i = 0; i < 4000; i++) sum += M.simGrade(g).mult;
ok(sum / 4000 > 1 && sum / 4000 < 1.06, "an average player hits about as hard as before (" + (sum / 4000).toFixed(3) + "x)");
})()`, c);

// 6. the balance sim
vm.runInContext(`(() => {
const { fresh, enc, boss, ok } = H, M = MINIGAME, RUNS = globalThis.RUNS;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const FOES = { normal: (L) => enc(pick(["Bandit outlaw", "Wolf pack", "Draugr", "Forsworn ambush", "Black bear", "Sabre cat"]), L),
  tough: (L) => enc(pick(["Vampire", "Frost troll", "Thalmor patrol"]), L),
  boss: (L) => boss(pick(["deathlord", "chief", "centurion", "hagraven", "master", "lich"]), L) };
const act0 = TB.Session.prototype.act;
let GAMES = false, biggest = 0, perf = 0, moves = 0;
TB.Session.prototype.act = function (a, tgt, mult, grade) {
  const f = this.f, k = GAMES && mult === undefined ? M.kindFor(f, a) : null;
  if (k) { grade = M.simGrade(k); mult = grade.mult; moves++; if (grade.cls === "perfect") perf++; }
  const b = f.ehp, r = act0.call(this, a, tgt, mult, grade);
  if (f.e && (f.e.boss || f.tags?.has?.("elite")) && b > f.ehp) biggest = Math.max(biggest, (b - Math.max(0, f.ehp)) / (f.ehp0 || f.e.health));
  return r;
};
function play(build, L, kind) {
  const s = fresh(build, L), f = new G.Fight(s, FOES[kind](L)), ss = new TB.Session(f, { trySneak: false, t: G.now() });
  ss.begin(); let g = 0;
  while (!ss.done && g++ < 400) { if (ss.cur?.id === "me" && !ss.done) ss.autoTurn(); ss.advance(); }
  return { won: !!(f.won && !f.escaped), hp: f.won ? Math.max(0, f.hp) / G.maxHealth(s) : 0, rounds: ss.round };
}
const T = {}; let errs = 0;
for (const mode of ["plain", "games"]) {
  GAMES = mode === "games"; const t = (T[mode] = { w: 0, hp: 0, r: 0, n: 0 });
  for (const b of ["warrior", "twohand", "spellsword", "mage", "archer"]) for (const L of [10, 25, 40]) for (const k of ["normal", "tough", "boss"]) for (let i = 0; i < RUNS; i++) {
    try { const x = play(b, L, k); t.w += x.won; t.hp += x.hp; t.r += x.rounds; t.n++; } catch (e) { errs++; if (errs < 4) console.log("ERR", b, L, k, mode, e.stack); }
  }
}
const pct = (x) => Math.round(x * 100);
console.log("mode    win%  hp left  rounds");
for (const [m, t] of Object.entries(T)) console.log(m.padEnd(6), String(pct(t.w / t.n)).padStart(5) + "%", String(pct(t.hp / t.n)).padStart(6) + "%", (t.r / t.n).toFixed(1).padStart(7));
console.log("Perfect " + pct(perf / Math.max(1, moves)) + "% of " + moves + " graded moves; biggest single move on a boss/elite: " + pct(biggest) + "% of its health");
ok(errs === 0, "no errors in the sims (" + errs + ")");
ok(T.games.r / T.games.n >= 3, "fights with minigames aren't over too quickly (" + (T.games.r / T.games.n).toFixed(1) + " rounds)");
ok(T.games.r / T.games.n >= 0.85 * (T.plain.r / T.plain.n), "average minigame play doesn't shorten fights by more than 15%");
ok(T.games.w / T.games.n <= T.plain.w / T.plain.n + 0.12, "average minigame play is a small edge, not a free win");
ok(biggest < 0.5, "no one-shots: no single move takes half a boss or elite (" + pct(biggest) + "%)");
TB.Session.prototype.act = act0;
})()`, c);
const fails = c.H.fails();
console.log(fails ? fails + " FAILED" : "ALL OK");
process.exit(fails ? 1 : 0);
