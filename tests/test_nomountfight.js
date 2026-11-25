/* Horses are for travel: there is no mounted combat (mountcombat.js always off, horseback.js / mountfight.js gone).
   W=/path/to/game/ node test_nomountfight.js
   - Riding into a road fight: no horse in the fight (f.mount), no Mount / Dismount moves, the hero fights on foot,
     the horse isn't hurt or downed and you're still in the saddle afterwards.
   - The old saddle perks keep their ids and have real travel effects (horsetravel.js); old saves load fine.
   - No game file loads the mounted modules, and no player text promises fighting from horseback. Prints ALL OK. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "mountcombat.js", "engine.js", "foecap.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "horsetravel.js", "magic.js", "coop.js", "party.js", "combatai.js", "foeintent.js", "foekit.js", "tbfight.js", "fightctl.js", "sharedfight.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0, checks = 0; const ok = (v, m) => { checks++; if (!v) { fails++; console.log("FAIL", m); } };
// the mounted modules are gone and nothing loads them
ok(!fs.existsSync(W + "horseback.js") && !fs.existsSync(W + "mountfight.js"), "horseback.js and mountfight.js are removed");
const html = fs.readFileSync(W + "index.html", "utf8");
ok(!/src="(horseback|mountfight)\.js"/.test(html) && /src="horsetravel\.js"/.test(html), "index.html loads horsetravel.js, not the mounted modules");
ok(!/\.mfhorse/.test(html), "no horse health bar CSS left");
ok(fs.existsSync(require("path").join(__dirname, "../scripts/build.mjs")) && !/horseback|mountfight/.test(fs.readFileSync(require("path").join(__dirname, "../scripts/build.mjs"), "utf8")), "the build doesn't name the mounted modules");
vm.runInContext(`
var __r = [];
__r.push([MOUNTCOMBAT.enabled === false, "mounted combat is off"]);
__r.push([typeof HORSEBACK === "undefined" && typeof MOUNTFIGHT === "undefined", "no HORSEBACK / MOUNTFIGHT"]);
__r.push([!D.CONDITIONS.mounted, "no 'I'm on horseback' AI rule condition"]);
for (let i = 0; i < 40; i++) {
  const T = G.now(), s = G.newSave("nm" + i, "Rider", "nord"); s._test = true; s.level = 20; s.gold = 10000; s.hpBonus = 400;
  s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun;
  HORSES.buy(s, "Frost", "bay"); s.horse.mounted = i % 4 !== 0;   // most ride in, some walk beside it
  const riding = HORSES.riding(s), hp0 = HORSES.hp(s, T);
  s.location = null; G.startTrip(s, "Riverwood", WORLD.places.Riverwood.slice(0, 2));
  const e = G.scaleEnemy({ ...D.ENCOUNTERS.find((x) => x.name === "Bandit outlaw") }, 20);
  s.trip.status = "encounter"; s.trip.encounter = e;
  let seen = null; const F0 = G.Fight, run0 = F0.prototype.run;
  F0.prototype.run = function (...a) { seen = seen || this; return run0.apply(this, a); };
  const r = G.encounterAction(s, "fight", T);
  F0.prototype.run = run0;
  __r.push([seen && !seen.mount, "no horse in the fight (" + i + ")"]);
  __r.push([seen && !seen.affordable("mount") && !seen.affordable("dismount"), "no Mount / Dismount moves"]);
  __r.push([!(seen?.log || []).some((l) => /horse|saddle|Frost|charge/i.test((l.me || "") + (l.them || ""))), "nothing about the horse in the fight log"]);
  __r.push([!HORSES.downed(s), "the fight never knocks the horse down"]);
  __r.push([HORSES.hp(s, T) >= hp0, "the fight never hurts the horse"]);
  __r.push([HORSES.riding(s) === riding, "riding afterwards exactly as before (" + riding + ")"]);
  __r.push([r && typeof r.text === "string", "the fight resolves"]);
}
// old saves that were mid-saddle (and had the old perks) load and ride on
{ const s = G.newSave("nmold", "Old", "nord"); s.horse = { name: "Bolt", coat: "black", mounted: true };
  s.perks = Object.assign(s.perks || {}, { cavalry_charge: 1, horse_archer: 1, steady_steed: 2, trample: 1, saddle_caster: 1 });
  G.migrate(s); HORSES.fix(s);
  __r.push([HORSES.riding(s) && !HORSES.downed(s), "an old mid-saddle save still rides"]); }
// the saddle perks keep their ids and have real road effects
for (const id of ["cavalry_charge", "horse_archer", "steady_steed", "trample", "saddle_caster"]) {
  __r.push([!!PERKS.BY_ID[id] && Object.values(PERKS.TREES).some((t) => t.some((p) => (p[0] || p.id) === id)), id + " is still a perk"]);
  __r.push([!/saddle|charge from|tramples small foes|in fights/i.test(PERKS.BY_ID[id].desc.replace("Saddle Caster", "")), id + " text no longer promises fighting from horseback: " + PERKS.BY_ID[id].desc]);
}
for (const id of ["ranger", "lance"]) __r.push([!/saddle/i.test(PERKS.BY_ID[id]?.desc || ""), id + " text doesn't mention the saddle"]);
{ const mk = (perks) => { const s = G.newSave("nmp" + Math.random(), "P", "nord"); s.gold = 10000; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; HORSES.buy(s, "Frost", "bay"); s.horse.stats = { speed: 1.8, carry: 100, hp: 200 }; s.perks = Object.assign(s.perks || {}, perks); return s; };
  const base = mk({}), cav = mk({ cavalry_charge: 1 }), st2 = mk({ steady_steed: 2 }), arch = mk({ horse_archer: 1 });
  __r.push([Math.abs(HORSES.speed(cav) / HORSES.speed(base) - 1.08) < 0.01, "Cavalry Charge: ride 8% faster (" + HORSES.speed(base) + " -> " + HORSES.speed(cav) + ")"]);
  __r.push([HORSES.carry(st2) === HORSES.carry(base) + 50, "Steady Steed 2: horse carries 50 more"]);
  __r.push([HORSETRAVEL.encounterMult(base) === 1 && Math.abs(HORSETRAVEL.encounterMult(arch) - 0.8) < 1e-9, "Horse Archer: 20% fewer road fights while riding"]);
  arch.horse.mounted = false; __r.push([HORSETRAVEL.encounterMult(arch) === 1, "Horse Archer: only while you ride"]);
  // Trample: faster off the road only
  const tr = mk({ trample: 1 }), off = Object.keys(WORLD.places).map((n) => WORLD.places[n]).find((p) => HORSETRAVEL.offRoad({ x: p[0] + 40, y: p[1] + 40 }));
  if (off) { [tr.x, tr.y] = [off[0] + 40, off[1] + 40]; [base.x, base.y] = [tr.x, tr.y];
    __r.push([HORSES.speed(tr) > HORSES.speed(base) * 1.09, "Trample: 10% faster off the road"]); }
  // Saddle Caster: dual-cast destruction spells cost less
  const sc = mk({ saddle_caster: 1 });
  __r.push([PFX.num(sc, "dualcost") === 0 && PFX.sum(sc, "dualcost", null, { school: "Destruction" }) > 0.04, "Saddle Caster: cheaper dual-cast destruction"]); }
`, c);
for (const [v, m] of c.__r) ok(v, m);
// no player-facing text promises fighting from horseback (patch note history may stay)
for (const f of fs.readdirSync(W).filter((x) => x.endsWith(".js") && !/^i18n|^patchnotes/.test(x))) {
  const src = fs.readFileSync(W + f, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l));
  const bad = src.filter((l) => /"[^"]*(fight(s|ing)? from the saddle|from horseback|mounted charge|Mount and Dismount|in the saddle in fights)[^"]*"/i.test(l));
  ok(!bad.length, f + ": no text about fighting from the saddle: " + bad.map((l) => l.trim().slice(0, 90)).join(" | "));
}
{ const src = fs.readFileSync(W + "patchnotes.js", "utf8"), nx = src.slice(src.indexOf("const NEXT = ["), src.indexOf("];", src.indexOf("const NEXT = [")));
  ok(!/saddle|horseback|mounted/i.test(nx), "Coming next doesn't promise mounted combat"); }
console.log(fails ? fails + " of " + checks + " checks FAILED" : "ALL OK (" + checks + " checks)");
if (fails) process.exitCode = 1;
