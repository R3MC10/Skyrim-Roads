const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Quest-fight scaling: every story fight (main quest, guild lines, skill-check fights, dragon priests, Brotherhood
   contracts) by build and level, before (B) and after (W). Realistic builds come from test_bal_sim.js; "plain" is a
   level-L hero in untempered steel with 3 perks and two minor potions.
   W=/path/to/new/ B=/path/to/base/ node test_qscale.js [runs]
   Targets checked on W: at or above a fight's recommended level, realistic builds win ≥70% on average and every
   build ≥50%; plain wins ≥40% above the recommended level (+5). Road encounters are untouched (same scaleEnemy). */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "", B = process.env.B || "";
const RUNS = +(process.argv[2] || 120);
const SIM = fs.readFileSync(__dirname + "/" + "test_bal_sim.js", "utf8");
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "mp.js"];
const LEVELS = [5, 10, 20, 30, 40], BUILDS = ["warrior", "twohand", "archer", "sneakarcher", "mage", "spellsword", "plain"];

function load(dir) {
  const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS };
  vm.createContext(c);
  for (const f of FILES) if (fs.existsSync(dir + f)) vm.runInContext(fs.readFileSync(dir + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
  vm.runInContext(SIM.slice(SIM.indexOf("const LEVELS"), SIM.indexOf("const BUILDS")) + `
function makePlain(L) {
  const s = G.newSave("sim", "Plain", "nord"); s._test = true; s.level = L; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun;
  for (const [k, w] of MAIN.warrior) s.skills[k].lvl = Math.min(100, Math.round(s.skills[k].lvl + 2.3 * L * w * 0.8));
  const ups = (L - 1) * 10; s.hpBonus = Math.round(ups * 0.6); s.spBonus = Math.round(ups * 0.4);
  let n = 0; while (PERKS.pointsLeft(s) > 0 && n < 3) { const o = PERKS.TREES["One-Handed"].concat(PERKS.TREES["Heavy Armor"]).map((p) => p[0]).filter((id) => !PERKS.canTake(s, id)); if (!o.length) break; PERKS.take(s, o[0]); n++; }
  for (const it of ["steel_sword", "steel_helmet", "steel_armor", "steel_gauntlets", "steel_boots", "steel_shield"]) G.equip(s, G.give(s, it));
  G.give(s, "potion_health_minor", 2);
  G.loadout(s).rules = [{ if: "hp_below", pct: 40, do: "potion:health" }, { if: "sp_above", pct: 70, do: "power_attack" }, { if: "always", do: "attack" }];
  G.setHealth(s, G.maxHealth(s)); return s;
}
// every story fight: [label, line, stage, def, allies, kind]
const FIGHTS = [];
for (const [id, line] of Object.entries(QUESTS.L)) line.stages.forEach((st, i) => {
  const o = st.obj || {};
  if (o.fight) FIGHTS.push({ label: o.fight.name, id, i, def: o.fight, allies: o.allies || [], st });
  if (o.check && o.check.fight) FIGHTS.push({ label: o.check.fight.name + " (check failed)", id, i, def: o.check.fight, allies: o.allies || [], st });
});
FIGHTS.push({ label: "Dragon priest (1st mask)", priest: 0 }, { label: "Dragon priest (8th mask)", priest: 7 });
const recOf = (F, s) => F.priest !== undefined ? (PRIESTS.recFor ? PRIESTS.recFor(F.priest) : 20) : (QUESTS.recOf ? QUESTS.recOf(F.id, F.i) : 0);
function foeFor(F, s) {
  if (F.priest !== undefined) {
    const def = { ...DUNGEONS.ENEMY["priest_" + PRIESTS.LIST[F.priest].id] };
    const e = G.scaleQuestFoe ? G.scaleQuestFoe(def, s.level, recOf(F, s)) : G.scaleEnemy(def, s.level);
    e.health = Math.round(e.health * 0.8); e.hp = e.health; e.damage = Math.round(e.damage * 0.8 * 10) / 10; e.boss = true; return e;
  }
  return QUESTS.foeFor ? QUESTS.foeFor(s, F.id, F.i, F.def) : G.scaleEnemy({ ...F.def }, s.level);
}
function rate(F, build, L) {
  let w = 0, tu = 0, hp = 0;
  for (let i = 0; i < RUNS; i++) {
    const s = build === "plain" ? makePlain(L) : make(build, L);
    if (F.priest !== undefined) { s.quests = { masks: { stage: F.priest, t: 0 } }; }
    const e = foeFor(F, s); s.health = G.maxHealth(s); s.healthTs = G.now();
    const f = new G.Fight(s, e, null); (F.allies || []).forEach(([name, dmg]) => f.allies.push({ name, dmg })); f.run({});
    if (!isFinite(f.hp) || !isFinite(f.ehp)) nan++;
    if (f.won) { w++; hp += Math.max(0, f.hp) / G.maxHealth(s); } tu += f.turn;
  }
  return { w: w / RUNS, turns: tu / RUNS, hp: w ? hp / w : 0 };
}
`, c);
  return c;
}
const after = load(W), before = B ? load(B) : null;
const pct = (x) => (Math.round(x * 100) + "%").padStart(5);
let fails = [];
const F2 = vm.runInContext("FIGHTS", after);
console.log(`quest fights: ${F2.length}, runs ${RUNS}${B ? ", before → after" : ""}`);
for (let k = 0; k < F2.length; k++) {
  const F = F2[k], rec = vm.runInContext(`recOf(FIGHTS[${k}])`, after);
  console.log(`\n${F.label} [${F.id ?? "masks"} stage ${F.i ?? F.priest}]  recommended level ${rec}`);
  console.log("build      " + LEVELS.map((L) => ("L" + L).padStart(B ? 13 : 6)).join(""));
  const realAt = {}, hpAt = [];
  for (const b of BUILDS) {
    let line = b.padEnd(11);
    for (const L of LEVELS) {
      const a = vm.runInContext(`rate(FIGHTS[${k}], "${b}", ${L})`, after);
      if (before) { const bb = vm.runInContext(`rate(FIGHTS[${k}], "${b}", ${L})`, before); line += (pct(bb.w) + " →" + pct(a.w)).padStart(13); }
      else line += pct(a.w).padStart(6);
      if (b === "plain") { if (L >= rec + 5 && a.w < 0.4) fails.push(`${F.label} plain L${L} ${pct(a.w)}`); }
      else if (L >= rec) { (realAt[L] = realAt[L] || []).push(a.w); if (L === LEVELS.find((x) => x >= rec)) hpAt.push(a.hp); if (a.w < 0.5) fails.push(`${F.label} ${b} L${L} ${pct(a.w)}`); }
    }
    console.log(line);
  }
  if (hpAt.length) console.log(`  realistic builds at L${LEVELS.find((x) => x >= rec)}: health left after a win ${Math.round(100 * hpAt.reduce((x, y) => x + y, 0) / hpAt.length)}% on average`);
  for (const [L, ws] of Object.entries(realAt)) { const m = ws.reduce((x, y) => x + y, 0) / ws.length; if (m < 0.7) fails.push(`${F.label} realistic avg L${L} ${pct(m)}`); }
}
const nan = vm.runInContext("nan", after) + (before ? vm.runInContext("nan", before) : 0);
console.log("\nNaN", nan);
if (fails.length) { console.log("BELOW TARGET:\n  " + fails.join("\n  ")); }
if (nan) process.exit(1);
if (process.env.STRICT && fails.length) process.exit(1);
console.log(fails.length ? "done (targets missed, see above)" : "ALL OK");
