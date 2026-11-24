/* Enchanting ([Skyrim] the arcane enchanter): break an enchanted item down to learn its effect, then put that effect
   on your own weapon, armor, ring or amulet with a filled soul gem. Weapon effects use the charge system already in
   the game; worn effects work all the time while worn. Strength: [OURS] Skyrim-like scaling by soul size and
   Enchanting skill. Every effect below changes a real number in the game (tests/test_enchfx.js checks each one). */
const ENCH = (() => {
  /* weapon effects: [name, max magnitude, base cost, kind, item-name suffix, what it does ({m} = magnitude)]
     kind: dmg = extra damage on a hit; the rest are special (see onHit) */
  const WEAPON = {
    fire: ["Fire", 30, 11, "dmg", "Fire", "{m} fire damage on a hit, and it may set them burning."],
    frost: ["Frost", 30, 12, "dmg", "Frost", "{m} frost damage on a hit; it chills and slows them."],
    shock: ["Shock", 30, 14, "dmg", "Shock", "{m} shock damage on a hit; it jolts casters."],
    absorb: ["Absorb Health", 25, 31, "dmg", "Absorb Health", "{m} damage on a hit, and you heal that much."],
    absorb_stamina: ["Absorb Stamina", 25, 18, "sp", "Exhaustion", "Each hit takes {m} stamina from them and gives it to you (and does a third of that as damage)."],
    absorb_magicka: ["Absorb Magicka", 25, 18, "mp", "Siphoning", "Each hit takes {m} magicka from them and gives it to you (and does a third of that as damage)."],
    paralyze: ["Paralyze", 20, 40, "para", "Paralysis", "{m}% chance a hit paralyzes them for a turn. Bosses and dragons shrug it off, and it needs a short rest between."],
    fear: ["Fear", 25, 30, "fear", "Fear", "{m}% chance a hit sends a living foe (not much above your level, not a boss) cowering for a turn."],
    calm: ["Calm", 25, 30, "calm", "Peace", "{m}% chance a hit calms a person or beast (not much above your level, not a boss) for 2 turns."],
    soul_trap: ["Soul Trap", 5, 15, "soul", "Souls", "If they die, their soul fills one of your empty soul gems."],
    turn_undead: ["Turn Undead", 30, 20, "undead", "Sun", "{m} extra damage to the undead, and a 15% chance they flee in fear for a turn."],
    bleed: ["Bleeding", 10, 16, "bleed", "Bleeding", "Wounds bleed for {m} a turn for 3 turns."],
  };
  /* worn effects: [name, key it adds to, magnitude at full strength, slots it fits, cap when several are worn,
     perk class (corpus / ward / armor), item-name suffix, what it does ({m} = magnitude)]
     keys: the engine's fxSum keys (max:health, skill:X, dmg:X, cost:X, regen:X, resist, barter, carry...) or pfx:<id>,
     which the fight code reads through PFX (see PFXMAP). Caps stop stacking five pieces from breaking fights. */
  const J = ["ring", "amulet"];
  const ARMOR = {
    health: ["Fortify Health", "max:health", 40, ["chest", "shield", "head", ...J], 150, "corpus", "Health", "+{m} health."],
    magicka: ["Fortify Magicka", "max:magicka", 40, ["head", "chest", "hands", ...J], 150, "corpus", "Magicka", "+{m} magicka."],
    stamina: ["Fortify Stamina", "max:stamina", 40, ["chest", "feet", "shield", ...J], 150, "corpus", "Stamina", "+{m} stamina."],
    carry: ["Fortify Carry Weight", "carry", 40, ["hands", "feet", ...J], 0, "armor", "Carry Weight", "+{m} carry weight."],
    onehanded: ["Fortify One-Handed", "dmg:One-Handed", 25, ["hands", "feet", ...J], 25, "armor", "One-Handed", "One-handed weapons do {m}% more damage."],
    twohanded: ["Fortify Two-Handed", "dmg:Two-Handed", 25, ["hands", "feet", ...J], 25, "armor", "Two-Handed", "Two-handed weapons do {m}% more damage."],
    archery: ["Fortify Archery", "dmg:Archery", 25, ["head", "hands", ...J], 25, "armor", "Archery", "Bows and crossbows do {m}% more damage."],
    sneak: ["Fortify Sneak", "skill:Sneak", 25, ["feet", "hands", "head", ...J], 60, "armor", "Sneak", "+{m} Sneak."],
    lockpicking: ["Fortify Lockpicking", "skill:Lockpicking", 25, ["head", "hands", ...J], 60, "armor", "Lockpicking", "+{m} Lockpicking: locks open more often."],
    destruction: ["Fortify Destruction", "spell:Destruction", 25, ["head", "chest", ...J], 25, "armor", "Destruction", "Destruction spells do {m}% more damage."],
    restoration: ["Fortify Restoration", "spell:Restoration", 25, ["head", "chest", ...J], 40, "armor", "Restoration", "Healing spells heal {m}% more."],
    barter: ["Fortify Barter", "barter", 20, ["head", "hands", ...J], 40, "armor", "Barter", "Prices are {m}% better when you buy and sell."],
    resist: ["Resist Magic", "resist", 25, ["shield", "chest", ...J], 50, "ward", "Resist Magic", "Mages and dragons hurt you {m}% less."],
    // ---- new: regeneration
    regen_health: ["Regenerate Health", "regen:health", 50, ["chest", ...J], 100, "corpus", "Recovery", "Health comes back {m}% faster on the road, and in fights you heal a little every turn."],
    regen_magicka: ["Regenerate Magicka", "regen:magicka", 50, ["head", "chest", ...J], 100, "corpus", "Focus", "Magicka comes back {m}% faster."],
    regen_stamina: ["Regenerate Stamina", "regen:stamina", 50, ["chest", "feet", ...J], 100, "corpus", "Second Wind", "Stamina comes back {m}% faster."],
    // ---- new: resistances
    resist_fire: ["Resist Fire", "pfx:resist_fire", 30, ["feet", "shield", "chest", ...J], 50, "ward", "Resist Fire", "Fire mages, flame atronachs and fire breath hurt you {m}% less."],
    resist_frost: ["Resist Frost", "pfx:resist_frost", 30, ["feet", "shield", "chest", ...J], 50, "ward", "Resist Frost", "Frost mages, ice wraiths and frost breath hurt you {m}% less."],
    resist_shock: ["Resist Shock", "pfx:resist_shock", 30, ["feet", "shield", "chest", ...J], 50, "ward", "Resist Shock", "Storm mages and storm atronachs hurt you {m}% less."],
    resist_poison: ["Resist Poison", "pfx:resist_poison", 30, ["chest", "shield", ...J], 50, "ward", "Resist Poison", "Spiders, chaurus, spriggans and other poisonous foes hurt you {m}% less."],
    // ---- new: fighting
    block: ["Fortify Block", "pfx:block", 15, ["shield", "hands", ...J], 25, "armor", "Blocking", "Blocking takes another {m}% off a blow."],
    crit: ["Fortify Critical", "pfx:crit", 8, ["hands", "ring"], 10, "armor", "Precision", "{m}% chance a weapon hit is a critical."],
    evasion: ["Fortify Evasion", "pfx:evasion", 8, ["feet", "chest", "ring"], 12, "armor", "Evasion", "{m}% chance to dodge a blow completely."],
    heavyarmor: ["Fortify Heavy Armor", "skill:Heavy Armor", 25, ["chest", "hands", ...J], 60, "armor", "Heavy Armor", "+{m} Heavy Armor: heavy pieces protect more."],
    lightarmor: ["Fortify Light Armor", "skill:Light Armor", 25, ["chest", "hands", ...J], 60, "armor", "Light Armor", "+{m} Light Armor: light pieces protect more."],
    // ---- new: magic
    alteration: ["Fortify Alteration", "cost:Alteration", 25, ["head", "chest", ...J], 50, "armor", "Alteration", "Alteration spells cost {m}% less."],
    conjuration: ["Fortify Conjuration", "cost:Conjuration", 25, ["head", "chest", ...J], 50, "armor", "Conjuration", "Conjuration spells cost {m}% less."],
    illusion: ["Fortify Illusion", "cost:Illusion", 25, ["head", "chest", ...J], 50, "armor", "Illusion", "Illusion spells cost {m}% less."],
    // ---- new: crafts and the town
    smithing: ["Fortify Smithing", "skill:Smithing", 20, ["hands", "chest", ...J], 40, "armor", "Smithing", "+{m} Smithing: improve gear further at the grindstone."],
    alchemy: ["Fortify Alchemy", "skill:Alchemy", 20, ["head", "hands", ...J], 40, "armor", "Alchemy", "+{m} Alchemy: stronger potions."],
    pickpocket: ["Fortify Pickpocket", "skill:Pickpocket", 25, ["hands", "feet", ...J], 60, "armor", "Pickpocketing", "+{m} Pickpocket."],
    speech: ["Fortify Speech", "skill:Speechcraft", 20, ["head", ...J], 40, "armor", "Persuasion", "+{m} Speechcraft: talk your way through more."],
  };
  /* pfx effects: how a worn effect reaches the fight code through PFX (perkfx.js): [pfx key, value per magnitude, condition] */
  const PFXMAP = {
    resist_fire: [["in", -0.01, { foeEl: "fire" }]], resist_frost: [["in", -0.01, { foeEl: "frost" }]], resist_shock: [["in", -0.01, { foeEl: "shock" }]],
    resist_poison: [["in", -0.01, { venom: 1 }]],
    block: [["block", 0.01, {}]], crit: [["crit", 0.01, {}]], evasion: [["dodge", 0.01, {}]],
    regen_health: [["regenhp", 0.0004, {}]],   // 100% (the cap) = 4% of your health back each fight turn
  };
  // enchanted armor you can find, buy and break down to learn its effect ([Skyrim] names)
  const FOUND = [
    ["iron_helmet", "health", 20], ["hide_bracers", "onehanded", 12], ["leather_boots", "sneak", 12], ["hide_boots", "carry", 20],
    ["leather_helmet", "archery", 12], ["mage_robes", "destruction", 12], ["iron_gauntlets", "twohanded", 12], ["leather_bracers", "lockpicking", 12],
    ["hide_helmet", "magicka", 20], ["iron_shield", "resist", 12], ["chainmail_boots", "stamina", 20], ["hide_armor", "restoration", 12],
    // the new effects turn up on armor too, so you can learn them without jewellery
    ["iron_boots", "resist_fire", 15], ["hide_shield", "resist_frost", 15], ["leather_armor", "resist_shock", 15], ["iron_armor", "resist_poison", 15],
    ["iron_shield", "block", 8], ["leather_bracers", "crit", 4], ["leather_boots", "evasion", 4], ["steel_armor", "heavyarmor", 12],
    ["leather_armor", "lightarmor", 12], ["mage_robes", "regen_magicka", 25], ["hide_armor", "regen_health", 25], ["hide_boots", "regen_stamina", 25],
    ["hide_helmet", "alteration", 12], ["mage_robes", "conjuration", 12], ["leather_helmet", "illusion", 12], ["iron_gauntlets", "smithing", 10],
    ["hide_helmet", "alchemy", 10], ["leather_boots", "pickpocket", 12], ["leather_helmet", "speech", 10],
  ];
  // enchanted weapons with the new effects: [base, effect, magnitude, charge]
  const FOUND_W = [["iron_sword", "paralyze", 8, 600], ["iron_war_axe", "absorb_stamina", 10, 800], ["iron_dagger", "absorb_magicka", 10, 800], ["steel_mace", "fear", 10, 700],
    ["hunting_bow", "calm", 10, 700], ["iron_dagger", "soul_trap", 2, 900], ["steel_sword", "turn_undead", 12, 800], ["iron_war_axe", "bleed", 4, 800], ["iron_greatsword", "paralyze", 10, 700], ["steel_battleaxe", "bleed", 5, 800]];
  const GEM_POWER = { soul_gem_common: 0.6, soul_gem_greater: 0.8 };   // [Skyrim] Common and Greater souls (Grand would be 1.0)
  const JEWEL = (it) => !!it && J.includes(it.slot);
  const nameOf = (eff) => (WEAPON[eff] || ARMOR[eff] || [eff])[0];

  /* enchanted items are made on demand from their id: ench|<base item>|<effect>|<magnitude>|<charge capacity> */
  function make(id) {
    const [, base, eff, magS, capS] = id.split("|"), b = D.ITEMS[base], mag = +magS, cap = +capS;
    if (!b || !(WEAPON[eff] || ARMOR[eff])) return undefined;
    if (WEAPON[eff]) {
      const [, max, cost, , suf] = WEAPON[eff];
      return { ...b, name: `${b.name} of ${suf}`, value: Math.round(b.value + mag * 8 * (30 / max)), enchant: { effect: eff, magnitude: mag, max_magnitude: max, base_cost: cost, capacity: cap } };
    }
    const [name, key, full, , , , suf] = ARMOR[eff];
    return { ...b, name: `${b.name} of ${suf}`, value: Math.round(b.value + mag * 6 * (40 / full) * (JEWEL(b) ? 1.2 : 1)), aenchant: { key, mag, name, eff } };
  }
  const inner = D.ITEMS;
  D.ITEMS = new Proxy(inner, { get(t, k) { if (typeof k === "string" && !(k in t) && k.startsWith("ench|")) { const it = make(k); if (it) t[k] = it; } return t[k]; } });
  // found gear enters the loot tables and the court wizards' shelves
  const foundIds = FOUND.filter(([b]) => inner[b]).map(([b, e, m]) => `ench|${b}|${e}|${m}|0`);
  const foundW = FOUND_W.filter(([b]) => inner[b]).map(([b, e, m, c]) => `ench|${b}|${e}|${m}|${c}`);
  D.LOOT.humanoid.push(...foundIds.slice(0, 6).map((id) => [id, 0.012]), ...foundIds.slice(12).map((id) => [id, 0.004]), ...foundW.map((id) => [id, 0.004]));
  D.LOOT.elite.push(...foundIds.map((id) => [id, 0.04]), ...foundW.map((id) => [id, 0.02]));
  D.SHOP_STOCK.wizard.push(...foundIds.slice(0, 5), ...foundIds.slice(12).filter((_, i) => i % 3 === 0));

  const isEnchanted = (it) => !!(it?.enchant || it?.aenchant);
  const effOfKey = (key) => Object.keys(ARMOR).find((k) => ARMOR[k][1] === key);
  const effectOf = (itemId) => { const it = D.ITEMS[itemId]; if (it?.enchant) return it.enchant.effect; if (it?.aenchant) return it.aenchant.eff || (itemId.startsWith("ench|") ? itemId.split("|")[2] : effOfKey(it.aenchant.key)); return null; };
  const known = (s) => s.enchants || [];
  const hasEnchanter = (place) => !!place && (G.shopTypes(place).includes("wizard") || place === "Winterhold");

  function disenchant(s, rowId) {   // [Skyrim] destroys the item, teaches its effect
    if (!hasEnchanter(s.location)) return "You need an arcane enchanter: court wizards' towers and the College of Winterhold have one.";
    const r = G.invRow(s, rowId), it = r && D.ITEMS[r.item];
    if (!isEnchanted(it)) return "That isn't enchanted.";
    if (it.mask) return "The mask's old magic won't come loose. It isn't something you can break for its secrets.";
    if (it.unique) return "This piece is one of a kind. Its magic won't come loose.";
    if (Object.values(G.loadout(s).equipment).includes(rowId)) return "Take it off first.";
    const eff = effectOf(r.item);
    if (!WEAPON[eff] && !ARMOR[eff]) return "This old magic is too strange to learn from.";
    if (known(s).includes(eff)) return `You already know ${nameOf(eff)}. Breaking it would teach you nothing.`;
    G.take(s, rowId);
    s.enchants = [...known(s), eff];
    const sk = G.useSkill(s, "Enchanting", 0.5);
    return `The ${it.name} crumbles into light. You learned ${nameOf(eff)}.` + (sk.length ? " " + sk.join(". ") : "");
  }
  /* how strong an enchantment would be ([OURS] scaling): soul size × (0.4 + 0.6 × skill/100), Enchanter perk +10% per rank */
  function strength(s, gemItem) { return (GEM_POWER[gemItem] || 0.6) * (0.4 + 0.6 * Math.min(100, G.skill(s, "Enchanting")) / 100) * (1 + 0.1 * G.P(s, "enchanter")); }
  /* [OURS] the bigger Enchanting tree: Fire/Frost/Storm/Hex/Warding Enchanter, Insightful and Corpus Enchanter, Jeweller, Extra Effect (capped) */
  const classOf = (eff) => WEAPON[eff] ? (["fire", "frost", "shock"].includes(eff) ? eff : "other") : ARMOR[eff][5];
  function perkBoost(s, eff, it) {
    if (typeof PFX === "undefined") return 0;
    return Math.min(0.5, PFX.sum(s, "ench", null, { el: classOf(eff), kind: JEWEL(it) ? "jewel" : "gear" }));
  }
  function preview(s, rowId, eff, gemRowId) {
    const r = G.invRow(s, rowId), g = G.invRow(s, gemRowId);
    if (!r || !g) return null;
    const it = D.ITEMS[r.item], k = strength(s, g.item) * (1 + perkBoost(s, eff, it)) * (it.jpow || 1);   // gem-set jewellery holds more magic
    if (WEAPON[eff]) return { mag: Math.max(1, Math.round(WEAPON[eff][1] * k)), cap: D.ITEMS[g.item].charge };
    return { mag: Math.max(1, Math.round(ARMOR[eff][2] * k)), cap: 0 };
  }
  const canBase = (it) => !!it && !isEnchanted(it) && !it.staff && (it.slot === "weapon" || G.ARMOR_SLOTS.includes(it.slot) || JEWEL(it));
  const canTake = (it, eff) => WEAPON[eff] ? it.slot === "weapon" && !it.staff : !!ARMOR[eff] && ARMOR[eff][3].includes(it.slot);
  const slotWord = (sl) => ({ chest: "body", ring: "rings", amulet: "amulets", shield: "shields", head: "head", hands: "hands", feet: "feet" })[sl] || sl;
  function enchant(s, rowId, eff, gemRowId, opt = {}) {   // opt.boost: mini-game multiplier on magnitude; opt.botch: the soul slips away (craftgames.js)
    if (!hasEnchanter(s.location)) return "You need an arcane enchanter.";
    const r = G.invRow(s, rowId), g = G.invRow(s, gemRowId), it = r && D.ITEMS[r.item];
    if (!canBase(it)) return "Pick an unenchanted weapon, piece of armor, ring or amulet.";
    if (!known(s).includes(eff)) return "You don't know that enchantment.";
    if (!canTake(it, eff)) return `${nameOf(eff)} can't go on that. ${ARMOR[eff] ? `It fits: ${ARMOR[eff][3].map(slotWord).join(", ")}.` : "Weapons only."}`;
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
    return `The soul pours into the ${it.name}. You made ${D.ITEMS[id].name}: ${describe(eff, p.mag)}` + (sk.length ? " " + sk.join(". ") : "");
  }
  /* plain words for an effect at a magnitude */
  function describe(eff, mag) {
    const t = WEAPON[eff] || ARMOR[eff];
    if (!t) return "";
    return t[WEAPON[eff] ? 5 : 7].replace(/\{m\}/g, Math.round(mag));
  }
  /* every line of what a piece's enchantments do (item details) */
  function lines(it) {
    if (!it) return [];
    if (it.enchant) return [describe(it.enchant.effect, it.enchant.magnitude) || `${it.enchant.magnitude} ${it.enchant.effect} damage per hit`];
    if (!it.aenchant) return [];
    return [it.aenchant, ...(it.aenchant.more || [])].map((e) => { const eff = e.eff || effOfKey(e.key); return eff && ARMOR[eff] ? describe(eff, e.mag) : e.key.startsWith("dae:") ? e.name : `${e.name} ${e.mag}`; });
  }
  /* worn enchantments, read by fxSum in the engine. Several pieces with the same effect add up, to a cap. */
  const CAP = {}; for (const [, key, , , cap] of Object.values(ARMOR)) if (cap) CAP[key] = cap;
  function wornList(s) {
    const out = [];
    for (const id of Object.values(G.loadout(s).equipment)) { const r = G.invRow(s, id), it = r && D.ITEMS[r.item]; if (!it?.aenchant) continue; out.push(it.aenchant, ...(it.aenchant.more || [])); }   // masks carry several
    return out;
  }
  /* offence boosts (weapon and Destruction damage) give diminishing returns when stacked: the strongest piece counts
     in full, the next half, the next a quarter... then the cap. Stops two rings + an amulet halving a hard fight. */
  const DIM = (key) => key.startsWith("dmg:") || key === "spell:Destruction";
  function worn(s, key) {
    let n = 0;
    if (DIM(key)) { const m = wornList(s).filter((e) => e.key === key).map((e) => e.mag).sort((a, b) => b - a); m.forEach((v, i) => { n += v / (1 << i); }); }
    else for (const e of wornList(s)) if (e.key === key) n += e.mag;
    return CAP[key] ? Math.min(CAP[key], n) : n;
  }
  /* worn effects the fight code reads through PFX: [[pfx key, value, condition]], each effect summed and capped.
     f = a fight (cached on it: gear doesn't change mid-fight) or null */
  function pfxWorn(s, f) {
    if (f && f._enchPfx) return f._enchPfx;
    let list = [];
    try {
      const tot = {};
      const eq = f && f.eq ? f.eq : G.equipment(s);
      for (const r of Object.values(eq || {})) {
        const it = r && D.ITEMS[r.item]; if (!it?.aenchant) continue;
        for (const e of [it.aenchant, ...(it.aenchant.more || [])]) { const eff = e.eff || effOfKey(e.key); if (eff && PFXMAP[eff]) tot[eff] = (tot[eff] || 0) + e.mag; }
      }
      for (const [eff, m] of Object.entries(tot)) { const mag = ARMOR[eff][4] ? Math.min(ARMOR[eff][4], m) : m; for (const [k, per, c] of PFXMAP[eff]) list.push([k, mag * per, c]); }
    } catch (e) { list = []; }
    if (f) f._enchPfx = list;
    return list;
  }

  /* ---- weapon hits: what the enchantment does when its charge fires. Returns { dmg, label } (extra damage, log text) */
  const BIG_FOE = (f) => !!(f.e?.boss || f.tags.has("dragon") || f.e?.priest || f.tags.has("boss"));
  const levelOk = (f) => (f.e?.level ?? 99) <= (f.s.level || 1) + 5;
  function onHit(f, en, em) {
    const kind = (WEAPON[en.effect] || [])[3] || "dmg", s = f.s, m = en.magnitude;
    if (kind === "dmg") { if (en.effect === "absorb") f.hp = Math.min(G.maxHealth(s), f.hp + m); return { dmg: em, label: ` +${en.effect}` }; }
    if (kind === "sp") { f.sp = Math.min(G.maxStamina(s), f.sp + m); return { dmg: em / 3, label: ` +${m} stamina` }; }
    if (kind === "mp") { f.mp = Math.min(G.maxMagicka(s), f.mp + m); return { dmg: em / 3, label: ` +${m} magicka` }; }
    if (kind === "bleed") { f.bleed.push({ dmg: Math.round(em), turns: 3 }); return { dmg: 0, label: " · bleeds" }; }
    if (kind === "soul") { f.soulTrap = true; return { dmg: 0, label: " · soul marked" }; }
    if (kind === "undead") {
      if (!(f.tags.has("undead") || f.tags.has("vampire"))) return { dmg: 0, label: "" };
      let label = " +sun"; if (!BIG_FOE(f) && Math.random() < 0.15) { f.fearTurns = Math.max(f.fearTurns || 0, 1); label += ", it flees"; }
      return { dmg: em, label };
    }
    // paralyze, fear, calm: a chance, never on bosses or dragons, and a rest of 2 turns between
    const ch = Math.min(0.3, em / 100);
    if (BIG_FOE(f) || (f._enchCd || 0) > f.turn || Math.random() >= ch) return { dmg: 0, label: "" };
    if (kind === "para") { if (f.tags.has("construct")) return { dmg: 0, label: "" }; f.eParalyzed = Math.max(f.eParalyzed || 0, 1); f._enchCd = f.turn + 3; return { dmg: 0, label: ", paralyzes" }; }
    if (!levelOk(f)) return { dmg: 0, label: "" };
    if (kind === "fear") { if (f.tags.has("undead") || f.tags.has("construct")) return { dmg: 0, label: "" }; f.fearTurns = Math.max(f.fearTurns || 0, 1); f._enchCd = f.turn + 3; return { dmg: 0, label: ", it cowers" }; }
    if (kind === "calm") { if (!(f.tags.has("humanoid") || f.tags.has("beast"))) return { dmg: 0, label: "" }; f.calmTurns = Math.max(f.calmTurns || 0, 2); f._enchCd = f.turn + 4; return { dmg: 0, label: ", it stops fighting" }; }
    return { dmg: 0, label: "" };
  }
  const isElement = (eff) => ["fire", "frost", "shock"].includes(eff);
  return { WEAPON, ARMOR, PFXMAP, CAP, FOUND, known, hasEnchanter, disenchant, preview, enchant, canTake, canBase, worn, wornList, pfxWorn, isEnchanted, effectOf, strength, perkBoost, describe, lines, nameOf, onHit, isElement, classOf, JEWEL_SLOTS: J };
})();
