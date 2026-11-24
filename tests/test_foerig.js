// Foe rigs: every foe kind gets a skeleton with all the clips, poses solve to finite numbers, and every rig draws
// every clip (on a stand-in canvas) without throwing, with and without a painted picture.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Float32Array, Float64Array, Int16Array, Uint8Array, Object, Array, Set, Map, WeakMap, Number, String, Error, localStorage: { getItem: () => null } };
vm.createContext(c);
for (const f of ["art.js", "foerig.js"]) vm.runInContext(fs.readFileSync(__GAME + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let calls = 0;
const grad = { addColorStop() {} };
const g = new Proxy({}, {
  get: (o, k) => (k in o ? o[k] : k === "createRadialGradient" || k === "createLinearGradient" ? () => grad : (...a) => { calls++; for (const v of a) if (typeof v === "number" && !Number.isFinite(v)) throw new Error("FAIL non-finite canvas arg in " + String(k)); }),
  set: (o, k, v) => { o[k] = v; return true; },
});
const ok = (v, m) => { if (!v) throw new Error("FAIL " + m); };
const kinds = ["player", "dragon", "lich", "troll", "mammoth", "giant", "dspider", "spider", "bear", "cat", "wolves", "wolf", "skeever", "crab", "draugr", "skeleton", "vampire", "hagraven", "mage", "forsworn", "centurion", "sphere", "falmer", "wisp", "atronach", "bandit",
  "sol_hopper", "sol_netch", "sol_riekling", "sol_lurker", "sol_spawn", "sol_spriggan", "sol_seeker", "sol_miraak", "sol_cultist"];
const named = [["wisp", "Ice Wraith"], ["spider", "Chaurus"], ["crab", "Horker"], ["bandit", "Dremora Lord"], ["mage", "Thalmor Justiciar"], ["mage", "Necromancer"], ["wisp", "Spriggan"], ["atronach", "Frost Atronach"], ["atronach", "Storm Atronach"], ["atronach", "Flame Atronach"], ["troll", "Frost Troll"]];
const moves = ["axe", "sword", "dagger", "battleaxe", "bow", "staff", "bite", "claw", "stomp", "slam", "breath", "cast", "shout", "drain"];
const pic = { naturalWidth: 768, naturalHeight: 768, width: 768, height: 768 };
const bodies = new Set();
for (const [fk, nm] of [...kinds.map((k) => [k, k]), ...named]) {
  const r = c.FOERIG.ctl(fk, nm);
  bodies.add(r.kind.body);
  for (const cl of c.FOERIG.CLIPS) ok(r.rig.clips[cl], fk + "/" + nm + " has clip " + cl);
  for (const mv of moves) { const a = r.clipFor(mv); ok(r.rig.clips[a], fk + " clip for " + mv + " -> " + a); }
  const P = c.FOERIG.pose(r.rig), M = new Float32Array(r.rig.n * 6);
  for (const [cn, clip] of Object.entries(r.rig.clips)) for (const u of [0, 0.25, 0.5, 0.75, 1]) {
    P.fill(0); for (let i = 0; i < P.length; i += 5) P[i + 3] = P[i + 4] = 1;
    c.FOERIG.sample(r.rig, clip, u, P, 1); c.FOERIG.solve(r.rig, P, M);
    ok(M.every(Number.isFinite), fk + " " + cn + " solves finite");
  }
  const kit = { weapon() {}, foeFig() {}, gearTorso() {} };
  const clipsToDraw = ["idle", r.clipFor("sword"), "hit", "stagger", "block", "death", "taunt", "cast", "para", "cower"];
  for (const withPic of [false, true]) for (const cl of clipsToDraw) for (const u of [0.1, 0.5, 0.9])
    r.draw(g, { t: u * 3, clip: cl === "idle" ? null : cl, u, hitU: 0.5, kit, pose: { aim: -0.5, back: 0, lean: 0, wt: "sword" }, pic: withPic ? pic : null, picH: 66, dragon: fk === "dragon" ? { air: u > 0.5 } : null });
  r.event("hit"); r.update(0.1); r.draw(g, { t: 10, kit }); ok(r.state === "hit", fk + " hit event plays (" + r.state + ")");
  r.update(1); r.draw(g, { t: 10.1, kit }); ok(r.state === "idle", fk + " back to idle after hit (" + r.state + ")");
}
for (const b of c.FOERIG.BODIES) ok(bodies.has(b), "body used " + b);
ok(c.FOERIG.kindOf("wisp", "Ice Wraith").body === "wraith" && c.FOERIG.kindOf("spider", "Chaurus Reaper").skin === "chaurus" && c.FOERIG.kindOf("atronach", "Frost Atronach").skin === "golem", "names pick bodies");
// the shared hero renderer (heroart.js), when there: draws bandits and other players, posed by the rig
let heroCalls = [];
c.HEROART = { fightFigure: (gg, card, o) => { heroCalls.push([card, o]); for (const v of Object.values(o)) if (typeof v === "number" && !Number.isFinite(v)) throw new Error("FAIL non-finite hero pose"); } };
const hb = c.FOERIG.ctl("bandit", "Bandit outlaw"), hp = c.FOERIG.ctl("player", "Rival", { foeLook: { r: "nord", eq: {} } }), hd = c.FOERIG.ctl("draugr", "Draugr");
for (const r of [hb, hp, hd]) for (const cl of [null, "swing", "death", "taunt"]) r.draw(g, { t: 1, clip: cl, u: 0.5, kit: {}, pose: { aim: 0.4, back: 0, lean: 0.1 } });
ok(heroCalls.length === 8 && heroCalls[0][0].look.eq.weapon === "iron_war_axe" && heroCalls[4][0].look.r === "nord", "hero renderer draws bandits and players only (" + heroCalls.length + ")");
c.HEROART = { fightFigure: () => { throw new Error("old api"); } };
c.FOERIG.ctl("bandit", "Bandit").draw(g, { t: 1, kit: {} });   // falls back to the rig's own people, no throw
console.log("foe rigs ok:", kinds.length + named.length, "foes,", bodies.size, "bodies,", calls, "draw calls");
