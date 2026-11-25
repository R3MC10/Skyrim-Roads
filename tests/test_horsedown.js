// Horses are downed at 0 health, never dead, lost or sent away (horses.js). node test_horsedown.js
// Horses are for travel now (horsetravel.js): road ambushes and fights never hurt the horse, so "downed" comes from old
// saves and HORSES.hurt / knockDown. Covers old-save migration (away / dead / lost / 0 health), recovery (time, sleep,
// stablehand), riding/travel while downed, the road fight leaving the horse alone, and party saves.
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).concat(["mountcombat.js", "horsetravel.js", "caravans.js"]);
const loaded = new Set();
for (const f of FILES) if (!loaded.has(f) && fs.existsSync(W + f)) { loaded.add(f); vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); }
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, HORSES, WORLD } = c;
const T = Date.now() / 1000;
const stables = Object.keys(WORLD.places).find((t) => G.shopTypes(t).includes("stables"));
const noStables = Object.keys(WORLD.places).find((t) => !G.shopTypes(t).includes("stables"));
function hero(weapon = "iron_sword", horse = true) {
  const s = G.newSave("hd" + Math.random(), "Remi", "nord"); s.location = stables; [s.x, s.y] = WORLD.places[stables]; s.gold = 10000; s._test = true;
  if (weapon) { G.give(s, weapon); G.equip(s, s.inv[s.inv.length - 1].id); }
  if (horse) HORSES.buy(s, "Frost", "bay");
  return s;
}
const foe = (hp = 400, dmg = 8, tags = ["humanoid"], name = "Bandit") => ({ name, health: hp, hp, damage: dmg, tags, gold: [0, 0] });
const isDowned = (s, t = T) => !!s.horse && HORSES.downed(s, t) && s.horse.hp === 0 && !HORSES.riding(s, t) && HORSES.present(s);
const noOldFlags = (h) => ["away", "dead", "lost", "fled", "gone", "ranAway"].every((k) => !(k in h));

// 1. road ambush (the travel loop's HORSES.hurt): at 0 health the horse is downed and stays yours
{ const s = hero(); s.horse.hp = 5; s.horse.hpT = T;
  const line = HORSES.hurt(s, foe(50, 40), T, 1);
  ok(isDowned(s), "ambush: downed at 0 health");
  ok(/is downed/.test(line) && !/limps off|dies|dead|lost|runs away/i.test(line), "ambush line says downed: " + line);
  ok(s.horse.name === "Frost" && noOldFlags(s.horse), "ambush: still your horse, no away/dead flags");
  ok(HORSES.hurt(s, foe(50, 40), T, 1) === null && HORSES.downed(s, T), "a downed horse isn't hurt again");
  const capDown = G.capacity(s); ok(capDown >= HORSES.carry(s), "downed horse still carries your things");
  const walk = hero(null, false); [walk.x, walk.y] = [s.x, s.y];
  ok(Math.abs(G.speed(s) - G.speed(walk)) < 1e-6 || G.speed(s) <= G.speed(walk) + 1e-6, "downed: you travel at walking pace");
  const up = hero(); ok(G.speed(up) > G.speed(s), "riding a healthy horse is faster than a downed one"); }
// 1b. the real travel loop never hurts the horse any more (horses are for travel)
{ const src = fs.readFileSync(W + "engine.js", "utf8"); ok(!/HORSES\.hurt\(s, e, stepT/.test(src), "engine's travel loop no longer hurts the horse"); }
{ let fights = 0;
  const rnd = Math.random;
  for (let i = 0; i < 20; i++) {
    const s = hero(); s.horse.hp = 1; s.horse.hpT = T;
    const dest = Object.keys(WORLD.places).find((p) => p !== stables && G.pxDist(WORLD.places[p], WORLD.places[stables]) > 300);
    G.startTrip(s, dest, WORLD.places[dest].slice(0, 2), T); if (!s.trip) continue;
    c.Math.random = () => 0.01;   // every roll hits: an ambush
    try { G.advance(s, T + 3600); } catch (e) { /* engine details aside */ } finally { c.Math.random = rnd; }
    if (s.trip && s.trip.status === "encounter") fights++;
    ok(!!s.horse && noOldFlags(s.horse) && !s.horse.down, "travel: an ambush never downs the horse");
  }
  c.Math.random = rnd;
  ok(fights > 0, "travel loop: ambushes still happen (" + fights + "/20)"); }

// 2. a road fight while riding: on foot, the horse untouched, still riding afterwards
for (let i = 0; i < 30; i++) {
  const s = hero(); s.level = 20; s.hpBonus = 400; s.horse.hp = 3; s.horse.hpT = T; s.location = null;
  G.startTrip(s, "Riverwood", WORLD.places.Riverwood.slice(0, 2), T);
  s.trip.status = "encounter"; s.trip.encounter = G.scaleEnemy({ ...c.D.ENCOUNTERS.find((x) => x.name === "Bandit outlaw") }, 20);
  const r = G.encounterAction(s, "fight", T);
  ok(r && r.fight && !r.fight.mount, "the fight is on foot");
  ok(!HORSES.downed(s, T) && s.horse.hp >= 3 && HORSES.riding(s, T), "the horse is untouched and you ride on");
}
// 2c. the encounter card says the horse waits (or limps behind when downed)
{ const s = hero(); ok(/waits at the edge of the fight/.test(c.MOUNTCOMBAT.note(s)), "encounter note: waits"); HORSES.knockDown(s, T); ok(/downed/.test(c.MOUNTCOMBAT.note(s)), "encounter note: downed"); }

// 3. can't ride while downed
{ const s = hero(); HORSES.knockDown(s, T); ok(/downed/.test(HORSES.toggle(s)) && !HORSES.riding(s), "toggle refuses to ride a downed horse"); }

// 4. recovery: time, sleep, stablehand
{ const s = hero(); HORSES.knockDown(s, T);
  ok(HORSES.downed(s, T + HORSES.REST_MIN * 60 - 5), "still downed just before the time is up");
  ok(HORSES.readyIn(s, T + 60) > 0, "readyIn counts down");
  ok(!HORSES.downed(s, T + HORSES.REST_MIN * 60 + 1) && HORSES.riding(s, T + HORSES.REST_MIN * 60 + 1), "back up after about 6 hours, rideable again");
  ok(s.horse.hp > 0 && s.horse.hp <= HORSES.maxHp(s.horse), "gets up with some health: " + s.horse.hp); }
{ const s = hero(); s.rested = 0; HORSES.knockDown(s, T); s.rested = T + 10 + 2400;   // slept at an inn
  ok(!HORSES.downed(s, T + 20), "back up after you sleep"); }
{ const s = hero(); s.rested = T + 2000; HORSES.knockDown(s, T + 10);   // rested from an earlier sleep doesn't count
  ok(HORSES.downed(s, T + 20), "an old rest doesn't lift it"); }
{ const s = hero(); HORSES.knockDown(s, T); const g = s.gold, p = HORSES.tendPrice(s);
  ok(p > 0 && p <= 60, "tending is cheap: " + p);
  ok(/back on their feet/.test(HORSES.tend(s, T + 1)) && s.gold === g - p && !HORSES.downed(s, T + 1) && s.horse.hp === HORSES.maxHp(s.horse), "stablehand: up, full health, paid");
  const s2 = hero(); HORSES.knockDown(s2, T); s2.location = noStables; ok(/stablehand/.test(HORSES.tend(s2, T + 1)) && HORSES.downed(s2, T + 1), "no stables, no tending");
  const s3 = hero(); HORSES.knockDown(s3, T); s3.gold = 0; ok(/wants/.test(HORSES.tend(s3, T + 1)) && HORSES.downed(s3, T + 1), "no gold, no tending"); }
{ const s = hero(); s.horse.perks = 0; s.perks = s.perks || {}; s.perks.haggling = 1; s.perks.horse_trader = 2; ok(HORSES.tendPrice(s) < HORSES.TEND_PRICE, "Horse Trader makes tending cheaper"); }
{ const s = hero(); ok(HORSES.state(s, T) === "", "fit: no state"); HORSES.knockDown(s, T); ok(HORSES.state(s, T) === "Downed", "state word Downed"); }

// 5. old saves: away / dead / lost / run off / 0 health -> owned and downed
for (const old of [{ away: { town: "Whiterun", until: T + 600 } }, { dead: true }, { lost: true }, { fled: true }, { gone: true }, { ranAway: true }, { hp: 0 }]) {
  const s = hero(null, false); s.horse = Object.assign({ name: "Old", coat: "grey", hp: 0, hpT: T - 10 }, old);
  G.migrate(s);
  ok(!!s.horse && s.horse.name === "Old" && noOldFlags(s.horse) && !!s.horse.down && s.horse.hp === 0, "migrate " + JSON.stringify(old) + " -> owned + downed");
  ok(!HORSES.riding(s) && HORSES.present(s), "migrated horse limps with you, not ridden");
  ok(!HORSES.downed(s, Date.now() / 1000 + HORSES.REST_MIN * 60 + 5), "migrated horse gets back up in time");
}
{ const s = hero(null, false); s.horse = { name: "Old" }; HORSES.fix(s); ok(!s.horse.down && s.horse.hp > 0, "a plain old horse isn't downed"); }

// 6. party: every player's horse is their own
{ const a = hero(), b = hero(); HORSES.knockDown(a, T);
  ok(HORSES.downed(a, T) && !HORSES.downed(b, T) && HORSES.riding(b, T), "one player's downed horse doesn't touch another's");
  if (c.PARTY && c.PARTY.card) { ok(c.PARTY.card(a).ride === null && !!c.PARTY.card(b).ride, "party card: downed horse isn't shown ridden"); } }

// 7. carts still roll behind a downed horse
if (c.CARAVANS) { const s = hero(); s.cart = { parked: null }; HORSES.knockDown(s, T); ok(c.CARAVANS.hasCart(s), "cart still with you behind a downed horse"); }

// 8. no horse-death / sent-away text left
{ const src = ["horses.js", "horsetravel.js", "remind.js", "ui.js", "encounters.js"].map((f) => fs.readFileSync(W + f, "utf8")).join("\n");
  ok(!/limps off|dead horse|horse dies|horse is dead|HORSES\.away|HORSES\.fetch|HORSES\.hurry/.test(src), "no old horse-loss text or API left"); }

// 10. Polish: the new lines translate (i18n_horsedown.js, loaded before i18n.js)
{ const html = fs.readFileSync(W + "index.html", "utf8"), order = [...html.matchAll(/<script src="(i18n[^"]*)"/g)].map((m) => m[1]);
  ok(order.includes("i18n_horsedown.js") && order.indexOf("i18n_horsedown.js") < order.indexOf("i18n.js"), "i18n_horsedown.js loads before i18n.js");
  const p = vm.createContext({ console, Math, Date, JSON, Object, Array, Set, Map, WeakMap, Proxy, Number, String, performance: { now: () => 0 }, navigator: { language: "pl-PL" }, localStorage: { getItem: () => JSON.stringify({ lang: "pl" }), setItem() {} } });
  vm.runInContext(order.map((f) => fs.readFileSync(W + f, "utf8")).join("\n;") + "\n;globalThis.I18N = I18N; globalThis.I18N_SWEEP = I18N_SWEEP;", p);
  const s = hero(); HORSES.knockDown(s, T);
  for (const en of [HORSES.downLine(s.horse), "Downed", HORSES.toggle(s), "Tend Frost (50 gold)", "Horses get downed, never lost"]) {
    const pl = p.I18N.tr(en); ok(pl && pl !== en, "Polish for: " + en + " -> " + pl);
  }
  ok(p.I18N_SWEEP.c("Downed") === "Powalony", "fight picture tag in Polish"); }

console.log(`${n - fails}/${n} horse-down checks passed`);
process.exit(fails ? 1 : 0);
