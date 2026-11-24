// The Dwemer deep-dive (dwemer.js, blackreach.js): Calcelmo's line played through, the lexicon and valve puzzles (always
// solvable, hints with Dwemer Lore), scrap smelting and the new Dwarven pieces at the forge, the Dwemer perks with real
// effects, Blackreach's map (paths, sealed door, fights, gathering, the vault, the secret dragon), the party rule,
// achievements, Polish for every line, and a balance sim. W=/path/to/game/ node test_dwemer.js   (N=30 by default)
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, process };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {} };
{ // every double-quoted string in the two modules that reads like words (ids, colours, skills, tags and templates left out)
  const code = /^(?:[a-z0-9_:\-#. ]*|[a-z]+[A-Z]\w*|.*\$\{.*|.*[=<>].*|[\][(){}].*|\w+:[\w-]+|One-Handed|Two-Handed|Archery|Sneak|Smithing|Lockpicking|Alchemy|FUS|M0,.*|M-.*|&\w+;|\w+\|.*|width:.*)$/, out = new Set();
  for (const f of ["dwemer.js", "blackreach.js"]) for (const line of fs.readFileSync(W + f, "utf8").split("\n")) {
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;
    for (const m of line.replace(/\/\/ .*$/, "").matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) { const v = m[1].replace(/\\"/g, '"').trim(); if (/[A-Za-z]{2}/.test(v) && !code.test(v)) out.add(v); }
  }
  c.__cands = [...out]; }
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
const SIM = fs.readFileSync(__dirname + "/test_bal_sim.js", "utf8");
vm.runInContext(SIM.slice(SIM.indexOf("const LEVELS"), SIM.indexOf("const BUILDS")) + `
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const at = (s, p) => { s.location = p; [s.x, s.y] = WORLD.places[p]; s.discovered = s.discovered || []; if (!s.discovered.includes(p)) s.discovered.push(p); s.trip = null; s.dungeon = null; };
const hero = (build = "warrior", lvl = 40) => { const s = make(build, lvl); s.id = s.id || "h" + Math.random(); s.quests = {}; s.gold = 9999; s.thaneWhiterun = true; QUESTS.ensure(s); return s; };
const has = (s, id) => (s.inv || []).some((r) => r.item === id);
const cnt = (s, id) => (s.inv || []).filter((r) => r.item === id).reduce((a, r) => a + r.qty, 0);
/* one step of the line: clears are marked done, talks are tapped (retrying a lost fight with full health), the lexicon is solved, Blackreach is walked */
function step(s, id) {
  const v = s.quests[id], st = QUESTS.L[id].stages[v.stage], o = st.obj;
  if (o.clear) { at(s, o.clear); s.cleared = s.cleared || {}; s.cleared[o.clear] = G.now() + 5; const m = QUESTS.check(s); OK(m.length, "clear advances " + st.title); return m; }
  if (o.flag) {   // Blackreach: walk the map to the tower, then the dynamo
    const path = ["warren", "city", "mzark", "dynamo"].slice(0, o.flag === "dwMzark" ? 3 : 4);
    for (let g = 0; g < 15 && !s[o.flag]; g++) {
      if (!BLACKREACH.here(s)) { at(s, "Alftand"); BLACKREACH.enter(s); OK(BLACKREACH.here(s) === "lift", "down the great lift"); }
      for (let i = path.indexOf(BLACKREACH.here(s)) + 1; i < path.length; i++) {
        G.setHealth(s, G.maxHealth(s)); const r = BLACKREACH.move(s, path[i]);
        if (r.fight) OK(!isNaN(r.fight.hp) && !isNaN(r.fight.ehp), "no NaN at " + path[i]);
        if (BLACKREACH.here(s) !== path[i]) break;
      }
    }
    OK(s[o.flag], o.flag + " set");
    return QUESTS.check(s);
  }
  at(s, o.talk);
  if (v.stage === DWEMER.STAGE.lexicon && !DWEMER.lexDone(s)) {
    OK(/notes/.test(QUESTS.talk(s, id).text) && v.stage === DWEMER.STAGE.lexicon, "the lexicon has to be read first");
    const pz = DWEMER.lexicon(DWEMER.lexSeed(s)); for (const i of DWEMER.solve(pz, pz.pos)) DWEMER.turn(pz, i);
    OK(pz.done === "solved", "lexicon solved by its own hint path"); DWEMER.lexiconSolved(s);
  }
  for (let k = 0; k < 12; k++) {
    const before = v.stage; G.setHealth(s, G.maxHealth(s)); v.retryAt = 0;
    const r = QUESTS.talk(s, id);
    if (r.fight) OK(!isNaN(r.fight.hp) && !isNaN(r.fight.ehp), "no NaN in " + st.title);
    if (v.stage > before || v.done) return r.msgs || [];
  }
  throw new Error("FAIL stuck at " + st.title);
}
const play = (s, id) => { const out = []; for (let g = 0; g < 20 && !s.quests[id].done; g++) out.push(...step(s, id)); OK(s.quests[id].done, id + " finished"); return out; };
const ID = DWEMER.ID;

// 1. places and items: every stage's place is real, ruins are Dwemer dungeons, levels rise, items exist
OK(WORLD.places.Markarth && WORLD.places.Alftand && WORLD.places.Raldbthar && WORLD.places.Mzinchaleft, "the places are on the map");
{ const d = QUESTS.L[ID]; let last = 0;
  d.stages.forEach((st, i) => { const p = QUESTS.target(st); OK(WORLD.places[p], "stage " + i + " place " + p);
    if (st.obj.clear) OK(DUNGEONS.enterable(st.obj.clear) && DUNGEONS.info(st.obj.clear).theme === "dwemer", "Dwemer ruin " + st.obj.clear);
    const r = QUESTS.recOf(ID, i); OK(r >= last, "recommended levels rise " + i); last = r; });
  OK(d.stages.length === 8 && d.start === "Markarth" && /Calcelmo/.test(d.giver), "8 stages from Calcelmo in Markarth");
  OK(typeof d.emblem === "function", "Journal emblem"); }
for (const it of DWEMER.ITEMS) OK(D.ITEMS[it] && D.ITEMS[it].name, "item " + it);
for (const it of DWEMER.NEW_GEAR) { OK(SMITH.RECIPES[it] && SMITH.RECIPES[it].perk === "dwarven_smithing" && SMITH.RECIPES[it].mats[0][0] === "mat_dwarven", "forge recipe " + it);
  OK(DUNGEONS.THEMES.dwemer.loot.includes(it), "found in Dwemer ruins " + it); }
OK(["dagger", "mace", "greatsword", "battleaxe", "warhammer"].every((w) => D.ITEMS["dwarven_" + w].damage > D.ITEMS["steel_" + w]?.damage || !D.ITEMS["steel_" + w]), "Dwarven weapons beat steel");
OK(DUNGEONS.ENEMY.falmer.tags.includes("falmer"), "Falmer are tagged for the perk");

// 2. puzzles: valves and the lexicon are always solvable, a burst fails, Dwemer Lore hints and gives more turns
for (let k = 0; k < 60; k++) {
  const pz = DWEMER.valves("v" + k, 1 + (k % 3)); OK(pz.par > 0 && pz.par <= pz.limit - 5, "valves start unsolved " + k);
  const path = DWEMER.solve(pz, pz.pos); OK(path && path.length === pz.par, "valves solvable " + k);
  for (const i of path) DWEMER.turn(pz, i); OK(pz.done === "solved" && DWEMER.quality(pz) === 1, "solved at par is full quality");
  const lx = DWEMER.lexicon("l" + k); OK(lx.par > 0 && DWEMER.solve(lx, lx.pos).length === lx.par, "lexicon solvable " + k);
}
{ const pz = DWEMER.valves("burst", 2); let r = ""; for (let i = 0; i < 40 && !r; i++) r = DWEMER.turn(pz, 0);
  OK(pz.done === "burst" || pz.done === "solved", "valves end"); const pz2 = DWEMER.valves("burst2", 2);
  while (!pz2.done) DWEMER.turn(pz2, DWEMER.solve(pz2, pz2.pos)[0] === 4 ? 3 : 4); OK(pz2.done, "a wasted run ends");
  OK(DWEMER.hint(pz) === null, "no hint without Dwemer Lore");
  const lo = DWEMER.valves("lore", 2, 1); OK(lo.limit === lo.par + 8 && DWEMER.hint(lo) === DWEMER.solve(lo, lo.pos)[0], "Dwemer Lore: hint and three more turns"); }
{ // a Dwemer puzzle room opens the valve game, and its answer goes through the dungeon as usual
  let got = null; const fake = { dungeon: { theme: "dwemer", place: "Alftand", row: 1, col: 0, tier: 3, room: { type: "puzzle", order: "A-B-C", options: ["A-B-C", "C-B-A"] } }, perks: {} };
  const ov = EXPLORE.openGame(fake, (ch) => (got = ch)); OK(ov === null || ov === undefined, "no page in node: the overlay is skipped quietly"); }

// 3. the line: level gate, join in Markarth, play it through
{ const low = hero("warrior", 10); at(low, "Markarth"); OK(!QUESTS.canJoin(low, ID) && /level 14/.test(QUESTS.join(low, ID)), "level gate"); }
const A = hero("warrior", 40); at(A, "Markarth");
OK(QUESTS.canJoin(A, ID) && /Calcelmo/.test(QUESTS.join(A, ID)), "joined in Markarth");
at(A, "Alftand"); OK(/jammed/.test(BLACKREACH.canEnter(A)), "Blackreach shut before the lift stage");
const msgs = play(A, ID);
OK(has(A, "dwemer_lexicon") && has(A, "lexicon_helm") && has(A, "tonal_warhammer") && has(A, "dwemer_dynamo"), "lexicon, helm, tonal hammer and dynamo core");
OK(A.dwLexiconDone && A.titles.includes("Delver of the Deep"), "flag and title");
OK(msgs.some((m) => /Blackreach is open/.test(m)), "Blackreach opening announced");
ACH.check(A, 1); OK(A.ach.dw_lexicon && !A.ach.dw_dragon, "Delver of the Deep earned");

// 4. Blackreach: paths, the sealed door, fights that stay cleared, gathering, the vault, the dragon, dying
{ const s = hero("twohand", 40); s.dwq = { reach: true }; at(s, "Raldbthar");
  OK(BLACKREACH.canEnter(s) === null && /Blackreach/.test(BLACKREACH.enter(s)) && BLACKREACH.here(s) === "raldlift", "down the Raldbthar lift");
  OK(/No path/.test(BLACKREACH.move(s, "mzark").text), "no path across the map");
  const t0 = G.now(); G.setHealth(s, G.maxHealth(s));
  let r = BLACKREACH.move(s, "hall", t0); for (let k = 0; k < 8 && r.died; k++) { at(s, "Raldbthar"); BLACKREACH.enter(s); G.setHealth(s, G.maxHealth(s)); r = BLACKREACH.move(s, "hall", t0); }
  OK(r.fight && r.fight.won && BLACKREACH.here(s) === "hall" && BLACKREACH.isClear(s, "hall", t0), "a fight clears the Debate Hall");
  OK(/sealed brass door/.test(BLACKREACH.move(s, "dynamo").text), "the dynamo door is sealed before Mzark");
  OK(!BLACKREACH.move(s, "fields").fight && !BLACKREACH.move(s, "hall").fight, "cleared spots stay clear");
  OK(!BLACKREACH.isClear(s, "hall", t0 + BLACKREACH.REFILL + 1), "foes come back after the refill time");
  BLACKREACH.move(s, "fields"); const m0 = cnt(s, "ing_glowing_mushroom"); G.setHealth(s, G.maxHealth(s));
  let gr = BLACKREACH.gather(s); OK(!gr.died && cnt(s, "ing_glowing_mushroom") >= m0 + 2, "glowing mushrooms picked: " + gr.text);
  OK(/clean/.test(BLACKREACH.gather(s).text), "once a day");
  // the vault (the city) and the tower
  for (const k of ["warren", "city"]) { for (let g = 0; g < 8 && BLACKREACH.here(s) !== k; g++) { G.setHealth(s, G.maxHealth(s)); const x = BLACKREACH.move(s, k); if (x.died) { at(s, "Alftand"); BLACKREACH.enter(s); } } }
  OK(BLACKREACH.here(s) === "city" && BLACKREACH.actions(s).some((a) => a[0] === "vault"), "the vault is in the Silent City");
  const pz = BLACKREACH.vaultPuzzle(s), g0 = s.gold; for (const i of DWEMER.solve(pz, pz.pos)) DWEMER.turn(pz, i);
  OK(/vault door swings open/.test(BLACKREACH.vault(s, pz)) && s.gold > g0, "vault opened");
  OK(/cooling/.test(BLACKREACH.vault(s, pz)) && BLACKREACH.vaultLeft(s) > 0, "the vault cools for 3 days");
  const hp0 = G.curHealth(s); BLACKREACH.R(s).vault = -1e12; const bad = DWEMER.valves("x", 2); bad.done = "burst";
  OK(/Steam/.test(BLACKREACH.vault(s, bad)) && G.curHealth(s) < hp0, "a burst vault scalds you");
  BLACKREACH.move(s, "mzark"); OK(s.dwMzark && BLACKREACH.here(s) === "mzark", "the lexicon read at Mzark (flag set even off the line)");
  OK(!BLACKREACH.canCall(s) || POWERS.known(s, "FUS"), "the secret needs FUS");
  s.words = [...(s.words || []), "FUS"]; OK(BLACKREACH.canCall(s) && BLACKREACH.actions(s).some((a) => a[0] === "dragon"), "FUS: shout at the orb");
  let d = null; for (let k = 0; k < 10 && !s.dwDragon; k++) { at(s, "Alftand"); BLACKREACH.enter(s); BLACKREACH.R(s).at = "mzark"; G.setHealth(s, G.maxHealth(s)); d = BLACKREACH.callDragon(s); }
  OK(s.dwDragon && has(s, "dragon_bone") && has(s, "dragon_scales") && /Vulthuryol/.test(d.text), "Vulthuryol beaten: bones, scales, a soul");
  OK(!BLACKREACH.canCall(s), "the dragon comes once"); ACH.check(s, 1); OK(s.ach.dw_dragon, "What Sleeps Below earned");
  BLACKREACH.R(s).at = "mzark"; OK(/Get back to a lift/.test(BLACKREACH.leave(s)), "leave only from a lift");
  BLACKREACH.R(s).at = "lift"; OK(/Alftand/.test(BLACKREACH.leave(s)) && s.location === "Alftand" && !BLACKREACH.here(s), "up the great lift");
  const w = hero("mage", 5); w.dwq = { reach: true }; at(w, "Alftand"); BLACKREACH.enter(w); G.setHealth(w, 1); let dd = BLACKREACH.move(w, "warren"); for (let k = 0; k < 10 && !dd.died; k++) { BLACKREACH.R(w).at = "lift"; BLACKREACH.R(w).cleared = {}; G.setHealth(w, 1); dd = BLACKREACH.move(w, "warren"); }
  OK(dd.died && !BLACKREACH.here(w), "dying in Blackreach puts you out of it"); }

// 5. the forge: scrap smelts only with Dwarven Smithing (Tinkerer adds one), the new pieces use up materials
{ const s = hero("warrior", 40); at(s, "Markarth"); s.perks.dwarven_smithing = 0; G.give(s, "dwemer_gear", 2); G.give(s, "dwemer_strut");
  const k = SMITH.REFINE.findIndex((r) => r[2][0][0] === "dwemer_gear"), ks = SMITH.REFINE.findIndex((r) => r[2][0][0] === "dwemer_strut");
  OK(k >= 0 && ks >= 0 && SMITH.REFINE[k][1] === 2 && SMITH.REFINE[ks][1] === 3, "smelting: gear 2, strut 3 ingots");
  OK(/Dwarven Smithing/.test(SMITH.refine(s, k)) && cnt(s, "dwemer_gear") === 2 && SMITH.refineInfo(s, k).block, "no smelting without the perk");
  s.perks.dwarven_smithing = 1; const i0 = cnt(s, "mat_dwarven");
  OK(/You smelt/.test(SMITH.refine(s, k)) && cnt(s, "mat_dwarven") === i0 + 2 && cnt(s, "dwemer_gear") === 1, "a gear smelts into 2 ingots");
  s.perks.dwemer_tinkerer = 1; OK(SMITH.refineInfo(s, ks).n === 4 && /Tinkerer/.test(SMITH.refine(s, ks)) && cnt(s, "mat_dwarven") === i0 + 6, "Dwemer Tinkerer: one more ingot");
  for (const [id, q] of SMITH.RECIPES.dwarven_warhammer.mats) G.give(s, id, q + 1);
  const before = SMITH.RECIPES.dwarven_warhammer.mats.map(([id]) => cnt(s, id));
  OK(/Dwarven Warhammer/.test(SMITH.make(s, "dwarven_warhammer")) && has(s, "dwarven_warhammer"), "Dwarven Warhammer made");
  OK(SMITH.RECIPES.dwarven_warhammer.mats.every(([id, q], i) => cnt(s, id) === before[i] - q), "the forge used up the materials"); }

// 6. perks: in the trees, chained to old ids, real effects
for (const [id, need] of [["dwemer_tinkerer", "dwarven_smithing"], ["dwemer_lore", "apprentice_locks"], ["falmer_hunter", "stealth"], ["steam_proof", "juggernaut"]])
  OK(PERKS.BY_ID[id] && PERKS.BY_ID[id].needs.includes(need) && PFX.FX[id].length, "perk " + id + " after " + need);
{ const s = hero("warrior", 40), mk = (tags) => ({ s, tags: new Set(tags), e: { name: "x" }, hp: 100, ehp: 100 });
  const fal = mk(["humanoid", "falmer"]), man = mk(["humanoid"]), bot = mk(["construct"]);
  const o0 = PFX.sum(s, "out", fal, {}), i0 = PFX.sum(s, "in", fal, {}), m0 = PFX.sum(s, "out", man, {}); s.perks.falmer_hunter = 1;
  OK(Math.abs(PFX.sum(s, "out", fal, {}) - o0 - 0.1) < 1e-9 && Math.abs(PFX.sum(s, "in", fal, {}) - i0 + 0.15) < 1e-9 && PFX.sum(s, "out", man, {}) === m0, "Blind Hunter: Falmer only");
  const b0 = PFX.sum(s, "out", bot, {}); s.perks.dwemer_tinkerer = 1; OK(Math.abs(PFX.sum(s, "out", bot, {}) - b0 - 0.1) < 1e-9, "Dwemer Tinkerer: +10% on machines");
  const s2 = hero("warrior", 40), hb = { ...bot, s: s2, eq: { head: { item: "steel_helmet" }, chest: { item: "steel_armor" } } }, h0 = PFX.sum(s2, "in", hb, {}); s2.perks.steam_proof = 1;
  OK(PFX.sum(s2, "in", hb, {}) <= h0, "Steam-Proof: machines hit a heavy-armoured hero softer");
  s.perks.dwemer_lore = 1; OK(PFX.num(s, "dwlore") === 1 && PFX.num(s, "dwloot") === 0.5, "Dwemer Lore numbers"); }

// 7. party: members don't turn the lexicon or pick the way; the leader's spot rides on the card; members follow
{ const role0 = PARTYPLAY.role; PARTYPLAY.role = () => "member";
  const M = hero("warrior", 40); M.dwq = { reach: true }; at(M, "Alftand");
  OK(/leader/.test(BLACKREACH.canEnter(M)), "members don't ride the lift alone");
  OK(/Blackreach|leader/.test(BLACKREACH.placeCard(M, "Alftand")), "members see the Blackreach card");
  BLACKREACH.setLeaderCard(() => ({ br: "city" })); OK(BLACKREACH.leaderAt() === "city" && /Join your leader/.test(BLACKREACH.placeCard(M, "Alftand")), "the leader's spot comes from the party card");
  OK(/catch up/.test(BLACKREACH.follow(M, BLACKREACH.leaderAt())) && BLACKREACH.here(M) === "city", "members follow the leader");
  OK(/leader picks/.test(BLACKREACH.move(M, "mzark").text) && BLACKREACH.here(M) === "city", "members can't pick the way");
  OK(!BLACKREACH.actions(M).some((a) => a[0] === "vault"), "members don't work the vault");
  M.quests[ID] = { stage: DWEMER.STAGE.lexicon, t: G.now() }; at(M, "Markarth");
  OK(/leader/.test(DWEMER.lexiconSolved(M)) && /leader/.test(QUESTS.talk(M, ID).text), "members don't turn the lexicon");
  PARTYPLAY.role = role0; BLACKREACH.setLeaderCard(() => null);
  const L = hero("warrior", 40); L.reach = { at: "hall", cleared: {} }; OK(PARTY.cardBits(L, null).br === "hall", "your Blackreach spot goes out on your party card"); }

// 8. Polish
{ const places = new Set(Object.keys(WORLD.places)), SPLIT = /(?<=[.!?…])(\\s+)|(?<=[.!?]["”])(\\s+)/;
  const ids = ["dwemer_tinkerer", "dwemer_lore", "falmer_hunter", "steam_proof"];
  const perkTexts = PFX.ADD.filter((p) => ids.includes(p[1])).flatMap((p) => [p[2], p[6].replace(/\\s*\\[[^\\]]*\\]\\s*$/, "")]);
  perkTexts.push(PERKS.BY_ID.dwarven_smithing.desc.replace(/\\s*\\[[^\\]]*\\]\\s*$/, ""));
  OK(perkTexts.length === 9, "four perks and the Dwarven Smithing text found");
  const achTexts = ACH.LIST.filter((a) => /^dw_/.test(a[0])).flatMap((a) => [a[2], a[3]]);
  const stageTexts = QUESTS.L[ID].stages.flatMap((st) => [st.title, st.text]);
  const nodeTexts = Object.values(BLACKREACH.NODES).flatMap((n) => [n.name, n.text, n.foe?.name, n.foe?.text, n.ambush?.name]).filter(Boolean);
  const itemTexts = DWEMER.ITEMS.flatMap((i) => [D.ITEMS[i].name, D.ITEMS[i].desc]).filter(Boolean);
  const all = [...__cands, ...perkTexts, ...achTexts, ...stageTexts, ...nodeTexts, ...itemTexts, BLACKREACH.DRAGON.text, "Dwarven ballista", "Falmer shadowmaster", DUNGEONS.ENEMY.ballista.text, DUNGEONS.ENEMY.falmerShaman.text].filter((v) => v && !places.has(v));
  const sentenceMissing = (v) => (I18N.tr(v) != null && v.split(SPLIT).filter((p) => p && p.trim()).every((p) => I18N.tr(p.trim()) != null)) ? null : v;
  const missing = [...new Set(all)].filter((v) => sentenceMissing(v));
  if (process.env.DUMP) console.log(JSON.stringify(missing, null, 1));
  OK(!missing.length, "every Dwemer line has Polish (" + missing.length + " missing: " + missing.slice(0, 8).join(" | ") + ")");
  __lang = "pl";
  OK(I18N.tr("The Dwemer Lexicon") !== "The Dwemer Lexicon", "line name in Polish");
  OK(!/Calcelmo, the old Dwemer scholar/.test(I18N.tr(QUESTS.L[ID].stages[0].text)), "stage text in Polish");
  __lang = "en"; }

// 9. balance: plain-gear heroes at the recommended level win most fights; the bosses are never one-shot and last
const N = +(process.env.N || 30), rows = [], BUILDS5 = ["warrior", "twohand", "archer", "mage", "spellsword"];
function trial(name, def, rec, lvl, allies = []) {
  let w = 0, minTurns = 99, turns = 0, left = 0, big = 0;
  for (let k = 0; k < N; k++) {
    const s = make(BUILDS5[k % 5], lvl); at(s, "Alftand"); G.setHealth(s, G.maxHealth(s));
    const e = G.scaleQuestFoe({ ...def }, G.fightLevel ? G.fightLevel(s) : s.level, rec), f = new G.Fight(s, e, null, G.now());
    allies.forEach(([nm, dmg]) => f.allies.push({ name: nm, dmg })); f.run({ t: G.now() });
    const mh = G.maxHealth(s); for (const l of f.log) for (const m of String(l.them || "").matchAll(/ hits ([0-9]+)/g)) big = Math.max(big, +m[1] / mh);
    if (f.won) { w++; minTurns = Math.min(minTurns, f.turn); left += Math.min(1, Math.max(0, f.hp) / mh); } turns += f.turn;
  }
  return { w: Math.round(100 * w / N), minTurns, avgTurns: Math.round(turns / N), left: Math.round(100 * left / Math.max(1, w)), big: Math.round(100 * big) };
}
const lift = QUESTS.L[ID].stages[DWEMER.STAGE.lift];
const FIGHTS = [["Great lift", lift.obj.fight, QUESTS.recOf(ID, DWEMER.STAGE.lift)], ...BLACKREACH.ORDER.filter((k) => BLACKREACH.NODES[k].foe).map((k) => [BLACKREACH.NODES[k].name, BLACKREACH.NODES[k].foe, BLACKREACH.NODES[k].rec]),
  ["Chaurus ambush", BLACKREACH.NODES.fields.ambush, BLACKREACH.NODES.fields.rec]];
for (const [name, def, rec] of FIGHTS) { const r = trial(name, def, rec, rec); rows.push([name, rec, r, def.boss]);
  console.log(name + " · lvl " + rec + " · win " + r.w + "% · turns avg " + r.avgTurns + " min " + r.minTurns + " · health left " + r.left + "% · biggest hit " + r.big + "%"); }
const mean = (k) => rows.reduce((a, r) => a + r[2][k], 0) / rows.length, avg = mean("w"), avgLeft = mean("left");
console.log("at the recommended level: average win " + Math.round(avg) + "% · average health left " + Math.round(avgLeft) + "%");
OK(avg >= 82 && avg <= 97, "most heroes win at the recommended level, but not all (" + Math.round(avg) + "%)");
OK(rows.every((r) => r[2].w >= 65), "no fight a wall at its level");
OK(avgLeft <= 80 && avgLeft >= 40, "fights cost health (" + Math.round(avgLeft) + "% left on average)");
OK(rows.every((r) => r[2].big <= 40), "no foe takes more than 40% of your health in one blow");
for (const r of rows.filter((r) => r[3])) { OK(r[2].minTurns >= 3, r[0] + " lasts at least 3 turns"); OK(r[2].left <= 75, r[0] + " costs real health (" + r[2].left + "% left)"); }
for (const lvl of [24, 30, 40]) { const r = trial("Centurion master", BLACKREACH.NODES.dynamo.foe, 24, lvl);
  console.log("Centurion master at level " + lvl + ": win " + r.w + "% · turns avg " + r.avgTurns + " min " + r.minTurns + " · health left " + r.left + "% · biggest hit " + r.big + "%");
  OK(r.minTurns >= 3 && r.big <= 40, "Centurion master never one-shot, never a one-shotter at level " + lvl); }
for (const lvl of [28, 35, 45]) { const r = trial("Vulthuryol", BLACKREACH.DRAGON, BLACKREACH.DRAGON_REC, lvl, [["Dwarven sphere you woke", 6]]);
  console.log("Vulthuryol at level " + lvl + ": win " + r.w + "% · turns avg " + r.avgTurns + " min " + r.minTurns + " · health left " + r.left + "% · biggest hit " + r.big + "%");
  OK(r.minTurns >= 3 && r.big <= 40, "Vulthuryol lasts and doesn't one-shot at level " + lvl); if (lvl >= 35) OK(r.w >= 50, "Vulthuryol beatable at level " + lvl); }
console.log("dwemer ok · " + n + " checks");
`, c);
