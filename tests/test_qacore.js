const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Core-loop QA sweep (qa-core): regressions for bugs found by playing the real game.
   1. The phone's back button: the barber/mirror screen, mini-games and the rune table close first, and inside a shop
      back steps to the town's board before the compass (ui.js __ui.back).
   2. The guided first trip and the first-time tips are Polish in Polish mode, and step 3 names the Area tab.
   3. The "set off" and "arrived" toasts have Polish patterns.
   W=/path/to/game/ node test_qacore.js — prints "qacore ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
let n = 0; const ok = (c, m) => { n++; if (!c) throw new Error("FAIL " + m); };
const ui = fs.readFileSync(W + "ui.js", "utf8"), html = fs.readFileSync(W + "index.html", "utf8");

// 1. back button order
const back = ui.slice(ui.indexOf("window.__ui = {"), ui.indexOf("save() { if (S) Store.save(S); }"));
ok(/CHARGEN\.close\(false\)/.test(back), "back closes the barber / mirror");
ok(back.indexOf("backOutOfGame()") > 0 && back.indexOf("backOutOfGame()") < back.indexOf("TABMENU.back"), "back leaves a mini-game before the compass");
ok(back.indexOf('$("#side .au-back")') > 0 && back.indexOf('$("#side .au-back")') < back.indexOf("TABMENU.back"), "back steps from a shop to the town board before the compass");
for (const id of ["fishgame", "huntgame", "minegame", "lockpick", "pickgame", "smithgame", "craftgame", "xgame"]) ok(ui.includes(`"#${id} `), "a way out of #" + id);
// each exit button really exists in its mini-game
const src = (f) => fs.readFileSync(W + f, "utf8");
for (const [f, id] of [["fishing.js", "fhdone"], ["huntgame.js", "hgdone"], ["minegame.js", "mgdone"], ["immerse.js", "lpleave"], ["pickgame.js", "ppleave"], ["smithgame.js", "sgquick"], ["craftgames.js", "cgquick"]])
  ok(src(f).includes(`id="${id}"`), `${f} still has #${id}`);

// 2 + 3. Polish
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String, RegExp, navigator: { languages: ["pl-PL"], language: "pl-PL" },
  localStorage: { getItem: () => JSON.stringify({ lang: "pl" }), setItem() {}, removeItem() {} } };
vm.createContext(c);
ok(html.indexOf('src="i18n_qacore.js"') > 0 && html.indexOf('src="i18n_qacore.js"') < html.indexOf('src="i18n.js"'), "i18n_qacore.js loads before i18n.js");
for (const f of ["i18n_qacore.js", "i18n.js"]) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext("I18N.add(I18N_QACORE.tpl)", c);
const tutStart = ui.indexOf("const TUT = ["), tut = ui.slice(tutStart, ui.indexOf("];", tutStart));
const lts = [...tut.matchAll(/LT\("((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
ok(lts.length >= 8, "tutorial lines go through LT: " + lts.length);
for (const en of lts) ok(c.I18N_QACORE.tpl[en], "Polish for tutorial line: " + en.slice(0, 50));
ok(!/the <b>Town<\/b> tab/.test(tut) && tut.includes("<b>Area</b>"), "step 3 names the Area tab");
ok(vm.runInContext(`I18N.t("Welcome to Skyrim, {name}. Everything happens in real time. Tap <b>Whiterun</b> on the map and press <b>Travel</b>, or press <b>Go</b> next to it in the list below.", { name: "Remi" })`, c).startsWith("Witaj w Skyrim, Remi."), "I18N.t fills the name");
const ob = src("onboard.js"), tipsAt = ob.indexOf("const TIPS = ["), tips = ob.slice(tipsAt, ob.indexOf("];", tipsAt));
for (const m of tips.matchAll(/=> "((?:[^"\\]|\\.)*)"/g)) if (!m[1].includes("\\u")) ok(c.I18N_QACORE.tpl[m[1]], "Polish for tip: " + m[1].slice(0, 50));
ok(/I18N\.t\(tip\.text\)/.test(ob), "onboard tips go through I18N.t");
ok(vm.runInContext(`I18N.tr("You set off for Whiterun. About 3 min.")`, c) === "Wyruszasz do Whiterun. Około 3 min.", "set-off toast in Polish");
ok(vm.runInContext(`I18N.tr("Arrived at Whiterun. Shops are in the Area tab.")`, c) === "Docierasz do: Whiterun. Sklepy są w zakładce Okolica.", "arrived toast in Polish");
ok(vm.runInContext(`I18N.tr("Got it")`, c) === "Rozumiem", "Got it in Polish");
console.log(`qacore ok (${n} checks)`);
