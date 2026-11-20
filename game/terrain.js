/* Terrain: what the ground is at every point, how fast you cross it, and route-finding that prefers roads.
   Built once from WORLD (deterministic), used by the engine (travel) and the map (painting). */
const Terrain = (() => {
  const GW = 250, GH = 175, MW = 1000, MH = 700;             // grid cells are 4×4 map pixels
  const T = { SEA: 0, LAKE: 1, RIVER: 2, ROAD: 3, BRIDGE: 4, GRASS: 5, TUNDRA: 6, FOREST: 7, PINE: 8, AUTUMN: 9,
    MARSH: 10, SNOW: 11, VOLCANIC: 12, ROCKY: 13, MOUNTAIN: 14, PEAK: 15 };
  const NAMES = ["Sea", "Lake", "River (ford)", "Road", "Bridge", "Grassland", "Tundra", "Forest", "Pine forest", "Autumn forest",
    "Marsh", "Snow", "Volcanic tundra", "Rocky hills", "Mountains", "High peaks"];
  // [OURS] how fast you cross each kind of ground (1 = open grassland)
  const SPEED = [0, 0, 0.25, 1.3, 1.3, 1, 1, 0.8, 0.75, 0.8, 0.55, 0.7, 0.9, 0.7, 0.4, 0.12];

  // ---- deterministic value noise
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const smooth = (t) => t * t * (3 - 2 * t);
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }
  function fbm(x, y, oct = 4) { let v = 0, amp = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5; } return v; }

  // ---- geometry helpers (in map pixels, so distances aren't squashed by the 10:7 shape)
  const px = (p) => [p[0] * MW, p[1] * MH];
  function segDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function lineDist(p, pts) { let d = 1e9; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(p, pts[i - 1], pts[i])); return d; }
  function inPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const W = WORLD;
  const land = [...W.coast.map(px), [MW, MH], [0, MH]];
  const ranges = W.ranges.map((r) => ({ pts: r.pts.map(px), w: r.w * MW, h: r.h }));
  const rivers = W.rivers.map((r) => r.pts.map(px));
  const roads = W.roads.map((chain) => chain.map((c) => px(typeof c === "string" ? W.places[c] : c)));

  /* height 0..1+ at a map-pixel point (mountains + gentle noise) */
  function heightAt(p) {
    let h = 0;
    for (const r of ranges) {
      const d = lineDist(p, r.pts) / r.w;
      if (d < 2.5) h = Math.max(h, r.h * Math.exp(-d * d * 1.6) * (0.75 + 0.5 * fbm(p[0] / 60, p[1] / 60, 3)));
    }
    return h + 0.12 * fbm(p[0] / 90 + 7, p[1] / 90 + 3, 4);
  }
  /* what kind of ground (ignoring roads/rivers) */
  function baseType(p, h) {
    if (h > 0.78) return T.PEAK;
    if (h > 0.5) return T.MOUNTAIN;
    const n = fbm(p[0] / 50 + 11, p[1] / 50 + 5, 3) - 0.5;
    let t = T.GRASS;
    for (const [cx, cy, rx, ry, kind] of W.regions) {
      const v = 1 - ((p[0] - cx * MW) / (rx * MW)) ** 2 - ((p[1] - cy * MH) / (ry * MH)) ** 2 + n * 1.1;
      if (v > 0) t = { tundra: T.TUNDRA, forest: T.FOREST, rocky: T.ROCKY, marsh: T.MARSH, volcanic: T.VOLCANIC, pine: T.PINE, autumn: T.AUTUMN }[kind];
    }
    if (p[1] < (W.snowLine + n * 0.06) * MH && t !== T.MARSH && t !== T.FOREST) t = T.SNOW;
    return t;
  }
  function typeAt(p) {
    if (!inPoly(p, land)) return T.SEA;
    for (const [cx, cy, rx, ry] of W.lakes) if (((p[0] - cx * MW) / (rx * MW)) ** 2 + ((p[1] - cy * MH) / (ry * MH)) ** 2 < 1) return T.LAKE;
    return baseType(p, heightAt(p));
  }

  // ---- the grid
  const grid = new Uint8Array(GW * GH);
  const hgrid = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const p = [(x + 0.5) * 4, (y + 0.5) * 4];
    grid[y * GW + x] = typeAt(p);
    hgrid[y * GW + x] = heightAt(p);
  }
  // roads and rivers are drawn onto the grid (rivers first, roads over them become bridges)
  function stamp(lines, fn) {
    for (const pts of lines) for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k], n = Math.ceil(Math.hypot(bx - ax, by - ay) / 1.5);
      for (let j = 0; j <= n; j++) {
        const x = Math.floor((ax + (bx - ax) * j / n) / 4), y = Math.floor((ay + (by - ay) * j / n) / 4);
        if (x >= 0 && y >= 0 && x < GW && y < GH) fn(y * GW + x);
      }
    }
  }
  stamp(rivers, (i) => { if (grid[i] !== T.SEA && grid[i] !== T.LAKE) grid[i] = T.RIVER; });
  stamp(roads, (i) => { grid[i] = grid[i] === T.RIVER || grid[i] === T.LAKE ? T.BRIDGE : T.ROAD; });
  // every place stands on walkable ground
  for (const [x, y] of Object.values(W.places)) {
    const gx = Math.floor(x * GW), gy = Math.floor(y * GH);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const i = (gy + dy) * GW + gx + dx;
      if (grid[i] <= T.RIVER || grid[i] === T.PEAK) grid[i] = T.GRASS;
    }
  }
  const cellOf = (pos) => [Math.max(0, Math.min(GW - 1, Math.floor(pos[0] * GW))), Math.max(0, Math.min(GH - 1, Math.floor(pos[1] * GH)))];
  const typeAtPos = (pos) => { const [x, y] = cellOf(pos); return grid[y * GW + x]; };
  const speedAt = (pos) => SPEED[typeAtPos(pos)] || 0.2;

  // ---- A* route (8 directions), cost = distance / speed
  function route(from, to) {
    const [sx, sy] = cellOf(from), [tx, ty] = cellOf(to);
    const start = sy * GW + sx, goal = ty * GW + tx;
    const g = new Float64Array(GW * GH).fill(Infinity), came = new Int32Array(GW * GH).fill(-1);
    const heap = [], push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const H = (i) => Math.hypot(i % GW - tx, Math.floor(i / GW) - ty) / 1.3;
    g[start] = 0; push(H(start), start);
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length) {
      const [f0, i] = pop();
      if (i === goal) break;
      if (f0 > g[i] + H(i) + 1e-9) continue;   // stale entry
      const x = i % GW, y = (i / GW) | 0;
      for (const [dx, dy, len] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx, sp = SPEED[grid[j]];
        if (!sp && j !== goal) continue;
        const ng = g[i] + len * 2 / ((sp || 0.2) + (SPEED[grid[i]] || 0.2));
        if (ng < g[j]) { g[j] = ng; came[j] = i; push(ng + H(j), j); }
      }
    }
    if (!isFinite(g[goal])) return [from, to];
    const cells = [];
    for (let i = goal; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    // keep corners only (where direction changes), in 0..1 map coords
    const pts = [from];
    for (let k = 1; k < cells.length - 1; k++) {
      const a = cells[k - 1], b = cells[k], c = cells[k + 1];
      if (b - a !== c - b) pts.push([((b % GW) + 0.5) / GW, (Math.floor(b / GW) + 0.5) / GH]);
    }
    pts.push(to);
    return pts;
  }

  // ---- moving along a path. dist in map pixels; base = map pixels per second on open ground
  const pd = (a, b) => Math.hypot((a[0] - b[0]) * MW, (a[1] - b[1]) * MH);
  /* advance {pos, idx} along path for `seconds`; returns new {pos, idx, done} (doesn't mutate) */
  function moveAlong(path, idx, pos, seconds, base) {
    pos = [...pos];
    let left = seconds;
    while (left > 1e-6 && idx < path.length - 1) {
      const next = path[idx + 1], d = pd(pos, next);
      if (d < 1e-6) { idx++; continue; }
      const v = base * speedAt(pos);                     // px per second here
      const step = Math.min(d, v * Math.min(left, 4 / Math.max(v, 1e-6) + 0.0));   // ≤ 4 px at a time so terrain changes count
      const f = step / d;
      pos = [pos[0] + (next[0] - pos[0]) * f, pos[1] + (next[1] - pos[1]) * f];
      left -= step / v;
      if (step >= d - 1e-9) { pos = [...next]; idx++; }
    }
    return { pos, idx, done: idx >= path.length - 1 };
  }
  /* seconds to walk from pos (on segment idx) to the end */
  function secondsLeft(path, idx, pos, base) {
    let s = 0, cur = pos;
    for (let k = idx + 1; k < path.length; k++) {
      const nx = path[k], d = pd(cur, nx), n = Math.max(1, Math.ceil(d / 8));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n, p = [cur[0] + (nx[0] - cur[0]) * t, cur[1] + (nx[1] - cur[1]) * t];
        s += d / n / (base * speedAt(p));
      }
      cur = nx;
    }
    return s;
  }
  return { T, NAMES, SPEED, GW, GH, grid, hgrid, typeAtPos, speedAt, heightAt, typeAt, fbm, vnoise, route, moveAlong, secondsLeft, lineDist, inPoly, land, ranges, rivers, roads };
})();
if (typeof module !== "undefined") module.exports = Terrain;
