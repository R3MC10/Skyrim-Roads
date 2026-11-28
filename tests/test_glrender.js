// GPU drawing layer (glrender.js): the maths behind it, the setting, and that it stays off where there is no WebGL.
// The real GPU-vs-2D picture compare is tests/glfight_ui.py (needs a browser).
// Run: node test_glrender.js   (W=/path/to/game/ to test another copy)
const path = require("path");
const W0 = process.env.W || path.join(__dirname, "..", "game") + "/";
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log("FAIL", msg); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// a little localStorage so the setting can be stored
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const GLR = require(path.join(W0, "glrender.js"));
const T = GLR._t;

// ---- no DOM / no WebGL: never on, layers are not ok, nothing throws
ok(GLR.supported() === false, "no WebGL in node");
ok(GLR.on() === false, "off without WebGL");
const L = GLR.layer();
ok(L && L.ok === false, "layer not ok without WebGL");

// ---- matrices behave like DOMMatrix
const I = [1, 0, 0, 1, 0, 0];
ok(T.mul(I, [2, 0, 0, 3, 5, 7]).join() === "2,0,0,3,5,7", "identity × m");
const tr = T.mul([1, 0, 0, 1, 10, 20], [2, 0, 0, 2, 0, 0]);   // translate then scale
ok(T.apply(tr, 1, 1).join() === "12,22", "translate·scale applies scale first");
const r = Math.PI / 2, rot = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
const p = T.apply(rot, 1, 0); ok(near(p[0], 0, 1e-12) && near(p[1], 1, 1e-12), "rotate 90° (canvas y-down)");
for (let i = 0; i < 200; i++) {   // associativity on random affine matrices
  const R = () => [Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 100, Math.random() * 100];
  const a = R(), b = R(), c = R(), x = Math.random() * 50, y = Math.random() * 50;
  const u = T.apply(T.mul(T.mul(a, b), c), x, y), v = T.apply(a, ...T.apply(b, ...T.apply(c, x, y)));
  ok(near(u[0], v[0], 1e-6) && near(u[1], v[1], 1e-6), "matrix product matches applying one by one");
}

// ---- drawImage's argument forms
const s = (o) => o && [o.sx, o.sy, o.sw, o.sh, o.dx, o.dy, o.dw, o.dh].map((n) => +n.toFixed(6)).join();
ok(s(T.rects(100, 50, [3, 4])) === "0,0,100,50,3,4,100,50", "drawImage(img, x, y)");
ok(s(T.rects(100, 50, [3, 4, 200, 25])) === "0,0,100,50,3,4,200,25", "drawImage(img, x, y, w, h)");
ok(s(T.rects(100, 50, [10, 5, 20, 10, 0, 0, 40, 20])) === "10,5,20,10,0,0,40,20", "9-argument form");
ok(s(T.rects(100, 50, [-10, 0, 20, 10, 0, 0, 40, 20])) === "0,0,10,10,20,0,20,20", "source rect clipped at the left edge, destination shrinks");
ok(s(T.rects(100, 50, [90, 40, 20, 20, 0, 0, 40, 40])) === "90,40,10,10,0,0,20,20", "source rect clipped at the right/bottom edge");
ok(s(T.rects(100, 50, [0, 0, 100, 50, 10, 10, -40, -20])) === "0,0,100,50,-30,-10,40,20", "negative destination size normalised");
ok(T.rects(100, 50, [0, 0, 0, 10, 0, 0, 5, 5]) === null, "empty source draws nothing");
ok(T.rects(100, 50, [200, 0, 10, 10, 0, 0, 5, 5]) === null, "source fully outside draws nothing");
ok(T.rects(100, 50, [1, 2, 3]) === null, "wrong argument count");
ok(T.rects(100, 50, [NaN, 0]) === null, "NaN position draws nothing");

// ---- colours
ok(JSON.stringify(T.parseColor("#1c2128")) === JSON.stringify([0x1c / 255, 0x21 / 255, 0x28 / 255, 1]), "#rrggbb");
ok(JSON.stringify(T.parseColor("#fff")) === "[1,1,1,1]", "#rgb");
ok(JSON.stringify(T.parseColor("rgba(255, 0, 51, 0.5)")) === JSON.stringify([1, 0, 0.2, 0.5]), "rgba()");
ok(JSON.stringify(T.parseColor("rgb(0,0,0)")) === "[0,0,0,1]", "rgb()");
ok(T.parseColor("red") === null && T.parseColor(null) === null && T.parseColor({}) === null, "unknown colours → not on the GPU");

// ---- blend modes: the ones the painted scenes use, as premultiplied blend factors
ok(T.BLEND["source-over"].join() === "ONE,ONE_MINUS_SRC_ALPHA", "source-over");
ok(T.BLEND.lighter.join() === "ONE,ONE", "lighter");
ok(T.BLEND.screen.join() === "ONE,ONE_MINUS_SRC_COLOR", "screen");
ok(T.BLEND.multiply.join() === "DST_COLOR,ONE_MINUS_SRC_ALPHA", "multiply");
// the factors give the 2D canvas formulas (premultiplied, over an opaque picture)
const blend = (m, sc, sa, d) => { const f = (n) => ({ ONE: 1, ONE_MINUS_SRC_ALPHA: 1 - sa, ONE_MINUS_SRC_COLOR: 1 - sc, DST_COLOR: d }[n]); return sc * f(T.BLEND[m][0]) + d * f(T.BLEND[m][1]); };
for (let i = 0; i < 300; i++) {
  const a = Math.random(), c = Math.random() * a, d = Math.random(), cs = a ? c / a : 0;   // c = premultiplied source colour
  ok(near(blend("source-over", c, a, d), cs * a + d * (1 - a), 1e-9), "source-over formula");
  ok(near(blend("lighter", c, a, d), c + d, 1e-9), "lighter formula");
  ok(near(blend("screen", c, a, d), d + c - c * d, 1e-9), "screen formula (s + d − s·d)");
  ok(near(blend("multiply", c, a, d), a * (cs * d) + d * (1 - a), 1e-9), "multiply formula over an opaque picture");
}

// ---- the setting: GPU by default, Classic sticks, another pick is ignored
ok(GLR.pref("gfxEngine", "classic") === true && T.engine() === "classic", "Classic stored");
ok(JSON.parse(store.rotn_prefs).gfxEngine === "classic", "kept with the other settings");
ok(GLR.pref("gfxEngine", "gpu") === true && T.engine() === "gpu", "GPU stored");
ok(GLR.pref("gfxEngine", "weird") === true && T.engine() === "auto", "anything else → Auto");
ok(GLR.pref("perfMode", "x") === false, "other settings aren't ours");
const html = GLR.settingsHTML((k, opts, cur) => `[${k}:${opts.map((o) => o[0]).join("/")}:${cur}]`);
ok(html.includes("[gfxEngine:auto/gpu/classic:auto]") && /Graphics engine/.test(html), "Settings row");
ok(!/WebGL|shader|texture/i.test(html), "plain words in the setting's text");
ok(GLR.settingsHTML(null) === "", "no row without the Settings helper");

// ---- GPU or 2D on Auto: real frame-to-frame times, the first frames one way then the other; GPU only if 10%+ quicker
const run = (name, gpuMs, cpuMs) => {
  let t = 1000;
  while (GLR.pick(name) === "gpu" && !GLR._t.race[name].pick && GLR._t.race[name].gpu.length < 30) { t += gpuMs; GLR.tick(name, "gpu", t); }
  while (GLR.pick(name) === "cpu" && !GLR._t.race[name].pick && GLR._t.race[name].cpu.length < 30) { t += cpuMs; GLR.tick(name, "cpu", t); }
  return GLR.pick(name);
};
ok(T.engine() === "auto", "Auto is the default");
ok(GLR.pick("t0") === "gpu", "starts by timing the GPU");
ok(run("t1", 12, 16.7) === "gpu", "GPU clearly quicker → GPU");
ok(GLR.stats().race.t1.ms.join() === "12,16.7", "the times are kept for the report");
ok(run("t2", 60, 16.7) === "cpu", "slow copy into a software canvas → the old way");
ok(run("t3", 16.7, 16.7) === "cpu", "no real gain (both at the screen's rate) → the old way");
ok(run("t4", 15.5, 16.7) === "cpu", "under 10% quicker → the old way");
GLR.tick("t2", "gpu", 1e6); ok(GLR.pick("t2") === "cpu" && GLR._t.race.t2.gpu.length === 30, "decided once for the session");
GLR.tick("t9", "gpu", 5); ok(!GLR._t.race.t9, "no timing before the race starts");
GLR.pick("t5"); GLR.tick("t5", "gpu", 100); GLR.tick("t5", "gpu", 600); GLR.tick("t5", "cpu", 610); GLR.tick("t5", "gpu", 620);
ok(GLR._t.race.t5.gpu.length === 0, "pauses (fight waiting, tab hidden) and switches aren't counted");
ok(GLR._t.median([99, 99, 99, 99, 99, 1, 2, 3]) === 2, "median skips warm-up frames");
GLR.pref("gfxEngine", "gpu"); ok(GLR.pick("t2") === "gpu", "setting GPU: always the GPU");
GLR.pref("gfxEngine", "auto"); ok(!GLR._t.race.t2 && GLR.pick("t2") === "gpu", "changing the setting times it again");

const st = GLR.stats(); ok(st.frames === 0 && st.fallbacks === 0, "nothing drawn in node");

// ---- the map on the GPU (glmap.js): off without a browser, its ambience recorder and colour parser
global.GLR = GLR;
const GLMAP = require(path.join(W0, "glmap.js"));
GLR.pref("gfxEngine", "auto");
ok(GLMAP.use() === false, "map: no GPU drawing without a browser");
ok(GLMAP.stats().frames === 0 && GLMAP.stats().on === false, "map: nothing drawn, no layers");
ok(GLMAP.colour("rgba(235,248,255,.8)").map((v) => +v.toFixed(3)).join() === "0.922,0.973,1,0.8", "map: rgba() colour");
ok(GLMAP.colour("#fff0cd").map((v) => +v.toFixed(3)).join() === "1,0.941,0.804,1", "map: #hex colour");
ok(GLMAP.colour("hsl(0,0%,0%)") === null, "map: unknown colour forms are refused (the stroke is then not GPU-safe)");
{
  const r = GLMAP.recorder();
  r.strokeStyle = "rgba(30,22,14,.75)"; r.lineCap = "round"; r.lineWidth = 2; r.beginPath();
  r.moveTo(0, 0); r.quadraticCurveTo(5, -5, 10, 0); r.moveTo(20, 0); r.lineTo(30, 0); r.stroke();
  const op = r.ops[0];
  ok(r.ops.length === 1 && op.line.length === 9, "recorder: a curve becomes 8 segments, plus the straight one");
  const end = op.line[7]; ok(near(end[2], 10, 1e-9) && near(end[3], 0, 1e-9), "recorder: the curve ends where it should");
  const mid = op.line[3]; ok(near(mid[3], -2.5, 1e-9), "recorder: the curve's middle is half the control height (quadratic Bezier)");
  ok(op.line[8].join() === "20,0,30,0" && !r.bad, "recorder: moveTo starts a new piece");
  r.globalAlpha = 0.4; r.drawImage({ width: 4, height: 4 }, 1, 2, 3, 4);
  ok(r.ops[1].a === 0.4 && r.ops[1].w === 3, "recorder: sprites keep their alpha and size");
  r.fillRect(0, 0, 1, 1); ok(r.bad, "recorder: anything it can't draw marks it unusable");
  const r2 = GLMAP.recorder(); r2.globalCompositeOperation = "lighter"; ok(r2.bad, "recorder: only source-over");
  const r3 = GLMAP.recorder(); r3.lineCap = "butt"; r3.strokeStyle = "#000000"; r3.moveTo(0, 0); r3.lineTo(1, 1); r3.stroke(); ok(r3.bad, "recorder: only round caps");
}
// the ambience MAPART draws on the map goes through the recorder without anything unsupported
{
  global.window = global.window || {};
  let MA = null; try { MA = require(path.join(W0, "mapart.js")); } catch { /* needs the DOM */ }
  if (MA && MA.ambient) {
    const r = GLMAP.recorder();
    try { MA.ambient(r, { t: 12.3, weather: "clear", close: 0 }, 1, 6000, 4000, [0, 0, 6000, 4000]); ok(!r.bad, "recorder: MAPART.ambient uses only what the GPU draws"); } catch { /* sprites need a canvas */ }
  }
}

console.log(`${checks - fails}/${checks} checks ok`);
if (fails) { console.log("FAILED"); process.exit(1); }
console.log("OK");
