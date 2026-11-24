// Reading the fight (fightread.js): foe intents are planned and kept, the numbers they show are close to what happens,
// poison/burning forecasts match the ticks, round summaries add up, banners and sounds fire, balance is unchanged.
// node test_fightread.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).filter((f) => f !== "tbfight.js").concat(["dragons.js", "foekit.js", "fightread.js", "tbfight.js"]);
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, TB, FOEKIT: K, FIGHTREAD: R } = c;
ok(R && typeof R.intents === "function", "fightread loads");

const FOES = [
  { name: "Bandit", health: 260, damage: 14, tags: ["humanoid"] },
  { name: "Wolf", health: 140, damage: 10, tags: ["beast"] },
  { name: "Troll", health: 360, damage: 18, tags: ["beast"] },
  { name: "Frostbite Spider", health: 180, damage: 12, tags: ["beast"] },
  { name: "Draugr", health: 260, damage: 14, tags: ["undead"] },
  { name: "Necromancer", health: 220, damage: 16, tags: ["humanoid", "mage"] },
];
const mk = (build, L, base) => {
  const s = c.make(build, L); s.health = G.maxHealth(s); s.healthTs = G.now();
  const e = G.scaleEnemy({ ...base, tags: [...base.tags], level: L, danger: "medium", gold: [0, 0], text: "" }, L);
  const f = new G.Fight(s, e); f.allies = []; return f;
};

// ---- the plan is what happens: record the planned move before each foe turn and what it really did
let planned = 0, kept = 0, bad = 0, intentsSeen = 0;
const realTurn = K.turn;
K.turn = function (f, et, rnd) {
  const p = f.kit?.plan?.[0];
  const ready = p && p.id !== "blow" && p.id !== "land" ? K.ready(f).includes(p.id) : true;
  const lastBefore = f.kitLast; f.kitLast = null;
  const held = f.calmTurns > 0 || f.eParalyzed > 0 || f.stagger;   // calmed, paralyzed or staggered: it loses the move (the intent says so)
  const t = realTurn(f, et, rnd);
  if (p && ready && !held) {
    planned++;
    const did = f.kitLast || "blow";
    if (p.id === "blow" || p.id === "land" ? did === "blow" : did === p.id) kept++;
  }
  if (!f.kitLast) f.kitLast = lastBefore;
  return t;
};
const realAuto = TB.Session.prototype.autoTurn;
TB.Session.prototype.autoTurn = function () {   // look at the intents and forecast whenever it's your turn
  if (this.cur?.id === "me" && !this.over) {
    const its = R.intents(this), fc = R.forecast(this);
    intentsSeen += its.length;
    for (const it of its) if (![it.lo, it.hi, it.mid].every((v) => Number.isFinite(v)) || it.lo > it.hi + 0.01) bad++;
    if (![fc.me.hit, fc.me.dot, fc.foe.dot].every(Number.isFinite)) bad++;
    if (its.length !== R.foeLeft(this)) bad++;
  }
  return realAuto.call(this);
};
for (const base of FOES) for (let i = 0; i < 25; i++) TB.simulate(mk(["warrior", "mage", "archer"][i % 3], [10, 20, 30][i % 3], base), { trySneak: false });
console.log(`plans: ${kept}/${planned} kept, ${intentsSeen} intents shown`);
ok(planned > 300, "foes plan their turns (" + planned + ")");
ok(kept / planned >= 0.97, `the foe does what its intent said (${kept}/${planned})`);
ok(intentsSeen > 300 && bad === 0, `intents and forecasts are numbers, one per foe action left (${bad} bad)`);
K.turn = realTurn; TB.Session.prototype.autoTurn = realAuto;

// ---- a wind-up is followed by the huge blow in the plan, and the plan is replaced every round
{ const f = mk("warrior", 20, { name: "Bandit", health: 260, damage: 14, tags: ["humanoid"] }); f.e.arch = "brute"; K.setup(f);
  let found = false;
  for (let i = 0; i < 200 && !found; i++) { const p = K.plan(f, 3); const w = p.findIndex((x) => x.id === "wind_up"); if (w >= 0 && w < 2) found = p[w + 1].id === "land" && p[w + 1].wind === "smash"; }
  ok(found, "after Winds up, the plan shows the Huge blow");
  f.kit.windup = "aimed"; const p = K.plan(f, 2); ok(p[0].id === "land" && p[0].wind === "aimed", "a wind-up already started lands first");
  const it = { ...R.INTENT.smash }; ok(it.big && it.mul > 1.5, "the huge blow is marked big");
}

// ---- the numbers: a plain blow lands close to what the intent says
for (const [build, L] of [["warrior", 20], ["mage", 20], ["archer", 30]]) {
  const f = mk(build, L, { name: "Bandit", health: 300, damage: 16, tags: ["humanoid"] });
  const sess = new TB.Session(f, { trySneak: false });
  const [lo, hi, mid] = R.blow(sess);
  let sum = 0, cnt = 0;
  for (let i = 0; i < 3000; i++) { f.hp = G.maxHealth(f.s); f.blocking = false; const b = f.hp; f.enemyTurnInner(); const l = b - f.hp; if (l > 0) { sum += l; cnt++; } }
  const avg = sum / cnt;
  console.log(`${build} L${L}: intent ${lo.toFixed(0)}–${hi.toFixed(0)} (mid ${mid.toFixed(0)}), real average hit ${avg.toFixed(1)}`);
  ok(avg >= mid * 0.7 && avg <= mid * 1.35, `a plain blow is close to its intent (${build})`);
}

// ---- forecast: poison on you ticks once per foe action left; burning foe shows its tick
{ const f = mk("warrior", 20, { name: "Bandit", health: 260, damage: 14, tags: ["humanoid"] });
  const sess = new TB.Session(f, { trySneak: false });
  sess.order = [{ id: "me" }, { id: "foe" }, { id: "foe2" }]; sess.idx = 0; sess.round = 1;
  f.kitDot = { name: "poison", dmg: 7, turns: 3 };
  let fc = R.forecast(sess);
  ok(fc.me.dot === 14 && fc.me.parts.some((p) => p.k === "poison" && p.n === 14), "poison: 7 a foe turn × 2 foe turns left = 14");
  f.kitDot.turns = 1; fc = R.forecast(sess); ok(fc.me.dot === 7, "poison with one tick left shows one tick");
  f.kitDot = null; f.meSt = { burn: { dmg: 5, turns: 2 } }; fc = R.forecast(sess); ok(fc.me.dot === 5, "burning on you: one tick at the end of the round");
  f.foeSt = { burn: { dmg: 9, turns: 2 } }; f.bleed = [{ dmg: 4, turns: 2 }]; fc = R.forecast(sess);
  ok(fc.foe.dot === 13 && fc.foe.parts.length === 2, "the foe's burning and bleeding show on its bar (" + fc.foe.dot + ")");
  ok(fc.me.hit > 0 && fc.intents.length === 2, "two foe actions left: two intents and blows on your bar");
  const html = R.panels(sess); ok(/tbfc/.test(html.meMarks(f.hp, G.maxHealth(f.s))) && /−13|−9/.test(html.foeLine), "bars get stripes and the foe line its numbers");
  f.tbStunLeft = 1; ok(R.intents(sess).every((x) => x.skip), "a stunned foe shows it can't act");
  f.tbStunLeft = 0; f.hp = 100; f.allies = [{ name: "Lydia", hp: 50 }]; const withAlly = R.forecast(sess).me.hit; f.allies = []; const alone = R.forecast(sess).me.hit;
  ok(withAlly < alone, "with a teammate some blows are expected to go at them");
  // the real tick matches
  const before = f.ehp; sess.lines = { me: [], them: [] }; f.dots = []; f.cloak = null; sess.endRound(); ok(Math.round(before - f.ehp) === 13, "the end of the round takes what the foe forecast said (" + Math.round(before - f.ehp) + ")");
}

// ---- my chips say what poison does
{ const f = mk("warrior", 20, { name: "Bandit", health: 260, damage: 14, tags: ["humanoid"] });
  f.kitDot = { name: "poison", dmg: 6, turns: 3 }; const h = R.myChips(f);
  ok(/Poisoned −6/.test(h) && /×3/.test(h), "your poison chip says −6 ×3: " + h.replace(/<[^>]+>/g, ""));
  ok(!K.chips(f).some((x) => x[0] === "dot"), "your poison is on your own frame, not the foe's");
}

// ---- summary, banners, delays, sounds
{ // round 1 can honestly be all misses (~20% of fights: one power attack that misses), so pick a fight where you landed a hit,
  // and separately check that an all-miss round 1 says "dealt 0"
  const hits1 = (ss) => ss.ev.filter((e) => e.round === 1 && (e.kind === "me" || e.kind === "ally") && e.dmg > 0);
  let ss = null, missed = null;
  for (let i = 0; i < 200 && (!ss || !missed); i++) {
    const t = TB.simulate(mk("warrior", 20, { name: "Bandit", health: 260, damage: 14, tags: ["humanoid"] }), { trySneak: false });
    if (!t.ev.some((e) => e.kind === "round" && e.round === 2)) continue;
    const e1 = t.ev.filter((e) => e.round === 1), foeHurt = e1[0].ehp !== e1[e1.length - 1].ehp;
    if (hits1(t).length) ss = ss || t; else if (!foeHurt) missed = missed || t;
  }
  const f = ss.f, r2 = ss.ev.find((e) => e.kind === "round" && e.round === 2);
  const landed = hits1(ss).reduce((a, e) => a + e.dmg, 0);
  const s1 = R.summary(ss, 1); ok(s1 && s1.dealt > 0 && s1.dealt >= Math.round(landed) - 1 && s1.took >= 0, "round 1 summary: dealt " + s1?.dealt + " (hits " + landed + "), took " + s1?.took);
  const ev1 = ss.ev.filter((e) => e.round === 1), st = ev1.find((e) => e.kind === "round"), en = ev1[ev1.length - 1];
  ok(s1.took === Math.round(Math.max(0, st.hp - en.hp)), "round 1 summary: took matches your health lost (" + s1.took + ")");
  if (missed) { const m1 = R.summary(missed, 1); ok(m1 && m1.dealt === 0, "a round of only misses says dealt 0 (" + m1?.dealt + ")"); }
  const b = R.banner(r2, null, ss); ok(b && b.t === "Round 2" && /dealt/.test(b.sub), "round banner with last round's numbers");
  const fe = ss.ev.find((e) => e.kind === "foe"); ok(fe.act ? /^foe act/.test(R.banner(fe, fe, ss)?.cls || "") : R.banner(fe, { kind: "me" }, ss)?.cls === "foe" && !R.banner(fe, fe, ss), "each foe move gets its own banner with its name (one at a time)");
  ok(R.delay({ kind: "foe" }) >= 900 && R.delay({ kind: "round", round: 2 }) > R.delay({ kind: "me" }), "foe turns and new rounds stay on screen longer");
  ok(R.cue({ kind: "foe", text: "Bandit lifts the weapon high, winding up a huge blow. Guard or hit them hard!" }) === "windup", "wind-up has its own sound");
  ok(R.cue({ kind: "foe", text: "Bandit hits 20" }, { kind: "me" }) === "turn-foe" && R.cue({ kind: "foe", text: "Bandit hits 20" }, { kind: "foe" }) === null, "a drum when the foe's turn starts");
  ok(R.cue({ kind: "tick", text: "🔥 the bandit burns for 9" }) === "dot-burn" && R.cue({ kind: "round", round: 3 }) === "round", "burning and new rounds sound");
  ok(fe.act ? R.who(fe, ss).includes(fe.act.name) && R.who(fe, ss).includes(ss.f.e.name) : /turn/.test(R.who(fe, ss)), "the dock says who acts and with what: " + R.who(fe, ss));
}

// ---- balance: planning ahead doesn't change how fights go
for (const base of FOES.slice(0, 4)) {
  const N = 150; let w1 = 0, w0 = 0, r1 = 0, r0 = 0;
  for (let i = 0; i < N; i++) {
    const b = ["warrior", "mage", "archer"][i % 3], L = [10, 20, 30][i % 3];
    const a = TB.simulate(mk(b, L, base), { trySneak: false }); w1 += a.f.won && a.f.hp > 0; r1 += a.round;
    const keep = c.FIGHTREAD; c.FIGHTREAD = undefined;
    try { const z = TB.simulate(mk(b, L, base), { trySneak: false }); w0 += z.f.won && z.f.hp > 0; r0 += z.round; } finally { c.FIGHTREAD = keep; }
  }
  const line = `${base.name}: win ${(w0 / N * 100).toFixed(0)}% → ${(w1 / N * 100).toFixed(0)}%, rounds ${(r0 / N).toFixed(1)} → ${(r1 / N).toFixed(1)}`;
  console.log(line);
  ok(Math.abs(w1 - w0) / N <= 0.12 && Math.abs(r1 - r0) / N <= 1.5, "same balance with intents: " + line);
}
// ---- named intents: every foe move has a name and an icon, the chip shows them, and the foe's turn says it by name
{
  for (const [k, it] of Object.entries(R.INTENT)) ok(it.ic && it.label && it.label.length >= 3 && it.label !== "Attack", `intent ${k}: icon and a real name (${it.ic} ${it.label})`);
  ok(R.blowOf(mk("warrior", 10, FOES[1]))[1] === "Bite" && R.blowOf(mk("warrior", 10, FOES[2]))[1] === "Claw Swipe" && R.blowOf(mk("warrior", 10, FOES[5]))[1] === "Spell", "a plain blow fits the foe: wolves bite, trolls swipe, necromancers cast");
  const f = mk("warrior", 20, FOES[3]), ss = new TB.Session(f, { trySneak: false }); ss.begin();
  let g = 0; while (!ss.done && g++ < 40 && !ss.ev.some((e) => e.kind === "foe" && e.act)) { const r = ss.advance(); if (r.turn === "me") ss.act("end"); }
  const its = R.intents(ss), it0 = its.find((x) => !x.skip);
  if (it0) { const h = R.panels(ss).intents; ok(h.includes(`class="w"`) && h.includes(it0.ic) && /tbint/.test(h), "intent chips show the icon and the move's name: " + h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 80)); }
  const fe = ss.ev.find((e) => e.kind === "foe" && e.act);
  ok(fe && fe.act.name && fe.act.ic && fe.text.includes(fe.act.name), "the foe's turn is logged by name: " + (fe && fe.text));
  const b = fe && R.banner(fe, null, ss); ok(b && b.t.includes(fe.act.name), "and its banner shows the move: " + (b && b.t));
  const pz = ss.ev.find((e) => e.act && e.act.stk); if (pz) ok(/^(Poison|Bleed|Burn|Winded) \d$/.test(pz.act.stk), "stacks it puts on: " + pz.act.stk);
}
console.log(fails ? `failed: ${fails}` : `fightread: all ok · ${n} checks`);
process.exit(fails ? 1 : 0);
