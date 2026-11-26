/* Phantom attacks: nobody swings unless they really struck. W=/path/to/game/ node test_phantom.js [fights]
   Plays many turn-based fights (every build, many foes, a follower, ambushes, every kind of move incl. Breathe, Oil flask,
   Mark, Cover), turns each event into the fight scene's beats exactly as the fight screen does (TB.sceneLines ->
   FIGHTART.beatsOf) and checks every swing, lunge and ally clip against the event that caused it:
   - your figure only swings or casts for your own blow or spell (not for a tick, Breathe, Mark, Cover, Mount)
   - an ally only plays an attack clip on their own turn
   - the foe only swings when its turn was a blow (not a wind-up, aim, war cry, potion, ward, brace, a new foe stepping in)
   - those non-blow turns and automatic extras (Counter, Thorns, Riposte) carry a label for the picture
   Also: a redraw with nothing new keeps the scene on screen instead of playing the last blow again (tbfight.js). */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const N = +(process.env.RUNS || process.argv[2] || 240);
let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const M = Object.create(Math); M.random = rnd;
const c = { process: { env: {} }, console, Math: M, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, structuredClone, performance: { now: () => 0 }, N, rnd, setSeed: (s) => { seed = s; } };
vm.createContext(c);
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "stacks.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "foeintent.js", "initiative.js", "tbfight.js", "strategy.js", "reactions.js", "combo.js", "followerai.js", "foekit.js", "dragons.js", "art.js", "allyanim.js", "fightart.js"];
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(String.raw`
let fails = 0; const ok = (v, m) => { if (!v) { fails++; console.log("FAIL", m); } };
const SKILLS = { warrior: [["One-Handed", 1], ["Heavy Armor", 1], ["Blocking", 0.9]], twohand: [["Two-Handed", 1], ["Heavy Armor", 1]], archer: [["Archery", 1], ["Light Armor", 0.9], ["Sneak", 0.6]],
  mage: [["Destruction", 1], ["Restoration", 0.9], ["Conjuration", 0.7], ["Alteration", 0.7]], spellsword: [["One-Handed", 1], ["Destruction", 0.9], ["Restoration", 0.7]] };
const GEAR = { warrior: ["steel_sword", "steel_shield"], twohand: ["steel_battleaxe"], archer: ["hunting_bow"], mage: [], spellsword: ["steel_sword"] };
function hero(b, L) {
  const s = G.newSave("sim", "Sim", "nord"); s._test = true; s.level = L; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun;
  for (const [k, w] of SKILLS[b]) s.skills[k].lvl = Math.min(100, Math.round(s.skills[k].lvl + 2.3 * L * w));
  s.hpBonus = (L - 1) * 5; s.spBonus = (L - 1) * 3; s.mpBonus = (L - 1) * 2;
  for (const id of GEAR[b]) { if (!D.ITEMS[id]) continue; G.give(s, id, 1); try { G.equip(s, id); } catch (e) { /* older saves */ } }
  if (b === "archer" && D.ITEMS.iron_arrow) G.give(s, "iron_arrow", 60);
  for (const id of Object.keys(D.SPELLS)) if ((b === "mage" || b === "spellsword") && !D.SPELLS[id].kind?.startsWith?.("custom") && (s.spells || []).length < 8 && (D.SPELLS[id].cost || 0) < 60) (s.spells = s.spells || []).push(id);
  s.health = G.maxHealth(s); s.healthTs = G.now(); return s;
}
const OLD_LINES = (evs, f) => evs.filter((e) => ["me", "foe", "ally", "tick"].includes(e.kind)).map((e) => ({ turn: e.round, me: e.kind === "foe" ? "" : e.kind === "ally" ? " · " + e.text : e.text, them: e.kind === "foe" ? e.text : "", a: e.a || "attack", wt: e.wt || f.wt, hp: e.hp, ehp: e.ehp }));   // before the fix (to show the bug on old builds)
const enc = (name, L) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, L);
// what counts as a blow on the picture
const SWING = new Set(Object.keys(FIGHTART.MOVES).filter((k) => !["wait", "block", "potion", "self"].includes(k)));
const MY_SWING_A = /^(attack|power_attack|bash|spell|dual|scroll|shout|power|beast|lord|vamp|rx:oil)(:|$)/;
const FOE_BLOW = /\bhits\b|misses|goes for|attacks, but|steps on your|is absorbed|passes through|soaks|reflected|knocks/;
const seen = { hero: 0, ally: 0, foe: 0, prep: 0, tick: 0, recover: 0 };
const builds = Object.keys(SKILLS), foes = D.ENCOUNTERS.filter((e) => !e.boss).map((e) => e.name);
for (let i = 0; i < N; i++) {
  setSeed(1000 + i);
  const b = builds[i % builds.length], L = [5, 12, 20, 30][i % 4], s = hero(b, L);
  if (i % 2) s.follower = { id: "lydia", hp: TOWNS.followerMax(s, "lydia"), ts: G.now() };
  G.give(s, "potion_health", 2);
  const f = new G.Fight(s, enc(foes[i % foes.length], L)); if (i % 3 === 0) f.ai = true;
  const ss = new TB.Session(f, { trySneak: i % 5 === 0, enemyFirst: i % 7 === 0 });
  let r = ss.begin(), g = 0;
  while (!ss.done && g++ < 200) {
    if (r && r.turn === "me") {
      const opts = ["attack", "attack", "power_attack", "block", "bash", "recover", "recover", "rx:oil", "rx:mark", "rx:cover", "potion:potion_health", "end", ...(s.spells || []).map((x) => "spell:" + x)];
      const a = opts[Math.floor(rnd() * opts.length)];
      let rr = ss.canAfford(a) ? ss.act(a) : ss.act("end");
      if (!rr || rr.err) rr = ss.act("end");
      r = rr && rr.turn === "me" ? rr : ss.advance();
    } else r = ss.advance();
  }
  const h = FIGHTART.heroOf(s, f);
  const check = (evs) => {   // one screen's worth of events, as the fight screen plays them
    const lines = (TB.sceneLines || OLD_LINES)(evs, f); if (!lines.length) return;
    const v = Object.create(f); v.log = lines; v.tbMid = true;
    const beats = FIGHTART.beatsOf(v, h);
    for (const bt of beats) {
      const ev = evs.filter((e) => ["me", "foe", "ally", "tick"].includes(e.kind))[bt.li], why = ev ? ev.kind + " " + (ev.a || "") + ": " + ev.text : "?";
      if (bt.who === "me" && !bt.allyOnly && SWING.has(bt.move)) { seen.hero++; ok(ev.kind === "me" && MY_SWING_A.test(ev.a || ""), "you swing (" + bt.move + ") without a blow: " + why); }
      if (bt.who === "me" && bt.ally && !bt.allyOnly) ok(ev.kind === "me", "your allies lunge on a line that isn't yours: " + why);
      if (ev && ev.kind === "tick") { seen.tick++; ok(bt.move === "wait" && !(bt.allyActs || []).length && !bt.ally, "a tick moves someone: " + why); }
      if (ev && ev.a === "recover") { seen.recover++; ok(bt.move === "wait" && bt.tag, "Breathe is drawn as a breather with a label: " + why); }
      for (const aa of bt.allyActs || []) if (aa.clip === "attack" || aa.clip === "shoot") { seen.ally++; ok(ev.kind === "ally" && ev.name === aa.name, aa.name + " attacks on someone else's line: " + why); }
      if (bt.who === "them" && SWING.has(bt.move)) { seen.foe++; ok(ev.kind === "foe" && FOE_BLOW.test(ev.text.replace(/\([^)]*\)/g, "")), "the foe swings (" + bt.move + ") without a blow: " + why); }
      if (bt.who === "them" && bt.prep) { seen.prep++; ok(bt.move === "wait", "a wind-up stays still: " + why); }
    }
  };
  for (const ev of ss.ev) check([ev]);   // paced: one event at a time
  for (let k = 0; k < ss.ev.length; k += 6) check(ss.ev.slice(k, k + 6));   // Fast: a few at once
}
ok(seen.hero > 200 && seen.foe > 200 && seen.ally > 50 && seen.prep > 20 && seen.tick > 20 && seen.recover > 10, "enough of everything was seen: " + JSON.stringify(seen));

// the pieces one by one
{ const f = { e: { name: "Bandit outlaw" }, log: [], allies: [{ name: "Lydia" }], hp0: 50, ehp0: 50 }, h = { wt: "sword", list: [{ name: "Lydia" }] };
  const beat = (l) => { f.log = [l]; return FIGHTART.beatsOf(f, h); };
  let b = beat({ me: "You catch your breath (+30 stamina)", them: "", a: "recover", hp: 50, ehp: 50 })[0];
  ok(b.move === "wait" && b.tag === "Catch breath", "Breathe: no swing, a label");
  b = beat({ me: "You stand guard over your friends: blows meant for them come to you", them: "", a: "rx:cover" })[0]; ok(b.move === "block" && b.tag === "Cover!", "Cover allies: a guard, not a swing");
  b = beat({ me: "You mark the bandit outlaw: arrows and bolts at it land as critical hits", them: "", a: "rx:mark" })[0]; ok(b.move === "wait" && b.tag === "Marked!", "Mark: no swing");
  b = beat({ me: "You swing up onto Shadowmere", them: "", a: "mount" })[0]; ok(b.move === "wait", "Mount: no swing");
  b = beat({ me: "Flame Cloak 4 · Lydia's flaming blade 5 · sets it burning", them: "", a: "tick", hp: 50, ehp: 40 })[0];
  ok(b.move === "wait" && !b.ally && !(b.allyActs || []).length && b.burn, "a tick: flames on the foe, nobody swings");
  b = beat({ me: "You hit 12 (riposte)", them: "", a: "attack" })[0]; ok(b.move === "sword" && b.tag === "Riposte!", "a riposte says so");
  b = beat({ me: "You hit 12 · Flame Cloak 4", them: "", a: "attack" })[0]; ok(!b.ally, "your cloak's damage doesn't make the followers lunge");
  b = beat({ me: "You hit 12 · Lydia 9", them: "", a: "attack" })[0]; ok(b.ally, "a follower's blow in your line still does");
  for (const [t, tag] of [["Bandit outlaw lifts the weapon high, winding up a huge blow. Guard or hit them hard!", "Winds up!"], ["you take 4 from poison · Bandit outlaw draws and takes careful aim at you... (guard −3)", "Takes aim!"],
    ["Bandit outlaw roars a war cry (hits 20% harder for 2 turns)", "War cry!"], ["Bandit outlaw gulps down a healing potion: +30", "Heals"], ["Bandit outlaw raises a ward against your spells (40)", "Ward up"],
    ["Bandit outlaw raises a shield and braces (your next melee blow does half)", "Braces"], ["Bandit outlaw slips into the shadows (your next blow may miss)", "Hides"], ["A bandit outlaw brute steps in! (2 more behind it)", null]]) {
    b = beat({ me: "", them: t, hp: 50, ehp: 50 })[0]; ok(b.move === "wait" && b.prep && b.tag === tag, "foe prep '" + t + "' -> " + b.move + " " + b.tag); }
  for (const t of ["Bandit outlaw hits 12", "Bandit outlaw misses", "Bandit outlaw hits Lydia 7", "Bandit outlaw brings the huge blow down: hits 30 (guard −4)", "Ambush! Bandit outlaw hits 9", "you take 4 from poison · Bandit outlaw hits 8"]) {
    b = beat({ me: "", them: t, hp: 50, ehp: 50 })[0]; ok(SWING.has(b.move) && !b.prep, "a real blow still swings: " + t); }
  b = beat({ me: "", them: "Bandit outlaw misses · you punch back 7", hp: 50, ehp: 43 })[0]; ok(b.tag === "Counter!", "Counterpunch is labelled");
  b = beat({ me: "", them: "Bandit outlaw hits 9 · thorns 2", hp: 41, ehp: 48 })[0]; ok(b.tag === "Thorns!", "Thorns are labelled"); }
// a teammate's moves as another phone sees them (sharedfight.js voices them: "Alfa catches their breath")
{ const N2 = ["Alfa"], A = ALLYANIM;
  for (const [t, want] of [["You catch your breath (+30 stamina)", null], ["You try to break away, but the bandit cuts you off (40%)", null], ["You throw an oil flask: the bandit is soaked. Fire will set the ground ablaze.", null],
    ["You mark the bandit: arrows and bolts at it land as critical hits", null], ["You stand guard over your friends: blows meant for them come to you", "block"], ["You hit 12", "attack"], ["You hold back and keep your guard up (−30% damage)", "block"]]) {
    const v = TB.voice(t, "Alfa"), got = (A.actsOf(v, N2)[0] || {}).clip || null; ok(got === want, "teammate line '" + v + "' -> " + got + " (want " + want + ")"); } }
// the lines: a tick is a tick
ok(TB.sceneLines([{ kind: "tick", text: "the bandit burns for 4", round: 2 }], { wt: "sword" })[0].a === "tick", "sceneLines: a tick isn't an attack");
console.log(fails ? fails + " FAILED" : "ALL OK", JSON.stringify(seen));
if (fails) process.exitCode = 1;
`, c);
// a redraw with nothing new keeps the scene (it used to rebuild it, and a scene still playing started over: the last blow again)
{ const src = fs.readFileSync(W + "tbfight.js", "utf8");
  if (!/keepScene = !scene && ui\.lastScene/.test(src) || !/box\.prepend\(keepScene\)/.test(src)) { console.log("FAIL the fight screen rebuilds the scene on every redraw"); process.exitCode = 1; } }
