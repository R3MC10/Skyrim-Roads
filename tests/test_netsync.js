// Network sync (netsync.js + store.js): 2-4 phones in a party change the same records at the same time, over a network
// that delays, reorders and drops messages, with clocks that disagree, one phone dropping off and coming back. In the end
// every phone (and the server's copy) must hold exactly the same records, and no change may be lost.
//   node test_netsync.js        (W=/path/to/game/ for another copy of the game)
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
let n = 0, fails = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const src = (f) => fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 =");

// ---------------------------------------------------------------- the module on its own
const NS = require(W + "netsync.js");
const rngT = NS.rng(12345);
const pick = (a) => a[Math.floor(rngT() * a.length)];

/* 1. merge rules: order-free, any number of times */
{
  const col = "runs", uids = ["A", "B", "C", "D"];
  // writers make stamped writes from their own (possibly stale) copies
  const base = { _v: 1000, _by: "A", leader: "A", path: [], members: uids.map((id) => ({ id, name: id })), at: {}, claims: {}, status: "lobby" };
  base._f = NS.stamp(col, null, base, 1000);
  const writes = [];
  for (let i = 0; i < 60; i++) {
    const by = pick(uids), from = writes.length && rngT() < 0.7 ? pick(writes) : base;
    const v = Math.max(1001 + i * 7, from._v + 1), nx = JSON.parse(JSON.stringify(from)); delete nx._f;
    const r = rngT();
    if (r < 0.3) nx.at = { ...nx.at, [by]: { step: i, hp: Math.round(rngT() * 100) } };
    else if (r < 0.45 && by === "A") nx.path = [...nx.path, [nx.path.length, 0]];
    else if (r < 0.55) nx.claims = { ...nx.claims, [by]: { gold: i } };
    else if (r < 0.65) { const at = { ...nx.at }; delete at[by]; nx.at = at; }
    else if (r < 0.75) nx.members = nx.members.map((m) => (m.id === by ? { ...m, left: !m.left } : m));
    else if (r < 0.85) nx.status = pick(["lobby", "in", "over"]);
    else nx.chest = { t: i, killers: [...new Set([...(nx.chest?.killers || []), by])] };
    nx._v = v; nx._by = by; nx._f = NS.stamp(col, from, nx, v);
    writes.push(nx);
  }
  const fold = (list) => list.reduce((acc, d) => (acc ? NS.mergeDoc(col, acc, d) : JSON.parse(JSON.stringify(d))), null);
  const ref = NS.canon(fold(writes));
  let orderFree = true, twice = true, grouped = true;
  for (let k = 0; k < 40; k++) {
    const sh = [...writes].sort(() => rngT() - 0.5);
    if (NS.canon(fold(sh)) !== ref) orderFree = false;
    if (NS.canon(fold([...sh, ...sh.slice(0, 20)])) !== ref) twice = false;
    const cut = 1 + Math.floor(rngT() * (sh.length - 2));
    if (NS.canon(NS.mergeDoc(col, fold(sh.slice(0, cut)), fold(sh.slice(cut)))) !== ref) grouped = false;
  }
  ok(orderFree, "merging in any order gives the same record");
  ok(twice, "hearing the same change twice changes nothing");
  ok(grouped, "merging copies that were already merged gives the same record");
}

/* 2. the lost-update bug: the leader adds a room while a member reports where they are from an older copy */
{
  const col = "runs";
  const r0 = { _v: 100, _by: "L", leader: "L", path: [[0, 0]], at: {} }; r0._f = NS.stamp(col, null, r0, 100);
  const lead = { ...r0, path: [[0, 0], [1, 1]], _v: 105, _by: "L" }; delete lead._f; lead._f = NS.stamp(col, r0, lead, 105);
  const mem = { ...r0, at: { M: { step: 1 } }, _v: 106, _by: "M" }; delete mem._f; mem._f = NS.stamp(col, r0, mem, 106);
  const m1 = NS.mergeDoc(col, lead, mem), m2 = NS.mergeDoc(col, mem, lead);
  ok(m1.path.length === 2 && m1.at.M?.step === 1, "both the new room and the member's report survive");
  ok(NS.same(m1, m2), "…whichever arrives first");
  // old-style records (no stamps): still the plain newest-wins rule
  const o1 = { _v: 5, _by: "a", x: 1, y: 2 }, o2 = { _v: 6, _by: "b", x: 3 };
  const om = NS.mergeDoc(col, o1, o2);
  ok(om.x === 3 && om.y === undefined, "old phones' records: newest copy wins as before");
  ok(NS.mergeDoc("chat", o1, o2) === null, "other collections keep newest-wins (no merge)");
  ok(NS.mergeDoc(col, o1, { _v: 9, _by: "b", _del: true }) === null, "a deletion is newest-wins");
  // an old phone that copied the stamps along without updating them is treated as old-style
  const stale = { ...lead, at: { M: { step: 9 } }, _v: 200, _by: "old" };
  ok(NS.mergeDoc(col, lead, stale).at.M.step === 9, "copied stamps from an old phone don't hide its change");
}

/* 3. ready checks and road votes: marks belong to one check / one stop */
{
  const col = "parties";
  const p0 = { _v: 10, _by: "L", leader: "L", members: [{ id: "L" }, { id: "B" }, { id: "C" }], ready: { id: "rc-1", who: ["L", "B", "C"], ok: { L: true }, no: {} } };
  p0._f = NS.stamp(col, null, p0, 10);
  const w = (from, v, by, fn) => { const nx = JSON.parse(JSON.stringify(from)); delete nx._f; fn(nx); nx._v = v; nx._by = by; nx._f = NS.stamp(col, from, nx, v); return nx; };
  const b = w(p0, 11, "B", (x) => { x.ready.ok.B = true; });
  const c = w(p0, 12, "C", (x) => { x.ready.ok.C = true; });
  const m = NS.mergeDoc(col, b, c);
  ok(m.ready.ok.B && m.ready.ok.C && m.ready.ok.L, "two members saying Ready at once: both count");
  const cleared = w(m, 20, "L", (x) => { delete x.ready; });
  const late = w(b, 21, "B", (x) => { x.ready.ok.B = true; x.ready.no = {}; });   // a late tap on the old check
  ok(!NS.mergeDoc(col, cleared, late).ready, "a late tap doesn't bring back a check the leader closed");
  const next = w(cleared, 30, "L", (x) => { x.ready = { id: "rc-2", who: ["L", "B", "C"], ok: { L: true }, no: {} }; });
  const mm = NS.mergeDoc(col, NS.mergeDoc(col, next, late), b);
  ok(mm.ready.id === "rc-2" && !mm.ready.ok.B, "marks from an old check never leak into a new one");
  const kicked = w(m, 40, "L", (x) => { x.members = x.members.filter((q) => q.id !== "C"); });
  const cTap = w(m, 41, "C", (x) => { x.ready.no = { C: true }; });
  ok(!NS.mergeDoc(col, kicked, cTap).members.some((q) => q.id === "C"), "someone sent home stays out even if they tapped at the same time");
}

/* 4. seeded rolls */
{
  const a = NS.seeded("run-1|room|3", () => [Math.random(), Math.random()]), b = NS.seeded("run-1|room|3", () => [Math.random(), Math.random()]);
  const real = Math.random;
  ok(a[0] === b[0] && a[1] === b[1], "the same seed rolls the same numbers on every phone");
  ok(NS.seeded("run-1|room|4", () => Math.random()) !== a[0], "another room rolls differently");
  ok(Math.random === real, "Math.random is put back afterwards");
  try { NS.seeded(1, () => { throw new Error("x"); }); } catch { /* expected */ }
  ok(Math.random === real, "…even when the action throws (a fight pausing it)");
  // dungeon rooms: the wrapper seeds rooms and actions of shared runs only
  const rooms = [];
  const DG = { enterRoom: (s, col) => { s.dungeon.room = { roll: Math.random(), col }; rooms.push(s.dungeon.room); return null; }, act: (s, c) => ({ text: `${c}:${Math.random()}` }) };
  NS.install(DG);
  const p1 = { dungeon: { run: "run-x", cstep: 2 } }, p2 = { dungeon: { run: "run-x", cstep: 2 } }, solo = { dungeon: { cstep: 2 } };
  DG.enterRoom(p1, 1); DG.enterRoom(p2, 1); DG.enterRoom(solo, 1);
  ok(p1.dungeon.room.roll === p2.dungeon.room.roll, "leader and member get the same room");
  ok(solo.dungeon.room.roll !== p1.dungeon.room.roll, "a solo dungeon still rolls freely");
  const a1 = DG.act(p1, "pick").text, a2 = DG.act(p1, "pick").text, b1 = DG.act(p2, "pick").text, b2 = DG.act(p2, "pick").text;
  ok(a1 === b1 && a2 === b2 && a1 !== a2, "the leader's actions replay with the same dice, one after another");
}

/* 5. the copy on the server is the very same file */
ok(fs.readFileSync(path.join(__dirname, "../game/netsync.js"), "utf8") === fs.readFileSync(path.join(__dirname, "../server/src/netsync.js"), "utf8"), "server/src/netsync.js is an exact copy of game/netsync.js");

/* 6. loot votes: the leader's seal decides */
{
  const c = { console, Math, JSON, Object, Array, Set, Map, Number, String, Date };
  vm.createContext(c);
  c.G = { now: () => 1000 };
  vm.runInContext(src("lootvote.js"), c);
  const LV = c.LOOTVOTE;
  let v = LV.openVote({ items: [{ item: "x", qty: 1 }], gold: 9 }, ["L", "B", "C"], "L", 1000);
  v = LV.castVote(v, "B", [0], 1010);
  ok(LV.final(v, 1095) === null, "time ran out on a phone: wait for the leader's seal");
  const s = LV.seal(v, "L", 1091);
  ok(s.sealed && LV.seal(v, "B", 1091) === v, "only the leader seals");
  const late = LV.castVote({ ...s, votes: { ...s.votes } }, "C", [0], 1092);
  ok(!late.votes.C, "no votes after the seal");
  const withLate = { ...s, votes: { ...s.votes, C: [0] } };   // a vote that slipped in anyway
  ok(JSON.stringify(LV.final(withLate, 1100).votes) === JSON.stringify(s.sealed.votes), "the sealed votes are what everyone shares out");
  ok(LV.final(v, 1000 + 90 + 46) !== null, "leader gone: the clock decides after a grace period");
  const all = LV.castVote(LV.castVote(v, "C", [], 1011), "L", [], 1012);
  ok(LV.final(all, 1013) === all, "everyone voted: no need to wait");
}

// ---------------------------------------------------------------- phones over a bad network
/* a network that delays (0-3 s), reorders and drops messages; phones can drop off and come back */
function makeNet(rnd) {
  const net = { phones: new Map(), q: [], joins: [], t: 0, drop: 0.2, maxDelay: 3000, sent: 0, lost: 0 };
  const live = (x) => net.phones.get(x)?.on;
  net.transport = (name) => ({
    name: "sim",
    join(code, h) {
      net.phones.set(name, { h, on: true });
      net.joins.push(name);   // they meet the others a moment later, like a real connection
      return { send: (data, peer) => net.send(name, data, peer), leave() {}, direct: () => 0 };
    },
  });
  net.send = (from, data, to) => {
    if (!live(from)) return;
    const wire = JSON.stringify(data);
    for (const t of to != null ? [to] : [...net.phones.keys()].filter((x) => x !== from && live(x))) {
      net.sent++;
      if (rnd() < net.drop) { net.lost++; continue; }
      net.q.push({ at: net.t + Math.floor(rnd() * net.maxDelay), from, to: t, wire });
    }
  };
  net.run = (ms) => {   // deliver everything due in the next ms, in arrival order (so later messages can overtake)
    const end = net.t + ms;
    for (const name of net.joins.splice(0)) { const h = net.phones.get(name).h; for (const [o, p] of net.phones) if (o !== name && p.on && !net.joins.includes(o)) { p.h.onJoin(name); h.onJoin(o); } }
    for (;;) {
      net.q.sort((a, b) => a.at - b.at);
      if (!net.q.length || net.q[0].at > end) break;
      const m = net.q.shift(); net.t = Math.max(net.t, m.at);
      if (live(m.to) && live(m.from)) net.phones.get(m.to).h.onMessage(JSON.parse(m.wire), m.from);
    }
    net.t = end;
  };
  net.off = (name) => { net.phones.get(name).on = false; for (const [o, p] of net.phones) if (o !== name) { if (p.on) p.h.onLeave(name); net.phones.get(name).h.onLeave(o); } };
  net.back = (name) => { const me = net.phones.get(name); me.on = true; for (const [o, p] of net.phones) if (o !== name && p.on) { p.h.onJoin(name); me.h.onJoin(o); } };
  return net;
}
/* one phone: its own store.js + netsync.js + the party modules, its own clock (skewed) and storage */
function makePhone(name, net, skew, clock) {
  const mem = { "sk.uid": JSON.stringify(name) };
  const c = { console, Math, JSON, Object, Array, Set, Map, Number, String, Promise, Error,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, addEventListener() {},
    location: { search: "" }, localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } } };
  c.Date = class extends Date { static now() { return clock.t + skew; } };
  c.window = c; c.P2PNET = net.transport(name);
  c.G = { now: () => c.Date.now() / 1000 };
  vm.createContext(c);
  for (const f of ["store.js", "netsync.js", "partyplay.js", "coop.js", "lootvote.js"]) vm.runInContext(src(f), c);
  return c;
}
const clean = (d) => { if (!d) return d; const o = { ...d }; delete o.id; return o; };

async function scenario(seed, nPhones) {
  const rnd = NS.rng(seed), net = makeNet(rnd), clock = { get t() { return 1.7e12 + net.t; } };
  const names = ["L", "B", "C", "D"].slice(0, nPhones);
  const ph = {};
  for (const [i, nm] of names.entries()) { ph[nm] = makePhone(nm, net, i ? Math.round((rnd() - 0.5) * 40e3) : 0, clock); await ph[nm].Store.init(); }
  const S = (nm) => ph[nm].Store, P = ph.L.PARTYPLAY;
  const seen = {};   // the latest list each phone's game would see, per collection
  for (const nm of names) for (const col of ["parties", "runs"]) S(nm).watch(col, (docs) => { (seen[nm] = seen[nm] || {})[col] = docs; });
  const getDoc = (nm, col, id) => (seen[nm]?.[col] || []).find((x) => x.id === id) || null;
  const calm = (fn) => { const d = net.drop; net.drop = 0; fn(); net.run(3500); net.drop = d; };   // a step everyone must hear before the next one
  const members = names.map((id) => ({ id, name: id }));
  const others = names.filter((x) => x !== "L");

  // the party and the run are set up while the network behaves
  calm(() => {
    S("L").put("parties", "p1", { leader: "L", leaderName: "L", members, t: 1 });
    S("L").put("runs", "r1", { place: "Embershard Mine", leader: "L", leaderName: "L", members: members.map((m) => ({ ...m, level: 5 })), status: "in", path: [], rooms: [], claims: {}, at: {}, t: 1 });
  });
  // then everything happens at once over a bad network: delayed, reordered, 20% dropped
  const T = () => clock.t / 1000;
  S("L").change("parties", "p1", (x) => P.startCheck(x, "L", { kind: "dungeon", place: "Embershard Mine" }, others, T()));
  net.run(400);
  for (const nm of others) S(nm).change("parties", "p1", (x) => P.setReady(x, nm, true, T()));
  net.run(500);
  let off = null;
  for (let step = 0; step < 8; step++) {
    S("L").change("runs", "r1", (x) => ({ ...x, path: [...x.path, [step, step % 2]], rooms: [...x.rooms, { type: "fight" }] }));
    for (const nm of names) S(nm).change("runs", "r1", (x) => ({ ...x, at: { ...(x.at || {}), [nm]: { step, hp: 100 - step } } }));
    if (step === 3 && nPhones > 2) { off = names[names.length - 1]; net.off(off); }    // a phone drops off…
    if (off && step === 4) S(off).change("runs", "r1", (x) => ({ ...x, claims: { ...(x.claims || {}), [off]: { gold: 99 } } }));   // …does something offline…
    if (off && step === 6) net.back(off);                                                // …and comes back
    net.run(Math.floor(rnd() * 900));
  }
  for (const nm of names) S(nm).change("runs", "r1", (x) => ph[nm].COOP.bossDown(x, nm));   // everyone lands the last blow at once
  net.run(300);
  calm(() => S("L").change("runs", "r1", (x) => ({ ...x, vote: ph.L.LOOTVOTE.openVote({ items: [{ item: "a", qty: 1 }, { item: "b", qty: 1 }], gold: 30 }, names, "L", T()) })));
  for (const nm of names) S(nm).change("runs", "r1", (x) => (x.vote ? { ...x, vote: ph[nm].LOOTVOTE.castVote(x.vote, nm, [names.indexOf(nm) % 2], T()) } : x));
  net.run(700);
  calm(() => S("L").change("parties", "p1", (x) => P.halt(P.clearCheck(x), "L", { kind: "encounter", name: "Wolves", opts: [["fight", "Fight"], ["flee", "Flee"]], who: others }, T())));
  for (const nm of others) S(nm).change("parties", "p1", (x) => P.vote(x, nm, nm === "B" ? "flee" : "fight", T()));
  net.run(200);
  S("B").change("parties", "p1", (x) => P.vote(x, "B", "flee", T()));   // B takes the vote back
  net.run(2500);

  // the desync check: a few rounds of fingerprints over a network that still drops one message in five
  const peek = (nm, col, id) => clean(getDoc(nm, col, id));
  const sameEverywhere = (col, id) => names.every((nm) => NS.canon(peek(nm, col, id)) === NS.canon(peek("L", col, id)));
  const before = sameEverywhere("runs", "r1") && sameEverywhere("parties", "p1");
  for (let k = 0; k < 8; k++) { for (const nm of names) S(nm).syncNow(); net.run(3500); }
  const run = peek("L", "runs", "r1"), party = peek("L", "parties", "p1");
  ok(sameEverywhere("runs", "r1"), `[${seed}/${nPhones}] every phone holds the same run`);
  ok(sameEverywhere("parties", "p1"), `[${seed}/${nPhones}] every phone holds the same party`);
  ok(run.path.length === 8 && run.rooms.length === 8, `[${seed}/${nPhones}] no room of the leader's way got lost (${run.path.length})`);
  ok(names.every((nm) => run.at?.[nm]), `[${seed}/${nPhones}] everyone's room report is there`);
  ok(!off || run.claims?.[off]?.gold === 99, `[${seed}/${nPhones}] what the phone did offline arrived after it came back`);
  ok(names.every((nm) => run.chest?.killers?.includes(nm)), `[${seed}/${nPhones}] every boss killer can open the chest`);
  ok(names.every((nm) => Array.isArray(run.vote?.votes?.[nm])), `[${seed}/${nPhones}] every loot vote counted`);
  ok(!party.ready, `[${seed}/${nPhones}] the closed ready check stays closed`);
  ok(!party.halt.votes.B && others.filter((x) => x !== "B").every((x) => party.halt.votes[x] === "fight"), `[${seed}/${nPhones}] road votes (and B taking theirs back) the same everywhere`);
  ok(party.members.length === nPhones, `[${seed}/${nPhones}] nobody dropped out of the party`);
  return { before, sent: net.sent, lost: net.lost };
}

/* 7. the server merges by the same rules (needs `npm ci` in server/ for ws) */
function hubCheck() {
  let createHub;
  try { ({ createHub } = require(path.join(__dirname, "../server/src/hub.js"))); } catch (e) { console.log("skip hub check (no server deps):", e.message.split("\n")[0]); return; }
  const hub = createHub({ store: {}, authToken: async () => ({}) });
  const col = "runs", r0 = { _v: 100, _by: "L", path: [], at: {} }; r0._f = NS.stamp(col, null, r0, 100);
  const a = { ...r0, path: [[0, 0]], _v: 101, _by: "L" }; delete a._f; a._f = NS.stamp(col, r0, a, 101);
  const b = { ...r0, at: { M: 1 }, _v: 102, _by: "M" }; delete b._f; b._f = NS.stamp(col, r0, b, 102);
  hub.merge(col, "r", r0); hub.merge(col, "r", a); hub.merge(col, "r", b);
  const h = hub.world.runs.r;
  ok(h.path.length === 1 && h.at.M === 1, "the server keeps both changes too");
  ok(NS.same(h, NS.mergeDoc(col, NS.mergeDoc(col, r0, b), a)), "…exactly like the phones");
  hub.stop?.();
}

(async () => {
  hubCheck();
  let lostBefore = 0, runs = 0;
  for (const nPhones of [2, 3, 4]) for (let seed = 1; seed <= 8; seed++) { const r = await scenario(seed * 97 + nPhones, nPhones); runs++; if (!r.before) lostBefore++; }
  console.log(`${runs} party sessions over a bad network; ${lostBefore} needed the desync check to line up`);
  console.log(fails ? `${fails} of ${n} checks FAILED` : `all ${n} netsync checks passed`);
  process.exit(fails ? 1 : 0);
})();
