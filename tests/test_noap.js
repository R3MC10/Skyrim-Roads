// No action points anywhere (build 239). Owner: "Standard Attack should cost 2 ap not 3" — AP left in build 145, so a
// plain attack must be cheap: 1 move and a bit of stamina, and no player-facing text may still talk about AP.
// node test_noap.js — prints "noap ok".
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 1, structuredClone });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).concat(["jewelry.js", "skillinfo.js", "tomeinfo.js", "tooltip.js", "tbtips.js", "followerai.js"]);
for (const f of [...new Set(FILES)]) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, D, TIP, TB } = c;
const s = G.newSave("noap", "Plain", "nord"); s._test = true; s.level = 15;
TIP.state = () => s;
const text = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();
const AP = /\b\d+ AP\b|\bAP\b(?! *[a-z])|action points?/;

// 1. a plain attack: one move, stamina only, never more than a few stamina-heavy blows' worth
for (const wt of ["dagger", "fist", "sword", "axe", "mace", "spear", "staff", "greatsword", "battleaxe", "warhammer", "bow", "crossbow"]) {
  const f = { wt, s, e: { name: "bandit" }, tags: new Set() }, sess = { st: { acts: TB.MAX_ACTS, spCut: 0, mpCut: 0 }, used: {} };
  let cst = null; try { cst = TB.cost(f, "attack", sess); } catch (e) { cst = { err: e.message }; }
  ok(cst && cst.acts === 1, `${wt}: a plain attack takes 1 move, got ${JSON.stringify(cst)}`);
  ok(cst && !cst.mp && !cst.hp && cst.sp > 0, `${wt}: it costs stamina only, got ${JSON.stringify(cst)}`);
  ok(TB.MAX_ACTS >= 4, "4 moves a turn");
}
// 2. follower pace: a standard one-handed weapon costs 2 of their hidden pace, like a dagger, not 3
const fsrc = fs.readFileSync(W + "followerai.js", "utf8"), wm = fsrc.match(/const WCOST = (\{[^}]+\})/);
ok(wm, "followerai.js has WCOST");
if (wm) { const WC = vm.runInNewContext("(" + wm[1] + ")"); for (const k of ["sword", "axe", "mace", "spear", "staff", "dagger"]) ok(WC[k] === 2, `follower ${k}: a plain blow costs 2, got ${WC[k]}`); }
// 3. potion and scroll tooltips: "1 move, free", no AP
for (const id of Object.keys(D.ITEMS)) {
  const it = D.ITEMS[id]; if (!((it.slot === "potion" && it.restore) || (it.slot === "scroll" && D.SPELLS[it.spell]))) continue;
  const h = text(TIP.html("item:" + id));
  ok(/In a fight 1 move, free/.test(h) && !AP.test(h), `${id}: tooltip says 1 move, no AP: ${h.slice(-80)}`);
}
// 4. fight move tips say what they cost in stamina / magicka, never AP
for (const a of ["attack", "power_attack", "block", "bash", "end", "flee"]) {
  const f = { wt: "sword", s, e: { name: "bandit" }, weapon: { name: "Iron Sword" }, weaponDamage: () => 10, tags: new Set() };
  let t = ""; try { t = c.TBTIPS.action(f, a, TB.cost(f, a, { st: { acts: 4 }, used: {} })); } catch (e) { t = "ERR " + e.message; }
  ok(!AP.test(t) && !/^ERR/.test(t), `${a}: fight tip without AP: ${t}`);
}
// 5. no player-facing English string in the game code still quotes an AP cost (old patch notes and Polish keys aside)
for (const f of fs.readdirSync(W).filter((x) => x.endsWith(".js") && !/^(patchnotes|i18n)/.test(x))) {
  const lines = fs.readFileSync(W + f, "utf8").split("\n");
  lines.forEach((l, i) => {
    const code = l.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    if (/stripAp|\.replace\(/.test(code)) return;   // fighttips.js strips old "N AP." endings
    const strs = code.match(/(["'`])(?:\\.|(?!\1).)*\1/g) || [];
    for (const q of strs) ok(!/\b\d AP\b|\} AP\b|your AP\b|action points/.test(q), `${f}:${i + 1} still says AP: ${q.slice(0, 100)}`);
  });
}
console.log(fails ? `noap: ${fails} of ${n} failed` : `noap ok (${n} checks)`);
process.exit(fails ? 1 : 0);
