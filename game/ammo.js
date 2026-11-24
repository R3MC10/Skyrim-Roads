/* Ammunition: bows shoot arrows, crossbows shoot bolts ([Skyrim] arrow/bolt damage adds to the bow's).
   Your best matching ammo is used automatically. Each shot uses one; about a third can be picked up again
   after the fight ([Skyrim] you recover some arrows from bodies — our 1/3 is [OURS]). No ammo: you can only
   bash with the bow. Crossbows are [Skyrim: Dawnguard]. */
const AMMO = (() => {
  const RECOVER = 1 / 3;
  // [Skyrim] damage and value; weight 0 like Skyrim
  const ARROWS = { iron: ["Iron Arrow", 8, 1], forsworn: ["Forsworn Arrow", 6, 1], steel: ["Steel Arrow", 10, 2], ancient_nord: ["Ancient Nord Arrow", 10, 2], orcish: ["Orcish Arrow", 12, 3], dwarven: ["Dwarven Arrow", 14, 4], elven: ["Elven Arrow", 16, 5], glass: ["Glass Arrow", 18, 6], ebony: ["Ebony Arrow", 20, 7] };
  const BOLTS = { steel: ["Steel Bolt", 10, 1], dwarven: ["Dwarven Bolt", 14, 4] };
  for (const [k, [name, damage, value]] of Object.entries(ARROWS)) D.ITEMS[`arrow_${k}`] = { name, slot: "ammo", ammo: "arrow", damage, weight: 0, value };
  for (const [k, [name, damage, value]] of Object.entries(BOLTS)) D.ITEMS[`bolt_${k}`] = { name, slot: "ammo", ammo: "bolt", damage, weight: 0, value };
  // [Skyrim: Dawnguard] crossbows (the "enhanced" ones ignore half of the target's armor in Skyrim; here they just hit a bit harder)
  Object.assign(D.ITEMS, {
    crossbow: { name: "Crossbow", slot: "weapon", hands: 2, skill: "Archery", damage: 19, weight: 14, value: 120, shoots: "bolt" },
    crossbow_enhanced: { name: "Enhanced Crossbow", slot: "weapon", hands: 2, skill: "Archery", damage: 21, weight: 15, value: 200, shoots: "bolt" },
    crossbow_dwarven: { name: "Dwarven Crossbow", slot: "weapon", hands: 2, skill: "Archery", damage: 22, weight: 20, value: 350, shoots: "bolt" },
    crossbow_dwarven_enhanced: { name: "Enhanced Dwarven Crossbow", slot: "weapon", hands: 2, skill: "Archery", damage: 24, weight: 21, value: 550, shoots: "bolt" },
  });

  // what shoots what
  const baseOf = (id) => (id && id.startsWith("ench|") ? id.split("|")[1] : id);
  function kindFor(weapon, itemId) {
    if (!weapon || weapon.skill !== "Archery") return null;
    if (weapon.shoots) return weapon.shoots;
    return /crossbow/.test(baseOf(itemId) || "") ? "bolt" : "arrow";
  }
  const label = (kind) => (kind === "bolt" ? "bolts" : "arrows");
  /* the best ammo of the right kind in the pack. left(row) says how many are still there (a fight tracks its own use) */
  function best(s, kind, left = (r) => r.qty) {
    let b = null;
    for (const r of s.inv) { const it = D.ITEMS[r.item]; if (it?.slot === "ammo" && it.ammo === kind && left(r) > 0 && (!b || it.damage > D.ITEMS[b.item].damage)) b = r; }
    return b;
  }
  const count = (s, kind) => s.inv.filter((r) => D.ITEMS[r.item]?.slot === "ammo" && D.ITEMS[r.item].ammo === kind).reduce((a, r) => a + r.qty, 0);
  /* what your equipped weapon shoots and how many you have — for the Hero/Pack/Tactics notes */
  function status(s) {
    const eq = G.equipment(s), w = eq.weapon, it = w && D.ITEMS[w.item], kind = kindFor(it, w?.item);
    if (!kind) return null;
    const b = best(s, kind);
    return { kind, n: count(s, kind), best: b ? D.ITEMS[b.item].name : null, text: b ? `${count(s, kind)} ${label(kind)} (shooting ${D.ITEMS[b.item].name}s)` : `No ${label(kind)}! Your ${it.name} can only bash. Buy ${label(kind)} at a blacksmith or general store.` };
  }

  // ---- shops, loot and the forge
  D.SHOP_STOCK.general.push("arrow_iron", "arrow_steel");
  D.SHOP_STOCK.blacksmith.push("arrow_iron", "arrow_steel", "arrow_dwarven", "bolt_steel", "crossbow");
  D.LOOT.humanoid.push(["arrow_iron", 0.12], ["arrow_steel", 0.06], ["bolt_steel", 0.03], ["crossbow", 0.01]);
  D.LOOT.elite.push(["arrow_elven", 0.1], ["arrow_dwarven", 0.08], ["arrow_glass", 0.03], ["bolt_dwarven", 0.06], ["crossbow_enhanced", 0.02], ["crossbow_dwarven", 0.015]);
  const LOOT_QTY = { arrow: [6, 14], bolt: [4, 10] };   // ammo drops come in a handful, not one
  if (typeof DUNGEONS !== "undefined") {
    for (const [theme, items] of Object.entries({ barrow: ["arrow_ancient_nord"], forsworn: ["arrow_forsworn"], dwemer: ["arrow_dwarven", "bolt_dwarven", "crossbow_dwarven"], fort: ["arrow_steel", "bolt_steel"], thalmor: ["arrow_elven"] }))
      DUNGEONS.THEMES[theme]?.loot.push(...items);
  }
  // [Skyrim] forge: 1 ingot + 1 firewood makes 24 arrows (Dawnguard: bolts in tens; we use 24 for both kinds of shaft)
  if (typeof SMITH !== "undefined") {
    const add = (id, group, mats, perk, out) => { SMITH.RECIPES[id] = { group, mats, perk, out }; };
    add("arrow_iron", "bows", [["mat_iron", 1], ["mat_firewood", 1]], null, 24);
    add("arrow_steel", "bows", [["mat_steel", 1], ["mat_firewood", 1]], "steel_smithing", 24);
    add("arrow_elven", "bows", [["mat_moonstone", 1], ["mat_firewood", 1]], "elven_smithing", 24);
    add("arrow_dwarven", "bows", [["mat_dwarven", 1], ["mat_firewood", 1]], "dwarven_smithing", 24);
    add("bolt_steel", "bows", [["mat_steel", 1], ["mat_firewood", 1]], "steel_smithing", 24);
    add("bolt_dwarven", "bows", [["mat_dwarven", 1], ["mat_firewood", 1]], "dwarven_smithing", 24);
    add("crossbow", "bows", [["mat_steel", 2], ["mat_firewood", 2], ["mat_strips", 1]], "steel_smithing", 1);
    add("crossbow_dwarven", "bows", [["mat_dwarven", 3], ["mat_steel", 1], ["mat_strips", 1]], "dwarven_smithing", 1);
  }

  // ---- old saves: anyone already carrying a bow gets a quiver once
  function migrate(s) {
    if ((s.ammoV || 0) >= 1) return null;
    s.ammoV = 1;
    const bows = s.inv.filter((r) => { const it = D.ITEMS[r.item]; return it?.skill === "Archery"; });
    if (!bows.length) return null;
    G.give(s, "arrow_iron", 40);
    return " Bows now need arrows. You find a quiver of 40 Iron Arrows in your pack. Blacksmiths and general stores sell more.";
  }
  return { ARROWS, BOLTS, RECOVER, LOOT_QTY, kindFor, best, count, status, label, migrate };
})();
