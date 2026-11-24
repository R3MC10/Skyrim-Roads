// Jewellery slots (one amulet, two rings), jewellery as gear (forge, loot, shops, enchanting) and the bigger list of
// enchantments: every effect is checked to change the number it says it changes.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const rand = { v: null };
const M = Object.create(Math); M.random = () => (rand.v == null ? Math.random() : rand.v);
const c = { console, Math: M, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RegExp, rand };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "smithing.js", "jewelry.js", "shopcap.js", "dollart.js"])
  vm.runInContext(fs.readFileSync(__GAME + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let pass = 0; const ok = (v, m) => { if (!v) throw new Error("FAIL " + m); pass++; };
const fresh = () => { const s = G.newSave("j" + Math.random(), "J", "nord"); s.inv = []; s.location = "Whiterun"; return s; };

// ---- slots and equipping
ok(G.SLOTS.includes("ring") && G.SLOTS.includes("amulet"), "ring and amulet are equipment slots");
ok([...DOLL.SLOTS_LEFT, ...DOLL.SLOTS_RIGHT, ...DOLL.SLOTS_JEWEL.filter((x) => x !== "ring2")].sort().join() === [...G.SLOTS].sort().join(), "doll shows every slot");
{
  const s = fresh();
  const r1 = G.give(s, "silver_ring"), r2 = G.give(s, "gold_ring"), r3 = G.give(s, "iron_ring"), a1 = G.give(s, "gold_necklace"), a2 = G.give(s, "silver_necklace");
  ok(r1 !== r2 && s.inv.filter((r) => r.item === "silver_ring").length === 1, "rings don't stack");
  G.equip(s, r1); G.equip(s, r2);
  let eq = G.loadout(s).equipment;
  ok(eq.ring === r1 && eq.ring2 === r2, "two rings, one per hand");
  G.equip(s, r3);
  ok(eq.ring === r3 && eq.ring2 === r2, "a third ring swaps the first");
  G.equip(s, r1, "ring2");
  ok(eq.ring2 === r1 && eq.ring === r3, "a ring goes on the hand you pick");
  G.equip(s, r1, "ring");
  ok(eq.ring === r1 && eq.ring2 == null, "one ring can't be on both hands");
  G.equip(s, a1); G.equip(s, a2);
  ok(eq.amulet === a2, "only one amulet");
  ok(G.wornSlot(s, r1) === "ring" && G.wornSlot(s, a2) === "amulet", "wornSlot finds them");
  G.unequip(s, G.wornSlot(s, r1)); ok(eq.ring == null, "take a ring off");
  ok(DOLL.candidates(s, "ring2").every((c) => D.ITEMS[c.row.item].slot === "ring"), "second ring slot lists rings");
  ok(G.equip(s, a1).startsWith("Equipped"), "equip message");
}
// ---- old saves: stacked rings become single pieces
{
  const s = fresh(); s.inv.push({ id: s.nextInv++, item: "silver_ring", qty: 3, charge: null });
  G.migrate(s);
  ok(s.inv.filter((r) => r.item === "silver_ring").length === 3 && s.inv.every((r) => r.qty === 1), "old stacked rings split into three");
}
// ---- jewellery is real gear: tiers, recipes, loot, shops
ok(JEWELRY.ALL.length >= 30, "lots of bases: " + JEWELRY.ALL.length);
for (const m of ["iron", "silver", "gold", "moonstone", "dwarven"]) ok(D.ITEMS[m + "_ring"]?.slot === "ring" && D.ITEMS[m + "_necklace"]?.slot === "amulet", m + " ring and necklace");
ok(D.ITEMS.gold_diamond_ring.jpow > D.ITEMS.silver_ring.jpow && D.ITEMS.silver_ring.jpow > D.ITEMS.iron_ring.jpow, "finer pieces hold more magic");
ok(SMITH.RECIPES.moonstone_ring.perk === "elven_smithing" && SMITH.RECIPES.dwarven_necklace.perk === "dwarven_smithing" && SMITH.RECIPES.iron_ring.mats[0][0] === "mat_iron", "forge recipes");
{
  const s = fresh(); s.location = "Whiterun"; G.give(s, "mat_silver", 2); G.give(s, "gem_ruby", 1);
  const m = SMITH.make(s, "silver_ruby_ring");
  ok(/You make/.test(m) && s.inv.some((r) => r.item === "silver_ruby_ring"), "forge makes a ring: " + m);
  ok(!s.inv.some((r) => r.item === "gem_ruby") && s.inv.find((r) => r.item === "mat_silver").qty === 1, "forge consumes ingot and gem");
  ok(/Needs/.test(SMITH.make(s, "moonstone_ring")), "moonstone needs the perk");
}
{
  const s = fresh(); s.level = 20; let n = 0, en = 0;
  for (let i = 0; i < 400; i++) { const got = JEWELRY.loot(s, { name: "Bandit chief", tags: ["humanoid", "elite"], level: 20 }); n += got.length; }
  const rows = s.inv.filter((r) => ["ring", "amulet"].includes(D.ITEMS[r.item].slot)); en = rows.filter((r) => D.ITEMS[r.item].aenchant).length;
  ok(n > 15 && n < 90, "elite foes drop jewellery about 10% of the time: " + n);
  ok(en > 0 && en < rows.length, "some of it enchanted: " + en + "/" + rows.length);
  ok(JEWELRY.loot(s, { name: "Wolf", tags: ["beast"], level: 5 }).length === 0, "wolves carry no rings");
  const boss = []; for (let i = 0; i < 200; i++) boss.push(...JEWELRY.loot(s, { name: "Draugr Deathlord", tags: ["undead"], boss: true, level: 30 }));
  ok(boss.length > 25, "bosses drop more: " + boss.length);
}
ok(D.SHOP_STOCK.general.includes("silver_ring") && D.SHOP_STOCK.wizard.some((id) => id.startsWith("ench|silver_ring")), "shops stock jewellery");
ok(SHOPCAP.ok("iron_ring") && SHOPCAP.ok("ench|silver_ring|magicka|12|0") && !SHOPCAP.ok("gold_diamond_ring"), "traders sell plain jewellery only");

// ---- enchanting jewellery
{
  const s = fresh(); s.location = "Whiterun"; s.skills.Enchanting.lvl = 50;
  const e1 = G.give(s, "ench|silver_ring|resist_fire|10|0");
  ok(/learned Resist Fire/.test(ENCH.disenchant(s, e1)), "breaking a ring teaches its effect");
  s.enchants.push("health", "crit");
  const plain = G.give(s, "silver_ring"), gem = G.give(s, "soul_gem_greater"), gem2 = G.give(s, "soul_gem_greater");
  const pv = ENCH.preview(s, plain, "resist_fire", gem);
  const dia = G.give(s, "gold_diamond_ring"), pvD = ENCH.preview(s, dia, "resist_fire", gem);
  ok(pvD.mag > pv.mag, "diamond gold ring takes a stronger enchantment " + pvD.mag + " > " + pv.mag);
  const m = ENCH.enchant(s, plain, "resist_fire", gem);
  ok(/Silver Ring of Resist Fire/.test(m), "enchant a ring: " + m);
  const neck = G.give(s, "gold_necklace");
  ok(/can't go on that/.test(ENCH.enchant(s, neck, "crit", gem2)), "Fortify Critical is for rings, not amulets");
  ok(ENCH.canBase(D.ITEMS.gold_necklace) && !ENCH.canBase(D.ITEMS[s.inv.find((r) => r.item.startsWith("ench|silver_ring")).item]), "plain jewellery can be enchanted, enchanted can't");
  ok(/one of a kind/.test(ENCH.disenchant(s, G.give(s, "gauldur_amulet"))), "unique amulets can't be broken");
  ok(Object.keys(ENCH.ARMOR).filter((e) => ENCH.ARMOR[e][3].includes("ring")).length >= 25, "plenty of ring effects");
}
// every effect can be learned somewhere (found gear, shops, dungeon loot)
{
  const all = new Set();
  const scan = (id) => { const e = ENCH.effectOf(id); if (e) all.add(e); };
  for (const t of ["humanoid", "elite"]) for (const [id] of D.LOOT[t]) scan(id);
  for (const id of D.SHOP_STOCK.wizard) scan(id);
  for (const t of Object.values(DUNGEONS.THEMES)) for (const id of t.loot) scan(id);
  for (const id of Object.keys(D.ITEMS)) if (D.ITEMS[id].enchant) scan(id);
  const miss = [...Object.keys(ENCH.WEAPON), ...Object.keys(ENCH.ARMOR)].filter((e) => !all.has(e));
  ok(!miss.length, "every effect can be found: missing " + miss.join(","));
}
const total = Object.keys(ENCH.WEAPON).length + Object.keys(ENCH.ARMOR).length;
ok(total >= 40, "lots of enchantments: " + total);
for (const e of [...Object.keys(ENCH.WEAPON), ...Object.keys(ENCH.ARMOR)]) ok(ENCH.describe(e, 10).length >= 8 && !/\\{m\\}/.test(ENCH.describe(e, 10)), "plain description for " + e);

// ---- every worn effect changes its number
function wearing(eff, mag, slot) {
  const s = fresh(); s.skills.Sneak.lvl = 20;
  const base = slot === "ring" ? "silver_ring" : slot === "amulet" ? "silver_necklace" : { feet: "iron_boots", hands: "iron_gauntlets", chest: "iron_armor", head: "iron_helmet", shield: "iron_shield" }[slot];
  const id = G.give(s, "ench|" + base + "|" + eff + "|" + mag + "|0"); G.equip(s, id);
  return s;
}
const bare = () => fresh();
const foes = {
  bandit: { name: "Bandit", tags: ["humanoid"], health: 400, damage: 20, level: 3 },
  fire: { name: "Fire mage", tags: ["humanoid", "mage"], health: 400, damage: 20, level: 3, element: "fire" },
  frost: { name: "Ice wraith", tags: [], health: 400, damage: 20, level: 3 },
  shock: { name: "Storm mage", tags: ["humanoid", "mage"], health: 400, damage: 20, level: 3, element: "shock" },
  spider: { name: "Frostbite spider", tags: ["beast"], health: 400, damage: 20, level: 3 },
  draugr: { name: "Draugr", tags: ["undead"], health: 400, damage: 20, level: 3 },
  boss: { name: "Draugr Deathlord", tags: ["undead"], health: 400, damage: 20, level: 3, boss: true },
};
const fight = (s, foe = "bandit") => { const f = new G.Fight(s, { ...foes[foe] }); f.turn = 1; return f; };
const spell = (k) => D.SPELLS[k];
const CHECK = {
  health: (a, b) => G.maxHealth(a) > G.maxHealth(b), magicka: (a, b) => G.maxMagicka(a) > G.maxMagicka(b), stamina: (a, b) => G.maxStamina(a) > G.maxStamina(b),
  carry: (a, b) => G.capacity(a) > G.capacity(b),
  onehanded: (a, b) => { for (const s of [a, b]) G.equip(s, G.give(s, "iron_sword")); rand.v = 0.5; const r = fight(a).weaponDamage() > fight(b).weaponDamage(); rand.v = null; return r; },
  twohanded: (a, b) => { for (const s of [a, b]) G.equip(s, G.give(s, "iron_greatsword")); rand.v = 0.5; const r = fight(a).weaponDamage() > fight(b).weaponDamage(); rand.v = null; return r; },
  archery: (a, b) => { for (const s of [a, b]) { G.equip(s, G.give(s, "hunting_bow")); } rand.v = 0.5; const r = fight(a).weaponDamage() > fight(b).weaponDamage(); rand.v = null; return r; },
  sneak: (a, b) => G.skill(a, "Sneak") > G.skill(b, "Sneak"), lockpicking: (a, b) => G.skill(a, "Lockpicking") > G.skill(b, "Lockpicking"),
  heavyarmor: (a, b) => G.skill(a, "Heavy Armor") > G.skill(b, "Heavy Armor"), lightarmor: (a, b) => G.skill(a, "Light Armor") > G.skill(b, "Light Armor"),
  smithing: (a, b) => G.skill(a, "Smithing") > G.skill(b, "Smithing"), alchemy: (a, b) => G.skill(a, "Alchemy") > G.skill(b, "Alchemy"),
  pickpocket: (a, b) => G.skill(a, "Pickpocket") > G.skill(b, "Pickpocket"), speech: (a, b) => G.skill(a, "Speechcraft") > G.skill(b, "Speechcraft"),
  destruction: (a, b) => G.spellDamage(a, spell("flames")) > G.spellDamage(b, spell("flames")),
  restoration: (a, b) => G.spellHeal(a, spell("healing")) > G.spellHeal(b, spell("healing")),
  alteration: (a, b) => G.spellCost(a, spell("oakflesh")) < G.spellCost(b, spell("oakflesh")),
  conjuration: (a, b) => G.spellCost(a, spell("conjure_familiar")) < G.spellCost(b, spell("conjure_familiar")),
  illusion: (a, b) => G.spellCost(a, spell("fury")) < G.spellCost(b, spell("fury")),
  barter: (a, b) => G.haggle(a) > G.haggle(b),
  resist: (a, b) => { const hit = (s) => { rand.v = 0.5; const f = fight(s, "fire"); f.fp = null; f.allies = []; const h = f.hp; f.enemyTurnInner(); rand.v = null; return h - f.hp; }; return hit(a) < hit(b); },
  regen_health: (a, b) => { const fa = fight(a), fb = fight(b); fa.hp = fb.hp = 20; PFX.tick(fa, { me: "" }); PFX.tick(fb, { me: "" }); a.health = b.health = 20; a.healthTs = b.healthTs = G.now() - 600; return fa.hp > fb.hp && G.curHealth(a) > G.curHealth(b); },
  regen_magicka: (a, b) => fight(a).regenMp > fight(b).regenMp, regen_stamina: (a, b) => fight(a).regenSp > fight(b).regenSp,
  resist_fire: (a, b) => PFX.inMult(fight(a, "fire"), {}) < PFX.inMult(fight(b, "fire"), {}) && PFX.inMult(fight(a, "bandit"), {}) === PFX.inMult(fight(b, "bandit"), {}),
  resist_frost: (a, b) => PFX.inMult(fight(a, "frost"), {}) < PFX.inMult(fight(b, "frost"), {}) && PFX.inMult(fight(a, "fire"), {}) === PFX.inMult(fight(b, "fire"), {}),
  resist_shock: (a, b) => PFX.inMult(fight(a, "shock"), {}) < PFX.inMult(fight(b, "shock"), {}) && PFX.inMult(fight(a, "bandit"), {}) === PFX.inMult(fight(b, "bandit"), {}),
  resist_poison: (a, b) => PFX.inMult(fight(a, "spider"), {}) < PFX.inMult(fight(b, "spider"), {}) && PFX.inMult(fight(a, "bandit"), {}) === PFX.inMult(fight(b, "bandit"), {}),
  block: (a, b) => PFX.sum(a, "block", fight(a), {}) > PFX.sum(b, "block", fight(b), {}),
  crit: (a, b) => { for (const s of [a, b]) G.equip(s, G.give(s, "iron_sword")); return fight(a).critChance()[0] > fight(b).critChance()[0]; },
  evasion: (a, b) => PFX.sum(a, "dodge", fight(a), {}) > PFX.sum(b, "dodge", fight(b), {}),
};
for (const e of Object.keys(ENCH.ARMOR)) {
  ok(CHECK[e], "a check exists for " + e);
  const slot = ENCH.ARMOR[e][3].includes("ring") ? "ring" : ENCH.ARMOR[e][3][0];
  ok(CHECK[e](wearing(e, ENCH.ARMOR[e][2], slot), bare()), e + " changes its number");
}
// caps: five pieces of the same effect stop at the cap
{
  const s = fresh();
  for (const b of ["silver_ring", "gold_ring", "silver_necklace", "iron_armor", "iron_boots"]) { const id = G.give(s, "ench|" + b + "|resist_fire|30|0"); G.equip(s, id); }
  ok(Math.abs(PFX.inMult(fight(s, "fire"), {}) - 0.5) < 1e-9, "Resist Fire stops at 50%");
  const t = fresh(); for (const b of ["silver_ring", "gold_ring", "silver_necklace", "iron_armor"]) G.equip(t, G.give(t, "ench|" + b + "|health|60|0"));
  ok(G.maxHealth(t) - G.maxHealth(fresh()) === 150, "Fortify Health stops at +150");
}
// ---- every weapon effect does what it says
function hit(eff, foe = "bandit", mag) {
  const s = fresh(); s.skills.Enchanting.lvl = 100;
  const id = G.give(s, "ench|iron_sword|" + eff + "|" + (mag || ENCH.WEAPON[eff][1]) + "|3000"); G.equip(s, id);
  rand.v = 0.01; const f = fight(s, foe); f.fp = null; f.hp = 30; f.sp = 10; f.mp = 10; const e0 = f.ehp;
  const label = f.attack(false); rand.v = null;
  return { f, dmg: e0 - f.ehp, label };
}
const plain = (foe = "bandit") => { const s = fresh(); G.equip(s, G.give(s, "iron_sword")); rand.v = 0.01; const f = fight(s, foe); f.fp = null; const e0 = f.ehp; f.attack(false); rand.v = null; return e0 - f.ehp; };
const p0 = plain();
for (const e of ["fire", "frost", "shock"]) { const h = hit(e); ok(h.dmg >= p0 + ENCH.WEAPON[e][1] - 0.01, e + " adds its damage " + h.dmg + " vs " + p0); }
{ const h = hit("absorb"); ok(h.f.hp > 30 && h.dmg > p0, "Absorb Health heals you and hurts them"); }
{ const h = hit("absorb_stamina"); ok(h.f.sp > 10 && h.dmg > p0, "Absorb Stamina"); }
{ const h = hit("absorb_magicka"); ok(h.f.mp > 10 && h.dmg > p0, "Absorb Magicka"); }
{ const h = hit("paralyze"); ok(h.f.eParalyzed > 0, "Paralyze: " + h.label); ok(!(hit("paralyze", "boss").f.eParalyzed > 0), "bosses shrug off paralysis"); }
{ const h = hit("fear"); ok(h.f.fearTurns > 0, "Fear: " + h.label); ok(!(hit("fear", "draugr").f.fearTurns > 0), "the dead don't fear"); }
{ const h = hit("calm"); ok(h.f.calmTurns > 0, "Calm: " + h.label); }
{ const h = hit("soul_trap"); ok(h.f.soulTrap === true, "Soul Trap marks the soul"); }
{ const u = hit("turn_undead", "draugr"), d0 = plain("draugr"); ok(u.dmg > d0, "Turn Undead hurts the undead more"); ok(Math.abs(hit("turn_undead").dmg - p0) < 0.01, "and does nothing extra to the living"); }
{ const h = hit("bleed"); ok(h.f.bleed.length > 0 && h.f.bleed[0].dmg > 0, "Bleeding"); }
// cooldown: paralyze can't chain every turn
{ const s = fresh(); G.equip(s, G.give(s, "ench|iron_sword|paralyze|20|3000")); rand.v = 0.01; const f = fight(s); f.fp = null; let n = 0; for (let i = 0; i < 6; i++) { f.turn = i + 1; f.eParalyzed = 0; f.attack(false); if (f.eParalyzed > 0) n++; } rand.v = null; ok(n <= 2, "paralysis needs a rest between: " + n); }
// perks: Jeweller, Warding and Hex Enchanter make real numbers bigger
{
  const s = fresh(); s.skills.Enchanting.lvl = 60; s.location = "Whiterun"; s.enchants = ["resist_fire", "paralyze", "magicka"];
  const ring = G.give(s, "silver_ring"), sword = G.give(s, "iron_sword"), boots = G.give(s, "iron_boots"), gem = G.give(s, "soul_gem_greater");
  const r0 = ENCH.preview(s, ring, "magicka", gem).mag, w0 = ENCH.preview(s, sword, "paralyze", gem).mag, b0 = ENCH.preview(s, boots, "resist_fire", gem).mag;
  s.perks = { enchanter: 1, jeweller: 1, warding_enchanter: 1, hex_enchanter: 1 };
  const r1 = ENCH.preview(s, ring, "magicka", gem).mag, w1 = ENCH.preview(s, sword, "paralyze", gem).mag, b1 = ENCH.preview(s, boots, "resist_fire", gem).mag;
  ok(r1 > r0 && w1 > w0 && b1 > b0, "new Enchanting perks: ring " + r0 + "→" + r1 + ", paralyze " + w0 + "→" + w1 + ", resist fire " + b0 + "→" + b1);
  ok(PFX.num(s, "jewelfind") === 0.5, "Jeweller finds more jewellery");
}
console.log("test_jewelry: " + pass + " checks passed");
`, c);
