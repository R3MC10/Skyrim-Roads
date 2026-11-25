// The slim foe plate and the fight log's spot (foepanel.js): pick() takes the first free spot, else the one that
// covers the least; it never leaves the screen. Run: node test_foepanel.js   (W=/path/to/game/ to test another copy)
const path = require("path");
const W0 = process.env.W || path.join(__dirname, "..", "game") + "/";
const P = require(path.join(W0, "foepanel.js"));
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log("FAIL", msg); } };
const B = (l, t, r, b) => ({ left: l, top: t, right: r, bottom: b });
const bounds = B(6, 50, 384, 600);

// a person-sized foe at x 290, head at 300: over its head is free
const foe = B(254, 300, 318, 465), hero = B(105, 300, 165, 465);
let b = P.pick([[290 - 90, 300 - 8 - 40], [254 - 8 - 180, 304]], 180, 40, [foe, hero], bounds);
ok(b && b.i === 0 && b.hit === 0 && b.T + 40 <= 300, "a free spot over the head is taken first");

// no room over the head (a tall foe right under the top): it goes beside it
const tall = B(200, 60, 380, 465);
b = P.pick([[290 - 90, 60 - 8 - 40], [200 - 8 - 120, 64], [380 + 8, 64]], 120, 40, [tall, hero], bounds);
ok(b && b.hit === 0 && b.i === 1, "beside the foe when over its head is off the top: " + JSON.stringify(b));

// nothing free: the least covered spot, still inside the screen
b = P.pick([[0, 0], [300, 500]], 100, 60, [B(0, 0, 400, 700)], bounds);
ok(b && b.L >= 6 && b.T >= 50 && b.L + 100 <= 384 && b.T + 60 <= 600, "never off the screen");
ok(P.area(B(0, 0, 10, 10), B(5, 5, 20, 20)) === 25 && P.area(B(0, 0, 10, 10), B(10, 0, 20, 10)) === 0, "overlap area");

// the plate never sits on the hero either
b = P.pick([[100, 320], [260, 240]], 80, 40, [foe, hero], bounds);
ok(b && b.i === 1 && b.hit === 0, "a spot on the hero is skipped");

console.log(fails ? `FAILED ${fails}/${checks}` : `foepanel: all ${checks} ok`);
process.exit(fails ? 1 : 0);
