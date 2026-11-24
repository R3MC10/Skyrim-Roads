/* i18n_folbuild.js: Polish for followers who learn like you (folbuild.js): their Skills view, build names, skill and
   level toasts, build changes and the patch note. Loaded after i18n_followertab.js and before i18n.js; adds to
   I18N_STORY.ex / .pats without overriding lines already translated. */
(() => {
  if (typeof I18N_STORY === "undefined") return;
  const PL = {
    // build names (followers2.js ARCH), alone and as "a ..." in a sentence
    "Two-hander": "Dwuręczny", "Spellsword": "Magiczny miecz", "Conjurer": "Przywoływacz",
    "a warrior": "wojownik", "a two-hander": "wojownik z bronią dwuręczną", "an archer": "łucznik", "a spellsword": "magiczny miecz", "a thief": "złodziej",
    "a mage": "mag", "a conjurer": "przywoływacz", "a healer": "uzdrowiciel",
    // Skills view
    "Skills": "Umiejętności", "Browse their trees": "Przeglądaj ich drzewka", "Waits for you to level up": "Czeka, aż ty awansujesz", "Levels up as you do": "Awansuje razem z tobą",
    "Their gear picks the build: bow = archer, staff or spells = mage, two-hander = two-hander, sword and shield = warrior, dagger = thief. Change their gear and they change build and perks for free.":
      "Ekwipunek wybiera styl: łuk = łucznik, kostur lub czary = mag, broń dwuręczna = wojownik dwuręczny, miecz i tarcza = wojownik, sztylet = złodziej. Zmień im ekwipunek, a za darmo zmienią styl i atuty.",
    "They rise with use, like yours. Bold = their build's skills.": "Rosną z używaniem, jak twoje. Pogrubione = umiejętności ich stylu.",
    "They spend points by themselves in their build's trees.": "Sami wydają punkty w drzewkach swojego stylu.",
    "No perks yet. They pick one as soon as a skill of their build is high enough.": "Jeszcze bez atutów. Wybiorą jeden, gdy tylko umiejętność ich stylu będzie dość wysoka.",
    "Their gear picks the build; tap a style to have them put on their best gear for it.": "Ekwipunek wybiera styl; dotknij stylu, aby założyli do niego najlepszy ekwipunek.",
    // patch note
    "Followers learn like you do": "Towarzysze uczą się jak ty",
    "Your follower now has their own skills, the same list as yours, and they rise with use exactly like yours: swinging a sword raises One-Handed, shooting raises Archery, spells raise their school, blocking raises Block, and blows on their armour raise their armour skill.":
      "Twój towarzysz ma teraz własne umiejętności, tę samą listę co ty, i rosną one z używaniem dokładnie jak twoje: machanie mieczem podnosi Broń jednoręczną, strzelanie Łucznictwo, czary swoją szkołę, blokowanie Blokowanie, a ciosy w pancerz jego umiejętność pancerza.",
    "Their skill increases add up to level-ups, like yours. At each level they pick +10 Health, Magicka or Stamina to suit how they fight, and get a perk point. They still never go past your level.":
      "Wzrosty umiejętności składają się na awanse, jak u ciebie. Na każdym poziomie sami wybierają +10 zdrowia, magii lub wytrzymałości, pasujące do tego, jak walczą, i dostają punkt atutu. Nadal nigdy nie przerastają twojego poziomu.",
    "Their gear picks their build: give them a bow and they become an archer, a staff or spells make a mage, a two-hander a two-handed warrior, a sword and shield a tank, a dagger a sneaky thief. Change it as often as you like, it's free.":
      "Ekwipunek wybiera ich styl: daj łuk, a zostaną łucznikiem, kostur lub czary robią z nich maga, broń dwuręczna wojownika dwuręcznego, miecz i tarcza obrońcę, sztylet skrytego złodzieja. Zmieniaj to, ile chcesz, za darmo.",
    "They spend their perk points themselves in the trees of their build, with the same perks and real effects as yours. A new build means a free respec into the new trees.":
      "Punkty atutów wydają sami w drzewkach swojego stylu, z tymi samymi atutami i prawdziwymi efektami co twoje. Nowy styl to darmowa zmiana atutów na nowe drzewka.",
    "They fight by their build: archers and mages stay at the back, mages cast, sword-and-shield tanks raise their shield and draw blows away from you.":
      "Walczą według stylu: łucznicy i magowie trzymają się z tyłu, magowie rzucają czary, obrońcy z mieczem i tarczą unoszą tarczę i ściągają na siebie ciosy.",
    "Follower tab → Skills shows their level, every skill with a bar, their build and their perks. A small note pops up when one of their skills goes up. Followers you already have get skills from their level and gear.":
      "Zakładka Towarzysz → Umiejętności pokazuje ich poziom, każdą umiejętność z paskiem, styl i atuty. Gdy któraś ich umiejętność wzrośnie, pojawia się krótka informacja. Towarzysze, których już masz, dostają umiejętności z poziomu i ekwipunku.",
  };
  const PATS = [
    ["{0}: {1} increased to {2}", "{0}: {1} wzrasta do {2}"],
    ["{0} reaches level {1} (+10 health) and learns {2}.", "{0} osiąga poziom {1} (+10 zdrowia) i uczy się: {2}."],
    ["{0} reaches level {1} (+10 magicka) and learns {2}.", "{0} osiąga poziom {1} (+10 magii) i uczy się: {2}."],
    ["{0} reaches level {1} (+10 stamina) and learns {2}.", "{0} osiąga poziom {1} (+10 wytrzymałości) i uczy się: {2}."],
    ["{0} reaches level {1} (+10 health).", "{0} osiąga poziom {1} (+10 zdrowia)."],
    ["{0} reaches level {1} (+10 magicka).", "{0} osiąga poziom {1} (+10 magii)."],
    ["{0} reaches level {1} (+10 stamina).", "{0} osiąga poziom {1} (+10 wytrzymałości)."],
    ["{0} now fights as {1} (was {2}) and picks {3} perks in the new trees.", "{0} walczy teraz jako {1} (wcześniej: {2}) i wybiera atuty w nowych drzewkach: {3}."],
    ["{0} now fights as {1} (was {2}) and picks {3} perk in the new trees.", "{0} walczy teraz jako {1} (wcześniej: {2}) i wybiera atuty w nowych drzewkach: {3}."],
    ["Level-ups so far: +{0} health · +{1} magicka · +{2} stamina (they choose by their build)", "Awanse do tej pory: +{0} zdrowia · +{1} magii · +{2} wytrzymałości (wybierają według stylu)"],
    ["{0} waiting", "Czeka: {0}"], ["Level cap {0}", "Limit poziomu {0}"],
  ];
  for (const [k, v] of Object.entries(PL)) if (I18N_STORY.ex[k] == null) I18N_STORY.ex[k] = v;
  if (Array.isArray(I18N_STORY.pats)) for (const p of PATS) if (!I18N_STORY.pats.some(([en]) => en === p[0])) I18N_STORY.pats.push(p);
})();
