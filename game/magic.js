/* More magic: Skyrim spells across all six schools with new effects the fights can resolve (cloaks, runes, burning
   walls, wards, paralysis, fear, turning undead, bound weapons, raised dead, soul trap), spell levels from Novice to
   Master (casting above your skill costs more and can fizzle), dual casting (×2.2 power for ×2.8 magicka), staffs
   that cast with charges, and spells you can cast outside fights (Transmute, Candlelight, Detect Life, Muffle,
   Clairvoyance, healing). [Skyrim] names, schools and levels; magnitudes follow Skyrim's where the turn-based fights
   allow, otherwise [OURS] on the same scale (a fight turn ≈ 1–2 seconds of Skyrim). */
const MAGIC = (() => {
  const LEVELS = ["Novice", "Apprentice", "Adept", "Expert", "Master"];
  const REQ = { Novice: 0, Apprentice: 25, Adept: 50, Expert: 75, Master: 100 };   // [Skyrim] the skill each level is meant for
  const TOME_VALUE = { Novice: 50, Apprentice: 96, Adept: 340, Expert: 1200, Master: 2000 };   // [Skyrim] up to Expert; Master [OURS]

  //  id                    name                         school         level        cost kind          amount extra
  const NEW = [
    // Destruction
    ["fire_rune", "Fire Rune", "Destruction", "Apprentice", 76, "rune", 50, { element: "fire" }],
    ["frost_rune", "Frost Rune", "Destruction", "Apprentice", 87, "rune", 50, { element: "frost" }],
    ["lightning_rune", "Lightning Rune", "Destruction", "Apprentice", 97, "rune", 50, { element: "shock" }],
    ["flame_cloak", "Flame Cloak", "Destruction", "Adept", 134, "cloak", 8, { element: "fire", turns: 12 }],
    ["frost_cloak", "Frost Cloak", "Destruction", "Adept", 149, "cloak", 8, { element: "frost", turns: 12 }],
    ["lightning_cloak", "Lightning Cloak", "Destruction", "Adept", 164, "cloak", 8, { element: "shock", turns: 12 }],
    ["wall_of_flames", "Wall of Flames", "Destruction", "Expert", 179, "dot", 22, { element: "fire", turns: 5 }],
    ["wall_of_frost", "Wall of Frost", "Destruction", "Expert", 197, "dot", 22, { element: "frost", turns: 5 }],
    ["wall_of_storms", "Wall of Storms", "Destruction", "Expert", 216, "dot", 22, { element: "shock", turns: 5 }],
    ["fire_storm", "Fire Storm", "Destruction", "Master", 460, "damage", 110, { element: "fire" }],
    ["blizzard", "Blizzard", "Destruction", "Master", 480, "dot", 40, { element: "frost", turns: 6 }],
    ["lightning_storm", "Lightning Storm", "Destruction", "Master", 500, "damage", 130, { element: "shock" }],
    // Restoration
    ["lesser_ward", "Lesser Ward", "Restoration", "Novice", 34, "ward", 40, {}],
    ["steadfast_ward", "Steadfast Ward", "Restoration", "Apprentice", 61, "ward", 60, {}],
    ["greater_ward", "Greater Ward", "Restoration", "Adept", 97, "ward", 80, {}],
    ["turn_lesser_undead", "Turn Lesser Undead", "Restoration", "Novice", 84, "turn", 0, { max_level: 6 }],
    ["turn_undead", "Turn Undead", "Restoration", "Apprentice", 131, "turn", 0, { max_level: 13 }],
    ["repel_undead", "Repel Undead", "Restoration", "Expert", 230, "turn", 0, { max_level: 30 }],
    ["grand_healing", "Grand Healing", "Restoration", "Expert", 287, "heal", 200, {}],
    ["guardian_circle", "Guardian Circle", "Restoration", "Master", 420, "regen", 25, { turns: 10 }],
    // Alteration
    ["candlelight", "Candlelight", "Alteration", "Novice", 21, "utility", 0, { use: "candlelight" }],
    ["transmute", "Transmute Mineral Ore", "Alteration", "Adept", 138, "utility", 0, { use: "transmute" }],
    ["paralyze", "Paralyze", "Alteration", "Expert", 247, "paralyze", 3, {}],
    ["mass_paralysis", "Mass Paralysis", "Alteration", "Master", 420, "paralyze", 5, {}],
    ["dragonhide", "Dragonhide", "Alteration", "Master", 400, "armor", 160, {}],
    // Conjuration
    ["bound_sword", "Bound Sword", "Conjuration", "Novice", 52, "bound", 9, { skill: "One-Handed", wt: "sword" }],
    ["bound_battleaxe", "Bound Battleaxe", "Conjuration", "Apprentice", 82, "bound", 15, { skill: "Two-Handed", wt: "battleaxe" }],
    ["bound_bow", "Bound Bow", "Conjuration", "Adept", 115, "bound", 24, { skill: "Archery", wt: "bow" }],
    ["raise_zombie", "Raise Zombie", "Conjuration", "Novice", 75, "reanimate", 6, { fights: 2 }],
    ["reanimate_corpse", "Reanimate Corpse", "Conjuration", "Apprentice", 98, "reanimate", 13, { fights: 2 }],
    ["revenant", "Revenant", "Conjuration", "Adept", 145, "reanimate", 21, { fights: 3 }],
    ["dread_zombie", "Dread Zombie", "Conjuration", "Expert", 197, "reanimate", 30, { fights: 3 }],
    ["dead_thrall", "Dead Thrall", "Conjuration", "Master", 380, "reanimate", 40, { fights: 8 }],
    ["dremora_lord", "Conjure Dremora Lord", "Conjuration", "Expert", 291, "summon", 40, { turns: 60 }],
    // Mysticism ([OURS] the old Morrowind school of the soul and the unseen, kept as its own skill here)
    ["soul_trap", "Soul Trap", "Mysticism", "Novice", 51, "soultrap", 0, {}],
    ["detect_life", "Detect Life", "Mysticism", "Novice", 60, "utility", 0, { use: "detect_life" }],
    ["dispel", "Dispel", "Mysticism", "Apprentice", 90, "utility", 0, { use: "dispel" }],
    ["mark", "Mark", "Mysticism", "Adept", 120, "utility", 0, { use: "mark" }],
    ["recall", "Recall", "Mysticism", "Adept", 160, "utility", 0, { use: "recall" }],
    ["spell_absorb", "Spell Absorption", "Mysticism", "Expert", 210, "ward", 120, {}],
    // Illusion
    ["clairvoyance", "Clairvoyance", "Illusion", "Novice", 24, "utility", 0, { use: "clairvoyance" }],
    ["courage", "Courage", "Illusion", "Novice", 48, "courage", 30, {}],
    ["muffle", "Muffle", "Illusion", "Apprentice", 59, "utility", 0, { use: "muffle" }],
    ["fear", "Fear", "Illusion", "Apprentice", 89, "fear", 4, { max_level: 9 }],
    ["rout", "Rout", "Illusion", "Adept", 170, "fear", 5, { max_level: 21 }],
    ["invisibility", "Invisibility", "Illusion", "Expert", 249, "invisibility", 0, {}],
    ["hysteria", "Hysteria", "Illusion", "Expert", 270, "fear", 6, { max_level: 30 }],
    ["harmony", "Harmony", "Illusion", "Master", 400, "calm", 0, { max_level: 40, turns: 40 }],
  ];
  for (const [id, name, school, level, cost, kind, amount, extra] of NEW) {
    D.SPELLS[id] = { name, school, cost, xp: Math.round(cost * (kind === "utility" ? 0.4 : 0.5)), kind, amount, ...extra, level };
    D.ITEMS[`tome_${id}`] = { name: `Spell Tome: ${name}`, slot: "tome", spell: id, weight: 1, value: TOME_VALUE[level] };
  }
  const levelOf = (id) => D.SPELLS[id]?.level || (typeof TOMES !== "undefined" ? TOMES.level(id) : "Novice");
  for (const id of Object.keys(D.SPELLS)) if (!D.SPELLS[id].level) D.SPELLS[id].level = levelOf(id);
  const byId = Object.fromEntries(NEW.map((r) => [r[0], r]));

  // ---- where to learn them: novice/apprentice at court wizards, adept at a few, expert and master at the College
  D.TOWN_STOCK = D.TOWN_STOCK || {};
  const addStock = (town, shop, items) => { D.TOWN_STOCK[town] = D.TOWN_STOCK[town] || {}; D.TOWN_STOCK[town][shop] = [...new Set([...(D.TOWN_STOCK[town][shop] || []), ...items])]; };
  const tomesOf = (lv) => NEW.filter((r) => r[3] === lv).map((r) => `tome_${r[0]}`);
  D.SHOP_STOCK.wizard.push("tome_candlelight", "tome_lesser_ward", "tome_bound_sword", "tome_soul_trap", "tome_raise_zombie", "tome_clairvoyance", "tome_courage", "tome_turn_lesser_undead",
    "tome_fire_rune", "tome_muffle", "soul_gem_common_empty");
  addStock("Whiterun", "wizard", ["tome_flame_cloak", "tome_detect_life", "tome_bound_battleaxe", "tome_dispel"]);         // Farengar
  addStock("Solitude", "wizard", ["tome_steadfast_ward", "tome_turn_undead", "tome_fear"]);                  // Sybille Stentor
  addStock("Windhelm", "wizard", ["tome_frost_rune", "tome_frost_cloak", "tome_reanimate_corpse"]);         // Wuunferth the Unliving
  addStock("Markarth", "wizard", ["tome_transmute", "tome_lightning_rune", "tome_revenant"]);                // Calcelmo
  addStock("Morthal", "wizard", ["tome_reanimate_corpse", "tome_revenant", "tome_detect_life"]);            // Falion
  addStock("Winterhold", "wizard", [...tomesOf("Novice"), ...tomesOf("Apprentice"), ...tomesOf("Adept"), ...tomesOf("Expert"), ...tomesOf("Master"), "soul_gem_greater_empty"]);   // the College
  D.LOOT.elite.push(["tome_flame_cloak", 0.01], ["tome_paralyze", 0.005], ["tome_revenant", 0.01], ["tome_greater_ward", 0.01], ["tome_rout", 0.008]);
  /* [Skyrim] Master spells are taught only to mages who've mastered the school (skill 90 here) */
  function canBuy(s, item) {
    const it = D.ITEMS[item]; if (it?.slot !== "tome") return null;
    const sp = D.SPELLS[it.spell];
    if (sp?.level === "Master" && G.skill(s, sp.school) < 90) return `The College only teaches ${sp.name} to someone with ${sp.school} 90 (you have ${G.skill(s, sp.school)}).`;
    return null;
  }

  // ---- soul gems: empty ones to fill with Soul Trap
  Object.assign(D.ITEMS, {
    soul_gem_common_empty: { name: "Common Soul Gem (empty)", slot: "misc", weight: 0.5, value: 75 },
    soul_gem_greater_empty: { name: "Greater Soul Gem (empty)", slot: "misc", weight: 1, value: 200 },
  });
  D.LOOT.humanoid.push(["soul_gem_common_empty", 0.03]); D.LOOT.elite.push(["soul_gem_greater_empty", 0.05]);

  // ---- staffs: weapons that cast their spell with charges ([Skyrim] names; capacity and cost per cast [OURS])
  const STAFFS = [
    ["staff_flames", "Staff of Flames", "flames", 287, "Novice"], ["staff_frostbite", "Staff of Frostbite", "frostbite", 293, "Novice"], ["staff_sparks", "Staff of Sparks", "sparks", 302, "Novice"],
    ["staff_firebolts", "Staff of Firebolts", "firebolt", 643, "Apprentice"], ["staff_ice_spikes", "Staff of Ice Spikes", "ice_spike", 691, "Apprentice"], ["staff_lightning", "Staff of Lightning Bolts", "lightning_bolt", 739, "Apprentice"],
    ["staff_fireballs", "Staff of Fireballs", "fireball", 1218, "Adept"], ["staff_zombies", "Staff of Zombies", "raise_zombie", 499, "Novice"], ["staff_turn_undead", "Staff of Turn Undead", "turn_undead", 676, "Apprentice"],
    ["staff_calming", "Staff of Calming", "calm", 664, "Apprentice"], ["staff_paralysis", "Staff of Paralysis", "paralyze", 1499, "Expert"], ["staff_courage", "Staff of Courage", "courage", 351, "Novice"],
  ];
  for (const [id, name, spell, value] of STAFFS) {
    const sp = D.SPELLS[spell], perCast = Math.max(20, Math.round(sp.cost * 0.8));
    D.ITEMS[id] = { name, slot: "weapon", skill: sp.school, hands: 2, damage: 3, weight: 8, value, staff: { spell, perCast, capacity: perCast * 15 } };
  }
  D.SHOP_STOCK.wizard.push("staff_flames", "staff_frostbite", "staff_sparks", "staff_courage");
  addStock("Winterhold", "wizard", STAFFS.map((r) => r[0]));
  addStock("Whiterun", "wizard", ["staff_firebolts"]); addStock("Windhelm", "wizard", ["staff_ice_spikes", "staff_zombies"]); addStock("Solitude", "wizard", ["staff_turn_undead", "staff_calming"]); addStock("Markarth", "wizard", ["staff_lightning"]);
  D.LOOT.elite.push(["staff_flames", 0.01], ["staff_ice_spikes", 0.006], ["staff_zombies", 0.006], ["staff_lightning", 0.005]);
  const isStaff = (it) => !!it?.staff;
  const staffCharge = (row) => row.charge ?? D.ITEMS[row.item].staff.capacity;   // staffs come full

  // ---- spell levels: casting above your skill costs more and can fizzle ([OURS] Skyrim has no fail chance; this keeps the "level" feel)
  function gap(s, id) { const sp = D.SPELLS[id]; return sp ? Math.max(0, REQ[sp.level || "Novice"] - G.skill(s, sp.school)) : 0; }
  const costMult = (s, id) => 1 + gap(s, id) / 100;
  const failChance = (s, id) => Math.min(0.4, gap(s, id) / 150);
  const DUAL_COST = 2.8, DUAL_POWER = 2.2;   // [Skyrim] dual casting: 2.8× the magicka, 2.2× the effect (with the Dual Casting perk)
  const dualable = (sp) => ["damage", "heal", "ward", "rune", "cloak", "dot", "armor", "regen", "paralyze", "bound"].includes(sp.kind);

  // ---- elements against foes ([Skyrim]: trolls, vampires, spiders and the undead hate fire; draugr shrug off frost; shock drains mages)
  const CASTERS = /mage|necro|lich|thalmor|justiciar|hagraven|conjurer|warlock|master vampire|wizard|witch|dragon priest/i;
  function elem(f, el) {
    const n = f.e.name || "", tags = f.tags;
    if (el === "fire") return /troll|vampire|spider|skeever|frost atronach|ice wraith/i.test(n) || tags.has("undead") ? 1.25 : /flame atronach|fire/i.test(n) ? 0.5 : 1;
    if (el === "frost") return /draugr|frost|ice wraith|skeleton/i.test(n) ? 0.6 : /flame atronach|fire/i.test(n) ? 1.5 : tags.has("construct") ? 0.8 : 1;
    if (el === "shock") return CASTERS.test(n) || tags.has("mage") ? 1.25 : tags.has("construct") ? 1.2 : 1;
    return 1;
  }
  const isCaster = (f) => CASTERS.test(f.e.name || "") || f.tags.has("mage") || f.tags.has("dragon");
  const flees = (f) => !f.tags.has("elite") && !f.e.boss;

  // ---- what each new kind does in a fight. f = the Fight, sp = the spell (already scaled for dual casting)
  const pot = (f, sp) => 1 + G.fxSum(f.s, "spell:" + sp.school) / 100;
  const KINDS = {
    rune(f, sp) { f.rune = { dmg: sp.amount * pot(f, sp) * (1 + (typeof PFX !== "undefined" ? PFX.sum(f.s, "spell", f, { kind: "rune" }) : 0)), el: sp.element, name: sp.name }; return `${sp.name}: a glowing rune waits on the ground`; },
    cloak(f, sp) { f.cloak = { dmg: sp.amount * pot(f, sp), el: sp.element, turns: sp.turns, name: sp.name }; return `${sp.name}: ${sp.element === "fire" ? "flames" : sp.element === "frost" ? "frost" : "lightning"} wrap around you`; },
    dot(f, sp) { f.dots = [...(f.dots || []), { dmg: sp.amount * pot(f, sp), el: sp.element, turns: sp.turns, name: sp.name }]; if (sp.element === "frost") f.slowed = Math.max(f.slowed, 2); return `${sp.name}: the ground ${sp.element === "fire" ? "bursts into flame" : sp.element === "frost" ? "freezes over" : "crackles"}`; },
    /* a ward is a shield against magic: it soaks spells, breath and enchanted blows until it breaks, turn after turn.
       Casting a ward again refills it (to the stronger of the two). [OURS: Remigiusz "a magic damage spell shield that
       persists every turn; players can recast a ward spell to regenerate that magic shield"] */
    ward(f, sp) {
      const amt = sp.amount * pot(f, sp) * (1 + (typeof PFX !== "undefined" ? PFX.num(f.s, "wardpow") : 0));
      const had = f.ward > 0 ? f.ward : 0;
      f.wardMax = Math.max(amt, had); f.ward = f.wardMax;
      return had ? `${sp.name}: your ward flares back to full (${Math.round(had)} → ${Math.round(f.ward)})` : `${sp.name}: a shimmering ward rises (${Math.round(f.ward)}). It soaks magic until it breaks`;
    },
    regen(f, sp) { f.regen = { amt: sp.amount * pot(f, sp), turns: sp.turns, name: sp.name }; return `${sp.name}: a ring of light heals you each turn`; },
    turn(f, sp) {
      if (!f.tags.has("undead")) return `${sp.name}: no effect (undead only)`;
      if (!flees(f) || (f.e.level ?? 1) > sp.max_level) return `${sp.name}: the ${f.e.name.toLowerCase()} is too strong to turn`;
      f.endWon = "turned"; return `${sp.name}: the ${f.e.name.toLowerCase()} flees in terror`;
    },
    paralyze(f, sp) {
      if (f.tags.has("dragon")) return `${sp.name}: the dragon shrugs it off`;
      if (Math.random() < (f.tags.has("elite") ? 0.6 : 0.9)) { f.eParalyzed = Math.max(f.eParalyzed, Math.round(sp.amount)); return `${sp.name}: the ${f.e.name.toLowerCase()} freezes, paralyzed`; }
      return `${sp.name}: it resists`;
    },
    fear(f, sp) {
      if (f.tags.has("undead") || f.tags.has("construct")) return `${sp.name}: no effect on the ${f.tags.has("undead") ? "undead" : "machine"}`;
      const fx = typeof PFX !== "undefined" ? PFX.sum(f.s, "fear", f, {}) : 0;   // Aspect of Terror (+6), Rage (+8)
      if ((f.e.level ?? 1) > sp.max_level + (G.P(f.s, "rage") && !fx ? 8 : fx)) return `${sp.name}: no effect (level too high)`;
      f.fearTurns = Math.round(sp.amount) + (G.P(f.s, "aspect_of_terror") ? 1 : 0); return `${sp.name}: the ${f.e.name.toLowerCase()} cowers`;
    },
    courage(f, sp) { const k = 1 + sp.amount / 100; f.allies.forEach((a) => { a.dmg *= k; }); f.summonDmg *= k; f.braveHp = sp.amount; f.hp += sp.amount / 2; return `${sp.name}: ${f.allies.length || f.summonTurns ? "your allies fight harder" : "you feel bold"}`; },
    invisibility(f, sp) { f.unseen = 2; f.sneakNext = true; return `${sp.name}: you vanish. Your next blow is a sneak attack`; },
    bound(f, sp) { f.bound = { dmg: sp.amount * (1 + (typeof PFX !== "undefined" ? PFX.sum(f.s, "bound", f, {}) : 0)), skill: sp.skill, wt: sp.wt, name: sp.name.replace("Bound ", "bound ") }; f.wt = sp.wt; return `${sp.name}: a weapon of light forms in your hand`; },
    soultrap(f, sp) { f.soulTrap = true; return `${sp.name}: a purple glow surrounds the ${f.e.name.toLowerCase()}`; },
    reanimate(f, sp) {
      f.reanimate = { max: sp.amount, fights: sp.fights, name: sp.name };
      return `${sp.name}: when it falls, it will rise for you`;
    },
    utility(f, sp) { return `${sp.name} does nothing in a fight`; },
  };
  /* before the foe acts: runes, fear, invisibility. Returns a line to show (and whether its turn is over) */
  function beforeEnemy(f) {
    let pre = "";
    if (f.rune && f.ehp > 0) { const d = f.rune.dmg * elem(f, f.rune.el); f.ehp -= d; pre = `${f.e.name} steps on your ${f.rune.name} (${Math.round(d)})` + (typeof PFX !== "undefined" ? PFX.hitFoe(f, f.rune.el, d, "spell") : ""); f.rune = null; if (f.ehp <= 0) return { text: pre, end: true }; }
    if (f.fearTurns > 0) { f.fearTurns--; return { text: (pre ? pre + " · " : "") + `${f.e.name} cowers in fear`, end: true }; }
    if (f.unseen > 0) { f.unseen--; return { text: (pre ? pre + " · " : "") + `${f.e.name} can't find you`, end: true }; }
    return pre ? { text: pre, end: false } : null;
  }
  /* each turn: cloaks, burning walls, healing circles */
  function tick(f, line) {
    if (f.ward > 0 && f.wardMax && f.ward < f.wardMax && typeof PFX !== "undefined") {   // Ward Mender: the ward knits itself back
      const r = PFX.num(f.s, "wardregen"); if (r) { const b = f.ward; f.ward = Math.min(f.wardMax, f.ward + f.wardMax * r); if (f.ward - b >= 1) line.me += ` · ward mends +${Math.round(f.ward - b)}`; }
    }
    if (f.cloak && f.ehp > 0) { const d = f.cloak.dmg * elem(f, f.cloak.el); f.ehp -= d; line.me += ` · ${f.cloak.name} ${Math.round(d)}` + (typeof PFX !== "undefined" && f.cloak.el !== "fire" ? PFX.hitFoe(f, f.cloak.el, d, "spell") : ""); if (--f.cloak.turns <= 0) f.cloak = null; }
    if (f.dots?.length && f.ehp > 0) { for (const x of f.dots) { const d = x.dmg * elem(f, x.el); f.ehp -= d; line.me += ` · ${x.name} ${Math.round(d)}`; x.turns--; } f.dots = f.dots.filter((x) => x.turns > 0); }
    if (f.regen) { const before = f.hp; f.hp = Math.min(G.maxHealth(f.s), f.hp + f.regen.amt); if (f.hp > before) { line.me += ` · +${Math.round(f.hp - before)} health`; f.addXp("Restoration", (f.hp - before) * 0.5); } if (--f.regen.turns <= 0) f.regen = null; }
  }
  /* a hit on you: wards soak up spells and dragon breath */
  function soak(f, dmg, magic) {
    if (!(f.ward > 0) || !(magic ?? isCaster(f))) return dmg;
    const used = Math.min(f.ward, dmg); f.ward -= used; f.addXp("Restoration", used * 0.3);
    if (f.ward < 0.5) { f.ward = 0; f.wardBroke = true; }
    if (used > 0 && typeof PFX !== "undefined") { const mp = PFX.sum(f.s, "wardmp", f, {}); if (mp) f.mp = Math.min(G.maxMagicka(f.s), f.mp + mp); }   // Ward Absorb
    return dmg - used;
  }
  /* after the fight: raised dead, trapped souls */
  function after(f) {
    const msgs = [], s = f.s;
    if (s._test) return msgs;
    if (f.won && f.reanimate && !f.endWon && !f.tags.has("undead") && !f.tags.has("construct") && !f.tags.has("dragon") && (f.e.level ?? 1) <= f.reanimate.max) {
      s.thrall = { name: `Risen ${f.e.name.toLowerCase()}`, dmg: Math.round(Math.max(3, f.e.damage * 0.6) * 10) / 10, fights: f.reanimate.fights };
      msgs.push(` The ${f.e.name.toLowerCase()} rises again to serve you (${f.reanimate.fights} fights).`);
    }
    if (f.won && f.soulTrap && !f.endWon && !f.tags.has("construct")) {
      const big = (f.e.level ?? 1) >= 12 || f.tags.has("elite") || f.tags.has("dragon");
      const order = big ? ["soul_gem_greater_empty", "soul_gem_common_empty"] : ["soul_gem_common_empty", "soul_gem_greater_empty"];
      const row = order.map((i) => s.inv.find((r) => r.item === i)).find(Boolean);
      if (row) {
        const full = row.item === "soul_gem_greater_empty" ? "soul_gem_greater" : "soul_gem_common";
        G.take(s, row.id); G.give(s, full);
        const my = G.useSkill(s, "Mysticism", full === "soul_gem_greater" ? 25 : 12);   // [OURS] catching a soul trains Mysticism
        msgs.push(` You trap its soul: ${D.ITEMS[full].name}.`, ...my);
      } else msgs.push(" The soul slips away: you had no empty soul gem.");
    }
    if (s.thrall && f.thrallFought) { s.thrall.fights--; if (s.thrall.fights <= 0) { msgs.push(`${s.thrall.name} crumbles to dust.`); s.thrall = null; } }
    return msgs;
  }
  /* a staff takes the place of a swing: it casts its spell if it has charge left */
  function staffAttack(f) {
    const row = G.invRow(f.s, f.weaponInv), st = f.weapon.staff;
    const charge = f.charges[f.weaponInv] ?? staffCharge(row);
    const cost = st.perCast * (1 - 0.1 * G.P(f.s, "enchanter"));
    if (charge < cost) { const d = 3 * (0.8 + Math.random() * 0.4); f.ehp -= d; return `The staff is spent. You swing it (${Math.round(d)})`; }
    f.charges[f.weaponInv] = charge - cost;
    return `${f.weapon.name}: ` + f.cast(st.spell, true);
  }

  // ---- out of fights: a short rest between casts instead of a magicka bar ([OURS])
  const COOLDOWN = 60;   // real seconds
  const outOfFight = (sp) => sp && (sp.kind === "utility" || sp.kind === "heal");
  const CD = { transmute: 300, recall: 1800 };   // Recall: once every 30 real minutes (6 in-game hours)
  const cdLeft = (s, id, t = G.now()) => Math.max(0, ((s.castAt || {})[id] || 0) + (CD[D.SPELLS[id]?.use] || COOLDOWN) - t);
  function castOut(s, id, t = G.now()) {
    const sp = D.SPELLS[id];
    if (!s.spells.includes(id)) return "You don't know that spell.";
    if (!outOfFight(sp)) return "That spell is for fights. Put it in your tactics.";
    if (s.dungeon == null && s.trip?.status === "encounter") return "Not now: you're in a fight.";
    const left = cdLeft(s, id, t); if (left > 0) return `You need ${left > 120 ? Math.ceil(left / 60) + " more minutes" : Math.ceil(left) + " s"} to gather your magicka again.`;
    if (Math.random() < failChance(s, id)) { s.castAt = { ...(s.castAt || {}), [id]: t }; return `${sp.name} fizzles. It's beyond your ${sp.school} for now.`; }
    let text;
    const hour = 3600 / G.GAME_SPEED;   // one in-game hour in real seconds
    if (sp.kind === "heal") {
      const before = G.curHealth(s, t); G.setHealth(s, before + sp.amount * 2, t);
      text = `${sp.name}: ${Math.round(before)} → ${Math.round(G.curHealth(s, t))} health.`;
    } else if (sp.use === "candlelight") {
      s.fx = [...(s.fx || []).filter((x) => x.name !== "Candlelight"), { key: "trapdodge", mag: 15, until: t + 6 * hour, name: "Candlelight" }];
      text = "Candlelight: a floating light shows you the way. Better odds against dungeon traps for 6 in-game hours.";
    } else if (sp.use === "detect_life") {
      s.fx = [...(s.fx || []).filter((x) => x.name !== "Detect Life"), { key: "hide", mag: 15, until: t + 3 * hour, name: "Detect Life" }];
      text = "Detect Life: you sense everything that breathes around you. +15% to stay hidden for 3 in-game hours.";
    } else if (sp.use === "muffle") {
      s.fx = [...(s.fx || []).filter((x) => x.name !== "Muffle"), { key: "hide", mag: 10, until: t + 6 * hour, name: "Muffle" }];
      text = "Muffle: your steps go quiet. +10% to stay hidden for 6 in-game hours.";
    } else if (sp.use === "transmute") {
      const from = s.inv.find((r) => r.item === "ore_silver") ? "ore_silver" : s.inv.find((r) => r.item === "ore_iron") ? "ore_iron" : null;
      if (!from) return "Transmute needs iron or silver ore in your pack.";
      const to = from === "ore_iron" ? "ore_silver" : "ore_gold";
      const n = Math.min(3, s.inv.filter((r) => r.item === from).reduce((a, r) => a + r.qty, 0));
      let left = n; for (const r of [...s.inv]) if (r.item === from && left > 0) { const k = Math.min(left, r.qty); G.take(s, r.id, k); left -= k; }
      G.give(s, to, n);
      text = `Transmute: ${n} ${D.ITEMS[from].name} turn${n > 1 ? "" : "s"} into ${D.ITEMS[to].name}.`;
    } else if (sp.use === "dispel") {
      const cured = typeof CURSE !== "undefined" ? CURSE.cureDisease(s) : null;
      const bad = (s.fx || []).filter((x) => x.mag < 0); s.fx = (s.fx || []).filter((x) => !(x.mag < 0));
      if (!cured && !bad.length) return "Dispel: there's nothing on you to dispel.";
      text = `Dispel: the magic unravels.${cured ? " " + cured : ""}${bad.length ? ` Gone: ${bad.map((x) => x.name).join(", ")}.` : ""}`;
    } else if (sp.use === "mark") {
      if (s.dungeon) return "Mark needs open sky. Step outside first.";
      if (s.trip?.status === "travel") return "Stand still to set a Mark.";
      s.mark = { x: s.x, y: s.y, place: s.location || null, label: s.location || (typeof ROAM !== "undefined" ? ROAM.nameFor(s, [s.x, s.y]) : "this spot") };
      text = `Mark: you fix ${s.mark.label} in your mind. Cast Recall to return here from anywhere.`;
    } else if (sp.use === "recall") {
      if (!s.mark) return "Recall needs a Mark. Cast Mark somewhere first.";
      if (s.dungeon) return "Leave the dungeon first.";
      if (s.trip?.status === "encounter") return "Not now: you're in a fight.";
      s.trip = null; s.x = s.mark.x; s.y = s.mark.y; s.location = s.mark.place;
      if (s.mark.place && !s.discovered.includes(s.mark.place)) s.discovered.push(s.mark.place);
      text = `Recall: the world folds, and you stand in ${s.mark.label} again.`;
    } else if (sp.use === "clairvoyance") {
      const q = typeof QUESTS !== "undefined" ? QUESTS.tracked(s) : null, n = q && QUESTS.target(q.st), p = n && WORLD.places[n];
      if (!p) text = "Clairvoyance: a faint trail flickers and fades. You have no quest target right now.";
      else {
        const dx = p[0] - s.x, dy = p[1] - s.y, d = G.pxDist([s.x, s.y], p);
        const dir = d < 10 ? "right here" : Math.abs(dx) > Math.abs(dy) * 2 ? (dx > 0 ? "east" : "west") : Math.abs(dy) > Math.abs(dx) * 2 ? (dy > 0 ? "south" : "north") : `${dy > 0 ? "south" : "north"}-${dx > 0 ? "east" : "west"}`;
        text = `Clairvoyance: a glowing trail leads ${dir}${d >= 10 ? `, about ${Math.round(d * 1.1 / G.speed({ ...s, trip: null }) / 60)} min away` : ""}, toward ${n}.`;
      }
    } else return sp.name;
    s.castAt = { ...(s.castAt || {}), [id]: t };
    const sk = G.useSkill(s, sp.school, sp.xp || 10);
    return text + (sk.length ? " " + sk.join(". ") : "");
  }

  // ---- plain words for the magic menu
  function describe(sp) {
    const el = sp.element === "sun" ? "sun" : sp.element || "";
    return ({
      damage: () => `${sp.amount} ${el === "sun" ? "sun damage to undead" : `${el} damage`}`,
      heal: () => `Heals ${sp.amount} health (out of fights too: ${sp.amount * 2})`,
      armor: () => `+${sp.amount} armor for the fight`,
      summon: () => `A summoned ally fights for you (${sp.amount} damage a turn)`,
      calm: () => `Stops a foe up to level ${sp.max_level} from fighting`,
      rune: () => `A trap rune: ${sp.amount} ${el} damage when the foe attacks you`,
      cloak: () => `${sp.amount} ${el} damage to the foe every turn for ${sp.turns} turns`,
      dot: () => `${sp.amount} ${el} damage every turn for ${sp.turns} turns${el === "frost" ? ", and slows" : ""}`,
      ward: () => `A magic shield that soaks ${sp.amount} damage from spells, breath and enchanted blows. It stays up turn after turn until it breaks; cast it again to refill it`,
      regen: () => `Heals ${sp.amount} health every turn for ${sp.turns} turns`,
      turn: () => `Undead up to level ${sp.max_level} flee: the fight ends, but they leave nothing behind`,
      paralyze: () => `The foe can't act for ${sp.amount} turns (dragons resist; tough foes sometimes)`,
      fear: () => `A living foe up to level ${sp.max_level} cowers for ${sp.amount} turns`,
      courage: () => `Your allies hit ${sp.amount}% harder, and you get a little health`,
      invisibility: () => "You vanish for 2 turns; your next blow is a sneak attack",
      bound: () => `A ${sp.wt === "bow" ? "bow (no arrows needed)" : sp.wt} of light: ${sp.amount} base damage, using ${sp.skill}`,
      soultrap: () => "If the foe dies, its soul fills an empty soul gem",
      reanimate: () => `A slain foe up to level ${sp.amount} rises to fight beside you for ${sp.fights} fights`,
      utility: () => ({ candlelight: "Out of fights: better odds against dungeon traps for 6 in-game hours", detect_life: "Out of fights: +15% to stay hidden for 3 in-game hours", muffle: "Out of fights: +10% to stay hidden for 6 in-game hours", transmute: "Out of fights: up to 3 iron ore → silver, or silver ore → gold", clairvoyance: "Out of fights: shows the way to your quest", dispel: "Out of fights: cures diseases and removes harmful effects", mark: "Out of fights: remember this spot", recall: "Out of fights: return to your Mark from anywhere (every 6 in-game hours)" }[sp.use]),
    }[sp.kind] || (() => ""))();
  }

  /* ---- exact numbers for the Magic menu, for this character right now (same helpers the fight uses).
     parts: [{ t: text, c: colour class }] — c is an element (fire/frost/shock/sun), heal, buff, debuff, mana or dur */
  const PXS = (s, key, x) => (typeof PFX !== "undefined" ? PFX.sum(s, key, null, x || {}) : 0);
  const R = (x) => Math.round(x);
  function wornArmor(s) { const eq = G.equipment(s) || {}; return G.ARMOR_SLOTS.map((sl) => eq[sl] && D.ITEMS[eq[sl].item]).filter(Boolean); }
  function nums(s, id, dual) {
    let sp = D.SPELLS[id]; if (!sp) return [];
    if (dual) sp = { ...sp, amount: (sp.amount || 0) * DUAL_POWER };
    const el = sp.element || "", po = 1 + G.fxSum(s, "spell:" + sp.school) / 100, P = (k) => G.P(s, k);
    const out = [], add = (t, c) => out.push({ t, c });
    switch (sp.kind) {
      case "damage": {
        const d = G.spellDamage(s, sp);
        add(`${R(d)} ${el === "sun" ? "sun damage (undead only)" : el + " damage"}`, el || "fire");
        if (el === "fire" && typeof PFX !== "undefined") { const st = PXS(s, "burn"); add(`burns ${Math.max(1, R(d * 0.15 * (1 + st) * (1 + 0.1 * P("augmented_flames"))))}/turn for ${3 + (st ? 1 : 0)} turns`, "fire"); }
        if (el === "frost") { add("slows 2 turns", "debuff"); const fz = PXS(s, "freeze"); if (fz) add(`${R(fz * 100)}% freeze solid`, "debuff"); }
        if (el === "shock") add("jolts · 30% interrupts casters", "debuff");
        if (sp.school === "Destruction" && P("impact")) add("30% stagger", "debuff");
        add(`${R(F.SPELL_HIT_CHANCE * 100)}% to hit`, "dur");
        break;
      }
      case "heal": { const h = G.spellHeal(s, sp); add(`+${R(h)} health`, "heal"); if (P("respite")) add(`+${R(h)} stamina`, "stam"); break; }
      case "armor": add(`+${R(G.spellArmor(s, sp, wornArmor(s), null))} armor for the fight`, "buff"); break;
      case "summon": { const m = G.spellSummon(s, sp, null); add(`${m.count > 1 ? "2 allies" : "an ally"}: ${R(m.dmg)} damage a turn`, "buff"); add(`${m.turns} turns`, "dur"); break; }
      case "calm": { const m = G.spellCalm(s, sp, null, null); add(`foes up to level ${m.cap} stop fighting`, "debuff"); add(`${m.turns} turns`, "dur"); break; }
      case "rune": add(`${R(sp.amount * po * (1 + PXS(s, "spell", { kind: "rune" })))} ${el} damage when the foe steps on it`, el); break;
      case "cloak": add(`${R(sp.amount * po)} ${el} damage a turn`, el); add(`${sp.turns} turns`, "dur"); break;
      case "dot": add(`${R(sp.amount * po)} ${el} damage a turn`, el); add(`${sp.turns} turns`, "dur"); if (el === "frost") add("slows", "debuff"); break;
      case "ward": add(`ward soaks ${R(sp.amount * po)} spell damage`, "buff"); break;
      case "regen": add(`+${R(sp.amount * po)} health a turn`, "heal"); add(`${sp.turns} turns`, "dur"); break;
      case "turn": add(`undead up to level ${sp.max_level} flee`, "debuff"); break;
      case "paralyze": add(`paralyzed ${R(sp.amount)} turns`, "debuff"); add("90% (60% vs tough foes) · not dragons", "dur"); break;
      case "fear": { const fx = PXS(s, "fear"); add(`living foes up to level ${sp.max_level + (P("rage") && !fx ? 8 : fx)} flee`, "debuff"); add(`${R(sp.amount) + (P("aspect_of_terror") ? 1 : 0)} turns`, "dur"); break; }
      case "courage": add(`allies +${sp.amount}% damage · you +${R(sp.amount / 2)} health`, "buff"); break;
      case "invisibility": add("unseen 2 turns · next blow is a sneak attack", "buff"); break;
      case "bound": add(`${R(sp.amount * (1 + PXS(s, "bound")))} base damage (${sp.skill})`, "buff"); break;
      case "reanimate": add(`a slain foe up to level ${sp.amount} rises`, "buff"); add(`${sp.fights} fights`, "dur"); break;
      case "soultrap": add("fills an empty soul gem if it dies", "buff"); break;
      default: { const d = describe(sp); if (d) add(d, "dur"); }
    }
    return out;
  }
  /* the cost and numbers of a spell, single and dual cast: { cost, dualCost, single, dual } */
  function info(s, id) {
    const sp = D.SPELLS[id]; if (!sp) return null;
    const utility = sp.kind === "utility";
    return { cost: utility ? null : G.spellCost(s, sp), dualCost: dualable(sp) ? R(G.dualCost(s, sp, null)) : null,
      single: nums(s, id, false), dual: dualable(sp) ? nums(s, id, true) : null, fail: failChance(s, id) };
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const partsHTML = (ps) => ps.map((p) => `<span class="nv nv-${p.c}">${esc(p.t)}</span>`).join(" · ");
  function infoHTML(s, id) {
    const i = info(s, id); if (!i) return "";
    const one = `<div class="spl-row"><b class="spl-k">Cast</b>${i.cost != null ? `<span class="nv nv-mana">${i.cost} magicka</span> · ` : ""}${partsHTML(i.single)}</div>`;
    const two = i.dual ? `<div class="spl-row"><b class="spl-k">Dual cast</b><span class="nv nv-mana">${i.dualCost} magicka</span> · ${partsHTML(i.dual)}</div>` : "";
    return `<div class="spl-info">${one}${two}</div>`;
  }
  return { nums, info, infoHTML, LEVELS, REQ, NEW, STAFFS, byId, KINDS, levelOf, canBuy, gap, costMult, failChance, DUAL_COST, DUAL_POWER, dualable, elem, isCaster, beforeEnemy, tick, soak, after,
    staffAttack, isStaff, staffCharge, outOfFight, cdLeft, castOut, describe };
})();
