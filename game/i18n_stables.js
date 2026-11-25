/* i18n_stables.js: Polish for the whole stables screen (horses.js names, the horse card and shop rows in ui.js stablesHTML,
   the cart card in ui.js cartHTML, the stable master at the top, the bond bar label in bonds.js) and its patch note.
   Loaded before i18n.js: exact lines go in I18N_EXTRA.words, text with numbers or names in I18N_EXTRA.pat, and sentences
   inside longer paragraphs in I18N_STORY (the screen translator splits paragraphs into sentences). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const BREED = { "Cyrodilic bay": "Gniadosz z Cyrodiil", "Nord draft": "Nordycki koń pociągowy", "Hammerfell courser": "Rumak z Hammerfell", "Highland pony": "Kucyk górski" };
  const WORDS = {
    ...BREED,
    // coats (Chestnut is in i18n_horseart.js)
    Bay: "Gniady", Black: "Kary", "Dapple grey": "Siwy jabłkowity", White: "Biały", Palomino: "Izabelowaty", Paint: "Srokaty",
    // armor, shoes, saddlebags
    "No armor": "Bez zbroi", "Steel horse armor": "Stalowa zbroja dla konia", "Elven horse armor": "Elfia zbroja dla konia",
    "Bare hooves": "Bose kopyta", "Iron horseshoes": "Żelazne podkowy", "Steel horseshoes": "Stalowe podkowy", "Elven horseshoes": "Elfie podkowy",
    Saddlebags: "Juki", "Big saddlebags": "Duże juki", "Pack frame": "Stelaż juczny",
    Horseshoes: "Podkowy", "Horse armor": "Zbroja dla konia", Owned: "Kupione", "Have better": "Masz lepsze",
    // the horse card
    Rename: "Zmień imię", "New name": "Nowe imię", "Name your horse": "Nazwij konia", "Horse name": "Imię konia",
    // the buy card's paragraph as a whole (a general "X: Y" pattern would otherwise split it at the colon)
    "Riding, you travel faster and flee more easily. Your horse carries things for you even when you walk beside it. Horses never die: at 0 health they are downed. A downed horse stays with you and still carries your things, but you can't ride it until it gets back up (a few hours, a night's sleep, or a stablehand's care).":
      "Konno podróżujesz szybciej i łatwiej uciekasz. Koń niesie twoje rzeczy, nawet gdy idziesz obok niego. Konie nigdy nie giną: przy 0 zdrowia padają. Powalony koń zostaje z tobą i dalej niesie twoje rzeczy, ale nie pojedziesz na nim, dopóki nie wstanie (kilka godzin, noc snu albo opieka stajennego).",
    "The all-rounder.": "Wszechstronny.", "The stables open at 08:00.": "Stajnia otwiera się o 08:00.",
    // the cart
    "A cart": "Wóz", "Your cart": "Twój wóz", "Buy the cart": "Kup wóz", "You need a horse first": "Najpierw potrzebujesz konia",
    "Leave it here": "Zostaw go tutaj", "Hitch it up": "Zaprzęgnij", "Iron wheels fitted": "Okute koła założone",
    // the stable master and the town list line
    "Stable master": "Koniuszy", "Best horses in the hold. Ask anyone.": "Najlepsze konie w krainie. Zapytaj kogokolwiek.",
    "She's a good runner. Feed her and she'll carry you.": "Dobrze biega. Nakarm ją, a cię poniesie.", "Horses don't lie. People do.": "Konie nie kłamią. Ludzie tak.",
    "Buy a horse or a cart to travel and carry more.": "Kup konia albo wóz, by szybciej podróżować i więcej nosić.",
    // the corner banners (polish.js) that also pop up over the stables, e.g. QUEST STARTED on a new game
    Achievement: "Osiągnięcie", "Hold captured": "Kraina zdobyta", Objective: "Cel", Discovered: "Odkryto", "Job done": "Zlecenie wykonane",
    "Quest completed": "Zadanie ukończone", "Quest started": "Rozpoczęto zadanie", "Questline completed": "Wątek ukończony",
    "World event": "Wydarzenie w świecie", "Skill increased": "Umiejętność wzrosła",
    // patch note
    "Tidier stables": "Porządniejsza stajnia",
    "The stables screen is now fully in Polish: saddlebags, horseshoes, horse armor, breeds, coats, the cart and renaming your horse.":
      "Ekran stajni jest teraz w całości po polsku: juki, podkowy, zbroja dla konia, rasy, umaszczenia, wóz i zmiana imienia konia.",
    "Your horse's card shows its painted picture in its own coat, in a proper frame, instead of a tiny icon. A knocked-down horse lies down in the picture.":
      "Karta konia pokazuje jego malowany obrazek w jego umaszczeniu, w porządnej ramce, zamiast małej ikonki. Powalony koń leży na obrazku.",
    "The bond bar now says what it measures, for example 4/100 toward level 4, so a nearly empty bar right after a new level doesn't look broken.":
      "Pasek więzi mówi teraz, co mierzy, na przykład 4/100 do poziomu 4, więc prawie pusty pasek tuż po nowym poziomie nie wygląda na zepsuty.",
    "The banners in the corner, like Quest started, Objective and Skill increased, are in Polish now too.":
      "Banery w rogu ekranu, takie jak Rozpoczęto zadanie, Cel i Umiejętność wzrosła, też są już po polsku.",
  };
  for (const [k, v] of Object.entries(WORDS)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  I18N_EXTRA.pat.push(
    [/^carries (\d+) more$/, (m) => `uniesie o ${m[1]} więcej`],
    [/^ride (\d+)% faster$/, (m) => `jazda szybsza o ${m[1]}%`],
    [/^takes (\d+)% less damage$/, (m) => `o ${m[1]}% mniej obrażeń`],
    [/^Buy (.+)$/, (m) => (BREED[m[1]] ? `Kup: ${BREED[m[1]]}` : null)],
    [/^Iron wheels \((\d+)\)$/, (m) => `Okute koła (${m[1]})`],
    [/^Hitched up: \+(\d+) carry weight, roads only\.( Iron-bound wheels\.)?$/, (m) => `Zaprzężony: +${m[1]} udźwigu, tylko po drogach.${m[2] ? " Koła okute żelazem." : ""}`],
    [/^(.+) is downed: they limp along beside you but can't be ridden\. Back on their feet in about (\d+) hours? \((\d+) min\), or after you sleep\.$/,
      (m) => `Koń (${m[1]}) jest powalony: kuleje obok ciebie, ale nie da się na nim jechać. Wstanie za około ${m[2]} godz. (${m[3]} min) albo gdy się prześpisz.`],
    [/^Your name in (.+):$/, (m) => `Twoja sława (${m[1]}):`],
    [/^· (\d+)% off in shops$/, (m) => `· ${m[1]}% taniej w sklepach`],
  );
  if (typeof I18N_STORY !== "undefined") {
    const EX = {
      // the buy card, split into sentences by the translator
      "Riding, you travel faster and flee more easily.": "Konno podróżujesz szybciej i łatwiej uciekasz.",
      "Your horse carries things for you even when you walk beside it.": "Koń niesie twoje rzeczy, nawet gdy idziesz obok niego.",
      "Horses never die: at 0 health they are downed.": "Konie nigdy nie giną: przy 0 zdrowia padają.",
      "A downed horse stays with you and still carries your things, but you can't ride it until it gets back up (a few hours, a night's sleep, or a stablehand's care).":
        "Powalony koń zostaje z tobą i dalej niesie twoje rzeczy, ale nie pojedziesz na nim, dopóki nie wstanie (kilka godzin, noc snu albo opieka stajennego).",
      "Slow and huge.": "Wolny i ogromny.", "Carries the most and shrugs off hits.": "Niesie najwięcej i nic sobie nie robi z ciosów.",
      "The fastest on the road, but carries little.": "Najszybszy na drodze, ale niewiele uniesie.", "Cheap, stubborn and sturdy.": "Tani, uparty i wytrzymały.",
      "You go 10% slower, keep to the roads, and bandits sometimes come for the cargo.": "Jedziesz o 10% wolniej, trzymasz się dróg, a bandyci czasem polują na ładunek.",
      "Your horse isn't here to pull it.": "Nie ma tu twojego konia, który by go ciągnął.", "Iron-bound wheels.": "Koła okute żelazem.",
      // the bond bar label (bonds.js F() template)
      "{0}/{1} toward level {2}": "{0}/{1} do poziomu {2}",
    };
    for (const [k, v] of Object.entries(EX)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
    const PATS = [
      ["Hitched to your horse it carries +{0}.", "Zaprzężony do konia uniesie +{0}."],
      ["Waiting at the stables in {0}.", "Czeka w stajni: {0}."],
      ["Every horse is a little different: its numbers can come out up to {0}% better or worse than its breed's.",
        "Każdy koń jest trochę inny: jego liczby mogą wyjść do {0}% lepsze albo gorsze niż u jego rasy."],
      ["{0} keeps out of the war.", "{0} trzyma się z dala od wojny."],
    ];
    for (const p of PATS) if (!I18N_STORY.pats.some(([en]) => en === p[0])) I18N_STORY.pats.push(p);
  }
})();
