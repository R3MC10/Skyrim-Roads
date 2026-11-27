/* Party fights stay in sync between phones (tbfight.js remoteFor + sharedfight.js Mirror). [fightsync]
   Remigiusz: "party fights desync" (phones show different things, turns get lost).
   A simulated network of 2-8 phones plays many party fights. Each phone has its own copy of the shared records (like
   store.js: newest copy wins, a watcher fires on every change) and talks through a server that keeps the world. The
   network is unkind: random delays, messages arriving out of order, duplicates, dropped messages, a phone that goes
   offline mid-fight and comes back (it gets the server's copy, like servernet.js onWorld), players who wander off (the
   leader skips them after 30 s, as in the game), and a leader whose phone dies. Checks, per fight:
   - the fight always ends (unless the leader's phone died: then every teammate's screen breaks off on its own)
   - every teammate's screen ends the same way as the leader's (won / lost / got away) with the same foe health
   - no teammate's turn is lost while they were there (no "guard, out of time" for a player who did play)
   - no turn is applied twice, and a late reply never lands in a later turn
   - after every record a teammate takes in (not mid-move), their screen matches the leader's: foe health, round, everyone's
     health, whose turn it is (state hash)
   W=/path/to/game/ node test_fightsync.js   (N=fights per scenario, default 6; SEED=...) */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const N = +(process.env.N || 6);
let seed = +(process.env.SEED || 777);
const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// ------------------------------------------------------------------ a simulated clock for everything in the game code
let NOW = 1_800_000_000_000;
const timers = []; let tseq = 0;
const SimDate = class extends Date { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } };
const setT = (fn, ms) => { const id = ++tseq; timers.push({ id, at: NOW + Math.max(0, +ms || 0), fn }); return id; };
const setI = (fn, ms) => { const id = ++tseq; const t = { id, at: NOW + ms, fn, every: Math.max(50, ms) }; timers.push(t); return id; };
const clearT = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
const M = Object.create(Math); M.random = rnd;
const c = { console, Math: M, Date: SimDate, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, process, structuredClone,
  setTimeout: setT, clearTimeout: clearT, setInterval: setI, clearInterval: clearT };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {}, removeItem() {} };
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
const { G, TB, SHAREDFIGHT, COOP } = c;
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
ok(TB && SHAREDFIGHT && COOP, "tbfight.js, sharedfight.js and coop.js loaded");

// ------------------------------------------------------------------ the network: a server that keeps the world, phones that hear it
const COLS = ["tbf"];
function makeNet(cfg) {
  const server = { world: {} };
  const phones = [];
  const q = [];   // messages in flight: { at, to, msg }
  const mergeInto = (world, col, id, doc) => {
    const w = (world[col] = world[col] || {}), cur = w[id];
    if (cur && (cur._v > doc._v || (cur._v === doc._v && String(cur._by) >= String(doc._by)))) return false;
    w[id] = doc; return true;
  };
  const deliverLater = (to, msg) => {
    if (rnd() < cfg.drop) { net.dropped++; return; }
    const copies = rnd() < cfg.dup ? 2 : 1;
    for (let i = 0; i < copies; i++) q.push({ at: NOW + cfg.lat[0] + rnd() * (cfg.lat[1] - cfg.lat[0]), to, msg });
  };
  const net = {
    server, phones, dropped: 0,
    phone(uid, skew = 0) {
      const p = { uid, skew, world: {}, watchers: {}, offline: false, dead: false };
      const emit = (col) => (p.watchers[col] || []).forEach((f) => f(Object.entries(p.world[col] || {}).filter(([, d]) => !d._del).map(([id, d]) => ({ ...d, id }))));
      const localPut = (col, id, doc) => {
        if (p.dead) return;
        const prev = (p.world[col] || {})[id];
        const rec = { ...doc, _v: Math.max(NOW + p.skew, (prev?._v || 0) + 1), _by: uid }; delete rec.id;
        mergeInto(p.world, col, id, rec); emit(col);
        if (process.env.DEBUG2 && uid === "p1" && !id.includes("~")) console.log("    put", NOW, rec.turns && JSON.stringify(rec.turns.map((t) => t.tid)));
        if (!p.offline) deliverLater("server", { col, id, doc: rec, from: uid });
      };
      p.store = {
        online: true,
        put(col, id, doc) { localPut(col, id, doc); return Promise.resolve(true); },
        remove(col, id) { if ((p.world[col] || {})[id]) localPut(col, id, { _del: true }); },
        change(col, id, fn) { const cur = (p.world[col] || {})[id]; if (!cur || cur._del) return null; const b = { ...cur }; delete b._v; delete b._by; const nx = fn({ ...b }); localPut(col, id, nx || { _del: true }); return { before: b, after: nx }; },
        watch(col, cb) { (p.watchers[col] = p.watchers[col] || []).push(cb); cb(Object.entries(p.world[col] || {}).filter(([, d]) => !d._del).map(([id, d]) => ({ ...d, id }))); },
      };
      p.hear = (m) => { if (p.dead || p.offline) return; if (mergeInto(p.world, m.col, m.id, m.doc)) emit(m.col); };
      p.goOffline = () => { p.offline = true; p.store.online = false; };
      p.comeBack = () => {   // servernet.js: the server's copy of the world arrives, and what I wrote while away goes up
        p.offline = false; p.store.online = true;
        for (const col of COLS) for (const [id, d] of Object.entries(server.world[col] || {})) mergeInto(p.world, col, id, d);
        for (const col of COLS) for (const [id, d] of Object.entries(p.world[col] || {})) { const s = (server.world[col] || {})[id]; if (!s || s._v < d._v) deliverLater("server", { col, id, doc: d, from: uid }); }
        COLS.forEach(emit);
      };
      phones.push(p); return p;
    },
    tick() {
      q.sort((a, b) => a.at - b.at);
      while (q.length && q[0].at <= NOW) {
        const { to, msg } = q.shift();
        if (process.env.DEBUG3 && !msg.id.includes("~")) console.log("    deliver", NOW, to, msg.doc._v, msg.doc.turns && JSON.stringify(msg.doc.turns.map((t) => t.tid)));
        if (to === "server") { if (mergeInto(server.world, msg.col, msg.id, msg.doc)) for (const ph of phones) if (ph.uid !== msg.from) deliverLater(ph.uid, msg); }
        else { const ph = phones.find((x) => x.uid === to); if (ph) ph.hear(msg); }
      }
    },
  };
  return net;
}
function runTimers() {
  for (let guard = 0; guard < 200; guard++) {
    timers.sort((a, b) => a.at - b.at);
    const t = timers[0]; if (!t || t.at > NOW) return;
    if (t.every) t.at += t.every; else timers.shift();
    try { t.fn(); } catch (e) { console.log("timer error", e.message); }
  }
}

// ------------------------------------------------------------------ what a screen shows, boiled down (the state hash)
const view = (sess, me) => {
  const f = sess.f;
  return { ehp: Math.max(0, Math.round(f.ehp)), round: sess.round || 0, wave: sess.wave || 1 };
};

const BUILDS = ["warrior", "mage", "archer", "twohand", "spellsword"];
const FOES = [{ name: "Bandit outlaw", health: 60, damage: 10, tags: ["humanoid"] }, { name: "Draugr", health: 70, damage: 11, tags: ["undead"] }, { name: "Frost troll", health: 200, damage: 24, tags: ["beast", "elite"] }];

/* one party fight on a bad network */
function fight(np, L, foeBase, sc) {
  timers.length = 0;
  const net = makeNet(sc.net);
  const lead = net.phone("p1", 0);
  const s = c.make(BUILDS[0], L); s.id = "p1"; s.name = "Alfa"; s.health = G.maxHealth(s);
  const foe = G.scaleEnemy({ ...foeBase, tags: [...foeBase.tags], level: L, gold: [0, 0], text: "" }, L);
  const f = new G.Fight(s, foe); f.allies = [];
  const mates = [];
  for (let i = 2; i <= np; i++) {
    const sx = c.make(BUILDS[(i - 1) % BUILDS.length], L); sx.id = "p" + i; sx.name = ["Beta", "Ceta", "Dita", "Ema", "Fila", "Gosia", "Hela"][i - 2];
    const al = COOP.allyFromCard({ id: sx.id, name: sx.name, cur: G.maxHealth(sx), coop: { prof: COOP.profile(sx) } }); al.pid = sx.id; f.allies.push(al);
    const ph = net.phone(sx.id, Math.round((rnd() - 0.5) * 4000));   // phones' clocks are a little off
    mates.push({ s: sx, al, ph, m: null, plan: null, away: [], afkTurns: new Set(), closed: false });
  }
  const ss = new TB.Session(f, { trySneak: false });
  ss.remote = TB.remoteFor(lead.store, "p1", null);
  // count how every teammate's turn ended on the leader's phone
  const applied = new Map(), lost = [];
  const ap0 = ss.applyRemote.bind(ss); ss.applyRemote = (al, r) => { const k = al.pid + "|" + r.tid; applied.set(k, (applied.get(k) || 0) + 1); return ap0(al, r); };
  const am0 = ss.allyMove.bind(ss); ss.allyMove = (al, m, why) => { if (al.pid && (why === "lost" || why === "skip")) { lost.push({ pid: al.pid, at: NOW, why }); if (process.env.DEBUG) { const w = ss.gr && ss.gr.waits.find((x) => x.pid === al.pid); const mt = mates.find((x) => x.s.id === al.pid); console.log("   LOST", al.pid, why, "t", NOW, "wait", w && JSON.stringify({ tid: w.tid, ack: w.ack, t0: w.t0, seen: w.seen }), "mirror", mt.m && JSON.stringify({ my: mt.m.myTurn, done: mt.m.doneTid, heard: mt.m.heard, plan: mt.plan })); } } return am0(al, m, why); };
  let mism = 0, checks = 0; const FID = { v: null };
  // a teammate's phone: the same flow as sharedfight.js onDocs (opens the fight, takes in every record, plays its turns)
  for (const mt of mates) {
    mt.ph.store.watch("tbf", (docs) => {
      if (mt.closed) return;
      const fid = FID.v || (FID.v = ss.remote.fid()); if (!fid) return;
      const d = docs.find((x) => x.id === fid && x.v >= 2);
      if (mt.m && mt.m.done && mt.m.how === "broke" && d && (d.done || (d.t || 0) * 1000 > mt.brokeAt)) { mt.rejoined = (mt.rejoined || 0) + 1; mt.m = null; }   // sharedfight.js: back after breaking off, the fight goes on: join it again
      if (!mt.m) {
        if (!d || (d.done && !mt.brokeAt) || !(d.pids || []).includes(mt.s.id)) return;
        mt.m = SHAREDFIGHT.build(mt.s, d, (r) => mt.ph.store.put("tbf", `${fid}~${mt.s.id}`, r));
        mt.m.beatTo = (b) => mt.ph.store.put("tbf", `${fid}~${mt.s.id}~b`, b);
        if (mt.m.watchStore) mt.m.watchStore(mt.ph.store);
      } else if (!d) { if (!mt.m.done) mt.m.end("broke"); return; }
      else mt.m.sync(d);
      // the state hash: right after taking in a record (not halfway through a move of your own), you see what the leader sees
      if (d && !mt.m.done && !(mt.m.myTurn && mt.m.moved())) {
        checks++;
        const mine = view(mt.m), theirs = { ehp: d.ehp, round: d.round || 0, wave: d.wave || 1 };
        if (JSON.stringify(mine) !== JSON.stringify(theirs) || (d.fp && mt.m.mine(d) !== d.fp)) { mism++; if (process.env.DEBUG) console.log("  hash", mt.s.name, JSON.stringify(mine), JSON.stringify(theirs)); }
      }
    });
  }
  // what happens in this fight
  const leaderDies = sc.leaderDies ? NOW + 20000 + rnd() * 30000 : Infinity;
  const away = sc.away ? mates[Math.floor(rnd() * mates.length)] : null;
  if (away) { const a = NOW + 8000 + rnd() * 25000; away.away.push([a, a + (sc.long ? 130000 + rnd() * 90000 : 10000 + rnd() * 50000)]); }
  const afk = sc.afk ? mates[Math.floor(rnd() * mates.length)] : null;
  let r = ss.begin(), meAt = 0, end = NOW + 40 * 60000, leaderDead = false, endAt = 0;
  const step = 100;
  while (NOW < end) {
    NOW += step; net.tick(); runTimers();
    // phones going away and coming back
    for (const mt of mates) for (const [a, b] of mt.away) {
      if (NOW >= a && NOW < a + step) mt.ph.goOffline();
      if (NOW >= b && NOW < b + step) mt.ph.comeBack();
    }
    if (!leaderDead && NOW >= leaderDies) { leaderDead = true; lead.dead = true; ss.remote.end = () => {}; }
    // the leader's phone
    if (!leaderDead && !ss.done) {
      r = ss.advance(); ss.remote.sync(ss);
      if (r.turn === "me") { if (!meAt) meAt = NOW + 400 + rnd() * 2500; if (NOW >= meAt) { ss.autoTurn(); meAt = 0; r = ss.advance(); ss.remote.sync(ss); } }
      else if (r.turn === "wait" && r.quiet && r.quiet.length) for (const q of r.quiet) ss.skipPlayer(q.pid);   // the leader presses Skip after 30 s of nothing
      if (ss.done) { endAt = NOW; ss.remote.end(); }
    }
    // teammates' phones
    for (const mt of mates) {
      const m = mt.m; if (!m || m.done) continue;
      if (NOW - m.heard > SHAREDFIGHT.SILENT * 1000) { m.end("broke"); mt.brokeAt = NOW; continue; }   // the phone's own clock runs on, network or not
      if (mt.ph.offline) continue;   // sharedfight.js mount: no word from the leader
      if (m.tick) m.tick();
      if (m.advance().turn === "me") {
        const tid = m.myTurn && m.myTurn.tid;
        if (!mt.plan || mt.plan.tid !== tid) {
          const goneAfk = afk === mt && rnd() < 0.35;
          if (goneAfk) mt.afkTurns.add(tid);
          mt.plan = { tid, at: NOW + (goneAfk ? 45000 : 300 + rnd() * 4000) };
        }
        if (NOW >= mt.plan.at) { m.autoTurn(); if (process.env.DEBUG && m.myTurn && NOW - mt.plan.at > 5000 && NOW - mt.plan.at < 5150) console.log("   STUCK", mt.s.id, JSON.stringify(m.cur), m.over, m.apSet, m.meTok, m.done, m.f.hp, m.f.ehp, m.meDown, "field", JSON.stringify(m.field && m.field.foes.map((x) => [x.i, x.hp, x.down])), m.wave, m.waves, "LEADER", ss.done, Math.round(ss.f.ehp), ss.wave, ss.waves, JSON.stringify(ss.field && ss.field.foes.map((x) => [x.i, Math.round(x.hp), x.down])), ss.f.endWon, JSON.stringify(ss.gr && ss.gr.waits.map((w) => [w.pid, w.fin]))); }
      }
    }
    // everyone done?
    if ((ss.done || leaderDead) && mates.every((mt) => (!mt.m || mt.m.done) && mt.away.every(([, b]) => NOW > b + 3000))) { if (ss.done && NOW - endAt < 1000) continue; break; }
  }
  // the end: let everything in flight land
  for (let i = 0; i < 50; i++) { NOW += step; net.tick(); runTimers(); }
  const rejoined = mates.reduce((a, mt) => a + (mt.rejoined || 0), 0);
  const repairs = mates.reduce((a, mt) => a + ((mt.m && mt.m.desyncs) || 0), 0);
  return { rejoined, repairs, ss, f, mates, applied, lost, mism, checks, leaderDead, away, afk, net, timedOut: NOW >= end };
}

const SCEN = [
  { name: "good network", net: { drop: 0, dup: 0, lat: [20, 120] } },
  { name: "slow, out of order, duplicates", net: { drop: 0, dup: 0.15, lat: [50, 1800] } },
  { name: "drops 10% of messages", net: { drop: 0.10, dup: 0.05, lat: [30, 900] } },
  { name: "drops 25% of messages", net: { drop: 0.25, dup: 0.05, lat: [30, 900] } },
  { name: "a phone goes offline mid-fight", net: { drop: 0.03, dup: 0.02, lat: [30, 700] }, away: true },
  { name: "a phone is gone for 2-4 minutes, then back", net: { drop: 0.03, dup: 0.02, lat: [30, 700] }, away: true, long: true, slowFoe: true },
  { name: "a player wanders off (leader skips them)", net: { drop: 0.02, dup: 0, lat: [30, 500] }, afk: true },
  { name: "the leader's phone dies", net: { drop: 0.02, dup: 0, lat: [30, 500] }, leaderDies: true },
];
const SIZES = process.env.SIZES ? process.env.SIZES.split(",").map(Number) : [2, 3, 4, 8];
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
for (const sc of SCEN) {
  if (ONLY && !ONLY.test(sc.name)) continue;
  const st = { fights: 0, notDone: 0, endDiff: 0, ehpDiff: 0, lostWhileThere: 0, lostTotal: 0, twice: 0, mism: 0, checks: 0, broke: 0, mirrors: 0, notOpened: 0, rounds: 0, drops: 0 };
  for (let k = 0; k < N; k++) {
    const np = SIZES[k % SIZES.length];
    const R = fight(np, [10, 20, 30][k % 3], FOES[k % FOES.length], sc);
    st.fights++; st.rounds += R.ss.round; st.drops += R.net.dropped;
    st.mism += R.mism; st.checks += R.checks; st.repairs = (st.repairs || 0) + R.repairs; st.rejoined = (st.rejoined || 0) + R.rejoined;
    for (const [, v] of R.applied) if (v > 1) st.twice++;
    if (sc.leaderDies) {
      for (const mt of R.mates) {
        if (!mt.m || R.ss.done) continue;   // never opened, or the fight was over before the phone died (a normal ending)
        st.mirrors++; if (!mt.m.done) st.notDone++; if (mt.m.done && mt.m.how === "broke") st.broke++;
        else if (process.env.DEBUG) console.log("  after the leader died", mt.s.name, mt.m.how);
      }
      continue;
    }
    if (!R.ss.done) { st.notDone++; if (process.env.DEBUG) console.log("  leader never finished", np, R.ss.round); }
    const how = R.f.won ? (R.f.escaped ? "escaped" : "won") : "lost";
    for (const mt of R.mates) {
      st.mirrors++;
      if (!mt.m) { st.notOpened++; continue; }
      if (!mt.m.done) { st.notDone++; if (process.env.DEBUG) console.log("  screen never finished", mt.s.name); continue; }
      const mh = mt.m.how === "fled" ? "escaped" : mt.m.how;
      if (mh !== how && !(mt.al.gone)) { st.endDiff++; if (process.env.DEBUG) console.log("  end", mt.s.name, mt.m.how, "leader", how); }
      if (Math.max(0, Math.round(mt.m.f.ehp)) !== Math.max(0, Math.round(R.f.ehp)) && !(R.f.ehp <= 0 && mt.m.f.ehp <= 0)) st.ehpDiff++;
    }
    // turns that ended as "guard, nobody answered" for a player who was there and did play
    for (const l of R.lost) {
      st.lostTotal++;
      const mt = R.mates.find((x) => x.s.id === l.pid);
      const wasAway = mt && mt.away.some(([a, b]) => l.at >= a - 35000 && l.at <= b + 35000);
      const wasAfk = mt && R.afk === mt;
      if (!wasAway && !wasAfk) { st.lostWhileThere++; if (process.env.DEBUG) console.log("  lost turn", l.pid, l.why); }
    }
  }
  console.log(`${sc.name}: ${st.fights} fights, ${(st.rounds / st.fights).toFixed(1)} rounds, ${st.drops} messages dropped, screens off the leader's ${st.mism}/${st.checks} (fixed themselves ${st.repairs}), `
    + `turns lost while there ${st.lostWhileThere} (all lost/skipped ${st.lostTotal}), applied twice ${st.twice}, unfinished ${st.notDone}, different endings ${st.endDiff}, foe health off ${st.ehpDiff}` + (sc.long ? `, rejoined after breaking off ${st.rejoined}` : "") + (sc.leaderDies ? `, broke off ${st.broke}/${st.mirrors}` : ""));
  ok(st.twice === 0, `${sc.name}: no turn applied twice (${st.twice})`);
  ok(st.notDone === 0, `${sc.name}: every fight and every screen comes to an end (${st.notDone} didn't)`);
  if (sc.leaderDies) { ok(st.broke === st.mirrors, `${sc.name}: every teammate's screen breaks off by itself (${st.broke}/${st.mirrors})`); continue; }
  if (sc.long) ok(st.rejoined > 0, `${sc.name}: a phone that broke off joins the fight again when it's back (${st.rejoined})`);
  ok(st.notOpened === 0, `${sc.name}: every teammate's phone opens the fight (${st.notOpened} didn't)`);
  ok(st.endDiff === 0, `${sc.name}: every screen ends the same way as the leader's (${st.endDiff} differ)`);
  ok(st.ehpDiff === 0, `${sc.name}: every screen ends with the leader's foe health (${st.ehpDiff} differ)`);
  ok(st.lostWhileThere === 0, `${sc.name}: no turn lost for a player who was there (${st.lostWhileThere})`);
  ok(st.mism === 0, `${sc.name}: after every record, the screen matches the leader's (${st.mism} of ${st.checks} off)`);
}
console.log(fails ? `${fails} of ${n} FAILED` : `ALL OK (${n} checks)`);
process.exit(fails ? 1 : 0);
