// The fight screen in three zones (fightzones.js) and one banner at a time (fightpres.js): the pure parts.
// Run: node test_fightzones.js   (W=/path/to/game/ to test another copy)
const path = require("path");
const W0 = process.env.W || path.join(__dirname, "..", "game") + "/";
const Z = require(path.join(W0, "fightzones.js"));
const P = require(path.join(W0, "fightpres.js"));
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log("FAIL", msg); } };

// ---- PC side columns: a sensible width at every screen
for (const W of [1280, 1600, 1920, 2560, 3840]) {
  const s = Z.sides(W);
  ok(s.L >= 250 && s.L <= 340 && s.R >= 280 && s.R <= 380, `sides at ${W}: ${JSON.stringify(s)}`);
  ok(W - s.L - s.R >= W * 0.5, `the battlefield keeps at least half of a ${W} screen`);
}

// ---- how much of the picture the fighters use
const fp = { Hh: 400, hero: { top: 120, y: 320 }, foe: { top: 100, y: 330 }, allies: [{ top: 140, y: 318 }], flyers: [], waiting: [] };
const sp = Z.span(fp);
ok(Math.abs(sp.t - (100 / 400 - 0.07)) < 1e-9 && Math.abs(sp.b - (330 / 400 + 0.04)) < 1e-9, "span: highest head to lowest feet, with room " + JSON.stringify(sp));
const d = Z.span(null);
ok(d.t > 0 && d.b > d.t && d.b <= 1, "span without a scene: a default " + JSON.stringify(d));

// ---- the picture's box keeps every fighter inside the middle zone
for (const mid of [{ t: 160, b: 510, w: 390 }, { t: 150, b: 330, w: 360 }, { t: 110, b: 720, w: 1300 }]) {
  const g = Z.stage(mid, sp);
  const top = g.cy + sp.t * g.ch, bot = g.cy + sp.b * g.ch;
  ok(top >= mid.t - 0.5 && bot <= mid.b + 0.5, `stage ${JSON.stringify(mid)}: the fighters stand in the band (${top.toFixed(0)}..${bot.toFixed(0)})`);
  ok(Math.abs(g.cw / g.ch - 1 / 0.66) < 1e-6, "stage keeps the picture's shape");
  ok(g.cw <= 1.6 * mid.w + 0.5 && Math.abs(g.cx + g.cw / 2 - mid.w / 2) < 0.5, "stage: centred, at most 1.6x the visible width");
}

// ---- one banner at a time
ok(P.decide("turn", null, false) === "show", "nothing up: show");
ok(P.decide("turn", "turn", false) === "show", "the last one is gone: show");
ok(P.decide("phase", "turn", true) === "replace", "a boss phase replaces Your turn");
ok(P.decide("act", "phase", true) === "drop", "a foe's move under a boss phase is dropped");
ok(P.decide("combo", "phase", true) === "wait", "a combo waits for a boss phase");
ok(P.decide("turn", "intro", true) === "wait", "Your turn waits for the boss intro");
ok(P.decide("act", "intro", true) === "drop", "a foe's move during the intro is dropped");
ok(P.decide("end", "combo", true) === "replace", "Victory replaces a combo");
ok(P.decide("round", "turn", true) === "replace", "same weight: the newer one shows");
const cls = (...c) => ({ classList: { contains: (x) => c.includes(x) } });
ok(P.kindOf(cls("tbban", "won")) === "end" && P.kindOf(cls("tbban", "foe", "act")) === "act" && P.kindOf(cls("tbban", "round", "me")) === "turn" && P.kindOf(cls("tbban", "round")) === "round", "kindOf reads tbfight.js banners");
ok(Object.keys(P.PRI).every((k) => P.LIFE[k] > 0), "every kind has a lifetime");

console.log(fails ? `${fails} of ${checks} FAILED` : `ALL OK (${checks})`);
process.exit(fails ? 1 : 0);
