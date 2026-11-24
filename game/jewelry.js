/* Jewellery as real gear: one amulet and two rings, worn in their own slots ([Skyrim] one amulet + one ring; two rings
   are [OURS], Remigiusz: "players should be able to wear one amulet and up to 2 rings").
   Rings and amulets carry no armor. Their worth is their enchantment: you enchant them like any other gear (gem-set
   and finer metals hold more magic: jpow), break enchanted ones down to learn their effect, and find them on foes,
   in dungeons and on traders' shelves. The forge makes them from ingots and gems (Jewellery group).
   Loads after smithing.js (which made the old silver and gold pieces) and enchanting.js. */
const JEWELRY = (() => {
  const GEMS = { garnet: ["Garnet", 100, 0.04], amethyst: ["Amethyst", 120, 0.05], ruby: ["Ruby", 150, 0.07], sapphire: ["Sapphire", 250, 0.09], emerald: ["Emerald", 750, 0.12], diamond: ["Diamond", 900, 0.15] };
  /* metal: [name, ingot, ring value, necklace value, gems it takes, magic it holds (jpow), smithing perk needed, tier] */
  const METAL = {
    iron: ["Iron", "mat_iron", 20, 30, ["garnet", "amethyst"], 0.9, null, 1],
    silver: ["Silver", "mat_silver", 65, 90, ["garnet", "amethyst", "ruby"], 1.0, null, 2],
    gold: ["Gold", "mat_gold", 130, 180, ["ruby", "sapphire", "emerald", "diamond"], 1.05, null, 3],
    moonstone: ["Moonstone", "mat_moonstone", 160, 220, ["amethyst", "sapphire", "emerald"], 1.1, "elven_smithing", 3],
    dwarven: ["Dwarven", "mat_dwarven", 180, 250, ["ruby", "diamond"], 1.1, "dwarven_smithing", 4],
  };
  const KIND = { ring: ["Ring", "ring", 0.25, 1.15], necklace: ["Necklace", "amulet", 0.5, 1.3] };
  const ALL = [];   // every plain jewellery id, by tier
  for (const [m, [mn, ingot, ringV, neckV, gems, pow, perk, tier]] of Object.entries(METAL)) {
    for (const [kind, [kn, slot, w, gemMul]] of Object.entries(KIND)) {
      const base = kind === "ring" ? ringV : neckV;
      const mk = (id, name, value, gem) => {
        const old = D.ITEMS[id] || {};
        D.ITEMS[id] = { ...old, name: old.name || name, value: old.value || value, weight: w, slot, metal: m, gem: gem || null, jpow: +(pow + (gem ? GEMS[gem][2] : 0)).toFixed(2), tier: tier + (gem ? 1 : 0) };
        if (!SMITH.RECIPES[id]) SMITH.RECIPES[id] = { group: "jewel", mats: [[ingot, 1], ...(gem ? [["gem_" + gem, 1]] : [])], perk };
        else SMITH.RECIPES[id].perk = perk;
        ALL.push(id);
      };
      mk(`${m}_${kind}`, `${mn} ${kn}`, base, null);
      for (const g of gems) mk(`${m}_${g}_${kind}`, `${mn} ${GEMS[g][0]} ${kn}`, Math.min(1200, Math.round(base + GEMS[g][1] * gemMul)), g);
    }
  }
  // any other jewellery made elsewhere (guild rewards, quests) still goes on a finger or round the neck
  for (const [id, it] of Object.entries(D.ITEMS)) if (it && it.slot === "valuable" && /_(ring|necklace|amulet)$/.test(id)) { it.slot = /_ring$/.test(id) ? "ring" : "amulet"; it.jpow = it.jpow || 1; }

  // ---- a few famous pieces ([Skyrim]), rare on the strongest foes. They can't be broken down.
  const U = (name, slot, value, list, desc) => ({ name, slot, value, weight: slot === "ring" ? 0.25 : 0.5, unique: true, metal: "gold", gem: "diamond", jpow: 1, desc,
    aenchant: { key: ENCH.ARMOR[list[0][0]][1], mag: list[0][1], name: ENCH.ARMOR[list[0][0]][0], eff: list[0][0], more: list.slice(1).map(([e, m]) => ({ key: ENCH.ARMOR[e][1], mag: m, name: ENCH.ARMOR[e][0], eff: e })) } });
  Object.assign(D.ITEMS, {
    gauldur_amulet: U("Gauldur Amulet", "amulet", 1500, [["health", 30], ["magicka", 30], ["stamina", 30]], "Three brothers broke it apart. Whole again, it makes you sturdier in every way."),
    amulet_articulation: U("Amulet of Articulation", "amulet", 900, [["speech", 15], ["barter", 10]], "Whoever wears it is hard to say no to."),
    ring_of_the_erudite: U("Ring of the Erudite", "ring", 900, [["regen_magicka", 40], ["magicka", 15]], "A college ring that keeps your magicka flowing."),
    ring_of_the_hunt: U("Ring of the Hunt", "ring", 900, [["archery", 12], ["evasion", 4]], "Worn by a hunter who never missed and was never caught."),
  });
  const UNIQUES = ["gauldur_amulet", "amulet_articulation", "ring_of_the_erudite", "ring_of_the_hunt"];

  // effects that can go on rings and on amulets
  const effs = (slot) => Object.keys(ENCH.ARMOR).filter((e) => ENCH.ARMOR[e][3].includes(slot));
  /* an enchanted piece: magnitude grows with the foe's level ([OURS] a quarter of full strength at level 1, three quarters by level 50) */
  function rollEnchanted(id, level) {
    const it = D.ITEMS[id], list = effs(it.slot), eff = list[Math.floor(Math.random() * list.length)];
    const full = ENCH.ARMOR[eff][2], k = Math.min(0.75, 0.25 + 0.5 * Math.min(50, level || 1) / 50) * (it.jpow || 1) * (0.85 + Math.random() * 0.3);
    return `ench|${id}|${eff}|${Math.max(1, Math.round(full * k))}|0`;
  }
  /* which base: higher foes carry finer metals and gems */
  function rollBase(level, kind) {
    const maxTier = level < 8 ? 2 : level < 16 ? 3 : level < 28 ? 4 : 5;
    const pool = ALL.filter((id) => D.ITEMS[id].tier <= maxTier && D.ITEMS[id].tier >= maxTier - 2 && (!kind || D.ITEMS[id].slot === kind));
    return pool[Math.floor(Math.random() * pool.length)] || "silver_ring";
  }
  /* foe loot: rings and amulets now and then, often enchanted. Jeweller (Enchanting) finds more. */
  function loot(s, e) {
    const tags = new Set(e.tags || []);
    if (!(tags.has("humanoid") || e.boss || tags.has("dragon"))) return [];
    const find = 1 + (typeof PFX !== "undefined" ? Math.min(1, PFX.num(s, "jewelfind")) : 0);
    const ch = (e.boss ? 0.25 : tags.has("elite") ? 0.1 : 0.03) * find;
    if (Math.random() >= ch) return [];
    const lvl = e.level || s.level || 1;
    let id;
    if ((e.boss || tags.has("elite")) && lvl >= 15 && Math.random() < 0.06) id = UNIQUES[Math.floor(Math.random() * UNIQUES.length)];
    else { const b = rollBase(lvl); id = Math.random() < (e.boss ? 0.7 : 0.45) ? rollEnchanted(b, lvl) : b; }
    G.give(s, id);
    return [D.ITEMS[id].name];
  }

  // ---- where they turn up
  D.SHOP_STOCK.general.push("iron_ring", "silver_ring", "silver_necklace");
  D.SHOP_STOCK.wizard.push("ench|silver_ring|magicka|12|0", "ench|silver_necklace|health|12|0", "ench|gold_ring|regen_magicka|18|0", "ench|silver_ring|resist_fire|10|0", "ench|gold_necklace|destruction|10|0", "ench|silver_ring|alchemy|8|0", "ench|gold_ring|barter|8|0");
  const THEME = { barrow: ["ench|gold_ring|resist_frost|15|0", "ench|silver_garnet_necklace|stamina|20|0"], vampire: ["ench|silver_amethyst_ring|regen_health|25|0", "ench|gold_ruby_necklace|resist|15|0"],
    dwemer: ["ench|dwarven_ring|smithing|10|0", "ench|dwarven_necklace|resist_shock|15|0"], thalmor: ["ench|moonstone_ring|destruction|12|0", "ench|moonstone_necklace|magicka|25|0"],
    forsworn: ["ench|silver_ring|onehanded|10|0"], fort: ["ench|iron_ring|block|6|0"], cave: ["ench|iron_necklace|resist_poison|12|0"] };
  if (typeof DUNGEONS !== "undefined") for (const [t, ids] of Object.entries(THEME)) DUNGEONS.THEMES[t]?.loot.push(...ids.filter((id) => D.ITEMS[id]));

  /* what a ring or amulet does, in plain words (item details, picker) */
  const describe = (it) => (typeof ENCH !== "undefined" && ENCH.lines ? ENCH.lines(it) : []).join(" ");
  return { METAL, GEMS, ALL, UNIQUES, loot, rollEnchanted, rollBase, describe, effs };
})();
