// The house chest (towns.js stash/unstash + homestash.js lists): move one, an amount or all both ways with counts kept
// (nothing doubled, nothing lost), alike things stack, worn gear can't go in, improvements/stolen marks travel with
// the item, the lists filter and sort, and the chest survives a save round-trip.
// W=/path/to/game/ node test_stash.js
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
vm.runInContext("var I18N_STORY = { ex: {}, pats: [] };", c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "enchanting.js", "quests.js", "magic.js", "smithing.js", "craftfair.js", "visits.js", "homestash.js", "patchnotes.js", "i18n_homestash.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const mk = () => { const s = G.newSave("st" + Math.random(), "Tester", "nord"); s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.gold = 99999; s.thaneWhiterun = true; s.bounty = null; return s; };
const have = (s, item) => s.inv.filter((r) => r.item === item).reduce((a, r) => a + r.qty, 0);
const inChest = (s, item) => TOWNS.home(s).chest.filter((r) => r.item === item).reduce((a, r) => a + r.qty, 0);
const rowOf = (s, item) => s.inv.find((r) => r.item === item);
const at = (s, item) => TOWNS.home(s).chest.findIndex((r) => r.item === item);

const s = mk();
OK(/house/i.test(TOWNS.stash(s, 1)), "no house: refuses");
OK(/key/.test(TOWNS.buyHome(s)), "buy Breezehome");

// 1. stacks: one, an amount, all, both ways; totals never change
G.give(s, "potion_health", 10);
const tot = () => have(s, "potion_health") + inChest(s, "potion_health");
const t0 = tot();
TOWNS.stash(s, rowOf(s, "potion_health").id, 1);
OK(inChest(s, "potion_health") === 1 && tot() === t0, "store 1 of a stack");
TOWNS.stash(s, rowOf(s, "potion_health").id, 4);
OK(inChest(s, "potion_health") === 5 && TOWNS.home(s).chest.filter((r) => r.item === "potion_health").length === 1, "store 4 more: one stack of 5");
TOWNS.stash(s, rowOf(s, "potion_health").id, "999");
OK(inChest(s, "potion_health") === t0 && have(s, "potion_health") === 0 && tot() === t0, "store more than you have: stores the whole stack, no more");
TOWNS.unstash(s, at(s, "potion_health"), 2);
OK(have(s, "potion_health") === 2 && inChest(s, "potion_health") === t0 - 2, "take 2");
TOWNS.unstash(s, at(s, "potion_health"), "abc");
OK(have(s, "potion_health") === t0 && inChest(s, "potion_health") === 0 && at(s, "potion_health") === -1, "take the rest (bad amount = all): row gone");
OK(s.inv.filter((r) => r.item === "potion_health").length === 1, "taken potions land on one stack");
TOWNS.stash(s, rowOf(s, "potion_health").id);
OK(inChest(s, "potion_health") === t0 && have(s, "potion_health") === 0, "no amount = the whole row (old callers)");
TOWNS.unstash(s, at(s, "potion_health"), 0);
OK(have(s, "potion_health") === t0, "amount 0 = all");

// 2. materials and ingredients stack in the chest now too
G.give(s, "mat_iron", 3); TOWNS.stash(s, rowOf(s, "mat_iron").id, 1); TOWNS.stash(s, rowOf(s, "mat_iron").id, 1);
OK(TOWNS.home(s).chest.filter((r) => r.item === "mat_iron").length === 1 && inChest(s, "mat_iron") === 2 && have(s, "mat_iron") === 1, "iron stacks in the chest");

// 3. gear: one row each, improvements and stolen marks travel both ways
G.give(s, "steel_sword", 1); const sw = rowOf(s, "steel_sword"); sw.temper = 4; sw.tq = 2; sw.stolen = true;
TOWNS.stash(s, sw.id);
OK(!rowOf(s, "steel_sword") && TOWNS.home(s).chest[at(s, "steel_sword")].temper === 4, "improved sword goes in");
G.give(s, "steel_sword", 1); TOWNS.stash(s, rowOf(s, "steel_sword").id);
OK(TOWNS.home(s).chest.filter((r) => r.item === "steel_sword").length === 2, "a plain sword doesn't merge with the improved one");
const ix = TOWNS.home(s).chest.findIndex((r) => r.item === "steel_sword" && r.temper === 4);
TOWNS.unstash(s, ix);
const back = s.inv.find((r) => r.item === "steel_sword");
OK(back && back.temper === 4 && back.tq === 2 && back.stolen === true, "improvement, quality and stolen mark come back");
// a gift row of 2 swords (from a visitor) comes out as two separate rows
const sw0 = have(s, "iron_sword");
TOWNS.home(s).chest.push({ item: "iron_sword", qty: 2, charge: null });
TOWNS.unstash(s, at(s, "iron_sword"), 1);
OK(have(s, "iron_sword") === sw0 + 1 && inChest(s, "iron_sword") === 1, "take 1 of 2 swords");
TOWNS.unstash(s, at(s, "iron_sword"));
OK(s.inv.filter((r) => r.item === "iron_sword").length === sw0 + 2 && s.inv.filter((r) => r.item === "iron_sword").every((r) => r.qty === 1), "swords come out one per row");

// 4. worn gear (any loadout) can't go in, and isn't on the Your pack list
const worn = rowOf(s, "steel_sword"); G.equip(s, worn.id);
OK(Object.values(G.loadout(s).equipment).includes(worn.id), "sword is equipped");
const before = JSON.stringify(TOWNS.home(s).chest);
OK(/wearing/.test(TOWNS.stash(s, worn.id)) && rowOf(s, "steel_sword") && JSON.stringify(TOWNS.home(s).chest) === before, "equipped sword is refused, nothing moves");
OK(!HSTASH.rows(s, "pack").some((r) => r.key === worn.id), "equipped sword isn't listed on Your pack");
for (const k of Object.keys(G.loadout(s).equipment)) if (G.loadout(s).equipment[k] === worn.id) delete G.loadout(s).equipment[k];
s.loadouts.Spare = { ...JSON.parse(JSON.stringify(G.loadout(s))), equipment: { weapon: worn.id } };
OK(/wearing/.test(TOWNS.stash(s, worn.id)) && rowOf(s, "steel_sword"), "worn in another loadout: still refused");
OK(!HSTASH.rows(s, "pack").some((r) => r.key === worn.id), "and not listed");
delete s.loadouts.Spare;

// 5. the lists: categories, counts, sort, icons-ready rows, weight
G.give(s, "ing_blue_flower", 3); G.give(s, "tome_sparks", 1); G.give(s, "iron_helmet", 1);
for (const it of ["ing_blue_flower", "tome_sparks", "iron_helmet"]) TOWNS.stash(s, rowOf(s, it).id);
const all = HSTASH.rows(s, "chest");
OK(all.length === TOWNS.home(s).chest.length, "every chest row is listed");
OK(all.every((r) => r.it && D.ITEMS[r.r.item]), "every listed row knows its item (for its icon)");
OK(HSTASH.rows(s, "chest", "ingredients").every((r) => r.it.slot === "ingredient") && HSTASH.rows(s, "chest", "ingredients").length === 1, "Ingredients filter");
OK(HSTASH.rows(s, "chest", "books").length === 1 && HSTASH.rows(s, "chest", "apparel").length === 1, "Books and Apparel filters");
const cn = HSTASH.counts(s, "chest"); OK(cn.all === all.length && cn.weapons >= 1, "counts per category");
const byW = HSTASH.rows(s, "chest", "all", "weight", 1).map((r) => r.weight);
OK(byW.every((w, i) => i === 0 || byW[i - 1] >= w), "sort by weight, heaviest first");
const byN = HSTASH.rows(s, "chest", "all", "name", -1).map((r) => r.name);
OK(byN.every((x, i) => i === 0 || byN[i - 1].localeCompare(x) >= 0), "sort by name Z–A");
const cw = TOWNS.home(s).chest.reduce((a, r) => a + D.ITEMS[r.item].weight * r.qty, 0);
OK(Math.abs(HSTASH.chestWeight(s) - cw) < 0.01, "chest weight adds up");
OK(HSTASH.load(s).cap > 0, "your load has a cap");
OK(HSTASH.catOf(D.ITEMS.potion_health) === "potions" && HSTASH.catOf(D.ITEMS.steel_sword) === "weapons" && HSTASH.catOf(D.ITEMS.soul_gem_common) === "misc", "categories match the Items menu");
// rows key: chest rows by place, pack rows by inventory id
OK(all.every((r) => TOWNS.home(s).chest[r.key] === r.r), "chest rows point at their place in the chest");

// 6. the view state: switching side resets the pick
HSTASH.act(s, { op: "sel", id: "0" }); OK(HSTASH.ui.sel === 0, "pick a row");
HSTASH.act(s, { op: "side", id: "pack" }); OK(HSTASH.ui.side === "pack" && HSTASH.ui.sel === null, "switch to Your pack");
HSTASH.act(s, { op: "sort", id: "value" }); HSTASH.act(s, { op: "sort", id: "value" }); OK(HSTASH.ui.sort === "value" && HSTASH.ui.dir === -1, "tap the same sort again flips it");
HSTASH.act(s, { op: "side", id: "chest" });

// 7. save round-trip: the chest and its stacks come back exactly
const snap = JSON.parse(JSON.stringify(s));
OK(JSON.stringify(TOWNS.home(snap).chest) === JSON.stringify(TOWNS.home(s).chest), "chest survives a save round-trip");
const s2 = snap; const t2 = inChest(s2, "ing_blue_flower");
TOWNS.unstash(s2, at(s2, "ing_blue_flower"), 1);
OK(inChest(s2, "ing_blue_flower") === t2 - 1 && have(s2, "ing_blue_flower") >= 1, "a reloaded chest still moves things");

// 8. totals across everything: nothing doubled or lost over many random moves
const s3 = mk(); TOWNS.buyHome(s3);
for (const [it, q] of [["potion_health", 7], ["ing_lavender", 5], ["mat_steel", 4], ["iron_dagger", 3], ["scroll_healing", 2]]) G.give(s3, it, q);
const total = () => { const m = {}; for (const r of s3.inv) m[r.item] = (m[r.item] || 0) + r.qty; for (const r of TOWNS.home(s3).chest) m[r.item] = (m[r.item] || 0) + r.qty; return JSON.stringify(Object.keys(m).sort().map((k) => [k, m[k]])); };
const T0 = total();
let seed = 7; const rnd = (k) => { seed = (seed * 9301 + 49297) % 233280; return Math.floor(seed / 233280 * k); };
for (let i = 0; i < 300; i++) {
  if (rnd(2)) { const rs = s3.inv.filter((r) => !HSTASH.worn(s3).has(r.id)); if (rs.length) { const r = rs[rnd(rs.length)]; TOWNS.stash(s3, r.id, 1 + rnd(r.qty + 1)); } }
  else { const ch = TOWNS.home(s3).chest; if (ch.length) { const k = rnd(ch.length); TOWNS.unstash(s3, k, 1 + rnd(ch[k].qty + 1)); } }
  if (total() !== T0) throw new Error("FAIL totals changed at move " + i);
}
OK(true, "300 random moves keep every count");
OK(TOWNS.home(s3).chest.every((r) => r.qty > 0) && s3.inv.every((r) => r.qty > 0), "no empty rows left behind");

// 9. Polish and patch note
OK(I18N_STORY.ex["Your pack"] && I18N_STORY.ex["Store 1"] && I18N_STORY.pats.some(([en]) => en === "Take all ({0})"), "Polish lines are in");
const pn = PATCHNOTES.LIST[0];
OK(pn.id === "b144-homechest" && pn.build > PATCHNOTES.LIST[1].build && new Set(PATCHNOTES.LIST.map((x) => x.id)).size === PATCHNOTES.LIST.length, "patch note on top, newer build, unique id");
for (const x of [pn.title, ...pn.items]) OK(I18N_STORY.ex[x], "Polish for: " + x.slice(0, 40));
console.log("stash ok:", n, "checks");
`, c);
