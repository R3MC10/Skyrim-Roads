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
     DIOROUTE.near(prof, x, z)         → { i, s, d, side, y }: the closest road point (d metres away; side +1 = left of travel), exact
     DIOROUTE.at(prof, s)              → the road point at distance s (interpolated)
     DIOROUTE.land(prof, x, z, hFn, hint) → ground height in metres: the map's land, pulled onto the road's shelf near it
     DIOROUTE.riverSegs(rivers, cx, cz, r) → river lines near a point as world segments · riverDist(segs, x, z)
     DIOROUTE.crossings(prof, segs)    → where the road crosses a river: [{ s, x, z }] (a bridge goes there)
     DIOROUTE.straighten(prof, cross)  → pulls the road straight and level across each crossing; → bridges [{ s, x, z, tx, tz, len }]
     DIOROUTE.rand(a, b, salt)         → 0..1, the same every time for the same cell (so a stretch of road always grows
                                         the same trees, on every trip and for everyone in a party)
   Pure functions, no DOM: tests/test_dioramaroute.js. */
const DIOROUTE = (() => {
  const MW = 1000, MH = 700;
  const S = 3.5, HS = 70, GRADE = 0.1, STEP = 2, SMOOTH_XZ = 6, SMOOTH_Y = 60, RELIEF = 0.45;
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

  /* the closest road point, exact for any point (a bucket grid of the road points, searched ring by ring), so the
     answer never depends on where you are: the same spot always gets the same tree, height and side of the road.
     (The old hint argument is ignored.) */
  const GB = 24;
  function grid(prof) {
    if (prof._g) return prof._g;
    const g = new Map();
    prof.pts.forEach((p, i) => { const k = Math.floor(p.x / GB) + "," + Math.floor(p.z / GB); let a = g.get(k); if (!a) g.set(k, (a = [])); a.push(i); });
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of prof.pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    prof._g = { g, x0, x1, z0, z1 }; return prof._g;
  }
  function near(prof, x, z) {
    const P = prof.pts, G = grid(prof), cx = Math.floor(x / GB), cz = Math.floor(z / GB);
    // how far out the road can possibly be: the ring count to reach its bounding box
    const reach = Math.ceil(Math.max(G.x0 - x, x - G.x1, G.z0 - z, z - G.z1, 0) / GB) + 1;
    let best = 0, bd = Infinity;
    for (let r = 0; r < 100000; r++) {
      if (r > reach && bd <= ((r - 1) * GB) ** 2) break;   // nothing in a further ring can be closer
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const a = G.g.get((cx + i) + "," + (cz + j)); if (!a) continue;
        for (const k of a) { const d = (P[k].x - x) ** 2 + (P[k].z - z) ** 2; if (d < bd || (d === bd && k < best)) { bd = d; best = k; } }
      }
      if (r > reach + 400) break;
    }
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
    h = road.h + (h - road.h) * RELIEF;                             // the land's rise and fall beside the road, toned down
    const base = h + delta * sm(4, 44, r.d);                       // the land, shifted with the road and easing back
    return base + (road.y - base) * sm(4, 12, r.d);                // a flat shelf right by the road
  }
  /* rivers near (cx, cz): the map's river lines (Terrain.rivers, map pixels) as world segments within r metres */
  function riverSegs(rivers, cx, cz, r) {
    const out = [];
    for (const line of rivers || []) for (let i = 1; i < line.length; i++) {
      const ax = line[i - 1][0] * S, az = line[i - 1][1] * S, bx = line[i][0] * S, bz = line[i][1] * S;
      const mx = Math.max(Math.abs((ax + bx) / 2 - cx) - Math.abs(bx - ax) / 2, 0), mz = Math.max(Math.abs((az + bz) / 2 - cz) - Math.abs(bz - az) / 2, 0);
      if (mx < r && mz < r) out.push([ax, az, bx, bz]);
    }
    return out;
  }
  function segDist(sg, x, z) {
    const [ax, az, bx, bz] = sg, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, u = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
    return Math.hypot(x - (ax + dx * u), z - (az + dz * u));
  }
  const riverDist = (segs, x, z) => { let d = Infinity; for (const sg of segs) d = Math.min(d, segDist(sg, x, z)); return d; };
  /* where the road crosses a river: [{ s, x, z }] along the profile (bridges go there) */
  function crossings(prof, segs) {
    const out = [], P = prof.pts;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i];
      for (const [cx, cz, dx2, dz2] of segs) {
        const r = b.x - a.x, s2 = b.z - a.z, q = dx2 - cx, w = dz2 - cz, den = r * w - s2 * q;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((cx - a.x) * w - (cz - a.z) * q) / den, u = ((cx - a.x) * s2 - (cz - a.z) * r) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) { const sAt = a.s + (b.s - a.s) * t; if (!out.some((o) => Math.abs(o.s - sAt) < 12)) out.push({ s: sAt, x: a.x + r * t, z: a.z + s2 * t }); }
      }
    }
    return out;
  }
  /* roads run straight across bridges: around each crossing the line is pulled onto the straight chord through it
     (H metres each way, easing back over 10 m), then distances and directions are worked out again. Returns the
     bridges: [{ s, x, z, tx, tz }] (centre, along the road). */
  function straighten(prof, cross, H = 12) {
    const P = prof.pts, out = [];
    for (const c of cross) {
      const a = at(prof, c.s - H), b = at(prof, c.s + H), L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      for (const p of P) {
        const off = Math.abs(p.s - c.s); if (off > H + 10) continue;
        const w0 = off <= H ? 1 : 1 - (off - H) / 10, w = w0 * w0 * (3 - 2 * w0);
        const u = clamp((p.s - (c.s - H)) / (2 * H), 0, 1);
        p.x += (a.x + (b.x - a.x) * u - p.x) * w; p.z += (a.z + (b.z - a.z) * u - p.z) * w;
        if (off <= H) p.y = a.y + (b.y - a.y) * u;   // and level with the deck
      }
      out.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, tx: (b.x - a.x) / L, tz: (b.z - a.z) / L, len: L });
    }
    let s = 0;
    P.forEach((p, i) => { if (i) s += Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z); p.s = s; });
    P.forEach((p, i) => { const a = P[Math.max(0, i - 2)], b = P[Math.min(P.length - 1, i + 2)], L = Math.hypot(b.x - a.x, b.z - a.z) || 1; p.tx = (b.x - a.x) / L; p.tz = (b.z - a.z) / L; });
    prof.len = s; prof._g = null;
    out.forEach((o) => { o.s = near(prof, o.x, o.z).s; });
    return out;
  }
  function rand(a, b, salt = 0) {
    let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(salt | 0, 83492791)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  return { S, HS, GRADE, RELIEF, STEP, toWorld, toMap, profile, near, at, land, rand, riverSegs, riverDist, crossings, straighten };
})();
if (typeof module !== "undefined") module.exports = DIOROUTE;
