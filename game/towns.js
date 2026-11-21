/* Towns: inns, alchemy, trainers, the forge, jobs, pickpocketing, fences, guards and bounties.
   [Skyrim] numbers come from UESP (https://en.uesp.net/wiki/Skyrim:Alchemy, :Trainers, :Crime). [OURS] marks our own rules. */

// ---------------------------------------------------------------- alchemy
// [Skyrim] effects: [base cost, base magnitude, base duration (Skyrim seconds), what it does here, beneficial?]
// Costs/magnitudes are Skyrim's where known (Restore Health 0.5/5/0 is confirmed on UESP); the rest are close approximations.
const EFFECTS = {
  "Restore Health": [0.5, 5, 0, "restore:health", true], "Restore Magicka": [0.6, 5, 0, "restore:magicka", true], "Restore Stamina": [0.6, 5, 0, "restore:stamina", true],
  "Fortify Health": [0.35, 4, 60, "max:health", true], "Fortify Magicka": [0.3, 4, 60, "max:magicka", true], "Fortify Stamina": [0.3, 4, 60, "max:stamina", true],
  "Fortify Carry Weight": [0.15, 4, 300, "carry", true], "Fortify One-handed": [0.5, 4, 60, "dmg:One-Handed", true], "Fortify Two-handed": [0.5, 4, 60, "dmg:Two-Handed", true],
  "Fortify Marksman": [0.5, 4, 60, "dmg:Archery", true], "Fortify Block": [0.5, 4, 60, "skill:Blocking", true], "Fortify Heavy Armor": [0.5, 2, 60, "skill:Heavy Armor", true],
  "Fortify Light Armor": [0.5, 2, 60, "skill:Light Armor", true], "Fortify Sneak": [0.5, 4, 60, "skill:Sneak", true], "Fortify Lockpicking": [0.5, 4, 30, "skill:Lockpicking", true],
  "Fortify Barter": [2, 1, 30, "barter", true], "Fortify Destruction": [0.5, 5, 60, "spell:Destruction", true], "Fortify Restoration": [0.5, 4, 60, "spell:Restoration", true],
  "Fortify Illusion": [0.5, 4, 60, "skill:Illusion", true], "Fortify Conjuration": [0.25, 5, 60, "skill:Conjuration", true], "Fortify Enchanting": [0.6, 1, 30, "skill:Enchanting", true],
  "Fortify Smithing": [0.75, 4, 30, "skill:Smithing", true], "Regenerate Health": [0.1, 5, 300, "regen:health", true], "Regenerate Magicka": [0.1, 5, 300, "regen:magicka", true],
  "Regenerate Stamina": [0.1, 5, 300, "regen:stamina", true], "Resist Fire": [0.5, 3, 60, "resist", true], "Resist Frost": [0.5, 3, 60, "resist", true],
  "Resist Shock": [0.5, 3, 60, "resist", true], "Resist Magic": [1, 1, 60, "resist", true], "Resist Poison": [0.5, 4, 60, "none", true], "Cure Disease": [0.5, 5, 0, "none", true],
  // poisons: what they do when the coated weapon hits
  "Damage Health": [3, 2, 1, "poison:damage", false], "Ravage Health": [0.4, 2, 10, "poison:ravage", false], "Lingering Damage Health": [12, 1, 10, "poison:linger", false],
  "Paralysis": [500, 0, 1, "poison:paralyze", false], "Slow": [1, 50, 5, "poison:slow", false], "Damage Stamina": [1.8, 3, 0, "none", false], "Ravage Stamina": [0.4, 2, 10, "none", false],
  "Ravage Magicka": [0.4, 2, 10, "none", false], "Damage Magicka": [2.2, 3, 0, "none", false], "Damage Magicka Regen": [0.5, 100, 5, "none", false], "Damage Stamina Regen": [0.3, 100, 5, "none", false],
  "Lingering Damage Magicka": [10, 1, 10, "none", false], "Lingering Damage Stamina": [1.8, 1, 10, "none", false], "Weakness to Fire": [0.6, 2, 30, "none", false],
  "Weakness to Frost": [0.5, 2, 30, "none", false], "Weakness to Shock": [0.7, 2, 30, "none", false], "Weakness to Magic": [1, 2, 30, "none", false], "Weakness to Poison": [1, 2, 30, "none", false], "Frenzy": [107, 1, 10, "none", false],
};
// [Skyrim] ingredients, effects in order (UESP Skyrim:Ingredients), value, weight
const INGREDIENT_FX = {
  ing_blue_flower: ["Blue Mountain Flower", ["Restore Health", "Fortify Conjuration", "Fortify Health", "Damage Magicka Regen"], 2, 0.1],
  ing_lavender: ["Lavender", ["Resist Magic", "Fortify Stamina", "Ravage Magicka", "Fortify Conjuration"], 1, 0.1],
  ing_snowberries: ["Snowberries", ["Resist Fire", "Fortify Enchanting", "Resist Frost", "Resist Shock"], 4, 0.1],
  ing_juniper: ["Juniper Berries", ["Weakness to Fire", "Fortify Marksman", "Regenerate Health", "Damage Stamina Regen"], 1, 0.1],
  ing_deathbell: ["Deathbell", ["Damage Health", "Ravage Stamina", "Slow", "Weakness to Poison"], 4, 0.1],
  ing_nightshade: ["Nightshade", ["Damage Health", "Damage Magicka Regen", "Lingering Damage Stamina", "Fortify Destruction"], 8, 0.1],
  ing_fungal_pod: ["Swamp Fungal Pod", ["Resist Shock", "Lingering Damage Magicka", "Paralysis", "Restore Health"], 5, 0.25],
  ing_dragons_tongue: ["Dragon's Tongue", ["Resist Fire", "Fortify Barter", "Fortify Illusion", "Fortify Two-handed"], 5, 0.1],
  ing_frost_mirriam: ["Frost Mirriam", ["Resist Frost", "Fortify Sneak", "Ravage Magicka", "Damage Stamina Regen"], 1, 0.1],
  ing_canis_root: ["Canis Root", ["Damage Stamina", "Fortify One-handed", "Fortify Marksman", "Paralysis"], 5, 0.1],
  ing_creep_cluster: ["Creep Cluster", ["Restore Magicka", "Damage Stamina Regen", "Fortify Carry Weight", "Weakness to Magic"], 1, 0.2],
  ing_mora: ["Mora Tapinella", ["Restore Magicka", "Lingering Damage Health", "Regenerate Stamina", "Fortify Illusion"], 4, 0.25],
  ing_thistle: ["Thistle Branch", ["Resist Frost", "Ravage Stamina", "Resist Poison", "Fortify Heavy Armor"], 1, 0.1],
  ing_tundra_cotton: ["Tundra Cotton", ["Resist Magic", "Fortify Magicka", "Fortify Block", "Fortify Barter"], 1, 0.1],
  ing_purple_flower: ["Purple Mountain Flower", ["Restore Stamina", "Fortify Sneak", "Lingering Damage Magicka", "Resist Frost"], 2, 0.1],
  ing_red_flower: ["Red Mountain Flower", ["Restore Magicka", "Ravage Magicka", "Fortify Magicka", "Damage Health"], 2, 0.1],
  ing_spider_egg: ["Spider Egg", ["Damage Stamina", "Damage Magicka Regen", "Fortify Lockpicking", "Fortify Marksman"], 5, 0.2],
  ing_bone_meal: ["Bone Meal", ["Damage Stamina", "Resist Fire", "Fortify Conjuration", "Ravage Stamina"], 5, 0.5],
  ing_skeever_tail: ["Skeever Tail", ["Damage Stamina Regen", "Ravage Health", "Damage Health", "Fortify Light Armor"], 3, 0.2],
  ing_wheat: ["Wheat", ["Restore Health", "Fortify Health", "Damage Stamina Regen", "Lingering Damage Magicka"], 5, 0.1],
  ing_charred_hide: ["Charred Skeever Hide", ["Restore Stamina", "Cure Disease", "Resist Poison", "Restore Health"], 1, 0.5],
  ing_butterfly: ["Butterfly Wing", ["Restore Health", "Fortify Barter", "Lingering Damage Stamina", "Damage Magicka"], 3, 0.1],
  ing_salt: ["Salt Pile", ["Weakness to Magic", "Fortify Restoration", "Slow", "Regenerate Magicka"], 2, 0.2],
  ing_garlic: ["Garlic", ["Resist Poison", "Fortify Stamina", "Regenerate Magicka", "Regenerate Health"], 1, 0.25],
  ing_mudcrab: ["Mudcrab Chitin", ["Restore Stamina", "Cure Disease", "Resist Poison", "Resist Fire"], 2, 0.25],
  ing_troll_fat: ["Troll Fat", ["Resist Poison", "Fortify Two-handed", "Frenzy", "Damage Health"], 15, 1],
  ing_hawk_feathers: ["Hawk Feathers", ["Cure Disease", "Fortify Light Armor", "Fortify One-handed", "Fortify Sneak"], 15, 0.1],
  ing_bear_claws: ["Bear Claws", ["Restore Stamina", "Fortify Health", "Fortify One-handed", "Damage Magicka Regen"], 2, 0.1],
  ing_wisp: ["Wisp Wrappings", ["Restore Stamina", "Fortify Destruction", "Fortify Carry Weight", "Resist Magic"], 2, 0.1],
  ing_imp_stool: ["Imp Stool", ["Damage Health", "Lingering Damage Health", "Paralysis", "Restore Health"], 0, 0.3],
  ing_giants_toe: ["Giant's Toe", ["Damage Stamina", "Fortify Health", "Fortify Carry Weight", "Damage Stamina Regen"], 20, 1],
  ing_frost_salts: ["Frost Salts", ["Weakness to Fire", "Resist Frost", "Restore Magicka", "Fortify Conjuration"], 100, 0.25],
  ing_fire_salts: ["Fire Salts", ["Weakness to Frost", "Resist Fire", "Restore Magicka", "Regenerate Magicka"], 50, 0.25],
  ing_void_salts: ["Void Salts", ["Weakness to Shock", "Resist Magic", "Damage Health", "Fortify Magicka"], 125, 0.2],
  ing_glowing_mushroom: ["Glowing Mushroom", ["Resist Shock", "Fortify Destruction", "Fortify Smithing", "Fortify Health"], 5, 0.2],
  ing_elves_ear: ["Elves Ear", ["Restore Magicka", "Fortify Marksman", "Weakness to Frost", "Resist Fire"], 10, 0.1],
};
for (const [id, [name, , value, weight]] of Object.entries(INGREDIENT_FX)) D.ITEMS[id] = { name, slot: "ingredient", weight, value };
D.SHOP_STOCK.general.push("ing_wheat", "ing_garlic", "ing_salt", "ing_charred_hide", "ing_butterfly", "ing_mudcrab");
D.SHOP_STOCK.wizard.push("ing_frost_salts", "ing_fire_salts", "ing_void_salts", "ing_glowing_mushroom", "ing_elves_ear", "ing_wisp");
D.SHOPS.Riften.push("fence");
D.SHOP_STOCK.fence = ["ing_hawk_feathers", "ing_troll_fat", "ing_bear_claws", "ing_giants_toe", "ing_imp_stool", "potion_health", "scroll_fireball", "soul_gem_common"];
// gathering on the road and in dungeons now uses the full list too
Object.assign(HERBS_BY_GROUND, { "Grassland": ["ing_lavender", "ing_blue_flower", "ing_red_flower", "ing_wheat", "ing_butterfly"], "Forest": ["ing_mora", "ing_purple_flower", "ing_canis_root", "ing_imp_stool", "ing_glowing_mushroom"], "Pine forest": ["ing_mora", "ing_purple_flower", "ing_canis_root", "ing_imp_stool"], "River (ford)": ["ing_mudcrab"], "Lake": ["ing_mudcrab"] });

/* Brewed potions are items whose id holds their recipe: "brew|Restore Health:23:0,Fortify Health:17:60". D.ITEMS makes them on demand,
   so they survive saves, bags and other players' inventories without registering anything. */
(() => {
  const items = D.ITEMS;
  function makeBrew(id) {
    const parts = id.split("|")[1].split(",").map((p) => { const [n, m, d] = p.split(":"); return [n, +m, +d]; });
    const value = parts.reduce((a, [n, m, d]) => a + Math.floor(EFFECTS[n][0] * Math.max(m, 1) ** 1.1 * (d ? (d / 10) ** 1.1 : 1)), 0);   // [Skyrim] gold value
    const main = parts[0][0], poison = !EFFECTS[main][4];
    const restore = parts.find(([n]) => n.startsWith("Restore "));
    return { name: `${poison ? "Poison" : "Potion"} of ${main}${parts.length > 1 ? ` (+${parts.length - 1})` : ""}`, slot: poison ? "poison" : "potion", weight: 0.5,
      value: Math.max(1, value), effects: parts, ...(restore && !poison ? { restore: [restore[0].split(" ")[1].toLowerCase(), restore[1]] } : {}) };
  }
  D.ITEMS = new Proxy(items, { get(t, k) { if (typeof k === "string" && !(k in t) && k.startsWith("brew|")) t[k] = makeBrew(k); return t[k]; } });
})();

const TOWNS = (() => {
  const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const P = (s, id) => PERKS.rank(s, id);
  const kind = (n) => WORLD.places[n]?.[2];
  const isTown = (n) => ["city", "town"].includes(kind(n));
  const SECONDS_PER_REAL_SECOND_OF_SKYRIM = 5;   // [OURS] potion durations: 1 Skyrim second = 5 real seconds (a 60 s potion lasts 5 minutes)

  // ---- alchemy
  const known = (s, id) => (s.known = s.known || {})[id] || (s.known[id] = [false, false, false, false]);
  function brewPreview(s, ids) {
    const fx = ids.map((id) => INGREDIENT_FX[D.ITEMS[id] ? id : ""]?.[1] || []);
    const shared = [...new Set(fx.flat())].filter((e) => fx.filter((l) => l.includes(e)).length >= 2);
    return shared;
  }
  function potency(s, effect, isPoison) {
    const [, mag] = EFFECTS[effect];
    const skillMult = 1 + (1.5 - 1) * G.skill(s, "Alchemy") / 100;                         // [Skyrim] fAlchemySkillFactor 1.5
    let m = 4 * mag * skillMult * (1 + 0.2 * P(s, "alchemist"));                            // [Skyrim] fAlchemyIngredientInitMult 4, Alchemist
    if (effect.startsWith("Restore ") && P(s, "physician")) m *= 1.25;                      // [Skyrim] Physician
    if (!isPoison && EFFECTS[effect][4] && P(s, "benefactor")) m *= 1.25;                   // [Skyrim] Benefactor
    if (isPoison && !EFFECTS[effect][4] && P(s, "poisoner")) m *= 1.25;                     // [Skyrim] Poisoner
    return Math.round(m);
  }
  function brew(s, rowIds) {
    if (!s.location || !isTown(s.location)) return { text: "You need an alchemy lab. Every city and town has one." };
    const rows = [...new Set(rowIds)].map((id) => G.invRow(s, id)).filter(Boolean);
    if (rows.length < 2 || rows.length > 3) return { text: "Pick two or three different ingredients." };
    if (rows.some((r) => D.ITEMS[r.item].slot !== "ingredient")) return { text: "Only ingredients go in the mortar." };
    const ids = rows.map((r) => r.item), shared = brewPreview(s, ids);
    rows.forEach((r) => G.take(s, r.id));                                                    // [Skyrim] ingredients are used up even if it fails
    if (!shared.length) { const sk = G.useSkill(s, "Alchemy", 1); return { text: "The mixture fizzles into grey sludge. These don't share any effect.", skills: sk }; }
    for (const id of ids) INGREDIENT_FX[id][1].forEach((e, i) => { if (shared.includes(e)) known(s, id)[i] = true; });   // brewing reveals shared effects
    const value = (e, mag) => EFFECTS[e][0] * Math.max(mag, 1) ** 1.1 * (EFFECTS[e][2] ? (EFFECTS[e][2] / 10) ** 1.1 : 1);
    let parts = shared.map((e) => [e, potency(s, e, false), EFFECTS[e][2]]).sort((a, b) => value(b[0], b[1]) - value(a[0], a[1]));
    const isPoison = !EFFECTS[parts[0][0]][4];
    parts = parts.map(([e, , d]) => [e, potency(s, e, isPoison), d]);
    if (P(s, "purity")) parts = parts.filter(([e]) => EFFECTS[e][4] === !isPoison);                   // [Skyrim] Purity
    const id = "brew|" + parts.map((p) => p.join(":")).join(",");
    G.give(s, id);
    const it = D.ITEMS[id];
    const skills = G.useSkill(s, "Alchemy", it.value);                                             // [Skyrim] XP ∝ the potion's value
    return { text: `You brew a ${it.name}: ${parts.map(([e, m, d]) => `${e} ${m}${d * SECONDS_PER_REAL_SECOND_OF_SKYRIM >= 60 ? ` for ${Math.round(d * SECONDS_PER_REAL_SECOND_OF_SKYRIM / 60)} min` : ""}`).join(", ")}. Worth ${it.value} gold.`, skills };
  }
  function eat(s, rowId) {
    const r = G.invRow(s, rowId);
    if (!r || D.ITEMS[r.item].slot !== "ingredient") return "That isn't an ingredient.";
    const fx = INGREDIENT_FX[r.item][1], k = known(s, r.item), n = 1 + P(s, "experimenter");   // [Skyrim] eating reveals the first effect; Experimenter more
    const newly = [];
    for (let i = 0; i < Math.min(4, n === 4 ? 4 : n); i++) if (!k[i]) { k[i] = true; newly.push(fx[i]); }
    G.take(s, rowId);
    const sk = G.useSkill(s, "Alchemy", 0.5);
    return (newly.length ? `You taste ${D.ITEMS[r.item].name}. Effect learned: ${newly.join(", ")}.` : `You eat ${D.ITEMS[r.item].name}. Nothing new.`) + (sk.length ? " " + sk.join(". ") : "");
  }
  /* drink any potion from the pack: restores now, fortify effects last a while */
  function drink(s, rowId, t = G.now()) {
    const r = G.invRow(s, rowId), it = r && D.ITEMS[r.item];
    if (!it || it.slot !== "potion") return "That isn't a potion.";
    G.take(s, rowId);
    if (it.cures === "disease") return (typeof CURSE !== "undefined" && CURSE.cureDisease(s)) || "You drink it. You weren't sick, but it can't hurt.";
    const out = [];
    const parts = it.effects || (it.restore ? [[`Restore ${it.restore[0][0].toUpperCase() + it.restore[0].slice(1)}`, it.restore[1], 0]] : []);
    for (const [e, m, d] of parts) {
      const key = EFFECTS[e]?.[3] || "none";
      if (key.startsWith("restore:")) {
        const res = key.split(":")[1];
        if (res === "health") { const b = G.curHealth(s, t); G.setHealth(s, b + m, t); out.push(`health ${Math.round(b)} → ${Math.round(G.curHealth(s, t))}`); }
        else out.push(`${res} +${m}`);
      } else if (key !== "none" && !key.startsWith("poison")) {
        s.fx = (s.fx || []).filter((f) => f.until > t);
        s.fx.push({ key, mag: m, until: t + d * SECONDS_PER_REAL_SECOND_OF_SKYRIM, name: e });
        out.push(`${e} ${m}${key.startsWith("dmg") || key === "barter" || key.startsWith("spell") ? "%" : ""} for ${Math.round(d * SECONDS_PER_REAL_SECOND_OF_SKYRIM / 60)} min`);
      } else out.push(`${e} (no use here)`);
    }
    return `You drink the ${it.name}: ${out.join(", ")}.`;
  }
  function applyPoison(s, rowId) {
    const r = G.invRow(s, rowId), it = r && D.ITEMS[r.item];
    if (!it || it.slot !== "poison") return "That isn't a poison.";
    if (!G.equipment(s).weapon) return "Equip a weapon first.";
    G.take(s, rowId);
    s.poison = { effects: it.effects, hits: P(s, "concentrated_poison") ? 2 : 1, name: it.name };   // [Skyrim] one hit
    return `You coat your weapon with ${it.name}. The next hit delivers it.`;
  }

  // ---- inns ([Skyrim] names; a room costs 10 gold)
  const INNS = { Whiterun: "The Bannered Mare", Riverwood: "Sleeping Giant Inn", Solitude: "The Winking Skeever", Windhelm: "Candlehearth Hall", Markarth: "Silver-Blood Inn",
    Riften: "The Bee and Barb", Falkreath: "Dead Man's Drink", Dawnstar: "Windpeak Inn", Winterhold: "The Frozen Hearth", Morthal: "Moorside Inn", Ivarstead: "Vilemyr Inn",
    Rorikstead: "Frostfruit Inn", "Dragon Bridge": "Four Shields Tavern", Kynesgrove: "Braidwood Inn", "Old Hroldan": "Old Hroldan Inn" };
  const ROOM = 10, RUMOUR = 10, RESTED_SECONDS = 8 * 2 * 3600 / 24;   // [Skyrim] Rested lasts 8 game hours = 40 real minutes here
  const etiquette = (s) => (P(s, "courtly_manners") ? 0.8 : 1);
  const roomPrice = (s) => (typeof FEST !== "undefined" && FEST.freeInn()) ? 0 : Math.round(ROOM * etiquette(s));
  function rentRoom(s, t = G.now()) {
    const inn = INNS[s.location];
    if (!inn) return "There's no inn here.";
    if (wanted(s)) return "The innkeeper glances at the guards and says there are no rooms.";
    const p = roomPrice(s);
    if (s.gold < p) return `A room costs ${p} gold.`;
    s.gold -= p; G.setHealth(s, G.maxHealth(s), t); s.rested = t + RESTED_SECONDS; s.restBonus = 0.05;   // [Skyrim] Rested: +5% (a bed you own: Well Rested +10%)
    const et = G.useSkill(s, "Etiquette", 6);   // [OURS] good manners at the inn
    return `You sleep in a warm bed at ${inn}. Fully healed and Rested: skills improve 5% faster for 40 minutes. Your own bed would do better.` + (et.length ? " " + et.join(". ") : "") + (typeof GUILDS !== "undefined" ? GUILDS.innWake(s) : "");
  }
  const BARD = ["A bard plays \"Ragnar the Red\" for the fourth time tonight.", "A drunk argues that the Dragonborn is a myth. Loudly.", "Someone is telling the arrow-in-the-knee story again.",
    "The innkeeper complains about the price of mead.", "Two farmers bet on whether the Jarl will raise taxes."];
  function rumour(s) {
    const inn = INNS[s.location];
    if (!inn) return "There's no inn here.";
    const free = P(s, "rumour_monger"), price = free ? 0 : RUMOUR;
    if (s.gold < price) return `A drink to loosen tongues costs ${price} gold.`;
    s.gold -= price;
    const here = WORLD.places[s.location];
    const unknown = Object.entries(WORLD.places).filter(([n, p]) => !s.discovered.includes(n) && (["dungeon", "fort", "camp", "lair", "stone", "shrine", "landmark"].includes(p[2]) || WORLD.hidden?.has(n)))
      .map(([n, p]) => ({ n, d: G.pxDist(here, p), p })).sort((a, b) => a.d - b.d).slice(0, 6);
    const sk = [...G.useSkill(s, "Speechcraft", 10), ...G.useSkill(s, "Streetwise", 12)];   // [OURS] Streetwise: hearing what the street knows
    if (!unknown.length) return `${pick(BARD)} Nobody knows anything you don't.`;
    const got = [];
    for (let i = 0; i < (free ? 2 : 1) && unknown.length; i++) {
      const u = unknown.splice(Math.floor(Math.random() * unknown.length), 1)[0];
      s.discovered.push(u.n);
      const dx = u.p[0] - here[0], dy = u.p[1] - here[1], dir = Math.abs(dx) > Math.abs(dy) * 2 ? (dx > 0 ? "east" : "west") : Math.abs(dy) > Math.abs(dx) * 2 ? (dy > 0 ? "south" : "north") : `${dy > 0 ? "south" : "north"}-${dx > 0 ? "east" : "west"}`;
      got.push(`${u.n}, ${dir} of here`);
    }
    return `${pick(BARD)} Over ${free ? "a free" : "a"} drink you hear about ${got.join(" and ")}. ${got.length > 1 ? "They're" : "It's"} on your map now.` + (sk.length ? " " + sk.join(". ") : "");
  }

  // ---- trainers ([Skyrim] UESP trainer list; [OURS] trainers for the skills Skyrim doesn't have)
  const TRAINERS = {
    Whiterun: [["Amren", "One-Handed", "common"], ["Athis", "One-Handed", "expert"], ["Aela the Huntress", "Archery", "expert"], ["Njada Stonearm", "Blocking", "expert"],
      ["Farkas", "Heavy Armor", "master"], ["Vilkas", "Two-Handed", "master"], ["Danica Pure-Spring", "Restoration", "master"], ["Eorlund Gray-Mane", "Smithing", "master"],
      ["Arcadia", "Alchemy", "expert"], ["Uthgerd the Unbroken", "Hand-to-Hand", "expert"]],
    Riverwood: [["Faendal", "Archery", "common"], ["Brina Swift-Foot", "Athletics", "common"]],
    Falkreath: [["Runil", "Conjuration", "common"]],
    Windhelm: [["Wuunferth the Unliving", "Destruction", "common"], ["Scouts-Many-Marshes", "Light Armor", "common"], ["Silda the Unseen", "Pickpocket", "expert"],
      ["Revyn Sadri", "Mercantile", "common"], ["Torbjorn Shatter-Shield", "Two-Handed", "expert"], ["Hilde Chain-Wife", "Medium Armor", "common"]],
    Solitude: [["Sybille Stentor", "Destruction", "expert"], ["Giraud Gemane", "Speechcraft", "master"], ["Captain Hrolf", "Spear", "expert"], ["Bryling", "Etiquette", "expert"]],
    Markarth: [["Hamal", "Enchanting", "master"], ["Ghorza", "Smithing", "common"], ["Garvey", "Sneak", "expert"], ["Ogmund the Skald", "Speechcraft", "expert"]],
    Riften: [["Grelka", "Light Armor", "expert"], ["Balimund", "Smithing", "expert"], ["Vex", "Lockpicking", "master"], ["Delvin Mallory", "Sneak", "master"],
      ["Vipir the Fleet", "Pickpocket", "master"], ["Brynjolf", "Streetwise", "master"], ["Kesh the Leaper", "Acrobatics", "expert"]],
    Winterhold: [["Tolfdir", "Alteration", "master"], ["Phinis Gestor", "Conjuration", "expert"], ["Faralda", "Destruction", "master"], ["Sergius Turrianus", "Enchanting", "expert"],
      ["Drevis Neloren", "Illusion", "master"], ["Colette Marence", "Restoration", "expert"], ["Urag gro-Shub", "Mysticism", "master"]],
    Morthal: [["Lami", "Alchemy", "common"], ["Falion", "Conjuration", "master"]],
    Kynesgrove: [["Dravynea the Stoneweaver", "Alteration", "expert"]],
    Ivarstead: [["Brother Tarn", "Unarmored", "expert"]],
    Dawnstar: [["Rustleif", "Smithing", "common"]],
  };
  const CAP = { common: 50, expert: 75, master: 90 };                                        // [Skyrim] trainers stop at 50/75/90
  function trainCost(s, skill) {                                                              // [Skyrim] n(10b+5n+45) etc. for one session
    const b = s.skills[skill].lvl;
    const c = b > 75 ? 50 * b + 50 : b > 50 ? 30 * b + 50 : 10 * b + 50;
    return Math.round(c * etiquette(s) * (typeof HALL !== "undefined" ? HALL.trainMult() : 1));   // [OURS] the Hall of the North makes training cheaper
  }
  const trainedThisLevel = (s) => (s.trained && s.trained.level === s.level ? s.trained.n : 0);
  function train(s, who) {
    const tr = (TRAINERS[s.location] || []).find((x) => x[0] === who);
    if (!tr) return "They aren't here.";
    if (wanted(s)) return `${who} won't train someone the guards are looking for.`;
    const [, skill, lvl] = tr, sk = s.skills[skill];
    if (trainedThisLevel(s) >= 5) return "You've trained 5 times this level. Level up to train again.";   // [Skyrim]
    if (sk.lvl >= CAP[lvl]) return `${who} can't teach you more than ${CAP[lvl]} ${skill}.`;
    const c = trainCost(s, skill);
    if (s.gold < c) return `Training costs ${c} gold.`;
    s.gold -= c; sk.lvl += 1; sk.xp = 0;
    s.trained = { level: s.level, n: trainedThisLevel(s) + 1 };
    s.charXp += sk.lvl;                                                                       // [Skyrim] training counts toward your level
    const msgs = [];
    while (s.charXp >= F.charXpNeeded(s.level)) { s.charXp -= F.charXpNeeded(s.level); s.level++; s.pendingLevels++; msgs.push(`You reached level ${s.level}!`); }
    return `${who} trains you. ${skill} is now ${sk.lvl}. (${5 - s.trained.n} sessions left this level)` + (msgs.length ? " " + msgs.join(" ") : "");
  }

  // ---- the forge: improving weapons and armor ([Skyrim] quality names; [OURS] simplified improvement amounts)
  const QUALITY = ["", "Fine", "Superior", "Exquisite", "Flawless", "Epic", "Legendary"];
  // [Skyrim] each improvement uses one piece of the item's own material (value, weight)
  Object.assign(D.ITEMS, {
    mat_iron: { name: "Iron Ingot", slot: "material", weight: 1, value: 7 }, mat_steel: { name: "Steel Ingot", slot: "material", weight: 1, value: 20 },
    mat_leather: { name: "Leather", slot: "material", weight: 2, value: 10 }, mat_firewood: { name: "Firewood", slot: "material", weight: 5, value: 5 },
    mat_moonstone: { name: "Refined Moonstone", slot: "material", weight: 1, value: 25 }, mat_dwarven: { name: "Dwarven Metal Ingot", slot: "material", weight: 1, value: 30 },
  });
  D.SHOP_STOCK.blacksmith.push("mat_iron", "mat_steel", "mat_leather", "mat_firewood");
  D.LOOT.humanoid.push(["mat_iron", 0.08], ["mat_leather", 0.06]);
  D.LOOT.elite.push(["mat_steel", 0.15], ["mat_moonstone", 0.06], ["mat_dwarven", 0.04]);
  for (const [theme, mats] of Object.entries({ mine: ["mat_iron", "mat_iron", "mat_steel"], dwemer: ["mat_dwarven", "mat_dwarven"], cave: ["mat_leather"], fort: ["mat_steel", "mat_iron"], forsworn: ["mat_leather"], barrow: ["mat_steel"] }))
    DUNGEONS.THEMES[theme]?.loot.push(...mats);
  const baseOf = (id) => (id.startsWith("ench|") ? id.split("|")[1] : id);
  function ingotFor(id) {
    const b = baseOf(id);
    if (/dwarven/.test(b)) return "mat_dwarven"; if (/elven/.test(b)) return "mat_moonstone"; if (/^steel|ancient_nord/.test(b)) return "mat_steel";
    if (/hide|leather|forsworn/.test(b)) return "mat_leather"; if (/hunting_bow|long_bow/.test(b)) return "mat_firewood"; return "mat_iron";
  }
  function material(id) {
    id = baseOf(id);
    if (/^steel|ancient_nord/.test(id)) return "steel_smithing"; if (/^elven/.test(id)) return "elven_smithing"; if (/^dwarven/.test(id)) return "dwarven_smithing";
    if (/chainmail/.test(id)) return "advanced_armors"; return null;
  }
  function temperInfo(s, row) {
    const it = D.ITEMS[row.item];
    if (!(it.slot === "weapon" || G.ARMOR_SLOTS.includes(it.slot)) || it.type === "cloth") return null;
    const mat = material(row.item);
    const per = (it.slot === "weapon" ? 1 : 2) * (mat && P(s, mat) ? 2 : 1);
    const maxQ = Math.min(6, 1 + Math.floor(G.skill(s, "Smithing") / 20));
    const q = row.tq || 0, ingot = ingotFor(row.item), have = countItem(s, ingot);
    let block = null;
    if ((it.enchant || it.aenchant) && !P(s, "arcane_blacksmith")) block = "Enchanted gear needs the Arcane Blacksmith perk.";
    else if (q >= maxQ) block = `Your Smithing (${G.skill(s, "Smithing")}) can't improve it past ${QUALITY[q] || "plain"}.`;
    else if (!have) block = `Needs 1 ${D.ITEMS[ingot].name} (${["mat_moonstone", "mat_dwarven"].includes(ingot) ? "found in dungeons and on tough foes" : "blacksmiths sell it"}).`;
    return { q, maxQ, per, ingot, have, block };
  }
  function temper(s, rowId) {
    if (!s.location || !G.shopTypes(s.location).includes("blacksmith")) return "You need a forge. Blacksmiths have one.";
    const r = G.invRow(s, rowId), info = r && temperInfo(s, r);
    if (!info) return "That can't be improved.";
    if (info.block) return info.block;
    const ing = s.inv.find((x) => x.item === info.ingot);
    if (!ing) return `You need 1 ${D.ITEMS[info.ingot].name}.`;
    G.take(s, ing.id); r.tq = info.q + 1; r.temper = (r.temper || 0) + info.per;
    const sk = G.useSkill(s, "Smithing", 25 + 3 * D.ITEMS[r.item].value ** 0.65);              // [Skyrim] smithing XP = 25 + 3×value^0.65
    return `You hammer 1 ${D.ITEMS[info.ingot].name} into it. ${D.ITEMS[r.item].name} is now ${QUALITY[r.tq]} (+${r.temper} ${D.ITEMS[r.item].slot === "weapon" ? "damage" : "armor"}).` + (sk.length ? " " + sk.join(". ") : "");
  }

  // ---- crime ([Skyrim] bounties: pickpocketing 25, assault 40, murder 1000, escaping jail 100; stolen goods are taken when you pay)
  const CRIME = { pickpocket: 25, assault: 40, murder: 1000, theft: 0, escape: 100 };
  const bounty = (s, hold) => (s.bounty || {})[hold] || 0;
  const totalBounty = (s) => Object.values(s.bounty || {}).reduce((a, b) => a + b, 0);
  function addBounty(s, hold, crime, extra = 0) {
    s.bounty = s.bounty || {};
    s.bounty[hold] = (s.bounty[hold] || 0) + CRIME[crime] + extra;
    if (crime === "murder") s.murdered = true;   // the Dark Brotherhood takes note (guilds.js)
    G.note(s, `⚖️ Bounty in ${hold}: ${s.bounty[hold]} gold (${crime}).`);
    return s.bounty[hold];
  }
  const wanted = (s) => s.location && isTown(s.location) && (s.resisted || {})[G.holdAt(WORLD.places[s.location])] && bounty(s, G.holdAt(WORLD.places[s.location])) > 0;
  /* arriving in a town where you're wanted: the guard stops you */
  function guardCheck(s) {
    if (!s.location || !isTown(s.location)) return null;
    const hold = G.holdAt(WORLD.places[s.location]), b = bounty(s, hold);
    if (!b) return null;
    return { hold, bounty: b, fine: Math.round(b * (P(s, "noble_friends") ? 0.5 : 1)), bribe: P(s, "bribery") || P(s, "bribe_master") ? Math.round(b * 2 * (P(s, "bribe_master") ? 0.5 : 1)) : null };
  }
  function confiscate(s) { const before = s.inv.length; s.inv = s.inv.filter((r) => !r.stolen); return before - s.inv.length; }
  function guardChoice(s, choice, t = G.now()) {
    const g = guardCheck(s);
    if (!g) return { text: "The guard nods and moves on." };
    s.resisted = s.resisted || {};
    if (choice === "pay") {
      if (s.gold < g.fine) return { text: `The fine is ${g.fine} gold. You have ${s.gold}.`, stay: true };
      s.gold -= g.fine; const n = confiscate(s); delete s.bounty[g.hold]; delete s.resisted[g.hold];
      return { text: `You pay ${g.fine} gold.${n ? ` The guard takes your stolen goods (${n}).` : ""} "Now get out of my sight."` };
    }
    if (choice === "bribe") {
      if (g.bribe == null) return { text: "You don't know how to bribe a guard without getting arrested for it.", stay: true };
      if (s.gold < g.bribe) return { text: `The guard wants ${g.bribe} gold.`, stay: true };
      s.gold -= g.bribe; delete s.bounty[g.hold]; delete s.resisted[g.hold];
      return { text: `${g.bribe} gold changes hands. "I don't know you. Never saw you." You keep your loot.` };
    }
    if (choice === "jail") {                                                                // [Skyrim] one day per 100 bounty; each day costs progress in a skill
      const days = Math.max(1, Math.ceil(g.bounty / 100)), lost = [];
      const names = Object.keys(s.skills).filter((k) => s.skills[k].xp > 0).sort(() => Math.random() - 0.5);
      for (let i = 0; i < days && i < names.length; i++) { s.skills[names[i]].xp = 0; lost.push(names[i]); }
      const n = confiscate(s); delete s.bounty[g.hold]; delete s.resisted[g.hold];
      return { text: `You serve ${days} day${days > 1 ? "s" : ""} in the ${g.hold} jail.${lost.length ? ` You lose your progress in ${lost.join(", ")}.` : ""}${n ? ` Stolen goods taken: ${n}.` : ""} You walk out a free ${s.race === "khajiit" ? "cat" : "person"}.` };
    }
    // resist
    const guard = G.scaleEnemy({ name: "City guard", health: 140, damage: 19, tags: ["humanoid", "elite"], level: 20, danger: "high", gold: [5, 25], text: "" }, s.level);
    const f = new G.Fight(s, guard, null, t); f.run({ t, enemyFirst: true }); const skills = f.apply(t);
    if (!f.won) { const d = G.die(s, "city guard", t); return { text: "\"Then pay with your blood.\"", fight: f, died: d.msg, bag: d.bag, skills }; }
    addBounty(s, g.hold, "assault"); s.resisted[g.hold] = true;
    return { text: `You beat the guard. The whole ${g.hold} will hear about this: shops, inns and trainers here won't deal with you until your bounty is cleared.`, fight: f, skills };
  }

  // ---- pickpocketing townsfolk ([OURS] chances; [Skyrim] XP and bounty)
  function pickChance(s, { gold = 0, asleep = false, level = 1 } = {}) {
    let c = 0.35 + G.skill(s, "Pickpocket") / 120 - (gold ? gold / 400 * (P(s, "cutpurse") ? 0.5 : 1) : 0) - level / 200;
    c *= 1 + 0.2 * P(s, "light_fingers");
    if (asleep && P(s, "night_thief")) c += 0.25;
    return clamp(c, 0.05, 0.95);
  }
  function pickTownsfolk(s, t = G.now()) {
    if (!s.location || !isTown(s.location)) return { text: "There's no one around to rob." };
    const hold = G.holdAt(WORLD.places[s.location]), gold = rint(5, 45);
    const target = pick(["a merchant", "a drunk farmer", "a guard off duty", "a noble", "a priest", "a bard"]);
    if (Math.random() < pickChance(s, { gold, level: rint(1, 20) })) {
      s.gold += gold; s.stats = { ...(s.stats || {}), pp: ((s.stats || {}).pp || 0) + 1 };
      const sk = G.useSkill(s, "Pickpocket", gold);                                           // [Skyrim] XP = value stolen
      let item = "";
      if (Math.random() < 0.25) { const it = pick(["potion_health_minor", "ing_hawk_feathers", "soul_gem_common", "iron_dagger", "scroll_healing"]); const id = G.give(s, it); const r = G.invRow(s, id); if (r) r.stolen = true; item = ` and a ${D.ITEMS[it].name}`; }
      return { text: `You lift ${gold} gold${item} from ${target}. Nobody noticed.`, skills: sk };
    }
    if (P(s, "misdirection")) return { text: `${target[0].toUpperCase() + target.slice(1)} feels your hand and slaps it away, but doesn't call the guards.` };
    const b = addBounty(s, hold, "pickpocket");
    return { text: `"Thief!" ${target[0].toUpperCase() + target.slice(1)} grabs your wrist. Bounty in ${hold}: ${b} gold.` };
  }
  const canFence = (s) => P(s, "fence") || (s.guildThief && G.shopTypes(s.location || "").includes("general")) || (s.location === "Riften") || (P(s, "underworld_contacts") && G.shopTypes(s.location || "").includes("general"));

  // ---- jobs: three a day on every town's notice board ([OURS] rewards)
  function seeded(seed) { let x = 0; for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function jobsAt(s, town, t = G.now()) {
    if (!isTown(town)) return [];
    const day = Math.floor(t / (2 * 3600)), r = seeded(town + day), here = WORLD.places[town], list = [];
    const pk = (a) => a[Math.floor(r() * a.length)];
    const pay = P(s, "diplomat") ? 1.25 : 1;
    const dungeons = Object.entries(WORLD.places).filter(([n]) => DUNGEONS.enterable(n) && !["camp", "lair"].includes(kind(n)) && G.pxDist(here, WORLD.places[n]) < 320).map(([n]) => n);
    const towns = Object.keys(WORLD.places).filter((n) => isTown(n) && n !== town && G.pxDist(here, WORLD.places[n]) > 120 && G.pxDist(here, WORLD.places[n]) < 600);
    const giver = kind(town) === "city" ? "The Jarl's steward" : "A worried local";
    if (dungeons.length) { const d = pk(dungeons), tier = DUNGEONS.info(d).tier; list.push({ id: `${town}-${day}-c`, type: "clear", town, target: d, reward: Math.round((120 + 150 * tier) * pay), text: `${giver} wants ${d} cleared out. "Whatever's in there has been taking our people."` }); }
    if (towns.length) { const d = pk(towns), dist = G.pxDist(here, WORLD.places[d]); list.push({ id: `${town}-${day}-d`, type: "deliver", town, target: d, reward: Math.round((30 + dist / 6) * pay), text: `A courier's bag needs taking to ${d}. "Don't open it. Seriously."` }); }
    const herbs = Object.keys(INGREDIENT_FX).filter((k) => !["ing_frost_salts", "ing_fire_salts", "ing_void_salts", "ing_troll_fat", "ing_giants_toe"].includes(k));
    const item = pk(herbs), n = 3 + Math.floor(r() * 4);
    list.push({ id: `${town}-${day}-g`, type: "gather", town, item, n, reward: Math.round((40 + n * Math.max(3, D.ITEMS[item].value) * 4) * pay), text: `The local alchemist needs ${n} ${D.ITEMS[item].name}.` });
    return list.filter((j) => !(s.jobs || []).some((x) => x.id === j.id) && !(s.jobsDone || []).includes(j.id));
  }
  function takeJob(s, id, t = G.now()) {
    if (wanted(s)) return "Nobody here will hire a wanted criminal.";
    s.jobs = s.jobs || [];
    if (s.jobs.length >= 3) return "You already have three jobs. Finish one first.";
    const j = jobsAt(s, s.location, t).find((x) => x.id === id);
    if (!j) return "That job is gone.";
    s.jobs.push({ ...j, t });
    if (j.type === "clear" && !s.discovered.includes(j.target)) s.discovered.push(j.target);
    if (j.type === "deliver" && !s.discovered.includes(j.target)) s.discovered.push(j.target);
    return `Job taken: ${j.type === "clear" ? `clear ${j.target}` : j.type === "deliver" ? `deliver to ${j.target}` : `bring ${j.n} ${D.ITEMS[j.item].name}`}.`;
  }
  function dropJob(s, id) { s.jobs = (s.jobs || []).filter((j) => j.id !== id); return "Job abandoned."; }
  const countItem = (s, item) => s.inv.filter((r) => r.item === item).reduce((a, r) => a + r.qty, 0);
  /* check every job: returns messages for the ones finished just now */
  function checkJobs(s) {
    const done = [], msgs = [];
    for (const j of s.jobs || []) {
      let ok = false;
      if (j.type === "clear") ok = (s.cleared || {})[j.target] >= j.t;
      if (j.type === "deliver") ok = s.location === j.target;
      if (ok) { done.push(j.id); s.gold += j.reward; msgs.push(`📜 Job done: ${j.type === "clear" ? `${j.target} is cleared` : `the bag reached ${j.target}`}. +${j.reward} gold.`, ...G.useSkill(s, "Etiquette", 20)); }   // [OURS] Etiquette: serving the hold
    }
    if (done.length) { s.jobs = s.jobs.filter((j) => !done.includes(j.id)); s.jobsDone = [...(s.jobsDone || []), ...done].slice(-40); msgs.forEach((m) => G.note(s, m)); }
    return msgs;
  }
  function handIn(s, id) {
    const j = (s.jobs || []).find((x) => x.id === id);
    if (!j || j.type !== "gather") return "Nothing to hand in.";
    if (!s.location || !isTown(s.location)) return "Hand it in at any town's notice board.";
    if (countItem(s, j.item) < j.n) return `You have ${countItem(s, j.item)} of ${j.n} ${D.ITEMS[j.item].name}.`;
    let left = j.n;
    for (const r of [...s.inv]) if (r.item === j.item && left > 0) { const k = Math.min(left, r.qty); G.take(s, r.id, k); left -= k; }
    s.gold += j.reward; s.jobs = s.jobs.filter((x) => x.id !== id); s.jobsDone = [...(s.jobsDone || []), id].slice(-40);
    G.note(s, `📜 Job done: ${j.n} ${D.ITEMS[j.item].name} delivered. +${j.reward} gold.`);
    return `The alchemist counts them twice and pays ${j.reward} gold.`;
  }

  // ---- carriages ([Skyrim] drivers wait at the stables of the five big cities: 20 gold to a big city, 50 to a small hold capital)
  const BIG = ["Whiterun", "Solitude", "Windhelm", "Markarth", "Riften"], SMALL = ["Dawnstar", "Falkreath", "Morthal", "Winterhold"];
  const carriageFrom = (place) => BIG.includes(place) && G.shopTypes(place).includes("stables");
  const carriageDests = (s) => [...BIG, ...SMALL].filter((n) => n !== s.location).map((n) => ({ n, price: BIG.includes(n) ? 20 : 50 }));
  const CARRIAGE_SPEED = 17.2 * 1.75 * 2;   // [OURS] about as fast as riding a horse; Skyrim's carriages are instant
  function rideCarriage(s, dest, t = G.now()) {
    if (!carriageFrom(s.location)) return "There's no carriage here. Drivers wait at the stables of Whiterun, Solitude, Windhelm, Markarth and Riften.";
    if (wanted(s)) return "The driver takes one look at the guards and shakes his head.";
    const d = carriageDests(s).find((x) => x.n === dest);
    if (!d) return "The driver doesn't go there.";
    if (s.gold < d.price) return `The ride costs ${d.price} gold.`;
    const err = G.startTrip(s, dest, WORLD.places[dest].slice(0, 2), t);
    if (err) return err;
    s.gold -= d.price; s.trip.carriage = true; s.trip.speed = CARRIAGE_SPEED;
    return null;
  }

  // ---- followers ([Skyrim] hirelings cost 500 gold, one follower at a time; Lydia is the Jarl's gift; [OURS] combat numbers)
  const FOLLOWERS = {
    lydia: ["Lydia", "Whiterun", 0, 150, 10, "Housecarl. Sword and shield. Sworn to carry your burdens."],
    jenassa: ["Jenassa", "Whiterun", 500, 110, 11, "Dark elf archer. Drunken Huntsman regular. Enjoys her work a little too much."],
    belrand: ["Belrand", "Solitude", 500, 130, 11, "Spellsword: a blade in one hand, a spell in the other."],
    marcurio: ["Marcurio", "Riften", 500, 100, 13, "Mage for hire. Fire, frost and an opinion on everything."],
    vorstag: ["Vorstag", "Markarth", 500, 150, 11, "Sellsword with heavy armor and a heavier axe."],
    stenvar: ["Stenvar", "Windhelm", 500, 160, 11, "Two-handed warrior. Asks no questions."],
    erik: ["Erik the Slayer", "Rorikstead", 100, 120, 9, "A farm boy who wants adventure. Cheap, eager, a bit green."],
  };
  const fScale = (s) => 1 + 0.05 * (s.level - 1);
  const followerMax = (s, id) => Math.round(FOLLOWERS[id][3] * fScale(s));
  function followerHp(s, t = G.now()) {
    const f = s.follower; if (!f) return 0;
    const max = followerMax(s, f.id);
    return Math.min(max, f.hp + Math.max(0, t - f.ts) * 0.007 * max);   // [Skyrim] same 0.7%/s as you
  }
  const followersHere = (s) => Object.entries(FOLLOWERS).filter(([, f]) => f[1] === s.location);
  function hire(s, id, t = G.now()) {
    const f = FOLLOWERS[id];
    if (!f || f[1] !== s.location) return "They aren't here.";
    if (s.follower) return `${FOLLOWERS[s.follower.id][0]} is already with you. Dismiss them first.`;
    if (id === "lydia" && !s.thaneWhiterun) return "Lydia serves the Jarl. Bring Farengar the Dragonstone from Bleak Falls Barrow first.";
    if (wanted(s)) return `${f[0]} won't follow a wanted criminal.`;
    if (s.gold < f[2]) return `${f[0]} wants ${f[2]} gold.`;
    s.gold -= f[2];
    s.follower = { id, hp: followerMax(s, id), ts: t };
    return id === "lydia" ? "\"I am sworn to carry your burdens.\" Lydia joins you." : `${f[0]} takes your ${f[2]} gold. "Lead the way."`;
  }
  function dismiss(s) { if (!s.follower) return "No one is following you."; const n = FOLLOWERS[s.follower.id][0]; s.follower = null; return `${n} heads home.`; }
  function deliverDragonstone(s) {   // [Skyrim] Bleak Falls Barrow quest: bring the Dragonstone to Farengar
    if (s.location !== "Whiterun") return "Farengar works in Dragonsreach, in Whiterun.";
    const r = s.inv.find((x) => x.item === "dragonstone");
    if (!r) return "You don't have the Dragonstone. It waits at the end of Bleak Falls Barrow.";
    G.take(s, r.id); s.gold += 300; s.thaneWhiterun = true;
    G.note(s, "📜 Gave Farengar the Dragonstone. The Jarl names Lydia your housecarl.");
    return "Farengar snatches the Dragonstone. The Jarl pays you 300 gold and assigns Lydia as your housecarl. Hire her (free) in Whiterun.";
  }

  // ---- homes ([Skyrim] prices; Breezehome needs the Jarl's favour). A chest that's safe from death, your own bed, a garden.
  const HOMES = {
    Whiterun: ["Breezehome", 5000, "A cosy house by the city gate."], Riften: ["Honeyside", 8000, "A lakeside house with its own back door."],
    Markarth: ["Vlindrel Hall", 8000, "Carved into the rock of the Reach."], Windhelm: ["Hjerim", 12000, "A big, cold house with a dark past."],
    Solitude: ["Proudspire Manor", 25000, "The finest house in Skyrim."],
  };
  const GARDEN = ["ing_blue_flower", "ing_lavender", "ing_wheat", "ing_garlic", "ing_red_flower", "ing_purple_flower", "ing_juniper", "ing_snowberries"];
  const home = (s, town = s.location) => (s.homes || {})[town] || null;
  function buyHome(s, t = G.now()) {
    const h = HOMES[s.location];
    if (!h) return "No house for sale here.";
    if (home(s)) return "You already own it.";
    if (wanted(s)) return "The steward won't sell to a wanted criminal.";
    if (s.location === "Whiterun" && !s.thaneWhiterun) return "The steward only sells Breezehome to someone the Jarl trusts. Bring Farengar the Dragonstone first.";
    if (s.gold < h[1]) return `${h[0]} costs ${h[1]} gold. You have ${s.gold}.`;
    s.gold -= h[1];
    s.homes = { ...(s.homes || {}), [s.location]: { chest: [], garden: 0 } };
    G.note(s, `🏠 Bought ${h[0]} in ${s.location}.`);
    return `The steward hands you the key to ${h[0]}. Your chest is safe even if you die, your bed makes you Well Rested, and the garden grows ingredients.`;
  }
  function sleepHome(s, t = G.now()) {
    if (!home(s)) return "You don't own a house here.";
    G.setHealth(s, G.maxHealth(s), t); s.rested = t + RESTED_SECONDS; s.restBonus = 0.1;   // [Skyrim] Well Rested: +10%
    return "You sleep in your own bed. Fully healed and Well Rested: skills improve 10% faster for 40 minutes.";
  }
  function stash(s, rowId) {
    const h = home(s); if (!h) return "You don't own a house here.";
    const r = G.invRow(s, rowId); if (!r) return "You don't have that.";
    const copy = { ...r }; delete copy.id;
    G.take(s, rowId, r.qty);
    const same = h.chest.find((x) => x.item === copy.item && !x.temper && !copy.temper && x.charge == null && copy.charge == null && !x.stolen === !copy.stolen);
    if (same && ["potion", "scroll", "soulgem", "tome", "ingredient", "trophy", "poison"].includes(D.ITEMS[copy.item].slot)) same.qty += copy.qty; else h.chest.push(copy);
    return `${D.ITEMS[copy.item].name}${copy.qty > 1 ? ` ×${copy.qty}` : ""} goes in the chest.`;
  }
  function unstash(s, idx) {
    const h = home(s); if (!h) return "You don't own a house here.";
    const r = h.chest[idx]; if (!r) return "It's not in the chest.";
    h.chest.splice(idx, 1);
    const id = G.give(s, r.item, r.qty, r.charge);
    const row = G.invRow(s, id); if (row && (r.temper || r.stolen)) Object.assign(row, { temper: r.temper, tq: r.tq, stolen: r.stolen });
    return `You take ${D.ITEMS[r.item].name}${r.qty > 1 ? ` ×${r.qty}` : ""}.`;
  }
  const gardenReady = (s, t = G.now()) => home(s) && (home(s).garden || 0) + 2 * 3600 <= t;   // [OURS] one harvest per game day
  function harvest(s, t = G.now()) {
    const h = home(s); if (!h) return "You don't own a house here.";
    if (!gardenReady(s, t)) return `Nothing is ripe yet. Come back in ${Math.ceil(((h.garden || 0) + 7200 - t) / 60)} minutes.`;
    h.garden = t;
    const got = {}; for (let i = 0; i < 4 * (G.P(s, "green_thumb") ? 2 : 1); i++) { const it = GARDEN[Math.floor(Math.random() * GARDEN.length)]; got[it] = (got[it] || 0) + 1; }
    for (const [it, n] of Object.entries(got)) G.give(s, it, n);
    return `You harvest the garden: ${Object.entries(got).map(([it, n]) => `${D.ITEMS[it].name} ×${n}`).join(", ")}.`;
  }

  return { HOMES, home, buyHome, sleepHome, stash, unstash, gardenReady, harvest, BIG, SMALL, carriageFrom, carriageDests, rideCarriage, CARRIAGE_SPEED, FOLLOWERS, followerMax, followerHp, followersHere, hire, dismiss, deliverDragonstone,
    EFFECTS, INGREDIENT_FX, INNS, TRAINERS, CAP, QUALITY, known, brewPreview, brew, eat, drink, applyPoison, roomPrice, rentRoom, rumour, trainCost, trainedThisLevel, train,
    temperInfo, temper, ingotFor, bounty, totalBounty, addBounty, wanted, guardCheck, guardChoice, pickChance, pickTownsfolk, canFence, jobsAt, takeJob, dropJob, checkJobs, handIn, countItem, isTown, RUMOUR,
    POTION_MINUTES: (d) => Math.round(d * SECONDS_PER_REAL_SECOND_OF_SKYRIM / 60) };
})();
