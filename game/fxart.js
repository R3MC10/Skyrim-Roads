/* Effects art: festival decorations on town pictures, spell and shout effects on the map, and a little animated strip
   of you on the road while you travel. Drawn with the shared toolkit (art.js), in both art styles. [OURS]
     FXART.festId()                         → the festival on now (or one forced for tests), or null
     FXART.festDecor(g, H, w, h, id, seed)  draws that festival's decorations over a town picture
     FXART.festSection(g, H, w, h, id, sec) small touches over a town-section banner (the inn gets confetti)
     FXART.cast(kind, info)                 remember a one-off effect (clairvoyance, recall, whirlwind, transmute)
     FXART.state(S, pos)                    → what effects are on now (null when nothing), for the map view
     FXART.mapUnder(g, fx, P, s, px, py, t, reduce, v) / FXART.mapOver(...)   draw them on the map
     FXART.vignette(host, info)             the travel strip (one reused canvas, ~10 fps, only while on screen) */
const FXART = (() => {
  const PAL = ART.PAL;
  let forced = null;   // tests: FXART.force("newlife")
  function festId(t) {
    if (forced) return forced === "none" ? null : forced;
    try { return typeof FEST !== "undefined" ? FEST.active(t)?.id || null : null; } catch { return null; }
  }
  const force = (id) => { forced = id || null; };
  const FESTS = ["newlife", "midyear", "witching", "frostfall"];

  // ---------------------------------------------------------------- festival decorations
  function lanternString(g, H, w, y0, sag, n, colors, r, glow) {
    g.strokeStyle = PAL.ink; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y0); g.quadraticCurveTo(w / 2, y0 + sag * 2, w, y0); g.stroke();
    for (let i = 1; i < n; i++) {
      const x = (w * i) / n, tt = i / n, y = y0 + sag * 4 * tt * (1 - tt);
      if (glow) { const gr = g.createRadialGradient(x, y + 5, 1, x, y + 5, 12); gr.addColorStop(0, "rgba(255,200,110,0.55)"); gr.addColorStop(1, "rgba(255,200,110,0)"); g.fillStyle = gr; g.fillRect(x - 12, y - 7, 24, 24); }
      g.strokeStyle = PAL.ink; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 2); g.stroke();
      H.poly(g, [[x - 3, y + 2], [x + 3, y + 2], [x + 4, y + 8], [x - 4, y + 8]], colors[Math.floor(r() * colors.length)], PAL.ink, 0.8);
    }
  }
  function pennants(g, H, w, y0, sag, n, colors) {
    g.strokeStyle = PAL.ink; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y0); g.quadraticCurveTo(w / 2, y0 + sag * 2, w, y0); g.stroke();
    for (let i = 0; i < n; i++) {
      const tt = (i + 0.5) / n, x = w * tt, y = y0 + sag * 4 * tt * (1 - tt);
      H.poly(g, [[x - 5, y], [x + 5, y], [x, y + 10]], colors[i % colors.length], PAL.ink, 0.7);
    }
  }
  function table(g, H, x, base, wd, r) {
    H.poly(g, [[x, base - 10], [x + wd, base - 10], [x + wd, base - 7], [x, base - 7]], PAL.wood, PAL.ink, 1);
    g.fillStyle = PAL.ink; g.fillRect(x + 3, base - 7, 2, 7); g.fillRect(x + wd - 5, base - 7, 2, 7);
    for (let i = 0; i < wd / 9; i++) {
      const fx = x + 4 + i * 9, k = r();
      if (k < 0.35) H.circle(g, fx, base - 12.5, 2.6, "#c08a3c", PAL.ink, 0.6);                          // bread
      else if (k < 0.65) H.poly(g, [[fx - 2.5, base - 10], [fx + 2.5, base - 10], [fx + 2, base - 16], [fx - 2, base - 16]], "#8a5a34", PAL.ink, 0.6);   // tankard
      else H.circle(g, fx, base - 12, 2.2, PAL.blood, PAL.ink, 0.6);                                     // apple
    }
  }
  function bonfire(g, H, x, base, s = 1) {
    const gr = g.createRadialGradient(x, base - 8 * s, 2, x, base - 8 * s, 26 * s); gr.addColorStop(0, "rgba(255,190,90,0.5)"); gr.addColorStop(1, "rgba(255,190,90,0)"); g.fillStyle = gr; g.fillRect(x - 26 * s, base - 34 * s, 52 * s, 40 * s);
    g.strokeStyle = PAL.wood; g.lineWidth = 2.4 * s; g.beginPath(); g.moveTo(x - 9 * s, base); g.lineTo(x + 7 * s, base - 6 * s); g.moveTo(x + 9 * s, base); g.lineTo(x - 7 * s, base - 6 * s); g.stroke();
    H.poly(g, [[x - 7 * s, base - 3 * s], [x, base - 22 * s], [x + 7 * s, base - 3 * s]], PAL.fire, PAL.ink, 1);
    H.poly(g, [[x - 3.5 * s, base - 3 * s], [x, base - 13 * s], [x + 3.5 * s, base - 3 * s]], "#f6d27a", null);
  }
  function gourd(g, H, x, base, s, lit) {
    H.circle(g, x, base - 5 * s, 5.5 * s, "#c9772e", PAL.ink, 1); g.fillStyle = PAL.leaf; g.fillRect(x - 0.8 * s, base - 12 * s, 1.6 * s, 3 * s);
    if (lit) { g.fillStyle = "#ffd27a"; H.poly(g, [[x - 3 * s, base - 7 * s], [x - 1.5 * s, base - 8.5 * s], [x - 0.5 * s, base - 7 * s]], "#ffd27a", null); H.poly(g, [[x + 0.5 * s, base - 7 * s], [x + 1.5 * s, base - 8.5 * s], [x + 3 * s, base - 7 * s]], "#ffd27a", null); g.fillRect(x - 2.5 * s, base - 4.5 * s, 5 * s, 1.4 * s); }
  }
  function maypole(g, H, x, base, h, r) {
    g.fillStyle = PAL.wood; g.fillRect(x - 1.5, base - h, 3, h); H.circle(g, x, base - h, 3, PAL.gold, PAL.ink, 0.8);
    const cols = ["#c4572e", "#2f5f80", "#d6b25e", "#3d5d36", "#8e2b25"];
    for (let i = 0; i < 6; i++) { const a = -1 + i * 0.4; g.strokeStyle = cols[i % cols.length]; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, base - h + 3); g.quadraticCurveTo(x + a * 14, base - h * 0.5, x + a * 22 + (r() - 0.5) * 4, base - 2); g.stroke(); }
  }
  function flowers(g, w, base, n, r) {
    const cols = ["#e8923a", "#c4572e", "#f4f0d8", "#c9b6ff", "#d6b25e"];
    for (let i = 0; i < n; i++) { const x = r() * w, y = base - r() * 6; g.fillStyle = PAL.leaf; g.fillRect(x, y, 1, 3); g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(x + 0.5, y, 1.8, 0, Math.PI * 2); g.fill(); }
  }
  function confetti(g, w, h, n, r, cols = ["#d6b25e", "#c4572e", "#9fd0f0", "#c9b6ff", "#8fe08a"]) {
    for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.save(); g.translate(r() * w, r() * h * 0.85); g.rotate(r() * 3); g.fillRect(-1.6, -0.8, 3.2, 1.6); g.restore(); }
  }
  function icicles(g, w, y, r) { g.fillStyle = "rgba(230,240,250,0.9)"; g.strokeStyle = "rgba(59,44,30,0.6)"; g.lineWidth = 0.6; for (let x = 4; x < w; x += 7 + r() * 6) { const l = 4 + r() * 9; g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x + 2, y); g.lineTo(x, y + l); g.closePath(); g.fill(); g.stroke(); } }
  function brazier(g, H, x, base) { H.poly(g, [[x - 6, base - 12], [x + 6, base - 12], [x + 3, base - 6], [x - 3, base - 6]], PAL.iron, PAL.ink, 1); g.fillStyle = PAL.ink; g.fillRect(x - 0.8, base - 6, 1.6, 6); H.poly(g, [[x - 4, base - 12], [x, base - 22], [x + 4, base - 12]], PAL.fire, PAL.ink, 0.8); }
  function bats(g, w, h, n, r) { g.fillStyle = PAL.night; for (let i = 0; i < n; i++) { const x = r() * w, y = 8 + r() * h * 0.3, s = 3 + r() * 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - s, y - s, x - 2 * s, y); g.quadraticCurveTo(x - s, y - s * 0.3, x, y + s * 0.4); g.quadraticCurveTo(x + s, y - s * 0.3, x + 2 * s, y); g.quadraticCurveTo(x + s, y - s, x, y); g.fill(); } }

  /* decorations over a town or city picture (w×h, ground near h*0.78) */
  function festDecor(g, H, w, h, id, seed = "town") {
    if (!id) return;
    const r = ART.seeded(`fest|${id}|${seed}`), base = Math.round(h * 0.86);
    if (id === "newlife") {
      lanternString(g, H, w, 10, 10, 11, ["#c4572e", "#d6b25e", "#8e2b25"], r, true);
      table(g, H, w * 0.08, base, 74, r); table(g, H, w * 0.62, base, 64, r);
      confetti(g, w, h, 22, r);
    } else if (id === "midyear") {
      pennants(g, H, w, 8, 9, 16, ["#c4572e", "#d6b25e", "#2f5f80", "#3d5d36"]);
      maypole(g, H, w * 0.78, base, h * 0.5, r);
      flowers(g, w, base, 40, r);
    } else if (id === "witching") {
      lanternString(g, H, w, 12, 8, 9, ["#6f3f8f", "#3d5d36", "#c9772e"], r, true);
      for (let i = 0; i < 5; i++) gourd(g, H, 18 + r() * (w - 36), base, 1 + r() * 0.3, true);
      bats(g, w, h, 6, r);
      g.fillStyle = "rgba(60,30,80,0.07)"; g.fillRect(0, 0, w, h);   // a purple-ish night air
    } else if (id === "frostfall") {
      icicles(g, w, 0, r);
      pennants(g, H, w, 10, 7, 14, ["#9fd0f0", "#f4f6f8", "#2f5f80"]);
      brazier(g, H, w * 0.16, base); brazier(g, H, w * 0.84, base);
      bonfire(g, H, w * 0.5, base, 0.9);
    }
  }
  /* smaller touches over a town section banner; the inn gets the party */
  function festSection(g, H, w, h, id, sec) {
    if (!id) return;
    const r = ART.seeded(`festsec|${id}|${sec}`);
    const cols = { newlife: ["#c4572e", "#d6b25e", "#8e2b25"], midyear: ["#c4572e", "#d6b25e", "#2f5f80", "#3d5d36"], witching: ["#6f3f8f", "#3d5d36", "#c9772e"], frostfall: ["#9fd0f0", "#f4f6f8", "#2f5f80"] }[id] || ["#d6b25e"];
    pennants(g, H, w, 4, 5, 12, cols);
    if (sec === "inn") {
      g.fillStyle = { newlife: "rgba(255,190,90,0.12)", midyear: "rgba(255,230,140,0.12)", witching: "rgba(110,60,150,0.16)", frostfall: "rgba(160,200,240,0.14)" }[id] || "rgba(255,200,120,0.1)";
      g.fillRect(0, 0, w, h);
      confetti(g, w, h, 34, r, cols);
      if (id === "witching") { gourd(g, H, w * 0.12, h - 6, 1, true); gourd(g, H, w * 0.88, h - 6, 1.1, true); }
      if (id === "newlife") table(g, H, w * 0.06, h - 3, 60, r);
    }
  }

  // ---------------------------------------------------------------- one-off effects (from casting)
  const ONE_SHOT = { clairvoyance: 10000, recall: 1600, whirlwind: 1800, transmute: 1600 };
  const shots = [];
  function cast(kind, info = {}) {
    if (!ONE_SHOT[kind]) return;
    for (let i = shots.length - 1; i >= 0; i--) if (shots[i].kind === kind) shots.splice(i, 1);
    shots.push({ kind, at: performance.now(), ...info });
  }
  function live(now) { for (let i = shots.length - 1; i >= 0; i--) if (now - shots[i].at > ONE_SHOT[shots[i].kind]) shots.splice(i, 1); return shots; }

  /* what's on now; null when nothing (so the map does no extra work) */
  function state(s, pos, t) {
    if (!s) return null;
    const now = typeof G !== "undefined" ? G.now() : Date.now() / 1000;
    const fx = (name) => (s.fx || []).some((f) => f.name === name && f.until > now);
    let night = false; try { night = G.isNight(now); } catch { /* ignore */ }
    const st = {
      candle: fx("Candlelight"), detect: fx("Detect Life"), muffle: fx("Muffle"),
      mark: s.mark ? [s.mark.x, s.mark.y] : null,
      rested: !!(s.rested > now && (s.restBonus || 0) >= 0.1),
      vamp: !!(s.vampire && night), wolf: !!(s.werewolf && night),
      shots: live(performance.now()).slice(),
    };
    st.anim = st.candle || st.detect || st.muffle || st.rested || st.vamp || st.shots.length > 0;
    return st.anim || st.mark || st.wolf ? st : null;
  }

  // ---------------------------------------------------------------- the map layer (map units already scaled by s)
  const glow = (color) => (typeof MAPART !== "undefined" ? MAPART.glowSprite(color) : null);
  function softGlow(g, x, y, R, color) {
    const sp = glow(color); if (!sp) return;
    g.save(); g.globalCompositeOperation = "lighter"; g.drawImage(sp, x - R, y - R, R * 2, R * 2); g.restore();
  }
  function rune(g, x, y, R, s, t) {
    g.save(); g.translate(x, y); g.rotate(t * 0.25);
    g.strokeStyle = "rgba(190,150,255,0.9)"; g.lineWidth = 1.6 * s; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1 * s; g.beginPath(); g.arc(0, 0, R * 0.72, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; g.save(); g.rotate(a); g.beginPath(); g.moveTo(R * 0.78, -2 * s); g.lineTo(R * 0.95, 0); g.lineTo(R * 0.78, 2 * s); g.stroke(); g.restore(); }
    g.restore();
  }
  function mapUnder(g, fx, P, s, px, py, t, reduce, v) {
    if (!fx) return;
    const tt = reduce ? 0 : t, now = performance.now();
    if (fx.mark) { const [mx, my] = P(fx.mark); rune(g, mx, my, 11 * s, s, tt); }
    if (fx.wolf && v?.trail?.length > 1) {   // paw prints along the last stretch of your path
      g.fillStyle = "rgba(40,28,18,0.55)";
      const pts = v.trail.slice(-12);
      for (let i = 0; i < pts.length; i += 1) { const [x, y] = P(pts[i]); const side = i % 2 ? 3 : -3; H_paw(g, x + side * s, y, 2.2 * s); }
    }
    if (fx.rested) softGlow(g, px, py, (26 + Math.sin(tt * 2) * 2) * s, "rgba(255,215,120,1)");
    if (fx.detect) {
      for (let k = 0; k < 3; k++) { const ph = ((tt * 0.5 + k / 3) % 1); g.strokeStyle = `rgba(230,90,90,${0.55 * (1 - ph)})`; g.lineWidth = 1.6 * s; g.beginPath(); g.arc(px, py, (14 + ph * 60) * s, 0, Math.PI * 2); g.stroke(); }
      for (const o of v?.others || []) { const [ox, oy] = P(o.pos); if (Math.hypot(ox - px, oy - py) < 120 * s) softGlow(g, ox, oy, 10 * s, "rgba(255,90,90,1)"); }
      const r = ART.seeded("life|" + Math.floor(px / 40) + "|" + Math.floor(py / 40));   // a few unseen creatures nearby, just for show
      for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = (25 + r() * 60) * s; softGlow(g, px + Math.cos(a) * d, py + Math.sin(a) * d, 6 * s, i % 2 ? "rgba(120,170,255,1)" : "rgba(255,120,120,1)"); }
    }
    if (fx.muffle) { g.save(); g.setLineDash([3 * s, 5 * s]); g.lineDashOffset = -tt * 8 * s; g.strokeStyle = "rgba(200,220,255,0.55)"; g.lineWidth = 1.2 * s; g.beginPath(); g.arc(px, py, 19 * s, 0, Math.PI * 2); g.stroke(); g.restore(); }
    if (fx.candle) { const a = tt * 1.6, ox = px + Math.cos(a) * 14 * s, oy = py - 18 * s + Math.sin(a * 2) * 3 * s; softGlow(g, ox, oy, 22 * s, "rgba(255,230,160,1)"); g.fillStyle = "#fff6d8"; g.beginPath(); g.arc(ox, oy, 2.4 * s, 0, Math.PI * 2); g.fill(); }
    for (const sh of fx.shots) {
      const age = Math.min(1, (now - sh.at) / ONE_SHOT[sh.kind]);
      if (sh.kind === "clairvoyance" && sh.to) {
        const [tx, ty] = P(sh.to), d = Math.hypot(tx - px, ty - py), n = Math.min(28, Math.floor(d / (11 * s)));
        const fade = age > 0.8 ? (1 - age) / 0.2 : 1;
        for (let i = 1; i <= n; i++) { const k = i / n, x = px + (tx - px) * k, y = py + (ty - py) * k + Math.sin(k * 9 + tt * 3) * 3 * s, a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(k * 12 - tt * 5)); g.fillStyle = `rgba(160,210,255,${a * fade})`; g.beginPath(); g.arc(x, y, 1.8 * s, 0, Math.PI * 2); g.fill(); }
        softGlow(g, tx, ty, 16 * s * fade, "rgba(160,210,255,1)");
      } else if (sh.kind === "recall") {
        for (const p of [sh.from, sh.to].filter(Boolean)) { const [x, y] = P(p); g.strokeStyle = `rgba(220,200,255,${1 - age})`; g.lineWidth = (3 - age * 2) * s; g.beginPath(); g.arc(x, y, (6 + age * 40) * s, 0, Math.PI * 2); g.stroke(); softGlow(g, x, y, 30 * s * (1 - age), "rgba(210,190,255,1)"); }
      } else if (sh.kind === "whirlwind" && sh.from) {
        const [fx2, fy2] = P(sh.from); g.strokeStyle = `rgba(230,240,255,${0.8 * (1 - age)})`; g.lineCap = "round";
        for (let k = -2; k <= 2; k++) { g.lineWidth = (2.4 - Math.abs(k) * 0.6) * s; g.beginPath(); g.moveTo(fx2 + k * 2 * s, fy2 + k * 2 * s); g.lineTo(px + k * 2 * s, py + k * 2 * s); g.stroke(); }
        g.lineCap = "butt";
      } else if (sh.kind === "transmute") {
        for (let k = 0; k < 10; k++) { const a = k * 0.628 + age * 3, d = (6 + age * 22) * s; g.fillStyle = `rgba(255,220,120,${1 - age})`; g.beginPath(); g.arc(px + Math.cos(a) * d, py - 4 * s + Math.sin(a) * d, 1.8 * s, 0, Math.PI * 2); g.fill(); }
      }
    }
  }
  function H_paw(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + (k - 1) * r * 0.9, y - r * 1.3, r * 0.42, 0, Math.PI * 2); g.fill(); } }
  /* over your token: a vampire's eyes catch the light at night */
  function mapOver(g, fx, P, s, px, py, t, reduce) {
    if (!fx?.vamp) return;
    const blink = reduce ? 1 : (Math.sin(t * 1.3) > -0.9 ? 1 : 0.2);
    for (const dx of [-3.2, 3.2]) { softGlow(g, px + dx * s, py - 3 * s, 5 * s, "rgba(255,40,40,1)"); g.fillStyle = `rgba(255,70,60,${blink})`; g.beginPath(); g.arc(px + dx * s, py - 3 * s, 1.3 * s, 0, Math.PI * 2); g.fill(); }
  }

  // ---------------------------------------------------------------- the travel strip
  const VW = 360, VH = 84;
  const GROUND = {   // terrain name → [ground colour, scenery kind]
    "Road": ["#b9a98d", "grass"], "Bridge": ["#b9a98d", "grass"], "Grassland": ["#8c9a5a", "grass"], "Tundra": ["#a99c78", "tundra"], "Forest": ["#557a47", "forest"],
    "Pine forest": ["#3d5d36", "pine"], "Autumn forest": ["#a8622e", "autumn"], "Marsh": ["#6a7a5a", "marsh"], "Snow": ["#e8eef2", "snow"], "Volcanic tundra": ["#7d6c58", "ash"],
    "Rocky hills": ["#8f7a66", "rock"], "Mountains": ["#8f7a66", "rock"], "High peaks": ["#d8e2e8", "snow"], "River (ford)": ["#8c9a5a", "grass"], "Lake": ["#8c9a5a", "grass"], "Sea": ["#8c9a5a", "grass"],
  };
  const layers = new Map();
  function layer(key, w, h, draw) {
    let c = layers.get(key); if (c) return c;
    c = document.createElement("canvas"); c.width = w * 2; c.height = h;
    const g = c.getContext("2d"); draw(g, ART.H, w, h);
    if (layers.size > 24) layers.delete(layers.keys().next().value);
    layers.set(key, c); return c;
  }
  /* each layer is drawn twice side by side so it can scroll forever */
  function farLayer(kind, st, w, h) {
    return layer(`far|${kind}|${st?.key || ""}`, w, h, (g, H) => {
      for (const off of [0, w]) {
        g.save(); g.translate(off, 0);
        H.mountains(g, w + 40, h * 0.62, h * 0.42, 5, kind === "ash" ? "#6e5f50" : PAL.rock, kind !== "ash");
        g.restore();
      }
    });
  }
  function nearLayer(kind, w, h) {
    return layer(`near|${kind}`, w, h, (g, H) => {
      const r = ART.seeded("near|" + kind);
      for (let i = 0; i < 9; i++) {
        const x0 = r() * w, s = 0.8 + r() * 0.6;
        for (const x of [x0, x0 + w]) {
          if (kind === "pine" || kind === "forest" || kind === "snow") { H.poly(g, [[x - 7 * s, h * 0.7], [x, h * 0.7 - 22 * s], [x + 7 * s, h * 0.7]], kind === "snow" ? "#5f7f6a" : PAL.forest, PAL.ink, 1); if (kind === "snow") H.poly(g, [[x - 3 * s, h * 0.7 - 12 * s], [x, h * 0.7 - 22 * s], [x + 3 * s, h * 0.7 - 12 * s]], PAL.snow, null); }
          else if (kind === "autumn") { g.fillStyle = PAL.wood; g.fillRect(x - 1.2, h * 0.7 - 10 * s, 2.4, 10 * s); H.circle(g, x, h * 0.7 - 14 * s, 7 * s, ["#c4572e", "#e8923a", "#c9a24c"][i % 3], PAL.ink, 1); }
          else if (kind === "rock" || kind === "ash" || kind === "tundra") H.poly(g, [[x - 8 * s, h * 0.72], [x - 3 * s, h * 0.72 - 8 * s], [x + 6 * s, h * 0.72 - 5 * s], [x + 9 * s, h * 0.72]], kind === "ash" ? "#5e5046" : "#a8987e", PAL.ink, 1);
          else if (kind === "marsh") { g.strokeStyle = "#4f6a3e"; g.lineWidth = 1.4; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * 2, h * 0.72); g.lineTo(x + k * 3, h * 0.72 - 9 * s); g.stroke(); } }
          else { g.fillStyle = PAL.wood; g.fillRect(x - 1.2, h * 0.7 - 9 * s, 2.4, 9 * s); H.circle(g, x, h * 0.7 - 13 * s, 6.5 * s, PAL.leaf, PAL.ink, 1); }
        }
      }
    });
  }
  function walker(g, H, x, base, ph, look, riding, carriage, horseColor) {
    const race = look && typeof HEROART !== "undefined" && HEROART.RACE[look.r] ? HEROART.RACE[look.r] : null;
    const skin = race ? race.skin[0] : "#e2b894";
    let body = "#6b5640";
    try { const ch = look?.eq?.chest; if (ch && typeof HEROART !== "undefined") { const m = HEROART.MAT[HEROART.matOf(ch)]; if (m) body = m.c; } } catch { /* plain clothes */ }
    if (carriage) {   // a wagon with you on the bench
      H.poly(g, [[x - 26, base - 18], [x + 18, base - 18], [x + 18, base - 8], [x - 26, base - 8]], PAL.wood, PAL.ink, 1.2);
      for (const wx of [x - 18, x + 10]) { H.circle(g, wx, base - 6, 6, "#5a4030", PAL.ink, 1.2); g.strokeStyle = PAL.ink; g.lineWidth = 1; g.beginPath(); g.moveTo(wx + Math.cos(ph) * 5, base - 6 + Math.sin(ph) * 5); g.lineTo(wx - Math.cos(ph) * 5, base - 6 - Math.sin(ph) * 5); g.stroke(); }
      horse(g, H, x + 40, base, ph, "#6b4a2e"); x -= 6; base -= 16;
      H.poly(g, [[x - 4, base - 16], [x + 4, base - 16], [x + 4, base - 2], [x - 4, base - 2]], body, PAL.ink, 1); H.circle(g, x, base - 20, 4.2, skin, PAL.ink, 1); return;
    }
    if (riding) { horse(g, H, x, base, ph, horseColor || "#6b4a2e"); base -= 9; g.strokeStyle = PAL.ink; g.lineWidth = 2.6; g.lineCap = "round"; g.beginPath(); g.moveTo(x, base - 12); g.lineTo(x + 3, base - 3); g.stroke(); g.lineCap = "butt"; }   // sitting in the saddle, a leg down the side
    const swing = riding ? 0 : Math.sin(ph) * 5, bob = riding ? Math.abs(Math.sin(ph)) * 1.2 : Math.abs(Math.sin(ph)) * 1.5;
    if (!riding) { g.strokeStyle = PAL.ink; g.lineWidth = 2.6; g.lineCap = "round"; g.beginPath(); g.moveTo(x, base - 12 - bob); g.lineTo(x + swing, base); g.moveTo(x, base - 12 - bob); g.lineTo(x - swing, base); g.stroke(); g.lineCap = "butt"; }
    H.poly(g, [[x - 5, base - 26 - bob], [x + 5, base - 26 - bob], [x + 5, base - 11 - bob], [x - 5, base - 11 - bob]], body, PAL.ink, 1);
    H.poly(g, [[x - 5, base - 25 - bob], [x - 10, base - 12 - bob], [x - 5, base - 13 - bob]], "#8e2b25", PAL.ink, 0.8);   // a cape
    H.circle(g, x, base - 30 - bob, 4.4, skin, PAL.ink, 1);
    const hx = x + 6 + (riding ? 2 : -swing * 0.5), hy = base - 14 - bob;
    g.strokeStyle = PAL.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 4, base - 22 - bob); g.lineTo(hx, hy); g.stroke();
    gear(g, H, x, base - bob, hx, hy, look);
  }
  /* what they carry: the helmet on their head, a shield on the far arm, the weapon in hand (bows and staffs on the shoulder) */
  function gear(g, H, x, base, hx, hy, look) {
    const eq = look?.eq; if (!eq || typeof HEROART === "undefined") return;
    const matC = (id) => { try { return HEROART.MAT[HEROART.matOf(id)]?.c || "#8f8a84"; } catch { return "#8f8a84"; } };
    if (eq.head) H.poly(g, [[x - 4.8, base - 30], [x - 4.2, base - 35.4], [x + 4.2, base - 35.4], [x + 4.8, base - 30]], matC(eq.head), PAL.ink, 0.9);
    if (eq.shield) { H.poly(g, [[x - 9, base - 24], [x - 3, base - 24], [x - 2.5, base - 17], [x - 6, base - 13], [x - 9.5, base - 17]], matC(eq.shield), PAL.ink, 0.9); }
    const wk = (() => { try { return HEROART.weaponKind(eq.weapon); } catch { return null; } })();
    if (!wk || wk === "fist") return;
    const c = matC(eq.weapon), line = (x1, y1, x2, y2, col, w) => { g.strokeStyle = PAL.ink; g.lineWidth = w + 1.4; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    if (wk === "bow" || wk === "crossbow") { g.strokeStyle = PAL.wood; g.lineWidth = 1.6; g.beginPath(); g.arc(x - 3, base - 20, 9, -1.2, 1.2); g.stroke(); return; }   // across the back
    if (wk === "staff") { line(hx, hy + 6, hx + 1, hy - 18, PAL.wood, 1.4); H.circle(g, hx + 1, hy - 19, 2, "#c9b6ff", PAL.ink, 0.6); return; }
    const big = wk === "greatsword" || wk === "battleaxe" || wk === "warhammer";
    if (big) { line(x - 6, base - 6, x + 6, base - 34, c, 2); if (wk !== "greatsword") H.poly(g, [[x + 4, base - 34], [x + 10, base - 36], [x + 9, base - 29]], c, PAL.ink, 0.8); return; }   // on the back
    const len = wk === "dagger" ? 5 : wk === "spear" ? 16 : 9;
    line(hx, hy, hx + 2, hy - len, c, wk === "dagger" ? 1.2 : 1.6);
    if (wk === "axe") H.poly(g, [[hx + 2, hy - len], [hx + 6, hy - len - 1], [hx + 5, hy - len + 4]], c, PAL.ink, 0.7);
    if (wk === "mace") H.circle(g, hx + 2, hy - len, 2, c, PAL.ink, 0.7);
  }
  function horse(g, H, x, base, ph, color) {
    const k = Math.sin(ph) * 4;
    g.strokeStyle = PAL.ink; g.lineWidth = 2.2; g.lineCap = "round";
    g.beginPath(); g.moveTo(x - 9, base - 9); g.lineTo(x - 9 + k, base); g.moveTo(x - 5, base - 9); g.lineTo(x - 5 - k, base); g.moveTo(x + 8, base - 9); g.lineTo(x + 8 - k, base); g.moveTo(x + 12, base - 9); g.lineTo(x + 12 + k, base); g.stroke(); g.lineCap = "butt";
    H.poly(g, [[x - 13, base - 18], [x + 14, base - 18], [x + 16, base - 9], [x - 12, base - 9]], color, PAL.ink, 1.1);
    H.poly(g, [[x + 12, base - 18], [x + 18, base - 28], [x + 23, base - 25], [x + 17, base - 15]], color, PAL.ink, 1.1);
    g.strokeStyle = PAL.ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - 13, base - 17); g.quadraticCurveTo(x - 19, base - 14, x - 17, base - 6); g.stroke();
  }
  /* the sky and the weather on top are still pictures: draw them once per sky state, then just copy them */
  function flat(key, draw) {
    let c = layers.get(key); if (c) return c;
    c = document.createElement("canvas"); c.width = VW * 2; c.height = VH * 2;
    const g = c.getContext("2d"); g.scale(2, 2); draw(g, ART.H);
    if (layers.size > 24) layers.delete(layers.keys().next().value);
    layers.set(key, c); return c;
  }
  const skyLayer = (st) => flat(`sky|${st?.key || "plain"}`, (g, H) => { if (st && typeof SKY !== "undefined") SKY.backdrop(g, H, VW, VH, st, { horizon: 0.66, seed: "vig" }); else H.sky(g, VW, VH, "day"); });
  const overLayer = (st) => flat(`over|${st.key}`, (g, H) => SKY.overlay(g, H, VW, VH, st, { seed: "vig", ground: VH * 0.8, cover: false }));
  let vig = null;   // { canvas, host, info, last, raf }
  function vignette(host, info) {
    if (!host) return;
    if (!vig) {
      const c = document.createElement("canvas"); c.className = "tripvig-c"; c.setAttribute("aria-hidden", "true");
      vig = { canvas: c, info, last: 0, off: 0, raf: 0 };
    }
    vig.info = info;
    if (vig.canvas.parentNode !== host) host.appendChild(vig.canvas);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (vig.canvas.width !== VW * dpr) { vig.canvas.width = VW * dpr; vig.canvas.height = VH * dpr; }
    paint(performance.now());
    if (!vig.raf && !info.reduce) vig.raf = requestAnimationFrame(loop);
  }
  function loop(ts) {
    vig.raf = 0;
    if (!vig.canvas.isConnected || vig.info.reduce) return;
    if (ts - vig.last >= 100) { vig.off += (vig.info.riding || vig.info.carriage ? 3.2 : 1.8); paint(ts); }
    vig.raf = requestAnimationFrame(loop);
  }
  function paint(ts) {
    vig.last = ts;
    const c = vig.canvas, info = vig.info, pixel = ART.style() === "pixel";
    const g0 = c.getContext("2d"), dpr = c.width / VW;
    let g = g0, small = null;
    if (pixel) { small = paint.small || (paint.small = document.createElement("canvas")); small.width = VW / 3; small.height = VH / 3; g = small.getContext("2d"); g.setTransform(1 / 3, 0, 0, 1 / 3, 0, 0); }
    else g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const H = ART.H, [gcol, kind] = GROUND[info.ground] || GROUND.Grassland, st = info.sky || null;
    g.drawImage(skyLayer(st), 0, 0, VW, VH);
    const far = farLayer(kind, st, VW, VH), near = nearLayer(kind, VW, VH);
    const fo = (vig.off * 0.25) % VW, no = (vig.off * 0.9) % VW;
    g.drawImage(far, -fo, 0, VW * 2, VH);
    g.fillStyle = gcol; g.fillRect(0, VH * 0.7, VW, VH * 0.3);
    g.drawImage(near, -no, 0, VW * 2, VH);
    g.fillStyle = "rgba(185,169,141,0.9)"; g.fillRect(0, VH * 0.8, VW, 8); g.strokeStyle = PAL.ink; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, VH * 0.8); g.lineTo(VW, VH * 0.8); g.moveTo(0, VH * 0.8 + 8); g.lineTo(VW, VH * 0.8 + 8); g.stroke();
    g.fillStyle = "rgba(59,44,30,0.35)"; for (let x = -(vig.off % 22); x < VW; x += 22) g.fillRect(x, VH * 0.8 + 3.5, 8, 1.2);   // ruts in the road
    if (st && typeof SKY !== "undefined") g.drawImage(overLayer(st), 0, 0, VW, VH);
    // your party and followers walk (or ride) a step behind you: one line for a few, two staggered lines for a big party (up to 10)
    const co = (info.company || []).slice(0, 15), big = co.length > 4, cols = big ? Math.ceil(co.length / 2) : co.length, tags = [];
    const p = Math.max(0, Math.min(1, info.progress || 0)), room = Math.min(big ? 5 : 3, cols) * (big ? 26 : 30), x = 40 + room + p * (VW - 110 - room);   // leave room behind you for your company
    const step = big ? Math.min(1, (x - 30) / (cols * 26 + 12)) : 1;   // up to 8 heroes and their followers: bunch up so everyone fits
    const spots = co.map((m, i) => { const c = big ? Math.floor(i / 2) : i, row = big ? i % 2 : 0;
      return { m, i, row, cx: x - (info.riding || info.carriage ? 16 : 0) - (big ? ((m.riding ? 30 : 22) * (c + 1) + row * 12) * step : (m.riding ? 34 : 24) * (i + 1) * 1.1), cy: VH * 0.8 + 6 - (big ? row * 7 : (i % 2) * 2) }; });
    for (const sp of [...spots.filter((q) => q.row === 1), ...spots.filter((q) => q.row === 0)]) {   // back line first
      const { m, i, row, cx, cy } = sp;
      if (cx < -20) continue;
      const sc = row ? 1.02 : 1.2;
      g.save(); g.translate(cx, cy); g.scale(sc, sc);
      walker(g, H, 0, 0, vig.off * 0.35 + (i + 1) * 1.7, m.look, m.riding, false, m.horse); g.restore();
      if (!big || row === 0) tags.push([m.name, cx, cy - (m.riding ? 60 : 50) * sc / 1.2 - (big && Math.floor(i / 2) % 2 ? 12 : 0), m.follower, false]);   // a big company: names on the front line, staggered
    }
    g.save(); g.translate(x, VH * 0.8 + 6); g.scale(1.35, 1.35);
    walker(g, H, 0, 0, vig.off * 0.35, info.look, info.riding, info.carriage, info.horse); g.restore();
    if (co.length) tags.push(["You", x, VH * 0.8 + 6 - (info.riding ? 68 : 56), false, true]);
    // where you're heading: a little signpost at the right edge
    g.fillStyle = PAL.wood; g.fillRect(VW - 30, VH * 0.48, 2.4, VH * 0.34); H.poly(g, [[VW - 44, VH * 0.48], [VW - 16, VH * 0.48], [VW - 11, VH * 0.53], [VW - 16, VH * 0.58], [VW - 44, VH * 0.58]], "#c9a75e", PAL.ink, 1);
    g.strokeStyle = PAL.ink; g.lineWidth = 2; g.strokeRect(1, 1, VW - 2, VH - 2);
    if (pixel) { g0.setTransform(1, 0, 0, 1, 0, 0); g0.imageSmoothingEnabled = false; g0.clearRect(0, 0, c.width, c.height); g0.drawImage(small, 0, 0, c.width, c.height); c.style.imageRendering = "pixelated"; }
    else c.style.imageRendering = "";
    if (tags.length) { g0.setTransform(dpr, 0, 0, dpr, 0, 0); for (const t of tags) nameTag(g0, ...t); }   // names stay crisp in both styles
  }
  function nameTag(g, name, x, y, follower, you) {
    if (!name) return;
    y = Math.max(8, y);
    g.save(); g.font = `600 ${you ? 9 : 8}px "Barlow Semi Condensed", sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    const w = g.measureText(name).width + 8;
    g.fillStyle = "rgba(14,15,18,0.72)"; g.fillRect(x - w / 2, y - 6, w, 12);
    g.strokeStyle = you ? "rgba(214,178,94,0.9)" : follower ? "rgba(180,170,150,0.6)" : "rgba(143,224,138,0.8)"; g.lineWidth = 0.8; g.strokeRect(x - w / 2 + 0.4, y - 5.6, w - 0.8, 11.2);
    g.fillStyle = you ? "#f0d890" : follower ? "#e4dccb" : "#c8f0c0"; g.fillText(name, x, y + 0.5);
    g.restore();
  }
  /* for tests: paint a frame without a host */
  function vignetteFrame(info, off = 0) { const c = document.createElement("canvas"); const save = vig; vig = { canvas: c, info, last: 0, off, raf: 0 }; c.width = VW; c.height = VH; paint(0); vig = save; return c; }

  return { FESTS, festId, force, festDecor, festSection, cast, state, mapUnder, mapOver, vignette, vignetteFrame, walker, horse, VW, VH };
})();
