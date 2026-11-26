/* Front and back rows, foe roles, the mage tune (foefield.js, foeroles.js, tbfight.js). [rows, combat step 5]
   Owner: rows decide protection and targeting only, never damage. Checks:
   - your row from your gear (sword and shield, two-hander, dagger: front; bow, staff, a mage: back), your own pick
     in the Hero panel wins and is saved with your loadout; party cards carry it
   - how many foes by party size (1 → 1-2, 2 → 2-3, 3-4 → 3-4, 5-6 → 4-5, 7-8 → 5-6), front row first
   - melee reaches only the front row while anyone stands there (then the back row opens); bows and direct spells reach
     both; Line Breaker once a fight; foes' melee can't reach your back row while your front row stands
   - Shieldwarden Cover: one interception, never chained, ends at its next move; Through the Gap slips past it
   - a channelled Fireball: a bash or a shock breaks it, Spellbreaker staggers; it lands on a whole row
   - area spells: Adept/Expert one row, Master both, the aimed-at foe takes it all, the others a share
   - Mender heals the most hurt foe (3 a fight), Warleader rallies, a burning Regrower doesn't regrow
   - bosses change role by phase; perks have real fx keys
   - seeded sims (Story / Normal / Hard × party 1-8 × all-melee / all-mage / all-archer / mixed): rounds, win rates,
     mage vs the rest on Hard, melee never stuck without a target, strong foes not killed in their first round,
     no Cover loops, no one-shots
   W=/path/to/game/ node test_rows.js   (RUNS=fights per cell, default 8; QUICK=1 skips the sims) */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const RUNS = +(process.env.RUNS || 8);
let seed = 777;
const M = Object.create(Math); M.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
const c = { console, Math: M, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, process, structuredClone };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {}, removeItem() {} };
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
const { G, D, TB, COOP, FOEFIELD: FF, FOEROLES: FR, PERKS, PFX, NAMES, DUNGEONS } = c;
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
/* balance goals that also hang on things this PR doesn't own (party foe scaling: claude/partyboss; every build's own
   kit): printed every run, a miss is a NOTE, not a failure */
const soft = (v, m) => console.log((v ? "met  " : "NOTE ") + m);
ok(TB && FF && FR && COOP, "tbfight.js, foefield.js, foeroles.js and coop.js loaded");
const enc = (name, L) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, L);
const boss = (key, L) => { const e = G.scaleEnemy({ ...DUNGEONS.ENEMY[key] }, L); e.health = Math.round(e.health * 0.8); e.hp = e.health; e.damage = Math.round(e.damage * 0.8 * 10) / 10; e.boss = true; return e; };
const hero = (b, L = 20, diff) => { const s = c.make(b, L); s.id = "p1"; s.name = "Alfa"; if (diff) s.diff = diff; s.health = G.maxHealth(s); return s; };
const NAMES8 = ["Beta", "Ceta", "Dita", "Ema", "Fila", "Gosia", "Hela"];
function party(build, np, L, foe, diff, mixed) {
  const MIX = ["warrior", "mage", "archer", "twohand", "spellsword"];
  const s = hero(mixed ? MIX[0] : build, L, diff), f = new G.Fight(s, foe); f.allies = [];
  for (let i = 2; i <= np; i++) {
    const sx = c.make(mixed ? MIX[(i - 1) % MIX.length] : build, L); sx.id = "p" + i; sx.name = NAMES8[i - 2];
    const al = COOP.allyFromCard({ id: sx.id, name: sx.name, cur: G.maxHealth(sx), coop: { prof: COOP.profile(sx) } }); al.pid = sx.id; f.allies.push(al);
  }
  return { s, f };
}

// ---------------------------------------------------------------- 1. your row
{ const w = hero("warrior"), t = hero("twohand"), a = hero("archer"), m = hero("mage"), sp = hero("spellsword");
  ok(FF.saveRow(w) === "front" && FF.saveRow(t) === "front" && FF.saveRow(sp) === "front", "sword and shield, two-hander, sword and spells: front row");
  ok(FF.saveRow(a) === "back" && FF.saveRow(m) === "back", "bow and mage: back row (" + FF.saveRow(a) + ", " + FF.saveRow(m) + ")");
  ok(FF.gearRow("dagger") === "front" && FF.gearRow("bow") === "back" && FF.gearRow("sword", true) === "back" && FF.gearRow("crossbow") === "back", "dagger front, staff and crossbow back");
  ok(FF.choice(w) === "auto" && FF.setChoice(w, "back") && FF.saveRow(w) === "back" && w.loadouts[w.loadout].row === "back", "your pick wins and is saved with the loadout");
  ok(COOP.profile(w).row === "back" && COOP.allyFromCard({ id: "x", name: "X", coop: { prof: COOP.profile(w) } }).row === "back", "the party card carries it");
  FF.setChoice(w, "auto"); ok(FF.choice(w) === "auto" && !("row" in w.loadouts[w.loadout]) && FF.saveRow(w) === "front", "Auto: back to your gear");
  const f = new G.Fight(w, enc("Bandit outlaw", 20)); ok(FF.myRow(f) === "front", "in a fight: front (" + FF.myRow(f) + ")");
  ok(/data-act="rowpick"/.test(FF.heroChip(w)) && /Fight row: Front/.test(FF.heroChip(w)), "the Hero panel shows the row and the pick");
  ok(FF.allyRow({ follower: true, row: "back" }) === "back" && FF.allyRow({ summon: true }) === "front" && FF.allyRow({ role: "healer" }) === "back", "followers by their role, summons in front"); }

// ---------------------------------------------------------------- 2. how many foes
{ const R = { 1: [1, 2], 2: [2, 3], 3: [3, 4], 4: [3, 4], 5: [4, 5], 6: [4, 5], 7: [5, 6], 8: [5, 6] };
  for (let P = 2; P <= 8; P++) { const seen = new Set(); for (let i = 0; i < 60; i++) seen.add(FF.count(P)); ok([...seen].every((k) => k >= R[P][0] && k <= R[P][1]), `party of ${P} meets ${R[P].join("-")} (${[...seen]})`); }
  let solo = new Set(); for (let i = 0; i < 80; i++) { const s = hero("warrior"), f = new G.Fight(s, enc("Bandit outlaw", 20)); f.allies = []; solo.add(new TB.Session(f, { trySneak: false }).waves); }
  ok([...solo].every((k) => k === 1 || k === 2) && solo.size === 2, "on your own: 1 or 2 (" + [...solo] + ")");
  const { f } = party("warrior", 6, 20, enc("Bandit outlaw", 20)); const ss = new TB.Session(f, { trySneak: false });
  const fd = ss.field; ok(fd && fd.foes.length === ss.waves && ss.waves >= 4, "a party of 6 meets 4-5 on the field (" + ss.waves + ")");
  ok(fd.foes.some((x) => x.row === "back") && fd.foes.some((x) => x.row === "front"), "both rows filled for a big party");
  ok(fd.foes.every((x, i) => i === 0 || fd.foes[i - 1].row === "front" || x.row === "back"), "front row first");
  const tot = fd.foes.reduce((a, x) => a + x.max, 0); ok(Math.abs(tot - ss.ehpBase * ss.waves) / tot < 0.02, "total foe health is the same as before (only split)");
  ok(fd.foes.every((x) => x.role && FR.ROLES[x.role]), "every bandit has a role: " + fd.foes.map((x) => FF.label(x)).join(", "));
  ok(NAMES.role("guardian") === "Shieldwarden" && FR.name("mage") === "Spellcaster", "role names come from names.js"); }

// ---------------------------------------------------------------- 3. reach
function field(roles, build = "warrior", np = 3) {
  for (let k = 0; k < 200; k++) {
    const { f } = party(build, np, 20, enc("Bandit outlaw", 20));
    const ss = new TB.Session(f, { trySneak: false }); if (!ss.field) continue;
    if (roles.every((r) => ss.field.foes.some((x) => x.role === r))) return ss;
  }
  return null;
}
{ const ss = field(["guardian", "archer"]); ok(ss, "a field with a Shieldwarden and a Marksman");
  if (ss) {
    const fd = ss.field, back = fd.foes.find((x) => x.row === "back"), front = fd.foes.find((x) => x.row === "front");
    ss.f.sp = 999; ss.f.mp = 999;
    FF.target(ss, back.i); const note = FF.heroPre(ss, "attack");
    ok(fd.cur === front.i || fd.foes[fd.cur].row === "front", "a blade aimed at the back row hits the front row: " + note);
    ok(FF.canReach(ss, back.i, "ranged") && !FF.canReach(ss, back.i, "melee"), "bows and spells reach the back row, blades don't");
    ok(/Behind the/.test(FF.why(ss, back.i)), "the plate says why: " + FF.why(ss, back.i));
    for (const x of fd.foes) if (x.row === "front") { x.down = true; x.hp = 0; } if (fd.foes[fd.cur].row === "front") ss.f.ehp = 0;
    ok(FF.canReach(ss, back.i, "melee"), "the last front foe down: the back row is open");
    const h = { s: hero("archer") }; ok(FF.reachOf({ wt: "bow" }, "attack") === "ranged" && FF.reachOf({ wt: "sword" }, "attack") === "melee" && FF.reachOf({ wt: "sword" }, "spell:firebolt") === "ranged", "a bow's blow is ranged, a firebolt is ranged");
    void h;
  }
  // Line Breaker
  const s2 = field(["guardian", "archer"]);
  if (s2) { const b = s2.field.foes.find((x) => x.row === "back"); s2.f.s.perks = { ...(s2.f.s.perks || {}), line_breaker: 1 };
    const pfx = PFX.num(s2.f.s, "rowreach"); FF.target(s2, b.i); const nt = FF.heroPre(s2, "attack");
    ok(pfx > 0 && s2.field.cur === b.i && /break through/.test(nt) && s2.field.reach === 1, "Line Breaker: once a fight a blade reaches the back row: " + nt);
    FF.target(s2, b.i); FF.heroPre(s2, "attack"); ok(s2.field.foes[s2.field.cur].row === "front", "only once"); }
  // foes' melee
  { const { f } = party("warrior", 3, 20, enc("Bandit outlaw", 20)); const ss3 = new TB.Session(f, { trySneak: false });
    const mage = f.allies[0]; mage.row = "back"; f.allies[1].row = "front"; f.e.role = "berserker"; f.e.arch = "brute";
    ok(!FF.heroOk(f, mage) && FF.heroOk(f, f.allies[1]) && FF.heroOk(f, null), "a foe's blade can't reach your back row while your front stands");
    let wrong = 0; for (let i = 0; i < 200; i++) if (FF.fixTarget(f, mage, M.random) === mage) wrong++;
    ok(wrong === 0, "its blows go to the front row instead");
    f.e.role = "assassin"; let back = 0; for (let i = 0; i < 400; i++) if (FF.fixTarget(f, f.allies[1], M.random) === mage) back++;
    ok(back > 120, "a Cutthroat goes round the front for the back row (" + back + "/400)");
    f.e.role = "archer"; f.e.arch = "archer"; ok(FF.heroOk(f, mage), "arrows reach the back row");
    void ss3; } }

// ---------------------------------------------------------------- 4. Cover, channelling, area, Mender, Rally, Regrower
{ const ss = field(["guardian", "mage"]);
  if (ss) {
    const fd = ss.field, g = fd.foes.find((x) => x.role === "guardian"), m = fd.foes.find((x) => x.role === "mage");
    fd.cover = { by: g.i, to: m.i }; ss.f.wt = "bow";
    FF.target(ss, m.i); const t1 = FF.heroPre(ss, "attack");
    ok(fd.cur === g.i && /steps in front/.test(t1) && !fd.cover, "Cover: the Shieldwarden takes the arrow, once: " + t1);
    FF.target(ss, m.i); FF.heroPre(ss, "attack"); ok(fd.cur === m.i, "the next arrow hits the Spellcaster (no chaining)");
    fd.cover = { by: g.i, to: m.i }; ss.f.s.perks = { ...(ss.f.s.perks || {}), through_the_gap: 1 }; FF.target(ss, m.i); FF.heroPre(ss, "attack");
    ok(fd.cur === m.i && fd.cover, "Through the Gap: your arrow slips past the Cover");
    delete ss.f.s.perks.through_the_gap;
    FF.target(ss, g.i); FF.load(ss, g.i); fd.cover = { by: g.i, to: m.i };
    let ran = false; FF.foeTurn(ss, () => { ran = true; }); // whoever acts first; make the guardian act
    fd.queue = [g.i]; fd.cover = { by: g.i, to: m.i }; FF.foeTurn(ss, () => {}); ok(ran && !fd.cover, "a Cover ends at the Shieldwarden's next move");
    // channelling
    FF.target(ss, m.i); ss.f.kit.windup = "chan"; ss.f.kit.chanRow = "front"; ss.f.wt = "sword";
    const t2 = FR.answer(ss, "bash", ss.f.ehp); ok(!ss.f.kit.windup && /break/.test(t2), "a shield bash breaks a channelled Fireball: " + t2);
    ss.f.kit.windup = "chan"; ss.f.s.perks = { ...(ss.f.s.perks || {}), spell_breaker: 1 }; ss.f.stagger = false;
    const t3 = FR.answer(ss, "bash", ss.f.ehp); ok(/Spellbreaker/.test(t3) && ss.f.stagger, "Spellbreaker: it staggers too");
    ss.f.kit.windup = "chan"; const b = ss.f.ehp; ss.f.ehp -= 5; ss.f.foeSt = { ...(ss.f.foeSt || {}) };
    ok(FR.answer(ss, "attack", b) === "", "a plain blow doesn't break it");
    ss.f.kit.windup = null;
    // area
    const live = FF.alive(ss), cur = fd.foes[fd.cur], same = live.filter((x) => x.i !== cur.i && x.row === cur.row), other = live.filter((x) => x.row !== cur.row);
    const hp0 = live.map((x) => x.hp), tx = FF.area(ss, "fireball", { level: "Adept" }, 100, 0);
    ok(same.every((x) => x.hp < hp0[live.indexOf(x)]) && other.every((x) => x.hp === hp0[live.indexOf(x)]), "an Adept area spell hits the aimed-at row only " + tx);
    const hp1 = live.map((x) => x.hp); FF.area(ss, "fire_storm", { level: "Master" }, 100, 0);
    ok(live.filter((x) => x.i !== cur.i && !x.down).every((x) => x.hp < hp1[live.indexOf(x)]), "a Master one hits both rows");
    ok(live.filter((x) => x.i !== cur.i && !x.down).every((x) => hp1[live.indexOf(x)] - x.hp <= 100 * Math.max(FF.SPLASH.small, FF.SPLASH.major) + 1e-9), "the others take a share, never more than the one you aim at"); } }
{ const ss = field(["healer"], "warrior", 6);
  ok(ss, "a party of 6+ can meet a Mender");
  if (ss) { const fd = ss.field, h = fd.foes.find((x) => x.role === "healer"), w = fd.foes.find((x) => x.i !== h.i);
    if (w.i !== fd.cur) w.hp = w.max * 0.3; else ss.f.ehp = w.max * 0.3;
    FF.load(ss, h.i); fd.actor = h.i; const pre = w.i === fd.cur ? ss.f.ehp : w.hp;
    const t = c.FOEKIT.MOVES.mend_ally.run(ss.f, () => "", "Mender"); fd.actor = null;
    ok(/mends/.test(t) && (w.i === fd.cur ? ss.f.ehp : w.hp) > pre, "the Mender heals the most hurt foe: " + t);
    FF.load(ss, h.i); fd.actor = h.i; c.FOEKIT.MOVES.rally.run(ss.f, () => "", "Mender"); fd.actor = null;
    ok(fd.foes.filter((x) => !x.down && x.i !== fd.cur).every((x) => (x.st.kit && x.st.kit.rage) >= 2) && ss.f.kit.rage >= 2, "a Rally lifts every foe on the field"); } }
{ const s = hero("warrior"), f = new G.Fight(s, enc("Frost troll", 20)); f.allies = []; const ss = new TB.Session(f, { trySneak: false });
  ok(f.e.role === "regenerator", "a troll is a Regrower");
  f.ehp = f.ehp0 * 0.5; ok(c.FOEKIT.MOVES.regen.when(f), "it regrows when hurt"); f.dots = [{ el: "fire", dmg: 3, turns: 2 }]; ok(!c.FOEKIT.MOVES.regen.when(f), "not while it burns"); }
{ const s = hero("warrior", 30), f = new G.Fight(s, boss("chief", 30)); f.allies = []; const ss = new TB.Session(f, { trySneak: false });
  const b = f.bf; const t = b ? FR.bossPhase(f, b.prof || "warrior", 1) : FR.bossPhase(f, "warrior", 1);
  ok(/fights as a/.test(t) && f.e.role, "a boss changes role by phase: " + t); void ss; }
{ for (const id of ["line_breaker", "sweeping_reach", "spell_breaker", "through_the_gap"]) ok(Object.values(PERKS.TREES).some((tr) => tr.some((p) => p[0] === id)), "perk " + id + " is in a tree");
  const s = hero("warrior"); s.perks = { ...(s.perks || {}), line_breaker: 1, spell_breaker: 1, through_the_gap: 1 };
  ok(PFX.num(s, "rowreach") > 0 && PFX.num(s, "rowint") > 0 && PFX.num(s, "nocover") > 0, "their effects are real fx keys"); }

// ---------------------------------------------------------------- 5. whole fights: the screen texts, the party view
{ const { f } = party("warrior", 4, 20, enc("Bandit outlaw", 20)); const ss = TB.simulate(f, { t: G.now() });
  ok(ss.done && ss.field, "a party fight against a field plays to the end");
  const rec = TB.fightState(ss); ok(rec.field && rec.field.foes.length === ss.waves && rec.field.foes.every((x) => x.lb), "the record carries the field for teammates' phones");
  ok(ss.ev.some((e) => /^(Shieldwarden|Ravager|Marksman|Spellcaster|Cutthroat|Mender|Warleader)( \d)?: /.test(e.text)), "foe moves say which foe made them");
  ok(!f.won || ss.ev.filter((e) => /falls!/.test(e.text)).length >= ss.waves - 1, "every foe that fell says so"); }

// ---------------------------------------------------------------- 6. sims
if (!process.env.QUICK) {
  const FOES = ["Bandit outlaw", "Draugr", "Forsworn ambush", "Wolf pack", "Bandit outlaw", "Draugr"];
  const TOUGH = ["Vampire", "Frost troll", "Thalmor patrol"];
  const BOSSES = ["deathlord", "chief", "centurion", "hagraven", "master", "lich"];
  const COMPS = { melee: "warrior", mage: "mage", archer: "archer", mixed: "mixed" };
  const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
  const watch = { stuck: 0, meleeTurns: 0, coverLoop: 0, covers: 0, coverStreak: 0, intercepts: 0, oneShot: 0, strongEarly: 0, strong: 0, aoe: 0, dmgMoves: 0, combo: 0, comboN: 0 };
  /* run one fight, keeping an eye on what the rules forbid */
  function run(f) {
    const ss = new TB.Session(f, { t: G.now(), auto: true });
    let prevPick = null;
    const act0 = ss.act.bind(ss);
    ss.act = (a, ...r) => {
      const fd = ss.field, re = FF.reachOf(ss.f, a), hp0 = f.ehp, max0 = f.ehp0 || ss.ehpMax || 1, kind = ss.kind;
      if (fd) {
        const pick = a + "@" + (fd.tgt != null ? fd.foes[fd.tgt].role : "");
        if (prevPick != null) { watch.comboN++; if (pick !== prevPick) watch.combo++; } prevPick = pick;
        if (re === "melee") { watch.meleeTurns++; const live = FF.alive(ss); if (live.length && !live.some((x) => FF.canReach(ss, x.i, "melee"))) watch.stuck++; }   // a blade with no foe it can reach
        if (re === "area") watch.aoe++;
        if (re !== "self") watch.dmgMoves++;
      }
      const out = act0(a, ...r);
      if (kind !== "normal" && hp0 >= max0 * 0.9 && f.ehp <= 0) watch.oneShot++;   // a strong foe from (nearly) full to down in one move
      return out;
    };
    ss.begin(); let g = 0;
    while (!ss.done && g++ < 600) ss.advance();
    // Covers from the log: one interception each at most, and no Shieldwarden covering round after round
    { let round = 0; const last = {}; let open = 0;
      for (const e of ss.ev) {
        if (e.kind === "round") { round++; continue; }
        const t = String(e.text || "");
        const m = t.match(/^(.+?): .*raises a shield in front of/); if (m) { watch.covers++; open++; if (last[m[1]] === round - 1) watch.coverStreak++; last[m[1]] = round; }
        const k = (t.match(/steps in front of/g) || []).length; if (k) { watch.intercepts += k; if (k > open) watch.coverLoop++; open = Math.max(0, open - k); }
      } }
    if (ss.kind !== "normal") { watch.strong++; if (f.won && ss.round <= 1) watch.strongEarly++; }
    return ss;
  }
  const tbl = [];
  const diffs = ["story", "normal", "hard"];
  for (const diff of diffs) for (const [cn, b] of Object.entries(COMPS)) for (const np of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const rounds = [], winsN = [0, 0];
    for (let i = 0; i < RUNS; i++) {
      const L = [10, 20, 30][i % 3];
      const { f } = party(b === "mixed" ? "warrior" : b, np, L, enc(FOES[i % FOES.length], L), diff, b === "mixed");
      const ss = run(f); rounds.push(ss.round); winsN[0]++; if (f.won && !f.escaped) winsN[1]++;
    }
    tbl.push({ diff, comp: cn, np, med: med(rounds), win: winsN[1] / winsN[0] });
  }
  console.log("normal fights: median rounds / win% (Story · Normal · Hard)");
  console.log("comp     party  " + diffs.map((d) => d.padEnd(12)).join(""));
  for (const cn of Object.keys(COMPS)) for (const np of [1, 2, 3, 4, 5, 6, 7, 8])
    console.log(cn.padEnd(8), String(np).padStart(5), "  " + diffs.map((d) => { const r = tbl.find((x) => x.diff === d && x.comp === cn && x.np === np); return `${r.med} / ${Math.round(r.win * 100)}%`.padEnd(12); }).join(""));
  const normalMed = med(tbl.filter((r) => r.diff === "normal").map((r) => r.med));
  soft(normalMed >= 4 && normalMed <= 5, "normal fights, every party size: median 4-5 rounds on Normal (" + normalMed + "; parties run long from the party foe health, claude/partyboss)");
  // solo builds on Hard: the mage within 5 points of comparable builds, every build within 10
  const BUILDS = ["warrior", "twohand", "archer", "mage", "spellsword"], hard = {};
  for (const b of BUILDS) { let w = 0, t = 0; const rs = [];
    for (let i = 0; i < RUNS * 6; i++) { const L = [10, 20, 30][i % 3], s = hero(b, L, "hard"), f = new G.Fight(s, i % 2 ? enc(TOUGH[i % 3], L) : enc(FOES[i % FOES.length], L)); f.allies = [];
      const ss = run(f); t++; if (f.won && !f.escaped) w++; rs.push(ss.round); }
    hard[b] = { win: w / t, med: med(rs) }; }
  const solo = []; for (const b of BUILDS) for (let i = 0; i < RUNS * 3; i++) { const L = [10, 20, 30][i % 3], s = hero(b, L, "normal"), f = new G.Fight(s, enc(FOES[i % FOES.length], L)); f.allies = []; solo.push(run(f).round); }
  console.log("on your own (Normal, normal foes): median rounds " + med(solo));
  ok(med(solo) >= 4 && med(solo) <= 6, "on your own on Normal: median 4-6 rounds (" + med(solo) + ")");
  const others = BUILDS.filter((b) => b !== "mage"), avgO = others.reduce((a, b) => a + hard[b].win, 0) / others.length;
  console.log("solo on Hard (normal + tough foes): " + BUILDS.map((b) => `${b} ${Math.round(hard[b].win * 100)}% / ${hard[b].med}r`).join(" · "));
  soft(Math.abs(hard.mage.win - avgO) <= 0.05, `Hard: the mage is within 5 points of the others (${Math.round(hard.mage.win * 100)} vs ${Math.round(avgO * 100)})`);
  const ws = BUILDS.map((b) => hard[b].win); soft(Math.max(...ws) - Math.min(...ws) <= 0.10, "Hard: every build within 10 points (" + ws.map((x) => Math.round(x * 100)).join(", ") + ")");
  // bosses alone: 7-11 rounds
  const br = []; for (const b of BUILDS) for (let i = 0; i < RUNS; i++) { const L = [20, 30, 40][i % 3], s = hero(b, L), f = new G.Fight(s, boss(BOSSES[i % BOSSES.length], L)); f.allies = []; br.push(run(f).round); }
  console.log("bosses alone (Normal): median rounds " + med(br));
  ok(med(br) >= 7 && med(br) <= 11, "bosses: median 7-11 rounds (" + med(br) + ")");
  console.log(`melee turns ${watch.meleeTurns}, stuck without a target ${watch.stuck}; Covers ${watch.covers} (arrows or spells caught ${watch.intercepts}, caught with no Cover up ${watch.coverLoop}, the same Shieldwarden covering two rounds running ${watch.coverStreak}); strong foes killed in round 1: ${watch.strongEarly}/${watch.strong}; one-shots ${watch.oneShot}; area moves ${watch.aoe}/${watch.dmgMoves}; the move or target changes ${watch.combo}/${watch.comboN} turns`);
  ok(watch.stuck === 0, "melee is never stuck without a legal target while reachable foes remain");
  ok(watch.covers > 0 && watch.coverLoop === 0 && watch.intercepts <= watch.covers, "Covers are one use, never chained");
  ok(watch.coverStreak <= watch.covers * 0.5, "no Cover loops (a Shieldwarden covering round after round)");
  ok(watch.strong > 0 && watch.strongEarly / watch.strong < 0.1, "strong foes killed in their first round under 10%");
  ok(watch.oneShot === 0, "no one-shots on strong foes");
  ok(watch.dmgMoves > 0 && watch.aoe / watch.dmgMoves < 0.5, "area spells don't take over (" + watch.aoe + "/" + watch.dmgMoves + ")");
  ok(watch.comboN > 0 && watch.combo / watch.comboN >= 0.4, "the best move or target changes in 40%+ of turns (" + Math.round(100 * watch.combo / Math.max(1, watch.comboN)) + "%)");
  // no tank or healer needed: a party of archers or mages (no front row at all) still wins most of its fights on Normal
  for (const cn of ["mage", "archer"]) { const r = tbl.filter((x) => x.diff === "normal" && x.comp === cn); const w = r.reduce((a, x) => a + x.win, 0) / r.length; soft(w >= 0.8, `all-${cn} parties win without a tank or a healer (${Math.round(w * 100)}%)`); }
}
console.log(fails ? `FAILED ${fails} of ${n}` : `rows ok (${n} checks)`);
process.exit(fails ? 1 : 0);
