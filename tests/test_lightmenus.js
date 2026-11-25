const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Lighter menus: the bottom bar lights Hero while the Items/Magic menu is open, Social has 4 big tabs + a More row that
// still reaches every old screen, gold knotwork only on prestige windows, one button family, crisis titles wrap, patch note.
const fs = require("fs"), vm = require("vm");
const W = __GAME;
let n = 0;
const ok = (c, m) => { n++; if (!c) { console.error("FAIL " + m); process.exit(1); } };
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String }; vm.createContext(c);
vm.runInContext(fs.readFileSync(W + "menus.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const M = c.MENUS;

// the bottom tab to light
ok(M.activeGroup("map", "items") === "hero", "Items menu open over the map lights Hero (tabs5: Items lives under Hero)");
ok(M.activeGroup("map", "magic") === "hero", "Magic menu open over the map lights Hero");
ok(M.activeGroup("social", "skills") === "hero", "Skills page lights Hero");
ok(M.activeGroup("social", null) === "social" && M.activeGroup("perks", undefined) === "hero", "no menu open: the screen's own tab");
ok(M.activeGroup(undefined, null) === "world", "nothing at all: World");

const UI = fs.readFileSync(W + "ui.js", "utf8");
const soc = UI.slice(UI.indexOf("function panelSocial()"), UI.indexOf("function panelSocial()") + 2400);
const prim = soc.match(/const prim = \[(.*)\];/)[1], more = soc.match(/const more = \[(.*)\];/)[1];
const ids = (s) => [...s.matchAll(/\["(\w+)", `/g)].map((x) => x[1]).concat([...s.matchAll(/\["(\w+)", "/g)].map((x) => x[1]));
ok(ids(prim).sort().join() === "company,friends,party,realm", "four big Social tabs: " + ids(prim));
ok(ids(more).sort().join() === "chat,faction,msgs,trades", "More row: " + ids(more));
ok(UI.includes("No offers waiting for you."), "Trades screen (the last branch) still drawn");
for (const id of ["friends", "msgs", "party", "chat", "faction", "company", "realm"]) ok(UI.includes(`socTab === "${id}"`), "Social screen still drawn: " + id);
ok(/"More"|>More</.test(soc), "the More row is labelled");
ok(/showMessage\(title, text, bad, prestige\)/.test(UI) && /"prestige"/.test(UI), "showMessage can mark a prestige window");
ok(/LONGHOUSE\.mount\(\{[^}]*showMessage/.test(UI), "the longhouse can show the founding window");
ok(/showMessage\(T\("Company founded"\), ok, false, true\)/.test(fs.readFileSync(W + "longhouse.js", "utf8")), "founding a company is a prestige moment");
ok(/showMessage\(T\("Hold status"\), msg, false, true\)/.test(fs.readFileSync(W + "crises.js", "utf8")), "a crisis won is a prestige moment");

const H = fs.readFileSync(W + "index.html", "utf8");
const second = H.slice(H.indexOf("</style>") + 8);
ok(/:root\.has-ui-frame \.modal \.sheet\{border:1px solid[^}]*border-image:none\}/.test(second), "ordinary windows lose the knotwork");
ok(/:root\.has-ui-frame \.modal \.sheet\.prestige\{border:24px solid transparent;border-image:var\(--asset-frame\)/.test(second), "prestige windows keep it");
const css = second.slice(second.indexOf("[lightmenus]"));
ok(/\.btn\{min-height:44px;border-radius:3px;border:1px solid/.test(css) && /\.btn\.pri:not\(\.sm\)\{min-height:52px\}/.test(css), "one button family: 44px secondary, 52px primary, 3px corners");
ok(/\.cr-ch b\{white-space:normal/.test(css), "crisis title wraps");
ok(H.indexOf('<script src="i18n_lightmenus.js">') > 0 && H.indexOf('<script src="i18n_lightmenus.js">') < H.indexOf('<script src="i18n.js">'), "Polish loads before i18n.js");

const PN = fs.readFileSync(W + "patchnotes.js", "utf8");
ok(/id: "b\d+-lightmenus"/.test(PN), "patch note");
const pl = {}; const cx = { I18N_EXTRA: { words: pl, pat: [] } }; vm.createContext(cx);
vm.runInContext(fs.readFileSync(W + "i18n_lightmenus.js", "utf8"), cx);
const note = PN.slice(PN.indexOf("-lightmenus"), PN.indexOf("] }", PN.indexOf("-lightmenus")));
for (const line of [...note.matchAll(/^\s+"(.+)",$/gm)].map((x) => x[1])) ok(cx.I18N_EXTRA.words[line], "Polish for: " + line.slice(0, 50));
ok(cx.I18N_EXTRA.words["Lighter menus"], "Polish title");
console.log(`lightmenus ok · ${n} checks`);
