/* i18n_sweep.js: Polish for English that still slipped through: words drawn on canvas (fight picture labels, minigames,
   map labels), toasts, foe and spell names, and the fight log lines ("Skeever hits 4", "Staff of Flames: Flames: 10").
   Loaded after the other i18n_*.js add-ons and right before i18n.js: exact lines go in I18N_EXTRA.words (merged into
   I18N.PL), number lines in I18N_EXTRA.pat. Canvas code calls I18N_SWEEP.c(text), which gives the Polish when the game
   is in Polish and the English otherwise (or when the line isn't known). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
const I18N_SWEEP = (() => {
  // ---------------------------------------------------------------- exact lines
  const WORDS = {
    // the fight picture (fightart.js)
    You: "Ty", "They flee": "Uciekają", Miss: "Pudło", "Block!": "Blok!", CRITICAL: "CIOS KRYTYCZNY", Opponent: "Przeciwnik",
    // foes
    Mudcrab: "Błotny krab", "Lone wolf": "Samotny wilk", "Hidden satchel": "Ukryta torba", Courier: "Kurier", "Traveling bard": "Wędrowny bard",
    "Wolf pack": "Wataha wilków", "Bandit outlaw": "Banita", "Sabre cat": "Tygrys szablozębny", "Black bear": "Czarny niedźwiedź",
    "Frostbite spider": "Mroźny pająk", "Forsworn ambush": "Zasadzka Wiarołomców", Skeleton: "Szkielet", Vampire: "Wampir",
    "Frost troll": "Mroźny troll", "Thalmor patrol": "Patrol Thalmoru", Giant: "Olbrzym", Dragon: "Smok",
    // spells
    Frostbite: "Odmrożenie", Sparks: "Iskry", Firebolt: "Ognisty pocisk", "Lightning Bolt": "Błyskawica", Fireball: "Kula ognia",
    "Sun Fire": "Słoneczny ogień", "Fast Healing": "Szybkie leczenie", Oakflesh: "Dębowa skóra", "Conjure Familiar": "Przyzwanie chowańca",
    Fury: "Furia", Calm: "Uspokojenie", "Frost Cloak": "Płaszcz mrozu", "Flame Cloak": "Płaszcz ognia", "Lightning Cloak": "Płaszcz błyskawic",
    "Wall of Storms": "Ściana burz", "Lesser Ward": "Słaba osłona", "Fire Rune": "Runa ognia", "Conjure Flame Atronach": "Przyzwanie ognistego atronacha",
    Incinerate: "Spopielenie", "Stendarr's Aura": "Aura Stendarra", "Turn Undead": "Odpędzenie nieumarłych", "Raise Zombie": "Wskrzeszenie zombie",
    Rout: "Rozgromienie", Dispel: "Rozproszenie", Courage: "Odwaga", Paralyze: "Paraliż", Candlelight: "Światło świecy",
    "Ice Storm": "Lodowa burza", "Icy Spear": "Lodowa włócznia", Thunderbolt: "Grom", "Close Wounds": "Zamknięcie ran", Stoneflesh: "Kamienna skóra",
    Ironflesh: "Żelazna skóra", Ebonyflesh: "Hebanowa skóra", "Conjure Frost Atronach": "Przyzwanie mroźnego atronacha",
    "Conjure Storm Atronach": "Przyzwanie burzowego atronacha", Pacify: "Ułagodzenie", "Frost Rune": "Runa mrozu", "Lightning Rune": "Runa błyskawic",
    "Wall of Flames": "Ściana ognia", "Wall of Frost": "Ściana mrozu", "Fire Storm": "Burza ognia", Blizzard: "Zamieć", "Lightning Storm": "Burza piorunów",
    "Steadfast Ward": "Niezłomna osłona", "Greater Ward": "Większa osłona", "Turn Lesser Undead": "Odpędzenie słabszych nieumarłych",
    "Repel Undead": "Odparcie nieumarłych", "Grand Healing": "Wielkie leczenie", "Guardian Circle": "Krąg strażnika",
    "Transmute Mineral Ore": "Transmutacja rudy", "Mass Paralysis": "Masowy paraliż", Dragonhide: "Smocza skóra", "Bound Sword": "Magiczny miecz",
    "Bound Battleaxe": "Magiczny topór bojowy", "Bound Bow": "Magiczny łuk", "Reanimate Corpse": "Ożywienie zwłok", Revenant: "Upiór",
    "Dread Zombie": "Straszliwy zombie", "Dead Thrall": "Martwy sługa", "Conjure Dremora Lord": "Przyzwanie władcy dremora", "Soul Trap": "Pułapka dusz",
    "Detect Life": "Wykrycie życia", Mark: "Znak", Recall: "Powrót", "Spell Absorption": "Pochłanianie zaklęć", Clairvoyance: "Jasnowidzenie",
    Muffle: "Wyciszenie", Fear: "Strach", Invisibility: "Niewidzialność", Hysteria: "Histeria", Harmony: "Harmonia",
    // staves
    "Staff of Calming": "Kostur uspokojenia", "Staff of Courage": "Kostur odwagi", "Staff of Fireballs": "Kostur kul ognia",
    "Staff of Firebolts": "Kostur ognistych pocisków", "Staff of Flames": "Kostur płomieni", "Staff of Frostbite": "Kostur odmrożeń",
    "Staff of Ice Spikes": "Kostur lodowych kolców", "Staff of Lightning Bolts": "Kostur błyskawic", "Staff of Paralysis": "Kostur paraliżu",
    "Staff of Sparks": "Kostur iskier", "Staff of Turn Undead": "Kostur odpędzania nieumarłych", "Staff of Zombies": "Kostur zombie",
    // the fight log
    "Raises guard": "Unosisz gardę", "Bashes with the bow (no arrows)": "Uderzasz łukiem (brak strzał)",
    "Bashes with the bow (no bolts)": "Uderzasz kuszą (brak bełtów)", "Candlelight does nothing in a fight": "Światło świecy nic nie daje w walce",
    "Healing isn't keeping up — you press the attack": "Leczenie nie nadąża, więc przechodzisz do ataku",
    "You have no healing potions!": "Nie masz mikstur leczniczych!",
    "no effect (undead only)": "bez efektu (działa tylko na nieumarłych)", "no effect (level too high)": "bez efektu (za wysoki poziom)",
    "no effect on the undead": "nie działa na nieumarłych", "it stops fighting": "przestaje walczyć", "it resists": "opiera się",
    "you feel bold": "czujesz przypływ odwagi", "when it falls, it will rise for you": "gdy padnie, powstanie i będzie walczyć dla ciebie",
    "a flame atronach appears": "pojawia się ognisty atronach", "frost wrap around you": "mróz owija się wokół ciebie",
    "the ground crackles": "ziemia trzeszczy", "a glowing rune waits on the ground": "na ziemi czeka świecąca runa",
    // minigames and pictures drawn on canvas
    CLEARED: "OCZYSZCZONE", "CRACK!": "TRZASK!", thud: "łup", clang: "brzdęk", Noticed: "Wykrycie", "Now: Right": "Teraz: w prawo",
    "Now: Left": "Teraz: w lewo", "Left or Right": "W lewo czy w prawo?", "Unbreakable pick": "Niezniszczalny wytrych", Aim: "Celuj",
    "Sea of Ghosts": "Morze Duchów", "TO WINDHELM ": "DO WINDHELMU ", "Khajiit market": "Targ Khajiitów",
    // toasts
    "Someone else moved first.": "Ktoś inny był szybszy.",
    "Run open. Invite your friends, then go in together.": "Wyprawa otwarta. Zaproś znajomych i wejdźcie razem.",
    "That run is full or over.": "Ta wyprawa jest już pełna albo się skończyła.", "You left the run.": "Opuszczasz wyprawę.",
    "Nothing left for you in there.": "Nic tam już dla ciebie nie zostało.", "You've moved on from the door.": "Odchodzisz od drzwi.",
    "Give them a moment.": "Daj im chwilę.", "Ready check cancelled.": "Sprawdzanie gotowości odwołane.",
    "The strongbox is empty for now.": "Skrzynia jest na razie pusta.",
    " A party chest is waiting. Open  Social → Party.": " Czeka skrzynia drużyny. Otwórz  Społeczność → Drużyna.",
    " You're invited to join a clan. Open  Social → Realm.": " Masz zaproszenie do klanu. Otwórz  Społeczność → Królestwo.",
    "Only your party's leader can stop for a caravan.": "Przy karawanie może się zatrzymać tylko przywódca drużyny.",
    "Your bag is gone.": "Twojej torby już nie ma.", "That pin is gone.": "Tego znacznika już nie ma.",
    "In a party only the leader decides. Their choice happens to you too.": "W drużynie decyduje tylko przywódca. Jego wybór dotyczy też ciebie.",
    "The dragon is gone.": "Smoka już nie ma.",
    "Someone bought it first.": "Ktoś kupił to przed tobą.", "You don't have a hall.": "Nie masz siedziby.", "Your clan has no hall.": "Twój klan nie ma siedziby.",
    "Someone else is changing the hall. Try again.": "Ktoś inny właśnie zmienia siedzibę. Spróbuj jeszcze raz.",
    "They don't have a house here.": "Ta osoba nie ma tu domu.", "You can't afford that.": "Nie stać cię na to.", "That offer is gone.": "Ta oferta już przepadła.",
    "You're offline. Go online to send messages.": "Jesteś offline. Połącz się, żeby wysyłać wiadomości.",
    "You turn the challenge down.": "Odrzucasz wyzwanie.", "Only your party leader can invite.": "Zapraszać może tylko przywódca drużyny.",
    "You left the party.": "Opuszczasz drużynę.", "Too late. Somebody got there first.": "Za późno. Ktoś był pierwszy.",
    "The driver won't stop until you get there.": "Woźnica nie stanie, dopóki nie dojedziesz na miejsce.",
    "You're at sea. The Northern Maiden won't turn back now.": "Jesteś na morzu. Northern Maiden już nie zawróci.",
    "You stop and look around.": "Zatrzymujesz się i rozglądasz.", "They're gone.": "Tej osoby już nie ma.", "Everyone is unmuted.": "Wszyscy znów mogą mówić.",
    "Invitation sent.": "Zaproszenie wysłane.", "They're no longer in the clan.": "Ta osoba nie jest już w klanie.",
    "You can open the guide any time from  or the Journal.": "Poradnik otworzysz w każdej chwili z  albo z Dziennika.",
    "Shared with your party in the chat.": "Udostępnione drużynie na czacie.", "That gift is gone.": "Tego prezentu już nie ma.",
    "Nothing to claim there.": "Nie ma tu nic do odebrania.", "Too late. Someone took it.": "Za późno. Ktoś to zabrał.",
    "They're not around.": "Tej osoby nie ma w pobliżu.", 
  };

  // ---------------------------------------------------------------- lines with names and numbers in them
  const tr0 = (x) => { try { return typeof I18N !== "undefined" ? I18N.tr(x) : null; } catch (e) { return null; } };   // null when unknown
  const W = (x) => tr0(x) ?? x;   // a name: Polish if known, else as it is (player names stay)
  const lc1 = (x) => x.charAt(0).toLowerCase() + x.slice(1), up1 = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  const the = (x) => lc1(W(up1(x)));   // "the black bear" → "czarny niedźwiedź"
  const PAT = [
    [/^⚑ (\d+) of your party with you$/, (m) => `⚑ ${m[1]} z drużyny z tobą`],
    [/^⚑ (\d+) allies with you$/, (m) => `⚑ sojusznicy z tobą: ${m[1]}`],
    [/^SNEAK ATTACK ×(\d+)$/, (m) => `ATAK Z UKRYCIA ×${m[1]}`],
    [/^Sneak attack ×(\d+)$/, (m) => `Atak z ukrycia ×${m[1]}`],
    [/^Season of (.+)$/, (m) => `Sezon: ${W(m[1])}`],
    [/^Hits (\d+)$/, (m) => `Trafienia: ${m[1]}`], [/^Swings left (\d+)$/, (m) => `Zostało zamachów: ${m[1]}`],
    [/^Wrong guesses left: (\d+)$/, (m) => `Pomyłki do wykorzystania: ${m[1]}`], [/^Found (\d+)\/(\d+)$/, (m) => `Znaleziono ${m[1]}/${m[2]}`],
    [/^Picks left: (.+)$/, (m) => `Wytrychy: ${m[1]}`],
    // fight log
    [/^([^·:]+?)(, staggers)?: (\d+)$/, (m) => { const a = tr0(m[1]); return a == null ? null : `${a}${m[2] ? ", zachwianie" : ""}: ${m[3]}`; }],
    [/^([^·]+?) hits (\d+)(?: \(blocked (\d+)%\))?$/, (m) => `${W(m[1])} trafia: ${m[2]}${m[3] ? ` (zablokowano ${m[3]}%)` : ""}`],
    [/^([^·]+?) misses$/, (m) => `${W(m[1])}: pudło`],
    [/^([^·]+?) is paralyzed$/, (m) => `${W(m[1])} nie może się ruszyć`],
    [/^([^·]+?) is staggered$/, (m) => `${W(m[1])} traci równowagę`],
    [/^([^·]+?) isn't fighting$/, (m) => `${W(m[1])} nie walczy`],
    [/^([^·]+?) cowers in fear$/, (m) => `${W(m[1])} kuli się ze strachu`],
    [/^the ([^·]+?) cowers$/, (m) => `${the(m[1])} kuli się ze strachu`],
    [/^the ([^·]+?) freezes, paralyzed$/, (m) => `${the(m[1])} zastyga w bezruchu`],
    [/^([^·]+?) steps on your Fire Rune \((\d+)\)$/, (m) => `${W(m[1])} wchodzi na twoją Runę ognia (${m[2]})`],
    [/^([^·]+?) fizzles \(too advanced for you yet\)$/, (m) => `${W(m[1])} nie wychodzi (na razie za trudne)`],
    [/^Drinks ([^·]+)$/, (m) => `Pijesz: ${W(m[1])}`],
    [/^([^·]+?) does nothing in a fight$/, (m) => `${W(m[1])} nic nie daje w walce`],
    [/^The staff is spent\. You swing it \((\d+)\)$/, (m) => `Kostur jest wyczerpany. Wymachujesz nim (${m[1]})`],
    [/^\+(\d+) health$/, (m) => `+${m[1]} zdrowia`],
    [/^familiar (\d+)$/, (m) => `chowaniec ${m[1]}`],
    [/^a shimmering ward rises \((\d+)\)\. It soaks magic until it breaks$/, (m) => `wznosi się migocząca osłona (${m[1]}). Pochłania magię, dopóki nie pęknie`],
    [/^([^·\d]+?) (\d+)$/, (m) => { const a = tr0(m[1]); return a == null ? null : `${a} ${m[2]}`; }],   // "Frost Cloak 8"
    // "Staff of Calming: Calm: it stops fighting"; the longest left part that translates wins ("Dawnguard: Hunt the Night: “Awakening” done.")
    [/^([^·:]+): ([^·]+)$/, (m) => { const t = m[0], cuts = []; for (let i = t.indexOf(": "); i > 0; i = t.indexOf(": ", i + 2)) if (!t.slice(0, i).includes("·") && !/[.!?] /.test(t.slice(0, i))) cuts.unshift(i);   // a whole story ("X falls. In the chest: …") goes sentence by sentence instead
      for (const i of cuts) { const l = t.slice(0, i), a = tr0(l), b = tr0(t.slice(i + 2)); if (a != null && b != null && !(a === l && /[a-z]{2} [a-z]{2}/.test(l))) return `${a}: ${b}`; } return null; }],   // an English left part that came back as is: let the story templates try
  ];
  for (const [k, v] of Object.entries(WORDS)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  I18N_EXTRA.pat.push(...PAT);

  // ---------------------------------------------------------------- for canvas code: the text as the player should read it
  let ON = null;
  function c(x) {
    if (x == null || (typeof x !== "string")) return x;
    if (!/[a-z]{2}/i.test(x)) return x;
    if (ON == null) { if (typeof I18N === "undefined") return x; try { ON = I18N.lang() === "pl"; } catch (e) { ON = false; } }
    if (!ON) return x;
    const r = tr0(x);
    return r == null ? x : r;
  }
  return { c, WORDS, PAT };
})();
