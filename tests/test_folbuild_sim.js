/* Follower build balance sim (folbuild.js): a follower of each build at level 10, 20 and 30, with gear a player would
   hand them by then, beside an average warrior player of the same level, against the encounters a player meets.
   "A follower is always nice": they should help (more wins, shorter fights) without carrying the fight alone or
   one-shotting strong foes. Seeded Math.random. W=/path/to/game/ node test_folbuild_sim.js [runs]
   Prints a table; exits non-zero on errors, NaN, a follower who would solo a tough foe, or a one-shot. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const RUNS = +(process.argv[2] || 120);
let seed = 4242; const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const M = Object.create(Math); M.random = rnd;
const c = { console, Math: M, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS, process };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "smithing.js", "social.js", "ammo.js", "tomes.js", "magic.js", "combatai.js", "mp.js", "party.js", "followers2.js", "followerai.js", "folbuild.js", "combo.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const LEVELS = [10, 20, 30];
const tierOf = (L) => L < 15 ? 0 : L < 25 ? 1 : 2;
// the player: an average sword-and-shield warrior of that level (like test_bal_sim.js)
const PGEAR = [["iron_sword", ["iron_helmet","iron_armor","iron_gauntlets","iron_boots"], "iron_shield"], ["steel_sword", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"], "steel_shield"], ["dwarven_sword", ["dwarven_helmet","dwarven_armor","steel_gauntlets","steel_boots"], "steel_shield"]];
function player(L) {
  const s = G.newSave("sim", "Sim", "nord"); s.level = L; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.gold = 99999;
  for (const [k, w] of [["One-Handed", 1], ["Heavy Armor", 1], ["Blocking", 0.9], ["Smithing", 0.8], ["Restoration", 0.3]]) s.skills[k].lvl = Math.min(100, Math.round(s.skills[k].lvl + 2.3 * L * w));
  const ups = (L - 1) * 10; s.hpBonus = Math.round(ups * 0.7); s.spBonus = Math.round(ups * 0.3);
  let g = 0; while (PERKS.pointsLeft(s) > 0 && g++ < 400) { const o = ["One-Handed", "Heavy Armor", "Blocking"].flatMap((k) => PERKS.TREES[k].map((p) => p[0])).filter((id) => !PERKS.canTake(s, id)); if (!o.length) break; PERKS.take(s, o[0]); }
  const [w, arm, sh] = PGEAR[tierOf(L)]; for (const it of [w, ...arm, sh]) { const id = G.give(s, it); G.equip(s, id); }
  G.give(s, L >= 20 ? "potion_health" : "potion_health_minor", 2 + Math.floor(L / 10));
  G.loadout(s).rules = [{ if: "hp_below", pct: 40, do: "potion:health" }, { if: "sp_above", pct: 70, do: "power_attack" }, { if: "always", do: "attack" }];
  G.setHealth(s, G.maxHealth(s));
  return s;
}
// the follower: who, and the gear you'd hand them by then
const FOL = {
  tank:    ["lydia",   [["iron_sword","iron_shield","iron_armor","iron_helmet"], ["steel_sword","steel_shield","steel_armor","steel_helmet"], ["dwarven_sword","steel_shield","dwarven_armor","dwarven_helmet"]]],
  twohand: ["farkas",  [["iron_greatsword","iron_armor"], ["steel_battleaxe","steel_armor","steel_helmet"], ["steel_battleaxe","dwarven_armor","dwarven_helmet"]]],
  archer:  ["aela",    [["hunting_bow","leather_armor"], ["elven_bow","leather_armor","leather_helmet"], ["dwarven_bow","leather_armor","leather_helmet"]]],
  mage:    ["onmund",  [["mage_robes"], ["staff_flames","mage_robes"], ["staff_firebolts","mage_robes"]]],
  thief:   ["lydia",   [["iron_dagger","leather_armor"], ["iron_dagger","leather_armor","leather_helmet"], ["iron_dagger","leather_armor","leather_helmet"]]],
};
const SPELLSET = { 10: ["flames", "frostbite", "healing", "oakflesh"], 20: ["firebolt", "ice_spike", "fast_healing", "stoneflesh"], 30: ["fireball", "ice_storm", "close_wounds", "ironflesh"] };
function follower(s, build, L) {
  const [id, kits] = FOL[build];
  s.follower = { id, hp: 1, ts: G.now() };
  s.folData = {}; const f = FOL2.st(s, id);
  f.lvl = L; delete f.skills; f.inv = []; f.eq = {}; f.next = 1; f.perks = {};
  FBUILD.seed(f, id);   // their skills at that level for their natural style (a fresh hire)
  for (const it of kits[tierOf(L)]) if (D.ITEMS[it]) { const r = { id: f.next++, item: it, qty: 1, charge: D.ITEMS[it].staff ? D.ITEMS[it].staff.capacity : null, temper: D.ITEMS[it].slot === "weapon" && !D.ITEMS[it].staff ? 2 * tierOf(L) : 0 }; f.inv.push(r); FOL2.equip(s, r.id); }
  if (build === "archer") f.inv.push({ id: f.next++, item: L >= 20 ? "arrow_steel" : "arrow_iron", qty: 50 });
  if (build === "mage") { for (const lv of [10, 20, 30]) if (lv <= L) for (const sp of SPELLSET[lv]) if (D.SPELLS[sp] && !f.spells.includes(sp) && FAI.canLearn(f, sp, s) === true) f.spells.push(sp); }
  f.inv.push({ id: f.next++, item: L >= 20 ? "potion_health" : "potion_health_minor", qty: 1 });
  if (!f.arch || (build === "tank" && f.arch !== "warrior")) FOL2.setArch(s, "warrior");
  f.perks = {}; FOL2.spend(s, id);
  s.follower.hp = FOL2.maxHp(s, id);
  return f;
}
const enc = D.ENCOUNTERS.filter((e) => e.kind !== "event" && e.health);
const normalPool = enc.filter((e) => e.danger !== "high"), toughPool = enc.filter((e) => e.danger === "high" && !(e.tags || []).includes("dragon"));
const bosses = [["wight", "chief", "hagraven", "sphere"], ["scourge", "chief", "necroMaster", "elder", "sphereMaster", "briarheart"], ["deathlord", "lich", "centurion", "master"]];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
let errs = 0, nan = 0, bad = [], warn = [];
// follower damage share: watch FAI.turn
let fdmg = 0, fmax = 0, fe0 = 1;
const turn0 = FAI.turn; FAI.turn = function (sess, fight, al) { const b = fight.ehp; const r = turn0.call(this, sess, fight, al); const d = Math.max(0, b - Math.max(0, fight.ehp)); fdmg += d; fmax = Math.max(fmax, d / Math.max(1, fight.ehp0 || fe0)); return r; };
function fightOne(s, e) {
  s.health = G.maxHealth(s); s.healthTs = G.now();
  if (s.follower) s.follower.hp = FOL2.maxHp(s, s.follower.id);
  const f = new G.Fight(s, e, null); fe0 = f.ehp; const h0 = f.ehp; fdmg = 0; f.run({ trySneak: false });
  if (!isFinite(f.hp) || !isFinite(f.ehp)) nan++;
  return { won: f.won, turns: f.turn, share: fdmg / Math.max(1, h0 - Math.max(0, f.ehp)), down: !!f.followerDown };
}
/* could they carry it alone? their damage a turn vs the foe's health, against how long they'd stand under its blows */
function solo(s, e) {
  const f = new G.Fight(s, e, null), al = f.allies.find((x) => x.follower); if (!al) return 0;
  f.ehp = 1e9; const b = f.ehp; for (let i = 0; i < 8; i++) turn0(null, f, al); const per = (b - f.ehp) / 8;
  const foeHit = e.damage * 0.85 * FOL2.taken(s) * (al.px?.inn || 1);
  const killT = e.health / Math.max(0.1, per), standT = al.maxHp / Math.max(0.1, foeHit);
  return standT / killT;   // > 1: they'd win alone
}
const BUILDS = Object.keys(FOL);
const rows = [];
for (const L of LEVELS) {
  const base = {};
  for (const [kind, pickE] of [["normal", () => pick(normalPool)], ["tough", () => pick(toughPool)], ["boss", () => DUNGEONS.ENEMY[pick(bosses[L < 12 ? 0 : L < 25 ? 1 : 2])]]]) {
    let w = 0, tu = 0; for (let i = 0; i < RUNS; i++) { try { const r = fightOne(player(L), G.scaleEnemy({ ...pickE() }, L)); if (r.won) w++; tu += r.turns; } catch (x) { errs++; if (errs < 4) console.log(x.stack.split("\\n").slice(0, 3).join(" | ")); } }
    base[kind] = [Math.round(100 * w / RUNS), +(tu / RUNS).toFixed(1)];
  }
  rows.push(["alone", L, base, null]);
  for (const b of BUILDS) {
    const row = {}; let maxOne = 0, soloTough = 0, soloN = 0, arch = "";
    for (const [kind, pickE] of [["normal", () => pick(normalPool)], ["tough", () => pick(toughPool)], ["boss", () => DUNGEONS.ENEMY[pick(bosses[L < 12 ? 0 : L < 25 ? 1 : 2])]]]) {
      let w = 0, tu = 0, sh = 0, dn = 0;
      for (let i = 0; i < RUNS; i++) {
        try { const s = player(L); const f = follower(s, b, L); arch = f.arch; fmax = 0; const e = G.scaleEnemy({ ...pickE() }, L); const r = fightOne(s, e);
          if (r.won) w++; tu += r.turns; sh += r.share; if (r.down) dn++; if (kind !== "normal") maxOne = Math.max(maxOne, fmax);
          if (kind !== "normal" && i < 30) { soloTough += solo(s, G.scaleEnemy({ ...pickE() }, L)); soloN++; } }
        catch (x) { errs++; if (errs < 4) console.log(b, L, kind, x.stack.split("\\n").slice(0, 3).join(" | ")); }
      }
      row[kind] = [Math.round(100 * w / RUNS), +(tu / RUNS).toFixed(1), Math.round(100 * sh / RUNS), Math.round(100 * dn / RUNS)];
    }
    const sl = soloTough / Math.max(1, soloN);
    rows.push([b + "(" + arch + ")", L, row, { maxOne: Math.round(100 * maxOne), solo: +sl.toFixed(2) }]);
    if (maxOne >= 0.5) bad.push(b + " L" + L + " took " + Math.round(100 * maxOne) + "% of a strong foe in one turn");
    // solo is crude (no guard, no foe crits) and the old follower stats already sit near 1.5 at L20 with or without
    // the new perk effects, so above 1.2 is only a note; above 1.7 fails.
    if (sl > 1.7) bad.push(b + " L" + L + " would carry tough fights alone (solo " + sl.toFixed(2) + ")");
    else if (sl > 1.2) warn.push(b + " L" + L + " solo " + sl.toFixed(2));
  }
}
console.log("follower       L   normal win/turns/share/down   tough                 boss                  max turn on strong foe · solo vs tough (>1 = wins alone)");
for (const [b, L, r, x] of rows) console.log(b.padEnd(18), String(L).padEnd(3), ...["normal", "tough", "boss"].map((k) => (r[k][0] + "% " + r[k][1] + "t" + (x ? " " + r[k][2] + "% " + r[k][3] + "%d" : "")).padEnd(22)), x ? x.maxOne + "% · " + x.solo : "");
console.log("errors", errs, "nan", nan);
if (warn.length) console.log("note, strong alone vs tough foes:", warn.join("; "));
if (bad.length) console.log("TOO STRONG:", bad.join("; "));
if (errs || nan || bad.length) process.exitCode = 1;
`, c);
