const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// party play: the leader leads, ready checks, the leader decides on the road, shared spoils, dungeons that grow with the party (up to 8)
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "horses.js", "horseback.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "craftfair.js", "social.js", "ammo.js", "tomes.js", "magic.js", "combatai.js", "mp.js", "coop.js", "party.js", "partyplay.js", "lootvote.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const ok = (x, m) => { if (!x) throw new Error("FAIL " + m); };
let n = 0; const OK = (x, m) => { ok(x, m); n++; };
const P = PARTYPLAY;
const mk = (id, name) => { const s = G.newSave(id, name, "nord"); s.location = "Whiterun"; [s.x, s.y] = WORLD.places["Whiterun"]; s.level = 15; return s; };
const ids = ["A", "B", "C", "D", "E", "F", "G2", "H"], names = ["Alfa", "Beta", "Ceta", "Dera", "Echo", "Foxa", "Gala", "Hilo"];
const heroes = ids.map((id, i) => mk(id, names[i]));
const [A, B, C] = heroes;
const party8 = { id: "p8", leader: "A", leaderName: "Alfa", members: ids.map((id, i) => ({ id, name: names[i] })), t: G.now() };
const party3 = { ...party8, id: "p3", members: party8.members.slice(0, 3) };

// ---- caps
OK(P.MAX_PARTY === 8, "parties hold 8");
OK(COOP.MAX_MEMBERS === 8, "co-op runs hold 8");
OK(PARTY.MAX_ALLIES === 7, "7 fight beside you");

// ---- who decides, who leads
OK(P.role(A, party3) === "leader" && P.role(B, party3) === "member" && P.role(A, null) === "solo", "roles");
OK(P.role(A, { ...party3, members: [party3.members[0]] }) === "solo", "a party of one is just you");
OK(P.canDecide(A, party3), "the leader decides");
OK(P.canDecide(B, party3), "a member standing in town decides their own things");
G.startTrip(B, "Riverwood", WORLD.places.Riverwood.slice(0, 2)); B.trip.follow = "A";
OK(!P.canDecide(B, party3), "a member following the leader does not decide");
OK(P.canDecide(B, null) && P.canDecide(B, { ...party3, leader: "B" }), "solo / leading: decide");
OK(!P.canLead(B, party3, [B.x, B.y]), "following: can't pick where to go");
B.trip = null; B.location = "Whiterun";
OK(!P.canLead(B, party3, [B.x + 0.01, B.y]), "standing with the leader: the leader picks");
OK(P.canLead(B, party3, [B.x + 0.5, B.y]), "far from the leader: travel alone to catch up");
OK(P.canLead(B, party3, null), "leader offline: carry on");
OK(P.canLead(A, party3, null), "the leader leads");

// ---- engine: a follower never rolls road encounters
{
  const s = mk("F1", "Follow"); s.location = null;
  G.startTrip(s, "Markarth", WORLD.places.Markarth.slice(0, 2)); s.trip.follow = "A";
  const t0 = s.trip.lastTick; let enc = 0;
  for (let k = 1; k <= 120; k++) { const out = G.advance(s, t0 + k * 30); if (out.encounter) enc++; if (!s.trip) break; if (s.trip.status !== "travel") { s.trip.status = "travel"; } }
  OK(enc === 0, "no encounters while following");
  let enc2 = 0;
  for (let run = 0; run < 12 && !enc2; run++) {   // encounters are random per trip: a few trips are enough to meet one
    const s2 = mk("F2", "Lead"); s2.location = null; G.startTrip(s2, "Markarth", WORLD.places.Markarth.slice(0, 2));
    const t1 = s2.trip.lastTick;
    for (let k = 1; k <= 400 && s2.trip; k++) { const out = G.advance(s2, t1 + k * 30); if (out.encounter || s2.trip?.status === "encounter") { enc2++; s2.trip.status = "travel"; s2.trip.encounter = null; } if (out.died) break; }
  }
  OK(enc2 > 0, "the same road without following does have encounters (" + enc2 + ")");
}

// ---- ready check
let p = P.startCheck(party8, "A", { kind: "travel", destName: "Riverwood", dest: [0.5, 0.5] }, ids.slice(1), 1000);
OK(p.ready && p.ready.who.length === 8 && p.ready.ok.A, "check covers all 8, leader is ready");
OK(P.startCheck(party8, "B", { kind: "travel" }, ids, 1000) === party8, "only the leader starts a check");
OK(!P.allReady(p) && P.waitingOn(p).length === 7, "waiting on 7");
OK(!P.canForce(p, 1030) && P.canForce(p, 1061), "the leader may go without them after 60s");
for (const id of ids.slice(1, 7)) p = P.setReady(p, id, true, 1010);
OK(!P.allReady(p) && P.waitingOn(p).join() === "H", "one left: H");
p = P.setReady(p, "H", false, 1012);
OK(p.ready.no.H && !P.allReady(p), "H not yet");
OK(P.setReady(p, "ZZ", true, 1012) === p, "outsiders can't answer");
p = P.setReady(p, "H", true, 1015);
OK(P.allReady(p) && P.goers(p).length === 8, "all 8 ready, all go");
OK(!P.checkLive(p, 1000 + P.READY_LIVE_SECONDS + 5), "a forgotten check expires");
OK(!P.clearCheck(p).ready, "cleared");
let q = P.startCheck(party8, "A", { kind: "dungeon", place: "Bleak Falls Barrow" }, ["B", "C"], 2000);
q = P.setReady(q, "B", true, 2001);
OK(P.goers(q).join() === "A,B", "forcing: only the ready ones go");
q = P.kick(q, "A", "C");
OK(!q.members.some((m) => m.id === "C") && !q.ready.who.includes("C") && P.allReady(q), "kick C: out of the party and the check");
OK(P.kick(q, "B", "A") === q && P.kick(q, "A", "A") === q, "only the leader kicks, never themself");

// ---- halts
let h = P.halt(party3, "A", { kind: "encounter", name: "Bandit outlaw", text: "..." }, 3000);
OK(P.halted(h, 3010) && h.halt.name === "Bandit outlaw", "the leader stops the party");
OK(P.halt(party3, "B", { kind: "event" }) === party3, "members can't stop the party");
h = P.resolve(h, "A", "won the fight", 3050);
OK(!P.halted(h, 3051) && h.halt.done.text === "won the fight", "resolved: the party moves on");
OK(!P.halted(P.halt(party3, "A", { kind: "event" }, 3000), 3000 + 1000), "a stop nobody resolved doesn't hold forever");

// ---- gold on the road: split evenly between all 8
for (const n2 of [2, 3, 8]) { const sp = P.split(101, n2); OK(sp.leaderKeeps + sp.each * (n2 - 1) === 101 && sp.leaderKeeps >= sp.each, "split " + n2 + ": " + JSON.stringify(sp)); }
OK(P.split(5, 8).each === 0, "tiny finds aren't split into nothing");
{
  const sh = P.goldShareDoc(A, ids.slice(1), names.slice(1), 12, "the road");
  let doc = sh.doc, gotAll = 0;
  for (const hz of heroes.slice(1)) {
    const g0 = hz.gold; const o = PARTY.claim(doc, sh.id, hz.id); doc = o.doc;
    const res = PARTY.give(hz, sh.id, doc, o.got);
    OK(res && hz.gold === g0 + 12, hz.name + " gets 12");
    const again = PARTY.claim(doc, sh.id, hz.id); OK(!again.got, hz.name + " can't take it twice");
    gotAll++;
  }
  OK(gotAll === 7, "7 shares claimed");
  const out = PARTY.claim(doc, sh.id, "ZZ"); OK(!out.got, "outsiders get nothing");
}
// fight spoils: up to 7 share a won fight
{
  const sd = PARTY.shareDoc(A, { e: { name: "Troll", level: 15 } }, ids.slice(1), names.slice(1));
  let doc = sd.doc, k = 0;
  for (const hz of heroes.slice(1)) { const o = PARTY.claim(doc, sd.id, hz.id); doc = o.doc; if (PARTY.give(hz, sd.id, doc, o.got)) k++; }
  OK(k === 7, "all 7 others take their own fight share");
}

// ---- dungeons: longer and busier with the party
const layoutFn = (th, ti) => DUNGEONS.layout(th, ti);
OK(P.lengthFactor(1) === 1 && P.lengthFactor(2) === 1.5 && P.lengthFactor(3) === 2 && P.lengthFactor(5) === 3 && P.lengthFactor(7) === 4 && P.lengthFactor(8) === 4, "length × (1 + 0.5 per extra), capped at 4×");
OK(P.waves(1) === 1 && P.waves(3) === 3 && P.waves(6) === 6 && P.waves(8) === 6, "one foe per hero, at most 6");
for (const n2 of [1, 2, 3, 4, 8]) for (let rep = 0; rep < 6; rep++) {
  const base = DUNGEONS.layout("barrow", 2).length - 1;
  const L = P.longLayout("barrow", 2, n2, layoutFn);
  OK(L[L.length - 1][0].type === "boss" && L[L.length - 1].length === 1, "ends at the boss");
  OK(L.slice(0, -1).every((row) => row.every((nd) => nd.type !== "boss")), "only one boss");
  // every room is reachable and every room leads on
  for (let r = 0; r < L.length - 1; r++) {
    OK(L[r].every((nd) => nd.links.length && nd.links.every((j) => j >= 0 && j < L[r + 1].length)), "links valid row " + r);
    OK(L[r + 1].every((_, j) => L[r].some((nd) => nd.links.includes(j))), "every room reachable row " + (r + 1));
  }
  if (n2 === 1) OK(L.length - 1 >= 3, "a solo map is a normal map");
}
{ let s1 = 0, s8 = 0; for (let k = 0; k < 40; k++) { s1 += P.longLayout("cave", 2, 1, layoutFn).length - 1; s8 += P.longLayout("cave", 2, 8, layoutFn).length - 1; }
  OK(Math.abs(s8 / s1 - 4) < 0.6, "8 heroes: about 4× as many rows (" + (s8 / s1).toFixed(2) + ")"); }

// ---- a party run: waves of foes, and they come one after another
{
  const lead = mk("L", "Leader"); lead.location = "Bleak Falls Barrow"; [lead.x, lead.y] = WORLD.places["Bleak Falls Barrow"]; lead.level = 20;
  const r0 = COOP.newRun(lead, 5000); OK(!r0.err, "run: " + r0.err);
  const n8 = 8, mem = ids.map((id, i) => ({ id, name: names[i], level: 15 }));
  const run = { ...r0.doc, id: r0.id, members: [{ id: "L", name: "Leader", level: 20 }, ...mem.slice(1)], status: "in", factor: P.lengthFactor(n8), rows: P.longLayout(r0.doc.theme, r0.doc.tier, n8, layoutFn) };
  OK(!COOP.join(lead, run, 5000), "leader steps in");
  OK(lead.dungeon.rows.length === run.rows.length, "the long map is shared");
  // walk into the first fight room the map offers
  let picked = null;
  for (let col = 0; col < lead.dungeon.rows[0].length; col++) if (["fight", "elite"].includes(lead.dungeon.rows[0][col].type)) picked = col;
  if (picked == null) { lead.dungeon.rows[0][0].type = "fight"; picked = 0; }
  OK(!DUNGEONS.enterRoom(lead, picked), "enter a fight room");
  const rec = COOP.recordPick(run, lead.dungeon); COOP.picked(lead, rec);
  const room = lead.dungeon.room;
  OK(room.waves === 6, "8 heroes: 6 foes wait in a fight room (" + room.waves + ")");
  const solo = COOP.foe(lead, room.wkey, lead.dungeon.tier, 1), big = COOP.foe(lead, room.wkey, lead.dungeon.tier, 8, true), oldBig = COOP.foe(lead, room.wkey, lead.dungeon.tier, 8);
  OK(big.health > solo.health && big.health < oldBig.health, "with waves each foe gets a smaller health bonus (" + solo.health + " < " + big.health + " < " + oldBig.health + ")");
  // fight through the waves with a strong hero
  const realFoe = COOP.foe; COOP.foe = (...a) => { const e = realFoe(...a); e.health = e.hp = 5; e.damage = 1; return e; };   // weak foes: this checks the waves, not the balance
  room.enemy.health = room.enemy.hp = 5; room.enemy.damage = 1; G.setHealth(lead, G.maxHealth(lead));
  let falls = 0, stays = 0;
  for (let k = 0; k < 12 && lead.dungeon?.room; k++) { const res = DUNGEONS.act(lead, "fight"); if (res.died || !res.fight?.won) { console.log("stop", res.text, res.died, res.fight?.won); break; } if (res.stay && res.wave) stays++; falls++; G.setHealth(lead, G.maxHealth(lead)); }
  COOP.foe = realFoe;
  OK(stays === 5 && falls === 6 && !lead.dungeon.room, "six foes, one after another (" + falls + " fights, " + stays + " waves)");
  // solo dungeons are unchanged: no waves
  const solo1 = mk("S1", "Solo"); solo1.location = "Bleak Falls Barrow"; [solo1.x, solo1.y] = WORLD.places["Bleak Falls Barrow"];
  DUNGEONS.enter(solo1); DUNGEONS.enterRoom(solo1, 0); OK(!solo1.dungeon.room.waves, "solo rooms have no waves");
  // the co-op chest grows with the longer way
  const chest = { ...run, chest: { killers: ["L", "B"] } };
  const g8 = COOP.roll({ ...chest, factor: 4 }, "B", 15).gold, g1 = COOP.roll({ ...chest, factor: 1 }, "B", 15).gold;
  OK(g8 > g1 * 3.5, "chest gold grows with the length (" + g1 + " → " + g8 + ")");
  // all 8 claim their own chest roll once
  let ch = { ...run, members: mem, chest: { killers: ids } }, got = 0;
  for (const id of ids) { const o = COOP.claim(ch, id, 15); ch = o.run; if (o.got) got++; OK(!COOP.claim(ch, id, 15).got, id + " only once"); }
  OK(got === 8, "8 chest shares");
}

// ---- next wave helper
{
  const r = { type: "fight", enemy: { name: "Draugr" }, waves: 3 };
  const m1 = P.nextWave(null, r, () => ({ name: "Draugr", health: 50, hp: 50 }));
  OK(m1 && r.waves === 2 && r.wave === 2 && /Another draugr/.test(m1), "next wave: " + m1);
  P.nextWave(null, r, () => ({ name: "Draugr", health: 50, hp: 50 }));
  OK(r.waves === 1 && P.nextWave(null, r, () => ({ name: "x" })) === null, "no more after the last");
  OK(P.nextWave(null, { type: "boss", enemy: {}, waves: 3 }, () => ({})) === null, "bosses come alone");
}

// ---- travel company: up to 7 party members walk with you (and followers), drawn at most 10
{
  const pos2 = (o) => [o.x, o.y];
  const cards = heroes.slice(1).map((h2) => ({ id: h2.id, name: h2.name, x: A.x, y: A.y, look: { r: "nord", id: h2.id, eq: {}, gl: {} }, fol: "lydia" }));
  const comp = PARTY.companions(A, party8, cards, [A.x, A.y], pos2, MP.NEAR_PX);
  OK(comp.filter((x) => x.player).length === 7, "all 7 party members walk with you");
  OK(comp.length <= 15 && comp.length >= 10, "plus followers, 15 walkers at most (" + comp.length + ")");
  const fightMates = PARTY.nearMates(A, party8, cards, [A.x, A.y], pos2, MP.NEAR_PX);
  OK(fightMates.length === 7, "7 fight beside you");
}

// ---- loot votes: pooled loot, Want/Pass, seeded d100 rolls, even gold split
{
  const L = LOOTVOTE;
  // the pool: finds are added once (the same key twice counts once)
  let run = { id: "run-A-1", leader: "A", members: party3.members.map((m) => ({ ...m })), pool: null };
  run = L.addToPool(run, "A", [{ item: "iron_sword", qty: 1 }], 40, "A|1|1");
  run = L.addToPool(run, "B", [{ item: "steel_dagger", qty: 1 }, { item: "potion_health", qty: 2 }], 61, "B|1|1");
  run = L.addToPool(run, "B", [{ item: "steel_dagger", qty: 1 }], 61, "B|1|1");
  OK(run.pool.items.length === 3 && run.pool.gold === 101, "pool keeps each find once");
  OK(run.pool.items.find((x) => x.item === "steel_dagger").by === "B", "pool remembers who found it");
  // members can't pick rooms or act: the leader's acts are recorded for the others to follow
  run = L.recordAct(run, 2, "fight"); run = L.recordAct(run, 2, "fight");
  OK(run.acts[2].length === 2, "the leader's room actions are recorded per room");
  OK(!COOP.canPick(B, { ...run, path: [] }) && COOP.canPick({ id: "A", dungeon: { cstep: 0, room: null } }, { ...run, path: [] }), "only the leader picks rooms");
  // gather/pull: what you found leaves your pack for the pile
  const s = mk("Z", "Zed"); const before = L.snap(s); G.give(s, "steel_sword"); G.give(s, "potion_health", 3);
  const got = L.gained(s, before);
  OK(got.length === 2, "gained finds what you just picked up");
  L.pullOut(s, got);
  OK(JSON.stringify(L.snap(s)) === JSON.stringify(before), "pulled out of your pack again");
  // a vote with 3 members
  const t0 = 1000;
  const items = [{ item: "iron_sword", qty: 1, by: "A" }, { item: "steel_dagger", qty: 1, by: "B" }, { item: "potion_health", qty: 2, by: "B" }, { item: "elven_bow", qty: 1, by: "C" }];
  let v = L.newVote("dungeon", "vote-run-A-1", { leader: "A", leaderName: "Alfa", members: party3.members, items, gold: 101, place: "Bleak Falls Barrow" }, t0).doc;
  v.id = "vote-run-A-1";
  OK(!L.closed(v, t0 + 10), "open while voting");
  v = L.cast(v, "A", [1, 3], t0 + 5); v = L.cast(v, "B", [1], t0 + 6);
  OK(!L.closed(v, t0 + 10), "still open until everyone voted or time runs out");
  v = L.cast(v, "C", [3, 2], t0 + 7);
  OK(L.closed(v, t0 + 8), "closes when all voted");
  const late = L.cast(v, "C", [0], t0 + 9); OK(late === v, "no changing votes after it closed");
  const r = L.results(v);
  OK(r.per[0].winner === "A" && r.per[0].why === "nobody", "nobody wanted it: the leader keeps it");
  OK(r.per[2].winner === "C" && r.per[2].why === "only", "single want: theirs");
  OK(r.per[1].why === "roll" && ["A", "B"].includes(r.per[1].winner) && r.per[1].rolls.length >= 1, "contested: rolled");
  const top = r.per[1].rolls[r.per[1].rolls.length - 1]; OK(top.find((x) => x.uid === r.per[1].winner).roll === Math.max(...top.map((x) => x.roll)), "highest roll wins");
  OK(JSON.stringify(L.results(JSON.parse(JSON.stringify(v)))) === JSON.stringify(r), "every phone gets the same result");
  OK(r.gold.A === 35 && r.gold.B === 33 && r.gold.C === 33, "gold split evenly, the remainder to the leader");
  // ties roll again: find a seed where the first round ties
  let tieSeen = false;
  for (let k = 0; k < 4000 && !tieSeen; k++) {
    const vid = "tie" + k, a = L.d100(vid, 0, 0, "A"), b = L.d100(vid, 0, 0, "B");
    if (a === b) { const vv = { ...v, id: vid, items: [{ item: "iron_sword", qty: 1, idx: 0 }], votes: { A: { wants: [0], sent: true }, B: { wants: [0], sent: true }, C: { wants: [], sent: true } } }; const rr = L.results(vv); tieSeen = rr.per[0].rolls.length >= 2 && rr.per[0].rolls[1].length === 2; }
  }
  OK(tieSeen, "a tie re-rolls between the tied players");
  // claiming: once each, nothing twice
  let cl = L.claim(v, "B", t0 + 20); OK(cl.got && cl.v.done.B, "B takes their share");
  const again = L.claim(cl.v, "B", t0 + 21); OK(!again.got, "no second share");
  OK(!L.claim(v, "X", t0 + 20).got, "outsiders get nothing");
  OK(!L.claim(L.newVote("road", "v2", { leader: "A", leaderName: "Alfa", members: party3.members, items, gold: 0 }, t0).doc, "B", t0 + 1).got, "no claims while it's still open");
  const hb = mk("B", "Beta"), g0 = hb.gold;
  OK(L.give(hb, v.id, cl.got) && hb.gold === g0 + 33, "share delivered");
  OK(!L.give(hb, v.id, cl.got), "the save remembers: never twice");
  const all = party3.members.map((m) => L.mine(v, m.id)).flatMap((x) => x.items);
  OK(all.length === items.length, "every item goes to exactly one player");
  // default pass: time runs out
  let v3 = L.newVote("road", "v3", { leader: "A", leaderName: "Alfa", members: party3.members, items: items.slice(0, 2), gold: 9 }, t0).doc; v3.id = "v3";
  v3 = L.cast(v3, "B", [0], t0 + 1);
  OK(L.closed(v3, t0 + L.VOTE_SECONDS + 1), "closes after 90 s");
  OK(L.results(v3).per[0].winner === "B" && L.results(v3).per[1].winner === "A", "no answer counts as Pass");
  OK(!L.poolable("golden_claw"), "quest items aren't pooled");
}
console.log("partyplay ok · " + n + " checks");
`, c);
