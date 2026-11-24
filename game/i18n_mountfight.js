/* i18n_mountfight.js: Polish for mounted combat (mountfight.js): moves, the horse bar, perks, fight lines, the patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with names and numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // moves and reasons
    Mount: "Dosiądź", Dismount: "Zsiądź",
    "No horse here": "Nie ma tu konia",
    "You're on foot": "Jesteś pieszo",
    "Already in the saddle": "Już siedzisz w siodle",
    "Not enough stamina": "Za mało wytrzymałości",
    "No room to swing a two-hander that hard in the saddle": "W siodle nie ma miejsca na tak mocny zamach dwuręczną bronią",
    "You need a hand for the reins": "Jedna ręka musi trzymać wodze",
    "Too much to channel from the saddle": "Tego nie da się rzucić z siodła",
    "💫 Staggered": "💫 Oszołomiony",
    "In the saddle": "W siodle", "Knocked down": "Powalony", "Waiting nearby": "Czeka obok",
    "your horse": "twój koń",
    "Your shot goes wide (hard to aim from a moving horse)": "Strzał idzie bokiem (trudno celować z pędzącego konia)",
    // perks
    "Cavalry Charge": "Szarża Kawalerii", "Horse Archer": "Konny Łucznik", "Steady Steed": "Pewny Wierzchowiec", Trample: "Stratowanie",
    "A charge from the saddle hits 30% harder and always knocks the foe back (it loses its next move). [OURS]":
      "Szarża z siodła bije o 30% mocniej i zawsze odrzuca wroga (traci swój następny ruch). [OURS]",
    "Shooting from the saddle: your arrows never go wide from the moving horse, and they do 10% more. [OURS]":
      "Strzelanie z siodła: twoje strzały nigdy nie idą bokiem z pędzącego konia i zadają o 10% więcej. [OURS]",
    "Your horse takes 20/40% less damage in fights, foes pull you out of the saddle half as often, foot soldiers miss you 5/10% more, and getting on costs 1 AP less. [OURS]":
      "Twój koń dostaje w walce o 20/40% mniej obrażeń, wrogowie o połowę rzadziej ściągają cię z siodła, piesi żołnierze pudłują o 5/10% częściej, a dosiadanie kosztuje 1 PA mniej. [OURS]",
    "From the saddle your horse tramples small foes (wolves, skeevers, mudcrabs...): +20% more damage and a 25% chance to knock them down. [OURS]":
      "Z siodła twój koń tratuje małych wrogów (wilki, skeevery, błotne kraby...): +20% obrażeń i 25% szansy, że ich przewróci. [OURS]",
    // patch note
    "Fight from the saddle": "Walka z siodła",
    "Riding when a fight on the road starts? You now play the whole fight on horseback. Your horse has its own health bar under yours.":
      "Jedziesz konno, gdy na drodze zaczyna się walka? Teraz rozgrywasz całą walkę w siodle. Twój koń ma własny pasek zdrowia pod twoim.",
    "New Mount and Dismount moves in the fight. Getting on costs 4 AP and some stamina, and your next blow is a charge: a sure hit that does more and can knock the foe back.":
      "Nowe ruchy w walce: Dosiądź i Zsiądź. Wsiadanie kosztuje 4 PA i trochę wytrzymałości, a twój następny cios to szarża: pewne trafienie, które bije mocniej i może odrzucić wroga.",
    "Up on a horse, bandits with swords and axes have a hard time reaching you, and your horse tramples wolves, skeevers and other small beasts. But archers, mages, spearmen and big beasts go for your horse and can pull you out of the saddle.":
      "Na koniu bandyci z mieczami i toporami ledwo cię sięgają, a koń tratuje wilki, skeevery i inne małe bestie. Za to łucznicy, magowie, włócznicy i wielkie bestie celują w konia i mogą ściągnąć cię z siodła.",
    "No two-handed power attacks, no dual casting and no Master spells while riding, and arrows sometimes go wide from a moving horse. You also can't sneak up on anyone on horseback: your opening blow is the charge.":
      "W siodle nie ma potężnych ataków bronią dwuręczną, podwójnego rzucania ani zaklęć mistrzowskich, a strzały z pędzącego konia czasem idą bokiem. Na koniu nie da się też nikogo zajść po cichu: pierwszy cios to szarża.",
    "If your horse runs out of health it's knocked down, never killed: you're thrown off, take a little damage, lose 2 AP on your next turn and fight on foot. It gets back up after the fight.":
      "Gdy koniowi skończy się zdrowie, zostaje powalony, nigdy zabity: spadasz, dostajesz trochę obrażeń, tracisz 2 PA w następnej turze i walczysz pieszo. Koń wstaje po walce.",
    "Four new perks: Cavalry Charge (One-Handed), Horse Archer (Archery), Steady Steed and Trample (Athletics).":
      "Cztery nowe atuty: Szarża Kawalerii (Broń jednoręczna), Konny Łucznik (Łucznictwo), Pewny Wierzchowiec i Stratowanie (Atletyka).",
    "In a party, everyone who rides is on horseback in the fight picture, and every phone sees the same horses go down.":
      "W drużynie każdy, kto jedzie konno, siedzi w siodle na obrazku walki, a każdy telefon widzi, jak padają te same konie.",
  });
  I18N_EXTRA.pat.push(
    [/^Mounted charge ×([\d.]+)(, knocks them back)?$/, (m) => `Szarża z siodła ×${m[1]}${m[2] ? ", odrzuca wroga" : ""}`],
    [/^(Attack|Power attack) from the saddle$/, (m) => `${m[1] === "Attack" ? "Atak" : "Potężny atak"} z siodła`],
    [/^(Attack|Power attack) \(clumsy from the saddle\)$/, (m) => `${m[1] === "Attack" ? "Atak" : "Potężny atak"} (niezgrabny z siodła)`],
    [/^(Attack|Power attack) \((.+) is winded\)$/, (m) => `${m[1] === "Attack" ? "Atak" : "Potężny atak"} (${m[2]} jest zdyszany)`],
    [/^(.+), (.+) tramples them( down)?$/, (m) => `${m[1]}, ${m[2]} tratuje wroga${m[3] ? " i go przewraca" : ""}`],
    [/^You swing up onto (.+?)( \(a two-hander is clumsy up here: no power attacks\))?$/, (m) => `Wskakujesz na: ${m[1]}${m[2] ? " (broń dwuręczna jest tu niezgrabna: bez potężnych ataków)" : ""}`],
    [/^You slide down from (.+); it waits nearby$/, (m) => `Zsiadasz z: ${m[1]}; koń czeka obok`],
    [/^You can't get on (.+) now$/, (m) => `Nie możesz teraz dosiąść: ${m[1]}`],
    [/^(.+) lunges at (.+), who shies away$/, (m) => `${m[1]} rzuca się na: ${m[2]}, ale koń uskakuje`],
    [/^(.+) hits (.+) (\d+) \(horse (\d+)\/(\d+)\)$/, (m) => `${m[1]} trafia: ${m[2]} za ${m[3]} (koń ${m[4]}/${m[5]})`],
    [/^(.+) swings at (.+), but (.+) wheels away$/, (m) => `${m[1]} tnie w: ${m[2]}, ale ${m[3]} odskakuje`],
    [/^(.+) brings (.+) down! (.+) is knocked down\. (.+?)(?:'re| is) thrown clear \(−(\d+)\) and fights? on foot, staggered$/, (m) => `${m[1]} powala: ${m[2]}! ${m[4] === "You" ? "Spadasz" : m[4] + " spada"} (−${m[5]}) i ${m[4] === "You" ? "walczysz" : "walczy"} pieszo, oszołomion${m[4] === "You" ? "y" : "y"}`],
    [/^(.+?)(?:'s (?:spell|shot) knocks| swats| hooks) (.+) out of the saddle \(−(\d+)\)! (.+) fights? on foot, staggered\. (.+) waits nearby$/, (m) => `${m[1]} ściąga ${m[2] === "you" ? "cię" : m[2]} z siodła (−${m[3]})! ${m[4] === "You" ? "Walczysz" : m[4] + " walczy"} pieszo, oszołomiony. ${m[5]} czeka obok`],
    [/^🐴 (.+) gets back up after the fight, shaken \((\d+)\/(\d+)\)\. You climb back into the saddle\.$/, (m) => `🐴 ${m[1]} wstaje po walce, roztrzęsiony (${m[2]}/${m[3]}). Wsiadasz z powrotem na siodło.`],
    [/^🐎 (.+) (\d+) \/ (\d+) · (In the saddle|Knocked down|Waiting nearby)$/, (m) => `🐎 ${m[1]} ${m[2]} / ${m[3]} · ${{ "In the saddle": "W siodle", "Knocked down": "Powalony", "Waiting nearby": "Czeka obok" }[m[4]]}`],
    [/^🐴 (.+) is with you, but you're on foot\. You can get on in the fight \(Mount\), or ride to open fights with a charge\.$/, (m) => `🐴 ${m[1]} jest z tobą, ale idziesz pieszo. Możesz go dosiąść w walce (Dosiądź) albo jechać konno, żeby zaczynać walki szarżą.`],
    [/^Get down from (.+)\. On foot you can power attack with a two-hander and dual cast, and foes stop going for your horse\.$/, (m) => `Zsiądź z: ${m[1]}. Pieszo możesz robić potężne ataki bronią dwuręczną i rzucać podwójnie, a wrogowie przestają celować w konia.`],
    [/^Swing up onto (.+) \((\d+) stamina\)\. Your next blow is a charge: a sure hit that does more and can knock the foe back\. In the saddle swords and axes on foot miss you more, but archers, mages and spears can pull you down\.$/, (m) => `Wskocz na: ${m[1]} (${m[2]} wytrzymałości). Twój następny cios to szarża: pewne trafienie, które bije mocniej i może odrzucić wroga. W siodle piesi z mieczami i toporami częściej pudłują, ale łucznicy, magowie i włócznie mogą cię ściągnąć.`],
  );
})();
