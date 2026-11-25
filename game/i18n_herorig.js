/* Polish for the painted hero fixes (herorig: rig.js, fightart.js, patch notes). [OURS] */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "No more glowing blob next to your weapon": "Koniec ze świecącą plamą obok broni",
    "An enchanted weapon used to leave a big glowing blob floating in the air beside your hero in fights. The glow now sits on the weapon itself, as a slim shine along the blade.":
      "Zaklęta broń zostawiała w walce dużą świecącą plamę, która wisiała w powietrzu obok bohatera. Teraz blask jest na samej broni, jako wąska poświata wzdłuż ostrza.",
  });
})();
