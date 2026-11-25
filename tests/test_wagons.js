// Wagons on the map you can tap (wagons.js): the state of a caravan run (broken down, under attack, guarded, robbed),
// catching up, trade at crisis prices, news, helping, escorts that count for the Jarl's contract, robbing (never
// wagons another hero guards), the shared co-op record, the chase forcing a meeting, the perk, Polish, and a balance sim
// for escort pay, help rewards and caravan prices.   W=/path/to/game/ node test_wagons.js — prints "wagons ok".
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const W = __GAME;
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
c.globalThis = c; vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "social.js", "rumours.js", "livingworld.js", "caravans.js", "caravanroad.js", "i18n_crises.js", "crises.js", "wagons.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
c.PN = fs.existsSync(W + "patchnotes.js") ? fs.readFileSync(W + "patchnotes.js", "utf8") : "";
c.UI = fs.readFileSync(W + "ui.js", "utf8"); c.MAPJS = fs.readFileSync(W + "map.js", "utf8"); c.OVL = fs.readFileSync(W + "overlays.js", "utf8"); c.HTML = fs.readFileSync(W + "index.html", "utf8");
vm.runInContext(`(() => {
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };
const t0 = G.now();
let T = t0; G.now = () => T;
const mk = (id, lvl, pos) => { const s = G.newSave(id, "P" + id, "nord"); s.level = lvl; for (const k of Object.keys(s.skills)) s.skills[k].lvl = Math.min(100, s.skills[k].lvl + lvl); [s.x, s.y] = pos; s.location = null; G.setHealth(s, G.maxHealth(s)); s.gold = 500; return s; };
const runs = (from, secs, step = 30) => { const out = new Map(); for (let t = from; t < from + secs; t += step) for (const cv of CARAVANS.all(t)) if (cv.phase === "road" && !out.has(cv.id)) out.set(cv.id, cv); return [...out.values()]; };
const all = runs(t0, 2 * 86400, 120);
ok(all.length > 40, "caravan runs over two days: " + all.length);

// ---- state of a run: the same on every phone, trouble never on top of an ambush
const broken = all.filter((cv) => WAGONS.trouble(cv)), share = broken.length / all.length;
ok(share > 0.12 && share < 0.4, "about a third of runs break down: " + share.toFixed(2));
ok(JSON.stringify(WAGONS.trouble(broken[0])) === JSON.stringify(WAGONS.trouble({ ...broken[0] })), "trouble is seeded");
for (const cv of broken) { const b = WAGONS.trouble(cv), p = CARAVANS.plan(cv); ok(!p.at.some((a) => b.at < a + WAGONS.ATK_POST && b.at + b.len > a - WAGONS.ATK_PRE), "no breakdown during an ambush " + cv.id); }
const bc = broken[0], bt = WAGONS.trouble(bc), atBreak = bc.depart + (bt.at + bt.len / 2) * bc.leg.secs;
const A = mk("A", 20, CARAVANS.pos(bc, atBreak));
T = atBreak;
ok(WAGONS.state(A, bc, T).k === "broken", "broken down mid-road: " + WAGONS.state(A, bc, T).k);
ok(WAGONS.state(A, bc, bc.depart + (bt.at + bt.len + 0.03) * bc.leg.secs).k !== "broken", "rolling again after");
ok(/wheel/.test(WAGONS.stateText(WAGONS.state(A, bc, T), bc)), "state words");
const ac = all[0], ap = CARAVANS.plan(ac), atAmb = ac.depart + ap.at[0] * ac.leg.secs;
const sa = WAGONS.state(A, ac, atAmb);
ok(sa.k === "attacked" && sa.i === 0 && CARAVANS.FOES[sa.foe], "under attack at its ambush: " + JSON.stringify(sa));
ok(WAGONS.state(A, { ...ac, phase: "stop" }, ac.depart - 100).k === "resting", "resting in town");

// ---- help: fix the wheel (once, shared) and fight off an attack
const g0 = A.gold, lbl = WAGONS.helpLabel(A, bc, T);
ok(/wheel/.test(lbl), "help label: " + lbl);
const fx = WAGONS.help(A, bc, T, () => 0);
ok(fx.fixed && A.gold - g0 === WAGONS.fixPay(A) && WAGONS.fixPay(A) <= WAGONS.FIX_MAX, "fixed: paid " + (A.gold - g0));
ok(WAGONS.shared()[bc.id]?.fixed?.by === A.name, "fixed is shared");
const B = mk("B", 10, [A.x, A.y]);
ok(WAGONS.state(B, bc, T).k === "rolling" && WAGONS.state(B, bc, T).fixedBy === A.name, "another player sees it fixed");
ok(WAGONS.help(A, bc, T).keep && WAGONS.helpLabel(B, bc, T) === null, "nothing left to help");
const sent = []; WAGONS.setSink((id, doc) => sent.push([id, doc]));
const C = mk("C", 30, CARAVANS.pos(ac, atAmb)); T = atAmb;
const sv = WAGONS.help(C, ac, T);
ok(sv.foe && sv.foe.caravan && typeof sv.afterFn === "function", "attack: a fight beside the guards");
const cg = C.gold, said = sv.afterFn(C);
ok(C.gold - cg === WAGONS.savePay(C) && /gold/.test(said), "saved: paid " + (C.gold - cg));
ok(sent.some(([id, d]) => id === ac.id && d.saved && d.saved[0] === C.name), "the save goes to the shared record");
ok(WAGONS.state(B, ac, T).k !== "attacked", "no longer under attack for anyone");
ok(WAGONS.help(C, ac, T).keep, "help each attack once");
// a failed repair: no pay, can't retry
const bc2 = broken[1], bt2 = WAGONS.trouble(bc2), tb2 = bc2.depart + (bt2.at + 0.02) * bc2.leg.secs, F = mk("F", 1, CARAVANS.pos(bc2, tb2)); T = tb2;
const f0 = F.gold, ff = WAGONS.help(F, bc2, T, () => 0.999);
ok(!ff.fixed && F.gold === f0 && !WAGONS.helpLabel(F, bc2, T), "a failed repair pays nothing and can't be retried");
ok(WAGONS.helpLabel(B, bc2, T), "but others can still help");

// ---- catching up: the meeting point is on their road, you reach it in time
const cv = all.find((x) => x.depart > t0 + 600 && CARAVANS.leg(x.from, x.to).secs > 600) || all[3];
T = cv.depart + 0.15 * cv.leg.secs;
const start = WORLD.places[cv.from].slice(0, 2), P = mk("P", 15, start);
const secsTo = (p) => G.minutesTo(P, p) * 60;
const ic = WAGONS.intercept(cv, T, start, secsTo);
ok(!ic.town && ic.secs > 0 && ic.secs < cv.arrive - T, "intercept on the road in " + Math.round(ic.secs) + " s");
ok(G.pxDist(ic.pos, CARAVANS.pos(cv, T + ic.secs)) < 1 && secsTo(ic.pos) <= ic.secs + 1, "you get there as they do");
ok(WAGONS.intercept(cv, T, CARAVANS.pos(cv, T), secsTo).near, "already beside them");
ok(WAGONS.intercept({ ...cv, phase: "stop" }, T, start, secsTo).resting, "resting: meet them in town");
const slow = WAGONS.intercept(cv, T, [0.02, 0.02], () => 1e9);
ok(slow.late && slow.town === cv.to, "too far: meet them at their stop");

// ---- trade: their packs, crisis prices, the perk, never below a shop's buying price
const items = WAGONS.stock(P, cv, T);
ok(items.length >= 3 && items.every((i) => D.ITEMS[i]), "stock " + items.join(","));
const it = items[0], p0 = WAGONS.price(P, cv, it, T);
ok(p0 >= G.sellPrice(P, { item: it }, null) + 1, "never below what a shop pays you");
const pm = CRISES.priceMult; CRISES.priceMult = () => 1.3;
const pc = WAGONS.price(P, cv, it, T); CRISES.priceMult = pm;
ok(pc > p0 || p0 <= 2, "a crisis where they're heading puts prices up: " + p0 + " -> " + pc);
P.perks = P.perks || {}; P.perks.caravan_friend = 1;
ok(PFX.num(P, "cvprice") > 0 && WAGONS.price(P, cv, it, T) <= p0, "Caravan Friend: cheaper on the road " + WAGONS.price(P, cv, it, T) + " vs " + p0);
delete P.perks.caravan_friend;
P.gold = 5000; const gb = P.gold;
const m1 = WAGONS.buy(P, cv, it, T);
ok(/Bought/.test(m1) && P.gold < gb && G.count ? true : /Bought/.test(m1), "buy: " + m1);
for (let k = 0; k < WAGONS.BUY_MAX; k++) WAGONS.buy(P, cv, it, T);
ok(/all they have/.test(WAGONS.buy(P, cv, it, T)), "a small stock: " + WAGONS.BUY_MAX + " of each");
ok(/don't sell/.test(WAGONS.buy(P, cv, "dwarven_sword", T)), "only their packs");
P.gold = 0; ok(/costs/.test(WAGONS.buy(P, cv, items[1], T)), "no gold, no goods");

// ---- news: once per run
const nw = WAGONS.news(P, cv, T);
ok(nw.text.length > 10 && !nw.again, "news: " + nw.text.slice(0, 80));
ok(WAGONS.news(P, cv, T).again, "only once");

// ---- the meeting on the road: help shows up, rob is barred while another hero guards
T = atBreak;
const M = mk("M", 25, CARAVANS.pos(broken[2] || broken[0], T));
const mc = broken[2] || broken[0], mt = WAGONS.trouble(mc); T = mc.depart + (mt.at + 0.03) * mc.leg.secs; [M.x, M.y] = CARAVANS.pos(mc, T);
ok(!G.startTrip(M, mc.to, WORLD.places[mc.to].slice(0, 2), T), "trip");
const ev = CVROAD.meet(M, mc.id, [M.x, M.y], T);
ok(ev && !ev.err, "met them");
let ch = G.eventChoices(M).map((x) => x[0]);
ok(ch.includes("help") && ch.includes("rob"), "choices with help: " + ch.join(","));
WAGONS.share(mc.id, { escorts: { other1: "Ysolda" } });
ch = G.eventChoices(M).map((x) => x[0]);
ok(!ch.includes("rob"), "no robbing wagons another hero guards");
ok(/Another hero/.test(G.eventChoice(M, "rob", T).text), "and the choice itself refuses");
ok(WAGONS.state(B, mc, T).k === "broken", "trouble shows before guards");
const hr = G.eventChoice(M, "help", T);
ok(hr.text && M.trip.status === "event", "help from the meeting keeps you there: " + hr.text.slice(0, 60));
const tr = G.eventChoice(M, "trade", T);
ok(tr.shop && tr.shop.length === WAGONS.stock(M, mc, T).length, "their packs in the meeting");

// ---- escort: shared, and counts for the Jarl's escort contract
const E = mk("E", 20, CARAVANS.pos(cv, cv.depart + 0.3 * cv.leg.secs)); T = cv.depart + 0.3 * cv.leg.secs;
G.startTrip(E, cv.to, WORLD.places[cv.to].slice(0, 2), T);
CVROAD.meet(E, cv.id, [E.x, E.y], T);
const er = G.eventChoice(E, "escort", T);
ok(E.caravanJob?.escort && WAGONS.shared()[cv.id]?.escorts?.[E.id] === E.name, "escort is shared: " + er.text.slice(0, 50));
ok(WAGONS.state(B, cv, T).k === "escorted" || WAGONS.state(B, cv, T).k === "attacked", "others see the guard");
ok(WAGONS.state(E, cv, T).you, "you see yourself guarding");
// a crisis with an escort contract in the hold they're heading for
const hold = G.holdAt(WORLD.places[cv.to]);
const fakeCr = { id: "cr-999-0", hold, chain: "bandit", place: CRISES.CAPITAL[hold], start: T - 3 * 3600, end: T + 30 * 3600 };
const keep = { crisisIn: CRISES.crisisIn, status: CRISES.status };
CRISES.crisisIn = (h) => (h === hold ? fakeCr : null); CRISES.status = () => ({ state: "active", stage: 3, open: true, sev: 0.5, tl: {} });
const rel0 = CRISES.mine(E, T).rel[fakeCr.id] || 0;
const ce = WAGONS.crisisEscort(E, cv.to, T);
ok(/supply escort/.test(ce) && (CRISES.mine(E, T).rel[fakeCr.id] || 0) > rel0, "escort counts for the Jarl: " + ce);
ok(WAGONS.crisisEscort(E, cv.to, T + 5) === "", "not twice in a row (contract cooldown)");
const cgo = WAGONS.cargo(E, cv, T);
ok(cgo.crisis && /relief/.test(cgo.label), "cargo carries relief to a hold in crisis: " + cgo.label);
const nwc = WAGONS.news(mk("N", 10, [E.x, E.y]), cv, T);
ok(nwc.crisis && /bad way/.test(nwc.text), "news tells of the crisis");
CRISES.crisisIn = keep.crisisIn; CRISES.status = keep.status;
// arrival: CVROAD.arrived is wrapped (pay + the crisis line)
E.location = cv.to; E.trip = null; const ea = E.gold; const am = CVROAD.arrived(E);
ok(am && E.gold > ea && !E.caravanJob, "paid on arrival: " + (E.gold - ea));

// ---- robbing: a crime, remembered, shared
const R = mk("R", 30, CARAVANS.pos(ac, ac.depart + 0.9 * ac.leg.secs)); T = ac.depart + 0.9 * ac.leg.secs;
G.startTrip(R, ac.to, WORLD.places[ac.to].slice(0, 2), T); CVROAD.meet(R, ac.id, [R.x, R.y], T);
const rb = G.eventChoice(R, "rob", T);
ok(rb.fight && Object.values(R.bounty || {}).some((v) => v > 0), "rob: fight and a bounty");
ok(WAGONS.shared()[ac.id]?.robbed?.by === R.name && WAGONS.state(B, ac, T).k === "robbed", "others hear who robbed them");
ok(!WAGONS.info(R, ac, [R.x, R.y], T).robOk, "the card won't offer robbing them twice");

// ---- the chase: the caravan you set off after stops for you even right after a meeting
const Q = mk("Q", 12, CARAVANS.pos(cv, cv.depart + 0.5 * cv.leg.secs)); T = cv.depart + 0.5 * cv.leg.secs;
G.startTrip(Q, cv.to, WORLD.places[cv.to].slice(0, 2), T);
Q.cvRoad = { met: { [cv.id]: T - 10 } };
ok(CVROAD.autoMeet(Q, [Q.x, Q.y], T)?.id !== cv.id, "met a moment ago: no prompt");
WAGONS.chase(Q, cv.id, "trade", 60, T);
ok(CVROAD.autoMeet(Q, [Q.x, Q.y], T)?.id === cv.id, "chasing them: they stop for you");
ok(WAGONS.takeIntent(Q, cv.id) === "trade" && !Q.wagons.chase, "the card's choice runs on meeting, once");

// ---- the card's data
const inf = WAGONS.info(B, cv, CARAVANS.pos(cv, T), T, (p) => G.minutesTo(B, p) * 60);
ok(inf.name === cv.line.name && inf.to === cv.to && inf.cargo && inf.stateText && inf.near && inf.catchUp?.near, "card info");
ok(!WAGONS.info(B, cv, WORLD.places[cv.from], T).near, "far away: not near");

// ---- wiring: ui, map, overlays, page
ok(/WAGONS\\.tap\\(view/.test(UI) && /WAGONS\\.hover\\(view/.test(UI) && /WAGONS\\.decorate\\(view/.test(UI) && /WAGONS\\.mount\\(/.test(UI), "ui.js taps, hovers, decorates, mounts");
ok(/WAGONS\\.takeIntent/.test(UI) && /PARTYPLAY\\.canDecide\\(S\\)\\) return toast\\("Only your party's leader can stop/.test(UI), "the leader decides on the road");
ok(/c\\.hover/.test(MAPJS) && /c\\.trouble/.test(MAPJS), "map draws hover and trouble");
ok(/"#wgcard"/.test(OVL), "card ranks as a window");
ok(/<script src="wagons.js"><\\/script>[\\s\\S]*<script src="ui.js">/.test(HTML) && /\\.wgcard\\{/.test(HTML), "script and style in the page");

// ---- Polish for every card line and the patch note
const SRC_T = Object.keys(WAGONS.PL);
ok(SRC_T.length > 60, "Polish lines: " + SRC_T.length);
const pnAt = PN.indexOf("b251-wagons"), pn = pnAt < 0 ? "" : PN.slice(pnAt - 1, PN.indexOf("{ id:", pnAt + 5) > 0 ? PN.indexOf("{ id:", pnAt + 5) : PN.length);
const notes = [...pn.matchAll(/"((?:[^"\\\\]|\\\\.)+)"/g)].map((m) => m[1].replace(/\\\\"/g, '"')).filter((x) => /caravan|wagon/i.test(x) && x.length > 20);
ok(notes.length >= 5 && notes.every((x) => WAGONS.PL[x]), "patch note in Polish (" + notes.length + ")");

// ================================================================ balance
// 1) escorting from the road never beats signing on in town per hour (one guard each); help rewards stay small
let townRate = 0, roadRate = 0, roadBare = 0, k = 0;
const L = mk("L", 50, [0.5, 0.5]);
for (const cv2 of all.slice(0, 40)) {
  const pool = CARAVANS.plan(cv2).pool, secs = cv2.leg.secs;
  townRate += pool / (CARAVANS.STOP + secs) * 3600;
  const f = 0.25, pay = Math.max(30, Math.round(pool * (1 - f) * CVROAD.ESCORT_RATE * 1.25));   // with Caravan Friend
  roadRate += pay / ((1 - f) * secs + 0.2 * secs) * 3600;
  roadBare += Math.max(30, Math.round(pool * (1 - f) * CVROAD.ESCORT_RATE)) / ((1 - f) * secs + 0.2 * secs) * 3600;   // no perk   // plus the time it takes to catch up
  k++;
}
townRate /= k; roadRate /= k; roadBare /= k;
ok(roadBare <= townRate * 1.05, "escort from the road without perks (" + Math.round(roadBare) + "/h) ≤ signing on in town (" + Math.round(townRate) + "/h)");
ok(roadRate <= townRate * 1.2, "with Caravan Friend (" + Math.round(roadRate) + "/h) at most 20% over town");
// 2) every help on every caravan at once (impossible upper bound): still in line with guarding work
let helpGold = 0;
for (const cv2 of all) { if (WAGONS.trouble(cv2)) helpGold += WAGONS.fixPay(L) * 0.8; helpGold += CARAVANS.plan(cv2).at.length * WAGONS.savePay(L); }
const helpRate = helpGold / 48 / CARAVANS.LINES.length;   // per caravan line per hour; you can only be beside one line
ok(helpRate < townRate * 1.25, "helping one line's wagons (" + Math.round(helpRate) + "/h) stays near guard pay (" + Math.round(townRate) + "/h)");
ok(WAGONS.fixPay(L) <= WAGONS.FIX_MAX && WAGONS.savePay(mk("Z", 200, [0.5, 0.5])) === WAGONS.SAVE_MAX, "rewards capped");
// 3) caravan prices: a maxed trader with the perk still pays more than any shop gives back; never far from a normal price
const X = mk("X", 80, [0.5, 0.5]); X.skills.Mercantile.lvl = 100; X.skills.Speechcraft.lvl = 100; X.perks = { caravan_friend: 1, haggling: 5 };
let lo = 9, hi = 0, under = 0, cnt = 0;
for (const cv2 of all.slice(0, 20)) for (const i of WAGONS.stock(X, cv2, cv2.depart + 10)) {
  const p = WAGONS.price(X, cv2, i, cv2.depart + 10), r = p / G.buyPrice(X, i, null); cnt++;
  if (p <= G.sellPrice(X, { item: i }, null)) under++;
  lo = Math.min(lo, r); hi = Math.max(hi, r);
}
ok(cnt > 50 && under === 0, "no buy-low-sell-high at the wagons (" + cnt + " prices)");
ok(lo >= 0.7 && hi <= 1.4, "caravan prices within 0.7–1.4× a road trader's: " + lo.toFixed(2) + "–" + hi.toFixed(2));
console.log("balance · town guard " + Math.round(townRate) + "/h · road escort " + Math.round(roadRate) + "/h · help bound " + Math.round(helpRate) + "/h · price ratio " + lo.toFixed(2) + "–" + hi.toFixed(2));

if (fails) { console.log(fails + " of " + n + " checks failed"); throw new Error("wagons FAILED"); }
console.log("wagons ok (" + n + " checks)");
})();`, c);
