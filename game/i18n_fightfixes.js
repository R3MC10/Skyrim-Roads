/* i18n_fightfixes.js: Polish for the "Small fixes around fights" patch note. Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Small fixes around fights": "Drobne poprawki przy walkach",
    "A new quest popping up no longer wipes the choices of a road encounter (Pay, Talk, Fight...). It waits until you've made your pick.":
      "Nowe zadanie, które wyskakuje w trakcie spotkania na drodze, nie kasuje już wyboru (Zapłać, Rozmawiaj, Walcz...). Czeka, aż coś wybierzesz.",
    "On small phones the round compass button no longer sits on your health, magicka and stamina bars.":
      "Na małych telefonach okrągły przycisk kompasu nie zasłania już pasków zdrowia, magii i wytrzymałości.",
    "Fighting a big boss, the fight log narrows a little so it doesn't cover the boss.":
      "Podczas walki z dużym bossem dziennik walki trochę się zwęża, żeby go nie zasłaniać.",
  });
})();
