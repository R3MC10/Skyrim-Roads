// Party traps (partytraps.js) + live cursor (livecursor.js): a 3-hero party where everyone plays the trap, the ones
// who fail take their own hit (each trap in its own way), stragglers count as caught, followers roll by their stats,
// only the leader opens the chest and members see the same lock result, and watchers get the leader's cursor stream.
// node test_partytraps.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const timers = [];
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, URLSearchParams, Promise,
  setInterval: (f) => { timers.push(f); return timers.length; }, clearInterval: () => {}, setTimeout: (f) => 0 };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "perkfx.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "dungeongames.js", "livecursor.js", "partytraps.js", "lootvote.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/gm, "var $1 ="), c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { PTRAPS: PT, LIVECURSOR: LC, DUNGEONS, DGAMES: DG, G, D, PFX, TOWNS } = c;
ok(PT && LC, "modules load");

// ---- a tiny shared world: one store all "phones" see (like the p2p/server sync)
function makeStore() {
  const cols = {}, watchers = {};
  const list = (col) => Object.values(cols[col] || {});
  const notify = (col) => (watchers[col] || []).forEach((f) => f(list(col)));
  return {
    online: true, cols,
    put(col, id, doc) { (cols[col] = cols[col] || {})[id] = JSON.parse(JSON.stringify({ ...doc, id })); notify(col); return Promise.resolve(); },
    change(col, id, fn) { const cur = (cols[col] || {})[id]; return this.put(col, id, fn(cur ? JSON.parse(JSON.stringify(cur)) : {})); },
    remove(col, id) { delete (cols[col] || {})[id]; notify(col); },
    watch(col, f) { (watchers[col] = watchers[col] || []).push(f); f(list(col)); },
    list,
  };
}

// ---- three heroes in the same trap room of a party run
const RUN = "run-test-1";
function hero(id, name, trap) {
  const s = G.newSave(id, name, "nord"); s.level = 12; s.hpBonus = 400; G.setHealth(s, G.maxHealth(s)); s.gold = 500;
  s.dungeon = { place: "Embershard Mine", theme: "cave", tier: 2, run: RUN, cstep: 3, rows: [[{ type: "trap", links: [] }]], row: 0, col: 0, room: { type: "trap", trap }, found: [], gold: 0 };
  return s;
}
const members = [{ id: "A", name: "Alfa" }, { id: "B", name: "Beta" }, { id: "C", name: "Ceta" }];

// 1. what each trap does
ok(PT.kindOf("a volley of poisoned darts").k === "poison", "darts poison");
ok(PT.kindOf("a swinging blade").k === "bleed" && PT.kindOf("a bear trap").k === "bleed", "blades bleed");
ok(PT.kindOf("a jet of steam").k === "burn" && PT.kindOf("a fire rune").k === "burn", "fire burns");
ok(PT.kindOf("an oil slick").k === "gold", "oil spills gold");
ok(PT.kindOf("a rockfall").k === "dent", "rocks dent");
ok(PT.stacksFor(0.1) === 2 && PT.stacksFor(0.4) === 1 && PT.stacksFor(0.1, "w") === 1, "stacks: bad miss 2, near miss 1, warned one less");

// 2. the whole round on the leader's screen (no DOM): start → everyone's results arrive → close → party choice
const TRAP = "a volley of poisoned darts";
const A = hero("A", "Alfa", TRAP), B = hero("B", "Beta", TRAP), Cc = hero("C", "Ceta", TRAP);
B.follower = { id: "lydia", hp: TOWNS.followerMax(B, "lydia"), ts: G.now() };
B.perks = { ...(B.perks || {}) };
const store = makeStore();
store.put("runs", RUN, { id: RUN, leader: "A", members: members.map((m) => ({ ...m })) });
let leaderChoice = null;
DG.handles = (s, ch) => (ch === "dash" || ch === "trigger") && s.dungeon.room.type === "trap";   // no screen in node: pretend the mini-games are on
PT.mount({ S: () => A, runs: () => store.list("runs"), Store: store, toast: () => {}, persist: () => {} });
ok(PT.wants(A, "dash") && PT.wants(A, "trigger"), "leader of a 3-hero run: the trap goes to the whole party");
ok(!PT.wants(A, "walk"), "'just push through' is still the leader's own choice");
ok(!PT.wants(B, "dash"), "a member can't spring it");
store.online = false; ok(!PT.wants(A, "dash"), "offline: the old single-player game"); store.online = true;
PT.start(A, "dash", (ch) => { leaderChoice = ch; });
const main = store.list("ptrap").find((d) => d.type === "main");
ok(main && main.members.length === 3 && main.kind === "dash" && main.step === 2 && main.deadline > main.start, "the trap record goes out to all 3");
ok(PT.waiting && !leaderChoice, "leader waits for the others");

// each hero plays the SAME game (same seed) sized to their own skills; here: A plays it well, B and C don't
const st = DG.make("dash", main.seed, { d: 0.5 }), st2 = DG.make("dash", main.seed, { d: 0.5 });
ok(JSON.stringify(st.blades) === JSON.stringify(st2.blades), "same seed, same blades for everyone");
store.put("ptrap", "pr-" + main.gid + "-A", PT.resultDoc(main, A, "dash@0.900"));
ok(PT.waiting && !leaderChoice, "still waiting for B and C");
store.put("ptrap", "pr-" + main.gid + "-B", PT.resultDoc(main, B, "dash@0.100"));
ok(!PT.ready(main, PT.resultsOf(store.list("ptrap"), main.gid), Date.now()), "not ready while C is still playing");
ok(PT.ready(main, PT.resultsOf(store.list("ptrap"), main.gid), main.deadline + 1), "ready once the time is up");
// C put the phone away: the leader's timer runs out
const realNow = Date.now; c.Date.now = () => main.deadline + 50;
timers.forEach((f) => f());
c.Date.now = realNow;
// (check is async: give the promises a moment)
setTimeout(() => {
  const done = store.list("ptrap").find((d) => d.type === "main" && d.done);
  ok(done, "the leader closed the trap");
  ok(done && done.out.A.q >= 0.5 && done.out.B.q < 0.5 && done.out.C.q === 0 && done.out.C.late, "A through, B caught, C ran out of time");
  ok(leaderChoice === "dash@0.900", "leader's party choice is their own result: " + leaderChoice);
  const run = store.list("runs")[0];
  ok(run.ptrap && run.ptrap[2] && run.ptrap[2].out.B.q === 0.1, "outcome saved on the run record too");
  ok(done && done.fol.B && done.fol.B.name === "Lydia", "B's follower rolled with B's result");
  ok(!PT.waiting, "no longer waiting");

  // 3. each member replays the leader's choice and gets their OWN result swapped in
  const docs = store.list("ptrap");
  const cB = PT.mine(B, run, leaderChoice, docs), cC = PT.mine(Cc, run, leaderChoice, docs), cA = PT.mine(A, run, leaderChoice, docs);
  ok(cA === "dash@0.900" && cB === "dash@0.100" && cC === "dash@0.000", `own results swapped in: ${cA} ${cB} ${cC}`);
  ok(PT.mine(B, run, leaderChoice, []) === "dash@0.100", "from the run record when the trap doc is missing");
  ok(PT.mine(B, run, "walk", docs) === "walk", "'push through' isn't swapped");
  { const s = hero("B", "Beta", "a rockfall"); PT.mine(s, run, leaderChoice, docs); ok(s.dungeon.room.trap === TRAP, "member gets the same trap the card named"); }
  const hA = G.curHealth(A), hB = G.curHealth(B), hC = G.curHealth(Cc);
  const rA = DUNGEONS.act(A, cA), rB = DUNGEONS.act(B, cB), rC = DUNGEONS.act(Cc, cC);
  ok(G.curHealth(A) === hA && !rA.trap, "A got through untouched: " + rA.text);
  ok(G.curHealth(B) < hB && rB.trap && /poisoned: ×2/.test(rB.text), "B is hit and poisoned ×2 (bad miss): " + rB.text);
  ok(G.curHealth(Cc) < hC && /poisoned/.test(rC.text), "C (never finished) is caught too: " + rC.text);
  const pB = (B.fx || []).find((f) => f.name === "Trap poison");
  ok(pB && pB.key === "max:health" && pB.mag === -12, "poison really lowers max health (−12)");
  ok(!(A.fx || []).some((f) => f.name === "Trap poison"), "A has no poison");
  const maxBefore = G.maxHealth(B); B.fx = B.fx.filter((f) => f !== pB); ok(G.maxHealth(B) > maxBefore, "the poison fx shows in max health");

  // 4. every kind of sting, for real
  const fresh = (trap) => { const s = hero("X", "X", trap); return s; };
  { const s = fresh("a swinging blade"), h = G.curHealth(s), txt = PT.sting(s, "a swinging blade", 0.1); const f = s.fx.find((x) => x.name === "Bleeding");
    ok(G.curHealth(s) < h && f && f.key === "max:stamina" && f.mag === -20 && f.stk === 2, "blades: bleeding ×2, −20 stamina: " + txt);
    PT.sting(s, "a swinging blade", 0.3); PT.sting(s, "a swinging blade", 0.3); ok(s.fx.filter((x) => x.name === "Bleeding").length === 1 && s.fx.find((x) => x.name === "Bleeding").stk === 3, "bleeding stacks up to 3"); }
  { const s = fresh("a jet of steam"), h = G.curHealth(s); PT.sting(s, "a jet of steam", 0.3); ok(G.curHealth(s) < h, "steam burns"); }
  { const s = fresh("an oil slick"); s.gold = 1000; const txt = PT.sting(s, "an oil slick", 0.3); ok(s.gold < 1000 && s.gold >= 700, "oil spills gold: " + txt); }
  { const s = fresh("an oil slick"); s.gold = 0; ok(PT.sting(s, "an oil slick", 0.3) === "" && s.gold === 0, "no gold, nothing to spill"); }
  { const s = fresh("a rockfall"); const id = G.give(s, "iron_armor"); G.equip(s, id); const row = s.inv.find((r) => r.id === id); row.temper = 3;
    const txt = PT.sting(s, "a rockfall", 0.1); ok(row.temper === 1, "rockfall dents worn armour (−2): " + txt); }
  { const s = fresh("a rockfall"), h = G.curHealth(s); PT.sting(s, "a rockfall", 0.3); ok(G.curHealth(s) < h, "nothing to dent: it hurts instead"); }
  { const s = fresh("a swinging blade"); G.setHealth(s, 2); PT.sting(s, "a swinging blade", 0.0); ok(G.curHealth(s) >= 1, "a sting never kills"); }

  // 5. perks with real effects
  { const s = fresh("an oil slick"); s.gold = 1000; s.perks = { ...(s.perks || {}), trap_tinkerer: 1 };
    ok(PFX.num(s, "trapsting") > 0 && PFX.num(s, "dgdash") > 0, "Trap Tinkerer gives trapsting + easier dash");
    PT.sting(s, "an oil slick", 0.1); ok(s.gold === 1000, "Trap Tinkerer: purse stays shut"); }
  { const s = fresh("a rockfall"); s.perks = { ...(s.perks || {}), trap_tinkerer: 1 }; const id = G.give(s, "iron_armor"); G.equip(s, id); const row = s.inv.find((r) => r.id === id); row.temper = 3;
    PT.sting(s, "a rockfall", 0.1); ok(row.temper === 3, "Trap Tinkerer: armour not dented"); }
  { // Call Out the Danger: a clean pass softens everyone else's hit
    const m2 = PT.newTrap({ gid: "g2", run: RUN, step: 2, kind: "trigger", seed: 5, trap: TRAP, leader: "A", members });
    const sA = hero("A", "Alfa", TRAP); sA.perks = { ...(sA.perks || {}), call_the_danger: 1 };
    ok(PFX.num(sA, "ptwarn") > 0, "Call Out the Danger gives ptwarn");
    const res = [PT.resultDoc(m2, sA, "trigger@0.950"), PT.resultDoc(m2, hero("B", "Beta", TRAP), "trigger@0.100"), PT.resultDoc(m2, hero("C", "Ceta", TRAP), "trigger@0.600")];
    const r = PT.resolve(m2, res);
    ok(r.warners.includes("A") && r.out.B.w && !r.out.A.w && !r.out.C.w, "A warned: B (caught) gets it softer, C (through) needs nothing");
    ok(PT.choiceFor("trigger", r.out.B) === "trigger@0.100w", "warned choice carries the flag");
    let soft = 0, hard = 0;
    for (let k = 0; k < 40; k++) {
      const s1 = hero("B", "Beta", TRAP), s2 = hero("B", "Beta", TRAP), h1 = G.curHealth(s1), h2 = G.curHealth(s2);
      DUNGEONS.act(s1, "trigger@0.100w"); DUNGEONS.act(s2, "trigger@0.100");
      soft += h1 - G.curHealth(s1); hard += h2 - G.curHealth(s2);
      if (k === 0) { const f1 = s1.fx.find((f) => f.name === "Trap poison"), f2 = s2.fx.find((f) => f.name === "Trap poison"); ok(f1.stk === 1 && f2.stk === 2, "warned: one stack less poison"); }
    }
    ok(soft < hard, `warned hits are softer on average (${Math.round(soft)} vs ${Math.round(hard)})`);
    const noWarn = PT.resolve(m2, [PT.resultDoc(m2, hero("A", "Alfa", TRAP), "trigger@0.950"), res[1], res[2]]);
    ok(!noWarn.warners.length && !noWarn.out.B.w, "no perk, no warning");
  }

  // 6. followers roll by their stats, the same on every phone, and get knocked down (never die)
  const fr = PT.folRoll(B, "g-fixed"), fr2 = PT.folRoll(B, "g-fixed");
  ok(fr && fr.name === "Lydia" && fr.pass === fr2.pass, "follower roll is deterministic");
  let pass = 0; for (let k = 0; k < 400; k++) if (PT.folRoll(B, "g" + k).pass) pass++;
  ok(pass > 120 && pass < 340, "followers pass some, fail some: " + pass + "/400");
  const mx = TOWNS.followerMax(B, "lydia"); B.follower.hp = mx;
  const msg = PT.folApply(B, { name: "Lydia", pass: false });
  ok(B.follower.hp < mx && B.follower.hp >= 1 && /knocked down/.test(msg), "caught follower knocked down: " + msg);
  for (let k = 0; k < 10; k++) PT.folApply(B, { name: "Lydia", pass: false });
  ok(B.follower.hp >= 1, "never below 1 (no deaths)");
  ok(PT.folApply(B, { name: "Lydia", pass: true }) === "", "a follower who got through is fine");

  // 7. results card text
  const html = PT.resultsHTML(done, "B");
  ok(/Alfa/.test(html) && /Beta \(you\)/.test(html) && /Ceta/.test(html), "results card lists everyone");
  ok(/Got through/.test(html) && /Caught: poisoned/.test(html) && /ran out of time/.test(html), "card: who got through, who got hit with what, who timed out");
  ok(/It caught you: poisoned/.test(html), "card tells B it caught them");

  // 8. chests: only the leader opens, members see the same lock result
  const chest = () => { const s = hero("M", "M", ""); s.dungeon.room = { type: "treasure", tier: 1, tries: 3 }; s.dungeon.rows[0][0].type = "treasure"; return s; };
  let opened = 0, snapped = 0;
  for (let k = 0; k < 20; k++) { const s1 = chest(), s2 = chest(); s1.skills.Lockpicking = 5; s2.skills.Lockpicking = 5;
    if (/^Click/.test(DUNGEONS.act(s1, "pick@1").text)) opened++; if (/^Snap|last pick/.test(DUNGEONS.act(s2, "pick@0").text)) snapped++; }
  ok(opened === 20 && snapped === 20, `member replays of the leader's lock always match (${opened}/20 opened, ${snapped}/20 snapped)`);

  // 9. live cursor: the leader streams, two watchers see the same named arrow glide
  const lstore = makeStore();
  let tA = 1000, tB = 5000, tC = 90000;   // every phone has its own clock
  const lcA = LC.make({ Store: lstore, uid: "A", name: "Alfa", now: () => tA });
  const lcB = LC.make({ Store: lstore, uid: "B", name: "Beta", now: () => tB });
  const lcC = LC.make({ Store: lstore, uid: "C", name: "Ceta", now: () => tC });
  lcA.mount({ Store: lstore, uid: () => "A", name: () => "Alfa" }); lcB.mount({ Store: lstore, uid: () => "B", name: () => "Beta" }); lcC.mount({ Store: lstore, uid: () => "C", name: () => "Ceta" });
  const ch = "dg-chest1";
  lcA.send(null, ch);
  ok(lcA.sending === ch, "leader is streaming");
  let sends = 0;
  for (let i = 0; i <= 24; i++) {   // 2 s of moving left → right at 12 sends a second
    const step = (k) => { tA += k; tB += k; tC += k; };
    lcA.feed(i / 24, 0.5, i > 12); step(42); lcA.feed((i + 0.5) / 24, 0.5, i > 12); step(41);
    if (lcA.flush()) sends++;
  }
  ok(sends >= 20 && sends <= 26, "~12 updates a second: " + sends + " in 2 s");
  const doc = lstore.list("lcur")[0];
  ok(doc && doc.ch === ch && doc.name === "Alfa" && doc.pts.length <= 6, "one small record per player, latest few samples");
  const qB = lcB.track(ch).at(tB), qC = lcC.track(ch).at(tC);
  ok(qB && qC && Math.abs(qB.x - qC.x) < 0.02, `both watchers see the cursor in the same place (${qB && qB.x.toFixed(2)} / ${qC && qC.x.toFixed(2)})`);
  ok(qB.x > 0.8 && qB.x < 1.0 && qB.down, "watcher is ~0.2 s behind, button held: x=" + qB.x.toFixed(3));
  ok(!lcA.track(ch).size, "the sender doesn't watch itself");
  // smooth: between two samples the watcher slides instead of jumping
  const xs = []; for (let k = 0; k < 10; k++) xs.push(lcB.track(ch).at(tB - 150 + k * 10).x);
  ok(xs.every((x, i) => i === 0 || x >= xs[i - 1] - 1e-9) && new Set(xs.map((x) => x.toFixed(4))).size > 5, "interpolated: smooth glide");
  // resting: the arrow stays put
  tB += 5000; const rest = lcB.track(ch).at(tB); ok(rest && Math.abs(rest.x - 1) < 0.03, "resting pointer stays visible where it was");
  // stop: the last bits go out, no more sending
  lcA.stop(); ok(lcA.sending === null, "stop() ends the stream");
  // normalising: a finger just below the picture stays just below it on another screen size
  const [nx, ny] = LC.norm({ left: 10, top: 20, width: 300, height: 200 }, 160, 250), [px, py] = LC.place({ left: 0, top: 0, width: 600, height: 400 }, nx, ny);
  ok(nx === 0.5 && ny === 1.15 && px === 300 && Math.abs(py - 460) < 1e-9, "normalised coordinates map across screen sizes");
  ok(LC.norm({ left: 0, top: 0, width: 100, height: 100 }, 900, -900)[0] === 1.25, "far outside is clamped");

  console.log(`partytraps: ${n - fails}/${n} ok`);
  process.exit(fails ? 1 : 0);
}, 50);
