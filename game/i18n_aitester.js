/* Polish for the short [AI] reasons in the fight log (combatai.js shortWhy, tbfight.js). The "What would the AI do?" tester
   and the AI & Loadouts tab are gone; only the old patch note's lines stay. Loaded before i18n.js, which merges I18N_EXTRA. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const tr = (x) => (typeof I18N !== "undefined" && I18N.tr ? I18N.tr(x) : null) ?? x;
  Object.assign(I18N_EXTRA.words, {
    "What would the AI do?": "Co zrobi SI?",
    // short reasons (combatai.js shortWhy, tbfight.js)
    "steady damage": "stałe obrażenia", "enough stamina for a heavy blow": "dość wytrzymałości na mocny cios", "out of stamina": "brak wytrzymałości",
    "gets out while it can": "ucieka, póki może", "the best move it sees": "najlepszy ruch, jaki widzi", "a double-strength cast pays off": "podwójne zaklęcie się opłaca",
    "a free spell from a scroll": "darmowe zaklęcie ze zwoju", "a good moment for it": "dobry moment na to", "plays the opening": "wykorzystuje lukę",
    "your readied favourite": "twój przygotowany ulubiony ruch",
    // patch note
    "Character → AI & Loadouts has a new card, What would the AI do?: set your health, stamina and magicka, the foe's health, what kind of foe (normal, strong, boss, dragon, caster), how many and whether a friend is down, and it shows the move your loadout would play right now and why.":
      "Postać → SI i zestawy ma nową kartę Co zrobi SI?: ustaw swoje zdrowie, wytrzymałość i magię, zdrowie wroga, rodzaj wroga (zwykły, silny, boss, smok, mag), ilu ich jest i czy kompan leży, a pokaże ruch, jaki twój zestaw zagrałby teraz, i dlaczego.",
    "In Custom and Hybrid it goes through your rules from the top: a tick for the one that fires, a cross and the reason for the ones it skips (like \"health is 80%, rule needs below 40%\").":
      "W trybie Własnym i Hybrydzie przechodzi przez twoje reguły od góry: ptaszek przy tej, która zadziała, krzyżyk i powód przy pominiętych (np. „zdrowie jest 80%, reguła wymaga poniżej 40%”).",
    "With Smart AI on, your own rules fold into one row (they're kept for Custom and Hybrid) instead of sitting there greyed out.":
      "Przy włączonej Sprytnej SI twoje reguły zwijają się do jednego wiersza (zostają na tryb Własny i Hybrydę), zamiast wisieć wyszarzone.",
    "In fights, moves the AI plays for you end with a short [AI] reason in the log. Moves you pick yourself don't.":
      "W walce ruchy, które SI gra za ciebie, mają w dzienniku krótki powód [AI]. Ruchy wybrane przez ciebie go nie mają.",
  });
  I18N_EXTRA.pat.push(
    [/^your rule (\d+)$/, (m) => `twoja reguła ${m[1]}`],
    [/^(.+) \[AI\] (.+)$/, (m) => `${tr(m[1])} [AI] ${tr(m[2])}`],
  );
})();
