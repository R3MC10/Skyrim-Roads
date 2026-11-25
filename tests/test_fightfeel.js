// Fight feel (fightfeel.js): the hit-stop is 40-70 ms and never on a miss or with reduced motion, the wind-up hold keeps
// the blow on its contact frame, the knock-back rises, holds, recovers past the stance and settles; plus where everyone
// stands at 390x844 with a full party (fightpos.js): every head shows, all five foes are on screen.
// Run: node test_fightfeel.js   (W=/path/to/game/ to test another copy)
const path = require("path");
const W = process.env.W || path.join(__dirname, "..", "game") + "/";
const FF = require(W + "fightfeel.js"), FP = require(W + "fightpos.js");
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log("FAIL " + m); } };

// hit-stop
for (const wt of ["dagger", "sword", "mace", "axe", "warhammer", "battleaxe", "greatsword", "fist", "bow", "staff"]) for (const power of [false, true]) for (const crit of [false, true]) for (const final of [false, true]) for (const blocked of [false, true]) {
  const b = { move: wt, wt, power, crit, final, blocked, who: "me" }, t = FF.stopFor(b);
  ok(t >= 0.04 && t <= 0.07, `${wt} p${power} c${crit} f${final} b${blocked}: hit-stop ${t} in 40-70 ms`);
  ok(FF.stopFor({ ...b, miss: true }) === 0, `${wt}: a miss freezes nobody`);
  ok(FF.stopFor(b, { reduce: true }) === 0, `${wt}: reduced motion, no hit-stop`);
  ok(FF.stopFor(b, { multi: true }) <= t, `${wt}: a flurry's hits stop no longer`);
}
for (const mv of ["potion", "self", "wait", "block"]) ok(FF.stopFor({ move: mv }) === 0, `${mv}: no hit-stop`);
ok(FF.stopFor({ move: "dagger", wt: "dagger" }) < FF.stopFor({ move: "sword", wt: "sword" }) && FF.stopFor({ move: "sword", wt: "sword" }) < FF.stopFor({ move: "warhammer", wt: "warhammer" }), "a dagger stops shortest, a warhammer longest");

// wind-up and the pose-time warp, on the real moves' keyframes (a light copy, so node doesn't need the whole scene)
const R = (u) => [u], MOVES = { sword: { hits: [0.44], kf: [R(0), R(0.26), R(0.44), R(0.6), R(1)] }, battleaxe: { hits: [0.52], kf: [R(0), R(0.22), R(0.38), R(0.52), R(1)] }, bow: { hits: [0.72], kf: [R(0), R(0.72)] }, block: { hits: [], kf: [R(0), R(1)] } };
ok(FF.windOf(MOVES.sword) === 0.26 && FF.windOf(MOVES.battleaxe) === 0.38, "the wind-up is the key just before the blow");
ok(FF.windOf(MOVES.bow) === null && FF.windOf(MOVES.block) === null, "no wind-up hold without one");
for (const wt of ["dagger", "sword", "warhammer"]) for (const [wu, hu] of [[0.26, 0.44], [0.38, 0.52], [0.2, 0.32]]) {
  const h = FF.holdOf(wt); let prev = -1, mono = true;
  for (let i = 0; i <= 1000; i++) { const u = i / 1000, w = FF.warp(u, wu, hu, h); if (w < prev - 1e-9 || w < 0 || w > 1) mono = false; prev = w; }
  ok(mono, `${wt} ${wu}/${hu}: the warp never runs backwards`);
  ok(Math.abs(FF.warp(hu, wu, hu, h) - hu) < 1e-9 && FF.warp(0, wu, hu, h) === 0 && FF.warp(1, wu, hu, h) === 1, `${wt}: the blow lands on its frame, start and end untouched`);
  ok(FF.warp(wu + (hu - wu) * h * 0.9, wu, hu, h) === wu, `${wt}: it holds at the top of the wind-up`);
  ok(FF.crouch(wu, wu, hu) > 0.99 && FF.crouch(hu, wu, hu) === 0 && FF.crouch(0, wu, hu) === 0, `${wt}: it draws back into the wind-up, released at the blow`);
}
ok(FF.holdOf("dagger") < FF.holdOf("sword") && FF.holdOf("sword") < FF.holdOf("warhammer"), "a dagger is quick, a warhammer heavy");

// knock-back: rises within 60 ms, holds, recovers past the stance, settles by 0.6 s
for (const pk of [5, 7, 12, 20, 28]) {
  ok(FF.push(0, pk) > 0.5 * pk && Math.abs(FF.push(0.06, pk) - pk) < 1e-9 && FF.push(0.12, pk) === pk, `${pk}: the push lands fast and holds`);
  let minV = 0; for (let t = 0.16; t <= 0.6; t += 0.005) minV = Math.min(minV, FF.push(t, pk));
  ok(minV < -0.05 * pk && minV >= -0.13 * pk, `${pk}: it recovers a touch past its stance (${(minV / pk).toFixed(3)})`);
  ok(FF.push(0.61, pk) === 0 && Math.abs(FF.push(0.599, pk)) < 0.01 * pk, `${pk}: back in stance by 0.6 s`);
  ok(FF.lean(0.1, pk) < 0, `${pk}: the body leans back with the blow`);
}
ok(FF.jitter(0, 1) === 0 && Math.abs(FF.jitter(0.03, 1.234)) <= 0.9, "the shiver only while frozen, and small");
ok(FF.tired(1) === 0 && FF.tired(0.4) === 0 && FF.tired(0.2) > 0.5 && FF.tired(0.05) === 1 && FF.tired(0) === 0, "worn out below 35 % health (a downed fighter is down, not tired)");

// the drawn effects pool
const sc = FF.scene({ s: 2 });
for (const k of ["fire", "frost", "shock", "shield", "dodge", "swoosh"]) ok(sc.add(k, 10, 10, 1, false), `${k}: an effect plays`);
ok(!sc.add("smoke", 0, 0, 1), "an unknown kind is ignored");
for (let i = 0; i < 30; i++) sc.add("fire", i, 0, 1);
sc.tick(0.01); ok(sc.count() <= sc.cap && sc.cap <= 12, `the pool stays at ${sc.cap}`);
sc.tick(1); ok(sc.count() === 0, "effects burn out");
const rm = FF.scene({ s: 2, reduce: true });
ok(!rm.add("dodge", 0, 0, 1) && rm.add("shield", 0, 0, 1) && rm.add("fire", 0, 0, 1), "reduced motion: no streaks, the outcome still shows");

// formation at 390x844 (the phone stage: 520 wide, cropped to the middle), 4 heroes + followers against 5 foes
// (big beasts take more room: on a phone fewer of them stand in view and the rest wait under a "+N more" tag)
for (const st of [{ W: 520, Hh: 343, l: 67, r: 453 }, { W: 900, Hh: 400, l: 0, r: 900 }]) for (const fols of [0, 1, 2, 3]) for (const foe of ["bandit", "draugr", "skeleton", "wolf", "troll"]) {
  const big = foe === "wolf" || foe === "troll";
  const al = []; for (let i = 0; i < 3; i++) al.push({ name: "P" + i, kind: "mate" }); for (let i = 0; i < fols; i++) al.push({ name: "F" + i, kind: "follower" });
  const L = FP.layout({ ...st, allies: al, foe: { kind: foe }, waiting: 4 }), tag = `${st.W}x${st.Hh}/${st.l} ${fols} followers vs ${foe}`;
  ok(L.allies.length === al.length, `${tag}: everyone in your party stands in the fight`);
  ok(big ? L.waiting.length + L.more === 4 && L.waiting.length >= (st.W > 600 ? 2 : 0) : L.waiting.length + 1 === 5, `${tag}: all five foes show (${L.waiting.length + 1}, ${L.more} more)`);
  const v = FP.visible(L), worst = v.reduce((a, x) => (x.head < a.head ? x : a));
  ok(worst.head >= 0.5, `${tag}: every head shows (worst ${worst.who} ${worst.head.toFixed(2)})`);
  for (const a of L.allies) ok(a.left >= st.l - 1 && a.right <= st.r + 1, `${tag}: ${a.name} inside the stage`);
}
console.log(`fightfeel: ${n} checks, ${bad} failed`);
if (bad) process.exit(1);
