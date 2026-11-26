/* i18n_rows.js: Polish for build 354's front and back rows and foe roles (foefield.js, foeroles.js, the new lines in
   foekit.js, fightread.js and perkfx.js) and its patch note. Loaded before i18n.js; exact lines go in
   I18N_EXTRA.words (lines with {0} are filled in after translating), lines with numbers in I18N_EXTRA.pat.
   The role names themselves live in names.js (type "role"). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // the rows on the fight screen
    "Rows": "Szeregi", "Front": "Przód", "Back": "Tył", "front": "przednim", "back": "tylnym", "Front row": "Przedni szereg", "Back row": "Tylny szereg", "your front row": "twój przedni szereg", "your back row": "twój tylny szereg",
    "You": "Ty", "You: {0} row": "Ty: {0} szereg", "foe": "wróg",
    "Behind the {0}": "Za: {0}", "Behind the front row": "Za przednim szeregiem", "Your melee can't reach it yet": "Twoja broń biała jeszcze tam nie sięga",
    "The {0} falls!": "{0} pada!",
    "The {0} falls! {1} left: you turn to the {2}.": "{0} pada! Zostało: {1}. Bierzesz na cel: {2}.",
    "(you break through their line to the {0})": "(przebijasz się przez ich szereg do: {0})",
    "(the {0} is behind the front row: you hit the {1})": "({0} stoi za przednim szeregiem: trafiasz w: {1})",
    "(the {0} steps in front of the {1})": "({0} zasłania: {1})",
    "(it also hits {0})": "(trafia też: {0})",
    // foe intents on the plates
    "Cover → {0}": "Osłona → {0}", "Cover": "Osłona", "Casting {0} → {1}": "Rzuca {0} → {1}", "Fireball": "Kulę ognia",
    "Mend → {0}": "Leczy → {0}", "Mend": "Leczenie", "Rally: all hit harder": "Okrzyk: wszyscy biją mocniej",
    "Regenerate · fire stops it": "Regeneracja · ogień ją zatrzymuje", "Winding up a heavy strike": "Bierze zamach do ciężkiego ciosu", "Taking aim": "Celuje",
    "Channels": "Skupia czar", "Rally": "Okrzyk",
    "takes your next direct attack on that foe": "przyjmuje twój następny bezpośredni atak na tego wroga",
    "a Fireball on a whole row comes next": "zaraz kula ognia na cały szereg",
    "hits everyone in that row": "trafia każdego w tym szeregu",
    "every foe hits 25% harder for 2 turns": "każdy wróg bije o 25% mocniej przez 2 tury",
    "fire stops it": "ogień ją zatrzymuje",
    "Channelling a Fireball at your front row: it lands on its next move. Bash it, shock it, stun or stagger it to break it.":
      "Skupia kulę ognia na twoim przednim szeregu: spadnie przy jego następnym ruchu. Uderz go tarczą, poraź prądem, ogłusz albo zachwiej, żeby to przerwać.",
    "Channelling a Fireball at your back row: it lands on its next move. Bash it, shock it, stun or stagger it to break it.":
      "Skupia kulę ognia na twoim tylnym szeregu: spadnie przy jego następnym ruchu. Uderz go tarczą, poraź prądem, ogłusz albo zachwiej, żeby to przerwać.",
    // what the roles do (the fight log)
    "{0} raises a shield in front of the {1}": "{0} zasłania tarczą: {1}",
    "{0} starts channelling a Fireball at your {1} row. Bash it, shock it or stagger it to break it!": "{0} zaczyna skupiać kulę ognia na twoim {1} szeregu. Uderz go tarczą, poraź prądem albo zachwiej, żeby to przerwać!",
    "{0}'s Fireball bursts over your {1} row: {2}": "Kula ognia ({0}) wybucha nad twoim {1} szeregiem: {2}",
    "{0} mends the {1} (+{2})": "{0} leczy: {1} (+{2})",
    "{0} rallies the others: they all hit 25% harder for 2 turns": "{0} podrywa resztę: wszyscy biją o 25% mocniej przez 2 tury",
    "(you break the {0}'s spell!)": "(przerywasz czar: {0}!)",
    "(Spellbreaker: it staggers)": "(Łamacz Czarów: zachwiał się)",
    "it fights as a {0} now": "teraz walczy jako {0}",
    // the Hero panel
    "Fight row: {0}": "Szereg w walce: {0}", "(from your gear)": "(z twojego ekwipunku)", "Auto": "Auto",
    "Front row: blades and shields, foes' blades can reach you. Back row: bows, staffs and spells, safe from their blades while your front row stands. It never changes damage.":
      "Przedni szereg: ostrza i tarcze, ostrza wrogów cię sięgają. Tylny szereg: łuki, kostury i czary, bezpieczny przed ich ostrzami, póki stoi twój przedni szereg. Nigdy nie zmienia obrażeń.",
    "You'll stand in the {0} row in fights{1}": "W walce staniesz w {0} szeregu{1}", " (your gear decides)": " (decyduje ekwipunek)",
    // the new perks (perkfx.js)
    "Line Breaker": "Łamacz Szyku", "Sweeping Reach": "Szeroki Zasięg", "Spellbreaker": "Łamacz Czarów", "Through the Gap": "Przez Lukę",
    "Once a fight, a melee move reaches a foe in the back row even while their front row stands. [OURS]":
      "Raz na walkę ruch bronią białą sięga wroga w tylnym szeregu, nawet gdy stoi ich przedni szereg. [OURS]",
    "When you break a foe's channelled spell (a bash, a shock spell, a stun or a stagger), it also staggers. [OURS]":
      "Gdy przerwiesz skupiany czar wroga (uderzeniem tarczą, czarem prądu, ogłuszeniem albo zachwianiem), wróg też się zachwieje. [OURS]",
    "Your arrows and direct spells slip past a Shieldwarden's Cover: they always hit the foe you aim at. [OURS]":
      "Twoje strzały i bezpośrednie czary omijają Osłonę Tarczownika: zawsze trafiają wroga, w którego celujesz. [OURS]",
    // the patch note (patchnotes.js b358-rows)
    "Front and back rows": "Przedni i tylny szereg",
    "Groups of foes now stand on the field together, in a front row and a back row. A strip over the fight shows both rows: tap a foe (or press [ and ] on PC) to aim at it.":
      "Grupy wrogów stoją teraz na polu razem, w przednim i tylnym szeregu. Pasek nad walką pokazuje oba szeregi: dotknij wroga (albo naciśnij [ i ] na PC), żeby w niego celować.",
    "Blades, shield bashes and power attacks reach only the front row while anyone stands there. Bows, thrown things and spells you aim reach both rows. A foe you can't reach yet is greyed out and says why.":
      "Ostrza, uderzenia tarczą i potężne ciosy sięgają tylko przedniego szeregu, póki ktoś w nim stoi. Łuki, rzucane rzeczy i celowane czary sięgają obu szeregów. Wróg, którego jeszcze nie sięgasz, jest wyszarzony i mówi dlaczego.",
    "Area spells hit the whole row of the foe you aim at (Adept and Expert) or both rows (Master). The foe you aim at takes it all, the others a share.":
      "Czary obszarowe trafiają cały szereg wroga, w którego celujesz (Adept i Ekspert), albo oba szeregi (Mistrz). Cel dostaje całość, reszta część.",
    "You stand in a row too: your gear picks it (sword and shield, two-hander or dagger in front; bow, staff or a mage in the back). Change it in the Hero panel (Fight row: Auto, Front or Back); it's saved with your loadout. Foes' blades can't reach your back row while your front row stands. Rows never change how hard anyone hits.":
      "Ty też stoisz w szeregu: wybiera go ekwipunek (miecz i tarcza, broń dwuręczna albo sztylet z przodu; łuk, kostur albo mag z tyłu). Zmienisz to w panelu Bohatera (Szereg w walce: Auto, Przód albo Tył); zapisuje się z zestawem. Ostrza wrogów nie sięgają twojego tylnego szeregu, póki stoi przedni. Szeregi nigdy nie zmieniają siły ciosów.",
    "Foes have roles you can read on their plates: Shieldwardens cover a friend once, Ravagers hit hard, Marksmen shoot from the back, Spellcasters channel a Fireball at a whole row (bash it, shock it, stun or stagger it to break it), Menders heal, Cutthroats slip round your front, Regrowers heal unless they burn, Warleaders rally the rest. Bosses change role as their fight goes on.":
      "Wrogowie mają role widoczne na ich paskach: Tarczownicy raz osłaniają towarzysza, Niszczyciele biją mocno, Strzelcy strzelają z tyłu, Czarownicy skupiają kulę ognia na całym szeregu (uderz go tarczą, poraź prądem, ogłusz albo zachwiej, żeby to przerwać), Uzdrowiciele leczą, Rzezimieszki obchodzą twój przód, Odrastający leczą się, chyba że płoną, Wodzowie podrywają resztę. Bossowie zmieniają rolę w trakcie walki.",
    "A party meets more foes the bigger it is (2-3 for two players, up to 5-6 for eight). Their total health stays the same, just spread over more foes.":
      "Im większa drużyna, tym więcej wrogów (2-3 dla dwóch graczy, do 5-6 dla ośmiu). Ich łączne zdrowie zostaje takie samo, tylko rozłożone na więcej wrogów.",
    "Four new perks: Line Breaker and Sweeping Reach (once a fight, a blade reaches the back row), Spellbreaker (breaking a channelled spell also staggers the caster) and Through the Gap (your arrows and spells slip past a Shieldwarden's cover).":
      "Cztery nowe atuty: Łamacz Szyku i Szeroki Zasięg (raz na walkę ostrze sięga tylnego szeregu), Łamacz Czarów (przerwanie skupianego czaru zachwiewa też rzucającym) i Przez Lukę (twoje strzały i czary omijają osłonę Tarczownika).",
    "On Hard, foes shrug off a fifth of every damage spell: mages were winning far more Hard fights than anyone else.":
      "Na Trudnym wrogowie odpierają jedną piątą każdego czaru zadającego obrażenia: magowie wygrywali dużo więcej trudnych walk niż ktokolwiek inny.",
    "Auto no longer wastes Sun Fire on foes that aren't undead.": "Auto nie marnuje już Słonecznego Ognia na wrogów, którzy nie są nieumarli.",
  });
  I18N_EXTRA.pat.push(
    [/^(.+) raises a shield$/, (m) => `${m[1]} unosi tarczę`],
    [/^(.+) mutters a prayer$/, (m) => `${m[1]} mamrocze modlitwę`],
    [/^hits both rows \(the others take (\d+)%\)$/, (m) => `trafia oba szeregi (reszta dostaje ${m[1]}%)`],   // area spells in the Magic menu (magic.js)
    [/^hits its row \(the others there take (\d+)%\)$/, (m) => `trafia swój szereg (reszta w nim dostaje ${m[1]}%)`],
  );
})();
