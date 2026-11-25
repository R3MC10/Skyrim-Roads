/* i18n_locintro.js: Polish for locintro.js (every arrival shows the place full screen for a moment, the Area tab's
   View location button, Settings → Location introductions) and its patch note.
   Loaded before i18n.js: exact lines go in I18N_EXTRA.words, built ones in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const TOD = { Dawn: "Świt", Day: "Dzień", Evening: "Wieczór", Night: "Noc" };
  Object.assign(I18N_EXTRA.words, {
    // the picture
    "Tap to skip": "Dotknij, by pominąć", "Tap anywhere to close": "Dotknij gdziekolwiek, by zamknąć", "View location": "Pokaż miejsce",
    Dawn: "Świt", Day: "Dzień", Evening: "Wieczór", Night: "Noc", Winter: "Zima", Spring: "Wiosna", Summer: "Lato", Autumn: "Jesień",
    // what's new
    "A new job on the notice board.": "Nowe zlecenie na tablicy ogłoszeń.", "New jobs on the notice board.": "Nowe zlecenia na tablicy ogłoszeń.",
    "Fresh spell tomes on the shelves.": "Świeże księgi zaklęć na półkach.", "A caravan is in town.": "W mieście jest karawana.",
    // settings
    "Location introductions": "Przedstawienie miejsca", "First visit only": "Tylko za pierwszym razem",
    // the patch note
    "Every arrival shows the place": "Każde przybycie pokazuje miejsce",
    "Every time you arrive somewhere (a town, a hold's capital, a dungeon, a camp, a shrine...), the place fills the screen for a moment: its painting, its name, the time, the weather and the season. Night and bad weather tint the picture.":
      "Za każdym razem, gdy gdzieś docierasz (miasteczko, stolica włości, loch, obóz, kapliczka...), miejsce na chwilę wypełnia ekran: jego obraz, nazwa, pora, pogoda i pora roku. Noc i niepogoda zabarwiają obraz.",
    "The first time you see a place you get the full view for a few seconds. Coming back, a shorter one. Tap anywhere or press Esc to skip; it fades out by itself and never holds up the game.":
      "Gdy widzisz miejsce pierwszy raz, dostajesz pełny widok na kilka sekund. Gdy wracasz, krótszy. Dotknij gdziekolwiek albo naciśnij Esc, by pominąć; znika sam i nigdy nie wstrzymuje gry.",
    "Up to two lines say what's new since your last visit: friends or party members here, new jobs on the notice board, fresh spell tomes or a caravan in town.":
      "Do dwóch linijek mówi, co nowego od ostatniej wizyty: znajomi albo członkowie drużyny na miejscu, nowe zlecenia na tablicy, świeże księgi zaklęć albo karawana w mieście.",
    "In a party, everyone sees it on their own when they arrive. If you're already there when friends walk in, you don't see it again.":
      "W drużynie każdy widzi to sam, gdy dociera na miejsce. Jeśli już tam jesteś, gdy przychodzą znajomi, nie zobaczysz tego ponownie.",
    "In the Area tab, the little landscape button next to the place's name shows the picture again, until you tap it away.":
      "W zakładce Okolica mały przycisk z krajobrazem obok nazwy miejsca pokazuje obraz ponownie, dopóki go nie odsuniesz dotknięciem.",
    "Settings → Look → Location introductions: Always, First visit only or Off.":
      "Ustawienia → Wygląd → Przedstawienie miejsca: Zawsze, Tylko za pierwszym razem albo Wył.",
    "It waits its turn: never on top of a window, a tip or a fight. It replaces the old quick \"You arrive at\" name over the map.":
      "Czeka na swoją kolej: nigdy nie wchodzi na okno, wskazówkę ani walkę. Zastępuje dawny szybki napis „Docierasz do” nad mapą.",
  });
  I18N_EXTRA.pat.push(
    [/^(Dawn|Day|Evening|Night) · (\d\d:\d\d)$/, (m) => `${TOD[m[1]]} · ${m[2]}`],
    [/^(.+?) (is|are) here, from your party\.$/, (m) => `${m[1].replace(/ and (\d+) more$/, " i jeszcze $1").replace(/ and /, " i ")} ${m[2] === "is" ? "jest" : "są"} tutaj, z twojej drużyny.`],
    [/^(.+?) (is|are) here\.$/, (m) => `${m[1].replace(/ and (\d+) more$/, " i jeszcze $1").replace(/ and /, " i ")} ${m[2] === "is" ? "jest" : "są"} tutaj.`],
  );
})();
