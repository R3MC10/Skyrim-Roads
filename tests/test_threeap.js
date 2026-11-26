// 3 AP a turn (build 350; replaces test_noap.js). Most moves take 1 AP, heavy ones 2; unspent AP become guard (10% each,
// up to 30%) until that hero's next turn; a move whose target is gone costs nothing; followers have 2 AP; the leader's
// phone has the last word on a teammate's AP; dual wielding never doubles poison, bleeding or enchantments; no
// player-facing text still talks about "moves a turn". A short seeded Auto run checks the AP rules hold in real fights.
// node test_threeap.js — prints "threeap ok (N checks)". The long balance sims live outside CI (see the PR).
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 1, structuredClone });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).filter((f) => f !== "tbfight.js" && f !== "foeintent.js")
  .concat(["difficulty.js", "dragons.js", "foekit.js", "fightread.js", "foeintent.js", "strategy.js", "reactions.js", "followerai.js", "initiative.js", "tbfight.js", "bossfight.js"]);
for (const f of [...new Set(FILES)]) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const g_ = (k) => vm.runInContext(`typeof ${k} !== "undefined" ? ${k} : undefined`, c);
const { G, TB, D } = c, COOP = g_("COOP");
let seed = 7; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
Math.random = rnd;
const eqOf = (s) => G.loadout(s).equipment;
const AP_PERKS = ["heavy_momentum", "flowing_strikes", "quick_draw", "spell_weaving", "swift_mending", "steady_guard"];
const fresh = (b, L) => { const s = c.make(b, L); for (const p of AP_PERKS) delete s.perks[p]; s.health = G.maxHealth(s); s.healthTs = G.now(); return s; };
const enc = (name, L) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, L);
const tierOf = (id) => D.SPELLS[id]?.level || (g_("TOMES") && g_("TOMES").level ? g_("TOMES").level(id) : "Novice");
const BIG = ["Adept", "Expert", "Master"];
/* your own turn, ready to act: full stamina and magicka, nothing spent */
function myTurn(s, foeName = "Bandit outlaw") {
  const f = new G.Fight(s, enc(foeName, s.level)); f.allies = [];
  const ss = new TB.Session(f, { trySneak: false }); ss.begin();
  let g = 0; while (ss.cur?.id !== "me" && !ss.done && g++ < 40) ss.advance();
  const prep = () => { f.sp = 9999; f.mp = 9999; f.ehp = 99999; ss.myActs = 0; ss.used = {}; ss.pots = 0; };
  prep(); return { f, ss, prep };
}

// 1. the numbers
ok(TB.AP === 3 && TB.MAX_ACTS === 3, "3 AP a turn: " + TB.AP + "/" + TB.MAX_ACTS);
ok(TB.MAX_POTS === 1, "one potion a turn");
ok(TB.GUARD_AP === 0.1 && TB.GUARD_MAX === 0.3, "guard: 10% per AP kept, 30% at most");

// 2. what each move takes
{ const s = fresh("spellsword", 30), { f, ss } = myTurn(s);
  const ap = (a) => TB.cost(f, a, ss).acts;
  for (const a of ["attack", "block", "bash", "potion:health", "recover", "poison:x", "oil:x", "mark", "rx:cover", "beast:howl", "lord:bats"]) ok(ap(a) === 1, a + " takes 1 AP, got " + ap(a));
  for (const a of ["power_attack", "beast:maul", "beast:feast", "lord:grip", "lord:raise"]) ok(ap(a) === 2, a + " takes 2 AP, got " + ap(a));
  ok(ap("end") === 0 && ap("flee") === 0, "End turn and Run cost no AP");
  const minor = Object.keys(D.SPELLS).find((id) => D.SPELLS[id].kind === "damage" && !BIG.includes(tierOf(id)));
  const major = Object.keys(D.SPELLS).find((id) => D.SPELLS[id].kind === "damage" && BIG.includes(tierOf(id)));
  ok(minor && ap("spell:" + minor) === 1, "a minor spell (" + minor + ", " + tierOf(minor) + ") takes 1 AP");
  ok(major && ap("spell:" + major) === 2, "a major spell (" + major + ", " + tierOf(major) + ") takes 2 AP");
  ok(ap("dual:" + minor) === 2, "a dual cast takes 2 AP");
  const scr = (big) => Object.keys(D.ITEMS).find((id) => D.ITEMS[id].slot === "scroll" && D.SPELLS[D.ITEMS[id].spell] && BIG.includes(tierOf(D.ITEMS[id].spell)) === big);
  if (scr(false)) ok(ap("scroll:" + scr(false)) === 1, "a minor scroll takes 1 AP");
  if (scr(true)) ok(ap("scroll:" + scr(true)) === 2, "a big scroll takes 2 AP");
  const P = g_("POWERS"), lv0 = P.level; const sid = Object.keys(P.SHOUTS)[0];
  for (const [w, want] of [[1, 1], [2, 1], [3, 2]]) { P.level = () => w; ok(ap("shout:" + sid) === want, `a ${w}-word shout takes ${want} AP`); }
  P.level = lv0;
  // with 1 AP left a 2 AP move can't be paid, a 1 AP one can
  ss.myActs = 2; ok(!ss.canAfford("power_attack") && /Needs 2 AP/.test(ss.why("power_attack")), "1 AP left: no power attack (" + ss.why("power_attack") + ")");
  ok(ss.canAfford("attack"), "1 AP left: a plain blow is fine");
  ss.myActs = 3; ok(!ss.canAfford("attack") && ss.why("attack") === "No AP left", "no AP left: " + ss.why("attack"));
  ss.myActs = 0; ss.pots = 1; ok(!ss.canAfford("potion:health") && /1 potion a turn/.test(ss.why("potion:health")), "one potion a turn"); }

// 3. the perks: once a fight, a heavy move for 1 AP
{ const s = fresh("twohand", 30); s.perks.heavy_momentum = 1;
  const { f, ss, prep } = myTurn(s);
  ok(TB.cost(f, "power_attack", ss).acts === 1, "Heavy Momentum: the first power attack takes 1 AP");
  ss.act("power_attack"); ok(ss.myActs === 1, "and only 1 AP was spent: " + ss.myActs);
  prep(); ok(TB.cost(f, "power_attack", ss).acts === 2, "the next one takes 2 again (once a fight)");
  const s2 = fresh("mage", 30); s2.perks.spell_weaving = 1; const t2 = myTurn(s2);
  const big = s2.spells.find((id) => BIG.includes(tierOf(id)) && D.SPELLS[id].kind === "damage") || s2.spells.find((id) => BIG.includes(tierOf(id)));
  if (big) { ok(TB.cost(t2.f, "spell:" + big, t2.ss).acts === 1, "Spell Weaving: the first big spell takes 1 AP"); t2.ss.act("spell:" + big); t2.prep(); ok(TB.cost(t2.f, "spell:" + big, t2.ss).acts === 2, "then 2 again"); }
  for (const id of ["heavy_momentum", "flowing_strikes", "quick_draw", "spell_weaving", "swift_mending", "steady_guard"]) ok(g_("PERKS").BY_ID && g_("PERKS").BY_ID[id], "perk exists: " + id); }

// 4. guard from AP you keep, until your next turn
{ const s = fresh("warrior", 20);
  for (const [k, g] of [[0, 0], [1, 0.1], [2, 0.2], [3, 0.3], [7, 0.3], [-2, 0]]) ok(Math.abs(TB.guardFor(s, k) - g) < 1e-9, `${k} AP kept: ${g * 100}% guard, got ${TB.guardFor(s, k)}`);
  const s2 = fresh("warrior", 20); s2.perks.steady_guard = 1; ok(Math.abs(TB.guardFor(s2, 3) - 0.4) < 1e-9 && Math.abs(TB.guardFor(s2, 1) - 0.15) < 1e-9, "Steady Guard: +5% per AP kept, up to 40%");
  const { f, ss } = myTurn(s);
  ss.act("attack"); ss.act("end"); ok(Math.abs(f.tbGuard - 0.2) < 1e-9, "1 AP spent, 2 kept: 20% guard: " + f.tbGuard);
  const hp = 99999; f.hp = hp; ss.foeAct(""); ss.foeAct(""); ok(Math.abs(f.tbGuard - 0.2) < 1e-9, "the guard holds through both of a fast foe's turns: " + f.tbGuard);
  ss.beginTurn(); ok(!f.tbGuard, "and goes away when your next turn starts"); }

// 5. a move whose target went away costs nothing
{ const s = fresh("warrior", 20), { f, ss } = myTurn(s);
  ss.reserve("attack"); ss.wave = (ss.wave || 1) + 1; const sp0 = f.sp, n0 = ss.myActs;
  const r = ss.act("attack"); ok(r && r.free && ss.myActs === n0 && f.sp === sp0, "the foe you swung at is gone: no AP, no stamina: " + JSON.stringify(r));
  ok(ss.held === null, "the held move is let go");
  const A = COOP.allyFromCard({ id: "p2", name: "Alpha", coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: "fighter" } } }); f.allies.push(A); A.down = true;
  ss.reserve("potion:health", "0"); const p0 = ss.pots, r2 = ss.act("potion:health", "0");
  ok(r2 && r2.free && ss.pots === p0 && ss.myActs === n0, "the friend you were helping is down: the potion stays, no AP");
  ss.release(); ok(ss.held === null, "release lets go"); }

// 6. dual wielding: one AP, a blow and a left-hand follow-up, but poison, bleeding and enchantments land once
{ const s = fresh("warrior", 25); if (eqOf(s).shield != null) G.unequip(s, "shield");
  const main = G.invRow(s, eqOf(s).weapon); const id = G.give(s, main.item); G.equipOff(s, id === main.id ? G.give(s, "iron_dagger") : id);
  const { f, ss, prep } = myTurn(s);
  ok(!!f.off, "fighting with two blades");
  ok(TB.cost(f, "attack", ss).acts === 1, "a two-blade attack is still 1 AP");
  let enchCalls = 0; const E = g_("ENCH"), eh0 = E && E.onHit; if (E && eh0) E.onHit = function () { enchCalls++; return eh0.apply(this, arguments); };
  if (f.weapon) f.weapon = { ...f.weapon, enchant: f.weapon.enchant || { effect: "Fire Damage", magnitude: 5, charge: 999 } };
  let left = 0, worst = 0, worstEnch = 0;
  for (let i = 0; i < 30; i++) {
    prep(); s.poison = { name: "Test poison", effects: [["Damage Health", 6, 0], ["Lingering Damage Health", 3, 6]], hits: 5 };
    const b0 = f.bleed.length, e0 = enchCalls;
    const t = ss.act(i % 3 ? "attack" : "power_attack");
    if (/left hand \d+/.test((t && t.text) || ss.ev[ss.ev.length - 1]?.text || "")) left++;
    worst = Math.max(worst, f.bleed.length - b0, 5 - (s.poison ? s.poison.hits : 0)); worstEnch = Math.max(worstEnch, enchCalls - e0);
  }
  if (E && eh0) E.onHit = eh0;
  ok(left > 0, "the left hand follows up (" + left + "/30)");
  ok(worst <= 2, "poison: one coat used per attack, at most one bleed per source, never doubled by the left hand (worst " + worst + ")");
  ok(worstEnch <= 1, "the enchantment fires at most once per attack (worst " + worstEnch + ")"); }

// 7. followers: 2 AP a turn
{ const s = fresh("warrior", 20); s.follower = { id: "lydia", hp: g_("TOWNS").followerMax(s, "lydia"), ts: G.now() };
  const f = new G.Fight(s, enc("Bandit outlaw", 20)), al = f.allies.find((x) => x.follower);
  if (al && al.fai) ok(al.ap === 2, "a follower has 2 AP: " + al.ap); }

// 8. the leader's phone has the last word: random teammate replies can't buy more than 3 AP or more guard than they kept
{ const s = fresh("warrior", 20), f = new G.Fight(s, enc("Bandit outlaw", 20));
  const mate = COOP.allyFromCard({ id: "p2", name: "Beta", coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: "fighter" } } }); mate.pid = "p2"; f.allies.push(mate);
  const ss = new TB.Session(f, { trySneak: false }); ss.remote = { ask() {}, end() {} }; ss.begin();
  const acts = ["attack", "power_attack", "spell:flames", "dual:flames", "potion:health", "bash", "end", "block"];
  let bad = 0, first = "";
  for (let i = 0; i < 3000; i++) {
    const nm = Math.floor(rnd() * 7), ev = Array.from({ length: nm }, () => ({ text: "x", a: acts[Math.floor(rnd() * acts.length)], dmg: 5 }));
    const apv = [Math.floor(rnd() * 9) - 3, NaN, "x", Infinity, -Infinity, 2.5, undefined][Math.floor(rnd() * 7)];
    const r = { wave: ss.wave, e0: 1000, ehp: 1000 - Math.floor(rnd() * 900), hp0: 100, hp: 100, guard: rnd() * 3 - 0.5, ap: apv, ev };
    f.ehp = 5000; mate.down = false; mate.hp = 300; const e0 = f.ehp;
    ss.applyRemote(mate, r);
    const moves = ev.filter((e) => e.a && e.a !== "end" && e.a !== "flee").length, spent = Math.max(0, +apv || 0, moves);
    const kept = 3 - Math.min(3, spent), maxG = 0.1 * kept + Math.min(0.1, 0.05 * kept), dealt = e0 - f.ehp, maxD = (r.e0 - r.ehp) * (spent > 3 ? 3 / spent : 1);
    const bad1 = !(mate.tbGuard >= 0 && mate.tbGuard <= Math.min(0.4, maxG) + 1e-9) || !(dealt >= -1e-9 && dealt <= maxD + 1e-6) || Number.isNaN(f.ehp);
    if (bad1) { bad++; if (!first) first = JSON.stringify({ apv: String(apv), moves, guard: r.guard, got: mate.tbGuard, dealt, maxD }); }
  }
  ok(bad === 0, "3000 random teammate replies: no AP or guard beyond the rules (" + bad + " bad; first " + first + ")"); }

// 9. random tapping on your own turn never spends more than 3 AP or drinks 2 potions
{ let over = 0, pots = 0, guard = 0;
  for (const b of ["warrior", "mage", "archer", "spellsword", "twohand"]) {
    const s = fresh(b, 30); G.give(s, "potion_health", 10); const { f, ss } = myTurn(s);
    const pool = ["attack", "power_attack", "block", "bash", "potion:health", "recover", ...s.spells.slice(0, 12).map((id) => "spell:" + id), ...s.spells.slice(0, 4).map((id) => "dual:" + id)];
    for (let i = 0; i < 400 && !ss.done; i++) {
      if (ss.cur?.id !== "me") { ss.advance(); continue; }
      f.sp = 9999; f.mp = 9999; f.ehp = 99999; f.hp = G.maxHealth(s);
      const a = rnd() < 0.12 ? "end" : pool[Math.floor(rnd() * pool.length)];
      try { ss.act(a); } catch (e) { /* the move itself may refuse; the rules are what we check */ }
      if (ss.myActs > 3) over++; if (ss.pots > 1) pots++; if ((f.tbGuard || 0) > 0.4 + 1e-9) guard++;
    }
  }
  ok(!over && !pots && !guard, `random tapping: AP over 3 ${over}x, 2nd potion ${pots}x, guard over 40% ${guard}x`); }

// 10. a short seeded Auto run: real fights end, nobody spends more than 3 AP, a useful attack is (nearly) always there
{ let turns = 0, noAtk = 0, over = 0, errs = 0, done = 0, total = 0;
  const P = TB.Session.prototype, bt = P.beginTurn, pay = P.pay;
  P.pay = function () { const r = pay.apply(this, arguments); if (this.myActs > 3) over++; return r; };
  P.beginTurn = function () { const r = bt.apply(this, arguments); turns++; const s = this.f.s;
    if (!(["attack", "power_attack", "bash"].some((a) => this.canAfford(a)) || (s.spells || []).some((id) => D.SPELLS[id]?.kind === "damage" && this.canAfford("spell:" + id)))) noAtk++; return r; };
  for (const b of ["warrior", "twohand", "archer", "mage", "spellsword"]) for (const foe of ["Bandit outlaw", "Frost troll"]) for (let i = 0; i < 3; i++) {
    total++; try { const s = fresh(b, 20), f = new G.Fight(s, enc(foe, 20)), ss = TB.simulate(f, { trySneak: false }); if (ss.done) done++; } catch (e) { errs++; if (errs < 3) console.log(e.stack); }
  }
  P.pay = pay; P.beginTurn = bt;
  ok(!errs && done === total, `Auto fights finish (${done}/${total}, ${errs} errors)`);
  ok(!over, "Auto never spends more than 3 AP (" + over + ")");
  ok(noAtk / Math.max(1, turns) < 0.15, `turns with no attack you can pay for: ${Math.round(100 * noAtk / Math.max(1, turns))}% (under 15%)`); }

// 11. no player-facing English text still talks about moves a turn
const OLD = /\b\d moves? a turn|\b4 moves\b|few moves|moves you (don't|didn't) make|unused moves|\(one move\)|one move goes|Takes \$\{[^}]+\} moves|used all your moves|1 move, free/;
for (const fl of fs.readdirSync(W).filter((x) => x.endsWith(".js") && !/^(patchnotes|i18n)/.test(x))) {
  fs.readFileSync(W + fl, "utf8").split("\n").forEach((l, i) => {
    const code = l.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    for (const q of code.match(/(["'`])(?:\\.|(?!\1).)*\1/g) || []) ok(!OLD.test(q), `${fl}:${i + 1} still talks about moves: ${q.slice(0, 100)}`);
  });
}
// ...and the new lines have Polish
{ const pl = fs.readFileSync(W + "i18n_threeap.js", "utf8");
  for (const t of ["No AP left", "1 potion a turn", "AP spent", "Your target is already down: that move cost nothing", "You get back on your feet (1 AP)", "Knocked down: 1 AP goes into getting up",
    "End your turn. AP you didn't spend become guard: 10% less damage each, up to 30%, until your next turn.", "Heavy Momentum", "Steady Guard"]) ok(pl.includes(JSON.stringify(t)), "Polish for " + t);
  const html = fs.readFileSync(W + "index.html", "utf8"); ok(html.indexOf("i18n_threeap.js") > 0 && html.indexOf("i18n_threeap.js") < html.indexOf('src="i18n.js"'), "i18n_threeap.js loads before i18n.js"); }

console.log(fails ? `threeap: ${fails} of ${n} failed` : `threeap ok (${n} checks)`);
process.exit(fails ? 1 : 0);
