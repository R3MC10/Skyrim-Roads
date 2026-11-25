const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Nothing covers a button (nocover.js): the box maths that picks a free spot for the history button and the banners.
   W=/path/to/game/ node test_nocover.js — prints "nocover ok". The screens themselves: tests/overlap_ui.py. */
const fs = require("fs"), vm = require("vm");
const c = { process: { exitCode: 0 }, console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Infinity };
vm.createContext(c);
vm.runInContext(fs.readFileSync(__GAME + "nocover.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log("FAIL", m); } };
const R = NOCOVER.rect;

ok(NOCOVER.area(R(0, 0, 10, 10), R(5, 5, 10, 10)) === 25, "overlap area");
ok(NOCOVER.area(R(0, 0, 10, 10), R(10, 0, 10, 10)) === 0, "touching edges don't overlap");

// the first free spot wins; with none free, the one touching least
const btn = R(0, 0, 40, 40);
const cands = [R(0, 0, 36, 36), R(0, 44, 36, 36), R(0, 88, 36, 36)];
ok(NOCOVER.pick(cands, [btn]) === cands[1], "steps down past a button");
ok(NOCOVER.pick(cands, []) === cands[0], "home spot when nothing is there");
ok(!!NOCOVER.pick(cands, [R(0, 0, 36, 200)]), "a spot is always returned");
ok(NOCOVER.pick(cands, [R(0, 0, 36, 80), R(0, 88, 4, 4)]) === cands[2], "least overlap when all are blocked");

// the widest free stretch of a row between buttons
const row = R(0, 100, 400, 60);
ok(JSON.stringify(NOCOVER.gap(0, 400, row, [])) === "[0,400]", "an empty row is free end to end");
ok(JSON.stringify(NOCOVER.gap(0, 400, row, [R(340, 90, 40, 300)])) === "[0,340]", "stops at the map buttons on the right");
ok(JSON.stringify(NOCOVER.gap(0, 400, row, [R(0, 100, 50, 40), R(300, 100, 100, 40)])) === "[50,300]", "fits between two buttons");
ok(JSON.stringify(NOCOVER.gap(0, 400, row, [R(0, 0, 400, 50)])) === "[0,400]", "a button above the row doesn't count");
ok(JSON.stringify(NOCOVER.gap(0, 400, row, [R(100, 120, 50, 10), R(120, 120, 100, 10)])) === "[220,400]", "overlapping buttons merge");

console.log(fails ? "nocover FAILED " + fails + "/" + n : "nocover ok (" + n + " checks)");
if (fails) process.exitCode = 1;
`, c);
process.exitCode = c.process.exitCode;
