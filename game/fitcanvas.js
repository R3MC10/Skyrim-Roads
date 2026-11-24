/* fitcanvas.js: every picture keeps its shape and stays sharp on any screen (phone, tablet, PC; turned sideways or not).
   Owner: "the entire game has stretching issues, resolution should scale nicely between devices, no more stretching".

   A canvas has two sizes: its box on screen (CSS pixels) and its backing pixels. If they don't match the screen's pixel
   density it looks blurry; if their shapes differ it looks squashed. These helpers keep both in step:

     FITCANVAS.dpr(cap)              → the screen's pixel density, capped (2.5 by default; big canvases cost battery)
     FITCANVAS.ratio(el, w, cap)     → backing pixels per drawing unit for a picture drawn w units wide into el's box
     FITCANVAS.fixed(cv, W, H, cap)  → for pictures drawn in fixed units (a 300×220 mini-game): sizes the backing from the
                                       box on screen, sets the transform so drawing code keeps using W×H, returns the ctx
     FITCANVAS.fill(cv, cap)         → for canvases that fill their box (map, title): backing = box × density,
                                       returns { g, w, h, k } with w×h the box in CSS pixels and the transform set to k
     FITCANVAS.watch(el, fn)         → calls fn() when el's box changes size (turning the phone, resizing the window,
                                       the text-size zoom); stops by itself once el leaves the page
     FITCANVAS.pixelStep(cssW, artW) → the whole-number blow-up for pixel art (so every art pixel is the same size)
     FITCANVAS.zoom()                → the page zoom (big text / big monitors): divide screen positions by it for left/top
   Pixel art keeps hard edges (image-rendering:pixelated) and is never stretched: CSS keeps the canvas's own shape. */
const FITCANVAS = (() => {
  const DOM = typeof document !== "undefined";
  const CAP = 2.5;
  const dpr = (cap = CAP) => Math.max(1, Math.min(cap, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1));
  // the box on screen, zoom included (getBoundingClientRect counts CSS zoom; clientWidth doesn't)
  function box(el) {
    if (!el || !el.getBoundingClientRect) return { w: 0, h: 0 };
    const r = el.getBoundingClientRect();
    return { w: r.width || el.clientWidth || 0, h: r.height || el.clientHeight || 0 };
  }
  function ratio(el, w, cap = CAP) {
    const b = box(el);
    return Math.max(1, (b.w > 0 && w > 0 ? b.w / w : 1) * dpr(cap));
  }
  /* fixed drawing units (W×H), backing sized from the box on screen; keeps W:H so CSS height:auto never squashes it */
  function fixed(cv, W, H, cap = CAP) {
    // the box must not follow the backing size (that would grow forever): no CSS width given → at most W wide, shape kept
    if (!cv.dataset.fit) { cv.dataset.fit = "fixed"; if (!cv.style.width) { cv.style.width = "100%"; if (!cv.style.maxWidth) cv.style.maxWidth = W + "px"; } cv.style.height = "auto"; cv.style.aspectRatio = W + " / " + H; }
    const b = box(cv), k = Math.max(1, ((b.w || W) / W) * dpr(cap));
    const bw = Math.round(W * k), bh = Math.round(H * k);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    const g = cv.getContext("2d");
    g.setTransform(bw / W, 0, 0, bh / H, 0, 0);
    return g;
  }
  /* fill the box: backing = box × density; the drawing works in CSS pixels */
  function fill(cv, cap = CAP) {
    const b = box(cv), k = dpr(cap), w = Math.max(1, b.w), h = Math.max(1, b.h);
    const bw = Math.max(1, Math.round(w * k)), bh = Math.max(1, Math.round(h * k));
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    const g = cv.getContext("2d");
    g.setTransform(bw / w, 0, 0, bh / h, 0, 0);
    return { g, w, h, k: bw / w };
  }
  /* redraw when the box changes size; one shared observer, entries drop out when their element is gone */
  const subs = new Map();
  let ro = null;
  function watch(el, fn) {
    if (!DOM || !el) return () => {};
    if (typeof ResizeObserver === "undefined") {   // very old webviews: window resize is the best we have
      const h = () => { if (!el.isConnected) return removeEventListener("resize", h); fn(); };
      addEventListener("resize", h); return () => removeEventListener("resize", h);
    }
    if (!ro) ro = new ResizeObserver((es) => {
      for (const e of es) {
        const s = subs.get(e.target); if (!s) continue;
        if (!e.target.isConnected) { ro.unobserve(e.target); subs.delete(e.target); continue; }
        const { w, h } = box(e.target); const key = Math.round(w) + "x" + Math.round(h) + "@" + dpr(99);
        if (key === s.key) continue;
        const first = s.key === null; s.key = key;
        if (!first) for (const f of s.fns) { try { f(); } catch (x) { console.warn("fitcanvas redraw", x); } }
      }
    });
    let s = subs.get(el);
    if (!s) { s = { fns: new Set(), key: null }; subs.set(el, s); ro.observe(el); }
    s.fns.add(fn);
    return () => { s.fns.delete(fn); if (!s.fns.size) { ro.unobserve(el); subs.delete(el); } };
  }
  /* the page's own zoom (access.js zooms the page for bigger text and big PC monitors): screen px = page px × zoom */
  const zoom = () => { try { return parseFloat(getComputedStyle(document.documentElement).zoom) || 1; } catch { return 1; } };
  const pixelStep = (cssW, artW) => Math.max(1, Math.floor((cssW * dpr(99)) / Math.max(1, artW) + 1e-6));
  /* turning the phone or dragging a window to another monitor changes the density: tell the watchers */
  if (DOM && typeof matchMedia === "function") {
    let mq = null;
    const listen = () => {
      try {
        mq = matchMedia(`(resolution: ${(typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1}dppx)`);
        mq.addEventListener("change", () => { for (const [el, s] of subs) { if (!el.isConnected) { subs.delete(el); continue; } s.key = "dpr"; for (const f of s.fns) { try { f(); } catch { /* next */ } } } listen(); }, { once: true });
      } catch { /* old browsers */ }
    };
    listen();
  }
  return { CAP, dpr, box, ratio, fixed, fill, watch, pixelStep, zoom };
})();
if (typeof module !== "undefined") module.exports = FITCANVAS;
