/* What town traders may sell. [OURS]
   Remigiusz: "Gear bought in towns and cities from npc should be capped at basic tier with enchantments. Same with jewelry."
   - Weapons, armour and ammo from shops, caravans and the Khajiit market are basic metals only: iron, steel, hide,
     leather, fur, chainmail, studded, imperial, hunting and long bows, mage robes. Elven, dwarven, orcish, glass, ebony,
     daedric, dragon and the like come from the world: dungeons, bosses, quests and your own forge.
   - Enchanted pieces are allowed, but only with a weak enchantment (up to half of the strongest one).
   - Staffs: only novice and apprentice spells.
   - Jewellery: plain silver and gold rings and necklaces only. Gem-set pieces are made at a forge or found. */
const SHOPCAP = (() => {
  const HIGH = /elven|dwarven|orcish|glass|ebony|daedric|dragon|stalhrim|nordic|ancient|scaled|steel plate|bonemold|chitin|falmer|nightingale|forsworn|silver (sword|greatsword)|officer|blades|dawnguard|ornate|guard's/i;
  const ARMORISH = new Set(["weapon", "head", "chest", "hands", "feet", "shield", "ammo"]);
  const JEWEL = /_(ring|necklace|circlet|amulet)$/;
  const PLAIN_JEWEL = /^(iron|silver|gold)_(ring|necklace)$/;
  const ENCH_MAX = 20;          // Fortify enchantments on found armour go up to 40: shops stop at half
  const baseOf = (id) => (String(id).startsWith("ench|") ? String(id).split("|")[1] : String(id));
  const isJewel = (id, it) => JEWEL.test(baseOf(id)) || ["ring", "neck", "amulet", "circlet"].includes(it?.slot);
  const isGear = (id, it) => !!it && (ARMORISH.has(it.slot) || isJewel(id, it));
  /* basic metal: by the base item's name (and id, for the odd unnamed one) */
  function basicBase(id) {
    const b = baseOf(id), it = D.ITEMS[b];
    if (!it) return false;
    if (it.unique || it.dae || it.legendary) return false;
    return !HIGH.test(it.name || "") && !HIGH.test(b.replace(/_/g, " "));
  }
  function weakEnchant(it) {
    if (it.aenchant) return (it.aenchant.mag || 0) <= ENCH_MAX;
    if (it.enchant) { const e = it.enchant; return !e.max_magnitude || (e.magnitude || 0) <= e.max_magnitude * 0.5; }
    return true;
  }
  /* may a town trader sell this? Anything that isn't gear (potions, food, tomes, ingots...) is not capped here */
  function ok(id) {
    const it = D.ITEMS[id];
    if (!isGear(id, it)) return true;
    if (isJewel(id, it)) return PLAIN_JEWEL.test(baseOf(id)) && weakEnchant(it);
    if (it.staff) { const sp = D.SPELLS[it.staff.spell]; return !sp || ["Novice", "Apprentice"].includes(sp.level || sp.tier); }   // staffs: novice and apprentice spells only
    return basicBase(id) && weakEnchant(it);
  }
  const filter = (list) => (list || []).filter((id) => ok(id));
  const why = (id) => (ok(id) ? "" : isJewel(id, D.ITEMS[id]) ? "Traders only sell plain silver and gold jewellery. Gem-set pieces you make at a forge or find." : "Traders only sell basic gear. Finer metals you find in the world or forge yourself.");
  return { ok, filter, why, basicBase, weakEnchant, isGear, isJewel, ENCH_MAX };
})();
if (typeof module !== "undefined") module.exports = SHOPCAP;
