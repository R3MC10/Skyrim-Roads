const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const ctx = { console, Math, Date, JSON, Set, Object, Array, String, Number, Uint8Array, Float32Array, Float64Array, Int32Array, Infinity, isFinite };
vm.createContext(ctx);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "engine.js"])
  vm.runInContext(fs.readFileSync(__GAME + "" + f, "utf8").replace(/^const (D|F|G|WORLD|Terrain) =/m, "globalThis.$1 ="), ctx);
const { D, F, G } = ctx;
let t = G.now();
// new character
const s = G.newSave("u1", "Remi", "nord");
console.log("skills nord:", ["Two-Handed","Blocking","One-Handed","Speechcraft","Mercantile"].map(k=>k+" "+G.skill(s,k)).join(", "));
console.log("inv:", s.inv.map(r => D.ITEMS[r.item].name + "x" + r.qty).join(", "), "| carried", G.carried(s), "/", G.capacity(s));
console.log("speed px/min", G.speed(s).toFixed(1));
// full trip simulation with catch-up after 15 minutes closed
let res = { arrived: 0, died: 0, encounterStops: 0 };
for (let i = 0; i < 300; i++) {
  const p = G.newSave("u" + i, "T", Object.keys(D.RACES)[i % 10]);
  let tt = t; G.startTrip(p, "Windhelm", ctx.WORLD.places.Windhelm.slice(0, 2), tt);
  for (let k = 0; k < 200; k++) {
    tt += 60 * 3;                                  // player opens the page every 3 minutes
    const out = G.advance(p, tt);
    if (out.died) { res.died++; break; }
    if (out.arrived) { res.arrived++; break; }
    if (out.encounter) {
      res.encounterStops++;
      const e = out.encounter;
      const a = G.curHealth(p, tt) < 60 && G.countRestore(p, "health") ? "potion" : e.danger === "high" ? (Math.random() < .5 ? "flee" : "sneak") : "fight";
      const r = G.encounterAction(p, a, tt);
      if (r.died) { res.died++; break; }
    }
  }
}
console.log("300 trips Riverwood->Windhelm:", res);
// fight log
const p = G.newSave("x", "Remi", "breton"); p.spells.push("sun_fire");
p.loadouts.Main.rules = JSON.parse(JSON.stringify(D.PRESETS.battlemage.rules));
const e = G.scaleEnemy(D.ENCOUNTERS.find(x => x.name === "Draugr"), 1);
const f = new G.Fight(p, e); f.run(); console.log("fight:", f.log.slice(0, 3).map(l => `T${l.turn}[${l.rule}] ${l.me} / ${l.them}`).join(" | "), "won:", f.won);
// shops & equip
const q = G.newSave("y", "Q", "imperial"); q.gold = 5000;
const day = G.clock(t); const openT = t + ((14 - day.hour + 24) % 24) * 3600 / 12;
console.log(G.buy(q, "steel_battleaxe", 1, openT), "|", G.equip(q, q.inv[q.inv.length - 1].id), "|", G.sell(q, q.inv[0].id, 1, openT));
// knocked down: no penalty, no bag (defeat.js)
const inv0 = q.inv.length, gold0 = q.gold, d = G.die(q, "Giant", t); console.log("knocked down:", d.msg, "| bag:", d.bag, "| kept:", q.inv.length === inv0 && q.gold === gold0);
if (d.bag || q.inv.length !== inv0 || q.gold !== gold0) throw new Error("losing a fight must cost nothing");
// level up
const r = G.newSave("z", "Z", "orc"); r.pendingLevels = 1; console.log(G.levelUp(r, "stamina"), G.capacity(r));
console.log("JSON size of save:", JSON.stringify(s).length, "bytes");
