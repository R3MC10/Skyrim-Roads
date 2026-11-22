/* More Dragon Shouts, Skyrim-style ([Skyrim] names, words and cooldowns; [OURS] effects in this fight engine).
   - New shouts: Marked for Death, Slow Time, Dragonrend, Storm Call, Elemental Fury, Clear Skies, Throw Voice,
     Animal Allegiance, Call of Valor, Call Dragon, Dismay.
   - Word Walls stand at fixed places, as in Skyrim: each wall teaches the next word of its own shout, once.
     A dragon soul still unlocks a word (POWERS.unlock).
   - Some shouts aren't on walls: the Greybeards teach Whirlwind Sprint, Throw Voice and Clear Skies on later
     visits to High Hrothgar, Paarthurnax teaches Dragonrend once you have slain dragons, Call Dragon comes after
     your fifth dragon and Call of Valor after your tenth.
   Everything hooks POWERS from the outside; engine.js, dungeons.js and combatai.js only call into it. */
const SHOUTS2 = (() => {
  const P = POWERS, S = P.SHOUTS;
  // id: [name, words, cooldowns (s) for 1/2/3 words, what it does]
  const NEW = {
    marked_for_death: ["Marked for Death", ["KRII", "LUN", "AUS"], [20, 30, 40], "The foe's armor crumbles: your blows hit 15/25/35% harder for the rest of the fight, and it loses 4/6/8 health a turn."],
    slow_time: ["Slow Time", ["TIID", "KLO", "UL"], [30, 45, 60], "Time crawls for the foe: its blows land half as hard for 3/5/8 turns."],
    dragonrend: ["Dragonrend", ["JOOR", "ZAH", "FRUL"], [10, 12, 15], "Forces a dragon to land: it can't fight back for 2/3/4 turns and takes 15/25/35% more damage for the rest of the fight. Does nothing to anything else."],
    storm_call: ["Storm Call", ["STRUN", "BAH", "QO"], [300, 480, 600], "Lightning strikes the foe for 15/20/25 every turn for 4/6/8 turns. Needs open sky."],
    elemental_fury: ["Elemental Fury", ["SU", "GRAH", "DUN"], [30, 40, 50], "Your weapons swing with the speed of the wind: +20/35/50% weapon damage for 4/6/8 turns."],
    clear_skies: ["Clear Skies", ["LOK", "VAH", "KOOR"], [5, 10, 15], "On the road: the sky clears around you for 1/2/4 hours, so snow, fog and storms stop slowing you."],
    throw_voice: ["Throw Voice", ["ZUL", "MEY", "GUT"], [30, 15, 5], "Your voice calls from somewhere else: the foe turns, and your next blow is a sneak attack."],
    animal_allegiance: ["Animal Allegiance", ["RAAN", "MIR", "TAH"], [50, 60, 70], "Beasts fight for you: a beast foe stops fighting for 6/10/14 turns, and a wild animal joins you (6/9/12 damage a turn)."],
    call_of_valor: ["Call of Valor", ["HUN", "KAAL", "ZOOR"], [180, 180, 180], "A hero of Sovngarde fights at your side for the rest of the fight (14/20/28 damage a turn)."],
    call_dragon: ["Call Dragon", ["OD", "AH", "VIING"], [300, 300, 300], "Odahviing answers: under open sky he fights for you (35 damage a turn) for the rest of the fight."],
    dismay: ["Dismay", ["FAAS", "RU", "MAAR"], [40, 45, 50], "Terror grips the foe: it stops fighting for 3/5/8 turns. Dragons and the undead don't feel fear."],
  };
  for (const [id, v] of Object.entries(NEW)) if (!S[id]) S[id] = v;
  P.ROAD_SHOUTS.push("clear_skies");
  // shouts that no wall teaches (taught by the Greybeards, Paarthurnax or your dragon kills)
  const TAUGHT = new Set(["throw_voice", "clear_skies", "dragonrend", "call_dragon", "call_of_valor"]);

  // ---- Word Walls: where they stand ([Skyrim] locations, best placement where the game's own differs)
  const WALLS = {
    "Bleak Falls Barrow": "unrelenting_force",
    "Sunderstone Gorge": "fire_breath", "Dead Men's Respite": "fire_breath", "Valthume": "fire_breath",
    "Folgunthur": "frost_breath", "Skyborn Altar": "frost_breath", "Bonestrewn Crest": "frost_breath",
    "Saarthal": "ice_form", "Frostmere Crypt": "ice_form", "Mount Anthor": "ice_form",
    "Ironbind Barrow": "become_ethereal", "Lost Valley Redoubt": "become_ethereal", "Ustengrav": "become_ethereal",
    "Silverdrift Lair": "disarm", "Eldersblood Peak": "disarm", "Dustman's Cairn": "disarm",
    "Ragnvald": "kynes_peace", "Rannveig's Fast": "kynes_peace", "Steepfall Burrow": "kynes_peace",
    "Autumnwatch Tower": "marked_for_death", "Fallowstone Cave": "marked_for_death", "Hob's Fall Cave": "marked_for_death",
    "Labyrinthian": "slow_time", "Hag's End": "slow_time", "Ancient's Ascent": "slow_time",
    "Dead Crone Rock": "dismay", "Shriekwind Bastion": "dismay", "Snow Veil Sanctum": "dismay",
    "Dragontooth Crater": "elemental_fury", "Shearpoint": "elemental_fury", "Kilkreath Ruins": "elemental_fury",
    "Northwind Summit": "aura_whisper", "Volunruud": "aura_whisper", "Hillgrund's Tomb": "aura_whisper",
    "Angarvunde": "animal_allegiance", "Geirmund's Hall": "animal_allegiance", "Lost Tongue Overlook": "animal_allegiance",
    "Forelhost": "storm_call", "Sightless Pit": "storm_call", "Ysgramor's Tomb": "storm_call",
    "Volskygge": "whirlwind_sprint", "Shroud Hearth Barrow": "whirlwind_sprint",
    "Rimerock Burrow": "dragon_aspect", "Pinewatch": "dragon_aspect", "Yngol Barrow": "dragon_aspect",
  };
  const placeOk = (n) => typeof WORLD === "undefined" || !!WORLD.places[n];
  for (const n of Object.keys(WALLS)) if (!placeOk(n)) delete WALLS[n];
  const nextOf = (s, id) => { const w = S[id]?.[1]; if (!w) return null; for (let i = 0; i < 3; i++) if (!P.known(s, w[i])) return i === 0 || P.known(s, w[i - 1]) ? w[i] : null; return null; };
  const wallsFor = (id) => Object.keys(WALLS).filter((n) => WALLS[n] === id);
  const read = (s) => (s.walls = s.walls || []);
  /* the word this place's wall teaches you now, or null (already read, or nothing left to learn from it) */
  function wallWord(s, place) {
    const id = WALLS[place];
    if (!id || read(s).includes(place)) return null;
    const w = nextOf(s, id);
    return w ? [w, S[id][0], id] : null;
  }
  /* reading a wall: learn the word, mark the wall read */
  function readWall(s, place) {
    const ww = wallWord(s, place); if (!ww) return null;
    P.learnWord(s, ww[0]); read(s).push(place);
    lastWall = { word: ww[0], shout: ww[1], id: ww[2], place, unlocked: P.unlocked(s, ww[0]) };
    return ww;
  }
  let lastWall = null;
  const takeWall = () => { const w = lastWall; lastWall = null; return w; };
  // the old "any wall teaches the next word" no longer applies: walls are fixed. nextWord now means "the next word
  // you could find", for hints.
  function hint(s, id) {
    if (TAUGHT.has(id)) return { throw_voice: "The Greybeards teach it at High Hrothgar (level 10).", clear_skies: "The Greybeards teach it at High Hrothgar (level 15, after a dragon).", dragonrend: "Paarthurnax teaches it at High Hrothgar once you have slain 3 dragons.", call_dragon: "It comes to you after your fifth dragon.", call_of_valor: "It comes to you after your tenth dragon." }[id];
    if (id === "unrelenting_force") return "The Greybeards at High Hrothgar, and the wall in Bleak Falls Barrow.";
    const left = wallsFor(id).filter((n) => !read(s).includes(n));
    if (!left.length) return id === "whirlwind_sprint" ? "The Greybeards teach WULD." : "You have read every wall for it.";
    const holds = [...new Set(left.map((n) => (typeof G !== "undefined" && G.holdAt ? G.holdAt(WORLD.places[n]) : "")).filter(Boolean))];
    return `Word Walls${holds.length ? ` in ${holds.join(", ")}` : ""}${left.length ? ` (${left.length} left)` : ""}.`;
  }

  // ---- the Greybeards' later lessons, Paarthurnax, dragon kills
  const teach = (s, words, unlock) => { words.forEach((w) => P.learnWord(s, w)); if (unlock) s.unlocked = [...new Set([...(s.unlocked || []), ...words])]; };
  const gb0 = P.greybeards;
  P.greybeards = (s) => {
    if (s.location !== "High Hrothgar" || !s.greybeards) return gb0(s);
    const lessons = [];
    if (!P.known(s, "WULD")) { teach(s, ["WULD"], true); lessons.push("Borri teaches you WULD: Whirlwind Sprint"); }
    if (s.level >= 10 && !P.known(s, "ZUL")) { teach(s, ["ZUL", "MEY", "GUT"], false); s.unlocked = [...new Set([...(s.unlocked || []), "ZUL"])]; lessons.push("Arngeir teaches you Throw Voice (ZUL MEY GUT); ZUL is yours already"); }
    if (s.level >= 15 && (s.dragons || 0) >= 1 && !P.known(s, "LOK")) { teach(s, ["LOK", "VAH", "KOOR"], true); lessons.push("the four masters shout Clear Skies into you: LOK VAH KOOR"); }
    if ((s.dragons || 0) >= 3 && !P.known(s, "JOOR")) { teach(s, ["JOOR", "ZAH", "FRUL"], true); lessons.push("on the summit, Paarthurnax gives you Dragonrend: JOOR ZAH FRUL, the shout made to bring dragons down"); }
    if (lessons.length) return `The Greybeards receive you. ${lessons.map((x) => x[0].toUpperCase() + x.slice(1)).join(". ")}.`;
    return gb0(s);
  };
  const absorb0 = P.absorb;
  P.absorb = (s) => {
    let m = absorb0(s);
    if ((s.dragons || 0) >= 5 && !P.known(s, "OD")) { teach(s, ["OD", "AH", "VIING"], true); m += " A name burns in your mind: OD AH VIING. Call Dragon is yours."; }
    if ((s.dragons || 0) >= 10 && !P.known(s, "HUN")) { teach(s, ["HUN", "KAAL", "ZOOR"], true); m += " The heroes of Sovngarde hear of you: HUN KAAL ZOOR. Call of Valor is yours."; }
    return m;
  };

  // ---- road shouts
  let clear = null;   // { until, pos }  — the local player's Clear Skies
  const road0 = P.roadShout;
  P.roadShout = (s, id, t = (typeof G !== "undefined" ? G.now() : Date.now() / 1000)) => {
    if (id !== "clear_skies") return road0(s, id, t);
    const lv = P.level(s, id);
    if (!lv) return "You can't shout that yet.";
    if (!P.voiceReady(s, t)) return `Your voice needs ${Math.ceil(s.voiceAt - t)} more seconds.`;
    s.voiceAt = t + S[id][2][lv - 1];
    s.clearSky = { until: t + [300, 600, 1200][lv - 1], pos: [s.x, s.y] };   // 1/2/4 in-game hours (1 hour = 5 real minutes)
    clear = s.clearSky;
    return `LOK${lv > 1 ? " VAH" : ""}${lv > 2 ? " KOOR" : ""}! The clouds tear open and the sky clears.`;
  };
  if (typeof WEVENTS !== "undefined") {
    const w0 = WEVENTS.weather;
    WEVENTS.weather = (pos, t) => {
      const c = clear, tt = t || (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
      if (c && c.until > tt && pos && Math.hypot(pos[0] - c.pos[0], pos[1] - c.pos[1]) < 0.08) return { id: "clear", name: "Clear (your shout)", icon: "☀️", speed: 1, sneak: 0, encounters: 1 };
      return w0(pos, t);
    };
  }
  const bindSave = (s) => { clear = s && s.clearSky || null; };

  // ---- fights
  const fs0 = P.fightState;
  P.fightState = () => ({ ...fs0(), mark: 0, markDot: 0, rend: 0, storm: 0, stormDmg: 0, fury: 0, furyMult: 0 });
  const outdoors = (f) => !(f.s && f.s.dungeon) && !(f.e && /cave|dwemer|barrow/i.test(f.e.scene || ""));
  const aff0 = P.affordable;
  P.affordable = (f, kind, arg) => {
    if (kind === "shout" && NEW[arg] && arg !== "clear_skies") {
      if (!(P.level(f.s, arg) > 0 && P.voiceReady(f.s, f.t) && !f.shoutedThisTurn)) return false;
      if (arg === "call_dragon" && !outdoors(f)) return false;
      if (arg === "storm_call" && !outdoors(f)) return false;
      if (arg === "call_of_valor" && f.allies.some((a) => a.valor)) return false;
      if (arg === "call_dragon" && f.allies.some((a) => a.odah)) return false;
      return true;
    }
    return aff0(f, kind, arg);
  };
  const act0 = P.act;
  P.act = (f, kind, arg) => {
    if (kind !== "shout" || !NEW[arg]) return act0(f, kind, arg);
    const s = f.s, p = f.pw, lv = P.level(s, arg), [name, words, cd] = S[arg], L = (a) => a[lv - 1];
    if (!s._test) s.voiceAt = f.t + cd[lv - 1];
    f.shoutedThisTurn = true;
    const cry = words.slice(0, lv).join(" ") + "!", tags = f.tags;
    switch (arg) {
      case "marked_for_death": p.mark = Math.max(p.mark, L([0.15, 0.25, 0.35])); p.markDot = L([4, 6, 8]); return `${cry} Marked for Death: its armor crumbles`;
      case "slow_time": f.slowed = Math.max(f.slowed, L([3, 5, 8])); return `${cry} time slows to a crawl`;
      case "dragonrend":
        if (!tags.has("dragon")) return `${cry} Dragonrend: there's no dragon to bring down`;
        f.eParalyzed = Math.max(f.eParalyzed, L([2, 3, 4])); p.rend = Math.max(p.rend, L([0.15, 0.25, 0.35])); return `${cry} the dragon is forced to land`;
      case "storm_call": p.storm = L([4, 6, 8]); p.stormDmg = L([15, 20, 25]); return `${cry} the sky darkens and lightning answers`;
      case "elemental_fury": p.fury = L([4, 6, 8]); p.furyMult = L([0.2, 0.35, 0.5]); return `${cry} your arms move with the speed of the wind`;
      case "throw_voice": f.sneakNext = true; return `${cry} your voice echoes behind it and it turns away`;
      case "animal_allegiance": {
        if (tags.has("beast")) f.calmTurns = Math.max(f.calmTurns || 0, L([6, 10, 14]));
        f.allies.push({ name: "Wild animal", dmg: L([6, 9, 12]), beast: true });
        return `${cry} ${tags.has("beast") ? "the beast turns to your side, and" : ""} a wild animal answers the call`;
      }
      case "call_of_valor": f.allies.push({ name: ["Ysgramor", "Gormlaith Golden-Hilt", "Felldir the Old", "Hakon One-Eye"][(f.turn || 0) % 4], dmg: L([14, 20, 28]), valor: true }); return `${cry} a hero of Sovngarde steps out of the light`;
      case "call_dragon": f.allies.push({ name: "Odahviing", dmg: 35, odah: true }); return `${cry} Odahviing answers from the sky`;
      case "dismay":
        if (tags.has("dragon") || tags.has("undead")) return `${cry} Dismay: it feels no fear`;
        f.calmTurns = Math.max(f.calmTurns || 0, L([3, 5, 8])); return `${cry} the foe flees in terror`;
    }
    return "Nothing happens";
  };
  const out0 = P.dmgOut;
  P.dmgOut = (f) => {
    const p = f.pw; let m = out0(f);
    if (p.mark) m *= 1 + p.mark;
    if (p.rend && f.tags.has("dragon")) m *= 1 + p.rend;
    if (p.fury > 0) m *= 1 + p.furyMult;
    return m;
  };
  const tick0 = P.tick;
  P.tick = (f, line) => {
    const p = f.pw;
    if (p.markDot && f.ehp > 0) { f.ehp -= p.markDot; line.me += ` · marked ${p.markDot}`; }
    if (p.storm > 0 && f.ehp > 0) { f.ehp -= p.stormDmg; line.me += ` · lightning ${p.stormDmg}`; p.storm--; }
    if (p.fury > 0) p.fury--;
    tick0(f, line);
  };

  // ---- Smart AI: how much a new shout is worth this turn (combatai.js calls this for shouts it doesn't know)
  function aiValue(f, arg, lv, ctx) {
    const { stun, dmgV, remT, d, dps } = ctx, L = (a) => a[lv - 1], tags = f.tags, p = f.pw;
    switch (arg) {
      case "marked_for_death": return p.mark ? -1 : L([0.15, 0.25, 0.35]) * Math.min(remT, 12) * 0.9 + dmgV(L([4, 6, 8]) * Math.min(remT, 12));
      case "slow_time": return f.slowed > 1 ? -1 : 0.5 * Math.min(remT + 1, L([3, 5, 8])) * d;
      case "dragonrend": return tags.has("dragon") ? (f.eParalyzed > 0 ? 0 : stun(L([2, 3, 4]))) + (p.rend ? 0 : L([0.15, 0.25, 0.35]) * Math.min(remT, 12)) + 1 : -1;
      case "storm_call": return p.storm > 0 ? -1 : dmgV(L([15, 20, 25]) * Math.min(remT, L([4, 6, 8])));
      case "elemental_fury": return p.fury > 0 ? -1 : L([0.2, 0.35, 0.5]) * Math.min(remT, L([4, 6, 8])) * 0.8;
      case "throw_voice": return f.sneakNext ? -1 : 0.6;
      case "animal_allegiance": return (tags.has("beast") && !(f.calmTurns > 0) ? stun(L([6, 10, 14])) : 0) + L([6, 9, 12]) * Math.min(remT, 10) / Math.max(1, dps);
      case "call_of_valor": return L([14, 20, 28]) * Math.min(remT, 12) / Math.max(1, dps);
      case "call_dragon": return 35 * Math.min(remT, 12) / Math.max(1, dps);
      case "dismay": return tags.has("dragon") || tags.has("undead") || f.calmTurns > 0 ? -1 : stun(L([3, 5, 8]));
    }
    return -1;
  }
  const FX = { marked_for_death: "necro", slow_time: "illusion", dragonrend: "fus", storm_call: "shock", elemental_fury: "glow", throw_voice: "illusion", animal_allegiance: "summon", call_of_valor: "summon", call_dragon: "summon", dismay: "illusion", clear_skies: "glow", whirlwind_sprint: "glow", aura_whisper: "glow" };
  if (typeof FIGHTART !== "undefined" && FIGHTART.SHOUT_FX) Object.assign(FIGHTART.SHOUT_FX, Object.fromEntries(Object.entries(FX).filter(([k]) => !FIGHTART.SHOUT_FX[k])));

  // ---- the Word Wall scene: the curved wall, the word burning in, the chant
  function wallScene(w) {
    if (typeof document === "undefined" || !w) return;
    document.querySelector("#wwall")?.remove();
    const el = document.createElement("div");
    el.id = "wwall"; el.className = "wwall"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Word Wall");
    const glyph = (typeof UIART !== "undefined" ? UIART.shout(w.id, 72) : "");
    const runes = Array.from({ length: 36 }, (_, i) => `<span style="--i:${i}">${"ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ"[(i * 7) % 24]}</span>`).join("");
    el.innerHTML = `<div class="ww-card"><div class="ww-wall" aria-hidden="true">${runes}</div>
      <div class="ww-glyph">${glyph}</div><div class="ww-word">${w.word}</div>
      <p class="ww-sub">Word of Power learned: <b>${w.word}</b> · ${w.shout}</p>
      <p class="ww-hint">${w.unlocked ? "You already understand it." : "Unlock it with a dragon soul in Magic → Shouts."}</p>
      <button class="btn pri" data-ww="ok">Continue</button></div>`;
    document.body.appendChild(el);
    try { if (typeof SOUND !== "undefined") SOUND.fx("shout"); } catch { /* sound is optional */ }
    const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 350); };
    el.addEventListener("click", (e) => { if (e.target.closest("[data-ww]") || e.target === el) close(); });
  }
  const showWall = () => { const w = takeWall(); if (w) wallScene(w); return w; };
  /* after a boss fight the result popup is up first: show the wall once it's closed */
  function showWallWhenFree() {
    if (!lastWall || typeof document === "undefined") return;
    let n = 0;
    const iv = setInterval(() => { if (++n > 600) { clearInterval(iv); return; } if (document.querySelector("#modal, .modal, #xgame")) return; clearInterval(iv); showWall(); }, 400);
  }

  return { NEW, WALLS, TAUGHT, wallWord, readWall, wallsFor, hint, aiValue, wallScene, showWall, showWallWhenFree, takeWall, bindSave };
})();
