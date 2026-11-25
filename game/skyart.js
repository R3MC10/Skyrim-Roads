/* Sky: one place that knows what the sky looks like right now (time of day, season, weather, wind, moons) and how to
   paint it, so fight scenes, road events, place pictures, the top bar and the map all agree. [OURS]
     SKY.state(pos, t)            → { tod, season, month, weather, wind, moon, north, cold, snow, key }
     SKY.make({ tod, season, weather, north })  → the same shape, for fixed pictures and tests
     SKY.backdrop(g, H, w, h, st, { horizon, seed })   sky gradient, sun / moons / stars / aurora, clouds
     SKY.overlay(g, H, w, h, st, { seed, ground })     light tint + weather + seasonal touches (static, for cached pictures)
     SKY.snowCover(g, w, h, groundY, amount, seed)    patchy snow on the ground
     SKY.particles(st, w, h, { reduce })              → { step(g, dt) } moving snow / rain / leaves / fireflies (fight replays)
     SKY.icon(st, size)           → <img> HTML for the top bar (cached) */
const SKY = (() => {
  const TODS = ["dawn", "day", "dusk", "night"], SEASONS = ["winter", "spring", "summer", "autumn"];
  const COLD_HOLDS = ["Winterhold", "The Pale", "Eastmarch"];
  const hash = (str) => { let x = 2166136261; for (const c of String(str)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x / 4294967296; };
  const seeded = (s) => (typeof ART !== "undefined" ? ART.seeded(s) : () => Math.random());
  const WIND = { clear: 0.2, cloudy: 0.35, fog: 0.05, rain: 0.5, storm: 0.9, snow: 0.4, blizzard: 1, ashstorm: 0.9 };

  function todOf(hour) { return hour >= 20 || hour < 5 ? "night" : hour < 8 ? "dawn" : hour < 18 ? "day" : "dusk"; }
  function snowAmount(st) {
    let a = st.weather === "blizzard" ? 0.95 : st.weather === "snow" ? 0.75 : 0;
    const base = { winter: st.cold ? 0.9 : 0.6, autumn: st.cold ? 0.45 : 0.08, spring: st.cold ? 0.35 : 0, summer: st.cold ? 0.2 : 0 }[st.season] || 0;
    return Math.max(a, base);
  }
  function finish(st) {
    st.wind = WIND[st.weather] ?? 0.2;
    st.snow = snowAmount(st);
    st.key = `${st.tod}|${st.season}|${st.weather}|${st.north ? 1 : 0}|${st.cold ? 1 : 0}|${st.moon}`;
    return st;
  }
  /* what the sky is doing at a spot on the map, right now (or at time t) */
  function state(pos, t) {
    let hour = 12, day = 1, season = "summer", month = "", weather = "clear", hold = "";
    try {
      t = t ?? G.now();
      const c = G.clock(t); hour = c.hour; day = c.day;
      if (typeof WEVENTS !== "undefined") { const d = WEVENTS.date(t); season = d.season; month = d.month; if (pos) weather = WEVENTS.weather(pos, t).id; }
      if (pos) hold = G.holdAt(pos);
    } catch { /* not ready yet: a plain summer day */ }
    return finish({ tod: todOf(hour), hour, season, month, weather, hold, north: !!pos && pos[1] < 0.42, cold: COLD_HOLDS.includes(hold), moon: ((day % 8) + 8) % 8 });
  }
  function make(o = {}) {
    const tod = o.tod || "day", hour = o.hour ?? { dawn: 6.5, day: 13, dusk: 19, night: 23 }[tod];
    return finish({ tod, hour, season: o.season || "summer", month: o.month || "", weather: o.weather || "clear", hold: o.hold || "", north: !!o.north, cold: !!o.cold, moon: o.moon ?? 4 });
  }

  /* the state at a spot, with fixed overrides (mood/tod, weather, season) for pictures and tests */
  function forOpts(pos, o = {}) {
    const st = state(pos), tod = o.tod || { day: "day", night: "night", dusk: "dusk", dawn: "dawn" }[o.mood];
    return finish({ ...st, ...(tod && tod !== st.tod ? { tod, hour: make({ tod }).hour } : {}), ...(o.weather ? { weather: o.weather } : {}), ...(o.season ? { season: o.season } : {}) });
  }
  const mood = (st) => (st.tod === "night" ? "night" : st.tod === "day" ? "day" : "dusk");   // the older three-way look used by some drawers

  // ---------------------------------------------------------------- the sky
  const GRAD = {
    day: ["#93b2c6", "#e8dcc0"], dawn: ["#5e6488", "#efb98c"], dusk: ["#3f3558", "#e59a5c"], night: ["#0e1521", "#2b3a4e"],
  };
  const DULL = { cloudy: 0.35, fog: 0.5, rain: 0.55, storm: 0.75, snow: 0.45, blizzard: 0.7, ashstorm: 0.7 };
  function mix(a, b, k) {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, "0")).join("");
  }
  function skyColors(st) {
    let [top, bot] = GRAD[st.tod] || GRAD.day;
    const k = DULL[st.weather] || 0;
    if (k) { const grey = st.tod === "night" ? "#1d222a" : st.weather === "storm" ? "#4c535b" : st.weather === "snow" || st.weather === "blizzard" ? "#c9d0d6" : "#8e969c"; top = mix(top, grey, k); bot = mix(bot, st.tod === "night" ? "#262c34" : "#cfcbc2", k * 0.8); }
    return [top, bot];
  }
  function cloud(g, H, x, y, s, fill, alpha) {
    g.save(); g.globalAlpha = alpha; g.fillStyle = fill;
    g.beginPath(); g.ellipse(x, y, 26 * s, 9 * s, 0, 0, 7); g.ellipse(x - 14 * s, y + 2 * s, 14 * s, 7 * s, 0, 0, 7); g.ellipse(x + 15 * s, y + 1 * s, 16 * s, 7.5 * s, 0, 0, 7); g.ellipse(x + 3 * s, y - 6 * s, 14 * s, 8 * s, 0, 0, 7); g.fill();
    g.globalAlpha = alpha * 0.35; g.strokeStyle = "#3b2c1e"; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 30 * s, y + 7 * s); g.lineTo(x + 30 * s, y + 7 * s); g.stroke();
    g.restore();
  }
  function moon(g, x, y, r, phase, tint) {   // phase 0..7: 0 new, 4 full
    g.save();
    const lit = Math.abs(4 - phase) / 4;   // 0 full .. 1 new
    g.fillStyle = tint; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    if (lit > 0.05) { g.fillStyle = "rgba(14,21,33,0.85)"; g.beginPath(); g.arc(x + (phase < 4 ? -1 : 1) * r * (1.1 - lit * 0.9), y, r * 1.02, 0, 7); g.fill(); }
    g.restore();
  }
  function backdrop(g, H, w, h, st, opts = {}) {
    const hz = (opts.horizon ?? 0.62) * h, seed = opts.seed || "sky", r = seeded(seed + st.key);
    const [top, bot] = skyColors(st);
    const gr = g.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const overcast = ["cloudy", "rain", "storm", "snow", "blizzard", "fog"].includes(st.weather);
    // the sun, low at dawn and dusk
    if (st.tod !== "night" && !["storm", "blizzard", "fog"].includes(st.weather)) {
      const p = Math.min(1, Math.max(0, (st.hour - 5) / 16)), sx = w * (0.1 + p * 0.8), sy = hz * (0.95 - Math.sin(p * Math.PI) * 0.75);
      const col = st.tod === "day" ? "255,244,206" : "255,190,120";
      const gl = g.createRadialGradient(sx, sy, 2, sx, sy, h * 0.4); gl.addColorStop(0, `rgba(${col},${overcast ? 0.25 : 0.55})`); gl.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gl; g.fillRect(0, 0, w, hz);
      if (!overcast) { g.fillStyle = st.tod === "day" ? "#fff6d8" : "#ffcf8f"; g.beginPath(); g.arc(sx, sy, Math.max(5, h * 0.045), 0, 7); g.fill(); }
    }
    if (st.tod === "night" || st.tod === "dusk") {
      // stars, fewer through cloud
      const n = st.tod === "dusk" ? 10 : overcast ? 8 : 46;
      g.fillStyle = "#f4f6f8";
      for (let i = 0; i < n; i++) { const a = 0.4 + r() * 0.6; g.globalAlpha = a * (st.tod === "dusk" ? 0.5 : 1); const s = r() < 0.12 ? 1.8 : 1.1; g.fillRect(r() * w, r() * hz * 0.85, s, s); }
      g.globalAlpha = 1;
    }
    if (st.tod === "night") {
      // the aurora, in the north on clear cold nights
      if (st.north && !["rain", "storm", "fog", "blizzard"].includes(st.weather) && (st.season === "winter" || st.season === "autumn" || st.cold)) {
        g.save(); g.globalCompositeOperation = "lighter";
        for (let b = 0; b < 3; b++) {
          const y0 = hz * (0.18 + b * 0.12), amp = h * 0.05, ph = r() * 6;
          for (let x = 0; x < w; x += 3) {
            const y = y0 + Math.sin(x / w * 6 + ph) * amp + Math.sin(x / w * 17 + ph) * amp * 0.25, len = h * (0.12 + 0.06 * Math.sin(x / w * 9 + b));
            const ag = g.createLinearGradient(0, y - len, 0, y);
            ag.addColorStop(0, "rgba(80,255,180,0)"); ag.addColorStop(1, b === 1 ? "rgba(150,110,255,0.16)" : "rgba(90,240,170,0.2)");
            g.fillStyle = ag; g.fillRect(x, y - len, 3, len);
          }
        }
        g.restore();
      }
      // Masser and Secunda
      if (!["storm", "blizzard", "fog"].includes(st.weather)) {
        const mx = w * 0.78, my = hz * 0.28, mr = Math.max(7, h * 0.07);
        { const gl = g.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3.5); gl.addColorStop(0, "rgba(240,220,210,0.22)"); gl.addColorStop(1, "rgba(240,220,210,0)"); g.fillStyle = gl; g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8); }
        moon(g, mx, my, mr, st.moon, "#efd6cf");
        moon(g, mx - mr * 2.4, my + mr * 0.9, mr * 0.45, (st.moon + 3) % 8, "#e8eef4");
      }
    }
    // clouds
    const nc = { clear: 2, cloudy: 6, rain: 8, storm: 9, snow: 6, blizzard: 4, fog: 0 }[st.weather] ?? 2;
    const cf = st.tod === "night" ? (st.weather === "storm" ? "#1a1e24" : "#2c3440") : st.weather === "storm" ? "#5a6168" : st.weather === "rain" ? "#7c858c" : st.tod === "dusk" ? "#c98a72" : st.tod === "dawn" ? "#d9b0a0" : "#f4f2ea";
    for (let i = 0; i < nc; i++) cloud(g, H, r() * w, hz * (0.12 + r() * 0.45), (0.5 + r() * 0.6) * (h / 160), cf, st.weather === "clear" ? 0.55 : 0.8);
  }

  // ---------------------------------------------------------------- weather and season over a picture
  function snowCover(g, w, h, groundY, amount, seed = "snow") {
    if (!(amount > 0.05)) return;
    const r = seeded(seed + "cov");
    g.save(); g.fillStyle = "#f2f5f7"; g.globalAlpha = Math.min(0.95, 0.35 + amount * 0.6);
    const n = Math.round(6 + amount * 16);
    for (let i = 0; i < n; i++) { const x = r() * w, y = groundY + r() * (h - groundY) * 0.95, rw = 14 + r() * 40 * amount, rh = 2 + r() * 4; g.beginPath(); g.ellipse(x, y, rw, rh, 0, 0, 7); g.fill(); }
    if (amount > 0.6) { g.globalAlpha = 0.55 * amount; g.fillRect(0, groundY, w, 3); }
    g.restore();
  }
  function tint(g, w, h, st) {
    if (st.tod === "night") { g.fillStyle = "rgba(18,24,42,0.42)"; g.fillRect(0, 0, w, h); }
    else if (st.tod === "dusk") { g.fillStyle = "rgba(196,87,46,0.13)"; g.fillRect(0, 0, w, h); }
    else if (st.tod === "dawn") { g.fillStyle = "rgba(230,150,140,0.09)"; g.fillRect(0, 0, w, h); }
  }
  function leaf(g, x, y, a, c, s = 1) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = c; g.beginPath(); g.moveTo(0, -3 * s); g.quadraticCurveTo(2.6 * s, 0, 0, 3 * s); g.quadraticCurveTo(-2.6 * s, 0, 0, -3 * s); g.fill(); g.restore(); }
  function overlay(g, H, w, h, st, opts = {}) {
    const seed = opts.seed || "ov", r = seeded(seed + st.key + "o"), gy = opts.ground ?? h * 0.62;
    if (opts.cover !== false) snowCover(g, w, h, gy, st.snow, seed);
    tint(g, w, h, st);
    const wind = st.wind;
    const falling = opts.weather !== false;   // false: snowflakes and raindrops move elsewhere (fight replays); haze and fog stay
    if (st.weather === "snow" || st.weather === "blizzard") {
      g.fillStyle = "rgba(255,255,255,0.92)"; const n = st.weather === "blizzard" ? 140 : 60;
      if (falling) { const ps = []; for (let i = 0; i < n; i++) { const s = 1 + r() * 1.2; ps.push({ x: r() * w, y: r() * h, s }); } flakes(g, ps, 1); }   // soft round flakes, not squares
      if (st.weather === "blizzard") { g.fillStyle = "rgba(232,238,242,0.38)"; g.fillRect(0, 0, w, h); }
    }
    if (st.weather === "rain" || st.weather === "storm") {
      g.strokeStyle = "rgba(200,214,224,0.55)"; g.lineWidth = 1;
      if (falling) for (let i = 0; i < (st.weather === "storm" ? 90 : 60); i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2 - wind * 6, y + 9); g.stroke(); }
      g.fillStyle = st.weather === "storm" ? "rgba(34,40,52,0.24)" : "rgba(40,50,60,0.14)"; g.fillRect(0, 0, w, h);
      if (falling && st.weather === "storm" && hash(seed + st.key) < 0.5) {   // a frozen lightning bolt in some pictures
        const x0 = w * (0.2 + hash(seed) * 0.6); g.strokeStyle = "rgba(235,240,255,0.85)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, 0);
        let x = x0; for (let y = 0; y < gy * 0.8; y += 10) { x += (r() - 0.5) * 14; g.lineTo(x, y); } g.stroke();
      }
    }
    if (st.weather === "fog") {
      const gr = g.createLinearGradient(0, h * 0.25, 0, h); gr.addColorStop(0, "rgba(226,228,228,0.12)"); gr.addColorStop(1, "rgba(226,228,228,0.7)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    if (st.weather === "cloudy") { g.fillStyle = "rgba(120,128,136,0.12)"; g.fillRect(0, 0, w, h); }
    if (st.weather === "ashstorm") {   // Solstheim: grey ash driven sideways, the light gone brown
      g.fillStyle = "rgba(96,82,70,0.34)"; g.fillRect(0, 0, w, h);
      if (falling) { g.strokeStyle = "rgba(70,62,56,0.6)"; g.lineWidth = 1.2; for (let i = 0; i < 90; i++) { const x = r() * w, y = r() * h, l = 5 + r() * 8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + l * 0.25); g.stroke(); } }
    }
    // seasons, when the weather lets them show
    if (!["rain", "storm", "snow", "blizzard", "ashstorm"].includes(st.weather) && opts.season !== false && falling) {
      if (st.season === "autumn" && !st.cold) for (let i = 0; i < 16; i++) leaf(g, r() * w, gy * 0.3 + r() * (h - gy * 0.3), r() * 6, ["#c4572e", "#e8923a", "#d6b25e", "#a8622e"][i % 4], 1 + r() * 0.5);
      if (st.season === "spring" && st.tod !== "night") for (let i = 0; i < 14; i++) { g.fillStyle = i % 3 ? "rgba(248,214,226,0.9)" : "rgba(255,255,255,0.9)"; g.beginPath(); g.arc(r() * w, gy * 0.4 + r() * (h - gy * 0.4), 1.3 + r(), 0, 7); g.fill(); }
      if (st.season === "summer" && st.tod === "day") { g.fillStyle = "rgba(255,246,196,0.7)"; for (let i = 0; i < 10; i++) g.fillRect(r() * w, gy * 0.5 + r() * (h - gy * 0.5), 1.4, 1.4); }
      if ((st.season === "summer" || st.season === "spring") && (st.tod === "night" || st.tod === "dusk")) for (let i = 0; i < 12; i++) { const x = r() * w, y = gy * 0.7 + r() * (h - gy * 0.7); const gl = g.createRadialGradient(x, y, 0, x, y, 5); gl.addColorStop(0, "rgba(230,255,140,0.9)"); gl.addColorStop(1, "rgba(230,255,140,0)"); g.fillStyle = gl; g.fillRect(x - 5, y - 5, 10, 10); }
      if (st.season === "winter" && st.tod === "night") { g.fillStyle = "rgba(235,240,246,0.16)"; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(r() * w, h * (0.82 + r() * 0.15), 30 + r() * 40, 5 + r() * 4, 0, 0, 7); g.fill(); } }
    }
  }

  /* [fightdeclutter] soft round snowflakes in three sizes (small ones fainter, like they're further off), each with a
     faint halo; zk = screen pixels per drawing unit, so they keep the same size on a phone and on a big PC window */
  const FLAKE = [[1.4, 0.9, 0.55], [1.8, 1.4, 0.75], [9, 2.1, 0.9]];   // [p.s below, radius in screen px, alpha]
  function flakes(g, parts, zk = 1) {
    let lo = 0;
    for (const [top, rad, al] of FLAKE) {
      const rr = rad / zk;
      for (const [k, a] of [[2.1, al * 0.22], [1, al]]) {
        g.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; g.beginPath();
        for (const p of parts) if (p.s >= lo && p.s < top) { const r2 = rr * k; g.moveTo(p.x + r2, p.y); g.arc(p.x, p.y, r2, 0, 6.2832); }
        g.fill();
      }
      lo = top;
    }
  }

  // ---------------------------------------------------------------- moving weather for fight replays
  function particles(st, w, h, opts = {}) {
    const reduce = !!opts.reduce, r = seeded("pt" + st.key), parts = [];
    const kind = st.weather === "snow" || st.weather === "blizzard" ? "snow" : st.weather === "rain" || st.weather === "storm" ? "rain" : st.weather === "ashstorm" ? "ash" : st.weather === "fog" ? "mist"
      : st.season === "autumn" && !st.cold && st.weather !== "fog" ? "leaf" : (st.season === "summer" || st.season === "spring") && (st.tod === "night" || st.tod === "dusk") ? "fly"
      : st.season === "spring" && st.tod !== "night" ? "petal" : null;
    if (!kind) return { kind: null, step() {} };
    const n = { snow: st.weather === "blizzard" ? 90 : 45, rain: st.weather === "storm" ? 70 : 45, ash: 110, mist: 8, leaf: 12, fly: 10, petal: 14 }[kind];
    for (let i = 0; i < n; i++) parts.push({ x: r() * w, y: r() * h, v: 0.6 + r() * 0.8, a: r() * 6, s: 1 + r() * 1.2, c: ["#c4572e", "#e8923a", "#d6b25e"][i % 3] });
    let flash = 0, tt = 0;
    const wind = st.wind;
    return {
      kind,
      step(g, dt = 1 / 60) {
        tt += dt;
        if (!reduce) for (const p of parts) {
          if (kind === "snow") { p.y += (18 + 30 * p.v) * dt * (1 + wind); p.x += (Math.sin(tt * 1.5 + p.a) * 8 + wind * 40) * dt; }
          else if (kind === "rain") { p.y += 320 * p.v * dt; p.x -= (40 + wind * 90) * dt; }
          else if (kind === "ash") { p.x += (90 + 60 * p.v) * dt * (0.5 + wind); p.y += (10 + Math.sin(tt * 2 + p.a) * 14) * dt; }
          else if (kind === "mist") { p.x += (6 + 8 * p.v) * dt; p.y += Math.sin(tt * 0.3 + p.a) * 2 * dt; }
          else if (kind === "leaf" || kind === "petal") { p.y += 20 * p.v * dt; p.x += (Math.sin(tt + p.a) * 14 + 10) * dt; p.a += dt * 2; }
          else { p.x += Math.sin(tt * 0.7 + p.a) * 10 * dt; p.y += Math.cos(tt * 0.6 + p.a) * 6 * dt; }
          if (p.y > h) { p.y -= h; p.x = Math.random() * w; } if (p.x < -10) p.x += w + 20; if (p.x > w + 10) p.x -= w + 20;
        }
        g.save();
        // opts.scale(): screen pixels per drawing unit. A small stage blown up to a wide PC window keeps flakes and
        // raindrops their phone size (round, not big squares)
        const zk = opts.scale ? Math.max(1, opts.scale() || 1) : 1, big = zk > 1.4;
        if (kind === "snow") flakes(g, parts, zk);
        else if (kind === "rain") { g.strokeStyle = "rgba(205,218,230,0.6)"; g.lineWidth = big ? 1.5 / zk : 1; g.beginPath(); for (const p of parts) { g.moveTo(p.x, p.y); g.lineTo(p.x - 2 - wind * 5, p.y + 8); } g.stroke(); }
        else if (kind === "ash") { for (const p of parts) { g.fillStyle = p.s > 1.6 ? "rgba(60,52,46,0.75)" : "rgba(120,110,100,0.6)"; g.fillRect(p.x, p.y, p.s * 2.2, p.s * 1.4); } }
        else if (kind === "mist") { for (const p of parts) { const rr = (40 + p.s * 40) * (w / 400); const gr = g.createRadialGradient(p.x, p.y * 0.6 + h * 0.35, 0, p.x, p.y * 0.6 + h * 0.35, rr); gr.addColorStop(0, "rgba(222,228,232,0.32)"); gr.addColorStop(1, "rgba(220,226,230,0)"); g.fillStyle = gr; g.fillRect(p.x - rr, p.y * 0.6 + h * 0.35 - rr, rr * 2, rr * 2); } }
        else if (kind === "leaf") for (const p of parts) leaf(g, p.x, p.y, p.a, p.c, p.s);
        else if (kind === "petal") { for (const p of parts) { g.fillStyle = "rgba(248,214,226,0.9)"; g.beginPath(); g.arc(p.x, p.y, 1.2 * p.s, 0, 7); g.fill(); } }
        else for (const p of parts) { const a = reduce ? 0.8 : 0.4 + 0.6 * Math.abs(Math.sin(tt * 2 + p.a)); g.globalAlpha = a; g.fillStyle = "#eaff9a"; g.beginPath(); g.arc(p.x, p.y, 1.6, 0, 7); g.fill(); }
        g.globalAlpha = 1;
        if (st.weather === "storm" && !reduce) {
          if (flash <= 0 && Math.random() < dt * 0.35) flash = 1;
          if (flash > 0) { g.fillStyle = `rgba(235,240,255,${0.35 * flash})`; g.fillRect(0, 0, w, h); flash -= dt * 4; }
        }
        g.restore();
      },
    };
  }

  // ---------------------------------------------------------------- the little weather picture in the top bar
  function drawIcon(g, H, w, h, st) {
    const cx = w / 2, cy = h / 2, R = w * 0.22, ink = "#3b2c1e";
    const night = st.tod === "night";
    if (!["storm", "blizzard", "fog", "rain"].includes(st.weather) || st.weather === "cloudy") {
      if (night) {
        g.fillStyle = "#efd6cf"; g.beginPath(); g.arc(cx - w * 0.08, cy - h * 0.06, R, 0, 7); g.fill(); g.strokeStyle = ink; g.lineWidth = 1; g.stroke();
        g.fillStyle = "#1c2128"; g.beginPath(); g.arc(cx - w * 0.08 + R * (st.moon < 4 ? -0.7 : 0.7) * (Math.abs(4 - st.moon) / 4 + 0.1), cy - h * 0.06, R * (Math.abs(4 - st.moon) > 0.5 ? 1 : 0), 0, 7); g.fill();
      } else {
        const sun = st.tod === "day" ? "#f2c14e" : "#e8923a";
        g.strokeStyle = sun; g.lineWidth = 1.6; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(cx - w * 0.08 + Math.cos(a) * R * 1.3, cy - h * 0.06 + Math.sin(a) * R * 1.3); g.lineTo(cx - w * 0.08 + Math.cos(a) * R * 1.75, cy - h * 0.06 + Math.sin(a) * R * 1.75); g.stroke(); }
        g.fillStyle = sun; g.beginPath(); g.arc(cx - w * 0.08, cy - h * 0.06, R, 0, 7); g.fill(); g.strokeStyle = ink; g.lineWidth = 1; g.stroke();
      }
    }
    if (st.weather !== "clear") {
      const cc = st.weather === "storm" ? "#6a7178" : st.weather === "rain" ? "#9aa3aa" : "#e6e8ea";
      g.fillStyle = cc; g.strokeStyle = ink; g.lineWidth = 1;
      g.beginPath(); g.ellipse(cx + w * 0.06, cy + h * 0.06, w * 0.3, h * 0.15, 0, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.arc(cx - w * 0.04, cy + h * 0.0, w * 0.14, 0, 7); g.arc(cx + w * 0.14, cy - h * 0.02, w * 0.16, 0, 7); g.fill();
      if (st.weather === "rain" || st.weather === "storm") { g.strokeStyle = "#5f8797"; g.lineWidth = 1.4; for (let i = 0; i < 3; i++) { const x = cx - w * 0.12 + i * w * 0.14; g.beginPath(); g.moveTo(x, cy + h * 0.24); g.lineTo(x - 2, cy + h * 0.38); g.stroke(); } }
      if (st.weather === "storm") { g.fillStyle = "#f2c14e"; g.beginPath(); g.moveTo(cx + w * 0.06, cy + h * 0.2); g.lineTo(cx - w * 0.02, cy + h * 0.36); g.lineTo(cx + w * 0.04, cy + h * 0.34); g.lineTo(cx - w * 0.02, cy + h * 0.48); g.lineTo(cx + w * 0.12, cy + h * 0.3); g.lineTo(cx + w * 0.06, cy + h * 0.32); g.closePath(); g.fill(); }
      if (st.weather === "snow" || st.weather === "blizzard") { g.fillStyle = "#ffffff"; g.strokeStyle = "#5f8797"; for (let i = 0; i < 3; i++) { const x = cx - w * 0.12 + i * w * 0.14, y = cy + h * 0.32; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); g.stroke(); } }
      if (st.weather === "fog") { g.strokeStyle = "#c8ccd0"; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - w * 0.3, cy + h * (0.2 + i * 0.1)); g.lineTo(cx + w * 0.3, cy + h * (0.2 + i * 0.1)); g.stroke(); } }
    }
  }
  function icon(st, size = 22) {
    if (typeof ART === "undefined") return "";
    return ART.html(size, size, (g, H, w, h) => drawIcon(g, H, w, h, st), { key: `skyicon|${st.tod}|${st.weather}|${st.moon}`, cls: `skyic wx-${st.weather} tod-${st.tod}`, alt: `${st.tod}, ${st.weather}` });
  }

  return { TODS, SEASONS, state, make, forOpts, mood, backdrop, overlay, snowCover, particles, icon, drawIcon, skyColors, todOf };
})();
