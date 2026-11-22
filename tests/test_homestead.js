const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Homesteads (homestead.js): deeds, gathering, the workbench, building stages and wings with materials used up,
// wing goods per in-game day, storage that survives, the steward (follower), and the four homestead perks.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
const files = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "cooking.js", "smithing.js", "ammo.js", "gather.js", "halls.js", "homestead.js", "mp.js"];
for (const f of files) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0, n = 0;
c.ok = (cond, msg) => { n++; if (!cond) { fails++; console.log("FAIL", msg); } else console.log("ok  ", msg); };
vm.runInContext(`
const H = HOMESTEAD, DAY = H.DAY;
function hero(town = "Falkreath") { const s = G.newSave("p" + Math.random(), "Builder", "nord"); s.level = 20; s.location = town; [s.x, s.y] = WORLD.places[town]; s.gold = 50000; G.setHealth(s, G.maxHealth(s)); return s; }
const total = (s, item) => s.inv.filter((r) => r.item === item).reduce((a, r) => a + r.qty, 0);
let t = Math.floor(G.now() / DAY) * DAY + 10;

// plots
ok(Object.keys(H.PLOTS).length === 3, "three plots");
ok(["Falkreath", "Morthal", "Dawnstar"].every((tn) => H.BY_TOWN[tn] && WORLD.places[tn]), "plots near Falkreath, Morthal and Dawnstar (real places)");
ok(H.sections("Falkreath")[0] === "homestead" && !H.sections("Whiterun").length, "a homestead section only in plot towns");
ok(Object.values(H.PLOTS).every((p) => !/Lakeview|Windstad|Heljarchen/.test(p.name)), "our own plot names");

// deed
const s = hero(); const pid = H.BY_TOWN.Falkreath;
s.location = "Whiterun"; ok(H.buyDeed(s, t).err, "no land for sale in Whiterun"); s.location = "Falkreath";
s.gold = 100; ok(/5000/.test(H.buyDeed(s, t).err), "deed costs 5000"); s.gold = 50000;
const d = H.buyDeed(s, t); ok(d.text && H.plot(s, pid) && s.gold === 45000, "bought the deed");
ok(H.buyDeed(s, t).err, "can't buy it twice");
ok(H.stage(H.plot(s, pid)) === 0, "starts as bare land");

// building needs materials
const h = H.plot(s, pid);
ok(/need/.test(H.build(s, pid, "small", t).err || ""), "small house needs materials");
ok(/small house first/.test(H.build(s, pid, "hall", t).err || ""), "main hall needs the small house");
ok(/main hall/i.test(H.build(s, pid, "library", t).err || ""), "wings need the main hall");

// gathering: cooldowns, tools, amounts
let r = H.gather(s, pid, "saw", t); ok(r.text && h.stock.log >= 4 && h.stock.log <= 6, "sawmill gives 4-6 logs: " + h.stock.log);
ok(H.gather(s, pid, "saw", t + 10).err, "sawmill rests between trips");
ok(H.gather(s, pid, "saw", t + H.GATHER_CD + 1).text, "sawmill works again an in-game hour later");
ok(/pickaxe/.test(H.gather(s, pid, "quarry", t).err || ""), "quarry needs a pickaxe");
G.give(s, "pickaxe", 1); ok(H.gather(s, pid, "quarry", t).text && h.stock.stone >= 3, "quarry gives stone");
ok(H.gather(s, pid, "clay", t).text && h.stock.clay >= 2, "clay pit gives clay");
s.location = "Whiterun"; ok(H.gather(s, pid, "clay", t + 99999).err, "you gather at the plot, not in another town"); s.location = "Falkreath";

// workbench: iron ingots and firewood are used up
ok(/Iron Ingot/.test(H.make(s, pid, "nails", 1).err || ""), "nails need iron ingots");
G.give(s, "mat_iron", 40); G.give(s, "mat_firewood", 20);
r = H.make(s, pid, "nails", 3); ok(r.text && h.stock.nails === 60 && total(s, "mat_iron") === 37, "3 ingots → 60 nails, ingots used");
H.make(s, pid, "hinge", 3); H.make(s, pid, "lock", 3); H.make(s, pid, "fittings", 5);
ok(h.stock.hinge === 6 && h.stock.lock === 3 && h.stock.fittings === 10, "hinges, locks, fittings made");
h.stock.quartz = 0; ok(/quartz/.test(H.make(s, pid, "glass", 1).err || ""), "glass needs quartz");
h.stock.quartz = 10; const fw = total(s, "mat_firewood"); ok(H.make(s, pid, "glass", 2).text && h.stock.glass === 2 && h.stock.quartz === 6 && total(s, "mat_firewood") === fw - 2, "glass from quartz + firewood");

// build the small house: materials consumed
Object.assign(h.stock, { log: 200, stone: 200, clay: 200, nails: 400, hinge: 40, lock: 20, fittings: 60, glass: 60 });
const before = { ...h.stock }, cost = H.costOf(s, "small");
r = H.build(s, pid, "small", t); ok(r.title && h.small, "small house built");
ok(Object.entries(cost).every(([k, q]) => before[k] - h.stock[k] === q), "small house used up its materials");
ok(H.build(s, pid, "small", t).err, "can't build it twice");
ok(H.sleep(s, pid, t).text && s.restBonus === 0.1 && s.rested > t, "own bed: Well Rested");
ok(H.build(s, pid, "hall", t).title && H.stage(h) === 2, "main hall built");

// wings: three slots, no duplicates
ok(H.build(s, pid, "armory", t).title, "armory built");
ok(H.build(s, pid, "armory", t).err, "no second armory");
ok(H.build(s, pid, "greenhouse", t).title && H.build(s, pid, "storage", t).title, "greenhouse and storage built");
ok(/three wing/.test(H.build(s, pid, "library", t).err || ""), "only three wings");

// goods per in-game day
ok(H.collect(s, pid, t + 60).err, "nothing ready right away");
const arrows0 = total(s, "arrow_steel");
r = H.collect(s, pid, t + DAY + 5); ok(r.text && total(s, "arrow_steel") === arrows0 + 12, "armory: 12 steel arrows a day: " + r.text);
ok(H.collect(s, pid, t + DAY + 10).err, "collected: nothing until the next day");
// cap: no steward, storage → 1 + 2 = 3 days; ten days away still only 3
const a1 = total(s, "arrow_steel"); H.collect(s, pid, t + 11 * DAY + 5); ok(total(s, "arrow_steel") - a1 === 36, "goods pile up for 3 days at most (storage room)");

// storage room keeps things through death
G.give(s, "iron_dagger", 1); const row = s.inv.find((x) => x.item === "iron_dagger");
ok(H.stash(s, pid, row.id).text && !s.inv.some((x) => x.item === "iron_dagger") && h.store.length === 1, "stored a dagger");
s.inv = []; ok(h.store.length === 1, "storage is untouched when your pack is lost");
ok(H.unstash(s, pid, 0).text && total(s, "iron_dagger") === 1, "took it back");

// steward
const s2 = hero("Morthal"); const p2 = H.BY_TOWN.Morthal; H.buyDeed(s2, t);
ok(/small house/.test(H.hire(s2, p2, t).err || ""), "steward needs the small house");
Object.assign(H.plot(s2, p2).stock, { log: 99, stone: 99, clay: 99, nails: 99, hinge: 9, lock: 9, fittings: 9, glass: 9 });
H.build(s2, p2, "small", t); const g0 = s2.gold;
ok(H.hire(s2, p2, t).title && s2.gold === g0 - 500 && H.plot(s2, p2).steward, "hired the steward for 500");
ok(H.stewardHome(s2, p2) && H.keepDays(s2, p2) === 3, "steward at home keeps 3 days");
const lg = H.plot(s2, p2).stock.log; ok(H.order(s2, p2, "log").text && H.plot(s2, p2).stock.log === lg + 10, "steward orders logs");
ok(H.follow(s2, p2, t).text && s2.follower && s2.follower.id === H.stewardId(p2), "steward follows you");
ok(TOWNS.FOLLOWERS[s2.follower.id] && TOWNS.followerMax(s2, s2.follower.id) > 0, "steward is a real follower");
ok(!TOWNS.followersHere({ location: "Morthal" }).some(([id]) => id === H.stewardId(p2)), "steward isn't in the town's hireling list");
const f = new G.Fight(s2, G.scaleEnemy({ ...D.ENCOUNTERS[0] }, 5)); ok(f.allies.some((a) => a.follower && a.fid === H.stewardId(p2)), "steward fights beside you");
ok(H.keepDays(s2, p2) === 1 && H.order(s2, p2, "log").err, "away: only a day of goods, no orders");
ok(H.follow(s2, p2, t).text && !s2.follower, "send the steward home");

// perks with real effects
{ const q = hero("Dawnstar"), qp = H.BY_TOWN.Dawnstar;
  q.perks = { ...(q.perks || {}), landed_thane: 1 }; ok(H.deedPrice(q) === 3750 && H.stewardFee(q) === 375, "Landed Thane: deed and steward 25% cheaper");
  q.perks.carpenter = 1; const c0 = H.costOf({ perks: {} }, "hall"), c1 = H.costOf(q, "hall"); ok(c1.log < c0.log && c1.lock >= 1, "Carpenter: fewer materials (" + c0.log + " → " + c1.log + " logs)");
  H.buyDeed(q, t); q.perks.woodsman = 1; let sum = 0; for (let i = 0; i < 30; i++) { const hh = H.plot(q, qp); hh.stock.log = 0; hh.cd = {}; H.gather(q, qp, "saw", t); sum += hh.stock.log; }
  ok(sum / 30 >= 6, "Woodsman: +50% from the sawmill (avg " + (sum / 30).toFixed(1) + ")");
  const hh = H.plot(q, qp); Object.assign(hh.stock, { log: 999, stone: 999, clay: 999, nails: 999, hinge: 99, lock: 99, fittings: 99, glass: 99 });
  H.build(q, qp, "small", t); H.build(q, qp, "hall", t); H.build(q, qp, "trophy", t);
  const gA = q.gold; H.collect(q, qp, t + DAY + 1); const noPerk = q.gold - gA;
  q.perks.estate_income = 1; const gB = q.gold; H.collect(q, qp, t + 2 * DAY + 1); ok(q.gold - gB === noPerk + 15, "Estate Income: +15 gold a wing a day (" + noPerk + " → " + (q.gold - gB) + ")");
  ok(["carpenter", "woodsman", "landed_thane", "estate_income"].every((id) => PERKS.BY_ID[id] && PFX.FX[id]), "four homestead perks in the trees");
}
// every wing makes something real
{ const q = hero(); for (const w of Object.keys(H.WINGS)) { const r = H.produce(q, w); if (w === "storage") continue; ok(r.items.length || r.gold || r.lines.length, w + " makes something"); ok(r.items.every(([id]) => D.ITEMS[id]), w + ": real items"); } }
// the town screen renders without art (ART missing in node is fine for logic, so stub it)
var ART = { html: () => "<img>" }; var NPCART = { follower: () => "" };
{ const q = hero(); let v = H.townHTML(q, (x) => String(x)); ok(/Buy the deed/.test(v.body), "screen offers the deed"); H.buyDeed(q, t);
  for (const k of ["build", "gather", "bench", "home", "steward"]) { H.act(q, "view", k); v = H.townHTML(q, (x) => String(x)); ok(v.body.length > 200 && /hsact/.test(v.body), k + " view renders"); }
  ok(H.act(q, "nope", "").err, "unknown action is refused"); }
`, c);
console.log(fails ? `homestead FAILED ${fails}/${n}` : `homestead ok · ${n} checks`);
process.exit(fails ? 1 : 0);
