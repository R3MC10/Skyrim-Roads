/* Event art: a painted-in-code picture for every road event and story moment, in the same ink-on-parchment style as
   the map (or pixel art, through ART). Road events stand on a backdrop that matches the ground you're on (forest,
   snow, tundra, marsh, ash, rocky hills…), lit for the time of day and the weather. Story moments (quests, the
   dragon falling, the Change, Word Walls…) get a small vignette above the popup text. Everything is cached by
   event|variant|ground|daytime|weather|style, so nothing redraws every frame. [OURS] */
const EVENTART = (() => {
  const W = 360, H0 = 150;
  const P = ART.PAL;
  const rnd = (seed) => ART.seeded(seed);

  // ---------------------------------------------------------------- building blocks
  const poly = (g, H, pts, fill, stroke = P.ink, w = 1.3) => H.poly(g, pts, fill, stroke, w);
  const rect = (g, H, x, y, w, h, fill, stroke = P.ink, lw = 1.2) => poly(g, H, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, stroke, lw);
  const line = (g, pts, w = 1.4, c = P.ink) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
  function glow(g, x, y, r, rgb, a = 0.4) { const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  function fire(g, H, x, y, s = 1, lit = true) {
    g.strokeStyle = P.wood; g.lineWidth = 2.6 * s; g.beginPath(); g.moveTo(x - 10 * s, y + 2); g.lineTo(x + 10 * s, y - 1); g.moveTo(x - 10 * s, y - 1); g.lineTo(x + 10 * s, y + 2); g.stroke();
    for (let i = -1; i <= 1; i++) H.circle(g, x + i * 12 * s, y + 3, 3 * s, P.rock, P.ink, 0.8);
    if (!lit) { g.fillStyle = "rgba(90,80,70,0.55)"; g.beginPath(); g.ellipse(x, y, 8 * s, 2.5 * s, 0, 0, 7); g.fill(); return; }
    glow(g, x, y - 6 * s, 42 * s, "232,146,58", 0.35);
    poly(g, H, [[x - 7 * s, y], [x - 3 * s, y - 10 * s], [x, y - 4 * s], [x + 2 * s, y - 15 * s], [x + 7 * s, y]], P.fire, P.ink, 1);
    poly(g, H, [[x - 3 * s, y], [x, y - 7 * s], [x + 3 * s, y]], "#f6d36a", null);
  }
  function smoke(g, x, y, s = 1) { g.strokeStyle = "rgba(110,100,90,0.45)"; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x - 7 * s, y - 12 * s, x + 7 * s, y - 20 * s, x - 2 * s, y - 32 * s); g.stroke(); }
  function shadow(g, x, y, w) { g.fillStyle = "rgba(40,30,20,0.22)"; g.beginPath(); g.ellipse(x, y, w, w * 0.22, 0, 0, 7); g.fill(); }

  /* a standing or sitting person: o = {body, legs, skin, hood, helm, cape, s, face (1 right / -1 left), arm: "spear"|"lute"|"wave"|"hold"|"down"} */
  function person(g, H, x, base, o = {}) {
    const s = o.s || 1, body = o.body || P.leather, legs = o.legs || P.inkSoft, skin = o.skin || P.skin[0], f = o.face || 1;
    shadow(g, x, base + 1, 9 * s);
    if (o.cape) poly(g, H, [[x - 6 * s, base - 30 * s], [x + 6 * s, base - 30 * s], [x + 9 * s, base - 4 * s], [x - 9 * s, base - 4 * s]], o.cape, P.ink, 1);
    if (o.sit) {
      rect(g, H, x - 5 * s, base - 7 * s, 16 * s * f, 6 * s, legs, P.ink, 1);
      rect(g, H, x - 6 * s, base - 26 * s, 12 * s, 20 * s, body, P.ink, 1.1);
    } else {
      rect(g, H, x - 5 * s, base - 14 * s, 4 * s, 14 * s, legs, P.ink, 1); rect(g, H, x + 1 * s, base - 14 * s, 4 * s, 14 * s, legs, P.ink, 1);
      rect(g, H, x - 6 * s, base - 32 * s, 12 * s, 19 * s, body, P.ink, 1.1);
    }
    const top = o.sit ? base - 26 * s : base - 32 * s;
    g.fillStyle = P.inkSoft; g.fillRect(x - 6 * s, top + 11 * s, 12 * s, 2 * s);   // belt
    H.circle(g, x, top - 6 * s, 5.2 * s, skin, P.ink, 1);
    g.fillStyle = P.ink; g.fillRect(x + 1.6 * s * f, top - 7 * s, 1.2 * s, 1.2 * s);
    if (o.hood) poly(g, H, [[x - 6.5 * s, top - 2 * s], [x - 5 * s, top - 11 * s], [x, top - 13.5 * s], [x + 5 * s, top - 11 * s], [x + 6.5 * s, top - 2 * s], [x + 4 * s * f, top - 4 * s], [x - 3 * s * f, top - 9 * s]], o.hood, P.ink, 1);
    if (o.helm) { poly(g, H, [[x - 6 * s, top - 5 * s], [x - 5.5 * s, top - 10 * s], [x, top - 12.5 * s], [x + 5.5 * s, top - 10 * s], [x + 6 * s, top - 5 * s]], o.helm, P.ink, 1); }
    if (o.hair) poly(g, H, [[x - 5.4 * s, top - 6 * s], [x - 4 * s, top - 11 * s], [x + 4 * s, top - 11 * s], [x + 5.4 * s, top - 6 * s], [x + 3 * s, top - 9 * s], [x - 3 * s, top - 9 * s]], o.hair, P.ink, 0.8);
    const sh = top + 2 * s, hx = x + 6 * s * f;
    if (o.arm === "spear") { line(g, [[hx, sh], [hx + 3 * s * f, sh + 9 * s]], 3 * s, body); line(g, [[hx + 4 * s * f, base], [hx + 4 * s * f, top - 26 * s]], 1.8 * s, P.wood); poly(g, H, [[hx + 2 * s * f, top - 25 * s], [hx + 4 * s * f, top - 33 * s], [hx + 6 * s * f, top - 25 * s]], P.steel, P.ink, 0.9); }
    else if (o.arm === "wave") line(g, [[hx, sh], [hx + 6 * s * f, sh - 9 * s]], 3 * s, body);
    else if (o.arm === "hold") line(g, [[hx, sh], [hx + 7 * s * f, sh + 5 * s]], 3 * s, body);
    else if (o.arm !== "none") line(g, [[hx, sh], [hx + 1 * s * f, sh + 12 * s]], 3 * s, body);
  }
  /* a person lying down asleep (or hurt) */
  function sleeper(g, H, x, base, o = {}) {
    const s = o.s || 1;
    shadow(g, x + 8 * s, base + 1, 20 * s);
    rect(g, H, x - 8 * s, base - 8 * s, 28 * s, 8 * s, o.body || P.leather, P.ink, 1.1);
    rect(g, H, x + 18 * s, base - 6 * s, 14 * s, 6 * s, o.legs || P.inkSoft, P.ink, 1);
    H.circle(g, x - 13 * s, base - 5 * s, 5 * s, o.skin || P.skin[1], P.ink, 1);
    if (o.helm) poly(g, H, [[x - 18 * s, base - 5 * s], [x - 15 * s, base - 11 * s], [x - 9 * s, base - 9 * s]], o.helm, P.ink, 0.9);
  }
  function tree(g, H, x, base, s, kind) {
    if (kind === "pine") { poly(g, H, [[x - 8 * s, base], [x, base - 26 * s], [x + 8 * s, base]], P.forest, P.ink, 1); g.fillStyle = P.wood; g.fillRect(x - 1.2, base, 2.4, 3 * s); return; }
    if (kind === "dead") { line(g, [[x, base], [x, base - 24 * s], [x - 8 * s, base - 32 * s]], 2, P.inkSoft); line(g, [[x, base - 16 * s], [x + 9 * s, base - 24 * s]], 1.6, P.inkSoft); return; }
    g.fillStyle = P.wood; g.fillRect(x - 1.5, base - 12 * s, 3, 12 * s); H.circle(g, x, base - 17 * s, 9 * s, kind || P.leaf, P.ink, 1);
  }

  // ---------------------------------------------------------------- the land around you
  const GROUND = {
    Grassland: ["#9aa463", "day"], Tundra: ["#b9a98d", "day"], Forest: ["#6f8a52", "day"], "Pine forest": ["#5f7a4c", "day"], "Autumn forest": ["#a88a4e", "day"],
    Marsh: ["#7d8a6a", "day"], Snow: ["#e8edf0", "snow"], "Volcanic tundra": ["#8a7f72", "day"], "Rocky hills": ["#a49580", "day"], Mountains: ["#9b8c78", "day"], "High peaks": ["#d8dee2", "snow"],
    Road: ["#b9a98d", "day"], Bridge: ["#9aa463", "day"], "River (ford)": ["#9aa463", "day"], Lake: ["#9aa463", "day"], Sea: ["#a7a78a", "day"],
  };
  function groundHere(pos) { try { return Terrain.NAMES[Terrain.typeAtPos(pos)] || "Tundra"; } catch { return "Tundra"; } }
  function moodNow() { try { const t = G.now(); if (G.isNight(t)) return "night"; const hr = G.clock(t).hour; return hr < 8 || hr >= 18 ? "dusk" : "day"; } catch { return "day"; } }
  function weatherHere(pos) { try { return typeof WEVENTS !== "undefined" ? WEVENTS.weather(pos).id : "clear"; } catch { return "clear"; } }
  let curSky = null;   // the SKY state while a road picture is drawn
  function backdrop(g, H, w, h, ground, md, seed, road = true) {
    const [col, skyK] = GROUND[ground] || GROUND.Tundra;
    if (curSky) SKY.backdrop(g, H, w, h, curSky, { horizon: 0.6, seed }); else H.sky(g, w, h, md === "night" ? "night" : skyK === "snow" ? "snow" : md === "dusk" ? "dusk" : "day");
    const snowy = /Snow|peaks/.test(ground), ash = ground === "Volcanic tundra" || ground === "Ash wastes";
    H.mountains(g, w, h * 0.6, h * (ground === "Mountains" || ground === "High peaks" || ground === "Rocky hills" ? 0.5 : 0.36), seed + "m", ash ? "#6f6a64" : snowy ? "#9aa3a8" : P.rock, !ash);
    const r = rnd(seed + "gnd");
    g.fillStyle = col; g.beginPath(); g.moveTo(0, h * 0.62);
    for (let x = 0; x <= w; x += 24) g.lineTo(x, h * 0.62 + (r() - 0.5) * 5);
    g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
    line(g, [[0, h * 0.62], [w, h * 0.62]], 1, "rgba(59,44,30,0.45)");
    if (/Forest|forest/.test(ground) || snowy) for (let i = 0; i < 9; i++) tree(g, H, r() * w, h * 0.64 + r() * 4, 0.6 + r() * 0.3, ground === "Autumn forest" ? ["#c4572e", "#e8923a", "#d6b25e"][i % 3] : "pine");
    if (ground === "Marsh") { g.fillStyle = "rgba(95,135,151,0.6)"; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(r() * w, h * 0.72 + r() * 18, 22 + r() * 18, 3.5, 0, 0, 7); g.fill(); } for (let i = 0; i < 3; i++) tree(g, H, r() * w, h * 0.66, 0.8, "dead"); }
    if (ash) { g.fillStyle = "rgba(60,55,50,0.35)"; for (let i = 0; i < 12; i++) g.fillRect(r() * w, h * 0.66 + r() * h * 0.3, 6, 2); }
    if (ground === "Tundra" || ground === "Grassland" || ground === "Road") { g.fillStyle = "#8c9a5a"; for (let i = 0; i < 16; i++) g.fillRect(r() * w, h * 0.66 + r() * h * 0.3, 4, 2); }
    if (snowy) { g.fillStyle = "rgba(255,255,255,0.75)"; for (let i = 0; i < 10; i++) g.fillRect(r() * w, h * 0.66 + r() * h * 0.3, 10, 2); }
    if (curSky && !snowy) SKY.snowCover(g, w, h, h * 0.62, curSky.snow, seed);   // seasonal snow on the ground
    if (road) {   // the road runs across the foreground
      g.fillStyle = snowy ? "#cfc6b4" : "#c6b48e"; g.beginPath(); g.moveTo(0, h * 0.86); g.bezierCurveTo(w * 0.3, h * 0.8, w * 0.6, h * 0.92, w, h * 0.84); g.lineTo(w, h * 0.95); g.bezierCurveTo(w * 0.6, h, w * 0.3, h * 0.9, 0, h * 0.97); g.closePath(); g.fill();
      g.strokeStyle = "rgba(59,44,30,0.35)"; g.lineWidth = 1; g.stroke();
    }
  }
  function overlay(g, H, w, h, md, wx, seed) {
    if (md === "night") { g.fillStyle = "rgba(20,26,40,0.48)"; g.fillRect(0, 0, w, h); H.circle(g, w - 36, 24, 9, "#f4f0d8", null); const r = rnd(seed + "st"); g.fillStyle = "#f4f6f8"; for (let i = 0; i < 20; i++) g.fillRect(r() * w, r() * h * 0.45, 1.4, 1.4); }
    else if (md === "dusk") { g.fillStyle = "rgba(196,87,46,0.13)"; g.fillRect(0, 0, w, h); }
    const r = rnd(seed + "wx");
    if (wx === "snow" || wx === "blizzard") { g.fillStyle = "rgba(255,255,255,0.9)"; for (let i = 0; i < (wx === "blizzard" ? 130 : 55); i++) g.fillRect(r() * w, r() * h, 2, 2); if (wx === "blizzard") { g.fillStyle = "rgba(235,240,244,0.35)"; g.fillRect(0, 0, w, h); } }
    if (wx === "rain" || wx === "storm") { g.strokeStyle = "rgba(200,214,224,0.55)"; g.lineWidth = 1; for (let i = 0; i < 60; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 9); g.stroke(); } if (wx === "storm") { g.fillStyle = "rgba(40,48,60,0.22)"; g.fillRect(0, 0, w, h); } }
    if (wx === "fog") { const gr = g.createLinearGradient(0, h * 0.3, 0, h); gr.addColorStop(0, "rgba(230,232,232,0.1)"); gr.addColorStop(1, "rgba(230,232,232,0.65)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    if (wx === "cloudy") { g.fillStyle = "rgba(120,128,136,0.14)"; g.fillRect(0, 0, w, h); }
  }
  const frame = (g, w, h) => { g.strokeStyle = P.ink; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); };

  // ---------------------------------------------------------------- the gods' signs for roadside shrines
  function godSign(g, H, x, y, god, s = 1) {
    const gold = P.gold;
    switch (god) {
      case "Akatosh": poly(g, H, [[x, y - 9 * s], [x + 8 * s, y - 2 * s], [x + 4 * s, y], [x + 9 * s, y + 7 * s], [x, y + 3 * s], [x - 9 * s, y + 7 * s], [x - 4 * s, y], [x - 8 * s, y - 2 * s]], gold, P.ink, 1); break;   // dragon wings
      case "Arkay": H.circle(g, x, y, 7 * s, null, gold, 2.4); line(g, [[x, y - 9 * s], [x, y + 9 * s]], 2, gold); break;
      case "Dibella": for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; H.circle(g, x + Math.cos(a) * 5 * s, y + Math.sin(a) * 5 * s, 3 * s, "#e9a0b0", P.ink, 0.8); } H.circle(g, x, y, 2.4 * s, gold, null); break;
      case "Julianos": rect(g, H, x - 7 * s, y - 6 * s, 14 * s, 12 * s, "#e9dcc0", P.ink, 1); line(g, [[x, y - 6 * s], [x, y + 6 * s]], 1, P.ink); break;   // open book
      case "Kynareth": line(g, [[x - 9 * s, y], [x - 3 * s, y - 5 * s], [x, y - 1 * s], [x + 3 * s, y - 5 * s], [x + 9 * s, y]], 2.2, gold); break;   // a bird in flight
      case "Mara": poly(g, H, [[x, y + 7 * s], [x - 8 * s, y - 1 * s], [x - 5 * s, y - 7 * s], [x, y - 3 * s], [x + 5 * s, y - 7 * s], [x + 8 * s, y - 1 * s]], "#c4572e", P.ink, 1); break;   // heart
      case "Stendarr": poly(g, H, [[x - 7 * s, y - 7 * s], [x + 7 * s, y - 7 * s], [x + 6 * s, y + 3 * s], [x, y + 9 * s], [x - 6 * s, y + 3 * s]], P.steel, P.ink, 1); break;   // shield
      case "Zenithar": H.circle(g, x, y, 7 * s, gold, P.ink, 1); H.circle(g, x, y, 3 * s, null, P.ink, 1); break;   // coin
      case "Talos": rect(g, H, x - 7 * s, y - 8 * s, 14 * s, 6 * s, P.steel, P.ink, 1); rect(g, H, x - 1.5 * s, y - 2 * s, 3 * s, 11 * s, P.wood, P.ink, 0.8); break;   // hammer
      default: H.circle(g, x, y, 6 * s, gold, P.ink, 1);
    }
  }

  // ---------------------------------------------------------------- road events (events.js ids)
  const ROAD = {
    herbs(g, H, w, h, ev) {
      const r = rnd("herbs" + (ev.item || "")), name = String(D.ITEMS?.[ev.item]?.name || ev.item || "").toLowerCase();
      const shroom = /cap|mushroom|fungus|shroom|creep/.test(name), flower = /flower|lavender|mountain|thistle|blossom|bell|dragon/.test(name);
      for (let i = 0; i < 9; i++) {
        const x = w * 0.28 + r() * w * 0.44, y = h * 0.8 + r() * h * 0.1;
        if (shroom) { rect(g, H, x - 1.5, y - 8, 3, 8, "#e9dcc0", P.ink, 0.8); poly(g, H, [[x - 7, y - 7], [x, y - 14], [x + 7, y - 7]], i % 2 ? "#c4572e" : "#d6b25e", P.ink, 0.9); }
        else { line(g, [[x, y], [x, y - 12 - r() * 6]], 1.4, P.forest); H.circle(g, x, y - 14 - r() * 4, 3.2, flower ? ["#9b7fd0", "#e9a0b0", "#d6b25e", "#f4f6f8"][i % 4] : P.leaf, P.ink, 0.8); line(g, [[x, y - 6], [x + 5, y - 10]], 1.2, P.leaf); }
      }
      glow(g, w * 0.5, h * 0.8, 60, "214,178,94", 0.18);
    },
    chest(g, H, w, h, ev) {
      // ruined wayside shrine pillars, an iron-banded chest
      // two broken pillars of an old wayside shrine, and fallen stones
      poly(g, H, [[w * 0.3, h * 0.84], [w * 0.3, h * 0.5], [w * 0.315, h * 0.47], [w * 0.33, h * 0.52], [w * 0.335, h * 0.84]], P.stone, P.ink, 1.2);
      poly(g, H, [[w * 0.64, h * 0.84], [w * 0.64, h * 0.62], [w * 0.655, h * 0.66], [w * 0.665, h * 0.6], [w * 0.675, h * 0.84]], P.stone, P.ink, 1.2);
      rect(g, H, w * 0.68, h * 0.8, 16, 7, P.stone, P.ink, 1); rect(g, H, w * 0.26, h * 0.82, 10, 6, P.stone, P.ink, 1);
      line(g, [[w * 0.305, h * 0.6], [w * 0.33, h * 0.58]], 0.8, "rgba(59,44,30,0.6)"); line(g, [[w * 0.645, h * 0.72], [w * 0.67, h * 0.7]], 0.8, "rgba(59,44,30,0.6)");
      tree(g, H, w * 0.35, h * 0.84, 0.5, "#557a47");
      const x = w * 0.43, y = h * 0.84, tierCol = [P.iron, P.iron, P.steel, P.gold, "#c9b6ff"][ev.tier || 0];
      shadow(g, x + 22, y + 1, 26);
      rect(g, H, x, y - 22, 44, 22, P.wood); poly(g, H, [[x, y - 22], [x + 4, y - 30], [x + 40, y - 30], [x + 44, y - 22]], P.wood);
      for (const bx of [x + 8, x + 32]) rect(g, H, bx, y - 30, 4, 30, P.iron, P.ink, 0.8);
      rect(g, H, x + 18, y - 20, 8, 9, tierCol, P.ink, 1);
    },
    caravan(g, H, w, h) {
      // pack guar laden with bundles, a Khajiit trader by a rug of goods
      const gx = w * 0.62, gy = h * 0.84;
      shadow(g, gx, gy + 1, 40);
      poly(g, H, [[gx - 40, gy - 14], [gx - 30, gy - 30], [gx + 16, gy - 32], [gx + 30, gy - 20], [gx + 26, gy - 10], [gx - 34, gy - 8]], "#7f8f63", P.ink, 1.2);   // body
      poly(g, H, [[gx + 26, gy - 26], [gx + 52, gy - 30], [gx + 58, gy - 22], [gx + 30, gy - 18]], "#7f8f63", P.ink, 1.1);   // neck/head
      g.fillStyle = P.ink; g.fillRect(gx + 50, gy - 27, 2, 2);
      for (const lx of [gx - 28, gx - 14, gx + 6, gx + 18]) rect(g, H, lx, gy - 10, 5, 10, "#6f7f55", P.ink, 0.9);
      poly(g, H, [[gx - 40, gy - 14], [gx - 60, gy - 6], [gx - 40, gy - 10]], "#7f8f63", P.ink, 1);   // tail
      rect(g, H, gx - 26, gy - 44, 20, 14, P.cloth, P.ink, 1); rect(g, H, gx - 4, gy - 46, 18, 16, "#c4572e", P.ink, 1); rect(g, H, gx - 16, gy - 54, 16, 10, P.leather, P.ink, 1);
      // the rug and wares
      poly(g, H, [[w * 0.1, h * 0.92], [w * 0.38, h * 0.92], [w * 0.42, h * 0.82], [w * 0.14, h * 0.82]], "#8e2b25", P.ink, 1);
      for (let i = 0; i < 4; i++) H.circle(g, w * 0.17 + i * 20, h * 0.86, 4, ["#d6b25e", "#9fd0f0", "#8e2b25", "#557a47"][i], P.ink, 0.8);
      // the Khajiit: furred face, ears, a tail
      const kx = w * 0.3, kb = h * 0.82;
      person(g, H, kx, kb, { body: "#5a4a7a", legs: "#3b2c1e", skin: "#c99a6e", s: 1.15, arm: "wave", face: 1 });
      const top = kb - 32 * 1.15;
      poly(g, H, [[kx - 5, top - 9], [kx - 3, top - 16], [kx - 1, top - 10]], "#c99a6e", P.ink, 0.9); poly(g, H, [[kx + 1, top - 10], [kx + 3, top - 16], [kx + 5, top - 9]], "#c99a6e", P.ink, 0.9);
      line(g, [[kx - 6, kb - 10], [kx - 16, kb - 4], [kx - 20, kb - 12]], 2.6, "#a07a54");
    },
    injured(g, H, w, h) {
      const mx = w * 0.56, mb = h * 0.84;   // a milestone
      poly(g, H, [[mx, mb], [mx + 2, mb - 34], [mx + 10, mb - 40], [mx + 18, mb - 34], [mx + 20, mb]], P.stone, P.ink, 1.2);
      line(g, [[mx + 6, mb - 26], [mx + 14, mb - 26]], 1, P.ink); line(g, [[mx + 6, mb - 20], [mx + 14, mb - 20]], 1, P.ink);
      person(g, H, mx - 8, mb, { body: "#8a6a4a", legs: P.inkSoft, skin: P.skin[1], sit: true, face: -1, s: 1.1 });
      rect(g, H, mx - 22, mb - 7, 7, 6, "#e9dcc0", P.ink, 0.8); g.fillStyle = "#8e2b25"; g.fillRect(mx - 21, mb - 6, 5, 3);   // bandaged leg
      g.fillStyle = "rgba(142,43,37,0.7)"; g.beginPath(); g.ellipse(mx - 24, mb + 2, 6, 1.5, 0, 0, 7); g.fill();
    },
    toll(g, H, w, h, ev) {
      // a cart turned across the road, two soldiers in the Jarl's colours
      const cx = w * 0.42, cb = h * 0.86;
      rect(g, H, cx - 40, cb - 24, 80, 16, P.wood); H.circle(g, cx - 24, cb - 6, 9, null, P.ink, 2.4); H.circle(g, cx + 24, cb - 6, 9, null, P.ink, 2.4);
      line(g, [[cx + 40, cb - 16], [cx + 62, cb - 8]], 2.4, P.wood);
      const hold = (() => { try { return G.holdAt([S?.x || 0.5, S?.y || 0.5]); } catch { return ""; } })();
      const col = { Whiterun: "#c9a24c", Eastmarch: "#3d5d36", "The Rift": "#7a4a6a", Haafingar: "#8e2b25", "The Reach": "#6b3a2a", "The Pale": "#4a6a8a", Falkreath: "#2e4a3a", Hjaalmarch: "#5a6a4a", Winterhold: "#6a7aa0" }[hold] || P.blood;
      person(g, H, w * 0.72, h * 0.86, { body: col, legs: P.iron, skin: P.skin[0], helm: P.iron, arm: "spear", face: -1, s: 1.1 });
      person(g, H, w * 0.84, h * 0.84, { body: col, legs: P.iron, skin: P.skin[1], helm: P.iron, arm: "spear", face: -1, s: 1 });
      // a banner pole and a coin bowl
      line(g, [[w * 0.2, h * 0.86], [w * 0.2, h * 0.42]], 2, P.wood); poly(g, H, [[w * 0.2, h * 0.42], [w * 0.2 + 18, h * 0.46], [w * 0.2, h * 0.52]], col, P.ink, 1);
      H.circle(g, w * 0.6, h * 0.92, 5, P.gold, P.ink, 0.9);
    },
    book(g, H, w, h) {
      fire(g, H, w * 0.4, h * 0.84, 1.1, false);
      // an open, waterlogged book
      const bx = w * 0.58, by = h * 0.86;
      poly(g, H, [[bx - 22, by - 3], [bx, by - 10], [bx, by + 2], [bx - 22, by + 8]], "#d8cbaa", P.ink, 1);
      poly(g, H, [[bx + 22, by - 3], [bx, by - 10], [bx, by + 2], [bx + 22, by + 8]], "#e9dcc0", P.ink, 1);
      for (let i = 0; i < 3; i++) { line(g, [[bx - 18, by - 2 + i * 3], [bx - 4, by - 7 + i * 3]], 0.7, P.inkSoft); line(g, [[bx + 4, by - 7 + i * 3], [bx + 18, by - 2 + i * 3]], 0.7, P.inkSoft); }
      g.fillStyle = "rgba(95,135,151,0.35)"; g.beginPath(); g.ellipse(bx + 8, by + 3, 10, 2.5, 0, 0, 7); g.fill();
      tree(g, H, w * 0.82, h * 0.82, 1, "dead");
    },
    sleeper(g, H, w, h) {
      fire(g, H, w * 0.34, h * 0.84, 1, false);
      sleeper(g, H, w * 0.56, h * 0.88, { body: "#6b5640", legs: P.inkSoft, skin: P.skin[0], helm: P.iron, s: 1.2 });
      H.circle(g, w * 0.66, h * 0.84, 5, P.gold, P.ink, 1); line(g, [[w * 0.66, h * 0.8], [w * 0.64, h * 0.77]], 1, P.ink);   // the purse
      g.fillStyle = P.ink; g.font = "italic 700 13px Georgia, serif"; g.fillText("z", w * 0.48, h * 0.7); g.font = "italic 700 10px Georgia, serif"; g.fillText("z", w * 0.45, h * 0.64);
      line(g, [[w * 0.78, h * 0.88], [w * 0.84, h * 0.74]], 2, P.iron);   // his axe leaning on a stump
      rect(g, H, w * 0.8, h * 0.82, 14, 8, P.wood, P.ink, 1);
    },
    shrine(g, H, w, h, ev) {
      const x = w * 0.5, b = h * 0.86;
      rect(g, H, x - 26, b - 8, 52, 8, P.stone); rect(g, H, x - 18, b - 48, 36, 40, "#8a7c6a"); poly(g, H, [[x - 24, b - 48], [x, b - 62], [x + 24, b - 48]], P.stone);
      glow(g, x, b - 30, 46, "214,178,94", 0.35);
      godSign(g, H, x, b - 30, ev.god, 1.3);
      for (const cx of [x - 22, x + 22]) { rect(g, H, cx - 2, b - 14, 4, 6, "#f4f0d8", P.ink, 0.6); poly(g, H, [[cx - 1.5, b - 14], [cx, b - 19], [cx + 1.5, b - 14]], P.fire, null); glow(g, cx, b - 17, 10, "232,146,58", 0.5); }
      for (let i = 0; i < 3; i++) H.circle(g, x - 10 + i * 10, b + 4, 2.5, "#e9a0b0", P.ink, 0.6);   // offerings
    },
    climb(g, H, w, h) {
      // a steep slope with a zig-zag goat path
      poly(g, H, [[w * 0.18, h * 0.86], [w * 0.52, h * 0.12], [w * 0.88, h * 0.86]], "#a49580", P.ink, 1.4);
      poly(g, H, [[w * 0.44, h * 0.3], [w * 0.52, h * 0.12], [w * 0.6, h * 0.3], [w * 0.55, h * 0.27], [w * 0.5, h * 0.29]], P.snow, null);
      g.setLineDash([4, 4]); line(g, [[w * 0.3, h * 0.84], [w * 0.62, h * 0.7], [w * 0.38, h * 0.56], [w * 0.6, h * 0.42], [w * 0.48, h * 0.26]], 1.6, "#6b5640"); g.setLineDash([]);
      for (let i = 0; i < 6; i++) H.circle(g, w * (0.3 + i * 0.07), h * (0.8 - (i % 3) * 0.04), 3, P.rock, P.ink, 0.8);
      // a goat
      const gx = w * 0.6, gy = h * 0.42; rect(g, H, gx - 8, gy - 8, 16, 7, "#e9e2d0", P.ink, 0.9); H.circle(g, gx + 10, gy - 9, 3.5, "#e9e2d0", P.ink, 0.9); line(g, [[gx + 9, gy - 12], [gx + 6, gy - 16]], 1.2, P.inkSoft);
      for (const lx of [gx - 6, gx + 5]) line(g, [[lx, gy - 1], [lx, gy + 4]], 1.4, P.ink);
    },
    camp(g, H, w, h) {
      const x = w * 0.6, b = h * 0.86;   // a lean-to
      poly(g, H, [[x - 34, b], [x - 18, b - 34], [x + 30, b - 34], [x + 34, b]], P.leather, P.ink, 1.2);
      line(g, [[x - 18, b - 34], [x - 18, b]], 1.6, P.wood); line(g, [[x + 30, b - 34], [x + 30, b]], 1.6, P.wood);
      rect(g, H, x - 14, b - 7, 38, 7, "#8e2b25", P.ink, 1);   // bedroll
      fire(g, H, w * 0.3, b, 1, true); smoke(g, w * 0.3, b - 18, 1);
      rect(g, H, w * 0.4, b - 10, 12, 10, P.wood, P.ink, 1); rect(g, H, w * 0.415, b - 15, 9, 5, P.iron, P.ink, 0.8);   // a crate and a pot
    },
    peddler(g, H, w, h) {
      const x = w * 0.5, b = h * 0.86;
      person(g, H, x, b, { body: "#4a5a6a", legs: P.inkSoft, skin: P.skin[2], hood: "#3b4a5a", cape: "#3b4a5a", arm: "hold", s: 1.25, face: -1 });
      rect(g, H, x - 16, b - 42, 14, 22, P.leather, P.ink, 1); line(g, [[x - 14, b - 44], [x - 8, b - 50], [x - 4, b - 44]], 1.4, P.ink);   // his pack
      const lx = x - 12, ly = b - 22; line(g, [[lx + 2, ly - 6], [lx, ly]], 1, P.ink); rect(g, H, lx - 4, ly, 8, 9, "#f6d36a", P.ink, 0.9); glow(g, lx, ly + 4, 24, "246,211,106", 0.5);   // lantern
      for (let i = 0; i < 3; i++) H.circle(g, x + 26 + i * 12, b - 2, 4, ["#c9b6ff", "#9fd0f0", "#d6b25e"][i], P.ink, 0.8);
    },
  };

  // ---------------------------------------------------------------- story moments (popup titles/text)
  function dragon(g, H, x, y, s = 1, col = "#4a3a34", down = false) {
    if (down) {   // a dragon lying dead, wings spread on the ground
      poly(g, H, [[x - 70 * s, y], [x - 30 * s, y - 14 * s], [x + 20 * s, y - 16 * s], [x + 60 * s, y - 6 * s], [x + 80 * s, y]], col, P.ink, 1.3);
      poly(g, H, [[x - 20 * s, y - 14 * s], [x - 60 * s, y - 40 * s], [x - 40 * s, y - 16 * s]], "#5a4a42", P.ink, 1);
      poly(g, H, [[x + 10 * s, y - 16 * s], [x + 40 * s, y - 44 * s], [x + 36 * s, y - 14 * s]], "#5a4a42", P.ink, 1);
      return;
    }
    poly(g, H, [[x - 6 * s, y], [x - 60 * s, y - 26 * s], [x - 44 * s, y - 6 * s], [x - 70 * s, y - 2 * s], [x - 30 * s, y + 6 * s]], "#5a4a42", P.ink, 1.1);   // left wing
    poly(g, H, [[x + 6 * s, y], [x + 60 * s, y - 26 * s], [x + 44 * s, y - 6 * s], [x + 70 * s, y - 2 * s], [x + 30 * s, y + 6 * s]], "#5a4a42", P.ink, 1.1);   // right wing
    poly(g, H, [[x - 10 * s, y - 2 * s], [x, y - 10 * s], [x + 10 * s, y - 2 * s], [x + 4 * s, y + 18 * s], [x, y + 34 * s], [x - 4 * s, y + 18 * s]], col, P.ink, 1.2);   // body and tail
    poly(g, H, [[x - 5 * s, y - 8 * s], [x, y - 20 * s], [x + 5 * s, y - 8 * s]], col, P.ink, 1);   // head
    g.fillStyle = "#e8923a"; g.fillRect(x - 3 * s, y - 15 * s, 2 * s, 2 * s); g.fillRect(x + 1 * s, y - 15 * s, 2 * s, 2 * s);
  }
  function townSilhouette(g, H, w, base, seed, burning) {
    const r = rnd(seed);
    for (let i = 0; i < 7; i++) { const x = 20 + i * (w - 40) / 7 + r() * 10, hh = 16 + r() * 14; rect(g, H, x, base - hh, 30, hh, "#5a4a3a", P.ink, 1); poly(g, H, [[x - 3, base - hh], [x + 15, base - hh - 12], [x + 33, base - hh]], "#3b2c1e", P.ink, 1); if (burning && r() < 0.5) { const fx = x + 15, fy = base - hh - 8; poly(g, H, [[fx - 6, fy + 6], [fx, fy - 10], [fx + 6, fy + 6]], P.fire, P.ink, 0.8); glow(g, fx, fy, 26, "232,146,58", 0.35); smoke(g, fx, fy - 10, 1.4); } }
    rect(g, H, w * 0.46, base - 52, 20, 52, "#4a3a2e", P.ink, 1); poly(g, H, [[w * 0.46 - 3, base - 52], [w * 0.46 + 10, base - 64], [w * 0.46 + 23, base - 52]], "#3b2c1e", P.ink, 1);
  }
  const STORY = {
    dragonAttack(g, H, w, h, o) {
      H.sky(g, w, h, "dusk"); g.fillStyle = "rgba(196,87,46,0.25)"; g.fillRect(0, 0, w, h);
      H.mountains(g, w, h * 0.7, h * 0.3, "dm", P.rock, true);
      townSilhouette(g, H, w, h * 0.9, "tw" + (o.town || ""), true);
      g.fillStyle = "#4a3e32"; g.fillRect(0, h * 0.9, w, h * 0.1);
      dragon(g, H, w * 0.62, h * 0.28, 0.9);
      if (o.fire !== false) { poly(g, H, [[w * 0.62, h * 0.12], [w * 0.5, h * 0.62], [w * 0.58, h * 0.6], [w * 0.62, h * 0.12]], "rgba(232,146,58,0.75)", null); glow(g, w * 0.54, h * 0.6, 50, "232,146,58", 0.4); }
    },
    dragonFalls(g, H, w, h, o) {
      H.sky(g, w, h, "dusk"); H.mountains(g, w, h * 0.62, h * 0.32, "df", P.rock, true);
      g.fillStyle = "#b9a98d"; g.fillRect(0, h * 0.62, w, h * 0.38);
      townSilhouette(g, H, w * 0.5, h * 0.66, "dft" + (o.town || ""), false);
      dragon(g, H, w * 0.62, h * 0.86, 0.85, "#4a3a34", true);
      // the soul streams into the Dragonborn
      for (let i = 0; i < 7; i++) { g.strokeStyle = `rgba(214,178,94,${0.25 + i * 0.08})`; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.62 + i * 6, h * 0.8); g.bezierCurveTo(w * 0.55, h * 0.3 - i * 4, w * 0.3, h * 0.4, w * 0.24, h * 0.62); g.stroke(); }
      glow(g, w * 0.24, h * 0.66, 40, "214,178,94", 0.45);
      person(g, H, w * 0.24, h * 0.9, { body: P.iron, legs: P.inkSoft, skin: P.skin[0], helm: P.iron, cape: "#8e2b25", arm: "wave", s: 1.2 });
    },
    claw(g, H, w, h) {   // Bleak Falls Barrow: the Golden Claw before the puzzle door
      H.sky(g, w, h, "cave"); rect(g, H, w * 0.2, h * 0.12, w * 0.6, h * 0.8, "#5a5048", P.ink, 1.4);
      for (let i = 0; i < 3; i++) { H.circle(g, w * 0.5, h * 0.5, 34 - i * 11, ["#6f6a64", "#7d6c58", "#8f7a66"][i], P.ink, 1.2); }
      for (let a = 0; a < 3; a++) { const an = a * 2.1; godSign(g, H, w * 0.5 + Math.cos(an) * 24, h * 0.5 + Math.sin(an) * 24, ["Kynareth", "Stendarr", "Akatosh"][a], 0.6); }
      const cx = w * 0.82, cy = h * 0.6; glow(g, cx, cy, 34, "214,178,94", 0.5);
      for (let i = 0; i < 3; i++) poly(g, H, [[cx - 8 + i * 6, cy], [cx - 6 + i * 6, cy - 16], [cx - 3 + i * 6, cy]], P.gold, P.ink, 0.9);
      rect(g, H, cx - 10, cy, 22, 8, P.gold, P.ink, 1);
    },
    mountainSteps(g, H, w, h) {   // High Hrothgar and the seven thousand steps
      H.sky(g, w, h, "snow"); poly(g, H, [[0, h], [w * 0.5, h * 0.05], [w, h]], "#9aa3a8", P.ink, 1.4);
      poly(g, H, [[w * 0.38, h * 0.36], [w * 0.5, h * 0.05], [w * 0.62, h * 0.36]], P.snow, null);
      rect(g, H, w * 0.42, h * 0.26, 60, 22, "#7d7468"); poly(g, H, [[w * 0.42 - 4, h * 0.26], [w * 0.42 + 30, h * 0.16], [w * 0.42 + 64, h * 0.26]], "#5a5048");
      g.setLineDash([3, 3]); line(g, [[w * 0.2, h * 0.98], [w * 0.44, h * 0.8], [w * 0.36, h * 0.66], [w * 0.5, h * 0.5], [w * 0.47, h * 0.4]], 1.6, P.inkSoft); g.setLineDash([]);
      g.fillStyle = "rgba(255,255,255,0.85)"; const r = rnd("hh"); for (let i = 0; i < 50; i++) g.fillRect(r() * w, r() * h, 2, 2);
    },
    hall(g, H, w, h) {   // Jorrvaskr: an upturned longship hall, mead and fire
      H.sky(g, w, h, "dusk"); g.fillStyle = "#b9a98d"; g.fillRect(0, h * 0.7, w, h * 0.3);
      poly(g, H, [[w * 0.14, h * 0.72], [w * 0.2, h * 0.36], [w * 0.5, h * 0.22], [w * 0.8, h * 0.36], [w * 0.86, h * 0.72]], P.wood, P.ink, 1.4);
      for (let i = 0; i < 5; i++) line(g, [[w * 0.2 + i * w * 0.13, h * 0.32], [w * 0.2 + i * w * 0.13, h * 0.72]], 1, "rgba(59,44,30,0.5)");
      rect(g, H, w * 0.45, h * 0.5, w * 0.1, h * 0.22, "#3b2c1e"); glow(g, w * 0.5, h * 0.6, 40, "232,146,58", 0.4);
      poly(g, H, [[w * 0.5 - 8, h * 0.22], [w * 0.5, h * 0.1], [w * 0.5 + 8, h * 0.22]], P.wood, P.ink, 1);   // dragon prow
      person(g, H, w * 0.3, h * 0.9, { body: "#6b5640", legs: P.inkSoft, skin: P.skin[0], hair: "#c9a24c", arm: "wave", s: 1.1 });
      person(g, H, w * 0.7, h * 0.9, { body: P.iron, legs: P.inkSoft, skin: P.skin[0], hair: "#3b2c1e", arm: "hold", face: -1, s: 1.1 });
    },
    sanctuary(g, H, w, h) {   // the Black Door of the Dark Brotherhood, set in rock among dark pines
      H.sky(g, w, h, "night"); g.fillStyle = "#2a2a26"; g.fillRect(0, h * 0.72, w, h * 0.28);
      poly(g, H, [[w * 0.18, h * 0.72], [w * 0.28, h * 0.22], [w * 0.5, h * 0.1], [w * 0.72, h * 0.22], [w * 0.82, h * 0.72]], "#4a4640", P.ink, 1.4);
      const dx = w * 0.5, dy = h * 0.42, dw = w * 0.16, dh = h * 0.3;
      poly(g, H, [[dx - dw / 2, dy + dh], [dx - dw / 2, dy], [dx, dy - dh * 0.25], [dx + dw / 2, dy], [dx + dw / 2, dy + dh]], "#141210", "#5a1a18", 2);
      // a skull above a red hand print, the door's sign
      H.circle(g, dx, dy + dh * 0.22, 7, "#d8d0bc", P.ink, 1); rect(g, H, dx - 4, dy + dh * 0.3, 8, 4, "#d8d0bc", P.ink, 0.8);
      const hx = dx, hy = dy + dh * 0.68; poly(g, H, [[hx - 6, hy + 6], [hx - 7, hy - 2], [hx + 7, hy - 2], [hx + 6, hy + 6]], "#8e2b25", null);
      for (const [fx, fl] of [[-6, 8], [-2.5, 10], [1.5, 10], [5, 8]]) rect(g, H, hx + fx - 1.4, hy - 2 - fl, 2.8, fl, "#8e2b25", null); poly(g, H, [[hx + 7, hy], [hx + 11, hy - 5], [hx + 12, hy - 3], [hx + 7, hy + 4]], "#8e2b25", null);
      glow(g, dx, dy + dh * 0.5, 60, "142,43,37", 0.25);
      H.pines(g, w, h * 0.74, 10, 9, 22);
      person(g, H, w * 0.24, h * 0.92, { body: "#2a1e1e", legs: "#1c1414", skin: P.skin[0], hood: "#1c1414", arm: "hold", s: 1.1 });
    },
    flagon(g, H, w, h) {   // the Ragged Flagon under Riften: lanterns over black water
      H.sky(g, w, h, "cave"); g.fillStyle = "#1f2a30"; g.fillRect(0, h * 0.68, w, h * 0.32);
      for (let i = 0; i < 5; i++) { const x = 30 + i * 74; rect(g, H, x, h * 0.2, 6, h * 0.5, "#4a3a2e"); line(g, [[x + 3, h * 0.32], [x + 3, h * 0.4]], 1, P.ink); rect(g, H, x - 2, h * 0.4, 10, 10, "#f6d36a", P.ink, 0.8); glow(g, x + 3, h * 0.45, 26, "246,211,106", 0.35); }
      g.strokeStyle = "rgba(246,211,106,0.35)"; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(20 + i * 44, h * 0.8); g.lineTo(36 + i * 44, h * 0.8); g.stroke(); }
      person(g, H, w * 0.5, h * 0.68, { body: "#3b3a34", legs: "#2a2a26", skin: P.skin[0], hood: "#2a2a26", arm: "hold", s: 1.2 });
    },
    college(g, H, w, h) {   // the College of Winterhold on its broken bridge
      H.sky(g, w, h, "snow"); g.fillStyle = "#30505e"; g.fillRect(0, h * 0.7, w, h * 0.3);
      poly(g, H, [[w * 0.55, h * 0.7], [w * 0.62, h * 0.3], [w * 0.9, h * 0.3], [w * 0.96, h * 0.7]], "#8f8a84", P.ink, 1.2);
      rect(g, H, w * 0.66, h * 0.08, 16, h * 0.24, "#7d7a78"); rect(g, H, w * 0.8, h * 0.12, 14, h * 0.2, "#7d7a78"); poly(g, H, [[w * 0.66 - 3, h * 0.08], [w * 0.66 + 8, h * 0.0], [w * 0.66 + 19, h * 0.08]], "#5a5a66");
      for (let i = 0; i < 5; i++) rect(g, H, w * 0.12 + i * 34, h * 0.5 - i * 2, 30, 8, "#8f8a84", P.ink, 1);
      for (let i = 0; i < 5; i++) line(g, [[w * 0.14 + i * 34, h * 0.58 - i * 2], [w * 0.14 + i * 34, h * 0.72]], 2, "#6f6a64");
      glow(g, w * 0.78, h * 0.2, 50, "159,208,240", 0.35);
      person(g, H, w * 0.26, h * 0.5, { body: "#5a4a7a", legs: "#3b2c58", skin: P.skin[0], hood: "#4a3a6a", arm: "wave", s: 0.9 });
      glow(g, w * 0.32, h * 0.32, 14, "159,208,240", 0.8);
    },
    house(g, H, w, h) {   // a home of your own
      H.sky(g, w, h, "day"); g.fillStyle = "#9aa463"; g.fillRect(0, h * 0.72, w, h * 0.28);
      const x = w * 0.32, b = h * 0.82; rect(g, H, x, b - 44, 120, 44, P.wood); poly(g, H, [[x - 10, b - 44], [x + 60, b - 84], [x + 130, b - 44]], P.inkSoft, P.ink, 1.3);
      rect(g, H, x + 50, b - 26, 20, 26, P.inkSoft); for (const wx of [x + 16, x + 92]) rect(g, H, wx, b - 32, 12, 12, P.fire, P.ink, 0.9); smoke(g, x + 96, b - 78, 1.2);
      // a big key
      const kx = w * 0.84, ky = h * 0.4; H.circle(g, kx, ky, 9, null, P.gold, 3); line(g, [[kx, ky + 9], [kx, ky + 40]], 3, P.gold); line(g, [[kx, ky + 32], [kx + 8, ky + 32]], 3, P.gold); line(g, [[kx, ky + 38], [kx + 6, ky + 38]], 3, P.gold); glow(g, kx, ky + 20, 30, "214,178,94", 0.3);
    },
    guard(g, H, w, h) {   // "Stop right there, criminal scum!"
      H.sky(g, w, h, "day"); g.fillStyle = "#8f7a66"; g.fillRect(0, h * 0.7, w, h * 0.3);
      rect(g, H, 0, h * 0.2, w, h * 0.5, "#7d6c58", P.ink, 1); for (let x = 0; x < w; x += 16) rect(g, H, x, h * 0.16, 8, 6, "#7d6c58", P.ink, 0.8);
      person(g, H, w * 0.5, h * 0.94, { body: "#c9a24c", legs: P.iron, skin: P.skin[0], helm: P.iron, arm: "spear", s: 1.6, face: -1 });
    },
    blood(g, H, w, h) {   // the Change: a vampire's red eyes under a full moon
      H.sky(g, w, h, "night"); H.circle(g, w * 0.72, h * 0.3, 26, "#f0e6d0", P.ink, 1); g.fillStyle = "rgba(142,43,37,0.25)"; g.fillRect(0, 0, w, h);
      H.mountains(g, w, h * 0.8, h * 0.3, "vm", "#2a2830", false);
      g.fillStyle = "#1c1820"; g.fillRect(0, h * 0.8, w, h * 0.2);
      poly(g, H, [[w * 0.3, h], [w * 0.32, h * 0.5], [w * 0.4, h * 0.38], [w * 0.48, h * 0.5], [w * 0.5, h]], "#1c1820", P.ink, 1.2);
      glow(g, w * 0.4, h * 0.5, 30, "196,40,40", 0.5); g.fillStyle = "#e83030"; g.fillRect(w * 0.37, h * 0.48, 4, 2); g.fillRect(w * 0.42, h * 0.48, 4, 2);
    },
    wolf(g, H, w, h) {   // the beast blood: a werewolf on a rock, howling at the full moon
      H.sky(g, w, h, "night"); H.circle(g, w * 0.74, h * 0.3, 30, "#f4f0d8", P.ink, 1); glow(g, w * 0.74, h * 0.3, 70, "244,240,216", 0.25);
      H.mountains(g, w, h * 0.8, h * 0.28, "wm", "#2a3038", true); g.fillStyle = "#20262c"; g.fillRect(0, h * 0.8, w, h * 0.2);
      poly(g, H, [[w * 0.3, h * 0.86], [w * 0.36, h * 0.72], [w * 0.56, h * 0.7], [w * 0.64, h * 0.86]], "#3a3a40", P.ink, 1.2);   // the rock
      const x = w * 0.47, b = h * 0.71, F = "#2e2925";
      poly(g, H, [[x - 14, b], [x - 12, b - 18], [x - 6, b - 14], [x - 4, b], ], F, P.ink, 1);   // back leg
      poly(g, H, [[x + 4, b], [x + 6, b - 14], [x + 12, b - 18], [x + 14, b]], F, P.ink, 1);    // front leg
      poly(g, H, [[x - 14, b - 14], [x - 10, b - 44], [x + 2, b - 52], [x + 12, b - 42], [x + 14, b - 16]], F, P.ink, 1.2);   // hunched body
      line(g, [[x + 10, b - 40], [x + 22, b - 26], [x + 24, b - 16]], 4, F); line(g, [[x - 10, b - 38], [x - 20, b - 26]], 4, F);   // arms with claws
      poly(g, H, [[x + 2, b - 52], [x + 6, b - 66], [x + 18, b - 80], [x + 22, b - 76], [x + 14, b - 62], [x + 12, b - 50]], F, P.ink, 1.1);   // neck and raised muzzle
      poly(g, H, [[x + 4, b - 64], [x + 2, b - 74], [x + 9, b - 68]], F, P.ink, 0.9);   // ear
      g.fillStyle = "#e8923a"; g.fillRect(x + 11, b - 70, 2.5, 2);
      g.strokeStyle = "rgba(244,240,216,0.5)"; g.lineWidth = 1.2; for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(x + 22, b - 80, 6 * i, -1.6, -0.2); g.stroke(); }   // the howl
      line(g, [[x - 14, b - 16], [x - 26, b - 8]], 3, F);   // tail
    },
    dawn(g, H, w, h) {   // cured: sunrise
      H.sky(g, w, h, "dusk"); H.circle(g, w * 0.5, h * 0.66, 30, "#f6d36a", null); glow(g, w * 0.5, h * 0.6, 90, "246,211,106", 0.35);
      H.mountains(g, w, h * 0.72, h * 0.26, "dw", P.rock, true); g.fillStyle = "#b9a98d"; g.fillRect(0, h * 0.72, w, h * 0.28);
    },
    wordWall(g, H, w, h) {   // a Word Wall: the curved wall of dragon script, one word glowing
      H.sky(g, w, h, "cave"); g.fillStyle = "#3b342c"; g.fillRect(0, h * 0.78, w, h * 0.22);
      poly(g, H, [[w * 0.12, h * 0.8], [w * 0.16, h * 0.2], [w * 0.5, h * 0.1], [w * 0.84, h * 0.2], [w * 0.88, h * 0.8]], "#6f6a64", P.ink, 1.4);
      const r = rnd("ww");
      for (let row = 0; row < 5; row++) for (let c = 0; c < 9; c++) { const x = w * 0.2 + c * 24, y = h * 0.26 + row * 18, lit = row === 2 && c >= 3 && c <= 5; g.strokeStyle = lit ? "#9fd0f0" : "rgba(40,34,28,0.7)"; g.lineWidth = lit ? 2 : 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4 + r() * 6, y + 8); g.lineTo(x + 10, y); if (r() < 0.5) { g.moveTo(x + 5, y - 2); g.lineTo(x + 5, y + 10); } g.stroke(); }
      glow(g, w * 0.5, h * 0.42, 60, "159,208,240", 0.4);
      for (let i = 0; i < 6; i++) { g.strokeStyle = `rgba(159,208,240,${0.2 + i * 0.07})`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(w * 0.5, h * 0.42); g.quadraticCurveTo(w * (0.4 + i * 0.03), h * 0.66, w * 0.5, h * 0.92); g.stroke(); }
      person(g, H, w * 0.5, h * 0.96, { body: P.iron, legs: P.inkSoft, skin: P.skin[0], helm: P.iron, cape: "#8e2b25", arm: "none", s: 1.1 });
    },
    horn(g, H, w, h) {   // Ustengrav: the horn on its pedestal (spoiler: a note is there instead)
      H.sky(g, w, h, "cave"); rect(g, H, w * 0.42, h * 0.5, w * 0.16, h * 0.4, "#6f6a64");
      line(g, [[w * 0.45, h * 0.46], [w * 0.5, h * 0.4], [w * 0.56, h * 0.42], [w * 0.58, h * 0.36]], 5, "#e9dcc0"); line(g, [[w * 0.45, h * 0.46], [w * 0.5, h * 0.4], [w * 0.56, h * 0.42], [w * 0.58, h * 0.36]], 1, P.ink);
      glow(g, w * 0.52, h * 0.42, 40, "214,178,94", 0.4);
      for (const x of [w * 0.2, w * 0.8]) { rect(g, H, x - 4, h * 0.3, 8, h * 0.6, "#5a5048"); poly(g, H, [[x - 3, h * 0.3], [x, h * 0.22], [x + 3, h * 0.3]], P.fire, null); glow(g, x, h * 0.27, 18, "232,146,58", 0.4); }
    },
    battle(g, H, w, h) {   // [OURS] the Civil War: a fort wall at dusk, red and blue banners, two lines of soldiers clashing
      backdrop(g, H, w, h, "Tundra", "dusk", "cw", false);
      poly(g, H, [[w * 0.05, h * 0.62], [w * 0.05, h * 0.3], [w * 0.15, h * 0.3], [w * 0.15, h * 0.36], [w * 0.22, h * 0.36], [w * 0.22, h * 0.3], [w * 0.32, h * 0.3], [w * 0.32, h * 0.62]], "#6e665c");   // the fort
      smoke(g, w * 0.18, h * 0.3, 1.4); smoke(g, w * 0.8, h * 0.42, 1.1);
      const banner = (x, col, mark) => { line(g, [[x, h * 0.9], [x, h * 0.2]], 2, P.wood); poly(g, H, [[x, h * 0.21], [x + 26, h * 0.21], [x + 26, h * 0.44], [x + 13, h * 0.39], [x, h * 0.44]], col); H.circle(g, x + 13, h * 0.3, 5, mark, P.ink, 0.8); };
      banner(w * 0.36, "#9c2026", "#e2bb64"); banner(w * 0.62, "#2f5a94", "#eef2f6");
      for (let i = 0; i < 4; i++) person(g, H, w * (0.3 + i * 0.045), h * 0.9 - (i % 2) * 4, { body: "#8e2b25", legs: "#5a4a3a", skin: P.skin[i % P.skin.length], helm: P.steel, arm: i % 2 ? "spear" : "hold", s: 1.05, face: 1 });
      for (let i = 0; i < 4; i++) person(g, H, w * (0.58 + i * 0.045), h * 0.9 - ((i + 1) % 2) * 4, { body: "#3a5a8a", legs: "#4a3a2a", skin: P.skin[(i + 1) % P.skin.length], hair: "#6a4a2a", arm: i % 2 ? "hold" : "spear", s: 1.05, face: -1 });
      glow(g, w * 0.5, h * 0.75, 40, "232,146,58", 0.35);
    },
    daedra(g, H, w, h) {   // [OURS] a Daedric shrine at night: a spiked stone arch with a prince's light inside, offerings on the step
      H.sky(g, w, h, "night"); g.fillStyle = "#2e2a26"; g.fillRect(0, h * 0.8, w, h * 0.2);
      glow(g, w * 0.5, h * 0.48, 90, "170,90,220", 0.45);
      poly(g, H, [[w * 0.3, h * 0.82], [w * 0.3, h * 0.36], [w * 0.5, h * 0.08], [w * 0.7, h * 0.36], [w * 0.7, h * 0.82]], "#3e352f", P.ink, 1.5);
      poly(g, H, [[w * 0.37, h * 0.82], [w * 0.37, h * 0.4], [w * 0.5, h * 0.2], [w * 0.63, h * 0.4], [w * 0.63, h * 0.82]], "#9a5ad0", P.ink, 1.2);
      glow(g, w * 0.5, h * 0.55, 36, "255,230,255", 0.55);
      for (const [x, y] of [[0.27, 0.36], [0.73, 0.36], [0.5, 0.06], [0.37, 0.2], [0.63, 0.2]]) poly(g, H, [[w * x - 4, h * y + 6], [w * x, h * y - 8], [w * x + 4, h * y + 6]], "#3e352f", P.ink, 1);
      rect(g, H, w * 0.26, h * 0.82, w * 0.48, h * 0.05, "#5a524a");
      for (const x of [0.32, 0.66]) { fire(g, H, w * x, h * 0.82, 0.6); }
      person(g, H, w * 0.2, h * 0.94, { body: P.leather, legs: P.inkSoft, skin: P.skin[0], cape: "#3a2a4a", arm: "hold", s: 1.1, face: 1 });
    },
    masks(g, H, w, h) {   // a dragon priest's tomb: the open sarcophagus, the mask floating over it in its own light
      H.sky(g, w, h, "cave");
      for (const x of [w * 0.12, w * 0.88]) { rect(g, H, x - 5, h * 0.25, 10, h * 0.65, "#4e4740"); poly(g, H, [[x - 3, h * 0.25], [x, h * 0.16], [x + 3, h * 0.25]], P.fire, null); glow(g, x, h * 0.21, 18, "232,146,58", 0.4); }
      poly(g, H, [[w * 0.3, h * 0.92], [w * 0.34, h * 0.7], [w * 0.66, h * 0.7], [w * 0.7, h * 0.92]], "#5f5850");
      poly(g, H, [[w * 0.62, h * 0.72], [w * 0.8, h * 0.58], [w * 0.84, h * 0.64], [w * 0.68, h * 0.78]], "#6f6860");   // the lid, pushed aside
      glow(g, w * 0.5, h * 0.42, 60, "214,178,94", 0.5);
      if (typeof PRIESTS !== "undefined") PRIESTS.drawMask(g, w * 0.5, h * 0.42, 2.4, "morokei", P.ink);
    },
    road(g, H, w, h) { backdrop(g, H, w, h, "Tundra", "dusk", "rd"); person(g, H, w * 0.5, h * 0.88, { body: P.leather, legs: P.inkSoft, skin: P.skin[0], cape: "#8e2b25", s: 1.1 }); },
    ambush(g, H, w, h) { backdrop(g, H, w, h, "Pine forest", "night", "am"); overlay(g, H, w, h, "night", "clear", "am"); person(g, H, w * 0.4, h * 0.9, { body: "#2a2a26", legs: "#1c1c1a", skin: P.skin[0], hood: "#1c1c1a", arm: "hold", s: 1.2 }); line(g, [[w * 0.45, h * 0.66], [w * 0.5, h * 0.58]], 2, P.steel); },
  };

  /* which vignette (if any) fits a popup: by its title, then by words in its text */
  function storyKind(title = "", text = "") {
    const t = String(title), x = String(text);
    if (/^You died/i.test(t)) return null;
    const sk = typeof SOLART !== "undefined" ? SOLART.storyKind(t, x) : null; if (sk) return sk;   // Solstheim's scenes (solart.js)                              // UIART.death already draws this
    if (/Word Wall/i.test(x)) return "wordWall";
    if (/dragon falls/i.test(t)) return "dragonFalls";
    if (/The Change/i.test(t)) return /cure|cleans|human again|free of/i.test(x) ? "dawn" : /wolf|beast|howl|Hircine/i.test(x) ? "wolf" : "blood";
    if (/High Hrothgar/i.test(t)) return "mountainSteps";
    if (/Dragonsreach/i.test(t)) return "claw";
    if (/home of your own/i.test(t)) return "house";
    if (/^The guard/i.test(t)) return "guard";
    if (/Quest|A new path/i.test(t)) {
      if (typeof QUESTS !== "undefined") { const id = Object.keys(QUESTS.L).find((k) => x.includes(QUESTS.L[k].name + ":") || x.includes(QUESTS.L[k].name + " complete")); if (QUESTS.L[id]?.daedric) return "daedra"; if (/^cw_/.test(id || "")) return "battle"; if (id === "cure_vamp") return /complete/i.test(x) ? "dawn" : "blood"; if (id === "cure_wolf") return /complete/i.test(x) ? "dawn" : "wolf"; }   // the cure quests (curses.js)   // Daedric quests and the Civil War
      if (/Bleak Falls|Golden Claw|Dragonstone/i.test(x)) return "claw";
      if (/Way of the Voice|Greybeard|High Hrothgar/i.test(x)) return "mountainSteps";
      if (/Horn of Jurgen|Ustengrav/i.test(x)) return "horn";
      if (/Dragon Rising|A Blade in the Dark|Mirmulnir|Sahloknir/i.test(x)) return /done|falls|dead|slain|absorb/i.test(x) ? "dragonFalls" : "dragonAttack";
      if (/Companions|Jorrvaskr|Kodlak|Vilkas|Harbinger|Silver Hand|Wuuthrad|Proving Honor|Take Up Arms|Glory of the Dead/i.test(x)) return "hall";
      if (/Dark Brotherhood|Astrid|Night Mother|Sithis|Sanctuary|Cicero|Nazir|Grelod|Innocence Lost|Katariah|contract/i.test(x)) return "sanctuary";
      if (/Thieves|Brynjolf|Ragged Flagon|Pinewatch|purse|Loud and Clear|Darkness Returns|Chance Arrangement|Nightingale|Mercer|Karliah|Honningbrew|Dampened Spirits|Snow Veil|Calcelmo|Skeleton Key|Delvin|Vex/i.test(x)) return "flagon";
      if (/College|Winterhold|Faralda|Saarthal|Mzulft|Ancano|Magnus|First Lessons/i.test(x)) return "college";
      if (/Dragon Priests|Bromjunaar|Konahrik/i.test(x)) return "masks";
      if (/Dragonborn|Before the Storm|Whiterun/i.test(x)) return "dragonAttack";
      return "road";
    }
    if (/^On the road/i.test(t)) return /kill|attack|ambush|robbed|purse/i.test(x) ? "ambush" : null;
    return null;
  }

  // how much to enlarge each road scene's subject, anchored on the road, so it fills the picture
  const ZOOM = { herbs: 1.7, chest: 1.5, caravan: 1.3, injured: 1.6, toll: 1.25, book: 2, sleeper: 1.4, shrine: 1.45, climb: 1, camp: 1.4, peddler: 1.55 };

  // ---------------------------------------------------------------- public: <img> strings, cached
  function road(ev, opts = {}) {
    if (!ev || !ROAD[ev.id]) return "";
    const pos = opts.pos || (typeof S !== "undefined" && S ? [S.x, S.y] : [0.5, 0.5]);
    const ground = opts.ground || groundHere(pos), md = opts.mood || moodNow(), wx = opts.weather || weatherHere(pos);
    const variant = ev.id === "shrine" ? ev.god : ev.id === "herbs" ? ev.item : ev.id === "chest" ? ev.tier : "";
    const k = ZOOM[ev.id] || 1;
    if (typeof SKY !== "undefined") {   // shared sky: time of day, season, weather
      const st = SKY.forOpts(pos, { mood: opts.mood, tod: opts.tod, weather: opts.weather, season: opts.season });
      const draw = (g, H, w, h) => {
        curSky = st;
        try {
          backdrop(g, H, w, h, ground, SKY.mood(st), ev.id + ground);
          g.save(); g.translate(w / 2, h * 0.9); g.scale(k, k); g.translate(-w / 2, -h * 0.9); ROAD[ev.id](g, H, w, h, ev); g.restore();
          SKY.overlay(g, H, w, h, st, { seed: ev.id, ground: h * 0.62, cover: false }); frame(g, w, h);
        } finally { curSky = null; }
      };
      return ART.html(W, H0, draw, { key: `evt|${ev.id}|${variant}|${ground}|${st.key}`, cls: "scene evt", alt: "", style: opts.style });
    }
    const draw = (g, H, w, h) => {
      backdrop(g, H, w, h, ground, md, ev.id + ground);
      g.save(); g.translate(w / 2, h * 0.9); g.scale(k, k); g.translate(-w / 2, -h * 0.9); ROAD[ev.id](g, H, w, h, ev); g.restore();
      overlay(g, H, w, h, md, wx, ev.id); frame(g, w, h);
    };
    return ART.html(W, H0, draw, { key: `evt|${ev.id}|${variant}|${ground}|${md}|${wx}`, cls: "scene evt", alt: "", style: opts.style });
  }
  function story(title, text, opts = {}) {
    const k = opts.kind || storyKind(title, text); if (!k || !STORY[k]) return "";
    const o = { town: opts.town || "" };
    return ART.html(W, H0, (g, H, w, h) => { STORY[k](g, H, w, h, o); frame(g, w, h); }, { key: `story|${k}|${o.town}`, cls: "scene evt", alt: "", style: opts.style });
  }
  /* the dragon over a town, for the raid banner in the Journal */
  function raid(town, done, opts = {}) {
    const k = done ? "dragonFalls" : "dragonAttack";
    return ART.html(W, 110, (g, H, w, h) => { STORY[k](g, H, w, h, { town }); frame(g, w, h); }, { key: `raid|${k}|${town}`, cls: "scene evt", alt: "", style: opts.style });
  }
  return { road, story, raid, storyKind, ROAD, STORY, GROUND, W, H: H0 };
})();
