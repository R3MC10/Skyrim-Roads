/* i18n_fightfixes.js: Polish for the "Small fixes on the road and in hero creation" patch note. Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Small fixes on the road and in hero creation": "Drobne poprawki w drodze i przy tworzeniu postaci",
    "A new quest popping up no longer wipes the choices of a road encounter (Pay, Talk, Fight...). It waits until you've made your pick.":
      "Nowe zadanie, które wyskakuje w trakcie spotkania na drodze, nie kasuje już wyboru (Zapłać, Rozmawiaj, Walcz...). Czeka, aż coś wybierzesz.",
    "On small phones the round compass button no longer sits on your health, magicka and stamina bars.":
      "Na małych telefonach okrągły przycisk kompasu nie zasłania już pasków zdrowia, magii i wytrzymałości.",
    "The male and female symbols on the new hero screen show as plain symbols on every phone, not as colourful emoji.":
      "Symbole kobiety i mężczyzny na ekranie tworzenia postaci wyglądają na każdym telefonie jak zwykłe znaki, a nie kolorowe emoji.",
  });
})();
