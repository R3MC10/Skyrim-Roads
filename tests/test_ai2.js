/* Sneak openers, AI settings, hybrid, richer tactics, decide() (sneak2.js + aiset.js).
   W=/path/to/web/ node test_ai2.js  — prints "ai2 ok · N checks" */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, Buffer, escape, unescape, encodeURIComponent, decodeURIComponent };
vm.createContext(c);
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "combatai.js", "sneak2.js", "aiset.js"];
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const { G, D, F, AISET, SNEAK2, COMBATAI, WORLD } = c;
let n = 0, bad = 0;
const ok = (cond, msg) => { n++; if (!cond) { bad++; console.log("FAIL", msg); } };
const mk = (lv = 20, skills = {}) => { const s = G.newSave("ai", "Ai" + Math.random(), "nord"); s._test = true; s.level = lv; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; for (const [k, v] of Object.entries(skills)) s.skills[k].lvl = v; G.setHealth(s, G.maxHealth(s)); return s; };
const enc = (name) => D.ENCOUNTERS.find((e) => e.name === name);
const foe = (name, lv) => G.scaleEnemy({ ...(enc(name) || D.ENCOUNTERS.find((e) => e.kind !== "event" && e.health)) }, lv);
const wear = (s, items) => { for (const it of items) { const r = G.give(s, it); G.equip(s, r?.id ?? s.inv.find((x) => x.item === it).id); } };
const L = (s) => G.loadout(s);
const NOON = (() => { const t0 = G.now(); for (let h = 0; h < 48; h++) { const t = t0 + h * 300; if (!G.isNight(t)) return t; } return t0; })();
const NIGHT = (() => { const t0 = G.now(); for (let h = 0; h < 48; h++) { const t = t0 + h * 300; if (G.isNight(t)) return t; } return t0; })();
const medFoe = D.ENCOUNTERS.find((e) => e.kind !== "event" && e.health && e.danger === "medium" && (e.tags || []).includes("humanoid"));

// ---------- 1. who stays hidden
{
  const tank = mk(20, { Sneak: 15 }); wear(tank, ["steel_armor", "steel_helmet", "steel_gauntlets", "steel_boots"]);
  const thief = mk(20, { Sneak: 80 }); wear(thief, ["leather_armor", "leather_boots"]);
  const e = foe(medFoe.name, 20);
  const cTank = SNEAK2.chance(tank, e, NOON), cThief = SNEAK2.chance(thief, e, NIGHT);
  ok(cTank < 0.12, `heavy armor, Sneak 15, daylight: hard to stay hidden (${(cTank * 100).toFixed(0)}%)`);
  ok(cThief > 0.5, `light armor, Sneak 80, night: good chance (${(cThief * 100).toFixed(0)}%)`);
  const dragon = D.ENCOUNTERS.find((x) => (x.tags || []).includes("dragon"));
  if (dragon) ok(SNEAK2.chance(thief, G.scaleEnemy({ ...dragon }, 20), NIGHT) <= 0.05, "dragons see you");
  const und = D.ENCOUNTERS.find((x) => (x.tags || []).includes("undead") && x.danger !== "high");
  if (und) ok(SNEAK2.chance(thief, G.scaleEnemy({ ...und }, 20), NIGHT) < SNEAK2.chance(thief, { ...e, tags: [] }, NIGHT), "the undead sense the living");
  thief.perks = { stealth: 1, muffled_movement: 1 }; tank.perks = { stealth: 1, muffled_movement: 1 };
  ok(SNEAK2.heavyPieces(tank) === 4 && SNEAK2.chance(tank, e, NOON) > cTank, "Muffled Movement silences heavy armor");
  ok(G.hiddenChance(thief, e, NIGHT) === SNEAK2.chance(thief, e, NIGHT), "engine's hiddenChance uses the new rule (sneak past too)");
}
// ---------- 2. when you try, and what failing costs
{
  const s = mk(20, { Sneak: 15 }); wear(s, ["steel_armor", "steel_helmet"]); const e0 = foe(medFoe.name, 20);
  let tried = 0, hid = 0;
  for (let i = 0; i < 200; i++) { const f = new G.Fight(s, { ...e0 }); f.run({ t: NOON }); if (f.sneakTry?.tried) tried++; if (f.hidden) hid++; }
  ok(tried === 0 && hid === 0, `"When safe" with a poor chance: never tries (${tried})`);
  AISET.get(L(s)).sneak = "always"; let spotted = 0, firstHit = 0;
  for (let i = 0; i < 200; i++) { const f = new G.Fight(s, { ...e0 }); f.run({ t: NOON }); if (f.sneakTry?.spotted) { spotted++; if (f.log[0].turn === 0 && /Spotted/.test(f.log[0].me)) firstHit++; } }
  ok(spotted > 150 && firstHit === spotted, `"Always try" with a poor chance: spotted ${spotted}/200 and the foe strikes first`);
  s.perks = { stealth: 1, muffled_movement: 1, ambusher: 1 };
  let sp2 = 0; for (let i = 0; i < 100; i++) { const f = new G.Fight(s, { ...e0 }); f.run({ t: NOON }); if (f.sneakTry?.spotted) sp2++; }
  ok(sp2 === 0, "Ambusher: being seen doesn't hand the foe a free strike");
  AISET.get(L(s)).sneak = "never"; let t3 = 0; for (let i = 0; i < 50; i++) { const f = new G.Fight(s, { ...e0 }); f.run({ t: NOON }); if (f.hidden || f.sneakTry?.tried) t3++; }
  ok(t3 === 0, '"Never": no sneak openers');
  const th = mk(20, { Sneak: 90 }); wear(th, ["leather_armor"]); AISET.get(L(th)).sneak = "safe";
  let pt = 0; for (let i = 0; i < 50; i++) { const f = new G.Fight(th, { ...e0 }); f.allies.push({ name: "Friend", dmg: 5, hp: 100, coop: true }); f.run({ t: NIGHT }); if (f.sneakTry?.tried) pt++; }
  ok(pt === 0, "in a party nobody sneaks unless the setting is Always try");
}
// ---------- 3. a sneak blow can't one-shot
{
  const s = mk(40, { Sneak: 100, "One-Handed": 100 }); s.perks = { stealth: 5, backstab: 1, assassins_blade: 1 };
  const d = D.ITEMS.daedric_dagger ? "daedric_dagger" : Object.keys(D.ITEMS).find((k) => D.ITEMS[k].wtype === "dagger" || /dagger/.test(k));
  wear(s, [d]);
  const med = { ...foe(medFoe.name, 40) }, max = med.health;
  let worst = 0; for (let i = 0; i < 60; i++) { const f = new G.Fight(s, { ...med }); f.hidden = true; f.turn = 1; f.attack(false); worst = Math.max(worst, max - f.ehp); }
  ok(worst <= max * 0.5 + 1e-6, `sneak hit on a medium foe ≤ 50% of its health (${Math.round(worst)}/${max})`);
  const boss = { ...med, boss: true }; let wb = 0; for (let i = 0; i < 60; i++) { const f = new G.Fight(s, { ...boss }); f.hidden = true; f.turn = 1; f.attack(false); wb = Math.max(wb, max - f.ehp); }
  ok(wb <= max * 0.35 + 1e-6, `a boss loses at most 35% to a sneak hit (${Math.round(wb)}/${max})`);
  const weak = { ...foe(medFoe.name, 1), danger: "low", health: 30, hp: 30 }; let kill = 0;
  for (let i = 0; i < 20; i++) { const f = new G.Fight(s, { ...weak }); f.hidden = true; f.turn = 1; f.attack(false); if (f.ehp <= 0) kill++; }
  ok(kill >= 18, "a weak foe still drops to one quiet blow");
  s.perks.ambusher = 1; s.perks.muffled_movement = 1; ok(Math.abs(SNEAK2.capFrac(new G.Fight(s, { ...med })) - 0.7) < 1e-9, "Ambusher raises the cap to 70%");
}
// ---------- 4. settings honoured
function caster(lv = 20) {
  const s = mk(lv, { Destruction: 60, Restoration: 60, Alteration: 60, Illusion: 60, Conjuration: 60, "One-Handed": 40, Blocking: 40 });
  s.spells = Object.keys(D.SPELLS).filter((id) => { const sp = D.SPELLS[id]; return sp.kind !== "utility" && (typeof c.MAGIC === "undefined" || c.MAGIC.failChance(s, id) === 0); });
  wear(s, ["steel_sword", "iron_shield"]); G.give(s, "potion_health", 5); return s;
}
{
  const s = caster(); AISET.get(L(s)).schools.Destruction = false;
  let dest = 0; for (let i = 0; i < 25; i++) { const f = new G.Fight(s, foe(medFoe.name, 20)); f.run({}); for (const l of f.log) if (/^(spell|dual):/.test(l.a || "") && D.SPELLS[l.a.split(":")[1]]?.school === "Destruction") dest++; }
  ok(dest === 0, `school switched off: no Destruction spells (${dest})`);
  const s2 = caster(); const fav = s2.spells.find((id) => D.SPELLS[id].kind === "damage"); AISET.get(L(s2)).off = s2.spells.filter((id) => D.SPELLS[id].kind === "damage");
  let dmgCasts = 0; for (let i = 0; i < 25; i++) { const f = new G.Fight(s2, foe(medFoe.name, 20)); f.run({}); for (const l of f.log) if (/^(spell|dual):/.test(l.a || "") && D.SPELLS[l.a.split(":")[1]]?.kind === "damage") dmgCasts++; }
  ok(fav && dmgCasts === 0, "spells switched off are never cast");
  const s3 = caster(); AISET.get(L(s3)).potions = "never"; let pots = 0;
  for (let i = 0; i < 25; i++) { const e = foe(medFoe.name, 20); e.damage *= 3; const f = new G.Fight(s3, e); f.run({}); pots += Object.values(f.used).reduce((a, b) => a + b, 0); }
  ok(pots === 0, "potions: never");
  const s4 = caster(); s4._test = true; AISET.get(L(s4)).shouts = "no"; let sh = 0;
  for (let i = 0; i < 15; i++) { const f = new G.Fight(s4, foe(medFoe.name, 20)); f.run({}); for (const l of f.log) if (/^(shout|power):/.test(l.a || "")) sh++; }
  ok(sh === 0, "shouts & powers: never");
  // Careful heals more and earlier than Aggressive
  const heals = (style) => { const s = caster(); AISET.get(L(s)).style = style; let h = 0, turns = 0;
    for (let i = 0; i < 40; i++) { const e = foe(medFoe.name, 20); e.damage *= 2.2; e.health *= 1.6; e.hp = e.health; const f = new G.Fight(s, e); f.run({}); turns += f.turn; for (const l of f.log) if (l.a === "potion:health" || /^(spell|dual):/.test(l.a || "") && ["heal", "regen"].includes(D.SPELLS[l.a.split(":")[1]]?.kind)) h++; }
    return h / turns; };
  const hc = heals("careful"), ha = heals("aggressive");
  ok(hc > ha, `Careful heals more often than Aggressive (${(hc * 100).toFixed(1)}% vs ${(ha * 100).toFixed(1)}% of turns)`);
  // preferred attacks: magic-heavy vs melee-heavy
  const share = (prefer) => { const s = caster(); const st = AISET.get(L(s)); st.prefer = prefer; st.w = { ...AISET.PREFER[prefer] }; let mag = 0, mel = 0;
    for (let i = 0; i < 25; i++) { const f = new G.Fight(s, foe(medFoe.name, 20)); f.run({}); for (const l of f.log) { const k = AISET.classOf(f, l.a || ""); if (k === "magic") mag++; if (k === "melee") mel++; } } return mag / Math.max(1, mag + mel); };
  const pm = share("magic"), pl = share("melee");
  ok(pm > pl + 0.2, `preferring magic casts more than preferring melee (${(pm * 100).toFixed(0)}% vs ${(pl * 100).toFixed(0)}%)`);
}
// ---------- 5. Spread practice: easy fights grow many skills, dangerous ones don't
{
  const run = (train) => { const s = caster(30); AISET.get(L(s)).train = train; const xp = {};
    for (let i = 0; i < 20; i++) { const e = foe("Bandit outlaw", 1); e.health = 140; e.hp = 140; e.damage = 3; const f = new G.Fight(s, e); f.run({}); for (const [k, v] of Object.entries(f.xp)) xp[k] = (xp[k] || 0) + v; }
    return xp; };
  const on = run(true), off = run(false);
  const grown = (xp) => Object.entries(xp).filter(([k, v]) => v > 0 && k !== "Heavy Armor" && k !== "Light Armor" && k !== "Sneak").length;
  ok(grown(on) >= 4, `Spread practice trains ${grown(on)} skills in easy fights (${Object.keys(on).join(", ")})`);
  ok(grown(on) > grown(off), `…more than without it (${grown(off)})`);
  const s = caster(30); AISET.get(L(s)).train = true; const e = foe(medFoe.name, 30); e.damage *= 4; e.boss = true; const f = new G.Fight(s, e); f.run({});
  ok(!f.aiTrain, "never practises in a dangerous fight");
  ok(AISET.trainable(s).length >= 4, "the settings card lists the skills it can train: " + AISET.trainable(s).join(", "));
}
// ---------- 6. tactics: AND / OR / NOT and the new conditions
{
  const s = mk(20); const f = new G.Fight(s, foe(medFoe.name, 20)); f.turn = 2; f.hp = G.maxHealth(s) * 0.3; f.ehp = f.e.health * 0.9;
  const r = (conds, join) => ({ if: conds[0].if, conds, join, do: "attack" });
  ok(f.cond(r([{ if: "hp_below", pct: 40 }, { if: "enemy_hp_above", pct: 50 }], "and")) === true, "AND: both true");
  ok(f.cond(r([{ if: "hp_below", pct: 40 }, { if: "enemy_hp_below", pct: 50 }], "and")) === false, "AND: one false");
  ok(f.cond(r([{ if: "hp_above", pct: 90 }, { if: "enemy_hp_above", pct: 50 }], "or")) === true, "OR: one true");
  ok(f.cond(r([{ if: "hp_below", pct: 40, not: true }], "and")) === false, "NOT flips");
  ok(f.cond({ if: "turn_at_most", pct: 3 }) === true && f.cond({ if: "turn_at_most", pct: 1 }) === false, "turn is at most");
  f.stagger = true; ok(f.cond({ if: "enemy_staggered" }) === true, "enemy staggered");
  f.meSt = { burn: { dmg: 3, turns: 2 } }; ok(f.cond({ if: "me_burning" }) === true, "I'm burning");
  for (const id of Object.keys(AISET.NEWCOND)) { let thrown = false; try { f.cond({ if: id, pct: 50 }); } catch { thrown = true; } ok(!thrown && D.CONDITIONS[id], "condition works: " + id); }
  const rule = AISET.makeRule({ if: "hp_below", pct: 40 }, [{ if: "enemy_caster", not: true }], "and");
  ok(rule.if === "hp_below" && rule.pct === 40 && rule.conds.length === 2 && rule.conds[1].not, "editor rule keeps r.if for older code");
  ok(AISET.describe({ ...rule, do: "block" }).cond.includes("AND NOT"), "described: " + AISET.describe({ ...rule, do: "block" }).cond);
  // custom rules use them in a real fight
  const s2 = mk(20); L(s2).mode = "custom"; L(s2).rules = [{ if: "first_turn", conds: [{ if: "first_turn" }, { if: "enemy_humanoid" }], join: "and", do: "block" }, { if: "always", do: "attack" }];
  const f2 = new G.Fight(s2, foe(medFoe.name, 20)); f2.run({}); ok(f2.log.find((l) => l.turn === 1).a === "block" && f2.log.find((l) => l.turn === 2)?.a !== "block", "AND rule fires on turn 1 only");
}
// ---------- 7. presets, hybrid (share codes went with the AI & Loadouts tab)
{
  const s = caster(); for (const id of Object.keys(AISET.PRESETS)) {
    const Lx = { rules: [], equipment: {}, mode: "smart" }; AISET.applyPreset(s, Lx, id);
    const okRules = Lx.rules.length >= 2 && Lx.rules.every((r) => D.CONDITIONS[r.if] && typeof r.do === "string") && Lx.rules[Lx.rules.length - 1].do === "attack";
    ok(okRules, "preset builds valid rules: " + id);
    if (id === "trainer") ok(Lx.mode === "hybrid" && AISET.get(Lx).train, "Skill trainer = Hybrid + Spread practice");
  }
  // hybrid: rule first, AI after
  const h = mk(20); L(h).mode = "hybrid"; L(h).rules = [{ if: "first_turn", do: "block" }, { if: "always", do: "attack" }];
  const f = new G.Fight(h, foe(medFoe.name, 20)); f.run({});
  ok(f.ai && f.log.find((l) => l.turn === 1).a === "block" && f.log.find((l) => l.turn === 1).rule === 1, "Hybrid: your rule fires first (logged as rule 1)");
  ok(f.log.filter((l) => l.turn > 1).every((l) => l.rule === 0), "…then Smart AI (the always→attack filler doesn't block it)");
}
// ---------- 8. decide(): one turn at a time, no dice
{
  const s = caster(); const f = new G.Fight(s, foe(medFoe.name, 20)); f.turn = 1;
  const d1 = COMBATAI.decide(f), d2 = COMBATAI.decide(f);
  ok(d1.action === d2.action && typeof d1.action === "string", "decide(): same state → same move (" + d1.action + ")");
  const noDest = COMBATAI.decide(f, "player", { ...AISET.get(L(s)), schools: { Destruction: false } });
  ok(!/^(spell|dual):/.test(noDest.action) || D.SPELLS[noDest.action.split(":")[1]].school !== "Destruction", "decide() with settings passed in honours them");
  const cu = mk(20); L(cu).mode = "custom"; L(cu).rules = [{ if: "first_turn", do: "power_attack" }, { if: "always", do: "attack" }];
  const fc = new G.Fight(cu, foe(medFoe.name, 20)); fc.turn = 1; const dc = COMBATAI.decide(fc);
  ok(dc.action === "power_attack" && dc.rule === 1, "decide() for Custom tactics returns the firing rule");
  f.hp = G.maxHealth(s) * 0.2; ok(COMBATAI.decide(f, { name: "Lydia", dmg: 10, hp: 200, max: 200 }).action === "cover", "decide() for a follower: covers a hurt hero");
  ok(COMBATAI.settingsOf(L(s)) === L(s).ai, "settings live on the loadout as one object");
}
// ---------- 9. flee rules on the road, target order (the preview went with the AI & Loadouts tab)
{
  const s = mk(20, { Athletics: 100 }); L(s).mode = "custom"; L(s).rules = [{ if: "always", do: "flee" }];
  s.trip = { status: "encounter", encounter: foe(medFoe.name, 20), path: [[s.x, s.y], [s.x + 10, s.y]], from: "Whiterun", to: "Riverwood", start: G.now(), lastTick: G.now(), log: [] };
  let fled = false; for (let i = 0; i < 6 && !fled; i++) { s.trip.status = "encounter"; s.trip.encounter = foe(medFoe.name, 20); G.setHealth(s, G.maxHealth(s)); const r = G.encounterAction(s, "fight"); if (r.fled) fled = true; }
  ok(fled, "a flee rule breaks off a road fight and the trip goes on");
  const f = new G.Fight(mk(20), foe(medFoe.name, 20)); ok(!f.affordable("flee"), "…but not where there's nowhere to run");
  const foes = [{ name: "Bandit", health: 50, hp: 50, damage: 5 }, { name: "Bandit mage", health: 60, hp: 60, damage: 9, tags: ["mage"] }, { name: "Bandit chief", health: 200, hp: 200, damage: 20 }];
  const Lt = { ai: { target: "casters" } }; ok(AISET.pickTarget(Lt, foes)[0].name === "Bandit mage", "target: casters first");
  Lt.ai.target = "strongest"; ok(AISET.pickTarget(Lt, foes)[0].name === "Bandit chief", "target: strongest first");
  Lt.ai.target = "weakest"; ok(AISET.pickTarget(Lt, foes)[0].name === "Bandit", "target: weakest first");
}
// ---------- 10. arena snapshot carries the mode and settings
{
  const s = caster(); L(s).mode = "hybrid"; AISET.get(L(s)).style = "aggressive";
  const snap = c.ARENA.snapshot(s); ok(snap.loadouts.Arena.mode === "hybrid" && snap.loadouts.Arena.ai.style === "aggressive", "arena snapshot keeps Hybrid and the AI settings");
}
console.log(bad ? `ai2 FAILED ${bad}/${n}` : `ai2 ok · ${n} checks`);
process.exit(bad ? 1 : 0);
