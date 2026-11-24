/* i18n_partytraps.js: Polish for partytraps.js (the whole party plays each trap, results card, the traps' own stings),
   the two new perks and the patch note. Loaded before i18n.js: exact lines go in I18N_EXTRA.words, lines with names or
   numbers in I18N_EXTRA.pat, room-text sentences in I18N_STORY.pats (translated sentence by sentence). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const LABEL = { poisoned: "zatruty", "cut and bleeding": "pocięty i krwawi", burned: "poparzony", "hurt, and their purse spilled": "ranny, a sakiewka się rozsypała", "hurt, and their armour dented": "ranny, a pancerz wgnieciony", "hurt, and your purse spilled": "ranny, a sakiewka się rozsypała", "hurt, and your armour dented": "ranny, a pancerz wgnieciony" };
  Object.assign(I18N_EXTRA.words, {
    "\uE123 Trap results": "\uE123 Wyniki pułapki",
    "Trap results": "Wyniki pułapki",
    "\uE120 Got through": "\uE120 Przeszedł cało",
    "Knocked down, gets back up": "Powalony, ale wstaje",
    "\uE120 done": "\uE120 skończył",
    "… still playing": "… jeszcze gra",
    "Waiting for the rest of the party…": "Czekasz na resztę drużyny…",
    "\uE123 You got through": "\uE123 Udało ci się przejść",
    "\uE123 It caught you": "\uE123 Pułapka cię dopadła",
    "You're through untouched.": "Przechodzisz bez zadrapania.",
    "Waiting for the party": "Czekasz na drużynę",
    // perks
    "Trap Tinkerer": "Znawca pułapek",
    "You know how traps are built: dashing past blades and finding the trigger are both easier, and a trap that catches you never spills your gold or dents your armour. [OURS]":
      "Wiesz, jak buduje się pułapki: łatwiej przebiec obok ostrzy i znaleźć spust, a pułapka, która cię dopadnie, nigdy nie rozsypie twojego złota ani nie wgniecie pancerza. [OURS]",
    "Call Out the Danger": "Ostrzeż innych",
    "In a party, when you get through a trap cleanly, you shout a warning: everyone the trap still catches takes a quarter less damage and one stack less poison or bleeding. [OURS]":
      "W drużynie, gdy czysto przejdziesz przez pułapkę, krzyczysz ostrzeżenie: każdy, kogo pułapka i tak dopadnie, traci o ćwierć mniej zdrowia i dostaje o jedną warstwę trucizny lub krwawienia mniej. [OURS]",
    // patch note
    "Traps are for the whole party": "Pułapki dla całej drużyny",
    "In a party dungeon, traps are everyone's problem now: when the leader goes for \"Dash through\" or \"Find the trigger\", every hero in the party plays that trap at the same time on their own phone or PC. Same blades, same stones for everyone, sized to your own skills.":
      "W lochu z drużyną pułapka to teraz problem wszystkich: gdy przywódca wybierze „Przebiegnij” albo „Znajdź spust”, każdy bohater w drużynie gra w tę pułapkę w tym samym czasie na swoim telefonie lub PC. Te same ostrza i te same kamienie dla wszystkich, trudność według twoich umiejętności.",
    "Whoever fails takes the hit themselves, and each trap hurts in its own way: poison darts stack up poison, blades, spikes and bear traps make you bleed, fire, steam and runes burn, an oil slick spills some of your gold, and rockfalls dent your armour. Whoever gets through is fine.":
      "Kto przegra, sam obrywa, a każda pułapka rani po swojemu: zatrute strzałki nakładają truciznę, ostrza, kolce i wnyki powodują krwawienie, ogień, para i runy parzą, plama oleju rozsypuje część twojego złota, a obsunięcia skał wgniatają pancerz. Kto przejdzie, jest cały.",
    "A results card shows who got through and who got hit with what. There's a time limit: anyone who hasn't finished by then (lost the connection, put the phone away) counts as caught, and the party moves on. Followers roll by their own stats and get knocked down if caught, never killed.":
      "Karta wyników pokazuje, kto przeszedł, a kto czym oberwał. Jest limit czasu: kto do tego czasu nie skończy (stracił połączenie, odłożył telefon), liczy się jako dopadnięty, a drużyna idzie dalej. Towarzysze rzucają według własnych statystyk i gdy pułapka ich dopadnie, zostają powaleni, ale nigdy nie giną.",
    "Chests stay the leader's job: only the leader picks the lock or smashes it, and everyone else watches live. The loot still goes into the party pile for the vote at the end, and gold is split evenly. Party members now also see the lock open (or not) exactly as it did for the leader.":
      "Skrzynie to nadal zadanie przywódcy: tylko on otwiera zamek wytrychem albo rozbija skrzynię, a reszta ogląda na żywo. Łup dalej trafia do wspólnej puli na głosowanie na końcu, a złoto dzieli się po równo. Członkowie drużyny widzą teraz też, że zamek się otworzył (albo nie) dokładnie tak jak u przywódcy.",
    "When you watch another player's mini-game, you now see their pointer or finger on screen as a little arrow with their name, moving smoothly as they play.":
      "Gdy oglądasz minigrę innego gracza, widzisz teraz jego kursor albo palec jako małą strzałkę z jego imieniem, która płynnie się porusza, gdy gra.",
    "Everyone's phone sees the same thing: the same trap, the same results and the same lock outcome. If your phone drops out in the middle of a trap and comes back in time, you get to finish it.":
      "Każdy telefon widzi to samo: tę samą pułapkę, te same wyniki i ten sam wynik przy zamku. Jeśli twój telefon rozłączy się w środku pułapki i wróci na czas, możesz ją dokończyć.",
    "New perks: Trap Tinkerer (Lockpicking 40): trap games are easier, and a trap never spills your gold or dents your armour. Call Out the Danger (Sneak 40): get through a trap cleanly in a party and everyone it still catches takes a quarter less and one stack less poison or bleeding.":
      "Nowe atuty: Znawca pułapek (Otwieranie zamków 40): minigry z pułapkami są łatwiejsze, a pułapka nigdy nie rozsypie twojego złota ani nie wgniecie pancerza. Ostrzeż innych (Skradanie się 40): przejdź czysto przez pułapkę w drużynie, a każdy, kogo i tak dopadnie, oberwie o ćwierć słabiej i dostanie o jedną warstwę trucizny lub krwawienia mniej.",
  });
  I18N_EXTRA.pat.push(
    [/^(.+) \(you\)( ⚑)?$/, (m) => `${m[1]} (ty)${m[2] || ""}`],
    [/^(\S+) Caught: (.+?)( · ran out of time)?( · warned, softer)?$/, (m) => LABEL[m[2]] ? `${m[1]} Dopadnięty: ${LABEL[m[2]]}${m[3] ? " · zabrakło czasu" : ""}${m[4] ? " · ostrzeżony, lżej" : ""}` : null],
    [/^It caught you: (.+)\. You take the hit yourself\.$/, (m) => LABEL[m[1]] ? `Pułapka cię dopadła: ${LABEL[m[1]]}. Sam ponosisz skutki.` : null],
    [/^Anyone not done in (\d+)s counts as caught\.$/, (m) => `Kto nie skończy w ${m[1]} s, liczy się jako dopadnięty.`],
    [/^Time's up\. (.+) moves the party on…$/, (m) => `Czas minął. ${m[1]} prowadzi drużynę dalej…`],
    [/^\uE156 (.+) called out the danger: the others' hits were softer\.$/, (m) => `\uE156 ${m[1]} ostrzegł(a) resztę: pozostali oberwali lżej.`],
    [/^\uE123 The whole party plays this trap \((\d+) of you\)\. Fail it and it hits you\.$/, (m) => `\uE123 Cała drużyna gra w tę pułapkę (${m[1]} osób). Przegrasz, to oberwiesz.`],
    [/^(.+) gets knocked down by the trap and climbs back up, hurt\.$/, (m) => `${m[1]} zostaje powalony(-a) przez pułapkę i wstaje, ranny(-a).`],
  );
  if (typeof I18N_STORY !== "undefined" && I18N_STORY.pats) I18N_STORY.pats.push(
    ["The darts were poisoned: ×{0} (−{1} max health for 10 minutes).", "Strzałki były zatrute: ×{0} (−{1} maks. zdrowia na 10 minut)."],
    ["You're bleeding ×{0} (−{1} health, −{2} stamina for 10 minutes).", "Krwawisz ×{0} (−{1} zdrowia, −{2} wytrzymałości na 10 minut)."],
    ["The burns sting (−{0} more health).", "Oparzenia pieką (jeszcze −{0} zdrowia)."],
    ["Coins spill into the dark (−{0} gold).", "Monety sypią się w ciemność (−{0} złota)."],
    ["Your {0} takes a dent (−{1} improvement).", "Twój przedmiot ({0}) zostaje wgnieciony (−{1} ulepszenia)."],
    ["Your gear takes the blow (−{0} health).", "Twój ekwipunek przyjmuje cios (−{0} zdrowia)."],
    ["You keep a hand on your purse (Trap Tinkerer).", "Trzymasz rękę na sakiewce (Znawca pułapek)."],
    ["You roll with it and your gear comes through whole (Trap Tinkerer).", "Przetaczasz się i ekwipunek wychodzi z tego cały (Znawca pułapek)."],
  );
})();
