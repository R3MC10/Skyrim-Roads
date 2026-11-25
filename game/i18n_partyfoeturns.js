/* i18n_partyfoeturns.js: Polish for the "foes take proper turns in party fights" patch note (tbfight.js). Loaded before
   i18n.js; exact lines go in I18N_EXTRA.words (merged into I18N.PL). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Foes take proper turns in party fights": "Wrogowie grają swoje tury w walkach drużyny",
    "In a party fight the foe now says who its next move goes for, and that's who it really hits. Before, it could say \"you\" and then hit a teammate.":
      "W walce drużyny wróg pokazuje teraz, na kogo idzie jego ruch, i właśnie tego kogoś trafia. Wcześniej potrafił pokazać „ty”, a potem uderzyć kogoś z drużyny.",
    "When a fast foe moves twice in a round, its 1st move always comes before its 2nd in the turn strip.":
      "Gdy szybki wróg rusza się dwa razy w rundzie, jego 1. ruch zawsze stoi na pasku tur przed 2.",
    "With a big party, or a phone that was slow for a moment, every teammate still sees every one of the foe's moves play out, round by round, the same as the leader.":
      "Przy dużej drużynie albo gdy telefon na chwilę zwolni, każdy z drużyny i tak widzi każdy ruch wroga, runda po rundzie, tak samo jak lider.",
  });
})();
