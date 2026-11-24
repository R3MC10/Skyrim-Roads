/* Bigger perk trees and elemental statuses. [OURS module; perks marked [Skyrim] follow Skyrim's perk of that name]
   1. ADD: new perks for every tree (appended to PERKS.TREES, old ids untouched so saves keep working).
      Each new perk has an FX list that says what it does; the fight engine, the Smart AI and the town code read
      those through PFX.out / PFX.in / PFX.num etc. Nothing here is flavour only: every FX key is read somewhere.
   2. Elemental statuses (Remigiusz: "flames should do some burning damage"): fire sets things burning, frost chills
      (stamina drain, slower, sometimes frozen solid), shock jolts (drains magicka, interrupts casters).
      Both you and your foe can carry them; the fight log and the fight scene show them. */
const PFX = (() => {
  const P = (s, id) => (typeof PERKS !== "undefined" ? PERKS.rank(s, id) : 0);
  const S1 = "One-Handed", S2 = "Two-Handed", AR = "Archery";
  // [skill, id, name, ranks, req levels, needs, description, fx]
  // fx: [key, value (number × rank, or array by rank), condition]
  const ADD = [
    // ---------------------------------------------------------------- One-Handed (7 → 11)
    [S1, "critical_charge", "Critical Charge", 1, [50], ["fighting_stance"], "Your first one-handed strike in a fight does 50% more damage, and you leap at a flying dragon: your blows lose only 20% instead of 40%. [Skyrim: sprinting power attack]", [["out", 0.5, { sk: S1, first: 1 }], ["leap", 1, {}]]],
    [S1, "dual_flurry", "Dual Flurry", 2, [30, 50], ["armsman"], "With no shield, one-handed attacks have a 10/20% chance of a quick second strike for half damage. [Skyrim: dual wielding is faster]", [["extra", [0.1, 0.2], { sk: S1, noShield: 1, normal: 1 }]]],
    [S1, "twin_blades", "Twin Blades", 1, [45], ["dual_flurry"], "With a weapon in each hand, your left-hand follow-ups do 30% more and dual power attacks cost 25% less stamina. [OURS]", [["offhand", 0.3, {}], ["dualpa", 0.25, {}]]],
    [S1, "dual_savagery", "Dual Savagery", 1, [70], ["dual_flurry"], "With no shield, one-handed power attacks do 25% more damage. [Skyrim: dual-wield power attacks]", [["out", 0.25, { sk: S1, noShield: 1, power: 1 }]]],
    [S1, "duelist", "Duelist", 1, [80], ["bladesman", "bone_breaker", "hack_and_slash"], "One-handed hits do 15% more damage to people, and you parry: 10% less damage from their blows. [OURS] Your timing ring's bright zone is 30% wider.", [["out", 0.15, { sk: S1, tag: ["humanoid"] }], ["in", -0.1, { sk: S1, tag: ["humanoid"] }], ["timing", 0.3, {}]]],
    // ---------------------------------------------------------------- Two-Handed (7 → 11)
    [S2, "great_critical_charge", "Great Critical Charge", 1, [50], ["champions_stance"], "Your first two-handed strike in a fight does 50% more damage, and you leap at a flying dragon: your blows lose only 20% instead of 40%. [Skyrim]", [["out", 0.5, { sk: S2, first: 1 }], ["leap", 1, {}]]],
    [S2, "sweep", "Sweep", 1, [70], ["great_critical_charge"], "Two-handed power attacks swing wide: +15% damage and a 20% chance to stagger. [Skyrim: sideways power attacks hit everyone in front]", [["out", 0.15, { sk: S2, power: 1 }], ["stag", 0.2, { sk: S2, power: 1 }]]],
    [S2, "brute_force", "Brute Force", 1, [40], ["barbarian"], "Two-handed hits ignore 25% of armor and do 10% more to tough foes, bosses and dragons. [OURS] Your timing ring's bright zone is 30% wider.", [["pierce", 0.25, { sk: S2 }], ["out", 0.1, { sk: S2, tough: 1 }], ["timing", 0.3, {}]]],
    [S2, "headsman", "Headsman", 2, [40, 70], ["brute_force"], "Two-handed blows do 15% more damage to a foe below a quarter of its health (30% at rank 2): finish them, and maybe take their head. [OURS]", [["out", [0.15, 0.3], { sk: S2, foeBelow: 0.25 }]]],
    [S2, "unstoppable", "Unstoppable", 1, [90], ["devastating_blow"], "With a two-hander, you take 15% less damage while above half health. [OURS]", [["in", -0.15, { sk: S2, hpAbove: 50 }]]],
    // ---------------------------------------------------------------- Archery (5 → 10)
    [AR, "eagle_eye", "Eagle Eye", 1, [30], ["overdraw"], "Arrows hit 8% more often, and a flying dragon can't weave away from your arrows (full damage). [Skyrim: zoom in]", [["hit", 0.08, { sk: AR }], ["skyshot", 1, {}]]],
    [AR, "steady_hand", "Steady Hand", 2, [40, 60], ["eagle_eye"], "Bows do 5/10% more damage, and fog, storms and blizzards spoil your aim only half as much. [Skyrim: zoom slows time] Your timing ring's bright zone is 30% wider.", [["out", [0.05, 0.1], { sk: AR }], ["aimwx", 0.5, { sk: AR }], ["timing", 0.3, {}]]],
    [AR, "hunters_discipline", "Hunter's Discipline", 1, [50], ["critical_shot"], "You find twice as many of your arrows and bolts after a fight. [Skyrim]", [["ammo", 1, {}]]],
    [AR, "ranger", "Ranger", 1, [60], ["hunters_discipline"], "Shooting power shots costs half the stamina, and bows do 15% more from the saddle. [Skyrim: move faster with a bow drawn]", [["pa", -0.5, { sk: AR }], ["out", 0.15, { sk: AR, mounted: 1 }]]],
    [AR, "marksman", "Marksman", 1, [80], ["steady_hand", "ranger"], "Your first arrow of a fight is a sure hit that does 50% more. [OURS]", [["out", 0.5, { sk: AR, first: 1 }], ["sure", 1, { sk: AR, first: 1 }]]],
    // ---------------------------------------------------------------- Blocking (5 → 10)
    [ "Blocking", "deflect_arrows", "Deflect Arrows", 1, [30], ["shield_wall"], "A raised shield stops archers' arrows completely. [Skyrim]", [["in", -1, { blocking: 1, shield: 1, archerFoe: 1 }]]],
    [ "Blocking", "block_runner", "Block Runner", 1, [70], ["elemental_protection"], "Raising your guard costs no stamina. [Skyrim: move fast with your shield up]", [["blockcost", 1, {}]]],
    [ "Blocking", "disarming_bash", "Disarming Bash", 1, [70], ["deadly_bash"], "Shield bashes knock the foe's weapon aside: they hit 40% softer for 3 turns. [Skyrim: bashes can disarm]", [["disarm", 3, {}]]],
    [ "Blocking", "shield_charge", "Shield Charge", 1, [100], ["block_runner", "disarming_bash"], "The first time you raise your guard in a fight, you always bash and stagger. [Skyrim]", [["firstbash", 1, {}]]],
    [ "Blocking", "guardian", "Guardian", 2, [40, 80], ["shield_wall"], "Blocking takes off another 5/10% of every blow. [OURS]", [["block", [0.05, 0.1], {}]]],
    // ---------------------------------------------------------------- Heavy Armor (4 → 9)
    [ "Heavy Armor", "fists_of_steel", "Fists of Steel", 1, [30], ["juggernaut"], "Unarmed hits add a third of your heavy gauntlets' armor as damage. [Skyrim]", [["fists", 1, {}]]],
    [ "Heavy Armor", "cushioned", "Cushioned", 1, [50], ["well_fitted"], "Traps hurt half as much in heavy armor, and giants and dragons hit 10% softer. [Skyrim: half damage from falling]", [["trapdmg", 0.5, { heavy: 1 }], ["in", -0.1, { heavy: 1, big: 1 }]]],
    [ "Heavy Armor", "unbowed", "Unbowed", 1, [40], ["juggernaut"], "In heavy armor, mages and dragons hurt you 10% less. [OURS]", [["in", -0.1, { heavy: 1, magic: 1 }]]],
    [ "Heavy Armor", "tower_of_strength", "Tower of Strength", 1, [60], ["well_fitted"], "In heavy armor, blocking takes off another 10%. [Skyrim: 50% less stagger]", [["block", 0.1, { heavy: 1 }]]],
    [ "Heavy Armor", "fortress", "Fortress", 1, [80], ["conditioning"], "Below half health, heavy armor takes another 15% off every hit. [OURS]", [["in", -0.15, { heavy: 1, hpBelow: 50 }]]],
    // ---------------------------------------------------------------- Light Armor (5 → 9)
    [ "Light Armor", "light_step", "Light Step", 1, [20], ["agile_defender"], "In light armor you're 5% harder to spot. [OURS]", [["hide", 5, { light: 1 }]]],
    [ "Light Armor", "fleet_foot", "Fleet Foot", 1, [40], ["custom_fit"], "You travel 5% faster in light armor. [OURS]", [["travel", 0.05, { light: 1 }]]],
    [ "Light Armor", "riposte", "Riposte", 1, [70], ["wind_walker"], "After you dodge a blow, your next attack does 50% more. [OURS]", [["riposte", 0.5, {}]]],
    [ "Light Armor", "ward_weave", "Ward Weave", 1, [80], ["custom_fit"], "In light armor, mages and dragons hurt you 10% less. [OURS]", [["in", -0.1, { light: 1, magic: 1 }]]],
    // ---------------------------------------------------------------- Medium Armor (3 → 9)
    [ "Medium Armor", "steady_stance", "Steady Stance", 1, [20], ["chain_drills"], "In medium armor, blocking takes off another 10%. [OURS]", [["block", 0.1, { medium: 1 }]]],
    [ "Medium Armor", "quick_buckles", "Quick Buckles", 1, [30], ["chain_drills"], "Stamina comes back 25% faster in medium armor. [OURS]", [["regensp", 0.25, { medium: 1 }]]],
    [ "Medium Armor", "riveted", "Riveted", 1, [50], ["layered"], "Big hits (over a fifth of your health) are cut by 20% in medium armor. [OURS]", [["in", -0.2, { medium: 1, bigHit: 0.2 }]]],
    [ "Medium Armor", "glancing_blows", "Glancing Blows", 1, [70], ["balanced_load"], "8% chance a blow glances off your medium armor and does nothing. [OURS]", [["dodge", 0.08, { medium: 1 }]]],
    [ "Medium Armor", "rangers_mail", "Ranger's Mail", 1, [40], ["chain_drills"], "You travel 3% faster and are 3% harder to spot in medium armor. [OURS]", [["travel", 0.03, { medium: 1 }], ["hide", 3, { medium: 1 }]]],
    [ "Medium Armor", "battle_hardened", "Battle Hardened", 1, [90], ["riveted"], "Below 30% health, medium armor takes another 20% off every hit. [OURS]", [["in", -0.2, { medium: 1, hpBelow: 30 }]]],
    // ---------------------------------------------------------------- Spear (3 → 9)
    [ "Spear", "keep_away", "Keep Away", 1, [30], ["long_reach"], "Spear hits stagger 15% of the time. [OURS]", [["stag", 0.15, { wt: ["spear"] }]]],
    [ "Spear", "spear_wall", "Spear Wall", 1, [40], ["long_reach"], "Raising your guard with a spear jabs the foe for 4 + Spear/20 damage. [OURS]", [["guardjab", 1, {}]]],
    [ "Spear", "skewer", "Skewer", 1, [50], ["impale"], "Spear power attacks make wounds bleed for 4 a turn for 3 turns. [OURS]", [["bleed", 4, { wt: ["spear"], power: 1 }]]],
    [ "Spear", "lance", "Lance", 1, [60], ["keep_away"], "Spears do 20% more from the saddle. [OURS]", [["out", 0.2, { wt: ["spear"], mounted: 1 }]]],
    [ "Spear", "pinning_strike", "Pinning Strike", 1, [80], ["skewer", "lance"], "Spear power attacks pin the foe in place 20% of the time (paralyzed 2 turns). [OURS]", [["para", 0.2, { wt: ["spear"], power: 1 }]]],
    [ "Spear", "dragon_spear", "Dragon Spear", 1, [100], ["pinning_strike"], "Spears do 25% more to dragons and giants. [OURS]", [["out", 0.25, { wt: ["spear"], big: 1 }]]],
    // ---------------------------------------------------------------- Hand-to-Hand (3 → 9)
    [ "Hand-to-Hand", "brawler", "Brawler", 1, [20], ["iron_fists"], "Unarmed power attacks cost 40% less stamina. [OURS]", [["pa", -0.4, { wt: ["fist"] }]]],
    [ "Hand-to-Hand", "iron_body", "Iron Body", 1, [40], ["iron_fists"], "Fighting bare-handed, you take 10% less damage. [OURS]", [["in", -0.1, { wt: ["fist"] }]]],
    [ "Hand-to-Hand", "uppercut", "Uppercut", 1, [60], ["knockout"], "Unarmed power attacks do 30% more damage. [OURS]", [["out", 0.3, { wt: ["fist"], power: 1 }]]],
    [ "Hand-to-Hand", "pressure_points", "Pressure Points", 1, [50], ["knockout"], "Unarmed hits paralyze for 2 turns 8% of the time. [OURS]", [["para", 0.08, { wt: ["fist"] }]]],
    [ "Hand-to-Hand", "counterpunch", "Counterpunch", 1, [80], ["flurry"], "When a foe misses you bare-handed, you punch back 30% of the time. [OURS]", [["counter", 0.3, { wt: ["fist"] }]]],
    [ "Hand-to-Hand", "dragon_fist", "Dragon Fist", 1, [100], ["uppercut", "pressure_points"], "Unarmed sneak attacks do ×4 damage (instead of ×2). [OURS]", [["sneakx", 4, { wt: ["fist"] }]]],
    // ---------------------------------------------------------------- Unarmored (2 → 9)
    [ "Unarmored", "iron_skin", "Iron Skin", 2, [20, 40], ["monks_grace"], "With no armor on, +15/30 armor rating. [OURS]", [["armor", [15, 30], { bare: 1 }]]],
    [ "Unarmored", "light_body", "Light Body", 1, [20], [], "With no armor on, you travel 5% faster. [OURS]", [["travel", 0.05, { bare: 1 }]]],
    [ "Unarmored", "deflection", "Deflection", 1, [40], ["iron_skin"], "With no armor on, mages and dragons hurt you 15% less. [OURS]", [["in", -0.15, { bare: 1, magic: 1 }]]],
    [ "Unarmored", "flowing_water", "Flowing Water", 1, [60], ["dodge"], "With no armor on, stamina comes back 30% faster. [OURS]", [["regensp", 0.3, { bare: 1 }]]],
    [ "Unarmored", "empty_mind", "Empty Mind", 1, [60], ["light_body"], "With no armor on, magicka comes back 30% faster. [OURS]", [["regenmp", 0.3, { bare: 1 }]]],
    [ "Unarmored", "shadow_robe", "Shadow Robe", 1, [50], ["light_body"], "With no armor on, you're 5% harder to spot. [OURS]", [["hide", 5, { bare: 1 }]]],
    [ "Unarmored", "perfect_form", "Perfect Form", 1, [90], ["flowing_water", "deflection"], "With no armor on, another 10% chance to avoid a hit. [OURS]", [["dodge", 0.1, { bare: 1 }]]],
    // ---------------------------------------------------------------- Destruction (8 → 14)
    [ "Destruction", "master_destruction", "Master Destruction", 1, [100], ["expert_destruction"], "Master destruction spells cost half. [Skyrim]", [["tier", 1, {}]]],
    [ "Destruction", "intense_flames", "Intense Flames", 1, [50], ["augmented_flames"], "Fire spells set foes burning one turn longer, and burns hurt 50% more. [Skyrim: fire makes foes flee]", [["burn", 0.5, {}]]],
    [ "Destruction", "deep_freeze", "Deep Freeze", 1, [60], ["augmented_frost"], "Frost spells freeze the foe solid 20% of the time (paralyzed 1 turn). [Skyrim]", [["freeze", 0.2, {}]]],
    [ "Destruction", "disintegrate", "Disintegrate", 1, [70], ["augmented_shock"], "Shock spells destroy a foe below 15% health. [Skyrim] Your timing ring's bright zone is 30% wider.", [["exec", 0.15, { el: "shock" }], ["timing", 0.3, {}]]],
    [ "Destruction", "rune_master", "Rune Master", 1, [40], ["apprentice_destruction"], "Runes do 50% more damage. [Skyrim: runes placed further away]", [["spell", 0.5, { kind: "rune" }]]],
    [ "Destruction", "destruction_dual_casting", "Destruction Dual Casting", 1, [20], ["novice_destruction"], "Dual-cast destruction spells cost 15% less. [Skyrim: dual casting overcharges]", [["dualcost", 0.15, { school: "Destruction" }]]],
    // ---------------------------------------------------------------- Restoration (7 → 12)
    [ "Restoration", "expert_restoration", "Expert Restoration", 1, [75], ["adept_restoration"], "Expert restoration spells cost half. [Skyrim]", [["tier", 1, {}]]],
    [ "Restoration", "master_restoration", "Master Restoration", 1, [100], ["expert_restoration"], "Master restoration spells cost half. [Skyrim]", [["tier", 1, {}]]],
    [ "Restoration", "ward_absorb", "Ward Absorb", 1, [60], ["respite"], "While a ward is up, blows that hit it give you 10 magicka. [Skyrim]", [["wardmp", 10, {}]]],
    [ "Restoration", "ward_mender", "Ward Mender", 1, [45], ["respite"], "Your wards are 25% stronger, and a ward that's still up mends 10% of itself at the start of each turn. [OURS]", [["wardpow", 0.25, {}], ["wardregen", 0.1, {}]]],
    [ "Restoration", "avoid_death", "Avoid Death", 1, [90], ["recovery"], "Once a fight, when you'd drop below 10% health you heal 100 instead. [Skyrim: heals 250]", [["avoiddeath", 100, {}]]],
    [ "Restoration", "restoration_dual_casting", "Restoration Dual Casting", 1, [20], ["novice_restoration"], "Dual-cast healing costs 15% less. [Skyrim]", [["dualcost", 0.15, { school: "Restoration" }]]],
    // ---------------------------------------------------------------- Alteration (5 → 11)
    [ "Alteration", "expert_alteration", "Expert Alteration", 1, [75], ["adept_alteration"], "Expert alteration spells cost half. [Skyrim]", [["tier", 1, {}]]],
    [ "Alteration", "master_alteration", "Master Alteration", 1, [100], ["expert_alteration"], "Master alteration spells cost half. [Skyrim]", [["tier", 1, {}]]],
    [ "Alteration", "stability", "Stability", 1, [70], ["adept_alteration"], "Alteration spells last longer: armor spells are 25% stronger. [Skyrim]", [["armorspell", 0.25, {}]]],
    [ "Alteration", "atronach", "Atronach", 1, [100], ["magic_resistance"], "15% of spell damage against you is absorbed as magicka. [Skyrim: absorb 30% of spells]", [["absorb", 0.15, { magic: 1 }]]],
    [ "Alteration", "alteration_dual_casting", "Alteration Dual Casting", 1, [20], ["novice_alteration"], "Dual-cast alteration spells cost 15% less. [Skyrim]", [["dualcost", 0.15, { school: "Alteration" }]]],
    [ "Alteration", "elemental_skin", "Elemental Skin", 1, [60], ["magic_resistance"], "Burning, chills and shocks on you last one turn less. [OURS]", [["statusshort", 1, {}]]],
    // ---------------------------------------------------------------- Conjuration (5 → 12)
    [ "Conjuration", "adept_conjuration", "Adept Conjuration", 1, [50], ["apprentice_conjuration"], "Adept conjuration spells cost half. [Skyrim]", [["tier", 1, {}]]],
    [ "Conjuration", "expert_conjuration", "Expert Conjuration", 1, [75], ["adept_conjuration"], "Expert conjuration spells cost half. [Skyrim]", [["tier", 1, {}]]],
    [ "Conjuration", "master_conjuration", "Master Conjuration", 1, [100], ["expert_conjuration"], "Master conjuration spells cost half. [Skyrim]", [["tier", 1, {}]]],
    [ "Conjuration", "atromancy", "Atromancy", 1, [40], ["summoner"], "Conjuration spells cost 25% less. [Skyrim: atronach spells cost half]", [["scost", 0.25, { school: "Conjuration" }]]],
    [ "Conjuration", "necromancy", "Necromancy", 1, [40], ["novice_conjuration"], "Raised dead and bound weapons last 2 turns longer, and summons hit 15% harder. [Skyrim: reanimated undead last longer]", [["summonturns", 2, {}], ["summon", 0.15, {}]]],
    [ "Conjuration", "dark_souls", "Dark Souls", 1, [70], ["necromancy"], "Your summons hit another 25% harder. [Skyrim: reanimated undead have more health]", [["summon", 0.25, {}]]],
    [ "Conjuration", "soul_stealer", "Soul Stealer", 1, [30], ["novice_conjuration"], "Bound weapons hit 15% harder and kills recharge your weapon 5%. [Skyrim: bound weapons soul trap]", [["bound", 0.15, {}], ["siphon", 0.05, {}]]],
    // ---------------------------------------------------------------- Illusion (6 → 12)
    [ "Illusion", "adept_illusion", "Adept Illusion", 1, [50], ["apprentice_illusion"], "Adept illusion spells cost half. [Skyrim]", [["tier", 1, {}]]],
    [ "Illusion", "expert_illusion", "Expert Illusion", 1, [75], ["adept_illusion"], "Expert illusion spells cost half. [Skyrim]", [["tier", 1, {}]]],
    [ "Illusion", "master_illusion", "Master Illusion", 1, [100], ["expert_illusion"], "Master illusion spells cost half. [Skyrim]", [["tier", 1, {}]]],
    [ "Illusion", "hypnotic_gaze", "Hypnotic Gaze", 1, [30], ["animage"], "Calm spells hold the foe one turn longer and work on foes 4 levels higher. [Skyrim]", [["calm", 4, {}], ["calmturns", 1, {}]]],
    [ "Illusion", "aspect_of_terror", "Aspect of Terror", 1, [50], ["novice_illusion"], "Fear spells work on foes 6 levels higher and last a turn longer. Bosses and elite foes stay afraid of any fear or Battle Cry a turn longer too. [Skyrim]", [["fear", 6, {}]]],
    [ "Illusion", "rage", "Rage", 1, [70], ["aspect_of_terror"], "Frenzy and fear spells work on foes 8 levels higher. [Skyrim]", [["fear", 8, {}]]],
    // ---------------------------------------------------------------- Mysticism (3 → 9)
    [ "Mysticism", "telekinetic_ward", "Telekinetic Ward", 1, [20], ["spell_absorption"], "Arrows aimed at you are 15% weaker. [OURS, from Telekinesis]", [["in", -0.15, { archerFoe: 1 }]]],
    [ "Mysticism", "spell_reflection", "Spell Reflection", 2, [40, 70], ["spell_absorption"], "5/10% chance to throw a mage's or dragon's blow back at them. [OURS, from Morrowind's Reflect]", [["reflect", [0.05, 0.1], { magic: 1 }]]],
    [ "Mysticism", "dispel_aura", "Dispel Aura", 1, [50], ["detect_life"], "Burning, chills and shocks on you last one turn less. [OURS, from Dispel]", [["statusshort", 1, {}]]],
    [ "Mysticism", "mystic_focus", "Mystic Focus", 1, [60], ["soul_trap"], "Every spell costs 10% less. [OURS]", [["scost", 0.1, {}]]],
    [ "Mysticism", "soul_harvest", "Soul Harvest", 1, [80], ["soul_trap"], "Kills recharge your enchanted weapon another 10%. [OURS, from Soul Trap]", [["siphon", 0.1, {}]]],
    [ "Mysticism", "astral_sight", "Astral Sight", 1, [100], ["mystic_focus", "spell_reflection"], "Magicka comes back 50% faster. [OURS]", [["regenmp", 0.5, {}]]],
    // ---------------------------------------------------------------- Sneak (6 → 12)
    [ "Sneak", "muffled_movement", "Muffled Movement", 1, [30], ["stealth"], "Armor makes no noise: another 8% harder to spot. [Skyrim]", [["hide", 8, {}]]],
    [ "Sneak", "silent_roll", "Silent Roll", 1, [50], ["light_foot"], "Rolling clear: 10% chance to dodge any blow while you're hard to see (night, fog, rain). [Skyrim]", [["dodge", 0.1, { dark: 1 }]]],
    [ "Sneak", "ambusher", "Ambusher", 1, [40], ["muffled_movement"], "Ready for anything: if a foe spots you sneaking up, it gets no free first strike, and your sneak blows can take up to 70% of a strong foe's health (half of a boss's) instead of 50%. [OURS]", [["ambush", 1, {}]]],
    [ "Sneak", "silence", "Silence", 1, [70], ["silent_roll"], "Another 10% harder to spot. [Skyrim]", [["hide", 10, {}]]],
    [ "Sneak", "shadow_dancer", "Shadow Dancer", 1, [60], ["backstab"], "Sneak attacks with any weapon do 25% more. [OURS]", [["out", 0.25, { sneak: 1 }]]],
    [ "Sneak", "assassins_mark", "Assassin's Mark", 1, [80], ["assassins_blade"], "A sneak attack that leaves the foe below 20% health finishes it. [OURS]", [["sneakexec", 0.2, {}]]],
    [ "Sneak", "vanish", "Vanish", 1, [90], ["shadow_warrior"], "After a foe misses you, 15% chance to slip back into hiding: your next hit is a sneak attack. [OURS]", [["vanish", 0.15, {}]]],
    // ---------------------------------------------------------------- Lockpicking (8 → 11)
    [ "Lockpicking", "quick_hands", "Quick Hands", 1, [40], ["apprentice_locks"], "Every lock is 10% easier. [Skyrim: picking isn't noticed]", [["lock", 0.1, {}]]],
    [ "Lockpicking", "wax_key", "Wax Key", 1, [50], ["quick_hands"], "Chests give 25% more gold. [Skyrim: copy keys]", [["gold", 0.25, {}]]],
    [ "Lockpicking", "lucky_draw", "Lucky Draw", 2, [60, 90], ["golden_touch"], "In a party loot vote, add 5/10 to your d100 rolls for the things you want. [OURS]", [["lootroll", 5, {}]]],
    // ---------------------------------------------------------------- Pickpocket (5 → 9)
    [ "Pickpocket", "keymaster", "Keymaster", 1, [60], ["cutpurse"], "Pickpocketing is another 10% easier. [Skyrim: steal keys]", [["pick", 0.1, {}]]],
    [ "Pickpocket", "poisoned", "Poisoned", 1, [70], ["misdirection"], "Your weapon poisons hit 25% harder. [Skyrim: reverse-pickpocket poisons]", [["poison", 0.25, {}]]],
    [ "Pickpocket", "perfect_touch", "Perfect Touch", 1, [100], ["keymaster"], "Pickpocketing is another 15% easier. [Skyrim: steal worn gear]", [["pick", 0.15, {}]]],
    [ "Pickpocket", "nimble", "Nimble", 1, [40], ["light_fingers"], "8% chance to dodge a blow in a fight. [OURS]", [["dodge", 0.08, {}]]],
    // ---------------------------------------------------------------- Mercantile (3 → 9)
    [ "Mercantile", "investor", "Investor", 1, [70], ["fence"], "Prices are another 5% better. [Skyrim: invest in shops]", [["price", 0.05, {}]]],
    [ "Mercantile", "merchant", "Merchant", 1, [50], ["haggling"], "Prices are another 5% better. [Skyrim: sell anything anywhere]", [["price", 0.05, {}]]],
    [ "Mercantile", "allure", "Allure", 1, [70], ["merchant"], "Prices are another 5% better. [Skyrim: 10% better with the opposite sex]", [["price", 0.05, {}]]],
    [ "Mercantile", "bargain_hunter", "Bargain Hunter", 1, [40], ["haggling"], "Inns and trainers cost 10% less. [OURS]", [["inn", 0.1, {}]]],
    [ "Mercantile", "trade_routes", "Trade Routes", 1, [80], ["investor", "allure"], "Jobs from the notice boards pay 15% more. [OURS]", [["job", 0.15, {}]]],
    [ "Mercantile", "horse_trader", "Horse Trader", 2, [30, 60], ["haggling"], "Horses and stable work cost 10%/20% less, and the horses you buy roll better. [OURS]", [["stable", [0.1, 0.2], {}]]],
    [ "Mercantile", "deep_pockets", "Deep Pockets", 1, [30], ["haggling"], "Carry 50 more. [OURS]", [["carry", 50, {}]]],
    // ---------------------------------------------------------------- Speechcraft (3 → 9)
    [ "Speechcraft", "silver_tongue", "Silver Tongue", 1, [20], [], "Prices are 5% better. [OURS]", [["price", 0.05, {}]]],
    [ "Speechcraft", "commanding_voice", "Commanding Voice", 1, [60], ["intimidation"], "Shouts cool down 15% faster. [OURS]", [["shoutcd", 0.15, {}]]],
    [ "Speechcraft", "inspiring", "Inspiring", 1, [40], ["persuasion"], "Your follower and party allies fight 15% harder. [OURS]", [["allies", 0.15, {}]]],
    [ "Speechcraft", "leadership", "Leadership", 2, [50, 80], ["inspiring"], "Your follower learns from fights 25/50% faster and shrugs off 10/20% of the blows they take. [OURS]", [["folxp", 0.25, {}], ["foltaken", 0.1, {}]]],
    [ "Speechcraft", "battle_tutor", "Battle Tutor", 1, [40], ["inspiring"], "Your follower can learn spell tomes 10 skill points early, and their spells cost 20% less magicka. [OURS]", [["folteach", 10, {}], ["folmp", 0.2, {}]]],
    [ "Speechcraft", "shield_brother", "Shield-Brother", 1, [60], ["leadership"], "Combos with your follower, summons and party hit 25% harder (Shatter, Overload, Steam, Thermal shock, Opening). [OURS]", [["combo", 0.25, {}]]],
    [ "Speechcraft", "talk_down", "Talk Down", 1, [50], ["bribery"], "Bribes and fines cost 25% less. [OURS]", [["bribe", 0.25, {}]]],
    [ "Speechcraft", "rally", "Rally", 1, [80], ["inspiring"], "Your follower and party allies fight another 15% harder. [OURS]", [["allies", 0.15, {}]]],
    [ "Speechcraft", "orator", "Orator", 1, [100], ["commanding_voice", "rally"], "Jobs pay 10% more and prices are 5% better. [OURS]", [["job", 0.1, {}], ["price", 0.05, {}]]],
    // ---------------------------------------------------------------- Etiquette (3 → 9)
    [ "Etiquette", "good_host", "Good Host", 1, [30], ["courtly_manners"], "Inns and trainers cost another 10% less. [OURS]", [["inn", 0.1, {}]]],
    [ "Etiquette", "favour_of_the_court", "Favour of the Court", 1, [40], ["courtly_manners"], "Jobs pay 10% more. [OURS]", [["job", 0.1, {}]]],
    [ "Etiquette", "pardon", "Pardon", 1, [60], ["noble_friends"], "Fines and bribes cost another 25% less. [OURS]", [["bribe", 0.25, {}]]],
    [ "Etiquette", "thanes_guard", "Thane's Guard", 1, [80], ["diplomat"], "Your follower fights 20% harder. [OURS: a housecarl's loyalty]", [["allies", 0.2, {}]]],
    [ "Etiquette", "noblesse", "Noblesse", 1, [70], ["favour_of_the_court"], "Prices are 5% better. [OURS]", [["price", 0.05, {}]]],
    [ "Etiquette", "court_wizard", "Court Wizard", 1, [100], ["thanes_guard", "noblesse"], "Jobs pay 15% more. [OURS]", [["job", 0.15, {}]]],
    // ---------------------------------------------------------------- Streetwise (3 → 9)
    [ "Streetwise", "alley_cat", "Alley Cat", 1, [20], ["rumour_monger"], "5% harder to spot. [OURS]", [["hide", 5, {}]]],
    [ "Streetwise", "dirty_fighting", "Dirty Fighting", 1, [40], ["rumour_monger"], "Your first hit of a fight does 20% more. [OURS]", [["out", 0.2, { first: 1 }]]],
    [ "Streetwise", "fence_network", "Fence Network", 1, [50], ["underworld_contacts"], "Prices are 5% better. [OURS]", [["price", 0.05, {}]]],
    [ "Streetwise", "lookout", "Lookout", 1, [60], ["alley_cat"], "Traps are 15% easier to spot and dodge. [OURS]", [["trap", 15, {}]]],
    [ "Streetwise", "gutter_luck", "Gutter Luck", 1, [70], ["dirty_fighting"], "5% chance to dodge any blow. [OURS]", [["dodge", 0.05, {}]]],
    [ "Streetwise", "kingpin", "Kingpin", 1, [100], ["bribe_master", "fence_network"], "Chests and bodies give 20% more gold. [OURS]", [["gold", 0.2, {}]]],
    // ---------------------------------------------------------------- Athletics (3 → 9)
    [ "Athletics", "endurance", "Endurance", 2, [20, 50], ["long_strider"], "Power attacks cost 10/20% less stamina. [OURS]", [["pa", [-0.1, -0.2], {}]]],
    [ "Athletics", "pack_mule", "Pack Mule", 2, [30, 60], ["long_strider"], "Carry 25/50 more. [OURS]", [["carry", [25, 50], {}]]],
    [ "Athletics", "runners_high", "Runner's High", 1, [60], ["second_wind"], "Stamina comes back another 25% faster in fights. [OURS]", [["regensp", 0.25, {}]]],
    [ "Athletics", "trailblazer", "Trailblazer", 1, [80], ["marathon"], "You travel 5% faster. [OURS]", [["travel", 0.05, {}]]],
    [ "Athletics", "iron_lungs", "Iron Lungs", 1, [90], ["runners_high"], "Blocking costs half the stamina. [OURS]", [["blockcost", 0.5, {}]]],
    [ "Athletics", "tireless", "Tireless", 1, [100], ["trailblazer", "iron_lungs"], "Stamina comes back another 25% faster in fights. [OURS]", [["regensp", 0.25, {}]]],
    // ---------------------------------------------------------------- Acrobatics (2 → 9)
    [ "Acrobatics", "roll", "Roll", 1, [30], ["sure_footed"], "5% chance to roll out of the way of any blow. [OURS]", [["dodge", 0.05, {}]]],
    [ "Acrobatics", "cat_fall", "Cat Fall", 1, [20], [], "Traps hurt 30% less. [OURS; Skyrim's Cushioned]", [["trapdmg", 0.3, {}]]],
    [ "Acrobatics", "tumbler", "Tumbler", 1, [40], ["cat_fall"], "Traps are 10% easier to dodge. [OURS]", [["trap", 10, {}]]],
    [ "Acrobatics", "leap_attack", "Leap Attack", 1, [50], ["roll"], "Your first attack of a fight does 25% more. [OURS]", [["out", 0.25, { first: 1 }]]],
    [ "Acrobatics", "wall_runner", "Wall Runner", 1, [70], ["tumbler"], "You travel 5% faster. [OURS]", [["travel", 0.05, {}]]],
    [ "Acrobatics", "untouchable", "Untouchable", 1, [100], ["evasion", "leap_attack"], "Another 5% chance to dodge any blow. [OURS]", [["dodge", 0.05, {}]]],
    [ "Acrobatics", "feather_step", "Feather Step", 1, [60], ["sure_footed"], "Carry 25 more. [OURS]", [["carry", 25, {}]]],
    // ---------------------------------------------------------------- Smithing (5 → 11)
    [ "Archery", "hunters_eye", "Hunter's Eye", 2, [20, 50], ["overdraw"], "Hunting: you find game half again as often, every kill gives an extra piece of meat (rank 2), and you hit animals 10%/20% harder. [OURS]", [["huntrate", [0.5, 0.5], {}], ["huntmeat", [0, 1], {}], ["out", [0.1, 0.2], { tag: ["animal"] }]]],
    [ "Smithing", "prospector", "Prospector", 1, [30], ["steel_smithing"], "Mining: you spot every vein in the rock, gems turn up more often, and you get 2 more swings. [OURS]", [["prospect", 1, {}], ["mineswing", 2, {}], ["gemfind", 0.1, {}]]],
    [ "Smithing", "orcish_smithing", "Orcish Smithing", 1, [50], ["dwarven_smithing"], "Improving weapons and armor adds 1 more. [Skyrim: Orcish gear, improve twice as much]", [["temper", 1, {}]]],
    [ "Smithing", "ebony_smithing", "Ebony Smithing", 1, [80], ["orcish_smithing"], "Improving adds another 1. [Skyrim]", [["temper", 1, {}]]],
    [ "Smithing", "daedric_smithing", "Daedric Smithing", 1, [90], ["ebony_smithing"], "Improving adds another 1. [Skyrim]", [["temper", 1, {}]]],
    [ "Smithing", "glass_smithing", "Glass Smithing", 1, [70], ["advanced_armors", "elven_smithing"], "Improving adds another 1. [Skyrim]", [["temper", 1, {}]]],
    [ "Smithing", "dragon_armor", "Dragon Armor", 1, [100], ["daedric_smithing", "glass_smithing"], "Weapons you wear hit 5% harder and armor you wear protects 5% more. [Skyrim]", [["out", 0.05, { weapon: 1 }], ["armorpct", 0.05, {}]]],
    [ "Smithing", "whetstone", "Whetstone Master", 1, [40], ["steel_smithing"], "Improved weapons hit 5% harder. [OURS]", [["out", 0.05, { tempered: 1 }]]],
    // ---------------------------------------------------------------- Enchanting (3 → 14)
    [ "Enchanting", "fire_enchanter", "Fire Enchanter", 1, [30], ["soul_squeezer"], "Fire enchantments are 25% stronger. [Skyrim]", [["ench", 0.25, { el: "fire" }]]],
    [ "Enchanting", "frost_enchanter", "Frost Enchanter", 1, [40], ["fire_enchanter"], "Frost enchantments are 25% stronger. [Skyrim]", [["ench", 0.25, { el: "frost" }]]],
    [ "Enchanting", "storm_enchanter", "Storm Enchanter", 1, [50], ["frost_enchanter"], "Shock enchantments are 25% stronger. [Skyrim]", [["ench", 0.25, { el: "shock" }]]],
    [ "Enchanting", "insightful_enchanter", "Insightful Enchanter", 1, [50], ["enchanter"], "Skill enchantments on armor are 25% stronger. [Skyrim]", [["ench", 0.25, { el: "armor" }]]],
    [ "Enchanting", "corpus_enchanter", "Corpus Enchanter", 1, [70], ["insightful_enchanter"], "Health, magicka and stamina enchantments are 25% stronger. [Skyrim]", [["ench", 0.25, { el: "corpus" }]]],
    [ "Enchanting", "extra_effect", "Extra Effect", 1, [100], ["corpus_enchanter", "storm_enchanter"], "Every new enchantment is another 10% stronger. [Skyrim: two effects on one item]", [["ench", 0.1, {}]]],
    [ "Enchanting", "deep_charge", "Deep Charge", 1, [60], ["soul_siphon"], "Enchanted weapons hit 10% harder with their enchantment. [OURS]", [["enchhit", 0.1, {}]]],
    [ "Enchanting", "jeweller", "Jeweller", 1, [30], ["enchanter"], "Enchantments you put on rings and amulets are 15% stronger, and foes drop rings and amulets 50% more often. [OURS]", [["ench", 0.15, { kind: "jewel" }], ["jewelfind", 0.5, {}]]],
    [ "Enchanting", "warding_enchanter", "Warding Enchanter", 1, [40], ["insightful_enchanter"], "Resist Magic, Fire, Frost, Shock and Poison enchantments are 25% stronger. [OURS]", [["ench", 0.25, { el: "ward" }]]],
    [ "Enchanting", "hex_enchanter", "Hex Enchanter", 1, [50], ["fire_enchanter"], "Weapon enchantments that aren't fire, frost or shock (absorb, paralyze, fear, calm, bleeding, turn undead) are 25% stronger. [OURS]", [["ench", 0.25, { el: "other" }]]],
    [ "Enchanting", "rune_smith", "Rune Smith", 1, [80], ["deep_charge"], "Elemental statuses from your enchanted weapons last a turn longer. [OURS]", [["enchstatus", 1, {}]]],
    // the newer enchantments (enchants2.js)
    [ "Enchanting", "runic_enchanter", "Runic Enchanter", 1, [60], ["hex_enchanter"], "Bloodthirst, Thunderclap, Reaping, Sundering, Spellbreaker, Echo Strike, Venom, Dragonbane and Banishing enchantments are 25% stronger. [OURS]", [["ench", 0.25, { el: "rune" }]]],
    [ "Enchanting", "talisman_maker", "Talisman Maker", 1, [45], ["jeweller"], "Thorns, Last Ward, Fortune, Mana Shield, Swiftness, Executioner, Huntsman and Ambusher enchantments are 25% stronger. [OURS]", [["ench", 0.25, { el: "relic" }]]],
    [ "Enchanting", "overcharge", "Overcharge", 1, [90], ["runic_enchanter"], "Your weapon's enchantment surges on 15% of its hits: that hit, its damage, healing and chances count half again as much. [OURS]", [["enchsurge", 0.15, {}]]],
    // ---------------------------------------------------------------- Alchemy (8 → 13)
    [ "Alchemy", "snakeblood", "Snakeblood", 1, [80], ["concentrated_poison"], "You resist burning, chills and shocks: they hurt 25% less. [Skyrim: 50% poison resistance]", [["statusres", 0.25, {}]]],
    [ "Alchemy", "field_medic", "Field Medic", 1, [40], ["physician"], "Healing potions you drink in a fight heal 20% more. [OURS]", [["potion", 0.2, {}]]],
    [ "Alchemy", "forager", "Forager", 1, [20], ["alchemist"], "You spot plant patches from twice as far away, and foraging turns up one more ingredient. [OURS, gathering]", [["gspot", 1, {}], ["forage", 1, {}]]],
    [ "Alchemy", "wildcrafter", "Wildcrafter", 1, [50], ["forager"], "Picked patches grow back twice as fast, and rare finds (Nirnroot, pearls, glowing fungi) turn up when you forage. [OURS, gathering]", [["regrow", 0.5, {}], ["grare", 1, {}]]],
    [ "Alchemy", "master_alchemist", "Master Alchemist", 1, [100], ["purity", "green_thumb"], "Everything you brew is another 10% stronger. [OURS]", [["alch", 0.1, {}]]],
    // ---------------------------------------------------------------- road encounters (encounters.js)
    [ "Speechcraft", "smooth_talker", "Smooth Talker", 1, [30], ["persuasion"], "On the road, bluffs, threats and haggling are 10% more likely to work. [OURS]", [["enctalk", 0.1, {}]]],
    // ---------------------------------------------------------------- a living world (rumours.js)
    [ "Speechcraft", "good_ear", "Good Ear", 1, [25], [], "Rumours you hear are wrong half as often, and leads stay open 50% longer. [OURS]", [["rumtrue", 0.5, {}], ["rumtime", 0.5, {}]]],
    [ "Etiquette", "local_hero", "Local Hero", 1, [35], ["courtly_manners"], "Word of your deeds spreads 25% faster, and the shop discount for friends and heroes of a hold is doubled. [OURS]", [["fame", 0.25, {}], ["heroprice", 1, {}]]],
    [ "Streetwise", "night_owl", "Night Owl", 1, [25], ["rumour_monger"], "Shopkeepers you knock up at night don't charge you extra. [OURS]", [["knock", 1, {}]]],
    [ "Speechcraft", "town_crier", "Town Crier", 1, [40], ["good_ear"], "Whispers of things to come you hear in inns come true 20% more often and sooner, and the Jarl's bounty for dealing with them pays 25% more. [OURS]", [["whisper", 0.2, {}], ["jarlpay", 0.25, {}]]],
    [ "Streetwise", "low_profile", "Low Profile", 1, [35], ["alley_cat"], "Crimes and robbed caravans hurt your name 40% less, and people forget them twice as fast. [OURS]", [["infamy", 0.4, {}], ["forget", 1, {}]]],
    [ "Etiquette", "well_met", "Well Met", 1, [45], ["local_hero"], "Doors open sooner: the inn's back room, the steward's storeroom and the Jarl's guest room need 25% less standing, and making amends costs 40% less. [OURS]", [["doors", 0.25, {}], ["amends", 0.4, {}]]],
    [ "Streetwise", "road_wise", "Road Wise", 1, [30], ["rumour_monger"], "On the road, sneaking past trouble is 10% easier, tolls and bribes cost 20% less, and you read an ambush before it springs more often. [OURS]", [["road", 0.1, {}], ["roadbribe", 0.2, {}]]],
    [ "Athletics", "pathfinder", "Pathfinder", 1, [40], ["long_strider"], "On the road, outrunning trouble, dodging avalanches and taming wild horses is 15% easier. [OURS]", [["roadrun", 0.15, {}]]],
    // ---------------------------------------------------------------- world events (worldevents.js)
    [ "Conjuration", "gate_breaker", "Gate Breaker", 1, [40], ["summoner"], "You know how Oblivion works: Daedra take 15% more damage from you and hit you 10% softer, and your fights at an Oblivion gate count 25% more towards closing it. [OURS]", [["out", 0.15, { tag: ["daedra"] }], ["in", -0.1, { tag: ["daedra"] }], ["wevgate", 0.25, {}]]],
    [ "Archery", "sky_hunter", "Sky Hunter", 1, [50], ["eagle_eye"], "Bows do 15% more to dragons, and every migrating dragon you bring down drops an extra dragon bone. [OURS]", [["out", 0.15, { sk: AR, tag: ["dragon"] }], ["wevbone", 1, {}]]],
    [ "Speechcraft", "caravan_friend", "Caravan Friend", 1, [40], ["bribery"], "The Khajiit's grand caravan sells to you 15% cheaper and sets aside one more rare item for you. Caravans you meet on the road pay you 25% more to guard their wagons. [OURS]", [["wevmarket", 0.15, {}], ["wevstock", 1, {}], ["cvpay", 0.25, {}]]],
    // ---------------------------------------------------------------- great world events (greatevents.js)
    [ "Blocking", "dragonward", "Dragonward", 1, [40], ["shield_wall"], "You've learned to take a dragon's charge: dragons hit you 10% softer, and your charges against a dragon attacking a town count 20% more. [OURS]", [["in", -0.1, { tag: ["dragon"] }], ["gevdragon", 0.2, {}]]],
    [ "Restoration", "rift_warden", "Rift Warden", 1, [40], ["regeneration"], "After every charge in a great world event you catch your breath and heal 20% of your health, and your charges at a Daedric rift count 20% more. [OURS]", [["gevheal", 0.2, {}], ["gevrift", 0.2, {}]]],
    [ "One-Handed", "siege_breaker", "Siege Breaker", 1, [40], ["armsman"], "Bandit raiders, ram crews and warlords take 15% more damage from you, and your charges against a siege count 20% more. [OURS]", [["out", 0.15, { tag: ["siege"] }], ["gevsiege", 0.2, {}]]],
    [ "Mercantile", "fairgoer", "Fairgoer", 1, [30], ["haggling"], "At a town fair the shops sell to you another 10% cheaper, and every fair game gives you 1 more point. [OURS]", [["gevshop", 0.1, {}], ["gevgame", 1, {}]]],
    [ "Etiquette", "hero_of_the_hour", "Hero of the Hour", 1, [35], ["courtly_manners"], "Rewards from great world events and fair prizes pay you 20% more gold. [OURS]", [["gevgold", 0.2, {}]]],
    // ---------------------------------------------------------------- homesteads (homestead.js)
    [ "Smithing", "carpenter", "Carpenter", 1, [30], ["steel_smithing"], "Building at your homestead takes 25% fewer materials. [OURS, from Hearthfire]", [["hsmats", 0.25, {}]]],
    [ "Athletics", "woodsman", "Woodsman", 1, [30], ["long_strider"], "The sawmill, quarry and clay pit at your homestead give 50% more. [OURS]", [["hsyield", 0.5, {}]]],
    [ "Etiquette", "landed_thane", "Landed Thane", 1, [40], ["courtly_manners"], "Homestead deeds and stewards cost 25% less. [OURS]", [["hsdeed", 0.25, {}]]],
    [ "Mercantile", "estate_income", "Estate Income", 1, [50], ["haggling"], "Every wing of your homesteads brings in 15 gold a day (collect it there). [OURS]", [["hsrent", 15, {}]]],
    // ---------------------------------------------------------------- homestead rooms (hsrooms.js)
    [ "Smithing", "master_builder", "Master Builder", 1, [60], ["carpenter"], "Your homesteads have room for a fourth wing. [OURS]", [["hsslot", 1, {}]]],
    [ "Smithing", "hearth_forge", "Hearth Forge", 1, [40], ["carpenter"], "At your homestead's armory, improving gear adds 1 more, and the armory makes 6 more arrows a day. [OURS]", [["hsforge", 1, {}]]],
    [ "Speechcraft", "gracious_host", "Gracious Host", 1, [30], [], "Your display cases earn twice as much from visitors, and party members who stay over at your homestead always wake Well Rested. [OURS]", [["hshost", 1, {}]]],
    [ "Speechcraft", "call_to_arms", "Call to Arms", 1, [45], ["bribery"], "When raiders come for your homestead, talking them down works 25% more often, and your steward and the followers living there hit 25% harder and hold the house better while you're away. [OURS]", [["hsparley", 0.25, {}], ["hsdefend", 0.25, {}]]],
    // ---------------------------------------------------------------- turn-by-turn fights (tbfight.js): action points and initiative
    [ "Athletics", "battle_rhythm", "Battle Rhythm", 2, [30, 70], ["long_strider"], "In turn-by-turn fights you get 1/2 more action points every turn. [OURS]", [["tbap", 1, {}]]],
    [ "Acrobatics", "quick_start", "Quick Start", 2, [25, 60], ["sure_footed"], "In turn-by-turn fights you act sooner: +3/+6 initiative. [OURS]", [["tbinit", 3, {}]]],
    // ---------------------------------------------------------------- sneak mode on the road (sneakmode.js)
    [ "Sneak", "silent_roads", "Silent Roads", 1, [25], ["stealth"], "Sneaking on the road is 15% faster, and other heroes have to be 25% closer to spot you. [OURS]", [["sneakmove", 0.15, {}], ["sneakseen", 0.25, {}]]],
    [ "Sneak", "shadow_paths", "Shadow Paths", 1, [55], ["silent_roads"], "While sneaking on the road, half as many bandits and beasts find you. [OURS]", [["sneakenc", 0.5, {}]]],
    // ---------------------------------------------------------------- cone of sight on the map (vision.js)
    [AR, "far_sight", "Far Sight", 2, [30, 60], ["eagle_eye"], "A hunter's eyes: on the map you see 15/30% further ahead, and your cone of sight is 10/20% wider. You spot places, travellers and caravans sooner. [OURS]", [["sightrange", [0.15, 0.3], {}], ["sightwide", [0.1, 0.2], {}]]],
    [ "Sneak", "owl_eyes", "Owl Eyes", 1, [35], ["stealth"], "Night, fog, storms and blizzards shorten your sight on the map only half as much. [OURS]", [["sightdark", 0.5, {}]]],
    [ "Blocking", "watch_drills", "Watch Drills", 1, [30], ["shield_wall"], "You know how hold guards fight: they hit you 15% softer and you hit them 10% harder. [OURS]", [["in", -0.15, { tag: ["guard"] }], ["out", 0.1, { tag: ["guard"] }]]],
    [ "Sneak", "first_move", "First Move", 1, [40], ["stealth"], "You read a fight before it starts: +4 initiative in turn-by-turn fights. [OURS]", [["tbinit", 4, {}]]],
    [ "Alteration", "quickened_casting", "Quickened Casting", 1, [40], ["apprentice_alteration"], "In turn-by-turn fights you get 1 more spell point every turn (only for spells). [OURS]", [["tbspap", 1, {}]]],
    [ "Heavy Armor", "drilled_in_steel", "Drilled in Steel", 1, [50], ["juggernaut"], "Heavy armor slows you only half as much in turn-by-turn fights (initiative). [OURS]", [["tbheavy", 0.5, {}]]],
    // ---------------------------------------------------------------- something at every place (placestuff.js)
    [ "Lockpicking", "wayfarers_nose", "Wayfarer's Nose", 1, [35], ["apprentice_locks"], "Hidden strongboxes at cabins, shacks and lodges hold 30% more gold and fill up again a day sooner. [OURS]", [["stash", 0.3, {}]]],
    [ "Restoration", "pilgrim", "Pilgrim", 1, [30], ["novice_restoration"], "Blessings from shrines and stones last two days instead of one. [OURS]", [["bless", 1, {}]]],
    // ---------------------------------------------------------------- dungeon mini-games (dungeongames.js): each game reads its key as "ease"
    [ "Acrobatics", "blade_dancer", "Blade Dancer", 1, [45], ["tumbler"], "Dashing past traps: the blades swing slower and block the way for less of each swing. [OURS]", [["dgdash", 0.3, {}]]],
    [ "Sneak", "trap_sense", "Trap Sense", 1, [35], ["stealth"], "Finding the trigger: the pressure plate glints more often, sits lower, and you get one more wrong guess. [OURS]", [["dgspot", 0.3, {}]]],
    [ "Sneak", "patient_shadow", "Patient Shadow", 1, [50], ["muffled_movement"], "Sneaking past a foe in a dungeon: you're noticed a third slower, the shadows are wider and you hear it turn sooner. [OURS]", [["dgsneak", 0.3, {}]]],
    [ "Two-Handed", "lid_breaker", "Lid Breaker", 1, [25], ["barbarian"], "Smashing chests open: the bright zone on the swing is a third wider. [OURS]", [["dgsmash", 0.3, {}]]],
    [ "Athletics", "sprinter", "Sprinter", 1, [30], ["long_strider"], "Running from a dungeon fight: a quarter fewer steps to get away. [OURS]", [["dgflee", 0.25, {}]]],
    // ---------------------------------------------------------------- werewolves and vampires (beastpaths.js)
    [ "Restoration", "bane_of_night", "Bane of the Night", 1, [35], ["novice_restoration"], "Vampires and werewolves take 20% more from your blows and hit you 10% softer. [OURS]", [["out", 0.2, { tag: ["nightkin"] }], ["in", -0.1, { tag: ["nightkin"] }]]],
    [ "Alchemy", "wolfsbane", "Wolfsbane", 1, [30], ["physician"], "You chew wolfsbane and garlic on the road: half as likely to catch a vampire's or a werewolf's curse. [OURS]", [["curseres", 0.5, {}]]],
    [ "Lockpicking", "keen_searcher", "Keen Searcher", 1, [30], ["novice_locks"], "Searching rooms: your hand sweeps a wider patch of dust at once. [OURS]", [["dgsearch", 0.3, {}]]],
    // ---------------------------------------------------------------- followers become people (followerbonds.js)
    [ "Speechcraft", "kindred_spirit", "Kindred Spirit", 1, [25], [], "Your follower warms to you 50% faster when you do things they like, and cools 25% slower when you don't. [OURS]", [["folbond", 0.5, {}], ["folgrudge", 0.25, {}]]],
    [ "Speechcraft", "heart_to_heart", "Heart to Heart", 1, [45], ["kindred_spirit"], "Talking with your follower does twice as much for their loyalty, and they never refuse your orders, however unhappy. [OURS]", [["foltalk", 1, {}], ["folobey", 1, {}]]],
    // ---------------------------------------------------------------- party votes in dungeons (partyvote.js)
    [ "Speechcraft", "voice_of_reason", "Voice of Reason", 1, [35], ["persuasion"], "In a party dungeon vote, your vote counts twice. [OURS]", [["pvweight", 1, {}]]],
    [ "Etiquette", "sworn_companion", "Sworn Companion", 1, [50], ["courtly_manners"], "Followers ask you for their personal quest at loyalty 65 instead of 80, and their signature move is 25% stronger. [OURS]", [["folquest", 15, {}], ["folsig", 0.25, {}]]],
    // ---------------------------------------------------------------- the vampire war (dawnguard.js): one side's perks each, the other side can't take them
    [ "Archery", "dg_bolt_hunter", "Vampire Hunter", 1, [30], [], "Dawnguard only. Bows and crossbows do 25% more damage to vampires and the undead. [Skyrim: Dawnguard]", [["out", 0.25, { sk: AR, tag: ["undead"] }]]],
    [ "Heavy Armor", "dg_sun_ward", "Sun-Blessed Plate", 1, [35], [], "Dawnguard only. In heavy armor, vampires and the undead hit you 15% softer. [OURS]", [["in", -0.15, { heavy: 1, tag: ["undead"] }]]],
    [ "Etiquette", "dg_troll_tamer", "Troll Tamer", 1, [30], [], "Dawnguard only. Gunmar's training: your follower fights 15% harder and shrugs off 10% of the blows they take. [OURS]", [["allies", 0.15, {}], ["foltaken", 0.1, {}]]],
    [ "Illusion", "volk_blood_of_harkon", "Blood of Harkon", 1, [30], [], "Volkihar only. Your Vampire Lord form lasts 3 turns longer, and changing heals a tenth of your health. [OURS]", [["lordturns", 3, {}], ["lordheal", 0.1, {}]]],
    [ "Illusion", "volk_night_lord", "Night Lord", 1, [45], ["volk_blood_of_harkon"], "Volkihar only. As a Vampire Lord your drain life is 30% stronger. [OURS]", [["lorddrain", 0.3, {}]]],
    [ "Illusion", "volk_court", "Court of Volkihar", 1, [60], ["volk_night_lord"], "Volkihar only. As a Vampire Lord you hit 20% harder and take 10% less damage. [OURS]", [["lordout", 0.2, {}], ["lordin", -0.1, {}]]],
    // ---------------------------------------------------------------- the Dwemer ruins and Blackreach (dwemer.js, blackreach.js)
    [ "Smithing", "dwemer_tinkerer", "Dwemer Tinkerer", 1, [35], ["dwarven_smithing"], "Each piece of Dwemer scrap smelts into one more Dwarven ingot, and you know where to hit a machine: 10% more damage to Dwarven constructs. [OURS]", [["dwscrap", 1, {}], ["out", 0.1, { tag: ["construct"] }]]],
    [ "Lockpicking", "dwemer_lore", "Dwemer Lore", 1, [30], ["apprentice_locks"], "Dwemer puzzles show you the next valve or ring to turn, valves hold three more turns before they blow, and half the time a beaten foe in a Dwemer ruin leaves extra scrap. [OURS]", [["dwlore", 1, {}], ["dwloot", 0.5, {}]]],
    [ "Sneak", "falmer_hunter", "Blind Hunter", 1, [40], ["stealth"], "The Falmer can't see you, so you learn to hunt them: they hit you 15% softer and take 10% more damage from you. [OURS]", [["in", -0.15, { tag: ["falmer"] }], ["out", 0.1, { tag: ["falmer"] }]]],
    [ "Heavy Armor", "steam_proof", "Steam-Proof", 1, [40], ["juggernaut"], "In heavy armor, Dwarven machines hit you 15% softer. [OURS]", [["in", -0.15, { heavy: 1, tag: ["construct"] }]]],
    // ---------------------------------------------------------------- boss fights (bossfight.js)
    [ "One-Handed", "giant_slayer", "Giant Slayer", 1, [40], ["armsman"], "Bosses take 10% more damage from you, and 20% more once they reach their last phase. [OURS]", [["out", 0.1, { bossFoe: 1 }], ["out", 0.1, { bossLast: 1 }]]],
    [ "Blocking", "read_the_signs", "Read the Signs", 1, [30], ["shield_wall"], "A boss's big attacks (the ones it shows a turn ahead) hurt you 25% less. [OURS]", [["bftele", 0.25, {}]]],
    // ---------------------------------------------------------------- player-run holds (holdrule.js)
    [ "Speechcraft", "fair_dues", "Fair Dues", 2, [20, 45], [], "A hold's tax costs you half as much when you shop there (rank 2: you pay none). [OURS]", [["holdtax", 0.5, {}]]],
    [ "Speechcraft", "jarls_favour", "Jarl's Favour", 1, [50], ["fair_dues"], "In a hold your clan rules, shops sell to you another 5% cheaper, and while you're its Jarl, taxes fill the treasury 20% faster. [OURS]", [["jarlfav", 0.05, {}], ["jarlpurse", 0.2, {}]]],
    [ "Etiquette", "hold_warden", "Hold Warden", 1, [35], ["courtly_manners"], "In hold challenges and raids, the champion and the defenders have 10% less health and hit 10% softer. [OURS]", [["holdfight", 0.1, {}]]],
    [ "Two-Handed", "break_their_focus", "Break Their Focus", 1, [35], ["barbarian"], "Any blow that takes a tenth of a boss's health breaks the big attack it's getting ready, and it reels and loses its next move. [OURS]", [["bfbreak", 1, {}]]],
    // ---------------------------------------------------------------- shouts and weather (thuum.js, wxmatters.js, weatherfx.js)
    [ "Speechcraft", "thuum_mastery", "Thu'um Mastery", 2, [75, 95], ["commanding_voice"], "Your voice comes back sooner: every shout cools down another 10/20% (all cooldown cuts together stop at half). [OURS]", [["shoutcd", [0.1, 0.2], {}]]],
    [ "Acrobatics", "weathered_traveller", "Weathered Traveller", 2, [30, 60], ["sure_footed"], "Snow, rain, fog and storms slow your travel 25/50% less, and the cold creeps in 25/50% slower. [OURS]", [["wxslow", [0.25, 0.5], {}], ["coldslow", [0.25, 0.5], {}]]],
    [ "Alteration", "starlit_mind", "Starlit Mind", 1, [35], ["apprentice_alteration"], "Under a clear night sky your magicka comes back twice as fast in fights (instead of 50% faster). [OURS]", [["starmp", 0.5, {}]]],
    // ---------------------------------------------------------------- treasure maps and relics (treasure.js)
    [ "Streetwise", "cartographer", "Cartographer", 1, [25], ["rumour_monger"], "Treasure maps come clearer: one more landmark, firm roads and a full compass, and you know the hold at once. [OURS]", [["tmapx", 1, {}]]],
    [ "Mercantile", "antiquarian", "Antiquarian", 1, [30], ["haggling"], "You restore relics yourself, anywhere, from one fragment fewer, and collectors pay half again as much for them. [OURS]", [["relicfix", 1, {}], ["relicpay", 0.5, {}]]],
    [ "Athletics", "excavator", "Excavator", 2, [30, 60], ["long_strider"], "Buried treasure holds 25%/50% more gold and an extra gem or relic fragment, and a wrong dig tires you half as long. [OURS]", [["digloot", [0.25, 0.5], {}], ["diggem", 1, {}], ["digrest", 0.5, {}]]],
  ];
  const FX = {};
  if (typeof PERKS !== "undefined") {
    for (const [sk, id, name, ranks, req, needs, desc, fx] of ADD) {
      const tree = PERKS.TREES[sk];
      if (!tree || PERKS.BY_ID[id]) continue;
      tree.push([id, name, ranks, req, needs, desc]);
      PERKS.BY_ID[id] = { id, name, ranks, req, needs, desc, skill: sk };
      FX[id] = fx;
    }
  }
  const val = (v, r) => (Array.isArray(v) ? v[Math.min(r, v.length) - 1] || 0 : v * r);
  const BIG = /giant|dragon|mammoth|centurion|lurker|troll/i, ARCHER = /archer|bow|hunter|marksman|ranger|sniper/i;

  // ---- what you're wearing (works in and out of fights)
  function worn(s, f) {
    if (f && f._pfxWorn) return f._pfxWorn;
    const types = {};
    let eq = null;
    try { eq = f ? f.eq : G.equipment(s); } catch (e) { eq = {}; }
    const items = Object.entries(eq || {}).map(([sl, r]) => [sl, D.ITEMS[r.item]]).filter(([, it]) => it);
    let armorPieces = 0;
    for (const [sl, it] of items) if (sl !== "weapon" && sl !== "shield" && ["light", "medium", "heavy"].includes(it.type)) { types[it.type] = (types[it.type] || 0) + 1; armorPieces++; }
    const shield = items.some(([sl]) => sl === "shield");
    const w = { heavy: (types.heavy || 0) >= 2, light: (types.light || 0) >= 2, medium: (types.medium || 0) >= 2, bare: armorPieces === 0, shield };
    if (f) f._pfxWorn = w;
    return w;
  }
  // ---- conditions. f = a Fight (or null outside fights); x = this moment ({ power, sneak, first, sk, wt, el, kind, school, hit })
  function ok(s, c, f, x = {}) {
    if (!c) return true;
    const w = (c.heavy || c.light || c.medium || c.bare || c.shield || c.noShield) ? worn(s, f) : null;
    if (c.heavy && !w.heavy) return false;
    if (c.light && !w.light) return false;
    if (c.medium && !w.medium) return false;
    if (c.bare && !w.bare) return false;
    if (c.shield && !w.shield) return false;
    if (c.noShield && w.shield) return false;
    if (c.sk && (x.sk || (f && f.weaponSkill ? f.weaponSkill() : null)) !== c.sk) return false;
    if (c.wt && !c.wt.includes(x.wt || (f && f.wt))) return false;
    if (c.power && !x.power) return false;
    if (c.normal && x.power) return false;
    if (c.sneak && !x.sneak) return false;
    if (c.first && !(f && f.firstHit)) return false;
    if (c.mounted && !(f && f.mount)) return false;
    if (c.weapon && !(f && f.weapon)) return false;
    if (c.tempered && !(f && f.temper > 0)) return false;
    if (c.el && x.el !== c.el) return false;
    if (c.kind && x.kind !== c.kind) return false;
    if (c.school && x.school !== c.school) return false;
    if (c.blocking && !x.blocking) return false;
    if (f) {
      const tags = f.tags || new Set(), n = f.e?.name || "";
      if (c.tag && !c.tag.some((t) => tags.has(t))) return false;
      if (c.tough && !(tags.has("elite") || tags.has("dragon") || f.e?.boss || f.e?.danger === "high")) return false;
      if (c.big && !(tags.has("dragon") || BIG.test(n))) return false;
      if (c.magic && !(tags.has("mage") || tags.has("dragon") || x.magic)) return false;
      if (c.archerFoe && !ARCHER.test(n)) return false;
      const mh = typeof G !== "undefined" ? G.maxHealth(s) : 100;
      if (c.hpBelow && !(100 * f.hp / mh < c.hpBelow)) return false;
      if (c.hpAbove && !(100 * f.hp / mh > c.hpAbove)) return false;
      if (c.bigHit && !((x.hit || 0) > c.bigHit * mh)) return false;
      if (c.dark && !(f.wx?.dark || f.dark)) return false;
      if (c.foeBelow && !(f.ehp > 0 && f.ehp < c.foeBelow * (f.e?.health || f.ehp0 || 1))) return false;   // the foe is nearly done
      if (c.foeEl && (f._foeEl === undefined ? (f._foeEl = (f.e && foeElement(f.e)?.el) || null) : f._foeEl) !== c.foeEl) return false;   // Resist Fire/Frost/Shock: their blows carry that element
      if (c.bossFoe && !f.bf) return false;   // bossfight.js
      if (c.bossLast && !(f.bf && f.bf.phase >= f.bf.th.length)) return false;
      if (c.venom && !(f.e?.poison || tags.has("venom") || (VENOM.test(n) && !/dwarven|brass/i.test(n)))) return false;   // Resist Poison
    } else if (c.foeBelow || c.tag || c.tough || c.big || c.magic || c.archerFoe || c.hpBelow || c.hpAbove || c.first || c.mounted || c.bigHit || c.dark || c.foeEl || c.venom || c.bossFoe || c.bossLast) return false;
    return true;
  }
  function each(s, key, f, x, fn) {
    if (s.perks) for (const id in s.perks) {
      const r = s.perks[id], fx = FX[id];
      if (!r || !fx) continue;
      for (const [k, v, c] of fx) if (k === key && ok(s, c, f, x)) fn(val(v, r), id);
    }
    // worn enchantments that work like perks (Resist Fire, Fortify Block, Fortify Critical, Evasion... see enchanting.js PFXMAP)
    if (typeof ENCH !== "undefined" && ENCH.pfxWorn && s.loadouts && s.inv) for (const [k, v, c] of ENCH.pfxWorn(s, f)) if (k === key && ok(s, c, f, x)) fn(v, "ench");
  }
  const sum = (s, key, f, x) => { let t = 0; each(s, key, f, x, (v) => (t += v)); return t; };
  const has = (s, key, f, x) => sum(s, key, f, x) > 0;

  // ---- numbers the town / travel / crafting code asks for (no fight)
  const num = (s, key) => sum(s, key, null, {});

  // ---- fights: damage you deal (multiplier) and take (multiplier, never below 25%)
  const out = (f, x) => 1 + Math.min(1.5, sum(f.s, "out", f, x));
  const inMult = (f, x) => { const t = sum(f.s, "in", f, x); return t <= -1 ? 0 : Math.max(0.25, 1 + t); };
  /* extra effects of a landed weapon hit: stagger, paralyze, bleed, a second strike, a finishing blow. Returns label text. */
  function onHit(f, x, dmg) {
    const s = f.s; let label = "";
    if (!f.stagger && Math.random() < sum(s, "stag", f, x)) { f.stagger = true; label += ", staggers"; }
    if (Math.random() < sum(s, "para", f, x)) { f.eParalyzed = Math.max(f.eParalyzed || 0, 2); label += ", pinned"; }
    const b = sum(s, "bleed", f, x); if (b) f.bleed.push({ dmg: b, turns: 3 });
    if (f.ehp > 0 && Math.random() < sum(s, "extra", f, x)) { const d2 = dmg * 0.5; f.ehp -= d2; label += ` · quick second strike ${Math.round(d2)}`; }
    if (x.sneak) { const t = sum(s, "sneakexec", f, x); if (t && f.ehp > 0 && f.ehp < t * (f.e.health || f.ehp0)) { f.ehp = 0; label += " · finished off"; } }
    if (f.riposte) f.riposte = false;
    return label;
  }

  // ---------------------------------------------------------------- elemental statuses
  const VENOM = /spider|chaurus|spriggan|snake|viper|skeever|hagraven|assassin|poison/i;
  const ICON = { burn: "🔥", chill: "❄️", shock: "⚡" };
  const VERB = { burn: "burns", chill: "is chilled", shock: "is jolted" };
  /* which element a foe's blows carry, if any (name based: fire mages, dragons, atronachs, witches...) */
  function foeElement(e) {
    const n = (e.name || "") + " " + (e.element || "");
    if (e.element && ICON[{ fire: "burn", frost: "chill", shock: "shock" }[e.element]]) return { el: e.element, ch: 0.6 };
    if (/flame atronach|fire|flame|ember|blaze|pyro/i.test(n)) return { el: "fire", ch: /atronach/i.test(n) ? 1 : 0.6 };
    if (/frost|ice|snow|wraith/i.test(n)) return { el: "frost", ch: /atronach|wraith/i.test(n) ? 1 : /troll|spider|wolf|bear/i.test(n) ? 0 : 0.6 };
    if (/storm|shock|lightning|spark|thunder/i.test(n)) return { el: "shock", ch: /atronach/i.test(n) ? 1 : 0.6 };
    if (/dragon priest|lich|necromancer|conjurer|mage|wizard|warlock|hagraven|witch|thalmor|justiciar|sorcer/i.test(n)) { let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) | 0; return { el: ["fire", "frost", "shock"][Math.abs(h) % 3], ch: 0.4 }; }
    if (/dragon/i.test(n)) return { el: /frost|ice|snow|blood/i.test(n) ? "frost" : "fire", ch: 0.25 };
    return null;
  }
  const KEY = { fire: "burn", frost: "chill", shock: "shock" };
  /* is this foe immune to / weak against a status? */
  function foeImmune(f, st) {
    const n = f.e?.name || "";
    if (st === "burn") return /flame atronach|fire|ember|dragon priest|ash spawn|daedra lord/i.test(n) || (f.tags.has("dragon") && !/frost|ice/i.test(n) && /fire/i.test(n));
    if (st === "chill") return /frost|ice|snow|draugr|skeleton|wraith/i.test(n) || f.tags.has("construct");
    if (st === "shock") return /storm atronach/i.test(n);
    return false;
  }
  const foeWeak = (f, st) => st === "burn" && (typeof MAGIC !== "undefined" ? MAGIC.elem(f, "fire") > 1 : f.tags.has("undead"));
  /* the foe is hit by an element: el = fire/frost/shock, amt = the hit's damage, src = "spell"/"weapon"/"shout"/"staff" */
  function hitFoe(f, el, amt, src = "spell") {
    const st = KEY[el]; if (!st || amt <= 0 || f.ehp <= 0) return "";
    f.foeSt = f.foeSt || {};
    if (foeImmune(f, st)) return "";
    const s = f.s, plus = src === "weapon" ? sum(s, "enchstatus", f, {}) : 0;
    let label = "";
    if (st === "burn") {
      const strong = sum(s, "burn", f, {});   // Intense Flames
      const turns = 3 + (strong ? 1 : 0) + (foeWeak(f, st) ? 1 : 0) + plus;
      const dmg = Math.max(1, Math.round(amt * 0.15 * (1 + strong) * (1 + 0.1 * P(s, "augmented_flames"))));
      const cur = f.foeSt.burn;
      f.foeSt.burn = { dmg: Math.max(dmg, cur ? cur.dmg : 0), turns: Math.max(turns, cur ? cur.turns : 0) };   // a fresh burn refreshes, never stacks
      label = ` · ${ICON.burn} sets it burning`;
    } else if (st === "chill") {
      f.foeSt.chill = { turns: 2 + plus };
      f.slowed = Math.max(f.slowed || 0, 2);
      if (Math.random() < sum(s, "freeze", f, {})) { f.eParalyzed = Math.max(f.eParalyzed || 0, 1); label = ` · ${ICON.chill} frozen solid`; }
      else label = ` · ${ICON.chill} chilled`;
    } else if (st === "shock") {
      f.foeSt.shock = { turns: 2 + plus };
      const caster = typeof MAGIC !== "undefined" ? MAGIC.isCaster(f) : f.tags.has("mage");
      if (caster && !f.stagger && Math.random() < 0.3) { f.stagger = true; label = ` · ${ICON.shock} spell interrupted`; }
      else label = ` · ${ICON.shock} jolted`;
      const t = sum(s, "exec", f, { el: "shock" });   // Disintegrate
      if (t && f.ehp > 0 && f.ehp < t * (f.e.health || f.ehp0)) { f.ehp = 0; label += " · disintegrated"; }
    }
    return label;
  }
  /* you are hit by an element (a fire mage, a dragon's breath...). Returns label text. */
  function hitMe(f, el, dmg) {
    const st = KEY[el]; if (!st || dmg <= 0) return "";
    const s = f.s; f.meSt = f.meSt || {};
    const short = Math.min(2, sum(s, "statusshort", f, {})), res = Math.min(0.75, sum(s, "statusres", f, {}) + Math.min(0.5, (G.fxSum(s, "resist") || 0) / 100));
    if (st === "burn") {
      const turns = Math.max(1, 2 - short), d = Math.max(1, Math.round(dmg * 0.1 * (1 - res)));   // gentler on you than on foes: 10% for 2 turns
      const cur = f.meSt.burn; f.meSt.burn = { dmg: Math.max(d, cur ? cur.dmg : 0), turns: Math.max(turns, cur ? cur.turns : 0) };
      return ` · ${ICON.burn} you're burning`;
    }
    if (st === "chill") {
      f.meSt.chill = { turns: Math.max(1, 2 - short) };
      const drain = Math.round(dmg * 0.4 * (1 - res)); f.sp = Math.max(0, f.sp - drain);
      return ` · ${ICON.chill} chilled (−${drain} stamina)`;
    }
    f.meSt.shock = { turns: Math.max(1, 2 - short) };
    const drain = Math.round(dmg * 0.35 * (1 - res)); f.mp = Math.max(0, f.mp - drain);
    return ` · ${ICON.shock} jolted (−${drain} magicka)`;
  }
  /* once a turn: burns hurt, statuses wear off. Adds to the turn's log line. */
  function tick(f, line) {
    const parts = [];
    const fs = f.foeSt || {}, ms = f.meSt || {};
    if (fs.burn && f.ehp > 0) { f.ehp -= fs.burn.dmg; parts.push(`${ICON.burn} the ${(f.e.name || "foe").toLowerCase()} burns for ${fs.burn.dmg}`); }
    if (ms.burn && f.hp > 0) {
      f.hp -= ms.burn.dmg; parts.push(`${ICON.burn} you burn for ${ms.burn.dmg}`);
      if (f.hp <= 0 && P(f.s, "shadow_warrior") && !f.shadowUsed) { f.shadowUsed = true; f.hp = 1; }
    }
    if (ms.chill) f.regenSpHold = true;
    const rh = f.hp > 0 && typeof G !== "undefined" ? sum(f.s, "regenhp", f, {}) : 0;   // Regenerate Health gear: a little back every turn
    if (rh > 0) { const mh = G.maxHealth(f.s), h = Math.min(mh - f.hp, Math.max(1, Math.round(mh * rh))); if (h > 0) { f.hp += h; parts.push(`you recover ${h}`); } }
    for (const set of [fs, ms]) for (const k of Object.keys(set)) { set[k].turns--; if (set[k].turns <= 0) delete set[k]; }
    if (parts.length) line.me += " · " + parts.join(" · ");
    line.st = { me: Object.fromEntries(Object.entries(ms).map(([k, v]) => [k, v.turns])), foe: Object.fromEntries(Object.entries(fs).map(([k, v]) => [k, v.turns])) };
    if (!Object.keys(line.st.me).length && !Object.keys(line.st.foe).length) delete line.st;
  }
  /* for the Smart AI: how much a status from this element adds (per cast, on average), and whether re-applying is wasted */
  /* for the Smart AI. Its other options (runes, summons, cloaks) are valued without statuses, so a fresh status isn't
     counted as extra here (that skewed it away from runes and atronachs). What it does count: a foe that is already
     burning and will burn to death anyway is not worth another fire spell (a negative adjustment, so another element
     or saving magicka wins); and Disintegrate near the end makes shock worth more. */
  function statusValue(f, el, amt) {
    const st = KEY[el]; if (!st || foeImmune(f, st)) return 0;
    if (st === "burn") { const cur = f.foeSt?.burn; return cur && cur.dmg * cur.turns >= f.ehp ? -0.6 * amt : 0; }
    if (st === "shock") return sum(f.s, "exec", f, { el: "shock" }) && f.ehp < 0.3 * (f.e.health || f.ehp0 || 1) ? 0.3 * amt : 0;
    return 0;
  }
  const foeBurning = (f) => !!f.foeSt?.burn;

  return { ADD, FX, num, sum, has, out, inMult, onHit, ok, worn, hitFoe, hitMe, tick, foeElement, statusValue, foeBurning, ICON, KEY };
})();
