/* Turn-based fights (tbfight.js). W=/path/to/web/ node test_tbfight.js [runs]  — prints a balance table and ALL OK.
   Initiative order, AP costs, every action type, statuses, followers/summons on their own turns, Auto win rates,
   fight lengths, no one-shots, the pause/replay wrapper, and party turns with a second simulated phone. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const RUNS = +(process.env.RUNS || process.argv[2] || 40);
const TUNE = process.env.TUNE ? JSON.parse(process.env.TUNE) : null;
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "tbfight.js"])
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


{ const TUNE = process.env.TUNE ? JSON.parse(process.env.TUNE) : null; if (TUNE) { Object.assign(TB.T.hp, TUNE.hp || {}); Object.assign(TB.T.acts, TUNE.acts || {}); } }
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };
const fresh = (b, L) => { const s = make(b, L); s.health = G.maxHealth(s); s.healthTs = G.now(); return s; };
const enc = (name, L) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, L);
const boss = (key, L) => { const e = G.scaleEnemy({ ...DUNGEONS.ENEMY[key] }, L); e.health = Math.round(e.health * 0.8); e.hp = e.health; e.damage = Math.round(e.damage * 0.8 * 10) / 10; e.boss = true; return e; };
if (!process.env.SIMONLY) {
// 1. stats grow with skills; heavy armour slows initiative
{ const s = fresh("warrior", 5), s2 = fresh("warrior", 5); s2.skills.Athletics.lvl = 100; s2.spBonus += 300; s2.skills.Acrobatics.lvl = 100; s2.skills.Sneak.lvl = 100;
  const f = new G.Fight(s, enc("Bandit outlaw", 5)), f2 = new G.Fight(s2, enc("Bandit outlaw", 5));
  const a = TB.stats(s, f), b = TB.stats(s2, f2);
  ok(b.ap > a.ap, "Athletics/Stamina add AP " + a.ap + "→" + b.ap); ok(b.init > a.init, "Acrobatics/Sneak add initiative " + a.init + "→" + b.init);
  const m = fresh("mage", 30), fm = new G.Fight(m, enc("Bandit outlaw", 30)); ok(TB.stats(m, fm).spellAp >= 1, "mages get spell AP");
  ok(a.heavy >= 3 && TB.stats(fresh("archer", 5), new G.Fight(fresh("archer", 5), enc("Bandit outlaw", 5))).init > a.init - 3, "heavy armour costs initiative"); }
// 2. AP costs per weapon and spell tier
{ const s = fresh("warrior", 10), f = new G.Fight(s, enc("Bandit outlaw", 10)); ok(TB.cost(f, "attack") === 3 && TB.cost(f, "power_attack") === 5, "sword 3, power 5");
  f.wt = "dagger"; ok(TB.cost(f, "attack") === 2, "dagger 2"); f.wt = "greatsword"; ok(TB.cost(f, "attack") === 4, "greatsword 4");
  ok(TB.cost(f, "spell:flames") === 2 && TB.cost(f, "dual:flames") === 4, "novice spell 2, dual 4"); ok(TB.cost(f, "potion:health") === 1, "potion 1"); }
// 3. a manual fight: initiative order, actions, end turn, guard, foe acts, followers & summons on their own
{ const s = fresh("spellsword", 20); s.follower = { id: "lydia", hp: TOWNS.followerMax(s, "lydia"), ts: G.now() };
  const f = new G.Fight(s, enc("Bandit outlaw", 20)), ss = new TB.Session(f, { trySneak: false });
  let r = ss.begin(); ok(ss.order.length >= 3 && ss.order.some((o) => o.id === "me") && ss.order.some((o) => o.id === "foe") && ss.order.some((o) => o.al), "initiative order has you, the follower and the foe");
  const sorted = ss.order.every((o, i) => i === 0 || ss.order[i - 1].init >= o.init); ok(sorted, "order sorted by initiative");
  if (r.turn === "me") { const ap0 = ss.ap; const r1 = ss.act("attack"); ok(ss.ap === ap0 - 3 || r1.turn !== "me", "attack spends 3 AP"); if (ss.cur?.id === "me" && r1.turn === "me") { const r2 = ss.act("end"); ok(r2.turn === "next", "end turn"); } }
  let g = 0; while (!ss.done && g++ < 200) { r = ss.advance(); if (r.turn === "me") { const sp = s.spells.find((id) => D.SPELLS[id]?.kind === "summon"); const a = sp && !f.summonTurns && ss.canAfford("spell:" + sp) ? "spell:" + sp : ss.canAfford("power_attack") ? "power_attack" : "attack"; const x = ss.act(a); if (x.turn === "me") ss.act("end"); } }
  ok(ss.done, "manual fight finishes"); ok(ss.ev.some((e) => e.kind === "foe"), "the foe took turns"); ok(ss.ev.some((e) => e.who === "ally"), "the follower took turns on its own");
  ok(f.log.length >= 1 && f.log.every((l) => l.hp != null), "fight log per round"); }
// 4. every action type resolves without errors
{ const s = fresh("mage", 30); G.give(s, "potion_health", 2); const f = new G.Fight(s, enc("Frost troll", 30)), ss = new TB.Session(f, { trySneak: false }); ss.begin(); ss.ap = 99; ss.cur = { id: "me" };
  for (const a of ["attack", "power_attack", "block", "potion:health", ...s.spells.slice(0, 30).map((id) => "spell:" + id), ...s.spells.slice(0, 8).map((id) => "dual:" + id)]) { f.ehp = 9999; f.hp = G.maxHealth(s); f.mp = 9999; f.sp = 9999; ss.ap = 99; ss.cur = { id: "me" }; ss.idx = ss.order.findIndex((o) => o.id === "me");
    try { const r = ss.act(a); ok(r && !Number.isNaN(f.ehp) && !Number.isNaN(f.hp), a + " resolves"); } catch (e) { ok(false, a + " threw " + e.message); } } }
// 4b. shields: a passive block chance, Shield bash stuns (the foe loses its turn), no stun-locking, stamina cost
{ const s = fresh("warrior", 20), f = new G.Fight(s, enc("Bandit outlaw", 20)), ss = new TB.Session(f, { trySneak: false });
  ok(!!f.shield, "the warrior carries a shield");
  const pc = SHIELDFX.passive(f); ok(pc >= 0.12 && pc <= 0.45, "passive block chance in range: " + Math.round(pc * 100) + "%");
  const s2 = fresh("twohand", 20), f2 = new G.Fight(s2, enc("Bandit outlaw", 20)); ok(SHIELDFX.passive(f2) === 0, "no shield, no passive block");
  let caught = 0; for (let i = 0; i < 400; i++) { f.hp = 9999; f.blocking = false; f.allies = []; const t = f.enemyTurnInner(); if (/caught on your shield/.test(t)) caught++; }
  ok(caught > 10 && caught < 400 * 0.5, "blows get caught on the shield sometimes: " + caught + "/400");
  ss.begin(); let g = 0; while (ss.cur?.id !== "me" && !ss.done && g++ < 20) ss.advance();
  f.sp = G.maxStamina(s); f.ehp = 9999; ss.ap = 99;
  const sp0 = f.sp; ok(ss.canAfford("bash"), "can afford a bash with full stamina");
  ss.act("bash"); ok(f.sp <= sp0 - 35, "a bash costs a lot of stamina: " + Math.round(sp0 - f.sp));
  ok(f.tbStunLeft > 0, "the bash stuns a normal foe");
  f.sp = 9999; ss.act("bash"); ok(ss.ev[ss.ev.length - 1].text.includes("no stun"), "no stun-locking right after a stun");
  f.sp = 0; ok(!ss.canAfford("bash"), "no stamina, no bash");
  const hp0 = f.hp; ss.act("end"); let foeLines = []; g = 0; while (!ss.done && g++ < 30) { const n = ss.ev.length; ss.advance(); foeLines.push(...ss.ev.slice(n).filter((e) => e.kind === "foe").map((e) => e.text)); if (ss.cur?.id === "me") break; }
  ok(/stunned/.test(foeLines[0] || ""), "the stunned foe loses its turn: " + foeLines.join(" | "));
}
// 5. no one-shots on strong foes; sneak still matters on trash
{ let max = 0; for (let i = 0; i < 60; i++) { const s = fresh("sneakarcher", 30), f = new G.Fight(s, boss("deathlord", 30)), ss = new TB.Session(f, { hidden: true }); ss.begin(); if (ss.cur?.id !== "me") ss.advance(); if (ss.cur?.id === "me") { const b = f.ehp; ss.act("attack"); max = Math.max(max, (b - f.ehp) / ss.ehpMax); } }
  ok(max <= TB.HIT_CAP + 0.11, "a sneak shot takes at most ~40% (+flank) of a boss: " + Math.round(max * 100) + "%"); }
}
// 6. Auto plays whole fights; length and win-rate table
const groups = { normal: (L) => enc(["Bandit outlaw", "Wolf pack", "Draugr", "Forsworn ambush", "Black bear", "Sabre cat"][Math.floor(Math.random() * 6)], L),
  tough: (L) => enc(["Vampire", "Frost troll", "Thalmor patrol"][Math.floor(Math.random() * 3)], L),
  boss: (L) => boss(["deathlord", "chief", "centurion", "hagraven", "master", "lich"][Math.floor(Math.random() * 6)], L) };
const table = {};
let errs = 0;
for (const g of Object.keys(groups)) for (const b of ["warrior", "twohand", "archer", "mage", "spellsword"]) for (const L of [5, 20, 40]) {
  let w = 0, rounds = 0; for (let i = 0; i < RUNS; i++) { const s = fresh(b, L), f = new G.Fight(s, groups[g](L)); try { const ss = TB.simulate(f, { t: G.now() }); if (f.won && !f.escaped) w++; rounds += ss.round; } catch (e) { errs++; if (errs < 4) console.log("ERR", b, L, g, e.stack); } }
  (table[g] = table[g] || []).push([b, L, w / RUNS, rounds / RUNS]); }
ok(errs === 0, "no errors in " + errs + " sims");
const avg = (g, k) => table[g].reduce((a, r) => a + r[k], 0) / table[g].length;
console.log("group   win%  rounds   (per build × level: win%/rounds)");
for (const g of Object.keys(table)) console.log(g.padEnd(7), String(Math.round(avg(g, 2) * 100)).padStart(4) + "%", avg(g, 3).toFixed(1).padStart(6), "  ", table[g].map(([b, L, w, r]) => b.slice(0, 5) + L + " " + Math.round(w * 100) + "/" + r.toFixed(1)).join("  "));
globalThis.__table = table;
if (!process.env.SIMONLY) {
// 7. the pause/replay wrapper gives the played result back to the same game action
{ const s = fresh("warrior", 10); s.trip = { status: "encounter", encounter: enc("Bandit outlaw", 10), path: [[s.x, s.y], [s.x + 0.01, s.y]], idx: 0, destName: "X", lastTick: G.now(), log: [] };
  const r = G.encounterAction(s, "fight"); ok(r.fight && r.fight.log.length > 0, "plain engine path still runs fights instantly (tests, sims)"); }
// 7b. after a played fight the save is updated in place, so a won road fight clears the road (the "vampire blocks the road" bug)
{ const s = { trip: { status: "encounter", encounter: { name: "Vampire", hp: 40 } }, inv: [1, 2] }, tr = s.trip, e = tr.encounter;
  TB.syncInPlace(s, { trip: { status: "encounter", encounter: { name: "Vampire", hp: 0 } }, inv: [1] });
  ok(s.trip === tr && s.trip.encounter === e && e.hp === 0 && s.inv.length === 1, "the fight result lands in the same trip/encounter objects");
  tr.status = "travel"; ok(s.trip.status === "travel", "setting the held trip clears the real road");
  const st = fresh("warrior", 10); st.trip = { status: "encounter", encounter: { name: "Vampire", hp: 0 }, path: [[st.x, st.y]], idx: 0, log: [] };
  G.migrate(st); ok(st.trip.status === "travel" && !st.trip.encounter, "old saves stuck on a dead foe are freed on load"); }
// 8. party: a real player's turn waits for their own phone; timeout → Auto
{ const s = fresh("warrior", 20), f = new G.Fight(s, enc("Bandit outlaw", 20));
  const mate = COOP.allyFromCard({ id: "p2", name: "Beta", coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: "fighter" } } }); mate.pid = "p2"; f.allies.push(mate);
  const asked = []; const ss = new TB.Session(f, { trySneak: false }); ss.remote = { ask: (sess, al) => asked.push(al.pid), end() {} };
  ok(ss.waves === 2 && ss.ehpMax * ss.waves > Math.round(f.e.hp * TB.FOE_HP), "party fights: two heroes meet two foes, tougher in total");
  let r = ss.begin(), waited = false, g = 0;
  while (!ss.done && g++ < 300) { if (r.turn === "me") { r = ss.act("attack"); if (r.turn === "next") r = ss.advance(); continue; } if (r.turn === "wait") { waited = true; if (asked.length === 1) ss.waiting.move = "power"; else ss.waiting.until = 0; r = ss.advance(); continue; } r = ss.advance(); }
  ok(waited && asked[0] === "p2", "the fight waited for Beta's phone"); ok(ss.ev.some((e) => /Beta power attack/.test(e.text)), "Beta's chosen move was played"); ok(ss.ev.some((e) => /took too long: Auto/.test(e.text)) || asked.length === 1, "a late player gets Auto");
  ok(ss.wave === 2 || !f.won, "a won party fight went through every foe"); ok(!f.won || ss.ev.some((e) => /Another .* steps in/.test(e.text)), "the next foe steps in"); }
// 9. bigger party, more foes (at most 6); a boss stays alone
{ const s = fresh("warrior", 20), f = new G.Fight(s, enc("Bandit outlaw", 20));
  for (let i = 0; i < 7; i++) { const m = COOP.allyFromCard({ id: "p" + i, name: "M" + i, coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: "fighter" } } }); m.pid = "p" + i; f.allies.push(m); }
  const ss = new TB.Session(f, { trySneak: false }); ok(ss.waves === 6, "8 heroes meet 6 foes"); }
{ const s = fresh("warrior", 20), f = new G.Fight(s, enc("Bandit outlaw", 20)); const ss = new TB.Session(f, { trySneak: false }); ok(ss.waves === 1, "alone: one foe"); }
}
console.log(fails ? "FAILED " + fails : "ALL OK");
globalThis.__fails = fails;
`, c);
process.exit(c.__fails ? 1 : 0);
