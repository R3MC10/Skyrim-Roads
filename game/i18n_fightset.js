/* i18n_fightset.js: Polish for fightset.js (Settings → Fights: quality, frame rate, camera shake, fight UI size), the
   result card after a fight (combat2.js), the tap-to-hurry layer, the build 166 patch note and Coming next.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // settings
    "Fight quality": "Jakość walki", "Low": "Niska", "Medium": "Średnia", "High": "Wysoka",
    "Frame rate": "Klatki na sekundę", "No cap": "Bez limitu",
    "Camera shake": "Wstrząsy kamery", "Fight UI size": "Rozmiar interfejsu walki",
    // the result card
    "You got away": "Udało ci się uciec", "Damage dealt": "Zadane obrażenia", "Damage taken": "Otrzymane obrażenia", "Best hit": "Najlepszy cios",
    "1 round": "1 runda",
    "Tap the fight to hurry this turn along": "Stuknij walkę, żeby przyspieszyć tę turę",
    // patch note
    "The fight fills your PC, and ends in slow motion": "Walka na cały ekran PC i finał w zwolnionym tempie",
    "On a PC or laptop the fight now fills the whole window, like the big map: the picture runs from edge to edge and the cards and the skill bar float over it.":
      "Na PC i laptopie walka wypełnia teraz całe okno, jak duża mapa: obraz biegnie od krawędzi do krawędzi, a karty i pasek umiejętności unoszą się nad nim.",
    "The blow that ends a fight plays in slow motion, then a card shows how it went: how many rounds, the damage you dealt and took, and your best hit. Continue is right on it.":
      "Cios kończący walkę leci w zwolnionym tempie, a potem karta pokazuje, jak poszło: ile rund, ile obrażeń zadałeś i otrzymałeś, i twój najlepszy cios. Przycisk Dalej jest od razu na niej.",
    "New in Settings → Fights: Fight quality (Low, Medium, High), Frame rate (30, 60 or no cap), and sliders for Camera shake and Fight UI size. Low quality and 30 frames save battery on phones.":
      "Nowe w Ustawieniach → Walki: Jakość walki (Niska, Średnia, Wysoka), Klatki na sekundę (30, 60 albo bez limitu) i suwaki Wstrząsy kamery oraz Rozmiar interfejsu walki. Niska jakość i 30 klatek oszczędzają baterię w telefonie.",
    "While a foe's turn plays, tap anywhere on the fight to hurry it along (Space on a PC). The F key doesn't flee any more, so you can't run off by accident.":
      "Kiedy leci tura wroga, stuknij gdziekolwiek w walkę, żeby ją przyspieszyć (Spacja na PC). Klawisz F już nie ucieka, więc nie zwiejesz przez przypadek.",
    "Tooltips in fights now say what a move costs in stamina or magicka instead of action points.":
      "Podpowiedzi w walce mówią teraz, ile ruch kosztuje wytrzymałości albo magii, a nie punktów akcji.",
    // Coming next
    "Mounted combat: fight from the saddle": "Walka konno: bij się z siodła",
    "Pick a side in the civil war": "Wybierz stronę w wojnie domowej",
  });
  I18N_EXTRA.pat.push(
    [/^(\d+) rounds$/, (m) => { const n = +m[1], d = n % 10, t = n % 100; return `${n} ${d >= 2 && d <= 4 && (t < 12 || t > 14) ? "rundy" : "rund"}`; }],
  );
})();
