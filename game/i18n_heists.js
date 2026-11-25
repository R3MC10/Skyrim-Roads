/* i18n_heists.js: Polish for heists in the big cities (heists.js), their perks and the patch note.
   Loaded after heists.js and before i18n.js; exact lines and single sentences go in I18N_STORY.ex (the screen translator
   goes sentence by sentence), lines with numbers or names in I18N_STORY.pats. House names, people, doors, prizes and
   tools come from HEISTS.plPairs(), so a new house there is covered. */
(() => {
  if (typeof I18N_STORY === "undefined") return;
  const PL = {
    // ---- the town card
    " Heist": " Skok", "Heist": "Skok", "Rob a rich house": "Okradnij bogaty dom", "Heists": "Skoki",
    "Rob a rich household: plan it, get in, grab the prize, get out.": "Okradnij bogaty dom: zaplanuj, wejdź, zgarnij łup, uciekaj.",
    "Rob a rich household: plan it, get in, past the locked door, grab the prize and get out.": "Okradnij bogaty dom: zaplanuj, wejdź, pokonaj zamknięte drzwi, zgarnij łup i uciekaj.",
    "Every way through has its price: bounty, corruption in the hold, the fence's cut.": "Każda droga ma swoją cenę: nagroda za twoją głowę, korupcja w twierdzy, dola pasera.",
    " Plan the heist": " Zaplanuj skok", " Carry on with the heist": " Kontynuuj skok",
    "Clean": "Czysto", "Caught": "Złapany", "Gold": "Złoto",
    "Taken once already.": "Raz już zabrane.", "The house hid the rest better.": "Dom lepiej ukrył resztę.",
    "Taken once already. The house hid the rest better.": "Raz już zabrane. Dom lepiej ukrył resztę.",
    "The prize.": "Łup.", "A fence pays well for it.": "Paser dobrze za to zapłaci.", "The prize. A fence pays well for it.": "Łup. Paser dobrze za to zapłaci.",
    "There's no house worth robbing here.": "Nie ma tu domu, który warto okraść.", "You have to be in town.": "Musisz być w mieście.",
    "Finish what you're doing first.": "Najpierw skończ to, co robisz.",
    "In a party your leader plans the heist.": "W drużynie skok planuje przywódca.", "Vote when they ask.": "Głosuj, gdy zapyta.",
    "In a party your leader plans the heist. Vote when they ask.": "W drużynie skok planuje przywódca. Głosuj, gdy zapyta.",
    "You're already on a heist somewhere else.": "Jesteś już w trakcie skoku gdzie indziej.",
    "The guards know your face here.": "Strażnicy znają tu twoją twarz.", "Clear your bounty first.": "Najpierw spłać nagrodę za swoją głowę.",
    "The guards know your face here. Clear your bounty first.": "Strażnicy znają tu twoją twarz. Najpierw spłać nagrodę za swoją głowę.",
    "This one is out of your league for now.": "Na razie to nie twoja liga.", "The house is still on its guard.": "Dom wciąż ma się na baczności.",
    // ---- the heist window
    "Suspicion": "Podejrzliwość", " The house is on alert!": " Dom jest w pogotowiu!", "The house is on alert!": "Dom jest w pogotowiu!",
    "Tap another choice to change your vote.": "Stuknij inny wybór, by zmienić głos.", "Most votes win; a tie goes to you.": "Wygrywa większość; przy remisie decydujesz ty.",
    "Decide now": "Zdecyduj teraz", "What do we do?": "Co robimy?",
    "Not enough gold.": "Za mało złota.", "You have no forged papers.": "Nie masz fałszywych dokumentów.",
    "You need a Draught of Shadows or the Invisibility spell.": "Potrzebujesz Wywaru cieni albo zaklęcia Niewidzialność.",
    "Only when the guards are on to you.": "Tylko gdy straż już cię ściga.", "Already tried: they're watching for that now.": "Już próbowane: teraz na to uważają.",
    // prepare
    "Case the house first": "Najpierw obejrzyj dom", "Done: you know the guards' rounds": "Zrobione: znasz obchody strażników",
    "Free": "Za darmo", "every check a little easier": "każda próba trochę łatwiejsza",
    "Buy forged papers": "Kup fałszywe dokumenty", "Buy a Draught of Shadows": "Kup Wywar cieni",
    "Go in": "Wchodzimy", "Tonight's the night": "To ta noc", "Not tonight": "Nie dziś", "Walk away, nothing lost": "Odejdź, nic nie tracisz",
    // doors
    "always works, but people may talk": "zawsze działa, ale ludzie mogą gadać", "Show forged papers": "Pokaż fałszywe dokumenty",
    "Speechcraft": "Elokwencja", "uses one set": "zużywa jeden komplet", "Slip past unseen": "Przemknij niezauważony",
    "Sneak or Illusion": "Skradanie się lub Iluzja", "drinks a Draught of Shadows": "wypija Wywar cieni", "needs the draught or the spell": "potrzebny wywar albo zaklęcie",
    "Pick the lock": "Otwórz zamek wytrychem", "Force your way in": "Wedrzyj się siłą", "Break the door down": "Wyważ drzwi",
    "Fight the house guard": "Walcz ze strażnikiem domu", "they'll know someone was here": "będą wiedzieć, że ktoś tu był",
    "Loud": "Głośno", "the whole house may hear": "cały dom może usłyszeć", "Back out": "Wycofaj się",
    "They may already have seen you": "Mogli cię już zobaczyć", "Slip away now": "Wymknij się teraz",
    // grab
    "Take only the prize": "Weź tylko łup", "Clean the place out": "Wynieś wszystko", "Much more loot, but it's loud": "Dużo więcej łupów, ale głośno",
    "Leave a false trail": "Zostaw fałszywy trop", "Less loot, but the guards will look elsewhere": "Mniej łupów, ale straż będzie szukać gdzie indziej",
    // escape
    "Walk out calmly": "Wyjdź spokojnie", "hard with the alarm up": "trudne przy podniesionym alarmie", "Over the rooftops": "Po dachach",
    "Acrobatics or Athletics": "Akrobatyka lub Atletyka", "Down through the sewers": "Przez kanały", "Sneak": "Skradanie się",
    "you'll drop some of the loot": "zgubisz część łupów", "Fight your way out": "Przebij się walką", "Fight the guards": "Walcz ze strażą",
    "only when they're on to you": "tylko gdy już cię ścigają",
    // what happens
    "You spend an hour watching the house.": "Przez godzinę obserwujesz dom.", "You know when the guards change and which window sticks.": "Wiesz, kiedy zmienia się straż i które okno się zacina.",
    "You walk away.": "Odchodzisz.", "The house will still be there tomorrow.": "Dom jutro wciąż tu będzie.",
    "They read the papers twice and wave you through.": "Czytają dokumenty dwa razy i machają, żebyś przeszedł.",
    "They squint at the seal.": "Mrużą oczy nad pieczęcią.", "Something's wrong, and they know it.": "Coś jest nie tak i oni to wiedzą.",
    "You move through the shadows like smoke.": "Przesuwasz się w cieniach jak dym.", "A floorboard creaks.": "Skrzypi deska w podłodze.", "Someone turns to look.": "Ktoś się odwraca.",
    "The lock gives with a soft click.": "Zamek ustępuje z cichym kliknięciem.", "The pick snaps.": "Wytrych pęka.", "The noise carries.": "Hałas niesie się daleko.",
    "The guard goes down.": "Strażnik pada.", "The way is open, but the house will know someone was here.": "Droga wolna, ale dom będzie wiedział, że ktoś tu był.",
    "The guard beats you down and calls for the watch.": "Strażnik powala cię i wzywa straż miejską.",
    "The door splinters open.": "Drzwi pękają w drzazgi.", "Loud, but you're in.": "Głośno, ale jesteś w środku.",
    "It takes three blows.": "Potrzeba trzech uderzeń.", "Everyone heard that.": "Wszyscy to słyszeli.",
    "The alarm goes up!": "Podniesiono alarm!", "No time to grab anything: run.": "Nie ma czasu niczego zabrać: uciekaj.",
    "You're inside.": "Jesteś w środku.", "You're in.": "Jesteś w środku.", "The prize is right there.": "Łup jest na wyciągnięcie ręki.",
    "You fill your bags with everything that shines.": "Pakujesz do toreb wszystko, co błyszczy.",
    "You take the prize and leave a false trail behind you.": "Bierzesz łup i zostawiasz za sobą fałszywy trop.",
    "Someone wakes up.": "Ktoś się budzi.",
    "You fight your way to the gate and lose them in the streets.": "Przebijasz się do bramy i gubisz ich w uliczkach.",
    "There are too many of them.": "Jest ich zbyt wielu.", "They drag you down.": "Powalają cię.",
    "You nod to the guard at the gate and stroll away.": "Kiwasz głową strażnikowi przy bramie i spokojnie odchodzisz.",
    "You run along the rooftops and drop into a dark alley.": "Biegniesz po dachach i zeskakujesz w ciemną uliczkę.",
    "You crawl out of the sewers far from the house, a little lighter.": "Wypełzasz z kanałów daleko od domu, trochę lżejszy.",
    "They corner you.": "Osaczają cię.", "Caught, almost!": "Prawie cię złapali!", "You wriggle free at the last moment.": "W ostatniej chwili się wyrywasz.",
    "You get out, but they saw you.": "Wychodzisz, ale cię widzieli.", "You slip away before anyone notices.": "Wymykasz się, zanim ktokolwiek zauważy.",
    "Caught!": "Złapany!", "The guards take the loot back and put a price on your head.": "Strażnicy odbierają łup i wyznaczają nagrodę za twoją głowę.",
    "You got away, but someone saw your face.": "Uciekłeś, ale ktoś widział twoją twarz.",
    "Clean job, but one of the people you bribed talked.": "Czysta robota, ale jeden z przekupionych się wygadał.",
    "Clean job.": "Czysta robota.", "Nobody knows it was you.": "Nikt nie wie, że to ty.", "Only a fence will buy it.": "Kupi to tylko paser.",
    "You got out with nothing.": "Wyszedłeś z niczym.",
    // the end
    " Clean getaway": " Czysta ucieczka", " Away, but seen": " Uciekłeś, ale cię widziano", " Caught": " Złapany", " Called it off": " Odwołane",
    "Clean getaway": "Czysta ucieczka", "Away, but seen": "Uciekłeś, ale cię widziano", "Called it off": "Odwołane",
    " Gold": " Złoto", "Fence's cut": "Dola pasera", "Prize": "Łup", "Bounty": "Nagroda za głowę", "Corruption": "Korupcja", "Continue": "Dalej",
    // ---- perks
    "Locksmith": "Ślusarz", "Infiltrator": "Infiltrator", "Escape Artist": "Mistrz ucieczek",
    "On a heist every lock counts one grade easier per rank, and you bring two spare picks.": "Podczas skoku każdy zamek jest o stopień łatwiejszy na każdą rangę, a ty masz dwa zapasowe wytrychy.",
    "On a heist every lock counts one grade easier per rank, and you bring two spare picks. [OURS]": "Podczas skoku każdy zamek jest o stopień łatwiejszy na każdą rangę, a ty masz dwa zapasowe wytrychy. [NASZE]",
    "On a heist: +10%/+20% to forged papers, slipping past unseen and walking out calmly, and a failed try raises less suspicion.": "Podczas skoku: +10%/+20% do fałszywych dokumentów, przemykania niezauważonym i spokojnego wyjścia, a nieudana próba budzi mniej podejrzeń.",
    "On a heist: +10%/+20% to forged papers, slipping past unseen and walking out calmly, and a failed try raises less suspicion. [OURS]": "Podczas skoku: +10%/+20% do fałszywych dokumentów, przemykania niezauważonym i spokojnego wyjścia, a nieudana próba budzi mniej podejrzeń. [NASZE]",
    "+20% to every heist escape, heist bounties are halved, and once per heist a capture turns into a narrow escape.": "+20% do każdej ucieczki ze skoku, nagrody za głowę po skoku są o połowę mniejsze, a raz na skok złapanie zmienia się w ucieczkę o włos.",
    "+20% to every heist escape, heist bounties are halved, and once per heist a capture turns into a narrow escape. [OURS]": "+20% do każdej ucieczki ze skoku, nagrody za głowę po skoku są o połowę mniejsze, a raz na skok złapanie zmienia się w ucieczkę o włos. [NASZE]",
    "On a heist the fence takes 15% less of the loot.": "Podczas skoku paser bierze o 15% mniej łupów.",
    "Merchants buy stolen goods. On a heist the fence takes 15% less of the loot.": "Kupcy kupują kradzione rzeczy. Podczas skoku paser bierze o 15% mniej łupów.",
    // ---- patch note
    "Heists in the big cities": "Skoki w wielkich miastach",
    "Every big city has a rich house to rob: Olfrid Battle-Born in Whiterun, the Shatter-Shields in Windhelm, Thane Erikur in Solitude, the Silver-Bloods in Markarth and Maven Black-Briar in Riften. Find it in town under Work & jobs.":
      "Każde wielkie miasto ma bogaty dom do okradzenia: Olfrid Battle-Born w Whiterun, Shatter-Shieldowie w Windhelm, tan Erikur w Solitude, Srebrnokrwiści w Markarth i Maven Black-Briar w Riften. Znajdziesz go w mieście w dziale Praca i zlecenia.",
    "Plan it, get in, get past the locked door, grab the prize and get out. Case the house first, and buy forged papers or a Draught of Shadows if you like.":
      "Zaplanuj, wejdź, pokonaj zamknięte drzwi, zgarnij łup i uciekaj. Najpierw obejrzyj dom i, jeśli chcesz, kup fałszywe dokumenty albo Wywar cieni.",
    "Every door can be passed five ways: a bribe always works but people may talk, forged papers need a silver tongue, going unseen needs Sneak or Illusion, the lock is the lockpicking game on a door, and force works but the house will know.":
      "Każde drzwi można pokonać na pięć sposobów: łapówka zawsze działa, ale ludzie mogą gadać, fałszywe dokumenty wymagają gadanego, przemknięcie wymaga Skradania się lub Iluzji, zamek to minigra otwierania zamków na drzwiach, a siła działa, ale dom się dowie.",
    "A failed try makes the house suspicious. Too much and the alarm goes up, and it's straight to the escape: walk out calmly, over the rooftops, through the sewers, or fight your way out.":
      "Nieudana próba budzi podejrzenia domu. Za dużo, a podniesie się alarm i od razu trzeba uciekać: spokojnie wyjść, po dachach, przez kanały albo przebić się walką.",
    "Seen or caught means a bounty in that hold, and if you're caught the guards take the loot back. Bribes, forgeries and theft make the hold more crooked, and the fence takes a cut of the goods.":
      "Gdy cię zobaczą albo złapią, dostajesz nagrodę za głowę w tej twierdzy, a po złapaniu straż odbiera łup. Łapówki, fałszerstwa i kradzieże psują twierdzę, a paser bierze dolę z towaru.",
    "In a party every step is put to a vote (most votes win, a tie goes to the leader), the gold is split evenly and the party votes on who gets the prize.":
      "W drużynie każdy krok idzie pod głosowanie (wygrywa większość, przy remisie decyduje przywódca), złoto dzieli się po równo, a drużyna głosuje, kto dostaje łup.",
    "New perks: Locksmith (Lockpicking), Infiltrator (Sneak) and Escape Artist (Acrobatics). The Fence perk now also makes the fence take less on a heist.":
      "Nowe atuty: Ślusarz (Otwieranie zamków), Infiltrator (Skradanie się) i Mistrz ucieczek (Akrobatyka). Atut Paser sprawia teraz także, że paser bierze mniej podczas skoku.",
    "Heists are off the Coming next list.": "Skoki zniknęły z listy „Wkrótce”.",
  };
  for (const [k, v] of Object.entries(PL)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
  if (typeof HEISTS !== "undefined") { for (const [en, pl] of HEISTS.plPairs()) if (!(en in I18N_STORY.ex)) I18N_STORY.ex[en] = pl; }
  I18N_STORY.pats.push(
    ["Come back at level {0}.", "Wróć na poziomie {0}."], ["Try again in {0}.", "Spróbuj ponownie za {0}."],
    ["You watch {0} from across the street.", "Obserwujesz {0} z drugiej strony ulicy."],
    ["you have {0}", "masz: {0}"], ["{0} gold", "{0} złota"], ["{0} picks", "wytrychy: {0}"],
    ["Bribe {0}", "Przekup: {0}"], ["{0} and a little coin", "{0} i trochę monet"],
    ["A man in a back alley sells you {0} for {1} gold.", "Typ w zaułku sprzedaje ci: {0} za {1} złota."],
    ["You reach {0}.", "Docierasz: {0}."], ["{0} is close by.", "Obok kręci się {0}."],
    ["{0} pockets the coin and looks the other way.", "{0} chowa monety i patrzy w inną stronę."],
    ["Ahead is {0}, and {1}.", "Przed tobą {0}, a przy nim {1}."],
    ["You pocket the {0} and leave the rest.", "Chowasz {0} i zostawiasz resztę."],
    ["You keep the {0}.", "Zatrzymujesz: {0}."],
    ["The fence takes {0}% and pays you {1} gold.", "Paser bierze {0}% i płaci ci {1} złota."],
    ["Bounty in {0}: {1} gold.", "Nagroda za głowę w {0}: {1} złota."],
    ["Corruption in {0} goes up.", "Korupcja w {0} rośnie."],
    [" Your party is voting: {0} of {1} have voted.", " Drużyna głosuje: zagłosowało {0} z {1}."],
    ["Heist: {0}.", "Skok: {0}."], ["The party picked: {0}.", "Drużyna wybrała: {0}."],
    [" {0}: {1}", " {0}: {1}"],
  );
})();
