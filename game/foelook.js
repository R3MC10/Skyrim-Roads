/* FOELOOK: every humanoid foe gets a look card, so it is drawn by the same painted, rigged fighter as the heroes
   (rig.js via FIGART.fight) instead of a still painting. [OURS] [offhand]
   Owner: "make a proper rig for all characters in the game".

     FOELOOK.of(rec, i?)        → a look ({ id, r, sx, eq, gl, v, sk, sc }) for the fight record's foe (fightart.js REG
                                  record: rec.foe kind, rec.foeName, rec.f.e), or null when it isn't a person (beasts,
                                  dragons, spirits, machines, giants, trolls, skeletons...). i: a waiting foe's place in
                                  its group, so a pack of bandits doesn't look like one person copied.
     FOELOOK.human(name, kind)  → true for people
     FOELOOK.slug(name, kind)   → which kind of person: bandit, chief, forsworn, draugr, deathlord, falmer, vampire,
                                  necromancer, mage, thalmor, dremora, soldier, assassin, hunter (tests)
   A look's extra keys, read by figart.js / rig.js:
     sk: a skin colour that wins over the race's (draugr grey, dremora ash-red, falmer pale), tinting the painted
         head and hands; sc: the fighter's size (a bandit chief, a deathlord, a dremora stand a little taller).
   Gear ids only pick the painted set (leather / iron / steel), its tint and the weapon: unknown ids fall back by name. */
const FOELOOK = (() => {
  const SLUGS = [
    [/dremora|daedra(?!.*atronach)/, "dremora"],
    [/death ?lord|scourge|draugr overlord/, "deathlord"],
    [/draugr|restless|wight/, "draugr"],
    [/falmer/, "falmer"],
    [/vampire|thrall|bloodfiend/, "vampire"],
    [/necromancer|warlock|witch(?!.*hag)|cultist|sorcer|lich(?!e)/, "necromancer"],
    [/thalmor|justiciar/, "thalmor"],
    [/mage|wizard|conjurer|battlemage|spellsword|apprentice|adept/, "mage"],
    [/forsworn|briarheart|reachman/, "forsworn"],
    [/assassin|dark brotherhood|shrouded|nightingale|cutthroat/, "assassin"],
    [/soldier|legionnaire|stormcloak|imperial|guard|silver hand|vigilant|dawnguard|knight|templar/, "soldier"],
    [/hunter|poacher|archer|ranger|scout/, "hunter"],
    [/bandit (chief|boss|leader)|chief|chieftain|marauder|highwayman|warlord|champion|reaver/, "chief"],
    [/bandit|outlaw|thug|brigand|mercenar|smuggler|pirate|raider|duelist|bounty|thief|miner|adventurer|warrior|barbarian|berserker|player/, "bandit"],
  ];
  const NOT = /dragon(?! ?priest)|priest|troll|giant|bear|wolf|hound|cat\b|sabre|saber|spider|skeever|rat\b|crab|horker|mammoth|chaurus|spriggan|hagraven|wisp|wraith|atronach|centurion|sphere|construct|skeleton|bone|riekling|ash spawn|ash hopper|netch|lurker|seeker|werewolf|werebear|gargoyle|zombie|ghost|spirit|shade|automaton|golem|elk|deer|goat|horse/;
  const KIND = { bandit: "bandit", forsworn: "forsworn", draugr: "draugr", vampire: "vampire", mage: "mage", falmer: "falmer", player: "bandit" };

  function slug(name, kind) {
    const n = String(name || "").toLowerCase();
    if (NOT.test(n)) return null;
    for (const [re, s] of SLUGS) if (re.test(n)) return s;
    return KIND[kind] || null;
  }
  const human = (name, kind) => !!slug(name, kind);

  // a small seeded roll, so the same foe always looks the same
  function rnd(seed) { let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
  const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];

  /* who each kind of person is: races, how often a woman, gear by role (melee / archer / mage), skin and size */
  const KINDS = {
    bandit:     { r: ["nord", "imperial", "redguard", "breton", "nord", "orc"], f: 0.3, chest: ["hide_armor", "fur_armor", "leather_armor"], melee: ["iron_war_axe", "iron_sword", "iron_mace", "iron_dagger", "iron_greatsword"], shield: ["hide_shield", "iron_shield"], shieldP: 0.4, bow: "hunting_bow", staff: "staff_flames" },
    chief:      { r: ["nord", "orc", "redguard"], f: 0.2, chest: ["iron_armor", "banded_iron_armor", "steel_armor"], melee: ["steel_battleaxe", "iron_greatsword", "steel_warhammer", "steel_war_axe"], shield: ["iron_shield", "steel_shield"], shieldP: 0.25, bow: "long_bow", sc: 1.1 },
    forsworn:   { r: ["breton"], f: 0.4, chest: ["forsworn_armor"], melee: ["forsworn_sword", "forsworn_axe"], shield: [], shieldP: 0, bow: "forsworn_bow", staff: "forsworn_staff" },
    draugr:     { r: ["nord"], f: 0.15, chest: ["ancient_nord_armor"], melee: ["ancient_nord_war_axe", "ancient_nord_sword", "ancient_nord_greatsword", "ancient_nord_battleaxe"], shield: ["ancient_nord_shield"], shieldP: 0.3, bow: "ancient_nord_bow", sk: "#7f8c87" },
    deathlord:  { r: ["nord"], f: 0, chest: ["ancient_nord_armor"], melee: ["ancient_nord_greatsword", "ancient_nord_battleaxe", "ebony_greatsword"], shield: [], shieldP: 0, bow: "ancient_nord_bow", sk: "#5f6c6c", sc: 1.12 },
    falmer:     { r: ["altmer"], f: 0.3, chest: ["chitin_armor"], melee: ["falmer_sword", "falmer_war_axe"], shield: ["chitin_shield"], shieldP: 0.25, bow: "falmer_bow", staff: "falmer_staff", sk: "#c7c3b6" },
    vampire:    { r: ["breton", "imperial", "nord", "dunmer"], f: 0.5, chest: ["vampire_armor", "vampire_royal_armor"], melee: ["iron_dagger", "steel_sword"], shield: [], shieldP: 0, bow: "hunting_bow", cast: true, v: 1 },
    necromancer:{ r: ["breton", "imperial", "dunmer"], f: 0.45, chest: ["necromancer_robes"], melee: ["iron_dagger"], shield: [], shieldP: 0, cast: true, staff: "staff_reanimate" },
    mage:       { r: ["breton", "altmer", "dunmer", "imperial"], f: 0.5, chest: ["mage_robes"], melee: ["iron_dagger"], shield: [], shieldP: 0, cast: true, staff: "staff_flames" },
    thalmor:    { r: ["altmer"], f: 0.4, chest: ["thalmor_robes"], melee: ["elven_sword", "elven_dagger"], shield: [], shieldP: 0, bow: "elven_bow", cast: true },
    dremora:    { r: ["dunmer"], f: 0.2, chest: ["daedric_armor"], melee: ["daedric_greatsword", "daedric_battleaxe", "daedric_sword"], shield: ["daedric_shield"], shieldP: 0.2, bow: "daedric_bow", sk: "#6e2f2a", sc: 1.1 },
    soldier:    { r: ["imperial", "nord", "breton", "redguard"], f: 0.3, chest: ["iron_armor", "steel_armor", "stormcloak_cuirass"], melee: ["steel_sword", "iron_sword", "steel_war_axe"], shield: ["iron_shield", "steel_shield"], shieldP: 0.7, bow: "hunting_bow" },
    assassin:   { r: ["dunmer", "imperial", "khajiit", "redguard"], f: 0.4, chest: ["shrouded_armor", "leather_armor"], melee: ["iron_dagger", "elven_dagger", "steel_sword"], shield: [], shieldP: 0, bow: "hunting_bow" },
    hunter:     { r: ["nord", "bosmer", "imperial"], f: 0.4, chest: ["leather_armor", "hide_armor"], melee: ["iron_dagger", "hunting_knife"], shield: [], shieldP: 0, bow: "hunting_bow" },
  };
  const BOOTS = { hide_armor: "hide_boots", fur_armor: "fur_boots", leather_armor: "leather_boots", iron_armor: "iron_boots", banded_iron_armor: "iron_boots", steel_armor: "steel_boots", ancient_nord_armor: "ancient_nord_boots", chitin_armor: "chitin_boots", daedric_armor: "daedric_boots" };

  const CACHE = new Map();
  function look(name, kind, arch, i) {
    const s = slug(name, kind); if (!s) return null;
    const K = KINDS[s] || KINDS.bandit, role = String(arch || "").toLowerCase();
    const key = s + "|" + (name || "") + "|" + role + "|" + (i | 0);
    let L = CACHE.get(key); if (L) return L;
    const r = rnd(key);
    const race = pick(r, K.r), fem = r() < K.f, chest = pick(r, K.chest);
    const eq = { chest };
    if (BOOTS[chest]) eq.feet = BOOTS[chest];
    const archer = role === "archer" || (s === "hunter" && role !== "mage");
    const caster = role === "mage" || (K.cast && role !== "archer" && role !== "melee" && s !== "vampire") || (s === "vampire" && role === "mage");
    if (archer && K.bow) eq.weapon = K.bow;
    else if (caster) { if (K.staff && r() < 0.5) eq.weapon = K.staff; else if (K.melee[0] && r() < 0.3) eq.weapon = K.melee[0]; }
    else { eq.weapon = pick(r, K.melee); if (K.shield.length && r() < K.shieldP && !/great|battle|warhammer/.test(eq.weapon)) eq.shield = pick(r, K.shield); }
    L = { id: "foe-" + key, r: race, sx: fem ? "f" : undefined, eq, gl: {}, foe: s };
    if (K.v) L.v = 1;
    if (K.sk) L.sk = K.sk;
    if (K.sc) L.sc = K.sc;
    CACHE.set(key, L); if (CACHE.size > 120) CACHE.delete(CACHE.keys().next().value);
    return L;
  }
  /* the fight record's foe: another player keeps their own look (rec.foeLook), a dragon or a beast gets none */
  function of(rec, i) {
    if (!rec || rec.foeLook) return null;
    const e = (rec.f && rec.f.e) || {}, tags = new Set(e.tags || []);
    if (tags.has("dragon") || tags.has("beast") || tags.has("construct") || tags.has("spirit") || tags.has("animal")) return null;
    return look(rec.foeName || e.name, rec.foe, e.arch, i);
  }
  return { of, look, slug, human, KINDS };
})();
if (typeof module !== "undefined") module.exports = FOELOOK;
