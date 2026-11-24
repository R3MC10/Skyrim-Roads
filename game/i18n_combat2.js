/* i18n_combat2.js: Polish for combat2.js (the immersive fight screen): the setting and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Fight screen": "Ekran walki",
    "Immersive": "Wciągający",
    "Classic": "Klasyczny",
    "Round": "Runda",
    // patch note
    "A fight screen that feels like a game": "Ekran walki jak z prawdziwej gry",
    "The fight is now one big scene that fills the screen. Everything you need sits right in it, so nothing scrolls, on phones and on PC.":
      "Walka to teraz jedna duża scena na cały ekran. Wszystko, czego potrzebujesz, jest w niej, więc nic się nie przewija, na telefonie i na PC.",
    "Your health is a glowing orb in the corner with magicka and stamina curving round it; a striped band shows how much the foe is about to take. Slim bars float over your hero's head.":
      "Twoje zdrowie to świecąca kula w rogu, a magia i wytrzymałość biegną łukiem wokół niej; paskowany pas pokazuje, ile zaraz zabierze wróg. Cienkie paski unoszą się nad głową bohatera.",
    "The foe's name, health, statuses and what it plans next hang over its head. Stunned foes wobble with stars, big hits flash and shake the picture.":
      "Imię wroga, zdrowie, stany i to, co planuje, wiszą nad jego głową. Ogłuszeni wrogowie chwieją się w gwiazdkach, mocne ciosy błyskają i trzęsą obrazem.",
    "Moves are round drawn buttons with their AP cost on the rim. Magic and Items open as a drawer of cards over the fight. End Turn glows when you're out of AP and still shows the guard you keep.":
      "Ruchy to okrągłe rysowane przyciski z kosztem AP na brzegu. Magia i Przedmioty otwierają się jako szuflada kart nad walką. Koniec tury świeci, gdy skończą ci się AP, i dalej pokazuje, ile osłony zachowasz.",
    "Turn order is a ribbon of little portraits at the top, followers sit in small cards at the side, and the fight log is a short fading feed (tap it for the whole log).":
      "Kolejność tur to wstęga małych portretów u góry, towarzysze siedzą w małych kartach z boku, a dziennik walki to krótki znikający pasek (dotknij, by zobaczyć całość).",
    "Prefer the old look? Settings → Fight screen → Classic.": "Wolisz stary wygląd? Ustawienia → Ekran walki → Klasyczny.",
  });
})();
