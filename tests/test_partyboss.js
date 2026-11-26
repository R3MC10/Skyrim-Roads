// Party fight length (build 356, [partyboss]). A party foe is sized for what every teammate really deals: each real
// player plays a full 3 AP turn on their own phone, and their phone publishes that number (COOP.profile → dpr, from
// TB.dprOf). Seeded party fights with 1-8 real players (each teammate's turn played by Auto on their own simulated
// phone, sharedfight.js, the way a real party plays) must give:
//   bosses 8-12 median rounds at every party size (Normal and Hard; Story is shorter by design: foes fall sooner),
//   normal fights 3-5, tough fights 5-8, the solo and 8-player win rates within 15 points, no one-shots on a boss.
// node test_partyboss.js          quick seeded set (CI), prints "partyboss ok (N checks)"
// FULL=1 node test_partyboss.js   the whole table: Story/Normal/Hard × levels 10/20/35 (gear tiers) × sizes 1-8
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const FULL = !!process.env.FULL, N = +(process.env.N || (FULL ? 12 : 6));
const T0 = 1795000000 + 12 * 3600;   // a fixed time of day, so night and sneaking never change the dice between runs
class FixedDate extends Date { static now() { return T0 * 1000; } }
const c = vm.createContext({ process: { env: process.env }, console, Math, Date: FixedDate, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RUNS: 1, structuredClone });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).filter((f) => f !== "tbfight.js" && f !== "foeintent.js")
  .concat(["difficulty.js", "dragons.js", "foekit.js", "fightread.js", "foeintent.js", "strategy.js", "reactions.js", "followerai.js", "initiative.js", "tbfight.js", "bossfight.js", "sharedfight.js"]);
for (const f of [...new Set(FILES)]) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
const { G, TB, D, COOP, SHAREDFIGHT, DUNGEONS } = c;
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
let seed = 7; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
Math.random = rnd;
const BUILDS = ["warrior", "twohand", "archer", "mage", "spellsword"];
const fresh = (b, L, id, diff) => { const s = c.make(b, L); s.id = id; s.name = id; s.diff = diff; s.health = G.maxHealth(s); s.healthTs = G.now(); return s; };
const enc = (name, L) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, L);
const boss = (key, L) => { const e = G.scaleEnemy({ ...DUNGEONS.ENEMY[key] }, L); e.health = Math.round(e.health * 0.8); e.hp = e.health; e.damage = Math.round(e.damage * 0.8 * 10) / 10; e.boss = true; return e; };
const FOES = { normal: ["Bandit outlaw", "Wolf pack", "Draugr", "Forsworn ambush", "Black bear", "Sabre cat"], tough: ["Vampire", "Frost troll", "Thalmor patrol"], boss: ["deathlord", "chief", "centurion", "hagraven", "master", "lich"] };
const foeOf = (kind, L, i) => (kind === "boss" ? boss(FOES.boss[i % 6], L) : enc(FOES[kind][i % FOES[kind].length], L));
const mateOf = (m) => COOP.allyFromCard({ id: m.id, name: m.id, cur: G.maxHealth(m), coop: { prof: COOP.profile(m) } });

// 1. every phone says what it deals a round; the leader's phone sizes the foe for it
if (!process.env.SIMONLY) { const s = fresh("mage", 20, "m1", "normal"), p = COOP.profile(s);   // SIMONLY=1: only the sims (e.g. on an older build, for a before/after table)
  ok(Array.isArray(p.dpr) && p.dpr.length === 3 && p.dpr.every((x) => x > 0), "COOP.profile publishes what you deal a round [normal, tough, boss]: " + JSON.stringify(p.dpr));
  ok(p.dpr[0] > p.dmg * 1.2, `a mage's round (${p.dpr[0]}) is far more than one plain blow with their fists (${p.dmg})`);
  ok(TB.dprOf(s) === TB.dprOf(s), "worked out once per kit (memo)");
  const a = mateOf(s); ok(JSON.stringify(a.dpr) === JSON.stringify(p.dpr), "a teammate keeps it beside them in the fight");
  for (const bad of [[-1, 2, 3], ["x", 1, 1], [1, 2], 7, null, [NaN, 1, 1]]) ok(!("dpr" in COOP.allyFromCard({ id: "z", name: "Z", coop: { prof: { dmg: 10, hp: 100, dpr: bad } } })), "a broken number from a card is ignored: " + JSON.stringify(bad));
  ok(COOP.allyFromCard({ id: "z", name: "Z", coop: { prof: { dmg: 10, hp: 100, dpr: [9e9, 1, 1] } } }).dpr[0] === 5000, "and a huge one is capped");
  // the foe's health follows the teammates: a strong mate makes it tougher than a weak one
  const L = 20, mk = (mates) => { seed = 99; const h = fresh("warrior", L, "p0", "normal"), f = new G.Fight(h, boss("chief", L)); f.allies = mates; return new TB.Session(f, { trySneak: false }).ehpMax; };
  const strong = mateOf(fresh("twohand", 35, "p1", "normal")), weak = mateOf(fresh("archer", 5, "p1", "normal"));
  ok(mk([strong]) > mk([weak]) * 1.1, `a boss is tougher with a strong teammate (${mk([strong])}) than a weak one (${mk([weak])})`);
  const old = mateOf(fresh("twohand", 35, "p1", "normal")); delete old.dpr;
  ok(mk([old]) > 0 && Number.isFinite(mk([old])), "a teammate whose card says nothing counts as dealing as much as you");
  // followers and pets are never counted as players
  const fol = { name: "Lydia", follower: true, player: false, dmg: 12, hp: 200 };
  { seed = 5; const h = fresh("warrior", L, "p0", "normal"), f = new G.Fight(h, boss("chief", L)); f.allies = [fol]; const ss = new TB.Session(f, { trySneak: false }); ok(ss.players === 0, "a follower is not a player"); } }

/* one party fight: hero + n-1 teammates, each a real player whose own phone plays their turn (Auto there) */
let worstHit = 0;
function fight(np, L, kind, diff, i) {
  const hero = fresh(BUILDS[i % 5], L, "p0", diff);
  const mates = []; for (let k = 1; k < np; k++) mates.push(fresh(BUILDS[(i + k) % 5], L, "p" + k, diff));
  const f = new G.Fight(hero, foeOf(kind, L, i)); f.allies = mates.map(mateOf);
  const byId = Object.fromEntries(mates.map((m) => [m.id, m]));
  const ss = new TB.Session(f, { trySneak: false, t: T0 }); ss.remote = { ask() {}, end() {} };
  let r = ss.begin() || {}, g = 0;
  const look = (dealt) => { if (kind === "boss") worstHit = Math.max(worstHit, dealt / ss.ehpMax); };   // one hero's whole turn (3 AP)
  while (!ss.done && g++ < 4000) {
    if (r.turn === "me") { const e0 = f.ehp; ss.autoTurn(); look(e0 - f.ehp); r = ss.advance() || {}; continue; }
    if (r.turn === "wait") {
      for (const w of ss.gr.waits) {
        if (w.fin || w.reply || w.move) continue;
        let sent = null; const m = SHAREDFIGHT.build(byId[w.pid], { id: "fid", owner: "p0", ...TB.fightState(ss) }, (x) => { sent = x; });
        const mr = m.advance(); if (mr && mr.turn === "me") m.autoTurn();
        if (sent) { w.reply = sent; look(sent.e0 - sent.ehp); } else w.move = "guard";
      }
      r = ss.advance() || {}; continue;
    }
    r = ss.advance() || {};
  }
  return { won: !!(f.won && !f.escaped), rounds: ss.round };
}
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? (b[(b.length - 1) >> 1] + b[b.length >> 1]) / 2 : 0; };
let errs = 0;
function cell(np, kind, diff, Ls) {
  const rs = [], w = [];
  for (const L of Ls) { seed = 1000 + np * 31 + L; for (let i = 0; i < N; i++) { try { const r = fight(np, L, kind, diff, i); rs.push(r.rounds); w.push(r.won); } catch (e) { errs++; if (errs < 3) console.log(e.stack); } } }
  return { win: Math.round(100 * w.filter(Boolean).length / Math.max(1, w.length)), med: med(rs) };
}

// 2. seeded party fights
const SIZES = FULL ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 4, 8], LS = [10, 20, 35];
const DIFFS = FULL ? ["story", "normal", "hard"] : ["normal", "hard"];
const WANT = { boss: [8, 12], tough: [5, 8], normal: [3, 5] }, SLACK = FULL ? 0 : 0.5;   // the quick set has fewer fights: half a round of slack
const table = [];
const ONLY = (k, v) => !process.env[k] || process.env[k].split(",").includes(v);   // KINDS=boss DIFFS=hard: one part of the table (to run parts side by side)
for (const kind of ["boss", "tough", "normal"]) for (const diff of DIFFS) {
  if (!ONLY("KINDS", kind) || !ONLY("DIFFS", diff)) continue;
  if (!FULL && kind !== "boss" && diff !== "normal") continue;
  const row = SIZES.map((np) => [np, cell(np, kind, diff, LS)]);
  table.push([kind, diff, row]);
  console.log(kind.padEnd(6), diff.padEnd(6), row.map(([np, r]) => `${np}p ${String(r.win).padStart(3)}%/${r.med}`).join("  "));
  const [lo, hi] = WANT[kind];
  for (const [np, r] of row) {
    if (diff === "story") { const lo2 = lo - { boss: 2, tough: 1, normal: 0 }[kind]; ok(r.med >= lo2 - SLACK && r.med <= hi + SLACK, `Story ${kind}, ${np} players: ${r.med} median rounds (${lo2}-${hi}: Story foes fall sooner)`); continue; }
    ok(r.med >= lo - SLACK && r.med <= hi + SLACK, `${diff} ${kind}, ${np} players: ${r.med} median rounds (want ${lo}-${hi})`);
  }
  const solo = row.find(([np]) => np === 1)[1].win, big = row.find(([np]) => np === 8)[1].win;
  ok(Math.abs(solo - big) <= (FULL ? 15 : 20), `${diff} ${kind}: solo wins ${solo}%, 8 players ${big}% (within ${FULL ? 15 : 20} points)`);
}
ok(errs === 0, "no errors in the sims (" + errs + ")");
console.log("biggest single turn on a boss: " + Math.round(worstHit * 100) + "% of its health");
ok(worstHit <= 0.45, `no one-shots: the biggest single turn on a boss took ${Math.round(worstHit * 100)}% of its health`);

// 3. the numbers and their Polish
if (!process.env.SIMONLY) { ok(TB.T.party && TB.T.party.hp && TB.T.party.acts > 0, "the party tuning lives in TB.T.party");
  const pn = fs.readFileSync(W + "patchnotes.js", "utf8"); ok(/b354-partyboss|partyboss/.test(pn), "patch note for party boss fights");
  const pl = fs.readFileSync(W + "i18n_partyboss.js", "utf8"), html = fs.readFileSync(W + "index.html", "utf8");
  ok(pl.includes("Party fights last as long as solo ones"), "Polish for the patch note");
  ok(html.indexOf("i18n_partyboss.js") > 0 && html.indexOf("i18n_partyboss.js") < html.indexOf('src="i18n.js"'), "i18n_partyboss.js loads before i18n.js"); }

console.log(fails ? `partyboss: ${fails} of ${n} failed` : `partyboss ok (${n} checks)`);
process.exit(fails ? 1 : 0);
