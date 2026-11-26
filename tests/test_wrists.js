/* [wrists] the painted rig's wrists: the bend from the forearm to the hand stays inside a natural range (WRIST_FLEX toward
   the palm, WRIST_EXT back) in every clip, with every kind of gear, for every set; it never jumps between frames; an open
   hand (casting, knocked down) lies along its forearm. The figure is drawn onto a stub canvas (no pictures needed). */
const path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const D = require(path.join(W, "rigdata.js"));
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? "ok   " : "FAIL ") + m); };

// a canvas that draws nothing but keeps its transform (PAINTRIG.last reports canvas points through getTransform)
function stubCanvas() {
  const ctx = new Proxy({ getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), globalAlpha: 1 }, {
    get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  return { width: 8, height: 8, getContext: () => ctx, ctx };
}
global.document = { createElement: () => stubCanvas() };
global.ASSETS = { img: () => ({ width: 8, height: 8, naturalWidth: 8, naturalHeight: 8 }) };
global.RIGDATA = D;
const R = require(path.join(W, "rig.js"));
const FLEX = R.WRIST.flex, EXT = R.WRIST.ext, nrm = (d) => Math.atan2(Math.sin(d), Math.cos(d));

// the bend function itself: inside the range, smooth, never flipping at half a turn
let worst = 0, jump = 0, prev = null;
for (let d = -Math.PI; d <= Math.PI + 1e-9; d += 0.002) {
  const b = R.wristBend(d); worst = Math.max(worst, b > 0 ? b - FLEX : -b - EXT);
  if (prev != null) jump = Math.max(jump, Math.abs(b - prev)); prev = b;
}
ok(worst <= 1e-9, `wristBend stays inside +${(FLEX * 57.3).toFixed(0)}° / -${(EXT * 57.3).toFixed(0)}° (over by ${worst.toFixed(4)})`);
ok(jump < 0.01, `wristBend has no jumps (largest step ${jump.toFixed(4)} for a 0.002 step)`);
ok(Math.abs(R.wristBend(0.3) - 0.3) < 1e-9 && Math.abs(R.wristBend(-0.3) + 0.3) < 1e-9, "a small bend is left as it is");
ok(Math.abs(R.wristBend(Math.PI)) < 1e-9 && Math.abs(R.wristBend(-Math.PI)) < 1e-9, "a grip half a turn round leaves the hand along the forearm (no flip)");

// every set, every clip, every kind of gear: the bend drawn stays in range and moves smoothly from frame to frame
const GEARS = [["1h+shield", { wt: "sword", shield: true, shieldOut: true }], ["2h", { wt: "greatsword" }], ["bow", { wt: "bow" }], ["staff", { wt: "staff" }],
  ["dual", { wt: "sword", off: "dagger" }], ["bare", { wt: null }]];
const sets = { "nordm-leather": { r: "nord" }, "nordm-iron": { r: "nord", heavy: true, ck: "iron" }, "nordm-steel": { r: "nord", heavy: true },
  "nordf-leather": { r: "imperial", fem: true }, "nordf-iron": { r: "dunmer", fem: true, heavy: true, ck: "iron", skin: "#8a8f9a" }, "nordf-steel": { r: "khajiit", fem: true, heavy: true, skin: "#c9a27a" } };
let n = 0;
const out = [], pops = [], openBent = [];
for (const [set, base] of Object.entries(sets)) {
  ok(R.setOf(base) === set, `${set}: picked by its gear`);
  for (const clip of Object.keys(D.CLIPS)) for (const [gn, go] of GEARS) {
    let last = null, lastParts = null, lastAsked = null;
    for (let i = 0; i <= 60; i++) {
      const u = i / 60, sp = { ...base, wk: go.wt, skin: base.skin || "#e2b894" }, g = stubCanvas().ctx;
      const drew = R.fight(g, { id: "wr-" + set, r: base.r }, { clip, u, w: 1, wt: go.wt, shield: !!go.shield, shieldOut: !!go.shieldOut, off: go.off || null, who: "wr", t: u }, sp);
      if (!drew) { ok(false, `${set} ${clip} ${gn}: drew`); break; }
      const ws = R.last("wr").wrists; n++;
      const bends = ws.map((w) => nrm(w.a - w.fa));
      ws.forEach((w, k) => {
        const b = bends[k], tag = `${set} ${clip} ${gn} u${u.toFixed(2)} ${k ? "near" : "far"}`;
        if (b > FLEX + 1e-6 || b < -EXT - 1e-6) out.push(`${tag} ${(b * 57.3).toFixed(0)}°`);
        if (w.part === "hand-open" && Math.abs(b) > 1e-6) openBent.push(tag);
      });
      // a pop: the hand turns a lot in one frame although what it holds hardly turned against the forearm (a weapon
      // whipping round in a swing may take the hand with it; the hand alone may not jump)
      const asked = ws.map((w) => (w.want == null ? null : nrm(w.want - w.fa)));
      if (last && last.length === bends.length) bends.forEach((b, k) => {
        if (ws[k].part !== lastParts[k] || Math.abs(b - last[k]) <= 0.45) return;
        const was = lastAsked[k], now = asked[k];
        if (was == null || now == null || Math.abs(nrm(now - was)) < 0.45) pops.push(`${set} ${clip} ${gn} u${u.toFixed(2)} ${k ? "near" : "far"} ${((b - last[k]) * 57.3).toFixed(0)}°`);
      });
      last = bends; lastParts = ws.map((w) => w.part); lastAsked = asked;
    }
  }
}
ok(R.broken === false, "the rig never broke while drawing");
ok(n > 3000, `${n} frames checked`);
ok(out.length === 0, `every wrist bend inside the range (${out.length} outside${out.length ? ": " + out.slice(0, 5).join(", ") : ""})`);
ok(openBent.length === 0, `open hands lie along the forearm (${openBent.length} bent${openBent.length ? ": " + openBent.slice(0, 5).join(", ") : ""})`);
ok(pops.length === 0, `no hand jumps between frames (${pops.length}${pops.length ? ": " + pops.slice(0, 60).join(", ") : ""})`);
console.log(fails ? `${fails} FAILED` : "ALL OK");
process.exit(fails ? 1 : 0);
