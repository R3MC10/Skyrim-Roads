// Combat effects rules (combatfx.js): deaths, blood, enchant glows, the camera, sounds, and the Headsman perk. node test_combatfx.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).concat(["combatfx.js"]).filter((f, i, a) => a.indexOf(f) === i);
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { COMBATFX: X, G, PFX } = c;
const never = () => 0.99, always = () => 0;
// deaths
const sword = { who: "me", move: "sword", wt: "sword" };
ok(X.deathOf({ ...sword, crit: true }, "bandit", { melee: true, person: true, gore: true, rnd: never }) === "decap", "a critical sword kill takes a bandit's head");
ok(X.deathOf(sword, "bandit", { melee: true, person: true, gore: true, rnd: never }) === "topple", "a plain sword kill usually just drops them");
ok(X.deathOf(sword, "bandit", { melee: true, person: true, gore: true, rnd: always }) === "decap", "...but now and then takes the head");
ok(X.deathOf({ ...sword, crit: true }, "bandit", { melee: true, person: true, gore: false }) !== "decap", "no beheading with blood off");
ok(X.deathOf({ ...sword, crit: true }, "wolf", { melee: true, person: false, gore: true }) !== "decap", "no beheading beasts");
ok(X.deathOf({ ...sword, crit: true }, "sphere", { melee: true, person: true, gore: true }) !== "decap", "no beheading machines");
ok(X.deathOf({ who: "me", move: "cast", el: "fire", fx: "fire" }, "bandit", { melee: false, person: true }) === "ash", "fire burns to ash");
ok(X.deathOf({ who: "me", move: "cast", el: "frost", fx: "frost" }, "troll", { melee: false, person: true }) === "shatter", "frost shatters");
ok(X.deathOf({ who: "me", move: "cast", el: "shock", fx: "shock" }, "bear", { melee: false }) === "fry", "lightning fries");
ok(X.deathOf({ who: "me", move: "warhammer", wt: "warhammer", power: true }, "bandit", { melee: true, person: true }) === "launch", "a hammer power blow launches");
ok(X.deathOf({ who: "me", move: "shout", fx: "fus" }, "bandit", {}) === "launch", "a Shout launches");
ok(X.deathOf(sword, "wisp", { melee: true }) === "fade" && X.deathOf(sword, "atronach", { melee: true }) === "fade", "spirits fade");
ok(X.deathOf({ ...sword, enchant: "fire" }, "wolf", { melee: true, rnd: never }) === "ash", "a fire-enchanted blade burns");
// what bleeds
ok(X.bleedOf("bandit")[2] === "blood" && X.bleedOf("skeleton")[2] === "bone" && X.bleedOf("sphere")[2] === "oil" && X.bleedOf("wisp")[2] === "none", "blood, bone, oil, nothing");
// glows
ok(X.glowOf("fire")[0] === "#ff7a2a" && X.glowOf("frost") !== X.glowOf("fire") && X.glowOf("absorb")[0] === X.glowOf("drain")[0], "glows are colour coded");
ok(X.glowOf(null) === null && Array.isArray(X.glowOf("something odd")), "no enchantment, no glow; unknown ones still glow");
ok(X.enchantOf({ weapon: { enchant: { effect: "shock" } } }) === "shock" && X.enchantOf({ weapon: {} }) === null && X.enchantOf({ off: { enchant: { effect: "fire" } } }) === "fire", "reads the main or off-hand enchantment");
// the camera
{ let lo = 9, hi = 0;
  for (const b of [sword, { ...sword, crit: true }, { ...sword, final: true }, { who: "them", move: "bite" }, { who: "me", move: "potion" }]) for (let u = 0; u <= 1; u += 0.05) { const [fx, z] = X.camFor(b, u); lo = Math.min(lo, fx, z); hi = Math.max(hi, z); ok(fx > 0.2 && fx < 0.8 && z >= 1 && z <= 1.25, `camera stays sane: ${fx.toFixed(2)} ${z.toFixed(2)}`); }
  n -= 104; ok(hi > 1.2, "the killing blow gets the closest shot");
  ok(X.camFor({ ...sword, crit: true }, 0.9)[1] > X.camFor(sword, 0.9)[1], "a critical punches in closer than a plain blow");
  ok(X.camFor(sword, 0.9)[0] > X.camFor(sword, 0.1)[0], "the camera follows your blow to the foe");
  ok(X.camFor({ who: "them", move: "bite" }, 0.9)[0] < 0.5, "and the foe's blow to you"); }
ok(Math.abs(X.pan(0, 1.2, 400, 200) - 40) < 1e-9 && Math.abs(X.pan(400, 1.2, 400, 200) + 40) < 1e-9 && X.pan(999, 1, 400, 200) === 0, "the pan never shows past the picture");
// sounds
ok(X.soundOf({ miss: true }, "bandit") === "swing" && X.soundOf({ blocked: true }, "bandit") === "clang", "miss and block sounds");
ok(X.soundOf({ who: "me", el: "fire" }, "bandit", false) === "spell-fire" && X.soundOf({ who: "me", crit: true }, "bandit", true) === "hit-crit", "spell and crit sounds");
ok(X.soundOf({ who: "me" }, "bandit", true, true) === "hit-gore" && X.soundOf({ who: "me" }, "bandit", true, false) === "hit", "wet hits only with blood on");
ok(X.soundOf({ who: "me" }, "sphere", true, true) === "clang", "machines clang");
// Headsman: more damage to a nearly-dead foe, nothing above a quarter
{ const s = c.make("twohand", 40); s.perks = { ...(s.perks || {}), headsman: 2 };
  const e = G.scaleEnemy(c.D.ENCOUNTERS.find((x) => x.name === "Bandit") || c.D.ENCOUNTERS[0], 40), f = new G.Fight(s, e);
  const x = { sk: "Two-Handed" };
  f.ehp = (f.e.health || f.ehp0) * 0.9; const hi = PFX.out(f, x);
  f.ehp = (f.e.health || f.ehp0) * 0.2; const lo = PFX.out(f, x);
  ok(Math.abs(lo - hi - 0.3) < 1e-9, `Headsman rank 2: +30% on a foe below a quarter (${hi.toFixed(2)} → ${lo.toFixed(2)})`);
  ok(PFX.out(f, { sk: "One-Handed" }) === hi || PFX.out(f, { sk: "One-Handed" }) < lo, "only with a two-hander"); }
console.log(`combatfx: ${n - fails}/${n} ok`);
if (fails) process.exit(1);
