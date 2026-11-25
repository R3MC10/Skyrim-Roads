/* i18n_dawnguard.js: Polish for the vampire war (dawnguard.js, dgart.js, its perks and achievements).
   Loaded after i18n_story.js and before i18n.js; adds to I18N_STORY.ex (exact lines and single sentences, since the
   screen translator goes sentence by sentence) and I18N_STORY.pats (lines with numbers in them). */
(() => {
  if (typeof I18N_STORY === "undefined") return;
  const PL = {
    // ---- quest lines, givers, titles
    "Dawnguard: Awakening": "Straż Świtu: Przebudzenie", "Dawnguard: Hunt the Night": "Straż Świtu: Łowy na noc", "Volkihar: Harkon's Gift": "Volkihar: Dar Harkona",
    "Isran, Fort Dawnguard near Riften (from level 12)": "Isran, Fort Straży Świtu koło Riften (od poziomu 12)",
    "Isran, Fort Dawnguard, or turn Harkon down at Castle Volkihar": "Isran w Forcie Straży Świtu albo odmów Harkonowi w zamku Volkihar",
    "Lord Harkon, Castle Volkihar": "Lord Harkon, zamek Volkihar",
    "Dawnguard": "Straż Świtu", "the Dawnguard": "Straż Świtu", "Harkon's court": "dwór Harkona",
    "Hero of the Dawnguard": "Bohater Straży Świtu", "Lord of Volkihar": "Pan Volkihar",
    "Dawnguard: Awakening: A New Order.": "Straż Świtu: Przebudzenie: Nowy zakon.",
    "Dawnguard: Hunt the Night: Hunter's Return.": "Straż Świtu: Łowy na noc: Powrót łowcy.",
    "Volkihar: Harkon's Gift: The Gift.": "Volkihar: Dar Harkona: Dar.",
    // ---- the opening
    "A New Order": "Nowy zakon", "Awakening": "Przebudzenie", "Bloodline": "Linia krwi",
    "Isran is rebuilding the Dawnguard, the old vampire hunters.": "Isran odbudowuje Straż Świtu, dawnych łowców wampirów.",
    "He hears vampires are digging at Dimhollow Crypt.": "Słyszał, że wampiry kopią w Krypcie Mrocznej Kotliny.",
    "Go and clear it.": "Idź i oczyść ją.",
    "Deep in the crypt a sealed coffin stands on a ring of stone.": "Głęboko w krypcie stoi zapieczętowana trumna otoczona kręgiem kamieni.",
    "Open it.": "Otwórz ją.", "Whatever sleeps inside has guards.": "Cokolwiek w niej śpi, ma strażników.",
    "Open the sealed coffin": "Otwórz zapieczętowaną trumnę", "Crypt guardians": "Strażnicy krypty",
    "The coffin held Serana, a vampire who slept for ages with an Elder Scroll on her back.": "W trumnie była Serana, wampirzyca, która przespała wieki z Pradawnym Zwojem na plecach.",
    "She wants to go home.": "Chce wrócić do domu.",
    "Wade out to Castle Volkihar with her and meet her father, Lord Harkon.": "Przejdź z nią przez płyciznę do zamku Volkihar i poznaj jej ojca, lorda Harkona.",
    "Hear Harkon's offer": "Wysłuchaj oferty Harkona",
    // ---- the Dawnguard path
    "Hunter's Return": "Powrót łowcy", "Old Friends": "Starzy przyjaciele", "Prophet": "Prorok", "Unseen Visions": "Niewidziane wizje", "Chasing Echoes": "W pogoni za echem",
    "The Blood Nest": "Krwawe gniazdo", "Kindred Judgment": "Sąd nad krewnymi",
    "You turned Harkon down and walked out of his castle alive.": "Odmówiłeś Harkonowi i wyszedłeś z jego zamku żywy.",
    "Tell Isran what you saw at Fort Dawnguard.": "Opowiedz Isranowi w Forcie Straży Świtu, co widziałeś.",
    "Report to Isran": "Zdaj raport Isranowi",
    "Isran needs Gunmar, the troll tamer.": "Isran potrzebuje Gunmara, poskramiacza trolli.",
    "Gunmar went into Fallowstone Cave after a pack of wild trolls.": "Gunmar poszedł do Jaskini Płowego Kamienia za stadem dzikich trolli.",
    "Clear it with him.": "Oczyść ją razem z nim.",
    "Only a Moth Priest can read Serana's Elder Scroll.": "Tylko Kapłan Ćmy może odczytać Pradawny Zwój Serany.",
    "One is on the road to Dragon Bridge, and vampires are waiting for him.": "Jeden jest w drodze do Smoczego Mostu, a wampiry już na niego czekają.",
    "Get there first.": "Bądź tam pierwszy.", "Break the vampire ambush": "Rozbij zasadzkę wampirów", "Vampire ambush": "Zasadzka wampirów", "Dawnguard hunter": "Łowca Straży Świtu",
    "The Moth Priest says the prophecy needs a second Elder Scroll.": "Kapłan Ćmy mówi, że do proroctwa potrzeba drugiego Pradawnego Zwoju.",
    "The Dwemer hid one deep in Raldbthar.": "Dwemerowie ukryli jeden głęboko w Raldbthar.", "Clear it.": "Oczyść to miejsce.",
    "Serana's mother hid the last Scroll.": "Matka Serany ukryła ostatni Zwój.",
    "Her notes are somewhere in Castle Volkihar's old courtyard.": "Jej notatki są gdzieś na starym dziedzińcu zamku Volkihar.",
    "Slip in unseen.": "Wślizgnij się niezauważony.", "Sneak into the courtyard": "Zakradnij się na dziedziniec", "Volkihar thralls": "Niewolnicy Volkihar",
    "Harkon feeds his court from a nest of vampires at Bloodlet Throne.": "Harkon karmi swój dwór z gniazda wampirów w Krwawym Tronie.",
    "Burn it out before the last fight.": "Wypal je przed ostatnią walką.",
    "The Scrolls are read.": "Zwoje zostały odczytane.", "Harkon means to blot out the sun for good.": "Harkon chce na zawsze zgasić słońce.",
    "Storm Castle Volkihar with Isran, Serana and the trolls, and end him.": "Zdobądź zamek Volkihar z Isranem, Seraną i trollami, i skończ z nim.",
    "Storm the castle and face Harkon": "Zdobądź zamek i zmierz się z Harkonem", "Lord Harkon": "Lord Harkon", "Isran": "Isran", "Serana": "Serana", "Armoured troll": "Opancerzony troll",
    // ---- the Volkihar path
    "The Gift": "Dar", "A Thrall Taken": "Porwany niewolnik", "The Hunter Hunted": "Łowca w potrzasku", "Destroying the Dawnguard": "Zniszczenie Straży Świtu",
    "Harkon offers you his own blood: you'd be a vampire, and more than that, a Vampire Lord.": "Harkon oferuje ci własną krew: zostałbyś wampirem, a nawet czymś więcej, Wampirzym Lordem.",
    "Drink.": "Pij.", "Drink Harkon's blood": "Wypij krew Harkona",
    "Harkon won't share his blood with a werewolf.": "Harkon nie podzieli się krwią z wilkołakiem.", "Lose the beast blood first.": "Najpierw pozbądź się zwierzęcej krwi.",
    "The Thalmor took one of Harkon's thralls to Northwatch Keep.": "Thalmor zabrał jednego z niewolników Harkona do Twierdzy Północnej Straży.",
    "Show the court what its new lord can do.": "Pokaż dworowi, co potrafi jego nowy pan.", "Clear the keep.": "Oczyść twierdzę.",
    "One is on the road to Dragon Bridge with a Dawnguard escort.": "Jeden jest w drodze do Smoczego Mostu pod eskortą Straży Świtu.",
    "Take him for Harkon.": "Porwij go dla Harkona.", "Ambush the Dawnguard escort": "Napadnij na eskortę Straży Świtu", "Dawnguard escort": "Eskorta Straży Świtu", "Vampire thrall": "Wampirzy niewolnik",
    "Serana's mother hid the last Scroll beyond a gate in the castle's old courtyard.": "Matka Serany ukryła ostatni Zwój za bramą na starym dziedzińcu zamku.",
    "Its keepers don't want it opened.": "Jej strażnicy nie chcą, żeby ją otwierać.", "Open Valerica's gate": "Otwórz bramę Valeriki", "Soul Cairn keepers": "Strażnicy Kopca Dusz",
    "Gunmar's armoured trolls are the Dawnguard's teeth.": "Opancerzone trolle Gunmara to kły Straży Świtu.",
    "They're kept in Fallowstone Cave.": "Trzymają je w Jaskini Płowego Kamienia.", "Kill them before the assault.": "Zabij je przed szturmem.",
    "The Scrolls are read and the sun will fail.": "Zwoje zostały odczytane i słońce zgaśnie.",
    "Only Fort Dawnguard stands in the way.": "Na drodze stoi już tylko Fort Straży Świtu.",
    "Lead Harkon's assault and break Isran.": "Poprowadź szturm Harkona i złam Israna.",
    "Lead the assault on Fort Dawnguard": "Poprowadź szturm na Fort Straży Świtu", "Isran and the Dawnguard": "Isran i Straż Świtu", "Gargoyle": "Gargulec",
    // ---- refusals and choices
    "Isran doesn't take green recruits.": "Isran nie bierze żółtodziobów.", "Come back at level 12.": "Wróć na poziomie 12.",
    "Finish Dawnguard: Awakening first.": "Najpierw ukończ Straż Świtu: Przebudzenie.",
    "You've already drunk Harkon's blood.": "Już wypiłeś krew Harkona.", "Isran's hunters would shoot you on sight.": "Łowcy Israna zastrzeliliby cię na miejscu.",
    "You turned Harkon down.": "Odmówiłeś Harkonowi.", "There's no way back into his court.": "Nie ma już powrotu na jego dwór.",
    "Isran won't let a vampire through his gate.": "Isran nie wpuści wampira za swoją bramę.", "Cure yourself first, then come back.": "Najpierw się wylecz, potem wróć.",
    "Only your party's leader picks a side in the vampire war.": "Tylko przywódca drużyny wybiera stronę w wojnie z wampirami.", "Wait for them to choose.": "Poczekaj, aż wybierze.",
    "Your party's leader sided with the Dawnguard.": "Przywódca drużyny stanął po stronie Straży Świtu.",
    "Your party's leader sided with Harkon's court.": "Przywódca drużyny stanął po stronie dworu Harkona.",
    "In a party you follow the leader's choice.": "W drużynie idziesz za wyborem przywódcy.",
    "No such side.": "Nie ma takiej strony.", "You've already chosen.": "Już wybrałeś.",
    "Harkon makes his offer in his own hall, at Castle Volkihar.": "Harkon składa ofertę w swojej sali, w zamku Volkihar.",
    "Give Isran your answer at Fort Dawnguard, or turn Harkon down in his hall.": "Daj Isranowi odpowiedź w Forcie Straży Świtu albo odmów Harkonowi w jego sali.",
    " You turned Harkon down and sided with the Dawnguard.": " Odmówiłeś Harkonowi i stanąłeś po stronie Straży Świtu.",
    " You accepted Harkon's offer and sided with his court.": " Przyjąłeś ofertę Harkona i stanąłeś po stronie jego dworu.",
    // ---- gifts along the way
    " Isran adds 40 steel bolts for the crossbow.": " Isran dorzuca 40 stalowych bełtów do kuszy.",
    " Harkon's blood burns through you.": " Krew Harkona pali cię od środka.", "You're a vampire now, and once a day in a fight you can take the Vampire Lord's form.": "Jesteś teraz wampirem i raz dziennie w walce możesz przybrać postać Wampirzego Lorda.",
    "Two Vampire Lord perks are ready.": "Czekają na ciebie dwa atuty Wampirzego Lorda.",
    "Gunmar keeps the troll armour for now.": "Gunmar na razie zatrzymuje zbroję dla trolla.",
    "Gunmar hands you troll armour for a follower.": "Gunmar daje ci trollową zbroję dla towarzysza.", "Give it to one from the Character tab (Follower).": "Daj ją któremuś w zakładce Postać (Towarzysz).",
    "Gunmar hands you troll armour, but your follower can't carry it.": "Gunmar daje ci trollową zbroję, ale twój towarzysz nie da rady jej unieść.", "Give it to them later.": "Daj mu ją później.",
    "Gunmar fits your follower with troll armour.": "Gunmar dopasowuje twojemu towarzyszowi trollową zbroję.", "They're wearing it now.": "Już ją nosi.",
    // ---- items
    "Dawnguard Helmet": "Hełm Straży Świtu", "Dawnguard Heavy Armor": "Ciężka zbroja Straży Świtu", "Dawnguard Gauntlets": "Rękawice Straży Świtu", "Dawnguard Boots": "Buty Straży Świtu",
    "Dawnguard Heavy Crossbow": "Ciężka kusza Straży Świtu", "Troll Armor": "Trollowa zbroja", "Dawnguard Rune Hammer": "Runiczny młot Straży Świtu",
    "Vampire Royal Armor": "Królewska zbroja wampira", "Harkon's Sword": "Miecz Harkona",
    "Gunmar's plate for an armoured troll, cut down to fit a follower.": "Płyty Gunmara dla opancerzonego trolla, przycięte na towarzysza.",
    "Fortify Health": "Wzmocnienie zdrowia", "Fortify Magicka": "Wzmocnienie magii", "Regenerate Magicka": "Regeneracja magii",
    // ---- perks
    "Vampire Hunter": "Łowca wampirów", "Sun-Blessed Plate": "Pancerz pobłogosławiony słońcem", "Troll Tamer": "Poskramiacz trolli",
    "Blood of Harkon": "Krew Harkona", "Night Lord": "Pan nocy", "Court of Volkihar": "Dwór Volkihar",
    "Dawnguard only. Bows and crossbows do 25% more damage to vampires and the undead.": "Tylko Straż Świtu. Łuki i kusze zadają wampirom i nieumarłym o 25% więcej obrażeń.",
    "Dawnguard only. In heavy armor, vampires and the undead hit you 15% softer.": "Tylko Straż Świtu. W ciężkiej zbroi wampiry i nieumarli biją cię o 15% słabiej.",
    "Dawnguard only. Gunmar's training: your follower fights 15% harder and shrugs off 10% of the blows they take.": "Tylko Straż Świtu. Szkoła Gunmara: twój towarzysz walczy o 15% mocniej i otrząsa się z 10% otrzymanych ciosów.",
    "Volkihar only. Your Vampire Lord form lasts 3 turns longer, and changing heals a tenth of your health.": "Tylko Volkihar. Postać Wampirzego Lorda trwa 3 tury dłużej, a przemiana leczy dziesiątą część zdrowia.",
    "Volkihar only. As a Vampire Lord your drain life is 30% stronger.": "Tylko Volkihar. Jako Wampirzy Lord wysysasz życie o 30% mocniej.",
    "Volkihar only. As a Vampire Lord you hit 20% harder and take 10% less damage.": "Tylko Volkihar. Jako Wampirzy Lord bijesz o 20% mocniej i obrywasz o 10% słabiej.",
    "Dawnguard only.": "Tylko Straż Świtu.", "Volkihar only.": "Tylko Volkihar.",
    "Bows and crossbows do 25% more damage to vampires and the undead.": "Łuki i kusze zadają wampirom i nieumarłym o 25% więcej obrażeń.",
    "In heavy armor, vampires and the undead hit you 15% softer.": "W ciężkiej zbroi wampiry i nieumarli biją cię o 15% słabiej.",
    "Gunmar's training: your follower fights 15% harder and shrugs off 10% of the blows they take.": "Szkoła Gunmara: twój towarzysz walczy o 15% mocniej i otrząsa się z 10% otrzymanych ciosów.",
    "Your Vampire Lord form lasts 3 turns longer, and changing heals a tenth of your health.": "Postać Wampirzego Lorda trwa 3 tury dłużej, a przemiana leczy dziesiątą część zdrowia.",
    "As a Vampire Lord your drain life is 30% stronger.": "Jako Wampirzy Lord wysysasz życie o 30% mocniej.",
    "As a Vampire Lord you hit 20% harder and take 10% less damage.": "Jako Wampirzy Lord bijesz o 20% mocniej i obrywasz o 10% słabiej.",
    "Only for those who hunt with the Dawnguard.": "Tylko dla tych, którzy polują ze Strażą Świtu.", "Only for those of Harkon's blood.": "Tylko dla tych z krwi Harkona.",
    // ---- achievements
    "Dawn Breaks": "Świt nadchodzi", "End the vampire war with the Dawnguard": "Zakończ wojnę z wampirami u boku Straży Świtu",
    "Lord of the Night": "Pan nocy", "End the vampire war at Harkon's side": "Zakończ wojnę z wampirami u boku Harkona",
  };
  for (const [k, v] of Object.entries(PL)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
  I18N_STORY.pats.push(["Harkon's blood {0}", "krew Harkona {0}"]);
  // every quest line (quests.js, ui.js): the "stage done" line in quest popups, and where to find a quest giver
  for (const [k, v] of [["They're here.", "Są tutaj."], ["Ask to join.", "Poproś, żeby cię przyjęli."]]) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
  I18N_STORY.pats.push(
    [" {0}: “{1}” done ({2}).", " {0}: „{1}” ukończone ({2})."],
    [" {0}: “{1}” done.", " {0}: „{1}” ukończone."],
    ["{9}  {0}: “{1}” done ({2}).", "{9}  {0}: „{1}” ukończone ({2})."],
    ["{9}  {0}: “{1}” done.", "{9}  {0}: „{1}” ukończone."],
    ["Find them at {0}.", "Znajdziesz ich tu: {0}."]);
  // the same line once the icon in front is split off (i18n_sweep2.js translates the rest of an icon-led line);
  // put first so the looser "{0}: {1} gold, {2}." festival line doesn't grab it
  I18N_STORY.pats.unshift(["{0}: “{1}” done ({2}).", "{0}: „{1}” ukończone ({2})."], ["{0}: “{1}” done.", "{0}: „{1}” ukończone."],
    ["“{0}” done ({1}).", "„{0}” ukończone ({1})."], ["“{0}” done.", "„{0}” ukończone."]);
})();
