// Foe kits (foekit.js): foes use everything they come with (archetype moves, kind moves, element, potions), every kit move
// gets used over a few fights, their guards/wards/dodges soften your blows, and the fights stay balanced. node test_foekit.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).filter((f) => f !== "tbfight.js").concat(["dragons.js", "foekit.js", "tbfight.js"]);
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, TB, FOEKIT: K } = c;

// ---- kits by archetype and kind
const kit = (e) => K.kitFor(e);
ok(kit({ name: "Bandit", arch: "warrior" }).includes("shield_bash") && kit({ name: "Bandit", arch: "warrior" }).includes("raise_shield"), "warriors bash and raise shields");
ok(kit({ name: "Bandit", arch: "brute" }).includes("wind_up"), "brutes wind up");
ok(kit({ name: "Bandit", arch: "archer" }).includes("take_aim"), "archers take aim");
ok(kit({ name: "Bandit", arch: "mage" }).join() === "bolt,foe_ward,mend", "mages cast bolts, wards and heals");
ok(kit({ name: "Bandit", arch: "rogue" }).includes("poison_blade"), "rogues poison their blades");
ok(kit({ name: "Wolf", tags: ["beast"] }).join() === "pounce,howl", "wolves pounce and howl");
ok(kit({ name: "Troll", tags: ["beast"] }).includes("regen"), "trolls regenerate");
ok(kit({ name: "Frostbite Spider", tags: ["beast"] }).includes("venom"), "spiders spit venom");
ok(kit({ name: "Draugr Deathlord", tags: ["undead"] }).includes("force"), "draugr shout");
ok(kit({ name: "Necromancer", tags: ["humanoid", "mage"] }).includes("life_drain"), "necromancers drain life");
ok(kit({ name: "Dragon", tags: ["dragon"] }).length === 0 && kit({ name: "Ann", player: true }).length === 0, "dragons and players have their own moves");
ok(K.potsFor({ name: "Bandit", level: 5 }) === K.potsFor({ name: "Bandit", level: 5 }), "potions are the same for the same foe");

// ---- fights
const FOES = [
  { name: "Bandit", health: 260, damage: 14, tags: ["humanoid"] },
  { name: "Wolf", health: 140, damage: 10, tags: ["beast"] },
  { name: "Troll", health: 360, damage: 18, tags: ["beast"] },
  { name: "Frostbite Spider", health: 180, damage: 12, tags: ["beast"] },
  { name: "Draugr", health: 260, damage: 14, tags: ["undead"] },
  { name: "Necromancer", health: 220, damage: 16, tags: ["humanoid", "mage"] },
];
function fight(build, L, base, useKit) {
  const s = c.make(build, L); s.health = G.maxHealth(s); s.healthTs = G.now();
  const e = G.scaleEnemy({ ...base, tags: [...base.tags], level: L, danger: "medium", gold: [0, 0], text: "" }, L);
  const f = new G.Fight(s, e); f.allies = [];
  const keep = c.FOEKIT; if (!useKit) c.FOEKIT = undefined;
  let ss; try { ss = TB.simulate(f, { trySneak: false }); } finally { c.FOEKIT = keep; }
  return { f, ss, won: f.ehp <= 0 && f.hp > 0, rounds: ss.round, hpLeft: Math.max(0, f.hp) / G.maxHealth(s) };
}
const used = {}, seen = {};
let bad = 0;
for (const base of FOES) for (let i = 0; i < 30; i++) {
  const r = fight(["warrior", "mage", "archer"][i % 3], [10, 20, 30][i % 3], base, true);
  for (const e of r.ss.ev) if (/NaN|undefined/.test(e.text)) { bad++; if (bad < 3) console.log("bad text:", e.text); }
  const k = r.f.kit; if (!k) continue;
  for (const id of k.ids) { const key = base.name + ":" + id; seen[key] = 1; used[key] = (used[key] || 0) + (k.used[id] || 0); }
}
ok(bad === 0, "no NaN or undefined in the fight log");
const never = Object.keys(seen).filter((k) => !used[k] && !/potion/.test(k));
ok(never.length === 0, "every kit move gets used over 30 fights: never used " + never.join(", "));
ok(Object.keys(seen).length >= 12, "a good spread of moves across foes (" + Object.keys(seen).length + ")");
console.log("moves used:", Object.entries(used).map(([k, v]) => k + "=" + v).join(" "));

// ---- balance: with kits vs plain blows, per foe
for (const base of FOES) {
  const N = 120; let w1 = 0, w0 = 0, r1 = 0, r0 = 0, h1 = 0, h0 = 0;
  for (let i = 0; i < N; i++) {
    const b = ["warrior", "mage", "archer"][i % 3], L = [10, 20, 30][i % 3];
    const a = fight(b, L, base, true), z = fight(b, L, base, false);
    w1 += a.won; w0 += z.won; r1 += a.rounds; r0 += z.rounds; h1 += a.hpLeft; h0 += z.hpLeft;
  }
  const line = `${base.name}: win ${(w0 / N * 100).toFixed(0)}% → ${(w1 / N * 100).toFixed(0)}%, rounds ${(r0 / N).toFixed(1)} → ${(r1 / N).toFixed(1)}, health left ${(h0 / N * 100).toFixed(0)}% → ${(h1 / N * 100).toFixed(0)}%`;
  console.log(line);
  ok(w1 / N >= w0 / N - 0.12, "kits don't make it much harder to win: " + line);
  ok(h1 / N >= h0 / N - 0.15 && h1 / N <= h0 / N + 0.1, "health left stays close: " + line);
  ok(r1 / N <= r0 / N * 1.35 + 0.5, "fights don't drag on: " + line);
}

// ---- defences soften your blows
{ const s = c.make("warrior", 20), e = G.scaleEnemy({ name: "Bandit", health: 300, damage: 10, tags: ["humanoid"], level: 20, danger: "medium", gold: [0, 0], text: "" }, 20);
  const f = new G.Fight(s, e); K.setup(f); f.ehp0 = f.ehp;
  f.kit.guard = 0.5; f.ehp -= 40; const t = K.defend(f, "attack", f.ehp + 40); ok(/raised shield/.test(t) && Math.abs(f.ehp - (f.ehp0 - 20)) < 0.01, "a raised shield halves a melee blow " + t);
  f.kit.ward = 15; const b = f.ehp; f.ehp -= 40; const t2 = K.defend(f, "spell:firebolt", b); ok(/ward soaks 15, and breaks/.test(t2) && Math.abs(f.ehp - (b - 25)) < 0.01, "a foe ward soaks spells " + t2);
  f.kit.guard = 0.5; const b2 = f.ehp; f.ehp -= 30; K.defend(f, "spell:firebolt", b2); ok(f.kit.guard === 0.5, "a shield doesn't stop a spell");
  // wind-up lands harder next turn
  f.kit.windup = "smash"; f.hp = G.maxHealth(s); let t3 = ""; for (let i = 0; i < 10 && !/huge blow down/.test(t3); i++) { f.kit.windup = "smash"; t3 = K.turn(f, () => f.enemyTurn()); } ok(/huge blow down/.test(t3), "a wind-up lands next turn: " + t3);
  // AP loss from a shield bash
  f.kitApLoss = 1; ok(K.apLoss(f) === 1 && K.apLoss(f) === 0, "a shield bash costs you 1 AP once");
  // poison ticks and never kills by itself
  f.kitDot = { name: "poison", dmg: 9999, turns: 2 }; f.hp = 50; K.turn(f, () => "x"); ok(f.hp >= 1, "poison never finishes you by itself");
}
console.log(fails ? `failed: ${fails}` : `foekit: all ok · ${n} checks`);
process.exit(fails ? 1 : 0);
