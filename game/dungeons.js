/* Dungeons: a branching map of rooms you pick your way through, ending in a boss.
   Health doesn't regenerate inside ([OURS]: the dark wears you down); heal with potions, spells, shrines and rest rooms.
   Everything you pick up goes straight into your pack, so if you die it's in your bag at the entrance.
   Cleared dungeons refill after 3 in-game days (6 real hours here). */

// ---- dungeon gear (Skyrim items; stats close to Skyrim's, values approximate)
Object.assign(D.ITEMS, {
  ancient_nord_sword: { name: "Ancient Nord Sword", slot: "weapon", hands: 1, skill: "One-Handed", damage: 8, weight: 11, value: 35 },
  ancient_nord_war_axe: { name: "Ancient Nord War Axe", slot: "weapon", hands: 1, skill: "One-Handed", damage: 9, weight: 12, value: 40 },
  ancient_nord_greatsword: { name: "Ancient Nord Greatsword", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 17, weight: 18, value: 80 },
  ancient_nord_bow: { name: "Ancient Nord Bow", slot: "weapon", hands: 2, skill: "Archery", damage: 8, weight: 8, value: 70 },
  ancient_nord_helmet: { name: "Ancient Nord Helmet", slot: "head", type: "heavy", armor: 17, weight: 4, value: 45 },
  ancient_nord_armor: { name: "Ancient Nord Armor", slot: "chest", type: "heavy", armor: 25, weight: 38, value: 125 },
  ancient_nord_gauntlets: { name: "Ancient Nord Gauntlets", slot: "hands", type: "heavy", armor: 10, weight: 8, value: 25 },
  ancient_nord_boots: { name: "Ancient Nord Boots", slot: "feet", type: "heavy", armor: 10, weight: 8, value: 25 },
  dwarven_sword: { name: "Dwarven Sword", slot: "weapon", hands: 1, skill: "One-Handed", damage: 12, weight: 14, value: 135 },
  dwarven_war_axe: { name: "Dwarven War Axe", slot: "weapon", hands: 1, skill: "One-Handed", damage: 13, weight: 16, value: 165 },
  dwarven_bow: { name: "Dwarven Bow", slot: "weapon", hands: 2, skill: "Archery", damage: 12, weight: 10, value: 270 },
  dwarven_helmet: { name: "Dwarven Helmet", slot: "head", type: "heavy", armor: 18, weight: 12, value: 200 },
  dwarven_armor: { name: "Dwarven Armor", slot: "chest", type: "heavy", armor: 34, weight: 45, value: 400 },
  forsworn_sword: { name: "Forsworn Sword", slot: "weapon", hands: 1, skill: "One-Handed", damage: 8, weight: 10, value: 30 },
  forsworn_armor: { name: "Forsworn Armor", slot: "chest", type: "light", armor: 20, weight: 6, value: 55 },
  golden_claw: { name: "Golden Claw", slot: "trophy", weight: 0.3, value: 100 },
  dragonstone: { name: "Dragonstone", slot: "trophy", weight: 20, value: 0 },
  ing_spider_egg: { name: "Spider Egg", slot: "ingredient", weight: 0.2, value: 5 },
  ing_bone_meal: { name: "Bone Meal", slot: "ingredient", weight: 0.5, value: 5 },
  ing_skeever_tail: { name: "Skeever Tail", slot: "ingredient", weight: 0.2, value: 3 },
});

const DUNGEONS = (() => {
  const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const REFILL_SECONDS = 3 * 2 * 3600;    // 3 in-game days (6 real hours; 1 in-game day = 2 real hours). Skyrim uses 10–30 days; shortened on request

  // dungeon foes ([OURS] numbers on the same scale as the road encounters in data.js)
  const E = (name, health, damage, tags, gold, text) => ({ name, health, damage, tags, gold, text, level: tags.includes("big") ? 20 : tags.includes("elite") ? 12 : 6, danger: tags.includes("elite") ? "high" : "medium" });   // [OURS] levels: how far below you a foe has to be before it catches up
  const ENEMY = {
    skeever: E("Skeever", 15, 3, ["beast"], [0, 0], "Skeevers boil out of a crack in the wall."),
    restless: E("Restless draugr", 40, 8, ["undead"], [2, 10], "A shrivelled corpse in a burial niche opens glowing eyes."),
    draugr: D.ENCOUNTERS.find((e) => e.name === "Draugr"),
    skeleton: D.ENCOUNTERS.find((e) => e.name === "Skeleton"),
    spider: D.ENCOUNTERS.find((e) => e.name === "Frostbite spider"),
    wight: E("Draugr wight", 105, 16, ["undead", "elite"], [10, 40], "An armoured draugr steps out of its alcove, axe raised."),
    scourge: E("Draugr scourge", 160, 21, ["undead", "elite"], [30, 80], "A draugr in a horned helm bellows in the old tongue."),
    deathlord: E("Draugr deathlord", 230, 27, ["undead", "elite", "big"], [60, 140], "The deathlord rises from its throne. The air turns to frost."),
    wolf: D.ENCOUNTERS.find((e) => e.name === "Lone wolf"),
    wolves: D.ENCOUNTERS.find((e) => e.name === "Wolf pack"),
    bear: D.ENCOUNTERS.find((e) => e.name === "Black bear"),
    bandit: D.ENCOUNTERS.find((e) => e.name === "Bandit outlaw"),
    thug: E("Bandit thug", 100, 17, ["humanoid", "elite"], [15, 45], "A bandit in heavy iron armour blocks the passage."),
    chief: E("Bandit chief", 170, 22, ["humanoid", "elite"], [60, 150], "\"You picked the wrong cave, friend.\" The chief hefts a warhammer."),
    giantSpider: E("Giant frostbite spider", 150, 20, ["beast", "big", "elite"], [0, 0], "Something huge drops from the ceiling on a thread of silk."),
    dwarvenSpider: E("Dwarven spider", 35, 8, ["construct"], [0, 5], "A brass spider skitters out of a pipe, crackling with sparks."),
    falmer: E("Falmer", 70, 14, ["humanoid"], [0, 15], "A blind, pale Falmer sniffs the air and screeches."),
    sphere: E("Dwarven sphere", 110, 18, ["construct", "elite"], [5, 20], "A brass ball rolls out of the floor and unfolds into a warrior."),
    sphereMaster: E("Dwarven sphere master", 160, 21, ["construct", "elite"], [20, 60], "A sphere twice the usual size unfolds, its crossbow already wound."),
    centurion: E("Dwarven centurion", 230, 27, ["construct", "elite", "big"], [40, 120], "Steam roars. A brass giant lumbers out of its dock."),
    forsworn: D.ENCOUNTERS.find((e) => e.name === "Forsworn ambush"),
    briarheart: E("Forsworn briarheart", 120, 19, ["humanoid", "elite"], [20, 60], "A Forsworn with a briar thrust through his chest charges you."),
    hagraven: E("Hagraven", 150, 20, ["humanoid", "elite"], [40, 110], "Half woman, half bird. The hagraven cackles and conjures fire."),
    thrall: E("Vampire thrall", 55, 11, ["humanoid"], [2, 15], "A pale, glassy-eyed servant lunges at you."),
    vampire: D.ENCOUNTERS.find((e) => e.name === "Vampire"),
    elder: E("Vampire elder", 160, 21, ["undead", "humanoid", "elite"], [40, 110], "An old vampire rises from a stone throne, licking its lips."),
    master: E("Master vampire", 230, 26, ["undead", "humanoid", "elite"], [70, 180], "\"Fresh blood, walking in on its own.\""),
    necro: E("Necromancer", 65, 14, ["humanoid"], [10, 40], "A robed mage looks up from a corpse and smiles."),
    necroMaster: E("Necromancer master", 150, 20, ["humanoid", "elite"], [40, 110], "\"Another volunteer for my work.\" Corpses twitch around the master's feet."),
    lich: E("Dragon priest", 230, 27, ["undead", "elite", "big"], [80, 200], "A masked dragon priest floats up from its tomb."),
    giant: D.ENCOUNTERS.find((e) => e.name === "Giant"),
    dragon: E("Dragon", 300, 30, ["big", "dragon", "elite"], [100, 300], "The dragon wakes on its perch, unfolds its wings and roars your death."),
    thalmor: D.ENCOUNTERS.find((e) => e.name === "Thalmor patrol"),
    justiciar: E("Thalmor justiciar", 180, 23, ["humanoid", "elite"], [80, 160], "\"Your name is on a list, Nord.\""),
  };

  const THEMES = {
    barrow: { name: "Nordic barrow", foes: [["skeever", 1], ["restless", 4], ["draugr", 3], ["skeleton", 2], ["spider", 1]], elite: ["wight"],
      boss: ["wight", "scourge", "deathlord"], loot: ["ancient_nord_sword", "ancient_nord_war_axe", "ancient_nord_bow", "ancient_nord_helmet", "ancient_nord_boots", "ancient_nord_gauntlets", "ancient_nord_greatsword", "ancient_nord_armor", "ing_bone_meal"],
      puzzle: true, words: true, traps: ["swinging blades", "a dart wall", "an oil slick under a hanging brazier", "a pressure plate under a ceiling of spikes"] },
    cave: { name: "cave", foes: [["skeever", 2], ["wolf", 2], ["bandit", 4], ["spider", 2], ["wolves", 1], ["bear", 1]], elite: ["thug", "giantSpider"],
      boss: ["thug", "chief", "chief"], loot: ["ing_spider_egg", "ing_skeever_tail"], traps: ["a bear trap in the gravel", "a tripwire tied to a log", "a loose ceiling ready to fall"] },
    mine: { name: "bandit mine", foes: [["bandit", 5], ["skeever", 1], ["wolf", 1]], elite: ["thug"], boss: ["thug", "chief", "chief"], loot: ["ing_skeever_tail"],
      traps: ["a tripwire tied to a rockfall", "a bear trap by the ore cart"] },
    dwemer: { name: "Dwemer ruin", foes: [["dwarvenSpider", 4], ["falmer", 3], ["spider", 1]], elite: ["sphere"], boss: ["sphere", "sphereMaster", "centurion"],
      loot: ["dwarven_sword", "dwarven_war_axe", "dwarven_bow", "dwarven_helmet", "dwarven_armor"], puzzle: true, traps: ["steam vents", "a blade trap in the floor grate", "a sparking pressure plate"] },
    forsworn: { name: "Forsworn redoubt", foes: [["forsworn", 5], ["wolf", 1], ["skeever", 1]], elite: ["briarheart"], boss: ["briarheart", "hagraven", "hagraven"],
      loot: ["forsworn_sword", "forsworn_armor"], traps: ["a rune painted on the floor", "a spiked log on a tripwire"] },
    vampire: { name: "vampire lair", foes: [["thrall", 4], ["skeever", 2], ["vampire", 1]], elite: ["vampire"], boss: ["vampire", "elder", "master"], loot: ["ing_bone_meal"],
      traps: ["a rune painted on the floor", "a spiked log on a tripwire"] },
    temple: { name: "temple ruin", foes: [["necro", 3], ["skeleton", 3], ["restless", 2]], elite: ["necro"], boss: ["necro", "necroMaster", "lich"], loot: ["ing_bone_meal"],
      puzzle: true, words: true, traps: ["a rune painted on the floor", "a dart wall"] },
    fort: { name: "fort", foes: [["bandit", 6], ["wolf", 1]], elite: ["thug"], boss: ["thug", "chief", "chief"], loot: [],
      traps: ["a tripwire tied to a spiked log", "a bear trap by the gate"] },
    thalmor: { name: "Thalmor keep", foes: [["thalmor", 1], ["bandit", 1]], elite: ["thalmor"], boss: ["justiciar", "justiciar", "justiciar"], loot: [], traps: ["a rune painted on the floor"] },
  };
  THEMES.banditcamp = { ...THEMES.fort, name: "bandit camp", traps: ["a tripwire strung between two tents", "a bear trap hidden under leaves"] };
  // place -> [theme, tier 1..3]. Anything not listed uses its map kind.
  const PLACE = {
    "Bleak Falls Barrow": ["barrow", 1], "Embershard Mine": ["mine", 1], "Swindler's Den": ["cave", 1], "Pinewatch": ["cave", 1],
    "Wolfskull Cave": ["cave", 2], "Blind Cliff Cave": ["forsworn", 2], "Deepwood Redoubt": ["forsworn", 3], "Lost Valley Redoubt": ["forsworn", 2],
    "Hag's End": ["forsworn", 3], "Bloodlet Throne": ["vampire", 3], "Broken Fang Cave": ["vampire", 2], "Mzulft": ["dwemer", 3],
    "Raldbthar": ["dwemer", 2], "Alftand": ["dwemer", 3], "Nightcaller Temple": ["temple", 2], "Labyrinthian": ["temple", 3],
    "Ustengrav": ["barrow", 3], "Saarthal": ["barrow", 2], "Ysgramor's Tomb": ["barrow", 3], "Forelhost": ["barrow", 3],
    "Shroud Hearth Barrow": ["barrow", 2], "Volunruud": ["barrow", 3], "Yngol Barrow": ["barrow", 2], "Ragnvald": ["barrow", 3],
    "Dead Men's Respite": ["barrow", 2], "Folgunthur": ["barrow", 2], "Hillgrund's Tomb": ["barrow", 2], "Bleakcoast Cave": ["cave", 2],
    "Northwatch Keep": ["thalmor", 3], "Valtheim Towers": ["fort", 1],
  };
  const WORDS = [["FUS", "Unrelenting Force"], ["RO", "Unrelenting Force"], ["YOL", "Fire Breath"], ["FO", "Frost Breath"], ["WULD", "Whirlwind Sprint"],
    ["IIZ", "Ice Form"], ["FEIM", "Become Ethereal"], ["LAAS", "Aura Whisper"], ["KAAN", "Kyne's Peace"], ["ZUN", "Disarm"], ["MUL", "Dragon Aspect"]];
  const ANIMALS = ["Eagle", "Snake", "Whale", "Bear", "Moth", "Owl", "Wolf", "Dragon", "Hawk", "Fox"];
  const ICON = { fight: "⚔️", elite: "💀", trap: "⚠️", treasure: "💰", puzzle: "🧩", rest: "🔥", mystery: "❓", boss: "👑" };
  const LABEL = { fight: "Fight", elite: "Tough fight", trap: "Trap", treasure: "Treasure", puzzle: "Puzzle", rest: "Rest", mystery: "Unknown", boss: "Boss" };

  const kindOf = (name) => WORLD.places[name]?.[2];
  function info(name) {
    if (PLACE[name]) return { theme: PLACE[name][0], tier: PLACE[name][1] };
    const wt = WORLD.placeThemes?.[name];
    if (wt && THEMES[wt[0]]) return { theme: wt[0], tier: wt[1] };
    const k = kindOf(name);
    if (k === "fort") return { theme: "fort", tier: 2 };
    if (k === "dungeon") return { theme: /Barrow|Tomb/.test(name) ? "barrow" : "cave", tier: 2 };
    if (k === "camp") return { theme: "giantcamp", tier: 3 };
    if (k === "lair") return { theme: "lair", tier: 3 };
    return null;
  }
  const enterable = (name) => !!info(name);
  function describe(name) {
    const i = info(name);
    if (!i) return "";
    if (i.theme === "giantcamp") return "A giant's camp. One giant, one very bad idea.";
    if (i.theme === "lair") return "A dragon lair. Bones and scorched rock everywhere.";
    return `${THEMES[i.theme].name[0].toUpperCase() + THEMES[i.theme].name.slice(1)} · ${["", "easy", "hard", "deadly"][i.tier]}`;
  }
  function refillLeft(s, name, t = G.now()) { const c = (s.cleared || {})[name]; return c ? Math.max(0, c + REFILL_SECONDS - t) : 0; }

  // ---- the map: rows of 2-3 rooms, each room links to 1-2 rooms in the next row, last row is the boss
  function layout(theme, tier) {
    const T = THEMES[theme], rows = [];
    const n = 4 + tier;
    for (let r = 0; r < n; r++) {
      const w = r === 0 ? 2 : rint(2, 3), row = [];
      for (let c = 0; c < w; c++) {
        let type;
        const x = Math.random();
        if (r === 0) type = x < 0.7 ? "fight" : "trap";
        else if (r === n - 1) type = x < 0.6 ? "rest" : x < 0.8 ? "treasure" : "mystery";   // a breather before the boss
        else type = x < 0.38 ? "fight" : x < 0.5 ? "elite" : x < 0.62 ? "trap" : x < 0.74 ? "treasure" : x < 0.84 ? "mystery" : x < 0.93 ? "rest" : (T.puzzle ? "puzzle" : "mystery");
        row.push({ type, links: [] });
      }
      rows.push(row);
    }
    rows.push([{ type: "boss", links: [] }]);
    for (let r = 0; r < rows.length - 1; r++) {
      const a = rows[r], b = rows[r + 1];
      a.forEach((node, i) => {
        const pos = a.length === 1 ? 0 : i / (a.length - 1) * (b.length - 1);
        node.links = [...new Set([Math.floor(pos), Math.ceil(pos)])];
        if (node.links.length === 1 && b.length > 1 && Math.random() < 0.5) node.links.push(clamp(node.links[0] + (Math.random() < 0.5 ? -1 : 1), 0, b.length - 1));
        node.links = [...new Set(node.links)].sort();
      });
      b.forEach((_, j) => { if (!a.some((n) => n.links.includes(j))) a[Math.min(a.length - 1, Math.round(j / Math.max(1, b.length - 1) * (a.length - 1)))].links.push(j); });
    }
    return rows;
  }

  function foe(s, key, tier, boss = false) {
    const def = ENEMY[key], e = def.priest && typeof PRIESTS !== "undefined" ? G.scaleQuestFoe({ ...def }, G.fightLevel ? G.fightLevel(s) : s.level, PRIESTS.rec(s)) : G.scaleEnemy({ ...def }, G.fightLevel ? G.fightLevel(s) : s.level);   // fair levelling: foes follow your fighting skills   // [OURS] priests are story foes
    const m = boss ? 0.8 : [0, 0.8, 0.95, 1.1][tier];   // [OURS] bosses already pick a tougher foe per tier
    e.health = Math.round(e.health * m); e.hp = e.health; e.damage = Math.round(e.damage * m * 10) / 10;
    return e;
  }
  function weighted(list) { let r = Math.random() * list.reduce((a, [, w]) => a + w, 0); return list.find(([, w]) => (r -= w) < 0)[0]; }

  function enter(s, t = G.now()) {
    const name = s.location, i = info(name);
    if (!i) return "There's nowhere to go in here.";
    if (s.trip) return "Finish your trip first.";
    const left = refillLeft(s, name, t);
    if (left) return `You cleared ${name}. It's empty for now; in about ${Math.ceil(left / 3600)} hours something new will have moved in.`;
    if (i.theme === "giantcamp" || i.theme === "lair") {
      const key = i.theme === "lair" ? "dragon" : "giant";
      s.dungeon = { place: name, theme: i.theme, tier: i.tier, rows: [[{ type: "boss", links: [] }]], row: -1, col: 0, room: null, found: [], gold: 0, t };
      s.dungeon.boss = key;
    } else s.dungeon = { place: name, theme: i.theme, tier: i.tier, rows: layout(i.theme, i.tier), row: -1, col: 0, room: null, found: [], gold: 0, t };
    if (typeof PRIESTS !== "undefined") PRIESTS.onEnter(s);   // [Skyrim] a dragon priest sleeps at the end
    G.setHealth(s, G.curHealth(s, t), t);
    G.note(s, `🕯 Entered ${name}`);
    return null;
  }
  const nextChoices = (s) => { const d = s.dungeon; if (!d || d.room) return []; return d.row < 0 ? d.rows[0].map((_, i) => i) : d.rows[d.row][d.col].links; };

  function found(s, text) { s.dungeon.found.push(text); }
  function giveFound(s, item, n = 1) { if (n === 1 && D.ITEMS[item]?.slot === "ammo" && typeof AMMO !== "undefined") n = rint(...AMMO.LOOT_QTY[D.ITEMS[item].ammo]); G.give(s, item, n); found(s, D.ITEMS[item].name + (n > 1 ? ` ×${n}` : "")); return D.ITEMS[item].name; }
  function goldFound(s, g) { s.gold += g; s.dungeon.gold += g; return g; }

  function buildRoom(s, type) {
    const d = s.dungeon, T = THEMES[d.theme];
    if (type === "fight") { const e = foe(s, weighted(T.foes), d.tier); return { type, enemy: e, text: e.text }; }
    if (type === "elite") { const e = foe(s, pick(T.elite), d.tier); return { type, enemy: e, text: e.text }; }
    if (type === "boss") {
      const key = d.boss || T.boss[d.tier - 1], e = foe(s, key, d.tier, true);
      e.boss = true;
      return { type, enemy: e, text: d.boss ? e.text : `${e.text} This is the master of ${d.place}.` };
    }
    if (type === "trap") { const trap = pick(T.traps); return { type, trap, text: `The way ahead is guarded by ${trap}.` }; }
    if (type === "treasure") { const tier = clamp(d.tier - 1 + rint(0, 2), 0, 4); return { type, tier, tries: 3, text: `A heavy chest sits in an alcove. The lock looks ${LOCK_TIERS[tier][0].toLowerCase()}.` }; }
    if (type === "rest") return { type, text: d.theme === "barrow" || d.theme === "temple" ? "A quiet side chamber with a smouldering brazier and a row of burial urns." : "A quiet nook with an old bedroll and a few crates." };
    if (type === "puzzle") {
      const order = [...ANIMALS].sort(() => Math.random() - 0.5).slice(0, 3);
      const perms = [order, [order[1], order[0], order[2]], [order[2], order[1], order[0]], [order[0], order[2], order[1]]].sort(() => Math.random() - 0.5).slice(0, 3);
      if (!perms.includes(order)) perms[0] = order;
      perms.sort(() => Math.random() - 0.5);
      const clue = d.theme === "dwemer"
        ? `A dead adventurer's note: "The pipes are marked ${order[0]}, ${order[1]} and ${order[2]}. Open them in that order or get cooked." Three valves face a sealed door.`
        : `Three rotating pillars stand before a sealed gate. Above it, three stone heads have fallen into the dust: a ${order[0].toLowerCase()} on the left, a ${order[1].toLowerCase()} in the middle, a ${order[2].toLowerCase()} on the right.`;
      return { type, order: order.join("-"), options: perms.map((p) => p.join("-")), text: clue };
    }
    // mystery: one of a few odd things
    const pool = ["corpse", "book", "shrine", "egg"].concat(d.theme === "barrow" || d.theme === "temple" ? ["coffin", "coffin"] : []).concat(["cave", "mine", "fort"].includes(d.theme) ? ["stash"] : []);
    const m = pick(pool);
    if (m === "book") { const [title, skill] = pick(SKILL_BOOKS); return { type, m, title, skill, text: `On a stone pedestal lies a dusty book: "${title}".` }; }
    const texts = {
      corpse: "A dead adventurer slumps against the wall, still holding a torch. Someone got here before you. Not far enough, though.",
      shrine: `A forgotten shrine to ${pick(DIVINES)} glows faintly in the dark.`,
      egg: "Thick webs cover the passage. Egg sacs pulse in the corners.",
      coffin: "A sealed sarcophagus. The lid has been pushed aside an inch, from the inside.",
      stash: "Behind a loose board: somebody's hidden stash.",
    };
    return { type, m, text: texts[m] };
  }
  function enterRoom(s, col) {
    const d = s.dungeon;
    if (!nextChoices(s).includes(col)) return "You can't get there from here.";
    d.row += 1; d.col = col;
    d.room = buildRoom(s, d.rows[d.row][col].type);
    return null;
  }
  function roomChoices(s) {
    const d = s.dungeon, r = d?.room;
    if (!r) return [];
    const pot = G.countRestore(s, "health") ? [["potion", `Drink a healing potion (${G.countRestore(s, "health")})`]] : [];
    if (r.type === "fight" || r.type === "elite") return [["fight", "Fight"], ["sneak", "Sneak past"], ...pot];
    if (r.type === "boss") return [["fight", "Fight"], ...pot];
    if (r.type === "trap") return [["dash", "Time it and dash through (Acrobatics)"], ["trigger", "Look for the trigger (Sneak)"], ["walk", "Just push through"]];
    if (r.type === "treasure") return [["pick", `Pick the lock (${r.tries} picks left)`], ...(POWERS.stone(s) === "tower" && r.tier <= 3 && POWERS.powerReady(s, "stone") ? [["tower", "Use the Tower Stone's power"]] : []), ["smash", "Smash it open"], ["skip", "Leave it"]];
    if (r.type === "rest") return [["rest", "Rest and bandage your wounds"], ["search", "Search the place"]];
    if (r.type === "puzzle") return [...r.options.map((o) => [`set:${o}`, `Set them to ${o.replace(/-/g, ", ")}`]), ["skip", "Ignore it"]];
    if (r.m === "book") return [["read", "Read it"], ["skip", "Leave it"]];
    if (r.m === "shrine") return [["pray", "Pray"], ["skip", "Walk on"]];
    if (r.m === "egg") return [["burn", "Cut through and gather the eggs"], ["skip", "Find a way round"]];
    if (r.m === "coffin") return [["open", "Push the lid open"], ["skip", "Leave it be"]];
    return [["loot", "Search it"], ["skip", "Leave it"]];
  }
  const dmg = (s, lo, hi) => { const d = s.dungeon, x = Math.round(G.maxHealth(s) * rnd(lo, hi) * [0, 0.8, 1, 1.2][d.tier]); G.setHealth(s, G.curHealth(s) - x); return x; };
  function themeLoot(s, chance) { const T = THEMES[s.dungeon.theme]; return T?.loot?.length && Math.random() < chance ? [giveFound(s, pick(T.loot))] : []; }

  function fight(s, e, opts, t) {
    const f = new G.Fight(s, e, null, t);
    f.run({ t, enemyFirst: !!opts.enemyFirst });
    const skills = f.apply(t);
    if (!f.won) return { f, skills };
    const g = goldFound(s, rint(...(e.gold || [0, 0])));
    const loot = G.rollLoot ? G.rollLoot(s, e) : [];
    loot.forEach((n) => found(s, n));
    loot.push(...themeLoot(s, e.tags.includes("undead") || e.tags.includes("construct") ? 0.25 : 0.1));
    return { f, skills, gold: g, loot };
  }

  /* Resolve a choice in the current room. Returns {text, skills?, fight?, gold?, loot?, died?, bag?, cleared?, stay?} */
  function act(s, choice, t = G.now()) {
    const d = s.dungeon, r = d?.room;
    if (!r) return { text: "" };
    const done = (o) => { d.room = null; return o; };
    const lose = (res, cause) => { const dd = G.die(s, cause, t); s.dungeon = null; return { ...res, died: dd.msg, bag: dd.bag }; };
    if (choice === "potion") { const m = G.drinkPotion(s, t); return { text: m, stay: true }; }

    if (r.enemy) {
      const e = r.enemy;
      if (choice === "sneak") {
        const ch = clamp(G.hiddenChance(s, { danger: r.type === "elite" ? "high" : "medium" }, t) + 0.05, 0.05, 0.95);   // [OURS] same detection as the road
        const skills = G.useSkill(s, "Sneak", 2.5 + 0.625 * 8);                                           // [Skyrim] hiding XP
        if (Math.random() < ch) return done({ text: `You hug the shadows and slip past the ${e.name.toLowerCase()}.`, skills });
        const res = fight(s, e, { enemyFirst: true }, t);
        res.text = `Your foot scrapes the stone. The ${e.name.toLowerCase()} turns.`;
        res.skills = [...skills, ...res.skills];
        if (!res.f.won) return lose({ ...res, fight: res.f }, e.name);
        return done({ ...res, fight: res.f });
      }
      const res = fight(s, e, {}, t);
      if (!res.f.won) return lose({ text: "", fight: res.f, skills: res.skills }, e.name);
      if (r.type !== "boss") return done({ text: `The ${e.name.toLowerCase()} falls.`, fight: res.f, skills: res.skills, gold: res.gold, loot: res.loot });
      // boss down: the big chest, maybe a word wall, the place is cleared
      const extra = [];
      const g = goldFound(s, rint(60, 160) * d.tier);
      for (const [item, c] of D.LOOT.elite) if (Math.random() < c * (0.6 + 0.3 * d.tier)) extra.push(giveFound(s, item));
      extra.push(...themeLoot(s, 0.9));
      if (typeof PRIESTS !== "undefined") extra.push(...PRIESTS.onBoss(s, d, e));   // the dragon priest's mask, once
      if (d.place === "Bleak Falls Barrow" && !s.inv.some((x) => x.item === "golden_claw")) { extra.push(giveFound(s, "golden_claw")); extra.push(giveFound(s, "dragonstone")); }
      let word = "";
      if (typeof SHOUTS2 !== "undefined") {   // [Skyrim] Word Walls stand at fixed places and each teaches its own shout (shouts2.js)
        const w = SHOUTS2.readWall(s, d.place);
        if (w) word = ` Behind the throne, a Word Wall hums. One word burns itself into your mind: ${w[0]} (${w[1]}). ${POWERS.unlocked(s, w[0]) ? "" : "A dragon soul will unlock it (Magic → Shouts)."}`;
      } else if (THEMES[d.theme]?.words && (d.place === "Bleak Falls Barrow" || Math.random() < 0.6)) {   // [Skyrim] Word Walls
        const w = d.place === "Bleak Falls Barrow" && !POWERS.known(s, "FUS") ? ["FUS", "Unrelenting Force"] : POWERS.nextWord(s);
        if (w) {
          POWERS.learnWord(s, w[0]);
          word = ` Behind the throne, a Word Wall hums. One word burns itself into your mind: ${w[0]} (${w[1]}). ${POWERS.unlocked(s, w[0]) ? "" : "A dragon soul will unlock it (Hero tab)."}`;
        }
      }
      let partyChest = null;
      if (res.f.allies?.some((a) => a.player) && !d.run) {   // (co-op runs share a fair chest instead: coop.js)
          // fought with your party: the boss chest is shared... in theory
        partyChest = { gold: g, items: [] };
        s.gold -= g; d.gold -= g;
        for (const name of extra) { const row = [...s.inv].reverse().find((x) => D.ITEMS[x.item].name === name && !["golden_claw", "dragonstone"].includes(x.item) && !D.ITEMS[x.item].noTrade); if (row) { partyChest.items.push(row.item); G.take(s, row.id); d.found.splice(d.found.indexOf(name), 1); } }
      }
      s.cleared = s.cleared || {}; s.cleared[d.place] = t;
      d.room = null; d.done = true;
      G.note(s, `🏆 Cleared ${d.place}`);
      const falls = e.priest ? `${e.name.split(",")[0]} falls, and the mask clatters to the floor.` : `The ${e.name.toLowerCase()} falls.`;   // dragon priests have names
      if (partyChest) return { text: `${falls} Behind it stands a chest full of treasure: ${g} gold${partyChest.items.length ? ", " + partyChest.items.map((i) => D.ITEMS[i].name).join(", ") : ""}. It belongs to the whole party... for now.${word}`, fight: res.f, skills: res.skills, gold: res.gold, loot: res.loot, cleared: true, partyChest };
      return { text: `${falls} In the chest behind it: ${g} gold${extra.length ? ", " + extra.join(", ") : ""}.${word}`, fight: res.f, skills: res.skills, gold: res.gold, loot: res.loot, cleared: true };
    }

    if (r.type === "trap") {
      if (choice === "dash") {
        const ch = clamp(0.45 + G.skill(s, "Acrobatics") / 150 + 0.15 * G.P(s, "sure_footed") + G.fxSum(s, "trapdodge") / 100, 0.1, 0.95), skills = G.useSkill(s, "Acrobatics", 3);   // [OURS]
        if (Math.random() < ch) return done({ text: `You time it and dive past ${r.trap}.`, skills });
        const x = dmg(s, 0.15, 0.3);
        if (G.curHealth(s) <= 0) return lose({ text: `${r.trap} catches you.` }, r.trap);
        return done({ text: `Too slow. ${r.trap[0].toUpperCase() + r.trap.slice(1)} catches you (−${x} health).`, skills });
      }
      if (choice === "trigger") {
        const ch = G.P(s, "light_foot") ? 1 : clamp(0.35 + G.skill(s, "Sneak") / 120, 0.1, 0.95), skills = G.useSkill(s, "Sneak", 5);
        if (Math.random() < ch) {
          const g = goldFound(s, rint(3, 20));
          return done({ text: `You spot the trigger and step around it. Whoever didn't left ${g} gold behind.`, skills });
        }
        const x = dmg(s, 0.2, 0.35);
        if (G.curHealth(s) <= 0) return lose({ text: "You found the trigger. With your foot." }, r.trap);
        return done({ text: `You find the trigger by stepping on it (−${x} health).`, skills });
      }
      const x = dmg(s, 0.1, 0.2);
      if (G.curHealth(s) <= 0) return lose({ text: "That was the wrong way to do it." }, r.trap);
      return done({ text: `You grit your teeth and push through (−${x} health).` });
    }

    if (r.type === "treasure") {
      if (choice === "skip") return done({ text: "You leave the chest alone." });
      if (choice === "smash") {
        if (Math.random() < 0.35) { const g = goldFound(s, rint(5, 25) * (r.tier + 1)); return done({ text: `You batter it open. Most of what was inside is ruined; you salvage ${g} gold.` }); }
        return done({ text: "The chest wins. You move on with sore arms." });
      }
      if (choice === "tower") s.stonePowerAt = t;
      const ch = choice === "tower" ? 1 : G.lockChance(s, r.tier);
      if (choice === "tower" || G.lockRoll(s, ch)) {
        const skills = G.useSkill(s, "Lockpicking", LOCK_TIERS[r.tier][1]);                            // [Skyrim] XP per lock tier
        const g = goldFound(s, Math.round(rint(15, 40) * (r.tier + 1) * (G.P(s, "golden_touch") ? 1.5 : 1))), loot = [];
        for (const [item, c] of D.LOOT[r.tier >= 3 ? "elite" : "humanoid"]) if (Math.random() < c * 1.5 * (G.P(s, "treasure_hunter") ? 1.5 : 1)) loot.push(giveFound(s, item));
        loot.push(...themeLoot(s, 0.5));
        return done({ text: `Click. Inside: ${g} gold${loot.length ? ", " + loot.join(", ") : ""}.`, skills });
      }
      if (!G.P(s, "unbreakable")) r.tries -= 1;
      const skills = G.useSkill(s, "Lockpicking", 0.25);                                                // [Skyrim] 0.25 XP per broken pick
      if (r.tries > 0) return { text: "Snap. The pick breaks.", skills, stay: true };
      return done({ text: "Your last pick snaps. The chest stays shut.", skills });
    }

    if (r.type === "rest") {
      if (choice === "rest") { const before = G.curHealth(s); G.setHealth(s, before + G.maxHealth(s) * 0.45); return done({ text: `You catch your breath and bind your wounds (${Math.round(before)} → ${Math.round(G.curHealth(s))} health).` }); }  // [OURS] 45%
      if (Math.random() < 0.2) { const res = fight(s, foe(s, "skeever", s.dungeon.tier), { enemyFirst: true }, t); if (!res.f.won) return lose({ text: "", fight: res.f }, "Skeever"); return done({ text: "Something in the urns bites back. A skeever!", fight: res.f, skills: res.skills }); }
      const g = goldFound(s, rint(5, 30)), loot = Math.random() < 0.4 ? [giveFound(s, "potion_health_minor")] : [];
      return done({ text: `You find ${g} gold${loot.length ? " and a " + loot[0] : ""}.` });
    }

    if (r.type === "puzzle") {
      if (choice === "skip") return done({ text: "You leave the puzzle for someone with more patience." });
      if (choice === `set:${r.order}`) {
        const g = goldFound(s, rint(40, 90) * d.tier), loot = [];
        for (const [item, c] of D.LOOT.elite) if (Math.random() < c) loot.push(giveFound(s, item));
        loot.push(...themeLoot(s, 0.8));
        return done({ text: `With a grinding of stone the way opens onto a hidden chamber: ${g} gold${loot.length ? ", " + loot.join(", ") : ""}.` });
      }
      r.options = r.options.filter((o) => `set:${o}` !== choice);
      const x = dmg(s, 0.08, 0.16);
      if (G.curHealth(s) <= 0) return lose({ text: "Wrong order. Very wrong." }, "a puzzle");
      return { text: `Wrong. Darts hiss out of the walls (−${x} health).`, stay: true };
    }

    // mystery rooms
    if (choice === "skip") return done({ text: "You leave it and move on." });
    if (r.m === "book") {
      const sk = s.skills[r.skill];
      if (sk.lvl >= 100) return done({ text: "There's nothing in it you don't already know." });
      sk.lvl += 1; s.charXp += sk.lvl; const msgs = [];
      while (s.charXp >= F.charXpNeeded(s.level)) { s.charXp -= F.charXpNeeded(s.level); s.level++; s.pendingLevels++; msgs.push(`You reached level ${s.level}!`); }
      return done({ text: `You read "${r.title}". ${r.skill} increased to ${sk.lvl}.`, skills: msgs });   // [Skyrim] skill books +1
    }
    if (r.m === "shrine") { G.setHealth(s, G.maxHealth(s)); return done({ text: "You kneel. Your wounds close." }); }
    if (r.m === "egg") {
      if (Math.random() < 0.35) { const res = fight(s, foe(s, "spider", d.tier), { enemyFirst: true }, t); if (!res.f.won) return lose({ text: "", fight: res.f }, "Frostbite spider"); const n = giveFound(s, "ing_spider_egg", 3); return done({ text: `Mother was home. Afterwards you gather ${n} ×3.`, fight: res.f, skills: res.skills }); }
      const n = rint(2, 4) * (G.P(s, "green_thumb") ? 2 : 1); giveFound(s, "ing_spider_egg", n); return done({ text: `You hack through the webs and gather ${n} spider eggs.` });
    }
    if (r.m === "coffin") {
      if (Math.random() < 0.5) {
        const res = fight(s, foe(s, "restless", d.tier), { enemyFirst: true }, t);
        if (!res.f.won) return lose({ text: "", fight: res.f }, "Restless draugr");
        return done({ text: "The occupant was awake.", fight: res.f, skills: res.skills, gold: res.gold, loot: res.loot });
      }
      const g = goldFound(s, rint(15, 50)), loot = themeLoot(s, 0.7);
      return done({ text: `Just bones, and grave goods: ${g} gold${loot.length ? ", " + loot.join(", ") : ""}.` });
    }
    // corpse / stash
    const g = goldFound(s, rint(10, 45)), loot = [];
    if (Math.random() < 0.6) loot.push(giveFound(s, pick(["potion_health_minor", "potion_health", "potion_magicka", "scroll_fireball", "scroll_healing"])));
    if (Math.random() < 0.3) loot.push(giveFound(s, pick(D.LOOT.humanoid)[0]));
    return done({ text: `You find ${g} gold${loot.length ? ", " + loot.join(", ") : ""}.` });
  }

  function leave(s, t = G.now()) {
    const d = s.dungeon;
    if (!d) return "";
    s.dungeon = null;
    G.setHealth(s, G.curHealth(s), t);   // regeneration starts again outside
    const got = `${d.gold} gold${d.found.length ? ", " + d.found.join(", ") : ""}`;
    G.note(s, `🕯 Left ${d.place}${d.done ? " (cleared)" : ""}. Found: ${got}.`);
    return `You climb back into daylight with ${got}.`;
  }

  return { REFILL_SECONDS, enterable, info, describe, refillLeft, enter, nextChoices, enterRoom, roomChoices, act, leave, ICON, LABEL, THEMES, ENEMY, layout };
})();
