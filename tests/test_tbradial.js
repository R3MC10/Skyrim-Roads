// The combat wheel and timing ring (tbradial.js): grading the tap, the zone growing with skill and perks, the fight
// scaling your damage by the timing, and an even average (a fair player isn't stronger than Auto). node test_tbradial.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).filter((f) => f !== "tbfight.js").concat(["dragons.js", "tbradial.js", "tbfight.js"]);
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log("FAIL", m); } };
const { G, TB, TBRADIAL: R, PFX } = c;

// ---- grading
{ const z = R.zone(15, 0, 0.5);
  ok(R.grade(z, z.mid).mult === R.PERFECT, "dead centre is perfect");
  ok(R.grade(z, z.mid + z.perfect / 2 + 0.01).mult === R.GOOD, "inside the zone is good");
  ok(R.grade(z, z.mid + z.good / 2 + 0.02).mult === R.POOR, "outside the zone is a miss");
  ok(R.grade(z, null).mult === R.POOR, "no tap is a miss");
  ok(R.grade(z, z.mid + 1).mult === R.PERFECT, "the second turn counts too");
  ok(z.start >= 0.2 && z.start + z.good <= 0.8 + 1e-9, "the zone never sits under the needle's start");
  const lo = R.zone(15, 0, 0.5), hi = R.zone(100, 0, 0.5), pk = R.zone(15, 0.3, 0.5);
  ok(hi.good > lo.good * 1.5 && hi.good <= 0.42, `skill widens the zone ${lo.good.toFixed(3)} → ${hi.good.toFixed(3)}`);
  ok(Math.abs(pk.good - lo.good * 1.3) < 1e-9, "a timing perk widens it 30%");
  for (let i = 0; i < 50; i++) { const zz = R.zone(Math.random() * 100, Math.random() * 0.6); ok(zz.start >= 0.2 && zz.start + zz.good <= 0.8 + 1e-9, "zone in range"); }
  ok(R.timed("attack", "foe") && R.timed("spell:firebolt", "foe") && !R.timed("shout:fus", "foe") && !R.timed("block", "self") && !R.timed("potion:health", "self"), "the ring is for strikes and damage spells");
}
// ---- perks with the timing effect
{ const s = c.make("warrior", 40); s.perks = {}; ok(PFX.num(s, "timing") === 0, "no perk, no bonus");
  s.perks.brute_force = 1; ok(Math.abs(PFX.num(s, "timing") - 0.3) < 1e-9, "Brute Force widens the ring");
  s.perks = { steady_hand: 2 }; ok(Math.abs(PFX.num(s, "timing") - 0.6) < 1e-9, "Steady Hand rank 2: 60%"); }

// ---- the fight scales your blow by the timing
function foe(s) { return G.scaleEnemy({ name: "Bandit", health: 400, damage: 10, tags: ["humanoid"], level: s.level, danger: "medium", gold: [0, 0], text: "" }, s.level); }
function strike(mult, seed) {
  const s = c.make("warrior", 20); s.health = G.maxHealth(s); s.healthTs = G.now();
  const f = new G.Fight(s, foe(s)); f.allies = [];
  const ss = new TB.Session(f, { trySneak: false });
  ss.begin(); let g = 0; while (ss.cur?.id !== "me" && !ss.done && g++ < 50) ss.advance();
  if (!ss.apSet) { ss.ap = ss.st.ap; ss.spAp = ss.st.spellAp; ss.apSet = true; }
  const b = f.ehp; let saved = Math.random; let x = seed; Math.random = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  try { ss.act("attack", null, mult); } finally { Math.random = saved; }
  return { d: b - f.ehp, ss };
}
{ let n = 0, sum = { p: 0, g: 0, m: 0 };
  for (let i = 1; i <= 40; i++) { const p = strike(R.PERFECT, i).d, g = strike(1, i).d, m = strike(R.POOR, i).d; if (g > 0 && p > 0) { n++; sum.p += p; sum.g += g; sum.m += m; } }
  ok(n > 10, "blows landed " + n);
  ok(Math.abs(sum.p / sum.g - R.PERFECT) < 0.08, `perfect does 25% more (${(sum.p / sum.g).toFixed(2)})`);
  ok(Math.abs(sum.m / sum.g - R.POOR) < 0.08, `a miss does 20% less (${(sum.m / sum.g).toFixed(2)})`);
  const r = strike(R.PERFECT, 3); ok(r.ss.ev.some((e) => /perfect timing/.test(e.text)) || r.d === 0, "the log says perfect timing"); }
// ---- fairness: a tapper who lands in the zone about as often as an average player isn't stronger than normal by much
{ let tot = 0; const N = 4000;
  for (let i = 0; i < N; i++) { const z = R.zone(30, 0), tap = z.mid + (Math.random() - 0.5) * 0.36; tot += R.grade(z, tap).mult; }
  const avg = tot / N; ok(avg > 0.9 && avg < 1.08, `an average tapper does about normal damage (${avg.toFixed(3)})`); }
// ---- the wheel markup
{ const html = R.wheel(["<button>a</button>", "<button>b</button>", "<button>c</button>"], "<button>end</button>");
  ok((html.match(/class="tbsl"/g) || []).length === 3 && /tbhub/.test(html), "the wheel has its slices and the hub");
  const s = c.make("warrior", 20), f = new G.Fight(s, foe(s));
  ok(/AP · \d+ SP/.test(R.costLine(f, "power_attack", 5)), "power attack shows its stamina: " + R.costLine(f, "power_attack", 5)); }

console.log(fails ? `failed: ${fails}` : "tbradial: all ok");
process.exit(fails ? 1 : 0);
