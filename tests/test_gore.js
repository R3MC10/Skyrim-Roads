// Blood and gore (gore.js): blow → effect mapping, what bleeds, no kill effects on friends, Off draws nothing,
// the particle cap, and the same spray on two phones. node test_gore.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const store = {};
const c = vm.createContext({ console, Math, JSON, Date, Float32Array, Uint8Array, Object, Array, Set, Map, WeakMap, Number, String,
  localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } });
vm.runInContext(fs.readFileSync(W + "gore.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(fs.readFileSync(W + "combatfx.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const { GORE: X, COMBATFX: CFX } = c;
let n = 0, fails = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };

// the setting
ok(X.level() === "full", "Full by default");
X.setLevel("low"); ok(X.level() === "low" && JSON.parse(store.rotn_prefs).gore === "low", "Low is stored");
ok(CFX.gore() === false, "no beheadings on Low");
X.setLevel("off"); ok(X.level() === "off" && JSON.parse(store.rotn_prefs).gore === false && !X.on(), "Off is stored as the old false");
X.setLevel("full"); ok(X.level() === "full" && CFX.gore() === true, "Full turns everything on");
ok(X.pref("gore", "low") && X.level() === "low" && !X.pref("other", "low"), "settings buttons");
X.setLevel("full");
store.rotn_prefs = JSON.stringify({ gore: true }); ok(X.level() === "full", "an old On save reads as Full");
const html = X.settingsHTML((k, opts, cur) => `${k}:${opts.map((o) => o[0]).join("/")}:${cur}`);
ok(/>Gore</.test(html) && /gore:off\/low\/full:full/.test(html) && /Reduced/.test(fs.readFileSync(W + "gore.js", "utf8")), "the setting row: Gore Off / Reduced / Full");
ok(X.budget({ level: "low", reduce: false, lowGfx: false }) < X.budget({ level: "full", reduce: false, lowGfx: false }), "fewer particles on Low");
ok(X.budget({ level: "full", reduce: true, lowGfx: false }) < X.budget({ level: "full", reduce: false, lowGfx: false }), "fewer with reduced motion");
ok(X.budget({ level: "full", reduce: false, lowGfx: true }) < X.budget({ level: "full", reduce: false, lowGfx: false }), "fewer on low graphics");
ok(X.budget({ level: "off" }) === 0, "none when Off");

// blows → kinds
const M = { sword: { fx: "slash" }, dagger: { fx: "stab" }, mace: { fx: "dust" }, bow: { proj: [0.5, 0.7, "arrow"] }, cast: { proj: [0.4, 0.6, "spell"] }, bite: { fx: "bite" }, claw: { fx: "claw" } };
ok(X.typeOf({ move: "sword" }, M.sword) === "slash" && X.typeOf({ move: "claw" }, M.claw) === "slash", "swords and claws slash");
ok(X.typeOf({ move: "dagger" }, M.dagger) === "pierce" && X.typeOf({ move: "bow" }, M.bow) === "pierce" && X.typeOf({ move: "bite" }, M.bite) === "pierce", "daggers, arrows and bites pierce");
ok(X.typeOf({ move: "mace" }, M.mace) === "blunt" && X.typeOf({ fx: "fus", move: "shout" }, {}) === "blunt", "maces and the Voice are blunt");
ok(X.typeOf({ move: "cast", el: "fire" }, M.cast) === "fire" && X.typeOf({ move: "cast", fx: "frost" }, M.cast) === "frost" && X.typeOf({ move: "cast", el: "shock" }, M.cast) === "shock", "spells by element");
ok(X.typeOf({ move: "cast", fx: "heal" }, M.cast) === "magic", "other spells are just magic");
ok(X.typeOf({ move: "dagger", el: "poison" }, M.dagger) === "poison", "poison");

// what each blow does to each thing
const E = X.effectOf;
ok(E("slash", "blood").blood && E("slash", "blood").arc, "a slash throws an arc of blood");
ok(E("pierce", "blood", { arrow: true }).arrow && E("pierce", "blood", { arrow: true }).blood, "an arrow sticks in and bursts");
ok(E("blunt", "blood").heavy && E("blunt", "blood").dust, "blunt splats heavy, with dust");
const fire = E("fire", "blood"); ok(!fire.blood && fire.scorch && fire.char, "fire scorches and chars, no blood");
ok(E("frost", "blood").shards, "frost throws ice shards");
ok(E("shock", "blood").sparks && !E("shock", "blood").blood, "lightning throws sparks");
ok(E("poison", "blood").green, "poison drips green");
for (const t of ["slash", "pierce", "blunt", "frost", "shock", "poison", "fire"]) {
  ok(!E(t, "bone").blood, `${t}: skeletons don't bleed`);
  ok(!E(t, "oil").blood, `${t}: machines don't bleed`);
  ok(!E(t, "spirit").blood, `${t}: spirits don't bleed`);
}
ok(E("slash", "bone").chips && E("slash", "bone").dust, "bone chips and dust");
ok(E("blunt", "oil").oil && E("blunt", "oil").sparks && E("blunt", "oil").gears, "oil, sparks and gears from machines");
ok(E("slash", "spirit").wisps, "ectoplasm from spirits");
ok(E("pierce", "blood", { arrow: true, ally: true }).arrow === false, "no arrows left sticking in friends");
// materials
ok(X.matOf("skeleton", "Skeleton") === "bone" && X.matOf("draugr", "Draugr Wight") === "bone", "the walking dead are bone");
ok(X.matOf("sphere", "Dwarven Sphere") === "oil" && X.matOf("centurion", "Dwarven Centurion") === "oil" && X.matOf("dspider", "Dwarven Spider") === "oil", "Dwemer machines are oil");
ok(X.matOf("wisp", "Wispmother") === "spirit" && X.matOf("bandit", "Ghost of Old Hroldan") === "spirit", "spirits and ghosts");
ok(X.matOf("bandit", "Dremora Churl") === "ichor", "daedra bleed ichor");
ok(X.matOf("dragon", "Blood Dragon") === "dragon", "dragons");
ok(X.matOf("falmer", "Falmer Skulker") === "green" && X.matOf("spider", "Chaurus Reaper") === "green", "Falmer and chaurus are green");
ok(X.matOf("bandit", "Bandit") === "blood" && X.matOf("vampire", "Vampire", ["undead"]) === "blood", "people (vampires too) bleed red");
ok(X.MAT[X.matOf("dragon", "Dragon")][2] === "blood" && X.MAT.green[0] !== X.MAT.blood[0], "dragon blood is still blood; green is green");

// a stage
const mkScene = (o = {}) => X.scene({ W: 400, H: 180, s: 1.2, seed: 12345, foeK: "bandit", foeName: "Bandit", level: "full", reduce: false, lowGfx: false, ...o });
const foe = { side: "foe", x: 290, y: 100 };
// kill effects: foes only
{ const S = mkScene();
  for (const side of ["hero", "ally", "horse"]) ok(S.kill({ side, x: 100, y: 100 }, { death: "topple", crit: true }) === null, `no kill effects on ${side === "hero" ? "you" : side + "s"}`);
  ok(S.stains() === 0 && S.count() === 0 && S.flyers().length === 0, "nothing at all from a friend's 'kill'");
  const k = S.kill(foe, { death: "topple", crit: true, key: 1 }); ok(k.burst && k.pool, "a foe's death: a burst and a pool");
  for (let i = 0; i < 120; i++) S.update(1 / 30);
  ok(S.stains() > 2, "drops landed and stayed as splats");
  const hit = S.hit({ side: "ally", x: 80, y: 100 }, { type: "slash", frac: 0.3, key: "a" }); ok(hit && hit.blood, "allies still get hit effects"); }
// flourishes only on strong finishers, only on Full
{ let any = 0; for (let k = 0; k < 20; k++) { const S = mkScene({ seed: k }); const r = S.kill({ ...foe, person: true }, { death: "topple", crit: true, key: k }); if (r.flourish) { any++; ok(["helm", "blade"].includes(r.flourish), "people lose a helmet or a weapon"); } } ok(any > 3, "strong finishers sometimes have a flourish"); }
{ let any = 0; for (let k = 0; k < 20; k++) { const S = mkScene({ seed: k }); if (S.kill(foe, { death: "topple", key: k }).flourish) any++; } ok(any === 0, "plain kills never do"); }
{ let any = 0; for (let k = 0; k < 20; k++) { const S = mkScene({ seed: k, level: "low" }); if (S.kill(foe, { death: "topple", crit: true, key: k }).flourish) any++; } ok(any === 0, "no flourishes on Low"); }
{ let shapes = new Set(); for (let k = 0; k < 30; k++) { const S = mkScene({ seed: k, foeK: "wolf", foeName: "Wolf" }); const r = S.kill(foe, { death: "topple", power: true, key: k }); if (r.flourish) shapes.add(r.flourish); } ok(shapes.has("limb") && shapes.size === 1, "beasts lose a limb"); }
{ let shapes = new Set(); for (let k = 0; k < 30; k++) { const S = mkScene({ seed: k, foeK: "skeleton", foeName: "Skeleton" }); const r = S.kill({ ...foe, person: true }, { death: "topple", crit: true, key: k }); if (r.flourish) shapes.add(r.flourish); ok(!r.pool, "skeletons leave no pool of blood"); } ok(shapes.has("bone"), "skeletons lose a bone"); }
// fire leaves no blood
{ const S = mkScene(); S.hit(foe, { type: "fire", frac: 0.5, key: 1 }); const snap = JSON.parse(S.snapshot()); ok(snap[0].every((p) => p[0] !== 0), "no drops from a fire hit"); ok(S.stains() === 1 && snap[1][0].k === 2, "just a scorch mark"); }
{ const S = mkScene({ foeK: "skeleton", foeName: "Skeleton" }); S.hit(foe, { type: "slash", frac: 0.5, key: 1 }); const snap = JSON.parse(S.snapshot()); ok(snap[0].every((p) => p[0] !== 0) && snap[0].some((p) => p[0] === 3), "skeletons: chips, no drops"); }
{ const S = mkScene({ foeK: "sphere", foeName: "Dwarven Sphere" }); S.hit(foe, { type: "slash", frac: 0.5, key: 1 }); const snap = JSON.parse(S.snapshot()); ok(snap[0].every((p) => p[0] !== 0 || p[1] === X.MAT.oil[0] || p[1] === X.MAT.oil[1]), "machines: oil, never blood"); ok(snap[0].some((p) => p[0] === 6), "a gear flies"); }
// bigger hits spray more
{ const a = mkScene(), b = mkScene(); a.hit(foe, { type: "slash", frac: 0.05, key: 1 }); b.hit(foe, { type: "slash", frac: 0.4, crit: true, key: 1 }); ok(b.count() > a.count(), "a critical sprays more than a scratch"); }
// arrows stick (in foes)
{ const S = mkScene(); for (let i = 0; i < 5; i++) S.hit(foe, { type: "pierce", arrow: true, frac: 0.1, key: i }); ok(S.marks("foe").arrows.length === 3, "up to 3 arrows stick in"); }
// Off draws nothing
{ const S = mkScene({ level: "off" }); let calls = 0;
  const g = new Proxy({}, { get: (t, k) => (typeof k === "string" && /fill|stroke|arc|ellipse|beginPath|moveTo|lineTo|save|drawImage|rect|translate/.test(k) ? () => { calls++; } : undefined), set: () => true });
  ok(S.hit(foe, { type: "slash", frac: 0.9, crit: true, key: 1 }) === null && S.kill(foe, { crit: true }) === null, "Off: nothing happens");
  S.update(0.1); S.drawGround(g); S.drawMarks(g, "foe", 300, 100, 1.2, 0.1); S.drawFront(g); ok(calls === 0 && S.count() === 0 && S.stains() === 0, "Off draws nothing"); }
// drawing works on a counting canvas
{ const S = mkScene(); let calls = 0;
  const g = new Proxy({}, { get: (t, k) => (k === "globalAlpha" || k === "fillStyle" ? 1 : () => { calls++; }), set: () => true });
  S.hit(foe, { type: "slash", frac: 0.5, key: 1 }); S.update(0.05); S.drawFront(g); for (let i = 0; i < 60; i++) S.update(1 / 30); S.drawGround(g); S.drawMarks(g, "foe", 290, 100, 1.2, 0.3); ok(calls > 20, "Full draws"); }
// the particle cap
{ const S = mkScene(); for (let i = 0; i < 80; i++) S.hit(foe, { type: "slash", frac: 1, crit: true, power: true, key: i }); ok(S.count() <= S.cap && S.cap <= 220, `capped at ${S.cap}: ${S.count()} alive`);
  for (let i = 0; i < 400; i++) S.update(1 / 30); ok(S.stains() <= 80, "splats are capped too: " + S.stains()); }
{ const S = mkScene({ level: "low" }); for (let i = 0; i < 80; i++) S.hit(foe, { type: "slash", frac: 1, crit: true, key: i }); ok(S.count() <= 90, "Low keeps far fewer"); }
// two phones, same fight, same blows → the same spray
{ const run = () => { const S = mkScene({ seed: X.hash("Bandit|120") });
    S.hit(foe, { type: "slash", frac: 0.3, crit: true, from: 1, key: "3|5|me|22|0" }); S.update(1 / 60); S.update(1 / 30);
    S.hit({ side: "hero", x: 110, y: 100, live: false }, { type: "blunt", frac: 0.2, from: -1, key: "3|6|them|14|0" });
    S.kill(foe, { death: "topple", crit: true, key: "k" }); for (let i = 0; i < 50; i++) S.update(1 / 30); return S.snapshot(); };
  const real = Math.random; let a, b;
  Math.random = () => 0.1; a = run(); Math.random = () => 0.9; b = run(); Math.random = real;
  ok(a === b && a.length > 50, "identical spray on two phones");
  const S2 = mkScene({ seed: X.hash("Bandit|120") }); S2.hit(foe, { type: "slash", frac: 0.3, crit: true, from: 1, key: "other" });
  const S1 = mkScene({ seed: X.hash("Bandit|120") }); S1.hit(foe, { type: "slash", frac: 0.3, crit: true, from: 1, key: "3|5|me|22|0" });
  ok(S1.snapshot() !== S2.snapshot(), "a different blow sprays differently"); }
ok(!/Math\.random/.test(fs.readFileSync(W + "gore.js", "utf8")), "gore.js never uses Math.random");
// splats stay for every turn of the same fight
{ const fight = {}; const S = mkScene({ fight }); S.hit(foe, { type: "blunt", frac: 0.5, key: 1 }); for (let i = 0; i < 60; i++) S.update(1 / 30); const kept = S.stains();
  const S2 = mkScene({ fight }); ok(kept > 0 && S2.stains() === kept, "the next turn's stage still has the splats");
  ok(mkScene({ fight: {} }).stains() === 0, "a new fight starts clean"); }
// spray direction: away from the attacker
{ const S = mkScene(); S.hit(foe, { type: "slash", frac: 0.4, from: 1, key: 1 }); const p = JSON.parse(S.snapshot())[0].filter((q) => q[0] === 0); ok(p.length && p.reduce((a, q) => a + q[4], 0) > 0, "your blow sprays away from you");
  const T = mkScene(); T.hit({ side: "hero", x: 110, y: 100, live: false }, { type: "slash", frac: 0.4, from: -1, key: 1 }); const q2 = JSON.parse(T.snapshot())[0].filter((q) => q[0] === 0); ok(q2.reduce((a, q) => a + q[4], 0) < 0, "the foe's blow sprays you backwards"); }
// index.html loads it, the settings use it, the Polish is there
{ const html = fs.readFileSync(W + "index.html", "utf8"), ui = fs.readFileSync(W + "ui.js", "utf8"), pl = fs.readFileSync(W + "i18n_gore.js", "utf8"), fa = fs.readFileSync(W + "fightart.js", "utf8");
  ok(html.indexOf('src="gore.js"') > 0 && html.indexOf('src="gore.js"') < html.indexOf('src="fightart.js"'), "gore.js loads before fightart.js");
  ok(html.indexOf('src="i18n_gore.js"') > 0 && html.indexOf('src="i18n_gore.js"') < html.indexOf('src="i18n.js"'), "Polish loads before i18n.js");
  ok(/\.gorevig\{/.test(html), "the screen-edge flash has its style");
  ok(/GORE\.settingsHTML\(seg\)/.test(ui) && /GORE\.pref\(k/.test(ui), "Settings → Fights shows Gore");
  ok(/"Gore": "/.test(pl) && /"Reduced": "/.test(pl), "Polish for the setting");
  ok(/GS\.hit\(/.test(fa) && /GS\.kill\(/.test(fa) && /GS\??\.drawGround\(/.test(fa) && /GS\.drawFront\(/.test(fa), "fightart.js calls the hooks"); }
console.log(fails ? `gore: ${fails} FAILED of ${n}` : `gore ok · ${n} checks`);
if (fails) process.exit(1);
