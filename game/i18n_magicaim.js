/* i18n_magicaim.js: Polish for aiming spells with Magic open and the whole party fitting on screen (fightfit.js,
   fightctl.js). Loaded before i18n.js: exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "Who gets it? Tap a name, their plate or them in the scene.": "Kto to dostanie? Stuknij imię, jego tabliczkę albo postać na scenie.",
  "Cast on anyone, see everyone": "Rzucaj na każdego, widź wszystkich",
  "With Magic or Items open in a fight, the scene, your health orb and your party's plates now move up above the menu instead of hiding under it, so you can tap or drag a heal onto anyone.":
    "Gdy w walce otwarta jest Magia albo Przedmioty, scena, twoja kula zdrowia i tabliczki drużyny przesuwają się teraz nad menu, zamiast chować się pod nim, więc możesz stuknąć albo przeciągnąć leczenie na każdego.",
  "When a heal or a ward asks who gets it, tap their name in the bar at the top, their plate, or just tap them in the scene.":
    "Gdy leczenie albo osłona pyta, kto ją dostanie, stuknij imię w pasku u góry, tabliczkę albo po prostu tę postać na scenie.",
  "A full party (up to 8 players plus followers) now fits on the screen: everyone stands between the turn strip and the bottom bar, and the party plates get more columns or slimmer plates instead of running off the screen.":
    "Pełna drużyna (do 8 graczy plus towarzysze) mieści się teraz na ekranie: wszyscy stoją między paskiem tur a dolnym paskiem, a tabliczki drużyny dostają więcej kolumn albo robią się węższe, zamiast uciekać za ekran.",
  "On a phone held sideways the Magic menu is slimmer (one line per spell), and on a PC or a wide screen the scene slides up so nobody's feet are under the bar.":
    "Na telefonie trzymanym poziomo menu Magii jest węższe (jedna linijka na zaklęcie), a na PC i szerokim ekranie scena przesuwa się w górę, żeby niczyje stopy nie chowały się pod paskiem.",
});
