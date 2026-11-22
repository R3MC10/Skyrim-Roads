const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Werewolf and vampire paths (curses.js): perks, Vampire Lord, weaknesses, cure quests, Smart AI.
   W=/path/to/web/ node test_beast.js   — prints "beast ok" */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "civilwar.js", "daedric.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "mp.js", "spellcraft.js", "coop.js", "combatai.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const ok = (x, m) => { n++; if (!x) throw new Error("FAIL " + m); };
function hero(lv = 20) { const s = G.newSave("b" + Math.random(), "B", "nord"); s.level = lv; s.hpBonus = lv * 8; for (const k of Object.keys(s.skills)) s.skills[k].lvl += 25; G.setHealth(s, G.maxHealth(s)); return s; }
const foe = (o = {}) => ({ name: "Bandit chief", health: 260, hp: 260, damage: 18, tags: ["humanoid"], level: 20, gold: [0, 0], ...o });

// ---- the disease takes 3 in-game days; hunger rises one stage per day
ok(CURSE.TURN_AFTER === 3 * CURSE.DAY && CURSE.DAY === 7200, "3 in-game days to turn");
const v = hero(); v.sanguinare = { at: G.now() - CURSE.TURN_AFTER + 600 }; ok(!CURSE.update(v) && !v.vampire, "not yet after 2.9 days");
v.sanguinare.at -= 700; ok(/vampire now/.test(CURSE.update(v)) && v.vampire, "turned after 3 days");
v.vampire.fedAt = G.now(); ok(CURSE.stage(v) === 1, "fed = 1"); v.vampire.fedAt = G.now() - CURSE.DAY * 1.5; ok(CURSE.stage(v) === 2, "1.5 days = 2"); v.vampire.fedAt = G.now() - CURSE.DAY * 9; ok(CURSE.stage(v) === 4, "starving = 4");

// ---- weaknesses: fire hurts more and frost less as hunger grows; poison barely
const fv = (name, tags, st) => { const s = hero(); s.vampire = { since: 0, fedAt: G.now() - CURSE.DAY * (st - 1) - 60 }; const f = new G.Fight(s, foe({ name, tags }), null, G.now()); return CURSE.dmgInMult(f); };
ok(Math.abs(fv("Fire atronach", ["construct"], 1) - 1.25) < 1e-9 && Math.abs(fv("Fire atronach", ["construct"], 4) - 2) < 1e-9, "fire weakness 25%..100%");
ok(fv("Frost troll", ["beast"], 3) < 0.3 && fv("Frost troll", ["beast"], 1) === 0.75, "frost resistance grows");
ok(fv("Giant frostbite spider", ["beast"], 2) === 0.5, "poison halves");
ok(fv("Bandit", ["humanoid"], 4) === 1, "plain blows unchanged");
ok(fv("Blood dragon", ["dragon"], 2) < 1 && fv("Dragon", ["dragon"], 2) > 1, "frost vs fire dragons");

// ---- Vampire Lord: once a day, drains every turn, heals, no potions
{ const s = hero(); s.vampire = { since: 0, fedAt: G.now() };
  const f = new G.Fight(s, foe(), null, G.now()); f.allies = [];
  ok(POWERS.affordable(f, "power", "lord"), "lord ready"); const t = POWERS.act(f, "power", "lord");
  ok(/Vampire Lord/.test(t) && f.pw.lord === CURSE.LORD_TURNS && !POWERS.affordable(f, "power", "lord") && CURSE.noPotions(f), "changes once, no potions");
  ok(!POWERS.affordable(f, "power", "beast"), "no beast form for vampires");
  const e0 = f.ehp, line = { me: "" }; POWERS.tick(f, line); ok(f.ehp < e0 && /drain life/.test(line.me), "drains each turn " + line.me);
  ok(!CURSE.lordReady(s), "cooldown a day"); s.lordAt = G.now() - CURSE.DAY - 1; ok(CURSE.lordReady(s), "ready next day");
  const w = hero(); ok(!CURSE.lordReady(w), "only vampires"); }

// ---- perks: points from Lord kills and feeds; take in order
{ const s = hero(); s.vampire = { since: 0, fedAt: G.now() };
  ok(CURSE.points(s, "lord") === 0 && /Kill/.test(CURSE.canTake(s, "lord", "power_grave")), "no points yet");
  for (let i = 0; i < 6; i++) { const f = new G.Fight(s, foe({ health: 30, hp: 30, damage: 1 }), null, G.now()); f.allies = []; f.usedLord = true; f.won = true; CURSE.after(f); }
  ok(CURSE.earned(s, "lord") === 2 && CURSE.points(s, "lord") === 2, "2 points after 6 kills");
  ok(/Needs/.test(CURSE.canTake(s, "lord", "mist_form")), "needs the root first");
  ok(/Power of the Grave/.test(CURSE.takePerk(s, "lord", "power_grave")) && CURSE.rank(s, "lord", "power_grave") === 1, "took the root");
  ok(/Detect/.test(CURSE.takePerk(s, "lord", "detect_all")) && CURSE.points(s, "lord") === 0, "took the next");
  ok(/Kill/.test(CURSE.canTake(s, "lord", "blood_healing")), "out of points"); }
{ const s = hero(); s.werewolf = { since: 0 };
  const feed = (tags) => { const f = new G.Fight(s, foe({ tags }), null, G.now()); f.usedBeast = true; f.won = true; f.hp = 10; return CURSE.after(f); };
  ok(/You feed/.test(feed(["humanoid"]).join(" ")) && s.beastPerks.feeds === 1, "feeds on a person");
  ok(!feed(["beast"]).length && s.beastPerks.feeds === 1, "not on a wolf without Savage Feeding");
  feed(["humanoid"]); ok(CURSE.points(s, "wolf") === 1, "a point at 2 feeds");
  CURSE.takePerk(s, "wolf", "bestial_strength");
  const f = new G.Fight(s, foe(), null, G.now()); f.pw.beast = 5; const m1 = CURSE.dmgMult(f); ok(Math.abs(m1 - 1.8 * 1.1) < 1e-9, "bestial strength +10% " + m1);
  s.beastPerks.wolf = { bestial_strength: 1, totem_terror: 1, totem_predator: 1, totem_ice_brothers: 1, animal_vigor: 1, gorging: 1, savage_feeding: 1 };
  const g = new G.Fight(s, foe(), null, G.now()); g.allies = []; CURSE.transform(g);
  ok(g.allies.filter((a) => a.name === "Ice wolf").length === 2 && g.stagger && g.calmTurns >= 2, "totems: wolves, stagger, terror");
  const n0 = s.beastPerks.feeds; ok(/You feed/.test(feed(["beast"]).join(" ")) && s.beastPerks.feeds === n0 + 1, "savage feeding: beasts too"); }

// ---- a filled black soul gem, and the cure quests
{ const s = hero(); s.vampire = { since: 0, fedAt: G.now() };
  QUESTS.ensure(s); ok(s.quests.cure_vamp && s.quests.cure_vamp.stage === 0, "Rising at Dawn starts for vampires");
  ok(QUESTS.visible(s, "cure_vamp") && !QUESTS.visible(s, "cure_wolf"), "only your cure shows");
  s.location = "Morthal"; const r1 = QUESTS.talk(s, "cure_vamp"); ok(s.quests.cure_vamp.stage === 1 && s.inv.some((r) => r.item === "soul_gem_black"), "Falion gives the black gem " + r1.text);
  const f = new G.Fight(s, foe({ health: 10, hp: 10, damage: 1 }), null, G.now()); f.allies = []; f.run({ t: G.now() }); ok(f.won, "won"); const msgs = f.apply(G.now());
  ok(s.inv.some((r) => r.item === "soul_gem_black_full") && msgs.some((m) => /black soul gem/.test(m)), "the gem fills on a person");
  QUESTS.check(s); ok(s.quests.cure_vamp.stage === 2, "stage 2: dawn");
  const dawnNow = CURSE.dawn(); const r2 = QUESTS.talk(s, "cure_vamp");
  if (dawnNow) ok(!s.vampire, "cured at dawn"); else ok(/dawn/i.test(r2.text) && s.vampire, "only at dawn: " + r2.text);
  // force dawn
  const clock0 = G.clock; G.clock = () => ({ day: 1, hour: 6 }); const r3 = QUESTS.talk(s, "cure_vamp"); G.clock = clock0;
  ok(!s.vampire && s.quests.cure_vamp.done && !s.inv.some((r) => r.item === "soul_gem_black_full"), "cured: " + (r3.msgs || []).join(" "));
  s.vampire = { since: 0, fedAt: G.now() }; QUESTS.ensure(s); ok(s.quests.cure_vamp.stage === 0 && !s.quests.cure_vamp.done, "turn again: the quest starts over"); }
{ const s = hero(30); s.werewolf = { since: 0 }; QUESTS.ensure(s); ok(s.quests.cure_wolf?.stage === 0, "Purity of the Blood starts");
  let r; for (let i = 0; i < 12 && s.quests.cure_wolf.stage === 0; i++) { s.location = "Glenmoril Coven"; G.setHealth(s, G.maxHealth(s)); r = QUESTS.talk(s, "cure_wolf"); }
  ok(s.quests.cure_wolf.stage === 1 && s.inv.some((x) => x.item === "glenmoril_head"), "witch head");
  let tries = 0; for (; tries < 12 && s.werewolf; tries++) { s.location = "Ysgramor's Tomb"; G.setHealth(s, G.maxHealth(s)); r = QUESTS.talk(s, "cure_wolf"); }
  console.log("wolf spirit beaten after", tries, "tries");
  ok(!s.werewolf && !s.inv.some((x) => x.item === "glenmoril_head"), "cured of the beast blood: " + JSON.stringify([r.text, r.msgs, s.quests.cure_wolf, s.location])); }

// ---- Smart AI turns into the Lord in long fights, not in short ones
{ const s = hero(25); s.vampire = { since: 0, fedAt: G.now() };
  let used = 0, usedEasy = 0;
  for (let i = 0; i < 40; i++) { s.lordAt = 0; const f = new G.Fight(s, foe({ name: "Vampire master", health: 700, hp: 700, damage: 26, tags: ["humanoid", "boss"] }), null, G.now()); f.allies = []; f.run({ t: G.now() }); if (f.usedLord) used++; }
  for (let i = 0; i < 40; i++) { s.lordAt = 0; const f = new G.Fight(s, foe({ name: "Mudcrab", health: 20, hp: 20, damage: 2, tags: ["beast"] }), null, G.now()); f.allies = []; f.run({ t: G.now() }); if (f.usedLord) usedEasy++; }
  console.log("Smart AI uses Vampire Lord: hard fights", used + "/40", "· easy", usedEasy + "/40");
  ok(used >= 30 && usedEasy <= 4, "AI saves the form for hard fights"); }
{ const s = hero(25); s.werewolf = { since: 0 }; let used = 0;
  for (let i = 0; i < 40; i++) { s.beastAt = 0; const f = new G.Fight(s, foe({ name: "Giant", health: 700, hp: 700, damage: 28, tags: ["big", "humanoid"] }), null, G.now()); f.allies = []; f.run({ t: G.now() }); if (f.usedBeast) used++; }
  console.log("Smart AI uses Beast Form vs a giant:", used + "/40"); ok(used >= 30, "AI turns into the beast for big fights"); }

// ---- win rates over the road's medium and hard fights (like test_curses): forms help without being a win button
const pool = D.ENCOUNTERS.filter((e) => e.kind !== "event" && ["medium", "high"].includes(e.danger));
function rate(mode) { let w = 0; for (let i = 0; i < 600; i++) { const s = G.newSave("r" + i, "R", "nord"); s.level = 12; s.hpBonus = 110; for (const k of Object.keys(s.skills)) s.skills[k].lvl += 30; G.setHealth(s, G.maxHealth(s));
  if (mode === "lord") { s.vampire = { since: 0, fedAt: G.now() }; G.loadout(s).rules.unshift({ if: "always", do: "power:lord" }); }
  if (mode === "wolf") { s.werewolf = { since: 0 }; G.loadout(s).rules.unshift({ if: "always", do: "power:beast" }); }
  G.loadout(s).mode = "custom";
  const e = JSON.parse(JSON.stringify(pool[i % pool.length])); e.hp = e.health; const f = new G.Fight(s, e, null, G.now()); f.allies = []; f.run({ t: G.now() }); if (f.won) w++; } return Math.round(w / 6); }
const r0 = rate("none"), rl = rate("lord"), rw = rate("wolf");
console.log("level 12 vs medium/high road fights: plain", r0 + "%", "· Vampire Lord", rl + "%", "· Beast Form", rw + "%");
ok(rl > r0 && rl - r0 <= 30, "Vampire Lord helps but isn't a win button"); ok(rl <= rw + 8, "the Lord isn't stronger than the beast");
console.log("beast ok · " + n + " checks");
`, c);
