const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Solstheim: boat both ways, places and routes, discovery, the questline end to end, new foes, Stalhrim, card regions, save/load.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "solworld.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js",
  "quests.js", "guilds.js", "priests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js",
  "smithing.js", "social.js", "roam.js", "solstheim.js", "ammo.js", "tomes.js", "magic.js", "spellcraft.js", "market.js", "mp.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
vm.runInContext(`
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log("FAIL " + msg); } };
const T = Terrain, sol = WORLD.solPlaces;

// ---- places and routes
ok(sol.length >= 25 && sol.length <= 35, "25-35 places: " + sol.length);
for (const n of ["Raven Rock", "Skaal Village", "Tel Mithryn", "Thirsk Mead Hall", "Fort Frostmoth", "Kolbjorn Barrow", "Nchardak", "Saering's Watch", "Benkongerike", "Temple of Miraak",
  "Earth Stone", "Water Stone", "Wind Stone", "Beast Stone", "Sun Stone", "Tree Stone"]) ok(WORLD.places[n] && WORLD.isSol(WORLD.places[n]), "place " + n);
for (const n of sol) ok(T.SPEED[T.typeAtPos(WORLD.places[n])] > 0, "walkable " + n + " " + T.NAMES[T.typeAtPos(WORLD.places[n])]);
// relative positions like the real island
const P = (n) => WORLD.places[n];
ok(P("Skaal Village")[1] < P("Raven Rock")[1] && P("Skaal Village")[0] > 0.6, "Skaal is north-east");
ok(P("Tel Mithryn")[0] < P("Raven Rock")[0], "Tel Mithryn west of Raven Rock");
ok(P("Fort Frostmoth")[1] > P("Raven Rock")[1], "Frostmoth south of Raven Rock");
ok(P("Thirsk Mead Hall")[0] < 0.3 && P("Thirsk Mead Hall")[1] < 2.4, "Thirsk north-west");
ok(T.NAMES[T.typeAtPos(P("Skaal Village"))] !== "Ash wastes" && T.NAMES[T.typeAtPos([0.45, 2.75])] === "Ash wastes", "ash south, not north: " + T.NAMES[T.typeAtPos([0.45, 2.75])]);
let routes = 0, maxLen = 0;
for (const a of sol) for (const b of ["Raven Rock", "Skaal Village", "Tel Mithryn", "Temple of Miraak"]) {
  if (a === b) continue;
  const r = T.route(P(a), P(b));
  ok(r.length >= 2 && r.every((p) => WORLD.isSol(p) && p[0] >= 0 && p[0] <= 1), "route stays on Solstheim " + a + "→" + b);
  const secs = T.secondsLeft(r, 0, P(a), 1); ok(isFinite(secs) && secs > 0, "route time " + a + "→" + b + " " + secs);
  maxLen = Math.max(maxLen, secs); routes++;
}
ok(T.route(P("Whiterun"), P("Raven Rock")).length === 2, "no walking route across the sea");
ok(T.NAMES[T.typeAtPos([0.5, 2.98])] === "Sea" || T.SPEED[T.typeAtPos([0.02, 2.5])] === 0, "sea around the island");
ok(G.holdAt(P("Raven Rock")) === "Solstheim" && G.holdAt(P("Whiterun")) === "Whiterun", "holdAt");
console.log("routes", routes, "longest (s at speed 1)", Math.round(maxLen));
// Skyrim's own terrain unchanged
ok(T.SPEED[T.typeAtPos(P("Whiterun"))] > 0 && T.route(P("Whiterun"), P("Riverwood")).length > 2, "skyrim routes");

// ---- a hero
const now0 = G.now();
function hero(id, lvl = 40) {
  const s = G.newSave(id, "Hero" + id, "nord"); s.level = lvl; s.hpBonus = (lvl - 1) * 10 * 0.6; s.spBonus = (lvl - 1) * 4;
  for (const sk of Object.values(s.skills)) sk.lvl = 100;
  for (const it of ["stalhrim_heavy_armor", "stalhrim_heavy_helmet", "bonemold_gauntlets", "bonemold_boots", "bonemold_shield", "stalhrim_sword"]) { G.give(s, it); G.equip(s, s.inv[s.inv.length - 1].id); }
  for (let i = 0; i < 12; i++) G.give(s, "potion_health");
  s.perks = { armsman: 5, juggernaut: 5, steel_smithing: 1, advanced_armors: 1 };
  G.setHealth(s, G.maxHealth(s)); return s;
}
const s = hero("A");
s.location = "Windhelm"; [s.x, s.y] = P("Windhelm"); s.gold = 100;
ok(/across the sea/.test(G.startTrip(s, "Raven Rock", P("Raven Rock"))), "can't walk to Solstheim");
ok(SOL.sections("Windhelm").includes("docks") && SOL.sections("Raven Rock").includes("docks") && !SOL.sections("Whiterun").length, "docks sections");
ok(/fare/.test(SOL.canSail(s)), "fare needed");
s.gold = 1000;
ok(SOL.sail(s, now0) === null && s.trip.boat && s.gold === 750 && !s.location, "boarded");
ok(Math.abs(G.minutesLeft(s) - 50) < 0.01, "about 10 game hours = 50 min: " + G.minutesLeft(s));
let out = G.advance(s, now0 + 1500);
ok(s.trip && !out.arrived && Math.abs(G.minutesLeft(s) - 25) < 0.1 && !WORLD.isSol([s.x, s.y]), "halfway at sea");
// save/load mid-voyage
let s2 = G.migrate(JSON.parse(JSON.stringify(s)));
out = G.advance(s2, now0 + 3001);
ok(out.arrived === "Raven Rock" && s2.location === "Raven Rock" && WORLD.isSol([s2.x, s2.y]) && !s2.trip, "landed (after a reload at sea)");
ok(s2.quests.dragonborn && s2.quests.dragonborn.stage === 0 && /cultists/.test(out.solIntro), "quest starts with the cultists");
ok(s2.discovered.includes("Raven Rock"), "Raven Rock discovered");
Object.assign(s, s2);
ok(WEVENTS.weather([s.x, s.y]).id, "weather");
let ash = 0; for (let k = 0; k < 400; k++) if (WEVENTS.weatherAt("Solstheim", now0 + k * 1800).id === "ashstorm") ash++;
ok(ash > 20 && ash < 300, "ash storms happen: " + ash + "/400");
ok(WEVENTS.W.ashstorm[2] < 1, "ash storm slows travel");
ok(![...Array(200)].some((_, k) => WEVENTS.weatherAt("Whiterun", now0 + k * 1800).id === "ashstorm"), "no ash storms in Skyrim");

// ---- discovery: walk Raven Rock → Kolbjorn Barrow → Skaal Village
const disc0 = s.discovered.length;
ok(G.startTrip(s, "Skaal Village", P("Skaal Village"), now0 + 3002) === null, "walk to Skaal");
let guard = 0, enc = 0; let t = now0 + 3002;
while (s.trip && guard++ < 400) {
  t += 120; const o = G.advance(s, t);
  if (o.encounter) { enc++; ok(o.encounter.hold === "Solstheim", "foe hold"); G.setHealth(s, G.maxHealth(s), t); G.encounterAction(s, "fight", s.trip.lastTick); if (s.trip && s.trip.status !== "travel") { s.trip.status = "travel"; s.trip.encounter = null; } }
  if (o.died || (!s.trip && s.location !== "Skaal Village")) { console.log("  died on the road, walking again"); G.setHealth(s, G.maxHealth(s), t); G.startTrip(s, "Skaal Village", P("Skaal Village"), t); continue; }
  if (s.trip && s.trip.status === "event") { s.trip.status = "travel"; s.trip.event = null; }
}
ok(s.location === "Skaal Village", "reached Skaal Village: " + s.location + " " + guard);
ok(s.discovered.includes("Kolbjorn Barrow") && s.discovered.includes("Frossel"), "discovered on the way: " + s.discovered.slice(disc0).join(", "));
console.log("road fights", enc, "discovered", s.discovered.slice(disc0).join(", "));
// road foes are Solstheim's own
const seen = new Set(); for (let k = 0; k < 400; k++) { const e = G.rollEncounter(s, t); seen.add(e.name); ok(!e.holds ? e.kind === "event" || e.bountyHold : e.holds.includes("Solstheim"), "solstheim foe " + e.name); }
ok(!seen.has("Mudcrab") && !seen.has("Skeever") && !seen.has("Wolf pack"), "no Skyrim beasts: " + [...seen].join(", "));
const sk = hero("SK"); sk.location = "Whiterun"; [sk.x, sk.y] = P("Whiterun");
const seenSk = new Set(); for (let k = 0; k < 400; k++) seenSk.add(G.rollEncounter(sk, t).name);
ok(!seenSk.has("Ash spawn") && !seenSk.has("Lurker") && !seenSk.has("Riekling hunters"), "no island foes in Skyrim");

// ---- every new foe fights without errors
const foes = D.ENCOUNTERS.filter((e) => (e.holds || []).includes("Solstheim") && e.kind !== "event").concat(Object.values(DUNGEONS.ENEMY).filter((e) => e && ["Ash hopper", "Riekling", "Ash spawn", "Bull netch", "Burnt spriggan", "Riekling chief", "Ash spawn immolator", "Lurker", "Cultist", "Seeker"].includes(e.name)));
for (const base of foes) {
  const h = hero("F" + base.name); h.location = "Raven Rock"; [h.x, h.y] = P("Raven Rock");
  try { let won = 0; for (let k = 0; k < 3; k++) { const h = hero("F" + k + base.name); h.location = "Raven Rock"; [h.x, h.y] = P("Raven Rock"); const f = new G.Fight(h, G.scaleEnemy(base, h.level), null, t); f.run({ t }); f.apply(t); ok(f.log.length > 0, "fight log " + base.name); if (f.won) won++; } if (base.holds) ok(won >= 2, "strong hero beats " + base.name + " " + won + "/3"); else console.log("  dungeon foe", base.name, won + "/3"); }
  catch (e) { ok(false, "fight error " + base.name + " " + e.stack); }
}
console.log("foes fought", foes.length);
// the island's dungeons work
for (const place of ["Temple of Miraak", "Benkongerike", "Coldcinder Cave", "Kolbjorn Barrow", "Nchardak"]) {
  const h = hero("D" + place); h.location = place; [h.x, h.y] = P(place);
  ok(DUNGEONS.enterable(place), "enterable " + place + " " + JSON.stringify(DUNGEONS.info(place)));
  let g2 = 0;
  for (let tries = 0; tries < 3 && !(h.cleared || {})[place]; tries++) try {
    h.location = place; [h.x, h.y] = P(place); h.dungeon = null; h.cleared = {};
    const e = DUNGEONS.enter(h, t); ok(!e, "enter " + place + " " + e); g2 = 0;
    while (h.dungeon && g2++ < 200) {
      const d = h.dungeon;
      if (!d.room) { if (d.done) { DUNGEONS.leave(h); break; } const ch = DUNGEONS.nextChoices(h); const er = DUNGEONS.enterRoom(h, ch[0]); if (er) throw er; continue; }
      const chs = DUNGEONS.roomChoices(h).map((x) => x[0]); let cc = chs[0];
      if (d.room.type === "trap") cc = "dash"; else if (d.room.type === "puzzle") cc = "set:" + d.room.order; else if (d.room.type === "rest") cc = "rest";
      G.setHealth(h, G.maxHealth(h));
      const r = DUNGEONS.act(h, cc); if (typeof r.text !== "string") throw "no text"; if (r.died) { console.log("  died in " + place + ", again"); break; }
    }
  } catch (x) { ok(false, "dungeon " + place + " " + x); }
  console.log("  dungeon", place, (h.cleared || {})[place] ? "cleared" : "the hero fell (no errors)");   // dungeon balance at level 40 is the game's, not ours
}

// ---- the questline, start to end
const q = () => s.quests.dragonborn;
ok(QUESTS.target(QUESTS.L.dragonborn.stages[0]) === "Raven Rock", "stage 0 target");
s.location = "Raven Rock"; [s.x, s.y] = P("Raven Rock");
function talk(place, expectStage) {
  s.location = place; [s.x, s.y] = P(place); s.trip = null;
  for (let tries = 0; tries < 6; tries++) {
    G.setHealth(s, G.maxHealth(s)); s.voiceAt = 0;
    const r = QUESTS.talk(s, "dragonborn", t += 60);
    if (r.died) { s.location = place; [s.x, s.y] = P(place); console.log("  lost at " + place + ", trying again"); continue; }
    if (q().stage === expectStage || q().done) return r;
    console.log("  talk " + place + ": " + r.text); if (!r.fight) return r;
  }
  return null;
}
let r = talk("Raven Rock", 1); ok(q().stage === 1, "cultists beaten: " + (r && r.text));
// stones need Bend Will first
s.location = "Earth Stone"; [s.x, s.y] = P("Earth Stone");
ok(/Not this way/.test(QUESTS.talk(s, "dragonborn", t).text), "stage 1 is the temple, not a talk");
ok(/Bend Will/.test(QUESTS.L.dragonborn.stages[2].obj.need(hero("NB"))), "stones need Bend Will");
s.cleared = s.cleared || {}; s.cleared["Temple of Miraak"] = G.now() + 5;
let msgs = QUESTS.check(s);
ok(q().stage === 2 && POWERS.level(s, "bend_will") === 1, "temple cleared: GOL learned " + msgs.join(" | "));
ok(!POWERS.nextWord(s) || POWERS.nextWord(s)[2] !== "bend_will", "word walls don't teach Bend Will");
r = talk("Earth Stone", 3); ok(q().stage === 3 && s.solEarth, "Earth Stone freed");
r = talk("Skaal Village", 4); ok(q().stage === 4, "met the Skaal");
r = talk("Wind Stone", 5); ok(q().stage === 5, "Wind Stone"); QUESTS.check(s); ok(POWERS.level(s, "bend_will") === 2, "HAH learned");
r = talk("Water Stone", 6); ok(q().stage === 6, "Water Stone");
r = talk("Beast Stone", 7); ok(q().stage === 7, "Beast Stone");
r = talk("Sun Stone", 8); ok(q().stage === 8, "Sun Stone");
r = talk("Tree Stone", 9); ok(q().stage === 9, "Tree Stone");
ok(SOL.STONES.every((n) => SOL.freed(s, n)), "all six stones free");
s.location = "Temple of Miraak"; [s.x, s.y] = P("Temple of Miraak");
r = talk("Skaal Village", 10); ok(q().stage === 10 && s.inv.some((x) => x.item === "black_book"), "Hermaeus Mora's bargain");
for (let i = 0; i < 8; i++) G.give(s, "potion_health");   // you'd stock up before the summit
r = talk("Temple of Miraak", 11);
ok(q().done && (s.titles || []).includes("Dragonborn of Solstheim") && s.inv.some((x) => x.item === "miraak_robes"), "Miraak defeated: " + (r && r.text));
ok(POWERS.level(s, "bend_will") === 3, "Bend Will at full strength");
ok(QUESTS.recOf("dragonborn", 10) >= 30, "summit is level 30+");
// Bend Will in a fight
const mock = (tags) => ({ s, t, tags: new Set(tags), allies: [], pw: {}, calmTurns: 0, eParalyzed: 0, ehp: 100 });
s.voiceAt = 0; let m = mock(["dragon"]); ok(/dragon/.test(POWERS.act(m, "shout", "bend_will")) && m.allies.length === 1, "Bend Will bends a dragon");
s.voiceAt = 0; m = mock(["humanoid"]); ok(/will is yours/.test(POWERS.act(m, "shout", "bend_will")) && m.calmTurns === 6, "Bend Will on a person");
ok(POWERS.affordable({ s, t: t + 1e6, shoutedThisTurn: false }, "shout", "bend_will"), "Bend Will usable in tactics");

// ---- Stalhrim
const sm = hero("SM"); sm.skills.Smithing.lvl = 30; G.give(sm, "pickaxe");
sm.location = "Kolbjorn Barrow"; [sm.x, sm.y] = P("Kolbjorn Barrow");
ok(/Baldor/.test(SMITH.mine(sm)), "stalhrim needs the technique");
sm.location = "Skaal Village"; ok(/Smithing 40/.test(SOL.learnTechnique(sm)), "technique needs Smithing 40");
sm.skills.Smithing.lvl = 45; ok(/stalhrim/.test(SOL.learnTechnique(sm)) && SOL.knowsTechnique(sm), "learned the technique");
sm.location = "Benkongerike"; const mm = SMITH.mine(sm); ok(/⛏/.test(mm) && SMITH.count(sm, "ore_stalhrim") >= 3, "mined stalhrim: " + mm);
sm.location = "Kolbjorn Barrow"; ok(/⛏/.test(SMITH.mine(sm)), "Kolbjorn deposit too");
const have = SMITH.count(sm, "ore_stalhrim"), swords = SMITH.count(sm, "stalhrim_sword"); G.give(sm, "mat_strips", 10);
sm.location = "Windhelm"; ok(/Only the forge in Raven Rock/.test(SMITH.make(sm, "stalhrim_sword")), "only at Raven Rock");
sm.location = "Raven Rock"; sm.perks = {};
ok(/Advanced Armors/.test(SMITH.make(sm, "stalhrim_sword")), "needs the perk");
sm.perks = { steel_smithing: 1, advanced_armors: 1 };
ok(/Stalhrim Sword/.test(SMITH.make(sm, "stalhrim_sword")) && SMITH.count(sm, "stalhrim_sword") === swords + 1 && SMITH.count(sm, "ore_stalhrim") === have - 2, "forged a Stalhrim Sword");
G.give(sm, "mat_chitin", 4); ok(/Chitin Armor/.test(SMITH.make(sm, "chitin_armor")), "chitin armor");
G.give(sm, "mat_netch_leather", 3); G.give(sm, "mat_iron", 2); G.give(sm, "ing_bone_meal", 2); ok(/Bonemold Armor/.test(SMITH.make(sm, "bonemold_armor")), "bonemold armor");
ok(SMITH.GROUPS.some((x) => x[0] === "stalhrim") && SMITH.byGroup("stalhrim").length >= 10, "stalhrim group");
ok(G.shopStock("Raven Rock").includes("mat_chitin") && G.shopTypes("Raven Rock").includes("blacksmith"), "Raven Rock smith sells chitin");
ok(TOWNS.INNS["Raven Rock"] === "The Retching Netch" && TOWNS.isTown("Raven Rock"), "the Retching Netch");

// ---- cards and maps
const card = (pl) => ({ name: pl.name, x: pl.x, y: pl.y, region: WORLD.regionOf([pl.x, pl.y]) });
const cards = [card(s), card(sk), { name: "old", x: 0.5, y: 0.5 }];
const sameMap = (me, o) => (o.region || WORLD.regionOf([o.x, o.y])) === WORLD.regionOf([me.x, me.y]);
ok(cards.filter((o) => sameMap(sk, o)).map((o) => o.name).join() === "HeroSK,old", "Skyrim sees Skyrim cards (old cards count as Skyrim)");
ok(cards.filter((o) => sameMap(s, o)).map((o) => o.name).join() === "HeroA", "Solstheim sees Solstheim cards");
ok(card(s).region === "solstheim" && card(sk).region === "skyrim", "card region");
ok(WORLD.onMap([0.5, 2.5]) && WORLD.onMap([0.5, 0.5]) && !WORLD.onMap([0.5, 1.5]), "onMap");
// free roam on the island
let rp = ROAM.plan(s, [0.45, 2.7]); ok(rp.pos && WORLD.isSol(rp.pos), "roam on Solstheim: " + JSON.stringify(rp));
ok(/across the sea/.test(ROAM.plan(s, [0.5, 0.5]).err), "can't roam to Skyrim");
ok(/across the sea/.test(ROAM.plan(sk, [0.5, 2.5]).err), "can't roam to Solstheim from Skyrim");
ok(ROAM.plan(sk, [0.5, 0.55]).pos, "Skyrim roam still works");
rp = ROAM.plan(s, [0.02, 2.02]); ok(rp.err || WORLD.isSol(rp.pos), "sea tap");

// ---- save/load on the island, death, the boat home
s.location = "Raven Rock"; [s.x, s.y] = P("Raven Rock"); s.trip = null;
const loaded = G.migrate(JSON.parse(JSON.stringify(s)));
ok(loaded.location === "Raven Rock" && WORLD.isSol([loaded.x, loaded.y]) && loaded.quests.dragonborn.done && loaded.discovered.includes("Kolbjorn Barrow"), "save/load on Solstheim");
const dd = hero("DD"); dd.location = null; [dd.x, dd.y] = P("Sun Stone"); dd.discovered.push("Raven Rock", "Tel Mithryn");
G.die(dd, "Lurker", t); ok(dd.location === "Tel Mithryn" || dd.location === "Raven Rock", "you wake on the island: " + dd.location);
s.gold = 300; ok(SOL.sail(s, t) === null && s.trip.destName === "Windhelm", "sail home");
out = G.advance(s, t + 3001);
ok(out.arrived === "Windhelm" && s.location === "Windhelm" && !WORLD.isSol([s.x, s.y]), "back in Windhelm");
ok(G.startTrip(s, "Whiterun", P("Whiterun"), t + 3002) === null, "walk on in Skyrim");
// an old save, before Solstheim existed
const old = { ...G.newSave("O", "Old", "nord") }; delete old.quests;
const oldM = G.migrate(JSON.parse(JSON.stringify(old)));
ok(oldM.location === "Riverwood" || oldM.location, "old save loads"); ok(WORLD.regionOf([oldM.x, oldM.y]) === "skyrim", "old save in Skyrim");
QUESTS.check(oldM); ok(!oldM.quests.dragonborn, "no Solstheim quest until you sail");
console.log(fails ? "FAILED " + fails + " (passed " + passes + ")" : "ALL OK " + passes);
`, c, { filename: "test_solstheim" });
