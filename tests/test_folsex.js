// followers are drawn as the right sex: every women's look (travel strip, fights, party members' cards) carries sx "f",
// the men's don't, Meeko is left alone; the painted rig gives a woman's look a woman's body. W=/path/to/game/ node test_folsex.js
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "horses.js", "horseback.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "craftfair.js", "social.js", "ammo.js", "tomes.js", "magic.js", "combatai.js", "mp.js", "coop.js", "party.js", "followers2.js", "followerai.js", "encounters.js", "homestead.js", "rigdata.js", "rig.js"];
const WOMEN = ["lydia", "jenassa", "uthgerd", "mjoll", "aela", "brelyna", "annekke", "borgakh", "hs_pinewatch"];
let n = 0;
for (const withNpc of [true, false]) {   // with npcart.js's table and with only the fallback list
  const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RegExp };
  vm.createContext(c);
  for (const f of withNpc ? [...FILES, "npcart.js"] : FILES)
    if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (e) { if (f === "npcart.js" || f === "encounters.js" || f === "homestead.js") console.log("  (skipped " + f + ": " + e.message + ")"); else throw e; } }
  c.WOMEN = WOMEN; c.withNpc = withNpc;
  n += vm.runInContext(`
  let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + (withNpc ? "[npcart] " : "[fallback] ") + m); n++; };
  FOL2.install();
  const ids = Object.keys(TOWNS.FOLLOWERS).concat(Object.keys(FOL2.INFO)).filter((v, i, a) => a.indexOf(v) === i);
  OK(ids.includes("jenassa") && ids.includes("lydia") && ids.includes("brelyna"), "the follower list is there");
  if (typeof NPCART !== "undefined") for (const [id, row] of Object.entries(NPCART.FOLLOWER_LOOK)) if (id !== "meeko") OK((row[1] === "f") === WOMEN.includes(id), "fallback list agrees with npcart for " + id);
  for (const id of ids) {
    if (id === "meeko") { OK(FOL2.sexOf(id) === "m", "Meeko stays a dog"); continue; }
    const fem = WOMEN.includes(id), want = fem ? "f" : undefined;
    OK(FOL2.sexOf(id) === (fem ? "f" : "m"), id + " sex");
    const s = G.newSave("A" + id, "Alfa", "nord"); s.follower = { id, hp: 100 };
    OK(FOL2.look(s).sx === want, id + " look sx " + FOL2.look(s).sx);
    OK(PARTY.followerLook(id).sx === want, id + " travel look sx");
    OK(FOL2.lookFromCard({ id: "u1", fold: { id, r: "nord", eq: {} } }).sx === want, id + " card look sx");
    if (typeof PAINTRIG !== "undefined") OK(PAINTRIG.setOf({ fem: FOL2.look(s).sx === "f" }, FOL2.look(s)).startsWith(fem ? "nordf" : "nordm"), id + " painted body");
  }
  n;`, c);
}
console.log("test_folsex: " + n + " checks passed");
