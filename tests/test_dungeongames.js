// Dungeon mini-games (dungeongames.js): deterministic replay from a seed + input events, bots that play well pass,
// doing nothing fails, perks ease the games, and the quality string drives the room's outcome. node test_dungeongames.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, URLSearchParams };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "perkfx.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "dungeongames.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { DGAMES: DG, DUNGEONS, G } = c;
const TICK = DG.TICK;
const snap = (st) => JSON.stringify(st, (k, v) => (k === "ev" || k === "_ei" ? undefined : v));

// ---- a tiny seeded random for the test's own "players"
function prng(seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }

/* play a game the way the live screen does: inputs land between ticks, at the current tick */
function playLive(kind, seed, o, brain) {
  const st = DG.make(kind, seed, o);
  let guard = 0;
  while (!st.over && guard++ < 20000) { for (const ev of brain(st) || []) DG.input(st, [st.tick, ...ev]); if (!st.over) DG.step(st); }
  return st;
}
const randomBrain = (kind, r) => (st) => {
  if (r() > 0.12) return [];
  if (kind === "dash" || kind === "sneak") return [[r() < 0.5 ? "d" : "u"]];
  if (kind === "trigger") return [["tap", Math.floor(r() * 20)]];
  if (kind === "smash") return [["tap"]];
  if (kind === "flee") return [[r() < 0.5 ? "L" : "R"]];
  return [["m", Math.floor(r() * 16), Math.floor(r() * 10)]];
};

// 1. replay: same seed + same events = the same game, tick for tick, also when fed in chunks like a watcher
for (const kind of DG.KINDS) {
  let same = 0, chunked = 0, total = 0;
  for (let k = 0; k < 25; k++) {
    const seed = 1000 + k * 7919, o = { d: (k % 5) / 5, ease: (k % 3) * 0.15, hl: 0 };
    const live = playLive(kind, seed, o, randomBrain(kind, prng(seed)));
    const ev = live.ev.map((e) => e.slice());
    const re = DG.replay(kind, seed, o, ev);
    total++;
    if (re.q === live.q && re.fl === live.fl && re.endTick === live.endTick && snap(re) === snap(live)) same++;
    // a watcher: the events arrive bit by bit and it catches up in uneven steps
    const w = DG.make(kind, seed, o), r = prng(seed + 1);
    let known = 0;
    while (!w.over && known <= live.endTick + 1) { known = Math.min(live.endTick + 1, known + 1 + Math.floor(r() * 25)); DG.advance(w, ev.filter((e) => e[0] < known), known); if (known >= live.endTick + 1) break; }
    if (w.over && w.q === live.q && snap(w) === snap(live)) chunked++;
  }
  ok(same === total, `${kind}: replay matches live play ${same}/${total}`);
  ok(chunked === total, `${kind}: chunked (watcher) replay matches ${chunked}/${total}`);
}
// different seeds give different games
ok(snap(DG.make("trigger", 1, { d: 0.5 })) !== snap(DG.make("trigger", 2, { d: 0.5 })), "seeds differ");

// 2. bots: a careful player passes, doing nothing fails
const brains = {
  dash: (st) => {   // move only if the next ~0.6 s of walking stays clear of swinging blades
    const t = st.tick * TICK; let safe = true;
    for (let k = 1; k <= 18 && safe; k++) { const x = st.x + 0.2 * k * TICK; for (const b of st.blades) if (Math.abs(x - b.x) < 0.05 && Math.abs(c.Math.sin((2 * Math.PI * (t + k * TICK + b.ph)) / b.P)) < b.dz + 0.05) safe = false; }
    const inZone = st.blades.some((b) => Math.abs(st.x - b.x) < 0.05);
    const want = safe || inZone;
    return want !== st.hold ? [[want ? "d" : "u"]] : [];
  },
  trigger: (st) => (st.tick === 75 ? [["tap", st.plate]] : []),
  smash: (st) => (st.cd <= 0 && Math.abs(DG.make && st.c - (0.5 + 0.48 * Math.sin((2 * Math.PI * st.tick * TICK) / st.P + st.ph))) < st.w * 0.6 ? [["tap"]] : []),
  sneak: (st) => { const ph = st.phases.find((p) => st.tick * TICK >= p[1] && st.tick * TICK < p[2])?.[0] || "away"; const want = ph === "away"; return want !== st.hold ? [[want ? "d" : "u"]] : []; },
  flee: (st) => (st.tick % 4 === 0 ? [[(st.tick / 4) % 2 ? "L" : "R"]] : []),
  search: (st) => {   // sweep the floor row by row, staying away from the rustling nest
    const i = st.tick; if (i % 2) return [];
    const k = i / 2, y = Math.floor(k / 16) * 2, x = (Math.floor(k / 16) % 2) ? 15 - (k % 16) : k % 16;
    if (y >= 10) return [];
    if (st.nest && Math.abs(x - st.nest.x - 0.5) <= 3 && Math.abs(y - st.nest.y - 0.5) <= 3) return [];
    return [["m", x, y]];
  },
};
for (const kind of DG.KINDS) {
  let pass = 0, idle = 0; const N = 60;
  for (let k = 0; k < N; k++) {
    const o = { d: 0.5, ease: 0, hl: 0 };
    if (playLive(kind, 50 + k, o, brains[kind]).q >= 0.5) pass++;
    if (playLive(kind, 50 + k, o, () => []).q >= 0.5) idle++;
  }
  console.log(`  ${kind}: careful bot ${pass}/${N}, idle ${idle}/${N}`);
  ok(pass >= N * (kind === "search" ? 0.5 : 0.75), `${kind}: a careful player passes at middling odds (${pass}/${N})`);
  ok(idle === 0, `${kind}: doing nothing never passes (${idle}/${N})`);
}
// games end within their time limit (5-15 seconds)
for (const kind of DG.KINDS) { const st = playLive(kind, 9, { d: 0.5 }, () => []); ok(st.over && st.endTick <= DG.LIMIT[kind] * DG.HZ && DG.LIMIT[kind] >= 5 && DG.LIMIT[kind] <= 15, `${kind} ends by ${DG.LIMIT[kind]}s`); }

// 3. harder odds make harder games; perks ease them
{ const a = DG.make("flee", 3, { d: 0.2 }), b = DG.make("flee", 3, { d: 0.8 }), e = DG.make("flee", 3, { d: 0.8, ease: 0.25 });
  ok(a.need < b.need && e.need < b.need, `flee: steps needed ${a.need} < ${b.need}, Sprinter ${e.need}`); }
{ const a = DG.make("smash", 3, { d: 0.2 }), b = DG.make("smash", 3, { d: 0.8 }), e = DG.make("smash", 3, { d: 0.8, ease: 0.3 });
  ok(a.w > b.w && e.w > b.w, `smash: bright zone ${a.w.toFixed(3)} > ${b.w.toFixed(3)}, Lid Breaker ${e.w.toFixed(3)}`); }
{ const b = DG.make("search", 3, { d: 0.2 }), e = DG.make("search", 3, { d: 0.2, ease: 0.3 }); ok(e.rad > b.rad, "Keen Searcher sweeps wider"); }
{ const b = DG.make("trigger", 3, { d: 0.6 }), e = DG.make("trigger", 3, { d: 0.6, ease: 0.3 }); ok(e.maxWrong > b.maxWrong && e.gp < b.gp, "Trap Sense: more guesses, glints more often"); }
{ const s = G.newSave("P", "P", "nord"); s.perks = s.perks || {};
  const o0 = DG.optsFor(s, "dash"); s.perks.blade_dancer = 1; const o1 = DG.optsFor(s, "dash");
  ok(o0.ease === 0 && o1.ease === 0.3, `Blade Dancer gives the dash game its ease (${o0.ease} -> ${o1.ease})`);
  for (const id of ["trap_sense", "patient_shadow", "lid_breaker", "sprinter", "keen_searcher", "blade_dancer"]) ok(c.PERKS.BY_ID[id], "perk in a tree: " + id);
  s.skills.Acrobatics.lvl = 90; ok(DG.optsFor(s, "dash").d < o0.d, "more Acrobatics, easier dash");
  s.perks.light_foot = 1; ok(DG.optsFor(s, "trigger").hl === 1, "Light Foot shows the plate"); }

// 4. the quality rides on the choice and decides the room
{ ok(JSON.stringify(DUNGEONS.parseChoice("dash@0.820")) === JSON.stringify({ c: "dash", q: 0.82, fl: "" }), "parse dash@0.820");
  ok(DUNGEONS.parseChoice("search@0.333n").fl === "n" && DUNGEONS.parseChoice("fight").q === null, "flags; plain choices roll");
  const st = DG.make("smash", 1, {}); st.q = 0.5; st.fl = ""; ok(DG.choiceOf(st) === "smash@0.500", "choice string");
  const room = (type, extra = {}) => { const s = G.newSave("R", "R", "nord"); s.level = 10; s.hpBonus = 500; G.setHealth(s, G.maxHealth(s)); s.dungeon = { place: "Embershard Mine", theme: "cave", tier: 1, rows: [[{ type, links: [] }]], row: 0, col: 0, room: { type, ...extra }, found: [], gold: 0 }; return s; };
  let s = room("trap", { trap: "a swinging blade" }); let hp = G.curHealth(s); let r = DUNGEONS.act(s, "dash@0.950");
  ok(G.curHealth(s) === hp && /dive past/.test(r.text) && !s.dungeon.room, "dash pass: no damage");
  s = room("trap", { trap: "a swinging blade" }); hp = G.curHealth(s); r = DUNGEONS.act(s, "dash@0.100");
  ok(G.curHealth(s) < hp && /Too slow/.test(r.text), "dash fail: hurt");
  s = room("trap", { trap: "darts" }); r = DUNGEONS.act(s, "trigger@0.700"); ok(/spot the trigger/.test(r.text), "trigger pass");
  s = room("treasure", { tier: 1, tries: 3 }); const g0 = s.gold; r = DUNGEONS.act(s, "smash@0.950"); ok(/Clean blows/.test(r.text) && s.gold > g0, "smash clean");
  s = room("treasure", { tier: 1, tries: 3 }); r = DUNGEONS.act(s, "smash@0.200"); ok(/chest wins/.test(r.text), "smash fail");
  s = room("rest"); r = DUNGEONS.act(s, "search@1.000"); ok(/You find \d+ gold and a /.test(r.text), "search: everything found, potion too");
  s = room("rest"); r = DUNGEONS.act(s, "search@0.200n"); ok(r.fight || r.died, "search: the nest woke, a skeever");
  const fs2 = room("fight"); fs2.dungeon.room = { type: "fight", enemy: { name: "Bandit", hp: 50, health: 50, damage: 5, tags: [], gold: [1, 2] } };
  ok(DUNGEONS.roomChoices(fs2).some(([k]) => k === "flee"), "fight rooms offer Run for it");
  r = DUNGEONS.act(fs2, "flee@0.800"); ok(/turn and run/.test(r.text) && !fs2.dungeon.room, "flee pass: past the foe");
  for (const k of DG.KINDS) { const o = DUNGEONS.odds(fs2, k); ok(o > 0 && o <= 1, `odds ${k} ${o}`); } }

console.log(fails ? `${fails}/${n} FAILED` : `dungeon games ok (${n} checks)`);
process.exit(fails ? 1 : 0);
