const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* HUD tidy (hud2.js): the rect maths behind the message lane, the objective line and the floating button.
   W=/path/to/game/ node test_hud2.js — prints "hud2 ok". */
const fs = require("fs"), vm = require("vm");
const W = __GAME;
const c = { process: { exitCode: 0 }, console, Math, Date, JSON, Object, Array, Set, Map, Number, String };
vm.createContext(c);
for (const f of ["patchnotes.js", "hud2.js"]) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log("FAIL", m); } };
const R = (l, t, w, h) => ({ left: l, top: t, right: l + w, bottom: t + h });

// boxes touching
ok(HUD2.hit(R(0, 0, 10, 10), R(5, 5, 10, 10)), "overlapping boxes hit");
ok(!HUD2.hit(R(0, 0, 10, 10), R(20, 0, 10, 10)), "boxes apart don't");
ok(HUD2.hit(R(0, 0, 10, 10), R(12, 0, 10, 10), 4), "near boxes hit with padding");
ok(!HUD2.hit(null, R(0, 0, 1, 1)), "missing box never hits");

// the objective line
ok(HUD2.objLine(null) === null && HUD2.objLine({}) === null, "no quest, no line");
const o = HUD2.objLine({ title: " Before the Storm ", where: "Whiterun" });
ok(o.title === "Before the Storm" && o.where === "Whiterun", "title and place " + JSON.stringify(o));
ok(HUD2.objLine({ title: "Whiterun", where: "Whiterun" }).where === "", "place not repeated when it is the title");
ok(HUD2.short("a ".repeat(80)).length <= 72 && HUD2.short("a ".repeat(80)).endsWith("…"), "long objective shortened");
ok(HUD2.short("Go to Whiterun.") === "Go to Whiterun.", "short objective kept");

// labels shrink until they fit, but not below the floor
const width = (px) => px * 6;   // a 6-letter word
ok(HUD2.fitSize(width, 60, 10.5, 8) === 10, "shrinks to fit " + HUD2.fitSize(width, 60, 10.5, 8));
ok(HUD2.fitSize(width, 100, 10.5, 8) === 10.5, "fits already: unchanged");
ok(HUD2.fitSize(width, 10, 10.5, 8) === 8, "never below the floor");

// Polish for the new words
ok(HUD2.PL.Favourites === "Ulubione" && HUD2.PL["New objective"] === "Nowy cel", "Polish words");
const note = PATCHNOTES.LIST.find((e) => e.id === "b139-hud2");
ok(note && HUD2.PL[note.title] && note.items.every((t) => HUD2.PL[t]), "the patch note is in Polish too");
ok(new Set(PATCHNOTES.LIST.map((e) => e.id)).size === PATCHNOTES.LIST.length, "patch note ids are unique");
console.log(fails ? fails + " of " + n + " failed" : "hud2 ok (" + n + " checks)");
if (fails) process.exitCode = 1;
`, c);
if (c.process && c.process.exitCode) process.exitCode = 1;
