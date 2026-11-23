// Foe archetypes and groups (foegroups.js): real numbers per archetype, groups balanced, bosses and players alone.
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ console, Math, Date, JSON, Object, Array, Set, Map, Number, String, structuredClone });
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "powers.js", "engine.js", "tbfight.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log("FAIL", m); } };
const { G, FOEGROUPS: FG, TB } = c;
const foe = (name, x = {}) => ({ name, health: 60, hp: 60, damage: 8, tags: ["humanoid"], red: 0.1, level: 10, danger: "medium", gold: [5, 10], text: "", ...x });

ok(FG.kindOf(foe("Bandit outlaw")) === "bandit", "bandits are bandits");
ok(FG.kindOf(foe("Draugr", { tags: ["undead"] })) === "draugr", "draugr are undead archetypes too");
ok(FG.kindOf(foe("Skeleton", { tags: ["undead"] })) === "skeleton", "skeletons");
ok(FG.kindOf(foe("Wolf pack", { tags: ["beast"] })) === null, "beasts have no archetypes");
ok(FG.kindOf(foe("Zed", { look: { r: "orc" }, player: true })) === null, "players have no archetypes");
ok(FG.archFor(foe("Bandit archer"), "bandit") === "archer" && FG.archFor(foe("Draugr wight"), "draugr") === "mage", "the name decides when it says one");

// archetypes change the real numbers, from the base numbers (a second fight doesn't stack)
{ const e = foe("Bandit outlaw"); e.baseDamage = 8; e.baseRed = 0.1;
  FG.setArch(e, "brute"); ok(e.damage > 8 && e.red < 0.1, "brutes hit harder, armour thinner");
  FG.setArch(e, "warrior"); ok(e.damage < 8 && e.red > 0.1, "warriors are harder to hurt");
  FG.setArch(e, "warrior"); ok(Math.abs(e.red - 0.18) < 1e-9, "no stacking");
  ok(FG.look(e).shield === true && FG.look(e).wt === "sword", "a warrior carries sword and shield in the scene");
  FG.setArch(e, "archer"); ok(FG.look(e).wt === "bow", "an archer carries a bow"); }

// groups: sizes, balance, who stays alone
{ const sizes = { 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < 2000; i++) { const s = G.newSave("g" + i, "G", "nord"); s.level = 12; const f = new G.Fight(s, foe("Bandit outlaw")); f.allies = []; sizes[FG.prep(f, 0).n]++; }
  ok(sizes[1] > 900 && sizes[2] > 400 && sizes[3] > 100 && sizes[3] < 400, "mostly one, sometimes two, now and then three: " + JSON.stringify(sizes));
  const s5 = G.newSave("l5", "L", "nord"); s5.level = 4; let three = 0;
  for (let i = 0; i < 500; i++) { const f = new G.Fight(s5, foe("Bandit outlaw")); f.allies = []; if (FG.prep(f, 0).n === 3) three++; }
  ok(three === 0, "no groups of three at low level");
  const s = G.newSave("b", "B", "nord"); s.level = 30;
  for (let i = 0; i < 200; i++) { const f = new G.Fight(s, foe("Bandit chief", { boss: true })); f.allies = []; ok(FG.prep(f, 0).n === 1, "bosses come alone"); if (fails) break; }
  for (let i = 0; i < 200; i++) { const f = new G.Fight(s, foe("Bandit outlaw")); f.allies = []; ok(FG.prep(f, 2).n === 1, "parties keep their own rule"); if (fails) break; }
  for (let i = 0; i < 300; i++) { const f = new G.Fight(s, foe("Bandit outlaw")); f.allies = []; const g = FG.prep(f, 0);
    const avgArch = g.hpMul.reduce((a, m, j) => a + m / FG.ARCH[f.e.group[j]].hp, 0);
    ok(Math.abs(avgArch - (1 + FG.GROUP_HP * (g.n - 1))) < 1e-9, "group total health is +30% per extra foe, split up"); if (fails) break; } }

// in a turn-by-turn fight the next foe of the group steps in with its own archetype
if (TB) { let seen = false;
  for (let i = 0; i < 200 && !seen; i++) {
    const s = G.newSave("t" + i, "T", "nord"); s.level = 15; const f = new G.Fight(s, foe("Bandit outlaw")); f.allies = [];
    const ss = new TB.Session(f, { trySneak: false }); if (ss.waves < 2) continue;
    seen = true; const first = ss.ehpMax; f.ehp = 0; void ss.over;
    ok(ss.wave === 2 && f.ehp === ss.ehpMax && f.ehp > 0, "the next foe steps in with full health");
    ok(ss.ev.some((e) => /steps in/.test(e.text) && new RegExp(f.e.archLabel).test(e.text)), "the log names its archetype: " + ss.ev.map((e) => e.text).filter((t) => /steps in/.test(t)));
    ok(first > 0, "first foe had health"); }
  ok(seen, "groups happen in turn-based fights"); }
else ok(false, "tbfight.js loaded");
console.log(fails ? `FAILED ${fails}` : "foegroups ok");
process.exit(fails ? 1 : 0);
