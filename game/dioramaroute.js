/* The road under the diorama (dioramaroute.js). [OURS]
   Turns a trip's map route into a walkable 3D road: positions in metres, a smooth line instead of the map grid's steps,
   and heights from the map that stay believable. The map squeezes a long journey into a short ride, so real heights
   over that short distance would make cliffs: heights are scaled down, smoothed over ~120 m and the road's slope is
   capped (DIOROUTE.GRADE, about 1 in 10), so a long climb is a long gentle rise, never a 45° ramp.
     DIOROUTE.S                        metres per map pixel (walking pace on the map ≈ walking pace in the view)
     DIOROUTE.HS                       metres per map height unit (1.0 ≈ the Throat of the World)
     DIOROUTE.GRADE                    the steepest the road may climb (rise / run)
     DIOROUTE.toWorld(p)               map position [0..1, 0..1(or 2..3)] → [x, z] metres
     DIOROUTE.profile(path, hFn)       → { pts: [{ x, z, y, s, tx, tz }], len } every STEP metres along the route;
                                         hFn(mapPos) → map height (0..1+); y is the graded road height in metres
     DIOROUTE.near(prof, x, z, hint)   → { i, s, d, side, y }: the closest road point (d metres away; side +1 = left of travel)
     DIOROUTE.at(prof, s)              → the road point at distance s (interpolated)
     DIOROUTE.land(prof, x, z, hFn, hint) → ground height in metres: the map's land, pulled onto the road's shelf near it
     DIOROUTE.rand(a, b, salt)         → 0..1, the same every time for the same cell (so a stretch of road always grows
                                         the same trees, on every trip and for everyone in a party)
   Pure functions, no DOM: tests/test_dioramaroute.js. */
const DIOROUTE = (() => {
  const MW = 1000, MH = 700;
  const S = 3.5, HS = 70, GRADE = 0.1, STEP = 2, SMOOTH_XZ = 6, SMOOTH_Y = 60;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const toWorld = (p) => [p[0] * MW * S, p[1] * MH * S];
  const toMap = (x, z) => [x / (MW * S), z / (MH * S)];

  /* resample a polyline every STEP metres */
  function resample(pts) {
    const out = [pts[0]];
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az);
      if (L < 1e-6) continue;
      let d = STEP - carry;
      while (d <= L) { out.push([ax + (bx - ax) * d / L, az + (bz - az) * d / L]); d += STEP; }
      carry = L - (d - STEP);
    }
    const last = pts[pts.length - 1], o = out[out.length - 1];
    if (Math.hypot(last[0] - o[0], last[1] - o[1]) > 0.2) out.push(last);
    return out;
  }
  /* moving average over ±n samples, ends held */
  function smooth(arr, n, get, set) {
    const v = arr.map(get), m = v.length, out = new Array(m);
    for (let i = 0; i < m; i++) {
      const k = Math.min(n, i, m - 1 - i); let sum = 0;
      for (let j = i - k; j <= i + k; j++) sum += v[j];
      out[i] = sum / (2 * k + 1);
    }
    arr.forEach((p, i) => set(p, out[i]));
  }

  function profile(path, hFn) {
    if (!Array.isArray(path) || path.length < 2) return null;
    let pts = resample(path.map(toWorld)).map(([x, z]) => ({ x, z }));
    if (pts.length < 2) return null;
    // a smooth line instead of the map grid's steps
    const nXZ = Math.round(SMOOTH_XZ / STEP);
    smooth(pts, nXZ, (p) => p.x, (p, v) => (p.x = v)); smooth(pts, nXZ, (p) => p.z, (p, v) => (p.z = v));
    // distance along, direction of travel
    let s = 0;
    pts.forEach((p, i) => { if (i) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); p.s = s; });
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)], L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      p.tx = (b.x - a.x) / L; p.tz = (b.z - a.z) / L;
    });
    // heights: the map's, scaled and smoothed, then the slope capped both ways
    pts.forEach((p) => { let h = 0; try { h = +hFn(toMap(p.x, p.z)) || 0; } catch { h = 0; } p.h = h * HS; p.y = p.h; });
    smooth(pts, Math.round(SMOOTH_Y / STEP), (p) => p.y, (p, v) => (p.y = v));
    for (let i = 1; i < pts.length; i++) { const run = pts[i].s - pts[i - 1].s; pts[i].y = clamp(pts[i].y, pts[i - 1].y - GRADE * run, pts[i - 1].y + GRADE * run); }
    for (let i = pts.length - 2; i >= 0; i--) { const run = pts[i + 1].s - pts[i].s; pts[i].y = clamp(pts[i].y, pts[i + 1].y - GRADE * run, pts[i + 1].y + GRADE * run); }
    return { pts, len: s };
  }

  /* the closest road point; hint = an index to search around (fast while walking), else a full scan */
  function near(prof, x, z, hint) {
    const P = prof.pts, n = P.length;
    let lo = 0, hi = n - 1;
    if (hint != null && hint >= 0 && hint < n) { lo = Math.max(0, hint - 90); hi = Math.min(n - 1, hint + 90); }
    let best = 0, bd = Infinity;
    for (let i = lo; i <= hi; i++) { const d = (P[i].x - x) ** 2 + (P[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } }
    const p = P[best], dx = x - p.x, dz = z - p.z;
    // project onto the segment for a smooth distance along
    const along = dx * p.tx + dz * p.tz, side = Math.sign(p.tx * dz - p.tz * dx) || 1;
    return { i: best, s: clamp(p.s + along, 0, prof.len), d: Math.sqrt(bd), side, y: p.y };
  }
  function at(prof, s) {
    const P = prof.pts; s = clamp(s, 0, prof.len);
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].s <= s) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], k = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0, L = (u, v) => u + (v - u) * k;
    const tx = L(a.tx, b.tx), tz = L(a.tz, b.tz), tl = Math.hypot(tx, tz) || 1;
    return { x: L(a.x, b.x), z: L(a.z, b.z), y: L(a.y, b.y), s, tx: tx / tl, tz: tz / tl, i: lo };
  }
  /* the ground: the map's land (scaled the same way) with the road cut into it as a shelf. Within 4 m of the road the
     ground is the road's height; further out it eases back to the land over ~40 m, and its slope stays gentle because the
     heights are scaled down. */
  function land(prof, x, z, hFn, hint) {
    const r = near(prof, x, z, hint);
    let h = 0; try { h = (+hFn(toMap(x, z)) || 0) * HS; } catch { h = 0; }
    const road = prof.pts[r.i], delta = road.y - road.h;           // how far the road was lifted or cut here
    const sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return 1 - t * t * (3 - 2 * t); };
    const base = h + delta * sm(4, 44, r.d);                       // the land, shifted with the road and easing back
    return base + (road.y - base) * sm(4, 12, r.d);                // a flat shelf right by the road
  }
  function rand(a, b, salt = 0) {
    let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(salt | 0, 83492791)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  return { S, HS, GRADE, STEP, toWorld, toMap, profile, near, at, land, rand };
})();
if (typeof module !== "undefined") module.exports = DIOROUTE;
