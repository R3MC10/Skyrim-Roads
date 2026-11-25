/* i18n_dunloop.js: Polish for the "Dungeons no longer send you round in circles" patch note. Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Dungeons no longer send you round in circles": "Lochy już nie każą ci chodzić w kółko",
    "Dungeons no longer send you round in circles: every room you finish moves you on to the next one, all the way to the boss and out.": "Lochy już nie każą ci chodzić w kółko: każda skończona komnata prowadzi dalej, aż do bossa i z powrotem na zewnątrz.",
    "On a deep expedition in a party, the others now follow the leader down the stairs and through every new level, instead of waiting at the camp for good.": "Na głębokiej wyprawie w drużynie reszta schodzi teraz za liderem po schodach i przez każdy nowy poziom, zamiast czekać w obozie bez końca.",
    "In a party, the leader's choices reach everyone in the order they were made, so nobody gets left behind in a cleared room or at the camp when the connection is slow.": "W drużynie wybory lidera docierają do wszystkich w tej kolejności, w jakiej zostały podjęte, więc przy wolnym połączeniu nikt nie zostaje w oczyszczonej komnacie ani w obozie.",
    "If your game was saved at a camp or right after a boss and the room got lost, loading it puts you back at the camp (or lets you leave), instead of making you fight the same boss again.": "Jeśli gra zapisała się w obozie albo tuż po bossie i komnata się zgubiła, po wczytaniu wracasz do obozu (albo możesz wyjść), zamiast walczyć z tym samym bossem jeszcze raz.",
  });
})();
