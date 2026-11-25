/* i18n_foes.js: Polish names for every foe you can meet (road events, dungeons, quests, Solstheim, world events), plus
   the foe names the game builds on the fly ("Imperial escort", "Whiterun guard", "Vokun, dragon priest",
   "Blood Dragon over Riften"). People with their own names (Mercer Frey, Ancano, Miraak…) keep them: they are listed
   here as they are, so tests/test_foenames.js can tell "kept on purpose" from "forgotten".
   Loaded before i18n.js: exact names go in I18N_EXTRA.words, built names in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
const I18N_FOES = (() => {
  const NAMES = {
    // dungeons (dungeons.js ENEMY)
    Skeever: "Skeever", Draugr: "Draugr", "Draugr wight": "Draugr upiór", "Draugr scourge": "Draugr niszczyciel", "Draugr deathlord": "Draugr władca śmierci",
    "Bandit thug": "Bandycki zbir", "Bandit chief": "Herszt bandytów", "Dwarven spider": "Krasnoludzki pająk", "Dwarven sphere": "Krasnoludzka sfera",
    "Dwarven centurion": "Krasnoludzki centurion", Falmer: "Falmer", Hagraven: "Wiedźmokruczyca", "Vampire elder": "Starszy wampir",
    "Master vampire": "Wampir mistrz", "Dragon priest": "Smoczy kapłan", "Thalmor justiciar": "Justycjariusz Thalmoru",
    // road events (encounters.js)
    "Flame atronach": "Ognisty atronach", "Ash spawn": "Popielny pomiot", "Bandit toll gang": "Bandyci od myta", "Riekling hunters": "Rieklingowie myśliwi",
    "Thalmor Justiciars": "Justycjariusze Thalmoru", Wispmother: "Matka ogników", "Imperial escort": "Cesarska eskorta", "Stormcloak escort": "Eskorta Gromowładnych",
    // dragon kinds (dragons.js): a raid is "Blood Dragon over Riften"
    "Frost Dragon": "Mroźny smok", "Blood Dragon": "Krwawy smok", "Elder Dragon": "Starszy smok", "Ancient Dragon": "Pradawny smok", "Revered Dragon": "Czcigodny smok", "Legendary Dragon": "Legendarny smok",
    // world events and the city watch
    Dremora: "Dremora", "Dremora Valkynaz": "Dremora valkynaz", "Frost atronach": "Mroźny atronach", "Storm atronach": "Burzowy atronach", "City guard": "Strażnik miejski",
    // the civil war
    "Ice wraith": "Lodowa zjawa", "Imperial garrison": "Cesarski garnizon", "Whiterun's defenders": "Obrońcy Whiterun",
    // hold crises
    "Captain Vigge the Crooked": "Kapitan Vigge Krzywy", "Hrodvar Frost-Hand": "Hrodvar Mroźna Dłoń", "The White Matron": "Biała Matrona", "Ulfbjorn the Red": "Ulfbjorn Rudy",
    // Daedric quests
    "Boethiah's champion": "Czempion Boethiah", "Boethiah's cultist": "Kultysta Boethiah", "Gorgon the giant": "Olbrzym Gorgon",
    "Molag Bal's thralls": "Niewolnicy Molag Bala", "Morvunskar's mages": "Magowie z Morvunskar",
    // main and guild quests
    "Grelod the Kind": "Grelod Dobra", "The Emperor's bodyguards": "Straż przyboczna cesarza",
    // Solstheim
    Lurker: "Czyhacz", "Miraak's cultists": "Kultyści Miraaka", "Miraak's thralls": "Niewolnicy Miraaka", "Riekling chief": "Wódz rieklingów",
    "Riekling charger": "Riekling na dziku", "Ash hopper": "Popielny skoczek", "Ash hoppers": "Popielne skoczki", "Bull netch": "Netch byk",
    Riekling: "Riekling", Cultist: "Kultysta", Seeker: "Poszukiwacz", "Netch calf": "Młody netch", "Burnt spriggan": "Spalony spriggan", Reaver: "Grabieżca",
    "Ash-buried satchel": "Torba zasypana popiołem", "Mushroom grove": "Grzybowy gaj",
    // bounty hunters and the fighting pit
    "Bounty hunter": "Łowca nagród", "Arena wolves": "Wilki z areny", "Cave bear": "Niedźwiedź jaskiniowy", "The Pit's champion": "Mistrz Areny",
  };
  // people and dragons with their own names: the same in Polish
  const KEEP = ["Malkoran", "Orchendor", "Sebastian Lort", "Silus Vesuius", "Ancano", "Cicero", "Mercer Frey", "Mirmulnir", "Sahloknir", "Vald", "Vilkas", "Miraak", "Vulthuryol", "Lord Harkon"];
  for (const k of KEEP) NAMES[k] = k;

  const tr0 = (x) => { try { return typeof I18N !== "undefined" ? I18N.tr(x) : null; } catch (e) { return null; } };
  const HOLDS = "Haafingar|Hjaalmarch|The Pale|Winterhold|Eastmarch|Whiterun|The Reach|Falkreath|The Rift|Solitude|Windhelm|Markarth|Riften|Morthal|Dawnstar|Raven Rock";
  const PAT = [
    [new RegExp(`^(${HOLDS}) guard$`), (m) => `Strażnik z ${m[1]}`],
    [/^(.+), dragon priest$/, (m) => `${m[1]}, smoczy kapłan`],
    [/^((?:[A-Z]\w+ )?Dragon) over ([A-Z][\w' ]+)$/, (m) => { const d = tr0(m[1]); return d == null ? null : `${d} nad ${m[2]}`; }],
  ];
  for (const [k, v] of Object.entries(NAMES)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  I18N_EXTRA.pat.push(...PAT);
  return { NAMES, KEEP, PAT };
})();
