// The world map matches Skyrim 1:1: city bearings, holds, coast/borders, rivers, roads, spacing, travel distances, old-save migration.
const fs = require("fs"), vm = require("vm"); const W = process.env.W || "/home/claude/web/";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Int8Array, Object, Array, Set, Map, Proxy, Number, String, Error };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "roam.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0; const bad = (m) => { fails++; console.log("BAD", m); };
const PL = WORLD.places, T = Terrain.T, px = (p) => [p[0] * 1000, p[1] * 700];
// compass bearing from a to b (0 = north, 90 = east), measured in map pixels
const bearing = (a, b) => { const [ax, ay] = px(PL[a]), [bx, by] = px(PL[b]); return (Math.atan2(bx - ax, -(by - ay)) * 180 / Math.PI + 360) % 360; };
const DIRS = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const near = (b, d, tol) => { const diff = Math.abs(((b - DIRS[d]) + 540) % 360 - 180); return diff <= tol; };
// [from, to, direction, tolerance°] — as on the real Skyrim map
const B = [
  ["Whiterun", "Solitude", "NW", 30], ["Whiterun", "Windhelm", "NE", 35], ["Whiterun", "Riften", "SE", 25], ["Whiterun", "Markarth", "W", 25],
  ["Whiterun", "Falkreath", "SW", 30], ["Whiterun", "Morthal", "NW", 25], ["Whiterun", "Dawnstar", "N", 25], ["Whiterun", "Winterhold", "NE", 25],
  ["Whiterun", "Riverwood", "S", 15], ["Whiterun", "Rorikstead", "W", 15], ["Whiterun", "Helgen", "S", 20], ["Whiterun", "Ivarstead", "SE", 25],
  ["Solitude", "Dragon Bridge", "SW", 25], ["Solitude", "Morthal", "SE", 25], ["Markarth", "Karthwasten", "NE", 25], ["Windhelm", "Kynesgrove", "S", 30],
  ["Windhelm", "Winterhold", "NW", 35], ["Riften", "Shor's Stone", "N", 35], ["Riften", "Ivarstead", "W", 30], ["Riverwood", "Helgen", "S", 20],
  ["Falkreath", "Helgen", "E", 25], ["Dawnstar", "Winterhold", "E", 15], ["Morthal", "Dawnstar", "NE", 30], ["Markarth", "Solitude", "NE", 25],
  ["Riverwood", "Bleak Falls Barrow", "W", 50], ["Ivarstead", "High Hrothgar", "NW", 40], ["Windhelm", "Darkwater Crossing", "S", 25],
];
for (const [a, b, d, tol] of B) { const v = bearing(a, b); if (!near(v, d, tol)) bad("bearing " + a + " → " + b + " should be " + d + ", is " + v.toFixed(0) + "°"); }
// left-to-right and top-to-bottom order of the big cities (as the game's own map markers have them: Riverwood is a touch east of Whiterun)
const order = (k, list) => { for (let i = 1; i < list.length; i++) if (!(PL[list[i - 1]][k] < PL[list[i]][k])) bad("order " + (k ? "N→S" : "W→E") + " " + list[i - 1] + " / " + list[i]); };
order(0, ["Markarth", "Karthwasten", "Dragon Bridge", "Rorikstead", "Solitude", "Morthal", "Falkreath", "Whiterun", "Riverwood", "Dawnstar", "Ivarstead", "Winterhold", "Windhelm", "Shor's Stone", "Riften"]);
order(1, ["Solitude", "Morthal", "Windhelm", "Markarth", "Whiterun", "Riverwood", "Ivarstead", "Helgen", "Falkreath", "Riften"]);
// holds
const HOLD = { Solitude: "Haafingar", "Dragon Bridge": "Haafingar", Markarth: "The Reach", Karthwasten: "The Reach", "Old Hroldan": "The Reach",
  Whiterun: "Whiterun", Riverwood: "Whiterun", Rorikstead: "Whiterun", Windhelm: "Eastmarch", Kynesgrove: "Eastmarch", "Darkwater Crossing": "Eastmarch",
  Riften: "The Rift", Ivarstead: "The Rift", "Shor's Stone": "The Rift", Dawnstar: "The Pale", Winterhold: "Winterhold", Morthal: "Hjaalmarch",
  Stonehills: "Hjaalmarch", Falkreath: "Falkreath", Helgen: "Falkreath", "High Hrothgar": "Whiterun", Labyrinthian: "Hjaalmarch", Saarthal: "Winterhold" };
for (const [n, h] of Object.entries(HOLD)) { const got = WORLD.holdAt(PL[n]); if (got !== h) bad("hold of " + n + " should be " + h + ", is " + got); if (G.holdAt(PL[n]) !== h) bad("G.holdAt " + n); }
// sea, coast and borders
const coastal = ["Solitude", "Dawnstar", "Winterhold"];
for (const n of coastal) { const [x, y] = px(PL[n]); let sea = false; for (let a = 0; a < 6.28; a += 0.2) if (Terrain.typeAt([x + Math.sin(a) * 30, y - Math.cos(a) * 30]) === T.SEA) sea = true; if (!sea) bad(n + " should be on the coast"); }
for (const n of ["Whiterun", "Markarth", "Riften", "Falkreath", "Ivarstead", "Morthal"]) { const [x, y] = px(PL[n]); for (let a = 0; a < 6.28; a += 0.3) if (Terrain.typeAt([x + Math.sin(a) * 25, y - Math.cos(a) * 25]) === T.SEA) { bad(n + " is too close to the sea"); break; } }
if (Terrain.typeAt(px([0.5, 0.02])) !== T.SEA) bad("Sea of Ghosts should be in the north");
for (const p of [[0.2, 0.8], [0.1, 0.9], [0.02, 0.5], [0.99, 0.6], [0.5, 0.995]]) { const t = Terrain.typeAt(px(p)); if (t !== T.BEYOND) bad("should be beyond the border " + p + " (" + Terrain.NAMES[t] + ")"); }
for (const [n, [x, y]] of Object.entries(PL)) {
  const raw = Terrain.typeAt(px([x, y]));
  if (raw === T.SEA || raw === T.BEYOND) bad("not in Skyrim: " + n + " " + Terrain.NAMES[raw]);
  if (raw === T.LAKE) bad("in a lake: " + n);
  if (!Terrain.inPoly(px([x, y]), Terrain.border)) bad("outside border " + n);
  if (!(Terrain.SPEED[Terrain.typeAtPos([x, y])] > 0)) bad("can't stand at " + n);
}
// rivers run where they should
const riverNear = (name, place, maxPx) => { const r = WORLD.rivers.find((r) => r.name === name); if (!r) return bad("no river " + name); const d = Terrain.lineDist(px(PL[place]), r.pts.map(px)); if (d > maxPx) bad(name + " should pass " + place + " (" + d.toFixed(0) + "px)"); };
riverNear("White River", "Riverwood", 20); riverNear("White River", "Windhelm", 30); riverNear("White River", "Valtheim Towers", 25); riverNear("Karth River", "Solitude", 35); riverNear("Karth River", "Dragon Bridge", 25);
riverNear("River Yorgrim", "Windhelm", 30); riverNear("Treva River", "Riften", 120); riverNear("Darkwater River", "Darkwater Crossing", 25);
const lakeNear = (place, maxPx) => { const [x, y] = px(PL[place]); let best = 1e9; for (const [lx, ly] of WORLD.lakes) best = Math.min(best, Math.hypot(lx * 1000 - x, ly * 700 - y)); if (best > maxPx) bad("a lake should be near " + place); };
lakeNear("Riften", 60); lakeNear("Ivarstead", 50); lakeNear("Falkreath", 90); lakeNear("Windhelm", 140);
// mountains: the Throat of the World is the highest point, between Riverwood and Ivarstead
const hh = px(PL["High Hrothgar"]); if (Terrain.heightAt(hh) < 0.7) bad("High Hrothgar should be up the mountain");
let top = 0; for (let t = 0.2; t <= 0.8; t += 0.05) for (let dy = 0; dy <= 0.12; dy += 0.01) top = Math.max(top, Terrain.heightAt(px([PL.Riverwood[0] + (PL.Ivarstead[0] - PL.Riverwood[0]) * t, PL.Riverwood[1] + (PL.Ivarstead[1] - PL.Riverwood[1]) * t - dy]))); if (top < 0.85) bad("Throat of the World missing between Riverwood and Ivarstead " + top.toFixed(2));
// spacing: nothing sits on top of anything else
let close = 0; const P = Object.entries(PL);
for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const d = G.pxDist(P[i][1], P[j][1]); if (d < 8) { close++; bad("overlap " + P[i][0] + " ~ " + P[j][0] + " " + d.toFixed(1)); } }
// roads: one connected network linking every city and town
const adj = {}; const link = (a, b) => { (adj[a] = adj[a] || new Set()).add(b); (adj[b] = adj[b] || new Set()).add(a); };
for (const chain of WORLD.roads) { const names = chain.filter((x) => typeof x === "string"); for (const n of names) if (!PL[n]) bad("road to unknown " + n); for (let i = 1; i < names.length; i++) link(names[i - 1], names[i]); }
const seen = new Set(["Whiterun"]), q = ["Whiterun"]; while (q.length) for (const m of adj[q.pop()] || []) if (!seen.has(m)) { seen.add(m); q.push(m); }
for (const n of ["Solitude", "Markarth", "Windhelm", "Riften", "Dawnstar", "Winterhold", "Morthal", "Falkreath", "Riverwood", "Helgen", "Ivarstead", "Rorikstead", "Dragon Bridge", "Karthwasten", "Kynesgrove", "Shor's Stone", "Darkwater Crossing", "Old Hroldan", "Stonehills"]) if (!seen.has(n)) bad("not on the road network " + n);
for (const chain of WORLD.roads) { const pts = chain.map((c) => px(typeof c === "string" ? PL[c] : c)); for (let i = 1; i < pts.length; i++) { const n = Math.ceil(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) / 4); for (let k = 0; k <= n; k++) { const p = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k / n, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k / n]; const t = Terrain.typeAt(p); if (t === T.SEA || t === T.BEYOND) { bad("road leaves Skyrim near " + chain.filter((x) => typeof x === "string").join("-")); k = n; i = pts.length; } } } }
// routes between all big places exist (and don't just jump straight)
const big = P.filter(([n, p]) => p[2] === "city").map(([n]) => n);
for (const a of big) for (const b of big) if (a < b) { const r = Terrain.route(PL[a], PL[b]); if (r.length < 3) bad("no route " + a + " → " + b); }
// travel distances stay about what they were (the map only moved things, it didn't get bigger)
let ratio = 0, cnt = 0;
for (const a of big) for (const b of big) if (a < b) { const o = G.pxDist(WORLD.v2Places[a], WORLD.v2Places[b]), nw = G.pxDist(PL[a], PL[b]); ratio += nw / o; cnt++; if (nw / o > 1.6 || nw / o < 0.6) bad("distance " + a + "–" + b + " changed too much " + (nw / o).toFixed(2)); }
console.log("city distances new/old avg", (ratio / cnt).toFixed(2));
// old saves move onto the new map
const st = { v: 2, x: 0.47, y: 0.66, location: null, trip: { to: "Falkreath" }, discovered: ["Whiterun"], explored: [WORLD.v2Places.Whiterun, WORLD.v2Places.Riverwood, [0.47, 0.66]], journal: [], skills: {}, spells: [], inv: [], loadouts: {}, tactics: [] };
try {
  const m = G.migrate ? G.migrate(st) : null;
  if (m) {
    if (m.v < 3) bad("migrate v"); if (m.trip) bad("trip not cleared");
    const d0 = G.pxDist(m.explored[0], PL.Whiterun), d1 = G.pxDist(m.explored[1], PL.Riverwood);
    if (d0 > 1 || d1 > 1) bad("explored trail not moved " + d0 + " " + d1);
    if (!(Terrain.SPEED[Terrain.typeAtPos([m.x, m.y])] > 0)) bad("migrated onto unwalkable ground");
    const st2 = { ...JSON.parse(JSON.stringify(st)), location: "Riften", v: 2 }; const m2 = G.migrate(st2); if (G.pxDist([m2.x, m2.y], PL.Riften) > 0.5) bad("location keeps you in Riften");
  } else console.log("(G.migrate not exposed, skipped migration check)");
} catch (e) { bad("migrate threw " + e.message); }
// roam refuses the other provinces
const rp = ROAM.plan({ x: PL.Whiterun[0], y: PL.Whiterun[1], discovered: [] }, [0.15, 0.85]); if (!rp.err || !/border/.test(rp.err)) bad("roam into Hammerfell should be refused: " + JSON.stringify(rp));
console.log(fails ? "map11 FAILED " + fails : "map11 ok");
`, c);
