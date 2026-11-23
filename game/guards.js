/* Hold guards. [OURS, guards from Skyrim]
   Remigiusz: "Guards should be visible on the world map patrolling. Guards can't be farmed for gear. And fighting with
               guards grant no xp. Guards should scale with player level."
   - Patrols: two guards walk the road out of every hold seat to a nearby village or fort and back, on a timetable worked
     out from real time (like the caravans), so every phone sees them in the same place. They show on the map near
     places you've found.
   - A guard is always your level (it never falls behind you and never runs ahead) and fights in its hold's colours.
   - Beating a guard gives no skill XP, no gold and no loot: there's nothing to farm. It only adds to your bounty. */
const GUARDS = (() => {
  const SEATS = { Haafingar: "Solitude", "The Reach": "Markarth", Whiterun: "Whiterun", Eastmarch: "Windhelm", "The Rift": "Riften",
    "The Pale": "Dawnstar", Winterhold: "Winterhold", Hjaalmarch: "Morthal", Falkreath: "Falkreath" };
  const EPOCH = 1795132800, STOP = 240, SPEED = 14;   // they rest 4 real minutes at each end; px per real minute (slower than a wagon)
  const NEAR = new Set(["town", "fort"]);
  const isGuard = (e) => !!(e && (e.guard || (e.tags || []).includes("guard")));

  /* the guard you fight: always your level, a hold's soldier with sword and shield */
  function foe(s, hold) {
    const lv = Math.max(1, s.level || 1);
    const base = { name: hold ? `${hold} guard` : "City guard", health: 140, damage: 19, tags: ["humanoid", "elite", "guard"], level: lv, rec: lv,
      danger: "high", gold: [0, 0], text: "", guard: true, arch: "warrior", hold };
    const e = G.scaleQuestFoe ? G.scaleQuestFoe(base, lv, lv) : G.scaleEnemy(base, lv);
    return Object.assign(e, { guard: true, gold: [0, 0], level: lv });
  }

  // ---- patrols
  const cache = new Map();
  /* the road a seat's patrol walks: from the seat to the nearest village, farm or fort in reach */
  function beat(seat) {
    if (cache.has(seat)) return cache.get(seat);
    const P = WORLD.places, A = P[seat]; let best = null, bd = 1e9;
    if (!A) return null;
    for (const [n, p] of Object.entries(P)) {
      if (n === seat || !NEAR.has(p[2])) continue;
      const d = Math.hypot(p[0] - A[0], p[1] - A[1]);
      if (d < bd && d > 0.05) { bd = d; best = n; }
    }
    if (!best || bd > 0.3) { cache.set(seat, null); return null; }
    let path = null, secs = 0;
    try { path = Terrain.route(A.slice(0, 2), P[best].slice(0, 2)); secs = Terrain.secondsLeft(path, 0, A.slice(0, 2), SPEED / 60); } catch (e) { path = null; }
    const r = path ? { seat, to: best, A: A.slice(0, 2), B: P[best].slice(0, 2), path, secs: Math.max(90, Math.round(secs)) } : null;
    cache.set(seat, r); return r;
  }
  /* where every hold's patrol is at time t: [{hold, seat, to, pos, moving, back}] */
  function patrols(t = G.now()) {
    const out = [];
    for (const [hold, seat] of Object.entries(SEATS)) {
      const b = beat(seat); if (!b) continue;
      const cyc = 2 * (STOP + b.secs), off = (((t - EPOCH) % cyc) + cyc) % cyc;
      let pos, moving = false, back = false;
      if (off < STOP) pos = b.A;
      else if (off < STOP + b.secs) { pos = Terrain.moveAlong(b.path, 0, b.A, off - STOP, SPEED / 60).pos; moving = true; }
      else if (off < 2 * STOP + b.secs) { pos = b.B; back = true; }
      else { const left = b.secs - (off - 2 * STOP - b.secs); pos = Terrain.moveAlong(b.path, 0, b.A, Math.max(0, left), SPEED / 60).pos; moving = true; back = true; }
      out.push({ hold, seat, to: b.to, pos, moving, back });
    }
    return out;
  }

  // ---- the little patrol on the map: two guards with spears and shields in the hold's colours
  const sprites = new Map();
  function tint(hold) { const h = WORLD.holds && WORLD.holds[hold]; const c = h && h[2]; return c ? `rgb(${c[0]},${c[1]},${c[2]})` : "#a8323a"; }
  function drawPatrol(g, H, w, h, colour) {
    const ground = h * 0.9;
    g.fillStyle = "rgba(40,30,20,.28)"; g.beginPath(); g.ellipse(w / 2, ground, w * 0.42, h * 0.07, 0, 0, 7); g.fill();
    for (const [x, sc] of [[w * 0.32, 0.92], [w * 0.66, 1]]) {
      const top = ground - h * 0.8 * sc;
      g.strokeStyle = "#3a2c1e"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + 3.2, ground - 1); g.lineTo(x + 3.2, top - 3); g.stroke();   // spear
      H.poly(g, [[x + 2.2, top - 3], [x + 4.2, top - 3], [x + 3.2, top - 6.5]], "#c8ccd0", "#2a2420", 0.6);
      H.poly(g, [[x - 1.6, ground], [x - 0.4, ground - h * 0.3 * sc], [x + 0.6, ground - h * 0.3 * sc], [x + 1.8, ground]], "#4a3a2a", "#2a2420", 0.6);   // legs
      H.poly(g, [[x - 2.6, ground - h * 0.28 * sc], [x - 2.2, top + 4], [x + 2.2, top + 4], [x + 2.6, ground - h * 0.28 * sc]], colour, "#2a2420", 0.7);   // tabard
      H.circle(g, x, top + 2, 2.3, "#8a8f94", "#2a2420", 0.6);   // helmet
      H.poly(g, [[x - 4.4, top + 5], [x - 1.2, top + 5], [x - 1.2, top + 10], [x - 2.8, top + 12], [x - 4.4, top + 10]], colour, "#2a2420", 0.7);   // shield
      g.fillStyle = "#e8d8a0"; g.fillRect(x - 3.2, top + 7, 0.9, 0.9);
    }
  }
  function sprite(hold) {
    const st = typeof ART !== "undefined" ? ART.style() : "ink", k = hold + "|" + st;
    if (!sprites.has(k) && typeof ART !== "undefined") sprites.set(k, ART.canvas(22, 20, (g, H) => drawPatrol(g, H, 22, 20, tint(hold)), { block: 2 }));
    return sprites.get(k) || null;
  }
  /* map.js: draw the visible patrols ({pos, hold, moving, visible}) */
  function drawMap(g, list, P, s, t, still, zoom, label) {
    for (const p of list || []) {
      if (!p.visible) continue;
      const sp = sprite(p.hold); if (!sp) continue;
      const [x, y] = P(p.pos), bob = p.moving && !still ? Math.abs(Math.sin(t * 7 + x)) * 1.2 * s : 0;
      g.save(); if (p.back) { g.translate(x, 0); g.scale(-1, 1); g.translate(-x, 0); }
      g.drawImage(sp, x - 13 * s, y - 22 * s - bob, 26 * s, 24 * s); g.restore();
      if (zoom >= 2 && label) label(g, `${p.hold} guards`, x, y + 9 * s, s, 10, "#f3e7c4", 600, true);
    }
  }
  /* which patrols to show: the ones near a place you've found */
  function visible(s, t = G.now()) {
    const found = (s.discovered || []).map((n) => WORLD.places[n]).filter(Boolean);
    return patrols(t).map((p) => ({ ...p, visible: found.some((q) => Math.hypot(q[0] - p.pos[0], q[1] - p.pos[1]) < 0.06) }));
  }
  return { SEATS, STOP, SPEED, isGuard, foe, beat, patrols, visible, sprite, drawMap, drawPatrol, tint };
})();
if (typeof module !== "undefined") module.exports = GUARDS;
