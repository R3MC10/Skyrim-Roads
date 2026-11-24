/* Solstheim's art: the island's painted map (ash wastes in the south under Red Mountain's smoke, snow in the north),
   its place pictures (Raven Rock and the Bulwark, Tel Mithryn's mushroom tower, the Skaal village, the ash wastes,
   the All-Maker Stones, Miraak's temple), story scenes (the cultists at the docks, Miraak in Apocrypha, a freed stone),
   the ship at sea, and the island's creatures for fight scenes and enemy icons. Everything is drawn in code with the
   shared ART toolkit. Hooks: map.js, placeart.js, eventart.js,
   fightart.js and iconart.js ask SOLART when they meet Solstheim. [OURS] drawings of [Skyrim] places. */
const SOLART = (() => {
  const LX = (x) => (typeof I18N_SWEEP !== "undefined" ? I18N_SWEEP.c(x) : x);   // words drawn on canvas, in the player's language
  const P = ART.PAL;
  const W = 1000, H = 700, S = 2.4;
  const OY = () => WORLD.SOL_OY;
  const rng = (seed) => ART.seeded("sol" + seed);
  const FONT = (size, w = 600, style = "") => `${style} ${w} ${size}px "Cormorant Garamond", Georgia, serif`;
  const Pm = (p) => [p[0] * W, p[1] * H];
  const loc = (name) => { const p = WORLD.places[name]; return p ? [p[0], p[1] - OY()] : [0.5, 0.5]; };
  function smoothPath(g, pts, close) {
    g.beginPath(); g.moveTo(...Pm(pts[0]));
    for (let i = 1; i < pts.length - 1; i++) { const [ax, ay] = Pm(pts[i]), [bx, by] = Pm(pts[i + 1]); g.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2); }
    if (close) { const [ax, ay] = Pm(pts[pts.length - 1]), [bx, by] = Pm(pts[0]); g.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2); g.closePath(); }
    else g.lineTo(...Pm(pts[pts.length - 1]));
  }

  // ================================================================ the map
  const COL = { 5: [170, 166, 136], 6: [178, 172, 146], 7: [118, 136, 96], 8: [214, 222, 226], 10: [120, 130, 110], 11: [232, 236, 240], 12: [108, 98, 90],
    13: [160, 142, 124], 14: [150, 140, 132], 15: [216, 218, 224], 16: [146, 138, 130] };
  /* Red Mountain on Vvardenfell, seen across the sea to the south-east */
  function redMountain(g, x, y, s, t = 0, reduce = true) {
    g.fillStyle = "rgba(40,34,32,.85)"; g.beginPath(); g.moveTo(x - 90 * s, y + 20 * s); g.lineTo(x - 22 * s, y - 34 * s); g.lineTo(x - 10 * s, y - 38 * s); g.lineTo(x + 6 * s, y - 37 * s); g.lineTo(x + 26 * s, y - 30 * s); g.lineTo(x + 100 * s, y + 20 * s); g.closePath(); g.fill();
    const gl = g.createRadialGradient(x - 2 * s, y - 38 * s, 1, x - 2 * s, y - 38 * s, 22 * s); gl.addColorStop(0, "rgba(255,150,60,.85)"); gl.addColorStop(1, "rgba(255,120,40,0)");
    g.fillStyle = gl; g.fillRect(x - 26 * s, y - 62 * s, 52 * s, 50 * s);
    for (let i = 0; i < 9; i++) {   // the plume, drifting west on the wind
      const k = i / 8, ph = reduce ? 0 : (t * 0.06 + i * 0.11) % 1, px = x - 4 * s - (k + ph * 0.12) * 120 * s, py = y - 44 * s - (k + ph * 0.12) * 110 * s, r = (12 + k * 30) * s;
      g.fillStyle = `rgba(${70 + k * 50},${62 + k * 46},${58 + k * 44},${0.55 - k * 0.38})`; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill();
    }
  }
  let baseC = null;
  function paint() {
    const ST = Terrain.Sol, T = ST.T, GW = ST.GW, GH = ST.GH, grid = ST.grid, SW = SOLW;
    const c = document.createElement("canvas"); c.width = W * S; c.height = H * S;
    const g = c.getContext("2d"); g.scale(S, S);
    const r = rng(11), u = (a, b) => a + r() * (b - a);
    // ---- sea: cold in the north, ash-grey toward Morrowind
    const sea = g.createLinearGradient(0, 0, 0, H); sea.addColorStop(0, "#1b2e39"); sea.addColorStop(0.55, "#2a4350"); sea.addColorStop(1, "#3c4446");
    g.fillStyle = sea; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 320; i++) { const x = u(0, W), y = u(0, H); if (ST.inPoly([x, y], ST.land)) continue; g.strokeStyle = "rgba(170,196,206,.18)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 4, y - 2, x + 8, y); g.stroke(); }
    redMountain(g, 0.965 * W, 1.0 * H, 1.15);
    g.fillStyle = "rgba(34,30,28,.8)"; g.beginPath(); g.moveTo(0.86 * W, H); g.quadraticCurveTo(0.93 * W, 0.965 * H, W, 0.955 * H); g.lineTo(W, H); g.fill();   // the far coast
    // ---- land colour field
    const cf = document.createElement("canvas"); cf.width = GW; cf.height = GH;
    const cg = cf.getContext("2d"), img = cg.createImageData(GW, GH);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x; let t = grid[i];
      if (t === T.SEA) { img.data[i * 4 + 3] = 0; continue; }
      if (t <= T.BRIDGE) t = y / GH < SW.snowLine ? T.SNOW : T.ASH;
      const col = COL[t] || COL[5], n = ST.fbm(x / 7.5, y / 7.5, 3) - 0.5, warm = Math.max(0, y / GH - 0.5) * 18;
      for (let k = 0; k < 3; k++) img.data[i * 4 + k] = Math.max(0, Math.min(255, col[k] + n * 34 - (k === 2 ? warm : 0)));
      img.data[i * 4 + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    const landPath = new Path2D(), cs = SW.coast, mid = (a, b) => [(a[0] + b[0]) / 2 * W, (a[1] + b[1]) / 2 * H];   // the same smooth curve as the coastline
    landPath.moveTo(...mid(cs[cs.length - 1], cs[0]));
    for (let i = 0; i < cs.length; i++) { const nx = cs[(i + 1) % cs.length]; landPath.quadraticCurveTo(...Pm(cs[i]), ...mid(cs[i], nx)); }
    landPath.closePath();
    g.save(); g.clip(landPath); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.filter = "blur(2.2px)"; g.drawImage(cf, 0, 0, W, H); g.filter = "none";   // soft edges between snow, tundra and ash
    // ---- hill shading
    const HW = 500, HH = 350, hs = document.createElement("canvas"); hs.width = HW; hs.height = HH;
    const hg = hs.getContext("2d"), himg = hg.createImageData(HW, HH), hf = new Float32Array(HW * HH);
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) hf[y * HW + x] = ST.heightAt([(x + 0.5) * 2, (y + 0.5) * 2]);
    for (let y = 1; y < HH - 1; y++) for (let x = 1; x < HW - 1; x++) {
      const i = y * HW + x, sh = Math.max(-1, Math.min(1, (hf[i + 1] - hf[i - 1] + hf[i + HW] - hf[i - HW]) * 9));
      const a = Math.min(0.55, Math.abs(sh) * 0.6) * Math.min(1, Math.max(0, hf[i] - 0.18) * 2.4), light = sh < 0;
      himg.data[i * 4] = light ? 255 : 40; himg.data[i * 4 + 1] = light ? 250 : 30; himg.data[i * 4 + 2] = light ? 236 : 22; himg.data[i * 4 + 3] = a * 255 * (light ? 0.75 : 1);
    }
    hg.putImageData(himg, 0, 0); g.drawImage(hs, 0, 0, W, H);
    for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.6 ? "rgba(60,50,40,.07)" : "rgba(255,252,240,.07)"; g.fillRect(u(0, W), u(0, H), u(0.6, 1.6), u(0.6, 1.6)); }
    // the ash wastes: a soft grey haze over the south, heavier near the volcanic vents
    const hz = g.createLinearGradient(0, 0.45 * H, 0, H); hz.addColorStop(0, "rgba(90,84,80,0)"); hz.addColorStop(1, "rgba(90,84,80,.22)"); g.fillStyle = hz; g.fillRect(0, 0, W, H);
    // ---- lakes and the creek
    for (const [lx, ly, rx, ry] of SW.lakes) { g.fillStyle = "#5f8797"; g.beginPath(); g.ellipse(lx * W, ly * H, rx * W, ry * H, 0, 0, 7); g.fill(); g.strokeStyle = "#3b2c1e"; g.lineWidth = 1.2; g.stroke(); }
    for (const rv of SW.rivers) { g.strokeStyle = "#4f7f92"; g.lineWidth = 2.4; g.lineCap = "round"; smoothPath(g, rv.pts); g.stroke(); g.strokeStyle = "#7fb0c0"; g.lineWidth = 0.9; smoothPath(g, rv.pts); g.stroke(); }
    // ---- glyphs: snowy pines, peaks, ash dunes, dead trees, Tel Mithryn's giant mushrooms, steaming vents
    const tm = Pm(loc("Tel Mithryn")), glyphs = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const t = grid[y * GW + x], px = x * 4 + u(0, 4), py = y * 4 + u(0, 4), h = ST.hgrid[y * GW + x];
      const nearTM = Math.hypot(px - tm[0], py - tm[1]) < 70;
      if (t === T.PINE && r() < 0.4) glyphs.push(["snowpine", px, py, u(3, 4.8)]);
      else if (t === T.SNOW && r() < 0.05) glyphs.push(["snowpine", px, py, u(3, 4.4)]);
      else if ((t === T.ASH || t === T.VOLCANIC) && nearTM && r() < 0.09) glyphs.push(["mush", px, py, u(2.6, 4.6)]);
      else if (t === T.ASH && r() < 0.05) glyphs.push(["dune", px, py, u(4, 8)]);
      else if (t === T.ASH && r() < 0.012) glyphs.push(["dead", px, py, u(3, 4.6)]);
      else if (t === T.VOLCANIC && r() < 0.035) glyphs.push(["vent", px, py, u(2, 3.6)]);
      else if (t === T.ROCKY && r() < 0.12) glyphs.push(["rock", px, py, u(1.6, 3)]);
      else if (t === T.TUNDRA && r() < 0.04) glyphs.push(["tuft", px, py, u(2, 3)]);
      if ((t === T.MOUNTAIN || t === T.PEAK) && r() < 0.06 + h * 0.07) glyphs.push(["peak", px, py + 4, (9 + h * 15) * u(0.8, 1.2), h]);
    }
    glyphs.sort((a, b) => a[2] - b[2]);
    for (const [kind, x, y, s, extra] of glyphs) {
      if (kind === "snowpine") {
        g.fillStyle = "rgba(30,40,40,.22)"; g.beginPath(); g.ellipse(x + s * 0.4, y + s * 0.9, s * 0.8, s * 0.3, 0, 0, 7); g.fill();
        g.fillStyle = "#43584c"; g.beginPath(); g.moveTo(x - s * 0.62, y + s * 0.8); g.lineTo(x, y - s * 1.35); g.lineTo(x + s * 0.62, y + s * 0.8); g.fill();
        g.fillStyle = "#f2f5f7"; g.beginPath(); g.moveTo(x - s * 0.3, y - s * 0.28); g.lineTo(x, y - s * 1.35); g.lineTo(x + s * 0.3, y - s * 0.28); g.fill();
      } else if (kind === "mush") {
        g.strokeStyle = "#6e5e50"; g.lineWidth = s * 0.35; g.beginPath(); g.moveTo(x, y + s); g.lineTo(x + s * 0.1, y - s * 0.6); g.stroke();
        g.fillStyle = ["#8a6a8e", "#9c7a62", "#7a8a6a"][Math.floor(r() * 3)]; g.beginPath(); g.ellipse(x + s * 0.1, y - s * 0.7, s * 1.1, s * 0.5, 0, Math.PI, 0); g.fill();
        g.strokeStyle = "rgba(40,30,24,.7)"; g.lineWidth = 0.6; g.stroke();
      } else if (kind === "dune") {
        g.strokeStyle = "rgba(78,72,68,.45)"; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x, y - s * 0.35, x + s, y); g.stroke();
        g.strokeStyle = "rgba(220,214,206,.3)"; g.beginPath(); g.moveTo(x - s * 0.8, y - 1); g.quadraticCurveTo(x, y - s * 0.4, x + s * 0.6, y - 1); g.stroke();
      } else if (kind === "dead") {
        g.strokeStyle = "rgba(40,32,28,.8)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y + s); g.lineTo(x, y - s); g.moveTo(x, y - s * 0.2); g.lineTo(x - s * 0.6, y - s * 0.8); g.moveTo(x, y - s * 0.5); g.lineTo(x + s * 0.5, y - s * 1.0); g.stroke();
      } else if (kind === "vent") {
        g.fillStyle = "rgba(50,40,36,.6)"; g.beginPath(); g.ellipse(x, y + s, s * 0.9, s * 0.4, 0, 0, 7); g.fill();
        g.fillStyle = "rgba(220,140,70,.55)"; g.beginPath(); g.arc(x, y + s * 0.9, s * 0.28, 0, 7); g.fill();
        g.fillStyle = "rgba(200,196,190,.45)"; g.beginPath(); g.arc(x, y - s * 0.3, s * 0.6, 0, 7); g.arc(x + s * 0.5, y - s, s * 0.45, 0, 7); g.fill();
      } else if (kind === "rock") {
        g.fillStyle = "#7f746a"; g.beginPath(); g.moveTo(x - s, y + s * 0.6); g.lineTo(x - s * 0.4, y - s * 0.6); g.lineTo(x + s * 0.7, y - s * 0.3); g.lineTo(x + s, y + s * 0.6); g.fill();
      } else if (kind === "tuft") {
        g.strokeStyle = "rgba(110,100,70,.5)"; g.lineWidth = 0.7; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x, y + s); g.lineTo(x + k * s * 0.7, y - s * 0.3); g.stroke(); }
      } else if (kind === "peak") {
        const w = s * 1.15, tx = x + u(-1.5, 1.5), ty = y - s, north = y < SW.snowLine * H + 30;
        g.fillStyle = "rgba(40,30,20,.22)"; g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.lineTo(x + w * 0.9, y + 1); g.fill();
        g.fillStyle = north ? "#b4aea4" : "#8a7e74"; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(tx, ty); g.lineTo(x + w * 0.05, y); g.fill();
        g.fillStyle = north ? "#7a7268" : "#5e544c"; g.beginPath(); g.moveTo(x + w * 0.05, y); g.lineTo(tx, ty); g.lineTo(x + w / 2, y); g.fill();
        if (north) { const k = 0.45; g.fillStyle = "#f5f6f9"; g.beginPath(); g.moveTo(tx - w / 2 * k, ty + s * k); g.lineTo(tx, ty); g.lineTo(tx + w / 2 * k * 0.6, ty + s * k * 0.85); g.lineTo(tx, ty + s * k * 0.7); g.fill(); }
        g.strokeStyle = "rgba(55,40,28,.75)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(tx, ty); g.lineTo(x + w / 2, y); g.stroke();
      }
    }
    // ---- roads
    for (const chain of ST.roads) {
      const pts = chain.map(([x, y]) => [x / W, y / H]);
      g.strokeStyle = "rgba(64,44,28,.8)"; g.lineWidth = 2.2; g.lineJoin = "round"; g.lineCap = "round"; smoothPath(g, pts); g.stroke();
      g.strokeStyle = "rgba(226,206,160,.5)"; g.lineWidth = 0.8; g.setLineDash([3, 4]); smoothPath(g, pts); g.stroke(); g.setLineDash([]);
    }
    // Raven Rock's Bulwark: a wall drawn into the map
    const rr = Pm(loc("Raven Rock")); g.strokeStyle = "#5a4a3c"; g.lineWidth = 3.2; g.beginPath(); g.arc(rr[0] + 4, rr[1] + 2, 24, Math.PI * 0.95, Math.PI * 1.55); g.stroke();
    g.restore();
    // ---- coastline
    g.strokeStyle = "rgba(200,225,232,.16)"; g.lineWidth = 1;
    for (let k = 1; k <= 3; k++) { g.save(); g.translate(W / 2, H / 2); g.scale(1 + k * 0.012, 1 + k * 0.016); g.translate(-W / 2, -H / 2); g.globalAlpha = 0.7 - k * 0.18; g.stroke(landPath); g.restore(); }
    g.strokeStyle = "#2c2116"; g.lineWidth = 2.6; g.lineJoin = "round"; g.stroke(landPath);
    for (const [fx, fy] of [[0.3, 0.02], [0.62, 0.015], [0.95, 0.06], [0.05, 0.12]]) for (let k = 0; k < 4; k++) {   // ice floes off the north coast
      const x = fx * W + u(-18, 18), y = fy * H + u(-4, 6), a = u(6, 12), b = a * u(0.3, 0.5);
      g.fillStyle = "#e8eef1"; g.strokeStyle = "#8aa4b0"; g.lineWidth = 0.8; g.beginPath(); g.ellipse(x, y, a, b, u(-0.4, 0.4), 0, 7); g.fill(); g.stroke();
    }
    // ---- names
    g.textAlign = "center"; g.textBaseline = "middle";
    const spaced = (txt, x, y, font, fill, sp) => { g.save(); g.translate(x, y); g.font = font; g.fillStyle = fill; if (g.letterSpacing !== undefined) g.letterSpacing = sp; g.fillText(txt, 0, 0); g.restore(); };
    spaced("SOLSTHEIM", 0.11 * W, 0.955 * H, FONT(22, 700), "rgba(245,238,222,.7)", "7px");
    spaced("THE ASH WASTES", 0.44 * W, 0.735 * H, FONT(14, 700, "italic"), "rgba(70,56,48,.62)", "4px");
    spaced("VVARDENFELL", 0.93 * W, 0.985 * H, FONT(11, 700), "rgba(240,210,180,.6)", "4px");
    g.font = FONT(18, 600, "italic"); g.fillStyle = "rgba(190,214,222,.72)"; g.fillText(LX("Sea of Ghosts"), 0.5 * W, 0.02 * H + 4);
    g.save(); g.translate(0.035 * W, 0.5 * H); g.rotate(-Math.PI / 2); g.font = FONT(13, 700); g.fillStyle = "rgba(245,240,230,.5)"; if (g.letterSpacing !== undefined) g.letterSpacing = "5px"; g.fillText(LX("TO WINDHELM "), 0, 0); g.restore();
    const cx = W - 52, cy = 80;   // compass (top right: Red Mountain has the bottom corner)
    g.fillStyle = "rgba(240,232,210,.9)"; g.strokeStyle = "#2c2116"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx, cy - 26); g.lineTo(cx + 6, cy); g.lineTo(cx, cy + 26); g.lineTo(cx - 6, cy); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(cx - 26, cy); g.lineTo(cx, cy - 6); g.lineTo(cx + 26, cy); g.lineTo(cx, cy + 6); g.closePath(); g.fill(); g.stroke();
    g.font = FONT(14, 700); g.fillStyle = "#f2e8cf"; g.fillText("N", cx, cy - 36);
    g.strokeStyle = "#1f170f"; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
    g.strokeStyle = "rgba(190,160,110,.75)"; g.lineWidth = 1.2; g.strokeRect(9, 9, W - 18, H - 18);
    return c;
  }
  const base = () => (baseC = baseC || paint());
  /* each frame, under the fog: drifting ash, the volcano's live plume; returns how dark the night is (like MAPART.ambient) */
  function ambient(g, v, s, W2, H2, view) {
    const nowS = Date.now() / 1000, dark = typeof MAPART !== "undefined" ? MAPART.darkness(nowS) : 0, t = v.reduceMotion ? 0 : v.t;
    const [vx0, vy0, vx1, vy1] = view;
    if (vx1 > 0.82 * W && vy1 > 0.75 * H) redMountain(g, 0.965 * W, 1.0 * H, 1.15, t, !!v.reduceMotion);
    if (!v.reduceMotion) {
      g.fillStyle = v.weather === "ashstorm" ? "rgba(70,62,56,.7)" : "rgba(96,88,82,.45)";
      const n = v.weather === "ashstorm" ? 140 : 60;
      for (let i = 0; i < n; i++) {
        const x = ((i * 97.3 + t * (14 + (i % 5) * 4)) % (W + 40)) - 20, y = 0.45 * H + ((i * 61.7) % (0.5 * H)) + Math.sin(t * 0.8 + i) * 6;
        if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
        g.fillRect(x, y, 1.6 * s, 1.6 * s);
      }
    }
    return dark;
  }

  // ================================================================ place pictures
  const snowLine = () => SOLW.snowLine;
  const climateOf = (p) => (p[1] - OY() < snowLine() ? "snow" : "ash");
  /* the ash wastes under a place: drifts, dead trees, Red Mountain smoking on the horizon */
  function ashGround(g, H2, w, h, r = rng("ag")) {
    redMountain(g, w * 0.84, h * 0.64, 0.5);
    g.strokeStyle = "rgba(70,62,56,.5)"; g.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) { const x = r() * w, y = h * (0.74 + r() * 0.22), l = 14 + r() * 26; g.beginPath(); g.moveTo(x - l, y); g.quadraticCurveTo(x, y - 5, x + l, y); g.stroke(); }
    for (let i = 0; i < 3; i++) { const x = r() * w, y = h * (0.72 + r() * 0.06); g.strokeStyle = "#2e2622"; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 22); g.moveTo(x, y - 12); g.lineTo(x - 8, y - 20); g.moveTo(x, y - 16); g.lineTo(x + 7, y - 25); g.stroke(); }
  }
  function land(g, H2, w, h, clim, seed) {
    const r = rng(seed);
    H2.mountains(g, w, h * 0.64, h * 0.34, seed + "m", clim === "snow" ? "#9aa3a8" : "#5e524a", clim === "snow");
    if (clim === "ash") redMountain(g, w * 0.84, h * 0.64, 0.5);
    g.fillStyle = clim === "snow" ? "#e6ebee" : "#8f857b"; g.beginPath(); g.moveTo(0, h * 0.68);
    for (let x = 0; x <= w; x += 20) g.lineTo(x, h * 0.68 + (r() - 0.5) * 5);
    g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
    H2.inkPath(g, [[0, h * 0.68], [w, h * 0.68]], false, 1, "rgba(59,44,30,0.4)");
    if (clim === "snow") { H2.pines(g, w, h * 0.7, 9, seed + "p", 12); g.fillStyle = "rgba(255,255,255,.8)"; for (let i = 0; i < 12; i++) g.fillRect(r() * w, h * (0.72 + r() * 0.25), 10, 2); }
    else { g.strokeStyle = "rgba(70,62,56,.5)"; g.lineWidth = 1.2; for (let i = 0; i < 8; i++) { const x = r() * w, y = h * (0.74 + r() * 0.22), l = 14 + r() * 24; g.beginPath(); g.moveTo(x - l, y); g.quadraticCurveTo(x, y - 5, x + l, y); g.stroke(); } }
  }
  const poly = (g, H2, pts, fill, stroke = P.ink, wd = 1.2) => H2.poly(g, pts, fill, stroke, wd);
  const glow = (g, x, y, rad, rgb, a) => { const gl = g.createRadialGradient(x, y, 1, x, y, rad); gl.addColorStop(0, `rgba(${rgb},${a})`); gl.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gl; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
  /* a Dunmer house: a rounded shell of resin and bone */
  function shell(g, H2, x, base, s, col = "#c9b48e") {
    poly(g, H2, [[x - 18 * s, base], [x - 16 * s, base - 14 * s], [x - 8 * s, base - 22 * s], [x + 8 * s, base - 22 * s], [x + 16 * s, base - 14 * s], [x + 18 * s, base]], col);
    H2.inkPath(g, [[x - 14 * s, base - 12 * s], [x + 14 * s, base - 12 * s]], false, 0.8, "rgba(59,44,30,.5)");
    g.fillStyle = "#2a1e16"; g.fillRect(x - 3 * s, base - 9 * s, 6 * s, 9 * s);
    g.fillStyle = "#e8b04a"; g.fillRect(x - 11 * s, base - 16 * s, 3 * s, 3 * s); g.fillRect(x + 8 * s, base - 16 * s, 3 * s, 3 * s);
  }
  function figure(g, H2, x, base, s, o = {}) {   // a small standing person
    const body = o.body || P.leather;
    poly(g, H2, [[x - 5 * s, base], [x - 6 * s, base - 18 * s], [x + 6 * s, base - 18 * s], [x + 5 * s, base]], body, P.ink, 1);
    if (o.hood) poly(g, H2, [[x - 7 * s, base - 17 * s], [x - 6.5 * s, base - 25 * s], [x, base - 30 * s], [x + 6.5 * s, base - 25 * s], [x + 7 * s, base - 17 * s]], o.hood, P.ink, 1);
    H2.circle(g, x, base - 22 * s, 4.2 * s, o.mask || o.skin || P.skin[0], P.ink, 1);
    if (o.mask) { g.fillStyle = "#1a1410"; g.fillRect(x - 2.4 * s, base - 23 * s, 1.6 * s, 1.2 * s); g.fillRect(x + 0.8 * s, base - 23 * s, 1.6 * s, 1.2 * s); H2.inkPath(g, [[x - 2 * s, base - 19.5 * s], [x + 2 * s, base - 19.5 * s]], false, 0.8); }
    if (o.blade) H2.inkPath(g, [[x + 6 * s, base - 12 * s], [x + 16 * s, base - 22 * s]], false, 1.8 * s, o.blade);
  }
  const SYMBOL = { "Earth Stone": "earth", "Water Stone": "water", "Wind Stone": "wind", "Beast Stone": "beast", "Sun Stone": "sun", "Tree Stone": "tree" };
  function allMaker(g, H2, w, h, name, freed = false) {
    const x = w * 0.5, base = h * 0.78, clim = climateOf(WORLD.places[name] || [0, 3]);
    land(g, H2, w, h, clim, name);
    poly(g, H2, [[x - 16, base], [x - 18, base - 60], [x - 8, base - 80], [x + 9, base - 78], [x + 18, base - 58], [x + 16, base]], "#8a8f92");
    const sym = SYMBOL[name] || "earth"; g.strokeStyle = freed ? "#bfe6ff" : "#5a5f62"; g.lineWidth = 2.2; g.beginPath();
    const cy = base - 44;
    if (sym === "earth") { g.moveTo(x - 9, cy + 8); g.lineTo(x - 2, cy - 6); g.lineTo(x + 3, cy + 2); g.lineTo(x + 9, cy + 8); }
    if (sym === "water") for (let k = 0; k < 3; k++) { g.moveTo(x - 9, cy - 6 + k * 6); g.quadraticCurveTo(x - 4, cy - 10 + k * 6, x, cy - 6 + k * 6); g.quadraticCurveTo(x + 4, cy - 2 + k * 6, x + 9, cy - 6 + k * 6); }
    if (sym === "wind") { g.arc(x, cy, 8, 0.2, 5.2); g.moveTo(x + 3, cy); g.arc(x, cy, 3, 0, 4.5); }
    if (sym === "beast") for (let k = -1; k <= 1; k++) { g.moveTo(x + k * 5, cy - 9); g.lineTo(x + k * 5 - 3, cy + 9); }
    if (sym === "sun") { g.arc(x, cy, 5, 0, 7); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.moveTo(x + Math.cos(a) * 7, cy + Math.sin(a) * 7); g.lineTo(x + Math.cos(a) * 11, cy + Math.sin(a) * 11); } }
    if (sym === "tree") { g.moveTo(x, cy + 10); g.lineTo(x, cy - 8); g.moveTo(x, cy - 2); g.lineTo(x - 7, cy - 9); g.moveTo(x, cy); g.lineTo(x + 7, cy - 7); }
    g.stroke();
    if (freed) glow(g, x, cy, 40, "170,220,255", 0.4);
    else {   // Miraak's black stone climbing around it, and an entranced worker
      g.strokeStyle = "#1a1612"; g.lineWidth = 4;
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(x + sd * 30, base); g.quadraticCurveTo(x + sd * 34, base - 50, x + sd * 12, base - 86); g.stroke(); }
      glow(g, x, base - 86, 18, "120,210,140", 0.35);
      figure(g, H2, w * 0.24, base + 6, 1, { body: "#5a4a3a", hood: "#4a3a2e" }); figure(g, H2, w * 0.76, base + 6, 1, { body: "#6a5a44" });
    }
  }
  const CITY = {
    "Raven Rock"(g, H2, w, h) {   // the Bulwark, Dunmer shell houses, the docks
      land(g, H2, w, h, "ash", "rr");
      g.fillStyle = P.water; g.fillRect(w * 0.78, h * 0.66, w * 0.22, h * 0.08);
      for (let i = 0; i < 4; i++) { g.fillStyle = P.wood; g.fillRect(w * 0.8 + i * 14, h * 0.66, 3, 12); } g.fillRect(w * 0.78, h * 0.66, w * 0.2, 3);
      poly(g, H2, [[w * 0.86, h * 0.66], [w * 0.88, h * 0.5], [w * 0.9, h * 0.66]], "#e9dcc0"); H2.inkPath(g, [[w * 0.88, h * 0.66], [w * 0.88, h * 0.42]], false, 1.6, P.wood);   // the Northern Maiden's sail
      // the Bulwark: a great curved wall of stone ribs
      const bx0 = w * 0.04, bx1 = w * 0.62, by = h * 0.7;
      poly(g, H2, [[bx0, by], [bx0 + 6, h * 0.36], [w * 0.2, h * 0.3], [w * 0.42, h * 0.3], [bx1 - 6, h * 0.38], [bx1, by]], "#8a7562");
      for (let k = 0; k < 7; k++) { const x = bx0 + 16 + k * (bx1 - bx0 - 30) / 6; poly(g, H2, [[x - 7, by], [x - 6, h * 0.34], [x + 6, h * 0.34], [x + 7, by]], "#9c8670", P.ink, 1); }
      H2.inkPath(g, [[bx0 + 4, h * 0.42], [bx1 - 4, h * 0.44]], false, 2, "#5a4a3c");
      g.fillStyle = "#2a1e16"; g.beginPath(); g.arc(w * 0.33, by, 14, Math.PI, 0); g.fill();   // the gate
      shell(g, H2, w * 0.7, h * 0.76, 1.1); shell(g, H2, w * 0.5, h * 0.86, 1.3, "#bda784"); shell(g, H2, w * 0.18, h * 0.88, 1.2, "#c4ae88");
      for (const x of [w * 0.62, w * 0.4]) { H2.inkPath(g, [[x, h * 0.9], [x, h * 0.7]], false, 2, "#6a5040"); H2.circle(g, x, h * 0.69, 3.5, "#e8b04a", P.ink, 1); glow(g, x, h * 0.69, 14, "232,176,74", 0.35); }
    },
    "Tel Mithryn"(g, H2, w, h) {   // Neloth's mushroom tower
      land(g, H2, w, h, "ash", "tm");
      const mush = (x, base, s, cap) => { poly(g, H2, [[x - 5 * s, base], [x - 4 * s, base - 50 * s], [x + 4 * s, base - 50 * s], [x + 5 * s, base]], "#c8b89a"); poly(g, H2, [[x - 22 * s, base - 46 * s], [x - 14 * s, base - 60 * s], [x, base - 64 * s], [x + 14 * s, base - 60 * s], [x + 22 * s, base - 46 * s]], cap); for (let k = 0; k < 3; k++) { g.fillStyle = "#f0c860"; g.fillRect(x - 2 * s, base - (14 + k * 12) * s, 3 * s, 4 * s); } };
      mush(w * 0.2, h * 0.86, 0.9, "#9c7a62"); mush(w * 0.8, h * 0.84, 0.8, "#8a6a8e");
      const x = w * 0.5, b = h * 0.9;   // the great tower
      poly(g, H2, [[x - 14, b], [x - 10, b - 60], [x - 6, b - 94], [x + 6, b - 94], [x + 10, b - 60], [x + 14, b]], "#d8c8a6");
      for (const [yy, rr, col] of [[b - 50, 30, "#a78a6a"], [b - 78, 24, "#8f6f8f"], [b - 100, 34, "#9c7a62"]]) poly(g, H2, [[x - rr, yy + 4], [x - rr * 0.6, yy - 10], [x, yy - 14], [x + rr * 0.6, yy - 10], [x + rr, yy + 4]], col);
      for (let k = 0; k < 4; k++) { g.fillStyle = "#f5d27a"; g.fillRect(x - 2, b - 18 - k * 19, 4, 6); glow(g, x, b - 15 - k * 19, 10, "245,210,122", 0.3); }
    },
    "Skaal Village"(g, H2, w, h) {   // round Skaal lodges under snow, the great hall, smoke from the fires
      land(g, H2, w, h, "snow", "sk");
      g.fillStyle = P.sea; g.fillRect(0, h * 0.62, w * 0.18, h * 0.08);
      const lodge = (x, base, s) => { poly(g, H2, [[x - 20 * s, base], [x - 20 * s, base - 14 * s], [x + 20 * s, base - 14 * s], [x + 20 * s, base]], "#7a5232"); poly(g, H2, [[x - 24 * s, base - 12 * s], [x, base - 32 * s], [x + 24 * s, base - 12 * s]], "#f2f5f7"); H2.inkPath(g, [[x - 10 * s, base - 18 * s], [x, base - 26 * s], [x + 10 * s, base - 18 * s]], false, 1, "rgba(59,44,30,.4)"); g.fillStyle = "#2a1e16"; g.fillRect(x - 3 * s, base - 9 * s, 6 * s, 9 * s); for (let k = 0; k < 4; k++) { g.fillStyle = `rgba(200,204,210,${0.5 - k * 0.1})`; g.beginPath(); g.arc(x + 8 * s + k * 4, base - 34 * s - k * 9, 4 + k * 2, 0, 7); g.fill(); } };
      lodge(w * 0.3, h * 0.82, 1); lodge(w * 0.72, h * 0.8, 1.1);
      const x = w * 0.52, b = h * 0.86;   // the great hall with its carved dragon-head gables
      poly(g, H2, [[x - 40, b], [x - 40, b - 22], [x + 40, b - 22], [x + 40, b]], "#6a4a2e");
      poly(g, H2, [[x - 46, b - 20], [x, b - 48], [x + 46, b - 20]], "#f2f5f7");
      for (const sd of [-1, 1]) H2.inkPath(g, [[x + sd * 6, b - 46], [x + sd * 14, b - 56], [x + sd * 10, b - 48]], false, 2, P.wood);
      g.fillStyle = "#2a1e16"; g.fillRect(x - 6, b - 14, 12, 14);
      H2.inkPath(g, [[w * 0.9, b], [w * 0.9, b - 46]], false, 4, P.wood); for (let k = 0; k < 3; k++) H2.circle(g, w * 0.9, b - 12 - k * 12, 4, ["#8e2b25", "#3d5d36", "#d6b25e"][k], P.ink, 1);   // a totem
    },
    "Thirsk Mead Hall"(g, H2, w, h) {
      land(g, H2, w, h, "snow", "th");
      g.fillStyle = P.water; g.beginPath(); g.ellipse(w * 0.3, h * 0.82, w * 0.22, h * 0.05, 0, 0, 7); g.fill();
      const x = w * 0.6, b = h * 0.78;
      for (let k = 0; k < 6; k++) { g.fillStyle = P.wood; g.fillRect(x - 50 + k * 20, b - 4, 4, 16); }
      poly(g, H2, [[x - 56, b - 2], [x - 56, b - 26], [x + 56, b - 26], [x + 56, b - 2]], "#7a5232");
      poly(g, H2, [[x - 62, b - 24], [x - 40, b - 50], [x + 40, b - 50], [x + 62, b - 24]], "#e8ecee");
      g.fillStyle = "#2a1e16"; g.fillRect(x - 7, b - 18, 14, 16); g.fillStyle = "#e8b04a"; g.fillRect(x - 34, b - 18, 6, 5); g.fillRect(x + 28, b - 18, 6, 5);
    },
    "Temple of Miraak"(g, H2, w, h) {   // a stepped temple of dark stone, a Black Book pillar breathing green light
      land(g, H2, w, h, "snow", "tom");
      const x = w * 0.5, b = h * 0.8;
      for (let k = 0; k < 4; k++) { const ww = 120 - k * 26, hh = 14; poly(g, H2, [[x - ww / 2, b - k * hh], [x - ww / 2 + 4, b - (k + 1) * hh], [x + ww / 2 - 4, b - (k + 1) * hh], [x + ww / 2, b - k * hh]], k % 2 ? "#4a4440" : "#55504a"); }
      for (const sd of [-1, 1]) poly(g, H2, [[x + sd * 22, b - 56], [x + sd * 30, b - 92], [x + sd * 34, b - 56]], "#3a3430");
      g.fillStyle = "#161210"; g.beginPath(); g.arc(x, b - 56, 10, Math.PI, 0); g.fill();
      glow(g, x, b - 60, 40, "110,200,120", 0.35);
      g.strokeStyle = "#1a1410"; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x - 6 + k * 4, b - 60); g.bezierCurveTo(x - 30 + k * 20, b - 90, x + 20 - k * 14, b - 110, x - 10 + k * 8, b - 130); g.stroke(); }
      figure(g, H2, w * 0.2, h * 0.9, 1.1, { body: "#3a2e24", mask: "#c9a24c", hood: "#2a221c" });
    },
    "Fort Frostmoth"(g, H2, w, h) {
      land(g, H2, w, h, "ash", "ff");
      g.fillStyle = P.sea; g.fillRect(w * 0.7, h * 0.64, w * 0.3, h * 0.06);
      for (const [x, ww, hh] of [[w * 0.18, 70, 46], [w * 0.42, 56, 30], [w * 0.62, 36, 54]]) { poly(g, H2, [[x, h * 0.84], [x, h * 0.84 - hh], [x + 8, h * 0.84 - hh - 6], [x + ww * 0.5, h * 0.84 - hh + 4], [x + ww, h * 0.84 - hh - 2], [x + ww, h * 0.84]], "#8f8a80"); for (let k = 0; k < 3; k++) g.fillRect(x + 6 + k * (ww / 3), h * 0.84 - hh - 2, 6, 5); }
      for (let i = 0; i < 3; i++) glow(g, w * (0.3 + i * 0.2), h * 0.86, 18, "230,120,60", 0.3);
    },
    "Raven Rock Mine"(g, H2, w, h) {
      land(g, H2, w, h, "ash", "rrm");
      poly(g, H2, [[w * 0.2, h * 0.7], [w * 0.35, h * 0.34], [w * 0.65, h * 0.3], [w * 0.82, h * 0.7]], "#6e6258");
      g.fillStyle = "#1c1612"; g.fillRect(w * 0.45, h * 0.52, w * 0.12, h * 0.18);
      g.fillStyle = P.wood; g.fillRect(w * 0.44, h * 0.5, w * 0.14, 5); g.fillRect(w * 0.44, h * 0.5, 5, h * 0.2); g.fillRect(w * 0.57, h * 0.5, 5, h * 0.2);
      H2.inkPath(g, [[w * 0.3, h * 0.92], [w * 0.5, h * 0.7]], false, 2, "#6a5a4a");
    },
    Frossel(g, H2, w, h) {
      land(g, H2, w, h, "snow", "fr");
      const x = w * 0.5, b = h * 0.82;
      poly(g, H2, [[x - 14, b], [x - 12, b - 80], [x + 12, b - 80], [x + 14, b]], "#b8893e");
      poly(g, H2, [[x - 22, b - 78], [x, b - 96], [x + 22, b - 78]], "#c9a24c");
      for (let k = 0; k < 3; k++) H2.circle(g, x, b - 20 - k * 20, 5, "#7a5a2a", P.ink, 1);
    },
    "Brodir Grove"(g, H2, w, h) { land(g, H2, w, h, "snow", "bg"); H2.pines(g, w, h * 0.86, 14, "bgp", 22); },
  };
  for (const n of Object.keys(SYMBOL)) CITY[n] = (g, H2, w, h) => allMaker(g, H2, w, h, n, false);
  if (typeof PLACEART !== "undefined") Object.assign(PLACEART.CITY, CITY);
  if (typeof PLACEART !== "undefined") {   // the island's own dungeon themes: an ash-choked cave mouth, and Miraak's temple
    PLACEART.THEME.ashcave = (g, H2, w, h, clim) => { PLACEART.THEME.cave(g, H2, w, h, clim); g.fillStyle = "rgba(110,100,92,.35)"; g.fillRect(0, h * 0.72, w, h * 0.28); glow(g, w / 2, h * 0.66, 30, "230,120,60", 0.25); };
    PLACEART.THEME.miraak = PLACEART.THEME.temple;
  }
  // the docks banner in the Area tab
  if (typeof PLACEART !== "undefined") PLACEART.SECTION.docks = (g, H2, w, h) => {
    H2.sky(g, w, h, "dusk"); g.fillStyle = P.sea; g.fillRect(0, h * 0.55, w, h * 0.45);
    g.strokeStyle = "rgba(255,255,255,.3)"; for (let i = 0; i < 10; i++) { const x = (i * 41) % w, y = h * 0.62 + (i * 7) % (h * 0.3); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y); g.stroke(); }
    ship(g, H2, w * 0.62, h * 0.66, 1);
    g.fillStyle = P.wood; g.fillRect(0, h * 0.62, w * 0.36, 6); for (let k = 0; k < 6; k++) g.fillRect(k * w * 0.06, h * 0.62, 4, h * 0.38);
    for (let k = 0; k < 3; k++) poly(g, H2, [[w * 0.04 + k * 22, h * 0.62], [w * 0.04 + k * 22, h * 0.48], [w * 0.04 + k * 22 + 16, h * 0.48], [w * 0.04 + k * 22 + 16, h * 0.62]], ["#8a6a44", "#7a5a3a", "#9a7a50"][k]);   // crates
  };
  function ship(g, H2, x, y, s) {
    poly(g, H2, [[x - 60 * s, y - 10 * s], [x + 66 * s, y - 10 * s], [x + 50 * s, y + 10 * s], [x - 48 * s, y + 10 * s]], "#6a4a2e");
    H2.inkPath(g, [[x - 56 * s, y - 4 * s], [x + 60 * s, y - 4 * s]], false, 1, "rgba(233,220,192,.6)");
    for (const [mx, mh, sw] of [[-14, 64, 30], [22, 52, 24]]) {
      H2.inkPath(g, [[x + mx * s, y - 10 * s], [x + mx * s, y - (10 + mh) * s]], false, 2.2 * s, P.wood);
      poly(g, H2, [[x + mx * s - sw * s * 0.5, y - (14 + mh * 0.9) * s], [x + mx * s + sw * s * 0.5, y - (14 + mh * 0.9) * s], [x + mx * s + sw * s * 0.56, y - 18 * s], [x + mx * s - sw * s * 0.5, y - 18 * s]], "#e9dcc0", P.ink, 1);
    }
    poly(g, H2, [[x + 22 * s, y - 62 * s], [x + 34 * s, y - 58 * s], [x + 22 * s, y - 54 * s]], "#3a5a8a", P.ink, 0.8);   // Windhelm's colours
  }
  /* the trip panel at sea: the Northern Maiden under way (an <img> string) */
  function sea() {
    return ART.html(360, 90, (g, H2, w, h) => {
      H2.sky(g, w, h, (typeof G !== "undefined" && G.isNight()) ? "night" : "dusk");
      g.fillStyle = "#2a4350"; g.fillRect(0, h * 0.55, w, h * 0.45);
      g.strokeStyle = "rgba(220,235,240,.35)"; g.lineWidth = 1; for (let i = 0; i < 18; i++) { const x = (i * 53) % w, y = h * 0.6 + (i * 11) % (h * 0.36); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 2, x + 14, y); g.stroke(); }
      redMountain(g, w * 0.92, h * 0.58, 0.32);
      ship(g, H2, w * 0.42, h * 0.66, 0.62);
      g.strokeStyle = P.ink; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
    }, { key: "sol|sea|" + ((typeof G !== "undefined" && G.isNight()) ? "n" : "d"), cls: "scene sec", alt: "At sea" });
  }

  // ================================================================ story scenes
  const STORY = {
    cultists(g, H2, w, h) {   // the Raven Rock docks at dusk: Miraak's cultists coming up the pier
      H2.sky(g, w, h, "dusk"); g.fillStyle = "rgba(90,80,74,.35)"; g.fillRect(0, 0, w, h);
      redMountain(g, w * 0.88, h * 0.6, 0.45);
      g.fillStyle = P.sea; g.fillRect(0, h * 0.6, w, h * 0.4);
      g.fillStyle = P.wood; g.fillRect(w * 0.1, h * 0.72, w * 0.8, 8); for (let k = 0; k < 9; k++) g.fillRect(w * 0.1 + k * w * 0.1, h * 0.72, 4, h * 0.28);
      ship(g, H2, w * 0.16, h * 0.7, 0.55);
      for (const [x, s] of [[0.56, 1.25], [0.7, 1.4], [0.84, 1.2]]) figure(g, H2, w * x, h * 0.72, s, { body: "#3a2e24", hood: "#2a221c", mask: "#c9a24c", blade: "#a9b0b4" });
      figure(g, H2, w * 0.36, h * 0.72, 1.3, { body: P.steel, skin: P.skin[0] });
      glow(g, w * 0.7, h * 0.4, 50, "120,210,140", 0.18);
    },
    miraak(g, H2, w, h) {   // Apocrypha: green-black sky, drifting pages, Miraak in his gold mask on the summit
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#0e1a12"); gr.addColorStop(1, "#2a3a22"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const r = rng("apoc");
      for (let i = 0; i < 16; i++) { const x = r() * w, y = r() * h * 0.6; poly(g, H2, [[x, y], [x + 8, y - 2], [x + 9, y + 6], [x + 1, y + 8]], "#d8d0b0", "#3a3a2a", 0.6); }
      g.strokeStyle = "#0a0e0a"; g.lineWidth = 6; for (let k = 0; k < 6; k++) { const x0 = r() * w; g.beginPath(); g.moveTo(x0, h); g.bezierCurveTo(x0 - 30, h * 0.6, x0 + 40, h * 0.4, x0 + (r() - 0.5) * 60, h * 0.2); g.stroke(); }
      poly(g, H2, [[w * 0.3, h], [w * 0.42, h * 0.72], [w * 0.58, h * 0.72], [w * 0.7, h]], "#2a2a22");
      glow(g, w * 0.5, h * 0.5, 70, "150,230,140", 0.3);
      figure(g, H2, w * 0.5, h * 0.74, 2, { body: "#4a3a28", hood: "#3a2e20", mask: "#d6b25e" });
      for (const sd of [-1, 1]) { g.strokeStyle = "rgba(20,30,20,.9)"; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.5 + sd * 8, h * 0.5); g.quadraticCurveTo(w * 0.5 + sd * 40, h * 0.36, w * 0.5 + sd * 26, h * 0.22); g.stroke(); }
    },
    allmaker(g, H2, w, h) { allMaker(g, H2, w, h, "Earth Stone", true); },
  };
  if (typeof UIART !== "undefined" && UIART.QUEST) UIART.QUEST.dragonborn = (g) => {   // the quest icon: Miraak's gold mask over a black book
    g.fillStyle = "rgba(120,210,140,.35)"; g.beginPath(); g.arc(20, 20, 15, 0, 7); g.fill();
    H0.poly(g, [[9, 30], [31, 30], [31, 36], [9, 36]], "#2a2218", P.ink, 1);
    H0.poly(g, [[13, 9], [20, 5], [27, 9], [26, 24], [20, 29], [14, 24]], "#d6b25e", P.ink, 1.2);
    g.fillStyle = "#1a1410"; g.fillRect(15.5, 14, 3.5, 2.5); g.fillRect(21, 14, 3.5, 2.5);
    for (const sd of [-1, 1]) H0.inkPath(g, [[20 + sd * 6, 8], [20 + sd * 12, 3], [20 + sd * 13, 10]], false, 1.4, "#2a3a22");
  };
  if (typeof EVENTART !== "undefined") { Object.assign(EVENTART.STORY, STORY); EVENTART.GROUND["Ash wastes"] = ["#8f857b", "dusk"]; }
  function storyKind(t, x) {
    if (!/Quest/i.test(t)) return null;
    if (/cultist/i.test(x) && /Raven Rock|Dragonborn/i.test(x)) return "cultists";
    if (/Miraak|Black Book|Apocrypha|Hermaeus/i.test(x)) return "miraak";
    if (/(Earth|Water|Wind|Beast|Sun|Tree) Stone|Bend Will/i.test(x)) return "allmaker";
    return null;
  }

  // ================================================================ the island's creatures in fights
  function foeKind(n) {
    n = String(n || "").toLowerCase();
    if (/ash hopper/.test(n)) return "sol_hopper";
    if (/netch/.test(n)) return "sol_netch";
    if (/riekling/.test(n)) return "sol_riekling";
    if (/lurker/.test(n)) return "sol_lurker";
    if (/ash spawn/.test(n)) return "sol_spawn";
    if (/burnt spriggan/.test(n)) return "sol_spriggan";
    if (/seeker/.test(n)) return "sol_seeker";
    if (/^miraak$/.test(n)) return "sol_miraak";
    if (/cultist|miraak's thralls/.test(n)) return "sol_cultist";
    return null;
  }
  const H0 = ART.H;
  function foeFig(g, kind, lunge, glowT, K) {
    if (!String(kind).startsWith("sol_")) return false;
    const t = glowT || 0;
    switch (kind) {
      case "sol_riekling": g.save(); g.scale(0.72, 0.72); K.humanoid({ skin: "#8fb0c8", body: "#6a5a44", head: "horned", helmColor: "#e9dcc0", wt: "spear", eyes: "#1a1410" }); g.restore(); return true;
      case "sol_cultist": K.humanoid({ skin: "#c9a24c", body: "#3a2e24", legs: "robe", head: "mask", wt: "sword", cape: "#2a221c" }); return true;
      case "sol_miraak": g.save(); g.scale(1.15, 1.15); K.humanoid({ skin: "#d6b25e", body: "#4a3a28", legs: "robe", head: "mask", wt: "sword", eyes: "#9fe08a", cape: "#2e2418" }); g.restore();
        g.strokeStyle = "rgba(20,30,20,.85)"; g.lineWidth = 3; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 8, -56); g.quadraticCurveTo(sd * (34 + Math.sin(t * 3) * 4), -80, sd * 22, -104); g.stroke(); } return true;
      case "sol_spawn": K.humanoid({ skin: "#5a524c", body: "#4a423c", head: "skull", wt: "sword", eyes: "#ff9a40", arm: "#5a524c", hunch: 0.15 });
        for (let i = 0; i < 4; i++) { const a = t * 2 + i * 1.6; H0.circle(g, Math.cos(a) * 14, -40 + Math.sin(a) * 18, 1.6, "#ff9a40", null); } return true;
      case "sol_spriggan": K.humanoid({ skin: "#3a2e26", body: "#2e241e", head: "feathers", wt: "fist", eyes: "#ffb040", arm: "#3a2e26" }); return true;
      case "sol_hopper": return K.quad({ color: "#6e6a52", len: 26, height: 22, head: 6, legW: 2, tail: "long", eye: "#c4572e" }), true;
      case "sol_netch": {   // a floating bladder with trailing tendrils
        const y = -62 + Math.sin(t * 2) * 4;
        g.strokeStyle = "#7a6a8a"; g.lineWidth = 2; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 6, y + 12); g.quadraticCurveTo(k * 7 + Math.sin(t * 3 + k) * 4, y + 34, k * 5 + lunge * 0.2, y + 58); g.stroke(); }
        H0.poly(g, [[-30, y + 10], [-26, y - 14], [-8, y - 24], [14, y - 22], [30, y - 8], [28, y + 12]], "#a690b0", P.ink, 1.6);
        H0.inkPath(g, [[-20, y - 4], [20, y - 6]], false, 1, "rgba(59,44,30,.5)"); return true;
      }
      case "sol_lurker": {   // hulking, horned, tentacles for a face
        g.save(); g.scale(1.45, 1.45);
        H0.poly(g, [[-16, 0], [-20, -34], [-12, -52], [12, -52], [20, -34], [16, 0]], "#2e3a2a", P.ink, 1.6);
        for (const sd of [-1, 1]) H0.poly(g, [[sd * 10, -50], [sd * 22, -66], [sd * 14, -48]], "#1e2a1a", P.ink, 1);
        g.strokeStyle = "#3e5a36"; g.lineWidth = 2.4; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(10, -40 + k * 3); g.quadraticCurveTo(22 + lunge * 0.3, -36 + k * 6 + Math.sin(t * 4 + k) * 3, 30 + lunge * 0.4, -30 + k * 8); g.stroke(); }
        H0.circle(g, 6, -44, 2, "#9fe08a", null); g.restore(); return true;
      }
      case "sol_seeker": {
        const y = -50 + Math.sin(t * 2.4) * 5;
        H0.poly(g, [[-14, y + 26], [-12, y - 10], [0, y - 22], [12, y - 10], [14, y + 26]], "#3a3a28", P.ink, 1.4);
        for (let k = -2; k <= 2; k++) { g.strokeStyle = "#2a2a1e"; g.lineWidth = 2; g.beginPath(); g.moveTo(k * 5, y + 24); g.quadraticCurveTo(k * 8, y + 40, k * 6 + Math.sin(t * 3 + k) * 5, y + 50); g.stroke(); }
        for (let i = 0; i < 4; i++) H0.circle(g, -6 + i * 4, y - 8 + (i % 2) * 3, 1.5, "#d8f0a0", null); return true;
      }
    }
    return false;
  }
  // ---- enemy icons (40×40, like iconart.js's FACES)
  const faceKind = foeKind;
  const c2 = (g, x, y, r, fill, stroke = P.ink, wd = 1.2) => H0.circle(g, x, y, r, fill, stroke, wd);
  const p2 = (g, pts, fill, stroke = P.ink, wd = 1.2) => H0.poly(g, pts, fill, stroke, wd);
  const FACES = {
    sol_riekling: (g) => { c2(g, 20, 22, 10, "#8fb0c8"); p2(g, [[9, 16], [12, 6], [20, 4], [28, 6], [31, 16], [26, 12], [14, 12]], "#e9dcc0"); for (const sd of [-1, 1]) p2(g, [[20 + sd * 9, 9], [20 + sd * 16, 2], [20 + sd * 12, 12]], "#e9dcc0"); c2(g, 16, 21, 1.6, "#1a1410", null); c2(g, 24, 21, 1.6, "#1a1410", null); p2(g, [[17, 27], [23, 27], [20, 30]], "#f4efe0", null); },
    sol_cultist: (g) => { p2(g, [[7, 40], [10, 22], [20, 4], [30, 22], [33, 40]], "#2a221c"); p2(g, [[12, 14], [20, 8], [28, 14], [27, 28], [20, 33], [13, 28]], "#c9a24c"); g.fillStyle = "#1a1410"; g.fillRect(15, 18, 4, 3); g.fillRect(21, 18, 4, 3); for (let k = 0; k < 3; k++) H0.inkPath(g, [[16 + k * 4, 25], [16 + k * 4, 30]], false, 0.8); },
    sol_miraak: (g) => { p2(g, [[6, 40], [9, 22], [20, 3], [31, 22], [34, 40]], "#3a2e20"); p2(g, [[11, 12], [20, 5], [29, 12], [28, 28], [20, 34], [12, 28]], "#d6b25e"); g.fillStyle = "#9fe08a"; g.fillRect(15, 17, 4, 3); g.fillRect(21, 17, 4, 3); for (const sd of [-1, 1]) H0.inkPath(g, [[20 + sd * 8, 8], [20 + sd * 16, 2], [20 + sd * 18, 12]], false, 1.6, "#2a3a22"); },
    sol_spawn: (g) => { c2(g, 20, 19, 11, "#5a524c"); for (let i = 0; i < 6; i++) c2(g, 8 + i * 5, 32 + (i % 2) * 3, 2, "#3e3832", null); c2(g, 16, 18, 2.4, "#ff9a40", null); c2(g, 24, 18, 2.4, "#ff9a40", null); p2(g, [[15, 25], [25, 25], [22, 29], [18, 29]], "#2a2420", null); },
    sol_spriggan: (g) => { p2(g, [[12, 36], [10, 18], [14, 6], [20, 3], [26, 6], [30, 18], [28, 36]], "#3a2e26"); for (const x of [12, 16, 24, 28]) H0.inkPath(g, [[x, 8], [x + (x < 20 ? -4 : 4), 1]], false, 1.6, "#2a201a"); c2(g, 16.5, 17, 2.2, "#ffb040", null); c2(g, 23.5, 17, 2.2, "#ffb040", null); },
    sol_hopper: (g) => { p2(g, [[6, 26], [14, 14], [28, 14], [34, 24], [26, 30], [12, 30]], "#6e6a52"); for (const sd of [-1, 1]) H0.inkPath(g, [[20 + sd * 6, 28], [20 + sd * 12, 36], [20 + sd * 16, 30]], false, 1.4); c2(g, 27, 19, 2, "#c4572e", null); H0.inkPath(g, [[30, 14], [34, 6]], false, 1); H0.inkPath(g, [[27, 14], [29, 5]], false, 1); },
    sol_netch: (g) => { p2(g, [[6, 20], [9, 8], [20, 4], [31, 8], [34, 20]], "#a690b0"); for (let k = 0; k < 6; k++) H0.inkPath(g, [[9 + k * 4.5, 20], [8 + k * 4.5, 30], [10 + k * 4.5, 38]], false, 1.2, "#7a6a8a"); },
    sol_lurker: (g) => { p2(g, [[8, 40], [8, 16], [14, 6], [26, 6], [32, 16], [32, 40]], "#2e3a2a"); for (const sd of [-1, 1]) p2(g, [[20 + sd * 8, 8], [20 + sd * 15, 0], [20 + sd * 12, 10]], "#1e2a1a"); for (let k = -2; k <= 2; k++) H0.inkPath(g, [[20 + k * 3, 24], [20 + k * 4, 32], [20 + k * 3.5, 38]], false, 1.6, "#3e5a36"); c2(g, 15, 18, 1.8, "#9fe08a", null); c2(g, 25, 18, 1.8, "#9fe08a", null); },
    sol_seeker: (g) => { p2(g, [[8, 38], [10, 14], [20, 4], [30, 14], [32, 38]], "#3a3a28"); for (let i = 0; i < 5; i++) c2(g, 13 + i * 3.5, 16 + (i % 2) * 4, 1.6, "#d8f0a0", null); for (let k = -2; k <= 2; k++) H0.inkPath(g, [[20 + k * 4, 28], [20 + k * 5, 38]], false, 1.2, "#2a2a1e"); },
  };
  return { base, ambient, climateOf, ashGround, sea, CITY, STORY, storyKind, foeKind, foeFig, faceKind, FACES, redMountain };
})();
