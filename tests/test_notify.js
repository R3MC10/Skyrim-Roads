const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* One notification manager (notify.js): reading messages, priorities, merges, blocking screens, the 400 ms gap,
   pausing in the background and the history. W=/path/to/game/ node test_notify.js — prints "notify ok". */
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String };
vm.createContext(c);
vm.runInContext(fs.readFileSync(__GAME + "notify.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
for (const f of ["polish.js", "skillup.js", "levelup.js", "ui.js", "index.html", "overlays.js"]) {
  const src = fs.readFileSync(__GAME + f, "utf8");
  if (!/NOTIFY|notify\.js/.test(src)) throw new Error("FAIL " + f + " is not wired to notify.js");
}
vm.runInContext(`
var n = 0; const ok = (cnd, m) => { n++; if (!cnd) throw new Error("FAIL " + m); };
const N = NOTIFY, K = (t) => N.classify(t).kind;
// 1. reading a toast line
ok(K("\\uE112 You find 40 gold.") === "gold" && N.classify("You find 1,200 gold.").amt === 1200, "gold");
ok(K("Found: Iron Dagger.") === "loot" && K("Looted: Wolf Pelt") === "loot", "loot");
ok(K("You find 40 gold and a ring in the chest, plus a map.") === "info", "a long sentence is a plain message");
ok(K("One-Handed increased to 24") === "skill" && N.classify("One-Handed increased to 24").to === 24, "skill");
ok(K("\\uE130 Achievement: \\uE144 First Steps") === "ach" && N.classify(" Achievement: x First Steps").name === "First Steps", "achievement");
ok(K("Not enough gold.") === "info" && K("You can't carry more.") === "info", "errors show at once");
ok(K("\\uE100 Main quest: “Bleak Falls Barrow” done!") === "questdone", "quest done");
ok(N.bannerKind("level", "Level up") === "level" && N.bannerKind("quest", "Quest completed") === "questdone" && N.bannerKind("quest", "Quest started") === "queststart" && N.bannerKind("quest", "World event") === "event", "banner kinds");
ok(N.bannerKind("level", "Promoted: Stormcloaks") === "promoted" && N.RULE.promoted[0] === 1, "a side promotion is its own P1 notice");
ok(N.RULE.level[0] === 1 && N.RULE.level[1] === 3500 && N.RULE.skill[1] === 2500 && N.RULE.loot[1] === 2000 && N.RULE.vote[0] === 0, "priorities and times");

// 2. merges
let C = N.core(), t = 1000;
C.push({ kind: "loot", key: "iron dagger", text: "Found: Iron Dagger" }, t);
C.push({ kind: "loot", key: "iron dagger", text: "Found: Iron Dagger" }, t + 500);
C.push({ kind: "loot", key: "iron dagger", text: "Found: Iron Dagger" }, t + 1200);
ok(C.queue.length === 1 && C.queue[0].text === "Found: Iron Dagger ×3", "the same item within 1.5 s: ×3 (" + C.queue[0].text + ")");
C.push({ kind: "loot", key: "iron dagger", text: "Found: Iron Dagger" }, t + 3000);
ok(C.queue.length === 2, "after 1.5 s it's a new line");
C = N.core();
C.push({ kind: "gold", amt: 40, text: "You find 40 gold." }, t); C.push({ kind: "gold", amt: 25, text: "You find 25 gold." }, t + 1900);
ok(C.queue.length === 1 && C.queue[0].text === "You find 65 gold.", "gold within 2 s adds up (" + C.queue[0].text + ")");
C = N.core();
C.push({ kind: "skill", slot: "ban", key: "One-Handed", from: 21, to: 22, text: "One-Handed 22" }, t);
C.push({ kind: "skill", slot: "ban", key: "One-Handed", from: 22, to: 23, text: "One-Handed 23" }, t + 1000);
C.push({ kind: "skill", slot: "ban", key: "One-Handed", from: 23, to: 24, text: "One-Handed 24" }, t + 2900);
ok(C.queue.length === 1 && C.queue[0].text === "One-Handed 21 → 24", "a skill within 3 s: 21 → 24 (" + C.queue[0].text + ")");
C = N.core();
C.push({ kind: "ach", slot: "ban", title: "Achievement", text: "First Steps", name: "First Steps", id: "ach:first_steps" }, t);
C.push({ kind: "ach", slot: "ban", title: "Achievement", text: "Coin Hoarder", name: "Coin Hoarder", id: "ach:rich" }, t + 1200);
ok(C.queue.length === 1 && C.queue[0].text === "First Steps · Coin Hoarder" && C.queue[0].title === "Achievements", "First Steps + Coin Hoarder: one banner");
ok(C.push({ kind: "ach", slot: "ban", text: "First Steps", name: "First Steps", id: "ach:first_steps" }, t + 5000) === "drop", "the same id twice is dropped");
ok(C.hist.length === 1 && C.hist[0].text === "First Steps · Coin Hoarder", "the history holds the merged line");
C = N.core();
C.push({ kind: "weather", text: "Weather: Rain" }, t); C.push({ kind: "weather", text: "Weather: Snow" }, t + 50000);
ok(C.queue.length === 1 && C.queue[0].text === "Weather: Snow", "weather keeps the newest within 60 s");
C = N.core();
C.push({ kind: "questdone", slot: "ban", text: "Bleak Falls Barrow" }, t); C.push({ kind: "questdone", slot: "ban", text: "Bleak Falls Barrow" }, t + 10);
ok(C.queue.length === 2, "quests never merge");

// 3. one message + one banner, 400 ms apart, priorities
C = N.core(); t = 10000;
C.push({ kind: "skill", slot: "ban", key: "Archery", from: 10, to: 11, text: "Archery 11" }, t);
C.push({ kind: "loot", key: "a", text: "Found: A" }, t);
let a = C.tick(t, {});
ok(a.length === 1 && a[0].act === "show" && a[0].slot === "ban", "one thing starts at a time");
a = C.tick(t + 200, {}); ok(!a.some((x) => x.act === "show"), "the next waits 400 ms");
a = C.tick(t + 400, {}); ok(a.length === 1 && a[0].slot === "msg", "then the message line");
ok(C.showing.ban && C.showing.msg, "one message plus one banner");
C.push({ kind: "level", slot: "ban", text: "You reached level 6" }, t + 600);
a = C.tick(t + 900, {});
ok(a.some((x) => x.act === "cut" && x.item.kind === "skill") && a.some((x) => x.act === "show" && x.item.kind === "level"), "a level-up cuts a skill toast short");
C.push({ kind: "skill", slot: "ban", key: "Archery", from: 11, to: 12, text: "Archery 12" }, t + 1000);
a = C.tick(t + 1500, {}); ok(!a.some((x) => x.act === "cut"), "a skill-up never cuts a level-up");
a = C.tick(t + 900 + 3500, {}); ok(a.some((x) => x.act === "end" && x.item.kind === "level"), "a level-up stays 3.5 s");

// 4. a burst of 10 rewards: never more than 2 at once, the rest in the history
C = N.core(); t = 50000; let most = 0;
for (let i = 0; i < 10; i++) C.push({ kind: "loot", key: "item" + i, text: "Found: Item " + i }, t + i * 30);
ok(C.queue.length <= 2, "only the newest two wait");
ok(C.hist.length === 10, "all ten are in the history");
for (let k = 0; k < 60; k++) { C.tick(t + k * 100, {}); most = Math.max(most, (C.showing.msg ? 1 : 0) + (C.showing.ban ? 1 : 0)); }
ok(most <= 2, "at most 2 on screen");

// 5. blocking screens and fights
C = N.core(); t = 90000;
C.push({ kind: "loot", key: "x", text: "Found: X" }, t);
C.push({ kind: "level", slot: "ban", text: "You reached level 7" }, t);
a = C.tick(t, { msg: 1, ban: 1 });
ok(!a.length && C.queue.length === 1 && C.queue[0].kind === "level", "perk tree open: loot to the history, the level-up waits");
a = C.tick(t + 100, { fight: true }); ok(!a.length, "a fight: everything waits");
a = C.tick(t + 200, { p0: true }); ok(!a.length, "a party vote: everything waits");
a = C.tick(t + 300, {}); ok(a.length === 1 && a[0].item.kind === "level", "screen clear: the level-up shows");
a = C.tick(t + 400, { p0: true }); ok(a.some((x) => x.act === "cut"), "a party vote clears the screen");

// 6. the app in the background
C = N.core(); t = 120000;
C.push({ kind: "loot", key: "y", text: "Found: Y" }, t); C.tick(t, {});
C.pause(t + 500); ok(!C.tick(t + 5000, {}).length, "nothing happens in the background");
C.resume(t + 60000); ok(C.showing.msg && C.showing.msg.end === t + 2000 + 59500, "the timer stood still");

// 7. leases (skillup.js / levelup.js draw their own toast)
C = N.core(); t = 200000;
ok(C.lease({ kind: "skill", text: "Archery 12", key: "Archery", from: 11, to: 12, ms: 1600 }, t, {}), "a free banner: granted");
ok(!C.lease({ kind: "skill", text: "Archery 13", key: "Archery", from: 12, to: 13, ms: 1600 }, t + 500, {}), "busy: wait");
ok(C.lease({ kind: "skill", text: "Archery 13", key: "Archery", from: 12, to: 13, ms: 1600 }, t + 1700, {}), "free again");
ok(C.hist.length === 1 && C.hist[0].text === "Archery 11 → 13", "the history merges a skill within 3 s (" + C.hist[0].text + ")");
ok(!C.lease({ kind: "level", text: "Level 8", ms: 3000 }, t + 5000, { fight: true }), "not during a fight");
ok(!C.lease({ kind: "level", text: "Level 8", ms: 3000 }, t + 5000, { msg: 1 }), "not over the perk stars");
ok(C.lease({ kind: "level", text: "Level 8", ms: 3000 }, t + 5000, {}), "then it shows");

// 8. history: 200 kept, filters
C = N.core(); t = 300000;
for (let i = 0; i < 230; i++) C.push({ kind: i % 2 ? "queststart" : "gold", slot: i % 2 ? "ban" : "msg", amt: 1, text: "Line " + i }, t + i * 5000);
ok(C.hist.length === 200, "200 kept");
ok(C.filter("quests").every((h) => h.cat === "quests") && C.filter("rewards").length + C.filter("quests").length === 200, "filters");
ok(C.filter("party").length === 0 && C.filter("all").length === 200, "party / all");
const D = N.core(); D.load(JSON.parse(JSON.stringify(C.hist.map((h) => ({ t: h.t, kind: h.kind, cat: h.cat, title: h.title, text: h.text })))));
ok(D.hist.length === 200 && D.hist[0].text === C.hist[0].text, "saved and loaded");
ok(N.FILTERS.map((f) => f[0]).join() === "all,rewards,quests,party,world", "the five filters");
ok(Object.keys(N.PL).length > 10 && N.PL["Tidier pop-ups"], "Polish");
console.log("notify ok (" + n + " checks)");
`, c);
