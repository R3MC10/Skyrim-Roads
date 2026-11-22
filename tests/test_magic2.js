const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Big spellbook (spellbook.js): every spell castable, tomes in every town's shops, skill gating, restock, master rituals,
   support spells on allies + Smart AI targeting, perks. W=/path/to/web/ node test_magic2.js — prints "magic2 ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { setTimeout: () => 0, clearTimeout: () => {}, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
const html = fs.readFileSync(W + "index.html", "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
const SKIP = /ui\.js|p2pnet|polish|app\.js|art\.js|art[a-z]*\.js|hud\.js|skyui|immerse|motion|tabmenu|favwheel|patchnotes|guide|fight/;
for (const f of scripts) {
  if (SKIP.test(f) && !/^(spellbook|spellcraft)\.js$/.test(f)) continue;
  if (!fs.existsSync(W + f)) continue;
  try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f }); } catch (e) { /* browser-only module */ }
}
vm.runInContext(`
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };
function mage(sk = 100) { const s = G.newSave("M" + Math.random(), "Mage", "breton"); s._test = true; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.level = 30; s.mpBonus = 600;
  for (const k of ["Destruction", "Restoration", "Alteration", "Conjuration", "Illusion", "Mysticism"]) s.skills[k].lvl = sk; s.spells = Object.keys(D.SPELLS).filter((k) => !D.SPELLS[k].custom); for (const L of Object.values(s.loadouts || {})) if (L) L.mode = "custom"; G.setHealth(s, G.maxHealth(s)); return s; }
const foe = (o = {}) => ({ name: "Bandit", danger: "medium", level: 5, tags: ["humanoid"], health: 220, damage: 8, gold: [5, 10], hp: 220, ...o });
const fight = (s, e, rules) => { const f = new G.Fight(s, e, rules); f.run({ trySneak: false }); return f; };
const rule = (d, cond = "first_turn") => [{ if: cond, do: d }, { if: "always", do: "attack" }];

// 1. counts per school/tier
const cnt = SPELLBOOK.counts(); console.log("spells by school/tier", JSON.stringify(cnt), "total", Object.values(cnt).reduce((a, o) => a + Object.values(o).reduce((x, y) => x + y, 0), 0));
for (const sc of ["Destruction", "Restoration", "Alteration", "Conjuration", "Illusion", "Mysticism"]) for (const t of SPELLBOOK.TIERS) ok((cnt[sc] || {})[t] > 0, sc + " has " + t + " spells");
ok(Object.keys(D.SPELLS).length >= 120, "a big spellbook (" + Object.keys(D.SPELLS).length + ")");
for (const id of ["healing_hands", "heal_other", "magelight", "telekinesis", "equilibrium", "waterbreathing", "flaming_familiar", "seeker", "banish_daedra", "command_daedra", "rally", "frenzy", "call_to_arms", "mayhem", "detect_dead", "vampires_bane", "circle_of_protection", "bane_of_the_undead"]) ok(D.SPELLS[id], "has " + id);
ok(D.SPELLS.flames.amount === 8 && D.SPELLS.flames.cost === 14, "old spells untouched");

// 2. every spell castable in a fight (single and dual) without errors
for (const id of Object.keys(D.SPELLS)) {
  const sp = D.SPELLS[id]; if (sp.custom) continue;
  for (const act of ["spell:" + id, ...(MAGIC.dualable(sp) ? ["dual:" + id] : [])]) {
    let f; try { const s = mage(); f = fight(s, foe({ tags: ["humanoid"] }), rule(act)); } catch (e) { ok(false, act + " threw " + e.message); continue; }
    ok(f.log.every((l) => !/NaN|undefined/.test(String(l.me) + String(l.them))), act + ": " + f.log[0]?.me);
    ok(Number.isFinite(f.hp) && Number.isFinite(f.ehp) && Number.isFinite(f.mp), act + " numbers stay finite");
  }
}
// with allies too
G.setAllyProvider(() => [{ name: "Lydia", dmg: 8, hp: 40, follower: true, kind: "follower" }, { name: "Bjorn", dmg: 12, hp: 90, maxHp: 120, player: true, coop: true, role: "fighter", red: 0 }]);
for (const id of Object.keys(D.SPELLS).filter((k) => SPELLBOOK.SUPPORT.has(D.SPELLS[k].kind))) {
  const s = mage(); let f; try { f = fight(s, foe({ health: 600, hp: 600, damage: 14 }), rule("spell:" + id)); } catch (e) { ok(false, id + " threw " + e.message); continue; }
  ok(f.log.every((l) => !/NaN|undefined/.test(String(l.me) + String(l.them))), id + " with allies: " + f.log[0].me);
  ok(/→|no one is down/.test(f.log[0].me), id + " targets an ally: " + f.log[0].me);
}

// 3. support: targeting, effects
{ const s = mage(); const f = new G.Fight(s, foe()); f.allies[0].hp = 10; const t = f.cast("heal_other", true); ok(/→ Lydia/.test(t) && f.allies[0].hp > 10, "heal targets the most hurt: " + t); }
{ const s = mage(); const f = new G.Fight(s, foe()); const t = f.cast("heroism", true); ok(/→ Bjorn/.test(t) && f.allies[1].dmg > 12, "heroism on the strongest: " + t); }
{ const s = mage(); const f = new G.Fight(s, foe()); f.cast("shelter", true); const al = f.allies.find((a) => a.ward > 0); const d = SPELLBOOK.allyTakes(f, al, 30); ok(d < 30, "ward soaks a blow on an ally (" + d + ")"); }
{ const s = mage(); const f = new G.Fight(s, foe()); f.cast("stoneskin_touch", true); const al = f.allies.find((a) => a.armorRed > 0); ok(al && SPELLBOOK.allyTakes(f, al, 40) <= 30.01, "stoneskin on an ally"); }
{ const s = mage(); const f = new G.Fight(s, foe()); f.cast("flame_blade", true); const before = f.ehp, line = { me: "", them: "" }; MAGIC.tick(f, line); ok(f.ehp < before && /flaming blade/.test(line.me), "imbued ally strikes: " + line.me); }
{ const s = mage(); const f = new G.Fight(s, foe()); f.cast("veil_other", true); const al = f.allies.find((a) => a.unseen > 0); ok(al && SPELLBOOK.allyTakes(f, al, 50) === 0, "veiled ally can't be hit"); }
{ const s = mage(); const f = new G.Fight(s, foe()); const al = f.allies[0]; SPELLBOOK.allyTakes(f, al, 999); al.hp -= 999; f.allies = f.allies.filter((a) => a !== al); ok(f.condTrue ? true : true, ""); const t = f.cast("rescue", true); ok(/pulled back/.test(t) && f.allies.includes(al) && al.hp > 0, "rescue revives a downed ally: " + t); }
{ const s = mage(); s.perks = { ...(s.perks || {}), regeneration: 1, spell_absorption: 1, spirit_link: 1 }; const f = new G.Fight(s, foe()); const hp0 = f.hp; const d = SPELLBOOK.allyTakes(f, f.allies[1], 40); ok(d < 40 && f.hp < hp0, "Spirit Link shares damage"); }
{ const s = mage(); s.perks = { regeneration: 1, selfless_healer: 1 }; const f = new G.Fight(s, foe()); f.allies[1].hp = 20; const t = f.cast("healing_hands", true); const m = +(/\\+(\\d+)/.exec(t) || [])[1]; ok(m >= 44, "Benefactor: heal on others +50% (" + t + ")"); }
// custom tactics conditions
{ const s = mage(); const f = new G.Fight(s, foe()); f.allies[0].hp = 5; ok(SPELLBOOK.condAlly(f, { if: "ally_hp_below", pct: 50 }) && D.CONDITIONS.ally_hp_below, "condition: ally below %"); }

// 4. Smart AI picks support spells sensibly
{ let healed = 0, attacked = 0; for (let i = 0; i < 20; i++) { const s = mage(); s.spells = ["heal_other", "firebolt"]; s.loadout = s.loadout; const f = new G.Fight(s, foe({ health: 600, hp: 600 }), []); f.ai = true; f.allies[0].hp = 6; const a = COMBATAI.choose ? COMBATAI.choose(f) : null; const act = a && (a.act || a.a || a); if (/heal_other/.test(JSON.stringify(act))) healed++; else attacked++; }
  ok(healed >= 15, "AI heals a nearly-dead ally (" + healed + "/20)"); }
{ let n2 = 0; for (let i = 0; i < 20; i++) { const s = mage(); s.spells = ["heal_other", "firebolt"]; const f = new G.Fight(s, foe({ health: 600, hp: 600 }), []); f.ai = true; const a = COMBATAI.choose(f); if (/heal_other/.test(JSON.stringify(a))) n2++; } ok(n2 <= 2, "AI doesn't heal healthy allies (" + n2 + "/20)"); }
{ let n3 = 0; for (let i = 0; i < 10; i++) { const s = mage(); s.spells = ["heroism"]; const f = new G.Fight(s, foe({ health: 900, hp: 900, damage: 6 }), []); f.ai = true; if (/heroism/.test(JSON.stringify(COMBATAI.choose(f)))) n3++; } ok(n3 >= 8, "AI inspires the strongest ally in a long fight (" + n3 + "/10)"); }
G.setAllyProvider(() => []);
{ const s = mage(); s.spells = ["heal_other", "flame_blade", "firebolt"]; const f = new G.Fight(s, foe(), []); f.ai = true; ok(!/heal_other|flame_blade/.test(JSON.stringify(COMBATAI.choose(f))), "no allies: AI never wastes a support spell"); }

// 5. merchants: novice tomes in every town with a store, gating by skill, restock every 2 in-game days
const novice = (l) => l.filter((i) => D.ITEMS[i]?.slot === "tome" && (D.SPELLS[D.ITEMS[i].spell].level || "Novice") === "Novice");
const towns = Object.entries(D.SHOPS).filter(([, k]) => k.includes("general") || k.includes("wizard")).map(([t]) => t);
const low = mage(5);
for (const t of towns) { const all = D.SHOPS[t].flatMap((sh) => TOMES.stockAt(t, sh, low)); ok(novice(all).length >= 3, t + " sells Novice tomes (" + novice(all).length + ")"); }
{ const t0 = 1e6, a = TOMES.stockAt("Ivarstead", "general", low, t0), b = TOMES.stockAt("Ivarstead", "general", low, t0 + 3 * 7200); ok(JSON.stringify(a) !== JSON.stringify(b), "stock rotates after 2 in-game days"); ok(JSON.stringify(a) === JSON.stringify(TOMES.stockAt("Ivarstead", "general", low, t0 + 600)), "stock steady within the period"); ok(SPELLBOOK.nextRestock(t0) <= 14400 && SPELLBOOK.nextRestock(t0) > 0, "restock timer"); }
{ const lvOf = (i) => D.SPELLS[D.ITEMS[i].spell].level; const has = (s, lv) => TOMES.stockAt("Whiterun", "wizard", s).some((i) => D.ITEMS[i]?.slot === "tome" && lvOf(i) === lv);
  const s = mage(10); ok(has(s, "Novice") && !has(s, "Apprentice") && !has(s, "Adept"), "skill 10: novice only");
  const s2 = mage(30); ok(has(s2, "Apprentice") && !has(s2, "Adept"), "skill 30: apprentice appears");
  const s3 = mage(60); ok(has(s3, "Adept") && !has(s3, "Expert"), "skill 60: adept at a court wizard, no expert");
  const s4 = mage(80); s4.location = "Winterhold"; ok(TOMES.stockAt("Winterhold", "wizard", s4).some((i) => D.ITEMS[i]?.slot === "tome" && lvOf(i) === "Expert"), "skill 80: expert at the College");
  ok(!TOMES.stockAt("Winterhold", "wizard", mage(100)).some((i) => D.ITEMS[i]?.slot === "tome" && lvOf(i) === "Master"), "master tomes not on the shelf before the ritual"); }
{ const s = mage(10); s.gold = 99999; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; let t = G.now(); while (!G.shopsOpen(t)) t += 600;
  ok(/appear in shops once/.test(G.buy(s, "tome_fireball", 1, t)), "can't buy above your skill: " + G.buy(s, "tome_fireball", 1, t));
  const nov = novice(TOMES.stockAt("Whiterun", "wizard", s, t))[0]; ok(/Bought/.test(G.buy(s, nov, 1, t)), "buys a novice tome"); }
ok(SPELLBOOK.COURT.Riften && D.SHOPS.Riften.includes("wizard") && D.SHOPS.Dawnstar.includes("wizard"), "Wylandriah and Madena sell spells");
// dungeon drops
ok(D.LOOT.humanoid.some(([i]) => D.ITEMS[i]?.slot === "tome") && D.LOOT.elite.some(([i]) => D.ITEMS[i]?.slot === "tome" && D.SPELLS[D.ITEMS[i].spell].level === "Apprentice"), "tomes drop in dungeons");

// 6. master ritual
{ const s = mage(95); s._test = "ritual"; s.location = "Winterhold"; s.spells = ["firebolt"];
  ok(SPELLBOOK.ritualState(s, "Destruction") === "offered", "ritual offered at 90+");
  ok(/Prove your mastery/.test(SPELLBOOK.startRitual(s, "Destruction")), "ritual starts");
  const f = fight(s, foe({ level: 20, health: 2000, hp: 2000, damage: 3 }), [{ if: "always", do: "spell:firebolt" }]);
  const msgs = SPELLBOOK.ritualAfter({ ...f, s, won: true, endWon: null, e: { level: 20 }, log: f.log });
  ok(s.rituals.Destruction === "done" && msgs.some((m) => /Master of Destruction/.test(m)), "ritual passes: " + msgs.join("|"));
  ok(TOMES.stockAt("Winterhold", "wizard", s).some((i) => D.ITEMS[i]?.slot === "tome" && D.SPELLS[D.ITEMS[i].spell].level === "Master" && D.SPELLS[D.ITEMS[i].spell].school === "Destruction"), "master tomes on sale after the ritual"); }

// 7. new fight effects
{ const s = mage(); const f = fight(s, foe({ name: "Dremora", level: 10, tags: ["humanoid"] }), rule("spell:banish_daedra")); ok(/Oblivion/.test(f.log[0].me) && f.won, "banish ends a daedra fight"); }
{ const s = mage(); const f = new G.Fight(s, foe()); f.hp = 200; f.mp = 0; const t = f.cast("equilibrium", true); ok(f.mp > 0 && /magicka/.test(t), "equilibrium"); }
{ const s = mage(); const f = new G.Fight(s, foe({ name: "Necromancer" })); f.mp = 10; const e0 = f.ehp; f.cast("absorb_magicka", true); ok(f.ehp < e0 && f.mp > 10, "absorb magicka"); }
{ const s = mage(); s.spells = ["magelight", "telekinesis", "featherweight", "waterbreathing", "detect_dead", "divine_intervention"]; for (const id of s.spells) { const r = MAGIC.castOut(s, id); ok(!/fizzle|You don't|needs/.test(r) && r.length > 10, "out of fights: " + id + " → " + r); }
  ok(["Whiterun", "Solitude", "Windhelm", "Riften", "Markarth"].includes(s.location), "divine intervention lands in a city"); }

// 8. perks for the new spells, including each school's Support branch
const sup = { Destruction: ["kindle_ally", "searing_aegis"], Restoration: ["selfless_healer", "ward_bearer"], Alteration: ["shieldbearer"], Conjuration: ["summoners_bond", "bound_brothers"], Illusion: ["inspiring_presence"], Mysticism: ["spirit_link", "soul_tether"] };
for (const [sk, ids] of Object.entries(sup)) for (const id of ids) ok(PERKS.BY_ID[id] && PERKS.BY_ID[id].skill === sk && PFX.FX[id], sk + " support perk " + id);
for (const id of ["storm_walls", "guardians_light", "stone_within", "oblivion_binding", "voice_of_command", "magicka_siphon"]) ok(PERKS.BY_ID[id], "perk " + id);
for (const [id, p] of Object.entries(PERKS.BY_ID)) for (const nd of p.needs || []) ok(PERKS.BY_ID[nd], id + " needs a real perk " + nd);
console.log(fails ? "FAILED " + fails + " of " + n : "magic2 ok · " + n + " checks");
`, c);
