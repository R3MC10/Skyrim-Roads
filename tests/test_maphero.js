// MAPHERO: heroes on the world map as figures: standing / walking / riding (horse standing, walking, galloping),
// facing the way they travel, an arrival puff, reduce motion keeps them still, no NaN anywhere
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const calls = { n: 0, draws: [] };
const ctx = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === "getTransform") return () => ({ a: 2, b: 0 }); return (...a) => { calls.n++; for (const v of a) if (typeof v === "number" && !isFinite(v)) throw new Error("NaN in " + String(k)); return { addColorStop() {} }; }; }, set: (t, k, v) => { t[k] = v; return true; } });
const doc = { addEventListener() {}, createElement: () => ({ width: 0, height: 0, style: {}, dataset: {}, getContext: () => ctx, toDataURL: () => "data:image/png;base64,AA" }) };
let clock = 1000;
const c = { calls, addEventListener() {}, removeEventListener() {}, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, document: doc, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 2, performance: { now: () => clock } };
vm.createContext(c);
const files = fs.readFileSync(W + "index.html", "utf8").match(/<script src="([a-z0-9]+\.js)">/g).map((s) => s.match(/"(.*)"/)[1]).filter((f) => !["store.js", "p2pnet.js", "ui.js", "sound.js", "map.js", "backup.js", "skillinfo.js"].includes(f));
if (!files.includes("maphero.js")) throw new Error("FAIL maphero.js not loaded by index.html");
for (const f of files) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
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
// on a horse: standing, walking, galloping; the horse's coat colour is passed through
for (const [moving, gallop, gait] of [[false, false, "stand"], [true, false, "walk"], [true, true, null]]) {
  const fr = new Set(); for (let t = 0; t < 3; t += 0.1) { MAPHERO.draw(g, 495, 300, 0.5, { id: "rider", look, horse: "#2b2724", moving, gallop, t }); fr.add(seen.at(-1).frame); }
  const o = seen.at(-1); ok(o.pose === "ride" && o.horse === "#2b2724" && (o.gait || null) === gait, "riding gait " + gait);
  ok(fr.size >= 4, "horse animates " + gait);   // [riding] the saddle frames are cut finer (RIDE_STEPS)
}
// the horse gaits draw (figart.js) without NaN in both styles
for (const gait of ["stand", "walk", undefined]) for (let f = 0; f < 4; f++) for (const style of ["ink"]) ok(FIGART.sprite({ look }, { pose: "ride", frame: f, horse: "#9b9b97", gait, style, h: 30 }).width > 0, "gait sprite " + gait);
// [mapheroanim] the painted horse's motion: finite, standing has a head toss and a tail flick, walking and galloping swing the legs
{ const M = (gt, c) => HORSEART.motion(gt, c), fin = (m) => Object.values(m).every((v) => typeof v === "number" && isFinite(v));
  for (const gt of ["stand", "walk", "gallop"]) for (let c = 0; c <= 1; c += 0.05) ok(fin(M(gt, c)), "motion finite " + gt);
  ok(M("stand", 0.65).head < -0.15, "standing horse tosses its head"); ok(Math.abs(M("stand", 0.15).tail) > 0.15, "and flicks its tail");
  ok(Math.abs(M("stand", 0).head) < 0.05 && Math.abs(M("stand", 0).kH) < 1e-9, "calm at the start of the idle loop");
  ok(Math.abs(M("walk", 0.25).kH) > 0.2 && Math.abs(M("gallop", 0.25).kH) > 0.3 && Math.abs(M("gallop", 0.25).bob) > 0.03, "legs swing, the gallop rocks");
  ok(HORSEART.CUTS.stand && HORSEART.CUTS.gallop, "cut lines for both pictures"); }
// the map passes hanim (moving pieces) to the rider sprite; reduce motion doesn't
MAPHERO.draw(g, 495, 300, 0.5, { id: "rider", look, horse: "#2b2724", moving: false, t: 1 }); ok(seen.at(-1).hanim === true, "map rider animated"); tick(1000);
// reduce motion: one still frame, no puff
MAPHERO.draw(g, 400, 300, 0.5, { id: "calm", look, t: 5, moving: true, reduce: true });
ok(seen.at(-1).pose === "idle" && seen.at(-1).frame === 0, "reduce motion: still");
MAPHERO.draw(g, 400, 300, 0.5, { id: "calm", look, t: 6, moving: false, reduce: true }); ok(!MAPHERO.active(), "reduce motion: no puff");
MAPHERO.draw(g, 400, 300, 0.5, { id: "calm2", look, horse: "#8a5a3b", t: 5, moving: true, gallop: true, reduce: true });
ok(seen.at(-1).frame === 0 && seen.at(-1).gait === "stand", "reduce motion on a horse: still");
// another player, smaller, with a party ring colour and a bare look
r = MAPHERO.draw(g, 300, 200, 0.5, { id: "o:x", look: { r: "khajiit", id: "x", eq: {}, gl: {} }, scale: 0.82, ring: "#8fe08a", t: 1 });
ok(seen.at(-1).h < 36 * 0.5 && isFinite(r.head), "other heroes drawn smaller");
// the reusable form for other screens, with its own label (any text: a name, "Stranger")
r = MAPHERO.figure(g, { id: "pc:1", look, moving: true, heading: 0 }, 50, 80, 2, { s: 1, label: "Stranger", scale: 1.4 });
ok(seen.at(-1).pose === "walk" && Math.abs(seen.at(-1).h - 36 * 1.4) < 1e-9 && r.top < 80, "MAPHERO.figure draws with a label");
`, c);
console.log("maphero ok · canvas calls " + calls.n);
