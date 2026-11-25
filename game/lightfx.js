/* Lighting and atmosphere [OURS]: a light pass over the world map and the place pictures.
     time-of-day colour grade (golden hour, blue night, grey storms), warm light from towns, farms, camps and forts at
     night (added light, so it glows instead of covering), light shafts at dawn and dusk, drifting fog banks over
     valleys and lakes, a slow cloud-shadow layer with parallax, water that catches the sun or the moons, aurora light
     on the northern snow, and a soft vignette.
   Settings → Graphics → Lighting: Off / Low / High (prefs key "lighting", default High).
     Low  = grade, glows, shafts, vignette (still pictures, nothing moves)
     High = Low + fog banks, cloud-shadow parallax, shimmering water and aurora, flickering fires
   Cheap on phones: every layer is drawn once into a small offscreen canvas and only rebuilt when the light changes a
   step (time of day, weather, places found, screen size); each map frame just stamps a few of them.
   Reduce motion freezes the drifting; high contrast tones the grade down and drops vignette and fog.
     LIGHTFX.map(g, canvas, v, o)       map.js, right after the painted map, fog of war and clan tints (under markers)
     LIGHTFX.picture(g, w, h, st, opts) placeart.js, a cached place picture (st = SKY state)
     LIGHTFX.key()                      add to picture cache keys */
const LIGHTFX = (() => {
  const KEY = "rotn_prefs", LEVELS = ["off", "low", "high"];
  let lvlCache = null;
  function level() {
    if (lvlCache) return lvlCache;
    let v = "high";
    try { const p = JSON.parse(localStorage.getItem(KEY) || "{}").lighting; if (LEVELS.includes(p)) v = p; } catch { /* storage blocked */ }
    return (lvlCache = v);
  }
  const on = () => level() !== "off";
  const hc = () => typeof document !== "undefined" && !!document.documentElement && document.documentElement.classList.contains("a11y-hc");
  const key = () => (on() ? level() + (hc() ? "h" : "") : "off");
  function setLevel(v) {
    if (!LEVELS.includes(v)) return;
    try { const p = JSON.parse(localStorage.getItem(KEY) || "{}"); p.lighting = v; localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
    lvlCache = v; reset();
    if (typeof ART !== "undefined" && ART.clear) ART.clear();   // place pictures rebuild with the new light
  }

  // ---------------------------------------------------------------- small helpers
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const q = (x, n = 10) => Math.round(x * n) / n;   // light steps: layers rebuild only when a step changes
  function mk(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  const seeded = (s) => (typeof ART !== "undefined" ? ART.seeded(s) : (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })());

  // ---------------------------------------------------------------- what the light is doing
  const GREY = { storm: 1, rain: 0.65, cloudy: 0.35, fog: 0.45, blizzard: 0.6, snow: 0.3, ashstorm: 0.85 };
  /* hour (0..24, fractional) + weather → the numbers every layer uses */
  function light(hour, weather, extra = {}) {
    const h = ((hour % 24) + 24) % 24, wx = weather || "clear", grey = GREY[wx] || 0;
    const night = h < 12 ? 1 - smooth(4.6, 7, h) : smooth(18.6, 21, h);
    const dawn = Math.exp(-(((h - 6.4) / 1.15) ** 2)), dusk = Math.exp(-(((h - 19) / 1.25) ** 2));
    const gold = Math.max(dawn, dusk) * (1 - night * 0.55) * (1 - grey * 0.85);
    // the multiply grade: white = untouched
    let mul = [255, 255, 255];
    mul = mix(mul, wx === "ashstorm" ? [176, 152, 128] : [146, 152, 166], grey * 0.55);
    mul = mix(mul, dawn > dusk ? [255, 218, 204] : [255, 208, 164], gold * 0.45);
    mul = mix(mul, [84, 104, 162], night * 0.8);
    if (wx === "snow" || wx === "blizzard") mul = mix(mul, [226, 238, 255], 0.35);
    const warm = gold * 0.08;                                     // a warm lift on top (added light)
    const desat = grey >= 0.45 ? (grey - 0.3) * 0.5 : 0;          // storms wash the colour out
    const lights = Math.max(night, grey * 0.35 * (1 - night), Math.max(dawn, dusk) * 0.3);   // lamps are lit at night, in storms and at dusk
    const moon = extra.moon ?? 4, moonFull = 1 - Math.abs(moon - 4) / 4;
    const clearSky = !["rain", "storm", "fog", "blizzard", "ashstorm"].includes(wx);
    const shimSun = (1 - night) * (0.22 + 0.55 * gold) * (1 - grey * 0.9);
    const shimMoon = night * 0.42 * (0.3 + 0.7 * moonFull) * (clearSky ? 1 : 0.25);
    const shimCol = shimMoon > shimSun ? [170, 198, 255] : mix([255, 248, 226], [255, 178, 92], gold);
    const aurora = clearSky && wx !== "snow" ? smooth(0.45, 0.9, night) * (extra.auroraBoost ?? 1) : 0;
    const fog = wx === "fog" ? 0.6 : clamp(0.1 + dawn * 0.3 + night * 0.12 + (wx === "rain" ? 0.12 : 0) + (wx === "snow" ? 0.08 : 0));
    const fogCol = mix(mix(mix([236, 238, 240], [255, 222, 196], dawn * 0.8), [118, 136, 178], night * 0.85), [150, 154, 162], grey * 0.6);
    return { h, wx, grey, night, dawn, dusk, gold, mul, warm, desat, lights, shim: Math.max(shimSun, shimMoon), shimCol, aurora, fog, fogCol, sunDir: dawn > dusk ? 1 : -1 };
  }
  function nowLight(weather) {
    let hour = 13, day = 1, season = "summer";
    try { const t = typeof G.now === "function" ? G.now() : Date.now() / 1000, c = G.clock(t); hour = c.hour; day = c.day; } catch { /* not ready */ }
    try { if (typeof WEVENTS !== "undefined" && WEVENTS.season) season = WEVENTS.season() || season; } catch { /* fine */ }
    return light(hour, weather, { moon: ((day % 8) + 8) % 8, auroraBoost: season === "winter" || season === "autumn" ? 1 : 0.7 });
  }

  // ---------------------------------------------------------------- static pieces of Skyrim, built once
  let terr = null;
  function terrain() {
    if (terr) return terr;
    const T = Terrain.T, GW = Terrain.GW, GH = Terrain.GH, grid = Terrain.grid, hg = Terrain.hgrid, r = seeded("lightfx");
    const water = [], snow = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x, t = grid[i];
      if (t === T.LAKE || t === T.RIVER || t === T.BRIDGE || (t === T.SEA && y < GH * 0.34)) water.push(i, x, y, (r() * 255) | 0, (r() * 255) | 0, t === T.SEA ? 1 : 0);
      if (y < GH * 0.46 && (t === T.SNOW || t === T.PEAK || t === T.MOUNTAIN || t === T.TUNDRA)) {
        const base = (t === T.SNOW || t === T.PEAK ? 1 : t === T.MOUNTAIN ? 0.7 : 0.4) * Math.sqrt(1 - y / (GH * 0.46));
        snow.push(i, x, y, Math.round(base * 255));
      }
    }
    // valleys: well below the highest ground around them; lakes and rivers breathe mist too
    const lmax = new Float32Array(GW * GH), tmp = new Float32Array(GW * GH), R = 6;
    if (hg) {
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { let m = 0; for (let k = -R; k <= R; k++) { const xx = x + k; if (xx >= 0 && xx < GW) m = Math.max(m, hg[y * GW + xx]); } tmp[y * GW + x] = m; }
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { let m = 0; for (let k = -R; k <= R; k++) { const yy = y + k; if (yy >= 0 && yy < GH) m = Math.max(m, tmp[yy * GW + x]); } lmax[y * GW + x] = m; }
    }
    const fc = mk(GW, GH), fg = fc.getContext("2d"), img = fg.createImageData(GW, GH), d = img.data;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x, t = grid[i];
      if (t === T.SEA || t === T.BEYOND) continue;
      let m = t === T.LAKE ? 0.85 : t === T.RIVER || t === T.BRIDGE ? 0.55 : t === T.MARSH ? 0.6 : 0;
      if (hg) m = Math.max(m, clamp((lmax[i] - hg[i] - 0.1) * 2.6, 0, 0.7));
      const n = Terrain.fbm(x / 13 + 3, y / 13 + 9, 3);
      m *= 0.25 + 0.75 * smooth(0.4, 0.62, n);
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = Math.round(m * 255);
    }
    fg.putImageData(img, 0, 0);
    const blur = mk(GW / 4, GH / 4), bg = blur.getContext("2d"); bg.imageSmoothingEnabled = true; bg.drawImage(fc, 0, 0, blur.width, blur.height);
    const fogMask = mk(GW, GH), mg = fogMask.getContext("2d"); mg.imageSmoothingEnabled = true; mg.imageSmoothingQuality = "high"; mg.drawImage(blur, 0, 0, GW, GH);
    mg.globalAlpha = 0.5; mg.drawImage(fc, 0, 0); mg.globalAlpha = 1;
    // a tileable cloud-shadow texture (wrapped value noise)
    const CS = 128, cloud = mk(CS, CS), cg = cloud.getContext("2d"), ci = cg.createImageData(CS, CS), cd = ci.data, lat = [];
    for (const n of [4, 8, 16]) { const a = []; for (let k = 0; k < n * n; k++) a.push(r()); lat.push([n, a]); }
    const at = ([n, a], x, y) => { const fx = (x / CS) * n, fy = (y / CS) * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const v = (i, j) => a[((j % n) + n) % n * n + (((i % n) + n) % n)];
      return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy; };
    for (let y = 0; y < CS; y++) for (let x = 0; x < CS; x++) {
      const n = at(lat[0], x, y) * 0.55 + at(lat[1], x, y) * 0.3 + at(lat[2], x, y) * 0.15, o = (y * CS + x) * 4;
      cd[o] = 22; cd[o + 1] = 26; cd[o + 2] = 38; cd[o + 3] = Math.round(smooth(0.5, 0.72, n) * 0.34 * 255);
    }
    cg.putImageData(ci, 0, 0);
    return (terr = { GW, GH, water, snow, fogMask, cloud });
  }

  // ---------------------------------------------------------------- cached layers
  let lay = {};
  function reset() { lay = {}; }
  const GLOW = { city: [30, [255, 176, 84], 1], town: [21, [255, 176, 84], 0.9], farm: [11, [255, 186, 104], 0.75], camp: [10, [255, 128, 48], 0.95],
    fort: [9, [255, 150, 70], 0.7], lair: [7, [255, 110, 50], 0.5], dungeon: [5, [255, 140, 64], 0.45], landmark: [6, [255, 200, 130], 0.4], shrine: [6, [255, 214, 150], 0.5] };
  const sprites = {};
  function glowSprite(col) {
    const k = col.join(","); if (sprites[k]) return sprites[k];
    const c = mk(64, 64), g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgb(mix(col, [255, 240, 200], 0.5), 1)); gr.addColorStop(0.18, rgb(col, 0.7)); gr.addColorStop(0.5, rgb(col, 0.22)); gr.addColorStop(1, rgb(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (sprites[k] = c);
  }
  /* the added light on the map, phase 0 or 1 (High crossfades the two so water shimmers and the aurora ripples) */
  const LW = 500, LH = 350;
  function worldLight(L, shown, phase, close = 0) {
    const cq = q(close, 5), TR = terrain(), k = `${phase}|${cq}|${q(L.lights)}|${q(L.shim)}|${q(L.aurora)}|${L.shimCol.map((c) => c >> 4).join(",")}|${shown.length}`;
    const slot = "wl" + phase; if (lay[slot] && lay[slot].k === k) return lay[slot].c;
    const { GW, GH } = TR, small = mk(GW, GH), sg = small.getContext("2d"), img = sg.createImageData(GW, GH), d = img.data;
    const ph = phase * 1.7;
    if (L.aurora > 0.02) {
      const s = TR.snow;
      for (let j = 0; j < s.length; j += 4) {
        const i = s[j], x = s[j + 1], y = s[j + 2], base = s[j + 3] / 255;
        const band = 0.5 + 0.5 * Math.sin(x * 0.06 + y * 0.025 + ph + Math.sin(y * 0.09 + x * 0.01) * 2.2);
        const v = band * band * L.aurora * base * 0.6, hue = (0.5 + 0.5 * Math.sin(x * 0.018 + ph * 0.6)) ** 2;   // mostly green, violet at the edges
        const o = i * 4; d[o] = 40 + 120 * hue; d[o + 1] = 255 - 150 * hue; d[o + 2] = 130 + 125 * hue; d[o + 3] = Math.round(clamp(v) * 255);
      }
    }
    if (L.shim > 0.02) {
      const w = TR.water, c = L.shimCol;
      for (let j = 0; j < w.length; j += 6) {
        const i = w[j], x = w[j + 1], y = w[j + 2], rnd = w[j + 3 + phase] / 255, sea = w[j + 5];
        const patch = 0.5 + 0.5 * Math.sin(x * 0.13 + y * 0.08 + ph * 1.3) * Math.sin(x * 0.05 - y * 0.11 + ph);
        const v = L.shim * (rnd > 0.84 ? 0.9 : 0.12) * (0.3 + 0.7 * patch) * (sea ? 0.6 : 1);
        const o = i * 4; if (v * 255 > d[o + 3]) { d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = Math.round(clamp(v) * 255); }
      }
    }
    sg.putImageData(img, 0, 0);
    const c = (lay[slot] && lay[slot].c && lay[slot].c.width === LW) ? lay[slot].c : mk(LW, LH), g = c.getContext("2d");
    g.clearRect(0, 0, LW, LH); g.globalCompositeOperation = "source-over";
    g.imageSmoothingEnabled = true; g.drawImage(small, 0, 0, LW, LH);
    if (L.lights > 0.03) {
      g.globalCompositeOperation = "lighter";
      for (const [, x, y, kind] of shown) {
        const sp = GLOW[kind]; if (!sp) continue;
        const R = sp[0] * (LW / 1000) * 2.6 * (1 - 0.62 * cq), a = sp[2] * L.lights * (1 - 0.4 * cq);   // zoomed in close: smaller, softer pools of light
        g.globalAlpha = clamp(a); g.drawImage(glowSprite(sp[1]), x * LW - R, y * LH - R * 1.05, R * 2, R * 2);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
    lay[slot] = { k, c };
    return c;
  }
  function fogLayer(L) {
    const TR = terrain(), k = `${q(L.fog, 20)}|${L.fogCol.map((c) => c >> 3).join(",")}`;
    if (lay.fog && lay.fog.k === k) return lay.fog.c;
    const c = mk(TR.GW, TR.GH), g = c.getContext("2d");
    g.fillStyle = rgb(L.fogCol, 1); g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "destination-in"; g.globalAlpha = clamp(L.fog * 1.4); g.drawImage(TR.fogMask, 0, 0); g.globalAlpha = 1;
    lay.fog = { k, c };
    return c;
  }
  /* screen-space layers, at a quarter of the screen, rebuilt only when the light steps:
       mul: the colour grade with the vignette baked in (one multiply pass)
       add: the warm golden-hour lift with the dawn/dusk light shafts (one added-light pass) */
  function screenLayers(cw, ch, L, hcOn, dpr, sol) {
    const gk = hcOn ? 0.5 : 1, m = sol ? [255, 255, 255] : mix([255, 255, 255], L.mul, gk);
    const k = `${cw}x${ch}|${m.map((c) => c >> 2).join(",")}|${q(L.night, 5)}|${q(L.grey, 5)}|${q(L.gold, 20)}|${L.sunDir}|${hcOn}|${sol}`;
    if (lay.scr && lay.scr.k === k) return lay.scr;
    const f = 0.25, bw = Math.ceil(cw * f), bh = Math.ceil(ch * f);
    let mul = null, add = null;
    if (!hcOn || m[0] + m[1] + m[2] < 762) {
      mul = mk(bw, bh); const g = mul.getContext("2d");
      g.fillStyle = rgb(m); g.fillRect(0, 0, bw, bh);
      if (!hcOn) {
        g.translate(bw / 2, bh / 2); g.scale(bw / 2, bh / 2);
        const a = 0.34 + 0.16 * L.night + 0.1 * L.grey, gr = g.createRadialGradient(0, 0, 0.55, 0, 0, 1.5);
        gr.addColorStop(0, "rgba(10,8,14,0)"); gr.addColorStop(0.45, `rgba(10,8,14,${a * 0.45})`); gr.addColorStop(1, `rgba(10,8,14,${a})`);
        g.fillStyle = gr; g.fillRect(-1, -1, 2, 2);
      }
    }
    const warm = sol ? 0 : L.warm * gk;
    if (warm > 0.01 || (L.gold > 0.06 && L.grey < 0.7)) {
      add = mk(bw, bh); const g = add.getContext("2d");
      g.globalCompositeOperation = "lighter";
      if (warm > 0.01) { g.fillStyle = rgb([255, 150, 60], warm); g.fillRect(0, 0, bw, bh); }
      if (L.gold > 0.06 && L.grey < 0.7) {
        const r = seeded("shafts" + L.sunDir);
        const sx = L.sunDir > 0 ? bw * 1.08 : -bw * 0.08, sy = -bh * 0.12, len = Math.hypot(bw, bh) * 1.4, base = Math.atan2(bh, -L.sunDir * bw * 0.9);
        const col = L.dawn > L.dusk ? [255, 206, 170] : [255, 196, 120], a = 0.3 * L.gold * (1 - L.grey);
        for (let i = 0; i < 8; i++) {
          const ang = base + (r() - 0.5) * 0.95, wd = 0.025 + r() * 0.05, ex = Math.cos(ang), ey = Math.sin(ang);
          const gr = g.createLinearGradient(sx, sy, sx + ex * len * 0.8, sy + ey * len * 0.8);
          gr.addColorStop(0, rgb(col, a * (0.5 + r() * 0.5))); gr.addColorStop(0.55, rgb(col, a * 0.25)); gr.addColorStop(1, rgb(col, 0));
          g.fillStyle = gr; g.beginPath(); g.moveTo(sx, sy);
          g.lineTo(sx + Math.cos(ang - wd) * len, sy + Math.sin(ang - wd) * len); g.lineTo(sx + Math.cos(ang + wd) * len, sy + Math.sin(ang + wd) * len); g.closePath(); g.fill();
        }
      }
    }
    lay.scr = { k, mul, add };
    return lay.scr;
  }
  /* a reusable low-res screen buffer */
  function buf(name, bw, bh) {
    let b = lay[name];
    if (!b || b.c.width !== bw || b.c.height !== bh) b = lay[name] = { c: mk(bw, bh), k: "" };
    return b;
  }

  // ---------------------------------------------------------------- the map pass
  /* o = { s, W, H, shown, view:[x0,y0,x1,y1], dpr, sol } ; g is in world coordinates when called.
     Full-screen passes per frame: Low 2 (grade + vignette, all added light), High 3 (+ mist and cloud shadows);
     storms add one (colour wash-out). The moving layers are redrawn into small buffers ~3×/s and stretched up once. */
  function map(g, canvas, v, o) {
    const lv = level(); if (lv === "off") return false;
    const close = clamp(o.close || 0);   // 0 zoomed out … 1 close up (the ink chart): the sky's light shafts and warm lift fade, fires shrink
    const L = nowLight(v.weather), hcOn = hc(), high = lv === "high", still = !!v.reduceMotion, t = still ? 0 : v.t || 0;
    const cw = canvas.width, ch = canvas.height, dpr = o.dpr || 1, f = 0.25, bw = Math.ceil(cw * f), bh = Math.ceil(ch * f);
    const T = g.getTransform(), toBuf = (bg) => bg.setTransform(T.a * f, T.b * f, T.c * f, T.d * f, T.e * f, T.f * f);
    const sl = screenLayers(cw, ch, L, hcOn, dpr, !!o.sol);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "low";   // [perf] these are soft quarter-size washes: plain smoothing looks the same and costs a fraction of "high"
    // 1) the grade and vignette, over the painted ground (the markers and names come after, so they stay readable)
    if (sl.mul) { g.globalCompositeOperation = "multiply"; g.drawImage(sl.mul, 0, 0, cw, ch); }
    if (!o.sol && L.desat > 0.02) { g.globalCompositeOperation = "saturation"; g.globalAlpha = L.desat * (hcOn ? 0.5 : 1); g.fillStyle = "#808080"; g.fillRect(0, 0, cw, ch); g.globalAlpha = 1; }
    g.globalCompositeOperation = "source-over";
    // the moving layers only change slowly: redraw their small buffers about 3 times a second, or when the view moves
    const view = `${T.a.toFixed(4)},${T.e.toFixed(1)},${T.f.toFixed(1)}`, tick = high && !still ? Math.floor(t * 3) : 0;
    const world = !o.sol && typeof Terrain !== "undefined" && Terrain.grid;
    if (world) {
      const [x0, y0, x1, y1] = o.view;
      // 2) High: cloud shadows high above the ground (slower than MAPART's, sliding against the camera: parallax)
      //    and fog banks drifting over the valleys and lakes, both into one small buffer
      const clouds = high && L.night < 0.6 && !["fog", "blizzard"].includes(L.wx), mist = high && !hcOn && L.fog > 0.04;
      if (clouds || mist) {
        const b = buf("air", bw, bh), bg = b.c.getContext("2d"), fl = mist ? fogLayer(L) : null;
        const key = `${view}|${tick}|${q(close, 5)}|${clouds}|${q(L.night, 5)}|${L.wx}|${fl ? lay.fog.k : ""}`;
        if (b.k !== key) {
          bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, bw, bh); toBuf(bg); bg.imageSmoothingEnabled = true;
          if (clouds) {
            const pat = bg.createPattern(terrain().cloud, "repeat");
            if (pat && pat.setTransform && typeof DOMMatrix !== "undefined") {
              const c = v.center || [0.5, 0.5];
              pat.setTransform(new DOMMatrix().translate(t * 3.2 - c[0] * o.W * 0.22, t * 1.1 - c[1] * o.H * 0.22).scale(5.2));
              bg.globalAlpha = (L.wx === "storm" || L.wx === "rain" ? 0.9 : L.wx === "cloudy" ? 0.75 : 0.45) * (1 - L.night) * (1 - 0.7 * close);
              bg.fillStyle = pat; bg.fillRect(x0, y0, x1 - x0, y1 - y0);
            }
          }
          if (fl) {
            const dx = Math.sin(t * 0.045) * 9, dy = Math.cos(t * 0.031) * 4;
            const fa = 1 - 0.65 * close;   // close up, the valley mist thins out so the chart stays readable
            bg.globalAlpha = 0.6 * fa; bg.drawImage(fl, dx, dy, o.W, o.H);
            bg.globalAlpha = 0.45 * fa; bg.drawImage(fl, -dx * 1.4 + 5, -dy + 3, o.W, o.H);
          }
          bg.globalAlpha = 1; b.k = key;
        }
        g.drawImage(b.c, 0, 0, cw, ch);
      }
    }
    // 3) all the added light in one pass: town and camp fires, water catching the sun or the moons, aurora on the
    //    snow, the golden-hour lift and the shafts of dawn/dusk light
    const wl = world && (L.lights > 0.03 || L.shim > 0.02 || L.aurora > 0.02);
    if (wl || sl.add) {
      const b = buf("light", bw, bh), bg = b.c.getContext("2d");
      const wa = wl ? worldLight(L, o.shown, 0, close) : null, wb = wl && high ? worldLight(L, o.shown, 1, close) : null;
      const key = `${view}|${q(close, 5)}|${tick}|${wa ? lay.wl0.k : ""}|${wb ? lay.wl1.k : ""}|${lay.scr.k}`;
      if (b.k !== key) {   // Low and reduce motion: only when the view or the light changes
        bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, bw, bh); bg.imageSmoothingEnabled = true;
        bg.globalCompositeOperation = "lighter";
        if (sl.add && close < 0.95) { bg.globalAlpha = (high && !still ? 0.85 + 0.15 * Math.sin(t * 0.35) : 1) * (1 - 0.85 * close); bg.drawImage(sl.add, 0, 0, bw, bh); }
        toBuf(bg);
        if (wb) { const a = 0.5 + 0.5 * Math.sin(t * 0.8); bg.globalAlpha = a; bg.drawImage(wa, 0, 0, o.W, o.H); bg.globalAlpha = 1 - a; bg.drawImage(wb, 0, 0, o.W, o.H); }
        else if (wa) { bg.globalAlpha = 1; bg.drawImage(wa, 0, 0, o.W, o.H); }
        bg.globalAlpha = 1; bg.globalCompositeOperation = "source-over"; b.k = key;
      }
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = high && !still && wl ? clamp(1 + 0.045 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 12.7)) : 1;   // fires flicker
      g.drawImage(b.c, 0, 0, cw, ch);
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
    g.restore();
    return !o.sol;   // true: night lights are ours (MAPART.night can skip its own)
  }
  // ---------------------------------------------------------------- place pictures (cached by placeart.js)
  function picture(g, w, h, st, opts = {}) {
    const lv = level(); if (lv === "off" || !st) return;
    const L = light(st.hour ?? 13, st.weather, { moon: st.moon }), hcOn = hc(), k = (hcOn ? 0.5 : 1) * 0.75;
    g.save();
    // grade
    const m = mix([255, 255, 255], L.mul, k * (st.tod === "night" ? 0.55 : 1));   // SKY.overlay already darkened the night a little
    g.globalCompositeOperation = "multiply"; g.fillStyle = rgb(m); g.fillRect(0, 0, w, h);
    if (L.desat > 0.02) { g.globalCompositeOperation = "saturation"; g.globalAlpha = L.desat * k; g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); g.globalAlpha = 1; }
    g.globalCompositeOperation = "lighter";
    if (L.warm > 0.01) { g.fillStyle = rgb([255, 150, 60], L.warm * k); g.fillRect(0, 0, w, h); }
    // bloom: lit windows, fires and torches glow into the dark
    if (L.lights > 0.15) try {
      const src = g.canvas, sw = Math.max(8, Math.round(w / 4)), sh = Math.max(8, Math.round(h / 4));
      const small = mk(sw, sh), sg = small.getContext("2d"); sg.drawImage(src, 0, 0, sw, sh);
      const img = sg.getImageData(0, 0, sw, sh), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2], hot = r > 150 && gg > 70 && b < 120 && r - b > 90 && r > gg;
        if (hot) { d[i] = 255; d[i + 1] = 170; d[i + 2] = 70; d[i + 3] = 255; } else d[i + 3] = 0;
      }
      sg.putImageData(img, 0, 0);
      const tiny = mk(Math.max(4, sw / 3), Math.max(4, sh / 3)); tiny.getContext("2d").drawImage(small, 0, 0, tiny.width, tiny.height);
      g.imageSmoothingEnabled = true; g.globalAlpha = 0.55 * L.lights; g.drawImage(small, 0, 0, w, h);
      g.globalAlpha = 0.9 * L.lights; g.drawImage(tiny, 0, 0, w, h); g.drawImage(tiny, -2, -3, w + 4, h + 6);
      g.globalAlpha = 1;
    } catch { /* a tainted canvas: no bloom */ }
    // aurora on northern snow
    if (st.north && st.tod === "night" && (st.snow || 0) > 0.25 && L.aurora > 0) {
      const gy = opts.ground ?? h * 0.7, gr = g.createLinearGradient(0, gy, w, h);
      gr.addColorStop(0, "rgba(80,230,160,0.12)"); gr.addColorStop(0.6, "rgba(140,110,250,0.08)"); gr.addColorStop(1, "rgba(80,230,160,0.1)");
      g.fillStyle = gr; g.fillRect(0, gy - 4, w, h - gy + 4);
    }
    // shafts from the low sun
    if (L.gold > 0.08 && L.grey < 0.7) {
      const r = seeded("ps" + (opts.seed || "")), sx = L.sunDir > 0 ? w * 0.92 : w * 0.08, sy = h * 0.18, col = L.dawn > L.dusk ? [255, 210, 176] : [255, 198, 126];
      for (let i = 0; i < 5; i++) {
        const ex = (L.sunDir > 0 ? -1 : 1) * w * (0.4 + r() * 0.7), ey = h * (0.9 + r() * 0.3), wd = 6 + r() * 14;
        const gr = g.createLinearGradient(sx, sy, sx + ex, sy + ey); gr.addColorStop(0, rgb(col, 0.22 * L.gold)); gr.addColorStop(1, rgb(col, 0));
        g.fillStyle = gr; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + ex - wd, sy + ey); g.lineTo(sx + ex + wd, sy + ey); g.closePath(); g.fill();
      }
    }
    // vignette
    g.globalCompositeOperation = "source-over";
    if (!hcOn) {
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
      vg.addColorStop(0, "rgba(10,8,14,0)"); vg.addColorStop(1, `rgba(10,8,14,${0.3 + 0.15 * L.night})`); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    }
    g.restore();
  }

  // ---------------------------------------------------------------- Settings → Graphics
  const settingsHTML = (seg) => `<h3>Graphics</h3><div class="setrow"><span>Lighting</span>${seg("lighting", [["off", "Off"], ["low", "Low"], ["high", "High"]], level())}</div>
    <p class="mute" style="font-size:13px">Light and weather on the map and in place pictures: golden hours, lit towns at night, mist and moving clouds. Low is lighter on old phones.</p>`;
  function pref(k, v) { if (k !== "lighting") return false; setLevel(v); return true; }

  return { level, setLevel, on, key, light, nowLight, map, picture, settingsHTML, pref, reset, LEVELS };
})();
