const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Favourites wheel checks (favwheel.js). W=/path/to/web/ node test_favwheel.js — prints "favwheel ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "mp.js", "spellcraft.js", "coop.js", "combatai.js", "favwheel.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log("FAIL", m); } };
const mk = () => { const s = G.newSave("fv", "Fav", "nord"); s._test = true; s.level = 20; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; G.setHealth(s, G.maxHealth(s)); return s; };
const foe = (name, L) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, L);

// 1. marking favourites
{ const s = mk();
  const sw = G.give(s, "steel_sword"), ax = G.give(s, "iron_war_axe"), pot = G.give(s, "potion_health", 3), ore = G.give(s, "mat_iron", 2);
  ok(FAVWHEEL.toggle(s, sw).on === true, "a weapon goes on the wheel");
  ok(FAVWHEEL.has(s, FAVWHEEL.entryFor(s, sw)), "and is marked");
  ok(FAVWHEEL.toggle(s, ore).ok === false, "ore can't go on the wheel");
  ok(FAVWHEEL.toggle(s, pot).on === true, "a potion goes on");
  ok(FAVWHEEL.toggle(s, "spell:flames").on === true, "a spell goes on");
  ok(FAVWHEEL.toggle(s, "shout:unrelenting_force").on === true, "a shout goes on");
  ok(FAVWHEEL.toggle(s, "power:race").on === true, "the racial power goes on");
  ok(FAVWHEEL.toggle(s, ax).on === true, "a second weapon");
  ok(FAVWHEEL.toggle(s, sw).on === false && FAVWHEEL.list(s).length === 5, "tapping again takes it off");
  FAVWHEEL.toggle(s, sw);
  for (const id of ["steel_armor", "steel_helmet", "steel_boots"]) FAVWHEEL.toggle(s, G.give(s, id));
  ok(FAVWHEEL.list(s).length === 8, "8 favourites");
  ok(FAVWHEEL.toggle(s, G.give(s, "steel_shield")).ok === false, "no 9th slot");
  const html = FAVWHEEL.html(s); ok((html.match(/class="fw-slot/g) || []).length === 8 && !/undefined|NaN/.test(html), "wheel draws 8 slots, no undefined");
}
// 2. using: equip into the current loadout, ready a spell, queue a potion
{ const s = mk();
  const sw = G.give(s, "steel_sword"), pot = G.give(s, "potion_health", 3);
  FAVWHEEL.toggle(s, sw); FAVWHEEL.toggle(s, "spell:flames"); FAVWHEEL.toggle(s, pot); FAVWHEEL.toggle(s, "shout:bogus");
  const L = FAVWHEEL.list(s), idx = (k, id) => L.findIndex((f) => f.k === k && f.id === id);
  const r1 = FAVWHEEL.use(s, idx("item", "steel_sword"));
  ok(r1.ok && G.equipment(s).weapon?.item === "steel_sword", "picking a weapon equips it " + r1.text);
  G.addLoadout?.(s, "Second");
  const r2 = FAVWHEEL.use(s, idx("spell", "flames")); ok(r2.ok && s.favReady === "spell:flames", "picking a spell readies it");
  ok(FAVWHEEL.use(s, idx("spell", "flames")).ok && !s.favReady, "picking it again un-readies");
  FAVWHEEL.use(s, idx("spell", "flames"));
  const r3 = FAVWHEEL.use(s, idx("item", "potion_health")); ok(r3.ok && s.favPot === "health", "picking a potion queues it");
  ok(FAVWHEEL.use(s, idx("shout", "bogus")).ok === false, "an unknown shout can't be used");
  ok(FAVWHEEL.use(s, 99).ok === false, "empty slot");
  // removing the readied favourite clears it
  FAVWHEEL.toggle(s, "spell:flames"); ok(!s.favReady, "taking the readied spell off the wheel clears it");
  // gone from the pack
  const s2 = mk(); const d = G.give(s2, "iron_dagger"); FAVWHEEL.toggle(s2, d); s2.inv = s2.inv.filter((r) => r.item !== "iron_dagger");
  ok(FAVWHEEL.use(s2, 0).ok === false, "an item no longer in the pack can't be equipped");
  ok(FAVWHEEL.info(s2, FAVWHEEL.list(s2)[0]).sub === "not in pack", "and says so");
}
// 3. Smart AI: the readied favourite opens the fight
{ let opened = 0, runs = 30;
  for (let i = 0; i < runs; i++) {
    const s = mk(); s.skills.Destruction.lvl = 40; if (!s.spells.includes("flames")) s.spells.push("flames");
    s.favs = [{ k: "spell", id: "flames" }]; s.favReady = "spell:flames";
    const f = new G.Fight(s, foe("Bandit outlaw", 20)); f.run({ trySneak: false });
    const first = f.log.find((l) => l.turn === 1); if (first && first.a === "spell:flames") opened++;
  }
  ok(opened === runs, \`readied spell opens every fight (\${opened}/\${runs})\`);
  const s = mk(); s.favReady = "spell:flames"; s.spells = s.spells.filter((x) => x !== "flames");
  const f = new G.Fight(s, foe("Bandit outlaw", 20)); f.run({ trySneak: false });
  ok(f.log.find((l) => l.turn === 1)?.a !== "spell:flames", "an unknown readied spell is skipped");
  const s3 = mk(); s3.spells.push("flames"); s3.favReady = "spell:flames"; G.loadout(s3).mode = "custom";
  const f3 = new G.Fight(s3, foe("Bandit outlaw", 20)); f3.run({ trySneak: false }); ok(!f3.log.some((l) => l.ai), "custom tactics ignore the AI opener");
  // only the first turn
  const s4 = mk(); s4.skills.Destruction.lvl = 40; s4.spells.push("flames"); s4.favReady = "spell:flames";
  const f4 = new G.Fight(s4, foe("Giant", 20)); f4.run({ trySneak: false });
  ok(f4.log.filter((l) => l.why === "your readied favourite").length <= 1, "the opener is only used once per fight");
}
// 4. queued potion: not saved for later
{ const pv = (q) => { const s = mk(); G.give(s, "potion_health", 3); if (q) s.favPot = "health"; const f = new G.Fight(s, foe("Bandit outlaw", 20)); f.hp = G.maxHealth(s) * 0.45; f.turn = 3; return COMBATAI.value(f, COMBATAI.picture(f), "potion:health").v; };
  ok(pv(true) > pv(false), "a queued potion kind scores higher (not kept for later)"); }
// 5. old saves and no wheel in node: nothing breaks
{ const s = mk(); delete s.favs; ok(Array.isArray(FAVWHEEL.list(s)) && FAVWHEEL.list(s).length === 0, "old saves start with an empty wheel");
  ok(FAVWHEEL.opener({ s, turn: 1 }) === null, "no readied move: no opener"); }
console.log(fails ? "FAILS " + fails + " of " + n : "favwheel ok · " + n + " checks");
if (fails) process.exitCode = 1;
`, c);
