/* A slim foe plate and a fight log that stays out of the way. [OURS] (foepanel)
   Remigiusz (25 Nov 2026, PC screenshot of a bandit chief boss): "fix the UI covering the enemy, it should be simplistic",
   and "combat log should be scrollable".
   combat2.js lays the immersive fight screen out; this runs right after it (and after every re-layout) and:
   - The foe's plate is Skyrim-style: a small-caps name and a thin health bar, no dark box, status icons in one row under
     the bar, its next move as one small chip. Numbers and the rest of its moves show on hover (PC) or a tap on the plate.
     A boss already has its name and bar at the top of the screen, so its plate keeps only the icons and the next move.
   - The plate floats ABOVE the foe's head with a gap and never sits on a fighter: when there is no room above (a tall
     foe under the boss bar) it moves beside the foe, into the gap toward you, or behind it.
   - The fight log holds the whole fight: scroll it with a finger or the mouse wheel. It sticks to the newest line unless
     you scrolled up; then a small "↓ newest" chip takes you back. It sits in whichever corner has no fighter in it.
   Pure helpers (pick, overlap) are testable in node: tests/test_foepanel.js. */
const FOEPANEL = (() => {
  const DOM = typeof document !== "undefined";
  const T = (t) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(t) : t);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let log = { sess: null, held: false, top: 0, n: 0, userAt: 0 }, openSess = null, open = false;

  /* ------------------------------------------------------------------ pure geometry */
  const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const box = (L, Tp, w, h) => ({ left: L, top: Tp, right: L + w, bottom: Tp + h });
  /* the first spot that touches nothing (inside the bounds), else the one that covers the least */
  function pick(cands, w, h, avoid, bounds) {
    let best = null;
    for (const c of cands) {
      const L = clamp(c[0], bounds.left, bounds.right - w), Tp = clamp(c[1], bounds.top, bounds.bottom - h);
      const q = box(L, Tp, w, h);
      let hit = 0; for (const a of avoid) hit += area(q, a);
      const off = Math.abs(L - c[0]) + Math.abs(Tp - c[1]);   // pushed back into the screen: it no longer sits where it meant to
      const score = hit + off * 4 + (c[2] || 0);
      if (!best || score < best.score) best = { L, T: Tp, hit, score, i: cands.indexOf(c) };
      if (!hit && !off && !c[2]) break;
    }
    return best;
  }

  /* ------------------------------------------------------------------ where the fighters stand, in the overlay's px */
  function figs(el, ref) {
    const cv = el && el.querySelector(".fscene canvas"), L = cv && cv.__fp; if (!L || !cv.getBoundingClientRect) return null;
    const rc = cv.getBoundingClientRect(); if (!rc.width) return null;
    const z = (ref && ref.z) || 1, k = rc.width / L.W / z, ox = (rc.left - (ref ? ref.left : 0)) / z, oy = (rc.top - (ref ? ref.top : 0)) / z;
    const r = (p) => ({ left: ox + p.left * k, right: ox + p.right * k, top: oy + p.top * k, bottom: oy + p.y * k, x: ox + p.x * k });
    const foe = r(L.foe), shape = [foe];
    if (L.foe.kind === "dragon") {   // a dragon is a head and neck up front, a long low body and tail behind: two boxes, not one
      const mid = (foe.left + foe.right) / 2;
      shape[0] = { ...foe, right: mid };
      shape.push({ left: mid, right: foe.right, top: foe.top + (foe.bottom - foe.top) * 0.45, bottom: foe.bottom, x: foe.x });
    }
    return { foe, shape, hero: r(L.hero), others: [...(L.allies || []), ...(L.flyers || []), ...(L.waiting || []), ...(L.summon ? [L.summon] : [])].map(r) };
  }
  const rel = (n, ref) => { if (!n) return null; const b = n.getBoundingClientRect(), z = ref.z || 1; return b.width ? { left: (b.left - ref.left) / z, top: (b.top - ref.top) / z, right: (b.right - ref.left) / z, bottom: (b.bottom - ref.top) / z } : null; };
  /* the box the plate's left / top are measured in, and how much the page is zoomed there (Settings → text size zooms
     the whole page: its css px are bigger than the screen's) */
  function frame(n) {
    const b = n.getBoundingClientRect();
    return { left: b.left, top: b.top, z: n.offsetWidth ? b.width / n.offsetWidth || 1 : 1 };
  }

  /* ------------------------------------------------------------------ the plate */
  function plate(el, o) {
    const p = el.querySelector(".c2ov .tbu.foe"); if (!p) return null;
    const par = frame(p.offsetParent || el.querySelector(".tbin"));
    const F = figs(el, par); if (!F) return null;
    const pw = p.offsetWidth, ph = p.offsetHeight, gap = o.wide ? 12 : 8;
    const bf = rel(el.querySelector(".bfwrap"), par), strip = rel(el.querySelector(".tbtop"), par);
    const minTop = Math.max(strip ? strip.bottom : o.top, bf ? bf.bottom : 0) + 4;
    const bounds = { left: 6, right: o.W - 6, top: minTop, bottom: o.H - o.dh - 6 };
    const party = [...el.querySelectorAll(".c2ov .tbparty > .tbu, .c2ov .tbu.me")].map((n) => rel(n, par)).filter(Boolean);
    const f = F.foe, mid = (f.top + f.bottom) / 2;
    const avoid = [...F.shape, F.hero, ...F.others, ...party];
    const boss = p.classList.contains("fpl-boss") && bf;   // a boss's name and bar are at the top: its icons and next move sit right under them
    const cands = [
      ...(boss ? [[(bf.left + bf.right) / 2 - pw / 2, bf.bottom + 4]] : []),
      [f.x - pw / 2, f.top - gap - ph],                   // over its head
      [f.left - gap - pw, f.top + 4],                      // beside it, toward you
      [f.right + gap, f.top + 4],                          // behind it
      [f.left - gap - pw, mid - ph / 2],
      [f.right + gap, mid - ph / 2],
      [f.x - pw / 2, minTop, 1],                           // last resort: as high as it goes
    ];
    const b = boss ? { L: clamp(cands[0][0], bounds.left, bounds.right - pw), T: cands[0][1], i: 0 } : pick(cands, pw, ph, avoid, bounds);   // (part of the boss bar's HUD: it stays there)
    if (!b) return null;
    p.style.left = b.L.toFixed(1) + "px"; p.style.top = b.T.toFixed(1) + "px";
    const at = (boss ? ["boss"] : []).concat(["over", "near", "behind", "near", "behind", "top"])[b.i] || "over";
    p.classList.toggle("fpl-side", at === "near" || at === "behind");
    p.dataset.fplAt = at;
    return { par, F, plate: box(b.L, b.T, pw, ph), bf, party, bounds };
  }

  /* ------------------------------------------------------------------ the log: a corner with no fighter in it */
  function logSpot(el, o, P) {
    const lg = el.querySelector(".c2ov .tblog"); if (!lg || lg.hidden) return;
    const par = P ? P.par : frame(lg.offsetParent || el.querySelector(".tbin"));
    const F = P ? P.F : figs(el, par); if (!F) return;
    lg.classList.remove("fpl-at"); lg.style.left = lg.style.top = lg.style.maxWidth = ""; lg.style.width = "";
    const w = Math.round(o.wide ? clamp(o.W * 0.2, 240, 340) : clamp(o.W * 0.56, 170, 240));
    lg.style.width = w + "px";
    const h = lg.offsetHeight || 60;
    const strip = rel(el.querySelector(".tbtop"), par), bf = P ? P.bf : rel(el.querySelector(".bfwrap"), par);
    const top = Math.max(strip ? strip.bottom : o.top, 0) + 6, bot = o.H - o.dh - 8;
    const me = rel(el.querySelector(".c2ov .tbu.me"), par);
    const party = [...el.querySelectorAll(".c2ov .tbparty > .tbu")].map((n) => rel(n, par)).filter(Boolean);
    const pad = 6, fg = [...F.shape, F.hero, ...F.others].map((r) => ({ left: r.left - pad, right: r.right + pad, top: r.top - pad, bottom: r.bottom + pad }));
    const avoid = [...fg, ...(P ? [P.plate] : []), ...(bf ? [bf] : []), ...(me ? [me] : []), ...party];
    const R = o.W - 8 - w, L = 8, topB = (bf ? Math.max(top, bf.bottom + 6) : top);
    const cands = o.wide
      ? [[R, bot - h], [R, topB], [L, topB], [L, (me ? me.top : bot) - h - 6], [(o.W - w) / 2, topB]]
      : [[L, topB], [R, topB], [R, bot - h], [L, (me ? me.top : bot) - h - 6]];
    const b = pick(cands, w, h, avoid, { left: 6, right: o.W - 6, top, bottom: bot });
    if (!b) return;
    lg.style.left = b.L.toFixed(1) + "px"; lg.style.top = b.T.toFixed(1) + "px"; lg.classList.add("fpl-at");
    if (!log.held) lg.scrollTop = lg.scrollHeight;   // its width changed: keep the newest line in view
  }

  /* ------------------------------------------------------------------ after combat2.js placed everything */
  function place(el, o) {
    if (!DOM || !el || !el.classList.contains("c2")) return;
    let P = null;
    try { P = plate(el, o); } catch (e) { P = null; }
    try { logSpot(el, o, P); } catch (e) { /* the log keeps its CSS spot */ }
  }

  /* ------------------------------------------------------------------ after each redraw (tbfight.js, last) */
  function newest(lg, smooth) {
    log.held = false;
    lg.classList.remove("fpl-held");
    log.userAt = 0; lg.scrollTop = lg.scrollHeight;   // (a jump: a smooth glide would count as you scrolling)
  }
  function decorate(el, sess) {
    if (!DOM || !el) return;
    if (log.sess !== sess) log = { sess, held: false, top: 0, n: 0, userAt: 0 };
    if (openSess !== sess) { openSess = sess; open = false; }
    const p = el.querySelector(".c2ov .tbu.foe");
    if (p) {
      p.classList.add("fpl");
      p.classList.toggle("fpl-boss", !!(sess && sess.f && sess.f.bf && el.querySelector(".bfwrap")));
      p.classList.toggle("fpl-open", open);
      p.setAttribute("aria-label", T("The foe. Tap for its numbers and moves."));
      p.addEventListener("click", (ev) => {
        if (el.classList.contains("fc-aiming") || el.classList.contains("dragging")) return;
        if (ev.target.closest && ev.target.closest("button:not([data-fdc])")) return;
        open = !open; p.classList.toggle("fpl-open", open);
        if (typeof COMBAT2 !== "undefined") requestAnimationFrame(() => COMBAT2.place(el, true));
      });
    }
    const tele = el.querySelector(".bftele");   // one line: the how-to-answer part is in its tip (hover / hold)
    if (tele && !tele.dataset.tip) { const sm = tele.querySelector("small"); if (sm) tele.dataset.tip = sm.textContent; }
    const lg = el.querySelector(".tblog");
    if (lg) {
      lg.classList.add("fpl-log");
      delete lg.dataset.tip;   // the help tip sat over the lines: the label says it instead
      lg.setAttribute("aria-label", T("Fight log: scroll for the whole fight, tap to open it big"));
      const lines = lg.querySelectorAll(".tbl").length;
      const chip = document.createElement("span");
      chip.className = "fpl-new"; chip.setAttribute("role", "button"); chip.tabIndex = 0;
      chip.textContent = "↓ " + T("newest");
      chip.addEventListener("click", (ev) => { ev.stopPropagation(); ev.preventDefault(); newest(lg, true); });
      lg.appendChild(chip);
      const restore = () => {
        if (log.held) { lg.scrollTop = log.top; lg.classList.add("fpl-held"); }
        else lg.scrollTop = lg.scrollHeight;
      };
      restore();
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(restore);
      log.n = lines;
      // only your own scrolling holds it: the log growing or moving is not you reading back
      const touch = () => { log.userAt = Date.now(); };
      for (const k of ["wheel", "touchstart", "pointerdown", "keydown"]) lg.addEventListener(k, touch, { passive: true });
      lg.addEventListener("scroll", () => {
        const up = lg.scrollHeight - lg.scrollTop - lg.clientHeight;
        if (Date.now() - (log.userAt || 0) > 1200) { if (!log.held && up > 1) lg.scrollTop = lg.scrollHeight; return; }
        log.held = up > 6; log.top = lg.scrollTop;
        lg.classList.toggle("fpl-held", log.held);
      }, { passive: true });
      // a drag to scroll is not a tap: no full log when the finger moved
      let y0 = null, moved = false;
      lg.addEventListener("pointerdown", (ev) => { y0 = ev.clientY; moved = false; }, { passive: true });
      lg.addEventListener("pointermove", (ev) => { if (y0 != null && Math.abs(ev.clientY - y0) > 6) moved = true; }, { passive: true });
      lg.addEventListener("click", (ev) => { if (moved) { ev.stopPropagation(); ev.preventDefault(); } moved = false; y0 = null; }, true);
    }
  }
  const logHeld = () => !!log.held;

  return { pick, area, figs, place, decorate, logHeld };
})();
if (typeof module !== "undefined") module.exports = FOEPANEL;
