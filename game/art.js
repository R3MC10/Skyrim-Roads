/* Art: one shared toolkit for every picture in the game (fight scenes, places, icons, your character).
   Everything is drawn in code on a canvas in the same ink-on-parchment style as the map, so the app stays small and
   works offline. (There used to be a pixel-art option too; it was removed on 24 Nov 2026 — one style only.) [OURS]

   How to draw something:
     ART.canvas(w, h, (g, P) => { ... }, { key, style, scale })  → an HTMLCanvasElement
     ART.html(w, h, draw, opts)  → an <img> tag string (data URL, cached by key) for innerHTML templates
   `g` is a 2D context sized w×h (CSS pixels); `P` is the palette below plus helpers. Keep shapes simple and bold.
   Use a `key` for anything drawn more than once (cached). */
const ART = (() => {
  // the map's colours: parchment, ink, forest, snow, stone, ember, frost, gold, blood
  const PAL = {
    parch: "#e9dcc0", parchDark: "#cdb98f", ink: "#3b2c1e", inkSoft: "#6b5640", night: "#1c2128", sea: "#30505e", water: "#5f8797",
    forest: "#3d5d36", leaf: "#557a47", grass: "#8c9a5a", tundra: "#b9a98d", rock: "#8f7a66", stone: "#7d6c58", snow: "#f4f6f8",
    ember: "#c4572e", fire: "#e8923a", frost: "#9fd0f0", shock: "#c9b6ff", gold: "#d6b25e", blood: "#8e2b25", steel: "#a9b0b4",
    iron: "#6f6a64", leather: "#8a5a34", wood: "#7a5232", cloth: "#5a4a7a", skin: ["#e9c6a1", "#c99a6e", "#8d5a3b", "#6d7f8a", "#a7b48a"],
  };
  const PREFS_KEY = "rotn_prefs";
  // one art style now (hand-drawn ink). Old saves may still say "pixel": quietly drop it from the stored settings.
  try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); if (p && "artStyle" in p) { delete p.artStyle; localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } } catch { /* no storage */ }
  const style = () => "ink";
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

  const cache = new Map();
  /* draw(g, H, w, h) into a canvas of w×h CSS pixels */
  function canvas(w, h, draw) {
    const dpr = DPR(), c = document.createElement("canvas");
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + "px"; c.style.height = h + "px";
    const g = c.getContext("2d");
    g.scale(dpr, dpr); draw(g, H, w, h);
    c.dataset.art = "ink";
    return c;
  }
  /* a cached data URL, for <img> tags inside HTML templates */
  function url(w, h, draw, opts = {}) {
    const k = opts.key ? `${opts.key}|${w}x${h}` : null;
    if (k && cache.has(k)) return cache.get(k);
    let u = "";
    try { u = canvas(w, h, draw).toDataURL("image/png"); } catch (e) { console.warn("art failed", opts.key, e); }
    if (k) { if (cache.size > 400) cache.delete(cache.keys().next().value); cache.set(k, u); }
    return u;
  }
  const html = (w, h, draw, opts = {}) => { const u = url(w, h, draw, opts); return u ? `<img class="art ${opts.cls || ""}" src="${u}" width="${w}" height="${h}" alt="${(opts.alt || "").replace(/"/g, "&quot;")}">` : ""; };
  const drawingStyle = style;   // kept so older callers still work: always "ink"
  const clear = () => cache.clear();
  return { PAL, H, style, drawingStyle, canvas, url, html, seeded, clear };

})();
