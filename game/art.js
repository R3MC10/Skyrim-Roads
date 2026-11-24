/* Art: one shared toolkit for every picture in the game (fight scenes, places, icons, your character).
   Everything is drawn in code on a canvas in the same ink-on-parchment style as the map, so the app stays small and
   works offline. The player can switch the whole game to pixel art (⚙ Settings → Art style): the same drawing is
   rendered small, snapped to a limited palette and blown up with hard edges. [OURS]

   How to draw something:
     ART.canvas(w, h, (g, P) => { ... }, { key, style, scale })  → an HTMLCanvasElement
     ART.html(w, h, draw, opts)  → an <img> tag string (data URL, cached by key) for innerHTML templates
   `g` is a 2D context sized w×h (CSS pixels); `P` is the palette below plus helpers. Keep shapes simple and bold
   so they survive the pixel filter. Use a `key` for anything drawn more than once (cached per style). */
const ART = (() => {
  // the map's colours: parchment, ink, forest, snow, stone, ember, frost, gold, blood
  const PAL = {
    parch: "#e9dcc0", parchDark: "#cdb98f", ink: "#3b2c1e", inkSoft: "#6b5640", night: "#1c2128", sea: "#30505e", water: "#5f8797",
    forest: "#3d5d36", leaf: "#557a47", grass: "#8c9a5a", tundra: "#b9a98d", rock: "#8f7a66", stone: "#7d6c58", snow: "#f4f6f8",
    ember: "#c4572e", fire: "#e8923a", frost: "#9fd0f0", shock: "#c9b6ff", gold: "#d6b25e", blood: "#8e2b25", steel: "#a9b0b4",
    iron: "#6f6a64", leather: "#8a5a34", wood: "#7a5232", cloth: "#5a4a7a", skin: ["#e9c6a1", "#c99a6e", "#8d5a3b", "#6d7f8a", "#a7b48a"],
  };
  // a tight palette for pixel mode (16 colours, roughly the map's)
  const PIXEL_PAL = ["#1c2128", "#3b2c1e", "#6b5640", "#8f7a66", "#cdb98f", "#e9dcc0", "#f4f6f8", "#3d5d36", "#8c9a5a", "#30505e", "#5f8797", "#9fd0f0", "#8e2b25", "#c4572e", "#e8923a", "#d6b25e"]
    .map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const PREFS_KEY = "rotn_prefs";
  function style() {
    try { return (JSON.parse(localStorage.getItem(PREFS_KEY) || "{}").artStyle) || "ink"; } catch { return "ink"; }
  }
  const DPR = () => Math.min(2, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1);

  // small drawing helpers shared by all artists
  function seeded(seed) { let a = 0; for (const ch of String(seed)) a = (a * 31 + ch.charCodeAt(0)) | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const H = {
    ...PAL, seeded,
    /* wobbly ink outline, like a hand-drawn line */
    inkPath(g, pts, close = true, w = 1.6, color = PAL.ink) { g.strokeStyle = color; g.lineWidth = w; g.lineJoin = "round"; g.lineCap = "round"; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); g.stroke(); },
    poly(g, pts, fill, stroke = PAL.ink, w = 1.4) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = w; g.lineJoin = "round"; g.stroke(); } },
    circle(g, x, y, r, fill, stroke = PAL.ink, w = 1.4) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = w; g.stroke(); } },
    /* parchment background with a soft vignette and paper grain */
    parchment(g, w, h, seed = 1) {
      g.fillStyle = PAL.parch; g.fillRect(0, 0, w, h);
      const r = seeded(seed); g.globalAlpha = 0.08;
      for (let i = 0; i < (w * h) / 90; i++) { g.fillStyle = r() < 0.5 ? PAL.inkSoft : PAL.parchDark; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
      g.globalAlpha = 1;
      const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(59,44,30,0.35)"); g.fillStyle = v; g.fillRect(0, 0, w, h);
    },
    /* a dusk/day/night sky band */
    sky(g, w, h, mood = "day") {
      const c = { day: ["#c9d6d8", "#e9dcc0"], dusk: ["#7a5a6a", "#e8b07a"], night: ["#1c2128", "#3b4a5a"], snow: ["#d8e2e8", "#f4f6f8"], cave: ["#241c16", "#3b2c1e"] }[mood] || ["#c9d6d8", "#e9dcc0"];
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    },
    mountains(g, w, base, height, seed = 2, fill = PAL.rock, snowy = true) {
      const r = seeded(seed); let x = -20;
      while (x < w + 20) { const pw = 40 + r() * 70, ph = height * (0.6 + r() * 0.4);
        H.poly(g, [[x, base], [x + pw / 2, base - ph], [x + pw, base]], fill, PAL.ink, 1.2);
        if (snowy) H.poly(g, [[x + pw * 0.33, base - ph * 0.66], [x + pw / 2, base - ph], [x + pw * 0.67, base - ph * 0.66], [x + pw * 0.55, base - ph * 0.58], [x + pw * 0.45, base - ph * 0.62]], PAL.snow, null);
        x += pw * (0.55 + r() * 0.3); }
    },
    pines(g, w, base, n = 12, seed = 3, size = 14) {
      const r = seeded(seed);
      for (let i = 0; i < n; i++) { const x = r() * w, s = size * (0.7 + r() * 0.6), y = base + r() * 6;
        H.poly(g, [[x - s * 0.5, y], [x, y - s * 1.6], [x + s * 0.5, y]], PAL.forest, PAL.ink, 1); g.fillStyle = PAL.wood; g.fillRect(x - 1, y, 2, s * 0.25); }
    },
  };

  // ---- the pixel filter: draw small, snap to the palette, scale up with hard edges
  function nearest(r, g, b) { let best = PIXEL_PAL[0], bd = 1e9; for (const p of PIXEL_PAL) { const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (d < bd) { bd = d; best = p; } } return best; }
  function pixelate(src, w, h, block, painted = false) {
    const sw = Math.max(8, Math.round(w / block)), sh = Math.max(8, Math.round(h / block));
    const small = document.createElement("canvas"); small.width = sw; small.height = sh;
    const sg = small.getContext("2d"); sg.imageSmoothingEnabled = true; sg.drawImage(src, 0, 0, sw, sh);
    const img = sg.getImageData(0, 0, sw, sh), d = img.data;
    // band every colour channel into a few steps (keeps every hue, loses the smooth gradients), and pull
    // near-black/ink pixels onto the ink colour so outlines stay crisp
    const step = 24, q = (v) => Math.min(255, Math.round(v / step) * step);   // 24: parchment stays parchment (34 turned it pink)
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
      const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      if (lum < (painted ? 22 : 70)) { const [r, g, b] = nearest(d[i], d[i + 1], d[i + 2]); d[i] = r; d[i + 1] = g; d[i + 2] = b; }
      else { d[i] = q(d[i]); d[i + 1] = q(d[i + 1]); d[i + 2] = q(d[i + 2]); }
      d[i + 3] = 255;
    }
    sg.putImageData(img, 0, 0);
    return small;
  }

  const cache = new Map();
  /* draw(g, H, w, h) into a canvas of w×h CSS pixels; opts.style overrides the player's choice.
     opts.scale: backing pixels per CSS pixel (default the screen's density, at most 2) */
  let drawing = null;   // the style of the picture being drawn right now (drawers can ask: ART.drawingStyle())
  let srcPU = 0;        // a painted file drawn into the picture: its pixels per drawing unit (ASSETS.cover tells us)
  const noteSrc = (pu) => { if (pu > 0) srcPU = srcPU ? Math.min(srcPU, pu) : pu; };
  function canvas(w, h, draw, opts = {}) {
    const st = opts.style || style(), dpr = opts.scale || DPR();
    const prev = drawing; drawing = st;
    try { return canvasIn(w, h, draw, opts, st, dpr); } finally { drawing = prev; }
  }
  function canvasIn(w, h, draw, opts, st, dpr) {
    const c = document.createElement("canvas");
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + "px"; c.style.height = h + "px";
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    if (st === "pixel") {
      const raw = document.createElement("canvas"); raw.width = w * 2; raw.height = h * 2;
      const rg = raw.getContext("2d"); rg.scale(2, 2); draw(rg, H, w, h);
      const small = pixelate(raw, w, h, opts.block || Math.max(2, Math.round(Math.min(w, h) / (opts.painted ? 110 : 60))), !!opts.painted);   // painted pictures keep more detail and their dark tones
      g.imageSmoothingEnabled = false; g.drawImage(small, 0, 0, c.width, c.height);
      c.style.imageRendering = "pixelated";
    } else { g.scale(dpr, dpr); draw(g, H, w, h); }
    c.dataset.art = st;
    return c;
  }
  /* How sharp to draw a picture for an <img> tag. A picture in a wide PC panel needs many more pixels than its drawing
     size: aim for the biggest box it can get on this screen (side panel or popup). Backing pixels per drawing unit. */
  const SCENE_CAP = 6;
  function budget(w) {
    let px = 0;
    try {
      const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1, d = (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1;
      const side = document.getElementById("side"), sw = side ? side.getBoundingClientRect().width : 0;
      const box = innerWidth >= 1100 ? Math.max(sw, Math.min(innerWidth * 0.5, 980) * z) : Math.min(innerWidth, 640) * z;   // screen px the picture may fill
      px = box * Math.min(3, d);
    } catch { /* no window: tests */ }
    return Math.max(DPR(), Math.min(SCENE_CAP, px / w));
  }
  /* a cached data URL, for <img> tags inside HTML templates. A picture with a painted file inside is redrawn as sharp as
     that file allows (up to what this screen can show); drawn-by-code pictures keep the screen's density. */
  const meta = new Map();   // data URL -> { maxw }: the widest it can be shown (screen px) without blowing anything up
  function url(w, h, draw, opts = {}) {
    const st = opts.style || style();
    let sc = opts.scale || DPR();
    const want = st === "pixel" || opts.scale ? sc : budget(w);
    const k = opts.key ? `${opts.key}|${w}x${h}|${st}|${Math.round(want * 4)}` : null;
    if (k && cache.has(k)) return cache.get(k);
    let u = "";
    try {
      srcPU = 0;
      let c = canvas(w, h, draw, { ...opts, style: st, scale: sc });
      const pu = st === "pixel" ? 0 : srcPU;
      if (pu) { const best = Math.max(sc, Math.min(want, pu)); if (best > sc * 1.05) { sc = best; c = canvas(w, h, draw, { ...opts, style: st, scale: sc }); } }
      u = pu ? c.toDataURL("image/webp", 0.92) : "";
      if (!u.startsWith("data:image/webp")) u = c.toDataURL("image/png");
      if (pu) { meta.set(u, { maxw: Math.round(w * Math.min(sc, pu)) }); if (meta.size > 500) meta.delete(meta.keys().next().value); }
    } catch (e) { console.warn("art failed", opts.key, e); }
    if (k) { if (cache.size > 400) cache.delete(cache.keys().next().value); cache.set(k, u); }
    return u;
  }
  /* an <img> keeps its shape (height follows width); one with a painted file inside is never shown wider than its own
     sharp pixels (--art-k = screen pixels per CSS pixel, kept by artfit.js) and sits centred when it stops short */
  const html = (w, h, draw, opts = {}) => {
    const u = url(w, h, draw, opts); if (!u) return "";
    const m = style() === "pixel" ? null : meta.get(u);
    const st = style() === "pixel" ? ' style="image-rendering:pixelated"' : m ? ` style="max-width:min(100%,calc(${m.maxw}px / var(--art-k,1)))" data-maxw="${m.maxw}"` : "";
    return `<img class="art ${opts.cls || ""}" src="${u}" width="${w}" height="${h}" alt="${(opts.alt || "").replace(/"/g, "&quot;")}"${st}>`;
  };
  function setStyle(st) { try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); p.artStyle = st; localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ } cache.clear(); }
  const drawingStyle = () => drawing || style();
  const clear = () => cache.clear();
  return { PAL, H, style, setStyle, drawingStyle, canvas, url, html, seeded, clear, noteSrc, budget };
})();
