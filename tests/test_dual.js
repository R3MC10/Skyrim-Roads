// Dual wielding: a one-handed weapon in your left hand (instead of a shield), equip rules, a left-hand follow-up on every
// attack, the Twin Blades perk, and balance against sword-and-shield and two-handed builds. node test_dual.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).filter((f) => f !== "tbfight.js").concat(["dragons.js", "foekit.js", "tbfight.js"]);
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, TB, D, PFX } = c;
const eqOf = (s) => G.loadout(s).equipment;

// ---- equip rules
{ const s = c.make("warrior", 20);
  ok(eqOf(s).shield != null, "the warrior starts with a shield");
  const dag = G.give(s, "iron_dagger"); const m = G.equipOff(s, dag);
  ok(/left hand/.test(m) && eqOf(s).offhand === dag && eqOf(s).shield == null, "a dagger in the left hand takes the shield off: " + m);
  const sh = s.inv.find((r) => D.ITEMS[r.item].slot === "shield").id; G.equip(s, sh);
  ok(eqOf(s).shield === sh && eqOf(s).offhand == null, "putting the shield back frees the left hand");
  G.equipOff(s, dag); const gs = G.give(s, "iron_greatsword"); const m2 = G.equip(s, gs);
  ok(eqOf(s).offhand == null && /Left-hand/.test(m2), "a two-handed weapon puts the left-hand blade away: " + m2);
  ok(/both hands/.test(G.equipOff(s, dag)), "no left-hand blade with a two-hander");
  const bow = G.give(s, "hunting_bow"); ok(/Only one-handed/.test(G.equipOff(s, bow)), "a bow can't go in the left hand");
  const sw = G.give(s, "iron_sword"); G.equip(s, sw); ok(/only have one/.test(G.equipOff(s, sw)), "one sword can't be in both hands");
  const sw2 = G.give(s, "iron_sword"); const r = G.invRow(s, sw2); ok(r && r.id === sw && r.qty >= 2 ? /left hand/.test(G.equipOff(s, sw)) : true, "two of the same sword: one in each hand");
}
// ---- the fight: left hand follows up
function dualSave(L, perk) {
  const s = c.make("warrior", L); const sh = eqOf(s).shield; if (sh != null) G.unequip(s, "shield");
  const main = G.invRow(s, eqOf(s).weapon); const id = G.give(s, main.item.replace(/war_axe|sword/, (x) => x)); G.equipOff(s, id === main.id ? G.give(s, "iron_dagger") : id);
  if (perk) s.perks.twin_blades = 1; else delete s.perks.twin_blades;
  return s;
}
const foe = (s, hp = 400) => G.scaleEnemy({ name: "Bandit", health: hp, damage: 12, tags: ["humanoid"], level: s.level, danger: "medium", gold: [0, 0], text: "" }, s.level);
{ const s = dualSave(20); s.health = G.maxHealth(s); const f = new G.Fight(s, foe(s)); f.fp = null;
  ok(!!f.off && !f.shield, "the fight sees the left-hand weapon");
  let lh = 0, t = ""; for (let i = 0; i < 40; i++) { f.ehp = 9999; t = f.act("attack"); if (/left hand \d+/.test(t)) lh++; }
  ok(lh > 15, "attacks follow up with the left hand (" + lh + "/40): " + t);
  const s1 = c.make("warrior", 20); const f1 = new G.Fight(s1, foe(s1)); ok(f1.paCost < f.paCost, `dual power attacks cost more stamina ${f1.paCost.toFixed(0)} → ${f.paCost.toFixed(0)}`);
  const sp = dualSave(20, true); const fp = new G.Fight(sp, foe(sp)); ok(fp.paCost < f.paCost * 0.8, "Twin Blades: cheaper dual power attacks");
  ok(PFX.num(sp, "offhand") === 0.3, "Twin Blades: left hand hits 30% harder");
}
// ---- balance: dual vs sword-and-shield vs two-handed, turn-based fights
function run(kind, L) {
  const s = kind === "dual" ? dualSave(L) : c.make(kind, L); s.health = G.maxHealth(s); s.healthTs = G.now();
  const f = new G.Fight(s, foe(s, 200 + L * 12)); f.allies = [];
  const ss = TB.simulate(f, { trySneak: false });
  return { won: f.ehp <= 0 && f.hp > 0, rounds: ss.round, left: Math.max(0, f.hp) / G.maxHealth(s) };
}
const R = {};
for (const k of ["warrior", "dual", "twohand"]) { const N = 150; let w = 0, r = 0, h = 0; for (let i = 0; i < N; i++) { const x = run(k, [10, 20, 30][i % 3]); w += x.won; r += x.rounds; h += x.left; } R[k] = { w: w / N, r: r / N, h: h / N }; }
console.log(Object.entries(R).map(([k, v]) => `${k}: win ${(v.w * 100).toFixed(0)}% rounds ${v.r.toFixed(1)} health left ${(v.h * 100).toFixed(0)}%`).join(" | "));
ok(R.dual.r < R.warrior.r, "dual wielders finish fights faster than sword-and-shield");
ok((1 - R.dual.h) / R.dual.r > (1 - R.warrior.h) / R.warrior.r, "but take more damage each round without a shield");
ok(Math.abs(R.dual.w - R.warrior.w) < 0.15 && Math.abs(R.dual.w - R.twohand.w) < 0.2, "win rates stay close to the other melee builds");
console.log(fails ? `failed: ${fails}` : `dual: all ok · ${n} checks`);
process.exit(fails ? 1 : 0);
