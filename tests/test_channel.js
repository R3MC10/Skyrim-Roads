/* Teammates see a move being prepared (channel.js). [channel]
   Owner: "When a player plays its turn and casts some magic, for other players it should look like channelling a spell,
   with a channelling bar filling while the player does their minigame. The same should apply to all attacks and skills
   granted by items."
   Part 1, the hub (pure): the start → progress → end lifecycle, repeats and stale messages dropped, results only from
   the host, the 90 % cap (never 100 % before the result), the pulse when the length is unknown, the cost reserved while
   preparing, the 12 s deadline, several channels at once resolved in the host's order, and the reconnect snapshot.
   Part 2, the real game (every script from index.html): looks per kind of move, the leader's fight record carries the
   channels, a teammate's view (sharedfight.js Mirror) restores them, and Session.canAfford sees the reserved cost.
   W=/path/to/game/ node test_channel.js */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };

const CH = require(path.join(W, "channel.js"));
let T = 100000;
const clock = () => T;
const host = CH.hub({ clock, role: "host" }), view = CH.hub({ clock }), actor = CH.hub({ clock });

// ---- lifecycle on the player's own phone
const c = actor.begin({ actor: "pB", name: "Beta", ab: "spell:firebolt", tg: null, look: "fire", ic: "*", est: 2000, cost: { sp: 0, mp: 30, hp: 0 } });
ok(c && c.st === "live" && c.seq === 1 && c.mine, "begin: a live channel of your own");
let v = actor.shown(c);
ok(v.st === "live" && v.frac === 0 && !v.pulse, "a fresh channel shows an empty bar");
T += 1000; v = actor.shown(c);
ok(Math.abs(v.frac - 0.5) < 1e-9, "without progress the bar fills over the estimated time (" + v.frac + ")");
T += 5000; v = actor.shown(c);
ok(v.frac === CH.CAP_EST && v.frac === 0.9, "it stops at 90 % until the result (" + v.frac + ")");
ok(actor.progress(c, 0.34) === true && c.prog === 0.35 && c.seq === 2, "progress is sent when it changed (rounded to 5 %)");
ok(actor.progress(c, 0.36) === false, "the same progress again is not sent");
T += 100;
ok(actor.progress(c, 0.7) === false && c.prog === 0.7, "at most 4 progress messages a second (kept locally, not sent)");
T += 300;
ok(actor.progress(c, 0.75) === true, "after 250 ms the next change is sent");
ok(actor.progress(c, 1) === true || c.prog === 1, "a finished game");
v = actor.shown(c);
ok(v.frac === CH.CAP_REAL && v.frac < 1, "real progress shows, but never 100 % before the result (" + v.frac + ")");
const wStart = actor.wire(c);
ok(!("inputs" in wStart) && Object.keys(wStart).every((k) => ["id", "seq", "st", "actor", "name", "ab", "tg", "look", "ic", "est", "t0", "ta", "prog", "cost"].includes(k)), "the wire message holds only the action, never minigame inputs: " + Object.keys(wStart).join(","));

// ---- the host takes it in; a teammate sees it
const sent = T / 1000;
ok(host.apply(host.fromWire(wStart, sent), "host") === true, "the host takes in the start");
ok(host.apply(host.fromWire(wStart, sent), "host") === false, "a repeated message changes nothing");
ok(view.apply(view.fromWire(wStart, sent), "peer") === true, "a teammate sees the start from the player's own write");
const old = { ...wStart, seq: 1, prog: 0.1 };
ok(view.apply(view.fromWire(old, sent), "peer") === false && view.list()[0].prog === 1, "a stale (older) message is dropped");
ok(actor.end(c, "crit") && c.st === "end" && c.res === "crit", "the minigame's grade ends the channel (Perfect = crit)");
const wEnd = actor.wire(c);
ok(view.apply(view.fromWire(wEnd, T / 1000), "peer") === false && view.list()[0].st === "live", "a result from the player's phone alone does not count on a teammate's phone");
ok(host.apply(host.fromWire(wEnd, T / 1000), "host") === true && host.list()[0].ord === 1, "the host accepts the result and gives it its order");
const snap = host.snapshot();
ok(view.restore(snap, T / 1000, "host") === true && view.list()[0].res === "crit", "the host's record brings the result to the teammate");
v = view.shown(view.list()[0]);
ok(v.st === "end" && v.frac === 1 && v.res === "crit", "a crit fills the bar");
ok(view.restore(snap, T / 1000, "host") === false, "the same record again changes nothing");
T += CH.LINGER + 10; view.sweep(); host.sweep();
ok(view.size === 0 && host.size === 0, "finished bars fade out and are tidied away");
ok(view.restore(snap, T / 1000 - 5, "host") === false && view.size === 0, "an old record can't bring a finished channel back");

// ---- fail, miss and cancel
for (const res of ["fail", "miss", "cancel"]) {
  const h = CH.hub({ clock, role: "host" });
  const x = h.begin({ actor: "pC", name: "Ceta", ab: "attack", look: "melee", est: 1500, cost: { sp: 10 } });
  T += 600; h.shown(x);
  h.end(x, res);
  const s2 = h.shown(x);
  ok(s2.st === "end" && s2.res === res && s2.frac < 1, `${res}: the bar does not fill (${s2.frac.toFixed(2)})`);
  T += CH.LINGER * 0.5;
  ok(res === "cancel" ? h.shown(x).fade > 0.4 : true, `${res}: a cancel fades the bar`);
}
ok(!host.end(null, "hit") && !CH.hub().end({ st: "live" }, "boom"), "unknown results are refused");

// ---- unknown length pulses
const hp = CH.hub({ clock });
const bw = hp.begin({ actor: "pD", name: "Dita", ab: "attack", look: "bow", est: 0, cost: {} });
v = hp.shown(bw);
ok(v.pulse && v.frac === 0, "a move of unknown length pulses");
hp.progress(bw, 0.5); v = hp.shown(bw);
ok(!v.pulse && v.frac === 0.5, "real progress replaces the pulse");

// ---- cost reserved while preparing
const hr = CH.hub({ clock });
const have = { sp: 50, mp: 40, hp: 100 };
ok(hr.canSpend("pE", have, { mp: 30 }), "30 magicka of 40 can be spent");
const r1 = hr.begin({ actor: "pE", name: "Ema", ab: "spell:firebolt", look: "fire", est: 2000, cost: { mp: 30 } });
ok(hr.reserved("pE").mp === 30 && hr.reserved("pE").n === 1, "starting the channel reserves its 30 magicka");
ok(!hr.canSpend("pE", have, { mp: 30 }), "the same 30 magicka can't be spent twice while it prepares");
ok(hr.canSpend("pE", have, { sp: 20 }), "stamina is still free");
ok(hr.canSpend("pF", have, { mp: 30 }), "another player's magicka is their own");
hr.end(r1, "hit");
ok(hr.reserved("pE").mp === 0 && hr.canSpend("pE", have, { mp: 30 }), "the result releases it (the move then pays for itself)");

// ---- the deadline
const hd = CH.hub({ clock, role: "host" });
const d1 = hd.begin({ actor: "pG", name: "Gosia", ab: "spell:heal", look: "heal", est: 3000, cost: { mp: 20 } });
T += CH.DEADLINE - 50;
ok(hd.sweep().length === 0 && d1.st === "live", "before 12 s nothing happens");
T += 100;
const outs = hd.sweep();
ok(outs.length === 1 && d1.res === "cancel" && d1.why === "timeout" && hd.reserved("pG").n === 0, "after 12 s the move is cancelled (timeout) and its cost released");

// ---- several channels at once, resolved in the host's order
const h8 = CH.hub({ clock, role: "host" }), v8 = CH.hub({ clock });
const names = ["Alfa", "Beta", "Ceta", "Dita", "Ema", "Fila", "Gosia", "Hela"], looks = ["fire", "frost", "shock", "heal", "melee", "bow", "bash", "oil"];
const peers = names.map((nm, i) => { const p = CH.hub({ clock }); return { p, c: p.begin({ actor: "q" + i, name: nm, ab: "attack", look: looks[i], est: 1500 + i * 100, cost: { sp: 5 } }) }; });
for (const { p, c: x } of peers) { h8.apply(h8.fromWire(p.wire(x), T / 1000), "host"); v8.apply(v8.fromWire(p.wire(x), T / 1000), "peer"); }
ok(h8.live().length === 8 && v8.live().length === 8, "8 players can prepare at once (" + h8.live().length + ")");
ok(new Set(h8.list().map((x) => x.look)).size === 8, "each keeps its own look");
const endOrder = [5, 2, 7, 0, 1, 3, 6, 4];
for (const i of endOrder) { T += 30; const { p, c: x } = peers[i]; p.end(x, i % 3 ? "hit" : "crit"); h8.apply(h8.fromWire(p.wire(x), T / 1000), "host"); }
const ordered = h8.list().map((x) => x.name);
ok(JSON.stringify(ordered) === JSON.stringify(endOrder.map((i) => names[i])), "finished moves resolve in the order the host got them: " + ordered.join(","));
v8.restore(h8.snapshot(), T / 1000, "host");
ok(JSON.stringify(v8.list().map((x) => x.name)) === JSON.stringify(ordered) && v8.list().every((x) => x.st === "end"), "the teammate gets the same order from the host");

// ---- one at a time per player: a newer start drops an older one; a late old start doesn't come back
const h2 = CH.hub({ clock });
const pa = CH.hub({ clock });
const a1 = pa.begin({ actor: "pH", name: "Hela", ab: "attack", look: "melee", est: 1500 }); const w1 = pa.wire(a1);
T += 10;
const a2 = pa.begin({ actor: "pH", name: "Hela", ab: "power_attack", look: "melee", est: 1300 }); const w2 = pa.wire(a2);
h2.apply(h2.fromWire(w2, T / 1000), "peer");
ok(h2.apply(h2.fromWire(w1, T / 1000), "peer") === false && h2.live().length === 1 && h2.live()[0].ab === "power_attack", "a stale start from the same player is dropped");

// ---- reconnect: a phone that comes back gets the live channels with their real age
const hc = CH.hub({ clock, role: "host" });
const pc = CH.hub({ clock });
const rc = pc.begin({ actor: "pI", name: "Ilka", ab: "spell:firebolt", look: "fire", est: 2000 });
hc.apply(hc.fromWire(pc.wire(rc), T / 1000), "host");
T += 1000;
const fresh = CH.hub({ clock: () => T + 777777 });   // a phone whose clock is far off
fresh.restore(hc.snapshot(), T / 1000, "host");
ok(fresh.size === 1, "the reconnect snapshot restores the active channel");
const fv = fresh.shown(fresh.list()[0]);
ok(Math.abs(fv.frac - 0.5) < 0.01, "and fills it from the host's timestamps, whatever this phone's clock says (" + fv.frac.toFixed(3) + ")");

// ===================================================================== part 2: the real game
let seed = 4242;
const Mx = Object.create(Math); Mx.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
const ctx = { console, Math: Mx, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, process, structuredClone, Promise, setTimeout, clearTimeout };
ctx.localStorage = { getItem: () => JSON.stringify({ lang: "en" }), setItem() {}, removeItem() {} };
vm.createContext(ctx);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), ctx); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", ctx);
const { G, TB, SHAREDFIGHT, COOP, CHANNEL, D } = ctx;
ok(CHANNEL && TB && SHAREDFIGHT, "channel.js loads with the game");
if (CHANNEL && TB && SHAREDFIGHT) {
  const s = ctx.make("mage", 20); s.id = "pA"; s.name = "Alfa"; s.health = G.maxHealth(s);
  const fire = Object.keys(D.SPELLS).find((k) => D.SPELLS[k].school === "Destruction" && D.SPELLS[k].element === "fire" && D.SPELLS[k].kind !== "utility");
  const frost = Object.keys(D.SPELLS).find((k) => D.SPELLS[k].school === "Destruction" && D.SPELLS[k].element === "frost" && D.SPELLS[k].kind !== "utility");
  const heal = Object.keys(D.SPELLS).find((k) => D.SPELLS[k].school === "Restoration" && D.SPELLS[k].kind === "heal");
  s.spells = [...new Set([...(s.spells || []), fire, frost, heal].filter(Boolean))];
  const foe = G.scaleEnemy({ name: "Bandit outlaw", health: 90, damage: 9, tags: ["humanoid"], level: 20, gold: [0, 0], text: "" }, 20);
  const f = new G.Fight(s, foe);
  const sx = ctx.make("warrior", 20); sx.id = "pB"; sx.name = "Beta";
  const al = COOP.allyFromCard({ id: sx.id, name: sx.name, cur: G.maxHealth(sx), coop: { prof: COOP.profile(sx) } }); al.pid = sx.id; f.allies = [al];
  ok(CHANNEL.lookOf(f, "spell:" + fire) === "fire" && CHANNEL.lookOf(f, "spell:" + frost) === "frost" && CHANNEL.lookOf(f, "spell:" + heal) === "heal", "spell looks follow the school and element (fire / frost / Restoration = healing)");
  ok(CHANNEL.lookOf(f, "block") === "guard" && CHANNEL.lookOf(f, "rx:oil") === "oil" && CHANNEL.lookOf(f, "potion:health") === null, "a guard is a guard, the oil flask has its own look, a potion has no channel");
  f.wt = "bow"; ok(CHANNEL.lookOf(f, "attack") === "bow", "a bow shot is a draw"); f.wt = "sword"; ok(CHANNEL.lookOf(f, "attack") === "melee", "a sword blow is a wind-up");
  ok(CHANNEL.estOf(f, "spell:" + fire) > 0 && CHANNEL.estOf(f, "attack") > 0, "spells and blows have an estimated length");
  const recs = [];
  const remote = { sync: () => recs.push(1), fid: () => "pA-1" };
  const sess = new TB.Session(f, { trySneak: false, hidden: false }); sess.remote = remote; sess.begin();
  ok(ctx.CHANNEL.forRecord(sess).ch === undefined, "no channels: nothing extra in the fight record");
  // canAfford sees a reserved cost (the session is Alfa's own: actor = his id)
  f.mp = 40;
  const sp = "spell:" + fire, cost = TB.cost(f, sp, sess);
  ok(sess.canAfford(sp), "Alfa can cast " + fire + " (" + cost.mp + " of 40 magicka)");
  const fake = { f, fid: null, mirror: false, remote };
  const ch = CHANNEL.hub0.begin({ actor: "pA", name: "Alfa", ab: sp, look: "fire", est: 2000, cost: { mp: cost.mp } });
  CHANNEL.hub0.role("host");
  if (cost.mp * 2 > 40) ok(!sess.canAfford(sp), "while it prepares, the same magicka can't pay for it again");
  ok(sess.canAfford("end") && sess.canAfford("flee"), "ending the turn and fleeing are always open");
  const rec = TB.fightState ? null : null;
  const st = CHANNEL.forRecord(sess);
  ok(st.ch && st.ch.length === 1 && st.ch[0].actor === "pA" && st.ch[0].look === "fire", "the leader's fight record carries the channel");
  CHANNEL.hub0.end(ch, "hit");
  ok(sess.canAfford(sp), "the result releases the magicka");
  // a teammate's view restores the record's channels (also after a reconnect)
  const live2 = CHANNEL.hub0.begin({ actor: "pA", name: "Alfa", ab: "spell:" + frost, look: "frost", est: 2000, cost: { mp: 5 } });
  const d = { id: "pA-1", v: 2, owner: "pA", ownerName: "Alfa", t: Date.now() / 1000, round: 1, ehp: 90, ehpMax: 90, foeE: { name: "Bandit outlaw" }, fs: {}, roster: [{ k: "host", host: true, player: true, name: "Alfa", hp: 100, hpMax: 100 }, { k: "p:pB", pid: "pB", player: true, name: "Beta", hp: 100, hpMax: 100 }], order: [], idx: 0, evs: [], pids: ["pB"], ...CHANNEL.forRecord(sess) };
  ok(d.ch && d.ch.some((w) => w.look === "frost" && w.st === "live"), "the record has the live frost channel");
  const mir = SHAREDFIGHT.build(sx, d, () => {});
  ok(mir.mirror && CHANNEL.hub0.list().some((x) => x.name === "Alfa" && x.look === "frost" && x.st === "live"), "Beta's view of the fight restores Alfa's channel from the record");
  ok(CHANNEL.allyAnim("Alfa") && CHANNEL.allyAnim("Alfa").clip === "cast", "and shows Alfa in a casting pose");
  ok(CHANNEL.busy("Alfa"), "Alfa's name tag gives way to the bar");
  ok(CHANNEL.resOf({ cls: "perfect" }, live2) === "crit" && CHANNEL.resOf({ cls: "poor" }, live2) === "fail" && CHANNEL.resOf({ cls: "poor" }, { look: "melee" }) === "miss" && CHANNEL.resOf({ cls: "good" }, live2) === "hit", "minigame grades map to crit / hit / fail (spells) / miss (blows)");
  const P = {}; ok(CHANNEL.heroPose(P, "sword") === false, "no channel of your own: your hero stands as usual");
}

console.log(`${n - fails}/${n} checks passed`);
process.exit(fails ? 1 : 0);
