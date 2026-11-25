/* i18n_fightpos.js: Polish for the fight positions patch note (fightpos.js, claude/fightpos).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // patch note b251
    "Everyone stands in the right place": "Każdy stoi na swoim miejscu",
    "In a fight your party, followers and summons now stand in neat rows behind you, all of them on screen, even a full party of 8 on a phone. Before, some stood off the edge of the screen.":
      "W walce drużyna, towarzysze i przywołańce stoją teraz w równych rzędach za tobą i wszyscy są na ekranie, nawet pełna drużyna 8 osób na telefonie. Wcześniej niektórzy stali poza krawędzią ekranu.",
    "Foes still waiting their turn now stand behind the one you're fighting, so you can see what's coming.":
      "Wrogowie czekający na swoją kolej stoją teraz za tym, z którym walczysz, więc widać, co cię czeka.",
    "Big foes like dragons and giants keep their size but always fit on screen, and the foe's health bar sits over its head, even over a dragon's.":
      "Duzi wrogowie, jak smoki i olbrzymy, zachowują swój rozmiar, ale zawsze mieszczą się na ekranie, a pasek zdrowia wroga jest nad jego głową, nawet nad smokiem.",
    "When a party member swings at the foe, they step up to it and then go back to their place.":
      "Gdy ktoś z drużyny atakuje wręcz, podchodzi do wroga, a potem wraca na swoje miejsce.",
    "The ring under the one the foe is about to hit is now under the right person.":
      "Krąg pod tym, kogo wróg zaraz zaatakuje, jest teraz pod właściwą osobą.",
  });
})();
