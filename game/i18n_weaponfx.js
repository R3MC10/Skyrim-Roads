/* i18n_weaponfx.js: Polish for the weapon effects patch note (weaponfx.js).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Weapon hits that fit the weapon": "Ciosy pasujące do broni",
    "Weapon effects in fights are much smaller now and match what you swing: a sword leaves a thin slash, an axe a short chop, a mace or warhammer a heavy thud with a puff of dust (no slash), a dagger a quick little stab, a spear a thrust.":
      "Efekty broni w walkach są teraz dużo mniejsze i pasują do tego, czym machasz: miecz zostawia cienkie cięcie, topór krótkie rąbnięcie, buzdygan albo młot bojowy ciężkie uderzenie z kłębem kurzu (bez cięcia), sztylet szybkie małe pchnięcie, włócznia sztych.",
    "The hit now shows up the moment the weapon actually connects, right where it meets the body, instead of a big white swoosh popping up early in front of the foe.":
      "Trafienie pojawia się teraz dokładnie w chwili, gdy broń sięga celu, w miejscu, gdzie trafia w ciało, zamiast wielkiego białego łuku wyskakującego za wcześnie przed wrogiem.",
    "A dagger's two stabs each get their own quick trail, and every hit plays once. A miss is just a faint swish, with no sparks.":
      "Oba pchnięcia sztyletem mają teraz własny krótki ślad, a każde trafienie pokazuje się raz. Pudło to tylko lekki świst, bez iskier.",
    "A staff's spell now gathers and flies from the top of the staff, not from your chest.":
      "Zaklęcie z kostura zbiera się teraz i leci z jego czubka, a nie z twojej piersi.",
    "When your follower steps in and hits the foe, you now see the blow land.":
      "Gdy twój towarzysz doskakuje i trafia wroga, teraz widać, jak cios ląduje.",
    "Power attacks get a small gleam on the blade instead of a star floating in the air, and only they crack the ground.":
      "Silne ataki mają teraz mały błysk na ostrzu zamiast gwiazdki wiszącej w powietrzu i tylko one zostawiają pęknięcia w ziemi.",
  });
})();
