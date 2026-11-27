// Painted creature rigs: every creature with part data has its painting, sits on the foe rig its fight kind gets, names
// only bones that rig has, keeps its polygons inside the picture, solves to finite matrices for every clip, the rest
// pose is the untouched painting, and drawing falls back (returns false) when there's no canvas.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Float32Array, Float64Array, Int16Array, Uint8Array, Object, Array, Set, Map, WeakMap, Number, String, Error, localStorage: { getItem: () => null } };
vm.createContext(c);
for (const f of ["art.js", "creaturerigdata.js", "creaturerig.js", "foerig.js"]) vm.runInContext(fs.readFileSync(__GAME + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const ok = (v, m) => { if (!v) throw new Error("FAIL " + m); };
const CR = c.CREATURERIG, F = c.FOERIG;
// fight kind + name each painting is used for (same list as creaturerig_ui.py)
const CRE = [["wolf", "wolf", "Lone wolf"], ["sabrecat", "cat", "Sabre cat"], ["skeever", "skeever", "Skeever"], ["bear", "bear", "Black bear"],
  ["mammoth", "mammoth", "Mammoth"], ["horker", "beast", "Horker"], ["troll", "troll", "Troll"], ["frosttroll", "troll", "Frost troll"],
  ["giant", "giant", "Giant"], ["centurion", "centurion", "Dwarven Centurion"], ["frostatronach", "atronach", "Frost Atronach"],
  ["flameatronach", "atronach", "Flame Atronach"], ["stormatronach", "atronach", "Storm Atronach"], ["spider", "spider", "Frostbite spider"],
  ["chaurus", "spider", "Chaurus"], ["dwarvenspider", "dspider", "Dwarven Spider"], ["mudcrab", "crab", "Mudcrab"],
  ["icewraith", "wisp", "Ice Wraith"], ["dragon", "dragon", "Dragon"]];
const listed = new Set(CRE.map((x) => x[0]));
for (const s of Object.keys(CR.DATA)) ok(listed.has(s), "data " + s + " is in the test list");
let mats = 0;
for (const [slug, fk, name] of CRE) {
  const D = CR.DATA[slug]; ok(D, "data for " + slug);
  ok(CR.has("foe-" + slug) && CR.has("foe-" + slug + ".webp"), slug + " has()");
  ok(fs.existsSync(__GAME + "foe-" + slug + ".webp"), slug + " painting exists");
  ok(CR.ART_NEEDS[slug], slug + " listed in ART_NEEDS");
  const r = F.ctl(fk, name), R = r.rig;
  ok(r.kind.body === D.body, slug + " rides body " + D.body + " (got " + r.kind.body + ")");
  ok(D.base in R.idx, slug + " base bone " + D.base);
  for (const b of Object.keys(D.bones)) {
    ok(b in R.idx, slug + " bone " + b + " exists in " + D.body);
    const [u, v, k] = D.bones[b];
    ok(u >= -0.1 && u <= 1.1 && v >= -0.1 && v <= 1.1 && (k === undefined || (k >= 0 && k <= 1.5)), slug + " joint " + b + " in range");
  }
  let front = 0, back = 0;
  for (const [b, z, poly, pad] of D.parts) {
    ok(b in R.idx, slug + " part bone " + b);
    ok(z !== 0 && Number.isFinite(z), slug + " part " + b + " has a layer");
    z > 0 ? front++ : back++;
    ok(poly.length >= 3 && poly.every(([u, v]) => u >= -0.02 && u <= 1.02 && v >= -0.02 && v <= 1.02), slug + " polygon " + b + " inside the picture");
    ok(pad === undefined || (pad >= 0 && pad < 0.1), slug + " pad " + b);
  }
  ok(front + back >= 2, slug + " has moving parts");
  // rest pose = untouched painting (identity for every bone)
  const P = F.pose(R), wU = 66, hU = 66;
  const id = (W) => Math.abs(W[0] - 1) < 1e-6 && Math.abs(W[1]) < 1e-6 && Math.abs(W[2]) < 1e-6 && Math.abs(W[3] - 1) < 1e-6 && Math.abs(W[4]) < 1e-4 && Math.abs(W[5]) < 1e-4;
  const reset = () => { P.fill(0); for (let i = 0; i < P.length; i += 5) P[i + 3] = P[i + 4] = 1; };
  reset();
  const M0 = CR.matrices("foe-" + slug, R, P, wU, hU);
  for (const b of Object.keys(D.bones)) ok(M0[b] && id(M0[b]), slug + " rest pose is the painting (" + b + ")");
  let moved = 0;
  for (const [cn, clip] of Object.entries(R.clips)) for (const u of [0, 0.3, 0.5, 0.7, 1]) {
    reset(); F.sample(R, clip, u, P, 1);
    const M = CR.matrices("foe-" + slug, R, P, wU, hU);
    for (const b of Object.keys(D.bones)) {
      ok(M[b].every(Number.isFinite), slug + " " + cn + "@" + u + " " + b + " finite");
      if (!id(M[b])) moved++;
      mats++;
    }
  }
  ok(moved > 0, slug + " parts move in some clip");
  // no canvas here → draw declines, foerig slices the picture as before
  ok(CR.draw({}, R, P, { picKey: "foe-" + slug, picH: 66 }, { width: 100, height: 100 }) === false, slug + " falls back without a canvas");
}
ok(CR.matrices("foe-nothing", F.ctl("wolf", "wolf").rig, F.pose(F.ctl("wolf", "wolf").rig), 66, 66) === null, "unknown picture → no matrices");
ok(!CR.has("foe-bandit"), "people are not creature-rigged");
console.log("creaturerig OK:", CRE.length, "creatures,", mats, "bone matrices");
