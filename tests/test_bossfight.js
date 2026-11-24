// Boss fights (bossfight.js): who counts as a boss, phases at health marks (one blow can't skip one, no early death),
// big attacks shown a turn ahead that you can answer or break, the intent chips, the perks, the Polish text, and a
// balance sim: bosses last longer than before but stay winnable at levels 10, 25 and 40. node test_bossfight.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).filter((f) => f !== "tbfight.js" && f !== "foeintent.js")
  .concat(["dragons.js", "priests.js", "daedric.js", "foekit.js", "fightread.js", "foeintent.js", "tbfight.js", "bossfight.js"]);
for (const f of [...new Set(FILES)]) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, TB, BOSSFIGHT: B, FIGHTREAD, PFX, DUNGEONS, QUESTS } = c;
const quick = process.argv.includes("--quick");

// ---- who counts as a boss
const foeOf = (base, L, extra = {}) => { const e = G.scaleEnemy({ ...base, tags: [...base.tags], level: L, danger: "high", gold: [0, 0], text: "", ...extra }, L); if (extra.boss) { e.health = Math.round(e.health * 0.8); e.hp = e.health; e.damage = Math.round(e.damage * 8) / 10; } return e; };
const fightOf = (build, L, e) => { const s = c.make(build, L); s.health = G.maxHealth(s); s.healthTs = G.now(); const f = new G.Fight(s, e); f.allies = []; return f; };
const CHIEF = { name: "Bandit chief", health: 170, damage: 22, tags: ["humanoid", "elite"] };
const BANDIT = { name: "Bandit outlaw", health: 60, damage: 10, tags: ["humanoid"] };
{
  const sess = (f) => new TB.Session(f, { trySneak: false });
  ok(sess(fightOf("warrior", 20, foeOf(CHIEF, 20, { boss: true }))).f.bf, "a dungeon's end boss is a boss");
  ok(!sess(fightOf("warrior", 20, foeOf(BANDIT, 20))).f.bf, "a plain bandit is not");
  ok(sess(fightOf("warrior", 20, foeOf({ name: "Dragon", health: 300, damage: 30, tags: ["big", "dragon", "elite"] }, 20))).f.bf?.prof === "dragon", "a dragon is a boss with dragon phases");
  ok(!sess(fightOf("warrior", 20, foeOf({ name: "Dragon", health: 300, damage: 30, tags: ["big", "dragon", "elite"] }, 20, { pool: 3000 }))).f.bf, "a raid dragon (shared health) is not");
  const qe = foeOf({ name: "Mercer Frey", health: 420, damage: 27, tags: ["humanoid", "elite"] }, 25, { qboss: true });
  ok(sess(fightOf("warrior", 25, qe)).f.bf?.th.length === 2, "an elite quest boss gets three phases");
  ok(!B.isBoss({ e: { name: "Ann", player: true }, tags: new Set() }), "another player is not a boss");
  const weak = sess(fightOf("warrior", 10, foeOf(CHIEF, 10, { boss: true }))).f.bf;
  ok(weak && weak.th.length === 1, "a low-level dungeon boss gets two phases");
  const src = fs.readFileSync(W + "quests.js", "utf8") + fs.readFileSync(W + "daedric.js", "utf8");
  ok((src.match(/qboss: tags\.includes\("elite"\)/g) || []).length === 2, "quest and Daedric elite foes are marked as bosses");
}

// ---- phases: at the marks, one at a time, no early death
{
  const f = fightOf("warrior", 30, foeOf(CHIEF, 30, { boss: true })), s = new TB.Session(f, { trySneak: false }), b = f.bf;
  ok(b.th.length === 2 && b.phase === 0, "three phases for a level-30 boss");
  f.ehp = s.ehpMax * 0.59; s.over; ok(b.phase === 1 && s.ev.some((e) => e.phase === 2 && /^Phase 2: /.test(e.text)), "phase 2 starts below 60% with a banner");
  f.ehp = -50; s.over; ok(b.phase === 2 && f.ehp > 0, "a killing blow before the last phase only pushes it into the last phase");
  ok(b.rage > 1 || b.add, "phases change what it does (angry or helpers)");
  f.ehp = -5; const over = s.over; ok(over && f.ehp <= 0, "in its last phase it can fall");
  const evs = s.ev.filter((e) => e.phase).map((e) => e.text);
  ok(evs.length === 2 && !evs.some((t) => /NaN|undefined/.test(t)), "phase lines read fine: " + evs.join(" | "));
}

// ---- big attacks: shown a turn ahead, answered, broken
{
  let declared = 0, landed = 0, chips = 0, order = 0, bad = 0;
  for (let i = 0; i < 30; i++) {
    const f = fightOf(["warrior", "mage", "twohand"][i % 3], 25, foeOf(CHIEF, 25, { boss: true }));
    const s = new TB.Session(f, { trySneak: false, auto: true });
    let seenChip = false;
    s.startRound = function () { TB.Session.prototype.startRound.call(this); const its = FIGHTREAD.intents(this); if (its.some((x) => /^bf/.test(x.id || ""))) seenChip = true; };
    s.begin();
    const ev = s.ev.map((e) => e.text);
    const d = ev.findIndex((t) => /readies .*It lands next turn/.test(t)), l = ev.findIndex((t) => /unleashes/.test(t));
    if (d >= 0) declared++; if (l >= 0) landed++; if (d >= 0 && l > d) order++; if (seenChip) chips++;
    for (const t of ev) if (/NaN|undefined|\{\d\}/.test(t)) { bad++; if (bad < 3) console.log("bad text:", t); }
  }
  ok(declared >= 25, `big attacks get announced (${declared}/30 fights)`);
  ok(landed >= 15 && order >= 15, `and land after the warning (${landed} landed, ${order} in order)`);
  ok(chips >= 25, `the intent chips show them (${chips}/30)`);
  ok(bad === 0, "no NaN or undefined in boss fight logs");

  // answering halves it: the same blow with and without a block
  const avg = (answer) => {
    let tot = 0;
    for (let i = 0; i < 300; i++) {
      const f = fightOf("warrior", 25, foeOf(CHIEF, 25, { boss: true })), s = new TB.Session(f, { trySneak: false }), b = f.bf;
      s.order = [{ id: "foe" }]; s.idx = 0; s.round = 3; f.hp = 1e5;
      b.tele = { key: "slam", round: 2, idx: 0, meAfter: true }; f.kit.plan = [{ id: "land", wind: "bf_slam", bf: "land" }];
      if (answer) f.blocking = true; f.dodgeCh = 0;
      const h0 = f.hp; B.turn(s, () => f.enemyTurn()); tot += h0 - f.hp;
    }
    return tot / 300;
  };
  const open = avg(false), blocked = avg(true);
  console.log(`Crushing Blow: ${open.toFixed(1)} taken open, ${blocked.toFixed(1)} blocked`);
  ok(blocked < open * 0.5, "blocking a Crushing Blow takes far less than eating it");

  // a shield bash or a shout breaks it; a plain small hit doesn't
  const f = fightOf("warrior", 25, foeOf(CHIEF, 25, { boss: true })), s = new TB.Session(f, { trySneak: false }), b = f.bf;
  b.tele = { key: "slam", round: 1, idx: 0, meAfter: true }; f.kit.plan = [{ id: "land", wind: "bf_slam", bf: "land" }];
  let t = B.answer(s, "attack", f.ehp + 1); ok(b.tele && !t.includes("break"), "a scratch doesn't break it");
  t = B.answer(s, "bash", f.ehp); ok(!b.tele && /break its Crushing Blow/.test(t) && f.kit.plan[0] === null, "a shield bash breaks it and the chip goes: " + t);
  b.tele = { key: "soul", round: 1, idx: 0, meAfter: true }; t = B.answer(s, "shout:fus", f.ehp); ok(!b.tele, "a shout breaks it too");
  // the AI answers
  b.tele = { key: "slam", round: 1, idx: 0, meAfter: true }; s.myActs = 0; s.ap = 6; s.apSet = true; s.canAfford = (a) => a === "block" || a === "attack";
  ok(B.ai(s, "attack") === "block", "Auto blocks a Crushing Blow it sees coming");
}

// ---- dragons: the plan stays in step while it flies
{
  const f = fightOf("mage", 25, foeOf({ name: "Dragon", health: 300, damage: 30, tags: ["big", "dragon", "elite"] }, 25, { boss: true })), s = new TB.Session(f, { trySneak: false, auto: true });
  s.begin();
  const ev = s.ev.map((e) => e.text);
  ok(ev.some((t) => /Phase 2: The dragon climbs higher/.test(t)) && ev.some((t) => /Phase 3: The dragon crashes down/.test(t)), "a dragon's phases: up into the sky, then down fighting");
  ok(ev.some((t) => /Great Breath|Tail Sweep/.test(t)), "a dragon readies its breath");
}

// ---- perks
{
  for (const id of ["giant_slayer", "read_the_signs", "break_their_focus"]) ok(c.PERKS.BY_ID[id] && PFX.FX[id], "new perk " + id);
  const f = fightOf("warrior", 30, foeOf(CHIEF, 30, { boss: true })); new TB.Session(f, { trySneak: false });
  const s = f.s; s.perks = { ...s.perks, giant_slayer: 1 };
  const k0 = PFX.sum(s, "out", f, {}); f.bf.phase = f.bf.th.length; const k1 = PFX.sum(s, "out", f, {});
  ok(k1 > k0 + 0.09, `Giant Slayer: more in the last phase (${k0.toFixed(2)} → ${k1.toFixed(2)})`);
  const g = fightOf("warrior", 30, foeOf(BANDIT, 30)); g.s.perks = { ...g.s.perks, giant_slayer: 1 }; ok(!PFX.ok(g.s, { bossFoe: 1 }, g, {}), "Giant Slayer does nothing on plain foes");
  ok(!PFX.ok(s, { bossLast: 1 }, null, {}), "boss perks do nothing outside fights");
  // Read the Signs: a big attack hurts less
  const hit = (perk) => { let tot = 0; for (let i = 0; i < 300; i++) { const f2 = fightOf("warrior", 25, foeOf(CHIEF, 25, { boss: true })), s2 = new TB.Session(f2, { trySneak: false }); if (perk) f2.s.perks = { ...f2.s.perks, read_the_signs: 1 }; f2.hp = 1e5; s2.order = [{ id: "foe" }]; s2.round = 3; f2.bf.tele = { key: "slam", round: 2, idx: 0, meAfter: true }; f2.kit.plan = [{ id: "land", bf: "land" }]; const h0 = f2.hp; B.turn(s2, () => f2.enemyTurn()); tot += h0 - f2.hp; } return tot / 300; };
  const a = hit(false), r = hit(true); ok(r < a * 0.85, `Read the Signs: big attacks hurt less (${a.toFixed(1)} → ${r.toFixed(1)})`);
  // Break Their Focus: a tenth of its health always breaks it, and it reels
  const f3 = fightOf("twohand", 30, foeOf(CHIEF, 30, { boss: true })), s3 = new TB.Session(f3, { trySneak: false }); f3.s.perks = { ...f3.s.perks, break_their_focus: 1 };
  f3.bf.tele = { key: "slam", round: 1, idx: 0, meAfter: true }; const before = f3.ehp; f3.ehp -= s3.ehpMax * 0.11;
  const t = B.answer(s3, "power_attack", before); ok(!f3.bf.tele && f3.stagger && /reels/.test(t), "Break Their Focus: a heavy blow breaks it and it loses a move");
}

// ---- Polish
{
  const ctx = vm.createContext({ I18N_STORY: { ex: {}, pats: [] } });
  vm.runInContext(fs.readFileSync(W + "i18n_boss.js", "utf8"), ctx);
  const PLX = ctx.I18N_STORY.ex, miss = [];
  const need = new Set();
  for (const d of Object.values(B.TELE)) { need.add(d.name); need.add("Readies " + d.name); }
  for (const p of Object.values(B.PROF)) { p.ep.forEach((x) => need.add(x)); for (const ph of p.ph) if (ph) { need.add(ph.say); if (ph.add) need.add(ph.add); if (ph.hz) need.add(ph.hz); } }
  const src = fs.readFileSync(W + "bossfight.js", "utf8");
  for (const m of src.matchAll(/(?:fmt|T|say)\((?:f, )?"([^"]+)"/g)) need.add(m[1]);
  for (const m of src.matchAll(/^\s+(?:block|ward|dodge): "([^"]+)",$/gm)) need.add(m[1]);
  for (const k of need) if (!(k in PLX)) miss.push(k);
  ok(miss.length === 0, "every boss line has Polish: missing " + miss.join(" | "));
  for (const id of ["giant_slayer", "read_the_signs", "break_their_focus"]) { const p = c.PERKS.BY_ID[id]; ok(PLX[p.name] && PLX[p.desc.replace(/\s*\[OURS\]$/, "")], "perk in Polish: " + id); }
  ok(!/fallout/i.test(src + fs.readFileSync(W + "i18n_boss.js", "utf8")), "no Fallout");
}

// ---- balance: bosses last longer than before, and stay winnable
const BOSSES = ["chief", "deathlord", "centurion", "necroMaster", "giantSpider", "dragon", "lich", "master"];
/* a dungeon's end boss, the way dungeons.js foe() makes it */
const dunBoss = (s, key) => { const e = G.scaleEnemy({ ...DUNGEONS.ENEMY[key], tags: [...DUNGEONS.ENEMY[key].tags] }, G.fightLevel ? G.fightLevel(s) : s.level); e.health = Math.round(e.health * 0.8); e.hp = e.health; e.damage = Math.round(e.damage * 8) / 10; e.boss = true; return e; };
function boss(build, L, key, on) {
  const s = c.make(build, L); s.health = G.maxHealth(s); s.healthTs = G.now();
  const f = new G.Fight(s, dunBoss(s, key)); f.allies = [];
  const keep = c.BOSSFIGHT; if (!on) c.BOSSFIGHT = undefined;
  let ss; try { ss = TB.simulate(f, { trySneak: false }); } finally { c.BOSSFIGHT = keep; }
  return { won: f.ehp <= 0 && f.hp > 0, rounds: ss.round, hpLeft: Math.max(0, f.hp) / G.maxHealth(f.s), f, ss };
}
const BUILDS = ["warrior", "twohand", "archer", "mage", "spellsword"];
const N = quick ? 20 : 60, rows = [];
for (const L of [10, 25, 40]) {
  let w1 = 0, w0 = 0, r1 = 0, r0 = 0, h1 = 0, h0 = 0, k = 0, tooQuick = 0, big = 0, ans = 0, brk = 0;
  for (const base of BOSSES) for (let i = 0; i < N / 2; i++) {
    const b = BUILDS[(i + k) % BUILDS.length];
    const a = boss(b, L, base, true), z = boss(b, L, base, false);
    w1 += a.won; w0 += z.won; r1 += a.rounds; r0 += z.rounds; h1 += a.hpLeft; h0 += z.hpLeft; k++;
    if (a.won && a.rounds <= 2) tooQuick++;
    const bf = a.f.bf; if (bf) { big += bf.landed + bf.broke; ans += bf.answered; brk += bf.broke; }
  }
  const m = k;
  const row = { L, win0: w0 / m, win1: w1 / m, r0: r0 / m, r1: r1 / m, h0: h0 / m, h1: h1 / m, quick: tooQuick / m };
  rows.push(row);
  const line = `level ${L}: win ${(row.win0 * 100).toFixed(0)}% → ${(row.win1 * 100).toFixed(0)}%, rounds ${row.r0.toFixed(1)} → ${row.r1.toFixed(1)}, health left ${(row.h0 * 100).toFixed(0)}% → ${(row.h1 * 100).toFixed(0)}% (${m} fights each) · big attacks a fight ${(big / m).toFixed(1)}, answered ${(100 * ans / Math.max(1, big)).toFixed(0)}%, broken ${(100 * brk / Math.max(1, big)).toFixed(0)}%`;
  console.log(line);
  ok(row.r1 > row.r0 * 1.08, "bosses last longer: " + line);
  ok(row.r1 < row.r0 * 1.6 + 1, "but don't drag on: " + line);
  ok(row.win1 >= row.win0 - 0.1 && (L < 20 || row.win1 >= 0.6), "and stay winnable: " + line);
  ok(row.quick < 0.05, "no boss falls in two rounds: " + line);
}
// followers get knocked down, never killed, in a boss fight
{
  let gone = 0;
  for (let i = 0; i < 12; i++) {
    const s = c.make("warrior", 25); s.follower = { id: "lydia", hp: vm.runInContext("TOWNS", c).followerMax(s, "lydia"), ts: G.now() };
    const f = new G.Fight(s, dunBoss(s, BOSSES[i % BOSSES.length]));
    const ss = TB.simulate(f, { trySneak: false });
    if (ss.ev.some((e) => /\b(dies|is killed|killed)\b/i.test(e.text) && /Lydia/.test(e.text))) gone++;
  }
  ok(gone === 0, "followers are only knocked down");
}
console.log(fails ? `failed: ${fails}` : `bossfight: all ok · ${n} checks`);
process.exit(fails ? 1 : 0);
