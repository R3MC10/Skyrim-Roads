// The follower's own Character tab (followertab.js): the tab is in the menu, the empty state says where to hire,
// the SkyUI-style gear list filters/sorts, and Give / Take / Equip move things between the two packs with the old rules.
// W=/path/to/game/ node test_followertab.js
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
vm.runInContext("var I18N_STORY = { ex: {}, pats: [] };", c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "enchanting.js", "quests.js", "magic.js", "followers2.js", "followerai.js", "menus.js", "menus2.js", "followertab.js", "patchnotes.js", "i18n_followertab.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const mk = (lvl = 20) => { const s = G.newSave("ft" + Math.random(), "Tester", "nord"); s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.level = lvl; s.gold = 9999; s.thaneWhiterun = true; return s; };

// 1. the tab sits in the Character menu, next to Character
const tabs = MENUS.charTabs().map((t) => t[0]);
OK(tabs.includes("follower") && tabs.indexOf("follower") === tabs.indexOf("hero") + 1, "Follower tab next to Character: " + tabs);
OK(MENUS.groupOf("follower") === "hero", "Follower tab belongs to the Character menu");

// 2. no follower: a friendly page with where to hire, and nothing on the Character page
const A = mk();
const e = FOLTAB.panel(A);
OK(/travelling alone/.test(e) && /Where to find one/.test(e), "empty state text");
OK(/Lydia/.test(e) && /Whiterun/.test(e) && /Thane of Whiterun/.test(e), "says where Lydia is and how to get her");
OK(/Here in Whiterun/.test(e), "points at followers in the town you're in");
OK(FOLTAB.summary(A) === "", "no summary line without a follower");
OK(FOLTAB.rows(A).length === 0, "no rows without a follower");

// 3. with a follower: the tab draws the follower panel and the Character page gets one line
OK(TOWNS.hire(A, "lydia").includes("Lydia"), "hire Lydia");
const L = FOL2.st(A);
OK(/fol2/.test(FOLTAB.panel(A)) && /Dismiss/.test(FOLTAB.panel(A)), "tab shows the follower panel with Dismiss");
const line = FOLTAB.summary(A);
OK(/Lydia/.test(line) && /data-id="follower"/.test(line) && !/Dismiss/.test(line), "Character page line links to the tab");

// 4. the list: rows, equipped marker, categories, sorting
let rows = FOLTAB.rows(A, "theirs");
OK(rows.length === L.inv.length, "their pack rows: " + rows.length);
OK(rows.filter((r) => r.eq).length === new Set(Object.values(L.eq)).size, "worn things are marked");
OK(rows.slice(0, rows.filter((r) => r.eq).length).every((r) => r.eq), "worn things stay on top");
OK(FOLTAB.rows(A, "theirs", "weapons").every((r) => r.cat === "weapons") && FOLTAB.rows(A, "theirs", "weapons").length >= 1, "weapons filter");
OK(FOLTAB.rows(A, "theirs", "apparel").every((r) => r.cat === "apparel"), "armor filter");
OK(FOLTAB.catOf(D.ITEMS.potion_health) === "potions", "potions category");
OK(FOLTAB.typeOf(D.ITEMS.steel_sword) === "1-hand" && FOLTAB.typeOf(D.ITEMS.steel_armor) === "Body", "type column");
const s1 = FOLTAB.sortRows([{ name: "b", value: 5, eq: false }, { name: "a", value: 9, eq: false }, { name: "c", value: 1, eq: true }], "value", 1);
OK(s1.map((r) => r.name).join() === "c,a,b", "sort by value high first, worn first: " + s1.map((r) => r.name));
OK(FOLTAB.sortRows(s1, "name", -1).map((r) => r.name).join() === "c,b,a", "name Z-A");
const cnt = FOLTAB.counts(A, "theirs");
OK(cnt.all === L.inv.length && cnt.weapons >= 1 && cnt.apparel >= 2, "category counts " + JSON.stringify(cnt));

// 5. give from your pack (the old rules), then equip; comparison with what they wear
const best = ["ebony_sword", "glass_sword", "elven_sword", "dwarven_sword", "orcish_sword"].find((x) => D.ITEMS[x]);
const sw = G.give(A, best);
const mine = FOLTAB.rows(A, "yours", "weapons").find((r) => r.id === sw);
OK(mine, "your pack lists the sword");
const cmp = FOLTAB.compare(A, { ...mine, mine: true });
OK(cmp && cmp.label === "Damage" && cmp.now && cmp.now.name === "Steel Sword" && cmp.diff > 0, "compares with her steel sword: " + JSON.stringify(cmp));
let m = FOL2.act(A, { op: "give", id: String(sw), q: "1" });
OK(/give/.test(m) && !G.invRow(A, sw) && L.inv.some((r) => r.item === best), "Give moves it to her pack: " + m);
const hers = L.inv.find((r) => r.item === best);
m = FOL2.act(A, { op: "eq", id: String(hers.id) });
OK(L.eq.weapon === hers.id, "Equip from her pack: " + m);
OK(FOLTAB.rows(A, "theirs").find((r) => r.id === hers.id).eq, "the list marks it worn");
const cmp2 = FOLTAB.compare(A, FOLTAB.rows(A, "theirs").find((r) => r.id === hers.id));
OK(cmp2.now && cmp2.now.same, "comparison knows she wears it");
m = FOL2.act(A, { op: "uneq", id: "weapon" });
OK(!L.eq.weapon, "Take off");

// 6. Give & equip in one tap
const helm = G.give(A, "iron_helmet");
m = FOL2.act(A, { op: "ftgiveeq", id: String(helm) });
const hrow = L.inv.find((r) => r.id === L.eq.head);
OK(hrow && hrow.item === "iron_helmet" && !G.invRow(A, helm), "Give & equip puts it on: " + m);

// 7. take back: stacks, worn things come off and go to your pack
const pot = G.give(A, "potion_health", 3);
FOL2.act(A, { op: "give", id: String(pot), q: "3" });
const prow = L.inv.find((r) => r.item === "potion_health");
OK(prow && prow.qty === 3, "potions stack in her pack");
FOL2.act(A, { op: "take", id: String(prow.id), q: "1" });
OK(prow.qty === 2 && A.inv.some((r) => r.item === "potion_health"), "Take one back");
FOL2.act(A, { op: "take", id: String(hrow.id), q: "1" });
OK(!L.eq.head && A.inv.some((r) => r.item === "iron_helmet"), "taking a worn item takes it off");

// 8. view state taps
FOL2.act(A, { op: "ftside", id: "yours" }); OK(FOLTAB.ui.side === "yours", "switch to your pack");
FOL2.act(A, { op: "ftcat", id: "potions" }); OK(FOLTAB.ui.cat === "potions", "pick a category");
FOL2.act(A, { op: "ftsort", id: "value" }); OK(FOLTAB.ui.sort === "value" && FOLTAB.ui.dir === 1, "sort by value");
FOL2.act(A, { op: "ftsort", id: "value" }); OK(FOLTAB.ui.dir === -1, "tap again flips the order");
FOL2.act(A, { op: "ftsel", id: "5" }); OK(FOLTAB.ui.sel === 5, "select a row");
FOL2.act(A, { op: "view", id: "inv" });
const g = FOLTAB.panel(A);
OK(/sky-row/.test(g) && /sky-cats/.test(g) && /ftsort/.test(g), "gear view uses the SkyUI list");
FOL2.act(A, { op: "ftside", id: "theirs" }); FOL2.act(A, { op: "ftcat", id: "all" });
const sel = FOLTAB.rows(A, "theirs")[0]; FOL2.act(A, { op: "ftsel", id: String(sel.id) });
const g2 = FOLTAB.panel(A);
OK(/sky-detail/.test(g2) && /Take/.test(g2), "details show for the picked item with Take");

// 9. dismissing: back to the empty state; she keeps her kit when hired again
const kept = FOL2.st(A).inv.length;
TOWNS.dismiss(A);
OK(/travelling alone/.test(FOLTAB.panel(A)), "dismissed: empty state again");
TOWNS.hire(A, "lydia");
OK(FOL2.st(A).inv.length === kept, "her pack is kept for next time");
OK(/goes down instead of dying/.test(FOLTAB.panel(A)), "followers go down, never die");
// 10. the patch note is first, has a unique id, and every line has Polish
const pn = PATCHNOTES.LIST.find((x) => x.id === "b143-followertab") || {};   // newer notes may sit above it
OK(pn.id === "b143-followertab" && new Set(PATCHNOTES.LIST.map((x) => x.id)).size === PATCHNOTES.LIST.length, "patch note listed with a unique id");
for (const x of [pn.title, ...pn.items]) OK(I18N_STORY.ex[x], "Polish for: " + x.slice(0, 40));
console.log("test_followertab: " + n + " checks OK");
`, c);
