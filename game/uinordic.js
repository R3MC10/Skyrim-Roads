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
  /* sparks: a small particle system on one screen-wide canvas. Each spark is a hot streak drawn from where it was to
     where it is (so it looks motion-blurred), white-hot at first, cooling through yellow and orange to dull red;
     it's thrown off the spinning star, slows in the air, falls, and a few bounce once off the track. */
  let cv = null, g = null, P = [], loopOn = false, lastT = 0;
  function canvas() {
    if (cv && cv.isConnected) return g;
    cv = document.createElement("canvas"); cv.className = "uisparks"; cv.setAttribute("aria-hidden", "true");
    document.body.appendChild(cv); g = cv.getContext("2d"); size(); addEventListener("resize", size);
    return g;
  }
  function size() { if (!cv) return; const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0); }
  const heat = (t) => {   // 0 = just born (white-hot) … 1 = cold
    const c = [[255, 252, 235], [255, 228, 140], [255, 160, 60], [210, 70, 20], [120, 30, 10]], x = Math.min(0.999, Math.max(0, t)) * (c.length - 1), i = Math.floor(x), f = x - i;
    return c[i].map((v, k) => Math.round(v + (c[i + 1][k] - v) * f));
  };
  function frame(ts) {
    const dt = Math.min(0.033, Math.max(0.004, (ts - lastT) / 1000 || 0.016)); lastT = ts;   // a frame's time can come in before the spark's own
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.globalCompositeOperation = "lighter"; g.lineCap = "round";
    P = P.filter((p) => {
      p.age += dt; if (p.age > p.life) return false;
      p.px = p.x; p.py = p.y;
      p.vx *= 1 - 2.2 * dt; p.vy = p.vy * (1 - 2.2 * dt) + 900 * dt;   // air drag, gravity
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor != null && p.y > p.floor && p.vy > 0 && !p.bounced) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.6; p.bounced = true; }
      const t = p.age / p.life, [r, gg, b] = heat(t), a = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
      // the streak: longer when fast; a soft glow under a thin bright core
      const sx = p.x - (p.x - p.px) * 2.2, sy = p.y - (p.y - p.py) * 2.2;
      g.strokeStyle = `rgba(${r},${Math.round(gg * 0.8)},${Math.round(b * 0.5)},${(0.35 * a).toFixed(3)})`; g.lineWidth = p.w * 3;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(p.x, p.y); g.stroke();
      g.strokeStyle = `rgba(${r},${gg},${b},${a.toFixed(3)})`; g.lineWidth = p.w;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(p.x, p.y); g.stroke();
      return true;
    });
    g.globalCompositeOperation = "source-over";
    if (P.length) requestAnimationFrame(frame); else { loopOn = false; g.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function sparks(el, K, speed, dir) {
    if (!canvas()) return;
    const n = Math.min(lite() ? 5 : 14, 1 + Math.round(speed * 1.6));
    const kr = K.k.getBoundingClientRect(), tr = el.getBoundingClientRect();
    const cx = kr.left + kr.width / 2, cy = kr.top + kr.height / 2, floor = tr.top + tr.height / 2 + 2;
    for (let i = 0; i < n; i++) {
      // thrown backwards off the star's edge (a grindstone), mostly up and out
      const ang = (dir > 0 ? Math.PI : 0) + (dir > 0 ? 1 : -1) * (0.15 + Math.random() * 0.9), v = 160 + Math.random() * 260 + speed * 40;
      P.push({ x: cx + (Math.random() - 0.5) * 8, y: cy - 4 + (Math.random() - 0.5) * 8, vx: Math.cos(ang) * v, vy: -Math.abs(Math.sin(ang)) * v * 0.9 - 40,
        age: 0, life: 0.35 + Math.random() * 0.45, w: 0.8 + Math.random() * 1.1, floor: Math.random() < 0.4 ? floor : null });
    }
    if (P.length > 160) P.splice(0, P.length - 160);
    if (!loopOn) { loopOn = true; lastT = performance.now(); requestAnimationFrame(frame); }
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
      if (speed > 1.2) sparks(el, K, speed / 4, Math.sign(dfx));
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
