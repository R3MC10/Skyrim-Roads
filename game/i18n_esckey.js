/* i18n_esckey.js: Polish for the Esc menu (pausemenu.js), the folding world event card (gevstack.js) and their patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words ({n} is filled in after). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // the Esc menu
    "Paused": "Pauza",
    "Resume": "Wróć do gry",
    "Settings": "Ustawienia",
    "Journal": "Dziennik",
    "Patch notes": "Zmiany w grze",
    "How to play": "Jak grać",
    "Report a problem": "Zgłoś problem",
    "Save and quit to title": "Zapisz i wyjdź do menu",
    "Quit game": "Wyjdź z gry",
    "The world keeps going while this is open: nobody else is paused.": "Świat toczy się dalej, gdy to menu jest otwarte: nikt inny nie ma pauzy.",
    "The fight waits for you: nothing here makes you flee. Finish it before you quit.": "Walka na ciebie czeka: nic tutaj nie sprawi, że uciekniesz. Skończ ją, zanim wyjdziesz.",
    "Esc: back to the game": "Esc: powrót do gry",
    // the world event card
    "{n} notice": "{n} wiadomość",
    "{n} notices": "Wiadomości: {n}",
    "Show world events": "Pokaż wydarzenia świata",
    "Hide world events": "Schowaj wydarzenia świata",
    "Hide this notice": "Schowaj tę wiadomość",
    // patch note
    "Esc menu and a card you can fold away": "Menu pod Esc i karta, którą można schować",
    "On PC, Esc now steps back one thing at a time, just like the back button on a phone: a tooltip, then a window, then the menu you're in, then the compass.":
      "Na PC Esc cofa teraz o jeden krok, tak jak przycisk wstecz w telefonie: najpierw podpowiedź, potem okno, potem menu, w którym jesteś, a potem kompas.",
    "When there's nothing left to close, Esc opens a pause menu like in Skyrim: Resume, Settings, Journal, Patch notes, How to play, Report a problem and Save and quit. The Windows app also has Quit game. Use the arrows and Enter, or the mouse.":
      "Gdy nie ma już czego zamknąć, Esc otwiera menu pauzy jak w Skyrimie: Wróć do gry, Ustawienia, Dziennik, Zmiany w grze, Jak grać, Zgłoś problem oraz Zapisz i wyjdź. W aplikacji na Windows jest też Wyjdź z gry. Używaj strzałek i Entera albo myszki.",
    "In a fight Esc opens the pause menu on top of the fight and never makes you run away. The world doesn't stop for anyone else in your party.":
      "W walce Esc otwiera menu pauzy nad walką i nigdy nie sprawia, że uciekasz. Świat nie staje dla nikogo innego w drużynie.",
    "The great world event card on the map can be folded into a small pill with the arrow in its corner (tap the pill to open it again). The game remembers it for your hero.":
      "Kartę wielkiego wydarzenia świata na mapie można zwinąć strzałką w rogu do małej plakietki (dotknij jej, żeby znów ją otworzyć). Gra pamięta to dla twojej postaci.",
    "Notices under it (a town rebuilding, a reward waiting) have an × to hide them until there's new news. A new event never pops the card open: the pill glows for a moment instead.":
      "Wiadomości pod nią (miasto się odbudowuje, nagroda czeka) mają ×, które chowa je do czasu nowych wieści. Nowe wydarzenie nigdy samo nie otwiera karty: zamiast tego plakietka na chwilę się rozświetla.",
    "Fixed: on phones a few newer screens (the house chest, blood in fights, party traps, fishing and hunting and more) had lost part of their look. They're back to normal.":
      "Poprawka: na telefonach kilka nowszych ekranów (skrzynia w domu, krew w walkach, pułapki w drużynie, łowienie i polowanie i inne) straciło część wyglądu. Już wszystko wróciło do normy.",
  });
})();
