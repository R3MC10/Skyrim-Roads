/* Map art: hand-drawn markers for every kind of place, player tokens with portraits, footprints, and the living
   touches over the painted map (water glints, cloud shadows, birds, night lights, discovery bursts).
   Everything is drawn once into small cached canvases through ART, and the map
   just stamps them each frame. [OURS] */
const MAPART = (() => {
  const cache = new Map();
  const dprNow = () => Math.min(2, window.devicePixelRatio || 1);
  /* a cached sprite canvas, w×h CSS px */
  function sprite(key, w, h, draw) {
    const k = `${key}|${w}x${h}|${dprNow()}`;
    let c = cache.get(k);
    if (!c) {
      c = ART.canvas(w, h, draw);

      if (cache.size > 300) cache.delete(cache.keys().next().value);
      cache.set(k, c);
    }
    return c;
  }
  const INK = "#2c1f14", CREAM = "#f6ecd0";

  // ---------------------------------------------------------------- place markers
  /* every shape gets a cream halo first so it reads on dark fog and bright snow alike */
  function haloed(g, path, fill, w = 1.3) {
    path(); g.lineJoin = "round"; g.lineCap = "round";
    g.strokeStyle = CREAM; g.lineWidth = w + 2.4; g.stroke();
    if (fill) { g.fillStyle = fill; g.fill(); }
    g.strokeStyle = INK; g.lineWidth = w; g.stroke();
  }
  const poly = (g, pts) => () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  const rect = (g, x, y, w, h) => () => { g.beginPath(); g.rect(x, y, w, h); };
  const circ = (g, x, y, r) => () => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
  function shadow(g, w, h) { g.fillStyle = "rgba(20,14,8,.35)"; g.beginPath(); g.ellipse(w / 2, h - 3, w * 0.34, 2.6, 0, 0, Math.PI * 2); g.fill(); }
  function crenel(g, x, y, w, n, h, fill) { const cw = w / (n * 2 - 1); for (let i = 0; i < n; i++) haloed(g, rect(g, x + i * cw * 2, y - h, cw, h), fill, 1); }

  const MARK = {
    city(g, w, h) {   // walls, a keep and a banner
      shadow(g, w, h);
      haloed(g, rect(g, 3, h * 0.5, w - 6, h * 0.36), "#9a8c78");
      crenel(g, 3, h * 0.5, w - 6, 4, 3, "#9a8c78");
      haloed(g, rect(g, w * 0.36, h * 0.24, w * 0.28, h * 0.5), "#b4a690");
      haloed(g, poly(g, [[w * 0.32, h * 0.26], [w * 0.5, h * 0.06], [w * 0.68, h * 0.26]]), "#7a3a2a");
      g.fillStyle = "#2a2018"; g.fillRect(w * 0.46, h * 0.62, w * 0.08, h * 0.24);
      g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(w * 0.5, h * 0.06); g.lineTo(w * 0.5, -1); g.stroke();
      g.fillStyle = "#c4402e"; g.beginPath(); g.moveTo(w * 0.5, 0); g.lineTo(w * 0.66, 2); g.lineTo(w * 0.5, 4.5); g.fill();
    },
    town(g, w, h) {   // two huts
      shadow(g, w, h);
      for (const [x, s] of [[w * 0.3, 0.9], [w * 0.64, 1]]) {
        const hw = w * 0.22 * s, base = h * 0.84, top = h * 0.5;
        haloed(g, rect(g, x - hw, top, hw * 2, base - top), "#8a6040");
        haloed(g, poly(g, [[x - hw - 2, top + 1], [x, top - h * 0.26 * s], [x + hw + 2, top + 1]]), "#5e4630");
        g.fillStyle = "#e8b060"; g.fillRect(x - 1.5, top + 3, 3, 3);
      }
    },
    farm(g, w, h) {   // a field and a barn
      shadow(g, w, h);
      haloed(g, poly(g, [[2, h * 0.86], [w * 0.5, h * 0.62], [w - 2, h * 0.86]]), "#c9b060");
      g.strokeStyle = "rgba(60,40,20,.6)"; g.lineWidth = 0.8; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(w * 0.5, h * 0.62); g.lineTo(w * (0.15 + i * 0.23), h * 0.86); g.stroke(); }
      haloed(g, rect(g, w * 0.36, h * 0.36, w * 0.28, h * 0.28), "#9a4a30");
      haloed(g, poly(g, [[w * 0.32, h * 0.38], [w * 0.5, h * 0.18], [w * 0.68, h * 0.38]]), "#6a3a24");
    },
    fort(g, w, h) {   // a squat stone tower
      shadow(g, w, h);
      haloed(g, rect(g, w * 0.26, h * 0.28, w * 0.48, h * 0.58), "#8a8278");
      crenel(g, w * 0.26, h * 0.28, w * 0.48, 3, 3.5, "#8a8278");
      g.fillStyle = "#231a12"; g.fillRect(w * 0.44, h * 0.64, w * 0.12, h * 0.22); g.fillRect(w * 0.47, h * 0.4, w * 0.06, h * 0.1);
    },
    camp(g, w, h) {   // a tent and a fire
      shadow(g, w, h);
      haloed(g, poly(g, [[w * 0.12, h * 0.86], [w * 0.42, h * 0.3], [w * 0.72, h * 0.86]]), "#a8783c");
      g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(w * 0.42, h * 0.3); g.lineTo(w * 0.42, h * 0.86); g.stroke();
      haloed(g, poly(g, [[w * 0.74, h * 0.86], [w * 0.82, h * 0.56], [w * 0.9, h * 0.86]]), "#e8923a", 1);
      g.fillStyle = "#ffd070"; g.beginPath(); g.moveTo(w * 0.79, h * 0.84); g.lineTo(w * 0.82, h * 0.68); g.lineTo(w * 0.85, h * 0.84); g.fill();
    },
    lair(g, w, h) {   // a crag with a dragon's wings
      shadow(g, w, h);
      haloed(g, poly(g, [[w * 0.14, h * 0.86], [w * 0.36, h * 0.48], [w * 0.5, h * 0.62], [w * 0.66, h * 0.4], [w * 0.88, h * 0.86]]), "#7a6a5c");
      haloed(g, poly(g, [[w * 0.5, h * 0.34], [w * 0.2, h * 0.1], [w * 0.32, h * 0.3], [w * 0.5, h * 0.4], [w * 0.68, h * 0.3], [w * 0.8, h * 0.1]]), "#8e2b25", 1.1);
      g.fillStyle = "#8e2b25"; g.beginPath(); g.arc(w * 0.5, h * 0.36, 2.2, 0, 7); g.fill();
    },
    stone(g, w, h) {   // a standing stone with a glowing mark
      shadow(g, w, h);
      haloed(g, poly(g, [[w * 0.34, h * 0.88], [w * 0.38, h * 0.12], [w * 0.62, h * 0.06], [w * 0.68, h * 0.88]]), "#8a96a0");
      g.strokeStyle = "#9fe0ff"; g.lineWidth = 1.4; g.beginPath(); g.arc(w * 0.51, h * 0.42, 3, 0, 7); g.moveTo(w * 0.51, h * 0.3); g.lineTo(w * 0.51, h * 0.56); g.stroke();
    },
    shrine(g, w, h) {   // an altar with a gold sun
      shadow(g, w, h);
      haloed(g, rect(g, w * 0.26, h * 0.6, w * 0.48, h * 0.26), "#a89a86");
      haloed(g, rect(g, w * 0.42, h * 0.32, w * 0.16, h * 0.3), "#b8aa94");
      haloed(g, circ(g, w * 0.5, h * 0.22, w * 0.13), "#e8c050", 1);
    },
    landmark(g, w, h) {   // an obelisk
      shadow(g, w, h);
      haloed(g, poly(g, [[w * 0.38, h * 0.88], [w * 0.44, h * 0.14], [w * 0.5, h * 0.04], [w * 0.56, h * 0.14], [w * 0.62, h * 0.88]]), "#6a7a92");
      g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 1; g.beginPath(); g.moveTo(w * 0.47, h * 0.2); g.lineTo(w * 0.46, h * 0.8); g.stroke();
    },
    // dungeons, by theme
    cave(g, w, h) {
      shadow(g, w, h);
      haloed(g, poly(g, [[w * 0.08, h * 0.86], [w * 0.24, h * 0.36], [w * 0.5, h * 0.18], [w * 0.76, h * 0.34], [w * 0.92, h * 0.86]]), "#86765e");
      g.fillStyle = "#16100a"; g.beginPath(); g.moveTo(w * 0.32, h * 0.86); g.quadraticCurveTo(w * 0.5, h * 0.28, w * 0.68, h * 0.86); g.fill();
    },
    barrow(g, w, h) {   // a Nordic stone arch
      shadow(g, w, h);
      haloed(g, poly(g, [[w * 0.06, h * 0.86], [w * 0.5, h * 0.42], [w * 0.94, h * 0.86]]), "#7a8a66");
      haloed(g, rect(g, w * 0.26, h * 0.3, w * 0.1, h * 0.56), "#9a948a"); haloed(g, rect(g, w * 0.64, h * 0.3, w * 0.1, h * 0.56), "#9a948a");
      haloed(g, poly(g, [[w * 0.2, h * 0.32], [w * 0.5, h * 0.12], [w * 0.8, h * 0.32], [w * 0.8, h * 0.38], [w * 0.2, h * 0.38]]), "#a8a296");
      g.fillStyle = "#16100a"; g.fillRect(w * 0.38, h * 0.48, w * 0.24, h * 0.38);
    },
    dwemer(g, w, h) {   // bronze gate and a gear
      shadow(g, w, h);
      haloed(g, rect(g, w * 0.2, h * 0.3, w * 0.6, h * 0.56), "#b07a3a");
      haloed(g, circ(g, w * 0.5, h * 0.3, w * 0.2), "#c89048", 1.1);
      g.strokeStyle = INK; g.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(w * 0.5 + Math.cos(a) * w * 0.08, h * 0.3 + Math.sin(a) * w * 0.08); g.lineTo(w * 0.5 + Math.cos(a) * w * 0.2, h * 0.3 + Math.sin(a) * w * 0.2); g.stroke(); }
      g.fillStyle = "#2a1c0e"; g.fillRect(w * 0.42, h * 0.58, w * 0.16, h * 0.28);
    },
    forsworn(g, w, h) {   // a hagraven totem with antlers
      shadow(g, w, h);
      haloed(g, rect(g, w * 0.44, h * 0.3, w * 0.12, h * 0.56), "#6a4a2c");
      g.strokeStyle = CREAM; g.lineWidth = 3.2; const ant = () => { g.beginPath(); g.moveTo(w * 0.5, h * 0.32); g.lineTo(w * 0.2, h * 0.08); g.moveTo(w * 0.32, h * 0.18); g.lineTo(w * 0.3, h * 0.04); g.moveTo(w * 0.5, h * 0.32); g.lineTo(w * 0.8, h * 0.08); g.moveTo(w * 0.68, h * 0.18); g.lineTo(w * 0.7, h * 0.04); };
      ant(); g.stroke(); g.strokeStyle = "#d8c8a8"; g.lineWidth = 1.4; ant(); g.stroke();
      haloed(g, circ(g, w * 0.5, h * 0.34, w * 0.1), "#d8d0c0", 1);
      g.fillStyle = "#8e2b25"; g.fillRect(w * 0.44, h * 0.52, w * 0.12, 2);
    },
    vampire(g, w, h) {   // a dark tower with a red window
      shadow(g, w, h);
      haloed(g, poly(g, [[w * 0.3, h * 0.86], [w * 0.36, h * 0.3], [w * 0.5, h * 0.06], [w * 0.64, h * 0.3], [w * 0.7, h * 0.86]]), "#3a3040");
      g.fillStyle = "#e0302a"; g.beginPath(); g.arc(w * 0.5, h * 0.44, 2.4, 0, 7); g.fill();
    },
    mine(g, w, h) {   // a timbered entrance and a pick
      shadow(g, w, h);
      haloed(g, poly(g, [[w * 0.06, h * 0.86], [w * 0.5, h * 0.22], [w * 0.94, h * 0.86]]), "#8a7a64");
      g.fillStyle = "#16100a"; g.fillRect(w * 0.36, h * 0.5, w * 0.28, h * 0.36);
      g.strokeStyle = "#6a4626"; g.lineWidth = 2; g.strokeRect(w * 0.36, h * 0.5, w * 0.28, h * 0.36);
      g.strokeStyle = "#c8c0b0"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(w * 0.7, h * 0.22); g.quadraticCurveTo(w * 0.84, h * 0.16, w * 0.94, h * 0.3); g.stroke();
    },
    temple(g, w, h) {   // columns under a pediment
      shadow(g, w, h);
      haloed(g, poly(g, [[w * 0.14, h * 0.34], [w * 0.5, h * 0.12], [w * 0.86, h * 0.34]]), "#b8ac98");
      for (const x of [0.22, 0.42, 0.62]) haloed(g, rect(g, w * x, h * 0.36, w * 0.14, h * 0.48), "#c8bca8", 1);
      haloed(g, rect(g, w * 0.14, h * 0.82, w * 0.72, h * 0.06), "#a89c88", 1);
    },
    thalmor(g, w, h) {   // a gold-trimmed elven spire
      shadow(g, w, h);
      haloed(g, poly(g, [[w * 0.32, h * 0.86], [w * 0.5, h * 0.04], [w * 0.68, h * 0.86]]), "#d8c890");
      g.strokeStyle = "#a07820"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(w * 0.5, h * 0.2); g.lineTo(w * 0.5, h * 0.8); g.stroke();
    },
    banditcamp(g, w, h) { MARK.camp(g, w, h); g.fillStyle = "#8e2b25"; g.fillRect(w * 0.4, h * 0.18, 5, 3); },
    giantcamp(g, w, h) {   // a big hide tent and a mammoth tusk
      shadow(g, w, h);
      haloed(g, poly(g, [[w * 0.06, h * 0.86], [w * 0.4, h * 0.2], [w * 0.74, h * 0.86]]), "#9a7048");
      g.strokeStyle = CREAM; g.lineWidth = 3.4; g.beginPath(); g.arc(w * 0.82, h * 0.72, w * 0.14, Math.PI * 1.1, Math.PI * 1.95); g.stroke();
      g.strokeStyle = "#e8dcc0"; g.lineWidth = 1.8; g.beginPath(); g.arc(w * 0.82, h * 0.72, w * 0.14, Math.PI * 1.1, Math.PI * 1.95); g.stroke();
    },
  };
  const themeCache = {};
  /* which drawer a place uses */
  function markKind(name, kind) {
    if (name in themeCache) return themeCache[name];
    let k = kind;
    if (kind === "dungeon" || kind === "camp") {
      let th = null;
      try { th = typeof DUNGEONS !== "undefined" && DUNGEONS.enterable(name) ? DUNGEONS.info(name).theme : null; } catch { /* not a dungeon */ }
      if (th && MARK[th]) k = th; else if (th === "lair") k = "lair"; else if (kind === "dungeon") k = /mine/i.test(name) ? "mine" : "cave";
    }
    if (!MARK[k]) k = "cave";
    return (themeCache[name] = k);
  }
  const SIZE = { city: [30, 28], town: [24, 22], farm: [22, 20] };
  function marker(name, kind) {
    const mk = markKind(name, kind), [w, h] = SIZE[kind] || [22, 22];
    return { c: sprite("mk|" + mk, w, h, (g) => MARK[mk](g, w, h)), w, h };
  }

  // ---------------------------------------------------------------- tokens: you and other players
  const portraits = new Map();   // look key → canvas (or "loading")
  function portraitCanvas(look) {
    if (typeof HEROART === "undefined" || !look) return null;
    const key = JSON.stringify(look);
    const have = portraits.get(key);
    if (have && have !== "loading") return have;
    if (!have) {
      portraits.set(key, "loading");
      const html = HEROART.portrait({ look }, 48), m = /src="([^"]+)"/.exec(html);
      if (m) { const img = new Image(); img.onload = () => portraits.set(key, img); img.src = m[1]; }
    }
    return null;
  }
  /* a round token: ring colour, portrait inside (or a plain dot until it's ready). Built once per look + ring. */
  const tokens = new Map();
  function tokenCanvas(look, ring, r) {
    const p = portraitCanvas(look), key = JSON.stringify(look) + ring + r + dprNow()
 + (p ? 1 : 0);
    let c = tokens.get(key); if (c) return c;
    const d = dprNow(), size = (r + 4) * 2, R = r;
    c = document.createElement("canvas"); c.width = Math.ceil(size * d); c.height = Math.ceil((size + 4) * d);
    const g = c.getContext("2d"); g.scale(d, d); const x = size / 2, y = size / 2;
    g.fillStyle = "rgba(10,8,6,.45)"; g.beginPath(); g.ellipse(x, y + R * 0.95, R * 0.8, R * 0.28, 0, 0, 7); g.fill();
    g.fillStyle = "#e9dcc0"; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
    if (p) { g.save(); g.beginPath(); g.arc(x, y, R - 1.2, 0, 7); g.clip(); g.drawImage(p, x - R, y - R, R * 2, R * 2); g.restore(); }
    else { g.fillStyle = ring; g.beginPath(); g.arc(x, y, R * 0.55, 0, 7); g.fill(); }
    g.strokeStyle = "#0b1622"; g.lineWidth = 4.2; g.beginPath(); g.arc(x, y, R, 0, 7); g.stroke();
    g.strokeStyle = ring; g.lineWidth = 2.4; g.beginPath(); g.arc(x, y, R, 0, 7); g.stroke();
    if (tokens.size > 120) tokens.delete(tokens.keys().next().value);
    tokens.set(key, c); c._size = size; return c;
  }
  function token(g, x, y, s, look, ring, r = 13) {
    const c = tokenCanvas(look, ring, r), size = c._size;
    g.drawImage(c, x - (size / 2) * s, y - (size / 2) * s, size * s, (size + 4) * s);
  }
  /* a small horse under you when riding, in its coat colour */
  function horse(color) {
    return sprite("horse|" + color, 34, 22, (g) => {   // drawn small, stamped larger
      const ink = INK;
      g.fillStyle = "rgba(10,8,6,.35)"; g.beginPath(); g.ellipse(17, 20, 13, 2.2, 0, 0, 7); g.fill();
      g.strokeStyle = CREAM; g.lineWidth = 3.4; const body = () => { g.beginPath(); g.moveTo(5, 9); g.quadraticCurveTo(14, 5, 24, 8); g.lineTo(29, 3); g.lineTo(33, 5); g.lineTo(28, 11); g.lineTo(26, 13); g.lineTo(26, 20); g.moveTo(22, 13); g.lineTo(21, 20); g.moveTo(10, 13); g.lineTo(9, 20); g.moveTo(6, 12); g.lineTo(5, 20); };
      g.lineCap = "round"; body(); g.stroke();
      g.fillStyle = color; g.beginPath(); g.ellipse(15, 10.5, 10.5, 4.2, -0.05, 0, 7); g.fill();
      g.beginPath(); g.moveTo(23, 8); g.lineTo(29, 2.5); g.lineTo(33, 5); g.lineTo(27, 11); g.closePath(); g.fill();
      g.strokeStyle = ink; g.lineWidth = 1.2; g.beginPath(); g.ellipse(15, 10.5, 10.5, 4.2, -0.05, 0, 7); g.stroke();
      g.lineWidth = 1.8; g.strokeStyle = color; for (const [a, b] of [[25, 25], [21, 21], [10, 9], [6, 5]]) { g.beginPath(); g.moveTo(a, 13); g.lineTo(b, 20); g.stroke(); }
      g.strokeStyle = ink; g.lineWidth = 1; g.beginPath(); g.moveTo(4, 8); g.quadraticCurveTo(1, 12, 2, 16); g.stroke();
    });
  }

  // ---------------------------------------------------------------- route footprints
  function footprints(g, pts, s, t) {
    const step = 9 * s, off = (t * 14 * s) % (step * 2);
    let carry = off, foot = 0;
    g.fillStyle = "rgba(255,240,205,.92)"; g.strokeStyle = "rgba(30,20,10,.7)"; g.lineWidth = 0.9 * s;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      if (!L) continue;
      const ux = dx / L, uy = dy / L, ang = Math.atan2(dy, dx);
      for (let d = carry; d < L; d += step) {
        const side = foot++ % 2 ? 1 : -1, x = ax + ux * d - uy * side * 2.4 * s, y = ay + uy * d + ux * side * 2.4 * s;
        g.beginPath(); g.ellipse(x, y, 2.3 * s, 1.35 * s, ang, 0, 7); g.fill(); g.stroke();
      }
      carry = (carry - L) % step; if (carry < 0) carry += step;
    }
  }

  // ---------------------------------------------------------------- the living map
  let glints = null;
  function waterGlints(W, H) {   // a fixed set of spots on lakes, rivers and near coasts
    if (glints) return glints;
    glints = [];
    const T = Terrain.T, GW = Terrain.GW, GH = Terrain.GH, grid = Terrain.grid, r = ART.seeded("glints");
    for (let tries = 0; tries < 20000 && glints.length < 320; tries++) {
      const x = Math.floor(r() * GW), y = Math.floor(r() * GH), t = grid[y * GW + x];
      if (t === T.LAKE || t === T.RIVER || (t === T.SEA && y < GH * 0.3 && r() < 0.35)) glints.push([(x + 0.5) * W / GW, (y + 0.5) * H / GH, r() * 6.28, 3 + r() * 5]);
    }
    return glints;
  }
  const cloudSprite = () => sprite("cloud", 160, 90, (g) => {
    const r = ART.seeded("cloud");
    for (let i = 0; i < 7; i++) { const x = 30 + r() * 100, y = 30 + r() * 30, rad = 22 + r() * 22, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, "rgba(20,24,30,.55)"); gr.addColorStop(1, "rgba(20,24,30,0)"); g.fillStyle = gr; g.fillRect(0, 0, 160, 90); }
  });
  const glowSprite = (color) => sprite("glow|" + color, 32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
  /* how dark the world is right now: 0 at noon … ~0.5 deep night */
  function darkness(t) {
    if (typeof G === "undefined" || !G.clock) return 0;
    const h = G.clock(t).hour;
    if (h >= 7 && h < 18) return 0;
    if (h >= 21 || h < 5) return 0.55;
    if (h >= 18 && h < 21) return ((h - 18) / 3) * 0.55;
    return ((7 - h) / 2) * 0.55;
  }
  /* the ambient layer, drawn after the painted map and fog, in map units */
  function ambient(g, v, s, W, H, view) {
    const t = v.reduceMotion ? 0 : v.t, nowS = Date.now() / 1000;
    const [vx0, vy0, vx1, vy1] = view;
    // water glints
    if (!v.reduceMotion) {
      g.strokeStyle = "rgba(235,248,255,.8)"; g.lineCap = "round"; g.lineWidth = 1.1 * s;
      g.beginPath();
      for (const [x, y, ph, len] of waterGlints(W, H)) {
        if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
        const a = Math.sin(t * 1.6 + ph); if (a < 0.55) continue;
        const L = len * (a - 0.5) * s * 1.4; g.moveTo(x - L, y); g.lineTo(x + L, y);
      }
      g.stroke();
    }
    // cloud shadows drifting west → east
    const dark = darkness(nowS);
    if (!["fog", "blizzard"].includes(v.weather) && dark < 0.3) {
      const cs = cloudSprite(); g.globalAlpha = v.weather === "cloudy" || v.weather === "storm" ? 0.42 : 0.24;
      for (let i = 0; i < 5; i++) {
        const sp = 6 + i * 2.5, x = ((i * 233 + t * sp) % (W + 400)) - 300, y = (i * 151 + 40) % (H - 120);
        g.drawImage(cs, x, y, 320, 180);
      }
      g.globalAlpha = 1;
    }
    // birds over the land in daytime
    if (!v.reduceMotion && dark < 0.2 && !["rain", "storm", "snow", "blizzard"].includes(v.weather)) {
      g.strokeStyle = "rgba(30,22,14,.75)"; g.lineWidth = 1.1 * s; g.beginPath();
      for (let f = 0; f < 3; f++) {
        const fx = ((f * 377 + t * (9 + f * 3)) % (W + 200)) - 100, fy = 120 + f * 170 + Math.sin(t * 0.3 + f) * 20;
        for (let b = 0; b < 4; b++) {
          const bx = fx - b * 9 * s - (b % 2) * 3 * s, by = fy + (b % 2 ? 5 : -2) * s * (b ? 1 : 0) + b * 2 * s, flap = Math.sin(t * 8 + b * 1.7 + f) * 1.8 * s;
          g.moveTo(bx - 3.5 * s, by - flap); g.quadraticCurveTo(bx - 1.5 * s, by - 2.2 * s, bx, by); g.quadraticCurveTo(bx + 1.5 * s, by - 2.2 * s, bx + 3.5 * s, by - flap);
        }
      }
      g.stroke();
    }
    return dark;
  }
  /* night: a blue wash, then warm lights where people live */
  function night(g, v, s, W, H, dark, shown) {
    if (dark <= 0.01) return;
    g.fillStyle = `rgba(14,22,48,${dark})`; g.fillRect(0, 0, W, H);
    const warm = glowSprite("rgba(255,180,80,1)"), t = v.reduceMotion ? 0 : v.t;
    g.globalAlpha = Math.min(1, dark * 2);
    g.globalCompositeOperation = "lighter";   // light adds up instead of covering
    for (const [n, x, y, kind] of shown) {
      if (!["city", "town", "farm", "camp"].includes(kind)) continue;
      const big = kind === "city" ? 70 : kind === "town" ? 48 : 30, fl = 1 + Math.sin(t * 5 + x * 7) * 0.07, R = big * s * fl;
      g.drawImage(warm, x * W - R / 2, y * H - R / 2 - 3 * s, R, R);
    }
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  }
  /* a golden burst where a new place was just found */
  const bursts = [];
  let lastDisc = null;
  function trackDiscoveries(discovered) {
    const n = discovered.length;
    if (lastDisc !== null && n > lastDisc && n - lastDisc <= 6) for (const name of discovered.slice(lastDisc)) if (WORLD.places[name]) bursts.push({ name, at: performance.now() });
    lastDisc = n;
  }
  function drawBursts(g, s, W, H, reduce) {
    const now = performance.now();
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i], age = (now - b.at) / 1800;
      if (age >= 1 || reduce) { bursts.splice(i, 1); continue; }
      const [x, y] = WORLD.places[b.name], R = (10 + age * 46) * s;
      g.strokeStyle = `rgba(240,205,120,${1 - age})`; g.lineWidth = (3.2 - age * 2.4) * s;
      g.beginPath(); g.arc(x * W, y * H, R, 0, 7); g.stroke();
      g.fillStyle = `rgba(255,236,180,${0.5 * (1 - age)})`;
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + age * 1.5; g.beginPath(); g.arc(x * W + Math.cos(a) * R * 0.8, y * H + Math.sin(a) * R * 0.8, 1.8 * s, 0, 7); g.fill(); }
    }
  }
  const active = () => bursts.length > 0;
  return { sprite, marker, markKind, MARK, token, horse, footprints, ambient, night, trackDiscoveries, drawBursts, glowSprite, darkness, active };
})();
