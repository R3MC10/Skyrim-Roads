/* A big spellbook, like Skyrim: the rest of each school's spells from Novice to Master (plus a few of our own per
   school), and spell tomes in many more shops. General stores and alchemists in every town keep a rotating handful of
   Novice tomes; each court wizard sells Novice to Adept; the College of Winterhold's teachers sell up to Expert; Master
   spells are earned through each school's ritual at the College. Like Skyrim, higher tomes only show up once your
   skill in that school is high enough (Apprentice at 25, Adept at 50, Expert at 75), and stock turns over every two
   in-game days. New spells reuse the effects the fight engine already knows (damage, heal, armor, ward, summon,
   calm, fear, turn, courage, bound, paralyze...) plus four small new ones: heal allies, banish daedra, equilibrium
   and absorb magicka. [Skyrim] names, schools, levels and costs where the game has them, otherwise [OURS]. */
const SPELLBOOK = (() => {
  const TIERS = ["Novice", "Apprentice", "Adept", "Expert", "Master"];
  const GATE = { Novice: 0, Apprentice: 25, Adept: 50, Expert: 75, Master: 100 };   // [Skyrim] when a tier's tomes appear in shops
  const TOME_VALUE = { Novice: 50, Apprentice: 96, Adept: 340, Expert: 1200, Master: 2000 };
  const ELEMENTS = { fire: "fire", frost: "frost", shock: "shock", sun: "sun" };

  //  id                      name                       school         level         cost kind          amount extra
  const NEW = [
    // Destruction ([OURS] a few cheap starters so Novice mages have choice)
    ["cinder_spray", "Cinder Spray", "Destruction", "Novice", 18, "damage", 9, { element: "fire", ours: true }],
    ["hailstones", "Hailstones", "Destruction", "Novice", 19, "damage", 9, { element: "frost", ours: true }],
    ["static_snap", "Static Snap", "Destruction", "Novice", 21, "damage", 9, { element: "shock", ours: true }],
    ["searing_brand", "Searing Brand", "Destruction", "Apprentice", 60, "dot", 9, { element: "fire", turns: 3, ours: true }],
    ["thunderclap", "Thunderclap", "Destruction", "Adept", 120, "damage", 48, { element: "shock", ours: true }],
    // Restoration
    ["healing_hands", "Healing Hands", "Restoration", "Apprentice", 47, "healally", 30, {}],
    ["heal_other", "Heal Other", "Restoration", "Adept", 110, "healally", 75, {}],
    ["grand_heal_other", "Grand Heal Other", "Restoration", "Expert", 230, "healally", 150, { ours: true }],
    ["circle_of_protection", "Circle of Protection", "Restoration", "Adept", 200, "turn", 0, { max_level: 20 }],
    ["vampires_bane", "Vampire's Bane", "Restoration", "Expert", 240, "damage", 75, { element: "sun" }],
    ["bane_of_the_undead", "Bane of the Undead", "Restoration", "Master", 440, "turn", 0, { max_level: 40 }],
    ["soothing_light", "Soothing Light", "Restoration", "Novice", 30, "regen", 4, { turns: 4, ours: true }],
    // Alteration
    ["magelight", "Magelight", "Alteration", "Apprentice", 84, "utility", 0, { use: "magelight" }],
    ["telekinesis", "Telekinesis", "Alteration", "Apprentice", 70, "utility", 0, { use: "telekinesis" }],
    ["equilibrium", "Equilibrium", "Alteration", "Apprentice", 0, "equilibrium", 25, {}],
    ["waterbreathing", "Waterbreathing", "Alteration", "Apprentice", 99, "utility", 0, { use: "waterbreathing" }],
    ["featherweight", "Featherweight", "Alteration", "Novice", 40, "utility", 0, { use: "featherweight", ours: true }],
    ["stone_shell", "Stone Shell", "Alteration", "Adept", 160, "ward", 70, { ours: true }],
    // Conjuration
    ["bound_dagger", "Bound Dagger", "Conjuration", "Novice", 40, "bound", 7, { skill: "One-Handed", wt: "dagger" }],
    ["flaming_familiar", "Flaming Familiar", "Conjuration", "Apprentice", 85, "summon", 10, { turns: 20 }],
    ["spectral_archer", "Conjure Spectral Archer", "Conjuration", "Adept", 140, "summon", 18, { turns: 40, ours: true }],
    ["seeker", "Conjure Seeker", "Conjuration", "Expert", 230, "summon", 28, { turns: 50 }],
    ["banish_daedra", "Banish Daedra", "Conjuration", "Expert", 200, "banish", 0, { max_level: 30 }],
    ["command_daedra", "Command Daedra", "Conjuration", "Master", 380, "banish", 0, { max_level: 50, command: true }],
    // Illusion
    ["dread_whisper", "Dread Whisper", "Illusion", "Novice", 35, "fear", 2, { max_level: 5, ours: true }],
    ["soothing_song", "Soothing Song", "Illusion", "Novice", 38, "calm", 0, { max_level: 6, turns: 3, ours: true }],
    ["rally", "Rally", "Illusion", "Adept", 150, "courage", 50, {}],
    ["frenzy", "Frenzy", "Illusion", "Adept", 160, "calm", 0, { max_level: 18, turns: 4, frenzy: true }],
    ["call_to_arms", "Call to Arms", "Illusion", "Master", 400, "courage", 80, {}],
    ["mayhem", "Mayhem", "Illusion", "Master", 420, "calm", 0, { max_level: 40, turns: 6, frenzy: true }],
    // support spells: cast on a teammate in your fight (Remigiusz: "spells can be cast on allies also")
    ["flame_blade", "Flame Blade", "Destruction", "Apprentice", 70, "allyimbue", 6, { element: "fire", turns: 6, ours: true }],
    ["frost_blade", "Frost Blade", "Destruction", "Apprentice", 70, "allyimbue", 6, { element: "frost", turns: 6, ours: true }],
    ["spark_blade", "Spark Blade", "Destruction", "Apprentice", 75, "allyimbue", 6, { element: "shock", turns: 6, ours: true }],
    ["ward_of_sparks", "Ward of Sparks", "Destruction", "Adept", 140, "allythorns", 12, { element: "shock", turns: 6, ours: true }],
    ["shelter", "Shelter", "Restoration", "Apprentice", 65, "allyward", 50, { ours: true }],
    ["stoneskin_touch", "Stoneskin Touch", "Alteration", "Apprentice", 70, "allyarmor", 25, { turns: 6, ours: true }],
    ["ironskin_touch", "Ironskin Touch", "Alteration", "Expert", 200, "allyarmor", 40, { turns: 8, ours: true }],
    ["heroism", "Heroism", "Illusion", "Adept", 130, "allycourage", 50, { turns: 6, ours: true }],
    ["veil_other", "Veil Other", "Illusion", "Expert", 210, "allyunseen", 3, { ours: true }],
    ["bound_arms", "Bound Arms", "Conjuration", "Apprentice", 80, "allyimbue", 8, { turns: 8, ours: true }],
    ["guardian_spirit", "Guardian Spirit", "Conjuration", "Adept", 150, "allyward", 80, { ours: true }],
    ["soul_shield", "Soul Shield", "Mysticism", "Apprentice", 70, "allyward", 60, { reflect: 0.2, ours: true }],
    ["rescue", "Rescue", "Mysticism", "Adept", 160, "allyrescue", 30, { ours: true }],
    // Mysticism ([OURS] the school of souls and the unseen)
    ["detect_dead", "Detect Dead", "Mysticism", "Novice", 55, "utility", 0, { use: "detect_dead" }],
    ["absorb_magicka", "Absorb Magicka", "Mysticism", "Apprentice", 40, "absorb", 20, {}],
    ["reflect_spell", "Reflect Spell", "Mysticism", "Adept", 150, "ward", 90, {}],
    ["divine_intervention", "Divine Intervention", "Mysticism", "Adept", 140, "utility", 0, { use: "divine" }],
    ["soul_rend", "Soul Rend", "Mysticism", "Expert", 190, "absorb", 55, {}],
    ["mystic_bulwark", "Mystic Bulwark", "Mysticism", "Master", 380, "ward", 200, { ours: true }],
  ];
  for (const [id, name, school, level, cost, kind, amount, extra] of NEW) {
    if (D.SPELLS[id]) continue;   // never overwrite (save compatibility)
    D.SPELLS[id] = { name, school, cost, xp: Math.max(8, Math.round((cost || 30) * (kind === "utility" ? 0.4 : 0.5))), kind, amount, ...extra, level };
    D.ITEMS[`tome_${id}`] = { name: `Spell Tome: ${name}`, slot: "tome", spell: id, weight: 1, value: TOME_VALUE[level] };
  }
  // every spell gets a tome, so any of them can be sold, found or given
  for (const [id, sp] of Object.entries(D.SPELLS)) if (!sp.custom && !sp.hidden && !D.ITEMS[`tome_${id}`]) D.ITEMS[`tome_${id}`] = { name: `Spell Tome: ${sp.name}`, slot: "tome", spell: id, weight: 1, value: TOME_VALUE[sp.level || "Novice"] || 50 };
  for (const sp of Object.values(D.SPELLS)) if (!sp.level) sp.level = typeof MAGIC !== "undefined" ? MAGIC.levelOf(Object.keys(D.SPELLS).find((k) => D.SPELLS[k] === sp)) : "Novice";

  const tomeOf = (id) => `tome_${id}`;
  const spellOfTome = (item) => D.ITEMS[item]?.slot === "tome" ? D.ITEMS[item].spell : null;
  const sellable = () => Object.entries(D.SPELLS).filter(([id, sp]) => !sp.custom && !sp.hidden && D.ITEMS[tomeOf(id)]);
  const byTier = (lv) => sellable().filter(([, sp]) => (sp.level || "Novice") === lv).map(([id]) => tomeOf(id));

  // ---- who sells what ([Skyrim] names)
  const COURT = { Whiterun: "Farengar Secret-Fire", Solitude: "Sybille Stentor", Windhelm: "Wuunferth the Unliving", Riften: "Wylandriah", Markarth: "Calcelmo",
    Morthal: "Falion", Dawnstar: "Madena", "Tel Mithryn": "Neloth", Winterhold: "the College of Winterhold" };
  const GENERAL = { Whiterun: "Belethor", Riften: "the Pawned Prawn", Solitude: "Bits and Pieces", Windhelm: "Sadri's Used Wares", Markarth: "Arnleif and Sons", Falkreath: "Zaria's Grave Concoctions",
    Morthal: "Lami's Thaumaturgist's Hut", Dawnstar: "the Mortar and Pestle", Riverwood: "the Riverwood Trader", Winterhold: "Birna's Oddments", "Raven Rock": "Milore Ienth" };
  const TEACHERS = { Destruction: "Faralda", Restoration: "Colette Marence", Alteration: "Tolfdir", Conjuration: "Phinis Gestor", Illusion: "Drevis Neloren", Mysticism: "Urag gro-Shub" };
  // court wizards who weren't selling yet now have a counter
  for (const town of ["Riften", "Dawnstar"]) if (D.SHOPS[town] && !D.SHOPS[town].includes("wizard")) D.SHOPS[town].push("wizard");

  // ---- rotation: stock turns over every two in-game days, the same for every player in a town
  const DAY = () => 86400 / (G.GAME_SPEED || 12);
  const period = (t = G.now()) => Math.floor(t / (2 * DAY()));
  const nextRestock = (t = G.now()) => (period(t) + 1) * 2 * DAY() - t;
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pickN(list, n, seed) {
    const a = [...list]; let x = seed || 1;
    for (let i = a.length - 1; i > 0; i--) { x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0; const j = x % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n);
  }
  /* the tomes a shop has this period, before checking your skill */
  function rotation(town, shop, t = G.now()) {
    const seed = hash(`${town}|${shop}|${period(t)}`);
    if (shop === "general") return GENERAL[town] || (D.SHOPS[town] || []).includes("general") ? pickN(byTier("Novice"), GENERAL[town] ? 6 : 4, seed) : [];
    if (shop !== "wizard") return [];
    if (town === "Winterhold") return [...byTier("Novice"), ...byTier("Apprentice"), ...byTier("Adept"), ...byTier("Expert")];   // the College
    if (town === "Tel Mithryn") return [...byTier("Novice"), ...pickN(byTier("Apprentice"), 8, seed), ...pickN(byTier("Adept"), 6, seed + 1), ...pickN(byTier("Expert"), 3, seed + 2)];
    return [...byTier("Novice"), ...pickN(byTier("Apprentice"), 7, seed), ...pickN(byTier("Adept"), 4, seed + 1)];
  }
  /* the shop's top tier ([Skyrim] court wizards stop at Adept, the College at Expert; Master is the ritual's) */
  const shopCap = (town, shop) => shop === "general" ? (town === "Raven Rock" ? "Apprentice" : "Novice") : town === "Winterhold" || town === "Tel Mithryn" ? "Expert" : "Adept";
  const ritualDone = (s, school) => (s.rituals || {})[school] === "done";
  /* can this player see this tome on the shelf? (null = yes, otherwise why not) */
  function gateWhy(s, item, town, shop) {
    const id = spellOfTome(item); if (!id) return null;
    const sp = D.SPELLS[id], lv = sp.level || "Novice";
    if (lv === "Master") return ritualDone(s, sp.school) && town === "Winterhold" && shop === "wizard" ? null : `Master spells are taught after ${sp.school}'s ritual at the College.`;
    if (TIERS.indexOf(lv) > TIERS.indexOf(shopCap(town, shop))) return `This shop doesn't deal in ${lv} tomes.`;
    const need = GATE[lv], have = G.skill(s, sp.school);
    if (have < need) return `${lv} ${sp.school} tomes appear in shops once your ${sp.school} reaches ${need} (you have ${have}).`;
    return null;
  }
  const legacy = typeof TOMES !== "undefined" ? TOMES.stockAt : (town, shop) => D.SHOP_STOCK[shop] || [];
  /* everything a shop has: its usual goods plus this period's tomes, minus tomes you can't use yet (with s) */
  function stockAt(town, shop, s, t = G.now()) {
    const base = legacy(town, shop), all = [...new Set([...base, ...rotation(town, shop, t)])];
    if (!s) return all;
    const masters = shop === "wizard" && town === "Winterhold" ? sellable().filter(([, sp]) => sp.level === "Master" && ritualDone(s, sp.school)).map(([id]) => tomeOf(id)) : [];
    return [...new Set([...all.filter((i) => !spellOfTome(i) || !gateWhy(s, i, town, shop)), ...masters])];
  }
  const inStockAnywhere = (s, item, town, t) => (D.SHOPS[town] || []).some((shop) => stockAt(town, shop, s, t).includes(item));
  if (typeof TOMES !== "undefined") TOMES.stockAt = stockAt;

  // buying a tome: it must be on a shelf here, for you, right now
  if (typeof MAGIC !== "undefined") {
    const canBuy0 = MAGIC.canBuy;
    MAGIC.canBuy = (s, item) => {
      const no = canBuy0(s, item); if (no) return no;
      const id = spellOfTome(item); if (!id || !s || !s.location || !D.SHOPS[s.location]) return null;
      if (inStockAnywhere(s, item, s.location)) return null;
      const why = (D.SHOPS[s.location] || []).map((shop) => (legacy(s.location, shop).includes(item) || rotation(s.location, shop).includes(item)) && gateWhy(s, item, s.location, shop)).find(Boolean);
      if (why) return why;
      const sp = D.SPELLS[id], lv = sp.level || "Novice", need = GATE[lv], have = G.skill(s, sp.school);
      if (lv !== "Master" && have < need) return `${lv} ${sp.school} tomes appear in shops once your ${sp.school} reaches ${need} (you have ${have}).`;
      return `No one in ${s.location} has that tome right now. Stock changes every two in-game days.`;
    };
  }

  // ---- dungeon drops: Novice and Apprentice tomes on mages and bandits, better ones on tough foes
  for (const it of byTier("Novice")) D.LOOT.humanoid.push([it, 0.0025]);
  for (const it of byTier("Apprentice")) D.LOOT.elite.push([it, 0.004]);
  for (const it of byTier("Adept")) D.LOOT.elite.push([it, 0.0015]);

  // ---- new fight effects
  const DAEDRA = /dremora|atronach|daedr|scamp|xivilai|seeker|lurker|storm atronach|flame atronach|frost atronach|mehrunes/i;
  const isDaedra = (f) => DAEDRA.test(f.e.name || "") || f.tags.has("daedra");
  if (typeof MAGIC !== "undefined") Object.assign(MAGIC.KINDS, {
    banish(f, sp) {
      if (!isDaedra(f)) return `${sp.name}: no effect (daedra only)`;
      if (f.e.boss || (f.e.level ?? 1) > sp.max_level + pf(f.s, "banishlvl", f)) return `${sp.name}: the ${f.e.name.toLowerCase()} is too strong`;
      if (sp.command) { f.calmTurns = Math.max(f.calmTurns || 0, 6); f.summonTurns = Math.max(f.summonTurns || 0, 6); f.summonDmg = Math.max(f.summonDmg || 0, (f.e.damage || 10) * 0.8); return `${sp.name}: the ${f.e.name.toLowerCase()} turns and fights for you`; }
      f.endWon = "banished"; return `${sp.name}: the ${f.e.name.toLowerCase()} is sent back to Oblivion`;
    },
    equilibrium(f, sp) {
      const take = Math.min(sp.amount, Math.max(0, f.hp - 10)); if (take <= 0) return `${sp.name}: you're too hurt to spare health`;
      f.hp -= take; const before = f.mp; f.mp = Math.min(G.maxMagicka(f.s), f.mp + take); return `${sp.name}: ${Math.round(take)} health becomes ${Math.round(f.mp - before)} magicka`;
    },
    absorb(f, sp) {
      const d = sp.amount * (1 + G.fxSum(f.s, "spell:" + sp.school) / 100) * (isCasterFoe(f) ? 1.3 : 1);
      f.ehp -= d; const before = f.mp; f.mp = Math.min(G.maxMagicka(f.s), f.mp + d * 0.6 * (1 + pf(f.s, "absorbmp", f)));
      return `${sp.name}: ${Math.round(d)}, and you drink ${Math.round(f.mp - before)} magicka`;
    },
  });
  // ---- perks for the new spells ([OURS] unless marked; perk trees grow with the game). Effects read below.
  const PERK_ADD = [
    ["Destruction", "storm_walls", "Storm Walls", 1, [70], ["rune_master"], "Walls, Blizzard and Searing Brand burn 25% harder every turn. [OURS: Skyrim's walls grow with Rune Master]", [["spell", 0.25, { kind: "dot" }]]],
    ["Restoration", "guardians_light", "Guardian's Light", 1, [40], ["regeneration"], "Turn, Circle and Bane spells work on undead 8 levels higher, and Guardian Circle also heals your allies. [OURS]", [["turnlvl", 8, {}], ["circleallies", 1, {}]]],
    ["Alteration", "stone_within", "Stone Within", 1, [60], ["mage_armor"], "Alteration wards like Stone Shell are 40% stronger, and with no armor on your flesh spells (Oakflesh to Dragonhide) are another 10% stronger. [OURS]", [["altward", 0.4, {}], ["armorspell", 0.1, { bare: 1 }]]],
    ["Conjuration", "oblivion_binding", "Oblivion Binding", 1, [80], ["summoner"], "Banish and Command Daedra work on daedra 10 levels higher, and summons stay 3 turns longer. [Skyrim]", [["banishlvl", 10, {}], ["summonturns", 3, {}]]],
    ["Illusion", "voice_of_command", "Voice of Command", 1, [60], ["kindred_mage"], "Courage, Rally and Call to Arms are 30% stronger. [OURS]", [["courage", 0.3, {}]]],
    // the Support branch of every school: helping teammates (party members, followers, summons) in your fight
    ["Destruction", "kindle_ally", "Kindle Ally", 1, [40], ["augmented_flames"], "Flame, Frost and Spark Blade on an ally do 50% more. [OURS · Support]", [["imbue", 0.5, { school: "Destruction" }]]],
    ["Destruction", "searing_aegis", "Searing Aegis", 1, [60], ["kindle_ally"], "Ward of Sparks hurts attackers 50% more and lasts 2 turns longer. [OURS · Support]", [["thorns", 0.5, {}], ["thornsturns", 2, {}]]],
    ["Restoration", "selfless_healer", "Selfless Healer", 1, [30], ["regeneration"], "Healing spells cast on others heal 50% more. [OURS · Support, after Skyrim's Benefactor, for others]", [["healally", 0.5, {}]]],
    ["Restoration", "ward_bearer", "Ward Bearer", 1, [50], ["selfless_healer"], "Wards you put on allies (Shelter, Guardian Spirit, Soul Shield) are 50% stronger. [OURS · Support]", [["allyward", 0.5, {}]]],
    ["Alteration", "shieldbearer", "Shieldbearer", 1, [40], ["mage_armor"], "Stoneskin and Ironskin Touch last 3 turns longer and stop another 10% of the damage. [OURS · Support]", [["allyarmorturns", 3, {}], ["allyarmor", 10, {}]]],
    ["Illusion", "inspiring_presence", "Inspiring Presence", 1, [30], ["animage"], "Heroism on an ally gives another 25% damage, and Courage spells heal allies a little. [OURS · Support]", [["allycourage", 25, {}], ["courageheal", 10, {}]]],
    ["Conjuration", "summoners_bond", "Summoner's Bond", 1, [40], ["summoner"], "While your summon fights, your allies take 15% less damage: it steps in to guard them. [OURS · Support]", [["bond", 0.15, {}]]],
    ["Conjuration", "bound_brothers", "Bound Brothers", 1, [50], ["soul_stealer"], "Bound Arms on an ally do 50% more. [OURS · Support]", [["imbue", 0.5, { school: "Conjuration" }]]],
    ["Mysticism", "spirit_link", "Spirit Link", 1, [30], ["spell_absorption"], "A quarter of every blow aimed at an ally is taken by you instead. [OURS · Support]", [["spiritlink", 0.25, {}]]],
    ["Mysticism", "soul_tether", "Soul Tether", 1, [60], ["spirit_link"], "Rescue brings a downed ally back with twice the health. [OURS · Support]", [["rescue", 1, {}]]],
    ["Mysticism", "magicka_siphon", "Magicka Siphon", 1, [40], ["spell_absorption"], "Absorb Magicka and Soul Rend give back 50% more magicka. [OURS]", [["absorbmp", 0.5, {}]]],
  ];
  if (typeof PERKS !== "undefined" && typeof PFX !== "undefined") for (const [sk, id, name, ranks, req, needs, desc, fx] of PERK_ADD) {
    const tree = PERKS.TREES[sk]; if (!tree || PERKS.BY_ID[id] || !needs.every((n) => PERKS.BY_ID[n])) continue;
    tree.push([id, name, ranks, req, needs, desc]); PERKS.BY_ID[id] = { id, name, ranks, req, needs, desc, skill: sk }; PFX.FX[id] = fx;
  }
  const pf = (s, key, f, x = {}) => (typeof PFX !== "undefined" ? PFX.sum(s, key, f, x) : 0);
  if (typeof MAGIC !== "undefined") {
    const K = MAGIC.KINDS, turn0 = K.turn, dot0 = K.dot, ward0 = K.ward, courage0 = K.courage;
    K.turn = (f, sp) => turn0(f, { ...sp, max_level: (sp.max_level || 0) + pf(f.s, "turnlvl", f) });
    K.dot = (f, sp) => dot0(f, { ...sp, amount: sp.amount * (1 + pf(f.s, "spell", f, { kind: "dot" })) });
    K.ward = (f, sp) => ward0(f, sp.school === "Alteration" ? { ...sp, amount: sp.amount * (1 + pf(f.s, "altward", f)) } : sp);
    K.courage = (f, sp) => courage0(f, { ...sp, amount: sp.amount * (1 + pf(f.s, "courage", f)) });
  }
  // ---- casting on allies: who gets it, what it does, and how allies carry it
  const SUPPORT = new Set(["healally", "allyward", "allyarmor", "allyimbue", "allycourage", "allyunseen", "allyrescue", "allythorns"]);
  const maxOf = (al) => (al._max = Math.max(al._max || 0, al.maxHp || 0, al.hp || 0, 60));
  const ratio = (al) => al.hp == null ? 1 : al.hp / maxOf(al);
  /* the best teammate for this kind of spell (null if no one fits) */
  function pickAlly(f, kind) {
    const t = f.tbTarget;   // [OURS] the fight screen: you dragged the spell onto this teammate (tbfight.js)
    if (t && (kind === "allyrescue" ? (f._downed || []).includes(t) : (f.allies || []).includes(t) && !t.down)) return t;
    if (kind === "allyrescue") return (f._downed || [])[0] || null;
    const live = (f.allies || []).filter((a) => !a.down);
    const hurt = (list) => list.filter((a) => a.hp != null).sort((a, b) => ratio(a) - ratio(b))[0] || null;
    if (kind === "healally") { const a = hurt(live); return a && ratio(a) < 0.95 ? a : null; }
    if (kind === "allyward") return hurt(live.filter((a) => !(a.ward > 0)));
    if (kind === "allyarmor") return hurt(live.filter((a) => !(a.armorT > 0)));
    if (kind === "allyunseen") return hurt(live.filter((a) => !(a.unseen > 0)));
    if (kind === "allythorns") return hurt(live.filter((a) => !(a.thorns?.turns > 0)));
    const best = (list) => list.filter((a) => (a.dmg || 0) > 0).sort((a, b) => b.dmg - a.dmg)[0] || null;
    if (kind === "allyimbue") return best(live.filter((a) => !(a.imbue?.turns > 0)));
    if (kind === "allycourage") return best(live.filter((a) => !(a.heroT > 0)));
    return null;
  }
  const elName = (el) => ({ fire: "flaming", frost: "freezing", shock: "crackling" }[el] || "glowing");
  if (typeof MAGIC !== "undefined") Object.assign(MAGIC.KINDS, {
    healally(f, sp) {
      const al = pickAlly(f, "healally"), k = (1 + G.fxSum(f.s, "spell:Restoration") / 100) * (1 + pf(f.s, "healally", f));
      if (!al) {   // no one else to heal: it mends you a little, or renews your summon
        if (f.summonTurns > 0) { f.summonTurns += 2; return `${sp.name}: your summon is renewed (+2 turns)`; }
        const before = f.hp; f.hp = Math.min(G.maxHealth(f.s), f.hp + sp.amount * k * 0.4); return `${sp.name}: no one else to heal, it mends you a little (+${Math.round(f.hp - before)})`;
      }
      const before = al.hp; al.hp = Math.min(maxOf(al), al.hp + sp.amount * k);
      return `${sp.name} → ${al.name}: +${Math.round(al.hp - before)} health`;
    },
    allyward(f, sp) {
      const al = pickAlly(f, "allyward"); if (!al) return `${sp.name}: no ally to shield`;
      al.ward = sp.amount * (1 + G.fxSum(f.s, "spell:" + sp.school) / 100) * (1 + pf(f.s, "allyward", f)); al.reflect = sp.reflect || 0;
      return `${sp.name} → ${al.name}: a ward of ${Math.round(al.ward)}`;
    },
    allyarmor(f, sp) {
      const al = pickAlly(f, "allyarmor"); if (!al) return `${sp.name}: no ally to protect`;
      al.armorRed = Math.min(0.7, (sp.amount + pf(f.s, "allyarmor", f)) / 100); al.armorT = (sp.turns || 6) + pf(f.s, "allyarmorturns", f);
      return `${sp.name} → ${al.name}: skin like stone (−${Math.round(al.armorRed * 100)}% damage, ${al.armorT} turns)`;
    },
    allyimbue(f, sp) {
      const al = pickAlly(f, "allyimbue"); if (!al) return `${sp.name}: no ally to arm`;
      al.imbue = { dmg: sp.amount * (1 + pf(f.s, "imbue", f, { school: sp.school })) * (1 + G.fxSum(f.s, "spell:" + sp.school) / 100), el: sp.element, turns: sp.turns || 6, name: sp.element ? `${elName(sp.element)} blade` : "bound blade" };
      return `${sp.name} → ${al.name}: their weapon ${sp.element ? `wreathes in ${sp.element}` : "is joined by a blade of light"}`;
    },
    allythorns(f, sp) {
      const al = pickAlly(f, "allythorns"); if (!al) return `${sp.name}: no ally to ward`;
      al.thorns = { dmg: sp.amount * (1 + pf(f.s, "thorns", f)), el: sp.element, turns: (sp.turns || 6) + pf(f.s, "thornsturns", f) };
      return `${sp.name} → ${al.name}: sparks crackle around them`;
    },
    allycourage(f, sp) {
      const al = pickAlly(f, "allycourage"); if (!al) return `${sp.name}: no ally to inspire`;
      const m = 1 + (sp.amount + pf(f.s, "allycourage", f)) / 100; al._baseDmg = al._baseDmg || al.dmg; al.dmg = al._baseDmg * m; al.heroT = sp.turns || 6;
      return `${sp.name} → ${al.name}: they fight like a hero (+${Math.round((m - 1) * 100)}% damage)`;
    },
    allyunseen(f, sp) {
      const al = pickAlly(f, "allyunseen"); if (!al) return `${sp.name}: no ally to hide`;
      al.unseen = sp.amount || 3; return `${sp.name} → ${al.name}: they fade from sight (${al.unseen} turns)`;
    },
    allyrescue(f, sp) {
      const al = pickAlly(f, "allyrescue"); if (!al) return `${sp.name}: no one is down`;
      f._downed = f._downed.filter((a) => a !== al);
      al.down = false; al.hp = Math.round(maxOf(al) * (sp.amount / 100) * (1 + pf(f.s, "rescue", f))); f.allies.push(al); if (f.followerDown === al.name) f.followerDown = null;
      return `${sp.name} → ${al.name}: pulled back from the brink (${al.hp} health)`;
    },
  });
  /* a blow lands on an ally: their wards, stoneskin, veils and your perks soften it. Returns the damage they take. */
  function allyTakes(f, al, d) {
    if (!(d > 0)) return d;
    if (al.unseen > 0) { f._allyNotes = (f._allyNotes || "") + ` · ${al.name} is veiled: the blow misses`; return 0; }
    if (al.armorRed) d *= 1 - al.armorRed;
    if (f.summonTurns > 0) d *= 1 - pf(f.s, "bond", f);
    const link = pf(f.s, "spiritlink", f); if (link) { const sh = d * link; d -= sh; f.hp = Math.max(1, f.hp - sh); }
    if (al.ward > 0) {
      const used = Math.min(al.ward, d); al.ward -= used; d -= used;
      if (al.reflect && f.ehp > 0) { const r = used * al.reflect; f.ehp -= r; f._allyNotes = (f._allyNotes || "") + ` · ${al.name}'s shield throws back ${Math.round(r)}`; }
    }
    if (al.thorns?.turns > 0 && f.ehp > 0) { const t = al.thorns.dmg * (typeof MAGIC !== "undefined" ? MAGIC.elem(f, al.thorns.el) : 1); f.ehp -= t; f._allyNotes = (f._allyNotes || "") + ` · sparks bite the ${f.e.name.toLowerCase()} (${Math.round(t)})`; }
    if (al.hp != null && al.hp - d <= 0 && !(f._downed || []).includes(al)) f._downed = [...(f._downed || []), al];
    return d;
  }
  /* each turn: allies' imbued weapons strike, buffs run down, circles heal everyone */
  function allyTick(f, line) {
    if (f._allyNotes) { line.me += f._allyNotes; f._allyNotes = ""; }
    for (const al of f.allies || []) {
      if (al.down) continue;
      if (al.imbue?.turns > 0 && f.ehp > 0) { const d = al.imbue.dmg * (typeof MAGIC !== "undefined" && al.imbue.el ? MAGIC.elem(f, al.imbue.el) : 1); f.ehp -= d; line.me += ` · ${al.name}'s ${al.imbue.name} ${Math.round(d)}`; if (typeof PFX !== "undefined" && al.imbue.el) line.me += PFX.hitFoe(f, al.imbue.el, d, "weapon"); al.imbue.turns--; }
      if (al.thorns?.turns > 0) al.thorns.turns--;
      if (al.armorT > 0 && --al.armorT <= 0) al.armorRed = 0;
      if (al.heroT > 0 && --al.heroT <= 0 && al._baseDmg) al.dmg = al._baseDmg;
      if (al.unseen > 0) al.unseen--;
      if (f.regen && al.hp != null && pf(f.s, "circleallies", f)) al.hp = Math.min(maxOf(al), al.hp + f.regen.amt * 0.5);
    }
  }
  if (typeof MAGIC !== "undefined") {
    const tick0 = MAGIC.tick; MAGIC.tick = (f, line) => { tick0(f, line); allyTick(f, line); };
    const courage1 = MAGIC.KINDS.courage;
    MAGIC.KINDS.courage = (f, sp) => { const r = courage1(f, sp), h = pf(f.s, "courageheal", f); if (h) for (const a of f.allies) if (a.hp != null) a.hp = Math.min(maxOf(a), a.hp + h); return r; };
  }
  // custom tactics can aim support spells too: "an ally is below X% health", "an ally is down"
  if (D.CONDITIONS) {
    D.CONDITIONS.ally_hp_below = ["An ally's health is below", true];
    D.CONDITIONS.ally_down = ["An ally is knocked down", false];
  }
  const condAlly = (f, r) => r.if === "ally_hp_below" ? (f.allies || []).some((a) => a.hp != null && !a.down && ratio(a) * 100 < (r.pct ?? 50)) : r.if === "ally_down" ? (f._downed || []).length > 0 : null;
  /* Smart AI: how much a support spell is worth right now (combatai.js asks) */
  function aiValue(f, p, sp, ok, mpV) {
    const al = pickAlly(f, sp.kind); if (!al) return { v: -1 };
    const r = ratio(al), dps = Math.max(1, p.dps || 1);
    const live = (al.dmg || 0) > 0;
    let v = 0, why = "";
    switch (sp.kind) {
      case "healally": v = Math.min(sp.amount, maxOf(al) - al.hp) / maxOf(al) * (r < 0.4 ? 3 : 1.5); why = `heals ${al.name}`; break;
      case "allyward": case "allyarmor": v = r < 0.5 ? 0.9 : r < 0.8 ? 0.45 : 0.15; why = `shields ${al.name}`; break;
      case "allyunseen": v = r < 0.35 ? 1.1 : 0.1; why = `hides ${al.name}`; break;
      case "allyrescue": v = 1.4; why = `rescues ${al.name}`; break;
      case "allyimbue": v = live ? sp.amount * Math.min(sp.turns || 6, (p.Tk || 4) + 1) / dps * 0.85 : -1; why = `arms ${al.name}`; break;
      case "allycourage": v = live ? al.dmg * (sp.amount / 100) * Math.min(sp.turns || 6, (p.Tk || 4) + 1) / dps * 0.85 : -1; why = `inspires ${al.name}`; break;
      case "allythorns": v = sp.amount * Math.min(sp.turns || 6, (p.Tk || 4)) * 0.4 / dps; why = `wards ${al.name}`; break;
    }
    return v > 0 ? { v: v * ok - mpV, why } : { v: -1 };
  }
  const isCasterFoe = (f) => typeof MAGIC !== "undefined" ? MAGIC.isCaster(f) : false;
  if (typeof MAGIC !== "undefined") {
    const dual0 = MAGIC.dualable;
    MAGIC.dualable = (sp) => dual0(sp) || ["healally", "absorb", "allyward", "allyimbue", "allythorns"].includes(sp.kind);
    const describe0 = MAGIC.describe;
    MAGIC.describe = (sp) => ({
      healally: () => `Cast on the most hurt teammate: heals ${sp.amount} health (alone, it mends you a little or renews your summon)`,
      allyward: () => `Cast on a teammate: a ward that soaks ${sp.amount} damage${sp.reflect ? ` and throws ${Math.round(sp.reflect * 100)}% back` : ""}`,
      allyarmor: () => `Cast on a teammate: they take ${sp.amount}% less damage for ${sp.turns} turns`,
      allyimbue: () => `Cast on your strongest teammate: their weapon adds ${sp.amount} ${sp.element || "bound"} damage a turn for ${sp.turns} turns`,
      allythorns: () => `Cast on a teammate: foes that hit them take ${sp.amount} ${sp.element} damage, ${sp.turns} turns`,
      allycourage: () => `Cast on your strongest teammate: +${sp.amount}% damage for ${sp.turns} turns`,
      allyunseen: () => `Cast on a teammate: blows miss them for ${sp.amount} turns`,
      allyrescue: () => `Brings a knocked-down teammate back into the fight with ${sp.amount}% health`,
      banish: () => sp.command ? `A daedra up to level ${sp.max_level} turns and fights for you for 6 turns` : `Sends a daedra up to level ${sp.max_level} back to Oblivion: the fight ends`,
      equilibrium: () => `Turns ${sp.amount} health into ${sp.amount} magicka`,
      absorb: () => `${sp.amount} damage that you drink back as magicka (more against mages)`,
      utility: () => ({ magelight: "Out of fights: a bright orb, much better odds against dungeon traps for 6 in-game hours", telekinesis: "Out of fights: pull things to you: +40 carry weight for 2 in-game hours",
        waterbreathing: "Out of fights: breathe underwater; cold water won't chill you (+warmth for 3 in-game hours)", featherweight: "Out of fights: +30 carry weight for 3 in-game hours",
        detect_dead: "Out of fights: sense the undead around you: +10% to stay hidden and better odds against traps for 3 in-game hours", divine: "Out of fights: the gods carry you to the nearest temple city" }[sp.use]) || describe0(sp),
    }[sp.kind] || (() => describe0(sp)))();
    // out of fights: the new utility spells
    const castOut0 = MAGIC.castOut;
    MAGIC.castOut = (s, id, t = G.now()) => {
      const sp = D.SPELLS[id];
      const mine = sp && sp.kind === "utility" && ["magelight", "telekinesis", "waterbreathing", "featherweight", "detect_dead", "divine"].includes(sp.use);
      if (!mine) return castOut0(s, id, t);
      if (!s.spells.includes(id)) return "You don't know that spell.";
      if (s.dungeon == null && s.trip?.status === "encounter") return "Not now: you're in a fight.";
      const left = MAGIC.cdLeft(s, id, t); if (left > 0) return `You need ${left > 120 ? Math.ceil(left / 60) + " more minutes" : Math.ceil(left) + " s"} to gather your magicka again.`;
      if (Math.random() < MAGIC.failChance(s, id)) { s.castAt = { ...(s.castAt || {}), [id]: t }; return `${sp.name} fizzles. It's beyond your ${sp.school} for now.`; }
      const hour = 3600 / G.GAME_SPEED, add = (fx) => { s.fx = [...(s.fx || []).filter((x) => x.name !== fx.name), fx]; };
      let text;
      if (sp.use === "magelight") { add({ key: "trapdodge", mag: 25, until: t + 6 * hour, name: "Magelight" }); text = "Magelight: a bright orb hangs over you. Much better odds against dungeon traps for 6 in-game hours."; }
      else if (sp.use === "telekinesis") { add({ key: "carry", mag: 40, until: t + 2 * hour, name: "Telekinesis" }); text = "Telekinesis: heavy things float along beside you. +40 carry weight for 2 in-game hours."; }
      else if (sp.use === "featherweight") { add({ key: "carry", mag: 30, until: t + 3 * hour, name: "Featherweight" }); text = "Featherweight: your pack feels light. +30 carry weight for 3 in-game hours."; }
      else if (sp.use === "waterbreathing") { add({ key: "warmth", mag: 30, until: t + 3 * hour, name: "Waterbreathing" }); text = "Waterbreathing: cold water can't touch you. Rivers and coasts won't chill you for 3 in-game hours."; }
      else if (sp.use === "detect_dead") { add({ key: "hide", mag: 10, until: t + 3 * hour, name: "Detect Dead" }); add({ key: "trapdodge", mag: 8, until: t + 3 * hour, name: "Detect Dead (traps)" }); text = "Detect Dead: the restless dead glow red in your sight. +10% to stay hidden and better odds against traps for 3 in-game hours."; }
      else if (sp.use === "divine") {
        if (s.dungeon) return "Leave the dungeon first.";
        if (s.trip?.status === "encounter") return "Not now: you're in a fight.";
        const cities = ["Whiterun", "Solitude", "Windhelm", "Riften", "Markarth"].filter((c) => WORLD.places[c]);
        const near = cities.map((c) => [c, G.pxDist([s.x, s.y], WORLD.places[c])]).sort((a, b) => a[1] - b[1])[0];
        if (!near) return "Divine Intervention: nothing answers.";
        s.trip = null; [s.x, s.y] = WORLD.places[near[0]]; s.location = near[0]; if (!s.discovered.includes(near[0])) s.discovered.push(near[0]);
        text = `Divine Intervention: a column of light, and you stand in ${near[0]}.`;
      }
      s.castAt = { ...(s.castAt || {}), [id]: t };
      const sk = G.useSkill(s, sp.school, sp.xp || 10);
      return text + (sk.length ? " " + sk.join(". ") : "");
    };
    const cd0 = MAGIC.cdLeft;
    MAGIC.cdLeft = (s, id, t = G.now()) => D.SPELLS[id]?.use === "divine" ? Math.max(0, ((s.castAt || {})[id] || 0) + 1800 - t) : cd0(s, id, t);
  }

  // ---- Master rituals at the College ([Skyrim] each school's teacher sets a trial once you've mastered it)
  const RITUAL_SKILL = 90, RITUAL_CASTS = 3, RITUAL_LEVEL = 15;
  function ritualState(s, school) { const r = (s.rituals || {})[school]; return r === "done" ? "done" : r === "active" ? "active" : G.skill(s, school) >= RITUAL_SKILL ? "offered" : "locked"; }
  function startRitual(s, school) {
    if (!TEACHERS[school]) return "No such school.";
    if (s.location !== "Winterhold") return "The rituals are set at the College of Winterhold.";
    const st = ritualState(s, school);
    if (st === "locked") return `${TEACHERS[school]}: "Come back when your ${school} reaches ${RITUAL_SKILL}."`;
    if (st !== "offered") return st === "done" ? "You've already passed that ritual." : "Your ritual is already under way.";
    s.rituals = { ...(s.rituals || {}), [school]: "active" };
    return `${TEACHERS[school]}: "Prove your mastery. Win a real fight (a foe of level ${RITUAL_LEVEL} or more) using ${school} magic at least ${RITUAL_CASTS} times, then the Master tomes are yours."`;
  }
  /* after a fight: did it pass someone's ritual? */
  function ritualAfter(f) {
    const s = f.s, out = [];
    if (s._test === true || !s.rituals || !f.won || f.endWon) return out;
    if ((f.e.level ?? 1) < RITUAL_LEVEL) return out;
    for (const [school, st] of Object.entries(s.rituals)) {
      if (st !== "active") continue;
      const names = (s.spells || []).map((id) => D.SPELLS[id]).filter((sp) => sp && sp.school === school).map((sp) => sp.name);
      const casts = f.log.filter((l) => names.some((n) => String(l.me || "").startsWith(n))).length;
      if (casts < RITUAL_CASTS) continue;
      s.rituals[school] = "done";
      const master = sellable().find(([id, sp]) => sp.level === "Master" && sp.school === school && !s.spells.includes(id));
      if (master) G.give(s, tomeOf(master[0]));
      out.push(`🎓 Ritual passed: you are a Master of ${school}.${master ? ` ${TEACHERS[school]} sends you ${D.SPELLS[master[0]].name}'s tome; the other Master tomes are now for sale at the College.` : ""}`);
    }
    return out;
  }
  if (typeof MAGIC !== "undefined") { const after0 = MAGIC.after; MAGIC.after = (f) => [...after0(f), ...ritualAfter(f)]; }

  // ---- shop note: who's selling, what tier, and when the shelves change
  function shopNote(s, town, shop) {
    const who = shop === "wizard" ? COURT[town] : GENERAL[town];
    const cap = shopCap(town, shop), mins = Math.ceil(nextRestock() * G.GAME_SPEED / 3600);
    const tomes = stockAt(town, shop, s).filter(spellOfTome).length;
    if (!tomes && shop !== "wizard") return "";
    const hidden = rotation(town, shop).filter((i) => spellOfTome(i) && gateWhy(s, i, town, shop) && !gateWhy({ ...s, skills: Object.fromEntries(Object.keys(s.skills).map((k) => [k, { ...s.skills[k], lvl: 100 }])) }, i, town, shop)).length;
    return `<p class="sub sb-note">📜 ${who ? `<b>${esc(who)}</b> sells ` : "Sells "}${tomes} spell tome${tomes === 1 ? "" : "s"} (up to ${cap}). New stock in about ${mins} in-game hour${mins === 1 ? "" : "s"}.${hidden ? ` ${hidden} more appear as your schools grow (Apprentice at 25, Adept 50, Expert 75).` : ""}</p>`;
  }
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function ritualHTML(s) {
    if (s.location !== "Winterhold") return "";
    const rows = Object.keys(TEACHERS).map((school) => {
      const st = ritualState(s, school);
      const right = st === "done" ? '<span class="sb-done">Master ✓</span>' : st === "active" ? '<span class="sb-way">Under way: win a fight vs level ' + RITUAL_LEVEL + "+ casting " + school + " " + RITUAL_CASTS + "×</span>" : st === "offered" ? `<button class="btn sm" data-act="sbritual" data-id="${school}">Begin ritual</button>` : `<span class="sub">${school} ${G.skill(s, school)}/${RITUAL_SKILL}</span>`;
      return `<div class="item sb-rit sch-${school.toLowerCase()}"><div class="t">${esc(TEACHERS[school])}<span>${school} Master ritual</span></div>${right}</div>`;
    }).join("");
    return `<div class="sb-rituals"><h3>Master rituals</h3><p class="sub">At ${school90()} in a school its teacher sets a trial. Pass it to learn that school's Master spells.</p>${rows}</div>`;
  }
  const school90 = () => `skill ${RITUAL_SKILL}`;

  // ---- counts, for the menu and tests
  function counts() {
    const out = {};
    for (const [, sp] of Object.entries(D.SPELLS)) { if (sp.custom || sp.hidden) continue; const sc = sp.school, lv = sp.level || "Novice"; out[sc] = out[sc] || {}; out[sc][lv] = (out[sc][lv] || 0) + 1; }
    return out;
  }
  return { SUPPORT, condAlly, pickAlly, allyTakes, allyTick, aiValue, NEW, TIERS, GATE, COURT, GENERAL, TEACHERS, ELEMENTS, period, nextRestock, rotation, shopCap, gateWhy, stockAt, inStockAnywhere, isDaedra,
    ritualState, startRitual, ritualAfter, ritualHTML, shopNote, counts, RITUAL_SKILL, RITUAL_CASTS, RITUAL_LEVEL };
})();
