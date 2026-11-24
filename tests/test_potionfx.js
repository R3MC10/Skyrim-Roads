/* Potions over time (potionfx.js): Restore Health/Magicka/Stamina potions give their total over a few rounds
   (seconds on the road) instead of all at once, no stacking of the same kind, Quick Draught perk, followers, party sync.
   W=/path/to/game/ node test_potionfx.js */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
// seeded Math.random: the same fights every run
let seed = 4242;
const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const M = Object.create(Math); M.random = rnd;
const c = { process: { env: process.env }, console, Math: M, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js",
  "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js",
  "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "coop.js", "party.js", "followers2.js", "followerai.js", "combatai.js", "tbfight.js",
  "potionfx.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, n = 0, sid = 0; const OK = (x, m) => { if (!x) { fails++; console.log("FAIL", m); } else n++; };
const fresh = () => { const s = G.newSave("t" + (++sid), "Tester", "nord"); s._test = true; return s; };
const ENEMY = () => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.health && e.kind !== "event" && e.danger !== "high") }, 10);

// 1. durations: small 5 rounds, ordinary 4, big brewed 3; Quick Draught takes a round off per rank, never under 2
{ const s = fresh();
  OK(POTFX.ticks(s, 25) === 5 && POTFX.ticks(s, 50) === 4 && POTFX.ticks(s, 100) === 3, "durations 5/4/3: " + [POTFX.ticks(s, 25), POTFX.ticks(s, 50), POTFX.ticks(s, 100)]);
  OK(PFX.ADD.some((p) => p[1] === "quick_draught"), "the Quick Draught perk is in the Alchemy tree");
  s.perks = s.perks || {}; s.perks.quick_draught = 2;
  OK(POTFX.ticks(s, 25) === 3 && POTFX.ticks(s, 50) === 2 && POTFX.ticks(s, 100) === 2, "Quick Draught 2: 3/2/2: " + [POTFX.ticks(s, 25), POTFX.ticks(s, 50), POTFX.ticks(s, 100)]);
  OK(/4 rounds/.test(POTFX.note(fresh(), 50)), "tooltip line names the rounds: " + POTFX.note(fresh(), 50)); }

// 2. in a fight: drinking gives nothing at once, half at the end of the round, the rest over the next rounds
{ const s = fresh(); G.give(s, "potion_health", 3);
  const f = new G.Fight(s, ENEMY(), null), mx = G.maxHealth(s);
  f.hp = 20; const amt = D.ITEMS.potion_health.restore[1];
  const txt = f.act("potion:health");
  OK(f.hp === 20, "no health at the moment of drinking: " + f.hp);
  OK(/over 4 rounds/.test(txt), "the line says over how many rounds: " + txt);
  OK(f.potOT && f.potOT.health && f.potOT.health.n === 4, "a potion is working on you");
  const line = { me: "" }; MAGIC.tick(f, line);
  OK(Math.abs(f.hp - (20 + amt / 2)) < 0.01, "half in the first round: " + f.hp);
  OK(/\\uE15B \\+\\d+ health/.test(line.me), "the round line shows the share: " + line.me);
  for (let i = 0; i < 3; i++) MAGIC.tick(f, { me: "" });
  OK(Math.abs(f.hp - Math.min(mx, 20 + amt)) < 0.01 && !f.potOT, "the full amount after 4 rounds, then gone: " + f.hp);
  MAGIC.tick(f, { me: "" }); OK(Math.abs(f.hp - (20 + amt)) < 0.01, "nothing more after it ran out"); }

// 3. no stacking: a second of the same kind keeps whichever has more left; different kinds side by side
{ const f = { s: fresh(), hp: 10, mp: 0, sp: 0, allies: [] };
  POTFX.put(f, "health", 50, 4, "Potion of Healing");
  const r = POTFX.put(f, "health", 25, 5, "Potion of Minor Healing");
  OK(r.kept && f.potOT.health.total === 50, "a smaller one doesn't replace a bigger one still working");
  const r2 = POTFX.put(f, "health", 100, 3, "Big");
  OK(!r2.kept && f.potOT.health.left === 100, "a bigger one replaces (no adding up): " + f.potOT.health.left);
  POTFX.put(f, "magicka", 50, 4, "Potion of Magicka");
  OK(f.potOT.health && f.potOT.magicka, "health and magicka run side by side");
  OK(POTFX.busy(f, "health") && POTFX.busy(f, "magicka") && !POTFX.busy(f, "stamina"), "busy per kind"); }

// 4. drinking twice in a row: the second is wasted, never doubled
{ const s = fresh(); G.give(s, "potion_health", 3);
  const f = new G.Fight(s, ENEMY(), null), amt = D.ITEMS.potion_health.restore[1]; f.hp = 10;
  f.act("potion:health"); const t2 = f.act("potion:health");
  OK(/still working/.test(t2), "the second says the last one is still working: " + t2);
  for (let i = 0; i < 6; i++) MAGIC.tick(f, { me: "" });
  OK(f.hp <= 10 + amt + 0.01, "never more than one potion's worth: " + f.hp); }

// 5. tactics and Smart AI leave a potion that's still working alone
{ const s = fresh(); G.give(s, "potion_health", 5);
  G.loadout(s).rules = [{ if: "hp_below", pct: 90, do: "potion:health" }, { if: "always", do: "attack" }];
  const f = new G.Fight(s, ENEMY(), null); f.hp = 10; f.ai = false; f.hybrid = false;
  const a1 = f.choose()[1]; f.act(a1);
  const a2 = f.choose()[1];
  OK(a1 === "potion:health" && a2 === "attack", "rule skips the busy potion: " + a1 + " then " + a2);
  if (typeof COMBATAI !== "undefined" && COMBATAI.value) { const v = COMBATAI.value(f, "potion", "health"); OK(!v || v.v < 0, "Smart AI won't pick it either"); } }

// 6. a whole fight: potions run through Fight.run and the fight still ends fine
{ let drank = 0, won = 0;
  for (let k = 0; k < 20; k++) { const s = fresh(); G.give(s, "potion_health", 3); const f = new G.Fight(s, ENEMY(), null); f.run({ trySneak: false });
    if (f.won) won++; for (const l of f.log) if (/Drinks/.test(l.me)) drank++; OK(isFinite(f.hp) && isFinite(f.ehp), "no NaN"); }
  OK(won > 0, "fights still get won: " + won); }

// 7. on the road: health comes in over a few seconds; another doesn't stack
{ const s = fresh(); const mx = G.maxHealth(s), t0 = 100000;
  G.setHealth(s, 20, t0);
  const msg = POTFX.roadDrink(s, "health", 50, "Potion of Healing", t0);
  OK(/over 4 seconds/.test(msg), "road line: " + msg);
  OK(Math.round(G.curHealth(s, t0)) === 20, "nothing at once on the road: " + G.curHealth(s, t0));
  OK(Math.round(G.curHealth(s, t0 + 2)) >= 44 && Math.round(G.curHealth(s, t0 + 2)) <= 46, "half way after 2 s: " + G.curHealth(s, t0 + 2));
  const m2 = POTFX.roadDrink(s, "health", 25, "Potion of Minor Healing", t0 + 1);
  OK(/still working/.test(m2), "a smaller one while one works: " + m2);
  OK(Math.round(G.curHealth(s, t0 + 10)) >= Math.min(mx, 70) - 1 && Math.round(G.curHealth(s, t0 + 10)) <= Math.min(mx, 70) + 1, "all 50 in after it ends: " + G.curHealth(s, t0 + 10));
  OK(!s.potRT || !s.potRT.health || POTFX.roadLeft(s, t0 + 10) === 0, "nothing left to come");
  G.setHealth(s, 30, t0 + 20); POTFX.roadDrink(s, "health", 50, "Potion of Healing", t0 + 20);
  G.setHealth(s, G.curHealth(s, t0 + 21), t0 + 21);   // something else touches health half way: what came in stays, the rest keeps coming
  OK(Math.round(G.curHealth(s, t0 + 30)) === Math.min(mx, 80), "settling keeps the rest coming: " + G.curHealth(s, t0 + 30));
  OK(/magicka \\+/.test(POTFX.roadDrink(s, "magicka", 50, "Potion of Magicka", t0)), "magicka on the road is a plain line (always full outside fights)"); }

// 8. road into a fight and back out: what's left carries over
{ const s = fresh(); const t0 = 200000; G.setHealth(s, 10, t0);
  POTFX.roadDrink(s, "health", 50, "Potion of Healing", t0);
  const f = new G.Fight(s, ENEMY(), null); f.t = t0 + 1;
  POTFX.intoFight(f);
  OK(f.potOT && f.potOT.health && f.potOT.health.left > 30 && !(s.potRT && s.potRT.health), "into the fight: the rest works in rounds: " + JSON.stringify(f.potOT));
  const f2 = new G.Fight(s, ENEMY(), null); f2.hp = 40; f2.potOT = { health: { left: 30, n: 3, total: 50, name: "Potion of Healing" } };
  POTFX.outOfFight(f2, t0 + 5);
  OK(s.potRT && s.potRT.health && Math.round(POTFX.roadLeft(s, t0 + 5)) === 30, "out of the fight: the rest goes on on the road"); }

// 9. followers and party members: their own potion over time, chips/glyphs for the party list
{ const al = { name: "Lydia", hp: 20, maxHp: 200 };
  const t = POTFX.ally(al, "health", 50, "Potion of Healing");
  OK(/over 4 rounds/.test(t) && al.hp === 20, "an ally's potion doesn't land at once: " + t);
  const f = { s: fresh(), hp: 50, allies: [al] }; const line = { me: "" };
  POTFX.tick(f, line); OK(al.hp === 45 && /Lydia \\uE15B \\+25/.test(line.me), "the ally gets the first half at round end: " + al.hp + " " + line.me);
  OK(POTFX.busy(al, "health"), "the ally's potion counts as working (followers won't drink another)");
  OK(POTFX.allyIcons(al).length > 0, "a glyph for the party list");
  al.down = true; POTFX.tick(f, { me: "" }); OK(!al.potOT, "a knocked-down ally's potion stops"); }

// 10. party sync: potOT rides in the shared fight record
OK(typeof TB === "undefined" || (TB.BUFF_KEYS || []).includes("potOT"), "potOT is one of the synced buff keys");

console.log(fails ? "potionfx: " + fails + " FAILED, " + n + " ok" : "potionfx: all " + n + " ok");
if (fails) process.exitCode = 1;
`, c);
if (c.process.exitCode) process.exitCode = c.process.exitCode;
