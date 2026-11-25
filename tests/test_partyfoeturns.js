/* Foes take their turns in party fights (tbfight.js + sharedfight.js). [partyfoeturns]
   Owner: "enemies in a party should also take turns".
   Party fights with 2, 3, 4 and 8 heroes: the leader's phone runs the fight, every teammate plays real turns on their
   own phone (a sharedfight.js Mirror built from the leader's record). The teammates' phones only read the record when
   their own turn comes, the worst case (a busy phone that missed records in between). Checks:
   - every round, every one of the foe's moves in the turn order is played (a fast foe still acts 2+ times a round)
   - the foe's moves are numbered in the order they happen (its "2nd move" chip never sits before its 1st)
   - the move's name says who it goes for, and that is who it hits ("Heavy Swing → you" used to hit a teammate)
   - every teammate's screen gets every foe move, in the same rounds, and the same foe health as the leader
   - balance: party fights last a sensible number of rounds
   W=/path/to/game/ node test_partyfoeturns.js   (N=fights per party size, default 6) */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
let seed = 12345;
const M = Object.create(Math); M.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
const c = { console, Math: M, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, process, structuredClone };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {}, removeItem() {} };
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
const { G, TB, SHAREDFIGHT, COOP } = c;
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const N = +(process.env.N || 6);
ok(TB && SHAREDFIGHT && COOP, "tbfight.js, sharedfight.js and coop.js loaded");

const BUILDS = ["warrior", "mage", "archer", "twohand", "spellsword"];
const FOES = [{ name: "Bandit outlaw", health: 60, damage: 10, tags: ["humanoid"] }, { name: "Draugr", health: 70, damage: 11, tags: ["undead"] }, { name: "Frost troll", health: 200, damage: 24, tags: ["beast", "elite"] }];
/* one party fight; returns what happened */
function partyFight(np, L, foeBase) {
  const s = c.make(BUILDS[0], L); s.id = "p1"; s.name = "Alfa"; s.health = G.maxHealth(s);
  const foe = G.scaleEnemy({ ...foeBase, tags: [...foeBase.tags], level: L, gold: [0, 0], text: "" }, L);
  const f = new G.Fight(s, foe); f.allies = [];
  const mates = [];
  for (let i = 2; i <= np; i++) {
    const sx = c.make(BUILDS[(i - 1) % BUILDS.length], L); sx.id = "p" + i; sx.name = ["Beta", "Ceta", "Dita", "Ema", "Fila", "Gosia", "Hela"][i - 2];
    const al = COOP.allyFromCard({ id: sx.id, name: sx.name, cur: G.maxHealth(sx), coop: { prof: COOP.profile(sx) } }); al.pid = sx.id; f.allies.push(al);
    mates.push({ s: sx, al, m: null });
  }
  const ss = new TB.Session(f, { trySneak: false }); ss.remote = { ask() {}, end() {}, live: () => true };
  const doc = () => ({ id: "fid", owner: "p1", ...TB.fightState(ss) });
  let r = ss.begin(), g = 0;
  while (!ss.done && g++ < 3000) {
    if (r.turn === "me") { const d = doc(); for (const x of mates) if (x.m) x.m.sync(d); ss.autoTurn(); r = ss.advance(); continue; }
    if (r.turn === "wait") {
      // every phone hears the leader only when someone's turn starts (the records in between are missed)
      const d = doc(); let sent = null;
      for (const x of mates) { if (!x.m) x.m = SHAREDFIGHT.build(x.s, d, () => {}); else x.m.sync(d); }
      const mt = mates.find((x) => x.s.id === ss.waiting.pid); mt.m.send = (x) => { sent = x; };
      if (mt.m.advance().turn === "me") mt.m.autoTurn();
      if (sent) ss.waiting.reply = sent; else ss.waiting.skip = true;   // no timer: the leader skips them
      r = ss.advance(); continue;
    }
    r = ss.advance();
  }
  const end = doc(); for (const mt of mates) if (mt.m) mt.m.sync(end);
  return { ss, f, mates };
}

const stats = {};
for (const np of [2, 3, 4, 8]) {
  const st = stats[np] = { fights: 0, rounds: 0, won: 0, slotsMissed: 0, slots: 0, twice: 0, badOrder: 0, badTgt: 0, tgtChecked: 0, mirrorMiss: 0, mirrorRounds: 0, ehpOff: 0 };
  for (let k = 0; k < N; k++) {
    const { ss, f, mates } = partyFight(np, [10, 20, 30][k % 3], FOES[k % FOES.length]);
    st.fights++; st.rounds += ss.round; if (f.won) st.won++;
    // every foe move in the order was played (rounds that were played to the end)
    const per = {}, rounds = ss.ev.filter((e) => e.kind === "round");
    for (const e of ss.ev) if (e.kind === "foe" && !/steps in/.test(e.text)) per[e.round] = (per[e.round] || 0) + (e.skipped || 1);   // a stunned or frozen slot is lost whole (initiative.js)
    for (const e of rounds) {
      const ids = e.order.filter((o) => /^foe/.test(o.id)).map((o) => o.id);
      if (ids.length >= 2) st.twice++;
      if (ids.some((id, i) => id !== (i ? "foe" + (i + 1) : "foe"))) st.badOrder++;
      if (e.round < ss.round) { st.slots += ids.length; st.slotsMissed += Math.max(0, ids.length - (per[e.round] || 0)); }
    }
    // the name of the move says who it goes for, and that is who it hit
    const pidName = new Map([["p1", "you"], ...mates.map((m) => [m.s.id, m.s.name])]);
    for (const e of ss.ev) {
      if (e.kind !== "foe" || !e.act || !e.act.tgt || !e.hits) continue;
      const hit = Object.keys(e.hits).map((p) => pidName.get(p)).filter(Boolean);
      if (!hit.length) continue;   // a teammate took the blow (the leader's own losses mix in poison and bleeding)
      st.tgtChecked++;
      const want = e.act.tgt;
      if (!hit.includes(want)) { st.badTgt++; if (process.env.DEBUG) console.log("  target:", e.text, JSON.stringify(e.hits), e.dmg); }
    }
    // every teammate's phone saw every foe move, in the same rounds, and the same foe at the end
    const lead = ss.ev.filter((e) => e.kind === "foe").map((e) => e.round).join(",");
    for (const mt of mates) {
      if (!mt.m) continue;
      st.mirrorRounds++;
      const mine = mt.m.ev.filter((e) => e.kind === "foe").map((e) => e.round).join(",");
      if (mine !== lead) { st.mirrorMiss++; if (process.env.DEBUG) console.log("  screen:", mt.s.name, "\n   lead", lead, "\n   mine", mine); }
      if (Math.round(mt.m.f.ehp) !== Math.max(0, Math.round(f.ehp)) && !(f.ehp <= 0 && mt.m.f.ehp <= 0)) st.ehpOff++;
    }
  }
  const avg = st.rounds / st.fights;
  console.log(`${np} heroes: ${st.fights} fights, ${avg.toFixed(1)} rounds avg, won ${st.won}, foe moves ${st.slots - st.slotsMissed}/${st.slots}, rounds with 2+ foe moves ${st.twice}, `
    + `out-of-order chips ${st.badOrder}, wrong targets named ${st.badTgt}/${st.tgtChecked}, teammate screens missing foe moves ${st.mirrorMiss}/${st.mirrorRounds}`);
  ok(st.slotsMissed === 0, `${np} heroes: every foe move in the turn order is played every round (${st.slotsMissed} of ${st.slots} skipped)`);
  ok(st.twice > 0, `${np} heroes: a fast foe still acts twice or more in a round`);
  ok(st.badOrder === 0, `${np} heroes: the foe's moves are numbered in the order they happen (${st.badOrder} rounds out of order)`);
  ok(st.tgtChecked > 0 && st.badTgt === 0, `${np} heroes: each foe move names who it hits (${st.badTgt} of ${st.tgtChecked} named someone else)`);
  ok(st.mirrorMiss === 0, `${np} heroes: every teammate's screen shows every foe move in the same rounds (${st.mirrorMiss} of ${st.mirrorRounds} screens missed some)`);
  ok(st.ehpOff === 0, `${np} heroes: every screen ends with the same foe health`);
  ok(avg >= 4 && avg <= 16, `${np} heroes: party fights last a sensible number of rounds (${avg.toFixed(1)})`);
}
console.log(fails ? `${fails} of ${n} FAILED` : `ALL OK (${n} checks)`);
process.exit(fails ? 1 : 0);
