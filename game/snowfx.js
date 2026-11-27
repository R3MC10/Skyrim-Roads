/* snowfx.js: realistic falling snow over the world map, seen from above. [OURS]
     SNOWFX.draw(g, w, h, dpr, { weather, reduce, lite })   call every map frame; g in device pixels (identity transform)
       weather: "snow" | "blizzard" | "lightsnow" | "heavysnow" (anything else: the snow eases away)
     SNOWFX.live()  flakes in view (tests)
   Built and tuned in the Snow Lab artifact. The map is the ground seen from a camera above it (slightly tilted, as the
   painting is drawn from the south): every flake has a height and falls away from you toward the ground, so it shrinks
   and slides toward where it lands while the wind carries it. Flakes are irregular clumps of crystals (no "star" icons),
   lit from the upper left, soft and partly see-through; they tumble and catch the light; near the camera they blur into
   faint discs; fast ones smear like film. One gusting wind with eddies moves the sky. A blizzard is mostly small hard
   grains blown nearly flat, with blowing snow along the ground and drifting whiteout. The weather eases over seconds.
   Cheap: a few hundred sprites a frame, fewer on Lite motion, still when motion is reduced. */
const SNOWFX = (() => {
  const CAM = 1000, HMAX = 700, TILT = 0.32;
  const WX = {
    clear:     { n: 0,    wind: 12,  gust: 0.5, fall: 1,   kinds: [0.6, 0.4, 0],     size: 1,    whiteout: 0, drift: 0 },
    lightsnow: { n: 140,  wind: 10,  gust: 0.5, fall: 0.8, kinds: [0.85, 0.15, 0],   size: 1.35, whiteout: 0, drift: 0 },
    snow:      { n: 420,  wind: 28,  gust: 0.7, fall: 1,   kinds: [0.65, 0.3, 0.05], size: 1,    whiteout: 0, drift: 0 },
    heavysnow: { n: 800,  wind: 60,  gust: 0.9, fall: 1.15,kinds: [0.55, 0.2, 0.25], size: 0.95, whiteout: 0.25, drift: 0.3 },
    blizzard:  { n: 1300, wind: 230, gust: 1.2, fall: 1.4, kinds: [0.15, 0.15, 0.7], size: 0.8,  whiteout: 0.8, drift: 1 },
  };
  const C0 = "246,248,252";
  let P = JSON.parse(JSON.stringify(WX.clear)), want = "clear", W = 0, H = 0, t = 0, last = 0, wind = [0, 0], windFrom = 290, gustMul = 1, alive = 0, A = null;
  const F = [], tmp = [0, 0], rnd = (a, b) => a + Math.random() * (b - a), ease = (a, b, k) => a + (b - a) * k;
  const SZ = 96;
  function canvasOf() { const c = document.createElement("canvas"); c.width = c.height = SZ; return c; }
  function shadeFinish(c, C) {   // tint toward the light's colour, add a soft edge glow from scattered light
    const x = c.getContext("2d"), o = canvasOf(), y = o.getContext("2d");
    y.filter = "blur(3px)"; y.globalAlpha = 0.9; y.drawImage(c, 0, 0); y.filter = "blur(1.6px)"; y.globalAlpha = 0.9; y.drawImage(c, 0, 0); y.filter = "blur(0.6px)"; y.globalAlpha = 0.7; y.drawImage(c, 0, 0); y.filter = "none";   // softened: the fine arms run together, as they do seen from any distance   // glow from light scattering in the ice, so small flakes stay visible
    y.globalCompositeOperation = "source-atop"; const gr = y.createLinearGradient(0, 0, SZ, SZ); gr.addColorStop(0, `rgba(${C},1)`); gr.addColorStop(1, "rgba(178,194,222,1)"); y.fillStyle = gr; y.globalAlpha = 0.55; y.fillRect(0, 0, SZ, SZ);
    return o;
  }
  // a stellar dendrite: six arms with side branches, a little ragged
  function dendrite(x, cx, cy, R, lw, rag) {
    x.lineCap = "round";
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3 + rag * 0.08, ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R;
      x.lineWidth = lw; x.beginPath(); x.moveTo(cx, cy); x.lineTo(ex, ey); x.stroke();
      const nb = 3 + (rag * 7 | 0) % 2;
      for (let b = 1; b <= nb; b++) {
        const f = b / (nb + 1), bx = cx + Math.cos(a) * R * f, by = cy + Math.sin(a) * R * f, bl = R * (0.42 - f * 0.28) * (0.8 + ((k * 13 + b * 7 + rag * 50) % 10) / 25);
        x.lineWidth = lw * 0.7;
        for (const sg of [-1, 1]) { const ba = a + sg * Math.PI / 3; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl); x.stroke(); }
      }
    }
    x.beginPath(); x.arc(cx, cy, lw * 1.3, 0, 7); x.fill();
  }
  function plate(x, cx, cy, R, rot) {
    x.beginPath(); for (let k = 0; k < 6; k++) { const a = rot + k * Math.PI / 3; x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } x.closePath();
    x.globalAlpha = 0.55; x.fill(); x.globalAlpha = 1; x.lineWidth = 1.4; x.stroke();
  }
  function makeAtlas(C) {
    const A = { clump: [], crystal: [], grain: [], disc: null };
    for (let n = 0; n < 10; n++) {   // aggregates: several crystals tangled into one irregular clump
      const c = canvasOf(), x = c.getContext("2d"); x.strokeStyle = x.fillStyle = "#fff";
      const parts = 4 + (n % 4);
      for (let i = 0; i < parts; i++) {
        const rr = 9 + Math.random() * 13, px = SZ / 2 + (Math.random() - 0.5) * 30, py = SZ / 2 + (Math.random() - 0.5) * 30;
        x.save(); x.translate(px, py); x.rotate(Math.random() * 7); x.scale(1, 0.45 + Math.random() * 0.55);   // seen at a slant
        x.globalAlpha = 0.6 + Math.random() * 0.4;
        if (Math.random() < 0.7) dendrite(x, 0, 0, rr, 1.6, Math.random()); else plate(x, 0, 0, rr * 0.7, Math.random());
        x.restore();
      }
      x.globalAlpha = 1; A.clump.push(shadeFinish(c, C));
    }
    for (let n = 0; n < 8; n++) {   // small flakes: a couple of crystals stuck together, seen at a slant, never a clean star
      const c = canvasOf(), x = c.getContext("2d"); x.strokeStyle = x.fillStyle = "#fff";
      const parts = 2 + (n % 2);
      for (let i = 0; i < parts; i++) {
        x.save(); x.translate(SZ / 2 + (Math.random() - 0.5) * 16, SZ / 2 + (Math.random() - 0.5) * 16); x.rotate(Math.random() * 7); x.scale(1, 0.35 + Math.random() * 0.5);
        x.globalAlpha = 0.55 + Math.random() * 0.35;
        if (Math.random() < 0.5) dendrite(x, 0, 0, 14 + Math.random() * 10, 2.6, Math.random()); else plate(x, 0, 0, 12 + Math.random() * 6, Math.random());
        x.restore();
      }
      x.globalAlpha = 1; A.crystal.push(shadeFinish(c, C));
    }
    for (let n = 0; n < 6; n++) {   // graupel: little lumpy pellets, rimed and opaque
      const c = canvasOf(), x = c.getContext("2d"); x.fillStyle = "#fff";
      for (let i = 0; i < 14; i++) { const a = Math.random() * 7, d = Math.random() * 12; x.globalAlpha = 0.5 + Math.random() * 0.5; x.beginPath(); x.arc(SZ / 2 + Math.cos(a) * d, SZ / 2 + Math.sin(a) * d, 7 + Math.random() * 7, 0, 7); x.fill(); }
      x.globalAlpha = 1; A.grain.push(shadeFinish(c, C));
    }
    { // out of focus: a faint even disc with a slightly brighter rim, mostly see-through
      const c = canvasOf(), x = c.getContext("2d"), m = SZ / 2, gr = x.createRadialGradient(m, m, 0, m, m, m);
      gr.addColorStop(0, `rgba(${C},.16)`); gr.addColorStop(0.8, `rgba(${C},.2)`); gr.addColorStop(0.92, `rgba(${C},.28)`); gr.addColorStop(1, `rgba(${C},0)`);
      x.fillStyle = gr; x.beginPath(); x.arc(m, m, m, 0, 7); x.fill(); A.disc = c;
    }
    return A;
  }
  const atlas = () => A || (A = makeAtlas(C0));
  const rndSeed = rnd(0, 100); let gustSeed = rndSeed;
  function gustAt(tt) { const a = Math.sin(tt * 0.19 + gustSeed) * 0.55 + Math.sin(tt * 0.47 + gustSeed * 1.9) * 0.3 + Math.sin(tt * 1.13 + gustSeed * 0.7) * 0.15; return 1 + a * P.gust * gustMul; }
  function eddy(x, y, h, tt, out) {   // a cheap divergence-free-ish swirl field
    const k1 = 0.006, k2 = 0.017;
    const a = Math.sin(y * k1 + tt * 0.35 + h * 0.004) + 0.5 * Math.sin(y * k2 - tt * 0.9 + x * 0.004);
    const b = Math.sin(x * k1 - tt * 0.3 + h * 0.003) + 0.5 * Math.sin(x * k2 + tt * 0.8 - y * 0.004);
    out[0] = a; out[1] = -b; return out;
  }

  function make(f, fresh) {
    const r = Math.random(), K = P.kinds; f.kind = r < K[0] ? 0 : r < K[0] + K[1] ? 1 : 2;   // 0 fluffy clump, 1 crystal, 2 hard grain
    f.vz = (f.kind === 0 ? rnd(45, 85) : f.kind === 1 ? rnd(35, 60) : rnd(95, 150)) * P.fall;   // px/s of height
    f.r = (f.kind === 0 ? rnd(1.3, 2.6) : f.kind === 1 ? rnd(0.9, 1.6) : rnd(0.5, 0.9)) * P.size;
    f.flA = f.kind === 0 ? rnd(4, 10) : f.kind === 1 ? rnd(2, 5) : rnd(0.3, 1);   // flutter (px) and rate
    f.flF = f.kind === 2 ? rnd(4, 7) : rnd(1.2, 3.2); f.ph = rnd(0, 7); f.ph2 = rnd(0, 7);
    f.si = Math.random() * 1000 | 0; f.op = rnd(0.45, 0.8); f.rot = rnd(0, 7); f.spin = rnd(-1.5, 1.5) * (f.kind === 2 ? 2 : 1); f.tum = rnd(0.6, 2.2); f.glint = rnd(0, 7);
    f.h = fresh ? rnd(4, HMAX) : HMAX * rnd(0.85, 1);
    // place it so it shows somewhere over the view (or just upwind of it)
    const s = CAM / (CAM - f.h), sx = rnd(-0.15, 1.15) * W, sy = rnd(-0.15, 1.15) * H;
    f.x = W / 2 + (sx - W / 2) / s; f.y = H / 2 + (sy - H / 2 + f.h * TILT * s) / s;
    f.vx = wind[0]; f.vy = wind[1]; f.age = 0; f.px = f.py = null; f.dead = false; return f;
  }

  function draw(g, w, h, dpr, o = {}) {
    if (typeof document === "undefined") return;
    W = w; H = h;
    const now = performance.now(); let dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    if (o.reduce) dt = 0;
    t += dt;
    want = WX[o.weather] ? o.weather : "clear";
    const T = WX[want], k = 1 - Math.exp(-(dt || 0.016) / 1.2);
    for (const key of Object.keys(P)) if (key === "kinds") P.kinds = P.kinds.map((v, i) => ease(v, T.kinds[i], k)); else P[key] = ease(P[key], T[key], k);
    if (P.n < 2 && !F.length) return;
    const ang = (windFrom + 180) * Math.PI / 180, ws = P.wind * gustAt(t);
    wind = [Math.sin(ang) * ws, -Math.cos(ang) * ws];
    const cap = Math.round(P.n * (o.lite ? 0.4 : 1) * Math.min(1.5, (W * H) / (600 * 800)));
    g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (P.whiteout > 0.02) {   // whiteout that comes and goes in patches, carried by the wind
      for (let i = 0; i < 4; i++) {
        const px = ((i * 0.37 + t * wind[0] / 1400) % 1.6 + 1.6) % 1.6 - 0.3, py = ((i * 0.61 + t * wind[1] / 1400) % 1.6 + 1.6) % 1.6 - 0.3;
        const rr = (0.35 + 0.15 * Math.sin(t * 0.3 + i)) * Math.max(W, H), cx = px * W, cy = py * H, gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
        gr.addColorStop(0, `rgba(${C0},${(0.2 * P.whiteout).toFixed(3)})`); gr.addColorStop(1, `rgba(${C0},0)`);
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
    }
    const SPS = atlas();
    while (F.length < cap) F.push(make({}, true));
    alive = 0;
    const shutter = 1 / 40;   // how much of its motion a flake smears over, like a film camera's shutter
    for (const f of F) {
      if (f.dead) continue;
      // air: the wind and the eddies (stronger high up, calmer near the ground)
      const lift = 0.55 + 0.45 * Math.min(1, f.h / 300);
      eddy(f.x, f.y, f.h, t, tmp);
      const ed = 14 + Math.hypot(wind[0], wind[1]) * 0.35;
      const tx = (wind[0] + tmp[0] * ed) * lift, ty = (wind[1] + tmp[1] * ed) * lift;
      const resp = f.kind === 2 ? 2.4 : 1.4;   // light clumps lag the gusts a little more
      f.vx += (tx - f.vx) * Math.min(1, dt * resp); f.vy += (ty - f.vy) * Math.min(1, dt * resp);
      // flutter: a small wobbling loop as the flake rocks
      const fl = f.flA, fx = Math.cos(t * f.flF + f.ph) * fl, fy = Math.sin(t * f.flF * 0.8 + f.ph2) * fl * 0.6;
      f.x += f.vx * dt; f.y += f.vy * dt; f.h -= f.vz * dt * (1 + 0.15 * Math.sin(t * f.flF * 0.5 + f.ph)); f.age += dt;
      // blowing snow: in strong wind, a share of grains near the ground get swept along it instead of settling
      if (f.h <= 0) {
        if (P.drift > 0.05 && f.kind === 2 && Math.random() < 0.35 * P.drift && !f.drifted) { f.h = rnd(2, 18); f.vz = rnd(6, 14); f.drifted = true; f.vx *= 1.6; f.vy *= 1.6; }
        else if (alive >= cap) { f.dead = true; continue; } else { make(f, false); continue; }
      }
      // project to the screen
      const s = CAM / (CAM - f.h), X = W / 2 + (f.x + fx - W / 2) * s, Y = H / 2 + (f.y + fy - H / 2) * s - f.h * TILT * s;
      const px = f.px, py = f.py; f.px = X; f.py = Y;
      // the air keeps coming: a flake blown out of one side comes back in on the other (wrapped at its own height),
      // so the view stays evenly filled whatever the wind does
      const M = 60;
      if (X < -M || X > W + M || Y < -M || Y > H + M) {
        const spanX = (W + 2 * M) / s, spanY = (H + 2 * M) / s;
        if (X < -M) f.x += spanX; else if (X > W + M) f.x -= spanX;
        if (Y < -M) f.y += spanY; else if (Y > H + M) f.y -= spanY;
        f.px = f.py = null; continue;
      }
      alive++;
      // size, focus and brightness: the camera is focused on the ground, so flakes close to it blur into discs
      const rad = f.r * s, defocus = Math.max(0, (s - 2.2) / 2.4);
      const near = Math.min(1, f.h / 40), fadeIn = Math.min(1, f.age * 3);
      let a = (0.75 + 0.25 * Math.min(1, s / 2)) * near * fadeIn / (1 + defocus * 1.6);
      if (f.drifted) a *= 0.7;
      // motion blur: the distance it moved on screen during the "shutter"
      const vxS = px == null ? 0 : (X - px) / Math.max(dt, 1e-4), vyS = py == null ? 0 : (Y - py) / Math.max(dt, 1e-4);
      const smear = Math.hypot(vxS, vyS) * shutter;
      f.rot += f.spin * dt;
      // tumbling: the flake turns edge-on and face-on as it rocks, and catches the light for a moment when it faces it
      const face = Math.abs(Math.cos(t * f.tum + f.ph)), glint = Math.pow(Math.max(0, Math.cos(t * f.tum * 1.7 + f.glint)), 24);
      const list = f.kind === 0 ? SPS.clump : f.kind === 1 ? SPS.crystal : SPS.grain;
      const spr = defocus > 0.35 ? SPS.disc : list[f.si % list.length];
      const D = Math.max(4.5, rad * (1 + defocus * 3.2) * 3.9);   // the sprite has empty room round the flake; never smaller than a visible speck
      const sq = defocus > 0.35 ? 1 : 0.3 + 0.7 * face;   // edge-on flakes look thin
      const aa = Math.min(0.9, a * f.op * (defocus > 0.35 ? 1 : 0.8 + 0.5 * glint));   // snow is part see-through: thin ice and air
      if (smear > D * 0.25) {   // motion blur along its path
        const len = smear + D * 0.45, an = Math.atan2(vyS, vxS);
        g.save(); g.translate(X, Y); g.rotate(an); g.globalAlpha = Math.min(1, aa * Math.max(0.5, Math.min(1, D * 0.7 / len + 0.3))); g.drawImage(spr, -len / 2 - D * 0.3, -D * 0.5 * sq, len + D * 0.6, D * sq); g.restore();
      } else {
        g.save(); g.translate(X, Y); g.rotate(f.rot); g.scale(1, sq); g.globalAlpha = aa; g.drawImage(spr, -D / 2, -D / 2, D, D); g.restore();
      }
    }
    for (let i = F.length - 1; i >= 0; i--) if (F[i].dead) F.splice(i, 1);
    if (!cap) F.length = Math.min(F.length, alive);
    g.restore();
  }
  return { draw, live: () => alive, atlas, WX };   // atlas + WX: the road view's snow (dioramasnow.js) uses the same flakes and weather
})();
if (typeof module !== "undefined") module.exports = SNOWFX;
