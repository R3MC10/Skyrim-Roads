/* Solstheim gameplay ([Skyrim] Dragonborn, condensed; numbers are [OURS]): the boat from Windhelm's docks, landing at
   Raven Rock, Miraak's questline (cultists → the Temple of Miraak → the six All-Maker Stones freed with Bend Will →
   Hermaeus Mora's bargain → Miraak at the summit), the island's dungeon foes, Stalhrim mining and Chitin, Bonemold and
   Stalhrim smithing at Raven Rock. The island's map, places and road foes are in solworld.js; its art in solart.js.
   Your map is whichever region you stand in: WORLD.isSol([s.x, s.y]). Old saves are simply in Skyrim. */
const SOL = (() => {
  const now = () => G.now();
  const FARE = 250;                                         // [OURS] both ways
  const SAIL_SECONDS = 10 * 3600 / G.GAME_SPEED;           // about 10 in-game hours at sea (50 real minutes)
  const DOCKS = {
    Windhelm: { to: "Raven Rock", ship: "the Northern Maiden", captain: "Gjalund Salt-Sage", text: "Gjalund's ship rides at anchor below the city walls, loaded with Dunmer goods for Raven Rock." },
    "Raven Rock": { to: "Windhelm", ship: "the Northern Maiden", captain: "Gjalund Salt-Sage", text: "The Northern Maiden is tied up at the Raven Rock docks, ready to sail back to Windhelm." },
  };
  const isSol = (p) => WORLD.isSol(p);
  const inSol = (s) => isSol([s.x, s.y]);
  const sections = (l) => (DOCKS[l] ? ["docks"] : []);
  const NAMES = { docks: "⛵ Docks" };

  // ---------------------------------------------------------------- the boat
  function canSail(s) {
    const d = DOCKS[s.location];
    if (!d) return "There's no ship here. The Northern Maiden sails from the Windhelm docks.";
    if (s.trip) return "Finish your trip first.";
    if (s.dungeon) return "Leave the dungeon first.";
    if (s.gold < FARE) return `The fare is ${FARE} gold.`;
    return null;
  }
  function sail(s, t = now()) {
    const why = canSail(s); if (why) return why;
    const d = DOCKS[s.location], dest = WORLD.places[d.to].slice(0, 2), here = [s.x, s.y];
    s.gold -= FARE;
    s.trip = { destName: d.to, dest, origin: s.location, start: here, path: [here, here], idx: 0, trail: [here], lastTick: t, status: "travel",
      encounter: null, log: [], boat: true, sail: SAIL_SECONDS, total: SAIL_SECONDS / 60, ship: d.ship };
    s.location = null;
    G.note(s, `⛵ You pay ${d.captain} ${FARE} gold and board ${d.ship} for ${d.to}.`);
    return null;
  }
  /* engine hook: at sea time just passes; then you step off at the other dock */
  function sailOn(s, t, out) {
    const tr = s.trip;
    const dt = Math.max(0, t - tr.lastTick); tr.lastTick = Math.max(tr.lastTick, t); tr.sail -= dt;
    if (tr.sail > 0) return out;
    [s.x, s.y] = tr.dest; s.location = tr.destName; s.trip = null;
    if (!s.discovered.includes(tr.destName)) s.discovered.push(tr.destName);
    s.explored.push([+s.x.toFixed(4), +s.y.toFixed(4)]);
    G.note(s, `⛵ ${tr.ship[0].toUpperCase() + tr.ship.slice(1)} docks at ${tr.destName}.`);
    out.arrived = tr.destName; out.boat = true;
    arrived(s, tr.destName, out);
    return out;
  }
  /* engine hook: you got somewhere (walking or by boat) */
  function arrived(s, name, out = {}) {
    const p = WORLD.places[name]; if (!p || !isSol(p)) return out;
    for (const [n, q] of Object.entries(WORLD.places)) {   // what you can see from where you land
      if (!isSol(q) || s.discovered.includes(n)) continue;
      if (G.pxDist(p, q) <= Math.max(70, G.discoverRadius(q[2]))) s.discovered.push(n);   // you look around as you step off
    }
    const qs = (s.quests = s.quests || {});
    if (!qs.dragonborn) {
      qs.dragonborn = { stage: 0, t: now(), base: { ...(s.stats || {}) } };
      out.solIntro = "As you step off the boat at Raven Rock, Miraak's cultists in their masks and robes come up the docks. \"The false Dragonborn! You will never take what is Miraak's!\" New quest: Dragonborn (Journal).";
      G.note(s, "📜 New quest: Dragonborn. Miraak's cultists were waiting for you at Raven Rock.");
    }
    return out;
  }

  // ---------------------------------------------------------------- Bend Will ([Skyrim] words; effects [OURS])
  POWERS.SHOUTS.bend_will = ["Bend Will", ["GOL", "HAH", "DOV"], [10, 90, 120], "Staggers the foe / turns a beast or person to your side for a while / bends even a dragon to your will."];
  const nextWord0 = POWERS.nextWord;
  POWERS.nextWord = (s) => {   // Skyrim's Word Walls never teach Bend Will: its words are learned on Solstheim
    const w = nextWord0(s); if (!w || w[2] !== "bend_will") return w;
    const keep = POWERS.SHOUTS.bend_will; delete POWERS.SHOUTS.bend_will;
    try { return nextWord0(s); } finally { POWERS.SHOUTS.bend_will = keep; }
  };
  const act0 = POWERS.act;
  POWERS.act = (f, kind, arg) => {
    if (kind !== "shout" || arg !== "bend_will") return act0(f, kind, arg);
    const s = f.s, lv = POWERS.level(s, "bend_will"), tags = f.tags || new Set(), cd = POWERS.SHOUTS.bend_will[2];
    if (!s._test) s.voiceAt = f.t + cd[lv - 1];
    f.shoutedThisTurn = true;
    const cry = ["GOL", "HAH", "DOV"].slice(0, lv).join(" ") + "!";
    if (lv >= 3 && tags.has("dragon")) { f.calmTurns = Math.max(f.calmTurns || 0, 10); f.allies.push({ name: "A bent dragon", dmg: 22 }); return `${cry} Bend Will: the dragon bows its head and turns on its own kind`; }
    if (lv >= 2 && (tags.has("beast") || tags.has("humanoid")) && !tags.has("boss")) { f.calmTurns = Math.max(f.calmTurns || 0, 6); return `${cry} Bend Will: your foe lowers its weapon, its will is yours`; }
    f.eParalyzed = Math.max(f.eParalyzed || 0, 1); f.ehp -= 15; return `${cry} Bend Will staggers it (15)`;
  };
  const WORD_FLAGS = [["solGol", "GOL"], ["solHah", "HAH"], ["solDov", "DOV"]];
  /* learn the words the questline gave you (flags set by stage rewards) */
  function sync(s) {
    const got = [];
    for (const [flag, w] of WORD_FLAGS) if (s[flag] && !(POWERS.known(s, w) && POWERS.unlocked(s, w))) {
      POWERS.learnWord(s, w); s.unlocked = [...new Set([...(s.unlocked || []), w])]; got.push(w);
    }
    if (got.length) G.note(s, `🗣 You understand ${got.join(" and ")} (Bend Will). Add it to your tactics.`);
    return got;
  }
  const check0 = QUESTS.check;
  QUESTS.check = (s) => { const m = check0(s); const w = sync(s); if (w.length) m.push(`🗣 You understand ${w.join(" and ")}: Bend Will grows stronger.`); return m; };
  const needBW = (n) => (s) => { sync(s); return POWERS.level(s, "bend_will") >= n ? null : `You need ${n === 1 ? "the first word" : `${n} words`} of Bend Will for this.`; };

  // ---------------------------------------------------------------- the questline
  const E = (name, health, damage, tags, extra = {}) => ({ name, health, damage, tags, level: 20, danger: "high", gold: [0, 0], text: "", ...extra });
  const FREA = [["Frea", 12]];
  QUESTS.L.dragonborn = { name: "Dragonborn", giver: "Raven Rock, Solstheim", stages: [
    { title: "Dragonborn", text: "Cultists in Miraak's masks met you at the Raven Rock docks. Face them before they strike again.", obj: { talk: "Raven Rock", label: "Face the cultists", fight: E("Miraak's cultists", 150, 18, ["humanoid", "elite"]) }, reward: { gold: 150 } },
    { title: "The Temple of Miraak", text: "The cultists carried a map to the Temple of Miraak in the north. Clear the temple; a Word Wall waits at its heart.", obj: { clear: "Temple of Miraak" }, reward: { gold: 300, flag: "solGol" } },
    { title: "The Earth Stone", text: "You know GOL. In Raven Rock, the Earth Stone is caged in Miraak's black stone. Shout Bend Will at it and deal with what comes out.", obj: { talk: "Earth Stone", label: "Shout GOL at the Earth Stone", need: needBW(1), fight: E("Lurker", 230, 25, ["big", "elite"]) }, reward: { gold: 200, flag: "solEarth" } },
    { title: "The Fate of the Skaal", text: "The Skaal remember the All-Maker. Find Storn Crag-Strider and his daughter Frea in Skaal Village, in the snowy north.", obj: { talk: "Skaal Village", label: "Speak with Storn and Frea" }, reward: { gold: 100, flag: "solSkaal" } },
    { title: "The Wind Stone", text: "Frea will come with you. Free the Wind Stone, north-west of the village. The Skaal say the wind will teach you HAH.", obj: { talk: "Wind Stone", label: "Shout at the Wind Stone", need: needBW(1), fight: E("Miraak's thralls", 170, 20, ["humanoid", "elite"]), allies: FREA }, reward: { gold: 200, flag: "solHah" } },
    { title: "The Water Stone", text: "The Water Stone stands on the west coast, past Tel Mithryn. Something lurks around it.", obj: { talk: "Water Stone", label: "Shout at the Water Stone", need: needBW(1), fight: E("Lurker", 250, 26, ["big", "elite"]), allies: FREA }, reward: { gold: 200, flag: "solWater" } },
    { title: "The Beast Stone", text: "Rieklings are camped around the Beast Stone, south of Thirsk Mead Hall.", obj: { talk: "Beast Stone", label: "Shout at the Beast Stone", need: needBW(1), fight: E("Riekling chief", 190, 22, ["humanoid", "elite"]), allies: FREA }, reward: { gold: 200, flag: "solBeast" } },
    { title: "The Sun Stone", text: "Deep in the ash wastes the Sun Stone is ringed by ash spawn.", obj: { talk: "Sun Stone", label: "Shout at the Sun Stone", need: needBW(1), fight: E("Ash spawn immolator", 200, 24, ["undead", "elite"]), allies: FREA }, reward: { gold: 200, flag: "solSun" } },
    { title: "The Tree Stone", text: "The last stone, just south of Skaal Village. A burnt spriggan guards it.", obj: { talk: "Tree Stone", label: "Shout at the Tree Stone", need: needBW(1), fight: E("Burnt spriggan matron", 210, 25, ["humanoid", "elite"]), allies: FREA }, reward: { gold: 250, flag: "solTree" } },
    { title: "At the Summit of Apocrypha", text: "Every stone is free. Storn will read Miraak's Black Book and bargain with Hermaeus Mora for his last secret. Go back to Skaal Village.", obj: { talk: "Skaal Village", label: "Read the Black Book with Storn" }, reward: { gold: 300, items: ["black_book"], flag: "solDov" } },
    { title: "Miraak", text: "Hermaeus Mora took Storn and gave you DOV. Open the Black Book at the summit of the Temple of Miraak and face the first Dragonborn.", obj: { talk: "Temple of Miraak", label: "Open the Black Book and face Miraak", need: needBW(3), fight: E("Miraak", 460, 30, ["humanoid", "mage", "elite", "boss"]) }, reward: { gold: 2500, items: ["miraak_robes", "miraak_sword"], title: "Dragonborn of Solstheim" } },
  ] };
  QUESTS.REC.dragonborn = [20, 22, 23, 24, 25, 26, 26, 27, 28, 29, 30];   // the summit: level 30+
  const STONES = ["Earth Stone", "Wind Stone", "Water Stone", "Beast Stone", "Sun Stone", "Tree Stone"];
  const STONE_FLAG = { "Earth Stone": "solEarth", "Wind Stone": "solHah", "Water Stone": "solWater", "Beast Stone": "solBeast", "Sun Stone": "solSun", "Tree Stone": "solTree" };
  const freed = (s, stone) => !!s[STONE_FLAG[stone]];

  // ---------------------------------------------------------------- the island's dungeons
  const DE = (name, health, damage, tags, gold, text) => ({ name, health, damage, tags, gold, text, level: tags.includes("big") ? 24 : tags.includes("elite") ? 16 : 10, danger: tags.includes("elite") ? "high" : "medium" });
  Object.assign(DUNGEONS.ENEMY, {
    hopper: DE("Ash hopper", 22, 5, ["beast"], [0, 0], "Ash hoppers leap at you from the dark."),
    riekling: DE("Riekling", 45, 10, ["humanoid"], [2, 14], "A riekling screeches and hurls a spear."),
    spawn: DE("Ash spawn", 70, 14, ["undead"], [0, 10], "An ash spawn rises out of a drift of cinders."),
    netch: DE("Bull netch", 110, 12, ["beast"], [0, 0], "A netch floats down the passage, tendrils dripping."),
    burnt: DE("Burnt spriggan", 95, 16, ["humanoid", "elite"], [0, 0], "Blackened bark creaks; a burnt spriggan unfolds from the wall."),
    rchief: DE("Riekling chief", 150, 20, ["humanoid", "elite"], [30, 90], "The riekling chief bangs his shield and charges."),
    immolator: DE("Ash spawn immolator", 170, 22, ["undead", "elite"], [10, 40], "An ash spawn wreathed in flame throws a burning skull."),
    lurker: DE("Lurker", 240, 26, ["big", "elite"], [0, 0], "The floor splits. A lurker of Apocrypha drags itself up, tentacles first."),
    cultist: DE("Cultist", 60, 13, ["humanoid", "mage"], [5, 25], "A masked cultist turns from the altar. \"For Miraak!\""),
    seeker: DE("Seeker", 140, 20, ["elite", "mage"], [0, 0], "A seeker drifts out of a page of black ink, its many eyes on you."),
  });
  DUNGEONS.THEMES.ashcave = { name: "ash cave", foes: [["hopper", 3], ["riekling", 3], ["spawn", 3], ["netch", 1]], elite: ["burnt", "immolator"], boss: ["rchief", "immolator", "lurker"],
    loot: ["mat_chitin", "mat_netch_leather", "ing_ash_hopper_jelly", "ing_spawn_ash", "ore_iron"], traps: ["a sinkhole of loose ash", "a burning-oil trip line", "a ceiling of hanging ash ready to fall"] };
  DUNGEONS.THEMES.miraak = { name: "temple of Miraak", foes: [["cultist", 4], ["restless", 2], ["draugr", 2], ["spawn", 1]], elite: ["seeker"], boss: ["seeker", "lurker", "lurker"],
    loot: ["ing_spawn_ash", "ancient_nord_sword", "ancient_nord_helmet", "gem_amethyst"], puzzle: true, traps: ["a pillar of black stone that whispers", "a pressure plate under swinging blades", "a dart wall"] };

  // ---------------------------------------------------------------- Raven Rock and the Skaal
  Object.assign(TOWNS.INNS, { "Raven Rock": "The Retching Netch", "Thirsk Mead Hall": "Thirsk Mead Hall" });
  Object.assign(TOWNS.TRAINERS, { "Raven Rock": [["Glover Mallory", "Smithing", "expert"]], "Tel Mithryn": [["Talvas Fathryon", "Conjuration", "expert"]], "Skaal Village": [["Frea", "Light Armor", "expert"]] });

  // ---------------------------------------------------------------- Stalhrim, Chitin and Bonemold
  Object.assign(SMITH.MINES, {
    "Kolbjorn Barrow": ["Kolbjorn stalhrim deposit", [["ore_stalhrim", 1]]],
    "Benkongerike": ["Benkongerike stalhrim deposit", [["ore_stalhrim", 1]]],
    "Raven Rock Mine": ["Raven Rock Mine", [["ore_iron", 3], ["ore_corundum", 2], ["ore_moonstone", 1]]],
  });
  const STALHRIM_MINES = ["Kolbjorn Barrow", "Benkongerike"];
  const TECH_SKILL = 40;   // [OURS] Baldor's "Ancient Technique" needs Smithing 40
  const knowsTechnique = (s) => !!s.solStalhrim;
  const mine0 = SMITH.mine;
  SMITH.mine = (s, place = s.location, t) => {
    if (STALHRIM_MINES.includes(place) && !knowsTechnique(s)) return `The stalhrim won't even chip under an ordinary pick. Baldor Iron-Shaper in Skaal Village knows the Skaal's old way (Smithing ${TECH_SKILL}).`;
    return mine0(s, place, t);
  };
  function learnTechnique(s) {
    if (s.location !== "Skaal Village") return "Baldor works at the forge in Skaal Village.";
    if (knowsTechnique(s)) return "Baldor nods. \"You know the way. Strike with the All-Maker's patience.\"";
    if (G.skill(s, "Smithing") < TECH_SKILL) return `Baldor shakes his head. "Come back when you know your way around a forge" (Smithing ${TECH_SKILL}).`;
    s.solStalhrim = true; G.note(s, "⛏ Baldor Iron-Shaper taught you the Skaal's ancient technique: you can mine stalhrim at Kolbjorn Barrow and Benkongerike.");
    return "Baldor shows you the old Skaal way: you can now mine stalhrim at Kolbjorn Barrow and Benkongerike, and Glover Mallory in Raven Rock can show you how to forge it.";
  }
  SMITH.GROUPS.push(["chitin", "Chitin & bonemold"], ["stalhrim", "Stalhrim"]);
  const RR = "Raven Rock";
  const R = (group, mats, perk = null) => ({ group, mats, perk, where: RR });
  Object.assign(SMITH.RECIPES, {   // [OURS] amounts; [Skyrim] materials (Stalhrim needs the best smithing perk we have: Advanced Armors)
    chitin_helmet: R("chitin", [["mat_chitin", 2], ["mat_strips", 1]]), chitin_armor: R("chitin", [["mat_chitin", 4], ["mat_strips", 3]]),
    chitin_bracers: R("chitin", [["mat_chitin", 1], ["mat_strips", 2]]), chitin_boots: R("chitin", [["mat_chitin", 1], ["mat_strips", 2]]),
    bonemold_helmet: R("chitin", [["mat_netch_leather", 1], ["mat_iron", 1], ["ing_bone_meal", 1]]), bonemold_armor: R("chitin", [["mat_netch_leather", 3], ["mat_iron", 2], ["ing_bone_meal", 2]]),
    bonemold_gauntlets: R("chitin", [["mat_netch_leather", 1], ["mat_iron", 1]]), bonemold_boots: R("chitin", [["mat_netch_leather", 1], ["mat_iron", 1]]),
    bonemold_shield: R("chitin", [["mat_netch_leather", 2], ["mat_iron", 1]]),
    stalhrim_dagger: R("stalhrim", [["ore_stalhrim", 1], ["mat_strips", 1]], "advanced_armors"), stalhrim_sword: R("stalhrim", [["ore_stalhrim", 2], ["mat_strips", 1]], "advanced_armors"),
    stalhrim_war_axe: R("stalhrim", [["ore_stalhrim", 2], ["mat_strips", 1]], "advanced_armors"), stalhrim_greatsword: R("stalhrim", [["ore_stalhrim", 3], ["mat_strips", 2]], "advanced_armors"),
    stalhrim_bow: R("stalhrim", [["ore_stalhrim", 2], ["mat_strips", 2]], "advanced_armors"),
    stalhrim_helmet: R("stalhrim", [["ore_stalhrim", 1], ["mat_strips", 1]], "advanced_armors"), stalhrim_armor: R("stalhrim", [["ore_stalhrim", 3], ["mat_strips", 3]], "advanced_armors"),
    stalhrim_gauntlets: R("stalhrim", [["ore_stalhrim", 1], ["mat_strips", 1]], "advanced_armors"), stalhrim_boots: R("stalhrim", [["ore_stalhrim", 1], ["mat_strips", 1]], "advanced_armors"),
    stalhrim_heavy_helmet: R("stalhrim", [["ore_stalhrim", 2], ["mat_strips", 1]], "advanced_armors"), stalhrim_heavy_armor: R("stalhrim", [["ore_stalhrim", 4], ["mat_strips", 3]], "advanced_armors"),
  });
  D.LOOT.humanoid.push(["mat_chitin", 0.03], ["mat_netch_leather", 0.02]);

  // ---------------------------------------------------------------- free roam on the island's own map
  const roamPlan0 = ROAM.plan;
  ROAM.plan = (s, p) => {
    const mine = isSol([s.x, s.y]);
    if (!isSol(p)) return mine ? { err: "That's Skyrim, across the sea. Take the boat from the Raven Rock docks." } : roamPlan0(s, p);
    if (!mine) return { err: "Solstheim is across the sea. Take the boat from the Windhelm docks." };
    const ST = Terrain.Sol, L = Terrain.solL(p);
    if (L[0] < 0 || L[1] < 0 || L[0] > 1 || L[1] > 1) return { err: "That's off the edge of the map." };
    let q = ST.SPEED[ST.typeAtPos(L)] > 0 ? L : null;
    if (!q) {
      const cx = Math.floor(L[0] * ST.GW), cy = Math.floor(L[1] * ST.GH);
      for (let r = 1; r <= 14 && !q; r++) {
        let bd = Infinity;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= ST.GW || y >= ST.GH || !(ST.SPEED[ST.grid[y * ST.GW + x]] > 0)) continue;
          const c = [(x + 0.5) / ST.GW, (y + 0.5) / ST.GH], d = Math.hypot((c[0] - L[0]) * 1000, (c[1] - L[1]) * 700);
          if (d < bd) { bd = d; q = c; }
        }
      }
    }
    if (!q) return { err: "That's open water. Pick a spot on land." };
    const g = Terrain.solG(q);
    if (G.pxDist([s.x, s.y], g) < 4) return { err: "You're already there." };
    return { pos: [+g[0].toFixed(4), +g[1].toFixed(4)], name: ROAM.nameFor(s, g), snapped: q !== L, ground: Terrain.NAMES[Terrain.typeAtPos(g)] };
  };

  // ---------------------------------------------------------------- screens (ui.js asks for these)
  const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.max(1, Math.round(m))} min`);
  function docksHTML(s, esc, opts = {}) {
    const d = DOCKS[s.location]; if (!d) return { note: "", body: "" };
    const portrait = typeof NPCART !== "undefined" ? NPCART.portrait({ name: d.captain, race: "nord", sex: "m", role: "driver", title: "Captain of the Northern Maiden" }, 36) : "";
    const ok = s.gold >= FARE && !opts.wanted;
    return {
      note: `${d.text} The crossing takes about 10 hours (${fmtMins(SAIL_SECONDS / 60)} real time) and nothing attacks a ship at sea. Your horse comes with you.`,
      body: `<div class="item">${portrait}<div class="t">⛵ Sail to ${esc(d.to)}<span>${esc(d.captain)} · ${esc(d.ship)} · about ${fmtMins(SAIL_SECONDS / 60)}</span></div><span class="num gold">${FARE}</span><button class="btn sm pri" data-act="sail" ${ok ? "" : "disabled"}>Sail</button></div>`,
    };
  }
  /* extras inside a town section (the Skaal smith's technique, the Stalhrim note at Raven Rock's forge) */
  function extraHTML(s, l, section, esc) {
    if (l === "Skaal Village" && (section === "blacksmith" || section === "forge")) {
      const k = knowsTechnique(s);
      return `<div class="item ${k ? "on" : ""}"><div class="t">⛏ Baldor Iron-Shaper's ancient technique<span>${k ? "You know how to mine stalhrim (Kolbjorn Barrow, Benkongerike)." : `How the Skaal mine stalhrim. Needs Smithing ${TECH_SKILL}.`}</span></div><button class="btn sm" data-act="solact" data-id="technique" ${k ? "disabled" : ""}>${k ? "Learned" : "Ask"}</button></div>`;
    }
    if (l === RR && section === "forge") return `<p class="sub" style="margin-top:8px">Glover Mallory shows you Chitin, Bonemold and Stalhrim at this forge only. Stalhrim needs the Advanced Armors perk and ore from the Skaal's deposits.</p>`;
    return "";
  }
  /* a line under a Solstheim place's picture: All-Maker Stones and the temple */
  function placeLine(s, l) {
    if (STONES.includes(l)) return freed(s, l) ? "An All-Maker Stone, free of Miraak's black stone. The Skaal sing here again." : "An All-Maker Stone, caged in Miraak's black stone. Workers stand around it in a trance, building something.";
    if (l === "Temple of Miraak") return "Miraak's temple, half buried in the snow. His cultists come and go.";
    if (l === "Raven Rock") return "The Dunmer town of Raven Rock, under the Bulwark. The docks are in the Town tab.";
    return "";
  }
  function act(s, id) {
    if (id === "technique") return learnTechnique(s);
    return "Nothing happens.";
  }
  const region = (s) => WORLD.regionOf([s.x, s.y]);
  /* the map's view: which region a point belongs to, for player cards and the map */
  const sameMap = (a, b) => WORLD.same(a, b);
  return { FARE, SAIL_SECONDS, DOCKS, STONES, STALHRIM_MINES, TECH_SKILL, NAMES, inSol, isSol, sections, canSail, sail, sailOn, arrived, sync, freed, knowsTechnique, learnTechnique,
    docksHTML, extraHTML, placeLine, act, region, sameMap };
})();
