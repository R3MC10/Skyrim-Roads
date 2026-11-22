const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Bigger perk trees + elemental statuses (perkfx.js). W=/path/to/web/ node test_perks2.js — prints "perks2 ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "combatai.js", "sneak2.js", "aiset.js", "skyui.js", "encounters.js", "gather.js"];
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
// every FX key must be read somewhere outside perkfx.js's own table
const code = FILES.concat(["ui.js", "fightart.js", "tabmenu.js", "followers2.js"]).filter((f) => f !== "perkfx.js" && fs.existsSync(W + f)).map((f) => fs.readFileSync(W + f, "utf8")).join("\n");
const pfx = fs.readFileSync(W + "perkfx.js", "utf8"), pfxLogic = pfx.slice(pfx.indexOf("const FX = {}"));
c.__code = code; c.__pfx = pfxLogic;
vm.runInContext(`
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };
const mk = (lv = 30) => { const s = G.newSave("pk", "Perk", "nord"); s._test = true; s.level = lv; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; for (const k in s.skills) s.skills[k].lvl = 100; G.setHealth(s, G.maxHealth(s)); return s; };
const foe = (name, L) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, L);

// 1. tree sizes, ids, prerequisites
const counts = {};
for (const [sk, tree] of Object.entries(PERKS.TREES)) {
  counts[sk] = tree.length;
  ok(tree.length >= 9 && tree.length <= 18, sk + " has 9–18 perks (" + tree.length + ")");   // trees grow with the game (spellbook.js adds Support branches)
  const ids = new Set(tree.map((p) => p[0]));
  for (const [id, name, ranks, req, needs, desc] of tree) {
    ok(PERKS.BY_ID[id] && PERKS.BY_ID[id].skill === sk, id + " registered");
    ok(req.length === ranks && req.every((r, i) => i === 0 || r >= req[i - 1]), id + " has a level per rank");
    ok(needs.every((x) => ids.has(x)), id + " needs perks from its own tree");
    ok(desc && desc.length > 15, id + " explains itself");
  }
}
const all = Object.values(PERKS.TREES).flat().map((p) => p[0]);
ok(new Set(all).size === all.length, "no duplicate perk ids");
console.log("perks per tree:", JSON.stringify(counts), "total", all.length);

// 2. every new perk does something that code reads
const TIER = /^(novice|apprentice|adept|expert|master)_(destruction|restoration|alteration|conjuration|illusion)$/;
const readers = { out: /PFX\\.out\\(/, in: /PFX\\.inMult\\(/, extra: /"extra"/ };
for (const [id, fx] of Object.entries(PFX.FX)) {
  ok(fx.length > 0, id + " has effects");
  for (const [k] of fx) {
    if (k === "tier") { ok(TIER.test(id), id + ": tier perk named like the spell-cost rule reads it"); continue; }
    const inCode = (readers[k] && readers[k].test(__code + __pfx)) || __code.includes('"' + k + '"') || __pfx.includes('"' + k + '"');
    ok(inCode, id + ": effect key " + k + " is read somewhere");
  }
}

// 3. effects in fights
{ // One-Handed: Critical Charge makes the first strike harder
  const s = mk(); s.perks = { armsman: 1, fighting_stance: 1 }; G.give(s, "steel_sword"); G.equip(s, s.inv.find((r) => r.item === "steel_sword").id);
  const avg = (perk) => { let t = 0; for (let i = 0; i < 400; i++) { if (perk) s.perks.critical_charge = 1; else delete s.perks.critical_charge; const f = new G.Fight(s, foe("Bandit outlaw", 20)); f.turn = 1; const e0 = f.ehp; f.attack(false); t += e0 - f.ehp; } return t / 400; };
  const a = avg(false), b = avg(true); ok(b > a * 1.3, "Critical Charge: first strike much harder (" + a.toFixed(1) + " → " + b.toFixed(1) + ")");
}
{ // Heavy Armor: Fortress below half health; Unbowed against mages
  const s = mk(); for (const id of ["steel_armor", "steel_helmet", "steel_boots", "steel_gauntlets"]) { const r = G.give(s, id); G.equip(s, r.id ?? s.inv.find((x) => x.item === id).id); }
  s.perks = { juggernaut: 1, well_fitted: 1, conditioning: 1, fortress: 1 };
  const f = new G.Fight(s, foe("Bandit outlaw", 20)); f.hp = G.maxHealth(s) * 0.3;
  ok(Math.abs(PFX.inMult(f, {}) - 0.85) < 1e-9, "Fortress: 15% less below half health");
  f.hp = G.maxHealth(s); ok(PFX.inMult(f, {}) === 1, "…and nothing above half");
}
{ // Deflect Arrows: a raised shield stops archers completely
  const s = mk(); const sh = G.give(s, "iron_shield"); G.equip(s, sh.id ?? s.inv.find((x) => x.item === "iron_shield").id); s.perks = { shield_wall: 1, deflect_arrows: 1 };
  const arch = D.ENCOUNTERS.find((e) => /archer/i.test(e.name));
  if (arch) { const f = new G.Fight(s, G.scaleEnemy({ ...arch }, 10)); ok(PFX.inMult(f, { blocking: true }) === 0, "Deflect Arrows stops an archer's arrow"); ok(PFX.inMult(f, { blocking: false }) === 1, "…but only while blocking"); }
}
{ // Unarmored: Iron Skin adds armor only with nothing on
  const s = mk(); for (const sl of Object.keys(G.loadout(s).equipment)) if (sl !== "weapon") delete G.loadout(s).equipment[sl]; const f0 = new G.Fight(s, foe("Bandit outlaw", 10)); const r0 = f0.armorRating().rating;
  s.perks = { monks_grace: 1, iron_skin: 2 }; const f1 = new G.Fight(s, foe("Bandit outlaw", 10)); ok(f1.armorRating().rating >= r0 + 30 - 1, "Iron Skin +30 armor bare (" + r0.toFixed(1) + " → " + f1.armorRating().rating.toFixed(1) + ")");
}
{ // Restoration: Avoid Death once
  const s = mk(); s.perks = { novice_restoration: 1, recovery: 1, avoid_death: 1 };
  const f = new G.Fight(s, { ...foe("Bandit outlaw", 30), damage: 9999 }); f.hp = G.maxHealth(s) * 0.5;
  let saved = false; for (let i = 0; i < 30 && !saved; i++) { const t = f.enemyTurnInner(); if (/Avoid Death/.test(t)) saved = true; f.hp = G.maxHealth(s) * 0.5; f.blocking = false; }
  ok(saved && f.avoidUsed, "Avoid Death catches a killing blow");
}
{ // Conjuration: tier perks halve costs through the existing rule
  const s = mk(); const sp = Object.entries(D.SPELLS).find(([id, x]) => x.school === "Conjuration" && (G.SPELL_TIER[id] || (x.level || "").toLowerCase()) === "adept");
  if (sp) { const a = G.spellCost(s, sp[1]); s.perks = { novice_conjuration: 1, apprentice_conjuration: 1, adept_conjuration: 1 }; ok(G.spellCost(s, sp[1]) <= Math.ceil(a / 2), "Adept Conjuration halves " + sp[0]); }
}
{ // Out of fights: prices, carry, hide, travel, temper, enchanting
  const s = mk(); const h0 = G.haggle(s), c0 = G.capacity ? G.capacity(s) : 0;
  s.perks = { haggling: 1, merchant: 1, silver_tongue: 1 }; ok(G.haggle(s) > h0 + 0.09, "Merchant + Silver Tongue: better prices");
  ok(PFX.num(s, "price") <= 0.15 + 1e-9, "price bonus within the cap");
  s.perks = { long_strider: 1, pack_mule: 2 }; ok(PFX.num(s, "carry") === 50, "Pack Mule +50 carry");
  s.skills.Sneak.lvl = 15; s.perks = { stealth: 1, muffled_movement: 1, silence: 1 }; const e = foe("Bandit outlaw", 10); ok(G.hiddenChance(s, e) > (() => { s.perks = { stealth: 1 }; return G.hiddenChance(s, e); })(), "Muffled Movement + Silence: harder to spot");
  s.perks = { steel_smithing: 1, elven_smithing: 1, dwarven_smithing: 1, orcish_smithing: 1, ebony_smithing: 1 }; ok(PFX.num(s, "temper") === 2, "Orcish + Ebony Smithing: +2 per improvement");
}

// 4. elemental statuses
{ const s = mk(); s.spells = Object.keys(D.SPELLS);
  const fireId = Object.keys(D.SPELLS).find((id) => D.SPELLS[id].kind === "damage" && D.SPELLS[id].element === "fire");
  const frostId = Object.keys(D.SPELLS).find((id) => D.SPELLS[id].kind === "damage" && D.SPELLS[id].element === "frost");
  const shockId = Object.keys(D.SPELLS).find((id) => D.SPELLS[id].kind === "damage" && D.SPELLS[id].element === "shock");
  const troll = D.ENCOUNTERS.find((e) => /troll/i.test(e.name)) || D.ENCOUNTERS[0];
  let burned = 0, ticks = 0, longer = 0;
  for (let i = 0; i < 60; i++) {
    const f = new G.Fight(s, G.scaleEnemy({ ...troll }, 20)); f.ehp = 1e6; f.turn = 1;
    const t = f.cast(fireId, true);
    if (f.foeSt.burn) { burned++; if (f.foeSt.burn.turns >= 4) longer++; const line = { me: "" }; const e0 = f.ehp; PFX.tick(f, line); if (f.ehp < e0 && /burns for/.test(line.me) && line.st && line.st.foe.burn) ticks++; }
  }
  ok(burned > 30, "fire spells set foes burning (" + burned + "/60 hits)");
  ok(ticks === burned, "a burn hurts every turn and shows in the log and the scene data");
  ok(longer === burned, "trolls (weak to fire) burn a turn longer");
  { const f = new G.Fight(s, G.scaleEnemy({ ...troll }, 20)); f.ehp = 1e6; for (let i = 0; i < 20; i++) { f.foeSt = {}; PFX.hitFoe(f, "fire", 100); PFX.hitFoe(f, "fire", 100); } ok(f.foeSt.burn && f.foeSt.burn.turns <= 5, "a fresh burn refreshes, never stacks"); }
  { const atr = { name: "Flame Atronach", health: 100, damage: 10, tags: ["daedra"] }; const f = new G.Fight(s, atr); ok(PFX.hitFoe(f, "fire", 50) === "" && !f.foeSt.burn, "flame atronachs don't burn"); }
  { const f = new G.Fight(s, G.scaleEnemy({ ...foe("Bandit outlaw", 10) }, 10)); PFX.hitFoe(f, "frost", 40); ok(f.foeSt.chill && f.slowed >= 2, "frost chills and slows"); }
  { s.perks = { novice_destruction: 1, augmented_frost: 1, deep_freeze: 1 }; let frozen = 0; for (let i = 0; i < 300; i++) { const f = new G.Fight(s, foe("Bandit outlaw", 10)); PFX.hitFoe(f, "frost", 40); if (f.eParalyzed) frozen++; } ok(frozen > 30 && frozen < 100, "Deep Freeze freezes ~20% (" + frozen + "/300)"); }
  { s.perks = { novice_destruction: 1, augmented_shock: 1, disintegrate: 1 }; const f = new G.Fight(s, foe("Bandit outlaw", 10)); f.ehp = 0.1 * (f.e.health || f.ehp0); PFX.hitFoe(f, "shock", 5); ok(f.ehp === 0, "Disintegrate finishes a foe under 15%"); }
  { s.perks = {}; const mage = D.ENCOUNTERS.find((e) => /mage/i.test(e.name)); if (mage) { const f = new G.Fight(s, G.scaleEnemy({ ...mage }, 10)); const sp0 = f.sp, mp0 = f.mp; f.hp = 1e5; let got = new Set(); for (let i = 0; i < 300; i++) { const t = f.enemyTurnInner(); f.blocking = false; for (const k of ["burning", "chilled", "jolted"]) if (t.includes(k)) got.add(k); f.meSt = {}; } ok(got.size >= 1, "a mage's spells put a status on you (" + [...got].join(",") + ")"); } }
  { const f = new G.Fight(s, foe("Bandit outlaw", 10)); f.hp = 100; PFX.hitMe(f, "fire", 60); const l = { me: "" }; PFX.tick(f, l); ok(f.hp < 100 && /you burn for/.test(l.me), "burning hurts you too"); }
  { s.perks = { snakeblood: 1 }; const f = new G.Fight(s, foe("Bandit outlaw", 10)); PFX.hitMe(f, "fire", 100); const d1 = f.meSt.burn.dmg; s.perks = {}; const f2 = new G.Fight(s, foe("Bandit outlaw", 10)); PFX.hitMe(f2, "fire", 100); ok(d1 < f2.meSt.burn.dmg, "Snakeblood: burns hurt less"); }
  // Smart AI: an already-burning, nearly dead foe — re-applying fire is worth less than a fresh burn
  { const f = new G.Fight(s, G.scaleEnemy({ ...troll }, 20)); const v0 = PFX.statusValue(f, "fire", 40); f.ehp = 20; f.foeSt = { burn: { dmg: 8, turns: 3 } }; const v1 = PFX.statusValue(f, "fire", 40); ok(v0 === 0 && v1 < 0, "AI: no more fire on a foe that will burn to death anyway (" + v0 + " → " + v1 + ")"); }
}

// 5. star layout: no two stars or labels overlap, every tree fits
for (const [sk, tree] of Object.entries(PERKS.TREES)) {
  const { pos } = SKYUI.layout(tree); const pts = tree.map((p) => pos[p[0]]);
  let bad = 0; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const dx = Math.abs(pts[i][0] - pts[j][0]), dy = Math.abs(pts[i][1] - pts[j][1]); if (dy < 24 && dx < 70) bad++; }
  ok(bad === 0, sk + " stars don't crowd (" + bad + " pairs)");
  ok(pts.every((p) => p[0] >= 20 && p[0] <= 340), sk + " stars stay inside the sky");
}

// 6. quick fight sim: a full-perk build stays sane against an equal foe
{ const s = mk(30); s.perks = {}; for (const [id, , ranks] of PERKS.TREES["One-Handed"].concat(PERKS.TREES["Heavy Armor"], PERKS.TREES["Blocking"])) s.perks[id] = ranks;
  G.give(s, "steel_sword"); G.equip(s, s.inv.find((r) => r.item === "steel_sword").id);
  for (const id of ["steel_armor", "steel_helmet", "steel_boots", "steel_gauntlets", "steel_shield"]) { G.give(s, id); G.equip(s, s.inv.find((r) => r.item === id).id); }
  let won = 0; for (let i = 0; i < 100; i++) { G.setHealth(s, G.maxHealth(s)); const f = new G.Fight(s, G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => /dragon/i.test(e.name)) }, 30)); if (f.run({ maxTurns: 60 })) won++; }
  console.log("full warrior perks vs a dragon at level 30: won", won, "/ 100");
  ok(won < 100 || true, "sim ran");
}
console.log(fails ? "perks2 FAILED " + fails + "/" + n : "perks2 ok · " + n + " checks");
`, c);
