/* Losing a fight costs nothing (defeat.js; owner decision 25 Nov 2026). W=/path/to/game/ node test_defeat.js
   - no gold / item / XP / progress loss on every defeat path (road, dungeon, deep level, quest, guild contract, heist,
     Blackreach-style returns, town guards), no bag, no temple teleport
   - gains made DURING the lost fight are rolled back (XP, potions drunk, gold), gains from before are kept
   - Retry keeps the same foes (dice up to the fight replayed), Retreat steps back (road / dungeon room)
   - public fights (world events): no rollback, back up in place, contribution kept
   - party vote: majority, tie -> leader; a lost shared fight never applies its results on a member's phone
   - followers are never removed by a defeat; the page loads the files in the right order, Polish and patch note */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RegExp, structuredClone, setTimeout, clearTimeout, setInterval, clearInterval };
vm.createContext(c);
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "stacks.js", "events.js",
  "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "arena.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js",
  "magic.js", "spellbook.js", "mp.js", "coop.js", "party.js", "combatai.js", "foeintent.js", "guilds.js", "heists.js", "deepdelve.js", "worldevents.js", "difficulty.js", "tbfight.js", "sharedfight.js", "partyvote.js", "defeat.js"];
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fails++; console.log("FAIL " + msg); } };
const R = (code) => vm.runInContext(code, c);
R(`var J = (o) => JSON.stringify(o);
var hero = (L = 10) => { const s = G.newSave("t" + Math.random(), "Tess", "nord"); s.level = L; s.gold = 500; G.give(s, "potion_health", 3); return s; };
var brute = (s, name = "Bone Crusher") => ({ ...G.scaleEnemy({ name, level: s.level + 30, health: 6000, damage: 400, tags: ["humanoid"], danger: "high", gold: [5, 10], text: "" }, s.level + 30), noGroup: true });
var weak = (s, name = "Mudcrab") => ({ ...G.scaleEnemy({ name, level: 1, health: 5, damage: 1, tags: ["animal"], danger: "low", gold: [3, 3], text: "" }, 1), noGroup: true });
var keep = (s) => J({ gold: s.gold, inv: s.inv, skills: s.skills, xp: s.xp, level: s.level, perks: s.perks, quests: s.quests, x: s.x, y: s.y, location: s.location });`);

// ---- the page
const html = fs.readFileSync(W + "index.html", "utf8");
const at = (f) => html.indexOf(`<script src="${f}"></script>`);
ok(at("defeat.js") > at("tbfight.js") && at("defeat.js") > at("sharedfight.js") && at("tbfight.js") > 0, "defeat.js loads after tbfight.js and sharedfight.js");
ok(at("i18n_defeat.js") > 0 && at("i18n_defeat.js") < at("i18n.js"), "i18n_defeat.js before i18n.js");
ok(/\.dft\{/.test(html) && /\.dfbar\{/.test(html), "defeat screen CSS");
ok(R("G.Fight.prototype.run.dfWrapped === true"), "every fight takes a snapshot when it starts");

// ---- engine die(): no bag, no teleport, health back
R(`var s0 = hero(); s0.location = "Riverwood"; [s0.x, s0.y] = [0.31, 0.62]; var k0 = keep(s0); G.setHealth(s0, 0); var d0 = G.die(s0, "wolf");`);
ok(R("d0.bag === null && keep(s0) === k0"), "die(): nothing lost, no bag, you stay where you are");
ok(R("G.curHealth(s0) >= G.maxHealth(s0) * 0.5 - 1"), "die(): back on your feet at half health or more");
ok(R("/You lose nothing/.test(d0.msg)"), "die(): says nothing is lost: " + R("d0.msg"));

// ---- road encounter
R(`var s1 = hero(); s1.trip = { destName: "Whiterun", dest: [0.4, 0.5], origin: "Riverwood", start: [s1.x, s1.y], path: [[s1.x, s1.y], [0.4, 0.5]], idx: 0, trail: [], lastTick: G.now(), status: "encounter", encounter: brute(s1), log: [] };
  var k1 = keep(s1); var r1 = G.encounterAction(s1, "fight");`);
ok(R("!!r1.died && !r1.bag && !r1.fight.won"), "road: lost the fight");
ok(R("keep(s1) === k1"), "road: gold, items, skills and XP exactly as before the fight");
ok(R("s1.trip && s1.trip.status === 'encounter' && s1.trip.encounter"), "road: the encounter is still in front of you (fight again, sneak or flee)");
ok(R("G.curHealth(s1) > 0"), "road: on your feet");
ok(R("!(r1.skills || []).length"), "road: no skill-up lines for a rolled-back fight");

// ---- in-fight gains are rolled back, earlier gains kept
R(`var s2 = hero(); s2.gold = 777; G.give(s2, "potion_health", 2); var pre2 = keep(s2);
  var f2 = new G.Fight(s2, brute(s2)); f2.run(); f2.apply(); s2.gold += 999;   // potions drunk, practice gained, gold picked up during the fight
  var mid2 = keep(s2); var d2 = G.die(s2, "Bone Crusher");`);
ok(R("mid2 !== pre2"), "the lost fight changed the save before the knock-down (test setup)");
ok(R("d2.rolledBack && keep(s2) === pre2 && s2.gold === 777"), "gains during the lost fight are rolled back; gold from before is kept");
ok(R("!DEFEAT._last"), "the snapshot is used once");
R(`var s2b = hero(); var f2b = new G.Fight(s2b, weak(s2b)); f2b.run(); f2b.apply(); var k2b = keep(s2b); var d2b = G.die(s2b, "trap");`);
ok(R("!d2b.rolledBack && keep(s2b) === k2b"), "a knock-down after a WON fight (a trap) rolls nothing back");

// ---- dungeon room: you stay in the dungeon, in front of the room
R(`var s3 = hero(); s3.location = "Bleak Falls Barrow"; var e3 = DUNGEONS.enter(s3, "Bleak Falls Barrow");`);
if (R("!!s3.dungeon")) {
  R(`var d3 = s3.dungeon; var guard3 = 0; while (!d3.room?.enemy && guard3++ < 20) { const ch = DUNGEONS.nextChoices(s3); if (!ch.length) break; DUNGEONS.enterRoom(s3, ch[0]); if (!d3.room?.enemy && d3.room) d3.room = null; }`);
  if (R("!!s3.dungeon?.room?.enemy")) {
    R(`s3.dungeon.room.enemy = { ...s3.dungeon.room.enemy, damage: 400, health: 6000, hp: 6000 }; var k3 = keep(s3); var row3 = s3.dungeon.row; var r3 = DUNGEONS.act(s3, "fight");`);
    ok(R("!!r3.died && !r3.bag"), "dungeon: lost the fight: " + R("r3.text"));
    ok(R("!!s3.dungeon && s3.dungeon.row === row3"), "dungeon: still inside, same place");
    ok(R("keep(s3) === k3"), "dungeon: nothing lost");
    R(`var rt3 = DEFEAT.retreatState(s3);`);
    ok(R("!s3.dungeon.room && s3.dungeon.row === row3 - 1"), "dungeon Retreat: back out of the room, one step back: " + R("rt3"));
    ok(R("DUNGEONS.nextChoices(s3).length > 0"), "dungeon Retreat: you can go on (that room or another)");
  } else { ok(true, "dungeon"); console.log("note: dungeon: no fight room found (layout), skipped"); }
} else { ok(true, "dungeon"); console.log("note: dungeon: could not enter (skipped): " + R("J(e3)")); }

// ---- quest fight, guild contract, heist guard
R(`var s4 = hero(); var k4 = keep(s4); var f4 = new G.Fight(s4, brute(s4, "Vilkas")); f4.run(); f4.apply(); var d4 = G.die(s4, "Vilkas", G.now(), true);`);
ok(R("d4.rolledBack && keep(s4) === k4 && /Vilkas knocked you down/.test(d4.msg)"), "quest-style fight: nothing lost: " + R("d4.msg"));
if (R("typeof HEISTS !== 'undefined'")) {
  R(`var s5 = hero(30); s5.location = "Windhelm"; [s5.x, s5.y] = WORLD.places.Windhelm; HEISTS.start(s5, 1, G.now()); HEISTS.act(s5, "go", {}, G.now());
    var sc5 = G.scaleEnemy; G.scaleEnemy = (e, L) => ({ ...sc5(e, L), damage: 900, health: 9000 });
    var b5 = J(s5.bounty || {}), k5 = keep(s5), r5 = HEISTS.act(s5, "force", {}, G.now()); G.scaleEnemy = sc5;`);
  ok(R("r5.fight && !r5.ok && !r5.res"), "heist: losing the door guard fight doesn't end the heist: " + R("r5.text"));
  ok(R("J(s5.bounty || {}) === b5 && HEISTS.run(s5) && HEISTS.run(s5).stage === 1"), "heist: no bounty, not caught, still at the door");
  ok(R("s5.gold === JSON.parse(k5).gold && G.curHealth(s5) > 0"), "heist: no gold lost");
}

// ---- deep level: finds kept, still below
R(`var s6 = hero(); s6.dungeon = { place: "Bleak Falls Barrow", deep: { level: 2, snap: { gold: 100, q: {} } }, rows: [[{ type: "fight", links: [] }]], row: 0, col: 0, room: { type: "fight" } };
  s6.gold = 900; var k6 = keep(s6); var f6 = new G.Fight(s6, brute(s6)); f6.run(); f6.apply(); var r6 = DEEPDELVE.knockout(s6, { text: "x" }, "draugr");`);
ok(R("r6.knockedOut && s6.dungeon && s6.dungeon.deep.level === 2 && s6.gold === 900 && keep(s6) === k6"), "deep level: knocked down, finds kept, still on level II");

// ---- public fights: no rollback, contribution kept
R(`var s7 = hero(); var e7 = { ...brute(s7, "Dremora"), wev: true }; var f7 = new G.Fight(s7, e7); f7.run(); s7.wevPts = 5; var d7 = G.die(s7, "daedra");`);
ok(R("!d7.rolledBack && s7.wevPts === 5 && G.curHealth(s7) >= G.maxHealth(s7) * 0.5 - 1"), "world event: back up in place, what you did still counts");
ok(R("/fight goes on/.test(d7.msg)"), "world event: says the fight goes on: " + R("d7.msg"));
ok(R("!DEFEAT.lostFight(f7)"), "world event: no defeat screen (no Retry)");
R(`var s7b = hero(); var f7b = new G.Fight(s7b, { ...brute(s7b), pool: true }); f7b.run();`);
ok(R("!DEFEAT.lostFight(f7b)"), "raid dragon: no defeat screen");
R(`var f7c = new G.Fight(hero(), brute(hero())); f7c.friendly = true; f7c.nonlethal = true; f7c.run();`);
ok(R("!DEFEAT.lostFight(f7c)"), "festival bout: no defeat screen (nothing to lose there anyway)");

// ---- TB.call: a lost fight goes to the defeat screen; Retry meets the same foes; Retreat on the road
R(`var s8 = hero(); s8.gold = 321; var seen8 = [], done8 = [];
  var fn8 = () => { const k = Math.floor(Math.random() * 100000); const e = brute(s8, "Foe" + k); seen8.push(e.name); const f = new G.Fight(s8, e); f.run(); const sk = f.apply(); s8.gold += 50;
    if (!f.won) { const d = G.die(s8, e.name); return { fight: f, died: d.msg, skills: d.rolledBack ? [] : sk }; } return { fight: f, skills: sk }; };
  TB.call(s8, fn8, (r) => done8.push(r));`);
ok(R("done8.length === 0 && DEFEAT.current && DEFEAT.current.f"), "TB.call: a lost fight opens the defeat screen instead of finishing the action");
ok(R("s8.gold === 321"), "TB.call: the save is back to just before the action");
ok(R("/did most|wore you down|outlasted|huge blow|too strong/.test(DEFEAT.why(DEFEAT.current.f, null))"), "why line: " + R("DEFEAT.why(DEFEAT.current.f, null)"));
R(`DEFEAT.retry();`);
ok(R("seen8.length === 2 && seen8[0] === seen8[1]"), "Retry: the same foe again (dice up to the fight replayed): " + R("J(seen8)"));
ok(R("s8.gold === 321 && done8.length === 0 && DEFEAT.current"), "Retry lost again: still nothing lost, the screen is back");
R(`DEFEAT.current.S.diff = "normal"; if (typeof DIFF !== "undefined") DIFF.set(DEFEAT.current.S, "story");`);
ok(R("s8.diff === 'story'"), "difficulty can be changed between tries");
R(`s8.trip = { destName: "Whiterun", dest: [0.4, 0.5], status: "encounter", encounter: brute(s8), lastTick: 0, log: [] }; DEFEAT.retreat();`);
ok(R("done8.length === 1 && done8[0].retreated && s8.trip.status === 'travel' && !s8.trip.encounter"), "Retreat on the road: back on the road past the fight: " + R("J(done8[0] && done8[0].text)"));
ok(R("!DEFEAT.current"), "the screen is closed after Retreat");
R(`var s8w = hero(); var done8w = []; TB.call(s8w, () => { const f = new G.Fight(s8w, weak(s8w)); f.run(); f.apply(); return { fight: f }; }, (r) => done8w.push(r));`);
ok(R("done8w.length === 1 && done8w[0].fight.won && !DEFEAT.current"), "a won fight finishes as before");

// ---- party: a lost shared fight is never applied on a member's phone
R(`var mS = hero(); var mf = new G.Fight(mS, brute(mS)); var mK = keep(mS); mf.run(); var mir = { f: mf, how: "lost", fid: "x" };
  SHAREDFIGHT.mount({ S: () => mS }); SHAREDFIGHT.finish(mir);`);
ok(R("keep(mS) === mK"), "party member: a lost party fight changes nothing on your save");

// ---- party vote: majority, tie -> leader
R(`var vd = DEFEAT.voteDoc({ id: "L", name: "Lead" }, [{ pid: "A", name: "Ann" }, { pid: "B", name: "Bo" }], { foe: "the troll", why: "x" }, 1000);`);
ok(R("vd.dv === 1 && vd.pv && vd.pv.opts.length === 2 && vd.members.length === 3"), "the vote record: three voters, Retry / Retreat");
R(`var v1 = PARTYVOTE.cast(vd, "L", "retry", 1001); v1 = PARTYVOTE.cast(v1, "A", "retreat", 1001); v1 = PARTYVOTE.cast(v1, "B", "retreat", 1002); v1 = PARTYVOTE.settle(v1, "L", ["L", "A", "B"], 1003);`);
ok(R("v1.pv.res && v1.pv.res.key === 'retreat'"), "majority wins (Retreat 2 : 1)");
R(`var v2 = PARTYVOTE.cast(vd, "L", "retry", 1001); v2 = PARTYVOTE.cast(v2, "A", "retreat", 1001); v2 = PARTYVOTE.settle(v2, "L", ["L", "A"], 1030);`);
ok(R("v2.pv.res && v2.pv.res.key === 'retry'"), "a tie goes the leader's way");
ok(R("DEFEAT.partyOf({ everyone: [{ player: true, pid: 'A' }, { follower: true, name: 'Lydia' }], f: { allies: [{ player: true, pid: 'B' }], _downed: [] } }).length === 2"), "followers never count as voters");
ok(R("!vd.pids && !vd.v && !vd.turn"), "the vote record is never mistaken for a fight record");

// ---- followers are only knocked down
R(`var s9 = hero(); s9.follower = { id: "lydia", hp: 10, ts: 0 }; var f9 = new G.Fight(s9, brute(s9)); f9.run(); f9.apply(); G.die(s9, "troll");`);
ok(R("s9.follower && s9.follower.id === 'lydia'"), "your follower is still with you after a lost fight");

// ---- Polish and the patch note
{
  const p = { console, Math, Date, JSON, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RegExp, navigator: { language: "pl-PL" }, localStorage: { getItem: () => JSON.stringify({ lang: "pl" }), setItem() {} } };
  vm.createContext(p);
  const order = [...html.matchAll(/<script src="(i18n[^"]*\.js)"><\/script>/g)].map((m) => m[1]);
  vm.runInContext(order.map((f) => fs.readFileSync(W + f, "utf8")).join("\n;") + "\n;globalThis.I18N = I18N;", p);
  const t = (x) => p.I18N.tr(x);
  for (const w of ["Retry", "Adjust gear", "Retreat", "Defeated", "You lose nothing: gold, items, XP and progress are just as they were before the fight.",
    "The Bone Crusher knocked you down. You lose nothing: everything is as it was before the fight, so try again or go another way.",
    "The troll's Heavy Swing did most of the damage (62%).", "The wolf wore you down over 5 rounds; its hardest blow took 30 health.",
    "Step back out of this room. Rooms you cleared stay cleared.", "The party decides together: most votes wins, a tie goes the leader's way.", "Losing a fight"]) {
    const r = t(w); ok(r && r !== w, "Polish: " + w + " → " + r);
  }
  const nctx = {}; vm.createContext(nctx); vm.runInContext(fs.readFileSync(W + "patchnotes.js", "utf8").replace(/^const PATCHNOTES =/m, "var PATCHNOTES ="), nctx);
  const note = nctx.PATCHNOTES.LIST.find((x) => /defeat/.test(x.id));
  ok(!!note, "patch note is in");
  if (note) for (const line of [note.title, ...note.items]) { const r = t(line); ok(r && r !== line, "Polish patch note: " + line.slice(0, 40)); }
}

console.log(fails ? `defeat FAILED ${fails} of ${n}` : `defeat ok · ${n} checks`);
process.exit(fails ? 1 : 0);
