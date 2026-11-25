// Menus open at the top (menutop.js): screen keys, list keys and where the window goes.
const W = process.env.W || require("path").join(__dirname, "../game/");
const M = require(W + "menutop.js");
let n = 0; const ok = (c, m) => { if (!c) { console.error("FAIL " + m); process.exit(1); } n++; };
// one key per screen: a new sub-tab is a new screen
ok(M.panelKey("log", "active", "") !== M.panelKey("log", "misc", ""), "journal sub-tabs differ");
ok(M.panelKey("social", "", "party") !== M.panelKey("social", "", "friends"), "social sub-tabs differ");
ok(M.panelKey("hero", undefined, null) === M.panelKey("hero", "", ""), "missing bits are blank");
ok(M.panelKey("hero") !== M.panelKey("stars"), "tabs differ");
// one key per item/spell list: equipping (sel) keeps the list, a new category/search/sort/tier starts at the top
const sky = { page: "items", cat: "weapons", sort: "name", dir: 1, sel: 3 };
ok(M.listKey(sky) === M.listKey({ ...sky, sel: 9, hov: 4 }), "picking a row keeps the list");
ok(M.listKey(sky) !== M.listKey({ ...sky, cat: "apparel" }), "new category");
ok(M.listKey(sky) !== M.listKey({ ...sky, q: "iron" }), "search");
ok(M.listKey(sky) !== M.listKey({ ...sky, dir: -1 }), "sort direction");
ok(M.listKey(sky) !== M.listKey({ ...sky, page: "magic" }), "page");
ok(M.listKey({ page: "magic", cat: "all" }) !== M.listKey({ page: "magic", cat: "all", tier: "Adept" }), "spell tier");
ok(M.listKey(null) === "", "no menu");
// the window goes to the top of the screen, never above the page
ok(M.target(-400, 1200) === 800, "screen under the map");
ok(M.target(-50, 20) === 0, "never negative");
console.log(`menutop ok (${n} checks)`);
