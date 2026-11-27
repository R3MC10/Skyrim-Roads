/* The real world in the road view (fpreal.js). [OURS]
   fptravel.js / fpworld.js draw the first-person road. This reads the actual map around you so the view shows the land
   that is really there:
     FPREAL.relief(pos)            → the skyline all round you from the map's heights: { id, el: Float32Array(180) (2° steps,
                                     how high the land rises over the horizon, 0..~0.9 of the sky band), snow: Uint8Array(180) }
     FPREAL.places(pos, head, opt) → real places round you: [{ name, kind, bear, dist, fwd, lat, rel }] nearest first
                                     (dist/fwd/lat in map pixels, rel = degrees off your heading); opt { known(name), max }
     FPREAL.bend(pos, path, idx, head) → (z) → the road's real sideways offset z road-units ahead (or null without a path)
     FPREAL.PX                     map pixels per road unit (the road view's depth scale)
     FPREAL.companions(list)       the company normalised for drawing: [{ name, player, follower, pet, riding, coat, armour,
                                     skin, hair, cape, kind }]
   Everything is cached per small map cell so the view stays at full speed. */
const FPREAL = (() => {
  const MW = 1000, MH = 700, PX = 1.6, STEPS = 180;
  const relDeg = (d) => { d %= 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
  const W = () => (typeof WORLD !== "undefined" ? WORLD : null);
  const TR = () => (typeof Terrain !== "undefined" ? Terrain : null);
  const isSol = (p) => { try { return !!W()?.isSol?.(p); } catch { return false; } };
  const onMap = (p) => !!p && p[0] >= 0 && p[0] <= 1 && ((p[1] >= 0 && p[1] <= 1) || (p[1] >= 2 && p[1] <= 3));
  const bearing = (a, b) => (Math.atan2((b[0] - a[0]) * MW, -(b[1] - a[1]) * MH) * 180 / Math.PI + 360) % 360;
  const dist = (a, b) => Math.hypot((a[0] - b[0]) * MW, (a[1] - b[1]) * MH);
  function heightAt(p) {   // 0..1+ ; the same map heights the world map uses
    const T = TR(); if (!T) return 0;
    try { if (T.heightAtPos) return T.heightAtPos(p); if (!isSol(p) && T.heightAt) return T.heightAt([p[0] * MW, p[1] * MH]); } catch { /* flat */ }
    return 0;
  }
  function typeAt(p) { try { return TR()?.typeAtPos?.(p); } catch { return null; } }

  // ------------------------------------------------------------------ the skyline from the map's heights
  const relCache = new Map();
  function relief(pos) {
    if (!onMap(pos) || !TR()) return null;
    const cx = Math.round(pos[0] * 125), cy = Math.round(pos[1] * 88), id = cx + "," + cy;   // one skyline per 8 map pixels
    if (relCache.has(id)) return relCache.get(id);
    const T = TR(), sea = T.T?.SEA, h0 = Math.max(0.05, heightAt(pos)) + 0.012;   // your eyes sit a little above the ground
    const el = new Float32Array(STEPS), snow = new Uint8Array(STEPS);
    for (let i = 0; i < STEPS; i++) {
      const a = i * 2 * Math.PI / 180, sx = Math.sin(a) / MW, sy = -Math.cos(a) / MH;
      let best = 0, bestH = 0;
      for (let d = 14; d <= 320; d += d < 40 ? 4 : d < 120 ? 8 : 14) {
        const p = [pos[0] + sx * d, pos[1] + sy * d];
        if (!onMap(p) || isSol(p) !== isSol(pos)) break;
        const hh = heightAt(p);
        // how high it stands over the horizon: rise over distance, with the earth's falloff so far ranges sit low
        // map heights: 1.0 is about the Throat of the World (~1.2 km over the plains), a map pixel ~60 m, so the angle is rise·20/distance;
        // the sky band shows ~0.6 rad above the horizon. Small bumps (< 0.03) are left to the drawn near hills.
        const ang = Math.max(0, hh - h0 - 0.03) * 20 / (d + 4) / 0.6;
        if (ang > best) { best = ang; bestH = hh; }
      }
      el[i] = Math.min(0.95, best);
      snow[i] = bestH > 0.62 ? 1 : 0;
    }
    // soften the steps between rays so the skyline reads as one line of hills
    const sm = new Float32Array(STEPS);
    for (let i = 0; i < STEPS; i++) sm[i] = (el[(i + STEPS - 1) % STEPS] + el[i] * 2 + el[(i + 1) % STEPS]) / 4;
    const out = { id: "r" + id, el: sm, snow, h0 };
    relCache.set(id, out); if (relCache.size > 120) relCache.delete(relCache.keys().next().value);
    return out;
  }

  // ------------------------------------------------------------------ real places round you
  const BIG = new Set(["city", "college"]);
  function places(pos, head, opt = {}) {
    const Wd = W(); if (!Wd || !pos) return [];
    const out = [], known = opt.known || (() => true), sol = isSol(pos);
    for (const [name, p] of Object.entries(Wd.places || {})) {
      if (!p || isSol(p) !== sol) continue;
      const kind = p[2] || "town", d = dist(pos, p), far = BIG.has(kind) ? 260 : kind === "landmark" || kind === "fort" ? 170 : 120;
      if (d < 1.5 || d > far) continue;
      const bear = bearing(pos, p), rel = relDeg(bear - (head || 0)), r = rel * Math.PI / 180;
      out.push({ name, kind, bear, rel, dist: d, fwd: Math.cos(r) * d, lat: Math.sin(r) * d, known: !!known(name) });
    }
    // the Throat of the World: the tallest mountain, seen from everywhere in the middle of Skyrim
    if (!sol && Wd.places["High Hrothgar"]) {
      const p = Wd.places["High Hrothgar"], d = dist(pos, p);
      if (d > 30 && d < 420 && !out.some((o) => o.name === "High Hrothgar")) { const bear = bearing(pos, p), rel = relDeg(bear - (head || 0)); out.push({ name: "High Hrothgar", kind: "peak", bear, rel, dist: d, fwd: Math.cos(rel * Math.PI / 180) * d, lat: Math.sin(rel * Math.PI / 180) * d, known: true }); }
    }
    // keep the ones that matter: the place you're heading for, cities and big landmarks from further off, then the nearest
    const weight = (q) => (q.name === opt.dest ? 0.01 : 1) / (q.name === "High Hrothgar" ? 3 : 1) / ({ city: 3, peak: 3, college: 2.2, town: 1.7, fort: 1.6, landmark: 1.4 }[q.kind] || 1);
    const pick = out.slice().sort((a, b) => a.dist * weight(a) - b.dist * weight(b)).slice(0, opt.max || 14);
    return pick.sort((a, b) => a.dist - b.dist);
  }

  // ------------------------------------------------------------------ the real bend of the road ahead
  function bend(pos, path, idx, head) {
    if (!pos || !Array.isArray(path) || path.length < 2) return null;
    const h = (head || 0) * Math.PI / 180, sh = Math.sin(h), ch = Math.cos(h);
    const pts = [[0, 0]];
    for (let i = Math.max(0, idx || 0) + 1; i < path.length && pts.length < 40; i++) {
      const dx = (path[i][0] - pos[0]) * MW, dy = -(path[i][1] - pos[1]) * MH;   // east, north (map pixels)
      const f = dx * sh + dy * ch, l = dx * ch - dy * sh;                       // along your heading, to your right
      if (f < pts[pts.length - 1][0] - 2) continue;   // doubling back: skip
      pts.push([f, l]);
      if (f > 90) break;
    }
    if (pts.length < 2) return null;
    return (z) => {
      const f = z * PX;
      for (let i = 1; i < pts.length; i++) if (pts[i][0] >= f) {
        const [f0, l0] = pts[i - 1], [f1, l1] = pts[i], k = f1 > f0 ? (f - f0) / (f1 - f0) : 1;
        return (l0 + (l1 - l0) * k) / PX;
      }
      const [fa, la] = pts[pts.length - 2], [fb, lb] = pts[pts.length - 1], slope = fb > fa ? (lb - la) / (fb - fa) : 0;
      return (lb + slope * (f - fb)) / PX;
    };
  }

  // ------------------------------------------------------------------ your company, ready to draw
  const SKIN = { nord: "#ecc9a8", imperial: "#d9ab82", breton: "#f0d2b6", redguard: "#7a4e33", altmer: "#e3cf8a", bosmer: "#b5864f", dunmer: "#7d8a92", orc: "#7f9a5c", khajiit: "#c9a46c", argonian: "#6f8a5a" };
  const HAIR = ["#2a1d14", "#6b4426", "#a8763c", "#d6b26a", "#3a3a3a", "#7a2e1c"];
  function gearCol(id, fall) {
    try { if (id && typeof GEARLOOK !== "undefined") { const S = GEARLOOK.SETS[GEARLOOK.setOf(id)]; if (S?.c) return S.c; } } catch { /* plain */ }
    return fall;
  }
  function hashOf(s) { let h = 2166136261; for (const c of String(s || "")) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  function companions(list) {
    const out = [];
    for (const c of list || []) {
      if (!c || !c.name) continue;
      const look = c.look || {}, eq = look.eq || {};
      if (c.pet) { out.push({ name: c.name, pet: true, kind: c.kind || "dog", coat: c.coat || (c.kind === "wolf" ? "#8a8a88" : c.kind === "fox" ? "#c8682e" : "#6a4a30") }); continue; }
      out.push({ name: c.name, player: !!c.player, follower: !!c.follower, riding: !!c.riding, coat: c.horse || c.coat || null,
        armour: gearCol(eq.chest, c.player ? "#6b5a46" : "#5e5446"), helm: eq.head ? gearCol(eq.head, "#7a7a7a") : null,
        skin: look.ww ? "#4a3a2e" : (SKIN[look.r] || "#e2b894"), hair: HAIR[hashOf(c.name) % HAIR.length],
        cape: eq.cloak || hashOf(c.name + "c") % 3 === 0 ? ["#6a2a22", "#2c3e5a", "#3e4a2e", "#4a3a2a"][hashOf(c.name) % 4] : null,
        weapon: eq.weapon || null, shield: !!eq.shield });
    }
    return out;
  }

  return { PX, relief, places, bend, companions, heightAt, typeAt, _clear: () => relCache.clear() };
})();
