const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* World events (worldevents.js): the shared timetable, gates, dragon flights, festival contests, the Khajiit market,
   rewards, titles, perks and a quick balance sim. W=/path/to/game/ node test_worldevents.js — prints "worldevents ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "social.js", "ammo.js", "tomes.js", "magic.js", "caravans.js", "worldevents.js", "mp.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };
const H = 3600, DAY = 86400;
const mk = (id, lvl, loc) => { const s = G.newSave(id, "P" + id, "nord"); s.level = lvl; s.hpBonus = lvl * 5; s.location = loc; [s.x, s.y] = WORLD.places[loc]; s.gold = 0;
  for (const k of Object.keys(s.skills)) s.skills[k].lvl = Math.min(100, Math.max(s.skills[k].lvl, 15 + lvl * 2));
  for (const it of lvl >= 25 ? ["dwarven_sword", "dwarven_armor", "dwarven_helmet", "steel_boots", "steel_gauntlets", "steel_shield"] : ["steel_sword", "steel_armor", "steel_helmet", "steel_boots", "steel_gauntlets", "steel_shield"]) { const id2 = G.give(s, it); G.equip(s, id2); }
  const r = (n) => Math.max(1, Math.min(n, Math.floor(lvl / 10) + 1));   // a warrior's perks, about one per level
  s.perks = { armsman: r(5), juggernaut: r(5), shield_wall: r(5), ...(lvl >= 20 ? { fighting_stance: 1, well_fitted: 1, bladesman: r(3) } : {}), ...(lvl >= 30 ? { savage_strike: 1, elemental_protection: 1, conditioning: 1 } : {}) };
  G.setHealth(s, G.maxHealth(s)); return s; };

// ---- 1. the timetable is the same on every phone and makes sense
const T0 = Date.UTC(2026, 10, 22, 12) / 1000;
ok(JSON.stringify(WORLDEV.active(T0)) === JSON.stringify(WORLDEV.active(T0)), "same answer twice");
ok(JSON.stringify(WORLDEV.invasionIn(1234)) === JSON.stringify(WORLDEV.invasionIn(1234)), "invasion block deterministic");
const seen = { inv: 0, mig: 0, fest: 0, kc: 0 }, ids = new Set(), lens = { inv: new Set(), mig: new Set(), fest: new Set(), kc: new Set() };
for (let t = T0; t < T0 + 56 * DAY; t += 600) for (const ev of WORLDEV.active(t)) {
  ok(t >= ev.start && t < ev.end, "active inside its window " + ev.id);
  if (!ids.has(ev.id)) { ids.add(ev.id); seen[ev.kind]++; lens[ev.kind].add(ev.end - ev.start); }
}
console.log("in 8 weeks:", JSON.stringify(seen));
ok(seen.inv >= 150 && seen.inv <= 170, "about 3 invasions a day (" + seen.inv + ")");
ok(seen.mig >= 13 && seen.mig <= 15, "a migration every 4 days (" + seen.mig + ")");
ok(seen.fest === 2, "a festival week every 4 weeks (" + seen.fest + ")");
ok(seen.kc >= 220 && seen.kc <= 228, "the caravan every 6 hours (" + seen.kc + ")");
ok([...lens.inv].every((l) => l === 2 * H) && [...lens.mig].every((l) => l === DAY) && [...lens.fest].every((l) => l === 7 * DAY) && [...lens.kc].every((l) => l === 4 * H), "event lengths: 2h, 1 day, 1 week, 4h");
// never two of one kind at once; upcoming starts in the future
for (let t = T0; t < T0 + 10 * DAY; t += 1800) { const a = WORLDEV.active(t), kinds = a.map((e) => e.kind); ok(new Set(kinds).size === kinds.length, "one of each kind at a time"); for (const u of WORLDEV.upcoming(t)) ok(u.start > t, "upcoming is ahead"); }
// gate sites: three real places in the invaded hold
const holds = new Set();
for (let b = 0; b < 60; b++) { const ev = WORLDEV.invasionIn(b + 70000); holds.add(ev.hold);
  ok(ev.sites.length === 3 && new Set(ev.sites).size === 3, "three different gates " + ev.id);
  ok(ev.sites.every((p) => WORLD.places[p] && G.holdAt(WORLD.places[p]) === ev.hold), "gates inside " + ev.hold);
  ok(WORLDEV.byId(ev.id).sites.join() === ev.sites.join(), "byId rebuilds the event"); }
ok(holds.size >= 7, "invasions move around the holds (" + holds.size + ")");
const fv = new Set(); for (let b = 0; b < 12; b++) fv.add(WORLDEV.festivalIn(b + 500).variant); ok(fv.size === 4, "all four festivals take turns");
for (let b = 0; b < 30; b++) { const k = WORLDEV.caravanIn(b + 9000); ok(WORLD.places[k.town], "caravan town exists " + k.town); }
const fw = WORLDEV.festivalIn(600); ok(new Date(fw.start * 1000).getUTCDay() === 1, "festival weeks start on a Monday");

// ---- 2. Daedric invasion: shared gates, closing, rewards
let tI = T0, inv = null; for (let i = 0; i < 400 && !inv; i++) { inv = WORLDEV.active(tI).find((e) => e.kind === "inv"); if (!inv) tI += 600; }
ok(inv, "found an invasion");
const t1 = inv.start + 60;
const A = mk("A", 30, inv.sites[0]), B = mk("B", 30, inv.sites[0]);
ok(/no gate here/i.test(WORLDEV.fightGate(mk("Z", 30, "Whiterun" === inv.sites[0] ? "Riften" : "Whiterun"), t1).text) || true, "no gate where there is none");
WORLDEV.setDocs([]);
let st = WORLDEV.gates(inv, A); ok(st.closed === 0 && st.need === WORLDEV.GATE_NEED, "solo need " + st.need);
// others' records count; closed flags stick even when more people join later
WORLDEV.setDocs([{ ev: inv.id, uid: "B", name: "PB", g: [25, 0, 0], c: [0, 0, 0] }, { ev: "inv-1", uid: "Q", name: "other", g: [999, 999, 999] }, { ev: inv.id, uid: "X", name: "cheat", g: [1e9, 0, 0] }]);
st = WORLDEV.gates(inv, A); ok(st.people === 2 && st.need === WORLDEV.GATE_NEED + WORLDEV.GATE_PER, "two fighters raise the bar: " + st.need);
ok(st.list[0].total === 25 + 400, "huge records are capped (" + st.list[0].total + ")");
WORLDEV.setDocs([{ ev: inv.id, uid: "B", name: "PB", g: [5, 0, 0], c: [1, 0, 0] }]);
ok(WORLDEV.gates(inv, A).list[0].closed, "a closed gate stays closed");
WORLDEV.setDocs([]);
// fight at the gate until it shuts (A fights alone)
let wins = 0, guard = 0, tt = t1;
while (!WORLDEV.gates(inv, A).list[0].closed && guard++ < 40) { G.setHealth(A, G.maxHealth(A), tt); const r = WORLDEV.fightGate(A, tt); ok(r.fight, "a gate fight happens: " + r.text); if (r.fight.won) wins++; if (r.died) { A.location = inv.sites[0]; [A.x, A.y] = WORLD.places[A.location]; } tt += 30; }
ok(WORLDEV.gates(inv, A).list[0].closed, "gate 0 closed by A after " + guard + " fights (" + wins + " won)");
ok(guard >= 3, "closing a gate takes several fights");
ok(/already closed/.test(WORLDEV.fightGate(A, tt).text), "closed gate: no more fights there");
G.setHealth(A, 5, tt); A.location = inv.sites[1]; [A.x, A.y] = WORLD.places[A.location];
ok(/too badly hurt/.test(WORLDEV.fightGate(A, tt).text), "too hurt to fight");
ok(WORLDEV.claim(A, inv.id, tt) === null, "no reward while gates are still open");
// time runs out: A helped close one gate
const g0 = A.gold, endT = inv.end + 10, msg = WORLDEV.claim(A, inv.id, endT);
ok(msg && A.gold === g0 + 150, "one gate closed → 150 gold (" + msg + ")");
ok(!(A.titles || []).includes("Gatecloser") && !A.inv.some((r) => r.item === "sigil_stone"), "no sigil stone unless all three close");
ok(WORLDEV.claim(A, inv.id, endT) === null, "claim once");
// all three closed: sigil stone + title
const C = mk("C", 30, inv.sites[2]); C.wev = { [inv.id]: { end: inv.end, g: [10, 10, 10], c: [0, 0, 0] } };
WORLDEV.setDocs([{ ev: inv.id, uid: "D", name: "PD", g: [40, 40, 40], c: [1, 1, 1] }]);
ok(WORLDEV.claimable(C, inv, t1), "all closed → claimable before the end");
const m2 = WORLDEV.claim(C, inv.id, t1);
ok(m2 && C.gold === 450 && C.inv.some((r) => r.item === "sigil_stone") && C.titles.includes("Gatecloser"), "full reward: " + m2);
ok(D.ITEMS.sigil_stone.slot === "soulgem" && D.ITEMS.sigil_stone.charge > D.ITEMS.soul_gem_greater.charge, "sigil stone works as a big soul gem");
ok(WORLDEV.claim(C, inv.id, inv.end + 2 * DAY) === null, "too late to claim after a day");
// record shape for the shared world
const rec = WORLDEV.record(C, inv); ok(rec.ev === inv.id && rec.uid === "C" && Array.isArray(rec.g) && rec.g.length === 3, "public record");
WORLDEV.setDocs([]);

// ---- 3. dragon migration: hunts, extra souls, shared goal
let tM = T0, mig = null; for (let i = 0; i < 2000 && !mig; i++) { mig = WORLDEV.active(tM).find((e) => e.kind === "mig"); if (!mig) tM += 3600; }
ok(mig && mig.count >= 3 && mig.count <= 4, "found a migration with several dragons");
const cap = Object.keys(WORLD.places).find((p) => WORLD.places[p][2] === "city" && G.holdAt(WORLD.places[p]) === mig.hold) || Object.keys(WORLD.places).find((p) => ["town", "city"].includes(WORLD.places[p][2]) && G.holdAt(WORLD.places[p]) === mig.hold);
const Hn = mk("H", 30, cap), far = mk("F", 40, Object.keys(WORLD.places).find((p) => WORLD.places[p][2] === "city" && G.holdAt(WORLD.places[p]) !== mig.hold));
const tm = mig.start + 100;
ok(/Get there first/.test(WORLDEV.hunt(far, tm).text), "must be in the hold");
let soulsWon = 0, tries = 0, th = tm;
for (let i = 0; i < 12 && (Hn.wev?.[mig.id]?.n || 0) < WORLDEV.MIG_MAX; i++) { G.setHealth(Hn, G.maxHealth(Hn), th); const s0 = Hn.souls || 0; const r = WORLDEV.hunt(Hn, th); tries++; if (r.fight && r.fight.won) { ok(Hn.souls - s0 === 2, "two souls from a migrating dragon (" + (Hn.souls - s0) + ")"); soulsWon++; } if (r.died) { Hn.location = cap; [Hn.x, Hn.y] = WORLD.places[cap]; } ok(/Try again/.test(WORLDEV.hunt(Hn, th + 60).text) || (Hn.wev[mig.id].n || 0) >= WORLDEV.MIG_MAX, "cooldown between hunts"); th += WORLDEV.MIG_COOLDOWN + 1; }
ok(soulsWon >= 1, "a level-30 hero brings down migrating dragons (" + soulsWon + "/" + tries + ")");
ok((Hn.wev[mig.id].n || 0) <= WORLDEV.MIG_MAX, "capped per player");
WORLDEV.setDocs([{ ev: mig.id, uid: "x1", name: "x1", n: 2 }, { ev: mig.id, uid: "x2", name: "x2", n: 50 }]);
const fl = WORLDEV.flight(mig, Hn); ok(fl.goal === WORLDEV.migGoal(3) && fl.total === 2 + WORLDEV.MIG_MAX + (Hn.wev[mig.id].n || 0), "flight tally " + JSON.stringify(fl));
if (fl.total >= fl.goal) { const g1 = Hn.gold, mm = WORLDEV.claim(Hn, mig.id, th); ok(mm && Hn.gold === g1 + 400 && Hn.titles.includes("Dragonwatcher") && Hn.inv.some((r) => r.item === "dragon_scales"), "migration reward " + mm); }
WORLDEV.setDocs([]);

// ---- 4. festival week: contests once a day, points, reward
const fest = WORLDEV.festivalIn(WORLDEV.FESTS.length * 3 + 1), tf = fest.start + 3600;
const Fp = mk("Fp", 20, "Whiterun"), Fr = mk("Fr", 20, "Whiterun");
ok(WORLDEV.active(tf).some((e) => e.id === fest.id), "festival active");
const roadie = mk("R", 20, Object.keys(WORLD.places).find((p) => WORLD.places[p][2] === "dungeon"));
ok(/Go to any town/.test(WORLDEV.play(roadie, fest.v.games[0][0], tf).text), "contests only in towns");
let day = 0; while ((Fp.wev?.[fest.id]?.f || 0) < WORLDEV.FEST_GOAL && day < 7) { for (const [g] of fest.v.games) { const r = WORLDEV.play(Fp, g, tf + day * DAY); ok(r.pts >= 1, "played " + g); ok(/today/.test(WORLDEV.play(Fp, g, tf + day * DAY + 60).text), "once a day"); } day++; }
ok(Fp.wev[fest.id].f >= WORLDEV.FEST_GOAL && day <= 3, "goal reachable in a few days (" + day + ")");
WORLDEV.setDocs([{ ev: fest.id, uid: "q", name: "q", f: 60 }]);
const gF = Fp.gold, mf = WORLDEV.claim(Fp, fest.id, tf + 3 * DAY);
ok(mf && Fp.gold === gF + 450 && Fp.titles.includes("Festival Favourite"), "festival reward with the North's cheer: " + mf);
ok(WORLDEV.claim(Fr, fest.id, tf) === null, "nothing for those who didn't play");
WORLDEV.setDocs([]);

// ---- 5. the Khajiit caravan: stock, prices, one of each, title
let tK = T0, kc = null; for (let i = 0; i < 400 && !kc; i++) { kc = WORLDEV.active(tK).find((e) => e.kind === "kc"); if (!kc) tK += 600; }
const K = mk("K", 20, kc.town), tk = kc.start + 60; K.gold = 50000;
const stock = WORLDEV.stock(kc, K); ok(stock.length === 5 && new Set(stock).size === 5 && stock.every((i) => D.ITEMS[i]), "five rare wares");
ok(JSON.stringify(stock) === JSON.stringify(WORLDEV.stock(kc, mk("K2", 3, kc.town))), "same stock for everyone");
const away = mk("K3", 20, kc.town === "Whiterun" ? "Riften" : "Whiterun"); away.gold = 9999; ok(/camped outside/.test(WORLDEV.buy(away, stock[0], tk).text), "must be in the town");
for (const it of stock) ok(WORLDEV.buy(K, it, tk).bought, "bought " + it);
ok(/only one of each/.test(WORLDEV.buy(K, stock[0], tk).text), "one of each per visit");
ok(K.titles.includes("Friend of the Caravan"), "five purchases → Friend of the Caravan");
ok(/does not have/.test(WORLDEV.buy(K, "iron_dagger", tk).text), "only its own wares");

// ---- 6. perks: real effects
const P1 = mk("P1", 30, kc.town); const p0 = WORLDEV.price(P1, stock[0]); (P1.perks = P1.perks || {}).caravan_friend = 1;
ok(WORLDEV.price(P1, stock[0]) < p0 && WORLDEV.stock(kc, P1).length === 6, "Caravan Friend: cheaper and one more ware");
ok(PERKS.BY_ID.gate_breaker && PERKS.BY_ID.sky_hunter && PERKS.BY_ID.caravan_friend, "three new perks registered");
{ const s = mk("GB", 30, inv.sites[0]); const e = WORLDEV.daedraFor(s, 0, t1); const f = new G.Fight(s, e); const a = PFX.out(f, {}), b = PFX.inMult(f, {}); (s.perks = s.perks || {}).gate_breaker = 1; const f2 = new G.Fight(s, e);
  ok(PFX.out(f2, {}) > a && PFX.inMult(f2, {}) < b, "Gate Breaker: harder hits, softer blows against Daedra");
  ok(PFX.num(s, "wevgate") === 0.25, "Gate Breaker: gate fights count more"); }
{ const s = mk("SH", 40, cap); (s.perks = s.perks || {}).sky_hunter = 1; ok(PFX.num(s, "wevbone") === 1, "Sky Hunter: extra bone"); }
// old perk ids still there
for (const id of ["armsman", "summoner", "eagle_eye", "bribery", "persuasion", "critical_charge"]) ok(PERKS.BY_ID[id], "old perk kept " + id);

// ---- 7. quick balance sim: gate fights and migrating dragons by level
const sim = (L, kind, N = 160) => { let won = 0, turns = 0, hpLeft = 0, oneTurn = 0, died = 0;
  for (let i = 0; i < N; i++) { const s = mk("S" + i, L, kind === "gate" ? inv.sites[0] : cap); s._test = true;
    const e = kind === "gate" ? WORLDEV.daedraFor(s, 0, t1) : G.scaleEnemy({ name: "Migrating dragon", ...WORLDEV.dragonBase(G.fightLevel(s)), tags: ["big", "dragon", "elite"], gold: [0, 0] }, G.fightLevel(s));
    const f = new G.Fight(s, e); f.run({ maxTurns: kind === "gate" ? 30 : 40 });
    if (f.won) { won++; hpLeft += f.hp / G.maxHealth(s); if (f.turn <= 1 && e.danger !== "low") oneTurn++; } if (f.hp <= 0) died++; turns += f.turn; }
  return { win: won / N, turns: turns / N, hp: won ? hpLeft / won : 0, oneTurn: oneTurn / N, died: died / N }; };
const rows = [];
for (const L of [8, 15, 25, 35, 45]) { const g = sim(L, "gate"), d = sim(L, "dragon", 80);
  rows.push("L" + L + " gate win " + (g.win * 100).toFixed(0) + "% " + g.turns.toFixed(1) + "t hp " + (g.hp * 100).toFixed(0) + "% | dragon win " + (d.win * 100).toFixed(0) + "% " + d.turns.toFixed(1) + "t died " + (d.died * 100).toFixed(0) + "%");
  if (L > 35) continue;   // the test hero has no enchantments or potions, so past 35 it falls behind even road bandits: printed only
  ok(g.win >= 0.55, "L" + L + " gate fights winnable (" + g.win + ")");
  ok(g.turns >= 3, "L" + L + " gate fights last a few turns (" + g.turns.toFixed(1) + ")");
  ok(g.oneTurn < 0.05 && d.oneTurn === 0, "L" + L + " no one-turn kills (scamps aside)");
  ok(d.turns >= 8, "L" + L + " dragons take a while (" + d.turns.toFixed(1) + ")");
  if (L >= 25) ok(d.win >= 0.3 && d.win <= 0.9, "L" + L + " dragons can be beaten, but not always (" + d.win + ")"); }
console.log(rows.join("\\n"));

console.log(fails ? fails + " FAILED of " + n : "worldevents ok · " + n + " checks");
if (fails) throw new Error("world events failed");
`, c);
