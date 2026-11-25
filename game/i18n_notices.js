/* i18n_notices.js: Polish for the "pop-ups take turns" patch note (notices.js). Loaded before i18n.js; exact lines go in
   I18N_EXTRA.words (merged into I18N.PL). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Pop-ups take turns": "Okienka czekają na swoją kolej",
    "Windows that pop up on their own (a quest, a courier, a world event) now open one at a time. If one arrives while another window, a fight or a menu is open, it waits and opens right after, instead of replacing the one you were reading.":
      "Okna, które wyskakują same (zadanie, kurier, wydarzenie w świecie), otwierają się teraz po kolei. Jeśli jedno przyjdzie, gdy masz otwarte inne okno, walkę albo menu, czeka i otwiera się zaraz potem, zamiast zastąpić to, które czytasz.",
    "The same message arriving twice shows once.": "Ta sama wiadomość, która przyjdzie dwa razy, pokazuje się raz.",
    "Banners, messages, tips and a stranger's greeting stack neatly under each other and never cover each other or the top and bottom bar buttons. If there's no room, they wait.":
      "Banery, wiadomości, wskazówki i powitanie nieznajomego układają się porządnie jedno pod drugim i nigdy nie zasłaniają siebie nawzajem ani przycisków na górnym i dolnym pasku. Jeśli nie ma miejsca, czekają.",
    "In fights, combo banners and a boss's phase card never sit on your action buttons, and they wait while Items, Magic or the result is open. Taps go through the boss's phase card to your buttons.":
      "W walce banery kombinacji i karta fazy bossa nigdy nie leżą na przyciskach akcji i czekają, gdy masz otwarte Przedmioty, Magię albo wynik. Dotknięcia przechodzą przez kartę fazy bossa do przycisków.",
  });
})();
