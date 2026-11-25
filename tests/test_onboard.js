const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* A clearer first hour (onboard.js): "what to do next" ideas picked from the save, first-time tips, the switches,
   veterans, and the hooks in ui.js / index.html. W=/path/to/game/ node test_onboard.js — prints "onboard ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const store = {};
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, URLSearchParams,
  localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] } };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "first30.js", "guilds.js", "immerse.js", "rumours.js", "horses.js", "homestead.js", "guide.js", "onboard.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const ok = (cnd, m) => { n++; if (!cnd) throw new Error("FAIL " + m); };
const mk = (town = "Riverwood") => { const s = G.newSave("ob" + Math.random(), "Hrolf", "nord"); s.location = town; [s.x, s.y] = WORLD.places[town]; G.setHealth(s, G.maxHealth(s)); QUESTS.ensure(s); return s; };
const ctx = { eta: () => "2 min", known: () => true };
const ids = (s, x = {}) => ONBOARD.ideas(s, { ...ctx, ...x }).map((i) => i.id);

// 1. a brand-new character: road fights near Whiterun first; nothing during the opening quest line (first30.js)
{
  const s = mk();
  const a = ids(s);
  ok(a.length >= 1 && a.length <= 3, "1-3 ideas: " + a);
  ok(a[0] === "road", "low level: road fights first: " + a);
  const road = ONBOARD.ideas(s, ctx)[0];
  ok(road.btn && road.btn.act === "go" && G.holdAt(WORLD.places[/data-place="([^"]+)"/.exec(road.btn.attrs)[1]]) === "Whiterun", "road idea goes somewhere in Whiterun hold");
  FIRST30.start(s);
  ok(ids(s).length === 0, "no ideas during the opening quest line");
  FIRST30.skip(s);
  ok(!ids(s).includes("dungeon") && !ids(s).includes("horse"), "no dungeon or horse at level 1 with 100 gold");
}
// 2. state-driven picks
{
  const s = mk(); s.level = 3; s.lt = { foes: 10 }; s.gold = 1400;
  const all = ONBOARD.candidates(s, ctx).map((i) => i.id);
  ok(all.includes("dungeon") && all.includes("horse") && !all.includes("road"), "level 3 with gold: dungeon + horse, no more road: " + all);
  ok(all.includes("party") === false, "offline: no party idea");
  ok(ONBOARD.candidates(s, { ...ctx, online: true }).some((i) => i.id === "party"), "online and alone: party idea");
  ok(!ONBOARD.candidates(s, { ...ctx, online: true, party: true }).some((i) => i.id === "party"), "already in a party: no party idea");
  s.cleared = { "Bleak Falls Barrow": G.now() };
  ok(!ONBOARD.candidates(s, ctx).some((i) => i.id === "dungeon"), "cleared a dungeon: no dungeon idea");
  s.horse = { name: "Frost" };
  ok(!ONBOARD.candidates(s, ctx).some((i) => i.id === "horse"), "has a horse: no horse idea");
  // the main quest when you track something else
  ok(ONBOARD.candidates(s, { ...ctx, quest: "companions" }).some((i) => i.id === "mainq"), "main quest idea when tracking another quest");
  ok(!ONBOARD.candidates(s, { ...ctx, quest: "main" }).some((i) => i.id === "mainq"), "no main quest idea when it's already tracked");
  // hurt / heavy go first
  G.setHealth(s, 5); ok(ONBOARD.ideas(s, ctx)[0].id === "heal", "badly hurt: heal first");
  G.setHealth(s, G.maxHealth(s)); G.give(s, "mat_iron", 600); ok(ONBOARD.ideas(s, ctx)[0].id === "heavy", "too heavy: lighten first");
  // homestead and rumours once they matter
  const r = mk("Whiterun"); r.level = 5; r.lt = { foes: 10 };
  ok(ONBOARD.candidates(r, ctx).some((i) => i.id === "rumour"), "level 5 in a town with an inn: rumours");
  r.rw = { seen: 1, list: [] }; ok(!ONBOARD.candidates(r, ctx).some((i) => i.id === "rumour"), "heard one already: no rumour idea");
  ok(!ONBOARD.candidates(r, ctx).some((i) => i.id === "homestead"), "no homestead idea at level 5");
  r.gold = 6000; ok(ONBOARD.candidates(r, ctx).some((i) => i.id === "homestead"), "rich: homestead idea");
  for (const i of ONBOARD.candidates(r, { ...ctx, online: true })) ok(!/undefined|NaN|\\{/.test(i.title + i.sub), "clean text: " + i.title + " / " + i.sub);
}
// 3. hiding, switching off, veterans
{
  const s = mk(); const first = ids(s)[0];
  s.onb = { seen: {}, hid: { [first]: 1 } };
  ok(!ids(s).includes(first), "a hidden idea stays hidden");
  ONBOARD.pref("obNext", "false"); ok(!ONBOARD.ideasOn() && ids(s).length === 0, "switched off: no ideas");
  ONBOARD.pref("obNext", "true"); ok(ONBOARD.ideasOn() && ids(s).length > 0, "switched back on");
  s.level = ONBOARD.VETERAN; ok(ids(s).length === 0, "veterans get no ideas");
  ok(ONBOARD.rows(mk(), ctx).every((h) => /data-ob="hide"/.test(h) && /class="item nx obrow"/.test(h)), "rows carry a hide button");
  ok(ONBOARD.pref("survival", "true") === false, "other settings aren't touched");
}
// 4. first-time tips: one at a time, once, and the switch
{
  const s = mk();
  ok(ONBOARD.pickTip(s, { fightOpen: false, invites: 0 }) === null, "nothing to say at the start");
  s.pendingLevels = 1;
  ok(ONBOARD.pickTip(s, { fightOpen: false, invites: 0 }).id === "level", "first level-up tip");
  ok(ONBOARD.pickTip(s, { fightOpen: true, invites: 0 }) === null, "no tip card over a fight (its hints are pinned to the controls)");
  ok(!ONBOARD.TIPS.some((t) => t[0] === "tbfight" || t[0] === "welcome") && ONBOARD.HINTS.map((h) => h[0]).join() === "attack,intent,guard,end", "no welcome popup; four pinned fight hints");
  { const o = mk(); o.pendingLevels = 1; FIRST30.start(o); ok(ONBOARD.pickTip(o, { fightOpen: false, invites: 0 }) === null, "no level-up tip while the opening quest walks you through it"); }
  const hf = (seen, x) => ONBOARD.hintsFor(seen, { open: true, mine: true, acts: 0, ints: true, ...x }).join();
  ok(hf({}) === "attack", "one hint at a time: Attack first");
  ok(hf({ "tbf-attack": 1 }, { acts: 1 }) === "intent", "then what the foe does next");
  ok(hf({ "tbf-attack": 1, "tbf-intent": 1 }, { acts: 1 }) === "end", "then End turn");
  ok(hf({}, { windup: true }) === "attack" && hf({}, { windup: true, acts: 1 }) === "guard" && hf({ "tbf-attack": 1, "tbf-intent": 1, "tbf-end": 1 }, { windup: true }) === "guard", "guard the moment a foe winds up a big blow (after the first Attack)");
  ok(hf({ "tbf-guard": 1 }, { windup: true }) === "attack", "guard is learnt once");
  ok(hf({}, { mine: false }) === "" && hf({ tbfight: 1 }, { windup: true }) === "", "nothing on the foe's turn, nothing once learnt");
  ok(ONBOARD.HINTS.every((h) => h[3].length <= 80), "fight hints are one short line each");
  ONBOARD.markSeen(s, "level"); ok(ONBOARD.pickTip(s, { fightOpen: false, invites: 0 }) === null, "a seen tip doesn't come back");
  ok(ONBOARD.pickTip(s, { fightOpen: false, invites: 1 }).id === "invite", "party invite tip");
  G.give(s, "mat_iron", 600); ok(ONBOARD.pickTip(s, { fightOpen: false }).id === "heavy", "over-encumbered tip");
  const v = mk(); v.level = 30; v.pendingLevels = 1; G.give(v, "mat_iron", 900);
  ok(ONBOARD.pickTip(v, { fightOpen: false, invites: 1 }) === null, "veterans: no basic tips");
  ok(ONBOARD.hintsFor({}, { open: true, mine: true, acts: 0 }).length === 1, "but the fight hints are for everyone");
  ONBOARD.pref("obTips", "false"); ok(ONBOARD.pickTip(s, { fightOpen: false }) === null, "Don't show tips");
  ONBOARD.pref("obTips", "true");
  const d = mk(); d.dungeon = { place: "Bleak Falls Barrow" }; ok(ONBOARD.pickTip(d, { fightOpen: false }).id === "dungeon", "first dungeon tip");
  for (const t of ONBOARD.TIPS) ok(typeof t[3]({}, {}) === "string" && t[3]({}, {}).length > 30, "tip text " + t[0]);
}
globalThis.__n = n;
`, c);
// 5. hooks: script order, ui.js calls, settings, CSS at the end of the second style block, patch note
const html = fs.readFileSync(W + "index.html", "utf8"), ui = fs.readFileSync(W + "ui.js", "utf8");
const ok = (cnd, m) => { if (!cnd) throw new Error("FAIL " + m); };
ok(html.indexOf('<script src="onboard.js">') > html.indexOf('<script src="guide.js">') && html.indexOf('<script src="onboard.js">') < html.indexOf('<script src="ui.js">'), "onboard.js loads after guide.js, before ui.js");
const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
ok(styles.length >= 2 && /\.obtip\{/.test(styles[1][1]) && !/\.obtip/.test(styles[0][1]), "CSS in the second style block");
ok(/ONBOARD\.rows\(S/.test(ui) && /ONBOARD\.mount\(/.test(ui) && /ONBOARD\.settingsHTML\(seg\)/.test(ui) && /ONBOARD\.pref\(k/.test(ui), "ui.js hooks");
ok(!/Fights play out by themselves\. In Tactics/.test(fs.readFileSync(W + "guide.js", "utf8")), "guide talks about turn-by-turn fights");
ok(/A clearer first hour/.test(fs.readFileSync(W + "patchnotes.js", "utf8")), "patch note");
console.log("onboard ok (" + c.__n + " checks)");
