/* perfmode.js: smoother on phones. [OURS]
   Owner: "the game is performing poorly on mobile" (stutter, low FPS, taps react late on the map, while travelling, in fights, in menus).

   - Battery saver (Settings → Performance): the map, the road view and the fight picture are drawn less often and with
     fewer backing pixels, and weather/ambient particles are thinned. Off by default; on phones the normal settings are
     already lighter than on PCs (fightset.js picks Medium quality and 30 fps there until you choose otherwise).
   - Show performance: a small corner readout (frames per second, slow moments in the last 10 s, memory) to see what a
     phone copes with. Its own counting runs only while it's shown.

   Other modules ask:
     PERFMODE.saver()        → Battery saver on?
     PERFMODE.phone()        → a phone-sized touch screen (the lighter defaults)
     PERFMODE.gap(ms)        → the gap between two pictures to use instead of ms (longer with Battery saver)
     PERFMODE.dprCap(cap)    → the highest pixel density a big canvas may use (lower with Battery saver)
     PERFMODE.particles()    → 1, or less to thin out falling snow, rain, leaves, sparks */
const PERFMODE = (() => {
  const DOM = typeof document !== "undefined";
  const KEY = "rotn_prefs";
  const prefs = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const setPref = (k, v) => { try { const p = prefs(); p[k] = v; localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ } };
  let cache = null, cacheAt = 0;   // read the prefs at most twice a second (these are asked every frame)
  const P = () => { const now = Date.now(); if (!cache || now - cacheAt > 500) { cache = prefs(); cacheAt = now; } return cache; };
  const saver = () => P().battSaver === true;
  const phone = () => { try { return DOM && typeof matchMedia !== "undefined" && (matchMedia("(pointer: coarse)").matches || innerWidth < 760); } catch { return false; } };
  const gap = (ms) => (saver() ? Math.round(ms * 1.6) : ms);
  const dprCap = (cap) => (saver() ? Math.min(cap, 1.6) : cap);
  const particles = () => (saver() ? 0.45 : 1);

  // ---------------------------------------------------------------- the performance readout
  let box = null, raf = 0, frames = 0, t0 = 0, longs = [], obs = null, tick = 0;
  function startHud() {
    if (!DOM || box) return;
    box = document.createElement("div"); box.id = "perfhud"; box.setAttribute("aria-hidden", "true");
    document.body.appendChild(box);
    try { obs = new PerformanceObserver((l) => { const now = performance.now(); for (const e of l.getEntries()) longs.push([now, e.duration]); }); obs.observe({ type: "longtask" }); } catch { obs = null; }
    t0 = performance.now(); frames = 0;
    const f = (ts) => { frames++; raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    tick = setInterval(() => {
      const now = performance.now(), fps = (frames * 1000) / Math.max(1, now - t0); frames = 0; t0 = now;
      longs = longs.filter((e) => now - e[0] < 10000);
      const lt = longs.reduce((a, e) => a + e[1], 0), mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + " MB" : "";
      box.textContent = `${Math.round(fps)} fps · slow ${longs.length} (${Math.round(lt)} ms/10s)${mem ? " · " + mem : ""}${saver() ? " · saver" : ""}`;
      box.classList.toggle("bad", fps < 24 || lt > 800);
    }, 1000);
  }
  function stopHud() {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (tick) clearInterval(tick); tick = 0;
    try { obs?.disconnect(); } catch { /* old browsers */ } obs = null;
    box?.remove(); box = null; longs = [];
  }
  const hudOn = () => P().perfHud === true;
  function apply() {
    if (!DOM) return;
    try {   // test pages stub only parts of the page
      if (hudOn()) startHud(); else stopHud();
      document.documentElement?.classList?.toggle("battsaver", saver());
    } catch { /* no full page */ }
  }

  function settingsHTML(seg) {
    if (typeof seg !== "function") return "";
    return `<h3>Performance</h3>
      <div class="setrow"><span>Battery saver</span>${seg("battSaver", [[false, "Off"], [true, "On"]], saver())}</div>
      <p class="mute" style="font-size:13px">Draws the map, the road and fights a little less often and less sharp. Smoother on older phones, longer battery.</p>
      <div class="setrow"><span>Show performance</span>${seg("perfHud", [[false, "Off"], [true, "On"]], hudOn())}</div>`;
  }
  /* a Settings button was pressed: true when it was ours */
  function pref(k, v) {
    if (k !== "battSaver" && k !== "perfHud") return false;
    setPref(k, String(v) === "true"); cache = null; apply();
    return true;
  }
  if (DOM) { try { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply(); } catch { /* stubbed page */ } }
  return { saver, phone, gap, dprCap, particles, settingsHTML, pref, apply };
})();
if (typeof module !== "undefined") module.exports = PERFMODE;
