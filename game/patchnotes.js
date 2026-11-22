/* Patch notes: what changed in each build, newest first, in plain words. [OURS]
   To add a build: put a new entry at the TOP of LIST with a new id. The newest id is what the
   one-time "What's new" popup keys on. */
const PATCHNOTES = (() => {
  const LIST = [
    { id: "b82", build: 82, date: "22 Nov 2026", title: "Build your own homestead", items: [
      "Three plots of land to buy and build on: Pinewatch Hollow by the lake near Falkreath, Fenhollow Rise in the marsh near Morthal and Frostcairn Rest on the coast near Dawnstar. Buy the deed (5000 gold) under Your home in that town.",
      "Build in stages: a small house first, then a main hall, then three wings of your choice: armory, library, greenhouse, kitchen, trophy room, enchanter's tower, alchemy tower or storage room. Building uses up the materials, and a wing can't be torn down.",
      "Get materials at the plot: saw logs at the sawmill, dig stone (and sometimes quartz) at the quarry with a pickaxe, and dig clay. Each can be worked once per in-game hour. At the workbench, turn iron ingots into nails, hinges, locks and fittings, and firewood plus quartz into glass.",
      "Wings make something every in-game day: steel arrows, a study session for one of your skills, ingredients, meals, gold from your trophies, soul gems or potions. The storage room is a 30-slot chest you never lose, and it lets goods pile up longer.",
      "Sleep in your own bed for full health and Well Rested. Each plot has its own steward to hire (500 gold): they look after the place so goods pile up longer, deliver logs, stone, clay and quartz for gold, or come along and fight with you.",
      "Every plot gets its own picture that changes as you build, in both art styles.",
      "New perks: Carpenter (Smithing, building takes fewer materials), Woodsman (Athletics, more logs, stone and clay), Landed Thane (Etiquette, cheaper deeds and stewards) and Estate Income (Mercantile, gold from each wing every day)."] },
    { id: "b78", build: 78, date: "22 Nov 2026", title: "The whole world, painted", items: [
      "All the new realistic artwork is in: every wilderness and dungeon background (Reach, Rift, marsh, hot springs, coast, ash wastes, caves, Nordic tombs, Dwemer ruins, Falmer caves and more), all 32 enemies in fights, and new textures for panels, parchment, the compass, the night sky and window frames."] },
    { id: "b76", build: 76, date: "22 Nov 2026", title: "Real paintings arrive", items: [
      "New realistic artwork: the title screen, four loading screens, all eleven towns (Whiterun, Solitude, Windhelm, Riften, Markarth and more), and the tundra and pine forest. More backgrounds, enemies and textures are on the way."] },
    { id: "b74", build: 74, date: "22 Nov 2026", title: "Herbs, roads, a big spellbook and colours", items: [
      "Gathering: 36 new ingredients and 500 herb patches across Skyrim and Solstheim. Spot them as you travel, Gather or Forage, grow a garden at home, and keep Herbalist's Notes. New Alchemy perks: Forager and Wildcrafter.",
      "31 new road encounters: Khajiit caravans, couriers, giants with mammoths, Thalmor patrols, assassins, a talking mudcrab and more, each with choices. New perks: Smooth Talker, Road Wise, Pathfinder.",
      "125 spells across all schools, Novice tomes at every general store and alchemist, court wizards and the College sell more as your skill grows, and Master rituals at the College.",
      "Support magic: heal, shield, empower and rescue your allies, with a Support branch of perks in every school. Smart AI uses it too.",
      "Colour coding everywhere: item quality (fine green, superior blue, exquisite purple, legendary gold, unique orange), schools and elements, warrior/mage/thief skills, quest types and prices. ⓘ shows the colour key.",
      "Sharper panels, glowing health/magicka/stamina bars, and slots ready for new painted artwork."] },
    { id: "b73", build: 73, date: "22 Nov 2026", title: "Clearer skills and spells", items: [
      "Skills and perks show only what you have now, plus the next step, instead of long tables.",
      "Every spell shows its real magicka cost and numbers, plus a Dual cast line with its cost and effect. Colours: fire orange, frost blue, shock violet, healing and buffs green, debuffs red, magicka blue.",
      "Pinching or holding the map no longer opens the favourites wheel. Long-press the compass or tap ★ instead.",
      "The update screen now says whether your app updates itself or needs one more full install."] },
    { id: "b70", build: 70, date: "22 Nov 2026", title: "Bigger perk trees, burning and a real quest journal", items: [
      "Every skill tree now has 9 to 14 perks (284 in total): Skyrim's own like Dual Flurry, Quick Shot, Eagle Eye, Shield Charge, Juggernaut, Impact, Twin Souls, Necromage and Assassin's Blade, plus new ones for Spear, Hand-to-Hand, Unarmored, Mysticism and more. Your old perks stay.",
      "Fire sets things burning for 3 turns, frost chills and slows (Deep Freeze can freeze solid), shock drains magicka and interrupts casters. Enemy mages, atronachs and dragons can do it to you too. Look for the 🔥 ❄ ⚡ chips under the health bars.",
      "The Journal is now only quests: Active, Misc and Completed, grouped by questline, with objectives, stages, recommended level and a Track button that drives the compass bar.",
      "Moved, not lost: chat, party, trades, clans and the leaderboard are under 👥 Friends; stats, diary and the lore library are on your Character page; cleared places are under Map → Locations."] },
    { id: "b68", build: 68, date: "22 Nov 2026", title: "Updates without reinstalling", items: [
      "Install this version once more by hand. After that the app downloads new versions by itself in the background and switches to them the next time you open it — no Android installer, no tapping Install.",
      "If an update ever fails to start, the app goes back to the version inside it on its own.",
      "Only rare bigger changes to the app itself still need a normal install; the game tells you when."] },
    { id: "b67", build: 67, date: "22 Nov 2026", title: "A truer map and allies that look the part", items: [
      "Map polish: Solitude now stands at the tip of the Haafingar peninsula over the Karth estuary, the Hjaalmarch coast is jagged marsh, Dawnstar sits on its bay and the College of Winterhold rises on its own islet.",
      "Every ally in a fight has its own look: followers in their own gear with name tags, ice wolves, werewolf brothers, the stone gargoyle, Dremora, flame, frost and storm atronachs, ghostly heroes of Sovngarde, and Odahviing diving in with fire."] },
    { id: "b66", build: 66, date: "22 Nov 2026", title: "Shouts, beasts and weather", items: [
      "Favourites wheel: star weapons, spells, shouts and potions, then tap ★ or long-press the compass or map to pick one in a ring. Readied spells open your next fight.",
      "Dragon Shouts: 45 Word Walls across Skyrim, 11 new shouts including Dragonrend, Slow Time, Storm Call, Marked for Death and Call Dragon. Spend dragon souls to unlock words. The Greybeards and Paarthurnax teach the rest.",
      "Werewolves: Beast Form perks like Bestial Strength and Totem of Ice Brothers; feed after fights to grow stronger.",
      "Vampires: Sanguinare turns you after 3 in-game days, hunger stages, sun and fire weakness, and the Vampire Lord form with its own perk tree.",
      "Cures are quests now: Rising at Dawn with Falion in Morthal, and Purity of the Blood with the Glenmoril witch heads.",
      "Weather matters: rain weakens fire and boosts shock, storms crackle, fog throws off arrows, blizzards drain stamina unless you're dressed warm. A gentle Cold meter up north (Settings → Survival). The compass shows a weather forecast."] },
    { id: "b64", build: 64, date: "22 Nov 2026", title: "The real Skyrim map and parties that fight together", items: [
      "The world map now follows Skyrim's real layout: the coast and Sea of Ghosts, the Throat of the World, the Velothi and Jerall mountains, the White River, Lake Ilinalta and Honrich, and every town and dungeon where it belongs. High Rock, Hammerfell, Cyrodiil and Morrowind show beyond the border.",
      "Roads follow the real roads. Your character moves to the same spot on the new map automatically.",
      "Party members close by now fight beside you in road and dungeon fights, each by their own tactics, and everyone gets their own share of the spoils.",
      "Travelling together: your party and followers walk or ride with you on the road, each in their own armour and weapons, with name tags."] },
    { id: "b63", build: 63, date: "22 Nov 2026", title: "Smart fights, crafting games and motion", items: [
      "Smart AI combat is on by default: your hero picks the best move every turn, uses weaknesses, heals only when it matters and saves potions. Prefer your own rules? Switch to Custom tactics on the Tactics tab — your rules are kept.",
      "Followers fight smarter too and step in front of you when you're in trouble.",
      "Crafting mini-games: time the hammer at the forge, keep the bellows hot, stir potions, trace enchanting runes. Good play gives a small bonus; Quick craft is always there.",
      "Motion everywhere: menus slide in from where you swiped, gold and XP count up, level-ups light a constellation, loot flies into your pack, routes draw on the map. Settings → Motion: Full, Lite or Off."] },
    { id: "b62", build: 62, date: "22 Nov 2026", title: "Solstheim and the Skyrim compass", items: [
      "Solstheim: take the Northern Maiden from Windhelm's docks to Raven Rock. A whole new island with ash wastes, Skaal Village, Tel Mithryn, the All-Maker Stones and Miraak's story.",
      "New creatures (ash hoppers, netch, rieklings, lurkers), ash storms, Stalhrim, Chitin and Bonemold gear, and the Bend Will shout.",
      "The Skyrim compass menu is now your home screen: swipe left for Magic, right for Items, up for Skills and down for the Map. The bottom bar shows your level, gold, carry weight and what you're doing.",
      "Constellation skill trees: tap a star to read and take a perk.",
      "Clearer screens: a 'What to do next' card, town places grouped into Shops, Services, Home and more, a tidier Journal with counters, ⓘ help on every screen and a search box in your pack."] },
    { id: "b61", build: 61, date: "21 Nov 2026", title: "Together on the roads", items: [
      "Co-op dungeons: invite up to 3 friends at a dungeon door, clear the rooms together and each get your own share of the boss chest.",
      "Fight on horseback: charge into road fights from the saddle. If your horse goes down you're thrown clear and fight on foot.",
      "Arena duels are real fights now, using each player's own gear, spells and tactics. Healing loops are fixed too.",
      "The Civil War: join the Imperials in Solitude or the Stormcloaks in Windhelm and win the holds. Jarls and guards change with the war.",
      "Daedric quests: 13 princes, each with a shrine, a quest and an artifact that really works.",
      "A real economy: every town has its own prices, daily shortages and gluts, and what all players buy and sell moves them. Look for the Market today card.",
      "Fairer crafting: repeating the same item gives less XP, crafted things don't sell for more than their materials, and crafting fortify loops are capped. Find recipe scrolls in the world and name your masterworks.",
      "Legendary skills: at 100, make a skill Legendary for a permanent bonus. Every skill now does something on its own, and a Progress card shows what's next.",
      "Exploration: hidden caches, a unique item in every notable dungeon, claw doors and ring puzzles, lore books for your library and treasure maps.",
      "Player halls: buy a plot, build a forge, shrine, trophy room and shop counter, and hire staff. Clans can build guild halls together."] },
    { id: "b60", build: 60, date: "21 Nov 2026", title: "Fights come alive", items: [
      "Every weapon has its own move: dagger double stabs, sword slashes, axe chops, hammer slams with a shockwave, spear thrusts, bows that draw and loose, and more.",
      "Every spell looks different: fire, frost and lightning, wards, runes, summons and shouts all have their own effects and particles.",
      "Fights play at a natural pace, about a second per move. Use ×2 or Skip if you're in a hurry.",
      "Power attacks wind up and shake the screen, critical hits and sneak attacks slow down, and the last blow gets a slow-motion finish.",
      "Enemies fight like themselves: wolves bite, giants slam, dragons breathe fire, draugr shout.",
      "Story quests now scale with you, and the Journal shows a recommended level for each quest.",
      "Patch notes: you're reading them! Find them in the main menu and in Settings."] },
    { id: "b58", build: 58, date: "21 Nov 2026", title: "Lockpicking, sounds of Skyrim and the dragon priests", items: [
      "Skyrim-style lockpicking mini-game (or a quick roll if you'd rather not).",
      "Big banners for new quests and objectives, guards who comment when you arrive, and loading cards with tips.",
      "Ambient sound everywhere: wind, rain and thunder, birds, wolves at night, busy towns, inns, forges, caves and Dwemer ruins. New Ambience slider.",
      "The eight dragon priests wait in their ruins from level 20. Collect their masks and find Konahrik at Bromjunaar."] },
    { id: "b57", build: 57, date: "21 Nov 2026", title: "Looks and feels like Skyrim with SkyUI", items: [
      "A Skyrim compass on the map with your quest marker, nearby places, players and dragon raids.",
      "Slim health, magicka and stamina bars that fade when full, and a message log in the corner.",
      "Smoked-glass menus, SkyUI item lists, town options as Skyrim dialogue, the Journal as a quest book, perk constellations and a proper YOU DIED screen."] },
    { id: "b56", build: 56, date: "21 Nov 2026", title: "Thieves Guild, Dark Brotherhood and magic you can see", items: [
      "Full Thieves Guild questline up to the Twilight Sepulcher, with Nightingale gear and fence bonuses.",
      "Full Dark Brotherhood questline up to Hail Sithis!, with contracts, Shrouded gear, the Blade of Woe and Shadowmere.",
      "Animated title screen with aurora and a dragon, plus a short story intro.",
      "Festival decorations in towns, and spells and shouts now show on the map."] },
    { id: "b55", build: 55, date: "21 Nov 2026", title: "Spell crafting and bard songs", items: [
      "Make your own spells at the College of Winterhold: combine effects you know, set the strength and name it.",
      "Write a verse about your deeds at an inn. The best verses of the week are sung in every inn."] },
    { id: "b54", build: 54, date: "21 Nov 2026", title: "Weather, seasons and homes in every picture", items: [
      "Sun, two moons, stars, aurora, snow, rain, fog, storms and autumn leaves in every picture.",
      "Drawn interiors for all five houses, your neighbours' homes and the Hall of the North.",
      "Dragon raids circle on the map, the Arena has a cheering crowd, and clan banners fly over their holds."] },
    { id: "b53", build: 53, date: "21 Nov 2026", title: "Carts and caravans", items: [
      "Buy a cart at the stables to carry 300 more (slower, roads only, sometimes raided).",
      "Four caravans loop between the big cities. Sign on as a guard, fight off ambushes together, and get paid when you arrive."] },
    { id: "b52", build: 52, date: "21 Nov 2026", title: "Faces and an equipment screen", items: [
      "Portraits for shopkeepers, innkeepers, Jarls, guards, trainers and followers.",
      "Pictures for every road event and story moment.",
      "An equipment screen showing your character with gear slots and stat comparisons."] },
    { id: "b51", build: 51, date: "21 Nov 2026", title: "A living map and drawn dungeon maps", items: [
      "Hand-drawn map markers, your portrait on the map, footprints, birds, cloud shadows and towns that light up at night.",
      "Dungeons get a torch-lit drawn map where you tap rooms to move."] },
    { id: "b50", build: 50, date: "21 Nov 2026", title: "Spell icons and smoother sound", items: [
      "An icon for every spell, skill, perk, stone, shout, quest and achievement.",
      "Sound rewritten: no more pops or crackles, and new Nordic music."] },
    { id: "b49", build: 49, date: "21 Nov 2026", title: "The game gets pictures", items: [
      "Two art styles to choose from in Settings: hand-drawn or pixel art.",
      "Animated fight scenes, pictures for every place, icons for items and enemies, and your character drawn in their gear."] },
    { id: "b48", build: 48, date: "21 Nov 2026", title: "Fights stay exciting at higher levels", items: [
      "Weak enemies now catch up to your level like in Skyrim, so fights at level 20–40 are a real challenge again."] },
    { id: "b47", build: 47, date: "21 Nov 2026", title: "Mysticism gets its own magic", items: [
      "Mysticism is now its own school: Soul Trap, Detect Life, Dispel, Mark and Recall, and Spell Absorption.",
      "Breaking down enchanted gear now only trains Enchanting."] },
    { id: "b46", build: 46, date: "21 Nov 2026", title: "Much more magic", items: [
      "44 new spells: runes, cloaks, walls, storms, wards, bound weapons, raising the dead, fear, invisibility and more.",
      "Dual casting, elemental weaknesses, staffs with charges, and spells you can use outside fights."] },
    { id: "b45", build: 45, date: "21 Nov 2026", title: "Free roam and skills explained", items: [
      "Tap any spot on the map and walk there, off the roads.",
      "Every skill now says what it does, what you get later, and how to raise it."] },
    { id: "b44", build: 44, date: "21 Nov 2026", title: "All of Skyrim to discover", items: [
      "256 places from Skyrim, hidden until you find them.",
      "Spell tomes sold by court wizards and the College.",
      "Bows need arrows, crossbows need bolts, and you can make both at the forge.",
      "A guide for new players with Show-me buttons."] },
    { id: "b43", build: 43, date: "21 Nov 2026", title: "Friends and messages", items: [
      "A friends list, private messages, and trading with friends anywhere by courier.",
      "Ores drop as loot, and cleared places refill after 3 in-game days."] },
    { id: "b42", build: 42, date: "21 Nov 2026", title: "Mining and a proper trade window", items: [
      "Mine ore at Skyrim's mines with a pickaxe (sometimes you find a gem).",
      "Every shop has a Buy and Sell window with Sell all.",
      "Timers now count in-game time."] },
    { id: "b41", build: 41, date: "21 Nov 2026", title: "Smithing, gems and jewellery", items: [
      "Make weapons, armor and jewellery at the forge, and smelt ore and tan pelts.",
      "Valuable gems and jewellery drop from tough enemies and chests.",
      "Tactics fixed: new rules now work, plus bigger cards and more conditions."] },
    { id: "b40", build: 40, date: "21 Nov 2026", title: "Gear bonuses show on your character", items: [
      "Skills boosted by your gear show a green ▲, and Active effects lists your enchantments."] },
    { id: "b39", build: 39, date: "21 Nov 2026", title: "Cleared places show when they open again", items: [
      "A live countdown on cleared dungeons, badges on the map, and a Cleared places list in the Journal."] },
    { id: "b38", build: 38, date: "21 Nov 2026", title: "Market stalls", items: [
      "Own a house and run a stall in that town. Other players can buy from it while you're away."] },
    { id: "b37", build: 37, date: "21 Nov 2026", title: "Werewolves and vampires", items: [
      "Join the Circle for Beast Form, or catch vampirism at night. Both have cures if you change your mind."] },
    { id: "b36", build: 36, date: "21 Nov 2026", title: "Clan wars over the holds", items: [
      "Clans earn points in each hold. The weekly winner rules the hold: their colour on the map and cheaper shops for members."] },
    { id: "b35", build: 35, date: "21 Nov 2026", title: "Smoother, lighter on battery, and a Journal menu", items: [
      "The map uses less battery, and the Journal has a quick-jump menu."] },
    { id: "b34", build: 34, date: "21 Nov 2026", title: "Seasonal events", items: [
      "Real-calendar festivals: Witchingmoon, Frostfall Blizzards, New Life Festival and Midyear Celebration."] },
    { id: "b33", build: 33, date: "21 Nov 2026", title: "Clans", items: [
      "Found a clan with a tag and banner colours, invite players, and chat in your clan channel."] },
    { id: "b32", build: 32, date: "21 Nov 2026", title: "Achievements", items: [
      "18 achievements with progress bars on the Hero tab."] },
    { id: "b31", build: 31, date: "21 Nov 2026", title: "A tutorial for new players", items: [
      "A guided first trip to Whiterun, plus one-time tips on each tab."] },
    { id: "b30", build: 30, date: "21 Nov 2026", title: "Map pins and party routes", items: [
      "Hold a finger on the map to drop a pin, share it with your party, and see party members' routes."] },
    { id: "b28", build: 28, date: "21 Nov 2026", title: "The Arena in Windhelm", items: [
      "Duel other players for gold, with monthly seasons and a ladder. Nobody dies."] },
    { id: "b27", build: 27, date: "21 Nov 2026", title: "Fishing, cooking, horses and visits", items: [
      "Fish in rivers, lakes and the sea, and cook stews and soups.",
      "Buy a horse, name it and pick its coat. Horses never die; they limp back to the stables.",
      "Visit other players' homes and leave gifts."] },
    { id: "early", build: null, date: "20 Nov 2026", title: "The first day", items: [
      "Roads of the North arrives on Android with one shared world for everyone.",
      "Standing stones, racial powers, dragon shouts and dragon souls.",
      "Carriages, followers, homes, enchanting, weather, seasons and dragon attacks on towns.",
      "Quest lines: the main quest, Companions, Thieves Guild and the College.",
      "Trading between players, a leaderboard, chat, backups, music and sound.",
      "The Hall of the North that everyone builds together, and the Jarl's weekly bounty board.",
      "A main menu and in-app updates."] },
  ];
  const NEXT = [
    "A sharper Solitude peninsula and map polish",
    "More quests and characters",
  ];
  const KEY = "rotn_notes_seen";
  const latest = () => LIST[0];
  function seen() { try { return localStorage.getItem(KEY); } catch { return null; } }
  function markSeen() { try { localStorage.setItem(KEY, latest().id); } catch { /* ignore */ } }
  const unseen = () => seen() !== latest().id;
  const e = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function entryHTML(n, open) {
    const head = `<span class="pnt">${e(n.title)}</span><span class="pnm">${n.build ? `Build ${n.build} · ` : ""}${e(n.date)}</span>`;
    return `<details class="pn"${open ? " open" : ""}><summary>${head}</summary><ul>${n.items.map((i) => `<li>${e(i)}</li>`).join("")}</ul></details>`;
  }
  /* the full list; the newest entry is open */
  function html() {
    return `<div class="pnotes"><details class="pn pnnext" open><summary><span class="pnt">Coming next</span><span class="pnm">Being built now</span></summary><ul>${NEXT.map((i) => `<li>${e(i)}</li>`).join("")}</ul></details>
      ${LIST.map((n, i) => entryHTML(n, i === 0)).join("")}</div>`;
  }
  /* the one-time popup after an update: just the newest entry */
  function whatsNewHTML() {
    const n = latest();
    return `<div class="pnotes pnwhat"><div class="pnkick">What's new</div><h2>${e(n.title)}</h2><ul>${n.items.map((i) => `<li>${e(i)}</li>`).join("")}</ul></div>`;
  }
  return { LIST, NEXT, latest, seen, markSeen, unseen, html, whatsNewHTML, KEY };
})();
if (typeof module !== "undefined") module.exports = PATCHNOTES;
