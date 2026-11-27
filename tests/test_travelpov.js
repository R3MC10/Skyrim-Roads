const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// FPREAL (fpreal.js): the road view reads the real world. Checks the skyline (mountains where the map has them, flat over
// the tundra), real places at their true bearing and distance (Whiterun → Riverwood: Riverwood ahead, High Hrothgar on the
// left/south-east), the road's real bends from a route, Solstheim's own land, and the company list (riders on their horses,
// people on foot, pets).
const fs = require("fs"), vm = require("vm");
const W = __GAME;
const c = { console, Math, JSON, Object, Array, Set, Map, Number, String, Float32Array, Uint8Array, Int32Array, Uint8ClampedArray, Uint16Array, Int16Array, isFinite, parseInt, parseFloat, Date };
vm.createContext(c);
const load = (f) => vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/gm, "var $1 =").replace(/^let (\w+) =/gm, "var $1 =").replace(/^function makeTerrain/m, "var makeTerrain = function makeTerrain"), c, { filename: f });
try { load("data.js"); } catch (e) { /* items only */ }
for (const f of ["world.js", "terrain.js"]) load(f);
try { load("solworld.js"); } catch (e) { console.log("(no Solstheim in this harness: " + e.message.slice(0, 80) + ")"); }
load("fpreal.js");
const R = c.FPREAL, WD = c.WORLD;
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const P = (name) => WD.places[name];
const brg = (a, b) => (Math.atan2((b[0] - a[0]) * 1000, -(b[1] - a[1]) * 700) * 180 / Math.PI + 360) % 360;

// skyline: next to the Throat of the World the land rises high; out on Whiterun's plain it's low in the north
const ivar = P("Ivarstead"), wr = P("Whiterun");
ok(ivar && wr, "places exist");
const rI = R.relief(ivar), rW = R.relief(wr);
ok(rI && rI.el.length === 180 && rW, "skyline has 180 steps");
const maxI = Math.max(...rI.el), hh = P("High Hrothgar");
const toHH = Math.round(brg(ivar, hh) / 2) % 180;
ok(maxI > 0.25, "mountains round Ivarstead stand high: " + maxI.toFixed(2));
ok(rI.el[toHH] > 0.25, "the Throat of the World rises toward High Hrothgar from Ivarstead: " + rI.el[toHH].toFixed(2));
const avgW = rW.el.reduce((a, b) => a + b, 0) / 180;
ok(avgW < maxI, "Whiterun's plain is lower overall than the mountain valley");
ok(R.relief(wr) === rW, "skyline is cached");
ok(rI.snow.some((v) => v), "snow on the high peaks near Ivarstead");

// real places: from Whiterun looking toward Riverwood
const rv = P("Riverwood"), head = brg(wr, rv);
const pl = R.places(wr, head, { dest: "Riverwood" });
const rvp = pl.find((q) => q.name === "Riverwood");
ok(rvp, "Riverwood is listed from Whiterun");
ok(rvp && Math.abs(rvp.rel) < 2, "Riverwood dead ahead when heading for it: " + (rvp && rvp.rel.toFixed(1)));
ok(rvp && rvp.fwd > 0 && Math.abs(rvp.lat) < 3, "ahead, not to the side");
ok(pl.some((q) => q.name === "High Hrothgar"), "High Hrothgar seen from Whiterun");
ok(pl.every((q, i) => !i || q.dist >= pl[i - 1].dist), "nearest first");
const back = R.places(wr, (head + 180) % 360, { dest: "Riverwood" }).find((q) => q.name === "Riverwood");
ok(back && back.fwd < 0 && Math.abs(Math.abs(back.rel) - 180) < 2, "turning round puts Riverwood behind you");
const kn = R.places(wr, head, { known: (n) => n === "Riverwood", dest: "Riverwood" });
ok(kn.find((q) => q.name === "Riverwood").known && !kn.filter((q) => q.name !== "Riverwood" && q.kind !== "peak").some((q) => q.known), "known names only");

// the road's bends from a real route
if (c.Terrain.route) {
  const path = c.Terrain.route(wr, rv);
  ok(path.length > 2, "route Whiterun → Riverwood has waypoints: " + path.length);
  const h0 = brg(path[0], path[Math.min(3, path.length - 1)]);
  const bf = R.bend(path[0], path, 0, h0);
  ok(typeof bf === "function", "bend function");
  const vals = [2, 10, 25, 45].map((z) => bf(z));
  ok(vals.every((v) => isFinite(v)), "bend finite " + vals.map((v) => v.toFixed(1)).join(","));
  ok(Math.abs(bf(0.5)) < 1.5, "the road starts under you");
}
ok(R.bend([0.5, 0.5], [], 0, 0) === null, "no path, no bend");

// Solstheim
const rr = P("Raven Rock");
if (rr && WD.isSol(rr)) {
  const sp = R.places(rr, 0, {});
  ok(sp.length && sp.every((q) => WD.isSol(WD.places[q.name] || [0, 2])), "on Solstheim you only see Solstheim");
  ok(!sp.some((q) => q.name === "Whiterun"), "no Whiterun across the sea");
  const sr = R.relief(rr);
  ok(sr && sr.el.length === 180, "Solstheim has a skyline");
}

// company: riders keep their horse, walkers don't, pets are pets
const comp = R.companions([
  { name: "Beta", player: true, riding: true, horse: "#ebe6da", look: { r: "redguard", eq: { chest: "steel_armor", head: "steel_helmet", weapon: "steel_sword", shield: "steel_shield" } } },
  { name: "Lydia", follower: true, look: { r: "nord", eq: { chest: "steel_plate_armor" } } },
  { name: "Meeko", pet: true, kind: "dog" },
]);
ok(comp.length === 3, "three in company");
ok(comp[0].riding && comp[0].coat === "#ebe6da" && comp[0].helm && comp[0].shield && comp[0].weapon, "Beta rides her own horse with her gear");
ok(!comp[1].riding && comp[1].follower, "Lydia walks");
ok(comp[2].pet && comp[2].kind === "dog", "Meeko is a dog");
ok(comp.every((m) => m.pet || /^#[0-9a-f]{6}$/i.test(m.skin)), "skin colours");

console.log(`travelpov checks: ${n - fails} passed`);
if (fails) { console.log(fails + " FAILED"); process.exit(1); }
