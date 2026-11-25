/* i18n_partytrain.js: Polish for the party-in-a-line patch note (partytrain.js draws no words of its own).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Your party walks in a line": "Twoja drużyna idzie gęsiego",
    "Travelling as a party, everyone now walks in a line on the map so you can see each of you: the leader in front, the rest following one behind another along the road.":
      "Gdy podróżujecie drużyną, wszyscy idą teraz na mapie gęsiego, więc widać każdego z was: przywódca z przodu, reszta jeden za drugim wzdłuż drogi.",
    "Standing in a town, your party lines up in a row next to the town instead of all on one spot, so every name is readable.":
      "Gdy stoicie w mieście, drużyna ustawia się w rzędzie obok miasta, a nie wszyscy w jednym miejscu, więc każde imię da się przeczytać.",
  });
})();
