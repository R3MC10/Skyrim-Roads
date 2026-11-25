/* i18n_fighttipstop.js: Polish for the "fight tooltips show in full" patch note (tooltip.js). Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Fight tooltips show in full": "Podpowiedzi w walce widać w całości",
    "In a fight, the cards in the Magic and Items lists now show their whole tooltip right next to the card: above it, below it or beside it, wherever it fits.":
      "W walce karty na listach Magii i Przedmiotów pokazują teraz całą podpowiedź tuż przy karcie: nad nią, pod nią albo obok, tam gdzie się zmieści.",
    "Tooltips in fights are never cut off, never hidden under the list or the top bar, and never cover the card you're pointing at. A very long one scrolls inside instead.":
      "Podpowiedzi w walce nie są już ucięte, nie chowają się pod listą ani pod górnym paskiem i nie zasłaniają karty, którą wskazujesz. Bardzo długa przewija się w środku.",
    "Tooltips now always sit on top of everything else on the screen, minigames and damage numbers included.":
      "Podpowiedzi zawsze są teraz na wierzchu wszystkiego na ekranie, także minigier i liczb obrażeń.",
  });
})();
