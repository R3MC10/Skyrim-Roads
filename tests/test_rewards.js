const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* One reward pipeline (rewards.js on top of notices.js): the five weights, the quiet tiny line that merges what comes
   together, scenes that wait out fights and busy screens and never stack, "Level N brings …", and what happens with and
   without unlocks.js. W=/path/to/game/ node test_rewards.js — prints "rewards ok". */
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String, RegExp, setTimeout, clearTimeout };
vm.createContext(c);
const load = (f) => vm.runInContext(fs.readFileSync(__GAME + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
load("notices.js");
load("rewards.js");
vm.runInContext(`
var n = 0; const ok = (cnd, m) => { n++; if (!cnd) throw new Error("FAIL " + m); };
const R = REWARDS, N = NOTICES;
// 1. weights and lanes
{
  ok(R.WEIGHTS.join() === "tiny,small,medium,big,milestone", "five weights, smallest first");
  ok(R.weigh("gold") === "tiny" && R.weigh("loot") === "tiny" && R.weigh("xp") === "tiny", "loot, gold and skill XP are tiny");
  ok(R.weigh("upgrade") === "small" && R.weigh("discovery") === "small" && R.weigh("goal") === "small", "an upgrade, a discovery, a goal: small");
  ok(R.weigh("level") === "medium" && R.weigh("perk") === "medium" && R.weigh("quest") === "medium", "a level, a perk point, a quest: medium");
  ok(R.weigh("unlock") === "big" && R.weigh("follower") === "big" && R.weigh("ability") === "big", "an unlock, a follower, a new ability: big");
  ok(R.weigh("legendary") === "milestone" && R.weigh("boss") === "milestone" && R.weigh("clan") === "milestone", "legendary, big boss, clan: milestone");
  ok(R.weigh("gold", "big") === "big", "an explicit weight wins");
  ok(R.weigh("something new") === "small", "an unknown kind is a small toast, never a scene");
  ok(R.lane("tiny") === "line" && R.lane("small") === "toast" && R.lane("medium") === "notice" && R.lane("big") === "scene" && R.lane("milestone") === "scene", "each weight has its lane");
}
// 2. the tiny line merges
{
  const P = R.part;
  ok(R.line([P.gold(24), P.xp("One-Handed", 15)]) === "+24 gold · +15 One-Handed", "gold and skill practice on one line");
  const m = R.merge([P.gold(10), P.item("Iron Dagger")], [P.gold(14), P.item("Iron Dagger"), P.xp("One-Handed", 15)]);
  ok(m.length === 3 && R.line(m) === "+24 gold · +15 One-Handed · Iron Dagger ×2", "the same kind adds up, gold first, items last");
  ok(R.line([P.xp("Archery", 0.4)]) === "", "a crumb of XP alone shows nothing");
  ok(R.line([P.gold(1), P.item("A"), P.item("B"), P.item("C"), P.item("D"), P.item("E")]) === "+1 gold · A · B · C · +2 more", "a long haul is cut short");
  ok(R.line([P.gold(12345)]) === "+12,345 gold", "big numbers read easily");
  // rarity colours: a rarity field wins, else colorcode.js's tier, else none
  ok(R.rarity("Iron Dagger") === "", "no item table: no colour, no crash");
  globalThis.D = { ITEMS: { iron_dagger: { name: "Iron Dagger" }, moon_blade: { name: "Moon Blade", rarity: "Epic" } } };
  globalThis.CC = { tier: (id) => (id === "iron_dagger" ? "common" : "fine") };
  ok(R.rarity("Moon Blade") === "epic" && P.item("Moon Blade").q === "epic", "a rarity field on the item is used");
  ok(R.rarity("iron_dagger") === "common" && R.rarity("Iron Dagger") === "common", "else the colour-code tier, by id or by name");
  ok(R.merge([P.item("Moon Blade")], [P.item("Moon Blade")])[0].q === "epic", "merged items keep their rarity");
  const el = { textContent: "+5 gold · Moon Blade · Iron Dagger", innerHTML: "" };
  R.paint(el, [P.gold(5), P.item("Moon Blade"), P.item("Iron Dagger")]);
  ok(el.innerHTML === '<span class="rw-line">+5 gold · <b class="q-epic rw-qn">Moon Blade</b> · Iron Dagger</span>', "the line colours the rare name, common stays plain");
  delete globalThis.D; delete globalThis.CC;
}
// 3. the tiny line waits for a fight, then comes out as one line
{
  const T = R.tinyCore(700, 2500), P = R.part;
  T.add([P.gold(5)], 0); T.add([P.xp("One-Handed", 6)], 200); T.add([P.gold(7)], 400);
  ok(T.due(500, {}) === null, "still arriving: it waits a moment");
  ok(T.due(1200, { fight: true }) === null, "a fight is on: it waits");
  T.add([P.xp("One-Handed", 9)], 1500);
  ok(T.due(5000, { block: true }) === null, "a window is open: it waits");
  const out = T.due(5000, {});
  ok(out && R.line(out) === "+12 gold · +15 One-Handed", "after the fight: one line with everything");
  ok(T.size === 0 && T.due(9000, {}) === null, "and then it's empty");
  T.add([P.xp("Block", 0.3)], 10000);
  ok(T.due(20000, {}) === null && T.size === 1, "XP crumbs keep for later");
  T.add([P.xp("Block", 0.9)], 20000);
  ok(R.line(T.due(30000, {})) === "+1 Block", "and show once they make a whole point");
  const T2 = R.tinyCore(700, 2500);
  for (let t = 0; t <= 3000; t += 300) T2.add([P.gold(1)], t);
  ok(T2.due(3000, {}) !== null, "a steady stream still shows every few seconds");
}
// 4. scenes in the window queue: wait for fights and busy screens, never two at once, never because you tapped
{
  const q = N.core();
  ok(q.ask({ key: "rw:a", scene: true }, 0, { fight: true }) === "queued", "a fight is on: the scene waits");
  ok(q.tick(1000, { fight: true }) === null, "still fighting: nothing");
  ok(q.tick(2000, { busy: true }) === null, "the dungeon screen or a party vote: it still waits");
  ok(q.ask({ key: "rw:b", scene: true }, 2100, { busy: true }) === "queued", "a second big moment lines up behind");
  ok(q.tick(3000, {}).key === "rw:a", "all clear: the first scene plays");
  ok(q.tick(3100 + N.GAP, { cur: true }) === null, "one at a time: the second waits while the first is up");
  ok(q.ask({ key: "rw:a", scene: true }, 3200, { cur: true, modal: true }) === "merged", "the same scene twice: once");
  q.tick(4000, {}); ok(q.tick(4000 + N.GAP, {}).key === "rw:b", "closed: then the next one");
  const q2 = N.core();
  q2.ask({ key: "shop" }, 0, {});
  ok(q2.ask({ key: "rw:c", scene: true }, 10, { modal: true, cur: true, input: true }) === "queued", "a tap never throws a scene over your window");
  ok(q2.ask({ key: "rw:d", scene: true }, 20, { busy: true }) === "queued", "uninvited over the level-up pillars: it waits");
  const q3 = N.core();
  ok(q3.ask({ key: "rw:e", scene: true }, 0, {}) === "show", "a clear screen: the scene plays at once");
  ok(q3.displaced({ input: true }) === true && q3.queue[0].key === "rw:e", "pushed off by a tap: the scene comes back, it isn't lost");
  const q4 = N.core();
  q4.ask({ key: "rw:f", scene: true }, 0, { busy: true });
  q4.ask({ key: "news" }, 10, { busy: true });
  ok(q4.tick(100 + N.GAP, { busy: true }).key === "news", "a small window behind a waiting scene isn't stuck");
  q4.tick(200 + N.GAP, {}); ok(q4.tick(200 + 2 * N.GAP, {}).key === "rw:f", "the scene plays when you're done");
}
// 5. unlock scenes and "Level N brings …"
{
  const sc = R.levelScene(4, ["smithing"]);
  ok(sc.w === "big" && sc.kicker === "Level 4" && sc.title === "Smithing unlocked", "LEVEL 4 · Smithing unlocked");
  ok(/forge/.test(sc.line) && sc.perk === true && sc.sel.length === 1, "one line on what you can do now, the forge button shines after");
  const two = R.levelScene(5, [{ id: "followers", name: "Followers and hirelings" }, "alchemy"]);
  ok(two.title === "Followers and hirelings unlocked" && two.more.join() === "Alchemy", "two at once: one scene, the other as 'also new'");
  ok(R.levelScene(3, []) === null, "nothing opened: no scene");
  ok(R.brings(5, [{ id: "followers", level: 5, name: "Followers" }, { id: "horses", level: 6 }]) === "Level 5 brings: Followers · a perk point", "the next level's unlock, not the one after");
  ok(R.brings(3, []) === "Level 3 brings: a perk point and +10 to Health, Magicka or Stamina", "no unlocks: what every level gives");
  ok(/^<div class="sheet rw-sheet"/.test(R.html(sc)) && /Got it/.test(R.html(sc)) && /Smithing unlocked/.test(R.html(sc)), "the scene draws");
  ok(/Onwards/.test(R.html({ w: "milestone", title: "Dragonslayer" })), "a milestone has its own button");
  ok(!/<script/.test(R.html({ w: "big", title: "<script>x</script>" })), "names are escaped");
}
// 6. without unlocks.js: a level-up stays the LEVEL UP notice, the preview tells what every level gives
{
  ok(typeof UNLOCKS === "undefined", "no unlocks.js loaded");
  const s = { level: 4, skills: {} }; R._set(s);
  ok(R.opened(s, 4).length === 0, "nothing opened");
  ok(R.onLevel(s, 4) === false, "onLevel says no scene: levelup.js shows its own notice");
  ok(R.nextText(s) === "Level 5 brings: a perk point and +10 to Health, Magicka or Stamina", "the fallback preview");
  ok(R.queued === 0, "and nothing is queued");
}
// 7. with unlocks.js (its API: open / next / justOpened / on, the event {s, level, ids})
{
  globalThis.UNLOCKS = {
    get: (id) => ({ smithing: { id: "smithing", level: 4, name: "Smithing" }, followers: { id: "followers", level: 5, name: "Followers and hirelings" } })[id] || null,
    justOpened: (s) => (s.level === 4 ? ["smithing"] : []),
    next: (s) => [{ id: "followers", level: 5, name: "Followers and hirelings" }, { id: "horses", level: 6, name: "Horses and carriages" }],
  };
  const s = { level: 4, skills: {} }; R._set(s);
  ok(R.nextText(s) === "Level 5 brings: Followers and hirelings · a perk point", "the preview names the next unlock");
  ok(R.onUnlock({ s, level: 4, ids: ["smithing"] }) === undefined && R.queued === 1, "unlocks.js's own event at the level-up queues the scene");
  ok(R.onLevel(s, 4) === true && R.queued === 1, "levelup.js then finds the same scene waiting: one moment, no LEVEL UP banner as well");
  ok(s.rw && s.rw.seen["u:smithing"] === 1, "kept in the save so it never plays twice");
  const s2 = { level: 5, skills: {} }; R._set(s2);
  ok(R.onLevel(s2, 5) === false, "a level that opens nothing: the normal notice");
  R.onUnlock({ ids: ["alchemy"] });
  ok(R.queued === 2, "something opened outside a level-up (a quest): its own 'Unlocked' scene");
  R.onUnlock({ ids: ["alchemy"] });
  ok(R.queued === 2, "the same unlock twice: once");
  UNLOCKS.justOpened = () => { throw new Error("broken"); };
  ok(R.onLevel({ level: 6, skills: {} }, 6) === false, "a broken unlocks.js never breaks levelling");
  delete globalThis.UNLOCKS;
}
// 8. the save remembers what you had, so old progress isn't celebrated
{
  const s = { level: 20, skills: {}, follower: { id: "lydia" }, horse: { name: "Shadowmere" }, words: ["fus"], spells: ["flames"], dragons: 3, clan: "c1" };
  R._set(s);
  const before = R.queued; R.watch(s);
  ok(R.queued === before, "a veteran's follower, horse, words, dragons and clan don't pop up");
  s.dragons = 10; R.watch(s);
  ok(R.queued === before + 1, "but reaching ten dragons does");
}
console.log("rewards ok (" + n + " checks)");
`, c);
