/* Solstheim: the island east of Skyrim's north coast, reached by boat from Windhelm ([Skyrim] Dragonborn).
   Its own map (our drawing, laid out like the real island: ash wastes in the south, snow in the north),
   its own terrain grid built by the same makeTerrain() as Skyrim, and its places, items and road foes.
   Places are stored in WORLD.places like every other place, but two map-heights down (y 2..3, see WORLD.SOL_OY),
   so they are never "near" anything in Skyrim. The Terrain functions below look at a point's y and ask the right grid.
   Gameplay (the boat, the questline, crafting, Raven Rock) is in solstheim.js; the art in solart.js. */
const SOLW = (() => {
  const W = {
    // the island's coast, clockwise from the north-west (closed polygon, 0..1 on its own map)
    coast: [[0.13, 0.2], [0.1, 0.15], [0.16, 0.1], [0.22, 0.08], [0.3, 0.07], [0.36, 0.04], [0.44, 0.06], [0.47, 0.11], [0.5, 0.145], [0.53, 0.12],
      [0.56, 0.07], [0.62, 0.05], [0.7, 0.065], [0.78, 0.055], [0.87, 0.08], [0.94, 0.12], [0.93, 0.18], [0.9, 0.23], [0.875, 0.27], [0.91, 0.33],
      [0.895, 0.4], [0.84, 0.44], [0.795, 0.47], [0.83, 0.505], [0.875, 0.53], [0.85, 0.6], [0.835, 0.65], [0.875, 0.7], [0.87, 0.77], [0.85, 0.82],
      [0.86, 0.9], [0.82, 0.95], [0.76, 0.92], [0.7, 0.88], [0.64, 0.86], [0.58, 0.88], [0.52, 0.92], [0.45, 0.91], [0.38, 0.95], [0.3, 0.96],
      [0.24, 0.94], [0.19, 0.9], [0.15, 0.86], [0.12, 0.79], [0.14, 0.72], [0.13, 0.68], [0.19, 0.65], [0.13, 0.6], [0.1, 0.55], [0.08, 0.48],
      [0.1, 0.42], [0.14, 0.38], [0.12, 0.32], [0.145, 0.26]],
    ranges: [
      { pts: [[0.33, 0.21], [0.42, 0.25], [0.5, 0.235], [0.58, 0.27], [0.63, 0.3]], w: 0.032, h: 0.66 },   // the Moesring mountains
      { pts: [[0.66, 0.36], [0.7, 0.44], [0.72, 0.5]], w: 0.026, h: 0.52 },
      { pts: [[0.37, 0.75], [0.44, 0.73], [0.52, 0.76]], w: 0.022, h: 0.46 },                              // ash hills
      { pts: [[0.24, 0.4], [0.3, 0.45]], w: 0.02, h: 0.4 },
    ],
    rivers: [{ name: "Skaal creek", pts: [[0.72, 0.33], [0.78, 0.27], [0.83, 0.245], [0.86, 0.235]] }],
    lakes: [[0.42, 0.42, 0.022, 0.014], [0.53, 0.16, 0.014, 0.009]],
    regions: [
      [0.5, 0.48, 0.32, 0.08, "tundra"], [0.75, 0.25, 0.1, 0.08, "pine"], [0.2, 0.47, 0.07, 0.08, "rocky"],
      [0.42, 0.72, 0.36, 0.24, "ash"], [0.24, 0.6, 0.12, 0.08, "ash"], [0.62, 0.62, 0.14, 0.08, "ash"],
      [0.55, 0.84, 0.045, 0.03, "volcanic"], [0.31, 0.81, 0.04, 0.028, "volcanic"], [0.4, 0.66, 0.03, 0.02, "volcanic"], [0.78, 0.78, 0.05, 0.05, "ash"],
    ],
    snowLine: 0.42,
    /* name → [x, y, kind] on Solstheim's own map ([Skyrim] names, our positions after the real island) */
    places: {
      "Raven Rock": [0.765, 0.745, "city"], "Skaal Village": [0.855, 0.205, "town"], "Tel Mithryn": [0.2, 0.575, "town"],
      "Thirsk Mead Hall": [0.215, 0.27, "town"],
      "Fort Frostmoth": [0.79, 0.875, "fort"], "Highpoint Tower": [0.36, 0.485, "fort"],
      "Temple of Miraak": [0.5, 0.33, "dungeon"], "Kolbjorn Barrow": [0.825, 0.56, "dungeon"], "Nchardak": [0.38, 0.32, "dungeon"],
      "Benkongerike": [0.6, 0.44, "dungeon"], "Bloodskal Barrow": [0.62, 0.755, "dungeon"], "Gyldenhul Barrow": [0.835, 0.13, "dungeon"],
      "White Ridge Barrow": [0.47, 0.15, "dungeon"], "Glacial Crevice": [0.3, 0.15, "dungeon"], "Castle Karstaag": [0.4, 0.085, "dungeon"],
      "Ashfallow Citadel": [0.3, 0.6, "dungeon"], "Fahlbtharz": [0.24, 0.72, "dungeon"], "Coldcinder Cave": [0.34, 0.82, "dungeon"],
      "Vahlok's Tomb": [0.19, 0.84, "dungeon"], "Kagrumez": [0.5, 0.84, "dungeon"], "Bthar-zel": [0.62, 0.58, "dungeon"],
      "Saering's Watch": [0.67, 0.3, "lair"],
      "Earth Stone": [0.735, 0.705, "stone"], "Water Stone": [0.135, 0.44, "stone"], "Wind Stone": [0.6, 0.13, "stone"],
      "Beast Stone": [0.27, 0.36, "stone"], "Sun Stone": [0.45, 0.66, "stone"], "Tree Stone": [0.76, 0.28, "stone"],
      "Raven Rock Mine": [0.81, 0.685, "landmark"], "Frossel": [0.86, 0.36, "landmark"], "Brodir Grove": [0.68, 0.09, "landmark"],
    },
    roads: [
      ["Raven Rock", "Earth Stone"], ["Raven Rock", "Raven Rock Mine"], ["Raven Rock", [0.79, 0.82], "Fort Frostmoth"],
      ["Raven Rock", [0.81, 0.64], "Kolbjorn Barrow", [0.77, 0.47], "Frossel", [0.86, 0.29], "Skaal Village"],
      ["Raven Rock", [0.69, 0.74], "Bloodskal Barrow", [0.53, 0.7], "Sun Stone", [0.36, 0.63], "Ashfallow Citadel", "Tel Mithryn"],
      ["Tel Mithryn", [0.16, 0.5], "Water Stone"], ["Tel Mithryn", [0.28, 0.52], "Highpoint Tower", [0.32, 0.4], "Beast Stone", "Thirsk Mead Hall"],
      ["Skaal Village", "Tree Stone"], ["Skaal Village", [0.75, 0.15], [0.66, 0.13], "Wind Stone"], ["Highpoint Tower", [0.48, 0.45], "Benkongerike", [0.7, 0.55], "Kolbjorn Barrow"],
    ],
  };
  return W;
})();
/* how the island's dungeons play ([theme, tier]); themes "ashcave" and "miraak" are added in solstheim.js */
const SOL_THEMES = {
  "Temple of Miraak": ["miraak", 3], "Kolbjorn Barrow": ["barrow", 3], "Nchardak": ["dwemer", 3], "Benkongerike": ["ashcave", 2],
  "Bloodskal Barrow": ["barrow", 2], "Gyldenhul Barrow": ["barrow", 3], "White Ridge Barrow": ["barrow", 2], "Glacial Crevice": ["cave", 2],
  "Castle Karstaag": ["barrow", 3], "Ashfallow Citadel": ["ashcave", 3], "Fahlbtharz": ["dwemer", 2], "Coldcinder Cave": ["ashcave", 2],
  "Vahlok's Tomb": ["barrow", 3], "Kagrumez": ["dwemer", 2], "Bthar-zel": ["dwemer", 2], "Fort Frostmoth": ["ashcave", 2], "Highpoint Tower": ["ashcave", 1],
};
(() => {
  const OY = WORLD.SOL_OY;
  WORLD.solPlaces = Object.keys(SOLW.places);
  for (const [n, [x, y, k]] of Object.entries(SOLW.places)) { WORLD.places[n] = [x, y + OY, k]; WORLD.hidden.add(n); }   // found by sailing there and exploring
  Object.assign(WORLD.placeThemes, SOL_THEMES);
  // ---- shops ([Skyrim] who sells what on the island)
  D.SHOPS["Raven Rock"] = ["general", "blacksmith"];
  D.SHOPS["Skaal Village"] = ["blacksmith"];
  D.SHOPS["Tel Mithryn"] = ["wizard"];
  // ---- new things ([Skyrim] names and stats close to Skyrim's)
  Object.assign(D.ITEMS, {
    mat_chitin: { name: "Chitin Plate", slot: "material", weight: 1, value: 15 },
    mat_netch_leather: { name: "Netch Leather", slot: "material", weight: 1, value: 15 },
    ore_stalhrim: { name: "Stalhrim", slot: "material", weight: 1, value: 50 },
    ing_ash_yam: { name: "Ash Yam", slot: "ingredient", weight: 0.5, value: 1 },
    ing_netch_jelly: { name: "Netch Jelly", slot: "ingredient", weight: 0.5, value: 20 },
    ing_ash_hopper_jelly: { name: "Ash Hopper Jelly", slot: "ingredient", weight: 0.25, value: 5 },
    ing_spawn_ash: { name: "Spawn Ash", slot: "ingredient", weight: 0.1, value: 20 },
    chitin_helmet: { name: "Chitin Helmet", slot: "head", type: "light", armor: 15, weight: 2, value: 150 },
    chitin_armor: { name: "Chitin Armor", slot: "chest", type: "light", armor: 32, weight: 4, value: 550 },
    chitin_bracers: { name: "Chitin Bracers", slot: "hands", type: "light", armor: 10, weight: 1, value: 125 },
    chitin_boots: { name: "Chitin Boots", slot: "feet", type: "light", armor: 10, weight: 1, value: 125 },
    bonemold_helmet: { name: "Bonemold Helmet", slot: "head", type: "heavy", armor: 18, weight: 6, value: 135 },
    bonemold_armor: { name: "Bonemold Armor", slot: "chest", type: "heavy", armor: 34, weight: 21, value: 500 },
    bonemold_gauntlets: { name: "Bonemold Gauntlets", slot: "hands", type: "heavy", armor: 13, weight: 4, value: 90 },
    bonemold_boots: { name: "Bonemold Boots", slot: "feet", type: "heavy", armor: 13, weight: 6, value: 90 },
    bonemold_shield: { name: "Bonemold Shield", slot: "shield", type: "heavy", armor: 25, weight: 8, value: 160 },
    stalhrim_helmet: { name: "Stalhrim Light Helmet", slot: "head", type: "light", armor: 18, weight: 2, value: 600 },
    stalhrim_armor: { name: "Stalhrim Light Armor", slot: "chest", type: "light", armor: 39, weight: 7, value: 2200 },
    stalhrim_gauntlets: { name: "Stalhrim Light Gauntlets", slot: "hands", type: "light", armor: 13, weight: 2, value: 480 },
    stalhrim_boots: { name: "Stalhrim Light Boots", slot: "feet", type: "light", armor: 13, weight: 2, value: 480 },
    stalhrim_heavy_armor: { name: "Stalhrim Heavy Armor", slot: "chest", type: "heavy", armor: 46, weight: 46, value: 2800 },
    stalhrim_heavy_helmet: { name: "Stalhrim Heavy Helmet", slot: "head", type: "heavy", armor: 21, weight: 7, value: 700 },
    stalhrim_sword: { name: "Stalhrim Sword", slot: "weapon", hands: 1, skill: "One-Handed", damage: 12, weight: 15, value: 1200 },
    stalhrim_war_axe: { name: "Stalhrim War Axe", slot: "weapon", hands: 1, skill: "One-Handed", damage: 13, weight: 16, value: 1250 },
    stalhrim_dagger: { name: "Stalhrim Dagger", slot: "weapon", hands: 1, skill: "One-Handed", damage: 11, weight: 5, value: 450 },
    stalhrim_greatsword: { name: "Stalhrim Greatsword", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 23, weight: 23, value: 2000 },
    stalhrim_bow: { name: "Stalhrim Bow", slot: "weapon", hands: 2, skill: "Archery", damage: 17, weight: 15, value: 1800 },
    miraak_robes: { name: "Miraak's Robes", slot: "chest", type: "cloth", armor: 0, weight: 6, value: 2500, noTrade: true, aenchant: { key: "max:magicka", mag: 70, name: "Fortify Magicka" } },
    miraak_sword: { name: "Miraak's Sword", slot: "weapon", hands: 1, skill: "One-Handed", damage: 15, weight: 16, value: 2400, noTrade: true },
    black_book: { name: "Black Book: Epistolary Acumen", slot: "trophy", weight: 1, value: 0, noTrade: true },
  });
  D.TOWN_STOCK = D.TOWN_STOCK || {};
  const add = (town, shop, items) => { D.TOWN_STOCK[town] = D.TOWN_STOCK[town] || {}; D.TOWN_STOCK[town][shop] = [...new Set([...(D.TOWN_STOCK[town][shop] || []), ...items])]; };
  add("Raven Rock", "blacksmith", ["mat_chitin", "mat_netch_leather", "chitin_helmet", "chitin_bracers", "bonemold_helmet", "bonemold_shield"]);
  add("Raven Rock", "general", ["ing_ash_yam", "ing_netch_jelly", "ing_ash_hopper_jelly"]);
  add("Skaal Village", "blacksmith", ["mat_chitin", "mat_netch_leather"]);
  add("Tel Mithryn", "wizard", ["ing_spawn_ash", "ing_netch_jelly"]);
  // ---- road foes ([OURS] numbers on the same scale as Skyrim's; only these meet you on the island)
  const H = ["Solstheim"];
  const E = (name, danger, level, tags, health, damage, gold, text, extra = {}) => ({ name, danger, level, tags, health, damage, gold, holds: H, text, ...extra });
  D.ENCOUNTERS.push(
    E("Ash hopper", "low", 3, ["beast"], 18, 4, [0, 0], "An ash hopper springs out of a drift, chittering."),
    E("Ash hoppers", "low", 5, ["beast"], 30, 6, [0, 2], "Three ash hoppers bound across the grey dunes at you."),
    E("Netch calf", "low", 4, ["beast"], 35, 4, [0, 0], "A young netch drifts low over the ash, tendrils trailing."),
    { name: "Ash-buried satchel", danger: "low", kind: "event", gold: [10, 40], holds: H, text: "The wind uncovers a satchel half buried in the ash." },
    { name: "Mushroom grove", danger: "low", kind: "event", gold: [0, 8], holds: H, text: "You pass through a grove of giant mushrooms, glowing faintly." },
    E("Riekling hunters", "medium", 10, ["humanoid"], 60, 11, [2, 18], "Rieklings! Little blue faces under bone helmets, spears raised."),
    E("Ash spawn", "medium", 14, ["undead"], 70, 14, [0, 10], "The ash heaves, and an ash spawn claws its way out, embers in its eyes."),
    E("Bull netch", "medium", 14, ["beast"], 120, 12, [0, 0], "A bull netch hovers over the road, its stinging tendrils dripping poison."),
    E("Burnt spriggan", "medium", 16, ["humanoid"], 90, 15, [0, 0], "A spriggan blackened by ash steps out of a dead tree, sparks for eyes."),
    E("Reaver", "medium", 12, ["humanoid"], 75, 14, [10, 40], "A reaver in chitin armour steps out of the ash. \"Your purse, outlander.\""),
    E("Miraak's cultists", "high", 18, ["humanoid", "elite"], 120, 18, [20, 70], "Masked figures bar the road. \"The false Dragonborn! Miraak will have your soul!\""),
    E("Riekling charger", "high", 20, ["humanoid", "elite"], 150, 20, [10, 50], "A riekling charges you on the back of a tusked boar."),
    E("Lurker", "high", 28, ["big", "elite"], 220, 25, [0, 0], "Tentacles burst from the earth: a lurker of Apocrypha, here in the waking world."),
  );
  // ---- the ground: Solstheim's own grid, then every Terrain function looks at which map a point is on
  const ST = makeTerrain(SOLW, { island: true, snowNoise: 0.2 });   // a ragged snow line, not a ruler
  const toL = (p) => [p[0], p[1] - OY], toG = (p) => [p[0], p[1] + OY], isSol = WORLD.isSol;
  const SK = { typeAtPos: Terrain.typeAtPos, speedAt: Terrain.speedAt, route: Terrain.route, moveAlong: Terrain.moveAlong, secondsLeft: Terrain.secondsLeft };
  Terrain.typeAtPos = (pos) => (isSol(pos) ? ST.typeAtPos(toL(pos)) : SK.typeAtPos(pos));
  Terrain.speedAt = (pos) => (isSol(pos) ? ST.speedAt(toL(pos)) : SK.speedAt(pos));
  Terrain.route = (a, b) => {
    const sa = isSol(a), sb = isSol(b);
    if (!sa && !sb) return SK.route(a, b);
    if (!sa || !sb) return [a, b];          // never walk between the maps: the boat does that
    const r = ST.route(toL(a), toL(b)).map(toG); r[0] = a; r[r.length - 1] = b; return r;
  };
  Terrain.moveAlong = (path, idx, pos, seconds, base) => {
    if (!isSol(pos)) return SK.moveAlong(path, idx, pos, seconds, base);
    const m = ST.moveAlong(path.map(toL), idx, toL(pos), seconds, base);
    return { pos: m.done ? [...path[path.length - 1]] : toG(m.pos), idx: m.idx, done: m.done };
  };
  Terrain.secondsLeft = (path, idx, pos, base) => (isSol(pos) ? ST.secondsLeft(path.map(toL), idx, toL(pos), base) : SK.secondsLeft(path, idx, pos, base));
  Terrain.Sol = ST; Terrain.solL = toL; Terrain.solG = toG;
})();
if (typeof module !== "undefined") module.exports = SOLW;
