/* Home art: drawn interiors for the five player houses, neighbours' homes and the Hall of the North.
   Same ink-on-parchment toolkit as everything else (art.js), so the pixel-art setting applies too. Each picture is
   drawn once per content (house, garden, rested, items on show, motto, hall tier…) and cached. [OURS] */
const HOMEART = (() => {
  const W = 360, HT = 190;
  const P = () => ART.PAL;
  // a look per house: wall, trim, floor, and what makes it recognisable
  const LOOK = {
    Whiterun: { name: "Breezehome", wall: "#8a6440", wall2: "#6f4f33", floor: "#5a4330", trim: "#3b2c1e", kind: "wood", loft: true },
    Riften: { name: "Honeyside", wall: "#7a5a3c", wall2: "#5f452f", floor: "#4d3a2a", trim: "#3b2c1e", kind: "wood", lake: true },
    Markarth: { name: "Vlindrel Hall", wall: "#b08a63", wall2: "#8f6b4a", floor: "#6f5741", trim: "#c9a24c", kind: "dwemer" },
    Windhelm: { name: "Hjerim", wall: "#4d5560", wall2: "#3b424b", floor: "#2f343a", trim: "#8f97a0", kind: "stone", dark: true },
    Solitude: { name: "Proudspire Manor", wall: "#9a8a76", wall2: "#7e6f5d", floor: "#5b4a3a", trim: "#d6b25e", kind: "grand" },
  };
  const lookOf = (town) => LOOK[town] || LOOK.Whiterun;

  // ---- pieces
  function room(g, H, L, seed) {
    // back wall
    const gw = g.createLinearGradient(0, 0, 0, HT * 0.72); gw.addColorStop(0, L.dark ? "#2b3036" : L.wall2); gw.addColorStop(1, L.wall);
    g.fillStyle = gw; g.fillRect(0, 0, W, HT * 0.72);
    if (L.kind === "wood") { g.strokeStyle = "rgba(59,44,30,.35)"; g.lineWidth = 1; for (let y = 10; y < HT * 0.72; y += 11) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
    if (L.kind === "stone" || L.kind === "grand" || L.kind === "dwemer") {
      const r = H.seeded(seed); g.strokeStyle = "rgba(0,0,0,.22)"; g.lineWidth = 1;
      for (let y = 8, row = 0; y < HT * 0.72; y += 16, row++) for (let x = (row % 2) * 14; x < W; x += 28 + r() * 6) g.strokeRect(x, y, 26, 14);
    }
    if (L.kind === "dwemer") { g.fillStyle = L.trim; for (let x = 20; x < W; x += 70) { g.fillRect(x, 0, 4, HT * 0.72); H.circle(g, x + 2, 26, 7, "#b8913e", P().ink, 1); } }
    // beams across the ceiling
    g.fillStyle = L.trim; g.fillRect(0, 0, W, 9);
    if (L.kind !== "dwemer") for (let x = 14; x < W; x += 64) { g.fillStyle = L.kind === "wood" ? "#4f3826" : "#3d434a"; g.fillRect(x, 0, 10, HT * 0.72); }
    // floor
    const gf = g.createLinearGradient(0, HT * 0.72, 0, HT); gf.addColorStop(0, L.floor); gf.addColorStop(1, "#2a2018"); g.fillStyle = gf; g.fillRect(0, HT * 0.72, W, HT * 0.28);
    g.strokeStyle = "rgba(0,0,0,.25)"; for (let x = -40; x < W + 40; x += 26) { g.beginPath(); g.moveTo(x, HT * 0.72); g.lineTo(x - 30, HT); g.stroke(); }
    if (L.kind === "grand") { g.fillStyle = "#7a2a24"; g.fillRect(W * 0.3, HT * 0.78, W * 0.4, HT * 0.18); g.strokeStyle = L.trim; g.lineWidth = 2; g.strokeRect(W * 0.31, HT * 0.79, W * 0.38, HT * 0.16); }
    else { g.fillStyle = "#8a6a3e"; g.beginPath(); g.ellipse(W * 0.48, HT * 0.86, 60, 12, 0, 0, 7); g.fill(); g.strokeStyle = P().ink; g.lineWidth = 1; g.stroke(); }
  }
  function windowLake(g, H, x, y, w, h, night) {   // Honeyside: the lake through the window
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = night ? "#1c2833" : "#9fc0cc"; g.fillRect(x, y, w, h);
    g.translate(x, 0); H.mountains(g, w, y + h * 0.56, h * 0.35, 9, "#7d8a8a", true); g.translate(-x, 0);
    g.fillStyle = night ? "#2a4250" : "#5f8797"; g.fillRect(x, y + h * 0.55, w, h * 0.45);
    g.restore();
    g.strokeStyle = "#3b2c1e"; g.lineWidth = 3; g.strokeRect(x, y, w, h); g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.stroke();
  }
  function loft(g, H) {   // Breezehome: the upstairs balcony and the stairs
    g.fillStyle = "#4f3826"; g.fillRect(0, 44, W * 0.34, 7); for (let x = 6; x < W * 0.34; x += 12) g.fillRect(x, 30, 3, 14);
    g.fillRect(0, 28, W * 0.34, 3);
    g.strokeStyle = "#3b2c1e"; g.lineWidth = 3; g.beginPath(); g.moveTo(W * 0.34, 51); g.lineTo(W * 0.42, HT * 0.72); g.stroke();
    for (let i = 0; i < 6; i++) { const t = i / 6; g.fillStyle = "#6f4f33"; g.fillRect(W * (0.34 + 0.08 * t) - 2, 51 + (HT * 0.72 - 51) * t, 14, 3); }
  }
  function hearth(g, H, cx, L, lit = true) {
    const base = HT * 0.74;
    if (L.kind === "wood" || L.kind === "grand") {
      H.poly(g, [[cx - 34, base], [cx - 30, 52], [cx + 30, 52], [cx + 34, base]], "#7d6c58", P().ink, 1.4);
      g.fillStyle = "#2a2018"; g.beginPath(); g.moveTo(cx - 20, base); g.lineTo(cx - 20, base - 34); g.quadraticCurveTo(cx, base - 48, cx + 20, base - 34); g.lineTo(cx + 20, base); g.fill();
      g.fillStyle = "#5a4330"; g.fillRect(cx - 38, 50, 76, 6);
    } else {   // a stone fire pit / Dwemer brazier
      H.poly(g, [[cx - 26, base], [cx - 20, base - 10], [cx + 20, base - 10], [cx + 26, base]], L.kind === "dwemer" ? "#b8913e" : "#6f6a64", P().ink, 1.4);
    }
    if (!lit) return;
    const fx = cx, fy = base - 8;
    const glow = g.createRadialGradient(fx, fy - 8, 2, fx, fy - 8, 60); glow.addColorStop(0, "rgba(255,190,90,.55)"); glow.addColorStop(1, "rgba(255,150,60,0)");
    g.fillStyle = glow; g.fillRect(fx - 70, fy - 70, 140, 110);
    H.poly(g, [[fx - 12, fy], [fx - 6, fy - 22], [fx, fy - 12], [fx + 5, fy - 28], [fx + 12, fy]], "#e8923a", null);
    H.poly(g, [[fx - 6, fy], [fx - 2, fy - 13], [fx + 2, fy - 8], [fx + 5, fy - 16], [fx + 7, fy]], "#f6d27a", null);
    g.fillStyle = "#4f3826"; g.fillRect(fx - 14, fy, 28, 4);
    if (L.kind === "wood") { g.strokeStyle = P().ink; g.lineWidth = 1.2; g.beginPath(); g.moveTo(fx, base - 46); g.lineTo(fx, fy - 26); g.stroke(); H.circle(g, fx, fy - 20, 6, "#2a2018", P().ink, 1); }   // cooking pot
  }
  function bed(g, H, x, y, made) {
    g.fillStyle = "#5a4330"; g.fillRect(x, y - 30, 6, 36); g.fillRect(x + 72, y - 18, 6, 24);
    H.poly(g, [[x + 4, y - 14], [x + 76, y - 14], [x + 76, y], [x + 4, y]], "#6f4f33", P().ink, 1.2);
    H.poly(g, [[x + 6, y - 22], [x + 24, y - 22], [x + 24, y - 14], [x + 6, y - 14]], "#e9dcc0", P().ink, 1);   // pillow
    if (made) H.poly(g, [[x + 24, y - 20], [x + 75, y - 20], [x + 75, y - 12], [x + 24, y - 12]], "#7a3a30", P().ink, 1);
    else H.poly(g, [[x + 24, y - 21], [x + 50, y - 24], [x + 75, y - 17], [x + 74, y - 12], [x + 30, y - 13]], "#8a5248", P().ink, 1);
    H.poly(g, [[x + 6, y - 14], [x + 75, y - 14], [x + 75, y - 9], [x + 6, y - 9]], "#c9b48f", null);
    if (made) { g.fillStyle = "#d6b25e"; g.font = "bold 11px Georgia, serif"; g.fillText("z", x + 30, y - 28); g.fillText("z", x + 38, y - 34); }
  }
  function chest(g, H, x, y, n) {
    H.poly(g, [[x, y], [x + 34, y], [x + 34, y - 18], [x, y - 18]], "#6f4f33", P().ink, 1.3);
    g.fillStyle = "#5a4330"; g.beginPath(); g.moveTo(x, y - 18); g.quadraticCurveTo(x + 17, y - 30, x + 34, y - 18); g.fill(); g.strokeStyle = P().ink; g.stroke();
    g.fillStyle = "#a9b0b4"; g.fillRect(x + 6, y - 24, 3, 24); g.fillRect(x + 25, y - 24, 3, 24); H.circle(g, x + 17, y - 13, 3, "#d6b25e", P().ink, 1);
    if (n) { g.fillStyle = "#e9dcc0"; g.font = "bold 10px Georgia, serif"; g.textAlign = "center"; g.fillText(String(Math.min(99, n)), x + 17, y - 2); g.textAlign = "left"; }
  }
  /* garden: a planter under the window. stage 0 = bare soil, 0..1 growing, 1 = ripe */
  function garden(g, H, x, y, w, stage) {
    H.poly(g, [[x, y], [x + w, y], [x + w - 4, y + 12], [x + 4, y + 12]], "#6f4f33", P().ink, 1.2);
    g.fillStyle = "#3b2c1e"; g.fillRect(x + 3, y - 2, w - 6, 4);
    const n = Math.floor(w / 10);
    for (let i = 0; i < n; i++) {
      const px = x + 6 + i * 10, hgt = 3 + stage * 14 * (0.75 + ((i * 37) % 10) / 40);
      if (stage <= 0.02) { g.fillStyle = "#5a4330"; g.fillRect(px - 1, y - 3, 3, 2); continue; }
      g.strokeStyle = "#3d5d36"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(px, y - 1); g.lineTo(px, y - hgt); g.stroke();
      H.poly(g, [[px, y - hgt * 0.6], [px - 4, y - hgt * 0.75], [px, y - hgt * 0.7]], "#557a47", null); H.poly(g, [[px, y - hgt * 0.45], [px + 4, y - hgt * 0.6], [px, y - hgt * 0.55]], "#557a47", null);
      if (stage >= 1) H.circle(g, px, y - hgt - 2, 2.6, ["#c4572e", "#d6b25e", "#c9b6ff", "#e9dcc0"][i % 4], P().ink, 0.8);
    }
  }
  /* an item icon (from iconart) as a small framed plaque */
  function plaque(g, id, x, y, size) {
    if (typeof ICONART === "undefined" || !D.ITEMS[id] && !D.ITEMS[String(id).split("|")[1]]) return;
    g.save(); g.translate(x, y); g.scale(size / 40, size / 40); try { ICONART.drawItem(id)(g); } catch (e) { /* missing art */ } g.restore();
  }
  const kindOf = (id) => { const it = D.ITEMS[id] || D.ITEMS[String(id).split("|")[1]] || {}; return it.slot === "weapon" ? "weapon" : G.ARMOR_SLOTS.includes(it.slot) ? "armor" : it.slot === "trophy" ? "trophy" : "case"; };
  /* the display corner: a weapon rack, a mannequin for armour and a glass case for the rest */
  function display(g, H, x, y, shown, L) {
    const items = shown.slice(0, 6), w = items.filter((i) => kindOf(i) === "weapon"), a = items.filter((i) => kindOf(i) === "armor"), c = items.filter((i) => ["case", "trophy"].includes(kindOf(i)));
    // weapon rack on the wall
    g.fillStyle = "#4f3826"; g.fillRect(x, y - 98, 46, 5); g.fillRect(x, y - 58, 46, 5);
    w.slice(0, 2).forEach((id, i) => plaque(g, id, x + 2 + i * 22, y - 92, 22));
    if (!w.length) { g.strokeStyle = "rgba(233,220,192,.25)"; g.setLineDash([3, 3]); g.strokeRect(x + 4, y - 90, 38, 28); g.setLineDash([]); }
    // mannequin
    const mx = x + 60, my = y;
    g.fillStyle = "#5a4330"; g.fillRect(mx - 1.5, my - 40, 3, 40); g.fillRect(mx - 10, my - 2, 20, 3);
    H.circle(g, mx, my - 72, 8, "#c9b48f", P().ink, 1);
    H.poly(g, [[mx - 14, my - 62], [mx + 14, my - 62], [mx + 11, my - 36], [mx - 11, my - 36]], a.length ? "#7d6c58" : "#b9a98d", P().ink, 1.2);
    if (a.length) plaque(g, a[0], mx - 12, my - 62, 24);
    if (a[1]) plaque(g, a[1], mx - 9, my - 92, 18);
    // glass case
    const cx = x + 84, cy = y;
    H.poly(g, [[cx, cy], [cx + 44, cy], [cx + 44, cy - 26], [cx, cy - 26]], "#5a4330", P().ink, 1.2);
    g.fillStyle = "rgba(190,220,230,.28)"; g.fillRect(cx + 2, cy - 54, 40, 28); g.strokeStyle = L.kind === "grand" || L.kind === "dwemer" ? L.trim : "#a9b0b4"; g.lineWidth = 1.4; g.strokeRect(cx + 2, cy - 54, 40, 28);
    c.slice(0, 2).forEach((id, i) => plaque(g, id, cx + 4 + i * 19, cy - 50, 17));
    g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + 6, cy - 52); g.lineTo(cx + 14, cy - 30); g.stroke();
  }
  function skullsOnWall(g, H, n, x, y) {   // dragon skulls (from your trophy count)
    for (let i = 0; i < Math.min(3, n); i++) {
      const sx = x + i * 30;
      H.poly(g, [[sx, y], [sx + 10, y - 8], [sx + 22, y - 4], [sx + 26, y + 4], [sx + 14, y + 8], [sx + 2, y + 6]], "#e9dcc0", P().ink, 1);
      H.poly(g, [[sx + 2, y - 3], [sx - 6, y - 12], [sx + 4, y - 5]], "#cdb98f", P().ink, 0.8); g.fillStyle = "#3b2c1e"; g.fillRect(sx + 12, y - 2, 3, 3);
    }
  }
  function mottoPlaque(g, text, L) {
    if (!text) return;
    g.font = "italic 11px Georgia, serif"; const t = text.length > 46 ? text.slice(0, 45) + "…" : text, tw = Math.min(W - 40, g.measureText(t).width + 22);
    const x = (W - tw) / 2; g.fillStyle = L.kind === "grand" || L.kind === "dwemer" ? "#6f5741" : "#4f3826"; g.fillRect(x, 12, tw, 18); g.strokeStyle = "#d6b25e"; g.lineWidth = 1; g.strokeRect(x + 2, 14, tw - 4, 14);
    g.fillStyle = "#f1e6cc"; g.textAlign = "center"; g.fillText(t, W / 2, 25); g.textAlign = "left";
  }
  function giftBox(g, H, x, y) {
    H.poly(g, [[x, y], [x + 18, y], [x + 18, y - 14], [x, y - 14]], "#8e2b25", P().ink, 1); g.fillStyle = "#d6b25e"; g.fillRect(x + 7.5, y - 14, 3, 14); g.fillRect(x, y - 9, 18, 3);
    H.circle(g, x + 6, y - 16, 3, null, "#d6b25e", 1.6); H.circle(g, x + 12, y - 16, 3, null, "#d6b25e", 1.6);
  }
  function nightTint(g) { if (typeof G !== "undefined" && G.isNight(G.now())) { g.fillStyle = "rgba(20,26,45,.32)"; g.fillRect(0, 0, W, HT); } }

  /* the hotspots (as % of the picture), so the UI can overlay tap targets on the drawing */
  const SPOTS = { garden: [4, 10, 26, 30], bed: [2, 50, 26, 46], hearth: [37, 24, 26, 52], display: [62, 16, 36, 66], chest: [26, 66, 12, 30] };

  /* st: { town, rested, garden (0..1), chestN, shown:[ids], skulls, motto, gift, owner } */
  function interior(st, opts = {}) {
    const L = lookOf(st.town), night = typeof G !== "undefined" && G.isNight(G.now());
    const key = `home|${st.town}|${st.rested ? 1 : 0}|${Math.round((st.garden || 0) * 4)}|${Math.min(99, st.chestN || 0)}|${(st.shown || []).join(",")}|${Math.min(3, st.skulls || 0)}|${st.motto || ""}|${st.gift ? 1 : 0}|${st.visitor ? 1 : 0}|${night ? "n" : "d"}`;
    const draw = (g, H) => {
      room(g, H, L, st.town.length * 7);
      if (L.loft) loft(g, H);
      if (L.lake) windowLake(g, H, W * 0.06, 34, W * 0.2, 40, night);
      else { g.fillStyle = night ? "#1c2833" : "#c9d6d8"; g.fillRect(W * 0.07, 34, W * 0.18, 38); g.strokeStyle = "#3b2c1e"; g.lineWidth = 3; g.strokeRect(W * 0.07, 34, W * 0.18, 38); g.beginPath(); g.moveTo(W * 0.16, 34); g.lineTo(W * 0.16, 72); g.stroke(); }
      garden(g, H, W * 0.055, 80, W * 0.2, st.garden || 0);
      skullsOnWall(g, H, st.skulls || 0, W * 0.5 - 40, 42);
      hearth(g, H, W * 0.5, L, true);
      bed(g, H, W * 0.03, HT * 0.9, !!st.rested);
      display(g, H, W * 0.63, HT * 0.9, st.shown || [], L);
      chest(g, H, W * 0.275, HT * 0.94, st.chestN || 0);
      if (L.kind === "grand") { g.strokeStyle = "#d6b25e"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(W * 0.5, 9); g.lineTo(W * 0.5, 20); g.stroke(); H.circle(g, W * 0.5, 24, 6, "#d6b25e", P().ink, 1); }
      if (st.gift) giftBox(g, H, W * 0.38, HT * 0.97);
      mottoPlaque(g, st.motto, L);
      nightTint(g);
      g.strokeStyle = "#3b2c1e"; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, HT - 3);
    };
    return ART.html(W, HT, draw, { key, cls: "scene homeart", alt: `${L.name} inside`, style: opts.style });
  }

  // ---- the Hall of the North, growing with every tier
  function hall(tier, donors = [], chestN = 0, pct = 0, opts = {}) {
    const names = donors.slice(0, 6).map((d) => String(d.name || "").slice(0, 10));
    const key = `hall|${tier}|${names.join(",")}|${Math.min(9, chestN)}|${Math.round(pct / 20)}`;
    const draw = (g, H) => {
      if (tier <= 1) {   // outside: the camp, then the longhouse
        H.sky(g, W, HT, "day"); H.mountains(g, W, HT * 0.62, HT * 0.35, 21, "#8f7a66", true);
        g.fillStyle = "#8c9a5a"; g.fillRect(0, HT * 0.62, W, HT * 0.38); H.pines(g, W, HT * 0.66, 10, 22, 16);
        if (tier === 0) {
          for (const [x, c] of [[80, "#b9a98d"], [150, "#a8622e"], [250, "#c9b48f"]]) H.poly(g, [[x - 26, HT * 0.86], [x, HT * 0.58], [x + 26, HT * 0.86]], c, ART.PAL.ink, 1.3);
          const fx = 200, fy = HT * 0.88; const glow = g.createRadialGradient(fx, fy - 6, 2, fx, fy - 6, 40); glow.addColorStop(0, "rgba(255,190,90,.6)"); glow.addColorStop(1, "rgba(255,150,60,0)"); g.fillStyle = glow; g.fillRect(fx - 45, fy - 45, 90, 60);
          H.poly(g, [[fx - 8, fy], [fx, fy - 16], [fx + 8, fy]], "#e8923a", null);
        } else {
          H.poly(g, [[60, HT * 0.9], [60, HT * 0.6], [300, HT * 0.6], [300, HT * 0.9]], "#7a5232", ART.PAL.ink, 1.4);
          H.poly(g, [[48, HT * 0.62], [180, HT * 0.34], [312, HT * 0.62]], "#5a4330", ART.PAL.ink, 1.4);
          g.fillStyle = "#3b2c1e"; g.fillRect(166, HT * 0.72, 28, HT * 0.18);
          g.strokeStyle = "rgba(240,240,240,.6)"; g.lineWidth = 3; g.beginPath(); g.moveTo(240, HT * 0.44); g.quadraticCurveTo(250, HT * 0.3, 236, HT * 0.18); g.stroke();
        }
      } else {   // inside: long hearth, tables, banners; stone from the Fortified Hall up; a throne in the Jarl's Keep
        const L = tier >= 3 ? LOOK.Windhelm : LOOK.Whiterun;
        room(g, H, { ...L, dark: false, loft: false }, 77);
        const banners = tier === 2 ? 2 : tier === 3 ? 4 : 6;
        for (let i = 0; i < banners; i++) { const bx = 24 + i * ((W - 60) / Math.max(1, banners - 1)); H.poly(g, [[bx, 12], [bx + 18, 12], [bx + 18, 50], [bx + 9, 43], [bx, 50]], i % 2 ? "#8e2b25" : "#30505e", ART.PAL.ink, 1); }
        // trophy wall: donors' shields
        names.forEach((n, i) => {
          const sx = i < 3 ? 22 + i * 46 : 220 + (i - 3) * 46, sy = 64;   // leave the middle free for the throne
          H.poly(g, [[sx, sy], [sx + 36, sy], [sx + 36, sy + 18], [sx + 18, sy + 30], [sx, sy + 18]], ["#8e2b25", "#30505e", "#3d5d36", "#7a5232", "#5a4a7a", "#6f6a64"][i], "#d6b25e", 1.4);
          g.fillStyle = "#f1e6cc"; g.font = "bold 8px Georgia, serif"; g.textAlign = "center"; g.fillText(n, sx + 18, sy + 15); g.textAlign = "left";
        });
        // the long hearth and tables
        const glow = g.createRadialGradient(W / 2, HT * 0.82, 4, W / 2, HT * 0.82, 120); glow.addColorStop(0, "rgba(255,190,90,.45)"); glow.addColorStop(1, "rgba(255,150,60,0)"); g.fillStyle = glow; g.fillRect(0, HT * 0.5, W, HT * 0.5);
        H.poly(g, [[W * 0.32, HT * 0.9], [W * 0.68, HT * 0.9], [W * 0.66, HT * 0.82], [W * 0.34, HT * 0.82]], "#6f6a64", ART.PAL.ink, 1.2);
        for (let i = 0; i < 7; i++) H.poly(g, [[W * (0.36 + i * 0.045), HT * 0.84], [W * (0.375 + i * 0.045), HT * 0.74], [W * (0.39 + i * 0.045), HT * 0.84]], i % 2 ? "#f6d27a" : "#e8923a", null);
        for (const tx of [W * 0.05, W * 0.72]) { H.poly(g, [[tx, HT * 0.86], [tx + W * 0.22, HT * 0.86], [tx + W * 0.22, HT * 0.82], [tx, HT * 0.82]], "#6f4f33", ART.PAL.ink, 1); g.fillStyle = "#5a4330"; g.fillRect(tx + 4, HT * 0.86, 4, 12); g.fillRect(tx + W * 0.22 - 8, HT * 0.86, 4, 12); H.circle(g, tx + 20, HT * 0.8, 3, "#c9a24c", ART.PAL.ink, 0.8); }
        if (tier >= 2) { chest(g, H, W * 0.9, HT * 0.97, chestN); }
        if (tier >= 4) { const tx = W * 0.5; H.poly(g, [[tx - 16, HT * 0.62], [tx - 16, HT * 0.42], [tx, HT * 0.34], [tx + 16, HT * 0.42], [tx + 16, HT * 0.62]], "#7a5232", "#d6b25e", 1.6); }
      }
      // scaffolding grows as the next tier fills up
      if (tier < 4 && pct > 15) {
        const sw = 30 + pct * 0.5, sx = W - sw - 6;
        g.strokeStyle = "rgba(122,82,50,.9)"; g.lineWidth = 2;
        for (let x = sx; x <= W - 6; x += 14) { g.beginPath(); g.moveTo(x, HT - 6); g.lineTo(x, HT * 0.35); g.stroke(); }
        for (let y = HT - 10; y > HT * 0.35; y -= 20) { g.beginPath(); g.moveTo(sx, y); g.lineTo(W - 6, y); g.stroke(); }
      }
      g.strokeStyle = "#3b2c1e"; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, HT - 3);
    };
    return ART.html(W, HT, draw, { key, cls: "scene homeart", alt: "Hall of the North", style: opts.style });
  }

  /* the drawing plus invisible tap targets over the bed, garden, chest and display */
  function withSpots(img, spots) {
    return `<div class="hscene">${img}${spots.map(([id, act, label]) => { const [l, t, w, h] = SPOTS[id]; return `<button class="hot" data-act="${act}" data-id="${id}" style="left:${l}%;top:${t}%;width:${w}%;height:${h}%" aria-label="${label}"></button>`; }).join("")}</div>`;
  }
  /* your own home, from the save */
  function mine(s, town) {
    const h = (s.homes || {})[town]; if (!h) return "";
    const t = G.now(), age = t - (h.garden || 0);
    const st = { town, rested: (s.rested || 0) > t && (s.restBonus || 0) >= 0.1, garden: Math.max(0, Math.min(1, age / 7200)), chestN: (h.chest || []).length,
      shown: (h.chest || []).filter((r) => r.shown).map((r) => r.item), skulls: s.dragons || 0, motto: s.motto || "" };
    return withSpots(interior(st), [["garden", "harvest", "Garden: harvest"], ["bed", "homebed", "Bed: sleep"], ["chest", "homejump", "Chest"], ["display", "homejump", "Display case"]]);
  }
  /* a neighbour's home, from their shared record */
  function visit(d, town, gift = false) {
    const shown = (d.show || []).filter((x) => x.town === town && x.item).map((x) => x.item);
    return interior({ town, rested: false, garden: 0.6, chestN: 0, shown, skulls: d.dragons || 0, motto: d.motto || "", gift, visitor: true });
  }
  return { interior, hall, mine, visit, withSpots, SPOTS, LOOK };
})();
