const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Crafting shortcuts (craftqol.js): "can make now" counts and "Missing:" hints, favourites pinned first,
// and ×5 / Max making things one at a time: the save after a batch is identical to crafting the same number one by one
// (materials, items, skill XP and levels, the repeat-XP log), at the forge, smelter, tanning rack, alchemy lab,
// cooking pot, homestead workbench and when improving gear.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "craftfair.js", "ammo.js", "gather.js", "halls.js", "homestead.js", "mp.js", "craftgames.js", "craftqol.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
let T = 2e6; G.now = () => T;                       // frozen clock: the repeat-XP log must match exactly
const Q = CRAFTQOL;
const fresh = () => { const s = G.newSave("A", "Crafter", "nord"); s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.inv = []; s.gold = 0; s.skills.Smithing.lvl = 15; s.skills.Alchemy.lvl = 15; return s; };
const clone = (s) => JSON.parse(JSON.stringify(s));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const n = (s, i) => SMITH.count(s, i);
/* run bulk on one copy and N plain single crafts on another, compare the whole save */
function compare(label, s, kind, id, single, want = "max") {
  const A = clone(s), B = clone(s);
  const r = Q.bulk(A, kind, id, want);
  for (let i = 0; i < r.made; i++) single(B);
  ok(r.made > 0, label + ": made " + r.made + " · " + r.text);
  ok(same(A, B), label + ": save identical to " + r.made + " single crafts");
  if (!same(A, B)) for (const k of Object.keys(A)) if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) console.log("   differs:", k, JSON.stringify(A[k]).slice(0, 200), "vs", JSON.stringify(B[k]).slice(0, 200));
  return { A, B, r };
}

// ---- forge: can make / missing
let s = fresh();
G.give(s, "mat_iron", 7); G.give(s, "mat_strips", 3);
const dag = SMITH.RECIPES.iron_dagger, per = dag.mats[0][1];
let cn = Q.can(s, "smith", "iron_dagger");
ok(cn.n === Math.min(Math.floor(7 / per), Math.floor(3 / dag.mats[1][1])), "iron dagger: can make " + cn.n);
s.inv = []; G.give(s, "mat_strips", 3);
cn = Q.can(s, "smith", "iron_dagger");
ok(cn.n === 0 && cn.missing[0] === per + " Iron Ingot", "missing hint: " + cn.missing.join(", "));
ok(/Missing: \\d+ Iron Ingot/.test(Q.status(s, "smith", "iron_dagger")), "status line says Missing");
ok(/Steel Smithing/.test(Q.can(s, "smith", "steel_sword").hard || ""), "perk gate is a hard block, not a material hint");

// ---- forge: Max vs singles (with Smithing level-ups along the way, and the repeat-XP penalty)
s = fresh(); s.skills.Smithing.lvl = 15; s.skills.Smithing.xp = F.skillXpNeeded("Smithing", 15) - 30;   // a level-up lands mid-batch
G.give(s, "mat_iron", 40); G.give(s, "mat_strips", 40);
let res = compare("forge Max iron dagger", s, "smith", "iron_dagger", (B) => SMITH.make(B, "iron_dagger"));
ok(res.A.skills.Smithing.lvl > 15, "Smithing went up during the batch (" + res.A.skills.Smithing.lvl + ")");
ok(Q.can(res.A, "smith", "iron_dagger").n === 0, "Max used every material it could");
ok(n(res.A, "iron_dagger") === res.r.made, "one dagger per craft");
compare("forge ×5 iron dagger", s, "smith", "iron_dagger", (B) => SMITH.make(B, "iron_dagger"), 5);
ok(Q.bulk(clone(s), "smith", "iron_dagger", 5).made === 5, "×5 makes exactly five");

// ---- arrows (24 per craft)
s = fresh(); G.give(s, "mat_iron", 3); G.give(s, "mat_firewood", 5);
res = compare("forge Max iron arrows", s, "smith", "arrow_iron", (B) => SMITH.make(B, "arrow_iron"));
ok(res.r.made === 3 && n(res.A, "arrow_iron") === 72 && n(res.A, "mat_firewood") === 2, "3 crafts → 72 arrows, 2 firewood left");

// ---- smelting / tanning (the old "All" button gave one lump of XP; Max is exactly singles)
s = fresh(); s.skills.Smithing.lvl = 15; G.give(s, "ore_iron", 41);
const kIron = SMITH.REFINE.findIndex((r) => r[0] === "mat_iron");
res = compare("smelt Max iron", s, "refine", kIron, (B) => SMITH.refine(B, kIron, false));
ok(res.r.made === 20 && n(res.A, "ore_iron") === 1 && n(res.A, "mat_iron") === 20, "41 ore → 20 ingots, 1 ore left");
const L = clone(s); SMITH.refine(L, kIron, true);
console.log("     (old lump 'All' XP:", L.skills.Smithing.lvl, L.skills.Smithing.xp.toFixed(3), "· one by one:", res.A.skills.Smithing.lvl, res.A.skills.Smithing.xp.toFixed(3) + ")");
s = fresh(); G.give(s, "pelt_bear", 3); G.give(s, "pelt_wolf", 2);
const kBear = SMITH.REFINE.findIndex((r) => r[2][0][0] === "pelt_bear");
compare("tan Max bear pelts", s, "refine", kBear, (B) => SMITH.refine(B, kBear, false));

// ---- cooking
s = fresh(); s.location = "Whiterun";
ok(COOK.canCook(s), "Whiterun inn has a pot");
for (const [it, q] of COOK.RECIPES.veg_soup[1]) G.give(s, it, q * 4);
G.give(s, "food_potato", 1);
ok(Q.can(s, "cook", "veg_soup").n === 4, "veg soup: can make 4");
res = compare("cook Max veg soup", s, "cook", "veg_soup", (B) => COOK.cook(B, "veg_soup"));
ok(n(res.A, "dish_veg_soup") === 4 && n(res.A, "food_potato") === 1, "4 soups, the spare potato is left");
s = fresh(); G.give(s, "fish_salmon", 3); G.give(s, "food_potato", 2); G.give(s, "food_salt", 9);
ok(Q.can(s, "cook", "fish_stew").n === 1 && Q.can(s, "cook", "fish_stew").missing.length === 0, "fish stew: any fish counts (1 from 3 fish, 2 potatoes needs... )");
ok(Q.can(s, "cook", "horker_stew").missing.some((m) => /Horker Meat/.test(m)), "horker stew says what's missing");

// ---- alchemy: a mix you know works, brewed one at a time
s = fresh();
const FX = TOWNS.INGREDIENT_FX;
let pair = null;
outer: for (const a of Object.keys(FX)) for (const b of Object.keys(FX)) if (a < b && FX[a][1][0] === FX[b][1][0]) { pair = [a, b]; break outer; }
G.give(s, pair[0], 6); G.give(s, pair[1], 4);
const mix = Q.mixKey(pair);
ok(/don't know/.test(Q.can(s, "alch", mix).hard || ""), "unknown mix can't be batch-brewed");
TOWNS.known(s, pair[0])[0] = true; TOWNS.known(s, pair[1])[0] = true;
ok(Q.can(s, "alch", mix).n === 4, "known mix: can brew 4 (" + Q.can(s, "alch", mix).name + ")");
res = compare("alchemy Max " + mix, s, "alch", mix, (B) => TOWNS.brew(B, pair.map((i) => B.inv.find((r) => r.item === i).id)));
ok(n(res.A, pair[0]) === 2 && n(res.A, pair[1]) === 0, "ingredients used one each per brew");
ok(Q.alchFilter(s, s.inv).length === 2, "filter keeps ingredients with a known partner");
G.give(s, "ing_wheat", 1);
const wheatKnown = Q.knownShared(s, ["ing_wheat", pair[0]]).length;
ok(Q.alchFilter((Q.setOnly(s, true), s), s.inv).some((r) => r.item === "ing_wheat") === !!wheatKnown, "filter hides an ingredient with no known partner"); Q.setOnly(s, false);

// ---- improving gear
s = fresh(); s.skills.Smithing.lvl = 70; G.give(s, "iron_sword"); G.give(s, "mat_iron", 10);
const sw = s.inv.find((r) => r.item === "iron_sword").id;
const tc = Q.can(s, "temper", sw);
ok(tc.n === Math.min(6, 1 + Math.floor(70 / 20)), "improve: " + tc.n + " steps allowed at Smithing 70");
res = compare("improve Max iron sword", s, "temper", sw, (B) => TOWNS.temper(B, sw));
ok(Q.can(res.A, "temper", sw).hard, "fully improved → hard stop (" + Q.can(res.A, "temper", sw).hard + ")");

// ---- homestead workbench
s = fresh(); s.gold = 99999;
const pid = Object.keys(HOMESTEAD.PLOTS)[0]; s.location = HOMESTEAD.PLOTS[pid].town;
HOMESTEAD.act(s, "deed", pid);
ok(HOMESTEAD.plot(s, pid), "bought a plot in " + s.location);
G.give(s, "mat_iron", 7); G.give(s, "mat_firewood", 3); HOMESTEAD.plot(s, pid).stock.quartz = 5;
ok(Q.can(s, "bench", "nails").n === 7 && Q.can(s, "bench", "glass").n === 2, "bench: 7 nails batches, 2 glass (quartz)");
res = compare("bench Max nails", s, "bench", "nails", (B) => HOMESTEAD.make(B, pid, "nails", 1));
ok(HOMESTEAD.plot(res.A, pid).stock.nails === 140, "140 nails");
compare("bench Max glass", s, "bench", "glass", (B) => HOMESTEAD.make(B, pid, "glass", 1));
const old5 = clone(s); HOMESTEAD.make(old5, pid, "nails", 5); const new5 = clone(s); Q.bulk(new5, "bench", "nails", 5);
console.log("     (old ×5 lump XP:", old5.skills.Smithing.xp.toFixed(3), "· one by one:", new5.skills.Smithing.xp.toFixed(3) + ")");

// ---- stops cleanly when something runs out; nothing made when nothing to make
s = fresh();
ok(Q.bulk(s, "smith", "iron_dagger", "max").made === 0 && /Missing/.test(Q.bulk(s, "smith", "iron_dagger", "max").text), "no materials → nothing made, says what's missing");
s.location = "Helgen"; G.give(s, "mat_iron", 9); G.give(s, "mat_strips", 9);
ok(Q.bulk(s, "smith", "iron_dagger", 5).made === 0, "away from a forge → nothing made");

// ---- favourites and the filter
s = fresh(); G.give(s, "mat_iron", 2); G.give(s, "mat_strips", 2);
const ids = SMITH.byGroup("iron");
ok(Q.toggleFav(s, "smith", ids[ids.length - 1]) && Q.order(s, "smith", ids)[0] === ids[ids.length - 1], "a pinned recipe goes to the top");
ok(!Q.toggleFav(s, "smith", ids[ids.length - 1]) && Q.order(s, "smith", ids)[0] === ids[0], "unpinned goes back");
Q.setOnly(s, true);
const shown = Q.order(s, "smith", ids);
ok(shown.length > 0 && shown.every((id) => Q.can(s, "smith", id).n > 0) && shown.length < ids.length, "Can make now shows only " + shown.length + " of " + ids.length);
ok(/Can make now/.test(Q.bar(s, "smith", ids)) && /aria-pressed="true"/.test(Q.bar(s, "smith", ids)), "filter chip renders on");
ok(Q.order(s, "ench", ["fire", "frost"], { keep: true }).length === 2, "enchant effects are only reordered, never hidden");
ok(/cqn/.test(Q.groupCount(s, "iron")), "group chip shows a count");

console.log(fails ? fails + " FAILED" : "all craft QoL tests passed");
if (fails) throw new Error(fails + " failures");
`, c);
