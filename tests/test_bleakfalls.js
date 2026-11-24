const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Bleak Falls Barrow / Farengar's Dragonstone (main quest "The Dragonborn"): clearing the barrow moves the quest on by
// itself and the hand-in never needs the stone. Solo, party member, old saves, lost stone, clear before the quest.
// Plus an audit: no quest stage may wait on an item you can lose without a repair (questitems.js).
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, process };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "civilwar.js", "daedric.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "curses.js", "smithing.js", "social.js", "ammo.js", "tomes.js", "magic.js", "mp.js", "coop.js", "questitems.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0;
const ok = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const BFB = "Bleak Falls Barrow";
const at = (s, p) => { s.location = p; [s.x, s.y] = WORLD.places[p]; s.trip = null; if (!s.discovered.includes(p)) s.discovered.push(p); };
const mk = (id) => { const s = G.newSave(id, "Hero " + id, "nord"); s.level = 30; s.hpBonus = 300; G.setHealth(s, G.maxHealth(s)); return s; };
const main = (s) => s.quests.main;
const title = (s) => QUESTS.L.main.stages[main(s).stage].title;
const has = (s, i) => s.inv.some((r) => r.item === i);
const IDX = (t) => QUESTS.L.main.stages.findIndex((x) => x.title === t);
ok(IDX("Bleak Falls Barrow") === 1 && IDX("The Dragonstone") === 2 && IDX("Dragon Rising") === 3, "main quest stages in order");
ok(QUESTS.REC.main.length === QUESTS.L.main.stages.length, "a recommended level per main stage");
ok(!/Bring it to him/.test(QUESTS.L.main.stages[1].text), "the barrow stage asks you to clear it, not to carry anything");
/* walk a dungeon to its boss and kill it (rooms on the way are skipped; the boss is made soft so the test is about the quest) */
function killBoss(s) {
  let g = 0;
  while (s.dungeon && !s.dungeon.done && g++ < 60) {
    const d = s.dungeon;
    if (d.room && d.room.type === "boss") { d.room.enemy.health = 1; d.room.enemy.hp = 1; d.room.enemy.damage = 0; const r = DUNGEONS.act(s, "fight"); if (r.cleared) return r; continue; }
    d.room = null;
    const ch = DUNGEONS.nextChoices(s); if (!ch.length) break;
    const e = DUNGEONS.enterRoom(s, ch[0]); if (e) throw new Error(e);
  }
  return null;
}
function soloClear(s) { at(s, BFB); const e = DUNGEONS.enter(s); ok(!e, "enter: " + e); const r = killBoss(s); ok(r && r.cleared, "boss down"); DUNGEONS.leave(s); at(s, "Whiterun"); }

// 1. a fresh character, start to finish
{
  const s = mk("solo"); QUESTS.ensure(s);
  ok(main(s).stage === 0 && main(s).bf, "fresh save starts at Before the Storm, already on the new stages");
  at(s, "Whiterun"); QUESTS.check(s);
  ok(title(s) === "Bleak Falls Barrow", "Whiterun warned: off to the barrow (" + title(s) + ")");
  ok(!TOWNS.canDeliverDragonstone(s) && /Clear the barrow/.test(TOWNS.deliverDragonstone(s)) && !s.thaneWhiterun, "Farengar can't be handed anything before the barrow");
  soloClear(s);
  ok(s.cleared[BFB], "barrow marked cleared");
  const m = QUESTS.check(s);
  ok(title(s) === "The Dragonstone", "clearing the barrow moves the quest log on by itself (" + title(s) + ")");
  ok(m.some((x) => /New objective: The Dragonstone/.test(x)), "the player is told");
  ok(QUESTS.target(QUESTS.tracked(s).st) === "Whiterun", "the next step points to Whiterun");
  ok(TOWNS.canDeliverDragonstone(s), "Area tab: Farengar's Give it button is on");
  const g0 = s.gold, r = QUESTS.talk(s, "main");   // the Journal button
  ok(s.thaneWhiterun && s.gold >= g0 + 300, "Farengar takes it: thane + 300 gold (" + r.text + ")");
  ok(title(s) === "Dragon Rising", "next stage appears: " + title(s));
  ok(!has(s, "dragonstone"), "the stone went to Farengar");
  ok((r.msgs || []).some((x) => /Dragon Rising/.test(x)), "new objective announced");
  ok(/already has/.test(TOWNS.deliverDragonstone(s)), "no second reward");
}
// 1b. the same through the Area tab (Court wizard) instead of the Journal
{
  const s = mk("area"); QUESTS.ensure(s); at(s, "Whiterun"); QUESTS.check(s); soloClear(s); QUESTS.check(s);
  const t = TOWNS.deliverDragonstone(s); QUESTS.check(s);
  ok(/snatches/.test(t) && title(s) === "Dragon Rising", "Area tab hand-in finishes the stage");
}
// 2. a party clear where you're not the leader
{
  const A = mk("lead"), B = mk("memb");
  for (const s of [A, B]) { QUESTS.ensure(s); at(s, "Whiterun"); QUESTS.check(s); at(s, BFB); }
  ok(title(B) === "Bleak Falls Barrow", "member on the barrow stage");
  let run = { ...COOP.newRun(A).doc, id: "run1" };
  run = COOP.addMember(run, B);
  ok(COOP.join(A, run) === null && COOP.join(B, run) === null, "both in");
  for (let step = 0; step < run.rows.length; step++) {
    const col = DUNGEONS.nextChoices(A)[0]; ok(DUNGEONS.enterRoom(A, col) === null, "leader steps in");
    A.dungeon.path.push([A.dungeon.row, A.dungeon.col]);
    run = COOP.recordPick(run, A.dungeon); COOP.picked(A, run); COOP.follow(B, run);
    if (A.dungeon.room.type === "boss") break;
    A.dungeon.room = null; B.dungeon.room = null;
  }
  ok(B.dungeon.room && B.dungeon.room.type === "boss", "member reached the boss behind the leader");
  const r = killBoss(B);
  ok(r && r.cleared && B.cleared[BFB], "member beat the boss");
  ok(!COOP.canPick(B, run), "and was never the one picking");
  DUNGEONS.leave(B); B.inv = B.inv.filter((x) => x.item !== "dragonstone");   // whatever happened to the stone in the party
  QUESTS.check(B);
  ok(title(B) === "The Dragonstone", "member's own quest log moved on (" + title(B) + ")");
  at(B, "Whiterun"); QUESTS.talk(B, "main");
  ok(B.thaneWhiterun && title(B) === "Dragon Rising", "member hands in without the stone");
  ok(title(A) === "Bleak Falls Barrow", "the leader's quest is the leader's own (they didn't kill the boss here)");
}
// 3. an old save stuck at "bring the Dragonstone", repaired on load
{
  const s = mk("old"); s.quests = { main: { stage: 1, t: 5000 } };   // old layout, no bf mark
  s.cleared = { [BFB]: 4000 };                                    // cleared before the stage's time
  s.inv = s.inv.filter((x) => x.item !== "dragonstone"); at(s, "Whiterun");
  G.migrate(s);
  ok(main(s).bf && title(s) === "The Dragonstone", "old stuck save moves to the hand-in on load (" + title(s) + ")");
  ok(TOWNS.canDeliverDragonstone(s), "and Farengar takes it without the stone");
  TOWNS.deliverDragonstone(s); QUESTS.check(s);
  ok(title(s) === "Dragon Rising", "then Dragon Rising");
  ok(s.journal.some((j) => /Bleak Falls Barrow/.test(j.text)), "journal says what happened");
}
// 3b. an old save that holds the Dragonstone but has no clear on record
{
  const s = mk("old2"); s.quests = { main: { stage: 1, t: 5000 } }; G.give(s, "dragonstone"); G.migrate(s);
  ok(title(s) === "The Dragonstone", "holding the stone is proof enough");
}
// 3c. old saves further on shift by one stage and get no second reward
{
  const s = mk("old3"); s.quests = { main: { stage: 2, t: 1 } }; s.thaneWhiterun = true; s.cleared = { [BFB]: 1 }; const g = s.gold;
  G.migrate(s);
  ok(title(s) === "Dragon Rising" && s.gold === g, "old Dragon Rising stays Dragon Rising (" + title(s) + ")");
  const d = mk("old4"); d.quests = { main: { stage: 5, done: true, t: 1 } }; G.migrate(d); ok(d.quests.main.done && d.quests.main.stage === 5, "finished main quest untouched");
  const e = mk("old5"); e.quests = { main: { stage: 1, t: 1 } }; e.thaneWhiterun = true; G.migrate(e); ok(title(e) === "Dragon Rising", "already thane: straight on");
  QUESTS.ensure(s); ok(title(s) === "Dragon Rising", "migration runs once");
}
// 4. the stone lost, sold, stashed or left behind: never blocks
{
  const s = mk("lost"); QUESTS.ensure(s); at(s, "Whiterun"); QUESTS.check(s); soloClear(s); QUESTS.check(s);
  ok(has(s, "dragonstone"), "the boss still leaves the stone (flavour)");
  const row = s.inv.find((x) => x.item === "dragonstone");
  const sold = G.sell(s, row.id); ok(has(s, "dragonstone"), "merchants won't buy it: " + sold);
  const d = G.die(s, "test", G.now()); ok(has(s, "dragonstone") && !(d.bag && d.bag.items.some((i) => i[0] === "dragonstone")), "kept when you die");
  s.inv = s.inv.filter((x) => x.item !== "dragonstone");   // gone anyway (an old bag, a party pile...)
  at(s, "Whiterun"); QUESTS.check(s);
  ok(title(s) === "The Dragonstone" && TOWNS.canDeliverDragonstone(s), "still at the hand-in with the button on");
  const t = TOWNS.deliverDragonstone(s); QUESTS.check(s);
  ok(s.thaneWhiterun && /from memory/.test(t) && title(s) === "Dragon Rising", "handed in without it: " + t);
}
// 5. the barrow cleared before the quest reached it
{
  const s = mk("early"); QUESTS.ensure(s); ok(main(s).stage === 0, "still on Before the Storm");
  soloClear(s);   // ends in Whiterun
  QUESTS.check(s);
  ok(title(s) === "The Dragonstone", "an earlier clear counts: straight to the hand-in (" + title(s) + ")");
}
// 6. audit: quest stages that wait on an item in your pack must have a repair (questitems.js)
{
  const usesPack = (o) => typeof o.need === "function" && /\\binv\\b|carried|allCarried/.test(o.need.toString());
  const missing = [];
  for (const [id, L] of Object.entries(QUESTS.L)) L.stages.forEach((st, i) => { if (usesPack(st.obj || {}) && !QITEMS.covers(id, i)) missing.push(id + "#" + i + " " + st.title); });
  ok(!missing.length, "stages that need an item but have no repair: " + missing.join(", "));
  for (const [id, L] of Object.entries(QUESTS.L)) L.stages.forEach((st) => { const o = st.obj || {};
    if (o.flag === "thaneWhiterun") ok(o.deliver && o.talk, "Farengar's stage has a hand-in button"); });
  ok(!QUESTS.L.main.stages.some((st) => usesPack(st.obj || {})), "no main quest stage looks in your pack");
  // a "talk" stage with an item check: every item it names is a quest item you can't sell or lose on death
  for (const [line, at] of QITEMS.NEED) { const L = QUESTS.L[line]; if (!L) continue; const i = typeof at === "function" ? at(L) : at; ok(L.stages[i], "repair points at a real stage " + line); }
  ok(D.ITEMS.dragonstone.noTrade && D.ITEMS.glenmoril_head.noTrade && D.ITEMS.soul_gem_black_full.noTrade, "quest items are bound to you");
}
// 7. the repair itself: a needed quest item comes back from a house chest, or turns up in the pack
{
  const s = mk("wolf"); s.werewolf = true; QUESTS.ensure(s); ok(s.quests.cure_wolf, "cure quest started");
  s.quests.cure_wolf.stage = 1; s.inv = s.inv.filter((x) => x.item !== "glenmoril_head");
  s.homes = { Whiterun: { chest: [{ item: "glenmoril_head", qty: 1, charge: null }] } };
  QUESTS.check(s);
  ok(has(s, "glenmoril_head") && !s.homes.Whiterun.chest.length, "witch's head taken from the house chest");
  s.inv = s.inv.filter((x) => x.item !== "glenmoril_head"); QUESTS.check(s);
  ok(has(s, "glenmoril_head"), "or it turns up in the pack");
  const before = s.inv.filter((x) => x.item === "glenmoril_head").length; QUESTS.check(s);
  ok(s.inv.filter((x) => x.item === "glenmoril_head").length === before, "never a second copy");
  const v = mk("vamp"); v.vampire = true; QUESTS.ensure(v); v.quests.cure_vamp.stage = 2; v.blackGemFull = true; QUESTS.check(v);
  ok(has(v, "soul_gem_black_full"), "filled black soul gem comes back for the dawn ritual");
}
console.log("ok test_bleakfalls: " + n + " checks");
`, c);
