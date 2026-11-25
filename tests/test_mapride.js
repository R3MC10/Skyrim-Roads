// MAPRIDE: the mounted hero on the world map. The gait state machine (pace thresholds, ~10% hysteresis, blends),
// per-horse phase offsets, the key poses (hooves on the ground in stance, a moment in the air at the gallop),
// reduce motion and drawing with no NaN.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
let n = 0;
const ok = (c, m) => { if (!c) throw new Error("FAIL " + m); n++; };
const calls = { n: 0 };
const ctx = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === "getTransform") return () => ({ a: 2, b: 0 }); return (...a) => { calls.n++; for (const v of a) if (typeof v === "number" && !isFinite(v)) throw new Error("NaN in " + String(k)); return { addColorStop() {} }; }; }, set: (t, k, v) => { t[k] = v; return true; } });
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Proxy, Number, String, performance: { now: () => 1000 },
  document: { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) } };
vm.createContext(c);
const html = fs.readFileSync(W + "index.html", "utf8");
ok(/<script src="mapride\.js"><\/script>[\s\S]*<script src="maphero\.js">/.test(html), "index.html loads mapride.js before maphero.js");
vm.runInContext(fs.readFileSync(W + "mapride.js", "utf8").replace(/^const MAPRIDE =/m, "var MAPRIDE ="), c);
const M = c.MAPRIDE;

// 1) thresholds: walk below 1.1, trot from 1.1, gallop from 2.0; standing still (or a tiny pace) is idle
ok(M.pick(null, false, 2.4) === "idle" && M.pick(null, true, 0) === "idle" && M.pick(null, true, 0.01) === "idle", "idle when not moving");
ok(M.pick(null, true, 0.5) === "walk" && M.pick(null, true, 1.09) === "walk", "walk below the trot line");
ok(M.pick(null, true, 1.1) === "trot" && M.pick(null, true, 1.99) === "trot", "trot from 1.1");
ok(M.pick(null, true, 2.0) === "gallop" && M.pick(null, true, 3.5) === "gallop", "gallop from 2.0");
// 2) hysteresis: going down, a gait holds on until 90% of its own line
ok(M.pick("gallop", true, 1.85) === "gallop" && M.pick("gallop", true, 1.79) === "trot", "gallop holds to 1.8");
ok(M.pick("trot", true, 1.0) === "trot" && M.pick("trot", true, 0.98) === "walk", "trot holds to 0.99");
ok(M.pick("gallop", true, 1.0) === "trot", "a big drop from the gallop still lands in the trot band");
ok(M.pick("walk", true, 1.05) === "walk" && M.pick("trot", true, 1.95) === "trot", "no early step up either");
// the machine over time (the same sequence the screen test checks)
{ const st = {}, out = [];
  for (const [p, t] of [[0, 0], [0.8, 1], [1.5, 2], [2.4, 3], [1.9, 4], [1.7, 5], [1.05, 6], [0.95, 7], [0, 8]]) out.push(M.step(st, { moving: p > 0, pace: p, t, id: "x" }).gait);
  ok(out.join() === "idle,walk,trot,gallop,gallop,trot,trot,walk,idle", "gait sequence " + out.join()); }
// 3) blends: 0.2 s into a new gait, 0.25 s into a stop; the cycle never jumps when the rate changes
{ const st = {}; M.step(st, { moving: true, pace: 0.8, t: 0, id: "b" });
  let r = M.step(st, { moving: true, pace: 1.5, t: 1, id: "b" }); ok(r.gait === "trot" && r.from === "walk" && r.w === 0, "trot starts blending in");
  r = M.step(st, { moving: true, pace: 1.5, t: 1.1, id: "b" }); ok(Math.abs(r.w - 0.5) < 1e-9, "half way at 0.1 s");
  r = M.step(st, { moving: true, pace: 1.5, t: 1.201, id: "b" }); ok(r.w === 1 && r.from === null, "done at 0.2 s");
  r = M.step(st, { moving: false, pace: 0, t: 2, id: "b" }); ok(r.gait === "idle" && r.from === "trot", "stopping blends");
  r = M.step(st, { moving: false, pace: 0, t: 2.2, id: "b" }); ok(r.from === "trot" && Math.abs(r.w - 0.8) < 1e-9, "stopping takes 0.25 s");
  r = M.step(st, { moving: false, pace: 0, t: 2.251, id: "b" }); ok(r.from === null, "stopped"); }
{ const st = {}; let prev = M.step(st, { moving: true, pace: 0.8, t: 0, id: "j" }).c, worst = 0;
  for (let t = 0.02; t < 4; t += 0.02) { const pace = t < 1.5 ? 0.8 : t < 2.5 ? 2.4 : 1.4, c = M.step(st, { moving: true, pace, t, id: "j" }).c; let d = c - prev; if (d < 0) d += 1; worst = Math.max(worst, d); prev = c; }
  ok(worst < 0.06, "the cycle moves smoothly through gait changes (biggest step " + worst.toFixed(3) + ")"); }
// the cadence follows the pace a little, within ±20%
{ const per = (pace) => { const st = {}; M.step(st, { moving: true, pace, t: 0, id: "r" }); return M.step(st, { moving: true, pace, t: 0.1, id: "r" }).c; };
  ok(per(2.4) > per(2.0) && per(3.5) / per(2.4) <= 1.2 + 1e-9, "faster pace, quicker gallop, capped"); }
// 4) phase offsets: each horse has its own, stable, in 0..1, so a party of 8 doesn't move in lockstep
{ const ids = ["me", "o:Kacper", "o:Lydia", "o:Aela", "o:Faendal", "o:Borgakh", "o:Jenassa", "o:Mjoll"], offs = ids.map(M.offset);
  ok(offs.every((o) => o >= 0 && o < 1) && M.offset("me") === M.offset("me"), "offsets in 0..1 and stable");
  ok(new Set(offs.map((o) => o.toFixed(3))).size === 8, "8 riders, 8 different phases");
  const s = offs.slice().sort((a, b) => a - b); let gap = 0; for (let i = 1; i < s.length; i++) gap = Math.max(gap, s[i] - s[i - 1]);
  ok(gap < 0.5, "phases spread round the cycle");
  const a = {}, b = {}; ok(M.step(a, { moving: true, pace: 2.4, t: 5, id: "me" }).c !== M.step(b, { moving: true, pace: 2.4, t: 5, id: "o:Kacper" }).c, "two riders at the same moment are at different points"); }
// 5) key poses: the asked-for counts, no NaN, stance hooves on the ground, the gallop's moment in the air
ok(M.KEYS.idle.length === 3 && M.KEYS.walk.length === 8 && M.KEYS.trot.length === 4 && M.KEYS.gallop.length === 6, "3 / 8 / 4 / 6 key poses");
ok(M.GAITS.idle.per === 2.8 && M.GAITS.walk.per === 1.1 && M.GAITS.trot.per === 0.65 && M.GAITS.gallop.per === 0.45, "cycle lengths");
for (const g of ["idle", "walk", "trot", "gallop"]) {
  let air = 0, minDown = 4, maxDown = 0;
  for (let i = 0; i < 200; i++) {
    const P = M.pose(g, i / 200), hv = M.hooves(P);
    ok(Object.values(P).every((v) => typeof v === "string" || (Array.isArray(v) ? v.every(isFinite) : isFinite(v))), "pose finite " + g);
    const down = hv.filter((h) => h === 0).length; if (!down) air++; minDown = Math.min(minDown, down); maxDown = Math.max(maxDown, down);
    ok(hv.every((h) => h <= 0), "hooves never below the ground " + g);
  }
  if (g === "gallop") ok(air > 0 && air < 60, "the gallop has a short moment with all four hooves up (" + air + "/200)");
  else if (g === "trot") ok(air < 40, "trot: only a brief float between the diagonal pairs (" + air + "/200)");
  else ok(air === 0, g + ": always a hoof on the ground");
  if (g === "walk") ok(minDown >= 2, "walking: at least two hooves down");
  if (g === "trot") ok(maxDown <= 2 + 0 && minDown >= 0, "trot: diagonal pairs");
  if (g !== "idle") ok(maxDown > minDown, g + ": hooves lift and land");
}
ok(Math.abs(M.pose("walk", 0.3).bob) < 1 && Math.abs(M.pose("gallop", 0.1).bob - M.pose("gallop", 0.6).bob) > 1, "the gallop rocks more than the walk");
ok(M.pose("gallop", 0.2).lean > M.pose("walk", 0.2).lean, "the rider leans forward at the gallop");
// stance hooves slide back with the ground (no skating): x falls steadily while down
{ const G = M.GAITS.walk, xs = []; for (let i = 0; i < 10; i++) xs.push(M.pose("walk", (G.land.nh + i * G.duty / 12) % 1).nh); ok(xs.every((h, i) => h[1] === 0 && (!i || h[0] < xs[i - 1][0])), "a planted hoof moves back steadily"); }
// blends are in between
{ const a = M.pose("walk", 0.3), b = M.pose("gallop", 0.3), m = M.mix(a, b, 0.5); ok(Math.abs(m.bob - (a.bob + b.bob) / 2) < 1e-9 && m.nf[0] === (a.nf[0] + b.nf[0]) / 2, "mix halves"); }
// 6) drawing: every gait, both ways round, simple or not, a rider or none, reduce motion; no NaN, the label above
{ const g = c.document.createElement("canvas").getContext("2d");
  for (const [moving, pace] of [[false, 0], [true, 0.8], [true, 1.5], [true, 2.4]]) for (const flip of [false, true]) for (const simple of [false, true]) for (const noRider of [false, true]) {
    const st = {}; let r;
    for (let t = 0; t < 1.2; t += 0.1) r = M.mounted(g, 200, 150, 0.6, { coat: "#8a5a3b", st, flip, t, moving, pace, simple, noRider, id: "d" });
    ok(isFinite(r.top) && isFinite(r.head) && r.top < r.head && r.head < 150, "label over the rider");
  }
  for (const coat of ["#8a5a3b", "#2b2724", "#d9d4c8", "#c9a35f", "#b77d52", "rgb(120,80,50)", undefined]) { const T = M.tones(coat); ok(Object.values(T).every((v) => v === null || /^(#|rgb)/.test(v)), "coat tones " + coat); }
  // reduce motion: the same still pose every frame (no bob), while the gait still follows the pace
  const stA = {}, ys = new Set(); let r;
  const real = ctx.translate; const seen = []; ctx.translate = (...a) => { seen.push(a.join()); };
  for (let t = 0; t < 2; t += 0.13) { seen.length = 0; r = M.mounted(g, 200, 150, 0.6, { coat: "#8a5a3b", st: stA, t, moving: true, pace: 2.4, reduce: true, noRider: true, id: "q" }); ys.add(seen.join("|")); }
  ctx.translate = real; delete ctx.translate;
  ok(r.gait === "gallop" && ys.size === 1, "reduce motion: a still horse (" + ys.size + " different frames)"); }
console.log("mapride: " + n + " checks passed · canvas calls " + calls.n);
