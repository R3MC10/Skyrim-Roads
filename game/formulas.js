/* Every game formula, with its source. Same as formulas.py in the Discord prototype.
   [Skyrim] / [Oblivion] / [Morrowind] / [Daggerfall] = copied from that game (UESP pages linked).
   [OURS] = our own rule (no source exists, or we need a turn-based version of a real-time mechanic).
   One combat turn = about 1 second of Skyrim combat, so Skyrim's per-second values count per turn. */
const F = (() => {
  // [Skyrim] https://en.uesp.net/wiki/Skyrim:Leveling  [use_mult, use_offset, improve_mult, improve_offset]
  const SKYRIM_SKILL_XP = {
    "Alteration": [3, 0, 2, 0], "Conjuration": [2.1, 0, 2, 0], "Destruction": [1.35, 0, 2, 0],
    "Illusion": [4.6, 0, 2, 0], "Restoration": [2, 0, 2, 0], "Enchanting": [900, 0, 1, 170],
    "One-Handed": [6.3, 0, 2, 0], "Two-Handed": [5.95, 0, 2, 0], "Archery": [9.3, 0, 2, 0],
    "Blocking": [8.1, 0, 2, 0], "Smithing": [1, 0, 0.25, 300], "Heavy Armor": [3.8, 0, 2, 0],
    "Light Armor": [4, 0, 2, 0], "Pickpocket": [8.1, 0, 0.25, 250], "Lockpicking": [45, 10, 0.25, 300],
    "Sneak": [11.25, 0, 0.5, 120], "Alchemy": [0.75, 0, 1.6, 65],
    "Mercantile": [0.36, 0, 2, 0], "Speechcraft": [0.36, 0, 2, 0],          // Skyrim's Speech values
    // [OURS] borrowed from the closest Skyrim skill
    "Spear": [5.95, 0, 2, 0], "Medium Armor": [3.9, 0, 2, 0], "Hand-to-Hand": [6.3, 0, 2, 0],
    "Mysticism": [3, 0, 2, 0], "Etiquette": [0.36, 0, 2, 0], "Streetwise": [0.36, 0, 2, 0],
  };
  // [Oblivion] https://content2.uesp.net/wiki/Oblivion:Skill_Boosting  XP to level = 0.25883 × level^1.5
  const OBLIVION_SKILLS = new Set(["Athletics", "Acrobatics", "Unarmored"]);

  const F = {
    ATHLETICS_XP_PER_SECOND: 0.03,          // [Oblivion] per second spent running
    UNARMORED_XP_PER_HIT: 1.0,              // [Morrowind] https://en.uesp.net/wiki/Morrowind:Unarmored
    ATTRIBUTE_PER_LEVEL: 10,                // [Skyrim] https://en.uesp.net/wiki/Skyrim:Attributes
    CARRY_PER_STAMINA_LEVEL: 5,
    BASE_CARRY: 300,
    REGEN_PER_SECOND: { health: 0.007, magicka: 0.03, stamina: 0.05 },
    IRON_ARROW_DAMAGE: 8,                   // [OURS-simplified] unlimited iron arrows
    POWER_ATTACK_DAMAGE: 2.0,               // [Skyrim] https://en.uesp.net/wiki/Skyrim:Damage
    BLOCK_STAMINA: 10,                      // [OURS] UESP: "a small amount"
    RECHARGE_XP: { 1000: 0.2, 2000: 0.4, 3000: 0.6 },
    // [OURS] turn-based layer: Skyrim has no to-hit roll or damage spread
    HIT_CHANCE: 0.85, DAMAGE_SPREAD: [0.8, 1.2], SPELL_HIT_CHANCE: 0.9, STAGGER_CHANCE: 0.25,

    skillXpNeeded(skill, level) {
      if (OBLIVION_SKILLS.has(skill)) return 0.25883 * level ** 1.5;
      const [, , im, io] = SKYRIM_SKILL_XP[skill];
      return im * level ** 1.95 + io;
    },
    skillXpGained(skill, baseXp) {
      if (OBLIVION_SKILLS.has(skill)) return baseXp;
      const [um, uo] = SKYRIM_SKILL_XP[skill];
      return um * baseXp + uo;
    },
    charXpNeeded: (level) => (level + 3) * 25,        // [Skyrim]

    // [Skyrim] https://en.uesp.net/wiki/Skyrim:Weapons  damage = base × (1 + skill/200); bows add arrow damage
    weaponDamage: (base, skill, isBow) => (base + (isBow ? F.IRON_ARROW_DAMAGE : 0)) * (1 + skill / 200),
    // [Skyrim] https://en.uesp.net/wiki/Skyrim:Damage  stamina = 40 + 2 × weapon weight
    powerAttackCost: (weight) => 40 + 2 * weight,
    // [Skyrim] https://en.uesp.net/wiki/Skyrim:Sneak  one-handed ×3, everything else ×2 (no perks)
    sneakMultiplier: (skill) => (skill === "One-Handed" ? 3 : 2),
    // [Daggerfall] https://en.uesp.net/wiki/Daggerfall:Hand-to-Hand ; [Skyrim] Khajiit claws 12
    unarmedRange(skill, race) {
      let lo = Math.floor(skill / 10) + 1, hi = Math.floor(skill / 5) + 1 + (skill >= 80 ? 1 : 0);
      if (race === "khajiit") { lo = Math.max(lo, 12); hi = Math.max(hi, 12); }
      return [lo, hi];
    },
    // [Skyrim] https://en.uesp.net/wiki/Skyrim:Armor
    armorPieceRating: (base, skill) => Math.ceil(base * (1 + 0.4 * skill / 100)),
    damageReduction: (rating, pieces) => Math.min(80, rating * 0.12 + 3 * pieces) / 100,
    // [Morrowind] each empty slot gives skill² × 0.0065 armor
    unarmoredRating: (skill, empty) => skill ** 2 * 0.0065 * empty,
    // [Skyrim] https://en.uesp.net/wiki/Skyrim:Block
    blockPercent(block, shieldBase, enemyWeapon) {
      const m = 1 + block * 1.5 / 100;
      const pct = shieldBase != null ? 45 + 0.2 * shieldBase * m : 30 + 0.2 * (enemyWeapon || 0) * m;
      return Math.min(85, pct) / 100;
    },
    // [Skyrim] https://en.uesp.net/wiki/Skyrim:Magic_Overview
    spellCost: (base, skill) => Math.floor(base * (1 - (skill / 400) ** 0.65)),
    // [Skyrim] https://en.uesp.net/wiki/Skyrim:Enchanting_Effects
    enchantCost: (c, m, mmax, skill) => 3 * (c * m / mmax) ** 1.1 * (1 - Math.sqrt(Math.min(skill, 199) / 200)),
    // [Skyrim] https://pt.uesp.net/wiki/Skyrim:Investor
    priceFactor: (skill) => { const s = Math.min(100, skill); return (3.3 * (100 - s) + 2.0 * s) / 100; },
    buyPrice: (value, skill) => Math.max(Math.round(value * 1.05), Math.round(value * F.priceFactor(skill))),
    sellPrice: (value, skill) => Math.min(value, Math.round(value / F.priceFactor(skill))),
    // [Morrowind] running = walk × (1.75 + athletics/100), slowed by load (OpenMW notes,
    // https://forum.openmw.org/viewtopic.php?p=7860). [Skyrim] over the carry limit you can't run.
    travelSpeed(baseWalk, athletics, carried, capacity) {
      const load = Math.min(1, carried / Math.max(1, capacity));
      const run = carried > capacity ? 1 : 1.75 + athletics / 100;
      return baseWalk * run * (1 - 0.3 * load);
    },
  };
  return F;
})();
if (typeof module !== "undefined") module.exports = F;
