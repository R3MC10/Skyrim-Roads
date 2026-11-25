// Realistic splatter (gorefx2.js on top of gore.js): which sprites a blow plays, decals, the setting, the cap,
// friends never splattered, sprite files present and sized. node test_gorefx2.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const store = {};
const c = vm.createContext({ console, Math, JSON, Date, Float32Array, Uint8Array, Object, Array, Set, Map, WeakMap, Number, String,
  localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } });
for (const f of ["gore.js", "gorefx2.js"]) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const { GORE, GOREFX2: F } = c;
let n = 0, fails = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const keys = (p) => p.map((x) => x[0]);

// what a blow plays
ok(keys(F.planOf("slash", "blood", {})).some((k) => /^b[12]$/.test(k)), "a slash on a bandit sprays a blood burst");
ok(!keys(F.planOf("slash", "blood", { level: "low" })).some((k) => /^b|jet/.test(k)), "Low: no rendered blood");
const crit = keys(F.planOf("slash", "blood", { crit: true })), fin = keys(F.planOf("slash", "blood", { final: true }));
ok(crit.includes("jet") && crit.length > keys(F.planOf("slash", "blood", {})).length, "a critical adds a jet");
ok(fin.includes("jet") && fin.includes("b3"), "a finisher adds a jet and a wide splash");
ok(keys(F.planOf("blunt", "blood", {})).includes("dust"), "blunt raises dust");
ok(F.planOf("blunt", "blood", {})[0][1] < F.planOf("slash", "blood", {})[0][1], "blunt spills less blood");
const bone = keys(F.planOf("slash", "bone", { crit: true }));
ok(bone.includes("bone") && !bone.some((k) => /^b[123]$|jet/.test(k)), "draugr and skeletons: grave dust and chips, no red blood");
const oil = keys(F.planOf("slash", "oil", {}));
ok(oil.includes("oil") && oil.includes("sparks") && !oil.some((k) => /^b[123]$/.test(k)), "Dwemer machines: oil and sparks");
ok(keys(F.planOf("frost", "blood", {})).includes("frost") && keys(F.planOf("fire", "blood", {})).join() === "embers", "frost shards; fire embers and no blood");
ok(keys(F.planOf("shock", "blood", {})).join() === "shock" && keys(F.planOf("magic", "blood", {})).join() === "motes", "shock arcs; magic motes");
ok(keys(F.planOf("slash", "green", {})).includes("green") && keys(F.planOf("slash", "ichor", {})).includes("ichor"), "Falmer bleed green, daedra ichor");
ok(F.planOf("slash", "blood", { frac: 0.6 })[0][1] > F.planOf("slash", "blood", { frac: 0.05 })[0][1], "bigger blows, bigger bursts");
ok(F.planOf("slash", "blood", { side: "ally" })[0][1] < F.planOf("slash", "blood", {})[0][1], "friends bleed less");
ok(keys(F.planOf("slash", "blood", { metal: true })).includes("sparks"), "a blade on armour sparks");
// decals
ok(F.decalOf("slash", "blood", { crit: true }).ground === 1 && F.decalOf("slash", "blood", { final: true }).ground === 2, "crits and finishers splatter the ground");
ok(F.decalOf("slash", "blood", { frac: 0.05 }).ground === 0, "a scratch leaves no splatter");
ok(!F.decalOf("slash", "blood", { crit: true, side: "ally" }).body && !F.decalOf("slash", "blood", { crit: true, side: "horse" }).body, "followers and horses are never smeared");
ok(F.decalOf("slash", "bone", { crit: true }).ground === 0 && F.decalOf("fire", "blood", { final: true }).ground === 0, "no blood splatter from bones or fire");
ok(F.decalOf("slash", "blood", { crit: true, level: "low" }).ground === 0, "Low: no splatter decals");

// the stage hook
ok(GORE.scene.fx2 === true, "gore.js stages are wrapped");
GORE._setLevel("full");
const fight = {};
let S = GORE.scene({ fight, W: 400, H: 180, s: 1.2, foeK: "bandit", foeName: "Bandit outlaw", ehpMax: 120 });
ok(S.fx2 && typeof S.fx2count === "function", "a stage gets the sprite layer");
for (let i = 0; i < 60; i++) S.hit({ side: "foe", x: 300, y: 100 }, { type: "slash", frac: 0.4, crit: true, from: 1, key: "k" + i });
S.update(0.016);
ok(S.fx2count() > 0 && S.fx2count() <= 24, "live sprites are capped (" + S.fx2count() + ")");
ok(S.fx2decals().ground > 0 && S.fx2decals().ground <= 14 && S.fx2decals().body <= 6, "decals capped");
for (let i = 0; i < 80; i++) S.update(0.1);
ok(S.fx2count() === 0, "bursts end");
const g0 = S.fx2decals().ground; for (let i = 0; i < 500; i++) S.update(0.1);
ok(S.fx2decals().ground < g0, "splatters fade over the fight");
const before = S.fx2decals().body;
S.hit({ side: "ally", x: 100, y: 100 }, { type: "slash", frac: 0.9, crit: true, from: -1, key: "a" });
ok(S.fx2decals().body === before, "no smear on a follower");
ok(S.kill({ side: "ally", x: 100, y: 100 }, { crit: true }) === null, "followers are never killed");
const r = S.kill({ side: "foe", x: 300, y: 100, bodyX: 320 }, { crit: true, slowmo: true, key: 9 });
ok(r && r.burst && S.fx2decals().ground > 0, "a finisher bursts and pools");
// turn-by-turn: a new stage of the same fight keeps the splatters
const S2 = GORE.scene({ fight, W: 400, H: 180, s: 1.2, foeK: "bandit", foeName: "Bandit outlaw", ehpMax: 120 });
ok(S2.fx2decals().ground === S.fx2decals().ground, "splatters stay turn to turn");
// a drawing smoke test on a fake canvas (no pictures yet: nothing drawn, nothing thrown)
const g = new Proxy({}, { get: (t, k) => (k === "getTransform" ? () => ({ a: 2, b: 0 }) : k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
let threw = false; try { S.drawGround(g); S.drawMarks(g, "foe", 300, 100, 1.2, 0.4, false); S.drawFront(g); } catch (e) { threw = e; }
ok(!threw, "draws without pictures " + threw);
// Off: nothing
GORE._setLevel("off");
const So = GORE.scene({ W: 400, H: 180 });
So.hit({ side: "foe", x: 1, y: 1 }, { crit: true, frac: 1 }); So.update(0.02);
ok(!So.fx2count, "Off: no sprite layer");
GORE._setLevel(null);

// files: every sprite strip is there, a WebP, and sensibly sized
for (const [k, v] of Object.entries(F.SH)) {
  const p = W + v[0] + ".webp"; ok(fs.existsSync(p), "file " + v[0]);
  ok(v[2] <= 256 && v[3] <= 256, k + " frames ≤256px");
  if (fs.existsSync(p)) ok(fs.statSync(p).size < 300 * 1024, k + " under 300 KB");
}
for (const [k, v] of Object.entries(F.DEC)) { ok(fs.existsSync(W + v[0] + ".webp"), "decal atlas " + k); ok(v[1] <= 512, k + " decals ≤512px"); }
ok(/gfx-<effect>[^]{0,400}blood-burst/.test(fs.readFileSync(W + "assets.js", "utf8")), "listed in assets.js");
const idx = fs.readFileSync(W + "index.html", "utf8");
ok(idx.indexOf("gorefx2.js") > idx.indexOf('"gore.js"') && idx.indexOf("gorefx2.js") < idx.indexOf('"fightart.js"'), "loaded after gore.js, before fightart.js");

console.log(fails ? `test_gorefx2: ${fails}/${n} FAILED` : `test_gorefx2: ${n} ok`);
process.exit(fails ? 1 : 0);
