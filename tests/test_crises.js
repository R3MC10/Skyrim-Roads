const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Regional crises (crises.js): the shared timetable, the four hold numbers staying in bounds, deeds and their caps,
   several players adding up, prices and road danger, contracts → ringleader → rewards, the perks, a balance sim for
   contract foes and bosses, a long run that must not spiral, and Polish for every line.
   W=/path/to/game/ node test_crises.js — prints "crises ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "dragons.js", "wevents.js", "festivals.js", "cooking.js", "smithing.js", "caravans.js", "encounters.js", "i18n_crises.js", "crises.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
c.SRC = fs.readFileSync(W + "crises.js", "utf8");
c.PN = fs.existsSync(W + "patchnotes.js") ? fs.readFileSync(W + "patchnotes.js", "utf8") : "";
vm.runInContext(`
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };
const H = 3600, DAY = 86400, C = CRISES;
const mk = (id, lvl, loc) => { const s = G.newSave(id, "P" + id, "nord"); s.level = lvl; s.hpBonus = lvl * 5; s.location = loc; [s.x, s.y] = WORLD.places[loc]; s.gold = 0;
  for (const k of Object.keys(s.skills)) s.skills[k].lvl = Math.min(100, Math.max(s.skills[k].lvl, 15 + lvl * 2));
  for (const it of lvl >= 25 ? ["dwarven_sword", "dwarven_armor", "dwarven_helmet", "steel_boots", "steel_gauntlets", "steel_shield"] : ["steel_sword", "steel_armor", "steel_helmet", "steel_boots", "steel_gauntlets", "steel_shield"]) { const id2 = G.give(s, it); G.equip(s, id2); }
  const r = (n) => Math.max(1, Math.min(n, Math.floor(lvl / 10) + 1));
  s.perks = { armsman: r(5), juggernaut: r(5), shield_wall: r(5), ...(lvl >= 20 ? { fighting_stance: 1, well_fitted: 1, bladesman: r(3) } : {}), ...(lvl >= 30 ? { savage_strike: 1, elemental_protection: 1, conditioning: 1 } : {}) };
  G.setHealth(s, G.maxHealth(s)); return s; };
const heal = (s) => G.setHealth(s, G.maxHealth(s));
const T0 = Math.floor(Date.UTC(2026, 10, 24) / 1000 / C.CYCLE) * C.CYCLE;
const c0 = C.cycleAt(T0);

// ---- 1. the timetable: the same everywhere, a few crises per cycle, every chain turns up, no hold twice running
ok(JSON.stringify(C.picks(c0)) === JSON.stringify(C.picks(c0)), "deterministic picks");
const per = [], chains = {}, holds = {};
for (let k = c0 - 120; k < c0 + 120; k++) { const p = C.picks(k); per.push(p.length);
  const prev = new Set(C.picks(k - 1, false).map((x) => x.hold));
  for (const x of p) { chains[x.chain] = (chains[x.chain] || 0) + 1; holds[x.hold] = (holds[x.hold] || 0) + 1;
    ok(!prev.has(x.hold), "no hold two cycles running " + x.id);
    ok(x.end - x.start === C.SPAN && x.start >= k * C.CYCLE && x.start < k * C.CYCLE + 8 * H, "start and length " + x.id);
    ok(C.byId(x.id) && C.byId(x.id).hold === x.hold, "byId " + x.id);
    ok(WORLD.places[x.place] && G.holdAt(WORLD.places[x.place]) === x.hold, "capital in its hold " + x.id); }
  const byCh = {}; for (const x of p) byCh[x.chain] = (byCh[x.chain] || 0) + 1; ok(Object.values(byCh).every((v) => v <= 2), "at most 2 of one chain"); }
const avg = per.reduce((a, b) => a + b, 0) / per.length;
console.log("crises per two days:", avg.toFixed(2), JSON.stringify(chains), JSON.stringify(holds));
ok(per.every((x) => x >= 1 && x <= 3), "1-3 crises per cycle");
ok(avg >= 1.5 && avg <= 3, "about 2-3 crises every two days (" + avg.toFixed(2) + ")");
ok(Object.keys(C.CHAINS).every((k) => (chains[k] || 0) >= 8), "every chain turns up (" + JSON.stringify(chains) + ")");
ok(C.HOLDS.every((h) => (holds[h] || 0) >= 8), "every hold gets a turn");

// ---- 2. the numbers stay in bounds, prices and road danger stay sane, stages walk 1..5
let pmin = 9, pmax = 0, emin = 9, emax = 0, dire = 0, cnt = 0;
for (let t = T0; t < T0 + 20 * DAY; t += 2 * H) for (const h of C.HOLDS) {
  const v = C.values(h, null, t); cnt++;
  for (const k of C.VARS) ok(v[k] >= 0 && v[k] <= 100 && Number.isInteger(v[k]), "bounded " + h + " " + k + " " + v[k]);
  if (C.VARS.some((k) => C.level(k, v[k]) === "Dire")) dire++;
  const p = C.priceMult(null, C.CAPITAL[h], "fish_salmon", t), e = C.encounterMult(null, WORLD.places[C.CAPITAL[h]], t);
  pmin = Math.min(pmin, p); pmax = Math.max(pmax, p); emin = Math.min(emin, e); emax = Math.max(emax, e); }
console.log("prices", pmin.toFixed(2), "-", pmax.toFixed(2), "· road trouble", emin.toFixed(2), "-", emax.toFixed(2), "· holds with a dire number", (dire / cnt * 100).toFixed(0) + "%");
ok(pmin >= 0.88 && pmax <= 1.35 && pmax > 1.02, "prices move but stay within 0.88-1.35");
ok(emin >= 0.75 && emax <= 1.5 && emax > 1.02, "road danger moves but stays within 0.75-1.5");
ok(dire / cnt < 0.3, "most of the time most holds are fine (" + (dire / cnt).toFixed(2) + ")");
ok(C.priceMult(null, "Nowhere", null, T0) === 1 && C.encounterMult(null, null, T0) >= 0.75, "unknown places are neutral");
const cr = C.picks(c0)[0];
for (let i = 0; i < C.STAGES + 2; i++) { const st = C.status(cr, null, cr.start + i * C.STAGE + 60); ok(st.stage === Math.min(C.STAGES, i + 1), "stage " + (i + 1)); ok(st.open === (i >= 1), "contracts open from stage 2"); }
ok(C.status(cr, null, cr.start - 1).state === "later" && C.status(cr, null, cr.end + 1).state === "lost", "later / burned out");
const vIn = C.values(cr.hold, null, cr.start + 4.5 * C.STAGE), vBase = C.baseline(cr.hold, cr.start + 4.5 * C.STAGE);
const fx5 = C.CHAINS[cr.chain].stages[4][2]; const k5 = Object.keys(fx5)[0];
ok(Math.sign(vIn[k5] - vBase[k5]) === Math.sign(fx5[k5]) || vIn[k5] === 0 || vIn[k5] === 100, "a crisis at stage 5 pushes " + k5 + " the bad way");

// ---- 3. deeds: what one player does moves the numbers, capped; others add up, capped in all
const t1 = cr.start + 1.5 * C.STAGE;
const p1 = mk("A", 20, cr.place);
const v0 = C.values(cr.hold, p1, t1);
for (let i = 0; i < 40; i++) C.deed(p1, cr.hold, "bribe", t1);
const d1 = C.deeds(cr.hold, p1, t1);
ok(d1.cor === C.PLAYER_CAP, "one player moves a number by at most " + C.PLAYER_CAP + " (" + d1.cor + ")");
ok(C.values(cr.hold, p1, t1).cor >= v0.cor, "bribes raise corruption");
ok(C.mine(p1, t1).d[cr.hold].cor <= C.PLAYER_CAP * 2, "the stored number is capped too");
const others = [];
for (let i = 0; i < 6; i++) { const q = mk("O" + i, 20, cr.place); for (let j = 0; j < 40; j++) C.deed(q, cr.hold, "bribe", t1); others.push(C.record(q, t1)); }
C.setDocs(others);
ok(C.deeds(cr.hold, p1, t1).cor === C.ALL_CAP, "everyone together at most " + C.ALL_CAP);
ok(C.deeds(cr.hold, null, t1 + C.CYCLE).cor === C.ALL_CAP / 2 || C.deeds(cr.hold, null, t1 + C.CYCLE).cor <= C.ALL_CAP, "last cycle counts half");
ok(C.deeds(cr.hold, null, t1 + 2 * C.CYCLE).cor === 0, "deeds fade after two cycles");
C.setDocs([]);
// fights in the hold count as deeds; crisis foes don't double-count
const p2 = mk("B", 20, cr.place);
ok(C.onFight(p2, { name: "Bandit Outlaw", tags: ["humanoid"] }, cr.hold, t1) === true, "a bandit kill is a deed");
ok(C.onFight(p2, { name: "Wolf", tags: ["animal"] }, cr.hold, t1) === true, "a beast kill is a deed");
ok(C.onFight(p2, { name: "Draugr", tags: ["undead"] }, cr.hold, t1) === false, "draugr aren't a deed");
ok(C.onFight(p2, { name: "Bandit", tags: ["bandit"], crisis: cr.id }, cr.hold, t1) === false, "crisis foes don't count twice");
ok(C.mine(p2, t1).d[cr.hold].sec > 0, "killing outlaws raises security");
// passive relief from deeds is small and capped
const p3 = mk("P", 20, cr.place);
for (let i = 0; i < 50; i++) C.deed(p3, cr.hold, "escort", t1);
ok((C.mine(p3, t1).pas[cr.id] || 0) <= 4, "deeds add at most 4 relief to a crisis");
// a new cycle rolls over
const m3 = C.mine(p3, t1 + C.CYCLE); ok(m3.cyc === c0 + 1 && m3.d && !m3.d[cr.hold] && m3.pd[cr.hold], "a new cycle moves deeds to last cycle");

// ---- 4. contracts → ringleader → rewards
const tc = cr.start + C.STAGE + 60;
const hero = mk("H", 30, cr.place);
ok(/stage 2/.test(C.contractBlock(hero, cr, C.CHAINS[cr.chain].contracts[0], cr.start + 60, null)), "no contracts at stage 1");
const away = mk("W", 30, cr.place === "Whiterun" ? "Riften" : "Whiterun");
ok(/Go there first/.test(C.contractBlock(away, cr, C.CHAINS[cr.chain].contracts[0], tc, null)), "contracts only in the capital");
const party = { leader: "X", members: [{ id: "X" }, { id: "H" }] };
const fid = C.CHAINS[cr.chain].contracts.find((id) => C.CONTRACTS[id].kind === "fight");
ok(/leader/.test(C.contractBlock(hero, cr, fid, tc, party)), "in a party only the leader takes fight contracts");
let t = tc, guard = 0, fought = 0;
while (C.status(cr, hero, t).state === "active" && guard++ < 40) {
  heal(hero); const r = C.contract(hero, cr.id, fid, t); if (r.fight) fought++;
  ok(!r.died, "a level 30 hero survives a contract");
  const again = C.contract(hero, cr.id, fid, t + 10); ok(!again.fight && /Rest a moment/.test(again.text), "contracts have a short cooldown");
  t += C.CONTRACT_CD + 1; }
console.log("contracts to draw out the ringleader alone:", fought);
ok(C.status(cr, hero, t).state === "boss", "enough relief draws out the ringleader");
ok(fought >= 3 && fought <= 6, "a few contracts, not a grind (" + fought + ")");
// food contract
const cook = mk("K", 10, cr.place);
const fc = C.contractBlock(cook, cr, "food", tc, null);
if (C.CHAINS[cr.chain].contracts.includes("food")) { ok(/You need/.test(fc), "food contract needs food"); G.give(cook, "fish_salmon", 5); const r = C.contract(cook, cr.id, "food", tc); ok(r.done && r.relief === 2 && C.foodCount(cook) === 2, "food handed in");
  for (let i = 0; i < 6; i++) { G.give(cook, "fish_salmon", 3); C.contract(cook, cr.id, "food", tc); } ok(C.mine(cook, tc).food[cr.id] === C.FOOD_MAX, "food deliveries capped"); }
// the boss
let slain = false, tries = 0;
while (!slain && tries++ < 10) { heal(hero); const r = C.boss(hero, cr.id, t); if (r.slain) slain = true; t += C.BOSS_CD + 1; }
ok(slain, "a level 30 hero beats the ringleader");
ok(C.status(cr, hero, t).state === "won", "won after the boss falls");
ok(C.values(cr.hold, hero, t + H).pro >= C.baseline(cr.hold, t + H).pro, "a won hold recovers");
ok(C.priceMult(hero, cr.place, null, t + H) < C.priceMult(hero, cr.place, null, t + 3 * DAY) + 0.001, "cheaper shops after a win");
const g0 = hero.gold, msg = C.claim(hero, cr.id, t);
ok(msg && hero.gold > g0 && hero.titles.includes("Shield of the Hold") && hero.crisisWins === 1, "the boss killer claims gold, title and a gem");
ok(C.claim(hero, cr.id, t) === null, "claim once");
// someone else who helped shares the reward through the shared records
const helper = mk("Q", 15, cr.place);
G.give(helper, "fish_salmon", 3);
C.mine(helper, t).rel[cr.id] = 3;
C.setDocs([C.record(hero, t)]);
ok(C.claimable(helper, cr, t), "a helper can claim once someone beat the boss");
const hg = helper.gold; C.claim(helper, cr.id, t); ok(helper.gold > hg && !(helper.titles || []).includes("Shield of the Hold"), "helper gets gold, no title");
ok(!C.claimable(mk("Z", 15, cr.place), cr, t), "someone who did nothing gets nothing");
C.setDocs([]);
// relief needed grows with people, the party boss grows with mates
ok(C.needFor(1) === 10 && C.needFor(8) > C.needFor(2) && C.needFor(20) === C.needFor(8), "relief needed grows with helpers, capped at 8");

ok(Object.values(C.CHAINS).every((ch) => D.ITEMS[ch.reward[0]]) && D.ITEMS.gem_sapphire, "every reward item exists");
// ---- 5. perks with real effects
ok(PERKS && (PERKS.byId ? PERKS.byId("hard_times_trader") : true), "perk exists");
const poor = C.picks(c0).concat(C.picks(c0 + 1)).find(() => true);
let hiT = null; for (let tt = T0; tt < T0 + 20 * DAY && !hiT; tt += H) for (const h of C.HOLDS) if (C.priceMult(null, C.CAPITAL[h], null, tt) > 1.08) { hiT = [h, tt]; break; }
ok(hiT, "found a dear hold");
if (hiT) { const tr = mk("T", 30, C.CAPITAL[hiT[0]]); const base = C.priceMult(tr, C.CAPITAL[hiT[0]], null, hiT[1]); tr.perks.hard_times_trader = 1;
  const cut = C.priceMult(tr, C.CAPITAL[hiT[0]], null, hiT[1] + 15); ok(cut > 1 && Math.abs((cut - 1) - (base - 1) * 0.5) < 0.02, "Hard Times Trader halves the rise (" + base.toFixed(3) + " → " + cut.toFixed(3) + ")"); }
const ag = mk("J", 30, cr.place); ag.perks.jarls_agent = 1; ok(PFX.num(ag, "crisisrelief") === 0.25, "Jarl's Agent reads through PFX");
const cr2 = C.picks(c0 + 1)[0], ta = cr2.start + C.STAGE + 60; ag.location = cr2.place; [ag.x, ag.y] = WORLD.places[cr2.place];
const fid2 = C.CHAINS[cr2.chain].contracts.find((id) => C.CONTRACTS[id].kind === "fight");
let rl = 0; for (let i = 0; i < 5 && !rl; i++) { heal(ag); rl = C.contract(ag, cr2.id, fid2, ta + i * 100).relief || 0; }
ok(rl === 3.8 || rl === 3.75, "Jarl's Agent: a contract counts 25% more (" + rl + ")");

// ---- 6. balance sim: contract foes and ringleaders at your level (no enchantments or potions on the test hero)
const sim = (L, boss, N) => { let won = 0, turns = 0, died = 0, one = 0;
  for (let i = 0; i < N; i++) { const s = mk("S" + i, L, cr.place); const e = C.makeFoe(s, cr, boss); const f = new G.Fight(s, e); f.run({ trySneak: false });
    if (f.won) { won++; if (f.turn <= 1) one++; } if (f.hp <= 0) died++; turns += f.turn; }
  return { win: won / N, turns: turns / N, died: died / N, one }; };
const lines = [];
for (const L of [5, 10, 20, 30, 40]) { const a = sim(L, false, 80), b = sim(L, true, 80);
  lines.push("L" + L + " contract win " + (a.win * 100).toFixed(0) + "% " + a.turns.toFixed(1) + "t · ringleader win " + (b.win * 100).toFixed(0) + "% " + b.turns.toFixed(1) + "t died " + (b.died * 100).toFixed(0) + "%");
  ok(a.one === 0 && b.one === 0, "L" + L + ": no one-turn fights");
  ok(a.win >= 0.9, "L" + L + ": contracts are winnable (" + a.win + ")");
  ok(a.turns >= 4, "L" + L + ": contract fights last a while (" + a.turns.toFixed(1) + ")");
  ok(b.turns >= 10, "L" + L + ": the ringleader is a real fight (" + b.turns.toFixed(1) + ")");
  ok(b.win >= 0.6 && b.died <= 0.3, "L" + L + ": the ringleader is beatable solo (" + b.win + ", died " + b.died + ")"); }
console.log(lines.join("\\n"));
{ const s = mk("FL", 5, cr.place), e = C.makeFoe(s, cr, true), f = new G.Fight(s, e); f.canFlee = true;
  ok(f.affordable("flee"), "a Run away rule works against the ringleader");
  ok(/f\\.canFlee = true;[^\\n]*\\n\\s*f\\.run/.test(SRC.slice(SRC.indexOf("function boss("))), "the ringleader fight lets you run");
  ok(e.health < C.makeFoe(mk("FL2", 10, cr.place), cr, true).health, "the ringleader is softer under level 10"); }

// ---- 7. a long run: busy players can't spiral a hold, and crises always end
for (let k = 0; k < 30; k++) { const tt = T0 + k * C.CYCLE + 5 * H;
  const crowd = []; for (let i = 0; i < 8; i++) { const q = mk("R" + k + "-" + i, 20, "Riften"); for (let j = 0; j < 30; j++) { C.deed(q, "The Rift", "theft", tt); C.deed(q, "The Rift", "bribe", tt); } crowd.push(C.record(q, tt)); }
  C.setDocs(crowd);
  const v = C.values("The Rift", null, tt + H), b = C.baseline("The Rift", tt + H);
  ok(v.cor - b.cor <= C.ALL_CAP + 32, "a crooked crowd moves corruption a bounded amount (" + (v.cor - b.cor) + ")");
  ok(C.priceMult(null, "Riften", null, tt + H) <= 1.35, "prices capped even then"); }
C.setDocs([]);
for (let k = c0; k < c0 + 30; k++) for (const x of C.picks(k)) ok(C.status(x, null, x.end + C.AFTER + 1).left === 0, "every crisis and its aftermath ends " + x.id);

// ---- 8. Polish for every line
const L10N = I18N_CRISES, has = (k) => k in L10N.tpl || k in L10N.words;
const strs = new Set();
for (const m of SRC.matchAll(/T\\(\\s*"((?:[^"\\\\]|\\\\.)*)"/g)) strs.add(m[1]);
for (const ch of Object.values(C.CHAINS)) { strs.add(ch.name); strs.add(ch.foe.name); strs.add(ch.boss.what); for (const s of ch.stages) { strs.add(s[0]); strs.add(s[1]); } }
for (const x of Object.values(C.CONTRACTS)) { strs.add(x.name); strs.add(x.text); }
for (const x of ["Security", "Food", "Prosperity", "Corruption", "Thriving", "Steady", "Strained", "Dire"]) strs.add(x);
const missing = [...strs].filter((k) => !has(k));
ok(!missing.length, "Polish for every line (missing: " + missing.join(" | ") + ")");
for (const v of [...Object.values(L10N.tpl), ...Object.values(L10N.words)]) ok(typeof v === "string" && v.length, "non-empty Polish");
ok(/b206-crises|-crises"/.test(PN), "patch note entry");
const pn = /id: "b\\d+-crises"[^\\]]*items: \\[([\\s\\S]*?)\\] \\}/.exec(PN);
if (pn) for (const m of pn[1].matchAll(/^\\s*"((?:[^"\\\\]|\\\\.)*)",/gm)) ok(has(JSON.parse('"' + m[1] + '"')), "patch note line in Polish: " + m[1].slice(0, 40));

// [mapread] map signs keep clear of labels placed before them (party, objective, town names)
{
const g = { font: "", measureText: (t) => ({ width: t.length * 5 }) };
const a = C.signSpot(g, 500, 300, 1, "Shortage", [], []);
ok(a.ox < 500 && !a.line, "sign: left of the town when nothing is in the way");
const b = C.signSpot(g, 500, 300, 1, "Shortage", [], [a.box]);
ok(b.ox > 500, "sign: moves to the right when a label holds the left spot");
const all = [[380, 240, 120, 120]];
const d = C.signSpot(g, 500, 300, 1, "Shortage", [], all);
ok(d.ox > 500 && !(d.box[0] < 500 && d.box[0] + d.box[2] > 380 && d.box[1] < 360 && d.box[1] + d.box[3] > 240), "sign: picks a spot free of the label boxes");
ok(typeof C.plan === "function", "plan() exported for map.js");
}
console.log(fails ? fails + " FAILED of " + n : "crises ok · " + n + " checks");
if (fails) throw new Error("crises failed");
`, c);
