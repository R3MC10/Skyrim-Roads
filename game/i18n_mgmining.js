/* i18n_mgmining.js: Polish for the painted mining mini-game (minegame.js: rock face, pickaxe swing, haul card) and its
   patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Mining": "Kopanie",
    "Tap a stone when the needle is in the bright band. Glinting stones hold ore.":
      "Stuknij w kamień, gdy wskazówka jest w jasnym pasku. Błyszczące kamienie kryją rudę.",
    "Quick dig": "Szybkie kopanie",
    "Done": "Gotowe",
    "Always play the mining game": "Zawsze graj w minigrę kopania",
    "Nothing yet": "Na razie nic",
    "Perfect!": "Idealnie!",
    "Good": "Dobrze",
    "Glancing": "Po łebkach",
    "A good haul": "Niezły urobek",
    "A rich haul": "Bogaty urobek",
    "Nothing but rubble": "Same okruchy",
    "The rock gave up nothing this time.": "Tym razem skała nic nie oddała.",
    "Take it": "Zabierz",
    "Leave": "Zostaw",
    // patch note
    "Mining looks and feels new": "Kopanie wygląda i działa na nowo",
    "The mining game now happens in a painted cave. The rock face is real stone cut from the painting, and you can see chunks of ore poking out of the veins.":
      "Minigra kopania dzieje się teraz w malowanej jaskini. Ściana to prawdziwy kamień wycięty z obrazu, a z żył wystają bryłki rudy.",
    "Tap a stone and your pickaxe swings in and lands on it: the rock cracks, chips and dust fly, ore glints and sparks, and the pieces you break out jump into your haul.":
      "Stuknij w kamień, a kilof zamachnie się i w niego trafi: skała pęka, lecą odłamki i pył, ruda błyszczy i sypie iskrami, a wybite kawałki wskakują do twojego urobku.",
    "A Perfect blow shakes the screen a little. When you're done, a haul card shows everything you dug, with how many Perfect blows you landed.":
      "Idealny cios lekko trzęsie ekranem. Na koniec karta urobku pokazuje wszystko, co wykopałeś, i ile było idealnych ciosów.",
    "Works on small phones and big PC screens, in both the ink and pixel styles. Quick dig still skips straight to the result.":
      "Działa na małych telefonach i dużych ekranach PC, w stylu tuszu i pikseli. Szybkie kopanie dalej od razu daje wynik.",
  });
  const pl = (n, one, few, many) => { n = +n; const t = n % 10, h = n % 100; return n === 1 ? one : t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many; };
  I18N_EXTRA.pat.push(
    [/^Smithing (\d+) ·$/, (m) => `Kowalstwo ${m[1]} ·`],
    [/^(\d+) swings? left$/, (m) => `${pl(m[1], "został", "zostały", "zostało")} ${m[1]} ${pl(m[1], "zamach", "zamachy", "zamachów")}`],
    [/^Rock (\d+)$/, (m) => `Skała ${m[1]}`],
    [/^(\d+) pieces?$/, (m) => `${m[1]} ${pl(m[1], "kawałek", "kawałki", "kawałków")}`],
    [/^(\d+) Perfect blows?$/, (m) => `${m[1]} ${pl(m[1], "idealny cios", "idealne ciosy", "idealnych ciosów")}`],
    [/^(\d+) swings?$/, (m) => `${m[1]} ${pl(m[1], "zamach", "zamachy", "zamachów")}`],
  );
})();
