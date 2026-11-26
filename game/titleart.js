/* Title art: the living main-menu panorama, the character-creation scene and the short intro after "Begin". [OURS]
     TITLEART.start(canvas, { reduce })  → animate the title panorama on a canvas; returns stop()
     TITLEART.stats()                    → { frames, avgMs } of the title animation (for tests)
     TITLEART.createScene(race)          → HTML: your race standing on a snowy road at dawn
     TITLEART.intro(onDone, { reduce })   → a ≤6 s three-panel intro (tap to skip); calls onDone once
   Layers are painted once into offscreen canvases (sky, far peaks with the Throat of the World, a pine ridge, the
   foreground cliff) and slid against each other each frame; only the aurora ribbons and the passing dragon are drawn
   live. ~30 fps, paused when hidden. */
const TITLEART = (() => {
  const INK = "#14100c";
  let stat = { frames: 0, ms: 0 };

  /* layers are painted in a landscape-shaped space 300 units tall (so peaks keep their shape on a tall phone),
     anchored to the bottom of the screen; the sky layer covers the whole height */
  function layer(w, h, draw, full = false) {
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    const g = c.getContext("2d");
    if (full) { draw(g, ART.H, c.width, c.height); return c; }
    const lh = Math.min(h, w * 1.1), s = lh / 300;
    g.translate(0, h - lh); g.scale(s, s); draw(g, ART.H, c.width / s, 300); return c;
  }
  // ---- the painted layers (w is a bit wider than the screen so the layers can drift)
  function paintSky(g, H, w, h) {
    const gr = g.createLinearGradient(0, 0, 0, h * 0.75); gr.addColorStop(0, "#070a10"); gr.addColorStop(0.6, "#121a26"); gr.addColorStop(1, "#253244");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = ART.seeded("tsky");
    for (let i = 0; i < Math.round(w * h / 2600); i++) { const s = r() < 0.08 ? 1.8 : 1.1; g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.65})`; g.fillRect(r() * w, r() * h * 0.6, s, s); }
    // Masser and Secunda
    const moon = (x, y, rad, col, glow) => { const gl = g.createRadialGradient(x, y, 0, x, y, rad * 4); gl.addColorStop(0, glow); gl.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gl; g.fillRect(x - rad * 4, y - rad * 4, rad * 8, rad * 8); H.circle(g, x, y, rad, col, null); };
    moon(w * 0.8, h * 0.14, Math.max(9, h * 0.035), "#e9d6d0", "rgba(233,190,180,.35)");
    moon(w * 0.86, h * 0.1, Math.max(4, h * 0.014), "#eef2f4", "rgba(200,220,240,.25)");
  }
  function paintFar(g, H, w, h) {
    // the Throat of the World, with High Hrothgar's snowcap, behind the range
    const cx = w * 0.58, top = h * 0.18, base = h * 0.8, hw = h * 0.55;
    H.poly(g, [[cx - hw, base], [cx, top], [cx + hw, base]], "#465060", INK, 1.2);
    H.poly(g, [[cx - hw * 0.28, top + (base - top) * 0.26], [cx, top], [cx + hw * 0.28, top + (base - top) * 0.26], [cx + hw * 0.12, top + (base - top) * 0.22], [cx, top + (base - top) * 0.3], [cx - hw * 0.14, top + (base - top) * 0.22]], "#e8eef2", null);
    H.mountains(g, w, h * 0.82, h * 0.42, 21, "#3a4350", true);
    const fade = g.createLinearGradient(0, h * 0.6, 0, h); fade.addColorStop(0, "rgba(10,14,20,0)"); fade.addColorStop(1, "rgba(10,14,20,.5)"); g.fillStyle = fade; g.fillRect(0, h * 0.6, w, h * 0.4);
  }
  function paintMid(g, H, w, h) {
    H.mountains(g, w, h * 0.9, h * 0.22, 33, "#2a3038", false);
    const r = ART.seeded("tpine");
    for (let i = 0; i < Math.round(w / 9); i++) { const x = r() * w, s2 = 9 + r() * 9, y = h * 0.9 + r() * 8; H.poly(g, [[x - s2 * 0.45, y], [x, y - s2 * 1.7], [x + s2 * 0.45, y]], r() < 0.5 ? "#1f3326" : "#263b2c", "#0e1410", 0.8); }
    g.fillStyle = "#151b20"; g.fillRect(0, h * 0.92, w, h * 0.08);
  }
  function paintFore(g, H, w, h) {
    // a dark cliff on the left with a lone traveller looking out
    const cw = Math.min(w * 0.45, h * 0.9);
    H.poly(g, [[0, h], [0, h * 0.7], [cw * 0.28, h * 0.66], [cw * 0.55, h * 0.72], [cw * 0.8, h * 0.82], [cw, h], [0, h]], "#0e1116", INK, 1.2);
    const x = cw * 0.45, y = h * 0.695, s = 11;
    g.fillStyle = "#07090c"; g.beginPath(); g.ellipse(x, y - s * 1.6, s * 0.28, s * 0.32, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x - s * 0.45, y); g.lineTo(x - s * 0.3, y - s * 1.35); g.lineTo(x + s * 0.3, y - s * 1.35); g.lineTo(x + s * 0.55, y); g.closePath(); g.fill();
    g.strokeStyle = "#07090c"; g.lineWidth = Math.max(1.5, s * 0.1); g.beginPath(); g.moveTo(x + s * 0.5, y); g.lineTo(x + s * 0.6, y - s * 2.1); g.stroke();   // a staff
    // a snowdrift on the right edge
    H.poly(g, [[w, h], [w, h * 0.88], [w - cw * 0.5, h * 0.94], [w - cw * 0.8, h], [w, h]], "#151a22", null);
  }
  function aurora(g, w, h, t) {
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = `rgba(${90 + i * 30},${210 - i * 20},${160 + i * 20},${0.11 - i * 0.025})`; g.lineWidth = h * (0.05 - i * 0.012);
      g.beginPath();
      for (let x = -10; x <= w + 10; x += Math.max(6, w / 40)) { const y = h * (0.16 + i * 0.045) + Math.sin(x / (w * 0.13) + t * (0.25 + i * 0.07) + i) * h * 0.035 + Math.sin(x / (w * 0.05) + t * 0.6) * h * 0.008; x === -10 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
    g.restore();
  }
  function dragon(g, x, y, s, flap) {
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = INK;
    g.beginPath(); g.moveTo(-26, 0); g.quadraticCurveTo(-12, -3, 0, -2); g.lineTo(16, -4); g.lineTo(22, -2); g.lineTo(16, 1); g.quadraticCurveTo(0, 3, -12, 2); g.quadraticCurveTo(-22, 3, -34, 8); g.quadraticCurveTo(-24, 1, -26, 0); g.fill();   // body + tail
    const up = Math.sin(flap) * 16;
    g.beginPath(); g.moveTo(-4, -2); g.lineTo(-14, -10 - up); g.lineTo(2, -24 - up * 1.2); g.lineTo(8, -14 - up * 0.6); g.lineTo(6, -2); g.fill();   // far wing
    g.beginPath(); g.moveTo(-6, 0); g.lineTo(-18, -6 - up * 0.6); g.lineTo(-2, -18 - up); g.lineTo(6, -6 - up * 0.4); g.lineTo(4, 0); g.fill();   // near wing
    g.restore();
  }

  /* [OURS] the painted key art is a tall picture (1080x1920): the hero bottom-left, a dragon top-right, the city on the right.
     On a phone it fills the screen as before; on wider windows the zoom is capped so the subjects (SUBJ, as parts of the
     picture) always fit, and the sides are filled with a blurred, mirrored copy of the same painting fading in, so a wide
     or ultra-wide window shows a whole scene instead of a strip of sky. ZM is the most the slow push-in ever zooms. */
  // UPMAX: at the deepest zoom one file pixel covers at most 1.1 screen pixels (artfit; art_quality_ui.py allows 1.15), so the
  // 1080-wide painting still fills a 1170-pixel phone edge to edge
  const SUBJ = { x0: 0.1, x1: 0.9, y0: 0.38, y1: 0.92 }, ZM = 1.07, UPMAX = 1.1;
  function keyFit(iw, ih, W, H, cap = Infinity) {
    const cov = Math.max(W / iw, H / ih);
    const s = Math.min(cov, cap * UPMAX / ZM, H / ((SUBJ.y1 - SUBJ.y0) * ih * ZM), W / ((SUBJ.x1 - SUBJ.x0) * iw * ZM));
    const w = iw * s, h = ih * s;
    // bottom-aligned where it can be; just enough of the foreground rocks is cropped to keep the hero's head clear of the top
    const y = Math.min(H - SUBJ.y1 * h, Math.max(H - h, H - H / ZM - SUBJ.y0 * h));
    return { x: (W - w) / 2, y, w, h, s };
  }
  /* [OURS] wide windows (wider than WIDE_AT) get their own 2:1 painting (title-wide, 1774x887, and title-wide-2x, 3548x1774):
     cover-fit, so it fills the window edge to edge. WSUBJ is the part that must always show: the warrior on the left rock
     (head ~34% down, boots ~84%) through the city on the right, with the dragon above it. Too wide a window crops the top
     and bottom, too narrow a one the sides, both centred on WSUBJ. If even the 2x file would be blown up past WUP, the
     painting is held back and the margins get the same blurred fill as the tall painting. */
  // WUP: the wide painting fills the window even on a 32:9 or 5K screen that needs more than its 2x file has (up to 1.8 screen
  // pixels per file pixel there; art_quality_ui.py allows that for title-wide only); past that it is held back too
  const WSUBJ = { x0: 0.2, x1: 0.81, y0: 0.325, y1: 0.86 }, WIDE_AT = 1.25, WUP = 1.8;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function wideFit(iw, ih, W, H, cap = Infinity) {
    const s = Math.min(Math.max(W / iw, H / ih), cap * WUP / ZM), w = iw * s, h = ih * s;
    const cx = (WSUBJ.x0 + WSUBJ.x1) / 2 * w, cy = (WSUBJ.y0 + WSUBJ.y1) / 2 * h;
    const x = w >= W ? clamp(W / 2 - cx, W - w, 0) : (W - w) / 2;
    const y = h >= H ? clamp(H / 2 - cy, H - h, 0) : H - h;   // held back: sits on the bottom, the blurred sky above
    // the push-in grows from the middle of the subject (kept on screen), and only as far as the subject still fits
    const sx0 = x + WSUBJ.x0 * w, sx1 = x + WSUBJ.x1 * w, sy0 = y + WSUBJ.y0 * h, sy1 = y + WSUBJ.y1 * h;
    const ax = clamp((sx0 + sx1) / 2, 0, W), ay = clamp((sy0 + sy1) / 2, 0, H);
    // largest z with a + z·(lo − a) ≥ 0 and a + z·(hi − a) ≤ max
    const lim = (a, lo, hi, max) => Math.min(lo < a ? a / (a - lo) : Infinity, hi > a ? (max - a) / (hi - a) : Infinity);
    const zmax = Math.max(1, Math.min(ZM, lim(ax, Math.max(0, sx0), Math.min(W, sx1), W), lim(ay, Math.max(0, sy0), Math.min(H, sy1), H)));
    return { x, y, w, h, s, ax, ay, zmax, wide: true };
  }
  let comp = null, compKey = null, compW = 0, compH = 0, compCap = 0, lastFit = null, lastZ = 1, lastCss = 1, lastFile = "title";
  function skyTone(im) {
    try { const c = document.createElement("canvas"); c.width = c.height = 1; const g = c.getContext("2d"); g.drawImage(im, 0, 0, im.naturalWidth, Math.max(1, im.naturalHeight * 0.04), 0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})`; } catch { return "#1b2636"; }
  }
  function buildComp(im, W, H, cap = Infinity, file = "title") {
    const wide = file !== "title", fit = wide ? wideFit : keyFit;
    const nw = im.naturalWidth, nh = im.naturalHeight, f = fit(nw, nh, W, H, cap), f0 = fit(nw, nh, W, H);
    // [artfit] held back to the file's own pixels: remember how big a file this screen would need (for repainting)
    if (f.s < f0.s * 0.995 && typeof ARTFIT !== "undefined") ARTFIT.short(file, nw * f0.s * ZM / cap, nh * f0.s * ZM / cap);
    else if (wide && f.s * ZM / cap > UPMAX * 1.01 && typeof ARTFIT !== "undefined") ARTFIT.short(file, nw * f.s * ZM / cap, nh * f.s * ZM / cap);   // filled, but past its pixels
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = skyTone(im); g.fillRect(0, 0, W, H);
    if (f.x > 0.5 || f.y > 0.5) {
      // the sides: the same painting stretched across the whole window and heavily blurred, so its colours (the dark
      // hillside on the left, the sunset in the middle, the city's glow on the right) carry on out to the edges at the
      // same horizon; no copies of the hero
      const d = 24, sc = document.createElement("canvas"); sc.width = Math.max(2, Math.ceil(W / d)); sc.height = Math.max(2, Math.ceil(H / d));
      sc.__soft = true; const sg = sc.getContext("2d"); sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = "high";
      if (typeof sg.filter === "string") sg.filter = "blur(1.5px)";
      sg.drawImage(im, -sc.width * 0.04, f.y / d, sc.width * 1.08, f.h / d);
      g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(sc, 0, 0, W, H); g.restore();
      g.fillStyle = "rgba(8,10,16,.3)"; g.fillRect(0, 0, W, H);
      const side = g.createLinearGradient(0, 0, W, 0);   // a soft vignette toward the far edges
      side.addColorStop(0, "rgba(4,5,8,.55)"); side.addColorStop(Math.max(0.01, f.x / W * 0.9), "rgba(4,5,8,.08)");
      side.addColorStop(Math.min(0.99, 1 - f.x / W * 0.9), "rgba(4,5,8,.08)"); side.addColorStop(1, "rgba(4,5,8,.55)");
      g.fillStyle = side; g.fillRect(0, 0, W, H);
      // the painting itself, its edges feathered into the copies
      const a = document.createElement("canvas"); a.width = W; a.height = H;
      const ag = a.getContext("2d"); ag.drawImage(im, f.x, f.y, f.w, f.h);
      ag.globalCompositeOperation = "destination-out";
      const fe = wide ? Math.min(f.w * 0.16, Math.max(f.x * 1.2, f.w * 0.03)) : f.w * 0.16;   // the wide one: a thin seam, the warrior stands at 20%
      if (f.x > 0.5) {
        for (const [x0, x1] of [[f.x, f.x + fe], [f.x + f.w, f.x + f.w - fe]]) {
          const gr = ag.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
          ag.fillStyle = gr; ag.fillRect(Math.min(x0, x1) - 1, 0, fe + 2, H);
        }
      }
      if (f.y > 0.5) { const fy = Math.min(f.h * 0.08, f.y + H * 0.05), gr = ag.createLinearGradient(0, f.y, 0, f.y + fy); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); ag.fillStyle = gr; ag.fillRect(0, f.y - 1, W, fy + 1); }
      g.drawImage(a, 0, 0);
    } else g.drawImage(im, f.x, f.y, f.w, f.h);
    comp = c; compKey = im; compW = W; compH = H; compCap = cap; lastFit = f; lastFile = file;
  }
  /* the push-in for zoom z (1.01 … ZM): [anchor x, anchor y, actual zoom] */
  const zoomOf = (f, z, W, H) => (f && f.wide ? [f.ax, f.ay, 1 + (z - 1) * (f.zmax - 1) / (ZM - 1)] : [W / 2, H, z]);
  /* which painting this window shows: the wide one on a landscape window (its 2x copy once the screen needs more than
     1.1x the small file's pixels), else the tall one. While the right wide file is still on its way the tall one shows. */
  function pickKey(W, H, unitPx) {
    if (typeof ASSETS === "undefined") return null;
    if (W / H > WIDE_AT) {
      const s0 = Math.max(W / 1774, H / 887), need = 1774 * s0 * ZM * unitPx;   // screen pixels across the wide painting
      const want = need > 1774 * 1.1 ? "title-wide-2x" : "title-wide";
      const im = ASSETS.img(want);
      if (im) return [im, want];
      if (want === "title-wide-2x" && ASSETS.stateOf(want) === "none") { const im1 = ASSETS.img("title-wide"); if (im1) return [im1, "title-wide"]; }
      else if (want === "title-wide" && ASSETS.stateOf(want) === "none") { const im2 = ASSETS.img("title-wide-2x"); if (im2) return [im2, "title-wide-2x"]; }
    }
    const im = ASSETS.img("title");
    return im ? [im, "title"] : null;
  }

  /* animate the title panorama on `cv` (full screen); returns stop() */
  function start(cv, opts = {}) {
    const reduce = !!opts.reduce, k = Math.min(2, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1);   // 2: sharp on phones (1.5 looked soft at 3x), still cheap enough to animate
    let W = 0, Hh = 0, L = null, stopped = false, raf = 0, last = 0, t0 = performance.now(), unitPx = 1;
    const g = cv.getContext("2d");
    function build() {
      W = Math.max(1, Math.round(innerWidth * k)); Hh = Math.max(1, Math.round(innerHeight * k)); cv.style.width = cv.style.height = "";
      cv.width = W; cv.height = Hh;
      try { const bw = cv.getBoundingClientRect().width; unitPx = bw > 0 ? bw * ((typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1) / W : 1; } catch { unitPx = 1; }   // screen pixels per canvas pixel
      const lw = W * 1.12;
      L = { sky: layer(W, Hh, paintSky, true), far: layer(lw, Hh, paintFar), mid: layer(lw, Hh, paintMid), fore: layer(lw, Hh, paintFore) };
    }
    /* [perf] ~30 fps: after a picture the loop sleeps on a timer instead of waking (and restyling the page) every refresh */
    let tmo = 0;
    const later = () => { tmo = setTimeout(() => { tmo = 0; if (!stopped) raf = requestAnimationFrame(frame); }, 20); };
    function frame(ts) {
      if (stopped || !cv.isConnected) return;
      if (!reduce && (document.hidden || ts - last < 29)) { raf = requestAnimationFrame(frame); return; }
      if (!reduce) later();
      last = ts;
      try { if (!cv.dataset.rest) draw(ts); } finally { try { opts.onFrame?.(ts); } catch (e) { /* the fog is optional */ } }
    }
    function draw(ts) {
      const a = performance.now(), t = (ts - t0) / 1000;
      g.imageSmoothingEnabled = true;
      const pk = pickKey(W, Hh, unitPx || 1), key = pk && pk[0];
      if (key) {   // hand-painted key art: a slow push-in, with the live aurora on top
        const z = 1.04 + (reduce ? 0 : Math.sin(t * 0.05) * 0.03);
        if (compKey !== key || compW !== W || compH !== Hh || compCap !== 1 / (unitPx || 1)) buildComp(key, W, Hh, 1 / (unitPx || 1), pk[1]);
        lastZ = z; lastCss = (cv.getBoundingClientRect().width || innerWidth) / W;
        // the tall painting's push-in grows from the bottom middle, so the hero's feet stay put and his head never leaves the
        // top; the wide one's from the middle of its subject, only as deep as the subject still fits
        const [ax, ay, zz] = zoomOf(lastFit, z, W, Hh);
        g.save(); g.translate(ax, ay); g.scale(zz, zz); g.translate(-ax, -ay); g.drawImage(comp, 0, 0); g.restore();
        g.save(); g.globalAlpha = 0.45; aurora(g, W, Hh, reduce ? 2 : t); g.restore();
        stat.frames++; stat.ms += performance.now() - a;
        return;
      }
      g.drawImage(L.sky, 0, 0);
      aurora(g, W, Hh, reduce ? 2 : t);
      // the dragon crosses every ~18 s, behind the far peaks
      const cyc = 18, p = ((t + 6) % cyc) / 7;
      if (!reduce && p < 1) dragon(g, W * (1.1 - p * 1.3), Hh * (0.24 + Math.sin(p * 6) * 0.03), Math.max(0.35, Hh / 900) * 1.2, t * 7);

      const dx = (amp, sp) => (reduce ? 0 : Math.sin(t * sp) * amp * W) - W * 0.06;
      g.drawImage(L.far, dx(0.012, 0.05), 0); g.drawImage(L.mid, dx(0.025, 0.05), 0); g.drawImage(L.fore, dx(0.04, 0.05), 0);
      stat.frames++; stat.ms += performance.now() - a;
    }
    build();
    const onResize = () => { if (!stopped) { build(); if (reduce) frame(performance.now()); } };
    addEventListener("resize", onResize);
    raf = requestAnimationFrame(frame);
    if (reduce) frame(performance.now() + 1000);
    return () => { stopped = true; cancelAnimationFrame(raf); clearTimeout(tmo); removeEventListener("resize", onResize); };
  }
  /* where the key art sits on screen in CSS pixels (for tests): the picture, its subject box, and both at the shallowest/deepest zoom */
  function keyRect() {
    if (!lastFit) return null;
    const f = lastFit, c = lastCss, H = compH, W = compW, S = f.wide ? WSUBJ : SUBJ;
    const at = (z0) => { const [ax, ay, z] = zoomOf(f, z0, W, H), X = (x) => (ax + (x - ax) * z) * c, Y = (y) => (ay + (y - ay) * z) * c;
      return { x: X(f.x), y: Y(f.y), w: f.w * z * c, h: f.h * z * c,
        subj: { x0: X(f.x + S.x0 * f.w), x1: X(f.x + S.x1 * f.w), y0: Y(f.y + S.y0 * f.h), y1: Y(f.y + S.y1 * f.h) } }; };
    return { vw: W * c, vh: H * c, now: at(lastZ), deepest: at(ZM), shallowest: at(1.01), SUBJ: S, file: lastFile, wide: !!f.wide, held: f.x > 0.5 || f.y > 0.5 };
  }
  const stats = () => ({ frames: stat.frames, avgMs: stat.frames ? +(stat.ms / stat.frames).toFixed(2) : 0 });

  // ---- character creation: your race on a snowy road at dawn
  function roadScene() {
    return (g, H, w, h) => {
      const st = SKY.make({ tod: "dawn", season: "winter", weather: "clear", north: true });
      SKY.backdrop(g, H, w, h, st, { horizon: 0.58, seed: "create" });
      H.mountains(g, w, h * 0.6, h * 0.3, 44, "#6b7280", true);
      H.pines(g, w, h * 0.66, 14, 45, 16);
      g.fillStyle = "#e6ebef"; g.fillRect(0, h * 0.62, w, h * 0.38);
      SKY.snowCover(g, w, h, h * 0.62, 0.9, "create");
      // the road, winding off toward Riverwood
      g.fillStyle = "#b9a98d"; g.beginPath(); g.moveTo(w * 0.36, h); g.quadraticCurveTo(w * 0.5, h * 0.8, w * 0.6, h * 0.66); g.lineTo(w * 0.63, h * 0.66); g.quadraticCurveTo(w * 0.58, h * 0.82, w * 0.66, h); g.closePath(); g.fill();
      g.strokeStyle = "rgba(59,44,30,.35)"; g.lineWidth = 1; g.stroke();
      // a signpost
      g.fillStyle = "#5a3e26"; g.fillRect(w * 0.76, h * 0.62, 3, h * 0.2); g.fillRect(w * 0.73, h * 0.64, w * 0.08, 6);
      SKY.overlay(g, H, w, h, st, { seed: "create", ground: h * 0.62, cover: false });
    };
  }
  function createScene(race) {
    const save = (typeof DOLL !== "undefined" && DOLL.starterSave) ? DOLL.starterSave(race) : { race, id: "preview-" + race };
    return `<div class="cscene">${ART.html(360, 170, roadScene(), { key: "cscene", cls: "cbg", alt: "A snowy road at dawn" })}
      <div class="cfig" data-race="${race}">${HEROART.figure(save, 104, 142, { bare: true })}</div></div>`;
  }

  // ---- the intro: three painted panels with a line each
  const PANELS = [
    ["The dragons have returned to Skyrim, and the old roads are dangerous again.", (g, H, w, h) => {
      SKY.backdrop(g, H, w, h, SKY.make({ tod: "dusk", season: "autumn", weather: "cloudy" }), { horizon: 0.6, seed: "i1" });
      H.mountains(g, w, h * 0.62, h * 0.3, 51, "#5a4a52", true);
      // Helgen's tower with smoke and a dragon over it
      H.poly(g, [[w * 0.55, h * 0.62], [w * 0.57, h * 0.3], [w * 0.65, h * 0.3], [w * 0.67, h * 0.62]], "#6b6058", INK, 1.2);
      g.fillStyle = "rgba(40,30,30,.5)"; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(w * (0.6 + i * 0.02), h * (0.26 - i * 0.04), 10 + i * 4, 0, 7); g.fill(); }
      g.fillStyle = "#e8923a"; g.beginPath(); g.arc(w * 0.61, h * 0.33, 6, 0, 7); g.fill();
      dragon(g, w * 0.35, h * 0.2, 1.3, 1);
      const gr = g.createLinearGradient(0, h * 0.62, 0, h); gr.addColorStop(0, "#4a3a2c"); gr.addColorStop(1, "#241a12"); g.fillStyle = gr; g.fillRect(0, h * 0.62, w, h * 0.38);
      // a walled village burning below the tower
      g.fillStyle = "#2a2018"; g.fillRect(w * 0.08, h * 0.7, w * 0.84, h * 0.05);
      for (let i = 0; i < 6; i++) {
        const x = w * (0.12 + i * 0.13), y = h * 0.72;
        H.poly(g, [[x - 14, y], [x, y - 14], [x + 14, y]], "#3a2a1e", INK, 1); g.fillStyle = "#2e2218"; g.fillRect(x - 11, y, 22, 12);
        if (i % 2 === 0) { const fl = g.createRadialGradient(x, y - 6, 0, x, y - 6, 22); fl.addColorStop(0, "rgba(255,170,60,.85)"); fl.addColorStop(1, "rgba(232,100,40,0)"); g.fillStyle = fl; g.fillRect(x - 22, y - 28, 44, 44); g.fillStyle = "#f0a040"; g.beginPath(); g.moveTo(x - 5, y - 2); g.lineTo(x, y - 16); g.lineTo(x + 5, y - 2); g.fill(); }
      }
    }],
    ["You arrive at the border of Skyrim, in the back of a cart, with nothing but the road ahead.", (g, H, w, h) => {
      SKY.backdrop(g, H, w, h, SKY.make({ tod: "day", season: "winter", weather: "cloudy", north: true }), { horizon: 0.6, seed: "i2" });
      H.mountains(g, w, h * 0.62, h * 0.32, 52, "#7d8590", true); H.pines(g, w, h * 0.7, 16, 53, 18);
      g.fillStyle = "#dfe5e9"; g.fillRect(0, h * 0.66, w, h * 0.34);
      g.fillStyle = "#9c8b72"; g.fillRect(0, h * 0.8, w, h * 0.08);
      // a cart and horse
      const x = w * 0.42, y = h * 0.8;
      g.fillStyle = "#7a5232"; g.fillRect(x, y - 22, 70, 16); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(x, y - 22, 70, 16);
      for (const wx of [x + 12, x + 58]) H.circle(g, wx, y - 4, 8, "#5a3e26", INK, 1.2);
      g.fillStyle = "#4a3a2e"; g.fillRect(x + 78, y - 26, 30, 12); g.fillRect(x + 104, y - 34, 8, 12); for (const lx of [x + 80, x + 102]) g.fillRect(lx, y - 14, 4, 14);
      for (const px2 of [x + 18, x + 38]) { g.fillStyle = "#3b2c1e"; g.beginPath(); g.arc(px2, y - 30, 5, 0, 7); g.fill(); g.fillRect(px2 - 5, y - 26, 10, 6); }
    }],
    ["Your road begins at Riverwood. Where it goes from here is up to you.", (g, H, w, h) => {
      SKY.backdrop(g, H, w, h, SKY.make({ tod: "dawn", season: "spring", weather: "clear" }), { horizon: 0.6, seed: "i3" });
      H.mountains(g, w, h * 0.6, h * 0.3, 54, "#6e7a6a", true); H.pines(g, w, h * 0.66, 18, 55, 16);
      g.fillStyle = "#7f9256"; g.fillRect(0, h * 0.64, w, h * 0.36);
      g.fillStyle = "#5f8797"; g.fillRect(0, h * 0.86, w, h * 0.06);   // the White River
      for (let i = 0; i < 4; i++) { const x = w * (0.2 + i * 0.17), y = h * 0.74; g.fillStyle = "#7a5232"; g.fillRect(x, y, 34, 18); H.poly(g, [[x - 4, y], [x + 17, y - 14], [x + 38, y]], "#5a3e26", INK, 1); g.fillStyle = "#e8b84a"; g.fillRect(x + 6, y + 6, 5, 5); }
      g.strokeStyle = "rgba(200,200,210,.5)"; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.3, h * 0.72); g.quadraticCurveTo(w * 0.32, h * 0.6, w * 0.28, h * 0.5); g.stroke();
    }],
  ];
  function intro(onDone, opts = {}) {
    let done = false, i = 0, timer = 0;
    const el = document.createElement("div"); el.className = "intro"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Story so far. Tap to skip.");
    const show = () => {
      const [text, draw] = PANELS[i];
      el.innerHTML = `<div class="ipanel">${ART.html(360, 200, draw, { key: "intro" + i, cls: "ipic", alt: "" })}<p>${text}</p></div><div class="iskip">Tap to skip · ${i + 1}/${PANELS.length}</div>`;
    };
    const finish = () => { if (done) return; done = true; clearTimeout(timer); el.classList.add("out"); el.style.pointerEvents = "none"; setTimeout(() => el.remove(), 300); onDone && onDone(); };
    const next = () => { if (done) return; i++; if (i >= PANELS.length) return finish(); show(); timer = setTimeout(next, opts.reduce ? 2200 : 1900); };
    el.addEventListener("click", finish);
    show(); document.body.appendChild(el);
    timer = setTimeout(next, opts.reduce ? 2200 : 1900);
    setTimeout(finish, 6000);   // never longer than six seconds
    return finish;
  }
  return { start, stats, keyRect, keyFit, createScene, intro, PANELS };
})();
