// Town traders sell basic gear only: basic metals, weak enchantments, novice/apprentice staffs, plain jewellery. node test_shopcap.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).concat(["craftfair.js", "smithing.js", "caravans.js", "shopcap.js"].filter((f, i, a) => a.indexOf(f) === i));
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, D, SHOPCAP, WORLD } = c;
const HIGH = /elven|dwarven|orcish|glass|ebony|daedric|dragon|stalhrim|ancient nord|nightingale|forsworn/i;
const sold = new Set(); for (const t of Object.keys(WORLD.places)) for (const id of G.shopStock(t)) sold.add(id);
const gear = [...sold].filter((i) => SHOPCAP.isGear(i, D.ITEMS[i]));
ok(gear.length > 30, "towns still sell plenty of gear: " + gear.length);
ok(!gear.some((i) => HIGH.test(D.ITEMS[i].name)), "no fine metals in any town: " + gear.filter((i) => HIGH.test(D.ITEMS[i].name)).join(","));
ok(gear.some((i) => /^iron_|^steel_/.test(i)) && gear.some((i) => /^hide_|^leather_/.test(i)), "iron, steel, hide and leather are on sale");
ok(gear.some((i) => i.startsWith("ench|")), "enchanted basic pieces are still on sale");
ok(gear.filter((i) => i.startsWith("ench|")).every((i) => +i.split("|")[3] <= SHOPCAP.ENCH_MAX), "only weak enchantments");
ok(!sold.has("staff_fireballs") && !sold.has("staff_paralysis") && sold.has("staff_flames"), "staffs: novice and apprentice spells only");
ok(SHOPCAP.ok("silver_ring") && SHOPCAP.ok("gold_necklace") && !SHOPCAP.ok("gold_emerald_ring") && !SHOPCAP.ok("silver_garnet_necklace"), "jewellery: plain silver and gold only");
ok(SHOPCAP.ok("steel_sword_frost") && SHOPCAP.ok("potion_health") && SHOPCAP.ok("tome_firebolt") && SHOPCAP.ok("mat_ebony" in D.ITEMS ? "mat_ebony" : "potion_health"), "weak weapon enchantments, potions, tomes and materials are fine");
ok(!SHOPCAP.ok("ench|steel_helmet|health|40|0"), "a strong enchantment can't be bought");
// buying something above the cap is refused, even if asked for directly
{ const s = c.make("warrior", 20); s.location = "Whiterun"; s.gold = 99999; const t = G.now ? G.now() : 0;
  const day = (h) => { const base = 1795132800; for (let x = t; x < t + 86400; x += 300) { if (Math.floor(G.clock(x).hour) === h) return x; } return t; };
  const r = G.buy(s, "elven_sword", 1, day(12)); ok(/basic gear/.test(r) && s.gold === 99999, "a shop won't sell an elven sword: " + r);
  const r2 = G.buy(s, "gold_diamond_ring", 1, day(12)); ok(/plain silver and gold/.test(r2), "or a diamond ring: " + r2);
  const r3 = G.buyFrom(s, "elven_bow"); ok(/basic gear/.test(r3), "roadside traders follow the same rule"); }
// caravans and the roadside caravan
{ const CV = vm.runInContext("CARAVANS", c); for (const L of CV.LINES) { const st = CV.stock({ line: L, id: L.id + "-1-0" }); ok(st.every((i) => SHOPCAP.ok(i)), L.name + " sells basic goods: " + st.join(",")); } }
console.log(fails ? `failed: ${fails}` : `shopcap: all ok · ${n} checks`);
process.exit(fails ? 1 : 0);
