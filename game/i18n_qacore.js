/* i18n_qacore.js: Polish for the first minutes of play that still showed in English (core-loop QA sweep):
   the first-time tips (onboard.js, translated whole through I18N.t because their sentences hold <b> words), the "set off" and "arrived" toasts, and the qa-core patch notes.
   Loaded before i18n.js: exact lines go in I18N_EXTRA.words, lines with names in I18N_EXTRA.pat; whole sentences for
   I18N.t live in I18N_QACORE.tpl (ui.js adds them once I18N is up). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
const I18N_QACORE = (() => {
  const TPL = {
    // first-time tips (onboard.js)
    "Open <b>Character</b>: pick Health, Magicka or Stamina, then spend your perk point on a skill you use. Skills rise by using them.":
      "Otwórz <b>Postać</b>: wybierz Zdrowie, Magię albo Wytrzymałość, potem wydaj punkt atutu na umiejętność, której używasz. Umiejętności rosną, gdy ich używasz.",
    "You're carrying more than you can, so you walk slowly. Sell loot in a town, keep things in a house chest, or let a horse or follower carry them.":
      "Niesiesz więcej, niż dasz radę, więc idziesz wolno. Sprzedaj łupy w mieście, zostaw rzeczy w skrzyni w domu albo daj je nieść koniowi lub towarzyszowi.",
    "Go room by room. Each room may hold foes, a trap or loot; you can leave between rooms and come back later. The boss and the best chest wait at the end.":
      "Idź komnata po komnacie. W każdej mogą być wrogowie, pułapka albo łupy; między komnatami możesz wyjść i wrócić później. Boss i najlepsza skrzynia czekają na końcu.",
    "Someone wants you in their party. Tap Accept on the card at the top to join, or Decline. The leader picks where to go and you travel together; gold is split evenly.":
      "Ktoś chce cię w swojej drużynie. Dotknij Akceptuj na karcie u góry, żeby dołączyć, albo Odrzuć. Przywódca wybiera, dokąd iść, a wy podróżujecie razem; złoto dzieli się po równo.",
    "Rumours are marked on your map and listed in the Journal → Misc. Go there to see if it's true: some are just gossip.":
      "Plotki są zaznaczone na mapie i wypisane w Dzienniku → Różne. Idź tam i sprawdź, czy to prawda: niektóre to tylko gadanie.",
  };
  Object.assign(I18N_EXTRA.words, {
    "Too heavy": "Za ciężko", "Your first dungeon": "Twój pierwszy loch", "A party invite": "Zaproszenie do drużyny",
    // patch note b239
    "Back button and first-trip fixes": "Poprawki przycisku Wstecz i pierwszej podróży",
    "Fixed: the phone's back button did nothing in fishing, hunting, mining, lockpicking and the other mini-games, and pressing it again could close the app. Now it leaves the game, like its Done or Leave button.":
      "Naprawione: przycisk Wstecz w telefonie nic nie robił w łowieniu ryb, polowaniu, kopaniu, otwieraniu zamków i innych minigrach, a kolejne naciśnięcie mogło zamknąć aplikację. Teraz wychodzi z gry, jak jej przycisk Gotowe albo Odejdź.",
    "Fixed: back in the barber's chair or at the rune table closes them instead of opening the compass behind them.":
      "Naprawione: Wstecz u fryzjera albo przy stole run zamyka je, zamiast otwierać kompas pod spodem.",
    "Fixed: back inside a shop, the inn or the forge goes to the town's list of places first, not straight to the compass.":
      "Naprawione: Wstecz w sklepie, karczmie albo kuźni wraca najpierw do listy miejsc w mieście, a nie od razu do kompasu.",
    "Fixed: the first-trip guide said to open the Town tab; it's called Area now.":
      "Naprawione: samouczek pierwszej podróży kazał otworzyć zakładkę Miasto; teraz nazywa się Okolica.",
    "Fixed: in Polish, the first-trip guide, the first-time tips and the \"you set off\" and \"you arrived\" messages were still in English.":
      "Naprawione: po polsku samouczek pierwszej podróży, wskazówki na start i komunikaty o wyruszeniu i dotarciu były jeszcze po angielsku.",
    "You've got a lead": "Masz trop", "Open Character": "Otwórz Postać", "Got it": "Rozumiem", "Don't show tips": "Nie pokazuj wskazówek", "Close tip": "Zamknij wskazówkę",
  });
  // the title screen, its pages and the in-app updater (qa-core batch 2)
  Object.assign(I18N_EXTRA.words, {
    "A shared journey across Skyrim": "Wspólna wędrówka przez Skyrim", "New Character": "Nowa postać", "Start over?": "Zacząć od nowa?",
    "Yes, make a new character": "Tak, stwórz nową postać", "Change name": "Zmień imię", "Offline game": "Gra bez sieci",
    "Web version": "Wersja przeglądarkowa", "Saved in this browser": "Zapisane w tej przeglądarce", "App": "Aplikacja",
    "Controls": "Sterowanie", "Action bar": "Pasek akcji", "Cards / wheel": "Karty / koło", "Ideas on Travel": "Pomysły w Podróży",
    // updater (what phone players see under Updates)
    "Checking for a new version…": "Sprawdzam, czy jest nowa wersja…", "Check again": "Sprawdź jeszcze raz",
    "A new version is ready:": "Nowa wersja jest gotowa:", "What's new": "Co nowego", "Update now": "Zaktualizuj teraz", "Updating…": "Aktualizuję…",
    // How to Play
    "Fights": "Walki", "Playing together": "Gra z innymi", "Dying": "Śmierć",
    "Tap a place on the map and press Go. You walk in real time, even with the app closed: about ten minutes from Whiterun to Windhelm. Roads are fast; snow, marsh and mountains are slow. Carriages are safe and quick.":
      "Dotknij miejsca na mapie i naciśnij Idź. Idziesz na żywo, nawet gdy aplikacja jest zamknięta: z Whiterun do Windhelm to około dziesięć minut. Drogami idzie się szybko; śnieg, bagna i góry spowalniają. Powozy są bezpieczne i szybkie.",
    "Bandits, wolves and worse block the road. Fight, flee, sneak past or drink a potion. You play every fight yourself, turn by turn.":
      "Bandyci, wilki i gorsze rzeczy zastępują ci drogę. Walcz, uciekaj, przemknij się albo wypij miksturę. Każdą walkę rozgrywasz sam, tura po turze.",
    "The Area tab has shops, inns, trainers, the forge, alchemy, jobs, homes and followers. Rest at an inn or your own bed for a bonus.":
      "Zakładka Okolica ma sklepy, karczmy, trenerów, kuźnię, alchemię, zlecenia, domy i towarzyszy. Odpocznij w karczmie albo we własnym łóżku, żeby dostać premię.",
    "At a barrow or cave, press Go inside. Pick your way room by room down to the boss. Health doesn't come back on its own in there, so bring potions.":
      "Przy kurhanie albo jaskini naciśnij Wejdź do środka. Przejdź komnata po komnacie aż do bossa. Zdrowie samo tam nie wraca, więc weź mikstury.",
    "The Journal tab shows your quests. The gold diamond on the map marks where to go next.":
      "Zakładka Dziennik pokazuje twoje zadania. Złoty romb na mapie wskazuje, dokąd iść dalej.",
    "Everyone with the app shares one world. Form a party, trade, fight dragons that attack towns, or rob each other. Watch your back.":
      "Wszyscy z aplikacją dzielą jeden świat. Załóż drużynę, handluj, walcz ze smokami atakującymi miasta albo okradajcie się nawzajem. Uważaj na plecy.",
    "You wake at the nearest town and drop a bag with your gold. Get back to it within ten minutes before someone else does.":
      "Budzisz się w najbliższym mieście, a twoje złoto zostaje w sakwie na miejscu. Wróć po nią w ciągu dziesięciu minut, zanim zrobi to ktoś inny.",
    // Credits
    "Created by": "Autor", "Built with": "Zbudowane z pomocą", "Music and sound": "Muzyka i dźwięk", "composed live on your device": "komponowane na żywo na twoim urządzeniu",
    "Fonts": "Czcionki", "Networking": "Sieć", "Trystero, phone to phone": "Trystero, z telefonu do telefonu",
    "A fan project inspired by The Elder Scrolls V: Skyrim. Not made by or affiliated with Bethesda.":
      "Projekt fanowski inspirowany The Elder Scrolls V: Skyrim. Nie jest dziełem Bethesdy ani nie jest z nią powiązany.",
    // what each skill is for (skillinfo.js, shown over the perk list)
    "Swords, axes, maces and daggers held in one hand hit harder.": "Miecze, topory, buzdygany i sztylety trzymane w jednej ręce biją mocniej.",
    "Greatswords and battleaxes hit harder.": "Miecze dwuręczne i topory bojowe biją mocniej.", "Bows and crossbows hit harder.": "Łuki i kusze biją mocniej.",
    "Spears hit harder.": "Włócznie biją mocniej.", "Fighting with your bare fists.": "Walka gołymi pięściami.",
    "Blocking with a shield (or your weapon) takes less damage from hits.": "Blokując tarczą (albo bronią), dostajesz mniej obrażeń od ciosów.",
    "Makes heavy armor protect you better.": "Ciężki pancerz lepiej cię chroni.", "Makes light armor protect you better.": "Lekki pancerz lepiej cię chroni.",
    "Makes medium armor protect you better.": "Średni pancerz lepiej cię chroni.",
    "Protects you in the armor slots you leave empty (good for mages in robes).": "Chroni cię tam, gdzie nie nosisz pancerza (dobre dla magów w szatach).",
    "Fire, frost and shock spells.": "Czary ognia, mrozu i porażenia.", "Healing spells and spells against the undead.": "Czary leczące i czary przeciw nieumarłym.",
    "Spells that harden your skin (extra armor in a fight).": "Czary, które utwardzają skórę (dodatkowy pancerz w walce).",
    "Summon a creature to fight beside you.": "Przywołaj stworzenie, które walczy u twojego boku.",
    "Calm and pacify spells that stop enemies fighting.": "Czary uspokajające, które powstrzymują wrogów przed walką.",
    "The magic of souls and the unseen: Soul Trap, Detect Life, Dispel, Mark and Recall, and Spell Absorption.": "Magia dusz i tego, co niewidoczne: Pułapka dusz, Wykrycie życia, Rozproszenie, Znak i Przywołanie oraz Pochłanianie czarów.",
    "Staying unseen: avoid road fights, slip past dungeon foes and land sneak attacks.": "Pozostawanie w ukryciu: unikaj walk na drodze, przemykaj obok wrogów w lochach i zadawaj ciosy z ukrycia.",
    "Opening locked chests without breaking your picks.": "Otwieranie zamkniętych skrzyń bez łamania wytrychów.",
    "Stealing from people's pockets without being caught.": "Okradanie ludzi z kieszeni tak, żeby cię nie złapali.",
    "Running: you travel faster on foot.": "Bieganie: pieszo podróżujesz szybciej.", "Jumping and dodging: get past traps and tricky ground.": "Skoki i uniki: przejdź przez pułapki i trudny teren.",
    "Better prices when you buy and sell.": "Lepsze ceny przy kupnie i sprzedaży.",
    "Talking your way through: rumours at inns and bluffing guards.": "Wygadanie się z kłopotów: plotki w karczmach i blefowanie przed strażą.",
    "Manners at court: its perks make training cheaper, halve fines and get you past tolls.": "Maniery na dworze: jej atuty obniżają cenę nauki u trenerów, zmniejszają grzywny o połowę i przeprowadzają cię przez myta.",
    "Knowing the underworld: its perks give free rumours, fences and bribes.": "Znajomość półświatka: jej atuty dają darmowe plotki, paserów i łapówki.",
    "Making and improving weapons and armor at a forge.": "Wykuwanie i ulepszanie broni oraz pancerzy w kuźni.",
    "Putting magic on your gear, and recharging enchanted weapons more cheaply.": "Nakładanie magii na ekwipunek i tańsze ładowanie zaklętej broni.",
    "Brewing potions and poisons from ingredients.": "Warzenie mikstur i trucizn ze składników.",
    "gold.": "złota.",
    // hirelings' one-line descriptions on the hire list (towns.js FOLLOWERS)
    "Your steward at Pinewatch Hollow. Swings an axe at trees and bandits alike.": "Twój zarządca w Pinewatch Hollow. Rąbie toporem drzewa i bandytów bez różnicy.",
    "Your steward at Fenhollow Rise. Knows a few spells and every path through the marsh.": "Twój zarządca w Fenhollow Rise. Zna kilka czarów i każdą ścieżkę przez bagno.",
    "Your steward at Frostcairn Rest. An old sailor with a heavy hammer.": "Twój zarządca we Frostcairn Rest. Stary żeglarz z ciężkim młotem.",
    "Wood elf hunter from the Riverwood mill. Handy with a bow.": "Leśny elf, myśliwy z tartaku w Riverwood. Dobrze radzi sobie z łukiem.",
    "Bannered Mare brawler. Lose a bet to her and she'll follow you anywhere.": "Zabijaka z Bannered Mare. Przegraj z nią zakład, a pójdzie za tobą wszędzie.",
    "Adventurer cleaning up Riften. Sword, shield and a lot of opinions about the Thieves Guild.": "Poszukiwaczka przygód, która sprząta Riften. Miecz, tarcza i mnóstwo zdania o Gildii Złodziei.",
    "Companion and huntress. Bow, dagger and a wild streak.": "Towarzyszka i łowczyni. Łuk, sztylet i dzika natura.",
    "Companion. Huge, kind and simple. Hits like a mammoth.": "Towarzysz. Wielki, dobry i prosty. Uderza jak mamut.",
    "Companion. Sharp-tongued master of the greatsword.": "Towarzysz. Mistrz miecza dwuręcznego z ciętym językiem.",
    "Khajiit student at the College. Very sure he is the best mage in Skyrim.": "Khajiit, uczeń Akademii. Bardzo pewny, że jest najlepszym magiem w Skyrim.",
    "Dark elf apprentice at the College. Summons, illusions, nervous spells.": "Mroczna elfka, uczennica Akademii. Przywołania, iluzje, nerwowe czary.",
    "Nord student at the College, proud of it. Fire and frost.": "Nord, uczeń Akademii, i jest z tego dumny. Ogień i mróz.",
    "Morthal guard. Beat him and he'll walk with you.": "Strażnik z Morthal. Pokonaj go, a pójdzie z tobą.",
    "Miner and adventurer from Darkwater Crossing. Good with a bow.": "Górniczka i poszukiwaczka przygód z Darkwater Crossing. Dobra z łukiem.",
    "Orc warrior who wants out of her stronghold. Axe and shield.": "Orcza wojowniczka, która chce się wyrwać z twierdzy. Topór i tarcza.",
    "Dunmer spellsword for hire at the Retching Netch. Chitin, steel and fire.": "Dunmerski miecz-mag do wynajęcia w Retching Netch. Chityna, stal i ogień.",
    // patch note b256
    "Title screen in Polish and the level-up tip": "Ekran tytułowy po polsku i wskazówka o awansie",
    "Fixed: in Polish, the title screen, How to Play, Credits, Settings and the Updates page still had lines in English.":
      "Naprawione: po polsku ekran tytułowy, Jak grać, Twórcy, Ustawienia i strona Aktualizacje miały jeszcze linijki po angielsku.",
    "Fixed: in Polish, every perk description, the hirelings' descriptions and the patch-note dates were still in English.":
      "Naprawione: po polsku opisy wszystkich atutów, opisy najemników i daty w zmianach w grze były jeszcze po angielsku.",
    "Fixed: the first level-up tip and one Dawnguard line still sent you to the Hero tab; it's called Character now.":
      "Naprawione: pierwsza wskazówka o awansie i jedna linijka Straży Świtu odsyłały do zakładki Bohater; teraz nazywa się Postać.",
  });
  // ---- batch 3: crafting screens (forge, alchemy lab, cooking pot, arcane enchanter) and their messages
  Object.assign(I18N_EXTRA.words, {
    "Learn and add enchantments.": "Poznawaj zaklęcia i nakładaj je na sprzęt.",
    "Effects you know": "Znane efekty",
    "None yet. Find or buy enchanted gear and break it down here.": "Jeszcze żadnych. Znajdź albo kup zaklęty sprzęt i rozbierz go tutaj.",
    "Break down (learn)": "Rozbierz (poznaj efekt)",
    "You know this effect already": "Już znasz ten efekt",
    "No loose enchanted items in your pack (take equipped ones off first).": "Nie masz w plecaku luźnych zaklętych rzeczy (najpierw zdejmij to, co masz na sobie).",
    "Showing all your gear": "Widać cały twój sprzęt",
    "Only gear an effect you know fits": "Tylko sprzęt, na który pasuje znany ci efekt",
    "Tap to hide ingredients with no known partner": "Dotknij, by ukryć składniki bez znanej pary",
    "Only ingredients that pair with one you carry": "Tylko składniki, które łączą się z czymś, co niesiesz",
    "No shared effect known": "Nie znasz wspólnego efektu",
    "Nothing you know fits this item": "Żaden znany ci efekt nie pasuje do tej rzeczy",
    "No filled soul gem": "Brak napełnionego kamienia dusz",
    "You need an unenchanted weapon, armor, ring or amulet, a known effect, and a filled soul gem (court wizards sell them).":
      "Potrzebujesz niezaklętej broni, pancerza, pierścienia albo amuletu, znanego efektu i napełnionego kamienia dusz (sprzedają je nadworni czarodzieje).",
    "You need an inn's cooking pot or a campfire.": "Potrzebujesz kotła w karczmie albo ogniska.",
    "+15 health, stamina recovers faster": "+15 zdrowia, wytrzymałość szybciej się regeneruje",
    // alchemy effects (TOWNS.INGREDIENT_FX) that had no Polish yet
    "Restore Health": "Przywrócenie zdrowia", "Restore Magicka": "Przywrócenie magii", "Restore Stamina": "Przywrócenie wytrzymałości",
    "Regenerate Health": "Regeneracja zdrowia", "Regenerate Stamina": "Regeneracja wytrzymałości", "Cure Disease": "Leczenie chorób",
    "Fortify Conjuration": "Wzmocnienie przywołania", "Fortify Enchanting": "Wzmocnienie zaklinania", "Fortify Marksman": "Wzmocnienie łucznictwa",
    "Fortify Barter": "Wzmocnienie handlu", "Fortify Illusion": "Wzmocnienie iluzji", "Fortify Two-handed": "Wzmocnienie broni dwuręcznej",
    "Fortify One-handed": "Wzmocnienie broni jednoręcznej", "Fortify Heavy Armor": "Wzmocnienie ciężkiego pancerza", "Fortify Light Armor": "Wzmocnienie lekkiego pancerza",
    "Fortify Block": "Wzmocnienie blokowania", "Resist Magic": "Odporność na magię", "Resist Fire": "Odporność na ogień", "Resist Frost": "Odporność na mróz",
    "Resist Shock": "Odporność na porażenie", "Resist Poison": "Odporność na trucizny", "Weakness to Fire": "Podatność na ogień", "Weakness to Frost": "Podatność na mróz",
    "Weakness to Shock": "Podatność na porażenie", "Weakness to Magic": "Podatność na magię", "Damage Health": "Obrażenia zdrowia", "Damage Stamina": "Obrażenia wytrzymałości",
    "Damage Magicka": "Obrażenia magii", "Damage Magicka Regen": "Osłabienie regeneracji magii", "Damage Stamina Regen": "Osłabienie regeneracji wytrzymałości",
    "Ravage Health": "Wyniszczenie zdrowia", "Ravage Stamina": "Wyniszczenie wytrzymałości", "Ravage Magicka": "Wyniszczenie magii",
    "Lingering Damage Health": "Długotrwałe obrażenia zdrowia", "Lingering Damage Stamina": "Długotrwałe obrażenia wytrzymałości", "Lingering Damage Magicka": "Długotrwałe obrażenia magii",
    "Paralysis": "Paraliż",
    // "are you sure?" before selling or breaking something worth keeping (invqol.js)
    "Break it": "Rozbij", "Sell it": "Sprzedaj",
    "Rough work, but it holds.":"Toporna robota, ale się trzyma.", "Great work.": "Świetna robota.", "Masterful work!": "Mistrzowska robota!", "Perfect work!": "Perfekcyjna robota!",
    // patch note b265
    "Crafting in Polish": "Rzemiosło po polsku",
    "Fixed: in Polish, the arcane enchanter, parts of the alchemy lab and one cooking recipe were still in English.":
      "Naprawione: po polsku stół zaklinacza, część pracowni alchemicznej i jeden przepis kucharski były jeszcze po angielsku.",
    "Fixed: in Polish, the messages after brewing, cooking, eating a meal and improving gear were half in English.":
      "Naprawione: po polsku komunikaty po warzeniu, gotowaniu, jedzeniu posiłku i ulepszaniu sprzętu były w połowie po angielsku.",
    "Fixed: in Polish, road events (titles, choices and outcomes) were partly in English.":
      "Naprawione: po polsku wydarzenia w drodze (tytuły, wybory i skutki) były częściowo po angielsku.",
    "Fixed: in Polish, getting on and off your horse showed a half-English message.":
      "Naprawione: po polsku wsiadanie na konia i zsiadanie pokazywało komunikat w połowie po angielsku.",
    "Fixed: the ride button on the map now shows up right after you buy a horse.":
      "Naprawione: przycisk jazdy konnej na mapie pojawia się od razu po kupnie konia.",
    "Fixed: the game no longer asks for item pictures that don't exist yet (fewer errors, faster loading).":
      "Naprawione: gra nie prosi już o obrazki przedmiotów, których jeszcze nie ma (mniej błędów, szybsze ładowanie).",
  });
  // road events (events.js, encounters.js): titles, plain texts and outcomes with no Polish yet
  Object.assign(I18N_EXTRA.words, {
    "A Thalmor patrol": "Patrol Thalmoru", "A wandering bard": "Wędrowny bard", "Hunters": "Myśliwi", "A dragon overhead": "Smok nad głową",
    "Prisoner escort": "Eskorta więźnia", "A fleeing wizard": "Uciekający czarodziej", "Pilgrims": "Pielgrzymi", "A stray dog": "Bezpański pies",
    "A Hagraven coven": "Sabat wiedźmokruków", "A wild horse": "Dziki koń", "An abandoned cart": "Porzucony wóz", "A word wall rumour": "Plotka o Ścianie Słów",
    "A rich herb patch": "Bogata łąka ziół", "Avalanche!": "Lawina!", "Ashfall": "Opad popiołu", "Riekling raid": "Napad rieklingów",
    "Something in the dark": "Coś w ciemności", "Wisp lights in the fog": "Błędne ogniki we mgle", "A lost traveller": "Zagubiony podróżny",
    "A talking mudcrab": "Gadający krab", "Bandits' toll": "Myto bandytów", "A courier": "Kurier", "A necromancer's ritual": "Rytuał nekromanty", "A shipwreck": "Wrak statku",
    "Talos bless you.": "Niech Talos cię błogosławi.", "Steel flashes.": "Błyska stal.",
    "Tap an item for options.": "Dotknij przedmiotu, by zobaczyć opcje.",
    "Tap an item for options. You're in town: you can sell here.": "Dotknij przedmiotu, by zobaczyć opcje. Jesteś w mieście: możesz tu sprzedawać.",
    "You have no ingredients. Gather them on the road, in dungeons, or buy them at the general store and court wizard.":
      "Nie masz składników. Zbieraj je w drodze i w lochach albo kup w sklepie wielobranżowym i u nadwornego maga.",
    "\"Someone who walked this road before the road was here.\" You blink, and you're alone.": "„Ktoś, kto szedł tą drogą, zanim była tu droga.” Mrugasz i jesteś sam.",
    "An old Nord leans on his staff. \"You've the look of the Dragonborn. My grandfather saw a wall carved with dragon claws, not far from here.\"":
      "Stary Nord wspiera się na lasce. „Wyglądasz na Smocze Dziecię. Mój dziadek widział niedaleko stąd ścianę wyrytą smoczymi pazurami.”",
    "\"Ah... my memory's not what it was.\"": "„Ach... pamięć już nie ta.”",
    "A sheltered hollow off the road is thick with wild plants. An alchemist would kill for this spot.": "Osłonięta kotlinka przy drodze gęsto zarosła dzikimi roślinami. Alchemik zabiłby za takie miejsce.",
    "Nothing worth picking after all.": "Jednak nie ma tu nic wartego zebrania.",
    "A deep crack echoes above. Snow begins to slide down the mountainside towards the road!": "W górze rozlega się głuchy trzask. Śnieg zaczyna zsuwać się zboczem w stronę drogi!",
    "You sprint clear as the snow thunders past behind you.": "Uciekasz w ostatniej chwili, a śnieg z hukiem przetacza się za twoimi plecami.",
    "The avalanche roars over your boulder. You dig out, unhurt but slower.": "Lawina z rykiem przelewa się nad twoim głazem. Wykopujesz się cały, ale tracisz czas.",
    "Your Voice splits the wall of snow. It pours around you on both sides. Impressive.": "Twój Głos rozszczepia ścianę śniegu. Spływa po obu twoich stronach. Imponujące.",
    "Ash rains thick from Red Mountain. Shapes stir in the grey drifts: ash spawn, rising.": "Z Czerwonej Góry sypie gęsty popiół. W szarych zaspach coś się porusza: powstają pomioty popiołu.",
    "Burning eyes open in the ash.": "W popiele otwierają się płonące oczy.",
    "You crouch in the lee of a rock until they sink back into the ash.": "Kulisz się za skałą, dopóki nie zapadną się z powrotem w popiół.",
    "One of them sniffs you out.": "Jeden z nich cię wywęszył.",
    "Rieklings on tusked boars are raiding a Skaal sledge. A Skaal hunter fights them off alone.": "Rieklingowie na kłowych dzikach napadają na sanie Skaalów. Łowczyni Skaalów broni się sama.",
    "You charge into the screeching blue mob.": "Wpadasz w piszczącą niebieską hordę.",
    "A pale figure stands in the middle of the road, perfectly still. Its eyes catch your torchlight.": "Na środku drogi stoi blada postać, zupełnie nieruchoma. Jej oczy odbijają światło twojej pochodni.",
    "It smiles, showing fangs.": "Uśmiecha się, odsłaniając kły.",
    "\"Bold. I like bold.\" It steps aside, and is gone.": "„Odważnie. Lubię odwagę.” Usuwa się z drogi i znika.",
    "You run, and don't stop until dawn's grey.": "Biegniesz i nie zatrzymujesz się aż do szarego świtu.",
    "It's faster than you.": "Jest szybsze od ciebie.",
    "Blue lights drift between the trees, and a woman's voice sings without words. A Wispmother.": "Między drzewami dryfują niebieskie światła, a kobiecy głos śpiewa bez słów. Matka ogników.",
    "The fog thickens into a shape with long cold hands.": "Mgła gęstnieje w postać o długich, zimnych dłoniach.",
    "A merchant's apprentice waves you down, map upside down. \"Is this the road to Riverwood? I've been walking for hours.\"":
      "Czeladnik kupca macha do ciebie, trzymając mapę do góry nogami. „Czy to droga do Riverwood? Idę już od wielu godzin.”",
    "You turn the map the right way up. They thank you profusely.": "Odwracasz mapę właściwą stroną do góry. Dziękuje ci wylewnie.",
  });
  {
    // choice buttons: an optional icon in front, an optional "(40%)" / "(120 gold)" behind
    const EVL = { "Gather it": "Zbierz", "Keep walking": "Idź dalej", "Smash it open": "Rozwal ją", "Walk past": "Przejdź obok", "Read it": "Przeczytaj",
      "Let him sleep": "Niech śpi", "Climb it": "Wespnij się", "Stay on the road": "Zostań na drodze", "Search the camp": "Przeszukaj obóz", "Move on quickly": "Szybko idź dalej",
      "See their wares": "Obejrzyj towary", "Thank them and go": "Podziękuj i idź", "Fight them": "Walcz z nimi", "Join the hunt": "Dołącz do polowania",
      "Decline politely": "Grzecznie odmów", "Nod and move on": "Kiwnij głową i idź dalej", "Ask what he did": "Zapytaj, co zrobił", "Charge in": "Rzuć się do walki",
      "Share your food": "Podziel się jedzeniem", "Wish them luck": "Życz im szczęścia", "Feed him and go": "Nakarm go i idź", "Shoo him away": "Przegoń go",
      "Back away quietly": "Wycofaj się po cichu", "Let it be": "Zostaw go w spokoju", "Don't touch it": "Nie dotykaj", "Not today": "Nie dziś", "Thank him": "Podziękuj mu",
      "Gather carefully": "Zbieraj ostrożnie", "Shelter behind a boulder": "Schowaj się za głazem", "Shout it apart": "Rozbij ją Krzykiem", "Help the Skaal": "Pomóż Skaalce",
      "Not your fight": "To nie twoja walka", "Draw your weapon": "Dobądź broni", "Follow the lights and fight": "Idź za światłami i walcz",
      "Cover your ears and walk on": "Zatkaj uszy i idź dalej", "Point the way": "Wskaż drogę", "Walk them to the next crossroads": "Odprowadź do najbliższego rozstaju",
      "Shrug": "Wzrusz ramionami", "Back away slowly": "Powoli się wycofaj", "Run": "Uciekaj", "Run for it": "Uciekaj", "Sneak to his camp for loot": "Zakradnij się do jego obozu po łup",
      "Pay them off": "Zapłać im", "Talk them down": "Uspokój ich gadką", "Strike from the shadows": "Uderz z cienia", "Approach slowly and calm it": "Podejdź powoli i uspokój go",
      "Pull your hood up and keep low": "Naciągnij kaptur i trzymaj się nisko", "\"Move aside.\"": "„Zejdź mi z drogi.”", "Sing along": "Zaśpiewaj z nim",
      "\"You're mistaken.\"": "„Pomyliliście się.”", "Slip away": "Wymknij się", "Hide": "Ukryj się", "Sneak up and strike first": "Podkradnij się i uderz pierwszy",
      "Buy": "Kup", "Haggle": "Targuj się", "Bluff: \"He's wanted in Whiterun, I'll take him\"": "Blef: „Szukają go w Whiterun, zabiorę go”",
      "Pay them to forget him": "Zapłać, żeby o nim zapomnieli", "Go around through the trees": "Obejdź przez las", "Intimidate them": "Zastrasz ich", "\"Where?\"": "„Gdzie?”" };
    const GOD = { Akatosh: "Akatosha", Arkay: "Arkaya", Dibella: "Dibelli", Julianos: "Julianosa", Kynareth: "Kynareth", Mara: "Mary", Stendarr: "Stendarra", Zenithar: "Zenithara", Talos: "Talosa" };
    const T1 = (x) => { if (typeof I18N === "undefined" || !x) return x; const r = I18N.tr(x); return r == null ? x : r; };
    const gld = (g, it) => `${g} złota${it ? ` i ${T1(it)}` : ""}`;
    I18N_EXTRA.QACORE_EVL = EVL;   // for tests
    I18N_EXTRA.pat.unshift(
      [/^([-] )?(.+?)(?: \((\d+%|\d+ gold|\d+ picks, \d+%)\))?$/, (m) => {
        const pl = EVL[m[2]]; if (!pl) return null;
        const x = m[3] ? ` (${m[3].replace(/ gold$/, " złota").replace(/^(\d+) picks, /, "wytrychy: $1, ")})` : ""; return `${m[1] || ""}${pl}${x}`; }],
      [/^([-] )?Pick the lock \((\d+) picks, (\d+%)\)$/, (m) => `${m[1] || ""}Otwórz zamek (wytrychy: ${m[2]}, ${m[3]})`],
      [/^Pray to (\w+)$/, (m) => `Pomódl się do ${GOD[m[1]] || m[1]}`],
      [/^Pay (\d+) gold$/, (m) => `Zapłać ${m[1]} złota`],
      [/^A bard sits on a milestone, lute in hand\. "(Ragnar the Red, perhaps\?|The Age of Aggression\?|Tale of the Tongues\?|The Dragonborn Comes, if you're brave enough)"$/, (m) =>
        `Bard siedzi na kamieniu milowym z lutnią w dłoni. „${{ "Ragnar the Red, perhaps?": "Może Ragnar Rudy?", "The Age of Aggression?": "Wiek Agresji?", "Tale of the Tongues?": "Opowieść o Językach?",
          "The Dragonborn Comes, if you're brave enough": "Nadchodzi Smocze Dziecię, jeśli starczy ci odwagi" }[m[1]]}”`],
      [/^(\d+)% there$/, (m) => `${m[1]}% postępu`],
      [/^You buy (\d+) (.+)\.$/, (m) => `Kupujesz: ${m[1]}× ${T1(m[2])}.`],
      [/^You buy the (.+)\.$/, (m) => `Kupujesz: ${T1(m[1])}.`],
      [/^You walk together a while\. At the crossroads, they insist you take (\d+) gold\.$/, (m) => `Idziecie razem kawałek. Na rozstaju nalegają, żebyś wziął ${m[1]} złota.`],
      [/^They show you how to read a trail\. They give you an? (.+) for the road\.$/, (m) => `Pokazują ci, jak czytać trop. Dają ci na drogę: ${T1(m[1])}.`],
      [/^You rifle the giant's camp: (\d+) gold(?: and an? (.+?))?\. The mammoths only stare\.$/, (m) => `Przetrząsasz obóz olbrzyma: ${gld(m[1], m[2])}. Mamuty tylko się gapią.`],
      [/^The prisoner rubs his wrists\. "I owe you my life\." He gives you (\d+) gold(?: and an? (.+?))?\.$/, (m) => `Więzień rozciera nadgarstki. „Zawdzięczam ci życie.” Daje ci ${gld(m[1], m[2])}.`],
      [/^"Stendarr's thanks\." They give you (\d+) gold(?: and an? (.+?))?\.$/, (m) => `„Dzięki Stendarra.” Dają ci ${gld(m[1], m[2])}.`],
      [/^The Skaal clasps your arm\. "The All-Maker sent you\." She gives you (\d+) gold(?: and an? (.+?))?\.$/, (m) => `Skaalka ściska ci ramię. „Przysłał cię Stwórca Wszystkiego.” Daje ci ${gld(m[1], m[2])}.`],
      [/^The wizard bows, sweating\. "Take this\. And tell no one at the College\." You get an? (.+)\.$/, (m) => `Czarodziej kłania się, spocony. „Weź to. I nikomu w Kolegium ani słowa.” Dostajesz: ${T1(m[1])}.`],
      [/^(On the body: a note\. "The Brotherhood has accepted a contract on your life\." Someone hates you\.) You take an? (.+)\.$/, (m) => `${T1(m[1])} Bierzesz: ${T1(m[2])}.`],
      [/^You seize the binding and snap it\. The atronach gutters out\. The wizard, mortified, hands you an? (.+)\.$/, (m) => `Chwytasz więź i ją zrywasz. Atronach gaśnie. Zawstydzony czarodziej wręcza ci: ${m[1] === "small purse" ? "małą sakiewkę" : T1(m[1])}.`],
      [/^Three thugs step out\. "(?:You've made the wrong people angry\.|Someone in (.+?) wants a word\. With our fists\.)" Word of your crimes travels\.$/,
        (m) => `Wychodzi trzech zbirów. „${m[1] ? `Ktoś w ${T1(m[1])} chce zamienić z tobą słowo. Naszymi pięściami.` : "Podpadłeś niewłaściwym ludziom."}” Wieść o twoich zbrodniach się rozchodzi.`],
      [/^The edge of it catches you and rolls you down the slope\. \(−(\d+) health\)$/, (m) => `Skraj lawiny cię dopada i stacza po zboczu. (−${m[1]} zdrowia)`],
      [/^The snow buries you to the chest\. You dig out, bruised \(−(\d+) health\)\.$/, (m) => `Śnieg zasypuje cię po pierś. Wykopujesz się, poobijany (−${m[1]} zdrowia).`],
      [/^You find (.+) in the ash\.$/, (m) => `Znajdujesz w popiele: ${T1(m[1])}.`],
      [/^Where she faded, an? (.+) glows\.$/, (m) => `Tam, gdzie zniknęła, jarzy się: ${T1(m[1])}.`],
      [/^A ship's hull lies broken on the rocks below the road\. Half-buried in the shingle: a captain's strongbox with a(?:( daunting)|n iron) lock\.$/,
        (m) => `Pod drogą, na skałach, leży rozbity kadłub statku. Na wpół zakopana w żwirze: kapitańska szkatuła z ${m[1] ? "groźnie wyglądającym" : "żelaznym"} zamkiem.`],
    );
  }
  {
    const T0 = (x) => { if (typeof I18N === "undefined" || !x) return x; const r = I18N.tr(x); return r == null ? x : r; };
    const Q = { Fine: "Dobra", Superior: "Przednia", Exquisite: "Wyśmienita", Flawless: "Bez skazy", Epic: "Epicka", Legendary: "Legendarna" };
    const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1), low = (x) => x.charAt(0).toLowerCase() + x.slice(1);
    const tail = (x) => (x || "").trim().split(/(?<=[.!]) (?=[A-Z+])/).filter(Boolean).map((p) => {
      const g = /^\+(\d+)% (strength|magnitude)\.$/.exec(p); return g ? `+${g[1]}% mocy.` : T0(p); }).join(" ");
    const eff = (p) => { const e = /^(.+?) (\d+)(?: for (\d+) min)?$/.exec(p); return e ? `${T0(e[1])} ${e[2]}${e[3] ? ` przez ${e[3]} min` : ""}` : T0(p); };
    const MISS = { "an unenchanted weapon or piece of armor": "niezaklętej broni albo części pancerza", "a known effect (break enchanted gear here to learn one)": "znanego efektu (rozbierz tu zaklęty sprzęt, żeby go poznać)",
      "a filled soul gem (court wizards sell them)": "napełnionego kamienia dusz (sprzedają je nadworni czarodzieje)" };
    // what each enchantment does (enchanting.js WEAPON[5] / ARMOR[7]); {m} is the strength. Shown in item details and after enchanting.
    const ENCH_PL = {
      "{m} fire damage on a hit, and it may set them burning.": "{m} obrażeń od ognia przy trafieniu; może podpalić wroga.",
      "{m} frost damage on a hit; it chills and slows them.": "{m} obrażeń od mrozu przy trafieniu; wychładza i spowalnia wroga.",
      "{m} shock damage on a hit; it jolts casters.": "{m} obrażeń od porażenia przy trafieniu; wytrąca z rytmu magów.",
      "{m} damage on a hit, and you heal that much.": "{m} obrażeń przy trafieniu i tyle samo zdrowia dla ciebie.",
      "Each hit takes {m} stamina from them and gives it to you (and does a third of that as damage).": "Każde trafienie zabiera wrogowi {m} wytrzymałości i oddaje ją tobie (a jedna trzecia tego to obrażenia).",
      "Each hit takes {m} magicka from them and gives it to you (and does a third of that as damage).": "Każde trafienie zabiera wrogowi {m} magii i oddaje ją tobie (a jedna trzecia tego to obrażenia).",
      "{m}% chance a hit paralyzes them for a turn. Bosses and dragons shrug it off, and it needs a short rest between.": "{m}% szansy, że trafienie sparaliżuje wroga na turę. Bossowie i smoki to ignorują, a między razami potrzeba chwili przerwy.",
      "{m}% chance a hit sends a living foe (not much above your level, not a boss) cowering for a turn.": "{m}% szansy, że trafiony żywy wróg (niewiele ponad twój poziom, nie boss) skuli się ze strachu na turę.",
      "{m}% chance a hit calms a person or beast (not much above your level, not a boss) for 2 turns.": "{m}% szansy, że trafienie uspokoi człowieka albo zwierzę (niewiele ponad twój poziom, nie bossa) na 2 tury.",
      "If they die, their soul fills one of your empty soul gems.": "Jeśli wróg zginie, jego dusza wypełni jeden z twoich pustych kamieni dusz.",
      "{m} extra damage to the undead, and a 15% chance they flee in fear for a turn.": "{m} dodatkowych obrażeń dla nieumarłych i 15% szansy, że uciekną w strachu na turę.",
      "Wounds bleed for {m} a turn for 3 turns.": "Rany krwawią za {m} na turę przez 3 tury.",
      "+{m} health.": "+{m} zdrowia.", "+{m} magicka.": "+{m} magii.", "+{m} stamina.": "+{m} wytrzymałości.", "+{m} carry weight.": "+{m} udźwigu.",
      "One-handed weapons do {m}% more damage.": "Broń jednoręczna zadaje o {m}% więcej obrażeń.",
      "Two-handed weapons do {m}% more damage.": "Broń dwuręczna zadaje o {m}% więcej obrażeń.",
      "Bows and crossbows do {m}% more damage.": "Łuki i kusze zadają o {m}% więcej obrażeń.",
      "+{m} Sneak.": "+{m} do Skradania się.", "+{m} Lockpicking: locks open more often.": "+{m} do Otwierania zamków: zamki częściej ustępują.",
      "Destruction spells do {m}% more damage.": "Czary zniszczenia zadają o {m}% więcej obrażeń.",
      "Healing spells heal {m}% more.": "Czary leczące leczą o {m}% więcej.",
      "Prices are {m}% better when you buy and sell.": "Ceny są o {m}% lepsze, gdy kupujesz i sprzedajesz.",
      "Mages and dragons hurt you {m}% less.": "Magowie i smoki ranią cię o {m}% mniej.",
      "Health comes back {m}% faster on the road, and in fights you heal a little every turn.": "Zdrowie wraca o {m}% szybciej w drodze, a w walce co turę trochę się leczysz.",
      "Magicka comes back {m}% faster.": "Magia wraca o {m}% szybciej.", "Stamina comes back {m}% faster.": "Wytrzymałość wraca o {m}% szybciej.",
      "Fire mages, flame atronachs and fire breath hurt you {m}% less.": "Magowie ognia, atronachy ognia i ognisty oddech ranią cię o {m}% mniej.",
      "Frost mages, ice wraiths and frost breath hurt you {m}% less.": "Magowie mrozu, lodowe zjawy i mroźny oddech ranią cię o {m}% mniej.",
      "Storm mages and storm atronachs hurt you {m}% less.": "Magowie burzy i atronachy burzy ranią cię o {m}% mniej.",
      "Spiders, chaurus, spriggans and other poisonous foes hurt you {m}% less.": "Pająki, chaurusy, sprigganki i inni jadowici wrogowie ranią cię o {m}% mniej.",
      "Blocking takes another {m}% off a blow.": "Blok zdejmuje z ciosu kolejne {m}%.",
      "{m}% chance a weapon hit is a critical.": "{m}% szansy, że trafienie bronią będzie krytyczne.",
      "{m}% chance to dodge a blow completely.": "{m}% szansy na całkowity unik przed ciosem.",
      "+{m} Heavy Armor: heavy pieces protect more.": "+{m} do Ciężkiego pancerza: ciężkie części chronią lepiej.",
      "+{m} Light Armor: light pieces protect more.": "+{m} do Lekkiego pancerza: lekkie części chronią lepiej.",
      "Alteration spells cost {m}% less.": "Czary przemiany kosztują o {m}% mniej.", "Conjuration spells cost {m}% less.": "Czary przywołania kosztują o {m}% mniej.",
      "Illusion spells cost {m}% less.": "Czary iluzji kosztują o {m}% mniej.",
      "+{m} Smithing: improve gear further at the grindstone.": "+{m} do Kowalstwa: przy osełce ulepszysz sprzęt jeszcze bardziej.",
      "+{m} Alchemy: stronger potions.": "+{m} do Alchemii: mocniejsze mikstury.", "+{m} Pickpocket.": "+{m} do Kieszonkostwa.",
      "+{m} Speechcraft: talk your way through more.": "+{m} do Elokwencji: więcej spraw załatwisz gadaniem.",
    };
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ENCH_PAT = Object.entries(ENCH_PL).map(([en, pl]) => [new RegExp("^" + esc(en).replace(/\\\{m\\\}/g, "(\\d+(?:\\.\\d+)?)") + "$"), (m) => pl.replace(/\{m\}/g, m[1] || "")]);
    I18N_EXTRA.QACORE_ENCH = ENCH_PL;   // for tests
    // unshift: these are more specific than older patterns ("Missing: …", "You eat …", "… is now Fine") that would match first
    I18N_EXTRA.pat.unshift(
      [/^You get down and walk beside (.+?)\. It still carries your things\.$/, (m) => `Zsiadasz i idziesz obok: ${m[1]}. Koń dalej niesie twoje rzeczy.`],
      [/^Your horse isn't with you\.$/, () => "Twojego konia nie ma przy tobie."],
      [/^(.+?) is downed and can't carry a rider yet\. Sleep, wait a few hours, or have a stablehand tend them\.$/, (m) => `Koń (${m[1]}) jest powalony i nie uniesie jeszcze jeźdźca. Prześpij się, odczekaj kilka godzin albo poproś stajennego o opiekę.`],
      [/^You brew (.+?)(?: \((\+\d+)\))?: (.+?)\. Worth (\d+) gold\.(.*)$/, (m) => `Warzysz: ${T0(m[1].replace(/^an? /, ""))}${m[2] ? ` (${m[2]})` : ""}: ${m[3].split(", ").map(eff).join(", ")}. Wartość: ${m[4]} złota.${m[5].trim() ? " " + tail(m[5]) : ""}`],
      [/^You cook (.+?)\. It's in your pack\. Eat it when you need it: (.+) for (\d+) minutes\.$/, (m) => `Gotujesz: ${T0(m[1])}. Danie jest w plecaku. Zjedz je, kiedy trzeba: ${low(T0(cap(m[2])))} przez ${m[3]} min.`],
      [/^You eat the (.+?)\. (.+) for (\d+) minutes\.$/, (m) => `Zjadasz: ${T0(m[1])}. ${T0(m[2])} przez ${m[3]} min.`],
      [/^You still need: (.+)\.$/, (m) => `Wciąż brakuje: ${m[1]}.`],
      [/^You hammer (\d+) (.+?) into it\. (.+) is now (Fine|Superior|Exquisite|Flawless|Epic|Legendary) \(\+(\d+) (damage|armor)\)\.$/,
        (m) => `Wkuwasz w to: ${m[1]} ${m[2]}. ${m[3]} jest teraz ${Q[m[4]]} (+${m[5]} ${m[6] === "damage" ? "obrażeń" : "pancerza"}).`],
      [/^Missing: ((?:an unenchanted weapon or piece of armor|a known effect \(break enchanted gear here to learn one\)|a filled soul gem \(court wizards sell them\))(?:, | and )?)+\.$/,
        (m) => "Brakuje: " + m[0].slice(9, -1).split(/, | and /).map((x) => MISS[x] || x).join(", ").replace(/, ([^,]+)$/, " i $1") + "."],
      [/^(Pick two or three ingredients that share an effect\. )?You only see effects you've discovered: eat ingredients or experiment\. Alchemy (\d+)\.$/,
        (m) => `${m[1] ? "Wybierz dwa albo trzy składniki o wspólnym efekcie. " : ""}Widzisz tylko efekty, które odkryłeś: jedz składniki albo eksperymentuj. Alchemia ${m[2]}.`],
      [/^(Break an enchanted item to learn its effect \(the item is destroyed\), then put it on your own gear with a filled soul gem\. )?Stronger with a bigger soul and higher Enchanting \((\d+)\)\.$/,
        (m) => `${m[1] ? "Rozbij zaklętą rzecz, żeby poznać jej efekt (rzecz przepada), a potem nałóż go na swój sprzęt napełnionym kamieniem dusz. " : ""}Mocniejsze z większą duszą i wyższym Zaklinaniem (${m[2]}).`],
      [/^Break an enchanted item to learn its effect \(the item is destroyed\), then put it on your own gear with a filled soul gem\.$/,
        () => "Rozbij zaklętą rzecz, żeby poznać jej efekt (rzecz przepada), a potem nałóż go na swój sprzęt napełnionym kamieniem dusz."],
      [/^Pick two or three ingredients that share an effect\.$/, () => "Wybierz dwa albo trzy składniki o wspólnym efekcie."],
      [/^The soul pours into the (.+?)\. You made (.+?): (.+)$/, (m) => `Dusza wlewa się w: ${T0(m[1])}. Powstaje: ${T0(m[2])}: ${tail(m[3])}`],
      [/^(You know this effect already|Teaches (.+?))( ·)?$/, (m) => `${m[2] ? `Uczy: ${T0(m[2])}` : "Już znasz ten efekt"}${m[3] || ""}`],
      ...ENCH_PAT,
      [/^(Break|Sell) (.+?)( ×\d+)?\?$/, (m) => `${m[1] === "Break" ? "Rozbić" : "Sprzedać"}: ${T0(m[2])}${m[3] || ""}?`],
      [/^(Are you sure\? )?((?:[Ii]t's |[Yy]ou marked)[^:]*?)(: you learn its enchantment but lose the item for good\.|\. You can buy it back while you're in town, within an in-game hour\.)$/, (m) => {
        const WHY = { "it's destroyed": "zostanie zniszczona", "you marked it Keep": "oznaczono ją jako Zachowaj", "it's on your favourites wheel": "jest na twoim kole ulubionych",
          "it's one of a kind": "to jedyna taka rzecz", "it's enchanted": "jest zaklęta" };
        const why = m[2].charAt(0).toLowerCase() + m[2].slice(1);
        const pl = why.split(", ").map((w) => { const g = /^it's worth (\d+) gold( each)?$/.exec(w); return g ? `jest warta ${g[1]} złota${g[2] ? " za sztukę" : ""}` : WHY[w] || w; }).join(", ");
        const Pl = pl.charAt(0).toUpperCase() + pl.slice(1);
        return m[3].startsWith(":") ? `${Pl}: poznasz jej zaklęcie, ale stracisz ją na zawsze.` : `Na pewno? ${Pl}. Możesz ją odkupić, póki jesteś w mieście, przez godzinę czasu gry.`;
      }],
    );
  }
  const T = (x) => { if (typeof I18N === "undefined" || !x) return x; const r = I18N.tr(x); return r == null ? x : r; };
  I18N_EXTRA.pat.push(
    [/^You set off (for|into) (.+)\. About (.+)\.$/, (m) => `Wyruszasz ${m[1] === "into" ? "w" : "do"} ${m[2]}. Około ${m[3]}.`],
    [/^(.+) \(level (\d+)\) and everything they carry will be gone for good\. Other players' worlds aren't affected\.$/, (m) => `${m[1]} (poziom ${m[2]}) i wszystko, co ta postać niesie, zniknie na zawsze. Światy innych graczy się nie zmienią.`],
    [/^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$/, (m) => `${m[1]} ${{ Jan: "sty", Feb: "lut", Mar: "mar", Apr: "kwi", May: "maj", Jun: "cze", Jul: "lip", Aug: "sie", Sep: "wrz", Oct: "paź", Nov: "lis", Dec: "gru" }[m[2]]} ${m[3]}`],
    [/^needs (.+?) (\d+)(?: and (.+))?$/, (m) => `wymaga: ${T(m[1])} ${m[2]}${m[3] ? ` i ${T(m[3])}` : ""}`],
    [/^You need ([\d,]+) gold\.$/, (m) => `Potrzebujesz ${m[1].replace(/,/g, " ")} złota.`],
    [/^Sure\? This takes back (\d+) perk points? and (\d+) level-up choices? for ([\d,]+) gold\.$/, (m) => `Na pewno? Odbierze to punkty atutów: ${m[1]} i wybory przy awansie: ${m[2]} za ${m[3].replace(/,/g, " ")} złota.`],
    [/^build (\d+)$/, (m) => `wersja ${m[1]}`],
    [/^\. You have build (\d+)\.$/, (m) => `. Masz wersję ${m[1]}.`],
    [/^Shared world · (\d+) other travellers$/, (m) => `Wspólny świat · innych podróżnych: ${m[1]}`],
    [/^Your character and progress stay\. ([\d.]+) MB download(, no reinstall: the game just restarts)?\.$/, (m) => `Postać i postępy zostają. Do pobrania ${m[1]} MB${m[2] ? ", bez ponownej instalacji: gra tylko się uruchomi od nowa" : ""}.`],
    [/^Arrived at (.+?)\.( Shops are in the Area tab\.| You can go inside\.)?$/, (m) => `Docierasz do: ${m[1]}.${m[2] ? (/Shops/.test(m[2]) ? " Sklepy są w zakładce Okolica." : " Możesz wejść do środka.") : ""}`],
  );
  return { tpl: TPL, T };
})();
