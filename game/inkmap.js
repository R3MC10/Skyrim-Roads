/* inkmap.js: the close-up ink chart under the painted world map. [OURS]
   The painting (map-world.webp, 2000×1400) only has so many pixels: blown up past ~1.3× it turns soft. So map.js
   never draws it bigger than that (PAINT_MAX). Zoomed in further the painting fades out and this takes over:
   - a watercolour wash: the painting shrunk to a quarter of its width and blurred, so the colours still match it (a soft colour
     field on purpose, never the painting stretched)
   - hand-inked detail drawn as vectors at the real screen resolution, so it is sharp at any zoom and any screen:
     hill hachures from the height field, pines, autumn trees, reeds, rocks and peaks per terrain cell (more and smaller
     the closer you zoom), coastline, lake shores, rivers and the border, a fine paper grain.
   Drawn in tiles of 256 device pixels per half-step of zoom, cached (LRU), a few new tiles per frame; tiles of the
   previous zoom step cover the gaps while new ones are inked. The same seed everywhere, so every player sees the same
   chart. map.js calls draw(); ui.js keeps the map redrawing while pending() (tiles still to ink). */
const INKMAP = (() => {
  const W = 1000, H = 700, TILE = 256, CELL = 4, MAX_TILES = 260, BUDGET_MS = 9;
  const hash = (a, b, c = 0) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  // ---------------------------------------------------------------- the wash (from the painting's own colours)
  let wash = null, washSrc = null;
  function washOf(img) {
    if (wash && washSrc === img) return wash;
    const half = mk(W, H), hg = half.getContext("2d"); hg.imageSmoothingEnabled = true; hg.imageSmoothingQuality = "high"; hg.drawImage(img, 0, 0, W, H);
    const q = mk(W / 2, H / 2), qg = q.getContext("2d"); qg.imageSmoothingEnabled = true; qg.imageSmoothingQuality = "high";
    try { qg.filter = "blur(1.6px) saturate(0.9)"; } catch { /* no filters: plain shrink */ }
    qg.drawImage(half, 0, 0, q.width, q.height);
    wash = q; washSrc = img;
    return wash;
  }

  // ---------------------------------------------------------------- vector features, built once
  let F = null;
  function features() {
    if (F) return F;
    const P = (p) => [p[0] * W, p[1] * H];
    const path = (pts, close) => { const p = new Path2D(); pts.forEach((q, i) => { const [x, y] = P(q); i ? p.lineTo(x, y) : p.moveTo(x, y); }); if (close) p.closePath(); return p; };
    const coast = WORLD.coast ? path(WORLD.coast) : null;
    const lakes = (WORLD.lakePolys || []).map((pl) => path(pl, true));
    const rivers = (WORLD.rivers || []).map((rv) => rv.pts.map(P));
    let border = null;
    if (typeof Terrain !== "undefined" && Terrain.border && Terrain.border.length) { border = new Path2D(); Terrain.border.forEach(([x, y], i) => (i ? border.lineTo(x, y) : border.moveTo(x, y))); border.closePath(); }
    // slope per cell, light from the north-west: + = facing away (shadow side)
    const GW = Terrain.GW, GH = Terrain.GH, hg = Terrain.hgrid, slope = new Float32Array(GW * GH), dir = new Float32Array(GW * GH);
    for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
      const i = y * GW + x, dx = hg[i + 1] - hg[i - 1], dy = hg[i + GW] - hg[i - GW];
      slope[i] = clamp((dx + dy) * 9, -1, 1) * clamp((hg[i] - 0.16) * 2.6, 0, 1);
      dir[i] = Math.atan2(dy, dx);   // downhill is the other way: hachures run along the fall line
    }
    F = { coast, lakes, rivers, border, slope, dir };
    return F;
  }

  // ---------------------------------------------------------------- one tile
  /* lv: zoom step (device px per map unit = 2^(lv/2)); tx, ty: tile index; dpr: device pixels per CSS pixel */
  function renderTile(lv, tx, ty, dpr) {
    const ks = Math.pow(2, lv / 2), P = ks / dpr, px = dpr / ks;   // P: CSS px per map unit; px: map units per CSS px
    const c = mk(TILE, TILE), g = c.getContext("2d");
    const span = TILE / ks, x0 = tx * span, y0 = ty * span, x1 = x0 + span, y1 = y0 + span;
    const f = features(), T = Terrain.T, GW = Terrain.GW, GH = Terrain.GH, grid = Terrain.grid, hgr = Terrain.hgrid;
    g.setTransform(ks, 0, 0, ks, -x0 * ks, -y0 * ks);
    g.lineCap = "round"; g.lineJoin = "round";
    // ---- per terrain cell: hachures, then glyphs (back to front by row)
    const pad = 9;   // glyphs reach a little past their cell
    const cx0 = Math.max(0, Math.floor((x0 - pad) / CELL)), cx1 = Math.min(GW - 1, Math.floor((x1 + pad) / CELL));
    const cy0 = Math.max(0, Math.floor((y0 - pad) / CELL)), cy1 = Math.min(GH - 1, Math.floor((y1 + pad * 3) / CELL));
    const dens = clamp(Math.round((P * P) / 7), 1, 6);   // more, smaller marks the closer you look
    // hachures: short ink strokes down the shadowed slopes
    const hn = clamp(Math.round(P / 2.6), 1, 5), hlen = clamp(2.4 * P, 5, 11) * px;
    g.strokeStyle = "rgba(52,36,22,.5)"; g.lineWidth = 0.7 * px;
    g.beginPath();
    for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) {
      const i = y * GW + x, s = f.slope[i], t = grid[i];
      if (s < 0.14 || t === T.SEA || t === T.LAKE || t === T.BEYOND) continue;
      const a = f.dir[i];
      for (let k = 0; k < hn; k++) {
        if (hash(x, y, k + 40) > s * 1.6) continue;
        const sx = x * CELL + hash(x, y, k) * CELL, sy = y * CELL + hash(x, y, k + 9) * CELL, L = hlen * (0.6 + s * 0.6);
        g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * L, sy + Math.sin(a) * L);
      }
    }
    g.stroke();
    // the lands beyond Skyrim: light diagonal hatching
    g.strokeStyle = "rgba(60,44,28,.22)"; g.lineWidth = 0.6 * px; g.beginPath();
    const step = clamp(7 * px, 1.2, 6);
    for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) {
      if (grid[y * GW + x] !== T.BEYOND) continue;
      const bx = x * CELL, by = y * CELL;
      for (let d = -CELL; d < CELL; d += step) { const ax = Math.max(bx, bx + d), ay = by + Math.max(0, -d), bx2 = Math.min(bx + CELL, bx + CELL + d), by2 = by + CELL - Math.max(0, d); g.moveTo(ax, ay); g.lineTo(bx2, by2); }
    }
    g.stroke();
    // sea: a few wave strokes
    g.strokeStyle = "rgba(200,222,230,.28)"; g.lineWidth = 0.7 * px; g.beginPath();
    for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) {
      if (grid[y * GW + x] !== T.SEA || hash(x, y, 3) > 0.16) continue;
      const sx = x * CELL + hash(x, y, 4) * CELL, sy = y * CELL + hash(x, y, 5) * CELL, L = clamp(3 * P, 6, 12) * px;
      g.moveTo(sx, sy); g.quadraticCurveTo(sx + L / 2, sy - L * 0.3, sx + L, sy);
    }
    g.stroke();
    // glyphs
    const ink = "rgba(30,22,14,.88)", lw = 0.85 * px;
    for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) {
      const i = y * GW + x, t = grid[i], h = hgr[i];
      let prob = 0, kind = "";
      if (t === T.PINE) { kind = "pine"; prob = 0.55; } else if (t === T.FOREST) { kind = "pine"; prob = 0.42; }
      else if (t === T.AUTUMN) { kind = "round"; prob = 0.42; } else if (t === T.SNOW) { kind = "snowpine"; prob = 0.07; }
      else if (t === T.MARSH) { kind = "reed"; prob = 0.3; } else if (t === T.ROCKY) { kind = "rock"; prob = 0.14; }
      else if (t === T.TUNDRA || t === T.GRASS) { kind = "tuft"; prob = 0.13; }
      else if (t === T.VOLCANIC) { kind = "rock"; prob = 0.1; }
      else if (t === T.MOUNTAIN || t === T.PEAK) { kind = "peak"; prob = 0.05 + h * 0.07; }
      if (!kind) continue;
      const n = kind === "peak" ? clamp(Math.round(dens / 3), 1, 2) : dens;
      for (let k = 0; k < n; k++) {
        if (hash(x, y, k * 3 + 1) > prob) continue;
        const gx = x * CELL + hash(x, y, k * 3 + 2) * CELL, gy = y * CELL + hash(x, y, k * 3 + 3) * CELL, r = hash(x, y, k + 77);
        glyph(g, kind, gx, gy, P, px, lw, ink, t === T.PINE, h, r);
      }
    }
    // ---- water and edges, as ink lines
    if (f.lakes.length) {
      for (const lp of f.lakes) { g.strokeStyle = "rgba(220,236,240,.35)"; g.lineWidth = 2.2 * px; g.stroke(lp); g.strokeStyle = ink; g.lineWidth = 1.1 * px; g.stroke(lp); }
    }
    for (const pts of f.rivers) {
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        if (Math.max(ax, bx) < x0 - 8 || Math.min(ax, bx) > x1 + 8 || Math.max(ay, by) < y0 - 8 || Math.min(ay, by) > y1 + 8) continue;
        const w = clamp((1.4 + 2.6 * i / pts.length) * P * 0.45, 1.2, 4.5) * px;
        g.strokeStyle = "rgba(28,40,44,.75)"; g.lineWidth = w + 1.2 * px; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        g.strokeStyle = "#6d9fb0"; g.lineWidth = w; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      }
    }
    if (f.border) {
      g.save(); g.strokeStyle = "rgba(40,28,18,.7)"; g.lineWidth = 1.3 * px; g.stroke(f.border);
      g.setLineDash([5 * px, 3.5 * px]); g.strokeStyle = "rgba(150,48,36,.75)"; g.lineWidth = 1 * px; g.translate(0, 2.2 * px); g.stroke(f.border); g.restore();
    }
    if (f.coast) {
      g.strokeStyle = "rgba(210,228,234,.3)"; g.lineWidth = 0.7 * px;
      for (let k = 1; k <= 2; k++) { g.save(); g.translate(0, -k * 3.5 * px); g.stroke(f.coast); g.restore(); }
      g.strokeStyle = ink; g.lineWidth = 1.6 * px; g.stroke(f.coast);
    }
    // ---- paper grain, in device pixels: crisp at every zoom
    g.setTransform(1, 0, 0, 1, 0, 0);
    const n = 260;
    for (let i = 0; i < n; i++) {
      const sx = hash(tx * 13 + i, ty * 7 - i, lv) * TILE, sy = hash(ty * 11 - i, tx * 5 + i, lv + 1) * TILE;
      g.fillStyle = i % 3 ? "rgba(60,42,24,.07)" : "rgba(255,248,230,.09)"; g.fillRect(sx, sy, dpr, dpr);
    }
    return c;
  }
  /* one hand-inked mark; P: CSS px per map unit, px: map units per CSS px */
  function glyph(g, kind, x, y, P, px, lw, ink, dark, h, r) {
    g.lineWidth = lw; g.strokeStyle = ink;
    if (kind === "pine" || kind === "snowpine") {
      const s = clamp(3.6 * P, 6, 15) * px * (0.8 + r * 0.4);
      g.fillStyle = kind === "snowpine" ? "#e9eef0" : dark ? "rgba(46,72,44,.9)" : "rgba(64,92,52,.88)";
      g.beginPath(); g.moveTo(x - s * 0.42, y + s * 0.55); g.lineTo(x, y - s * 0.75); g.lineTo(x + s * 0.42, y + s * 0.55); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x, y + s * 0.55); g.lineTo(x, y + s * 0.8); g.stroke();
    } else if (kind === "round") {
      const s = clamp(2.6 * P, 5, 11) * px * (0.8 + r * 0.4);
      g.fillStyle = ["#b8692e", "#c99540", "#a4553a", "#d1a54e"][Math.floor(r * 4)];
      g.beginPath(); g.arc(x, y, s * 0.5, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x, y + s * 0.5); g.lineTo(x, y + s * 0.85); g.stroke();
    } else if (kind === "reed") {
      const s = clamp(2.2 * P, 4, 9) * px;
      g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(x + k * s * 0.25, y + s * 0.5); g.lineTo(x + k * s * 0.4, y - s * 0.5); } g.stroke();
    } else if (kind === "tuft") {
      const s = clamp(1.8 * P, 3.5, 7) * px;
      g.strokeStyle = "rgba(58,44,22,.7)"; g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(x, y + s * 0.4); g.quadraticCurveTo(x + k * s * 0.15, y, x + k * s * 0.5, y - s * 0.4 + Math.abs(k) * s * 0.15); } g.stroke();
    } else if (kind === "rock") {
      const s = clamp(2 * P, 4, 9) * px;
      g.fillStyle = "rgba(170,150,128,.85)"; g.beginPath(); g.moveTo(x - s * 0.5, y + s * 0.3); g.lineTo(x - s * 0.2, y - s * 0.35); g.lineTo(x + s * 0.35, y - s * 0.2); g.lineTo(x + s * 0.5, y + s * 0.3); g.closePath(); g.fill(); g.stroke();
    } else if (kind === "peak") {
      // a hand-drawn peak: uneven flanks, a shoulder now and then, the shadow side washed and hatched, snow on the tall ones
      const s = clamp((6 + h * 11) * P, 12, 40) * px * (0.8 + r * 0.45), w = s * (1.05 + hash(x, y, 5) * 0.5);
      const tx = x + (r - 0.5) * w * 0.3, ty = y - s, L = x - w / 2, R = x + w / 2;
      const sh = hash(x, y, 6) > 0.5, shx = tx + (R - tx) * 0.55, shy = ty + s * 0.42;   // shoulder on the right flank
      const outline = () => { g.beginPath(); g.moveTo(L, y); g.quadraticCurveTo(L + (tx - L) * 0.55, ty + s * 0.42, tx, ty);
        if (sh) { g.lineTo(shx - w * 0.04, shy - s * 0.12); g.lineTo(shx + w * 0.05, shy); } g.quadraticCurveTo(R - (R - tx) * 0.2, y - s * 0.2, R, y); };
      g.fillStyle = "rgba(222,210,186,.94)"; outline(); g.closePath(); g.fill();
      g.fillStyle = "rgba(104,88,70,.62)"; g.beginPath(); g.moveTo(tx, ty); if (sh) { g.lineTo(shx - w * 0.04, shy - s * 0.12); g.lineTo(shx + w * 0.05, shy); }
      g.quadraticCurveTo(R - (R - tx) * 0.2, y - s * 0.2, R, y); g.lineTo(tx + w * 0.04, y); g.quadraticCurveTo(tx - w * 0.06, ty + s * 0.5, tx, ty); g.fill();
      if (h > 0.5) { g.fillStyle = "#f7f8fa"; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - w * 0.16, ty + s * 0.3); g.lineTo(tx - w * 0.07, ty + s * 0.24); g.lineTo(tx - w * 0.02, ty + s * 0.33); g.lineTo(tx + w * 0.05, ty + s * 0.2); g.closePath(); g.fill(); }
      g.lineWidth = lw * 1.15; outline(); g.stroke();
      g.lineWidth = lw * 0.6; g.strokeStyle = "rgba(40,28,18,.7)"; g.beginPath();   // hatching down the shadow side
      for (let k = 1; k < 5; k++) { const f = k / 5, ax = tx + (R - tx) * f * 0.85, ay = ty + s * f * 0.88; g.moveTo(ax, ay); g.lineTo(ax - w * 0.08, Math.min(y, ay + s * 0.3)); }
      g.stroke();
      g.strokeStyle = "rgba(40,28,18,.35)"; g.beginPath(); g.moveTo(L - w * 0.08, y + 0.6 * px); g.lineTo(R + w * 0.12, y + 0.6 * px); g.stroke();   // ground line
    }
  }

  // ---------------------------------------------------------------- the cache and the per-frame draw
  const tiles = new Map();   // key → canvas, oldest first
  let missing = 0, lastLv = null;
  const keyOf = (lv, tx, ty, dpr) => `${lv}|${tx}|${ty}|${dpr}`;
  function get(lv, tx, ty, dpr, make) {
    const k = keyOf(lv, tx, ty, dpr); let c = tiles.get(k);
    if (c) { tiles.delete(k); tiles.set(k, c); return c; }
    if (!make) return null;
    c = renderTile(lv, tx, ty, dpr); tiles.set(k, c);
    while (tiles.size > MAX_TILES) tiles.delete(tiles.keys().next().value);
    return c;
  }
  /* the level whose tiles are drawn at k device px per map unit: never stretched up (drawn at 0.71…1×) */
  const levelFor = (k) => clamp(Math.ceil(2 * Math.log2(Math.max(0.5, k)) - 1e-6), -2, 14);
  function drawLevel(g, lv, k, ox, oy, cw, ch, dpr, make, t0) {
    const ks = Math.pow(2, lv / 2), span = TILE / ks, sc = k / ks, sz = TILE * sc;
    const tx0 = Math.max(0, Math.floor(-ox / k / span)), tx1 = Math.min(Math.ceil(W / span) - 1, Math.floor((cw - ox) / k / span));
    const ty0 = Math.max(0, Math.floor(-oy / k / span)), ty1 = Math.min(Math.ceil(H / span) - 1, Math.floor((ch - oy) / k / span));
    let miss = 0;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const can = make && performance.now() - t0 < BUDGET_MS;
      const c = get(lv, tx, ty, dpr, can);
      if (!c) { miss++; continue; }
      const X = Math.floor(ox + tx * sz), Y = Math.floor(oy + ty * sz), X2 = Math.ceil(ox + (tx + 1) * sz), Y2 = Math.ceil(oy + (ty + 1) * sz);
      g.drawImage(c, X, Y, X2 - X, Y2 - Y);
    }
    return miss;
  }
  /* g: the map canvas with an identity transform (device px); k, ox, oy: the map's device-px transform; img: the
     painting (for the wash); a: how strongly to show the chart (0..1). Clipped to the map's own rectangle. */
  function draw(g, img, k, ox, oy, cw, ch, dpr, a) {
    if (a <= 0 || typeof Terrain === "undefined" || !Terrain.grid) { missing = 0; return; }
    const t0 = performance.now();
    g.save(); g.globalAlpha = a;
    g.beginPath(); g.rect(ox, oy, W * k, H * k); g.clip();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    if (img) g.drawImage(washOf(img), ox, oy, W * k, H * k);
    const lv = levelFor(k);
    if (lastLv != null && lastLv !== lv) drawLevel(g, lastLv, k, ox, oy, cw, ch, dpr, false, t0);   // the previous step under the new one while it's inked
    missing = drawLevel(g, lv, k, ox, oy, cw, ch, dpr, true, t0);
    if (!missing) lastLv = lv;
    g.restore();
  }
  const pending = () => missing > 0;
  const stats = () => ({ tiles: tiles.size, missing, level: lastLv });
  const reset = () => { tiles.clear(); missing = 0; lastLv = null; };
  return { draw, pending, stats, reset, levelFor, TILE };
})();
if (typeof module !== "undefined") module.exports = INKMAP;
