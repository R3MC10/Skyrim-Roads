/* mapfx.js: the living painted map on a PC (pcmap.js). [OURS]
   Drawn by map.js over the fog, in map units, only while the PC map screen is on:
   - each hold's own weather over that hold (snow, rain, storm, blizzard, fog or grey cloud), clipped to its real outline
     (WORLD.holdPolys), instead of one weather over the whole screen
   - chimney smoke rising from the towns and cities you've found (more of it, and from smaller places, as you zoom in)
   - extra cloud shadows and a few more birds on High
   Settings → Map → Map quality: Low (still map, the old screen weather), Medium, High. Reduce motion keeps it all still. */
const MAPFX = (() => {
  const LV = {
    low: { wx: 0, smoke: 0, clouds: 0, birds: 0 },
    med: { wx: 46, smoke: 4, clouds: 2, birds: 0 },
    high: { wx: 100, smoke: 7, clouds: 5, birds: 2 },
  };
  const q = () => (typeof PCMAP !== "undefined" ? PCMAP.quality() : "med");
  const on = () => typeof PCMAP !== "undefined" && PCMAP.on();
  /* is the regional weather drawn here (so map.js skips its whole-screen weather)? */
  const regional = () => on() && q() !== "low";
  /* does the map need smooth frames (smoke, falling snow)? */
  const busy = (reduce) => on() && !reduce && q() !== "low";
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  let polys = null;
  function holdPaths(W, H) {
    if (polys) return polys;
    polys = [];
    const hp = (typeof WORLD !== "undefined" && WORLD.holdPolys) || {};
    for (const [name, pts] of Object.entries(hp)) {
      const p = new Path2D(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      pts.forEach(([x, y], i) => { const X = x * W, Y = y * H; i ? p.lineTo(X, Y) : p.moveTo(X, Y); x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y); });
      p.closePath(); polys.push({ name, path: p, box: [x0, y0, x1, y1] });
    }
    return polys;
  }
  let puff = null;
  function smokeSprite() {
    if (puff) return puff;
    puff = document.createElement("canvas"); puff.width = puff.height = 32;
    const g = puff.getContext("2d"), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(232,228,220,.9)"); gr.addColorStop(0.6, "rgba(200,196,190,.45)"); gr.addColorStop(1, "rgba(200,196,190,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return puff;
  }
  let cloud = null;
  function cloudSprite() {
    if (cloud) return cloud;
    cloud = document.createElement("canvas"); cloud.width = 128; cloud.height = 72;
    const g = cloud.getContext("2d");
    for (const [x, y, r] of [[40, 40, 26], [64, 32, 30], [88, 42, 24], [58, 48, 22]]) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(20,24,30,.55)"); gr.addColorStop(1, "rgba(20,24,30,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 72); }
    return cloud;
  }
  const inView = (x, y, vb, pad) => x > vb[0] - pad && x < vb[2] + pad && y > vb[1] - pad && y < vb[3] + pad;

  /* v = the map view (t, zoom, discovered, reduceMotion, region); s = one screen px in map units; vb = visible box */
  function draw(g, v, s, W, H, vb) {
    if (!on() || v.region === "solstheim") return;
    const L = LV[q()] || LV.med, t = v.reduceMotion ? 0 : v.t || 0, zoom = v.zoom || 1;
    if (!L.wx && !L.smoke) return;
    g.save();
    // ---- each hold's weather over that hold
    if (L.wx && typeof WEVENTS !== "undefined" && WEVENTS.weatherAt) {
      for (const h of holdPaths(W, H)) {
        const [x0, y0, x1, y1] = h.box;
        if (x1 < vb[0] || x0 > vb[2] || y1 < vb[1] || y0 > vb[3]) continue;
        let wx = "clear"; try { wx = WEVENTS.weatherAt(h.name); } catch { /* no weather */ }
        if (wx === "clear") continue;
        g.save(); g.clip(h.path);
        const veil = { cloudy: "rgba(60,66,78,.10)", fog: "rgba(214,218,224,.20)", storm: "rgba(36,40,52,.20)", blizzard: "rgba(236,240,248,.20)", rain: "rgba(70,80,96,.10)", snow: "rgba(236,240,248,.08)" }[wx];
        if (veil) { g.fillStyle = veil; g.fill(h.path); }
        const bw = x1 - x0, bh = y1 - y0, area = bw * bh / 9000, n = Math.round(L.wx * Math.min(3, area) * Math.min(2, Math.sqrt(zoom)));
        if (wx === "rain" || wx === "storm") {
          g.strokeStyle = "rgba(196,214,236,.5)"; g.lineWidth = 1.1 * s; g.beginPath();
          for (let i = 0; i < n; i++) {
            const x = x0 + ((hash(i) * bw + t * 18) % bw), y = y0 + ((hash(i + 7) * bh + t * 140 * (0.8 + hash(i + 3) * 0.4)) % bh);
            g.moveTo(x, y); g.lineTo(x - 2.5 * s, y + 9 * s);
          }
          g.stroke();
          if (wx === "storm" && !v.reduceMotion && Math.sin(t * 0.9 + x0) > 0.993) { g.fillStyle = "rgba(255,255,255,.22)"; g.fill(h.path); }
        } else if (wx === "snow" || wx === "blizzard") {
          g.fillStyle = "rgba(255,255,255,.85)";
          const drift = wx === "blizzard" ? 34 : 9, fall = wx === "blizzard" ? 30 : 14, m = wx === "blizzard" ? Math.round(n * 1.4) : n;
          for (let i = 0; i < m; i++) {
            const x = x0 + (((hash(i) * bw + t * drift + Math.sin(t + i) * 3) % bw) + bw) % bw, y = y0 + ((hash(i + 11) * bh + t * fall * (0.7 + hash(i + 5) * 0.6)) % bh), r = (0.9 + (i % 3) * 0.45) * s;
            g.fillRect(x - r, y - r, r * 2, r * 2);
          }
        } else if (wx === "fog") {
          const sp = smokeSprite(); g.globalAlpha = 0.35;
          for (let i = 0; i < Math.min(14, n / 4); i++) { const x = x0 + ((hash(i) * bw + t * 3) % bw), y = y0 + hash(i + 2) * bh, r = 26 + hash(i + 4) * 20; g.drawImage(sp, x - r, y - r * 0.5, r * 2, r); }
          g.globalAlpha = 1;
        }
        g.restore();
      }
    }
    // ---- extra cloud shadows drifting west → east (High)
    if (L.clouds && !["fog", "blizzard"].includes(v.weather)) {
      const cs = cloudSprite(); g.globalAlpha = 0.16;
      for (let i = 0; i < L.clouds; i++) { const sp = 4 + i * 1.7, x = ((i * 311 + t * sp) % (W + 500)) - 400, y = (i * 197 + 90) % (H - 100); g.drawImage(cs, x, y, 380, 214); }
      g.globalAlpha = 1;
    }
    // ---- chimney smoke from the places you've found
    if (L.smoke && !v.reduceMotion) {
      const sp = smokeSprite(), places = (typeof WORLD !== "undefined" && WORLD.places) || {};
      for (const n of v.discovered || []) {
        const p = places[n]; if (!p || p[1] > 1.2) continue;
        const kind = p[2], big = kind === "city";
        if (!(big || (kind === "town" && zoom >= 1.25) || (kind === "farm" && zoom >= 2.4))) continue;
        const X = p[0] * W, Y = p[1] * H; if (!inView(X, Y, vb, 40)) continue;
        const stacks = big ? (zoom >= 2 ? 3 : 2) : 1, puffs = L.smoke + (zoom >= 2.5 ? 2 : 0);
        for (let c = 0; c < stacks; c++) {
          const cx = X + (c - (stacks - 1) / 2) * 7 * s + (hash(c + X) - 0.5) * 4 * s, cy = Y - (big ? 12 : 9) * s;
          for (let j = 0; j < puffs; j++) {
            const ph = ((t * 0.22 + j / puffs + hash(X + c * 3)) % 1), r = (2.4 + ph * 7) * s * (big ? 1 : 0.8);
            g.globalAlpha = 0.42 * (1 - ph) * Math.min(1, ph * 6);
            g.drawImage(sp, cx + ph * 9 * s + Math.sin(ph * 6 + j) * 2 * s - r, cy - ph * 30 * s - r, r * 2, r * 2);
          }
        }
      }
      g.globalAlpha = 1;
    }
    // ---- a few more birds wheeling over the land (High)
    if (L.birds && !v.reduceMotion && !["rain", "storm", "snow", "blizzard"].includes(v.weather)) {
      g.strokeStyle = "rgba(28,20,12,.7)"; g.lineWidth = 1 * s; g.beginPath();
      for (let f = 0; f < L.birds; f++) {
        const cx = (0.3 + f * 0.35) * W, cy = (0.45 + f * 0.1) * H, a = t * 0.12 + f * 2;
        for (let b = 0; b < 3; b++) {
          const bx = cx + Math.cos(a + b * 0.08) * 60, by = cy + Math.sin(a + b * 0.08) * 34, flap = Math.sin(t * 7 + b + f) * 1.6 * s;
          g.moveTo(bx - 3.5 * s, by - flap); g.lineTo(bx, by + 0.6 * s); g.lineTo(bx + 3.5 * s, by - flap);
        }
      }
      g.stroke();
    }
    g.restore();
  }
  return { draw, on, regional, busy, LV };
})();
if (typeof module !== "undefined") module.exports = MAPFX;
