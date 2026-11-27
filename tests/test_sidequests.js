// NPC tasks in the Journal (npctasks.js): every task you take from someone shows up as a Journal entry with its giver,
// where it came from, the next step, progress, time left and reward; tracking it drives QUESTS.tracked (compass bar,
// map diamond, What to do next); finishing moves it to Completed; abandoning works and needs the task to allow it.
// Sources: notice-board jobs (towns.js), odd jobs at places (placestuff.js), rumour leads (rumours.js), legendary hunts
// (leghunt.js), Daedric contracts (bargains.js), the company escort (commissions.js) and expedition (expedition.js).
//   W=/path/to/game/ node test_sidequests.js   -> "sidequests ok"
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, process };
c.localStorage = { getItem: () => null, setItem() {} };
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f) && !/^(store|ui)\.js$/.test(f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f }); } catch (e) { /* page-only module */ } }
vm.runInContext(`
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const T = NPCTASKS;
const at = (s, p) => { s.location = p; [s.x, s.y] = WORLD.places[p]; s.trip = null; s.dungeon = null; };
const hero = () => { const s = G.newSave("tk", "Tester", "nord"); s.id = "tk1"; s.level = 30; s.gold = 5000; at(s, "Whiterun"); return s; };
const entry = (s, pre) => T.list(s).find((e) => e.key.startsWith(pre));
const fields = (e, what) => {
  for (const k of ["key", "title", "giver", "objective", "tab"]) OK(typeof e[k] === "string" && e[k].length, what + ": " + k);
  OK(["active", "misc"].includes(e.tab), what + ": tab");
  OK(typeof e.abandon === "function", what + ": can be abandoned");
  const html = T.card(s0, e); OK(/data-act="tasktrack"/.test(html) && /data-act="taskdrop"/.test(html), what + ": card has Track and Abandon");
  OK(!/undefined|NaN/.test(html), what + ": card has no undefined/NaN");
};
let s0;

// 1. nothing at the start, and the first poll on a save announces nothing (old tasks aren't "new")
{ const s = hero(); s0 = s; OK(T.list(s).length === 0, "a fresh hero has no tasks"); const r = T.poll(s); OK(r.added.length === 0 && Array.isArray(s.taskSeen), "first poll only remembers"); }

// 2. notice-board jobs: clear, deliver, gather (progress, hand-in, done -> Completed), abandon
{
  const s = hero(); s0 = s; T.poll(s);
  const jobs = TOWNS.jobsAt(s, "Whiterun");
  OK(jobs.length >= 2, "Whiterun has jobs today");
  for (const j of jobs) OK(!/^You|gone/.test(TOWNS.takeJob(s, j.id)), "take job " + j.type);
  const p = T.poll(s); OK(p.added.length === jobs.length, "taking jobs announces each one");
  for (const j of jobs) {
    const e = T.find(s, "job:" + j.id); OK(e, "job in the list: " + j.type); fields(e, "job " + j.type);
    OK(e.from === "Whiterun" && /gold/.test(e.reward), "job: from and reward");
    OK(e.giver && !/^Someone/.test(e.giver), "job: a named giver");
    if (j.type === "gather") { OK(e.prog && e.prog.need === j.n && e.prog.have === 0, "gather progress 0/n"); OK(!e.place, "gather: hand in anywhere"); }
    else OK(e.place === j.target, "job target is where to go");
  }
  const g = jobs.find((j) => j.type === "gather");
  if (g) {
    G.give(s, g.item, g.n - 1); OK(T.find(s, "job:" + g.id).prog.have === g.n - 1, "gather progress counts the pack");
    OK(!T.find(s, "job:" + g.id).act, "no hand-in button before you have them all");
    G.give(s, g.item, 1); const e = T.find(s, "job:" + g.id); OK(e.prog.have === g.n && e.act && e.act.label === "Hand it in", "hand-in button when you have them all");
    const gold = s.gold; e.act.run(s); OK(s.gold > gold, "handing in pays");
    const r = T.poll(s); OK(r.ended.some((x) => x.key === "job:" + g.id), "the finished job ends");
    OK((s.taskLog || []).some((x) => x.key === "job:" + g.id && x.how === "done"), "it is in Completed");
    OK(/Finished tasks/.test(T.doneShelf(s)), "Completed shows finished tasks");
  }
  const d = jobs.find((j) => j.type === "deliver");
  if (d) { at(s, d.target); TOWNS.checkJobs(s); T.poll(s); OK(!T.find(s, "job:" + d.id) && s.taskLog.some((x) => x.key === "job:" + d.id && x.how === "done"), "delivering finishes the job"); }
  const cl = jobs.find((j) => j.type === "clear");
  if (cl) {
    // tracking drives QUESTS.tracked: compass bar, map diamond, HUD objective, What to do next
    OK(T.track(s, "job:" + cl.id) && s.trackQ === "task:job:" + cl.id, "track sets trackQ");
    const q = QUESTS.tracked(s); OK(q && q.task && q.def.name === T.find(s, "job:" + cl.id).title, "QUESTS.tracked returns the task");
    OK(QUESTS.target(q.st) === cl.target, "the tracked target is where the job is");
    const r = T.abandon(s, "job:" + cl.id); OK(!r.err && !(s.jobs || []).some((x) => x.id === cl.id), "abandon drops the job");
    OK(s.trackQ == null, "abandoning clears the tracking");
    OK(s.taskLog.some((x) => x.key === "job:" + cl.id && x.how === "abandoned"), "abandoned is logged (not shown as finished)");
    OK(!/Clear out/.test(T.doneShelf(s)) || s.taskLog.filter((x) => x.how === "done").some((x) => /Clear out/.test(x.title)), "abandoned jobs aren't listed as finished");
  }
}

// 3. odd jobs at a farm or camp (placestuff.js)
{
  const s = hero(); s0 = s; T.poll(s); let took = null;
  for (const n of Object.keys(WORLD.places)) { if (TOWNS.isTown(n) || !PLACESTUFF.offers(n).some((o) => o.startsWith("job"))) continue; at(s, n); const r = PLACESTUFF.takeJob(s, n); if (r && !r.err) { took = n; break; } }
  if (took) { const e = T.list(s).find((x) => x.key.startsWith("job:") && x.from === took); OK(e, "a place job shows"); fields(e, "place job"); }
  else console.log("  (no odd job offered today: skipped)");
}

// 4. rumour leads (rumours.js): time left, where to go, abandon
{
  const s = hero(); s0 = s; T.poll(s); let r = null;
  for (const town of ["Whiterun", "Riften", "Windhelm", "Solitude", "Markarth"]) { at(s, town); r = RUMOURS.hear(s, "street", G.now(), () => 0.3); if (r && r.lead) break; }
  OK(r && r.lead, "heard a rumour");
  const e = T.find(s, "lead:" + r.lead.id); OK(e, "the lead is in the Journal"); fields(e, "rumour");
  OK(e.place === r.lead.place && e.due > G.now(), "lead: where and time left");
  OK(/left/.test(T.card(s, e)), "the card shows time left");
  OK(T.poll(s).added.length === 1, "a new lead is announced");
  T.abandon(s, "lead:" + r.lead.id); OK(!RUMOURS.leads(s).some((x) => x.id === r.lead.id), "abandon forgets the lead");
}

// 5. a legendary hunt contract (leghunt.js): clues progress
{
  const s = hero(); s0 = s; T.poll(s);
  const c = LEGHUNT.L.find((x) => x.lvl <= s.level); at(s, c.town);
  const r = LEGHUNT.accept(s, c.id); OK(!r.err, "took a hunt contract: " + (r.err || ""));
  const e = T.find(s, "hunt:" + c.id); OK(e, "the hunt is in the Journal"); fields(e, "hunt");
  OK(e.prog && e.prog.need === LEGHUNT.NEED && e.prog.have === 0, "hunt: clue progress 0/" + LEGHUNT.NEED);
  OK(e.from === c.town && /gold/.test(e.reward), "hunt: from and reward");
  LEGHUNT.cur(s).clues = 2; OK(T.find(s, "hunt:" + c.id).prog.have === 2, "clues update the progress");
  OK(T.track(s, "hunt:" + c.id) && QUESTS.tracked(s).task, "track the hunt");
  T.abandon(s, "hunt:" + c.id); OK(!LEGHUNT.cur(s) && s.trackQ == null, "abandon ends the hunt");
}

// 6. a Daedric contract (bargains.js)
{
  const s = hero(); s0 = s; T.poll(s);
  const p = BARGAIN.IDS[0]; const m = BARGAIN.offer(s, p); OK(s.bargain && s.bargain.c, "took a Daedric contract: " + m);
  const e = T.find(s, "bargain:" + p); OK(e, "the contract is in the Journal"); fields(e, "bargain");
  OK(e.giver === BARGAIN.PR[p].prince && e.prog && e.prog.need === BARGAIN.PR[p].steps[0][1], "bargain: prince and first step");
  s.bargain.c.n = 3; OK(T.find(s, "bargain:" + p).prog.have === Math.min(3, BARGAIN.PR[p].steps[0][1]), "deeds update the progress");
  T.abandon(s, "bargain:" + p); OK(!s.bargain.c, "abandon breaks the contract");
}

// 7. company escort and expedition (misc tab)
{
  const s = hero(); s0 = s; T.poll(s);
  s.cmEsc = { key: "test-esc", to: "Riften", t: Math.floor(G.now()) };
  const e = T.find(s, "escort:test-esc"); OK(e && e.tab === "misc" && e.place === "Riften", "the escort is a Misc task"); fields(e, "escort");
  T.abandon(s, "escort:test-esc"); OK(!s.cmEsc, "abandon leaves the caravan");
  const offers = EXPEDITION.offers("testco");
  if (offers && offers[0]) {
    EXPEDITION.adopt(s, offers[0]);
    const x = T.list(s).find((y) => y.key.startsWith("exp:")); OK(x && x.tab === "misc" && x.prog && x.prog.need === offers[0].steps.length, "the expedition is a Misc task with step progress"); fields(x, "expedition");
    OK(T.count(s, "misc") >= 1 && /tkcard/.test(T.shelf(s, "misc")), "the Misc shelf lists it");
  } else console.log("  (no expedition offers: skipped)");
}

// 8. a tracked task that ends falls back to the first quest; jSig-style signature changes when a task arrives
{
  const s = hero(); s0 = s; T.poll(s); QUESTS.ensure(s);
  const j = TOWNS.jobsAt(s, "Whiterun")[0]; TOWNS.takeJob(s, j.id); T.track(s, "job:" + j.id);
  const sig1 = T.sig(s); TOWNS.dropJob(s, j.id); T.poll(s);
  OK(T.sig(s) !== sig1, "the signature changes with the task list");
  OK(!QUESTS.tracked(s) || !QUESTS.tracked(s).task, "an ended task stops being the tracked one");
}

// 9. per player: two heroes don't see each other's tasks
{ const a = hero(), b = hero(); b.id = "tk2"; const j = TOWNS.jobsAt(a, "Whiterun")[0]; TOWNS.takeJob(a, j.id); OK(T.list(a).length === 1 && T.list(b).length === 0, "tasks are per player"); }

// 10. a broken source never hides the others
{ T.register("broken", () => { throw new Error("boom"); }); const s = hero(); const j = TOWNS.jobsAt(s, "Whiterun")[0]; TOWNS.takeJob(s, j.id); OK(T.list(s).length === 1, "a throwing source is skipped"); T.register("broken", () => []); }

console.log("sidequests ok · " + n + " checks");
`, c);
