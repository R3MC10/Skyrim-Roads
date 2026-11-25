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
    "Better riding": "Lepsza jazda konna",
    "You can dual cast from the saddle now. It costs a fifth more magicka up there; the new Destruction perk Saddle Caster removes that and adds a little power.":
      "Teraz możesz rzucać podwójnie z siodła. Kosztuje to tam o jedną piątą więcej magii; nowy perk Zniszczenia, Mag w Siodle, usuwa ten koszt i dodaje trochę mocy.",
    "In a fight, getting on your horse takes two of your moves (one with Steady Steed) and getting off takes one. You see yourself climb up or slide down, and your horse waits nearby while you fight on foot.":
      "W walce wsiadanie na konia zajmuje dwa twoje ruchy (jeden z Pewnym Wierzchowcem), a zsiadanie jeden. Widzisz, jak się wspinasz albo zsuwasz, a koń czeka obok, gdy walczysz pieszo.",
    "Riders have both legs now: the near leg over the horse's side with the foot in the stirrup, the far leg behind it. In fights, on the map, for every coat.":
      "Jeźdźcy mają teraz obie nogi: bliższą na boku konia ze stopą w strzemieniu, dalszą za nim. W walkach, na mapie, dla każdej maści.",
    "The rider moves with the horse instead of jerking on top of it.":
      "Jeździec porusza się razem z koniem, zamiast podskakiwać na nim.",
    "The map has a ride button next to zoom: tap it to get on or off. You see the horse walk up and you climb into the saddle, or slide down. On foot your horse walks behind you.":
      "Na mapie obok przybliżenia jest przycisk jazdy: dotknij go, żeby wsiąść albo zsiąść. Widzisz, jak koń podchodzi, a ty wspinasz się na siodło albo zsuwasz. Pieszo koń idzie za tobą.",
    "Horses still never die: a knocked-down horse throws you off and gets back up later.":
      "Konie dalej nigdy nie giną: powalony koń zrzuca cię i wstaje później.",
  });
  I18N_EXTRA.pat.push(
    [/^Slide down from (.+) \(one move\)\. On foot you can power attack with a two-hander, and foes stop going for your horse\. (.+) waits nearby\.$/,
      (m) => `Zsuń się z: ${m[1]} (jeden ruch). Pieszo możesz robić potężne ataki bronią dwuręczną, a wrogowie przestają atakować twojego konia. ${m[2]} czeka obok.`],
    [/^Climb up onto (.+) \((\d+) stamina, (2 moves|one move)\)\. Your next blow is a charge: a sure hit that does more and can knock the foe back\. In the saddle swords and axes on foot miss you more, but archers, mages and spears can pull you down\.$/,
      (m) => `Wespnij się na: ${m[1]} (${m[2]} wytrzymałości, ${m[3] === "one move" ? "jeden ruch" : "2 ruchy"}). Twój następny cios to szarża: pewne trafienie, które zadaje więcej i może odrzucić wroga. W siodle miecze i topory piechoty częściej pudłują, ale łucznicy, magowie i włócznie mogą cię ściągnąć.`],
  );
})();
