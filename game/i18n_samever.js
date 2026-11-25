/* i18n_samever.js: Polish for "everyone on the same build" (samever.js, the title screen's Updates page in ui.js,
   app.js / pcupdate.js update cards) and its patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words,
   lines with build numbers or names in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // the cards
    "Restart now": "Uruchom ponownie", "Reload now": "Odśwież teraz", "Update": "Aktualizuj", "Updates": "Aktualizacje", "OK": "OK",
    "Update to play together": "Zaktualizuj, żeby grać razem", "Different versions": "Różne wersje",
    "Finish the fight or dungeon first, then press Restart now. Your progress is saved either way.":
      "Najpierw skończ walkę albo loch, a potem naciśnij Uruchom ponownie. Twój postęp i tak jest zapisany.",
    "Finish the fight or dungeon first, then update.": "Najpierw skończ walkę albo loch, a potem zaktualizuj.",
    "Couldn't reach the update server. Check your internet and try again.": "Nie udało się połączyć z serwerem aktualizacji. Sprawdź internet i spróbuj ponownie.",
    "You already have the newest version. Your friend needs to update.": "Masz już najnowszą wersję. To twój znajomy musi zaktualizować grę.",
    // the Updates page
    "Your version:": "Twoja wersja:", "Web version:": "Wersja przeglądarkowa:", "Newest version:": "Najnowsza wersja:", "Retry": "Spróbuj ponownie",
    "You have the newest version. Everyone you play with is on the same build once they've updated too.":
      "Masz najnowszą wersję. Wszyscy, z którymi grasz, będą na tej samej wersji, gdy też się zaktualizują.",
    "A new version is out:": "Wyszła nowa wersja:", "Reload to play it: your progress is saved.": "Odśwież, żeby w nią zagrać: twój postęp jest zapisany.",
    "Restarting on the new version…": "Uruchamianie nowej wersji…",
    "Tap Install (or Update) on Android's screen. The game reopens on the new version.": "Dotknij Zainstaluj (albo Aktualizuj) na ekranie Androida. Gra otworzy się na nowej wersji.",
    // patch note
    "Everyone on the same version": "Wszyscy na tej samej wersji",
    "The game now looks for a new version when it starts, when you come back to it, and every 10 minutes while it's open.":
      "Gra szuka nowej wersji przy starcie, gdy do niej wracasz, i co 10 minut, kiedy jest otwarta.",
    "New versions download in the background. On the title screen the game switches over straight away; while you play, a small Update ready card offers Restart now. It never restarts in the middle of a fight or a dungeon, and your progress is saved first.":
      "Nowe wersje pobierają się w tle. Na ekranie tytułowym gra przełącza się od razu; w trakcie gry mała karta Aktualizacja gotowa proponuje Uruchom ponownie. Gra nigdy nie restartuje się w środku walki ani lochu, a twój postęp zapisuje się najpierw.",
    "The web version reloads itself onto the newest version the same way.": "Wersja przeglądarkowa w ten sam sposób sama odświeża się do najnowszej wersji.",
    "Your version now goes with you online. If someone in your party or co-op run is on a different version, the one who's behind gets an Update to play together message with an Update button, and invites between different versions say why instead of quietly not working.":
      "Twoja wersja jest teraz widoczna w grze online. Jeśli ktoś w drużynie albo wspólnej wyprawie ma inną wersję, ten, kto jest w tyle, dostaje wiadomość Zaktualizuj, żeby grać razem z przyciskiem Aktualizuj, a zaproszenia między różnymi wersjami mówią dlaczego, zamiast po cichu nie działać.",
    "The Updates page shows your version and the newest one, what's going on right now (checking, downloading, ready) and a Retry button if something went wrong. Check again really checks again.":
      "Strona Aktualizacje pokazuje twoją wersję i najnowszą, co się teraz dzieje (sprawdzanie, pobieranie, gotowe) i przycisk Spróbuj ponownie, gdy coś poszło nie tak. Sprawdź jeszcze raz naprawdę sprawdza jeszcze raz.",
    "Playing alone offline is never blocked.": "Gra w pojedynkę bez sieci nigdy nie jest blokowana.",
  });
  I18N_EXTRA.pat.push(
    [/^Build (\d+) is out\. Reload now to play it: your progress is saved\.$/, (m) => `Wyszła wersja ${m[1]}. Odśwież teraz, żeby w nią zagrać: twój postęp jest zapisany.`],
    [/^Build (\d+) is downloaded\. Restart now to play it: your progress is saved\.$/, (m) => `Wersja ${m[1]} jest pobrana. Uruchom ponownie, żeby w nią zagrać: twój postęp jest zapisany.`],
    [/^(.+) is on build (\d+) and you're on build (\d+)\. Update to play together\.$/, (m) => `${m[1]} ma wersję ${m[2]}, a ty wersję ${m[3]}. Zaktualizuj, żeby grać razem.`],
    [/^(.+) is still on build (\d+) \(you have build (\d+)\)\. They need to update before you can play together\.$/,
      (m) => `${m[1]} ma jeszcze wersję ${m[2]} (ty masz ${m[3]}). Musi zaktualizować grę, zanim zagracie razem.`],
    [/^Updating: downloading build (\d+)… (\d+)%$/, (m) => `Aktualizacja: pobieranie wersji ${m[1]}… ${m[2]}%`],
    [/^Updating to build (\d+)…$/, (m) => `Aktualizacja do wersji ${m[1]}…`],
    [/^Build (\d+) is ready\. The game switches over now \(your progress is saved\)\.$/, (m) => `Wersja ${m[1]} jest gotowa. Gra przełącza się teraz (twój postęp jest zapisany).`],
    [/^Couldn't check for a new version \((.+)\)\. Check your internet( and try again)?\.$/, (m) => `Nie udało się sprawdzić nowej wersji (${m[1]}). Sprawdź internet${m[2] ? " i spróbuj ponownie" : ""}.`],
    [/^The update didn't finish: (.+)\.$/, (m) => `Aktualizacja się nie skończyła: ${m[1]}.`],
    [/^A new version \(build (\d+)\) is ready\. Open (.*) to update\.$/, (m) => `Nowa wersja (${m[1]}) jest gotowa. Otwórz ${m[2]}, żeby zaktualizować.`],
  );
})();
