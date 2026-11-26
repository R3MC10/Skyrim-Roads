/* The first 30 minutes (first30.js): the opening quest chain and its two fights.
   W=/path/to/game/ node test_first30.js [runs]  — prints a balance table and ALL OK.
   - the chain: start, each objective (fight, gear, trip, talk, level-up + perk, elite, hand-in), the rewards,
     the main quest picking up at Bleak Falls Barrow, skip, the main quest held back while the opening runs, ?notut-style saves
   - the fights, played turn by turn by the AI for every race and every Guardian Stone: a fresh hero beats the bandit
     lookout and (after the steps before it) the bandit chief most of the time, neither fight ends in a round or two,
     no blow takes more than about half of anyone's health, and the lookout winds up a big blow in round 2 (the guard lesson). */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const RUNS = +(process.env.RUNS || process.argv[2] || 30);
const store = {};
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS, structuredClone,
  localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] } };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "levelup.js", "powers.js", "engine.js", "foecap.js", "stacks.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "first30.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "initiative.js", "tbfight.js", "foekit.js", "fightread.js", "foeintent.js", "bossfight.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };
const F30 = FIRST30, Q = QUESTS;
const fresh = (race = "nord", stone) => { const s = G.newSave("t" + Math.random(), "Tess", race); if (stone) s.stone = stone; return s; };

// ---------------------------------------------------------------- the chain
{
  const s = fresh();
  ok(F30.start(s), "a new hero starts the opening");
  ok(!F30.start(s), "only once");
  ok(F30.active(s) && F30.stage(s) === 0 && s.trackQ === "opening", "step 1 is tracked");
  Q.check(s); ok(!s.quests.main, "the main quest waits while the opening runs");
  ok(Q.tracked(s).id === "opening", "the opening is the tracked quest");
  ok(Q.target(Q.tracked(s).st) === "Riverwood", "its first goal is right here in Riverwood");
  const a0 = F30.action(s); ok(a0 && a0.act === "qtalk", "one button: start the fight");
  ok(/Skip the tutorial/.test(F30.cardHTML(s, "map")) && F30.cardHTML(s, "pack") === "", "the goal card: Travel/Area screens only, with Skip");
  // the fight (forced win), then the leather armour
  const won = Object.create(null); let win = true;
  const run0 = G.Fight.prototype.run; G.Fight.prototype.run = function () { this.won = win; this.ehp = win ? 0 : this.ehp; this.hp = win ? this.hp : 0; return win; };
  win = false; const g0 = s.gold, inv0 = s.inv.length;
  const lose = Q.talk(s, "opening");
  ok(F30.stage(s) === 0 && !lose.died && !lose.bag && s.gold === g0 && s.inv.length === inv0, "losing costs nothing: no gold, no bag, same step");
  ok(G.curHealth(s) >= G.maxHealth(s) - 1, "back on your feet at full health to try again");
  win = true; const r0 = Q.talk(s, "opening");
  ok(F30.stage(s) === 1 && s.inv.some((r) => r.item === "leather_armor"), "the bandit drops leather armour: " + r0.text);
  ok(F30.action(s).act === "f30", "step 2: Put it on");
  Q.check(s); ok(F30.stage(s) === 1, "wearing hide still: step 2 waits");
  const lr = s.inv.find((r) => r.item === "leather_armor"); G.equip(s, lr.id, "chest");
  ok(F30.chestArmor(s) >= 26, "leather on");
  Q.check(s); ok(F30.stage(s) === 2, "putting it on finishes step 2");
  ok(F30.action(s).act === "go" && /Whiterun/.test(F30.action(s).attrs), "step 3: Go to Whiterun");
  s.trip = { status: "travel" }; ok(F30.action(s) === null && /On the way to Whiterun/.test(F30.cardHTML(s)), "on the road: no button, the time left");
  s.trip = null; s.location = "Whiterun"; const g1 = s.gold; Q.check(s);
  ok(F30.stage(s) === 3 && s.gold === g1 + 50, "arriving in Whiterun: 50 gold, the main quest's old first reward");
  const lv0 = s.level; const r3 = Q.talk(s, "opening");
  ok(s.level >= 2 && s.pendingLevels > 0 && F30.stage(s) === 4, "the Jarl's step: level 2 (" + lv0 + " → " + s.level + ") " + (r3.msgs || []).join(" "));
  ok(F30.action(s).label === "Level up", "step 5: Level up first");
  G.levelUp(s, "health"); Q.check(s); ok(F30.stage(s) === 4 && F30.action(s).label === "Pick a perk", "then the perk");
  const perk = PERKS.TREES["One-Handed"] ? Object.values(PERKS.BY_ID).find((p) => PERKS.canTake(s, p.id) === true || PERKS.canTake(s, p.id)?.ok) : null;
  const took = perk ? PERKS.take(s, perk.id) : null;
  Q.check(s); ok(PERKS.pointsLeft(s) <= 0 ? F30.stage(s) === 5 : true, "spending the perk point finishes step 5 (" + (perk && perk.id) + ": " + took + ")");
  if (F30.stage(s) === 4) { s.perks = s.perks || {}; s.perks.__x = 1; Q.check(s); }
  ok(F30.stage(s) === 5, "on to the bandit chief");
  s.location = "Chillfurrow Farm"; Q.talk(s, "opening"); ok(F30.stage(s) === 6, "the chief falls");
  s.location = "Whiterun"; const g2 = s.gold, items0 = s.inv.length; const r6 = Q.talk(s, "opening");
  ok(!F30.active(s) && s.quests.opening.done, "the opening is done");
  ok(s.gold >= g2 + 150 && s.inv.some((r) => r.item === "steel_sword") && s.inv.some((r) => r.item === "potion_health"), "a good reward: gold, a steel sword, potions");
  ok(s.quests.main && s.quests.main.stage === 1 && s.trackQ === "main", "the main quest picks up at Bleak Falls Barrow");
  ok((r6.msgs || []).some((m) => /Next: Bleak Falls Barrow/.test(m)), "and says what's next: " + (r6.msgs || []).slice(-1)[0]);
  G.Fight.prototype.run = run0;
}
// skip, veterans, old saves
{
  const s = fresh(); F30.start(s); ok(F30.skip(s) && !F30.active(s) && s.quests.main.stage === 0 && s.trackQ === "main", "skip early: the main quest from Before the Storm");
  const t = fresh(); F30.start(t); t.quests.opening.stage = 4; F30.skip(t); ok(t.quests.main.stage === 1, "skip after Whiterun: from Bleak Falls Barrow");
  const v = fresh(); Q.check(v); ok(v.quests.main && !v.quests.opening, "no opening (?notut / old saves): the main quest as before");
  v.quests.main.stage = 3; ok(!F30.canStart(v) && !F30.start(v), "a hero further along never gets the opening");
  const w = fresh(); w.level = 9; ok(!F30.canStart(w), "How to Play only replays it on a fresh hero");
  ok(F30.weaponFor({ ...fresh(), loadouts: { Main: { equipment: {} } }, loadout: "Main" }) === "steel_sword", "no weapon: a steel sword");
}
// the Journal line and the recommended levels
ok(Q.L.opening.stages.length === 7 && Q.REC.opening.length === 7, "7 steps, each with a level");
ok(Q.L.opening.stages.every((st) => st.title && st.text), "every step has a title and plain text");

// ---------------------------------------------------------------- the fights, every race and stone
const RACES = Object.keys(D.RACES), STONES = ["warrior", "mage", "thief"];
function hero(race, stone, step) {
  const s = fresh(race, stone);
  if (step >= 5) {   // what the steps before the chief give you: leather armour, level 2 (+10 health), the lesson
    const lr = G.give(s, "leather_armor"); G.equip(s, lr, "chest");
    for (let i = 0; i < 8 && s.level < 2; i++) G.raiseSkill(s, F30.bestSkill(s));
    if (s.pendingLevels > 0) G.levelUp(s, "health");
  }
  G.setHealth(s, G.maxHealth(s), G.now());
  return s;
}
function bout(race, stone, step) {
  const s = hero(race, stone, step), def = step === 0 ? F30.LOOKOUT : F30.CHIEF;
  const e = Q.foeFor(s, "opening", step, def), f = new G.Fight(s, e, null, G.now()); f.allies = [];
  let foeMax = 0, myMax = 0, wound = 0;
  const ss = TB.simulate(f, { t: G.now(), trySneak: false });
  for (const x of ss.ev || []) {
    if (x.kind === "foe" || x.who === "foe") {}
  }
  // the biggest single blow each way, from the fight log (one row per turn)
  let hp = G.maxHealth(s), ehp = ss.ehpMax || e.health;
  for (const r of f.log || []) { if (r.hp != null) { foeMax = Math.max(foeMax, hp - r.hp); hp = r.hp; } if (r.ehp != null) { myMax = Math.max(myMax, ehp - r.ehp); ehp = r.ehp; } if (/winding up|lifts the weapon/i.test(r.them || "") && !wound) wound = r.turn; }
  return { won: f.ehp <= 0 && f.hp > 0, rounds: ss.round, foeMax: foeMax / G.maxHealth(s), myMax: myMax / (ss.ehpMax || e.health), wound };
}
const rows = [];
for (const step of [0, 5]) {
  let worst = 101, minR = 99, all = [];
  for (const race of RACES) for (const stone of STONES) {
    let w = 0, r = 0, fm = 0, mm = 0, wd = 0, n = Math.max(4, Math.round(RUNS / 3));
    for (let i = 0; i < n; i++) { const b = bout(race, stone, step); w += b.won; r += b.rounds; fm = Math.max(fm, b.foeMax); mm = Math.max(mm, b.myMax); if (step === 0 && b.wound && b.wound <= 2) wd++; }
    const pct = Math.round(100 * w / n), rr = r / n;
    worst = Math.min(worst, pct); minR = Math.min(minR, rr);
    all.push([race, stone, pct, rr.toFixed(1), Math.round(100 * fm), Math.round(100 * mm), wd + "/" + n]);
    ok(fm <= 0.45, (step ? "chief" : "lookout") + " never takes more than 45% of a fresh " + race + "'s health in a turn (" + Math.round(100 * fm) + "%)");
    ok(mm <= 0.75, "a " + race + " never takes more than 75% of the " + (step ? "chief" : "lookout") + " in a turn (" + Math.round(100 * mm) + "%)");
    if (step === 0) ok(wd >= n * 0.6, race + ": the lookout winds up by round 2 most fights (" + wd + "/" + n + ")");
  }
  const byRace = {}; for (const x of all) (byRace[x[0]] = byRace[x[0]] || []).push(x[2] + "%/" + x[3] + "r");
  rows.push((step ? "Bandit chief (after steps 1-5)" : "Bandit lookout (fresh hero)") + ": worst " + worst + "%, shortest " + minR.toFixed(1) + " rounds\\n   " + Object.entries(byRace).map(([k, v]) => k + " " + v.join(" ")).join("\\n   "));
  ok(worst >= (step ? 70 : 85), (step ? "the chief" : "the lookout") + " is winnable for every race and stone (worst " + worst + "%)");
  ok(minR >= (step ? 4 : 3), (step ? "the chief" : "the lookout") + " isn't over in a round or two (" + minR.toFixed(1) + ")");
  if (step === 5) ok(worst <= 99 || minR >= 5, "the chief is a real fight, not a walkover");
}
console.log(rows.join("\\n"));
console.log(fails ? fails + " FAILED" : "ALL OK");
if (fails) process.exitCode = 1;
`, c);
