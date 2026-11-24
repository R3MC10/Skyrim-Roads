/* Place art: a painted-in-code scene for every place, town section and dungeon room, in the map's ink-on-parchment
   style (or pixel art, through ART). Cities get their own landmarks; everything else is built from the hold's climate,
   the place's kind or dungeon theme, and a seed from its name so no two look exactly alike. Time of day and weather
   tint outdoor scenes. Pictures are cached per place|daytime|weather|style, so nothing redraws every frame. [OURS] */
const PLACEART = (() => {
  const W = 360, HH = 160, SW = 360, SH = 96;
  const P = ART.PAL;

  // ---------------------------------------------------------------- small building blocks
  const rnd = (seed) => ART.seeded(seed);
  function poly(g, H, pts, fill, stroke = P.ink, w = 1.3) { H.poly(g, pts, fill, stroke, w); }
  function rect(g, H, x, y, w, h, fill, stroke = P.ink, lw = 1.2) { poly(g, H, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, stroke, lw); }
  function ground(g, H, w, h, y, color, seed) {
    const r = rnd(seed + "g"); g.fillStyle = color; g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 20) g.lineTo(x, y + (r() - 0.5) * 6);
    g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
    g.strokeStyle = P.ink; g.lineWidth = 1.1; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 20) g.lineTo(x, y + (r() - 0.5) * 6); g.stroke();
  }
  function smoke(g, x, y) { g.strokeStyle = "rgba(90,80,70,0.45)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x - 6, y - 10, x + 6, y - 18, x - 2, y - 28); g.stroke(); }
  function window_(g, H, x, y, s = 4) { rect(g, H, x, y, s, s * 1.2, P.fire, P.ink, 0.8); }
  /* a Nordic house: timber walls, steep roof, crossed roof beams */
  function house(g, H, x, base, s, r, snowy) {
    const w = 26 * s, h = 14 * s;
    rect(g, H, x, base - h, w, h, P.wood);
    for (let i = 1; i < 3; i++) { g.strokeStyle = P.ink; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x, base - h * i / 3); g.lineTo(x + w, base - h * i / 3); g.stroke(); }
    poly(g, H, [[x - 3 * s, base - h], [x + w / 2, base - h - 13 * s], [x + w + 3 * s, base - h]], snowy ? P.snow : P.inkSoft);
    g.strokeStyle = P.ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + w / 2 - 5 * s, base - h - 18 * s); g.lineTo(x + w / 2 + 3 * s, base - h - 9 * s); g.moveTo(x + w / 2 + 5 * s, base - h - 18 * s); g.lineTo(x + w / 2 - 3 * s, base - h - 9 * s); g.stroke();
    rect(g, H, x + w * 0.4, base - h * 0.62, w * 0.2, h * 0.62, P.inkSoft);
    window_(g, H, x + w * 0.12, base - h * 0.7, 4 * s); window_(g, H, x + w * 0.75, base - h * 0.7, 4 * s);
    if (r() < 0.7) smoke(g, x + w * 0.8, base - h - 8 * s);
  }
  function tower(g, H, x, base, w, h, fill = P.stone) {
    rect(g, H, x, base - h, w, h, fill);
    for (let i = 0; i < 4; i++) rect(g, H, x - 2 + i * (w + 4) / 4, base - h - 5, (w + 4) / 8, 5, fill, P.ink, 1);
    rect(g, H, x + w * 0.4, base - h * 0.75, w * 0.2, h * 0.14, P.night, P.ink, 0.8);
  }
  function wall(g, H, x1, x2, base, h, fill = P.stone) {
    rect(g, H, x1, base - h, x2 - x1, h, fill);
    for (let x = x1; x < x2 - 4; x += 10) rect(g, H, x, base - h - 4, 5, 4, fill, P.ink, 0.9);
    g.strokeStyle = "rgba(59,44,30,0.35)"; g.lineWidth = 0.6;
    for (let y = base - h + 6; y < base; y += 6) { g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); g.stroke(); }
  }
  function banner(g, H, x, y, color = P.blood) { g.strokeStyle = P.ink; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 22); g.stroke(); poly(g, H, [[x, y - 22], [x + 12, y - 19], [x, y - 14]], color, P.ink, 1); }
  function fire(g, H, x, y, s = 1) {
    poly(g, H, [[x - 7 * s, y], [x - 3 * s, y - 10 * s], [x, y - 4 * s], [x + 2 * s, y - 14 * s], [x + 7 * s, y]], P.fire, P.ink, 1);
    poly(g, H, [[x - 3 * s, y], [x, y - 7 * s], [x + 3 * s, y]], "#f6d36a", null);
    g.strokeStyle = P.wood; g.lineWidth = 2.4 * s; g.beginPath(); g.moveTo(x - 9 * s, y + 2); g.lineTo(x + 9 * s, y - 1); g.moveTo(x - 9 * s, y - 1); g.lineTo(x + 9 * s, y + 2); g.stroke();
    const glow = g.createRadialGradient(x, y - 5, 2, x, y - 5, 40 * s); glow.addColorStop(0, "rgba(232,146,58,0.35)"); glow.addColorStop(1, "rgba(232,146,58,0)"); g.fillStyle = glow; g.fillRect(x - 40 * s, y - 45 * s, 80 * s, 80 * s);
  }
  function tent(g, H, x, base, s, color) { poly(g, H, [[x, base], [x + 14 * s, base - 20 * s], [x + 28 * s, base]], color); poly(g, H, [[x + 11 * s, base], [x + 14 * s, base - 10 * s], [x + 17 * s, base]], P.night, P.ink, 0.8); }
  function deciduous(g, H, x, base, s, color) { g.fillStyle = P.wood; g.fillRect(x - 1.5, base - 10 * s, 3, 10 * s); H.circle(g, x, base - 14 * s, 8 * s, color, P.ink, 1); }
  function deadTree(g, x, base, s) { g.strokeStyle = P.inkSoft; g.lineWidth = 2; g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - 22 * s); g.moveTo(x, base - 14 * s); g.lineTo(x - 7 * s, base - 22 * s); g.moveTo(x, base - 17 * s); g.lineTo(x + 6 * s, base - 25 * s); g.stroke(); }
  function water(g, y1, y2, w) { const gr = g.createLinearGradient(0, y1, 0, y2); gr.addColorStop(0, P.water); gr.addColorStop(1, P.sea); g.fillStyle = gr; g.fillRect(0, y1, w, y2 - y1);
    g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 1; for (let i = 0; i < 9; i++) { const x = (i * 47) % w, y = y1 + 4 + (i * 13) % Math.max(4, y2 - y1 - 6); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y); g.stroke(); } }

  // ---------------------------------------------------------------- climate backdrops
  const CLIMATE = { Winterhold: "snow", "The Pale": "snow", Eastmarch: "snow", Whiterun: "tundra", Falkreath: "forest", "The Rift": "autumn", Hjaalmarch: "marsh", "The Reach": "reach", Haafingar: "coast" };
  function climateOf(name) { const p = WORLD.places[name]; if (p && WORLD.isSol?.(p) && typeof SOLART !== "undefined") return SOLART.climateOf(p); return p ? CLIMATE[G.holdAt(p)] || "tundra" : "tundra"; }
  let curSky = null;   // the SKY state while a picture is being drawn
  function backdrop(g, H, w, h, clim, seed, mood) {
    if (curSky) SKY.backdrop(g, H, w, h, curSky, { horizon: 0.62, seed }); else H.sky(g, w, h, mood === "night" ? "night" : clim === "snow" ? "snow" : mood === "dusk" ? "dusk" : "day");
    const mfill = clim === "reach" ? "#9a6e54" : clim === "snow" ? "#9aa3a8" : clim === "ash" ? "#5e524a" : P.rock;
    H.mountains(g, w, h * 0.62, h * 0.42, seed + "m", mfill, clim !== "reach" && clim !== "ash");
    if (clim === "coast") water(g, h * 0.58, h * 0.72, w);
    const groundCol = { snow: "#e8edf0", tundra: "#b9a98d", forest: "#6f8a52", autumn: "#a88a4e", marsh: "#7d8a6a", reach: "#a48468", coast: "#a7a78a", ash: "#8f857b" }[clim] || "#b9a98d";
    ground(g, H, w, h, h * 0.7, groundCol, seed);
    if (curSky && clim !== "snow") SKY.snowCover(g, w, h, h * 0.7, curSky.snow, seed);   // winter snow on the ground, by season
    const r = rnd(seed + "veg");
    if (clim === "forest" || clim === "snow" || clim === "coast") H.pines(g, w, h * 0.72, clim === "forest" ? 16 : 8, seed + "p", 12);
    if (clim === "snow") { g.fillStyle = "rgba(244,246,248,0.7)"; for (let i = 0; i < 10; i++) g.fillRect(r() * w, h * 0.72 + r() * 6, 10, 2); }
    if (clim === "autumn") for (let i = 0; i < 9; i++) deciduous(g, H, r() * w, h * 0.74 + r() * 6, 0.8 + r() * 0.4, ["#c4572e", "#e8923a", "#d6b25e", "#a8622e"][Math.floor(r() * 4)]);
    if (clim === "marsh") { g.fillStyle = "rgba(95,135,151,0.6)"; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(r() * w, h * 0.82 + r() * 10, 26 + r() * 20, 4, 0, 0, 7); g.fill(); } for (let i = 0; i < 4; i++) deadTree(g, r() * w, h * 0.78, 1); }
    if (clim === "tundra") { g.fillStyle = "#8c9a5a"; for (let i = 0; i < 18; i++) g.fillRect(r() * w, h * 0.73 + r() * h * 0.2, 4, 2); }
    if (clim === "ash" && typeof SOLART !== "undefined") SOLART.ashGround(g, H, w, h, r);   // Solstheim's ash drifts and dead trees
    if (clim === "reach") for (let i = 0; i < 3; i++) poly(g, H, [[r() * w, h * 0.74], [r() * w + 12, h * 0.6], [r() * w + 28, h * 0.74]], "#8a5c44");
  }

  // ---------------------------------------------------------------- cities (recognisable features)
  const CITY = {
    Whiterun(g, H, w, h) {
      // a hill in the plains, ringed by walls, Dragonsreach on top
      poly(g, H, [[40, h * 0.74], [130, h * 0.42], [230, h * 0.38], [320, h * 0.74]], "#a99a74");
      wall(g, H, 60, 300, h * 0.74, 14);
      house(g, H, 90, h * 0.6, 0.7, rnd("wr1"), false); house(g, H, 230, h * 0.6, 0.7, rnd("wr2"), false);
      // Dragonsreach: long hall, tall gable, side towers
      rect(g, H, 130, h * 0.26, 100, h * 0.16, P.wood);
      poly(g, H, [[122, h * 0.26], [180, h * 0.06], [238, h * 0.26]], P.inkSoft);
      tower(g, H, 120, h * 0.42, 14, h * 0.2, P.stone); tower(g, H, 226, h * 0.42, 14, h * 0.2, P.stone);
      for (let i = 0; i < 4; i++) window_(g, H, 142 + i * 22, h * 0.32, 5);
      // the Gildergreen
      g.fillStyle = P.wood; g.fillRect(180, h * 0.44, 4, 12); for (const [dx, dy, r] of [[-7, 0, 7], [7, 0, 7], [0, -6, 8]]) H.circle(g, 182 + dx, h * 0.43 + dy, r, "#d9a7c0", P.ink, 0.9);
    },
    Solitude(g, H, w, h) {
      water(g, h * 0.62, h, w);
      // the great rock arch over the water, the Blue Palace on top
      poly(g, H, [[0, h * 0.62], [0, h * 0.4], [70, h * 0.36], [150, h * 0.36], [250, h * 0.3], [330, h * 0.18], [360, h * 0.2], [360, h * 0.62], [320, h * 0.62], [300, h * 0.42], [250, h * 0.38], [200, h * 0.45], [170, h * 0.62]], P.rock);
      g.fillStyle = P.sea; g.beginPath(); g.moveTo(178, h * 0.62); g.quadraticCurveTo(240, h * 0.4, 312, h * 0.62); g.fill();
      wall(g, H, 20, 150, h * 0.38, 10); tower(g, H, 30, h * 0.38, 14, 26); tower(g, H, 118, h * 0.38, 16, 34, "#7f8fa0");
      rect(g, H, 60, h * 0.26, 50, h * 0.1, "#6f86a0"); poly(g, H, [[56, h * 0.26], [85, h * 0.16], [114, h * 0.26]], "#4c6680");
      banner(g, H, 85, h * 0.16 + 4, "#2f4f80");
    },
    Windhelm(g, H, w, h) {
      water(g, h * 0.72, h, w);
      // the long stone bridge on arches, grey walls and the Palace of the Kings
      rect(g, H, 0, h * 0.62, w * 0.6, h * 0.1, "#8a8f94");
      for (let x = 8; x < w * 0.6; x += 34) { g.fillStyle = P.sea; g.beginPath(); g.arc(x + 14, h * 0.72, 11, Math.PI, 0); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 1.2; g.stroke(); }
      wall(g, H, w * 0.5, w, h * 0.7, 36, "#8a8f94");
      tower(g, H, w * 0.55, h * 0.7, 18, 62, "#7b8086"); tower(g, H, w * 0.8, h * 0.7, 26, 82, "#7b8086");
      poly(g, H, [[w * 0.8 - 2, h * 0.7 - 82], [w * 0.8 + 13, h * 0.7 - 104], [w * 0.8 + 28, h * 0.7 - 82]], "#4b5056");
      g.fillStyle = "rgba(244,246,248,0.85)"; g.fillRect(w * 0.5, h * 0.7 - 40, w * 0.5, 3); g.fillRect(0, h * 0.62 - 2, w * 0.6, 2);
      banner(g, H, w * 0.8 + 13, h * 0.7 - 104, "#2c4b7a");
    },
    Riften(g, H, w, h) {
      water(g, h * 0.66, h, w);
      // a wooden town on the lake: canal, docks, autumn trees
      const r = rnd("rift"); for (let i = 0; i < 9; i++) deciduous(g, H, 10 + i * 40 + r() * 10, h * 0.56, 1.1, ["#c4572e", "#e8923a", "#d6b25e"][i % 3]);
      wall(g, H, 30, 330, h * 0.66, 26, P.wood);
      for (let i = 0; i < 4; i++) house(g, H, 50 + i * 70, h * 0.66 - 26, 0.8, rnd("rf" + i), false);
      g.fillStyle = P.sea; g.fillRect(160, h * 0.66 - 8, 40, 8);
      for (let x = 20; x < w; x += 26) { g.fillStyle = P.wood; g.fillRect(x, h * 0.76, 3, 12); }
      rect(g, H, 0, h * 0.76, w, 4, P.wood, P.ink, 0.8);
    },
    Markarth(g, H, w, h) {
      // a city carved into a cliff by the Dwemer: stone terraces, angular doors, waterfalls
      poly(g, H, [[0, h], [0, h * 0.05], [w, h * 0.0], [w, h]], "#b58a62");
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) {
        const x = 30 + i * 80 + (row % 2) * 30, y = h * (0.2 + row * 0.24);
        rect(g, H, x, y, 54, 24, "#c9a578"); poly(g, H, [[x + 20, y + 24], [x + 20, y + 10], [x + 27, y + 4], [x + 34, y + 10], [x + 34, y + 24]], P.night, P.ink, 0.9);
        g.strokeStyle = P.gold; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 4, y + 4); g.lineTo(x + 50, y + 4); g.stroke();
      }
      for (const x of [w * 0.12, w * 0.86]) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(159,208,240,0.95)"); gr.addColorStop(1, "rgba(244,246,248,0.9)"); g.fillStyle = gr; g.fillRect(x, 0, 9, h); }
      water(g, h * 0.88, h, w);
    },
  };

  // ---------------------------------------------------------------- dungeon themes and other kinds
  function hillside(g, H, w, h, fill = P.rock) { poly(g, H, [[0, h * 0.78], [40, h * 0.3], [150, h * 0.12], [260, h * 0.2], [w, h * 0.42], [w, h * 0.78]], fill); }
  const THEME = {
    cave(g, H, w, h) { hillside(g, H, w, h); g.fillStyle = P.night; g.beginPath(); g.ellipse(w / 2, h * 0.7, 46, 40, 0, Math.PI, 0); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 1.6; g.stroke();
      for (let i = 0; i < 6; i++) poly(g, H, [[w / 2 - 36 + i * 13, h * 0.47 + (i % 2) * 4], [w / 2 - 31 + i * 13, h * 0.58], [w / 2 - 26 + i * 13, h * 0.47 + (i % 2) * 4]], P.rock, P.ink, 0.8); },
    barrow(g, H, w, h) { hillside(g, H, w, h, "#8a8172");
      // the great stone door with draugr spiral carvings, braziers either side
      rect(g, H, w / 2 - 42, h * 0.3, 84, h * 0.48, "#9a9384"); poly(g, H, [[w / 2 - 50, h * 0.3], [w / 2, h * 0.14], [w / 2 + 50, h * 0.3]], "#7d766a");
      rect(g, H, w / 2 - 24, h * 0.42, 48, h * 0.36, P.night);
      for (const dx of [-34, 34]) { g.strokeStyle = P.ink; g.lineWidth = 1.2; g.beginPath(); for (let a = 0; a < 12; a += 0.4) { const rr = a * 0.9; g.lineTo(w / 2 + dx + Math.cos(a) * rr, h * 0.5 + Math.sin(a) * rr); } g.stroke(); }
      fire(g, H, w / 2 - 70, h * 0.78, 0.8); fire(g, H, w / 2 + 70, h * 0.78, 0.8); },
    dwemer(g, H, w, h) { hillside(g, H, w, h, "#9a7d5c");
      // bronze gate, gears, pipes and steam
      rect(g, H, w / 2 - 44, h * 0.3, 88, h * 0.48, "#b08a4a"); rect(g, H, w / 2 - 22, h * 0.44, 44, h * 0.34, "#7a5a2a");
      poly(g, H, [[w / 2 - 44, h * 0.3], [w / 2 - 30, h * 0.18], [w / 2 + 30, h * 0.18], [w / 2 + 44, h * 0.3]], "#c49a52");
      for (const [x, y, r] of [[w / 2 - 70, h * 0.4, 14], [w / 2 + 72, h * 0.5, 10]]) { H.circle(g, x, y, r, "#b08a4a"); for (let a = 0; a < 6.28; a += 0.8) { g.fillStyle = "#b08a4a"; g.fillRect(x + Math.cos(a) * r - 2, y + Math.sin(a) * r - 2, 4, 4); } H.circle(g, x, y, r * 0.35, P.inkSoft); }
      g.strokeStyle = "#8a6a32"; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2 + 44, h * 0.36); g.lineTo(w - 30, h * 0.36); g.lineTo(w - 30, h * 0.1); g.stroke();
      g.fillStyle = "rgba(244,246,248,0.6)"; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(w - 30 + i * 3, h * 0.08 - i * 8, 6 + i * 2, 0, 7); g.fill(); } },
    forsworn(g, H, w, h) { hillside(g, H, w, h, "#9a6e54");
      // a stone redoubt with stick walls and a hagraven totem
      for (let x = 60; x < w - 60; x += 9) poly(g, H, [[x, h * 0.78], [x + 3, h * 0.48 - (x % 3) * 4], [x + 6, h * 0.78]], P.wood, P.ink, 0.8);
      const tx = w / 2; g.strokeStyle = P.wood; g.lineWidth = 3; g.beginPath(); g.moveTo(tx, h * 0.8); g.lineTo(tx, h * 0.2); g.stroke();
      H.circle(g, tx, h * 0.24, 7, P.snow); g.fillStyle = P.ink; g.fillRect(tx - 3, h * 0.23, 2, 2); g.fillRect(tx + 1, h * 0.23, 2, 2);
      for (let i = 0; i < 5; i++) poly(g, H, [[tx - 2, h * 0.3 + i * 4], [tx - 14 - i * 2, h * 0.36 + i * 4], [tx - 2, h * 0.34 + i * 4]], P.night, P.ink, 0.6);
      for (let i = 0; i < 5; i++) poly(g, H, [[tx + 2, h * 0.3 + i * 4], [tx + 14 + i * 2, h * 0.36 + i * 4], [tx + 2, h * 0.34 + i * 4]], P.night, P.ink, 0.6); },
    vampire(g, H, w, h) { hillside(g, H, w, h, "#5a5058");
      rect(g, H, w / 2 - 26, h * 0.42, 52, h * 0.36, P.night); poly(g, H, [[w / 2 - 30, h * 0.42], [w / 2, h * 0.3], [w / 2 + 30, h * 0.42]], "#4a4048");
      const glow = g.createRadialGradient(w / 2, h * 0.6, 2, w / 2, h * 0.6, 40); glow.addColorStop(0, "rgba(142,43,37,0.7)"); glow.addColorStop(1, "rgba(142,43,37,0)"); g.fillStyle = glow; g.fillRect(w / 2 - 40, h * 0.3, 80, 80);
      g.fillStyle = P.night; for (let i = 0; i < 5; i++) { const x = 70 + i * 50, y = 20 + (i % 2) * 14; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 6, y - 6, x - 12, y); g.quadraticCurveTo(x - 6, y - 2, x, y + 3); g.quadraticCurveTo(x + 6, y - 2, x + 12, y); g.quadraticCurveTo(x + 6, y - 6, x, y); g.fill(); } },
    mine(g, H, w, h) { hillside(g, H, w, h);
      g.fillStyle = P.night; g.fillRect(w / 2 - 22, h * 0.44, 44, h * 0.34);
      g.fillStyle = P.wood; g.fillRect(w / 2 - 26, h * 0.4, 6, h * 0.38); g.fillRect(w / 2 + 20, h * 0.4, 6, h * 0.38); g.fillRect(w / 2 - 30, h * 0.38, 60, 6);
      g.strokeStyle = P.iron; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2 - 10, h * 0.78); g.lineTo(w / 2 - 60, h); g.moveTo(w / 2 + 10, h * 0.78); g.lineTo(w / 2 + 60, h); g.stroke();
      rect(g, H, w / 2 + 40, h * 0.74, 30, 14, P.iron); H.circle(g, w / 2 + 46, h * 0.9, 4, P.inkSoft); H.circle(g, w / 2 + 64, h * 0.9, 4, P.inkSoft);
      for (let i = 0; i < 4; i++) H.circle(g, w / 2 + 46 + i * 6, h * 0.72, 3, ["#b08a4a", P.steel, P.rock, P.gold][i], P.ink, 0.6); },
    temple(g, H, w, h) { ground(g, H, w, h, h * 0.78, "#a99a84", "tp");
      rect(g, H, w / 2 - 80, h * 0.7, 160, 10, "#cfc4ae");
      for (let i = 0; i < 6; i++) { const x = w / 2 - 72 + i * 28, hh = i === 2 || i === 4 ? 40 : 70; rect(g, H, x, h * 0.7 - hh, 12, hh, "#d9cfba"); }
      poly(g, H, [[w / 2 - 86, h * 0.7 - 70], [w / 2 - 20, h * 0.7 - 92], [w / 2 - 10, h * 0.7 - 70]], "#cfc4ae");
      rect(g, H, w / 2 - 12, h * 0.6, 24, 12, "#b8ac94"); fire(g, H, w / 2, h * 0.6, 0.5); },
    fort(g, H, w, h) { wall(g, H, 40, w - 40, h * 0.78, 34); tower(g, H, 60, h * 0.78, 30, 70); tower(g, H, w - 92, h * 0.78, 34, 84);
      rect(g, H, w / 2 - 16, h * 0.78 - 26, 32, 26, P.night); banner(g, H, w - 75, h * 0.78 - 88); banner(g, H, 75, h * 0.78 - 74); },
    thalmor(g, H, w, h) { ground(g, H, w, h, h * 0.8, "#d9d6cc", "th");
      rect(g, H, w / 2 - 60, h * 0.42, 120, h * 0.38, "#ecebe4"); poly(g, H, [[w / 2 - 66, h * 0.42], [w / 2, h * 0.3], [w / 2 + 66, h * 0.42]], "#c9a75e");
      rect(g, H, w / 2 - 8, h * 0.06, 16, h * 0.26, "#ecebe4"); poly(g, H, [[w / 2 - 10, h * 0.06], [w / 2, h * -0.04], [w / 2 + 10, h * 0.06]], P.gold);
      for (let i = 0; i < 5; i++) rect(g, H, w / 2 - 50 + i * 22, h * 0.5, 8, 18, "#9fd0f0", P.ink, 0.7); },
    banditcamp(g, H, w, h) { for (let x = 20; x < w; x += 8) poly(g, H, [[x, h * 0.74], [x + 3, h * 0.56], [x + 6, h * 0.74]], P.wood, P.ink, 0.6);
      tent(g, H, 40, h * 0.94, 2.6, "#8a6a4a"); tent(g, H, 230, h * 0.94, 3, "#7a4a3a"); fire(g, H, w / 2, h * 0.92, 1.4); banner(g, H, w - 24, h * 0.76, P.blood);
      rect(g, H, 140, h * 0.84, 22, 12, P.wood); H.circle(g, 200, h * 0.9, 6, "#b08a4a"); },
    giantcamp(g, H, w, h) {
      // round hide tents, a big fire, a mammoth
      for (const [x, s] of [[70, 1.6], [130, 1.1]]) { poly(g, H, [[x - 28 * s, h * 0.9], [x, h * 0.9 - 34 * s], [x + 28 * s, h * 0.9]], "#b9a07a"); g.strokeStyle = P.wood; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 4, h * 0.9 - 40 * s); g.lineTo(x + 6, h * 0.9 - 30 * s); g.stroke(); }
      fire(g, H, 190, h * 0.92, 1.3);
      const mx = 280, my = h * 0.74; g.fillStyle = "#6b5640"; g.beginPath(); g.ellipse(mx, my, 40, 26, 0, 0, 7); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 1.4; g.stroke();
      for (const lx of [-24, -10, 10, 24]) rect(g, H, mx + lx - 5, my + 12, 10, 20, "#6b5640");
      H.circle(g, mx - 40, my - 6, 16, "#6b5640"); g.strokeStyle = P.snow; g.lineWidth = 4; g.beginPath(); g.arc(mx - 58, my + 6, 14, -0.4, 1.6); g.stroke();
      g.strokeStyle = "#6b5640"; g.lineWidth = 5; g.beginPath(); g.moveTo(mx - 52, my); g.quadraticCurveTo(mx - 64, my + 18, mx - 56, my + 28); g.stroke(); },
    lair(g, H, w, h) { poly(g, H, [[0, h * 0.85], [120, h * 0.25], [200, h * 0.3], [w, h * 0.85]], P.rock);
      // a curved word wall on the peak
      g.fillStyle = "#9a9384"; g.beginPath(); g.ellipse(170, h * 0.32, 60, 26, 0, Math.PI, 0); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 1.4; g.stroke();
      g.strokeStyle = P.ink; g.lineWidth = 1; for (let i = 0; i < 9; i++) { const x = 124 + i * 10; g.beginPath(); g.moveTo(x, h * 0.26); g.lineTo(x + 4, h * 0.2); g.lineTo(x + 7, h * 0.26); g.stroke(); }
      // a dragon circling
      g.fillStyle = P.ink; const dx = 280, dy = 34; g.beginPath(); g.moveTo(dx - 30, dy); g.quadraticCurveTo(dx - 12, dy - 16, dx, dy - 2); g.quadraticCurveTo(dx + 12, dy - 16, dx + 30, dy); g.quadraticCurveTo(dx + 10, dy - 4, dx + 4, dy + 4); g.lineTo(dx + 12, dy + 12); g.lineTo(dx - 4, dy + 4); g.quadraticCurveTo(dx - 10, dy - 4, dx - 30, dy); g.fill(); },
  };
  // the 13 standing stones: a constellation each (simple point patterns)
  const STARS = [[[0, 0], [1, -1], [2, 0], [1, 1]], [[0, 0], [2, -2], [4, 0], [2, 2], [0, 0]], [[0, 2], [1, 0], [2, 2], [3, 0], [4, 2]], [[0, 0], [1, 2], [2, 0], [3, 2]], [[0, 1], [2, 0], [4, 1], [2, 2]], [[0, 0], [0, 2], [2, 2], [2, 0]], [[0, 2], [2, 0], [4, 2], [2, 3]]];
  function stone(g, H, w, h, name) {
    ground(g, H, w, h, h * 0.8, "#b9a98d", name);
    poly(g, H, [[w / 2 - 22, h * 0.82], [w / 2 - 16, h * 0.2], [w / 2, h * 0.1], [w / 2 + 16, h * 0.2], [w / 2 + 22, h * 0.82]], "#9a9384");
    poly(g, H, [[w / 2 - 60, h * 0.84], [w / 2 - 46, h * 0.5], [w / 2 - 36, h * 0.84]], "#8a8172"); poly(g, H, [[w / 2 + 36, h * 0.84], [w / 2 + 46, h * 0.55], [w / 2 + 60, h * 0.84]], "#8a8172");
    const pat = STARS[Math.floor(rnd(name)() * STARS.length)];
    const glow = g.createRadialGradient(w / 2, h * 0.42, 2, w / 2, h * 0.42, 50); glow.addColorStop(0, "rgba(159,208,240,0.75)"); glow.addColorStop(1, "rgba(159,208,240,0)"); g.fillStyle = glow; g.fillRect(w / 2 - 50, h * 0.42 - 50, 100, 100);
    g.strokeStyle = "#2f5f80"; g.lineWidth = 1.4; g.beginPath(); pat.forEach(([x, y], i) => { const px = w / 2 - 12 + x * 6, py = h * 0.36 + y * 7; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
    pat.forEach(([x, y]) => H.circle(g, w / 2 - 12 + x * 6, h * 0.36 + y * 7, 2.2, P.snow, "#2f5f80", 0.8));
  }
  function shrine(g, H, w, h, name) {
    ground(g, H, w, h, h * 0.8, "#b9a98d", name);
    rect(g, H, w / 2 - 34, h * 0.68, 68, 12, "#b8ac94"); rect(g, H, w / 2 - 10, h * 0.2, 20, h * 0.48, "#cfc4ae"); H.circle(g, w / 2, h * 0.18, 10, "#cfc4ae");
    for (const dx of [-26, -16, 16, 26]) { rect(g, H, w / 2 + dx - 2, h * 0.6, 4, 8, P.snow, P.ink, 0.6); poly(g, H, [[w / 2 + dx - 2, h * 0.6], [w / 2 + dx, h * 0.55], [w / 2 + dx + 2, h * 0.6]], P.fire, null); }
    const glow = g.createRadialGradient(w / 2, h * 0.3, 2, w / 2, h * 0.3, 60); glow.addColorStop(0, "rgba(214,178,94,0.5)"); glow.addColorStop(1, "rgba(214,178,94,0)"); g.fillStyle = glow; g.fillRect(w / 2 - 60, 0, 120, h);
  }
  function hrothgar(g, H, w, h) {
    poly(g, H, [[0, h], [140, h * 0.05], [220, h * 0.0], [w, h]], "#9aa3a8"); poly(g, H, [[110, h * 0.25], [140, h * 0.05], [220, h * 0.0], [250, h * 0.25], [200, h * 0.2], [160, h * 0.28]], P.snow, null);
    wall(g, H, 120, 250, h * 0.5, 20, "#8a8f94"); tower(g, H, 165, h * 0.5, 30, 46, "#7b8086");
    g.strokeStyle = P.inkSoft; g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(40, h); g.quadraticCurveTo(160, h * 0.85, 130, h * 0.5); g.stroke(); g.setLineDash([]);
  }
  function town(g, H, w, h, name, clim) {
    const r = rnd(name), n = 3 + Math.floor(r() * 3), base = h * 0.78;
    for (let i = 0; i < n; i++) house(g, H, 14 + i * (w - 50) / n + r() * 10, base + r() * 4, 1.15 + r() * 0.35, r, clim === "snow");
    g.strokeStyle = P.wood; g.lineWidth = 1.4; g.beginPath(); for (let x = 0; x < w; x += 10) { g.moveTo(x, h * 0.9); g.lineTo(x, h * 0.84); } g.moveTo(0, h * 0.86); g.lineTo(w, h * 0.86); g.stroke();
    if (r() < 0.6) { g.fillStyle = P.wood; g.fillRect(w - 40, h * 0.6, 3, h * 0.3); rect(g, H, w - 52, h * 0.6, 26, 12, "#b08a4a", P.ink, 1); }
  }
  function farm(g, H, w, h, name, clim) {
    const r = rnd(name);
    g.strokeStyle = "#7a6a3a"; g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, h * 0.82 + i * 5); g.lineTo(w * 0.6, h * 0.76 + i * 6); g.stroke(); }
    g.fillStyle = "#c9a24c"; for (let i = 0; i < 30; i++) g.fillRect(r() * w * 0.55, h * 0.78 + r() * h * 0.2, 2, 5);
    house(g, H, w * 0.62, h * 0.8, 1.1, r, clim === "snow");
    poly(g, H, [[w * 0.9 - 12, h * 0.82], [w * 0.9, h * 0.68], [w * 0.9 + 12, h * 0.82]], "#d6b25e");
  }
  function landmark(g, H, w, h, name, clim) {
    if (/Mine/.test(name)) return THEME.mine(g, H, w, h);
    if (/Sanctuary|Temple|Hall|Sky Haven|Weynon/.test(name)) return THEME.temple(g, H, w, h);
    if (/Ruins|Folly|Midden/.test(name)) return THEME.temple(g, H, w, h);
    if (/Grove|Hollow|Greenspring/.test(name)) { const r = rnd(name); for (let i = 0; i < 6; i++) deciduous(g, H, 40 + i * 55 + r() * 10, h * 0.85, 1.6, P.leaf); deciduous(g, H, w / 2, h * 0.9, 3, "#c49ab0"); return; }
    if (/Monument/.test(name)) { rect(g, H, w / 2 - 10, h * 0.3, 20, h * 0.5, "#9a9384"); poly(g, H, [[w / 2 - 10, h * 0.3], [w / 2, h * 0.18], [w / 2 + 10, h * 0.3]], "#9a9384"); return; }
    if (/Meadery|Inn/.test(name)) { house(g, H, w / 2 - 40, h * 0.82, 1.6, rnd(name), clim === "snow"); g.fillStyle = P.wood; g.fillRect(w / 2 + 40, h * 0.5, 3, h * 0.32); rect(g, H, w / 2 + 30, h * 0.5, 26, 12, "#b08a4a", P.ink, 1); return; }
    house(g, H, w / 2 - 30, h * 0.82, 1.3, rnd(name), clim === "snow");
  }

  // ---------------------------------------------------------------- town sections (interiors and street scenes)
  function interior(g, H, w, h) { g.fillStyle = "#4a3a2a"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 1; for (let x = 0; x < w; x += 18) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h * 0.75); g.stroke(); } g.fillStyle = "#5e4a34"; g.fillRect(0, h * 0.75, w, h * 0.25); g.strokeStyle = P.ink; g.beginPath(); g.moveTo(0, h * 0.75); g.lineTo(w, h * 0.75); g.stroke(); }
  function shelf(g, H, x, y, w, r) { rect(g, H, x, y, w, 4, P.wood, P.ink, 0.8); for (let i = 0; i < w / 10; i++) { const k = r(); if (k < 0.4) rect(g, H, x + 2 + i * 10, y - 9, 6, 9, ["#8e2b25", "#2f5f80", "#3d5d36", "#d6b25e"][Math.floor(r() * 4)], P.ink, 0.6); else if (k < 0.7) H.circle(g, x + 5 + i * 10, y - 4, 4, "#b9a07a", P.ink, 0.6); } }
  const SECTION = {
    inn(g, H, w, h) { interior(g, H, w, h); rect(g, H, w / 2 - 40, h * 0.3, 80, h * 0.45, "#6f6a64"); g.fillStyle = P.night; g.fillRect(w / 2 - 26, h * 0.45, 52, h * 0.3); fire(g, H, w / 2, h * 0.75, 1.2);
      for (const x of [50, w - 90]) { rect(g, H, x, h * 0.7, 46, 6, P.wood); g.fillStyle = P.wood; g.fillRect(x + 4, h * 0.76, 4, 14); g.fillRect(x + 38, h * 0.76, 4, 14); rect(g, H, x + 14, h * 0.6, 7, 10, "#b9a07a", P.ink, 0.6); } },
    forge(g, H, w, h) { ground(g, H, w, h, h * 0.75, "#8f7a66", "forge"); g.fillStyle = "#5e4a34"; g.fillRect(0, 0, w, h * 0.75);
      rect(g, H, 40, h * 0.3, 80, h * 0.45, "#6f6a64"); g.fillStyle = "#e8923a"; g.fillRect(55, h * 0.48, 50, h * 0.14); fire(g, H, 80, h * 0.62, 0.9);
      poly(g, H, [[w / 2 - 6, h * 0.62], [w / 2 + 40, h * 0.62], [w / 2 + 50, h * 0.52], [w / 2 - 20, h * 0.52]], P.iron); rect(g, H, w / 2 + 6, h * 0.62, 20, 16, P.iron);
      g.strokeStyle = P.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(w - 80, h * 0.2); g.lineTo(w - 40, h * 0.2); g.stroke(); for (let i = 0; i < 3; i++) rect(g, H, w - 76 + i * 12, h * 0.2, 4, 24, P.steel, P.ink, 0.6); },
    general(g, H, w, h) { interior(g, H, w, h); const r = rnd("gen"); for (let i = 0; i < 3; i++) shelf(g, H, 20, h * (0.25 + i * 0.18), w - 40, r); rect(g, H, 30, h * 0.72, w - 60, 10, P.wood); },
    wizard(g, H, w, h) { interior(g, H, w, h); g.fillStyle = "#2a2a3a"; g.fillRect(0, 0, w, h * 0.75);
      g.strokeStyle = "rgba(159,208,240,0.8)"; g.lineWidth = 1.6; g.beginPath(); g.ellipse(w / 2, h * 0.84, 60, 10, 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(w / 2, h * 0.84, 40, 6, 0, 0, 7); g.stroke();
      const glow = g.createRadialGradient(w / 2, h * 0.5, 2, w / 2, h * 0.5, 60); glow.addColorStop(0, "rgba(201,182,255,0.6)"); glow.addColorStop(1, "rgba(201,182,255,0)"); g.fillStyle = glow; g.fillRect(0, 0, w, h);
      const r = rnd("wiz"); shelf(g, H, 20, h * 0.35, 90, r); shelf(g, H, w - 110, h * 0.5, 90, r); H.circle(g, w / 2, h * 0.5, 10, "#c9b6ff"); },
    alchemy(g, H, w, h) { interior(g, H, w, h); rect(g, H, 40, h * 0.62, w - 80, 10, P.wood);
      const cols = ["#8e2b25", "#2f5f80", "#3d5d36", "#c9b6ff", "#e8923a"]; for (let i = 0; i < 7; i++) { const x = 60 + i * 36; H.circle(g, x, h * 0.55, 7, cols[i % 5], P.ink, 0.8); rect(g, H, x - 2, h * 0.4, 4, 8, P.snow, P.ink, 0.6); }
      g.strokeStyle = "#3d5d36"; g.lineWidth = 1.2; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(20 + i * 34, 0); g.lineTo(24 + i * 34, 18 + (i % 3) * 6); g.stroke(); } },
    market(g, H, w, h) { ground(g, H, w, h, h * 0.75, "#a99a84", "mk"); H.sky(g, w, h * 0.75, "day");
      for (let i = 0; i < 3; i++) { const x = 20 + i * 115; rect(g, H, x, h * 0.5, 96, h * 0.25, P.wood); g.fillStyle = P.wood; g.fillRect(x, h * 0.18, 4, h * 0.32); g.fillRect(x + 92, h * 0.18, 4, h * 0.32);
        for (let k = 0; k < 6; k++) poly(g, H, [[x - 4 + k * 17, h * 0.18], [x + 13 + k * 17, h * 0.18], [x + 4.5 + k * 17, h * 0.3]], k % 2 ? P.snow : ["#8e2b25", "#2f5f80", "#3d5d36"][i], P.ink, 0.8);
        for (let k = 0; k < 4; k++) H.circle(g, x + 16 + k * 20, h * 0.47, 6, ["#e8923a", "#d6b25e", "#8e2b25", P.leaf][(k + i) % 4], P.ink, 0.6); } },
    mine(g, H, w, h) { THEME.mine(g, H, w, h); },
    arena(g, H, w, h) { H.sky(g, w, h, "day"); g.fillStyle = "#d9c89a"; g.beginPath(); g.ellipse(w / 2, h * 0.86, w * 0.48, h * 0.2, 0, 0, 7); g.fill();
      wall(g, H, 0, w, h * 0.66, 40, "#8a8f94"); for (let x = 20; x < w; x += 60) banner(g, H, x, h * 0.26, x % 120 ? "#2c4b7a" : P.blood);
      g.strokeStyle = P.steel; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2 - 20, h * 0.95); g.lineTo(w / 2 + 20, h * 0.7); g.moveTo(w / 2 + 20, h * 0.95); g.lineTo(w / 2 - 20, h * 0.7); g.stroke(); },
    hall(g, H, w, h) { interior(g, H, w, h); rect(g, H, w / 2 - 70, h * 0.62, 140, 8, P.wood); fire(g, H, w / 2, h * 0.86, 1.4);
      for (const x of [w * 0.2, w * 0.8]) { g.fillStyle = "#2c4b7a"; g.fillRect(x - 12, h * 0.08, 24, h * 0.42); poly(g, H, [[x - 12, h * 0.5], [x, h * 0.58], [x + 12, h * 0.5]], "#2c4b7a"); H.circle(g, x, h * 0.24, 6, P.gold); } },
    fence(g, H, w, h) { interior(g, H, w, h); g.fillStyle = "rgba(0,0,0,0.4)"; g.fillRect(0, 0, w, h); fire(g, H, w * 0.2, h * 0.8, 0.7); rect(g, H, w * 0.4, h * 0.6, 160, 12, P.wood); const r = rnd("fn"); shelf(g, H, w * 0.45, h * 0.35, 140, r); },
    stables(g, H, w, h) { ground(g, H, w, h, h * 0.75, "#b9a98d", "st"); H.sky(g, w, h * 0.75, "day"); rect(g, H, 20, h * 0.3, 140, h * 0.45, P.wood); poly(g, H, [[10, h * 0.3], [90, h * 0.12], [170, h * 0.3]], P.inkSoft);
      const hx = 250, hy = h * 0.62; g.fillStyle = "#6b4a30"; g.beginPath(); g.ellipse(hx, hy, 34, 14, 0, 0, 7); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 1.2; g.stroke();
      for (const lx of [-24, -12, 14, 26]) { g.fillStyle = "#6b4a30"; g.fillRect(hx + lx - 2, hy + 8, 5, 22); }
      poly(g, H, [[hx + 24, hy - 6], [hx + 40, hy - 30], [hx + 50, hy - 28], [hx + 36, hy + 2]], "#6b4a30");
      poly(g, H, [[hx + 38, hy - 32], [hx + 60, hy - 24], [hx + 58, hy - 18], [hx + 44, hy - 22]], "#6b4a30");
      g.strokeStyle = P.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(hx + 26, hy - 8); g.lineTo(hx + 40, hy - 32); g.moveTo(hx - 34, hy - 4); g.quadraticCurveTo(hx - 46, hy + 4, hx - 42, hy + 22); g.stroke(); },
    home(g, H, w, h) { interior(g, H, w, h); rect(g, H, 40, h * 0.56, 110, 22, "#7a5a8a"); rect(g, H, 40, h * 0.5, 30, 10, P.snow); fire(g, H, w - 70, h * 0.8, 1); rect(g, H, w / 2, h * 0.6, 60, 30, P.wood); },
  };
  SECTION.blacksmith = SECTION.forge; SECTION.enchanter = SECTION.wizard;

  // ---------------------------------------------------------------- dungeon rooms
  function corridor(g, H, w, h) { g.fillStyle = "#241c16"; g.fillRect(0, 0, w, h); poly(g, H, [[0, 0], [w * 0.3, h * 0.25], [w * 0.7, h * 0.25], [w, 0]], "#3b2f24", null); poly(g, H, [[0, h], [w * 0.3, h * 0.75], [w * 0.7, h * 0.75], [w, h]], "#4a3a2a", null);
    g.fillStyle = "#14100c"; g.fillRect(w * 0.3, h * 0.25, w * 0.4, h * 0.5); g.strokeStyle = "rgba(233,220,192,0.15)"; g.lineWidth = 1; for (const [a, b] of [[0, 0], [w, 0], [0, h], [w, h]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(a ? w * 0.7 : w * 0.3, b ? h * 0.75 : h * 0.25); g.stroke(); } }
  function torch(g, H, x, y) { fire(g, H, x, y, 0.5); g.fillStyle = P.wood; g.fillRect(x - 1.5, y, 3, 12); }
  const ROOM = {
    fight(g, H, w, h) { corridor(g, H, w, h); torch(g, H, w * 0.15, h * 0.4); torch(g, H, w * 0.85, h * 0.4);
      g.strokeStyle = P.steel; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2 - 22, h * 0.72); g.lineTo(w / 2 + 22, h * 0.28); g.moveTo(w / 2 + 22, h * 0.72); g.lineTo(w / 2 - 22, h * 0.28); g.stroke();
      g.fillStyle = P.wood; g.fillRect(w / 2 - 26, h * 0.66, 10, 4); g.fillRect(w / 2 + 16, h * 0.66, 10, 4); },
    elite(g, H, w, h) { ROOM.fight(g, H, w, h); H.circle(g, w / 2, h * 0.5, 12, P.snow); g.fillStyle = P.ink; g.fillRect(w / 2 - 6, h * 0.47, 4, 4); g.fillRect(w / 2 + 2, h * 0.47, 4, 4); },
    trap(g, H, w, h) { corridor(g, H, w, h); for (let i = 0; i < 9; i++) poly(g, H, [[w * 0.32 + i * 15, h * 0.78], [w * 0.32 + i * 15 + 7, h * 0.62], [w * 0.32 + i * 15 + 14, h * 0.78]], P.steel, P.ink, 0.8);
      g.strokeStyle = P.iron; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, h * 0.25); g.lineTo(w / 2 + 30, h * 0.5); g.stroke(); g.fillStyle = P.steel; g.beginPath(); g.arc(w / 2 + 30, h * 0.5, 16, -0.5, 2.6); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 1; g.stroke(); },
    treasure(g, H, w, h) { corridor(g, H, w, h); const glow = g.createRadialGradient(w / 2, h * 0.62, 4, w / 2, h * 0.62, 70); glow.addColorStop(0, "rgba(214,178,94,0.65)"); glow.addColorStop(1, "rgba(214,178,94,0)"); g.fillStyle = glow; g.fillRect(0, 0, w, h);
      rect(g, H, w / 2 - 34, h * 0.55, 68, h * 0.25, P.wood); g.fillStyle = P.wood; g.beginPath(); g.ellipse(w / 2, h * 0.55, 34, 12, 0, Math.PI, 0); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = P.gold; g.fillRect(w / 2 - 34, h * 0.62, 68, 4); g.fillRect(w / 2 - 4, h * 0.58, 8, 10); for (let i = 0; i < 6; i++) H.circle(g, w / 2 - 50 + i * 20, h * 0.84, 4, P.gold, P.ink, 0.6); },
    puzzle(g, H, w, h) { corridor(g, H, w, h); const sym = ["", "", ""]; for (let i = 0; i < 3; i++) { const x = w * 0.3 + i * w * 0.2; rect(g, H, x - 12, h * 0.35, 24, h * 0.4, "#9a9384"); H.circle(g, x, h * 0.5, 7, null, "#2f5f80", 1.6); g.strokeStyle = "#2f5f80"; g.beginPath(); g.moveTo(x - 4, h * 0.5); g.lineTo(x + 4, h * 0.5); g.stroke(); } void sym; },
    rest(g, H, w, h) { corridor(g, H, w, h); fire(g, H, w / 2, h * 0.78, 1.4); rect(g, H, w * 0.15, h * 0.72, 60, 12, "#7a5a8a"); },
    mystery(g, H, w, h) { corridor(g, H, w, h); g.fillStyle = "rgba(201,182,255,0.25)"; g.fillRect(0, 0, w, h); g.fillStyle = P.snow; g.font = "bold 40px serif"; g.textAlign = "center"; g.fillText("?", w / 2, h * 0.62); },
    boss(g, H, w, h) { g.fillStyle = "#1c1410"; g.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) rect(g, H, 20 + i * 80, h * 0.1, 14, h * 0.7, "#3b2f24");
      rect(g, H, w / 2 - 30, h * 0.35, 60, h * 0.4, "#4a3a2a"); poly(g, H, [[w / 2 - 34, h * 0.35], [w / 2, h * 0.15], [w / 2 + 34, h * 0.35]], "#4a3a2a"); rect(g, H, w / 2 - 20, h * 0.55, 40, 10, P.blood);
      fire(g, H, w * 0.2, h * 0.85, 1); fire(g, H, w * 0.8, h * 0.85, 1); rect(g, H, 0, h * 0.85, w, h * 0.15, "#2a2018", null); },
  };

  // ---------------------------------------------------------------- time of day and weather on top of outdoor scenes
  function mood() { const t = G.now(); if (G.isNight(t)) return "night"; const hr = G.clock(t).hour; return hr < 8 || hr >= 18 ? "dusk" : "day"; }
  function overlay(g, H, w, h, md, wx, seed) {
    if (md === "night") { g.fillStyle = "rgba(20,26,40,0.5)"; g.fillRect(0, 0, w, h); H.circle(g, w - 40, 26, 10, "#f4f0d8", null); const r = rnd(seed + "s"); g.fillStyle = "#f4f6f8"; for (let i = 0; i < 24; i++) g.fillRect(r() * w, r() * h * 0.4, 1.4, 1.4); }
    else if (md === "dusk") { g.fillStyle = "rgba(196,87,46,0.14)"; g.fillRect(0, 0, w, h); }
    const r = rnd(seed + "w");
    if (wx === "snow" || wx === "blizzard") { g.fillStyle = "rgba(255,255,255,0.9)"; for (let i = 0; i < (wx === "blizzard" ? 140 : 60); i++) g.fillRect(r() * w, r() * h, 2, 2); if (wx === "blizzard") { g.fillStyle = "rgba(230,236,240,0.35)"; g.fillRect(0, 0, w, h); } }
    if (wx === "rain" || wx === "storm") { g.strokeStyle = "rgba(200,214,224,0.55)"; g.lineWidth = 1; for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 9); g.stroke(); } g.fillStyle = "rgba(40,50,60,0.18)"; g.fillRect(0, 0, w, h); }
    if (wx === "fog") { const gr = g.createLinearGradient(0, h * 0.3, 0, h); gr.addColorStop(0, "rgba(230,232,232,0.1)"); gr.addColorStop(1, "rgba(230,232,232,0.7)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    if (wx === "cloudy") { g.fillStyle = "rgba(120,128,136,0.15)"; g.fillRect(0, 0, w, h); }
  }
  function frame(g, w, h) { g.strokeStyle = P.ink; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); }

  // ---------------------------------------------------------------- what a place is
  function kindOf(name) { return WORLD.places[name]?.[2] || null; }
  function drawerFor(name) {
    const kind = kindOf(name);
    if (CITY[name]) return { outdoor: true, back: name === "Whiterun" || name === "Riften", draw: CITY[name] };
    if (name === "High Hrothgar") return { outdoor: true, back: false, draw: hrothgar };
    if (kind === "stone" || (typeof POWERS !== "undefined" && POWERS.STONE_AT?.[name])) return { outdoor: true, back: false, draw: (g, H, w, h) => stone(g, H, w, h, name) };
    if (kind === "shrine") return { outdoor: true, back: false, draw: (g, H, w, h) => shrine(g, H, w, h, name) };
    const th = typeof DUNGEONS !== "undefined" ? DUNGEONS.info(name)?.theme : null;
    if (th && THEME[th]) return { outdoor: true, back: true, draw: THEME[th] };
    if (kind === "town" || kind === "city") return { outdoor: true, back: true, draw: (g, H, w, h, clim) => town(g, H, w, h, name, clim) };
    if (kind === "farm") return { outdoor: true, back: true, draw: (g, H, w, h, clim) => farm(g, H, w, h, name, clim) };
    if (kind === "fort") return { outdoor: true, back: true, draw: THEME.fort };
    if (kind === "camp") return { outdoor: true, back: true, draw: THEME.banditcamp };
    if (kind === "lair") return { outdoor: true, back: true, draw: THEME.lair };
    return { outdoor: true, back: true, draw: (g, H, w, h, clim) => landmark(g, H, w, h, name, clim) };
  }
  /* light and atmosphere over the finished picture (lightfx.js) */
  const lit = (g, w, h, st, name) => { if (typeof LIGHTFX !== "undefined") LIGHTFX.picture(g, w, h, st, { seed: name, ground: h * 0.7 }); };
  function weatherId(name) { try { const p = WORLD.places[name]; return p && typeof WEVENTS !== "undefined" ? WEVENTS.weather(p).id : "clear"; } catch { return "clear"; } }

  /* the big picture for a place (360×160), as an <img> string */
  function scene(name, opts = {}) {
    if (!name || !WORLD.places[name]) return "";
    const d = drawerFor(name), clim = climateOf(name);
    const fest = typeof FXART !== "undefined" && ["town", "city"].includes(kindOf(name)) ? FXART.festId() : null;   // festival decorations (fxart.js)
    const deco = (g, H, w, h) => { if (fest) FXART.festDecor(g, H, w, h, fest, name); };
    const pic = typeof ASSETS !== "undefined" ? ASSETS.img(ASSETS.placeKey(name) || ASSETS.biomeKey(name)) : null;   // a painted backdrop dropped in the game folder
    if (typeof SKY !== "undefined") {   // shared sky: time of day, season, weather, moons and aurora
      const st = SKY.forOpts(WORLD.places[name], { mood: opts.mood, tod: opts.tod, weather: opts.weather, season: opts.season });
      const draw = (g, H, w, h) => {
        curSky = st;
        try {
          if (pic) { ASSETS.cover(g, pic, w, h, 0.5, 0.55); deco(g, H, w, h); SKY.overlay(g, H, w, h, st, { seed: name, ground: h * 0.7, cover: false }); lit(g, w, h, st, name); frame(g, w, h); return; }   // a painted backdrop
          if (d.back) backdrop(g, H, w, h, clim, name, SKY.mood(st)); else SKY.backdrop(g, H, w, h, st, { horizon: 0.62, seed: name });
          d.draw(g, H, w, h, clim); deco(g, H, w, h);
          SKY.overlay(g, H, w, h, st, { seed: name, ground: h * 0.7, cover: false }); lit(g, w, h, st, name); frame(g, w, h);
        } finally { curSky = null; }
      };
      return ART.html(W, HH, draw, { key: `place|${name}|${st.key}|${fest || ""}|${pic ? "pic" : ""}|${typeof LIGHTFX !== "undefined" ? LIGHTFX.key() : ""}`, cls: "scene", alt: name, style: opts.style, painted: !!pic });
    }
    const md = opts.mood || mood(), wx = opts.weather || weatherId(name);
    const draw = (g, H, w, h) => {
      if (d.back) backdrop(g, H, w, h, clim, name, md); else H.sky(g, w, h, md === "night" ? "night" : clim === "snow" ? "snow" : md === "dusk" ? "dusk" : "day");
      d.draw(g, H, w, h, clim); deco(g, H, w, h);
      overlay(g, H, w, h, md, wx, name); frame(g, w, h);
    };
    return ART.html(W, HH, draw, { key: `place|${name}|${md}|${wx}|${fest || ""}`, cls: "scene", alt: name, style: opts.style });
  }
  /* a slimmer banner for a town section (360×96); null when there's no picture for it */
  const SHOP_PIC = { blacksmith: "forge", enchanter: "wizard" };   // town sections that share a painted banner
  function section(id, opts = {}) {
    const d = SECTION[id];
    const pic = typeof ASSETS !== "undefined" ? ASSETS.img("shop-" + (SHOP_PIC[id] || id)) : null;   // a painted banner dropped in the game folder
    if (!d && !pic) return "";
    const fest = typeof FXART !== "undefined" ? FXART.festId() : null;
    return ART.html(SW, SH, (g, H, w, h) => { if (pic) ASSETS.cover(g, pic, w, h, 0.5, 0.5); else d(g, H, w, h); if (fest) FXART.festSection(g, H, w, h, fest, id); frame(g, w, h); },
      { key: `sec|${id}|${fest || ""}|${pic ? "pic" : ""}`, cls: "scene sec", alt: id, style: opts.style, painted: !!pic });
  }
  function room(type, opts = {}) {
    const d = ROOM[type] || ROOM.mystery;
    return ART.html(SW, SH, (g, H, w, h) => { d(g, H, w, h); frame(g, w, h); }, { key: `room|${type}`, cls: "scene sec", alt: type, style: opts.style });
  }
  return { scene, section, room, drawerFor, climateOf, CITY, THEME, SECTION, ROOM, W, HH };
})();
