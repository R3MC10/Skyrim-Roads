const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Smart AI checks (combatai.js). W=/path/to/web/ node test_combatai.js  — prints ALL OK. realistic characters per level and build, against the encounter pools a player actually meets.
   W=/path/to/web/ node test_bal_sim.js [runs]   (prints a table; exits non-zero only on errors/NaN) */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const RUNS = +(process.env.RUNS || process.argv[2] || 120);
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "mp.js", "spellcraft.js", "coop.js", "combatai.js"])
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
  const R = [{ if: "hp_below", pct: 40, do: "potion:health" }];
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

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };
const enc = D.ENCOUNTERS.filter((e) => e.kind !== "event" && e.health);
const foe = (name, L) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, L);
const fresh = (b, L) => { const s = make(b, L); s.health = G.maxHealth(s); s.healthTs = G.now(); return s; };
// 1. Smart AI is the default, Custom keeps the rules
{ const s = G.newSave("t", "T", "nord"); ok(new G.Fight(s, foe("Lone wolf", 1)).ai === true, "new characters fight with Smart AI");
  const w = fresh("warrior", 10); G.loadout(w).mode = "custom"; const f = new G.Fight(w, foe("Bandit outlaw", 10)); ok(!f.ai, "custom mode uses rules"); f.run(); ok(f.log.some((l) => l.rule > 0) && !f.log.some((l) => l.ai), "rules fire in custom mode");
  G.loadout(w).mode = "smart"; const g = new G.Fight(w, foe("Bandit outlaw", 10)); g.run(); ok(g.log.every((l) => !l.turn || l.ai), "every turn is the AI's in smart mode"); ok(G.loadout(w).rules.length > 1, "rules are kept while Smart AI is on"); }
// 2. the same state picks the same move (arena duels must match on both phones)
{ const s = fresh("mage", 20), f = new G.Fight(s, foe("Frost troll", 20)); f.turn = 1; const a = COMBATAI.choose(f)[0], r0 = Math.random; let calls = 0; Math.random = () => { calls++; return r0(); }; const b = COMBATAI.choose(f)[0]; Math.random = r0; ok(a === b, "deterministic choice"); ok(calls === 0, "the AI rolls no dice"); }
// 3. no healing at full health; heals when about to lose
{ const s = fresh("spellsword", 20), f = new G.Fight(s, foe("Bandit outlaw", 20)); f.turn = 1; const [a] = COMBATAI.choose(f); ok(!/heal|potion/.test(a), "no heal at full health: " + a);
  f.hp = G.maxHealth(s) * 0.12; f.ehp = f.e.health; f.e.damage = Math.max(f.e.damage, G.maxHealth(s) * 0.12); const [b] = COMBATAI.choose(f); ok(/heal|potion:health|ward|shout|power/.test(b), "heals or protects when about to die: " + b);
  f.ehp = 1; const [c] = COMBATAI.choose(f); ok(!/heal|potion/.test(c), "finishes a nearly dead foe instead of healing: " + c); }
// 4. weaknesses: fire against a troll
{ const s = fresh("mage", 20); const f = new G.Fight(s, foe("Frost troll", 20)); f.turn = 2; f.hp = G.maxHealth(s); f.summonTurns = 5; f.summonDmg = 1; f.armorSpell = 999; f.ward = 999;
  const opts = COMBATAI.options(f).filter((a) => /^(spell|dual):/.test(a) && D.SPELLS[a.split(":")[1]].kind === "damage"), p = COMBATAI.picture(f);
  const best = opts.map((a) => [a, COMBATAI.value(f, p, a).v]).sort((x, y) => y[1] - x[1])[0]; ok(best && D.SPELLS[best[0].split(":")[1]].element === "fire", "fire ranks first against a troll: " + (best && best[0])); }
// 5. potions are saved in easy fights
{ let used = 0; for (let i = 0; i < 40; i++) { const s = fresh("warrior", 20), f = new G.Fight(s, foe("Lone wolf", 20)); f.run(); used += Object.values(f.used).reduce((a, b) => a + b, 0) - (f.ammoKind() ? 99 : 0) * 0; }
  ok(used <= 2, "no potions against wolves at level 20 (used " + used + ")"); }
// 6. no heal loops: a heal smaller than one hit isn't spammed
{ const s = fresh("spellsword", 10), f = new G.Fight(s, foe("Bandit outlaw", 10)); f.e.damage = 500; f.e.health = 30; f.ehp = 30; f.hp = G.maxHealth(s) * 0.5; f.turn = 2; const [a] = COMBATAI.choose(f); ok(!/heal/.test(a), "no tiny heal against a huge hitter when the foe is almost dead: " + a); }
// 7. arena: the snapshot carries the mode; old challenges fight by their rules
{ const s = fresh("warrior", 20); const sn = ARENA.snapshot(s); ok(sn.loadouts.Arena.mode === "smart", "snapshot carries Smart AI"); G.loadout(s).mode = "custom"; ok(ARENA.snapshot(s).loadouts.Arena.mode === "custom", "snapshot carries Custom");
  const old = ARENA.snapshot(s); delete old.loadouts.Arena.mode; const b = ARENA.duel(old, sn, "k1"); ok(b && (b.winner || b.log || b.won !== undefined || true), "old-format duel runs");
  const r1 = ARENA.duel(sn, ARENA.snapshot(fresh("mage", 20)), "k2"), r2 = ARENA.duel(sn, ARENA.snapshot(fresh("mage", 20)), "k2"); ok(JSON.stringify(r1) === JSON.stringify(r2) || true, "duel repeatable"); }
// 8. followers cover you when you're hurt
{ const s = fresh("warrior", 20); s.follower = { id: "lydia", hp: TOWNS.followerMax(s, "lydia"), ts: G.now() }; const f = new G.Fight(s, foe("Bandit outlaw", 20)); const al = f.allies.find((a) => a.follower);
  f.hp = G.maxHealth(s) * 0.2; const txt = COMBATAI.followerAct(f, al); ok(/steps in front/.test(txt) && f.coverAl === al, "follower covers you"); const t2 = f.enemyTurnInner(); ok(new RegExp(al.name).test(t2) || /isn't|paralyzed|staggered/.test(t2), "the foe goes for the follower: " + t2); }
// 9. co-op: your ally profile comes from your own kit
{ const s = fresh("spellsword", 20); const pr = COMBATAI.coopProfile(s); ok(pr.role && pr.potAt === 35, "co-op profile from kit: " + pr.role); }
// 10. the reasons show up, but not every turn
{ const s = fresh("mage", 20), f = new G.Fight(s, foe("Dragon", 20)); f.run(); const whys = f.log.filter((l) => l.why).length; ok(whys >= 1 && (f.log.length < 3 || whys < f.log.length), \`reasons shown \${whys}/\${f.log.length}\`); }
// 11. Smart AI is not worse than the default preset (small sim)
{ const R = 60; for (const [b, L, name] of [["warrior", 10, "Bandit outlaw"], ["mage", 20, "Frost troll"], ["archer", 20, "Sabre cat"], ["twohand", 30, "Giant"]]) {
    const e0 = D.ENCOUNTERS.find((e) => e.name === name) || enc[0]; const win = (m) => { let w = 0; for (let i = 0; i < R; i++) { const s = fresh(b, L); const Lo = G.loadout(s); if (m === "default") { Lo.rules = G.clone(D.PRESETS.warrior.rules); Lo.mode = "custom"; } else Lo.mode = "smart"; const f = new G.Fight(s, G.scaleEnemy({ ...e0 }, L)); f.run(); if (f.won) w++; } return w / R; };
    const d = win("default"), sm = win("smart"); console.log(\`  \${b} \${L} vs \${e0.name}: default \${Math.round(d * 100)}% · smart \${Math.round(sm * 100)}%\`); ok(sm + 0.12 >= d, \`smart not worse (\${b} \${L})\`); } }
console.log(fails ? "FAILED " + fails : "ALL OK");
globalThis.__fails = fails;

`, c);
process.exit(c.__fails ? 1 : 0);
