/* Travel art: the animated strip under the trip panel while you're on the road. [OURS]
   A deep parallax landscape that matches the region you're crossing (pine forest, tundra, the Rift's autumn birches,
   marsh, snowfields, ash wastes, rocky hills), the real sky (time of day, sun, moons, stars, aurora) and the live
   weather (snow, rain and lightning, fog banks, ash, blown leaves, fireflies). Landmarks pass by (signposts, wayshrines,
   standing stones, ruins, camps), travellers and caravans come the other way, and the place you're heading to rises
   on the horizon as you get closer. Your hero, party and followers walk (or ride) along — they're drawn by the hero art
   (HEROART), through one small helper, so the characters look the same as everywhere else.
     TRAVELART.mount(host, info)   draw into host (one reused canvas); keeps animating while it's on screen
     TRAVELART.frame(info, dist)   → a one-off canvas (tests, screenshots)
     TRAVELART.debug()             → where everyone stood in the last live picture (feet line, figures, name tags), for tests
   info: { ground, progress, riding, carriage, horse, look, company, reduce, sky, dest, origin }
   Performance: every static layer is drawn once into an offscreen canvas and scrolled; the loop stops while the strip
   is off screen or the app hidden. */
const TRAVELART = (() => {
  const W = 360, H = 112, TW = 720, HZ = 64, FEET = 97;
  const TAU = Math.PI * 2;
  const seeded = (s) => ART.seeded(s);
  const INK = "#3b2c1e";

  // ---------------------------------------------------------------- colours
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  function mix(a, b, k) { const pa = hex(a), pb = hex(b); return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k))).toString(16).padStart(2, "0")).join(""); }
  const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };

  /* each region: ground, far ranges, hills and what grows there (weights) */
  const BIOME = {
    grass: { ground: "#7f9150", gd: "#62733f", road: "#a8916c", far: ["#8796a6", "#66788a"], hill: "#5d7347", ht: "#3f5636", trees: { pine: 0.45, broad: 0.55 }, n: 11, rocks: 3 },
    tundra: { ground: "#a99a68", gd: "#8a7c52", road: "#a58f6a", far: ["#8a96a2", "#6f7b86"], hill: "#8d855e", ht: "#59593b", trees: { pine: 0.35, boulder: 0.4, bush: 0.25 }, n: 6, rocks: 6 },
    forest: { ground: "#5f7a42", gd: "#4b6234", road: "#9c8562", far: ["#7889a0", "#586c7e"], hill: "#4b6a3e", ht: "#30492b", trees: { pine: 0.45, broad: 0.55 }, n: 16, rocks: 3 },
    pine: { ground: "#4f6b3c", gd: "#3e5530", road: "#94805f", far: ["#7889a0", "#56697c"], hill: "#3f5a38", ht: "#29402a", trees: { pine: 1 }, n: 18, rocks: 3 },
    autumn: { ground: "#9c7d3e", gd: "#7d602d", road: "#9e8560", far: ["#8a8ea6", "#6b6f88"], hill: "#a2713a", ht: "#8a4b22", trees: { birch: 0.7, pine: 0.3 }, n: 14, rocks: 2 },
    marsh: { ground: "#5f6d4b", gd: "#4a573a", road: "#857559", far: ["#7d8a92", "#647078"], hill: "#55624a", ht: "#3c4836", trees: { dead: 0.4, reeds: 0.4, pine: 0.2 }, n: 12, rocks: 1, pools: true },
    snow: { ground: "#e4eaee", gd: "#c3cdd6", road: "#cfcac0", far: ["#9eaebc", "#8496a8"], hill: "#d4dde4", ht: "#4c6456", trees: { pine: 1 }, n: 12, rocks: 2, snowy: true },
    ash: { ground: "#7a6c5c", gd: "#5e5248", road: "#6f6253", far: ["#6e605a", "#574b45"], hill: "#6a5c50", ht: "#463d36", trees: { dead: 0.6, boulder: 0.4 }, n: 7, rocks: 5, volcano: true },
    rock: { ground: "#8d7f66", gd: "#6e624e", road: "#9a8665", far: ["#8794a0", "#6a7682"], hill: "#7f7260", ht: "#4d5a3e", trees: { pine: 0.4, boulder: 0.6 }, n: 9, rocks: 7 },
  };
  const GROUND = {   // terrain name (Terrain.NAMES) → region
    "Road": "grass", "Bridge": "grass", "Grassland": "grass", "Tundra": "tundra", "Forest": "forest", "Pine forest": "pine", "Autumn forest": "autumn",
    "Marsh": "marsh", "Snow": "snow", "Volcanic tundra": "ash", "Rocky hills": "rock", "Mountains": "rock", "High peaks": "snow",
    "River (ford)": "grass", "Lake": "grass", "Sea": "grass",
  };
  const CITY_LOOK = {   // the five cities get their own silhouettes and stone
    Whiterun: { stone: "#9a8c72", roof: "#6b4a2e", keep: "hall" }, Solitude: { stone: "#a8a49a", roof: "#5a5e6a", keep: "castle" },
    Windhelm: { stone: "#8c939a", roof: "#4a5058", keep: "castle" }, Riften: { stone: "#8a6c4a", roof: "#5a3e26", keep: "hall" },
    Markarth: { stone: "#a08c6c", roof: "#7a6a52", keep: "dwemer" },
  };

  // ---------------------------------------------------------------- the light: time of day and weather
  function light(st) {
    const tod = st?.tod || "day", wx = st?.weather || "clear";
    const tints = [];
    if (tod === "night") tints.push("rgba(12,20,46,0.5)");
    else if (tod === "dusk") tints.push("rgba(120,52,60,0.2)", "rgba(240,140,70,0.08)");
    else if (tod === "dawn") tints.push("rgba(200,110,120,0.13)");
    const W2 = { cloudy: "rgba(96,104,112,0.12)", rain: "rgba(52,62,74,0.2)", storm: "rgba(26,32,44,0.34)", fog: "rgba(214,218,220,0.22)", snow: "rgba(200,210,220,0.1)", blizzard: "rgba(226,232,238,0.34)", ashstorm: "rgba(96,80,66,0.32)" }[wx];
    if (W2) tints.push(W2);
    const hazeAdd = { fog: 0.32, blizzard: 0.36, snow: 0.1, rain: 0.12, storm: 0.14, ashstorm: 0.3, cloudy: 0.05 }[wx] || 0;
    let horizon = "#e8dcc0";
    try { if (st && typeof SKY !== "undefined") horizon = SKY.skyColors(st)[1]; } catch { /* plain */ }
    if (wx === "fog") horizon = mix(horizon, "#d8dcdc", 0.6);
    const hour = st?.hour ?? 13, sp = Math.min(1, Math.max(0, (hour - 5) / 16));
    const sunX = tod === "night" ? W * 0.78 : W * (0.1 + sp * 0.8);
    const shadowLen = tod === "night" ? 0.25 : tod === "day" ? 0.5 : 1.1;
    const shadowA = ["fog", "storm", "blizzard", "rain"].includes(wx) ? 0.12 : tod === "night" ? 0.14 : 0.28;
    return { tod, wx, tints, horizon, hazeAdd, sunX, shadowLen, shadowA, dark: tod === "night" || wx === "storm", glow: tod === "night" ? 1 : tod === "dusk" ? 0.6 : wx === "storm" ? 0.5 : tod === "dawn" ? 0.3 : 0 };
  }

  // ---------------------------------------------------------------- layer cache (static pictures, drawn once)
  const layers = new Map();
  function makeCanvas(w, h) {
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c;
  }
  /* a strip TW wide (wraps seamlessly), rows y0..y1, drawn at scale rs, hazed toward the horizon colour */
  function layer(key, rs, y0, y1, haze, hazeCol, draw) {
    const k = `${key}|${rs}|${haze.toFixed(2)}|${hazeCol}`;
    let L = layers.get(k); if (L) { layers.delete(k); layers.set(k, L); return L; }
    const c = makeCanvas(TW * rs, (y1 - y0) * rs), g = c.getContext("2d");
    g.setTransform(rs, 0, 0, rs, 0, -y0 * rs);
    draw(g);
    if (haze > 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = rgba(hazeCol, Math.min(0.88, haze)); g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = "source-over"; }
    L = { c, y0, y1 };
    layers.set(k, L);
    while (layers.size > 16) layers.delete(layers.keys().next().value);
    return L;
  }
  /* draw something at x and its wrapped twins so a strip tiles */
  const wrap = (x, f) => { f(x); f(x - TW); f(x + TW); };
  const pick = (r, w) => { let t = r() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) { t -= v; if (t <= 0) return k; } return Object.keys(w)[0]; };

  // ---------------------------------------------------------------- scenery pieces (all in strip coordinates)
  function poly(g, pts, fill, stroke, lw) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.lineJoin = "round"; g.stroke(); } }
  function ellipse(g, x, y, rx, ry, fill) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); g.fillStyle = fill; g.fill(); }

  /* a mountain range: peaks lit on the sun side, snow caps with ragged edges */
  function range(g, r, o) {
    const n = o.count;
    for (let i = 0; i < n; i++) {
      const cx = (i + r() * 0.6) * TW / n, h = o.hMin + r() * (o.hMax - o.hMin), hw = h * (1.1 + r() * 0.9);
      const left = [], right = [];
      const steps = 5;
      for (let s = 0; s <= steps; s++) { const k = s / steps; left.push([cx - hw * (1 - k) + (r() - 0.5) * 4 * (1 - k), o.base - h * k + (s && s < steps ? (r() - 0.5) * h * 0.12 : 0)]); }
      for (let s = steps - 1; s >= 0; s--) { const k = s / steps; right.push([cx + hw * (1 - k) * (0.8 + r() * 0.4) + (r() - 0.5) * 4, o.base - h * k + (s ? (r() - 0.5) * h * 0.12 : 0)]); }
      const peak = [cx, o.base - h], ridge = [peak, [cx + hw * 0.12, o.base - h * 0.55], [cx - hw * 0.05, o.base - h * 0.25], [cx + hw * 0.1, o.base + 2]];
      wrap(0, (dx) => {
        const sh = (p) => p.map(([x, y]) => [x + dx, y]);
        poly(g, sh([...left, ...right, [cx + hw * 1.6, o.base + 30], [cx - hw * 1.6, o.base + 30]]), o.col, o.ink ? rgba(INK, 0.32) : null, 0.8);
        // shadow side (away from the sun)
        const shadowPts = o.sunLeft ? [peak, ...right, ...ridge.slice(1).reverse()] : [peak, ...ridge.slice(1), ...left.slice().reverse()];
        poly(g, sh(shadowPts), o.shade, null);
        if (o.snow > 0) {
          const line = o.base - h * (1 - o.snow);
          const capL = left.filter(([, y]) => y < line), capR = right.filter(([, y]) => y < line);
          if (capL.length || capR.length) {
            const pts = [...capL, ...capR];
            const yl = line + 2, xl = cx - hw * o.snow * 0.95, xr = cx + hw * o.snow * 0.95;
            const jag = []; const nj = 6; for (let j = nj; j >= 0; j--) { const x = xl + (xr - xl) * j / nj; jag.push([x, yl - (j % 2 ? h * 0.08 * (0.6 + r() * 0.8) : -h * 0.06 * r())]); }
            poly(g, sh([...pts, ...jag]), o.snowCol, null);
            const shadowCap = o.sunLeft ? [peak, ...capR, ...jag.slice(0, 4)] : [peak, ...jag.slice(3), ...capL.slice().reverse()];
            poly(g, sh(shadowCap), o.snowShade, null);
          }
        }
      });
    }
    g.fillStyle = o.col; g.fillRect(0, o.base, TW, 40);
  }
  /* a rolling ridge that wraps (sums of whole sine waves over the strip) */
  function ridgeY(x, base, amp, ph) { const t = x / TW * TAU; return base - amp * (0.55 * Math.sin(t * 2 + ph) + 0.3 * Math.sin(t * 5 + ph * 2.3) + 0.15 * Math.sin(t * 11 + ph * 0.7)); }

  function pine(g, x, base, h, col, shade, snow, ink) {
    const w = h * 0.36, tiers = h > 18 ? 5 : 3;
    g.fillStyle = "#4a3624"; g.fillRect(x - h * 0.03, base - h * 0.16, Math.max(1, h * 0.06), h * 0.16);
    for (let i = 0; i < tiers; i++) {
      const k = i / tiers, top = base - h + h * k * 0.82, bot = base - h * 0.12 - (tiers - 1 - i) * h * 0.66 / tiers, tw = w * (0.38 + 0.62 * (i + 1) / tiers);
      const pts = [[x, top], [x + tw, bot], [x + tw * 0.55, bot - h * 0.03], [x + tw * 0.2, bot + h * 0.02], [x - tw * 0.2, bot - h * 0.02], [x - tw * 0.55, bot + h * 0.02], [x - tw, bot]];
      poly(g, pts, col, ink ? rgba(INK, 0.55) : null, 0.7);
      poly(g, [[x, top], [x + tw, bot], [x + tw * 0.55, bot - h * 0.03], [x + tw * 0.2, bot + h * 0.02], [x + tw * 0.05, bot]], shade, null);
      if (snow) poly(g, [[x, top], [x - tw * 0.85, bot - h * 0.02], [x - tw * 0.4, bot - h * 0.06], [x - tw * 0.05, top + (bot - top) * 0.55], [x + tw * 0.35, bot - h * 0.07], [x + tw * 0.2, top + (bot - top) * 0.3]], "#eef3f6", null);
    }
  }
  function broad(g, x, base, h, cols, ink, bare) {
    g.strokeStyle = "#4a3624"; g.lineWidth = Math.max(1, h * 0.07); g.lineCap = "round";
    g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - h * 0.5); g.moveTo(x, base - h * 0.4); g.lineTo(x - h * 0.15, base - h * 0.62); g.moveTo(x, base - h * 0.45); g.lineTo(x + h * 0.17, base - h * 0.66); g.stroke(); g.lineCap = "butt";
    if (bare) return;
    const blobs = [[0, -0.66, 0.3], [-0.2, -0.56, 0.22], [0.2, -0.58, 0.23], [-0.08, -0.82, 0.22], [0.12, -0.8, 0.2]];
    for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(x + bx * h, base + by * h, br * h, 0, TAU); g.fillStyle = cols[0]; g.fill(); if (ink) { g.strokeStyle = rgba(INK, 0.45); g.lineWidth = 0.7; g.stroke(); } }
    for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(x + bx * h + br * h * 0.3, base + by * h + br * h * 0.3, br * h * 0.75, 0, TAU); g.fillStyle = cols[1]; g.fill(); }
    for (const [bx, by, br] of blobs.slice(0, 4)) { g.beginPath(); g.arc(x + bx * h - br * h * 0.3, base + by * h - br * h * 0.35, br * h * 0.42, 0, TAU); g.fillStyle = cols[2]; g.fill(); }
  }
  function birch(g, x, base, h, cols, ink) {
    g.fillStyle = "#e9e4d8"; g.fillRect(x - h * 0.025, base - h * 0.7, Math.max(1, h * 0.05), h * 0.7);
    g.fillStyle = "#2c2620"; for (let y = base - h * 0.65; y < base; y += h * 0.12) g.fillRect(x - h * 0.025, y, h * 0.03, Math.max(0.6, h * 0.02));
    const blobs = [[0, -0.78, 0.2], [-0.13, -0.66, 0.16], [0.13, -0.64, 0.15], [0, -0.95, 0.14], [0.06, -0.55, 0.12]];
    for (const [bx, by, br] of blobs) { g.beginPath(); g.ellipse(x + bx * h, base + by * h, br * h * 0.8, br * h, 0, 0, TAU); g.fillStyle = cols[0]; g.fill(); if (ink) { g.strokeStyle = rgba(INK, 0.4); g.lineWidth = 0.6; g.stroke(); } }
    for (const [bx, by, br] of blobs) { g.beginPath(); g.ellipse(x + bx * h + br * h * 0.25, base + by * h + br * h * 0.25, br * h * 0.5, br * h * 0.65, 0, 0, TAU); g.fillStyle = cols[1]; g.fill(); }
    for (const [bx, by, br] of blobs.slice(0, 3)) { g.beginPath(); g.arc(x + bx * h - br * h * 0.25, base + by * h - br * h * 0.3, br * h * 0.35, 0, TAU); g.fillStyle = cols[2]; g.fill(); }
  }
  function dead(g, x, base, h, r, col) {
    g.strokeStyle = col; g.lineCap = "round";
    const branch = (x0, y0, a, len, w, d) => { const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); if (d > 0) { branch(x1, y1, a - 0.5 - r() * 0.3, len * 0.62, w * 0.62, d - 1); branch(x1, y1, a + 0.45 + r() * 0.3, len * 0.6, w * 0.6, d - 1); } };
    branch(x, base, -Math.PI / 2 + (r() - 0.5) * 0.3, h * 0.45, Math.max(1, h * 0.07), 3); g.lineCap = "butt";
  }
  function boulder(g, x, base, s, col, ink, snow, moss) {
    const pts = [[x - s, base], [x - s * 0.8, base - s * 0.55], [x - s * 0.2, base - s * 0.85], [x + s * 0.5, base - s * 0.7], [x + s, base - s * 0.2], [x + s * 0.9, base]];
    poly(g, pts, col, ink ? rgba(INK, 0.6) : null, 0.8);
    poly(g, [[x + s * 0.05, base - s * 0.8], [x + s * 0.5, base - s * 0.7], [x + s, base - s * 0.2], [x + s * 0.9, base], [x + s * 0.2, base]], "rgba(20,16,24,0.22)", null);
    poly(g, [[x - s * 0.75, base - s * 0.55], [x - s * 0.2, base - s * 0.82], [x + s * 0.1, base - s * 0.6], [x - s * 0.5, base - s * 0.4]], "rgba(255,250,235,0.18)", null);
    if (snow) poly(g, [[x - s * 0.82, base - s * 0.52], [x - s * 0.2, base - s * 0.86], [x + s * 0.5, base - s * 0.72], [x + s * 0.3, base - s * 0.55], [x - s * 0.4, base - s * 0.5]], "#eef3f6", null);
    else if (moss) poly(g, [[x - s * 0.8, base - s * 0.5], [x - s * 0.2, base - s * 0.8], [x - s * 0.1, base - s * 0.65], [x - s * 0.6, base - s * 0.42]], "rgba(90,120,60,0.55)", null);
  }
  function reeds(g, x, base, h, r) { g.lineWidth = 1; for (let k = -3; k <= 3; k++) { g.strokeStyle = k % 2 ? "#6f7d48" : "#53623a"; g.beginPath(); g.moveTo(x + k * 1.5, base); g.quadraticCurveTo(x + k * 2, base - h * 0.6, x + k * 3 + (r() - 0.5) * 2, base - h * (0.7 + r() * 0.3)); g.stroke(); } g.fillStyle = "#6b4a2e"; g.fillRect(x - 1, base - h * 0.85, 2, h * 0.2); }
  function bush(g, x, base, s, cols) { for (const [bx, by, br] of [[-0.5, -0.35, 0.5], [0.3, -0.4, 0.55], [0, -0.7, 0.45]]) ellipse(g, x + bx * s, base + by * s, br * s * 1.2, br * s, cols[0]); for (const [bx, by, br] of [[0.4, -0.3, 0.35], [0.1, -0.55, 0.3]]) ellipse(g, x + bx * s, base + by * s, br * s, br * s * 0.8, cols[1]); }

  function treeCols(kind, season, snowy) {
    if (kind === "broad") return season === "autumn" ? ["#b8642c", "#8e4a22", "#e0963e"] : snowy || season === "winter" ? null : season === "spring" ? ["#6f9a4a", "#4f7436", "#98c066"] : ["#577d3e", "#3f5f2e", "#7ea254"];
    if (kind === "birch") return season === "winter" && snowy ? ["#c8a04a", "#9a7430", "#ecd27a"] : ["#d79a2e", "#b06a22", "#f2c552"];
    return null;
  }

  // ---------------------------------------------------------------- the layers
  function farLayer(B, kind, ctx, which) {
    const { rs, L, st, ink, snowy } = ctx, sunLeft = L.sunX < W / 2;
    const snowAmt = which ? (snowy ? 0.5 : 0.28) : (snowy ? 0.62 : 0.42);
    const key = `far${which}|${kind}|${snowy}|${sunLeft}|${ink}|${st?.tod}`;
    return layer(key, rs, 0, which ? 84 : 78, (which ? 0.3 : 0.5) + L.hazeAdd, L.horizon, (g) => {
      const r = seeded(`far${which}${kind}`);
      const col = which ? B.far[1] : B.far[0];
      const night = st?.tod === "night";
      const snowCol = night ? "#aab6c8" : st?.tod === "dusk" ? "#f2d2c0" : st?.tod === "dawn" ? "#f6dcd6" : "#f4f6f8";
      range(g, r, { count: which ? 7 : 6, base: which ? 70 : 64, hMin: which ? 12 : 22, hMax: which ? 26 : 46, col, shade: mix(col, "#2a3040", 0.35), sunLeft, snow: kind === "ash" && !which ? 0 : snowAmt, snowCol, snowShade: mix(snowCol, "#7a8aa8", 0.35), ink: ink && which });
      if (B.volcano && !which) {   // Red Mountain, smoking
        const vx = TW * 0.3;
        wrap(vx, (x) => { poly(g, [[x - 80, 66], [x - 18, 14], [x + 14, 12], [x + 90, 66]], "#5a4a44", null); poly(g, [[x - 18, 14], [x + 14, 12], [x + 8, 18], [x - 10, 19]], "#8a3a22", null); for (let i = 0; i < 6; i++) ellipse(g, x - 2 + i * 9, 8 - i * 3, 10 + i * 3, 5 + i, `rgba(70,60,56,${0.5 - i * 0.06})`); });
      }
    });
  }
  function hillLayer(B, kind, ctx) {
    const { rs, L, ink, snowy, st } = ctx;
    return layer(`hill|${kind}|${snowy}|${ink}|${st?.season}`, rs, 40, 90, 0.17 + L.hazeAdd * 0.8, L.horizon, (g) => {
      const r = seeded("hill" + kind), hill = snowy ? mix(B.hill, "#dfe7ec", 0.7) : B.hill;
      const ys = []; for (let x = 0; x <= TW; x += 4) ys.push([x, ridgeY(x, 72, 6, 1.3)]);
      poly(g, [...ys, [TW, 92], [0, 92]], hill, null);
      // a second, nearer swell
      const ys2 = []; for (let x = 0; x <= TW; x += 4) ys2.push([x, ridgeY(x, 78, 4, 4.1)]);
      poly(g, [...ys2, [TW, 92], [0, 92]], mix(hill, "#202818", 0.12), null);
      // forests along the ridges: dense in woods, sparse on tundra and rock
      const dens = { pine: 1, forest: 0.9, autumn: 0.8, snow: 0.6, grass: 0.45, marsh: 0.35, rock: 0.3, tundra: 0.15, ash: 0.12 }[kind] ?? 0.4;
      const tc = snowy ? mix(B.ht, "#90a49a", 0.2) : B.ht;
      for (let x = 0; x < TW; x += 3) {
        const cl = Math.sin(x / TW * TAU * 6 + 1) * 0.5 + 0.5;
        if (r() > dens * (0.35 + cl * 0.65)) continue;
        const y = ridgeY(x, 72, 6, 1.3) + 1 + r() * 2, h = 4 + r() * 6;
        wrap(x, (xx) => { if (kind === "autumn" && r() < 0.6) ellipse(g, xx, y - h * 0.5, h * 0.4, h * 0.55, r() < 0.5 ? "#b0602a" : "#c88a34"); else if (kind === "ash" || kind === "marsh" && r() < 0.5) { g.fillStyle = tc; g.fillRect(xx, y - h, 0.8, h); } else poly(g, [[xx - h * 0.3, y], [xx, y - h], [xx + h * 0.3, y]], tc, null); });
        if (snowy && r() < 0.7) wrap(x, (xx) => poly(g, [[xx - h * 0.12, y - h * 0.62], [xx, y - h], [xx + h * 0.12, y - h * 0.62]], "#e8eef2", null));
      }
      for (let x = 0; x < TW; x += 5) { if (r() > dens * 0.8) continue; const y = ridgeY(x, 78, 4, 4.1) + 2, h = 5 + r() * 7; wrap(x, (xx) => poly(g, [[xx - h * 0.3, y], [xx, y - h], [xx + h * 0.3, y]], mix(tc, "#101810", 0.15), ink ? rgba(INK, 0.25) : null, 0.5)); }
      if (kind === "marsh") for (let i = 0; i < 6; i++) { const x = r() * TW; wrap(x, (xx) => ellipse(g, xx, 84 + r() * 4, 20 + r() * 20, 1.6, "rgba(150,170,170,0.5)")); }
    });
  }
  function nearLayer(B, kind, ctx) {
    const { rs, L, ink, snowy, st } = ctx, season = st?.season || "summer";
    return layer(`near|${kind}|${snowy}|${ink}|${season}`, rs, 18, 92, 0.05 + L.hazeAdd * 0.45, L.horizon, (g) => {
      const r = seeded("near" + kind), ground = snowy ? mix(B.ground, "#eef2f4", 0.82) : B.ground;
      // the field beyond the road
      const ys = []; for (let x = 0; x <= TW; x += 6) ys.push([x, ridgeY(x, 82, 1.6, 2.2)]);
      poly(g, [...ys, [TW, 92], [0, 92]], ground, null);
      g.fillStyle = rgba(snowy ? "#ffffff" : "#000000", snowy ? 0.25 : 0.06); for (let i = 0; i < 160; i++) g.fillRect(r() * TW, 80 + r() * 12, 2 + r() * 5, 0.8);
      if (B.pools) for (let i = 0; i < 5; i++) { const x = r() * TW; wrap(x, (xx) => { ellipse(g, xx, 86 + r() * 3, 18 + r() * 14, 2.2, "#4f6670"); ellipse(g, xx - 3, 85.6, 10, 0.7, "rgba(220,230,235,0.5)"); }); }
      // trees and rocks: a back row (smaller, darker) then a front row
      const items = [];
      for (let row = 0; row < 2; row++) for (let i = 0; i < B.n * (row ? 0.7 : 1); i++) items.push({ row, x: r() * TW, t: pick(r, B.trees), s: r(), d: r() });
      for (let i = 0; i < B.rocks; i++) items.push({ row: 1, x: r() * TW, t: "boulder", s: r() * 0.6, d: r() });
      items.sort((a, b) => a.row - b.row || a.d - b.d);
      for (const it of items) {
        const base = (it.row ? 85 : 81) + it.d * 2.5, k = it.row ? 1 : 0.72, dark = it.row ? 0 : 0.18;
        wrap(it.x, (x) => {
          if (it.t === "pine") { const h = (26 + it.s * 34) * k; const c = mix(snowy ? "#3f5a4a" : kind === "pine" ? "#2f4a2c" : "#38552f", "#0c140e", dark); pine(g, x, base, h, c, mix(c, "#0a100c", 0.35), snowy, ink); }
          else if (it.t === "broad") { const cols = treeCols("broad", season, snowy); broad(g, x, base, (24 + it.s * 18) * k, cols ? cols.map((c) => mix(c, "#101408", dark)) : null, ink, !cols); }
          else if (it.t === "birch") birch(g, x, base, (26 + it.s * 18) * k, treeCols("birch", season, snowy).map((c) => mix(c, "#2a1408", dark)), ink);
          else if (it.t === "dead") dead(g, x, base, (24 + it.s * 18) * k, r, kind === "ash" ? "#3a322c" : "#4a3e30");
          else if (it.t === "reeds") reeds(g, x, base + 1, 10 + it.s * 6, r);
          else if (it.t === "bush") bush(g, x, base, 4 + it.s * 4, snowy ? ["#dfe6ea", "#bcc8d0"] : season === "autumn" ? ["#9a5a2a", "#c47a34"] : ["#5a6e3a", "#7a8e4a"]);
          else boulder(g, x, base + 1, 5 + it.s * 9 * k, kind === "ash" ? "#4e443c" : "#8a8278", ink, snowy, kind === "forest" || kind === "pine");
        });
      }
    });
  }
  function roadLayer(B, kind, ctx, paved) {
    const { rs, ink, snowy, st } = ctx, season = st?.season || "summer";
    return layer(`road|${kind}|${snowy}|${ink}|${paved}|${season}`, rs, 82, H, 0, "#000000", (g) => {
      const r = seeded("road" + kind), ground = snowy ? mix(B.ground, "#f0f4f6", 0.85) : mix(B.ground, "#fff6d8", 0.06);
      g.fillStyle = ground; g.fillRect(0, 84, TW, H - 84);
      const top = (x) => 88 + Math.sin(x / TW * TAU * 4) * 0.8, bot = (x) => 101 + Math.sin(x / TW * TAU * 3 + 1) * 0.8;
      const roadC = snowy ? mix(B.road, "#d8dcdc", 0.45) : B.road;
      const edgeT = [], edgeB = []; for (let x = 0; x <= TW; x += 4) { edgeT.push([x, top(x)]); edgeB.push([x, bot(x)]); }
      poly(g, [...edgeT, ...edgeB.reverse()], roadC, null);
      // the shade under the far verge and the worn middle
      g.fillStyle = "rgba(40,30,20,0.16)"; for (let x = 0; x < TW; x += 4) g.fillRect(x, top(x), 4, 1.6);
      g.fillStyle = "rgba(255,248,230,0.12)"; g.fillRect(0, 93.5, TW, 2.2);
      if (paved) {   // the old Nord flagstones of the main roads
        for (let row = 0; row < 3; row++) { let x = r() * 6; const y = 89.5 + row * 3.9; while (x < TW) { const w = 4 + r() * 4; const c = mix(snowy ? "#bdbcb6" : "#958a78", "#d6cfbe", r() * 0.4); g.fillStyle = c; g.beginPath(); g.ellipse(x + w / 2, y + 1.6, w / 2 - 0.4, 1.6, 0, 0, TAU); g.fill(); if (ink) { g.strokeStyle = rgba(INK, 0.35); g.lineWidth = 0.4; g.stroke(); } x += w + 0.6; } }
      } else {
        // wheel ruts and hoof-churned dirt
        for (const y of [91.6, 97.6]) { g.fillStyle = snowy ? "rgba(120,100,80,0.35)" : "rgba(60,44,30,0.28)"; for (let x = 0; x < TW; x += 2) if (Math.sin(x * 0.07) + Math.sin(x * 0.023) > -1.2) g.fillRect(x, y + Math.sin(x * 0.05) * 0.4, 2, 1.1); g.fillStyle = "rgba(255,245,220,0.14)"; g.fillRect(0, y + 1.3, TW, 0.6); }
        g.fillStyle = "rgba(60,44,30,0.25)"; for (let i = 0; i < 180; i++) g.fillRect(r() * TW, 89 + r() * 11, 0.8 + r(), 0.6);
      }
      for (let i = 0; i < 26; i++) { const x = r() * TW, y = 89 + r() * 11; wrap(x, (xx) => { ellipse(g, xx, y, 1 + r() * 1.4, 0.7 + r() * 0.6, "#7d7266"); ellipse(g, xx - 0.3, y - 0.3, 0.6, 0.3, "rgba(255,250,240,0.4)"); }); }
      // grass tufts spilling over both edges
      const gc = snowy ? ["#e8eef2", "#c8d2d8"] : season === "autumn" ? ["#a8843e", "#7d6a32"] : [mix(B.ground, "#c8d878", 0.25), mix(B.ground, "#1a2410", 0.3)];
      for (let x = 0; x < TW; x += 2.2) for (const [y, dir] of [[top(x), -1], [bot(x), 1]]) {
        if (r() < 0.35) continue;
        wrap(x, (xx) => { g.strokeStyle = gc[r() < 0.5 ? 0 : 1]; g.lineWidth = 0.8; g.beginPath(); g.moveTo(xx, y + dir * -0.5); g.lineTo(xx + (r() - 0.5) * 2, y + dir * -(1.5 + r() * 2.5) + (dir > 0 ? 3 : 0)); g.stroke(); });
      }
      if (snowy) { g.fillStyle = "rgba(255,255,255,0.55)"; for (let i = 0; i < 14; i++) { const x = r() * TW; wrap(x, (xx) => ellipse(g, xx, 89 + r() * 2, 6 + r() * 10, 1, "rgba(250,252,255,0.6)")); } }
      // verge below the road
      g.fillStyle = rgba("#000000", 0.08); g.fillRect(0, 103, TW, H - 103);
      if (!snowy && (season === "spring" || season === "summer")) for (let i = 0; i < 40; i++) { const x = r() * TW, y = 102 + r() * 8; wrap(x, (xx) => { g.fillStyle = ["#f2e6a0", "#e8a8c0", "#ffffff", "#c8b0f0"][i % 4]; g.fillRect(xx, y, 1.2, 1.2); }); }
    });
  }
  function fgLayer(B, kind, ctx) {
    const { rs, ink, snowy, st } = ctx, season = st?.season || "summer";
    return layer(`fg|${kind}|${snowy}|${ink}|${season}`, rs, 92, H, 0, "#000000", (g) => {
      const r = seeded("fg" + kind);
      const gc = snowy ? ["#f0f4f6", "#c4ced6"] : season === "autumn" ? ["#b8903e", "#8a6a2a"] : [mix(B.gd, "#a8c060", 0.3), mix(B.gd, "#101808", 0.35)];
      for (let i = 0; i < 26; i++) {
        const x = r() * TW, base = H + 1, h = 5 + r() * 9;
        wrap(x, (xx) => {
          if (r() < 0.16) { boulder(g, xx, base, 4 + r() * 5, kind === "ash" ? "#4a4038" : "#7d756a", ink, snowy, !snowy); return; }
          for (let k = 0; k < 7; k++) { g.strokeStyle = gc[k % 2]; g.lineWidth = 1.1; g.beginPath(); g.moveTo(xx + k * 1.2 - 4, base); g.quadraticCurveTo(xx + k * 1.4 - 4, base - h * 0.6, xx + (k - 3.5) * 2.2, base - h * (0.6 + r() * 0.5)); g.stroke(); }
        });
      }
    });
  }
  function fogStrip(ctx) {
    const { rs } = ctx;
    return layer("fog", rs, 40, H, 0, "#000000", (g) => {
      const r = seeded("fog");
      for (let i = 0; i < 26; i++) { const x = r() * TW, y = 60 + r() * 44, rx = 30 + r() * 50, ry = 5 + r() * 7; wrap(x, (xx) => { { const gr = g.createRadialGradient(xx, y, 0, xx, y, rx); gr.addColorStop(0, "rgba(232,234,234,0.42)"); gr.addColorStop(1, "rgba(232,234,234,0)"); g.save(); g.translate(xx, y); g.scale(1, ry / rx); g.translate(-xx, -y); g.fillStyle = gr; g.fillRect(xx - rx, y - rx, rx * 2, rx * 2); g.restore(); } }); }
    });
  }
  function skyCanvas(st, rs) {
    const k = `sky|${st?.key || "plain"}|${rs}`;
    let L = layers.get(k); if (L) return L.c;
    const c = makeCanvas(W * rs, H * rs), g = c.getContext("2d"); g.setTransform(rs, 0, 0, rs, 0, 0);
    try { if (st && typeof SKY !== "undefined") SKY.backdrop(g, ART.H, W, H, st, { horizon: (HZ + 8) / H, seed: "trav" }); else ART.H.sky(g, W, H, "day"); } catch { g.fillStyle = "#93b2c6"; g.fillRect(0, 0, W, H); }
    layers.set(k, { c }); while (layers.size > 16) layers.delete(layers.keys().next().value);
    return c;
  }
  function vignetteCanvas(rs) {
    const k = `vig|${rs}`;
    let L = layers.get(k); if (L) return L.c;
    const c = makeCanvas(W * rs, H * rs), g = c.getContext("2d"); g.setTransform(rs, 0, 0, rs, 0, 0);
    const gr = g.createRadialGradient(W / 2, H * 0.55, H * 0.6, W / 2, H * 0.55, W * 0.62); gr.addColorStop(0, "rgba(10,8,6,0)"); gr.addColorStop(1, "rgba(10,8,6,0.42)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    layers.set(k, { c }); return c;
  }

  // ---------------------------------------------------------------- landmarks and travellers (world objects)
  const SLOT = 170, TSLOT = 520;
  const LANDMARKS = { sign: 0.16, shrine: 0.1, stone: 0.07, cairn: 0.1, ruin: 0.08, fence: 0.16, camp: 0.06, lamp: 0.1, cart: 0.05, none: 0.32 };
  function landmark(g, type, x, base, r, ink, lights, t, snowy) {
    const o = INK;
    if (type === "sign") {
      g.fillStyle = "#5a3e26"; g.fillRect(x - 1, base - 26, 2.4, 26);
      const boards = 2 + Math.floor(r() * 2);
      for (let i = 0; i < boards; i++) { const y = base - 24 + i * 6, right = (i + Math.floor(r() * 2)) % 2 === 0; const pts = right ? [[x - 2, y], [x + 13, y], [x + 16, y + 2], [x + 13, y + 4], [x - 2, y + 4]] : [[x + 3, y], [x - 12, y], [x - 15, y + 2], [x - 12, y + 4], [x + 3, y + 4]]; poly(g, pts, "#a07a48", o, 0.6); g.fillStyle = "rgba(40,26,14,0.55)"; g.fillRect(right ? x + 1 : x - 10, y + 1.6, 9, 0.8); }
      if (snowy) { g.fillStyle = "#eef3f6"; g.fillRect(x - 1.5, base - 27, 3.4, 1.4); }
    } else if (type === "shrine") {   // a wayshrine: stone plinth, little roof, candles
      poly(g, [[x - 7, base], [x + 7, base], [x + 6, base - 4], [x - 6, base - 4]], "#8a8478", o, 0.6);
      g.fillStyle = "#9a9488"; g.fillRect(x - 4, base - 20, 8, 16); g.fillStyle = "rgba(20,16,24,0.25)"; g.fillRect(x + 1, base - 20, 3, 16);
      poly(g, [[x - 8, base - 19], [x, base - 27], [x + 8, base - 19]], "#6a5a4a", o, 0.6);
      g.fillStyle = "#3a2c22"; g.fillRect(x - 2.5, base - 16, 5, 6);
      g.fillStyle = "#f8e8b0"; g.fillRect(x - 1.6, base - 13, 1, 2); g.fillRect(x + 0.8, base - 13, 1, 2);
      lights.push([x, base - 13, 14, "255,190,110", 0.7 + Math.sin(t * 9) * 0.1]);
    } else if (type === "stone") {   // a standing stone with a faint rune
      poly(g, [[x - 5, base], [x - 6, base - 22], [x - 2, base - 32], [x + 4, base - 30], [x + 6, base - 18], [x + 5, base]], "#7a7a80", o, 0.7);
      poly(g, [[x + 1, base - 31], [x + 4, base - 30], [x + 6, base - 18], [x + 5, base], [x + 1, base]], "rgba(20,18,30,0.28)", null);
      g.strokeStyle = "rgba(150,200,255,0.8)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - 2, base - 22); g.lineTo(x, base - 18); g.lineTo(x - 2, base - 14); g.moveTo(x, base - 18); g.lineTo(x + 2, base - 18); g.stroke();
      lights.push([x, base - 18, 10, "140,190,255", 0.5]);
    } else if (type === "cairn") {
      for (const [dx, dy, s] of [[-4, 0, 4], [4, 0, 3.6], [0, -5, 3.6], [-1, -9.5, 2.8], [0.5, -13, 2]]) boulder(g, x + dx, base + dy, s, "#8a847a", ink, snowy, false);
    } else if (type === "ruin") {   // a broken Nordic arch
      const c = "#8c8678";
      poly(g, [[x - 14, base], [x - 14, base - 30], [x - 8, base - 33], [x - 8, base]], c, o, 0.7);
      poly(g, [[x + 8, base], [x + 8, base - 22], [x + 11, base - 25], [x + 14, base - 21], [x + 14, base]], c, o, 0.7);
      poly(g, [[x - 16, base - 33], [x - 2, base - 37], [x + 2, base - 34], [x - 6, base - 31], [x - 16, base - 30]], c, o, 0.7);
      g.strokeStyle = "rgba(40,30,20,0.4)"; g.lineWidth = 0.5; for (let y = base - 26; y < base; y += 5) { g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x - 8, y); g.moveTo(x + 8, y + 2); g.lineTo(x + 14, y + 2); g.stroke(); }
      g.fillStyle = "rgba(20,18,30,0.25)"; g.fillRect(x - 10, base - 32, 2, 32); g.fillRect(x + 12, base - 22, 2, 22);
      boulder(g, x + 2, base, 3, c, ink, snowy, true);
    } else if (type === "fence") {
      const n = 4 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) { const px = x + i * 9 - n * 4.5; g.fillStyle = "#5a4430"; g.fillRect(px - 0.8, base - 10, 1.8, 10); }
      g.strokeStyle = "#6e5236"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - n * 4.5, base - 8); g.lineTo(x + n * 4.5 - 9, base - 7.4); g.moveTo(x - n * 4.5, base - 4); g.lineTo(x + n * 4.5 - 9, base - 3.6); g.stroke();
    } else if (type === "camp") {   // a hunter's tent and fire
      poly(g, [[x - 16, base], [x - 7, base - 14], [x + 2, base]], "#a89270", o, 0.7); poly(g, [[x - 7, base - 14], [x + 2, base], [x - 4, base]], "rgba(30,20,10,0.35)", null);
      for (const [dx, dy] of [[8, 0], [12, 0], [10, -1]]) ellipse(g, x + dx, base + dy, 1.6, 0.9, "#6a6058");
      const f = Math.sin(t * 14) * 0.6 + Math.sin(t * 23) * 0.4;
      poly(g, [[x + 7.5, base - 1], [x + 10 + f * 0.6, base - 7 - f], [x + 12.5, base - 1]], "#e8923a", null); poly(g, [[x + 8.8, base - 1], [x + 10, base - 4.5], [x + 11.2, base - 1]], "#ffe2a0", null);
      lights.push([x + 10, base - 3, 26, "255,150,70", 0.9 + f * 0.1]);
    } else if (type === "lamp") {   // a lantern post by the road
      g.fillStyle = "#3a3028"; g.fillRect(x - 0.8, base - 24, 1.8, 24); g.fillRect(x - 0.8, base - 24, 6, 1.4);
      g.fillStyle = "#2a2420"; g.fillRect(x + 3, base - 22.6, 3.4, 4.6); g.fillStyle = "#ffd890"; g.fillRect(x + 3.7, base - 21.8, 2, 3);
      lights.push([x + 4.7, base - 20, 18, "255,200,120", 0.85]);
    } else if (type === "cart") {   // an abandoned cart and barrels
      poly(g, [[x - 10, base - 9], [x + 8, base - 9], [x + 8, base - 4], [x - 10, base - 4]], "#7a5a3a", o, 0.6);
      g.strokeStyle = "#5a4028"; g.lineWidth = 1; g.beginPath(); g.arc(x - 5, base - 3, 3, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x + 8, base - 6); g.lineTo(x + 16, base - 2); g.stroke();
      for (const dx of [12, 16]) { poly(g, [[x + dx - 2, base], [x + dx - 2.4, base - 6], [x + dx + 2.4, base - 6], [x + dx + 2, base]], "#8a643c", o, 0.5); g.fillStyle = "#3a3028"; g.fillRect(x + dx - 2.3, base - 4.5, 4.6, 0.6); }
    }
  }

  // ---------------------------------------------------------------- the characters: drawn by the hero art, one helper
  /* People and horses on the road all share one scale (U strip px per figure unit; a person is 61 units, a horse's back
     about 40), so a walker comes up past a horse's shoulder and a rider sits on a horse the same size as everyone's.
     Their stride follows the road: a figure that covers `stride` units a cycle plays d / (stride · U · sc) cycles after
     the road has scrolled d px, so planted feet and hooves move exactly with the ground (no sliding, no moonwalking). */
  const U = 0.54, STEPS = 12;
  const figOk = () => typeof FIGART !== "undefined" && typeof FIGART.sprite === "function";
  const strideOf = (riding, gait) => (riding ? FIGART.STRIDE.horse[gait || "gallop"] || FIGART.STRIDE.horse.gallop : FIGART.STRIDE.walk);
  const cycOf = (dist, riding, gait, sc) => { const s = strideOf(riding, gait); return s ? dist / (s * U * sc) : 0; };
  const devOf = (g) => { try { const t = g.getTransform(); return Math.hypot(t.a, t.b) || 1; } catch { return 1; } };
  /* m: { look, riding, horse, gait, flip, still } — feet (or hooves) exactly at (x, base); cyc = how far through the stride */
  function figure(g, m, x, base, cyc, sc, steps = STEPS) {
    if (figOk()) {
      try {
        const pose = m.riding ? "ride" : m.still ? "idle" : m.sit ? "sit" : "walk", n = m.still || m.sit ? 1 : steps;
        const u = sc * U, c = FIGART.sprite({ look: m.look || {} }, { pose, frame: Math.floor((((cyc % 1) + 1) % 1) * n), steps: n, k: u * Math.min(3, devOf(g)), horse: m.riding ? m.horse || "#6b4a2e" : undefined, gait: m.riding ? (m.still ? "stand" : m.gait || undefined) : undefined });
        if (c && c.width > 0) {
          const s = u / c.k;   // canvas px → strip units
          g.save(); g.translate(x, base); if (m.flip) g.scale(-1, 1); g.drawImage(c, -c.ax * s, -c.ay * s, c.width * s, c.height * s); g.restore(); return;
        }
      } catch { /* fall back to the simple walker */ }
    }
    if (typeof FXART === "undefined" || !FXART.walker) return;
    g.save(); g.translate(x, base); if (m.flip) g.scale(-1, 1); g.scale(sc * 1.08, sc * 1.08);
    try { FXART.walker(g, ART.H, 0, 0, cyc * TAU, m.look || null, !!m.riding, false, m.horse || null); } catch { /* a figure that can't draw stays out */ }
    g.restore();
  }
  /* a horse on its own, pulling something: hooves at (x, base) */
  function lone(g, col, x, base, cyc, sc, gait, flip) {
    if (figOk() && FIGART.drawHorse) { try { FIGART.drawHorse(g, col, x, base, { k: U * sc, cyc: ((cyc % 1) + 1) % 1, gait, flip }); return; } catch { /* old horse below */ } }
    if (typeof FXART !== "undefined" && FXART.horse) { g.save(); g.translate(x, base); if (flip) g.scale(-1, 1); FXART.horse(g, ART.H, 0, 0, cyc * TAU, col); g.restore(); }
  }
  /* is anyone in the company walking? then the horses walk with them */
  const onFoot = (info) => (!info.riding && !info.carriage) || (info.company || []).slice(0, 15).some((m) => !m.riding);
  /* your carriage: the horse in front, the wagon with you on the bench, wheels turning with the road */
  function carriage(g, info, x, base, cyc, gait, ctx, d) {
    const ink = ctx.ink ? INK : null, ph = d / 5;
    lone(g, "#6b4a2e", x + 26, base, cyc, 1, gait, false);
    line2(g, x + 4, base - 15, x + 14, base - 19, "#4a3424", 1.2);   // the shaft to the horse
    poly(g, [[x - 34, base - 18], [x + 6, base - 18], [x + 6, base - 9], [x - 34, base - 9]], "#7a5432", ink, 0.8);
    poly(g, [[x - 34, base - 18], [x - 34, base - 24], [x - 31, base - 24], [x - 31, base - 18]], "#6a4628", ink, 0.6);
    figure(g, { look: info.look, sit: true }, x - 8, base - 18 + 13.5 * U, 0, 1);
    for (const wx of [x - 26, x - 2]) {
      g.beginPath(); g.arc(wx, base - 5.5, 5.5, 0, TAU); g.fillStyle = "#4a3424"; g.fill(); g.strokeStyle = "#2a1e14"; g.lineWidth = 0.9; g.stroke();
      for (const a of [ph, ph + Math.PI / 2]) { g.beginPath(); g.moveTo(wx + Math.cos(a) * 4.6, base - 5.5 + Math.sin(a) * 4.6); g.lineTo(wx - Math.cos(a) * 4.6, base - 5.5 - Math.sin(a) * 4.6); g.stroke(); }
    }
  }
  function line2(g, x0, y0, x1, y1, c, w) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  /* the top of a figure's head above its feet (strip px), for name tags */
  const topOf = (riding, sc) => (riding ? 78 : 66) * U * sc;
  function shadow(g, x, base, w, L) {
    const dx = Math.max(-14, Math.min(14, (x - L.sunX) * 0.04 * L.shadowLen * 4));
    g.fillStyle = `rgba(14,10,18,${L.shadowA})`;
    g.beginPath(); g.ellipse(x + dx * 0.5, base + 0.5, Math.max(0.5, w + Math.abs(dx) * 0.5), 1.8, 0, 0, TAU); g.fill();
  }
  /* travellers coming the other way: a lone walker, a pair of guards, or a Khajiit caravan with its lantern */
  const GUARD = { r: "nord", id: "guard", eq: { chest: "iron_armor", head: "iron_helmet", shield: "iron_shield", weapon: "iron_sword" } };
  /* walk = how far (px) they've walked along the road so far: their legs and wheels follow it */
  function traveller(g, type, x, base, walk, ctx, lights, r, still) {
    const { L } = ctx, SC = 0.84, cyc = (riding, gait) => (still ? 0 : cycOf(walk, riding, gait, SC)), ph = still ? 0 : walk / 4;
    if (type === "walker") { shadow(g, x, base, 5, L); figure(g, { look: { r: ["nord", "imperial", "breton", "redguard"][Math.floor(r() * 4)], id: "trav" + Math.floor(r() * 9), eq: { chest: "hide_armor" } }, flip: true, still }, x, base, cyc(false), SC, 8); }
    else if (type === "guards") for (const dx of [0, 15]) { shadow(g, x + dx, base, 5, L); figure(g, { look: GUARD, flip: true, still }, x + dx, base, cyc(false) + dx * 0.031, SC, 8); }
    else if (type === "caravan") {
      shadow(g, x + 10, base, 26, L);
      lone(g, "#7a5a3a", x - 24, base, cyc(true, "walk"), SC, still ? "stand" : "walk", true);
      // the wagon: wheels, bed, a striped canvas cover
      poly(g, [[x - 8, base - 13], [x + 28, base - 13], [x + 28, base - 6], [x - 8, base - 6]], "#7a5432", ctx.ink ? INK : null, 0.7);
      g.beginPath(); g.moveTo(x - 6, base - 13); g.quadraticCurveTo(x + 10, base - 34, x + 26, base - 13); g.closePath(); g.fillStyle = "#d8c8a0"; g.fill(); if (ctx.ink) { g.strokeStyle = INK; g.lineWidth = 0.7; g.stroke(); }
      g.fillStyle = "rgba(140,60,40,0.75)"; for (const k of [0.3, 0.6]) { g.beginPath(); g.ellipse(x + 10, base - 13, 16 * k + 2, 20 * k, 0, Math.PI, TAU); g.lineWidth = 1.2; g.strokeStyle = "rgba(150,60,40,0.7)"; g.stroke(); }
      for (const wx of [x - 2, x + 22]) { g.beginPath(); g.arc(wx, base - 4, 4, 0, TAU); g.fillStyle = "#4a3424"; g.fill(); g.strokeStyle = "#2a1e14"; g.lineWidth = 0.8; g.stroke(); g.beginPath(); g.moveTo(wx + Math.cos(ph) * 3.4, base - 4 + Math.sin(ph) * 3.4); g.lineTo(wx - Math.cos(ph) * 3.4, base - 4 - Math.sin(ph) * 3.4); g.stroke(); }
      g.fillStyle = "#2a2420"; g.fillRect(x - 9, base - 22, 2.4, 3.4); g.fillStyle = "#ffd890"; g.fillRect(x - 8.6, base - 21.4, 1.6, 2.2);
      lights.push([x - 7.8, base - 20.5, 22, "255,196,120", 0.9]);
      figure(g, { look: { r: "khajiit", id: "caravan", eq: {} }, flip: true, still }, x + 36, base, cyc(false), SC, 8);
    }
  }
  /* where you're heading, rising on the horizon as you near it */
  function destination(g, info, p, ctx, lights, t) {
    const name = info.dest || "", B = ctx.B;
    if (!name) return;
    let kind = "town";
    try { kind = (typeof WORLD !== "undefined" && WORLD.places[name]?.[2]) || "town"; } catch { /* town */ }
    const city = CITY_LOOK[name];
    const s = 0.42 + p * 0.78, x = W * 0.84 - p * 8, base = 74 + p * 2;
    const far = 1 - p, hz = ctx.L.horizon, haze = (c) => mix(c, hz, Math.min(0.85, far * 0.55 + ctx.L.hazeAdd));
    const r = seeded("dest" + name), win = [];
    const S = (dx, dy) => [x + dx * s, base + dy * s];
    const P = (pts, c) => poly(g, pts.map(([a, b]) => S(a, b)), haze(c), ctx.ink && p > 0.35 ? rgba(INK, 0.3 * p) : null, 0.7);
    g.save();
    if (kind === "city" || city) {
      const st = city?.stone || "#9a9286", rf = city?.roof || "#5a4a3a";
      if (name === "Whiterun") P([[-60, 4], [-34, -10], [0, -16], [34, -10], [60, 4]], mix(B.hill, "#000000", 0.1));   // the hill it sits on
      if (name === "Markarth") P([[-56, 4], [-50, -40], [-30, -52], [-10, -44], [6, -60], [30, -38], [56, 4]], "#8a7660");
      P([[-44, 2], [-44, -16], [44, -16], [44, 2]], st);
      for (let i = -44; i < 44; i += 6) P([[i, -16], [i, -19], [i + 3, -19], [i + 3, -16]], st);
      for (const tx of [-44, -14, 18, 44]) { P([[tx - 4, -14], [tx - 4, -26], [tx + 4, -26], [tx + 4, -14]], mix(st, "#000000", 0.08)); P([[tx - 5.5, -26], [tx, -34], [tx + 5.5, -26]], rf); win.push([tx, -20]); }
      for (let i = 0; i < 7; i++) { const hx = -36 + i * 11 + r() * 4, hh = 6 + r() * 6; P([[hx - 4, -16], [hx - 4, -16 - hh], [hx + 4, -16 - hh], [hx + 4, -16]], "#a8946e"); P([[hx - 5.5, -16 - hh], [hx, -22 - hh], [hx + 5.5, -16 - hh]], rf); win.push([hx, -18 - hh * 0.5]); }
      const keep = city?.keep || "castle";
      if (keep === "hall") { P([[-12, -24], [-12, -40], [12, -40], [12, -24]], st); P([[-16, -40], [0, -60], [16, -40]], rf); P([[-3, -60], [0, -66], [3, -60]], rf); win.push([-5, -32], [5, -32], [0, -46]); }
      else if (keep === "dwemer") { P([[-10, -24], [-10, -46], [10, -46], [10, -24]], "#b09468"); P([[-12, -46], [0, -54], [12, -46]], "#b09468"); win.push([0, -36]); }
      else { P([[-10, -24], [-10, -48], [10, -48], [10, -24]], st); for (const tx of [-10, 10]) { P([[tx - 3.5, -40], [tx - 3.5, -56], [tx + 3.5, -56], [tx + 3.5, -40]], st); P([[tx - 4.5, -56], [tx, -64], [tx + 4.5, -56]], rf); } win.push([0, -36], [-10, -50], [10, -50]); }
    } else if (kind === "fort") {
      P([[-26, 2], [-26, -18], [26, -18], [26, 2]], "#8a8478");
      for (let i = -26; i < 26; i += 5) P([[i, -18], [i, -21], [i + 2.5, -21], [i + 2.5, -18]], "#8a8478");
      P([[-8, -18], [-8, -36], [8, -36], [8, -18]], "#7e786c"); for (let i = -8; i < 8; i += 4) P([[i, -36], [i, -39], [i + 2, -39], [i + 2, -36]], "#7e786c");
      win.push([0, -28], [-16, -10]);
    } else if (kind === "dungeon" || kind === "lair" || kind === "landmark" || kind === "college") {
      P([[-40, 4], [-26, -10], [-4, -18], [18, -12], [40, 4]], mix(B.hill, "#000000", 0.15));
      for (const [dx, hh] of [[-14, 18], [-6, 26], [4, 24], [12, 16]]) { P([[dx - 2.4, -12], [dx - 2.4, -12 - hh], [dx + 2.4, -12 - hh - 2], [dx + 2.4, -12]], "#8c8678"); }
      P([[-16, -30], [14, -34], [14, -31], [-16, -27]], "#8c8678");
      if (kind === "college") { P([[-5, -16], [-5, -62], [5, -62], [5, -16]], "#9a9a9e"); P([[-7, -62], [0, -72], [7, -62]], "#5a5e6a"); win.push([0, -50]); }
    } else if (kind === "camp") {
      for (const dx of [-14, 0, 14]) P([[dx - 8, 2], [dx, -12], [dx + 8, 2]], "#a89270");
      win.push([0, -2]);
    } else if (kind === "stone" || kind === "shrine") {
      P([[-30, 4], [-14, -6], [14, -6], [30, 4]], mix(B.hill, "#000000", 0.1));
      for (const dx of [-10, 0, 10]) P([[dx - 3, -4], [dx - 3.5, -22], [dx, -27], [dx + 3, -21], [dx + 3, -4]], "#7a7a80");
      win.push([0, -16]);
    } else {   // a town, farm or mill: a cluster of homes and a little smoke
      const n = kind === "farm" ? 3 : 6;
      for (let i = 0; i < n; i++) { const hx = -n * 7 + i * 14 + r() * 4, hh = 7 + r() * 5, hw = 6 + r() * 2; P([[hx - hw, 2], [hx - hw, -hh], [hx + hw, -hh], [hx + hw, 2]], "#a08a66"); P([[hx - hw - 2, -hh], [hx, -hh - 9], [hx + hw + 2, -hh]], "#6a4a30"); win.push([hx - 2, -hh * 0.45]); }
      if (kind === "farm") { g.fillStyle = haze("#b8a050"); for (let i = 0; i < 4; i++) g.fillRect(x + (-34 + i * 8) * s, base + 0.5 * s, 6 * s, 1.4 * s); }
    }
    // chimney smoke drifting with the wind
    if (s > 0.5) for (let i = 0; i < 4; i++) { const k = ((t * 0.25 + i / 4) % 1), sx = x + (-8 + k * 10 * (1 + (ctx.st?.wind || 0.2) * 3)) * s, sy = base + (-30 - k * 24) * s; ellipse(g, sx, sy, (2 + k * 5) * s, (1.6 + k * 3) * s, `rgba(200,200,205,${0.35 * (1 - k)})`); }
    g.restore();
    // windows light up at dusk and night
    if (ctx.L.glow > 0.2) for (const [dx, dy] of win) { const [wx, wy] = S(dx, dy); lights.push([wx, wy, 3 + 5 * s, "255,200,120", 0.5 + 0.4 * p, true]); }
  }

  // ---------------------------------------------------------------- weather particles (live)
  function weatherKind(st, kind) {
    if (!st) return kind === "ash" ? "ash" : null;
    const w = st.weather;
    if (w === "snow" || w === "blizzard") return "snow";
    if (w === "rain" || w === "storm") return "rain";
    if (w === "ashstorm" || kind === "ash") return "ash";
    if (w === "fog") return "mist";
    if ((st.season === "autumn" && !st.cold) || kind === "autumn") return "leaf";
    if ((st.season === "summer" || st.season === "spring") && (st.tod === "night" || st.tod === "dusk")) return "fly";
    if (st.season === "spring" && st.tod !== "night") return "petal";
    if (st.tod === "day" && st.season === "summer") return "mote";
    return null;
  }
  function makeParts(kind, st) {
    const n = { snow: st?.weather === "blizzard" ? 170 : 90, rain: st?.weather === "storm" ? 130 : 90, ash: 70, leaf: 16, fly: 14, petal: 18, mote: 10, mist: 0 }[kind] || 0;
    const r = seeded("p" + kind), parts = [];
    for (let i = 0; i < n; i++) parts.push({ x: r() * W, y: kind === "mote" || kind === "fly" ? 66 + r() * 40 : r() * H, z: 0.45 + r() * 0.9, a: r() * TAU, c: ["#c4572e", "#e8923a", "#d6b25e", "#a8622e"][i % 4] });
    return { kind, key: kind + "|" + (st?.weather || ""), parts, splash: [] };
  }
  function stepParts(P, g, dt, t, st, scroll) {
    const wind = st?.wind ?? 0.2, kind = P.kind, px = 1;
    for (const p of P.parts) {
      if (kind === "snow") { p.y += (14 + 22 * p.z) * dt * (1 + wind * 0.6); p.x += (Math.sin(t * 1.3 + p.a) * 7 - wind * 60 * p.z - scroll * p.z * 0.6) * dt; }
      else if (kind === "rain") { p.y += 260 * p.z * dt; p.x -= (30 + wind * 110) * p.z * dt + scroll * 0.4 * dt; if (p.y > FEET + 4 * p.z && p.z > 0.9 && P.splash.length < 30) { P.splash.push({ x: p.x, y: 90 + (p.z - 0.9) * 30, a: 1 }); p.y = -10; } }
      else if (kind === "ash") { p.x -= (40 + 70 * p.z) * dt * (0.4 + wind) + scroll * p.z * 0.5 * dt; p.y += (8 + Math.sin(t * 2 + p.a) * 10) * dt; }
      else if (kind === "leaf" || kind === "petal") { p.y += (10 + 12 * p.z) * dt; p.x += (Math.sin(t * 1.2 + p.a) * 16 - 18 - wind * 50 - scroll * 0.6) * p.z * dt; p.a += dt * (1.5 + p.z * 2); }
      else if (kind === "fly") { p.x += (Math.sin(t * 0.7 + p.a) * 10 - scroll * 0.5) * dt; p.y += Math.cos(t * 0.6 + p.a * 1.3) * 6 * dt; if (p.y < 56) p.y = 56; }
      else if (kind === "mote") { p.x += (Math.sin(t * 0.4 + p.a) * 4 - scroll * 0.3) * dt; p.y += Math.cos(t * 0.5 + p.a) * 3 * dt; if (p.y < 70) p.y = 70 + (70 - p.y); }
      if (p.y > H + 4) { p.y -= H + 8; p.x = Math.random() * (W + 40); }
      if (p.y < -10) p.y += H + 10;
      if (p.x < -12) p.x += W + 24; if (p.x > W + 12) p.x -= W + 24;
    }
    if (kind === "snow") { g.fillStyle = "rgba(255,255,255,0.92)"; for (const p of P.parts) { const s = Math.max(px, 0.9 + p.z * 1.4); g.globalAlpha = 0.5 + p.z * 0.4; g.fillRect(p.x, p.y, s, s); } g.globalAlpha = 1; }
    else if (kind === "rain") {
      g.strokeStyle = "rgba(200,214,228,0.55)"; g.lineWidth = 0.8; g.beginPath(); for (const p of P.parts) { const l = 5 + p.z * 6; g.moveTo(p.x, p.y); g.lineTo(p.x - (2 + wind * 5) * p.z, p.y + l); } g.stroke();
      g.strokeStyle = "rgba(220,230,240,0.6)"; g.lineWidth = 0.6;
      for (let i = P.splash.length - 1; i >= 0; i--) { const s = P.splash[i]; s.a -= dt * 5; s.x -= scroll * dt; if (s.a <= 0) { P.splash.splice(i, 1); continue; } g.globalAlpha = s.a; g.beginPath(); g.ellipse(s.x, s.y, 2.5 * (1.4 - s.a), 0.7, 0, 0, TAU); g.stroke(); } g.globalAlpha = 1;
    }
    else if (kind === "ash") for (const p of P.parts) { g.fillStyle = p.z > 0.9 ? "rgba(58,50,44,0.8)" : "rgba(120,108,98,0.55)"; g.fillRect(p.x, p.y, Math.max(px, p.z * 2.2), Math.max(px, p.z * 1.2)); }
    else if (kind === "leaf") for (const p of P.parts) { g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.scale(1, Math.abs(Math.cos(p.a * 1.7)) * 0.8 + 0.2); g.fillStyle = p.c; const s = (1.2) * (0.7 + p.z * 0.6); g.beginPath(); g.moveTo(0, -2.6 * s); g.quadraticCurveTo(2.2 * s, 0, 0, 2.6 * s); g.quadraticCurveTo(-2.2 * s, 0, 0, -2.6 * s); g.fill(); g.restore(); }
    else if (kind === "petal") { for (const p of P.parts) { g.fillStyle = p.z > 0.9 ? "rgba(255,255,255,0.9)" : "rgba(248,206,222,0.9)"; g.fillRect(p.x, p.y, Math.max(px, 1.6 * p.z), Math.max(px, 1.1 * p.z)); } }
    else if (kind === "fly" || kind === "mote") for (const p of P.parts) { const a = kind === "fly" ? 0.35 + 0.65 * Math.abs(Math.sin(t * 2.2 + p.a)) : 0.25 + 0.25 * Math.sin(t + p.a); g.globalAlpha = a; g.fillStyle = kind === "fly" ? "#eaff9a" : "#f4e2a0"; g.fillRect(p.x, p.y, px * (kind === "fly" ? 1.6 : 1), px * (kind === "fly" ? 1.6 : 1)); if (kind === "fly") { g.globalAlpha = a * 0.3; g.beginPath(); g.arc(p.x + 0.8, p.y + 0.8, 2.4, 0, TAU); g.fill(); } } g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- one frame
  function paint(V, now) {
    const info = V.info || {}, ink = true;
    const out = V.canvas, dpr = out.width / W;
    const rs = dpr;
    let g = out.getContext("2d");
    g.setTransform(rs, 0, 0, rs, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    g.imageSmoothingEnabled = true;
    g.clearRect(0, 0, W, H);
    const st = info.sky || null, kind = GROUND[info.ground] || "grass", B = BIOME[kind], L = light(st);
    const snowy = !!B.snowy || (st?.snow ?? 0) > 0.45;
    const paved = info.ground === "Road" || info.ground === "Bridge";
    const ctx = { rs, L, st, ink, snowy, B };
    const d = V.dist, t = V.t, p = Math.max(0, Math.min(1, info.progress || 0));
    const strip = (Lr, speed, extra = 0, tg = g) => { const ox = ((d * speed + extra) % TW + TW) % TW, y = Lr.y0, h = Lr.y1 - Lr.y0; tg.drawImage(Lr.c, -ox, y, TW, h); tg.drawImage(Lr.c, TW - ox, y, TW, h); };
    const lights = [];
    // far to near
    strip(farLayer(B, kind, ctx, 0), 0.03);
    strip(farLayer(B, kind, ctx, 1), 0.08);
    destination(g, info, p, ctx, lights, t);
    strip(hillLayer(B, kind, ctx), 0.2);
    const fogK = st?.weather === "fog" ? 1 : kind === "marsh" ? 0.6 : st?.tod === "dawn" ? 0.45 : 0;
    if (fogK) { g.globalAlpha = fogK * 0.8; strip(fogStrip(ctx), 0.26, t * 5); g.globalAlpha = 1; }
    strip(nearLayer(B, kind, ctx), 0.5);
    strip(roadLayer(B, kind, ctx, paved), 1);
    // landmarks along the far verge, then travellers on the far lane
    const seed = `${info.origin || ""}>${info.dest || ""}`;
    for (let i = Math.floor((d - 60) / SLOT); i <= Math.floor((d + W + 60) / SLOT); i++) {
      const r = seeded(seed + "|" + i), type = pick(r, LANDMARKS); if (type === "none") continue;
      const x = i * SLOT + r() * 80 - d; if (x < -40 || x > W + 40) continue;
      landmark(g, type, x, 88, r, ink, lights, t, snowy);
    }
    // the light of the hour and the weather, over the land only
    const tint = (tg, k) => { tg.globalCompositeOperation = "source-atop"; tg.globalAlpha = k; for (const c of L.tints) { tg.fillStyle = c; tg.fillRect(0, 0, W, H); } tg.globalAlpha = 1; tg.globalCompositeOperation = "source-over"; };
    tint(g, 1);
    // people on the road go on their own sheet: they take a little less of the night, so you can still see them
    const tgt = out;
    if (!V.cb || V.cb.width !== tgt.width || V.cb.height !== tgt.height) V.cb = makeCanvas(tgt.width, tgt.height);
    const wg = g; g = V.cb.getContext("2d");
    g.setTransform(rs, 0, 0, rs, 0, 0); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.imageSmoothingEnabled = true; g.clearRect(0, 0, W, H);
    for (let i = Math.floor((d * 1.8 - 80) / TSLOT) - 1; i <= Math.floor((d * 1.8 + W + 80) / TSLOT) + 1; i++) {
      const r = seeded(seed + "|t" + i); const roll = r(); if (roll > 0.42) continue;
      const type = roll < 0.12 ? "caravan" : roll < 0.22 ? "guards" : "walker";
      const x = i * TSLOT + r() * 200 - d * 1.8; if (x < -70 || x > W + 70) continue;
      traveller(g, type, x, 92, d * 0.8 + i * 37, ctx, lights, r, V.still);   // they walk the other way: 0.8 px of road for every px we go
    }
    // your company a step behind, then you
    // Everyone keeps one pace: with anyone on foot the horses walk beside them (speedOf slows the road to a walk),
    // otherwise the riders gallop. Feet and hooves stand on one ground line (FEET; the back row of a big party a little
    // further up the road and smaller).
    const co = (info.company || []).slice(0, 15), big = co.length > 4, tags = [], still = !!V.still;
    const gait = still ? "stand" : onFoot(info) ? "walk" : null;
    const lead = info.carriage ? "carriage" : info.riding ? "ride" : "walk";
    const width = (m) => (m.riding ? 40 : 20);   // a horse and rider take up about 40 px of road, a walker 20
    const cols = []; co.forEach((m, i) => { const c = big ? Math.floor(i / 2) : i; (cols[c] = cols[c] || []).push(i); });
    const colW = cols.map((ix) => Math.max(...ix.map((i) => width(co[i])))), need = colW.reduce((a, b) => a + b + 4, 0);
    const back = lead === "carriage" ? 34 : lead === "ride" ? 20 : 8;   // the leader's back end, behind its feet
    const hx = Math.min(W * 0.7, Math.max(128, 60 + back + need * 0.6)) + p * 30;
    const step = Math.min(1, (hx - back - 14) / Math.max(1, need));
    const spots = []; let cur = hx - back - 2;
    cols.forEach((ix, c) => { const cx = cur - colW[c] / 2 * step; cur -= (colW[c] + 4) * step;
      ix.forEach((i, k) => { const row = big ? k : 0; spots.push({ m: co[i], i, row, cx: cx + (row ? 6 * step : 0), cy: FEET - row * 5 }); }); });
    const figs = [];
    for (const sp of [...spots.filter((q) => q.row === 1), ...spots.filter((q) => q.row === 0)]) {
      const { m, i, row, cx, cy } = sp; if (cx < -24) continue;
      const sc = row ? 0.88 : 1, riding = !!m.riding;
      shadow(g, cx, cy, riding ? 14 : 6, L);
      const cyc = still ? 0 : cycOf(d, riding, gait, sc) + i * 0.37;   // a little out of step with each other
      figure(g, { look: m.look, riding, horse: m.horse, gait, still }, cx, cy, cyc, sc, big ? 8 : STEPS);
      figs.push({ name: m.name, x: cx, feet: cy, riding, row, sc, cyc });
      if (!big || row === 0) tags.push({ name: m.name, x: cx, y: cy - topOf(riding, sc) - 7, follower: m.follower, you: false });
    }
    shadow(g, hx, FEET, lead === "walk" ? 7 : 16, L);
    const cyc0 = still ? 0 : cycOf(d, lead !== "walk", gait, 1);
    if (lead === "carriage") carriage(g, info, hx, FEET, cyc0, gait, ctx, d);
    else figure(g, { look: info.look, riding: lead === "ride", horse: info.horse, gait, still }, hx, FEET, cyc0, 1);
    figs.push({ name: "You", x: hx, feet: FEET, riding: lead === "ride", carriage: lead === "carriage", row: 0, sc: 1, cyc: cyc0, you: true });
    if (co.length) tags.push({ name: "You", x: hx, y: FEET - (lead === "walk" ? topOf(false, 1) : lead === "ride" ? topOf(true, 1) : 40) - 7, you: true });
    V.dbg = { feet: FEET, U, gait, speed: V.speed, dist: d, figs, tags };
    if (L.glow > 0.5 && lead !== "carriage") lights.push([hx + 7, FEET - 20 - (lead === "ride" ? 12 : 0), 34, "255,170,90", 0.75 + Math.sin(t * 11) * 0.05 + Math.sin(t * 17) * 0.04]);   // a torch for the dark road
    strip(fgLayer(B, kind, ctx), 1.35);
    tint(g, L.tod === "night" ? 0.62 : 0.85);
    const cb = V.cb; g = wg; g.drawImage(cb, 0, 0, W, H);
    // then the sky behind it all: high clouds drifting, a few twinkling stars, the painted sky
    g.globalCompositeOperation = "destination-over";
    if (st?.tod === "night" && !["storm", "blizzard", "fog", "rain", "snow"].includes(st.weather)) {
      const r = seeded("tw"); g.fillStyle = "#ffffff";
      for (let i = 0; i < 14; i++) { const x = r() * W, y = r() * HZ * 0.8, a = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.8 + r() * 1.6) + i)); g.globalAlpha = a; g.fillRect(x, y, 1.2, 1.2); }
      const sh = (t % 9) / 9; if (sh < 0.08) { g.globalAlpha = 1 - sh / 0.08; g.strokeStyle = "#ffffff"; g.lineWidth = 0.8; const sx = W * 0.2 + sh * 1400, sy = 12 + sh * 160; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - 16, sy - 6); g.stroke(); }
      g.globalAlpha = 1;
    }
    g.drawImage(skyCanvas(st, rs), 0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    // lights: fires, lanterns, windows and your torch glow in the dark
    if (L.glow > 0 && lights.length) {
      g.globalCompositeOperation = "lighter";
      for (const [x, y, R, c, a, small] of lights) {
        const k = Math.max(0, Math.min(1, a)) * (small ? 1 : L.glow);
        { const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(${c},${0.55 * k})`); gr.addColorStop(0.4, `rgba(${c},${0.16 * k})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2); }
        if (small) { g.fillStyle = `rgba(${c},${0.9 * k})`; g.fillRect(x - 0.7, y - 0.7, 1.4, 1.4); }
      }
      g.globalCompositeOperation = "source-over";
    }
    // live weather
    const wk = weatherKind(st, kind);
    if (wk && wk !== "mist") { const want = wk + "|" + (st?.weather || ""); if (!V.parts || V.parts.key !== want) V.parts = makeParts(wk, st); if (!V.still) stepParts(V.parts, g, V.dt, t, st, V.speed); else stepParts(V.parts, g, 0, t, st, 0); }
    if (st?.weather === "fog" || st?.weather === "blizzard") { g.globalAlpha = st.weather === "fog" ? 0.7 : 0.5; strip(fogStrip(ctx), 1.6, t * 14); g.globalAlpha = 1; }
    if (st?.weather === "storm" && !V.still) {
      if (V.flash <= 0 && Math.random() < V.dt * 0.22) { V.flash = 1; V.bolt = seeded("b" + Math.floor(t))(); }
      if (V.flash > 0) {
        if (V.flash > 0.6) { g.strokeStyle = "rgba(240,244,255,0.95)"; g.lineWidth = 1.2; g.beginPath(); let x = W * (0.15 + V.bolt * 0.6), y = 0; g.moveTo(x, y); const rb = seeded("bolt" + V.bolt); while (y < HZ) { x += (rb() - 0.5) * 12; y += 6 + rb() * 6; g.lineTo(x, y); } g.stroke(); }
        g.fillStyle = `rgba(230,236,255,${0.32 * V.flash})`; g.fillRect(0, 0, W, H); V.flash -= V.dt * 3.5;
      }
    }
    // frame: vignette, the road ahead as a thin gold thread, the edge
    g.drawImage(vignetteCanvas(rs), 0, 0, W, H);
    const ty = H - 4.5, x0 = 10, x1 = W - 10, xp = x0 + (x1 - x0) * p;
    g.fillStyle = "rgba(12,10,8,0.55)"; g.fillRect(x0, ty - 1, x1 - x0, 2);
    g.fillStyle = "#d6b25e"; g.fillRect(x0, ty - 1, xp - x0, 2);
    poly(g, [[xp, ty - 3.4], [xp + 3, ty], [xp, ty + 3.4 - 1], [xp - 3, ty]], "#f0d890", INK, 0.6);
    poly(g, [[x1, ty - 7], [x1, ty + 1], [x1 + 1.6, ty + 1], [x1 + 1.6, ty - 7]], "#5a4430", null); poly(g, [[x1 + 1.6, ty - 7], [x1 + 8, ty - 5.2], [x1 + 1.6, ty - 3.4]], "#c4572e", null);   // a pennant at the end of the road
    if (ink) { g.strokeStyle = "rgba(59,44,30,0.9)"; g.lineWidth = 1.5; g.strokeRect(0.75, 0.75, W - 1.5, H - 1.5); }
    const og = out.getContext("2d");
    if (tags.length) { og.setTransform(dpr, 0, 0, dpr, 0, 0); placeTags(og, tags); for (const tg of tags) nameTag(og, tg.name, tg.x, tg.y, tg.follower, tg.you, tg.w); }   // names stay crisp
  }
  const tagFont = (you) => `600 ${you ? 9 : 8}px "Barlow Semi Condensed", sans-serif`;
  /* name tags sit just over each head; when two would touch, the later one steps up a row (yours is placed first) */
  function placeTags(g, tags) {
    tags.sort((a, b) => (b.you ? 1 : 0) - (a.you ? 1 : 0));
    const put = [];
    for (const tg of tags) {
      g.save(); g.font = tagFont(tg.you); tg.w = g.measureText(tg.name || "").width + 8; g.restore();
      tg.y = Math.max(8, tg.y);
      for (let n = 0; n < 4 && put.some((o) => Math.abs(o.x - tg.x) < (o.w + tg.w) / 2 + 2 && Math.abs(o.y - tg.y) < 13); n++) tg.y = Math.max(8, tg.y - 13);
      put.push(tg);
    }
  }
  function nameTag(g, name, x, y, follower, you, w0) {
    if (!name) return;
    y = Math.max(8, y);
    g.save(); g.font = tagFont(you); g.textAlign = "center"; g.textBaseline = "middle";
    const w = w0 || g.measureText(name).width + 8;
    g.fillStyle = "rgba(14,15,18,0.72)"; g.fillRect(x - w / 2, y - 6, w, 12);
    g.strokeStyle = you ? "rgba(214,178,94,0.9)" : follower ? "rgba(180,170,150,0.6)" : "rgba(143,224,138,0.8)"; g.lineWidth = 0.8; g.strokeRect(x - w / 2 + 0.4, y - 5.6, w - 0.8, 11.2);
    g.fillStyle = you ? "#f0d890" : follower ? "#e4dccb" : "#c8f0c0"; g.fillText(name, x, y + 0.5);
    g.restore();
  }

  // ---------------------------------------------------------------- the live strip
  let V = null;   // { canvas, info, dist, t, raf, last, visible, ema }
  /* strip pixels a second at the road: a gallop, a carriage at a trot, or everyone's walking pace when anyone is on foot */
  const speedOf = (info) => (onFoot(info) ? 22 : info.carriage ? 40 : 48);
  function mount(host, info) {
    if (!host) return;
    if (!V) {
      const c = document.createElement("canvas"); c.className = "tripvig-c"; c.setAttribute("aria-hidden", "true");
      V = { canvas: c, info, dist: 0, t: 0, raf: 0, last: 0, visible: true, ema: 8, dt: 0, speed: 0, flash: 0, still: false };
      try {
        if (typeof IntersectionObserver !== "undefined") { V.io = new IntersectionObserver((es) => { for (const e of es) V.visible = e.isIntersecting; if (V.visible) kick(); }); V.io.observe(c); }
        document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
      } catch { /* old browser: just keep animating */ }
    }
    V.info = info;
    if (V.canvas.parentNode !== host) host.appendChild(V.canvas);
    const dpr = typeof FITCANVAS !== "undefined" ? Math.min(6, FITCANVAS.ratio(host, W)) : Math.min(2, window.devicePixelRatio || 1);   // the strip's box on screen x density: sharp in a wide panel too
    if (V.canvas.width !== Math.round(W * dpr)) { V.canvas.width = Math.round(W * dpr); V.canvas.height = Math.round(H * dpr); }
    V.still = !!info.reduce; V.dt = 0; V.speed = 0;
    paint(V, performance.now());
    kick();
  }
  function kick() { if (V && !V.raf && !V.info.reduce) { V.last = 0; V.raf = requestAnimationFrame(loop); } }
  function loop(ts) {
    V.raf = 0;
    if (!V.canvas.isConnected || V.info.reduce || document.hidden || V.visible === false) return;   // off screen: stop, the observer wakes us
    const gap = V.last ? ts - V.last : 16;
    const minGap = V.ema > 9 ? 31 : 0;   // a slow phone: drop to 30 fps
    if (gap >= minGap) {
      const dt = Math.min(0.1, gap / 1000);
      V.last = ts; V.dt = dt; V.t += dt; V.speed = speedOf(V.info); V.dist += V.speed * dt;
      const t0 = performance.now(); paint(V, ts); V.ema = V.ema * 0.92 + (performance.now() - t0) * 0.08;
      if (minGap) { V.raf = -1; setTimeout(() => { if (V.raf === -1) { V.raf = 0; if (!V.info.reduce) V.raf = requestAnimationFrame(loop); } }, 20); return; }   // [perf] at 30 fps, sleep between pictures
    }
    V.raf = requestAnimationFrame(loop);
  }
  /* for tests and screenshots: paint one frame without a host */
  function frame(info, dist = 0, opts = {}) {
    const c = makeCanvas(W * (opts.scale || 1), H * (opts.scale || 1));
    const v = { canvas: c, info, dist, t: opts.t ?? dist / 22, dt: 1 / 60, speed: speedOf(info), flash: 0, still: !!opts.still };
    for (let i = 0; i < (opts.warm || 0); i++) { paint(v, 0); v.t += 1 / 30; v.dist += v.speed / 30; }
    paint(v, 0); return c;
  }
  /* for tests: where everyone stood in the last picture of the live strip (strip units: feet line, each figure's x and
     feet, the name tags after placing) */
  const debug = () => (V && V.dbg ? JSON.parse(JSON.stringify(V.dbg)) : null);
  return { mount, frame, debug, W, H, U, FEET, BIOME, GROUND, figure, weatherKind, speedOf };
})();
