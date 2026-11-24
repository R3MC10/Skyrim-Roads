// Party traps over the network: several separate "phones" (each its own copy of the game) share one synced store.
// Trap results, the hit sizes, the follower rolls, the chest outcome and the live cursor must come out the same on every
// phone, and a phone that reloads / reconnects mid-trap must neither play twice nor leave the party stuck.
// node test_partytraps_net.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "perkfx.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "dungeongames.js", "livecursor.js", "partytraps.js", "lootvote.js"];
const SRC = FILES.filter((f) => fs.existsSync(W + f)).map((f) => fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/gm, "var $1 ="));
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const tick = () => new Promise((r) => setTimeout(r, 5));
let CLOCK = Date.now();

// ---- the network: one store, every phone gets every change (a copy, a moment later, like the real sync)
function net() {
  const cols = {}, subs = [];
  const list = (col) => Object.values(cols[col] || {}).map((d) => JSON.parse(JSON.stringify(d)));
  const deliver = (col) => setTimeout(() => subs.filter((x) => x.col === col && x.on).forEach((x) => x.f(list(col))), 1);
  return {
    cols, list, subs,
    client() {
      const mine = [];
      return {
        online: true,
        put(col, id, doc) { (cols[col] = cols[col] || {})[id] = JSON.parse(JSON.stringify({ ...doc, id })); deliver(col); return Promise.resolve(); },
        change(col, id, fn) { const cur = (cols[col] || {})[id]; return this.put(col, id, fn(cur ? JSON.parse(JSON.stringify(cur)) : {})); },
        remove(col, id) { delete (cols[col] || {})[id]; deliver(col); },
        watch(col, f) { const x = { col, f, on: true }; subs.push(x); mine.push(x); setTimeout(() => f(list(col)), 1); },
        disconnect() { mine.forEach((x) => (x.on = false)); },
      };
    },
  };
}
// ---- a phone: its own copy of the whole game, its own hero, its own timers
function phone(world, id, name, trap) {
  const timers = [];
  const c = { console, Math, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, URLSearchParams, Promise,
    Date: class extends Date { static now() { return CLOCK; } },
    setInterval: (f) => { timers.push(f); return timers.length; }, clearInterval: (i) => { timers[i - 1] = null; }, setTimeout: () => 0 };
  vm.createContext(c);
  for (const s of SRC) vm.runInContext(s, c);
  c.DGAMES.handles = (s, ch) => (ch === "dash" || ch === "trigger") && s.dungeon?.room?.type === "trap";
  const G = c.G, s = G.newSave(id, name, "nord");
  s.level = 12; s.hpBonus = 400; G.setHealth(s, G.maxHealth(s)); s.gold = 500;
  s.dungeon = { place: "Embershard Mine", theme: "cave", tier: 2, run: RUN, cstep: 1, rows: [[{ type: "trap", links: [] }]], row: 0, col: 0, room: { type: "trap", trap }, found: [], gold: 0 };
  const store = world.client(), acts = [];
  const P = { c, s, store, acts, id, tick: () => timers.forEach((f) => f && f()) };
  c.PTRAPS.mount({ S: () => s, runs: () => world.list("runs"), Store: store, toast: () => {}, persist: () => {}, act: (ch) => acts.push(ch) });
  return P;
}
const RUN = "run-net-1";
const MEM = [{ id: "A", name: "Alfa" }, { id: "B", name: "Beta" }, { id: "C", name: "Ceta" }];

(async () => {
  // 1. three phones, one trap: everyone plays the same seed, results line up everywhere
  const world = net();
  world.client().put("runs", RUN, { id: RUN, leader: "A", members: MEM });
  await tick();
  const A = phone(world, "A", "Alfa", "a swinging blade"), B = phone(world, "B", "Beta", "a rockfall"), C = phone(world, "C", "Ceta", "a jet of steam");
  B.s.follower = { id: "lydia", hp: 300, ts: B.c.G.now() }; C.s.follower = { id: "lydia", hp: 300, ts: C.c.G.now() };
  await tick();
  let leaderActs = [];
  A.c.PTRAPS.start(A.s, "trigger", (ch) => leaderActs.push(ch));
  await tick(); await tick();
  const main = world.list("ptrap").find((d) => d.type === "main");
  ok(main && main.seed > 0, "the trap goes out");
  for (const P of [A, B, C]) ok(P.c.PTRAPS.played.includes(main.gid), `${P.id} gets the trap to play`);
  // the same seed builds the same trap on every phone (own copy of the code)
  const boards = [A, B, C].map((P) => JSON.stringify(P.c.DGAMES.make("trigger", main.seed, { d: 0.4 }).plate));
  ok(boards[0] === boards[1] && boards[1] === boards[2], "same seed → same trigger stone on every phone");

  // 2. Beta's phone reloads mid-trap (before finishing): it gets the same trap again, still open
  B.store.disconnect();
  const B2 = phone(world, "B", "Beta", "a rockfall"); B2.s = B.s; B2.c.PTRAPS.mount({ S: () => B.s, runs: () => world.list("runs"), Store: B2.store, toast: () => {}, persist: () => {}, act: () => {} });
  await tick(); await tick();
  ok(B2.c.PTRAPS.played.includes(main.gid), "Beta reconnects mid-trap and gets the same trap again");
  // A passes, Beta fails (from the reloaded phone), Ceta never answers
  const res = (P, s, choice) => P.store.put("ptrap", `pr-${main.gid}-${s.id}`, P.c.PTRAPS.resultDoc(main, s, choice));
  res(A, A.s, "trigger@0.900"); res(B2, B.s, "trigger@0.200");
  await tick(); await tick();
  // and reloads again after posting: must NOT play it a second time
  B2.store.disconnect();
  const B3 = phone(world, "B", "Beta", "a rockfall"); B3.c.PTRAPS.mount({ S: () => B.s, runs: () => world.list("runs"), Store: B3.store, toast: () => {}, persist: () => {}, act: () => {} });
  await tick(); await tick();
  ok(!B3.c.PTRAPS.played.includes(main.gid), "after posting, a reload doesn't replay the trap");

  // 3. the leader's phone drops mid-trap and comes back: it picks up closing the trap
  A.store.disconnect();
  const A2 = phone(world, "A", "Alfa", "a swinging blade"); A2.s = A.s;
  A2.c.PTRAPS.mount({ S: () => A.s, runs: () => world.list("runs"), Store: A2.store, toast: () => {}, persist: () => {}, act: (ch) => leaderActs.push("re:" + ch) });
  await tick(); await tick();
  ok(A2.c.PTRAPS.waiting && A2.c.PTRAPS.waiting.gid === main.gid, "the reloaded leader picks the open trap back up");
  ok(!A2.c.PTRAPS.played.includes(main.gid), "…and doesn't play it again (its result is in)");
  CLOCK = main.deadline + 100;   // Ceta never answers: time's up
  A2.tick(); await tick(); await tick(); await tick();
  const done = world.list("ptrap").find((d) => d.type === "main" && d.done);
  ok(done, "the trap gets closed after the leader's reconnect");
  ok(leaderActs.length === 1 && leaderActs[0] === "re:trigger@0.900", "the party choice is made exactly once: " + leaderActs.join(","));
  ok(done.out.A.q === 0.9 && done.out.B.q === 0.2 && done.out.C.late, "results: A through, B caught, C late");

  // 4. every phone sees the same outcome, and each hero's own hit is the same no matter which phone works it out
  const run = world.list("runs")[0];
  ok(run.ptrap && run.ptrap[0] && run.ptrap[0].trap === main.trap, "run record carries the outcome and the trap");
  const docs = world.list("ptrap");
  const choices = [A2, B3, C].map((P) => P.c.PTRAPS.mine(P === A2 ? A.s : P === B3 ? B.s : C.s, run, leaderActs[0].slice(3), docs));
  ok(choices.join(" ") === "trigger@0.900 trigger@0.200 trigger@0.000", "each phone swaps in its own result: " + choices.join(" "));
  // the same hero, worked out on two different phones (two copies of the game): identical health, text and stings
  const twin = (P, P2, s, choice) => {
    const s1 = JSON.parse(JSON.stringify(s)), s2 = JSON.parse(JSON.stringify(s));
    const mineC = P.c.PTRAPS.mine(s1, run, choice, docs); P2.c.PTRAPS.mine(s2, run, choice, docs);
    const r1 = P.c.DUNGEONS.act(s1, mineC), r2 = P2.c.DUNGEONS.act(s2, mineC);
    return [r1.text.replace(/ Whoever didn't left \d+ gold behind\./, ""), r2.text.replace(/ Whoever didn't left \d+ gold behind\./, ""), P.c.G.curHealth(s1), P2.c.G.curHealth(s2), JSON.stringify(s1.fx), JSON.stringify(s2.fx)];
  };
  const [tb1, tb2, hb1, hb2, fb1, fb2] = twin(B3, C, B.s, "trigger@0.900");
  ok(tb1 === tb2 && hb1 === hb2 && fb1 === fb2, `Beta's hit is the same on any phone: ${tb1.slice(0, 90)}`);
  ok(/bleeding/.test(tb1) && !/takes a dent|gear takes the blow/.test(tb1), "Beta's sting comes from the leader's trap (a blade: bleeding), not Beta's own room (a rockfall)");
  const [tc1, tc2, hc1, hc2] = twin(C, A2, C.s, "trigger@0.900");
  ok(tc1 === tc2 && hc1 === hc2, `Ceta's hit is the same on any phone: ${tc1.slice(0, 90)}`);
  // followers: the same roll on every phone
  ok(JSON.stringify(A2.c.PTRAPS.folRoll(B.s, main.gid)) === JSON.stringify(C.c.PTRAPS.folRoll(B.s, main.gid)), "Beta's follower roll is the same on every phone");
  ok(JSON.stringify(done.fol.B) === JSON.stringify(B3.c.PTRAPS.folRoll(B.s, main.gid)), "the card's follower roll matches Beta's own phone");

  // 5. chest: the leader's result is what every member gets (no dice of their own)
  for (const want of ["pick@1", "pick@0"]) {
    const outs = [A2, B3, C].map((P) => { const s = JSON.parse(JSON.stringify(B.s)); s.dungeon.room = { type: "treasure", tier: 2, tries: 1 }; return /^Click/.test(P.c.DUNGEONS.act(s, want).text); });
    ok(outs.every((x) => x === (want === "pick@1")), `${want}: every phone gets the same lock result ${outs}`);
  }

  // 6. live cursor across phones, with the sender reloading mid-game
  const lworld = net();
  let tA = 0, tB = 7000, tC = 123456;
  const mk = (P, uid, name, clk) => { const L = P.c.LIVECURSOR.make({ uid, name, now: clk, wall: () => CLOCK }); L.mount({ Store: lworld.client(), uid: () => uid, name: () => name }); return L; };
  const lA = mk(A2, "A", "Alfa", () => tA), lB = mk(B3, "B", "Beta", () => tB), lC = mk(C, "C", "Ceta", () => tC);
  const adv = (ms) => { tA += ms; tB += ms; tC += ms; CLOCK += ms; };
  await tick();
  lA.send(null, "dg-x");
  for (let i = 0; i <= 12; i++) { lA.feed(i / 12, 0.3, 0); adv(83); lA.flush(); await tick(); }
  adv(250);
  const b1 = lB.track("dg-x").at(tB), c1 = lC.track("dg-x").at(tC);
  ok(b1 && c1 && Math.abs(b1.x - c1.x) < 0.02 && b1.x > 0.85, `both watchers see Alfa's cursor at the same spot (${b1?.x.toFixed(2)}, ${c1?.x.toFixed(2)})`);
  // Alfa's phone reloads: a new stream, its clock starts over at 0
  const lA2 = mk(A2, "A", "Alfa", () => tA - 999999);
  lA2.send(null, "dg-x");
  for (let i = 0; i <= 12; i++) { lA2.feed(0.1, i / 12, 1); adv(83); lA2.flush(); await tick(); }
  adv(250);
  const b2 = lB.track("dg-x").at(tB), c2 = lC.track("dg-x").at(tC);
  ok(b2 && Math.abs(b2.x - 0.1) < 0.02 && b2.y > 0.85 && b2.down, `after Alfa reloads the watchers follow the new stream (${b2?.x.toFixed(2)}, ${b2?.y.toFixed(2)})`);
  ok(c2 && Math.abs(c2.y - b2.y) < 0.02, "…on both watcher phones");
  // a watcher who reconnects picks the cursor up from the stored record at once
  const lB2 = mk(B3, "B", "Beta", () => tB); await tick(); await tick();
  const b3 = lB2.track("dg-x").at(tB + 500);
  ok(b3 && Math.abs(b3.x - 0.1) < 0.02, "a reconnecting watcher sees the cursor straight away");

  console.log(`partytraps net: ${n - fails}/${n} ok`);
  process.exit(fails ? 1 : 0);
})();
