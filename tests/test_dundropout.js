// dundropout.js: a 3-player co-op run where one player drops (closes the game, times out, comes back).
// Three "phones" share one in-memory world; each runs its own DUNDROP.mount with a clock we control.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
let fails = 0;
const ok = (cond, m) => { if (!cond) { fails++; console.log("FAIL", m); } else if (process.env.V) console.log("ok", m); };
const clock = { ms: 1_700_000_000_000 };
const cx = {
  console, Math, Date, JSON, Object, Array, Set, Map, Number, String, RegExp, Promise, setTimeout, clearTimeout,
  G: { now: () => clock.ms / 1000, note() {}, setHealth() {}, curHealth: (s) => s.hp, maxHealth: () => 100, scaleEnemy: (e) => e },
  D: { ITEMS: { iron_sword: { name: "Iron Sword", slot: "weapon" }, potion_health: { name: "Potion of Healing", slot: "potion" }, amulet_talos: { name: "Amulet of Talos", slot: "neck" } }, LOOT: { elite: [] } },
  DUNGEONS: {
    info: (p) => (p ? { theme: "nordruin", tier: 2 } : null), layout: () => [[{ type: "fight", links: [0] }], [{ type: "boss", links: [] }]], refillLeft: () => 0,
    THEMES: { nordruin: { loot: [] } }, ENEMY: {},
    leave(s) { s.leftWithSnap = s.dungeon?.deep ? s.dungeon.deep.snap : undefined; s.dungeon = null; return "You climb back into daylight."; },
  },
};
vm.createContext(cx);
for (const f of ["coop.js", "lootvote.js", "dundropout.js"]) vm.runInContext(fs.readFileSync(__GAME + f, "utf8").replace(/^const (COOP|LOOTVOTE|DUNDROP) =/m, "var $1 ="), cx, { filename: f });
const { COOP, LOOTVOTE: LV, DUNDROP: DD } = cx;

// ---------------------------------------------------------------- the shared world (a perfect network) and the phones
const world = { runs: {}, rbeat: {} };
const phones = [];
const list = (col) => Object.entries(world[col] || {}).map(([id, d]) => ({ ...d, id }));
function emit(col) { for (const p of phones) if (!p.asleep && !p.gone) (p.w[col] || []).forEach((f) => f(list(col))); }
function storeFor(p) {
  return {
    online: true,
    watch(col, cb) { (p.w[col] = p.w[col] || []).push(cb); cb(list(col)); },
    async put(col, id, doc) { if (p.gone) return; (world[col] = world[col] || {})[id] = JSON.parse(JSON.stringify(doc)); emit(col); return true; },
    async remove(col, id) { delete (world[col] || {})[id]; emit(col); },
    async change(col, id, fn) { const cur = world[col]?.[id]; if (!cur) return null; const before = JSON.parse(JSON.stringify(cur)); const nx = fn(JSON.parse(JSON.stringify(cur))); if (nx) world[col][id] = nx; else delete world[col][id]; emit(col); return { before, after: nx }; },
  };
}
const cards = {};
function phone(s) {
  const p = { s, w: {}, notices: [], toasts: [], joined: [], asleep: false, gone: false };
  p.api = DD.mount({ S: () => p.s, Store: storeFor(p), toast: (m) => p.toasts.push(m), cardOf: (id) => cards[id], online: (id) => !!cards[id] && clock.ms - cards[id].updated < 180e3,
    persist() {}, renderPanel() {}, closeDungeon() { p.closed = (p.closed || 0) + 1; }, coopJoin: async (id) => { p.joined.push(id); await storeFor(p).change("runs", id, (x) => COOP.addMember(x, p.s) || x); },
    nowMs: () => clock.ms, timers: false, onNotice: (n, html) => p.notices.push({ n, html }) });
  phones.push(p);
  return p;
}
function run(secs, who = phones) { for (let k = 0; k < secs; k++) { clock.ms += 1000; for (const p of who) if (!p.asleep && !p.gone) p.api.tick(); } }
const hero = (id, name) => ({ id, name, level: 20, hp: 80, gold: 100, inv: [{ id: 1, item: "iron_sword", qty: 1 }], nextInv: 2, location: "Bleak Falls Barrow", dungeon: null });
const inside = (s, runId) => { s.dungeon = { place: "Bleak Falls Barrow", run: runId, rows: [], row: 0, col: 0, room: null, found: ["Iron Sword"], gold: 30, cstep: 1, t: cx.G.now() }; };
async function openRun(leader, mates, pool) {
  const r = COOP.newRun(leader);
  let doc = { ...r.doc, id: r.id };
  for (const m of mates) doc = COOP.addMember(doc, m);
  doc.status = "in"; doc.pool = pool || null; delete doc.id;
  world.runs[r.id] = doc; emit("runs");
  for (const s of [leader, ...mates]) inside(s, r.id);
  return r.id;
}
const reset = () => { phones.length = 0; world.runs = {}; world.rbeat = {}; for (const k of Object.keys(cards)) delete cards[k]; };
const card = (id, name) => { cards[id] = { id, name, updated: clock.ms }; };

(async () => {
  // ================================================================ 1. C's phone dies (no bye): ends after the grace time, not before
  {
    reset();
    const A = phone(hero("A", "Alfa")), B = phone(hero("B", "Beta")), C = phone(hero("C", "Ceo"));
    ["A", "B", "C"].forEach((id, i) => card(id, ["Alfa", "Beta", "Ceo"][i]));
    const pool = { items: [{ item: "amulet_talos", qty: 1 }, { item: "potion_health", qty: 3 }], gold: 301 };
    const id = await openRun(A.s, [B.s, C.s], pool);
    A.s.inv.push({ id: 2, item: "potion_health", qty: 2 }); const invA = JSON.stringify(A.s.inv);
    run(30);
    ok(!world.runs[id].ended, "everyone beating: the run goes on");
    ok(world.rbeat["rb-A"] && world.rbeat["rb-C"]?.run === id, "beats are one small record per player");
    C.gone = true;   // the phone just dies: no bye
    run(20);
    ok(!world.runs[id].ended && A.s.dungeon && B.s.dungeon, "20 s without C: still inside (grace)");
    run(8);
    const r = world.runs[id];
    ok(r.ended && r.status === "ended", "after ~25 s the run has ended: " + JSON.stringify(r.ended));
    ok(r.ended.drops.C === "Ceo" && !r.ended.drops.A && !r.ended.drops.B, "only C is named as gone");
    ok(!A.s.dungeon && !B.s.dungeon, "A and B were taken out to the map");
    ok(A.s.location === "Bleak Falls Barrow" && B.s.location === "Bleak Falls Barrow", "at the dungeon's entrance");
    ok(JSON.stringify(A.s.inv) === invA && A.s.gold === 100, "A loses nothing they carried");
    ok(A.notices.length === 1 && A.notices[0].n.kind === "left" && /Ceo left the game — the run in Bleak Falls Barrow has ended\./.test(A.notices[0].html), "A's notice: " + A.notices[0]?.html.replace(/\s+/g, " ").slice(0, 200));
    ok(/Go back in together/.test(A.notices[0].html) && /Wait for Ceo/.test(A.notices[0].html) && /data-dd="ok">OK/.test(A.notices[0].html), "notice actions: Go back in together / Wait for Ceo / OK");
    ok(B.notices.length === 1 && B.notices[0].n.kind === "left", "B gets the same notice");
    ok(r.members.every((m) => m.left) && !(r.invites || []).length, "nobody is left in the run, no invite into it remains");
    ok(r.vote && r.vote.members.join() === "A,B,C" && r.vote.leader === "A" && r.vote.gold === 301 && r.vote.items.length === 2, "the loot pile goes to the usual vote, C included: " + JSON.stringify(r.vote && { m: r.vote.members, l: r.vote.leader, g: r.vote.gold }));
    ok(A.s.lastRun === id && B.s.lastRun === id, "the vote can still reach them (lastRun)");
    run(10);
    ok(A.notices.length === 1, "the notice shows once");
    // C comes back: a fresh start of the game with the save still inside the dead run
    C.gone = false; C.api = phone(C.s).api; phones.splice(phones.indexOf(C), 1);
    const C2 = phones[phones.length - 1];
    card("C", "Ceo");
    run(2);
    ok(!C.s.dungeon && C.s.lastRun === id, "C's save is out of the dead run");
    ok(C2.notices.length === 1 && C2.notices[0].n.kind === "away" && /Your run in Bleak Falls Barrow ended while you were away\./.test(C2.notices[0].html), "C's notice on return");
    ok(/Back to the map/.test(C2.notices[0].html) && /Ask the group to go again/.test(C2.notices[0].html), "C's actions");
    ok(world.runs[id].vote.members.length === 3, "C's return doesn't change the vote");
    // the split: nothing lost, nothing doubled
    const res = LV.resolve(LV.final(world.runs[id].vote, cx.G.now() + 999), id);
    const gold = Object.values(res.gold).reduce((a, b) => a + b, 0), items = Object.values(res.items).reduce((a, b) => a + b.length, 0);
    ok(gold === 301 && items === 2 && res.gold.C >= 100, "gold split evenly incl. C, every item to one person: " + JSON.stringify(res.gold));

    // Wait for Ceo (from A's notice) while C is offline, then C is back
    delete cards.C;
    await A.api.doAct("wait");
    ok(A.api.waiting && !A.api.waiting.back, "A waits for C");
    run(3, [A]);
    ok(!A.api.waiting.back, "still offline");
    card("C", "Ceo"); cards.C.updated = clock.ms + 1;
    run(1, [A]);
    ok(A.api.waiting.back && A.toasts.some((t) => /Ceo is back online/.test(t)), "A sees Ceo is back: " + A.toasts.join(" | "));
    // Go back in together: one new run with the old group invited; B pressing it too joins that run instead of opening another
    await A.api.doAct("waitgo");
    const again = Object.entries(world.runs).filter(([, r]) => r.again === id);
    ok(again.length === 1 && again[0][1].leader === "A" && again[0][1].invites.map((x) => x.id).sort().join() === "B,C", "a new run, B and C invited: " + JSON.stringify(again.map(([, r]) => r.invites)));
    ok(!A.api.waiting, "waiting is over");
    await B.api.again(world.runs[id] && { ...world.runs[id], id });
    ok(Object.values(world.runs).filter((r) => r.again === id).length === 1 && B.joined[0] === again[0][0], "B joins the same new run");
    await C2.api.doAct("again");
    ok(Object.values(world.runs).filter((r) => r.again === id).length === 1 && C2.joined[0] === again[0][0], "C (Ask the group to go again) joins it too");
  }

  // ================================================================ 2. C closes the game: "bye" ends it straight away
  {
    reset();
    const A = phone(hero("A", "Alfa")), B = phone(hero("B", "Beta")), C = phone(hero("C", "Ceo"));
    const id = await openRun(A.s, [B.s, C.s], null);
    run(10);
    C.api.bye(); C.gone = true;
    run(2);
    ok(world.runs[id].ended?.drops?.C === "Ceo" && !A.s.dungeon && !B.s.dungeon, "a bye ends the run within a couple of seconds");
    ok(!world.runs[id].vote, "an empty loot pile opens no vote");
  }

  // ================================================================ 3. a blip (15 s) doesn't end it; this phone's own sleep blames nobody
  {
    reset();
    const A = phone(hero("A", "Alfa")), B = phone(hero("B", "Beta")), C = phone(hero("C", "Ceo"));
    const id = await openRun(A.s, [B.s, C.s], null);
    run(10);
    C.asleep = true; run(15); C.asleep = false; run(40);
    ok(!world.runs[id].ended && A.s.dungeon && C.s.dungeon, "a 15 s blip: the run goes on");
    A.asleep = true; run(20, [B, C]); A.asleep = false;
    run(40);
    ok(!world.runs[id].ended && A.s.dungeon, "A switched apps for 20 s: nobody gets thrown out");
    // this phone slept a whole minute (timers frozen, no messages): on waking it gives the others a fresh grace time
    const tr = DD.tracker(0), r1 = { id: "r9", status: "in", members: [{ id: "A" }, { id: "B", name: "Beta" }] };
    DD.hear(tr, { run: "r9", uid: "B", n: "x:1" }, 1000); DD.wake(tr, 1000);
    DD.wake(tr, 61000);
    ok(!DD.dropped(tr, r1, "A", 61000).length, "after our own sleep nobody is blamed");
    ok(DD.dropped(tr, r1, "A", 61000 + DD.GRACE_MS + 1000).length === 1, "…but B still has to beat again within the grace time");
  }

  // ================================================================ 4. the leader drops mid-fight on B's screen; expedition finds kept
  {
    reset();
    const A = phone(hero("A", "Alfa")), B = phone(hero("B", "Beta"));
    const id = await openRun(A.s, [B.s], { items: [{ item: "iron_sword", qty: 1 }], gold: 10 });
    B.s.dungeon.deep = { snap: { gold: 0 }, extracted: false };
    run(10);
    const pre = JSON.parse(JSON.stringify(B.s));
    B.s.hp = 1;   // a fight going badly…
    cx.TB = { open: true, abort() { this.open = false; this.aborted = true; for (const k of Object.keys(B.s)) delete B.s[k]; Object.assign(B.s, JSON.parse(JSON.stringify(pre))); return true; } };
    A.api.bye(); A.gone = true;
    run(2, [B]);
    ok(cx.TB.aborted && !cx.TB.open, "the fight on screen ended");
    ok(!B.s.dungeon && B.s.hp === 80, "B is out, health as before the fight (nobody dies)");
    ok(B.s.leftWithSnap === null, "the expedition's finds weren't dropped on the way out");
    ok(world.runs[id].vote?.leader === "B", "the leader dropped: B leads the loot vote");
    ok(world.runs[id].deepMark === null, "no expedition rollback of the pile");
    delete cx.TB;
  }

  // ================================================================ 5. solo dungeons and runs of one are never touched
  {
    reset();
    const A = phone(hero("A", "Alfa"));
    A.s.dungeon = { place: "Bleak Falls Barrow", rows: [], found: [], gold: 0 };   // solo: no run
    run(120);
    ok(A.s.dungeon && !A.notices.length, "a solo dungeon is untouched");
    const B = phone(hero("B", "Beta"));
    const id = await openRun(B.s, [], null);
    run(120);
    ok(!world.runs[id].ended && B.s.dungeon, "a run with just you never ends on its own");
  }

  // ================================================================ 6. a save inside a run whose record is gone; old apps that never beat
  {
    reset();
    const A = phone(hero("A", "Alfa"));
    inside(A.s, "run-old-1");
    run(10);
    ok(A.s.dungeon, "not yet: the record may still be on its way");
    run(15);
    ok(!A.s.dungeon && A.notices[0]?.n.kind === "away", "a run whose record is gone lets you out, with the 'while you were away' notice");
    reset();
    const P = phone(hero("P", "Pia"));
    const Q = { s: hero("Q", "Quin") };   // an old app: in the run, never beats
    const id = await openRun(P.s, [Q.s], null);
    card("Q", "Quin");
    const keep = setInterval(() => {}, 1e6); clearInterval(keep);
    for (let k = 0; k < 90; k++) { cards.Q.updated = clock.ms; run(1, [P]); }
    ok(!world.runs[id].ended, "a member on an old app (online, no beats) doesn't end the run");
    delete cards.Q;
    run(5, [P]);
    ok(world.runs[id].ended?.drops?.Q === "Quin", "…but once they're gone from the world too, it ends");
  }

  // ================================================================ 7. pure bits: two phones noticing at once, notice texts
  {
    const r0 = { id: "r1", place: "Ustengrav", status: "in", leader: "A", members: [{ id: "A", name: "Alfa" }, { id: "B", name: "Beta" }, { id: "C", name: "Ceo" }], pool: { items: [{ item: "iron_sword", qty: 1 }], gold: 9 } };
    const e1 = DD.endRun(r0, [{ id: "C", name: "Ceo" }], "A", 100, LV);
    const e2 = DD.endRun(e1, [{ id: "B", name: "Beta" }], "C", 101, LV);
    ok(e2.vote === e1.vote || JSON.stringify(e2.vote) === JSON.stringify(e1.vote), "a second write doesn't open a second vote");
    ok(e2.ended.drops.C === "Ceo" && e2.ended.drops.B === "Beta" && e2.ended.t === 100, "names add up");
    const n = DD.noticeFor(e2, "A");
    ok(n.kind === "left" && n.who === "Ceo and Beta", "two names: " + n.who);
    ok(DD.noticeFor(e2, "B").kind === "away", "one of the dropped sees the 'away' notice");
    const ag = DD.againDoc(e2, { id: "x", doc: { leader: "B", invites: [] } }, "B");
    ok(ag.again === "r1" && ag.invites.map((x) => x.id).join() === "A,C", "again: the rest of the old group is invited");
  }

  console.log(fails ? `${fails} FAILED` : "dundropout: all ok");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log("FAIL crash", e); process.exit(1); });
