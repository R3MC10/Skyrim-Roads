const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// party members never get separate invites: the leader's co-op run holds the whole party, invites are for outsiders only,
// stale invites / join requests for party members are dropped, friends in your party show "In your party"
const fs = require("fs"), vm = require("vm");
const W = __GAME;
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "social.js", "ammo.js", "tomes.js", "magic.js", "mp.js", "coop.js", "invites.js", "friendjoin.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const ok = (x, m) => { if (!x) throw new Error("FAIL " + m); console.log("ok", m); };
const mk = (id, name) => { const s = G.newSave(id, name, "nord"); s.location = "Bleak Falls Barrow"; s.level = 12; return s; };
const A = mk("A", "Alfa"), B = mk("B", "Beta"), C = mk("C", "Ceta"), X = mk("X", "Xan");
const party = { id: "p1", leader: "A", leaderName: "Alfa", members: [{ id: "A", name: "Alfa" }, { id: "B", name: "Beta" }, { id: "C", name: "Ceta" }], invites: [] };

// the leader's new run holds the whole party, no invites
const nr = COOP.newRun(A, G.now(), party);
let run = { ...nr.doc, id: nr.id };
ok(COOP.activeMembers(run).length === 3 && !run.invites.length, "the party is in the run at once, no invites");
ok(COOP.isMember(run, "B") && COOP.isMember(run, "C"), "B and C are members");
// a member can't start one; the leader does
const nb = COOP.newRun(B, G.now(), party);
ok(nb.err && /Alfa leads your party/.test(nb.err), "only the party leader starts runs: " + nb.err);
ok(!COOP.newRun(B, G.now(), null).err, "alone, anyone starts a run");
// invites are only for outsiders
ok(COOP.invite(run, "B", "Beta", party).err, "no invite for a party member");
const inv = COOP.invite(run, "X", "Xan", party); ok(inv.run && inv.run.invites.length === 1, "an outsider can be invited");
run = inv.run;
// the cap: party of 3 + outsiders, 8 in all
let big = run; for (let i = 0; i < 4; i++) big = COOP.invite(big, "o" + i, "O" + i, party).run;
ok(COOP.activeMembers(big).length + big.invites.length === 8, "fills to 8");
ok(COOP.invite(big, "o9", "O9", party).err, "no ninth hero");
// someone joins the party later: they're added, and their old run invite goes away
const party2 = { ...party, members: [...party.members, { id: "X", name: "Xan" }] };
const r2 = COOP.fromParty(run, party2);
ok(COOP.isMember(r2, "X") && !r2.invites.some((x) => x.id === "X"), "a new party member is in, their old invite dropped");
ok(COOP.fromParty(r2, party2) === r2, "nothing to change: same record");
// someone who walked out isn't pulled back in
const left = COOP.removeMember(r2, "C");
ok(COOP.fromParty(left, party2) === left, "a member who stepped out stays out (Rejoin is their choice)");
ok(COOP.isMember(COOP.addMember(left, C), "C") && COOP.activeMembers(COOP.addMember(left, C)).length === 4, "Rejoin puts them back");
// the run cap holds when the party is filled in
let full = { ...run, members: Array.from({ length: 8 }, (_, i) => ({ id: "m" + i, name: "M" + i })), invites: [] };
ok(COOP.activeMembers(COOP.fromParty(full, party)).length === 8, "never more than 8 in a run");

// friendjoin: friends in your party show "In your party", no Ask to join; stale requests vanish
const FJ = FRIENDJOIN, t = 1000, nowMs = t * 1000;
const card = (id, name, extra = {}) => ({ id, name, level: 5, updated: nowMs, ...extra });
const cb = FJ.canAsk(A, card("B", "Beta", { fj: { a: "idle", pn: 3, pl: "A", pln: "Alfa" } }), party, [], [], t, nowMs);
ok(!cb.ok && cb.hide && cb.mate, "a friend in my party: no Ask to join, marked as in my party");
const cx = FJ.canAsk(A, card("X", "Xan", { fj: { a: "idle", pn: 0 } }), party, [], [], t, nowMs);
ok(cx.ok && !cx.mate, "a friend outside: Ask to join on");
const reqs = [{ id: "X>A", from: "X", fromName: "Xan", to: "A", t: t - 5, st: "open" }, { id: "Y>A", from: "Y", fromName: "Yrsa", to: "A", t: t - 5, st: "open" }];
ok(FJ.inviteCards(reqs, "A", party, t).length === 2, "two open requests while neither is in the party");
ok(FJ.inviteCards(reqs, "A", party2, t).length === 1 && FJ.inviteCards(reqs, "A", party2, t)[0].from === "Yrsa", "a request from someone now in the party is gone");
ok(FJ.answer({ ...reqs[0] }, true, party2, t).err, "answering a stale request does nothing");
`, c);
console.log("test_partyinvites: all ok");
