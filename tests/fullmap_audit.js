// Lists every map place and what it offers when you arrive. Places that offer nothing are printed at the end.
//   node fullmap_audit.js            (uses ../game/)
//   node fullmap_audit.js --before   (ignores placestuff.js: what the map looked like before it)
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const before = process.argv.includes("--before");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy };
vm.createContext(c);
const files = ["data.js", "world.js", "terrain.js", "solworld.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "smithing.js", "roam.js", "explore.js", "mp.js"];
if (!before) files.push("placestuff.js");
for (const f of files) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
c.QSRC = ["quests.js", "guilds.js", "daedric.js", "priests.js", "civilwar.js", "solstheim.js"].map((f) => fs.readFileSync(W + f, "utf8")).join("\n");
const out = vm.runInContext(`(() => {
  const kinds = {}, rows = [], empty = [];
  for (const [n, p] of Object.entries(WORLD.places)) {
    const k = p[2]; kinds[k] = (kinds[k] || 0) + 1;
    const why = [];
    if (TOWNS.isTown(n)) why.push("town"); if (G.shopTypes(n).length) why.push("shop"); if (DUNGEONS.enterable(n)) why.push("dungeon");
    if (POWERS.STONE_AT[n]) why.push("stone"); if (SMITH.MINES[n]) why.push("mine"); if (n === "High Hrothgar") why.push("greybeards");
    if (typeof PLACESTUFF !== "undefined" && PLACESTUFF.offers(n).length) why.push(...PLACESTUFF.offers(n));
    const extra = [];
    if (EXPLORE.SECRETS[n]) extra.push("one-time secret"); if (QSRC.includes('"' + n + '"')) extra.push("named in a quest file");
    rows.push([n, k, why, extra]);
    if (!why.length) empty.push(n + " [" + k + "]" + (extra.length ? " (" + extra.join(", ") + ")" : ""));
  }
  return { kinds, total: rows.length, empty };
})()`, c);
console.log("places:", out.total, JSON.stringify(out.kinds));
console.log("offering nothing (or only flavour / a one-time secret):", out.empty.length);
for (const e of out.empty) console.log("  " + e);
module.exports = out;
