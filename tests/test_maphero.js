// MAPHERO: heroes on the world map as figures: standing / walking / riding (the moving horse of mapride.js: idle, walk, trot, gallop),
// facing the way they travel, an arrival puff, reduce motion keeps them still, no NaN anywhere
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const calls = { n: 0, draws: [] };
const ctx = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === "getTransform") return () => ({ a: 2, b: 0 }); return (...a) => { calls.n++; for (const v of a) if (typeof v === "number" && !isFinite(v)) throw new Error("NaN in " + String(k)); return { addColorStop() {} }; }; }, set: (t, k, v) => { t[k] = v; return true; } });
// a do-nothing DOM: any element answers any call (the game's load-time code pokes the page), canvases draw into ctx
const node = () => { const t = { width: 0, height: 0, style: new Proxy({}, { get: (o, k) => k in o ? o[k] : k === "setProperty" || k === "removeProperty" ? () => {} : "" }), dataset: {}, children: [], getContext: () => ctx, toDataURL: () => "data:image/png;base64,AA" };
  return new Proxy(t, { get: (o, k) => k in o ? o[k] : k === "classList" ? { add() {}, remove() {}, toggle() {}, contains: () => false } : k === "parentElement" || k === "firstChild" ? null : () => null, set: (o, k, v) => { o[k] = v; return true; } }); };
const doc = { addEventListener() {}, removeEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: node(), documentElement: node(), head: node(), createElement: node };
let clock = 1000;
const c = { calls, addEventListener() {}, removeEventListener() {}, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, document: doc, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 2, navigator: { userAgent: "node" }, location: { search: "", hash: "", href: "" }, matchMedia: () => ({ matches: false, addEventListener() {} }), requestAnimationFrame: () => 0, Image: function () { return { addEventListener() {} }; }, performance: { now: () => clock } };
c.window = c; vm.createContext(c);
const files = fs.readFileSync(W + "index.html", "utf8").match(/<script src="([a-z0-9]+\.js)">/g).map((s) => s.match(/"(.*)"/)[1]).filter((f) => !["store.js", "p2pnet.js", "ui.js", "sound.js", "map.js", "backup.js", "skillinfo.js"].includes(f));
if (!files.includes("maphero.js")) throw new Error("FAIL maphero.js not loaded by index.html");
// screen-only modules may trip over the missing page while loading; the map figure ones must not
const NEED = ["data.js", "engine.js", "heroart.js", "figart.js", "horseart.js", "rig.js", "mapride.js", "maphero.js"];
for (const f of files) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (e) { if (NEED.includes(f)) throw e; } }
c.tick = (ms) => { clock += ms; };
vm.runInContext(`
const ok = (c, m) => { if (!c) throw new Error("FAIL " + m); };
ok(typeof MAPHERO !== "undefined" && MAPHERO.ok(), "MAPHERO ready");
const g = document.createElement("canvas").getContext("2d");
const seen = []; const real = HEROART.drawFigure;
HEROART.drawFigure = function (gg, card, x, y, o) { seen.push(o); return real.apply(this, arguments); };
const s = G.newSave("A", "Ann", "nord"); for (const id of ["steel_armor", "steel_helmet", "steel_sword", "steel_shield"]) { const rid = G.give(s, id); G.equip(s, rid); }
const look = HEROART.lookOf(s);
// on foot: standing, then walking left
let r = MAPHERO.draw(g, 500, 300, 0.5, { id: "me", look, t: 1, moving: false });
ok(seen.at(-1).pose === "idle" && isFinite(r.top) && r.top < 300 && r.head < 300 && r.head > r.top, "standing figure, label above the head");
MAPHERO.draw(g, 490, 300, 0.5, { id: "me", look, t: 1.2, moving: true, heading: Math.PI });
ok(seen.at(-1).pose === "walk" && seen.at(-1).flip === true && MAPHERO.flipped("me"), "walking, facing left");
MAPHERO.draw(g, 495, 300, 0.5, { id: "me", look, t: 1.3, moving: true, heading: 0 });
ok(seen.at(-1).flip === false, "turns right again");
const frames = new Set(); for (let t = 0; t < 1; t += 0.05) { MAPHERO.draw(g, 495, 300, 0.5, { id: "me", look, t, moving: true, heading: 0 }); frames.add(seen.at(-1).frame); }
ok(frames.size >= 6, "the walk cycles through its frames " + frames.size);
// arriving: a short puff, then quiet again
MAPHERO.draw(g, 495, 300, 0.5, { id: "me", look, t: 2, moving: false });
ok(MAPHERO.active(), "arrival puff playing"); tick(1000); ok(!MAPHERO.active(), "puff ends");
// [maprider] on a horse: the moving horse (mapride.js) at idle, walk, trot and gallop, picked from the travel pace
for (const [moving, pace, gait] of [[false, 0, "idle"], [true, 0.8, "walk"], [true, 1.5, "trot"], [true, 2.4, "gallop"]]) {
  let rr; for (let t = 0; t < 2; t += 0.1) { tick(100); rr = MAPHERO.draw(g, 495, 300, 0.5, { id: "rider", look, horse: "#2b2724", moving, pace, t }); }
  ok(MAPHERO.gait("rider") === gait, "riding gait " + gait + " got " + MAPHERO.gait("rider"));
  ok(isFinite(rr.top) && rr.top < rr.head && rr.head < 300, "label sits over the rider " + gait);
}
ok(MAPHERO.paceOf({ moving: true, horse: "#000", gallop: true }) > 2 && MAPHERO.paceOf({ moving: false, horse: "#000" }) === 0, "a pace guess when the map gives none");
ok(MAPHERO.poseFor({ horse: "#000" }).pose === "ride", "no ink rider sprite on the map any more");
tick(1000);
// reduce motion: one still frame, no puff
MAPHERO.draw(g, 400, 300, 0.5, { id: "calm", look, t: 5, moving: true, reduce: true });
ok(seen.at(-1).pose === "idle" && seen.at(-1).frame === 0, "reduce motion: still");
MAPHERO.draw(g, 400, 300, 0.5, { id: "calm", look, t: 6, moving: false, reduce: true }); ok(!MAPHERO.active(), "reduce motion: no puff");
{ const n0 = calls.n; MAPHERO.draw(g, 400, 300, 0.5, { id: "calm2", look, horse: "#8a5a3b", t: 5, moving: true, pace: 2.4, reduce: true }); tick(100);
  MAPHERO.draw(g, 400, 300, 0.5, { id: "calm2", look, horse: "#8a5a3b", t: 5.2, moving: true, pace: 2.4, reduce: true });
  ok(calls.n > n0 && !MAPHERO.active(), "reduce motion on a horse: drawn, nothing keeps the map redrawing"); }
// another player, smaller, with a party ring colour and a bare look
r = MAPHERO.draw(g, 300, 200, 0.5, { id: "o:x", look: { r: "khajiit", id: "x", eq: {}, gl: {} }, scale: 0.82, ring: "#8fe08a", t: 1 });
ok(seen.at(-1).h < 36 * 0.5 && isFinite(r.head), "other heroes drawn smaller");
// the reusable form for other screens, with its own label (any text: a name, "Stranger")
r = MAPHERO.figure(g, { id: "pc:1", look, moving: true, heading: 0 }, 50, 80, 2, { s: 1, label: "Stranger", scale: 1.4 });
ok(seen.at(-1).pose === "walk" && Math.abs(seen.at(-1).h - 36 * 1.4) < 1e-9 && r.top < 80, "MAPHERO.figure draws with a label");
`, c);
console.log("maphero ok · canvas calls " + calls.n);
