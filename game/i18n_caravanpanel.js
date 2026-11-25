/* i18n_caravanpanel.js: Polish for the caravan-panel patch note (a caravan's card is now a docked panel / bottom sheet).
   Loaded before i18n.js: exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "Caravans open in a panel":
    "Karawany otwierają się w panelu",
  "Tapping a caravan on the map now opens a proper panel instead of a small floating card. On a PC it sits on the right side of the screen, full height, and the map stays visible beside it; on a phone it slides up from the bottom and sits above the menu bar.":
    "Stuknięcie karawany na mapie otwiera teraz porządny panel zamiast małej pływającej karty. Na PC stoi po prawej stronie ekranu, na całą wysokość, a mapa dalej jest widoczna obok; na telefonie wysuwa się od dołu i stoi nad paskiem menu.",
  "Every button (Catch up, Trade, Escort, Ask for news, Help, Rob) is always reachable now: nothing hides under the bottom bar any more, and a long list of their wares scrolls inside the panel.":
    "Każdy przycisk (Dogoń ich, Handel, Eskorta, Zapytaj o wieści, Pomoc, Rabunek) jest teraz zawsze w zasięgu: nic już nie chowa się pod dolnym paskiem, a długa lista ich towarów przewija się w panelu.",
  "Close it with the X, Esc, or your phone's back button.":
    "Zamkniesz go krzyżykiem, klawiszem Esc albo przyciskiem wstecz w telefonie.",
});
