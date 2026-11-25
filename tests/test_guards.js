// Hold guards: patrols on a shared timetable, always your level, and fighting them gives no XP, gold or loot. node test_guards.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
let sd = +(process.env.SEED || 7) >>> 0; const SMATH = Object.create(Math); SMATH.random = () => { sd = (sd + 0x6D2B79F5) >>> 0; let t = sd; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };   // seeded dice: the Watch Drills sim is the same every run (SEED=n to try others)
const c = vm.createContext({ process: { env: process.env }, console, Math: SMATH, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).filter((f) => f !== "tbfight.js").concat(["dragons.js", "foekit.js", "guards.js", "tbfight.js"]);
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, GUARDS } = c; const TOWNS = vm.runInContext("TOWNS", c);

// ---- patrols
const t0 = 1795200000, P = GUARDS.patrols(t0);
ok(P.length >= 7, "most holds have a patrol: " + P.map((p) => p.hold + "→" + p.to).join(", "));
ok(P.every((p) => p.pos && isFinite(p.pos[0]) && isFinite(p.pos[1])), "every patrol has a place on the map");
ok(JSON.stringify(GUARDS.patrols(t0)) === JSON.stringify(P), "the same time gives the same places (every phone sees the same patrols)");
{ const wr = (t) => GUARDS.patrols(t).find((p) => p.hold === "Whiterun"); const b = GUARDS.beat("Whiterun"); let moved = 0, seen = new Set();
  for (let t = t0; t < t0 + 2 * (GUARDS.STOP + b.secs); t += 30) { const p = wr(t); seen.add(p.moving ? (p.back ? "back" : "out") : "rest"); if (p.moving) moved++; }
  ok(seen.has("out") && seen.has("back") && seen.has("rest"), "Whiterun's guards walk out, rest and walk back: " + [...seen].join(","));
  const mid = wr(t0 - ((t0 - 1795132800) % (2 * (GUARDS.STOP + b.secs))) + GUARDS.STOP + b.secs / 2).pos, A = b.A, B = b.B;
  ok(Math.hypot(mid[0] - A[0], mid[1] - A[1]) > 0.005 && Math.hypot(mid[0] - B[0], mid[1] - B[1]) > 0.005, "halfway out they're on the road between " + b.seat + " and " + b.to); }
{ const s = c.make("warrior", 10); s.discovered = ["Whiterun"]; const v = GUARDS.visible(s, t0);
  ok(v.some((p) => p.hold === "Whiterun" && p.visible) || v.find((p) => p.hold === "Whiterun").moving, "patrols near places you've found are shown");
  ok(!v.some((p) => p.hold === "The Rift" && p.visible), "patrols far from anywhere you've been stay hidden"); }

// ---- always your level
for (const L of [3, 15, 30, 50]) { const s = c.make("warrior", L); const e = GUARDS.foe(s, "Whiterun");
  ok(e.level === L && e.guard && e.name === "Whiterun guard", `a level ${L} hero meets a level ${e.level} guard`); }
{ const a = GUARDS.foe(c.make("warrior", 10), "Whiterun"), b = GUARDS.foe(c.make("warrior", 40), "Whiterun");
  ok(b.health > a.health * 1.5 && b.damage > a.damage, `guards grow with you (hp ${a.health} → ${b.health}, dmg ${a.damage} → ${b.damage})`); }

// ---- nothing to farm
{ const s = c.make("warrior", 20); const e = GUARDS.foe(s, "Whiterun");
  ok(G.rollLoot ? G.rollLoot(s, e).length === 0 : true, "no loot from a guard");
  ok(e.gold[0] === 0 && e.gold[1] === 0, "no gold from a guard");
  const xp0 = JSON.stringify(s.skills); const f = new G.Fight(s, e); f.xp = { "One-Handed": 50, Block: 20 }; f.won = true; f.apply();
  ok(JSON.stringify(s.skills) === xp0, "no skill XP for fighting a guard");
  const s2 = c.make("warrior", 20), e2 = G.scaleEnemy({ name: "Bandit", health: 100, damage: 10, tags: ["humanoid"], level: 20, danger: "medium", gold: [0, 0], text: "" }, 20);
  const x0 = s2.skills["One-Handed"].xp; const f2 = new G.Fight(s2, e2); f2.xp = { "One-Handed": 50 }; f2.apply();
  ok(JSON.stringify(s2.skills) !== JSON.stringify(c.make("warrior", 20).skills) || s2.skills["One-Handed"].xp !== x0, "a bandit still teaches you"); }
{ const s = c.make("warrior", 20); s.location = "Whiterun"; s.bounty = { Whiterun: 100 }; s.health = G.maxHealth(s);
  const g0 = s.gold, xp0 = JSON.stringify(s.skills); let r = null, tries = 0;
  while (tries++ < 8) { const s1 = JSON.parse(JSON.stringify(s)); s1.health = G.maxHealth(s1); r = TOWNS.guardChoice(s1, "resist"); if (r.fight && r.fight.won) { ok(s1.gold === g0, "beating a guard gives no gold"); ok(JSON.stringify(s1.skills) === xp0, "and no skill XP"); ok(s1.bounty.Whiterun > 100, "only a bigger bounty"); ok(r.fight.e.level === 20, "the guard was your level"); break; } }
  ok(r && r.fight, "resisting arrest starts a fight with a guard"); }
// balance: an equal-level guard is a real fight, not a pushover and not a wall
{ let w = 0; const N = 60; for (let i = 0; i < N; i++) { const s = c.make("warrior", [10, 20, 30][i % 3]); s.health = G.maxHealth(s); const f = new G.Fight(s, GUARDS.foe(s, "Whiterun")); c.TB.simulate(f, { trySneak: false }); if (f.won) w++; }
  console.log("guard fights won", Math.round(100 * w / N) + "%"); ok(w / N > 0.35 && w / N < 0.95, "a guard is a fair fight"); }
// Watch Drills: a Blocking perk for fighting guards
{ const s = c.make("warrior", 20); const e = GUARDS.foe(s, "Whiterun"); const f = new G.Fight(s, e);
  s.perks.watch_drills = 1; ok(Math.abs(c.PFX.sum(s, "out", f, {}) - c.PFX.sum({ ...s, perks: { ...s.perks, watch_drills: 0 } }, "out", f, {}) - 0.1) < 1e-9, "Watch Drills: 10% more damage to guards");
  let w0 = 0, w1 = 0; const N = 60;
  for (let i = 0; i < N; i++) for (const pk of [0, 1]) { const s1 = c.make("warrior", [10, 20, 30][i % 3]); s1.health = G.maxHealth(s1); if (pk) s1.perks.watch_drills = 1; else delete s1.perks.watch_drills;
    const f1 = new G.Fight(s1, GUARDS.foe(s1, "Whiterun")); c.TB.simulate(f1, { trySneak: false }); if (f1.won) pk ? w1++ : w0++; }
  console.log("guards won without/with Watch Drills", w0, w1); ok(w1 >= w0, "Watch Drills helps against guards"); }
console.log(fails ? `failed: ${fails}` : `guards: all ok · ${n} checks`);
process.exit(fails ? 1 : 0);
