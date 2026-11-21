/* Exploration rewards [OURS]: things worth finding off the beaten track.
   - Hand-placed secrets: a cache at a place. Some you spot the moment you discover the place; others need a search
     (and sometimes a skill: Sneak to spot a crawlspace, Lockpicking for an old strongbox, Acrobatics for a ledge).
   - A unique named item in each notable dungeon, guaranteed the first time you clear it.
   - Claw doors in some Nordic barrows: three rings of animals; the claw you find inside shows the order on its palm.
     Pillar puzzles can be solved by hand too (the same ring mini-game).
   - Lore books: short original texts collected into your Library (Journal → Discoveries).
   - Treasure maps: found in caches and boss chests. Reading one puts an X on your map; walk there and dig.
   Names and texts here are our own unless marked [Skyrim]. */
const EXPLORE = (() => {
  const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = (a) => a[Math.floor(Math.random() * a.length)];
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DIG_PX = 26;   // how close (map px) you must stand to dig up a treasure map's chest

  // ------------------------------------------------------------------ unique items, one per notable dungeon [OURS names and stats]
  const U = {
    u_bleakfalls_helm: { name: "Helm of the Barrow Warden", slot: "head", type: "heavy", armor: 19, weight: 6, value: 420, aenchant: { key: "max:health", mag: 25, name: "Fortify Health" } },
    u_embershard_pick: { name: "Embershard Cleaver", slot: "weapon", hands: 1, skill: "One-Handed", damage: 9, weight: 10, value: 260, enchant: { effect: "fire", magnitude: 8, max_magnitude: 30, base_cost: 11, capacity: 1200 } },
    u_swindler_boots: { name: "Swindler's Quiet Boots", slot: "feet", type: "light", armor: 8, weight: 2, value: 340, aenchant: { key: "skill:Sneak", mag: 15, name: "Fortify Sneak" } },
    u_pinewatch_gloves: { name: "Pinewatch Lockfingers", slot: "hands", type: "light", armor: 6, weight: 1, value: 360, aenchant: { key: "skill:Lockpicking", mag: 18, name: "Fortify Lockpicking" } },
    u_wolfskull_staffhood: { name: "Wolfskull Circlet", slot: "head", type: "light", armor: 6, weight: 1, value: 520, aenchant: { key: "max:magicka", mag: 35, name: "Fortify Magicka" } },
    u_mzulft_bow: { name: "Mzulft Steambow", slot: "weapon", hands: 2, skill: "Archery", damage: 14, weight: 10, value: 720, enchant: { effect: "shock", magnitude: 12, max_magnitude: 30, base_cost: 14, capacity: 1500 } },
    u_raldbthar_shield: { name: "Raldbthar Cog-Shield", slot: "shield", type: "heavy", armor: 29, weight: 14, value: 560, aenchant: { key: "resist", mag: 15, name: "Resist Magic" } },
    u_alftand_gauntlets: { name: "Alftand Steamfists", slot: "hands", type: "heavy", armor: 14, weight: 8, value: 610, aenchant: { key: "dmg:Two-Handed", mag: 15, name: "Fortify Two-Handed" } },
    u_nightcaller_robes: { name: "Robes of the Long Sleep", slot: "chest", type: "cloth", armor: 0, weight: 1, value: 780, aenchant: { key: "spell:Illusion", mag: 20, name: "Fortify Illusion" } },
    u_labyrinthian_mask: { name: "Mask of the Maze-Walker", slot: "head", type: "light", armor: 12, weight: 2, value: 900, aenchant: { key: "max:magicka", mag: 45, name: "Fortify Magicka" } },
    u_ustengrav_blade: { name: "Ustengrav Mourning Blade", slot: "weapon", hands: 1, skill: "One-Handed", damage: 12, weight: 11, value: 680, enchant: { effect: "frost", magnitude: 14, max_magnitude: 30, base_cost: 12, capacity: 1500 } },
    u_saarthal_amulet: { name: "Saarthal Ward-Bracers", slot: "hands", type: "light", armor: 7, weight: 1, value: 540, aenchant: { key: "spell:Destruction", mag: 15, name: "Fortify Destruction" } },
    u_ysgramor_armor: { name: "Harbinger's Old Mail", slot: "chest", type: "heavy", armor: 36, weight: 34, value: 1100, aenchant: { key: "max:stamina", mag: 40, name: "Fortify Stamina" } },
    u_forelhost_axe: { name: "Forelhost Siege-Axe", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 21, weight: 22, value: 860, enchant: { effect: "absorb", magnitude: 9, max_magnitude: 25, base_cost: 31, capacity: 1200 } },
    u_bloodlet_ring: { name: "Bloodlet Gloves", slot: "hands", type: "light", armor: 7, weight: 1, value: 600, aenchant: { key: "dmg:One-Handed", mag: 15, name: "Fortify One-Handed" } },
    u_deepwood_bow: { name: "Briar-Wood Longbow", slot: "weapon", hands: 2, skill: "Archery", damage: 13, weight: 9, value: 640, enchant: { effect: "fire", magnitude: 12, max_magnitude: 30, base_cost: 11, capacity: 1400 } },
    u_hagsend_hood: { name: "Hood of the Hag's Nest", slot: "head", type: "light", armor: 8, weight: 1, value: 580, aenchant: { key: "spell:Restoration", mag: 18, name: "Fortify Restoration" } },
    u_volunruud_greaves: { name: "Volunruud Grave-Boots", slot: "feet", type: "heavy", armor: 14, weight: 9, value: 540, aenchant: { key: "carry", mag: 40, name: "Fortify Carry Weight" } },
    u_northwatch_shield: { name: "Shield of the Broken Watch", slot: "shield", type: "light", armor: 22, weight: 5, value: 760, aenchant: { key: "resist", mag: 20, name: "Resist Magic" } },
    u_valtheim_sword: { name: "Valtheim Toll-Blade", slot: "weapon", hands: 1, skill: "One-Handed", damage: 10, weight: 10, value: 380, enchant: { effect: "shock", magnitude: 8, max_magnitude: 30, base_cost: 14, capacity: 1200 } },
    u_ragnvald_boots: { name: "Ragnvald Stalker's Boots", slot: "feet", type: "light", armor: 9, weight: 2, value: 620, aenchant: { key: "skill:Sneak", mag: 22, name: "Fortify Sneak" } },
    u_folgunthur_helm: { name: "Folgunthur Ivory Helm", slot: "head", type: "heavy", armor: 20, weight: 6, value: 650, aenchant: { key: "dmg:Archery", mag: 15, name: "Fortify Archery" } },
  };
  const UNIQUE_AT = {
    "Bleak Falls Barrow": "u_bleakfalls_helm", "Embershard Mine": "u_embershard_pick", "Swindler's Den": "u_swindler_boots", "Pinewatch": "u_pinewatch_gloves",
    "Wolfskull Cave": "u_wolfskull_staffhood", "Mzulft": "u_mzulft_bow", "Raldbthar": "u_raldbthar_shield", "Alftand": "u_alftand_gauntlets",
    "Nightcaller Temple": "u_nightcaller_robes", "Labyrinthian": "u_labyrinthian_mask", "Ustengrav": "u_ustengrav_blade", "Saarthal": "u_saarthal_amulet",
    "Ysgramor's Tomb": "u_ysgramor_armor", "Forelhost": "u_forelhost_axe", "Bloodlet Throne": "u_bloodlet_ring", "Deepwood Redoubt": "u_deepwood_bow",
    "Hag's End": "u_hagsend_hood", "Volunruud": "u_volunruud_greaves", "Northwatch Keep": "u_northwatch_shield", "Valtheim Towers": "u_valtheim_sword",
    "Ragnvald": "u_ragnvald_boots", "Folgunthur": "u_folgunthur_helm",
  };
  for (const [id, it] of Object.entries(U)) D.ITEMS[id] = { ...it, unique: true };

  // ------------------------------------------------------------------ claw doors ([Skyrim] the claws and their barrows; combinations [OURS] except the Golden Claw's)
  const CLAWS = {
    "Bleak Falls Barrow": { item: "golden_claw", combo: ["Bear", "Moth", "Owl"] },                 // [Skyrim]
    "Folgunthur": { item: "claw_ivory", name: "Ivory Dragon Claw", combo: ["Hawk", "Hawk", "Dragon"] },
    "Dead Men's Respite": { item: "claw_ruby", name: "Ruby Dragon Claw", combo: ["Snake", "Wolf", "Moth"] },
    "Shroud Hearth Barrow": { item: "claw_sapphire", name: "Sapphire Dragon Claw", combo: ["Moth", "Owl", "Wolf"] },
    "Yngol Barrow": { item: "claw_coral", name: "Coral Dragon Claw", combo: ["Snake", "Whale", "Owl"] },
    "Ragnvald": { item: "claw_iron", name: "Iron Claw", combo: ["Bear", "Whale", "Snake"] },
    "Volunruud": { item: "claw_ebony", name: "Ebony Claw", combo: ["Wolf", "Moth", "Dragon"] },
    "Forelhost": { item: "claw_glass", name: "Glass Claw", combo: ["Fox", "Moth", "Dragon"] },
  };
  for (const c of Object.values(CLAWS)) if (c.name) D.ITEMS[c.item] = { name: c.name, slot: "trophy", weight: 0.3, value: 100 };
  const RING = ["Bear", "Moth", "Owl", "Wolf", "Hawk", "Snake", "Whale", "Dragon", "Fox", "Eagle"];
  const SYM = { Bear: "🐻", Moth: "🦋", Owl: "🦉", Wolf: "🐺", Hawk: "🪶", Snake: "🐍", Whale: "🐋", Dragon: "🐉", Fox: "🦊", Eagle: "🦅" };

  // ------------------------------------------------------------------ lore books [OURS texts, short, set in Skyrim]
  const LORE = [
    ["l_ferryman", "The Ferryman of Lake Ilinalta", "Fishermen say a boat crosses the lake at dusk with no one at the oars. Those who wave at it are said to catch twice the fish the next day. Those who laugh at it don't go out on the water again."],
    ["l_salt", "A Salt-Trader's Ledger", "Windhelm pays best in winter, Solitude in spring. Never sell to the Riften man with the scarred lip, no matter how good his price sounds. I learned that one the expensive way."],
    ["l_cairn", "Why Nords Stack Stones", "Every cairn on a high pass marks a traveller who made it across. Add a stone and the mountain counts you among the living. Knock one down and it starts counting again."],
    ["l_dwemer", "Notes on a Silent Lock", "The Dwemer did not lock doors to keep thieves out. Their doors waited for the right sound, the right weight, the right order. Patience opens more of their ruins than any pick."],
    ["l_hunter", "The Hunter's Rule", "Take what you need and leave the rest to the ravens. A hunter who empties a valley in one winter starves in the next. The old ones knew this. Their children forgot it."],
    ["l_draugr", "On the Restless Dead", "The draugr are not hungry. They are loyal. They guard their tombs long after the names on the walls stopped meaning anything, waiting for an order that never comes."],
    ["l_falmer", "Letter from a Lost Expedition", "Day nineteen. The lamps are low and we hear them in the dark: clicking, then quiet. Tolf swears they see without eyes. If this reaches the surface, tell my sister the debt is paid."],
    ["l_mead", "The Mead-Hall Riddle", "What's warmer than a fire and louder than a dragon, empties your purse and fills your heart? Every child in Whiterun knows the answer. Every innkeeper hopes you never stop asking."],
    ["l_witch", "Hagraven Feathers", "A hagraven was a woman once, who traded her name for power. The feathers came later. Some say she still remembers her name and screams it when she casts."],
    ["l_road", "Road Songs of the Rift", "Carters sing on the Rift road to keep the wolves guessing. Two voices sound like a crowd, three like a caravan, and four like an army. Bandits count voices too."],
    ["l_word", "Words on Stone", "The old walls speak in the dragon tongue. To most they are scratches. To a few they are fire, and frost, and the force that knocks a man off a cliff."],
    ["l_jarl", "A Jarl's Lesson", "My father told me a hold is a cart with nine wheels. Lose one and you limp; lose three and you walk. I have tried to keep every wheel turning, even the ones that squeak."],
    ["l_moon", "The Twin Moons", "Masser is the elder, slow and red. Secunda is the younger, quick and pale. Khajiit read the moons like Nords read the weather, and argue about them just as loudly."],
    ["l_smith", "Smith's Marginalia", "Steel remembers how you treated it. Quench too fast and it cracks when you need it most. Fold it with care and it outlives you."],
    ["l_sea", "Ghost Ships of the Sea of Ghosts", "Sailors north of Dawnstar swear the fog carries bells. Follow the sound and you find wreckage. Ignore it and you find home. Most ignore it."],
    ["l_thief", "Rules Scratched Under a Cellar Stair", "Never take the last coin. Never steal from a priest. Never run in a market. And never, ever, trust a man who says he only wants the ledger."],
    ["l_dragon", "The Dragon Who Counted", "Children are told of a dragon who counted every sheep it ate and stopped at a thousand, out of courtesy. The farmers of Rorikstead do not find this story comforting."],
    ["l_stones", "A Guide to the Standing Stones", "Thirteen stones, thirteen signs. Touch one and you carry its blessing; touch another and the first lets go. No stone is jealous, but none will share."],
  ];
  const LORE_BY = Object.fromEntries(LORE.map(([id, title, text]) => [id, { id, title, text }]));

  // ------------------------------------------------------------------ treasure maps: [id, near place, offset (map units), title, hint, gold, items]
  const MAPS = [
    ["tm1", "Riverwood", [-0.012, 0.018], "Treasure Map I", "A sketch of a crooked pine south-west of Riverwood, an X by its roots.", 180, ["potion_health", "gem_garnet"]],
    ["tm2", "Ivarstead", [0.016, 0.014], "Treasure Map II", "A rough drawing of the stream below Ivarstead, a flat stone marked with an X.", 240, ["potion_magicka", "gold_ring"]],
    ["tm3", "Morthal", [-0.02, -0.012], "Treasure Map III", "Swamp reeds, a broken boat and an X west of Morthal.", 300, ["gem_amethyst", "scroll_fireball"]],
    ["tm4", "Dawnstar", [0.02, 0.01], "Treasure Map IV", "The cliffs east of Dawnstar and a little cairn drawn in charcoal.", 360, ["gem_sapphire", "potion_health"]],
    ["tm5", "Falkreath", [0.018, -0.012], "Treasure Map V", "A hunter's map: three trees in a row north-east of Falkreath, X at the third.", 280, ["gem_ruby", "potion_stamina"]],
    ["tm6", "Rorikstead", [-0.016, -0.014], "Treasure Map VI", "Rolling plains, a lone boulder and an X north-west of Rorikstead.", 320, ["gold_ruby_ring", "potion_health"]],
    ["tm7", "Karthwasten", [0.018, 0.012], "Treasure Map VII", "A ledge on the Reach river near Karthwasten, marked with a skull.", 420, ["gem_emerald", "silver_amethyst_ring"]],
    ["tm8", "Winterhold", [-0.02, 0.014], "Treasure Map VIII", "Ice, more ice, and an X south-west of Winterhold. Someone underlined it twice.", 500, ["gem_flawless_sapphire", "potion_magicka"]],
  ];
  for (const [id, , , title] of MAPS) D.ITEMS["map_" + id] = { name: title, slot: "map", weight: 0.1, value: 10, tmap: id };
  const MAP_BY = Object.fromEntries(MAPS.map(([id, near, off, title, hint, gold, items]) => [id, { id, near, off, title, hint, gold, items }]));

  // ------------------------------------------------------------------ hand-placed secrets
  // auto: found on discovery. need: [skill, level] to reach it when you search.
  const SECRETS = {
    "Riverwood Folly": { auto: true, text: "Under the ruined arch, a soldier's satchel nobody came back for.", gold: 60, items: ["potion_health"], map: "tm1" },
    "Bleak Falls Barrow": { text: "Behind the collapsed wall by the entrance, a looter's cache wrapped in oilcloth.", gold: 90, items: ["potion_health", "scroll_healing"], lore: "l_draugr" },
    "Embershard Mine": { need: ["Sneak", 20], text: "A crawlspace behind the ore cart hides a miner's stash.", gold: 70, items: ["ore_iron", "ore_iron"], lore: "l_smith" },
    "Valtheim Towers": { need: ["Acrobatics", 25], text: "A ledge under the bridge holds the bandits' toll money.", gold: 160, items: [] },
    "Guardian Stones": { auto: true, text: "Someone left an offering at the foot of the Warrior Stone.", gold: 25, items: [], lore: "l_stones" },
    "Lund's Hut": { need: ["Lockpicking", 30], text: "A strongbox nailed under the floorboards.", gold: 140, items: ["gem_amethyst"], map: "tm2" },
    "Kjenstag Ruins": { text: "A hollow under the old altar.", gold: 80, items: ["scroll_healing"], lore: "l_cairn" },
    "Gjukar's Monument": { auto: true, text: "Among the graves, a soldier's last letter and his pay.", gold: 75, items: [], lore: "l_jarl" },
    "Meeko's Shack": { text: "In the dog's bed: a chewed-up but readable map.", gold: 10, items: [], map: "tm3" },
    "Froki's Shack": { need: ["Sneak", 30], text: "Old Froki buried something behind his woodpile.", gold: 90, items: ["pelt_wolf"], lore: "l_hunter" },
    "Lost Echo Cave": { need: ["Lockpicking", 45], text: "A Dwemer coffer wedged between two pipes.", gold: 220, items: ["gem_sapphire"], lore: "l_dwemer" },
    "Frostflow Lighthouse": { text: "The keeper's logbook and a hidden purse in the lamp room.", gold: 120, items: [], lore: "l_sea", map: "tm4" },
    "Halted Stream Camp": { need: ["Sneak", 25], text: "The bandits' real loot, buried under a tent peg.", gold: 130, items: ["ore_iron"], map: "tm5" },
    "Honningbrew Meadery": { auto: true, text: "A forgotten cask in the cellar, still sealed.", gold: 40, items: [], lore: "l_mead" },
    "Robber's Cove": { need: ["Acrobatics", 35], text: "A smuggler's nook high above the water.", gold: 200, items: ["gem_ruby"], lore: "l_thief" },
    "Gallows Rock": { need: ["Lockpicking", 40], text: "The Silver Hand's war chest, behind a rusted grate.", gold: 240, items: ["potion_health"] },
    "Bonestrewn Crest": { text: "Bones, scales, and a pouch some dragon-hunter dropped.", gold: 150, items: [], lore: "l_dragon", map: "tm6" },
    "Hag Rock Redoubt": { need: ["Sneak", 35], text: "A bundle of feathers and coins tucked in a crow's nest.", gold: 170, items: [], lore: "l_witch" },
    "Sightless Pit": { need: ["Lockpicking", 50], text: "A dead explorer's pack, his last letter still inside.", gold: 260, items: ["gem_emerald"], lore: "l_falmer", map: "tm7" },
    "Shor's Stone": { auto: true, text: "A carter's songbook left on a fence post.", gold: 15, items: [], lore: "l_road" },
    "Ustengrav": { need: ["Acrobatics", 40], text: "A ledge above the bridge, and a pilgrim's offering on it.", gold: 180, items: ["potion_magicka"], lore: "l_word" },
    "Secunda's Kiss": { text: "A Khajiit star-chart wrapped around a pouch of coins.", gold: 110, items: [], lore: "l_moon" },
    "Steepfall Burrow": { need: ["Sneak", 40], text: "A burrow behind the burrow: someone's winter hoard.", gold: 160, items: [], map: "tm8" },
    "Lost Valley Redoubt": { text: "Behind the waterfall, a Forsworn shrine with old offerings.", gold: 140, items: ["silver_ring"], lore: "l_ferryman" },
  };
  const placeOk = (n) => typeof WORLD === "undefined" || !!WORLD.places[n];
  const itemOk = (i) => !!D.ITEMS[i];

  // ------------------------------------------------------------------ state
  function st(s) {
    s.explore = s.explore || {};
    const x = s.explore;
    x.secrets = x.secrets || {}; x.uniques = x.uniques || {}; x.lore = x.lore || []; x.maps = x.maps || {}; x.dug = x.dug || {};
    return x;
  }
  const now = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const give = (s, item, n = 1) => { if (!itemOk(item)) return null; G.give(s, item, n); return D.ITEMS[item].name; };

  function learnLore(s, id) {
    const x = st(s);
    if (!id || !LORE_BY[id] || x.lore.includes(id)) return null;
    x.lore.push(id);
    return LORE_BY[id];
  }
  const unfoundLore = (s) => LORE.map((l) => l[0]).filter((id) => !st(s).lore.includes(id));
  function randomLore(s) { const u = unfoundLore(s); return u.length ? learnLore(s, pick(u)) : null; }
  // a map you haven't got yet (in hand, read or dug)
  function freshMap(s) {
    const x = st(s), have = new Set(s.inv.filter((r) => D.ITEMS[r.item]?.tmap).map((r) => D.ITEMS[r.item].tmap));
    const ids = MAPS.map((m) => m[0]).filter((id) => !x.dug[id] && !x.maps[id] && !have.has(id) && placeOk(MAP_BY[id].near));
    return ids.length ? pick(ids) : null;
  }

  // ------------------------------------------------------------------ secrets
  function claim(s, place) {
    const x = st(s), sec = SECRETS[place];
    if (!sec || x.secrets[place]) return null;
    x.secrets[place] = now();
    const got = [];
    if (sec.gold) { s.gold += sec.gold; got.push(`${sec.gold} gold`); }
    for (const i of sec.items) { const n = give(s, i); if (n) got.push(n); }
    if (sec.map && !x.dug[sec.map] && !s.inv.some((r) => r.item === "map_" + sec.map)) { const n = give(s, "map_" + sec.map); if (n) got.push(n); }
    const book = sec.lore ? learnLore(s, sec.lore) : null;
    if (book) got.push(`a book: "${book.title}"`);
    if (typeof IMM !== "undefined") IMM.count(s, "secrets");
    return { text: `${sec.text} You find ${got.join(", ") || "nothing of value, sadly"}.`, got, book };
  }
  /* called when a place is discovered on the road */
  function onDiscover(s, place, log) {
    const sec = SECRETS[place];
    if (!sec || st(s).secrets[place]) return null;
    if (sec.auto) { const r = claim(s, place); if (r && log) log(s, `🔍 ${place}: ${r.text}`); return r; }
    if (log) log(s, `🔍 Something about ${place} catches your eye. Stop there and search the area.`);
    return null;
  }
  const hasSecret = (s, place) => !!SECRETS[place] && !st(s).secrets[place] && placeOk(place);
  function search(s, place = s.location) {
    if (!place || s.trip || s.dungeon) return { err: "You need to be standing somewhere to search it." };
    const sec = SECRETS[place];
    if (!sec) return { text: "You poke around, but there's nothing hidden here.", none: true };
    if (st(s).secrets[place]) return { text: "You've already found what was hidden here.", none: true };
    if (sec.need) {
      const [sk, lvl] = sec.need, have = G.skill(s, sk);
      if (have < lvl) return { text: `You can tell something is hidden here, but you can't get to it. (${sk} ${lvl} needed, you have ${Math.floor(have)}.)`, blocked: sec.need };
    }
    return claim(s, place);
  }

  // ------------------------------------------------------------------ treasure maps
  function mapPos(id) {
    const m = MAP_BY[id], p = WORLD.places[m.near];
    if (!p) return null;
    const raw = [Math.min(0.99, Math.max(0.01, p[0] + m.off[0])), Math.min(0.99, Math.max(0.01, p[1] + m.off[1]))];
    const q = typeof ROAM !== "undefined" ? ROAM.snap(raw) : raw;
    return q ? [+q[0].toFixed(4), +q[1].toFixed(4)] : [p[0], p[1]];
  }
  /* reading happens automatically: carrying a map puts its X on your world map */
  function sync(s) {
    const x = st(s);
    for (const r of s.inv) { const id = D.ITEMS[r.item]?.tmap; if (id && !x.dug[id] && !x.maps[id]) x.maps[id] = now(); }
    return x;
  }
  const openMaps = (s) => Object.keys(sync(s).maps).filter((id) => !st(s).dug[id] && MAP_BY[id] && placeOk(MAP_BY[id].near));
  const marks = (s) => openMaps(s).map((id) => ({ id, pos: mapPos(id), label: MAP_BY[id].title })).filter((m) => m.pos);
  const pxd = (a, b) => (typeof G !== "undefined" && G.pxDist ? G.pxDist(a, b) : Math.hypot((a[0] - b[0]) * 1000, (a[1] - b[1]) * 700));
  function digHere(s) {
    if (s.trip?.status === "travel" || s.dungeon) return null;
    return marks(s).find((m) => pxd([s.x, s.y], m.pos) <= DIG_PX)?.id || null;
  }
  function dig(s, id = digHere(s)) {
    if (!id || !MAP_BY[id]) return { err: "There's nothing to dig for here." };
    if (digHere(s) !== id) return { err: "This isn't the spot on the map. Walk closer to the X." };
    const x = st(s), m = MAP_BY[id];
    x.dug[id] = now(); delete x.maps[id];
    const row = s.inv.find((r) => r.item === "map_" + id); if (row) G.take(s, row.id);
    const gold = m.gold + rint(0, 60); s.gold += gold;
    const got = [`${gold} gold`];
    for (const i of m.items) { const n = give(s, i); if (n) got.push(n); }
    const book = Math.random() < 0.5 ? randomLore(s) : null; if (book) got.push(`a book: "${book.title}"`);
    if (typeof IMM !== "undefined") IMM.count(s, "treasure");
    return { text: `You dig where the X says. A rotten chest, a broken lock, and inside: ${got.join(", ")}.`, got, book };
  }

  // ------------------------------------------------------------------ dungeons: unique on first clear, claw doors, books and maps in chests
  function firstClear(s, place) {
    const x = st(s), id = UNIQUE_AT[place];
    if (!id || x.uniques[place] || !itemOk(id)) return null;
    x.uniques[place] = now();
    G.give(s, id);
    return D.ITEMS[id].name;
  }
  const ownClaw = (s, c) => s.inv.some((r) => r.item === c.item);
  function ringsFor(combo) {   // each ring: the right symbol plus a few others, in a fixed order per symbol
    return combo.map((sym, i) => { const others = RING.filter((r) => r !== sym), k = (RING.indexOf(sym) + i * 3) % others.length; return [sym, ...others.slice(k), ...others.slice(0, k)].slice(0, 6).sort(); });
  }

  if (typeof DUNGEONS !== "undefined") {
    const origEnterRoom = DUNGEONS.enterRoom, origChoices = DUNGEONS.roomChoices, origAct = DUNGEONS.act;
    DUNGEONS.enterRoom = (s, col) => {
      const d = s.dungeon, claw = d && CLAWS[d.place];
      if (claw && !d.clawOpen && !d.room && DUNGEONS.nextChoices(s).includes(col) && d.rows[d.row + 1]?.[col]?.type === "boss") {
        const from = [d.row, d.col];
        d.row += 1; d.col = col;
        const name = D.ITEMS[claw.item].name;
        d.room = { type: "puzzle", x: "claw", from, order: claw.combo.join("-"), rings: ringsFor(claw.combo), item: claw.item,
          text: `A great round door bars the way to the inner tomb. Three stone rings carved with animals turn in its face, and in the middle there's a socket shaped like a claw.${ownClaw(s, claw) ? ` The ${name} in your pack would fit.` : " Whoever holds the claw must have the answer."}` };
        return null;
      }
      return origEnterRoom(s, col);
    };
    DUNGEONS.roomChoices = (s) => {
      const r = s.dungeon?.room;
      if (r?.x === "claw") {
        const c = CLAWS[s.dungeon.place], out = [];
        if (ownClaw(s, c)) out.push([`set:${r.order}`, `Check the claw's palm and turn the rings: ${r.order.replace(/-/g, ", ")}`]);
        out.push(["game:claw", "🔘 Turn the rings yourself"]);
        return out;
      }
      const base = origChoices(s);
      if (r?.type === "puzzle" && r.options?.length > 1 && !r.x) base.splice(base.length - 1, 0, ["game:pillars", "🧩 Turn the pillars yourself"]);
      return base;
    };
    DUNGEONS.act = (s, choice, t = G.now()) => {
      const d = s.dungeon, r = d?.room, place = d?.place;
      if (r?.x === "claw") {
        if (choice === `set:${r.order}`) {
          d.clawOpen = true; d.row = r.from[0]; d.col = r.from[1]; d.room = null;
          const col = d.rows[d.row + 1] ? d.rows[d.row + 1].findIndex((n) => n.type === "boss") : 0;
          origEnterRoom(s, Math.max(0, col));
          if (typeof IMM !== "undefined") IMM.count(s, "puzzles");
          return { text: "The rings click into place. With a groan of stone the great door sinks into the floor. Something stirs beyond it.", stay: true };
        }
        if (choice.startsWith("set:")) {
          const x = Math.round(G.maxHealth(s) * rnd(0.08, 0.15) * [0, 0.8, 1, 1.2][d.tier || 1]);
          G.setHealth(s, G.curHealth(s) - x);
          if (G.curHealth(s) <= 0) { const dd = G.die(s, "a claw door", t); s.dungeon = null; return { text: "The rings lock. Darts. Many darts.", died: dd.msg, bag: dd.bag }; }
          return { text: `The rings grind and stop. Darts hiss out of the walls (−${x} health).`, stay: true };
        }
      }
      if (choice === "game:claw" || choice === "game:pillars") return { text: "", stay: true };   // the UI opens the mini-game
      const kind = r?.type, mys = r?.m;
      const res = origAct(s, choice, t);
      if (res.died || !s.dungeon) return res;
      const dd = s.dungeon, extra = [];
      // the claw lies somewhere in the first room you get through
      const claw = CLAWS[place];
      if (claw && !dd.gotClaw && kind !== "boss" && !dd.room && !ownClaw(s, claw)) {
        dd.gotClaw = true; G.give(s, claw.item); dd.found.push(D.ITEMS[claw.item].name);
        extra.push(`Among the dust you find the ${D.ITEMS[claw.item].name}. Three animals are carved into its palm: ${claw.combo.join(", ")}.`);
      }
      // books: a skill book room may hold a lore book too; treasure and mystery rooms sometimes do
      if (!dd.room && ((kind === "mystery" && mys === "book") || ((kind === "treasure" || kind === "mystery") && Math.random() < 0.12))) {
        const b = randomLore(s); if (b) { dd.found.push(`"${b.title}"`); extra.push(`📖 You pocket a book: "${b.title}". It's in your Library.`); }
      }
      if (!dd.room && kind === "treasure" && Math.random() < 0.06) { const id = freshMap(s); if (id) { G.give(s, "map_" + id); dd.found.push(MAP_BY[id].title); extra.push(`🗺 Tucked in the lid: ${MAP_BY[id].title}.`); } }
      if (res.cleared) {
        const u = firstClear(s, place);
        if (u) { dd.found.push(u); extra.push(`✨ On the boss lies something unique: ${u}.`); res.unique = u; }
        if (Math.random() < 0.3) { const id = freshMap(s); if (id) { G.give(s, "map_" + id); dd.found.push(MAP_BY[id].title); extra.push(`🗺 And a scrap of parchment: ${MAP_BY[id].title}.`); } }
      }
      if (extra.length) res.text = `${res.text || ""} ${extra.join(" ")}`.trim();
      return res;
    };
  }

  // ------------------------------------------------------------------ the ring mini-game (claw doors and pillars), Skyrim-style overlay
  let game = null;
  function openGame(s, run) {
    const r = s.dungeon?.room;
    if (!r || typeof document === "undefined") return;
    const claw = r.x === "claw" ? CLAWS[s.dungeon.place] : null;
    const rings = claw ? r.rings : (() => { const toks = [...new Set(r.options.flatMap((o) => o.split("-")))]; return [0, 1, 2].map(() => toks); })();
    game = { rings, idx: rings.map(() => 0), run, claw: !!claw, hint: claw && ownClaw(s, claw) ? claw.combo : null };
    document.querySelector("#xgame")?.remove();
    const el = document.createElement("div");
    el.id = "xgame"; el.className = "xgame"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", claw ? "Claw door" : "Pillar puzzle");
    document.body.appendChild(el);
    drawGame();
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-x]"); if (!b) return;
      const k = b.dataset.x, i = +b.dataset.i;
      if (k === "up" || k === "dn") { const n = game.rings[i].length; game.idx[i] = (game.idx[i] + (k === "up" ? 1 : n - 1)) % n; if (typeof SOUND !== "undefined") SOUND.fx("click"); drawGame(); }
      if (k === "go") { const combo = game.idx.map((j, i2) => game.rings[i2][j]).join("-"), run2 = game.run; closeGame(); run2(`set:${combo}`); }
      if (k === "x") closeGame();
    });
  }
  function drawGame() {
    const el = document.querySelector("#xgame"); if (!el || !game) return;
    el.innerHTML = `<div class="xg-in"><h3>${game.claw ? "The claw door" : "The pillars"}</h3>
      <p class="xg-sub">${game.claw ? "Turn each ring until the animals line up, then press the claw in." : "Turn each pillar to match the clue, then pull the lever."}${game.hint ? ` The claw's palm shows: <b>${game.hint.map((h) => SYM[h] + " " + h).join(", ")}</b>.` : ""}</p>
      <div class="xg-rings">${game.rings.map((ring, i) => { const sym = ring[game.idx[i]]; return `<div class="xg-ring"><button class="xg-arr" data-x="up" data-i="${i}" aria-label="Turn ring ${i + 1} up">▲</button>
        <div class="xg-face"><span class="xg-sym" aria-hidden="true">${SYM[sym] || "◆"}</span><small>${esc(sym)}</small></div><button class="xg-arr" data-x="dn" data-i="${i}" aria-label="Turn ring ${i + 1} down">▼</button></div>`; }).join("")}</div>
      <div class="xg-btns"><button class="btn pri" data-x="go">${game.claw ? "Press the claw in" : "Pull the lever"}</button><button class="btn" data-x="x">Step back</button></div></div>`;
  }
  function closeGame() { document.querySelector("#xgame")?.remove(); game = null; }

  // ------------------------------------------------------------------ UI pieces
  /* a card on the Travel tab: search here, or dig here */
  function placeCard(s) {
    if (!s || s.trip?.status === "travel" || s.dungeon) return "";
    const dg = digHere(s);
    if (dg) return `<div class="panel xcard"><h2>🗺 ${esc(MAP_BY[dg].title)}</h2><p class="sub">${esc(MAP_BY[dg].hint)} This is the spot.</p><button class="btn pri" data-act="xdig" data-id="${dg}" style="width:100%">⛏ Dig here</button></div>`;
    const l = s.location;
    if (l && hasSecret(s, l)) {
      const need = SECRETS[l].need;
      return `<div class="panel xcard"><h2>🔍 Something's hidden here</h2><p class="sub">You have a feeling ${esc(l)} isn't telling you everything.${need ? ` Getting to it may take some ${esc(need[0])}.` : ""}</p><button class="btn" data-act="xsearch" style="width:100%">🔍 Search the area</button></div>`;
    }
    return "";
  }
  function counts(s) {
    const x = sync(s);
    const sec = Object.keys(SECRETS).filter(placeOk), uni = Object.keys(UNIQUE_AT).filter(placeOk);
    return { secrets: [sec.filter((p) => x.secrets[p]).length, sec.length], uniques: [uni.filter((p) => x.uniques[p]).length, uni.length], lore: [x.lore.length, LORE.length], maps: [Object.keys(x.dug).length, MAPS.length], open: openMaps(s).length };
  }
  /* Journal → Discoveries */
  function panel(s) {
    const c = counts(s), x = st(s);
    const left = LORE.length - x.lore.length;
    const books = LORE.filter(([id]) => x.lore.includes(id)).map(([id, title]) => `<div class="item"><span class="xbook" aria-hidden="true">📖</span><div class="t">${esc(title)}</div><button class="btn sm" data-act="xread" data-id="${id}">Read</button></div>`).join("")
      + (left ? `<div class="item dim"><span class="xbook" aria-hidden="true">📕</span><div class="t">${left} more ${left === 1 ? "book" : "books"} to find<span>In dungeon chests, hidden caches and buried treasure</span></div></div>` : "");
    const maps = openMaps(s).map((id) => `<div class="item on"><span class="xbook" aria-hidden="true">🗺</span><div class="t">${esc(MAP_BY[id].title)}<span>${esc(MAP_BY[id].hint)} The X is on your map.</span></div></div>`).join("");
    const uniq = Object.entries(UNIQUE_AT).filter(([p]) => x.uniques[p]).map(([p, id]) => `<div class="item">${typeof ICONART !== "undefined" ? ICONART.item(id, 28) : "✨"}<div class="t">${esc(D.ITEMS[id].name)}<span>${esc(p)}</span></div></div>`).join("");
    return `<div class="panel"><h2>Discoveries</h2><p class="sub">Things worth finding off the road. Search places that catch your eye, clear dungeons for their one-of-a-kind treasures, collect books for your library and follow treasure maps to the X.</p>
      <div class="xstats"><span>🔍 Secrets <b>${c.secrets[0]}/${c.secrets[1]}</b></span><span>✨ Uniques <b>${c.uniques[0]}/${c.uniques[1]}</b></span><span>📖 Books <b>${c.lore[0]}/${c.lore[1]}</b></span><span>🗺 Treasure <b>${c.maps[0]}/${c.maps[1]}</b></span></div>
      ${maps ? `<h3 class="xh">Treasure maps</h3><div class="list">${maps}</div>` : ""}
      ${uniq ? `<h3 class="xh">Unique treasures</h3><div class="list">${uniq}</div>` : ""}
      <h3 class="xh">Library</h3><div class="list">${books}</div></div>`;
  }
  const bookHTML = (id) => { const b = LORE_BY[id]; return b ? `<div class="xread"><h2>📖 ${esc(b.title)}</h2><p>${esc(b.text)}</p><button class="btn" data-act="close" style="width:100%">Close</button></div>` : ""; };

  /* one entry point for the panel buttons: -> {text, html?, err?} */
  function act(s, what, id) {
    if (what === "xsearch") return search(s);
    if (what === "xdig") return dig(s, id);
    if (what === "xread") return { html: bookHTML(id) };
    return { err: "?" };
  }

  return { SECRETS, UNIQUE_AT, CLAWS, LORE, MAPS, DIG_PX, st, claim, onDiscover, hasSecret, search, learnLore, randomLore, freshMap, mapPos, sync, openMaps, marks, digHere, dig, firstClear, ringsFor,
    openGame, closeGame, placeCard, panel, counts, bookHTML, act, get game() { return game; } };
})();
