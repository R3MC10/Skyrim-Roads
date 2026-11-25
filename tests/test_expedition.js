const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* The Expedition Table (expedition.js): three offers a day seeded by company + day (the same on every phone), steps that
   notice fights / dungeons / heists / legendary hunts / crises, party votes (majority, a tie goes the leader's way),
   no double-counting in a party, the road event and Seasoned Scout, rewards, the weekly goal and chest, the company
   log, rerolls (Expedition Leader), the perks, balance sims, and Polish for every line.
   W=/path/to/game/ node test_expedition.js — prints "expedition ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, Promise, setInterval: () => 0, clearInterval: () => {} };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "halls.js", "engine.js", "events.js", "dungeons.js", "towns.js", "horses.js", "bonds.js", "runecraft.js", "leghunt.js", "heists.js", "deepdelve.js", "netsync.js", "partyvote.js", "i18n_longhouse.js", "i18n_expedition.js", "longhouse.js", "expedition.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
c.SRC = fs.readFileSync(W + "expedition.js", "utf8");
c.PN = fs.existsSync(W + "patchnotes.js") ? fs.readFileSync(W + "patchnotes.js", "utf8") : "";
vm.runInContext(`
(async () => {
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };
const X = EXPEDITION, L = LONGHOUSE, DAY = 86400;
let NOW = 1795000000; G.now = () => NOW;
const mem = {};
const emit = () => L.setDocs(Object.values(mem).map((d) => JSON.parse(JSON.stringify(d))));
var Store = { online: true,
  put: async (col, id, doc) => { mem[id] = { ...JSON.parse(JSON.stringify(doc)), id }; emit(); return true; },
  change: async (col, id, fn) => { const cur = mem[id]; if (!cur) return null; const nx = fn(JSON.parse(JSON.stringify(cur))); if (nx) mem[id] = { ...nx, id }; else delete mem[id]; emit(); return { after: nx }; },
  remove: async (col, id) => { delete mem[id]; emit(); }, watch: () => {} };
globalThis.Store = Store;
let who = null;
L._api({ S: () => who, toast: () => {}, persist: () => {}, render: () => {}, party: () => null });
const mk = (id, lvl) => { const s = G.newSave(id, "P" + id, "nord"); s.level = lvl; s.location = "Whiterun"; s.gold = 0; return s; };
const as = (s) => { who = s; return s; };

// ---- 1. three offers a day, the same for every member
const day = X.dayOf();
const o1 = X.offers("lh-a", day), o2 = X.offers("lh-a", day);
ok(JSON.stringify(o1) === JSON.stringify(o2), "same company, same day: the same offers");
ok(o1.length === 3 && o1.map((o) => o.slot).join() === "short,medium,long", "a short, a medium and a long one");
ok(new Set(o1.map((o) => o.tpl)).size === 3 && new Set(o1.map((o) => o.hold)).size === 3, "three different expeditions in three holds");
ok(JSON.stringify(X.offers("lh-a", day + 1)) !== JSON.stringify(o1), "a new day, new offers");
ok(JSON.stringify(X.offers("lh-a", day, 1)) !== JSON.stringify(o1), "a reroll changes them");
let diff = 0; for (let k = 0; k < 20; k++) if (X.offers("lh-a", day + k)[0].key !== X.offers("lh-b", day + k)[0].key) diff++;
ok(diff === 20, "every company gets its own");
// all templates and holds turn up over a month, every step reads well
const seenT = new Set(), seenH = new Set(); let badStep = 0, badKey = 0;
for (let k = 0; k < 60; k++) for (const o of X.offers("lh-" + (k % 7), day + k)) {
  seenT.add(o.tpl); seenH.add(o.hold);
  ok(o.steps[0].k === "road" && o.steps.length >= 2 && o.steps.length <= 3, "road first, then 1-2 steps (" + o.tpl + ")");
  for (const st of o.steps) { const t = X.stepText(st); if (!t || /\\{|undefined|NaN/.test(t)) badStep++; }
  if (!/^\\d+-[0-9a-z]+-(short|medium|long)$/.test(o.key)) badKey++;
  if (!WORLD.places[o.place]) badStep++;
  if (o.tpl === "beast") ok(LEGHUNT.L.some((b) => b.id === o.beast && b.hold === o.hold), "the beast lives in its hold");
  if (o.steps.some((s) => s.k === "heist")) ok(HEISTS.BY_ID[o.steps.find((s) => s.k === "heist").house], "a real heist house");
}
ok(seenT.size === X.TPL_IDS.length, "every kind of expedition comes up (" + [...seenT] + ")");
ok(seenH.size >= 8, "most holds come up (" + seenH.size + ")");
ok(!badStep && !badKey, "steps read well and point at real places");

// ---- 2. a solo expedition, step by step
const A = as(mk("a", 12)); A.perks = {};
await L.found(Object.assign(A, { gold: 5000 }), "Ironbound");
let d = L.mine(A);
const tryO = () => X.offers(d.id, X.dayOf()).find((o) => o.tpl === "wolves" || o.tpl === "courier") || null;
let o = null; for (let k = 0; k < 30 && !o; k++) { NOW += DAY; o = tryO(); }
ok(!!o, "a fight expedition turns up");
X.adopt(A, o);
ok(X.live(A) && X.cur(A.exp) === 0, "you set out; the road is first");
// the road event
ok(X.note(A, "fight", { e: { name: "Bandit", tags: ["humanoid"] }, hold: o.hold }).length === 0, "fights don't count before the road event");
const ev = X.eventOf(A, A.exp);
ok(ev.opts.length === 3 && Object.keys(ev.outs).length === 3 && ev.opts.every(([k]) => ev.ch[k] >= 15 && ev.ch[k] <= 92), "three choices with fair chances");
ok(JSON.stringify(X.eventOf(A, A.exp).outs) === JSON.stringify(ev.outs), "how it turns out is fixed by the expedition (Scout shows the truth)");
const g0 = A.gold, gk = Object.keys(ev.outs).find((k) => ev.outs[k] === "good") || Object.keys(ev.outs)[0];
const r0 = X.resolveEvent(A, A.exp, gk, ev.outs);
ok(A.exp.done[0] === 1 && X.cur(A.exp) === 1 && r0.lines.length, "the road is done");
if (ev.outs[gk] === "good") ok(A.gold > g0, "a good choice finds gold");
const bk = Object.keys(ev.outs).find((k) => ev.outs[k] === "bad");
if (bk) { const B0 = mk("b0", 12); X.adopt(B0, o); const hp = G.curHealth(B0); X.resolveEvent(B0, B0.exp, bk, ev.outs); ok(G.curHealth(B0) < hp && G.curHealth(B0) >= 1 && B0.exp.done[0], "a bad choice costs some health, never the expedition"); }
// fights in the right hold, of the right kind
const st1 = A.exp.o.steps[1], foe = st1.tag === "beast" ? { name: "Wolf", tags: ["beast"] } : { name: "Bandit Thug", tags: ["humanoid"] }, wrong = st1.tag === "beast" ? { name: "Bandit Thug", tags: ["humanoid"] } : { name: "Wolf", tags: ["beast"] };
const other = X.HOLDS.find((h) => h !== o.hold);
if (st1.k === "fights") {
  ok(X.note(A, "fight", { e: foe, hold: other }).length === 0, "a fight in another hold doesn't count");
  ok(X.note(A, "fight", { e: wrong, hold: o.hold }).length === 0, "the wrong kind of foe doesn't count");
  const u = X.note(A, "fight", { e: foe, hold: o.hold });
  ok(u.length === 1 && u[0].cnt === 1 && !u[0].done, "one fight counted");
  ok(X.note(A, "fight", { e: foe, hold: o.hold })[0].done === 1, "two fights: the step is done");
} else if (st1.k === "dungeon") {
  ok(X.note(A, "dungeon", { hold: other }).length === 0, "a dungeon elsewhere doesn't count");
  ok(X.note(A, "dungeon", { hold: o.hold })[0].done === 1, "a cleared dungeon in the hold counts");
}
while (X.cur(A.exp) >= 0) { const st = A.exp.o.steps[X.cur(A.exp)]; if (st.k === "dungeon") X.note(A, "dungeon", { hold: o.hold }); else X.note(A, "fight", { e: st.tag === "beast" ? { name: "Wolf", tags: ["beast"] } : { name: "Bandit", tags: ["humanoid"] }, hold: o.hold }); }
const gA = A.gold, cl = X.claim(A);
ok(cl && A.gold === gA + cl.gold && cl.gold > 0 && cl.items.length, "finished: your own gold and loot");
ok(!X.claim(A), "you can't claim twice");
ok(A.expHist[0].key === o.key && A.expDone === o.key, "it goes in your history");
await Store.change("longhouse", d.id, (q) => X.ledgerEntry(q, o, A, [A.name]));
await Store.change("longhouse", d.id, (q) => X.ledgerEntry(q, o, A, [A.name, "Pb"]));
d = L.mine(A);
ok(X.weekRenown(d) === X.RENOWN[o.slot], "renown counted once per expedition, even when two phones write it");
ok(/Pa, Pb/.test(X.histOf(d)[0].who) && /came back from/.test(L.logLine ? L.logLine(d.tx["ex-" + o.key]) : X.logLine(d.tx["ex-" + o.key])), "the company log names everyone who went");
// giving up costs nothing; expeditions run out after two days
const B = mk("b", 5); X.adopt(B, X.offers(d.id, X.dayOf())[0]); const gb = B.gold; X.drop(B);
ok(!B.exp && B.gold === gb, "giving up costs nothing");
X.adopt(B, X.offers(d.id, X.dayOf())[0]); NOW += 3 * DAY; ok(!X.live(B), "an old expedition quietly ends"); NOW -= 3 * DAY;

// ---- 3. polled steps: heist, legendary hunt, crises, bosses
const fake = (steps) => ({ key: X.dayOf() + "-t-long", tpl: "outlaw", slot: "long", hold: "Whiterun", place: "Whiterun", beast: null, steps, lvl: 3 });
const H = mk("h", 14); H.heist = { stats: { runs: 2 }, last: { house: "erikur" } };
X.adopt(H, fake([{ k: "road", place: "Whiterun", hold: "Whiterun" }, { k: "heist", hold: "Whiterun", city: "Whiterun", house: "battleborn" }])); H.exp.done[0] = 1;
ok(!X.poll(H).length, "old heists don't count");
H.heist = { stats: { runs: 3 }, last: { house: "erikur" } }; ok(!X.poll(H).length, "a heist on another house doesn't count");
H.exp.base.heist = 3; H.heist = { stats: { runs: 4 }, last: { house: "battleborn" } }; ok(X.poll(H)[0]?.done === 1, "the right heist counts");
const bst = LEGHUNT.L[0];
const Q = mk("q", 14); Q.lhunt = { best: { [bst.id]: { kills: 1 } } };
X.adopt(Q, { ...fake([{ k: "road", place: bst.town, hold: bst.hold }, { k: "clue", hold: bst.hold, beast: bst.id, place: bst.town }, { k: "slay", hold: bst.hold, beast: bst.id, place: bst.town }]), tpl: "beast", beast: bst.id, hold: bst.hold }); Q.exp.done[0] = 1;
ok(!X.poll(Q).length, "an old kill doesn't count");
Q.lhunt.cur = { id: bst.id, clues: 1 }; ok(X.poll(Q)[0]?.i === 1 && X.cur(Q.exp) === 2, "a clue on the beast's trail counts");
ok(X.note(Q, "fight", { e: { name: "Wolf", legend: "nope" }, hold: bst.hold }).length === 0, "another legend isn't it");
ok(X.note(Q, "fight", { e: { name: bst.name, legend: bst.id }, hold: bst.hold })[0]?.done === 1 && X.cur(Q.exp) === -1, "slaying the beast finishes it");
const Q2 = mk("q2", 14); Q2.lhunt = { best: {} };
X.adopt(Q2, { ...fake([{ k: "road", place: bst.town, hold: bst.hold }, { k: "clue", hold: bst.hold, beast: bst.id, place: bst.town }, { k: "slay", hold: bst.hold, beast: bst.id, place: bst.town }]), beast: bst.id }); Q2.exp.done[0] = 1;
Q2.lhunt.best[bst.id] = { kills: 1 }; X.poll(Q2); ok(X.cur(Q2.exp) === -1, "killing the beast before finding the clue does both steps");
const C = mk("cr", 8); C.crises = { rel: { x: 0.2 } }; C.location = "Whiterun";
X.adopt(C, fake([{ k: "road", place: "Whiterun", hold: "Whiterun" }, { k: "help", hold: "Whiterun", n: 2 }, { k: "boss", hold: "Whiterun" }])); C.exp.done[0] = 1;
C.location = "Solitude"; C.crises.rel.x = 0.5; ok(!X.poll(C).length, "relief in another hold doesn't count");
C.location = "Whiterun"; C.crises.rel.y = 0.3; ok(X.poll(C)[0]?.done === 1, "a crisis contract in the hold counts");
ok(!X.note(C, "fight", { e: { name: "Bandit" }, hold: "Whiterun" }).length, "a plain fight isn't a boss");
ok(X.note(C, "fight", { e: { name: "Bandit Chief", boss: 1 }, hold: "Whiterun" })[0]?.done === 1, "a boss is");
ok(X.isBoss({ legend: "x" }) && X.isBoss({ tags: ["dragon"] }) && X.isBoss({ crisis: 1, noGroup: 1 }) && !X.isBoss({ name: "Wolf" }), "bosses: masters, legends, dragons, crisis ringleaders");

// ---- 4. in a party nobody counts the same fight twice
const P1 = mk("p1", 10), P2 = mk("p2", 10), P3 = mk("p3", 10);
const party = { id: "pt", leader: "p1", members: [{ id: "p1", name: "Pp1" }, { id: "p2", name: "Pp2" }, { id: "p3", name: "Pp3" }] };
ok(X.countsFights(P1, party), "the leader counts fights");
P2.trip = { follow: "p1" }; ok(!X.countsFights(P2, party), "a member beside the leader doesn't");
P3.trip = null; ok(X.countsFights(P3, party), "a member off alone does");
P2.trip = null; P2.dungeon = { run: "r1" }; ok(!X.countsFights(P2, party), "in the party's dungeon only the leader counts");
P2.dungeon = null; ok(X.countsFights(P2, null), "no party: you count");

// ---- 5. party votes: majority wins, a tie goes the leader's way, Not tonight is a choice
const offs = X.offers(d.id, X.dayOf());
const opts = [...offs.map((q) => [q.key, X.titleOf(q), ""]), ["skip", "Not tonight", ""]];
const vote = (pp, votes, force = true) => { let q = X.openVote(pp, { did: "pick|" + Math.random(), kind: "pick", title: "Tonight's expedition", opts }, { offers: offs }, NOW); for (const [u, k] of votes) q = X.castVote(q, u, k, NOW); return X.applyPick(X.settleVote(q, pp.members.map((m) => m.id), NOW + 1, force), NOW + 1); };
let pr = vote(party, [["p1", offs[0].key], ["p2", offs[1].key], ["p3", offs[1].key]]);
ok(pr.exped?.key === offs[1].key && pr.exv.pv.res.votes === 2, "two votes beat the leader's one");
pr = vote({ ...party, members: party.members.slice(0, 2) }, [["p1", offs[0].key], ["p2", offs[2].key]]);
ok(pr.exped?.key === offs[0].key, "a tie goes the leader's way");
pr = vote(party, [["p1", "skip"], ["p2", "skip"], ["p3", offs[0].key]]);
ok(!pr.exped && pr.exv.pv.res.key === "skip", "Not tonight: nobody sets out");
let pq = X.openVote(party, { did: "pick|w", kind: "pick", title: "T", opts }, { offers: offs }, NOW);
ok(pq.exv.pv && !pq.exv.pv.res && pq.exv.pv.ends === NOW + X.VOTE_S, "the vote stays open long enough to think");
pq = X.castVote(pq, "p2", offs[0].key, NOW);
ok(!X.settleVote(pq, ["p1", "p2", "p3"], NOW + 2).exv.pv.res, "it waits for everyone online");
ok(X.settleVote(pq, ["p1", "p2", "p3"], NOW + X.VOTE_S + 2).exv.pv.res, "the time runs out and it's decided");
// the party's progress reaches every member
pr = vote(party, [["p1", offs[0].key]]);
const M1 = mk("m1", 10), M2 = mk("m2", 10);
X.adopt(M1, pr.exped.o, pr.exped.t); X.adopt(M2, pr.exped.o, pr.exped.t);
pr = X.pushDone(pr, offs[0].key, [{ i: 0, done: 1 }, { i: 1, cnt: 1 }]);
ok(X.mergeDone(M2.exp, pr.exped) && M2.exp.done[0] === 1 && M2.exp.cnt[1] === 1, "a member picks up the party's progress");
ok(!X.mergeDone(M2.exp, pr.exped), "and only once");

// ---- 6. Seasoned Scout, chances
const S0 = mk("s0", 10); S0.perks = {}; const S1 = mk("s1", 10); S1.perks = { exp_scout: 1 };
ok(Math.abs(X.chance(S1, "Sneak") - X.chance(S0, "Sneak") - 0.1) < 1e-9, "Seasoned Scout: +10%");
S0.skills.Sneak.lvl = 15; const lo = X.chance(S0, "Sneak"); S0.skills.Sneak.lvl = 90; const hi = X.chance(S0, "Sneak");
ok(lo > 0.45 && lo < 0.55 && hi > 0.9 && hi <= 0.92, "a new hero has about even odds, a master almost always manages (" + lo.toFixed(2) + ", " + hi.toFixed(2) + ")");
ok(PFX.num(S1, "exscout") > 0 && PFX.num(S0, "exscout") === 0, "the perk is real");

// ---- 7. rerolls (Expedition Leader)
const E0 = mk("e0", 20); E0.perks = {}; ok(X.rollsLeft(E0, d) === 0, "no perk, no reroll");
E0.perks = { exp_leader: 1 }; ok(X.rollsLeft(E0, d) === 1, "rank 1: one a day");
E0.perks = { exp_leader: 2 }; ok(X.rollsLeft(E0, d) === 2, "rank 2: two a day");
let d2 = X.rerolled(d, "e0"); ok(X.rollOf(d2) === 1 && X.rollsLeft(E0, d2) === 1, "a reroll is used up");
ok(JSON.stringify(X.offers(d.id, X.dayOf(), X.rollOf(d2))) !== JSON.stringify(X.offers(d.id, X.dayOf(), 0)), "the whole company sees the new offers");
NOW += DAY; ok(X.rollOf(d2) === 0 && X.rollsLeft(E0, d2) === 2, "a new day, fresh rerolls");

// ---- 8. the planning table opens medium and long, and adds gold
ok(X.slotOpen("short", 0) && !X.slotOpen("medium", 0) && !X.slotOpen("long", 0) && X.slotOpen("long", 1), "short is always open; the table opens the rest");
const R = mk("r", 20), lo0 = X.reward(R, { key: "k", slot: "long" }, 0).gold, lo3 = X.reward(R, { key: "k", slot: "long" }, 3).gold;
ok(Math.abs(lo3 / lo0 - 1.3) < 0.02, "each table level adds 10% gold");

// ---- 9. weekly goal and the chest
NOW = Math.floor(NOW / X.WEEK) * X.WEEK + DAY; let dw = { id: "lh-w", members: { a: { role: "founder" }, b: {}, c: {} }, tx: {} };
const goal = X.goalOf(3); ok(goal === 35 && X.goalOf(1) === 30 && X.goalOf(8) === 50, "the goal grows with the company (30 to 50)");
const W1 = mk("w1", 10), W2 = mk("w2", 10); W1.expPart = { [X.weekOf()]: 1 };
for (let k = 0; X.weekRenown(dw) < goal; k++) dw = X.ledgerEntry(dw, { key: "w" + k, slot: "long", tpl: "relic", hold: "The Reach" }, W1, ["Pw1"]);
ok(X.canChest(W1, dw) && !X.canChest(W2, dw), "goal reached: those who went out take the chest");
const gw = W1.gold, ch = X.takeChest(W1, dw); ok(ch && W1.gold === gw + ch.gold && !X.canChest(W1, dw), "the chest once a week");
NOW += X.WEEK; ok(X.weekRenown(dw) === 0 && !X.canChest(W1, dw), "a new week starts from zero");

// ---- 10. screens
as(A); A.exp = null; const dd = L.mine(A);
const html = X.panelHTML(A, dd); ok(/exp-root/.test(html) && (html.match(/class="exp-card/g) || []).length === 3 && !/undefined|NaN/.test(html), "the table shows three cards");
X._tab("hist"); const hh = X.panelHTML(A, dd); ok(/exp-hist|No expeditions/.test(hh) && !/undefined|NaN/.test(hh), "the history tab"); X._tab("offers");
X.adopt(A, X.offers(dd.id, X.dayOf())[0]); ok(/exp-track/.test(X.trackerHTML(A)) && /You're on it/.test(X.panelHTML(A, dd)), "the tracker shows your expedition");
L._tab("exp"); const lp = L.panel(); ok(/exp-root/.test(lp), "the Company screen has an Expeditions tab");

// ---- 11. balance sims
// a) the weekly goal: a small company going out 2-3 evenings a week reaches it, one evening alone doesn't
const wk = (members, evenings, slot) => evenings * X.RENOWN[slot] >= X.goalOf(members);
ok(wk(1, 2, "long") && wk(3, 2, "long") && wk(3, 3, "medium") && !wk(3, 1, "long") && !wk(1, 4, "short"), "the weekly goal needs a few real evenings");
ok(wk(8, 3, "long") && !wk(8, 2, "long"), "a full company of 8 needs three long evenings (or more shorter ones)");
// b) expedition gold is a bonus, not a gold mine: a long expedition pays about one good dungeon's worth
for (const lv of [5, 15, 30, 50]) { const s = mk("g" + lv, lv); const lg = X.reward(s, { key: "x", slot: "long" }, 3).gold, sh = X.reward(s, { key: "x", slot: "short" }, 0).gold;
  ok(lg < 250 + 30 * lv && sh < lg / 2.5 && sh >= 40, "level " + lv + ": short " + sh + ", long " + lg + " gold"); }
// c) the road event over many expeditions: a fresh hero manages about half, a skilled one most, Scout never 100%
let good = 0, tot = 0; const Fx = mk("fx", 10); Fx.perks = {};
for (let k = 0; k < 600; k++) { const oo = X.offers("lh-sim" + k, day)[k % 3]; X.adopt(Fx, oo); const e = X.eventOf(Fx, Fx.exp); for (const kk in e.outs) { tot++; if (e.outs[kk] === "good") good++; } }
ok(good / tot > 0.4 && good / tot < 0.75, "road events: about " + Math.round(100 * good / tot) + "% go well for a fresh hero");

// ---- 12. perks and Polish
ok(PERKS.BY_ID.exp_leader && PERKS.BY_ID.exp_scout && PFX.FX.exp_leader && PFX.FX.exp_scout, "both perks exist with effects");
ok(PERKS.BY_ID.courtly_manners && PERKS.BY_ID.stealth, "old perk ids kept");
const LL = I18N_EXPEDITION, has = (k) => k in LL.tpl || k in LL.words;
const strs = new Set();
for (const m of SRC.matchAll(/\\bT\\(\\s*"((?:[^"\\\\]|\\\\.)*)"/g)) strs.add(m[1]);
for (const t of Object.values(X.TPL)) { strs.add(t.name); strs.add(t.blurb); strs.add(t.ev.title); strs.add(t.ev.text); for (const q of t.ev.opts) { strs.add(q[1]); strs.add(q[2]); } }
for (const h of X.HOLDS) strs.add(h);
for (const b of LEGHUNT.L) strs.add(b.name);
for (const k of ["Short", "Medium", "Long", "about 15 minutes", "about 25 minutes", "40 minutes or more", "Expeditions", "Expedition Leader", "Seasoned Scout"]) strs.add(k);
for (const r of PFX.ADD.filter((a) => /^exp_/.test(a[1]))) strs.add(r[6].replace(/ \\[[^\\]]*\\]$/, ""));
for (const m of SRC.matchAll(/^    \\w+: "((?:[^"\\\\]|\\\\.)*\\{[^"]*)",$/gm)) strs.add(m[1]);
const missing = [...strs].filter((k) => !has(k));
ok(!missing.length, "Polish for every line (missing: " + missing.join(" | ") + ")");
for (const v of [...Object.values(LL.tpl), ...Object.values(LL.words)]) ok(typeof v === "string" && v.length, "non-empty Polish");
const pn = /id: "b\\d+-expedition"[^\\]]*items: \\[([\\s\\S]*?)\\] \\}/.exec(PN);
ok(pn && has(/id: "b\\d+-expedition"[^\\n]*title: "([^"]*)"/.exec(PN)[1]), "patch note title in Polish");
if (pn) for (const m of pn[1].matchAll(/^\\s*"((?:[^"\\\\]|\\\\.)*)",/gm)) ok(has(JSON.parse('"' + m[1] + '"')), "patch note line in Polish: " + m[1].slice(0, 40));

console.log(fails ? fails + " FAILED of " + n : "expedition ok · " + n + " checks");
if (fails) process.exitCode = 1;
})().catch((e) => { console.log("CRASH", e && e.stack); process.exitCode = 1; });
`, Object.assign(c, { setTimeout, process }));
