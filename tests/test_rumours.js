const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* A living world (rumours.js): rumours that come true, your name in the holds, day and night in towns, knocking.
   W=/path/to/game/ node test_rumours.js — prints "rumours ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
let FAKE = Date.now();
class FakeDate extends Date { static now() { return FAKE; } }
const c = { console, Math, Date: FakeDate, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, URLSearchParams, setNow: (ms) => { FAKE = ms; } };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "immerse.js", "rumours.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const ok = (cnd, m) => { n++; if (!cnd) throw new Error("FAIL " + m); };
// move the clock to a given in-game hour (keeps the real-time base)
const atHour = (h) => { let t = G.now(); for (let i = 0; i < 2000 && Math.abs(G.clock(t).hour - h) > 0.2; i++) t += 30; setNow(t * 1000); return t; };
const mk = (town = "Whiterun") => { const s = G.newSave("rw" + Math.random(), "Ysolda", "nord"); s.location = town; [s.x, s.y] = WORLD.places[town]; s.gold = 5000; s.level = 20; s.hpBonus = 2000; G.setHealth(s, G.maxHealth(s)); return s; };

// 1. hearing rumours at the inn and in the streets
atHour(19);
{
  const s = mk(), g0 = s.gold;
  const r = RUMOURS.hear(s, "inn");
  ok(!r.err && r.lead, "inn rumour: " + (r.err || ""));
  ok(s.gold === g0 - TOWNS.rumourPrice(s), "paid for the drink");
  ok(s.discovered.includes(r.lead.place) && WORLD.places[r.lead.place], "the place is on the map: " + r.lead.place);
  ok(RUMOURS.KINDS[r.lead.kind] && r.lead.until > G.now() && /“/.test(r.text) && !/\\{|undefined|NaN/.test(r.text), "lead text: " + r.text);
  ok(RUMOURS.hear(s, "inn").err, "the innkeeper needs time for new gossip");
  ok(!RUMOURS.hear(s, "street").err, "the streets have their own gossip");
  // a third from another town, then the cap
  s.location = "Riverwood"; [s.x, s.y] = WORLD.places.Riverwood;
  ok(!RUMOURS.hear(s, "inn").err, "third lead");
  s.location = "Rorikstead"; [s.x, s.y] = WORLD.places.Rorikstead;
  ok(/already got/.test(RUMOURS.hear(s, "inn").err || ""), "no more than " + RUMOURS.MAX_ACTIVE + " leads");
  ok(RUMOURS.marks(s).length === 3 && RUMOURS.marks(s).every((m) => m.pos.length === 2), "three marks on the map");
  ok(new Set(RUMOURS.leads(s).map((l) => l.place)).size === 3, "different places");
  // leads go cold after a day and a half
  setNow((G.now() + RUMOURS.LIFE_H * 3600 / G.GAME_SPEED + 5) * 1000);
  ok(RUMOURS.leads(s).length === 0 && RUMOURS.marks(s).length === 0, "leads expire");
  const wild = mk(); wild.location = "Bleak Falls Barrow"; ok(RUMOURS.hear(wild, "street").err, "no gossip in a barrow");
}

// 2. how often they're wrong; Good Ear and Speechcraft help
{
  const s = mk(); s.skills.Speechcraft.lvl = 15;
  const a = RUMOURS.falseChance(s, "inn"), b = RUMOURS.falseChance(s, "street");
  ok(a > 0.15 && a < 0.3 && b > a, "street talk is wrong more often (" + a.toFixed(2) + " / " + b.toFixed(2) + ")");
  s.perks = { good_ear: 1 }; ok(Math.abs(RUMOURS.falseChance(s, "inn") - a / 2) < 1e-9, "Good Ear halves it");
  // measured over many rumours
  let wrong = 0, N = 0;
  for (let i = 0; i < 300; i++) { const x = mk(); const r = RUMOURS.hear(x, "inn"); if (r.lead) { N++; if (!r.lead.real) wrong++; } }
  ok(N > 250 && wrong / N > 0.12 && wrong / N < 0.35, "about a quarter are just talk (" + wrong + "/" + N + ")");
  const kinds = new Set(); for (let i = 0; i < 200; i++) { const x = mk(["Whiterun", "Riften", "Windhelm", "Markarth", "Solitude"][i % 5]); const r = RUMOURS.hear(x, "inn"); if (r.lead) kinds.add(r.lead.kind); }
  ok(kinds.size === Object.keys(RUMOURS.KINDS).length, "every kind of rumour turns up: " + [...kinds]);
}

// 3. seeing a lead through
{
  const lead = (s, kind, real) => { for (let i = 0; i < 400; i++) { RUMOURS.st(s).list = []; RUMOURS.st(s).next = {}; const r = RUMOURS.hear(s, "inn"); if (r.lead && r.lead.kind === kind) { r.lead.real = real; return r.lead; } } return null; };
  const go = (s, l) => { s.location = l.place; [s.x, s.y] = WORLD.places[l.place]; s.trip = null; };
  // not there yet
  { const s = mk(), l = lead(s, "bandits", true); ok(l, "got a bandit lead"); ok(/Go to/.test(RUMOURS.act(s, l.id).err || ""), "must go there first"); ok(RUMOURS.card(s) === "", "no card in town"); }
  // just talk
  { const s = mk(), l = lead(s, "shipment", false); go(s, l); ok(/rw-card/.test(RUMOURS.card(s)), "card at the spot"); const g = s.gold; const r = RUMOURS.act(s, l.id);
    ok(r.dud && s.gold === g && !RUMOURS.leads(s).length && RUMOURS.st(s).duds === 1, "false rumour: nothing there"); ok(RUMOURS.act(s, l.id).err, "a lead is used up"); }
  // a lost shipment
  { const s = mk(), l = lead(s, "shipment", true); go(s, l); const g = s.gold, inv = s.inv.length; const r = RUMOURS.act(s, l.id);
    ok(!r.err && s.gold > g && s.inv.length > inv && !r.fight, "shipment found: " + r.text); ok((RUMOURS.st(s).fame[l.hold] || 0) > 0, "people hear about it"); }
  // a named foe: a strong hero wins most of the time, gets paid, and it's a real fight (no one-shot)
  let wins = 0, turns = 0, N = 0;
  for (const kind of ["bandits", "beast", "lights", "rescue"]) for (let i = 0; i < 6; i++) {
    const s = mk(); s.skills["One-Handed"].lvl = 60; const w = G.give(s, "steel_sword"); G.equip(s, w.id ?? s.inv.find((x) => x.item === "steel_sword").id);
    const l = lead(s, kind, true); ok(l, "lead " + kind); go(s, l);
    const g = s.gold, r = RUMOURS.act(s, l.id); N++;
    ok(r.fight && r.fight.e.name, kind + " is a fight with a named foe");
    turns += r.fight.turn;
    if (!r.died) { wins++; ok(s.gold > g && !/\\{|undefined|NaN/.test(r.text), kind + " pays: " + r.text); }
  }
  ok(wins / N >= 0.6, "a well-geared level 20 wins most (" + wins + "/" + N + ")");
  console.log("named foes: " + wins + "/" + N + " won, " + (turns / N).toFixed(1) + " turns on average");
  ok(turns / N >= 2, "fights last a few turns (" + (turns / N).toFixed(1) + ")");
}

// 4. your name in the holds: deeds, crimes, discounts
{
  const s = mk(), base = RUMOURS.standing(s, "Whiterun");
  ok(base.tier === "Stranger" && base.off === 0, "a stranger at first");
  const p0 = G.buyPrice(s, "potion_health", "Whiterun");
  s.cleared = { "Bleak Falls Barrow": G.now() }; s.thaneWhiterun = true; s.dragons = 2; s.homes = { Whiterun: {} };
  const sd = RUMOURS.standing(s, "Whiterun");
  ok(sd.pts >= 25 && sd.off > 0 && sd.deeds.some((d) => /Thane/.test(d)), "deeds add up: " + sd.tier + " " + sd.pts + " " + sd.deeds.join(", "));
  const p1 = G.buyPrice(s, "potion_health", "Whiterun"); ok(p1 < p0, "friends pay less (" + p0 + " → " + p1 + ")");
  RUMOURS.st(s).fame.Whiterun = 30; const hero = RUMOURS.standing(s, "Whiterun");
  ok(/Hero of Whiterun/.test(hero.tier) && Math.abs(hero.off - 0.06) < 1e-9, "Hero of Whiterun: 6% off");
  s.perks = { courtly_manners: 1, local_hero: 1 }; ok(Math.abs(RUMOURS.standing(s, "Whiterun").off - 0.12) < 1e-9, "Local Hero doubles it");
  ok(RUMOURS.standing(s, "The Rift").pts < hero.pts, "other holds know you less");
  s.bounty = { Whiterun: 1000 }; const bad = RUMOURS.standing(s, "Whiterun");
  ok(bad.off === 0 && bad.pts < hero.pts && bad.deeds.some((d) => /bounty/.test(d)), "a bounty drags your name down and ends the discount");
  s.bounty = { Whiterun: 2000 }; s.resisted = { Whiterun: true }; s.cleared = {}; s.thaneWhiterun = false; s.dragons = 0; s.homes = {}; RUMOURS.st(s).fame = {};
  ok(RUMOURS.standing(s, "Whiterun").tier === "Trouble", "criminals are Trouble");
  // what people say
  const t = mk(); t.dragons = 1; t.cleared = { "Bleak Falls Barrow": G.now() };
  const lines = RUMOURS.barks(t, "Whiterun"); ok(lines.some((l) => /dragon/i.test(l)) && lines.some((l) => /Bleak Falls Barrow/.test(l)), "guards talk about your deeds");
  ok(RUMOURS.barks(mk(), "Whiterun").length === 0, "nothing to say about a nobody");
  ok(RUMOURS.barks(t, "Bleak Falls Barrow").length === 0, "no barks outside towns");
  let said = 0; for (let i = 0; i < 40; i++) { const g = RUMOURS.greet(t, { name: "Belethor" + i, role: "merchant", hold: "Whiterun" }); if (g) { said++; ok(typeof g === "string" && g.length > 5, "greeting"); } }
  ok(said > 3 && said < 30, "shopkeepers mention it now and then (" + said + "/40)");
  ok(RUMOURS.greet(t, { name: "x", role: "guard", hold: "Whiterun" }) === null, "greet is for shopkeepers");
}

// 5. day and night: closed shops, knocking, night prices
{
  const s = mk();
  atHour(12); ok(G.shopsOpen() && RUMOURS.knock(s).err, "no need to knock by day");
  const day = G.buyPrice(s, "potion_health", "Whiterun");
  atHour(22); ok(!G.shopsOpen(), "night");
  ok(/closed/.test(G.buy(s, "potion_health")), "closed shops say so");
  ok(/Knock/.test(RUMOURS.townHTML(s, "Whiterun", "general", false)), "closed sign with a knock button");
  const k = RUMOURS.knock(s); ok(!k.err && RUMOURS.knocked(s), "knocked: " + k.text);
  const night = G.buyPrice(s, "potion_health", "Whiterun");
  ok(night > day && night <= Math.ceil(day * 1.2), "night prices a bit higher (" + day + " → " + night + ")");
  const g = s.gold; ok(/Bought/.test(G.buy(s, "potion_health")) && s.gold === g - night, "you can shop after knocking");
  const row = s.inv.find((r) => r.item === "potion_health"); const sellNight = G.sellPrice(s, row, "Whiterun");
  ok(!RUMOURS.knocked(s, "Riverwood") && G.buyPrice(s, "potion_health", "Riverwood") <= day + 1, "the knock is for this town only");
  ok(/Night prices/.test(RUMOURS.townHTML(s, "Whiterun", "general", true)), "the shop says night prices");
  s.perks = { rumour_monger: 1, night_owl: 1 }; ok(G.buyPrice(s, "potion_health", "Whiterun") === day, "Night Owl: no extra charge");
  ok(G.sellPrice(s, row, "Whiterun") >= sellNight, "…and fair prices when selling");
  s.perks = {};
  atHour(9); ok(!RUMOURS.knocked(s) && G.buyPrice(s, "potion_health", "Whiterun") === day, "morning: back to normal");
  // the inn through the day
  const n = [3, 9, 13, 18, 22].map((h) => RUMOURS.crowd(h).n); ok(n[4] > n[3] && n[3] > n[2] && n[2] > n[0], "the inn fills up in the evening: " + n);
  ok([2, 6, 12, 18, 23].every((h) => RUMOURS.dayLine(h)[1].length > 10), "a line for every time of day");
  for (const st of ["ink", "pixel"]) { globalThis.ART = { style: () => st }; const svg = RUMOURS.crowdArt(7, true); ok(/<svg/.test(svg) && !/NaN|undefined/.test(svg) && (st === "pixel") === /crispEdges/.test(svg), st + " crowd picture"); }
}

// 6. the pages
{
  const s = mk(); atHour(21); RUMOURS.hear(s, "inn");
  for (const sec of ["inn", "streets", "general", "blacksmith", "jobs"]) { const h = RUMOURS.townHTML(s, "Whiterun", sec, false); ok(!/NaN|undefined|\\{p\\}/.test(h), sec + " html"); }
  ok(/rw-crowd/.test(RUMOURS.townHTML(s, "Whiterun", "inn", false)) && /Chat with the locals/.test(RUMOURS.townHTML(s, "Whiterun", "streets", false)), "inn crowd and street chat");
  const p = RUMOURS.panel(s); ok(/Word around Skyrim/.test(p) && RUMOURS.HOLDS.every((h) => p.includes(h)) && /qmap/.test(p) && !/NaN|undefined/.test(p), "Journal panel with every hold");
}

// 7. perks: new ones registered with real effects, old ids kept
{
  for (const id of ["good_ear", "local_hero", "night_owl"]) ok(PERKS.BY_ID[id] && PFX.FX[id]?.length, id + " registered");
  for (const id of ["persuasion", "courtly_manners", "rumour_monger", "silver_tongue", "road_wise"]) ok(PERKS.BY_ID[id], "old perk kept: " + id);
  const s = mk(); s.perks = { good_ear: 1, courtly_manners: 1, local_hero: 1, rumour_monger: 1, night_owl: 1 };
  ok(PFX.num(s, "rumtrue") === 0.5 && PFX.num(s, "rumtime") === 0.5 && PFX.num(s, "fame") === 0.25 && PFX.num(s, "heroprice") === 1 && PFX.num(s, "knock") === 1, "effects add up");
  const t0 = G.now(); const r = RUMOURS.hear(s, "inn"); ok(r.lead.until - t0 > RUMOURS.LIFE_H * 3600 / G.GAME_SPEED * 1.4, "Good Ear: leads last longer");
}
console.log("rumours ok · " + n + " checks");
`, c);
