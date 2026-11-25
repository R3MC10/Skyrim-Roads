// Painted battle scenes (battlescene.js + bscdata.js): every named dungeon, camp and lair in the scene pack's location
// index gets the art it lists (Embershard Mine its own scene), road fights follow the ground, the arena wins, every
// picture the data names is in game/, placements are sane, and the plate keeps the stage's ground line in both stages.
// node test_battlescene.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String });
for (const f of ["data.js", "world.js", "terrain.js", "solworld.js", "formulas.js", "perks.js", "engine.js", "dungeons.js", "bscdata.js", "battlescene.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { BSCENE: B, BSCENE_DATA: DATA } = c;
ok(B && DATA && B.list().length === 21, "21 scenes load (" + (B ? B.list().length : 0) + ")");

// ---- every named place in the pack's index resolves to the art it lists, with the game's own dungeon resolver
const csv = fs.readFileSync(path.join(__dirname, "battlescene-locations.csv"), "utf8").replace(/^﻿/, "").trim().split(/\r?\n/).slice(1);
let rows = 0, wrong = [];
for (const line of csv) {
  const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((x) => x.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
  const [loc, , kind, theme, , , art] = cells;
  if (!loc) continue;
  rows++;
  const got = B.artOfPlace(loc);
  if (got !== art) wrong.push(`${loc}: ${got} (want ${art}, theme ${theme}, ${kind})`);
}
ok(rows >= 190, "the index has every place (" + rows + ")");
ok(!wrong.length, `every place gets its art (${rows - wrong.length}/${rows})` + (wrong.length ? ": " + wrong.slice(0, 6).join("; ") : ""));
ok(B.artOfPlace("Embershard Mine") === "mine" && B.artOf({ dungeon: { theme: "mine" } }) === "mine", "Embershard Mine has its own scene");
ok(B.artOfPlace("Bleak Falls Barrow") === "barrow" && B.artOfPlace("Alftand") === "dwemer", "Bleak Falls Barrow → barrow, Alftand → brass engine vault");
ok(B.artOf({ dungeon: { theme: "lair" } }) === "lair" && B.artOf({ dungeon: { theme: "giantcamp" } }) === "giantcamp" && B.artOf({ dungeon: { theme: "banditcamp" } }) === "banditcamp", "camps and lairs");
ok(B.artOf({ dungeon: { theme: "nonsense" } }) === null, "an unknown theme keeps the drawn background");
ok(B.artOf({ dungeon: { theme: "barrow" } }, { arena: true }) === "arena" && B.artOfPlace("Windhelm Arena") === "arena", "the arena comes first");

// ---- roads: the ground under you
const T = c.Terrain.T, want = DATA.terrain;
let seen = {}, bad = [];
for (let i = 0; i < 4000; i++) {
  const x = 0.03 + (i % 80) / 80 * 0.94, y = 0.03 + Math.floor(i / 80) / 50 * 0.94, t = c.Terrain.typeAtPos([x, y]);
  const name = Object.keys(T).find((k) => T[k] === t), got = B.artOf({ x, y });
  seen[got] = (seen[got] || 0) + 1;
  if (got !== (B.townAt({ x, y }) ? "town" : want[name] || "tundra")) bad.push(`${name}@${x.toFixed(2)},${y.toFixed(2)} → ${got}`);
}
ok(!bad.length, "road fights follow the terrain mapping" + (bad.length ? ": " + bad.slice(0, 4).join("; ") : ""));
ok(["snow", "forest", "tundra", "rocky"].every((k) => seen[k] > 0), "the map has snow, forest, tundra and rocky road scenes: " + JSON.stringify(seen));
ok(B.artOf(null) === "tundra", "no save → tundra road");
// towns: in a town or city, or on the road right outside one → the town street; dungeons and the arena still win
{
  const P = c.WORLD.places, wr = P.Whiterun, rw = P.Riverwood;
  ok(B.artOf({ location: "Whiterun", x: wr[0], y: wr[1] }) === "town" && B.artOf({ location: "Riverwood", x: rw[0], y: rw[1] }) === "town", "in a city or town → town street");
  ok(B.artOf({ x: wr[0] + 0.008, y: wr[1] }) === "town", "just outside Whiterun on the road → town street");
  ok(B.artOf({ x: (wr[0] + rw[0]) / 2, y: (wr[1] + rw[1]) / 2 }) !== "town", "halfway between towns → the ground under you");
  ok(B.artOf({ location: "Whiterun", x: wr[0], y: wr[1], dungeon: { theme: "barrow" } }) === "barrow" && B.artOf({ location: "Windhelm" }, { arena: true }) === "arena", "a dungeon or the arena comes before the town");
  ok(seen.town > 0 && seen.town < 4000 * 0.15, "town streets only around towns (" + seen.town + " of 4000 map points)");
}
// and the drawn fallback key is still the old one
const FA = fs.readFileSync(W + "fightart.js", "utf8");
ok(/scene: arena \? "arena" : sceneOf\(s\)/.test(FA) && /rec\.scene stays the drawn fallback/.test(FA), "fightart keeps its own scene key for the drawn fallback");

// ---- pictures and placements
const files = new Set(fs.readdirSync(W));
let missing = [], badEl = [];
for (const id of B.list()) {
  const sc = DATA.scenes[id];
  for (const k of B.keys(id)) if (!files.has(k + ".webp")) missing.push(k);
  ok(sc.fgH > 0.05 && sc.fgH < 0.25, `${id}: foreground strip is a low band (${sc.fgH})`);
  for (const e of sc.els) {
    if (!(e.x >= -0.1 && e.x <= 1.1 && e.y >= 0 && e.y <= 1 && e.h > 0 && e.h < 1 && e.a[0] >= 0 && e.a[0] <= 1 && e.a[1] >= 0 && e.a[1] <= 1 && DATA.planes[e.p] != null)) badEl.push(id + ":" + e.k);
    if (e.l && !["flicker", "glow", undefined].includes(e.m) && e.b !== "screen") badEl.push(id + " light " + e.k);
  }
  ok(sc.els.some((e) => e.l) || ["tundra", "rocky", "snow", "forest", "autumn", "marsh", "ash", "lair", "arena"].includes(id), `${id}: has its lights`);
}
ok(!missing.length, "every picture is in game/ " + missing.slice(0, 5).join(", "));
ok(!badEl.length, "placements inside the plate " + badEl.slice(0, 5).join(", "));
const mine = DATA.scenes.mine;
ok(mine.els.some((e) => e.k === "bsp-torch-flame" && e.m === "flicker") && mine.els.some((e) => e.k === "bsp-torch-glow" && e.b === "screen") && mine.els.some((e) => e.k === "bsp-hanging-lantern" && e.m === "sway"), "Embershard: flickering torches, screen-blended glow, a swaying lantern");
for (const e of mine.els.filter((x) => x.k === "bsp-torch-flame")) ok(mine.els.some((f) => f.k === "bsp-torch-fixture" && f.p === e.p && Math.abs(f.x - e.x) < 0.03), "a torch flame shares its fixture's plane");
let bytes = 0; for (const f of files) if (/^bs[fp]?-.*\.webp$/.test(f)) bytes += fs.statSync(W + f).size;
ok(bytes < 14 * 1048576, `the pictures stay small for a phone (${(bytes / 1048576).toFixed(2)} MB)`);

// ---- the plate keeps the ground line: full stage height, centred, cropped at the sides in the taller stage
for (const [W0, k] of [[412, 0.46], [412, 0.66], [520, 0.46], [300, 0.66]]) {
  const Hh = Math.round(W0 * k), fr = B.frameOf(W0, Hh);
  ok(Math.abs(fr.pw / Hh - 1850 / 850) < 1e-9 && Math.abs(fr.left + fr.pw / 2 - W0 / 2) < 1e-9 && fr.pw >= W0 - 2, `stage ${W0}×${Hh}: plate fills the height, centred (${fr.pw.toFixed(0)} wide, left ${fr.left.toFixed(1)})`);
  ok(Math.abs(DATA.frames.groundY * Hh - Hh * 0.8) < 1e-9, "floor at 80%, where fightart puts the fighters' feet");
}
ok(B.camOf === undefined, "the parallax is the fight camera's now (fightcam.js)");
ok(DATA.planes.far < DATA.planes.middle && DATA.planes.middle < DATA.planes.near, "far planes move least");
ok(/groundY = Hh \* 0\.8/.test(FA), "fightart's ground line is still 80%");

// ---- drawing calls in order (a fake canvas): plate first, props in manifest order, strip last
{
  const calls = [];
  const g = { save() {}, restore() {}, translate() {}, scale() {}, rotate() {}, set globalAlpha(v) {}, get globalAlpha() { return 1; }, set globalCompositeOperation(v) { calls.push("op:" + v); }, drawImage(im) { calls.push(im.k); } };
  c.ASSETS = { img: (k) => ({ k, width: 100, height: 100 }), status: () => [] };
  const sc = B.ready("mine");
  ok(!!sc, "ready once every picture is in");
  B.back(g, sc, { W: 412, Hh: 272, t: 1, ox: 30 }); const nBack = calls.length; B.front(g, sc, { W: 412, Hh: 272, t: 1, ox: 30 });
  const ims = calls.filter((x) => !String(x).startsWith("op:"));
  ok(ims[0] === "bs-mine" && ims[ims.length - 1] === "bsf-mine", "plate first, foreground strip last: " + ims.join(" "));
  ok(ims.slice(1, -1).filter((k) => k !== "bs-mine" && k !== "bsf-mine").join() === sc.els.map((e) => e.k).join(), "props in manifest order");
  ok(calls.includes("op:screen"), "lights use screen blending");
  c.ASSETS = { img: (k) => (k === "bsf-mine" ? null : { k, width: 1, height: 1 }), status: () => [["bsf-mine", "none"]] };
  ok(!B.ready("mine") && B.failed("mine"), "a missing picture → not ready, drawn background stays");
  c.ASSETS = undefined; ok(!B.ready("mine"), "no ASSETS (node, tests) → drawn background");
}
console.log(fails ? `failed: ${fails}` : `battlescene: all ok · ${n} checks`);
process.exit(fails ? 1 : 0);
