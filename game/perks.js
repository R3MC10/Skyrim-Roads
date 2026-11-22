/* Perk trees. One perk point per level ([Skyrim]). Each perk: [id, name, ranks, skill levels per rank, perks needed (any one), what it does].
   [Skyrim] perks copy Skyrim's effect (https://en.uesp.net/wiki/Skyrim:Perks). [OURS] perks are designed for skills Skyrim doesn't have,
   or replace a Skyrim perk whose mechanic doesn't exist here. Only perks that actually do something in this game are listed. */
const PERKS = (() => {
  const T = {
    "One-Handed": [
      ["armsman", "Armsman", 5, [0, 20, 40, 60, 80], [], "One-handed weapons do 20% more damage per rank. [Skyrim]"],
      ["fighting_stance", "Fighting Stance", 1, [20], ["armsman"], "Power attacks with one-handed weapons cost 25% less stamina. [Skyrim]"],
      ["bladesman", "Bladesman", 3, [30, 60, 90], ["armsman"], "Swords: 10/15/20% chance of a critical hit doing 25/50/75% extra critical damage. [Skyrim]"],
      ["bone_breaker", "Bone Breaker", 3, [30, 60, 90], ["armsman"], "Maces ignore 25/50/75% of armor. [Skyrim]"],
      ["hack_and_slash", "Hack and Slash", 3, [30, 60, 90], ["armsman"], "War axes make wounds bleed for 3/4/5 extra damage a turn for 3 turns. [Skyrim]"],
      ["savage_strike", "Savage Strike", 1, [50], ["fighting_stance"], "Power attacks do 25% more damage. [Skyrim: standing power attacks]"],
      ["paralyzing_strike", "Paralyzing Strike", 1, [100], ["savage_strike"], "Power attacks have a 25% chance to paralyze for 2 turns. [Skyrim: backwards power attack]"],
    ],
    "Two-Handed": [
      ["barbarian", "Barbarian", 5, [0, 20, 40, 60, 80], [], "Two-handed weapons do 20% more damage per rank. [Skyrim]"],
      ["champions_stance", "Champion's Stance", 1, [20], ["barbarian"], "Power attacks with two-handed weapons cost 25% less stamina. [Skyrim]"],
      ["deep_wounds", "Deep Wounds", 3, [30, 60, 90], ["barbarian"], "Greatswords: 10/15/20% chance of a critical hit doing 25/50/75% extra critical damage. [Skyrim]"],
      ["skullcrusher", "Skullcrusher", 3, [30, 60, 90], ["barbarian"], "Warhammers ignore 25/50/75% of armor. [Skyrim]"],
      ["limbsplitter", "Limbsplitter", 3, [30, 60, 90], ["barbarian"], "Battle axes make wounds bleed for 3/4/5 extra damage a turn for 3 turns. [Skyrim]"],
      ["devastating_blow", "Devastating Blow", 1, [50], ["champions_stance"], "Power attacks do 25% more damage. [Skyrim]"],
      ["warmaster", "Warmaster", 1, [100], ["devastating_blow"], "Power attacks have a 25% chance to paralyze for 2 turns. [Skyrim]"],
    ],
    "Archery": [
      ["overdraw", "Overdraw", 5, [0, 20, 40, 60, 80], [], "Bows do 20% more damage per rank. [Skyrim]"],
      ["critical_shot", "Critical Shot", 3, [30, 60, 90], ["overdraw"], "10/15/20% chance of a critical hit doing 25/50/75% extra damage. [Skyrim]"],
      ["power_shot", "Power Shot", 1, [50], ["critical_shot"], "Arrows stagger 50% of the time. [Skyrim]"],
      ["quick_shot", "Quick Shot", 1, [70], ["power_shot"], "30% chance to loose a second arrow in the same turn. [Skyrim: draw 30% faster]"],
      ["bullseye", "Bullseye", 1, [100], ["quick_shot"], "15% chance an arrow paralyzes for 2 turns. [Skyrim]"],
    ],
    "Blocking": [
      ["shield_wall", "Shield Wall", 5, [0, 20, 40, 60, 80], [], "Blocking is 5% more effective per rank. [Skyrim]"],
      ["quick_reflexes", "Quick Reflexes", 1, [30], ["shield_wall"], "A raised guard also blocks half of the next hit's spell or arrow damage. [OURS stand-in for Skyrim's slow-time]"],
      ["power_bash", "Power Bash", 1, [30], ["shield_wall"], "Raising your guard has a 30% chance to stagger the enemy. [OURS stand-in for bashing]"],
      ["deadly_bash", "Deadly Bash", 1, [50], ["power_bash"], "Bashes do 5 damage times your Blocking/20. [OURS]"],
      ["elemental_protection", "Elemental Protection", 1, [50], ["shield_wall"], "Blocking with a shield takes 50% less damage from dragons and mages. [Skyrim]"],
    ],
    "Heavy Armor": [
      ["juggernaut", "Juggernaut", 5, [0, 20, 40, 60, 80], [], "Heavy armor rating +20% per rank. [Skyrim]"],
      ["well_fitted", "Well Fitted", 1, [30], ["juggernaut"], "+25% armor if you wear heavy head, chest, hands and feet. [Skyrim]"],
      ["conditioning", "Conditioning", 1, [70], ["well_fitted"], "Worn heavy armor weighs nothing. [Skyrim]"],
      ["reflect_blows", "Reflect Blows", 1, [100], ["conditioning"], "10% chance to reflect a melee hit back at the attacker. [Skyrim]"],
    ],
    "Light Armor": [
      ["agile_defender", "Agile Defender", 5, [0, 20, 40, 60, 80], [], "Light armor rating +20% per rank. [Skyrim]"],
      ["custom_fit", "Custom Fit", 1, [30], ["agile_defender"], "+25% armor if you wear light head, chest, hands and feet. [Skyrim]"],
      ["unhindered", "Unhindered", 1, [50], ["custom_fit"], "Worn light armor weighs nothing. [Skyrim]"],
      ["wind_walker", "Wind Walker", 1, [60], ["unhindered"], "Stamina regenerates 50% faster in light armor. [Skyrim]"],
      ["deft_movement", "Deft Movement", 1, [100], ["wind_walker"], "10% chance to avoid all damage from a melee attack. [Skyrim]"],
    ],
    "Medium Armor": [
      ["chain_drills", "Chain Drills", 5, [0, 20, 40, 60, 80], [], "Medium armor rating +20% per rank. [OURS, like Juggernaut]"],
      ["layered", "Layered", 1, [40], ["chain_drills"], "+25% armor if you wear medium head, chest, hands and feet. [OURS]"],
      ["balanced_load", "Balanced Load", 1, [60], ["layered"], "Worn medium armor weighs half. [OURS]"],
    ],
    "Spear": [
      ["long_reach", "Long Reach", 3, [0, 30, 60], [], "Spears do 15% more damage per rank, and your first hit in a fight does +50%. [OURS]"],
      ["impale", "Impale", 1, [40], ["long_reach"], "15% chance of a critical hit doing +50% damage. [OURS]"],
      ["phalanx", "Phalanx", 1, [60], ["impale"], "Blocking with a spear and no shield counts as a shield. [OURS]"],
    ],
    "Hand-to-Hand": [
      ["iron_fists", "Iron Fists", 3, [0, 30, 60], [], "Unarmed hits do +4 damage per rank. [OURS; Skyrim's Fists of Steel adds gauntlet armor]"],
      ["knockout", "Knockout", 1, [40], ["iron_fists"], "Unarmed power attacks have a 40% chance to stagger. [OURS]"],
      ["flurry", "Flurry", 1, [70], ["knockout"], "Every unarmed hit in a row does 10% more damage, up to +50%. [OURS]"],
    ],
    "Unarmored": [
      ["monks_grace", "Monk's Grace", 3, [0, 30, 60], [], "Unarmored armor rating +25% per rank. [OURS]"],
      ["dodge", "Dodge", 1, [50], ["monks_grace"], "15% chance to avoid a hit when wearing no armor. [OURS]"],
    ],
    "Destruction": [
      ["novice_destruction", "Novice Destruction", 1, [0], [], "Novice destruction spells cost half. [Skyrim]"],
      ["apprentice_destruction", "Apprentice Destruction", 1, [25], ["novice_destruction"], "Apprentice destruction spells cost half. [Skyrim]"],
      ["adept_destruction", "Adept Destruction", 1, [50], ["apprentice_destruction"], "Adept destruction spells cost half. [Skyrim]"],
      ["expert_destruction", "Expert Destruction", 1, [75], ["adept_destruction"], "Expert destruction spells cost half. [Skyrim]"],
      ["augmented_flames", "Augmented Flames", 2, [30, 60], ["novice_destruction"], "Fire spells do 25/50% more damage. [Skyrim]"],
      ["augmented_frost", "Augmented Frost", 2, [30, 60], ["novice_destruction"], "Frost spells do 25/50% more damage. [Skyrim]"],
      ["augmented_shock", "Augmented Shock", 2, [30, 60], ["novice_destruction"], "Shock spells do 25/50% more damage. [Skyrim]"],
      ["impact", "Impact", 1, [40], ["novice_destruction"], "Destruction spells stagger 30% of the time. [OURS stand-in for dual-cast stagger]"],
    ],
    "Restoration": [
      ["novice_restoration", "Novice Restoration", 1, [0], [], "Novice restoration spells cost half. [Skyrim]"],
      ["apprentice_restoration", "Apprentice Restoration", 1, [25], ["novice_restoration"], "Apprentice restoration spells cost half. [Skyrim]"],
      ["adept_restoration", "Adept Restoration", 1, [50], ["apprentice_restoration"], "Adept restoration spells cost half. [Skyrim]"],
      ["regeneration", "Regeneration", 1, [20], ["novice_restoration"], "Healing spells heal 50% more. [Skyrim]"],
      ["recovery", "Recovery", 2, [30, 60], ["novice_restoration"], "Magicka regenerates 25/50% faster. [Skyrim]"],
      ["respite", "Respite", 1, [40], ["regeneration"], "Healing spells also restore stamina. [Skyrim]"],
      ["necromage", "Necromage", 1, [70], ["regeneration"], "Sun Fire and other spells against undead are 25% stronger. [OURS, Skyrim's Necromage works the other way round]"],
    ],
    "Alteration": [
      ["novice_alteration", "Novice Alteration", 1, [0], [], "Novice alteration spells cost half. [Skyrim]"],
      ["apprentice_alteration", "Apprentice Alteration", 1, [25], ["novice_alteration"], "Apprentice alteration spells cost half. [Skyrim]"],
      ["adept_alteration", "Adept Alteration", 1, [50], ["apprentice_alteration"], "Adept alteration spells cost half. [Skyrim]"],
      ["mage_armor", "Mage Armor", 3, [30, 50, 70], ["apprentice_alteration"], "Armor spells are 2/2.5/3 times stronger if you wear no armor. [Skyrim]"],
      ["magic_resistance", "Magic Resistance", 3, [30, 50, 70], ["novice_alteration"], "Spell damage against you is 10/20/30% lower. [Skyrim]"],
    ],
    "Conjuration": [
      ["novice_conjuration", "Novice Conjuration", 1, [0], [], "Novice conjuration spells cost half. [Skyrim]"],
      ["apprentice_conjuration", "Apprentice Conjuration", 1, [25], ["novice_conjuration"], "Apprentice conjuration spells cost half. [Skyrim]"],
      ["summoner", "Summoner", 2, [30, 70], ["novice_conjuration"], "Summons last 2 turns longer per rank. [OURS stand-in for range]"],
      ["elemental_potency", "Elemental Potency", 1, [80], ["summoner"], "Summons hit 50% harder. [Skyrim: conjured atronachs 50% stronger]"],
      ["twin_souls", "Twin Souls", 1, [100], ["elemental_potency"], "You can have two summons: summon damage is doubled. [Skyrim]"],
    ],
    "Illusion": [
      ["novice_illusion", "Novice Illusion", 1, [0], [], "Novice illusion spells cost half. [Skyrim]"],
      ["apprentice_illusion", "Apprentice Illusion", 1, [25], ["novice_illusion"], "Apprentice illusion spells cost half. [Skyrim]"],
      ["animage", "Animage", 1, [20], ["novice_illusion"], "Calm works on beasts up to 8 levels higher. [Skyrim]"],
      ["kindred_mage", "Kindred Mage", 1, [40], ["animage"], "Calm works on people up to 8 levels higher. [Skyrim]"],
      ["quiet_casting", "Quiet Casting", 1, [50], ["novice_illusion"], "Casting doesn't break sneak: a hidden start still sneak-attacks with your first spell (×2). [OURS]"],
      ["master_of_the_mind", "Master of the Mind", 1, [90], ["kindred_mage"], "Calm works on undead and constructs. [Skyrim]"],
    ],
    "Mysticism": [
      ["spell_absorption", "Spell Absorption", 2, [20, 60], [], "10/20% chance an enemy hit restores 15 magicka instead of hurting. [OURS, from Morrowind's Spell Absorption]"],
      ["detect_life", "Detect Life", 1, [30], ["spell_absorption"], "+15% chance to stay hidden. [OURS, from Detect Life]"],
      ["soul_trap", "Soul Trap", 1, [50], ["detect_life"], "Killing a foe recharges your enchanted weapon by 10%. [OURS, from Soul Trap]"],
    ],
    "Sneak": [
      ["stealth", "Stealth", 5, [0, 20, 40, 60, 80], [], "You're 20% harder to detect per rank. [Skyrim]"],
      ["backstab", "Backstab", 1, [30], ["stealth"], "Sneak attacks with one-handed weapons do ×6 damage. [Skyrim]"],
      ["deadly_aim", "Deadly Aim", 1, [40], ["backstab"], "Sneak attacks with bows do ×3 damage. [Skyrim]"],
      ["assassins_blade", "Assassin's Blade", 1, [50], ["deadly_aim"], "Sneak attacks with daggers do ×15 damage. [Skyrim]"],
      ["light_foot", "Light Foot", 1, [40], ["stealth"], "You never set off traps when looking for the trigger. [Skyrim: you don't trigger pressure plates]"],
      ["shadow_warrior", "Shadow Warrior", 1, [100], ["light_foot"], "Once a fight, a hit that would kill you lets you vanish and strike again with a sneak attack. [OURS stand-in]"],
    ],
    "Lockpicking": [
      ["novice_locks", "Novice Locks", 1, [0], [], "Novice locks are much easier to pick. [Skyrim]"],
      ["apprentice_locks", "Apprentice Locks", 1, [25], ["novice_locks"], "Apprentice locks are much easier to pick. [Skyrim]"],
      ["adept_locks", "Adept Locks", 1, [50], ["apprentice_locks"], "Adept locks are much easier to pick. [Skyrim]"],
      ["expert_locks", "Expert Locks", 1, [75], ["adept_locks"], "Expert locks are much easier to pick. [Skyrim]"],
      ["master_locks", "Master Locks", 1, [100], ["expert_locks"], "Master locks are much easier to pick. [Skyrim]"],
      ["golden_touch", "Golden Touch", 1, [60], ["apprentice_locks"], "Find more gold in chests. [Skyrim]"],
      ["treasure_hunter", "Treasure Hunter", 1, [70], ["golden_touch"], "50% better chance of finding special treasure. [Skyrim]"],
      ["unbreakable", "Unbreakable", 1, [100], ["master_locks"], "Lockpicks never break. [Skyrim]"],
    ],
    "Pickpocket": [
      ["light_fingers", "Light Fingers", 5, [0, 20, 40, 60, 80], [], "Pickpocketing is 20% easier per rank. [Skyrim]"],
      ["night_thief", "Night Thief", 1, [30], ["light_fingers"], "+25% chance to pickpocket someone asleep. [Skyrim]"],
      ["cutpurse", "Cutpurse", 1, [40], ["night_thief"], "Stealing gold is 50% easier. [Skyrim]"],
      ["extra_pockets", "Extra Pockets", 1, [50], ["night_thief"], "Carry weight +100. [Skyrim]"],
      ["misdirection", "Misdirection", 1, [70], ["cutpurse"], "A failed pickpocket isn't reported to the guards. [OURS stand-in]"],
    ],
    "Mercantile": [
      ["haggling", "Haggling", 5, [0, 20, 40, 60, 80], [], "Buying and selling prices are 10/15/20/25/30% better. [Skyrim]"],
      ["fence", "Fence", 1, [30], ["haggling"], "Merchants buy stolen goods. [Skyrim]"],
      ["master_trader", "Master Trader", 1, [80], ["fence"], "Merchants have 1000 more gold... here: +10% on every sale. [OURS stand-in]"],
    ],
    "Speechcraft": [
      ["persuasion", "Persuasion", 1, [50], [], "Persuasion attempts are 30% easier. [Skyrim]"],
      ["intimidation", "Intimidation", 1, [70], ["persuasion"], "Intimidation is twice as successful. [Skyrim] (toll guards, bounty hunters)"],
      ["bribery", "Bribery", 1, [30], [], "You can bribe guards to ignore your crimes. [Skyrim]"],
    ],
    "Etiquette": [
      ["courtly_manners", "Courtly Manners", 1, [20], [], "Inns and trainers charge you 20% less. [OURS, from Morrowind's Personality]"],
      ["noble_friends", "Noble Friends", 1, [50], ["courtly_manners"], "Fines are halved. [OURS]"],
      ["diplomat", "Diplomat", 1, [75], ["noble_friends"], "Toll guards wave you through. Jobs pay 25% more. [OURS]"],
    ],
    "Streetwise": [
      ["rumour_monger", "Rumour Monger", 1, [20], [], "Rumours at the inn cost nothing and reveal two places. [OURS]"],
      ["underworld_contacts", "Underworld Contacts", 1, [40], ["rumour_monger"], "Any general store will fence stolen goods. [OURS]"],
      ["bribe_master", "Bribe Master", 1, [60], ["underworld_contacts"], "Guards take bribes, and bribes cost half. [OURS]"],
    ],
    "Athletics": [
      ["long_strider", "Long Strider", 3, [20, 50, 80], [], "Travel 5% faster per rank. [OURS]"],
      ["second_wind", "Second Wind", 1, [40], ["long_strider"], "Stamina regenerates 25% faster in fights. [OURS]"],
      ["marathon", "Marathon", 1, [70], ["second_wind"], "Being overweight only slows you half as much. [OURS]"],
    ],
    "Acrobatics": [
      ["sure_footed", "Sure-Footed", 2, [20, 50], [], "+15% per rank to dash past traps and climb shortcuts. [OURS]"],
      ["evasion", "Evasion", 1, [60], ["sure_footed"], "10% chance to dodge any hit. [OURS]"],
    ],
    "Smithing": [
      ["steel_smithing", "Steel Smithing", 1, [20], [], "Improve steel and Ancient Nord gear twice as much. [Skyrim]"],
      ["arcane_blacksmith", "Arcane Blacksmith", 1, [60], ["steel_smithing"], "You can improve enchanted weapons and armor. [Skyrim]"],
      ["elven_smithing", "Elven Smithing", 1, [30], ["steel_smithing"], "Improve Elven gear twice as much. [Skyrim]"],
      ["dwarven_smithing", "Dwarven Smithing", 1, [30], ["steel_smithing"], "Improve Dwarven gear twice as much. [Skyrim]"],
      ["advanced_armors", "Advanced Armors", 1, [50], ["steel_smithing"], "Improve chainmail and steel plate twice as much. [Skyrim]"],
    ],
    "Enchanting": [
      ["enchanter", "Enchanter", 5, [0, 20, 40, 60, 80], [], "Your weapons use 10% less charge per rank. [OURS; Skyrim's makes new enchantments stronger]"],
      ["soul_squeezer", "Soul Squeezer", 1, [20], ["enchanter"], "Soul gems recharge 50% more. [Skyrim: soul gems provide extra magicka]"],
      ["soul_siphon", "Soul Siphon", 1, [40], ["soul_squeezer"], "Every kill recharges your weapon by 5%. [Skyrim]"],
    ],
    "Alchemy": [
      ["alchemist", "Alchemist", 5, [0, 20, 40, 60, 80], [], "Potions and poisons are 20% stronger per rank. [Skyrim]"],
      ["physician", "Physician", 1, [20], ["alchemist"], "Restore Health, Magicka and Stamina potions are 25% stronger. [Skyrim]"],
      ["benefactor", "Benefactor", 1, [30], ["physician"], "Beneficial potions are 25% stronger. [Skyrim]"],
      ["experimenter", "Experimenter", 3, [50, 70, 90], ["benefactor"], "Eating an ingredient reveals the first two, three, then all effects. [Skyrim]"],
      ["poisoner", "Poisoner", 1, [30], ["physician"], "Poisons are 25% stronger. [Skyrim]"],
      ["concentrated_poison", "Concentrated Poison", 1, [60], ["poisoner"], "Poisons on your weapon last for two hits. [Skyrim]"],
      ["green_thumb", "Green Thumb", 1, [70], ["concentrated_poison"], "You gather twice as many ingredients. [Skyrim]"],
      ["purity", "Purity", 1, [100], ["experimenter"], "Potions drop their bad effects, poisons their good ones. [Skyrim]"],
    ],
  };
  const BY_ID = {};
  for (const [skill, list] of Object.entries(T)) for (const [id, name, ranks, req, needs, desc] of list) BY_ID[id] = { id, name, ranks, req, needs, desc, skill };
  const rank = (s, id) => (s.perks && s.perks[id]) || 0;
  const pointsEarned = (s) => s.level - 1;                                                   // [Skyrim] one perk point per level
  const pointsLeft = (s) => pointsEarned(s) - Object.values(s.perks || {}).reduce((a, b) => a + b, 0);
  function canTake(s, id) {
    const p = BY_ID[id], r = rank(s, id);
    if (!p || r >= p.ranks) return "Already maxed.";
    if (pointsLeft(s) <= 0) return "No perk points left. You get one each level.";
    if (s.skills[p.skill].lvl < p.req[r]) return `Needs ${p.skill} ${p.req[r]}.`;
    if (p.needs.length && !p.needs.some((n) => rank(s, n) > 0)) return `Needs ${p.needs.map((n) => BY_ID[n].name).join(" or ")} first.`;
    return null;
  }
  function take(s, id) {
    const err = canTake(s, id);
    if (err) return err;
    s.perks = s.perks || {};
    s.perks[id] = rank(s, id) + 1;
    return `${BY_ID[id].name}${BY_ID[id].ranks > 1 ? ` (rank ${s.perks[id]})` : ""} learned.`;
  }
  /* a ranked perk's text at one rank: "10/15/20%" ladders become the value for that rank, "X per rank" becomes X × rank.
     Used so menus show only what you have now (and the next rank), never the whole ladder. */
  const LADDER = /(\d+(?:\.\d+)?)((?:\/\d+(?:\.\d+)?)+)/g;
  const clean = (d) => String(d || "").replace(/\s*\[[^\]]*\]\s*$/, "");
  function rankText(id, r) {
    const p = BY_ID[id]; if (!p) return "";
    const k = Math.max(1, Math.min(r, p.ranks));
    return clean(p.desc).replace(LADDER, (m) => { const v = m.split("/"); return v[Math.min(k, v.length) - 1]; })
      .replace(/(\d+(?:\.\d+)?)(%?)( [^.;,]*?) per rank/g, (m, n, pc, mid) => `${+(n * k).toFixed(2)}${pc}${mid}`);
  }
  /* just the numbers that change at rank r ("15% · 50%"), for a compact "Next:" */
  function rankNums(id, r) {
    const p = BY_ID[id]; if (!p || r > p.ranks) return "";
    const d = clean(p.desc), out = [];
    d.replace(LADDER, (m) => { const v = m.split("/"); const unit = d.slice(d.indexOf(m) + m.length).match(/^\s*(%|times)?/)[1] || ""; out.push(v[Math.min(r, v.length) - 1] + (unit === "%" ? "%" : unit ? " " + unit : "")); return m; });
    d.replace(/(\d+(?:\.\d+)?)(%?) [^.;,]*? per rank/g, (m, n, pc) => { out.push(`${+(n * r).toFixed(2)}${pc}`); return m; });
    return out.join(" · ");
  }
  /* what to show for a perk: what rank 1 gives if you don't have it, else what you have now plus the next rank's numbers */
  function nowText(s, id) {
    const p = BY_ID[id], r = rank(s, id); if (!p) return "";
    if (!r) return rankText(id, 1);
    const nx = r < p.ranks ? rankNums(id, r + 1) : "";
    return rankText(id, r) + (nx ? ` Next: ${nx}.` : "");
  }
  return { nowText, rankText, rankNums, TREES: T, BY_ID, rank, pointsLeft, canTake, take };
})();
