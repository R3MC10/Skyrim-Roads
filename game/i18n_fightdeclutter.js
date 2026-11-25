/* i18n_fightdeclutter.js: Polish for fightdeclutter.js (the calmer fight screen): the "..." menu, the foe's folded moves and the patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "More": "Więcej",
    "Fight log": "Dziennik walki",
    "Combat wheel": "Koło walki",
    "Show only the next move": "Pokaż tylko następny ruch",
    "Show all its moves this round": "Pokaż wszystkie jego ruchy w tej rundzie",
    // patch note (build 215)
    "A calmer fight screen": "Spokojniejszy ekran walki",
    "The fight screen is tidier, mostly on phones. The top is one slim strip with the round and the turn order; the fight log and the combat wheel sit in the new … menu.":
      "Ekran walki jest czystszy, zwłaszcza na telefonie. Na górze jest jeden cienki pasek z rundą i kolejnością tur; dziennik walki i koło walki są w nowym menu ….",
    "The foe's card shows its name and kind on one line and only its next move. Tap the card to see everything it plans this round.":
      "Karta wroga pokazuje imię i rodzaj w jednej linii i tylko jego następny ruch. Stuknij kartę, żeby zobaczyć wszystko, co planuje w tej rundzie.",
    "The target is a thin ring on the ground under the foe. The dashed line to it only shows while you aim.":
      "Cel to cienki krąg na ziemi pod wrogiem. Przerywana linia do niego pojawia się tylko, gdy celujesz.",
    "Your health, magicka and stamina live only in the orb now; its striped band shows how much the foe is about to take. No more bars over your hero or numbers in the Moves row.":
      "Zdrowie, magia i wytrzymałość są teraz tylko w kuli; jej paskowany pas pokazuje, ile zaraz zabierze wróg. Koniec z paskami nad bohaterem i liczbami w rzędzie Ruchów.",
    "The Moves diamonds and \"Your turn\" share one thin line, and a move's description shows as a fixed line just above your buttons, never on top of them.":
      "Romby Ruchów i „Twoja tura” dzielą jedną cienką linię, a opis ruchu pokazuje się w stałym miejscu tuż nad przyciskami, nigdy na nich.",
    "End turn is a plain button in its own corner. Snow falls as soft round flakes.":
      "Koniec tury to zwykły przycisk we własnym rogu. Śnieg pada miękkimi, okrągłymi płatkami.",
  });
})();
