/* titlevideo.js: on a phone held upright, the main menu's background is a looping painted video. [OURS]
     TITLEVIDEO.attach(titleEl)  → puts the video behind the title (ui.js showTitle); the drawn panorama rests while it plays
     TITLEVIDEO.phone()          → an upright phone-shaped screen: the title plays the video's own music and wind
                                   (sound.js plays mus-titlevid.mp3 as the title track then)
   title-loop.mp4 is 9.5 s, made seamless (its last half second fades into its start), silent; the sound is its own file
   (36 s, also seamless). Anything wrong (landscape, reduced motion, no autoplay, a load error, browser automation without
   ?assets) and the painted panorama (titleart.js) simply carries on underneath. */
const TITLEVIDEO = (() => {
  const SRC = "title-loop.mp4";
  const upright = () => { try { return innerHeight > innerWidth * 1.15; } catch { return false; } };
  const allowed = () => {
    try { if (navigator.webdriver && !/[?&]assets\b/.test(location.search)) return false; } catch { /* ignore */ }
    try { if (/[?&]noassets\b/.test(location.search)) return false; } catch { /* ignore */ }
    return true;
  };
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  const phone = () => upright() && allowed();

  function attach(title) {
    if (!title || title.querySelector(".tvid") || !allowed() || reduced()) return;
    const cv = title.querySelector("#tanim");
    const v = document.createElement("video");
    v.className = "tvid"; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = "auto";
    v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true");
    v.src = SRC;
    (cv ? cv.after(v) : title.prepend(v));
    const on = (yes) => { v.classList.toggle("on", yes); if (cv) { if (yes) cv.dataset.rest = "1"; else delete cv.dataset.rest; } };
    const fit = () => {
      if (!v.isConnected) { removeEventListener("resize", fit); return; }
      if (upright()) { if (v.paused) v.play()?.catch?.(() => {}); if (v.readyState >= 3 && !v.paused) on(true); }
      else { on(false); v.pause(); }
    };
    v.addEventListener("playing", () => { if (upright()) on(true); });
    v.addEventListener("error", () => { on(false); v.remove(); });
    addEventListener("resize", fit);
    if (!upright()) v.pause();
    else v.play()?.catch?.(() => { /* autoplay refused: the painted panorama stays */ });
  }
  return { attach, phone, SRC };
})();
if (typeof module !== "undefined") module.exports = TITLEVIDEO;
