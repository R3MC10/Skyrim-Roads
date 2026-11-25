/* i18n_qaside.js: Polish for side-system lines the side-systems bug hunt (claude/qa-side-*) found still in English,
   plus its patch notes. Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // patch note b238
    "Company fixes": "Poprawki w kompanii",
    "Fixed: tapping Found twice quickly could pay for the company twice.": "Naprawione: szybkie dwukrotne stuknięcie w Załóż mogło zapłacić za kompanię dwa razy.",
    "Fixed: tapping Put in twice quickly could put the same gold in the treasury twice and leave your purse below zero.": "Naprawione: szybkie dwukrotne stuknięcie we Wpłać mogło wpłacić to samo złoto dwa razy i zostawić twoją sakiewkę pod kreską.",
    "Fixed: tapping Give twice quickly could hand the same ingots to the stockpile twice.": "Naprawione: szybkie dwukrotne stuknięcie w Oddaj mogło oddać te same sztabki do magazynu dwa razy.",
    "Fixed: an app update no longer restarts the game while you're fishing, mining, hunting, at the forge or in any other mini-game, so you never lose a catch.": "Naprawione: aktualizacja aplikacji nie restartuje już gry w trakcie łowienia, kopania, polowania, kucia ani innej minigry, więc nie stracisz zdobyczy.",
    "Fixed: more of the Social, jobs and fishing screens are in Polish.": "Naprawione: więcej tekstów na ekranach Społeczność, zleceń i łowienia jest po polsku.",
    // social
    "Word on the road": "Wieści z gościńca",
    "Quiet, for now.": "Na razie cisza.",
    "Looking for other players…": "Szukam innych graczy…",
    "It can take up to a minute to find each other": "Znalezienie się nawzajem może potrwać do minuty",
    "The world": "Świat",
    "Tap a name to mute that player.": "Stuknij imię, aby wyciszyć tego gracza.",
    "Unmute all": "Przywróć wszystkich",
    "You travel alone. Invite someone from the list below.": "Podróżujesz sam. Zaproś kogoś z listy poniżej.",
    "Stop somewhere in the wilds first.": "Najpierw zatrzymaj się gdzieś w dziczy.",
    "Lie in ambush": "Zasadzka",
    "Hide here off the road (you must be standing in the wilds). You're hidden from the map.": "Ukryj się tu z dala od drogi (musisz stać w dziczy). Znikasz z mapy.",
    "Hidden by the road. The next traveller to pass close by gets a sneak attack.": "Ukryty przy drodze. Następny podróżny, który przejdzie blisko, dostanie atak z ukrycia.",
    "Bounties": "Nagrody za głowę",
    "Pay it to a guard in that hold's towns, or to a bounty hunter on the road.": "Zapłać strażnikowi w miastach tego władztwa albo łowcy nagród na drodze.",
    "Nobody rules it": "Nikt nim nie rządzi",
    "Holds": "Władztwa",
    "War points this week": "Punkty wojenne w tym tygodniu",
    // jobs
    "Your jobs": "Twoje zlecenia",
    "New jobs every in-game day (2 real hours). You can hold three at once. Clearing and delivery jobs pay out by themselves when done.": "Nowe zlecenia co dzień w grze (2 prawdziwe godziny). Możesz mieć trzy naraz. Zlecenia oczyszczenia i dostawy płacą same, gdy je skończysz.",
    // fishing
    "Cast a line and catch fish.": "Zarzuć wędkę i łów ryby.",
  });
})();
