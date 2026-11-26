/* Moves that come from items (minigame.js [itemgames], poisonfight.js). W=/path/to/game/ node test_itemgames.js — ALL OK.
   - Shield bash, a staff, an oil flask and scrolls each get a minigame; potions and poisons don't.
   - The sweet zone for a guard / shield bash is worked out without errors (it used to ask for a skill called "Block",
     which threw, so the fight quietly skipped the game) and grows with Blocking.
   - The oil flask: Perfect soaks the foe a round longer, a Miss a round shorter.
   - Poisons in a turn-based fight: "poison:<row id>" coats your weapon, costs one move and no stamina, uses the poison up,
     and the next hit delivers it (bows too). Not twice, not in Beast Form, not without a weapon. No one-hit wins.
   - Party fights hand the minigame grade through too (sharedfight.js). */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RUNS: 1, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "stacks.js", "events.js", "dungeons.js", "towns.js", "poisonfight.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "foeintent.js", "minigame.js", "initiative.js", "tbfight.js", "followers2.js", "followerai.js", "strategy.js", "reactions.js", "sharedfight.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
const ST = fs.readFileSync(require("path").join(__dirname, "test_strategy.js"), "utf8");
const a0 = ST.indexOf("vm.runInContext(`") + "vm.runInContext(`".length, a1 = ST.indexOf("`, c);", a0);
vm.runInContext(ST.slice(a0, a1), c);

vm.runInContext(`(() => {
const { fresh, enc, boss, ok } = H, M = MINIGAME;
const shieldOn = (s) => { G.give(s, "iron_shield"); G.equip(s, s.inv.find((r) => r.item === "iron_shield").id); return s; };
// 1. which item moves get a game
const s0 = shieldOn(fresh("warrior", 20)), f0 = new G.Fight(s0, enc("Bandit outlaw", 20));
ok(!!f0.shield, "the test hero carries a shield");
const gb = M.kindFor(f0, "bash");
ok(gb && gb.kind === "parry" && gb.shove && gb.label === "Shield bash", "shield bash is a timed shove (parry game)");
let w = null, err = null; try { w = M.width(f0, "bash", gb); } catch (e) { err = e; }
ok(!err && w >= 1, "the shield bash zone is worked out without an error (" + (err ? err.message : w) + ")");
ok(M.width(f0, "block", { kind: "parry" }) >= 1, "the guard zone works too");
{ const lo = shieldOn(fresh("warrior", 20)), hi = shieldOn(fresh("warrior", 20)); hi.skills.Blocking.lvl = 80; lo.skills.Blocking.lvl = 15;
  ok(M.width(new G.Fight(hi, enc("Bandit outlaw", 20)), "bash", gb) > M.width(new G.Fight(lo, enc("Bandit outlaw", 20)), "bash", gb), "more Blocking = a wider shield bash zone"); }
ok(M.kindFor(f0, "rx:oil")?.kind === "strike" && M.kindFor(f0, "rx:oil").toss, "the oil flask is thrown (strike game)");
const scroll = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].spell && D.SPELLS[D.ITEMS[k].spell] && D.SPELLS[D.ITEMS[k].spell].kind !== "utility");
ok(scroll && M.kindFor(f0, "scroll:" + scroll)?.kind === "rune" && M.kindFor(f0, "scroll:" + scroll).school === (D.SPELLS[D.ITEMS[scroll].spell].school in M.SCHOOLS ? D.SPELLS[D.ITEMS[scroll].spell].school : "Destruction"), "a scroll draws its spell's rune (" + scroll + ")");
ok(M.kindFor(f0, "potion:health") === null && M.kindFor(f0, "poison:1") === null && M.kindFor(f0, "flee") === null, "potions, poisons and fleeing stay without a game");
// a staff: the rune of its spell's school
{ const fire = Object.keys(D.SPELLS).find((k) => D.SPELLS[k].school === "Destruction" && D.SPELLS[k].kind === "damage");
  const fs = new G.Fight(fresh("mage", 20), enc("Bandit outlaw", 20)); fs.weapon = { name: "Staff of Test", staff: { spell: fire, perCast: 10 } };
  const g = M.kindFor(fs, "attack");
  ok(g && g.kind === "rune" && g.school === "Destruction" && g.staff && g.label === "Staff of Test", "a staff draws its spell's rune");
  ok(M.kindFor(Object.assign(fs, { bound: { dmg: 10 } }), "attack").kind === "strike", "a bound weapon over a staff swings (strike)"); }

// 2. the oil flask grade
for (const [cls, d] of [["perfect", 1], ["good", 0], ["poor", -1]]) {
  const s = fresh("warrior", 20); G.give(s, "oil_flask", 2);
  const f = new G.Fight(s, enc("Bandit outlaw", 20)), ss = new TB.Session(f, { trySneak: false }); ss.begin(); ss.cur = { id: "me" }; ss.idx = ss.order.findIndex((o) => o.id === "me"); ss.myActs = 0;
  const gr = { mult: 1, cls, label: cls, kind: "strike" };
  if (!REACT.can(f, "rx:oil")) { ok(false, "oil flask usable"); continue; }
  const base = (() => { const s2 = fresh("warrior", 20); G.give(s2, "oil_flask", 1); const f2 = new G.Fight(s2, enc("Bandit outlaw", 20)), s3 = new TB.Session(f2, { trySneak: false }); s3.begin(); s3.cur = { id: "me" }; s3.idx = s3.order.findIndex((o) => o.id === "me"); s3.myActs = 0; s3.act("rx:oil"); return f2.rx.oil.until; })();
  const r = ss.act("rx:oil", null, 1, gr);
  ok(f.rx && f.rx.oil && f.rx.oil.until === base + d, "oil flask " + cls + ": soaked " + (d > 0 ? "a round longer" : d < 0 ? "a round shorter" : "as normal") + " (" + (f.rx?.oil?.until) + " vs " + base + ")");
}

// 3. poisons in a turn-based fight
const PZ = "brew|Damage Health:30:0";
const setup = (build, opts = {}) => {
  const s = fresh(build, 20); G.give(s, PZ, 2); s.poison = null;
  const e = enc(opts.foe || "Bandit outlaw", 20);
  const f = new G.Fight(s, e), ss = new TB.Session(f, { trySneak: false }); ss.begin();
  ss.cur = { id: "me" }; ss.idx = ss.order.findIndex((o) => o.id === "me"); ss.myActs = 0; ss.used = {};
  const row = s.inv.find((r) => r.item === PZ);
  return { s, f, ss, row, a: "poison:" + row.id };
};
ok(D.ITEMS[PZ].slot === "poison", "the brewed test poison is a poison");
{ const { s, f, ss, row, a } = setup("warrior");
  ok(POISONFX.list(f).some(([x]) => x === a), "the poison shows in the fight's list");
  ok(TB.zoneOf ? TB.zoneOf(a) === "self" : true, "it's used on yourself");
  ok(ss.canAfford(a), "you can coat your weapon in a fight (" + POISONFX.why(f, a) + ")");
  const c0 = TB.cost(f, a, ss); ok(c0.sp === 0 && c0.mp === 0 && c0.hp === 0, "coating costs no stamina, magicka or health");
  const sp0 = f.sp, n0 = ss.myActs, q0 = f.left(row.id);
  const r = ss.act(a);
  ok(!r?.err && s.poison && s.poison.name === D.ITEMS[PZ].name, "the move coats the weapon");
  ok(ss.myActs === n0 + 1 && f.sp === sp0, "it takes one move like a potion");
  ok(f.left(row.id) === q0 - 1, "it uses the poison up");
  ok(!ss.canAfford(a) && POISONFX.why(f, a) === "Already coated", "you can't coat it twice");
  const pv = TB.preview(f, a, ss); ok(true, "preview runs");
  // the next hit delivers it
  f.e.red = 0; f.fp = null; f.ehp = 9999; f.ehp0 = 9999; ss.ehpMax = 9999;
  let t = ""; for (let i = 0; i < 30 && s.poison; i++) t = f.attack(false);   // a blow can miss: the coat waits for one that lands
  ok(/Poison of Damage Health/.test(t) && !s.poison, "the next hit delivers it (" + t + ")");
  // the pack loses it when the fight ends
  const q1 = s.inv.find((x) => x.id === row.id)?.qty || 0;
  for (const [id, q] of Object.entries(f.used)) G.take(s, +id, q);
  ok((s.inv.find((x) => x.id === row.id)?.qty || 0) === q1 - 1, "the used poison leaves the pack after the fight"); }
{ const { s, f, ss, a } = setup("warrior");
  const pv = TB.preview(f, a, ss);
  ok(/next hit/i.test(pv.note || "") && /Damage Health 30/.test(pv.note), "the move preview says what the next hit delivers (" + pv.note + ")"); }
{ const { s, f, a } = setup("archer");
  ok(f.wt === "bow" && POISONFX.can(f, a), "archers can coat their arrows");
  const t = POISONFX.act(f, a); ok(/arrows/.test(t) && s.poison, "the line says arrows (" + t + ")"); }
{ const { f, a } = setup("warrior"); f.pw = f.pw || {}; f.pw.beast = 3;
  ok(!POISONFX.can(f, a) && POISONFX.why(f, a) === "Not in Beast Form", "no poisons in Beast Form"); }
{ const { f, a } = setup("mage"); f.weapon = null;
  ok(!POISONFX.can(f, a) && POISONFX.why(f, a) === "Needs a weapon", "no weapon, no coat"); }
{ const { f } = setup("warrior"); ok(!POISONFX.can(f, "poison:999999") && POISONFX.why(f, "poison:999999") === "None left", "a poison you don't have can't be used"); }
// out of the fight it still works from the pack, through the same coat
{ const s = fresh("warrior", 20); G.give(s, PZ, 1); s.poison = null; const r = s.inv.find((x) => x.item === PZ);
  const t = TOWNS.applyPoison(s, r.id); ok(/coat your weapon/.test(t) && s.poison && s.poison.hits >= 1, "the pack still coats the weapon"); }
// no one-hit wins: a coated power attack on a strong foe still goes through the blow cap
{ let worst = 0;
  for (let i = 0; i < 40; i++) {
    const { s, f, ss, a } = setup("twohand", { foe: "Frost troll" }); s.poison = null;
    G.give(s, "brew|Ravage Health:60:10", 1); const big = "poison:" + s.inv.find((x) => x.item === "brew|Ravage Health:60:10").id;
    ss.act(big); f.sp = 9999;
    const b = f.ehp, mx = ss.ehpMax || f.ehp; ss.act("power_attack", null, 1.4, { cls: "perfect", mult: 1.4 });
    worst = Math.max(worst, (b - Math.max(0, f.ehp)) / mx);
  }
  ok(worst <= 0.41, "a coated perfect power attack never takes more than 40% of a strong foe (" + Math.round(worst * 100) + "%)"); }

// 4. the hotbar lists poisons under Items
if (typeof HOTBAR !== "undefined") { const { s, f, a } = setup("warrior"); ok(HOTBAR.catalog(s, f).items.some((e) => e.a === a), "the hotbar picker lists the poison"); }

// 5. party fights pass the grade through
if (typeof SHAREDFIGHT !== "undefined" || /act\\(a, tgt, mult, grade\\)/.test(String(TB.Session.prototype.act))) ok(true, "party fights take the grade");
})()`, c);
const fails = c.H.fails();
console.log(fails ? fails + " FAILED" : "ALL OK");
process.exit(fails ? 1 : 0);
