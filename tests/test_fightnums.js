// Readable fight numbers (fightnums.js): place() gives every number its own free spot, inside the screen, off the
// foe's plate and the buttons; extra() turns miss / block lines into words; picFootOf() measures a painted foe so
// fightpos.js keeps big foes (giant, dragon) and groups fully on a 360 / 390 px phone.
// Run: node test_fightnums.js   (W=/path/to/game/ to test another copy)
const path = require("path");
const W0 = process.env.W || path.join(__dirname, "..", "game") + "/";
const N = require(path.join(W0, "fightnums.js")), FP = require(path.join(W0, "fightpos.js"));
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log("FAIL", msg); } };
const B = (l, t, r, b) => ({ left: l, top: t, right: r, bottom: b });
const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const inside = (a, b) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;

// ---- a phone: five hits on one foe in a row never land on each other, the plate or the dock, and stay on screen
for (const [vw, vh] of [[360, 780], [390, 844], [1440, 900], [1920, 1080]]) {
  const bounds = B(6, 48, vw - 6, vh * 0.78), plate = B(vw * 0.5, vh * 0.29, vw - 9, vh * 0.35), dock = B(0, vh * 0.79, vw, vh);
  const foe = { x: vw * 0.8, top: vh * 0.36, y: vh * 0.55 }, live = [];
  for (const [w, h] of [[40, 23], [72, 33], [36, 23], [30, 24], [44, 23]]) {
    const g = N.place({ x: foe.x, y: foe.top + (foe.y - foe.top) * 0.42 }, w, h, [plate, dock], live, bounds, 1);
    ok(g && inside(g.box, bounds), `${vw}: a number stays inside the screen ${JSON.stringify(g && g.box)}`);
    ok(g && area(g.box, plate) === 0 && area(g.box, dock) === 0, `${vw}: a number is off the foe's plate and the buttons`);
    ok(g && live.every((q) => area(q, g.core) === 0), `${vw}: numbers don't stack on each other`);
    if (g) live.push(g.core);
  }
}
// right at the screen's edge: pushed back in, never cut off
let g = N.place({ x: 385, y: 300 }, 72, 33, [], [], B(6, 48, 384, 600), 1);
ok(g && g.box.right <= 384 && g.box.left >= 6, "a crit at the right edge is pushed back on screen");
g = N.place({ x: -10, y: 300 }, 44, 23, [], [], B(6, 48, 384, 600), -1);
ok(g && g.box.left >= 6, "a hit on you at the left edge stays on screen");

// ---- miss / block words
const out = N.extra([{ kind: "me", text: "Power attack misses" }, { kind: "foe", text: "Bandit attacks, but you dodge" }, { kind: "foe", text: "Bandit's arrow glances off your shield" },
  { kind: "me", text: "You hit for 12", dmg: 12 }, { kind: "round", text: "Round 2" }], []);
ok(out.length === 3, "three word pops " + JSON.stringify(out));
ok(out[0].at === "foe" && out[0].word === "Miss", "your miss shows on the foe");
ok(out[1].at === "me" && out[1].word === "Dodged", "a dodge shows on you");
ok(out[2].at === "me" && out[2].word === "Blocked", "a block shows on you");
ok(N.label({ n: -121, crit: true }) === "-121!" && N.label({ n: 45 }) === "+45" && N.label({ n: -20, tag: "MP" }) === "-20 MP", "labels");

// ---- painted foes: the real footprint, and fightpos keeps it on a phone
const giantPic = N.picFootOf(1, 99, { x0: 0.028, x1: 0.988, y0: 0.005 }, FP.FOE.giant);
ok(giantPic.back > FP.FOE.giant[0] && giantPic.front > FP.FOE.giant[1], "a giant's picture is wider than its old box " + JSON.stringify(giantPic));
const slim = N.picFootOf(0.4, 66, { x0: 0.3, x1: 0.7, y0: 0.1 }, FP.FOE.bandit);
ok(slim.back === FP.FOE.bandit[0] && slim.front === FP.FOE.bandit[1], "never smaller than the old box");
for (const [vw, cvW, cvL] of [[360, 480, -60], [390, 520, -65]]) {
  const W = 300, Hh = W * 488 / 480, k = cvW / W, l = (0 - cvL) / k, r = (vw - cvL) / k;   // the stage is wider than the phone: only [l, r] shows
  for (const [kind, pic, wait] of [["giant", giantPic, 0], ["dragon", N.picFootOf(1.5, 132, { x0: 0, x1: 1, y0: 0 }, FP.FOE.dragon), 0],
    ["spider", N.picFootOf(1, 66, { x0: 0.006, x1: 0.993, y0: 0.025 }, FP.FOE.spider), 0], ["bandit", null, 2], ["troll", N.picFootOf(1, 89, { x0: 0.05, x1: 0.95, y0: 0.02 }, FP.FOE.troll), 2]]) {
    const L = FP.layout({ W, Hh, l, r, foe: { kind, ...(pic || {}) }, waiting: wait });
    const all = [L.foe, ...L.waiting];
    ok(all.every((f) => f.right * k + cvL <= vw + 0.5 && f.left * k + cvL >= -0.5), `${vw}: the ${kind}${wait ? " group" : ""} is fully on screen (${all.map((f) => [Math.round(f.left * k + cvL), Math.round(f.right * k + cvL)]).join(" ")})`);
    ok(L.hero.x < L.foe.x, `${vw}: you still stand left of the ${kind}`);
  }
}

console.log(fails ? `FAILED ${fails}/${checks}` : `fightnums: all ${checks} ok`);
process.exit(fails ? 1 : 0);
