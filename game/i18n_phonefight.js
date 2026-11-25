/* i18n_phonefight.js: Polish for phonefight.js (the fight screen on a phone) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Fold the fight log": "Zwiń dziennik walki",
    "Show more of the fight log": "Pokaż więcej dziennika walki",
    // patch note
    "Fights fit your phone": "Walki mieszczą się na telefonie",
    "On a phone the fight log now shows only its newest line. Tap the small arrow next to it to see the last few lines, and again to fold it. The game remembers your choice.":
      "Na telefonie dziennik walki pokazuje teraz tylko najnowszą linię. Stuknij małą strzałkę obok, żeby zobaczyć kilka ostatnich linii, i jeszcze raz, żeby go zwinąć. Gra zapamięta twój wybór.",
    "The foe's health shows as numbers under its bar on a phone, so you can see how close it is to falling without tapping it.":
      "Na telefonie zdrowie wroga widać jako liczby pod jego paskiem, więc wiesz, ile mu zostało, bez stukania w niego.",
    "Every status icon in a fight shows its number: how many stacks of burning, poison, bleeding, vulnerable, winded and the rest, or how many turns a spell has left. On the foe, on you and on your party. Hold or hover an icon for the full text.":
      "Każda ikonka stanu w walce pokazuje swoją liczbę: ile ładunków podpalenia, trucizny, krwawienia, podatności, zadyszki i reszty, albo ile tur zostało zaklęciu. Na wrogu, na tobie i na twojej drużynie. Przytrzymaj albo najedź na ikonkę, żeby przeczytać całość.",
  });
})();
