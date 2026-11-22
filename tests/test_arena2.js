const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Arena duels run through the real Fight engine with both players' tactics, plus the heal-loop guard.
   W=/path/to/web/ node test_arena2.js */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "curses.js", "ammo.js", "magic.js", "mp.js"];
function phone() {
  const c = { console, Math: Object.create(Math), Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
  c.Math.random = Math.random;   // each "phone" gets its own Math, so seeding one can't leak into the other
  vm.createContext(c);
  for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
  vm.runInContext(`
    var ok = (c, m) => { if (!c) throw new Error("FAIL " + m); };
    function hero(id, name, lvl, build) {
      const s = G.newSave(id, name, "nord"); s.location = "Windhelm"; [s.x, s.y] = WORLD.places.Windhelm; s.gold = 2000; s.level = lvl; s.hpBonus = lvl * 10;
      for (const k of Object.keys(s.skills)) s.skills[k].lvl += lvl;
      if (build === "mage") {
        s.skills.Destruction.lvl = 60; s.mpBonus = 150; s.spells.push("firebolt");
        G.loadout(s).equipment = {}; G.loadout(s).rules = [{ if: "always", do: "spell:firebolt" }];
      }
      G.setHealth(s, G.maxHealth(s)); return s;
    }
    var card = (s) => ({ ...MP.stats(s), id: s.id, name: s.name, loc: s.location });
  `, c);
  return c;
}
const P1 = phone(), P2 = phone();
const run = (c, code) => vm.runInContext(code, c);

// 1) determinism: the same challenge computed on two phones gives the same bout
run(P1, `var a = hero("A","Alfa",10), b = hero("B","Beta",10); var ch = ARENA.challenge(a, card(b), 100);`);
const doc = JSON.stringify(run(P1, "ch.doc"));
const snapB = JSON.stringify(run(P1, "ARENA.snapshot(b)"));
const r1 = JSON.stringify(run(P1, `(() => { const f = ARENA.duel(ch.doc.aSnap, ${snapB}, ch.doc.id, ch.doc.t); return { won: f.won, log: f.log }; })()`));
const r2 = JSON.stringify(run(P2, `(() => { const d = ${doc}; const f = ARENA.duel(d.aSnap, ${snapB}, d.id, d.t); return { won: f.won, log: f.log }; })()`));
if (r1 !== r2) throw new Error("FAIL determinism across phones");
console.log("determinism ok · snapshot", doc.length, "bytes");

run(P1, `
// 2) fairness: identical builds ~50/50, first strike alternates by seed
let aw = 0, first = 0; const N = 400;
for (let i = 0; i < N; i++) {
  const a = hero("A","Alfa",10), b = hero("B","Beta",10);
  const f = ARENA.duel(ARENA.snapshot(a), ARENA.snapshot(b), "fair-" + i, 1e9);
  if (!f.won) aw++; if (f.log[0].turn === 0) first++;
}
console.log("identical builds · challenger won", aw, "of", N, "· challenger struck first", first);
ok(aw > N * 0.4 && aw < N * 0.6, "fair 50/50: " + aw);
ok(first > N * 0.4 && first < N * 0.6, "first strike alternates: " + first);

// 3) stronger usually wins (both directions)
let sw = 0; for (let i = 0; i < 200; i++) { const a = hero("A","Alfa",20), b = hero("B","Beta",8); if (!ARENA.duel(ARENA.snapshot(a), ARENA.snapshot(b), "str-" + i, 1e9).won) sw++; }
let sw2 = 0; for (let i = 0; i < 200; i++) { const a = hero("A","Alfa",8), b = hero("B","Beta",20); if (ARENA.duel(ARENA.snapshot(a), ARENA.snapshot(b), "str2-" + i, 1e9).won) sw2++; }
console.log("level 20 vs 8 · stronger won", sw, "/200 as challenger,", sw2, "/200 as acceptor");
ok(sw > 140 && sw2 > 140, "stronger usually wins");

// 4) tactics respected: a spell-only build casts every turn it can
{ const a = hero("A","Alfa",10,"mage"), b = hero("B","Beta",10);
  const f = ARENA.duel(ARENA.snapshot(a), ARENA.snapshot(b), "mage-1", 1e9);
  const casts = f.log.filter((l) => /Alfa: Firebolt/.test(l.them)).length;
  ok(casts >= 2, "challenger's tactics (firebolt) used: " + casts);
  const g = ARENA.duel(ARENA.snapshot(b), ARENA.snapshot(a), "mage-2", 1e9);
  ok(g.log.filter((l) => /^Firebolt/.test(l.me)).length >= 2, "acceptor's live tactics used");
  ok(g.log.every((l) => l.rule == null || l.rule === 1), "rule numbers reported"); }

// 5) no potions in the arena, and nothing in the real saves is used up
{ const a = hero("A","Alfa",10), b = hero("B","Beta",10);
  G.give(a, "potion_health_minor", 5); G.give(b, "potion_health_minor", 5);
  for (const s of [a, b]) G.loadout(s).rules.unshift({ if: "hp_below", pct: 70, do: "potion:health" });
  const ch = ARENA.challenge(a, card(b), 200);
  ok(!JSON.stringify(ch.doc.aSnap).includes("potion_health"), "no potions in the snapshot");
  const invA = JSON.stringify(a.inv), invB = JSON.stringify(b.inv);
  const r = ARENA.accept(b, JSON.parse(JSON.stringify(ch.doc)));
  ok(!r.fight.log.some((l) => /Drinks/.test(l.me + l.them)), "nobody drinks");
  ARENA.settle(a, r.doc);
  ok(JSON.stringify(a.inv) === invA && JSON.stringify(b.inv) === invB, "no items used or lost");
  ok(a.gold + b.gold === 4000 && !b.dead && G.curHealth(b) > 0, "gold conserved, nobody dies");
  ok(r.fight.arena && r.fight.foeName === "Alfa" && r.fight.hp0 > 0 && r.fight.log.length > 1, "fight scene data"); }

// 6) stakes and ratings over many real bouts
{ let wins = 0;
  for (let i = 0; i < 30; i++) {
    const a = hero("A","Alfa",12), b = hero("B","Beta",8);
    const ch = ARENA.challenge(a, card(b), 300); const r = ARENA.accept(b, JSON.parse(JSON.stringify(ch.doc))); ARENA.settle(a, r.doc);
    ok(a.gold + b.gold === 4000, "stake conserved");
    ok(a.arena.rating + b.arena.rating === 2000, "ratings zero-sum " + a.arena.rating + "+" + b.arena.rating);
    if (r.doc.winner === "A") { wins++; ok(a.gold === 2300 && b.gold === 1700, "payout A"); } else ok(b.gold === 2300 && a.gold === 1700, "payout B");
  }
  ok(wins > 15, "level 12 beats level 8 mostly: " + wins); }

// 7) old challenges without a snapshot still work (stat bout)
{ const a = hero("A","Alfa",10), b = hero("B","Beta",10); const ch = ARENA.challenge(a, card(b), 0); delete ch.doc.aSnap;
  const r = ARENA.accept(b, ch.doc); ok(r.doc.status === "done" && !r.fight.arena, "fallback stat bout"); }
console.log("arena duels ok");

// 8) heal-loop guard
{ const s = hero("H","Healer",5); s.spells.push("healing");
  G.loadout(s).rules = [{ if: "hp_below", pct: 55, do: "spell:healing" }, { if: "always", do: "attack" }];
  s.mpBonus = 2000; G.setHealth(s, G.maxHealth(s));
  let won = 0, guard = 0, heals = 0;
  for (let i = 0; i < 100; i++) {
    G.setHealth(s, G.maxHealth(s));
    const f = new G.Fight(s, { name: "Brute", health: 400, damage: 22, tags: ["humanoid"], level: 5 }); f.run({ trySneak: false, maxTurns: 60 });
    if (f.won) won++; if (f.log.some((l) => /Healing isn't keeping up — you press the attack/.test(l.me))) guard++;
    heals += f.log.filter((l) => /^Healing/.test(l.me)).length;
    for (let j = 2; j < f.log.length; j++) ok(!(/^Healing/.test(f.log[j].me) && /^Healing/.test(f.log[j-1].me) && /^Healing/.test(f.log[j-2].me) && f.log[j-2].hp < 60 && f.log[j-1].hp < 60), "never 3 stalled heals in a row");
  }
  console.log("heal-loop · guard fired in", guard, "of 100 fights · heals", heals, "· won", won);
  ok(guard > 0 && heals > 0, "guard fires, healing still happens");
  // a potion that does lift you over the line is drunk normally, and the guard stays quiet
  const p = hero("P","Drinker",10); G.give(p, "potion_health_minor", 3);
  G.loadout(p).rules = [{ if: "hp_below", pct: 50, do: "potion:health" }, { if: "always", do: "attack" }];
  G.setHealth(p, G.maxHealth(p) * 0.3);
  const f = new G.Fight(p, { name: "Rat", health: 60, damage: 2, tags: ["beast"], level: 1 }); f.run({ trySneak: false });
  ok(/Drinks/.test(f.log[0].me) && !f.log.some((l) => /keeping up/.test(l.me)), "normal potion use: " + f.log[0].me); }
console.log("heal-loop guard ok");
`);
