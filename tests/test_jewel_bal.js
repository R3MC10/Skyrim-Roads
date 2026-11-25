const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Balance sim for jewellery: the same characters with no jewellery, and with two rings and an amulet carrying the
   strongest enchantments a player can make (gold-and-diamond pieces, every Enchanting perk), all stacked on one goal.
   Stacking must help, but it must not trivialise tough foes, bosses and dragons (caps in enchanting.js).
   node test_jewel_bal.js [runs]   (prints a table; exits non-zero if stacked jewellery breaks a fight) */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const RUNS = +(process.argv[2] || 80);   // every stack meets the same foes in the same order
let sd = +(process.env.SEED || 7) >>> 0; const SMATH = Object.create(Math); SMATH.random = () => { sd = (sd + 0x6D2B79F5) >>> 0; let t = sd; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };   // seeded dice: the same table every run (SEED=n to try others)
const c = { console, Math: SMATH, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RegExp, RUNS, process };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "foeperks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "jewelry.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "mp.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const GEAR = {
  warrior: { 10: ["steel_sword", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"], "steel_shield"], 25: ["dwarven_sword", ["dwarven_helmet","dwarven_armor","steel_gauntlets","steel_boots"], "steel_shield"], 40: ["dwarven_war_axe", ["dwarven_helmet","dwarven_armor","steel_gauntlets","steel_boots"], "steel_shield"] },
  archer: { 10: ["hunting_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]], 25: ["dwarven_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]], 40: ["elven_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]] },
  mage: { 10: [null, ["mage_robes"]], 25: [null, ["mage_robes"]], 40: [null, ["archmage_robes"]] },
};
const MAIN = { warrior: [["One-Handed",1],["Heavy Armor",1],["Blocking",0.9],["Smithing",0.8],["Restoration",0.3]], archer: [["Archery",1],["Light Armor",0.9],["Sneak",0.6],["Smithing",0.7]], mage: [["Destruction",1],["Restoration",0.9],["Conjuration",0.7],["Alteration",0.7]] };
const ATTR = { warrior: [0.7,0,0.3], archer: [0.6,0,0.4], mage: [0.4,0.6,0] };
// the strongest stack a player can build: [ring, ring, amulet] effects per goal
const STACK = {
  offence: { warrior: ["onehanded", "crit", "onehanded"], archer: ["archery", "crit", "archery"], mage: ["destruction", "destruction", "destruction"] },
  defence: { warrior: ["health", "resist", "health"], archer: ["evasion", "health", "health"], mage: ["resist", "health", "regen_health"] },
  sustain: { warrior: ["regen_health", "regen_health", "regen_health"], archer: ["regen_health", "regen_stamina", "regen_health"], mage: ["regen_magicka", "regen_health", "regen_magicka"] },
};
// what a player can really make by then: a greater soul, Enchanting rising with level, gold-and-diamond jewellery (jpow), the perks they could have
const maxK = (L) => 0.8 * (0.4 + 0.6 * Math.min(100, 15 + 2.3 * L) / 100) * 1.15 * (1 + (L >= 30 ? 0.5 : L >= 20 ? 0.25 : 0));
function make(build, L, stack) {
  const s = G.newSave("sim", "Sim", "nord"); s._test = true;
  s.level = L; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun;
  for (const [k, w] of MAIN[build]) s.skills[k].lvl = Math.min(100, Math.round(s.skills[k].lvl + (2.3 * L) * w));
  const [h, m, st] = ATTR[build]; const ups = (L - 1) * 10;
  s.hpBonus = Math.round(ups * h); s.mpBonus = Math.round(ups * m); s.spBonus = Math.round(ups * st);
  const trees = MAIN[build].map(([k]) => k).filter((k) => PERKS.TREES[k]); let guard = 0;
  while (PERKS.pointsLeft(s) > 0 && guard++ < 400) { const opts = trees.flatMap((k) => PERKS.TREES[k].map((p) => p[0])).filter((id) => !PERKS.canTake(s, id)); if (!opts.length) break; PERKS.take(s, opts[0]); }
  const [wpn, arm, sh] = GEAR[build][L], q = Math.min(6, 1 + Math.floor(G.skill(s, "Smithing") / 20));
  const eqp = (item, temper) => { const id = G.give(s, item); const r = G.invRow(s, id); if (temper) { r.tq = q; r.temper = temper; } G.equip(s, id); return r; };
  if (wpn) eqp(wpn, q); for (const a of arm) eqp(a, D.ITEMS[a].type === "cloth" ? 0 : q * 2); if (sh) eqp(sh, q * 2);
  if (build === "archer") G.give(s, L >= 30 ? "arrow_elven" : "arrow_steel", 60);
  if (stack) {
    const [r1, r2, a] = STACK[stack][build];
    const put = (base, eff, slot) => { const mag = Math.round(ENCH.ARMOR[eff][2] * maxK(L)); const id = G.give(s, "ench|" + base + "|" + eff + "|" + mag + "|0"); G.equip(s, id, slot); };
    put("gold_diamond_ring", r1, "ring"); put("gold_emerald_ring", r2, "ring2"); put("gold_diamond_necklace", a);
  }
  G.give(s, L >= 20 ? "potion_health" : "potion_health_minor", 2 + Math.floor(L / 10));
  const schools = MAIN[build].map(([k]) => k);
  for (const [id, sp] of Object.entries(D.SPELLS)) if (schools.includes(sp.school) && sp.kind !== "utility" && (typeof MAGIC === "undefined" || MAGIC.failChance(s, id) === 0) && !s.spells.includes(id)) s.spells.push(id);
  const best = (kinds, school) => { let b = null; for (const id of s.spells) { const sp = D.SPELLS[id]; if (!sp || !kinds.includes(sp.kind) || (school && sp.school !== school)) continue; const v = (sp.amount || 0) / Math.max(1, G.spellCost(s, sp)) * Math.sqrt(sp.amount || 1); if (!b || v > b[1]) b = [id, v]; } return b?.[0] || null; };
  const R = [{ if: "hp_below", pct: 40, do: "potion:health" }];
  const heal = best(["heal"], "Restoration"); if (heal) R.push({ if: "hp_below", pct: 55, do: "spell:" + heal });
  if (build === "mage") { const a2 = best(["armor"]); if (a2) R.push({ if: "no_armor_spell", do: "spell:" + a2 }); const sm = best(["summon"]); if (sm) R.push({ if: "no_summon", do: "spell:" + sm }); const d = best(["damage", "dot"], "Destruction"); if (d) R.push({ if: "always", do: "spell:" + d }); }
  else if (build === "warrior") R.push({ if: "sp_above", pct: 70, do: "power_attack" });
  R.push({ if: "always", do: "attack" });
  G.loadout(s).rules = R; G.setHealth(s, G.maxHealth(s));
  return s;
}
const enc = D.ENCOUNTERS.filter((e) => e.kind !== "event" && e.health);
const toughPool = enc.filter((e) => e.danger === "high" && !(e.tags || []).includes("dragon"));
const bosses = [["wight","chief","hagraven","sphere"], ["scourge","chief","necroMaster","elder","sphereMaster","briarheart"], ["deathlord","lich","centurion","master"]];
const dragon = enc.find((e) => (e.tags || []).includes("dragon"));
let errs = 0, bad = [];
const KINDS = [["tough", (L, i) => toughPool[i % toughPool.length]], ["boss", (L, i) => DUNGEONS.ENEMY[bosses[L < 12 ? 0 : L < 25 ? 1 : 2][i % 4]]], ["dragon", () => dragon]];
console.log("build L  stack      " + KINDS.map(([k]) => (k + " win/hp/turns").padEnd(20)).join(""));
for (const b of ["warrior", "archer", "mage"]) for (const L of [10, 25, 40]) {
  const base = {};
  for (const stack of [null, "offence", "defence", "sustain"]) {
    const row = {};
    for (const [kind, pick] of KINDS) {
      let w = 0, hp = 0, tu = 0, n = 0;
      for (let i = 0; i < RUNS; i++) {
        try { const s = make(b, L, stack); const e = G.scaleEnemy({ ...pick(L, i) }, L); s.health = G.maxHealth(s); s.healthTs = G.now(); const f = new G.Fight(s, e, null); f.run({ trySneak: true }); n++; if (f.won) { w++; hp += Math.max(0, f.hp) / G.maxHealth(s); } tu += f.turn; }
        catch (x) { errs++; if (errs < 4) console.log(b, L, stack, kind, x.stack.split("\\n").slice(0, 3).join(" | ")); }
      }
      row[kind] = { win: Math.round(100 * w / Math.max(1, n)), hp: Math.round(100 * hp / Math.max(1, w)), turns: +(tu / Math.max(1, n)).toFixed(1) };
    }
    if (!stack) Object.assign(base, row);
    else for (const [kind] of KINDS) {   // what "trivialised" means: a strong foe that used to be a fight is now a walkover
      const r = row[kind], o = base[kind];
      if (r.turns < Math.max(2, o.turns * 0.5)) bad.push(b + " " + L + " " + stack + " " + kind + ": turns " + o.turns + " -> " + r.turns);
      if (o.win < 50 && r.win - o.win > 45) bad.push(b + " " + L + " " + stack + " " + kind + ": win " + o.win + "% -> " + r.win + "%");
    }
    console.log((b + " " + L).padEnd(11) + (stack || "none").padEnd(11) + KINDS.map(([k]) => (row[k].win + "% " + row[k].hp + "% " + row[k].turns + "t").padEnd(20)).join(""));
  }
}
console.log("errors", errs);
if (bad.length) { console.log("Stacked jewellery trivialises fights:\\n " + bad.join("\\n ")); process.exitCode = 1; }
else if (errs) process.exitCode = 1;
else console.log("test_jewel_bal: stacked jewellery helps without breaking fights");
`, c);
