/* i18n_herocard.js: Polish for the hero card patch note (heroart.js [herocard], patchnotes.js). Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Your hero card looks like you": "Karta bohatera wygląda jak ty",
    "The figure in the Items menu (and on the Hero page, title cards and other players' cards) is now the same painted hero you see in fights: your sex, race, hair and the armour and weapon you wear. It changes as soon as you change gear or look.":
      "Postać w menu Przedmioty (oraz na stronie Bohatera, kartach na ekranie tytułowym i kartach innych graczy) to teraz ten sam malowany bohater co w walkach: twoja płeć, rasa, włosy oraz zbroja i broń, które nosisz. Zmienia się od razu, gdy zmienisz ekwipunek albo wygląd.",
    "A woman no longer shows up as a bearded man there, and a raised weapon stays inside the card.":
      "Kobieta nie pojawia się tam już jako brodaty mężczyzna, a uniesiona broń mieści się w karcie.",
    "The small round race portrait next to it only shows when it matches your hero's sex.":
      "Mały okrągły portret rasy obok pokazuje się tylko wtedy, gdy pasuje do płci twojego bohatera.",
  });
})();
