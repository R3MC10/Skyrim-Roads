/* Balance sim for deep expeditions and difficulty tiers (deepdelve.js). Long: skip in quick runs.
   W=/path/to/game/ node test_deepdelve_bal_sim.js [runs]   (named *bal_sim* so CI skips it, like test_bal_sim.js)
   1) The major fight that ends each depth level, by tier, fresh (full health): solo + follower, and a 4-player party
      (foe +35% health per extra member plus the tier's DEEPDELVE.partyFoe growth, three party members fighting beside you,
      as coop.js does it).
      win% / health left% / turns / the worst single turn as % of your health.
   2) Whole expeditions, solo + follower, health and potions carried down, a careful player (rests when hurt, climbs
      out when low): how deep they get, how often they extract or get knocked out, gold brought home.
   Fails only on errors, NaN, one-shots (a turn taking more than 60% of your health) or fights that end too fast
   (a level IV/V major fight won in under 4 turns on average). */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const RUNS = +(process.argv[2] || 40);
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RUNS };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "smithing.js", "social.js", "ammo.js", "tomes.js", "magic.js", "mp.js", "coop.js", "deepdelve.js"])
  if (fs.existsSync(path.join(W, f))) vm.runInContext(fs.readFileSync(path.join(W, f), "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
// realistic characters: the same builder the main balance sim uses (test_bal_sim.js)
const bal = fs.readFileSync(path.join(__dirname, "test_bal_sim.js"), "utf8");
const a = bal.indexOf("const LEVELS"), b = bal.indexOf("const enc = D.ENCOUNTERS");
if (a < 0 || b < 0) { console.log("can't find make() in test_bal_sim.js"); process.exit(1); }
vm.runInContext(bal.slice(a, b), c);
vm.runInContext(`
const DD = DEEPDELVE;
const PLACE = Object.keys(WORLD.places).find((p) => DD.deepable(p) && DUNGEONS.info(p).theme === "barrow") || Object.keys(WORLD.places).find((p) => DD.deepable(p));
const BUILDS = ["warrior", "twohand", "archer", "mage", "spellsword"];
let errs = 0, nan = 0, worstAll = 0;
function setup(build, L, tier) {
  const s = make(build, L); s.perks = s.perks || {};
  s.follower = { id: "lydia", hp: TOWNS.followerMax(s, "lydia"), ts: G.now() };
  s.location = PLACE; [s.x, s.y] = WORLD.places[PLACE];
  if (tier !== "normal") { s.level = Math.max(s.level, 30); DD.pick(s, PLACE, tier); }
  const er = DUNGEONS.enter(s); if (er) throw new Error(er);
  return s;
}
/* one major fight at a depth, fresh */
function major(build, L, tier, depth, party) {
  const s = setup(build, L, tier), d = s.dungeon;
  if (depth) { d.deep = { level: depth, max: depth, inj: 0, curses: [], rations: 2, snap: null }; }
  let e;
  if (depth) e = DD.bossRoom(s, (k, bs) => { const x = G.scaleEnemy({ ...DUNGEONS.ENEMY[k] }, s.level); const m = [0, 0.8, 0.95, 1.1][d.tier]; x.health = Math.round(x.health * m); x.hp = x.health; x.damage = Math.round(x.damage * m * 10) / 10; return DD.scaleFoe(s, x, bs); }).enemy;
  else { const k = DUNGEONS.THEMES[d.theme].boss[2]; e = G.scaleEnemy({ ...DUNGEONS.ENEMY[k] }, s.level); const m = [0, 0.8, 0.95, 1.1][d.tier]; e.health = Math.round(e.health * m); e.damage = Math.round(e.damage * m * 10) / 10; e.hp = e.health; DD.scaleFoe(s, e, true); }
  let allies = [];
  if (party) {
    e.health = Math.round(e.health * (1 + COOP.FOE_BONUS * 3)); e.hp = e.health; if (DD.partyFoe) DD.partyFoe(s, e, 4);
    allies = BUILDS.filter((x) => x !== build).slice(0, 3).map((bb, i) => { const o = make(bb, L); return COOP.allyFromCard({ name: "P" + i, id: "p" + i, cur: G.maxHealth(o), coop: { prof: COOP.profile(o) } }); });
  }
  G.setAllyProvider(() => allies);
  G.setHealth(s, G.maxHealth(s));
  const f = new G.Fight(s, e, null); f.run({ trySneak: false });
  G.setAllyProvider(() => []);
  if (!isFinite(f.hp) || !isFinite(f.ehp)) nan++;
  const mh = G.maxHealth(s); let hp = f.hp0, worst = 0;
  for (const l of f.log) if (l.hp != null) { worst = Math.max(worst, (hp - l.hp) / mh); hp = l.hp; }
  worstAll = Math.max(worstAll, worst);
  return { won: f.won, left: Math.max(0, f.hp) / mh, turns: f.turn, worst };
}
const out = [];
const pct = (x) => Math.round(100 * x);
for (const party of [false, true]) for (const L of [30, 40]) for (const tier of DD.TIER_KEYS) for (let depth = 0; depth <= 5; depth++) {
  let w = 0, left = 0, turns = 0, n = 0, worst = 0;
  for (let i = 0; i < RUNS; i++) for (const build of BUILDS) {
    try { const r = major(build, L, tier, depth, party); n++; if (r.won) { w++; left += r.left; } turns += r.turns; worst = Math.max(worst, r.worst); }
    catch (x) { errs++; if (errs < 4) console.log(build, L, tier, depth, x.stack.split("\\n").slice(0, 3).join(" | ")); }
  }
  out.push({ party, L, tier, depth, win: pct(w / n), left: pct(left / Math.max(1, w)), turns: +(turns / n).toFixed(1), worst: pct(worst) });
}
console.log("1) Major fight at the end of each level (fresh), all builds. win% / health left% / turns / worst turn %");
for (const party of [false, true]) for (const L of [30, 40]) {
  console.log((party ? "4-player party" : "solo + follower") + ", level " + L);
  console.log("  tier       " + [0, 1, 2, 3, 4, 5].map((x) => (x ? "depth " + DD.ROMAN[x] : "top boss").padEnd(19)).join(""));
  for (const tier of DD.TIER_KEYS) console.log("  " + tier.padEnd(10) + " " + out.filter((r) => r.party === party && r.L === L && r.tier === tier).map((r) => (r.win + "% " + r.left + "% " + r.turns + "t " + r.worst + "%").padEnd(19)).join(""));
}

/* 2) whole expeditions, solo + follower */
function expedition(build, L, tier) {
  const s = setup(build, L, tier), g0 = s.gold;
  let g = 0, deepest = 0, how = "left";
  while (s.dungeon && g++ < 400) {
    const d = s.dungeon, hp = G.curHealth(s) / G.maxHealth(s), pots = G.countRestore(s, "health");
    if (!d.room) {
      if (d.done) { DUNGEONS.leave(s); how = d.deep?.level ? "extract" : "top"; break; }
      const ch = DUNGEONS.nextChoices(s), nx = d.rows[d.row + 1];
      const rest = ch.find((i) => nx[i].type === "rest"), safe = ch.find((i) => !["elite", "fight", "trap"].includes(nx[i].type));
      DUNGEONS.enterRoom(s, hp < 0.6 && rest != null ? rest : hp < 0.5 && safe != null ? safe : ch[Math.floor(Math.random() * ch.length)]);
      continue;
    }
    const chs = DUNGEONS.roomChoices(s).map((x) => x[0]);
    let ch = chs[0];
    if (d.room.type === "camp") {
      const L2 = d.deep?.level || 0; deepest = Math.max(deepest, L2);
      if (L2 && hp < 0.7 && chs.includes("camprest") && (d.deep.rations > 0)) ch = "camprest";
      else if (hp < 0.45 && chs.includes("potion")) ch = "potion";
      else if (!chs.includes("descend") || hp < 0.5 || (L2 >= 2 && hp < 0.75 && pots < 2) || (L2 >= 3 && (hp < 0.85 || pots < 2 || d.deep.inj >= 2))) ch = "extract";
      else ch = "descend";
    }
    else if (d.room.enemy && hp < 0.45 && chs.includes("potion")) ch = "potion";
    else if (d.room.type === "trap") ch = chs.includes("dash") ? "dash" : chs[0];
    else if (d.room.type === "puzzle") ch = "set:" + d.room.order;
    else if (d.room.type === "rest") ch = hp < 0.9 ? "rest" : "search";
    else if (d.room.type === "mystery") ch = chs.includes("skip") ? "skip" : chs[chs.length - 1];
    const r = DUNGEONS.act(s, ch);
    if (!isFinite(G.curHealth(s))) nan++;
    if (r.died) { how = r.knockedOut ? "ko" : "died"; break; }
    if (s.dungeon?.deep) deepest = Math.max(deepest, s.dungeon.deep.level);
  }
  return { deepest, how, gold: s.gold - g0 };
}
console.log("\\n2) Whole expeditions, solo + follower, careful player. reached depth avg / extract% / knocked out% / died at the top% / gold home");
for (const L of [30, 40]) for (const tier of DD.TIER_KEYS) {
  let deep = 0, ex = 0, ko = 0, died = 0, gold = 0, n = 0; const hist = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < RUNS; i++) for (const build of BUILDS) {
    try { const r = expedition(build, L, tier); n++; deep += r.deepest; hist[r.deepest]++; if (r.how === "extract" || r.how === "top") ex++; if (r.how === "ko") ko++; if (r.how === "died") died++; gold += Math.max(0, r.gold); }
    catch (x) { errs++; if (errs < 6) console.log("exp", build, L, tier, x.stack.split("\\n").slice(0, 3).join(" | ")); }
  }
  console.log("  L" + L + " " + tier.padEnd(10) + " depth " + (deep / n).toFixed(2) + "  out " + pct(ex / n) + "%  KO " + pct(ko / n) + "%  died " + pct(died / n) + "%  gold " + Math.round(gold / n) + "  reached I..V: " + hist.slice(1).map((x) => pct(x / n) + "%").join(" "));
}
console.log("\\nerrors", errs, "nan", nan, "worst single turn", pct(worstAll) + "% of health");
const fast = out.filter((r) => r.depth >= 4 && r.win > 0 && r.turns < 4);
if (fast.length) console.log("too fast:", JSON.stringify(fast));
globalThis.FAIL = errs > 0 || nan > 0 || worstAll > 0.6 || fast.length > 0;
`, c);
console.log(c.FAIL ? "deepdelve sim FAILED" : "deepdelve sim ok");
process.exit(c.FAIL ? 1 : 0);
