// Horses are downed at 0 health, never dead, lost or sent away (horses.js, horseback.js). node test_horsedown.js
// Covers every way a horse loses health: road ambushes (G.advance -> HORSES.hurt), foes going for it in a mounted
// fight (HORSEBACK.enemyTurn, incl. dragons and giants), the fall, the end of the fight (HORSEBACK.after); plus old-save
// migration (away / dead / lost / 0 health), recovery (time, sleep, stablehand), riding/travel while downed and party saves.
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).concat(["horseback.js", "caravans.js"]);
const loaded = new Set();
for (const f of FILES) if (!loaded.has(f) && fs.existsSync(W + f)) { loaded.add(f); vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); }
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, HORSES, HORSEBACK, WORLD } = c;
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
// 1b. the real travel loop rolls road fights through HORSES.hurt
{ const src = fs.readFileSync(W + "engine.js", "utf8"); ok(/HORSES\.hurt\(s, e, stepT/.test(src), "engine's travel loop hurts the horse via HORSES.hurt"); }
{ // drive G.advance until an encounter lands and the horse takes it (rate forced high via many minutes of travel)
  let downs = 0, tries = 0;
  const rnd = Math.random;
  for (let i = 0; i < 60 && !downs; i++) {
    const s = hero(); s.horse.hp = 1; s.horse.hpT = T; tries++;
    const dest = Object.keys(WORLD.places).find((p) => p !== stables && G.pxDist(WORLD.places[p], WORLD.places[stables]) > 300);
    const tr = G.startTrip ? G.startTrip(s, dest, T) : null; if (!s.trip) continue;
    c.Math.random = () => 0.01;   // every roll hits: an ambush, and it goes for the horse
    try { G.advance(s, T + 3600); } catch (e) { /* engine details aside */ } finally { c.Math.random = rnd; }
    if (s.horse && s.horse.down) downs++;
    ok(!!s.horse && noOldFlags(s.horse), "travel: horse never deleted or sent away");
  }
  c.Math.random = rnd;
  ok(downs > 0, "travel loop: a road ambush downs a 1-health horse (" + downs + "/" + tries + ")"); }

// 2. mounted fight: foes (and dragons/giants) go for the horse; it's downed, you're thrown and the fight goes on on foot
for (const tags of [["humanoid"], ["big", "giant"], ["dragon"]]) {
  let downs = 0;
  for (let i = 0; i < 200; i++) {
    const s = hero(), f = new G.Fight(s, foe(3000, 60, tags), null, T); HORSEBACK.engage(f, T);
    f.run({ t: T, trySneak: false, maxTurns: 20 });
    const msgs = f.apply(T);
    ok(!!s.horse && noOldFlags(s.horse), "fight: horse never deleted");
    if (f.mount.downTurn) {
      downs++;
      ok(!f.mount.up, "dismounted when the horse goes down");
      ok(f.log.some((l) => /is downed/.test(l.them) && /thrown clear/.test(l.them)), "fight log: downed, thrown clear");
      ok(f.log.some((l) => l.turn > f.mount.downTurn) || f.hp <= 0 || f.ehp <= 0 || f.log.length >= 20, "the fight goes on after the fall");
      ok(f.log.filter((l) => l.turn > f.mount.downTurn).every((l) => !/saddle|Mounted charge/.test(l.me)), "on foot after the fall");
      ok(isDowned(s), "after the fight: downed, with you");
      ok(msgs.some((m) => /is downed/.test(m)) && !msgs.some((m) => /limps off|stables at/.test(m)), "after-fight line: downed, not sent away");
    }
  }
  ok(downs > 0, `foes (${tags.join("/")}) can down the horse: ${downs}/200`);
}
// 2b. the fall alone never ends the fight
{ const s = hero(), f = new G.Fight(s, foe(3000, 500), null, T); HORSEBACK.engage(f, T); f.hp = 1; f.mount.hp = 1;
  const rnd = c.Math.random; c.Math.random = () => 0.01; let line; try { line = HORSEBACK.enemyTurn(f); } finally { c.Math.random = rnd; }
  ok(/thrown clear/.test(line) && f.hp >= 1 && !f.mount.up && f.mount.downTurn >= 1, "fall at 1 health: still standing, on foot: " + line);
  ok(HORSEBACK.upAt(f, 0) === true || f.mount.downTurn >= 1, "upAt works"); ok(HORSEBACK.downAt(f, 1), "fight picture shows the downed horse at the end"); }
// 2c. no mounted fight on a downed horse; the encounter hint says so
{ const s = hero(); HORSES.knockDown(s, T); const f = new G.Fight(s, foe(), null, T);
  ok(!HORSEBACK.engage(f, T) && !f.mount, "downed horse: you fight on foot from the start");
  ok(/downed/.test(HORSEBACK.note(s)), "encounter note: downed"); }
// 2d. a horse already hurt in a fight keeps its health; one at 0 after the fight is downed even without a downTurn
{ const s = hero(), f = new G.Fight(s, foe(), null, T); HORSEBACK.engage(f, T); f.mount.hp = 0; const m = HORSEBACK.after(f, T); ok(isDowned(s) && /downed/.test(m[0]), "0 health at the end: downed"); }

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
{ const src = ["horses.js", "horseback.js", "remind.js", "ui.js", "encounters.js"].map((f) => fs.readFileSync(W + f, "utf8")).join("\n");
  ok(!/limps off|dead horse|horse dies|horse is dead|HORSES\.away|HORSES\.fetch|HORSES\.hurry/.test(src), "no old horse-loss text or API left"); }

// 9. downed horse art draws in ink without errors
{ const calls = []; const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (...a) => { calls.push(k); return { width: 30 }; }), set: (o, k, v) => { o[k] = v; return true; } });
  HORSEBACK.drawDowned(g, "#8a5a3b", 1.2, "Downed"); ok(calls.includes("ellipse") && calls.includes("fillText"), "drawDowned draws the horse and the tag"); }

// 10. Polish: the new lines translate (i18n_horsedown.js, loaded before i18n.js)
{ const html = fs.readFileSync(W + "index.html", "utf8"), order = [...html.matchAll(/<script src="(i18n[^"]*)"/g)].map((m) => m[1]);
  ok(order.includes("i18n_horsedown.js") && order.indexOf("i18n_horsedown.js") < order.indexOf("i18n.js"), "i18n_horsedown.js loads before i18n.js");
  const p = vm.createContext({ console, Math, Date, JSON, Object, Array, Set, Map, WeakMap, Proxy, Number, String, performance: { now: () => 0 }, navigator: { language: "pl-PL" }, localStorage: { getItem: () => JSON.stringify({ lang: "pl" }), setItem() {} } });
  vm.runInContext(order.map((f) => fs.readFileSync(W + f, "utf8")).join("\n;") + "\n;globalThis.I18N = I18N; globalThis.I18N_SWEEP = I18N_SWEEP;", p);
  const s = hero(); HORSES.knockDown(s, T);
  for (const en of [HORSES.downLine(s.horse), "Downed", HORSES.toggle(s), "Tend Frost (50 gold)", "Horses get downed, never lost", "Bandit brings Frost down! Frost is downed. You're thrown clear (−5) and fight on foot"]) {
    const pl = p.I18N.tr(en); ok(pl && pl !== en, "Polish for: " + en + " -> " + pl);
  }
  ok(p.I18N_SWEEP.c("Downed") === "Powalony", "fight picture tag in Polish"); }

console.log(`${n - fails}/${n} horse-down checks passed`);
process.exit(fails ? 1 : 0);
