/* i18n_riding.js: Polish for riding (riding.js, mountfight.js): the map's ride button, getting on and off in a fight,
   dual casting in the saddle, the Saddle Caster perk and the patch note. Loaded before i18n.js; exact lines go in
   I18N_EXTRA.words, lines with names and numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Ride your horse": "Dosiądź konia",
    "Get down and walk": "Zsiądź i idź pieszo",
    "Takes 2 moves": "Zajmuje 2 ruchy",
    "Saddle Caster": "Mag w Siodle",
    "Dual casting from the saddle costs no extra magicka, and your dual-cast spells do 10% more while you ride. [OURS]":
      "Podwójne rzucanie z siodła nie kosztuje dodatkowej magii, a twoje podwójne czary zadają o 10% więcej, gdy jedziesz konno. [OURS]",
    "Your horse takes 20/40% less damage in fights, foes pull you out of the saddle half as often, foot soldiers miss you 5/10% more, and getting on takes one move instead of two and 5 stamina less. [OURS]":
      "Twój koń otrzymuje w walce o 20/40% mniej obrażeń, wrogowie ściągają cię z siodła o połowę rzadziej, piechota pudłuje o 5/10% częściej, a wsiadanie zajmuje jeden ruch zamiast dwóch i kosztuje o 5 wytrzymałości mniej. [OURS]",
    // patch note
    "Riding on the map": "Jazda konna na mapie",
    "The map has a ride button next to zoom: tap it to get on or off your horse. You see the horse walk up and you climb into the saddle, or slide down.":
      "Na mapie obok przybliżenia jest przycisk jazdy: dotknij go, żeby wsiąść na konia albo z niego zsiąść. Widzisz, jak koń podchodzi, a ty wspinasz się na siodło albo zsuwasz.",
    "On foot your horse walks along just behind you on the map.": "Gdy idziesz pieszo, koń idzie na mapie tuż za tobą.",
    "Riders on the map have both legs now: the near leg over the horse's side, the far leg behind it, for every coat.":
      "Jeźdźcy na mapie mają teraz obie nogi: bliższą na boku konia, dalszą za nim, dla każdej maści.",
    "The rider moves smoothly with the horse's walk and gallop instead of jerking along.":
      "Jeździec porusza się płynnie razem ze stępem i galopem konia, zamiast szarpać.",
  });
  I18N_EXTRA.pat.push(
    [/^Slide down from (.+) \(one move\)\. On foot you can power attack with a two-hander, and foes stop going for your horse\. (.+) waits nearby\.$/,
      (m) => `Zsuń się z: ${m[1]} (jeden ruch). Pieszo możesz robić potężne ataki bronią dwuręczną, a wrogowie przestają atakować twojego konia. ${m[2]} czeka obok.`],
    [/^Climb up onto (.+) \((\d+) stamina, (2 moves|one move)\)\. Your next blow is a charge: a sure hit that does more and can knock the foe back\. In the saddle swords and axes on foot miss you more, but archers, mages and spears can pull you down\.$/,
      (m) => `Wespnij się na: ${m[1]} (${m[2]} wytrzymałości, ${m[3] === "one move" ? "jeden ruch" : "2 ruchy"}). Twój następny cios to szarża: pewne trafienie, które zadaje więcej i może odrzucić wroga. W siodle miecze i topory piechoty częściej pudłują, ale łucznicy, magowie i włócznie mogą cię ściągnąć.`],
  );
})();
