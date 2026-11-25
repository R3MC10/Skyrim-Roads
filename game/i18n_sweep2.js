/* i18n_sweep2.js: Polish for English that was still showing on the main screens (second sweep, build 215):
   the trip line on the map ("the wilds → Riverwood"), the dragon-raid card, the Journal's quest list, the inn and the
   bard's corner, the market, the Social page, the Items doll, the Hero page, road events, the fight log, townsfolk
   greetings and lines that start with a game icon. Loaded before i18n.js: exact lines go in I18N_EXTRA.words, text with
   numbers or names in I18N_EXTRA.pat, and sentences inside longer paragraphs in I18N_STORY. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
const I18N_SWEEP2 = (() => {
  // the translator itself (i18n.js) loads after this file: look it up when a pattern runs
  const T = (x) => { if (typeof I18N === "undefined" || !x) return x; const r = I18N.tr(x); return r == null ? x : r; };
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  const DRAGON = { dragon: "smok", "frost dragon": "mroźny smok", "blood dragon": "krwawy smok", "elder dragon": "starszy smok", "ancient dragon": "pradawny smok",
    "revered dragon": "czcigodny smok", "legendary dragon": "legendarny smok" };
  const dragon = (d) => DRAGON[d.toLowerCase()] || d;
  // ---------------------------------------------------------------- exact lines
  const WORDS = {
    // patch note b215
    "More of the game in Polish": "Więcej gry po polsku",
    "Playing in Polish? The trip line on the map, the Journal and its quests, the inn, the market, road events, the fight log and the townsfolk greetings are now in Polish too.": "Grasz po polsku? Linia podróży na mapie, Dziennik i jego zadania, karczma, targ, zdarzenia na drodze, przebieg walki i powitania mieszkańców są teraz też po polsku.",
    "Lines that start with a little game icon now get translated as well, so buttons like Fight, Pay or Something by the road show up in Polish.": "Linie zaczynające się od małej ikonki gry też są teraz tłumaczone, więc przyciski jak Walcz, Zapłać czy Coś przy drodze pokazują się po polsku.",
    "The warhorse now shows a proper game icon instead of an odd symbol.": "Koń bojowy ma teraz porządną ikonkę gry zamiast dziwnego znaczka.",
    "Tidied the patch notes: a few empty repeats of old entries are gone.": "Uporządkowano informacje o zmianach: zniknęło kilka pustych powtórek starych wpisów.",
    // the trip line and the road
    "the wilds": "dzicz", "Out in the wilds": "Na pustkowiu", "fast going": "szybko", steady: "równym krokiem", "slow going": "wolno", "very slow going": "bardzo wolno",
    "on foot": "pieszo", "too heavy to run": "za ciężko, by biec", "The trip keeps going while the page is closed.": "Podróż trwa, nawet gdy strona jest zamknięta.",
    "You keep travelling even with the app closed.": "Podróżujesz dalej, nawet gdy aplikacja jest zamknięta.", "Something by the road": "Coś przy drodze",
    "Tap to take a look": "Dotknij, żeby zobaczyć", "On the road": "W drodze", Stop: "Zatrzymaj się", "Standing stone": "Kamień przeznaczenia", Skill: "Umiejętność",
    // ground kinds (terrain.js NAMES)
    Sea: "Morze", Lake: "Jezioro", "River (ford)": "Rzeka (bród)", Road: "Droga", Bridge: "Most", Grassland: "Łąki", Tundra: "Tundra", Forest: "Las",
    "Pine forest": "Las sosnowy", "Autumn forest": "Jesienny las", Marsh: "Bagna", "Volcanic tundra": "Wulkaniczna tundra", "Rocky hills": "Skaliste wzgórza",
    Mountains: "Góry", "High peaks": "Wysokie szczyty", "Ash wastes": "Popielne pustkowia", "Beyond the border": "Za granicą",
    // the map page and the hub
    "Rare wares, one of each": "Rzadkie towary, po jednej sztuce", "On now": "Trwa teraz", "on now": "trwa teraz", "On now ·": "Trwa teraz ·", "On now!": "Trwa teraz!",
    "Starting soon": "Zaraz się zacznie", "Starting soon ·": "Zaraz się zacznie ·",
    "The guide walks you through your first hour: trading, fighting, dungeons, smithing, friends and more.": "Przewodnik przeprowadzi cię przez pierwszą godzinę gry: handel, walkę, lochy, kowalstwo, przyjaciół i więcej.",
    "Turn these ideas off": "Wyłącz te podpowiedzi", "· they come back in  Settings → Help & tips": "· wrócą po włączeniu w  Ustawienia → Pomoc i porady",
    "· they come back in Settings → Help & tips": "· wrócą po włączeniu w Ustawienia → Pomoc i porady",
    "Nothing to forage in town. Head out into the wild.": "W mieście nie ma czego zbierać. Wyjdź na pustkowia.",
    "Search the ground for whatever grows here": "Przeszukaj ziemię, czy coś tu rośnie",
    "No plants spotted right here. Patches you pass on the road show on the map as leaves.": "Tu nie widać żadnych roślin. Kępy, które mijasz w drodze, pokazują się na mapie jako listki.",
    "Tap a place on the map, or press": "Dotknij miejsca na mapie albo naciśnij", "below. Tap empty ground on the map to roam off the road.": "poniżej. Dotknij pustego terenu na mapie, żeby iść na przełaj.",
    "Saved in this browser only": "Zapisano tylko w tej przeglądarce",
    "Hunt: slower, but you run into animals far more often": "Polowanie: wolniej, ale dużo częściej trafiasz na zwierzęta",
    "Sneak: slower, fewer fights, harder to spot": "Skradanie: wolniej, mniej walk, trudniej cię wypatrzyć", Hunt: "Polowanie",
    "Friends, messages and trades": "Przyjaciele, wiadomości i wymiany",
    "Everyone who fought shares the soul and the spoils.": "Każdy, kto walczył, dzieli się duszą i łupami.",
    // seasonal festivals (festivals.js)
    "The Witchingmoon": "Księżyc Czarownic", "Frostfall Blizzards": "Zamiecie Mroźnego Opadu", "The New Life Festival": "Święto Nowego Życia", "The Midyear Celebration": "Święto Połowy Roku",
    "Defeat 10 undead": "Pokonaj 10 nieumarłych", "Finish 8 trips while the blizzards last": "Ukończ 8 podróży, póki trwają zamiecie",
    "Collect the innkeepers' gift on 3 days": "Odbierz prezent od karczmarzy przez 3 dni", "Fight 3 Arena duels": "Stocz 3 pojedynki na Arenie",
    // the Hero page
    "No standing stone": "Brak kamienia przeznaczenia", "Visit one of the 13 standing stones (Guardian Stones are near Riverwood) to take its blessing.":
      "Odwiedź jeden z 13 kamieni przeznaczenia (Kamienie Strażników są koło Riverwood), żeby przyjąć jego błogosławieństwo.",
    "No Words of Power yet. Word Walls wait at the end of Nordic barrows (Bleak Falls Barrow has one), and the Greybeards at High Hrothgar teach Unrelenting Force.":
      "Nie znasz jeszcze Słów Mocy. Ściany Słów czekają na końcu nordyckich kurhanów (jedna jest w Bleak Falls Barrow), a Siwobrodzi w High Hrothgar uczą Nieustępliwej Siły.",
    ". Kill a dragon to absorb its soul; each soul unlocks one word.": ". Zabij smoka, żeby pochłonąć jego duszę; każda dusza odblokowuje jedno słowo.",
    "Foes match your": "Wrogowie dopasowują się do twojego", Movement: "Ruch",
    // the Journal
    "Side quests": "Zadania poboczne", Solstheim: "Solstheim", "Civil War": "Wojna domowa", Dawnguard: "Straż Świtu", Guilds: "Gildie", Daedric: "Daedryczne",
    "Masks of the Dragon Priests": "Maski smoczych kapłanów", "The ancient Nords": "Dawni Nordowie", "The first mask": "Pierwsza maska",
    "Track a quest to show it on the compass, the map's gold diamond and the “What to do next” card.": "Śledź zadanie, żeby pokazać je na kompasie, jako złoty romb na mapie i na karcie „Co dalej”.",
    // quest lines and stages (quests.js)
    "The Dragonborn": "Smocze Dziecię", "Before the Storm": "Przed burzą", "Dragon Rising": "Powrót smoków",
    "The Companions": "Towarzysze", "Take Up Arms": "Do broni", "Proving Honor": "Dowód honoru", "The Silver Hand": "Srebrna Dłoń", "Glory of the Dead": "Chwała poległych",
    "The Thieves Guild": "Gildia Złodziei", "A Chance Arrangement": "Przypadkowa umowa", "Loud and Clear": "Głośno i wyraźnie", "Dampened Spirits": "Rozwodnione trunki",
    "Scoundrel's Folly": "Głupota łotra", "Speaking With Silence": "Rozmowa z ciszą", "Hard Answers": "Trudne odpowiedzi", "Trinity Restored": "Przywrócona trójca",
    Blindsighted: "Oślepieni", "Darkness Returns": "Powrót ciemności",
    "The Dark Brotherhood": "Mroczne Bractwo", "Innocence Lost": "Utracona niewinność", "With Friends Like These…": "Z takimi przyjaciółmi…", "Bound Until Death": "Związani aż do śmierci",
    "The Silence Has Been Broken": "Cisza została przerwana", "Breaching Security": "Przełamanie zabezpieczeń", "To Kill an Empire": "Zabić cesarstwo", "Hail Sithis!": "Chwała Sithisowi!",
    "The College of Winterhold": "Kolegium Zimowej Twierdzy", "First Lessons": "Pierwsze lekcje", "Under Saarthal": "Pod Saarthal", "Good Intentions": "Dobre intencje", "The Eye of Magnus": "Oko Magnusa",
    "The Whispering Door": "Szepczące drzwi", "Barbas the dog": "pies Barbas", "north of Winterhold": "na północ od Winterhold", "Castle Dour": "Zamek Dour", "Blue Palace": "Błękitny Pałac",
    // the Social page
    "You're playing offline. Go online (Map tab) to see friends and messages.": "Grasz offline. Połącz się (karta Mapa), żeby zobaczyć przyjaciół i wiadomości.",
    "No friends yet. Add people from Social → Party (travellers near you), or search below.": "Nie masz jeszcze przyjaciół. Dodaj kogoś w Społeczność → Drużyna (podróżni w pobliżu) albo wyszukaj poniżej.",
    // the Items doll
    "Tap a slot to change what you wear. Loadout:": "Dotknij miejsca, żeby zmienić to, co nosisz. Zestaw:", "Show your pack as a plain list": "Pokaż plecak jako zwykłą listę",
    "Amulet and rings": "Amulet i pierścienie",
    // the inn, rumours and the bard
    "Sleep to heal and get Rested; hear rumours.": "Prześpij się, żeby się wyleczyć i wypocząć; posłuchaj plotek.",
    "Full health and Rested": "Pełne zdrowie i wypoczynek", "Buy a round, listen for rumours": "Postaw kolejkę, posłuchaj plotek",
    "Reveals a place you haven't found yet": "Odkrywa miejsce, którego jeszcze nie znasz", "Reveals two places you haven't found yet": "Odkrywa dwa miejsca, których jeszcze nie znasz",
    "What's the word?": "Co słychać?", "Song of the North": "Pieśń Północy", "This week's song is still being written": "Pieśń tego tygodnia dopiero powstaje",
    "You're playing offline, so the bard sings the old songs:": "Grasz offline, więc bard śpiewa stare pieśni:", "Go online to share verses with other players.": "Połącz się, żeby dzielić się zwrotkami z innymi graczami.",
    "New verses": "Nowe zwrotki", "No new verses yet.": "Na razie nie ma nowych zwrotek.", "Write a verse": "Napisz zwrotkę", "Nobody has written a verse yet. Be the first!": "Nikt jeszcze nie napisał zwrotki. Bądź pierwszy!",
    Innkeeper: "Karczmarz", Alchemist: "Alchemik", "Carriage driver": "Woźnica", "Ship's captain": "Kapitan statku", Steward: "Zarządca", "Arena master": "Mistrz areny",
    "Hall-warden": "Strażnik hali", Greybeard: "Siwobrody", "Mine foreman": "Brygadzista kopalni", Fisher: "Rybak", "Market steward": "Zarządca targu",
    // the market
    "Things other players are selling.": "Rzeczy, które sprzedają inni gracze.", "For sale here": "Na sprzedaż",
    "Players sell their own things here. Buy, or run your own stall if you own a house in this town.": "Tu gracze sprzedają swoje rzeczy. Kupuj albo prowadź własny stragan, jeśli masz dom w tym mieście.",
    // fights
    Fight: "Walcz", "[AI] = Smart AI's move": "[AI] = ruch Smart AI", "[n] is the tactic rule that fired": "[n] to reguła taktyki, która zadziałała",
    "[n] = your rule fired · [AI] = Smart AI": "[n] = zadziałała twoja reguła · [AI] = Smart AI",
  };
  // townsfolk greetings and night lines (npcart.js)
  const SAY = {
    "Need something sharp? Or something to stop something sharp?": "Potrzebujesz czegoś ostrego? Albo czegoś, co zatrzyma coś ostrego?", "Steel's honest. Bring me ore and I'll show you.": "Stal jest uczciwa. Przynieś rudę, to ci pokażę.",
    "Mind the forge, it bites.": "Uważaj na kuźnię, gryzie.", "A good blade outlives its owner.": "Dobre ostrze przeżyje swojego właściciela.",
    "Mind the books. Some of them bite back.": "Uważaj na książki. Niektóre gryzą.", "Magic isn't a toy, but it is a tool.": "Magia to nie zabawka, ale narzędzie.",
    "Come to learn, or come to buy?": "Przyszedłeś się uczyć czy kupować?", "The winds of magic are restless today.": "Wiatry magii są dziś niespokojne.",
    "Come in, get warm. Mead's cold, fire's hot.": "Wejdź, ogrzej się. Miód zimny, ogień gorący.", "Need a room? Bed's soft enough.": "Potrzebujesz pokoju? Łóżko jest dość miękkie.",
    "Plenty of stories tonight. Some of them true.": "Dziś wieczór mnóstwo opowieści. Niektóre nawet prawdziwe.", "Sit, eat. You look half frozen.": "Siadaj, jedz. Wyglądasz na przemarzniętego.",
    "Careful with that one. It's not for drinking.": "Ostrożnie z tym. To nie do picia.", "Mushrooms, roots, the odd giant's toe. What do you need?": "Grzyby, korzenie, czasem palec olbrzyma. Czego ci trzeba?",
    "A cure for every ache, and an ache for every cure.": "Lek na każdy ból i ból po każdym leku.", "Best horses in the hold. Ask anyone.": "Najlepsze konie w całym władztwie. Zapytaj kogokolwiek.",
    "She's a good runner. Feed her and she'll carry you.": "Dobrze biega. Nakarm ją, a cię poniesie.", "Horses don't lie. People do.": "Konie nie kłamią. Ludzie tak.",
    "Need a ride? Tell me where.": "Podwieźć cię? Powiedz dokąd.", "Climb aboard. Nothing bothers a carriage on the road.": "Wsiadaj. Nic nie zaczepia powozu na drodze.", "Fare first, then we go.": "Najpierw opłata, potem jedziemy.",
    "Keep your voice down. What have you got?": "Ciszej. Co masz?", "No questions. No names. Just coin.": "Bez pytań. Bez imion. Tylko złoto.", "If it's hot, I can cool it down. For a price.": "Jak jest gorące, ostudzę to. Za opłatą.",
    "Speak. The hold is listening.": "Mów. Władztwo słucha.", "What brings you before the Jarl?": "Co cię sprowadza przed oblicze jarla?", "We have dragons to worry about. Be brief.": "Mamy na głowie smoki. Mów krótko.",
    "The Jarl is busy. Talk to me.": "Jarl jest zajęty. Mów do mnie.", "There's always work for someone with a strong arm.": "Dla kogoś z silnym ramieniem zawsze znajdzie się praca.", "Notices are on the board. Read them.": "Ogłoszenia są na tablicy. Przeczytaj je.",
    "Keep your nose clean.": "Nie pakuj się w kłopoty.", "No lollygagging.": "Bez obijania się.", "I used to be an adventurer like you.": "Kiedyś byłem poszukiwaczem przygód, tak jak ty.", "Watch the skies, traveller.": "Obserwuj niebo, wędrowcze.",
    "The Voice is not a weapon. Remember that.": "Głos to nie broń. Pamiętaj o tym.", "Listen to the wind on the mountain.": "Słuchaj wiatru na górze.", "Patience, Dragonborn.": "Cierpliwości, Smocze Dziecię.",
    "Step into the sand. Glory or a broken nose.": "Wejdź na piasek. Chwała albo złamany nos.", "The crowd loves a good fight. Give them one.": "Tłum kocha dobrą walkę. Daj im ją.", "Bets are open. Who's your champion?": "Zakłady przyjęte. Kto jest twoim faworytem?",
    "Every name on that wall earned its place.": "Każde imię na tej ścianie zasłużyło na swoje miejsce.", "Give to the Hall, and the North remembers.": "Dawaj Hali, a Północ zapamięta.", "The mead's free for builders. Mostly.": "Dla budowniczych miód za darmo. Zazwyczaj.",
    "Mind your head. The tunnels are low.": "Uważaj na głowę. Tunele są niskie.", "Good ore down there, if you don't mind the dark.": "Na dole jest dobra ruda, jeśli nie boisz się ciemności.", "They're biting today. Mostly my fingers.": "Dziś biorą. Głównie moje palce.",
    "Late one? There's still a bed upstairs.": "Późno już? Na górze jest jeszcze łóżko.", "We're closed, friend. Come back in the morning.": "Zamknięte, przyjacielu. Wróć rano.",
    "Forge is banked for the night. Come back at dawn.": "Kuźnia przygaszona na noc. Wróć o świcie.", "It's late. Some spells keep better till morning.": "Późno już. Niektóre czary lepiej poczekają do rana.",
    "Shop's closed. The good herbs wake up with the sun.": "Sklep zamknięty. Dobre zioła budzą się ze słońcem.", "It's dark. Stay out of trouble.": "Ciemno już. Nie pakuj się w kłopoty.", "The Jarl sleeps. Come back in the morning.": "Jarl śpi. Wróć rano.",
  };
  Object.assign(WORDS, SAY);
  for (const [k, v] of Object.entries(WORDS)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;

  // ---------------------------------------------------------------- text with numbers or names
  const PAT = [
    // a line that starts with a game icon (private-use character): translate the rest
    [/^([\uE000-\uF8FF]+\s*)(\S[\s\S]*)$/, (m) => { const r = T(m[2]); return r !== m[2] ? m[1] + r : null; }],
    // the trip line: "the wilds → Riverwood", "the outskirts of Whiterun → Solitude"
    [/^([^→·]{1,60}) → ([^→·]{1,60})$/, (m) => { const a = T(m[1]), b = T(m[2]); return a !== m[1] || b !== m[2] ? `${cap(a)} → ${b}` : null; }],
    [/^the wilds near (.+)$/, (m) => `dzicz koło ${m[1]}`], [/^the outskirts of (.+)$/, (m) => `okolice: ${m[1]}`], [/^the wilds of (.+)$/, (m) => `dzicz: ${m[1]}`],
    [/^riding (.+)$/, (m) => `konno: ${m[1]}`], [/^walking beside (.+)$/, (m) => `obok konia: ${m[1]}`], [/^([A-Z][\w'-]+(?: [A-Z][\w'-]+)?) with you$/, (m) => `${m[1]} z tobą`],
    [/^On the way to (.+)$/, (m) => `W drodze do: ${m[1]}`], [/^Travel to (.+)$/, (m) => `Podróżuj do: ${m[1]}`], [/^Go: (.+)$/, (m) => `Idź: ${T(m[1])}`],
    [/^(\d+) min left$/, (m) => `zostało ${m[1]} min`], [/^(\d+) of (\d+) so far( ·)?$/, (m) => `na razie ${m[1]} z ${m[2]}${m[3] || ""}`],
    [/^of (\d+)$/, (m) => `z ${m[1]}`], [/^· (\d+) to spend$/, (m) => `· do wydania: ${m[1]}`], [/^fighting level (\d+)$/, (m) => `poziomu walki ${m[1]}`],
    [/^(.+) \(can take\)$/, (m) => `${m[1]} (możesz wziąć)`],
    // dragon raids (ui.js raid card, hud.js)
    [/^A (.+?) is circling (.+?)(!?)$/, (m) => `${cap(dragon(m[1]))} krąży nad: ${m[2]}${m[3]}`], [/^A (.+?) is attacking (.+)$/, (m) => `${cap(dragon(m[1]))} atakuje: ${m[2]}`],
    [/^The (.+?) over (.+) is dead$/, (m) => `${cap(dragon(m[1]))} nad: ${m[2]} nie żyje`], [/^Dragon at (.+?)(!?)$/, (m) => `Smok: ${m[1]}${m[2]}`],
    [/^(.+) has begun! See Map → World news\.$/, (m) => `Zaczyna się: ${T(m[1])}! Zobacz Mapa → Wieści ze świata.`],
    [/^(.+): (Defeat 10 undead|Finish 8 trips while the blizzards last|Collect the innkeepers' gift on 3 days|Fight 3 Arena duels)$/, (m) => `${T(m[1])}: ${T(m[2])}`],
    // the Hero page
    [/^Level (\d+) (Nord|Imperial|Breton|Redguard|High Elf|Wood Elf|Dark Elf|Orc|Khajiit|Argonian)$/, (m) => `${T(m[2])}, poziom ${m[1]}`],
    // the Journal
    [/^Recommended level (\d+)$/, (m) => `Zalecany poziom ${m[1]}`], [/^Reward: (.+)$/, (m) => `Nagroda: ${m[1].split(", ").map(T).join(", ")}`],
    [/^(.+) \(from level (\d+)\)$/, (m) => `${T(m[1])} (od poziomu ${m[2]})`],
    // the inn and the market
    [/^The inn, (\d+) people inside$/, (m) => `Karczma, osób w środku: ${m[1]}`], [/^Steward of (.+)$/, (m) => `Zarządca: ${m[1]}`], [/^Jarl of (.+)$/, (m) => `Jarl: ${m[1]}`],
    [/^No player stalls in (.+) right now\.$/, (m) => `Teraz nie ma tu straganów graczy (${m[1]}).`],
    [/^Own a house in (.+), or a hall here with a shop counter, to run your own stall\.$/, (m) => `Żeby prowadzić własny stragan, musisz mieć dom w: ${m[1]} albo tutejszą halę z ladą.`],
    [/^(.+) · shops, inn and more in the Area tab$/, (m) => `${m[1]} · sklepy, karczma i więcej na karcie Okolica`],
    // road events and toasts
    [/^Defeated (?:the )?(.+?)(?: \(\+(\d+) gold\))?$/, (m) => `Pokonano: ${cap(T(cap(m[1])))}${m[2] ? ` (+${m[2]} złota)` : ""}`],
    [/^Pay \((\d+) gold\)$/, (m) => `Zapłać (${m[1]} złota)`], [/^On the road · (.+)$/, (m) => `W drodze · ${m[1].split(" · ").map(T).join(" · ")}`],
    [/^Discovered: ([^·]+?)(?: and (\d+) more)?$/, (m) => `Odkryto: ${m[1]}${m[2] ? ` i ${m[2]} innych` : ""}`], [/^(\d+)\/(\d+) places$/, (m) => `miejsca: ${m[1]}/${m[2]}`],
    // the fight log
    [/^Fight log \((\d+) turns?\)$/, (m) => `Przebieg walki (tury: ${m[1]})`], [/^\(you (\d+) · foe (\d+)\)$/, (m) => `(ty ${m[1]} · wróg ${m[2]})`],
    [/^the (.+) burns for (\d+)$/, (m) => `${cap(T(cap(m[1])))} płonie: ${m[2]}`], [/^sets it burning: (\d+)$/, (m) => `podpala: ${m[1]}`], [/^sets it burning$/, () => "podpala"],
    [/^(.+) \(dual\)(: \d+)?$/, (m) => `${T(m[1])} (podwójnie)${m[2] || ""}`], [/^(.+) \(blocked\)(: \d+)?$/, (m) => `${T(m[1])} (zablokowany)${m[2] || ""}`],
    [/^([\uE000-\uF8FF]?\s*\S[^—]*?) — (\[[\s\S]+)$/, (m) => { const a = T(m[1]), b = T(m[2]); return a !== m[1] || b !== m[2] ? `${a} — ${b}` : null; }],
    [/^· they come back in(\s*[\uE000-\uF8FF]?\s*)Settings → Help & tips$/, (m) => `· wrócą po włączeniu w${m[1]}Ustawienia → Pomoc i porady`],
    [/^(.+?): the (.+) flees in terror$/, (m) => `${T(m[1])}: ${cap(m[2])} ucieka w przerażeniu`],
  ];
  I18N_EXTRA.pat.push(...PAT);

  // ---------------------------------------------------------------- sentences inside paragraphs
  if (typeof I18N_STORY !== "undefined") {
    const EX = {
      // the dragon raid card
      "Everyone who hurts it gets its soul, 300 gold, dragon bone and scales.": "Każdy, kto go zrani, dostaje jego duszę, 300 złota, smocze kości i łuski.",
      "It flies at first (melee only grazes it) and lands when badly hurt.": "Najpierw lata (walka wręcz ledwie go draśnie), a ląduje dopiero ciężko ranny.",
      "The more people come, the tougher it gets.": "Im więcej ludzi przyjdzie, tym jest twardszy.", "No one has gathered yet.": "Nikt się jeszcze nie zebrał.",
      // the Hero page
      "It follows your best weapon or spell skill and your best armor or defence skill, so better gear and skills always win you fights.":
        "Zależy od twojej najlepszej umiejętności broni lub czarów i najlepszej umiejętności pancerza lub obrony, więc lepszy sprzęt i umiejętności zawsze pomagają wygrywać walki.",
      "Every skill point you gain moves this bar (higher skills move it more), so every skill counts.": "Każdy zdobyty punkt umiejętności przesuwa ten pasek (wyższe umiejętności bardziej), więc liczy się każda umiejętność.",
      "Tall, fair-haired children of Skyrim, hardened by its cold and its wars.": "Wysokie, jasnowłose dzieci Skyrim, zahartowane przez mróz i wojny.",
      "50% frost resistance.": "50% odporności na mróz.", "50% poison resistance.": "50% odporności na truciznę.", "50% fire resistance.": "50% odporności na ogień.",
      "50% disease resistance.": "50% odporności na choroby.", "50% disease and poison resistance.": "50% odporności na choroby i truciznę.",
      "Disciplined citizens of Cyrodiil, skilled diplomats and traders.": "Zdyscyplinowani obywatele Cyrodiil, zręczni dyplomaci i kupcy.",
      "Gifted in the arcane, with 25% resistance to magic.": "Uzdolnieni magicznie, z 25% odporności na magię.",
      "The most naturally talented warriors in Tamriel.": "Najbardziej utalentowani z natury wojownicy w Tamriel.",
      "High Elves of the Summerset Isles, born with 50 extra magicka.": "Wysokie Elfy z Wysp Summerset, urodzone z 50 dodatkowymi punktami magii.",
      "Wood Elves of Valenwood, the best archers in Tamriel.": "Leśne Elfy z Valenwood, najlepsi łucznicy w Tamriel.",
      "Dark Elves of Morrowind, strong in both sword and spell.": "Mroczne Elfy z Morrowind, silne zarówno mieczem, jak i czarem.",
      "Fierce warriors and armorers from the Wrothgarian Mountains.": "Zażarci wojownicy i płatnerze z Gór Wrothgarskich.",
      "Agile cat-folk of Elsweyr, natural thieves.": "Zwinny koci lud z Elsweyr, urodzeni złodzieje.", "Their claws do 12 unarmed damage.": "Ich pazury zadają 12 obrażeń bez broni.",
      "Reptilian folk of Black Marsh, at home in water.": "Gadzi lud z Czarnych Mokradeł, w wodzie jak u siebie.",
      // the Journal
      "Eight dragon priests sleep in the old Nordic ruins, each in a mask of power.": "Ośmiu smoczych kapłanów śpi w starych nordyckich ruinach, każdy w masce mocy.",
      "Defeat one and take its mask.": "Pokonaj jednego i zabierz jego maskę.",
      // the inn and the market
      "Sleep to heal fully and become Rested (skills improve 5% faster for 40 minutes; your own bed gives 10%).": "Prześpij się, żeby w pełni się wyleczyć i wypocząć (umiejętności rosną o 5% szybciej przez 40 minut; własne łóżko daje 10%).",
      "Buy a round and the locals talk.": "Postaw kolejkę, a miejscowi się rozgadają.", "The innkeeper hears everything.": "Karczmarz słyszy wszystko.", "Some of it's even true.": "Niektóre rzeczy są nawet prawdziwe.",
      "New Life Festival: rooms are free!": "Święto Nowego Życia: pokoje za darmo!",
    };
    for (const [k, v] of Object.entries(EX)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
    const PATS = [
      ["{0}/{1} damage dealt.", "Zadane obrażenia: {0}/{1}."], ["{0}/{1} damage dealt by {2} fighters.", "Zadane obrażenia: {0}/{1}, walczących: {2}."],
      ["{0}/{1} damage dealt by 1 fighter.", "Zadane obrażenia: {0}/{1}, walczy 1 osoba."],
      ["Be in {0} when the timer runs out to fight it together.", "Bądź w: {0}, gdy skończy się czas, żeby walczyć z nim razem."],
      ["(lower than your level {0}: crafting, trading and sneaking don't make the road harder).", "(niższego niż twój poziom {0}: rzemiosło, handel i skradanie nie utrudniają drogi)."],
      ["Nearest: {0}, in {1}.", "Najbliżej: {0}, w: {1}."], ["{0}% to level {1}.", "{0}% do poziomu {1}."],
    ];
    for (const p of PATS) if (!I18N_STORY.pats.some(([en]) => en === p[0])) I18N_STORY.pats.push(p);
  }
  return { WORDS, PAT };
})();
