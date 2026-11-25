const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Balance sim: realistic characters per level and build, against the encounter pools a player actually meets.
   W=/path/to/web/ node test_bal_sim.js [runs]   (prints a table; exits non-zero only on errors/NaN) */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const RUNS = +(process.argv[2] || 300);
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "potionfx.js", "mp.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const LEVELS = [5, 10, 20, 30, 40];
const tierOf = (L) => L < 8 ? 0 : L < 15 ? 1 : L < 25 ? 2 : L < 35 ? 3 : 4;
// gear a real player would have by then: [weapon, armor pieces, shield?] per tier
const GEAR = {
  warrior:  [["iron_sword", ["iron_helmet","iron_armor","iron_gauntlets","iron_boots"], "iron_shield"], ["steel_sword", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"], "steel_shield"],
             ["steel_sword", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"], "steel_shield"], ["dwarven_sword", ["dwarven_helmet","dwarven_armor","steel_gauntlets","steel_boots"], "steel_shield"],
             ["dwarven_war_axe", ["dwarven_helmet","dwarven_armor","steel_gauntlets","steel_boots"], "steel_shield"]],
  twohand:  [["iron_greatsword", ["iron_helmet","iron_armor","iron_gauntlets","iron_boots"]], ["steel_battleaxe", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"]],
             ["steel_battleaxe", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"]], ["steel_battleaxe", ["dwarven_helmet","dwarven_armor","steel_gauntlets","steel_boots"]],
             ["steel_battleaxe", ["dwarven_helmet","dwarven_armor","steel_gauntlets","steel_boots"]]],
  archer:   [["hunting_bow", ["hide_helmet","hide_armor","hide_bracers","hide_boots"]], ["hunting_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]],
             ["elven_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]], ["dwarven_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]],
             ["elven_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]]],
  mage:     [[null, ["mage_robes"]], [null, ["mage_robes"]], [null, ["mage_robes"]], [null, ["mage_robes"]], [null, ["archmage_robes"]]],
  spellsword:[["iron_sword", ["hide_helmet","hide_armor","hide_bracers","hide_boots"]], ["steel_sword", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]],
             ["steel_sword", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]], ["elven_sword", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]],
             ["elven_sword", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]]],
};
GEAR.sneakarcher = GEAR.archer;
const MAIN = {
  warrior: [["One-Handed",1],["Heavy Armor",1],["Blocking",0.9],["Smithing",0.8],["Restoration",0.3]],
  twohand: [["Two-Handed",1],["Heavy Armor",1],["Smithing",0.8],["Blocking",0.3]],
  archer: [["Archery",1],["Light Armor",0.9],["Sneak",0.6],["Smithing",0.7]],
  sneakarcher: [["Archery",1],["Sneak",1],["Light Armor",0.8],["Smithing",0.5]],
  mage: [["Destruction",1],["Restoration",0.9],["Conjuration",0.7],["Alteration",0.7]],
  spellsword: [["One-Handed",1],["Destruction",0.9],["Restoration",0.7],["Light Armor",0.8],["Smithing",0.5]],
};
const ATTR = { warrior: [0.7,0,0.3], twohand: [0.6,0,0.4], archer: [0.6,0,0.4], sneakarcher: [0.6,0,0.4], mage: [0.4,0.6,0], spellsword: [0.5,0.3,0.2] };
const PERK_SKILLS = (b) => MAIN[b].map(([k]) => k).filter((k) => PERKS.TREES[k]);
function bestSpell(s, kinds, school) {
  let best = null;
  for (const id of s.spells) { const sp = D.SPELLS[id]; if (!sp || !kinds.includes(sp.kind) || (school && sp.school !== school)) continue; if (typeof MAGIC !== "undefined" && MAGIC.failChance(s, id) > 0.05) continue;
    const v = (sp.amount || 0) / Math.max(1, G.spellCost(s, sp)) * Math.sqrt(sp.amount || 1); if (!best || v > best[1]) best = [id, v]; }
  return best?.[0] || null;
}
function make(build, L) {
  const s = G.newSave("sim", "Sim", "nord"); s._test = true;
  s.level = L; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun;
  for (const [k, w] of MAIN[build]) s.skills[k].lvl = Math.min(100, Math.round(s.skills[k].lvl + (2.3 * L) * w));
  const [h, m, st] = ATTR[build]; const ups = (L - 1) * 10;
  s.hpBonus = Math.round(ups * h); s.mpBonus = Math.round(ups * m); s.spBonus = Math.round(ups * st);
  // perks: one per level, in the build's trees, cheapest requirement first
  const trees = PERK_SKILLS(build); let guard = 0;
  while (PERKS.pointsLeft(s) > 0 && guard++ < 400) {
    const opts = trees.flatMap((k) => PERKS.TREES[k].map((p) => p[0])).filter((id) => !PERKS.canTake(s, id));
    if (!opts.length) break; PERKS.take(s, opts[0]);
  }
  // gear, tempered to the quality their Smithing allows (one quality level per 20 Smithing)
  const T = tierOf(L), [wpn, arm, sh] = GEAR[build][T], q = Math.min(6, 1 + Math.floor(G.skill(s, "Smithing") / 20)) - (T === 0 ? 1 : 0);
  const eqp = (item, temper) => { const id = G.give(s, item); const r = G.invRow(s, id); if (temper) { r.tq = q; r.temper = temper; } G.equip(s, id); return r; };
  if (wpn) eqp(wpn, q * (G.P(s, "steel_smithing") && /steel|dwarven|elven/.test(wpn) ? 2 : 1));
  for (const a of arm) eqp(a, D.ITEMS[a].type === "cloth" ? 0 : q * 2);
  if (sh) eqp(sh, q * 2);
  if (/archer/.test(build)) G.give(s, T >= 3 ? "arrow_elven" : T >= 2 ? "arrow_steel" : "arrow_iron", 60);
  // potions and spells
  G.give(s, L >= 20 ? "potion_health" : "potion_health_minor", 2 + Math.floor(L / 10));
  const schools = MAIN[build].map(([k]) => k);
  for (const [id, sp] of Object.entries(D.SPELLS)) if (schools.includes(sp.school) && sp.kind !== "utility" && (typeof MAGIC === "undefined" || MAGIC.failChance(s, id) === 0) && !s.spells.includes(id)) s.spells.push(id);
  const R = [{ if: "hp_below", pct: 50, do: "potion:health" }];   // drinks at half health (potions work over a few rounds, potionfx.js)
  const heal = bestSpell(s, ["heal"], "Restoration"); if (heal) R.push({ if: "hp_below", pct: 55, do: "spell:" + heal });
  if (build === "mage") {
    const arm2 = bestSpell(s, ["armor"]); if (arm2) R.push({ if: "no_armor_spell", do: "spell:" + arm2 });
    const sum = bestSpell(s, ["summon"]); if (sum) R.push({ if: "no_summon", do: "spell:" + sum });
    const dmg = bestSpell(s, ["damage", "dot"], "Destruction"); if (dmg) R.push({ if: "always", do: "spell:" + dmg });
  } else if (build === "spellsword") {
    const dmg = bestSpell(s, ["damage"], "Destruction"); if (dmg) R.push({ if: "mp_above", pct: 50, do: "spell:" + dmg });
    R.push({ if: "sp_above", pct: 60, do: "power_attack" });
  } else if (build === "warrior") { R.push({ if: "sp_above", pct: 70, do: "power_attack" }); }
  else if (build === "twohand") R.push({ if: "sp_above", pct: 50, do: "power_attack" });
  R.push({ if: "always", do: "attack" });
  G.loadout(s).rules = R;
  G.setHealth(s, G.maxHealth(s));
  return s;
}
const enc = D.ENCOUNTERS.filter((e) => e.kind !== "event" && e.health);
const normalPool = enc.filter((e) => e.danger !== "high"), toughPool = enc.filter((e) => e.danger === "high" && !(e.tags || []).includes("dragon"));
// dungeon bosses by tier the way dungeons.js picks them, tier by level (tier 1 under 6, 2 under 12, 3 above)
const bosses = [["wight","chief","hagraven","sphere"], ["scourge","chief","necroMaster","elder","sphereMaster","briarheart"], ["deathlord","lich","centurion","master"]];
let errs = 0, nan = 0;
function fight(s, e) {
  s.health = G.maxHealth(s); s.healthTs = G.now();
  const f = new G.Fight(s, e, null); f.run({ trySneak: true });
  if (!isFinite(f.hp) || !isFinite(f.ehp)) nan++;
  return { won: f.won, hpLeft: Math.max(0, f.hp) / G.maxHealth(s), turns: f.turn, potions: Object.keys(f.used).length };
}
const BUILDS = ["warrior", "twohand", "archer", "sneakarcher", "mage", "spellsword"];
const out = {};
for (const b of BUILDS) for (const L of LEVELS) {
  const row = {};
  for (const [kind, pickE] of [["normal", () => normalPool[Math.floor(Math.random() * normalPool.length)]], ["tough", () => toughPool[Math.floor(Math.random() * toughPool.length)]],
    ["boss", () => DUNGEONS.ENEMY[bosses[L < 12 ? 0 : L < 25 ? 1 : 2][Math.floor(Math.random() * 4)]]], ["dragon", () => enc.find((e) => (e.tags||[]).includes("dragon"))]]) {
    let w = 0, hp = 0, tu = 0, n = 0;
    for (let i = 0; i < RUNS; i++) {
      try { const s = make(b, L); if (i % 3 === 0 && L >= 10) s.follower = { id: "lydia", hp: TOWNS.followerMax(s, "lydia"), ts: G.now() };
        const r = fight(s, G.scaleEnemy({ ...pickE() }, L)); n++; if (r.won) { w++; hp += r.hpLeft; } tu += r.turns; }
      catch (x) { errs++; if (errs < 4) console.log(b, L, kind, x.stack.split("\\n").slice(0, 3).join(" | ")); }
    }
    row[kind] = [Math.round(100 * w / n), Math.round(100 * hp / Math.max(1, w)), +(tu / n).toFixed(1)];
  }
  out[b + " " + L] = row;
}
console.log("build L      normal win/hp%/turns   tough            boss             dragon");
for (const [k, r] of Object.entries(out)) console.log(k.padEnd(15), ...["normal", "tough", "boss", "dragon"].map((x) => (r[x][0] + "% " + r[x][1] + "% " + r[x][2] + "t").padEnd(17)));
console.log("errors", errs, "nan", nan);
`, c);
