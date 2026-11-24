/* i18n_appicon.js: Polish for the new app icon's patch note (icon.svg, scripts/make_icons.py).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "A proper icon": "Prawdziwa ikona",
    "The game has its own icon now: a horned Nord helm under the northern star, on a parchment shield. You'll see it on your phone's home screen, the PC game's window, taskbar and installer, and the browser tab.":
      "Gra ma teraz własną ikonę: rogaty hełm Norda pod gwiazdą północy, na pergaminowej tarczy. Zobaczysz ją na ekranie głównym telefonu, w oknie, na pasku zadań i w instalatorze gry na PC oraz na karcie przeglądarki.",
    "On Android 13 and newer it also follows your themed icons, and game notifications show a small helm instead of a plain square. The loading screen shows the new shield too.":
      "Na Androidzie 13 i nowszym dopasowuje się też do ikon z motywem, a powiadomienia gry pokazują mały hełm zamiast zwykłego kwadratu. Ekran ładowania też pokazuje nową tarczę.",
  });
})();
