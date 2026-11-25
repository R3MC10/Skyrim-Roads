/* Things that happen on the road while you watch (they never fire while the page is closed, so trips don't stall).
   Each event has text and choices; a choice returns what happened. Skill XP uses the Skyrim formulas in formulas.js.
   [OURS] success chances and rewards. [Skyrim] XP amounts where Skyrim has them (noted inline). */

// Ingredients you can gather (values are approximate Skyrim values, [OURS] where unsure). Alchemy brewing comes with towns.
const INGREDIENTS = {
  ing_blue_flower: ["Blue Mountain Flower", 2], ing_lavender: ["Lavender", 1], ing_snowberries: ["Snowberries", 4],
  ing_juniper: ["Juniper Berries", 2], ing_deathbell: ["Deathbell", 4], ing_nightshade: ["Nightshade", 8],
  ing_fungal_pod: ["Swamp Fungal Pod", 6], ing_dragons_tongue: ["Dragon's Tongue", 5], ing_frost_mirriam: ["Frost Mirriam", 1],
  ing_canis_root: ["Canis Root", 5], ing_creep_cluster: ["Creep Cluster", 1], ing_mora: ["Mora Tapinella", 4],
  ing_thistle: ["Thistle Branch", 1], ing_tundra_cotton: ["Tundra Cotton", 1], ing_purple_flower: ["Purple Mountain Flower", 2],
  ing_red_flower: ["Red Mountain Flower", 2],
};
for (const [id, [name, value]] of Object.entries(INGREDIENTS))
  D.ITEMS[id] = { name, slot: "ingredient", weight: 0.1, value };
const HERBS_BY_GROUND = {
  "Marsh": ["ing_deathbell", "ing_fungal_pod", "ing_nightshade"], "Snow": ["ing_snowberries", "ing_frost_mirriam", "ing_thistle"],
  "Tundra": ["ing_lavender", "ing_tundra_cotton", "ing_blue_flower"], "Grassland": ["ing_lavender", "ing_blue_flower", "ing_red_flower"],
  "Forest": ["ing_mora", "ing_purple_flower", "ing_canis_root"], "Pine forest": ["ing_mora", "ing_purple_flower", "ing_canis_root"],
  "Autumn forest": ["ing_nightshade", "ing_red_flower", "ing_mora"], "Volcanic tundra": ["ing_creep_cluster", "ing_dragons_tongue"],
  "Rocky hills": ["ing_juniper", "ing_canis_root", "ing_red_flower"], "Mountains": ["ing_thistle", "ing_frost_mirriam"],
};
// skill books (Skyrim: reading a skill book raises that skill by 1)
const SKILL_BOOKS = [["Fire and Darkness", "One-Handed"], ["Battle of Red Mountain", "Two-Handed"], ["The Gold Ribbon of Merit", "Archery"],
  ["Death Blow of Abernanit", "Blocking"], ["Hallgerd's Tale", "Heavy Armor"], ["Ice and Chitin", "Light Armor"],
  ["Horrors of Castle Xyr", "Destruction"], ["Withershins", "Restoration"], ["Daughter of the Niben", "Alteration"],
  ["2920, Hearth Fire", "Conjuration"], ["Mystery of Talara", "Illusion"], ["Sacred Witness", "Sneak"], ["The Locked Room", "Lockpicking"],
  ["Guide to Better Thieving", "Pickpocket"], ["The Buying Game", "Mercantile"], ["Biography of the Wolf Queen", "Speechcraft"],
  ["Last Scabbard of Akrash", "Smithing"], ["Enchanter's Primer", "Enchanting"], ["Song of the Alchemists", "Alchemy"],
  ["A Dance in Fire", "Athletics"], ["The Black Arrow", "Acrobatics"], ["The Wolf Queen, Book I", "Etiquette"], ["Thief", "Streetwise"]];
const LOCK_TIERS = [["Novice", 2], ["Apprentice", 3], ["Adept", 5], ["Expert", 8], ["Master", 13]];   // [Skyrim] Lockpicking base XP per lock
const DIVINES = ["Akatosh", "Arkay", "Dibella", "Julianos", "Kynareth", "Mara", "Stendarr", "Zenithar", "Talos"];

const ROAD_EVENTS = (() => {
  const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const xp = (s, skill, base) => G.useSkill(s, skill, base);

  const list = [
    { id: "herbs", weight: 5,
      when: (s, ground) => !!HERBS_BY_GROUND[ground],
      make: (s, ground) => { const item = pick(HERBS_BY_GROUND[ground]); return { item, text: `You spot ${D.ITEMS[item].name.toLowerCase()} growing a few steps off the road.` }; },
      choices: (e) => [["gather", "Gather it"], ["leave", "Keep walking"]],
      gather: (s, e) => { const n = rint(1, 3) * (G.P(s, "green_thumb") ? 2 : 1); G.give(s, e.item, n); return { text: `You gather ${n} ${D.ITEMS[e.item].name}. Ingredients will be used for alchemy; for now you can sell them.` }; } },

    { id: "chest", weight: 3,
      make: () => { const tier = rint(0, 4) > 3 ? rint(3, 4) : rint(0, 2); return { tier, tries: 3, text: `In the ruins of a wayside shrine sits an iron-banded chest. The lock looks ${LOCK_TIERS[tier][0].toLowerCase()}.` }; },
      choices: (e, s) => [["pick", `Pick the lock (${e.tries} picks left)`], ...(POWERS.stone(s) === "tower" && e.tier <= 3 && POWERS.powerReady(s, "stone") ? [["tower", "Use the Tower Stone's power"]] : []), ["smash", "Smash it open"], ["leave", "Leave it"]],
      tower: (s, e) => { s.stonePowerAt = G.now(); return byId.chest.pick(s, e, true); },
      pick: (s, e, sure) => {
        const ch = sure ? 1 : G.lockChance(s, e.tier);
        if (sure || G.lockRoll(s, ch)) {
          const skills = xp(s, "Lockpicking", LOCK_TIERS[e.tier][1]);
          const gold = Math.round(rint(10, 40) * (e.tier + 1) * (G.P(s, "golden_touch") ? 1.5 : 1) * (1 + (typeof PFX !== "undefined" ? Math.min(0.5, PFX.num(s, "gold")) : 0))), loot = [];
          s.gold += gold;
          for (const [item, c] of D.LOOT.humanoid) if (Math.random() < c * (1 + e.tier * 0.5) * (G.P(s, "treasure_hunter") ? 1.5 : 1)) { G.give(s, item); loot.push(D.ITEMS[item].name); }
          return { text: `Click. The lock gives. Inside: ${gold} gold${loot.length ? ", " + loot.join(", ") : ""}.`, skills };
        }
        if (!G.P(s, "unbreakable")) e.tries -= 1;
        const skills = xp(s, "Lockpicking", 0.25);        // [Skyrim] 0.25 XP per broken pick
        return { text: e.tries > 0 ? "Snap. The pick breaks." : "Your last pick snaps. The chest stays shut.", skills, keep: e.tries > 0 };
      },
      smash: (s, e) => {
        if (Math.random() < 0.35) { const gold = rint(5, 25) * (e.tier + 1); s.gold += gold; return { text: `You batter the lock until it gives. Most of what was inside is broken; you salvage ${gold} gold.` }; }
        return { text: "The chest is sturdier than it looks. You give up with sore arms." };
      } },

    { id: "caravan", weight: 2,
      make: () => ({ stock: [...new Set([pick(D.SHOP_STOCK.general), pick(D.SHOP_STOCK.general), pick(D.SHOP_STOCK.wizard), pick(D.SHOP_STOCK.wizard), "potion_health", "potion_health_minor", pick(["iron_sword_flames", "steel_sword_frost", "hunting_bow_shocks", "soul_gem_common"])])].filter((i) => typeof SHOPCAP === "undefined" || SHOPCAP.ok(i)),
        text: "A Khajiit caravan rests by the road, pack guar snorting. \"Khajiit has wares, if you have coin.\"" }),
      choices: () => [["trade", "Trade"], ["leave", "Keep walking"]],
      trade: (s, e) => ({ text: "The caravan leader spreads out a rug of goods.", shop: e.stock, keep: true }) },

    { id: "injured", weight: 3,
      make: () => ({ text: "A traveller sits against a milestone, clutching a bloodied leg. \"Please... anything for the pain?\"" }),
      choices: (e, s) => [["potion", `Give a healing potion (${G.countRestore(s, "health")})`], ...(s.spells.includes("healing") ? [["spell", "Heal them with magic"]] : []), ["leave", "Walk past"]],
      potion: (s) => {
        const f = new G.Fight(s, { name: "-", health: 1, damage: 0 }), r = f.findPotion("health");
        if (!r) return { text: "You have no potions to give.", keep: true };
        G.take(s, r.id);
        if (Math.random() < 0.12) return { text: "The moment you kneel, they grab your purse and limp off surprisingly fast. You keep the rest of your dignity.", rob: true };
        const gold = rint(25, 70); s.gold += gold;
        return { text: `They drink and sigh with relief. "Talos bless you." They press ${gold} gold into your hand.` };
      },
      spell: (s) => {
        const skills = xp(s, "Restoration", 25);          // [Skyrim] 1 XP per point healed (we heal them for 25)
        const gold = rint(15, 50); s.gold += gold;
        return { text: `Warm light closes the wound. Grateful, they give you ${gold} gold.`, skills };
      } },

    { id: "toll", weight: 2,
      make: () => { const fee = rint(2, 5) * 10; return { fee, text: `Soldiers have barred the road with a cart. "Toll's ${fee} gold, traveller. Orders from the Jarl."` }; },
      choices: (e, s) => [["pay", `Pay ${e.fee} gold`], ["talk", G.P(s, "diplomat") ? "Show your papers (Diplomat)" : "Talk your way through"], ["around", "Go the long way round"]],
      pay: (s, e) => { if (s.gold < e.fee) return { text: "You don't have enough gold.", keep: true }; s.gold -= e.fee; return { text: "The sergeant pockets the coins and waves you on." }; },
      talk: (s, e) => {
        if (G.P(s, "diplomat")) return { text: "The sergeant reads your letter of introduction and salutes." };
        const ch = clamp(0.3 + G.skill(s, "Speechcraft") / 100 + (G.P(s, "persuasion") ? 0.3 : 0), 0.1, 0.95);   // [OURS] chance; [Skyrim] Persuasion +30%
        if (Math.random() < ch) { const skills = xp(s, "Speechcraft", 75 * G.skill(s, "Speechcraft") / 20); return { text: "\"The Jarl's orders don't cover a Thane's errand,\" you say. They let you through.", skills }; }
        return { text: "\"Nice try.\" The toll doubles for wasting their time.", keep: true, fee: e.fee * 2 };
      },
      around: () => ({ text: "You leave the road and pick your way round through rough ground.", delay: 120 }) },

    { id: "book", weight: 2,
      make: () => { const [title, skill] = pick(SKILL_BOOKS); return { title, skill, text: `Beside a cold campfire lies a waterlogged book: "${title}".` }; },
      choices: (e) => [["read", "Read it"], ["leave", "Leave it"]],
      read: (s, e) => {
        const sk = s.skills[e.skill];
        if (sk.lvl >= 100) return { text: "There's nothing in it you don't already know." };
        const msgs = [...G.raiseSkill(s, e.skill), ...(typeof LONGHOUSE !== "undefined" ? LONGHOUSE.onBook(s, e.skill) : [])];              // [Skyrim] skill books raise the skill by 1 (and give character XP)
        return { text: `You read it cover to cover. ${e.skill} increased to ${sk.lvl}.`, skills: msgs };
      } },

    { id: "sleeper", weight: 2,
      make: () => { const purse = rint(15, 90); return { purse, text: "A bandit dozes by a dead campfire, snoring. A fat coin purse hangs from his belt." }; },
      choices: () => [["steal", "Pickpocket the purse"], ["ambush", "Attack while he sleeps"], ["leave", "Let him sleep"]],
      steal: (s, e) => {
        const ch = TOWNS.pickChance(s, { gold: e.purse, asleep: true });
        if (Math.random() < ch) { s.gold += e.purse; return { text: `Your fingers are lighter than his sleep. +${e.purse} gold.`, skills: xp(s, "Pickpocket", e.purse) }; }  // [Skyrim] 1 XP per gold stolen
        return { text: "He snorts awake and grabs your wrist!", fight: "Bandit outlaw", enemyFirst: true };
      },
      ambush: () => ({ text: "You creep closer, weapon ready...", fight: "Bandit outlaw", hidden: true }) },

    { id: "shrine", weight: 2,
      make: () => { const god = pick(DIVINES); return { god, text: `A weathered roadside shrine to ${god} stands among the stones.` }; },
      choices: (e) => [["pray", `Pray to ${e.god}`], ["leave", "Walk on"]],
      pray: (s, e) => { G.setHealth(s, G.maxHealth(s)); const cured = typeof CURSE !== "undefined" && CURSE.cureDisease(s); const my = G.useSkill(s, "Mysticism", 12); return { text: `You kneel. A calm settles over you, and your wounds close. Blessing of ${e.god}.${cured ? " " + cured : ""}${my.length ? " " + my.join(". ") : ""}` }; } },

    { id: "climb", weight: 2,
      when: (s, ground) => ["Mountains", "Rocky hills", "Snow", "Pine forest", "Forest"].includes(ground),
      make: () => ({ text: "A goat path scrambles straight up the slope. It would cut a big bend off the road, if you can manage it." }),
      choices: () => [["climb", "Climb it"], ["leave", "Stay on the road"]],
      climb: (s) => {
        const ch = clamp(0.4 + G.skill(s, "Acrobatics") / 100 + 0.15 * G.P(s, "sure_footed"), 0.1, 0.95);   // [OURS] chance
        const skills = xp(s, "Acrobatics", 2);                                 // [OURS] Acrobatics XP (Oblivion style, small)
        if (Math.random() < ch) return { text: "You scramble over the top and drop onto the road far ahead.", skills, skip: 90 };
        const dmg = Math.round(G.maxHealth(s) * rnd(0.12, 0.3)); G.setHealth(s, G.curHealth(s) - dmg);
        return { text: `A rock gives way. You slide back down, bruised (−${dmg} health).`, skills };
      } },

    { id: "camp", weight: 2,
      make: () => ({ text: "An abandoned camp. The fire is still warm, and a bedroll is laid out under a lean-to." }),
      choices: () => [["search", "Search the camp"], ["leave", "Move on quickly"]],
      search: (s) => {
        if (Math.random() < 0.22) return { text: "\"That's ours!\" Its owners are back.", fight: "Bandit outlaw" };
        const gold = rint(5, 35); s.gold += gold; const loot = [];
        for (const [item, c] of D.LOOT.humanoid) if (Math.random() < c * 0.6) { G.give(s, item); loot.push(D.ITEMS[item].name); }
        return { text: `You find ${gold} gold${loot.length ? " and " + loot.join(", ") : ""}.` };
      } },

    { id: "peddler", weight: 1,
      make: () => { const item = pick(["tome_firebolt", "tome_fast_healing", "tome_oakflesh", "soul_gem_common", "steel_sword_frost", "scroll_fireball"].filter((i) => typeof SHOPCAP === "undefined" || SHOPCAP.ok(i))); return { item, price: Math.round(D.ITEMS[item].value * 0.9), text: `A hooded peddler steps out from behind a rock. "Psst. ${D.ITEMS[item].name}, cheap. ${Math.round(D.ITEMS[item].value * 0.9)} gold, no questions."` }; },
      choices: (e) => [["buy", `Buy it (${e.price} gold)`], ["leave", "No thanks"]],
      buy: (s, e) => { if (s.gold < e.price) return { text: "You can't afford it.", keep: true }; s.gold -= e.price; G.give(s, e.item); return { text: `You hand over the coin and take the ${D.ITEMS[e.item].name}.`, skills: xp(s, "Mercantile", e.price) }; } },
  ];
  const byId = Object.fromEntries(list.map((e) => [e.id, e]));
  function roll(s) {
    const ground = Terrain.NAMES[Terrain.typeAtPos([s.x, s.y])];
    const ok = list.filter((e) => !e.when || e.when(s, ground));
    let r = Math.random() * ok.reduce((a, e) => a + e.weight, 0);
    const ev = ok.find((e) => (r -= e.weight) < 0) || ok[0];
    return { id: ev.id, ...ev.make(s, ground) };
  }
  const choices = (e, s) => byId[e.id].choices(e, s);
  function choose(s, e, choice) {
    if (choice === "leave") return { text: "You carry on down the road." };
    return byId[e.id][choice](s, e) || { text: "" };
  }
  return { roll, choices, choose };
})();
