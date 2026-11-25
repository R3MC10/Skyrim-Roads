/* i18n_fighthotfix.js: Polish for the fight hotfix (tbfight.js: a stuck minigame can't lock the buttons) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Fight fix": "Poprawka walki",
    "Fixed: in some fights your attacks did nothing. If the little timing game after a move gets stuck or vanishes, your next press goes through as a normal hit.":
      "Naprawiono: w niektórych walkach twoje ataki nic nie robiły. Jeśli mała gra w wyczucie czasu po ruchu się zatnie albo zniknie, następne kliknięcie wchodzi jako zwykły cios.",
    "That move didn't work, try another": "Ten ruch nie zadziałał, spróbuj innego",
  });
})();
