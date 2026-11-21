/* The world map. The painted base is drawn once (seeded, identical for everyone); fog, routes and markers each frame. */
const WorldMap = (() => {
  const W = 1000, H = 700, S = 2.4;          // painted at 2.4× so zooming in stays crisp
  const T = Terrain.T;
  const P = (p) => [p[0] * W, p[1] * H];
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const FONT = (size, w = 600, style = "") => `${style} ${w} ${size}px "Cormorant Garamond", Georgia, serif`;
  const COLORS = {   // painted ground colours by terrain
    [T.GRASS]: [190, 182, 132], [T.TUNDRA]: [203, 188, 138], [T.FOREST]: [128, 146, 96], [T.PINE]: [96, 122, 84],
    [T.AUTUMN]: [200, 150, 82], [T.MARSH]: [126, 140, 108], [T.SNOW]: [234, 236, 238], [T.VOLCANIC]: [150, 142, 122],
    [T.ROCKY]: [182, 152, 126], [T.MOUNTAIN]: [168, 156, 136], [T.PEAK]: [214, 216, 220],
  };
  let base = null;

  function smoothPath(g, pts, close) {
    g.beginPath();
    g.moveTo(...P(pts[0]));
    for (let i = 1; i < pts.length - 1; i++) { const [ax, ay] = P(pts[i]), [bx, by] = P(pts[i + 1]); g.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2); }
    g.lineTo(...P(pts[pts.length - 1]));
    if (close) g.closePath();
  }

  function drawBase() {
    const c = document.createElement("canvas");
    c.width = W * S; c.height = H * S;
    const g = c.getContext("2d");
    g.scale(S, S);
    const r = rng(11), u = (a, b) => a + r() * (b - a);
    const GW = Terrain.GW, GH = Terrain.GH, grid = Terrain.grid;

    // ---- sea
    const sea = g.createLinearGradient(0, 0, 0, H * 0.3);
    sea.addColorStop(0, "#1e3440"); sea.addColorStop(1, "#30505e");
    g.fillStyle = sea; g.fillRect(0, 0, W, H);

    // ---- land colour field (soft, like watercolour)
    const holds = Object.values(WORLD.holds);
    const cf = document.createElement("canvas"); cf.width = GW; cf.height = GH;
    const cg = cf.getContext("2d"), img = cg.createImageData(GW, GH);
    const region = new Uint8Array(GW * GH);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x, mx = (x + 0.5) * 4, my = (y + 0.5) * 4;
      let best = 0, bd = 1e12;
      holds.forEach((h, k) => { const d = (h[1][0] * W - mx) ** 2 + (h[1][1] * H - my) ** 2; if (d < bd) { bd = d; best = k; } });
      region[i] = best;
      let t = grid[i];
      if (t === T.SEA) { img.data[i * 4 + 3] = 0; continue; }
      if (t <= T.BRIDGE) t = T.GRASS;
      const col = COLORS[t] || COLORS[T.GRASS], tint = holds[best][2], n = Terrain.fbm(mx / 30, my / 30, 3) - 0.5;
      for (let k = 0; k < 3; k++) img.data[i * 4 + k] = Math.max(0, Math.min(255, col[k] * 0.86 + tint[k] * 0.14 + n * 34));
      img.data[i * 4 + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    const landPath = new Path2D();
    WORLD.coast.forEach((p, i) => { const [x, y] = P(p); i ? landPath.lineTo(x, y) : landPath.moveTo(x, y); });
    landPath.lineTo(W, H); landPath.lineTo(0, H); landPath.closePath();
    g.save(); g.clip(landPath);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(cf, 0, 0, W, H);

    // ---- hill shading from the height field (light from the north-west)
    const HW = 500, HH = 350, hs = document.createElement("canvas"); hs.width = HW; hs.height = HH;
    const hg = hs.getContext("2d"), himg = hg.createImageData(HW, HH), hf = new Float32Array(HW * HH);
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) hf[y * HW + x] = Terrain.heightAt([(x + 0.5) * 2, (y + 0.5) * 2]);
    for (let y = 1; y < HH - 1; y++) for (let x = 1; x < HW - 1; x++) {
      const i = y * HW + x, dx = hf[i + 1] - hf[i - 1], dy = hf[i + HW] - hf[i - HW];
      const shade = Math.max(-1, Math.min(1, (dx + dy) * 9));           // + = facing away from light
      const a = Math.min(0.55, Math.abs(shade) * 0.6) * Math.min(1, Math.max(0, hf[i] - 0.18) * 2.4);
      const lightSide = shade < 0;
      himg.data[i * 4] = lightSide ? 255 : 40; himg.data[i * 4 + 1] = lightSide ? 250 : 30; himg.data[i * 4 + 2] = lightSide ? 236 : 22;
      himg.data[i * 4 + 3] = a * 255 * (lightSide ? 0.75 : 1);
    }
    hg.putImageData(himg, 0, 0);
    g.drawImage(hs, 0, 0, W, H);

    // ---- paper grain and gentle colour mottling
    for (let i = 0; i < 14000; i++) { g.fillStyle = r() < 0.6 ? "rgba(70,52,30,.06)" : "rgba(255,252,240,.08)"; g.fillRect(u(0, W), u(0, H), u(0.6, 1.6), u(0.6, 1.6)); }
    for (let i = 0; i < 60; i++) { const x = u(0, W), y = u(0, H), rad = u(20, 70), gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, r() < 0.5 ? "rgba(120,90,50,.07)" : "rgba(255,248,230,.07)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }

    // ---- hold borders (dotted)
    g.fillStyle = "rgba(120,62,50,.6)";
    for (let y = 1; y < GH; y++) for (let x = 1; x < GW; x++) {
      const v = region[y * GW + x];
      if ((v !== region[y * GW + x - 1] || v !== region[(y - 1) * GW + x]) && (x + y) % 3 === 0 && grid[y * GW + x] !== T.SEA)
        { g.beginPath(); g.arc(x * 4, y * 4, 1.1, 0, 7); g.fill(); }
    }

    // ---- lakes
    for (const [lx, ly, rx, ry] of WORLD.lakes) {
      const x = lx * W, y = ly * H, ex = rx * W, ey = ry * H;
      g.fillStyle = "#5f8797"; g.beginPath(); g.ellipse(x, y, ex, ey, 0, 0, 7); g.fill();
      g.strokeStyle = "rgba(220,235,240,.35)"; g.lineWidth = 1; g.beginPath(); g.ellipse(x - ex * 0.15, y - ey * 0.2, ex * 0.6, ey * 0.45, 0, 3.6, 5.6); g.stroke();
      g.strokeStyle = "#3b2c1e"; g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, y, ex, ey, 0, 0, 7); g.stroke();
    }
    // ---- rivers (widening downstream)
    for (const rv of WORLD.rivers) {
      const pts = rv.pts;
      for (let i = 1; i < pts.length; i++) {
        const w = 1.4 + 2.6 * i / pts.length;
        g.strokeStyle = "#4f7f92"; g.lineWidth = w + 1.2; g.lineCap = "round";
        g.beginPath(); g.moveTo(...P(pts[i - 1])); g.lineTo(...P(pts[i])); g.stroke();
        g.strokeStyle = "#7fb0c0"; g.lineWidth = Math.max(0.6, w * 0.35);
        g.beginPath(); g.moveTo(...P(pts[i - 1])); g.lineTo(...P(pts[i])); g.stroke();
      }
    }

    // ---- painted glyphs (trees, peaks, reeds...), back to front
    const glyphs = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const t = grid[y * GW + x], px = x * 4 + u(0, 4), py = y * 4 + u(0, 4), h = Terrain.hgrid[y * GW + x];
      if ((t === T.PINE || t === T.FOREST) && r() < (t === T.PINE ? 0.42 : 0.34)) glyphs.push(["pine", px, py, u(3.2, 5.6), t === T.PINE]);
      else if (t === T.AUTUMN && r() < 0.3) glyphs.push(["round", px, py, u(2.6, 4.2)]);
      else if (t === T.SNOW && r() < 0.05) glyphs.push(["snowpine", px, py, u(3, 4.6)]);
      else if (t === T.MARSH && r() < 0.28) glyphs.push(["reed", px, py, u(2.5, 4)]);
      else if (t === T.VOLCANIC && r() < 0.06) glyphs.push(["steam", px, py, u(2, 4)]);
      else if ((t === T.TUNDRA || t === T.GRASS) && r() < 0.05) glyphs.push(["tuft", px, py, u(2, 3)]);
      else if (t === T.ROCKY && r() < 0.12) glyphs.push(["rock", px, py, u(1.6, 3)]);
      if ((t === T.MOUNTAIN || t === T.PEAK) && r() < 0.05 + h * 0.07) glyphs.push(["peak", px, py + 4, (9 + h * 15) * u(0.8, 1.2), h]);
    }
    glyphs.sort((a, b) => a[2] - b[2]);
    for (const [kind, x, y, s, extra] of glyphs) {
      if (kind === "pine") {
        g.fillStyle = "rgba(30,40,24,.28)"; g.beginPath(); g.ellipse(x + s * 0.4, y + s * 0.9, s * 0.8, s * 0.3, 0, 0, 7); g.fill();
        g.fillStyle = extra ? "#2f4f30" : "#3d5d36"; g.beginPath(); g.moveTo(x - s * 0.7, y + s * 0.8); g.lineTo(x, y - s * 1.4); g.lineTo(x + s * 0.7, y + s * 0.8); g.fill();
        g.fillStyle = extra ? "#45683f" : "#557a47"; g.beginPath(); g.moveTo(x - s * 0.7, y + s * 0.8); g.lineTo(x, y - s * 1.4); g.lineTo(x - s * 0.05, y + s * 0.8); g.fill();
      } else if (kind === "round") {
        g.fillStyle = "rgba(60,36,14,.25)"; g.beginPath(); g.ellipse(x + s * 0.4, y + s * 0.8, s, s * 0.35, 0, 0, 7); g.fill();
        g.fillStyle = ["#a8622e", "#c08a3c", "#97503a", "#c9a24c", "#6f7a3e"][Math.floor(r() * 5)]; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
        g.fillStyle = "rgba(255,230,160,.35)"; g.beginPath(); g.arc(x - s * 0.35, y - s * 0.35, s * 0.45, 0, 7); g.fill();
      } else if (kind === "snowpine") {
        g.fillStyle = "#4a5f50"; g.beginPath(); g.moveTo(x - s * 0.6, y + s * 0.8); g.lineTo(x, y - s * 1.3); g.lineTo(x + s * 0.6, y + s * 0.8); g.fill();
        g.fillStyle = "#f4f6f8"; g.beginPath(); g.moveTo(x - s * 0.3, y - s * 0.3); g.lineTo(x, y - s * 1.3); g.lineTo(x + s * 0.3, y - s * 0.3); g.fill();
      } else if (kind === "reed") {
        g.strokeStyle = "rgba(60,74,48,.75)"; g.lineWidth = 0.8;
        for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * 1.2, y + s); g.lineTo(x + k * 1.8, y - s * 0.6); g.stroke(); }
        if (r() < 0.3) { g.fillStyle = "rgba(80,115,125,.6)"; g.beginPath(); g.ellipse(x + 3, y + s, s * 0.9, s * 0.35, 0, 0, 7); g.fill(); }
      } else if (kind === "steam") {
        g.fillStyle = "rgba(60,50,44,.45)"; g.beginPath(); g.ellipse(x, y + s, s * 0.9, s * 0.4, 0, 0, 7); g.fill();
        g.fillStyle = "rgba(245,245,245,.5)"; g.beginPath(); g.arc(x, y - s * 0.2, s * 0.6, 0, 7); g.arc(x + s * 0.5, y - s * 0.9, s * 0.45, 0, 7); g.fill();
      } else if (kind === "tuft") {
        g.strokeStyle = "rgba(110,100,60,.55)"; g.lineWidth = 0.7;
        for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x, y + s); g.lineTo(x + k * s * 0.7, y - s * 0.3); g.stroke(); }
      } else if (kind === "rock") {
        g.fillStyle = "#8f7a66"; g.beginPath(); g.moveTo(x - s, y + s * 0.6); g.lineTo(x - s * 0.4, y - s * 0.6); g.lineTo(x + s * 0.7, y - s * 0.3); g.lineTo(x + s, y + s * 0.6); g.fill();
        g.fillStyle = "#b5a28e"; g.beginPath(); g.moveTo(x - s, y + s * 0.6); g.lineTo(x - s * 0.4, y - s * 0.6); g.lineTo(x, y + s * 0.6); g.fill();
      } else if (kind === "peak") {
        const w = s * 1.15, tx = x + u(-1.5, 1.5), ty = y - s;
        g.fillStyle = "rgba(40,30,20,.22)"; g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.lineTo(x + w * 0.9, y + 1); g.fill();
        g.fillStyle = "#b9a98d"; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(tx, ty); g.lineTo(x + w * 0.05, y); g.fill();
        g.fillStyle = "#7d6c58"; g.beginPath(); g.moveTo(x + w * 0.05, y); g.lineTo(tx, ty); g.lineTo(x + w / 2, y); g.fill();
        if (extra > 0.62 || y < 0.36 * H) {
          const k = extra > 0.85 ? 0.55 : 0.36;
          g.fillStyle = "#f5f6f9"; g.beginPath(); g.moveTo(tx - w / 2 * k, ty + s * k); g.lineTo(tx, ty); g.lineTo(tx + w / 2 * k * 0.6, ty + s * k * 0.85); g.lineTo(tx, ty + s * k * 0.7); g.fill();
        }
        g.strokeStyle = "rgba(55,40,28,.75)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(tx, ty); g.lineTo(x + w / 2, y); g.stroke();
      }
    }

    // ---- roads with bridges
    for (const chain of Terrain.roads) {
      const pts = chain.map(([x, y]) => [x / W, y / H]);
      g.strokeStyle = "rgba(70,46,26,.85)"; g.lineWidth = 2.4; g.lineJoin = "round"; g.lineCap = "round";
      smoothPath(g, pts); g.stroke();
      g.strokeStyle = "rgba(226,206,160,.55)"; g.lineWidth = 0.8; g.setLineDash([3, 4]); smoothPath(g, pts); g.stroke(); g.setLineDash([]);
    }
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (grid[y * GW + x] === T.BRIDGE) {
      g.fillStyle = "#5a3d24"; g.fillRect(x * 4 - 0.5, y * 4 - 0.5, 5, 5); g.fillStyle = "#c8a878"; g.fillRect(x * 4 + 0.5, y * 4 + 1.5, 3, 1);
    }
    g.restore();

    // ---- coastline, ice floes, sea strokes
    g.strokeStyle = "rgba(200,225,232,.18)"; g.lineWidth = 1;
    for (let k = 1; k <= 3; k++) { g.save(); g.translate(0, -k * 5); smoothPath(g, WORLD.coast); g.globalAlpha = 0.7 - k * 0.18; g.stroke(); g.restore(); }
    g.strokeStyle = "#2c2116"; g.lineWidth = 2.6; g.lineJoin = "round"; smoothPath(g, WORLD.coast); g.stroke();
    for (const [fx, fy, rx, ry] of WORLD.floes) {
      for (let k = 0; k < 5; k++) {
        const x = fx * W + u(-rx, rx) * W * 0.8, y = fy * H + u(-ry, ry) * H * 0.8, a = u(rx * 0.25, rx * 0.5) * W, b = a * u(0.3, 0.5);
        g.fillStyle = "#e8eef1"; g.strokeStyle = "#8aa4b0"; g.lineWidth = 0.8; g.beginPath(); g.ellipse(x, y, a, b, u(-0.4, 0.4), 0, 7); g.fill(); g.stroke();
      }
    }
    for (let i = 0; i < 260; i++) {
      const x = u(0, W), y = u(0, H * 0.2);
      if (Terrain.inPoly([x, y], Terrain.land)) continue;
      g.strokeStyle = "rgba(170,200,210,.22)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 4, y - 2, x + 8, y); g.stroke();
    }

    // ---- names
    g.textAlign = "center"; g.textBaseline = "middle";
    for (const [name, v] of Object.entries(WORLD.holds)) {
      g.font = FONT(17, 700, "italic"); g.fillStyle = "rgba(92,56,38,.78)";
      g.save(); g.translate(v[0][0] * W, v[0][1] * H); if (g.letterSpacing !== undefined) g.letterSpacing = "3px"; g.fillText(name.toUpperCase(), 0, 0); g.restore();
    }
    for (const [name, x, y, rot] of WORLD.beyond) {
      g.save(); g.translate(x * W, y * H); g.rotate(rot * Math.PI / 180); g.font = FONT(15, 700); g.fillStyle = "rgba(245,240,230,.55)";
      if (g.letterSpacing !== undefined) g.letterSpacing = "6px"; g.fillText(name, 0, 0); g.restore();
    }
    g.font = FONT(20, 600, "italic"); g.fillStyle = "rgba(190,214,222,.75)"; g.fillText("Sea of Ghosts", 0.4 * W, 0.05 * H);
    // compass
    const cx = W - 52, cy = H - 70;
    g.fillStyle = "rgba(240,232,210,.9)"; g.strokeStyle = "#2c2116"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx, cy - 30); g.lineTo(cx + 7, cy); g.lineTo(cx, cy + 30); g.lineTo(cx - 7, cy); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(cx - 30, cy); g.lineTo(cx, cy - 7); g.lineTo(cx + 30, cy); g.lineTo(cx, cy + 7); g.closePath(); g.fill(); g.stroke();
    g.font = FONT(15, 700); g.fillStyle = "#f2e8cf"; g.fillText("N", cx, cy - 40);
    // frame
    g.strokeStyle = "#1f170f"; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
    g.strokeStyle = "rgba(190,160,110,.75)"; g.lineWidth = 1.2; g.strokeRect(9, 9, W - 18, H - 18);
    return c;
  }

  // ---- fog: rebuilt only when what you've seen changes
  let fog = null, fogKey = "";
  function fogFor(pts) {
    const key = pts.length + ":" + (pts[pts.length - 1] || []).join(",");
    if (fog && key === fogKey) return fog;
    fogKey = key;
    fog = fog || document.createElement("canvas");
    fog.width = W; fog.height = H;
    const g = fog.getContext("2d");
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "rgba(10,11,14,.93)"; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "destination-out";
    for (const p of pts) {
      const [x, y] = P(p), grd = g.createRadialGradient(x, y, 22, x, y, 72);
      grd.addColorStop(0, "rgba(0,0,0,1)"); grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd; g.fillRect(x - 72, y - 72, 144, 144);
    }
    return fog;
  }

  const KIND_MIN_ZOOM = { city: 0, town: 1.5, farm: 2.6, fort: 2.2, dungeon: 2.2, camp: 2.4, lair: 2.2, stone: 2.4, shrine: 2.4, landmark: 1.8 };
  function icon(g, kind, x, y, s, selected) {
    const light = "#f5ebcd", dark = "#37261c";
    g.lineWidth = 1.6 * s;
    const R = 6 * s;
    if (kind === "city") { g.fillStyle = dark; g.strokeStyle = light; g.fillRect(x - R, y - R, 2 * R, 2 * R); g.strokeRect(x - R, y - R, 2 * R, 2 * R); g.fillStyle = light; g.fillRect(x - R * 0.35, y - R * 0.35, R * 0.7, R * 0.7); }
    else if (kind === "town" || kind === "farm") { g.fillStyle = dark; g.strokeStyle = light; g.beginPath(); g.arc(x, y, kind === "farm" ? R * 0.7 : R * 0.9, 0, 7); g.fill(); g.stroke(); }
    else if (kind === "fort") { g.fillStyle = "#6e645a"; g.strokeStyle = "#1e1914"; g.fillRect(x - R * 0.85, y - R * 0.85, R * 1.7, R * 1.7); g.strokeRect(x - R * 0.85, y - R * 0.85, R * 1.7, R * 1.7); g.fillStyle = "#1e1914"; g.fillRect(x - R * 0.85, y - R * 1.3, R * 0.5, R * 0.45); g.fillRect(x + R * 0.35, y - R * 1.3, R * 0.5, R * 0.45); }
    else if (kind === "stone") { g.fillStyle = "#7d8a96"; g.strokeStyle = light; g.beginPath(); g.moveTo(x - R * 0.45, y + R); g.lineTo(x - R * 0.3, y - R); g.lineTo(x + R * 0.3, y - R * 1.1); g.lineTo(x + R * 0.45, y + R); g.closePath(); g.fill(); g.stroke(); }
    else if (kind === "shrine") { g.fillStyle = "#d2af3c"; g.strokeStyle = "#281e0a"; g.beginPath(); g.moveTo(x, y - R); g.lineTo(x + R * 0.85, y); g.lineTo(x, y + R); g.lineTo(x - R * 0.85, y); g.closePath(); g.fill(); g.stroke(); }
    else if (kind === "lair") { g.fillStyle = "#4a1410"; g.strokeStyle = "#e8a080"; g.beginPath(); g.moveTo(x, y - R); g.lineTo(x + R, y + R * 0.7); g.lineTo(x, y + R * 0.2); g.lineTo(x - R, y + R * 0.7); g.closePath(); g.fill(); g.stroke(); }
    else if (kind === "camp") { g.fillStyle = "#8a5a2a"; g.strokeStyle = light; g.beginPath(); g.moveTo(x - R, y + R * 0.8); g.lineTo(x, y - R); g.lineTo(x + R, y + R * 0.8); g.closePath(); g.fill(); g.stroke(); }
    else if (kind === "landmark") { g.fillStyle = "#3a4a66"; g.strokeStyle = light; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R * 0.45 : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke(); }
    else { g.fillStyle = "#6e1914"; g.strokeStyle = light; g.beginPath(); g.moveTo(x, y - R); g.lineTo(x + R, y + R * 0.8); g.lineTo(x - R, y + R * 0.8); g.closePath(); g.fill(); g.stroke(); }
    if (selected) { g.strokeStyle = "#9fd0f0"; g.lineWidth = 2.6 * s; g.beginPath(); g.arc(x, y, R * 2.2, 0, 7); g.stroke(); }
  }
  function label(g, text, x, y, s, size, color = "#fbf3dc", weight = 700, italic = false, align = "center") {
    g.font = FONT(size * s, weight, italic ? "italic" : ""); g.textAlign = align; g.textBaseline = "middle";
    g.lineJoin = "round"; g.lineWidth = 3.4 * s; g.strokeStyle = "rgba(24,17,10,.95)"; g.fillStyle = color;
    g.strokeText(text, x, y); g.fillText(text, x, y);
  }

  /* v = {player, name, trail, route, dest:{pos,name}, discovered, explored, others, bags, selected, t, zoom, center, reduceMotion} */
  /* a soft tint over one hold, in a ruling clan's colour (built once at low resolution, then cached) */
  const tintCache = {};
  let regionGrid = null;
  function tintFor(hold, color) {
    const key = hold + color; if (tintCache[key]) return tintCache[key];
    const GW = Terrain.GW, GH = Terrain.GH, holds = Object.keys(WORLD.holds), want = holds.indexOf(hold);
    if (!regionGrid) {
      regionGrid = new Uint8Array(GW * GH);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const mx = (x + 0.5) * 4, my = (y + 0.5) * 4; let best = 0, bd = 1e12;
        holds.forEach((h, k) => { const d = (WORLD.holds[h][1][0] * W - mx) ** 2 + (WORLD.holds[h][1][1] * H - my) ** 2; if (d < bd) { bd = d; best = k; } });
        regionGrid[y * GW + x] = Terrain.grid[y * GW + x] === Terrain.T.SEA ? 255 : best;
      }
    }
    const c = document.createElement("canvas"); c.width = GW; c.height = GH;
    const g = c.getContext("2d"), img = g.createImageData(GW, GH);
    const r = parseInt(color.slice(1, 3), 16), gg = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
    for (let i = 0; i < GW * GH; i++) if (regionGrid[i] === want) { img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    return (tintCache[key] = c);
  }
  /* the season, painted softly over the ground: built once per season at terrain-grid size and scaled up ([OURS]) */
  const seasonCache = {};
  function seasonLayer(season) {
    if (!season || season === "summer") return null;
    if (seasonCache[season]) return seasonCache[season];
    const GW = Terrain.GW, GH = Terrain.GH, grid = Terrain.grid, T = Terrain.T;
    const c = document.createElement("canvas"); c.width = GW; c.height = GH;
    const g = c.getContext("2d"), img = g.createImageData(GW, GH), d = img.data;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const t = grid[y * GW + x], i = (y * GW + x) * 4, north = 1 - y / GH;   // 1 at the top of the map
      let col = null, a = 0;
      if (season === "winter") {   // snow creeps south over the open ground and the forests
        if ([T.GRASS, T.TUNDRA, T.FOREST, T.PINE, T.AUTUMN, T.MARSH, T.ROCKY, T.MOUNTAIN, T.ROAD].includes(t)) { col = [242, 245, 248]; a = (t === T.PINE || t === T.FOREST ? 0.1 : 0.14) + 0.3 * north * north + (t === T.MOUNTAIN || t === T.ROCKY ? 0.18 : 0); }
      } else if (season === "autumn") {
        if (t === T.AUTUMN) { col = [214, 112, 46]; a = 0.3; }
        else if (t === T.FOREST) { col = [205, 140, 60]; a = 0.26; }
        else if (t === T.GRASS || t === T.TUNDRA) { col = [214, 170, 92]; a = 0.14; }
      } else if (season === "spring") {
        if ([T.GRASS, T.TUNDRA, T.FOREST, T.MARSH].includes(t)) { col = [120, 170, 90]; a = t === T.TUNDRA ? 0.12 : 0.18; }
      }
      if (col) { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = Math.round(Math.min(0.7, a) * 255); }
    }
    g.putImageData(img, 0, 0);
    return (seasonCache[season] = c);
  }
  function draw(canvas, v) {
    base = base || drawBase();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    const g = canvas.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
    const k = Math.max(canvas.width / W, canvas.height / H) * v.zoom;
    let ox = canvas.width / 2 - v.center[0] * W * k, oy = canvas.height / 2 - v.center[1] * H * k;
    ox = Math.min(0, Math.max(canvas.width - W * k, ox)); oy = Math.min(0, Math.max(canvas.height - H * k, oy));
    v.transform = { k: k / dpr, ox: ox / dpr, oy: oy / dpr };
    g.setTransform(k, 0, 0, k, ox, oy);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(base, 0, 0, W, H);
    const sl = seasonLayer(v.season ?? (typeof WEVENTS !== "undefined" ? WEVENTS.season() : null)); if (sl) g.drawImage(sl, 0, 0, W, H);   // winter snow, autumn colours, spring green
    const s = dpr / k;                    // 1 screen px in map units: keeps icons and labels the same size at any zoom
    const MA = typeof MAPART !== "undefined" ? MAPART : null;
    const viewBox = [-ox / k, -oy / k, (canvas.width - ox) / k, (canvas.height - oy) / k];
    const dark = MA ? MA.ambient(g, v, s, W, H, viewBox) : 0;   // water glints, cloud shadows, birds (under the fog)
    g.drawImage(fogFor([...v.explored, ...v.discovered.map((n) => WORLD.places[n])]), 0, 0, W, H);
    if (v.rulers?.length) { g.globalAlpha = 0.26; for (const r of v.rulers) g.drawImage(tintFor(r.hold, r.color), 0, 0, W, H); g.globalAlpha = 1; }   // holds ruled by a clan
    const [px, py] = P(v.player), bob = MA && v.moving && !v.reduceMotion ? Math.abs(Math.sin(v.t * 7)) * 2.2 * s : 0;
    if (v.trail?.length > 1) {
      g.strokeStyle = "rgba(170,40,28,.9)"; g.lineWidth = 3.2 * s; g.lineCap = "round"; g.lineJoin = "round";
      g.beginPath(); v.trail.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.lineTo(px, py); g.stroke();
    }
    if (v.route?.length) {
      if (MA) MA.footprints(g, [[px, py], ...v.route.map(P)], s, v.reduceMotion ? 0 : v.t);
      else {
        g.setLineDash([7 * s, 7 * s]); g.lineDashOffset = v.reduceMotion ? 0 : -((v.t * 14 * s) % (14 * s));
        g.strokeStyle = "rgba(255,240,205,.95)"; g.lineWidth = 2.6 * s;
        g.beginPath(); g.moveTo(px, py); v.route.forEach((p) => g.lineTo(...P(p))); g.stroke(); g.setLineDash([]);
      }
      const [bx, by] = P(v.route[v.route.length - 1]);
      g.strokeStyle = "#fff0cd"; g.lineWidth = 2.4 * s; g.beginPath(); g.arc(bx, by, 9 * s, 0, 7); g.stroke();
      if (v.dest && !v.discovered.includes(v.dest.name)) label(g, v.dest.roam ? "🧭 " + v.dest.name : v.dest.name + " ?", bx + 13 * s, by, s, 15, "#ffeac0", 700, false, "left");
    }
    if (v.spot) {   // a tapped spot for free roam
      const [sx2, sy2] = P(v.spot);
      g.strokeStyle = "#ffeac0"; g.lineWidth = 2.4 * s; g.beginPath(); g.arc(sx2, sy2, 8 * s, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(sx2 - 12 * s, sy2); g.lineTo(sx2 - 4 * s, sy2); g.moveTo(sx2 + 4 * s, sy2); g.lineTo(sx2 + 12 * s, sy2); g.moveTo(sx2, sy2 - 12 * s); g.lineTo(sx2, sy2 - 4 * s); g.moveTo(sx2, sy2 + 4 * s); g.lineTo(sx2, sy2 + 12 * s); g.stroke();
    }
    // places: icons when discovered; labels by zoom level, skipping any that would overlap
    const RANK = { city: 0, town: 1, landmark: 2, farm: 4 };
    const shown = v.discovered.map((n) => [n, ...WORLD.places[n]]).sort((a, b) => (a[0] === v.selected ? -1 : b[0] === v.selected ? 1 : (RANK[a[3]] ?? 3) - (RANK[b[3]] ?? 3)));
    // zoomed out, the many small spots shrink so cities and towns stay easy to see
    const small = v.zoom < 1.5 && shown.length > 60 ? 0.72 : 1;
    if (MA) {
      MA.night(g, v, s, W, H, dark, shown);
      const pulseSel = v.reduceMotion ? 0.5 : (Math.sin(v.t * 4) + 1) / 2;
      for (const [n, x, y, kind] of shown) {
        const f = kind === "city" || kind === "town" || v.selected === n ? 1 : small, m = MA.marker(n, kind), w = m.w * s * f, h = m.h * s * f;
        if (v.selected === n) {
          g.drawImage(MA.glowSprite("rgba(160,215,245,.9)"), x * W - 26 * s, y * H - 26 * s, 52 * s, 52 * s);
          g.strokeStyle = `rgba(159,208,240,${0.6 + 0.4 * pulseSel})`; g.lineWidth = 2.6 * s; g.beginPath(); g.arc(x * W, y * H, (17 + 3 * pulseSel) * s, 0, 7); g.stroke();
        }
        g.drawImage(m.c, x * W - w / 2, y * H - h * 0.62, w, h);
      }
    } else for (const [n, x, y, kind] of shown) icon(g, kind, x * W, y * H, s * (kind === "city" || kind === "town" || v.selected === n ? 1 : small), v.selected === n);
    const boxes = [];
    for (const [n, x, y, kind] of shown) {
      if (!(v.zoom >= KIND_MIN_ZOOM[kind] || v.selected === n)) continue;
      const size = kind === "city" ? 16 : 14, italic = ["dungeon", "fort", "camp", "lair", "stone", "shrine"].includes(kind);
      g.font = FONT(size * s, kind === "city" ? 700 : 600, italic ? "italic" : "");
      const w = g.measureText(n).width, bx = x * W - w / 2 - 2 * s, by = y * H + 9 * s, bw = w + 4 * s, bh = size * s * 1.2;
      if (n !== v.selected && boxes.some(([X, Y, Wd, Hd]) => bx < X + Wd && bx + bw > X && by < Y + Hd && by + bh > Y)) continue;
      boxes.push([bx, by, bw, bh]);
      label(g, n, x * W, y * H + (MA ? (kind === "city" ? 20 : 16) : 17) * s, s, size, "#fbf3dc", kind === "city" ? 700 : 600, italic);
    }
    // cleared dungeons: a small timer badge until they open again
    if (v.cleared) for (const [n, x, y, kind] of shown) {
      const left = v.cleared[n]; if (!left || !(v.zoom >= KIND_MIN_ZOOM[kind] || v.selected === n)) continue;
      const gs = left * G.GAME_SPEED, dd = Math.floor(gs / 86400), h = Math.floor(gs / 3600), mm = Math.ceil(gs / 60);
      label(g, `⏳ ${dd ? dd + "d" : h ? h + "h" : mm + "m"}`, x * W + 9 * s, y * H - 10 * s, s, 11, "#e8c98a", 700, false, "left");
    }
    if (v.selected && !v.discovered.includes(v.selected)) { const [x, y] = WORLD.places[v.selected]; g.strokeStyle = "#9fd0f0"; g.lineWidth = 2.6 * s; g.beginPath(); g.arc(x * W, y * H, 14 * s, 0, 7); g.stroke(); label(g, v.selected, x * W, y * H + 20 * s, s, 14); }
    // people and bags: try a few spots around each dot and take the first that doesn't cover another label
    const hit = (bx, by, bw, bh) => boxes.some(([X, Y, Wd, Hd]) => bx < X + Wd && bx + bw > X && by < Y + Hd && by + bh > Y);
    function smartLabel(text, x, y, size, color) {
      g.font = FONT(size * s, 700, "");
      const w = g.measureText(text).width, h = size * s * 1.25;
      const spots = [[x + 11 * s, y, "left"], [x - 11 * s, y, "right"], [x, y - 15 * s, "center"], [x, y + 16 * s, "center"],
        [x + 11 * s, y - h, "left"], [x + 11 * s, y + h, "left"], [x - 11 * s, y - h, "right"], [x - 11 * s, y + h, "right"]];
      const box = ([lx, ly, al]) => [al === "left" ? lx : al === "right" ? lx - w : lx - w / 2, ly - h / 2, w, h];
      let pick = spots.find((sp) => !hit(...box(sp)));
      if (!pick) { for (let k = 2; k < 8 && !pick; k++) { const sp = [x + 11 * s, y + k * h, "left"]; if (!hit(...box(sp))) pick = sp; } }
      pick = pick || spots[0];
      boxes.push(box(pick));
      label(g, text, pick[0], pick[1], s, size, color, 700, false, pick[2]);
    }
    // your own name goes first so nothing covers it
    g.font = FONT(14 * s, 700, ""); { const w = g.measureText(v.name).width; boxes.push([px + 12 * s, py - 13 * s - 9 * s, w, 18 * s]); }
    for (const o of v.others) {
      const [x, y] = P(o.pos);
      if (MA) MA.token(g, x, y, s, o.look || { r: o.race || "nord", id: o.name, eq: {}, gl: {} }, o.party ? "#8fe08a" : "#6f9fe8", 10);
      else { g.fillStyle = "#2f62a8"; g.strokeStyle = "#e6f0ff"; g.lineWidth = 2 * s; g.beginPath(); g.arc(x, y, 6.5 * s, 0, 7); g.fill(); g.stroke(); }
    }
    for (const b of v.bags) {
      const [x, y] = P(b.pos), R = 9 * s;
      g.fillStyle = "#7a1414"; g.strokeStyle = "#ffdcc8"; g.lineWidth = 2 * s; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill(); g.stroke();
      g.fillStyle = "#ffe6d2"; g.fillRect(x - 1.5 * s, y - 5 * s, 3 * s, 10 * s); g.fillRect(x - 5 * s, y - 1.5 * s, 10 * s, 3 * s);
    }
    for (const o of v.others) { const [x, y] = P(o.pos); smartLabel(o.name, x, y, 13, "#cde0ff"); }
    for (const b of v.bags) { const [x, y] = P(b.pos); smartLabel(b.label, x, y, 13, "#ffc8b4"); }
    const perTown = {};
    for (const b of v.banners || []) {   // clan banners over members' houses
      const n = (perTown[b.town] = (perTown[b.town] || 0) + 1) - 1;
      const [tx, ty] = P(b.pos), x = tx - (22 + n * 18) * s, y = ty - 30 * s, w = 14 * s, h = 22 * s;
      g.strokeStyle = "#2a1d08"; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(x, y - 2 * s); g.lineTo(x, y + h + 6 * s); g.stroke();
      g.fillStyle = b.colors[0]; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h * 0.58); g.lineTo(x, y + h * 0.58); g.fill();
      g.fillStyle = b.colors[1]; g.beginPath(); g.moveTo(x, y + h * 0.58); g.lineTo(x + w, y + h * 0.58); g.lineTo(x + w, y + h); g.lineTo(x + w / 2, y + h * 0.8); g.lineTo(x, y + h); g.fill();
      g.strokeStyle = "#140e06"; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x + w / 2, y + h * 0.8); g.lineTo(x, y + h); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(x, y + h * 0.58); g.lineTo(x + w, y + h * 0.58); g.stroke();
    }
    for (const r of v.routes || []) {   // where your party members are heading
      const [fx, fy] = P(r.from), path = r.path.slice(1);
      g.setLineDash([5 * s, 6 * s]); g.strokeStyle = "rgba(205,224,255,.85)"; g.lineWidth = 2.2 * s;
      g.beginPath(); g.moveTo(fx, fy); path.forEach((p) => g.lineTo(...P(p))); g.stroke(); g.setLineDash([]);
      const [ex, ey] = P(path[path.length - 1] || r.from); g.fillStyle = "#cde0ff"; g.strokeStyle = "#13243a"; g.lineWidth = 2 * s; g.beginPath(); g.arc(ex, ey, 4.5 * s, 0, 7); g.fill(); g.stroke();
    }
    for (const p of v.pins || []) {   // your own pins
      const [x, y] = P(p.pos), r = (p.on ? 9 : 7) * s;
      g.fillStyle = p.on ? "#e2bb64" : "#d65a4a"; g.strokeStyle = "#1b1408"; g.lineWidth = 2 * s;
      g.beginPath(); g.moveTo(x, y); g.arc(x, y - r * 1.6, r, Math.PI * 0.8, Math.PI * 2.2); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#fff6df"; g.beginPath(); g.arc(x, y - r * 1.6, r * 0.38, 0, 7); g.fill();
      smartLabel(p.label, x, y - r * 1.6, 12, p.on ? "#f0d79a" : "#ffd6c8");
    }
    if (v.hall) {   // the shared Hall of the North: a banner on a pole
      const [hx, hy] = P(v.hall.pos), u = s;
      g.strokeStyle = "#2a1d08"; g.lineWidth = 3 * u; g.beginPath(); g.moveTo(hx, hy + 9 * u); g.lineTo(hx, hy - 12 * u); g.stroke();
      g.fillStyle = "#8c2b22"; g.strokeStyle = "#e2bb64"; g.lineWidth = 1.5 * u;
      g.beginPath(); g.moveTo(hx, hy - 12 * u); g.lineTo(hx + 12 * u, hy - 12 * u); g.lineTo(hx + 12 * u, hy - 1 * u); g.lineTo(hx + 6 * u, hy - 4 * u); g.lineTo(hx, hy - 1 * u); g.closePath(); g.fill(); g.stroke();
      smartLabel(v.hall.label, hx, hy, 12, "#f0d79a");
    }
    if (v.quest) {   // the current quest's destination: a gold diamond
      const [qx, qy] = P(v.quest), r = 10 * s;
      if (MA) { const qp = v.reduceMotion ? 0.5 : (Math.sin(v.t * 2.6) + 1) / 2, R = (34 + 14 * qp) * s; g.globalAlpha = 0.55 + 0.35 * qp; g.drawImage(MA.glowSprite("rgba(240,200,90,.95)"), qx - R / 2, qy - R / 2, R, R); g.globalAlpha = 1; }
      g.fillStyle = "rgba(226,187,100,.9)"; g.strokeStyle = "#2a1d08"; g.lineWidth = 2 * s;
      g.beginPath(); g.moveTo(qx, qy - r); g.lineTo(qx + r * 0.75, qy); g.lineTo(qx, qy + r); g.lineTo(qx - r * 0.75, qy); g.closePath(); g.fill(); g.stroke();
    }
    // weather over everything, in screen space
    if (v.weather && v.weather !== "clear") {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      const cw2 = canvas.width, ch2 = canvas.height, tt = v.reduceMotion ? 0 : v.t;
      if (["cloudy", "fog", "storm", "blizzard"].includes(v.weather)) { g.fillStyle = v.weather === "fog" ? "rgba(210,215,220,.22)" : v.weather === "blizzard" ? "rgba(235,240,250,.2)" : "rgba(40,45,55,.18)"; g.fillRect(0, 0, cw2, ch2); }
      if (["rain", "storm"].includes(v.weather)) {
        g.strokeStyle = "rgba(190,210,235,.35)"; g.lineWidth = 1.2 * dpr; g.beginPath();
        for (let i = 0; i < 90; i++) { const x = ((i * 137.5 + tt * 60) % cw2), y = ((i * 89.3 + tt * 520) % ch2); g.moveTo(x, y); g.lineTo(x - 4 * dpr, y + 14 * dpr); }
        g.stroke();
        if (v.weather === "storm" && !v.reduceMotion && Math.sin(tt * 0.9) > 0.995) { g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(0, 0, cw2, ch2); }
      }
      if (["snow", "blizzard"].includes(v.weather)) {
        g.fillStyle = "rgba(255,255,255,.75)"; const n = v.weather === "blizzard" ? 160 : 70, drift = v.weather === "blizzard" ? 140 : 40;
        for (let i = 0; i < n; i++) { const x = ((i * 97.1 + tt * drift + Math.sin(i + tt) * 10) % cw2 + cw2) % cw2, y = ((i * 53.7 + tt * 45) % ch2); g.beginPath(); g.arc(x, y, (1 + (i % 3) * 0.6) * dpr, 0, 7); g.fill(); }
      }
      g.restore();
    }
    if (MA) { MA.trackDiscoveries(v.discovered); MA.drawBursts(g, s, W, H, v.reduceMotion); }
    // caravans rolling between the holds, and your cart behind your horse
    if (v.caravans && typeof CARAVANS !== "undefined") for (const c of v.caravans) {
      const sp = CARAVANS.sprite(c.khajiit, true); if (!sp) continue;
      if (!c.visible) continue;   // only where you've been: no wagons drawn into the fog
      const [cx, cy] = P(c.pos), bob2 = c.moving && !v.reduceMotion ? Math.sin(v.t * 6 + cx) * 0.8 * s : 0;
      g.drawImage(sp, cx - 21 * s, cy - 25 * s + bob2, 42 * s, 30 * s);
      if (v.zoom >= 1.5) label(g, c.label, cx, cy + 12 * s, s, 11, c.mine ? "#ffe6a0" : "#f3e7c4", 700, true);
    }
    if (v.raid && typeof RAIDART !== "undefined") RAIDART.mapRaid(g, v.raid, P, s, v.t, v.reduceMotion);   // a dragon over a town (raidart.js)
    if (v.cart && typeof CARAVANS !== "undefined") { const sp = CARAVANS.sprite(false, false); if (sp) g.drawImage(sp, px - 50 * s, py - 16 * s, 34 * s, 24 * s); }
    if (v.fx && typeof FXART !== "undefined") FXART.mapUnder(g, v.fx, P, s, px, py, v.t, v.reduceMotion, v);   // spells and shouts around you (fxart.js)
    const pulse = v.reduceMotion ? 0.5 : (Math.sin(v.t * 3) + 1) / 2;
    g.fillStyle = `rgba(110,200,255,${0.18 + 0.12 * pulse})`; g.beginPath(); g.arc(px, py, (15 + 6 * pulse) * s, 0, 7); g.fill();
    if (MA) {
      const lift = v.horse ? 15 * s : 0;
      if (v.horse) g.drawImage(MA.horse(v.horse), px - 27 * s, py - 12 * s - bob * 0.5, 54 * s, 35 * s);   // the horse under you, then you in the saddle
      MA.token(g, px + (v.horse ? 3 * s : 0), py - lift - bob, s, v.look, "#8fd3ff", v.horse ? 11 : 13);
      if (v.fx && typeof FXART !== "undefined") FXART.mapOver(g, v.fx, P, s, px + (v.horse ? 3 * s : 0), py - lift - bob, v.t, v.reduceMotion);
      label(g, v.name, px + 16 * s, py - 16 * s - lift, s, 14, "#d8f0ff", 700, false, "left");
      return;
    }
    if (v.horse) {   // riding: a horseshoe in your horse's coat colour around your marker
      g.lineCap = "round"; g.strokeStyle = "#0b2233"; g.lineWidth = 5.5 * s; g.beginPath(); g.arc(px, py, 11.5 * s, 0.72 * Math.PI, 2.28 * Math.PI); g.stroke();
      g.strokeStyle = v.horse; g.lineWidth = 3.2 * s; g.beginPath(); g.arc(px, py, 11.5 * s, 0.72 * Math.PI, 2.28 * Math.PI); g.stroke(); g.lineCap = "butt";
    }
    g.fillStyle = "#8fd3ff"; g.strokeStyle = "#0b2233"; g.lineWidth = 2.4 * s; g.beginPath(); g.arc(px, py, 7.5 * s, 0, 7); g.fill(); g.stroke();
    label(g, v.name, px + 12 * s, py - 13 * s, s, 14, "#d8f0ff", 700, false, "left");
  }

  /* screen point → nearest place you know (within a finger's reach) */
  function placeAt(v, sx, sy, known) {
    const { k, ox, oy } = v.transform;
    const mx = (sx - ox) / k, my = (sy - oy) / k;
    let best = null, bd = 26 / k;
    for (const [n, [x, y]] of Object.entries(WORLD.places)) {
      if (!known(n)) continue;
      const d = Math.hypot(x * W - mx, y * H - my);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  const ready = () => { base = base || drawBase(); };
  return { draw, placeAt, ready, W, H };
})();
