/* i18n_enchants2.js: Polish for the newer enchantments (enchants2.js): effect names, what each one does (tooltips and the
   arcane enchanter; {m} is the magnitude), the fight log bits, the three Enchanting perks, the unique pieces and the patch
   note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words, sentences with numbers in I18N_STORY.pats. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const WORDS = {
    // effect names
    "Chain Lightning": "Łańcuch błyskawic", Bloodthirst: "Żądza krwi", "Numbing Cold": "Paraliżujący chłód", Wildfire: "Pożoga", Dragonbane: "Zguba smoków",
    Banishing: "Odpędzenie", Thunderclap: "Grzmot", Reaping: "Żniwo", Sundering: "Skruszenie", Spellbreaker: "Łamacz zaklęć", "Echo Strike": "Cios echa", Venom: "Jad",
    Thorns: "Ciernie", "Last Ward": "Ostatnia osłona", Fortune: "Fortuna", "Mana Shield": "Tarcza many", Swiftness: "Chyżość", Dragonward: "Smocza osłona",
    Gravewarden: "Strażnik grobów", Executioner: "Kat", Huntsman: "Łowczy", Ambusher: "Zasadzka",
    "While worn.": "Gdy noszone.",
    // perks
    "Runic Enchanter": "Zaklinacz run", "Talisman Maker": "Twórca talizmanów", Overcharge: "Przeładowanie",
    "Bloodthirst, Thunderclap, Reaping, Sundering, Spellbreaker, Echo Strike, Venom, Dragonbane and Banishing enchantments are 25% stronger. [OURS]":
      "Zaklęcia Żądza krwi, Grzmot, Żniwo, Skruszenie, Łamacz zaklęć, Cios echa, Jad, Zguba smoków i Odpędzenie są o 25% silniejsze. [OURS]",
    "Thorns, Last Ward, Fortune, Mana Shield, Swiftness, Executioner, Huntsman and Ambusher enchantments are 25% stronger. [OURS]":
      "Zaklęcia Ciernie, Ostatnia osłona, Fortuna, Tarcza many, Chyżość, Kat, Łowczy i Zasadzka są o 25% silniejsze. [OURS]",
    "Your weapon's enchantment surges on 15% of its hits: that hit, its damage, healing and chances count half again as much. [OURS]":
      "Zaklęcie twojej broni wzbiera przy 15% trafień: przy takim trafieniu jego obrażenia, leczenie i szanse liczą się półtora raza. [OURS]",
    // unique pieces
    "Stormcaller's Fang": "Kieł Przywoływacza Burz", "Red Wolf's Tooth": "Ząb Czerwonego Wilka", Hearthburner: "Spopielacz", Wyrmsplitter: "Rozłupywacz Smoków",
    "Briarheart Mail": "Kolczuga Cierniowego Serca", "Ring of the Lucky Fox": "Pierścień Szczęśliwego Lisa",
    // patch note
    "22 new enchantments": "22 nowe zaklęcia",
    "Weapons can now carry Chain Lightning, Bloodthirst (crits heal you), Numbing Cold (the foe acts later and loses a move), Wildfire (a burn that keeps getting hotter), Dragonbane, Banishing (sends weak daedra home), Thunderclap, Reaping, Sundering, Spellbreaker, Echo Strike and Venom.":
      "Broń może teraz nosić Łańcuch błyskawic, Żądzę krwi (krytyki cię leczą), Paraliżujący chłód (wróg działa później i traci ruch), Pożogę (płomień, który pali coraz mocniej), Zgubę smoków, Odpędzenie (odsyła słabe daedry do domu), Grzmot, Żniwo, Skruszenie, Łamacza zaklęć, Cios echa i Jad.",
    "Armor, rings and amulets can carry Thorns, Last Ward (a shield that pops up when you're nearly down), Fortune (more gold), Mana Shield, Swiftness, Dragonward, Gravewarden, Executioner, Huntsman and Ambusher.":
      "Pancerz, pierścienie i amulety mogą nosić Ciernie, Ostatnią osłonę (tarcza, która pojawia się, gdy ledwo stoisz), Fortunę (więcej złota), Tarczę many, Chyżość, Smoczą osłonę, Strażnika grobów, Kata, Łowczego i Zasadzkę.",
    "Find them on bandits, elite foes and in court wizards' shops (the strong ones only on elite foes), break them down at an arcane enchanter to learn them, then put them on your own gear. Item tooltips now say in plain words what every enchantment does.":
      "Znajdziesz je u bandytów, elitarnych wrogów i w sklepach nadwornych magów (te silne tylko u elitarnych wrogów). Rozbij je przy tajemnym zaklinaczu, by się ich nauczyć, a potem nałóż na własny ekwipunek. Opisy przedmiotów mówią teraz prostymi słowami, co robi każde zaklęcie.",
    "Six one-of-a-kind pieces carry them too, like Stormcaller's Fang and the Ring of the Lucky Fox. Very rare drops from elite foes.":
      "Nosi je też sześć jedynych w swoim rodzaju przedmiotów, jak Kieł Przywoływacza Burz i Pierścień Szczęśliwego Lisa. Bardzo rzadko wypadają z elitarnych wrogów.",
    "Three new Enchanting perks: Runic Enchanter and Talisman Maker make the new effects 25% stronger, and Overcharge makes your weapon's enchantment surge now and then.":
      "Trzy nowe atuty Zaklinania: Zaklinacz run i Twórca talizmanów wzmacniają nowe efekty o 25%, a Przeładowanie sprawia, że zaklęcie twojej broni od czasu do czasu wzbiera.",
  };
  for (const [k, v] of Object.entries(WORDS)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;

  // what each effect does: one sentence each, {m} is the number
  const PATS = [
    ["{m} shock damage on a hit, then the bolt jumps back for half that, and 30% of the time jumps once more.", "{m} obrażeń od porażenia przy trafieniu, potem piorun przeskakuje z powrotem za połowę tego, a w 30% przypadków skacze jeszcze raz."],
    ["Critical hits heal you for {m}% of the blow, other hits for a quarter of that.", "Trafienia krytyczne leczą cię o {m}% ciosu, pozostałe trafienia o ćwierć tego."],
    ["The blade also finds a critical 10% of the time by itself.", "Ostrze samo trafia krytycznie w 10% przypadków."],
    ["{m} frost damage on a hit.", "{m} obrażeń od mrozu przy trafieniu."],
    ["A numbed foe acts later in the turn order for 2 rounds and loses one of its moves (not bosses or dragons; once every 3 rounds).", "Odrętwiały wróg przez 2 rundy działa później w kolejce i traci jeden ruch (nie bossowie ani smoki; raz na 3 rundy)."],
    ["{m} fire damage on a hit and sets them burning.", "{m} obrażeń od ognia przy trafieniu i podpala wroga."],
    ["The burn grows hotter every turn it keeps going, up to double.", "Płomień z każdą turą pali mocniej, aż do podwójnej siły."],
    ["{m} extra damage to dragons, and half that to giants, trolls and mammoths.", "{m} dodatkowych obrażeń smokom i połowa tego olbrzymom, trollom i mamutom."],
    ["{m} extra damage to daedra and atronachs.", "{m} dodatkowych obrażeń daedrom i atronachom."],
    ["A daedra (not a boss) below a fifth of its health is sent back to Oblivion.", "Daedra (nie boss) poniżej jednej piątej zdrowia zostaje odesłana do Otchłani."],
    ["{m}% chance a hit staggers them and they lose their next move (half as often on bosses and dragons; it needs a turn's rest after).", "{m}% szans, że trafienie zachwieje wrogiem i straci on następny ruch (o połowę rzadziej u bossów i smoków; potem potrzebuje tury odpoczynku)."],
    ["{m} extra damage on a hit, three times that when the foe is below a quarter of its health.", "{m} dodatkowych obrażeń przy trafieniu, trzy razy tyle, gdy wróg ma mniej niż ćwierć zdrowia."],
    ["{m} extra damage on a hit, and every hit cracks their guard a little more: up to twice that by the fifth hit.", "{m} dodatkowych obrażeń przy trafieniu, a każde trafienie coraz bardziej kruszy obronę wroga: do dwóch razy tyle przy piątym trafieniu."],
    ["{m} extra damage to mages, priests and other spellcasters, and a 25% chance to break the spell they were readying (they lose their next move).", "{m} dodatkowych obrażeń magom, kapłanom i innym czarującym oraz 25% szans na przerwanie szykowanego zaklęcia (tracą następny ruch)."],
    ["{m}% chance the blow rings out again: a second strike for half its damage.", "{m}% szans, że cios odbije się echem: drugie uderzenie za połowę obrażeń."],
    ["Poisons living foes for {m} damage a turn for 3 turns.", "Zatruwa żywych wrogów: {m} obrażeń na turę przez 3 tury."],
    ["It stacks up to 3 times, and a poisoned foe hits 10% softer.", "Kumuluje się do 3 razy, a zatruty wróg bije o 10% słabiej."],
    ["Foes that hit you in close combat take {m}% of the blow back.", "Wrogowie, którzy trafią cię w walce wręcz, dostają z powrotem {m}% ciosu."],
    ["Once a fight, when a blow drops you below a third of your health, a ward rises that soaks the next {m} damage.", "Raz na walkę, gdy cios zbije ci zdrowie poniżej jednej trzeciej, wznosi się osłona, która pochłania następne {m} obrażeń."],
    ["Foes you beat drop {m}% more gold.", "Pokonani wrogowie zostawiają o {m}% więcej złota."],
    ["{m}% of the damage you take comes out of your magicka instead, while you have magicka left.", "{m}% otrzymywanych obrażeń zabiera twoja magia zamiast zdrowia, dopóki ją masz."],
    ["+{m} initiative in turn-by-turn fights: you act sooner.", "+{m} do inicjatywy w walkach turowych: działasz wcześniej."],
    ["Dragons hurt you {m}% less, breath and bite alike.", "Smoki ranią cię o {m}% słabiej, zarówno oddechem, jak i kłami."],
    ["Draugr, skeletons, vampires and other undead hurt you {m}% less.", "Draugry, szkielety, wampiry i inni nieumarli ranią cię o {m}% słabiej."],
    ["Your weapon blows do {m}% more damage to a foe below a quarter of its health.", "Twoje ciosy bronią zadają o {m}% więcej obrażeń wrogowi poniżej ćwierci zdrowia."],
    ["Your weapon blows do {m}% more damage to beasts: wolves, bears, trolls, spiders and the like.", "Twoje ciosy bronią zadają o {m}% więcej obrażeń zwierzętom: wilkom, niedźwiedziom, trollom, pająkom i podobnym."],
    ["Your first weapon blow in a fight does {m}% more damage.", "Twój pierwszy cios bronią w walce zadaje o {m}% więcej obrażeń."],
  ];
  if (typeof I18N_STORY !== "undefined") { I18N_STORY.pats = I18N_STORY.pats || []; I18N_STORY.pats.push(...PATS); }

  // ---- fight log: bits our effects add inside an attack line ("Attack ⚡ chain lightning: 34"), and lines of their own
  const INLINE = [
    [/ ⚡ chain lightning/, " ⚡ łańcuch błyskawic"], [/, jumps twice/, ", przeskakuje dwa razy"], [/ ❄ numbed/, " ❄ odrętwienie"], [/ \+frost\b/, " +mróz"],
    [/ 🔥 wildfire/, " 🔥 pożoga"], [/ \+dragonbane/, " +zguba smoków"], [/ \+banishing/, " +odpędzenie"], [/ ✧ banished to Oblivion/, " ✧ odesłany do Otchłani"],
    [/, ⚡ thunderclap staggers/, ", ⚡ grzmot zachwiewa"], [/ \+reaping \(finishing\)/, " +żniwo (dobicie)"], [/ \+reaping/, " +żniwo"], [/ \+sunder ×(\d)/, " +skruszenie ×$1"],
    [/ \+spellbreaker/, " +łamacz zaklęć"], [/, their spell breaks/, ", zaklęcie pęka"], [/ ✦ surge/, " ✦ przypływ mocy"], [/ 🩸 drinks (\d+)/, " 🩸 pije $1"],
    [/ 🔁 echoes (\d+)/, " 🔁 echo $1"], [/ ☠ venom ×(\d)/, " ☠ jad ×$1"],
  ];
  const ANY = new RegExp(INLINE.map(([re]) => re.source).join("|"));
  const tr0 = (x) => { try { return typeof I18N !== "undefined" ? I18N.tr(x) : null; } catch (e) { return null; } };
  function inline(m) {
    let rest = m.input; const bits = [];
    for (const [re, pl] of INLINE) { const g = rest.match(re); if (g) { bits.push(g[0].replace(re, pl)); rest = rest.replace(re, ""); } }
    if (!bits.length || rest === m.input) return null;
    const base = tr0(rest) ?? rest, at = base.search(/: \d/);
    return at < 0 ? base + bits.join("") : base.slice(0, at) + bits.join("") + base.slice(at);
  }
  I18N_EXTRA.pat.push(
    [ANY, inline],
    [/^✦ (.+)$/, (m) => { const x = tr0(m[1]); return x && x !== m[1] ? `✦ ${x}` : null; }],   // tooltip lines: "✦ Thorns"
    [/^☠ venom (\d+)$/, (m) => `☠ jad ${m[1]}`],
    [/^🛡 Last Ward soaks (\d+)$/, (m) => `🛡 Ostatnia osłona pochłania ${m[1]}`],
    [/^🛡 a Last Ward rises \((\d+)\)$/, (m) => `🛡 wznosi się Ostatnia osłona (${m[1]})`],
    [/^(\d+) taken from your magicka$/, (m) => `${m[1]} pobrane z twojej magii`],
    [/^thorns (\d+)$/, (m) => `ciernie ${m[1]}`],
  );
})();
