const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* How long does a new player take to reach each unlock (unlocks.js)? A quick sim with the real levelling code:
   a fresh level-1 hero plays a simple loop (road fights with the real fight code, travel, selling loot, and from level 4
   some forge work) and we add up the minutes a phone player spends on each part. Not a CI test: run it by hand when
   the unlock levels or XP numbers change.   W=/path/to/game/ node sim_unlocktimes.js [runs]
   Minutes per action are rough guesses from playing on a phone: a road fight = 20 s of setup + 5 s a turn,
   a trip = 2 min, selling 3 things = 40 s, one forge item = 30 s. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME;
const RUNS = +(process.argv[2] || 40);
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "unlocks.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const pool = D.ENCOUNTERS.filter((e) => e.kind !== "event" && e.health && e.danger !== "high");
const MAXL = 20, at = Array.from({ length: MAXL + 1 }, () => []);
for (let r = 0; r < RUNS; r++) {
  const s = G.newSave("sim" + r, "Sim", "nord"); s._test = true; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun;
  G.give(s, "iron_sword"); G.equip(s, s.inv[s.inv.length - 1].id);
  for (const a of ["hide_helmet", "hide_armor", "hide_bracers", "hide_boots"]) { G.give(s, a); G.equip(s, s.inv[s.inv.length - 1].id); }
  G.loadout(s).rules = [{ if: "sp_above", pct: 70, do: "power_attack" }, { if: "always", do: "attack" }];
  let min = 0, guard = 0, last = 1;
  while (s.level < MAXL && guard++ < 20000) {
    // a trip: Athletics on the road (about 6 game-hours of walking per real 2 minutes)
    G.useSkill(s, "Athletics", 6 * 3600 * F.ATHLETICS_XP_PER_SECOND / 60); min += 2;
    // two road fights on the way
    for (let k = 0; k < 2; k++) {
      s.health = G.maxHealth(s); s.healthTs = G.now();
      const f = new G.Fight(s, G.scaleEnemy({ ...pool[Math.floor(Math.random() * pool.length)] }, s.level), null); f.run({ trySneak: false });
      if (f.won && f.apply) { try { f.apply(); } catch { /* loot rolls need more modules */ } }
      min += (20 + 5 * (f.turn || 6)) / 60;
    }
    // in town: sell three things
    for (let k = 0; k < 3; k++) G.useSkill(s, "Mercantile", 15 + s.level * 3); min += 40 / 60;
    // from level 4: one forge item per stop
    if (s.level >= 4) { G.useSkill(s, "Smithing", 25 + 3 * Math.pow(20 + s.level * 4, 0.65)); min += 0.5; }
    // pending level-ups are spent straight away (they don't block levelling)
    s.pendingLevels = 0;
    while (last < s.level) { last++; at[last].push(min); }
  }
}
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const opens = {}; for (const f of UNLOCKS.TABLE) (opens[f.level] = opens[f.level] || []).push(f.name);
console.log("level  minutes (median)  gap   opens");
let prev = 0, prevU = 0;
for (let L = 2; L <= MAXL; L++) {
  const m = med(at[L]);
  const gap = opens[L] ? (m - prevU).toFixed(0) : "";
  console.log(String(L).padEnd(7) + (m.toFixed(0) + " min").padEnd(18) + String(gap).padEnd(6) + (opens[L] || []).join(", "));
  if (opens[L]) prevU = m; prev = m;
}
`, c);
