/* The painted fighters (rigdata.js + rig.js): every part of every set is on disk and registered, the joint points sit
   inside their pictures, the skeleton has sane proportions, the clips are well formed, a blow's contact lands on the
   fight scene's hit frame, and followers only ever fall down (no death clip without a foe). */
const fs = require("fs"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const D = require(path.join(W, "rigdata.js")), R = require(path.join(W, "rig.js"));
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? "ok   " : "FAIL ") + m); };

const manifest = fs.readFileSync(path.join(W, "assets.js"), "utf8");
ok(/rig-<who>-<set>-<part>/.test(manifest), "the painted parts are listed in the assets.js manifest");
const html = fs.readFileSync(path.join(W, "index.html"), "utf8");
const at = (f) => html.indexOf(`<script src="${f}"></script>`);
ok(at("figart.js") > 0 && at("rigdata.js") > at("figart.js") && at("rig.js") > at("rigdata.js"), "index.html loads figart.js, rigdata.js, rig.js in that order");

for (const [set, S] of Object.entries(D.SETS)) {
  for (const part of D.PARTS) {
    const q = S.parts[part], f = path.join(W, D.file(set, part) + ".webp");
    ok(!!q, `${set} ${part}: measured`);
    if (!q) continue;
    let size = null;
    try { const b = fs.readFileSync(f); if (b.toString("ascii", 0, 4) === "RIFF") { const t = b.toString("ascii", 12, 16);
      if (t === "VP8X") size = [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
      else if (t === "VP8L") { const v = b.readUInt32LE(21); size = [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
      else if (t === "VP8 ") size = [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; } } catch { size = null; }
    ok(!!size && Math.abs(size[0] - q.w * D.RES) <= 2 && Math.abs(size[1] - q.h * D.RES) <= 2, `${set} ${part}: file there, ${D.RES}x the measured size (${size} vs ${q.w}x${q.h})`);
    ok(fs.existsSync(f) && fs.statSync(f).size < 400 * 1024, `${set} ${part}: under 400 KB`);
    const inside = (p) => Array.isArray(p) && p[0] >= 0 && p[0] <= q.w && p[1] >= 0 && p[1] <= q.h;
    ok(inside(q.p) && (!q.e || inside(q.e)), `${set} ${part}: joint points inside the picture`);
    if (q.e) ok(Math.hypot(q.e[0] - q.p[0], q.e[1] - q.p[1]) > Math.max(q.w, q.h) * 0.4, `${set} ${part}: the bone runs most of the part's length`);
  }
  const T = S.parts.torso;
  ok(T.s[1] > T.n[1] && T.s[1] < T.p[1] && T.cut > T.s[1] && T.cut <= T.h, `${set}: torso: neck above shoulder above waist, cut below the shoulder`);
  ok(S.parts.pelvis.hip[1] > S.parts.pelvis.p[1], `${set}: pelvis: the hips hang below the waist`);
  ok(S.parts.foot.sole > S.parts.foot.p[1], `${set}: foot: the sole is below the ankle`);
  const G = R.geo(set), m = G.m;
  ok(G.height / S.ppu > 0 && G.height > 45 && G.height < 90, `${set}: figure ${G.height.toFixed(1)} units at its own scale`);
  const leg = (G.thigh + G.shin + G.ankleH) / G.height, arm = (G.upper + G.fore) / G.height;
  ok(leg > 0.38 && leg < 0.62, `${set}: legs ${(leg * 100).toFixed(0)}% of the height`);
  ok(arm > 0.28 && arm < 0.45, `${set}: arms ${(arm * 100).toFixed(0)}% of the height`);
  ok(G.thigh / G.shin > 0.75 && G.thigh / G.shin < 1.5, `${set}: thigh to shin ${(G.thigh / G.shin).toFixed(2)}`);
  ok(-G.hipY / G.height > 0.38 && -G.hipY / G.height < 0.6, `${set}: hips at ${(-G.hipY / G.height * 100).toFixed(0)}% of the height`);
  // the solved bones meet: elbows and knees one bone length from their joints, feet on the ground at rest
  for (const clip of Object.keys(D.CLIPS)) for (const u of [0, 0.3, 0.5, 0.8]) {
    const B = R.solve(G, R.sample(clip, u)), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const good = [B.armN, B.armF].every((A) => Math.abs(d(A.sh, A.el) - G.upper) < 0.05 && Math.abs(d(A.el, A.wr) - G.fore) < 0.05)
      && [B.legN, B.legF].every((L) => Math.abs(d(L.hip, L.knee) - G.thigh) < 0.05 && Math.abs(d(L.knee, L.ankle) - G.shin) < 0.05)
      && [B.legN, B.legF].every((L) => L.knee[0] >= Math.min(L.hip[0], L.ankle[0]) - 0.5 * m);   // knees never bend backwards
    if (!good) ok(false, `${set}: ${clip} at ${u}: the bones hold together`);
  }
  const B0 = R.solve(G, R.sample("idle", 0));
  ok(Math.abs(B0.legN.ankle[1] + G.ankleH) < 0.01 && Math.abs(B0.legF.ankle[1] + G.ankleH) < 0.01, `${set}: standing, both feet on the ground`);
}

// clips
const EASES = ["lin", "io", "in", "out", "back"];
for (const [n, C] of Object.entries(D.CLIPS)) {
  const ks = C.keys;
  ok(ks.length >= 1 && ks[0][0] === 0 && ks.every((k, i) => !i || k[0] > ks[i - 1][0]) && (ks.length === 1 || ks[ks.length - 1][0] === 1), `clip ${n}: keys from 0 to 1 in order`);
  ok(ks.every((k) => EASES.includes(k[2])), `clip ${n}: known eases`);
  if (C.hit != null) ok(C.hit === 0 || ks.some((k) => Math.abs(k[0] - C.hit) < 1e-9), `clip ${n}: its contact (${C.hit}) is a key`);
}
for (const n of ["idle", "ready", "walk", "swing", "power", "swing2h", "block", "bash", "bow", "cast", "hit", "stagger", "down", "getup", "death", "ride", "thrust"]) ok(!!D.CLIPS[n], `clip ${n} is there`);
ok(Object.values(D.MOVE_CLIP).every((c) => D.CLIPS[c]), "every fight move maps to a clip");
// the contact lands on the scene's hit frame
for (const [hitU, clip] of [[0.44, "swing"], [0.5, "swing2h"], [0.52, "swing2h"], [0.42, "bash"], [0.32, "thrust"]]) ok(Math.abs(R.warp(hitU, hitU, D.CLIPS[clip].hit) - D.CLIPS[clip].hit) < 1e-9, `${clip}: the blow lands on the scene's hit frame ${hitU}`);
ok(R.warp(0, 0.44, 0.3) === 0 && Math.abs(R.warp(1, 0.44, 0.3) - 1) < 1e-9, "the time-warp keeps the start and the end");
// the swing reads: wind up behind, cut through in front
const sw = (u) => R.sample("swing", u);
ok(sw(0.3).aim < -2 && sw(0.44).aim > 0.5 && sw(0.44).lean > sw(0.3).lean, "the one-handed swing winds up behind and cuts through, leaning in");
ok(R.sample("power", 0.5).dy > R.sample("swing", 0.44).dy, "a power attack sinks lower than a plain swing");
ok(Math.abs(R.sample("down", 1).rot + Math.PI / 2) < 1e-6 && R.sample("getup", 1).rot === 0, "knocked down lies flat, getting up ends standing");
// a follower going down never plays the death clip
const sp = { wk: "sword", r: "nord", skin: "#e2b894" };
const fall = R.controls({ clip: "down", from: "hit", w: 0.6 }, sp, "sword"), lying = R.controls({ clip: "down", u: 0 }, sp, "sword"), up = R.controls({ clip: "idle", from: "down", w: 0.5 }, sp, "sword");
ok(fall.clip === "down" && lying.clip === "down" && up.clip === "getup", "followers fall, lie and get up (no death)");
ok(R.controls({ move: "sword", mu: 0.44, hitU: 0.44 }, sp, "sword").clip === "swing", "the replay's sword move plays the swing");
ok(R.setOf({ fem: true, heavy: true }) === "nordf-leather" && R.setOf({ heavy: true, ck: "iron" }) === "nordm-iron" && R.setOf({ heavy: true, ck: "ebony" }) === "nordm-steel" && R.setOf({ light: true }) === "nordm-leather" && R.setOf({ bare: true }) === "nordm-leather", "gear picks the painted set");
ok(R.setOf({}, { id: "f-lydia" }) === "nordf-leather", "Lydia wears the women's set");
console.log(fails ? `${fails} FAILED` : "ALL OK");
process.exit(fails ? 1 : 0);
