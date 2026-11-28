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

// rivers: a river line crossing the route gives one crossing; distance to it is measured in metres
const rv = [[[0.31 * 1000, 0.39 * 700], [0.31 * 1000, 0.42 * 700]]];   // a north-south river at x = 0.31 (map px)
const segs = R.riverSegs(rv, P.pts[0].x, P.pts[0].z, 400);
ok(segs.length === 1, "river line found near the route");
const cr = R.crossings(P, segs);
ok(cr.length === 1 && Math.abs(cr[0].x - 0.31 * 1000 * R.S) < 1, "one crossing where the road meets the river");
ok(Math.abs(R.riverDist(segs, 0.31 * 1000 * R.S + 5, 0.40 * 700 * R.S) - 5) < 0.01, "distance to the river in metres");
ok(R.riverSegs(rv, 0, 0, 50).length === 0, "far rivers are skipped");
// near() is exact and the same from anywhere: compare with a brute-force scan
let bad = 0;
for (let k = 0; k < 300; k++) {
  const x = P.pts[0].x - 200 + R.rand(k, 1, 9) * (P.len + 400), z = P.pts[0].z - 200 + R.rand(k, 2, 9) * 400;
  let bi = 0, bd = Infinity; P.pts.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bi = i; } });
  if (R.near(P, x, z).i !== bi || R.near(P, x, z, 0).i !== bi) bad++;
}
ok(bad === 0, `near() matches a full scan for 300 random points (${bad} differ)`);
// far from the road too (the fast path for points a long way off)
let badFar = 0;
for (let k = 0; k < 40; k++) {
  const x = P.pts[0].x + (R.rand(k, 3, 9) - 0.5) * 8000, z = P.pts[0].z + (R.rand(k, 4, 9) - 0.5) * 8000;
  let bi = 0, bd = Infinity; P.pts.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bi = i; } });
  if (R.near(P, x, z).i !== bi) badFar++;
}
ok(badFar === 0, `near() is exact far from the road too (${badFar} differ)`);
// straight across bridges: a bending route gets a straight, level stretch over the crossing
const bend = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * 1.2; bend.push([0.5 + Math.sin(a) * 0.03, 0.5 - Math.cos(a) * 0.04 + 0.04]); }
const PB = R.profile(bend, () => 0.2), mid2 = PB.pts[Math.floor(PB.pts.length / 2)];
const br = R.straighten(PB, [{ s: mid2.s, x: mid2.x, z: mid2.z }]);
ok(br.length === 1 && Number.isFinite(br[0].tx), "straighten returns the bridge with its direction");
let dev = 0; for (const p of PB.pts) if (Math.abs(p.s - br[0].s) < 11) dev = Math.max(dev, Math.abs((p.x - br[0].x) * -br[0].tz + (p.z - br[0].z) * br[0].tx));
ok(dev < 0.15, `the road is straight across the bridge (off by ${dev.toFixed(3)} m)`);
ok(PB.pts.every((p) => [p.x, p.z, p.s, p.tx, p.tz].every(Number.isFinite)), "no NaN after straightening");
console.log(fails ? `${fails} FAILED of ${n}` : `dioramaroute: all ok · ${n} checks`);
process.exit(fails ? 1 : 0);
