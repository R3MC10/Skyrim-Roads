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
  const DPR = () => Math.min(3, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1);

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
  /* draw(g, H, w, h) into a canvas of w×h CSS pixels. opts.scale: backing pixels per CSS pixel (default the screen's density, at most 2) */
  let srcPU = 0;        // a painted file drawn into the picture: its pixels per drawing unit (ASSETS.cover tells us)
  const noteSrc = (pu) => { if (pu > 0) srcPU = srcPU ? Math.min(srcPU, pu) : pu; };
  function canvas(w, h, draw, opts = {}) {
    const dpr = opts.scale || DPR(), c = document.createElement("canvas");
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + "px"; c.style.height = h + "px";
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.scale(dpr, dpr); draw(g, H, w, h);
    c.dataset.art = "ink";
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
    let sc = opts.scale || DPR();
    const want = opts.scale ? sc : budget(w);
    const k = opts.key ? `${opts.key}|${w}x${h}|${Math.round(want * 4)}` : null;
    if (k && cache.has(k)) return cache.get(k);
    if (typeof document === "undefined") return "";   // no page to paint on (node sims): no picture, no warning
    let u = "";
    try {
      srcPU = 0;
      let c = canvas(w, h, draw, { ...opts, scale: sc });
      const pu = srcPU;
      if (pu) { const best = Math.max(sc, Math.min(want, pu)); if (best > sc * 1.05) { sc = best; c = canvas(w, h, draw, { ...opts, scale: sc }); } }
      u = pu ? c.toDataURL("image/webp", 0.92) : "";
      if (!u.startsWith("data:image/webp")) u = c.toDataURL("image/png");
      if (pu) { meta.set(u, { maxw: Math.round(w * Math.min(sc, pu)) }); if (meta.size > 500) meta.delete(meta.keys().next().value); }
      else if (u) { recipe.set(u, { w, h, draw, opts, sc, k }); if (recipe.size > 300) recipe.delete(recipe.keys().next().value); watchImgs(); }
    } catch (e) { console.warn("art failed", opts.key, e); }
    if (k) { if (cache.size > 400) cache.delete(cache.keys().next().value); cache.set(k, u); }
    return u;
  }
  /* an <img> keeps its shape (height follows width); one with a painted file inside is never shown wider than its own
     sharp pixels (--art-k = screen pixels per CSS pixel, kept by artfit.js) and sits centred when it stops short */
  const html = (w, h, draw, opts = {}) => {
    const u = url(w, h, draw, opts); if (!u) return "";
    const m = meta.get(u);
    const st = m ? ` style="max-width:min(100%,calc(${m.maxw}px / var(--art-k,1)))" data-maxw="${m.maxw}"` : "";
    return `<img class="art ${opts.cls || ""}" src="${u}" width="${w}" height="${h}" alt="${(opts.alt || "").replace(/"/g, "&quot;")}"${st}>`;
  };
  /* [assetquality] a picture drawn by code is made of lines, not pixels: when one is shown bigger than it was drawn (a
     wide PC panel, a big popup, a sharp phone), it is drawn again at the size it really has on screen, so it never goes
     soft. Every <img> showing it is swapped and the cache keeps the sharp copy for the next time the screen is built. */
  const recipe = new Map();   // data URL -> { w, h, draw, opts, sc, k }: how to draw it again
  const SHARP_PX = 16e6, SHARP_SIDE = 8192;
  function sharpen(img) {
    const old = img.getAttribute("src") || "", rc = old.startsWith("data:") ? recipe.get(old) : null; if (!rc) return;
    const r = img.getBoundingClientRect(); if (r.width < 8 || r.height < 8) return;
    // an <img> with no size of its own shows its file at its pixel size: drawing it bigger would only make it bigger
    if (!img.hasAttribute("width") && !img.style.width && Math.abs(r.width - img.naturalWidth) < 2) return;
    const kk = typeof ARTFIT !== "undefined" ? ARTFIT.k() : DPR();
    const want = Math.max(r.width / rc.w, r.height / rc.h) * kk;
    if (want <= rc.sc * 1.1) return;
    const sc = Math.min(Math.ceil(want * 4) / 4, Math.sqrt(SHARP_PX / (rc.w * rc.h)), SHARP_SIDE / Math.max(rc.w, rc.h));
    if (sc <= rc.sc * 1.05) return;
    let u = "";
    try {
      srcPU = 0;
      const c = canvas(rc.w, rc.h, rc.draw, { ...rc.opts, scale: sc });
      if (srcPU) { recipe.delete(old); return; }   // a painted file turned up inside: ART.url's own rules handle those
      u = c.width * c.height > 400000 ? c.toDataURL("image/webp", 0.95) : "";
      if (!u.startsWith("data:image/webp")) u = c.toDataURL("image/png");
    } catch { return; }
    recipe.set(u, { ...rc, sc }); recipe.delete(old);
    if (rc.k) cache.set(rc.k, u);
    for (const im of document.querySelectorAll("img")) if (im.getAttribute("src") === old) im.src = u;
  }
  let ro = null, mo = null, due = new Set(), tick = 0;
  const flush = () => { tick = 0; const list = [...due]; due = new Set(); for (const im of list) if (im.isConnected) sharpen(im); };
  const queue = (im) => { due.add(im); if (!tick) tick = setTimeout(flush, 60); };
  const look = (n) => {
    if (!n || n.nodeType !== 1) return;
    const all = n.tagName === "IMG" ? [n] : n.getElementsByTagName("img");
    for (const im of all) { const s = im.getAttribute("src"); if (s && s.startsWith("data:") && recipe.has(s)) { ro.observe(im); queue(im); } }
  };
  function watchImgs() {
    if (mo || typeof document === "undefined" || typeof ResizeObserver === "undefined" || typeof MutationObserver === "undefined") return;
    ro = new ResizeObserver((es) => { for (const e of es) queue(e.target); });
    mo = new MutationObserver((ms) => { for (const m of ms) { if (m.type === "attributes") look(m.target); else for (const n of m.addedNodes) look(n); } });
    const start = () => { mo.observe(document.body || document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] }); look(document.body); };
    if (document.body) start(); else addEventListener("DOMContentLoaded", start, { once: true });
    addEventListener("resize", () => { for (const im of document.querySelectorAll("img")) { const s = im.getAttribute("src"); if (s && s.startsWith("data:") && recipe.has(s)) queue(im); } });
  }
  const drawingStyle = style;   // kept so older callers still work: always "ink"
  const clear = () => cache.clear();
  return { PAL, H, style, drawingStyle, canvas, url, html, seeded, clear, noteSrc, budget, sharpen };
})();
