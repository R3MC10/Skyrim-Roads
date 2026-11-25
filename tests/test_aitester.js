/* "What would the AI do?" tester (aitester.js) and the [AI] reasons in fight logs.
   W=/path/to/game/ node test_aitester.js  — prints ALL OK.
   The tester must show exactly what the real fight code picks for the same moment (Custom, Hybrid and Smart AI),
   explain each rule (✓ fired / ✗ skipped + why), never touch the save, and only auto-played moves get "[AI] reason". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "stacks.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "sneak2.js", "aiset.js", "aitester.js", "foeintent.js", "tbfight.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const ok = (v, m) => { n++; if (!v) throw new Error("FAIL " + m); };
function hero(lvl = 12) {
  const s = G.newSave("ait", "Tess", "nord"); s._test = true; s.level = lvl; s.hpBonus = 60; s.spBonus = 40; s.mpBonus = 40;
  G.give(s, "potion_health_minor", 3);
  if (D.SPELLS.flames && !s.spells.includes("flames")) s.spells.push("flames");
  if (D.SPELLS.healing && !s.spells.includes("healing")) s.spells.push("healing");
  return s;
}
const real = (s, o) => { const f = AITEST.build(s, o); const [rule, a] = f.choose(); return { rule, a }; };

// 1) Custom: rules top to bottom, the health slider switches the fired rule
{ const s = hero(), L = G.loadout(s); L.mode = "custom";
  L.rules = [{ if: "hp_below", pct: 50, do: "block" }, { if: "enemy_hp_below", pct: 30, do: "power_attack" }, { if: "always", do: "attack" }];
  const hi = AITEST.run(s, { hp: 80, sp: 100, mp: 100, ehp: 100, foe: "normal", n: 1, down: false });
  ok(hi.mode === "custom" && hi.rule === 3 && hi.action === "attack", "80% health: the Always rule fires " + JSON.stringify([hi.rule, hi.action]));
  ok(hi.rows[0].state === "skip" && /health is 80%, rule needs below 50%/.test(hi.rows[0].why), "rule 1 skipped with the reason: " + hi.rows[0].why);
  ok(hi.rows[1].state === "skip" && /foe's health is 100%, rule needs below 30%/.test(hi.rows[1].why), "rule 2 skipped: " + hi.rows[1].why);
  ok(hi.rows[2].state === "fire", "rule 3 ticked");
  const lo = AITEST.run(s, { hp: 30, sp: 100, mp: 100, ehp: 100, foe: "normal", n: 1, down: false });
  ok(lo.rule === 1 && lo.action === "block" && lo.rows[0].state === "fire" && lo.rows[1].state === "later" && lo.rows[2].state === "later", "30% health: rule 1 fires, the rest aren't checked");
  ok(/health is 30%/.test(lo.rows[0].why), "the fired rule says why: " + lo.rows[0].why);
  // true but not possible: no stamina to block
  const tired = AITEST.run(s, { hp: 30, sp: 0, mp: 100, ehp: 20, foe: "normal", n: 1, down: false });
  ok(tired.rows[0].state === "skip" && /stamina/.test(tired.rows[0].why), "a true rule you can't afford is skipped with the cost: " + tired.rows[0].why);
  ok(tired.rows[1].state === "skip" && /not enough stamina \\(needs \\d+, has 0\\)/.test(tired.rows[1].why), "power attack: " + tired.rows[1].why);
  ok(tired.rule === 3, "falls through to Always → Attack");
  // switched off
  L.rules[0].off = true; const off = AITEST.run(s, { hp: 30, sp: 100, mp: 100, ehp: 100, foe: "normal", n: 1, down: false }); delete L.rules[0].off;
  ok(off.rows[0].state === "skip" && off.rows[0].why === "switched off", "switched-off rule says so");
  // AND / OR / NOT
  L.rules = [AISET.makeRule({ if: "hp_below", pct: 50 }, [{ if: "enemy_dragon" }], "and"), { if: "always", do: "attack" }]; L.rules[0].do = "block";
  const and = AITEST.run(s, { hp: 30, sp: 100, mp: 100, ehp: 100, foe: "normal", n: 1, down: false });
  ok(and.rows[0].state === "skip" && /dragon: no/i.test(and.rows[0].why) && !/health is/.test(and.rows[0].why), "AND: names only the part that failed: " + and.rows[0].why);
  const drg = AITEST.run(s, { hp: 30, sp: 100, mp: 100, ehp: 100, foe: "dragon", n: 1, down: false });
  ok(drg.rows[0].state === "fire" && /dragon/i.test(drg.foe), "AND fires against a dragon (" + drg.foe + ")");
  // no rules at all
  L.rules = []; const none = AITEST.run(s, { hp: 50, sp: 50, mp: 50, ehp: 50, foe: "normal", n: 1, down: false });
  ok(none.action === "attack" && none.rule === 0 && /no rule fired/.test(none.why), "no rules: you attack"); }

// 2) Hybrid: your rules first, the filler lets Smart AI pick
{ const s = hero(), L = G.loadout(s); L.mode = "hybrid";
  L.rules = [{ if: "hp_below", pct: 40, do: "block" }, { if: "always", do: "attack" }];
  const x = AITEST.run(s, { hp: 90, sp: 100, mp: 100, ehp: 100, foe: "strong", n: 1, down: false });
  ok(x.mode === "hybrid" && x.rule === 0 && x.rows[1].state === "skip" && /filler/.test(x.rows[1].why), "Hybrid: filler skipped, Smart AI picks (" + x.action + ": " + x.why + ")");
  ok(x.why && typeof x.why === "string", "Smart AI's pick has a reason");
  const y = AITEST.run(s, { hp: 20, sp: 100, mp: 100, ehp: 100, foe: "strong", n: 1, down: false });
  ok(y.rule === 1 && y.action === "block" && /health is 20%/.test(y.why), "Hybrid: your rule wins when it fires"); }

// 3) Smart AI: no rule rows, a reason, next best moves
{ const s = hero(), L = G.loadout(s); L.mode = "smart";
  const x = AITEST.run(s, { hp: 100, sp: 100, mp: 100, ehp: 100, foe: "normal", n: 1, down: false });
  ok(x.mode === "smart" && !x.rows.length && x.why.length > 2, "Smart AI: just the pick and why (" + x.action + ": " + x.why + ")");
  ok(Array.isArray(x.alts), "next best list"); }

// 4) the tester equals the real fight's pick for the same moment (many moments, all three modes)
{ let checked = 0;
  for (const mode of ["custom", "hybrid", "smart"]) for (const hp of [10, 35, 60, 95]) for (const sp of [0, 60]) for (const mp of [5, 100]) for (const foe of ["normal", "strong", "boss", "dragon", "caster"]) {
    const s = hero(), L = G.loadout(s); L.mode = mode;
    L.rules = [{ if: "hp_below", pct: 40, do: "potion:health" }, { if: "enemy_hp_below", pct: 50, do: "power_attack" }, { if: "mp_above", pct: 50, do: "spell:flames" }, { if: "always", do: "attack" }];
    const o = { hp, sp, mp, ehp: hp > 50 ? 80 : 40, foe, n: 1 + (hp % 3), down: hp < 30 };
    const x = AITEST.run(s, o), r = real(s, o);
    ok(x.action === r.a && x.rule === r.rule, \`\${mode} hp\${hp} sp\${sp} mp\${mp} \${foe}: tester \${x.action}/\${x.rule} = fight \${r.a}/\${r.rule}\`);
    ok(x.fired === x.rule || mode === "smart", \`\${mode}: the ticked rule is the one that fired (\${x.fired} vs \${x.rule})\`);
    checked++;
  }
  ok(checked === 240, "240 moments checked"); }

// 5) read-only: the save never changes; the foe kinds exist
{ const s = hero(); G.loadout(s).mode = "hybrid"; const before = JSON.stringify(s);
  for (const foe of ["normal", "strong", "boss", "dragon", "caster"]) { const f = AITEST.build(s, { hp: 40, sp: 40, mp: 40, ehp: 40, foe, n: 3, down: true });
    ok(f.e && f.e.health > 0 && f._downed.length === 1 && f.followerDown && f.adds.length === 2, foe + ": foe built (" + f.e.name + "), friend down, 3 foes");
    ok(foe !== "boss" || f.e.boss, "boss is a boss"); ok(foe !== "dragon" || f.tags.has("dragon"), "dragon is a dragon");
    ok(Math.round(100 * f.hp / G.maxHealth(f.s)) === 40 && Math.round(100 * f.ehp / f.e.health) === 40, foe + ": sliders set the numbers"); AITEST.explain(f); }
  ok(JSON.stringify(s) === before, "the save is untouched"); }

// 6) condition words
{ const s = hero(), f = AITEST.build(s, { hp: 80, sp: 30, mp: 60, ehp: 100, foe: "normal", n: 1, down: false });
  ok(AITEST.condWhy(f, { if: "hp_below", pct: 40 }).text === "health is 80%, rule needs below 40%", "the brief's own example");
  ok(AITEST.condWhy(f, { if: "sp_above", pct: 50 }).text === "stamina is 30%, rule needs above 50%" && !AITEST.condWhy(f, { if: "sp_above", pct: 50 }).ok, "stamina");
  ok(AITEST.condWhy(f, { if: "hp_below", pct: 40, not: true }).ok, "NOT flips it");
  ok(/turn 2/.test(AITEST.condWhy(f, { if: "first_turn" }).text), "turn words");
  ok(/no$/.test(AITEST.condWhy(f, { if: "enemy_boss" }).text), "yes/no conditions");
  f.sp = 0; ok(/not enough stamina/.test(AITEST.cantWhy(f, "power_attack")), "can't afford words");
  ok(/potion/.test(AITEST.cantWhy(f, "potion:magicka")), "missing potion words"); }

// 7) short reasons never change a pick and always say something
{ ok(COMBATAI.shortWhy("attack", "") === "steady damage" && COMBATAI.shortWhy("attack", "finishing blow") === "finishing blow", "shortWhy keeps the real reason, fills the blanks");
  const s = hero(), f = AITEST.build(s, { hp: 60, sp: 60, mp: 60, ehp: 60, foe: "normal", n: 1, down: false });
  const a1 = COMBATAI.decide(f).action, rk = COMBATAI.rank(f, 5), a2 = COMBATAI.decide(f).action;
  ok(a1 === a2 && rk.length >= 1, "rank() doesn't change the choice"); }

// 8) instant fights: AI lines carry a reason; custom rule lines don't get [AI]
{ const s = hero(), L = G.loadout(s); L.mode = "smart"; const e = G.scaleEnemy(D.ENCOUNTERS.find((x) => x.name === "Bandit outlaw") || D.ENCOUNTERS[0], s.level);
  const f = new G.Fight(G.clone(s), G.clone(e)); f.run();
  ok(f.log.filter((l) => l.ai).length >= 1 && f.log.some((l) => l.ai && l.why), "Smart AI lines have a reason");
  const s2 = hero(); G.loadout(s2).mode = "custom"; const f2 = new G.Fight(G.clone(s2), G.clone(e)); f2.run();
  ok(!f2.log.some((l) => l.ai), "custom rules: no [AI] tag"); }

// 9) turn-based: auto-played moves end with "[AI] reason", moves you pick don't
if (typeof TB !== "undefined") {
  const s = hero(), e = G.scaleEnemy(D.ENCOUNTERS.find((x) => x.name === "Bandit outlaw") || D.ENCOUNTERS[0], s.level);
  const ss = TB.simulate(new G.Fight(G.clone(s), G.clone(e)), { trySneak: false });
  const mine = ss.ev.filter((x) => x.who === "me" && x.kind === "me");
  ok(mine.length && mine.every((x) => / \\[AI\\] \\S/.test(x.text)), "auto fight: every move of yours says [AI] why (" + (mine[0] && mine[0].text) + ")");
  ok(ss.f.log.some((l) => l.ai && l.why), "the round line knows the AI played it");
  const f2 = new G.Fight(G.clone(s), G.clone(e)), s2 = new TB.Session(f2, { trySneak: false }); let r = s2.begin(), g = 0;
  while (!s2.done && g++ < 200) { if (r.turn === "me" || s2.cur?.id === "me") { const x = s2.act("attack"); if (x && x.turn === "me") s2.act("end"); } r = s2.advance(); }
  const own = s2.ev.filter((x) => x.who === "me" && x.kind === "me");
  ok(own.length && !own.some((x) => /\\[AI\\]/.test(x.text)), "moves you pick have no [AI] note");
  ok(!f2.log.some((l) => l.ai), "and the rounds you played aren't marked [AI]");
}
console.log("ALL OK (" + n + " checks)");
`, c);
