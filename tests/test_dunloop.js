const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// dungeon runs never loop or stall: solo and party runs (leader + members syncing over a shared store) of every theme
// reach the boss and end, even when the store drops writes, the leader's fight snapshot (tbfight.js) undoes a late
// sync, or a save was made mid-run in a broken state. Saves stuck in a loop are repaired on load.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME;
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, Promise, setTimeout, setImmediate };
c.document = { getElementById: () => null, querySelector: () => null };
c.SEED = +process.env.SEED || 12345;
c.__fail = (e) => { console.error(e.stack || e); process.exitCode = 1; };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "horses.js", "horsetravel.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "craftfair.js", "social.js", "ammo.js", "tomes.js", "magic.js", "combatai.js", "mp.js", "roam.js", "explore.js", "gather.js", "coop.js", "party.js", "partyplay.js", "lootvote.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);

vm.runInContext(`
(async () => {
const ok = (x, m) => { if (!x) throw new Error("FAIL " + m); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
let seed = SEED; Math.random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
if (typeof GATHER !== "undefined" && GATHER.dungeonHooks) GATHER.dungeonHooks();

// keep the heroes alive: the test is about the flow, not balance (every foe has 1 health and hits for 0)
for (const k of ["scaleEnemy", "scaleQuestFoe"]) { const f0 = G[k]; if (f0) G[k] = (...a) => { const e = f0(...a); e.health = e.hp = 1; e.damage = 0; return e; }; }
const act0 = DUNGEONS.act;
DUNGEONS.act = (s, ch, t) => { const r = s.dungeon?.room; if (r?.enemy) { r.enemy.hp = r.enemy.health = 1; r.enemy.damage = 0; } G.setHealth(s, G.maxHealth(s)); return act0(s, ch, t); };
const mk = (id, name, place) => { const s = G.newSave(id, name, "nord"); s.location = place; [s.x, s.y] = WORLD.places[place] || [0, 0]; s.level = 30; return s; };
const KINDS = ["dash", "trigger", "smash", "sneak", "flee", "search"];
function choose(s) {   // the leader's pick, like a player: any real choice, sometimes played as a mini-game
  const ch = DUNGEONS.roomChoices(s).map((x) => x[0]).filter((x) => !x.startsWith("game:") && x !== "potion");
  let c = ch[Math.floor(Math.random() * ch.length)];
  if (!c && s.dungeon.room?.order) c = "set:" + s.dungeon.room.order;   // the ring mini-game, solved
  if (KINDS.includes(c) && Math.random() < 0.6) c = c + "@" + (Math.random()).toFixed(3) + (c === "search" && Math.random() < 0.3 ? "n" : "");
  return c;
}

// ---------------------------------------------------------------- solo: every theme, many maps
const places = Object.keys(WORLD.places).filter((p) => DUNGEONS.enterable(p));
const themes = {};
for (const p of places) { const th = DUNGEONS.info(p).theme; (themes[th] = themes[th] || []).push(p); }
let soloRuns = 0;
for (const [th, list] of Object.entries(themes)) for (let k = 0; k < 6; k++) {
  const place = list[k % list.length], s = mk("S" + k, "Solo", place);
  ok(DUNGEONS.enter(s) === null, "enter " + place);
  const rows = [];
  for (let n = 0; n < 400 && s.dungeon && !s.dungeon.done; n++) {
    if (s.dungeon.room) { DUNGEONS.act(s, choose(s)); continue; }
    const nx = DUNGEONS.nextChoices(s); ok(nx.length, "solo: a way on in " + place + " row " + s.dungeon.row);
    ok(DUNGEONS.enterRoom(s, nx[Math.floor(Math.random() * nx.length)]) === null, "solo enter room");
    rows.push(s.dungeon.row);
  }
  ok(s.dungeon && s.dungeon.done, "solo run of " + place + " (" + th + ") reaches the boss and ends");
  ok(rows.every((r, i) => !i || r > rows[i - 1]), "solo: never the same room twice " + rows);
  soloRuns++;
}

// ---------------------------------------------------------------- party: a shared store, each phone with its own screens
function world(opts = {}) {
  const DB = { runs: {}, lvotes: {} }, players = [];
  const emit = (col) => { const docs = Object.values(DB[col] || {}).map(clone); setImmediate(() => players.forEach((P) => P.on(col, clone(docs)))); };
  const store = (P) => ({ online: true,
    async change(col, id, fn) {
      await new Promise((r) => setImmediate(r));
      if (opts.drop && Math.random() < opts.drop) return null;   // the lease was busy (store.js returns null)
      const cur = DB[col]?.[id]; if (!cur) return null;
      const nx = fn(clone(cur)); if (nx) DB[col][id] = { ...clone(nx), id }; else delete DB[col][id];
      emit(col); return { before: cur, after: nx };
    },
    async put(col, id, doc) { (DB[col] = DB[col] || {})[id] = { ...clone(doc), id }; emit(col); return true; },
    async remove(col, id) { delete DB[col]?.[id]; emit(col); },
  });
  function add(s) {
    const P = { s, entered: [], log: [] };
    const Store = store(P);
    P.coop = COOP.ui({ S: () => P.s, toast: (m) => P.log.push(m), esc: (x) => x, Store, others: () => [], party: () => null, cardOf: () => null,
      persist() {}, publishCard() {}, renderDungeon() {}, renderPanel() {}, bump() {} });
    P.lv = LOOTVOTE.ui({ S: () => P.s, runs: () => P.coop.runs, Store, toast: (m) => P.log.push(m), esc: (x) => x, persist() {}, openModal() {}, closeModal() {}, modalOpen: () => false,
      renderDungeon() {}, nameOf: () => "x", dungeonAct: (ch, replay) => dungeonAct(P, ch, replay) });
    P.trace = []; P.on = (col, docs) => { if (col === "runs") { P.coop.onRuns(docs); P.lv.onRuns(); const d = P.s.dungeon, k = d ? d.row + ":" + d.col + "/" + d.cstep + "/" + (d.room?.type || "-") + (d.done ? "D" : "") : "out"; if (P.trace[P.trace.length - 1] !== k) P.trace.push(k); } };
    P.Store = Store;
    players.push(P);
    return P;
  }
  return { DB, players, add };
}
const where = (P) => P.s.dungeon ? P.s.dungeon.row + ":" + P.s.dungeon.col : "-";
// ui.js dungeonAct + dungeonDone, minus the screens. A leader's fight plays on the turn-by-turn screen: the save is
// snapshotted when it starts and put back when it ends (tbfight.js), so anything that changed meanwhile is undone.
async function dungeonAct(P, ch, replay = false) {
  if (!replay && P.lv.memberLocked()) return null;
  const runId = P.s.dungeon?.run;
  const act = () => { let r, err; const p = P.lv.aroundAct(ch, () => { try { return (r = DUNGEONS.act(P.s, ch)); } catch (x) { err = x; throw x; } }); p?.catch?.(() => {}); if (err) throw err; return r; };
  let r;
  if (!replay && P.tb && P.s.dungeon?.room?.enemy) {
    const snap0 = clone(P.s);
    await flush(3);   // the fight takes a while; the store answers meanwhile
    for (const k of Object.keys(P.s)) delete P.s[k]; Object.assign(P.s, clone(snap0));
    r = act();
  } else r = act();
  if (r?.died) P.log.push("DIED " + ch + " " + r.text + " " + r.died);
  if (runId) P.coop.afterAct(r, runId);
  return r;
}
function dungeonRoom(P, col) {   // ui.js dungeonRoom
  const ce = P.s.dungeon?.run ? P.coop.beforePick() : null;
  if (ce) return ce;
  const d = P.s.dungeon, err = DUNGEONS.enterRoom(P.s, +col);
  if (err) return err;
  d.path = d.path || []; d.path.push([d.row, d.col]);
  if (d.run) P.coop.afterPick();
  return null;
}

async function partyRun(place, n, opts = {}) {
  const Wd = world(opts), heroes = [];
  for (let i = 0; i < n; i++) heroes.push(Wd.add(mk("P" + i, "Hero" + i, place)));
  const L = heroes[0];
  heroes.forEach((P) => { P.tb = !!opts.tb; });
  const nr = COOP.newRun(L.s); ok(nr.doc, "new run " + nr.err);
  let doc = nr.doc;
  for (const P of heroes.slice(1)) doc = COOP.addMember(doc, P.s);
  doc = { ...PARTYPLAY.sizeRun(doc, n), status: "in" };
  await L.Store.put("runs", nr.id, doc);
  await flush();
  for (const P of heroes) { if (!P.s.dungeon) ok(COOP.join(P.s, { ...doc, id: nr.id }) === null, "join"); }
  await flush();
  const stuck = { picks: 0, waits: 0 };
  let steps = 0;
  for (; steps < 600; steps++) {
    await flush();
    const s = L.s, d = s.dungeon;
    if (!d || d.done) break;
    if (d.room) { const r0 = where(L); await dungeonAct(L, choose(s)); continue; }
    const nx = DUNGEONS.nextChoices(s);
    if (!nx.length) { stuck.waits++; continue; }
    const before = d.cstep;
    const err = dungeonRoom(L, nx[Math.floor(Math.random() * nx.length)]);
    if (err) { stuck.picks++; if (stuck.picks > 60) break; continue; }
    L.entered.push(d.row);
    if (opts.tb && d.room?.enemy) await dungeonAct(L, "fight");   // a quick tap on Fight: the fight starts before the store has answered the pick
  }
  for (let i = 0; i < 40; i++) await flush();
  if (opts.drop) { await new Promise((r) => setTimeout(r, 2000)); for (let i = 0; i < 40; i++) await flush(); }   // the store retries after a short wait
  return { heroes, L, steps, stuck, DB: Wd.DB };
}

let partyRuns = 0;
const checkRun = (res, tag) => {
  const { heroes, L, stuck } = res;
  if (!L.s.dungeon) console.log(L.log.slice(-5));
  ok(L.s.dungeon && L.s.dungeon.done, tag + ": the leader reaches the boss and ends the run (stuck picks " + stuck.picks + ", at " + where(L) + " cstep " + L.s.dungeon?.cstep + " path " + JSON.stringify(Object.values(res.DB.runs)[0]?.path) + ")");
  ok(L.entered.every((r, i) => !i || r > L.entered[i - 1]), tag + ": the leader never picks the same room twice " + L.entered);
  const lrows = (L.s.dungeon.path || []).map((p) => p[0]);
  ok(lrows.every((r, i) => !i || r > lrows[i - 1]), tag + ": the leader is never sent back into a room (the loop players saw) " + JSON.stringify(L.s.dungeon.path));
  for (const P of heroes.slice(1)) {
    if (!P.s.dungeon?.done) { const rr = Object.values(res.DB.runs)[0]; console.log("DBG path", JSON.stringify(rr.path), "acts", JSON.stringify(rr.acts), "L cstep", L.s.dungeon.cstep, "Lpath", JSON.stringify(L.s.dungeon.path), "Mpath", JSON.stringify(P.s.dungeon.path), "lvDone", JSON.stringify(P.s.dungeon.lvDone), P.trace.join(" "), L.trace.join(" ")); }
    ok(P.s.dungeon && P.s.dungeon.done, tag + ": member " + P.s.name + " follows to the end (at " + where(P) + ", cstep " + P.s.dungeon?.cstep + ", room " + P.s.dungeon?.room?.type + ")");
    const rows = (P.s.dungeon.path || []).map((p) => p[0]);
    ok(rows.every((r, i) => !i || r > rows[i - 1]), tag + ": member never walks the same room twice " + rows);
  }
  partyRuns++;
};
const dplaces = Object.entries(themes).filter(([th]) => th !== "giantcamp" && th !== "lair").map(([, l]) => l[0]);
for (const place of dplaces) for (const n of [2, 3]) checkRun(await partyRun(place, n), "party of " + n + " in " + place);
for (const place of [...dplaces, themes.lair?.[0], themes.giantcamp?.[0]].filter(Boolean)) checkRun(await partyRun(place, 2), "party in " + place);
// the leader's fight snapshot comes back after the store answered (turn-by-turn fights on phones)
for (const place of dplaces.slice(0, 4)) for (const n of [2, 3]) checkRun(await partyRun(place, n, { tb: true }), "turn-by-turn party of " + n + " in " + place);
// a busy store drops writes now and then
for (const place of dplaces.slice(0, 4)) for (const n of [2, 3]) checkRun(await partyRun(place, n, { drop: 0.25 }), "flaky store, party of " + n + " in " + place);
for (const place of dplaces.slice(0, 3)) checkRun(await partyRun(place, 3, { drop: 0.2, tb: true }), "flaky store + turn-by-turn in " + place);

// ---------------------------------------------------------------- saves stuck mid-run get repaired on load
{ // the boss died but the result never landed (old migrate emptied the boss room): the boss waits again
  const s = mk("R1", "Rep", dplaces[0]); DUNGEONS.enter(s);
  const d = s.dungeon; d.row = d.rows.length - 1; d.col = 0; d.room = { type: "boss", enemy: { name: "Draugr Overlord", hp: 0, health: 100, damage: 5 } };
  const m = G.migrate(clone(s));
  ok(m.dungeon && (m.dungeon.room || DUNGEONS.nextChoices(m).length), "a boss room lost on load can be entered again");
}
{ // a dead end: the room you stand in leads nowhere
  const s = mk("R2", "Rep", dplaces[0]); DUNGEONS.enter(s); DUNGEONS.enterRoom(s, 0); s.dungeon.room = null;
  s.dungeon.rows[0][0].links = [];
  const m = G.migrate(clone(s));
  ok(DUNGEONS.nextChoices(m).length > 0, "a dead end gets a way on");
}
{ // a leader whose last room was never written to the run (store dropped it): can still pick the next room
  const run = { id: "run-x", leader: "A", members: [{ id: "A" }, { id: "B" }], path: [[0, 0]], rooms: [{ type: "fight" }] };
  const A = { id: "A", dungeon: { cstep: 2, room: null, row: 1, col: 0 } };
  ok(COOP.canPick(A, run), "a leader one room ahead of the record can pick");
  const rec = COOP.recordPick(run, { ...A.dungeon, row: 2, col: 0, room: { type: "trap" } });
  ok(rec && rec.path.length === 2, "and the pick is recorded");
}
{ // a leader standing in the room the run already counts (fight snapshot undid the count): no second visit
  const s = mk("A", "Lead", dplaces[0]), B = mk("B", "Mem", dplaces[0]);
  let run = COOP.newRun(s); const id = run.id; run = { ...COOP.addMember(run.doc, B), status: "in", id };
  COOP.join(s, run);
  DUNGEONS.enterRoom(s, run.rows[0].length > 1 ? 1 : 0); s.dungeon.path.push([s.dungeon.row, s.dungeon.col]);
  run = COOP.recordPick(run, s.dungeon);
  s.dungeon.room = null;   // resolved, but cstep still 0
  const at = [s.dungeon.row, s.dungeon.col];
  COOP.follow(s, run);
  ok(!s.dungeon.room && s.dungeon.cstep === 1 && s.dungeon.row === at[0], "the leader is not sent back into the same room");
  ok(COOP.canPick(s, run), "and picks the next room");
  const m = G.migrate(clone(s)); ok(m.dungeon.row === at[0], "migrate keeps the place");
}
{ // a run record with the same room twice in its path: members walk it once
  const s = mk("A", "Lead", dplaces[0]), B = mk("B", "Mem", dplaces[0]);
  let run = COOP.newRun(s); const id = run.id; run = { ...COOP.addMember(run.doc, B), status: "in", id };
  COOP.join(B, run);
  const col = run.rows[0][0].links[0];
  run = { ...run, path: [[0, 0], [0, 0], [1, col]], rooms: [{ type: run.rows[0][0].type }, { type: run.rows[0][0].type }, { type: run.rows[1][col].type }] };
  ok(COOP.follow(B, run) === 1 && B.dungeon.row === 0, "member enters the first room"); B.dungeon.room = null;
  COOP.follow(B, run); if (B.dungeon.room && B.dungeon.row === 0) ok(false, "member sent into the same room twice");
  if (!B.dungeon.room) COOP.follow(B, run);
  ok(B.dungeon.row === 1 && B.dungeon.cstep === 3, "member moves on to the next row (" + B.dungeon.row + ", cstep " + B.dungeon.cstep + ")");
}
console.log("dungeon loop OK: " + soloRuns + " solo runs, " + partyRuns + " party runs, repairs checked");
})().catch((e) => __fail(e));
`, c);
