/* inkmap.js: the close-up ink chart under the painted world map. [OURS]
   Since b230 only the fallback: with the tile pyramid in the game folder (maptiles.js) the painting itself stays sharp.
   The painting (map-world.webp, 2000×1400) only has so many pixels: blown up past ~1.3× it turns soft. So map.js
   never draws it bigger than that (PAINT_MAX). Zoomed in further the painting fades out and this takes over:
   - a watercolour wash: the painting's colours sampled per terrain cell and per kind of ground (plains, forest, snow,
     rock...), with smooth inked edges between kinds and a gentle hill shade; a "fine" field matches the painting where it
     fades out, a "calm" field takes over further in so a wide plain is one even wash; laid paper on top (never the
     painting stretched)
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
  /* A parchment colour field at one pixel per map unit, built once from the painting:
     - the painting is averaged down to one colour per terrain cell (4×4 map units): its local tone
     - each kind of ground (open land, forest, autumn wood, marsh, snow, rock, peaks, ash, water, the lands beyond) gets
       its own colour: the median of the painting's cells of that kind nearby (blocks of 25 cells and their neighbours),
       so the chart has the painting's own greens, ochres, blue-greys and snow, never a colour cast laid over the top
     - a pixel = the smooth local tone blended with its ground's colour; the ground under each pixel is read through a
       little noise, so the edges between kinds wander like watercolour, with a faint darker rim where they meet
     - shaded from the height field (light from the north-west, like the painting), plus soft pigment mottling */
  const GROUP = (T, t) => t === T.SEA ? 0 : t === T.LAKE ? 1 : t === T.FOREST || t === T.PINE ? 2 : t === T.AUTUMN ? 3 : t === T.MARSH ? 4
    : t === T.SNOW ? 5 : t === T.ROCKY ? 6 : t === T.MOUNTAIN || t === T.PEAK ? 7 : t === T.VOLCANIC || t === T.ASH ? 8 : t === T.BEYOND ? 9 : 10;   // 10: open land, roads, fords
  const PAL_W = [0.55, 0.5, 0.55, 0.55, 0.5, 0.5, 0.45, 0.5, 0.5, 0.35, 0.35];   // how strongly each kind keeps its own colour
  /* two fields: "fine" keeps the painting's tone cell by cell (right where the painting fades out, so the hand-over
     can't be seen); "calm" evens the tone out over a few cells of the same kind of ground and leans more on each
     kind's colour, so close up a wide plain reads as one calm wash instead of cloudy blotches. draw() blends them. */
  let wash = null, washSrc = null, cellCol = null;
  function washOf(img) {
    if (wash && washSrc === img) return wash;
    washSrc = img;
    try { wash = buildWash(img); } catch { wash = null; }
    if (!wash) {   // no pixel access: the painting, small and soft
      const q = mk(W / 2, H / 2), qg = q.getContext("2d"); qg.imageSmoothingEnabled = true; qg.imageSmoothingQuality = "high";
      try { qg.filter = "blur(1.6px)"; } catch { /* plain shrink */ }
      qg.drawImage(img, 0, 0, q.width, q.height); wash = { fine: q, calm: null };
    }
    return wash;
  }
  /* the painting averaged to GW×GH (halving steps, so every painting pixel counts) */
  function cellMeans(img) {
    const GW = Terrain.GW, GH = Terrain.GH;
    let src = img, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    while (w / 2 >= GW * 1.5) { const c = mk(w / 2, h / 2), g = c.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, c.width, c.height); src = c; w = c.width; h = c.height; }
    const c = mk(GW, GH), g = c.getContext("2d", { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, GW, GH);
    return g.getImageData(0, 0, GW, GH).data;
  }
  function buildWash(img) {
    const T = Terrain.T, GW = Terrain.GW, GH = Terrain.GH, grid = Terrain.grid, hgr = Terrain.hgrid, N = GW * GH;
    const m = cellMeans(img), grp = new Uint8Array(N);
    for (let i = 0; i < N; i++) grp[i] = GROUP(T, grid[i]);
    // each kind's colour: median per channel over the cells of that kind in a block (and its neighbours), else Skyrim-wide
    const B = 25, BW = Math.ceil(GW / B), BH = Math.ceil(GH / B), med = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1]; };
    const lists = new Map(), glob = [];
    for (let k = 0; k < 11; k++) glob.push([[], [], []]);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x, k = grp[i], key = k * 10000 + Math.floor(y / B) * BW + Math.floor(x / B);
      let L = lists.get(key); if (!L) lists.set(key, (L = [[], [], []]));
      for (let ch = 0; ch < 3; ch++) { L[ch].push(m[i * 4 + ch]); glob[k][ch].push(m[i * 4 + ch]); }
    }
    const gmed = glob.map((L) => (L[0].length ? L.map((a) => med(a.slice())) : null));
    const pal = new Float32Array(11 * BW * BH * 3);
    for (let k = 0; k < 11; k++) for (let by = 0; by < BH; by++) for (let bx = 0; bx < BW; bx++) {
      const acc = [[], [], []];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = bx + dx, ny = by + dy; if (nx < 0 || ny < 0 || nx >= BW || ny >= BH) continue;
        const L = lists.get(k * 10000 + ny * BW + nx); if (!L) continue;
        const wgt = dx || dy ? 1 : 3;   // the block itself counts most
        for (let ch = 0; ch < 3; ch++) for (const v of L[ch]) for (let r = 0; r < wgt; r++) acc[ch].push(v);
      }
      const col = acc[0].length >= 6 ? acc.map(med) : gmed[k] || [128, 120, 100], o = ((k * BH + by) * BW + bx) * 3;
      pal[o] = col[0]; pal[o + 1] = col[1]; pal[o + 2] = col[2];
    }
    // a cell's own wash colour: its tone pulled toward its kind's colour; the calm one from the tone of the cells of the
    // same kind around it (5×5) and pulled harder
    cellCol = new Float32Array(N * 3); const calmCol = new Float32Array(N * 3);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x, k = grp[i], o = ((k * BH + Math.floor(y / B)) * BW + Math.floor(x / B)) * 3, w = PAL_W[k], wc = Math.min(0.85, w + 0.25);
      let n = 0; const acc = [0, 0, 0];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
        const j = yy * GW + xx; if (grp[j] !== k) continue;
        n++; acc[0] += m[j * 4]; acc[1] += m[j * 4 + 1]; acc[2] += m[j * 4 + 2];
      }
      for (let ch = 0; ch < 3; ch++) {
        cellCol[i * 3 + ch] = m[i * 4 + ch] * (1 - w) + pal[o + ch] * w;
        calmCol[i * 3 + ch] = (acc[ch] / n) * (1 - wc) + pal[o + ch] * wc;
      }
    }
    // the field, one pixel per map unit
    const out = mk(W, H), og = out.getContext("2d"), id = og.createImageData(W, H), d = id.data;
    const out2 = mk(W, H), og2 = out2.getContext("2d"), id2 = og2.createImageData(W, H), d2 = id2.data, rgb2 = [0, 0, 0];
    const vn = Terrain.vnoise || ((a, b) => hash(Math.floor(a), Math.floor(b)));
    const cellOf = (fx, fy) => clamp(Math.floor(fy / CELL), 0, GH - 1) * GW + clamp(Math.floor(fx / CELL), 0, GW - 1);
    const hAt = (fx, fy) => {
      const gx = clamp(fx / CELL - 0.5, 0, GW - 1.001), gy = clamp(fy / CELL - 0.5, 0, GH - 1.001), x0 = gx | 0, y0 = gy | 0, tx = gx - x0, ty = gy - y0, i = y0 * GW + x0;
      return (hgr[i] * (1 - tx) + hgr[i + 1] * tx) * (1 - ty) + (hgr[i + GW] * (1 - tx) + hgr[i + GW + 1] * tx) * ty;
    };
    const rgb = [0, 0, 0], cw = [0, 0, 0, 0], cid = [0, 0, 0, 0];
    /* which kind of ground at a (warped) point: of the four cells around it, the kind with the most bilinear weight,
       so the edges between kinds are smooth curves instead of cell steps; also the colour of that kind there */
    const kindAt = (fx, fy, col, colB, outA, outB) => {
      const gx = clamp(fx / CELL - 0.5, 0, GW - 1.001), gy = clamp(fy / CELL - 0.5, 0, GH - 1.001), x0 = gx | 0, y0 = gy | 0, tx = gx - x0, ty = gy - y0, i = y0 * GW + x0;
      cid[0] = i; cid[1] = i + 1; cid[2] = i + GW; cid[3] = i + GW + 1;
      cw[0] = (1 - tx) * (1 - ty); cw[1] = tx * (1 - ty); cw[2] = (1 - tx) * ty; cw[3] = tx * ty;
      let best = -1, bw = -1;
      for (let a = 0; a < 4; a++) { const ka = grp[cid[a]]; let s = 0; for (let b = 0; b < 4; b++) if (grp[cid[b]] === ka) s += cw[b]; if (s > bw) { bw = s; best = ka; } }
      if (col) {
        let s = 0; outA[0] = outA[1] = outA[2] = outB[0] = outB[1] = outB[2] = 0;
        for (let a = 0; a < 4; a++) if (grp[cid[a]] === best) { const w = cw[a] + 1e-4, j = cid[a] * 3; s += w; for (let ch = 0; ch < 3; ch++) { outA[ch] += col[j + ch] * w; outB[ch] += colB[j + ch] * w; } }
        for (let ch = 0; ch < 3; ch++) { outA[ch] /= s; outB[ch] /= s; }
      }
      return best;
    };
    const pa = [0, 0, 0], pb = [0, 0, 0];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5;
      // the edges between kinds wander: read the kind through a little noise
      const wx = px + (vn(px / 7 + 3.1, py / 7 + 9.7) - 0.5) * 5.2 + (vn(px / 2.3, py / 2.3 + 40) - 0.5) * 1.8;
      const wy = py + (vn(px / 7 + 21.4, py / 7 + 1.3) - 0.5) * 5.2 + (vn(px / 2.3 + 40, py / 2.3) - 0.5) * 1.8;
      const k = kindAt(wx, wy, cellCol, calmCol, pa, pb);
      const gx = clamp(px / CELL - 0.5, 0, GW - 1.001), gy = clamp(py / CELL - 0.5, 0, GH - 1.001), x0 = gx | 0, y0 = gy | 0, tx = gx - x0, ty = gy - y0, i = y0 * GW + x0;
      for (let ch = 0; ch < 3; ch++) {
        const sm = (cellCol[i * 3 + ch] * (1 - tx) + cellCol[(i + 1) * 3 + ch] * tx) * (1 - ty) + (cellCol[(i + GW) * 3 + ch] * (1 - tx) + cellCol[(i + GW + 1) * 3 + ch] * tx) * ty;
        rgb[ch] = sm * 0.45 + pa[ch] * 0.55;   // the smooth tone + the patch of this kind
        rgb2[ch] = pb[ch];                      // calm: the patch of this kind, evened out
      }
      // a darker rim where two kinds of ground meet (pigment pooling at the edge of a wash)
      const rim = k !== 10 && (kindAt(wx + 1.3, wy) !== k || kindAt(wx, wy + 1.3) !== k || kindAt(wx - 1.3, wy) !== k || kindAt(wx, wy - 1.3) !== k);
      // relief: light from the north-west, like the painting; gentle on open land (strong shading there reads as cloud shadow)
      const hx = hAt(px + 1.5, py) - hAt(px - 1.5, py), hy = hAt(px, py + 1.5) - hAt(px, py - 1.5), rel = k === 10 || k <= 1 ? 0.3 : k === 9 ? 0.5 : 1;
      let sh = 1 - clamp((hx + hy) * 7, -0.26, 0.3) * rel;
      if (rim) sh *= 0.88;
      sh *= 0.97 + 0.06 * vn(px / 9 + 70, py / 9 + 13);   // soft mottling, like pigment settling in paper
      const o = (y * W + x) * 4;
      for (const [c, dd] of [[rgb, d], [rgb2, d2]]) {
        const lum = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;   // a touch less saturated: the painting's ink texture greys its colours to the eye
        for (let ch = 0; ch < 3; ch++) dd[o + ch] = clamp((lum + (c[ch] - lum) * 0.86) * sh, 0, 255);
        dd[o + 3] = 255;
      }
    }
    og.putImageData(id, 0, 0); og2.putImageData(id2, 0, 0);
    return { fine: out, calm: out2 };
  }
  /* laid paper over the wash, in device pixels so it is crisp at any zoom: soft blotches of pigment, fine fibres and
     a faint tooth, blended "overlay" (mid grey changes nothing), anchored to the map so it moves with it */
  let paperTex = null;
  function paper(g, ox, oy, w, h) {
    if (!paperTex) {
      const S = 256; paperTex = mk(S, S);
      const t = paperTex.getContext("2d"), id = t.createImageData(S, S), d = id.data;
      const vn = (x, y, n) => {   // wrapped value noise, n cells across
        const fx = (x / S) * n, fy = (y / S) * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const v = (i, j) => hash(((i % n) + n) % n, ((j % n) + n) % n, n);
        return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy;
      };
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const n = vn(x, y, 4) * 0.45 + vn(x, y, 9) * 0.3 + vn(x, y, 23) * 0.15 + vn(x, y, 64) * 0.1;
        const v = 128 + (n - 0.5) * 46 + (hash(x, y, 5) - 0.5) * 14, o = (y * S + x) * 4;
        d[o] = d[o + 1] = d[o + 2] = clamp(v, 0, 255); d[o + 3] = 255;
      }
      t.putImageData(id, 0, 0);
      t.lineCap = "round";
      for (let i = 0; i < 70; i++) {   // fibres
        const x = hash(i, 1, 9) * S, y = hash(i, 2, 9) * S, a = hash(i, 3, 9) * Math.PI, L = 6 + hash(i, 4, 9) * 16;
        t.strokeStyle = i % 2 ? "rgba(90,90,90,.35)" : "rgba(176,176,176,.35)"; t.lineWidth = 0.7;
        for (const [dx, dy] of [[0, 0], [-S, 0], [S, 0], [0, -S], [0, S]]) {
          t.beginPath(); t.moveTo(x + dx, y + dy); t.quadraticCurveTo(x + dx + Math.cos(a) * L * 0.5 + 2, y + dy + Math.sin(a) * L * 0.5 - 2, x + dx + Math.cos(a) * L, y + dy + Math.sin(a) * L); t.stroke();
        }
      }
    }
    const pat = g.createPattern(paperTex, "repeat"); if (!pat) return;
    if (pat.setTransform && typeof DOMMatrix !== "undefined") pat.setTransform(new DOMMatrix().translate(Math.round(ox), Math.round(oy)));
    g.save(); g.globalCompositeOperation = "overlay"; g.globalAlpha *= 0.55; g.fillStyle = pat; g.fillRect(ox, oy, w, h); g.restore();
  }
  /* the wash colour of a terrain cell (to tint the inked marks), or null before the wash is built */
  const cellRGB = (i) => (cellCol ? [cellCol[i * 3], cellCol[i * 3 + 1], cellCol[i * 3 + 2]] : null);

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
      else if (t === T.TUNDRA || t === T.GRASS) { kind = "tuft"; prob = 0.2; }
      else if (t === T.VOLCANIC) { kind = "rock"; prob = 0.1; }
      else if (t === T.MOUNTAIN || t === T.PEAK) { kind = "peak"; prob = 0.05 + h * 0.07; }
      if (!kind) continue;
      const n = kind === "peak" ? clamp(Math.round(dens / 3), 1, 2) : dens;
      for (let k = 0; k < n; k++) {
        if (hash(x, y, k * 3 + 1) > prob) continue;
        const gx = x * CELL + hash(x, y, k * 3 + 2) * CELL, gy = y * CELL + hash(x, y, k * 3 + 3) * CELL, r = hash(x, y, k + 77);
        glyph(g, kind, gx, gy, P, px, lw, ink, t === T.PINE, h, r, cellRGB(i));
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
  /* a sampled colour made lighter or darker (f), pulled toward paper white (wh), as a fill */
  const tone = (c, f, wh = 0, a = 1) => `rgba(${c.map((v) => Math.round(clamp(v * f * (1 - wh) + 246 * wh, 0, 255))).join(",")},${a})`;
  /* one hand-inked mark; P: CSS px per map unit, px: map units per CSS px */
  function glyph(g, kind, x, y, P, px, lw, ink, dark, h, r, col) {
    g.lineWidth = lw; g.strokeStyle = ink;
    if (kind === "pine" || kind === "snowpine") {
      const s = clamp(3.6 * P, 6, 15) * px * (0.8 + r * 0.4);
      g.fillStyle = kind === "snowpine" ? (col ? tone(col, 1.25, 0.5) : "#e9eef0") : col ? tone(col, dark ? 0.55 : 0.66, 0, 0.92) : dark ? "rgba(46,72,44,.9)" : "rgba(64,92,52,.88)";
      g.beginPath(); g.moveTo(x - s * 0.42, y + s * 0.55); g.lineTo(x, y - s * 0.75); g.lineTo(x + s * 0.42, y + s * 0.55); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x, y + s * 0.55); g.lineTo(x, y + s * 0.8); g.stroke();
    } else if (kind === "round") {
      const s = clamp(2.6 * P, 5, 11) * px * (0.8 + r * 0.4);
      g.fillStyle = col ? tone(col, 0.72 + r * 0.42, 0, 0.95) : ["#b8692e", "#c99540", "#a4553a", "#d1a54e"][Math.floor(r * 4)];
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
      g.fillStyle = col ? tone(col, 1.18, 0.12, 0.9) : "rgba(170,150,128,.85)"; g.beginPath(); g.moveTo(x - s * 0.5, y + s * 0.3); g.lineTo(x - s * 0.2, y - s * 0.35); g.lineTo(x + s * 0.35, y - s * 0.2); g.lineTo(x + s * 0.5, y + s * 0.3); g.closePath(); g.fill(); g.stroke();
    } else if (kind === "peak") {
      // a hand-drawn peak: uneven flanks, a shoulder now and then, the shadow side washed and hatched, snow on the tall ones
      const s = clamp((6 + h * 11) * P, 12, 40) * px * (0.8 + r * 0.45), w = s * (1.05 + hash(x, y, 5) * 0.5);
      const tx = x + (r - 0.5) * w * 0.3, ty = y - s, L = x - w / 2, R = x + w / 2;
      const sh = hash(x, y, 6) > 0.5, shx = tx + (R - tx) * 0.55, shy = ty + s * 0.42;   // shoulder on the right flank
      const outline = () => { g.beginPath(); g.moveTo(L, y); g.quadraticCurveTo(L + (tx - L) * 0.55, ty + s * 0.42, tx, ty);
        if (sh) { g.lineTo(shx - w * 0.04, shy - s * 0.12); g.lineTo(shx + w * 0.05, shy); } g.quadraticCurveTo(R - (R - tx) * 0.2, y - s * 0.2, R, y); };
      g.fillStyle = col ? tone(col, 1.22, 0.18, 0.96) : "rgba(222,210,186,.94)"; outline(); g.closePath(); g.fill();
      g.fillStyle = col ? tone(col, 0.58, 0, 0.8) : "rgba(104,88,70,.62)"; g.beginPath(); g.moveTo(tx, ty); if (sh) { g.lineTo(shx - w * 0.04, shy - s * 0.12); g.lineTo(shx + w * 0.05, shy); }
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
    if (img) {
      const wsh = washOf(img), ps = (k / dpr) * W / (img.naturalWidth || W * 2), ca = clamp((ps - 1.35) / 1.1, 0, 1);   // ps: how big the painting would be drawn
      if (ca < 1 || !wsh.calm) g.drawImage(wsh.fine, ox, oy, W * k, H * k);
      if (ca > 0 && wsh.calm) { const a0 = g.globalAlpha; g.globalAlpha = a0 * ca; g.drawImage(wsh.calm, ox, oy, W * k, H * k); g.globalAlpha = a0; }
    }
    paper(g, ox, oy, W * k, H * k);
    const lv = levelFor(k);
    if (lastLv != null && lastLv !== lv) drawLevel(g, lastLv, k, ox, oy, cw, ch, dpr, false, t0);   // the previous step under the new one while it's inked
    missing = drawLevel(g, lv, k, ox, oy, cw, ch, dpr, true, t0);
    if (!missing) lastLv = lv;
    g.restore();
  }
  const pending = () => missing > 0;
  const stats = () => ({ tiles: tiles.size, missing, level: lastLv });
  const reset = () => { tiles.clear(); missing = 0; lastLv = null; };
  return { draw, pending, stats, reset, levelFor, TILE, wash: () => wash };
})();
if (typeof module !== "undefined") module.exports = INKMAP;
