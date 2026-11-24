const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Homestead rooms (hsrooms.js): garden and cellar, stations (forge, alchemy lab, enchanter), display cases, rest bonus,
// followers living there, raids (fight, talk, household while away), party visits, the four new perks, and the art
// (outside and cut-open inside, every stage, both styles) without NaN. Balance: raid fights at levels 10/20/30.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
const files = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "cooking.js", "smithing.js", "ammo.js", "tomes.js", "magic.js", "gather.js", "halls.js", "visits.js", "homestead.js", "hsrooms.js", "mp.js", "patchnotes.js", "i18n_story.js", "i18n_hsrooms.js", "i18n_living.js", "i18n_bonds.js", "i18n_accounts.js", "i18n.js"];
for (const f of files) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0, n = 0;
c.ok = (cond, msg) => { n++; if (!cond) { fails++; console.log("FAIL", msg); } else console.log("ok  ", msg); };
const SIM = fs.readFileSync(__dirname + "/test_bal_sim.js", "utf8");
vm.runInContext(SIM.slice(SIM.indexOf("const LEVELS"), SIM.indexOf("const BUILDS")) + `
var ART = { html: () => "<img>" }; var NPCART = { follower: () => "" };
const H = HOMESTEAD, X = HSROOMS, DAY = H.DAY;
function hero(town = "Falkreath") { const s = G.newSave("p" + Math.random(), "Builder", "nord"); s.level = 20; s.location = town; [s.x, s.y] = WORLD.places[town]; s.gold = 50000; G.setHealth(s, G.maxHealth(s)); return s; }
const total = (s, item) => s.inv.filter((r) => r.item === item).reduce((a, r) => a + r.qty, 0);
const FULL = { log: 999, stone: 999, clay: 999, nails: 999, hinge: 99, lock: 99, fittings: 99, glass: 99 };
let t = Math.floor(G.now() / DAY) * DAY + 10;
function owner(town = "Falkreath", wings = []) { const s = hero(town), pid = H.BY_TOWN[town]; H.buyDeed(s, t); Object.assign(H.plot(s, pid).stock, FULL); H.build(s, pid, "small", t); H.build(s, pid, "hall", t); for (const w of wings) H.build(s, pid, w, t); return [s, pid, H.plot(s, pid)]; }

// ---- rooms: garden and cellar don't use wing spaces, cost materials
{ const s = hero(), pid = H.BY_TOWN.Falkreath; H.buyDeed(s, t); const h = H.plot(s, pid);
  ok(Array.isArray(h.rooms) && h.beds.length === 6 && Array.isArray(h.cellar), "new fields on a fresh plot");
  ok(/small house/.test(H.build(s, pid, "garden", t).err || ""), "garden needs the small house");
  Object.assign(h.stock, FULL); H.build(s, pid, "small", t);
  ok(/main hall/.test(H.build(s, pid, "cellar", t).err || ""), "cellar needs the main hall");
  const before = { ...h.stock }, cost = H.costOf(s, "garden");
  ok(H.build(s, pid, "garden", t).title && h.rooms.includes("garden"), "garden built");
  ok(Object.entries(cost).every(([k, q]) => before[k] - h.stock[k] === q), "the garden used up its materials");
  H.build(s, pid, "hall", t);
  for (const w of ["armory", "kitchen", "trophy"]) H.build(s, pid, w, t);
  ok(/three wing/.test(H.build(s, pid, "alchemy", t).err || ""), "still three wing spaces");
  ok(H.build(s, pid, "cellar", t).title && h.rooms.includes("cellar") && h.wings.length === 3, "cellar built without a wing space");
  ok(H.build(s, pid, "cellar", t).err, "no second cellar");
  s.perks = { ...(s.perks || {}), master_builder: 1 };
  ok(H.slots(s) === 4 && H.build(s, pid, "alchemy", t).title && h.wings.length === 4, "Master Builder: a fourth wing");
  ok(/4 wing/.test(H.build(s, pid, "enchanter", t).err || ""), "and no fifth");
  ok(H.keepDays(s, pid) === 2, "cellar keeps goods a day longer (no steward, no storage room)");
  // old saves without the new fields still work
  const old = { t, small: t, hall: t, wings: ["kitchen"], stock: {}, cd: {}, col: { kitchen: t }, store: [], steward: false };
  const s2 = hero(); s2.homestead = { pinewatch: old }; ok(H.plot(s2, "pinewatch").rooms.length === 0 && H.townHTML(s2, String).body.length > 100, "old homestead save opens");
}

// ---- the garden grows what you plant
{ const [s, pid, h] = owner(); H.build(s, pid, "garden", t);
  G.give(s, "ing_lavender", 2); G.give(s, "iron_dagger", 1);
  const row = s.inv.find((r) => r.item === "ing_lavender"), dag = s.inv.find((r) => r.item === "iron_dagger");
  ok(/won't grow/.test(X.plant(s, pid, 0, dag.id).err || ""), "can't plant a dagger");
  ok(X.plant(s, pid, 0, row.id).text && h.beds[0].item === "ing_lavender" && total(s, "ing_lavender") === 1, "planted lavender (one used)");
  ok(H.collect(s, pid, t + 60).err, "nothing ready right away");
  const l0 = total(s, "ing_lavender"); H.collect(s, pid, t + DAY + 5);
  ok(total(s, "ing_lavender") - l0 === 2, "a bed gives 2 a day");
  s.perks = { ...(s.perks || {}), green_thumb: 1 }; const l1 = total(s, "ing_lavender"); H.collect(s, pid, t + 2 * DAY + 10);
  ok(total(s, "ing_lavender") - l1 === 4, "Green Thumb doubles it");
  ok(X.uproot(s, pid, 0).text && !h.beds[0], "dug it up");
}

// ---- stations at home
{ const [s, pid, h] = owner("Morthal");   // Morthal has no blacksmith
  ok(!SMITH.atForge(s), "no forge in Morthal");
  H.build(s, pid, "armory", t); ok(SMITH.atForge(s) && X.station(s, "forge"), "the armory is a forge at home");
  G.give(s, "mat_iron", 10); G.give(s, "mat_strips", 5); G.give(s, "mat_leather", 5);
  const made = SMITH.make(s, "iron_dagger"); ok(/dagger|Dagger/.test(made) && !/need a forge/.test(made), "made a dagger at home: " + made.slice(0, 60));
  const dg = s.inv.find((r) => r.item === "iron_dagger"); const before = TOWNS.temperInfo ? null : null;
  const t0 = TOWNS.temper(s, dg.id); ok(/hammer/.test(t0), "improved at the home forge");
  const per0 = dg.temper; s.perks = { ...(s.perks || {}), hearth_forge: 1 }; TOWNS.temper(s, dg.id);
  ok(dg.temper - per0 === 2 || /can't improve/.test(TOWNS.temper(s, dg.id)), "Hearth Forge adds 1 more at home (" + per0 + " → " + dg.temper + ")");
  ok(H.produce(s, "armory").items[0][1] === 18, "Hearth Forge: 18 arrows a day");
  s.trip = { dest: [0, 0] }; ok(!SMITH.atForge(s), "not while travelling"); s.trip = null;
  s.location = "Whiterun"; ok(!X.station(s, "forge"), "the home forge stays at home"); s.location = "Morthal";
  // enchanter: Morthal has a wizard anyway, so test at Falkreath
  const [e, ep] = owner("Falkreath"); ok(!ENCH.atEnchanter(e), "no enchanter in Falkreath");
  const k0 = ENCH.strength(e, "soul_gem_common"); H.build(e, ep, "enchanter", t);
  ok(ENCH.atEnchanter(e) && Math.abs(ENCH.strength(e, "soul_gem_common") / k0 - 1.1) < 1e-9, "enchanter's tower: an enchanter at home, +10%");
  // alchemy lab: +10% potency at home
  const [a, ap] = owner("Dawnstar");
  const brew = () => { G.give(a, "ing_blue_flower", 1); G.give(a, "ing_wheat", 1); const r1 = a.inv.find((r) => r.item === "ing_blue_flower"), r2 = a.inv.find((r) => r.item === "ing_wheat");
    TOWNS.brew(a, [r1.id, r2.id]); const p = a.inv.filter((r) => r.item.startsWith("brew|")).pop(); a.inv = a.inv.filter((r) => r !== p); return +p.item.split("|")[1].split(",")[0].split(":")[1]; };
  const m1 = brew(); H.build(a, ap, "alchemy", t); const m2 = brew();
  ok(X.bonus(a, "alch") === 0.1 && m2 > m1 && Math.abs(m2 / m1 - 1.1) < 0.08, "alchemy lab: stronger potions at home (" + m1 + " → " + m2 + ")");
}

// ---- rest bonus: hearth and breakfast
{ const s = hero(), pid = H.BY_TOWN.Falkreath; H.buyDeed(s, t); Object.assign(H.plot(s, pid).stock, FULL); H.build(s, pid, "small", t);
  H.sleep(s, pid, t); ok(s.restBonus === 0.1, "small house: Well Rested +10%"); const d1 = s.rested - t;
  H.build(s, pid, "hall", t); H.sleep(s, pid, t); ok(s.restBonus === 0.15, "main hall hearth: +15%");
  H.build(s, pid, "kitchen", t); H.sleep(s, pid, t); ok(Math.abs((s.rested - t) / d1 - 1.5) < 1e-9, "kitchen breakfast: lasts 1.5× as long"); }

// ---- cellar and display cases
{ const [s, pid, h] = owner("Falkreath", ["trophy"]); H.build(s, pid, "cellar", t);
  G.give(s, "iron_dagger", 1); G.give(s, "gem_ruby", 1); G.give(s, "steel_sword", 1);
  const dag = s.inv.find((r) => r.item === "iron_dagger");
  ok(X.cellarPut(s, pid, dag.id).text && h.cellar.length === 1 && !total(s, "iron_dagger"), "dagger down to the cellar");
  s.inv = []; ok(h.cellar.length === 1, "cellar untouched when you lose your pack");
  ok(X.cellarTake(s, pid, 0).text && total(s, "iron_dagger") === 1, "brought it up");
  for (let i = 0; i < X.CELLAR_CAP; i++) h.cellar.push({ item: "ing_salt", qty: 1 }); const r2 = s.inv.find((r) => r.item === "iron_dagger");
  ok(/full/.test(X.cellarPut(s, pid, r2.id).err || ""), "cellar holds 40");
  ok(X.casesCap(h) === 6, "main hall 2 + trophy room 4 display cases");
  G.give(s, "steel_sword", 1); G.give(s, "gem_ruby", 1);
  G.give(s, "ing_salt", 1); ok(/Visitors/.test(X.show(s, pid, s.inv.find((r) => r.item === "ing_salt").id).err || ""), "only worthy things on show");
  ok(X.show(s, pid, s.inv.find((r) => r.item === "steel_sword").id).text && X.show(s, pid, s.inv.find((r) => r.item === "gem_ruby").id).text && h.cases.length === 2, "sword and ruby on show");
  const per = h.cases.reduce((a, r) => a + X.caseGold(s, r), 0); ok(per >= 10 && per <= 50, "cases earn " + per + " gold a day");
  const g0 = s.gold; h.xcol.cases = t; for (const w of h.wings) h.col[w] = t + DAY;   // only the cases this time
  H.collect(s, pid, t + DAY + 5); ok(s.gold - g0 === per, "collected the visitors' gold for the cases");
  s.perks = { ...(s.perks || {}), gracious_host: 1 }; ok(h.cases.reduce((a, r) => a + X.caseGold(s, r), 0) === 2 * per, "Gracious Host doubles it");
  ok(X.unshow(s, pid, 0).text && total(s, "steel_sword") >= 1 && h.cases.length === 1, "took the sword back out");
  const rec = VISITS.record(s); ok(rec && rec.hs?.pinewatch?.cases?.[0]?.item === "gem_ruby" && rec.hs.pinewatch.rooms.includes("cellar"), "published record carries the homestead");
}

// ---- followers live there
{ const [s, pid, h] = owner(); s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; ok(!TOWNS.hire(s, "jenassa", t).includes("isn't") , "hired Jenassa"); s.location = "Falkreath";
  ok(s.follower?.id === "jenassa", "Jenassa follows");
  ok(X.moveIn(s, pid, t).text && !s.follower && h.res[0].id === "jenassa", "Jenassa moves in");
  s.location = "Whiterun"; ok(/lives at your homestead/.test(TOWNS.hire(s, "jenassa", t)), "can't hire her twice while she lives there"); s.location = "Falkreath";
  const lg = h.stock.log, st = h.stock.stone; H.collect(s, pid, t + DAY + 5);
  ok(h.stock.log - lg === 3 && h.stock.stone - st === 2, "she brings in 3 logs and 2 stone a day");
  ok(X.defenders(s, pid).some((d) => d.name === "Jenassa"), "she defends the house");
  const g0 = s.gold; ok(X.callOut(s, pid, 0, t).text && s.follower?.id === "jenassa" && s.gold === g0 && !h.res.length, "fetched her back for free");
  s.follower = { id: H.stewardId(pid), hp: 100, ts: t }; ok(/steward/.test(X.moveIn(s, pid, t).err || ""), "a steward can't 'move in'"); s.follower = null;
  const small = hero(); H.buyDeed(small, t); Object.assign(H.plot(small, "pinewatch").stock, FULL); H.build(small, "pinewatch", "small", t); small.follower = { id: "erik", hp: 50, ts: t };
  ok(/main hall/.test(X.moveIn(small, "pinewatch", t).err || ""), "followers need the main hall to live there");
  h.res = [{ id: "erik" }, { id: "belrand" }, { id: "vorstag" }]; s.follower = { id: "stenvar", hp: 99, ts: t }; ok(/sleeps 3/.test(X.moveIn(s, pid, t).err || ""), "up to 3 live there");
}

// ---- raids
{ const [s, pid, h] = owner("Falkreath", ["storage"]); H.build(s, pid, "cellar", t);
  ok(X.tick(s, pid, t) === null && h.raidAt > t + 2 * DAY, "first raid is days away");
  ok(!h.raid && X.tick(s, pid, h.raidAt - 1) === null && !h.raid, "no raid before it's due");
  X.tick(s, pid, h.raidAt + 10); ok(!!h.raid && X.RAIDERS[h.raid.kind], "raid starts when due: " + h.raid.kind);
  const v = H.townHTML(s, String); ok(/Defend the house/.test(v.body), "the screen calls you to defend");
  // win a fight
  s.level = 30; s.hpBonus = 400; G.give(s, "steel_sword", 1); G.equip(s, s.inv.find((r) => r.item === "steel_sword").id); G.setHealth(s, G.maxHealth(s));
  let won = 0, lost = 0, tries = 0;
  while ((won === 0 || lost === 0) && tries++ < 60) {
    h.raid = { kind: "bandits", t }; h.stock.log = 100; X.BAND.hp = won ? 1.8 : 0.1; G.setHealth(s, G.maxHealth(s), t);   // a weak band first (won), then the real one against an ungeared hero (lost)
    const r = X.defend(s, pid, t);
    if (r.fight.won) { won++; ok(!h.raid && h.raidAt > t && /gold/.test(r.text), "won: raid over, gold taken off them"); }
    else { lost++; ok(!h.raid && h.stock.log === 75 && G.curHealth(s, t) > 0, "lost: they took a quarter of the logs (" + h.stock.log + ")"); }
  }
  X.BAND.hp = 1.8; ok(won && lost, "raids can be won and lost");
  // plunder spares storage and cellar
  h.store.push({ item: "iron_dagger", qty: 1 }); h.cellar.push({ item: "gem_ruby", qty: 1 }); h.raid = { kind: "trolls", t };
  for (const w of h.wings) h.col[w] = t - 2 * DAY;
  ok(/don't listen/.test(X.parley(s, pid, t).err || ""), "trolls can't be talked down");
  X.autoDefend.length; const st0 = h.store.length, ce0 = h.cellar.length;
  Math.random = () => 0.99; X.tick(s, pid, t + DAY + 1);
  ok(!h.raid && h.store.length === st0 && h.cellar.length === ce0 && /carried off/.test(h.last), "household lost the raid while you were away: storage and cellar untouched");
  ok(Object.values(H.ready(s, pid, t + DAY + 1)).every((d) => d === 0), "the waiting goods were taken");
  // household wins while you're away: spoils to collect
  h.raid = { kind: "bandits", t: t + 3 * DAY }; H.hire(s, pid, t); Math.random = () => 0.01; X.tick(s, pid, t + 4 * DAY + 2);
  ok(!h.raid && h.spoils > 0 && /drove them off/.test(h.last), "your steward drove them off: " + h.spoils + " gold waiting");
  const g0 = s.gold, sp = h.spoils; H.collect(s, pid, t + 4 * DAY + 3); ok(s.gold - g0 >= sp && !h.spoils, "collected the spoils");
  // talking them down
  const p = (perk) => { let k = 0; for (let i = 0; i < 400; i++) { h.raid = { kind: "bandits", t }; Math.random = Rnd; if (X.parley(s, pid, t).title) k++; } return k / 400; };
  let seed = 7; const Rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  s.skills.Speechcraft.lvl = 40; const p0 = p(); s.perks = { ...(s.perks || {}), call_to_arms: 1 }; const p1 = p();
  ok(p1 > p0 + 0.15, "Call to Arms: talking them down works more often (" + p0.toFixed(2) + " → " + p1.toFixed(2) + ")");
  h.raid = { kind: "bandits", t }; Math.random = () => 0.99; X.parley(s, pid, t); ok(/done talking/.test(X.parley(s, pid, t).err || ""), "one try per raid");
  const d0 = X.defenders({ ...s, perks: {} }, pid)[0].dmg, d1 = X.defenders(s, pid)[0].dmg; ok(Math.abs(d1 / d0 - 1.25) < 1e-6, "Call to Arms: defenders hit 25% harder");
  Math.random = Rnd;
}

// ---- balance: raids are a real fight, not a one-shot (warrior build, levels 10/20/30)
{ const out = [];
  for (const L of [10, 20, 30]) {
    let w = 0, turns = 0, hpLeft = 0; const N = 60;
    for (let i = 0; i < N; i++) {
      const s = make("warrior", L); s.gold = 50000; s.location = "Falkreath"; [s.x, s.y] = WORLD.places.Falkreath; s.homestead = {}; H.buyDeed(s, t); const h = H.plot(s, "pinewatch");
      Object.assign(h.stock, FULL); for (const k of ["small", "hall", "armory", "kitchen", "storage"]) H.build(s, "pinewatch", k, t);
      h.raid = { kind: ["bandits", "trolls", "vampires"][i % 3], t }; G.setHealth(s, G.maxHealth(s), t);
      const r = X.defend(s, "pinewatch", t); if (r.fight.won) w++; turns += r.fight.log.length; hpLeft += Math.max(0, r.fight.hp) / G.maxHealth(s);
    }
    out.push([L, w / N, turns / N, hpLeft / N]);
    ok(turns / N >= 5, "level " + L + ": raid fights last " + (turns / N).toFixed(1) + " turns (no quick wins)");
    ok(w / N >= 0.5 && hpLeft / N < 0.85, "level " + L + ": a warrior wins " + Math.round(100 * w / N) + "% of raids (health left " + Math.round(100 * hpLeft / N) + "%)");
  }
}

// ---- party visits: members see the leader's homestead and can rest and eat there
{ const [lead, pid] = owner("Falkreath", ["kitchen", "trophy"]); lead.id = "L1"; lead.name = "Leader";
  G.give(lead, "steel_sword", 1); X.show(lead, pid, lead.inv.find((r) => r.item === "steel_sword").id);
  const doc = { id: "L1", ...VISITS.record(lead) }, mem = hero(); mem.id = "M1";
  X.mount({ party: () => ({ id: "p", leader: "L1", leaderName: "Leader", members: [{ id: "L1" }, { id: "M1" }] }), homes: () => [doc] });
  ok(X.leaderHome(mem)?.pid === pid, "member finds the leader's homestead in Falkreath");
  ok(!X.leaderHome(lead), "the leader doesn't visit themselves");
  const v = H.townHTML(mem, String); ok(/Leader's homestead/.test(v.body) && /guestrest/.test(v.body) && /Steel Sword|steel/i.test(v.body), "member sees it (with the deed offer for their own)");
  G.setHealth(mem, 5); ok(H.act(mem, "guestrest", "L1", t).text && G.curHealth(mem) > 5 && mem.restBonus === 0.1, "slept in the guest bed: Well Rested");
  const m0 = mem.inv.length; ok(H.act(mem, "guestmeal", "L1", t).text && mem.inv.length > m0, "ate at the kitchen table");
  ok(/today/.test(H.act(mem, "guestmeal", "L1", t + 10).err || ""), "once a day");
  mem.location = "Morthal"; ok(!X.leaderHome(mem) && H.act(mem, "guestrest", "L1", t).err, "not from another town");
  X.mount({ party: () => null });
}

var Rnd2 = (() => { let k = 3; return () => (k = (k * 16807) % 2147483647) / 2147483647; })();
// ---- Polish: every line on the new screens, raid and guest cards, messages, perks and the patch note has a translation
{ const tr = (x) => I18N.tr(x);
  const names = new Set([...Object.values(D.ITEMS).map((i) => i.name), ...Object.values(TOWNS.FOLLOWERS).map((f) => f[0]), ...Object.values(H.PLOTS).flatMap((p) => [p.name, p.town])]);
  const skip = (x) => !/[a-z]{3}/i.test(x) || names.has(x) || names.has(x.replace(/ ×\\d+$/, "")) || /^[\\d×\\s·/:.,()+%-]+$/.test(x) || /^(Pinewatch|Kacper|Builder)/.test(x);
  const missing = new Set();
  const scan = (html, only) => { for (const m of String(html).replace(/<(script|style)[^>]*>[\\s\\S]*?<\\/\\1>/g, "").matchAll(/>([^<>]+)</g)) { const x = m[1].replace(/&#?\\w+;/g, "'").trim(); if (!x || skip(x)) continue; if (only && !only(x)) continue; if (tr(x) == null) missing.add(x); } };
  const [s, pid, h] = owner("Falkreath", ["armory", "kitchen", "trophy"]); H.build(s, pid, "garden", t); H.build(s, pid, "cellar", t);
  G.give(s, "ing_lavender", 2); G.give(s, "steel_sword", 1); X.plant(s, pid, 0, s.inv.find((r) => r.item === "ing_lavender").id); X.show(s, pid, s.inv.find((r) => r.item === "steel_sword").id);
  s.follower = { id: "jenassa", hp: 99, ts: t };
  for (const v of ["garden", "household"]) scan(X.viewHTML(s, pid, v, String));
  scan(X.homeHTML(s, pid, String));
  h.cases = []; h.cellar = []; h.beds = h.beds.map(() => null); scan(X.homeHTML(s, pid, String)); scan(X.viewHTML(s, pid, "garden", String));
  for (const kind of ["bandits", "vampires", "trolls"]) { h.raid = { kind, t }; scan(X.raidHTML(s, pid, String)); }
  h.raid = null; h.res = [{ id: "lydia" }]; scan(X.householdHTML(s, pid, String));
  H.act(s, "view", "build"); scan(H.townHTML(s, String).body, (x) => /garden|cellar|room|wing|forge|alchemy|enchant|breakfast|display/i.test(x));
  H.act(s, "view", "home"); scan(H.townHTML(s, String).body, (x) => /bed|Well Rested|Household|Display|Garden/i.test(x));
  // guest card
  const doc = { id: "L1", name: "Kacper", ...VISITS.record(s) }, mem = hero(); mem.id = "M1"; doc.hs.pinewatch.raided = true;
  X.mount({ party: () => ({ id: "p", leader: "L1", members: [{ id: "L1" }, { id: "M1" }] }), homes: () => [doc] }); scan(X.guestHTML(mem, String)); X.mount({ party: () => null });
  // messages (toasts and fight results), sentence by sentence as the screen shows them
  const msgs = [];
  const say = (r) => { if (!r) return; for (const k of ["text", "err", "title"]) if (r[k]) msgs.push(r[k]); if (typeof r === "string") msgs.push(r); };
  const [m, mp, mh] = owner("Falkreath", ["kitchen"]); say(H.build(m, mp, "garden", t)); say(H.build(m, mp, "cellar", t)); say(H.build(m, mp, "garden", t)); say(H.sleep(m, mp, t));
  G.give(m, "ing_lavender", 3); G.give(m, "iron_dagger", 1); const lv = () => m.inv.find((r) => r.item === "ing_lavender").id;
  say(X.plant(m, mp, 0, lv())); say(X.plant(m, mp, 0, lv())); say(X.uproot(m, mp, 0)); say(X.uproot(m, mp, 0));
  say(X.cellarPut(m, mp, m.inv.find((r) => r.item === "iron_dagger").id)); say(X.cellarTake(m, mp, 0)); say(X.show(m, mp, 999999)); say(X.unshow(m, mp, 0));
  m.follower = { id: "jenassa", hp: 99, ts: t }; say(X.moveIn(m, mp, t)); m.follower = { id: "erik", hp: 50, ts: t }; say(X.callOut(m, mp, 0, t)); m.follower = null; say(X.callOut(m, mp, 0, t));
  mh.raid = { kind: "bandits", t }; Math.random = () => 0.99; say(X.parley(m, mp, t)); say(X.parley(m, mp, t)); Math.random = () => 0.01; mh.raid = { kind: "vampires", t }; say(X.parley(m, mp, t));
  mh.raid = { kind: "trolls", t }; say(X.parley(m, mp, t)); X.BAND.hp = 0.05; say(X.defend(m, mp, t)); X.BAND.hp = 50; mh.raid = { kind: "trolls", t }; say(X.defend(m, mp, t)); X.BAND.hp = 1.8;
  mh.raid = { kind: "bandits", t }; H.hire(m, mp, t); Math.random = () => 0.01; msgs.push(X.tick(m, mp, t + DAY + 2) || mh.last); mh.raid = { kind: "bandits", t: t + 3 * DAY }; Math.random = () => 0.99; X.tick(m, mp, t + 4 * DAY + 2); msgs.push(mh.last);
  Math.random = Rnd2;
  const lead = { ...doc }; const g = hero(); g.id = "M2"; X.mount({ party: () => ({ id: "p", leader: "L1", members: [{ id: "L1" }, { id: "M2" }] }), homes: () => [lead] });
  say(H.act(g, "guestrest", "L1", t)); say(H.act(g, "guestmeal", "L1", t)); say(H.act(g, "guestmeal", "L1", t + 5)); X.mount({ party: () => null });
  msgs.push(...(m.journal || []).map((n) => n.text).filter((x) => /Drove/.test(x)));
  for (const x of [PATCHNOTES.LIST[0].title, ...PATCHNOTES.LIST[0].items]) msgs.push(x);
  for (const msg of msgs) for (const part of String(msg).split(/(?<=[.!?])\\s+/)) { const x = part.trim(); if (x && !skip(x) && tr(x) == null && I18N.story(x) == null && !/increased to|Skill|skill/.test(x)) missing.add(x); }
  for (const id of ["master_builder", "hearth_forge", "gracious_host", "call_to_arms"]) { const p = PERKS.BY_ID[id]; for (const x of [p.name, ...String(p.desc || "").replace(/\\s*\\[OURS\\]/, "").split(/(?<=[.!?])\\s+/)]) if (x && tr(x) == null && I18N.story(x) == null) missing.add(x); }
  ok(msgs.length > 30 && msgs.some((x) => /came while you were away/.test(x)) && msgs.some((x) => /guest bed/.test(x)), "checked " + msgs.length + " messages");
  ok(missing.size === 0, "Polish for every new line ("+ (missing.size ? [...missing].slice(0, 12).join(" | ") : "all covered") + ")");
  ok(tr("Bed 3") === "Grządka 3" && tr("12 gold a day") === "12 złota dziennie" && /Wypoczęty \\(\\+15%/.test(I18N.story("Full health and Well Rested (+15% skills for 60 minutes)") || ""), "Polish numbers and the bed line");
}
// ---- perks are in the trees with real effects
ok(["master_builder", "hearth_forge", "gracious_host", "call_to_arms"].every((id) => PERKS.BY_ID[id] && PFX.FX[id] && PFX.FX[id].length), "four new perks with effects");
ok(PERKS.BY_ID.master_builder.skill === "Smithing" && PERKS.BY_ID.hearth_forge.skill === "Smithing" && PERKS.BY_ID.gracious_host.skill === "Speechcraft" && PERKS.BY_ID.call_to_arms.skill === "Speechcraft", "two Smithing, two Speechcraft");
ok(["carpenter", "woodsman", "landed_thane", "estate_income"].every((id) => PERKS.BY_ID[id]), "old homestead perk ids kept");

// ---- every view renders; the art draws without NaN in both styles
{ const grad = { addColorStop() {} }; let bad = 0, calls = 0;
  const chk = (a) => { for (const v of a) if (typeof v === "number" && !Number.isFinite(v)) bad++; };
  const g = new Proxy({}, { get(o, k) { if (k === "createLinearGradient" || k === "createRadialGradient") return (...a) => { chk(a); return grad; }; if (k === "measureText") return () => ({ width: 50 }); if (typeof k === "string" && /^(fillStyle|strokeStyle|lineWidth|font|textAlign|globalAlpha)$/.test(k)) return o[k]; return (...a) => { calls++; chk(a); }; }, set(o, k, v) { o[k] = v; return true; } });
  let style = "ink"; const Hh = { seeded: (x) => { let a = String(x).length; return () => ((a = (a * 9301 + 49297) % 233280) / 233280); }, sky() {}, mountains() {}, pines() {}, poly(gg, pts, f, st) { chk(pts.flat()); }, circle(gg, ...a) { chk(a.slice(0, 3)); } };
  var ART = { html: (w, h, draw, o) => { draw(g, Hh, w, h); return "<img class='art " + (o.cls || "") + "' alt='" + (o.alt || "") + "'>"; }, drawingStyle: () => style, H: Hh };
  this.ART = ART; globalThis.ART = ART;
  vm_ok: for (style of ["ink", "pixel"]) {
    const [s, pid, h] = owner("Dawnstar", ["armory", "trophy", "enchanter"]); H.build(s, pid, "garden", t); H.build(s, pid, "cellar", t);
    h.beds[0] = { item: "food_cabbage" }; h.res = [{ id: "lydia" }, { id: "erik" }]; h.cases = [{ item: "steel_sword", qty: 1 }, { item: "gem_ruby", qty: 1 }, { item: "steel_armor", qty: 1 }]; h.cellar = [{ item: "ing_salt", qty: 3 }];
    for (const raid of [null, { kind: "bandits", t }, { kind: "trolls", t }, { kind: "vampires", t }]) { h.raid = raid; ok(/<img/.test(H.scene(pid, h, { ready: true })), style + " outside " + (raid?.kind || "calm")); }
    h.raid = null;
    ok(/<img/.test(X.inside(pid, h)) && /<img/.test(X.thumb("garden")) && /<img/.test(X.thumb("cellar")), style + " inside and thumbnails");
    for (const st of [0, 1, 2]) { const hh = { ...h, small: st >= 1 ? 1 : 0, hall: st >= 2 ? 1 : 0, wings: st >= 2 ? h.wings : [], rooms: st >= 2 ? h.rooms : [] }; X.inside(pid, hh); }
    for (const k of ["build", "gather", "bench", "home", "garden", "household", "steward"]) { H.act(s, "view", k); const v = H.townHTML(s, String); ok(v.body.length > 200 && /hsact/.test(v.body), style + " " + k + " view renders"); }
    h.raid = { kind: "vampires", t }; ok(/Talk them down/.test(H.townHTML(s, String).body), style + " raid card");
  }
  ok(bad === 0, "no NaN in drawing (" + calls + " calls)");
}
`, c);
console.log(fails ? `hsrooms FAILED ${fails}/${n}` : `hsrooms ok · ${n} checks`);
process.exit(fails ? 1 : 0);
