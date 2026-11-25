/* Mounted combat switched off (mountcombat.js): every road fight is on foot. W=/path/to/game/ node test_nomountfight.js
   Riding into a fight: no horse in the fight (f.mount), no Mount / Dismount moves, the horse isn't hurt or downed by the
   fight, and you're still in the saddle afterwards. A party record from an older phone draws no horse. Prints ALL OK. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "mountcombat.js", "engine.js", "foecap.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "horseback.js", "mountfight.js", "magic.js", "coop.js", "party.js", "combatai.js", "foeintent.js", "foekit.js", "tbfight.js", "sharedfight.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log("FAIL", m); } };
ok(typeof MOUNTCOMBAT !== "undefined" && MOUNTCOMBAT.enabled === false, "mounted combat is off by default");
for (let i = 0; i < 40; i++) {
  const T = G.now(), s = G.newSave("nm" + i, "Rider", "nord"); s._test = true; s.level = 20; s.gold = 10000; s.hpBonus = 400;
  s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun;
  HORSES.buy(s, "Frost", "bay"); s.horse.mounted = i % 4 !== 0;   // most ride in, some walk beside it
  const riding = HORSES.riding(s), hp0 = HORSES.hp(s, T);
  s.location = null; G.startTrip(s, "Riverwood", WORLD.places.Riverwood.slice(0, 2));
  const e = G.scaleEnemy({ ...D.ENCOUNTERS.find((x) => x.name === "Bandit outlaw") }, 20);
  s.trip.status = "encounter"; s.trip.encounter = e;
  let seen = null; const F0 = G.Fight, run0 = F0.prototype.run;
  F0.prototype.run = function (...a) { seen = this; return run0.apply(this, a); };
  const r = G.encounterAction(s, "fight", T);
  F0.prototype.run = run0;
  ok(seen && !seen.mount, "no horse in the fight (" + i + ")");
  ok(!seen || !(typeof MOUNTFIGHT !== "undefined" && MOUNTFIGHT.moves(seen).length), "no Mount / Dismount moves");
  ok(!(seen?.log || []).some((l) => /horse|saddle|Frost/i.test((l.me || "") + (l.them || ""))), "nothing about the horse in the fight log");
  ok(!HORSES.downed(s), "the fight never knocks the horse down");
  ok(HORSES.hp(s, T) >= hp0, "the fight never hurts the horse");
  ok(HORSES.riding(s) === riding, "riding afterwards exactly as before (" + riding + ")");
  ok(r && typeof r.text === "string", "the fight resolves");
}
// a party record from an older phone (with a horse in it) draws no horse here
if (typeof MOUNTFIGHT !== "undefined" && MOUNTFIGHT.mirror) {
  const s = G.newSave("nmp", "Mate", "nord"); s.gold = 10000; s.location = "Whiterun"; HORSES.buy(s, "Bolt", "black");
  const f = new G.Fight(s, G.scaleEnemy({ ...D.ENCOUNTERS.find((x) => x.name === "Bandit outlaw") }, 10));
  MOUNTFIGHT.mirror({ f, me: "me" }, { roster: [{ k: "p:me", mt: { up: true, hp: 50, max: 50, name: "Bolt" } }], round: 1 });
  ok(!f.mount, "an old phone's horse record is ignored");
  ok(MOUNTFIGHT.allyHorse({ allies: [{ name: "Ann", mt: { up: true, coat: "#333" } }] }, "Ann") === null, "teammates' horses aren't drawn");
}
// switched on, the mounted system is all still there
MOUNTCOMBAT.enabled = true;
{ const T = G.now(), s = G.newSave("nmon", "Rider", "nord"); s._test = true; s.level = 20; s.gold = 10000; s.location = "Whiterun"; HORSES.buy(s, "Frost", "bay"); s.horse.mounted = true;
  s.location = null; [s.x, s.y] = WORLD.places.Whiterun; G.startTrip(s, "Riverwood", WORLD.places.Riverwood.slice(0, 2));
  s.trip.status = "encounter"; s.trip.encounter = G.scaleEnemy({ ...D.ENCOUNTERS.find((x) => x.name === "Bandit outlaw") }, 20);
  let seen = null; const run0 = G.Fight.prototype.run; G.Fight.prototype.run = function (...a) { seen = seen || this; return run0.apply(this, a); };
  G.encounterAction(s, "fight", T); G.Fight.prototype.run = run0;
  ok(seen && seen.mount, "switched on: you fight from the saddle again"); }
MOUNTCOMBAT.enabled = false;
console.log(fails ? fails + " of " + checks + " checks FAILED" : "ALL OK (" + checks + " checks)");
if (fails) process.exitCode = 1;
`, c);
