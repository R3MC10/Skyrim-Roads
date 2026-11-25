/* [Skyrim] The Dwemer deep-dive: Calcelmo's lexicon quest line, Dwemer puzzles, scrap and the full Dwarven set.
   - The line (dw_lexicon): Calcelmo, the Dwemer scholar in Markarth's Understone Keep, sends you through Mzinchaleft,
     Raldbthar and Alftand. Alftand holds a Dwemer lexicon; you read it with him (the lexicon puzzle), ride Alftand's great
     lift down into Blackreach (blackreach.js), read the lexicon in the light of the Tower of Mzark, beat the Centurion
     master at the Great Dynamo, and bring it all back to Markarth. Story beats are retold in our own words; the stage
     order and places are [OURS] (in Skyrim the lexicon quest belongs to Septimus Signus).
   - Puzzles: Dwemer puzzle rooms in dungeons are valve puzzles (turn a valve and it turns its neighbours too: get every
     needle back to the top before the pressure blows), and the lexicon is three linked rings. Both are pure rules here
     (seeded, solvable, a BFS gives hints) and small overlays in the browser.
   - Loot: Dwemer scrap (Solid Dwemer Metal, Dwemer Gear, Large Dwemer Strut) that you smelt into Dwarven ingots at a forge
     (needs Dwarven Smithing, like Skyrim); the rest of the Dwarven set (dagger, mace, greatsword, battleaxe, warhammer,
     gauntlets, boots, shield) in Dwemer ruins and at the forge, which uses up the materials.
   - Perks (perkfx.js): Dwemer Tinkerer (Smithing), Dwemer Lore (Lockpicking), Blind Hunter (Sneak), Steam-Proof (Heavy Armor).
   - Party: only the leader turns the lexicon or the valves; party members see the result. Dungeon stages are ordinary
     clears (co-op runs, loot vote at the end). */
const DWEMER = (() => {
  const E = (name, health, damage, tags, extra = {}) => ({ name, health: Math.round(health * 0.84), damage: Math.round(damage * 0.84), tags, level: 10, danger: "high", gold: [0, 0], text: "", hitCap: 0.36, ...extra });   // as dawnguard.js: no blow takes more than 36% of your health
  const DOM = typeof document !== "undefined";
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pfx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  const perk = (s, id) => (typeof PERKS !== "undefined" ? PERKS.rank(s, id) : 0);

  // ---- things to find and make ([Skyrim] names; stats close to Skyrim's Dwarven tier)
  Object.assign(D.ITEMS, {
    dwemer_scrap: { name: "Solid Dwemer Metal", slot: "material", weight: 2, value: 25 },
    dwemer_gear: { name: "Dwemer Gear", slot: "material", weight: 3, value: 45 },
    dwemer_strut: { name: "Large Dwemer Strut", slot: "material", weight: 6, value: 70 },
    dwemer_lexicon: { name: "Dwemer Lexicon", slot: "trophy", weight: 1, value: 0, quest: true, noTrade: true, desc: "A brass cube covered in Dwemer script. Its three rings turn." },
    dwemer_dynamo: { name: "Centurion Dynamo Core", slot: "misc", weight: 3, value: 350, desc: "The glowing heart of a Dwarven centurion. Still warm." },
    dwarven_dagger: { name: "Dwarven Dagger", slot: "weapon", hands: 1, skill: "One-Handed", damage: 7, weight: 3.5, value: 55 },
    dwarven_mace: { name: "Dwarven Mace", slot: "weapon", hands: 1, skill: "One-Handed", damage: 12, weight: 19, value: 190 },
    dwarven_greatsword: { name: "Dwarven Greatsword", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 19, weight: 23, value: 270 },
    dwarven_battleaxe: { name: "Dwarven Battleaxe", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 20, weight: 26, value: 300 },
    dwarven_warhammer: { name: "Dwarven Warhammer", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 22, weight: 27, value: 325 },
    dwarven_gauntlets: { name: "Dwarven Gauntlets", slot: "hands", type: "heavy", armor: 13, weight: 8, value: 85 },
    dwarven_boots: { name: "Dwarven Boots", slot: "feet", type: "heavy", armor: 13, weight: 10, value: 85 },
    dwarven_shield: { name: "Dwarven Shield", slot: "shield", type: "heavy", armor: 26, weight: 12, value: 225 },
    // rewards ([OURS] names and stats)
    tonal_warhammer: { name: "Tonal Hammer of Mzark", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 24, weight: 26, value: 1400, noTrade: true,
      enchant: { effect: "shock", magnitude: 14, max_magnitude: 30, base_cost: 14, capacity: 1600 }, desc: "It hums when you swing it, the same note as the tower's lens." },
    lexicon_helm: { name: "Calcelmo's Lens Helm", slot: "head", type: "heavy", armor: 21, weight: 10, value: 1200, noTrade: true,
      aenchant: { key: "skill:Smithing", mag: 15, name: "Fortify Smithing", more: [{ key: "skill:Lockpicking", mag: 15, name: "Fortify Lockpicking" }] } },
  });
  const NEW_GEAR = ["dwarven_dagger", "dwarven_mace", "dwarven_greatsword", "dwarven_battleaxe", "dwarven_warhammer", "dwarven_gauntlets", "dwarven_boots", "dwarven_shield"];
  const SCRAP = { dwemer_scrap: 1, dwemer_gear: 2, dwemer_strut: 3 };   // Dwarven ingots per piece ([Skyrim] 1 / 2 / 3)

  // ---- where they turn up: Dwemer ruins, their machines, Markarth's smiths
  if (typeof DUNGEONS !== "undefined") {
    const T = DUNGEONS.THEMES.dwemer;
    T.loot.push(...NEW_GEAR, "dwemer_scrap", "dwemer_scrap", "dwemer_scrap", "dwemer_gear", "dwemer_gear", "dwemer_strut");
    const ENEMY = DUNGEONS.ENEMY;
    if (ENEMY.falmer && !ENEMY.falmer.tags.includes("falmer")) ENEMY.falmer.tags = [...ENEMY.falmer.tags, "falmer"];
    ENEMY.ballista = { name: "Dwarven ballista", health: 120, damage: 19, tags: ["construct", "elite"], gold: [5, 25], level: 12, danger: "high", text: "A brass ballista on four legs swings its bolt-thrower round at you." };
    ENEMY.falmerShaman = { name: "Falmer shadowmaster", health: 125, damage: 19, tags: ["humanoid", "falmer", "elite"], gold: [10, 40], level: 12, danger: "high", text: "A Falmer in chitin and bone hisses a spell from the dark." };
    T.elite.push("ballista", "falmerShaman");
  }

  // ---- the forge: new Dwarven pieces, and scrap smelts into ingots (Dwarven Smithing, [Skyrim])
  if (typeof SMITH !== "undefined") {
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    for (const id of NEW_GEAR) {   // same formula as smithing.js uses for the Dwarven pieces it found at load
      const it = D.ITEMS[id], isW = it.slot === "weapon", strips = isW ? 1 : it.slot === "chest" ? 3 : it.slot === "head" ? 1 : 2;
      const main = clamp(Math.max(Math.round(it.weight / (isW ? 5 : 6)), Math.round(it.value / 30)), 1, 6);
      SMITH.RECIPES[id] = { group: "dwarven", mats: [["mat_dwarven", clamp(Math.max(main, Math.round(it.value / 60)), 1, 8)], ["mat_steel", 1], ["mat_strips", strips]], perk: "dwarven_smithing" };
    }
    for (const [id, n] of Object.entries(SCRAP)) SMITH.REFINE.push(["mat_dwarven", n, [[id, 1]], "smelt"]);
    const isScrap = (k) => !!SMITH.REFINE[k] && SCRAP[SMITH.REFINE[k][2][0][0]] != null;
    const info0 = SMITH.refineInfo, refine0 = SMITH.refine;
    SMITH.refineInfo = (s, k) => { const r = info0(s, k); if (isScrap(k)) { r.n += Math.round(pfx(s, "dwscrap")); if (!perk(s, "dwarven_smithing")) { r.block = "Needs the Dwarven Smithing perk (Smithing)."; r.times = 0; } } return r; };
    SMITH.refine = (s, k, all = false) => {
      if (!isScrap(k)) return refine0(s, k, all);
      if (!perk(s, "dwarven_smithing")) return "Smelting Dwemer metal needs the Dwarven Smithing perk (Smithing).";
      const times = info0(s, k).times, msg = refine0(s, k, all), extra = Math.round(pfx(s, "dwscrap")) * (all ? times : 1);
      if (times && /^You smelt/.test(msg) && extra > 0) { G.give(s, "mat_dwarven", extra); return `${msg} Dwemer Tinkerer: +${extra} Dwarven Metal Ingot.`; }
      return msg;
    };
  }

  // ---- puzzles: small seeded rules, solvable by construction
  function rng(seed) { let a = (typeof seed === "string" ? [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) : seed) >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /* a ring puzzle: n rings with m faces; turning ring i moves every ring in links[i] by one face */
  const press = (pz, pos, i) => { const p = pos.slice(); for (const j of pz.links[i]) p[j] = (p[j] + 1) % pz.m; return p; };
  const solved = (pz, pos) => pos.every((v, i) => v === pz.goal[i]);
  /* shortest list of turns from pos to the goal (breadth-first; at most 6^3 or 4^5 states) */
  function solve(pz, pos) {
    const key = (p) => p.join(","), seen = new Map([[key(pos), null]]), q = [pos];
    while (q.length) {
      const p = q.shift();
      if (solved(pz, p)) { const path = []; let k = key(p); while (seen.get(k)) { const [prev, i] = seen.get(k); path.unshift(i); k = prev; } return path; }
      for (let i = 0; i < pz.n; i++) { const nx = press(pz, p, i), k = key(nx); if (!seen.has(k)) { seen.set(k, [key(p), i]); q.push(nx); } }
    }
    return null;
  }
  /* valves: 5 valves, each needle has 4 positions, a valve turns its neighbours too; get every needle back to the top */
  function valves(seed, tier = 2, lore = 0) {
    const r = rng(seed), n = 5, m = 4, links = [...Array(n)].map((_, i) => [i - 1, i, i + 1].filter((j) => j >= 0 && j < n));
    const pz = { kind: "valves", n, m, links, goal: Array(n).fill(0) };
    let pos = pz.goal.slice();
    for (let k = 0; k < 3 + tier; k++) { const i = Math.floor(r() * n); for (let z = 0; z < m - 1; z++) pos = press(pz, pos, i); }   // turned back: every scramble can be undone
    if (solved(pz, pos)) pos = press(pz, press(pz, press(pz, pos, 2), 2), 2);
    const par = solve(pz, pos).length;
    return Object.assign(pz, { start: pos, pos, par, limit: par + 5 + (lore ? 3 : 0), moves: 0, lore: !!lore });
  }
  /* the lexicon: three rings of six glyphs; a ring drags the next one round with it. Calcelmo's notes give the goal. */
  const GLYPHS = ["Sun", "Stone", "Song", "Gear", "Eye", "Flame"];
  function lexicon(seed, lore = 0) {
    const r = rng(seed), n = 3, m = 6, links = [[0, 1], [1, 2], [2, 0]];
    const goal = [0, 1, 2].map(() => Math.floor(r() * m));
    const pz = { kind: "lexicon", n, m, links, goal };
    let pos = goal.slice();
    for (let k = 0; k < 4; k++) { const i = Math.floor(r() * n); for (let z = 0; z < m - 1; z++) pos = press(pz, pos, i); }
    if (solved(pz, pos)) pos = press(pz, pos, 0);
    const par = solve(pz, pos).length;
    return Object.assign(pz, { start: pos, pos, par, limit: 99, moves: 0, lore: !!lore });
  }
  /* one turn; returns "solved" | "burst" (valves: too many turns, the pressure blows) | "" */
  function turn(pz, i) {
    if (pz.done) return pz.done;
    pz.pos = press(pz, pz.pos, i); pz.moves++;
    if (solved(pz, pz.pos)) return (pz.done = "solved");
    if (pz.moves >= pz.limit) return (pz.done = "burst");
    return "";
  }
  const hint = (pz) => (pz.lore ? (solve(pz, pz.pos) || [])[0] ?? null : null);
  /* quality for the dungeon mini-game rules: 1 at par, less for every extra turn; 0.2 on a burst */
  const quality = (pz) => (pz.done === "solved" ? Math.max(0.5, Math.min(1, 1 - 0.07 * (pz.moves - pz.par))) : 0.2);

  // ---- the quest line
  const q = (s) => (s.quests = s.quests || {});
  const st = (s) => (s.dwq = s.dwq || {});
  const lexSeed = (s) => "lex|" + (s.id || s.name || "hero");
  const lexDone = (s) => !!st(s).lexicon;
  const L = {
    dw_lexicon: { name: "The Dwemer Lexicon", giver: "Calcelmo, Understone Keep in Markarth (from level 14)", start: "Markarth", stages: [
      { title: "Calcelmo's Request", rec: 14, text: "Calcelmo, the old Dwemer scholar in Understone Keep, needs a rubbing of the great door deep in Mzinchaleft. Falmer moved in years ago. Clear the ruin.",
        obj: { clear: "Mzinchaleft" }, reward: { gold: 200, items: ["dwemer_gear"] } },
      { title: "The Raldbthar Gauge", rec: 16, text: "His notes speak of a pressure gauge in Raldbthar that still keeps time after thousands of years. Clear the ruin and read it.",
        obj: { clear: "Raldbthar" }, reward: { gold: 250 } },
      { title: "Alftand's Lexicon", rec: 18, text: "The gauge points north. Under the glacier at Alftand, a lexicon waits in a sealed case: a brass cube that holds a lost Dwemer word. Bring it out.",
        obj: { clear: "Alftand" }, reward: { gold: 300, items: ["dwemer_lexicon"] } },
      { title: "Reading the Lexicon", rec: 19, text: "Take the lexicon back to Calcelmo in Markarth. Its three rings have to be turned to match his notes before it will speak.",
        obj: { talk: "Markarth", label: "Turn the lexicon's rings with Calcelmo", need: (s) => (lexDone(s) ? null : "Calcelmo spreads his notes on the table. Turn the lexicon's rings to match them first.") }, reward: { gold: 300 } },
      { title: "The Great Lift", rec: 20, text: "The lexicon names a place below Alftand: Blackreach, a whole Dwemer city under the ground. Falmer guard the great lift. Fight your way onto it.",
        obj: { talk: "Alftand", label: "Fight your way onto the great lift", fight: E("Falmer at the lift", 400, 34, ["humanoid", "falmer", "elite"]) }, reward: { gold: 300 } },
      { title: "The Tower of Mzark", rec: 22, text: "Blackreach is open to you. Cross the glowing caverns to the Tower of Mzark and read the lexicon in the light of its great lens.",
        obj: { flag: "dwMzark", at: "Alftand" }, reward: { gold: 350 } },
      { title: "Heart of the Deep", rec: 24, text: "The lens showed the way to the Great Dynamo, where a Centurion master still guards the city's heart. Break it.",
        obj: { flag: "dwCenturion", at: "Alftand" }, reward: { gold: 400 } },
      { title: "Calcelmo's Due", rec: 24, text: "Ride back up and tell Calcelmo what lies under Skyrim. He'll want every word.",
        obj: { talk: "Markarth", label: "Tell Calcelmo about Blackreach" }, reward: { gold: 1500, items: ["lexicon_helm"], flag: "dwLexiconDone", title: "Delver of the Deep" } },
    ] },
  };
  const LINES = Object.keys(L), ID = "dw_lexicon";
  const STAGE = { lexicon: 3, lift: 4, mzark: 5, centurion: 6 };
  const role = (s) => (typeof PARTYPLAY !== "undefined" ? PARTYPLAY.role(s) : "solo");
  /* why you can't join (null when you can) */
  const gate = (s) => ((s.level || 1) < 14 ? "Calcelmo doesn't hand Dwemer secrets to beginners. Come back at level 14." : null);
  /* Blackreach is open once you've fought onto the great lift */
  const reachOpen = (s) => !!st(s).reach || (q(s)[ID] && (q(s)[ID].done || q(s)[ID].stage > STAGE.lift));
  function sync(s) {
    const out = [];
    if (reachOpen(s) && !st(s).reach) { st(s).reach = true; out.push("\uE11E The great lift groans into life. Blackreach is open: go down from Alftand (Map, at Alftand)."); }
    if (out.length) for (const m of out) G.note(s, m);
    return out;
  }
  /* solve the lexicon (the overlay calls this when the rings line up; tests call it directly). Leader only in a party. */
  function lexiconSolved(s) {
    if (role(s) === "member") return "In a party only your leader turns the lexicon's rings.";
    const v = q(s)[ID];
    if (!v || v.done || v.stage !== STAGE.lexicon) return "Calcelmo isn't ready for that.";
    if (!(s.inv || []).some((r) => r.item === "dwemer_lexicon")) G.give(s, "dwemer_lexicon");   // bound to you; never lost, but just in case
    st(s).lexicon = true;
    return "The rings click into place. The lexicon hums, and Calcelmo's quill races across the page.";
  }

  // ---- in a dungeon: Dwemer puzzle rooms are valve puzzles; Dwemer Lore finds more scrap
  if (typeof DUNGEONS !== "undefined") {
    const act0 = DUNGEONS.act;
    DUNGEONS.act = (s, choice, t) => {
      const d = s.dungeon, dwem = d?.theme === "dwemer", e = d?.room?.enemy;
      const res = act0(s, choice, t);
      if (dwem && e && res && res.fight?.won && !res.died && s.dungeon) {   // machines break into scrap ([Skyrim]); Dwemer Lore finds more
        const got = [];
        if ((e.tags || []).includes("construct")) { const r = Math.random(); if (r < 0.45) got.push(r < 0.06 ? "dwemer_strut" : r < 0.2 ? "dwemer_gear" : "dwemer_scrap"); }
        if (pfx(s, "dwloot") > 0 && Math.random() < pfx(s, "dwloot")) got.push(Math.random() < 0.3 ? "dwemer_gear" : "dwemer_scrap");
        for (const id of got) { G.give(s, id); if (Array.isArray(s.dungeon.found)) s.dungeon.found.push(D.ITEMS[id].name); res.loot = [...(res.loot || []), D.ITEMS[id].name]; }
      }
      return res;
    };
  }
  /* the valve overlay for a Dwemer puzzle room: solve it and the right setting goes through DUNGEONS.act as usual */
  if (typeof EXPLORE !== "undefined") {
    const open0 = EXPLORE.openGame;
    EXPLORE.openGame = (s, run) => {
      const r = s.dungeon?.room;
      if (s.dungeon?.theme === "dwemer" && r?.type === "puzzle" && !r.x && r.options?.length) {
        const wrong = r.options.find((o) => o !== r.order) || r.order;
        return openValves(valves(`${s.dungeon.place}|${s.dungeon.row}|${s.dungeon.col}|${r.order}`, s.dungeon.tier, pfx(s, "dwlore")),
          { title: "The steam valves", clue: "Three pipes feed a sealed door. Turn a valve and its neighbours turn with it. Get every needle back to the top before the pressure blows." },
          (pz) => run(pz.done === "solved" ? `set:${r.order}` : `set:${wrong}`));
      }
      return open0(s, run);
    };
  }

  // ---- overlays (the browser only)
  let ov = null;
  function closeOv() { if (!DOM) return false; const el = document.getElementById("dwgame"); if (el) el.remove(); const was = !!ov; ov = null; return was; }
  const NEEDLE = (rot) => `<svg viewBox="-20 -20 40 40" class="dw-valve-svg" aria-hidden="true"><circle r="17" fill="#3a2e1c" stroke="#c9a24a" stroke-width="2.5"/><circle r="12" fill="#1c1812" stroke="#8a6a32" stroke-width="1.5"/>
    ${[0, 1, 2, 3].map((k) => `<rect x="-1.5" y="-17" width="3" height="5" fill="${k === 0 ? "#7ad0a0" : "#8a6a32"}" transform="rotate(${k * 90})"/>`).join("")}
    <g transform="rotate(${rot * 90})"><path d="M0,-11 L3,0 L0,3 L-3,0 Z" fill="${rot === 0 ? "#7ad0a0" : "#e8a040"}" stroke="#1a120a" stroke-width="0.8"/></g><circle r="2.5" fill="#c9a24a"/></svg>`;
  const GLYPH = [   // Dwemer-ish glyphs, drawn for the lexicon ([OURS] shapes)
    "M0,-12 L0,12 M-9,-6 L9,6 M-9,6 L9,-6", "M-10,10 L0,-12 L10,10 Z M-4,4 L4,4", "M-10,-6 Q0,-16 10,-6 M-10,2 Q0,-8 10,2 M-10,10 Q0,0 10,10",
    "M0,0 m-8,0 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0 M0,-12 L0,-8 M0,8 L0,12 M-12,0 L-8,0 M8,0 L12,0", "M-12,0 Q0,-11 12,0 Q0,11 -12,0 Z M0,0 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0", "M0,-12 Q8,-2 4,6 Q0,12 -4,6 Q-8,-2 0,-12 M0,0 L0,8"];
  const glyphSvg = (k, cls = "") => `<svg viewBox="-14 -14 28 28" class="dw-glyph ${cls}" aria-hidden="true"><path d="${GLYPH[k]}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  function draw() {
    const el = DOM && document.getElementById("dwgame"); if (!el || !ov) return;
    const pz = ov.pz, h = hint(pz), lex = pz.kind === "lexicon";
    const face = (i) => lex
      ? `<div class="dw-ring ${h === i ? "hint" : ""}"><div class="dw-face">${glyphSvg(pz.pos[i])}<small>${esc(GLYPHS[pz.pos[i]])}</small></div><button class="btn sm" data-dw="turn" data-i="${i}" aria-label="Turn ring ${i + 1}">⟳ Turn</button></div>`
      : `<button class="dw-valve ${h === i ? "hint" : ""}" data-dw="turn" data-i="${i}" aria-label="Turn valve ${i + 1}">${NEEDLE(pz.pos[i])}</button>`;
    const goal = lex ? `<p class="xg-sub"><span>Calcelmo's notes:</span> ${pz.goal.map((g) => `<b class="dw-goal">${glyphSvg(g, "sm")} ${esc(GLYPHS[g])}</b>`).join(" · ")}</p>` : "";
    const gauge = lex ? "" : `<div class="dw-gauge" aria-label="Pressure"><i style="width:${Math.min(100, Math.round(100 * pz.moves / pz.limit))}%"></i></div>`;
    const msg = pz.done === "solved" ? (lex ? "The rings lock. The lexicon hums." : "Every needle points up. The door hisses open.") : pz.done === "burst" ? "Too many turns: the pressure blows!" : "";
    el.innerHTML = `<div class="xg-in dw-in"><h3>${esc(ov.title)}</h3><p class="xg-clue">${esc(ov.clue)}</p>${goal}
      <div class="dw-row ${lex ? "lex" : "val"}">${[...Array(pz.n)].map((_, i) => face(i)).join("")}</div>${gauge}
      <p class="xg-sub dw-moves">${lex ? `Turns: ${pz.moves}` : `Turns: ${pz.moves} of ${pz.limit}`}</p>${pz.lore ? `<p class="xg-sub">Dwemer Lore: the glowing one is next.</p>` : ""}${msg ? `<p class="dw-msg">${esc(msg)}</p>` : ""}
      <div class="xg-btns">${pz.done ? `<button class="btn pri" data-dw="done">Carry on</button>` : `<button class="btn" data-dw="reset">Start over</button><button class="btn" data-dw="x">Step back</button>`}</div></div>`;
  }
  function openOv(pz, o, onEnd) {
    if (!DOM) return null;
    closeOv();
    ov = { pz, title: o.title, clue: o.clue, onEnd, member: !!o.member };
    const el = document.createElement("div");
    el.id = "dwgame"; el.className = "xgame dwgame"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", o.title);
    document.body.appendChild(el); draw();
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-dw]"); if (!b || !ov) return;
      const k = b.dataset.dw, pzz = ov.pz;
      if (k === "turn" && !pzz.done) { const r = turn(pzz, +b.dataset.i); try { if (typeof SOUND !== "undefined") SOUND.fx(r === "burst" ? "hit" : r === "solved" ? "coin" : "click"); } catch { /* sound is optional */ } draw(); }
      else if (k === "reset" && !pzz.done) { pzz.pos = pzz.start.slice(); pzz.moves = 0; draw(); }
      else if (k === "x") closeOv();
      else if (k === "done") { const end = ov.onEnd, p = ov.pz; closeOv(); if (end) end(p); }
    });
    return ov;
  }
  const openValves = (pz, o, onEnd) => openOv(pz, o, onEnd);

  // ---- screens: hooks from ui.js (mount), the lexicon from the Journal's talk button
  let ctx = null;
  function mount(c) { ctx = c; }
  function openLexicon(s) {
    const pz = lexicon(lexSeed(s), pfx(s, "dwlore"));
    return openOv(pz, { title: "The Dwemer Lexicon", clue: "Turn a ring and it drags the next one round with it. Match Calcelmo's notes." }, (p) => {
      if (p.done !== "solved" || !ctx) return;
      const S = ctx.S(); const m = lexiconSolved(S); ctx.persist(true);
      const r = QUESTS.talk(S, ID); ctx.persist(true); ctx.renderPanel(true);
      ctx.showMessage("Quest", [m, r.text, ...(r.msgs || [])].filter(Boolean).join(" "));
    });
  }

  // ---- Journal emblem: a brass cog with a lexicon cube
  function emblem(g) {
    const ink = "#1a120a"; g.lineJoin = "round"; g.strokeStyle = ink; g.lineWidth = 1.2;
    g.fillStyle = "#b8863a"; g.beginPath();
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, r = k % 2 ? 13 : 16; g.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#5a3e1c"; g.beginPath(); g.arc(20, 20, 8, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = "#7ad0c0"; g.fillRect(16.5, 16.5, 7, 7); g.strokeRect(16.5, 16.5, 7, 7);
  }
  L.dw_lexicon.emblem = emblem;

  if (typeof QUESTS !== "undefined") {
    Object.assign(QUESTS.L, L);
    QUESTS.REC[ID] = L[ID].stages.map((x) => x.rec);
    const join0 = QUESTS.join, can0 = QUESTS.canJoin, check0 = QUESTS.check, talk0 = QUESTS.talk;
    QUESTS.join = (s, id) => (id === ID ? gate(s) || join0(s, id) : join0(s, id));
    QUESTS.canJoin = (s, id) => (id === ID ? !gate(s) && can0(s, id) : can0(s, id));
    QUESTS.check = (s) => { const m = check0(s); return [...m, ...sync(s)]; };
    QUESTS.talk = (s, id, t) => {
      const v = q(s)[id];
      if (id === ID && v && !v.done && v.stage === STAGE.lexicon && !lexDone(s) && s.location === "Markarth") {
        if (role(s) === "member") return { text: "In a party only your leader turns the lexicon's rings. Wait for them." };
        if (ctx && DOM) { setTimeout(() => openLexicon(s), 0); return { text: "Calcelmo clears his table and sets the lexicon on it." }; }
      }
      const r = talk0(s, id, t); const m = sync(s); if (m.length) r.msgs = [...(r.msgs || []), ...m]; return r;
    };
  }
  return { L, LINES, ID, STAGE, ITEMS: [...NEW_GEAR, ...Object.keys(SCRAP), "dwemer_lexicon", "dwemer_dynamo", "tonal_warhammer", "lexicon_helm"], NEW_GEAR, SCRAP, GLYPHS, E,
    rng, press, solve, valves, lexicon, turn, hint, quality, gate, reachOpen, sync, lexDone, lexSeed, lexiconSolved, openValves, openLexicon, closeOv, mount, emblem,
    get ov() { return ov; } };
})();
