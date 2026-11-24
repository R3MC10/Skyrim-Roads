const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Tidier tab menus (menus2.js): one sort row with a direction toggle, category counts, folding Character sections, quest search.
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String }; vm.createContext(c);
const W = __GAME;
vm.runInContext(fs.readFileSync(W + "menus2.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const M = c.MENUS2;
const ok = (x, m) => { if (!x) throw new Error("FAIL " + m); };
const rows = [
  { name: "Iron Sword", value: 25, weight: 9, dmg: 7, arm: null, ratio: 2.8, new: 1, eq: 1 },
  { name: "Amethyst", value: 120, weight: 0.1, dmg: null, arm: null, ratio: 1200, new: 3, eq: 0 },
  { name: "Steel Greatsword", value: 90, weight: 20, dmg: 17, arm: null, ratio: 4.5, new: 2, eq: 0 },
  { name: "Hide Boots", value: 10, weight: 1, dmg: null, arm: 5, ratio: 10, new: 4, eq: 0 },
];
const names = (r) => r.map((x) => x.name).join();
// equipped stays on top, rest sorted
ok(names(M.sortItems(rows, "name", 1)) === "Iron Sword,Amethyst,Hide Boots,Steel Greatsword", "name A-Z " + names(M.sortItems(rows, "name", 1)));
ok(names(M.sortItems(rows, "name", -1)) === "Iron Sword,Steel Greatsword,Hide Boots,Amethyst", "name Z-A");
ok(names(M.sortItems(rows, "value", 1)) === "Iron Sword,Amethyst,Steel Greatsword,Hide Boots", "value high first");
ok(names(M.sortItems(rows, "value", -1)) === "Iron Sword,Hide Boots,Steel Greatsword,Amethyst", "value low first");
// rows with no damage go last in both directions
ok(names(M.sortItems(rows, "dmg", 1)).startsWith("Iron Sword,Steel Greatsword"), "damage high first");
ok(names(M.sortItems(rows, "dmg", -1)).endsWith("Amethyst,Hide Boots"), "no-damage rows last when flipped too");
ok(M.sortItems(rows, "arm", 1)[1].name === "Hide Boots", "armour sort");
ok(rows[0].name === "Iron Sword" && rows[1].name === "Amethyst", "sorting does not touch the original list");
// which sorts each category offers
const ks = (cat) => M.itemSorts(cat).map((x) => x[0]).join();
ok(ks("all") === "name,value,weight,dmg,arm,ratio,new", "all sorts " + ks("all"));
ok(!ks("weapons").includes("arm") && ks("weapons").includes("dmg"), "weapons: damage, no armour");
ok(!ks("apparel").includes("dmg") && ks("apparel").includes("arm"), "apparel: armour, no damage");
ok(!ks("potions").includes("dmg") && !ks("potions").includes("arm"), "potions: neither");
// magic: cost is cheapest first by default
const sp = [{ name: "Fury", cost: 64, school: "illusion" }, { name: "Candlelight", cost: 21, school: "alteration" }, { name: "Firebolt", cost: 39, school: "destruction" }];
ok(names(M.sortMagic(sp, "cost", 1)) === "Candlelight,Firebolt,Fury", "cost cheapest first");
ok(names(M.sortMagic(sp, "cost", -1)) === "Fury,Firebolt,Candlelight", "cost flipped");
ok(names(M.sortMagic(sp, "school", 1)) === "Candlelight,Firebolt,Fury", "school A-Z");
ok(M.dirLabel("name", 1) === "A–Z" && M.dirLabel("name", -1) === "Z–A" && M.dirLabel("value", 1) === "High first" && M.dirLabel("cost", 1) === "Low first", "direction labels");
// the sort row
const bar = M.itemSortBar({ cat: "weapons", sort: "arm", dir: 1 });
ok(/data-act="skysort" data-id="name" aria-pressed="true"/.test(bar), "unknown sort for this category falls back to Name");
ok(bar.includes('data-act="m2dir"') && (bar.match(/data-act="skysort"/g) || []).length === 6, "weapons row has 6 sorts + direction");
ok(M.magicSortBar({ msort: "cost", mdir: 1 }).includes('data-act="m2mdir"'), "magic row direction");
// counts
const ITEMS = { a: { t: "weapon" }, b: { t: "weapon" }, p: { t: "potion" } };
const n = M.counts([{ item: "a" }, { item: "b" }, { item: "p" }, { item: "gone" }], ITEMS, (it) => it.t === "weapon" ? "weapons" : "potions");
ok(n.all === 3 && n.weapons === 2 && n.potions === 1, "category counts " + JSON.stringify(n));
ok(M.badge(0) === "" && M.badge(150).includes("99+"), "badges");
// folds
ok(M.fold("progress", "Progress", "x").includes(" open>") && !M.fold("perks", "Perks", "x").includes(" open>"), "progress open, perks folded by default");
ok(M.fold("skills", "Skills", "<p>b</p>", "n").includes('data-m2f="skills"'), "fold id");
// quest search
ok(M.matches("The Companions Proving Honor", "proving") && M.matches("x", "") && !M.matches("Bleak Falls", "college"), "quest search matches");
console.log("test_menus2: all ok");
