// PvP: dying to a player drops your worn gear and 1% of your gold, you keep the rest, and you choose your temple.
// The other player shows up in the fight scene as themselves (their look), not as a bandit.
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "curses.js", "ammo.js", "magic.js", "mp.js", "pvpdeath.js", "perkfx.js", "shieldfx.js", "tbfight.js", "art.js", "heroart.js", "gearlook.js", "fightart.js"];
const c = vm.createContext({ console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, performance: { now: () => 0 } });
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log("FAIL", m); } };
const { G, D, MP, PVPDEATH, FIGHTART, WORLD } = c;

function hero() {
  const s = G.newSave("v1", "Victim", "nord");
  s.inv = []; s.loadouts = { Main: { equipment: {} } }; s.loadout = "Main";
  const sword = G.give(s, "iron_sword"), helm = G.give(s, Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "head"));
  G.equip(s, sword); G.equip(s, helm);
  G.give(s, "potion_health", 3);
  s.gold = 5000; s.discovered = ["Riverwood", "Whiterun", "Solitude", "Bleak Falls Barrow"];
  [s.x, s.y] = WORLD.places["Bleak Falls Barrow"];
  return { s, sword, helm };
}
{ const { s, sword, helm } = hero();
  const d = PVPDEATH.die(s, "Kacper", G.now());
  ok(d.bag && d.bag.gold === 50, "1% of gold drops: " + d.bag?.gold);
  ok(s.gold === 4950, "you keep the rest of your gold: " + s.gold);
  ok(d.bag.items.length === 2, "both worn pieces drop: " + JSON.stringify(d.bag.items));
  ok(!s.inv.some((r) => r.id === sword || r.id === helm), "worn gear is gone from your pack");
  ok(s.inv.some((r) => r.item === "potion_health" && r.qty === 3), "your backpack stays with you");
  ok(Object.keys(s.loadouts.Main.equipment).length === 0, "you wake up with nothing equipped");
  ok(s.pickTemple === true && ["Riverwood", "Whiterun", "Solitude"].includes(s.location), "nearest temple first, then you choose: " + s.location);
  ok(PVPDEATH.temples(s).join() === "Riverwood,Whiterun,Solitude", "temples only in found towns and cities: " + PVPDEATH.temples(s));
  ok(/haven't found/.test(PVPDEATH.goTo(s, "Markarth")), "can't pick a town you haven't found");
  ok(/Solitude/.test(PVPDEATH.goTo(s, "Solitude")) && s.location === "Solitude" && s.x === WORLD.places.Solitude[0], "you go to the temple you picked");
  ok(s.pickTemple === false && /right after/.test(PVPDEATH.goTo(s, "Whiterun")), "only one pick per death");
  ok(/temple/.test(PVPDEATH.pickHTML({ ...s, pickTemple: true })), "temple picker renders");
}
// bound items stay; a broke hero drops no gold
{ const { s } = hero(); s.gold = 40;
  const mask = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].noTrade);
  if (mask) { const id = G.give(s, mask); G.equip(s, id); }
  const d = PVPDEATH.die(s, "X", G.now());
  ok(d.bag.gold === 0 && s.gold === 40, "under 100 gold: nothing to drop");
  if (mask) ok(s.inv.some((r) => r.item === mask), "bound items stay with you");
}
// killed by a player through the note system uses the PvP rules
{ const { s } = hero();
  const r = MP.receive(s, { type: "kill", from: "k1", fromName: "Kacper", to: s.id, t: G.now() });
  ok(r.bag && r.bag.gold === 50 && r.bag.killerName === "Kacper" && s.gold === 4950, "receive(kill) uses the PvP death rules");
  ok(s.pickTemple, "and offers the temple choice");
}
// the other player is drawn as themselves
{ ok(FIGHTART.foeOf({ name: "Kacper", look: { r: "nord", eq: {} } }) === "player", "a player foe is drawn as a player");
  ok(FIGHTART.foeOf({ name: "Bandit" }) !== "player", "normal foes unchanged");
  const s = G.newSave("a1", "Att", "nord");
  const card = { id: "z", name: "Zed", hp: 40, cur: 40, heal: 0, dmg: 1, red: 0, level: 1, look: { r: "orc", eq: {} } };
  const r = MP.attack(s, card, { pos: [s.x, s.y] });
  ok(r.fight.e.look && r.fight.e.look.r === "orc", "the fight carries the other player's look");
}
// in the turn-by-turn fight, another player keeps their real health (no monster boost)
if (c.TB) { const s = G.newSave("a2", "Att", "nord");
  const e = { name: "Zed", health: 130, hp: 130, damage: 6, tags: ["humanoid"], red: 0, level: 5, danger: "high", gold: [0, 0], text: "", look: { r: "orc", eq: {} }, player: true };
  const f = new G.Fight(s, e); f.allies = []; new c.TB.Session(f, { trySneak: false });
  ok(f.ehp === 130, "a player foe keeps their real health: " + f.ehp);
  const f2 = new G.Fight(s, { ...e, look: null, player: false }); f2.allies = []; new c.TB.Session(f2, { trySneak: false });
  ok(f2.ehp > 130, "monsters still get the turn-based boost: " + f2.ehp); }
else ok(false, "tbfight.js loaded");
console.log(fails ? `FAILED ${fails}` : "pvp ok");
process.exit(fails ? 1 : 0);
