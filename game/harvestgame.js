/* The harvest mini-game: 3-6 seconds of hands-on picking, touch first (harvest.js holds the rules and scoring).
   flower: swipe across the stem at the glowing mark       root: brush the soil away, then pull up slow and steady
   fungus: scrape along the glowing line                   nirn: ease it up very slowly, keep the strain out of the red
   berry:  tap the ripe red berries, leave the green ones  egg:  drag the egg to the basket without rushing
   clam:   hold to pry it open, let go in the green
   Painted plants (harvest-<kind>.webp, assets.js) when pictures are on; a drawn stand-in otherwise. Ends with a
   SkyUI-style list of what you got. [OURS] */
const HARVESTGAME = (() => {
  const W = 320, H = 340, DPR = 2;
  const BX = 50, BS = 220, K = BS / 256;                       // the plant's 256×256 picture is drawn 220 wide at x 50
  const GROUND = 252;
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const nowS = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const TIME = { flower: 5, root: 7, fungus: 6, nirn: 7, berry: 6, egg: 6, clam: 6 };
  const TIP = {
    flower: "Swipe across the stem at the glowing mark.",
    root: "Rub the loose soil away, then pull the root up: slow and steady.",
    fungus: "Scrape along the glowing line in one stroke.",
    nirn: "Fragile! Drag it up very slowly. Keep the strain out of the red.",
    berry: "Tap the ripe red berries. Leave the green ones.",
    egg: "Drag the egg to the basket. Gently: rushing cracks it.",
    clam: "Hold to pry the shell open. Let go in the green.",
  };
  const VERB = { flower: "Snip", root: "Dig up", fungus: "Scrape", nirn: "Ease out", berry: "Pick", egg: "Lift", clam: "Pry open" };
  // where things sit in the 256×256 plant pictures
  const BERRIES = [[88, 94], [108, 116], [160, 128], [179, 154], [141, 148]];
  const UNRIPE = [[126, 62], [200, 96], [104, 172]];
  const EGG = { x: 132, y: 118, rx: 44, ry: 54 };

  let cur = null, raf = 0;
  const ok = () => typeof document !== "undefined" && !!document.body;
  const isOpen = () => !!cur;

  // ------------------------------------------------------------------ the plant picture (painted, or drawn)
  function art(kind) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 256;
    const g = c.getContext("2d"), pic = typeof ASSETS !== "undefined" && kind !== "clam" ? ASSETS.img("harvest-" + kind) : null;
    if (pic) { g.drawImage(pic, 0, 0, 256, 256); return c; }
    drawn(g, kind);
    return c;
  }
  function drawn(g, kind) {   // simple hand-drawn stand-ins in the same spots as the paintings
    g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#2a1f10"; g.lineWidth = 2;
    const leaf = (x, y, a, l, col) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * 0.5, -l * 0.28, l, 0); g.quadraticCurveTo(l * 0.5, l * 0.28, 0, 0); g.fill(); g.stroke(); g.restore(); };
    if (kind === "flower") {
      g.strokeStyle = "#4d6a2c"; g.lineWidth = 4; g.beginPath(); g.moveTo(128, 252); g.lineTo(128, 30); g.stroke();
      g.strokeStyle = "#2a1f10"; g.lineWidth = 1.5; leaf(128, 190, -2.6, 70, "#6f8f4a"); leaf(128, 190, -0.5, 70, "#6f8f4a");
      for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? "#8d72c8" : "#a58ad6"; g.beginPath(); g.ellipse(128 + (i % 2 ? 9 : -9), 40 + i * 9, 8, 6, 0, 0, 7); g.fill(); g.stroke(); }
    } else if (kind === "root") {
      g.fillStyle = "#4a3520"; g.beginPath(); g.ellipse(128, 30, 46, 24, 0, 0, 7); g.fill();
      g.fillStyle = "#d9c69c"; g.beginPath(); g.moveTo(104, 40); g.quadraticCurveTo(128, 60, 152, 40); g.lineTo(136, 240); g.quadraticCurveTo(128, 252, 122, 240); g.closePath(); g.fill(); g.stroke();
      g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(128 + (i - 3) * 4, 80 + i * 25); g.quadraticCurveTo(128 + (i % 2 ? 40 : -40), 110 + i * 25, 128 + (i % 2 ? 60 : -60), 150 + i * 20); g.stroke(); }
    } else if (kind === "fungus") {
      g.fillStyle = "#8a8a86"; g.beginPath(); g.ellipse(128, 212, 110, 36, 0, 0, 7); g.fill(); g.stroke();
      for (const [x, y, w] of [[90, 170, 60], [160, 160, 70], [120, 120, 66], [150, 85, 52]]) { g.fillStyle = "#c9773a"; g.beginPath(); g.ellipse(x, y, w, w * 0.32, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); }
    } else if (kind === "nirn") {
      const gl = g.createRadialGradient(128, 110, 4, 128, 110, 100); gl.addColorStop(0, "rgba(200,235,255,.75)"); gl.addColorStop(1, "rgba(200,235,255,0)"); g.fillStyle = gl; g.fillRect(0, 0, 256, 256);
      for (let i = -3; i <= 3; i++) leaf(128, 200, -Math.PI / 2 + i * 0.3, 150 - Math.abs(i) * 14, "#9fc2b8");
      g.fillStyle = "#e9e4d6"; g.beginPath(); g.ellipse(128, 214, 22, 20, 0, 0, 7); g.fill(); g.stroke();
    } else if (kind === "berry") {
      g.strokeStyle = "#5a3d22"; g.lineWidth = 5; g.beginPath(); g.moveTo(80, 252); g.quadraticCurveTo(120, 160, 134, 20); g.stroke();
      g.strokeStyle = "#2a1f10"; g.lineWidth = 1.5;
      leaf(128, 60, -2.4, 60, "#b9cbbd"); leaf(130, 70, -0.6, 60, "#b9cbbd"); leaf(116, 160, -2.8, 66, "#b9cbbd"); leaf(122, 170, 0.3, 66, "#b9cbbd");
      for (const [x, y] of BERRIES) { g.fillStyle = "#c22a2a"; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); g.stroke(); }
    } else if (kind === "egg") {
      g.strokeStyle = "#6b5232"; g.lineWidth = 3; for (let i = 0; i < 26; i++) { const a = rnd(0, 6.3); g.beginPath(); g.ellipse(128, 190, 105 - (i % 3) * 8, 44, 0, a, a + 1.6); g.stroke(); }
      g.strokeStyle = "#2a1f10"; g.lineWidth = 1.5; g.fillStyle = "#e7dfc8"; g.beginPath(); g.ellipse(EGG.x, EGG.y, EGG.rx - 4, EGG.ry - 4, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = "#8a7a60"; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(EGG.x + rnd(-28, 28), EGG.y + rnd(-38, 38), rnd(2, 5), 0, 7); g.fill(); }
    }
  }
  /* split a picture with an ellipse: what's outside it (the nest) and what's inside (the egg) */
  function split(src, e) {
    const out = document.createElement("canvas"), inn = document.createElement("canvas"); out.width = inn.width = 256; out.height = inn.height = 256;
    const a = out.getContext("2d"), b = inn.getContext("2d");
    a.drawImage(src, 0, 0); a.globalCompositeOperation = "destination-out"; a.beginPath(); a.ellipse(e.x, e.y, e.rx, e.ry, 0, 0, 7); a.fill();
    b.beginPath(); b.ellipse(e.x, e.y, e.rx, e.ry, 0, 0, 7); b.clip(); b.drawImage(src, 0, 0);
    return [out, inn];
  }

  // ------------------------------------------------------------------ the games
  function setup(g) {
    const fast = g.fast, work = fast ? 0.75 : 1, tol = g.tol;
    g.limit = TIME[g.kind] + (fast ? 1 : 0);
    g.top = 40; g.strain = 0; g.maxStrain = 0;
    if (g.kind === "flower") { g.cutS = rnd(204, 232); g.cutY = g.top + g.cutS * K; g.stemX = BX + 128 * K; }
    if (g.kind === "root") {
      g.phase = "brush"; g.top0 = GROUND - 46; g.rise = 190; g.dist = 120 * work; g.vmax = 240 * tol; g.prog = 0;
      g.clumps = []; const n = Math.round(9 * work);
      for (let i = 0; i < n; i++) g.clumps.push({ x: 160 + rnd(-62, 62), y: GROUND + rnd(-10, 26), r: rnd(11, 17), hp: 60 });
    }
    if (g.kind === "nirn") { g.phase = "pull"; g.top0 = GROUND - 196 * K; g.rise = 70; g.dist = 150 * work; g.vmax = 150 * tol; g.prog = 0; g.side = 34 * tol; }
    if (g.kind === "fungus") {
      const p0 = [36, 178], p1 = [128, 148], p2 = [224, 176];
      g.path = []; for (let i = 0; i <= 24; i++) { const t = i / 24, u = 1 - t; g.path.push([BX + (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]) * K, g.top + (u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]) * K]); }
      g.seen = new Array(25).fill(0); g.on = 0; g.all = 0;
    }
    if (g.kind === "berry") {
      g.ripe = BERRIES.map(([x, y]) => ({ x: BX + x * K, y: g.top + y * K, sx: x, sy: y, got: false }));
      g.green = UNRIPE.map(([x, y]) => ({ x: BX + x * K, y: g.top + y * K, shake: 0 }));
      g.miss = 0; g.hitR = 20 * tol;
    }
    if (g.kind === "egg") {
      g.top = 70; [g.nest, g.eggPic] = split(g.art, EGG);
      g.home = [BX + EGG.x * K, g.top + EGG.y * K]; g.egg = [...g.home]; g.basket = [70, 70]; g.vmax = 330 * tol;
    }
    if (g.kind === "clam") { g.v = 0; g.lo = 0.6; g.hi = Math.min(0.94, 0.6 + 0.2 * tol); g.tries = 0; g.fill = fast ? 1.7 : 1.4; }
  }
  /* pointer input, in canvas units */
  function down(g, x, y) {
    g.held = true; g.px = x; g.py = y; g.pt = nowS();
    if (g.kind === "flower") g.stroke = { x0: x, y0: y, lx: x, ly: y };
    if ((g.kind === "root" && g.phase === "pull") || g.kind === "nirn") { g.grab = { y0: y + g.prog * g.dist, x0: x }; g.v = 0; }
    if (g.kind === "fungus") { g.on = 0; g.all = 0; g.seen.fill(0); }
    if (g.kind === "berry") tapBerry(g, x, y);
    if (g.kind === "egg") { const d = Math.hypot(x - g.egg[0], y - g.egg[1]); if (d <= 46 * g.tol) { g.drag = [g.egg[0] - x, g.egg[1] - y]; g.v = 0; } }
    if (g.kind === "clam") g.prying = true;
  }
  function move(g, x, y) {
    if (!g.held) return;
    const t = nowS(), dt = Math.max(0.008, t - g.pt), dx = x - g.px, dy = y - g.py, dist = Math.hypot(dx, dy);
    if (g.kind === "flower" && g.stroke) {
      const s = g.stroke, sx = g.stemX;
      if ((s.lx - sx) * (x - sx) <= 0 && s.lx !== x && Math.abs(s.x0 - sx) >= 14) {   // crossed the stem in this stroke
        const yc = s.ly + (y - s.ly) * (sx - s.lx) / (x - s.lx);
        if (yc > g.top + 40 * K && yc < GROUND + 10) { const dyc = Math.abs(yc - g.cutY); g.cutAt = yc; burst(g, sx, yc, "#a58ad6", 14); finish(g, HARVEST.SCORE.snip(dyc, g.tol), dyc <= 22 * g.tol ? "" : "You crushed the stem a bit."); }
      }
      s.lx = x; s.ly = y;
    }
    if (g.kind === "root" && g.phase === "brush") {
      let left = 0;
      for (const c of g.clumps) { if (c.hp <= 0) continue; if (Math.hypot(x - c.x, y - c.y) <= c.r + 16) { c.hp -= dist; if (c.hp <= 0) burst(g, c.x, c.y, "#5a3f22", 7); } if (c.hp > 0) left++; }
      if (left === 0) { g.phase = "pull"; g.tip = "Now pull it up: slow and steady."; g.grab = { y0: y, x0: x }; g.v = 0; }
    } else if ((g.kind === "root" || g.kind === "nirn") && g.grab) {
      const p = clamp((g.grab.y0 - y) / g.dist, 0, 1), dp = Math.max(0, p - g.prog) * g.dist;
      g.v = 0.65 * (g.v || 0) + 0.35 * (dp / dt);
      if (p > g.prog) g.prog = p;
      let strain = Math.max(0, (g.v - g.vmax) / g.vmax) * dt * (g.kind === "nirn" ? 7 : 5.5);
      if (g.kind === "nirn" && Math.abs(x - g.grab.x0) > g.side) strain += dt * 1.6;
      g.strain = clamp(g.strain + strain, 0, 1); g.maxStrain = Math.max(g.maxStrain, g.strain);
      if (Math.random() < 0.25) burst(g, 160 + rnd(-30, 30), GROUND, g.kind === "nirn" ? "#cfeaff" : "#4a3520", 1);
      if (g.strain >= 1) finish(g, "fail", g.kind === "nirn" ? "Too fast: it bruised. You save one." : "Snap! The root broke. You save a piece.");
      else if (g.prog >= 1) finish(g, HARVEST.SCORE.pull(false, g.maxStrain, true));
    }
    if (g.kind === "fungus") {
      let best = 1e9, bi = 0; g.path.forEach(([px, py], i) => { const d = Math.hypot(px - x, py - y); if (d < best) { best = d; bi = i; } });
      g.all++; if (best <= 18 * g.tol) { g.on++; if (!g.seen[bi]) { g.seen[bi] = 1; burst(g, x, y, "#d0864a", 3); } }
    }
    if (g.kind === "egg" && g.drag) {
      g.egg = [x + g.drag[0], y + g.drag[1]];
      g.v = 0.65 * (g.v || 0) + 0.35 * (dist / dt);
      g.strain = clamp(g.strain + Math.max(0, (g.v - g.vmax) / g.vmax) * dt * 5, 0, 1); g.maxStrain = Math.max(g.maxStrain, g.strain);
      if (g.strain >= 1) { burst(g, g.egg[0], g.egg[1], "#efe6cc", 16); finish(g, "fail", "Crack! You were too quick. You save what you can."); }
      else if (Math.hypot(g.egg[0] - g.basket[0], g.egg[1] - g.basket[1]) <= 34) { g.drag = null; g.egg = [...g.basket]; finish(g, HARVEST.SCORE.pull(false, g.maxStrain, true)); }
    }
    g.px = x; g.py = y; g.pt = t;
  }
  function up(g) {
    g.held = false;
    if (g.kind === "flower") g.stroke = null;
    if (g.kind === "fungus" && g.all >= 6) {
      const cov = g.seen.reduce((a, v) => a + v, 0) / g.seen.length, acc = g.on / g.all;
      if (cov >= 0.3) finish(g, HARVEST.SCORE.scrape(cov, acc), cov < 0.55 ? "You only got part of it." : "");
    }
    if (g.kind === "egg" && g.drag) { g.drag = null; g.back = true; g.strain = clamp(g.strain + 0.25, 0, 1); g.maxStrain = Math.max(g.maxStrain, g.strain); }
    if (g.kind === "clam" && g.prying) {
      g.prying = false;
      const r = HARVEST.SCORE.pry(g.v, g.lo, g.hi);
      if (r !== "fail") { burst(g, 160, 190, "#f3efe2", 12); finish(g, r); }
      else clamMiss(g);
    }
    if (g.kind === "root" || g.kind === "nirn") g.v = 0;
  }
  function clamMiss(g) {
    g.tries++; g.v = 0;
    if (g.tries >= 2) finish(g, "fail", "It clamped shut. You pry out a small one.");
    else g.tip = "It snapped shut. Once more!";
  }
  function tapBerry(g, x, y) {
    const b = g.ripe.find((r) => !r.got && Math.hypot(r.x - x, r.y - y) <= g.hitR);
    if (b) {
      b.got = true; burst(g, b.x, b.y, "#d2453a", 10);
      const c = g.art.getContext("2d"); c.save(); c.globalCompositeOperation = "destination-out"; c.beginPath(); c.arc(b.sx, b.sy, 14, 0, 7); c.fill(); c.restore();
      const got = g.ripe.filter((r) => r.got).length;
      if (got >= g.ripe.length) finish(g, HARVEST.SCORE.berries(got, g.ripe.length, g.miss));
      return;
    }
    const u = g.green.find((r) => Math.hypot(r.x - x, r.y - y) <= g.hitR);
    if (u) { g.miss++; u.shake = 0.4; g.tip = "Not that one: it isn't ripe."; if (g.miss >= 2) finish(g, HARVEST.SCORE.berries(g.ripe.filter((r) => r.got).length, g.ripe.length, g.miss), "Too many green ones."); }
  }
  function timeUp(g) {
    if (g.kind === "berry") return finish(g, HARVEST.SCORE.berries(g.ripe.filter((r) => r.got).length, g.ripe.length, g.miss), "Time's up.");
    if (g.kind === "fungus" && g.all >= 6) { const cov = g.seen.reduce((a, v) => a + v, 0) / g.seen.length; return finish(g, HARVEST.SCORE.scrape(cov, g.on / g.all), "Time's up."); }
    finish(g, "fail", "Too slow: you grab what you can.");
  }

  // ------------------------------------------------------------------ particles and drawing
  function burst(g, x, y, col, n) {
    if (reduced()) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) g.parts.push({ x, y, vx: rnd(-90, 90), vy: rnd(-160, -30), life: rnd(0.5, 1.1), r: rnd(1.6, 3.6), col });
  }
  function draw(g, dt) {
    const c = g.ctx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1d2420"); bg.addColorStop(1, "#14110c"); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const t = nowS() - g.t0, pulse = reduced() ? 0.6 : 0.5 + 0.5 * Math.sin(t * 6);
    const k = g.kind;
    if (k === "root" || k === "nirn") {
      const top = g.top0 - g.prog * g.rise;
      c.drawImage(g.art, BX, top, BS, BS);
      const earth = c.createLinearGradient(0, GROUND, 0, H); earth.addColorStop(0, "#3b2a18"); earth.addColorStop(1, "#1e150c");
      c.fillStyle = earth; c.fillRect(0, GROUND, W, H - GROUND); c.fillStyle = k === "nirn" ? "rgba(80,110,130,.35)" : "rgba(0,0,0,.0)"; c.fillRect(0, GROUND, W, 6);
      if (k === "root") for (const cl of g.clumps) if (cl.hp > 0) { c.globalAlpha = clamp(cl.hp / 60, 0.25, 1); c.fillStyle = "#56402a"; c.beginPath(); c.arc(cl.x, cl.y, cl.r, 0, 7); c.fill(); c.globalAlpha = 1; }
      if (g.phase === "pull" && !g.over) { c.strokeStyle = `rgba(220,235,200,${0.35 + 0.4 * pulse})`; c.lineWidth = 2; c.setLineDash([5, 6]); c.beginPath(); c.moveTo(160, GROUND - 20); c.lineTo(160, GROUND - 20 - g.dist * (1 - g.prog)); c.stroke(); c.setLineDash([]); arrow(c, 160, GROUND - 26 - g.dist * (1 - g.prog), pulse); }
      meter(c, g.strain, g.phase === "pull");
    } else if (k === "egg") {
      basket(c, g.basket[0], g.basket[1]);
      c.drawImage(g.nest, BX, g.top, BS, BS);
      if (g.back && !g.drag) { g.egg[0] += (g.home[0] - g.egg[0]) * Math.min(1, dt * 8); g.egg[1] += (g.home[1] - g.egg[1]) * Math.min(1, dt * 8); if (Math.hypot(g.egg[0] - g.home[0], g.egg[1] - g.home[1]) < 1) g.back = false; }
      c.drawImage(g.eggPic, g.egg[0] - g.home[0] + BX, g.egg[1] - g.home[1] + g.top, BS, BS);
      if (!g.drag && !g.over) { c.strokeStyle = `rgba(240,230,190,${0.3 + 0.5 * pulse})`; c.lineWidth = 2; c.beginPath(); c.ellipse(g.egg[0], g.egg[1], EGG.rx * K + 4, EGG.ry * K + 4, 0, 0, 7); c.stroke(); }
      meter(c, g.strain, true);
    } else if (k === "clam") {
      clam(c, 160, 200, g.v);
      const x0 = 40, w = 240, y = 300; c.fillStyle = "rgba(255,255,255,.12)"; c.fillRect(x0, y, w, 12);
      c.fillStyle = "rgba(120,200,120,.55)"; c.fillRect(x0 + w * g.lo, y, w * (g.hi - g.lo), 12);
      c.fillStyle = "#e9dfc0"; c.fillRect(x0 + w * clamp(g.v, 0, 1) - 2, y - 4, 4, 20);
    } else {
      if (g.cutAt != null && k === "flower") {   // the snipped top lifts away
        const lift = Math.min(60, (nowS() - g.endT) * 120);
        c.save(); c.beginPath(); c.rect(0, g.cutAt, W, H); c.clip(); c.drawImage(g.art, BX, g.top, BS, BS); c.restore();
        c.save(); c.globalAlpha = clamp(1 - lift / 70, 0, 1); c.beginPath(); c.rect(0, 0, W, g.cutAt); c.clip(); c.drawImage(g.art, BX, g.top - lift, BS, BS); c.restore();
      } else c.drawImage(g.art, BX, g.top, BS, BS);
      if (k === "flower" && !g.over) {
        c.strokeStyle = `rgba(255,236,160,${0.45 + 0.5 * pulse})`; c.lineWidth = 3; c.beginPath(); c.moveTo(g.stemX - 24, g.cutY); c.lineTo(g.stemX + 24, g.cutY); c.stroke();
        c.fillStyle = "rgba(255,236,160,.18)"; c.fillRect(g.stemX - 40, g.cutY - 22 * g.tol, 80, 44 * g.tol);
      }
      if (k === "fungus" && !g.over) {
        c.lineWidth = 3; g.path.forEach(([x, y], i) => { if (i) { c.strokeStyle = g.seen[i] ? "rgba(255,200,120,.95)" : `rgba(255,220,160,${0.3 + 0.35 * pulse})`; c.beginPath(); c.moveTo(...g.path[i - 1]); c.lineTo(x, y); c.stroke(); } });
      }
      if (k === "berry") {
        for (const b of g.ripe) if (!b.got && !g.over) { c.strokeStyle = `rgba(255,210,190,${0.35 + 0.45 * pulse})`; c.lineWidth = 2; c.beginPath(); c.arc(b.x, b.y, 12, 0, 7); c.stroke(); }
        for (const u of g.green) { const sx = u.shake > 0 ? Math.sin(u.shake * 60) * 3 : 0; u.shake = Math.max(0, u.shake - dt); c.fillStyle = "#a9c47e"; c.strokeStyle = "#3d4a22"; c.lineWidth = 1.2; c.beginPath(); c.arc(u.x + sx, u.y, 8.5, 0, 7); c.fill(); c.stroke(); c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.arc(u.x + sx - 2.5, u.y - 2.5, 2.4, 0, 7); c.fill(); }
      }
    }
    for (const p of g.parts) { p.vy += 320 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; c.globalAlpha = clamp(p.life, 0, 1); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); }
    c.globalAlpha = 1; g.parts = g.parts.filter((p) => p.life > 0);
  }
  function arrow(c, x, y, pulse) { c.fillStyle = `rgba(220,235,200,${0.5 + 0.4 * pulse})`; c.beginPath(); c.moveTo(x, y - 10); c.lineTo(x - 8, y + 2); c.lineTo(x + 8, y + 2); c.closePath(); c.fill(); }
  function meter(c, v, on) {
    if (!on) return;
    const x = 298, y = 60, h = 170;
    c.fillStyle = "rgba(255,255,255,.1)"; c.fillRect(x, y, 10, h); c.fillStyle = "rgba(200,60,40,.45)"; c.fillRect(x, y, 10, h * 0.3);
    c.fillStyle = v > 0.7 ? "#e0573f" : v > 0.45 ? "#e0b04a" : "#8fc46a"; c.fillRect(x, y + h * (1 - v), 10, h * v);
    c.strokeStyle = "rgba(0,0,0,.6)"; c.strokeRect(x, y, 10, h);
  }
  function basket(c, x, y) {
    c.fillStyle = "#6a4a26"; c.strokeStyle = "#2a1a0a"; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y + 8, 40, 22, 0, 0, Math.PI); c.lineTo(x - 40, y + 8); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = "#8a6838"; for (let i = -30; i <= 30; i += 10) { c.beginPath(); c.moveTo(x + i, y + 10); c.lineTo(x + i * 0.8, y + 26); c.stroke(); }
    c.strokeStyle = "rgba(240,230,190,.5)"; c.setLineDash([4, 4]); c.beginPath(); c.ellipse(x, y + 4, 40, 14, 0, 0, 7); c.stroke(); c.setLineDash([]);
  }
  function clam(c, x, y, v) {
    const open = clamp(v, 0, 1) * 0.6;
    c.strokeStyle = "#2a3a3c"; c.lineWidth = 2;
    c.fillStyle = "#6f8f93"; c.beginPath(); c.ellipse(x, y, 70, 34, 0, 0, Math.PI); c.closePath(); c.fill(); c.stroke();
    if (v > 0.15) { c.fillStyle = "#f3efe2"; c.beginPath(); c.arc(x, y + 4, 9, 0, 7); c.fill(); }
    c.save(); c.translate(x - 66, y); c.rotate(-open); c.fillStyle = "#8fc3c9"; c.beginPath(); c.ellipse(66, 0, 70, 34, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(66, 0); c.lineTo(66 + i * 18, -30 + Math.abs(i) * 4); c.stroke(); }
    c.restore();
  }

  // ------------------------------------------------------------------ open, run, finish
  function open(o) {
    close();
    const el = document.createElement("div");
    el.id = "hgame"; el.className = "hg-wrap"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Harvest");
    el.innerHTML = `<div class="hg-box"><div class="hg-head"><b class="hg-title">${esc(VERB[o.kind] || "Gather")} the ${esc(o.name)}</b><button class="hg-x" aria-label="Stop">✕</button></div>
      <p class="hg-tip">${esc(TIP[o.kind] || "")}</p><div class="hg-stage"><canvas width="${W * DPR}" height="${H * DPR}"></canvas><div class="hg-time"><i></i></div></div><div class="hg-res"></div></div>`;
    document.body.appendChild(el);
    const cv = el.querySelector("canvas");
    const g = cur = { ...o, el, cv, ctx: cv.getContext("2d"), parts: [], t0: nowS(), over: false, tol: o.tol || 1, fast: !!o.fast };
    g.art = art(o.kind);
    setup(g);
    const at = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    cv.addEventListener("pointerdown", (e) => { if (g.over) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } down(g, ...at(e)); });
    cv.addEventListener("pointermove", (e) => { if (!g.over) move(g, ...at(e)); });
    cv.addEventListener("pointerup", () => { if (!g.over) up(g); });
    cv.addEventListener("pointercancel", () => { if (!g.over) up(g); });
    el.querySelector(".hg-x").addEventListener("click", () => { if (!g.over) close(); });
    g.key = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (!g.over) close(); else done(); } if (e.key === "Enter" && g.over && g.shown) { e.preventDefault(); done(); } };
    document.addEventListener("keydown", g.key, true);
    let last = nowS();
    const loop = () => {
      if (cur !== g) return;
      const t = nowS(), dt = Math.min(0.05, t - last); last = t;
      if (!g.over) {
        if (g.kind === "clam" && g.prying) { g.v += dt / g.fill; if (g.v >= 1) { g.prying = false; g.held = false; clamMiss(g); } }
        if (!g.held && (g.kind === "root" || g.kind === "nirn" || g.kind === "egg")) { g.strain = Math.max(0, g.strain - dt * 0.5); }
        else if (g.held && g.strain > 0) g.strain = Math.max(0, g.strain - dt * 0.18);
        const left = 1 - (t - g.t0) / g.limit;
        const bar = el.querySelector(".hg-time i"); if (bar) bar.style.width = `${Math.max(0, left) * 100}%`;
        if (left <= 0) timeUp(g);
        const tipEl = el.querySelector(".hg-tip"); if (g.tip && tipEl && tipEl.textContent !== g.tip) tipEl.textContent = g.tip;
      }
      draw(g, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return g;
  }
  function finish(g, grade, why = "") {
    if (g.over) return;
    g.over = true; g.grade = grade; g.why = why; g.endT = nowS(); g.held = false;
    burst(g, 160, 170, grade === "perfect" ? "#ffe08a" : grade === "good" ? "#b9e08a" : "#a89f8a", grade === "perfect" ? 26 : 12);
    let r = null; try { r = g.onDone ? g.onDone(grade) : null; } catch (e) { console.error(e); r = { err: "Couldn't gather that. Please try again." }; }
    setTimeout(() => { if (cur === g) results(g, r); }, reduced() ? 150 : 650);
  }
  const GRADE = { perfect: ["Perfect harvest", "hg-perfect"], good: ["Good harvest", "hg-good"], fail: ["Rough harvest", "hg-fail"] };
  function results(g, r) {
    const box = g.el.querySelector(".hg-res"); if (!box) return;
    const [label, cls] = GRADE[g.grade] || GRADE.fail, icon = (id) => (typeof ICONART !== "undefined" ? ICONART.item(id, 26) : "");
    let rows = "";
    if (r && r.ok) {
      rows += `<div class="hg-row">${icon(r.item)}<span class="hg-nm">${esc(D.ITEMS[r.item]?.name || r.item)}</span><span class="hg-n">×${esc(r.n)}</span></div>`;
      if (r.thumb) rows += `<div class="hg-row hg-sub"><span class="hg-nm">Green Thumb</span><span class="hg-n">doubled</span></div>`;
      if (r.rare) rows += `<div class="hg-row hg-rare hg-${r.rare.k}">${icon(r.item)}<span class="hg-nm">${r.rare.k === "l" ? "✦" : "★"} ${esc(r.rare.word)} ${esc(D.ITEMS[r.item]?.name || "")}</span><span class="hg-n">+${Math.round((r.rare.mult - 1) * 100)}% potion</span></div>`;
    } else rows = `<div class="hg-row hg-sub"><span class="hg-nm">${esc((r && r.err) || "Nothing gathered.")}</span></div>`;
    let note = "";
    if (r && r.after && !r.after.single) note = r.after.quick && !(r.before && r.before.quick) ? `Quick Gather unlocked for ${esc(D.ITEMS[r.item]?.name || "")}.` : r.after.quick ? "You can Quick Gather this one now." : `Hand-picked ${r.after.done} of ${r.after.need}: then Quick Gather opens.`;
    box.innerHTML = `<div class="hg-result"><div class="hg-grade ${cls}">${esc(label)}</div>${g.why ? `<p class="hg-why">${esc(g.why)}</p>` : ""}<div class="hg-list"><div class="hg-cap">Harvest</div>${rows}</div>${note ? `<p class="hg-note">${note}</p>` : ""}<button class="btn pri hg-done">Done</button></div>`;
    g.el.classList.add("hg-over"); g.shown = true;
    const b = box.querySelector(".hg-done"); b.addEventListener("click", done); try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function done() { close(); try { window.__ui?.refresh?.(); } catch (e) { /* ignore */ } }
  function close() {
    if (!cur) return;
    const g = cur; cur = null; cancelAnimationFrame(raf);
    document.removeEventListener("keydown", g.key, true);
    g.el.remove();
    if (!g.over && g.onCancel) { try { g.onCancel(); } catch (e) { /* ignore */ } }
  }

  /* the prompt over the map when a ripe patch is in reach, also while walking or riding */
  function nearHTML(s) {
    const n = HARVEST.nearPrompt(s); if (!n) return "";
    return `<div class="gnear">${typeof ICONART !== "undefined" ? ICONART.item(n.ing, 28) : ""}<span class="gn-t"><b>${esc(n.name)}</b><small>${n.riding ? "in reach as you pass" : "in reach"} · ${esc(HARVEST.howTo(n.ing))}</small></span>${n.quick ? `<button class="btn sm" data-act="gquick" data-id="${esc(n.id)}">Quick</button>` : ""}<button class="btn sm pri" data-act="gpick" data-id="${esc(n.id)}">Gather</button></div>`;
  }

  return { ok, open, close, isOpen, nearHTML, TIME, TIP, get cur() { return cur; }, _finish: (grade) => cur && finish(cur, grade) };
})();
