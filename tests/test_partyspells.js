// Crafted spells in shared party fights (partyspells.js): a teammate's rune spell (runecraft.js) or combined spell
// (spellcraft.js) travels in her turn reply and in the leader's fight record, so every phone knows its definition:
// the same name, kind, element and icon, the same battle-scene effect. Your own spells are never overwritten, and
// what arrives from another phone is checked.
//   W=/path/to/game/ node test_partyspells.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, process, structuredClone };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {}, removeItem() {} };
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("if (!process.env.SIMONLY)")) + "; this.fresh = fresh; this.enc = enc;", c);
const { G, TB, D, COOP, SHAREDFIGHT, RUNECRAFT, SPELLCRAFT, PARTYSPELLS: PS } = c;
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
ok(typeof PS !== "undefined" && PS.learn && PS.used && PS.forRecord, "partyspells.js loaded");

// Beta (p2) crafts a rune spell and a combined spell on her own phone
const beta = c.fresh("mage", 30); beta.id = "p2"; beta.name = "Beta"; beta.gold = 1e6; beta.location = "Winterhold";
for (const k of ["Destruction", "Restoration"]) beta.skills[k].lvl = 60;
for (const id of ["flames", "frostbite", "healing", "lesser_ward"]) if (D.SPELLS[id] && !beta.spells.includes(id)) beta.spells.push(id);
beta.runes = [...new Set([...(beta.runes || []), "fire", "frost", "bolt", "touch", "slow", "lingering"])];
const rc = RUNECRAFT.craft(beta, { el: "frost", dl: "bolt", mods: ["slow"] });
ok(rc.id && /^rc_p2_/.test(rc.id), "Beta crafts a rune spell: " + (rc.err || rc.id));
const cs = SPELLCRAFT.craft(beta, [{ key: "damage:fire" }, { key: "heal" }], "Ember Mend");
ok(cs.id && /^cs_p2_/.test(cs.id), "and a combined spell: " + (cs.err || cs.id));
const rcSp = { ...D.SPELLS[rc.id] }, csSp = { ...D.SPELLS[cs.id] }, csPart0 = { ...D.SPELLS[cs.id + "~0"] };
// her phone and the other phones are the same node context here: forget them, as on a phone that never had them
const wipe = () => { for (const id of [rc.id, cs.id, cs.id + "~0", cs.id + "~1"]) delete D.SPELLS[id]; PS._reset(); };

// 1. her turn reply carries the crafted spells she cast, and only those
{ const evs = [{ who: "me", a: "spell:" + rc.id, text: "x" }, { who: "me", a: "dual:" + cs.id, text: "y" }, { who: "me", a: "spell:flames", text: "z" }, { who: "me", a: "attack" }];
  const u = PS.used(beta, evs);
  ok(Object.keys(u).sort().join() === [rc.id, cs.id].sort().join(), "the reply names her two crafted spells, no bought ones: " + Object.keys(u));
  ok(u[rc.id].t === "rc" && u[rc.id].c.el === "frost" && u[cs.id].t === "cs" && u[cs.id].c.parts.length === 2, "with their full definitions");
  ok(Object.keys(PS.used(beta, [{ a: "spell:flames" }, { a: "attack" }])).length === 0, "a turn without crafted spells sends nothing extra"); }

// 2. a full shared fight: Alfa leads, Beta plays her turn on her own phone and casts her rune spell
const alfa = c.fresh("warrior", 30); alfa.id = "p1"; alfa.name = "Alfa";
const f = new G.Fight(alfa, c.enc("Bandit outlaw", 30));
const mate = COOP.allyFromCard({ id: "p2", name: "Beta", cur: 300, coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: "fighter" } } }); mate.pid = "p2"; f.allies.push(mate);
const ss = new TB.Session(f, { trySneak: false }); ss.remote = { ask() {}, end() {} };
let r = ss.begin(), g = 0;
while (r.turn !== "wait" && !ss.done && g++ < 60) { r = r.turn === "me" ? ss.act("end") : ss.advance(); if (r.turn === "next") r = ss.advance(); }
ok(r.turn === "wait" && ss.waiting?.pid === "p2", "the leader's phone waits for Beta");
if (r.turn === "wait") {
  const d = { id: "fid1", owner: "p1", ...TB.fightState(ss) };
  ok(!d.spells, "no crafted spells cast yet: the record has none");
  let sent = null; const m = SHAREDFIGHT.build(beta, d, (x) => { sent = x; });
  ok(m.advance().turn === "me", "Beta's turn on her phone");
  m.f.mp = 1e5;
  const res = m.act("spell:" + rc.id);
  ok(res && !res.err && m.ev.some((e) => e.a === "spell:" + rc.id), "she casts her rune spell: " + JSON.stringify(res && res.err));
  if (!sent) m.act("end");
  ok(sent && sent.spells && sent.spells[rc.id] && sent.spells[rc.id].c.name === rcSp.name, "her reply carries the rune spell's definition");
  ok(sent && !sent.spells[cs.id], "but not the spell she didn't cast");

  // the leader's phone has never seen it
  wipe(); ok(!D.SPELLS[rc.id], "the leader's phone doesn't know the spell yet");
  ss.waiting.reply = sent; r = ss.advance();
  const L = D.SPELLS[rc.id];
  ok(L && L.foreign && L.name === rcSp.name && L.kind === rcSp.kind && L.element === rcSp.element && L.amount === rcSp.amount && L.cost === rcSp.cost && L.rc && L.rc.el === "frost" && L.rc.mods.join() === "slow",
    "the leader's phone learned it: same name, kind, element, strength, runes");
  ok(!alfa.spells.includes(rc.id), "it doesn't go into the leader's own spell list");
  ok(ss.ev.some((e) => e.by === "p2" && e.a === "spell:" + rc.id), "her cast shows on the leader's screen with the spell's id");
  if (c.FIGHTART && c.FIGHTART.spellFx) ok(c.FIGHTART.spellFx(rc.id, "").el === "frost", "the battle scene plays it as frost");

  // the leader's record now carries it: a third phone (Ceta) learns it from there
  const d2 = { id: "fid1", owner: "p1", ...TB.fightState(ss) };
  ok(d2.spells && d2.spells[rc.id] && d2.spells[rc.id].t === "rc", "the leader's record carries every crafted spell cast in the fight");
  const known = JSON.stringify(D.SPELLS[rc.id]);
  wipe();
  const ceta = c.fresh("archer", 30); ceta.id = "p3"; ceta.name = "Ceta";
  const m3 = SHAREDFIGHT.build(ceta, { ...d2, turn: null }, () => {});
  ok(m3 && D.SPELLS[rc.id] && JSON.stringify(D.SPELLS[rc.id]) === known, "Ceta's phone knows it exactly as the leader's does");
  ok(m3.ev.some((e) => e.a === "spell:" + rc.id), "and her log has Beta's cast");
}

// 3. the leader casts his own combined spell: teammates learn it from the record
{ wipe();
  const al2 = c.fresh("mage", 30); al2.id = "p5"; al2.name = "Dag"; al2.gold = 1e6; al2.location = "Winterhold";
  for (const id of ["flames", "healing"]) if (D.SPELLS[id] && !al2.spells.includes(id)) al2.spells.push(id);
  const mine = SPELLCRAFT.craft(al2, [{ key: "damage:fire" }, { key: "heal" }], "Dag's Ember");
  ok(mine.id, "Dag crafts a combined spell: " + (mine.err || mine.id));
  const f5 = new G.Fight(al2, c.enc("Bandit outlaw", 30)); f5.mp = 1e5;
  const mt = COOP.allyFromCard({ id: "p6", name: "Eir", cur: 300, coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: "fighter" } } }); mt.pid = "p6"; f5.allies.push(mt);
  const s5 = new TB.Session(f5, { trySneak: false }); s5.remote = { ask() {}, end() {} };
  let r5 = s5.begin(), g5 = 0;
  while (r5.turn !== "me" && !s5.done && g5++ < 40) { r5 = s5.advance(); if (r5.turn === "wait") { s5.waiting.skip = true; r5 = s5.advance(); } }
  if (r5.turn === "me") s5.act("spell:" + mine.id);
  ok(s5.ev.some((e) => e.a === "spell:" + mine.id), "Dag casts it in the party fight");
  const d5 = { id: "fid5", owner: "p5", ...TB.fightState(s5) };
  ok(d5.spells && d5.spells[mine.id] && d5.spells[mine.id].t === "cs", "his record carries it");
  const def = JSON.stringify(D.SPELLS[mine.id]), p0 = JSON.stringify(D.SPELLS[mine.id + "~0"]);
  for (const id of [mine.id, mine.id + "~0", mine.id + "~1"]) delete D.SPELLS[id];
  const eir = c.fresh("warrior", 30); eir.id = "p6"; eir.name = "Eir";
  SHAREDFIGHT.build(eir, { ...d5, turn: null }, () => {});
  ok(JSON.stringify(D.SPELLS[mine.id]) === def.replace(/}$/, ',"foreign":true}') && JSON.stringify(D.SPELLS[mine.id + "~0"]) === p0, "Eir's phone has the same spell and parts");
  ok(!eir.spells.includes(mine.id), "and it isn't in her own spell list"); }

// 4. your own spell is never overwritten, and junk is refused
{ wipe(); RUNECRAFT.register(beta);
  const mineName = D.SPELLS[rc.id].name;
  ok(PS.learn({ [rc.id]: { t: "rc", c: { ...beta.runeSpells[0], name: "Hacked", amount: 99999 } } }, beta) === 0 && D.SPELLS[rc.id].name === mineName && !D.SPELLS[rc.id].foreign, "a spell you own stays yours");
  ok(PS.learn({ flames: { t: "rc", c: { el: "fire", dl: "bolt", kind: "damage", amount: 1 } } }, alfa) === 0 && D.SPELLS.flames.amount > 1, "a bought spell can't be replaced");
  ok(PS.learn({ rc_x_1: { t: "rc", c: { el: "lava", dl: "bolt", kind: "damage" } } }, alfa) === 0 && !D.SPELLS.rc_x_1, "an unknown rune is refused");
  ok(PS.learn({ rc_x_2: { t: "rc", c: { el: "fire", dl: "bolt", kind: "damage", amount: 1e9, cost: -5, name: "<b>x</b>" } } }, alfa) === 1 && D.SPELLS.rc_x_2.amount <= 5000 && D.SPELLS.rc_x_2.cost >= 1 && !/[<>]/.test(D.SPELLS.rc_x_2.name), "numbers are clamped, names cleaned");
  ok(PS.learn({ cs_x_3: { t: "cs", c: { name: "Loop", parts: [{ kind: "custom", parts: ["cs_x_3"] }] } } }, alfa) === 0 && !D.SPELLS.cs_x_3, "a combined spell made of combined spells is refused");
  ok(PS.learn({ "rc_../x": { t: "rc", c: {} } }, alfa) === 0, "odd ids are refused");
  ok(PS.learn(null, alfa) === 0 && PS.learn("x", alfa) === 0, "nothing there: nothing learned"); }

console.log(fails ? `${fails} FAILED (${n} checks)` : `partyspells: all ${n} ok`);
if (fails) process.exitCode = 1;
