const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Side-systems QA sweep (qa-side): source checks for bugs found by playing the real game.
   1. Perk descriptions keep their [OURS] / [Skyrim] design tag at the very end: the perk screens only cut a tag off
      the end, so a tag in the middle showed up to players ("... dragons. [OURS] Your timing ring's ...").
   2. The company (longhouse.js) runs one action at a time, so a double tap can't found, pay in or give twice.
   3. App updates wait while any mini-game is on screen (ui.js safeToUpdate).
   W=/path/to/game/ node test_qaside.js — prints "qaside ok". */
const fs = require("fs");
const W = process.env.W || __GAME + "";
let n = 0; const ok = (c, m) => { n++; if (!c) throw new Error("FAIL " + m); };
const src = (f) => fs.readFileSync(W + f, "utf8");

// 1. design tags only at the end of a perk description
for (const f of ["perks.js", "perkfx.js"]) {
  const bad = src(f).match(/"[^"\n]*\[(?:OURS|Skyrim)[^\]\n]*\][^"\n]*[A-Za-z][^"\n]*"/g) || [];
  ok(!bad.length, `${f}: a design tag sits in the middle of a perk description: ${bad[0] || ""}`);
}
// 2. one company action at a time
const lng = src("longhouse.js");
ok(/if \(busy\) return;\s*busy = true;\s*try \{ await act\(/.test(lng), "longhouse.js: actions wait for the one before");
// 3. no update restart while a mini-game is open
const ui = src("ui.js"), safe = ui.slice(ui.indexOf("safeToUpdate"), ui.indexOf("safeToUpdate") + 2500);
for (const cls of [".craftgame", ".lockpick", ".smithgame", ".xgame", ".rct-wrap"]) ok(safe.includes(cls), "safeToUpdate waits for " + cls);
console.log("qaside ok · " + n + " checks");
