/* Smithing: make your own weapons, armor and jewellery at any blacksmith's forge, smelt ore into ingots and tan
   pelts into leather. Gems and precious metals turn up in dungeons, mines and on tough foes.
   [Skyrim] materials, perk gates and the smithing XP formula (25 + 3 × value^0.65); recipe amounts are [OURS],
   scaled from each item's weight. Gem and jewellery values are Skyrim-like. */
const SMITH = (() => {
  // ---- new things to find, buy and make
  const V = (name, value, weight = 0.1, slot = "valuable") => ({ name, value, weight, slot });
  Object.assign(D.ITEMS, {
    ore_iron: { name: "Iron Ore", slot: "material", weight: 1, value: 1 },
    ore_corundum: { name: "Corundum Ore", slot: "material", weight: 1, value: 10 },
    ore_moonstone: { name: "Moonstone Ore", slot: "material", weight: 1, value: 25 },
    ore_silver: { name: "Silver Ore", slot: "material", weight: 1, value: 20 },
    ore_gold: { name: "Gold Ore", slot: "material", weight: 1, value: 40 },
    mat_silver: { name: "Silver Ingot", slot: "material", weight: 1, value: 50 },
    mat_gold: { name: "Gold Ingot", slot: "material", weight: 1, value: 100 },
    mat_strips: { name: "Leather Strips", slot: "material", weight: 0.1, value: 3 },
    pelt_wolf: { name: "Wolf Pelt", slot: "material", weight: 2, value: 25 },
    pelt_bear: { name: "Bear Pelt", slot: "material", weight: 12, value: 50 },
    pelt_sabre: { name: "Sabre Cat Pelt", slot: "material", weight: 6, value: 40 },
  });
  const GEMS = { garnet: ["Garnet", 100, 150], amethyst: ["Amethyst", 120, 250], ruby: ["Ruby", 150, 300], sapphire: ["Sapphire", 250, 500], emerald: ["Emerald", 750, 1000], diamond: ["Diamond", 900, 1000] };
  for (const [k, [n, v, fv]] of Object.entries(GEMS)) { D.ITEMS["gem_" + k] = V(n, v); D.ITEMS["gem_flawless_" + k] = V("Flawless " + n, fv); }
  // jewellery: [metal, gems it takes]
  const METAL = { silver: ["Silver", "mat_silver", 65, 90, ["garnet", "amethyst", "ruby"]], gold: ["Gold", "mat_gold", 130, 180, ["ruby", "sapphire", "emerald", "diamond"]] };
  const JEWEL = {};
  for (const [m, [mn, ingot, ringV, neckV, gems]] of Object.entries(METAL)) {
    for (const [kind, kn, base, gemMul, w] of [["ring", "Ring", ringV, 1.15, 0.25], ["necklace", "Necklace", neckV, 1.3, 0.5]]) {
      const plain = `${m}_${kind}`; D.ITEMS[plain] = V(`${mn} ${kn}`, base, w); JEWEL[plain] = [[ingot, 1]];
      for (const g of gems) { const id = `${m}_${g}_${kind}`; D.ITEMS[id] = V(`${mn} ${GEMS[g][0]} ${kn}`, Math.min(1200, Math.round(base + GEMS[g][1] * gemMul)), w); JEWEL[id] = [[ingot, 1], ["gem_" + g, 1]]; }
    }
  }

  // ---- where they turn up
  D.SHOP_STOCK.blacksmith.push("ore_iron", "ore_corundum", "mat_strips");
  D.LOOT.humanoid.push(["ore_iron", 0.08], ["ore_corundum", 0.04], ["ore_silver", 0.025], ["ore_gold", 0.01]);   // [OURS] ore drops: miners, bandits, smugglers
  D.LOOT.elite.push(["ore_iron", 0.12], ["ore_corundum", 0.08], ["ore_silver", 0.06], ["ore_gold", 0.04], ["ore_moonstone", 0.05]);
  D.LOOT.humanoid.push(["gem_garnet", 0.03], ["gem_amethyst", 0.025], ["gem_ruby", 0.015], ["silver_ring", 0.02]);
  D.LOOT.elite.push(["gem_sapphire", 0.06], ["gem_emerald", 0.025], ["gem_diamond", 0.02], ["gem_flawless_garnet", 0.04], ["gem_flawless_amethyst", 0.03], ["gem_flawless_ruby", 0.025],
    ["gem_flawless_sapphire", 0.015], ["gold_ring", 0.04], ["gold_necklace", 0.02], ["silver_necklace", 0.04], ["mat_gold", 0.03], ["mat_silver", 0.05]);
  for (const [theme, items] of Object.entries({ mine: ["ore_iron", "ore_iron", "ore_iron", "ore_corundum", "ore_corundum", "ore_silver", "ore_silver", "ore_gold", "ore_moonstone", "gem_garnet", "gem_amethyst"],
    dwemer: ["gem_sapphire", "ore_gold", "ore_corundum"], barrow: ["gold_ring", "silver_necklace", "gem_garnet", "ore_silver"], fort: ["ore_iron", "ore_corundum"], forsworn: ["ore_silver", "ore_iron"], vampire: ["gem_ruby", "silver_ring"], thalmor: ["ore_moonstone", "gem_flawless_amethyst"], cave: ["pelt_wolf", "pelt_bear"] }))
    DUNGEONS.THEMES[theme]?.loot.push(...items);
  const peltFor = (name) => (/wolf/i.test(name) ? "pelt_wolf" : /bear/i.test(name) ? "pelt_bear" : /sabre/i.test(name) ? "pelt_sabre" : null);

  // ---- smelting and tanning: [what you get, how many, what it takes]
  const REFINE = [
    ["mat_iron", 1, [["ore_iron", 2]], "smelt"], ["mat_steel", 1, [["ore_iron", 1], ["ore_corundum", 1]], "smelt"], ["mat_moonstone", 1, [["ore_moonstone", 1]], "smelt"],
    ["mat_silver", 1, [["ore_silver", 2]], "smelt"], ["mat_gold", 1, [["ore_gold", 2]], "smelt"],
    ["mat_leather", 1, [["pelt_wolf", 1]], "tan"], ["mat_leather", 2, [["pelt_sabre", 1]], "tan"], ["mat_leather", 2, [["pelt_bear", 1]], "tan"], ["mat_strips", 4, [["mat_leather", 1]], "tan"],
  ];

  // ---- weapon and armor recipes, built from the items already in the game
  const GROUPS = [["iron", "Iron"], ["steel", "Steel"], ["elven", "Elven"], ["dwarven", "Dwarven"], ["leather", "Hide & leather"], ["bows", "Bows"], ["jewel", "Jewellery"]];
  const PERK_FOR = { steel: "steel_smithing", elven: "elven_smithing", dwarven: "dwarven_smithing" };
  const RECIPES = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  for (const [id, it] of Object.entries(D.ITEMS)) {
    if (id.startsWith("ench|") || it.enchant || it.aenchant || !(it.slot === "weapon" || G.ARMOR_SLOTS.includes(it.slot)) || it.type === "cloth") continue;
    if (/^(ancient_nord|forsworn|wuuthrad|guild)/.test(id)) continue;      // [Skyrim] you can't forge these without special perks or quests
    const isW = it.slot === "weapon", strips = isW ? 1 : it.slot === "chest" ? 3 : it.slot === "head" ? 1 : 2;
    const main = clamp(Math.max(Math.round(it.weight / (isW ? 5 : 6)), Math.round(it.value / 30)), 1, 6);
    let group, mats, perk = null;
    if (/^(hunting_bow|long_bow)/.test(id)) { group = "bows"; mats = [["mat_firewood", id === "long_bow" ? 1 : 2], ["mat_strips", 1]]; }
    else if (/^(hide|leather)/.test(id)) { group = "leather"; mats = [["mat_leather", clamp(Math.round(it.weight / 2), 1, 4)], ["mat_strips", strips]]; }
    else if (/^iron/.test(id)) { group = "iron"; mats = [["mat_iron", main], ["mat_strips", strips]]; }
    else if (/^(steel|chainmail)/.test(id)) { group = "steel"; perk = /^chainmail/.test(id) ? "advanced_armors" : "steel_smithing"; mats = [["mat_steel", main], ["mat_iron", 1], ["mat_strips", strips]]; }
    else if (/^elven/.test(id)) { group = "elven"; perk = "elven_smithing"; mats = [["mat_moonstone", clamp(Math.max(main, Math.round(it.value / 60)), 1, 8)], ["mat_iron", 1], ["mat_strips", strips]]; }
    else if (/^dwarven/.test(id)) { group = "dwarven"; perk = "dwarven_smithing"; mats = [["mat_dwarven", clamp(Math.max(main, Math.round(it.value / 60)), 1, 8)], ["mat_steel", 1], ["mat_strips", strips]]; }
    else continue;
    RECIPES[id] = { group, mats, perk };
  }
  for (const [id, mats] of Object.entries(JEWEL)) RECIPES[id] = { group: "jewel", mats, perk: null };

  // ---- helpers
  const count = (s, item) => s.inv.filter((r) => r.item === item).reduce((a, r) => a + r.qty, 0);
  const atForge = (s) => !!s.location && G.shopTypes(s.location).includes("blacksmith") && !s.trip;
  function use(s, mats) {           // take exactly these amounts from the pack, across stacks
    for (const [item, n] of mats) {
      let left = n;
      for (const r of s.inv.filter((x) => x.item === item && !x.stolen).concat(s.inv.filter((x) => x.item === item && x.stolen))) {
        if (left <= 0) break; const k = Math.min(left, r.qty); G.take(s, r.id, k); left -= k;
      }
    }
  }
  const matText = (mats) => mats.map(([i, n]) => `${n} ${D.ITEMS[i].name}`).join(", ");
  const perkName = (id) => (typeof PERKS !== "undefined" && PERKS.BY_ID[id]?.name) || id;

  function info(s, id) {
    const rc = RECIPES[id]; if (!rc) return null;
    const missing = rc.mats.filter(([i, n]) => count(s, i) < n).map(([i, n]) => `${n - count(s, i)} more ${D.ITEMS[i].name}`);
    const block = rc.where && s.location !== rc.where ? `Only the forge in ${rc.where} can make this.` : rc.perk && !G.P(s, rc.perk) ? `Needs the ${perkName(rc.perk)} perk (Smithing).` : missing.length ? `Missing ${missing.join(", ")}.` : null;
    return { ...rc, block, have: rc.mats.map(([i]) => count(s, i)) };
  }
  function xpFor(value) { return 25 + 3 * value ** 0.65; }     // [Skyrim]
  function make(s, id) {
    if (!atForge(s)) return "You need a forge. Every blacksmith has one.";
    const i = info(s, id); if (!i) return "You can't make that.";
    if (i.block) return i.block;
    use(s, i.mats);
    const out = i.out || 1;
    G.give(s, id, out);
    const sk = G.useSkill(s, "Smithing", xpFor(Math.min(400, D.ITEMS[id].value * out)));
    return `You make ${out > 1 ? `${out} ${D.ITEMS[id].name}s` : `${/^[AEIOU]/.test(D.ITEMS[id].name) ? "an" : "a"} ${D.ITEMS[id].name}`} from ${matText(i.mats)}.` + (sk.length ? " " + sk.join(". ") : "");
  }
  function refineInfo(s, k) {
    const [out, n, mats, kind] = REFINE[k];
    const times = Math.min(...mats.map(([i, m]) => Math.floor(count(s, i) / m)));
    return { out, n, mats, kind, times };
  }
  function refine(s, k, all = false) {
    if (!atForge(s)) return "You need a forge. Every blacksmith has a smelter and a tanning rack.";
    const r = REFINE[k]; if (!r) return "Nothing to do.";
    const { out, n, mats, kind, times } = refineInfo(s, k);
    if (!times) return `You need ${matText(mats)}.`;
    const reps = all ? times : 1;
    use(s, mats.map(([i, m]) => [i, m * reps]));
    G.give(s, out, n * reps);
    const sk = G.useSkill(s, "Smithing", (kind === "smelt" ? 3 : 1) * reps);
    return `${kind === "smelt" ? "You smelt" : "You tan"} ${matText(mats.map(([i, m]) => [i, m * reps]))} into ${n * reps} ${D.ITEMS[out].name}.` + (sk.length ? " " + sk.join(". ") : "");
  }
  // ---- mining ([Skyrim] mines near these places; which ores each gives is [OURS], loosely after the real ones)
  D.ITEMS.pickaxe = { name: "Pickaxe", slot: "misc", weight: 5, value: 5 };
  D.SHOP_STOCK.blacksmith.push("pickaxe"); D.SHOP_STOCK.general?.push("pickaxe");
  const MINES = {
    Markarth: ["Cidhna Mine", [["ore_silver", 5], ["ore_iron", 2], ["ore_gold", 1]]],
    Karthwasten: ["Sanuarach Mine", [["ore_silver", 4], ["ore_iron", 3]]],
    Dawnstar: ["Iron-Breaker Mine", [["ore_iron", 5], ["ore_corundum", 2]]],
    "Darkwater Crossing": ["Goldenrock Mine", [["ore_gold", 3], ["ore_corundum", 3], ["ore_iron", 2]]],
    Kynesgrove: ["Steamscorch Mine", [["ore_moonstone", 3], ["ore_corundum", 3], ["ore_iron", 2]]],
    "Shor's Stone": ["Redbelly Mine", [["ore_iron", 5], ["ore_corundum", 2]]],
    "Embershard Mine": ["Embershard Mine", [["ore_iron", 4], ["ore_corundum", 2], ["ore_silver", 1]]],
    "Bilegulch Mine": ["Bilegulch Mine", [["ore_iron", 3], ["ore_corundum", 3], ["ore_gold", 1]]],
    "Whistling Mine": ["Whistling Mine", [["ore_iron", 5], ["ore_corundum", 1]]],
    "Kolskeggr Mine": ["Kolskeggr Mine", [["ore_gold", 5], ["ore_iron", 1]]],
    "Left Hand Mine": ["Left Hand Mine", [["ore_iron", 5], ["ore_silver", 1]]],
    "Lost Prospect Mine": ["Lost Prospect Mine", [["ore_gold", 3], ["ore_iron", 2]]],
    "Gloombound Mine": ["Gloombound Mine", [["ore_corundum", 3], ["ore_iron", 3], ["ore_moonstone", 1]]],
  };
  const VEIN_RENEW = 24 * 3600 / G.GAME_SPEED;     // the veins grow back after one in-game day (2 real hours)
  const mineLeft = (s, place, t = G.now()) => Math.max(0, ((s.mined || {})[place] || 0) + VEIN_RENEW - t);
  function mine(s, place = s.location, t = G.now()) {
    const m = MINES[place];
    if (!m || s.trip) return "There are no ore veins here.";
    if (!count(s, "pickaxe")) return "You need a pickaxe. Blacksmiths and general stores sell them for a few coins.";
    if (mineLeft(s, place, t) > 0) return "You've mined the veins here bare. They grow back in a day.";
    const bag = m[1].flatMap(([o, w]) => Array(w).fill(o)), got = {};
    const n = 3 + Math.floor(Math.random() * 3) + (G.skill(s, "Smithing") >= 50 ? 1 : 0);
    for (let i = 0; i < n; i++) { const o = bag[Math.floor(Math.random() * bag.length)]; got[o] = (got[o] || 0) + 1; }
    if (Math.random() < 0.15) { const g = "gem_" + ["garnet", "garnet", "amethyst", "amethyst", "ruby", "sapphire"][Math.floor(Math.random() * 6)]; got[g] = (got[g] || 0) + 1; }
    for (const [o, k] of Object.entries(got)) G.give(s, o, k);
    s.mined = { ...(s.mined || {}), [place]: t };
    return `⛏ You work the veins in ${m[0]}: ${Object.entries(got).map(([o, k]) => `${k} ${D.ITEMS[o].name}`).join(", ")}.`;
  }
  const byGroup = (g) => Object.keys(RECIPES).filter((id) => RECIPES[id].group === g).sort((a, b) => D.ITEMS[a].value - D.ITEMS[b].value);
  return { MINES, VEIN_RENEW, mineLeft, mine, GROUPS, RECIPES, REFINE, GEMS, PERK_FOR, info, make, refineInfo, refine, byGroup, peltFor, atForge, count, matText, xpFor };
})();
