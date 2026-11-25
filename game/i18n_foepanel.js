/* i18n_foepanel.js: Polish for foepanel.js (the slim foe plate, the scrollable fight log) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "newest": "najnowsze",
    "The foe. Tap for its numbers and moves.": "Wróg. Stuknij, żeby zobaczyć liczby i jego ruchy.",
    "Fight log: scroll for the whole fight, tap to open it big": "Dziennik walki: przewiń, żeby zobaczyć całą walkę, stuknij, żeby go powiększyć",
    // patch note
    "A cleaner look at your foe": "Lepszy widok na wroga",
    "The foe's name and health float above its head as a thin Skyrim-style bar with no dark box, and never cover the foe or anyone else. Its statuses are small icons in one row under the bar.":
      "Imię i zdrowie wroga unoszą się nad jego głową jako cienki pasek w stylu Skyrima, bez ciemnej ramki, i nigdy nie zasłaniają wroga ani nikogo innego. Jego stany to małe ikonki w jednym rzędzie pod paskiem.",
    "The exact numbers and the rest of its moves show when you hover over it on a PC or tap it on the phone. A boss keeps its big bar at the top, with its icons and next move just under it.":
      "Dokładne liczby i resztę jego ruchów zobaczysz po najechaniu myszką na PC albo stuknięciu na telefonie. Boss ma swój duży pasek na górze, a jego ikonki i następny ruch tuż pod nim.",
    "A boss's big attack warning is one slim line now. Hover or hold it to read how to answer it.":
      "Ostrzeżenie przed wielkim atakiem bossa to teraz jedna cienka linia. Najedź albo przytrzymaj, żeby przeczytać, jak odpowiedzieć.",
    "The fight log holds the whole fight: scroll it with your finger or the mouse wheel. It stays on the newest line unless you scrolled up, and a small \"newest\" button takes you back down.":
      "Dziennik walki trzyma całą walkę: przewijaj go palcem albo kółkiem myszy. Zostaje na najnowszej linii, chyba że przewiniesz w górę, a mały przycisk „najnowsze” zabierze cię z powrotem na dół.",
    "The log finds a corner where nobody is standing, and its help bubble no longer covers the lines.":
      "Dziennik sam znajduje róg, w którym nikt nie stoi, a jego dymek z pomocą nie zasłania już linii.",
  });
})();
