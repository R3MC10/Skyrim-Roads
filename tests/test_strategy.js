/* Strategy in turn-based fights (strategy.js): smart play beats button-mashing by a clear margin.
   W=/path/to/game/ node test_strategy.js [runs]  — prints a table and ALL OK.
   "Mash" presses the biggest button every time (power attack while there's stamina, a caster's damage spell, else
   attack) and never blocks, heals, guards, drinks, summons or breathes. "Smart" is Auto: the Smart AI (combatai.js) plus strategy.js (cash in openings, catch
   your breath). Same characters, same foes. Also checks Catch your breath, openings (capped: no one-shots),
   frost slowing initiative and follower orders. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const RUNS = +(process.env.RUNS || process.argv[2] || 16);
const TUNE = process.env.TUNE ? JSON.parse(process.env.TUNE) : null;
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "stacks.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "foeintent.js", "initiative.js", "tbfight.js", "followers2.js", "followerai.js", "strategy.js"])
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

globalThis.H = { fresh, enc, boss, ok: (x, m) => ok(x, m), fails: () => fails };
`, c);
/* the checks run inside the game's context too: written as a function here, its source is run there */
function checks() {
const { fresh, enc, boss, ok } = H, RUNS = globalThis.RUNS;
if (process.env.NOSTRAT) STRAT.ai = (s, a) => a;   // compare: Auto without strategy.js

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const FOES = { normal: (L) => enc(pick(["Bandit outlaw", "Wolf pack", "Draugr", "Forsworn ambush", "Black bear", "Sabre cat"]), L),
  tough: (L) => enc(pick(["Vampire", "Frost troll", "Thalmor patrol"]), L),
  boss: (L) => boss(pick(["deathlord", "chief", "centurion", "hagraven", "master", "lich"]), L) };
function mash(ss) {
  let g = 0;
  while (ss.cur?.id === "me" && !ss.done && g++ < 12) {
    const zap = (ss.f.s.spells || []).map((id) => "spell:" + id).find((x) => D.SPELLS[x.slice(6)]?.kind === "damage" && ss.canAfford(x));   // a caster mashes their damage spell
    const a = !ss.f.weapon && zap ? zap : ss.canAfford("power_attack") ? "power_attack" : zap || (ss.canAfford("attack") ? "attack" : "end");
    const r = ss.act(a); if (!r || r.err) { ss.act("end"); break; } if (r.turn !== "me") break;
  }
}
function play(build, L, kind, how) {
  const s = fresh(build, L), f = new G.Fight(s, FOES[kind](L)), ss = new TB.Session(f, { trySneak: false, t: G.now() });
  ss.begin(); let g = 0;
  while (!ss.done && g++ < 400) {
    if (ss.cur?.id === "me" && !ss.done) { if (how === "smart") ss.autoTurn(); else mash(ss); }
    ss.advance();
  }
  const hpMax = G.maxHealth(s);
  return { won: !!(f.won && !f.escaped), hp: f.won ? Math.max(0, f.hp) / hpMax : 0, rounds: ss.round,
    recover: ss.ev.filter((e) => /catch your breath/.test(e.text)).length, open: ss.ev.filter((e) => /opening!|shatters the frost/.test(e.text)).length };
}
const BUILDS = ["warrior", "twohand", "spellsword", "mage", "archer"], LV = [10, 25, 40], KINDS = ["normal", "tough", "boss"];
const T = { mash: { w: 0, hp: 0, r: 0, n: 0 }, smart: { w: 0, hp: 0, r: 0, n: 0, rec: 0, open: 0 } }, per = {};
let errs = 0;
for (const b of BUILDS) for (const L of LV) for (const k of KINDS) for (const how of ["mash", "smart"]) for (let i = 0; i < RUNS; i++) {
  try {
    const x = play(b, L, k, how), t = T[how]; t.w += x.won; t.hp += x.hp; t.r += x.rounds; t.n++; if (how === "smart") { t.rec += x.recover; t.open += x.open; }
    const p = (per[b] = per[b] || { mash: [0, 0, 0], smart: [0, 0, 0] })[how]; p[0] += x.won; p[1] += x.hp; p[2]++;
  } catch (e) { errs++; if (errs < 4) console.log("ERR", b, L, k, how, e.stack); }
}
ok(errs === 0, "no errors in the sims (" + errs + ")");
const pct = (x) => Math.round(x * 100);
const score = (t) => t.w / t.n * 0.6 + t.hp / t.n * 0.4;   // winning counts most, then how much health you keep
console.log("play    win%  hp left  rounds");
for (const [h, t] of Object.entries(T)) console.log(h.padEnd(6), String(pct(t.w / t.n)).padStart(5) + "%", String(pct(t.hp / t.n)).padStart(6) + "%", (t.r / t.n).toFixed(1).padStart(7));
console.log("per build (win% / hp left, mash → smart):", Object.entries(per).map(([b, p]) => `${b} ${pct(p.mash[0] / p.mash[2])}/${pct(p.mash[1] / p.mash[2])}→${pct(p.smart[0] / p.smart[2])}/${pct(p.smart[1] / p.smart[2])}`).join("  "));
console.log(`smart play caught its breath ${T.smart.rec}x and cashed in ${T.smart.open} openings`);
ok(score(T.smart) - score(T.mash) >= 0.1, `smart play beats button-mashing by a clear margin (score ${pct(score(T.smart))} vs ${pct(score(T.mash))}, needs +10)`);
ok(T.smart.w / T.smart.n >= T.mash.w / T.mash.n + 0.08, "smart play wins clearly more often");
for (const [b, p] of Object.entries(per)) ok(p.smart[0] / p.smart[2] + 0.4 * p.smart[1] / p.smart[2] >= p.mash[0] / p.mash[2] + 0.4 * p.mash[1] / p.mash[2] - 0.03, `${b}: smart is never worse than mashing`);
ok(T.smart.r / T.smart.n >= 3, "fights aren't over too quickly (" + (T.smart.r / T.smart.n).toFixed(1) + " rounds)");
ok(T.smart.open > 0, "Auto cashes in openings");

// --- the pieces
{ const s = fresh("twohand", 20), f = new G.Fight(s, enc("Bandit outlaw", 20)), ss = new TB.Session(f, { trySneak: false });
  { const c0 = TB.cost(f, "recover"); ok(!c0.sp && !c0.mp && !c0.hp && STRAT.ends("recover"), "Catch your breath is free but ends your turn"); }
  ss.begin(); f.sp = 5; f.mp = 5; ss.cur = { id: "me" }; ss.myActs = 0; ss.used = {}; ss.over = false;
  ok(ss.canAfford("recover"), "you can catch your breath when tired");
  const r = ss.act("recover"); ok(r && !r.err && f.sp > 5 + G.maxStamina(s) * 0.3 && f.mp > 5, "Catch your breath gives stamina and magicka back");
  ok(ss.ev.some((e) => /catch your breath/.test(e.text)), "it says so in the log");
  f.sp = G.maxStamina(s); f.mp = G.maxMagicka(s); ok(!STRAT.can(f, "recover") && STRAT.why(f, "recover") === "Already fresh", "not when you're already fresh"); }
{ const s = fresh("twohand", 20); let maxShare = 0, n = 0;
  for (let i = 0; i < 40; i++) {
    const f = new G.Fight(s, enc("Frost troll", 20)); f.ehp0 = f.ehp; const b = f.ehp, hit = f.ehp0 * (0.02 + i * 0.012); f.ehp -= hit;
    const t = STRAT.after(f, "power_attack", b, "open"); if (t) n++; maxShare = Math.max(maxShare, (b - hit - f.ehp) / f.ehp0);
  }
  ok(n === 40, "a power attack on a staggered foe is an opening (" + n + "/40)");
  ok(maxShare <= STRAT.OPEN.cap + 1e-9, "the opening bonus is capped at " + pct(STRAT.OPEN.cap) + "% of the foe's health (no one-shots)");
  const f2 = new G.Fight(s, boss("deathlord", 20)); f2.ehp0 = 1000; f2.ehp = 700; STRAT.after(f2, "power_attack", 1000, "open");
  ok(700 - f2.ehp <= 1000 * STRAT.OPEN.cap * 0.5 + 1e-9, "half that on a boss");
  ok(STRAT.after(f2, "spell:flames", 700, "open") === "", "spells aren't openings (that's combo.js)");
  const f3 = new G.Fight(s, enc("Frost troll", 20)); f3.stagger = true; ok(STRAT.setup(f3) === "open", "a staggered foe is open");
  f3.stagger = false; f3.foeSt = { chill: { turns: 2 } }; ok(STRAT.setup(f3) === "chill", "a chilled foe can be shattered"); }
{ const s = fresh("warrior", 20), f = new G.Fight(s, enc("Bandit outlaw", 20)), ss = new TB.Session(f, { trySneak: false });
  let a = 0, b = 0;
  for (let i = 0; i < 200; i++) { f.foeSt = {}; a += ss.rollOrder().find((o) => o.id === "foe").init; f.foeSt = { chill: { turns: 2 } }; b += ss.rollOrder().find((o) => o.id === "foe").init; }
  ok(a / 200 - b / 200 >= 1.5, "a chilled foe acts later (initiative " + (a / 200).toFixed(1) + " -> " + (b / 200).toFixed(1) + ")"); f.foeSt = {}; }
{ const s = fresh("warrior", 20); s.follower = { id: "lydia", hp: TOWNS.followerMax(s, "lydia"), ts: G.now() };
  const f = new G.Fight(s, enc("Bandit outlaw", 20)), al = f.allies.find((x) => x.fai);
  if (al) {
    const t0 = al.tactic, w0 = FAI.aggro(f);
    ok(STRAT.order(f, al, "hold") && al.row === "back" && FAI.aggro(f) < w0, "Hold back: back row, draws fewer blows");
    let only = true; for (let i = 0; i < 20; i++) { const o = FAI.decide(f, al, 6); if (o && !["guard", "potion", "cast"].includes(o.k)) only = false; }
    ok(only, "Hold back: only guards, heals and potions");
    STRAT.order(f, al, "attack"); ok(al.tactic === "aggressive" && al.row === "front", "Attack: aggressive, front row");
    STRAT.order(f, al, "defend"); ok(al.tactic === "defensive" && FAI.aggro(f) >= w0 - 1e-9, "Defend me: defensive, draws blows");
    f.hp = G.maxHealth(s) * 0.6; ok(FAI.options(f, al, 6).some((x) => x.k === "cover"), "Defend me: steps in front of you sooner");
    STRAT.order(f, al, null); ok(al.tactic === t0 && !al.order, "tap again: back to their own way");
    ok(/data-strat-ord="attack"/.test(STRAT.ordersHTML(al, 0, true)) && STRAT.ordersHTML({ name: "Bandit" }, 0, true) === "", "order buttons only for your own follower");
  } else ok(false, "Lydia joins the fight as a full follower");
}
}
vm.runInContext("(" + checks.toString() + ")()", c);
const fails = c.H.fails();
console.log(fails ? fails + " FAILED" : "ALL OK");
process.exit(fails ? 1 : 0);
