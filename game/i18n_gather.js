/* i18n_gather.js: Polish for gathering (gather.js, harvest.js, harvestgame.js) and its patch notes. Loaded after i18n.js:
   exact lines go into I18N.PL (the screen translator), lines with {markers} go to I18N.add for HARVEST.T. [OURS] */
const I18N_GATHER = (() => {
  const PL = {
    "Couldn't gather that. Please try again.": "Nie udało się tego zebrać. Spróbuj jeszcze raz.",
    // ---- the hand harvest (harvestgame.js)
    Snip: "Utnij", "Dig up": "Wykop", Scrape: "Zeskrob", "Ease out": "Wyciągnij ostrożnie", Pick: "Zerwij", Lift: "Podnieś", "Pry open": "Podważ",
    "Swipe across the stem at the glowing mark.": "Przeciągnij palcem przez łodygę w świecącym miejscu.",
    "Rub the loose soil away, then pull the root up: slow and steady.": "Zetrzyj luźną ziemię, potem wyciągnij korzeń: powoli i równo.",
    "Scrape along the glowing line in one stroke.": "Zeskrob wzdłuż świecącej linii jednym ruchem.",
    "Fragile! Drag it up very slowly. Keep the strain out of the red.": "Delikatny! Ciągnij w górę bardzo powoli. Nie wchodź z naprężeniem na czerwone.",
    "Tap the ripe red berries. Leave the green ones.": "Stukaj w dojrzałe czerwone jagody. Zielone zostaw.",
    "Drag the egg to the basket. Gently: rushing cracks it.": "Przeciągnij jajo do koszyka. Delikatnie: pośpiech je stłucze.",
    "Hold to pry the shell open. Let go in the green.": "Przytrzymaj, by podważyć muszlę. Puść na zielonym.",
    "You crushed the stem a bit.": "Trochę zgniotłeś łodygę.",
    "Now pull it up: slow and steady.": "Teraz wyciągnij: powoli i równo.",
    "Too fast: it bruised. You save one.": "Za szybko: obiło się. Ratujesz jedną sztukę.",
    "Snap! The root broke. You save a piece.": "Trzask! Korzeń pękł. Ratujesz kawałek.",
    "Crack! You were too quick. You save what you can.": "Chrup! Za szybko. Ratujesz, co się da.",
    "You only got part of it.": "Udało się zebrać tylko część.",
    "It clamped shut. You pry out a small one.": "Zatrzasnęła się. Wydłubujesz małą.",
    "It snapped shut. Once more!": "Zatrzasnęła się. Jeszcze raz!",
    "Not that one: it isn't ripe.": "Nie ta: jeszcze niedojrzała.",
    "Too many green ones.": "Za dużo zielonych.",
    "Time's up.": "Koniec czasu.",
    "Too slow: you grab what you can.": "Za wolno: łapiesz, co się da.",
    Harvest: "Zbiór", Gather: "Zbierz", Stop: "Przerwij", Quick: "Szybko", Done: "Gotowe", Deliver: "Oddaj",
    "Perfect harvest": "Idealny zbiór", "Good harvest": "Dobry zbiór", "Rough harvest": "Niezgrabny zbiór",
    "Green Thumb": "Zielony Palec", doubled: "podwójnie", "Nothing gathered.": "Nic nie zebrano.",
    "You can Quick Gather this one now.": "Tę roślinę możesz już zbierać szybko.",
    "in reach": "w zasięgu", "in reach as you pass": "w zasięgu, gdy przejeżdżasz",
    "Quick Gather: no mini-game, a little less": "Szybkie zbieranie: bez minigry, trochę mniej",
    "That patch is too far away. Walk closer.": "Ta kępa jest za daleko. Podejdź bliżej.",
    "Already picked. It grows back in a couple of days.": "Już zebrane. Odrośnie za parę dni.",
    "One is glowing!": "Jedna świeci!", "One is perfect!": "Jedna jest idealna!",
    // ---- herb orders (harvest.js)
    "Herb order": "Zamówienie na zioła", "Filled. A new order comes tomorrow.": "Zrealizowane. Nowe zamówienie jutro.",
    "There's no herb order here.": "Tu nie ma zamówienia na zioła.",
    "You already filled today's order here. Come back tomorrow.": "Dzisiejsze zamówienie już tu zrealizowałeś. Wróć jutro.",
    "The alchemists have all they need from you today. Try again tomorrow.": "Alchemicy mają już od ciebie wszystko na dziś. Spróbuj jutro.",
    // ---- cooking
    "Cold slows you less, +15 stamina": "Zimno mniej cię spowalnia, +15 wytrzymałości",
    "+15 health, stamina comes back faster": "+15 zdrowia, wytrzymałość wraca szybciej",
    // ---- perks (perkfx.js)
    "Herbalist's Eye": "Oko zielarza", "Sure Hands": "Pewne ręce", Anatomist: "Anatom", "Master Gardener": "Mistrz ogrodnik",
    "When you harvest by hand, perfect and glowing specimens turn up half again as often. [OURS, gathering]":
      "Gdy zbierasz ręcznie, idealne i świecące okazy trafiają się o połowę częściej. [OURS, gathering]",
    "Hand harvesting is easier and quicker: wider sweet spots, less work, a second more on the clock, and Quick Gather opens after two harvests instead of three. [OURS, gathering]":
      "Ręczne zbieranie jest łatwiejsze i szybsze: szersze dobre miejsca, mniej pracy, sekunda więcej na zegarze, a szybkie zbieranie otwiera się po dwóch zbiorach zamiast trzech. [OURS, gathering]",
    "Beasts you kill give one extra part 30% of the time. [OURS, gathering]": "Zabite bestie w 30% przypadków dają jedną dodatkową część. [OURS, gathering]",
    "Every garden bed gives one more ingredient each harvest. [OURS, gathering]": "Każda grządka daje przy każdym zbiorze jeden składnik więcej. [OURS, gathering]",
    // patch note b229-gatherfix
    "Picking herbs fixed": "Naprawione zbieranie ziół",
    "On a PC the Gathering card sat in the side panel, which the big map hides, so there was no way to pick plants or forage. It now floats on the left of the map whenever plants are in reach.":
      "Na komputerze karta Zbieranie siedziała w bocznym panelu, który zasłania duża mapa, więc nie dało się zbierać roślin ani szukać ziół. Teraz unosi się po lewej stronie mapy, gdy rośliny są w zasięgu.",
    "Some older saves made the Gather button do nothing. Those heroes pick plants, forage and plant gardens normally again.":
      "Na niektórych starszych zapisach przycisk Zbierz nic nie robił. Ci bohaterowie znowu normalnie zbierają rośliny, szukają ziół i sadzą ogródki.",
    "If picking ever goes wrong, you now get a short message instead of a button that does nothing.":
      "Gdy zbieranie się nie uda, dostajesz krótką wiadomość zamiast przycisku, który nic nie robi.",
    // patch note b232-gathering
    "Picking herbs by hand": "Zbieranie ziół własnymi rękami",
    "Gathering is now a short hands-on mini-game: snip flowers at the stem, dig roots up slowly, scrape fungus in one stroke, pick only the ripe berries, lift eggs gently and ease a fragile Nirnroot out of the mud. Do it well and you get more; even a clumsy try gives you something.":
      "Zbieranie to teraz krótka minigra: ucinasz kwiaty przy łodydze, powoli wykopujesz korzenie, zeskrobujesz grzyby jednym ruchem, zrywasz tylko dojrzałe jagody, delikatnie podnosisz jaja i ostrożnie wyciągasz kruchy nirnkorzeń z błota. Im lepiej ci pójdzie, tym więcej zbierzesz; nawet niezgrabna próba coś daje.",
    "Picked a plant three times by hand? A Quick button lets you skip the mini-game for a slightly smaller handful.":
      "Zebrałeś roślinę trzy razy ręcznie? Przycisk Szybko pozwala pominąć minigrę za nieco mniejszą garść.",
    "Herbs nearby are easy to spot: painted markers on the map, a ring that shows how far you can reach, and a Gather button that pops up on the road, even while you ride past.":
      "Zioła w pobliżu łatwo wypatrzyć: malowane znaczniki na mapie, krąg pokazujący twój zasięg i przycisk Zbierz, który wyskakuje w drodze, nawet gdy przejeżdżasz konno.",
    "Now and then you find a perfect or a glowing plant. The next potion you brew with it is 15% or 25% stronger.":
      "Od czasu do czasu znajdziesz idealną albo świecącą roślinę. Następna mikstura, którą z nią uwarzysz, będzie o 15% lub 25% silniejsza.",
    "Each town's alchemist posts a daily herb order that pays well, and more when the hold is in trouble. That herb also sells for more there that day.":
      "Alchemik w każdym mieście co dzień wystawia zamówienie na zioła, które dobrze płaci, a jeszcze lepiej, gdy kraina ma kłopoty. Tego dnia to zioło sprzedaje się tam też drożej.",
    "New recipes: Snowberry and Juniper Berry crostatas at the cooking fire, and Tundra Cotton twists into leather strips at the tanning rack.":
      "Nowe przepisy: crostaty ze śnieżnymi jagodami i z jałowcem przy ognisku, a bawełnę tundrową skręcisz w paski skóry na stojaku garbarskim.",
    "Four new Alchemy perks: Herbalist's Eye (more rare finds), Sure Hands (easier mini-game, Quick sooner), Anatomist (extra parts from beasts) and Master Gardener (more from every garden bed).":
      "Cztery nowe atuty alchemii: Oko zielarza (więcej rzadkich znalezisk), Pewne ręce (łatwiejsza minigra, Szybko wcześniej), Anatom (dodatkowe części z bestii) i Mistrz ogrodnik (więcej z każdej grządki).",
    "In a party everyone picks their own share of each patch, so there's nothing to fight over.":
      "W drużynie każdy zbiera swoją część z każdej kępy, więc nie ma się o co kłócić.",
  };
  /* lines with {markers}: HARVEST.T fills them in */
  const TPL = {
    "Glowing: your next potion with it is 25% stronger": "Świecąca: następna mikstura z nią jest o 25% silniejsza",
    "Perfect: your next potion with it is 15% stronger": "Idealna: następna mikstura z nią jest o 15% silniejsza",
    "{n} glowing": "{n} świecące", "{n} perfect": "{n} idealne",
    "Glowing {item}": "Świecący okaz: {item}", "Perfect {item}": "Idealny okaz: {item}", "+{n}% potion": "mikstura +{n}%",
    "The glowing {item} makes it {n}% stronger.": "Świecący okaz ({item}) czyni ją o {n}% silniejszą.",
    "The perfect {item} makes it {n}% stronger.": "Idealny okaz ({item}) czyni ją o {n}% silniejszą.",
    "You need {n} {item} (you have {m}).": "Potrzeba: {item} ×{n} (masz {m}).",
    "You hand over {n} {item} and get {g} gold.": "Oddajesz {item} ×{n} i dostajesz {g} złota.",
    "Pays {g} gold · you have {n}": "Płaci {g} złota · masz {n}",
    "Pays {g} gold (hard times in the hold: they pay extra) · you have {n}": "Płaci {g} złota (ciężkie czasy w krainie: płacą więcej) · masz {n}",
    "{item} is wanted here today, so it also sells for more in this town.": "Tu dziś szukają: {item}, więc w tym mieście sprzedaje się to też drożej.",
    "Tap Gather to pick by hand: better hands, bigger yield. Picked a plant {n} times? Quick skips the mini-game. In a party everyone picks their own share of each patch.":
      "Stuknij Zbierz, by zbierać ręcznie: zręczniejsze ręce, większy zbiór. Zebrałeś roślinę {n} razy? Szybko pomija minigrę. W drużynie każdy zbiera swoją część z każdej kępy.",
    "Quick Gather unlocked for {item}.": "Szybkie zbieranie odblokowane: {item}.",
    "Hand-picked {n} of {m}: then Quick Gather opens.": "Zebrane ręcznie {n} z {m}: potem otworzy się szybkie zbieranie.",
  };
  // short words ("Done", "Stop") may already mean something elsewhere: those keep their old Polish
  const fresh = {};
  if (typeof I18N !== "undefined" && I18N.PL) for (const [k, v] of Object.entries(PL)) if (!(k in I18N.PL)) fresh[k] = v;
  if (typeof I18N !== "undefined" && I18N.add) I18N.add(TPL, fresh);
  else if (typeof I18N !== "undefined" && I18N.PL) Object.assign(I18N.PL, fresh);
  return { PL, TPL };
})();
