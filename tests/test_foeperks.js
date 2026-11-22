/* Foe perks (foeperks.js): humanoid foes get real perks by level and archetype; beasts don't; the perks act in fights.
   W=/path/to/web/ node test_foeperks.js   — prints "foeperks ok" */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Proxy, process: { env: process.env } };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "magic.js", "ammo.js", "perkfx.js", "foeperks.js", "combatai.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const ok = (cond, msg) => { n++; if (!cond) throw new Error("FAIL: " + msg); };
const all = [...D.ENCOUNTERS.filter((e) => e.health), ...Object.values(DUNGEONS.ENEMY)];
const byName = (re) => all.find((e) => re.test(e.name));
// 1. who gets perks
for (const re of [/^Skeever/, /wolf/i, /Sabre/, /bear/i, /spider/i, /troll/i, /Giant/, /Dragon$/, /Dwarven/]) { const e = byName(re); if (e) ok(!FOEPERKS.humanoid(e) && FOEPERKS.build(G.scaleEnemy({ ...e }, 30)) === null, "no perks for " + e.name); }
for (const re of [/Bandit/, /Draugr/, /Vampire/, /Necromancer/, /Thalmor/, /Forsworn/]) { const e = byName(re); ok(e && FOEPERKS.humanoid(e), "humanoid " + re); }
// 2. valid perks: exist, ranks within max, prerequisites held, skill requirement met, points within budget
const def = {}; for (const ps of Object.values(PERKS.TREES)) for (const p of ps) def[p[0]] = p;
for (const L of [1, 5, 10, 20, 30, 40, 60]) for (const e0 of all) {
  const e = G.scaleEnemy({ ...e0 }, L), fp = FOEPERKS.build(e);
  if (!fp) continue;
  const spent = Object.values(fp.perks).reduce((a, b) => a + b, 0);
  ok(spent <= fp.points, "budget " + e.name + " L" + L);
  for (const [id, r] of Object.entries(fp.perks)) {
    const p = def[id]; ok(p, "perk exists " + id);
    ok(r >= 1 && r <= p[2], "rank " + id);
    ok(!p[4].length || p[4].some((q) => fp.perks[q]), "prereq " + id + " for " + e.name);
  }
  for (const k of ["dmg", "spell", "taken", "crit", "block", "power", "opener", "ward"]) ok(isFinite(fp[k]), "number " + k);
  ok(fp.taken >= 0.6 && fp.dmg <= 2.2 && fp.ward <= 0.45, "caps " + e.name);
}
// 3. more perks with level, deterministic
const b = byName(/Bandit chief/i) || byName(/Bandit/);
const lo = FOEPERKS.build(G.scaleEnemy({ ...b, level: 3 }, 3)), hi = FOEPERKS.build(G.scaleEnemy({ ...b, level: 40 }, 40));
ok((lo ? lo.points : 0) < hi.points && Object.keys(hi.perks).length > (lo ? Object.keys(lo.perks).length : 0), "perks grow with level");
const again = FOEPERKS.build(G.scaleEnemy({ ...b, level: 40 }, 40)); ok(JSON.stringify(again.perks) === JSON.stringify(hi.perks), "same foe, same perks");
// 4. archetypes
const arch = (name) => FOEPERKS.archetype({ name, tags: ["humanoid"] });
ok(arch("Bandit archer") === "archer", "archer"); ok(arch("Necromancer") === "necro", "necro"); ok(arch("Fire mage") === "mage_fire", "fire mage");
ok(arch("Dark Brotherhood assassin") === "assassin", "assassin"); ok(arch("Bandit chief") === "twohand", "two-hander");
const mage = FOEPERKS.build(G.scaleEnemy({ name: "Thalmor justiciar", level: 30, tags: ["humanoid", "mage"], health: 200, damage: 20 }, 30));
ok(mage.caster && mage.perks.augmented_flames || mage.perks.augmented_frost || mage.perks.augmented_shock, "mage takes augmented element perks");
const war = FOEPERKS.build(G.scaleEnemy({ name: "Bandit marauder", level: 30, tags: ["humanoid"], health: 200, damage: 20 }, 30));
ok(war.perks.barbarian || war.perks.armsman, "warrior takes weapon perks");
ok(FOEPERKS.label({ name: "x", fp: war }).length > 0 && /·/.test(FOEPERKS.label(G.scaleEnemy({ ...b, level: 30 }, 30))), "label");
// 5. effects apply in fights: same fight, perks on vs off; foe hits harder and takes less
function make(L) { const s = G.newSave("t", "T", "nord"); s._test = true; s.level = L; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun;
  for (const k of ["One-Handed", "Heavy Armor"]) s.skills[k].lvl = 60; const id = G.give(s, "steel_sword"); G.equip(s, id); G.loadout(s).mode = "smart"; return s; }
function trial(on) {
  let dealt = 0, took = 0;
  for (let i = 0; i < 300; i++) {
    const s = make(25); s.health = G.maxHealth(s); s.healthTs = G.now();
    const e = G.scaleEnemy({ name: "Bandit marauder", level: 30, tags: ["humanoid"], health: 400, damage: 22 }, 25); if (!on) e.fp = null;
    const f = new G.Fight(s, e, null); f.hp = 1e6; const ehp0 = f.ehp;
    f.run({ trySneak: false, maxTurns: 6 }); dealt += ehp0 - f.ehp; took += 1e6 - f.hp;
  }
  return { dealt, took };
}
const off = trial(false), on = trial(true);
ok(on.took > off.took * 1.08, "perked foe hits harder " + Math.round(on.took) + " vs " + Math.round(off.took));
ok(on.dealt < off.dealt * 0.97, "perked foe takes less " + Math.round(on.dealt) + " vs " + Math.round(off.dealt));
// 6. fight log line and Smart AI estimate
const s = make(20), e = G.scaleEnemy({ ...b, level: 25 }, 20); const f = new G.Fight(s, e, null);
ok(f.fpLine && f.fpLine.includes("·"), "fight carries a perk line");
ok(FOEPERKS.expect(e) > 1, "Smart AI expects perked foes to hit harder");
ok(FOEPERKS.expect({ name: "Wolf", tags: ["beast"], health: 10, damage: 3 }) === 1, "beasts: no change");
// 7. a mage foe's blows carry its element
const m2 = G.scaleEnemy({ name: "Thalmor justiciar", level: 30, tags: ["humanoid", "mage"], health: 200, damage: 20 }, 30); FOEPERKS.build(m2);
ok(["fire", "frost", "shock"].includes(m2.element) && PFX.foeElement(m2), "mage foe has an element");
console.log("level-30 bandit marauder vs a level-25 hero, 300×6 turns: damage taken by hero " + Math.round(off.took) + " → " + Math.round(on.took) + ", damage dealt to foe " + Math.round(off.dealt) + " → " + Math.round(on.dealt));
console.log("foeperks ok · " + n + " checks");
`, c);
