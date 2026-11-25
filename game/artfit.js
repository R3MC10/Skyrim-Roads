/* artfit.js: painted pictures are never stretched and never blown up past their own pixels.
   Owner: "art on PC is stretched and low quality, make sure it is never bad quality ever again."

   The rules every picture follows (tests/art_quality_ui.py checks them on every main screen):
     * keep the shape: crop (cover) instead of squashing;
     * never show a painted file bigger than it is: screen pixels per file pixel <= 1. A box that is bigger than the
       file gets the file at its own size, centred, instead of a blurry blow-up.
   ART.url draws a picture with a painted file inside as sharp as the file allows; this file keeps --art-k (screen
   pixels per CSS pixel: density x page zoom) so CSS can cap such pictures: max-width: calc(<file px> / var(--art-k)).

     ARTFIT.k()                  → screen pixels per CSS pixel right now
     ARTFIT.capScale(s, k)       → a cover scale (drawing units per file pixel) capped so one file pixel never covers
                                    more than one screen pixel, when the drawing has k screen pixels per unit
     ARTFIT.short(key, w, h)     → remembers that a file would need w×h pixels to fill its biggest box (for repainting)
     ARTFIT.shortList()          → [[key, w, h]] the files that are smaller than their boxes on this screen */
const ARTFIT = (() => {
  const DOM = typeof document !== "undefined";
  const k = () => {
    if (!DOM) return 1;
    let z = 1; try { z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1; } catch { /* ignore */ }
    return ((typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1) * z;
  };
  let last = "";
  function apply() { try { const v = String(+k().toFixed(4)); if (v !== last) { last = v; document.documentElement.style.setProperty("--art-k", v); } } catch { /* ignore */ } }
  const capScale = (s, kk) => Math.min(s, 1 / Math.max(1e-6, kk));
  const need = new Map();
  function short(key, w, h) { if (!key) return; const o = need.get(key); if (!o || w > o[0]) need.set(key, [Math.ceil(w), Math.ceil(h)]); }
  const shortList = () => [...need].map(([key, [w, h]]) => [key, w, h]);
  if (DOM) {
    apply();
    if (typeof addEventListener === "function") addEventListener("resize", apply);
    // the page zoom (text size, big monitors) changes on the <html> style; density changes when the window moves screens
    /* [perf] only when the class list or the text-size variable really changed: other code re-adds the same class every
       refresh (the travel band), and each time this used to make the browser recompute every style just to read the zoom */
    let seen = "";
    const changed = () => { const h = document.documentElement, a = h.className + "|" + h.style.getPropertyValue("--tz"); if (a !== seen) { seen = a; apply(); } };
    try { new MutationObserver(changed).observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] }); } catch { /* old browsers */ }
    try {
      const watch = () => { const mq = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`); mq.addEventListener("change", () => { apply(); watch(); }, { once: true }); };
      watch();
    } catch { /* old browsers */ }
  }
  return { k, apply, capScale, short, shortList };
})();
if (typeof module !== "undefined") module.exports = ARTFIT;
