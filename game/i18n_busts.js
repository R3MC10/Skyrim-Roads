/* i18n_busts.js: Polish for the painted race busts (bustart.js): the patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // patch note (build 226)
    "Painted faces for every race": "Malowane twarze dla każdej rasy",
    "Picking a race now shows a painted portrait of each one on a dark panel, with the race name underneath.":
      "Przy wyborze rasy każda ma teraz malowany portret na ciemnym tle, a pod nim nazwę rasy.",
    "The Character page shows your race's painted portrait, and the Worn screen in your inventory has a small one in the corner of your paper doll.":
      "Strona Postaci pokazuje malowany portret twojej rasy, a ekran Noszone w ekwipunku ma mały portret w rogu twojej postaci.",
    "There is one painting per race, of a man or a woman. If your hero is the other sex, the painting shows as a round race crest instead of as your face.":
      "Każda rasa ma jeden obraz, mężczyzny albo kobiety. Jeśli twój bohater jest innej płci, obraz pokazuje się jako okrągły herb rasy, a nie jako twoja twarz.",
    "Fights and the paper doll still show your hero in the gear you wear.":
      "W walkach i na ekranie ekwipunku nadal widać twojego bohatera w tym, co nosi.",
  });
})();
