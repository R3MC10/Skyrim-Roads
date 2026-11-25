/* i18n_layout3.js: Polish for the layout-3 patch note (titles clear of the history button, hotbar order, tab fades, Journal tab).
   Loaded before i18n.js: exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "Titles you can read, hotbar in order": "Czytelne tytuły, pasek akcji po kolei",
  "On phones the round message history button no longer sits on a screen's title (Area, Journal, Social, AI & Loadouts, a dungeon's name): the title makes room for it.":
    "Na telefonach okrągły przycisk historii wiadomości nie siedzi już na tytule ekranu (Okolica, Dziennik, Społeczność, SI i zestawy, nazwa lochu): tytuł robi mu miejsce.",
  "The fight hotbar on phones shows its slots in key order again: 1 to 5 on top, 6 to 0 below. Catch your breath no longer jumps out of line.":
    "Pasek akcji w walce na telefonach znowu pokazuje pola po kolei: od 1 do 5 u góry, od 6 do 0 niżej. Złap oddech nie wyskakuje już z szeregu.",
  "Tab strips that don't fit the screen (like Character's Skills, Character, Follower, AI & Loadouts...) fade out at the edge that has more tabs, and the chosen tab is always fully in view.":
    "Paski zakładek, które nie mieszczą się na ekranie (np. w Postaci: Umiejętności, Postać, Towarzysz, SI i zestawy...), wygaszają się przy krawędzi, za którą są kolejne zakładki, a wybrana zakładka zawsze jest cała widoczna.",
  "The Journal's chosen tab (Active, Misc, Completed) is now dark ink with a gold underline, easy to read on the parchment.":
    "Wybrana zakładka Dziennika (Aktywne, Różne, Ukończone) jest teraz ciemnym atramentem ze złotym podkreśleniem, łatwa do odczytania na pergaminie.",
});
