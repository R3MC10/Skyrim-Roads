/* mg_games.js: a fight minigame of its own for every weapon type, spell school and move. [OURS] [mgunique]
   Owner (27 Nov 2026): "Mini games in combat should be unique by weapon type, by spell school, by action."
   minigame.js decides which game a move gets (MINIGAME.kindFor → g.id) and keeps the grade tables (Good = a normal
   hit, Perfect/Miss as before, power attacks bigger both ways). This file only registers the games themselves:
     weapons  dagger (stab-stab rhythm) · sword (slash along the arc) · war axe (hold, let go at the top of the wind-up)
              mace (tap on the downbeat of the swing) · greatsword (wind up, then follow through) · battleaxe (charge,
              let go in the sweet spot before it overheats) · warhammer (tap as the falling hammer meets the ring)
              spear (thrust when the gap lines up) · bow (draw and release, the target sways in the wind)
              crossbow (tap when the crosshair settles) · fists (left/right combo) · two blades (two lanes)
              A power attack plays the same game harder: faster, a tighter window, red-gold look.
     moves    guard (the blow closes in: an arrow, a claw, a spell or a blade, by the foe) · shield bash (shove forward
              as the foe meets your shield) · shout (hold on the first word, let go on the last) · sneak strike
              (strike while the foe looks away, before your stealth runs out)
     spells   Destruction: fire traces a flame, frost holds steady on the crystal, shock is a quick zigzag ·
              Restoration: the calm circle (healing an ally: drag the light from you to them) · Alteration: turn the
              ward's pieces into place · Conjuration: open the star, then hold the portal open · Illusion: drifting
              wisps in order · Mysticism: tap the mirror image · any dual cast: both thumbs at once.
   Every game is quick (about 2-3 s), works by thumb, Space/Enter on PC, and scores 0..1 for MINIGAME.grade
   (0.75+ Perfect, 0.35+ Good). Skill and "timing" perks widen the windows (w). */
const MGGAMES = (() => {
  if (typeof MINIGAME === "undefined" || !MINIGAME.register) return {};
  const clamp = (v) => Math.max(0, Math.min(1, v));
  /* timing error → score: inside tol is Perfect (1..0.75), up to ~3.5 tol is Good, beyond a Miss */
  const tscore = (err, tol) => (err <= tol ? 1 - (err / tol) * 0.25 : Math.max(0, 0.7 - (err - tol) / (tol * 2.5)));
  const pow = (g) => g.kind === "power" || !!g.hard;
  const R = (n) => (+n).toFixed(1);
  /* one game: its picture (an SVG 100x100), a clock, input → score */
  function game(host, g, o, w, K, spec) {
    return new Promise((done) => {
      const el = K.shell(host, g, o, `<svg class="mgx" viewBox="0 0 100 100" aria-hidden="true">${spec.svg}</svg>`, spec.hint);
      const t0 = K.now(); let raf = 0, unkey = () => {};
      const stop = () => { cancelAnimationFrame(raf); unkey(); };
      const c = {
        el, w, g, svg: el.querySelector("svg"),
        t: () => K.now() - t0,
        q: (sel) => el.querySelector(sel), qa: (sel) => [...el.querySelectorAll(sel)],
        end: (score) => { if (el._fin) return; const gr = K.grade(clamp(score), g); if (gr.cls !== "poor") sfx(spec.sound || "swoosh"); K.finish(el, gr, done, stop); },
        progress: (p) => { if (o.onProgress) try { o.onProgress(clamp(p)); } catch (e) { /* ignore */ } },
        st: {},
      };
      if (spec.init) spec.init(c);
      const tick = () => {
        if (el._fin) return;
        if (c.t() > spec.limit) return c.end(spec.timeout ? spec.timeout(c) : 0);
        try { if (spec.frame) spec.frame(c); } catch (e) { console.error("minigame frame", g.id, e); return c.end(0.5); }
        if (!el._fin) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      const pt = (ev) => { const r = c.svg.getBoundingClientRect(); return { x: ((ev.clientX - r.left) / r.width) * 100, y: ((ev.clientY - r.top) / r.height) * 100 }; };
      const safe = (fn, ...a) => { if (el._fin || !fn) return; try { fn(c, ...a); } catch (e) { console.error("minigame input", g.id, e); c.end(0.5); } };
      el.addEventListener("pointerdown", (ev) => { buzz(); ev.preventDefault(); ev.stopPropagation(); try { el.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } c.st.down = pt(ev); safe(spec.down, pt(ev)); });
      el.addEventListener("pointermove", (ev) => { if (c.st.down) safe(spec.move, pt(ev)); });
      el.addEventListener("pointerup", (ev) => { ev.preventDefault(); ev.stopPropagation(); const d = c.st.down; c.st.down = null; safe(spec.up, pt(ev), d); });
      el.addEventListener("pointercancel", () => { const d = c.st.down; c.st.down = null; safe(spec.up, null, d); });
      el.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); });
      unkey = K.keys(() => safe(spec.key || spec.down, null), spec.up || spec.keyup ? () => safe(spec.keyup || spec.up, null, null) : null);
    });
  }
  /* feel: a tiny buzz on every touch, the move's own sound when it lands */
  const buzz = () => { try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(5); } catch (e) { /* ignore */ } };
  const sfx = (n) => { try { if (typeof SOUND !== "undefined" && SOUND.fx) SOUND.fx(n); } catch (e) { /* ignore */ } };
  const label = (x, y, t, cls = "mgx-t") => `<text class="${cls}" x="${x}" y="${y}">${t}</text>`;

  // ------------------------------------------------------------------ weapons
  /* dagger: two quick stabs on the beat (a power attack: three, faster) */
  MINIGAME.register("dagger", (host, g, o, w, K) => {
    const P = pow(g), beats = P ? [420, 690, 960] : [520, 880], tol = 85 * w * (P ? 0.75 : 1);
    const xs = beats.map((_, i) => 25 + (50 / Math.max(1, beats.length - 1)) * i);
    return game(host, g, o, w, K, {
      hint: P ? "Stab on each beat: three quick ones" : "Stab twice, on the beats",
      limit: beats[beats.length - 1] + 450,
      svg: `<path class="mgx-line" d="M15 70H85"/>${xs.map((x, i) => `<circle class="mgx-beat" data-i="${i}" cx="${x}" cy="45" r="9"/>`).join("")}<path class="mgx-blade" d="M50 92l-4-14h8z"/>`,
      init: (c) => { c.st.hits = []; },
      frame: (c) => { const t = c.t(); c.qa(".mgx-beat").forEach((d, i) => { const k = Math.abs(t - beats[i]); d.classList.toggle("on", k < 140); d.setAttribute("r", R(9 + Math.max(0, 1 - k / 300) * 5)); }); },
      down: (c) => { const t = c.t(), i = c.st.hits.length; if (i >= beats.length) return; c.st.hits.push(tscore(Math.abs(t - beats[i]), tol)); c.q(`.mgx-beat[data-i="${i}"]`)?.classList.add("done"); c.progress(c.st.hits.length / beats.length); if (c.st.hits.length >= beats.length) c.end(c.st.hits.reduce((a, b) => a + b, 0) / beats.length); },
      timeout: (c) => c.st.hits.reduce((a, b) => a + b, 0) / beats.length,
    });
  });
  /* one-handed sword: slash along the arc as the glint runs it; let go when it reaches the end */
  MINIGAME.register("sword", (host, g, o, w, K) => {
    const P = pow(g), D = P ? 720 : 900, T = 300 + D, tol = 100 * w * (P ? 0.75 : 1);
    const at = (u) => { const a = 1 - u; return [a * a * 15 + 2 * a * u * 50 + u * u * 85, a * a * 75 + 2 * a * u * 12 + u * u * 75]; };
    return game(host, g, o, w, K, {
      hint: "Swipe along the arc, let go as the glint reaches the end",
      limit: T + 700,
      svg: `<path class="mgx-arc" d="M15 75Q50 12 85 75"/><circle class="mgx-end" cx="85" cy="75" r="8"/><circle class="mgx-glint" cx="15" cy="75" r="5"/>`,
      frame: (c) => { const u = Math.max(0, Math.min(1, (c.t() - 300) / D)); const [x, y] = at(u); const gl = c.q(".mgx-glint"); gl.setAttribute("cx", R(x)); gl.setAttribute("cy", R(y)); c.q(".mgx-end").classList.toggle("on", Math.abs(c.t() - T) < tol); },
      down: () => {},
      up: (c, p, d) => { const swipe = p && d ? Math.hypot(p.x - d.x, p.y - d.y) > 14 : true; c.end(tscore(Math.abs(c.t() - T), tol) * (swipe ? 1 : 0.85)); },
    });
  });
  /* war axe: hold to wind up, let go at the very top */
  MINIGAME.register("axe", (host, g, o, w, K) => {
    const P = pow(g), Pd = P ? 900 : 1100, tol = 95 * w * (P ? 0.75 : 1);
    return game(host, g, o, w, K, {
      hint: "Hold to wind up, let go at the top",
      limit: 3200,
      svg: `<path class="mgx-line" d="M50 88V14"/><path class="mgx-peak" d="M38 14H62"/><g class="mgx-head" transform="translate(0 0)"><path d="M50 82l-12-6v12z M50 82l12-6v12z"/></g>`,
      init: (c) => { c.st.h = 0; },
      frame: (c) => { if (!c.st.h) return; const u = (c.t() - c.st.h) / Pd, y = -68 * Math.sin(Math.PI * Math.min(1, u)); c.q(".mgx-head").setAttribute("transform", `translate(0 ${R(y)})`); c.q(".mgx-peak").classList.toggle("on", Math.abs(c.t() - c.st.h - Pd / 2) < tol); c.progress(Math.min(1, u * 2)); if (u > 1.05) c.end(0); },
      down: (c) => { if (!c.st.h) c.st.h = c.t(); },
      up: (c) => { if (!c.st.h) return; c.end(tscore(Math.abs(c.t() - c.st.h - Pd / 2), tol)); },
      timeout: () => 0,
    });
  });
  /* mace: tap on the heavy downbeat of the swinging pendulum */
  MINIGAME.register("mace", (host, g, o, w, K) => {
    const P = pow(g), T = P ? 860 : 1100, tol = 80 * w * (P ? 0.75 : 1);
    const ang = (t) => 62 * Math.cos((2 * Math.PI * t) / T);
    return game(host, g, o, w, K, {
      sound: "hit", hint: "Tap as the mace swings through the bottom",
      limit: T * 2.3,
      svg: `<circle class="mgx-zone" cx="50" cy="84" r="10"/><g class="mgx-pend"><path class="mgx-line" d="M50 12V78"/><circle class="mgx-ball" cx="50" cy="82" r="8"/></g><circle class="mgx-pin" cx="50" cy="12" r="3"/>`,
      frame: (c) => { const a = ang(c.t()); c.q(".mgx-pend").setAttribute("transform", `rotate(${R(a)} 50 12)`); c.q(".mgx-zone").classList.toggle("on", Math.abs(a) < 12); },
      down: (c) => { const t = c.t(), k = Math.round((t - T / 4) / (T / 2)), near = T / 4 + k * (T / 2); c.end(tscore(Math.abs(t - near), tol)); },
    });
  });
  /* greatsword: hold to wind up into the gold band, then tap as the follow-through crosses the mark */
  MINIGAME.register("greatsword", (host, g, o, w, K) => {
    const P = pow(g), D1 = P ? 620 : 740, D2 = P ? 560 : 680, tol = 95 * w * (P ? 0.75 : 1);
    return game(host, g, o, w, K, {
      hint: "Hold, let go in the gold, then tap on the mark",
      limit: 3600,
      svg: `<rect class="mgx-tube" x="10" y="15" width="12" height="70" rx="5"/><rect class="mgx-band" x="8" y="22" width="16" height="9"/><rect class="mgx-fill" x="12" y="85" width="8" height="0"/><path class="mgx-line" d="M32 60H92"/><rect class="mgx-band b2" x="70" y="52" width="8" height="16"/><circle class="mgx-sweep" cx="32" cy="60" r="5"/>`,
      init: (c) => { c.st.h = 0; c.st.r = 0; c.st.s1 = null; },
      frame: (c) => {
        const t = c.t();
        if (c.st.h && c.st.s1 == null) { const u = Math.min(1.25, (t - c.st.h) / D1); const v = Math.min(1, u); c.q(".mgx-fill").setAttribute("y", R(85 - 70 * v)); c.q(".mgx-fill").setAttribute("height", R(70 * v)); c.el.classList.toggle("overheat", u > 1); if (u >= 1.25) { c.st.s1 = 0; c.st.r = t; } c.progress(u * 0.5); }
        if (c.st.s1 != null) { const u = (t - c.st.r) / D2; c.q(".mgx-sweep").setAttribute("cx", R(32 + 60 * Math.min(1, u))); if (u > 1.15) c.end((c.st.s1 + 0) / 2); }
      },
      down: (c) => {
        if (!c.st.h) { c.st.h = c.t(); return; }
        if (c.st.s1 != null) { const target = c.st.r + D2 * (74 - 32) / 60; c.end((c.st.s1 + tscore(Math.abs(c.t() - target), tol)) / 2); }
      },
      up: (c) => { if (c.st.h && c.st.s1 == null) { const target = c.st.h + D1 * (85 - 26.5) / 70; c.st.s1 = tscore(Math.abs(c.t() - target), tol); c.st.r = c.t(); } },
      key: (c) => { if (!c.st.h) c.st.h = c.t(); else if (c.st.s1 != null) { const target = c.st.r + D2 * (74 - 32) / 60; c.end((c.st.s1 + tscore(Math.abs(c.t() - target), tol)) / 2); } },
      keyup: (c) => { if (c.st.h && c.st.s1 == null) { const target = c.st.h + D1 * (85 - 26.5) / 70; c.st.s1 = tscore(Math.abs(c.t() - target), tol); c.st.r = c.t(); } },
      timeout: (c) => (c.st.s1 || 0) / 2,
    });
  });
  /* battleaxe: hold to charge, let go in the sweet spot; hold too long and it overheats */
  MINIGAME.register("battleaxe", (host, g, o, w, K) => {
    const P = pow(g), D = P ? 820 : 1000, tol = 0.075 * w * (P ? 0.75 : 1), spot = 0.8;
    return game(host, g, o, w, K, {
      hint: "Hold to charge, let go in the sweet spot (not too long!)",
      limit: 3200,
      svg: `<rect class="mgx-tube" x="12" y="40" width="76" height="20" rx="8"/><rect class="mgx-band" x="${R(12 + 76 * (spot - tol))}" y="38" width="${R(76 * tol * 2)}" height="24"/><rect class="mgx-hot" x="${R(12 + 76 * 0.97)}" y="40" width="${R(76 * 0.03)}" height="20"/><rect class="mgx-fill" x="12" y="44" width="0" height="12" rx="5"/>`,
      init: (c) => { c.st.h = 0; },
      frame: (c) => { if (!c.st.h) return; const m = (c.t() - c.st.h) / D; c.q(".mgx-fill").setAttribute("width", R(76 * Math.min(1, m))); c.el.classList.toggle("overheat", m > 0.97); c.progress(Math.min(1, m)); if (m >= 1) c.end(0); },
      down: (c) => { if (!c.st.h) c.st.h = c.t(); },
      up: (c) => { if (!c.st.h) return; const m = (c.t() - c.st.h) / D; c.end(tscore(Math.abs(m - spot), tol)); },
      timeout: () => 0,
    });
  });
  /* warhammer: tap as the falling hammer meets the ring */
  MINIGAME.register("warhammer", (host, g, o, w, K) => {
    const P = pow(g), D = P ? 860 : 1050, tol = 75 * w * (P ? 0.75 : 1), ring = 76, tr = 250 + D * Math.sqrt((ring - 8) / 80);
    return game(host, g, o, w, K, {
      sound: "hit", hint: "Tap as the hammer hits the ring",
      limit: 250 + D + 300,
      svg: `<ellipse class="mgx-zone" cx="50" cy="${ring + 6}" rx="22" ry="6"/><g class="mgx-ham"><rect x="38" y="0" width="24" height="12" rx="2"/><path class="mgx-line" d="M50 12V30"/></g>`,
      frame: (c) => { const u = Math.max(0, (c.t() - 250) / D), y = 8 + 80 * u * u - 6; c.q(".mgx-ham").setAttribute("transform", `translate(0 ${R(Math.min(90, y))})`); c.q(".mgx-zone").classList.toggle("on", Math.abs(c.t() - tr) < tol); },
      down: (c) => c.end(tscore(Math.abs(c.t() - tr), tol)),
    });
  });
  /* spear: thrust (flick up or tap) when the gap in the shields lines up with your point */
  MINIGAME.register("spear", (host, g, o, w, K) => {
    const P = pow(g), T = P ? 1000 : 1300, tol = 5.5 * w * (P ? 0.75 : 1);
    const gx = (t) => 50 + 34 * Math.sin((2 * Math.PI * t) / T + 1.2);
    return game(host, g, o, w, K, {
      hint: "Thrust when the gap lines up",
      limit: T * 2,
      svg: `<rect class="mgx-wall l" x="0" y="22" width="40" height="14"/><rect class="mgx-wall r" x="60" y="22" width="40" height="14"/><path class="mgx-spear" d="M50 92V48l-4 6h8l-4-6"/>`,
      frame: (c) => { const x = gx(c.t()); c.q(".mgx-wall.l").setAttribute("width", R(Math.max(0, x - 10))); c.q(".mgx-wall.r").setAttribute("x", R(x + 10)); c.el.classList.toggle("lined", Math.abs(x - 50) < tol); },
      down: () => {},
      up: (c, p, d) => { const flick = p && d ? d.y - p.y > 8 : true; c.end(tscore(Math.abs(gx(c.t()) - 50), tol) * (flick ? 1 : 0.9)); },
      key: (c) => c.end(tscore(Math.abs(gx(c.t()) - 50), tol)),
    });
  });
  /* bow: hold to draw; the reticle closes on the gold ring while the target sways in the wind */
  MINIGAME.register("bow", (host, g, o, w, K) => {
    const P = pow(g), draw = P ? 900 : 1100, target = 16, tol = Math.min(9, 4 * w * (P ? 0.75 : 1));
    const sway = (t) => 13 * Math.sin(t / 420) * Math.cos(t / 900);
    return game(host, g, o, w, K, {
      hint: "Hold to draw, let go on the gold ring",
      limit: 4000,
      svg: `<g class="mgx-tgt"><circle class="mg-tg" cx="50" cy="50" r="${target}"/><circle class="mg-tgw" cx="50" cy="50" r="${target}" style="stroke-width:${R(tol * 2)}"/></g><circle class="mg-ret" cx="50" cy="50" r="46"/><path class="mg-x" d="M50 44v12M44 50h12"/><path class="mgx-wind" d="M8 14h20M12 20h14"/>`,
      init: (c) => { c.st.h = 0; },
      frame: (c) => {
        const t = c.t(), sx = sway(t);
        c.q(".mgx-tgt").setAttribute("transform", `translate(${R(sx)} 0)`); c.q(".mgx-wind").setAttribute("transform", `translate(${R(sx * 1.5 + 13)} 0)`);
        if (!c.st.h) return;
        const u = (t - c.st.h) / draw, r = u <= 1 ? 46 - 38 * u : 8 + Math.min(38, (u - 1) * 60 + Math.sin(u * 20) * 3);
        c.q(".mg-ret").setAttribute("r", R(r)); c.progress(Math.min(1, u)); if (u > 2.4) c.end(0);
      },
      down: (c) => { if (!c.st.h) { c.st.h = c.t(); c.el.classList.add("drawing"); } },
      up: (c) => {
        if (!c.st.h) return;
        const u = (c.t() - c.st.h) / draw, r = u <= 1 ? 46 - 38 * u : 8 + Math.min(38, (u - 1) * 60), d = Math.abs(r - target);
        const base = d <= tol ? 1 - (d / tol) * 0.25 : Math.max(0, 0.6 - (d - tol) / 20);
        c.end(base * (1 - 0.3 * Math.min(1, Math.abs(sway(c.t())) / 13)));
      },
      timeout: () => 0,
    });
  });
  /* crossbow: the crosshair shakes, settles, shakes again; tap while it sits still on the mark */
  MINIGAME.register("crossbow", (host, g, o, w, K) => {
    const P = pow(g), cyc = P ? 1300 : 1600, tol = 4 * w * (P ? 0.75 : 1);
    const off = (t) => { const ph = (t % cyc) / cyc, amp = 2 + 22 * Math.abs(Math.cos(Math.PI * ph)); return [amp * Math.sin(t / 70), amp * Math.cos(t / 95)]; };
    return game(host, g, o, w, K, {
      hint: "Tap when the crosshair settles on the mark",
      limit: cyc * 2,
      svg: `<circle class="mgx-zone" cx="50" cy="50" r="${R(tol + 2)}"/><g class="mgx-cross"><circle cx="50" cy="50" r="10" class="mgx-ring"/><path class="mg-x" d="M50 36v28M36 50h28"/></g>`,
      frame: (c) => { const [x, y] = off(c.t()); c.q(".mgx-cross").setAttribute("transform", `translate(${R(x)} ${R(y)})`); c.q(".mgx-zone").classList.toggle("on", Math.hypot(x, y) < tol); },
      down: (c) => { const [x, y] = off(c.t()); c.end(tscore(Math.hypot(x, y), tol)); },
    });
  });
  /* fists: a left-right combo; tap the side that lights up, on time */
  MINIGAME.register("fist", (host, g, o, w, K) => {
    const P = pow(g), n = P ? 4 : 3, win = (P ? 380 : 460) * Math.min(1.3, w), start = 300;
    const seq = Array.from({ length: n }, (_, i) => (i === 0 ? Math.random() < 0.5 : Math.random() < 0.6 ? !0 : !1) ? "L" : "R");
    return game(host, g, o, w, K, {
      hint: "Tap left or right as each side lights up",
      limit: start + n * win + 300,
      svg: `<rect class="mgx-side l" x="4" y="20" width="44" height="60" rx="8"/><rect class="mgx-side r" x="52" y="20" width="44" height="60" rx="8"/>${label(26, 55, "L")}${label(74, 55, "R")}`,
      init: (c) => { c.st.sc = []; },
      frame: (c) => { const i = Math.floor((c.t() - start) / win); c.q(".mgx-side.l").classList.toggle("on", seq[i] === "L"); c.q(".mgx-side.r").classList.toggle("on", seq[i] === "R"); if (i > c.st.sc.length && i <= n) while (c.st.sc.length < Math.min(n, i)) c.st.sc.push(0); if (c.st.sc.length >= n) c.end(c.st.sc.reduce((a, b) => a + b, 0) / n); },
      down: (c, p) => {
        const t = c.t(), i = Math.floor((t - start) / win); if (i < 0 || i >= n || c.st.sc.length !== i) return;
        const side = p ? (p.x < 50 ? "L" : "R") : seq[i], mid = start + i * win + win / 2;
        c.st.sc.push(side === seq[i] ? tscore(Math.abs(t - mid), win * 0.28) : 0); c.progress(c.st.sc.length / n);
        if (c.st.sc.length >= n) c.end(c.st.sc.reduce((a, b) => a + b, 0) / n);
      },
      timeout: (c) => c.st.sc.reduce((a, b) => a + b, 0) / n,
    });
  });
  /* two blades: two lanes; tap each side as its blade hits the line */
  MINIGAME.register("dual", (host, g, o, w, K) => {
    const P = pow(g), D = P ? 660 : 820, lag = P ? 280 : 360, tol = 85 * w * (P ? 0.75 : 1), at = 0.82;
    const tl = 200 + D * at, trr = 200 + lag + D * at;
    return game(host, g, o, w, K, {
      hint: "Tap left, then right, as each blade hits the line",
      limit: trr + 500,
      svg: `<path class="mgx-line" d="M50 8V92"/><path class="mgx-zoneh" d="M6 ${R(10 + 80 * at)}H94"/><circle class="mgx-mk l" cx="27" cy="10" r="6"/><circle class="mgx-mk r" cx="73" cy="10" r="6"/>`,
      init: (c) => { c.st.L = null; c.st.R = null; },
      frame: (c) => { const t = c.t(); c.q(".mgx-mk.l").setAttribute("cy", R(10 + 80 * Math.min(1.1, Math.max(0, (t - 200) / D)))); c.q(".mgx-mk.r").setAttribute("cy", R(10 + 80 * Math.min(1.1, Math.max(0, (t - 200 - lag) / D)))); },
      down: (c, p) => {
        const t = c.t(), side = p ? (p.x < 50 ? "L" : "R") : c.st.L == null ? "L" : "R";
        if (c.st[side] != null) return;
        c.st[side] = tscore(Math.abs(t - (side === "L" ? tl : trr)), tol); c.progress(((c.st.L != null) + (c.st.R != null)) / 2);
        if (c.st.L != null && c.st.R != null) c.end((c.st.L + c.st.R) / 2);
      },
      timeout: (c) => ((c.st.L || 0) + (c.st.R || 0)) / 2,
    });
  });

  // ------------------------------------------------------------------ moves
  /* guard: the blow closes in on your shield; what comes depends on the foe: an arrow, a claw, a spell or a blade */
  MINIGAME.register("guard", (host, g, o, w, K) => {
    const kind = g.foe || "blade", D = { arrow: 700, claw: 950, spell: 1100, blade: 1150 }[kind], Rs = 16, tol = 3.6 * w;
    const pic = {
      arrow: `<g class="mgx-in"><path d="M-10 0H6M6 0l-5-4M6 0l-5 4" class="mgx-arrow"/></g>`,
      claw: `<g class="mgx-in"><path d="M-8 -8l12 6M-9 0l13 2M-8 8l12 -2" class="mgx-claw"/></g>`,
      spell: `<g class="mgx-in"><circle r="6" class="mgx-orb"/></g>`,
      blade: `<g class="mgx-in"><path d="M-12 -2H6l4 2-4 2H-12z" class="mgx-bl"/></g>`,
    }[kind];
    const dist = (t) => 46 * (1 - Math.min(1.2, t / D));
    const tip = kind === "arrow" ? "Raise your shield as the arrow arrives" : kind === "claw" ? "Block as the claws strike" : kind === "spell" ? "Block as the spell hits" : "Press as the blow meets your shield";
    return game(host, g, o, w, K, {
      sound: "shield", hint: tip,
      limit: D * 1.2,
      svg: `<circle class="mg-shield" cx="50" cy="50" r="${Rs}"/><circle class="mgx-zonering" cx="50" cy="50" r="${R(Rs + tol)}"/>${pic}`,
      frame: (c) => { const d = Math.max(Rs - 6, dist(c.t()) + Rs * (1 - Math.min(1, c.t() / D))), y = kind === "spell" ? Math.sin(c.t() / 90) * 4 : 0; c.q(".mgx-in").setAttribute("transform", `translate(${R(50 - Math.max(Rs, d))} ${R(50 + y)})`); },
      down: (c) => { const d = Math.max(Rs, dist(c.t()) + Rs * (1 - Math.min(1, c.t() / D))); c.end(tscore(Math.abs(d - Rs), tol)); },
    });
  });
  /* shield bash: shove forward (swipe right, or tap) as the foe reaches your shield */
  MINIGAME.register("bash", (host, g, o, w, K) => {
    const D = 950, contact = 55, tol = 4.2 * w;
    const fx = (t) => 92 - (92 - 40) * Math.min(1.2, t / D);
    return game(host, g, o, w, K, {
      sound: "shield", hint: "Shove forward as the foe meets your shield",
      limit: D * 1.15,
      svg: `<path class="mgx-zoneh" d="M${contact} 20V80"/><rect class="mgx-shieldb" x="${contact - 10}" y="30" width="8" height="40" rx="3"/><g class="mgx-foe"><circle cx="0" cy="38" r="7"/><path d="M-6 46h12v26h-12z"/></g>`,
      frame: (c) => { const x = fx(c.t()); c.q(".mgx-foe").setAttribute("transform", `translate(${R(x)} 0)`); c.q(".mgx-zoneh").classList.toggle("on", Math.abs(x - contact) < tol); },
      down: () => {},
      up: (c, p, d) => { const shove = p && d ? p.x - d.x > 6 : true; c.end(tscore(Math.abs(fx(c.t()) - contact), tol) * (shove ? 1 : 0.85)); },
      key: (c) => c.end(tscore(Math.abs(fx(c.t()) - contact), tol)),
    });
  });
  /* shout: hold on the first word, let go on the last (one word: let go on the echo) */
  MINIGAME.register("shout", (host, g, o, w, K) => {
    const n = g.words || 1, gap = 480, b1 = 450, bEnd = n > 1 ? b1 + gap * (n - 1) : b1 + 420, tol = 110 * w;
    const W = ["FUS", "RO", "DAH"];
    const xs = Array.from({ length: n }, (_, i) => (n === 1 ? 50 : 20 + (60 / (n - 1)) * i));
    return game(host, g, o, w, K, {
      sound: "shout", hint: n > 1 ? "Hold on the first word, let go on the last" : "Hold as the word glows, let go on its echo",
      limit: bEnd + 600,
      svg: `${xs.map((x, i) => `<g class="mgx-word" data-i="${i}"><circle cx="${x}" cy="48" r="13"/>${label(x, 52, W[i] || "", "mgx-wt")}</g>`).join("")}${n === 1 ? `<circle class="mgx-echo" cx="50" cy="48" r="13"/>` : ""}`,
      init: (c) => { c.st.p = null; },
      frame: (c) => { const t = c.t(); c.qa(".mgx-word").forEach((d, i) => d.classList.toggle("on", Math.abs(t - (b1 + gap * i)) < 160)); const e = c.q(".mgx-echo"); if (e) { const u = Math.max(0, (t - b1) / (bEnd - b1)); e.setAttribute("r", R(13 + 20 * Math.min(1.3, u))); e.classList.toggle("on", Math.abs(t - bEnd) < tol); } },
      down: (c) => { if (c.st.p == null) { c.st.p = tscore(Math.abs(c.t() - b1), tol); c.progress(0.5); } },
      up: (c) => { if (c.st.p == null) return; c.end((c.st.p + tscore(Math.abs(c.t() - bEnd), tol * 1.15)) / 2); },
      timeout: (c) => (c.st.p || 0) / 2,
    });
  });
  /* sneak strike: strike while the foe looks away; your stealth runs out if you wait too long */
  MINIGAME.register("sneak", (host, g, o, w, K) => {
    const P = pow(g), wins = [[600, 1100], [1700, 2200]], T = 2500, half = 250 * Math.min(1.4, w) * (P ? 0.8 : 1);
    const away = (t) => wins.find(([a, b]) => t >= a && t <= b);
    return game(host, g, o, w, K, {
      sound: "dodge", hint: "Strike while the foe looks away",
      limit: T,
      svg: `<g class="mgx-eye"><path d="M20 40Q50 16 80 40Q50 64 20 40z" class="mgx-lid"/><circle cx="50" cy="40" r="8" class="mgx-iris"/></g><rect class="mgx-tube" x="15" y="76" width="70" height="8" rx="4"/><rect class="mgx-fill" x="15" y="76" width="0" height="8" rx="4"/>`,
      frame: (c) => { const t = c.t(), a = away(t); c.el.classList.toggle("away", !!a); c.q(".mgx-fill").setAttribute("width", R(70 * (t / T))); },
      down: (c) => { const t = c.t(), a = away(t); if (!a) return c.end(0.2); const mid = (a[0] + a[1]) / 2; c.end(clamp(tscore(Math.abs(t - mid), half) - (t / T) * 0.25)); },
    });
  });

  // ------------------------------------------------------------------ spells
  /* the element's own colour on a school game (fire orange, frost ice-blue, shock violet) */
  const tint = (host, col, run) => { const pr = run(); const el = host.lastElementChild; if (el && el.classList.contains("mg")) el.style.setProperty("--mgc", col); return pr; };
  /* fire traces a flame, shock a quick zigzag (the rune game with the element's own shape) */
  MINIGAME.register("destruction-fire", (host, g, o, w, K) => tint(host, "#ff8a4a", () => K.rune(host, Object.assign({}, g, { rune: { pts: [[50, 84], [34, 58], [56, 46], [42, 26], [58, 12]], time: 2500 } }), o, w)));
  MINIGAME.register("destruction-shock", (host, g, o, w, K) => tint(host, "#b9a8ff", () => K.rune(host, Object.assign({}, g, { rune: { pts: [[14, 24], [38, 72], [60, 28], [86, 76]], time: 1700 } }), o, w)));
  /* frost: hold your thumb on the drifting crystal until the frost fills */
  MINIGAME.register("destruction-frost", (host, g, o, w, K) => tint(host, "#9cd8ff", () => {
    const need = 1200, rad = 11 * Math.min(1.5, w);
    const cx = (t) => 50 + 18 * Math.sin(t / 520), cy = (t) => 48 + 12 * Math.cos(t / 680);
    return game(host, g, o, w, K, {
      sound: "frost", hint: "Hold steady on the crystal until the frost fills",
      limit: 2800,
      svg: `<circle class="mgx-crys" cx="50" cy="48" r="${R(rad)}"/><circle class="mg-clock" cx="50" cy="50" r="47"/><circle class="mgx-finger" cx="-20" cy="-20" r="4"/>`,
      init: (c) => { c.st.in = 0; c.st.tot = 0; c.st.last = 0; c.st.f = null; c.st.k = false; },
      frame: (c) => {
        const t = c.t(), dt = t - c.st.last; c.st.last = t;
        const x = cx(t), y = cy(t); c.q(".mgx-crys").setAttribute("cx", R(x)); c.q(".mgx-crys").setAttribute("cy", R(y));
        if (c.st.f || c.st.k) { c.st.tot += dt; const inside = c.st.k ? 0.85 : Math.hypot(c.st.f.x - x, c.st.f.y - y) <= rad ? 1 : 0; c.st.in += dt * inside; c.el.classList.toggle("onit", inside > 0.5); }
        c.q(".mg-clock").style.strokeDashoffset = R(295 * (1 - Math.min(1, c.st.tot / need)));
        c.progress(c.st.tot / need);
        if (c.st.tot >= need) c.end(0.25 + 0.75 * (c.st.in / c.st.tot));
      },
      down: (c, p) => { c.st.f = p; if (p) { const fi = c.q(".mgx-finger"); fi.setAttribute("cx", R(p.x)); fi.setAttribute("cy", R(p.y)); } },
      move: (c, p) => { c.st.f = p; const fi = c.q(".mgx-finger"); fi.setAttribute("cx", R(p.x)); fi.setAttribute("cy", R(p.y)); },
      up: (c) => { c.st.f = null; },
      key: (c) => { c.st.k = true; }, keyup: (c) => { c.st.k = false; },
      timeout: (c) => (c.st.tot ? 0.6 * (c.st.in / Math.max(1, c.st.tot)) * (c.st.tot / need) : 0),
    });
  }));
  /* healing an ally: drag the light from you to them */
  MINIGAME.register("restoration-ally", (host, g, o, w, K) => {
    const A = { x: 16, y: 60 }, B = { x: 84, y: 40 }, tol = 7 * w, limit = 2200 * Math.min(1.4, w);
    return game(host, g, o, w, K, {
      sound: "spell", hint: "Drag the light from you to your ally",
      limit,
      svg: `<path class="mgx-arc" d="M${A.x} ${A.y}Q50 ${(A.y + B.y) / 2 - 22} ${B.x} ${B.y}"/><circle class="mgx-me" cx="${A.x}" cy="${A.y}" r="8"/><circle class="mgx-ally" cx="${B.x}" cy="${B.y}" r="9"/><circle class="mgx-light" cx="${A.x}" cy="${A.y}" r="5"/><circle class="mg-clock" cx="50" cy="50" r="47"/>`,
      frame: (c) => { c.q(".mg-clock").style.strokeDashoffset = R(295 * (c.t() / limit)); },
      down: (c, p) => { c.st.ok = !p || Math.hypot(p.x - A.x, p.y - A.y) < 16; },
      move: (c, p) => { if (!c.st.ok) return; const l = c.q(".mgx-light"); l.setAttribute("cx", R(p.x)); l.setAttribute("cy", R(p.y)); c.progress(Math.max(0, (p.x - A.x) / (B.x - A.x))); },
      up: (c, p) => { if (!c.st.ok) return c.end(0.15); const d = p ? Math.hypot(p.x - B.x, p.y - B.y) : 0, left = 1 - c.t() / limit; c.end(tscore(d, tol) * (0.85 + 0.15 * left)); },
      timeout: () => 0,
    });
  });
  /* Alteration: turn the ward's three pieces until they lock (tap a piece to turn it) */
  MINIGAME.register("alteration", (host, g, o, w, K) => {
    const limit = 3000 * Math.min(1.6, w), offs = [1 + Math.floor(Math.random() * 2), 1 + Math.floor(Math.random() * 2), 1];
    const seg = (i) => { const a0 = (i * 120 - 90 + 8) * Math.PI / 180, a1 = ((i + 1) * 120 - 90 - 8) * Math.PI / 180, r = 30; const am = ((i * 120 - 90 + 60) * Math.PI) / 180; return `M${R(50 + r * Math.cos(a0))} ${R(50 + r * Math.sin(a0))}A${r} ${r} 0 0 1 ${R(50 + r * Math.cos(a1))} ${R(50 + r * Math.sin(a1))}M${R(50 + r * Math.cos(am))} ${R(50 + r * Math.sin(am))}L${R(50 + 42 * Math.cos(am))} ${R(50 + 42 * Math.sin(am))}`; };
    const dot = (i) => { const am = ((i * 120 - 90 + 60) * Math.PI) / 180; return `<circle class="mgx-lock" cx="${R(50 + 44 * Math.cos(am))}" cy="${R(50 + 44 * Math.sin(am))}" r="3.5"/>`; };
    return game(host, g, o, w, K, {
      sound: "spell", hint: "Turn each piece until its spike meets a dot",
      limit,
      svg: `<circle class="mgx-ghost" cx="50" cy="50" r="30"/>${[0, 1, 2].map(dot).join("")}${[0, 1, 2].map((i) => `<path class="mgx-piece" data-i="${i}" d="${seg(i)}"/>`).join("")}<circle class="mg-clock" cx="50" cy="50" r="47"/>`,
      init: (c) => { c.st.o = offs.slice(); c.st.extra = 0; c.st.paint = () => c.qa(".mgx-piece").forEach((p, i) => { p.setAttribute("transform", `rotate(${c.st.o[i] * 90} 50 50)`); p.classList.toggle("ok", c.st.o[i] % 4 === 0); }); c.st.paint(); },
      frame: (c) => { c.q(".mg-clock").style.strokeDashoffset = R(295 * (c.t() / limit)); },
      down: (c, p) => {
        let i;
        if (p) { const a = (Math.atan2(p.y - 50, p.x - 50) * 180 / Math.PI + 90 + 360) % 360; i = Math.floor(a / 120) % 3; }
        else i = c.st.o.findIndex((v) => v % 4 !== 0);
        if (i < 0) return;
        if (c.st.o[i] % 4 === 0) c.st.extra++;
        c.st.o[i] = (c.st.o[i] + 1) % 4; c.st.paint();
        const ok = c.st.o.filter((v) => v % 4 === 0).length; c.progress(ok / 3);
        if (ok === 3) { const left = Math.max(0, 1 - c.t() / limit); c.end(Math.max(0.36, Math.min(1, 0.45 + left * 0.9 - c.st.extra * 0.15))); }
      },
      timeout: (c) => c.st.o.filter((v) => v % 4 === 0).length / 3 * 0.3,
    });
  });
  /* Conjuration: tap the star's points in order, then hold the portal open and let go on the gold ring */
  MINIGAME.register("conjuration", (host, g, o, w, K) => {
    const pts = [[50, 14], [80, 74], [20, 40], [80, 40], [20, 74]], hold = 900, gold = 24, tol = 4 * w, limit = 4400 * Math.min(1.4, w);
    return game(host, g, o, w, K, {
      sound: "spell", hint: "Tap the star in order, then hold the portal open",
      limit,
      svg: `<path class="mg-path" d="M${pts.map((p) => p.join(" ")).join("L")}Z"/>${pts.map(([x, y], i) => `<g class="mg-pt" data-i="${i}"><circle cx="${x}" cy="${y}" r="7"/><text x="${x}" y="${y + 3}">${i + 1}</text></g>`).join("")}<circle class="mgx-gold" cx="50" cy="52" r="${gold}"/><circle class="mgx-portal" cx="50" cy="52" r="0"/>`,
      init: (c) => { c.st.n = 0; c.st.h = 0; c.st.s1 = 0; const mk = () => c.qa(".mg-pt").forEach((d, i) => { d.classList.toggle("on", i === c.st.n); d.classList.toggle("done", i < c.st.n); }); c.st.mk = mk; mk(); },
      frame: (c) => { if (c.st.h) { const u = (c.t() - c.st.h) / hold; c.q(".mgx-portal").setAttribute("r", R(Math.min(40, 40 * u))); if (u > 1.6) c.end(c.st.s1 / 2); } },
      down: (c, p) => {
        if (c.st.n < pts.length) {
          const [x, y] = pts[c.st.n];
          if (!p || Math.hypot(p.x - x, p.y - y) < 13) { c.st.n++; c.st.mk(); c.progress(c.st.n / pts.length * 0.6); if (c.st.n === pts.length) { c.st.s1 = Math.max(0.4, 1 - c.t() / (limit * 0.6)); c.el.classList.add("open"); } }
          return;
        }
        if (!c.st.h) c.st.h = c.t();
      },
      up: (c) => { if (!c.st.h) return; const r = Math.min(40, 40 * (c.t() - c.st.h) / hold); c.end((c.st.s1 + tscore(Math.abs(r - gold), tol)) / 2); },
      timeout: (c) => (c.st.n / pts.length) * 0.3,
    });
  });
  /* Mysticism: tap the mirror image of the glowing pattern, in order */
  MINIGAME.register("mysticism", (host, g, o, w, K) => {
    const src = [[30, 25], [14, 55], [36, 78]], tgt = src.map(([x, y]) => [100 - x, y]), limit = 3000 * Math.min(1.6, w);
    return game(host, g, o, w, K, {
      sound: "spell", hint: "Tap the mirror image of each glowing point",
      limit,
      svg: `<path class="mgx-mirror" d="M50 6V94"/>${src.map(([x, y], i) => `<g class="mgx-src" data-i="${i}"><circle cx="${x}" cy="${y}" r="7"/><text x="${x}" y="${y + 3}">${i + 1}</text></g>`).join("")}${tgt.map(([x, y], i) => `<circle class="mgx-dst" data-i="${i}" cx="${x}" cy="${y}" r="7"/>`).join("")}<circle class="mg-clock" cx="50" cy="50" r="47"/>`,
      init: (c) => { c.st.n = 0; c.st.err = 0; const mk = () => c.qa(".mgx-src").forEach((d, i) => d.classList.toggle("on", i === c.st.n)); c.st.mk = mk; mk(); },
      frame: (c) => { c.q(".mg-clock").style.strokeDashoffset = R(295 * (c.t() / limit)); },
      down: (c, p) => {
        const [x, y] = tgt[c.st.n];
        if (p && Math.hypot(p.x - x, p.y - y) > 13) { c.st.err++; return; }
        c.q(`.mgx-dst[data-i="${c.st.n}"]`)?.classList.add("done"); c.st.n++; c.st.mk(); c.progress(c.st.n / 3);
        if (c.st.n >= 3) { const left = Math.max(0, 1 - c.t() / limit); c.end(Math.max(0.36, Math.min(1, 0.45 + left * 0.9 - c.st.err * 0.2))); }
      },
      timeout: (c) => (c.st.n / 3) * 0.3,
    });
  });
  /* any dual cast: both thumbs — catch both orbs as they rise through the band */
  MINIGAME.register("dualcast", (host, g, o, w, K) => {
    const D = 1050, lag = 140, band = 30, tol = 5 * w, col = (K.SCHOOLS[g.school] || {}).col || "#ffd27a";
    const y = (t) => 90 - 80 * Math.min(1.2, Math.max(0, t / D));
    return game(host, g, o, w, K, {
      sound: "spell", hint: "Both thumbs: tap each orb on the line",
      limit: D * 1.25 + lag,
      svg: `<rect class="mgx-tube" x="18" y="8" width="20" height="84" rx="9"/><rect class="mgx-tube" x="62" y="8" width="20" height="84" rx="9"/><path class="mgx-zoneh" d="M10 ${band}H90"/><circle class="mgx-orbd l" cx="28" cy="90" r="7" style="fill:${col}"/><circle class="mgx-orbd r" cx="72" cy="90" r="7" style="fill:${col}"/>`,
      init: (c) => { c.st.L = null; c.st.R = null; },
      frame: (c) => { const t = c.t(); c.q(".mgx-orbd.l").setAttribute("cy", R(Math.max(12, y(t)))); c.q(".mgx-orbd.r").setAttribute("cy", R(Math.max(12, y(t - lag)))); },
      down: (c, p) => {
        const t = c.t(), side = p ? (p.x < 50 ? "L" : "R") : c.st.L == null ? "L" : "R";
        if (c.st[side] != null) return;
        c.st[side] = tscore(Math.abs(y(side === "L" ? t : t - lag) - band), tol); c.progress(((c.st.L != null) + (c.st.R != null)) / 2);
        if (c.st.L != null && c.st.R != null) c.end((c.st.L + c.st.R) / 2);
      },
      timeout: (c) => ((c.st.L || 0) + (c.st.R || 0)) / 2,
    });
  });
  return { tscore };
})();
if (typeof module !== "undefined") module.exports = MGGAMES;
