/* i18n_names.js: Polish for the names-table patch note (names.js itself reads its Polish from the i18n tables).
   Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "One list of names": "Jedna lista nazw",
    "Behind the scenes: the names of towns, holds, items and foes now come from one list. Nothing looks different today.": "Za kulisami: nazwy miast, krain, przedmiotów i wrogów pochodzą teraz z jednej listy. Dziś nic nie wygląda inaczej.",
    "This lets us give places and things their own names later in one go, without breaking your saves, quests or bags.": "Dzięki temu możemy później nadać miejscom i rzeczom własne nazwy za jednym razem, bez psucia twoich zapisów, zadań i plecaka.",
  });
})();
