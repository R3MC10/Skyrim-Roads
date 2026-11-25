/* i18n_qacore.js: Polish for the first minutes of play that still showed in English (core-loop QA sweep):
   the guided first trip (ui.js TUT, translated whole through I18N.t because its sentences hold <b> words),
   the first-time tips (onboard.js), the "set off" and "arrived" toasts, and the qa-core patch notes.
   Loaded before i18n.js: exact lines go in I18N_EXTRA.words, lines with names in I18N_EXTRA.pat; whole sentences for
   I18N.t live in I18N_QACORE.tpl (ui.js adds them once I18N is up). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
const I18N_QACORE = (() => {
  const TPL = {
    // the guided first trip
    "Your first trip": "Twoja pierwsza podróż", "On the road": "W drodze", "You've arrived": "Jesteś na miejscu", "Quests": "Zadania",
    "{n} of {m}": "{n} z {m}", "Skip the tutorial": "Pomiń samouczek",
    "Welcome to Skyrim, {name}. Everything happens in real time. Tap <b>Whiterun</b> on the map and press <b>Travel</b>, or press <b>Go</b> next to it in the list below.":
      "Witaj w Skyrim, {name}. Wszystko dzieje się na żywo. Dotknij <b>Whiterun</b> na mapie i naciśnij <b>Podróż</b> albo naciśnij <b>Idź</b> obok tej nazwy na liście poniżej.",
    "Welcome to Skyrim, {name}. You're in a party: the leader picks where to go and you travel with them. Watch the map; the next step starts when you set off.":
      "Witaj w Skyrim, {name}. Jesteś w drużynie: przywódca wybiera, dokąd iść, a ty podróżujesz z nim. Patrz na mapę; następny krok zacznie się, gdy wyruszycie.",
    "Your party comes along.": "Twoja drużyna idzie z tobą.",
    "You're walking. Trips keep going even when the app is closed, and something may happen by the road: if it's a fight, you play it turn by turn (or press Auto). You can ride a horse later, or take a carriage between cities.":
      "Idziesz. Podróż trwa, nawet gdy aplikacja jest zamknięta, a przy drodze może się coś wydarzyć: jeśli to walka, grasz ją turami (albo naciśnij Auto). Później możesz jeździć konno albo brać powóz między miastami.",
    "You're walking. Trips keep going even when the app is closed, and something may happen by the road. You can ride a horse later, or take a carriage between cities.":
      "Idziesz. Podróż trwa, nawet gdy aplikacja jest zamknięta, a przy drodze może się coś wydarzyć. Później możesz jeździć konno albo brać powóz między miastami.",
    "Open the <b>Area</b> tab. In towns and cities it has shops, the inn, trainers, the forge, jobs and more.":
      "Otwórz zakładkę <b>Okolica</b>. W miastach i miasteczkach są tam sklepy, karczma, trenerzy, kuźnia, zlecenia i więcej.",
    "Open the <b>Area</b> tab. This spot is out in the wilds, so it shows what you can do here.":
      "Otwórz zakładkę <b>Okolica</b>. To miejsce leży w dziczy, więc zakładka pokazuje, co możesz tu zrobić.",
    "Now open the <b>Journal</b>. Your quests are there, and the gold diamond on the map shows where to go next. Chat and other players are under <b>Social</b>.":
      "Teraz otwórz <b>Dziennik</b>. Są tam twoje zadania, a złoty romb na mapie pokazuje, dokąd iść dalej. Czat i inni gracze są w zakładce <b>Społeczność</b>.",
    // first-time tips (onboard.js)
    "The gold card under the map (<b>Your first trip</b>) shows you what to do, one step at a time. Tips like this one pop up the first time something new happens.":
      "Złota karta pod mapą (<b>Twoja pierwsza podróż</b>) pokazuje, co robić, krok po kroku. Takie wskazówki wyskakują, gdy pierwszy raz dzieje się coś nowego.",
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
    "Welcome to Skyrim": "Witaj w Skyrim", "Too heavy": "Za ciężko", "Your first dungeon": "Twój pierwszy loch", "A party invite": "Zaproszenie do drużyny",
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
    // tab tips (ui.js TAB_TIPS)
    "Start with the “What to do next” card. Press Go to travel; tap any place on the map to see how far it is.": "Zacznij od karty „Co dalej”. Naciśnij Idź, żeby ruszyć; dotknij dowolnego miejsca na mapie, żeby zobaczyć, jak daleko jest.",
    "Your level, skills and perks. A dot on this tab means you can level up or spend a perk point.": "Twój poziom, umiejętności i atuty. Kropka na tej zakładce znaczy, że możesz awansować albo wydać punkt atutu.",
    "Everything you carry. Tap an item to wear or use it; search by name at the top of the list.": "Wszystko, co niesiesz. Dotknij przedmiotu, żeby go założyć albo użyć; szukaj po nazwie na górze listy.",
    "Places in town are grouped: Shops, Services, Guilds & jobs. Each town has different ones; shops close at night.": "Miejsca w mieście są pogrupowane: Sklepy, Usługi, Gildie i zlecenia. Każde miasto ma inne; sklepy zamyka się na noc.",
    "Only your quests live here: Active, Misc and Completed. ☆ Track the one you're on and the compass and map follow it.": "Tu są tylko twoje zadania: Aktywne, Różne i Ukończone. ☆ Śledź to, które robisz, a kompas i mapa będą za nim iść.",
  });
  // the title screen, its pages and the in-app updater (qa-core batch 2)
  Object.assign(I18N_EXTRA.words, {
    "A shared journey across Skyrim": "Wspólna wędrówka przez Skyrim", "New Character": "Nowa postać", "Start over?": "Zacząć od nowa?",
    "Yes, make a new character": "Tak, stwórz nową postać", "Change name": "Zmień imię", "Offline game": "Gra bez sieci",
    "Web version": "Wersja przeglądarkowa", "Saved in this browser": "Zapisane w tej przeglądarce", "App": "Aplikacja",
    "Controls": "Sterowanie", "Action bar": "Pasek akcji", "Cards / wheel": "Karty / koło", "Ideas on Travel": "Pomysły w Podróży",
    // updater (what phone players see under Updates)
    "You're playing the web version, which is always up to date. The phone app downloads new versions by itself and switches over when you next open it.":
      "Grasz w wersję przeglądarkową, która zawsze jest aktualna. Aplikacja na telefon sama pobiera nowe wersje i przełącza się na nie przy następnym uruchomieniu.",
    "Checking for a new version…": "Sprawdzam, czy jest nowa wersja…", "You have the newest version:": "Masz najnowszą wersję:", "Check again": "Sprawdź jeszcze raz",
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
    // respec (respec.js)
    "Respec": "Nowy rozwój", "gold.": "złota.", "Yes, respec": "Tak, zacznij od nowa", "Keep my build": "Zostaw jak jest",
    "Start your build over: every perk and every Health/Magicka/Stamina choice goes back to the pool. Skills and level stay. Costs":
      "Zacznij rozwój postaci od nowa: każdy atut i każdy wybór Zdrowia, Magii i Wytrzymałości wraca do puli. Umiejętności i poziom zostają. Kosztuje",
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
    // patch note b255
    "Title screen in Polish and the level-up tip": "Ekran tytułowy po polsku i wskazówka o awansie",
    "Fixed: in Polish, the title screen, How to Play, Credits, Settings and the Updates page still had lines in English.":
      "Naprawione: po polsku ekran tytułowy, Jak grać, Twórcy, Ustawienia i strona Aktualizacje miały jeszcze linijki po angielsku.",
    "Fixed: in Polish, every perk description, the hirelings' descriptions and the patch-note dates were still in English.":
      "Naprawione: po polsku opisy wszystkich atutów, opisy najemników i daty w zmianach w grze były jeszcze po angielsku.",
    "Fixed: the first level-up tip and one Dawnguard line still sent you to the Hero tab; it's called Character now.":
      "Naprawione: pierwsza wskazówka o awansie i jedna linijka Straży Świtu odsyłały do zakładki Bohater; teraz nazywa się Postać.",
  });
  const T = (x) => { if (typeof I18N === "undefined" || !x) return x; const r = I18N.tr(x); return r == null ? x : r; };
  I18N_EXTRA.pat.push(
    [/^You set off (for|into) (.+)\. About (.+)\.$/, (m) => `Wyruszasz ${m[1] === "into" ? "w" : "do"} ${m[2]}. Około ${m[3]}.`],
    [/^(.+) \(level (\d+)\) and everything they carry will be gone for good\. Other players' worlds aren't affected\.$/, (m) => `${m[1]} (poziom ${m[2]}) i wszystko, co ta postać niesie, zniknie na zawsze. Światy innych graczy się nie zmienią.`],
    [/^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$/, (m) => `${m[1]} ${{ Jan: "sty", Feb: "lut", Mar: "mar", Apr: "kwi", May: "maj", Jun: "cze", Jul: "lip", Aug: "sie", Sep: "wrz", Oct: "paź", Nov: "lis", Dec: "gru" }[m[2]]} ${m[3]}`],
    [/^needs (.+?) (\d+)(?: and (.+))?$/, (m) => `wymaga: ${T(m[1])} ${m[2]}${m[3] ? ` i ${T(m[3])}` : ""}`],
    [/^You need ([\d,]+) gold\.$/, (m) => `Potrzebujesz ${m[1].replace(/,/g, " ")} złota.`],
    [/^Respec · ([\d,]+) gold$/, (m) => `Nowy rozwój · ${m[1].replace(/,/g, " ")} złota`],
    [/^Sure\? This takes back (\d+) perk points? and (\d+) level-up choices? for ([\d,]+) gold\.$/, (m) => `Na pewno? Odbierze to punkty atutów: ${m[1]} i wybory przy awansie: ${m[2]} za ${m[3].replace(/,/g, " ")} złota.`],
    [/^Play the guided tutorial with (.+)$/, (m) => `Zagraj w samouczek jako ${m[1]}`],
    [/^build (\d+)$/, (m) => `wersja ${m[1]}`],
    [/^\. You have build (\d+)\.$/, (m) => `. Masz wersję ${m[1]}.`],
    [/^Shared world · (\d+) other travellers$/, (m) => `Wspólny świat · innych podróżnych: ${m[1]}`],
    [/^Your character and progress stay\. ([\d.]+) MB download(, no reinstall: the game just restarts)?\.$/, (m) => `Postać i postępy zostają. Do pobrania ${m[1]} MB${m[2] ? ", bez ponownej instalacji: gra tylko się uruchomi od nowa" : ""}.`],
    [/^Arrived at (.+?)\.( Shops are in the Area tab\.| You can go inside\.)?$/, (m) => `Docierasz do: ${m[1]}.${m[2] ? (/Shops/.test(m[2]) ? " Sklepy są w zakładce Okolica." : " Możesz wejść do środka.") : ""}`],
  );
  return { tpl: TPL, T };
})();
