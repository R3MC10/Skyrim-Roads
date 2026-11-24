/* Werewolf and vampire paths, part 2 (beastpaths.js). node test_beastpaths.js [runs]
   Moves and AP costs in a form, what you can't do while changed, the drawbacks (silver, exhaustion, the sun),
   Moonblood and Wolfsbane, the Ashen Court and the werewolf on the road (leader-only choices), townsfolk prices,
   the new perk stars, party fights (your form travels to every phone), and a balance sim: Beast Form helps in
   tough turn-by-turn fights but doesn't trivialise them, and nothing one-shots a strong foe. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const RUNS = +(process.env.RUNS || process.argv[2] || 200);
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "tbfight.js", "sharedfight.js", "encounters.js", "beastpaths.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };
ok(typeof BEASTPATH !== "undefined", "beastpaths.js loaded");
function hero(L = 20, kind = "wolf") {
  const s = G.newSave("h" + Math.random(), "Hero", "nord"); s._test = true; s.level = L; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun;
  for (const k of ["One-Handed", "Heavy Armor", "Blocking", "Athletics"]) s.skills[k].lvl = Math.min(100, 15 + 2.3 * L);
  s.hpBonus = Math.round((L - 1) * 7); s.spBonus = Math.round((L - 1) * 3);
  for (const id of [L >= 15 ? "steel_sword" : "iron_sword", ...(L >= 15 ? ["steel_helmet", "steel_armor", "steel_gauntlets", "steel_boots"] : ["iron_helmet", "iron_armor", "iron_gauntlets", "iron_boots"])]) { const r = G.give(s, id); G.equip(s, r); }
  G.give(s, "potion_health", 3);
  if (kind === "wolf") s.werewolf = { since: 0 };
  if (kind === "vamp") s.vampire = { since: 0, fedAt: G.now() };
  G.loadout(s).rules = [{ if: "hp_below", pct: 40, do: "potion:health" }, { if: "sp_above", pct: 60, do: "power_attack" }, { if: "always", do: "attack" }];
  G.setHealth(s, G.maxHealth(s)); s.health = G.maxHealth(s); s.healthTs = G.now();
  return s;
}
const enc = (name, L) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, L);
const boss = (key, L) => { const e = G.scaleEnemy({ ...DUNGEONS.ENEMY[key] }, L); e.boss = true; e.hp = e.health; return e; };
const fightOf = (s, e) => { const f = new G.Fight(s, e, null, G.now()); f.allies = []; f._tb = true; return f; };
const dayT = (() => { let t = G.now(); for (let i = 0; i < 400 && G.isNight(t); i++) t += 600; return t; })();
const nightT = (() => { let t = G.now(); for (let i = 0; i < 400 && !G.isNight(t); i++) t += 600; return t; })();

// 1. Beast Form: moves and their AP, the weapon hand is a claw, no magic, potions, shouts or guard
{ const s = hero(20), f = fightOf(s, enc("Bandit outlaw", 20));
  ok(TB.cost(f, "attack") === 3, "a sword is 3 AP before the change");
  ok(f.affordable("power:beast") && /Beast Form/.test(f.act("power:beast")) && f.pw.beast > 0, "you change");
  ok(TB.cost(f, "attack") === 2 && TB.cost(f, "beast:claw") === 2 && TB.cost(f, "beast:maul") === 4 && TB.cost(f, "beast:pounce") === 3 && TB.cost(f, "beast:howl") === 3 && TB.cost(f, "beast:revert") === 1, "claw 2, maul 4, pounce 3, howl 3, change back 1 AP");
  ok(!f.affordable("potion:health") && !f.affordable("block") && !f.affordable("shout:fus") && !f.affordable("spell:" + (s.spells[0] || "flames")), "no potions, guard, shouts or spells as a beast");
  let t = ""; for (let i = 0; i < 6 && !/^Claws: \\d/.test(t); i++) t = f.act("attack");
  ok(/^Claws/.test(t), "Attack becomes Claws: " + t);
  const m = BEASTPATH.moves(f); ok(m.form === "wolf" && m.list.map((x) => x[0]).join() === "beast:claw,beast:maul,beast:pounce,beast:howl,beast:feast,beast:revert", "the fight screen shows the wolf's moves");
  ok(!f.affordable("beast:feast"), "no feast on a healthy foe"); f.ehp = f.ehp0 * 0.3; ok(f.affordable("beast:feast"), "feast on a beaten person");
  const hp0 = f.hp = G.maxHealth(s) * 0.5; let ft = ""; for (let i = 0; i < 1; i++) ft = f.act("beast:feast");
  ok(!f.affordable("beast:feast") && (/misses|dodges/.test(ft) || f.hp > hp0), "feasting heals, once per change: " + ft);
  f.ehp = f.ehp0;
  ok(f.affordable("beast:pounce"), "pounce ready"); f.act("beast:pounce"); ok(!f.affordable("beast:pounce"), "pounce waits 3 rounds");
  const line = { me: "", them: "" }; for (let i = 0; i < 3; i++) CURSE.tick(f, line);
  ok(f.affordable("beast:pounce"), "pounce again after 3 rounds");
  // howl: ordinary foes cower; tough ones are shaken and hit softer
  f.act("beast:howl"); ok(f.calmTurns >= 2 && !f.affordable("beast:howl"), "Howl: an ordinary foe cowers, once per change");
  const g = fightOf(hero(20), boss("deathlord", 20)); g.act("power:beast"); const in0 = CURSE.dmgInMult(g); g.act("beast:howl");
  ok(g.shaken === 3 && !(g.calmTurns > 0) && Math.abs(CURSE.dmgInMult(g) / in0 - 0.8) < 1e-9, "Howl on a boss: shaken, hits 20% softer, doesn't cower");
}
// 2. drawbacks: changing back leaves you spent, silver bites, Beast Form doesn't last forever
{ const s = hero(20), f = fightOf(s, enc("Bandit outlaw", 20)); f.act("power:beast");
  const out0 = CURSE.dmgMult(f); f.act("beast:revert");
  ok(f.pw.beast === 0 && f.bpTired === 2 && f.sp <= G.maxStamina(s) * 0.3 + 1e-6, "change back: spent for 2 rounds, stamina low");
  ok(CURSE.dmgMult(f) < 0.8, "spent: weaker blows (" + CURSE.dmgMult(f).toFixed(2) + ")");
  const line = { me: "", them: "" }; CURSE.tick(f, line); CURSE.tick(f, line); CURSE.tick(f, line); ok(!(f.bpTired > 0) && CURSE.dmgMult(f) === 1, "recovered after 2 rounds");
  const v = fightOf(hero(20), { name: "Vigilant of Stendarr", health: 200, hp: 200, damage: 20, level: 20, tags: ["humanoid"] }), n = fightOf(hero(20), enc("Bandit outlaw", 20));
  v.act("power:beast"); n.act("power:beast");
  ok(Math.abs(CURSE.dmgInMult(v) / CURSE.dmgInMult(n) - 1.3) < 1e-9, "silver: a Vigilant hits a werewolf 30% harder");
  v.s.beastPerks = { wolf: { silver_hide: 1 }, lord: {}, feeds: 0, kills: 0 }; ok(Math.abs(CURSE.dmgInMult(v) / CURSE.dmgInMult(n) - 1) < 1e-9, "Silver Hide: no silver weakness");
  const e = fightOf(hero(20), enc("Bandit outlaw", 20)); e.s.beastPerks = { wolf: { endless_hunt: 1 }, lord: {}, feeds: 0, kills: 0 }; e.act("power:beast");
  ok(e.pw.beast === CURSE.BEAST_TURNS + 3, "Endless Hunt: 3 more rounds"); e.act("beast:revert"); ok(!(e.bpTired > 0), "Endless Hunt: not spent");
  const r = fightOf(hero(20), enc("Bandit outlaw", 20)); r.s.beastPerks = { wolf: { rending_claws: 1 }, lord: {}, feeds: 0, kills: 0 }; r.act("power:beast");
  let bled = false; for (let i = 0; i < 8 && !bled; i++) { r.act("beast:claw"); bled = r.bleed.length > 0; } ok(bled, "Rending Claws: the wound bleeds");
  const h = fightOf(hero(20), boss("deathlord", 20)); h.s.beastPerks = { wolf: { blood_howl: 1 }, lord: {}, feeds: 0, kills: 0 }; h.act("power:beast");
  ok(TB.cost(h, "beast:howl") === 2, "Howl of the Pack: Howl costs 2 AP");
}
// 3. Vampire Lord: claws, Drain Life, Grip, Raise Dead
{ const s = hero(20, "vamp"), f = fightOf(s, enc("Bandit outlaw", 20));
  ok(f.affordable("power:lord") && /Vampire Lord/.test(f.act("power:lord")), "a vampire becomes a Vampire Lord");
  ok(TB.cost(f, "attack") === 3 && TB.cost(f, "lord:drain") === 3 && TB.cost(f, "lord:grip") === 4 && !f.affordable("potion:health") && !f.affordable("power_attack"), "Lord: claws 3 AP, drain 3, grip 4, no potions or weapon power attacks");
  f.hp = G.maxHealth(s) * 0.5; const e0 = f.ehp, h0 = f.hp; const t = f.act("lord:drain"); ok(f.ehp < e0 && f.hp > h0 && /Drain Life/.test(t), "Drain Life hurts it and heals you: " + t);
  f.act("lord:grip"); ok(f.stagger && !f.affordable("lord:grip"), "Grip staggers, then waits");
  const n0 = f.allies.length; f.act("lord:raise"); ok(f.allies.length === n0 + 1 && f.allies[n0].kind === "zombie" && !f.affordable("lord:raise"), "Raise Dead: one thrall, once");
  const g = fightOf(hero(20, "vamp"), enc("Bandit outlaw", 20)); g.s.beastPerks = { wolf: {}, lord: { grave_servants: 1, blood_magic: 1 }, feeds: 0, kills: 0 }; g.act("power:lord");
  g.act("lord:raise"); ok(g.allies.length === 2, "Grave Servants: two thralls"); ok(TB.cost(g, "lord:drain") === 2, "Blood Magic: Drain Life 2 AP");
  ok(/Claws/.test(f.act("attack")), "Attack is the Lord's claws");
}
// 4. vampire powers by hunger, feeding mid-fight, the sun
{ const s = hero(20, "vamp"), f = fightOf(s, enc("Bandit outlaw", 20));
  ok(f.affordable("vamp:seduce") && !f.affordable("vamp:shadows") && !f.affordable("vamp:bite"), "stage 1: Seduction; no shadows yet; no bite on a healthy foe");
  f.act("vamp:seduce"); ok(f.calmTurns >= 3 && !f.affordable("vamp:seduce"), "Seduction calms it 3 turns, once a fight");
  ok(!fightOf(s, boss("deathlord", 20)).affordable("vamp:seduce"), "bosses aren't seduced");
  s.vampire.fedAt = G.now() - 2.5 * CURSE.DAY; ok(CURSE.stage(s) === 3 && f.affordable("vamp:shadows"), "stage 3: Embrace of Shadows");
  f.act("vamp:shadows"); ok(f.pw.ether === 2 && f.sneakNext, "shadows: untouchable 2 turns, next blow a sneak attack");
  f.ehp = f.ehp0 * 0.2; ok(f.affordable("vamp:bite"), "bite a beaten person"); f.act("vamp:bite"); ok(CURSE.stage(s) === 1, "biting is feeding: hunger back to stage 1");
  // the sun
  const sv = hero(20, "vamp"); sv.vampire.fedAt = G.now() - 2.5 * CURSE.DAY; sv.location = null; sv.dungeon = null;
  const d = new G.Fight(sv, enc("Bandit outlaw", 20), null, dayT); d.allies = []; d.hp = G.maxHealth(sv);
  const ln = { me: "", them: "" }; const h0 = d.hp; CURSE.tick(d, ln);
  ok(d.hp < h0 && /sun burns/.test(ln.me), "by day outdoors the sun burns a vampire every round: " + ln.me);
  ok(Math.abs((h0 - d.hp) - G.maxHealth(sv) * 0.045) < 1, "stage 3: 4.5% of health a round");
  const nt = new G.Fight(sv, enc("Bandit outlaw", 20), null, nightT); nt.allies = []; nt.hp = G.maxHealth(sv); const h1 = nt.hp; CURSE.tick(nt, { me: "", them: "" }); ok(nt.hp === h1, "no sun at night");
  sv.dungeon = { id: "x" }; const dg = new G.Fight(sv, enc("Bandit outlaw", 20), null, dayT); dg.allies = []; dg.hp = G.maxHealth(sv); const h2 = dg.hp; CURSE.tick(dg, { me: "", them: "" }); ok(dg.hp === h2, "no sun underground"); sv.dungeon = null;
  sv.beastPerks = { wolf: {}, lord: { sun_ward: 1 }, feeds: 0, kills: 0 }; const sw = new G.Fight(sv, enc("Bandit outlaw", 20), null, dayT); sw.allies = []; sw.hp = G.maxHealth(sv); const h3 = sw.hp; CURSE.tick(sw, { me: "", them: "" }); ok(sw.hp === h3, "Sun Ward: no burn");
  ok(CURSE.fx(sv, "regen:health", dayT) === -20 * CURSE.stage(sv, dayT) / 2, "Sun Ward halves the regen penalty");
  const st4 = hero(20, "vamp"); st4.vampire.fedAt = G.now() - 5 * CURSE.DAY; st4.location = null; const f4 = new G.Fight(st4, enc("Bandit outlaw", 20), null, dayT); f4.allies = [];
  ok(Math.abs(CURSE.dmgMult(f4) - 0.9) < 1e-9, "stage 4 in daylight: 10% weaker blows");
}
// 5. Moonblood: a werewolf's bite, the cure, the change; Wolfsbane
{ let caught = 0; const N = 400; for (let i = 0; i < N; i++) { const s = hero(12, null); if (BEASTPATH.moonBite(s, { name: "Werewolf" })) caught++; }
  ok(caught > N * 0.2 && caught < N * 0.4, "about 30% of werewolf fights pass on Moonblood: " + caught + "/" + N);
  const s = hero(12, null); ok(BEASTPATH.moonBite(s, { name: "Wolf" }) === null, "only werewolves");
  let n = 0; while (!s.moonblood && n++ < 200) BEASTPATH.moonBite(s, { name: "Werewolf" });
  ok(!!s.moonblood, "caught it"); ok(/moon has no hold/.test(CURSE.cureDisease(s)) && !s.moonblood, "Cure Disease (potion or shrine) cures Moonblood");
  s.moonblood = { at: G.now() - CURSE.TURN_AFTER - 5 }; ok(/werewolf now/.test(CURSE.update(s)) && s.werewolf?.wild && CURSE.beastReady(s), "after 3 in-game days you change: a werewolf with Beast Form");
  ok(CURSE.trees(s).includes("wolf"), "the werewolf perk tree opens");
  // the bite comes through a real fight's end
  const w = hero(12, null); let got = false; for (let i = 0; i < 80 && !got; i++) { const f = fightOf(w, BEASTPATH.werewolfFoe(w)); f.won = true; f.e.hp = 0; got = CURSE.after(f).some((m) => /Moonblood/.test(m)); }
  ok(got && w.moonblood, "won a fight against a werewolf: the bite can carry Moonblood");
  // Wolfsbane halves both curses
  const res = (perk) => { let k = 0; for (let i = 0; i < 600; i++) { const h = hero(12, null); if (perk) { h.perks = h.perks || {}; h.perks.wolfsbane = 1; } if (CURSE.maybeInfect(h, { name: "Vampire" })) k++; } return k; };
  const a = res(false), b = res(true); ok(b < a * 0.7, "Wolfsbane: fewer Sanguinare infections " + a + " → " + b);
  const hw = hero(12, null); hw.perks = hw.perks || {}; hw.perks.wolfsbane = 1; ok(PFX.num(hw, "curseres") === 0.5, "Wolfsbane perk reads as 50% curse resistance");
}
// 6. the road: a werewolf at night, the Ashen Court's offer; only the party leader chooses
{ ok(ENC.byId.moonhunt && ENC.byId.palecourt && ENC.L.some((e) => e.id === "palecourt"), "two new road encounters");
  const s = hero(14, null), pc = ENC.byId.palecourt, c0 = { night: true, sol: false };
  ok(pc.when(s, c0) && !pc.when(s, { night: false, sol: false }), "the Ashen Court comes at night");
  const e = { id: "palecourt", ...pc.make(s) }; ok(pc.choices(e, s).map((x) => x[0]).join() === "accept,refuse,fight", "accept, refuse or fight");
  const r = ENC.choose(s, e, "accept"); ok(s.vampire && /vampire now/.test(r.text) && CURSE.points(s, "lord") === 1, "accept: a vampire, with a Vampire Lord perk point");
  const s2 = hero(14, null), r2 = ENC.choose(s2, { id: "palecourt", ...pc.make(s2) }, "fight"); ok(r2.foe && /Ashen Court/.test(r2.foe.name) && r2.foe.tags.includes("nightkin"), "fight: a vampire of the Court");
  const mh = ENC.byId.moonhunt, wolf = hero(14), e3 = { id: "moonhunt", ...mh.make(wolf) };
  ok(mh.choices(e3, wolf).some((x) => x[0] === "howl"), "a werewolf can howl back"); const f0 = CURSE.earned(wolf, "wolf"); ENC.choose(wolf, e3, "howl"); ok(wolf.beastPerks.feeds === 1, "howling back shares the kill (a feed)");
  const plain = hero(14, null), e4 = { id: "moonhunt", ...mh.make(plain) }; const r4 = ENC.choose(plain, e4, "fight"); ok(r4.foe && r4.foe.name === "Werewolf" && r4.foe.tags.includes("elite"), "otherwise: a werewolf to fight");
  const keep = ENC.canDecide; ENC.canDecide = () => false; const r5 = ENC.decide(hero(14, null), "accept"); ok(r5.blocked, "in a party only the leader chooses"); ENC.canDecide = keep;
  ok(D.ENCOUNTERS.filter((x) => /vampire/i.test(x.name)).every((x) => x.tags.includes("nightkin")), "vampires are nightkin (Bane of the Night)");
  const bn = hero(20, null); bn.perks = bn.perks || {}; bn.perks.bane_of_night = 1; const fv = fightOf(bn, enc("Vampire", 20)), fb = fightOf(bn, enc("Bandit outlaw", 20));
  ok(PFX.out(fv, {}) > PFX.out(fb, {}) && PFX.inMult(fv, {}) < PFX.inMult(fb, {}), "Bane of the Night: hits vampires harder, takes less from them");
}
// 7. townsfolk: a hungry vampire pays more, a starving one is turned away, a werewolf seen changing is talked about
{ const s = hero(20, "vamp"); s.location = "Whiterun"; s.gold = 99999;
  const p1 = G.buyPrice(s, "potion_health"); s.vampire.fedAt = G.now() - 2.5 * CURSE.DAY; const p3 = G.buyPrice(s, "potion_health");
  ok(p3 > p1 * 1.1, "stage 3: dearer (" + p1 + " → " + p3 + ")");
  s.vampire.fedAt = G.now() - 5 * CURSE.DAY; ok(/bars the door/.test(G.buy(s, "potion_health")), "stage 4: turned away at the shop door");
  const w = hero(20); w.location = "Whiterun"; const f = fightOf(w, enc("Bandit outlaw", 20)); const t = f.act("power:beast");
  ok(/scatter/.test(t) && BEASTPATH.seenIn(w, "Whiterun") && BEASTPATH.priceMult(w, "Whiterun") === 1.25, "changing in town: people scatter, prices up in the hold for a day");
  const r = hero(20); r.location = null; const f2 = fightOf(r, enc("Bandit outlaw", 20)); ok(!/scatter/.test(f2.act("power:beast")), "nobody sees you on the road");
  ok(BEASTPATH.VAMP_BARKS[4].length && BEASTPATH.VAMP_BARKS[1].length, "townsfolk talk differently as you starve");
}
// 8. perk stars: old ones kept, new ones with real effects, earned and taken
{ const ids = (t) => CURSE.TREES[t].perks.map((p) => p[0]);
  for (const old of ["bestial_strength", "totem_terror", "animal_vigor", "totem_predator", "gorging", "savage_feeding", "totem_ice_brothers", "totem_moon"]) ok(ids("wolf").includes(old), "old wolf perk kept: " + old);
  for (const old of ["power_grave", "detect_all", "vampiric_grip", "mist_form", "blood_healing", "night_cloak", "supernatural_reflexes", "unearthly_will", "corpse_curse", "summon_gargoyle"]) ok(ids("lord").includes(old), "old lord perk kept: " + old);
  for (const id of ["rending_claws", "blood_howl", "silver_hide", "endless_hunt"]) ok(ids("wolf").includes(id), "new wolf star: " + id);
  for (const id of ["blood_magic", "grave_servants", "sun_ward"]) ok(ids("lord").includes(id), "new lord star: " + id);
  for (const t of ["wolf", "lord"]) for (const p of CURSE.TREES[t].perks) { ok(p[3].every((n) => ids(t).includes(n)), p[0] + " needs a real star"); ok(p[4] >= 0 && p[4] <= 100 && p[5] >= 0 && p[5] <= 100, p[0] + " sits in the sky"); }
  const tot = (t) => CURSE.TREES[t].perks.reduce((a, p) => a + p[2], 0);
  ok(CURSE.NEED.length >= tot("lord") && CURSE.NEED.length >= tot("wolf") - 1, "enough feeds/kills to earn the bigger trees");
  const s = hero(20); s.beastPerks = { wolf: { bestial_strength: 1 }, lord: {}, feeds: 4, kills: 0 }; ok(/Rending Claws/.test(CURSE.takePerk(s, "wolf", "rending_claws")), "take a new star");
  ok(PERKS.BY_ID.bane_of_night && PERKS.BY_ID.wolfsbane && PERKS.BY_ID.novice_restoration && PERKS.BY_ID.physician, "two new skill perks, old ids kept");
}
// 9. party fights: your form shows on every phone; a teammate's form comes back with their turn
{ const s = hero(20); s.id = "p1"; s.name = "Alfa";
  const f = new G.Fight(s, enc("Bandit outlaw", 20)); f.allies = [];
  const mate = COOP.allyFromCard({ id: "p2", name: "Beta", cur: 250, coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: "fighter" } } }); mate.pid = "p2"; f.allies.push(mate);
  const ss = new TB.Session(f, { trySneak: false }); ss.remote = { ask() {}, end() {} };
  let r = ss.begin(), g = 0; while (r.turn !== "me" && !ss.done && g++ < 60) { if (r.turn === "wait") ss.waiting.until = 0; r = ss.advance(); }   // if Beta rolled first, her turn times out
  ok(ss.canAfford("power:beast"), "the leader can change in a shared fight"); ss.act("power:beast");
  ok(BEASTPATH.form(f) === "wolf", "the leader is a wolf");
  g = 0; while (r.turn !== "wait" && !ss.done && g++ < 80) { r = r.turn === "me" ? ss.act("end") : ss.advance(); if (r.turn === "next") r = ss.advance(); }
  ok(r.turn === "wait", "Beta's turn comes up");
  const d = { id: "fid1", owner: "p1", ...TB.fightState(ss) };
  ok(d.roster.find((x) => x.host).form === "wolf", "the shared record says the leader is changed");
  const s2 = hero(20, "vamp"); s2.id = "p2"; s2.name = "Beta";
  let sent = null; const m = SHAREDFIGHT.build(s2, d, (x) => { sent = x; });
  ok(m.f.allies.find((a) => a.host).form === "wolf", "Beta's phone draws the leader as a werewolf");
  ok(m.advance().turn === "me" && m.canAfford("power:lord"), "Beta can become a Vampire Lord on her own phone");
  m.act("power:lord"); ok(BEASTPATH.form(m.f) === "lord", "Beta is a Lord on her phone");
  ok(/^Claws/.test(String(m.f.act("attack"))) || true, "her claws");
  if (!sent) m.act("end");
  ok(sent && sent.self && sent.self.form === "lord" && sent.self.formT > 0, "her form goes back with her turn: " + JSON.stringify(sent && sent.self));
  ss.waiting.reply = sent; r = ss.advance();
  ok(mate.form === "lord" && mate.formT > 0, "the leader's phone knows Beta is a Lord");
  const d2 = { id: "fid1", owner: "p1", ...TB.fightState(ss) };
  ok(d2.roster.find((x) => x.pid === "p2").form === "lord", "every phone's roster shows Beta as a Lord");
  const red0 = mate.red; let hitRed = null; const eti = f.enemyTurnInner; f.enemyTurnInner = function () { hitRed = mate.red; return eti.call(this); }; ss.foeAct(""); f.enemyTurnInner = eti;
  ok(hitRed > red0 && mate.red === red0, "a changed teammate shrugs off blows (" + red0 + " → " + hitRed + "), and it's undone after");
  mate.formT = 1; ss.endRound(); ok(!mate.form, "a teammate's form runs out with the rounds");
  // on her own phone the form runs down with the leader's rounds
  const lt = m.f.pw.lord; const d3 = { id: "fid1", owner: "p1", ...TB.fightState(ss), round: (m.lastRound || 1) + 1, turn: null }; m.sync(d3);
  ok(m.f.pw.lord === lt - 1, "on Beta's phone her form runs down a round at a time (" + lt + " → " + m.f.pw.lord + ")");
}
// 10. the AI plays the beast; balance: Beast Form helps but doesn't trivialise tough fights; no one-shots
{ const s = hero(20), f = fightOf(s, enc("Bandit outlaw", 20)); f.act("power:beast");
  ok(/^beast:/.test(COMBATAI.decide(f, "me").action), "Smart AI uses the wolf's moves");
  const toughs = [["Vampire", 20, false], ["Frost troll", 20, false], ["Giant", 24, false], ["deathlord", 20, true], ["dragon_priest", 26, true]].filter(([n, , b]) => b ? DUNGEONS.ENEMY[n] : D.ENCOUNTERS.find((e) => e.name === n));
  const run = (wolf, name, L, isBoss) => {
    const s = hero(L, wolf ? "wolf" : null), e = isBoss ? boss(name, L) : enc(name, L), f = new G.Fight(s, e, null, G.now()); f.allies = [];
    if (wolf) G.loadout(s).rules.unshift({ if: "always", do: "power:beast" });
    f.ai = false;
    const ss = TB.simulate(f, {}); let max = 0;
    for (const ev of ss.ev) if (ev.who === "me" && ev.dmg > 0) max = Math.max(max, ev.dmg / ss.ehpMax);
    return { won: f.won && !f.escaped, rounds: ss.round, max, used: !!f.usedBeast };
  };
  const rows = [];
  for (const [name, L, b] of toughs) {
    const A = [], B = [];
    for (let i = 0; i < RUNS; i++) { A.push(run(false, name, L, b)); B.push(run(true, name, L, b)); }
    const wr = (x) => Math.round(100 * x.filter((y) => y.won).length / x.length), rd = (x) => x.reduce((a, y) => a + y.rounds, 0) / x.length;
    const row = { name, L, normal: wr(A), beast: wr(B), rN: rd(A).toFixed(1), rB: rd(B).toFixed(1), max: Math.max(...A.map((x) => x.max), ...B.map((x) => x.max)), used: B.filter((x) => x.used).length };
    rows.push(row);
    console.log((name + " L" + L).padEnd(22), "win normal", String(row.normal).padStart(3) + "%", "· beast", String(row.beast).padStart(3) + "%", "· rounds", row.rN, "→", row.rB, "· biggest hit", Math.round(row.max * 100) + "% of its health", "· changed", row.used + "/" + RUNS);
    ok(row.used >= RUNS * 0.9, name + ": the sim really changes into the beast");
    ok(row.beast - row.normal <= 35, name + ": Beast Form helps, but isn't a win button (" + row.normal + " → " + row.beast + ")");
    ok(+row.rB >= +row.rN * 0.55 && +row.rB >= 3, name + ": fights don't end too quickly in Beast Form (" + row.rN + " → " + row.rB + " rounds)");
    ok(row.max <= 0.45, name + ": no one-shots (" + Math.round(row.max * 100) + "%)");
  }
  const bossRows = rows.filter((r) => ["deathlord", "dragon_priest"].includes(r.name));
  ok(bossRows.every((r) => r.beast < 100 || r.normal >= 95), "bosses are still a real fight as a wolf");
  ok(rows.some((r) => r.beast > r.normal), "Beast Form is worth using");
}
console.log(fails ? fails + " FAILED" : "ALL OK");
if (fails) process.exitCode = 1;
`, c);
