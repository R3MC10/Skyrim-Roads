// Every item's tooltip says what it does (tooltip.js itemHTML): not just the name. Loops over all item ids.
// node test_itemtips.js — prints "itemtips ok".
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 1 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).concat(["jewelry.js", "skillinfo.js", "tomeinfo.js", "tooltip.js"]);
for (const f of [...new Set(FILES)]) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; if (fails < 400) console.log("FAIL", m); } };
const { G, D, TIP } = c;
const s = G.newSave("it", "Tipper", "nord"); s._test = true; s.level = 15;
c.TIP.state = () => s;
const text = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();
/* the effect part: everything after the name, the kind line and the number boxes */
const effect = (h) => text(String(h || "").replace(/<b class="tt-h[^"]*">[\s\S]*?<\/b>/, "").replace(/<div class="tt-sub">[\s\S]*?<\/div>/, "").replace(/<div class="tt-stats">[\s\S]*?<\/div>/g, ""));
const bySlot = {};
for (const id of Object.keys(D.ITEMS)) {
  const it = D.ITEMS[id], h = TIP.html("item:" + id);
  ok(typeof h === "string" && !/undefined|NaN|\[object/.test(h), `${id}: a clean tooltip`);
  ok(/Value/.test(h) && /Weight/.test(h), `${id}: value and weight`);
  const e = effect(h);
  ok(e.length >= 8 && e !== it.name, `${id} (${it.slot}): says what it does, got "${e}"`);
  bySlot[it.slot] = (bySlot[it.slot] || 0) + 1;
  if ((it.slot === "potion" && it.restore) || (it.slot === "scroll" && D.SPELLS[it.spell])) ok(/In a fight <b>\d AP/.test(h), `${id}: its AP cost in a fight`);
  if (it.slot === "scroll" && D.SPELLS[it.spell]) ok(/\d/.test(e), `${id}: the scroll's numbers`);
}
// names on icon-only buttons turn into the full item tooltip
{ const fw = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "scroll");
  ok(fw && TIP.keyForText && TIP.keyForText(D.ITEMS[fw].name) === "item:" + fw, "an item's name alone finds its tooltip");
  ok(TIP.keyForText && TIP.keyForText(D.ITEMS[fw].name + ", 3 left") === "item:" + fw, "even with a count after it");
  ok(TIP.keyForText && TIP.keyForText("Close favourites") === null, "other words stay plain");
}
console.log(fails ? `${fails}/${n} FAILED` : `itemtips ok (${n} checks over ${Object.keys(D.ITEMS).length} items: ${Object.entries(bySlot).map(([k, v]) => k + " " + v).join(", ")})`);
process.exit(fails ? 1 : 0);
