// party play: the leader leads, ready checks, the leader decides on the road, shared spoils, dungeons that grow with the party (up to 8)
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
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

// ---- votes on the road: members vote, faces by the option, only the leader picks
{
  const opts = [["fight", "\uE101 Fight", "btn danger"], ["flee", "\uE142 Flee", "btn"], ["potion", "\uE15B Potion (0)", "btn", 1]];
  let v = P.halt(party3, "A", { kind: "encounter", name: "Bandit outlaw", text: "A bandit steps out.", title: "Bandit outlaw", opts, who: ["B", "C", "Z", "A"] }, 4000);
  OK(v.halt.opts.length === 3 && v.halt.opts[0].join() === "fight,\uE101 Fight,btn danger,0" && v.halt.opts[2][3] === 1, "the halt carries the leader's buttons");
  OK(v.halt.who.join() === "B,C" && v.halt.title === "Bandit outlaw" && v.halt.text === "A bandit steps out." && v.halt.round === 1, "who may vote: members with the leader, not outsiders or the leader");
  OK(JSON.stringify(v.halt.votes) === "{}" && JSON.stringify(P.tally(v.halt)) === "{}", "nobody has voted yet");
  v = P.vote(v, "B", "fight", 4001);
  OK(v.halt.votes.B === "fight" && P.tally(v.halt).fight.join() === "B", "B votes Fight");
  v = P.vote(v, "C", "fight", 4002);
  OK(P.tally(v.halt).fight.join() === "B,C", "C votes Fight too: two faces by Fight");
  v = P.vote(v, "C", "flee", 4003);
  OK(P.tally(v.halt).fight.join() === "B" && P.tally(v.halt).flee.join() === "C", "C changes their mind: the face moves to Flee");
  OK(P.vote(v, "C", "flee", 4004).halt.votes.C === undefined, "tapping your vote again takes it back");
  OK(P.vote(v, "A", "fight", 4004) === v, "the leader doesn't vote, the leader acts");
  OK(P.vote(v, "Z", "fight", 4004) === v, "outsiders can't vote");
  OK(P.vote(v, "B", "dance", 4004) === v, "only real options");
  OK(P.vote(v, "B", "potion", 4004) === v, "not a greyed-out option");
  OK(P.vote(P.resolve(v, "A", "won", 4005), "B", "flee", 4006).halt.votes.B === "fight", "no votes once it's over");
  OK(P.vote(v, "B", "flee", 4000 + 2000).halt.votes.B === "fight", "no votes on a stale stop");
  // the leader picks: votes close, the pick is remembered with how many backed it
  let pk = P.pick(v, "A", "fight", 4010);
  OK(pk.halt.picked.key === "fight" && pk.halt.picked.label === "\uE101 Fight" && pk.halt.picked.votes === 1, "the leader picks Fight (1 vote for it)");
  OK(P.pick(v, "B", "flee", 4010) === v, "a member's tap never picks");
  OK(P.vote(pk, "C", "fight", 4011) === pk && !P.canVote(pk, "C", 4011), "after the pick nobody votes");
  // a second step (a potion, or an event with another choice): a new round
  let r2 = P.setOptions(pk, "A", { opts }, 4020);
  OK(r2.halt.round === 2 && !r2.halt.picked && r2.halt.votes.B === "fight", "same choices again: new round, votes stay");
  let r3 = P.setOptions(r2, "A", { opts: [["take", "Take it", "btn pri"], ["leave", "Leave it", "btn"]], title: "A chest" }, 4030);
  OK(r3.halt.round === 3 && JSON.stringify(r3.halt.votes) === "{}" && r3.halt.title === "A chest" && r3.halt.text === "A bandit steps out.", "new choices: the vote starts over");
  OK(P.setOptions(r2, "B", { opts: [] }, 4030) === r2, "only the leader's screen counts");
  OK(JSON.stringify(P.tally({ ...r2.halt, votes: { B: "gone", C: "fight", Z: "fight" } })) === JSON.stringify({ fight: ["C"] }), "the tally ignores old options and outsiders");
  // a party of 8: seven faces by one option
  let v8 = P.halt(party8, "A", { kind: "event", opts: [["help", "Help"], ["leave", "Leave"]], who: ids }, 5000);
  for (const id of ids.slice(1)) v8 = P.vote(v8, id, "help", 5001);
  OK(P.tally(v8.halt).help.length === 7 && v8.halt.opts[0][2] === "btn", "a full party: seven faces by Help");
  OK(P.halt(party3, "A", { kind: "event", name: "x" }, 6000).halt.opts.length === 0, "an old-style halt has no options (members get the usual ones)");
}

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
OK(P.extraRows(1) === 0 && P.extraRows(2) === 2 && P.extraRows(3) === 4 && P.extraRows(4) === 6 && P.extraRows(5) === 7 && P.extraRows(8) === 10 && P.extraRows(20) === 10, "+2 rooms per extra hero for the first 3, then +1, at most +10");
OK(P.lengthFactor(1) === 1 && P.lengthFactor(8, 6) > 2.5 && P.lengthFactor(8, 6) < 2.8, "8 heroes: a bit under 3× as long");
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
// solo vs 2/4/8 heroes: exact room counts on the way to the boss, for every tier
for (const [th, tier] of [["cave", 1], ["barrow", 2], ["dwemer", 3]]) {
  const base = 4 + tier;   // dungeons.js: 4 + tier rows before the boss
  for (const [n2, more] of [[1, 0], [2, 2], [4, 6], [8, 10]]) for (let k = 0; k < 5; k++) {
    const L = P.longLayout(th, tier, n2, layoutFn);
    OK(L.length - 1 === base + more, th + " " + n2 + " heroes: " + (base + more) + " rooms before the boss, got " + (L.length - 1));
    if (n2 > 1) OK(L[L.length - 2].every((nd) => ["rest", "treasure", "mystery"].includes(nd.type)), "still a breather right before the boss");
  }
}
// the extra rooms are a real mix: fights, tough fights, traps and treasure all turn up
{ const seen = {}; for (let k = 0; k < 30; k++) { const L = P.longLayout("barrow", 2, 8, layoutFn); for (const row of L.slice(5, -2)) for (const nd of row) seen[nd.type] = (seen[nd.type] || 0) + 1; }
  for (const ty of ["fight", "elite", "trap", "treasure"]) OK(seen[ty] > 0, "extra rooms include " + ty);
  OK(seen.fight > seen.rest, "more fights than rest spots"); }
// sizing a run: once, by the leader, and everyone walks the same map
{
  const lead = mk("L2", "Lead"); lead.location = "Bleak Falls Barrow"; [lead.x, lead.y] = WORLD.places["Bleak Falls Barrow"]; lead.level = 20;
  const r0 = COOP.newRun(lead, 6000);
  OK(P.sizeRun(r0.doc, 1).rows === r0.doc.rows, "solo: the normal map, untouched");
  for (const n2 of [2, 4, 8]) {
    const doc = P.sizeRun(r0.doc, n2);
    OK(doc.sized && doc.size === n2 && doc.rows.length - 1 === r0.doc.rows.length - 1 + P.extraRows(n2), n2 + " heroes: the map grew by " + P.extraRows(n2));
    OK(P.sizeRun(doc, 8) === doc, "sized once: a second call changes nothing");
    const run = { ...doc, id: r0.id + "-" + n2, members: heroes.slice(0, n2).map((h) => ({ id: h.id, name: h.name, level: h.level })), status: "in" };
    const maps = heroes.slice(0, n2).map((h) => { h.dungeon = null; h.trip = null; h.cleared = {}; h.location = run.place; [h.x, h.y] = WORLD.places[run.place]; const err = COOP.join(h, run, 6000); OK(!err, "join: " + err); return JSON.stringify(h.dungeon.rows); });
    OK(maps.every((m) => m === JSON.stringify(run.rows)), n2 + " heroes: everyone gets the same layout");
    heroes.slice(0, n2).forEach((h) => { h.dungeon = null; });
  }
  const camp = { ...r0.doc, theme: "giantcamp", rows: [[{ type: "boss", links: [] }]] };
  OK(P.sizeRun(camp, 8) === camp, "a giant camp stays one fight");
}

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

// ---- loot votes: shared pile, leader-only actions, Want/Pass, seeded d100 rolls, even gold split
{
  const L = LOOTVOTE;
  let run = { id: "run-A-1", leader: "A", leaderName: "Alfa", members: party3.members.map((m) => ({ ...m })), path: [], rooms: [], pool: null, tier: 2, theme: "nordic" };
  OK(L.partyRun(run) && !L.partyRun({ ...run, members: [run.members[0]] }), "2+ heroes: a party run");
  run = L.poolAdd(run, [{ item: "iron_sword", qty: 1 }], 40);
  run = L.poolAdd(run, [{ item: "potion_health", qty: 2 }, { item: "iron_dagger", qty: 1 }], 61);
  run = L.poolAdd(run, [{ item: "potion_health", qty: 1 }], 0);
  OK(run.pool.items.length === 3 && run.pool.gold === 101 && run.pool.items.find((x) => x.item === "potion_health").qty === 3, "the pile adds stacks, keeps gear apart, sums gold");
  run = L.recordAct(run, 2, "fight"); run = L.recordAct(run, 2, "loot");
  OK(run.acts[2].join() === "fight,loot", "the leader's room actions are recorded per room for the others");
  OK(!COOP.canPick(B, { ...run, path: [] }) && COOP.canPick({ id: "A", dungeon: { cstep: 0, room: null } }, { ...run, path: [] }), "only the leader picks rooms");
  // strip: what an action gave you leaves your pack for the pile (quest items stay)
  const s = mk("Z", "Zed"); G.give(s, "potion_health", 1); const before = L.snap(s);
  G.give(s, "steel_sword"); G.give(s, "potion_health", 3); s.gold += 25;
  const got = L.strip(s, before);
  OK(got.items.length === 2 && got.gold === 25 && got.items.find((x) => x.item === "potion_health").qty === 3, "strip finds new rows, bigger stacks and gold");
  OK(s.inv.filter((r) => r.item === "steel_sword").length === 0 && s.inv.find((r) => r.item === "potion_health").qty === 1 && s.gold === before.gold, "and takes them back out");
  // the boss chest: each killer's roll joins the pile once
  run = { ...run, chest: { killers: ["A", "B"] } };
  const g0 = run.pool.gold; run = L.chestToPool(run); const g1 = run.pool.gold;
  OK(g1 > g0 && run.chestPooled, "the boss chest rolls go into the pile");
  OK(L.chestToPool(run).pool.gold === g1, "only once");
  // the vote
  run = L.startRunVote(run, 1000);
  let v = run.vote;
  OK(v.members.join() === "A,B,C" && v.items.length === run.pool.items.length && v.ends === 1000 + L.VOTE_SECONDS, "the vote opens for everyone still in the run");
  OK(L.startRunVote(run, 2000).vote === v, "opens once");
  OK(!L.closed(v, 1010), "open while voting");
  v = L.castVote(v, "A", [0, 1], 1005); v = L.castVote(v, "B", [1, 99], 1006);
  OK(v.votes.B.join() === "1", "bad picks are dropped");
  OK(!L.closed(v, 1010), "open until everyone voted or time is up");
  v = L.castVote(v, "C", [1, 2], 1007);
  OK(L.closed(v, 1011), "closes when all voted");
  OK(L.castVote(v, "C", [0], 1012) === v, "no changing votes after it closed");
  OK(L.castVote(L.startRunVote({ ...run, vote: null }, 1000).vote, "X", [0], 1001).votes.X === undefined, "outsiders can't vote");
  const r = L.resolve(v, "run-A-1");
  OK(r.items.A.some((x) => x.i === 0), "a single want: theirs");
  const roll1 = r.rolls.find((x) => x.i === 1);
  OK(roll1 && roll1.rounds[0].length === 3, "contested: everyone who wanted it rolls");
  const last = roll1.rounds[roll1.rounds.length - 1]; OK(last.find((x) => x.m === roll1.winner).roll === Math.max(...last.map((x) => x.roll)), "highest roll wins");
  OK(r.items[roll1.winner].some((x) => x.i === 1), "the winner gets it");
  OK(v.items.filter((it) => !(v.votes.A || []).concat(v.votes.B || [], v.votes.C || []).includes(it.i)).every((it) => r.items.A.some((x) => x.i === it.i)), "nobody wanted it: the leader");
  const total = Object.values(r.items).reduce((a, x) => a + x.length, 0);
  OK(total === v.items.length, "every item goes to exactly one hero (no duplicates)");
  OK(JSON.stringify(L.resolve(JSON.parse(JSON.stringify(v)), "run-A-1")) === JSON.stringify(r), "every phone gets the same result");
  const gold = v.gold, each = Math.floor(gold / 3);
  OK(r.gold.B === each && r.gold.C === each && r.gold.A === gold - 2 * each, "gold split evenly, the leftover to the leader");
  // ties roll again
  let tieSeen = false;
  for (let k = 0; k < 5000 && !tieSeen; k++) { const seed = "tie" + k; if (L.d100(seed, 0, "A", 0) === L.d100(seed, 0, "B", 0)) { const vv = { ...v, items: [{ item: "iron_sword", qty: 1, i: 0 }], votes: { A: [0], B: [0], C: [] }, gold: 0 }; const rr = L.resolve(vv, seed); tieSeen = rr.rolls[0].rounds.length >= 2; } }
  OK(tieSeen, "a tie rolls again");
  // delivery: once only
  const h = mk("B", "Beta"); const g0b = h.gold;
  const d1 = L.deliver(h, r, "B", "run:run-A-1"), d2 = L.deliver(h, r, "B", "run:run-A-1");
  OK(d1 && !d2 && h.gold === g0b + r.gold.B, "you take your part once");
  OK(r.items.B.every((it) => h.inv.some((row) => row.item === it.item)), "your items land in your pack");
  OK(L.markDone(L.markDone(v, "B"), "B").done.B === L.markDone(v, "B").done.B, "marked done once");
  // 8 heroes, one contested item
  const v8 = L.openVote({ items: [{ item: "elven_bow", qty: 1 }], gold: 803 }, ids, "A", 0);
  let v8b = v8; for (const id of ids) v8b = L.castVote(v8b, id, [0], 1);
  const r8 = L.resolve(v8b, "run-8");
  OK(Object.values(r8.items).reduce((a, x) => a + x.length, 0) === 1 && r8.rolls[0].rounds[0].length === 8, "8 heroes roll for one bow");
  OK(Object.values(r8.gold).reduce((a, x) => a + x, 0) === 803, "all the gold is handed out");
  OK(L.openVote({ items: [], gold: 0 }, [...ids, "N1", "N2"], "A", 0).members.length === 8, "never more than 8 heroes in a vote");
  // the boss chest pays a roll for every hero still in the run, even ones whose own boss fight came later
  const cr = L.chestToPool({ ...run, pool: null, chestPooled: false, chest: { killers: ["A"] } });
  const crA = L.chestToPool({ ...run, members: [run.members[0]], pool: null, chestPooled: false, chest: { killers: ["A"] } });
  OK(cr.pool.gold > crA.pool.gold, "three heroes: three chest rolls in the pile");
  // Lucky Draw (Lockpicking perk): +5/+10 on your rolls, written into the vote so every phone agrees
  const lucky = mk("L", "Lucky"); lucky.perks = { ...(lucky.perks || {}), lucky_draw: 2 };
  OK(L.rollBonus(lucky) === 10 && L.rollBonus(mk("U", "Unlucky")) === 0, "Lucky Draw gives +10 at rank 2");
  let vb = L.openVote({ items: [{ item: "elven_bow", qty: 1 }], gold: 0 }, ["A", "B"], "A", 0);
  vb = L.castVote(vb, "A", [0], 1, 10); vb = L.castVote(vb, "B", [0], 1, 99);
  OK(vb.bonus.A === 10 && vb.bonus.B === 10, "the bonus is capped at 10");
  let edge = false;
  for (let k = 0; k < 3000 && !edge; k++) { const seed = "luck" + k, ra = L.d100(seed, 0, "A", 0), rb = L.d100(seed, 0, "B", 0); if (rb > ra && rb - ra < 10) { const v2 = L.castVote(L.castVote(L.openVote({ items: [{ item: "elven_bow", qty: 1 }], gold: 0 }, ["A", "B"], "A", 0), "A", [0], 1, 10), "B", [0], 1, 0); const rr = L.resolve(v2, seed); edge = rr.items.A.length === 1 && rr.rolls[0].rounds[0].find((x) => x.m === "A").plus === 10; } }
  OK(edge, "a lower roll plus Lucky Draw can win");
  // road loot: the leader's finds become a vote for the travelling party (gold stays for partyplay's split)
  const rl = mk("A", "Alfa"); const rb0 = L.snap(rl); G.give(rl, "steel_sword"); rl.gold += 50;
  const rv = L.roadVote(rl, rb0, ["B", "C"], "a bandit camp", 500);
  OK(rv && rv.doc.members.join() === "A,B,C" && rv.doc.items.length === 1 && rl.gold === rb0.gold + 50 && !rl.inv.some((x) => x.item === "steel_sword"), "road finds go to a party vote, gold stays to be split");
  OK(L.roadVote(rl, L.snap(rl), [], "x") === null, "no party travelling: nothing to vote on");
  // the Bleak Falls boss in a party: the Dragonstone and the claw stay with each finder, not in the pile
  const q = mk("Q", "Quest"); const qb = L.snap(q); G.give(q, "dragonstone"); G.give(q, "golden_claw"); G.give(q, "potion_health");
  const qg = L.strip(q, qb);
  OK(qg.items.length === 1 && qg.items[0].item === "potion_health" && q.inv.some((x) => x.item === "dragonstone") && q.inv.some((x) => x.item === "golden_claw"), "quest items stay with the finder");
  const qv = { items: { Q: [{ item: "dragonstone", qty: 1 }] }, gold: {} };
  L.deliver(q, qv, "Q", "old-pile"); OK(q.inv.filter((x) => x.item === "dragonstone").length === 1, "an old pile doesn't hand out a second Dragonstone");
}
console.log("partyplay ok · " + n + " checks");
`, c);
