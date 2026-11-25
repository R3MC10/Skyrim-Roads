/* i18n_stations.js: Polish for the place pages that open on the work (ui.js "Town news" row), the plain words on the
   Hold status card (crises.js word()) and patch note b268. Loaded before i18n.js; adds to I18N_STORY.ex (never replaces
   a line that's already translated), so the screen translator finds it. */
(() => {
  /* Hold status words (Security / Food / Prosperity / Corruption): translated at the source by crises.js T(), not by
     the screen swap (short words like "low" or "high" show up elsewhere) */
  if (typeof I18N_CRISES !== "undefined") Object.assign(I18N_CRISES.tpl, {
    "safe": "bezpiecznie", "steady": "stabilnie", "shaky": "niepewnie", "lawless": "bezprawie",
    "plenty": "pod dostatkiem", "enough": "wystarczy", "short": "brakuje", "starving": "głód",
    "booming": "rozkwit", "slow": "zastój", "broke": "bieda",
    "low": "niska", "some": "trochę", "high": "wysoka", "rampant": "szaleje",
  });
  const PL = {
    "Town news": "Wieści z miasta",
    // patch note b268
    "Places open on the work": "Miejsca otwierają się na robocie",
    "Opening the Forge, a shop, the inn or any other place in town now shows its tabs and list right away: the town news folds into one \"Town news\" row you can open, and the how-it-works note sits under the list.":
      "Otwarcie kuźni, sklepu, karczmy czy innego miejsca w mieście od razu pokazuje jego zakładki i listę: wieści z miasta chowają się w jednym wierszu „Wieści z miasta”, który można rozwinąć, a opis działania jest pod listą.",
    "The \"New to the game?\" card only shows on the map and the town's board, not inside a place.":
      "Karta „Nowy w grze?” pokazuje się tylko na mapie i na tablicy miasta, nie w środku miejsca.",
    "Each place's painting is a little shorter on phones and the person who runs it takes one compact line.":
      "Obraz każdego miejsca jest na telefonie trochę niższy, a osoba, która je prowadzi, zajmuje jeden zwięzły wiersz.",
    "Hold status says in a word how each number is doing (Food 43 short, Security 66 safe), coloured green, gold or red.":
      "Stan krainy mówi jednym słowem, jak ma się każda liczba (Żywność 43 brakuje, Bezpieczeństwo 66 bezpiecznie), na zielono, złoto lub czerwono.",
    "In the Company tab, the banner shrinks to a name strip when your painted longhouse is shown right below it.":
      "W zakładce Kompania baner zwija się do paska z nazwą, gdy tuż pod nim widać malowany długi dom.",
  };
  if (typeof I18N_STORY !== "undefined") for (const [k, v] of Object.entries(PL)) if (I18N_STORY.ex[k] == null) I18N_STORY.ex[k] = v;
})();
