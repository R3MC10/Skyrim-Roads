/* Raid, Arena and clan art: a dragon circling a raided town on the map, the raid box's dragon health and top
   fighters, the Windhelm Arena with a cheering crowd, big clan banners and a map of the holds by ruling clan.
   Drawn with the shared ART toolkit, so it follows  Settings → Art style (hand-drawn / pixel). Everything static is
   cached; only the dragon on the map and the Arena crowd animate, and only while they're on screen. [OURS] */
const RAIDART = (() => {
  const LX = (x) => (typeof I18N_SWEEP !== "undefined" ? I18N_SWEEP.c(x) : x);   // words drawn on canvas, in the player's language
  const P = ART.PAL, H = ART.H;
  const reduce = () => (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const cache = new Map();
  const memo = (k, f) => { const key = k + "|" + ART.style(); if (!cache.has(key)) { if (cache.size > 120) cache.delete(cache.keys().next().value); cache.set(key, f()); } return cache.get(key); };
  const hash = (s) => { let a = 7; for (const ch of String(s)) a = (a * 31 + ch.charCodeAt(0)) | 0; return Math.abs(a); };

  // ---------------------------------------------------------------- the dragon (seen from above, wings spread)
  function drawDragon(g, w, h, flap = 0, dead = false) {
    const cx = w / 2, cy = h / 2, body = dead ? "#5c5048" : "#5a4038", wing = dead ? "#6e625a" : "#9a5a3a";
    const span = w * (0.48 - flap * 0.08);
    // wings
    for (const sgn of [-1, 1]) {
      H.poly(g, [[cx, cy - h * 0.06], [cx + sgn * span, cy - h * 0.22], [cx + sgn * span * 0.86, cy + h * 0.02], [cx + sgn * span * 0.62, cy - h * 0.02], [cx + sgn * span * 0.5, cy + h * 0.12], [cx + sgn * span * 0.28, cy + h * 0.04], [cx, cy + h * 0.08]], wing, P.ink, 1.2);
      H.inkPath(g, [[cx, cy - h * 0.04], [cx + sgn * span * 0.86, cy + h * 0.02]], false, 0.8, "rgba(40,28,20,.6)");
      H.inkPath(g, [[cx, cy - h * 0.02], [cx + sgn * span * 0.5, cy + h * 0.12]], false, 0.8, "rgba(40,28,20,.6)");
    }
    // tail
    H.poly(g, [[cx - w * 0.05, cy + h * 0.1], [cx + w * 0.05, cy + h * 0.1], [cx + w * 0.02, cy + h * 0.42], [cx, cy + h * 0.48], [cx - w * 0.02, cy + h * 0.42]], body, P.ink, 1.1);
    // body and neck/head
    g.fillStyle = body; g.strokeStyle = P.ink; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(cx, cy + h * 0.02, w * 0.075, h * 0.16, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    H.poly(g, [[cx - w * 0.035, cy - h * 0.12], [cx + w * 0.035, cy - h * 0.12], [cx + w * 0.045, cy - h * 0.34], [cx, cy - h * 0.44], [cx - w * 0.045, cy - h * 0.34]], body, P.ink, 1.1);
    if (!dead) { g.fillStyle = "#ffb347"; g.fillRect(cx - w * 0.02, cy - h * 0.37, 2, 2); g.fillRect(cx + w * 0.012, cy - h * 0.37, 2, 2); }
    // spine ridge
    g.strokeStyle = "rgba(200,170,120,.55)"; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy - h * 0.3); g.lineTo(cx, cy + h * 0.38); g.stroke();
  }
  /* three wing poses, cached as sprites (pixel-filtered in pixel style) */
  const dragonSprite = (frame, dead) => memo(`dragon|${frame}|${dead ? 1 : 0}`, () => ART.canvas(64, 64, (g, _H, w, h) => drawDragon(g, w, h, frame / 2, dead), { block: 2 }));
  const smokeSprite = () => memo("smoke", () => { const c = document.createElement("canvas"); c.width = c.height = 48; const g = c.getContext("2d"); const gr = g.createRadialGradient(24, 24, 2, 24, 24, 24); gr.addColorStop(0, "rgba(60,54,50,.55)"); gr.addColorStop(1, "rgba(60,54,50,0)"); g.fillStyle = gr; g.fillRect(0, 0, 48, 48); return c; });
  const fireSprite = () => memo("fire", () => { const c = document.createElement("canvas"); c.width = c.height = 48; const g = c.getContext("2d"); const gr = g.createRadialGradient(24, 26, 1, 24, 26, 22); gr.addColorStop(0, "rgba(255,220,120,.95)"); gr.addColorStop(0.45, "rgba(232,120,40,.7)"); gr.addColorStop(1, "rgba(200,60,20,0)"); g.fillStyle = gr; g.fillRect(0, 0, 48, 48); return c; });

  /* on the map: raid = {pos, done, left (0..1 dragon health left), fighters} */
  function mapRaid(g, raid, Pt, s, t, rm) {
    if (!raid || !raid.pos) return;
    const [x, y] = Pt(raid.pos), tt = rm ? 0 : t;
    if (!raid.done) {
      // smoke and fire over the town
      for (let i = 0; i < 5; i++) {
        const ph = ((tt * 0.25 + i / 5) % 1), sx = x + Math.sin(i * 2.1 + tt * 0.6) * 6 * s + (i - 2) * 4 * s, sy = y - ph * 34 * s, R = (12 + ph * 22) * s;
        g.globalAlpha = 0.65 * (1 - ph); g.drawImage(smokeSprite(), sx - R / 2, sy - R / 2, R, R);
      }
      const fl = rm ? 0.5 : (Math.sin(tt * 9) + 1) / 2;
      g.globalAlpha = 0.7 + 0.3 * fl; const F = (40 + fl * 8) * s; g.drawImage(fireSprite(), x - F / 2, y - F * 0.62, F, F);
      for (let i = 0; i < 3; i++) { const f2 = (18 + ((tt * 3 + i) % 1) * 8) * s; g.drawImage(fireSprite(), x + (i - 1) * 11 * s - f2 / 2, y - 6 * s - f2 / 2, f2, f2); }
      g.globalAlpha = 1;
      // the pulsing red ring
      const pu = rm ? 0.5 : (Math.sin(tt * 3.2) + 1) / 2;
      g.strokeStyle = `rgba(210,50,30,${0.45 + 0.4 * pu})`; g.lineWidth = (2 + pu * 1.5) * s; g.beginPath(); g.arc(x, y, (30 + pu * 6) * s, 0, Math.PI * 2); g.stroke();
      // fighters: small crossed swords around the ring
      const n = Math.min(8, raid.fighters || 0);
      for (let i = 0; i < n; i++) { const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2, fx = x + Math.cos(a) * 30 * s, fy = y + Math.sin(a) * 30 * s; g.strokeStyle = "#f3e7c4"; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(fx - 4 * s, fy - 4 * s); g.lineTo(fx + 4 * s, fy + 4 * s); g.moveTo(fx + 4 * s, fy - 4 * s); g.lineTo(fx - 4 * s, fy + 4 * s); g.stroke(); }
      // the dragon circling, its shadow on the ground below
      const a = tt * 0.7, R = 54 * s, dx = x + Math.cos(a) * R, dy = y - 18 * s + Math.sin(a) * R * 0.55, size = 72 * s;
      g.fillStyle = "rgba(20,14,8,.28)"; g.beginPath(); g.ellipse(x + Math.cos(a) * R * 0.9, y + Math.sin(a) * R * 0.5 + 6 * s, 16 * s, 6 * s, 0, 0, Math.PI * 2); g.fill();
      const frame = rm ? 0 : Math.floor(tt * 6) % 4, f = frame === 3 ? 1 : frame;
      g.save(); g.translate(dx, dy); g.rotate(a + Math.PI); g.drawImage(dragonSprite(f, false), -size / 2, -size / 2, size, size); g.restore();
      // its health over the town
      if (raid.left != null) { const bw = 50 * s, bh = 5 * s, by = y - 46 * s; g.fillStyle = "rgba(20,14,8,.8)"; g.fillRect(x - bw / 2 - s, by - s, bw + 2 * s, bh + 2 * s); g.fillStyle = "#c4372a"; g.fillRect(x - bw / 2, by, bw * Math.max(0, Math.min(1, raid.left)), bh); }
    } else {
      const size = 34 * s; g.globalAlpha = 0.9; g.drawImage(dragonSprite(0, true), x + 10 * s, y - 6 * s, size, size); g.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- raid box: dragon health + top fighters
  function raidHealth(tl, docs, raid, me, portraitOf) {
    const left = Math.max(0, tl.need - tl.total), frac = tl.need ? left / tl.need : 0;
    const mine = me.raid?.id === raid.id ? Math.round(me.raid.dmg) : 0;
    const rows = [...docs.filter((d) => d.raid === raid.id && d.uid !== me.id).map((d) => ({ id: d.uid, name: d.name, dmg: Math.round(d.dmg || 0) })), ...(mine ? [{ id: me.id, name: me.name, dmg: mine, me: true }] : [])]
      .sort((a, b) => b.dmg - a.dmg).slice(0, 3);
    const medal = [0, 1, 2].map((i) => `<i class="rmed m${i}"></i>`);   // gold, silver, bronze
    return `<div class="raidhp"><div class="raidhp-top"><span> ${typeof WEVENTS !== "undefined" && WEVENTS.kindOf ? WEVENTS.kindOf(raid).name : "Dragon"}</span><span class="num">${left > 0 ? `${left} / ${tl.need}` : "slain"}</span></div>
      <div class="raidhp-bar"><i style="width:${(frac * 100).toFixed(1)}%"></i></div>
      ${rows.length ? `<div class="raidtop">${rows.map((r, i) => `<div class="rt ${r.me ? "me" : ""}">${portraitOf ? portraitOf(r.id, 30) : ""}<span class="rn">${medal[i]} ${r.name.replace(/[<>&"]/g, "")}${r.me ? " (you)" : ""}</span><b class="num">${r.dmg}</b></div>`).join("")}</div>` : ""}</div>`;
  }

  // ---------------------------------------------------------------- the Arena
  /* the static ring: Windhelm stone, blue banners, empty stands (the crowd is drawn over it each frame) */
  function arenaBase(w, h) {
    return memo(`arenaBase|${w}x${h}`, () => ART.canvas(w, h, (g) => {
      H.sky(g, w, h, "snow");
      // back stands: three stone tiers
      for (let i = 0; i < 3; i++) { const y = h * (0.18 + i * 0.13); H.poly(g, [[0, y + h * 0.13], [0, y], [w, y], [w, y + h * 0.13]], ["#7d7a78", "#8f8b88", "#a19c97"][i], P.ink, 1); }
      // banners of Windhelm (blue with the bear)
      for (let i = 0; i < 5; i++) { const x = w * (0.08 + i * 0.21); g.fillStyle = "#7a5232"; g.fillRect(x, h * 0.03, 2, h * 0.17); H.poly(g, [[x + 2, h * 0.04], [x + 18, h * 0.04], [x + 18, h * 0.17], [x + 10, h * 0.14], [x + 2, h * 0.17]], "#2f4f7a", P.ink, 1); H.circle(g, x + 10, h * 0.09, 3, "#d9d4c5", null); }
      // the wall around the ring and the sand floor
      H.poly(g, [[0, h * 0.62], [0, h * 0.57], [w, h * 0.57], [w, h * 0.62]], "#5f5a56", P.ink, 1.2);
      for (let x = 0; x < w; x += 22) H.inkPath(g, [[x, h * 0.57], [x, h * 0.62]], false, 0.8, "rgba(30,24,20,.5)");
      const sand = g.createLinearGradient(0, h * 0.62, 0, h); sand.addColorStop(0, "#c9b38a"); sand.addColorStop(1, "#a88f68"); g.fillStyle = sand; g.fillRect(0, h * 0.62, w, h * 0.38);
      g.strokeStyle = "rgba(90,60,40,.35)"; g.lineWidth = 1.2; g.beginPath(); g.ellipse(w / 2, h * 0.82, w * 0.36, h * 0.12, 0, 0, Math.PI * 2); g.stroke();
      // two weapon racks
      for (const x of [w * 0.06, w * 0.9]) { g.fillStyle = "#6b4a2a"; g.fillRect(x, h * 0.66, 18, 3); g.strokeStyle = "#a9b0b4"; g.lineWidth = 1.5; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + 3 + k * 6, h * 0.66); g.lineTo(x + 3 + k * 6, h * 0.55); g.stroke(); } }
    }));
  }
  const CROWD = ["#6b4a3a", "#3f5a6a", "#7a5a3a", "#5a4a6a", "#4a5a3a", "#8a6a4a", "#5a3a3a"];
  function arenaFrame(cv, t, cheer) {
    const w = cv.width / (cv._dpr || 1), h = cv.height / (cv._dpr || 1), g = cv.getContext("2d");
    g.setTransform(cv._dpr || 1, 0, 0, cv._dpr || 1, 0, 0);
    g.drawImage(arenaBase(w, h), 0, 0, w, h);
    const r = ART.seeded("crowd");
    for (let row = 0; row < 3; row++) {
      const y = h * (0.18 + row * 0.13) + h * 0.09, n = Math.floor(w / 13);
      for (let i = 0; i < n; i++) {
        const x = 6 + i * 13 + (row % 2) * 6 + r() * 3, col = CROWD[Math.floor(r() * CROWD.length)], ph = r() * 6.28;
        const jump = cheer ? Math.max(0, Math.sin(t * 7 + ph)) * 3.5 : Math.sin(t * 1.5 + ph) * 0.6;
        g.fillStyle = col; g.beginPath(); g.ellipse(x, y - jump, 4.2, 5, 0, Math.PI, 0); g.fill();
        g.fillStyle = "#d9b48f"; g.beginPath(); g.arc(x, y - 7 - jump, 2.6, 0, Math.PI * 2); g.fill();
        if (cheer && Math.sin(t * 7 + ph) > 0.6) { g.strokeStyle = "#d9b48f"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 3, y - 5 - jump); g.lineTo(x - 5, y - 12 - jump); g.moveTo(x + 3, y - 5 - jump); g.lineTo(x + 5, y - 12 - jump); g.stroke(); }
      }
    }
  }
  /* animate every arena canvas on the page; stop when it's gone or off screen */
  let running = false;
  function startLoop() {
    if (running) return; running = true;
    let last = 0;
    const step = (ts) => {
      const cvs = [...document.querySelectorAll("canvas[data-ra=arena]")];
      if (!cvs.length) { running = false; return; }
      if (ts - last > 120) { last = ts; for (const cv of cvs) { const rect = cv.getBoundingClientRect(); if (rect.bottom < 0 || rect.top > innerHeight) continue; arenaFrame(cv, ts / 1000, +cv.dataset.cheer > Date.now()); } }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function mount(root = document) {
    for (const cv of root.querySelectorAll("canvas[data-ra=arena]:not([data-on])")) {
      cv.dataset.on = "1"; const dpr = Math.min(2, devicePixelRatio || 1), w = +cv.getAttribute("width"), h = +cv.getAttribute("height");
      cv._dpr = dpr; cv.width = w * dpr; cv.height = h * dpr; cv.style.width = "100%"; cv.style.height = "auto";
      if (ART.style() === "pixel") cv.style.imageRendering = "pixelated";
      arenaFrame(cv, 0, false);
      cv.addEventListener("click", () => { cv.dataset.cheer = String(Date.now() + 2500); if (typeof SOUND !== "undefined") SOUND.fx("coin"); });
    }
    if (!reduce()) startLoop();
  }
  if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
    const mo = new MutationObserver(() => { if (document.querySelector("canvas[data-ra=arena]:not([data-on])")) mount(); });
    const go = () => mo.observe(document.body, { childList: true, subtree: true });
    if (document.body) go(); else addEventListener("DOMContentLoaded", go);
  }
  /* a crowd that cheers for `ms` after a bout (e.g. a result is shown) */
  function cheer(ms = 3000) { for (const cv of document.querySelectorAll("canvas[data-ra=arena]")) cv.dataset.cheer = String(Date.now() + ms); }
  const arenaHTML = () => `<div class="arena-scene"><canvas data-ra="arena" width="340" height="150" aria-label="The Windhelm Arena: tap to make the crowd cheer"></canvas></div>`;

  /* season banner: a long cloth with the season's name */
  const seasonBanner = (name, w = 340, h = 44) => ART.html(w, h, (g) => {
    H.poly(g, [[8, 6], [w - 8, 6], [w - 22, h / 2], [w - 8, h - 6], [8, h - 6], [22, h / 2]], "#6a2a22", P.ink, 1.4);
    g.strokeStyle = P.gold; g.lineWidth = 1.2; g.strokeRect(26, 10, w - 52, h - 20);
    g.fillStyle = "#f3e7c4"; g.font = "700 15px Cinzel, Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(LX(`Season of ${name}`), w / 2, h / 2 + 1);
  }, { key: "season|" + name, cls: "season-banner", alt: `Season of ${name}` });

  /* the top three of the ladder, on a podium */
  function podium(rows, portraitOf, rankOf) {
    if (!rows.length) return "";
    const order = [rows[1], rows[0], rows[2]].filter(Boolean), hgt = { 0: 54, 1: 40, 2: 30 };
    return `<div class="podium">${order.map((r) => { const i = rows.indexOf(r); return `<div class="pod p${i + 1}">${portraitOf ? portraitOf(r.id, i === 0 ? 46 : 38) : ""}<b>${String(r.name).replace(/[<>&"]/g, "")}</b><span class="num">${rankOf ? rankOf(r.rating, 18) : ""}${r.rating}</span><i style="height:${hgt[i]}px">${i + 1}</i></div>`; }).join("")}</div>`;
  }
  /* a challenge: both fighters face each other, the stake between them */
  function versus(a, b, stake, portraitOf) {
    return `<div class="versus">${portraitOf ? portraitOf(a.id, 36) : ""}<span class="vn">${String(a.name).replace(/[<>&"]/g, "")}</span><span class="vs">${stake ? `<small>${stake * 2} gold</small>` : "<small>friendly</small>"}</span><span class="vn">${String(b.name).replace(/[<>&"]/g, "")}</span>${portraitOf ? portraitOf(b.id, 36) : ""}</div>`;
  }
  /* fightart hook: stands full of people above the arena wall */
  function stands(g, w, h, top, bottom) {
    for (let i = 0; i < 3; i++) { const y = top + (bottom - top) * (i / 3); H.poly(g, [[0, y + (bottom - top) / 3], [0, y], [w, y], [w, y + (bottom - top) / 3]], ["#7d7a78", "#8f8b88", "#a19c97"][i], P.ink, 0.8); }
    const r = ART.seeded("stands");
    for (let row = 0; row < 3; row++) { const y = top + (bottom - top) * ((row + 0.8) / 3); for (let x = 5 + (row % 2) * 6; x < w; x += 12) { g.fillStyle = CROWD[Math.floor(r() * CROWD.length)]; g.beginPath(); g.ellipse(x, y, 3.8, 4.4, 0, Math.PI, 0); g.fill(); g.fillStyle = "#d9b48f"; g.beginPath(); g.arc(x, y - 6, 2.3, 0, Math.PI * 2); g.fill(); } }
  }

  // ---------------------------------------------------------------- clans
  const SIGILS = ["wolf", "dragon", "axe", "tree", "sun", "moon", "bear", "crown"];
  function sigil(g, kind, x, y, r, col) {
    g.fillStyle = col; g.strokeStyle = P.ink; g.lineWidth = 1;
    const p = (pts) => H.poly(g, pts.map(([a, b]) => [x + a * r, y + b * r]), col, P.ink, 1);
    if (kind === "sun") { H.circle(g, x, y, r * 0.45, col, P.ink, 1); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; p([[Math.cos(a) * 0.55, Math.sin(a) * 0.55], [Math.cos(a + 0.2) * 0.9, Math.sin(a + 0.2) * 0.9], [Math.cos(a - 0.2) * 0.9, Math.sin(a - 0.2) * 0.9]]); } }
    else if (kind === "moon") { H.circle(g, x, y, r * 0.75, col, P.ink, 1); g.save(); g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(x + r * 0.35, y - r * 0.15, r * 0.6, 0, Math.PI * 2); g.fill(); g.restore(); }
    else if (kind === "axe") { p([[-0.08, -0.9], [0.08, -0.9], [0.08, 0.9], [-0.08, 0.9]]); p([[0.08, -0.7], [0.75, -0.9], [0.6, -0.2], [0.08, -0.3]]); }
    else if (kind === "tree") { p([[0, -0.9], [0.6, -0.1], [0.3, -0.1], [0.75, 0.5], [-0.75, 0.5], [-0.3, -0.1], [-0.6, -0.1]]); p([[-0.1, 0.5], [0.1, 0.5], [0.1, 0.9], [-0.1, 0.9]]); }
    else if (kind === "crown") p([[-0.75, 0.5], [-0.75, -0.3], [-0.4, 0.1], [0, -0.6], [0.4, 0.1], [0.75, -0.3], [0.75, 0.5]]);
    else if (kind === "bear") { H.circle(g, x, y + r * 0.1, r * 0.6, col, P.ink, 1); H.circle(g, x - r * 0.45, y - r * 0.45, r * 0.22, col, P.ink, 1); H.circle(g, x + r * 0.45, y - r * 0.45, r * 0.22, col, P.ink, 1); }
    else if (kind === "dragon") p([[0, -0.9], [0.25, -0.4], [0.9, -0.6], [0.45, 0.05], [0.7, 0.6], [0.15, 0.35], [0, 0.9], [-0.15, 0.35], [-0.7, 0.6], [-0.45, 0.05], [-0.9, -0.6], [-0.25, -0.4]]);
    else /* wolf */ p([[-0.6, 0.8], [-0.7, -0.2], [-0.55, -0.85], [-0.25, -0.35], [0.25, -0.35], [0.55, -0.85], [0.7, -0.2], [0.6, 0.8], [0, 0.45]]);
  }
  const sigilOf = (c) => SIGILS[hash(c.tag || c.name || "") % SIGILS.length];
  /* a tall cloth banner on a pole with the clan's colours, sigil and tag */
  const clanBanner = (c, w = 84, h = 120) => ART.html(w, h, (g) => {
    const a = c.colors?.[0] || "#8c2b22", b = c.colors?.[1] || "#c9a75e";
    g.fillStyle = "#7a5232"; g.fillRect(w * 0.12, 2, 3, h - 4); H.circle(g, w * 0.12 + 1.5, 4, 3, P.gold, P.ink, 1);
    g.fillStyle = "#5a3a22"; g.fillRect(w * 0.12, 8, w * 0.8, 3);
    const L = w * 0.14, R = w * 0.92, T = 11, B = h - 10;
    H.poly(g, [[L, T], [R, T], [R, B], [(L + R) / 2, B - 16], [L, B]], a, P.ink, 1.4);
    H.poly(g, [[L, T + (B - T) * 0.62], [R, T + (B - T) * 0.62], [R, B], [(L + R) / 2, B - 16], [L, B]], b, P.ink, 1.2);
    sigil(g, sigilOf(c), (L + R) / 2, T + (B - T) * 0.33, (R - L) * 0.3, b);
    g.fillStyle = a; g.font = `700 ${Math.round(w * 0.15)}px Cinzel, Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(c.tag || "").slice(0, 4), (L + R) / 2, T + (B - T) * 0.76);
  }, { key: `clanb|${c.tag}|${(c.colors || []).join("")}|${w}x${h}`, cls: "clan-banner", alt: `Banner of ${c.name || c.tag}` });

  // ---------------------------------------------------------------- a map of the nine holds by ruling clan
  const NEUTRAL = "#cdb98f";
  function holdsMap(rulers, w = 340, h = 210) {
    const key = Object.keys(WORLD.holds).map((k) => `${k}:${rulers[k]?.tag || "-"}${(rulers[k]?.colors || []).join("")}`).join(",");
    return ART.html(w, h, (g) => {
      H.parchment(g, w, h, 9);
      const holds = Object.entries(WORLD.holds), CW = 4, cols = Math.ceil(w / CW), rows = Math.ceil(h / CW), owner = new Int8Array(cols * rows).fill(-1);
      const land = (x, y) => { if (typeof Terrain === "undefined") return true; const t = Terrain.typeAtPos([x, y]); return t > 1 && t !== Terrain.T.BEYOND; };
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = (i + 0.5) / cols, y = (j + 0.5) / rows; if (!land(x, y)) continue;
        let best = 0, bd = 9; const hn = WORLD.holdAt && WORLD.holdAt([x, y]);
        if (hn) best = holds.findIndex(([k]) => k === hn); else holds.forEach(([, v], k) => { const d = (v[0][0] - x) ** 2 + (v[0][1] - y) ** 2; if (d < bd) { bd = d; best = k; } });
        owner[j * cols + i] = best;
      }
      const mix = (hex, k) => { const n = parseInt(hex.slice(1), 16), p2 = [233, 220, 192]; return `rgb(${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v * k + p2[i] * (1 - k))).join(",")})`; };
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const o = owner[j * cols + i];
        if (o < 0) { g.fillStyle = "#2c4550"; g.fillRect(i * CW, j * CW, CW, CW); if ((i * 7 + j * 3) % 23 === 0) { g.fillStyle = "rgba(160,200,215,.5)"; g.fillRect(i * CW, j * CW + 2, CW * 2, 1); } continue; }
        const r = rulers[holds[o][0]];
        g.fillStyle = r ? mix(r.colors[0], 0.55) : NEUTRAL; g.fillRect(i * CW, j * CW, CW, CW);
        if (r && (i + j) % 4 === 0) { g.fillStyle = r.colors[0]; g.fillRect(i * CW, j * CW, 1.6, 1.6); }   // hatching: this hold is ruled
      }
      g.fillStyle = P.ink;   // ink borders between holds and along the coast
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const o = owner[j * cols + i]; if ((i + 1 < cols && owner[j * cols + i + 1] !== o) || (j + 1 < rows && owner[(j + 1) * cols + i] !== o)) g.fillRect(i * CW + CW - 1.5, j * CW + CW - 1.5, 2, 2); }
      g.textAlign = "center"; g.textBaseline = "middle";
      for (const [name, v] of holds) {
        const x = v[0][0] * w, y = v[0][1] * h, r = rulers[name];
        if (r) { g.fillStyle = "#7a5232"; g.fillRect(x - 1, y - 22, 2, 18); H.poly(g, [[x + 1, y - 22], [x + 15, y - 22], [x + 15, y - 12], [x + 8, y - 14], [x + 1, y - 12]], r.colors[0], P.ink, 1); g.fillStyle = r.colors[1]; g.fillRect(x + 1, y - 16, 14, 2); }
        g.font = "700 9px Georgia, serif"; g.lineWidth = 3; g.strokeStyle = "rgba(233,220,192,.85)"; g.strokeText(name, x, y + 4); g.fillStyle = P.ink; g.fillText(name, x, y + 4);
        if (r) { g.font = "700 8px Georgia, serif"; g.strokeText(`[${r.tag}]`, x, y + 14); g.fillStyle = "#3b2c1e"; g.fillText(`[${r.tag}]`, x, y + 14); }
      }
    }, { key: "holdsmap|" + key, cls: "holds-map", alt: "Map of the nine holds and who rules them" });
  }

  return { drawDragon, mapRaid, raidHealth, arenaHTML, arenaFrame, mount, cheer, seasonBanner, podium, versus, stands, clanBanner, holdsMap, sigilOf, SIGILS };
})();
