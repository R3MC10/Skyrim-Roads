/* i18n_menutop.js: Polish for the "Menus open at the top" patch note (menutop.js has no text of its own).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Menus open at the top":
      "Menu otwierają się od góry",
    "On a phone, every tab and sub-tab (Character, Map, Journal, Social, Area and the rest) now opens at its top, instead of half way down an old list or on the map above it.":
      "Na telefonie każda karta i podkarta (Postać, Mapa, Dziennik, Społeczność, Okolica i reszta) otwiera się teraz od góry, a nie w połowie starej listy albo na mapie nad nią.",
    "The compass's Area, Journal and Social links take you straight to that screen, and the full-screen Character page always starts at the top.":
      "Linki kompasu do Okolicy, Dziennika i Społeczności prowadzą prosto do tego ekranu, a pełnoekranowa strona Postaci zawsze zaczyna się od góry.",
    "In Items and Magic a new category starts at the top, while picking or equipping something keeps the list where you were.":
      "W Przedmiotach i Magii nowa kategoria zaczyna się od góry, a wybranie albo założenie czegoś zostawia listę tam, gdzie byłeś.",
    "Windows like the patch notes and the guide open at their top.":
      "Okna, takie jak lista zmian i poradnik, otwierają się od góry.",
  });
})();
