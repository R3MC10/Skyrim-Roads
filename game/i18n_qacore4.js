/* i18n_qacore4.js: Polish for English that was still left in a Polish game (qa-core batch 4): the lock lines on chests,
   quest givers' places in the Journal ("Sam Guevenne, the Bannered Mare, Whiterun"), and what turned up while playing
   through dungeons and fights in Polish: the dungeon screen (entrance, room choices, the refill card, the door puzzle),
   what happens in rooms (traps, books, chests, dragon priests) and the fight log (shield catches, power attacks,
   criticals, "still rattled", burning, chills, wards, why the Smart AI picked a move).
   Loaded after i18n_story.js and before i18n.js: exact lines go in I18N_EXTRA.words, story sentences in I18N_STORY,
   lines with names or numbers in I18N_EXTRA.pat (the fight-log ones go first, so a line's ending is never translated
   on its own while the foe's name stays English). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
const I18N_QACORE4 = (() => {
  const T = (x) => { try { return typeof I18N !== "undefined" ? I18N.tr(x) : null; } catch (e) { return null; } };
  const W = (x) => T(x) ?? x;   // names that stay the same (Otar, Krosis) pass through
  const cap = (x) => x[0].toUpperCase() + x.slice(1);
  const plural = (n, one, few, many) => { n = Math.abs(+n); if (n === 1) return one; const t = n % 10, h = n % 100; return t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many; };
  const ICO = "(\\s*[^\\p{L}\\p{N}\\s(]{0,3}\\s*)?";   // an icon in front of a log piece
  const ic = (m) => m[1] || "";

  const WORDS = {
    // chests: how hard the lock is (events.js lockLooks)
    "The lock looks simple (Novice).": "Zamek wygląda na prosty (Nowicjusz).",
    "The lock looks fairly easy (Apprentice).": "Zamek wygląda na dość łatwy (Uczeń).",
    "The lock looks tricky (Adept).": "Zamek wygląda na podchwytliwy (Adept).",
    "The lock looks hard (Expert).": "Zamek wygląda na trudny (Ekspert).",
    "The lock looks very hard (Master).": "Zamek wygląda na bardzo trudny (Mistrz).",
    // quest givers and where to find them (Journal → quest givers)
    "the Bannered Mare": "Bannered Mare", "Boethiah's cultists": "Kultyści Boethiah", "Shrine of Azura": "Kapliczka Azury",
    "Meridia's beacon": "Latarnia Meridii", "Statue to Meridia": "Posąg Meridii", "Kesh the Clean": "Kesh Czysty",

    // quests in the Journal: stage titles and buttons that were still English
    "A dragon is attacking the Western Watchtower. Go there and kill it.": "Smok atakuje Zachodnią Wieżę Strażniczą. Idź tam i go zabij.",
    "Fight the dragon": "Walcz ze smokiem", "Spar with Vilkas": "Stocz sparing z Vilkasem", "Confront Mercer Frey": "Rozmów się z Mercerem Freyem",
    "Aventus Aretino, Windhelm": "Aventus Aretino, Windhelm", "Open the lockbox": "Otwórz szkatułkę", "Face Cicero": "Zmierz się z Cicero", "Face Ancano": "Zmierz się z Ancano",
    "Two masks": "Dwie maski", "Three masks": "Trzy maski", "Four masks": "Cztery maski", "Five masks": "Pięć masek", "Six masks": "Sześć masek", "Seven masks": "Siedem masek", "Eight masks": "Osiem masek",
    "With all eight masks and the Wooden Mask in your pack, go to the shrine of Bromjunaar beneath Labyrinthian.": "Z wszystkimi ośmioma maskami i Drewnianą Maską w plecaku idź do kapliczki Bromjunaar pod Labyrinthian.",
    "Place the masks at the shrine": "Złóż maski w kapliczce", "Legate Rikke, Castle Dour, Solitude": "Legat Rikke, Castle Dour, Solitude",
    "The Jagged Crown": "Wyszczerbiona Korona", "The Oath": "Przysięga", "Give Balgruuf Ulfric's axe": "Daj Balgruufowi topór Ulfrika", "Storm Castle Dour": "Zdobądź Castle Dour",
    "The Black Star": "Czarna Gwiazda", "Return to Azura": "Wróć do Azury", "The Sacrifice": "Ofiara", "The Champion": "Czempion", "Face Boethiah's champion": "Zmierz się z czempionem Boethiah",
    "A Daedra's Best Friend": "Najlepszy przyjaciel daedry", "A Talking Dog": "Gadający pies", "The Rueful Axe": "Topór Żalu", "The Seekers": "Poszukiwacze", "Open the box": "Otwórz skrzynkę",
    "The Falkreath Jail": "Więzienie w Falkreath", "The Great Hunt": "Wielkie Łowy", "Hunt Sinding": "Zapoluj na Sindinga", "The Cursed Tribe": "Przeklęte plemię",
    "Fight the giant": "Walcz z olbrzymem", "Take Shagrol's Hammer": "Weź Młot Shagrola", "Face Gorgon": "Zmierz się z Gorgonem", "The Hilt": "Rękojeść", "The Blade": "Ostrze", "The Shrine": "Kapliczka",
    "The Break of Dawn": "Brzask", "Face Malkoran": "Zmierz się z Malkoranem", "The Abandoned House": "Opuszczony dom", "Search the house": "Przeszukaj dom", "Break Logrolf": "Złam Logrolfa",
    "The Only Cure": "Jedyne lekarstwo", "The Offering": "Ofiara", "Burn the offering": "Spal ofiarę", "Face Orchendor": "Zmierz się z Orchendorem",
    "A Drinking Contest": "Konkurs picia", "Drink with Sam": "Napij się z Samem", "The Morning After": "Poranek po", "Find Sam": "Znajdź Sama",
    "The Pelagius Wing": "Skrzydło Pelagiusa", "Night Terrors": "Nocne koszmary", "Wake Up": "Pobudka", "Rising at Dawn": "Powstanie o świcie", "A Black Soul Gem": "Czarny kamień dusz",
    "The Glenmoril Witches": "Wiedźmy z Glenmoril", "Glenmoril witch": "Wiedźma z Glenmoril", "The Wolf Spirit": "Wilczy duch", "Your wolf spirit": "Twój wilczy duch",
    "Raven Rock, Solstheim": "Raven Rock, Solstheim", "Face the cultists": "Zmierz się z kultystami", "The Earth Stone": "Kamień Ziemi", "The Wind Stone": "Kamień Wiatru",
    "The Water Stone": "Kamień Wody", "The Beast Stone": "Kamień Bestii", "The Sun Stone": "Kamień Słońca", "The Tree Stone": "Kamień Drzewa",
    "the Empire": "Cesarstwo", "Bandits about": "Bandyci w okolicy", "A lost shipment": "Zaginiony ładunek", "Strange lights": "Dziwne światła",
    "A clearing above a still lake, ringed by tall pines. Good timber all around.": "Polana nad spokojnym jeziorem, otoczona wysokimi sosnami. Dookoła dobre drewno.",
    "A dry rise above the Hjaalmarch fens. Fog in the mornings, clay underfoot.": "Suche wzniesienie nad mokradłami Hjaalmarch. Rano mgła, pod stopami glina.",
    "A windy shelf over the Sea of Ghosts. Hard stone, cold nights, a view of the ice.": "Wietrzna półka nad Morzem Duchów. Twardy kamień, zimne noce, widok na lód.",
    // places that keep their names
    "Bleak Falls Barrow": "Bleak Falls Barrow", "Clearspring Tarn": "Clearspring Tarn", "Fort Dawnguard": "Fort Dawnguard", "Castle Volkihar": "Castle Volkihar",
    "Pinewatch Hollow": "Pinewatch Hollow", "Fenhollow Rise": "Fenhollow Rise", "Frostcairn Rest": "Frostcairn Rest",

    // the dungeon on the map and its card
    "Go back in": "Wróć do środka", "easy": "łatwy", "hard": "trudny", "deadly": "zabójczy",
    "Nordic barrow": "Nordycki kurhan", Cave: "Jaskinia", "Bandit mine": "Kopalnia bandytów", "Dwemer ruin": "Ruiny Dwemerów", "Forsworn redoubt": "Reduta Wyrzeczonych",
    "Vampire lair": "Leże wampirów", "Temple ruin": "Ruiny świątyni", Fort: "Fort", "Thalmor keep": "Twierdza Thalmoru", "Bandit camp": "Obóz bandytów",
    "Ash cave": "Popielna jaskinia", "Temple of Miraak": "Świątynia Miraaka",
    "Inside, you pick your own way room by room down to the boss.": "W środku sam wybierasz drogę, komnata po komnacie, aż do bossa.",
    "Health doesn't come back on its own in there, and you can leave between rooms whenever you like.": "Zdrowie nie wraca tam samo, a między komnatami możesz wyjść, kiedy chcesz.",
    "Go in together": "Wejdźcie razem", "Co-op dungeons need the shared world.": "Wspólne lochy potrzebują wspólnego świata.",
    "Co-op run": "Wspólna wyprawa", "Travel there": "Jedź tam", "Leave the run": "Opuść wyprawę",
    "Cleared. Opens again in": "Oczyszczone. Znów otwarte za",
    // inside
    "no natural healing in here": "tu rany same się nie goją", "The entrance": "Wejście", "Which way?": "Którędy?", "The passage splits.": "Korytarz się rozwidla.",
    "Tap a glowing room on the map, or pick here:": "Stuknij świecącą komnatę na mapie albo wybierz tutaj:",
    "Head back outside": "Wyjdź na zewnątrz", "You play the fight turn by turn": "Walczysz turowo", "You play the fight turn by turn.": "Walczysz turowo.",
    "Smart AI": "Sprytna SI", your: "twoja", 
    // room choices
    "Run for it (Athletics)": "Uciekaj (Atletyka)", "Just push through": "Po prostu przejdź", "Push the lid open": "Odsuń wieko", "Leave it be": "Zostaw to",
    "Search the place": "Przeszukaj to miejsce", "Search it": "Przeszukaj", Pray: "Módl się", "Ignore it": "Zignoruj", "Find a way round": "Poszukaj obejścia",
    // the claw door's animals
    Bear: "Niedźwiedź", Eagle: "Orzeł", Hawk: "Jastrząb", Moth: "Ćma", Owl: "Sowa", Snake: "Wąż", Whale: "Wieloryb", Wolf: "Wilk",
    "A great round door bars the way to the inner tomb.": "Wielkie okrągłe drzwi zagradzają drogę do wewnętrznego grobowca.",
    "Three stone rings carved with animals turn in its face, and in the middle there's a socket shaped like a claw.": "Na ich tarczy obracają się trzy kamienne pierścienie z wyrzeźbionymi zwierzętami, a pośrodku jest gniazdo w kształcie szponu.",
    "Its palm shows the order.": "Na jego spodzie widać kolejność.", "You take it.": "Zabierasz go.",
    // traps (the room text says "A bear trap by the gate catches you")
    "Swinging blades": "Wahadłowe ostrza", "A dart wall": "Ściana z rzutkami", "An oil slick under a hanging brazier": "Plama oleju pod wiszącym koszem żaru",
    "A pressure plate under a ceiling of spikes": "Płyta naciskowa pod sufitem z kolcami", "A bear trap in the gravel": "Wnyki w żwirze",
    "A tripwire tied to a log": "Linka przywiązana do kłody", "A loose ceiling ready to fall": "Luźny strop, który zaraz spadnie",
    "A tripwire tied to a rockfall": "Linka przy osypisku kamieni", "A bear trap by the ore cart": "Wnyki przy wózku z rudą", "Steam vents": "Wyloty pary",
    "A blade trap in the floor grate": "Pułapka z ostrzem w kracie podłogi", "A sparking pressure plate": "Iskrząca płyta naciskowa", "A rune painted on the floor": "Runa wymalowana na podłodze",
    "A spiked log on a tripwire": "Kłoda z kolcami na lince", "A tripwire tied to a spiked log": "Linka przy kłodzie z kolcami", "A bear trap by the gate": "Wnyki przy bramie",
    "A tripwire strung between two tents": "Linka rozciągnięta między dwoma namiotami", "A bear trap hidden under leaves": "Wnyki ukryte pod liśćmi",
    "A sinkhole of loose ash": "Zapadlisko w sypkim popiele", "A burning-oil trip line": "Linka z płonącym olejem", "A ceiling of hanging ash ready to fall": "Strop z wiszącego popiołu, który zaraz runie",
    "A pillar of black stone that whispers": "Szepczący filar z czarnego kamienia", "A pressure plate under swinging blades": "Płyta naciskowa pod wahadłowymi ostrzami",
    // dragon priests and bosses
    "The sarcophagus lid grinds aside.": "Wieko sarkofagu ze zgrzytem odsuwa się na bok.", "You absorb the dragon's soul!": "Pochłaniasz duszę smoka!",
    "Skeletal guard": "Szkieletowy strażnik", "Word of Power learned:": "Poznane Słowo Mocy:",
    "Unlock it with a dragon soul in Magic → Shouts.": "Odblokuj je duszą smoka w Magia → Okrzyki.", "You already understand it.": "Już je rozumiesz.",
    // the fight log: little pieces after " · "
    "staggers you": "zbija cię z nóg", "you're burning": "płoniesz", "the ward breaks": "osłona pęka",
    // why the Smart AI picked a move
    "a dangerous fight": "groźna walka", "finishing blow": "cios kończący", "a caster: raises a ward": "rzuca czary: stawiam osłonę",
    "a long fight: cloak": "długa walka: płaszcz żywiołu", "a long fight: healing circle": "długa walka: krąg leczenia", "a long fight: summons help": "długa walka: przyzywam pomoc",
    "an easy fight: it will rise for you": "łatwa walka: wstanie dla ciebie", "an easy fight: traps its soul": "łatwa walka: łapię jego duszę",
    "armors up for a long fight": "zbroję się na długą walkę", "badly hurt": "ciężko ranny", "calms it and strikes freely": "uspokajam i biję bez przeszkód",
    "conjures a better weapon": "przyzywam lepszą broń", "guards against a big hit": "osłona przed mocnym ciosem", "hits the opening": "uderzam w lukę",
    "keeps their guard up": "trzymają gardę", "out of magicka": "brak magii", "paralyzes it": "paraliżuję", "scares it off for a while": "odstraszam na chwilę",
    "steps in front of you": "staje przed tobą", "their own tactics": "własna taktyka", "trades health for magicka": "zdrowie za magię", "turns the undead": "odpędzam nieumarłych",
    "vanishes for a sneak attack": "znikam do ataku z ukrycia", "drains the mage's magicka": "wysysam magię maga", "losing the race: heals": "przegrywam wyścig: leczę się",
    "patches up": "opatruję się", "turns the daedra": "odpędzam daedrę", "banishes the daedra": "odsyłam daedrę",
  };
  // traps also show lower-case ("a bear trap by the gate catches you.")
  for (const k of Object.keys(WORDS)) if (/^An? [a-z]/.test(k) && /trap|tripwire|plate|wall|ceiling|rune|log|slick|sinkhole|pillar|trip line/.test(k)) WORDS[k[0].toLowerCase() + k.slice(1)] = WORDS[k][0].toLowerCase() + WORDS[k].slice(1);
  for (const [k, v] of Object.entries(WORDS)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;

  // sentences inside longer room texts (the screen translator goes sentence by sentence)
  if (typeof I18N_STORY !== "undefined") {
    // lines written with an icon in front (" Isran adds 40 steel bolts…") also come without it, once the icon of a
    // longer journal line is set aside: add those too
    const ICON = /^[-]+\s+/;
    for (const [en, pl] of Object.entries(I18N_STORY.ex)) if (ICON.test(en) && typeof pl === "string") { const k = en.replace(ICON, ""); if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = pl.replace(ICON, ""); }
    const have = new Set(I18N_STORY.pats.map((p) => p[0]));
    for (const [en, pl] of I18N_STORY.pats.slice()) if (ICON.test(en)) { const k = en.replace(ICON, ""); if (!have.has(k) && /[a-z]{2}/i.test(k.replace(/\{\w+\}/g, ""))) { have.add(k); I18N_STORY.pats.push([k, pl.replace(ICON, "")]); } }   // never a bare "{0}"
    I18N_STORY.pats.push(
      ["A dragon soul will unlock it (Magic → Shouts).", "Odblokujesz je duszą smoka (Magia → Okrzyki)."],
      ["A dragon soul will unlock it (Hero tab).", "Odblokujesz je duszą smoka (zakładka Bohater)."],
      ["This is the master of {0}.", "Oto pan tego miejsca: {0}."],
      ["good from about level {0}.", "w sam raz mniej więcej od poziomu {0}."],
      ["You light a torch and step into {0}.", "Zapalasz pochodnię i wchodzisz do: {0}."],
      ["In the chest behind it: {0} gold{1}.", "W skrzyni za nim: {0} złota{1}."],
      ["Inside: {0} gold.", "W środku: {0} złota."],
      ["On a stone pedestal lies a dusty book: \"{0}\".", "Na kamiennym postumencie leży zakurzona książka: „{0}”."],
      ["With a grinding of stone the way opens onto a hidden chamber: {0} gold{1}.", "Ze zgrzytem kamienia otwiera się przejście do ukrytej komnaty: {0} złota{1}."],
      ["The {0} in your pack would fit.", "Pasowałby tu {0} z twojego plecaka."],
      ["A dead Dunmer thief lies by the door, clutching the {0}.", "Przy drzwiach leży martwy złodziej Dunmer, ściskając: {0}."],
      ["A dead looter lies by the door, clutching the {0}.", "Przy drzwiach leży martwy szabrownik, ściskając: {0}."],
      ["{0} rises in a cloud of embers, mask gleaming.", "{0} wznosi się w chmurze iskier, maska lśni."],
      ["{0} rises in a cloud of frost, mask gleaming.", "{0} wznosi się w chmurze szronu, maska lśni."],
      ["{0} rises in a cloud of crackling light, mask gleaming.", "{0} wznosi się w chmurze trzaskającego światła, maska lśni."],
      ["Invites show in {0}Social → Party.", "Zaproszenia zobaczysz w {0}Społeczność → Drużyna."],
      ["They point: \"{0}.", "Wskazują kierunek: „{0}."],
    );
    // road meetings, cut into sentences
    Object.assign(I18N_STORY.ex, {
      "Go and see.\"": "Idź i zobacz.”", "It's on your map now.": "Masz to teraz na mapie.",
      "When you look again, they're gone.": "Kiedy znów się odwracasz, już ich nie ma.",
      "\"No.\"": "„Nie.”", "It lunges.": "Rzuca się na ciebie.",
      "The wall's there still, they say.\"": "Podobno ta ściana wciąż tam stoi.”", "It's marked on your map.": "Masz to zaznaczone na mapie.",
    });
  }

  const SFX = [   // endings the fight log adds in brackets, sometimes several in a row
    [/^power attack$/, () => "potężny atak"], [/^critical$/, () => "krytyczne"], [/^dual cast$/, () => "oburęcznie"], [/^dual$/, () => "podwójnie"],
    [/^sneak attack$/, () => "atak z ukrycia"], [/^still rattled$/, () => "wciąż w szoku"], [/^it reels, but stands$/, () => "chwieje się, ale stoi"],
    [/^it reels but stays up$/, () => "chwieje się, ale stoi"], [/^deflected$/, () => "odbite"], [/^blocked$/, () => "zablokowane"],
    [/^caught on your shield (\d+)%$/, (m) => `na tarczy ${m[1]}%`], [/^blocked (\d+)%$/, (m) => `zablokowano ${m[1]}%`], [/^(\d+)% absorbed$/, (m) => `pochłonięto ${m[1]}%`],
    [/^ward soaks (\d+)$/, (m) => `osłona pochłania ${m[1]}`], [/^ward soaks (\d+), and breaks$/, (m) => `osłona pochłania ${m[1]} i pęka`],
    [/^ward soaks (\d+), (\d+) left$/, (m) => `osłona pochłania ${m[1]}, zostaje ${m[2]}`],
    [/^(.+)'s ward soaks (\d+%?)(, and breaks)?$/, (m) => `osłona (${W(m[1])}) pochłania ${m[2]}${m[3] ? " i pęka" : ""}`],
  ];
  const SFX_ALT = SFX.map(([re]) => re.source.slice(1, -1).replace(/\((?!\?)/g, "(?:")).join("|");
  const sfx = (x) => { for (const [re, f] of SFX) { const m = x.match(re); if (m) return f(m); } return null; };
  const ELEM = { fire: "ogień", frost: "mróz", shock: "prąd" };
  const SPELL = { "a fireball": "kulę ognia", "an ice spike": "lodowy kolec", "chain lightning": "łańcuch błyskawic", "a healing spell": "czar leczenia" };

  const PAT = [
    // a log line with endings in brackets: "Bandit chief hits 12 (caught on your shield 51%) (still rattled)", "Sneak attack ×3 (it reels, but stands): 45"
    [new RegExp(`^(.+?)((?: \\((?:${SFX_ALT})\\))+)(: \\d+)?$`), (m) => {
      const pl = m[2].slice(2, -1).split(") (").map(sfx);
      if (pl.some((x) => x == null)) return null;
      const head = T(m[1] + (m[3] || "")); if (head == null) return null;
      return `${head} ${pl.map((x) => `(${x})`).join(" ")}`;
    }],
    [/^Click\. Inside: (\d+) gold\.$/, (m) => `Klik. W środku: ${m[1]} złota.`],
    [/^the ([a-z][\w' -]+?) (hits \d+|misses|is staggered)$/, (m) => { const x = T(`${cap(m[1])} ${m[2]}`); return x; }],   // summons: "the storm atronach hits 12"
    [new RegExp(`^${ICO}you burn for (\\d+)$`, "u"), (m) => `${ic(m)}płoniesz: ${m[2]}`],
    [new RegExp(`^${ICO}chilled \\(−(\\d+) stamina\\)$`, "u"), (m) => `${ic(m)}wychłodzenie (−${m[2]} kondycji)`],
    [new RegExp(`^${ICO}jolted \\(−(\\d+) magicka\\)$`, "u"), (m) => `${ic(m)}porażenie (−${m[2]} magii)`],
    [new RegExp(`^${ICO}you bleed (\\d+)$`, "u"), (m) => `${ic(m)}krwawisz: ${m[2]}`],
    [new RegExp(`^${ICO}(flames|frost|lightning) cloak (\\d+)$`, "u"), (m) => `${ic(m)}płaszcz ${{ flames: "ognia", frost: "mrozu", lightning: "błyskawic" }[m[2]]}: ${m[3]}`],
    [new RegExp(`^${ICO}(fire|frost|shock) hurts it most$`, "u"), (m) => `${ic(m)}${ELEM[m[2]]} rani go najmocniej`],
    [new RegExp(`^${ICO}the (.+) feeds (fire|frost|shock)$`, "u"), (m) => `${ic(m)}${W(cap(m[2]))} wzmacnia ${ELEM[m[3]]}`],
    [/^Spotted while sneaking up \((\d+)% chance\)!$/, (m) => `Zauważono cię przy skradaniu (szansa ${m[1]}%)!`],
    [/^(.+) casts (a fireball|an ice spike|chain lightning|a healing spell): (\+?\d+)$/, (m) => `${W(m[1])} rzuca ${SPELL[m[2]]}: ${m[3]}`],
    [/^(.+)'s ward soaks (\d+)$/, (m) => `Osłona (${W(m[1])}) pochłania ${m[2]}`],
    [/^(.+) draws life from the tomb \(\+(\d+)\)$/, (m) => `${W(m[1])} czerpie życie z grobowca (+${m[2]})`],
    [/^(.+) raises a ward \((\d+)\)$/, (m) => `${W(m[1])} stawia osłonę (${m[2]})`],
    [/^(.+) summons an? (.+)$/, (m) => { const x = T(cap(m[2])); return x == null ? null : `${W(m[1])} przyzywa: ${x[0].toLowerCase() + x.slice(1)}`; }],
    [/^(.+)'s arrow glances off your shield$/, (m) => `Strzała (${W(m[1])}) odbija się od twojej tarczy`],
    [/^(.+)'s magic is reflected back at them \((\d+)\)$/, (m) => `Magia (${W(m[1])}) odbija się w nich (${m[2]})`],
    [/^(.+)'s blow passes through you$/, (m) => `Cios (${W(m[1])}) przechodzi przez ciebie`],
    [/^(.+)'s blow is reflected back \((\d+)\)$/, (m) => `Cios (${W(m[1])}) wraca do nich (${m[2]})`],
    [/^Scroll: (.+)$/, (m) => { const x = T(m[1]); return x == null ? null : `Zwój: ${x}`; }],
    [/^Defeat another dragon priest and take its mask \((\d+)\/(\d+) so far\)\.$/, (m) => `Pokonaj kolejnego smoczego kapłana i weź jego maskę (na razie ${m[1]}/${m[2]}).`],
    // a foe falls: "The bandit chief falls." (dungeon foes come lower-case)
    [/^The ([a-z][\w' ,-]*) falls\.$/, (m) => { const x = T(cap(m[1])); return x == null ? null : `${x} pada.`; }],
    // the dungeon screen
    [/^You're inside (.+)$/, (m) => `Jesteś w środku: ${m[1]}`],
    [/^(.+) is cleared$/, (m) => `${m[1]}: oczyszczone`],
    [/^hits for ~(\d+)$/, (m) => `trafia za ~${m[1]}`],
    [/^Room (\d+) of (\d+)$/, (m) => `Komnata ${m[1]} z ${m[2]}`],
    [/^found (\d+) gold(?: and (\d+) items?)?$/, (m) => `znaleziono ${m[1]} złota${m[2] ? ` i ${m[2]} ${plural(m[2], "przedmiot", "przedmioty", "przedmiotów")}` : ""}`],
    [/^(\d+) healing potions$/, (m) => `mikstury leczenia: ${m[1]}`],
    [/^Loot: (\d+) gold(.*)$/, (m) => `Łup: ${m[1]} złota${m[2]}`],
    [/^Loot: (.+)$/, (m) => `Łup: ${m[1]}`],
    [/^Found so far: (\d+) gold(.*)$/, (m) => `Znalezione do tej pory: ${m[1]} złota${m[2]}`],
    [/^\((.+) gear\)\.$/, (m) => `(zestaw: ${W(m[1])}).`],
    [/^Set them to (\w+), (\w+), (\w+)$/, (m) => `Ustaw je: ${[m[1], m[2], m[3]].map(W).join(", ")}`],
    [/^Pick the (.+) growing on the walls$/, (m) => `Zerwij ze ścian: ${W(m[1])}`],
    [/^In-game time: something new moves in on Day (\d+), (\d+:\d+) \(about (\d+) real (hours?|minutes)\)\.$/,
      (m) => `Czas w grze: coś nowego wprowadzi się w dniu ${m[1]}, o ${m[2]} (w prawdziwym czasie to mniej więcej ${m[3]} ${m[4].startsWith("hour") ? plural(m[3], "godzina", "godziny", "godzin") : "min"}).`],
  ];
  I18N_EXTRA.pat.unshift(...PAT.slice(0, 3));   // before older patterns that translated only "(dual cast)" or "hits 12" and left the foe's name
  I18N_EXTRA.pat.push(...PAT.slice(3));
  return { WORDS, PAT };
})();
