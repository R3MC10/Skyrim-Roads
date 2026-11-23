// Dragons (dragons.js + the dragon raid in wevents.js): kinds, flying and landing, stance attacks, the gather timer,
// health that grows with the number of heroes, fleeing, and a balance sim for raid fights. node test_dragons.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10, structuredClone });
// the same game files and hero builds as the turn-based balance sim (test_tbfight.js), plus dragons.js
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).filter((f) => f !== "tbfight.js").concat(["dragons.js", "tbfight.js"]);
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log("FAIL", m); } };
const { G, D, DRAGONS: DR, TB, WEVENTS: WE } = c;

// ---- kinds
ok(DR.KINDS.length >= 5, "several kinds of dragon");
ok(DR.kindOf({ name: "Blood Dragon" }, 50).id === "blood" && DR.kindOf({ name: "Frost dragon" }, 1).id === "frost", "the name says the kind");
{ const seen = new Set(); for (let i = 0; i < 300; i++) seen.add(DR.kindOf({ name: "Dragon" }, 5).id);
  ok(!seen.has("ancient") && !seen.has("legendary") && seen.size >= 2, "low level: only the weaker kinds " + [...seen]);
  const hi = new Set(); for (let i = 0; i < 600; i++) hi.add(DR.kindOf({ name: "Dragon" }, 55).id);
  ok(hi.has("legendary") && hi.size >= 6, "high level: all kinds " + [...hi]); }

function hero(L, build = "warrior") { const s = c.make(build, L); s.location = "Whiterun"; s.health = G.maxHealth(s); s.healthTs = G.now(); return s; }
const dragonFoe = (s, extra = {}) => { const e = G.scaleEnemy({ name: "Dragon", health: 700, damage: 30, tags: ["big", "dragon", "elite"], level: 40, danger: "high", gold: [0, 0], text: "", ...extra }, s.level); return e; };
const play = (ss) => { ss.begin(); let g = 0; while (!ss.done && g++ < 600) { const r = ss.advance(); if (r?.turn === "me") ss.autoTurn(); } };

// ---- in the air at first; melee only grazes it; it lands below 35%
{ const s = hero(20), f = new G.Fight(s, dragonFoe(s)); f.allies = [];
  const ss = new TB.Session(f, { trySneak: false });
  delete s.perks.critical_charge; delete s.perks.great_critical_charge; delete s.perks.eagle_eye;   // the plain rules first; perks below
  ok(f.dStance === "air", "a dragon starts in the air");
  ok(ss.ev.some((e) => /circles overhead/.test(e.text)), "the log says it's flying");
  ok(c.FIGHTART === undefined || true, "art optional in node");
  // a melee hit on a flyer is cut in half
  const before = f.ehp; f.ehp = before - 100; const t = DR.graze(f, "attack", before);
  ok(Math.abs(before - f.ehp - 100 * DR.AIR_MELEE) < 1e-6 && /graze/.test(t), "melee only grazes a flying dragon");
  f.wt = "bow"; const b2 = f.ehp; f.ehp -= 100; ok(DR.graze(f, "attack", b2) === "" && Math.abs(b2 - f.ehp - 100 * DR.AIR_ARROW) < 1e-6, "arrows hit a flyer for most of their damage"); f.wt = "sword";
  // perks: Critical Charge lets you leap at it, Eagle Eye keeps your arrows on it
  { const b4 = f.ehp; f.s.perks.critical_charge = 1; f.ehp -= 100; DR.graze(f, "attack", b4); ok(Math.abs(b4 - f.ehp - 80) < 1e-6, "Critical Charge: melee loses only 20% on a flyer"); delete f.s.perks.critical_charge;
    f.wt = "bow"; f.s.perks.eagle_eye = 1; const b5 = f.ehp; f.ehp -= 100; DR.graze(f, "attack", b5); ok(b5 - f.ehp === 100, "Eagle Eye: arrows hit a flyer fully"); delete f.s.perks.eagle_eye; f.wt = "sword"; }
  f.ehp = ss.ehpMax * 0.5; DR.check(f, ss); ok(f.dStance === "air", "still flying at half health");
  f.ehp = ss.ehpMax * 0.3; DR.check(f, ss); ok(f.dStance === "ground", "lands below 35%");
  ok(ss.ev.some((e) => /crashes to the ground/.test(e.text)), "the log says it landed");
  const b3 = f.ehp; f.ehp -= 50; ok(DR.graze(f, "attack", b3) === "" && b3 - f.ehp === 50, "on the ground melee lands fully"); }

// ---- Dragonrend brings it down at once
{ const s = hero(30), f = new G.Fight(s, dragonFoe(s)); f.allies = [];
  const ss = new TB.Session(f, { trySneak: false });
  if (!f.pw) f.pw = {}; f.pw.rend = 0.25; DR.check(f, ss);
  ok(f.dStance === "ground" && ss.ev.some((e) => /Dragonrend/.test(e.text)), "Dragonrend forces it to land"); }

// ---- stance attacks: air moves while flying, ground moves after it lands
{ const air = new Set(), ground = new Set();
  for (let i = 0; i < 60; i++) {
    const s = hero(25), f = new G.Fight(s, dragonFoe(s)); f.allies = []; const ss = new TB.Session(f, { trySneak: false });
    const t1 = DR.turn(f, () => f.enemyTurn()); air.add(/breath rains|dives|circles/.test(t1) ? t1.match(/breath rains|dives|circles/)[0] : "plain");
    f.dStance = "ground"; G.setHealth(s, G.maxHealth(s)); f.hp = G.maxHealth(s);
    const t2 = DR.turn(f, () => f.enemyTurn()); ground.add((t2.match(/jaws|Tail swipe|Wing buffet|short blast/) || ["plain"])[0]); }
  ok(air.has("breath rains") && air.has("dives") && air.has("circles"), "flying moves: " + [...air]);
  ok(ground.has("jaws") && ground.has("Tail swipe") && (ground.has("Wing buffet") || ground.has("short blast")), "ground moves: " + [...ground]);
  ok(![...air].some((m) => /jaws|Tail/.test(m)), "no tail swipes from the sky"); }

// ---- circling does no damage; tail swipe hits harder than a plain blow on average
{ let circ = 0, dmgPlain = 0, dmgTail = 0, nP = 0, nT = 0;
  for (let i = 0; i < 400; i++) {
    const s = hero(25), f = new G.Fight(s, dragonFoe(s)); f.allies = []; new TB.Session(f, { trySneak: false });
    const h0 = f.hp; const t = DR.turn(f, () => f.enemyTurn()); if (/circles/.test(t)) { circ++; ok(f.hp === h0, "circling does no damage"); }
    f.dStance = "ground"; f.hp = G.maxHealth(s); const h1 = f.hp, t2 = DR.turn(f, () => f.enemyTurn());
    if (/Tail swipe/.test(t2)) { dmgTail += h1 - f.hp; nT++; }
    f.dStance = null; f.hp = G.maxHealth(s); const h2 = f.hp; f.enemyTurn(); dmgPlain += h2 - f.hp; nP++; }
  ok(circ > 20, "it sometimes circles out of reach: " + circ);
  ok(nT > 20 && dmgTail / nT > dmgPlain / nP, `tail swipe hits harder (${(dmgTail / nT).toFixed(1)} vs ${(dmgPlain / nP).toFixed(1)})`); }

// ---- no soul for a dragon that only flew off
{ const s = hero(20); s._test = false; const f = new G.Fight(s, dragonFoe(s)); f.won = true; f.endWon = true; f.escaped = true; f.ehp = 100; f.hp = 50;
  const souls = s.souls || 0; f.apply(); ok((s.souls || 0) === souls, "no soul when it only flies off"); }

// ---- the raid: gather timer, everyone present counts, health grows with heroes, kind is the same for everyone
{ const r = WE.nextRaid(G.now());
  ok(r.fightAt === r.start + WE.GATHER && r.fightAt < r.end, "a raid starts with a gather timer");
  ok(WE.phase(r, r.start + 10) === "gather" && WE.phase(r, r.fightAt + 1) === "fight" && WE.phase(r, r.end + 1) === "gone", "phases: gather, fight, gone");
  ok(DR.BY[r.kind] && WE.kindOf(r).id === r.kind, "every raid has a dragon kind: " + r.kind);
  const kinds = new Set(); for (let i = 0; i < 40; i++) kinds.add(WE.nextRaid(G.now() + i * 3 * 3600).kind);
  ok(kinds.size >= 3, "raids bring different kinds: " + [...kinds]);
  const s = hero(20); s.location = r.town;
  const o = WE.fight(s, r, [], r.start + 30); ok(!o.fight && /circling/.test(o.text), "no fight while it circles: " + o.text);
  const away = hero(20); away.location = "Nowhere"; ok(!WE.join(away, r), "you must be in the town to join");
  ok(WE.join(s, r) && s.raid.id === r.id && s.raid.dmg === 0, "being in the town counts you in");
  const docs = [{ raid: r.id, uid: "b", name: "Bo", dmg: 0 }, { raid: r.id, uid: "c", name: "Cy", dmg: 0 }];
  const tl = WE.tally(r, docs, s); ok(tl.people === 3, "everyone gathered counts, even before hitting: " + tl.people);
  const hp = WE.kindOf(r).hp;
  ok(WE.needed(1, r) === Math.round(WE.SOLO_HP * WE.lvF(10) * hp), "solo health");
  ok(WE.needed([35], r) > WE.needed([10], r) && WE.needed([20, 20, 20], r) > WE.needed([20, 20], r), "stronger and more heroes make it tougher");
  const per = [1, 2, 4, 8, 20, 60].map((n) => WE.needed(n, r) / n);
  ok(per.every((v, i) => i === 0 || v <= per[i - 1]) && per[per.length - 1] >= WE.PER_HERO * WE.lvF(10) * hp * 0.99, "each hero's share shrinks a little as more come, no player limit: " + per.map(Math.round));
  // a fight after the timer (auto mode in node): it uses the shared health and the kind's name
  G.setHealth(s, G.maxHealth(s)); const f1 = WE.fight(s, r, docs, r.fightAt + 60);
  ok(f1.fight && new RegExp(WE.kindOf(r).name, "i").test(f1.fight.e.name), "the fight names the kind: " + f1.fight?.e.name);
  ok(f1.fight.e.pool === WE.tally(r, docs, s).need, "the dragon knows its whole health (for landing)");
  ok(f1.dealt >= 0 && s.raid.dmg === f1.dealt, "your damage adds to the shared tally"); }

// ---- balance: raid dragon fights, turn by turn, solo and in a crowd (shared health, 8 rounds a fight)
{ const rows = [];
  for (const [L, build] of [[10, "warrior"], [20, "warrior"], [20, "archer"], [35, "warrior"]]) {
    let dealt = 0, deaths = 0, fights = 0, landed = 0, rounds = 0, unboosted = true; const N = 30;
    for (let i = 0; i < N; i++) {
      const s = hero(L, build), need = WE.needed([L], { kind: "dragon" });
      const e = G.scaleEnemy({ name: "Dragon over Whiterun", health: need, damage: 30, tags: ["big", "dragon", "elite"], level: 40, danger: "high", gold: [0, 0], text: "" }, s.level);
      e.health = need; e.hp = need; e.pool = need; e.dKind = "dragon";
      const f = new G.Fight(s, e); f.allies = [];
      const ss = new TB.Session(f, { trySneak: false, maxTurns: WE.RAID_ROUNDS });
      if (f.ehp !== need) unboosted = false;
      play(ss); fights++; rounds += Math.min(ss.round, WE.RAID_ROUNDS);
      dealt += need - Math.max(0, f.ehp); if (f.hp <= 0) deaths++; if (f.dStance === "ground") landed++;
    }
    ok(unboosted, "a raid dragon's health isn't boosted (it's shared)");
    rows.push({ L, build, rounds: (rounds / fights).toFixed(1), perFight: Math.round(dealt / fights), deaths: Math.round(100 * deaths / fights) + "%", landed: Math.round(100 * landed / fights) + "%" });
    const pf = dealt / fights, solo = WE.needed([L], { kind: "dragon" });
    ok(pf > solo * 0.12, `L${L} ${build}: a fight does real damage (${Math.round(pf)} of ${solo})`);
    ok(build === "archer" ? pf <= solo : pf < solo * 0.95, `L${L} ${build}: solo it takes at least one whole fight (archers are the dragon hunters)`);
    ok(rounds / fights >= 5, `L${L} ${build}: no quick kills (${(rounds / fights).toFixed(1)} rounds)`);
    ok(deaths / fights < 0.5, `L${L} ${build}: you don't die most of the time (${deaths}/${fights})`);
  }
  console.log(rows.map((r) => `L${r.L} ${r.build}: ${r.perFight} dmg/fight, ${r.deaths} die, ${r.landed} land, ${r.rounds} rounds`).join("\n")); }

// ---- fleeing a raid dragon: much easier than other dangerous foes
{ let got = 0;
  for (let i = 0; i < 300; i++) { const s = hero(15), e = dragonFoe(s); e.pool = 600; const f = new G.Fight(s, e); f.allies = []; const ss = new TB.Session(f, { trySneak: false, maxTurns: 8 });
    ss.begin(); let g = 0; while (ss.cur?.id !== "me" && !ss.done && g++ < 20) ss.advance(); if (ss.done) continue; ss.act("flee"); if (f.ranAway) got++; }
  ok(got > 120, "you can usually flee a raid dragon: " + got + "/300"); }

console.log(fails ? `FAILED ${fails}` : "dragons ok");
process.exit(fails ? 1 : 0);
