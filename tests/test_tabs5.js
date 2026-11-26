// tabs5: five bottom tabs (World, Area, Hero, Journal, Social). Old tab ids and deep links still land in the right place,
// World news waits for unlocks.js, the World screen shows one goal, back steps home then to the map, PC keys and layout.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
let n = 0;
const ok = (c, m) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };
const src = (f) => fs.readFileSync(__GAME + f, "utf8");
const load = (extra = {}) => { const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String, ...extra }; vm.createContext(c); vm.runInContext(src("menus.js").replace(/^const (\w+) =/m, "var $1 ="), c); return c.MENUS; };
const M = load();

// 1. the five tabs
ok(M.GROUPS.length === 5, "five tabs");
ok(M.GROUPS.map((g) => g[0]).join() === "world,town,hero,log,social", "ids in bar order");
ok(Object.keys(M.HOTKEYS).sort().join() === "hero,log,social,town,world" && M.HOTKEYS.world === "M" && M.HOTKEYS.hero === "C" && M.HOTKEYS.log === "J", "one letter per tab");
ok(new Set(Object.values(M.HOTKEYS)).size === 5, "no two tabs share a letter");

// 2. old tab ids (bookmarks, deep links, other modules) still land somewhere sensible
const map = { character: ["hero", "hero"], char: ["hero", "hero"], items: ["hero", "@items"], magic: ["hero", "@magic"], skills: ["hero", "stars"],
  map: ["world", "map"], travel: ["world", "map"], area: ["town", "town"], journal: ["log", "log"], quests: ["log", "log"], friends: ["social", "social"],
  locations: ["world", "places"], news: ["world", "world"], achievements: ["log", "ach"], discoveries: ["log", "library"] };
for (const [old, [grp, screen]] of Object.entries(map)) {
  ok(M.groupOf(old) === grp, `old id ${old} → tab ${grp} (got ${M.groupOf(old)})`);
  ok(M.route(old) === screen, `old id ${old} → screen ${screen} (got ${M.route(old)})`);
}
ok(M.pick("pack") === "@items" && M.pick("items") === "@items" && M.pick("magic") === "@magic", "old Items/Magic tab taps open those menus");
ok(M.pick("character") === "hero" && M.pick("map") === "map", "old Character/Map tab taps");
ok(M.route("world") === "world" && M.pick("world") === "map", "World the tab opens the map; world the screen is World news");
ok(M.route(undefined) === "map" && M.route("") === "map", "no id: the map");
for (const s of ["stats", "perks", "diary", "places", "settings", "follower"]) ok(M.route(s) === s, "real screen ids pass through: " + s);

// 3. home of each tab (back goes here first, then to the map)
ok(M.home("perks") === "hero" && M.home("diary") === "log" && M.home("places") === "map" && M.home("world") === "map" && M.home("town") === "town", "tab homes");

// 4. World news waits for unlocks.js
const S = { level: 1 };
ok(M.opened(S, "world") && M.subsOf("world", S).length === 3, "no unlock system: everything shows");
const Mu = load({ UNLOCKS: { tab: (s, sub) => !(sub === "world" && s.level < 11) } });
ok(!Mu.opened(S, "world") && Mu.subsOf("world", S).map((x) => x[0]).join() === "map,places", "level 1: no World news sub-tab");
ok(Mu.opened({ level: 12 }, "world") && Mu.subsOf("world", { level: 12 }).length === 3, "level 12: World news is there");
ok(Mu.opened(null, "world"), "no hero yet: open");
const Mo = load({ UNLOCKS: { open: (s, id) => id !== "worldevents" } });   // an older unlocks.js without tab(): the GATE table
ok(!Mo.opened(S, "world") && Mo.opened(S, "perks"), "falls back to UNLOCKS.open with the GATE ids");
const Mx = load({ UNLOCKS: { tab: () => { throw new Error("boom"); } } });
ok(Mx.opened(S, "world"), "a broken unlock check never hides a tab");

// 5. ui.js wiring
const UI = src("ui.js");
ok(/function toScreen\(id\)/.test(UI) && /MENUS\.route\(id\)/.test(UI), "ui.js routes every id through MENUS.route");
ok(/go\(t\) \{ if \(toScreen\(t\)\) return;/.test(UI), "__ui.go understands old ids");
ok(/if \(toScreen\(o\.tab \|\| "map"\)\) return true;/.test(UI), "__ui.jump understands old ids");
ok(/MENUS\.home\(tab\)/.test(UI) && /if \(tab !== "map"\) \{ tab = "map";/.test(UI), "back: tab home, then the map");
ok(/MENUS\.bar\(tabsEl, tab, S\)/.test(UI), "the bar knows the hero (unlock gating)");
ok(/MP\.card\(R, [^\n]*?, tab === "map" && typeof MENUS !== "undefined" \? 1 : 0\)/.test(UI), "World shows ONE goal (the rest one tap away)");
ok(/data-act="tabgo" data-id="places"><span>Where to\?<\/span>/.test(UI), "World has the big Where to? button");
ok(!/Locations: cleared places/.test(UI), "the old Locations button is gone");
const TABS = UI.slice(UI.indexOf("const TABS = ["), UI.indexOf("];", UI.indexOf("const TABS = [")));
ok((TABS.match(/^\s*\["/gm) || []).length === 5, "fallback bar (no menus.js) has five tabs too");
ok(!/twBtn/.test(src("tabmenu.js").replace('$("#twBtn")?.remove();', "")) && !/twBtn/.test(src("index.html")), "no floating compass button");

// 6. PC
const PC = require(__GAME + "pcmap.js");
ok(PC.modeOf("map") === "home" && PC.modeOf("places") === "side" && PC.modeOf("world") === "side" && PC.modeOf("town") === "side", "PC: Places and World news beside the map");
ok(["hero", "log", "social", "perks", "stats"].every((t) => PC.modeOf(t) === "full"), "PC: Hero, Journal, Social full-screen");
const pc = src("pcmap.js");
for (const [a, k, l, i] of [["world", "M", "World", 1], ["town", "A", "Area", 2], ["hero", "C", "Hero", 3], ["log", "J", "Journal", 4], ["social", "O", "Social", 5]])
  ok(pc.includes(`btn("${a}", "${k}", "${l}", I.${a}, ${i})`), `PC bar: ${l} (${k} · ${i})`);
ok(!/btn\("hub"/.test(pc) && !/"Compass", I\.compass/.test(pc), "PC bar: the compass button is gone (Tab still opens it)");
ok(/m: "world", c: "hero", j: "log", i: "items", k: "skills", p: "magic", l: "places"/.test(pc), "PC keys");
const dk = src("desktop.js");
ok(/\/\^\[1-9\]\$\/\.test\(e\.key\) && !document\.getElementById\("tw"\) \? MENUS\.GROUPS\[\+e\.key - 1\]/.test(dk), "1-5 open the tabs (not while the compass is open)");
ok(/\{ I: "items", P: "magic" \}/.test(dk), "I and P still open Items and Magic");
ok(/title="\$\{label\} \(\$\{HOTKEYS\[id\]\} · \$\{n \+ 1\}\)"/.test(src("menus.js")), "tab tooltip shows its keys");
const html = src("index.html");
ok(/\.tabs\.mn-bar\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)\}/.test(html) && !/repeat\(7,minmax\(0,1fr\)\)\}/.test(html), "bar grid: five columns");
ok(/html\.pcmap\.pc-full #side\{display:grid;grid-template-columns:210px/.test(html), "PC full screens: a list on the left, two columns of cards");
ok(/\.mn-bar \.tab\{min-height:50px/.test(html), "bottom tabs are at least 44px tall");
ok(html.indexOf('<script src="i18n_tabs5.js">') > 0 && html.indexOf('<script src="i18n_tabs5.js">') < html.indexOf('<script src="i18n.js">'), "Polish loads before i18n.js");

// 7. Polish
const ctx = { I18N_EXTRA: { words: {}, pat: [] } }; vm.createContext(ctx); vm.runInContext(src("i18n_tabs5.js"), ctx);
const w = ctx.I18N_EXTRA.words;
for (const s of ["World", "Hero", "Places", "Your goal and how to get there", "Every place you know · search and filters", "Open Hero to choose what grows.", "Five tabs instead of seven"]) ok(w[s], "Polish: " + s);
const pn = src("patchnotes.js"), at = pn.search(/id: "b\d+-tabs5"/), first = at < 0 ? "" : pn.slice(at, pn.indexOf("] },", at));
ok(at >= 0, "tabs5 has a patch note");   // later builds go on top of it
for (const line of [...first.matchAll(/^\s+"(.+)",$/gm)].map((m) => m[1].replace(/\\"/g, '"'))) ok(w[line], "Polish patch note line: " + line.slice(0, 50));
const pt = ctx.I18N_EXTRA.pat.find(([re]) => re.test("Hero (C · 3)"));
ok(pt && pt[1]("Hero (C · 3)".match(pt[0])) === "Bohater (C · 3)", "Polish tooltips with keys");
console.log(`tabs5 ok (${n} checks)`);
