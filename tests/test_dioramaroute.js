// The diorama road (game/dioramaroute.js): smooth, believable slopes from any map, the same scenery every time.
//   node test_dioramaroute.js
const path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const R = require(W + "dioramaroute.js");
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("FAIL " + m); } };

// a zig-zag grid route over a very steep map (a cliff of 0.8 height units over 10 map pixels)
const route = [];
for (let i = 0; i <= 60; i++) route.push([0.30 + i * 0.002, 0.40 + (i % 2) * 0.0015]);
const steep = (p) => Math.max(0, Math.min(1, (p[0] - 0.35) * 40));
const P = R.profile(route, steep);
ok(P && P.pts.length > 50, "a profile is built");
ok(P.pts.every((p) => [p.x, p.z, p.y, p.s, p.tx, p.tz].every(Number.isFinite)), "no NaN anywhere");
let worst = 0;
for (let i = 1; i < P.pts.length; i++) { const a = P.pts[i - 1], b = P.pts[i], run = b.s - a.s; if (run > 0.01) worst = Math.max(worst, Math.abs(b.y - a.y) / run); }
ok(worst <= R.GRADE + 1e-6, `the road never climbs steeper than 1 in 10 (worst ${worst.toFixed(3)})`);
ok(P.pts[P.pts.length - 1].y > 10, "a real climb still climbs");
// the grid's zig-zag is smoothed out: the sideways wobble is small
const zs = P.pts.slice(10, -10).map((p) => p.z), wob = Math.max(...zs) - Math.min(...zs);
ok(wob < 4, `the map grid's steps are smoothed (wobble ${wob.toFixed(2)} m)`);
// near / at agree
const mid = P.pts[Math.floor(P.pts.length / 2)];
const nr = R.near(P, mid.x + 0.3, mid.z + 5);
ok(Math.abs(nr.d - 5) < 1, "near finds the road ~5 m away");
const a = R.at(P, mid.s);
ok(Math.hypot(a.x - mid.x, a.z - mid.z) < 0.5, "at(s) returns the point at that distance");
// the ground meets the road and eases back to the land
const g0 = R.land(P, mid.x, mid.z + 1, steep), g1 = R.land(P, mid.x, mid.z + 80, steep);
ok(Math.abs(g0 - mid.y) < 0.6, "the ground sits at road height right by the road");
ok(Number.isFinite(g1), "the ground far from the road is defined");
// the same cell gives the same scenery, different cells differ
ok(R.rand(10, 20, 1) === R.rand(10, 20, 1), "seeded: same cell, same value");
const vals = new Set(); for (let i = 0; i < 200; i++) vals.add(Math.floor(R.rand(i, i * 7, 3) * 10));
ok(vals.size === 10, "seeded values spread over 0..1");
// a two-point route and junk input
ok(R.profile([[0.5, 0.5], [0.51, 0.5]], () => 0).pts.length > 3, "a short route works");
ok(R.profile([[0.5, 0.5]], () => 0) === null && R.profile(null, () => 0) === null, "no route: null");
ok(R.profile([[0.5, 0.5], [0.6, 0.5]], () => { throw new Error("x"); }).pts.every((p) => p.y === 0), "a failing height lookup is flat ground");

console.log(fails ? `${fails} FAILED of ${n}` : `dioramaroute: all ok · ${n} checks`);
process.exit(fails ? 1 : 0);
