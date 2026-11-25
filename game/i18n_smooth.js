/* i18n_smooth.js: Polish for the smoother map, travel and fights patch note (performance work). Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Smoother map, travel and fights": "Płynniejsza mapa, podróże i walki",
    "The map is much lighter to draw: the painted ground and the fog are kept ready while you look around, so the map no longer stutters and your phone stays cooler.":
      "Mapa rysuje się dużo lżej: malowany teren i mgła są trzymane w gotowości, gdy się rozglądasz, więc mapa już nie przycina, a telefon mniej się grzeje.",
    "The first-person travel view rests between its pictures instead of waking up all the time.":
      "Widok podróży z oczu bohatera odpoczywa między klatkami, zamiast budzić się bez przerwy.",
    "Fight scenes that are scrolled away stop redrawing, and quick turns no longer pile up extra work, so fights stay smooth.":
      "Sceny walki przewinięte poza ekran przestają się odrysowywać, a szybkie tury nie piętrzą już dodatkowej pracy, więc walki są płynne.",
    "Fewer little hitches every second on every screen, and saving your game is quicker.":
      "Mniej drobnych przycięć co sekundę na każdym ekranie, a zapis gry jest szybszy.",
  });
})();
