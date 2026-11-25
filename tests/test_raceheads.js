/* Every race wears its own painted head (rigdata.js HEADS, rig-head-<race><m|f>.webp), in fights and in character
   creation: all nine non-Nord races have a man's and a woman's head on disk at 2x the measured size, with the neck point
   and the cut row inside the picture; chargen asks for every head up front and leaves the stage empty (never a Nord head)
   while the race's own head is still loading; and the painted figure stays below the rotate / Face buttons. */
const fs = require("fs"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const D = require(path.join(W, "rigdata.js")), DATA = require(path.join(W, "data.js"));
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? "ok   " : "FAIL ") + m); };

// webp size without a decoder: VP8X (extended, with alpha) stores width-1 / height-1 as 24-bit numbers
function webpSize(f) {
  const b = fs.readFileSync(f);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === "VP8L") { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
  if (kind === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  return null;
}

const races = Object.keys(DATA.RACES).filter((r) => r !== "nord");
ok(races.length === 9, `nine races besides the Nords (${races.join(" ")})`);
for (const r of races) for (const x of ["m", "f"]) {
  const k = r + x, q = D.HEADS[k], f = path.join(W, D.headFile(k) + ".webp");
  ok(!!q, `${k}: measured in RIGDATA.HEADS`);
  if (!q) continue;
  ok(fs.existsSync(f) && fs.statSync(f).size < 400 * 1024, `${k}: file there, under 400 KB`);
  const s = fs.existsSync(f) && webpSize(f);
  ok(s && Math.abs(s[0] - 2 * q.w) <= 2 && Math.abs(s[1] - 2 * q.h) <= 2, `${k}: picture is 2x the measured size (${s} vs ${q.w}x${q.h})`);
  ok(q.p[0] > 0 && q.p[0] < q.w && q.p[1] > q.h * 0.5 && q.p[1] < q.h, `${k}: neck point inside, low in the picture`);
  ok(q.cut > q.p[1] && q.cut < q.h && q.nw === 110, `${k}: cut row just below the neck point, neck width 110`);
}
ok(/rig-head-<race><m\|f>[\s\S]{0,400}imperial[\s\S]{0,200}orc/.test(fs.readFileSync(path.join(W, "assets.js"), "utf8")), "assets.js lists the new race heads");

// chargen: the race's own head first, the rest of the stage waits for it
const state = {}; let asked = [];
global.ASSETS = { img: (k) => { asked.push(k); return state[k] === "ok" ? {} : null; }, stateOf: (k) => state[k] || "loading" };
global.RIGDATA = D;
let drew = 0;
global.PAINTRIG = { broken: false, can: () => true, draw: () => { drew++; return true; }, geo: () => ({ m: 1, u: 1, P: { head: { p: [0, 0] } } }), setOf: () => "nordm-leather", sample: () => ({}), solve: () => ({ N: [0, -50] }) };
let spec = { r: "redguard", fem: false, bw: 1, bh: 1 };
global.FIGART = { specOf: () => spec, lookFor: (x) => x };
const CG = require(path.join(W, "chargenrig.js"));
const g = { save() {}, restore() {}, setTransform(a, b, c, d, e, f) { g.T = [a, d, e, f]; } };
ok(CG.ok({ r: "redguard" }) && asked.length === Object.keys(D.HEADS).length, "opening chargen asks for every race's head at once");
ok(CG.headState(spec) === "wait", "a head still on its way is 'wait'");
drew = 0;
ok(CG.paint(g, 400, 800, { r: "redguard" }, {}) === true && drew === 0, "while it loads the stage stays empty (no Nord head flash)");
state[D.headFile("redguardm")] = "ok";
ok(CG.headState(spec) === "ok" && CG.paint(g, 400, 800, { r: "redguard" }, {}) && drew === 1, "once loaded the painted figure draws");
spec = { r: "nord", fem: false, bw: 1, bh: 1 };
ok(CG.headState(spec) === "ok", "Nords wear the set's own head");
state[D.headFile("orcf")] = "none"; spec = { r: "orc", fem: true, bw: 1, bh: 1 };
ok(CG.headState(spec) === "none", "a missing file falls back to the Nord head with a tint (none)");

// the head and a raised blade stay below the rotate / Face buttons
spec = { r: "nord", fem: false, bw: 1, bh: 1 };
const H = 800, top = 120;
CG.paint(g, 600, H, { r: "nord" }, { floor: 700, top });
const [, k, , feet] = g.T, headTop = feet - 61 * k * CG.REACH;
ok(headTop >= top - 0.5, `the figure's top (${headTop.toFixed(0)}) stays below the buttons (${top})`);
CG.paint(g, 600, H, { r: "nord" }, { floor: 700 });
ok(g.T[1] > k, "without buttons the figure may be taller");

console.log(fails ? `${fails} FAILED` : "ALL OK");
process.exit(fails ? 1 : 0);
