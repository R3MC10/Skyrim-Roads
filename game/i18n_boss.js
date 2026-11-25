/* i18n_boss.js: Polish for bossfight.js (boss bar, phases, big attacks, intro and loot cards, boss perks).
   Loaded after i18n_story.js and before i18n.js; adds to I18N_STORY.ex, so the screen translator and BOSSFIGHT's T both
   find it. Keys are the exact English text; "{0}" markers are filled in by bossfight.js. */
(() => {
  if (typeof I18N_STORY === "undefined") return;
  const PL = {
    // big attacks
    "Crushing Blow": "Miażdżący cios", "Wide Sweep": "Szerokie cięcie", "Spell Storm": "Burza zaklęć", "Great Breath": "Wielki oddech",
    "Tail Sweep": "Smagnięcie ogonem", "Unrelenting Force": "Nieustępliwa siła", "Soul Rend": "Rozdarcie duszy", "Steam Blast": "Wybuch pary", "Savage Leap": "Dziki skok",
    "Readies Crushing Blow": "Szykuje Miażdżący cios", "Readies Wide Sweep": "Szykuje Szerokie cięcie", "Readies Spell Storm": "Szykuje Burzę zaklęć",
    "Readies Great Breath": "Szykuje Wielki oddech", "Readies Tail Sweep": "Szykuje Smagnięcie ogonem", "Readies Unrelenting Force": "Szykuje Nieustępliwą siłę",
    "Readies Soul Rend": "Szykuje Rozdarcie duszy", "Readies Steam Blast": "Szykuje Wybuch pary", "Readies Savage Leap": "Szykuje Dziki skok",
    "lands next turn": "uderzy w następnej turze", "block": "blok", "dodge": "unik", "ward / block": "osłona / blok", "ward / dodge": "osłona / unik",
    "only a shout or bash stops it": "zatrzyma go tylko krzyk albo uderzenie tarczą",
    "Block (or end your turn after 2 moves or fewer) to halve it": "Zablokuj (albo skończ turę po 2 ruchach lub mniej), żeby go zmniejszyć o połowę",
    "A ward soaks most of it": "Osłona pochłonie większość",
    "End your turn after 2 moves or fewer to dodge most of it": "Skończ turę po 2 ruchach lub mniej, żeby uniknąć większości",
    "A shout or a shield bash breaks it": "Krzyk albo uderzenie tarczą go przerwie",
    // phases
    "{0} climbs higher and rains fire on you": "{0} wzbija się wyżej i zasypuje cię ogniem",
    "{0} crashes down, fighting for its life": "{0} spada na ziemię i walczy o życie",
    "{0} calls its dead servants out of the walls": "{0} wzywa martwych sług ze ścian",
    "{0}'s mask blazes with a new power": "Maska ({0}) płonie nową mocą",
    "{0} summons a servant to fight beside them": "{0} przyzywa sługę do pomocy",
    "{0} covers the floor in burning runes": "{0} pokrywa podłogę płonącymi runami",
    "The dead rise to {0}'s side": "Umarli powstają u boku ({0})",
    "{0} turns the air to killing frost": "{0} zamienia powietrze w zabójczy mróz",
    "{0} crackles with lightning": "{0} trzeszczy od błyskawic",
    "{0} vents scalding steam everywhere": "{0} bucha wrzącą parą na wszystkie strony",
    "{0}'s brood joins the fight": "Potomstwo ({0}) dołącza do walki",
    "{0} goes wild with rage": "{0} wpada w szał",
    "{0} gets angry and hits harder": "{0} wpada w gniew i bije mocniej",
    "{0} calls for help": "{0} woła o pomoc",
    "{0} changes": "{0} się zmienia",
    "Phase {0}: {1}": "Faza {0}: {1}", "Phase {0}/{1}": "Faza {0}/{1}", "Phase {0}": "Faza {0}",
    "it hits {0}% harder": "bije o {0}% mocniej", "{0} joins in": "{0} dołącza", "its magic turns to {0}": "jego magia zmienia się w {0}",
    "{0}: you take damage every round": "{0}: co rundę tracisz zdrowie",
    "fire": "ogień", "frost": "mróz", "shock": "błyskawice",
    // helpers and hazards
    "Risen draugr": "Wskrzeszony draugr", "Summoned atronach": "Przyzwany atronach", "Restless draugr": "Niespokojny draugr", "Its brood": "Jego potomstwo",
    "Loyal guard": "Wierny strażnik", "Helper": "Pomocnik", "Fire from above": "Ogień z nieba", "Soul fire": "Ogień dusz", "Burning runes": "Płonące runy",
    "Grave frost": "Grobowy mróz", "Scalding steam": "Wrząca para", "Freezing gale": "Lodowata wichura", "Hazard": "Zagrożenie",
    // titles
    "Doom on wings": "Zagłada na skrzydłach", "Terror of the northern sky": "Postrach północnego nieba", "Devourer of the hold": "Pożeracz krainy",
    "Masked servant of the dragons": "Zamaskowany sługa smoków", "Keeper of the old tomb": "Strażnik starego grobowca", "Voice of a dead age": "Głos umarłej epoki",
    "Master of forbidden magic": "Mistrz zakazanej magii", "The storm-caller": "Ten, który wzywa burze", "Reader of black books": "Czytelnik czarnych ksiąg",
    "Lord of the barrow": "Pan kurhanu", "The restless king": "Niespokojny król", "Who should have stayed dead": "Ten, który powinien był zostać martwy",
    "Guardian of the deep halls": "Strażnik głębokich sal", "Brass colossus": "Mosiężny kolos", "The machine that never sleeps": "Maszyna, która nigdy nie śpi",
    "Terror of the wilds": "Postrach dziczy", "The hungry dark": "Głodna ciemność", "Eater of hunters": "Pożeracz łowców",
    "The one they all fear": "Ten, którego wszyscy się boją", "Champion of the blade": "Mistrz ostrza", "Never beaten in this hall": "Niepokonany w tej sali",
    // the fight log
    "{0} stands before you. This won't be quick.": "{0} staje przed tobą. To nie będzie szybka walka.",
    "{0} readies {1}! It lands next turn.": "{0} szykuje: {1}! Uderzy w następnej turze.",
    "{0} readies {1}!": "{0} szykuje: {1}!",
    "{0} unleashes {1}!": "{0} uwalnia: {1}!",
    "you take {0} from {1}": "tracisz {0} przez {1}",
    "{0} hits you {1}": "{0} trafia cię za {1}", "{0} burns you for {1}": "{0} rani cię za {1}",
    "(the big attack is lost)": "(wielki atak przepada)", "(winded ×{0})": "(zadyszka ×{0})",
    "(you saw it coming: {0})": "(widzisz, co nadchodzi: {0})", "blocked": "zablokowane", "warded": "osłonięte", "dodged": "uniknięte",
    "(you cut down {0})": "(powalasz: {0})", "({0} takes {1})": "({0} przyjmuje {1})", "(you break its {0}!)": "(przerywasz: {0}!)",
    "(it reels and its next turn comes later)": "(zatacza się, a jego następna tura przychodzi później)",
    // cards and the bar
    "Tap to fight": "Dotknij, by walczyć", "takes some of your blows": "przyjmuje część twoich ciosów", "{0}: {1} a round": "{0}: {1} na rundę",
    "+{0}% damage": "+{0}% obrażeń", "Boss: the marks on the bar are where it changes how it fights.": "Boss: znaczniki na pasku pokazują, gdzie zmienia sposób walki.",
    "Boss defeated": "Boss pokonany", "{0} falls": "{0} pada", "{0} is beaten": "{0} pokonany", "Boss loot": "Łup z bossa", "{0} gold": "{0} złota", "Tap to close": "Dotknij, by zamknąć",
    // Withering Hex and Marked for Death (reactions.js: cleanse a hex, protect a friend)
    "Withering Hex": "Wyniszczająca klątwa", "Marked for Death": "Naznaczony na śmierć",
    "Readies Withering Hex": "Szykuje Wyniszczającą klątwę", "Readies Marked for Death": "Szykuje Naznaczenie na śmierć",
    "ward": "osłona", "cover": "osłoń",
    "It goes for a friend: Cover allies to take it yourself, at half": "Celuje w przyjaciela: Osłoń sojuszników, żeby przyjąć to na siebie, o połowę słabiej",
    "If it lands, a potion or a healing spell washes the hex off": "Jeśli trafi, mikstura albo czar leczenia zmyje klątwę",
    "{0} marks {1} for death! It lands next turn.": "{0} naznacza na śmierć: {1}! Uderzy w następnej turze.",
    "{0} marks {1} for death!": "{0} naznacza na śmierć: {1}!",
    "(you are hexed: it withers you every round until you wash it off with a potion or a healing spell)": "(ciąży na tobie klątwa: wyniszcza cię co rundę, dopóki nie zmyjesz jej miksturą albo czarem leczenia)",
    "(the hex is washed away)": "(klątwa zmyta)", "the hex fades": "klątwa słabnie i znika",
    "the hex withers you for {0}": "klątwa wyniszcza cię za {0}",
    "Hexed: {0} a round, {1} rounds": "Klątwa: {0} na rundę, jeszcze {1} rundy",
    "Washed off by a potion or a healing spell": "Zmyje ją mikstura albo czar leczenia",
    "(you take the blow meant for {0})": "(przyjmujesz cios wymierzony w: {0})", "your friend": "twojego przyjaciela", "covered": "osłonięte",
    // perks
    "Giant Slayer": "Pogromca olbrzymów", "Read the Signs": "Czytanie znaków", "Break Their Focus": "Wybicie z rytmu",
    "Bosses take 10% more damage from you, and 20% more once they reach their last phase.": "Bossowie dostają od ciebie o 10% więcej obrażeń, a w ostatniej fazie o 20% więcej.",
    "A boss's big attacks (the ones it shows a turn ahead) hurt you 25% less.": "Wielkie ataki bossa (te, które widać turę wcześniej) ranią cię o 25% słabiej.",
    "Any blow that takes a tenth of a boss's health breaks the big attack it's getting ready, and it reels: its next turn comes later.": "Każdy cios, który zabiera bossowi dziesiątą część zdrowia, przerywa wielki atak, który szykuje, a boss zatacza się: jego następna tura przychodzi później.",
  };
  for (const [k, v] of Object.entries(PL)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
})();
