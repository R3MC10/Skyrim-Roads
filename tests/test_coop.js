const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// co-op dungeons: shared map, following the leader, allies on their tactics, fair one-time chest claims
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "social.js", "ammo.js", "tomes.js", "magic.js", "mp.js", "coop.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const ok = (x, m) => { if (!x) throw new Error("FAIL " + m); };
const mk = (id, name) => { const s = G.newSave(id, name, "nord"); s.location = "Bleak Falls Barrow"; s.level = 12; return s; };
const A = mk("A", "Alfa"), B = mk("B", "Beta"), C = mk("C", "Ceta");
// lobby
const nr = COOP.newRun(A); ok(nr.doc && nr.doc.leader === "A" && nr.doc.rows.length > 3, "new run");
let run = { ...nr.doc, id: nr.id };
ok(COOP.newRun({ ...A, location: "Whiterun" }).err, "only at a dungeon door");
run = COOP.invite(run, "B", "Beta").run; ok(run.invites.length === 1, "invite");
ok(COOP.invite(run, "B", "Beta").err, "no double invite");
run = COOP.addMember(run, B); ok(run.members.length === 2 && !run.invites.length, "B joins");
run = COOP.addMember(run, C); ok(run.members.length === 3, "C joins");
ok(COOP.join(A, run) === null && A.dungeon.run === run.id, "A in");
ok(COOP.join(B, run) === null && C.location === "Bleak Falls Barrow" && COOP.join(C, run) === null, "B, C in");
ok(JSON.stringify(A.dungeon.rows) === JSON.stringify(B.dungeon.rows), "same map");
// the leader picks, the others follow into the same room with the same foe
ok(COOP.canPick(A, run) && !COOP.canPick(B, run), "only the leader picks");
let walks = 0;
for (let step = 0; step < run.rows.length; step++) {
  const nx = DUNGEONS.nextChoices(A); ok(nx.length, "choices at " + step);
  const col = nx[0]; ok(DUNGEONS.enterRoom(A, col) === null, "enter");
  A.dungeon.path.push([A.dungeon.row, A.dungeon.col]);
  const r2 = COOP.recordPick(run, A.dungeon); ok(r2 && r2.path.length === step + 1, "record " + step);
  ok(COOP.recordPick(run, A.dungeon) && !COOP.recordPick(r2, A.dungeon), "no forked path");
  run = r2; COOP.picked(A, run);
  for (const s of [B, C]) { walks += COOP.follow(s, run); ok(s.dungeon.row === A.dungeon.row && s.dungeon.col === A.dungeon.col && s.dungeon.room.type === A.dungeon.room.type, "follow " + step); }
  ok(COOP.follow(B, run) === 0, "one room at a time");
  if (A.dungeon.room.enemy && A.dungeon.room.type !== "boss") ok(B.dungeon.room.enemy.name === A.dungeon.room.enemy.name, "same foe " + A.dungeon.room.enemy.name);
  if (A.dungeon.room.enemy) ok(A.dungeon.room.enemy.health > 0, "tougher foe");
  if (A.dungeon.room.type === "boss") break;
  for (const s of [A, B, C]) s.dungeon.room = null;   // rooms resolved
}
ok(walks >= run.rows.length * 2 - 2, "everyone walked the path");
// allies act on their tactics
const cards = [B, C].map((s) => ({ id: s.id, name: s.name, cur: G.maxHealth(s), coop: COOP.card(s), ...MP.stats(s), coop: COOP.card(s) }));
ok(cards[0].coop.run === run.id && cards[0].coop.step === A.dungeon.cstep, "card carries run and room");
const al = COOP.allies(A, cards); ok(al.length === 2 && al.every((x) => x.coop && x.player), "both fight beside A");
ok(COOP.allies(A, [{ ...cards[0], coop: { ...cards[0].coop, step: 0 } }]).length === 0, "not if in another room");
// healer profile from tactics
B.spells.push("healing"); G.addRule(G.loadout(B).rules, { if: "hp_below", pct: 60, do: "spell:healing" });
const pB = COOP.profile(B); ok(pB.role === "healer" && pB.healAt === 60 && pB.heals > 0, "healer from tactics " + JSON.stringify(pB));
const h = COOP.allyFromCard({ name: "Beta", cur: 100, coop: { prof: pB } });
const f = { s: A, hp: G.maxHealth(A) * 0.3, ehp: 100, turn: 2, e: { name: "Draugr", damage: 10 }, allies: [h] };
const line = COOP.allyAct(f, h); ok(/heals you/.test(line) && f.hp > G.maxHealth(A) * 0.3, "healer heals: " + line);
const g = { ...COOP.allyFromCard({ name: "Ceta", cur: 50, coop: { prof: { dmg: 9, hp: 50, red: 0.2, role: "guard" } } }) };
let downed = false; const f2 = { s: A, hp: 100, ehp: 100, turn: 1, e: { name: "Draugr", damage: 40 }, allies: [g] };
for (let i = 0; i < 20 && !downed; i++) downed = /down/.test(COOP.hitAlly(f2, g));
ok(downed && !f2.allies.length, "an ally can be knocked down");
// a real fight with co-op allies
G.setAllyProvider(() => COOP.allies(A, cards));
const e = COOP.foe(A, "draugr", 2, 3); ok(e.health > DUNGEONS.ENEMY.draugr.health, "foe scales with members");
const fight = new G.Fight(A, e, null, G.now()); ok(fight.allies.filter((a) => a.coop).length === 2, "fight has the allies");
fight.run({ t: G.now() }); ok(fight.log.some((l) => /Beta|Ceta/.test(l.me + l.them)), "allies show in the log");
G.setAllyProvider(() => []);
// boss chest: one fair roll each, only once, only for killers and members
run = COOP.bossDown(run, "A"); run = COOP.bossDown(run, "B"); run = COOP.bossDown(run, "A");
ok(run.chest.killers.length === 2, "killers recorded once");
let o = COOP.claim(run, "A", 12); ok(o.got && o.got.gold > 0, "A claims"); run = o.run;
ok(!COOP.claim(run, "A", 12).got, "A can't claim twice");
ok(!COOP.claim(run, "C", 12).got, "C didn't beat the boss yet");
ok(!COOP.claim(run, "Z", 12).got, "outsider can't claim");
const rb = COOP.roll(run, "B", 12); o = COOP.claim(run, "B", 12); ok(JSON.stringify(o.got.items) === JSON.stringify(rb.items) && o.got.gold === rb.gold, "roll is fixed per player (no rerolls)"); run = o.run;
const g0 = A.gold; ok(COOP.give(A, run, run.claims.A) && A.gold === g0 + run.claims.A.gold, "A gets gold"); ok(!COOP.give(A, run, run.claims.A) && A.gold === g0 + run.claims.A.gold, "and only once locally");
// the solo betrayal chest is off in co-op runs
ok(!/partyChest/.test(JSON.stringify(Object.keys(A.dungeon))), "no party chest state");
// leaving passes the lead
let r3 = COOP.removeMember(run, "A"); ok(r3.leader !== "A" && COOP.activeMembers(r3).length === 2, "lead passes");
r3 = COOP.removeMember(COOP.removeMember(r3, "B"), "C"); ok(r3 === null, "empty run is over");
// re-invite after leaving
let r4 = COOP.removeMember(run, "C"); ok(!COOP.invite(r4, "C", "Ceta").err, "can re-invite someone who left");
ok(!COOP.live({ ...run, t: G.now() - COOP.RUN_SECONDS - 1 }), "old runs expire");
// refill: can't join a run where you cleared it recently
const D2 = mk("D", "Delta"); D2.cleared = { "Bleak Falls Barrow": G.now() }; run = COOP.addMember(run, D2) || run;
ok(/cleared/.test(COOP.join(D2, run) || ""), "cleared recently blocks");
// lair: single boss room
const L = mk("L", "Lair"); L.location = Object.keys(WORLD.places).find((n) => DUNGEONS.info(n)?.theme === "lair");
if (L.location) { const lr = COOP.newRun(L); ok(lr.doc.rows.length === 1 && lr.doc.boss === "dragon", "dragon lair run"); }
console.log("coop ok");
`, c);
