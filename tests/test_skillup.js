const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Skill-up toasts (skillup.js): the bar maths (crossing levels, creeping), the queue (merging, order, cap),
   which result lines stay as text, and a real fight that levels a skill. W=/path/to/game/ node test_skillup.js — prints "skillup ok". */
const fs = require("fs"), vm = require("vm");
const W = __GAME;
const c = { process: { exitCode: 0 }, console, Math, Date, JSON, Object, Array, Set, Map, Number, String, performance: { now: () => 0 } };
vm.createContext(c);
for (const f of ["patchnotes.js", "skillup.js"]) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log("FAIL", m); } };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const need = () => 100;
const SU = SKILLUP;

// the bar's run
let r = SU.run({ lvl: 30, xp: 50 }, { lvl: 30, xp: 80 }, need);
ok(r.length === 1 && near(r[0].a, 0.5) && near(r[0].b, 0.8) && !r[0].cross, "no level: one creep 0.5 → 0.8");
r = SU.run({ lvl: 30, xp: 90 }, { lvl: 31, xp: 20 }, need);
ok(r.length === 2 && r[0].cross && near(r[0].a, 0.9) && r[0].b === 1 && r[0].lvl === 31, "a level crossed: runs to the end at 31");
ok(!r[1].cross && r[1].a === 0 && near(r[1].b, 0.2), "then restarts from 0 to the new progress");
r = SU.run({ lvl: 10, xp: 40 }, { lvl: 13, xp: 10 }, need);
ok(r.filter((s) => s.cross).length === 3 && r.map((s) => s.lvl).join() === "11,12,13,13", "three levels: three crossings, then the creep");
r = SU.run({ lvl: 99, xp: 95 }, { lvl: 100, xp: 0 }, need);
ok(r.length === 1 && r[0].cross && r[0].lvl === 100, "maxing a skill ends on a full bar");
r = SU.run({ lvl: 20, xp: 0 }, { lvl: 21, xp: 0 }, need);
ok(r.length === 2 && r[1].b === 0, "landing exactly on a level: the restart is an empty bar");
ok(SU.frac(5, 50, 100) === 0.5 && SU.frac(100, 0, 100) === 1 && SU.frac(5, 500, 100) === 1, "progress fraction");
// varying XP per level (the real curve)
r = SU.run({ lvl: 5, xp: 30 }, { lvl: 6, xp: 30 }, (l) => (l === 5 ? 60 : 120));
ok(near(r[0].a, 0.5) && near(r[1].b, 0.25), "each level's own XP need is used");

// items and durations
const it = SU.skillItem("One-Handed", { lvl: 30, xp: 90 }, { lvl: 31, xp: 20 }, need);
ok(it && it.kind === "skill" && it.lvl === 31 && !it.minor, "a skill-up item");
ok(SU.skillItem("Sneak", { lvl: 30, xp: 10 }, { lvl: 30, xp: 10 }, need) === null, "nothing moved: no item");
const creep = SU.skillItem("Blocking", { lvl: 25, xp: 10 }, { lvl: 25, xp: 30 }, need);
ok(creep.minor, "XP without a level is a creep");
ok(SU.dur(it) >= 1000 && SU.dur(it) <= 1400, "a skill-up shows about 1.2 s (" + SU.dur(it) + ")");
ok(SU.dur(creep) < SU.dur(it), "a creep is quicker");
const lv = { kind: "level", name: "level", lvl: 12, segs: SU.run({ lvl: 11, xp: 300 }, { lvl: 12, xp: 50 }, () => 400, Infinity), minor: false };
ok(SU.dur(lv) > SU.dur(it) && lv.segs[0].cross && lv.segs[1].b > 0, "the level-up banner is longer and has its own bar");

// the queue
const q = [];
SU.enqueue(q, [creep, lv, it]);
ok(q.map((x) => x.name).join() === "One-Handed,Blocking,level", "skill-ups first, creeps next, level-up last: " + q.map((x) => x.name));
SU.enqueue(q, [SU.skillItem("One-Handed", { lvl: 31, xp: 20 }, { lvl: 32, xp: 5 }, need)]);
const oh = q.find((x) => x.name === "One-Handed");
ok(q.length === 3 && oh.lvl === 32 && oh.segs.filter((s) => s.cross).length === 2 && oh.segs[0].a === 0.9 - 0 && near(oh.segs[0].a, 0.9), "the same skill again merges: 31 and 32 in one bar");
ok(oh.segs[1].a === 0 && oh.segs[1].cross && oh.segs[1].lvl === 32 && near(oh.segs[2].b, 0.05), "merged: after the flash the bar restarts at 0, crosses 32, creeps to the new progress");
const many = []; for (let i = 0; i < 14; i++) SU.enqueue(many, [SU.skillItem("S" + i, { lvl: 10, xp: 0 }, { lvl: 10, xp: 50 }, need)]);
SU.enqueue(many, [it]);
ok(many.length === 10 && many[0].name === "One-Handed", "at most 10 waiting; creeps dropped first, skill-ups kept");
const ups = SU.pickCreeps([creep, SU.skillItem("Archery", { lvl: 9, xp: 0 }, { lvl: 9, xp: 90 }, need), SU.skillItem("Sneak", { lvl: 9, xp: 0 }, { lvl: 9, xp: 0.1 }, need), it]);
ok(ups.length === 2 && ups[0].name === "Archery", "creeps: biggest gains first, tiny ones skipped, skill-ups not counted");

// result lines: skill-ups go to toasts, the follower's words stay
const lines = ["💬 Jenassa: \\"Good fight.\\"", "Destruction increased to 20", "Blocking increased to 25", "You reached level 9! Choose health, magicka or stamina.", "Lydia gets back up after the fight, badly hurt."];
const left = SU.others(lines);
ok(left.length === 2 && left[0].startsWith("💬 Jenassa") && /Lydia/.test(left[1]), "only follower lines stay as text: " + JSON.stringify(left));

// placing: centred on the map, or at the top of the screen when a pop-up covers it
let p = SU.spot(100, { left: 0, width: 400 }, 20, false, 400);
ok(p.top === 100 && p.left + p.width / 2 === 200, "centred over the map at the lane's top");
p = SU.spot(100, { left: 300, width: 1300 }, 0, false, 1920);
ok(p.width === 440 && p.left === 300 + (1300 - 440) / 2, "PC: 440 wide, centred on the map");
p = SU.spot(100, null, 24, true, 390);
ok(p.top === 32, "a pop-up on screen: at the very top");

// Polish words and the patch note
ok(SU.PL["{0} increased to {1}"] && SU.PL["Level up"], "Polish words");
const note = PATCHNOTES.LIST.slice(0, 40).find((e) => e.id === "b143-skillup") || { items: [] };   // near the top: several features ship together, only one note can be first
ok(note.id === "b143-skillup" && note.build >= 143, "patch note near the top");
ok(note.items.every((x) => SU.PL[x]) && SU.PL[note.title], "patch note in Polish");
ok(new Set(PATCHNOTES.LIST.map((e) => e.id)).size === PATCHNOTES.LIST.length, "patch note ids are unique");
if (fails) process.exitCode = 1;
console.log(fails ? fails + " of " + n + " FAILED" : "skillup ok (" + n + " checks)");
`, c);
process.exitCode = c.process.exitCode;

// a real fight in the game that levels a skill: diff() sees the crossing
{
  const g = { console, Math, Date, JSON, Object, Array, Set, Map, WeakMap, Number, String, performance: { now: () => 0 }, process: { exitCode: 0 } };
  vm.createContext(g);
  const files = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "skillup.js"];
  for (const f of files) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), g);
  vm.runInContext(`
    let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL", m); } };
    const s = G.newSave ? G.newSave("T", "Test", "nord") : null;
    if (s) {
      const sk = s.skills["One-Handed"]; sk.xp = F.skillXpNeeded("One-Handed", sk.lvl) - 0.01;
      const before = { sk: Object.fromEntries(Object.entries(s.skills).map(([k, v]) => [k, { lvl: v.lvl, xp: v.xp }])), level: s.level, cx: s.charXp || 0 };
      const lvl0 = sk.lvl; G.useSkill(s, "One-Handed", 5);
      const items = SKILLUP.diff(before, s, true);
      const oh = items.find((i) => i.name === "One-Handed");
      ok(sk.lvl === lvl0 + 1 && oh && !oh.minor && oh.lvl === lvl0 + 1 && oh.segs[0].cross, "useSkill crossing a level becomes a skill-up item");
      ok(SKILLUP.queue.length === 0, "no toasts queued outside the browser");
    }
    if (bad) process.exitCode = 1;
  `, g);
  if (g.process.exitCode) process.exitCode = 1;
}
