// The fight camera (game/fightcam.js): one move at a time by priority, merging, the cooldown, the framing maths
// (the fighters stay in view, no picture edge ever shows), the parallax layers, the settings and reduced motion.
// Run: node tests/test_fightcam.js   (W=/path/to/game/ to point at another copy)
const path = require("path"), fs = require("fs");
const W0 = process.env.W || path.join(__dirname, "..", "game") + "/";
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log("FAIL", m); } };
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
let RM = false;
global.matchMedia = (q) => ({ matches: /reduce/.test(q) ? RM : false });
const C = require(W0 + "fightcam.js");
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// ---------------------------------------------------------------- settings and reduced motion
ok(C.pref() === "cin" && C.mode() === "cin", "Cinematic by default");
store.rotn_prefs = JSON.stringify({ fsCamMode: "calm" }); ok(C.mode() === "calm", "Calm when chosen");
store.rotn_prefs = JSON.stringify({ fsCamMode: "off" }); ok(C.mode() === "off", "Off when chosen");
store.rotn_prefs = JSON.stringify({ fsCamMode: "nonsense" }); ok(C.mode() === "cin", "an unknown value falls back to Cinematic");
store.rotn_prefs = "{}"; RM = true;
ok(C.mode() === "calm", "reduced motion forces Calm");
store.rotn_prefs = JSON.stringify({ fsCamMode: "off" }); ok(C.mode() === "off", "and Off stays Off");
RM = false; store.rotn_prefs = "{}";
ok(C.modeOf("cin", true) === "calm" && C.modeOf("calm", false) === "calm" && C.modeOf("off", true) === "off", "modeOf");
ok(C.CFG.modes.cin.max === 1.15 && C.CFG.modes.calm.max === 1.05 && C.CFG.modes.off.max === 1, "max zooms 1.15 / 1.05 / fixed");
ok(!C.CFG.modes.calm.tilt && !C.CFG.modes.calm.shake && !C.CFG.modes.calm.slow && C.CFG.modes.cin.tilt && C.CFG.modes.cin.slow, "Calm: no tilt, shake or slow motion");

// ---------------------------------------------------------------- the numbers ChatGPT and the owner agreed on
const M = C.CFG.moments;
ok(M.turn.z === 1.04 && M.turn.ms === 220 && M.heavy.z === 1.08 && M.heavy.ms === 180 && M.crit.z === 1.12 && M.crit.ms === 350, "turn 1.04/220, heavy 1.08/180, crit 1.12/350");
ok(M.brk.z === 1.1 && M.brk.ms === 280 && M.kill.z === 1.05 && M.kill.ms === 250 && M.intro.z0 === 1.15 && M.intro.ms === 1400 && M.victory.z === 1.06 && M.victory.ms === 900, "break, kill, boss intro, victory");
ok(C.CFG.out === 300 && C.CFG.cooldown === 1500 && C.CFG.impact.dz === 0.02 && C.CFG.impact.ms === 100 && M.crit.slow[0] === 0.65, "neutral in 300 ms, 1.5 s cooldown, +0.02 punch, crit slow 0.65");
ok(M.victory.pri > M.intro.pri && M.intro.pri > M.bosskill.pri && M.bosskill.pri > M.crit.pri && M.crit.pri > M.brk.pri && M.brk.pri > M.heavy.pri && M.heavy.pri > M.turn.pri, "priorities: victory > intro > boss kill > crit > break > heavy > turn");

// ---------------------------------------------------------------- one camera
const W = 400, H = 300, BOX = { hero: [100, 150, 140, 240], foe: [260, 140, 320, 240] };
const mk = (mode = "cin", by = null) => { const md = { v: mode }, bz = { v: by }; const c = C.create({ mode: () => md.v, busy: () => bz.v }); c.geo({ W, H, vis: [0, 0, W, H], boxes: BOX }); c.md = md; c.bz = bz; return c; };
const run = (c, ms) => { let zmax = 0, v; for (let t = 0; t < ms; t += 16) { c.tick(16); v = c.view(); zmax = Math.max(zmax, v.z); } return { zmax, v }; };
{ const c = mk(); const v = c.view(); ok(v.z === 1 && v.cx === W / 2 && v.cy === H / 2 && v.rot === 0, "neutral at rest"); }
{ const c = mk(); const r = c.ev("crit", { focus: ["hero", "foe"] }); const { zmax, v } = run(c, 2000);
  ok(r.ok && near(zmax, 1.12, 0.005), `a crit closes in to 1.12 (${zmax.toFixed(3)})`);
  ok(v.z === 1 && !c.active(), "and is back to neutral after"); }
{ const c = mk(); c.ev("crit", { focus: ["foe"] }); let t = 0; for (; t < 2000 && c.active(); t += 16) { c.tick(16); c.view(); }
  ok(t <= 350 + 380 + 300 + 32, `in, hold, back in ${t} ms`); }
// priority: a smaller move while a bigger one plays is dropped (never queued)
{ const c = mk(); c.ev("crit", { focus: ["foe"] }); run(c, 200); const r = c.ev("turn", { focus: ["hero"] });
  ok(!r.ok && c.kind === "crit" && c.log.some((l) => l.kind === "turn" && l.did === "dropped"), "a smaller move is dropped, not queued");
  run(c, 3000); ok(!c.active() && c.log.filter((l) => l.did === "move").length === 1, "nothing played later"); }
{ const c = mk(); c.ev("heavy", { focus: ["hero", "foe"] }); run(c, 200); const r = c.ev("crit", { focus: ["hero", "foe"] });
  ok(r.ok && c.kind === "crit", "a bigger move takes over"); const v0 = c.view(); c.tick(16); const v1 = c.view();
  ok(Math.abs(v1.z - v0.z) < 0.02, "from where the camera is (no jump)"); }
// merging: two moments together become one move
{ const c = mk(); c.ev("crit", { focus: ["hero"] }); c.tick(50); const r = c.ev("bosskill", { focus: ["foe"] });
  ok(r.ok && c.kind === "bosskill" && c.log.some((l) => l.did === "merged"), "moments that arrive together merge into the bigger one");
  ok(c.log.filter((l) => l.did === "move").length === 1, "one move, not two"); }
// cooldown between optional moves
{ const c = mk(); c.ev("turn", { focus: ["hero"] }); run(c, 1300); const r = c.ev("heavy", { focus: ["hero", "foe"] });
  ok(!r.ok && c.log.some((l) => l.did === "cooldown"), "optional moves keep 1.5 s apart");
  run(c, 400); ok(c.ev("heavy", { focus: ["hero", "foe"] }).ok, "and play again after it"); }
{ const c = mk(); c.ev("turn", { focus: ["hero"] }); run(c, 1300); ok(c.ev("crit", { focus: ["foe"] }).ok, "a crit is not optional: no cooldown"); }
// ordinary swings: only a tiny punch
{ const c = mk(); ok(c.bump(), "a plain blow punches in"); const { zmax } = run(c, 300); ok(zmax <= 1.021 && zmax > 1.01 && !c.active(), `by +0.02 for 100 ms (${zmax.toFixed(3)})`); }
{ const c = mk("calm"); ok(!c.bump(), "Calm: no punch on plain blows"); }
// modes
{ const c = mk("calm"); const r = c.ev("crit", { focus: ["foe"], dir: 1 }); const { zmax } = run(c, 900);
  ok(r.ok && zmax <= 1.05 + 1e-9 && zmax > 1.02 && !r.slow, `Calm: gentle (${zmax.toFixed(3)} ≤ 1.05), no slow motion`);
  let rot = 0; const c2 = mk("calm"); c2.ev("bosskill", { focus: ["foe"], dir: 1 }); for (let t = 0; t < 900; t += 16) { c2.tick(16); rot = Math.max(rot, Math.abs(c2.view().rot)); } ok(rot === 0, "Calm: no tilt"); }
{ const c = mk(); c.ev("bosskill", { focus: ["foe"], dir: -1 }); let rot = 0; for (let t = 0; t < 900; t += 16) { c.tick(16); rot = Math.max(rot, Math.abs(c.view().rot)); }
  ok(rot > 0 && rot <= 0.5 * Math.PI / 180 + 1e-9, `Cinematic: at most ±0.5° tilt on big hits (${(rot * 180 / Math.PI).toFixed(2)}°)`); }
{ const c = mk(); let zmax = 0; for (const k of Object.keys(M)) { c.reset(); c.tick(5000); c.ev(k, { focus: ["hero", "foe"] }); zmax = Math.max(zmax, run(c, 1600).zmax); } ok(zmax <= 1.15 + 1e-9, `never past 1.15 (${zmax.toFixed(3)})`); }
{ const c = mk("off"); for (const k of Object.keys(M)) ok(!c.ev(k, { focus: ["foe"] }).ok, "Off: no " + k); ok(!c.bump() && run(c, 500).zmax === 1, "Off: fixed"); }
// the crit's slow motion counts the hit-stop
{ const c = mk(); const r = c.ev("crit", { focus: ["foe"], hitstop: 60 }); ok(r.slow && r.slow[0] === 0.65 && r.slow[1] === 160, "crit slow 0.65 for 220 ms, the 60 ms hit-stop counted"); }
{ const c = mk(); const r = c.ev("crit", { focus: ["foe"], hitstop: 300 }); ok(r.slow[1] === 0, "a long hit-stop leaves no extra slow motion"); }
// boss intro: starts close on the boss and eases out; victory holds
{ const c = mk(); c.ev("intro", { focus: ["foe"] }); c.tick(16); const v0 = c.view(); ok(v0.z > 1.13 && v0.cx > W / 2, `the boss intro starts close on the boss (${v0.z.toFixed(3)})`);
  let mono = true, last = v0.z; for (let t = 0; t < 1500; t += 16) { c.tick(16); const z = c.view().z; if (z > last + 1e-9) mono = false; last = z; } ok(mono && last === 1, "and eases out to neutral, never swinging back"); }
{ const c = mk(); c.ev("victory", { focus: ["hero", "foe"] }); run(c, 5000); ok(near(c.view().z, 1.06, 1e-6) && c.still, "victory pulls in to 1.06 and holds still"); c.reset(); ok(c.view().z === 1, "reset back to neutral"); }
{ const c = mk(); c.ev("victory", {}); run(c, 300); ok(!c.ev("crit", { focus: ["foe"] }).ok, "nothing interrupts the victory"); }
// co-op and minigames: another player's move never pulls your camera while you choose; a minigame keeps it neutral
{ const c = mk("cin", "choose"); ok(!c.ev("crit", { focus: ["foe"], own: false }).ok, "while you choose a move, another player's crit doesn't move your camera");
  ok(c.ev("turn", { focus: ["hero"], own: true }).ok, "your own turn does"); }
{ const c = mk("cin", "game"); ok(!c.ev("crit", { focus: ["foe"] }).ok && !c.bump(), "during a minigame nothing moves");
  ok(c.ev("victory", {}).ok, "except the win"); }
{ const c = mk(); c.ev("crit", { focus: ["foe"] }); run(c, 300); c.bz.v = "game"; run(c, 350); ok(c.view().z === 1, "a minigame that opens mid-move sends the camera back to neutral"); }
{ const c = mk(); c.ev("crit", { focus: ["foe"], own: true }); run(c, 200); ok(!c.ev("bosskill", { focus: ["foe"], own: false }).ok, "another player's bigger move doesn't steal your own move"); }
// never swing back and forth: a chain of moments stays monotonic in its phases (in, hold, out)
{ const c = mk(); let flips = 0, dir = 0, last = 1;
  for (let i = 0; i < 300; i++) { if (i % 7 === 0) c.ev(["crit", "heavy", "brk", "kill"][i % 4], { focus: ["hero", "foe"] }); c.tick(16); const z = c.view().z, d = Math.sign(Math.round((z - last) * 1e4)); if (d && dir && d !== dir) flips++; if (d) dir = d; last = z; }
  ok(flips < 12, `no constant swinging (${flips} turns in 5 s)`); }

// ---------------------------------------------------------------- the framing maths
for (const z of [1, 1.04, 1.08, 1.12, 1.15]) for (const fx of [0, 60, 200, 340, 400]) for (const vis of [[0, 0, W, H], [0, 40, W, 260], [30, 0, 370, H]]) {
  const F = C.frame({ W, H, vis, z, focus: [fx, 150], keep: [100, 140, 320, 240] });
  const V = { ...F, rot: 0 }, m = C.matrix(V, 1);
  // the canvas window, back on the stage: stays inside the picture
  const inv = (qx, qy) => { const det = m[0] * m[3] - m[1] * m[2], x = qx - m[4], y = qy - m[5]; return [(m[3] * x - m[2] * y) / det, (-m[1] * x + m[0] * y) / det]; };
  const a = inv(0, 0), b = inv(W, H);
  ok(a[0] >= -1e-6 && a[1] >= -1e-6 && b[0] <= W + 1e-6 && b[1] <= H + 1e-6, `z ${z} focus ${fx} vis ${vis}: no picture edge (${a.map((q) => q.toFixed(1))} .. ${b.map((q) => q.toFixed(1))})`);
  // the fighters stay inside the part you can see
  const h = C.toScreen(V, 100, 140), f = C.toScreen(V, 320, 240);
  ok(h[0] >= vis[0] - 1e-6 && f[0] <= vis[2] + 1e-6 && h[1] >= vis[1] - 1e-6 && f[1] <= vis[3] + 1e-6, `z ${z} focus ${fx} vis ${vis}: both fighters in view`);
}
{ const F = C.frame({ W, H, z: 1.15, focus: [200, 150], keep: [10, 20, 390, 290] }); ok(F.z < 1.03, "when the fighters wouldn't fit, it zooms out to what fits"); }
{ const F = C.frame({ W, H, z: 1, focus: [0, 0] }); ok(F.cx === W / 2 && F.cy === H / 2, "z = 1 is exactly the neutral shot"); }
// the parallax: sky 0.05, far mountains 0.15, mid 0.45, fighters 1.0, foreground 1.15; a slower layer shows less change
ok(C.pOf(0) === 0.05 && C.pOf(0.3) === 0.05 && near(C.pOf(0.46), 0.15) && near(C.pOf(0.62), 0.45) && near(C.pOf(0.77), 1) && C.pOf(1) === 1 && C.CFG.near === 1.15, "parallax rows");
{ let mono = true; for (let y = 0; y < 1; y += 0.01) if (C.pOf(y + 0.01) < C.pOf(y) - 1e-12) mono = false; ok(mono, "the nearer a row, the more it moves"); }
{ const V = { ...C.frame({ W, H, z: 1.15, focus: [300, 150] }), rot: 0 };
  for (const p of [0.05, 0.15, 0.45]) { const m = C.matrix(V, p), det = m[0] * m[3] - m[1] * m[2], l = (-m[4] * m[3]) / det, r = ((W - m[4]) * m[3]) / det; ok(l >= -1e-6 && r <= W + 1e-6, `layer ${p}: its window stays inside the picture`); } }
ok(C.CFG.overscan === 0.15, "15% overscan mirrored past the edges");
// screen <-> stage round trip (used for the painted blade's tip)
{ const V = { ...C.frame({ W, H, z: 1.12, focus: [280, 160], keep: BOX.foe }), rot: 0.006 }; const k = 2.5, m = C.matrix(V, 1, 3, -2);
  const sx = (m[0] * 210 + m[2] * 170 + m[4]) * k, sy = (m[1] * 210 + m[3] * 170 + m[5]) * k, back = C.toStage(V, k, sx, sy, 3, -2);
  ok(near(back[0], 210, 1e-6) && near(back[1], 170, 1e-6), "screen to stage and back"); }

// ---------------------------------------------------------------- the painter: one draw per row, flat = one piece, through setTransform
{ const calls = []; const g = { setTransform: (...a) => calls.push(["T", ...a]), drawImage: (...a) => calls.push(["D", ...a]), save() {}, restore() {}, translate() {}, scale() {} };
  const im = { width: 1000, height: 500 };
  C.layers(g, 2, C.NEUTRAL(W, H), 0, 0).paint(im, 0, 0, 1000, 500, 0, 0, W, H, { top: true });
  ok(calls.filter((c) => c[0] === "D").length === 1, "at rest the backdrop is one plain draw");
  calls.length = 0;
  const V = { ...C.frame({ W, H, z: 1.12, focus: [300, 150] }), rot: 0.008 };
  C.layers(g, 2, V, 4, -3).paint(im, 0, 0, 1000, 500, 0, 0, W, H, { top: true, bottom: true });
  const T = calls.filter((c) => c[0] === "T"), D = calls.filter((c) => c[0] === "D");
  ok(T.length === C.CFG.slices && D.length >= C.CFG.slices && D.length <= C.CFG.slices * 5, `moving: ${T.length} rows, ${D.length} draws (mirrored edges included)`);
  ok(new Set(T.map((t) => t[1].toFixed(5))).size > 3, "rows move by different amounts"); }

// ---------------------------------------------------------------- the API for other features, and the wiring
ok(typeof C.focus === "function" && typeof C.punch === "function" && typeof C.hold === "function" && C.main && typeof C.banner === "function", "FIGHTCAM.focus / punch / hold / banner");
{ C.main.reset(); C.main.tick(5000); C.main.geo({ W, H, vis: [0, 0, W, H], boxes: BOX });
  ok(C.focus("foe").ok && C.main.kind === "focus", "focus() looks at someone");
  C.main.reset(); C.main.tick(5000); ok(C.punch("crit", { focus: ["foe"] }).ok && C.main.kind === "crit", "punch() plays a moment");
  C.main.reset(); C.hold("minigame", true); ok(!C.punch("crit", { focus: ["foe"] }).ok, "hold() keeps it still"); C.hold("minigame", false);
  C.main.reset(); C.main.tick(5000); const cl = (a) => ({ classList: { contains: (x) => a.includes(x) } });
  ok(C.banner("end", cl(["tbban", "won"])).ok && C.main.kind === "victory", "the Victory banner is the victory move");
  C.main.reset(); ok(C.banner("end", cl(["tbban", "lost"])) === null, "a loss doesn't zoom");
  C.main.reset(); C.main.tick(5000); ok(C.banner("intro", cl([])).ok && C.main.kind === "intro", "a boss intro banner is the intro move");
  C.main.reset(); C.main.tick(5000); ok(C.banner("turn", cl(["tbban", "round", "me"])).ok && C.main.kind === "turn", "Your turn leans in on you"); C.main.reset(); }
const read = (f) => fs.readFileSync(W0 + f, "utf8");
const IDX = read("index.html"), FA = read("fightart.js"), BS = read("battlescene.js"), CFXs = read("combatfx.js"), FSs = read("fightset.js"), FP = read("fightpres.js"), FPOS = read("fightpos.js");
const pos = (s) => IDX.indexOf(`<script src="${s}"></script>`);
ok(pos("fightcam.js") > pos("fightset.js") && pos("fightcam.js") < pos("fightart.js") && pos("fightcam.js") > 0, "fightcam.js loads before fightart.js");
ok(pos("i18n_fightcam.js") > 0 && pos("i18n_fightcam.js") < pos("i18n.js"), "its Polish loads before i18n.js");
ok(!/camFor|CFX\.pan|zoomT|zcx|camF\b|"settle"/.test(FA), "fightart has no second camera left (and never waits for the camera)");
ok(/FIGHTCAM/.test(FA) && /\.lay\b|o\.lay/.test(BS) && !/camOf/.test(BS) && !/camFor|function pan/.test(CFXs), "fightart and the backdrop draw through the camera; the old pan is gone");
ok(/fsCamMode/.test(FSs) && />Fight camera</.test(FSs) && /FIGHTCAM\.banner/.test(FP) && /__cam/.test(FPOS), "the setting, the banners and screenOf are wired");
{ const src = read("i18n_fightcam.js"); const E = new Function(src + "; return I18N_EXTRA;")();
  for (const w of ["Fight camera", "Cinematic", "Calm"]) ok(!!E.words[w], "Polish for " + w);
  const PN = require(W0 + "patchnotes.js"), top = PN.LIST[0];
  ok(top.id === "b337-fightcam" || PN.LIST.some((e) => e.id === "b337-fightcam"), "patch note");
  const mine = PN.LIST.find((e) => e.id === "b337-fightcam"); for (const s of [mine.title, ...mine.items]) ok(!!E.words[s], "Polish for the patch note: " + s.slice(0, 40)); }

console.log(bad ? `fightcam: ${bad} FAILED of ${n}` : `fightcam: all ok · ${n} checks`);
process.exit(bad ? 1 : 0);
