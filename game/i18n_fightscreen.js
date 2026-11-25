/* i18n_fightscreen.js: Polish for the three-zone fight screen (fightzones.js, fightpres.js) and its patch note.
   The screen itself adds no new words; this holds the patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "A clearer fight screen": "Czytelniejszy ekran walki",
    "On a phone the fight screen now has three parts: the turn order, the foe's next move, its health and the latest line of the fight at the top; the battle in the middle with nothing covering the fighters; your health, your party and the move buttons at the bottom, in easy reach of your thumbs.":
      "Na telefonie ekran walki ma teraz trzy części: u góry kolejność tur, następny ruch wroga, jego zdrowie i najnowsza linia walki; w środku bitwa, której nic nie zasłania; na dole twoje zdrowie, drużyna i przyciski ruchów, w zasięgu kciuków.",
    "On a PC your party stands down the left side, the foe you're fighting and the whole fight story down the right, and the battle in the middle.":
      "Na komputerze twoja drużyna stoi po lewej, wróg, z którym walczysz, i cała historia walki po prawej, a bitwa w środku.",
    "A gold ring under the foe shows who your blows go to.": "Złoty krąg pod wrogiem pokazuje, kogo trafią twoje ciosy.",
    "Only one big banner shows at a time (Your turn, a new round, a combo, a boss's new phase), and they appear above the fighters' heads instead of over them.":
      "Naraz pokazuje się tylko jeden duży napis (Twoja tura, nowa runda, kombinacja, nowa faza bossa) i pojawia się nad głowami walczących, a nie na nich.",
    "A boss's introduction plays once per fight, and the first-fight tips and Your turn wait until it's over.":
      "Przedstawienie bossa gra raz na walkę, a wskazówki z pierwszych walk i Twoja tura czekają, aż się skończy.",
  });
})();
