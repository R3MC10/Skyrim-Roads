// GREET: other players are Strangers until you greet each other in the same place. Two clients share one fake
// "greets" collection: A greets B, B accepts, both know each other's names, it survives a reload (the save) and a
// lost save (the shared record), and party members are always known.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs");
const GREET = require(__GAME + "greet.js");
const ok = (c, m) => { if (!c) throw new Error("FAIL " + m); console.log("ok", m); };

// index.html loads it, and the shared collection exists on both ends
const html = fs.readFileSync(__GAME + "index.html", "utf8");
ok(/<script src="greet\.js">/.test(html), "index.html loads greet.js");
ok(/["']greets["']/.test(fs.readFileSync(__GAME + "store.js", "utf8")), "store.js lists the greets collection");
const hub = require("path").join(__GAME, "../server/src/hub.js");
if (fs.existsSync(hub)) ok(/["']greets["']/.test(fs.readFileSync(hub, "utf8")), "server hub lists the greets collection");

// a tiny shared store, like the network one: put + every client reads the same docs
const shared = new Map();
const store = { put: (col, id, doc) => shared.set(id, { ...doc, id }), docs: () => [...shared.values()] };

const A = { id: "pA", name: "R3MC10", race: "nord", level: 7, location: "Whiterun", known: {} };
const B = { id: "pB", name: "Kacper", race: "khajiit", level: 5, location: "Whiterun", known: {} };
const cardOf = (S) => ({ id: S.id, name: S.name, race: S.race, level: S.level, loc: S.location, dungeon: S.dungeon || null });
const solo = { members: [] };

// strangers at first
ok(!GREET.knows(A, B.id, solo) && GREET.label(A, cardOf(B), solo) === "Stranger", "A sees B as a Stranger");
ok(!GREET.knows(B, A.id, solo) && GREET.label(B, cardOf(A), solo) === "Stranger", "B sees A as a Stranger");
ok(GREET.knows(A, A.id, solo), "you always know yourself");

// same place rules
ok(GREET.samePlace(A, null, cardOf(B), null), "same town counts as the same place");
ok(!GREET.samePlace({ ...A, location: "Riverwood" }, null, cardOf(B), null), "different towns don't");
ok(!GREET.samePlace({ ...A, location: null }, [0.5, 0.5], cardOf(B), [0.5, 0.5]), "one in town, one on the road: no");
const road = { ...A, location: null }, roadB = { ...cardOf(B), loc: null };
ok(GREET.samePlace(road, [0.5, 0.5], roadB, [0.51, 0.505]), "close together on the road counts");
ok(!GREET.samePlace(road, [0.5, 0.5], roadB, [0.6, 0.5]), "far apart on the road doesn't");
ok(!GREET.samePlace({ ...A, dungeon: { id: "x" } }, null, cardOf(B), null), "never inside a dungeon");
ok(!GREET.canGreet({ ...A, location: "Riverwood" }, cardOf(B), null, null, solo).ok, "can't greet from another town");

// A greets B
let c = GREET.canGreet(A, cardOf(B), null, null, solo, store.docs());
ok(c.ok, "A can greet B in Whiterun");
const rq = GREET.ask(A, cardOf(B)); store.put("greets", rq.id, rq.doc);
ok(rq.id === GREET.pairId("pB", "pA") && rq.doc.status === "ask", "one record per pair, same id from both sides");
c = GREET.canGreet(A, cardOf(B), null, null, solo, store.docs());
ok(!c.ok && /Waiting/.test(c.why), "A can't spam: waiting for an answer");

// B's client sees the incoming greeting; A's sees nothing to answer
let rB = GREET.sync(B, store.docs()), rA = GREET.sync(A, store.docs());
ok(rB.incoming.length === 1 && rB.incoming[0].from === "pA", "B gets an Accept prompt");
ok(rA.incoming.length === 0 && rA.learned.length === 0, "A has nothing to answer yet");
ok(GREET.label(B, cardOf(A), solo) === "Stranger", "still a Stranger before accepting");
// an old greeting lapses
ok(GREET.sync(B, store.docs(), rq.doc.t + GREET.TTL + 1).incoming.length === 0, "an unanswered greeting lapses after the TTL");

// B accepts
const ac = GREET.accept(B, rB.incoming[0]); store.put("greets", ac.id, ac.doc);
ok(GREET.knows(B, "pA", solo) && GREET.label(B, cardOf(A), solo) === "R3MC10", "B now sees A's name");
rA = GREET.sync(A, store.docs());
ok(rA.learned.length === 1 && rA.learned[0].name === "Kacper", "A's client learns B's name from the shared record");
ok(GREET.label(A, cardOf(B), solo) === "Kacper", "A now sees B's name");
ok(GREET.sync(A, store.docs()).learned.length === 0, "learning twice doesn't repeat the toast");
ok(!GREET.canGreet(A, cardOf(B), null, null, solo, store.docs()).ok, "no Greet button once you know each other");

// it persists: in the save (JSON round trip) and, if the save is lost, from the shared record
const A2 = JSON.parse(JSON.stringify(A));
ok(GREET.label(A2, cardOf(B), solo) === "Kacper", "known names live in the save");
const Afresh = { id: "pA", name: "R3MC10", known: {} };
GREET.sync(Afresh, store.docs());
ok(GREET.knows(Afresh, "pB", solo), "a fresh save learns it again from the shared greets");
ok(GREET.label(A2, { id: "pB", name: "", loc: "Whiterun" }, solo) === "Kacper", "falls back to the remembered name");

// a decline keeps them Strangers
const C = { id: "pC", name: "Lydia", location: "Whiterun", known: {} };
const rq2 = GREET.ask(C, cardOf(A)); store.put("greets", rq2.id, rq2.doc);
const inc = GREET.sync(A, store.docs()).incoming; ok(inc.length === 1 && inc[0].from === "pC", "A gets C's greeting");
const dn = GREET.decline(A, inc[0]); store.put("greets", dn.id, dn.doc);
ok(!GREET.knows(A, "pC", solo) && GREET.sync(A, store.docs()).incoming.length === 0 && !GREET.knows(C, "pA", solo), "Not now: still Strangers, prompt gone");

// party members are always known, with the party flag
const D = { id: "pD", name: "Aela", loc: "Whiterun" }, party = { members: [{ id: "pA" }, { id: "pD" }] };
ok(GREET.knows(A, "pD", party) && GREET.label(A, D, party) === "Aela ⚑", "party members are always known");
ok(GREET.label(A, D, solo) === "Stranger", "once they leave the party (and you never greeted) they're a Stranger again");
console.log("test_greet: all passed");
