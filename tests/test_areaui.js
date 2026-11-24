const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Area tab board (areaui.js) and the Map panel's merged "What to do next" card + place filters (mappanel.js)
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const mem = {};
const localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RegExp, localStorage };
vm.createContext(c);
const files = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js",
  "cooking.js", "smithing.js", "ammo.js", "gather.js", "halls.js", "homestead.js", "horses.js", "bounty.js", "festivals.js", "market.js", "social.js", "caravans.js", "rumours.js", "worldevents.js", "mp.js", "remind.js",
  "areaui.js", "mappanel.js", "patchnotes.js", "i18n_story.js", "i18n_areaui.js", "i18n.js"];
for (const f of files) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
vm.runInContext(`
let pass = 0;
const ok = (v, m) => { if (!v) throw new Error("FAIL " + m); pass++; };

// ---- grouping
const secs = ["general", "blacksmith", "inn", "train", "alchemy", "forge", "jobs", "streets", "hire", "carriage", "home", "homes", "market", "notice", "cook", "fish", "stables", "somethingnew"];
const g = AREAUI.group(secs);
ok(g.map(([id]) => id).join() === "inn,market,services,work,home,events", "groups in town order: " + g.map(([id]) => id).join());
ok(g.flatMap(([, , ids]) => ids).sort().join() === [...secs].sort().join(), "every section lands in exactly one group");
ok(g.find(([id]) => id === "events")[2].includes("somethingnew"), "unknown sections (new modules) go to Events & fun");
ok(g.find(([id]) => id === "inn")[2][0] === "inn", "the inn comes first in its group");
ok(!AREAUI.group(["general"]).some(([id]) => id === "inn"), "empty groups are left out");
ok(AREAUI.siblings(secs, "blacksmith").includes("general") && !AREAUI.siblings(secs, "blacksmith").includes("inn"), "siblings are the same group");
ok(AREAUI.plain("\uE133 Market stalls") === "Market stalls" && AREAUI.plain("⚑ Hall of the North") === "Hall of the North", "emoji stripped from tile names");
ok(AREAUI.label("hire", { hire: "Dragonsreach & hirelings" }) === "Hirelings", "long names get the short tile name");
ok(/au-more/.test(AREAUI.note("One sentence here that is long enough to fold. And then a second sentence with many more words in it, to pass the fold limit easily.")), "long notes fold");
ok(!/au-more/.test(AREAUI.note("Short note.")), "short notes stay open");

// ---- the board for a real town
const S = G.newSave("au1", "Remy", "nord"); S.location = "Whiterun"; [S.x, S.y] = WORLD.places.Whiterun;
const names = { general: "General goods", blacksmith: "Blacksmith", inn: "The Bannered Mare", train: "Trainers", jobs: "Jobs", home: "Buy Breezehome", streets: "Streets" };
const h = AREAUI.hub({ S, l: "Whiterun", sections: Object.keys(names), names, open: true, hold: "Whiterun Hold" });
ok((h.match(/class="au-tile[ "]/g) || []).length === 7, "one tile per section");
ok(/data-act="shop" data-id="general"/.test(h), "tiles open the place (data-act=shop)");
ok(/Room \\d+ gold/.test(h) && /For sale · \\d+ gold/.test(h) && /0 of 3 taken/.test(h), "tiles show live status");
const hd = AREAUI.head({ l: "Whiterun", sections: Object.keys(names), names, cur: "general", desc: "Buy food" });
ok(/data-act="areahub"/.test(hd) && /data-id="blacksmith"/.test(hd) && !/data-id="inn"/.test(hd), "an open place has a back button and its neighbours");

// ---- merged What to do next
const rows = MAPPANEL.merge([
  { kind: "explore", key: "explore", place: "Helgen", dist: 50, html: "e" },
  { kind: "idea", key: "idea0", place: "Bleak Falls Barrow", dist: 40, html: "i" },
  { kind: "quest", key: "quest", place: "Bleak Falls Barrow", dist: 40, html: "q" },
  { kind: "hero", key: "perks", html: "p" },
  { kind: "hero", key: "perks", html: "p2" },
  { kind: "ending", key: "ev2", at: 900, html: "late" },
  { kind: "ending", key: "ev1", at: 100, html: "soon" },
  { kind: "ready", key: "far", place: "Riften", dist: 900, html: "far" },
  { kind: "ready", key: "near", place: "Riverwood", dist: 10, html: "near" },
]);
const order = rows.map((r) => r.html).join();
ok(order === "q,near,far,soon,late,p,e", "deduped and sorted by urgency, then distance/time: " + order);
const card = MAPPANEL.card([{ kind: "quest", key: "q", html: "<div class=item>1</div>" }, ...[1, 2, 3, 4, 5, 6].map((i) => ({ kind: "idea", key: "i" + i, html: "<div class=item>x</div>" })), { kind: "ready", key: "r", html: "<div class=item>r</div>" }]);
ok(/id="rmd-card"/.test(card) && /nextcard/.test(card) && /What to do next/.test(card), "one card keeps both hooks");
ok((card.match(/class=item/g) || []).length === MAPPANEL.MAX && /Show 3 more/.test(card), "five rows, the rest one tap away");
ok(/1 ready/.test(card), "ready count in the title");
ok(MAPPANEL.placeOf('<button data-act="go" data-place="Bleak Falls Barrow">') === "Bleak Falls Barrow", "place read from a row's Go button");

// ---- remind rows reuse
S.pendingLevels = 1;
const it = REMIND.items(S, {});
ok(it.some(({ x, html }) => x.key === "lvl" && /data-rmd="go"/.test(html) && /rmd-row/.test(html)), "remind rows come with working Go buttons");

// ---- place filters
ok(MAPPANEL.test("towns", "city", true) && !MAPPANEL.test("towns", "dungeon", true), "Towns filter");
ok(MAPPANEL.test("dungeons", "lair", true) && MAPPANEL.test("new", "farm", false) && !MAPPANEL.test("new", "farm", true), "Dungeons / Not visited filters");
const cnt = MAPPANEL.countAll([{ kind: "city", visited: true }, { kind: "dungeon", visited: false }]);
ok(cnt.all === 2 && cnt.towns === 1 && cnt.dungeons === 1 && cnt.new === 1 && cnt.other === 0, "filter counts");
ok(!/data-id="other"/.test(MAPPANEL.chips(cnt)) && /data-id="towns"/.test(MAPPANEL.chips(cnt)), "empty filters are hidden");

// ---- Polish for the patch note and the board's words
const pn = PATCHNOTES.LIST.find((n) => n.id === "b141-areaui");
const miss = [];
for (const m of [pn.title, ...pn.items]) for (const part of m.split(/(?<=[.!?])\s+/)) { const x = part.trim(); if (x && I18N.tr(x) == null && I18N.story(x) == null) miss.push(x); }
ok(miss.length === 0, "Polish for every patch note line: " + miss.slice(0, 3).join(" | "));
for (const w of ["Inn", "Market", "Services & trainers", "Work & jobs", "Your home", "Events & fun", "Right now", "What to do next", "Not visited"]) ok(I18N.tr(w) != null || I18N.story(w) != null, "Polish for " + w);

console.log("test_areaui: " + pass + " checks passed");
`, c);
