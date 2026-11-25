/* i18n_phantom.js: Polish for the phantom-attacks fix (fightart.js labels on the fight picture, patch note b295). Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // the short words over the fight picture
    "Winds up!": "Bierze zamach!",
    "Takes aim!": "Celuje!",
    "War cry!": "Okrzyk bojowy!",
    "Heals": "Leczy się",
    "Ward up": "Osłona",
    "Braces": "Zasłania się",
    "Hides": "Kryje się",
    "Takes flight": "Wzbija się",
    "Catch breath": "Oddech",
    "Marked!": "Oznaczony!",
    "Cover!": "Osłona!",
    "Counter!": "Kontra!",
    "Thorns!": "Ciernie!",
    "Riposte!": "Riposta!",
    // patch note b295
    "No one swings on their own any more":
      "Nikt już nie macha bronią sam z siebie",
    "In a fight, you, your friends and the foe only swing when they really strike. Catching your breath, the end-of-round burns, bleeds and poison, marking the foe and covering your friends used to show you swinging your weapon. Now they don't.":
      "W walce ty, twoi towarzysze i wróg macha bronią tylko wtedy, gdy naprawdę uderza. Złapanie oddechu, podpalenia, krwawienia i trucizna na końcu rundy, oznaczenie wroga i osłanianie przyjaciół pokazywały wcześniej, jak wymachujesz bronią. Już nie.",
    "When the foe winds up a big blow, takes aim, roars a war cry, drinks a potion, raises a ward or a shield, or slips into the shadows, it no longer swings at you. A short word over the picture says what it did (\"Winds up!\", \"Takes aim!\", \"War cry!\").":
      "Gdy wróg bierze zamach do potężnego ciosu, celuje, wydaje okrzyk bojowy, pije miksturę, stawia osłonę albo tarczę lub kryje się w cieniu, nie macha już na ciebie bronią. Krótki napis nad obrazem mówi, co zrobił (\"Bierze zamach!\", \"Celuje!\", \"Okrzyk bojowy!\").",
    "Opening a menu or tapping the hotbar while a blow is still playing no longer plays that blow a second time. In a party fight the picture no longer starts the last move over when news comes from the leader's phone.":
      "Otwarcie menu albo dotknięcie paska szybkiego dostępu, gdy cios jeszcze trwa, nie odtwarza już tego ciosu drugi raz. W walce drużynowej obraz nie zaczyna już ostatniego ruchu od nowa, gdy przychodzą wieści z telefonu przywódcy.",
    "Blows that happen on their own say so on the picture: \"Counter!\" when you punch back after a miss, \"Thorns!\" when your armour bites back, \"Riposte!\" after a dodge.":
      "Ciosy, które dzieją się same, są podpisane na obrazie: \"Kontra!\", gdy oddajesz cios po pudle wroga, \"Ciernie!\", gdy twój pancerz kąsa w odpowiedzi, \"Riposta!\" po uniku.",
  });
})();
