/* i18n_partyspells.js: Polish for the party spells patch note (partyspells.js). Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Your own spells in party fights": "Twoje własne zaklęcia w walkach drużyny",
    "Spells you made at the Rune table or combined at the College now show up properly on your friends' phones in a party fight: the right name, icon and effect in the battle scene.": "Zaklęcia zrobione przy Stole run albo połączone w Kolegium wyglądają teraz jak trzeba na telefonach znajomych w walce drużyny: właściwa nazwa, ikona i efekt na polu bitwy.",
    "Only the spells you actually cast in that fight are sent, and nobody can change your spell on your phone.": "Wysyłane są tylko zaklęcia, które naprawdę rzucisz w tej walce, i nikt nie zmieni twojego zaklęcia na twoim telefonie.",
    "In a party fight, the target a foe shows is now always the one it hits, healers included.": "W walce drużyny cel pokazany przez wroga to teraz zawsze ten, którego trafia, uzdrowiciele też.",
  });
})();
