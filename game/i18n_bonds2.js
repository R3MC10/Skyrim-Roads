/* i18n_bonds2.js: Polish for bonds.js (follower ranks, horse bonds and specialities) and its patch note.
   Loaded after i18n_bonds.js and before i18n.js; adds to I18N_STORY.ex like i18n_bonds.js, so the screen translator
   and BONDS.T / BONDS.F find it. "{0}" markers are filled in by BONDS.F. */
(() => {
  if (typeof I18N_STORY === "undefined") return;
  const PL = {
    // ---- follower ranks
    "Hireling": "Najemnik", "Companion": "Kompan", "Trusted": "Zaufany", "Sworn": "Zaprzysiężony",
    "Follows you for the pay.": "Idzie za tobą dla zapłaty.",
    "Carries 25 more for you.": "Niesie za ciebie o 25 więcej.",
    "Carries {0} more for you.": "Niesie za ciebie o {0} więcej.",
    "Fights smarter: steps in front of you when you're badly hurt, heals you and drinks potions sooner, and goes for the kill on a wounded foe.":
      "Walczy mądrzej: zasłania cię, gdy jesteś ciężko ranny, wcześniej cię leczy i pije mikstury, a rannego wroga dobija.",
    "A signature move once per fight, even before their personal quest.": "Popisowy ruch raz na walkę, jeszcze przed osobistym zadaniem.",
    "Their personal-quest move is already theirs.": "Ruch z osobistego zadania już jest jego.",
    "Rank": "Ranga", "Next: {0} at loyalty {1}": "Następna: {0} przy lojalności {1}", "Rank move:": "Ruch rangi:",
    "Loyalty grows from fights won together (hard ones count double), gifts, talks and time on the road together.":
      "Lojalność rośnie od wspólnie wygranych walk (trudne liczą się podwójnie), prezentów, rozmów i czasu spędzonego razem w drodze.",
    "{0} reaches the rank of {1}: {2}": "{0} osiąga rangę: {1}. {2}",
    "Time on the road together": "Czas razem w drodze", "A hard fight won together": "Wspólnie wygrana trudna walka",
    // rank moves
    "Shield Rush": "Szarża tarczą", "a shield rush at 1.4 times their hit": "szarża tarczą za 1,4 raza zwykłego ciosu",
    "Heavy Swing": "Ciężki zamach", "a heavy swing at 1.5 times their hit": "ciężki zamach za 1,5 raza zwykłego ciosu",
    "Double Shot": "Podwójny strzał", "two quick arrows": "dwie szybkie strzały",
    "Spark Blade": "Iskrzące ostrze", "a sparking cut at 1.4 times their hit": "iskrzące cięcie za 1,4 raza zwykłego ciosu",
    "Dirty Cut": "Podłe cięcie", "a low cut that bleeds for three turns": "niskie cięcie, które krwawi przez trzy tury",
    "Firebolt": "Ognisty pocisk", "a firebolt at 1.5 times their hit": "ognisty pocisk za 1,5 raza zwykłego ciosu",
    "Warding Light": "Światło ochrony", "heals you for a sixth of your health": "leczy cię o jedną szóstą zdrowia",
    "Healing Hands": "Uzdrawiające dłonie", "heals you for a fifth of your health": "leczy cię o jedną piątą zdrowia",
    "Snap": "Kłapnięcie", "a bite that bleeds for three turns": "ugryzienie, które krwawi przez trzy tury",
    // personal-quest banners
    "Go to {0}: {1}.": "Idź do: {0}. {1}.", "Clear {0}: {1}.": "Oczyść: {0}. {1}.", "Talk to {0} to finish it.": "Porozmawiaj z: {0}, by to zakończyć.",
    // ---- horse bonds
    "Wary": "Nieufny", "Used to you": "Przywykł do ciebie", "Bonded": "Związany", "Close friends": "Bliscy przyjaciele", "Heart-bound": "Serdeczny",
    "Warhorse": "Koń bojowy", "Mountain horse": "Koń górski", "Courier": "Kurier", "Packhorse": "Koń juczny", "Hunter's horse": "Koń myśliwski",
    "warhorse": "koń bojowy", "hunter's horse": "koń myśliwski",
    "Trained for battle.": "Wyszkolony do walki.", "Sure-footed off the road.": "Pewny krok poza drogą.", "Built for long roads.": "Stworzony do długich dróg.",
    "Strong back, steady pace.": "Mocny grzbiet, równy krok.", "Quiet, and doesn't spook.": "Cichy i niepłochliwy.",
    "Mounted charge +{0}%, horse takes {1}% less damage, +{2}% from the saddle.": "Szarża konna +{0}%, koń otrzymuje o {1}% mniej obrażeń, +{2}% z siodła.",
    "{0}% faster off the road; snow and storms slow you {1}% less.": "Poza drogą szybciej o {0}%; śnieg i burze spowalniają cię o {1}% mniej.",
    "{0}% faster on roads and bridges.": "Na drogach i mostach szybciej o {0}%.",
    "Carries {0} more.": "Niesie o {0} więcej.",
    "Hunting from the saddle: almost no slowdown, {0}% more animals, {1}% chance of an extra hide.": "Polowanie z siodła: prawie bez spowolnienia, o {0}% więcej zwierząt, {1}% szansy na dodatkową skórę.",
    "{0} trusts you now (bond level {1}). Pick a speciality for {0} at any stables.": "{0} ufa ci teraz (poziom więzi {1}). Wybierz specjalność w dowolnej stajni.",
    "{0}'s bond grows: level {1}, {2}.": "Więź z: {0} rośnie: poziom {1}, {2}.", "{0} gets stronger.": "{0}: specjalność jest silniejsza.",
    "You don't have a horse.": "Nie masz konia.", "You can groom your horse at any stables.": "Konia możesz wyczesać w każdej stajni.",
    "{0} was groomed today already.": "{0} był już dziś wyczesany.", "Oats, a brush and a stall cost {0} gold.": "Owies, szczotka i boks kosztują {0} złota.",
    "You brush {0} down and give them a bucket of oats. {0} nuzzles your shoulder.": "Czeszesz konia ({0}) i dajesz mu wiadro owsa. {0} trąca cię chrapami w ramię.",
    "{0} needs bond level {1} first.": "{0} potrzebuje najpierw poziomu więzi {1}.", "Choose a speciality at a stables.": "Specjalność wybierzesz w stajni.",
    "{0} is already a {1}.": "{0} to już {1}.", "Retraining costs {0} gold.": "Przeszkolenie kosztuje {0} złota.", "{0} is now a {1}. {2}": "{0} to teraz {1}. {2}",
    "Chosen": "Wybrana", "Choose": "Wybierz", "Retrain ({0})": "Przeszkol ({0})", "Bond with {0}": "Więź z: {0}", "Level": "Poziom",
    "Grows as you ride on the road, win fights in the saddle, hunt on horseback and groom them.": "Rośnie, gdy jeździsz po drogach, wygrywasz walki w siodle, polujesz konno i czeszesz konia.",
    "At level {0} you pick one speciality.": "Na poziomie {0} wybierasz jedną specjalność.", "Groom ({0} gold)": "Wyczesz ({0} złota)", "Bond level {0}": "Poziom więzi {0}",
    // ---- perks
    "Fellow Traveller": "Towarzysz podróży", "Horse Whisperer": "Zaklinacz koni",
    "Time on the road counts double for your follower's loyalty, and from Companion rank they carry another 25 for you. [OURS]":
      "Czas w drodze liczy się podwójnie dla lojalności towarzysza, a od rangi Kompan niesie za ciebie kolejne 25. [OURS]",
    "Your horse bonds twice as fast, and its speciality works 20% better. [OURS]": "Twój koń zżywa się z tobą dwa razy szybciej, a jego specjalność działa o 20% lepiej. [OURS]",
    // ---- patch note
    "Bonds with followers and horses": "Więzi z towarzyszami i końmi",
    "Followers now have ranks: Hireling, Companion, Trusted and Sworn. They climb as loyalty grows, and each rank gives something real.":
      "Towarzysze mają teraz rangi: Najemnik, Kompan, Zaufany i Zaprzysiężony. Rosną razem z lojalnością, a każda daje coś konkretnego.",
    "Companion: they carry 25 more for you. Trusted: they fight smarter, stepping in front of you when you're badly hurt, healing you sooner and finishing off wounded foes. Sworn: a signature move once per fight, even before their personal quest.":
      "Kompan: niesie za ciebie o 25 więcej. Zaufany: walczy mądrzej, zasłania cię, gdy jesteś ciężko ranny, szybciej leczy i dobija rannych wrogów. Zaprzysiężony: popisowy ruch raz na walkę, jeszcze przed osobistym zadaniem.",
    "Loyalty now also grows from time on the road together and from hard fights won side by side (bosses, dragons, dangerous foes).":
      "Lojalność rośnie teraz także od czasu spędzonego razem w drodze i od trudnych walk wygranych ramię w ramię (bossowie, smoki, groźni wrogowie).",
    "Personal quests show the QUEST STARTED and objective banners like every other quest.":
      "Osobiste zadania pokazują baner ROZPOCZĘTO ZADANIE i cele, jak każde inne zadanie.",
    "Horses have a bond level from 1 to 5. It grows as you ride on the road, win fights in the saddle, hunt on horseback and groom them at a stables.":
      "Konie mają poziom więzi od 1 do 5. Rośnie, gdy jeździsz po drogach, wygrywasz walki w siodle, polujesz konno i czeszesz konia w stajni.",
    "At bond level 3 you pick one speciality at a stables: warhorse, mountain horse, courier, packhorse or hunter's horse. It gets stronger at levels 4 and 5. You can retrain later for gold.":
      "Na poziomie więzi 3 wybierasz w stajni jedną specjalność: koń bojowy, górski, kurier, juczny albo myśliwski. Rośnie w siłę na poziomach 4 i 5. Później można konia przeszkolić za złoto.",
    "New perks: Fellow Traveller in Etiquette (road time counts double, your follower carries more) and Horse Whisperer in Athletics (your horse bonds twice as fast, its speciality works better).":
      "Nowe atuty: Towarzysz podróży w Etykiecie (czas w drodze liczy się podwójnie, towarzysz niesie więcej) i Zaklinacz koni w Atletyce (koń zżywa się dwa razy szybciej, specjalność działa lepiej).",
  };
  for (const [k, v] of Object.entries(PL)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
})();
