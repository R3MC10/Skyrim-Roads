/* i18n_fightcam.js: Polish for the fight camera (fightcam.js): Settings → Fights → Fight camera, and the build 337 patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // settings
    "Fight camera": "Kamera w walce", "Cinematic": "Filmowa", "Calm": "Spokojna",
    // patch note
    "A cinematic fight camera": "Filmowa kamera w walce",
    "The camera now moves only on big moments: it leans in a little when your turn starts, closes in on a wind-up, a critical hit, a broken guard and a killing blow, and slowly pulls in on a win. A boss gets a close-up when the fight starts. Ordinary swings keep the picture calm.":
      "Kamera rusza się teraz tylko przy ważnych chwilach: lekko się przybliża na początku twojej tury, podjeżdża przy zamachu, trafieniu krytycznym, przełamanej gardzie i ciosie kończącym, a przy zwycięstwie powoli się zbliża. Boss dostaje zbliżenie na początku walki. Zwykłe ciosy nie ruszają obrazu.",
    "A critical hit plays for a moment in slow motion. The fight doesn't get any longer: the next turn comes just as fast.":
      "Trafienie krytyczne przez chwilę leci w zwolnionym tempie. Walka nie trwa dłużej: następna tura przychodzi tak samo szybko.",
    "The battlefield has depth: the sky and far mountains move less than the ground the fighters stand on. You never see the edge of the picture.":
      "Pole bitwy ma głębię: niebo i dalekie góry przesuwają się mniej niż ziemia, na której stoją walczący. Nigdy nie widać krawędzi obrazu.",
    "Only the battlefield moves. The turn order, the cards, the boss's health bar and your buttons stay where they are, and damage numbers and names follow the fighters at the same size.":
      "Rusza się tylko pole bitwy. Kolejność tur, karty, pasek zdrowia bossa i twoje przyciski zostają na miejscu, a liczby obrażeń i imiona podążają za walczącymi w tym samym rozmiarze.",
    "In a party fight another player's big moment never moves your camera while you're choosing a move or playing a minigame.":
      "W walce drużynowej ważna chwila innego gracza nie rusza twojej kamery, kiedy wybierasz ruch albo grasz w minigrę.",
    "New in Settings → Fights: Fight camera. Cinematic (the default), Calm (gentle, no shaking, no slow motion) or Off. With Reduce motion on, the camera is always Calm.":
      "Nowe w Ustawieniach → Walki: Kamera w walce. Filmowa (domyślnie), Spokojna (łagodnie, bez wstrząsów i zwolnionego tempa) albo Wyłączona. Gdy włączone jest Mniej ruchu, kamera jest zawsze Spokojna.",
  });
})();
