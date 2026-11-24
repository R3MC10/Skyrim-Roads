/* Foe intents with a target (foeintent.js): the target a foe's intent shows is the one its blow hits.
   node test_foeintent.js [runs]  — checks, then a balance table (blows on allies and win rates, targets rolled early vs. the old way).
   W=/path/to/game/ points at another game folder. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const RUNS = +(process.env.RUNS || process.argv[2] || 200);
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS, structuredClone };
vm.createContext(c);
const tbsrc = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const list = JSON.parse(tbsrc.match(/for \(const f of (\[[^\]]*"tbfight\.js"[^\]]*\])/)[1]);
const EXTRA = ["guilds.js", "priests.js", "horseback.js", "market.js", "craftfair.js", "followers2.js", "followerai.js", "combo.js", "dragons.js", "foekit.js", "fightread.js", "foeintent.js", "tbfight.js", "sharedfight.js"];
for (const f of [...new Set(list.filter((x) => x !== "foeintent.js" && x !== "tbfight.js").concat(EXTRA))]) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const helpers = tbsrc.slice(tbsrc.indexOf("const LEVELS"), tbsrc.indexOf("if (!process.env.SIMONLY)"));
vm.runInContext(helpers + `
let n = 0; const OK = (x, m) => { if (!x) { fails++; console.log("FAIL", m); } else n++; };
const hireAs = (s, id, arch) => { s.follower = { id, hp: 1, ts: G.now() }; const fo = FOL2.st(s, id); if (arch && fo.arch !== arch) FOL2.setArch(s, arch); s.follower.hp = FOL2.maxHp(s, id); return fo; };
const FI = FOEINTENT;
const mate = (pid, name, role) => { const a = COOP.allyFromCard({ id: pid, name, cur: 300, coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: role || "fighter" } } }); a.pid = pid; return a; };
/* play a whole fight, watching every foe action: what the screen showed (after the last refresh) vs. who got hit */
function play(ss, opts = {}) {
  const f = ss.f, rec = { acts: 0, same: 0, diff: [], ally: 0, re: 0, perRound: [] };
  const nx = FI.next, dn = FI.done;
  FI.next = (sess, rnd) => { if (sess === ss) { FI.refresh(sess); rec.shown = f.foeTgts && f.foeTgts[0] ? { ...f.foeTgts[0] } : null; } const d = nx(sess, rnd); if (sess === ss) rec.d = d; return d; };
  FI.done = (sess) => { if (sess === ss && f.tgtHit !== undefined) { rec.acts++; const k = FI.keyOf(f.tgtHit), d = rec.d;
      if (d && d.k === k && (!rec.shown || rec.shown.k === k || d.why)) rec.same++; else rec.diff.push({ shown: rec.shown && rec.shown.n, d: d && d.n, why: d && d.why, hit: f.tgtHit ? f.tgtHit.name : "you", foe: f.e.name, kit: f.kitLast, allies: f.allies.map((a) => a.name) });
      if (f.tgtHit) rec.ally++; if (d && d.why) rec.re++; }
    return dn(sess); };
  try {
    let r = ss.begin(), g = 0;
    while (!ss.done && g++ < 600) {
      if (opts.onRound && r.turn === "me" && ss._seenRound !== ss.round) { ss._seenRound = ss.round; opts.onRound(ss); }
      if (r.turn === "me") { r = ss.act(opts.move || "attack"); if (r.turn === "next") r = ss.advance(); continue; }
      if (r.turn === "wait") { ss.waiting.until = 0; r = ss.advance(); continue; }
      r = ss.advance();
    }
  } finally { FI.next = nx; FI.done = dn; }
  return rec;
}

if (!process.env.SIMONLY) {
  // 1. solo: every foe action goes for you, and the chips say so
  { const s = fresh("warrior", 20), f = new G.Fight(s, enc("Bandit outlaw", 20)), ss = new TB.Session(f, { trySneak: false });
    let its0 = (ss.begin(), FIGHTREAD.intents(ss));
    for (let i = 0; i < 20 && !its0.some((it) => it.tgt); i++) { const x = new TB.Session(new G.Fight(fresh("warrior", 20), enc("Bandit outlaw", 20)), { trySneak: false }); x.begin(); its0 = FIGHTREAD.intents(x); }
    OK(its0.length && its0.every((it) => !it.tgt || (it.tgt.k === "host" && it.tgt.label === "you" && it.tgt.me)), "solo: every target is you");
    OK(its0.some((it) => it.tgt) && /fitg me/.test(FI.chipHTML(its0.find((it) => it.tgt))) && /→ you/.test(FI.chipHTML(its0.find((it) => it.tgt))), "the chip reads '→ you'");
    const f2 = new G.Fight(fresh("warrior", 20), enc("Bandit outlaw", 20)); const rec = play(new TB.Session(f2, { trySneak: false }));
    OK(rec.acts > 0 && rec.same === rec.acts && rec.ally === 0, "solo: shown == hit for all " + rec.acts + " foe actions"); }

  // 2. with Lydia: target shown == target hit, over many fights (bosses too: kit moves, wind-ups, several actions a round)
  { let acts = 0, same = 0, ally = 0, re = 0, multi = 0, diffs = [];
    for (let i = 0; i < 60; i++) {
      const s = fresh(["warrior", "mage", "archer"][i % 3], 20 + (i % 3) * 10); hireAs(s, ["lydia", "jenassa", "marcurio"][i % 3]);
      const e = i % 4 === 0 ? boss(["deathlord", "chief", "centurion", "hagraven", "master", "lich"][i % 6], 30) : enc(["Bandit outlaw", "Draugr", "Frost troll", "Sabre cat", "Forsworn ambush"][i % 5], 25);
      const f = new G.Fight(s, e), ss = new TB.Session(f, { trySneak: false });
      const rec = play(ss, { onRound: (x) => { const its = FIGHTREAD.intents(x); if (its.length > 1) multi++; OK(its.length === (x.f.foeTgts || []).length, "one target per foe action this round (" + its.length + " vs " + (x.f.foeTgts || []).length + ")"); } });
      acts += rec.acts; same += rec.same; ally += rec.ally; re += rec.re; diffs = diffs.concat(rec.diff);
    }
    OK(acts > 200 && same === acts, "with a follower: shown == hit " + same + "/" + acts + (diffs.length ? " " + JSON.stringify(diffs.slice(0, 3)) : ""));
    OK(ally > 0 && ally < acts, "some blows go for the follower: " + ally + "/" + acts);
    OK(multi > 0, "rounds with several foe actions were seen: " + multi);
    console.log("  follower fights: " + acts + " foe actions, " + ally + " on the follower, " + re + " retargeted"); }

  // 3. retarget: the follower is knocked down before the blow → a new roll, shown as "down", and the blow lands on the new target
  { const s = fresh("warrior", 20); hireAs(s, "lydia"); const f = new G.Fight(s, enc("Bandit outlaw", 20)), ss = new TB.Session(f, { trySneak: false });
    ss.begin(); const Ly = f.allies.find((a) => a.follower); OK(Ly, "Lydia is in the fight");
    f.foeTgts = [{ k: FI.keyOf(Ly), n: Ly.name, kind: "follower" }];
    f.allies = f.allies.filter((a) => a !== Ly);   // engine.js: a knocked-down follower leaves the line
    OK(FI.refresh(ss) && f.foeTgts[0].why === "down" && f.foeTgts[0].from === Ly.name && f.foeTgts[0].k === "host", "Lydia down: the blow turns to you, marked as a retarget");
    const its = FIGHTREAD.intents(ss); const it = its.find((x) => x.tgt);
    OK(!it || (it.tgt.why === "down" && /fitg me re/.test(FI.chipHTML(it)) && /is down, so it turns to/.test(FI.tipText(it))), "the chip and the tip show the retarget");
    const d = FI.next(ss); f.enemyTurnInner(); const hit = f.tgtHit; FI.done(ss);
    OK(d.k === "host" && hit == null, "the blow hits you, as shown (or the foe did something else)"); }

  // 4. cover: a follower steps in front of you → the first blow at you goes to them, shown before it lands
  { const s = fresh("warrior", 20); hireAs(s, "lydia"); const f = new G.Fight(s, enc("Bandit outlaw", 20)), ss = new TB.Session(f, { trySneak: false });
    ss.begin(); const Ly = f.allies.find((a) => a.follower);
    f.kit = f.kit || {}; f.kit.plan = [{ id: "blow" }];
    f.foeTgts = [{ k: "host", n: s.name || "You", kind: "you" }]; f.coverAl = Ly;
    OK(FI.refresh(ss) && f.foeTgts[0].k === FI.keyOf(Ly) && f.foeTgts[0].why === "cover", "cover: the target moves to Lydia before the screen draws");
    const it = FIGHTREAD.intents(ss).find((x) => x.tgt);
    OK(!it || (/→ Lydia/.test(FI.chipHTML(it)) && /stepped in front/.test(FI.tipText(it))), "the chip says '→ Lydia' and why");
    const d = FI.next(ss); f.enemyTurnInner(); OK(d.k === FI.keyOf(Ly) && (f.tgtHit === Ly || f.tgtHit === undefined), "the blow hits Lydia, as shown (or the foe did something else)"); FI.done(ss); }

  // 5. wind-up: the blow that follows a wind-up keeps its target, also across rounds
  { const s = fresh("warrior", 20); hireAs(s, "lydia"); const f = new G.Fight(s, enc("Bandit outlaw", 20)), ss = new TB.Session(f, { trySneak: false });
    ss.begin(); const Ly = f.allies.find((a) => a.follower);
    let seen = 0, kept = 0;
    for (let i = 0; i < 200; i++) {
      f.kit = f.kit || {}; f.kit.plan = [{ id: "blow" }, { id: "wind_up" }];
      ss.order = [{ id: "foe" }, { id: "foe2" }]; ss.idx = 0;
      const p = FI.plan(ss); if (p.length !== 2) break;
      const w = ss.windTgt; if (!w) continue; seen++;
      f.kit.plan = [{ id: "land" }]; ss.order = [{ id: "foe" }]; ss.idx = 0;
      const p2 = FI.plan(ss); if (p2[0].k === w.k) kept++;
    }
    OK(seen > 0 && kept === seen, "a wound-up blow lands on the one it wound up at: " + kept + "/" + seen); }

  // 6. foe waves and groups (foegroups.js): each wave gets its own plan, and shown == hit holds
  { let acts = 0, same = 0, waves = 0, diffs = [];
    for (let i = 0; i < 30; i++) { const s = fresh("warrior", 20); hireAs(s, "lydia"); const e = enc(["Wolf pack", "Bandit outlaw", "Forsworn ambush"][i % 3], 20);
      const f = new G.Fight(s, e), ss = new TB.Session(f, { trySneak: false });
      const rec = play(ss); acts += rec.acts; same += rec.same; diffs = diffs.concat(rec.diff); if (ss.waves > 1) waves++; }
    OK(same === acts && acts > 50, "groups: shown == hit " + same + "/" + acts + " (" + waves + " fights with several foes)" + (diffs.length ? " " + JSON.stringify(diffs.slice(0, 3)) : "")); }

  // 7. party: players, a guard and a healer. Healers draw half the blows; a guard's step-in is part of the shown target
  { let acts = 0, same = 0, heal = 0, guard = 0, ally = 0;
    for (let i = 0; i < 30; i++) {
      const s = fresh("warrior", 25); s.id = "p1"; s.name = "Alfa";
      const f = new G.Fight(s, enc("Bandit outlaw", 25));
      const H = mate("p2", "Beta", "healer"); H.role = "healer"; f.allies.push(H);
      const Gd = mate("p3", "Ceta", "guard"); Gd.role = "guard"; f.allies.push(Gd);
      const ss = new TB.Session(f, { trySneak: false }); ss.remote = { ask() {}, end() {} };
      const nx = FI.done; FI.done = (sess) => { if (f.tgtHit === H) heal++; if (f.tgtHit === Gd) guard++; return nx(sess); };
      try { const rec = play(ss); acts += rec.acts; same += rec.same; ally += rec.ally; } finally { FI.done = nx; }
    }
    OK(acts > 50 && same === acts, "party: shown == hit " + same + "/" + acts);
    OK(heal / Math.max(1, acts) > 0.2, "healers draw a big share of the blows: " + heal + "/" + acts);
    OK(guard > 0, "the guard steps in (shown on the chip): " + guard);
    // the shared screen: Beta's phone gets the same targets, and the blow aimed at her reads "→ you" there
    let s, f, B, ss, r;
    for (let tries = 0; tries < 8; tries++) {
      s = fresh("warrior", 20); s.id = "p1"; s.name = "Alfa";
      f = new G.Fight(s, enc("Bandit outlaw", 20)); B = mate("p2", "Beta"); f.allies.push(B);
      ss = new TB.Session(f, { trySneak: false }); ss.remote = { ask() {}, end() {} };
      r = ss.begin(); let g = 0;
      while (r.turn !== "wait" && !ss.done && g++ < 60) { r = r.turn === "me" ? ss.act("end") : ss.advance(); if (r.turn === "next") r = ss.advance(); }
      if (r.turn === "wait") break;
    }
    if (r.turn === "wait") {
      f.foeTgts = [{ k: FI.keyOf(B), n: "Beta", kind: "player" }, { k: "host", n: "Alfa", kind: "you" }];
      const d = { id: "fid1", owner: "p1", ...TB.fightState(ss) };
      const s2 = fresh("mage", 20); s2.id = "p2"; s2.name = "Beta";
      const m = SHAREDFIGHT.build(s2, d, () => {});
      OK(Array.isArray(m.f.foeTgts) && m.f.foeTgts.map((x) => x.k).join() === f.foeTgts.map((x) => x.k).join(), "Beta's phone has the same targets: " + JSON.stringify(m.f.foeTgts));
      const mi = FIGHTREAD.intents(m), hi = FIGHTREAD.intents(ss);
      OK(!mi[0]?.tgt || (mi[0].tgt.label === "you" && mi[0].tgt.me), "on Beta's phone the blow at Beta reads '→ you'");
      OK(!hi[0]?.tgt || (hi[0].tgt.label === "Beta" && !hi[0].tgt.me), "on Alfa's phone it reads '→ Beta': " + JSON.stringify(hi[0]));
      OK(!mi[1]?.tgt || mi[1].tgt.label === "Alfa", "and the blow at Alfa reads '→ Alfa' on Beta's phone");
      OK(FI.refresh(m) === false && m.f.foeTgts[0].k === FI.keyOf(B), "a teammate's phone never re-rolls targets");
    } else OK(false, "the party fight reached Beta's turn"); }

  // 8. the log names who a shot or a wind-up is for
  { const ss = { tgtLast: { k: "i9", n: "Lydia" } };
    OK(FI.say(ss, "The archer takes careful aim at you...") === "The archer takes careful aim at Lydia...", "'takes aim at Lydia'");
    OK(FI.say({ tgtLast: { k: "host", n: "Alfa" } }, "aim at you") === "aim at you", "your own stays 'you'"); }
  console.log("foeintent checks: " + n + " passed");
}

// balance: blows on the follower and win rates, targets rolled when the intent shows vs. rolled when the blow lands (old way)
{
  const proto = G.Fight.prototype, inner = proto.enemyTurnInner;
  const tally = { on: { w: 0, r: 0, acts: 0, ally: 0, n: 0 }, off: { w: 0, r: 0, acts: 0, ally: 0, n: 0 } };
  let cur = null;
  proto.enemyTurnInner = function () { this.tgtHit = undefined; const t = inner.call(this); if (cur && this.tgtHit !== undefined && this.allies.length) { cur.acts++; if (this.tgtHit) cur.ally++; } return t; };
  const saved = FOEINTENT;
  for (const mode of ["off", "on"]) {
    FOEINTENT = mode === "on" ? saved : undefined; cur = tally[mode];
    for (let i = 0; i < RUNS; i++) {
      const L = [10, 25, 40][i % 3], s = fresh(["warrior", "mage", "archer", "twohand"][i % 4], L); hireAs(s, ["lydia", "jenassa", "marcurio", "brelyna"][(i >> 2) % 4]);
      const f = new G.Fight(s, i % 5 === 0 ? boss(["deathlord", "chief", "centurion", "hagraven", "master", "lich"][i % 6], L) : enc(["Bandit outlaw", "Wolf pack", "Draugr", "Forsworn ambush", "Black bear", "Sabre cat"][i % 6], L));
      const ss = TB.simulate(f, { t: G.now() }); cur.n++; if (f.won && !f.escaped) cur.w++; cur.r += ss.round;
    }
  }
  FOEINTENT = saved; proto.enemyTurnInner = inner;
  const row = (k) => { const t = tally[k]; return k.padEnd(4) + " win " + (100 * t.w / t.n).toFixed(1) + "%  rounds " + (t.r / t.n).toFixed(2) + "  blows on the follower " + (100 * t.ally / Math.max(1, t.acts)).toFixed(1) + "% of " + t.acts; };
  console.log("balance (" + RUNS + " fights each, with a follower):"); console.log("  " + row("off")); console.log("  " + row("on"));
  const a = tally.on.ally / Math.max(1, tally.on.acts), b = tally.off.ally / Math.max(1, tally.off.acts);
  if (RUNS >= 100) OK(Math.abs(a - b) < 0.05, "the follower's share of blows doesn't move: " + (100 * b).toFixed(1) + "% → " + (100 * a).toFixed(1) + "%");
  if (RUNS >= 100) OK(Math.abs(tally.on.w - tally.off.w) / RUNS < 0.08, "win rate doesn't move: " + tally.off.w + " → " + tally.on.w);
}
console.log(fails ? fails + " FAILED" : "all ok");
globalThis.__fails = fails;
`, c);
if (c.__fails) process.exitCode = 1;
