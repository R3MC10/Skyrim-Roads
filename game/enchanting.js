/* Enchanting ([Skyrim] the arcane enchanter): break an enchanted item down to learn its effect, then put that effect
   on your own weapon or armor with a filled soul gem. Weapon effects use the charge system already in the game;
   armor effects work all the time while worn. Strength: [OURS] Skyrim-like scaling by soul size and Enchanting skill. */
const ENCH = (() => {
  // weapon effects: [name, max magnitude, base cost] (from the Skyrim enchanted weapons already in the game)
  const WEAPON = { fire: ["Fire", 30, 11], frost: ["Frost", 30, 12], shock: ["Shock", 30, 14], absorb: ["Absorb Health", 25, 31] };
  // armor effects: [name, what it does (same keys as potions), magnitude at full strength, allowed slots]
  const ARMOR = {
    health: ["Fortify Health", "max:health", 40, ["chest", "shield", "head"]],
    magicka: ["Fortify Magicka", "max:magicka", 40, ["head", "chest", "hands"]],
    stamina: ["Fortify Stamina", "max:stamina", 40, ["chest", "feet", "shield"]],
    carry: ["Fortify Carry Weight", "carry", 40, ["hands", "feet"]],
    onehanded: ["Fortify One-Handed", "dmg:One-Handed", 25, ["hands", "feet"]],
    twohanded: ["Fortify Two-Handed", "dmg:Two-Handed", 25, ["hands", "feet"]],
    archery: ["Fortify Archery", "dmg:Archery", 25, ["head", "hands"]],
    sneak: ["Fortify Sneak", "skill:Sneak", 25, ["feet", "hands", "head"]],
    lockpicking: ["Fortify Lockpicking", "skill:Lockpicking", 25, ["head", "hands"]],
    destruction: ["Fortify Destruction", "spell:Destruction", 25, ["head", "chest"]],
    restoration: ["Fortify Restoration", "spell:Restoration", 25, ["head", "chest"]],
    barter: ["Fortify Barter", "barter", 20, ["head", "hands"]],
    resist: ["Resist Magic", "resist", 25, ["shield", "chest"]],
  };
  // enchanted armor you can find, buy and break down to learn its effect ([Skyrim] names)
  const FOUND = [
    ["iron_helmet", "health", 20], ["hide_bracers", "onehanded", 12], ["leather_boots", "sneak", 12], ["hide_boots", "carry", 20],
    ["leather_helmet", "archery", 12], ["mage_robes", "destruction", 12], ["iron_gauntlets", "twohanded", 12], ["leather_bracers", "lockpicking", 12],
    ["hide_helmet", "magicka", 20], ["iron_shield", "resist", 12], ["chainmail_boots", "stamina", 20], ["hide_armor", "restoration", 12],
  ];
  const GEM_POWER = { soul_gem_common: 0.6, soul_gem_greater: 0.8 };   // [Skyrim] Common and Greater souls (Grand would be 1.0)

  /* enchanted items are made on demand from their id: ench|<base item>|<effect>|<magnitude>|<charge capacity> */
  function make(id) {
    const [, base, eff, magS, capS] = id.split("|"), b = D.ITEMS[base], mag = +magS, cap = +capS;
    if (!b) return undefined;
    if (WEAPON[eff]) {
      const [name, max, cost] = WEAPON[eff];
      return { ...b, name: `${b.name} of ${name}`, value: Math.round(b.value + mag * 8), enchant: { effect: eff, magnitude: mag, max_magnitude: max, base_cost: cost, capacity: cap } };
    }
    const [name, key] = ARMOR[eff];
    return { ...b, name: `${b.name} of ${name.replace("Fortify ", "")}`, value: Math.round(b.value + mag * 6), aenchant: { key, mag, name } };
  }
  const inner = D.ITEMS;
  D.ITEMS = new Proxy(inner, { get(t, k) { if (typeof k === "string" && !(k in t) && k.startsWith("ench|")) { const it = make(k); if (it) t[k] = it; } return t[k]; } });
  // found armor enters the loot tables and the court wizards' shelves
  const foundIds = FOUND.map(([b, e, m]) => `ench|${b}|${e}|${m}|0`);
  D.LOOT.humanoid.push(...foundIds.slice(0, 6).map((id) => [id, 0.012]));
  D.LOOT.elite.push(...foundIds.map((id) => [id, 0.04]));
  D.SHOP_STOCK.wizard.push(...foundIds.slice(0, 5));

  const isEnchanted = (it) => !!(it?.enchant || it?.aenchant);
  const effectOf = (itemId) => { const it = D.ITEMS[itemId]; if (it?.enchant) return it.enchant.effect; if (it?.aenchant) return itemId.startsWith("ench|") ? itemId.split("|")[2] : Object.keys(ARMOR).find((k) => ARMOR[k][1] === it.aenchant.key); return null; };
  const known = (s) => s.enchants || [];
  const hasEnchanter = (place) => !!place && (G.shopTypes(place).includes("wizard") || place === "Winterhold");

  const atEnchanter = (s) => hasEnchanter(s.location) || (typeof HSROOMS !== "undefined" && HSROOMS.station(s, "enchanter"));   // your homestead's enchanter's tower
  function disenchant(s, rowId) {   // [Skyrim] destroys the item, teaches its effect
    if (!atEnchanter(s)) return "You need an arcane enchanter: court wizards' towers and the College of Winterhold have one.";
    const r = G.invRow(s, rowId), it = r && D.ITEMS[r.item];
    if (!isEnchanted(it)) return "That isn't enchanted.";
    if (it.mask) return "The mask's old magic won't come loose. It isn't something you can break for its secrets.";
    if (Object.values(G.loadout(s).equipment).includes(rowId)) return "Take it off first.";
    const eff = effectOf(r.item);
    if (known(s).includes(eff)) return `You already know ${(WEAPON[eff] || ARMOR[eff])[0]}. Breaking it would teach you nothing.`;
    G.take(s, rowId);
    s.enchants = [...known(s), eff];
    const sk = G.useSkill(s, "Enchanting", 0.5);
    return `The ${it.name} crumbles into light. You learned ${(WEAPON[eff] || ARMOR[eff])[0]}.` + (sk.length ? " " + sk.join(". ") : "");
  }
  /* how strong an enchantment would be ([OURS] scaling): soul size × (0.4 + 0.6 × skill/100), Enchanter perk +10% per rank */
  function strength(s, gemItem) { return (GEM_POWER[gemItem] || 0.6) * (0.4 + 0.6 * Math.min(100, G.skill(s, "Enchanting")) / 100) * (1 + 0.1 * G.P(s, "enchanter")) * (1 + (typeof HSROOMS !== "undefined" ? HSROOMS.bonus(s, "ench") : 0)); }   // +10% at your own enchanter's tower
  /* [OURS] the bigger Enchanting tree: Fire/Frost/Storm Enchanter, Insightful and Corpus Enchanter, Extra Effect (capped) */
  const CORPUS = ["health", "magicka", "stamina"];
  function perkBoost(s, eff) {
    if (typeof PFX === "undefined") return 0;
    const el = WEAPON[eff] ? (["fire", "frost", "shock"].includes(eff) ? eff : "other") : CORPUS.includes(eff) ? "corpus" : "armor";
    return Math.min(0.4, PFX.sum(s, "ench", null, { el }));
  }
  function preview(s, rowId, eff, gemRowId) {
    const r = G.invRow(s, rowId), g = G.invRow(s, gemRowId);
    if (!r || !g) return null;
    const it = D.ITEMS[r.item], k = strength(s, g.item) * (1 + perkBoost(s, eff));
    if (WEAPON[eff]) return { mag: Math.max(1, Math.round(WEAPON[eff][1] * k)), cap: D.ITEMS[g.item].charge };
    return { mag: Math.max(1, Math.round(ARMOR[eff][2] * k)), cap: 0 };
  }
  const canTake = (it, eff) => WEAPON[eff] ? it.slot === "weapon" : ARMOR[eff] && ARMOR[eff][3].includes(it.slot);
  function enchant(s, rowId, eff, gemRowId, opt = {}) {   // opt.boost: mini-game multiplier on magnitude; opt.botch: the soul slips away (craftgames.js)
    if (!atEnchanter(s)) return "You need an arcane enchanter.";
    const r = G.invRow(s, rowId), g = G.invRow(s, gemRowId), it = r && D.ITEMS[r.item];
    if (!it || isEnchanted(it)) return "Pick an unenchanted weapon or piece of armor.";
    if (!known(s).includes(eff)) return "You don't know that enchantment.";
    if (!canTake(it, eff)) return `${(WEAPON[eff] || ARMOR[eff])[0]} can't go on that. ${ARMOR[eff] ? `It fits: ${ARMOR[eff][3].join(", ")}.` : "Weapons only."}`;
    if (!g || D.ITEMS[g.item].slot !== "soulgem") return "You need a filled soul gem.";
    if (opt.botch) { G.take(s, gemRowId); const sk = G.useSkill(s, "Enchanting", 0.5); return `The rune breaks and the soul slips out of the gem. The ${it.name} is unharmed, but the soul gem is spent.` + (sk.length ? " " + sk.join(". ") : ""); }
    const p = preview(s, rowId, eff, gemRowId);
    if (opt.boost > 1) p.mag = Math.max(p.mag, Math.round(p.mag * opt.boost));
    const id = `ench|${r.item}|${eff}|${p.mag}|${p.cap}`;
    const keep = { temper: r.temper, tq: r.tq };
    G.take(s, rowId); G.take(s, gemRowId);
    const nid = G.give(s, id, 1, p.cap || null), nr = G.invRow(s, nid);
    if (nr && keep.temper) Object.assign(nr, keep);
    const sk = G.useSkill(s, "Enchanting", 1);                                                  // [Skyrim] Enchanting uses a tiny base XP with a huge multiplier
    return `The soul pours into the ${it.name}. You made ${D.ITEMS[id].name} (${p.mag}${WEAPON[eff] ? " damage per hit" : ARMOR[eff][1].startsWith("dmg") || ARMOR[eff][1].startsWith("spell") || ARMOR[eff][1] === "barter" || ARMOR[eff][1] === "resist" ? "%" : ""}).` + (sk.length ? " " + sk.join(". ") : "");
  }
  /* worn armor enchantments, read by fxSum in the engine */
  function worn(s, key) {
    let n = 0;
    for (const id of Object.values(G.loadout(s).equipment)) { const r = G.invRow(s, id), it = r && D.ITEMS[r.item]; if (!it?.aenchant) continue; if (it.aenchant.key === key) n += it.aenchant.mag; for (const m of it.aenchant.more || []) if (m.key === key) n += m.mag; }   // masks carry several
    return n;
  }
  return { WEAPON, ARMOR, known, hasEnchanter, atEnchanter, disenchant, preview, enchant, canTake, worn, isEnchanted, effectOf, strength };
})();
