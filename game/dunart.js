/* Dungeon art: a drawn map of the dungeon you're in (rooms as themed chambers joined by torch-lit corridors,
   fog over the deep rows, the boss chamber at the end), a flickering torch overlay, a loot strip with item icons,
   and small animations for chests, traps and campfires. Uses the shared ART toolkit, so both art styles work. [OURS] */
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
  const W = 340, GAP = 66, TOP = 36;
  const xy = (rows, r, c) => [W / (rows[r].length + 1) * (c + 1), TOP + r * GAP];
  const heightOf = (rows) => TOP + (rows.length - 1) * GAP + 40;

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

  // ---- the whole map, drawn once per room change
  function drawMap(g, H, w, h, d, next) {
    const T = themeOf(d.theme), rows = d.rows, rnd = H.seeded(d.place + d.theme);
    g.fillStyle = T.bg; g.fillRect(0, 0, w, h);
    // rock texture: blobs and cracks
    for (let i = 0; i < 70; i++) { g.fillStyle = i % 3 ? T.rock : T.edge; g.globalAlpha = 0.5; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 22, 4 + rnd() * 14, rnd() * 3, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 1;
    for (let i = 0; i < 18; i++) { let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 24; y += (rnd() - 0.5) * 18; g.lineTo(x, y); } g.stroke(); }
    const path = d.path || [], walked = (r, c, j) => path.some((p, i) => p[0] === r && p[1] === c && path[i + 1]?.[0] === r + 1 && path[i + 1]?.[1] === j)
      || (d.row === r + 1 && d.col === j && path.length && path[path.length - 1][0] === r && path[path.length - 1][1] === c);
    const fogFrom = Math.max(1, d.row + 3);   // you can see two rows ahead; deeper is dark
    // corridors: a dark trench with a lit floor when you've walked it
    const torches = [];
    rows.forEach((row, r) => row.forEach((n, c) => n.links.forEach((j) => {
      if (r + 1 >= rows.length) return;
      const [x1, y1] = xy(rows, r, c), [x2, y2] = xy(rows, r + 1, j), lit = walked(r, c, j);
      const fog = r + 1 >= fogFrom && rows[r + 1][0].type !== "boss";
      g.lineCap = "round";
      g.strokeStyle = T.edge; g.lineWidth = 13; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.strokeStyle = lit ? "#8a6a3e" : T.corr; g.lineWidth = 8; g.globalAlpha = fog ? 0.45 : 1; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.globalAlpha = 1;
      if (lit) { g.strokeStyle = "rgba(232,192,112,0.55)"; g.lineWidth = 2; g.setLineDash([3, 5]); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]);
        const mx = (x1 + x2) / 2 + 7, my = (y1 + y2) / 2; torches.push([mx, my]);
        g.fillStyle = "#3b2c1e"; g.fillRect(mx - 1, my - 2, 2, 7); H.circle(g, mx, my - 4, 2.6, "#e8923a", null); }
    })));
    // chambers
    rows.forEach((row, r) => row.forEach((n, c) => {
      const [x, y] = xy(rows, r, c), boss = n.type === "boss", rad = boss ? 24 : 19;
      const here = d.row === r && d.col === c, done = path.some((p) => p[0] === r && p[1] === c) && !here, isNext = next.has(`${r}:${c}`);
      const fog = r >= fogFrom && !boss;
      if (boss) { g.fillStyle = "rgba(196,87,46,0.18)"; g.beginPath(); g.arc(x, y, rad + 9, 0, 7); g.fill(); }
      chamber(g, H, d.theme, x, y, rad, fog ? T.rock : done ? T.corr : n.type === "boss" ? "#6a3b2a" : T.node, isNext ? T.acc : T.edge, d.place + r + c);
      if (fog) { g.fillStyle = "rgba(10,10,12,0.55)"; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); symbol(g, H, "mystery", x, y, 9, d.theme, "#5a5650"); }
      else symbol(g, H, n.type, x, y, boss ? 17 : 13, d.theme, done ? "#2a241e" : "#1c1612");
      if (done) { g.strokeStyle = "rgba(214,178,94,0.8)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + rad * 0.35, y + rad * 0.55); g.lineTo(x + rad * 0.6, y + rad * 0.8); g.lineTo(x + rad * 1.0, y + rad * 0.25); g.stroke(); }
      if (here) { g.strokeStyle = "#f0d080"; g.lineWidth = 2.4; g.beginPath(); g.arc(x, y, rad + 5, 0, 7); g.stroke(); }
      if (isNext) { g.strokeStyle = T.acc; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(x, y, rad + 6, 0, 7); g.stroke(); g.setLineDash([]); }
    }));
    // the way in, at the top
    const [ex] = [w / 2]; g.fillStyle = "#0e0f11"; g.beginPath(); g.ellipse(ex, 8, 26, 10, 0, 0, Math.PI); g.fill();
    // fog bank over the deep rows
    if (fogFrom < rows.length - 1) {
      const y0 = TOP + fogFrom * GAP - GAP * 0.5, y1 = TOP + (rows.length - 1) * GAP - GAP * 0.45;
      const gr = g.createLinearGradient(0, y0, 0, y0 + 40); gr.addColorStop(0, "rgba(8,8,10,0)"); gr.addColorStop(1, "rgba(8,8,10,0.55)");
      g.fillStyle = gr; g.fillRect(0, y0, w, Math.max(40, y1 - y0));
    }
    // vignette
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.4)"); g.fillStyle = v; g.fillRect(0, 0, w, h);
    // the cleared seal
    if (d.done) {
      const cx = w / 2, cy = h / 2;
      g.fillStyle = "#8e2b25"; g.beginPath(); for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, rr = i % 2 ? 46 : 52; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill();
      g.strokeStyle = "#5a1814"; g.lineWidth = 2; g.stroke(); H.circle(g, cx, cy, 36, null, "#c95a4a", 1.6);
      g.fillStyle = "#f4dcc0"; g.font = "bold 15px Georgia, serif"; g.textAlign = "center"; g.fillText(LX("CLEARED"), cx, cy + 5);
    }
    return torches;
  }

  const nextSet = (d) => { const nx = typeof DUNGEONS !== "undefined" ? DUNGEONS.nextChoices({ dungeon: d }) : []; return new Set(nx.map((c) => `${d.row + 1}:${c}`)); };
  /* HTML for the map: the drawing, a flicker canvas on top, and tap targets for the rooms you can go to next */
  function mapHTML(d) {
    const rows = d.rows, h = heightOf(rows), next = nextSet(d);
    const key = `dun|${d.place}|${d.theme}|${JSON.stringify(rows.map((r) => r.map((n) => n.type[0] + n.links.join(""))))}|${d.row}|${d.col}|${(d.path || []).join(";")}|${d.done ? 1 : 0}|${d.room ? 1 : 0}`;
    let torches = [];
    const url = ART.style() === "pixel" ? pixelURL(key, h, (g, H) => { torches = drawMap(g, H, W, h, d, next); })
      : ART.url(W, h, (g, H, w, hh) => { torches = drawMap(g, H, w, hh, d, next); }, { key });
    if (!torches.length) torches = torchSpots(d);
    const nodes = [...next].map((k) => { const [r, c] = k.split(":").map(Number), [x, y] = xy(rows, r, c), n = rows[r][c];
      return `<button class="dnode" data-act="droom" data-c="${c}" style="left:${(x / W * 100).toFixed(2)}%;top:${(y / h * 100).toFixed(2)}%" aria-label="Go to: ${DUNGEONS.LABEL[n.type]}"></button>`; }).join("");
    const here = d.row >= 0 && !d.done ? xy(rows, d.row, d.col) : null;
    return `<div class="dmap" style="--dar:${(W / h).toFixed(4)}" data-w="${W}" data-h="${h}" data-torch="${torches.map((p) => p.map(Math.round).join(",")).join(";")}" data-here="${here ? here.map(Math.round).join(",") : ""}" data-theme="${d.theme}">
      <img src="${url}" width="${W}" height="${h}" alt="Map of ${String(d.place).replace(/"/g, "")}" ${ART.style() === "pixel" ? 'style="image-rendering:pixelated"' : ""}>
      <canvas class="dflick" aria-hidden="true"></canvas>${nodes}</div>`;
  }
  /* pixel look for the map: draw it at half size and let the browser blow it up with hard edges. The shared
     palette filter would turn the grey stone green here, so the dungeon keeps its own colours. */
  const pxCache = new Map();
  function pixelURL(key, h, draw) {
    if (pxCache.has(key)) return pxCache.get(key);
    const k = 0.5, c = document.createElement("canvas"); c.width = Math.round(W * k); c.height = Math.round(h * k);
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.scale(k, k); draw(g, ART.H);
    const u = c.toDataURL("image/png"); if (pxCache.size > 40) pxCache.delete(pxCache.keys().next().value); pxCache.set(key, u); return u;
  }
  function torchSpots(d) {   // the same spots drawMap uses, when the drawing came from the cache
    const rows = d.rows, path = d.path || [], out = [];
    for (let i = 0; i + 1 < path.length; i++) { const [a, b] = path[i], [c2, e] = path[i + 1]; const [x1, y1] = xy(rows, a, b), [x2, y2] = xy(rows, c2, e); out.push([(x1 + x2) / 2 + 7, (y1 + y2) / 2]); }
    if (path.length && d.row >= 0) { const [a, b] = path[path.length - 1]; if (a === d.row - 1) { const [x1, y1] = xy(rows, a, b), [x2, y2] = xy(rows, d.row, d.col); out.push([(x1 + x2) / 2 + 7, (y1 + y2) / 2]); } }
    return out;
  }

  /* torch flicker: a small overlay redrawn ~12 times a second while the map is on screen */
  let raf = 0;
  function start(root, reduce) {
    cancelAnimationFrame(raf);
    const box = root?.querySelector(".dmap"); if (!box) return;
    const cv = box.querySelector(".dflick"), w = +box.dataset.w, h = +box.dataset.h;
    const torches = (box.dataset.torch || "").split(";").filter(Boolean).map((s) => s.split(",").map(Number));
    const here = box.dataset.here ? box.dataset.here.split(",").map(Number) : null;
    const next = [...box.querySelectorAll(".dnode")].map((b) => [parseFloat(b.style.left) / 100 * w, parseFloat(b.style.top) / 100 * h]);
    const pixel = ART.style() === "pixel", k = pixel ? 0.34 : typeof FITCANVAS !== "undefined" ? FITCANVAS.ratio(cv, w) : Math.min(2, devicePixelRatio || 1);   // the map is shown up to 560 wide: size from the box
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    if (pixel) cv.style.imageRendering = "pixelated";
    const g = cv.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0);
    const glow = (x, y, r, a, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    let last = 0;
    const frame = (ts) => {
      if (!cv.isConnected) return;
      if (ts - last > 80 || reduce) {
        last = ts; g.clearRect(0, 0, w, h);
        for (const [x, y] of torches) glow(x, y - 4, 16 + Math.random() * 5, 0.32 + Math.random() * 0.12, "255,170,80");
        if (here) glow(here[0], here[1], 34 + Math.random() * 3, 0.22 + Math.random() * 0.06, "255,214,140");
        const p = 0.5 + 0.5 * Math.sin(ts / 260);
        for (const [x, y] of next) glow(x, y, 30, 0.12 + p * 0.16, "240,208,128");
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
  function after(root, reduce) { start(root, reduce); animateChest(root, reduce); }
  return { TH, TYPES, W, GAP, mapHTML, drawMap, symbol, chamber, lootStrip, chestHTML, after, themeOf, xy, heightOf };
})();
