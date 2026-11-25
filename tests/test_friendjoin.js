// friendjoin.js: what friends are doing (presence on the card), Ask to join -> leader's accept card -> normal party invite,
// full parties, dungeon runs, rate limit, timeout, and the "joinreq" collection on both lines (store.js + server hub.js).
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), path = require("path"), vm = require("vm");
let fails = 0;
const ok = (cond, m) => { if (!cond) { fails++; console.log("FAIL", m); } };
const src = fs.readFileSync(__GAME + "friendjoin.js", "utf8").replace(/^const FRIENDJOIN =/m, "var FRIENDJOIN =");
function game(clock) {   // one player's game: its own copy of the module and a clock we control
  const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String, RegExp, Promise, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {}, G: { now: () => clock.t, holdAt: () => "Whiterun Hold" } };
  vm.createContext(c); vm.runInContext(src, c);
  return c.FRIENDJOIN;
}
const clock = { t: 1_000_000 };
const F = game(clock);
const nowMs = () => clock.t * 1000;

// ---------------------------------------------------------------- presence payload
const solo = { id: "A", name: "Alfa", level: 7, dungeon: null, trip: null };
let b = F.cardBits(solo, null, {});
ok(b.fj && b.fj.a === "idle" && b.fj.pn === 0 && b.fj.pl === null, "alone and idle: " + JSON.stringify(b));
ok(F.activity({ dungeon: { place: "Bleak Falls Barrow" } }) === "dungeon", "in a dungeon");
ok(F.activity({}, { fighting: true }) === "fight", "fighting");
ok(F.activity({}, { trading: true }) === "trade", "trading");
ok(F.activity({ trip: { status: "travel" } }) === "travel", "travelling");
ok(F.activity({ dungeon: { place: "X" } }, { fighting: true }) === "dungeon", "a fight inside a dungeon still reads as the dungeon");
const party3 = { id: "p1", leader: "L", leaderName: "Lena", members: [{ id: "L", name: "Lena" }, { id: "B", name: "Beta" }, { id: "C", name: "Ceo" }], invites: [] };
b = F.cardBits({ id: "B", name: "Beta" }, party3, { fighting: true });
ok(b.fj.a === "fight" && b.fj.pn === 3 && b.fj.pl === "L" && b.fj.pln === "Lena", "party bits: " + JSON.stringify(b));
ok(JSON.stringify(b).length < 120, "the card stays small");
const card = (id, name, extra = {}) => ({ id, name, level: 12, x: 100, y: 100, loc: "Whiterun", moving: false, updated: nowMs(), ...extra });
let p = F.presence(card("B", "Beta", { fj: b.fj }), nowMs());
ok(p.online && p.line === "Level 12 · Whiterun · fighting", "row line: " + p.line);
ok(p.partyLine === "In Lena's party · 3/8", "party line: " + p.partyLine);
p = F.presence(card("L", "Lena", { fj: { a: "idle", pn: 3, pl: "L", pln: "Lena" } }), nowMs());
ok(p.partyLine === "Leads a party · 3/8" && p.line === "Level 12 · Whiterun · idle", "leader line: " + p.partyLine + " / " + p.line);
p = F.presence(card("D", "Dag", { moving: true, loc: null, fj: { a: "travel", pn: 0 } }), nowMs());
ok(p.line === "Level 12 · on the road" && p.partyLine === "On their own", "road: " + p.line + " / " + p.partyLine);
p = F.presence(card("E", "Eir", { dungeon: "Bleak Falls Barrow", fj: { a: "dungeon", pn: 2, pl: "E", pln: "Eir" } }), nowMs());
ok(p.act === "dungeon" && p.line === "Level 12 · Bleak Falls Barrow", "dungeon: " + p.line);
p = F.presence(card("O", "Old", { party: "p9" }), nowMs());   // a card from an older game (no fj)
ok(p.online && p.partyLine === "In a party" && p.line.startsWith("Level 12"), "old card still reads: " + p.partyLine);
ok(!F.presence(card("Z", "Zed", { updated: nowMs() - 10 * 60e3 }), nowMs()).online, "not seen for 10 minutes = offline");
ok(F.presence(card("F", "Full", { fj: { a: "idle", pn: 8, pl: "F", pln: "Full" } }), nowMs()).party.full, "8/8 is full");

// ---------------------------------------------------------------- who gets asked
ok(F.target(card("B", "Beta", { fj: b.fj })).id === "L", "a member's request goes to their leader");
ok(F.target(card("D", "Dag", { fj: { a: "idle", pn: 0 } })).id === "D", "someone alone gets it themselves");
ok(F.target(card("L", "Lena", { fj: { a: "idle", pn: 3, pl: "L" } })).id === "L", "a leader gets it themselves");

// ---------------------------------------------------------------- canAsk: full, dungeon, offline, own party, rate limit
const me = { id: "M", name: "Mira", level: 9 };
let c = F.canAsk(me, card("B", "Beta", { fj: b.fj }), null, [], [], clock.t, nowMs());
ok(c.ok && c.to.id === "L", "can ask: " + JSON.stringify(c));
c = F.canAsk(me, card("F", "Full", { fj: { a: "idle", pn: 8, pl: "F" } }), null, [], [], clock.t, nowMs());
ok(!c.ok && /full \(8\/8\)/.test(c.why), "full party: " + c.why);
c = F.canAsk(me, card("E", "Eir", { dungeon: "Bleak Falls Barrow", fj: { a: "dungeon", pn: 2, pl: "E" } }), null, [], [], clock.t, nowMs());
ok(!c.ok && /dungeon/.test(c.why), "dungeon run: " + c.why);
c = F.canAsk(me, card("Z", "Zed", { updated: 0 }), null, [], [], clock.t, nowMs());
ok(!c.ok && /offline/.test(c.why), "offline");
c = F.canAsk(me, card("B", "Beta", { fj: b.fj }), { members: [{ id: "M" }, { id: "B" }] }, [], [], clock.t, nowMs());
ok(!c.ok && c.hide, "already in my party: no button");
c = F.canAsk({ id: "L", name: "Lena" }, card("B", "Beta", { fj: b.fj }), null, [], [], clock.t, nowMs());
ok(!c.ok && c.hide, "my own party member: no button");
// rate limit: same person within the cooldown, and too many in five minutes
ok(F.rateWait([{ to: "L", t: clock.t - 5 }], "L", clock.t) === F.COOLDOWN - 5, "cooldown per person");
ok(F.rateWait([{ to: "L", t: clock.t - 5 }], "D", clock.t) === 0, "someone else is fine");
const busy = [1, 2, 3, 4].map((i) => ({ to: "x" + i, t: clock.t - 60 * i }));
ok(F.rateWait(busy, "D", clock.t) > 0, "4 in five minutes: wait");
ok(F.rateWait(busy, "D", clock.t + 300) === 0, "later it's fine again");
c = F.canAsk(me, card("D", "Dag", { fj: { a: "idle", pn: 0 } }), null, [], busy, clock.t, nowMs());
ok(!c.ok && /^Wait \d+ s/.test(c.why), "rate limited: " + c.why);

// ---------------------------------------------------------------- request records and the answer
const r = F.makeReq(me, card("B", "Beta", { fj: b.fj }), clock.t);
ok(r.id === "M>L" && r.doc.to === "L" && r.doc.via === "B" && r.doc.st === "open", "request record: " + JSON.stringify(r));
ok(F.incoming([{ ...r.doc, id: r.id }], "L", clock.t).length === 1, "leader sees it");
ok(F.incoming([{ ...r.doc, id: r.id }], "B", clock.t).length === 0, "the friend (not leader) doesn't");
c = F.canAsk(me, card("B", "Beta", { fj: b.fj }), null, [{ ...r.doc, id: r.id }], [], clock.t, nowMs());
ok(!c.ok && c.waiting, "one open request at a time: " + c.why);
let a = F.answer({ ...r.doc, id: r.id }, true, party3, clock.t + 5);
ok(a.st === "yes" && a.doc.st === "yes" && !("id" in a.doc), "yes");
a = F.answer({ ...r.doc, id: r.id }, false, party3, clock.t + 5);
ok(a.st === "no", "no");
const party8 = { ...party3, members: Array.from({ length: 8 }, (_, i) => ({ id: i ? "m" + i : "L", name: "M" + i })) };
a = F.answer({ ...r.doc, id: r.id }, true, party8, clock.t + 5);
ok(a.st === "full", "a full party answers full even on Accept");
const party7inv = { ...party3, members: party8.members.slice(0, 7), invites: ["q"] };
ok(F.answer({ ...r.doc, id: r.id }, true, party7inv, clock.t + 5).st === "full", "7 members + 1 invite out = full");
const cardsL = F.inviteCards([{ ...r.doc, id: r.id }], "L", party3, clock.t);
ok(cardsL.length === 1 && cardsL[0].kind === "join" && cardsL[0].text === "Mira asks to join your party" && /friend of Beta/.test(cardsL[0].sub), "invite card: " + JSON.stringify(cardsL[0]));
// timeout
ok(F.outcome({ ...r.doc }, clock.t + 10) === "waiting", "waiting");
ok(F.outcome({ ...r.doc }, clock.t + F.TIMEOUT + 1) === "timeout", "runs out after " + F.TIMEOUT + " s");
ok(F.incoming([{ ...r.doc, id: r.id }], "L", clock.t + F.TIMEOUT + 1).length === 0, "the leader's card drops off");
ok(F.answer({ ...r.doc, id: r.id }, true, party3, clock.t + F.TIMEOUT + 1).err, "too late to accept");
ok(F.canAsk(me, card("D", "Dag", { fj: { a: "idle", pn: 0 }, updated: nowMs() + (F.TIMEOUT + 1) * 1000 }), null, [{ ...r.doc, id: r.id }], [], clock.t + F.TIMEOUT + 1, nowMs() + (F.TIMEOUT + 1) * 1000).ok, "after it runs out you can ask someone else");

// ---------------------------------------------------------------- the whole flow, two games over a shared store
(async () => {
  const world = {}, watchers = [];
  const Store = { watch(col, cb) { watchers.push([col, cb]); cb(Object.entries(world[col] || {}).map(([id, d]) => ({ ...d, id }))); },
    async put(col, id, doc) { (world[col] = world[col] || {})[id] = doc; for (const [c2, cb] of watchers) if (c2 === col) cb(Object.entries(world[col]).map(([i, d]) => ({ ...d, id: i }))); return true; } };
  const FA = game(clock), FB = game(clock);   // A = Mira (asker), B = Lena (leader)
  const SA = { id: "M", name: "Mira", level: 9 }, SB = { id: "L", name: "Lena", level: 15 };
  const toastsA = [], toastsB = [], invitesA = [], joinedA = [];
  let partyB = { id: "p1", leader: "L", leaderName: "Lena", members: [{ id: "L", name: "Lena" }, { id: "B", name: "Beta" }], invites: [] };
  const cardBeta = () => card("B", "Beta", { fj: { a: "idle", pn: partyB.members.length, pl: "L", pln: "Lena" } });
  FA.mount({ S: () => SA, party: () => null, cardOf: (id) => (id === "B" ? cardBeta() : null), Store, toast: (t) => toastsA.push(t), invites: () => invitesA, acceptInvite: (pid) => joinedA.push(pid) });
  FB.mount({ S: () => SB, party: () => partyB, cardOf: () => null, Store, toast: (t) => toastsB.push(t),
    invite: async (c2) => { partyB = { ...partyB, invites: [...partyB.invites, c2.id] }; invitesA.push(partyB); } });
  await FA.ask("B");
  ok(world.joinreq && world.joinreq["M>L"] && world.joinreq["M>L"].st === "open", "request stored under joinreq");
  ok(/Lena, who leads Beta's party/.test(toastsA.at(-1)), "asker told who was asked: " + toastsA.at(-1));
  ok(FB.cards().length === 1 && FB.cards()[0].kind === "join", "leader gets a card");
  await FA.ask("B");
  ok(Object.keys(world.joinreq).length === 1 && /Waiting/.test(toastsA.at(-1)), "a second tap doesn't send again: " + toastsA.at(-1));
  await FB.reply("M>L", true);
  ok(partyB.invites.includes("M"), "Accept ran the normal party invite");
  ok(world.joinreq["M>L"].st === "yes", "answer stored");
  clock.t += 1; FA.check();
  ok(joinedA.length === 1 && joinedA[0] === "p1", "the asker took the invite by itself: " + joinedA);
  FA.check();
  ok(joinedA.length === 1, "and only once");
  ok(FB.cards().length === 0, "the leader's card is gone");
  // full party: Accept turns into "full", no invite goes out
  clock.t += 100;
  partyB = { ...partyB, members: Array.from({ length: 7 }, (_, i) => ({ id: i ? "m" + i : "L", name: "M" + i })), invites: [] };
  const SC = { id: "C2", name: "Cora" }, toastsC = [];
  const FC = game(clock);
  FC.mount({ S: () => SC, party: () => null, cardOf: () => card("L", "Lena", { fj: { a: "idle", pn: 7, pl: "L", pln: "Lena" } }), Store, toast: (t) => toastsC.push(t), invites: () => [], acceptInvite: () => {} });
  await FC.ask("L");
  partyB = { ...partyB, members: [...partyB.members, { id: "x", name: "X" }] };   // someone else filled the last spot meanwhile
  const before = partyB.invites.length;
  await FB.reply("C2>L", true);
  ok(world.joinreq["C2>L"].st === "full" && partyB.invites.length === before, "full on Accept: no invite");
  FC.check();
  ok(/party is full/.test(toastsC.at(-1)), "asker told it's full: " + toastsC.at(-1));
  // timeout: nobody answers
  clock.t += 100;
  const SD = { id: "D2", name: "Dora" }, toastsD = [];
  const FD = game(clock);
  FD.mount({ S: () => SD, party: () => null, cardOf: () => card("Q", "Quiet", { fj: { a: "idle", pn: 0 } }), Store, toast: (t) => toastsD.push(t), invites: () => [], acceptInvite: () => {} });
  await FD.ask("Q");
  clock.t += F.TIMEOUT + 2; FD.check();
  ok(toastsD.at(-1) === "No answer from Quiet.", "timeout toast: " + toastsD.at(-1));

  // ---------------------------------------------------------------- both lines know the collection; old games drop it
  const storeSrc = fs.readFileSync(__GAME + "store.js", "utf8");
  const cols = JSON.parse(storeSrc.match(/const COLS = (\[[^\]]*\])/)[1]);
  ok(cols.includes("joinreq"), "store.js COLS has joinreq");
  ok(/if \(!COLS\.includes\(col\)/.test(storeSrc), "store.js drops collections it doesn't know (how old games ignore joinreq)");
  ok(/col === "joinreq" && age > 36e5/.test(storeSrc), "old requests are tidied");
  const hubPath = path.join(__dirname, "../server/src/hub.js");
  if (fs.existsSync(hubPath)) ok(fs.readFileSync(hubPath, "utf8").match(/const COLS = (\[[^\]]*\])/)[1].includes('"joinreq"'), "server hub carries joinreq");
  // an old store.js (no joinreq in COLS) merges nothing from a joinreq put
  const oldCols = cols.filter((x) => x !== "joinreq");
  const merge = (col, doc) => oldCols.includes(col) && doc && typeof doc._v === "number";
  ok(!merge("joinreq", { _v: 1, from: "M", to: "L" }), "old game ignores the record");

  console.log(fails ? `${fails} FAILED` : "friendjoin OK");
  process.exit(fails ? 1 : 0);
})();
