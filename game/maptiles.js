/* maptiles.js: the painted world map, sharp at every zoom. [OURS]
   map-world.webp (2000×1400) is level 0 and is always drawn first. On top of it go tiles of a zoom pyramid, cut by
   scripts/map_tiles.py: level 1 = 4000×2800, level 2 = 8000×5600, in 512 px WebP tiles named mapt-<level>-<col>-<row>
   (flat in the game folder; edge tiles are smaller). Each frame map.js asks for the level that matches the screen
   (about one painting pixel per device pixel) and only the tiles in view; they load lazily, a few at a time, and
   until a sharp tile arrives the level below (or the base painting) shows through. Loaded tiles are kept in a small
   cache (MAX_TILES decoded tiles, about 1 MB each); tiles far from the view or of another level are dropped first.
   Tiles are drawn at whole device pixels, so neighbours meet without seams; labels, fog and pins are drawn by
   map.js afterwards in the same world transform, so everything stays aligned.
   Closer than the top level's own pixels, a fine hand-painted grain (paper tooth and short brush strokes, made
   here, crisp at the screen's own resolution and fixed to the map) is laid over the painting so it never smears.
   Only asked for while the painting itself is in (so never in node tests or ?noassets runs). */
const MAPTILES = (() => {
  const W = 1000, H = 700, TILE = 512, LEVELS = [null, [4000, 2800], [8000, 5600]], TOP = 2;
  const MAX_TILES = 64, MAX_LOADING = 6;
  const cache = new Map();   // "L-c-r" -> { st: "loading"|"ok"|"none", img, used }
  let off = false, okCount = 0, failCount = 0, frame = 0, loading = 0, lastDraw = { level: 0, tiles: 0, wanted: 0 };
  let grainTex = null;

  const cols = (L) => Math.ceil(LEVELS[L][0] / TILE), rows = (L) => Math.ceil(LEVELS[L][1] / TILE);
  const key = (L, c, r) => `${L}-${c}-${r}`;
  /* the pyramid level for a world drawn devW device pixels wide: the smallest one shown no more than 1.5× its own pixels */
  function levelFor(devW) {
    for (let L = 1; L <= TOP; L++) if (LEVELS[L][0] * 1.5 >= devW) return L;
    return TOP;
  }
  /* which tiles of level L a view box (map units) touches */
  function tilesIn(L, box) {
    const [lw, lh] = LEVELS[L], sx = lw / W, sy = lh / H;
    const c0 = Math.max(0, Math.floor(box[0] * sx / TILE)), c1 = Math.min(cols(L) - 1, Math.floor(box[2] * sx / TILE));
    const r0 = Math.max(0, Math.floor(box[1] * sy / TILE)), r1 = Math.min(rows(L) - 1, Math.floor(box[3] * sy / TILE));
    const out = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push([c, r]);
    return out;
  }
  function request(L, c, r) {
    const k = key(L, c, r);
    let t = cache.get(k);
    if (t && t.st === "none" && Date.now() - t.at > 20000) { cache.delete(k); t = null; }   // a failed tile is tried again later
    if (t) { t.used = frame; return t; }
    if (off || loading >= MAX_LOADING || typeof Image === "undefined") return null;
    t = { st: "loading", img: null, used: frame, L, c, r };
    cache.set(k, t); loading++;
    const im = new Image(); im.decoding = "async";
    im.onload = () => { t.st = "ok"; t.img = im; loading--; okCount++; };   // the map loop redraws while pending() and every 125 ms anyway
    im.onerror = () => { t.st = "none"; t.at = Date.now(); loading--; if (++failCount >= 4 && !okCount) off = true; };   // no pyramid in this build: the old ink close-up
    im.src = `mapt-${k}.webp`;
    return t;
  }
  /* keep the cache small: drop the tiles left out of view longest ago (of those, other levels first) */
  function evict(level) {
    if (cache.size <= MAX_TILES) return;
    const list = [...cache.entries()].filter(([, t]) => t.st !== "loading").sort((a, b) => (a[1].used - b[1].used) || ((a[1].L === level) - (b[1].L === level)));
    for (const [k, t] of list) { if (cache.size <= MAX_TILES) break; if (t.used === frame) continue; if (t.img) t.img.src = ""; cache.delete(k); }
  }
  /* a fine painted grain, 256 px, tiles seamlessly: paper tooth + short strokes, mid grey (soft-light leaves mid grey unchanged) */
  function grain() {
    if (grainTex) return grainTex;
    const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
    const g = c.getContext("2d"); if (!g) return null;
    g.fillStyle = "#808080"; g.fillRect(0, 0, N, N);
    let s = 9001; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const wrap = (f) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.save(); g.translate(dx, dy); f(); g.restore(); } };
    // paper tooth: small soft dots, light and dark
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * N, y = rnd() * N, r = 0.4 + rnd() * 1.1, v = rnd() < 0.5 ? 0 : 255;
      g.fillStyle = `rgba(${v},${v},${v},${0.05 + rnd() * 0.08})`;
      wrap(() => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
    }
    // brush strokes: short curved dabs, mostly along one diagonal like the painting's own hand
    g.lineCap = "round";
    for (let i = 0; i < 520; i++) {
      const x = rnd() * N, y = rnd() * N, a = -0.6 + (rnd() - 0.5) * 1.1, l = 3 + rnd() * 9, v = rnd() < 0.5 ? 20 : 235;
      g.strokeStyle = `rgba(${v},${v},${v},${0.05 + rnd() * 0.07})`; g.lineWidth = 0.6 + rnd() * 1.3;
      const dx = Math.cos(a) * l, dy = Math.sin(a) * l, bend = (rnd() - 0.5) * l * 0.5;
      wrap(() => { g.beginPath(); g.moveTo(x - dx / 2, y - dy / 2); g.quadraticCurveTo(x - dy / l * bend, y + dx / l * bend, x + dx / 2, y + dy / 2); g.stroke(); });
    }
    grainTex = c;
    return c;
  }

  /* Draw the pyramid over the base painting. g: the map canvas; k, ox, oy: device px per map unit and the map's offset
     (device px); cw, ch: canvas size. Returns how much of the screen the top level covers past its own pixels. */
  function draw(g, k, ox, oy, cw, ch) {
    frame++;
    const devW = W * k, level = off ? 0 : levelFor(devW);
    const box = [-ox / k, -oy / k, (cw - ox) / k, (ch - oy) / k];
    let drawn = 0, wanted = 0;
    if (level) {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
      // the level below first (only tiles already loaded: it covers the gaps while sharp ones arrive), then this level
      for (let L = 1; L <= level; L++) {
        const [lw, lh] = LEVELS[L], px = devW / lw, py = H * k / lh;
        for (const [c, r] of tilesIn(L, box)) {
          const t = L === level ? request(L, c, r) : cache.get(key(L, c, r));
          if (L === level) wanted++;
          if (!t || t.st !== "ok") continue;
          t.used = frame;
          const x0 = Math.round(ox + c * TILE * px), y0 = Math.round(oy + r * TILE * py);
          const x1 = Math.round(ox + Math.min(lw, (c + 1) * TILE) * px), y1 = Math.round(oy + Math.min(lh, (r + 1) * TILE) * py);
          g.drawImage(t.img, x0, y0, x1 - x0, y1 - y0);
          if (L === level) drawn++;
        }
      }
      g.restore();
      evict(level);
    }
    lastDraw = { level, tiles: drawn, wanted };
    // the grain: fades in once the screen shows the sharpest level bigger than its own pixels
    const over = devW / (level ? LEVELS[level][0] : 2000);
    const a = Math.max(0, Math.min(1, (over - 0.9) / 1.2)) * 0.55;
    lastDraw.grain = +a.toFixed(2);
    const tex = a > 0.01 ? grain() : null;
    if (tex) {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.beginPath(); g.rect(Math.max(0, ox), Math.max(0, oy), Math.min(cw, ox + devW) - Math.max(0, ox), Math.min(ch, oy + H * k) - Math.max(0, oy)); g.clip();
      const pat = g.createPattern(tex, "repeat");
      if (pat) {
        // fixed to the map (moves with it when you pan); a touch bigger on very close zooms so it reads as brushwork
        const gs = Math.max(1, Math.min(2.2, over / 1.6));
        try { pat.setTransform?.(new DOMMatrix([gs, 0, 0, gs, ox % (256 * gs), oy % (256 * gs)])); } catch { /* old browsers: fixed to the screen */ }
        g.globalAlpha = a; g.globalCompositeOperation = "soft-light"; g.fillStyle = pat; g.fillRect(0, 0, cw, ch);
      }
      g.restore();
    }
    return over;
  }
  const pending = () => !off && loading > 0;
  const stats = () => ({ ...lastDraw, cached: cache.size, loading, off });
  /* tests: forget everything */
  const reset = () => { cache.clear(); off = false; okCount = failCount = 0; loading = 0; frame = 0; };
  return { TILE, LEVELS, TOP, MAX_TILES, levelFor, tilesIn, draw, pending, stats, reset, grain, get off() { return off; } };
})();
if (typeof module !== "undefined") module.exports = MAPTILES;
