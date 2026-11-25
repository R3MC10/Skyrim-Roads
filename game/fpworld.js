/* The land in the road view (fpworld.js). [OURS]
   fptravel.js paints the sky, the weather and you; this paints the world between: four landscape layers per region
   (far peaks, a mid range, hills, the near horizon) cached as one strip that wraps round 360°, then the ground in true
   perspective, from the horizon to your feet, with the road bending and climbing over hills, and everything on it drawn
   far to near so a crest hides what is behind it. Things by the road come from the scenery director (fpscene.js): they
   grow as they approach, speed up toward the edges and pass out of view. Distance haze, region light and fog banks.
     FPWORLD.paint(g, w, h, hz, I, t, ctx) → debug info. ctx: { travel, headS, curveS, pxDeg, L, nightK, snowy, route,
       trip, region, sv, lights, dest(g, hzE), horizon, sky }
   Performance: the landscape strip is drawn once per region / light / size; per frame ~50 slices, ≤ 50 props, flat
   ground patches and a handful of gradients. No blur, no per-pixel work. */
const FPWORLD = (() => {
  const TAU = Math.PI * 2, ZN = 0.7, ZF = 46, NS = 46;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const relDeg = (d) => { d %= 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
  const hexOf = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mc = new Map();
  function mix(a, b, k) {
    k = clamp(Math.round((k || 0) * 40) / 40, 0, 1);
    const key = a + b + k; let v = mc.get(key); if (v) return v;
    const pa = hexOf(a), pb = hexOf(b); v = "#" + pa.map((x, i) => Math.round(x + (pb[i] - x) * k).toString(16).padStart(2, "0")).join("");
    if (mc.size > 6000) mc.clear(); mc.set(key, v); return v;
  }
  const rgba = (c, a) => { const [r, g, b] = hexOf(c); return `rgba(${r},${g},${b},${clamp(a, 0, 1).toFixed(3)})`; };
  const SC = () => (typeof FPSCENE !== "undefined" ? FPSCENE : null);
  const DR = () => (typeof TRAVELART !== "undefined" ? TRAVELART.draw : null);
  const seeded = (s) => SC().seeded(s);
  const Z = []; for (let i = 0; i <= NS; i++) Z.push(ZN * Math.pow(ZF / ZN, i / NS));
  const NIGHT = "#0c1424";

  // ---------------------------------------------------------------- the camera: bends, hills, pitch
  function camera(w, h, hz, travel, curveS, R, shp) {
    const H = h - hz, half0 = w * 0.3, hl = R.hills, B = shp.b, E = shp.e;
    const wan = (d) => 16 * Math.sin(d / 60 + B[0]) + 6 * Math.sin(d / 25 + B[1]) + 2 * Math.sin(d / 11 + B[2]);
    const wanD = (d) => 16 / 60 * Math.cos(d / 60 + B[0]) + 6 / 25 * Math.cos(d / 25 + B[1]) + 2 / 11 * Math.cos(d / 11 + B[2]);
    const ele = (d) => hl * (2.4 * Math.sin(d / 70 + E[0]) + Math.sin(d / 29 + E[1]));
    const eleD = (d) => hl * (2.4 / 70 * Math.cos(d / 70 + E[0]) + 1 / 29 * Math.cos(d / 29 + E[1]));
    const w0 = wan(travel), yaw = wanD(travel) * 0.9, e0 = ele(travel), pitch = eleD(travel) * 0.7;
    const hzE = hz + H * pitch;
    const lat = (z) => wan(travel + z) - w0 - z * yaw + curveS * 0.016 * z * z;
    const cx = (z) => w / 2 + half0 * lat(z) / z;
    const gy = (z) => hzE + H * (1 - (ele(travel + z) - e0)) / z;
    return { w, h, hz, hzE, H, half0, travel, lat, cx, gy, X: (z, u) => cx(z) + u * half0 / z, s: (z) => H / z, pitch };
  }

  // ---------------------------------------------------------------- the landscape strip (cached)
  let strip = null;
  /* draws the four layers for 360° into one canvas: x = bearing · pxDeg, horizon at y = hzPx */
  function makeStrip(R, P) {
    const { SW, hzPx, below, k } = P, LH = hzPx + below;
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(SW * k)); c.height = Math.max(1, Math.round(LH * k));
    const g = c.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0);
    const r = seeded("pano|" + R.name), tone = (col, hk) => mix(mix(col, P.horizon, clamp(hk + P.hazeAdd, 0, 0.9)), NIGHT, P.nightK);
    const wrap = (f) => { f(0); f(-SW); f(SW); };
    const deg = (x) => (x / SW) * 360;
    const land = (x) => { if (P.seaBear == null) return 1; const d = Math.abs(relDeg(deg(x) - P.seaBear)); return clamp((d - 52) / 26, 0, 1); };
    const per = (x, f, ph) => Math.sin((x / SW) * TAU * f + ph);
    const snowStart = P.snowy ? 0.32 : R.snow;
    const snowCol = P.tod === "night" ? "#9aa6ba" : P.tod === "dusk" ? "#f0cdb8" : P.tod === "dawn" ? "#f4d8d2" : "#f4f6f8";
    // ---- far peaks, lit on the side that faces the sun
    const N = R.steep ? 22 : 18, farC = tone(R.far, R.haze + 0.3), farShade = tone(mix(R.far, "#2a3040", 0.3), R.haze + 0.28);
    const peaks = [];
    for (let i = 0; i < N; i++) {
      const x = ((i + r() * 0.7) / N) * SW, lf = land(x), hh = hzPx * (R.peaks[0] + r() * (R.peaks[1] - R.peaks[0])) * (0.4 + 0.6 * r()) * (0.25 + 0.75 * lf);
      peaks.push({ x, hh, hw: hh * (R.steep ? 1 + r() * 0.5 : 1.6 + r() * 0.9), seed: r() });
    }
    peaks.sort((a, b) => b.hh - a.hh);   // tall ones behind, smaller in front
    for (const pk of peaks) {
      const rr = seeded("pk" + pk.seed), L = [], Rt = [], st = R.steep ? 7 : 5;
      for (let s = 0; s <= st; s++) { const q = s / st; L.push([pk.x - pk.hw * (1 - q) + (rr() - 0.5) * pk.hw * 0.08 * (1 - q), hzPx - pk.hh * q + (s && s < st ? (rr() - 0.5) * pk.hh * (R.steep ? 0.2 : 0.1) : 0)]); }
      for (let s = st - 1; s >= 0; s--) { const q = s / st; Rt.push([pk.x + pk.hw * (1 - q) * (0.75 + rr() * 0.5), hzPx - pk.hh * q + (s ? (rr() - 0.5) * pk.hh * (R.steep ? 0.2 : 0.1) : 0)]); }
      const peak = [pk.x, hzPx - pk.hh], sunRight = relDeg(P.sunAz - deg(pk.x)) > 0;
      const ridge = [peak, [pk.x + pk.hw * 0.1, hzPx - pk.hh * 0.6], [pk.x - pk.hw * 0.06, hzPx - pk.hh * 0.3], [pk.x + pk.hw * 0.08, hzPx + 2]];
      wrap((dx) => {
        const sh = (pts) => pts.map(([a, b]) => [a + dx, b]);
        poly(g, sh([...L, ...Rt, [pk.x + pk.hw * 1.6, hzPx + 4], [pk.x - pk.hw * 1.6, hzPx + 4]]), farC);
        poly(g, sh(sunRight ? [peak, ...ridge.slice(1), ...L.slice().reverse()] : [peak, ...Rt, ...ridge.slice(1).reverse()]), farShade);
        if (snowStart > 0 && pk.hh > hzPx * 0.12) {
          const line = hzPx - pk.hh * snowStart, cl = L.filter(([, y]) => y < line), cr = Rt.filter(([, y]) => y < line);
          if (cl.length + cr.length) {
            const jag = [], nj = 7, xl = pk.x - pk.hw * (1 - snowStart) * 0.95, xr = pk.x + pk.hw * (1 - snowStart) * 0.95;
            for (let j = nj; j >= 0; j--) jag.push([xl + (xr - xl) * j / nj, line + (j % 2 ? pk.hh * 0.1 * rr() : -pk.hh * 0.05 * rr())]);
            poly(g, sh([...cl, ...cr, ...jag]), tone(snowCol, R.haze + 0.18));
            poly(g, sh(sunRight ? [peak, ...jag.slice(4), ...cl.slice().reverse()].filter(Boolean) : [peak, ...cr, ...jag.slice(0, 4)]), tone(mix(snowCol, "#7f8fae", 0.35), R.haze + 0.18));
          }
        }
      });
    }
    if (R.volcano) {   // Red Mountain in the east
      const x = (95 / 360) * SW, s = hzPx * 0.78;
      wrap((dx) => { poly(g, [[x + dx - s * 1.5, hzPx + 2], [x + dx - s * 0.16, hzPx - s], [x + dx + s * 0.14, hzPx - s * 0.98], [x + dx + s * 1.6, hzPx + 2]], tone("#5a4844", R.haze + 0.15));
        poly(g, [[x + dx + s * 0.14, hzPx - s * 0.98], [x + dx + s * 1.6, hzPx + 2], [x + dx + s * 0.1, hzPx + 2], [x + dx - s * 0.02, hzPx - s * 0.6]], tone("#3e3230", R.haze + 0.15));
        g.strokeStyle = rgba("#c8501e", 0.55); g.lineWidth = Math.max(1, s * 0.012); g.beginPath(); g.moveTo(x + dx - s * 0.05, hzPx - s * 0.97); g.quadraticCurveTo(x + dx - s * 0.2, hzPx - s * 0.6, x + dx - s * 0.45, hzPx - s * 0.2); g.stroke(); });
    }
    // ---- the sea, in its sector
    if (P.seaBear != null) {
      const sg = g.createLinearGradient(0, hzPx - 1, 0, LH); sg.addColorStop(0, tone(mix(P.horizon, "#6f93ad", 0.5), 0.1)); sg.addColorStop(1, tone("#3c6178", 0.05));
      g.fillStyle = sg; g.beginPath(); let on = false;
      for (let x = 0; x <= SW; x += 2) { const lf = land(x); if (lf < 0.5 && !on) { g.moveTo(x, LH); g.lineTo(x, hzPx - 0.6); on = true; } else if (lf < 0.5) g.lineTo(x, hzPx - 0.6); else if (on) { g.lineTo(x, hzPx - 0.6); g.lineTo(x, LH); g.closePath(); on = false; } }
      if (on) { g.lineTo(SW, LH); g.closePath(); } g.fill();
      g.strokeStyle = rgba("#ffffff", 0.22); g.lineWidth = 0.7; g.beginPath();
      for (let i = 0; i < 70; i++) { const x = r() * SW, y = hzPx + Math.pow(r(), 2) * below; if (land(x) < 0.4) { const l = 2 + (y - hzPx) * 0.5; g.moveTo(x - l, y); g.lineTo(x + l, y); } } g.stroke();
      for (let i = 0; i < 4; i++) { const x = r() * SW; if (land(x) < 0.3) poly(g, [[x - 6 - r() * 10, hzPx], [x, hzPx - 2 - r() * 4], [x + 6 + r() * 12, hzPx]], tone(R.far, R.haze + 0.25)); }   // islands
    }
    // ---- a mid range: ridges with trees on them
    const ridgeLayer = (base, amp, col, hk, fr, trees, tsz, jag) => {
      const pts = [], ys = [];
      for (let x = 0; x <= SW; x += 3) { const lf = land(x); let y = 0.55 * per(x, fr[0], fr[3]) + 0.3 * per(x, fr[1], fr[3] * 2.3) + 0.15 * per(x, fr[2], fr[3] * 0.7); if (jag) y += jag * Math.abs(per(x, fr[2] * 3, fr[3])); const yy = base - amp * (0.6 + 0.5 * y) * lf; ys.push(yy); pts.push([x, yy]); }
      // the sea cuts in: land stops at the cliff edge
      g.beginPath(); g.moveTo(0, LH); for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i]; if (land(x) < 0.5) { g.lineTo(x, LH); } else g.lineTo(x, y); } g.lineTo(SW, LH); g.closePath(); g.fillStyle = tone(col, hk); g.fill();
      if (trees > 0) {
        const tc = tone(mix(col, "#0e1810", 0.4), hk), tr = seeded("tr" + base + R.name);
        g.fillStyle = tc; g.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const [x, y] = pts[i]; if (land(x) < 0.55) continue;
          const cl = 0.5 + 0.5 * per(x, 7, base);
          if (tr() > trees * (0.3 + 0.7 * cl)) continue;
          const th = tsz * (0.6 + tr() * 0.8), yy = y + 1 + tr() * 2;
          if (R.trees === "broad" || R.trees === "birch") { g.moveTo(x + th * 0.4, yy - th * 0.5); g.ellipse(x, yy - th * 0.5, th * 0.4, th * 0.5, 0, 0, TAU); }
          else if (R.trees === "dead") { g.rect(x, yy - th, Math.max(0.6, th * 0.08), th); }
          else { g.moveTo(x - th * 0.28, yy); g.lineTo(x, yy - th); g.lineTo(x + th * 0.28, yy); g.closePath(); }
        }
        g.fill();
        if (R.trees === "birch") { g.fillStyle = tone("#d0902e", hk); for (let i = 0; i < pts.length; i += 2) { const [x, y] = pts[i]; if (tr() < trees * 0.35) { g.beginPath(); g.ellipse(x, y - tsz * 0.4, tsz * 0.3, tsz * 0.4, 0, 0, TAU); g.fill(); } } }
        if ((P.snowy || R.snowy) && R.trees !== "broad") { g.fillStyle = tone("#e8eef2", hk); for (let i = 0; i < pts.length; i += 2) { const [x, y] = pts[i]; if (tr() < trees * 0.4) g.fillRect(x - 0.8, y - tsz * 0.9, 1.6, tsz * 0.25); } }
      }
      return ys;
    };
    ridgeLayer(hzPx - hzPx * 0.02, hzPx * (R.steep ? 0.3 : 0.16), R.mid, R.haze + 0.12, [3, 7, 13, 1.7], R.hillTrees * 0.8, hzPx * 0.05, R.steep ? 0.25 : 0);
    const hy = ridgeLayer(hzPx + 1, hzPx * (R.steep ? 0.12 : 0.08) * Math.max(0.4, R.hills), P.snowy && !R.snowy ? mix(R.hill, "#dfe7ec", 0.6) : R.hill, R.haze * 0.6, [4, 9, 17, 4.2], R.hillTrees, hzPx * 0.08, 0);
    // features on the hills
    const fr = seeded("feat" + R.name);
    if (R.fields) {   // farm fields and a few farmsteads
      for (let i = 0; i < 26; i++) { const x = fr() * SW, j = Math.floor(x / 3), y = (hy[j] ?? hzPx) + 2 + fr() * 4, ww = 10 + fr() * 22; if (land(x) < 0.6) continue;
        g.fillStyle = tone(["#c8b45a", "#8aa04a", "#a8b860", "#b89a4a"][i % 4], R.haze * 0.5); g.globalAlpha = 0.7; g.fillRect(x, y, ww, 1.4 + fr() * 1.6); g.globalAlpha = 1; }
      for (let i = 0; i < 6; i++) { const x = fr() * SW, j = Math.floor(x / 3), y = (hy[j] ?? hzPx) + 3; if (land(x) < 0.6) continue; const s = 3 + fr() * 2;
        wrap((dx) => { g.fillStyle = tone("#9a8462", R.haze * 0.5); g.fillRect(x + dx - s, y - s, s * 2, s); poly(g, [[x + dx - s * 1.3, y - s], [x + dx, y - s * 1.9], [x + dx + s * 1.3, y - s]], tone("#6a4a30", R.haze * 0.5)); }); }
    }
    if (R.name === "tundra" || R.name === "rocky") { g.fillStyle = tone("#8a847a", R.haze * 0.5); for (let i = 0; i < 40; i++) { const x = fr() * SW, j = Math.floor(x / 3), y = (hy[j] ?? hzPx) + 2 + fr() * 5; g.beginPath(); g.ellipse(x, y, 1 + fr() * 2, 0.8 + fr(), 0, Math.PI, TAU); g.fill(); } }
    if (R.name === "marsh") { g.strokeStyle = rgba("#dce6ea", 0.4); g.lineWidth = 0.8; g.beginPath(); for (let i = 0; i < 30; i++) { const x = fr() * SW, y = hzPx + 3 + fr() * below * 0.8, l = 6 + fr() * 16; g.moveTo(x, y); g.lineTo(x + l, y); } g.stroke(); }
    // ---- the near horizon: a lip of land, with a tree wall in the woods
    const lipC = P.snowy && !R.snowy ? mix(R.lip, "#e4eaee", 0.7) : R.lip, lr = seeded("lip" + R.name);
    g.beginPath(); g.moveTo(0, LH); for (let x = 0; x <= SW; x += 4) g.lineTo(x, land(x) < 0.5 ? LH : hzPx + 2 - hzPx * 0.025 * (0.5 + 0.5 * per(x, 23, 1.1))); g.lineTo(SW, LH); g.closePath(); g.fillStyle = tone(lipC, R.haze * 0.3); g.fill();
    if (R.wall || R.trees === "birch") {
      const tc = tone(R.trees === "birch" ? "#8a5a26" : "#1f3022", R.haze * 0.35), tc2 = tone(R.trees === "birch" ? "#c88a30" : "#2c4230", R.haze * 0.35);
      for (let x = 0; x < SW; x += 2.2) {
        if (land(x) < 0.6) continue;
        const gap = 0.5 + 0.5 * per(x, 5, 0.4); if (lr() > 0.35 + gap * 0.6) continue;
        const th = hzPx * (0.08 + lr() * 0.16) * (0.6 + gap * 0.5), y = hzPx + 3;
        wrap((dx) => { if (R.trees === "birch") { g.fillStyle = lr() < 0.5 ? tc : tc2; g.beginPath(); g.ellipse(x + dx, y - th * 0.55, th * 0.3, th * 0.5, 0, 0, TAU); g.fill(); }
          else poly(g, [[x + dx - th * 0.22, y], [x + dx, y - th], [x + dx + th * 0.22, y]], lr() < 0.5 ? tc : tc2); });
      }
    } else if (R.name === "marsh") {
      g.strokeStyle = tone("#3a4230", R.haze * 0.3); g.lineWidth = 0.8; g.beginPath();
      for (let i = 0; i < 40; i++) { const x = lr() * SW, y = hzPx + 3, th = hzPx * (0.05 + lr() * 0.1); g.moveTo(x, y); g.lineTo(x + (lr() - 0.5) * 2, y - th); g.moveTo(x, y - th * 0.6); g.lineTo(x + th * 0.25, y - th * 0.85); }
      g.stroke();
    } else if (R.trees === "broad") {
      for (let i = 0; i < 50; i++) { const x = lr() * SW, y = hzPx + 3, th = hzPx * (0.04 + lr() * 0.07); if (land(x) < 0.6) continue; g.fillStyle = tone(lr() < 0.5 ? "#4a6a32" : "#3c5a2a", R.haze * 0.35); wrap((dx) => { g.beginPath(); g.ellipse(x + dx, y - th * 0.55, th * 0.6, th * 0.5, 0, 0, TAU); g.fill(); }); }
    }
    return { c, SW, LH, hzPx, k };
  }
  function poly(g, pts, fill) { if (!pts.length) return; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fillStyle = fill; g.fill(); }

  function drawStrip(g, cam, R, ctx) {
    const { pxDeg, headS, L, nightK, snowy, sv } = ctx, w = cam.w;
    const hzPx = Math.round(cam.hz), below = Math.round(cam.H * 0.2), SW = 360 * pxDeg;
    const dpr = ctx.dpr || 1, k = Math.min(dpr, 4096 / SW, 2);
    const hour = ctx.sky?.hour ?? 13, sunAz = L.tod === "night" ? 90 + ((hour + 6) % 24) * 15 : 90 + (hour - 6) * 15;
    const seaBear = R.sea && sv && sv.seaBear != null ? Math.round(sv.seaBear / 10) * 10 : R.sea ? 270 : null;
    const key = [R.name, Math.round(SW), hzPx, below, k.toFixed(2), L.tod, L.wx, snowy, seaBear, Math.round(sunAz / 30), ctx.horizon].join("|");
    if (!strip || strip.key !== key) {
      try { strip = { key, ...makeStrip(R, { SW, hzPx, below, k, horizon: ctx.horizon, hazeAdd: L.hazeAdd, nightK, snowy, tod: L.tod, seaBear, sunAz }) }; } catch { strip = null; return; }
    }
    const S = strip, y0 = cam.hzE - S.hzPx;
    let x0 = w / 2 - headS * pxDeg; x0 = ((x0 % SW) + SW) % SW - SW;
    for (let x = x0; x < w; x += SW) g.drawImage(S.c, x, y0, SW, S.LH);
    // below the strip the ground carries on
    return seaBear;
  }

  // ---------------------------------------------------------------- props: one drawer per kind (x, y = ground point, s = px per unit)
  const P = {};
  P.pine = (g, x, y, s, it, c) => { const D = DR(), h = s * it.h; D.pine(g, x, y, h, c.tone(c.snowy ? "#3f5a4a" : c.R.name === "pine" ? "#2c472b" : "#38552f", it.z), c.tone(c.snowy ? "#2c4236" : "#1f3320", it.z), c.snowy || it.snow, h > 30); };
  P.broad = (g, x, y, s, it, c) => { const D = DR(), cols = D.treeCols("broad", c.season, c.snowy); D.broad(g, x, y, s * it.h, cols ? cols.map((q) => c.tone(q, it.z)) : null, s * it.h > 30, !cols); };
  P.birch = (g, x, y, s, it, c) => { const D = DR(); D.birch(g, x, y, s * it.h, D.treeCols("birch", c.season, c.snowy).map((q) => c.tone(q, it.z)), s * it.h > 30); };
  P.dead = (g, x, y, s, it, c) => DR().dead(g, x, y, s * it.h, seeded("dt" + it.seed), c.tone(c.R.ash ? "#2e2622" : "#4a3e30", it.z));
  P.boulder = (g, x, y, s, it, c) => DR().boulder(g, x, y, s * it.h, c.tone(c.R.ash ? "#3a3230" : c.R.name === "rocky" ? "#8c7c66" : "#8a847a", it.z), s * it.h > 8, c.snowy, c.R.name === "pine" || c.R.name === "autumn");
  P.bush = (g, x, y, s, it, c) => DR().bush(g, x, y, s * it.h, c.snowy ? ["#dfe6ea", "#bcc8d0"] : c.season === "autumn" ? [c.tone("#9a5a2a", it.z), c.tone("#c47a34", it.z)] : [c.tone(mix(c.R.grass[2], "#3a5a2a", 0.4), it.z), c.tone(c.R.grass[1], it.z)]);
  P.grass = (g, x, y, s, it, c) => { const l = s * it.h, sw = c.wind * Math.sin(c.t * 2.2 + it.seed) * l * 0.25; g.strokeStyle = c.tone(c.R.grass[it.seed % 2], it.z); g.lineWidth = Math.max(0.7, l * 0.08); g.beginPath();
    for (let k = -3; k <= 3; k++) { g.moveTo(x + k * l * 0.12, y); g.quadraticCurveTo(x + k * l * 0.16, y - l * 0.5, x + k * l * 0.3 + sw, y - l * (0.75 + 0.25 * ((k * 7 + it.seed) % 3) / 2)); } g.stroke(); };
  P.fern = (g, x, y, s, it, c) => { const l = s * it.h; g.strokeStyle = c.tone("#4f7a34", it.z); g.lineWidth = Math.max(0.6, l * 0.06); g.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.45; g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.6, y + Math.sin(a) * l * 0.7, x + Math.cos(a) * l * 1.1, y + Math.sin(a) * l * 0.5); } g.stroke(); };
  P.stump = (g, x, y, s, it, c) => { const r = s * it.h; g.fillStyle = c.tone("#5a4230", it.z); g.fillRect(x - r, y - r * 1.2, r * 2, r * 1.2); g.fillStyle = c.tone("#a88a62", it.z); g.beginPath(); g.ellipse(x, y - r * 1.2, r, r * 0.35, 0, 0, TAU); g.fill(); };
  P.log = (g, x, y, s, it, c) => { const l = s * it.h, r = l * 0.1; g.fillStyle = c.tone("#5e4632", it.z); g.beginPath(); g.moveTo(x - l, y - r * 0.2); g.lineTo(x + l, y - r * 0.8); g.lineTo(x + l, y - r * 2.6); g.lineTo(x - l, y - r * 2); g.closePath(); g.fill();
    g.fillStyle = c.tone("#a88a62", it.z); g.beginPath(); g.ellipse(x + l, y - r * 1.7, r * 0.5, r * 0.9, 0, 0, TAU); g.fill(); if (c.snowy) { g.fillStyle = "#eef3f6"; g.fillRect(x - l, y - r * 2.5, l * 2, r * 0.5); } };
  P.snowbank = (g, x, y, s, it, c) => { const r = s * it.h; g.fillStyle = c.tone("#f2f6f9", it.z); g.beginPath(); g.ellipse(x, y, r * 1.6, r * 0.55, 0, Math.PI, TAU); g.fill(); g.fillStyle = c.tone("#c4d0dc", it.z); g.beginPath(); g.ellipse(x + r * 0.5, y, r * 0.9, r * 0.25, 0, Math.PI, TAU); g.fill(); };
  P.rockface = (g, x, y, s, it, c) => { const hh = s * it.h, ww = hh * 0.7, rr = seeded("rf" + it.seed), col = c.tone(c.R.name === "rocky" ? "#7c6e5c" : "#6f7680", it.z), dk = c.tone(c.R.name === "rocky" ? "#564a3e" : "#4a505a", it.z);
    const pts = [[x - ww, y], [x - ww * (0.8 + rr() * 0.2), y - hh * 0.6], [x - ww * 0.4, y - hh * (0.9 + rr() * 0.1)], [x + ww * 0.1, y - hh], [x + ww * 0.6, y - hh * (0.75 + rr() * 0.15)], [x + ww, y - hh * 0.3], [x + ww * 1.05, y]];
    poly(g, pts, col); poly(g, [[x + ww * 0.1, y - hh], [x + ww * 0.6, y - hh * 0.8], [x + ww, y - hh * 0.3], [x + ww * 1.05, y], [x + ww * 0.2, y]], dk);
    g.strokeStyle = rgba("#1a1a20", 0.3); g.lineWidth = Math.max(0.6, hh * 0.015); g.beginPath(); for (let i = 0; i < 4; i++) { const yy = y - hh * (0.2 + i * 0.18); g.moveTo(x - ww * 0.7, yy); g.lineTo(x + ww * (0.2 + rr() * 0.5), yy - hh * 0.05); } g.stroke();
    if (c.snowy || c.R.snowy) poly(g, [[x - ww * 0.45, y - hh * 0.88], [x + ww * 0.1, y - hh], [x + ww * 0.6, y - hh * 0.78], [x + ww * 0.3, y - hh * 0.72], [x - ww * 0.2, y - hh * 0.78]], c.tone("#eef3f6", it.z)); };
  P.jagged = (g, x, y, s, it, c) => { const hh = s * it.h, rr = seeded("jg" + it.seed), n = 3 + Math.floor(rr() * 3); for (let i = 0; i < n; i++) { const dx = (i - n / 2) * hh * 0.28, th = hh * (0.4 + rr() * 0.6);
    poly(g, [[x + dx - th * 0.25, y], [x + dx - th * 0.05, y - th], [x + dx + th * 0.08, y - th * 0.85], [x + dx + th * 0.25, y]], c.tone(i % 2 ? "#2e2826" : "#3c3430", it.z)); }
    if (c.night) { g.fillStyle = rgba("#ff7a30", 0.35); g.fillRect(x - hh * 0.5, y - 1, hh, 1.2); } };
  P.ashmound = (g, x, y, s, it, c) => { const r = s * it.h; g.fillStyle = c.tone("#6a625c", it.z); g.beginPath(); g.ellipse(x, y, r * 1.5, r * 0.6, 0, Math.PI, TAU); g.fill(); g.fillStyle = c.tone("#4a4440", it.z); g.beginPath(); g.ellipse(x + r * 0.5, y, r * 0.8, r * 0.3, 0, Math.PI, TAU); g.fill(); };
  P.vent = (g, x, y, s, it, c) => { P.jagged(g, x, y, s, { ...it, h: it.h * 0.6 }, c); const r = s * it.h; for (let i = 0; i < 3; i++) { const k = ((c.t * 0.3 + i / 3) % 1); g.fillStyle = `rgba(200,196,190,${(0.3 * (1 - k)).toFixed(3)})`; g.beginPath(); g.ellipse(x + k * r * 0.6, y - r * (0.6 + k * 2), r * (0.3 + k * 0.6), r * (0.2 + k * 0.4), 0, 0, TAU); g.fill(); } };
  P.reeds = (g, x, y, s, it, c) => { const l = s * it.h, sw = c.wind * Math.sin(c.t * 1.8 + it.seed) * l * 0.12; g.lineWidth = Math.max(0.6, l * 0.05); g.strokeStyle = c.tone("#6f7d48", it.z); g.beginPath();
    for (let k = -3; k <= 3; k++) { g.moveTo(x + k * l * 0.08, y); g.quadraticCurveTo(x + k * l * 0.1, y - l * 0.6, x + k * l * 0.16 + sw, y - l * (0.8 + 0.2 * ((k + it.seed) % 2))); } g.stroke();
    g.fillStyle = c.tone("#5a3e26", it.z); for (const k of [-1, 2]) g.fillRect(x + k * l * 0.12 + sw - l * 0.03, y - l * 0.95, l * 0.06, l * 0.2); };
  P.pool = (g, x, y, s, it, c) => { const rx = it.r * c.cam.half0 / it.z, ry = Math.max(0.6, rx * c.cam.H / (c.cam.half0 * it.z) * 0.9); g.fillStyle = c.tone(c.water, it.z); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = rgba("#e8f0f2", 0.3); g.lineWidth = Math.max(0.5, ry * 0.15); g.beginPath(); g.moveTo(x - rx * 0.5, y - ry * 0.2); g.lineTo(x + rx * 0.2, y - ry * 0.2); g.stroke(); };
  P.driftwood = (g, x, y, s, it, c) => { const l = s * it.h; g.strokeStyle = c.tone("#b8ab92", it.z); g.lineWidth = Math.max(0.8, l * 0.12); g.lineCap = "round"; g.beginPath(); g.moveTo(x - l, y); g.lineTo(x + l, y - l * 0.15); g.moveTo(x + l * 0.3, y - l * 0.08); g.lineTo(x + l * 0.6, y - l * 0.4); g.stroke(); g.lineCap = "butt"; };
  P.flowers = (g, x, y, s, it, c) => { const rr = seeded("fl" + it.seed), r = s * it.h; const cols = c.season === "autumn" ? ["#d8a040", "#c87838"] : c.snowy ? null : ["#f2e6a0", "#e8a8c0", "#ffffff", "#c8b0f0"]; if (!cols) return;
    for (let i = 0; i < 9; i++) { g.fillStyle = c.tone(cols[i % cols.length], it.z); const q = Math.max(0.8, r * 0.12); g.fillRect(x + (rr() - 0.5) * r * 3, y - rr() * r * 0.5, q, q); } };
  P.willow = (g, x, y, s, it, c) => { const h = s * it.h, sw = c.wind * Math.sin(c.t * 1.3 + it.seed) * h * 0.04; g.fillStyle = c.tone("#4a3a2a", it.z); g.fillRect(x - h * 0.04, y - h * 0.55, h * 0.08, h * 0.55);
    g.fillStyle = c.tone(c.season === "autumn" ? "#b89a40" : "#6a8a3a", it.z); g.beginPath(); g.ellipse(x, y - h * 0.7, h * 0.42, h * 0.3, 0, 0, TAU); g.fill();
    g.strokeStyle = c.tone(c.season === "autumn" ? "#a88a38" : "#5a7a32", it.z); g.lineWidth = Math.max(0.7, h * 0.03); g.beginPath(); for (let k = -4; k <= 4; k++) { const xx = x + k * h * 0.09; g.moveTo(xx, y - h * 0.62); g.quadraticCurveTo(xx + k * h * 0.02, y - h * 0.35, xx + sw + k * h * 0.03, y - h * 0.15); } g.stroke(); };
  P.post = (g, x, y, s, it, c) => { const hh = s * 0.32; g.fillStyle = c.tone("#5a4430", it.z); g.fillRect(x - hh * 0.06, y - hh, Math.max(0.8, hh * 0.12), hh); };
  P.haystack = (g, x, y, s, it, c) => { const r = s * it.h; g.fillStyle = c.tone("#c8a85a", it.z); g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x - r, y - r * 1.6, x, y - r * 1.7); g.quadraticCurveTo(x + r, y - r * 1.6, x + r, y); g.closePath(); g.fill(); g.fillStyle = c.tone("#9a7a3a", it.z); g.fillRect(x - r, y - r * 0.6, r * 2, r * 0.12); };
  P.tuft = (g, x, y, s, it, c) => P.grass(g, x, y, s, it, c);
  P.patch = (g, x, y, s, it, c) => { const rx = it.r * c.cam.half0 / it.z, ry = Math.max(0.4, Math.min(rx * 0.22, rx * c.cam.H / (c.cam.half0 * it.z) * 0.8)); g.globalAlpha *= 0.55; g.fillStyle = it.col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); };
  /* landmarks by the road (the side-view landmark art, scaled to the distance) */
  P.landmark = (g, x, y, s, it, c) => { const D = DR(), k = s * 0.034 * (it.k || 1); g.save(); g.translate(x, y); g.scale(k, k); try { D.landmark(g, it.lm, 0, 0, seeded("lm" + it.seed), true, c.lightsLocal, c.t, c.snowy); } catch { /* skip */ } g.restore();
    for (const L of c.lightsLocal) c.lights.push([x + L[0] * k, y + L[1] * k, L[2] * k, L[3], L[4]]); c.lightsLocal.length = 0; };
  P.fallen = (g, x, y, s, it, c) => { P.log(g, x, y, s, { ...it, h: 0.9 }, c); const r = s * 0.22; g.strokeStyle = c.tone("#4a3628", it.z); g.lineWidth = Math.max(0.7, r * 0.12); g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.moveTo(x - s * 0.9, y - r); g.lineTo(x - s * 0.9 + Math.cos(a) * r, y - r + Math.sin(a) * r); } g.stroke(); };
  // ---- moments
  P.tower = (g, x, y, s, it, c) => { const hh = s * 2.6, ww = hh * 0.2, rr = seeded("tw" + it.seed), st = c.tone("#8c8678", it.z), dk = c.tone("#5e5a52", it.z);
    g.fillStyle = st; g.beginPath(); g.moveTo(x - ww, y); g.lineTo(x - ww * 0.9, y - hh * 0.92); for (let i = 0; i <= 6; i++) g.lineTo(x - ww * 0.9 + i * ww * 0.3, y - hh * (0.86 + (i % 2 ? 0.08 : 0) - (i > 3 ? 0.22 + rr() * 0.1 : 0))); g.lineTo(x + ww, y); g.closePath(); g.fill();
    g.fillStyle = dk; g.fillRect(x + ww * 0.3, y - hh * 0.9, ww * 0.6, hh * 0.9); g.fillStyle = c.tone("#2a2622", it.z); for (const fy of [0.3, 0.55, 0.75]) g.fillRect(x - ww * 0.25, y - hh * fy, ww * 0.3, hh * 0.07);
    g.strokeStyle = rgba("#2a2420", 0.35); g.lineWidth = Math.max(0.5, hh * 0.006); g.beginPath(); for (let i = 1; i < 9; i++) { g.moveTo(x - ww * 0.95, y - hh * i / 10); g.lineTo(x + ww, y - hh * i / 10); } g.stroke();
    for (let i = 0; i < 4; i++) DR().boulder(g, x + (rr() - 0.3) * ww * 4, y, ww * (0.2 + rr() * 0.3), st, false, c.snowy, true); };
  P.waterfall = (g, x, y, s, it, c) => { P.rockface(g, x, y, s, { ...it, h: 2.4 }, c); const hh = s * 2.3, wx = x - hh * 0.12, fw = hh * 0.08;
    g.fillStyle = rgba("#e6f0f4", 0.85); g.fillRect(wx - fw / 2, y - hh, fw, hh); g.strokeStyle = rgba("#a8c4d4", 0.8); g.lineWidth = Math.max(0.6, fw * 0.15); g.beginPath();
    for (let i = 0; i < 6; i++) { const k = ((c.t * 0.9 + i / 6) % 1); g.moveTo(wx - fw * 0.3 + (i % 3) * fw * 0.25, y - hh * (1 - k)); g.lineTo(wx - fw * 0.3 + (i % 3) * fw * 0.25, y - hh * (1 - k) + hh * 0.12); } g.stroke();
    g.fillStyle = rgba("#eef4f6", 0.45); for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(wx + Math.sin(c.t + i) * fw, y - fw * 0.6, fw * (1.2 + i * 0.5), fw * 0.5, 0, 0, TAU); g.fill(); } };
  P.oldcamp = (g, x, y, s, it, c) => { const r = s * 0.5; poly(g, [[x - r * 1.2, y], [x - r * 0.3, y - r * 1.1], [x + r * 0.4, y - r * 0.2], [x + r * 0.6, y]], c.tone("#8a7a5a", it.z)); poly(g, [[x - r * 0.3, y - r * 1.1], [x + r * 0.4, y - r * 0.2], [x + r * 0.6, y], [x + r * 0.05, y]], c.tone("#5a4c38", it.z));
    g.strokeStyle = c.tone("#3a3028", it.z); g.lineWidth = Math.max(0.6, r * 0.05); g.beginPath(); g.moveTo(x - r * 0.3, y - r * 1.1); g.lineTo(x - r * 0.4, y - r * 1.4); g.stroke();
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; g.fillStyle = c.tone("#6a645c", it.z); g.beginPath(); g.ellipse(x + r * 1.3 + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.08, r * 0.08, r * 0.05, 0, 0, TAU); g.fill(); }
    g.fillStyle = c.tone("#2a2420", it.z); g.fillRect(x + r * 1.1, y - r * 0.05, r * 0.4, r * 0.05); };
  P.bridge = (g, x, y, s, it, c) => { /* the parapets, drawn by the road at the crossing (the water band is part of the ground) */
    const cam = c.cam; for (const sd of [-1, 1]) { const z0 = Math.max(ZN, it.z - 1.1), z1 = it.z + 1.1; const xa = cam.X(z0, sd * 1.15), xb = cam.X(z1, sd * 1.15), ya = cam.gy(z0), yb = cam.gy(z1), ha = cam.s(z0) * 0.28, hb = cam.s(z1) * 0.28;
      g.fillStyle = c.tone("#8c8678", it.z); g.beginPath(); g.moveTo(xa, ya); g.lineTo(xb, yb); g.lineTo(xb, yb - hb); g.lineTo(xa, ya - ha); g.closePath(); g.fill();
      g.fillStyle = c.tone("#6a665c", it.z); g.beginPath(); g.moveTo(xa, ya - ha); g.lineTo(xb, yb - hb); g.lineTo(xb, yb - hb * 1.15); g.lineTo(xa, ya - ha * 1.15); g.closePath(); g.fill(); } };
  P.shipwreck = (g, x, y, s, it, c) => { const r = s * 0.9; g.fillStyle = c.tone("#4a3628", it.z); g.beginPath(); g.moveTo(x - r * 1.4, y - r * 0.1); g.quadraticCurveTo(x - r * 0.4, y + r * 0.1, x + r * 1.2, y - r * 0.5); g.lineTo(x + r * 1.0, y - r * 0.15); g.lineTo(x - r * 1.2, y + r * 0.08); g.closePath(); g.fill();
    g.strokeStyle = c.tone("#3a2a20", it.z); g.lineWidth = Math.max(0.7, r * 0.05); g.beginPath(); for (let i = 0; i < 6; i++) { const xx = x - r * 0.9 + i * r * 0.35; g.moveTo(xx, y - r * 0.05 - i * r * 0.05); g.quadraticCurveTo(xx - r * 0.1, y - r * 0.6, xx + r * 0.05, y - r * (0.8 + (i % 2) * 0.2)); } g.moveTo(x + r * 0.2, y - r * 0.3); g.lineTo(x + r * 0.5, y - r * 1.6); g.stroke(); };
  P.giants = (g, x, y, s, it, c) => { const r = s * 0.8; poly(g, [[x - r, y], [x - r * 0.1, y - r * 1.5], [x + r * 0.8, y]], c.tone("#9a8462", it.z)); poly(g, [[x - r * 0.1, y - r * 1.5], [x + r * 0.8, y], [x + r * 0.1, y]], c.tone("#6a5a42", it.z));
    g.strokeStyle = c.tone("#4a3a2a", it.z); g.lineWidth = Math.max(0.6, r * 0.04); g.beginPath(); g.moveTo(x - r * 0.2, y - r * 1.4); g.lineTo(x - r * 0.35, y - r * 1.8); g.moveTo(x, y - r * 1.4); g.lineTo(x + r * 0.1, y - r * 1.8); g.stroke();
    const f = Math.sin(c.t * 9) * 0.1; poly(g, [[x + r * 1.1, y], [x + r * 1.25, y - r * (0.35 + f)], [x + r * 1.4, y]], "#e8923a"); c.lights.push([x + r * 1.25, y - r * 0.2, r * 1.4, "255,150,70", 0.9]);
    person(g, x + r * 1.9, y, s * 1.9, c.tone("#8a7a66", it.z), c.tone("#6a5a46", it.z), null, Math.sin(c.t * 1.5) * 0.04, "giant"); };
  // ---- living things
  function quad(g, x, y, s, body, dir, ph, legs, o = {}) {   // a four-legged animal side-on: s = shoulder height px
    const L = s * (o.len || 1.3), bx = x, by = y - s * 0.62;
    g.strokeStyle = body; g.lineWidth = Math.max(0.6, s * 0.1); g.lineCap = "round"; g.beginPath();
    for (const [lx, p] of [[-0.42, 0], [-0.3, Math.PI], [0.35, Math.PI * 0.5], [0.45, Math.PI * 1.5]]) { const sw = legs ? Math.sin(ph + p) * s * 0.18 : 0; g.moveTo(bx + dir * L * lx, by); g.lineTo(bx + dir * L * lx + sw * dir, y); }
    g.stroke(); g.lineCap = "butt";
    g.fillStyle = body; g.beginPath(); g.ellipse(bx, by, L * 0.5, s * (o.fat || 0.22), 0, 0, TAU); g.fill();
    const hd = o.down ? 0.1 : 0.55, nx = bx + dir * L * 0.48, ny = by - s * 0.1;
    g.lineWidth = Math.max(0.6, s * 0.12); g.strokeStyle = body; g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + dir * s * 0.25, by - s * hd); g.stroke();
    g.beginPath(); g.ellipse(nx + dir * s * 0.32, by - s * hd, s * 0.17, s * 0.09, dir * 0.4, 0, TAU); g.fill();
    if (o.tail) { g.lineWidth = Math.max(0.6, s * 0.1); g.strokeStyle = o.tail; g.beginPath(); g.moveTo(bx - dir * L * 0.48, by - s * 0.05); g.quadraticCurveTo(bx - dir * L * 0.75, by - s * 0.05, bx - dir * L * 0.8, by + s * 0.15); g.stroke(); }
    if (o.antlers) { g.strokeStyle = o.antlers; g.lineWidth = Math.max(0.5, s * 0.04); g.beginPath(); const ax = nx + dir * s * 0.3, ay = by - s * hd - s * 0.05; g.moveTo(ax, ay); g.lineTo(ax - dir * s * 0.1, ay - s * 0.35); g.lineTo(ax - dir * s * 0.25, ay - s * 0.45); g.moveTo(ax - dir * s * 0.08, ay - s * 0.22); g.lineTo(ax + dir * s * 0.08, ay - s * 0.38); g.stroke(); }
  }
  function person(g, x, y, s, robe, dark, extra, sway, kind) {   // a figure seen from the front or back: s = height px
    const hw = s * 0.17; g.fillStyle = robe; g.beginPath(); g.moveTo(x - hw * 1.1, y); g.lineTo(x - hw * 0.75 + sway * s, y - s * 0.78); g.lineTo(x + hw * 0.75 + sway * s, y - s * 0.78); g.lineTo(x + hw * 1.1, y); g.closePath(); g.fill();
    g.fillStyle = dark; g.beginPath(); g.arc(x + sway * s, y - s * 0.86, s * 0.1, 0, TAU); g.fill();
    if (kind === "hood") { g.beginPath(); g.moveTo(x - s * 0.13 + sway * s, y - s * 0.78); g.lineTo(x + sway * s, y - s * 1.0); g.lineTo(x + s * 0.13 + sway * s, y - s * 0.78); g.closePath(); g.fill(); }
    if (kind === "guard") { g.fillStyle = "#8a8a8e"; g.beginPath(); g.arc(x + sway * s, y - s * 0.89, s * 0.1, Math.PI, TAU); g.fill(); g.fillStyle = extra || "#c8a040"; g.beginPath(); g.ellipse(x - hw * 0.9, y - s * 0.45, s * 0.14, s * 0.18, 0, 0, TAU); g.fill(); g.strokeStyle = "#3a3028"; g.lineWidth = Math.max(0.5, s * 0.025); g.beginPath(); g.moveTo(x + hw * 1.1, y); g.lineTo(x + hw * 1.1 + sway * s, y - s * 1.15); g.stroke(); }
    if (kind === "staff") { g.strokeStyle = "#5a4430"; g.lineWidth = Math.max(0.5, s * 0.03); g.beginPath(); g.moveTo(x + hw * 1.2, y); g.lineTo(x + hw * 1.2 + sway * s, y - s * 1.05); g.stroke(); }
    if (kind === "giant") { g.strokeStyle = dark; g.lineWidth = Math.max(0.8, s * 0.05); g.beginPath(); g.moveTo(x + hw * 1.2, y - s * 0.4); g.lineTo(x + hw * 1.6, y - s * 0.95); g.stroke(); }
  }
  P.deer = (g, x, y, s, it, c) => { const sh = s * 0.55, ph = it.flee ? c.t * 14 : 0; quad(g, x, y - (it.flee ? Math.abs(Math.sin(ph)) * sh * 0.3 : 0), sh, c.tone("#7a5a3a", it.z), it.dir, ph, !!it.flee, { down: !it.flee && Math.sin(c.t * 0.5 + it.seed) > 0, tail: c.tone("#e8dcc8", it.z), antlers: it.seed % 2 ? c.tone("#cbb894", it.z) : null }); };
  P.fox = (g, x, y, s, it, c) => { const sh = s * 0.22; quad(g, x, y, sh, c.tone(c.snowy ? "#e8e4dc" : "#c06a2a", it.z), it.dir, c.t * 16, true, { len: 1.6, fat: 0.18, tail: c.tone(c.snowy ? "#ffffff" : "#d8823a", it.z) }); };
  P.wolf = (g, x, y, s, it, c) => { const sh = s * 0.42; quad(g, x, y, sh, c.tone(c.snowy ? "#c8ccd0" : "#5a5a5e", it.z), it.dir, c.t * 10 + it.seed, true, { len: 1.5, fat: 0.2, tail: c.tone("#4a4a4e", it.z) }); };
  P.mammoth = (g, x, y, s, it, c) => { const sh = s * 1.3, col = c.tone("#5a4434", it.z), ph = c.t * 2 + it.seed; quad(g, x, y, sh, col, it.dir, ph, true, { len: 1.1, fat: 0.38 });
    g.fillStyle = col; g.beginPath(); g.ellipse(x - it.dir * sh * 0.15, y - sh * 0.82, sh * 0.42, sh * 0.32, 0, 0, TAU); g.fill();
    g.strokeStyle = c.tone("#e8dcc0", it.z); g.lineWidth = Math.max(0.7, sh * 0.06); g.beginPath(); const tx = x + it.dir * sh * 0.72, ty = y - sh * 0.5; g.moveTo(tx, ty); g.quadraticCurveTo(tx + it.dir * sh * 0.35, ty + sh * 0.25, tx + it.dir * sh * 0.45, ty - sh * 0.1); g.stroke(); };
  P.horker = (g, x, y, s, it, c) => { const r = s * 0.3, col = c.tone("#6a5a4e", it.z); g.fillStyle = col; g.beginPath(); g.ellipse(x, y - r * 0.5, r * 1.3, r * 0.55, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(x + it.dir * r * 1.1, y - r * 0.85, r * 0.38, 0, TAU); g.fill();
    g.strokeStyle = c.tone("#ece4d0", it.z); g.lineWidth = Math.max(0.5, r * 0.08); g.beginPath(); g.moveTo(x + it.dir * r * 1.25, y - r * 0.7); g.lineTo(x + it.dir * r * 1.3, y - r * 0.2); g.stroke(); };
  P.pilgrim = (g, x, y, s, it, c) => person(g, x, y - Math.abs(Math.sin(c.t * 4 + it.seed)) * s * 0.02, s * 0.95, c.tone(["#7a6a56", "#5a5a6a", "#8a7a5a"][it.seed % 3], it.z), c.tone("#3a3028", it.z), null, Math.sin(c.t * 4 + it.seed) * 0.02, it.seed % 2 ? "hood" : "staff");
  P.guard = (g, x, y, s, it, c) => person(g, x, y - Math.abs(Math.sin(c.t * 5 + it.seed)) * s * 0.02, s * 1.0, c.tone(it.cloak || "#7a6a3a", it.z), c.tone("#5a5048", it.z), c.tone(it.shield || "#c8a040", it.z), Math.sin(c.t * 5 + it.seed) * 0.015, "guard");
  P.cart = (g, x, y, s, it, c) => { const r = s * 0.55, wood = c.tone("#7a5432", it.z);
    g.fillStyle = wood; g.fillRect(x - r * 0.7, y - r * 0.85, r * 1.4, r * 0.45);
    g.fillStyle = c.tone("#d8c8a0", it.z); g.beginPath(); g.moveTo(x - r * 0.7, y - r * 0.85); g.quadraticCurveTo(x, y - r * 1.9, x + r * 0.7, y - r * 0.85); g.closePath(); g.fill();
    g.strokeStyle = c.tone("#8c3c28", it.z); g.lineWidth = Math.max(0.6, r * 0.06); g.beginPath(); g.moveTo(x - r * 0.35, y - r * 0.9); g.quadraticCurveTo(x, y - r * 1.55, x + r * 0.35, y - r * 0.9); g.stroke();
    for (const sd of [-1, 1]) { g.fillStyle = c.tone("#3a2a1c", it.z); g.beginPath(); g.ellipse(x + sd * r * 0.62, y - r * 0.3, r * 0.08, r * 0.3, 0, 0, TAU); g.fill(); }
    g.fillStyle = "#ffd890"; g.fillRect(x + r * 0.72, y - r * 1.2, Math.max(1, r * 0.08), Math.max(1, r * 0.12)); c.lights.push([x + r * 0.76, y - r * 1.14, r * 1.2, "255,196,120", 0.8]);
    quad(g, x - it.dir * r * 1.4, y, r * 0.95, c.tone("#6a5040", it.z), -it.dir, 0, false, { len: 1.2 });
    person(g, x + it.dir * r * 1.2, y, s * 0.9, c.tone("#a07a40", it.z), c.tone("#c8a46c", it.z), null, 0, "hood"); };
  P.flock = (g, x, y, s, it, c) => { const n = it.n || 6, sz = it.sz, col = it.gull ? "rgba(245,245,240,0.9)" : "rgba(30,28,32,0.85)"; g.strokeStyle = col; g.lineWidth = Math.max(0.8, sz * 0.18); g.beginPath();
    for (let i = 0; i < n; i++) { const bx = x + Math.sin(i * 2.3) * sz * 4 + i * sz * 1.6 * it.dir * -1, by = y + Math.cos(i * 1.7) * sz * 2, f = Math.sin(c.t * 7 + i * 1.3) * sz * 0.5; g.moveTo(bx - sz, by - f); g.quadraticCurveTo(bx - sz * 0.4, by - sz * 0.4, bx, by); g.quadraticCurveTo(bx + sz * 0.4, by - sz * 0.4, bx + sz, by - f); } g.stroke(); };
  P.dragon = (g, x, y, s, it, c) => { const sz = it.sz, f = Math.sin(c.t * 3.2) * 0.6, d = it.dir; g.fillStyle = c.night ? "rgba(10,12,16,0.85)" : "rgba(40,34,36,0.8)";
    g.beginPath(); g.ellipse(x, y, sz * 0.9, sz * 0.18, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(x + d * sz * 0.8, y); g.quadraticCurveTo(x + d * sz * 1.3, y - sz * 0.15, x + d * sz * 1.45, y - sz * 0.05); g.lineTo(x + d * sz * 0.8, y + sz * 0.1); g.fill();
    g.beginPath(); g.moveTo(x - d * sz * 0.8, y); g.quadraticCurveTo(x - d * sz * 1.5, y + sz * 0.1, x - d * sz * 1.8, y - sz * 0.15); g.lineTo(x - d * sz * 0.8, y + sz * 0.1); g.fill();
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(x - sz * 0.25, y); g.lineTo(x + d * sz * 0.1, y + sd * sz * 1.4 * f - (sd < 0 ? sz * 0.2 : 0)); g.lineTo(x + sz * 0.3, y + sd * sz * 0.9 * f); g.lineTo(x + sz * 0.3, y); g.closePath(); g.fill(); } };

  // ---------------------------------------------------------------- turning the director's plan into things on the ground
  const AMB = {   // ambient kind → members [prop, height range (units), count weight, lateral band]
    grass: [["grass", 0.12, 0.22, 4], ["boulder", 0.08, 0.16, 1]], boulders: [["boulder", 0.12, 0.34, 3], ["grass", 0.12, 0.2, 2]], shrubs: [["bush", 0.12, 0.22, 3], ["grass", 0.12, 0.2, 1]],
    lonepine: [["pine", 1.0, 1.6, 2], ["boulder", 0.1, 0.2, 1], ["grass", 0.12, 0.2, 1]], stones: [["boulder", 0.06, 0.14, 4]],
    pines: [["pine", 1.3, 2.3, 6], ["fern", 0.12, 0.2, 1], ["boulder", 0.12, 0.25, 0.6]], ferns: [["fern", 0.12, 0.22, 4], ["pine", 1.2, 2, 2]], mossy: [["boulder", 0.15, 0.35, 2], ["fern", 0.12, 0.2, 2], ["pine", 1.2, 2, 2]],
    stumps: [["stump", 0.06, 0.1, 2], ["fern", 0.1, 0.18, 1], ["pine", 1.2, 2, 1]], deadfall: [["log", 0.4, 0.7, 1], ["pine", 1.2, 2, 2]],
    snowpines: [["pine", 1.0, 1.8, 4], ["snowbank", 0.2, 0.5, 2]], snowbank: [["snowbank", 0.25, 0.7, 3], ["boulder", 0.1, 0.25, 1]], rockface: [["rockface", 0.8, 1.7, 1], ["boulder", 0.12, 0.3, 2]],
    reeds: [["reeds", 0.25, 0.45, 4], ["pool", 0.6, 1.4, 1]], pool: [["pool", 0.8, 2.0, 2], ["reeds", 0.25, 0.4, 2]], deadtrees: [["dead", 0.8, 1.4, 2], ["reeds", 0.2, 0.4, 1], ["stump", 0.06, 0.1, 1]],
    jagged: [["jagged", 0.3, 0.9, 3], ["ashmound", 0.2, 0.4, 1]], ashmound: [["ashmound", 0.25, 0.6, 2], ["jagged", 0.2, 0.5, 1]], vent: [["vent", 0.4, 0.6, 1], ["jagged", 0.2, 0.5, 1]],
    driftwood: [["driftwood", 0.2, 0.4, 2], ["grass", 0.12, 0.2, 2]], broad: [["broad", 1.0, 1.5, 3], ["bush", 0.12, 0.22, 1], ["flowers", 0.15, 0.3, 1]],
    flowers: [["flowers", 0.15, 0.3, 3], ["grass", 0.12, 0.2, 2]], willow: [["willow", 1.0, 1.4, 2], ["grass", 0.12, 0.2, 1]], haystack: [["haystack", 0.25, 0.4, 2]],
    birches: [["birch", 1.0, 1.5, 5], ["bush", 0.12, 0.22, 1]], fence: [],
  };
  const LM = { sign: "sign", cairn: "cairn", stone: "stone", shrine: "shrine", lamp: "lamp" };
  /* the things of one director event, each with its own distance d and side offset u (road half-widths) */
  function members(ev, R, cam, ctx, out) {
    const r = seeded("ev" + ev.seed), side = ev.side, [l0, l1] = R.lat, travel = ctx.travel, z0 = ev.d - travel;
    const seaSide = ctx.seaSide, shore = (d) => 5.5 + 2 * Math.sin(d / 23);
    const add = (o) => { if (seaSide && Math.sign(o.u) === seaSide && Math.abs(o.u) > shore(o.d) - 0.3 && o.kind !== "horker" && o.kind !== "shipwreck") return; o.z = o.d - travel; out.push(o); };
    if (ev.tier === "ambient") {
      if (ev.kind === "fence") { const u = side * (1.6 + r() * 0.4); for (let k = 0; k < 6; k++) add({ kind: "post", d: ev.d + k * 0.7, u, seed: ev.seed + k, h: 0.3 }); out.push({ kind: "rail", d: ev.d, u, n: 6, z: z0, seed: ev.seed }); return; }
      const mem = AMB[ev.kind] || AMB.grass, tot = mem.reduce((a, m) => a + m[3], 0), [c0, c1] = R.cluster, n = c0 + Math.floor(r() * (c1 - c0 + 1));
      const both = R.wall && r() < 0.6, cu = l0 + Math.pow(r(), 1.6) * (l1 - l0);   // a cluster sits around one spot, not spread evenly
      for (let k = 0; k < n; k++) {
        let x = r() * tot, m = mem[0]; for (const q of mem) { x -= q[3]; if (x <= 0) { m = q; break; } }
        const sd = both && k % 2 ? -side : side, u = sd * Math.max(l0, cu + (r() - 0.4) * (R.wall ? 1.8 : 2.4)), d = ev.d + (r() - 0.5) * (R.wall ? 4 : 2.6);
        add({ kind: m[0], d, u, seed: (ev.seed + k * 7919) % 1e9, h: m[1] + r() * (m[2] - m[1]), r: m[0] === "pool" ? m[1] + r() * (m[2] - m[1]) : 0 });
      }
      return;
    }
    if (ev.tier === "poi") {
      if (LM[ev.kind]) add({ kind: "landmark", lm: LM[ev.kind], d: ev.d, u: side * (1.55 + r() * 0.3), seed: ev.seed, k: 1 });
      else if (ev.kind === "fallen") add({ kind: "fallen", d: ev.d, u: side * 2.2, seed: ev.seed });
      return;
    }
    if (ev.tier === "moment") {
      const k = ev.kind;
      if (k === "tower") add({ kind: "tower", d: ev.d, u: side * (6 + r() * 4), seed: ev.seed });
      else if (k === "waterfall") add({ kind: "waterfall", d: ev.d, u: side * (6.5 + r() * 2), seed: ev.seed });
      else if (k === "oldcamp") add({ kind: "oldcamp", d: ev.d, u: side * (2.6 + r()), seed: ev.seed });
      else if (k === "giants") add({ kind: "giants", d: ev.d, u: side * (9 + r() * 3), seed: ev.seed });
      else if (k === "shipwreck") { if (seaSide) add({ kind: "shipwreck", d: ev.d, u: seaSide * (shore(ev.d) + 2), seed: ev.seed }); }
      else if (k === "bridge") out.push({ kind: "bridge", d: ev.d, u: 0, z: z0, seed: ev.seed });
      else if (k === "dragon" || k === "fogbank") out.push({ kind: k, d: ev.d, u: 0, z: z0, seed: ev.seed, sky: k === "dragon", side });
      return;
    }
    // living: they move, so where they are depends on where you are
    const near = travel - (ev.d - 40);   // how long they've been in view
    const k = ev.kind, dir = r() < 0.5 ? -1 : 1;
    if (k === "deer") { const n = 1 + Math.floor(r() * 3), flee = z0 < 7; for (let i = 0; i < n; i++) { const u0 = side * (3.5 + r() * 3.5); add({ kind: "deer", d: ev.d + i * 0.8, u: u0 + (flee ? side * (7 - z0) * 0.9 : 0), seed: ev.seed + i, dir: flee ? side : (r() < 0.5 ? -1 : 1), flee }); } }
    else if (k === "fox") { const p = clamp((22 - z0) / 14, 0, 1); if (p > 0 && p < 1) add({ kind: "fox", d: ev.d, u: side * (5 - 10 * p), seed: ev.seed, dir: -side }); }
    else if (k === "wolves") { const n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) add({ kind: "wolf", d: ev.d + near * 0.55 + i * 1.1, u: side * (8 + r() * 3), seed: ev.seed + i, dir: 1 }); }
    else if (k === "mammoths") { const n = 2 + Math.floor(r() * 2); for (let i = 0; i < n; i++) add({ kind: "mammoth", d: ev.d + 6 + near * 0.12 + i * 2.2, u: side * (11 + r() * 5), seed: ev.seed + i, dir }); }
    else if (k === "horker") { if (seaSide) { const n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) add({ kind: "horker", d: ev.d + i * 0.9, u: seaSide * (shore(ev.d) - 0.6 - r() * 0.8), seed: ev.seed + i, dir: r() < 0.5 ? -1 : 1 }); } }
    else if (k === "merchant") add({ kind: "cart", d: ev.d, u: side * 2.1, seed: ev.seed, dir: side });
    else if (k === "pilgrims") { const n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) add({ kind: "pilgrim", d: ev.d + near * 0.35 + i * 0.7, u: side * (0.7 + (i % 2) * 0.25), seed: ev.seed + i }); }
    else if (k === "patrol") { const n = 2 + Math.floor(r() * 2), hold = HOLD_COLS[ctx.hold] || HOLD_COLS[""]; for (let i = 0; i < n; i++) add({ kind: "guard", d: ev.d - near * 0.3 + i * 0.8, u: side * (0.75 + (i % 2) * 0.3), seed: ev.seed + i, cloak: hold[0], shield: hold[1] }); }
    else if (k === "birds") out.push({ kind: "flock", d: ev.d, u: 0, z: z0, seed: ev.seed, sky: true, side, gull: R.sea });
  }
  const HOLD_COLS = { "Whiterun": ["#8a7a3a", "#c8a040"], "Haafingar": ["#5a2a4a", "#3a2a50"], "Eastmarch": ["#3a5a4a", "#2a4a3a"], "the Rift": ["#6a3a2a", "#8a5a2a"], "the Reach": ["#7a3a2a", "#9a4a2a"], "Falkreath": ["#3a4a2a", "#2a3a2a"], "Hjaalmarch": ["#5a5a3a", "#6a6a4a"], "the Pale": ["#2a4a6a", "#3a5a7a"], "Winterhold": ["#4a6a8a", "#5a7a9a"], "": ["#6a5a46", "#8a7a5a"] };

  // ---------------------------------------------------------------- the frame
  function paint(g, w, h, hz, I, t, ctx) {
    const S = SC(); if (!S) return null;
    const region = ctx.region, R = S.REGIONS[region] || S.REGIONS.tundra, shp = S.shape(ctx.route);
    const cam = camera(w, h, hz, ctx.travel, ctx.curveS, R, shp), { L, nightK } = ctx, snowy = ctx.snowy || !!R.snowy;
    const dbg = { region, hzE: cam.hzE, objects: 0, kinds: {}, pitch: cam.pitch, fog: 0, sea: null, items: 0 };
    // haze toward the horizon, deeper at night, by distance
    const hazeK = R.haze + L.hazeAdd, horizon = ctx.horizon;
    const toneC = (col, z) => mix(mix(col, horizon, clamp((z - 2) / 44, 0, 1) * hazeK), NIGHT, nightK);
    const seaBear = drawStrip(g, cam, R, ctx); dbg.sea = seaBear ?? null;
    const seaSide = seaBear != null ? (() => { const rel = relDeg(seaBear - ctx.headS); return Math.abs(rel) < 150 ? Math.sign(rel) || 1 : 0; })() : 0;
    const c = { R, cam, t, tone: toneC, snowy, season: ctx.sky?.season || "summer", wind: I.reduce ? 0 : 0.6 + (ctx.sky?.wind ?? 0.3), night: L.tod === "night", lights: ctx.lights, lightsLocal: [], water: mix(mix(ctx.sky0 || "#93b2c6", horizon, 0.5), "#2e4a5a", 0.35), seaSide };
    // the plan for what is in view
    const plan = S.plan(ctx.route, region, ctx.travel - 25, ctx.travel + ZF * 0.95, ctx.trip);
    const items = [], sky = [];
    let fog = 0;
    const bctx = { travel: ctx.travel, seaSide, hold: ctx.sky?.hold || "" };
    for (const ev of plan) {
      const before = items.length; members(ev, R, cam, bctx, items);
      for (let i = before; i < items.length; i++) if (items[i].sky) sky.push(items.splice(i--, 1)[0]);
      dbg.kinds[ev.kind] = (dbg.kinds[ev.kind] || 0) + 1;
    }
    for (const it of sky) if (it.kind === "fogbank") fog = Math.max(fog, clamp(1 - Math.abs(it.z - 6) / 26, 0, 1));
    // dragons and birds cross the sky as you pass under them
    for (const it of sky) {
      if (it.kind !== "dragon" && it.kind !== "flock") continue;
      const p = clamp((70 - it.z) / 100, 0, 1); if (p <= 0 || p >= 1) continue;
      const dir = it.side, x = dir < 0 ? w * (1.15 - 1.3 * p) : w * (-0.15 + 1.3 * p), y = cam.hzE - hz * (it.kind === "dragon" ? 0.5 - 0.18 * Math.sin(p * Math.PI) : 0.35 + 0.15 * Math.sin(it.seed));
      try { P[it.kind](g, x, y, 0, { ...it, dir, sz: it.kind === "dragon" ? h * 0.07 : h * 0.012, n: 5 + (it.seed % 5) }, c); } catch { /* skip */ }
      dbg.objects++;
    }
    // where you're heading, on the horizon
    try { ctx.dest && ctx.dest(g, cam.hzE); } catch { /* no town */ }
    // ground decals and near tufts: world-anchored, so the ground streams past
    const gr = (k) => seeded("gd" + ctx.route + "|" + k);
    const CELL = 1.1, c0 = Math.floor((ctx.travel + ZN) / CELL), c1 = Math.floor((ctx.travel + ZF * 0.8) / CELL);
    const patchCols = patchesOf(R, snowy, c.season);
    for (let k = c0; k <= c1; k++) {
      const r = gr(k), d = k * CELL + r() * CELL, z = d - ctx.travel; if (z < ZN) continue;
      const n = z < 8 ? 3 : z < 20 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const sd = r() < 0.5 ? -1 : 1, u = sd * (1.25 + Math.pow(r(), 1.3) * 11);
        if (seaSide && sd === seaSide && Math.abs(u) > 5) continue;
        if (z < 6 && i === 0 && !snowy) items.push({ kind: "tuft", d, z, u: sd * (1.2 + r() * 1.6), seed: k * 3 + i, h: 0.14 + r() * 0.08 });
        else if (z > 2.5) items.push({ kind: "patch", d, z, u, r: 0.3 + r() * 0.6, col: toneC(patchCols[Math.floor(r() * patchCols.length)], z), seed: k });
      }
    }
    // the land's own cover along the road, both sides, thinning out with distance (seeded by the road, so it stays put)
    if (R.belt) {
      const BC = 1.4, b0 = Math.floor((ctx.travel + ZN) / BC), b1 = Math.floor((ctx.travel + 26) / BC), bm = R.belt.m, btot = bm.reduce((a, m) => a + m[3], 0);
      for (let k = b0; k <= b1; k++) for (const sd of [-1, 1]) {
        const r = gr("bt" + k + sd); if (r() > R.belt.p) continue;
        const d = k * BC + r() * BC, z = d - ctx.travel; if (z < ZN) continue;
        let x = r() * btot, m = bm[0]; for (const q of bm) { x -= q[3]; if (x <= 0) { m = q; break; } }
        const u = sd * (R.belt.lat[0] + Math.pow(r(), 1.5) * (R.belt.lat[1] - R.belt.lat[0]));
        if (seaSide && sd === seaSide && Math.abs(u) > 4.5) continue;
        items.push({ kind: m[0], d, z, u, seed: k * 13 + (sd > 0 ? 7 : 0), h: m[1] + r() * (m[2] - m[1]), belt: true });
      }
    }
    if (R.dapple && L.tod === "day" && !["rain", "storm", "fog", "blizzard"].includes(L.wx)) for (let k = c0; k <= Math.min(c1, c0 + 18); k++) { const r = gr("dp" + k), d = k * CELL + r() * CELL, z = d - ctx.travel; if (z < ZN) continue; items.push({ kind: "patch", d, z, u: (r() - 0.5) * 3, r: 0.3 + r() * 0.5, col: "rgba(255,236,170,0.16)", seed: k }); }
    // things: keep the 50 nearest that are on screen
    const drawn = [];
    for (const it of items) {
      if (it.z < 0.45 || it.z > ZF) continue;
      if (it.kind === "rail" || it.kind === "bridge") { drawn.push(it); continue; }
      const x = cam.X(it.z, it.u), sw = cam.s(it.z) * 2.6;
      if (x < -sw || x > w + sw) continue;
      drawn.push(it);
    }
    // at most 50 things: the director's come first, the land's cover fills up what's left, nearest first
    const props = drawn.filter((it) => it.kind !== "patch" && it.kind !== "tuft").sort((a, b) => (a.belt ? 1 : 0) - (b.belt ? 1 : 0) || a.z - b.z);
    if (props.length > 50) { const cut = new Set(props.slice(50)); for (let i = drawn.length - 1; i >= 0; i--) if (cut.has(drawn[i])) drawn.splice(i, 1); }
    drawn.sort((a, b) => b.z - a.z);
    // the ground: a base wash, then slices far to near with the road and everything on them
    const gg = g.createLinearGradient(0, cam.hzE, 0, h); gg.addColorStop(0, toneC(snowy && !R.snowy ? mix(R.gd, "#dfe6ec", 0.7) : R.gd, 40)); gg.addColorStop(1, toneC(snowy && !R.snowy ? mix(R.ground, "#e4eaee", 0.72) : R.ground, 1));
    g.fillStyle = gg; g.fillRect(-4, cam.hzE - 1, w + 8, h - cam.hzE + 6);
    const groundC = snowy && !R.snowy ? mix(R.ground, "#e4eaee", 0.72) : R.ground, gdC = snowy && !R.snowy ? mix(R.gd, "#dfe6ec", 0.7) : R.gd;
    const paved = I.ground === "Road" || I.ground === "Bridge", roadBase = snowy ? "#d6d2ca" : R.road, bridges = drawn.filter((it) => it.kind === "bridge");
    const river = R.river ? (shp.b[0] > 3.14 ? 1 : -1) : 0, rivU = (d) => river * (5.2 + 2.6 * Math.sin(d / 37 + shp.e[0]));
    const shoreU = (d) => seaSide * (5.5 + 2 * Math.sin(d / 23));
    let di = 0, curtain1 = false, curtain2 = false, ns = 0;
    for (let i = NS - 1; i >= 0; i--) {
      const zf = Z[i + 1], zn = Z[i], yf = cam.gy(zf), yn = cam.gy(zn), zm = (zf + zn) / 2;
      // draw everything that stands beyond this slice first
      while (di < drawn.length && drawn[di].z >= zf) { drawItem(g, drawn[di], c, dbg); di++; }
      if (!curtain1 && zf <= 22) { curtain1 = true; haze(g, cam, w, horizon, hazeK * 0.55, nightK, 22); }
      if (!curtain2 && zf <= 9) { curtain2 = true; haze(g, cam, w, horizon, hazeK * 0.3, nightK, 9); }
      if (yn <= yf + 0.05) continue;   // the far side of a crest: hidden
      ns++;
      const band = Math.floor((zm + ctx.travel) / 1.7) % 2;
      g.fillStyle = toneC(mix(gdC, groundC, clamp(1 - zm / 30, 0, 1)), zm); g.fillRect(-4, yf, w + 8, yn - yf + 0.6);
      if (band) { g.fillStyle = "rgba(0,0,0,0.035)"; g.fillRect(-4, yf, w + 8, yn - yf + 0.6); }
      const ca = cam.cx(zn), cb = cam.cx(zf), ha = cam.half0 / zn, hb = cam.half0 / zf;
      // a river beside the road (the valley), the sea on one side (the coast)
      if (river) { const ua = rivU(ctx.travel + zn), ub = rivU(ctx.travel + zf); g.fillStyle = toneC(c.water, zm); g.beginPath(); g.moveTo(ca + (ua - 1.4) * ha, yn + 0.5); g.lineTo(cb + (ub - 1.4) * hb, yf); g.lineTo(cb + (ub + 1.4) * hb, yf); g.lineTo(ca + (ua + 1.4) * ha, yn + 0.5); g.fill();
        if (band && zm < 25) { g.fillStyle = "rgba(240,248,250,0.18)"; g.fillRect(cb + (ub - 0.6) * hb, yf, 1.2 * hb, Math.max(0.5, (yn - yf) * 0.4)); } }
      if (seaSide) { const ua = shoreU(ctx.travel + zn), ub = shoreU(ctx.travel + zf), edge = seaSide > 0 ? w + 6 : -6; g.fillStyle = toneC(mix(c.water, "#3c6178", 0.4), zm); g.beginPath(); g.moveTo(ca + ua * ha, yn + 0.5); g.lineTo(cb + ub * hb, yf); g.lineTo(edge, yf); g.lineTo(edge, yn + 0.5); g.fill();
        g.fillStyle = toneC(mix(groundC, "#3a3028", 0.45), zm); g.beginPath(); g.moveTo(ca + ua * ha, yn + 0.5); g.lineTo(cb + ub * hb, yf); g.lineTo(cb + (ub + seaSide * 0.35) * hb, yf); g.lineTo(ca + (ua + seaSide * 0.35) * ha, yn + 0.5); g.fill();
        if (band && zm < 30) { g.fillStyle = "rgba(240,248,250,0.25)"; g.fillRect(Math.min(ca + ua * ha, edge), yf, Math.abs(ca + (ua + seaSide * 3) * ha - (ca + ua * ha)), Math.max(0.5, (yn - yf) * 0.25)); } }
      // a stream crossing under a bridge, or the ford you're in
      const cross = bridges.some((b) => Math.abs(b.z - zm) < 1.0) || (I.ground === "River (ford)" && zm < 3);
      if (cross) { g.fillStyle = toneC(c.water, zm); g.fillRect(-4, yf, w + 8, yn - yf + 0.6); if (band) { g.fillStyle = "rgba(235,245,250,0.3)"; g.fillRect(-4, yf, w + 8, Math.max(0.5, (yn - yf) * 0.3)); } }
      if (I.ground === "River (ford)" && zm < 3) continue;
      // the road
      const onBridge = bridges.some((b) => Math.abs(b.z - zm) < 1.1);
      const rc = toneC(onBridge ? "#9a9488" : band ? roadBase : mix(roadBase, "#000000", 0.06), zm), edge = toneC(mix(gdC, "#000000", 0.28), zm);
      g.fillStyle = edge; g.beginPath(); g.moveTo(ca - ha * 1.12, yn + 0.5); g.lineTo(cb - hb * 1.12, yf); g.lineTo(cb + hb * 1.12, yf); g.lineTo(ca + ha * 1.12, yn + 0.5); g.fill();
      g.fillStyle = rc; g.beginPath(); g.moveTo(ca - ha, yn + 0.5); g.lineTo(cb - hb, yf); g.lineTo(cb + hb, yf); g.lineTo(ca + ha, yn + 0.5); g.fill();
      if (!paved && !onBridge && zn < 24) { g.fillStyle = snowy ? "rgba(120,100,80,0.22)" : "rgba(40,30,20,0.17)"; for (const k of [-0.45, 0.45]) { g.beginPath(); g.moveTo(ca + ha * (k - 0.07), yn + 0.5); g.lineTo(cb + hb * (k - 0.07), yf); g.lineTo(cb + hb * (k + 0.07), yf); g.lineTo(ca + ha * (k + 0.07), yn + 0.5); g.fill(); }
        if (zn < 10) { g.fillStyle = "rgba(255,248,230,0.07)"; g.fillRect(cb - hb * 0.15, yf, hb * 0.3, yn - yf); } }
      if ((paved || onBridge) && band && zn < 24) { g.fillStyle = "rgba(255,250,235,0.08)"; g.fillRect(cb - hb * 0.9, yf, hb * 1.8, Math.max(0.6, (yn - yf) * 0.25)); }
      if (I.ground === "Bridge" && zn < 14) for (const sd of [-1, 1]) { g.fillStyle = toneC("#5a4430", zm); const x = cb + sd * hb * 1.08, sc = cam.s(zf); g.fillRect(x - sc * 0.015, yf - sc * 0.2, sc * 0.03, sc * 0.2); }
    }
    while (di < drawn.length) { drawItem(g, drawn[di], c, dbg); di++; }
    // fog: the region's own low fog, the weather's and a fog bank you ride into
    const lowFog = (R.fog || 0) + fog * 0.55;
    if (lowFog > 0.02) { const fy = cam.hzE, fg = g.createLinearGradient(0, fy - h * 0.2, 0, fy + h * 0.45); fg.addColorStop(0, "rgba(220,226,228,0)"); fg.addColorStop(0.45, rgba(mix("#dce2e4", NIGHT, nightK * 0.8), Math.min(0.75, lowFog))); fg.addColorStop(1, "rgba(220,226,228,0)"); g.fillStyle = fg; g.fillRect(-4, fy - h * 0.2, w + 8, h * 0.65);
      if (!I.reduce) for (let i = 0; i < 4; i++) { const x = ((i * 0.31 + t * 0.012 * (1 + i * 0.3)) % 1.4 - 0.2) * w, y = fy + h * (0.04 + i * 0.06), rx = w * 0.28, ry = h * 0.05; g.fillStyle = rgba(mix("#e4e8ea", NIGHT, nightK * 0.8), Math.min(0.35, lowFog * 0.6)); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); } }
    if (fog > 0.05) { g.fillStyle = rgba(mix("#dde2e4", NIGHT, nightK * 0.8), fog * 0.35); g.fillRect(-4, -4, w + 8, h + 8); }
    // the region's light and a warm glow round a low sun
    g.fillStyle = R.tint; g.fillRect(-4, -4, w + 8, h + 8);
    if ((L.tod === "dawn" || L.tod === "dusk") && !["storm", "fog", "blizzard", "rain", "ashstorm"].includes(L.wx)) {
      const hour = ctx.sky?.hour ?? 19, az = 90 + (hour - 6) * 15, x = w / 2 + relDeg(az - ctx.headS) * ctx.pxDeg;
      if (x > -w * 0.5 && x < w * 1.5) { const gl = g.createRadialGradient(x, cam.hzE, 0, x, cam.hzE, w * 0.45); gl.addColorStop(0, "rgba(255,170,90,0.28)"); gl.addColorStop(1, "rgba(255,170,90,0)"); g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = gl; g.fillRect(x - w * 0.45, cam.hzE - w * 0.45, w * 0.9, w * 0.9); g.restore(); }
    }
    dbg.fog = +(lowFog).toFixed(2); dbg.items = drawn.length; dbg.slices = ns; dbg.seaSide = seaSide;
    return dbg;
  }
  function haze(g, cam, w, horizon, a, nightK, zc) {
    if (a <= 0.01) return;
    const y0 = cam.hzE - cam.H * 0.06, y1 = Math.max(y0 + 1, cam.gy(zc));
    const col = mix(horizon, NIGHT, nightK), gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.25, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(-4, y0, w + 8, y1 - y0);
  }
  function drawItem(g, it, c, dbg) {
    const cam = c.cam;
    if (it.kind === "rail") {   // a fence's rails, post to post
      g.strokeStyle = c.tone("#6e5236", it.z); g.beginPath();
      for (const hk of [0.24, 0.12]) for (let k = 0; k < it.n; k++) { const z = it.z + k * 0.7; if (z < 0.5) continue; const x = cam.X(z, it.u), y = cam.gy(z) - cam.s(z) * hk; g.lineWidth = Math.max(0.6, cam.s(z) * 0.025); k && z > 0.5 ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); return;
    }
    if (it.kind === "bridge") { try { P.bridge(g, 0, 0, 0, it, c); } catch { /* skip */ } dbg.objects++; return; }
    const f = P[it.kind]; if (!f) return;
    const x = cam.X(it.z, it.u), y = cam.gy(it.z), s = cam.s(it.z);
    const fade = it.z > ZF * 0.7 ? clamp(1 - (it.z - ZF * 0.7) / (ZF * 0.3), 0, 1) : 1;
    if (fade <= 0.02) return;
    g.globalAlpha = fade;
    if (it.kind !== "patch" && it.kind !== "tuft" && it.kind !== "pool" && s > 4) {   // a soft contact shadow
      g.fillStyle = "rgba(10,12,16,0.18)"; g.beginPath(); g.ellipse(x, y, Math.max(1, s * Math.min(0.5, (it.h || 0.4) * 0.35)), Math.max(0.5, s * 0.03), 0, 0, TAU); g.fill();
    }
    try { f(g, x, y, s, it, c); } catch { /* one odd prop never stops the picture */ }
    g.globalAlpha = 1;
    if (it.kind !== "patch" && it.kind !== "tuft") dbg.objects++;
  }
  function patchesOf(R, snowy, season) {
    if (snowy) return ["#f4f7fa", "#c9d4dc", "#d8e0e6"];
    if (R.name === "ash") return ["#3a3432", "#5e5650", "#2e2a28"];
    if (R.name === "marsh") return ["#44503a", "#3c4a46", "#66724a"];
    if (R.name === "pine") return ["#2e3a24", "#54482e", "#3a4a2a"];
    if (R.name === "coast") return ["#a89c76", "#7a8060", "#b8ae8a"];
    if (R.name === "rocky") return ["#7c705e", "#a09074", "#6c6250"];
    if (season === "autumn" || R.name === "autumn") return ["#b8803a", "#8a5a28", "#c89a48"];
    if (R.name === "valley") return ["#5a7a36", "#8aa850", "#4e6a2e"];
    return ["#c4ac68", "#8a7a48", "#a89458"];   // tundra: golden and brown
  }
  return { paint, camera, ZF, ZN, P, AMB, _strip: () => strip };
})();
