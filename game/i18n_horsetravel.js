/* i18n_horsetravel.js: Polish for "horses are for travel" (horsetravel.js): the old saddle perks' new road effects,
   Ranger and Lance, the warhorse speciality, the horse bond line and the patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, perk descriptions (without their [OURS] note) in PERKDESC_PL. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const PERK = {
    "You ride 8% faster.": "Jeździsz konno o 8% szybciej.",
    "Bandits and beasts see the bow on your back: while you ride, 20% fewer fights find you on the road.":
      "Bandyci i bestie widzą łuk na twoich plecach: gdy jedziesz konno, na drodze trafia cię o 20% mniej walk.",
    "Your horse carries 25/50 more.": "Twój koń udźwignie o 25/50 więcej.",
    "Dual-cast destruction spells cost 5% less magicka.": "Podwójnie rzucane zaklęcia Zniszczenia kosztują o 5% mniej Magii.",
    "Your horse ploughs through rough ground: off the road (grass, hills, snow) it goes 10% faster.":
      "Twój koń przedziera się przez bezdroża: poza drogą (trawa, wzgórza, śnieg) idzie o 10% szybciej.",
    "Shooting power shots costs half the stamina, and you travel 3% faster.":
      "Mocne strzały kosztują połowę Wytrzymałości, a podróżujesz o 3% szybciej.",
    "Spear power attacks do 10% more.": "Potężne ataki włócznią zadają o 10% więcej.",
  };
  if (typeof PERKDESC_PL !== "undefined") Object.assign(PERKDESC_PL, PERK);
  for (const k in PERK) { I18N_EXTRA.words[k] = PERK[k]; I18N_EXTRA.words[k + " [OURS]"] = PERK[k] + " [OURS]"; }
  Object.assign(I18N_EXTRA.words, {
    "Shooting power shots costs half the stamina, and you travel 3% faster. [Skyrim: move faster with a bow drawn]":
      "Mocne strzały kosztują połowę Wytrzymałości, a podróżujesz o 3% szybciej. [Skyrim: move faster with a bow drawn]",
    "Saddle Caster": "Mag w Siodle",
    // bonds: the warhorse speciality and the bond line
    "Fearless on the road.": "Nieustraszony na drodze.",
    "{0}% fewer fights on the road while you ride.": "{0}% mniej walk na drodze, gdy jedziesz konno.",
    "Grows as you ride on the road, hunt on horseback and groom them.": "Rośnie, gdy jeździsz po drogach, polujesz konno i czeszesz konia.",
    // patch note
    "Horses are for travel": "Konie są do podróży",
    "Horses are for travel now: fights always happen on foot.": "Konie służą teraz do podróży: walczy się zawsze pieszo.",
    "Riding when a fight starts on the road? You get down and fight on foot. Your horse waits beside you, safe: nobody goes for it and a fight never hurts it. You ride on afterwards.":
      "Jedziesz konno, gdy na drodze zaczyna się walka? Zsiadasz i walczysz pieszo. Twój koń czeka obok, bezpieczny: nikt go nie atakuje i walka nigdy go nie rani. Potem jedziesz dalej.",
    "No more Mount and Dismount moves, charges or trampling in fights, and no horse health bar in the fight.":
      "W walce nie ma już ruchów Dosiądź i Zsiądź, szarż ani tratowania, ani paska zdrowia konia.",
    "The old saddle perks help on the road instead: Cavalry Charge lets you ride 8% faster, Horse Archer means 20% fewer fights find you while you ride, Steady Steed lets your horse carry 25/50 more, Trample makes it 10% faster off the road, and Saddle Caster makes dual-cast destruction spells 5% cheaper.":
      "Dawne atuty siodła pomagają teraz w drodze: Szarża Kawalerii pozwala jeździć o 8% szybciej, z Konnym Łucznikiem trafia cię o 20% mniej walk, gdy jedziesz konno, z Pewnym Wierzchowcem koń udźwignie o 25/50 więcej, Stratowanie przyspiesza go o 10% poza drogą, a Mag w Siodle obniża koszt podwójnych zaklęć Zniszczenia o 5%.",
    "Ranger now makes you travel 3% faster, and Lance makes spear power attacks 10% stronger.":
      "Ranger przyspiesza teraz podróż o 3%, a Lance wzmacnia potężne ataki włócznią o 10%.",
    "The warhorse speciality now means fewer fights find you while you ride.":
      "Specjalność koń bojowy oznacza teraz, że trafia cię mniej walk, gdy jedziesz konno.",
    "An ambush on the road no longer hurts your horse.": "Zasadzka na drodze nie rani już twojego konia.",
  });
})();
