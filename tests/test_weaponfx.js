// Weapon effects (weaponfx.js): each weapon's swing and hit fit the weapon, play on the contact frame, once per hit,
// at the weapon (pulled onto the target's body); a miss only whiffs. The screen test is weaponfx_ui.py.
// node test_weaponfx.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const ctx = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; return (...a) => { for (const v of a) if (typeof v === "number" && !isFinite(v)) throw new Error("NaN in " + String(k)); return { addColorStop() {}, width: 10 }; }; }, set: (t, k, v) => { t[k] = v; return true; } });
const doc = { addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ width: 0, height: 0, style: {}, dataset: {}, getContext: () => ctx, toDataURL: () => "data:image/png;base64,AA" }) };
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RegExp, document: doc, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 2, performance: { now: () => 0 } };
vm.createContext(c);
const files = fs.readFileSync(W + "index.html", "utf8").match(/<script src="([a-z0-9_]+\.js)">/g).map((s) => s.match(/"(.*)"/)[1]).filter((f) => !["store.js", "p2pnet.js", "ui.js", "sound.js", "map.js", "backup.js", "skillinfo.js"].includes(f));
for (const f of files) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (e) { if (["data.js", "weaponfx.js", "movefx.js", "arrowfx.js", "fightart.js"].includes(f)) throw e; } }   // files that need a real page (window events) are skipped
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { WEAPONFX: X, MOVEFX: M, FIGHTART: F } = c;
ok(X && M && F, "weaponfx.js, movefx.js and fightart.js load");
ok(files.indexOf("weaponfx.js") >= 0 && files.indexOf("weaponfx.js") < files.indexOf("movefx.js") && files.indexOf("weaponfx.js") < files.indexOf("fightart.js"), "weaponfx.js loads before movefx.js and fightart.js");

// ---- 1. every weapon has a kind, and each kind looks like the weapon
for (const wt of F.WEAPONS) ok(X.KIND[wt], `${wt} has a weapon kind`);
const P = (wt) => X.of(wt);
ok(P("sword").slash === "arc" && P("sword").th <= 0.1 && P("greatsword").slash === "arc", "a blade cuts a thin arc");
ok(P("axe").slash === "chop" && P("battleaxe").slash === "chop", "an axe chops");
for (const wt of ["mace", "club", "warhammer"]) ok(!P(wt).slash && P(wt).sparks === 0 && P(wt).dust > 0, `a ${wt} thuds and raises dust, no slash and no sparks`);
ok(P("dagger").slash === "stab" && P("dagger").r < P("sword").r && P("dagger").life < P("sword").life, "a dagger is a quick small stab");
ok(P("spear").slash === "thrust", "a spear thrusts");
for (const wt of ["bow", "crossbow", "staff"]) ok(!P(wt).trail && !P(wt).slash && !P(wt).sparks, `a ${wt} has no swing: its shot is the effect`);
for (const wt of F.WEAPONS) { const p = P(wt); ok(p.r <= 26 && p.sparks <= 5 && p.chips <= 4 && (p.th || 0) <= 0.12, `${wt}: its hit stays small (r ${p.r}, ${p.sparks} sparks)`); }
ok(Object.isFrozen(P("sword")) && P("sword") === P("sword"), "profiles are shared and can't be changed by accident");

// ---- 2. the moves use them: each melee weapon its own trail and hit
const MV = F.MOVES;
ok(MV.axe.trail === "chop" && MV.battleaxe.trail === "chop" && MV.battleaxe.fx === "chop", "axes leave a chop trail and chop");
ok(MV.mace.trail === "blunt" && MV.club.trail === "blunt" && MV.warhammer.trail === "blunt" && MV.warhammer.fx === "slam", "maces, clubs and hammers leave a short heavy blur; a hammer slams");
ok(MV.warhammer.dur === MV.battleaxe.dur && MV.warhammer.hits.join() === MV.battleaxe.hits.join(), "the warhammer keeps the battleaxe's swing timing");
ok(MV.sword.trail === "arc" && MV.greatsword.trail === "wide" && MV.dagger.trail === "stab" && MV.spear.trail === "stab", "blades and points keep their trails");
for (const wt of ["bow", "crossbow", "staff"]) ok(!MV[wt].trail, `${wt}: no swing trail`);

// ---- 3. timing: the trail plays during each hit's own swing, the hit on the contact frame
for (const wt of F.WEAPONS) {
  const m = MV[wt], pl = X.plan(wt, m.hits, false), imp = pl.filter((e) => e.k === "impact"), tr = pl.filter((e) => e.k === "trail");
  ok(imp.length === m.hits.length && imp.every((e, i) => e.u === m.hits[i]), `${wt}: one hit per contact frame`);
  if (P(wt).trail) ok(tr.length === m.hits.length && tr.every((e, i) => e.u < m.hits[i] && e.u >= m.hits[i] - X.PRE - 1e-9 && (!i || e.u > m.hits[i - 1])), `${wt}: the trail starts during each swing, before its contact`);
  const ws = X.windows(m.hits);
  for (let i = 1; i < ws.length; i++) ok(ws[i][0] > ws[i - 1][1] - 1e-9, `${wt}: swing ${i + 1} doesn't overlap swing ${i}`);
  ok(X.swingAt(m.hits, 0) === -1 && X.swingAt(m.hits, 1) === -1, `${wt}: no trail at rest`);
  const miss = X.plan(wt, m.hits, true);
  ok(!miss.some((e) => e.k === "impact") && miss.filter((e) => e.k === "whiff").length === m.hits.length, `${wt}: a miss only whiffs`);
}
ok(X.swingAt(MV.dagger.hits, 0.3) === 0 && X.swingAt(MV.dagger.hits, 0.46) === 1, "a dagger's two stabs each have their own swing");

// ---- 4. where: the tip pulled onto the target's body, flipped for the side it faces
const box = { x: 300, y: 150, w: 26, h: 44 };
ok(X.anchor([310, 150], box, 1).join() === "310,150", "a tip on the body stays where it is");
ok(X.anchor([200, 90], box, 1).join() === "287,128", "a tip short of the body is pulled onto its near edge");
ok(X.anchor(null, box, 1)[0] < box.x && X.anchor(null, box, -1)[0] > box.x, "no tip: the near side of the body, mirrored for a blow from the right");
ok(X.anchor([NaN, 1], box, 1)[0] < box.x, "a broken tip falls back to the body");

// ---- 5. movefx: the stroke plays on the contact frame, once per hit, small; a miss whiffs
const G = { hand: [120, 160], hand2: [108, 165], from: [100, 170], to: [380, 170], ally: [70, 180], gy: 192, tip: [370, 160], at: [370, 162] };
for (const wt of ["sword", "greatsword", "axe", "battleaxe", "mace", "warhammer", "dagger", "spear", "club"]) for (const miss of [false, true]) {
  const S = M.scene({ s: 1.6, W: 520, H: 240, groundY: 192, low: false }), m = MV[wt];
  const b = { who: "me", move: wt, miss, power: false, final: false, st: {} }, line = { a: "attack", me: miss ? "Attack misses" : "Attack: 20" };
  let hi = 0, before = 0, adds = [], threw = null;
  try {
    for (let u = 0; u <= 1.0001; u += 0.02) {
      S.tick(0.02); S.step(0.02, b, line, m, u, G);
      if (hi === 0 && u < m.hits[0]) before = Math.max(before, S.shapes());
      while (hi < m.hits.length && u >= m.hits[hi]) { const n0 = S.shapes(), p0 = S.count(); S.hit(b, hi === m.hits.length - 1); adds.push([S.shapes() - n0, S.count() - p0]); hi++; }
      S.drawGround(ctx); S.drawFront(ctx, u * 1000);
    }
  } catch (e) { threw = e.message; }
  ok(!threw, `${wt}${miss ? " miss" : ""}: plays without errors ${threw || ""}`);
  ok(before === 0, `${wt}${miss ? " miss" : ""}: nothing is drawn at the foe before the blade gets there (${before} shapes)`);
  ok(adds.length === m.hits.length && adds.every(([sh]) => sh >= 1), `${wt}${miss ? " miss" : ""}: every hit plays its stroke on the contact frame (${adds.map((a) => a[0]).join(",")})`);
  if (miss) ok(adds.every(([sh, pc]) => sh <= 1 && pc <= 2), `${wt}: a miss is only a faint pass (${adds.map((a) => a.join("/")).join(" ")})`);
  else ok(adds.every(([sh, pc]) => sh <= 3 && pc <= 16), `${wt}: a hit stays small (${adds.map((a) => a.join("/")).join(" ")})`);
  for (let i = 0; i < 40; i++) S.tick(0.05);
  ok(S.shapes() === 0, `${wt}${miss ? " miss" : ""}: nothing is left playing afterwards`);
}

console.log(fails ? `${fails} of ${n} weapon effect checks FAILED` : `${n}/${n} weapon effect checks passed`);
process.exit(fails ? 1 : 0);
