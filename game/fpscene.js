/* The road view's land and its scenery director (fpscene.js). [OURS]
   Plain data and rules, no drawing (fpworld.js draws, fptravel.js runs the band):
   - REGIONS: what each kind of land looks like on the road (colours, what grows by the road, how hilly, how far you see).
     tundra (golden grass, rolling hills, boulders), pine (dense woods, dark floor, dappled light), mountain (snowbanks,
     rock faces, steep peaks; bare rock in the Reach), marsh (pools, reeds, dead trees, low fog), ash (charcoal ground,
     jagged rocks, drifting ash), coast (the sea on its real side, cliffs, seabirds, salt haze), valley (a winding river,
     willows, meadows, farms, bridges), autumn (the Rift's golden birches).
   - survey(pos): looks at the ground around you on the map (not just the road under your feet) and says which region it
     is, whether the sea is near and on which bearing, and whether there's river water about. Cached per map cell.
   - plan(route, region, d0, d1, trip): the scenery director. Distance-based and seeded, four tiers:
       ambient  roadside clusters (trees, boulders, shrubs, fences...)        every 2-5 s of riding
       poi      points of interest (signpost, cairn, fallen tree, shrine...)   every 12-25 s
       living   wildlife and travellers (deer, fox, wolves, merchant...)       every 30-60 s
       moment   memorable sights (ruined tower, bridge, waterfall, dragon...)  every 60-120 s
     Region weights pick what comes; a kind waits a few slots before it can come again (cooldown); some slots stay empty
     (quiet stretches); a point of interest never crowds a big moment. The same route always puts the same landmarks in
     the same places (seeded by the route); wildlife and travellers are seeded by the trip too, so they vary.
   Distances are road units (the band rides ~2.8 units a second). */
const FPSCENE = (() => {
  const seeded = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); let a = h | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const V0 = 2.8;   // road units a second on horseback: the tiers' seconds become distances with it

  /* how each region looks from the road. ground/gd: near/far ground; road; grass: blade colours; far/mid/hill/lip: the
     four landscape layers (far peaks → near horizon); peaks: how tall and jagged the far range is; snow: snowline (0 none);
     hills: how much the road climbs and dips; lat: how far from the road things grow [near, far] in road half-widths;
     cluster: members per roadside cluster [min, max]; haze: base distance haze; tint: a light wash over everything;
     belt: the land's own cover along the road (a pine forest is trees on both sides, a tundra is grass and stones):
     chance per stretch and side, how far out, and what grows there [prop, height range, weight]. */
  const REGIONS = {
    tundra: { name: "tundra", ground: "#b09a5c", gd: "#9a8a5a", road: "#a48c66", grass: ["#d2b874", "#b0964e", "#8c7a42"], far: "#8e9aa8", mid: "#8a8c7c", hill: "#a39060", lip: "#b8a066",
      peaks: [0.42, 0.5], snow: 0.55, hills: 1, lat: [1.4, 11], cluster: [1, 4], haze: 0.38, tint: "rgba(255,226,160,0.05)", trees: "pine", hillTrees: 0.12, belt: { p: 0.3, lat: [1.6, 7], m: [["grass", 0.18, 0.3, 4], ["boulder", 0.12, 0.45, 3], ["bush", 0.14, 0.26, 1.5], ["pine", 1.0, 1.6, 0.25]] } },
    pine: { name: "pine", ground: "#3e4c2e", gd: "#4a5636", road: "#8a7656", grass: ["#5f7a3c", "#465e2e", "#33452a"], far: "#7d8ea2", mid: "#41583e", hill: "#2f4630", lip: "#26392a",
      peaks: [0.5, 0.6], snow: 0.5, hills: 0.8, lat: [1.25, 5], cluster: [3, 7], haze: 0.32, tint: "rgba(30,60,40,0.06)", trees: "pine", hillTrees: 1, wall: true, dapple: true, belt: { p: 0.85, lat: [2, 6.5], m: [["pine", 1.4, 2.6, 6], ["fern", 0.12, 0.2, 1], ["boulder", 0.12, 0.25, 0.5]] } },
    mountain: { name: "mountain", ground: "#dfe6ec", gd: "#c7d1da", road: "#cbc5bb", grass: ["#eef3f6", "#c9d3da", "#a9b6c0"], far: "#9fb0c2", mid: "#7f8c98", hill: "#b9c6d0", lip: "#d6dee4",
      peaks: [0.82, 1], snow: 0.75, hills: 1.6, lat: [1.4, 8], cluster: [1, 4], haze: 0.34, tint: "rgba(190,210,235,0.06)", trees: "snowpine", hillTrees: 0.45, steep: true, snowy: true, belt: { p: 0.3, lat: [1.8, 8], m: [["pine", 1.0, 1.8, 2], ["snowbank", 0.2, 0.5, 2], ["boulder", 0.1, 0.25, 1]] } },
    rocky: { name: "rocky", ground: "#8f8068", gd: "#7c705c", road: "#9e8a68", grass: ["#a89a6a", "#8a7c54", "#6c6248"], far: "#8b97a3", mid: "#7c6f60", hill: "#857560", lip: "#8f8068",
      peaks: [0.7, 0.9], snow: 0.82, hills: 1.5, lat: [1.4, 8], cluster: [1, 4], haze: 0.34, tint: "rgba(200,170,130,0.05)", trees: "pine", hillTrees: 0.3, steep: true, belt: { p: 0.35, lat: [1.7, 8], m: [["boulder", 0.2, 0.7, 4], ["pine", 1.0, 1.8, 1], ["grass", 0.16, 0.26, 1]] } },
    marsh: { name: "marsh", ground: "#56603f", gd: "#4c5640", road: "#7d6e54", grass: ["#7d8a4c", "#5e6a3c", "#444e30"], far: "#7f8b92", mid: "#5d6858", hill: "#4e5a44", lip: "#56603f",
      peaks: [0.18, 0.25], snow: 0, hills: 0.2, lat: [1.3, 10], cluster: [2, 5], haze: 0.5, tint: "rgba(80,110,90,0.08)", trees: "dead", hillTrees: 0.35, fog: 0.22, belt: { p: 0.4, lat: [1.5, 8], m: [["reeds", 0.4, 0.8, 4], ["dead", 0.8, 1.5, 1.5], ["grass", 0.16, 0.26, 1]] } },
    ash: { name: "ash", ground: "#4b4542", gd: "#5a524c", road: "#625649", grass: ["#6e665e", "#5a524a", "#3a3430"], far: "#6c5e58", mid: "#4f4540", hill: "#5a504a", lip: "#4b4542",
      peaks: [0.5, 0.75], snow: 0, hills: 1, lat: [1.4, 9], cluster: [1, 4], haze: 0.42, tint: "rgba(140,70,40,0.08)", trees: "dead", hillTrees: 0.1, volcano: true, ash: true, belt: { p: 0.3, lat: [1.6, 8], m: [["jagged", 0.3, 0.8, 2], ["ashmound", 0.25, 0.5, 1], ["dead", 0.8, 1.4, 1]] } },
    coast: { name: "coast", ground: "#8c8e6a", gd: "#7e8268", road: "#a8977a", grass: ["#a6a874", "#878a5c", "#6a6e4c"], far: "#8fa0b2", mid: "#7c8478", hill: "#848a68", lip: "#8c8e6a",
      peaks: [0.3, 0.45], snow: 0.6, hills: 0.8, lat: [1.4, 9], cluster: [1, 4], haze: 0.42, tint: "rgba(170,200,225,0.08)", trees: "pine", hillTrees: 0.2, sea: true, belt: { p: 0.3, lat: [1.6, 6], m: [["grass", 0.18, 0.3, 3], ["boulder", 0.15, 0.5, 2], ["driftwood", 0.25, 0.4, 0.6], ["pine", 1.0, 1.6, 0.4]] } },
    valley: { name: "valley", ground: "#6c8a44", gd: "#7a9050", road: "#a8916c", grass: ["#9ab85c", "#76963e", "#56702e"], far: "#8796a8", mid: "#5f7a4a", hill: "#6f8c4a", lip: "#5f7c3c",
      peaks: [0.45, 0.55], snow: 0.6, hills: 0.6, lat: [1.4, 9], cluster: [1, 5], haze: 0.34, tint: "rgba(255,240,190,0.04)", trees: "broad", hillTrees: 0.6, river: true, fields: true, belt: { p: 0.3, lat: [1.6, 8], m: [["grass", 0.14, 0.24, 3], ["broad", 1.0, 1.5, 1.2], ["flowers", 0.15, 0.3, 1], ["bush", 0.12, 0.2, 1]] } },
    autumn: { name: "autumn", ground: "#9a7c3e", gd: "#a08446", road: "#9e8560", grass: ["#d0a048", "#a8783a", "#7a5a2c"], far: "#8a8ea6", mid: "#a8743a", hill: "#b07a36", lip: "#9a6a30",
      peaks: [0.45, 0.55], snow: 0.6, hills: 0.7, lat: [1.3, 7], cluster: [2, 6], haze: 0.32, tint: "rgba(255,190,110,0.06)", trees: "birch", hillTrees: 0.9, belt: { p: 0.6, lat: [1.8, 6], m: [["birch", 1.0, 1.6, 4], ["bush", 0.12, 0.22, 1], ["grass", 0.14, 0.24, 1]] } },
  };

  /* a terrain name (Terrain.NAMES) → region, when nothing better is known */
  const GROUND = {
    "Road": "tundra", "Bridge": "valley", "Grassland": "tundra", "Tundra": "tundra", "Forest": "pine", "Pine forest": "pine", "Autumn forest": "autumn",
    "Marsh": "marsh", "Snow": "mountain", "Volcanic tundra": "ash", "Ash wastes": "ash", "Rocky hills": "rocky", "Mountains": "rocky", "High peaks": "mountain",
    "River (ford)": "valley", "Lake": "valley", "Sea": "coast",
  };
  const regionOf = (ground, sv) => (sv && REGIONS[sv.region] ? sv.region : GROUND[ground] || "tundra");

  // ---------------------------------------------------------------- what's around you (the map)
  const svCache = new Map();
  /* pos = [x, y] in 0..1 of the map. Rings of samples out to ~26 cells; roads, bridges and the border don't count. */
  function survey(pos, TR) {
    TR = TR || (typeof Terrain !== "undefined" ? Terrain : null);
    if (!TR || !pos || !(pos[0] >= 0 && pos[0] <= 1 && pos[1] >= 0 && pos[1] <= 1)) return null;
    const GW = TR.GW || 250, GH = TR.GH || 175, cx = Math.floor(pos[0] * GW / 3), cy = Math.floor(pos[1] * GH / 3), key = cx + "," + cy;
    if (svCache.has(key)) return svCache.get(key);
    const T = TR.T, N = TR.NAMES, count = {}; let sea = 0, seaX = 0, seaY = 0, water = 0, n = 0;
    for (const r of [0, 4, 9, 16, 26]) for (let k = 0; k < (r ? 12 : 1); k++) {
      const a = k / 12 * Math.PI * 2, p = [pos[0] + Math.sin(a) * r / GW, pos[1] - Math.cos(a) * r / GH];
      if (!(p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1)) continue;
      const t = TR.typeAtPos(p); n++;
      if (t === T.SEA) { sea++; seaX += Math.sin(a); seaY += Math.cos(a); continue; }
      if (t === T.RIVER || t === T.LAKE || t === T.BRIDGE) { water++; if (t !== T.BRIDGE) continue; }
      if (t === T.ROAD || t === T.BRIDGE || t === T.BEYOND) continue;
      const nm = N[t]; count[nm] = (count[nm] || 0) + (r <= 9 ? 2 : 1);   // the land close by counts double
    }
    let best = "", bw = 0; for (const [k, v] of Object.entries(count)) if (v > bw) { best = k; bw = v; }
    let region = GROUND[best] || "tundra";
    const coast = sea >= 4, nearWater = water >= 2;
    if (coast && region !== "mountain" && region !== "ash") region = "coast";
    else if (nearWater && (region === "tundra" || region === "pine" && (count["Grassland"] || 0) > 2)) region = "valley";
    if (best === "Grassland" && !coast && region === "tundra" && (count["Grassland"] || 0) > (count["Tundra"] || 0) * 2 && (count["Forest"] || 0) > 0) region = "valley";
    const out = { region, ground: best, sea: coast, seaBear: sea ? (Math.atan2(seaX, seaY) * 180 / Math.PI + 360) % 360 : null, water: nearWater, n };
    svCache.set(key, out); if (svCache.size > 400) svCache.delete(svCache.keys().next().value);
    return out;
  }

  // ---------------------------------------------------------------- the scenery director
  const TIERS = {   // seconds between slots [min, max], quiet chance, cooldown (slots before a kind may come again)
    ambient: { s: [2, 5], quiet: 0.06, cool: 0 },
    poi: { s: [12, 25], quiet: 0.15, cool: 2 },
    living: { s: [30, 60], quiet: 0.15, cool: 2 },
    moment: { s: [60, 120], quiet: 0.12, cool: 3 },
  };
  /* what each region shows, by tier (weights) */
  const W = {
    tundra: { ambient: { grass: 4, boulders: 3, shrubs: 2, lonepine: 1.2, stones: 1 },
      poi: { sign: 2, cairn: 2, stone: 1.5, shrine: 1, lamp: 0.8, fallen: 0.3 },
      living: { mammoths: 1.4, patrol: 1.2, fox: 1.2, deer: 1, wolves: 1, merchant: 1, birds: 1, pilgrims: 0.8 },
      moment: { tower: 1.5, oldcamp: 1, dragon: 0.8, bridge: 0.6, giants: 1 } },
    pine: { ambient: { pines: 6, ferns: 2, mossy: 1.5, stumps: 1, deadfall: 0.5 },
      poi: { fallen: 2.5, sign: 1.5, shrine: 1.2, cairn: 0.8, stone: 0.8, lamp: 0.5 },
      living: { deer: 2, fox: 1.5, wolves: 1.2, birds: 0.8, patrol: 0.8, merchant: 0.6, pilgrims: 0.5 },
      moment: { waterfall: 1.5, oldcamp: 1.5, bridge: 1, tower: 0.8, fogbank: 0.8, dragon: 0.4 } },
    mountain: { ambient: { snowpines: 3, snowbank: 2.5, boulders: 2, rockface: 2 },
      poi: { cairn: 2.5, sign: 1, shrine: 1, stone: 1 },
      living: { wolves: 1.5, pilgrims: 1.2, birds: 1, patrol: 0.8, deer: 0.7, merchant: 0.4 },
      moment: { waterfall: 1.5, tower: 1.2, dragon: 1.2, fogbank: 1, oldcamp: 0.6, bridge: 0.6 } },
    rocky: { ambient: { boulders: 3, rockface: 2.5, lonepine: 1.5, shrubs: 1.5, grass: 1 },
      poi: { cairn: 2, stone: 1.5, sign: 1.2, shrine: 1 },
      living: { wolves: 1.2, birds: 1.2, patrol: 1, pilgrims: 0.8, deer: 0.6, merchant: 0.6 },
      moment: { tower: 1.5, waterfall: 1.2, dragon: 1, oldcamp: 0.8, bridge: 0.6 } },
    marsh: { ambient: { reeds: 4, pool: 3, deadtrees: 2.5, stumps: 1, grass: 1 },
      poi: { fallen: 1.5, lamp: 1.2, sign: 1, stone: 1, shrine: 0.8 },
      living: { birds: 2, fox: 0.8, pilgrims: 0.5, patrol: 0.6, deer: 0.5, merchant: 0.4 },
      moment: { fogbank: 2, tower: 1, oldcamp: 1, bridge: 1 } },
    ash: { ambient: { jagged: 4, deadtrees: 2, ashmound: 2, vent: 1 },
      poi: { cairn: 2, shrine: 1.5, stone: 1.2 },
      living: { pilgrims: 1.2, patrol: 0.8, merchant: 0.6, wolves: 0.5, birds: 0.4 },
      moment: { tower: 1, oldcamp: 1, dragon: 1, fogbank: 1 } },
    coast: { ambient: { grass: 3, boulders: 3, driftwood: 1.5, shrubs: 1.5, lonepine: 1 },
      poi: { sign: 1.5, cairn: 1.5, shrine: 1, lamp: 1 },
      living: { birds: 2.5, horker: 2, patrol: 0.8, merchant: 0.8, fox: 0.6 },
      moment: { shipwreck: 2, tower: 1, fogbank: 1, waterfall: 0.6, dragon: 0.5 } },
    valley: { ambient: { broad: 3, flowers: 2.5, willow: 2, fence: 1.5, shrubs: 1.5, haystack: 0.8 },
      poi: { sign: 2, shrine: 1.5, lamp: 1.5, fallen: 0.6, stone: 0.5 },
      living: { merchant: 1.5, deer: 1.2, fox: 1.2, patrol: 1.2, pilgrims: 1, birds: 1 },
      moment: { bridge: 2, waterfall: 1, tower: 1, oldcamp: 0.6, dragon: 0.5 } },
    autumn: { ambient: { birches: 5, shrubs: 1.5, pines: 1, ferns: 1 },
      poi: { sign: 1.5, shrine: 1.5, fallen: 1, stone: 1, lamp: 1 },
      living: { deer: 1.5, fox: 1.5, merchant: 1, patrol: 0.8, pilgrims: 0.8, birds: 0.8 },
      moment: { bridge: 1, waterfall: 1, tower: 1, oldcamp: 1, fogbank: 0.8 } },
  };
  const GAP = { poi: 12, living: 6 };   // a point of interest / encounter keeps this far from a big moment
  const plans = new Map();
  function pickW(r, wts, skip) {
    let sum = 0; for (const [k, v] of Object.entries(wts)) if (!skip.has(k)) sum += v;
    if (sum <= 0) return null;
    let x = r() * sum; for (const [k, v] of Object.entries(wts)) { if (skip.has(k)) continue; x -= v; if (x <= 0) return k; }
    return null;
  }
  /* one tier's slots from the start of the route up to `to`, built once and extended as you go */
  function tierList(route, region, tier, trip, to) {
    const seedKey = (tier === "living" ? route + "|" + trip : route) + "|" + tier, key = seedKey + "|" + region;
    let P = plans.get(key);
    if (!P) { P = { list: [], d: 0, i: 0, rPos: seeded(seedKey), recent: [] }; plans.set(key, P); if (plans.size > 64) plans.delete(plans.keys().next().value); }
    const T = TIERS[tier], wts = (W[region] || W.tundra)[tier];
    while (P.d <= to && P.i < 20000) {
      const rp = P.rPos;
      P.d += (T.s[0] + rp() * (T.s[1] - T.s[0])) * V0;
      const quiet = rp() < T.quiet, side = rp() < 0.5 ? -1 : 1, seed = Math.floor(rp() * 1e9);
      const r = seeded(seedKey + "|" + P.i + "|" + region);
      const kind = quiet ? null : pickW(r, wts, new Set(P.recent.slice(-T.cool).filter(Boolean)));
      if (T.cool) P.recent.push(kind);
      if (P.recent.length > 8) P.recent.shift();
      P.list.push({ d: P.d, tier, kind, side, seed, i: P.i });
      P.i++;
    }
    return P.list;
  }
  /* everything the director places between d0 and d1 (kind null = a quiet slot, left out) */
  function plan(route, region, d0, d1, trip = "") {
    route = String(route || "road"); region = W[region] ? region : "tundra";
    const out = [], moments = tierList(route, region, "moment", trip, d1 + 40).filter((e) => e.kind);
    for (const tier of ["ambient", "poi", "living", "moment"]) {
      const L = tier === "moment" ? moments : tierList(route, region, tier, trip, d1);
      for (const e of L) {
        if (e.d < d0 || e.d > d1 || !e.kind) continue;
        if (GAP[tier] && moments.some((m) => Math.abs(m.d - e.d) < GAP[tier])) continue;
        out.push(e);
      }
    }
    return out.sort((a, b) => a.d - b.d);
  }
  /* the road's own shape along a route: bends (lateral, in road half-widths) and rises (camera heights), seeded */
  function shape(route) {
    const r = seeded("shape|" + route);
    return { b: [r() * 6.28, r() * 6.28, r() * 6.28], e: [r() * 6.28, r() * 6.28] };
  }

  return { REGIONS, GROUND, TIERS, WEIGHTS: W, GAP, V0, regionOf, survey, plan, shape, seeded, _reset: () => { plans.clear(); svCache.clear(); } };
})();
