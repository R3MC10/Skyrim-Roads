/* Standing stones, racial powers and dragon shouts.
   [Skyrim] effects from UESP (Standing Stones, Racial powers, Dragon Shouts); one combat turn = about one Skyrim second,
   so "for 60 seconds" becomes a number of turns ([OURS] scaling noted inline). Powers recharge once a game day (2 real hours). */
const POWERS = (() => {
  const DAY = 2 * 3600;
  const now = () => Date.now() / 1000;

  // ---- standing stones ([Skyrim]; you can have one at a time)
  const WARRIOR = ["One-Handed", "Two-Handed", "Archery", "Blocking", "Heavy Armor", "Smithing", "Spear", "Hand-to-Hand", "Medium Armor"];
  const MAGE = ["Alteration", "Conjuration", "Destruction", "Enchanting", "Illusion", "Restoration", "Mysticism"];
  const THIEF = ["Alchemy", "Light Armor", "Lockpicking", "Pickpocket", "Sneak", "Speechcraft", "Mercantile", "Acrobatics", "Streetwise"];
  const STONES = {
    warrior: ["The Warrior Stone", "Combat skills improve 20% faster."], mage: ["The Mage Stone", "Magic skills improve 20% faster."],
    thief: ["The Thief Stone", "Stealth skills improve 20% faster."], lady: ["The Lady Stone", "Healing effects and stamina regenerate 25% faster."],
    lord: ["The Lord Stone", "+50 armor rating and 25% less damage from magic."], steed: ["The Steed Stone", "+100 carry weight; worn armor weighs nothing."],
    lover: ["The Lover Stone", "Every skill improves 15% faster."], atronach: ["The Atronach Stone", "+50 magicka, but magicka regenerates 50% slower."],
    apprentice: ["The Apprentice Stone", "Magicka regenerates twice as fast, but you take double damage from magic."],
    ritual: ["The Ritual Stone", "Once a day: the dead rise and fight beside you for the rest of a fight."],
    serpent: ["The Serpent Stone", "Once a day: paralyze your foe for 5 turns and poison it for 25 damage."],
    shadow: ["The Shadow Stone", "Once a day: turn invisible: your next hit is a sneak attack and the foe misses for 2 turns."],
    tower: ["The Tower Stone", "Once a day: open any lock up to Expert without picking it."],
  };
  const STONE_AT = { "Guardian Stones": ["warrior", "mage", "thief"], "The Lady Stone": ["lady"], "The Lord Stone": ["lord"], "The Steed Stone": ["steed"],
    "The Lover Stone": ["lover"], "The Atronach Stone": ["atronach"], "The Apprentice Stone": ["apprentice"], "The Ritual Stone": ["ritual"],
    "The Serpent Stone": ["serpent"], "The Shadow Stone": ["shadow"], "The Tower Stone": ["tower"] };
  const stone = (s) => s.stone || null;
  function takeStone(s, id) {
    if (!(STONE_AT[s.location] || []).includes(id)) return "That stone isn't here.";
    s.stone = id; s.stonePowerAt = 0; s.stonesSeen = [...new Set([...(s.stonesSeen || []), id])];   // for the achievement
    return `${STONES[id][0]} glows under your hand. ${STONES[id][1]}`;
  }
  function xpMult(s, skill) {
    const st = stone(s);
    return 1 + (st === "warrior" && WARRIOR.includes(skill) ? 0.2 : 0) + (st === "mage" && MAGE.includes(skill) ? 0.2 : 0)
      + (st === "thief" && THIEF.includes(skill) ? 0.2 : 0) + (st === "lover" ? 0.15 : 0);
  }

  // ---- racial powers ([Skyrim], once a day; 60 seconds = 10 turns [OURS])
  const RACE = {
    nord: ["Battle Cry", "The foe flees in terror for 8 turns."],
    imperial: ["Voice of the Emperor", "People stop fighting for 8 turns."],
    breton: ["Dragonskin", "Half damage from mages and dragons for 10 turns."],
    redguard: ["Adrenaline Rush", "Stamina regenerates ten times faster for 10 turns."],
    altmer: ["Highborn", "Magicka regenerates 25 times faster for 10 turns."],
    bosmer: ["Command Animal", "A beast stops fighting you for 10 turns."],
    dunmer: ["Ancestor's Wrath", "A cloak of fire burns the foe for 8 damage a turn for 10 turns."],
    orc: ["Berserker Rage", "Double damage dealt and half damage taken for 10 turns."],
    khajiit: ["Night Eye", "You fade into the dark: your next hit is a sneak attack."],
    argonian: ["Histskin", "Health regenerates ten times faster for 10 turns."],
  };
  const powerReady = (s, which, t = now()) => s._test || (which === "stone" ? (s.stonePowerAt || 0) + DAY <= t : (s.powerAt || 0) + DAY <= t);
  const stoneHasPower = (s) => ["ritual", "serpent", "shadow", "tower"].includes(stone(s));

  // ---- dragon shouts ([Skyrim] words and cooldowns per number of words)
  const SHOUTS = {
    unrelenting_force: ["Unrelenting Force", ["FUS", "RO", "DAH"], [15, 20, 45], "Staggers the foe for 1/2/3 turns and hits for 10/20/35."],
    fire_breath: ["Fire Breath", ["YOL", "TOOR", "SHUL"], [30, 50, 100], "Fire for 50/70/90 damage."],
    frost_breath: ["Frost Breath", ["FO", "KRAH", "DIIN"], [30, 50, 100], "Frost for 50/70/90 damage, and the foe is slowed."],
    ice_form: ["Ice Form", ["IIZ", "SLEN", "NUS"], [60, 90, 120], "Freezes the foe solid for 3/5/8 turns."],
    become_ethereal: ["Become Ethereal", ["FEIM", "ZII", "GRON"], [30, 40, 50], "Nothing can hurt you for 3/5/8 turns."],
    disarm: ["Disarm", ["ZUN", "HAAL", "VIIK"], [30, 35, 40], "The foe's blows land 30/45/60% softer for the rest of the fight."],
    kynes_peace: ["Kyne's Peace", ["KAAN", "DREM", "OV"], [40, 50, 60], "A beast stops fighting for 5/8/12 turns."],
    dragon_aspect: ["Dragon Aspect", ["MUL", "QAH", "DIIV"], [300, 300, 300], "For the rest of the fight: +20/35/50% damage, 15/25/35% less taken."],
    whirlwind_sprint: ["Whirlwind Sprint", ["WULD", "NAH", "KEST"], [20, 25, 35], "On the road: dash ahead 30/60/90 seconds of travel."],
    aura_whisper: ["Aura Whisper", ["LAAS", "YAH", "NIR"], [30, 40, 50], "On the road: sense places within 80/120/160 paces."],
  };
  const ROAD_SHOUTS = ["whirlwind_sprint", "aura_whisper"];
  const known = (s, w) => (s.words || []).includes(w);
  const unlocked = (s, w) => (s.unlocked || []).includes(w);
  const level = (s, id) => { let n = 0; for (const w of SHOUTS[id][1]) { if (known(s, w) && unlocked(s, w)) n++; else break; } return n; };
  const voiceReady = (s, t = now()) => s._test || (s.voiceAt || 0) <= t;
  /* the next word a Word Wall teaches: first words of every shout first, then second words, then third */
  function nextWord(s) {
    for (let i = 0; i < 3; i++) for (const [id, [name, words]] of Object.entries(SHOUTS)) if (!known(s, words[i]) && (i === 0 || known(s, words[i - 1]))) return [words[i], name, id];
    return null;
  }
  function learnWord(s, word) { s.words = [...new Set([...(s.words || []), word])]; }
  function unlock(s, word) {                                                // [Skyrim] a dragon soul unlocks a word you know
    if (!known(s, word)) return "You don't know that word yet.";
    if (unlocked(s, word)) return "Already unlocked.";
    if ((s.souls || 0) < 1) return "You need a dragon soul. Kill a dragon to absorb one.";
    s.souls -= 1; s.unlocked = [...(s.unlocked || []), word];
    return `The dragon soul burns through you. You understand ${word}.`;
  }
  function greybeards(s) {                                                  // [Skyrim] the Greybeards teach and unlock RO and DAH
    if (s.location !== "High Hrothgar") return "The Greybeards live at High Hrothgar.";
    if (s.greybeards) return "The Greybeards nod. They have taught you what they will, for now.";
    s.greybeards = true;
    ["FUS", "RO", "DAH"].forEach((w) => learnWord(s, w));
    s.unlocked = [...new Set([...(s.unlocked || []), "FUS", "RO", "DAH"])];
    return "Arngeir speaks, and the walls shake. The Greybeards teach you RO and DAH and share their understanding of all three words: Unrelenting Force is yours at full strength. Use it in your tactics.";
  }
  function roadShout(s, id, t = now()) {
    const lv = level(s, id);
    if (!lv) return "You can't shout that yet.";
    if (!voiceReady(s, t)) return `Your voice needs ${Math.ceil(s.voiceAt - t)} more seconds.`;
    if (id === "whirlwind_sprint") {
      const tr = s.trip;
      if (!tr || tr.status !== "travel") return "Shout it while travelling.";
      const mv = Terrain.moveAlong(tr.path, tr.idx, [s.x, s.y], [30, 60, 90][lv - 1], G.speed(s) / 60);
      if (!mv.done) { [s.x, s.y] = mv.pos; tr.idx = mv.idx; }
      s.voiceAt = t + SHOUTS[id][2][lv - 1];
      return `WULD${lv > 1 ? " NAH" : ""}${lv > 2 ? " KEST" : ""}! You blur down the road.`;
    }
    if (id === "aura_whisper") {
      const r = [80, 120, 160][lv - 1], found = [];
      for (const [n, p] of Object.entries(WORLD.places)) if (!s.discovered.includes(n) && G.pxDist([s.x, s.y], p) <= r) { s.discovered.push(n); found.push(n); }
      s.voiceAt = t + SHOUTS[id][2][lv - 1];
      return found.length ? `You whisper, and the land answers: ${found.join(", ")}.` : "You whisper. Nothing new nearby.";
    }
    return "That shout is for fights. Add it to your tactics.";
  }

  // ---- combat hooks (called from the Fight class in engine.js)
  function fightState() { return { rage: 0, ether: 0, disarm: 0, aspect: 0, aspectRed: 0, cloak: 0, hist: 0, adren: 0, high: 0, skin: 0, beast: 0, lord: 0 }; }
  function affordable(f, kind, arg) {
    const s = f.s;
    if (kind === "power" && arg === "beast") return typeof CURSE !== "undefined" && CURSE.beastReady(s, f.t) && !f.usedBeast && !(f.pw.lord > 0);
    if (kind === "power" && arg === "lord") return typeof CURSE !== "undefined" && !!CURSE.lordReady && CURSE.lordReady(s, f.t) && !f.usedLord;
    if (kind === "power") return arg === "race" ? powerReady(s, "race", f.t) && !f.usedPower : stoneHasPower(s) && stone(s) !== "tower" && powerReady(s, "stone", f.t) && !f.usedStone;
    if (kind === "shout") return !ROAD_SHOUTS.includes(arg) && level(s, arg) > 0 && voiceReady(s, f.t) && !f.shoutedThisTurn;
    return false;
  }
  function act(f, kind, arg) {
    const s = f.s, p = f.pw, tags = f.tags, t = f.t;
    if (kind === "power" && arg === "beast") { f.usedBeast = true; return CURSE.transform(f); }
    if (kind === "power" && arg === "lord") { f.usedLord = true; return CURSE.lordForm(f); }
    if (kind === "power" && arg === "race") {
      f.usedPower = true; if (!s._test) s.powerAt = t;
      const name = RACE[s.race][0];
      switch (s.race) {
        case "nord": f.calmTurns = 8; return `${name}: the ${f.e.name} flees in terror`;
        case "imperial": if (!tags.has("humanoid")) return `${name}: no effect on that`; f.calmTurns = 8; return `${name}: they lower their weapons`;
        case "breton": p.skin = 10; return `${name}: your skin hardens against magic`;
        case "redguard": p.adren = 10; return `${name}: adrenaline floods you`;
        case "altmer": p.high = 10; return `${name}: magicka surges`;
        case "bosmer": if (!tags.has("beast")) return `${name}: no beast to command`; f.calmTurns = 10; return `${name}: the beast obeys`;
        case "dunmer": p.cloak = 10; return `${name}: flames wreathe you`;
        case "orc": p.rage = 10; return `${name}: you see red`;
        case "khajiit": f.sneakNext = true; return `${name}: you vanish into the dark`;
        case "argonian": p.hist = 10; return `${name}: your wounds knit`;
      }
      return name;
    }
    if (kind === "power") {
      f.usedStone = true; if (!s._test) s.stonePowerAt = t;
      if (stone(s) === "serpent") { f.eParalyzed = Math.max(f.eParalyzed, 5); f.ehp -= 25; return "Serpent: paralyzed and poisoned for 25"; }
      if (stone(s) === "ritual") { f.allies.push({ name: "Risen dead", dmg: 8, kind: "zombie" }); return "Ritual: the dead rise to fight for you"; }
      if (stone(s) === "shadow") { f.sneakNext = true; p.ether = Math.max(p.ether, 2); return "Shadow: you turn invisible"; }
    }
    if (kind === "shout") {
      const lv = level(s, arg), [name, words, cd] = SHOUTS[arg];
      if (!s._test) s.voiceAt = t + cd[lv - 1] * (1 - (typeof PFX !== "undefined" ? Math.min(0.5, PFX.num(s, "shoutcd")) : 0));   // Commanding Voice
      f.shoutedThisTurn = true;
      f.addXp && 0;
      const cry = words.slice(0, lv).join(" ") + "!";
      switch (arg) {
        case "unrelenting_force": f.eParalyzed = Math.max(f.eParalyzed, lv); f.ehp -= [10, 20, 35][lv - 1]; return `${cry} ${name} knocks it flat (${[10, 20, 35][lv - 1]})`;
        case "fire_breath": f.ehp -= [50, 70, 90][lv - 1]; return `${cry} Fire Breath: ${[50, 70, 90][lv - 1]}` + (typeof PFX !== "undefined" ? PFX.hitFoe(f, "fire", [50, 70, 90][lv - 1], "shout") : "");
        case "frost_breath": f.ehp -= [50, 70, 90][lv - 1]; f.slowed = 3; return `${cry} Frost Breath: ${[50, 70, 90][lv - 1]}, slowed` + (typeof PFX !== "undefined" ? PFX.hitFoe(f, "frost", [50, 70, 90][lv - 1], "shout") : "");
        case "ice_form": f.eParalyzed = Math.max(f.eParalyzed, [3, 5, 8][lv - 1]); return `${cry} Ice Form: frozen solid`;
        case "become_ethereal": p.ether = [3, 5, 8][lv - 1]; return `${cry} you turn ethereal`;
        case "disarm": p.disarm = [0.3, 0.45, 0.6][lv - 1]; return `${cry} its weapon flies away`;
        case "kynes_peace": if (!tags.has("beast")) return `${cry} Kyne's Peace: no beast here`; f.calmTurns = [5, 8, 12][lv - 1]; return `${cry} the beast calms`;
        case "dragon_aspect": p.aspect = [0.2, 0.35, 0.5][lv - 1]; p.aspectRed = [0.15, 0.25, 0.35][lv - 1]; return `${cry} you take on the aspect of the dragon`;
      }
    }
    return "Nothing happens";
  }
  const dmgOut = (f) => (f.pw.rage > 0 ? 2 : 1) * (1 + f.pw.aspect) * (typeof CURSE !== "undefined" ? CURSE.dmgMult(f) : 1);
  function dmgIn(f, dmg, magic) {
    const p = f.pw, s = f.s;
    if (p.ether > 0) return 0;
    let d = dmg * (p.rage > 0 ? 0.5 : 1) * (1 - p.disarm) * (1 - p.aspectRed) * (typeof CURSE !== "undefined" ? CURSE.dmgInMult(f) : 1);
    if (magic) d *= (p.skin > 0 ? 0.5 : 1) * (stone(s) === "lord" ? 0.75 : 1) * (stone(s) === "apprentice" ? 2 : 1);
    return d;
  }
  function tick(f, line) {   // once per turn
    const p = f.pw, s = f.s;
    f.shoutedThisTurn = false;
    if (p.cloak > 0 && f.ehp > 0) { f.ehp -= 8; line.me += " · fire cloak 8"; }
    if (p.hist > 0) f.hp = Math.min(G.maxHealth(s), f.hp + G.maxHealth(s) * 0.07);
    if (p.adren > 0) f.sp = Math.min(G.maxStamina(s), f.sp + f.regenSp * 9);
    if (p.high > 0) f.mp = Math.min(G.maxMagicka(s), f.mp + f.regenMp * 24);
    if (typeof CURSE !== "undefined" && CURSE.tick) CURSE.tick(f, line);   // a Vampire Lord drains every turn
    if (p.beast === 1) line.me += " · you change back";
    for (const k of ["rage", "ether", "cloak", "hist", "adren", "high", "skin", "beast", "lord"]) if (p[k] > 0) p[k]--;
  }
  function describe(a) {
    const [kind, arg] = a.split(":");
    if (kind === "power" && arg === "beast") return "Turn into the beast (werewolf, once a day)";
    if (kind === "power" && arg === "lord") return "Become a Vampire Lord (vampire, once a day)";
    if (kind === "power") return arg === "race" ? "Use my racial power (once a day)" : "Use my standing stone's power (once a day)";
    if (kind === "shout") return `Shout ${SHOUTS[arg]?.[0] || arg}`;
    return a;
  }
  /* a dragon dies: absorb its soul ([Skyrim]) */
  function absorb(s) { s.souls = (s.souls || 0) + 1; s.dragons = (s.dragons || 0) + 1; return "You absorb the dragon's soul!"; }

  return { DAY, STONES, STONE_AT, RACE, SHOUTS, ROAD_SHOUTS, stone, takeStone, xpMult, powerReady, stoneHasPower, known, unlocked, level, voiceReady, nextWord, learnWord,
    unlock, greybeards, roadShout, fightState, affordable, act, dmgOut, dmgIn, tick, describe, absorb };
})();
