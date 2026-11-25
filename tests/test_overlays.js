const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* One overlay at a time (overlays.js + the fight hints in onboard.js): the ranking, which fight hints show when,
   the slide that keeps a hint off the buttons, and the hooks. W=/path/to/game/ node test_overlays.js — prints "overlays ok". */
const fs = require("fs"), vm = require("vm");
const W = __GAME;
const store = {};
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String, URLSearchParams,
  localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] } };
vm.createContext(c);
for (const f of ["data.js", "world.js", "formulas.js", "engine.js", "overlays.js", "onboard.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
var n = 0; const ok = (cnd, m) => { n++; if (!cnd) throw new Error("FAIL " + m); };
const L = OVERLAYS.LEVEL;
// 1. the ranking: result > decision > tip > toast
ok(L.result > L.decision && L.decision > L.tip && L.tip > L.toast && L.toast > L.none, "levels in order");
ok(OVERLAYS.rank({}) === 0 && OVERLAYS.rank({ toast: true }) === L.toast, "nothing / a toast");
ok(OVERLAYS.rank({ tip: true, result: true, toast: true }) === L.result, "the result wins");
ok(OVERLAYS.rank({ tip: true, decision: true }) === L.decision, "a window beats a tip");
ok(!OVERLAYS.allows("tip", "result") && !OVERLAYS.allows("tip", "decision") && OVERLAYS.allows("tip", "tip") && OVERLAYS.allows("tip", "toast"), "a tip waits under windows and results");
ok(OVERLAYS.allows("result", "decision") && !OVERLAYS.allows("decision", "result") && !OVERLAYS.allows("toast", "tip"), "higher opens over lower, never the other way");
ok(OVERLAYS.level() === 0 && OVERLAYS.sheet() === null, "no page: nothing on screen");
let ran = 0; ok(OVERLAYS.when("decision", () => ran++) && ran === 1, "a clear screen runs it at once");

// 2. fight hints: pinned lines, one control each, gone once used
const H = (seen, f) => ONBOARD.hintsFor(seen, f).join();
ok(H({}, { open: true, mine: true, acts: 0 }) === "order,moves", "your first turn: turn order and moves");
ok(H({}, { open: true, mine: true, acts: 1 }) === "end", "after a move: End turn");
ok(H({}, { open: true, mine: false, acts: 0 }) === "", "not your turn: nothing");
ok(H({}, { open: true, mine: true, acts: 0, result: true }) === "" && H({}, { open: true, mine: true, acts: 0, done: true }) === "", "the result card: every hint closes");
ok(H({}, { open: false, mine: true }) === "", "no fight, no hints");
ok(H({ "tbf-order": 1 }, { open: true, mine: true, acts: 0 }) === "moves", "a used hint stays gone");
ok(H({ "tbf-order": 1, "tbf-moves": 1 }, { open: true, mine: true, acts: 0 }) === "", "both used: a clean first turn");
ok(H({ tbfight: 1 }, { open: true, mine: true, acts: 0 }) === "", "read the old fight tip already: no hints");
ok(ONBOARD.HINTS.every((h) => typeof h[3] === "string" && h[3].length <= 80 && /^(above|below)$/.test(h[2])), "short lines, above or below");
ok(OVERLAYS.PL && ONBOARD.HINTS.every((h) => OVERLAYS.PL[h[3]]), "every hint has Polish");

// 3. a hint slides off what it would cover
const R = (l, t, w, h) => ({ left: l, top: t, right: l + w, bottom: t + h });
ok(ONBOARD.freeY(10, 600, 300, 40, "above", []) === 600, "nothing in the way: stays");
ok(ONBOARD.freeY(10, 600, 300, 40, "above", [R(0, 570, 250, 90)]) === 570 - 8 - 40, "the bars in the way: goes above them");
ok(ONBOARD.freeY(10, 60, 300, 40, "below", [R(0, 55, 250, 40)]) === 95 + 8, "the log in the way: goes below it");
ok(ONBOARD.freeY(10, 600, 300, 40, "above", [R(320, 500, 50, 200)]) === 600, "a box beside it doesn't count");
ok(ONBOARD.freeY(10, 20, 300, 40, "above", [R(0, 0, 400, 100)], 4) === 4, "never off the top");
`, c);

// 4. hooks: script order, CSS in the second style block, hud2 and the letter, patch note
const html = fs.readFileSync(W + "index.html", "utf8");
const ok = (cnd, m) => { if (!cnd) throw new Error("FAIL " + m); };
const at = (f) => html.indexOf(`<script src="${f}"></script>`);
ok(at("overlays.js") > at("i18n.js") && at("overlays.js") < at("onboard.js") && at("onboard.js") < at("ui.js"), "overlays.js loads after i18n.js, before onboard.js");
const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
ok(styles.length >= 2 && /#fhints \.fhint\{/.test(styles[1][1]) && /body\[data-ovl=result\] #obtip/.test(styles[1][1]) && !/fhint/.test(styles[0][1]), "CSS in the second style block");
ok(/OVERLAYS\.sheet\(\)/.test(fs.readFileSync(W + "hud2.js", "utf8")), "hud2.js keeps messages clear of results too");
ok(/OVERLAYS/.test(fs.readFileSync(W + "sideui.js", "utf8")) && /\.menuOpen\(\)/.test(fs.readFileSync(W + "sideui.js", "utf8")), "the courier's letter waits for a clear screen");
ok(/One thing on screen at a time/.test(fs.readFileSync(W + "patchnotes.js", "utf8")), "patch note");
console.log("overlays ok (" + c.n + " checks)");
