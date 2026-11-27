/* titlevideo.js: the main menu's background is a looping painted video. [OURS]
     TITLEVIDEO.attach(titleEl)  → puts the video behind the title (ui.js showTitle); the drawn panorama rests while it plays
     TITLEVIDEO.phone()          → an upright phone-shaped screen with the video allowed
     TITLEVIDEO.pick()           → { src, poster } for the screen's shape right now
   Upright screens play title-loop.mp4 (720×1280, 9.5 s); wide ones (PC, tablets and phones turned sideways) play
   title-loop-wide.mp4 (1280×720, 9 s, the dragon-free wide painting). Both are seamless (their last moments fade
   into their start) and silent: the title keeps its
   usual music. The video has its own snow, so the title's drawn snowflakes stop while it plays (ui.js startFog). Anything wrong (landscape, reduced motion, no autoplay, a load error, browser automation without
   ?assets) and the painted panorama (titleart.js) simply carries on underneath. */
const TITLEVIDEO = (() => {
  const SRC = "title-loop.mp4", POSTER = "title-poster.webp", WIDE = "title-loop-wide.mp4", WIDE_POSTER = "title-wide-poster.webp";
  const upright = () => { try { return innerHeight > innerWidth * 1.15; } catch { return false; } };
  const allowed = () => {
    try { if (navigator.webdriver && !/[?&]assets\b/.test(location.search)) return false; } catch { /* ignore */ }
    try { if (/[?&]noassets\b/.test(location.search)) return false; } catch { /* ignore */ }
    return true;
  };
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  const phone = () => upright() && allowed();
  const pick = () => (upright() ? { src: SRC, poster: POSTER, wide: false } : { src: WIDE, poster: WIDE_POSTER, wide: true });

  /* the video's own first frame (title-poster.webp) shows at once, before anything loads or plays, so a cold start
     never shows the drawn stand-in picture; the video takes over from it seamlessly. With reduced motion the still
     frame simply stays. */
  function attach(title) {
    if (!title || title.querySelector(".tvid") || !allowed()) return;
    const cv = title.querySelector("#tanim");
    const v = document.createElement("video");
    let cur = pick();
    v.className = "tvid" + (cur.wide ? " wide" : ""); v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto"; v.poster = cur.poster;
    v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true");
    const still = reduced();
    v.autoplay = !still; if (!still) v.src = cur.src;
    (cv ? cv.after(v) : title.prepend(v));
    const on = (yes) => { v.classList.toggle("on", yes); if (cv) { if (yes) cv.dataset.rest = "1"; else delete cv.dataset.rest; } };
    const fit = () => {
      if (!v.isConnected) { removeEventListener("resize", fit); return; }
      const want = pick();
      if (want.src !== cur.src) {   // the screen turned: swap to the other shape's video (its first frame shows at once)
        cur = want; v.classList.toggle("wide", cur.wide); v.poster = cur.poster;
        if (!still) { v.src = cur.src; v.load(); }
      }
      on(true); if (!still && v.paused) v.play()?.catch?.(() => {});
    };
    v.addEventListener("error", () => { if (v.getAttribute("src")) { v.removeAttribute("src"); v.load(); } });   // a broken video: the still frame stays
    addEventListener("resize", fit);
    fit();
  }
  return { attach, phone, pick, SRC, POSTER, WIDE, WIDE_POSTER };
})();
if (typeof module !== "undefined") module.exports = TITLEVIDEO;
