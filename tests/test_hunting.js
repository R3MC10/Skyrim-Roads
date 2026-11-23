// Hunting: the toggle, animal encounters on the road, prey loot, Hunter's Eye. node test_hunting.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).concat(["smithing.js", "cooking.js", "hunting.js"]).filter((f, i, a) => a.indexOf(f) === i);
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, HUNT, D, WORLD } = c;
const hunter = () => { const s = c.make("archer" in {} ? "archer" : "warrior", 12); s.trip = null; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; if (s.perks) delete s.perks.hunters_eye; return s; };
// the toggle
{ const s = hunter(); ok(!HUNT.on(s) && HUNT.toggle(s) === true && HUNT.on(s) && HUNT.toggle(s) === false, "the toggle flips hunting on and off"); }
// only on the road, on foot or horseback
{ const s = hunter(); s.hunting = true; ok(HUNT.rate(s) === 0 && HUNT.speedMult(s) === 1, "nothing happens in town");
  G.startTrip(s, "Riverwood", WORLD.places.Riverwood);
  ok(HUNT.rate(s) === HUNT.RATE && HUNT.speedMult(s) === HUNT.SLOW, "on the road: more animals, a bit slower");
  s.trip.carriage = true; ok(HUNT.rate(s) === 0, "not from a carriage"); }
// what you find
{ const s = hunter(); let prey = 0, pred = 0, names = new Set();
  for (let k = 0; k < 600; k++) { const e = HUNT.pick(s); names.add(e.name); if (e.prey) prey++; else pred++; ok(e.hunt && e.tags.includes("animal") && e.tags.includes("beast"), "every hunt is an animal: " + e.name); }
  n -= 599;
  ok(prey > pred * 1.8 && pred > 60, `mostly prey, sometimes a predator: ${prey}/${pred}`);
  ok(names.has("Deer") && names.has("Elk") && names.has("Mountain goat") && names.has("Black bear"), "deer, elk, goats and bears: " + [...names].join(", "));
  ok(!names.has("Horker"), "no horkers inland"); }
// loot
{ const s = hunter(), e = G.scaleEnemy(HUNT.pick(s, () => 0), 12); ok(e.name === "Deer" && e.hunt && e.game, "a scaled deer keeps its game");
  const before = (s.inv.find((r) => r.item === "food_venison") || { qty: 0 }).qty;
  const got = G.rollLoot(s, e); const after = (s.inv.find((r) => r.item === "food_venison") || { qty: 0 }).qty;
  ok(after > before && got.some((x) => /Venison/.test(x)), "a deer gives venison: " + got.join(", "));
  const bear = HUNT.pick(s, () => 0.999); ok(!bear.prey && /bear|cat|wolf/i.test(bear.name), "the last pick is a predator: " + bear.name); }
// engine: hunting on the road brings animals
{ let hunts = 0, plain = 0; const trips = 60;
  for (const on of [true, false]) for (let k = 0; k < trips; k++) {
    const s = hunter(); s.hunting = on; const t0 = G.now(); G.startTrip(s, "Riverwood", WORLD.places.Riverwood, t0);
    const out = G.advance(s, t0 + 60 * 8);
    if (out.encounter && out.encounter.hunt) on ? hunts++ : plain++;
  }
  ok(hunts > trips * 0.12 && plain === 0, `animals turn up while hunting (${hunts}/${trips}), never when not`); }
// Hunter's Eye
{ const s = hunter(); s.perks = s.perks || {}; s.perks.hunters_eye = 2; s.hunting = true; G.startTrip(s, "Riverwood", WORLD.places.Riverwood);
  ok(Math.abs(HUNT.rate(s) - HUNT.RATE * 1.5) < 1e-9, "Hunter's Eye: half again as many animals");
  const e = HUNT.pick(s, () => 0); const before = (s.inv.find((r) => r.item === "food_venison") || { qty: 0 }).qty; HUNT.loot(s, e, () => 0);
  ok((s.inv.find((r) => r.item === "food_venison") || { qty: 0 }).qty - before === 2, "and an extra piece of meat"); }
console.log(`hunting: ${fails ? fails + " FAILED" : "all ok"} · ${n} checks`);
process.exit(fails ? 1 : 0);
