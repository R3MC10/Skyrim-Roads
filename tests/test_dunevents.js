const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// mystery rooms with real choices (dunevents.js): every event resolves solo and for an 8-player party (same outcome on
// every phone), a shortcut never skips the boss's depth, an ambush never starts a strong foe below 60% health
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "dunevents.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "mp.js", "sneak2.js"])
  if (fs.existsSync(__GAME + f)) vm.runInContext(fs.readFileSync(__GAME + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0;
const ok = (x, m) => { n++; if (!x) throw new Error("FAIL " + m); };
const PLACE = "Bleak Falls Barrow";
function hero(id, lvl = 20) {
  const s = G.newSave(id, "H" + id, "nord");
  s.level = lvl; s.hpBonus = (lvl - 1) * 6; for (const sk of Object.values(s.skills)) sk.lvl = Math.min(100, sk.lvl + (lvl - 1) * 2);
  for (const it of ["steel_sword", "steel_armor", "steel_helmet", "steel_boots", "steel_gauntlets", "steel_shield"]) { G.give(s, it); G.equip(s, s.inv[s.inv.length - 1].id); }
  G.setHealth(s, G.maxHealth(s));
  s.location = PLACE; [s.x, s.y] = WORLD.places[PLACE];
  return s;
}
/* put a hero in a mystery room holding event ev, at row r (default: the first middle row) */
function inEvent(s, ev, r, rows) {
  if (!s.dungeon) { const e = DUNGEONS.enter(s); if (e) throw e; }
  const d = s.dungeon;
  if (rows) d.rows = JSON.parse(JSON.stringify(rows));
  d.row = r ?? 1; d.col = 0; d.room = null;
  d.room = { type: "mystery", m: "event", ev, title: DUNEVENTS.EVENTS[ev].title, text: "x", foeKey: ev === "patrol" ? "draugr" : undefined };
  return d;
}
const keysOf = (ev) => DUNEVENTS.EVENTS[ev].opts.map((o) => o[0]);

// ---- solo: every option of every event resolves, many times, never throws, always leaves the room (or dies in a fight)
let solo = 0, shortcuts = 0;
for (const ev of DUNEVENTS.IDS) for (const k of keysOf(ev)) for (let i = 0; i < 25; i++) {
  const s = hero("s" + i, 6 + (i % 4) * 10), d = inEvent(s, ev);
  const lbl = DUNGEONS.roomChoices(s).find((x) => x[0] === k);
  ok(lbl, ev + " offers " + k);
  const o = DUNEVENTS.EVENTS[ev].opts.find((x) => x[0] === k);
  if (o[2]) ok(/ · \\d+%/.test(lbl[1]), "the label names skill and chance: " + lbl[1]);
  const row0 = d.row;
  const r = DUNGEONS.act(s, k);
  ok(typeof r.text === "string" && r.text.length > 0, ev + "/" + k + " has a result line");
  if (o[2]) ok(/^[a-z]+@[01]$/.test(r.rec), ev + "/" + k + " records its roll: " + r.rec);
  if (!r.died) ok(!s.dungeon || !s.dungeon.room, ev + "/" + k + " leaves the room");
  if (s.dungeon && s.dungeon.row > row0) shortcuts++;
  solo++;
}
ok(shortcuts > 0, "some shortcuts were taken");

// ---- the labels: chance and skill, and in a party the best hero's name
{
  const s = hero("L", 10); inEvent(s, "sealed");
  const lab = DUNGEONS.roomChoices(s).find((x) => x[0] === "evlock")[1];
  ok(/^Pick the old lock \\(Lockpicking · \\d+%\\) → /.test(lab), "lock label: " + lab);
  ok(DUNGEONS.roomChoices(s).some((x) => x[0] === "skip"), "a way to leave it");
}

// ---- an 8-player party: the leader rolls (best hero), members replay the recorded result and end up in the same place
const PARTY = 8;
let partyRuns = 0;
for (const ev of DUNEVENTS.IDS) for (const k of keysOf(ev)) for (let i = 0; i < 6; i++) {
  const heroes = Array.from({ length: PARTY }, (_, j) => hero("p" + j + "_" + i, 8 + j * 4));
  heroes[5].skills.Lockpicking.lvl = 100; heroes[6].skills.Athletics.lvl = 100;
  const L = heroes[0];
  DUNGEONS.enter(L);
  const rows = L.dungeon.rows;
  for (const h of heroes) { if (h !== L) DUNGEONS.enter(h); h.dungeon.run = "R" + i; inEvent(h, ev, 1, rows); h.dungeon.run = "R" + i; }
  const cards = heroes.map((h) => ({ id: h.id, name: h.name, coop: { run: "R" + i, msk: DUNEVENTS.sheet(h) } }));
  DUNEVENTS.mount({ mates: () => cards });
  ok(DUNEVENTS.team(L).length === PARTY, "all 8 heroes can roll");
  const o = DUNEVENTS.EVENTS[ev].opts.find((x) => x[0] === k);
  if (o[2] && o[2][0] === "Lockpicking") { const b = DUNEVENTS.best(L, { sk: o[2], mod: o[3] }); ok(b.who.id === heroes[5].id, "the best lockpicker rolls"); ok(/, H/.test(DUNGEONS.roomChoices(L).find((x) => x[0] === k)[1]), "the label names who rolls"); }
  const lr = DUNGEONS.act(L, k);
  ok(typeof lr.text === "string", "leader resolves " + ev + "/" + k);
  const rec = lr.rec || k;
  for (const h of heroes.slice(1)) {
    const mr = DUNGEONS.act(h, rec);   // replays the leader's recorded choice
    ok(typeof mr.text === "string", "member resolves " + ev + "/" + rec);
    if (lr.rec) ok(mr.rec === lr.rec, "same outcome on every phone: " + lr.rec + " vs " + mr.rec);
    if (s_alive(L) && s_alive(h)) ok(h.dungeon.row === L.dungeon.row && h.dungeon.col === L.dungeon.col, "everyone stands in the same place after " + ev + "/" + rec);
    if (s_alive(L) && s_alive(h)) ok(h.dungeon.evNext === L.dungeon.evNext, "same next-fight setup");
  }
  DUNEVENTS.mount(null);
  partyRuns++;
}
function s_alive(s) { return !!s.dungeon; }

// ---- the same event on every phone of a run (seeded by run, row and room)
{
  let same = 0;
  for (let i = 0; i < 200; i++) {
    const a = hero("a" + i), b = hero("b" + i);
    DUNGEONS.enter(a); DUNGEONS.enter(b);
    for (const s of [a, b]) { s.dungeon.run = "RUN" + i; s.dungeon.row = 2; s.dungeon.col = 1; s.dungeon.theme = "barrow"; }
    const ra = DUNEVENTS.room(a), rb = DUNEVENTS.room(b);
    ok(JSON.stringify(ra) === JSON.stringify(rb), "seeded event matches");
    ok(DUNEVENTS.pickOld(a, ["corpse", "book", "shrine", "egg"]) === DUNEVENTS.pickOld(b, ["corpse", "book", "shrine", "egg"]), "seeded old find matches");
    if (ra) same++;
  }
  ok(same > 70 && same < 150, "about " + Math.round(DUNEVENTS.SHARE * 100) + "% of Unknown rooms hold a new event: " + same + "/200");
}

// ---- a shortcut never skips the boss's depth: from every row, a passed check either skips one ordinary row or stays put
let skipsSeen = 0, stays = 0;
for (let i = 0; i < 120; i++) {
  const s = hero("k" + i); DUNGEONS.enter(s);
  const rows = s.dungeon.rows, last = rows.length - 1;
  for (let r = 0; r < last; r++) for (let col = 0; col < rows[r].length; col++) {
    const d = inEvent(s, "bridge", r, rows); d.col = col;
    const res = DUNGEONS.act(s, "evrun@1");
    ok(!s.dungeon.room, "the bridge room is left");
    ok(s.dungeon.row < last, "never standing in the boss row");
    ok(s.dungeon.rows[last][0].type === "boss", "the boss is still there");
    if (r + 1 >= last) { ok(s.dungeon.row === r, "next to the boss: no skip"); stays++; }
    else { ok(s.dungeon.row === r + 1, "one depth skipped"); skipsSeen++; }
    const nx = DUNGEONS.nextChoices(s);
    ok(nx.length > 0, "there's a way on after a shortcut");
    // walk on to the boss: always reachable
    let guard = 0;
    while (s.dungeon.row < last - 1 && guard++ < 20) { s.dungeon.row += 1; s.dungeon.col = rows[s.dungeon.row - 1][s.dungeon.col].links[0]; }
    ok(DUNGEONS.nextChoices(s).some((c) => rows[last][c]?.type === "boss"), "the boss can still be reached");
    s.dungeon.row = r; s.dungeon.col = col;
  }
}
ok(skipsSeen > 0 && stays > 0, "both cases tested");

// ---- an ambush never starts a strong foe below 60% health (every foe, bosses too, at any level)
let strong = 0;
for (const lvl of [1, 10, 25, 40, 60]) for (const key of Object.keys(DUNGEONS.ENEMY)) {
  if (!DUNGEONS.ENEMY[key]) continue;
  const s = hero("e" + key + lvl, lvl); DUNGEONS.enter(s);
  for (const boss of [false, true]) {
    const def = { ...DUNGEONS.ENEMY[key] }; const e = G.scaleEnemy(def, s.level); e.hp = e.health;
    const hp = DUNEVENTS.ambushHp(e);
    ok(hp >= Math.ceil(e.health * 0.6) && hp <= e.health, key + " ambushed at " + hp + "/" + e.health);
    s.dungeon.evNext = "ambush";
    const op = DUNEVENTS.opening(s, e);
    ok(op && op.stagger && !op.enemyFirst, "an ambush: staggered, you first");
    ok(e.hp >= e.health * 0.6, "opening keeps 60%");
    ok(!s.dungeon.evNext, "used once");
    strong++;
  }
}
// and through a real fight: the patrol ambush starts the foe at 80% and it doesn't move first
for (let i = 0; i < 30; i++) {
  const s = hero("f" + i, 30); inEvent(s, "patrol");
  const r = DUNGEONS.act(s, "evambush@1");
  ok(r.fight, "the ambush is a fight");
  ok(r.fight.ehp0 >= r.fight.e.health * 0.6, "fight starts at " + r.fight.ehp0 + "/" + r.fight.e.health);
  ok(!r.fight.log[0] || r.fight.log[0].turn !== 0, "the foe didn't get a free first move");
}

// ---- the next fight after an ambush/alert setup really uses it
{
  const s = hero("n1", 20); inEvent(s, "tunnel");
  DUNGEONS.act(s, "evsqueeze@1");
  ok(s.dungeon.evNext === "ambush", "squeezing through sets up an ambush");
  const d = s.dungeon; d.room = { type: "fight", enemy: (() => { const e = G.scaleEnemy({ ...DUNGEONS.ENEMY.draugr }, 20); e.hp = e.health; return e; })(), text: "" };
  const r = DUNGEONS.act(s, "fight");
  ok(/off guard/.test(r.text) || r.died, "the next fight opens with the ambush: " + r.text);
  ok(!s.dungeon || !s.dungeon.evNext, "and it's used up");
}

// ---- blessings and curses: only while you're inside
{
  const s = hero("b1", 20); inEvent(s, "offering");
  const mh0 = G.maxHealth(s);
  DUNGEONS.act(s, "evpurify@1");
  ok(G.maxHealth(s) > mh0, "blessed: more max health");
  DUNGEONS.leave(s);
  ok(G.maxHealth(s) === mh0, "the blessing stays inside");
  const s2 = hero("b2", 20); inEvent(s2, "offering");
  DUNGEONS.act(s2, "evtake@0");
  ok(G.maxHealth(s2) < mh0, "cursed: less max health");
  ok(G.curHealth(s2) <= G.maxHealth(s2), "health within the new max");
  DUNGEONS.leave(s2);
  ok(G.maxHealth(s2) === mh0, "the curse lifts outside");
}

// ---- failing never kills outright (only a fight can)
for (let i = 0; i < 40; i++) {
  const s = hero("h" + i, 3); inEvent(s, "bridge"); G.setHealth(s, 2);
  const r = DUNGEONS.act(s, "evrun@0");
  ok(!r.died && G.curHealth(s) >= 1, "a fall from the bridge leaves you standing");
}

// ---- Patient Shadow: +10% on these checks
{
  const s = hero("ps", 30); inEvent(s, "patrol");
  const o = { sk: ["Sneak"], mod: 0 };
  const b0 = DUNEVENTS.best(s, o).ch;
  s.perks = s.perks || {}; s.perks.patient_shadow = 1;
  const b1 = DUNEVENTS.best(s, o).ch;
  ok(Math.abs(b1 - Math.min(0.95, b0 + 0.1)) < 1e-6, "Patient Shadow adds 10%: " + b0 + " → " + b1);
}
console.log("dunevents OK", n, "checks;", solo, "solo resolutions,", partyRuns, "party runs (8 heroes)");
`, c);
