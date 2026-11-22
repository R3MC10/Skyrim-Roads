// Pickpocket mini-game: the purse width keeps an average player's odds equal to the old dice roll.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const P = require(__GAME + "pickgame.js");
let bad = 0;
for (const c of [0.05, 0.15, 0.3, 0.5, 0.7, 0.9, 0.95]) {
  const z = P.purseWidth(c), o = P.avgOdds(c);
  const ok = Math.abs(o - c) < 0.02 && z > 0 && z < 0.9;
  if (!ok) bad++;
  console.log(`chance ${c} -> purse ${(z * 100).toFixed(1)}% of the bar, average player wins ${(o * 100).toFixed(1)}% ${ok ? "ok" : "BAD"}`);
}
if (P.purseWidth(0.2) >= P.purseWidth(0.6)) { bad++; console.log("harder marks should have smaller purses BAD"); }
if (P.speed(0.1) <= P.speed(0.9)) { bad++; console.log("nervous marks should sway faster BAD"); }
if (P.wants()) { bad++; console.log("no mini-game outside a browser BAD"); }
if (bad) { console.log("FAILED", bad); process.exit(1); }
console.log("pickgame ok");
