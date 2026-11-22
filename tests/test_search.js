const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Search everything (search.js): fuzzy matching with typos, every kind of result, places you haven't found stay
// nameless, quests only once you have them, readable sub-lines, speed, and the small hooks in ui.js / index.html.
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, performance };
vm.createContext(c);
const W = process.env.W || __GAME + "";
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "social.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "followers2.js", "skillinfo.js", "search.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const ok = (c, m) => { if (!c) throw new Error("FAIL " + m); };
const X = SEARCH;
// ---- the matcher
ok(X.dist("sword", "sword", 1) === 0 && X.dist("swrod", "sword", 1) === 1 && X.dist("swd", "sword", 1) > 1, "edit distance with swaps");
ok(X.tokScore("iron", ["iron", "sword"]) === 100, "exact word");
ok(X.tokScore("swo", ["iron", "sword"]) > 60, "prefix");
ok(X.tokScore("swrod", ["iron", "sword"]) > 0, "typo");
ok(X.tokScore("xyzzy", ["iron", "sword"]) === 0, "no match");
ok(X.tokScore("ab", ["crab"]) === 0, "two letters must start a word");
ok(X.norm("Hand-to-Hand  Ëlven's") === "hand to hand elvens", "normalise " + X.norm("Hand-to-Hand  Ëlven's"));

const S = G.newSave("A", "Sigrid", "nord"); [S.x, S.y] = WORLD.places.Riverwood; S.location = "Riverwood";
const kinds = new Set(X.index().map((e) => e.k));
for (const k of ["item", "spell", "perk", "skill", "place", "follower", "recipe", "setting"]) ok(kinds.has(k), "index has " + k);
const grp = (r, k) => r.groups.find((g) => g.k === k);
const names = (r, k) => (grp(r, k)?.list || []).map((e) => e.name);
ok(X.query(S, "").groups.length === 0 && X.query(S, "   ").total === 0, "empty query");

// ---- items: what you own first, every other item in the game too
const own = S.inv[0], ownName = D.ITEMS[own.item].name;
let r = X.query(S, ownName);
ok(grp(r, "mine") && grp(r, "mine").list[0].id === own.id, "owned item found under Your items: " + ownName);
ok(!names(r, "item").includes(ownName), "owned item not repeated under Items in the game");
r = X.query(S, "steel sword");
ok(names(r, "item").includes("Steel Sword") || names(r, "mine").includes("Steel Sword"), "steel sword " + JSON.stringify(r.groups.map((g) => [g.k, g.list.slice(0, 3).map((e) => e.name)])));
r = X.query(S, "steal swrod");
ok([...names(r, "item"), ...names(r, "mine")].includes("Steel Sword"), "typos: steal swrod");
r = X.query(S, "dwarvn bow");
ok(names(r, "item").some((n) => /Dwarven Bow/.test(n)), "typo dwarvn bow " + names(r, "item"));
ok(!X.index().some((e) => e.k === "item" && D.ITEMS[e.id].slot === "tome"), "tomes live under spells");

// ---- spells: known and not, plus shouts you know
r = X.query(S, "flames");
const fl = grp(r, "spell")?.list.find((e) => e.id === "flames");
ok(fl, "flames found");
ok(/Destruction/.test(X.sub(S, fl)) && /know it/.test(X.sub(S, fl)) === S.spells.includes("flames"), "spell sub " + X.sub(S, fl));
r = X.query(S, "firebal");
ok(names(r, "spell").includes("Fireball"), "fireball prefix");
r = X.query(S, "fierball");
ok(names(r, "spell").includes("Fireball"), "fireball typo " + names(r, "spell"));
ok(!names(X.query(S, "unrelenting force"), "spell").length, "unknown shout stays hidden");
S.words = ["FUS"]; ok(names(X.query(S, "unrelenting force"), "spell").includes("Unrelenting Force") || !POWERS.known(S, "FUS"), "known shout shows");

// ---- perks: tree, requirements, whether you have it
r = X.query(S, "armsman");
const pk = grp(r, "perk")?.list[0];
ok(pk && pk.id === "armsman" && pk.sk === "One-Handed", "perk armsman");
ok(/One-Handed tree/.test(X.sub(S, pk)), "perk sub tree " + X.sub(S, pk));
const vet = G.newSave("B", "Vet", "nord"); vet.level = 30; for (const k of D.ALL_SKILLS) vet.skills[k].lvl = 60;
ok(/take it now/.test(X.sub(vet, pk)), "can take now " + X.sub(vet, pk));
PERKS.take(vet, "armsman"); ok(/rank 1|you have it/.test(X.sub(vet, pk)), "has it " + X.sub(vet, pk));
const deep = X.index().find((e) => e.k === "perk" && PERKS.BY_ID[e.id].needs.length && PERKS.BY_ID[e.id].req[0] > 15);
ok(/needs/.test(X.sub(S, deep)), "needs text " + X.sub(S, deep));

// ---- skills
r = X.query(S, "one handed");
ok(grp(r, "skill")?.list[0].id === "One-Handed", "skill one handed");
ok(r.groups[0].k === "skill" || r.groups[0].k === "perk", "skill group ranks high for an exact skill name");
ok(/Level \\d+/.test(X.sub(S, grp(r, "skill").list[0])), "skill sub");

// ---- places: cities always, the rest only once found, and never a hidden name
r = X.query(S, "whiterun");
ok(names(r, "place").includes("Whiterun"), "city known from the start");
const secret = Object.keys(WORLD.places).find((n) => WORLD.places[n][2] === "dungeon" && !S.discovered.includes(n) && n.length >= 8 && !/(city|town)/.test(WORLD.places[n][2]));
r = X.query(S, secret);
ok(!names(r, "place").includes(secret), "undiscovered place hidden: " + secret);
ok(!JSON.stringify(r).includes(secret) || r.groups.some((g) => g.k !== "place" && g.list.some((e) => e.name.includes(secret))), "hidden name not anywhere in the place results");
ok(r.hint && r.hint.n >= 1, "hint that something is out there");
r = X.query(S, secret.slice(0, 3)); ok(!r.hint, "no hint for a short query");
S.discovered.push(secret);
r = X.query(S, secret);
ok(names(r, "place").includes(secret) && !r.hint, "found place shows");
ok(/Dungeon/.test(X.sub(S, grp(r, "place").list.find((e) => e.id === secret))), "place sub");

// ---- quests: only active or done
const qid = Object.keys(QUESTS.L)[0], qname = QUESTS.L[qid].name;
S.quests = {};
ok(!names(X.query(S, qname), "quest").length, "quest you haven't got is hidden");
S.quests[qid] = { stage: 0 };
r = X.query(S, qname); ok(names(r, "quest").includes(qname) && /Active/.test(X.sub(S, grp(r, "quest").list[0])), "active quest");
S.quests[qid].done = true;
r = X.query(S, qname); ok(/Completed/.test(X.sub(S, grp(r, "quest").list[0])), "completed quest");

// ---- followers, recipes, settings
r = X.query(S, "lydia"); ok(names(r, "follower").includes("Lydia"), "follower");
ok(/Free|gold/.test(X.sub(S, grp(r, "follower").list[0])), "follower sub");
r = X.query(S, "iron dagger forge"); ok(grp(r, "recipe")?.list.some((e) => e.rk === "smith" && e.item === "iron_dagger"), "smithing recipe");
r = X.query(S, "vegetable soup"); ok(grp(r, "recipe")?.list.some((e) => e.rk === "cook"), "cooking recipe");
r = X.query(S, "restor helth"); ok(grp(r, "recipe")?.list.some((e) => e.rk === "alch" && e.eff === "Restore Health"), "alchemy with typos");
ok(/Alchemy/.test(X.sub(S, grp(r, "recipe").list.find((e) => e.rk === "alch"))), "alchemy sub");
r = X.query(S, "text size"); ok(grp(r, "setting")?.list[0].name === "Text size", "setting text size");
r = X.query(S, "pixel"); ok(names(r, "setting").some((n) => /Art style/.test(n)), "setting by keyword");
r = X.query(S, "mute"); ok(names(r, "setting").some((n) => /sound/i.test(n)), "mute");

// ---- every visible entry has a clean sub-line
for (const e of X.index()) { const s = X.sub(vet, e); ok(typeof s === "string" && !/undefined|NaN|\\[object/.test(s), "sub " + e.k + " " + e.id + ": " + s); }

// ---- fast enough for an old phone: 200 searches
const t0 = performance.now();
for (let i = 0; i < 200; i++) X.query(S, ["iron", "fierbal", "restor helth", "whiterun", "one handed", "dragnbone", "s", "zz top"][i % 8]);
const ms = performance.now() - t0;
ok(ms < 1500, "200 searches took " + ms.toFixed(0) + " ms");
console.log("search: " + X.index().length + " entries, 200 searches in " + ms.toFixed(0) + " ms");
`, c);

// ---- hooks
const ui = fs.readFileSync(W + "ui.js", "utf8"), html = fs.readFileSync(W + "index.html", "utf8");
if (!/typeof SEARCH !== "undefined" \? SEARCH\.btn\(\) : ""/.test(ui)) throw new Error("FAIL guarded HUD hook in ui.js");
const iS = html.indexOf('<script src="search.js">'), iU = html.indexOf('<script src="ui.js">');
if (iS < 0 || iS > iU) throw new Error("FAIL search.js loads before ui.js");
const css = html.split("<style>")[2] || "";
if (!/srch-m/.test(css)) throw new Error("FAIL CSS in the second style block");
console.log("search ok");
