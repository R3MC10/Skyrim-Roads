/* i18n_rewards.js: Polish for rewards.js (the quiet reward line, toasts, the full-screen reward scenes, "Level N brings …"),
   introquests.js (the five first quests) and the patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words,
   lines with numbers or names in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const W = {
    // scenes
    "Got it": "Rozumiem", "Later": "Później", "Onwards": "Naprzód", "Unlocked": "Odblokowane",
    "A short first quest shows you how.": "Krótkie pierwsze zadanie pokaże ci, jak to działa.",
    "+1 perk point · +10 to Health, Magicka or Stamina": "+1 punkt atutu · +10 do Zdrowia, Magii albo Wytrzymałości",
    "Legendary find": "Legendarne znalezisko", "One of a kind": "Jedyne w swoim rodzaju",
    "Look at it in your Items. Nothing else in Skyrim is quite like it.": "Obejrzyj go w Przedmiotach. Nic innego w Skyrim nie jest do niego podobne.",
    "A companion": "Towarzysz", "Followers fight at your side and carry 100 for you. They get knocked down, never killed.": "Towarzysze walczą u twego boku i niosą za ciebie 100. Mogą zostać powaleni, ale nigdy nie giną.",
    "Your first horse": "Twój pierwszy koń", "A horse": "Koń",
    "Ride it from the Travel tab: trips are faster and it carries more for you.": "Dosiądź go w zakładce Podróż: podróże są szybsze, a koń niesie więcej.",
    "A Word of Power": "Słowo Mocy", "Your first shout": "Twój pierwszy krzyk",
    "Use it in a fight from your Magic: it needs time to cool down after.": "Użyj go w walce z Magii: potem musi chwilę odpocząć.",
    "Your first dragon": "Twój pierwszy smok", "Dragonslayer": "Smokobójca", "Bane of Dragons": "Zguba smoków",
    "Its soul is yours. Use it to learn a Word of Power.": "Jego dusza jest twoja. Użyj jej, by poznać Słowo Mocy.",
    "Skyrim will sing of this.": "Skyrim będzie o tym śpiewać.",
    "Your clan": "Twój klan", "A clan of your own": "Własny klan", "Play together, share jobs and grow your hall.": "Grajcie razem, dzielcie zlecenia i rozbudowujcie swoją siedzibę.",
    // toasts
    "Upgrade found": "Lepszy sprzęt", "New spell": "Nowe zaklęcie", "A new spell": "Nowe zaklęcie", "Follower": "Towarzysz",
    "Word of Power": "Słowo Mocy", "A new word for your shouts": "Nowe słowo do twoich krzyków",
    // what an unlock is
    "Perks": "Atuty", "Gathering": "Zbieractwo", "Cooking": "Gotowanie", "Recipes": "Przepisy", "Smithing": "Kowalstwo", "Hirelings": "Najemnicy",
    "Followers": "Towarzysze", "Alchemy": "Alchemia", "Horses": "Konie", "Dungeons": "Lochy", "Clan jobs": "Zlecenia klanu", "Clans": "Klany",
    "Housing": "Domy", "Enchanting": "Zaklinanie", "Shouts": "Krzyki", "World bosses": "Bossowie świata", "Expeditions": "Wyprawy",
    "World events": "Wydarzenia świata", "Legendary encounters": "Legendarne spotkania", "Elite encounters": "Elitarne spotkania",
    // the names unlocks.js gives
    "Cooking and recipes": "Gotowanie i przepisy", "Followers and hirelings": "Towarzysze i najemnicy", "Horses and carriages": "Konie i powozy",
    "Proper dungeons": "Prawdziwe lochy", "Deadly dungeons": "Zabójcze lochy", "Houses and homesteads": "Domy i zagrody", "Clan wars": "Wojny klanów",
    "Enchanting and spell crafting": "Zaklinanie i tworzenie zaklęć", "World bosses and expeditions": "Bossowie świata i wyprawy", "Legendary hunts": "Legendarne łowy",
    "Spend perk points in the skill trees for real bonuses.": "Wydawaj punkty atutów w drzewkach umiejętności na prawdziwe premie.",
    "Pick plants and creature parts on the road for potions, food and coin.": "Zbieraj rośliny i części stworzeń w drodze: na mikstury, jedzenie i złoto.",
    "Cook food at a fire or an inn for lasting bonuses.": "Gotuj przy ognisku albo w karczmie, by zyskać trwałe premie.",
    "Simple recipes: turn what you gather into something useful.": "Proste przepisy: zamień to, co zbierzesz, w coś przydatnego.",
    "Make and improve your own weapons and armour at any forge.": "Wykuwaj i ulepszaj własną broń i pancerz w każdej kuźni.",
    "Pay a sellsword to travel with you for a while.": "Zapłać najemnikowi, by przez jakiś czas z tobą podróżował.",
    "Someone fights at your side and carries 100 for you. They get knocked down, never killed.": "Ktoś walczy u twego boku i niesie za ciebie 100. Może zostać powalony, ale nigdy nie ginie.",
    "Mix ingredients into potions and poisons at an alchemy lab.": "Mieszaj składniki w mikstury i trucizny w pracowni alchemicznej.",
    "Buy a horse at the stables: faster trips and more carrying room.": "Kup konia w stajni: szybsze podróże i więcej miejsca na bagaż.",
    "Proper dungeons: deeper runs, elite rooms and better loot.": "Prawdziwe lochy: głębsze wyprawy, elitarne komnaty i lepsze łupy.",
    "Take on jobs together with your clan.": "Bierzcie zlecenia razem z klanem.",
    "Found or join a clan with your friends.": "Załóż klan z przyjaciółmi albo do niego dołącz.",
    "Buy a house: a bed, a chest and a place to call home.": "Kup dom: łóżko, skrzynia i miejsce, które nazwiesz swoim.",
    "Learn enchantments by breaking items, then put them on your gear.": "Poznawaj zaklęcia, rozbijając przedmioty, a potem nakładaj je na swój sprzęt.",
    "Learn Words of Power and use them in fights.": "Poznawaj Słowa Mocy i używaj ich w walce.",
    "Huge foes that whole parties gather to fight.": "Ogromni wrogowie, na których zbierają się całe drużyny.",
    "Long journeys into the wild with big rewards.": "Długie wyprawy w dzicz z dużymi nagrodami.",
    "Invasions, hunts, caravans and storms across Skyrim.": "Najazdy, łowy, karawany i burze w całym Skyrim.",
    "The hardest foes in Skyrim, and their treasure.": "Najtrudniejsi wrogowie w Skyrim i ich skarby.",
    "Tougher foes with better loot on the roads.": "Twardsi wrogowie z lepszymi łupami na drogach.",
    // introquests.js
    "The Blacksmith's Apprentice": "Uczeń kowala", "Any town forge": "Każda miejska kuźnia", "Heat the Forge": "Rozpal kuźnię",
    "Go to a town with a blacksmith (Area tab, Forge) and make or improve one thing. An Iron Dagger is the cheapest start.": "Idź do miasta z kowalem (zakładka Okolica, Kuźnia) i wykuj albo ulepsz jedną rzecz. Żelazny sztylet to najtańszy początek.",
    "Gifts of the Land": "Dary ziemi", "The wild": "Dzicz", "Pick Three": "Zbierz trzy",
    "Pick three plants or creature parts. Patches show as leaves on the map; walk close and Gather.": "Zbierz trzy rośliny albo części stworzeń. Kępy widać na mapie jako liście; podejdź blisko i zbieraj.",
    "A Sword at Your Side": "Miecz u twego boku", "Any inn": "Każda karczma", "Hire a Follower": "Najmij towarzysza",
    "Find someone to travel with you. Inns and town boards have people looking for work (Area tab).": "Znajdź kogoś, kto z tobą pójdzie. W karczmach i na tablicach miejskich czekają chętni do pracy (zakładka Okolica).",
    "Hooves on the Road": "Kopyta na trakcie", "Any stables": "Każda stajnia", "Get a Horse": "Zdobądź konia",
    "Buy a horse at the stables outside a city. Riding makes every trip faster and the horse carries more.": "Kup konia w stajni pod miastem. Jazda przyspiesza każdą podróż, a koń niesie więcej.",
    "Into the Dark": "W ciemność", "The roads of Skyrim": "Drogi Skyrim", "Clear a Dungeon": "Oczyść loch",
    "Pick a dungeon on the map and fight your way to its end. Rest rooms let you catch your breath.": "Wybierz loch na mapie i przebij się do jego końca. W komnatach odpoczynku złapiesz oddech.",
    // the patch note
    "Rewards that feel like rewards": "Nagrody, które cieszą",
    "Loot, gold and skill practice now share one quiet line at the top, like \"+24 gold · +15 One-Handed · Iron Dagger ×2\". What comes together is added up, and during a fight it waits and comes out as one line after.":
      "Łupy, złoto i ćwiczenie umiejętności dzielą teraz jedną cichą linię u góry, np. „+24 złota · +15 Broń jednoręczna · Żelazny sztylet ×2”. To, co przychodzi razem, sumuje się, a w trakcie walki czeka i pokazuje się jako jedna linia po niej.",
    "Better items on that line show their name in their rarity colour.": "Lepsze przedmioty mają na tej linii nazwę w kolorze swojej rzadkości.",
    "A short toast tells you when you pick up something better than what you wear, learn a spell or get a new word for your shouts.":
      "Krótki komunikat mówi, gdy podniesiesz coś lepszego od tego, co nosisz, poznasz zaklęcie albo nowe słowo do krzyków.",
    "Big moments get a full screen: a level that opens something new (\"LEVEL 4 · Smithing unlocked\"), your first follower, your first horse, your first shout. Legendary finds, your first dragon and your own clan too.":
      "Wielkie chwile dostają cały ekran: poziom, który coś otwiera („POZIOM 4 · Odblokowano: Kowalstwo”), pierwszy towarzysz, pierwszy koń, pierwszy krzyk. Także legendarne znaleziska, pierwszy smok i własny klan.",
    "These never pop up in the middle of a fight, a mini-game, a party vote or a dungeon: they wait until you're done, and only one shows at a time.":
      "Nigdy nie wyskakują w środku walki, minigry, głosowania drużyny ani lochu: czekają, aż skończysz, i pokazują się po jednym.",
    "New first quests for smithing, gathering, followers, horses and your first proper dungeon: one step each, with a small useful reward. Start them from the big screen.":
      "Nowe pierwsze zadania: kowalstwo, zbieractwo, towarzysze, konie i pierwszy prawdziwy loch. Każde ma jeden krok i małą, przydatną nagrodę. Zaczniesz je z dużego ekranu.",
    "Under your level bar you now see what the next level brings.": "Pod paskiem poziomu widać teraz, co da następny poziom.",
  };
  for (const [k, v] of Object.entries(W)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  const tr = (x) => { try { return (typeof I18N !== "undefined" && I18N.tr && I18N.tr(x)) || x; } catch { return x; } };
  const sk = (n) => (typeof I18N !== "undefined" && I18N.SKILLS && I18N.SKILLS[n]) || null;
  const BRING = { "a perk point": "punkt atutu", "a perk point and +10 to Health, Magicka or Stamina": "punkt atutu i +10 do Zdrowia, Magii albo Wytrzymałości" };
  I18N_EXTRA.pat.push(
    [/^\+(\d[\d,]*) gold$/, (m) => `+${m[1]} złota`],
    [/^\+(\d[\d,]*) (.+)$/, (m) => (sk(m[2]) ? `+${m[1]} ${sk(m[2])}` : null)],
    [/^\+(\d+) more$/, (m) => `+${m[1]} więcej`],
    [/^Level (\d+) brings: (.+)$/, (m) => `Poziom ${m[1]} daje: ${m[2].split(" · ").map((p) => BRING[p] || tr(p)).join(" · ")}`],
    [/^(.+) unlocked$/, (m) => `Odblokowano: ${tr(m[1])}`],
    [/^Also new: (.+)$/, (m) => `Także nowe: ${m[1].split(" · ").map(tr).join(" · ")}`],
    [/^Start: (.+)$/, (m) => `Zacznij: ${tr(m[1])}`],
    [/^(.+) joins you$/, (m) => `${m[1]} dołącza do ciebie`],
    [/^(\d+) dragons$/, (m) => `${m[1]} smoków`],
    [/^New quest: ([^.]+)\. (.+)$/, (m) => `Nowe zadanie: ${tr(m[1])}. ${tr(m[2])}`],
    [/^(.+) · (Armour|Hits for) (\d+) → (\d+)$/, (m) => `${tr(m[1])} · ${m[2] === "Armour" ? "Pancerz" : "Obrażenia"} ${m[3]} → ${m[4]}`],
  );
})();
