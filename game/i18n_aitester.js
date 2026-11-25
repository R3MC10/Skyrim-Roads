/* Polish for the "What would the AI do?" tester on the AI & Loadouts screen (aitester.js), the folded rules row under
   Smart AI and the short [AI] reasons in the fight log. Loaded before i18n.js, which merges I18N_EXTRA. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const tr = (x) => (typeof I18N !== "undefined" && I18N.tr ? I18N.tr(x) : null) ?? x;
  const WHAT = { health: "zdrowie", magicka: "magia", stamina: "wytrzymałość", "foe's health": "zdrowie wroga" };
  Object.assign(I18N_EXTRA.words, {
    "What would the AI do?": "Co zrobi SI?",
    "Set up a moment of a fight and see the move your loadout plays right now, and why. Just a test: nothing is used up.":
      "Ustaw chwilę walki i zobacz, jaki ruch zagra teraz twój zestaw i dlaczego. To tylko próba: nic się nie zużywa.",
    "Set up a moment of a fight and see the move your loadout plays right now, and why.": "Ustaw chwilę walki i zobacz, jaki ruch zagra teraz twój zestaw i dlaczego.",
    "Just a test: nothing is used up.": "To tylko próba: nic się nie zużywa.",
    "Your health": "Twoje zdrowie", "Your stamina": "Twoja wytrzymałość", "Your magicka": "Twoja magia", "Foe's health": "Zdrowie wroga",
    "Foe": "Wróg", "Foes": "Wrogów", "Friend down": "Kompan powalony", "Normal": "Zwykły", "Strong": "Silny", "Boss": "Boss", "Dragon": "Smok", "Caster": "Mag",
    "No": "Nie", "Yes": "Tak", "3+": "3+",
    "Smart AI": "Sprytna SI", "No rule fired": "Żadna reguła nie zadziałała", "no rule fired, so you attack": "żadna reguła nie zadziałała, więc atakujesz",
    "No rules: you just attack.": "Brak reguł: po prostu atakujesz.",
    "Couldn't work it out for this moment.": "Nie udało się tego policzyć dla tej chwili.",
    "Your rules, top to bottom:": "Twoje reguły, od góry do dołu:", "Your rules, top to bottom (then Smart AI):": "Twoje reguły, od góry do dołu (potem Sprytna SI):",
    "not checked: an earlier rule fired": "niesprawdzona: wcześniejsza reguła zadziałała", "switched off": "wyłączona",
    "in Hybrid, the “Always → Attack” filler lets Smart AI pick instead": "w Hybrydzie zapychacz „Zawsze → Atak” oddaje wybór Sprytnej SI",
    "always true": "zawsze prawda", "never true": "nigdy",
    "can't block with a bow": "nie da się blokować łukiem", "can't run from this fight": "z tej walki nie da się uciec", "you don't know that spell": "nie znasz tego zaklęcia",
    "no potions in Beast Form": "w Postaci Bestii nie ma mikstur", "no scroll of that kind left": "nie ma już takiego zwoju",
    "not ready (used today or still cooling down)": "jeszcze niegotowe (użyte dziś albo się odnawia)", "can't do it right now": "teraz się nie da",
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
    [/^Your rules \((\d+)\) · kept, used in Custom and Hybrid$/, (m) => `Twoje reguły (${m[1]}) · zachowane, działają w trybie Własnym i Hybrydzie`],
    [/^Against a (.+), it would:$/, (m) => `Przeciw: ${tr(m[1])}. SI zrobi:`],
    [/^(Rule (\d+) fired|No rule fired|Smart AI): (.+)$/, (m) => `${m[2] ? `Reguła ${m[2]} zadziałała` : tr(m[1])}: ${tr(m[3])}`],
    [/^your rule (\d+) fired$/, (m) => `zadziałała twoja reguła ${m[1]}`],
    [/^your rule (\d+)$/, (m) => `twoja reguła ${m[1]}`],
    [/^Next best: (.+)$/, (m) => `Następne w kolejce: ${tr(m[1])}`],
    [/^(health|magicka|stamina|foe's health) is (\d+)%, rule needs (not )?(below|above) (\d+)%$/, (m) => `${WHAT[m[1]]}: ${m[2]}%, reguła wymaga ${m[3] ? "nie " : ""}${m[4] === "below" ? "poniżej" : "powyżej"} ${m[5]}%`],
    [/^it's turn (\d+), rule needs (not )?turn (\d+) or (later|earlier)$/, (m) => `tura ${m[1]}, reguła wymaga ${m[2] ? "nie " : ""}tury ${m[3]} lub ${m[4] === "later" ? "późniejszej" : "wcześniejszej"}`],
    [/^it's turn (\d+), rule needs (not )?the first turn$/, (m) => `tura ${m[1]}, reguła wymaga ${m[2] ? "nie " : ""}pierwszej tury`],
    [/^your health (\d+)% vs the foe's (\d+)%$/, (m) => `twoje zdrowie ${m[1]}% wobec ${m[2]}% wroga`],
    [/^(.+): (yes|no)( \(rule needs no\))?$/, (m) => `${tr(m[1])}: ${m[2] === "yes" ? "tak" : "nie"}${m[3] ? " (reguła wymaga: nie)" : ""}`],
    [/^not enough stamina (to block )?\(needs (\d+), has (\d+)\)$/, (m) => `za mało wytrzymałości${m[1] ? " na blok" : ""} (trzeba ${m[2]}, jest ${m[3]})`],
    [/^not enough magicka \(needs (\d+), has (\d+)\)$/, (m) => `za mało magii (trzeba ${m[1]}, jest ${m[2]})`],
    [/^no (health|magicka|stamina) potion in your pack$/, (m) => `brak mikstury ${{ health: "zdrowia", magicka: "magii", stamina: "wytrzymałości" }[m[1]]} w plecaku`],
    [/^(.+) \[AI\] (.+)$/, (m) => `${tr(m[1])} [AI] ${tr(m[2])}`],
  );
})();
