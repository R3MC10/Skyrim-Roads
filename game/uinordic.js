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
  /* sparks (sparks.js), like a grinding wheel: the star rolls along the track, and where it rubs the track (its
     bottom edge) hot bits are flung off tangentially, backwards from the way it's going and a little up. Faster
     drags throw more, faster sparks; they also carry some of the knob's own motion. They're cut out where the
     knob is, so they come from behind the star, not in front of it. */
  function sparks(el, K, pxPerSec, dir) {
    if (typeof SPARKS === "undefined") return;
    const kr = K.k.getBoundingClientRect(), tr = el.getBoundingClientRect();
    const cx = kr.left + kr.width / 2, ty = tr.top + tr.height / 2, rimY = ty - 3;
    const n = Math.min(18, Math.max(2, Math.round(pxPerSec / 80)));
    const sp = 0.9 + Math.min(2.2, pxPerSec / 700);          // in the spark system's "m/s"
    SPARKS.burst(cx - dir * 6, rimY, -dir, -0.62, n, sp, { spread: 0.5, floor: ty + 3, flash: pxPerSec > 500,
      carry: [dir * Math.min(pxPerSec, 900) * 0.25, 0],
      occlude: () => {   // the knob's own outline (ring, and the star at its current turn), so sparks pass behind it
        const r = K.k.getBoundingClientRect(); if (!r.width) return null;
        const A = typeof ASSETS !== "undefined" ? ASSETS : null;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width, r: r.width * 0.45,
          imgs: A ? [{ img: A.img("ui-knob-ring") }, { img: A.img("ui-knob-star"), rot: K.ang * Math.PI / 180 }] : null };
      } });
  }
  function moved(el) {
    fill(el);
    const K = knobFor(el); if (!K) return;
    place(el, K);
    const f = frac(el), now = performance.now();
    // ratchet tick every 5% on a slow drag; a fast drag grinds instead (sfx-ui-tick / sfx-ui-grind, uisfx.js names)
    const fast = K.last && Math.abs(f - K.last.f) * (el.getBoundingClientRect().width || 200) / Math.max(8, now - K.last.t) * 1000 > 450;
    if (Math.abs(f - K.tickAt) >= 0.05) { K.tickAt = f; try { if (typeof SOUND !== "undefined") SOUND.fx(fast ? "ui-grind" : "ui-tick"); } catch (e) { /* never break the game */ } }
    if (calm()) { K.last = { f, t: now }; return; }
    if (K.last) {
      const dt = Math.max(8, now - K.last.t), dfx = (f - K.last.f) * (el.getBoundingClientRect().width || 200);
      K.vel = (dfx / 16) * 22;   // the star rolls along the track like a wheel
      spin(K);
      const pxs = Math.abs(dfx) / dt * 1000;   // how fast the knob is travelling, px per second
      if (pxs > 40) sparks(el, K, pxs, Math.sign(dfx));
    }
    K.last = { f, t: now };
    el.classList.add("uiglow"); clearTimeout(K.glowT); K.glowT = setTimeout(() => el.classList.remove("uiglow"), 380);
  }
  const scan = (root) => { try { root.querySelectorAll?.("input[type=range]").forEach((el) => { fill(el); if (document.documentElement.classList.contains("has-ui-knob-star")) { const K = knobFor(el); if (K) place(el, K); } }); } catch (e) { /* never break the game */ } };
  /* buttons and switches: a glint of light sweeps across a framed button when it's pressed; a newly chosen option
     flashes gold and its frame twinkles once. (The press itself, sinking 1px and darkening, is plain CSS.) */
  function glint(btn) {
    if (calm() || !document.documentElement.classList.contains("has-ui-frame-btn")) return;
    const i = document.createElement("i"); i.className = "uiglint"; i.setAttribute("aria-hidden", "true");
    btn.appendChild(i); setTimeout(() => i.remove(), 650);
  }
  function chosen(btn) {
    if (calm()) return;
    // the game may redraw the whole page on a choice: find the same switch again by its place on the page
    const segs = [...document.querySelectorAll(".seg")], si = segs.indexOf(btn.closest(".seg")), bi = [...btn.parentElement.children].indexOf(btn);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const seg = btn.isConnected ? btn.closest(".seg") : document.querySelectorAll(".seg")[si];
      const b = seg && (seg.querySelector("button.on") || seg.children[bi]); if (!b) return;
      b.classList.remove("uiflash"); void b.offsetWidth; b.classList.add("uiflash");
      setTimeout(() => b.classList.remove("uiflash"), 700);
    }));
  }
  /* a window opening: a warm glint runs once round its bronze frame, starting at the top-left corner */
  function frameGlint(box) {
    if (calm() || !box || box.querySelector(":scope > .uiframeglint") || !document.documentElement.classList.contains("has-ui-frame-panel")) return;
    const i = document.createElement("i"); i.className = "uiframeglint"; i.setAttribute("aria-hidden", "true");
    box.appendChild(i); setTimeout(() => i.remove(), 1200);
  }
  function opened(n) {
    if (n.nodeType !== 1) return;
    const boxes = n.matches?.(".title .page:not(.still), .modal .sheet:not(.hz-fs)") ? [n] : [...(n.querySelectorAll?.(".page:not(.still), .modal .sheet:not(.hz-fs)") || [])];
    for (const b of boxes) if (b.closest(".title, .modal")) frameGlint(b);
  }
  function start() {
    if (typeof document === "undefined") return;
    document.addEventListener("pointerdown", (e) => { const b = e.target.closest?.(".btn"); if (b && !b.disabled) glint(b); }, true);
    document.addEventListener("click", (e) => { const b = e.target.closest?.(".seg button"); if (b) chosen(b); }, true);
    const on = (e) => { if (e.target?.type === "range") moved(e.target); };
    document.addEventListener("input", on, true);
    document.addEventListener("change", (e) => { if (e.target?.type === "range") fill(e.target); }, true);
    document.addEventListener("pointerup", () => { for (const K of knobs.values()) K.last = null; }, true);
    let t = 0;
    const later = () => { if (!t) t = setTimeout(() => { t = 0; scan(document); }, 60); };
    new MutationObserver((ms) => { later(); for (const m of ms) m.addedNodes.forEach(opened); }).observe(document.body, { childList: true, subtree: true });
    addEventListener("resize", later);
    document.addEventListener("scroll", later, true);
    scan(document);
  }
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start(); }
  return { fill, scan };
})();
if (typeof module !== "undefined") module.exports = UINORDIC;
