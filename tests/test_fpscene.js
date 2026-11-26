const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// FPSCENE (fpscene.js): the road view's scenery director and regions. Checks the director's spacing per tier, the
// cooldowns (no kind twice in a row where a tier has one), seeding (the same route shows the same landmarks and big
// moments; wildlife and travellers change per trip), region weights (each region gets its own kinds, weights hold up
// over a long road), the gap kept around big moments, the land survey (sea → coast, river → valley, forest → pine),
// and that every region's kinds have something to draw in fpworld.js.
const fs = require("fs"), vm = require("vm");
const W = __GAME;
const c = { console, Math, JSON, Object, Array, Set, Map, Number, String };
vm.createContext(c);
vm.runInContext(fs.readFileSync(W + "fpscene.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const S = c.FPSCENE;
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log("FAIL", m); } };

const REG = Object.keys(S.REGIONS);
ok(REG.length >= 7, "at least seven regions: " + REG.join(","));
for (const r of ["tundra", "pine", "mountain", "marsh", "ash", "coast", "valley"]) ok(S.REGIONS[r], "region " + r);
for (const r of REG) {
  const R = S.REGIONS[r];
  for (const k of ["ground", "gd", "road", "far", "mid", "hill", "lip"]) ok(/^#[0-9a-f]{6}$/i.test(R[k]), r + " colour " + k);
  ok(R.lat[0] >= 1.2 && R.lat[1] > R.lat[0], r + " things stay off the road");
  ok(R.belt && R.belt.p > 0 && R.belt.p <= 1 && R.belt.m.length, r + " has its own cover along the road");
  for (const t of ["ambient", "poi", "living", "moment"]) ok(Object.keys(S.WEIGHTS[r][t]).length >= 2, r + " " + t + " has choices");
}

// spacing: slots of one tier never come closer than the tier's shortest gap (seconds × riding speed)
const D = 3000;
for (const r of REG) {
  const p = S.plan("Whiterun>Riverwood", r, 0, D, "trip1");
  for (const t of ["ambient", "poi", "living", "moment"]) {
    const L = p.filter((e) => e.tier === t), min = S.TIERS[t].s[0] * S.V0 - 1e-9, max = S.TIERS[t].s[1] * S.V0;
    for (let i = 1; i < L.length; i++) ok(L[i].d - L[i - 1].d >= min, `${r} ${t} spacing ${(L[i].d - L[i - 1].d).toFixed(2)} >= ${min.toFixed(2)}`);
    const want = D / ((S.TIERS[t].s[0] + S.TIERS[t].s[1]) / 2 * S.V0);
    if (t === "ambient") ok(L.length > want * 0.7 && L.length < want * 1.2, `${r} ambient count ${L.length} near ${want.toFixed(0)}`);
    if (t === "moment") ok(L.length >= 3 && L.length <= Math.ceil(D / (S.TIERS[t].s[0] * S.V0)), `${r} moments ${L.length} in a long road`);
    // quiet stretches: some slots are left empty
    if (t === "ambient") { const all = p.filter((e) => e.tier === t); let gaps = 0; for (let i = 1; i < all.length; i++) if (all[i].d - all[i - 1].d > max + 1e-9) gaps++; ok(gaps > 0, r + " has quiet stretches"); }
  }
  // cooldowns: a tier with a cooldown never repeats a kind within it
  for (const t of ["poi", "living", "moment"]) {
    const L = p.filter((e) => e.tier === t), cool = S.TIERS[t].cool;
    for (let i = 0; i < L.length; i++) for (let j = Math.max(0, i - cool); j < i; j++) if (L[j].kind === L[i].kind && L[i].i - L[j].i <= cool) ok(false, `${r} ${t} ${L[i].kind} repeats within ${cool} slots (${L[j].i}→${L[i].i})`);
  }
  // the gap around big moments
  const M = p.filter((e) => e.tier === "moment");
  for (const e of p) if (S.GAP[e.tier]) ok(!M.some((m) => Math.abs(m.d - e.d) < S.GAP[e.tier]), `${r} ${e.tier} ${e.kind} too close to a moment`);
  // every kind the director picks belongs to that region and tier
  for (const e of p) ok(S.WEIGHTS[r][e.tier][e.kind] > 0, `${r} ${e.tier} picked foreign kind ${e.kind}`);
}

// seeding: landmarks and moments are the route's; living things are the trip's
S._reset && S._reset();
const sig = (L, t) => L.filter((e) => e.tier === t).map((e) => e.kind + "@" + e.d.toFixed(2) + e.side).join(",");
const a1 = S.plan("Whiterun>Riverwood", "tundra", 0, 1500, "t1"), a2 = S.plan("Whiterun>Riverwood", "tundra", 0, 1500, "t2");
S._reset && S._reset();
const a3 = S.plan("Whiterun>Riverwood", "tundra", 0, 1500, "t1");
ok(sig(a1, "poi") === sig(a2, "poi"), "same route, same landmarks on another trip");
ok(sig(a1, "moment") === sig(a2, "moment"), "same route, same big moments on another trip");
ok(sig(a1, "ambient") === sig(a2, "ambient"), "same route, same roadside");
ok(sig(a1, "living") !== sig(a2, "living"), "wildlife and travellers change per trip");
ok(sig(a1, "living") === sig(a3, "living") && sig(a1, "poi") === sig(a3, "poi"), "the same trip draws the same again (rebuilt from scratch)");
const b1 = S.plan("Whiterun>Rorikstead", "tundra", 0, 1500, "t1");
ok(sig(a1, "poi") !== sig(b1, "poi"), "another route has its own landmarks");
// a window in the middle is the same as the whole road cut to it (it can be asked for in any order)
const mid = S.plan("Whiterun>Riverwood", "tundra", 600, 700, "t1"), cut = a1.filter((e) => e.d >= 600 && e.d <= 700);
ok(JSON.stringify(mid.map((e) => e.kind + e.d)) === JSON.stringify(cut.map((e) => e.kind + e.d)), "a stretch of road is the same however you reach it");

// region weights: over a long road the heavy kinds come up more than the light ones
const count = (r, t) => { const m = {}; for (let k = 0; k < 6; k++) for (const e of S.plan("route" + k, r, 0, 6000, "x" + k)) if (e.tier === t) m[e.kind] = (m[e.kind] || 0) + 1; return m; };
const pa = count("pine", "ambient"); ok((pa.pines || 0) > (pa.deadfall || 0) * 3, "a pine forest is mostly pines " + JSON.stringify(pa));
const ta = count("tundra", "living"); ok((ta.mammoths || 0) > 0, "mammoths roam the tundra " + JSON.stringify(ta));
const ca = count("coast", "living"); ok((ca.horker || 0) > 0 && !("mammoths" in ca), "horkers by the sea, no mammoths " + JSON.stringify(ca));
const am = count("ash", "ambient"); ok((am.jagged || 0) > 0 && !("broad" in am), "ash has jagged rocks, no leafy trees " + JSON.stringify(am));
const vm2 = count("valley", "moment"); ok((vm2.bridge || 0) > 0, "valleys have bridges " + JSON.stringify(vm2));

// the land: regionOf and the survey of the map around you
ok(S.regionOf("Pine forest") === "pine" && S.regionOf("Ash wastes") === "ash" && S.regionOf("Sea") === "coast", "ground names map to regions");
ok(S.regionOf("nonsense") === "tundra", "unknown ground → tundra");
ok(S.regionOf("Road", { region: "coast", seaBear: 90 }) === "coast", "the survey beats the road's own ground");
const NAMES = ["Grassland", "Forest", "Pine forest", "Sea", "River", "Lake", "Road", "Snow", "Ash wastes"];
const T = { NAMES, GW: 250, GH: 175, typeAtPos: (pos) => fake(pos), T: { SEA: 3, RIVER: 4, LAKE: 5, ROAD: 6, BRIDGE: 99, BEYOND: 98 } };
let fake;
const sea = NAMES.indexOf("Sea"), grass = NAMES.indexOf("Grassland"), forest = NAMES.indexOf("Pine forest"), river = NAMES.indexOf("River");
fake = ([x, y]) => (x > 0.55 ? sea : grass);
const s1 = S.survey([0.5, 0.5], T); ok(s1 && s1.region === "coast" && Math.abs(((s1.seaBear - 90) % 360 + 360) % 360) < 40, "sea to the east → coast, sea bearing east " + JSON.stringify(s1));
S._reset && S._reset();
fake = ([x, y]) => (Math.abs(y - 0.52) < 0.012 ? river : grass);
const s2 = S.survey([0.3, 0.5], T); ok(s2 && s2.region === "valley", "a river close by → valley " + JSON.stringify(s2));
S._reset && S._reset();
fake = () => forest;
const s3 = S.survey([0.7, 0.3], T); ok(S.regionOf("Road", s3) === "pine", "a road through a forest is a forest road " + JSON.stringify(s3));

// every kind the director can pick is something fpworld.js draws
const src = fs.readFileSync(W + "fpworld.js", "utf8");
const drawn = new Set([...src.matchAll(/\bP\.(\w+) = /g)].map((m) => m[1]));
const amb = new Set([...src.matchAll(/^\s+(\w+): \[\[/gm)].map((m) => m[1]).concat([...src.matchAll(/(\w+): \[\["/g)].map((m) => m[1])));
for (const r of REG) {
  for (const k of Object.keys(S.WEIGHTS[r].ambient)) ok(k === "fence" || amb.has(k), `${r} ambient ${k} has members in fpworld AMB`);
  for (const m of S.REGIONS[r].belt.m) ok(drawn.has(m[0]), `${r} cover ${m[0]} has a drawer`);
}
for (const k of ["landmark", "fallen", "tower", "waterfall", "oldcamp", "bridge", "shipwreck", "giants", "dragon", "deer", "fox", "wolf", "mammoth", "horker", "pilgrim", "guard", "cart", "flock"]) ok(drawn.has(k), "drawer for " + k);

console.log(fails ? `FAILED ${fails}` : "fpscene ok");
process.exit(fails ? 1 : 0);
