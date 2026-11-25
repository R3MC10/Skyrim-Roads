// Fight bug hunt regressions (claude/qa-fight-*): node test_qafight.js -> "qafight ok"
// - a foe that falls outside your own moves (a burn tick, a teammate) used to leave End turn and every move doing
//   nothing: the turn never moved on. Any move now wraps the fight up.
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ console, Math, Date, JSON, Object, Array, Set, Map, Number, String, structuredClone });
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "powers.js", "engine.js", "stacks.js", "tbfight.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const { G, TB } = c;
const foe = (name, x = {}) => ({ name, health: 60, hp: 60, damage: 8, tags: ["humanoid"], red: 0.1, level: 10, danger: "medium", gold: [5, 10], text: "", ...x });

function myTurn(boss) {
  for (let i = 0; i < 50; i++) {
    const s = G.newSave("q" + i, "Q", "nord"); s.level = 12;
    const f = new G.Fight(s, foe(boss ? "Bandit chief" : "Bandit outlaw", boss ? { boss: true } : {})); f.allies = [];
    const ss = new TB.Session(f, { trySneak: false });
    let r = ss.begin ? ss.begin() : ss.advance();
    if (r && r.turn === "me") return { ss, f };
  }
  return null;
}
for (const a of ["end", "attack", "block"]) {
  const t = myTurn(true);
  if (!t) { ok(false, "got a turn of yours"); continue; }
  const { ss, f } = t;
  ss.wave = ss.waves; f.ehp = 0;   // the last foe fell between your moves
  const r = ss.act(a);
  ok(r && r.turn === "next", `"${a}" with the foe already down moves the fight on (${JSON.stringify(r)})`);
  const fin = ss.advance();
  ok(ss.done && f.won, `the fight ends as a win after "${a}" (${JSON.stringify(fin && fin.turn)})`);
}
// a normal fight still plays normally
{ const t = myTurn(false); const r = t && t.ss.act("attack");
  ok(r && (r.turn === "me" || r.turn === "next") && !r.err, "a normal Attack still works: " + JSON.stringify(r)); }
console.log(fails ? `FAILED ${fails}` : "qafight ok");
process.exit(fails ? 1 : 0);
