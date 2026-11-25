/* i18n_movepreview.js: Polish for movepreview.js (what a move will do before you make it) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, patterns in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Guard": "Garda",
    "blows hit softer until your next turn": "ciosy trafiają słabiej do twojej następnej tury",
    "No guard left: you used all your moves": "Brak gardy: wykorzystałeś wszystkie ruchy",
    " (one blow can't take more than 40% of a strong foe)": " (jeden cios nie zabierze silnemu wrogowi więcej niż 40%)",
    // patch note (build 266)
    "See a move before you make it": "Zobacz ruch, zanim go wykonasz",
    "In a fight, rest the mouse on a move (or hold your finger on it on a phone): the foe's health bar shows a striped piece for what it could lose, from the lowest to the highest hit.":
      "W walce najedź myszką na ruch (albo przytrzymaj go palcem na telefonie): pasek zdrowia wroga pokazuje paskowany kawałek tego, co może stracić, od najsłabszego do najmocniejszego trafienia.",
    "Your stamina or magicka dims by what the move costs, and one of your move diamonds fades. Healing spells show the health you'd get back; End turn shows the guard you keep.":
      "Twoja wytrzymałość albo magia przygasa o koszt ruchu, a jeden z rombów ruchów blednie. Czary leczące pokazują, ile zdrowia odzyskasz; Koniec tury pokazuje gardę, którą zachowasz.",
    "The numbers match the tooltip, and a strong foe never shows more than 40% gone from one blow. A quick tap still does the move right away.":
      "Liczby zgadzają się z podpowiedzią, a silny wróg nigdy nie traci od jednego ciosu więcej niż 40%. Szybkie stuknięcie dalej od razu wykonuje ruch.",
    "Bandit archers now carry a bow instead of an axe, bandit mages a staff and a spell, and Forsworn and draugr archers have their own pictures too.":
      "Bandyci łucznicy noszą teraz łuk zamiast topora, bandyci magowie kostur i czar, a łucznicy Wyrzeczeńców i draugrów też mają własne obrazki.",
  });
})();
