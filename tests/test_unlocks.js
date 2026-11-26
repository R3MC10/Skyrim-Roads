const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Features that open by level (unlocks.js): the table, open/next/justOpened, the level-up event, veterans keeping what they used,
   a party with mixed levels, and save migration. W=/path/to/game/ node test_unlocks.js → "unlocks ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME;
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
const F = ["data.js", "world.js", "terrain.js", "solworld.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "unlocks.js", "events.js", "dungeons.js", "towns.js", "encounters.js"];
for (const f of F) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };
const U = UNLOCKS;
const hero = (lv = 1) => { const s = G.newSave("ul" + Math.random(), "Remi", "nord"); U.newHero(s); s.level = lv; return s; };

// ---- the table
const ids = U.TABLE.map((f) => f.id);
ok(new Set(ids).size === ids.length, "feature ids are unique");
const want = { perks: 2, gathering: 3, cooking: 3, smithing: 4, followers: 5, alchemy: 5, horses: 6, dungeons: 7, clans: 8, housing: 8,
  clanjobs: 9, enchanting: 9, harddungeons: 10, shouts: 10, worldevents: 11, worldbosses: 12, elite: 15, legendary: 20 };
for (const [id, lv] of Object.entries(want)) ok(U.level(id) === lv, id + " opens at level " + lv + " (got " + U.level(id) + ")");
ok(U.TABLE.every((f) => f.name && f.teaser && f.level >= 2 && typeof f.used === "function"), "every feature has a name, a teaser, a level and a used() check");
for (let i = 1; i < U.TABLE.length; i++) ok(U.TABLE[i].level >= U.TABLE[i - 1].level, "table is in level order at " + U.TABLE[i].id);
const seen = {};
for (const f of U.TABLE) for (const a of f.acts || []) { ok(!seen[a], "button " + a + " belongs to one feature only"); seen[a] = 1; }
// friends, chat, party invites and playing together are never gated
for (const a of ["invite", "coopinv", "leaveparty", "chatsend", "chatq", "chatch", "friend", "addfriend", "accept", "party"]) ok(U.featureOfAct(a) === null, "social button " + a + " is never gated");
ok(U.open(hero(1), "no-such-feature") === true, "unknown ids are always open");

// ---- open / next / justOpened
const s1 = hero(1);
ok(!U.open(s1, "perks") && !U.open(s1, "smithing") && !U.open(s1, "worldevents"), "a level-1 hero has nothing big open");
ok(U.next(s1, 2).map((f) => f.id).join() === "perks,gathering", "next two at level 1: perks, gathering (" + U.next(s1, 2).map((f) => f.id) + ")");
ok(U.next(s1, 1).length === 1 && U.next(s1, 0).length === 0, "next(n) gives n features");
ok(U.next(s1, 1)[0].name === "Perks" && U.next(s1, 1)[0].level === 2 && !!U.next(s1, 1)[0].teaser, "next() gives what rewards.js needs: name, level, teaser");
const s4 = hero(4);
ok(U.open(s4, "perks") && U.open(s4, "smithing") && !U.open(s4, "followers"), "level 4: smithing open, followers not yet");
ok(U.next(s4, 2).map((f) => f.id).join() === "followers,alchemy", "next at level 4: followers, alchemy");
ok(U.justOpened(s4).join() === "smithing", "justOpened at 4 = smithing");
ok(U.justOpened(hero(5)).sort().join() === "alchemy,followers", "justOpened at 5 = followers + alchemy");
ok(U.justOpened(hero(13)).length === 0, "level 13 opens nothing");
const s20 = hero(20);
ok(U.TABLE.every((f) => U.open(s20, f.id)) && U.next(s20, 2).length === 0, "level 20: everything open, no teaser");

// ---- areas, buttons, tabs, encounters
ok(!U.section(s1, "forge") && U.section(s4, "forge") && U.section(s1, "inn") && U.section(s1, "general"), "forge hidden until 4; inn and shop always");
ok(U.act(s1, "smake") === "smithing" && U.act(s4, "smake") === null, "forge buttons say smithing is locked at 1");
ok(!U.tab(s1, "perks") && U.tab(hero(2), "perks") && !U.tab(s4, "world") && U.tab(hero(11), "world"), "Perks tab from 2, World news from 11");
ok(!U.encounter(hero(14), "giant") && U.encounter(hero(15), "giant") && U.encounter(s1, "bandits"), "elite road encounters wait for 15; plain ones don't");
ok(U.sections(s1, ["inn", "forge", "stables", "general"]).join() === "inn,general", "sections() filters a list");

// ---- the level-up event
const got = []; const off = U.on((d) => got.push(d));
const sl = hero(1); U.sync(sl, true);
ok(got.length === 0, "sync at level 1 opens nothing");
sl.level = 3; const fresh = U.sync(sl);
ok(got.length === 1 && got[0].level === 3 && got[0].ids.sort().join() === "cooking,gathering,perks", "level 1 → 3 fires once with perks, gathering, cooking");
ok(fresh.length === 3 && sl.unlocks.perks === 3, "sync stores the level each feature opened at");
U.sync(sl); ok(got.length === 1, "sync again fires nothing new");
ok(U.justOpened(sl).sort().join() === "cooking,gathering", "justOpened after the event still lists this level's features");
off(); sl.level = 4; U.sync(sl); ok(got.length === 1, "on() returns a working off()");

// ---- veterans and save migration
const v = G.newSave("vet" + Math.random(), "Old", "nord"); delete v.unlocks; delete v.unlocksV;
v.level = 3; v.horse = { name: "Frost" }; v.follower = { id: "lydia" }; v.lt = { ...(v.lt || {}), crafted: 4 }; v.homes = ["Whiterun"];
G.migrate(v);
ok(v.unlocksV === 1 && v.unlocks && typeof v.unlocks === "object", "migrate stores S.unlocks + S.unlocksV once");
ok(U.open(v, "horses") && U.open(v, "followers") && U.open(v, "smithing") && U.open(v, "housing"), "a veteran keeps the horse, follower, forge and house they already used");
ok(U.open(v, "perks") && U.open(v, "cooking"), "a veteran keeps everything below their level");
ok(!U.open(v, "worldevents") && !U.open(v, "worldbosses") && !U.open(v, "enchanting") && !U.open(v, "legendary"), "default save fields don't count as use (world events, bosses, enchanting, legendary)");
ok(v.unlocks.horses === 0, "kept features are marked 0 (had them before)");
v.horse = null; v.follower = null; G.migrate(v);
ok(U.open(v, "horses") && U.open(v, "followers"), "once kept, never flips back");
ok(U.cardBits(v).ul && U.cardBits(v).ul.includes("horses"), "party card tells others what this hero opened early");
const fresh2 = G.newSave("new" + Math.random(), "New", "nord"); U.newHero(fresh2); G.migrate(fresh2);
ok(U.TABLE.every((f) => !U.open(fresh2, f.id)), "a brand-new level-1 hero has nothing open after migrate (" + U.TABLE.filter((f) => U.open(fresh2, f.id)).map((f) => f.id) + ")");
const raw = JSON.parse(JSON.stringify(v)); G.migrate(raw);
ok(U.open(raw, "horses") && raw.unlocksV === 1, "save → load round trip keeps unlocks");
// a level-12 save from before unlocks existed: everything up to 12 opens, quietly
const old12 = G.newSave("o12" + Math.random(), "Old", "nord"); delete old12.unlocks; delete old12.unlocksV; old12.level = 12; G.migrate(old12);
ok(["perks", "smithing", "worldevents", "worldbosses"].every((id) => old12.unlocks[id] === 0) && !U.open(old12, "elite"), "an old level-12 save opens everything up to 12");
const before = got.length; U.on((d) => got.push(d)); U.sync(old12); ok(got.length === before, "migrated veterans get no flood of unlock pop-ups");

// ---- account: a new hero on an old account skips tutorials
const a = hero(1); a.acctLv = 12;
ok(U.skipFirstTrip(a) && U.skipTip(a, "smithing") && !U.skipTip(a, "legendary"), "acctLv 12 skips the first trip and tips up to 12");
ok(!U.skipFirstTrip(hero(1)), "a first hero gets the first trip");

// ---- dungeons and a party with mixed levels
const easy = Object.keys(WORLD.places).find((p) => { try { return DUNGEONS.info(p).tier === 1; } catch { return false; } });
const hard = Object.keys(WORLD.places).find((p) => { try { return DUNGEONS.info(p).tier === 2; } catch { return false; } });
const deadly = Object.keys(WORLD.places).find((p) => { try { return DUNGEONS.info(p).tier === 3; } catch { return false; } });
ok(easy && hard && deadly, "found an easy, a hard and a deadly dungeon");
ok(U.dungeon(s1, easy).ok, "easy dungeons are always open");
const g1 = U.dungeon(s1, hard);
ok(!g1.ok && g1.id === "dungeons" && g1.level === 7 && /level 7/.test(U.dungeonLine(g1)), "a hard dungeon is shut at 1 with a gentle line");
ok(U.dungeon(hero(7), hard).ok && !U.dungeon(hero(7), deadly).ok && U.dungeon(hero(10), deadly).ok, "hard from 7, deadly from 10");
const mates = [{ name: "Kacper", level: 12 }, { name: "Ola", level: 2 }];
const g2 = U.dungeon(s1, hard, { mates });
ok(g2.ok && g2.guest && g2.why === "party", "a level-1 hero comes into a hard dungeon as a guest of a level-12 friend");
ok(/guest/.test(U.note(g2.id)) && /level 7/.test(U.note(g2.id)), "guest note says when it opens");
ok(!U.dungeon(s1, hard, { mates: [{ name: "Ola", level: 2 }] }).ok, "two low-level heroes can't open it for each other");
ok(U.dungeon(s1, hard, { party: true }).guest, "the leader taking you in makes you a guest");
ok(U.lockedFor([{ name: "Kacper", level: 12 }, { name: "Ola", level: 2 }, { name: "Vet", level: 3, ul: ["dungeons"] }], "dungeons").join() === "Ola", "lockedFor names only members still locked (old-save card opens count)");
ok(U.lockedFor([], "dungeons").length === 0 && U.lockedFor([{ level: 1 }], "nope").length === 0, "lockedFor: empty party / unknown id");

// ---- road encounters respect the elite gate
if (typeof ENC !== "undefined" && ENC.L) {
  const elite = U.get("elite").enc;
  ok(elite.every((id) => ENC.L.some((e) => e.id === id)), "every elite encounter id exists in encounters.js");
}

console.log(fails ? "unlocks FAILED " + fails + " of " + n : "unlocks ok · " + n + " checks");
if (fails) process.exitCode = 1;
`, c);
if (c.process.exitCode) process.exitCode = c.process.exitCode;
