/* Free roam: walk to any spot on the map, not just named places. Uses the same route-finding as every trip;
   a spot in the sea or a lake is moved to the nearest walkable ground. [OURS] */
const ROAM = (() => {
  const MAXSNAP = 14;                                  // grid cells (4 map px each) we search for dry land
  const PX = (a, b) => Math.hypot((a[0] - b[0]) * 1000, (a[1] - b[1]) * 700);
  const inMap = (p) => p[0] >= 0 && p[1] >= 0 && p[0] <= 1 && p[1] <= 1;
  const walkable = (p) => inMap(p) && Terrain.SPEED[Terrain.typeAtPos(p)] > 0;
  /* the nearest walkable point, or null if it's far out to sea */
  function snap(p) {
    if (!inMap(p)) return null;
    if (walkable(p)) return p;
    const cx = Math.floor(p[0] * Terrain.GW), cy = Math.floor(p[1] * Terrain.GH);
    for (let r = 1; r <= MAXSNAP; r++) {
      let best = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= Terrain.GW || y >= Terrain.GH) continue;
        if (!(Terrain.SPEED[Terrain.grid[y * Terrain.GW + x]] > 0)) continue;
        const q = [(x + 0.5) / Terrain.GW, (y + 0.5) / Terrain.GH], d = PX(p, q);
        if (d < bd) { bd = d; best = q; }
      }
      if (best) return best;
    }
    return null;
  }
  /* places the player knows about (discovered, or big towns everyone knows) */
  const knownTo = (s, n) => s.discovered.includes(n) || (["city", "town"].includes(WORLD.places[n][2]) && !WORLD.hidden?.has(n));
  function nearest(s, p, onlyKnown = true) {
    let best = null, bd = Infinity;
    for (const [n, pl] of Object.entries(WORLD.places)) {
      if (onlyKnown && !knownTo(s, n)) continue;
      const d = PX(p, pl); if (d < bd) { bd = d; best = n; }
    }
    return best ? { name: best, d: bd } : null;
  }
  const nameFor = (s, p) => { const n = nearest(s, p); return n ? (n.d < 30 ? `the outskirts of ${n.name}` : `the wilds near ${n.name}`) : "the wilds"; };
  /* -> { pos, name, snapped, ground } or { err } */
  function plan(s, p) {
    if (!inMap(p)) return { err: "That's off the edge of the map." };
    const q = snap(p);
    if (!q) return { err: !WORLD.isSol?.(p) && Terrain.typeAtPos(p) === Terrain.T.BEYOND ? "That's beyond Skyrim's borders. Pick a spot inside Skyrim." : "That's open water. Pick a spot on land." };
    if (PX([s.x, s.y], q) < 4) return { err: "You're already there." };
    return { pos: [+q[0].toFixed(4), +q[1].toFixed(4)], name: nameFor(s, q), snapped: q !== p, ground: Terrain.NAMES[Terrain.typeAtPos(q)] };
  }
  /* what you can see when you stop out in the wilds */
  function around(s, p = [s.x, s.y], r = 120) {
    return Object.keys(WORLD.places).filter((n) => s.discovered.includes(n)).map((n) => ({ n, d: PX(p, WORLD.places[n]) }))
      .filter((x) => x.d <= r).sort((a, b) => a.d - b.d).slice(0, 4).map((x) => x.n);
  }
  const isRoam = (name) => typeof name === "string" && /^the (wilds|outskirts)/.test(name);
  return { snap, plan, around, nameFor, nearest, walkable, isRoam };
})();
