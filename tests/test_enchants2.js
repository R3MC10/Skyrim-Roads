/* The newer enchantments (enchants2.js): every effect is registered, learnable, can be put on gear, shows up on loot,
   and changes a real number in a fight; perks and uniques; then a quick turn-based sim so no effect one-shots a strong
   foe or makes fights end too fast.  W=/path/to/game/ node test_enchants2.js [runs] */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const RUNS = +(process.env.RUNS || process.argv[2] || 16);
const rand = { v: null };
const M = Object.create(Math); M.random = () => (rand.v == null ? Math.random() : rand.v);
const c = { process: { env: process.env }, console, Math: M, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RegExp, structuredClone, rand, RUNS };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "foeintent.js", "tbfight.js", "jewelry.js", "shopcap.js", "enchants2.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let pass = 0, fails = 0; const ok = (v, m) => { if (v) pass++; else { fails++; console.log("FAIL " + m); } };
const fresh = (L = 20) => { const s = G.newSave("e" + Math.random(), "E", "nord"); s._test = true; s.inv = []; s.location = "Whiterun"; s.level = L; G.setHealth(s, G.maxHealth(s)); return s; };
const NEWW = Object.keys(ENCH2.WEAPON), NEWA = Object.keys(ENCH2.ARMOR);

// ---- 1. registered, old ids kept, plain words
ok(NEWW.length + NEWA.length >= 20, "at least 20 new effects: " + (NEWW.length + NEWA.length));
for (const old of ["fire", "frost", "shock", "absorb", "paralyze", "bleed", "turn_undead"]) ok(ENCH.WEAPON[old], "old weapon effect kept: " + old);
for (const old of ["health", "resist", "crit", "evasion", "regen_health", "speech"]) ok(ENCH.ARMOR[old], "old worn effect kept: " + old);
for (const e of [...NEWW, ...NEWA]) {
  ok(ENCH.WEAPON[e] || ENCH.ARMOR[e], "registered " + e);
  const d = ENCH.describe(e, 12);
  ok(d && !d.includes("{m}") && /12/.test(d) && d.length > 25, "plain words for " + e + ": " + d);
}
ok(ENCH.short("chain_lightning") === "chain lightning" && ENCH.short("fire") === "fire", "short names for the item line");

// ---- 2. items: names, prices, tooltips; learn, enchant
{
  const it = D.ITEMS["ench|steel_sword|chain_lightning|10|900"];
  ok(it && it.name === "Steel Sword of Storms" && it.enchant.effect === "chain_lightning" && it.value > D.ITEMS.steel_sword.value, "made-on-demand weapon: " + it?.name);
  const ar = D.ITEMS["ench|steel_armor|thorns|8|0"];
  ok(ar && ar.aenchant.key === "e2:thorns" && /8% of the blow/.test(ENCH.lines(ar)[0]), "worn item lines: " + ENCH.lines(ar)[0]);
  ok(/initiative/.test(G.itemSummary ? "initiative" : "initiative"), "ok");
}
{
  const s = fresh(); s.skills.Enchanting.lvl = 60;
  const id = G.give(s, "ench|steel_sword|wildfire|10|900");
  const m = ENCH.disenchant(s, id);
  ok(/You learned Wildfire/.test(m) && ENCH.known(s).includes("wildfire"), "disenchant teaches a new effect: " + m);
  const gem = G.give(s, "soul_gem_greater"), blade = G.give(s, "iron_sword");
  const r = ENCH.enchant(s, blade, "wildfire", gem);
  const nr = s.inv.find((x) => D.ITEMS[x.item].enchant?.effect === "wildfire");
  ok(nr && /Wildfire/.test(r), "enchanter puts it on a weapon: " + r);
  const id2 = G.give(s, "ench|iron_shield|last_ward|25|0"); ENCH.disenchant(s, id2);
  const gem2 = G.give(s, "soul_gem_greater"), boots = G.give(s, "iron_boots");
  ok(/can't go on that/.test(ENCH.enchant(s, boots, "last_ward", gem2)), "worn effects only fit their slots");
  const sh = G.give(s, "steel_shield");
  ok(/You made/.test(ENCH.enchant(s, sh, "last_ward", gem2)), "last ward on a shield");
  ok(!ENCH.canTake(D.ITEMS.iron_sword, "thorns") && ENCH.canTake(D.ITEMS.steel_armor, "thorns") && ENCH.canTake(D.ITEMS.iron_sword, "echo"), "canTake");
}
// ---- 3. loot, shops, uniques
{
  const hum = D.LOOT.humanoid.map(([i]) => i).join(" "), eli = D.LOOT.elite.map(([i]) => i).join(" ");
  for (const e of [...NEWW, ...NEWA]) ok(eli.includes("|" + e + "|"), "elite foes can drop " + e);
  for (const e of ENCH2.STRONG) ok(!hum.includes("|" + e + "|"), "strong " + e + " is not on ordinary bandits");
  ok(D.SHOP_STOCK.wizard.some((i) => i.includes("|numbing|") || i.includes("|chain_lightning|") || i.includes("|wildfire|")), "court wizards sell a few");
  ok(ENCH2.UNIQUES.length >= 5, "signature uniques: " + ENCH2.UNIQUES.length);
  const s = fresh();
  for (const u of ENCH2.UNIQUES) {
    const it = D.ITEMS[u]; ok(it.unique && (it.enchant || it.aenchant), u + " is unique and enchanted");
    ok(ENCH.lines(it).every((l) => !/undefined|\\{m\\}/.test(l)), u + " tooltip lines: " + ENCH.lines(it).join(" | "));
    ok(eli.includes(u), u + " drops from elite foes");
  }
  const id = G.give(s, ENCH2.UNIQUES[0]);
  ok(/one of a kind/.test(ENCH.disenchant(s, id)), "uniques can't be broken down");
  // jewellery loot rolls the new worn effects too
  const j = s; j.level = 30; let seen = new Set();
  rand.v = null;
  for (let i = 0; i < 3000; i++) for (const r of j.inv.splice(0)) { const it = D.ITEMS[r.item]; for (const e of [it?.aenchant, ...(it?.aenchant?.more || [])]) if (e?.eff && NEWA.includes(e.eff)) seen.add(e.eff); }
  for (let i = 0; i < 2500; i++) JEWELRY.loot(j, { name: "Bandit chief", tags: ["humanoid", "elite"], level: 30 });
  for (const r of j.inv) { const it = D.ITEMS[r.item]; for (const e of [it?.aenchant, ...(it?.aenchant?.more || [])]) if (e?.eff && NEWA.includes(e.eff)) seen.add(e.eff); }
  ok(seen.size >= 4, "rings and amulets roll new worn effects: " + [...seen].join(","));
}

// ---- 4. every weapon effect does something real
const foe = (o = {}) => ({ name: o.name || "Bandit outlaw", level: 10, health: o.health || 200, hp: o.health || 200, damage: o.damage || 10, tags: o.tags || ["humanoid"], gold: [10, 20], ...o });
function fight(o, eff, mag = 20, s0) {
  const s = s0 || fresh(); const id = G.give(s, "ench|steel_sword|" + eff + "|" + mag + "|9000"); G.equip(s, id);
  const f = new G.Fight(s, foe(o)); f.turn = 1; return f;
}
const en = (f) => f.weapon.enchant;
{ rand.v = 0.9; const f = fight({}, "chain_lightning", 20); const r = ENCH.onHit(f, en(f), 20, { label: "Attack", dmg: 30 });
  ok(r.dmg === 30 && f.pendingEl?.[0] === "shock", "chain lightning: 1.5× and a jolt " + r.dmg);
  rand.v = 0.1; const r2 = ENCH.onHit(f, en(f), 20, { label: "Attack", dmg: 30 }); ok(r2.dmg === 35 && /twice/.test(r2.label), "chain lightning jumps twice " + r2.dmg); }
{ rand.v = 0.9; const f = fight({}, "bloodthirst", 30); f.hp = 50;
  ENCH.onHit(f, en(f), 30, { label: "Attack (critical)", dmg: 40 }); ok(f.hp === 62, "bloodthirst crit heals 30% of the blow: " + f.hp);
  f.hp = 50; ENCH.onHit(f, en(f), 30, { label: "Attack", dmg: 40 }); ok(f.hp === 53, "a normal hit heals a quarter of that: " + f.hp);
  rand.v = 0.05; f.hp = 50; const r = ENCH.onHit(f, en(f), 30, { label: "Attack", dmg: 40 }); ok(r.dmg > 0 && /critical/.test(r.label) && f.hp > 53, "bloodthirst finds its own crits"); }
{ rand.v = 0.9; const f = fight({}, "numbing", 20); f.tb = true; f.turn = 3; const r = ENCH.onHit(f, en(f), 20, {});
  ok(r.dmg === 20 && f._numb === 5, "numbing marks the foe");
  f.turn = 4; let n = ENCH2.numb(f); ok(n.init === 8 && n.acts === 1, "numbed: later and a move lost");
  f.turn = 5; n = ENCH2.numb(f); ok(n.init === 8 && n.acts === 0, "a move lost only once every 3 rounds");
  f.turn = 6; ok(ENCH2.numb(f).init === 0, "wears off");
  const b = fight({ boss: true }, "numbing", 20); b.turn = 1; ENCH.onHit(b, en(b), 20, {}); b.turn = 2; ok(ENCH2.numb(b).acts === 0 && ENCH2.numb(b).init === 8, "bosses only act later");
  const d = fight({ name: "Draugr", tags: ["undead"] }, "numbing", 20); ENCH.onHit(d, en(d), 20, {}); ok(!d._numb, "draugr don't numb"); }
{ rand.v = 0.9; const f = fight({ health: 2000 }, "wildfire", 20); ENCH.onHit(f, en(f), 20, {}); ok(f._wild && f.pendingEl?.[0] === "fire", "wildfire sets fire");
  PFX.hitFoe(f, "fire", 20, "weapon"); f.foeSt.burn.turns = 6; const d0 = f.foeSt.burn.dmg; const line = { me: "" };
  PFX.tick(f, line); PFX.tick(f, line); PFX.tick(f, line);
  ok(f.foeSt.burn && f.foeSt.burn.dmg > d0 && f.foeSt.burn.dmg <= d0 * 2, "the burn grows " + d0 + "→" + f.foeSt.burn?.dmg); }
{ const f = fight({ name: "Dragon", tags: ["dragon", "big"] }, "dragonbane", 40); ok(ENCH.onHit(f, en(f), 40, {}).dmg === 40, "dragonbane on dragons");
  const g = fight({ name: "Giant", tags: ["humanoid", "big"] }, "dragonbane", 40); ok(ENCH.onHit(g, en(g), 40, {}).dmg === 20, "half on giants");
  const b = fight({}, "dragonbane", 40); ok(ENCH.onHit(b, en(b), 40, {}).dmg === 0, "nothing on bandits"); }
{ const f = fight({ name: "Flame atronach", tags: ["daedra"], health: 300 }, "banishing", 30); f.ehp = 80;
  const r = ENCH.onHit(f, en(f), 30, { dmg: 10 }); ok(r.dmg >= 80 && /banished/.test(r.label), "weak daedra are banished");
  f.ehp = 300; ok(ENCH.onHit(f, en(f), 30, { dmg: 10 }).dmg === 30, "healthy daedra take extra damage");
  const b = fight({ name: "Dremora lord", tags: ["daedra"], boss: true, health: 300 }, "banishing", 30); b.ehp = 70; ok(!/banished/.test(ENCH.onHit(b, en(b), 30, { dmg: 10 }).label), "bosses aren't banished");
  const h = fight({}, "banishing", 30); ok(ENCH.onHit(h, en(h), 30, {}).dmg === 0, "no effect on people"); }
{ rand.v = 0.01; const f = fight({}, "thunderclap", 25); f.turn = 2; ENCH.onHit(f, en(f), 25, {}); ok(f.stagger, "thunderclap staggers");
  f.stagger = false; f.turn = 3; ENCH.onHit(f, en(f), 25, {}); ok(!f.stagger, "then it needs a rest"); }
{ const f = fight({ health: 400 }, "reaping", 20); ok(ENCH.onHit(f, en(f), 20, {}).dmg === 20, "reaping");
  f.ehp = 50; ok(ENCH.onHit(f, en(f), 20, {}).dmg === 60, "reaping triples below a quarter"); }
{ const f = fight({}, "sundering", 10); const d = [1, 2, 3, 4, 5, 6].map(() => ENCH.onHit(f, en(f), 10, {}).dmg);
  ok(d[0] === 10 && d[4] === 20 && d[5] === 20, "sundering builds up to double: " + d.join(",")); }
{ rand.v = 0.1; const f = fight({ name: "Necromancer", tags: ["humanoid", "mage"] }, "spellbreaker", 30); f.turn = 1; const r = ENCH.onHit(f, en(f), 30, {});
  ok(r.dmg === 30 && f.stagger, "spellbreaker: extra damage and a broken spell");
  const b = fight({}, "spellbreaker", 30); ok(ENCH.onHit(b, en(b), 30, {}).dmg === 0, "nothing on a plain bandit"); }
{ rand.v = 0.1; const f = fight({}, "echo", 25); ok(ENCH.onHit(f, en(f), 25, { dmg: 40 }).dmg === 20, "echo strikes again for half");
  rand.v = 0.5; ok(ENCH.onHit(f, en(f), 25, { dmg: 40 }).dmg === 0, "only sometimes"); }
{ rand.v = 0.9; const f = fight({ health: 500 }, "venom", 8); for (let i = 0; i < 5; i++) ENCH.onHit(f, en(f), 8, {});
  ok(f._venom.length === 3, "venom stacks to 3"); const e0 = f.ehp; const line = { me: "" }; PFX.tick(f, line); ok(e0 - f.ehp >= 24 && /venom 24/.test(line.me), "venom ticks " + line.me);
  const sk = fight({ name: "Skeleton", tags: ["undead"] }, "venom", 8); ENCH.onHit(sk, en(sk), 8, {}); ok(!sk._venom, "the dead don't take poison");
  f.hp = 100; const t = ENCH2.hurt(f, 20); ok(Math.abs(f.hp - 102) < 0.01, "a poisoned foe hits 10% softer " + f.hp); }

// ---- 5. worn effects
const wear = (s, ...ids) => { for (const i of ids) G.equip(s, G.give(s, i)); };
{ const s = fresh(); wear(s, "ench|steel_armor|thorns|20|0"); const f = new G.Fight(s, foe({ damage: 40 }));
  rand.v = 0.3; const e0 = f.ehp, t = f.enemyTurn(); ok(f.ehp < e0 && /thorns/.test(t), "thorns hit back: " + t);
  const m = new G.Fight(s, foe({ name: "Necromancer", tags: ["humanoid", "mage"], damage: 40 })); const m0 = m.ehp; m.enemyTurn(); ok(m.ehp === m0, "not against spells"); }
{ const s = fresh(); wear(s, "ench|steel_shield|last_ward|60|0"); const f = new G.Fight(s, foe({ damage: 30 })); const mh = G.maxHealth(s);
  f.hp = mh * 0.34; rand.v = 0.3; const t = f.enemyTurn(); ok(f._lwardUsed && f._lward === 60 && /Last Ward rises/.test(t), "last ward rises: " + t);
  const h1 = f.hp; f.enemyTurn(); ok(f.hp === h1 && f._lward < 60, "and soaks the next blow");
  f._lward = 0; f.hp = mh * 0.2; f.enemyTurn(); ok(!(f._lward > 0), "only once a fight"); }
{ const s = fresh(); wear(s, "ench|steel_helmet|mana_shield|25|0"); const a = new G.Fight(s, foe({ damage: 40 }));
  const s2 = fresh(); const b = new G.Fight(s2, foe({ damage: 40 }));
  rand.v = 0.3; const ha = a.hp, ma = a.mp, hb = b.hp; a.enemyTurn(); b.enemyTurn();
  ok(a.mp < ma && (ha - a.hp) < (hb - b.hp) * 0.8, "mana shield: magicka takes a quarter " + Math.round(ha - a.hp) + " vs " + Math.round(hb - b.hp)); }
{ const s = fresh(); wear(s, "ench|leather_bracers|fortune|25|0"); const f = new G.Fight(s, foe()); f.won = true; f.ehp = 0; f.apply(G.now());
  ok(f.e.gold[0] === 13 && f.e.gold[1] === 25, "fortune: fuller purse " + f.e.gold); }
{ const s = fresh(); const i0 = PFX.num(s, "tbinit"); wear(s, "ench|leather_boots|swiftness|4|0"); ok(PFX.num(s, "tbinit") === i0 + 4, "swiftness: +4 initiative");
  ok(TB.stats(s, new G.Fight(s, foe())).init >= 14, "it shows in the turn-based stats"); }
{ const s = fresh(); const dr = foe({ name: "Dragon", tags: ["dragon", "big"] }); const k0 = PFX.inMult(new G.Fight(s, dr), {});
  wear(s, "ench|steel_shield|dragonward|30|0"); ok(PFX.inMult(new G.Fight(s, dr), {}) < k0 - 0.25, "dragonward");
  wear(s, "ench|iron_helmet|gravewarden|25|0"); ok(PFX.inMult(new G.Fight(s, foe({ name: "Draugr", tags: ["undead"] })), {}) <= 0.76, "gravewarden"); }
{ const s = fresh(); wear(s, "ench|iron_gauntlets|executioner|20|0"); const f = new G.Fight(s, foe({ health: 400 })); f.firstHit = false;
  const o1 = PFX.out(f, {}); f.ehp = 50; ok(PFX.out(f, {}) - o1 >= 0.19, "executioner on a nearly-done foe"); }
{ const s = fresh(); wear(s, "ench|hide_bracers|huntsman|20|0"); ok(PFX.out(new G.Fight(s, foe({ name: "Wolf", tags: ["beast"] })), {}) >= 1.19, "huntsman vs beasts");
  const s2 = fresh(); wear(s2, "ench|leather_boots|ambusher|30|0"); const f = new G.Fight(s2, foe()); ok(PFX.out(f, {}) >= 1.29, "ambusher first blow"); f.firstHit = false; ok(PFX.out(f, {}) < 1.01, "only the first"); }
{ const s = fresh(); wear(s, "ench|steel_armor|thorns|40|0", "ench|steel_shield|thorns|40|0"); ok(ENCH.worn(s, "e2:thorns") === 30, "stacked thorns capped at 30%"); }

// ---- 6. perks
for (const id of ["runic_enchanter", "talisman_maker", "overcharge"]) ok(PERKS.BY_ID[id] && PFX.FX[id], "perk " + id);
for (const id of ["enchanter", "hex_enchanter", "rune_smith", "jeweller", "fire_enchanter"]) ok(PERKS.BY_ID[id], "old perk kept " + id);
{ const s = fresh(); const gem = G.give(s, "soul_gem_greater"), blade = G.give(s, "iron_sword"), arm = G.give(s, "steel_armor");
  const p0 = ENCH.preview(s, blade, "echo", gem).mag, a0 = ENCH.preview(s, arm, "thorns", gem).mag;
  s.perks = s.perks || {}; s.perks.runic_enchanter = 1; s.perks.talisman_maker = 1;
  ok(ENCH.preview(s, blade, "echo", gem).mag > p0 && ENCH.preview(s, arm, "thorns", gem).mag > a0, "runic enchanter / talisman maker make them stronger");
  const fl = ENCH.preview(s, blade, "fire", gem).mag; s.perks.runic_enchanter = 0; ok(ENCH.preview(s, blade, "fire", gem).mag === fl, "runic doesn't touch fire"); }
{ const s = fresh(); s.perks = s.perks || {}; s.perks.overcharge = 1; const id = G.give(s, "ench|steel_sword|reaping|20|9000"); G.equip(s, id); const f = new G.Fight(s, foe({ health: 400 }));
  rand.v = 0.05; const r = ENCH.onHit(f, f.weapon.enchant, 20, {}); ok(r.dmg === 30 && /surge/.test(r.label), "overcharge surges " + r.dmg);
  const fr = ENCH.onHit(f, { effect: "fire", magnitude: 20 }, 20, {}); ok(fr.dmg === 30, "it surges old effects too"); }

// ---- 6b. once stackable statuses exist (combat2), statuses go through them instead
{ const got = []; globalThis.STACKS = { add: (f, side, kind, n) => got.push(side + ":" + kind + ":" + n) };
  rand.v = 0.9; for (const [e, m] of [["numbing", 20], ["wildfire", 24], ["venom", 8], ["sundering", 10]]) { const f = fight({ health: 900 }, e, m); ENCH.onHit(f, en(f), m, {}); }
  ok(got.join(",") === "foe:chill:2,foe:burn:8,foe:poison:8,foe:vulnerable:1", "statuses become stacks when stacks exist: " + got.join(","));
  delete globalThis.STACKS; const f = fight({}, "venom", 8); ENCH.onHit(f, en(f), 8, {}); ok(f._venom?.length === 1, "and the old way without them"); }

// ---- 7. a real attack through the engine, and a whole quick fight
{ rand.v = null; const s = fresh(30); s.skills["One-Handed"].lvl = 60; const id = G.give(s, "ench|steel_sword|chain_lightning|24|9000"); G.equip(s, id);
  const f = new G.Fight(s, G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === "Bandit outlaw") }, 30)); f.run({ trySneak: false });
  ok(f.log.some((l) => /chain lightning/.test(l.me)), "chain lightning shows in the fight log"); }
rand.v = null;

// ---- 8. balance: turn-based sims vs strong foes. No one-shots, fights don't end much faster than with a plain sword.
const boss = (key, L) => { const e = G.scaleEnemy({ ...DUNGEONS.ENEMY[key] }, L); e.health = Math.round(e.health * 0.8); e.hp = e.health; e.damage = Math.round(e.damage * 0.8 * 10) / 10; e.boss = true; return e; };
const enc = (name, L) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, L);
function hero(L, eff, worn) {
  const s = fresh(L); s.level = L;
  for (const k of ["One-Handed", "Heavy Armor", "Blocking", "Enchanting"]) s.skills[k].lvl = Math.min(100, 15 + 2.2 * L);
  s.hpBonus = Math.round((L - 1) * 7); s.spBonus = Math.round((L - 1) * 3);
  const w = eff ? "ench|steel_sword|" + eff + "|" + ENCH.WEAPON[eff][1] + "|99999" : "steel_sword"; G.equip(s, G.give(s, w));
  for (const a of ["steel_helmet", "steel_gauntlets", "steel_boots"]) G.equip(s, G.give(s, a));
  G.equip(s, G.give(s, worn ? "ench|steel_armor|" + worn + "|" + ENCH.ARMOR[worn][2] + "|0" : "steel_armor"));
  G.equip(s, G.give(s, "steel_shield")); G.give(s, "potion_health", 3);
  G.loadout(s).rules = [{ if: "hp_below", pct: 40, do: "potion:health" }, { if: "always", do: "attack" }];
  G.setHealth(s, G.maxHealth(s)); s.health = G.maxHealth(s); s.healthTs = G.now();
  return s;
}
function sim(L, mkFoe, eff, worn) {
  let rounds = 0, wins = 0, maxShare = 0, n = 0, rate = 0;
  for (let i = 0; i < RUNS; i++) {
    const s = hero(L, eff, worn), f = new G.Fight(s, mkFoe());
    const ss = TB.simulate(f, { t: G.now() }); n++; rounds += ss.round; if (f.won) wins++;
    const mx = ss.ehpMax || f.ehp0; let prev = mx;
    for (const e of ss.ev) { if (e.kind === "me" && typeof e.ehp === "number") { maxShare = Math.max(maxShare, (prev - e.ehp) / mx); } if (typeof e.ehp === "number") prev = e.ehp; }
    rate += (mx - Math.max(0, f.ehp)) / mx / Math.max(1, ss.round);   // share of the foe's health taken per round (one wave)
  }
  return { rounds: rounds / n, win: wins / n, maxShare, rate: rate / n };
}
const FOES = { "draugr deathlord (boss)": (L) => () => boss("deathlord", L), "giant": (L) => () => enc("Giant", L), "dragon": (L) => () => enc("Dragon", L) };
for (const [L, FL] of [[20, 20], [35, 35], [40, 18]]) for (const [fn, mk] of Object.entries(FOES)) {
  const base = sim(L, mk(FL));
  const fire = sim(L, mk(FL), "fire");   // the old fire enchantment at full strength: the yardstick
  const rows = [["plain", base], ["old fire", fire]];
  for (const e of NEWW) rows.push([e, sim(L, mk(FL), e)]);
  for (const w of ["thorns", "last_ward", "mana_shield"]) rows.push(["worn " + w, sim(L, mk(FL), null, w)]);
  console.log("hero L" + L + " vs L" + FL + " " + fn + ": " + rows.map(([k, r]) => k + " " + r.rounds.toFixed(1) + "r " + Math.round(r.win * 100) + "% " + Math.round(r.rate * 100) + "%/r max" + Math.round(r.maxShare * 100)).join(" · "));
  for (const [k, r] of rows) {
    ok(r.maxShare <= 0.45, "no one-shot: " + k + " vs " + fn + " L" + L + " took " + Math.round(r.maxShare * 100) + "% in one action");
    ok(r.rate <= 0.25, "fight not too short: " + k + " vs " + fn + " L" + L + " takes " + Math.round(r.rate * 100) + "% a round (needs 4+ rounds)");
    if (!/plain|old fire/.test(k)) ok(r.rate <= fire.rate * 1.8 + 0.015, "not wildly above the old fire enchantment: " + k + " vs " + fn + " L" + L + " " + Math.round(r.rate * 100) + "% vs " + Math.round(fire.rate * 100) + "%");
  }
}

console.log(fails ? fails + " FAILED, " + pass + " passed" : "ALL OK (" + pass + " checks)");
if (fails) throw new Error(fails + " failed");
`, c);
