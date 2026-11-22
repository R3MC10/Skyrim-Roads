const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Dragon Shouts round 2 (shouts2.js): fixed Word Walls, new shouts in fights, Smart AI, teachers, Clear Skies
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, setTimeout, clearTimeout };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "magic.js", "combatai.js", "shouts2.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0; const ok = (v, m) => { if (!v) { fails++; console.log("FAIL", m); } };
const P = POWERS, S2 = SHOUTS2;
// the new shouts exist with 3 words and 3 cooldowns, and words are unique across all shouts
const all = Object.values(P.SHOUTS).flatMap((x) => x[1]);
ok(new Set(all).size === all.length, "words are unique " + all.length);
for (const id of ["marked_for_death","slow_time","dragonrend","storm_call","elemental_fury","clear_skies","throw_voice","animal_allegiance","call_of_valor","call_dragon","dismay"]) ok(P.SHOUTS[id] && P.SHOUTS[id][1].length === 3 && P.SHOUTS[id][2].length === 3, "shout " + id);
// every wall is a real, enterable place, and every wall shout is a real shout
for (const [n, id] of Object.entries(S2.WALLS)) { ok(WORLD.places[n], "wall place " + n); ok(DUNGEONS.enterable(n), "enterable " + n); ok(P.SHOUTS[id], "wall shout " + id); }
ok(Object.keys(S2.WALLS).length >= 40, "walls " + Object.keys(S2.WALLS).length);
// every shout can be learned: walls for 3 words, or a teacher
for (const id of Object.keys(P.SHOUTS)) if (id !== "bend_will") ok(S2.TAUGHT.has(id) || S2.wallsFor(id).length >= (id === "unrelenting_force" || id === "whirlwind_sprint" ? 1 : 3), "learnable " + id);

// reading walls: each teaches the next word of its own shout, once
const s = G.newSave("x", "Wall", "nord");
let w = S2.readWall(s, "Folgunthur"); ok(w && w[0] === "FO", "Folgunthur teaches FO " + JSON.stringify(w));
ok(S2.readWall(s, "Folgunthur") === null, "a wall is read once");
w = S2.readWall(s, "Skyborn Altar"); ok(w && w[0] === "KRAH", "second wall teaches KRAH");
w = S2.readWall(s, "Bonestrewn Crest"); ok(w && w[0] === "DIIN", "third wall teaches DIIN");
ok(P.level(s, "frost_breath") === 0, "words need dragon souls");
s.souls = 2; ok(/understand/.test(P.unlock(s, "FO")), "unlock FO"); P.unlock(s, "KRAH"); ok(P.level(s, "frost_breath") === 2, "2-word Frost Breath");
ok(S2.takeWall() && S2.takeWall() === null, "the wall scene is queued once");
// a boss chest at a wall place teaches through the dungeon
const s2 = G.newSave("y", "Delver", "nord"); s2.level = 30; s2.hpBonus = 5000; G.setHealth(s2, G.maxHealth(s2));
let taught = false;
for (let k = 0; k < 30 && !taught; k++) {
  s2.location = "Saarthal"; [s2.x, s2.y] = WORLD.places.Saarthal; s2.cleared = {}; s2.dungeon = null; s2.walls = [];
  s2.words = []; DUNGEONS.enter(s2);
  for (let i = 0; i < 80 && s2.dungeon; i++) { const d = s2.dungeon; G.setHealth(s2, G.maxHealth(s2));
    if (d.room) { const ch = DUNGEONS.roomChoices(s2); const pick = (ch.find((x) => x[0] === "fight") || ch.find((x) => /leave|on|go|take|open|search/i.test(x[0])) || ch[ch.length - 1])[0]; const r = DUNGEONS.act(s2, pick); if (/Word Wall/.test(r.text || "")) taught = true; }
    else { const nx = DUNGEONS.nextChoices(s2); if (!nx.length) break; DUNGEONS.enterRoom(s2, nx[0]); } }
}
ok(taught && P.known(s2, "IIZ"), "Saarthal's wall teaches IIZ (Ice Form)");

// fights: every new shout does something, costs voice, and the AI can pick it
const foe = (name) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, 20);
const fighter = () => { const s = G.newSave("f" + Math.random(), "Shouter", "nord"); s.level = 20; s.hpBonus = 300; G.setHealth(s, G.maxHealth(s));
  for (const id of Object.keys(S2.NEW)) for (const w of P.SHOUTS[id][1]) { P.learnWord(s, w); s.unlocked = [...(s.unlocked || []), w]; } return s; };
for (const id of Object.keys(S2.NEW).filter((x) => x !== "clear_skies")) {
  const s = fighter(); s.voiceAt = 0; G.loadout(s).mode = "custom"; G.loadout(s).rules = [{ if: "first_turn", do: "shout:" + id }, ...G.loadout(s).rules];
  const e = foe(id === "dragonrend" ? "Dragon" : id === "animal_allegiance" ? "Wolf pack" : "Bandit outlaw");
  const f = new G.Fight(s, e); f.run({}); const l0 = f.log[0]?.me || "";
  ok(l0.includes(P.SHOUTS[id][1][0]), id + " shouted: " + l0.slice(0, 80));
  ok(isFinite(f.hp) && isFinite(f.ehp), id + " no NaN");
  ok(s.voiceAt > G.now() - 5, id + " voice cooldown set");
}
// effects
{ const s = fighter(); const f = new G.Fight(s, foe("Dragon")); f.t = G.now(); const m0 = P.dmgOut(f); P.act(f, "shout", "dragonrend"); ok(f.eParalyzed >= 4 && P.dmgOut(f) > m0 * 1.3, "Dragonrend grounds and weakens a dragon"); }
{ const s = fighter(); const f = new G.Fight(s, foe("Bandit outlaw")); P.act(f, "shout", "dragonrend"); ok(!(f.eParalyzed > 0), "Dragonrend does nothing to a bandit"); }
{ const s = fighter(); const f = new G.Fight(s, foe("Bandit outlaw")); const n = f.allies.length; P.act(f, "shout", "call_of_valor"); ok(f.allies.length === n + 1 && f.allies.some((a) => a.valor), "Call of Valor brings a hero"); ok(!P.affordable(f, "shout", "call_of_valor") , "one hero per fight"); }
{ const s = fighter(); const f = new G.Fight(s, foe("Bandit outlaw")); P.act(f, "shout", "dismay"); ok(f.calmTurns >= 8, "Dismay: the bandit flees"); const f2 = new G.Fight(s, foe("Dragon")); P.act(f2, "shout", "dismay"); ok(!(f2.calmTurns > 0), "dragons feel no fear"); }
{ const s = fighter(); const f = new G.Fight(s, foe("Bandit outlaw")); P.act(f, "shout", "storm_call"); const e0 = f.ehp; const line = { me: "", them: "" }; P.tick(f, line); ok(f.ehp < e0 && /lightning/.test(line.me), "Storm Call strikes each turn"); }
{ const s = fighter(); s.dungeon = { place: "x" }; const f = new G.Fight(s, foe("Bandit outlaw")); f.t = G.now(); ok(!P.affordable(f, "shout", "storm_call") && !P.affordable(f, "shout", "call_dragon"), "no sky in a dungeon"); }
{ const s = fighter(); const f = new G.Fight(s, foe("Bandit outlaw")); P.act(f, "shout", "throw_voice"); ok(f.sneakNext, "Throw Voice: next blow is a sneak attack"); }
{ const s = fighter(); const f = new G.Fight(s, foe("Bandit outlaw")); const m0 = P.dmgOut(f); P.act(f, "shout", "elemental_fury"); ok(P.dmgOut(f) > m0 * 1.4, "Elemental Fury"); P.act(f, "shout", "marked_for_death"); ok(P.dmgOut(f) > m0 * 1.8, "Marked for Death stacks"); }
// Smart AI picks Dragonrend against a dragon when it knows it
{ let used = 0; for (let i = 0; i < 20; i++) { const s = G.newSave("a" + i, "AI", "nord"); s.level = 25; for (const w of ["JOOR", "ZAH", "FRUL"]) { P.learnWord(s, w); } s.unlocked = ["JOOR", "ZAH", "FRUL"]; s.voiceAt = 0;
  const f = new G.Fight(s, foe("Dragon")); f.run({}); if (f.log.some((l) => /JOOR/.test(l.me))) used++; } ok(used >= 15, "Smart AI uses Dragonrend on dragons " + used + "/20"); }
{ let used = 0; for (let i = 0; i < 20; i++) { const s = G.newSave("b" + i, "AI", "nord"); s.level = 25; for (const w of ["JOOR", "ZAH", "FRUL"]) P.learnWord(s, w); s.unlocked = ["JOOR", "ZAH", "FRUL"]; s.voiceAt = 0;
  const f = new G.Fight(s, foe("Bandit outlaw")); f.run({}); if (f.log.some((l) => /JOOR/.test(l.me))) used++; } ok(used === 0, "…and never on a bandit " + used); }
{ const s = G.newSave("c", "AI", "nord"); s.level = 25; for (const w of ["TIID","KLO","UL"]) P.learnWord(s, w); s.unlocked = ["TIID","KLO","UL"]; s.voiceAt = 0; s.hpBonus = 0;
  let used = 0; for (let i = 0; i < 20; i++) { s.voiceAt = 0; G.setHealth(s, G.maxHealth(s)); const f = new G.Fight(s, foe("Dragon")); f.run({}); if (f.log.some((l) => /TIID/.test(l.me))) used++; } ok(used >= 10, "Smart AI uses Slow Time in a hard fight " + used); }

// teachers
{ const s = G.newSave("g", "Greybeard", "nord"); s.location = "High Hrothgar"; P.greybeards(s); ok(P.level(s, "unrelenting_force") === 3, "Greybeards: FUS RO DAH");
  let m = P.greybeards(s); ok(/WULD/.test(m) && P.level(s, "whirlwind_sprint") === 1, "second visit: WULD");
  s.level = 15; s.dragons = 3; m = P.greybeards(s); ok(P.known(s, "ZUL") && P.known(s, "LOK") && P.level(s, "dragonrend") === 3, "later: Throw Voice, Clear Skies, Dragonrend " + m.slice(0, 80));
  ok(/receive you|nod/.test(P.greybeards(s)), "nothing left to teach");
  s.dragons = 4; let a = P.absorb(s); ok(/OD AH VIING/.test(a) && P.level(s, "call_dragon") === 3, "Call Dragon after the fifth dragon");
  s.dragons = 9; a = P.absorb(s); ok(/HUN KAAL ZOOR/.test(a), "Call of Valor after the tenth"); }
// hints
{ const s = G.newSave("h", "H", "nord"); ok(/Word Walls/.test(S2.hint(s, "frost_breath")), "wall hint " + S2.hint(s, "frost_breath")); ok(/Paarthurnax/.test(S2.hint(s, "dragonrend")), "teacher hint"); }
// Clear Skies on the road
{ const s = G.newSave("r", "R", "nord"); for (const w of ["LOK","VAH","KOOR"]) P.learnWord(s, w); s.unlocked = ["LOK","VAH","KOOR"]; s.location = null; s.voiceAt = 0;
  const m = P.roadShout(s, "clear_skies"); ok(/clears/.test(m), m); ok(WEVENTS.weather([s.x, s.y]).id === "clear", "the sky is clear here");
  ok(P.roadShout(s, "clear_skies").includes("more seconds"), "cooldown"); }
// the AI never chooses a road shout in a fight
{ const s = fighter(); const f = new G.Fight(s, foe("Bandit outlaw")); f.t = G.now(); ok(!P.affordable(f, "shout", "clear_skies"), "Clear Skies isn't for fights"); }
console.log(fails ? "FAILED " + fails : "shouts2 ALL OK");
`, c);
