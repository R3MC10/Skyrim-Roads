/* fishart.js: how the fishing mini-game looks and moves (fishing.js keeps the rules, timing and balance). [OURS]
   Owner: "Use gpt to create art for minigames, they also should get a graphical and animation overhaul."
   Drawing units 640×360 (16:9, the painting's shape), sized by FITCANVAS.fixed in fishing.js.
   - mg-fishing-bg: the painted lake at dusk. The water moves (a gentle wobble of the painted rows, glints, fish rising),
     mist drifts along the far shore; night, rain, snow and fog are laid over it.
   - tool-fishing-rod: painted rod, drawn in slices along a bending spine: it flexes back on the aim, whips on the cast and
     bends like a spring with the line's tension. The line arcs out with the float on the cast and sags while you wait.
   - The float bobs with rings, twitches on nibbles and goes under with a splash on the real bite.
   - Reeling: the fish's shadow darts under the water (faster on its runs), and on a run it may leap out, painted.
     The catch card shows the painted fish (fish-<kind>, mapped below; other fish keep the ink drawing).
   Every picture is optional: without it that part keeps the old ink drawing. */
const FISHART = (() => {
  const DOM = typeof document !== "undefined";
  const W = 640, H = 360, HZ = 133;   // the painting's far shore line
  const img = (k) => (typeof ASSETS !== "undefined" ? ASSETS.img(k) : null);
  const L = (x) => { try { if (typeof I18N !== "undefined" && I18N.lang() === "pl") return I18N.tr(x) ?? x; } catch { /* no translator */ } return x; };
  const still = () => { try { return typeof A11Y !== "undefined" && A11Y.reduceMotion(); } catch { return false; } };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------------------------------------------------------------- fish pictures: [painted kind, tint] (a tint makes a cousin)
  const SPR = {
    fish_salmon: ["salmon"], fish_longfin: ["salmon", "hue-rotate(-14deg) saturate(1.15)"],
    fish_char: ["trout", "hue-rotate(-18deg) saturate(1.35)"], fish_grayling: ["trout", "saturate(.5) brightness(1.06)"],
    fish_perch: ["perch"], fish_betty: ["perch", "saturate(.65)"], fish_brookbass: ["perch", "hue-rotate(28deg) saturate(.85)"],
    fish_sunfish: ["perch", "saturate(1.45) brightness(1.08)"],
    fish_carp: ["goldcarp"], fish_histcarp: ["goldcarp", "saturate(.65) brightness(.9)"], fish_goldfish: ["goldcarp", "saturate(1.7) brightness(1.18)"],
    fish_pogfish: ["goldcarp", "saturate(.45) brightness(.85)"],
    fish_spadetail: ["pike", "hue-rotate(110deg) saturate(.8)"], fish_slaughterfish: ["pike", "saturate(.5) brightness(.8)"],
    fish_vampire: ["pike", "hue-rotate(220deg) saturate(.9) brightness(.75)"],
    fish_glasscat: ["ghostfish"], fish_glassfish: ["ghostfish", "hue-rotate(-24deg)"],
  };
  const KINDS = ["salmon", "trout", "perch", "goldcarp", "pike", "ghostfish"];
  const cache = new Map();   // id -> {img: canvas|image, sil: canvas}
  /* the painted picture for a fish id (tinted when it's a cousin), or null */
  function sprite(id) {
    const m = SPR[id]; if (!m || !DOM) return null;
    const c = cache.get(id); if (c) return c;
    const im = img("fish-" + m[0]); if (!im) return null;
    let pic = im;
    const mk = (w, h) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv; };
    try {
      if (m[1]) { const cv = mk(im.naturalWidth, im.naturalHeight), x = cv.getContext("2d"); if ("filter" in x) { x.filter = m[1]; } x.drawImage(im, 0, 0); pic = cv; }
    } catch { pic = im; }
    // the shadow under the water: a soft dark copy, a quarter the size
    let sil = null;
    try {
      const sw = Math.max(8, Math.round(im.naturalWidth / 4)), sh = Math.max(4, Math.round(im.naturalHeight / 4));
      sil = mk(sw + 12, sh + 12); const x = sil.getContext("2d");
      x.drawImage(im, 6, 6, sw, sh); x.globalCompositeOperation = "source-in"; x.fillStyle = "#081014"; x.fillRect(0, 0, sil.width, sil.height);
      if ("filter" in x) { const s2 = mk(sil.width, sil.height), y = s2.getContext("2d"); y.filter = "blur(2px)"; y.drawImage(sil, 0, 0); sil = s2; }
    } catch { sil = null; }
    const rec = { img: pic, sil, w: im.naturalWidth, h: im.naturalHeight };
    cache.set(id, rec); return rec;
  }
  /* ask for the pictures early so they're there when needed */
  function warm(id) { img("mg-fishing-bg"); img("tool-fishing-rod"); if (id && SPR[id]) img("fish-" + SPR[id][0]); }

  // ---------------------------------------------------------------- where things are
  const castD = (st) => clamp(((st.ctx.cast ?? 0.5) - 0.15) / 0.85);
  const spot = (d) => ({ x: 296 - d * 24, y: 304 - d * 124, s: 1 - d * 0.56 });   // the float's spot: near → far
  const NEAR = { x: 404, y: 322, s: 1.08 };   // where a reeled-in fish ends up, by the jetty
  const BUTT = { x: 614, y: 404 }, RLEN = 334, A0 = Math.atan2(-262, -186);
  // the open water in the painting (no reeds, rocks or jetty), in 768×432 preview units
  const POLY = [[118, 163], [768, 160], [768, 176], [690, 200], [655, 240], [640, 292], [548, 300], [540, 432], [372, 432], [360, 398], [300, 370],
    [300, 330], [240, 300], [200, 268], [160, 238], [130, 200]].map(([x, y]) => [x * W / 768, y * H / 432]);
  function inPoly(x, y) { let c = false; for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) { const [xi, yi] = POLY[i], [xj, yj] = POLY[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
  // glints on the water: fixed places, each with its own twinkle; warm ones along the sun's path
  const GLINTS = (() => {
    let a = 1234567; const r = () => ((a = (Math.imul(a, 1103515245) + 12345) >>> 0) / 4294967296);
    const out = [];
    for (let n = 0; out.length < 70 && n < 4000; n++) {
      const sun = out.length < 30, x = sun ? 96 + r() * 120 : 110 + r() * 520, y = sun ? 140 + r() * 110 : HZ + 6 + Math.pow(r(), 1.6) * 190;
      if (!inPoly(x, y)) continue;
      out.push({ x, y, w: 1.5 + ((y - HZ) / 200) * 6, ph: r() * 6.28, sp: 1 + r() * 2.2, warm: sun });
    }
    return out;
  })();
  const MIST = [{ x: 40, y: 128, r: 150, v: 6, a: 0.16 }, { x: 330, y: 118, r: 190, v: 4, a: 0.13 }, { x: 560, y: 136, r: 130, v: 7.5, a: 0.15 },
    { x: 200, y: 150, r: 120, v: 9, a: 0.09 }, { x: 470, y: 108, r: 170, v: 3, a: 0.1 }];

  // ---------------------------------------------------------------- state kept on st.fx
  function fresh() { return { parts: [], crowns: [], rises: [], bend: 0, bv: 0, prev: {}, sh: null, leap: null, out: null, snap: null, lost: null, lastLeap: 0, nextRise: 0, dartT: 0, dartX: 0, lt: 0 }; }
  function splash(fx, x, y, s, n, pow) {
    for (let i = 0; i < n; i++) {
      const a = (Math.random() * 2 - 1) * 0.95, sp = (50 + Math.random() * 110) * s * pow;
      fx.parts.push({ x: x + (Math.random() * 2 - 1) * 3 * s, y, vx: Math.sin(a) * sp, vy: -Math.cos(a) * sp * (0.8 + Math.random() * 0.5), y0: y, s, life: 0.5 + Math.random() * 0.5, t: 0, r: (0.7 + Math.random() * 1.2) * s });
    }
    fx.crowns.push({ x, y, s: s * pow, t: 0 });
  }

  /* the rod's spine: N+1 points from the butt to the tip */
  function spine(fx, st, T) {
    const p = st.phase;
    let a = A0;
    if (p === "aim") { const q = (st.pt * 0.85) % 2; a += (q < 1 ? q : 2 - q) * 0.32; }
    else if (p === "fly") { const k = clamp(st.pt / 0.7), a0 = A0 + castD(st) * 0.32; a = k < 0.3 ? lerp(a0, A0 - 0.14, Math.sin((k / 0.3) * Math.PI / 2)) : lerp(A0 - 0.14, A0, (k - 0.3) / 0.7); }
    else if (p === "reel" && st.g) a += Math.sin(T * 1.3) * 0.02 + (st.g.run > 0 ? Math.sin(T * 17) * 0.012 : 0);
    const N = 16, pts = [{ x: BUTT.x, y: BUTT.y, a }], b = fx.bend * 1.15;
    for (let i = 0; i < N; i++) {
      const s = (i + 0.5) / N, ang = a - b * s * s, q = pts[i];
      pts.push({ x: q.x + Math.cos(ang) * RLEN / N, y: q.y + Math.sin(ang) * RLEN / N, a: ang });
    }
    for (let i = 0; i < N; i++) pts[i].a = pts[i + 1].a;
    return pts;
  }
  function drawRod(g, pts, painted) {
    const rod = img("tool-fishing-rod"), N = pts.length - 1;
    if (rod && painted !== null) {
      const iw = rod.naturalWidth, ih = rod.naturalHeight, th = RLEN * ih / iw, sl = RLEN / N;
      g.imageSmoothingEnabled = true;
      for (let i = 0; i < N; i++) {
        const q = pts[i];
        g.save(); g.translate(q.x, q.y); g.rotate(q.a); g.scale(1, -1);
        g.drawImage(rod, (i / N) * iw, 0, iw / N + 1, ih, -0.3, -th / 2, sl + 0.9, th);
        g.restore();
      }
      return;
    }
    g.lineCap = "round";
    for (const [col, w0] of [["#3b2a1a", 5], ["#231d17", 1.4]]) {
      for (let i = 0; i < N; i++) { g.strokeStyle = col; g.lineWidth = Math.max(0.8, w0 * (1 - i / N * 0.7)); g.beginPath(); g.moveTo(pts[i].x, pts[i].y); g.lineTo(pts[i + 1].x, pts[i + 1].y); g.stroke(); }
    }
  }
  function drawFloat(g, x, y0, s, sink, painted) {
    const S = s * 1.45, y = y0 + sink * 9 * S;
    // reflection
    if (painted && sink < 0.5) { g.fillStyle = "rgba(190,60,40,.22)"; g.beginPath(); g.ellipse(x, y0 + 4 * S, 2.6 * S, 4 * S, 0, 0, 7); g.fill(); }
    g.save(); g.beginPath(); g.rect(0, 0, W, y0 + 0.6 * S); g.clip();
    g.strokeStyle = "#1b1612"; g.lineWidth = Math.max(0.8, 0.9 * S); g.beginPath(); g.moveTo(x, y - 15 * S); g.lineTo(x, y - 8 * S); g.stroke();
    const cap = g.createRadialGradient(x - 1.2 * S, y - 7.5 * S, 0.3 * S, x, y - 5.5 * S, 4.6 * S);
    cap.addColorStop(0, "#ff8a6a"); cap.addColorStop(0.5, "#c8382a"); cap.addColorStop(1, "#6e1a14");
    g.fillStyle = cap; g.beginPath(); g.ellipse(x, y - 5.5 * S, 3.2 * S, 4 * S, 0, 0, 7); g.fill();
    g.fillStyle = "#efe6cf"; g.beginPath(); g.ellipse(x, y - 1.2 * S, 3.4 * S, 2.3 * S, 0, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = painted ? "rgba(240,235,220,.55)" : "rgba(35,29,23,.6)"; g.lineWidth = 0.8;
    g.beginPath(); g.ellipse(x, y0 + 0.4 * S, (4 + sink * 2) * S, 1.2 * S, 0, 0, 7); g.stroke();
  }
  let LITE = false;   // light strokes (painted lake, or the ink lake at night)
  function ring(g, x, y, rx, a, painted) {
    if (a <= 0.01) return;
    painted = painted || LITE;
    g.strokeStyle = painted ? `rgba(240,236,222,${a.toFixed(3)})` : `rgba(35,29,23,${a.toFixed(3)})`; g.lineWidth = 0.9;
    g.beginPath(); g.ellipse(x, y, rx, rx * 0.27, 0, 0, 7); g.stroke();
  }
  function line(g, a, c, b, col, w) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(c.x, c.y, b.x, b.y); g.stroke(); }

  // ---------------------------------------------------------------- the painted backdrop
  let BG = null;
  function backdrop(g, bg, T, st, fx) {
    const cv = g.canvas, m = g.getTransform(), kx = m.a, ky = m.d;
    if (!BG || BG.width !== cv.width || BG.height !== cv.height || BG.src !== bg) {
      BG = document.createElement("canvas"); BG.width = cv.width; BG.height = cv.height; BG.src = bg;
      const c = BG.getContext("2d"); c.setTransform(kx, 0, 0, ky, 0, 0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high"; c.drawImage(bg, 0, 0, W, H);
    }
    const calm = still();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(BG, 0, 0);
    if (!calm) {   // the water's gentle wobble: rows of the painting slide a little, more near the bank
      g.beginPath(); POLY.forEach(([x, y], i) => (i ? g.lineTo(x * kx, y * ky) : g.moveTo(x * kx, y * ky))); g.closePath(); g.clip();
      const step = Math.max(2, Math.round(2.5 * ky)), wind = st.ctx.wx === "storm" ? 2.2 : st.ctx.wx === "rain" ? 1.5 : 1;
      for (let y = Math.floor((HZ + 2) * ky); y < cv.height; y += step) {
        const u = y / ky, near = clamp((u - HZ) / 200), amp = (0.25 + near * 1.5) * wind;
        const off = (Math.sin(u * 0.11 + T * 1.7) * amp + Math.sin(u * 0.31 - T * 2.6) * amp * 0.45) * kx;
        g.drawImage(BG, 0, y, cv.width, step, off, y, cv.width, step);
      }
    }
    g.restore();
    // glints
    g.save(); g.globalCompositeOperation = "lighter";
    for (const p of GLINTS) {
      const a = calm ? 0.25 : Math.pow(Math.max(0, Math.sin(T * p.sp + p.ph)), 4) * (p.warm ? 0.55 : 0.32) * (st.ctx.night ? 0.45 : 1);
      if (a < 0.02) continue;
      g.fillStyle = p.warm && !st.ctx.night ? `rgba(255,190,120,${a.toFixed(3)})` : `rgba(210,225,240,${a.toFixed(3)})`;
      g.fillRect(p.x - p.w / 2 + Math.sin(T * 0.7 + p.ph) * 2, p.y, p.w, Math.max(0.6, p.w * 0.18));
    }
    g.restore();
    // fish rising here and there
    if (!calm && T > fx.nextRise) {
      fx.nextRise = T + 1.4 + Math.random() * 2.6;
      for (let n = 0; n < 20; n++) { const x = 140 + Math.random() * 480, y = HZ + 14 + Math.random() * 150; if (inPoly(x, y)) { fx.rises.push({ x, y, s: 0.35 + ((y - HZ) / 200) * 0.8, t: 0 }); break; } }
    }
    // drifting mist along the far shore
    const fog = st.ctx.wx === "fog" ? 2.2 : st.ctx.wx === "storm" || st.ctx.wx === "rain" ? 1.3 : 1;
    for (const m2 of MIST) {
      const x = (((m2.x + (calm ? 0 : T * m2.v)) % (W + 2 * m2.r)) + 2 * m2.r) % (W + 2 * m2.r) - m2.r;
      g.save(); g.translate(x, m2.y); g.scale(1, 0.26);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, m2.r), a = Math.min(0.5, m2.a * fog * (st.ctx.night ? 0.6 : 1));
      gr.addColorStop(0, `rgba(232,226,214,${a})`); gr.addColorStop(1, "rgba(232,226,214,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, m2.r, 0, 7); g.fill(); g.restore();
    }
    // time and weather over the painting
    const wx = st.ctx.wx;
    if (st.ctx.night) {
      const sun = g.createRadialGradient(73, 43, 0, 73, 43, 120); sun.addColorStop(0, "rgba(10,16,30,.55)"); sun.addColorStop(1, "rgba(10,16,30,0)");
      g.fillStyle = sun; g.fillRect(0, 0, 260, 200);
      g.fillStyle = "rgba(9,16,34,.6)"; g.fillRect(0, 0, W, H);
      const mo = g.createRadialGradient(540, 46, 0, 540, 46, 70); mo.addColorStop(0, "rgba(220,228,240,.32)"); mo.addColorStop(1, "rgba(220,228,240,0)");
      g.fillStyle = mo; g.fillRect(440, 0, 200, 130);
      g.fillStyle = "#e9e6da"; g.beginPath(); g.arc(540, 46, 9, 0, 7); g.fill();
      g.fillStyle = "rgba(140,160,190,.35)"; g.beginPath(); g.arc(544, 43, 8, 0, 7); g.fill();
      // the moon's path on the water: broken glints
      g.save(); g.globalCompositeOperation = "lighter";
      for (let j = 0; j < 16; j++) { const y = 150 + j * 7 + (j % 3), w = 4 + j * 0.9, x = 538 + Math.sin(j * 2.3 + T * (still() ? 0 : 1.4)) * (2 + j * 0.6), a = 0.1 + 0.12 * Math.max(0, Math.sin(T * 2 + j * 1.9));
        g.fillStyle = `rgba(205,218,238,${a.toFixed(3)})`; g.fillRect(x - w / 2, y, w, 1.1); }
      g.restore();
    } else if (wx === "rain" || wx === "storm") { g.fillStyle = "rgba(40,48,60,.36)"; g.fillRect(0, 0, W, H); }
    else if (wx === "snow" || wx === "blizzard") { g.fillStyle = "rgba(196,206,222,.18)"; g.fillRect(0, 0, W, H); }
    else if (wx === "fog") { g.fillStyle = "rgba(200,200,196,.2)"; g.fillRect(0, 0, W, H); }
  }
  function weatherFront(g, st, T) {
    const wx = st.ctx.wx, calm = still();
    if (wx === "rain" || wx === "storm") {
      g.strokeStyle = "rgba(210,220,232,.32)"; g.lineWidth = 0.9; g.beginPath();
      for (let k = 0; k < (wx === "storm" ? 110 : 70); k++) { const x = (k * 97 + (calm ? 0 : T) * 300) % (W + 40) - 20, y = (k * 53 + (calm ? 0 : T) * 520) % H; g.moveTo(x, y); g.lineTo(x - 5, y + 14); }
      g.stroke();
      if (!calm) for (let k = 0; k < 14; k++) { const ph = (T * 1.3 + k * 0.37) % 1, x = 130 + ((k * 211) % 480), y = HZ + 20 + ((k * 67) % 170); if (inPoly(x, y)) ring(g, x, y, (2 + ph * 9) * (0.4 + (y - HZ) / 200), 0.35 * (1 - ph), true); }
    }
    if (wx === "snow" || wx === "blizzard") {
      g.save(); g.fillStyle = "#f6f6f4";
      for (let k = 0; k < (wx === "blizzard" ? 110 : 60); k++) {
        const z = 0.5 + (k % 5) / 4, x = ((k * 89 + (calm ? 0 : T) * (wx === "blizzard" ? 90 : 22) * z + 14 * Math.sin(T * 0.8 + k)) % W + W) % W, y = (k * 41 + (calm ? 0 : T) * 34 * z) % H;
        g.globalAlpha = 0.45 + z * 0.35; g.beginPath(); g.arc(x, y, 0.45 + z * 0.55, 0, 7); g.fill();
      }
      g.restore();
    }
  }

  // ---------------------------------------------------------------- one frame
  /* draw the whole picture. opt: { inkBack(g, T), inkFish(g, id, x, y, k, T, noName), isRare(id), name(id) } */
  function draw(g, st, ts, opt = {}) {
    const fx = st.fx || (st.fx = fresh());
    const T = ts / 1000, dt = clamp(fx.lt ? T - fx.lt : 0.016, 0, 0.05); fx.lt = T;
    const bg = img("mg-fishing-bg"), painted = !!bg, p = st.phase, d = castD(st), sp = spot(d);
    LITE = painted || !!st.ctx.night;
    // ---- what just happened
    const pr = fx.prev;
    if (pr.phase !== p) {
      if (p === "aim") { const keep = fx.nextRise; Object.assign(fx, fresh(), { nextRise: keep, lt: T }); }
      if (pr.phase === "fly" && p === "wait") splash(fx, sp.x, sp.y, sp.s, 9, 0.6);
      if (p === "reel") { fx.sh = { x: sp.x, y: sp.y + 6 * sp.s, vx: 0, vy: 0, face: -1 }; fx.d0 = d; fx.lastLeap = T; }
      if (pr.phase === "reel" && p === "done") {
        const sh = fx.sh || { x: sp.x, y: sp.y, face: -1 };
        if (st.result) { fx.out = { t: 0, x: sh.x, y: sh.y, face: sh.face, s: depthS(sh.y) }; splash(fx, sh.x, sh.y, depthS(sh.y), 16, 1); }
        else if (st.g?.over === "snap") fx.snap = { t: 0 };
        else fx.lost = { t: 0, x: sh.x, y: sh.y, face: sh.face || -1 };
        fx.leap = null;
      }
    }
    if (p === "wait" && st.bit && !pr.bit) { splash(fx, sp.x, sp.y, sp.s, 26, 1.35); fx.bv += 3; }
    if (p === "reel" && st.g) {
      const running = st.g.run > 0;
      if (running && !pr.run && !fx.leap && T - fx.lastLeap > 2.4 && Math.random() < 0.6 && fx.sh) {
        const s = depthS(fx.sh.y);
        fx.leap = { t: 0, dur: 0.85, x: fx.sh.x, y: fx.sh.y, face: fx.sh.face, s }; fx.lastLeap = T; splash(fx, fx.sh.x, fx.sh.y, s, 12, 0.9);
      }
      pr.run = running;
    }
    pr.phase = p; pr.bit = st.bit;
    // ---- the rod's spring
    let tgt = 0;
    if (p === "aim") { const q = (st.pt * 0.85) % 2; tgt = -0.08 * (q < 1 ? q : 2 - q); }
    else if (p === "wait") { const nib = (st.ripple || []).some((r) => r.small && r.t < 0.3); tgt = 0.07 + (st.bit ? 0.4 : nib ? 0.14 : 0); }
    else if (p === "reel" && st.g) tgt = 0.12 + Math.min(1, st.g.tension) * 0.9 + (st.g.run > 0 ? 0.1 * Math.sin(T * 19) : 0);
    else if (p === "done" && fx.out && fx.out.t < 0.5) tgt = 0.5;
    if (p === "fly" && st.pt < 0.05 && !fx.flung) { fx.bv -= 5; fx.flung = 1; }
    fx.bv += ((tgt - fx.bend) * 95 - fx.bv * 9.5) * dt; fx.bend = clamp(fx.bend + fx.bv * dt, -0.5, 1.3);
    // ---- backdrop
    if (painted) backdrop(g, bg, T, st, fx); else if (opt.inkBack) opt.inkBack(g, T);
    // ambient rises
    fx.rises = fx.rises.filter((r) => (r.t += dt) < 1.6);
    for (const r of fx.rises) { ring(g, r.x, r.y, (2 + r.t * 9) * r.s, 0.4 * (1 - r.t / 1.6), painted); if (r.t > 0.3) ring(g, r.x, r.y, (1 + (r.t - 0.3) * 7) * r.s, 0.3 * (1 - r.t / 1.6), painted); }
    const LINE = LITE ? "rgba(238,230,210,.78)" : "rgba(35,29,23,.82)";
    const pts = spine(fx, st, T), tip = pts[pts.length - 1];
    // ---- under the water: the fish's shadow
    let mouth = null;
    if (p === "reel" && st.g && fx.sh) mouth = swim(g, st, fx, T, dt, painted);
    else if (p === "done" && fx.lost) {
      const L2 = fx.lost; L2.t += dt;
      if (L2.t < 1.2) shadow(g, st.landed || st.fish, L2.x + L2.face * 130 * L2.t * depthS(L2.y), L2.y - 30 * L2.t, depthS(L2.y) * (1 - L2.t * 0.4), L2.face, 0.45 * (1 - L2.t / 1.2), T);
    }
    // ---- float, rings and line
    if (p === "fly") {
      const k = clamp(st.pt / 0.7), ke = 1 - (1 - k) * (1 - k);
      const fl = { x: lerp(tip.x, sp.x, ke), y: lerp(tip.y, sp.y, ke) - Math.sin(k * Math.PI) * (70 + 60 * d) };
      line(g, tip, { x: (tip.x + fl.x) / 2 + 10, y: Math.min(tip.y, fl.y) - 28 * (1 - k) + 18 * k }, fl, LINE, 0.9);
      drawFloat(g, fl.x, fl.y, lerp(0.95, sp.s, ke), 0, painted);
    } else if (p === "wait" || (p === "done" && !st.g && st.wait)) {
      const S = sp.s, live = p === "wait";
      for (let j = 0; j < 2; j++) { const age = ((T / 2.6) + j * 0.5) % 1; ring(g, sp.x, sp.y + 0.5 * S, (5 + age * 16) * S * 1.3, 0.22 * (1 - age), painted); }
      for (const r of st.ripple || []) ring(g, sp.x, sp.y + 0.5 * S, (4 + r.t * (r.small ? 14 : 30)) * S * 1.3, (1 - r.t / 1.4) * (r.small ? 0.45 : 0.75), painted);
      const nib = live && (st.ripple || []).filter((r) => r.small && r.t < 0.3).map((r) => 1 - r.t / 0.3)[0];
      const under = live && st.bit ? clamp((st.pt - st.wait.at) / 0.25) : 0;
      const bob = (still() ? 0 : Math.sin(T * 2 * Math.PI / 2.6) * 0.12) + (nib ? nib * 0.35 : 0);
      const end = { x: sp.x, y: sp.y - 10 * S * (1 - under) };
      line(g, tip, { x: lerp(tip.x, end.x, 0.62), y: Math.min(end.y + 1, lerp(tip.y, end.y, 0.62) + (under ? 8 : 34)) }, end, LINE, 0.85);
      drawFloat(g, sp.x, sp.y, S, Math.max(0, bob) + under * 1.4 + Math.min(0, bob) * 0.5, painted);
    } else if (p === "reel" && mouth) {
      const tens = Math.min(1, st.g.tension), hot = tens > st.g.band[1];
      line(g, tip, { x: lerp(tip.x, mouth.x, 0.55), y: Math.min(mouth.y + 2, lerp(tip.y, mouth.y, 0.55) + (1 - tens) * 50 + 4) }, mouth, hot ? "#ff6a4a" : LINE, 0.8 + tens * 0.9);
      if (!fx.leap) { const age = (T * 1.6) % 1; ring(g, mouth.x, mouth.y, (2 + age * 9) * depthS(mouth.y), 0.4 * (1 - age), painted); }
    } else if (p === "done" && fx.snap) {
      const k = clamp((fx.snap.t += dt) / 0.9);
      if (k < 1) { g.save(); g.globalAlpha = 1 - k; const end = { x: tip.x - 30 - k * 40, y: tip.y + 40 + k * 120 }; line(g, tip, { x: tip.x - 60 + Math.sin(k * 20) * 10, y: tip.y - 20 + k * 30 }, end, LINE, 0.9); g.restore(); }
    } else if (p === "done" && st.result) {
      line(g, tip, { x: tip.x - 20, y: tip.y + 60 }, { x: tip.x - 6, y: tip.y + 110 }, LINE, 0.8);
    }
    // ---- out of the water: a leap, or the landed fish jumping out
    if (p === "reel" && fx.leap) {
      const lp = fx.leap; lp.t += dt; const k = lp.t / lp.dur;
      if (k >= 1) { splash(fx, lp.x + lp.face * 70 * lp.s, lp.y, lp.s, 14, 0.9); fx.leap = null; if (fx.sh) fx.sh.x = lp.x + lp.face * 70 * lp.s; }
      else {
        const x = lp.x + lp.face * 70 * lp.s * k, y = lp.y - Math.sin(k * Math.PI) * 62 * lp.s;
        fishPic(g, st.fish, x, y, lp.s * fishW(st), lp.face, lp.face * (-0.75 + 1.5 * k), opt, T);
        if (Math.random() < 0.5) fx.parts.push({ x, y: y + 4, vx: (Math.random() - 0.5) * 30, vy: 10, y0: lp.y, s: lp.s, life: 0.5, t: 0, r: 0.9 * lp.s });
      }
    }
    if (p === "done" && fx.out && st.result) {
      const o = fx.out; o.t += dt; const k = clamp(o.t / 0.55);
      if (k < 1) fishPic(g, st.result.item, o.x + o.face * 30 * k, o.y - Math.sin(k * Math.PI * 0.6) * 110 * o.s - k * 40, o.s * fishW(st) * (1 + k * 0.4), o.face, o.face * (-0.9 + k * 0.7), opt, T, 1 - k * k);
    }
    // ---- the rod over everything on the water
    drawRod(g, pts, painted ? true : null);
    // ---- splashes
    fx.parts = fx.parts.filter((q) => (q.t += dt) < q.life && !(q.vy > 0 && q.y > q.y0 + 2));
    for (const q of fx.parts) {
      q.vy += 380 * q.s * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      g.fillStyle = LITE ? `rgba(236,242,246,${(0.85 * (1 - q.t / q.life)).toFixed(3)})` : `rgba(35,29,23,${(0.7 * (1 - q.t / q.life)).toFixed(3)})`;
      g.beginPath(); g.arc(q.x, q.y, q.r, 0, 7); g.fill();
    }
    fx.crowns = fx.crowns.filter((c) => (c.t += dt) < 0.5);
    for (const c of fx.crowns) {
      const k = c.t / 0.5, h = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 13 * c.s, rx = (4 + k * 9) * c.s;
      g.strokeStyle = LITE ? `rgba(236,242,246,${(0.75 * (1 - k)).toFixed(3)})` : `rgba(35,29,23,${(0.6 * (1 - k)).toFixed(3)})`; g.lineWidth = 1.1 * Math.max(0.6, c.s);
      g.beginPath();
      for (let j = 0; j < 11; j++) { const a = (j / 10) * Math.PI, x = c.x - Math.cos(a) * rx, y = c.y - Math.sin(a) * rx * 0.25; g.moveTo(x, y); g.lineTo(x - Math.cos(a) * 3 * c.s, y - h * (0.6 + 0.4 * Math.sin(a))); }
      g.stroke(); ring(g, c.x, c.y, rx * 1.4, 0.6 * (1 - k), painted);
    }
    if (painted) weatherFront(g, st, T);
    // ---- the catch card
    if (p === "done" && st.result) {
      if (fx.cardFor !== st.result) { fx.cardFor = st.result; fx.cardT = T + (fx.out && fx.out.t < 0.3 ? 0.4 : 0); }
      card(g, st, T - fx.cardT, T, opt, painted);
    }
  }
  const depthS = (y) => clamp(1.08 - ((322 - y) / 142) * 0.62, 0.4, 1.12);
  const fishW = (st) => 70 + ((st.g?.str) || 2) * 10;

  /* the fish under the water while you reel: returns where the line meets it */
  function swim(g, st, fx, T, dt, painted) {
    const G2 = st.g, sh = fx.sh, run = G2.run > 0, far = spot(fx.d0 ?? 0.5), k = clamp(Math.min(1.25, G2.dist) / 1, 0, 1.25);
    const bx = lerp(NEAR.x, far.x, k), by = Math.max(HZ + 18, lerp(NEAR.y, far.y, k)), s = depthS(by);
    if ((fx.dartT -= dt) <= 0) { fx.dartX = (Math.random() * 2 - 1) * (run ? 80 : 30); fx.dartT = run ? 0.22 + Math.random() * 0.3 : 0.8 + Math.random() * 1.3; }
    const calm = still(), tx = bx + fx.dartX * s, ty = by + (calm ? 0 : Math.sin(T * 1.3) * 5 * s);
    const kk = run ? 22 : 5, dd = run ? 6 : 3.2;
    sh.vx += ((tx - sh.x) * kk - sh.vx * dd) * dt; sh.vy += ((ty - sh.y) * kk - sh.vy * dd) * dt;
    sh.x += sh.vx * dt; sh.y += sh.vy * dt;
    if (sh.vx > 10) sh.face = 1; else if (sh.vx < -10) sh.face = -1;
    const ss = depthS(sh.y), w = fishW(st) * ss;
    if (!fx.leap) {
      shadow(g, st.fish, sh.x, sh.y, ss, sh.face, painted ? (st.ctx.night ? 0.7 : 0.55) : 0.55, T, fishW(st), run);
      if (run && !calm) {   // a wake behind it
        g.strokeStyle = painted ? "rgba(236,240,240,.35)" : "rgba(35,29,23,.35)"; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(sh.x + sh.face * w * 0.45, sh.y - 3 * ss); g.lineTo(sh.x - sh.face * w * 0.6, sh.y - 7 * ss); g.moveTo(sh.x + sh.face * w * 0.45, sh.y - 3 * ss); g.lineTo(sh.x - sh.face * w * 0.6, sh.y + 2 * ss); g.stroke();
      }
    }
    if (fx.leap) { const lp = fx.leap, kq = clamp(lp.t / lp.dur); return { x: lp.x + lp.face * 70 * lp.s * kq + lp.face * fishW(st) * lp.s * 0.45, y: lp.y - Math.sin(kq * Math.PI) * 62 * lp.s }; }
    return { x: sh.x + sh.face * w * 0.45, y: sh.y - 4 * ss };
  }
  function shadow(g, id, x, y, s, face, a, T, wBase = 74, run) {
    const sp = sprite(id), w = wBase * s, wig = still() ? 0 : Math.sin(T * (run ? 16 : 6)) * (run ? 0.1 : 0.05);
    g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(face, 1); g.rotate(wig);
    if (sp && sp.sil) { const h = w * sp.sil.height / sp.sil.width; g.drawImage(sp.sil, -w / 2, -h / 2, w, h); }
    else { g.fillStyle = "#0b1216"; g.beginPath(); g.ellipse(0, 0, w * 0.36, w * 0.11, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(-w * 0.32, 0); g.lineTo(-w * 0.5, -w * 0.1); g.lineTo(-w * 0.5, w * 0.1); g.fill(); }
    g.restore();
  }
  /* the fish itself, painted (or ink), w units long, facing face (1 right / -1 left), turned by rot */
  function fishPic(g, id, x, y, w, face, rot, opt, T, alpha = 1) {
    const sp = sprite(id);
    g.save(); g.globalAlpha = alpha; g.translate(x, y); g.rotate(rot); g.scale(face, 1);
    if (sp) { const h = w * sp.h / sp.w; g.drawImage(sp.img, -w / 2, -h / 2, w, h); }
    else if (opt.inkFish) { const k = w / 110; opt.inkFish(g, id, 0, 0, k, T, true, true); }
    g.restore();
  }
  /* the catch card: the fish, its name, rare / first-of-its-kind tags */
  function card(g, st, t, T, opt, painted) {
    if (t < 0) return;
    const k = clamp(t / 0.65), e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2), id = st.result.item, rare = opt.isRare?.(id);
    const cx = W / 2, cy = 150, cw = 420, ch = 214, sc = 0.82 + 0.18 * e;
    g.save(); g.globalAlpha = clamp(k * 1.6); g.translate(cx, cy + (1 - e) * 24); g.scale(sc, sc);
    // the panel: smoked glass with silver rules
    g.fillStyle = "rgba(8,9,11,.9)"; g.fillRect(-cw / 2, -ch / 2, cw, ch);
    g.strokeStyle = "rgba(228,220,200,.42)"; g.lineWidth = 1; g.strokeRect(-cw / 2 + 0.5, -ch / 2 + 0.5, cw - 1, ch - 1);
    g.strokeStyle = "rgba(228,220,200,.16)"; g.strokeRect(-cw / 2 + 5, -ch / 2 + 5, cw - 10, ch - 10);
    g.fillStyle = rare ? "#e2bb64" : "#cfc6b0"; g.font = "600 15px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    const head = (rare ? L("Rare catch") : L("Caught")).toUpperCase().split("").join(String.fromCharCode(8202));
    g.fillText(head, 0, -ch / 2 + 22);
    g.strokeStyle = "rgba(228,220,200,.3)"; g.beginPath(); g.moveTo(-90, -ch / 2 + 34); g.lineTo(90, -ch / 2 + 34); g.stroke();
    // a glow behind the fish
    const gl = g.createRadialGradient(0, -4, 0, 0, -4, 170);
    gl.addColorStop(0, rare ? "rgba(226,187,100,.28)" : "rgba(200,215,225,.14)"); gl.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gl; g.fillRect(-cw / 2 + 6, -ch / 2 + 36, cw - 12, ch - 80);
    const sp = sprite(id), sway = still() ? 0 : Math.sin(T * 1.6) * 0.035, bob = still() ? 0 : Math.sin(T * 1.1) * 2;
    if (sp) {
      const maxW = 310, maxH = 104, r = Math.min(maxW / sp.w, maxH / sp.h), w = sp.w * r, h = sp.h * r;
      g.save(); g.translate(0, -2 + bob); g.rotate(sway);
      g.globalAlpha *= 0.35; g.fillStyle = "#000"; g.beginPath(); g.ellipse(4, h / 2 + 8, w * 0.38, 5, 0, 0, 7); g.fill(); g.globalAlpha /= 0.35;
      g.drawImage(sp.img, -w / 2, -h / 2, w, h); g.restore();
    } else if (opt.inkFish) { g.save(); g.translate(0, -2 + bob); g.rotate(sway); opt.inkFish(g, id, 0, 0, 1.25, T, true); g.restore(); }
    if (rare && !still()) {
      g.save(); g.globalCompositeOperation = "lighter";
      for (let j = 0; j < 10; j++) { const a = j * 0.63 + T * 0.6, rr = 120 + 18 * Math.sin(T * 2 + j), x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.36 - 4, tw = Math.max(0, Math.sin(T * 3 + j * 1.7));
        g.fillStyle = `rgba(255,215,140,${(0.7 * tw).toFixed(3)})`; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 1.2, y); g.lineTo(x, y + 4); g.lineTo(x - 1.2, y); g.fill(); }
      g.restore();
    }
    g.fillStyle = "#f2ead8"; g.font = "600 26px 'Barlow Condensed', sans-serif";
    g.fillText(opt.name ? opt.name(id) : id, 0, ch / 2 - 42);
    const tags = [];
    if (st.result.first) tags.push(L("First of its kind"));
    for (const x of st.result.extra || []) tags.push("+ " + (opt.name ? opt.name(x) : x));
    if (tags.length) { g.fillStyle = "#b8b09c"; g.font = "500 16px 'Barlow Condensed', sans-serif"; g.fillText(tags.join("  ·  "), 0, ch / 2 - 18); }
    g.restore();
  }
  return { W, H, SPR, KINDS, warm, sprite, draw, spot, castD, inPoly, POLY, GLINTS };
})();
if (typeof module !== "undefined") module.exports = FISHART;
