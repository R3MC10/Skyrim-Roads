const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Arriving somewhere opens the Area tab (arrivearea.js): when it switches, when it waits, when it doesn't,
   and that ui.js wires it in. W=/path/to/game/ node test_arrivearea.js — prints "arrivearea ok". */
const fs = require("fs"), vm = require("vm");
const W = __GAME;
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "formulas.js", "engine.js", "overlays.js", "arrivearea.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
var n = 0; const ok = (cnd, m) => { n++; if (!cnd) throw new Error("FAIL " + m); };
const A = ARRIVEAREA;
const base = { place: "Whiterun", known: true, follower: false, tab: "map", menu: false, busy: false, trip: false, dungeon: false };
const W = (o) => A.want({ ...base, ...o });
// 1. who switches
ok(W({}), "arriving in a town from the map opens Area");
ok(W({ tab: "log" }) && W({ tab: "hero" }), "from another tab too (on your own trip)");
ok(W({ busy: true }), "on your own trip a window only delays it (arrive() waits for the screen)");
ok(!W({ known: false, place: "Roaming (12, 40)" }), "a roam spot or pin: stay on the map");
ok(!W({ place: "" }) && !A.want(null), "no place: nothing");
ok(!W({ trip: true }), "already on the road again: nothing");
ok(!W({ dungeon: true }), "inside a dungeon: nothing");
ok(!W({ tab: "town" }), "already on Area: nothing to do");
ok(W({ tab: "town", menu: true }), "Area behind an open item menu: close the menu, show Area");
// 2. party followers: only when idle on the map
ok(W({ follower: true }), "follower idle on the map: switch");
ok(W({ follower: true, tab: "places" }), "follower on the Locations list: switch");
ok(!W({ follower: true, tab: "log" }), "follower reading the Journal: left alone");
ok(!W({ follower: true, busy: true }), "follower with a window open: left alone");
ok(!W({ follower: true, menu: true }), "follower in the item menu: left alone");
// 3. still worth it once the screen clears
const S = { location: "Whiterun", trip: null, dungeon: null };
ok(A.still(S, "Whiterun", 0, 1000), "still standing there");
ok(!A.still({ ...S, trip: { status: "travel" } }, "Whiterun", 0, 1000), "left again: drop it");
ok(!A.still({ ...S, location: "Riverwood" }, "Whiterun", 0, 1000), "somewhere else now: drop it");
ok(!A.still({ ...S, dungeon: { place: "Bleak Falls Barrow" } }, "Whiterun", 0, 1000), "went inside: drop it");
ok(!A.still(S, "Whiterun", 0, A.MAX_WAIT + 1), "waited too long: drop it");
// 4. arrive() without a page: the screen is clear, so it switches right away
let went = 0;
ok(A.arrive({ s: S, place: "Whiterun", known: true, follower: false, tab: "map", menu: false, go: () => went++ }) === "now" && went === 1, "clear screen: switched now");
ok(A.arrive({ s: S, place: "spot", known: false, tab: "map", go: () => went++ }) === "" && went === 1, "a roam spot: no switch");
ok(A.arrive({ s: { ...S, location: "Riverwood" }, place: "Whiterun", known: true, tab: "map", go: () => went++ }) === "now" && went === 1, "moved on before it ran: go() not called");
// 5. real places are on the world map
ok(!!WORLD.places.Whiterun && !!WORLD.places["Bleak Falls Barrow"], "towns and dungeons count as places");
ok(A.gatherHTML(null) === "" && A.gatherHTML({ dungeon: {} }) === "", "no Gathering card in a dungeon");
ok(Object.keys(A.PL).length >= 5, "Polish lines");
`, c);
// 6. wiring in ui.js and index.html
const ui = fs.readFileSync(W + "ui.js", "utf8"), html = fs.readFileSync(W + "index.html", "utf8");
const ok = (cnd, m) => { if (!cnd) throw new Error("FAIL " + m); };
ok(/ARRIVEAREA\.arrive\(\{[^}]*place: out\.arrived/.test(ui), "ui.js calls ARRIVEAREA.arrive on arrival");
ok(/const wasFollow = !!S\.trip\.follow/.test(ui) && ui.indexOf("const wasFollow") < ui.indexOf("const out = G.advance(S, t"), "follow flag read before the trip ends");
ok(/function goArea\(\)/.test(ui) && /ARRIVEAREA\.gatherHTML\(S\)/.test(ui), "goArea and the Gathering card on Area");
ok(html.indexOf('src="overlays.js"') < html.indexOf('src="arrivearea.js"') && html.indexOf('src="arrivearea.js"') > 0, "index.html loads arrivearea.js after overlays.js");
const pn = fs.readFileSync(W + "patchnotes.js", "utf8");
ok(/The Area tab opens when you arrive/.test(pn), "patch note");
console.log("arrivearea ok", c.n);
