/* i18n_updater.js: Polish for the safer phone updates patch note (app.js updater).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Safer updates on phones": "Bezpieczniejsze aktualizacje na telefonie",
    "Game updates on the phone never send you to Android's installer any more. If the small update doesn't work, the game downloads the whole game instead, and if that fails too it just tries again a bit later.":
      "Aktualizacje gry na telefonie już nigdy nie odsyłają cię do instalatora Androida. Jeśli mała aktualizacja nie zadziała, gra pobiera całą grę, a jeśli i to się nie uda, po prostu spróbuje ponownie trochę później.",
    "Every download is checked before it's unpacked, so a broken or half-finished download can't end up in your game.":
      "Każde pobranie jest sprawdzane przed rozpakowaniem, więc uszkodzony albo niedokończony plik nie trafi do twojej gry.",
    "If a new version ever fails to start, the app goes back to the last version that worked and won't try that broken one again.":
      "Jeśli nowa wersja kiedyś się nie uruchomi, aplikacja wraca do ostatniej działającej wersji i nie będzie już próbować tej zepsutej.",
    "Looking for new versions is quicker and no longer runs into GitHub's limits.":
      "Szukanie nowych wersji jest szybsze i nie trafia już na limity GitHuba.",
    "Downloading the full game again…": "Pobieram całą grę jeszcze raz…",
  });
})();
