/* Vision cone on the world map. [OURS]
   Owner: "players should have a cone of vision on the map."
   - Your marker looks the way you're travelling (and keeps that heading when you stop). Inside the cone the fog
     thins and things show clearly: other travellers further away than the usual sight ring, caravans, guard
     patrols, the foe that blocks your road. Places inside the cone are spotted (discovered) from afar.
   - Range and width: night, fog, storms and blizzards cut it; standing on high ground (hills, mountain passes)
     and riding a horse stretch it; Archery skill helps a little; perks Far Sight (Archery: further and wider)
     and Owl Eyes (Sneak: darkness and bad weather hurt your sight half as much) work through perkfx.js.
   - Party members each get their own fainter cone.
   Maths is pure (params / cone / see) so node tests can check it; drawing is cached sprites + one composite
   fog canvas that is rebuilt only when a cone or the fog actually changes (cheap on phones). */
const VISION = (() => {
  const MAP_W = 1000, MAP_H = 700;
  const BASE_RANGE = 170;          // map px on a clear day on flat ground (the plain sight ring all round is 150)
  const BASE_HALF = 0.62;          // half the cone's width, in radians (about 35° each side)
  const MIN_RANGE = 55, MAX_RANGE = 320;
  const WEATHER = { clear: 1, cloudy: 0.92, rain: 0.78, snow: 0.72, storm: 0.62, ashstorm: 0.48, fog: 0.5, blizzard: 0.42 };
  // how far off (share of the cone's range) a place of each kind can be spotted: big walled cities from far away, a shrine only up close
  const SPOT = { city: 0.9, town: 0.7, fort: 0.5, lair: 0.5, landmark: 0.5, dungeon: 0.38, camp: 0.38, farm: 0.38, stone: 0.32, shrine: 0.3 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
  /* 0 by day … 1 in the dead of night (dusk 18-21, dawn 5-7) */
  function night(hour) {
    const h = ((hour % 24) + 24) % 24;
    if (h >= 7 && h < 18) return 0;
    if (h >= 21 || h < 5) return 1;
    if (h >= 18) return (h - 18) / 3;
    return (7 - h) / 2;
  }
  /* o = {hour, weather, height (0..1+ from Terrain), archery (skill), mounted, range/wide/dark (perk bonuses)} → {range, half, near} */
  function params(o = {}) {
    const dark = clamp(o.dark || 0, 0, 0.8);                      // Owl Eyes: share of the darkness/weather loss you ignore
    const light = 1 - 0.4 * night(o.hour ?? 12) * (1 - dark);      // deep night: 60% of the day's range
    const wx = WEATHER[o.weather] ?? 1, weather = 1 - (1 - wx) * (1 - dark);
    const hill = 1 + clamp(((o.height ?? 0) - 0.25) * 0.8, 0, 0.35);   // up to +35% from high ground (hills, passes, peaks)
    const skill = 1 + clamp(o.archery || 0, 0, 100) / 500;        // a trained eye: up to +20%
    const ride = o.mounted ? 1.08 : 1;
    const range = clamp(BASE_RANGE * light * weather * hill * skill * ride * (1 + (o.range || 0)), MIN_RANGE, MAX_RANGE);
    const half = clamp(BASE_HALF * (0.8 + 0.2 * light) * (0.85 + 0.15 * weather) * (1 + (o.wide || 0)) * (hill > 1.15 ? 1.1 : 1), 0.3, 1.2);
    return { range, half, near: Math.max(18, range * 0.2) };
  }
  /* a cone at a 0..1 map point; a = heading in radians (screen: 0 = east, π/2 = south), null = not facing anywhere yet */
  const cone = (pos, a, p) => (pos && Number.isFinite(pos[0]) && Number.isFinite(pos[1]) && p && Number.isFinite(p.range) ? { x: pos[0] * MAP_W, y: pos[1] * MAP_H, a: Number.isFinite(a) ? a : null, range: p.range, half: p.half, near: p.near } : null);   // null if the position is unknown
  /* how clearly a 0..1 map point is seen: 1 = plainly, fading to 0 at the cone's edges and tip; the near ring all around is always 1 */
  function see(c, pt) {
    if (!c || !pt) return 0;
    const dx = pt[0] * MAP_W - c.x, dy = pt[1] * MAP_H - c.y, d = Math.hypot(dx, dy);
    if (d <= c.near) return 1;
    if (d > c.range || c.a == null) return 0;
    const off = Math.abs(wrap(Math.atan2(dy, dx) - c.a));
    if (off >= c.half) return 0;
    const ang = off < c.half * 0.75 ? 1 : 1 - (off - c.half * 0.75) / (c.half * 0.25);
    const rad = d < c.range * 0.8 ? 1 : 1 - (d - c.range * 0.8) / (c.range * 0.2);
    return clamp(Math.min(ang, rad), 0, 1);
  }
  const inCone = (c, pt) => see(c, pt) > 0;
  const pfx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  function heightAt(pos) {
    if (typeof Terrain === "undefined" || (typeof WORLD !== "undefined" && WORLD.isSol && WORLD.isSol(pos))) return 0.2;
    try { return Terrain.heightAt([pos[0] * MAP_W, pos[1] * MAP_H]); } catch { return 0.2; }
  }
  /* a hero's sight right now, from the world around them; s = save (perks, skills, horse) or null for someone else's marker */
  const memo = new Map();   // a few heroes' sights, worked out at most every 20 game seconds or when they move
  function forPos(s, pos, t) {
    t = t ?? (typeof G !== "undefined" ? G.now() : 0);
    const k = [Math.round(pos[0] * 400), Math.round(pos[1] * 400), Math.floor(t / 20), s ? s.id : "-", s ? JSON.stringify(s.perks || {}).length : 0, s && typeof HORSES !== "undefined" ? HORSES.riding(s) : 0].join("|");
    if (memo.has(k)) return memo.get(k);
    const o = {
      hour: typeof G !== "undefined" && G.clock ? G.clock(t).hour : 12,
      weather: typeof WEVENTS !== "undefined" ? WEVENTS.weather(pos, t).id : "clear",
      height: heightAt(pos),
    };
    if (s) Object.assign(o, {
      archery: typeof G !== "undefined" && G.skill ? G.skill(s, "Archery") : 0,
      mounted: typeof HORSES !== "undefined" ? HORSES.riding(s) : false,
      range: pfx(s, "sightrange"), wide: pfx(s, "sightwide"), dark: pfx(s, "sightdark"),
    });
    if (memo.size > 24) memo.clear();
    const v = params(o); memo.set(k, v); return v;
  }
  /* heading trackers (by id): the way a marker last moved, kept while it stands still */
  const heads = {};
  function track(id, pos, hint, moving = true) {
    const h = heads[id] || (heads[id] = { a: null, last: null });
    const x = pos[0] * MAP_W, y = pos[1] * MAP_H, l = h.last, d = l ? Math.hypot(x - l[0], y - l[1]) : 0;
    if (!l || d > 60 || !moving) h.last = [x, y];             // first sight, a jump (fast travel) or standing still: keep the old heading
    else if (d > 0.3) { h.a = Math.atan2(y - l[1], x - l[0]); h.last = [x, y]; }
    if (h.a == null && hint) { const hx = hint[0] * MAP_W - x, hy = hint[1] * MAP_H - y; if (Math.hypot(hx, hy) > 1) h.a = Math.atan2(hy, hx); }   // just set off: look where you're going
    return h.a;
  }
  /* engine hook, each travel step: remember which way you face, and spot places inside your cone; log(s, text) like the engine's tripLog */
  function step(s, prev, t, log) {
    if (!s || !prev) return [];
    const dx = (s.x - prev[0]) * MAP_W, dy = (s.y - prev[1]) * MAP_H;
    if (Math.hypot(dx, dy) > 0.05) s.facing = +Math.atan2(dy, dx).toFixed(3);
    if (s.facing == null || typeof WORLD === "undefined") return [];
    const pos = [s.x, s.y], c = cone(pos, s.facing, forPos(s, pos, t)), known = new Set(s.discovered), found = [];
    if (!c) return found;
    for (const [n, p] of Object.entries(WORLD.places)) {
      if (known.has(n) || (WORLD.same && !WORLD.same(pos, p))) continue;
      const d = Math.hypot(p[0] * MAP_W - c.x, p[1] * MAP_H - c.y);
      if (d > c.range * (SPOT[p[2]] ?? 0.3) || !inCone(c, p)) continue;
      s.discovered.push(n); (s.explored = s.explored || []).push([p[0], p[1]]); found.push(n);
      if (log) log(s, `👁 Spotted ${n} in the distance`);
      if (typeof EXPLORE !== "undefined" && EXPLORE.onDiscover) EXPLORE.onDiscover(s, n, log);
    }
    return found;
  }

  // ------------------------------------------------------------------ drawing
  const style = () => (typeof ART !== "undefined" && ART.style ? ART.style() : "ink");
  const sprites = new Map();
  /* a soft white wedge pointing east (for punching through the fog), cached by rounded size */
  function sprite(range, half, near, st) {
    const R = Math.round(range / 4) * 4, hf = Math.round(half * 50) / 50, nr = Math.round(near / 2) * 2, key = R + "|" + hf + "|" + nr + "|" + st;
    if (sprites.has(key)) return sprites.get(key);
    if (sprites.size > 16) sprites.clear();
    const c = document.createElement("canvas"); c.width = c.height = R * 2 + 4;
    const g = c.getContext("2d"), o = R + 2;
    const layers = st === "pixel" ? [[1, 1]] : [[0.7, 0.6], [0.85, 0.5], [1, 0.5]];   // pixel: one hard-ish wedge; ink: feathered sides
    for (const [w, a] of layers) {
      const gr = g.createRadialGradient(o, o, 0, o, o, R);
      if (st === "pixel") { gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.6, "rgba(0,0,0,1)"); gr.addColorStop(0.61, "rgba(0,0,0,.75)"); gr.addColorStop(0.85, "rgba(0,0,0,.75)"); gr.addColorStop(0.86, "rgba(0,0,0,.4)"); gr.addColorStop(1, "rgba(0,0,0,.4)"); }
      else { gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.7, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); }
      g.globalAlpha = a; g.fillStyle = gr;
      g.beginPath(); g.moveTo(o, o); g.arc(o, o, R, -hf * w, hf * w); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    const ng = g.createRadialGradient(o, o, nr * 0.5, o, o, nr * 1.3);   // the little ring around you that you always see
    ng.addColorStop(0, "rgba(0,0,0,1)"); ng.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = ng; g.beginPath(); g.arc(o, o, nr * 1.3, 0, 7); g.fill();
    if (st === "pixel") {   // hard steps: snap the alpha into 4 bands at a coarse block size
      const b = 4, sw = Math.ceil(c.width / b), sm = document.createElement("canvas"); sm.width = sm.height = sw;
      const sg = sm.getContext("2d"); sg.imageSmoothingEnabled = true; sg.drawImage(c, 0, 0, sw, sw);
      const img = sg.getImageData(0, 0, sw, sw), d = img.data;
      for (let i = 3; i < d.length; i += 4) d[i] = Math.round(d[i] / 64) * 64 > 255 ? 255 : Math.round(d[i] / 64) * 64;
      sg.putImageData(img, 0, 0);
      g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false; g.drawImage(sm, 0, 0, c.width, c.width);
    }
    const out = { c, o };
    sprites.set(key, out);
    return out;
  }
  /* the fog with the cones cut through it (and a light veil over the rest), rebuilt only when something changed */
  let veilC = null, veilKey = "";
  function veil(fog, fogKey, cones, W, H, oy = 0) {
    const st = style();
    const key = fogKey + "|" + st + "|" + oy + "|" + cones.map((k) => [Math.round(k.c.x), Math.round(k.c.y), k.c.a == null ? "n" : Math.round(k.c.a * 60), Math.round(k.c.range / 4), Math.round(k.c.half * 50), k.faint ? 1 : 0].join(",")).join(";");
    if (veilC && key === veilKey) return veilC;
    veilKey = key;
    veilC = veilC || document.createElement("canvas");
    if (veilC.width !== W || veilC.height !== H) { veilC.width = W; veilC.height = H; }
    const g = veilC.getContext("2d");
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.fillStyle = st === "pixel" ? "rgba(14,14,22,.16)" : "rgba(16,12,8,.14)"; g.fillRect(0, 0, W, H);   // what you can't see right now is a touch dimmer
    g.drawImage(fog, 0, 0, W, H);
    g.globalCompositeOperation = "destination-out";
    for (const k of cones) {
      const c = k.c, sp = sprite(c.range, c.a == null ? 0.0001 : c.half, c.near, st);
      g.globalAlpha = k.faint ? 0.55 : 0.95;
      g.setTransform(1, 0, 0, 1, c.x, c.y - oy); g.rotate(c.a ?? 0);
      g.drawImage(sp.c, -sp.o, -sp.o);
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    return veilC;
  }
  /* the cone's outline on the map (world units; s = one screen px): ink lines and a warm wash, or pixel dots */
  function edges(g, c, s, faint, t = 0) {
    if (c.a == null) return;
    const st = style(), a0 = c.a - c.half * 0.94, a1 = c.a + c.half * 0.94, r0 = c.near * 1.05, r1 = c.range * 0.9;
    const al = faint ? 0.45 : 1;
    g.save();
    if (st === "pixel") {
      const b = 2.4 * s, snap = (v) => Math.round(v / b) * b;
      for (let i = 0; i < 3; i++) {   // banded wash, three hard steps
        g.fillStyle = faint ? `rgba(160,230,150,${0.035 * al})` : "rgba(255,236,170,.05)";
        g.beginPath(); g.moveTo(c.x, c.y); g.arc(c.x, c.y, c.range * (0.45 + i * 0.25), c.a - c.half * 0.9, c.a + c.half * 0.9); g.closePath(); g.fill();
      }
      const dot = (x, y, k) => { g.fillStyle = k % 2 ? `rgba(30,22,14,${0.7 * al})` : (faint ? `rgba(170,235,160,${0.85 * al})` : `rgba(255,232,160,${0.9 * al})`); g.fillRect(snap(x) - b / 2, snap(y) - b / 2, b, b); };
      for (const a of [a0, a1]) for (let r = r0, k = 0; r < r1; r += 3 * b, k++) { if ((r - r0) / (r1 - r0) > 0.85 && k % 2) continue; dot(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, k); }
      const n = Math.max(4, Math.round((a1 - a0) * r1 / (4 * b)));
      for (let i = 0; i <= n; i += 2) { const a = a0 + (a1 - a0) * i / n; dot(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1, i / 2); }
    } else {
      const wash = g.createRadialGradient(c.x, c.y, c.near * 0.5, c.x, c.y, c.range);
      wash.addColorStop(0, faint ? "rgba(190,240,180,.09)" : "rgba(255,238,196,.13)"); wash.addColorStop(1, "rgba(255,238,196,0)");
      g.fillStyle = wash; g.beginPath(); g.moveTo(c.x, c.y); g.arc(c.x, c.y, c.range, c.a - c.half, c.a + c.half); g.closePath(); g.fill();
      g.lineCap = "round";
      for (const a of [a0, a1]) {   // an ink edge with a pale highlight, fading out towards the tip
        const x0 = c.x + Math.cos(a) * r0, y0 = c.y + Math.sin(a) * r0, x1 = c.x + Math.cos(a) * r1, y1 = c.y + Math.sin(a) * r1;
        const lg = g.createLinearGradient(x0, y0, x1, y1);
        lg.addColorStop(0, `rgba(44,30,16,${0.55 * al})`); lg.addColorStop(1, "rgba(44,30,16,0)");
        g.strokeStyle = lg; g.lineWidth = 1.6 * s; g.setLineDash([7 * s, 4 * s]); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        const hg = g.createLinearGradient(x0, y0, x1, y1);
        hg.addColorStop(0, faint ? `rgba(200,245,190,${0.5 * al})` : "rgba(255,240,205,.55)"); hg.addColorStop(1, "rgba(255,240,205,0)");
        g.strokeStyle = hg; g.lineWidth = 0.8 * s; g.setLineDash([]); g.beginPath(); g.moveTo(x0 + s, y0 + s); g.lineTo(x1 + s, y1 + s); g.stroke();
      }
      g.setLineDash([1.5 * s, 5 * s]); g.strokeStyle = faint ? `rgba(200,245,190,${0.35 * al})` : "rgba(255,240,205,.4)"; g.lineWidth = 1.4 * s;
      g.beginPath(); g.arc(c.x, c.y, r1, a0 + 0.05, a1 - 0.05); g.stroke();
    }
    g.restore();
  }
  /* the foe blocking your road, standing just ahead in your cone */
  function foe(g, c, s, name, t, reduce, label) {
    if (!c || !name) return;
    const a = c.a ?? -Math.PI / 2, d = Math.max(30 * s, Math.min(c.near * 1.6, 60 * s)), x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d, r = 7.5 * s;
    const pulse = reduce ? 0.5 : (Math.sin(t * 5) + 1) / 2;
    g.save();
    g.fillStyle = `rgba(200,40,30,${0.18 + 0.15 * pulse})`; g.beginPath(); g.arc(x, y, r * (1.9 + 0.4 * pulse), 0, 7); g.fill();
    g.fillStyle = "#7a1410"; g.strokeStyle = "#1a0a06"; g.lineWidth = 2 * s;
    if (style() === "pixel") { g.fillRect(x - r, y - r, r * 2, r * 2); g.strokeRect(x - r, y - r, r * 2, r * 2); }
    else { g.beginPath(); g.moveTo(x, y - r * 1.2); g.lineTo(x + r, y); g.lineTo(x, y + r * 1.2); g.lineTo(x - r, y); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = "#ffd9c8"; g.font = `bold ${Math.round(11 * s * 10) / 10}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", x, y + 0.5 * s);
    g.restore();
    if (label) label(name, x, y);
  }
  const reset = () => { memo.clear(); for (const k in heads) delete heads[k]; veilKey = ""; };   // forget cached sights (tests, new character)
  return { BASE_RANGE, BASE_HALF, MIN_RANGE, MAX_RANGE, WEATHER, SPOT, night, params, cone, see, inCone, forPos, track, step, sprite, veil, edges, foe, wrap, reset };
})();
if (typeof module !== "undefined") module.exports = VISION;
