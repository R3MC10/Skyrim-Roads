const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Road encounters (encounters.js): every encounter rolls where it should, every choice resolves without errors,
   rewards stay sane, rates and cooldowns behave. W=/path/to/web/ node test_encounters.js → "encounters ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
const F = ["data.js", "world.js", "terrain.js", "solworld.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "civilwar.js", "daedric.js", "horses.js", "horsetravel.js", "hall.js", "bounty.js", "cooking.js", "curses.js", "smithing.js", "craftfair.js", "roam.js", "encounters.js", "solstheim.js", "explore.js", "ammo.js", "tomes.js", "magic.js", "combatai.js", "shouts2.js"];
for (const f of F) if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (e) { if (!/shouts2/.test(f)) throw e; } }
vm.runInContext(`
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };
const T = G.now();
function hero(lv = 20, place = "Whiterun") {
  const s = G.newSave("enc" + Math.random(), "Remi", "nord"); s._test = true; s.level = lv; s.location = place; [s.x, s.y] = WORLD.places[place];
  for (const k in s.skills) s.skills[k].lvl = 40;
  G.give(s, "iron_sword"); G.equip(s, s.inv[s.inv.length - 1].id); G.give(s, "potion_health", 3); G.give(s, "food_venison", 2);
  s.gold = 5000; G.setHealth(s, G.maxHealth(s)); return s;
}
function onRoad(s, dest = "Riverwood") { s.location = null; const r = G.startTrip(s, dest, WORLD.places[dest], T); return r; }

// 1. the module is wired in
ok(typeof ENC !== "undefined" && ROAD_EVENTS.__enc, "ROAD_EVENTS wrapped");
ok(ENC.L.length >= 28, "lots of encounters: " + ENC.L.length);
ok(typeof ENC.decide === "function" && ENC.canDecide({}) === true, "decide + default canDecide");
ok(TOWNS.FOLLOWERS.meeko && TOWNS.FOLLOWERS.meeko[6] === "dog", "Meeko the dog exists");

// 2. every encounter and every choice resolves (many times, varied heroes) with sane results
const goldIn = {}, errs = [];
for (const def of ENC.L) {
  let ran = 0;
  for (let k = 0; k < 14; k++) {
    const place = def.id === "ashfall" || def.id === "riekraid" ? "Raven Rock" : def.id === "wreck" ? "Dawnstar" : "Whiterun";
    const dest = place === "Raven Rock" ? "Skaal Village" : place === "Dawnstar" ? "Winterhold" : "Riverwood";
    const s = hero([1, 8, 20, 40][k % 4], place);
    if (def.id === "thugs") s.bounty = { Whiterun: 400 };
    if (def.id === "vigilant" && k % 2) s.vampire = { since: T - 9e5 };
    if (!WORLD.places[dest]) continue;
    onRoad(s, dest);
    let ev;
    try { ev = { id: def.id, title: def.title, enc: true, ...def.make(s, ENC.ctx(s)) }; } catch (e) { errs.push(def.id + " make: " + e.message); continue; }
    ok(ev.text && ev.text.length > 20, def.id + " has text");
    s.trip.status = "event"; s.trip.event = ev;
    const chs = ROAD_EVENTS.choices(ev, s);
    ok(chs.length >= 1 && chs.every(([a, l]) => a && l), def.id + " has choices");
    const [cKey] = chs[k % chs.length];
    const g0 = s.gold;
    let r;
    try { r = ENC.decide(s, cKey); } catch (e) { errs.push(def.id + "." + cKey + ": " + e.stack.split("\\n").slice(0, 3).join(" | ")); continue; }
    ok(r && typeof r.text === "string", def.id + "." + cKey + " returns text");
    ok(!/undefined|NaN|\\[object/.test(r.text), def.id + "." + cKey + " clean text: " + r.text);
    ok(Number.isFinite(s.gold) && s.gold >= 0, def.id + " gold finite");
    const gained = s.gold - g0; goldIn[def.id] = Math.max(goldIn[def.id] || 0, gained);
    if (!r.keep && !r.fight && !r.died) ok(s.trip && s.trip.status !== "event", def.id + "." + cKey + " ends the event");
    ran++;
  }
  ok(ran > 0, def.id + " ran");
}
for (const e of errs) ok(false, e);
for (const [id, g] of Object.entries(goldIn)) ok(g < 4000, id + " reward sane: " + g);

// 3. every choice of every encounter at least once (deterministic sweep)
for (const def of ENC.L) {
  const place = def.id === "ashfall" || def.id === "riekraid" ? "Raven Rock" : def.id === "wreck" ? "Dawnstar" : "Whiterun";
  const dest = place === "Raven Rock" ? "Skaal Village" : place === "Dawnstar" ? "Winterhold" : "Riverwood";
  const probe = hero(20, place); if (def.id === "thugs") probe.bounty = { Whiterun: 400 }; onRoad(probe, dest);
  const ev0 = { id: def.id, ...def.make(probe, ENC.ctx(probe)) };
  for (const [key] of ROAD_EVENTS.choices(ev0, probe)) {
    const s = hero(25, place); if (def.id === "thugs") s.bounty = { Whiterun: 400 }; onRoad(s, dest);
    const ev = { id: def.id, title: def.title, enc: true, ...def.make(s, ENC.ctx(s)) }; s.trip.status = "event"; s.trip.event = ev;
    try { const r = ENC.decide(s, key); ok(r && typeof r.text === "string" && !/undefined|NaN/.test(r.text), def.id + "." + key + " sweep: " + (r && r.text)); }
    catch (e) { ok(false, def.id + "." + key + " threw " + e.message); }
  }
}

// 4. region and context rules
{ const s = hero(20, "Whiterun"); onRoad(s); const el = ENC.eligible(s).ok.map((e) => e.id);
  ok(!el.includes("ashfall") && !el.includes("riekraid"), "no Solstheim encounters in Skyrim");
  ok(!el.includes("thugs"), "no thugs without a bounty");
  s.bounty = { Whiterun: 300 }; ok(ENC.eligible(s).ok.some((e) => e.id === "thugs"), "thugs when wanted"); }
{ const s = hero(20, "Raven Rock"); onRoad(s, "Skaal Village"); const el = ENC.eligible(s).ok.map((e) => e.id);
  ok(el.includes("ashfall") || el.includes("riekraid"), "Solstheim encounters on Solstheim: " + el.join(","));
  ok(!el.includes("thalmor") && !el.includes("khajiit") && !el.includes("giant"), "no mainland-only ones on Solstheim"); }
{ const s = hero(1, "Whiterun"); onRoad(s); const el = ENC.eligible(s).ok.map((e) => e.id);
  ok(!el.includes("dragonfly") && !el.includes("assassin"), "low levels: no dragons or assassins"); }

// 5. rolling: varied, cooldown avoids repeats, once-only ones stay once
{ const s = hero(20); onRoad(s); const ids = []; for (let i = 0; i < 300; i++) { const e = ENC.roll(s); if (e) ids.push(e.id); }
  const kinds = new Set(ids); ok(kinds.size >= 14, "variety over 300 rolls: " + kinds.size);
  let rep = 0; for (let i = 1; i < ids.length; i++) if (ids[i] === ids[i - 1]) rep++; ok(rep === 0, "never the same twice in a row");
  ok(ids.filter((x) => x === "dog").length <= 1 && ids.filter((x) => x === "mudcrab").length <= 1, "once-only encounters"); }
{ const s = hero(20); onRoad(s); let mine = 0; for (let i = 0; i < 2000; i++) { const e = ROAD_EVENTS.roll(s); if (ENC.has(e.id)) mine++; }
  ok(mine / 2000 > 0.55 && mine / 2000 < 0.9, "mix of new encounters and old roadside events: " + (mine / 2000).toFixed(2)); }

// 6. fights through encounters: custom foes fight, rewards after a win
{ let won = 0, after = 0;
  for (let i = 0; i < 30; i++) { const s = hero(12); for (const k in s.skills) s.skills[k].lvl = 60; for (const it of ["steel_sword", "steel_armor", "steel_helmet", "steel_boots", "steel_gauntlets", "steel_shield"]) if (D.ITEMS[it]) { G.give(s, it); G.equip(s, s.inv[s.inv.length - 1].id); } G.setHealth(s, G.maxHealth(s)); onRoad(s); const def = ENC.byId.necro; const ev = { id: "necro", enc: true, ...def.make(s, ENC.ctx(s)) }; s.trip.status = "event"; s.trip.event = ev;
    const r = ENC.decide(s, "fight"); ok(r.fight, "necro fight happened"); if (r.fight && r.fight.won) { won++; if (/On the altar/.test(r.text)) after++; } }
  ok(won > 10, "a strong hero beats a necromancer usually: " + won); ok(after === won, "after-fight loot on every win " + after + "/" + won); }

// 7. Meeko joins and fights as a dog
{ const s = hero(20); onRoad(s); const ev = { id: "dog", enc: true, ...ENC.byId.dog.make(s, ENC.ctx(s)) }; s.trip.status = "event"; s.trip.event = ev;
  ENC.decide(s, "take"); ok(s.follower && s.follower.id === "meeko", "Meeko follows");
  const f = new G.Fight(s, { name: "Bandit", health: 80, hp: 80, damage: 5, tags: ["humanoid"], gold: [0, 0] }, null, T);
  ok(f.allies.some((a) => a.kind === "dog" && a.name === "Meeko"), "Meeko fights as a dog"); }

// 8. leader gating
{ const s = hero(20); onRoad(s); const ev = { id: "lost", enc: true, ...ENC.byId.lost.make(s, ENC.ctx(s)) }; s.trip.status = "event"; s.trip.event = ev;
  const keep = ENC.canDecide; ENC.canDecide = () => false; const r = ENC.decide(s, "help"); ok(r.blocked && s.trip.status === "event", "non-leaders can't choose"); ENC.canDecide = keep;
  const r2 = ENC.decide(s, "help"); ok(!r2.blocked && s.trip.status === "travel", "leader chooses"); }

// 9. wild horse taming gives a usable horse
{ let got = 0; for (let i = 0; i < 40; i++) { const s = hero(20); s.skills.Speechcraft.lvl = 100; s.skills.Athletics.lvl = 100; onRoad(s); const ev = { id: "wildhorse", enc: true, ...ENC.byId.wildhorse.make(s, ENC.ctx(s)) }; s.trip.status = "event"; s.trip.event = ev; ENC.decide(s, "calm"); if (s.horse) { got++; ok(s.horse.hp > 0 && HORSES.coat(s.horse.coat), "horse is valid"); } }
  ok(got > 10, "taming works often with high skills: " + got); }

// 10. perks matter on the road (Smooth Talker, Road Wise, Pathfinder, Talk Down / Bribery)
{ const a = hero(20), b = hero(20); onRoad(a); onRoad(b);
  for (const id of ["smooth_talker", "road_wise", "pathfinder", "bribery", "talk_down", "persuasion", "rumour_monger", "long_strider"]) (b.perks = b.perks || {})[id] = 1;
  ok(PERKS.BY_ID.smooth_talker && PERKS.BY_ID.road_wise && PERKS.BY_ID.pathfinder, "new road perks exist");
  ok(ENC.talkCh(b, 0.2) > ENC.talkCh(a, 0.2), "talk perks raise the odds");
  ok(ENC.sneakCh(b, 0.1) > ENC.sneakCh(a, 0.1), "Road Wise helps sneaking");
  ok(ENC.athCh(b) > ENC.athCh(a) && ENC.tameCh(b) > ENC.tameCh(a), "Pathfinder helps running and taming");
  ok(ENC.trackCh(b) > ENC.trackCh(a), "Road Wise reads ambushes");
  ok(ENC.bribeCost(b, 100) < ENC.bribeCost(a, 100) * 0.7, "bribes and tolls cheaper: " + ENC.bribeCost(b, 100) + " vs " + ENC.bribeCost(a, 100)); }
console.log(fails ? "FAILED " + fails + "/" + n : "encounters ok · " + n + " checks · " + ENC.L.length + " encounters");
`, c);
