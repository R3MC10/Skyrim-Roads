/* uinordic.js: the Nordic UI look's moving parts. [OURS]
   Sliders: the track is gold up to the knob (--fill). The knob is two layers like the menu compass: a still bronze ring
   and a star that rolls as you drag it (faster drag, faster spin) and coasts to a stop when you let go. A quick drag
   throws gold sparks, the gold part of the track warms for a moment, and a soft metal tick plays every few steps.
   The real <input type=range> stays underneath (keys, screen readers, the game's own handlers); its own thumb is hidden
   only while the knob pictures are loaded. No spin, sparks or glow when the game's Motion setting is off or the phone
   asks for reduced motion. */
const UINORDIC = (() => {
  const calm = () => { try { return typeof MOTION !== "undefined" ? !MOTION.on() : matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const lite = () => { try { return typeof MOTION !== "undefined" && MOTION.lite(); } catch (e) { return false; } };
  const frac = (el) => { const min = +el.min || 0, max = el.max === "" ? 100 : +el.max; return max > min ? Math.min(1, Math.max(0, (+el.value - min) / (max - min))) : 0; };
  const fill = (el) => el.style.setProperty("--fill", (frac(el) * 100).toFixed(1) + "%");
  const knobs = new Map();   // input → { k, star, ang, vel, last, raf, tickAt, glowT }

  /* put the knob over the slider's thumb */
  function place(el, K) {
    const p = el.offsetParent; if (!p) return;
    const r = el.getBoundingClientRect(), pr = p.getBoundingClientRect(), S = 32;
    const x = r.left - pr.left + p.scrollLeft + S / 2 + frac(el) * (r.width - S), y = r.top - pr.top + p.scrollTop + r.height / 2;
    K.k.style.transform = `translate(${(x - S / 2).toFixed(1)}px,${(y - S / 2).toFixed(1)}px)`;
  }
  function knobFor(el) {
    let K = knobs.get(el);
    if (K && K.k.isConnected) return K;
    const p = el.parentElement; if (!p) return null;
    if (getComputedStyle(p).position === "static") p.style.position = "relative";
    const k = document.createElement("span"); k.className = "uiknob"; k.setAttribute("aria-hidden", "true");
    k.innerHTML = '<i class="uik-ring"></i><i class="uik-star"></i>';
    p.appendChild(k);
    K = { k, star: k.lastChild, ang: 0, vel: 0, last: null, raf: 0, tickAt: frac(el), glowT: 0 };
    knobs.set(el, K); place(el, K);
    return K;
  }
  function spin(K) {
    if (K.raf) return;
    const step = () => {
      K.ang += K.vel; K.vel *= 0.9;   // coasts to a stop
      K.star.style.transform = `rotate(${K.ang.toFixed(1)}deg)`;
      K.raf = Math.abs(K.vel) > 0.05 ? requestAnimationFrame(step) : 0;
    };
    K.raf = requestAnimationFrame(step);
  }
  function sparks(el, K, speed, dir) {
    const n = Math.min(lite() ? 4 : 10, 2 + Math.floor(speed)); 
    const box = K.k.parentElement, br = box.getBoundingClientRect(), kr = K.k.getBoundingClientRect();
    const cx = kr.left - br.left + box.scrollLeft + kr.width / 2, cy = kr.top - br.top + box.scrollTop + kr.height / 2;
    for (let i = 0; i < n; i++) {
      const s = document.createElement("i"); s.className = "uispark";
      // thrown backwards off the spinning star (like a grindstone), up and out, then falling
      const a = (dir > 0 ? Math.PI : 0) + (Math.random() - 0.5) * 1.6, d = 18 + Math.random() * 34;
      const sz = 2 + Math.random() * 3;
      s.style.left = (cx + (Math.random() - 0.5) * 10) + "px"; s.style.top = (cy + (Math.random() - 0.5) * 10) + "px";
      s.style.width = s.style.height = sz.toFixed(1) + "px";
      s.style.setProperty("--dx", (Math.cos(a) * d).toFixed(1) + "px"); s.style.setProperty("--dy", (Math.sin(a) * d * 0.6 - 10 - Math.random() * 12).toFixed(1) + "px");
      s.style.setProperty("--fall", (14 + Math.random() * 14).toFixed(1) + "px");
      s.style.animationDuration = (0.45 + Math.random() * 0.35).toFixed(2) + "s";
      box.appendChild(s); setTimeout(() => s.remove(), 900);
    }
  }
  function moved(el) {
    fill(el);
    const K = knobFor(el); if (!K) return;
    place(el, K);
    const f = frac(el), now = performance.now();
    // ratchet tick every 5%
    if (Math.abs(f - K.tickAt) >= 0.05) { K.tickAt = f; try { if (typeof SOUND !== "undefined") SOUND.fx("click"); } catch (e) { /* never break the game */ } }
    if (calm()) { K.last = { f, t: now }; return; }
    if (K.last) {
      const dt = Math.max(8, now - K.last.t), dfx = (f - K.last.f) * (el.getBoundingClientRect().width || 200);
      K.vel = (dfx / 16) * 22;   // the star rolls along the track like a wheel
      spin(K);
      const speed = Math.abs(dfx) / dt * 16;
      if (speed > 3) sparks(el, K, speed / 4, Math.sign(dfx));
    }
    K.last = { f, t: now };
    el.classList.add("uiglow"); clearTimeout(K.glowT); K.glowT = setTimeout(() => el.classList.remove("uiglow"), 380);
  }
  const scan = (root) => { try { root.querySelectorAll?.("input[type=range]").forEach((el) => { fill(el); if (document.documentElement.classList.contains("has-ui-knob-star")) { const K = knobFor(el); if (K) place(el, K); } }); } catch (e) { /* never break the game */ } };
  function start() {
    if (typeof document === "undefined") return;
    const on = (e) => { if (e.target?.type === "range") moved(e.target); };
    document.addEventListener("input", on, true);
    document.addEventListener("change", (e) => { if (e.target?.type === "range") fill(e.target); }, true);
    document.addEventListener("pointerup", () => { for (const K of knobs.values()) K.last = null; }, true);
    let t = 0;
    const later = () => { if (!t) t = setTimeout(() => { t = 0; scan(document); }, 60); };
    new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
    addEventListener("resize", later);
    document.addEventListener("scroll", later, true);
    scan(document);
  }
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start(); }
  return { fill, scan };
})();
if (typeof module !== "undefined") module.exports = UINORDIC;
