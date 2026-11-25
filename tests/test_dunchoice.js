// Way cards at a dungeon fork (dunchoice.js): every room type has a risk and a reward, risk follows the dungeon's tier,
// the unknown room never shows a borrowed painting, each card says what comes after it, and the HTML has no <div> inside
// the choices block (other screens cut that block out with a pattern that stops at the first </div>).
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm"), W = __GAME;
const fail = (m) => { console.error("FAIL", m); process.exit(1); };
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Proxy, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "dunrooms.js", "dunchoice.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const DC = c.DUNCHOICE;
let n = 0; const ok = (cond, m) => { n++; if (!cond) fail(m); };

for (const t of ["fight", "elite", "trap", "treasure", "puzzle", "rest", "mystery", "boss"]) {
  const h = DC.hint(t, { tier: 2 }, null);
  ok(h.riskTxt && h.what && h.gain, `${t} has risk, what and reward`);
}
ok(DC.hint("boss", { tier: 1 }).riskTxt === "Deadly", "a boss is always deadly");
ok(DC.hint("treasure", { tier: 3 }).riskTxt === "Safe", "a chest is safe even in a deadly place");
ok(DC.hint("elite", { tier: 1 }).risk >= 3, "a tough fight stays high risk in an easy dungeon");
ok(DC.hint("fight", { tier: 3 }).risk > DC.hint("fight", { tier: 1 }).risk, "a fight is riskier in a deadly dungeon");
ok(DC.hint("mystery", { tier: 2 }).risk === -1, "the unknown room's risk is unknown");

// a known map: fork of three, each leading somewhere
const rows = [[{ type: "fight", links: [0] }, { type: "mystery", links: [0, 1] }, { type: "treasure", links: [1] }],
  [{ type: "rest", links: [0] }, { type: "trap", links: [0] }], [{ type: "boss", links: [] }]];
const s = { dungeon: { theme: "barrow", tier: 2, rows, row: -1, col: 0, room: null } };
ok(JSON.stringify(DC.beyond(s.dungeon, 1)) === JSON.stringify(["rest", "trap"]), "the unknown room leads to rest and trap");
const have = new Set(fs.readdirSync(W).filter((f) => /^room-/.test(f)).map((f) => f.replace(/\.webp$/, "")));
c.ASSETS = { state: (k) => (have.has(k) ? "ok" : "none"), url: (k) => k + ".webp", on() {} };
const html = DC.listHTML(s);
ok((html.match(/data-act="droom"/g) || []).length === 3, "three way cards");
ok(/room-fight-barrow\.webp/.test(html) && /room-treasure-barrow\.webp/.test(html), "fight and treasure show their paintings");
ok(!/room-fight-barrow[\s\S]*room-fight-barrow/.test(html), "the unknown room doesn't borrow the fight painting");
ok(/class="evc dcards"/.test(html) && !/<div/.test(html.replace(/^<div class="evc dcards">/, "")), "no <div> inside the choices block");
ok(/Then/.test(html) && /High risk|Some risk|Low risk/.test(html), "cards say the risk and what comes next");
const v = DC.voteHTML(s, "2", true);
ok(/data-act="pvv"/.test(v) && /data-k="2"/.test(v) && /pvchips/.test(v) && /class="pvn num"/.test(v) && /pvmine/.test(v), "a vote card carries faces, count and your pick");
ok(DC.voteHTML(s, "7", false) === "", "no card for a way that isn't there");
s.dungeon.room = { type: "fight" };
ok(DC.listHTML(s) === "", "no fork cards while inside a room");
console.log(`test_dunchoice: ${n} checks passed`);
