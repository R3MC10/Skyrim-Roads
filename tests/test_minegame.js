// Mining mini-game: the rock face, the strike meter, what you dig out, quick dig, Prospector. node test_minegame.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).concat(["smithing.js", "solstheim.js", "minegame.js"]).filter((f, i, a) => a.indexOf(f) === i);
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, SMITH, MINEGAME: M, D } = c;
const miner = (skill = 15) => { const s = c.make("warrior", 10); s.location = "Dawnstar"; s.trip = null; s.mined = {}; if (!SMITH.count(s, "pickaxe")) G.give(s, "pickaxe"); s.skills.Smithing.lvl = skill; if (s.perks) delete s.perks.prospector; return s; };
// the rock face
{ const s = miner(), g = M.plan(s, "Dawnstar");
  const ore = g.cells.filter((x) => x.kind === "ore");
  ok(g.cells.length === 16 && ore.length >= 3 && ore.length <= 6, "a 4x4 wall with 3-6 ore: " + ore.length);
  ok(ore.every((x) => ["ore_iron", "ore_corundum"].includes(x.item)), "Dawnstar's ore is iron and corundum");
  ok(g.swings === 15, "15 swings at Smithing 15: " + g.swings);
  ok(ore.every((x) => x.hp === 3) && g.cells.filter((x) => x.kind === "stone").every((x) => x.hp === 1), "ore takes 3, rock 1"); }
// the meter
{ const z = M.zone(15, () => 0.5);
  ok(M.power(z, z.mid) === 3 && M.power(z, z.mid + z.good * 0.4) === 2 && M.power(z, z.mid + z.good) === 1, "perfect in the middle, good around it, a glancing blow outside");
  ok(M.zone(90, () => 0.5).good > z.good, "skill widens the band"); }
// striking
{ const s = miner(), g = M.plan(s, "Dawnstar", () => 0.3), i = g.cells.findIndex((x) => x.kind === "ore");
  let r = M.strike(g, i, 2); ok(r && !r.broke && g.cells[i].hp === 1 && g.swings === 14, "a good blow cracks the ore");
  r = M.strike(g, i, 1); ok(r.broke && r.n === 1 && g.got[g.cells[i].item] === 1, "the second blow breaks it out");
  ok(M.strike(g, i, 3) === null && g.swings === 13, "can't hit a broken stone");
  const j = g.cells.findIndex((x) => x.kind === "stone"); r = M.strike(g, j, 3); ok(r.broke && !r.item && g.swings === 12, "blank rock: a wasted swing"); }
// clean split on a perfect blow
{ let two = 0; for (let k = 0; k < 200; k++) { const g = M.plan(miner(), "Dawnstar"); const i = g.cells.findIndex((x) => x.kind === "ore"); if (M.strike(g, i, 3).n === 2) two++; }
  ok(two > 60 && two < 140, "a perfect blow splits ore about half the time: " + two + "/200"); }
// ends when swings run out
{ const g = M.plan(miner(), "Dawnstar"); let k = 0; while (!g.over && k < 50) { const i = g.cells.findIndex((x) => !x.broken && x.kind === "stone"); if (i < 0) break; M.strike(g, i, 1); k++; }
  ok(M.total(g.got) === 0 && g.swings < g.swings0, "swinging at blank rock digs nothing"); }
// balance: perfect play beats the quick dig, sloppy play doesn't; quick dig = old result
{ const sims = 400; let quick = 0, best = 0, sloppy = 0;
  for (let k = 0; k < sims; k++) {
    quick += M.total(SMITH.mineRoll(miner(), "Dawnstar"));
    for (const [dmgOf, add] of [[() => 3, (v) => (best += v)], [() => 2, (v) => (sloppy += v)]]) {
      const g = M.plan(miner(), "Dawnstar");
      const order = g.cells.map((x, i) => [x.glint ? 0 : 1, Math.random(), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
      for (const i of order) { while (!g.over && !g.cells[i].broken) M.strike(g, i, dmgOf()); if (g.over) break; }
      add(M.total(g.got));
    }
  }
  quick /= sims; best /= sims; sloppy /= sims;
  console.log(`  ore per trip: quick ${quick.toFixed(2)} · perfect ${best.toFixed(2)} · all-good ${sloppy.toFixed(2)}`);
  ok(quick > 3.5 && quick < 4.6, "quick dig gives what mining always gave");
  ok(best > quick * 1.15 && best < quick * 2, "good play gives more, but not silly amounts");
  ok(sloppy < best && Math.abs(sloppy / quick - 1) < 0.2, "all Good blows give about what a quick dig does"); }
// mine() takes the dug-out items, and the vein needs a day
{ const s = miner(), before = SMITH.count(s, "ore_iron");
  const m = SMITH.mine(s, "Dawnstar", G.now(), { ore_iron: 4 }); ok(/⛏/.test(m) && SMITH.count(s, "ore_iron") === before + 4, "mine() gives what you dug: " + m);
  ok(/bare/.test(SMITH.mineBlock(s, "Dawnstar")) && /bare/.test(SMITH.mine(s, "Dawnstar")), "then the veins are bare for a day");
  const s2 = miner(); ok(/nothing/.test(SMITH.mine(s2, "Dawnstar", G.now(), {})), "digging nothing still uses the veins up"); }
// stalhrim still needs the Skaal technique (Solstheim wraps mineBlock)
if (SMITH.MINES["Kolbjorn Barrow"]) { const s = miner(); s.location = "Kolbjorn Barrow"; ok(/stalhrim/i.test(SMITH.mineBlock(s, "Kolbjorn Barrow")), "stalhrim needs the technique"); }
// Prospector
{ const s = miner(); s.perks = s.perks || {}; s.perks.prospector = 1; const g = M.plan(s, "Dawnstar");
  ok(g.swings === 17 && g.cells.filter((x) => x.kind === "ore").every((x) => x.glint), "Prospector: 2 more swings, every vein glints"); }
console.log(`minegame: ${fails ? fails + " FAILED" : "all ok"} · ${n} checks`);
process.exit(fails ? 1 : 0);
