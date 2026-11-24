/* Dungeon art: a painted parchment chart of the dungeon you're in (ink medallions per room type, corridors that show up
   as your torchlight reaches them, a red-ink trail of the way you walked, the boss chamber marked at the end), a living
   layer on top (the newest step inks itself in, the room you're in glows, the rooms you can reach pulse), a loot strip
   with item icons, and small animations for chests. The map is always drawn in the ink style. [OURS] */
const DUNART = (() => {
  const LX = (x) => (typeof I18N_SWEEP !== "undefined" ? I18N_SWEEP.c(x) : x);   // words drawn on canvas, in the player's language
  // ---- colours per dungeon theme: background, corridor, chamber fill, chamber edge, accent
  const TH = {
    cave: { bg: "#231e19", rock: "#3a3128", corr: "#4a3e31", node: "#6b5a48", edge: "#2a221b", acc: "#c9a75e" },
    barrow: { bg: "#1f2226", rock: "#33373c", corr: "#45474a", node: "#7a766d", edge: "#2b2c2e", acc: "#9fd0f0" },
    mine: { bg: "#241d16", rock: "#3d3125", corr: "#5a4630", node: "#7a6248", edge: "#2d241a", acc: "#d6b25e" },
    dwemer: { bg: "#21190f", rock: "#3a2c18", corr: "#5c4524", node: "#b08a4a", edge: "#5a4020", acc: "#e8c070" },
    forsworn: { bg: "#22211a", rock: "#383527", corr: "#4a4532", node: "#7a6e52", edge: "#2c2a20", acc: "#c4572e" },
    vampire: { bg: "#1b1316", rock: "#2e1f24", corr: "#3e2a30", node: "#5e3a42", edge: "#24161a", acc: "#d23a3a" },
    temple: { bg: "#1d2124", rock: "#30363a", corr: "#40474c", node: "#8a8f96", edge: "#2a2e31", acc: "#d6b25e" },
    fort: { bg: "#202020", rock: "#353531", corr: "#47463f", node: "#7d7a72", edge: "#2b2b28", acc: "#e8923a" },
    thalmor: { bg: "#1e2226", rock: "#31373d", corr: "#434a50", node: "#c9b98a", edge: "#5a5240", acc: "#f0dfa0" },
    banditcamp: { bg: "#26211a", rock: "#3d342a", corr: "#5a4a36", node: "#8a6a44", edge: "#2f271d", acc: "#e8923a" },
    giantcamp: { bg: "#2a2a24", rock: "#4a4638", corr: "#6a6250", node: "#9a8f76", edge: "#3a362c", acc: "#e8923a" },
    lair: { bg: "#202428", rock: "#3a4048", corr: "#59616a", node: "#8f969e", edge: "#2c3238", acc: "#c4572e" },
  };
  const themeOf = (t) => TH[t] || TH.cave;
  const TYPES = ["fight", "elite", "trap", "treasure", "puzzle", "rest", "mystery", "boss"];
  const W = 340, GAP = 66, TOP = 48;
  const xy = (rows, r, c) => [W / (rows[r].length + 1) * (c + 1), TOP + r * GAP];
  const heightOf = (rows) => TOP + (rows.length - 1) * GAP + 42;

  // ---- chamber shapes by theme
  function chamber(g, H, theme, x, y, rad, fill, edge, seed) {
    const r = H.seeded(seed);
    if (theme === "dwemer") {          // a brass gear
      g.fillStyle = fill; g.strokeStyle = edge; g.lineWidth = 1.4;
      g.beginPath();
      for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2, rr = i % 2 ? rad * 0.86 : rad * 1.05; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.stroke();
      H.circle(g, x, y, rad * 0.62, "rgba(0,0,0,0.18)", null);
    } else if (theme === "barrow" || theme === "temple" || theme === "thalmor") {   // cut stone, eight sides
      const pts = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]); }
      H.poly(g, pts, fill, edge, 1.6);
      g.strokeStyle = "rgba(0,0,0,0.22)"; g.lineWidth = 1; g.beginPath(); g.arc(x, y, rad * 0.72, 0, Math.PI * 2); g.stroke();
    } else if (theme === "fort" || theme === "banditcamp" || theme === "mine") {     // a timber-framed room
      const s = rad * 0.92; H.poly(g, [[x - s, y - s * 0.85], [x + s, y - s * 0.85], [x + s, y + s * 0.85], [x - s, y + s * 0.85]], fill, edge, 1.6);
      g.strokeStyle = "rgba(40,28,18,0.55)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - s, y - s * 0.5); g.lineTo(x + s, y - s * 0.5); g.moveTo(x - s * 0.5, y - s * 0.85); g.lineTo(x - s * 0.5, y + s * 0.85); g.stroke();
    } else {                                     // rough cave rock
      const pts = []; for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2, rr = rad * (0.86 + r() * 0.24); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
      H.poly(g, pts, fill, edge, 1.6);
    }
  }

  // ---- room-type symbols, drawn in ink so they read in both styles
  function symbol(g, H, type, x, y, s, theme, col = "#1c1612") {
    g.save(); g.translate(x, y); g.strokeStyle = col; g.fillStyle = col; g.lineCap = "round"; g.lineJoin = "round";
    const line = (pts, w = 2.2) => { g.lineWidth = w; g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a * s, b * s) : g.moveTo(a * s, b * s))); g.stroke(); };
    if (type === "fight") {              // crossed swords
      line([[-0.55, 0.55], [0.5, -0.5]]); line([[0.55, 0.55], [-0.5, -0.5]]);
      line([[-0.3, 0.2], [-0.1, 0.42]], 2.6); line([[0.3, 0.2], [0.1, 0.42]], 2.6);
    } else if (type === "elite") {       // skull
      g.beginPath(); g.arc(0, -0.08 * s, 0.48 * s, Math.PI, 0); g.lineTo(0.36 * s, 0.32 * s); g.lineTo(-0.36 * s, 0.32 * s); g.closePath(); g.fill();
      g.fillStyle = "#f4ead0"; g.beginPath(); g.arc(-0.18 * s, -0.04 * s, 0.13 * s, 0, 7); g.arc(0.18 * s, -0.04 * s, 0.13 * s, 0, 7); g.fill();
      g.fillStyle = col; g.fillRect(-0.24 * s, 0.32 * s, 0.48 * s, 0.16 * s);
    } else if (type === "trap") {        // spikes
      for (const dx of [-0.42, 0, 0.42]) H.poly(g, [[dx * s - 0.17 * s, 0.45 * s], [dx * s, -0.5 * s], [dx * s + 0.17 * s, 0.45 * s]], col, null);
      g.fillRect(-0.62 * s, 0.42 * s, 1.24 * s, 0.12 * s);
    } else if (type === "treasure") {    // chest
      H.poly(g, [[-0.6 * s, -0.05 * s], [0.6 * s, -0.05 * s], [0.6 * s, 0.5 * s], [-0.6 * s, 0.5 * s]], "#7a5232", col, 1.6);
      g.beginPath(); g.moveTo(-0.6 * s, -0.05 * s); g.quadraticCurveTo(0, -0.62 * s, 0.6 * s, -0.05 * s); g.closePath(); g.fillStyle = "#8f6238"; g.fill(); g.lineWidth = 1.6; g.stroke();
      g.fillStyle = "#d6b25e"; g.fillRect(-0.09 * s, -0.06 * s, 0.18 * s, 0.24 * s);
    } else if (type === "puzzle") {      // pillar with a carved head
      g.fillRect(-0.22 * s, -0.4 * s, 0.44 * s, 0.86 * s); g.fillRect(-0.36 * s, -0.55 * s, 0.72 * s, 0.16 * s); g.fillRect(-0.36 * s, 0.42 * s, 0.72 * s, 0.14 * s);
      g.fillStyle = "#f4ead0"; g.beginPath(); g.arc(0, 0, 0.12 * s, 0, 7); g.fill();
    } else if (type === "rest") {        // campfire
      line([[-0.5, 0.48], [0.5, 0.28]], 2.6); line([[0.5, 0.48], [-0.5, 0.28]], 2.6);
      H.poly(g, [[-0.3 * s, 0.3 * s], [-0.18 * s, -0.2 * s], [0, 0.05 * s], [0.08 * s, -0.55 * s], [0.3 * s, 0.3 * s]], "#e8923a", col, 1.2);
    } else if (type === "mystery") {     // question mark
      g.lineWidth = 2.6 * (s / 12); g.beginPath(); g.arc(0, -0.2 * s, 0.3 * s, Math.PI * 1.05, Math.PI * 2.35); g.lineTo(0, 0.15 * s); g.stroke();
      g.beginPath(); g.arc(0, 0.45 * s, 0.07 * s, 0, 7); g.fill();
    } else if (type === "boss") {
      if (theme === "lair") {            // dragon head
        H.poly(g, [[-0.7 * s, 0.1 * s], [-0.2 * s, -0.35 * s], [0.25 * s, -0.4 * s], [0.75 * s, -0.05 * s], [0.25 * s, 0.1 * s], [0.6 * s, 0.45 * s], [-0.1 * s, 0.35 * s]], col, null);
        H.poly(g, [[-0.2 * s, -0.35 * s], [-0.45 * s, -0.8 * s], [0, -0.38 * s]], col, null);
        g.fillStyle = "#e8923a"; g.beginPath(); g.arc(0.15 * s, -0.17 * s, 0.07 * s, 0, 7); g.fill();
      } else if (theme === "giantcamp") { // a giant's club
        g.lineWidth = 3; g.beginPath(); g.moveTo(-0.5 * s, 0.55 * s); g.lineTo(0.25 * s, -0.3 * s); g.stroke();
        g.beginPath(); g.ellipse(0.32 * s, -0.38 * s, 0.26 * s, 0.38 * s, 0.7, 0, 7); g.fill();
      } else if (theme === "barrow" || theme === "temple") {   // a dragon priest mask
        g.beginPath(); g.moveTo(-0.45 * s, -0.55 * s); g.lineTo(0.45 * s, -0.55 * s); g.lineTo(0.38 * s, 0.25 * s); g.lineTo(0, 0.6 * s); g.lineTo(-0.38 * s, 0.25 * s); g.closePath(); g.fill();
        g.fillStyle = "#d6b25e"; g.fillRect(-0.28 * s, -0.12 * s, 0.2 * s, 0.08 * s); g.fillRect(0.08 * s, -0.12 * s, 0.2 * s, 0.08 * s);
        g.fillRect(-0.04 * s, -0.5 * s, 0.08 * s, 0.32 * s);
      } else {                           // a crown
        H.poly(g, [[-0.6 * s, 0.35 * s], [-0.6 * s, -0.3 * s], [-0.3 * s, 0.02 * s], [0, -0.5 * s], [0.3 * s, 0.02 * s], [0.6 * s, -0.3 * s], [0.6 * s, 0.35 * s]], "#d6b25e", col, 1.6);
      }
    }
    g.restore();
  }

  // ---- the whole map, drawn once per room change: a painted parchment chart of the depths.
  // Corridors you can't see yet stay blank, rooms beyond your torchlight are pencil smudges, the way you walked is a
  // red-ink trail, and every room is an ink medallion with its type drawn inside. Ink style only.
  const INK = "#2b1d12", RED = "#8e2b25", GOLD = "#b8862e";
  const RING = { fight: "#5a4030", elite: "#7a2420", trap: "#9a5a1e", treasure: "#a07a22", puzzle: "#3e5a6a", rest: "#b0561e", mystery: "#6a5a7a", boss: "#8e2b25" };
  /* a corridor as a slightly bent ink stroke; the same bend every time for the same rooms */
  function curve(d, r, c, j) {
    const rows = d.rows, [x1, y1] = xy(rows, r, c), [x2, y2] = xy(rows, r + 1, j), q = ART.seeded(`${d.place}|${r}|${c}|${j}`);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / len, ny = (x2 - x1) / len, b = (q() - 0.5) * 16;
    return [x1, y1, mx + nx * b, my + ny * b, x2, y2];
  }
  const stroke = (g, cv, col, w, dash = [], alpha = 1) => { g.save(); g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.setLineDash(dash);
    g.beginPath(); g.moveTo(cv[0], cv[1]); g.quadraticCurveTo(cv[2], cv[3], cv[4], cv[5]); g.stroke(); g.restore(); };
  /* where you've been: [[r, c], …] including the room you're in */
  const walkedPairs = (d) => { const p = d.path || [], out = []; for (let i = 0; i + 1 < p.length; i++) if (p[i + 1][0] === p[i][0] + 1) out.push([p[i][0], p[i][1], p[i + 1][1]]); return out; };
  /* the newest step (the corridor into the room you're in), drawn by the overlay so it can ink itself in */
  function newestStep(d) { const w = walkedPairs(d), last = w[w.length - 1], p = d.path || []; return last && p.length && d.row === p[p.length - 1][0] && d.col === p[p.length - 1][1] && last[0] === d.row - 1 ? last : null; }
  function drawMap(g, H, w, h, d, next, opts = {}) {
    const T = themeOf(d.theme), rows = d.rows, rnd = H.seeded(d.place + d.theme), path = d.path || [];
    const sight = d.done ? rows.length : Math.max(1, d.row + 3);   // you can see two rows ahead; deeper is still unexplored
    const seen = (r) => r < sight || rows[r][0].type === "boss";
    // paper: parchment, a wash of the dungeon's colour, stains, grain, darker burnt edges
    H.parchment(g, w, h, d.place);
    g.globalAlpha = 0.07; g.fillStyle = T.acc; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
    for (let i = 0; i < 7; i++) { const x = rnd() * w, y = rnd() * h, r0 = 14 + rnd() * 40, gr = g.createRadialGradient(x, y, 0, x, y, r0);
      gr.addColorStop(0, "rgba(120,86,46,0.10)"); gr.addColorStop(1, "rgba(120,86,46,0)"); g.fillStyle = gr; g.fillRect(x - r0, y - r0, r0 * 2, r0 * 2); }
    // the rock the halls are cut into: soft brown washes along every corridor you can see
    rows.forEach((row, r) => row.forEach((n, c) => n.links.forEach((j) => {
      if (r + 1 >= rows.length || !seen(r) || !seen(r + 1)) return;
      stroke(g, curve(d, r, c, j), "rgba(92,64,36,0.13)", 26);
    })));
    rows.forEach((row, r) => row.forEach((n, c) => { if (!seen(r)) return; const [x, y] = xy(rows, r, c), gr = g.createRadialGradient(x, y, 0, x, y, 34);
      gr.addColorStop(0, "rgba(92,64,36,0.16)"); gr.addColorStop(1, "rgba(92,64,36,0)"); g.fillStyle = gr; g.fillRect(x - 34, y - 34, 68, 68); }));
    // corridors: ink where you can see, a pencil hint into the dark, red trail where you walked
    const walked = walkedPairs(d), fresh = opts.skipNewest ? newestStep(d) : null;
    const isWalked = (r, c, j) => walked.some((p) => p[0] === r && p[1] === c && p[2] === j);
    rows.forEach((row, r) => row.forEach((n, c) => n.links.forEach((j) => {
      if (r + 1 >= rows.length || !seen(r)) return;
      const cv = curve(d, r, c, j);
      if (isWalked(r, c, j)) return;
      if (r + 1 < sight) stroke(g, cv, INK, 1.5, [5, 4], 0.75);
      else stroke(g, cv, INK, 1.1, [1.5, 4], 0.35);   // fades out into the unknown
    })));
    for (const [r, c, j] of walked) {
      if (fresh && fresh[0] === r && fresh[1] === c && fresh[2] === j) continue;
      const cv = curve(d, r, c, j); stroke(g, cv, "rgba(142,43,37,0.25)", 6); stroke(g, cv, RED, 2.4, [7, 4]);
    }
    // the way in, at the top: a doorway in the rock with a few steps
    const ex = w / 2;
    g.fillStyle = "rgba(92,64,36,0.25)"; g.beginPath(); g.ellipse(ex, 10, 30, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = INK; g.beginPath(); g.moveTo(ex - 10, 18); g.lineTo(ex - 10, 8); g.arc(ex, 8, 10, Math.PI, 0); g.lineTo(ex + 10, 18); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(ex - 13 + i * 2, 21 + i * 3); g.lineTo(ex + 13 - i * 2, 21 + i * 3); g.stroke(); }
    if (path.length) { const [x2, y2] = xy(rows, path[0][0], path[0][1]); stroke(g, [ex, 30, (ex + x2) / 2, (30 + y2) / 2 - 4, x2, y2], RED, 2.4, [7, 4]); }
    else rows[0].forEach((_, c) => { const [x2, y2] = xy(rows, 0, c); stroke(g, [ex, 30, (ex + x2) / 2, (30 + y2) / 2 - 4, x2, y2], INK, 1.5, [5, 4], 0.75); });
    // rooms
    rows.forEach((row, r) => row.forEach((n, c) => {
      const [x, y] = xy(rows, r, c), boss = n.type === "boss", rad = boss ? 22 : 17;
      const here = d.row === r && d.col === c && !d.done, done = path.some((p) => p[0] === r && p[1] === c) && !here, isNext = next.has(`${r}:${c}`);
      if (!seen(r)) {   // beyond your torchlight: a pencil circle and a question mark
        g.save(); g.globalAlpha = 0.32; g.strokeStyle = INK; g.lineWidth = 1; g.setLineDash([2, 3]); g.beginPath(); g.arc(x, y, rad - 3, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
        symbol(g, H, "mystery", x, y, 9, d.theme, INK); g.restore(); return;
      }
      g.fillStyle = "rgba(43,29,18,0.28)"; g.beginPath(); g.ellipse(x + 1.5, y + 3, rad, rad * 0.95, 0, 0, Math.PI * 2); g.fill();   // a soft shadow
      if (boss) { g.fillStyle = "rgba(142,43,37,0.14)"; g.beginPath(); g.arc(x, y, rad + 11, 0, Math.PI * 2); g.fill();
        g.strokeStyle = RED; g.lineWidth = 1; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(a) * (rad + 4), y + Math.sin(a) * (rad + 4)); g.lineTo(x + Math.cos(a) * (rad + 9), y + Math.sin(a) * (rad + 9)); g.stroke(); } }
      const gr = g.createRadialGradient(x - rad * 0.3, y - rad * 0.35, 1, x, y, rad);
      gr.addColorStop(0, here ? "#fff2c8" : done ? "#e2d2a8" : "#f6ead0"); gr.addColorStop(1, here ? "#e8c878" : done ? "#c9b48a" : "#dcc89c");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      g.strokeStyle = here ? GOLD : RING[n.type] || INK; g.lineWidth = here ? 3 : 2.2; g.stroke();
      g.strokeStyle = "rgba(43,29,18,0.45)"; g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, rad - 3.2, 0, Math.PI * 2); g.stroke();
      g.save(); if (done) g.globalAlpha = 0.45; symbol(g, H, n.type, x, y, boss ? 15 : 11.5, d.theme, INK); g.restore();
      if (done) {   // a red-ink tick: been there
        g.strokeStyle = RED; g.lineWidth = 2.4; g.lineCap = "round"; g.beginPath(); g.moveTo(x + rad * 0.3, y + rad * 0.55); g.lineTo(x + rad * 0.58, y + rad * 0.85); g.lineTo(x + rad * 1.05, y + rad * 0.2); g.stroke();
      }
      if (isNext) { g.strokeStyle = "#c4572e"; g.lineWidth = 1.6; g.setLineDash([4, 3]); g.beginPath(); g.arc(x, y, rad + 5, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
    }));
    // a small compass rose in the corner
    const cx = w - 26, cy = 24; g.save(); g.globalAlpha = 0.55; g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 0.8;
    g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 - Math.PI / 2; H.poly(g, [[cx + Math.cos(a) * 15, cy + Math.sin(a) * 15], [cx + Math.cos(a + 0.5) * 4, cy + Math.sin(a + 0.5) * 4], [cx, cy], [cx + Math.cos(a - 0.5) * 4, cy + Math.sin(a - 0.5) * 4]], i ? "rgba(43,29,18,0.5)" : RED, null); }
    g.restore();
    // burnt edges
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.max(w, h) * 0.72);
    v.addColorStop(0, "rgba(60,36,16,0)"); v.addColorStop(1, "rgba(60,36,16,0.45)"); g.fillStyle = v; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(43,29,18,0.7)"; g.lineWidth = 1.5; g.strokeRect(4, 4, w - 8, h - 8); g.lineWidth = 0.6; g.strokeRect(7, 7, w - 14, h - 14);
    // the cleared seal
    if (d.done) {
      const sx = w / 2, sy = h / 2;
      g.fillStyle = RED; g.beginPath(); for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, rr = i % 2 ? 46 : 52; g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } g.closePath(); g.fill();
      g.strokeStyle = "#5a1814"; g.lineWidth = 2; g.stroke(); H.circle(g, sx, sy, 36, null, "#c95a4a", 1.6);
      g.fillStyle = "#f4dcc0"; g.font = "bold 15px Georgia, serif"; g.textAlign = "center"; g.fillText(LX("CLEARED"), sx, sy + 5);
    }
    return [];
  }

  const nextSet = (d) => { const nx = typeof DUNGEONS !== "undefined" ? DUNGEONS.nextChoices({ dungeon: d }) : []; return new Set(nx.map((c) => `${d.row + 1}:${c}`)); };
  /* the ink icons of the room types in this dungeon, as a legend */
  function legendHTML(d) {
    const L = typeof DUNGEONS !== "undefined" ? DUNGEONS.LABEL : {};
    return `<div class="legend dlegend">${TYPES.filter((k) => d.rows.some((row) => row.some((n) => n.type === k))).map((k) => `<span>${ART.html(22, 22, (g, H, w, h) => {
      H.circle(g, w / 2, h / 2, 10, "#ecdcb6", RING[k], 1.4); symbol(g, H, k, w / 2, h / 2, 6.5, d.theme, INK); }, { key: `dleg|${k}|${d.theme}`, style: "ink", cls: "dlg", alt: "" })}${L[k] || k}</span>`).join("")}</div>`;
  }
  let inked = "";   // the last step already inked in, so a redraw of the same room doesn't replay it
  /* HTML for the map: the drawing, a glow canvas on top, and tap targets for the rooms you can go to next */
  function mapHTML(d) {
    const rows = d.rows, h = heightOf(rows), next = nextSet(d), fresh = newestStep(d);
    if (typeof DUNROOMS !== "undefined") DUNROOMS.warm(d);   // fetch the paintings of the rooms ahead
    const key = `dun2|${d.place}|${d.theme}|${JSON.stringify(rows.map((r) => r.map((n) => n.type[0] + n.links.join(""))))}|${d.row}|${d.col}|${(d.path || []).join(";")}|${d.done ? 1 : 0}`;
    const url = ART.url(W, h, (g, H, w, hh) => { drawMap(g, H, w, hh, d, next, { skipNewest: true }); }, { key, style: "ink" });
    const nodes = [...next].map((k) => { const [r, c] = k.split(":").map(Number), [x, y] = xy(rows, r, c), n = rows[r][c];
      return `<button class="dnode" data-act="droom" data-c="${c}" style="left:${(x / W * 100).toFixed(2)}%;top:${(y / h * 100).toFixed(2)}%" aria-label="Go to: ${DUNGEONS.LABEL[n.type]}"></button>`; }).join("");
    const here = d.row >= 0 && !d.done ? [...xy(rows, d.row, d.col), rows[d.row][d.col].type === "boss" ? 22 : 17] : null;
    const seg = fresh ? curve(d, ...fresh).map((v) => v.toFixed(1)).join(",") : "", segKey = fresh ? `${d.place}|${(d.path || []).length}|${d.t || ""}` : "";
    return `<div class="dmap" data-w="${W}" data-h="${h}" data-here="${here ? here.map(Math.round).join(",") : ""}" data-seg="${seg}" data-segkey="${segKey}" data-theme="${d.theme}" style="--dh:${h}">
      <img src="${url}" width="${W}" height="${h}" alt="Map of ${String(d.place).replace(/"/g, "")}">
      <canvas class="dflick" aria-hidden="true"></canvas>${nodes}</div>`;
  }

  /* the living layer: the newest step inks itself in, the room you're in glows, the rooms you can reach pulse */
  let raf = 0;
  function start(root, reduce) {
    cancelAnimationFrame(raf);
    const box = root?.querySelector(".dmap"); if (!box) return;
    const cv = box.querySelector(".dflick"), w = +box.dataset.w, h = +box.dataset.h;
    const here = box.dataset.here ? box.dataset.here.split(",").map(Number) : null;
    const seg = box.dataset.seg ? box.dataset.seg.split(",").map(Number) : null, segKey = box.dataset.segkey || "";
    const next = [...box.querySelectorAll(".dnode")].map((b) => [parseFloat(b.style.left) / 100 * w, parseFloat(b.style.top) / 100 * h]);
    const k = typeof FITCANVAS !== "undefined" ? FITCANVAS.ratio(cv, w) : Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    const g = cv.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0);
    const t0 = performance.now(), animate = !reduce && seg && segKey !== inked; if (seg) inked = segKey;
    const glow = (x, y, r, a, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    const partial = (p) => {   // the quadratic curve up to p, as a polyline
      const [x1, y1, cx, cy, x2, y2] = seg, n = Math.max(2, Math.round(24 * p)); g.beginPath();
      for (let i = 0; i <= n; i++) { const t = (i / n) * p, u = 1 - t; const x = u * u * x1 + 2 * u * t * cx + t * t * x2, y = u * u * y1 + 2 * u * t * cy + t * t * y2; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    };
    let last = 0;
    const frame = (ts) => {
      if (!cv.isConnected) return;
      if (ts - last > 60 || reduce) {
        last = ts; g.clearRect(0, 0, w, h);
        const p = animate ? Math.min(1, (ts - t0) / 750) : 1, s = 0.5 + 0.5 * Math.sin(ts / 320);
        if (seg) { g.lineCap = "round"; g.setLineDash([]); g.strokeStyle = "rgba(142,43,37,0.25)"; g.lineWidth = 6; partial(p); g.stroke();
          g.setLineDash([7, 4]); g.strokeStyle = "#8e2b25"; g.lineWidth = 2.4; partial(p); g.stroke(); g.setLineDash([]);
          if (p < 1) { const [x1, y1, cx, cy, x2, y2] = seg, u = 1 - p; glow(u * u * x1 + 2 * u * p * cx + p * p * x2, u * u * y1 + 2 * u * p * cy + p * p * y2, 9, 0.8, "255,200,110"); } }
        if (here && p >= 1) {
          const [x, y, r] = here;
          glow(x, y, r + 20 + s * 4, reduce ? 0.45 : 0.32 + s * 0.18, "255,196,92");
          g.strokeStyle = `rgba(184,134,46,${reduce ? 0.9 : 0.55 + s * 0.4})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 4 + (reduce ? 0 : s * 2), 0, 7); g.stroke();
        }
        for (const [x, y] of next) {
          glow(x, y, 28, reduce ? 0.22 : 0.1 + s * 0.2, "232,120,50");
          g.strokeStyle = `rgba(196,87,46,${reduce ? 0.8 : 0.45 + s * 0.45})`; g.lineWidth = 2; g.setLineDash([5, 4]); g.lineDashOffset = reduce ? 0 : -ts / 60;
          g.beginPath(); g.arc(x, y, 23, 0, 7); g.stroke(); g.setLineDash([]); g.lineDashOffset = 0;
        }
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  // ---- loot strip: icons for what you found
  let byName = null;
  function idOf(name) {
    if (!byName) { byName = {}; for (const [id, it] of Object.entries(D.ITEMS)) if (!id.startsWith("ench|") && it?.name && !byName[it.name]) byName[it.name] = id; }
    if (byName[name]) return byName[name];
    const base = String(name).split(" of ")[0];   // enchanted things: "Iron Helmet of Health" → an ench id if one exists, else the plain item
    const ench = Object.keys(D.ITEMS).find((id) => id.startsWith("ench|") && D.ITEMS[id]?.name === name);
    return ench || byName[base] || null;
  }
  const coins = (size) => ART.html(size, size, (g, H, w, h) => {
    for (const [dx, dy] of [[-0.12, 0.14], [0.14, 0.1], [0, -0.06]]) { const x = w * (0.5 + dx), y = h * (0.55 + dy); g.fillStyle = "#8a6a2a"; g.beginPath(); g.ellipse(x, y + 2, w * 0.24, h * 0.12, 0, 0, 7); g.fill(); g.fillStyle = "#d6b25e"; g.beginPath(); g.ellipse(x, y, w * 0.24, h * 0.12, 0, 0, 7); g.fill(); g.strokeStyle = "#3b2c1e"; g.lineWidth = 1; g.stroke(); }
  }, { key: "dun-coins", cls: "ico" });
  function lootStrip(gold, names) {
    const items = (names || []).map((n) => { const m = String(n).match(/^(.*?)(?: ×(\d+))?$/); return { name: m[1], n: +(m[2] || 1), id: idOf(m[1]) }; });
    if (!gold && !items.length) return "";
    const one = (icon, label, i) => `<span class="dloot" style="animation-delay:${i * 90}ms" title="${label.replace(/"/g, "")}">${icon}<small>${label}</small></span>`;
    let i = 0;
    return `<div class="dloots">${gold ? one(coins(34), `${gold} gold`, i++) : ""}${items.map((x) => one(x.id && typeof ICONART !== "undefined" ? ICONART.item(x.id, 34) : coins(34), `${x.name}${x.n > 1 ? " ×" + x.n : ""}`, i++)).join("")}</div>`;
  }

  // ---- a chest that opens (treasure rooms)
  function chestHTML(open) { return `<canvas class="dchest" width="120" height="84" data-open="${open ? 1 : 0}" aria-hidden="true"></canvas>`; }
  function animateChest(root, reduce) {
    const cv = root?.querySelector(".dchest"); if (!cv) return;
    const dpr = Math.min(2, devicePixelRatio || 1), w = 120, h = 84, pixel = ART.style() === "pixel", k = pixel ? 0.5 : dpr;
    cv.width = w * k; cv.height = h * k; cv.style.width = w + "px"; cv.style.height = h + "px"; if (pixel) cv.style.imageRendering = "pixelated";
    const g = cv.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0);
    const open = cv.dataset.open === "1", t0 = performance.now(), dur = reduce ? 0 : 900;
    const draw = (p) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(60, 76, 40, 6, 0, 0, 7); g.fill();
      if (open && p > 0.35) { const a = Math.min(1, (p - 0.35) / 0.4); const gr = g.createRadialGradient(60, 40, 2, 60, 40, 46); gr.addColorStop(0, `rgba(255,220,120,${0.7 * a})`); gr.addColorStop(1, "rgba(255,220,120,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 6; i++) { const ang = i * 1.05 + p * 2, rr = 14 + 26 * a; g.fillStyle = `rgba(255,236,170,${a})`; g.fillRect(60 + Math.cos(ang) * rr, 36 - Math.abs(Math.sin(ang)) * rr * 0.7, 2.5, 2.5); } }
      g.fillStyle = "#7a5232"; g.strokeStyle = "#2a1c10"; g.lineWidth = 2; g.fillRect(28, 42, 64, 32); g.strokeRect(28, 42, 64, 32);
      g.fillStyle = "#d6b25e"; g.fillRect(28, 50, 64, 4); g.fillRect(56, 44, 8, 12);
      if (open) { g.fillStyle = "#e8c070"; g.fillRect(32, 42, 56, 5); }
      const lid = open ? Math.min(1, p / 0.5) : 0;
      if (lid > 0.5) {                     // the lid swung back: its underside shows above the chest, gold inside
        const up = (lid - 0.5) * 2;
        g.fillStyle = "#2a1c10"; g.fillRect(30, 40, 60, 6);
        for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? "#f0d080" : "#d6b25e"; g.beginPath(); g.arc(36 + i * 8, 42 - (i % 3), 3.2, 0, 7); g.fill(); }
        g.fillStyle = "#6a4426"; g.beginPath(); g.moveTo(28, 42); g.lineTo(92, 42); g.lineTo(92 - 4 * up, 42 - 26 * up); g.lineTo(28 + 4 * up, 42 - 26 * up); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#d6b25e"; g.fillRect(56, 42 - 24 * up, 8, 4);
      } else {
        g.save(); g.translate(28, 42); g.scale(1, Math.cos(lid * 2.4));
        g.fillStyle = "#8f6238"; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(32, -26, 64, 0); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#d6b25e"; g.fillRect(28, -6, 8, 6); g.restore();
      }
    };
    if (!dur) return draw(1);   // reduced motion: the final frame
    const step = (ts) => { if (!cv.isConnected) return; const p = Math.min(1, (ts - t0) / dur); draw(p); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* everything that should start after the dungeon screen is drawn */
  function after(root, reduce) { start(root, reduce); animateChest(root, reduce); if (typeof DUNROOMS !== "undefined") DUNROOMS.after(root); }
  return { TH, TYPES, W, GAP, mapHTML, legendHTML, drawMap, symbol, chamber, lootStrip, chestHTML, after, themeOf, xy, heightOf, curve, newestStep };
})();
