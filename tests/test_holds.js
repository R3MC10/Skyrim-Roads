// Player-run holds (holdrule.js): claiming a hold, Jarl elections and terms, taxes and the treasury, spending, raids in the
// weekly window, the party rule, offline safety, perks with real effects, Polish, and a balance sim of the fights.
// W=/path/to/game/ node test_holds.js   (N=40 fights per level by default)
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, process, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {} };
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
const SIM = fs.readFileSync(__dirname + "/test_bal_sim.js", "utf8");
c.N = +(process.env.N || 40);
vm.runInContext(SIM.slice(SIM.indexOf("const LEVELS"), SIM.indexOf("const BUILDS")) + `
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const at = (s, p) => { s.location = p; [s.x, s.y] = WORLD.places[p]; s.trip = null; s.dungeon = null; };
const H = HOLDRULE, C = CLANS.COLORS, HOUR = 36e5, DAY = 864e5;
OK(typeof H === "object" && H.TAX_MAX === 0.05 && H.TAX_DEFAULT <= H.TAX_MAX, "module loaded, tax capped at 5%");
// ---- 0. offline / single player: nobody rules, prices untouched
const solo = G.newSave("S0", "Solo", "nord"); at(solo, "Whiterun");
CLANS.set([], []); WARS.setDocs([], null); H.setDocs([], null);
OK(Object.keys(H.seats(Date.now())).length === 0, "no records: nobody rules");
OK(H.priceMult(solo, "Whiterun") === 1 && WARS.discount(solo, "Whiterun") === 1, "no records: prices unchanged");
OK(/clan/.test(H.canFight(solo, "Whiterun").why), "no clan: can't challenge");

// ---- the calendar: Monday 00:00 UTC weeks, two terms, the Saturday-Sunday window
const MON = BOUNTY.weekEnds(BOUNTY.week(Date.now()) + 1);   // next Monday 00:00 UTC
OK(new Date(MON).getUTCDay() === 1 && new Date(MON).getUTCHours() === 0, "weeks start Monday 00:00 UTC");
OK(H.termStart(MON + DAY) === MON && H.termStart(MON + 4 * DAY) === MON + 3.5 * DAY, "terms: Monday and Thursday noon");
OK(!H.windowAt(MON + 5 * DAY).open && H.windowAt(MON + 5.5 * DAY + 1).open && H.windowAt(MON + 6.9 * DAY).open, "raid window: Saturday 12:00 to Monday 00:00");
OK(!H.windowAt(MON + 7 * DAY).open, "window closes at the new week");

// ---- clans: Sons [SONS] = a (founder), b, c; Ravens [RAVN] = x (founder), y
const a = make("warrior", 30), b = make("warrior", 30), cc = make("mage", 30), x = make("warrior", 30), y = make("archer", 30);
[[a, "A", "Alfa"], [b, "B", "Beta"], [cc, "Cc", "Ceta"], [x, "X", "Xeno"], [y, "Y", "Ypsi"]].forEach(([s, id, nm]) => { s.id = id; s.name = nm; s._test = false; at(s, "Whiterun"); s.gold = 2000; });
const sons = { ...CLANS.found(a, "Sons of the North", "SONS", [C[0], C[6]]).clan, id: "A", invites: ["B", "Cc"] };
const ravens = { ...CLANS.found(x, "Ravens", "RAVN", [C[1], C[7]]).clan, id: "X", invites: ["Y"] };
b.clan = "A"; cc.clan = "A"; y.clan = "X";
CLANS.set([sons, ravens], [{ id: "A", clan: "A", name: "Alfa" }, { id: "B", clan: "A", name: "Beta" }, { id: "Cc", clan: "A", name: "Ceta" }, { id: "X", clan: "X", name: "Xeno" }, { id: "Y", clan: "X", name: "Ypsi" }]);
OK(CLANS.of("B").id === "A" && CLANS.of("Y").id === "X", "two clans set up");
const docsAll = () => [a, b, cc, x, y].map((s) => H.record(s));
const sync = () => H.setDocs(docsAll(), null);

// ---- 1. the right to challenge: war points in the hold this week
const T0 = MON + 1 * DAY + 10 * HOUR;   // Tuesday
const wk = BOUNTY.week(T0);
const warDocs = (pts) => WARS.setDocs(Object.entries(pts).map(([uid, p]) => ({ uid, name: uid, week: wk, h: { Whiterun: p } })), null);
warDocs({ A: 4 });
// WARS.standings uses the current week; for the test we put points in "this" real week too
const realWk = WARS.week(); const putPts = (pts) => WARS.setDocs(Object.entries(pts).flatMap(([uid, p]) => [{ uid, name: uid, week: wk, h: { Whiterun: p } }, { uid, name: uid, week: realWk, h: { Whiterun: p } }]), null);
putPts({ A: 4 }); sync();
OK(/war points/.test(H.canFight(a, "Whiterun", T0).why), "not enough war points: " + H.canFight(a, "Whiterun", T0).why);
putPts({ A: 12, X: 15 });
OK(H.canFight(a, "Whiterun", T0).kind === "claim" && !H.canFight(a, "Whiterun", T0).why, "10+ points: a can claim Whiterun");
at(a, "Riften"); OK(/be in Whiterun/.test(H.canFight(a, "Whiterun", T0).why), "must stand in the hold"); at(a, "Whiterun");
OK(/party leader/.test(H.canFight(a, "Whiterun", T0, { role: "member" }).why), "party member can't start a challenge");
OK(!H.canFight(a, "Whiterun", T0, { role: "leader" }).why, "party leader can");
const low = make("warrior", 6); low.id = "A"; low.clan = "A"; at(low, "Whiterun"); OK(/level 10/.test(H.canFight(low, "Whiterun", T0).why), "level 10 needed");

// ---- 2. the claim fight (played for real until it's won)
let r, tries = 0, t = T0;
do { G.setHealth(a, G.maxHealth(a)); r = H.fight(a, "Whiterun", t); OK(r.fight && !isNaN(r.fight.hp) && !isNaN(r.fight.ehp), "claim fight ran: " + (r.text || "")); t += H.RETRY + 1000; tries++; } while (!r.won && tries < 15);
OK(r.won && r.took, "Sons take Whiterun after " + tries + " tries: " + r.text);
OK(/now rules Whiterun/.test(r.text) && r.gold === H.CLAIM_GOLD, "claim text and reward");
const TC = t - H.RETRY - 1000;   // when it was taken
sync();
let seat = H.seatOf("Whiterun", TC + 1000);
OK(seat && seat.cid === "A" && seat.walls === H.WALLS && seat.by === "A", "seat: Sons, 2 walls, taken by Alfa");
H.setClock(() => TC + 1000);
OK(WARS.rulers(a).Whiterun?.id === "A", "the rulers map shows the seat");
OK(H.canFight(b, "Whiterun", TC + 1000).why === "Your clan rules here.", "members don't fight their own hold");
OK(/weekly window/.test(H.canFight(x, "Whiterun", TC + HOUR).why), "Ravens can't raid outside the window");

// ---- 3. the Jarl: acting until a term starts with votes, then the vote winner
let j = H.jarlOf(seat, TC + 1000);
OK(j.uid === "A" && j.acting, "the taker acts as Jarl at first");
OK(H.vote(x, "Whiterun", "X", TC + HOUR).err, "outsiders can't vote");
OK(H.vote(b, "Whiterun", "X", TC + HOUR).err, "can't vote for an outsider");
OK(!H.vote(b, "Whiterun", "B", TC + HOUR).err && !H.vote(cc, "Whiterun", "B", TC + HOUR).err && !H.vote(a, "Whiterun", "A", TC + HOUR).err, "members vote");
sync();
OK(H.jarlOf(seat, TC + 2 * HOUR).uid === "A", "votes count from the next term");
const T2 = H.termEnds(TC) + HOUR;   // Thursday 13:00
OK(H.jarlOf(seat, T2).uid === "B" && H.jarlOf(seat, T2).votes === 2 && !H.jarlOf(seat, T2).acting, "Beta elected 2-1 for the next term");
OK(H.isJarl(b, "Whiterun", T2) && !H.isJarl(a, "Whiterun", T2), "isJarl");
const nc = H.nextCount(seat, T2); OK(nc[0].id === "B" && nc[0].n === 2, "next-term count");
// a vote changed mid-term only matters at the next term
H.vote(cc, "Whiterun", "A", T2 + HOUR); sync();
OK(H.jarlOf(seat, T2 + 2 * HOUR).uid === "B", "mid-term vote change doesn't unseat the Jarl");
OK(H.jarlOf(seat, H.termEnds(T2) + HOUR).uid === "A", "...but wins the next term (A 2-1 after Ceta switched)");
H.vote(cc, "Whiterun", "B", T2 + 2 * HOUR); sync();   // back to Beta for the rest of the test

// ---- 4. taxes: Jarl only, capped, default 2%
OK(H.taxOf(seat, T2) === H.TAX_DEFAULT, "2% to start");
OK(H.setTax(a, "Whiterun", 0.04, T2).err, "only the Jarl sets the tax");
OK(!H.setTax(b, "Whiterun", 0.09, T2).err && H.taxOf(seat, T2 + 1) === 0.05, "capped at 5%");
H.setTax(b, "Whiterun", 0.03, T2 + 1); sync();
OK(Math.abs(H.taxOf(seat, T2 + 2) - 0.03) < 1e-9, "Jarl sets 3%");
// prices: outsiders pay the tax, members pay none (and keep the old 10% clan discount)
OK(Math.abs(H.priceMult(x, "Whiterun", T2 + 2) - 1.03) < 1e-9, "outsider pays 3% more in Whiterun");
OK(H.priceMult(x, "The Rift", T2 + 2) === 1, "no tax in a hold nobody rules");
OK(H.priceMult(a, "Whiterun", T2 + 2) === 1, "members pay no tax");
H.setClock(() => T2 + 2);
OK(Math.abs(WARS.discount(a, "Whiterun") - 0.9) < 1e-9, "ruling clan still shops 10% cheaper (wars.js)");
// a real purchase pays into the treasury
const ws = WORLD.places.Whiterun;
const price0 = (() => { const s2 = G.clone(solo); s2.id = "Z"; return G.buyPrice(s2, "potion_health_minor", "Whiterun"); })();
let shopT = Math.floor(G.now()); while (!G.shopsOpen(shopT)) shopT += 300;
x.gold = 5000; const g0 = x.gold;
const m = G.buy(x, "potion_health_minor", 10, shopT);
const spent = g0 - x.gold;
OK(/Bought/.test(m), "buy works: " + m);
const tax1 = Object.values(H.st(x).paid).reduce((p, v) => p + v, 0);
OK(tax1 > 0 && tax1 < spent * 0.06, "tax recorded: " + tax1 + " of " + spent);
void price0; void ws;
// treasury from everyone's tax, then spending
H.st(y).paid[H.seatKey(seat)] = 900; sync();
let tr = H.treasury(seat, T2 + 3);
OK(tr.income >= 900 && tr.balance === tr.income, "treasury " + tr.income);
OK(H.spend(a, "Whiterun", "guards", T2 + 10).err, "only the Jarl spends");
OK(!H.spend(b, "Whiterun", "guards", T2 + 10).err, "guards hired");
OK(!H.spend(b, "Whiterun", "market", T2 + 11).err, "market discount");
OK(!H.spend(b, "Whiterun", "repair", T2 + 12).err, "walls repaired");
sync();
tr = H.treasury(seat, T2 + 20);
OK(tr.spent === 750 && tr.balance === tr.income - 750, "spent 750: " + JSON.stringify(tr));
OK(H.spend(b, "Whiterun", "guards", T2 + 30).err, "not enough gold left for more guards");
seat = H.seatOf("Whiterun", T2 + 20);
OK(seat.walls === 3, "3 walls after repairs: " + seat.walls);
let fx = H.effects(seat, T2 + 20);
OK(fx.guards === 1 && fx.market === 0.05, "guards and market active");
OK(Math.abs(H.priceMult(x, "Whiterun", T2 + 20) - 1.03 * 0.95) < 1e-9, "market discount for everyone (outsider)");
OK(Math.abs(H.priceMult(a, "Whiterun", T2 + 20) - 0.95) < 1e-9, "...and for members");
OK(H.effects(seat, T2 + 4 * DAY).market === 0, "market discount ends after 3 days");
OK(H.foeFor(x, "Whiterun", "raid", 1).health > H.foeFor(x, "Whiterun", "raid", 0).health, "guards make raids harder");

// ---- 5. perks: Fair Dues, Jarl's Favour, Hold Warden
OK(["fair_dues", "jarls_favour", "hold_warden"].every((id) => PERKS.BY_ID[id] && PFX.FX[id]), "three new perks");
x.perks = x.perks || {}; x.perks.fair_dues = 1;
OK(Math.abs(H.priceMult(x, "Whiterun", T2 + 2) - 1.015) < 1e-9, "Fair Dues 1: half the tax");
x.perks.fair_dues = 2; OK(H.priceMult(x, "Whiterun", T2 + 2) === 1, "Fair Dues 2: no tax");
delete x.perks.fair_dues;
a.perks = a.perks || {}; a.perks.jarls_favour = 1;
OK(Math.abs(H.priceMult(a, "Whiterun", T2 + 2) - 0.95) < 1e-9, "Jarl's Favour: 5% off in your clan's hold");
OK(Math.abs(H.priceMult(a, "The Rift", T2 + 2) - 1) < 1e-9, "...only there");
delete a.perks.jarls_favour;
const inc0 = H.treasury(seat, T2 + 3).income; b.perks = b.perks || {}; b.perks.jarls_favour = 1; sync();
OK(H.treasury(seat, T2 + 3).income > inc0, "Jarl's Favour on the Jarl: taxes fill the treasury faster");
delete b.perks.jarls_favour; sync();
const e0 = H.foeFor(x, "Whiterun", "claim"); x.perks.hold_warden = 1; const e1 = H.foeFor(x, "Whiterun", "claim"); delete x.perks.hold_warden;
OK(e1.health < e0.health && e1.damage < e0.damage, "Hold Warden: weaker champion");

// ---- 6. raids in the window: walls fall one by one, then the hold changes hands; it's then safe that week
const RW = MON + 5.5 * DAY + HOUR;   // Saturday 13:00, same week as the claim
OK(/changed hands this week/.test(H.canFight(x, "Whiterun", RW).why), "claimed this week: safe until next week's window");
const RW2 = RW + 7 * DAY;   // next Saturday
H.setDocs(docsAll(), null);
OK(!H.canFight(x, "Whiterun", RW2).why && H.canFight(x, "Whiterun", RW2).kind === "raid", "Ravens can raid next Saturday: " + H.canFight(x, "Whiterun", RW2).why);
const raidAct = (s, tt) => { H.st(s).acts.push({ k: "raid", h: "Whiterun", c: CLANS.of(s.id).id, t: tt, win: true, seat: H.seatKey(H.seatOf("Whiterun", tt)) }); sync(); };
const walls0 = H.seatOf("Whiterun", RW2).walls;
for (let i = 0; i < walls0; i++) raidAct(i % 2 ? y : x, RW2 + i * 60e3 + 1);
OK(H.seatOf("Whiterun", RW2 + HOUR).walls === 0 && H.seatOf("Whiterun", RW2 + HOUR).cid === "A", "walls down, Sons still rule");
// a raid that lost doesn't count
H.st(x).acts.push({ k: "raid", h: "Whiterun", c: "X", t: RW2 + HOUR, win: false, seat: H.seatKey(H.seatOf("Whiterun", RW2 + HOUR)) }); sync();
OK(H.seatOf("Whiterun", RW2 + HOUR + 1).cid === "A", "lost raid changes nothing");
raidAct(x, RW2 + 2 * HOUR);
const s2 = H.seatOf("Whiterun", RW2 + 2 * HOUR + 1);
OK(s2.cid === "X" && s2.took === "A" && s2.walls === H.WALLS, "Ravens take Whiterun on the next won raid");
OK(H.jarlOf(s2, RW2 + 3 * HOUR).uid === "X", "the raider acts as Jarl");
OK(H.taxOf(s2, RW2 + 3 * HOUR) === H.TAX_DEFAULT, "new seat: tax back to 2%, the old Jarl's decree doesn't carry over");
OK(H.treasury(s2, RW2 + 3 * HOUR).income === 0, "new seat: fresh treasury");
// the Sons strike back in the same window: locked
H.st(a).acts.push({ k: "raid", h: "Whiterun", c: "A", t: RW2 + 4 * HOUR, win: true, seat: H.seatKey(s2) }); sync();
OK(H.seatOf("Whiterun", RW2 + 5 * HOUR).cid === "X", "can't take it back in the same window");
OK(/changed hands this week/.test(H.canFight(a, "Whiterun", RW2 + 5 * HOUR).why), "...and the screen says so");
// raids aimed at an old seat don't count against the new one; raids outside the window don't count
H.st(a).acts.push({ k: "raid", h: "Whiterun", c: "A", t: RW2 + 2 * DAY, win: true, seat: H.seatKey(s2) }); sync();
OK(H.seatOf("Whiterun", RW2 + 3 * DAY).walls === H.WALLS, "raids outside the window are ignored");
// a disbanded clan loses its hold
CLANS.set([sons], null); H.setDocs(docsAll(), null);
OK(!H.seatOf("Whiterun", RW2 + 3 * DAY) || H.seatOf("Whiterun", RW2 + 3 * DAY).cid !== "X", "a disbanded clan rules nothing");
CLANS.set([sons, ravens], null); sync();
// fakes: an act by someone not in the clan is ignored
H.setDocs([...docsAll(), { uid: "Q", acts: [{ k: "claim", h: "The Rift", c: "A", t: T0, win: true }] }], null);
OK(!H.seatOf("The Rift", T0 + HOUR), "a claim by a non-member is ignored");
// every phone works it out the same way: order of records doesn't matter
const fwd = H.setDocs(docsAll(), null) || JSON.stringify(Object.values(H.seats(RW2 + 9 * HOUR)).map((s) => [s.hold, s.cid, s.since, s.walls]));
H.setDocs(docsAll().reverse(), null); const rev = JSON.stringify(Object.values(H.seats(RW2 + 9 * HOUR + 1)).map((s) => [s.hold, s.cid, s.since, s.walls]));
OK(fwd === rev, "same result in any record order");
// records stay small
const big = H.record(x); OK(JSON.stringify(big).length < 8000, "record is small: " + JSON.stringify(big).length);

// ---- 7. Polish
__lang = "pl";
`, c);
vm.runInContext(`
for (const [en, needle] of [["Fair Dues", "Uczciwa danina"], ["Jarl's Favour", "Łaska jarla"], ["Hold Warden", "Strażnik twierdzy"], ["Raids are only allowed in the weekly window (Saturday 12:00 to Monday 00:00 UTC).", "sobot"], ["Your clan rules here.", "Twój klan"]])
  OK((I18N.tr(en) || "").includes(needle), "Polish: " + en + " -> " + I18N.tr(en));
OK(/Mistrz|Czempion/.test(I18N.t("Champion of {hold}", { hold: "Whiterun" }) + (I18N.tr("Champion of Whiterun") || "")), "Polish: champion name");

// ---- 8. balance: the claim and raid fights are real fights (most heroes of level 15+ win, few in 1-2 turns, nobody one-shot)
const rows = [];
for (const L of [12, 20, 30, 40]) for (const build of ["warrior", "mage", "archer"]) for (const kind of ["claim", "raid"]) {
  let won = 0, turns = 0, hpLeft = 0, quick = 0, maxHit = 0;
  for (let i = 0; i < N; i++) {
    const s = make(build, L); s._test = true; G.setHealth(s, G.maxHealth(s));
    const e = HOLDRULE.foeFor(s, "Whiterun", kind, kind === "raid" ? 1 : 0);
    const f = new G.Fight(s, e, null, G.now()); f.run({ t: G.now() });
    const mh = G.maxHealth(s);
    if (f.won) { won++; hpLeft += Math.min(1, Math.max(0, f.hp) / mh); if (f.turn <= 2) quick++; }
    turns += f.turn;
    for (const l of f.log) for (const mm of String(l.them || "").matchAll(/ hits ([0-9]+)/g)) maxHit = Math.max(maxHit, +mm[1] / mh);
  }
  hpLeft = won ? hpLeft / won * N : 0;
  rows.push([L, build, kind, Math.round(won / N * 100), +(turns / N).toFixed(1), Math.round(hpLeft / N * 100), quick, Math.round(maxHit * 100)]);
}
console.log("level build    kind  win%  turns  hp-left%  <=2turns  biggest-hit%");
for (const r of rows) console.log(String(r[0]).padEnd(6) + r[1].padEnd(9) + r[2].padEnd(6) + String(r[3]).padEnd(6) + String(r[4]).padEnd(7) + String(r[5]).padEnd(10) + String(r[6]).padEnd(9) + r[7]);
const avg = (L, k) => { const rs = rows.filter((r) => r[0] === L && r[2] === k); return rs.reduce((p, r) => p + r[3], 0) / rs.length; };
OK(avg(20, "claim") >= 45 && avg(30, "claim") >= 60, "level 20-30 heroes usually win a claim (" + avg(20, "claim") + "%, " + avg(30, "claim") + "%)");
const left = (L) => { const rs = rows.filter((r) => r[0] === L); return rs.reduce((p, r) => p + r[5], 0) / rs.length; };
OK(left(12) <= 75, "a level 12 hero pays for it in health (" + left(12) + "% left on average)");
OK(rows.every((r) => r[4] >= 3), "no claim/raid fight ends in under 3 turns on average");
OK(rows.every((r) => r[7] < 67), "no one-shots: no blow takes two thirds of your health (" + Math.max(...rows.map((r) => r[7])) + "%)");
OK([20, 30, 40].every((L) => left(L) <= 90), "it costs health (" + [20, 30, 40].map(left).join(",") + ")");
console.log("holds ok (" + n + " checks)");
`, c);
