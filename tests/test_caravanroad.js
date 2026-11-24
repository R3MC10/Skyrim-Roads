// Meeting caravans on the road (caravanroad.js): positions, meeting range, the meeting's choices, escort pay, walking with them, robbing.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const W = __GAME;
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
c.globalThis = c; c.T_OFF = +(process.env.T_OFF || 0); vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "social.js", "rumours.js", "caravans.js", "caravanroad.js", "mp.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const ok = (c, m) => { if (!c) throw new Error("FAIL " + m); };
// a caravan about a quarter of the way down its road
let t = G.now() + (+(typeof T_OFF !== "undefined" ? T_OFF : 0)), cv = null;
for (let i = 0; i < 20000 && !cv; i++) { cv = CARAVANS.all(t).find((x) => x.phase === "road" && CVROAD.frac(x, t) > 0.2 && CVROAD.frac(x, t) < 0.35); if (!cv) t += 20; }
ok(cv, "found a caravan on the road");
G.now = () => t;   // the meeting reads the clock: keep it at the test's time
const p0 = CARAVANS.pos(cv, t), p1 = CARAVANS.pos(cv, t + 60);
const moved = G.pxDist(p0, p1);
ok(moved > CARAVANS.SPEED * 0.3 && moved <= CARAVANS.SPEED * 1.8, "moves at its pace (roads are quicker) " + moved.toFixed(1));
ok(CVROAD.near(p0, t).some((n) => n.c.id === cv.id && n.d < 0.01), "near at its own spot");
ok(!CVROAD.near([p0[0] + 0.2, p0[1]], t).some((n) => n.c.id === cv.id), "not near from far away");
// a traveller a few px off the caravan, walking somewhere
const mk = (id, lvl) => { const s = G.newSave(id, "P" + id, "nord"); s.level = lvl; for (const k of Object.keys(s.skills)) s.skills[k].lvl += lvl; [s.x, s.y] = p0; s.location = null; G.setHealth(s, G.maxHealth(s)); s.gold = 100; return s; };
const A = mk("A", 25);
ok(!G.startTrip(A, cv.to, WORLD.places[cv.to].slice(0, 2), t), "trip");
ok(CVROAD.canMeet(A), "can meet while travelling");
const off = (d) => [p0[0] + d / G.pxDist([0, 0], [1, 0]), p0[1]];
ok(CVROAD.autoMeet(A, off(CVROAD.MEET_RANGE + 8), t) === null, "no prompt out of range");
ok(CVROAD.autoMeet(A, off(CVROAD.MEET_RANGE - 6), t)?.id === cv.id, "prompt when the road brings you alongside");
ok(CVROAD.meet(A, cv.id, off(CVROAD.TAP_RANGE + 10), t).err, "tap too far away");
const ev = CVROAD.meet(A, cv.id, off(10), t);
ok(ev && !ev.err && A.trip.status === "event" && CVROAD.isMeet(A.trip.event), "meeting pauses the trip");
ok(CVROAD.autoMeet(A, off(5), t + 5) === null || A.trip.status !== "travel", "no second prompt right away");
const ch = G.eventChoices(A).map((x) => x[0]);
ok(["trade", "news", "escort", "join", "rob", "leave"].every((k) => ch.includes(k)), "choices " + ch.join(","));
// trade: the caravan's own stock, different per caravan run
const tr = G.eventChoice(A, "trade", t);
ok(tr.shop && tr.shop.length >= 3 && A.trip.status === "event", "trade opens the packs");
const other = CARAVANS.all(t).find((x) => x.id !== cv.id);
ok(JSON.stringify(CVROAD.make(A, other, t).stock) !== JSON.stringify(ev.stock) || other.line.khajiit === cv.line.khajiit, "stock differs between caravans");
// news: a lead or a place on your map
const known0 = A.discovered.length;
A.trip.event.shop = null;
const nw = G.eventChoice(A, "news", t);
ok(/marked on your map|Nothing worth/.test(nw.text) && A.trip.status === "event", "news: " + nw.text.slice(0, 90));
ok(A.discovered.length >= known0, "discovered");
ok(!G.eventChoices(A).some((x) => x[0] === "news"), "news only once");
// escort: pay for the rest of the road, trip follows the wagons
const pay = CVROAD.escortPay(A, cv, t), pool = CARAVANS.plan(cv).pool, left = 1 - CVROAD.frac(cv, t);
ok(Math.abs(pay - Math.max(30, Math.round(pool * left * CVROAD.ESCORT_RATE))) <= 1, "pay formula " + pay + " pool " + pool);
ok(CVROAD.escortPay(A, cv, t + (cv.arrive - t) / 2) < pay, "later on the road pays less");
const es = G.eventChoice(A, "escort", t);
ok(/gold when we roll into/.test(es.text) && A.caravanJob?.escort && A.trip.caravan === cv.id && A.trip.speed === CARAVANS.SPEED && A.trip.destName === cv.to && A.trip.status === "travel", "escort set up");
ok(G.pxDist([A.x, A.y], CARAVANS.pos(cv, t)) < 1, "you stand by the wagons");
// walk the road to the stop, fighting the caravan's ambushes; arrive with the wagons
const gold0 = A.gold; let amb = 0, guard = 0;
G.setAllyProvider(() => [{ name: "Caravan guard", dmg: 10 }]);
while (A.trip && guard++ < 400) {
  const out = G.advance(A, Math.min(cv.arrive + 5, A.trip.lastTick + 60));
  if (out.encounter) { amb++; ok(out.encounter.caravan, "caravan ambush"); A.trip.status = "travel"; A.trip.encounter = null; }   // the guards drive them off (fights are tested elsewhere)
  if (out.arrived) break;
}
ok(A.location === cv.to, "arrived with the caravan at " + A.location);
ok(CARAVANS.arrived(A, []) === null, "town guard pay doesn't double-pay an escort");
const msg = CVROAD.arrived(A);
ok(msg && A.gold - gold0 >= pay && !A.caravanJob, "escort paid " + (A.gold - gold0) + " (pay " + pay + ")");
ok(CVROAD.arrived(A) === null, "paid once");
// walking with them: fewer ambushes, only while you stay close
const B = mk("B", 10); G.startTrip(B, cv.to, WORLD.places[cv.to].slice(0, 2), t);
CVROAD.meet(B, cv.id, off(5), t); G.eventChoice(B, "join", t);
ok(B.trip.status === "travel" && CVROAD.ambushMult(B, t + 1) === CVROAD.SAFE_MULT, "safer beside the wagons");
[B.x, B.y] = off(CVROAD.NEAR + 30); ok(CVROAD.ambushMult(B, t + 1) === 1, "not when you wander off");
[B.x, B.y] = p0; ok(CVROAD.ambushMult(B, t + 3600) === 1, "wears off");
// robbing: a bounty and a fight
const R = mk("R", 30); G.startTrip(R, cv.to, WORLD.places[cv.to].slice(0, 2), t);
CVROAD.meet(R, cv.id, off(5), t); const hold = G.holdAt(p0);
const rb = G.eventChoice(R, "rob", t);
ok(rb.fight && (R.bounty || {})[hold] >= 200, "rob: fight + bounty " + JSON.stringify(R.bounty));
ok(R.cvRoad.robbed[cv.id], "they remember you");
if (R.trip && R.trip.status === "travel") { const again = CVROAD.meet(R, cv.id, CARAVANS.pos(cv, t + 1), t + 1); ok(again.robbed && G.eventChoices(R).every((x) => ["rob", "leave"].includes(x[0])), "no trading after a robbery"); }
// not while in a carriage or already guarding
const Cg = mk("C", 5); G.startTrip(Cg, cv.to, WORLD.places[cv.to].slice(0, 2), t); Cg.trip.carriage = true; ok(!CVROAD.canMeet(Cg) && CVROAD.meet(Cg, cv.id, p0, t).err, "no meeting from a carriage");
console.log("caravan road ok · escort pay", pay, "of pool", pool, "· ambushes on the way", amb, "· rob:", rb.fight.won ? "won" : "lost");
`, c);
