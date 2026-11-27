/* Fight screen settings (Settings → Fights). [OURS]
   Owner: "settings: quality preset, camera intensity slider, UI scale slider, frame-rate cap".
   - Fight quality (Low / Medium / High): how sharp the fight picture is drawn (Low draws it at plain screen pixels and
     leaves out the weather and the blurred glow behind the picture; High is the sharpest on tablets and PCs).
   - Fight camera (Cinematic / Calm / Off): how the camera moves on big moments (fightcam.js). Cinematic is the default;
     Calm moves gently with no tilt, shake or slow motion (Reduce motion forces it); Off keeps the picture fixed.
   - Camera shake (0–100%): how hard big hits shake the picture (Cinematic only). 0 keeps it steady.
   - Fight UI size (80–130%): the skill bar, the cards and your health orb on the fight screen.
   - Frame rate (30 / 60 / no cap): 30 saves battery on phones.
   fightart.js asks dpr(), weather(), cam() and frameMs(); fightcam.js reads fsCamMode; combat2.js uses backdrop() and the --c2ui size on #tbf. */
const FIGHTSET = (() => {
  const DOM = typeof document !== "undefined";
  const KEY = "rotn_prefs";
  const prefs = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const setPref = (k, v) => { try { const p = prefs(); p[k] = v; localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ } };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const numOr = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);

  const QUALITY = ["low", "med", "high"], FPS = [30, 60, 0];
  const PM = () => (typeof PERFMODE !== "undefined" ? PERFMODE : null);
  /* [perf] phones start lighter (Medium, 30 fps) until you pick something; Battery saver caps both */
  const quality = () => { const q = QUALITY.includes(prefs().fsQuality) ? prefs().fsQuality : PM()?.phone() ? "med" : "high"; return PM()?.saver() && q === "high" ? "med" : q; };
  const cam = () => clamp(numOr(prefs().fsCam, 1), 0, 1);            // 0 … 1
  const uiScale = () => clamp(numOr(prefs().fsUi, 1), 0.8, 1.3);     // 0.8 … 1.3
  const fps = () => { const f = FPS.includes(prefs().fsFps) ? prefs().fsFps : PM()?.phone() ? 30 : 0; return PM()?.saver() && (f === 0 || f > 30) ? 30 : f; };
  const CAMS = ["cin", "calm", "off"];
  const camMode = () => (CAMS.includes(prefs().fsCamMode) ? prefs().fsCamMode : "cin");   // the chosen one; FIGHTCAM.mode() is the one in force
  /* backing pixels per drawing unit the fight picture may use */
  const dpr = () => ({ low: 1, med: 2, high: 6 })[quality()];
  const weather = () => quality() !== "low";
  const backdrop = () => quality() !== "low";
  /* the shortest gap between two drawn frames (0: draw every frame the screen offers) */
  const frameMs = () => (fps() ? 1000 / fps() - 2 : 0);

  function apply() {
    if (!DOM) return;
    const el = document.getElementById("tbf");
    if (el) {
      el.style.setProperty("--c2ui", String(uiScale())); el.style.setProperty("--c2cam", String(cam()));
      const m = typeof FIGHTCAM !== "undefined" ? FIGHTCAM.mode() : camMode();   // [fightcam] Calm and Off: the screen never shakes either
      el.classList.toggle("fcam-calm", m === "calm"); el.classList.toggle("fcam-off", m === "off");
    }
  }

  const pct = (v) => `${Math.round(v * 100)}%`;
  function settingsHTML(seg) {
    if (typeof seg !== "function") return "";
    const sl = (id, label, min, max, step, v) => `<label class="sndrow fsrow"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${Math.round(v * 100)}" aria-label="${label}"><b class="num" id="${id}_v">${pct(v)}</b></label>`;
    return `<div class="setrow"><span>Fight quality</span>${seg("fsQuality", [["low", "Low"], ["med", "Medium"], ["high", "High"]], quality())}</div>
      <div class="setrow"><span>Fight camera</span>${seg("fsCamMode", [["cin", "Cinematic"], ["calm", "Calm"], ["off", "Off"]], camMode())}</div>
      <div class="setrow"><span>Frame rate</span>${seg("fsFps", [[30, "30"], [60, "60"], [0, "No cap"]], fps())}</div>
      ${sl("fs_cam", "Camera shake", 0, 100, 10, cam())}${sl("fs_ui", "Fight UI size", 80, 130, 5, uiScale())}`;
  }
  /* a Settings button was pressed: true when it was ours */
  function pref(k, v) {
    if (k === "fsQuality") { setPref("fsQuality", QUALITY.includes(String(v)) ? String(v) : "high"); return true; }
    if (k === "fsCamMode") { setPref("fsCamMode", CAMS.includes(String(v)) ? String(v) : "cin"); apply(); return true; }
    if (k === "fsFps") { const n = +v; setPref("fsFps", FPS.includes(n) ? n : 0); return true; }
    return false;
  }
  /* a slider moved: true when it was ours */
  function input(t) {
    if (!t || (t.id !== "fs_cam" && t.id !== "fs_ui")) return false;
    const v = clamp(+t.value / 100, t.id === "fs_cam" ? 0 : 0.8, t.id === "fs_cam" ? 1 : 1.3);
    setPref(t.id === "fs_cam" ? "fsCam" : "fsUi", v);
    const lab = DOM && document.getElementById(t.id + "_v"); if (lab) lab.textContent = pct(v);
    apply();
    return true;
  }

  return { QUALITY, FPS, CAMS, quality, cam, camMode, uiScale, fps, dpr, weather, backdrop, frameMs, apply, settingsHTML, pref, input };
})();
if (typeof module !== "undefined") module.exports = FIGHTSET;
