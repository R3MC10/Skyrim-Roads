/* i18n_paintedmap.js: Polish for paintedmap.js (the Roads on the map setting) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Roads on the map": "Drogi na mapie",
    // patch note
    "Ready for a painted world map": "Gotowi na malowaną mapę świata",
    "The world map can now show a hand-painted picture of Skyrim instead of the drawn one. Towns, roads, fog, your cone of sight, light, weather and markers all sit on top of it, exactly where they were.":
      "Mapa świata może teraz pokazywać ręcznie malowany obraz Skyrim zamiast rysowanego. Miasta, drogi, mgła, twoje pole widzenia, światło, pogoda i znaczniki leżą na nim dokładnie tam, gdzie były.",
    "Once the painting is in, Settings → Graphics gets a Roads on the map switch, in case the painted roads are enough for you.":
      "Gdy obraz jest w grze, w Ustawienia → Grafika pojawia się przełącznik Drogi na mapie, jeśli namalowane drogi ci wystarczą.",
    "Until the painting arrives, the map looks and works just like before.":
      "Dopóki obrazu nie ma, mapa wygląda i działa tak jak wcześniej.",
  });
})();
