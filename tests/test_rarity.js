// test_rarity.js: item rarity (rarity.js). Every item gets one of the five rarities, uniques are not all
// legendary, rarity never touches an item's numbers, enchant strength orders fine < rare < epic, and over 100k
// seeded loot rolls the drop mix stays near 60/25/12/2.7/0.3 with tougher foes dropping rarer things.
// Loads the whole game the way index.html does (minus ui/store/p2pnet).
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = { setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, console, Math: Object.create(Math), Date, JSON,
  Float64Array, Float32Array, Uint8Array, Uint8ClampedArray, Int32Array, Uint16Array, Int16Array, Uint32Array,
  Object, Array, Set, Map, WeakMap, Proxy, Number, String, structuredClone, performance: { now: () => 0 },
  navigator: { language: "en" }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
vm.createContext(c);
const html = fs.readFileSync(W + "index.html", "utf8");
const FILES = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => !/^(ui|store|p2pnet)\.js$/.test(f));
for (const f of FILES) {
  if (!fs.existsSync(W + f)) continue;
  try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f }); } catch (e) { /* browser-only files */ }
}
let n = 0, fails = 0;
const ok = (cond, msg) => { n++; if (!cond) { fails++; console.log("FAIL", msg); } };
const { D, G, RARITY, ENCH } = c;
ok(RARITY && D && G, "game loaded with RARITY");
ok(FILES.indexOf("rarity.js") > -1 && FILES.indexOf("rarity.js") < FILES.indexOf("colorcode.js"), "rarity.js loads before colorcode.js");
ok(FILES.indexOf("i18n_rarity.js") > -1 && FILES.indexOf("i18n_rarity.js") < FILES.indexOf("i18n.js"), "i18n_rarity.js loads before i18n.js");

// 1. every item gets a rarity; the one function agrees with rank/name/line
const LIST = ["common", "fine", "rare", "epic", "legendary"];
ok(JSON.stringify(RARITY.LIST) === JSON.stringify(LIST), "five rarities in order");
const ids = Object.keys(D.ITEMS);
ok(ids.length > 300, `many items (${ids.length})`);
const snap = JSON.stringify(ids.map((id) => [id, D.ITEMS[id]]));
const count = {};
for (const id of ids) { const r = RARITY.of(id); count[r] = (count[r] || 0) + 1; if (!LIST.includes(r)) ok(false, `${id} has rarity ${r}`); }
ok(LIST.every((r) => count[r] > 0), `every rarity is used ${JSON.stringify(count)}`);
ok(count.common + count.fine > count.rare + count.epic + count.legendary, "most items are common or fine");
ok(RARITY.of("no_such_item") === "common" && RARITY.of(null) === "common", "unknown items are common, not a crash");
ok(RARITY.rank("common") === 0 && RARITY.rank("legendary") === 4, "rank 0..4");
ok(RARITY.name("rare") === "Rare" && RARITY.line("iron_sword") === "Common", "names and lines");

// 2. rarity never touches numbers: reading it changes no item, and known stats match main
ok(JSON.stringify(ids.map((id) => [id, D.ITEMS[id]])) === snap, "RARITY.of changes no item");
const SAMPLE = { iron_sword: { damage: 7, value: 25, weight: 9 }, steel_sword: { damage: 8, value: 45, weight: 10 }, elven_sword: { damage: 11, value: 235, weight: 13 },
  iron_helmet: { armor: 15, value: 60, weight: 5 }, u_stormcaller_fang: { damage: 11, value: 900, weight: 13 }, wuuthrad: { damage: 25, value: 2000, weight: 25 },
  azuras_star: { value: 1500, weight: 1 }, gauldur_amulet: { value: 1500, weight: 0.5 } };
for (const [id, want] of Object.entries(SAMPLE)) for (const [k, v] of Object.entries(want)) ok(D.ITEMS[id] && D.ITEMS[id][k] === v, `${id}.${k} is still ${v} (got ${D.ITEMS[id] && D.ITEMS[id][k]})`);
const fz = D.ITEMS["ench|iron_sword|fire|10|0"];
ok(fz && fz.damage === 7 && JSON.stringify(fz).includes("\"magnitude\":10"), "an enchanted iron sword keeps the base damage and its magnitude");
ok(JSON.stringify(D.ITEMS["u_stormcaller_fang"]).includes("\"magnitude\":18"), "Stormcaller's Fang enchant unchanged");

// 3. uniques: a separate flag, not all legendary; true artifacts are legendary
const uniq = ids.filter((id) => RARITY.unique(id));
const uc = {}; for (const id of uniq) uc[RARITY.of(id)] = (uc[RARITY.of(id)] || 0) + 1;
ok(uniq.length > 20, `uniques found (${uniq.length})`);
ok(uc.legendary < uniq.length && (uc.rare || 0) + (uc.epic || 0) > 5, `uniques are not all legendary ${JSON.stringify(uc)}`);
ok(uniq.every((id) => RARITY.rank(RARITY.of(id)) >= 2), "a unique is at least rare");
for (const id of ["azuras_star", "wuuthrad", "gauldur_amulet", "u_stormcaller_fang"]) ok(RARITY.of(id) === "legendary", `${id} is legendary`);
ok(ids.filter((id) => RARITY.of(id) === "legendary").every((id) => RARITY.unique(id)), "every legendary is also unique");
ok(RARITY.tag("u_stormcaller_fang").includes("rar-u") && RARITY.line("u_stormcaller_fang") === "Legendary · Unique", "unique shows its word next to the rarity");
ok(RARITY.tag("iron_sword") === "", "common plain items show no extra word in lists");

// 4. base gear: common or fine by material/craft; tempering bumps common to fine
ok(RARITY.of("iron_sword") === "common" && RARITY.of("steel_sword") === "common" && RARITY.of("elven_sword") === "fine", "material sets common/fine");
ok(RARITY.of("iron_sword", { item: "iron_sword", tq: 2 }) === "fine", "a tempered iron sword is fine");
const plain = ids.filter((id) => RARITY.WEAR.has(D.ITEMS[id].slot) && !String(id).startsWith("ench|") && !RARITY.unique(id) && !D.ITEMS[id].ench && !D.ITEMS[id].aenchant && !D.ITEMS[id].staff && !RARITY.OVERRIDE[id]);
ok(plain.length > 50 && plain.every((id) => ["common", "fine"].includes(RARITY.of(id))), `plain unenchanted gear is common or fine (${plain.length})`);

// 5. enchanted: fine..epic by strength, never common, never legendary
const fire = (m) => RARITY.of(`ench|iron_sword|fire|${m}|0`);
ok(fire(5) === "fine" && RARITY.rank(fire(18)) >= RARITY.rank(fire(10)) && RARITY.rank(fire(30)) >= RARITY.rank(fire(18)), `fire 5/10/18/30 → ${fire(5)}/${fire(10)}/${fire(18)}/${fire(30)}`);
ok(fire(30) === "epic", "a full-strength enchant is epic");
for (const e of Object.keys(ENCH.WEAPON)) { const r = RARITY.of(`ench|iron_sword|${e}|${ENCH.WEAPON[e][1]}|0`); ok(["fine", "rare", "epic"].includes(r), `ench ${e} → ${r}`); }

// 6. drop mix over 100k seeded loot rolls
let seed = 12345; c.Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function roll(kind, level, N) {
  const s = G.newSave("Sim", "Warrior", "nord"); s._test = true; s.level = level;
  const got = [];
  for (let i = 0; i < N; i++) {
    const e = kind === "boss" ? { name: "Bandit chief", boss: true, tags: ["humanoid", "elite"], level } : kind === "elite" ? { name: "Bandit marauder", tags: ["humanoid", "elite"], level } : { name: "Bandit outlaw", tags: ["humanoid"], level };
    s.inv = []; G.rollLoot(s, e);
    for (const r of s.inv) for (let q = 0; q < (D.ITEMS[r.item] && D.ITEMS[r.item].slot === "ammo" ? 1 : r.qty || 1); q++) got.push(r.item);
  }
  return RARITY.share(got);
}
const pct = (sh) => LIST.map((k) => `${k} ${(sh[k] * 100).toFixed(1)}`).join(" ");
const hum = [5, 15, 30, 45].map((lv) => roll("humanoid", lv, 17500));
const mix = { total: 0 }; for (const k of LIST) mix[k] = hum.reduce((a, s) => a + s[k] * s.total, 0) / hum.reduce((a, s) => a + s.total, 0);
const elite = roll("elite", 25, 20000), boss = roll("boss", 30, 10000);
console.log("  ordinary foes", pct(mix)); console.log("  elite        ", pct(elite)); console.log("  boss         ", pct(boss));
const within = (v, lo, hi, what) => ok(v >= lo && v <= hi, `${what} ${(v * 100).toFixed(2)}% in ${lo * 100}-${hi * 100}%`);
within(mix.common, 0.52, 0.72, "ordinary common"); within(mix.fine, 0.17, 0.33, "ordinary fine"); within(mix.rare, 0.05, 0.17, "ordinary rare");
within(mix.epic, 0.003, 0.04, "ordinary epic"); within(mix.legendary, 0, 0.001, "ordinary legendary");
const better = (a) => a.rare + a.epic + a.legendary;
ok(elite.common < mix.common && better(elite) > better(mix), "elites drop rarer things than ordinary foes");
ok(better(boss) >= better(elite) - 0.01 && boss.legendary > 0, "bosses drop at least as well as elites, and legendaries can drop");
within(boss.legendary, 0.001, 0.01, "boss legendary");
ok(hum[3].epic >= hum[0].epic, "epic finds grow with level");

console.log(fails ? `rarity FAILED ${fails}/${n}` : `rarity ok (${n} checks)`);
process.exit(fails ? 1 : 0);
