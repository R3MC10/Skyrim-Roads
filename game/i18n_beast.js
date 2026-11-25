/* Polish for the werewolf and vampire paths (beastpaths.js): moves, why a move is greyed out, the action bar, fight
   log lines, the two night encounters, Moonblood, the sun, townsfolk, the Character tab panels and the new perks.
   Loaded before i18n.js, which merges `pl` into its word list and `pats` into its sentence patterns.
   `texts` are whole paragraphs: each is also split into sentences (the same way i18n.js splits on screen), so a
   paragraph is translated whether it shows as one piece or sentence by sentence. Keep the sentence count equal. */
const I18N_BEAST = (() => {
  // ---- moves: [icon, English name, Polish name, [[English sentence, Polish sentence], ...]] (desc as in beastpaths.js)
  const MOVES = [
    ["", "Claws", "Pazury", [["Rake the foe with your claws.", "Rozoraj wroga pazurami."]]],
    ["", "Maul", "Szarpanie", [["A savage double swipe.", "Dzikie podwójne cięcie łapami."], ["Costs stamina; can knock the foe off balance.", "Kosztuje wytrzymałość; może wytrącić wroga z równowagi."]]],
    ["", "Pounce", "Skok", [["Leap on the foe: a hard blow that can stagger it (half the time; bosses less).", "Skocz na wroga: mocny cios, który może go oszołomić (co drugi raz; bossów rzadziej)."], ["Every 3 rounds.", "Co 3 rundy."]]],
    ["", "Howl", "Wycie", [["Ordinary foes cower for 2 turns; tough ones are shaken and hit 20% softer for 3 turns.", "Zwykli wrogowie kulą się ze strachu na 2 tury; twardzi są wstrząśnięci i przez 3 tury biją o 20% słabiej."], ["Once per change.", "Raz na przemianę."]]],
    ["", "Feast", "Uczta", [["Tear into a beaten person (below 35% health) and heal from it.", "Wgryź się w pokonaną osobę (poniżej 35% zdrowia) i ulecz się."], ["Once per change.", "Raz na przemianę."]]],
    ["", "Change back", "Powrót", [["Force the wolf back down.", "Zmuś wilka, żeby się cofnął."], ["You're spent for a couple of rounds.", "Przez dwie rundy jesteś wyczerpany."]]],
    ["", "Claws", "Pazury", [["Slash with a Vampire Lord's long claws.", "Tnij długimi pazurami Wampirzego Lorda."]]],
    ["", "Drain Life", "Wyssanie życia", [["Pull the life out of the foe and into you.", "Wyciągnij życie z wroga prosto do siebie."]]],
    ["", "Vampiric Grip", "Wampirzy uścisk", [["Lift the foe by the throat: some damage and it's staggered.", "Unieś wroga za gardło: trochę obrażeń i jest oszołomiony."], ["Every 3 rounds.", "Co 3 rundy."]]],
    ["", "Raise Dead", "Wskrzeszenie", [["A corpse claws its way up to fight for you for 6 turns.", "Trup wygrzebuje się z ziemi i walczy za ciebie przez 6 tur."], ["Once per change.", "Raz na przemianę."]]],
    ["", "Change back", "Powrót", [["Fold your wings and change back.", "Złóż skrzydła i wróć do swojej postaci."]]],
    ["", "Seduction", "Uwiedzenie", [["An ordinary person or beast lowers its guard and stops fighting for 3 turns.", "Zwykła osoba lub zwierzę opuszcza gardę i przestaje walczyć na 3 tury."], ["Once a fight.", "Raz na walkę."]]],
    ["", "Embrace of Shadows", "Objęcia cieni", [["Hunger stage 3+: melt into the dark.", "Głód, stopień 3+: rozpłyń się w mroku."], ["Nothing touches you for 2 turns and your next blow is a sneak attack.", "Przez 2 tury nic cię nie dosięgnie, a twój następny cios to atak z ukrycia."], ["Once a fight.", "Raz na walkę."]]],
    ["", "Bite", "Ugryzienie", [["Sink your teeth into a beaten person (below 30% health): you feed, heal and your hunger resets.", "Zatop kły w pokonanej osobie (poniżej 30% zdrowia): pożywiasz się, leczysz i głód znika."], ["Once a fight.", "Raz na walkę."]]],
  ];
  // ---- perks: [English name, Polish name, English desc, Polish desc]
  const PERKS = [
    ["Rending Claws", "Rozdzierające pazury", "Your claws, mauls and pounces leave wounds that bleed for 3 turns.", "Twoje pazury, szarpnięcia i skoki zostawiają rany, które krwawią przez 3 tury."],
    ["Howl of the Pack", "Wycie watahy", "Howl costs half the stamina, and even tough foes cower for a turn.", "Wycie kosztuje połowę wytrzymałości, a nawet twardzi wrogowie kulą się na turę."],
    ["Silver Hide", "Srebrna skóra", "Silver weapons no longer hurt you more in Beast Form.", "Srebrna broń nie rani cię już mocniej w postaci bestii."],
    ["Endless Hunt", "Niekończące się łowy", "Beast Form lasts 3 rounds longer, and changing back no longer leaves you spent.", "Postać bestii trwa 3 rundy dłużej, a powrót do siebie już cię nie wyczerpuje."],
    ["Blood Magic", "Magia krwi", "Drain Life costs half the health and drains 20% more.", "Wyssanie życia kosztuje połowę zdrowia i wysysa o 20% więcej."],
    ["Grave Servants", "Słudzy z grobu", "Raise Dead brings up two thralls instead of one.", "Wskrzeszenie podnosi dwóch sług zamiast jednego."],
    ["Sun Ward", "Osłona przed słońcem", "The sun no longer burns you in fights, and slows your healing only half as much.", "Słońce nie pali cię już w walce, a leczenie spowalnia tylko o połowę."],
    ["Bane of the Night", "Zmora nocy", "Vampires and werewolves take 20% more from your blows and hit you 10% softer.", "Wampiry i wilkołaki dostają od ciebie o 20% więcej i biją cię o 10% słabiej."],
    ["Wolfsbane", "Tojad", "You chew wolfsbane and garlic on the road: half as likely to catch a vampire's or a werewolf's curse.", "W drodze żujesz tojad i czosnek: o połowę mniejsza szansa, że złapiesz klątwę wampira albo wilkołaka."],
  ];
  // ---- short labels, reasons, log pieces
  const pl = {
    "Beast Form": "Postać bestii", "Vampire Lord": "Wampirzy Lord", " Beast Form": " Postać bestii", " Vampire Lord": " Wampirzy Lord",
    "Once per change": "Raz na przemianę", "Once a fight": "Raz na walkę", "Ready in 1 round": "Gotowe za 1 rundę", "Ready in 2 rounds": "Gotowe za 2 rundy", "Ready in 3 rounds": "Gotowe za 3 rundy",
    "Not enough stamina": "Za mało wytrzymałości", "Not hungry enough": "Za mały głód", "Wear it down first": "Najpierw go osłab", "It won't listen": "Nie da się uwieść",
    "Not in Beast Form": "Nie w postaci bestii",
    "Where Beast Form lives": "Gdzie jest postać bestii",
    "Fixed: the werewolf card on the Character tab still sent you to the old Tactics page for Beast Form. It now says the truth: it's in the Magic menu, under Powers.":
      "Poprawka: karta wilkołaka na zakładce Postać wciąż odsyłała cię po postać bestii do starej strony Taktyki. Teraz mówi prawdę: jest w menu Magii, w Mocach.",
    // the werewolf panel on the Character tab (ui.js; Beast Form moved from the old Tactics page to the Magic menu)
    "Beast Form, once a day, is in your Magic menu under Powers: for 10 turns you hit much harder, take less damage and heal a bit, but can't drink potions. Win a fight in Beast Form against a person and you feed: it heals you and grows your werewolf perks. Beds no longer make you Rested, and you can't catch diseases.":
      "Postać bestii, raz dziennie, znajdziesz w menu Magii, w Mocach: przez 10 tur bijesz dużo mocniej, dostajesz mniej obrażeń i trochę się leczysz, ale nie możesz pić mikstur. Wygraj walkę w postaci bestii z człowiekiem, a pożywisz się: to cię leczy i rozwija twoje atuty wilkołaka. Łóżka nie dają już premii Wypoczęty i nie łapiesz chorób.",
    // the action bar's other "why it's greyed out" lines (fightctl.js)
    "Not from a boss": "Nie przed bossem", "No way out here": "Stąd nie ma ucieczki", "Not with a bow": "Nie z łukiem", "None left": "Nic nie zostało", "Not ready yet": "Jeszcze niegotowe",
    "Beast Form moves": "Ruchy postaci bestii", "Vampire Lord moves": "Ruchy Wampirzego Lorda",
    // log pieces (numbers on the fight log are drawn separately, so the words around them are their own pieces)
    "Claws:": "Pazury:", "Maul:": "Szarpanie:", "Pounce:": "Skok:", "Feast:": "Uczta:", "Drain Life:": "Wyssanie życia:", "Vampiric Grip:": "Wampirzy uścisk:", "Bite:": "Ugryzienie:",
    "Claws misses": "Pazury chybiają", "Maul misses": "Szarpanie chybia", "Pounce misses": "Skok chybia", "Feast misses": "Uczta chybia",
    ", it bleeds": ", krwawi", "it bleeds": "krwawi", ", staggers": ", oszołomiony", "staggers": "oszołomiony", ", staggers, it bleeds": ", oszołomiony, krwawi",
    "· you feed on it (": "· pożywiasz się (", "you feed on it (": "pożywiasz się (", "health)": "zdrowia)", "(+": "(+",
    "health) · you feed, your hunger fades": "zdrowia) · pożywiasz się, głód znika", "you feed, your hunger fades": "pożywiasz się, głód znika",
    "Howl: the foe cowers": "Wycie: wróg kuli się ze strachu", "Howl: the foe is shaken and cowers": "Wycie: wróg jest wstrząśnięty i kuli się",
    "Howl: the foe is shaken (hits 20% softer)": "Wycie: wróg jest wstrząśnięty (bije o 20% słabiej)",
    "You force the wolf back down and change back": "Zmuszasz wilka, żeby się cofnął, i wracasz do siebie", "You fold your wings and change back": "Składasz skrzydła i wracasz do swojej postaci",
    "Raise Dead: a corpse claws its way up to fight for you": "Wskrzeszenie: trup wygrzebuje się z ziemi, żeby walczyć za ciebie",
    "Raise Dead: two corpses claw their way up to fight for you": "Wskrzeszenie: dwa trupy wygrzebują się z ziemi, żeby walczyć za ciebie",
    "Embrace of Shadows: you melt into the dark": "Objęcia cieni: rozpływasz się w mroku",
    "You throw your head back and howl: Beast Form!": "Odrzucasz głowę i wyjesz: postać bestii!", "Your skin splits and great wings unfold: Vampire Lord!": "Skóra pęka i rozkładają się wielkie skrzydła: Wampirzy Lord!",
    "townsfolk scream and scatter": "mieszkańcy krzyczą i uciekają", "· townsfolk scream and scatter": "· mieszkańcy krzyczą i uciekają",
    "you're spent": "jesteś wyczerpany", "· you're spent": "· jesteś wyczerpany", "the sun burns you": "słońce cię pali", "· the sun burns you": "· słońce cię pali",
    "Risen thrall": "Wskrzeszony sługa", "Werewolf": "Wilkołak", "Vampire of the Ashen Court": "Wampir z Popielnego Dworu",
    // the two encounters
    "A howl under the moon": "Wycie pod księżycem", "The Ashen Court": "Popielny Dwór",
    " Howl back": " Odpowiedz wyciem", " Fight it for the hunt": " Walcz o zdobycz", "Walk on": "Idź dalej", " Stand and fight": " Stań i walcz", "Run for the road": "Uciekaj na drogę",
    " Answer the insult": " Odpowiedz na zniewagę", "Let them go": "Puść ich", " Accept the gift": " Przyjmij dar", "Refuse politely": "Grzecznie odmów", " Draw steel": " Dobądź broni",
    // Character tab
    " Beast Form moves and drawbacks": " Ruchy i słabości postaci bestii", " Hunger, powers and the Vampire Lord's moves": " Głód, moce i ruchy Wampirzego Lorda",
    "Powers in a fight (not while changed):": "Moce w walce (gdy nie jesteś przemieniony):", " Moonblood": " Księżycowa krew", "Moonblood": "Księżycowa krew",
    "Stage 1": "Stopień 1", "Stage 2": "Stopień 2", "Stage 3": "Stopień 3", "Stage 4": "Stopień 4",
    "Stage 1 (now)": "Stopień 1 (teraz)", "Stage 2 (now)": "Stopień 2 (teraz)", "Stage 3 (now)": "Stopień 3 (teraz)", "Stage 4 (now)": "Stopień 4 (teraz)",
  };
  for (let n = 1; n <= 16; n++) {
    const r = n === 1 ? "runda" : n % 10 >= 2 && n % 10 <= 4 && (n < 10 || n > 20) ? "rundy" : "rund";
    pl[`${n} round${n === 1 ? "" : "s"} left`] = `zostało: ${n} ${r}`;
    pl[` Beast Form · ${n} round${n === 1 ? "" : "s"} left`] = ` Postać bestii · zostało: ${n} ${r}`;
    pl[` Vampire Lord · ${n} round${n === 1 ? "" : "s"} left`] = ` Wampirzy Lord · zostało: ${n} ${r}`;
  }
  // ---- whole paragraphs [English, Polish]
  const texts = [
    // encounters
    ["A howl rolls over the trees, and the blood in you answers. Something big is hunting nearby, and it smells you too.", "Nad drzewami niesie się wycie, a krew w tobie odpowiada. W pobliżu poluje coś wielkiego i też cię wyczuwa."],
    ["A howl rolls over the trees, far too close. Branches snap. Something on two legs is running towards you, and it isn't a man any more.", "Nad drzewami niesie się wycie, o wiele za blisko. Trzaskają gałęzie. Coś na dwóch nogach biegnie w twoją stronę i to już nie jest człowiek."],
    ["It bursts out of the dark, all teeth and claws.", "Wypada z ciemności, same kły i pazury."],
    ["You press flat in the ferns. It sniffs the air a long while, then lopes off after a deer.", "Przywierasz płasko do paproci. Długo węszy, a potem rusza w pogoń za jeleniem."],
    ["It smells you. It's on you before you can stand.", "Wyczuwa cię. Jest przy tobie, zanim zdążysz wstać."],
    ["You howl back. A great grey werewolf steps out, sniffs you and lets you share its kill. (You feed: health restored, +1 toward werewolf perks.)", "Odpowiadasz wyciem. Wychodzi wielki szary wilkołak, obwąchuje cię i dzieli się z tobą zdobyczą. (Pożywiasz się: zdrowie odnowione, +1 do atutów wilkołaka.)"],
    ["The werewolf shrinks back into a naked, dead man.", "Wilkołak kurczy się z powrotem w nagiego, martwego człowieka."],
    ["A hunched shape on two legs, eyes like lamps. It howls, and the forest goes quiet.", "Zgarbiona postać na dwóch nogach, oczy jak latarnie. Wyje, a las cichnie."],
    ["A black carriage stops beside you. A pale noble wrinkles their nose. \"Dog. The Ashen Court has no use for your kind.\"", "Obok ciebie zatrzymuje się czarny powóz. Blady szlachcic marszczy nos. \"Psie. Popielny Dwór nie ma pożytku z takich jak ty.\""],
    ["A black carriage with drawn curtains stops beside you. A pale noble leans out, eyes red as embers. \"You fight well. The Ashen Court could use someone like you. Take the gift, and the night is yours forever.\"", "Obok ciebie zatrzymuje się czarny powóz z zasuniętymi zasłonami. Wychyla się blady szlachcic o oczach czerwonych jak żar. \"Dobrze walczysz. Popielnemu Dworowi przydałby się ktoś taki jak ty. Przyjmij dar, a noc będzie twoja na zawsze.\""],
    ["\"Your blood is already spoken for.\" The carriage rolls on.", "\"Twoja krew ma już właściciela.\" Powóz odjeżdża."],
    ["You climb in. Cold lips at your throat, a sting, then nothing. You wake by the roadside at dusk, starving and strong. You are a vampire now, and the Court gave you a taste of being a Vampire Lord (a perk point). See the Hero tab.", "Wsiadasz. Zimne usta na twoim gardle, ukłucie, potem nic. Budzisz się o zmierzchu przy drodze, głodny i silny. Jesteś teraz wampirem, a Dwór dał ci posmak bycia Wampirzym Lordem (punkt atutu). Zajrzyj do zakładki Bohater."],
    ["\"A pity.\" The curtain falls. \"The Court is patient. We'll ask again.\"", "\"Szkoda.\" Zasłona opada. \"Dwór jest cierpliwy. Zapytamy jeszcze raz.\""],
    ["The noble steps down, smiling, and the coachman draws a curved blade.", "Szlachcic wysiada z uśmiechem, a woźnica dobywa zakrzywionego ostrza."],
    ["The noble's smile shows every tooth. Shadows pour out of the carriage.", "Uśmiech szlachcica odsłania wszystkie zęby. Z powozu wylewają się cienie."],
    // Moonblood, the change, the cure, shops
    [" The werewolf's bite burns and won't close. (Moonblood: cure it within 3 in-game days with a Cure Disease potion or at a shrine, or you'll change at the next moon.)", " Ugryzienie wilkołaka pali i nie chce się zamknąć. (Księżycowa krew: wylecz ją w ciągu 3 dni w grze miksturą leczenia chorób albo w kapliczce, inaczej przemienisz się przy następnej pełni.)"],
    [" The moon pulls at your bones. You wake in the woods with blood on your hands: you are a werewolf now. Beast Form is in your fights, once a day. See the Hero tab.", " Księżyc szarpie twoje kości. Budzisz się w lesie z krwią na rękach: jesteś teraz wilkołakiem. Postać bestii masz w walkach raz dziennie. Zajrzyj do zakładki Bohater."],
    ["The fever of the bite breaks. The moon has no hold on you.", "Gorączka po ugryzieniu mija. Księżyc nie ma nad tobą władzy."],
    ["The merchant takes one look at your sunken face and bars the door. (Hunger stage 4: feed at an inn first.)", "Kupiec raz spogląda na twoją zapadniętą twarz i zamyka drzwi na rygiel. (Głód, stopień 4: najpierw się pożyw w karczmie.)"],
    ["A werewolf's bite that won't heal.", "Ugryzienie wilkołaka, które nie chce się zagoić."],
    ["Drink a Potion of Cure Disease or pray at a roadside shrine to stop it, or let the moon have you.", "Wypij miksturę leczenia chorób albo pomódl się w przydrożnej kapliczce, żeby to zatrzymać, albo oddaj się księżycowi."],
    // townsfolk
    ["Your eyes... are you feeling alright?", "Twoje oczy... dobrze się czujesz?"], ["Stay out of the sun much? You look pale.", "Mało bywasz na słońcu? Jesteś blady."],
    ["You look half-starved, friend. Eat something.", "Wyglądasz na zagłodzonego, przyjacielu. Zjedz coś."], ["Gods, your skin's like milk. Are you sick?", "Bogowie, skóra jak mleko. Chory jesteś?"],
    ["Keep away from me. Your eyes are... wrong.", "Trzymaj się ode mnie z daleka. Twoje oczy są... dziwne."], ["Guards! There's something wrong with that one!", "Straż! Z tym tu jest coś nie tak!"],
    ["Why are you staring at my neck?", "Czemu gapisz się na moją szyję?"], ["Monster! Get away! Get away!", "Potwór! Precz! Precz!"],
    ["Stendarr protect me, it's one of them!", "Stendarrze, chroń mnie, to jeden z nich!"], ["Lock the doors, the pale thing is back!", "Zamykać drzwi, ten blady wrócił!"],
    ["Did you see it? A beast, right here in the street!", "Widziałeś? Bestia, tu, na ulicy!"], ["They say a wolf on two legs was seen in town. I'm sleeping with an axe.", "Mówią, że w mieście widziano wilka na dwóch nogach. Śpię z siekierą."],
    ["Keep your dogs inside tonight.", "Trzymajcie dziś psy w domu."],
    // Character tab
    ["In a turn-by-turn fight your hands are claws while you're changed. No spells, scrolls, shouts, potions or guard.", "W walce turowej, gdy jesteś przemieniony, twoje dłonie to pazury. Żadnych zaklęć, zwojów, okrzyków, mikstur ani gardy."],
    [" Silver (the Silver Hand, Vigilants, Dawnguard) hits you 30% harder in Beast Form. When the beast lets go you're spent for 2 rounds: weaker blows and little stamina.", " Srebro (Srebrna Dłoń, Czujni, Straż Świtu) rani cię w postaci bestii o 30% mocniej. Kiedy bestia odpuszcza, przez 2 rundy jesteś wyczerpany: słabsze ciosy i mało wytrzymałości."],
    ["Your blood came from a wild werewolf's bite, not the Circle, but the cure is the same.", "Twoja krew pochodzi z ugryzienia dzikiego wilkołaka, nie od Kręgu, ale lekarstwo jest to samo."],
    ["Shops there charge more until the talk dies down (a day).", "Sklepy tam liczą drożej, dopóki gadanie nie ucichnie (dzień)."],
    ["Barely hungry. People say you look pale.", "Ledwie głodny. Ludzie mówią, że jesteś blady."],
    ["Hungry. The sun burns 3% of your health a round in daytime fights outdoors.", "Głodny. W dziennych walkach pod gołym niebem słońce zabiera ci 3% zdrowia na rundę."],
    ["Ravenous. Shops charge 15% more. Embrace of Shadows wakes up. The sun burns 4.5% a round.", "Wygłodniały. Sklepy liczą 15% drożej. Budzą się Objęcia cieni. Słońce pali 4,5% na rundę."],
    ["Starving. Shops bar the door, townsfolk panic. In daylight your blows are 10% weaker and the sun burns 6% a round.", "Zagłodzony. Sklepy zamykają drzwi, mieszkańcy panikują. Za dnia twoje ciosy są o 10% słabsze, a słońce pali 6% na rundę."],
    ["As a Vampire Lord your hands are claws; no spells, scrolls, shouts or potions. Silver hits you 25% harder.", "Jako Wampirzy Lord masz pazury zamiast dłoni; żadnych zaklęć, zwojów, okrzyków ani mikstur. Srebro rani cię o 25% mocniej."],
  ];
  // ---- sentence patterns [English with {markers}, Polish]
  const pats = [
    ["Seduction: the {0} lowers its guard", "Uwiedzenie: {0} opuszcza gardę"],
    [" Hide in the brush ({0})", " Schowaj się w zaroślach ({0})"],
    ["You take 2 {0}.", "Zabierasz: {0} ×2."],
    ["In the carriage: {0} gold and a Potion of Cure Disease, kept for the servants.", "W powozie: {0} złota i mikstura leczenia chorób, trzymana dla służby."],
    ["In the carriage: {0} gold.", "W powozie: {0} złota."],
    ["In about {0} min ({1} in-game days) you'll change for the first time and be a werewolf for good.", "Za około {0} min ({1} dni w grze) przemienisz się po raz pierwszy i zostaniesz wilkołakiem na dobre."],
    [" People saw you change in {0}.", " Ludzie widzieli twoją przemianę w: {0}."],
    ["Need {0} more stamina", "Brakuje {0} wytrzymałości"], ["Need {0} more magicka", "Brakuje {0} magii"],
  ];
  // the moves and perks: name, icon + name, every sentence, and the fight screen tip's first sentence ("Claws: Rake the foe...")
  for (const [ic, en, p, sents] of MOVES) {
    pl[en] = p; pl[`${ic} ${en}`] = `${ic} ${p}`; pl[`${en}:`] = `${p}:`;
    for (const [a, b] of sents) pl[a] = b;
    pl[`${en}: ${sents[0][0]}`] = `${p}: ${sents[0][1]}`;
    texts.push([sents.map((x) => x[0]).join(" "), sents.map((x) => x[1]).join(" ")]);
  }
  for (const [en, p, d, dp] of PERKS) { pl[en] = p; pl[d] = dp; pl[d + " [OURS]"] = dp; }
  // paragraphs: whole, and sentence by sentence (the same split as i18n.js)
  const SPLIT = /(?<=[.!?…])(\s+)|(?<=[.!?]["”])(\s+)/;
  const sent = (t) => t.split(SPLIT).filter((x) => x !== undefined && x.trim());
  const bad = [];
  for (const [en, p] of texts) {
    pl[en] = p;
    const a = sent(en), b = sent(p);
    if (a.length === b.length) a.forEach((x, i) => { if (!(x in pl)) pl[x] = b[i]; });
    else bad.push(en);
  }
  return { pl, pats, texts, MOVES, PERKS, bad };
})();
