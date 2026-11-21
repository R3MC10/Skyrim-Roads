/* Spell tomes at merchants, like Skyrim: every court wizard sells the Novice and Apprentice tomes; some wizards
   also stock Adept tomes; the College of Winterhold sells Expert ones; a few general stores (Belethor in Whiterun,
   the Pawned Prawn in Riften…) carry a couple of cheap tomes. New spells use the kinds the fight engine already has
   (damage, heal, armor, summon, calm). [Skyrim] names, schools and levels; costs and amounts are Skyrim's base
   values where the game has them, otherwise [OURS] in the same scale. */
const TOMES = (() => {
  //            id                 name                    school          level     cost  kind      amount  extra
  const NEW = [
    ["chain_lightning", "Chain Lightning", "Destruction", "Adept", 89, "damage", 40, { element: "shock" }],
    ["ice_storm", "Ice Storm", "Destruction", "Adept", 106, "damage", 40, { element: "frost" }],
    ["incinerate", "Incinerate", "Destruction", "Expert", 115, "damage", 60, { element: "fire" }],
    ["icy_spear", "Icy Spear", "Destruction", "Expert", 129, "damage", 60, { element: "frost" }],
    ["thunderbolt", "Thunderbolt", "Destruction", "Expert", 140, "damage", 60, { element: "shock" }],
    ["close_wounds", "Close Wounds", "Restoration", "Adept", 140, "heal", 100, {}],
    ["stendarrs_aura", "Stendarr's Aura", "Restoration", "Adept", 190, "damage", 40, { element: "sun" }],
    ["stoneflesh", "Stoneflesh", "Alteration", "Apprentice", 194, "armor", 60, {}],
    ["ironflesh", "Ironflesh", "Alteration", "Adept", 312, "armor", 80, {}],
    ["ebonyflesh", "Ebonyflesh", "Alteration", "Expert", 492, "armor", 100, {}],
    ["flame_atronach", "Conjure Flame Atronach", "Conjuration", "Apprentice", 115, "summon", 14, { turns: 60 }],
    ["frost_atronach", "Conjure Frost Atronach", "Conjuration", "Adept", 168, "summon", 22, { turns: 60 }],
    ["storm_atronach", "Conjure Storm Atronach", "Conjuration", "Expert", 271, "summon", 32, { turns: 60 }],
    ["pacify", "Pacify", "Illusion", "Adept", 222, "calm", 0, { max_level: 20, turns: 30 }],
  ];
  const TOME_VALUE = { Novice: 50, Apprentice: 96, Adept: 340, Expert: 1200 };   // [Skyrim] spell tome prices by level
  for (const [id, name, school, level, cost, kind, amount, extra] of NEW) {
    D.SPELLS[id] = { name, school, cost, xp: kind === "heal" || kind === "calm" ? Math.round(cost * 0.25) : Math.round(cost * 0.5), kind, ...(kind === "calm" ? {} : { amount }), ...extra, level };
    D.ITEMS[`tome_${id}`] = { name: `Spell Tome: ${name}`, slot: "tome", spell: id, weight: 1, value: TOME_VALUE[level] };
  }
  // tomes for the spells everyone starts with, so they can be bought back or given to friends
  for (const id of ["flames", "healing"]) if (!D.ITEMS[`tome_${id}`]) D.ITEMS[`tome_${id}`] = { name: `Spell Tome: ${D.SPELLS[id].name}`, slot: "tome", spell: id, weight: 1, value: 50 };

  // what each town's merchants add to the usual stock
  const ADEPT = ["tome_chain_lightning", "tome_ice_storm", "tome_close_wounds", "tome_stendarrs_aura", "tome_ironflesh", "tome_frost_atronach", "tome_pacify"];
  D.TOWN_STOCK = D.TOWN_STOCK || {};
  const addStock = (town, shop, items) => { D.TOWN_STOCK[town] = D.TOWN_STOCK[town] || {}; D.TOWN_STOCK[town][shop] = [...(D.TOWN_STOCK[town][shop] || []), ...items]; };
  D.SHOP_STOCK.wizard.push("tome_stoneflesh", "tome_flame_atronach");                        // every court wizard
  addStock("Whiterun", "wizard", ["tome_chain_lightning", "tome_ironflesh"]);                // Farengar
  addStock("Solitude", "wizard", ["tome_close_wounds", "tome_stendarrs_aura"]);             // Sybille Stentor
  addStock("Windhelm", "wizard", ["tome_ice_storm", "tome_frost_atronach"]);                // Wuunferth
  addStock("Markarth", "wizard", ["tome_pacify", "tome_ironflesh"]);                        // Calcelmo
  addStock("Morthal", "wizard", ["tome_frost_atronach", "tome_close_wounds"]);              // Falion
  addStock("Winterhold", "wizard", [...ADEPT, "tome_incinerate", "tome_icy_spear", "tome_thunderbolt", "tome_ebonyflesh", "tome_storm_atronach"]);   // the College
  addStock("Whiterun", "general", ["tome_flames", "tome_frostbite", "tome_healing", "tome_oakflesh"]);   // Belethor
  addStock("Riften", "general", ["tome_sparks", "tome_familiar", "tome_fury"]);             // the Pawned Prawn
  addStock("Solitude", "general", ["tome_healing", "tome_sparks"]);
  addStock("Dawnstar", "general", ["tome_frostbite"]);
  addStock("Riverwood", "general", ["tome_healing"]);
  // rarer tomes turn up in dungeons, mostly on tough foes
  D.LOOT.elite.push(["tome_chain_lightning", 0.02], ["tome_ice_storm", 0.02], ["tome_ironflesh", 0.015], ["tome_frost_atronach", 0.015], ["tome_close_wounds", 0.015], ["tome_incinerate", 0.005], ["tome_thunderbolt", 0.005]);

  const stockAt = (town, shop) => [...new Set([...(D.SHOP_STOCK[shop] || []), ...((D.TOWN_STOCK[town] || {})[shop] || [])])];
  const level = (spellId) => D.SPELLS[spellId]?.level || ({ flames: "Novice", frostbite: "Novice", sparks: "Novice", healing: "Novice", oakflesh: "Novice", conjure_familiar: "Novice", fury: "Apprentice", firebolt: "Apprentice", ice_spike: "Apprentice", lightning_bolt: "Apprentice", fast_healing: "Apprentice", sun_fire: "Novice", calm: "Apprentice", fireball: "Adept" }[spellId] || "Novice");
  return { NEW, TOME_VALUE, stockAt, level };
})();
