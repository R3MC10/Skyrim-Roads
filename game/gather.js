/* Ingredient gathering [Skyrim-style harvesting, our own rules where marked [OURS]].
   - Plant patches grow all over the map, picked by the ground and hold they stand in (Juniper and Canis Root in the Reach,
     Swamp Fungal Pods in the Hjaalmarch marsh, Dragon's Tongue at the Eastmarch hot springs, Snowberries in the snow,
     Nirnroot by rivers, ash plants on Solstheim...). You spot patches as you travel past; they show on the map as leaves.
     Stand near one (or pass close on the road) and Gather. A picked patch grows back after two in-game days.
   - Forage: search the wild ground around you for whatever grows there (night brings out moths, torchbugs, glowing Nirnroot).
   - Dungeons: damp rooms sometimes have fungi on the walls (Imp Stool, Bleeding Crown, White Cap, Blisterwort...).
   - Creature parts: beasts you kill drop their parts (Bear Claws, Sabre Cat Tooth, Troll Fat, Spider Egg, Hagraven Feathers...).
   - Gardens: plant up to three beds with ingredients you carry; each harvest grows what you planted.
   - Green Thumb (Alchemy) doubles everything you pick. The Herbalist's Notes list every ingredient, where it grows and the
     effects you've learned, coloured green (good for you) or red (poisons). */
const GATHER = (() => {
  const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1));
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const GAME_DAY = 2 * 3600;                 // real seconds in one in-game day
  const RESPAWN = 2 * GAME_DAY;              // [OURS] a picked patch grows back in two in-game days
  const SPOT_PX = 24, REACH_PX = 42;         // spot patches you pass this close; gather ones this close to you
  const FORAGE_COOLDOWN = GAME_DAY / 12;     // [OURS] one search of the ground per in-game two hours
  const ROOM_HERB_CHANCE = 0.22;             // [OURS] chance a dungeon room has something growing on its walls

  // ------------------------------------------------------------------ new ingredients [Skyrim effects, UESP Skyrim:Ingredients]
  const NEW_FX = {
    "Invisibility": [100, 0, 4, "none", true], "Waterbreathing": [5, 0, 5, "none", true], "Fear": [5, 1, 30, "none", false],
  };
  const NEW_ING = {
    ing_nirnroot: ["Nirnroot", ["Damage Health", "Damage Stamina", "Invisibility", "Resist Magic"], 10, 0.2],
    ing_crimson_nirnroot: ["Crimson Nirnroot", ["Damage Health", "Damage Stamina", "Invisibility", "Resist Magic"], 10, 0.2],
    ing_jazbay: ["Jazbay Grapes", ["Weakness to Magic", "Fortify Magicka", "Regenerate Magicka", "Ravage Health"], 1, 0.2],
    ing_scaly_pholiota: ["Scaly Pholiota", ["Weakness to Magic", "Fortify Illusion", "Regenerate Stamina", "Fortify Carry Weight"], 4, 0.25],
    ing_hanging_moss: ["Hanging Moss", ["Damage Magicka", "Fortify Health", "Damage Magicka Regen", "Fortify One-handed"], 1, 0.25],
    ing_bleeding_crown: ["Bleeding Crown", ["Weakness to Fire", "Fortify Block", "Weakness to Poison", "Resist Magic"], 10, 0.3],
    ing_white_cap: ["White Cap", ["Weakness to Frost", "Fortify Heavy Armor", "Restore Magicka", "Ravage Magicka"], 0, 0.3],
    ing_blisterwort: ["Blisterwort", ["Damage Stamina", "Frenzy", "Restore Health", "Fortify Smithing"], 2, 0.2],
    ing_fly_amanita: ["Fly Amanita", ["Resist Fire", "Fortify Two-handed", "Frenzy", "Regenerate Stamina"], 2, 0.1],
    ing_namiras_rot: ["Namira's Rot", ["Damage Magicka", "Fortify Lockpicking", "Fear", "Regenerate Health"], 0, 0.25],
    ing_small_pearl: ["Small Pearl", ["Restore Stamina", "Fortify One-handed", "Fortify Restoration", "Resist Frost"], 2, 0.1],
    ing_pearl: ["Pearl", ["Restore Stamina", "Restore Magicka", "Fortify Block", "Resist Shock"], 2, 0.1],
    ing_rock_warbler_egg: ["Rock Warbler Egg", ["Restore Health", "Fortify One-handed", "Damage Stamina", "Weakness to Magic"], 2, 0.5],
    ing_pine_thrush_egg: ["Pine Thrush Egg", ["Restore Stamina", "Fortify Lockpicking", "Weakness to Poison", "Resist Shock"], 2, 0.5],
    ing_salmon_roe: ["Salmon Roe", ["Restore Stamina", "Waterbreathing", "Fortify Magicka", "Regenerate Magicka"], 5, 0.2],
    ing_luna_moth: ["Luna Moth Wing", ["Damage Magicka", "Fortify Light Armor", "Regenerate Health", "Invisibility"], 4, 0.1],
    ing_torchbug: ["Torchbug Thorax", ["Restore Stamina", "Lingering Damage Magicka", "Weakness to Magic", "Fortify Stamina"], 1, 0.1],
    ing_bee: ["Bee", ["Restore Stamina", "Ravage Stamina", "Regenerate Stamina", "Weakness to Shock"], 3, 0.1],
    ing_sabre_tooth: ["Sabre Cat Tooth", ["Restore Stamina", "Fortify Heavy Armor", "Fortify Smithing", "Weakness to Poison"], 2, 0.1],
    ing_hagraven_feathers: ["Hagraven Feathers", ["Damage Magicka", "Fortify Conjuration", "Frenzy", "Weakness to Shock"], 20, 0.1],
    ing_hagraven_claw: ["Hagraven Claw", ["Resist Magic", "Lingering Damage Magicka", "Fortify Enchanting", "Fortify Barter"], 20, 0.25],
    ing_chaurus_eggs: ["Chaurus Eggs", ["Weakness to Poison", "Fortify Stamina", "Damage Magicka", "Invisibility"], 10, 0.2],
    ing_falmer_ear: ["Falmer Ear", ["Damage Health", "Frenzy", "Resist Poison", "Fortify Lockpicking"], 10, 0.2],
    ing_ice_wraith_teeth: ["Ice Wraith Teeth", ["Weakness to Frost", "Fortify Heavy Armor", "Invisibility", "Weakness to Fire"], 30, 0.25],
    ing_taproot: ["Taproot", ["Weakness to Magic", "Fortify Illusion", "Regenerate Magicka", "Restore Magicka"], 15, 0.5],
    ing_vampire_dust: ["Vampire Dust", ["Invisibility", "Restore Magicka", "Regenerate Health", "Cure Disease"], 25, 0.2],
    ing_frostbite_venom: ["Frostbite Venom", ["Resist Frost", "Paralysis", "Ravage Health", "Fortify Light Armor"], 3, 0.1],
    ing_horker_tusk: ["Horker Tusk", ["Damage Magicka", "Restore Health", "Fortify Conjuration", "Fortify Smithing"], 2, 1],
    ing_ectoplasm: ["Ectoplasm", ["Restore Magicka", "Fortify Destruction", "Fortify Magicka", "Damage Health"], 25, 0.1],
    ing_netch_jelly: ["Netch Jelly", ["Paralysis", "Fortify Carry Weight", "Restore Stamina", "Fear"], 20, 0.5],
    ing_ash_hopper_jelly: ["Ash Hopper Jelly", ["Restore Health", "Fortify Light Armor", "Resist Shock", "Frenzy"], 20, 0.25],
    ing_ash_creep: ["Ash Creep Cluster", ["Damage Stamina", "Invisibility", "Resist Fire", "Fortify Destruction"], 20, 0.25],
    ing_scathecraw: ["Scathecraw", ["Ravage Health", "Ravage Stamina", "Ravage Magicka", "Lingering Damage Health"], 20, 0.25],
    ing_trama_root: ["Trama Root", ["Weakness to Shock", "Fortify Carry Weight", "Damage Magicka", "Slow"], 20, 0.1],
    ing_spawn_ash: ["Spawn Ash", ["Ravage Stamina", "Resist Fire", "Fortify Enchanting", "Ravage Magicka"], 20, 0.1],
    ing_tern_feathers: ["Felsaad Tern Feathers", ["Restore Health", "Fortify Light Armor", "Cure Disease", "Resist Magic"], 15, 0.1],
  };
  function install() {
    if (typeof TOWNS === "undefined") return;
    for (const [k, v] of Object.entries(NEW_FX)) if (!TOWNS.EFFECTS[k]) TOWNS.EFFECTS[k] = v;
    for (const [id, row] of Object.entries(NEW_ING)) {
      if (!TOWNS.INGREDIENT_FX[id]) TOWNS.INGREDIENT_FX[id] = row;
      if (!D.ITEMS[id]) D.ITEMS[id] = { name: row[0], slot: "ingredient", weight: row[3], value: row[2] };
    }
  }
  install();

  // ------------------------------------------------------------------ where things grow
  // [Skyrim] habitats from UESP; weights are [OURS]
  const TY = { SEA: 0, LAKE: 1, RIVER: 2, ROAD: 3, BRIDGE: 4, GRASS: 5, TUNDRA: 6, FOREST: 7, PINE: 8, AUTUMN: 9, MARSH: 10, SNOW: 11, VOLCANIC: 12, ROCKY: 13, MOUNTAIN: 14, PEAK: 15, ASH: 16, BEYOND: 17 };
  const BIOME = {
    [TY.GRASS]: [["ing_lavender", 4], ["ing_blue_flower", 3], ["ing_red_flower", 3], ["ing_purple_flower", 2], ["ing_thistle", 1], ["ing_bee", 1]],
    [TY.TUNDRA]: [["ing_tundra_cotton", 4], ["ing_lavender", 2], ["ing_blue_flower", 2], ["ing_red_flower", 2], ["ing_thistle", 2], ["ing_rock_warbler_egg", 1]],
    [TY.FOREST]: [["ing_hanging_moss", 2], ["ing_purple_flower", 2], ["ing_fly_amanita", 2], ["ing_blue_flower", 2], ["ing_nightshade", 1], ["ing_pine_thrush_egg", 1]],
    [TY.PINE]: [["ing_fly_amanita", 2], ["ing_hanging_moss", 2], ["ing_purple_flower", 2], ["ing_deathbell", 1], ["ing_nightshade", 1], ["ing_pine_thrush_egg", 1], ["ing_scaly_pholiota", 1]],
    [TY.AUTUMN]: [["ing_elves_ear", 2], ["ing_purple_flower", 2], ["ing_blue_flower", 2], ["ing_fly_amanita", 2], ["ing_hanging_moss", 1], ["ing_bee", 1], ["ing_scaly_pholiota", 1]],
    [TY.MARSH]: [["ing_fungal_pod", 4], ["ing_deathbell", 3], ["ing_hanging_moss", 1], ["ing_nightshade", 1]],
    [TY.SNOW]: [["ing_snowberries", 4], ["ing_frost_mirriam", 3], ["ing_thistle", 2]],
    [TY.VOLCANIC]: [["ing_dragons_tongue", 4], ["ing_creep_cluster", 3], ["ing_jazbay", 2], ["ing_scaly_pholiota", 1]],
    [TY.ROCKY]: [["ing_thistle", 2], ["ing_red_flower", 2], ["ing_tundra_cotton", 1], ["ing_rock_warbler_egg", 1], ["ing_frost_mirriam", 1]],
    [TY.MOUNTAIN]: [["ing_snowberries", 2], ["ing_frost_mirriam", 2], ["ing_thistle", 1], ["ing_rock_warbler_egg", 1]],
    [TY.ASH]: [["ing_ash_creep", 3], ["ing_scathecraw", 3], ["ing_trama_root", 2], ["ing_spawn_ash", 1]],
  };
  // a hold's own plants push in alongside the ground's
  const HOLD_EXTRA = {
    "The Reach": [["ing_juniper", 4], ["ing_canis_root", 4], ["ing_nightshade", 1]],
    "Hjaalmarch": [["ing_fungal_pod", 2], ["ing_deathbell", 2]],
    "Falkreath": [["ing_deathbell", 2], ["ing_nightshade", 2], ["ing_hanging_moss", 1]],
    "Eastmarch": [["ing_jazbay", 2], ["ing_creep_cluster", 1], ["ing_dragons_tongue", 1]],
    "The Rift": [["ing_elves_ear", 2], ["ing_fly_amanita", 1]],
    "Winterhold": [["ing_snowberries", 2], ["ing_frost_mirriam", 1]],
    "The Pale": [["ing_snowberries", 1], ["ing_frost_mirriam", 2]],
    "Whiterun": [["ing_lavender", 2]],
    "Haafingar": [["ing_juniper", 1], ["ing_purple_flower", 1]],
    "Solstheim": [["ing_tern_feathers", 1]],
  };
  const WATER = [["ing_nirnroot", 3], ["ing_salmon_roe", 1]];
  const COAST = [["ing_small_pearl", 3], ["ing_pearl", 1]];
  const CAVE = [["ing_imp_stool", 3], ["ing_bleeding_crown", 3], ["ing_white_cap", 3], ["ing_blisterwort", 2], ["ing_namiras_rot", 2], ["ing_glowing_mushroom", 2], ["ing_hanging_moss", 1]];
  const NIGHT = [["ing_luna_moth", 3], ["ing_torchbug", 3], ["ing_nirnroot", 1]];
  const DAY = [["ing_butterfly", 2], ["ing_bee", 2]];

  // a few words on where each one is found (shown in the notes)
  const WHERE = {};
  const note = (id, txt) => { WHERE[id] = WHERE[id] ? WHERE[id] : txt; };
  const TNAME = { [TY.GRASS]: "grassland", [TY.TUNDRA]: "tundra", [TY.FOREST]: "forests", [TY.PINE]: "pine forests", [TY.AUTUMN]: "the Rift's autumn woods", [TY.MARSH]: "marshes",
    [TY.SNOW]: "snowfields", [TY.VOLCANIC]: "volcanic hot springs", [TY.ROCKY]: "rocky hills", [TY.MOUNTAIN]: "mountainsides", [TY.ASH]: "Solstheim's ash wastes" };
  for (const [ty, list] of Object.entries(BIOME)) for (const [id] of list) WHERE[id] = (WHERE[id] ? WHERE[id] + ", " : "") + TNAME[ty];
  for (const [h, list] of Object.entries(HOLD_EXTRA)) for (const [id] of list) WHERE[id] = (WHERE[id] ? WHERE[id] + ", " : "") + h;
  for (const [id] of WATER) WHERE[id] = (WHERE[id] ? WHERE[id] + ", " : "") + "river and lake banks";
  for (const [id] of COAST) WHERE[id] = (WHERE[id] ? WHERE[id] + ", " : "") + "clams on the coast";
  for (const [id] of CAVE) WHERE[id] = (WHERE[id] ? WHERE[id] + ", " : "") + "caves and barrows";
  note("ing_luna_moth", "night, out in the wild"); note("ing_torchbug", "night, out in the wild"); note("ing_butterfly", "daytime meadows");
  const PARTS_WHERE = { ing_bear_claws: "bears", ing_sabre_tooth: "sabre cats", ing_skeever_tail: "skeevers", ing_mudcrab: "mudcrabs", ing_troll_fat: "trolls",
    ing_spider_egg: "frostbite spiders", ing_frostbite_venom: "frostbite spiders", ing_giants_toe: "giants", ing_hagraven_feathers: "hagravens", ing_hagraven_claw: "hagravens",
    ing_chaurus_eggs: "chaurus", ing_falmer_ear: "falmer", ing_ice_wraith_teeth: "ice wraiths", ing_taproot: "spriggans", ing_wisp: "wispmothers",
    ing_vampire_dust: "vampires", ing_horker_tusk: "horkers", ing_ectoplasm: "ghosts", ing_netch_jelly: "netch", ing_ash_hopper_jelly: "ash hoppers", ing_spawn_ash: "ash spawn",
    ing_bone_meal: "skeletons and draugr" };
  for (const [id, who] of Object.entries(PARTS_WHERE)) WHERE[id] = (WHERE[id] ? WHERE[id] + ", " : "") + "from " + who;

  // ------------------------------------------------------------------ the patches (deterministic, the same on every phone)
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263 + 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const pickW = (list, r) => { const tot = list.reduce((a, [, w]) => a + w, 0); let x = r * tot; for (const [id, w] of list) { if (x < w) return id; x -= w; } return list[0][0]; };
  const MW = 1000, MH = 700;   // map pixels per region
  const pxd = (a, b) => Math.hypot((a[0] - b[0]) * MW, (a[1] - b[1]) * MH);
  let NODES = null, BY = null, BUCKET = 60;
  const holdOf = (pos) => (WORLD.isSol?.(pos) ? "Solstheim" : WORLD.holdAt ? WORLD.holdAt(pos) : "");
  function near(pos, types, r = 10) {
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) {
      const t = Terrain.typeAtPos([pos[0] + dx / MW, pos[1] + dy / MH]);
      if (types.includes(t)) return true;
    }
    return false;
  }
  function plantsAt(pos) {
    const ty = Terrain.typeAtPos(pos), base = BIOME[ty];
    if (!base) return null;
    const list = [...base, ...(HOLD_EXTRA[holdOf(pos)] || [])];
    if (ty !== TY.SNOW && ty !== TY.ASH && near(pos, [TY.RIVER, TY.LAKE])) list.push(...WATER);
    if (near(pos, [TY.SEA], 12)) list.push(...COAST);
    return list;
  }
  function build() {
    NODES = []; BY = new Map();
    const regions = [[0, "s"]]; if (WORLD.SOL_OY) regions.push([WORLD.SOL_OY, "o"]);
    for (const [oy, tag] of regions) {
      const CELL = tag === "o" ? 32 : 22;   // one possible patch per cell: denser on the mainland, sparser on the island
      for (let gy = 0; gy < MH / CELL; gy++) for (let gx = 0; gx < MW / CELL; gx++) {
        const r0 = hash(gx * 7 + (tag === "o" ? 911 : 0), gy * 13 + 3);
        if (r0 > 0.42) continue;                                     // [OURS] about two cells in five have a patch
        const x = (gx + 0.15 + 0.7 * hash(gx, gy * 5 + 17)) * CELL / MW, y = oy + (gy + 0.15 + 0.7 * hash(gx * 3 + 5, gy)) * CELL / MH;
        const pos = [+x.toFixed(4), +y.toFixed(4)];
        let list; try { list = plantsAt(pos); } catch (e) { list = null; }
        if (!list) continue;
        const ing = pickW(list, hash(gx * 31 + 7, gy * 17 + (tag === "o" ? 5 : 1)));
        const n = { id: `${tag}${gx}-${gy}`, pos, ing };
        NODES.push(n);
        const k = bkey(pos); if (!BY.has(k)) BY.set(k, []); BY.get(k).push(n);
      }
    }
  }
  const bkey = (pos) => `${Math.floor(pos[0] * MW / BUCKET)}:${Math.floor(pos[1] * MH / BUCKET)}`;
  function nodes() { if (!NODES) build(); return NODES; }
  function around(pos, px) {
    nodes();
    const bx = Math.floor(pos[0] * MW / BUCKET), by = Math.floor(pos[1] * MH / BUCKET), reach = Math.ceil(px / BUCKET), out = [];
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) for (const n of BY.get(`${bx + dx}:${by + dy}`) || []) if (pxd(pos, n.pos) <= px) out.push(n);
    return out;
  }
  const byId = (id) => nodes().find((n) => n.id === id);

  // ------------------------------------------------------------------ the player's record
  // a save can carry a half-filled record (an old build, a synced copy): fill in what's missing so picking never throws
  function st(s) {
    const g = (s.gather = s.gather && typeof s.gather === "object" ? s.gather : {});
    for (const k of ["seen", "picked", "beds", "got"]) if (!g[k] || typeof g[k] !== "object") g[k] = {};
    if (typeof g.auto !== "boolean") g.auto = false;
    if (!Number.isFinite(g.forage)) g.forage = 0;
    return g;
  }
  const ripe = (s, n, t = G.now()) => !(st(s).picked[n.id] && t - st(s).picked[n.id] < respawn(s));
  const growsIn = (s, n, t = G.now()) => Math.max(0, respawn(s) - (t - (st(s).picked[n.id] || 0)));
  const thumb = (s) => (G.P(s, "green_thumb") ? 2 : 1);
  const pnum = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  const spotPx = (s) => SPOT_PX * (1 + Math.min(1, pnum(s, "gspot")));           // Forager: spot patches from farther
  const respawn = (s) => RESPAWN * (1 - Math.min(0.5, pnum(s, "regrow")));      // Wildcrafter: patches grow back faster
  const name = (id) => D.ITEMS[id]?.name || id;
  function giveIng(s, id, n) { G.give(s, id, n); const g = st(s).got; g[id] = (g[id] || 0) + n; }

  /* called every travel step from the engine: spot patches you pass; with auto-gather on, pick them too */
  function onStep(s, log, t = G.now()) {
    const g = st(s), here = [s.x, s.y];
    for (const n of around(here, spotPx(s))) {
      if (!g.seen[n.id]) { g.seen[n.id] = 1; if (!g.auto) log?.(` Spotted ${name(n.ing)} growing by the way`); }
      if (g.auto && ripe(s, n, t)) { const r = pick(s, n.id, t, true); if (r.ok) log?.(` ${r.text}`); }
    }
  }
  function nearby(s, t = G.now()) {
    if (!Number.isFinite(s.x)) return [];
    return around([s.x, s.y], REACH_PX).filter((n) => st(s).seen[n.id] || pxd([s.x, s.y], n.pos) <= SPOT_PX)
      .map((n) => ({ ...n, ripe: ripe(s, n, t), d: pxd([s.x, s.y], n.pos) })).sort((a, b) => a.d - b.d).slice(0, 8);
  }
  /* opt.grade: how a hand harvest went (harvestgame.js): "fail" | "good" | "perfect"; none = a quick pick (Gather all, auto-pick, Quick) */
  function pick(s, id, t = G.now(), passing = false, opt = {}) {
    const n = byId(id);
    if (!n) return { err: "Nothing grows there." };
    if (!passing && !(pxd([s.x, s.y], n.pos) <= REACH_PX + 1)) return { err: "That patch is too far away. Walk closer." };
    if (!ripe(s, n, t)) return { err: `Already picked. It grows back in about ${Math.ceil(growsIn(s, n, t) / 300)} in-game hours.` };
    const grade = opt && /^(fail|good|perfect)$/.test(opt.grade) ? opt.grade : "quick";
    const H = typeof HARVEST !== "undefined" ? HARVEST : null;
    const k = (H ? H.amount(s, n.ing, grade) : n.ing === "ing_nirnroot" || /pearl/.test(n.ing) ? 1 : rint(1, 3)) * thumb(s);   // [Skyrim] Nirnroot and clams give one; [OURS] harvest.js
    st(s).seen[n.id] = 1; st(s).picked[n.id] = t;
    giveIng(s, n.ing, k);
    const rare = H ? H.afterPick(s, n.ing, grade, t) : null;   // a perfect or glowing specimen, and how often you've picked this by hand
    return { ok: true, text: `You gather ${name(n.ing)} ×${k}${thumb(s) > 1 ? " (Green Thumb)" : ""}.${rare ? ` One is ${rare.word.toLowerCase()}!` : ""}`, item: n.ing, n: k, grade, rare };
  }
  function pickAll(s, t = G.now()) {
    const got = nearby(s, t).filter((n) => n.ripe).map((n) => pick(s, n.id, t)).filter((r) => r.ok);
    if (!got.length) return { err: "Nothing ripe within reach." };
    const sum = {}; for (const r of got) sum[r.item] = (sum[r.item] || 0) + r.n;
    return { ok: true, text: `You gather ${Object.entries(sum).map(([it, n]) => `${name(it)} ×${n}`).join(", ")}.` };
  }

  /* searching the ground where you stand */
  function canForage(s, t = G.now()) {
    if (!Number.isFinite(s.x) || s.dungeon) return { ok: false, why: "" };
    if (s.location && typeof TOWNS !== "undefined" && /city|town/.test(WORLD.places[s.location]?.[2] || "") && !s.trip) return { ok: false, why: "Nothing to forage in town. Head out into the wild." };
    const left = (st(s).forage || 0) + FORAGE_COOLDOWN - t;
    if (left > 0) return { ok: false, why: `You've searched around here lately. Try again in about ${Math.ceil(left / 60)} min.`, left };
    return { ok: true };
  }
  function forage(s, t = G.now()) {
    const c = canForage(s, t);
    if (!c.ok) return { err: c.why || "You can't forage here." };
    st(s).forage = t;
    const pos = [s.x, s.y], list = [...(plantsAt(pos) || [["ing_thistle", 1]])];
    const night = G.isNight ? G.isNight(t) : false;
    list.push(...(night ? NIGHT : DAY));
    if (night && near(pos, [TY.RIVER, TY.LAKE])) list.push(["ing_nirnroot", 4]);   // [OURS] Nirnroot's glow gives it away at night
    if (pnum(s, "grare")) list.push(["ing_nirnroot", 2], ["ing_glowing_mushroom", 2], ["ing_pearl", 1]);   // Wildcrafter: rare finds
    const rolls = 1 + (Math.random() < 0.6 ? 1 : 0) + (G.skill(s, "Alchemy") >= 50 ? 1 : 0) + Math.min(1, pnum(s, "forage")), sum = {};   // Forager: one more
    for (let i = 0; i < rolls; i++) { if (Math.random() < 0.2) continue; const id = pickW(list, Math.random()); sum[id] = (sum[id] || 0) + thumb(s); }
    if (!Object.keys(sum).length) return { ok: true, text: "You search the ground for a while but find nothing worth taking.", items: {} };
    for (const [id, n] of Object.entries(sum)) giveIng(s, id, n);
    return { ok: true, text: `You forage ${night ? "by moonlight " : ""}and find ${Object.entries(sum).map(([id, n]) => `${name(id)} ×${n}`).join(", ")}.`, items: sum };
  }

  /* beasts give their parts [Skyrim] (chances [OURS]) */
  const PARTS = [
    [/bear/i, "ing_bear_claws", 0.7], [/sabre/i, "ing_sabre_tooth", 0.7], [/skeever/i, "ing_skeever_tail", 0.7], [/mudcrab/i, "ing_mudcrab", 0.7],
    [/troll/i, "ing_troll_fat", 0.6], [/spider/i, "ing_spider_egg", 0.5], [/spider/i, "ing_frostbite_venom", 0.4], [/giant/i, "ing_giants_toe", 0.6],
    [/hagraven/i, "ing_hagraven_feathers", 0.6], [/hagraven/i, "ing_hagraven_claw", 0.4], [/chaurus/i, "ing_chaurus_eggs", 0.6], [/falmer/i, "ing_falmer_ear", 0.6],
    [/wraith/i, "ing_ice_wraith_teeth", 0.7], [/spriggan/i, "ing_taproot", 0.7], [/wisp/i, "ing_wisp", 0.7], [/vampire|thrall/i, "ing_vampire_dust", 0.5],
    [/horker/i, "ing_horker_tusk", 0.7], [/ghost|restless|wraith|spectral/i, "ing_ectoplasm", 0.5], [/netch/i, "ing_netch_jelly", 0.7], [/hopper/i, "ing_ash_hopper_jelly", 0.7],
    [/ash spawn/i, "ing_spawn_ash", 0.7], [/skeleton|draugr/i, "ing_bone_meal", 0.3],
  ];
  function creatureParts(s, e) {
    if (!e || e.fled) return [];
    const got = [], nm = e.name || "";
    let first = null;
    for (const [re, id, ch] of PARTS) if (re.test(nm) && D.ITEMS[id] && Math.random() < ch) { const k = thumb(s); giveIng(s, id, k); got.push(name(id) + (k > 1 ? ` ×${k}` : "")); first = first || id; }
    if (first && Math.random() < Math.min(0.6, pnum(s, "hparts"))) { giveIng(s, first, 1); got.push(`${name(first)} (Anatomist)`); }   // Anatomist: one more part
    return got;
  }

  /* dungeons: damp rooms with fungi */
  function dungeonHooks() {
    if (typeof DUNGEONS === "undefined" || DUNGEONS.__gather) return;
    DUNGEONS.__gather = true;
    const enter0 = DUNGEONS.enterRoom, choices0 = DUNGEONS.roomChoices, act0 = DUNGEONS.act;
    DUNGEONS.enterRoom = (s, col) => {
      const err = enter0(s, col);
      const r = s.dungeon?.room;
      if (!err && r && r.type !== "boss" && Math.random() < ROOM_HERB_CHANCE) r.herb = pickW(CAVE, Math.random());
      return err;
    };
    DUNGEONS.roomChoices = (s) => {
      const c = choices0(s), r = s.dungeon?.room;
      return r?.herb && !r.enemy ? [...c, ["gatherherb", `Pick the ${name(r.herb)} growing on the walls`]] : c;
    };
    DUNGEONS.act = (s, choice, t = G.now()) => {
      const r = s.dungeon?.room;
      if (choice === "gatherherb" && r?.herb) {
        const id = r.herb, k = rint(1, 3) * thumb(s); r.herb = null;
        giveIng(s, id, k); s.dungeon.found.push(`${name(id)}${k > 1 ? ` ×${k}` : ""}`);
        const rare = typeof HARVEST !== "undefined" ? HARVEST.afterPick(s, id, "good", t) : null;
        return { text: `You scrape ${name(id)} ×${k} off the damp stone.${rare ? ` One is ${rare.word.toLowerCase()}!` : ""}`, stay: true };
      }
      return act0(s, choice, t);
    };
  }

  /* home gardens: three beds you choose */
  const BED_MAX = 3;
  const bedYield = (s) => 2 + Math.min(1, pnum(s, "hgarden"));   // Master Gardener: one more per bed
  function plantable(s) { return [...new Set(s.inv.filter((r) => D.ITEMS[r.item]?.slot === "ingredient" && plantOk(r.item)).map((r) => r.item))]; }
  const plantOk = (id) => Object.values(BIOME).some((l) => l.some(([x]) => x === id)) || Object.values(HOLD_EXTRA).some((l) => l.some(([x]) => x === id)) || WATER.some(([x]) => x === id) || CAVE.some(([x]) => x === id) || ["ing_garlic", "ing_wheat"].includes(id);
  function beds(s, town = s.location) { return (st(s).beds[town] = st(s).beds[town] || []); }
  function plant(s, id, town = s.location) {
    if (!TOWNS.home?.(s)) return "You don't own a house here.";
    const b = beds(s, town);
    if (b.length >= BED_MAX) return "All three beds are planted. Clear one first.";
    if (!plantOk(id)) return "That won't grow in a garden.";
    const row = s.inv.find((r) => r.item === id);
    if (!row) return "You don't have any to plant.";
    G.take(s, row.id, 1);
    b.push(id);
    return `You plant ${name(id)} in the garden. It comes up with every harvest.`;
  }
  function unplant(s, i, town = s.location) { const b = beds(s, town); if (!b[i]) return "That bed is empty."; const id = b.splice(i, 1)[0]; return `You dig up the ${name(id)} bed.`; }
  function gardenHooks() {
    if (typeof TOWNS === "undefined" || TOWNS.__gather) return;
    TOWNS.__gather = true;
    const harvest0 = TOWNS.harvest;
    TOWNS.harvest = (s, t = G.now()) => {
      const b = beds(s);
      if (!b.length || !TOWNS.gardenReady(s, t)) return harvest0(s, t);
      TOWNS.home(s).garden = t;
      const sum = {}; for (const id of b) sum[id] = (sum[id] || 0) + bedYield(s) * thumb(s);
      for (const [id, n] of Object.entries(sum)) giveIng(s, id, n);
      return `You harvest the garden: ${Object.entries(sum).map(([id, n]) => `${name(id)} ×${n}`).join(", ")}.`;
    };
  }
  function gardenHTML(s) {
    if (typeof TOWNS === "undefined" || !TOWNS.home?.(s)) return "";
    const b = beds(s), can = plantable(s);
    return `<div class="gbeds"><div class="sub">Garden beds (${b.length}/${BED_MAX}): each harvest gives ${bedYield(s)} of every planted ingredient.</div>
      ${b.map((id, i) => `<span class="gbed">${ICONART.item(id, 22)} ${esc(name(id))} <button class="btn sm" data-act="gunplant" data-id="${i}" aria-label="Clear bed">✕</button></span>`).join("")}
      ${b.length < BED_MAX && can.length ? `<div class="gplant">${can.slice(0, 12).map((id) => `<button class="btn sm" data-act="gplant" data-id="${id}"> ${esc(name(id))}</button>`).join("")}</div>` : b.length < BED_MAX ? '<div class="sub">Carry a wild ingredient (flowers, berries, mushrooms) to plant it.</div>' : ""}</div>`;
  }

  // ------------------------------------------------------------------ colour-coded effects
  function fxHTML(s, id) {
    const fx = TOWNS.INGREDIENT_FX[id]?.[1]; if (!fx) return "";
    const k = TOWNS.known(s, id);
    return fx.map((e, i) => k[i] ? `<em class="${TOWNS.EFFECTS[e]?.[4] ? "fx-good" : "fx-bad"}">${esc(e)}</em>` : '<em class="fx-unk">?</em>').join(", ");
  }

  // ------------------------------------------------------------------ the Travel card
  function card(s, t = G.now()) {
    if (!Number.isFinite(s.x) || s.dungeon) return "";
    const list = nearby(s, t), f = canForage(s, t);
    if (!list.length && !f.ok && !f.left) return "";
    const H = typeof HARVEST !== "undefined" ? HARVEST : null;
    const rows = list.map((n) => `<div class="item gnode ${n.ripe ? "" : "gdone"}">${ICONART.item(n.ing, 30)}<div class="t">${esc(name(n.ing))}<span>${n.ripe ? `${Math.round(n.d)} paces away · ${D.ITEMS[n.ing].weight} wt each${H ? ` · ${esc(H.howTo(n.ing))}` : ""}` : `Picked · grows back in ~${Math.ceil(growsIn(s, n, t) / 300)} in-game h`}</span></div>${n.ripe ? `${H && H.canQuick(s, n.ing) ? `<button class="btn sm" data-act="gquick" data-id="${n.id}" title="Quick Gather: no mini-game, a little less">Quick pick</button>` : ""}<button class="btn sm pri" data-act="gpick" data-id="${n.id}">Gather</button>` : ""}</div>`).join("");
    const ripeN = list.filter((n) => n.ripe).length;
    return `<div class="panel gcard"><h2> Gathering</h2>
      ${rows || '<p class="sub">No plants spotted right here. Patches you pass on the road show on the map as leaves.</p>'}
      <div class="gbtns">${ripeN > 1 ? `<button class="btn" data-act="gpickall">Gather all (${ripeN})</button>` : ""}
      <button class="btn" data-act="gforage" ${f.ok ? "" : "disabled"} title="${esc(f.why || "Search the ground for whatever grows here")}"> Forage here</button>
      <button class="btn" data-act="gnotes"> Herbalist's notes</button></div>
      <div class="gauto"><button class="btn ${st(s).auto ? "pri" : ""}" data-act="gauto" aria-pressed="${st(s).auto}">${st(s).auto ? "Auto-pick: On" : "Auto-pick: Off"}</button></div>
      ${!f.ok && f.why ? `<p class="sub">${esc(f.why)}</p>` : ""}${H ? H.cardFoot(s) : ""}</div>`;
  }

  /* Herbalist's notes: every ingredient, how many you've got, where it grows, what you know */
  function notesHTML(s) {
    const all = Object.keys(TOWNS.INGREDIENT_FX).sort((a, b) => name(a).localeCompare(name(b)));
    const have = (id) => s.inv.filter((r) => r.item === id).reduce((a, r) => a + r.qty, 0);
    const knownN = all.filter((id) => TOWNS.known(s, id).some(Boolean)).length;
    return `<h2> Herbalist's notes</h2>
      <p class="sub">${knownN} of ${all.length} ingredients studied. Eat one to learn its first effect (Experimenter: more); brewing reveals the rest. <em class="fx-good">Green</em> helps you, <em class="fx-bad">red</em> makes poisons.</p>
      <div class="gnotes">${all.map((id) => `<div class="item">${ICONART.item(id, 30)}<div class="t">${esc(name(id))}${have(id) ? ` <b class="gcount">×${have(id)}</b>` : ""}<span>${fxHTML(s, id)}</span><span class="gwhere">${esc(WHERE[id] || "sold by alchemists")} · ${D.ITEMS[id]?.weight ?? "?"} wt · ${D.ITEMS[id]?.value ?? 0}g</span></div></div>`).join("")}</div>
      <button class="btn" data-act="close" style="width:100%;margin-top:8px">Close</button>`;
  }

  /* map: leaves on spotted patches of your region */
  function marks(s, t = G.now()) {
    if (!s.gather) return [];
    const g = st(s), here = [s.x, s.y], out = [];
    for (const id of Object.keys(g.seen)) { const n = byId(id); if (n && WORLD.same(n.pos, here)) out.push({ pos: n.pos, ripe: ripe(s, n, t), ing: n.ing, label: name(n.ing), kind: typeof HARVEST !== "undefined" ? HARVEST.kindOf(n.ing) : "flower" }); }
    return out;
  }

  function act(s, what, id, t = G.now(), opt = {}) {
    if (what === "gpick") return pick(s, id, t, !!opt.passing, opt);
    if (what === "gquick") return pick(s, id, t);
    if (what === "hdeliver" && typeof HARVEST !== "undefined") return HARVEST.deliver(s, t);
    if (what === "gpickall") return pickAll(s, t);
    if (what === "gforage") return forage(s, t);
    if (what === "gauto") { st(s).auto = !st(s).auto; return { ok: true, text: st(s).auto ? "You'll pick ripe plants as you pass them." : "You'll only pick plants when you choose to." }; }
    if (what === "gplant") { const m = plant(s, id); return { ok: !/^(You don't|All three|That won't)/.test(m), text: m }; }
    if (what === "gunplant") return { ok: true, text: unplant(s, +id) };
    if (what === "gnotes") return { html: notesHTML(s) };
    return { err: "?" };
  }

  dungeonHooks(); gardenHooks();
  return { NEW_ING, BIOME, HOLD_EXTRA, CAVE, WATER, COAST, WHERE, RESPAWN, SPOT_PX, REACH_PX, FORAGE_COOLDOWN, nodes, byId, around, plantsAt, pxd, onStep, nearby, pick, pickAll, canForage, forage,
    creatureParts, plant, unplant, beds, plantable, gardenHTML, fxHTML, card, notesHTML, marks, act, st, ripe };
})();
