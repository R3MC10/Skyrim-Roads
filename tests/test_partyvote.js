const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// party votes in dungeons (partyvote.js): several simulated phones share one run record; majority, tie → leader,
// timeout, changing a vote, disconnected players, Decide now, perk weight, and the same result applied once on every phone
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "social.js", "ammo.js", "tomes.js", "magic.js", "mp.js", "coop.js", "partyvote.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let pass = 0;
const ok = (x, m) => { if (!x) throw new Error("FAIL " + m); pass++; };
const PV = PARTYVOTE;
const mk = (id, name) => { const s = G.newSave(id, name, "nord"); s.location = "Bleak Falls Barrow"; s.level = 12; return s; };
const heroes = ["A", "B", "C", "D", "E"].map((id, i) => mk(id, ["Alfa", "Beta", "Ceta", "Delta", "Echo"][i]));
// a co-op run of five
const nr = COOP.newRun(heroes[0]); let run = { ...nr.doc, id: nr.id };
for (const s of heroes.slice(1)) run = COOP.addMember(run, s);
for (const s of heroes) ok(COOP.join(s, run) === null, "joined " + s.id);

/* a tiny shared store: one record, changes applied one at a time (like Store.change); every phone reads the same copy */
const store = { run, change(fn) { const before = this.run; this.run = fn(this.run) || this.run; return { before, after: this.run }; } };
/* a simulated phone: remembers the last result it applied, applies each new one once */
function phone(s) { return { s, seen: 0, applied: [], apply() { const r = PV.fresh(store.run, this.seen); if (!r) return null; this.seen = r.seq; this.applied.push(r.key); return r; } }; }
const phones = heroes.map(phone);
const T = 1000;
const opts = [["0", "Fight room"], ["1", "Treasure room"], ["2", "Trap room"], ["potion", "Drink a potion"]];

// solo runs never vote
const solo = { ...run, members: [run.members[0]] };
ok(!PV.partyRun(solo) && PV.open(solo, "A", { did: "x", opts }, T) === solo, "solo: no vote");
// only the leader opens, only with 2+ options; potions are never voted on
ok(PV.open(run, "B", { did: "x", opts }, T) === run, "only the leader opens a vote");
ok(PV.open(run, "A", { did: "x", opts: [["0", "Only way"], ["potion", "Drink"]] }, T) === run, "one option: no vote");
store.change((x) => PV.open(x, "A", { did: "s0|way", kind: "way", title: "Which way?", opts }, T));
let pv = store.run.pv;
ok(pv && pv.opts.length === 3 && !pv.opts.some((o) => o[0] === "potion"), "vote opened without the potion");
ok(pv.who.length === 5 && pv.ends === T + PV.VOTE_SECONDS, "everyone in the run votes, 20 s");
ok(PV.open(store.run, "A", { did: "s0|way", opts }, T + 1) === store.run, "the same choice isn't opened twice");

// votes; change of mind; invalid votes ignored
store.change((x) => PV.cast(x, "B", "1", T + 1));
store.change((x) => PV.cast(x, "C", "1", T + 2));
store.change((x) => PV.cast(x, "D", "0", T + 2));
store.change((x) => PV.cast(x, "Z", "0", T + 2));         // not in the run
store.change((x) => PV.cast(x, "E", "potion", T + 2));    // not an option
ok(PV.voted(store.run.pv) === 3, "three valid votes");
store.change((x) => PV.cast(x, "C", "2", T + 3));         // C changes their mind
ok(store.run.pv.votes.C === "2" && JSON.stringify(PV.tally(store.run.pv)) === JSON.stringify({ "1": ["B"], "2": ["C"], "0": ["D"] }), "vote changed: " + JSON.stringify(PV.tally(store.run.pv)));
store.change((x) => PV.cast(x, "C", "1", T + 4));
// not due yet: A and E online and not voted, timer running
const online = ["A", "B", "C", "D", "E"];
ok(!PV.due(store.run.pv, online, T + 5), "not due while people are still voting");
ok(PV.settle(store.run, "A", online, T + 5) === store.run, "leader doesn't settle early");
ok(PV.settle(store.run, "B", online, T + 50) === store.run, "only the leader settles");
// E is offline: once A votes, everyone online has voted → closes at once
store.change((x) => PV.cast(x, "A", "1", T + 6));
ok(PV.due(store.run.pv, ["A", "B", "C", "D"], T + 6), "an offline player doesn't block");
ok(!PV.due(store.run.pv, online, T + 6), "but with E online it still waits");
store.change((x) => PV.settle(x, "A", ["A", "B", "C", "D"], T + 6));
let res = store.run.pv.res;
ok(res && res.key === "1" && res.seq === 1 && store.run.pvSeq === 1 && res.votes === 3 && res.of === 4, "majority wins: " + JSON.stringify(res));
store.change((x) => PV.cast(x, "E", "0", T + 7));
ok(store.run.pv.votes.E === undefined, "no voting after it closed");
ok(PV.settle(store.run, "A", online, T + 8, true) === store.run, "a settled vote stays settled");
// every phone applies it once, the same pick
for (const p of phones) { ok(p.apply()?.key === "1", "phone " + p.s.id + " applies"); ok(p.apply() === null, "phone " + p.s.id + " applies once"); }
ok(phones.every((p) => p.applied.join() === "1"), "identical result on all phones");

// tie → the leader's vote decides
store.change((x) => PV.open(x, "A", { did: "s1|act|0", kind: "act", opts: [["fight", "Fight"], ["sneak", "Sneak past"], ["flee", "Run"]] }, T + 10));
ok(store.run.pv.id === "pv2" && !store.run.pv.res, "next vote opens fresh");
for (const [u, k] of [["A", "sneak"], ["B", "fight"], ["C", "fight"], ["D", "sneak"], ["E", "flee"]]) store.change((x) => PV.cast(x, u, k, T + 11));
store.change((x) => PV.settle(x, "A", online, T + 11));
ok(store.run.pv.res?.key === "sneak" && store.run.pv.res.seq === 2, "2-2 tie goes the leader's way: " + store.run.pv.res?.key);
// tie where the leader voted for neither tied option → first of them in the list (the same on every phone)
const tv = PV.open({ ...run, pv: null }, "A", { did: "t", opts: [["x", "X"], ["y", "Y"], ["z", "Z"]] }, T);
let t2 = ["B:y", "C:x", "D:y", "E:x", "A:z"].reduce((r, v) => PV.cast(r, v.split(":")[0], v.split(":")[1], T), tv);
ok(PV.winner(t2.pv) === "x", "tie without the leader: first listed");

// timeout: people who didn't vote don't count
store.change((x) => PV.open(x, "A", { did: "s2|way", kind: "way", opts }, T + 20));
store.change((x) => PV.cast(x, "D", "2", T + 21));
ok(!PV.due(store.run.pv, online, T + 25), "still open before the timer");
ok(PV.left(store.run.pv, T + 25) === PV.VOTE_SECONDS - 5, "time left");
ok(PV.due(store.run.pv, online, T + 20 + PV.VOTE_SECONDS), "timer closes it");
store.change((x) => PV.settle(x, "A", online, T + 20 + PV.VOTE_SECONDS));
ok(store.run.pv.res?.key === "2" && store.run.pv.res.of === 1, "one vote at the timeout wins");
// no votes at the timeout: it waits for the first vote
store.change((x) => PV.open(x, "A", { did: "s3|way", kind: "way", opts }, T + 50));
ok(!PV.due(store.run.pv, online, T + 200) && PV.settle(store.run, "A", online, T + 200, true) === store.run, "nobody voted: nothing to settle, not even Decide now");
store.change((x) => PV.cast(x, "E", "0", T + 201));
ok(PV.due(store.run.pv, online, T + 201), "after the timer the first vote decides");
// Decide now
store.change((x) => PV.open(x, "A", { did: "s4|way", kind: "way", opts }, T + 300));
store.change((x) => PV.cast(x, "B", "2", T + 301));
ok(PV.settle(store.run, "A", online, T + 301) === store.run, "not due");
store.change((x) => PV.settle(x, "A", online, T + 301, true));
ok(store.run.pv.res?.key === "2" && store.run.pv.res.forced, "Decide now settles at once");

// disconnect: someone walks out of the run and the lead moves on; votes still work for whoever is left
const seq0 = store.run.pvSeq;
store.change((x) => COOP.removeMember(x, "A"));
ok(store.run.leader === "B", "lead passes on");
store.change((x) => PV.open(x, "B", { did: "s5|way", kind: "way", opts }, T + 400));
ok(store.run.pv.who.length === 4 && !store.run.pv.who.includes("A"), "the one who left doesn't vote");
store.change((x) => PV.cast(x, "C", "0", T + 401)); store.change((x) => PV.cast(x, "D", "0", T + 401)); store.change((x) => PV.cast(x, "B", "1", T + 401));
ok(PV.due(store.run.pv, ["B", "C", "D"], T + 402), "E offline: closes when the rest voted");
store.change((x) => PV.settle(x, "B", ["B", "C", "D"], T + 402));
ok(store.run.pv.res.key === "0" && store.run.pv.res.seq === seq0 + 1, "sequence numbers keep counting up");

// the perk: Voice of Reason counts twice (weight written with the vote)
const C = heroes[2]; C.skills.Speechcraft = 60; C.perks = { ...(C.perks || {}), persuasion: 1, voice_of_reason: 1 };
ok(PV.weightOf(C) === 2 && PV.weightOf(heroes[3]) === 1, "Voice of Reason weight " + PV.weightOf(C));
store.change((x) => PV.open(x, "B", { did: "s6|way", kind: "way", opts }, T + 500));
store.change((x) => PV.cast(x, "C", "2", T + 501, PV.weightOf(C)));
store.change((x) => PV.cast(x, "D", "0", T + 501)); store.change((x) => PV.cast(x, "E", "0", T + 501)); store.change((x) => PV.cast(x, "B", "1", T + 501));
ok(PV.score(store.run.pv)["2"] === 2 && PV.score(store.run.pv)["0"] === 2, "weighted score");
store.change((x) => PV.settle(x, "B", ["B", "C", "D", "E"], T + 502));
ok(store.run.pv.res.key === "0", "2-2 weighted tie: leader voted 1, so the first tied option in the list (0) wins");

// every phone saw every result exactly once, in order, and agrees
for (const p of phones) { let r; while ((r = p.apply())) {} }
const seqs = phones.map((p) => p.applied.join());
ok(new Set(seqs).size === 1, "all phones agree: " + seqs[0]);

// a real fork in the dungeon: the leader's options come from the map, the winner is a column everyone can enter
const L = heroes[1], nx = DUNGEONS.nextChoices(L);
ok(nx.length >= 1, "a fork");
console.log("test_partyvote: " + pass + " checks passed");
`, c);
