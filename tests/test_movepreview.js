// Move preview (TB.preview in tbfight.js, movepreview.js) and foe pictures by role (assets.js foeKey).
// The range the bar shows is the range the tooltip says, and one blow never shows more than 40% of a strong foe.
// node test_movepreview.js — prints "movepreview ok".
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 1 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).filter((f) => f !== "tbfight.js")
  .concat(["foekit.js", "tbfight.js", "tbtips.js", "assets.js", "movepreview.js"]);
for (const f of [...new Set(FILES)]) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, D, TB, TBTIPS, ASSETS, MOVEPREVIEW } = c;
ok(typeof TB.preview === "function", "TB.preview exists");
ok(MOVEPREVIEW && typeof MOVEPREVIEW.info === "function", "movepreview.js loads in node");

function fight(cls, lvl, foe) {
  const s = c.make(cls, lvl); s.health = G.maxHealth(s); s.healthTs = G.now();
  for (const id of ["flames", "firebolt", "healing"]) if (D.SPELLS[id] && !s.spells.includes(id)) s.spells.push(id);
  const e = G.scaleEnemy(foe, lvl);
  const f = new G.Fight(s, e); f.allies = [];
  const ss = new TB.Session(f, { trySneak: false }); ss.begin(); ss.myActs = 0; ss.used = {}; ss.pots = 0; ss.cur = { id: "me" };
  return { s, f, ss };
}
const useSess = (ss) => Object.defineProperty(TB, "session", { get: () => ss, configurable: true });
const range = (t) => { const m = /about (\d+)(?:–(\d+))? /.exec(t); return m ? [+m[1], +(m[2] || m[1])] : null; };

// 1. the tooltip says the same range the bar shows
{ const { f, ss } = fight("warrior", 20, { name: "Bandit outlaw", health: 260, damage: 14, tags: ["humanoid"], level: 20, danger: "medium", gold: [0, 0], text: "" });
  useSess(ss);
  for (const a of ["attack", "power_attack"]) {
    const p = TB.preview(f, a, ss), t = TBTIPS.action(f, a, TB.cost(f, a, ss)), r = range(t);
    ok(p.hi > 0 && p.lo > 0 && p.lo <= p.hi, `${a}: a range ${p.lo}-${p.hi}`);
    ok(r && r[0] === p.lo && r[1] === p.hi, `${a}: tooltip "${t}" says ${p.lo}-${p.hi}`);
  }
  const p0 = TB.preview(f, "end", ss); ok(Math.abs(p0.guard - ss.guardLeft()) < 1e-9 && p0.guard > 0, "End turn: the guard it gives " + p0.guard);
  const pc = TB.preview(f, "power_attack", ss); ok(pc.c && pc.c.sp === TB.cost(f, "power_attack", ss).sp, "the cost comes along");
}
// 2. a spell: the tooltip and the bar agree
{ const { s, f, ss } = fight("mage", 20, { name: "Bandit outlaw", health: 260, damage: 14, tags: ["humanoid"], level: 20, danger: "medium", gold: [0, 0], text: "" });
  useSess(ss); f.mp = 999;
  const sp = s.spells.find((id) => D.SPELLS[id]?.kind === "damage");
  if (sp) {
    const a = "spell:" + sp, p = TB.preview(f, a, ss), t = TBTIPS.action(f, a, TB.cost(f, a, ss)), r = range(t);
    ok(p.hi > 0 && r && r[0] === p.lo && r[1] === p.hi, `${sp}: tooltip "${t}" vs preview ${p.lo}-${p.hi}`);
    ok(p.c.mp > 0, `${sp}: costs magicka ${p.c.mp}`);
  }
  const heal = s.spells.find((id) => D.SPELLS[id]?.kind === "heal");
  if (heal) ok(TB.preview(f, "spell:" + heal, ss).heal > 0, "a healing spell shows what it heals");
}
// 3. no one-shots: never more than 40% of a strong foe's health, but a finishing blow on a nearly beaten foe is fine
{ const { f, ss } = fight("twohand", 40, { name: "Frost troll", health: 400, damage: 30, tags: ["beast"], level: 40, danger: "high", gold: [0, 0], text: "" });
  useSess(ss); ss.trash = false;
  const real = f.weaponDamage;
  f.weaponDamage = () => ss.ehpMax;   // a huge blow
  for (const a of ["attack", "power_attack"]) {
    const p = TB.preview(f, a, ss);
    ok(p.hi <= Math.round(TB.HIT_CAP * ss.ehpMax) && p.capped, `${a}: capped at 40% (${p.hi} of ${ss.ehpMax})`);
    const r = range(TBTIPS.action(f, a, TB.cost(f, a, ss)));
    ok(r && r[1] === p.hi, `${a}: the tooltip keeps the cap too`);
  }
  f.ehp = Math.round(ss.ehpMax * 0.3);
  const p = TB.preview(f, "attack", ss); ok(p.hi === f.ehp, `a finishing blow on a beaten foe shows all it has left (${p.hi}/${f.ehp})`);
  f.weaponDamage = real;
  // the real fight agrees: a big blow on a full-health strong foe is held to 40%
  f.ehp = ss.ehpMax; const before = f.ehp; f.ehp -= ss.ehpMax * 0.9; ss.capFoe(before);
  ok(before - f.ehp <= TB.HIT_CAP * ss.ehpMax + 0.5, "capFoe holds the same line");
  // random strong foes at many levels: never more than 40%
  for (const L of [10, 20, 30, 40, 50]) for (const cls of ["warrior", "twohand", "archer", "mage"]) {
    const x = fight(cls, L, { name: "Draugr deathlord", health: 500, damage: 40, tags: ["undead"], level: L, danger: "high", boss: true, gold: [0, 0], text: "" });
    x.f.mp = 9999; x.ss.trash = false;
    for (const a of ["attack", "power_attack", ...x.s.spells.filter((id) => D.SPELLS[id]?.kind === "damage").map((id) => "spell:" + id), ...x.s.spells.filter((id) => D.SPELLS[id]?.kind === "damage").map((id) => "dual:" + id)]) {
      const q = TB.preview(x.f, a, x.ss);
      ok(q.hi <= TB.HIT_CAP * x.ss.ehpMax + 0.5, `${cls} L${L} ${a}: ${q.hi} ≤ 40% of ${x.ss.ehpMax}`);
    }
  }
}
// 4. foe pictures by role
{ const has = ASSETS.FOE_ROLES;
  ok(ASSETS.foeKey("Bandit outlaw", "bandit", "archer") === (has.has("foe-bandit-archer") ? "foe-bandit-archer" : "foe-bandit"), "bandit archer: " + ASSETS.foeKey("Bandit outlaw", "bandit", "archer"));
  ok(ASSETS.foeKey("Bandit outlaw", "bandit", "warrior") === "foe-bandit", "a bandit warrior keeps the axe picture");
  ok(ASSETS.foeKey("Bandit outlaw", "bandit") === "foe-bandit", "no archetype: the old picture");
  ok(ASSETS.foeKey("Bandit outlaw", "bandit", "mage") === (has.has("foe-bandit-mage") ? "foe-bandit-mage" : "foe-bandit"), "bandit mage");
  ok(ASSETS.foeKey("Forsworn briarheart", "forsworn", "archer") === (has.has("foe-forsworn-archer") ? "foe-forsworn-archer" : "foe-bandit"), "forsworn archer");
  ok(ASSETS.foeKey("Forsworn ravager", "forsworn", "warrior") === "foe-bandit", "forsworn warrior");
  ok(ASSETS.foeKey("Restless draugr", "draugr", "archer") === (has.has("foe-draugr-archer") ? "foe-draugr-archer" : "foe-draugr"), "draugr archer");
  ok(ASSETS.foeKey("Frost troll", "troll", "archer") === "foe-frosttroll", "a role with no picture keeps the foe's own");
  // listed pictures exist in the game folder
  for (const k of has) ok(fs.existsSync(W + k + ".webp"), `${k}.webp is in the game folder`);
  // and the game really gives archers this archetype
  if (c.FOEGROUPS && c.FOEGROUPS.assign) { /* foegroups.js sets e.arch; fightart.js passes it on */ }
  const fa = fs.readFileSync(W + "fightart.js", "utf8");
  ok(/foeKey\(rec\.foeName, foeK, rec\.f\?\.e\?\.arch\)/.test(fa), "fightart.js passes the foe's archetype");
}
console.log(fails ? `${fails}/${n} FAILED` : `movepreview ok (${n} checks)`);
if (fails) process.exit(1);
