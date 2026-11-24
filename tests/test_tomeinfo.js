/* Spell tome info before you buy/read (tomeinfo.js): every tome says its school, level, magicka cost, what it
   does, whether you know it and whether your skill is enough; shop rows, the pack, loot and search use it.
   W=/path/to/game/ node test_tomeinfo.js */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "tomeinfo.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "tbfight.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0;
const ok = (c, m) => { n++; if (!c) throw new Error("FAIL " + m); };
const T = TOMEINFO;
function mage(sk) { const s = G.newSave("Tome", "Mage", "breton"); s.location = "Winterhold"; [s.x, s.y] = WORLD.places.Winterhold; s.level = 20;
  for (const k of ["Destruction", "Restoration", "Alteration", "Conjuration", "Illusion"]) s.skills[k].lvl = sk; return s; }
const tomes = Object.keys(D.ITEMS).filter((i) => D.ITEMS[i].slot === "tome" && D.SPELLS[D.ITEMS[i].spell]);
ok(tomes.length > 60, "plenty of tomes (" + tomes.length + ")");
const strip = (h) => h.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();

// ---- every tome: line, row box and card say the same things
let s = mage(30);
for (const t of tomes) {
  const sp = D.SPELLS[D.ITEMS[t].spell], f = T.facts(s, t), lv = f.level;
  ok(f && f.name === sp.name && f.school === sp.school && MAGIC.LEVELS.includes(lv), t + " facts " + JSON.stringify(f && [f.name, f.school, lv]));
  const line = T.line(s, t);
  ok(line.startsWith(lv + " " + sp.school), t + " line starts with level + school: " + line);
  if (sp.kind === "utility") ok(/no magicka/.test(line) && f.dualCost == null, t + " utility has no magicka: " + line);
  else {
    ok(Number.isFinite(f.cost) && f.cost >= 0 && new RegExp("\\\\b" + f.cost + " magicka").test(line), t + " magicka in line: " + line);
    ok(!/\bAP\b/.test(line), t + " no action points any more: " + line);
  }
  const box = T.box(s, t), bt = strip(box);
  ok(box.includes('class="ti-box"') && bt.length > 8, t + " row box has a description: " + bt);
  ok(!/undefined|NaN|null/.test(box + line), t + " no undefined/NaN: " + bt + " | " + line);
  const card = T.html(s, t), ct = strip(card);
  ok(ct.includes(sp.school) && ct.includes(lv) && /Magicka/i.test(ct) && !/\bAP\b/.test(ct), t + " card has school/level/magicka, no AP: " + ct);
  ok(card.includes(sp.name.replace(/'/g, "&#39;")), t + " card names the spell");
  ok(!/undefined|NaN/.test(card), t + " card clean: " + ct);
  ok(T.box(null, t) && T.line(null, t).startsWith(lv), t + " works without a character");
}
ok(T.box(s, "iron_sword") === "" && T.line(s, "iron_sword") === "" && T.html(s, "iron_sword") === "" && !T.isTome("iron_sword"), "non-tomes give nothing");
ok(T.html(s, "firebolt").includes("Firebolt"), "html takes a spell id too (search)");

// ---- what it does, in plain words or exact numbers
ok(/fire damage/.test(strip(T.box(s, "tome_firebolt"))), "Firebolt row says fire damage: " + strip(T.box(s, "tome_firebolt")));
ok(/health/.test(strip(T.box(s, "tome_fast_healing"))), "Fast Healing row says health");
if (D.ITEMS.tome_candlelight) ok(/Out of fights/.test(strip(T.box(s, "tome_candlelight"))), "Candlelight row explains the out-of-fight use");
if (D.ITEMS.tome_lesser_ward) ok(/soaks/.test(strip(T.box(s, "tome_lesser_ward"))), "Lesser Ward explains the shield");

// ---- known / skill verdicts
s = mage(15); s.spells = s.spells.filter((x) => x !== "firebolt");
ok(/needs Destruction 25/.test(T.line(s, "tome_firebolt")), "Apprentice at 15 says needs 25: " + T.line(s, "tome_firebolt"));
ok(/under 25/.test(strip(T.box(s, "tome_firebolt"))) && /fizzles \\d+%/.test(strip(T.box(s, "tome_firebolt"))), "low skill warns about fizzles: " + strip(T.box(s, "tome_firebolt")));
s.spells.push("firebolt");
ok(/you know it/.test(T.line(s, "tome_firebolt")) && /already know/.test(strip(T.box(s, "tome_firebolt"))), "known spell says so");
s = mage(60);
ok(/is enough/.test(strip(T.box(s, "tome_chain_lightning"))) && !/needs/.test(T.line(s, "tome_chain_lightning")), "Adept at 60 is enough");
const master = tomes.find((t) => D.SPELLS[D.ITEMS[t].spell].level === "Master");
if (master) { const ms = mage(80); ok(/Needs \\w+ 90/.test(strip(T.box(ms, master))), "Master tome says the College wants 90: " + strip(T.box(ms, master))); }

// ---- G.itemStats shows the tome line once bound (sell list, pack rows, caravans, market stalls)
const me = mage(30); T.bind(() => me);
ok(G.itemStats("tome_firebolt") === T.line(me, "tome_firebolt") && /magicka/.test(G.itemStats("tome_firebolt")), "itemStats uses the tome line: " + G.itemStats("tome_firebolt"));
ok(/dmg/.test(G.itemStats("iron_sword")), "itemStats unchanged for other items");

// ---- every tome on the College shelves gets a described row
const shelf = SPELLBOOK.stockAt("Winterhold", "wizard", mage(100)).filter((i) => T.isTome(i));
ok(shelf.length >= 10, "College shelf has tomes (" + shelf.length + ")");
for (const t of shelf) ok(strip(T.box(me, t)).length > 8, "shelf row described: " + t);
this.__n = n;
`, c);

// ---- the screens use it (ui.js is browser-only, so check the hooks)
const ui = fs.readFileSync(W + "ui.js", "utf8"), html = fs.readFileSync(W + "index.html", "utf8");
const okS = (cond, m) => { if (!cond) throw new Error("FAIL " + m); };
okS(/const shopRow = [^\n]*\$\{tiBox\(i\)\}<\/div>`; \};/.test(ui), "merchant buy rows include the tome box");
okS(/evbuy[^\n]*\$\{tiBox\(i\)\}/.test(ui), "road trader rows include the tome box");
okS(/cvbuy[^\n]*\$\{tiBox\(i\)\}/.test(ui), "caravan rows include the tome box");
okS(/mbuy[^\n]*tiBox\(d\.row\.item\)/.test(ui), "market stall rows include the tome box");
okS(/TI\.html\(S, r\.item, \{ head: false \}\)/.test(ui), "pack detail shows the tome card");
okS(/TI\.bind\(\(\) => S\)/.test(ui), "ui binds the player for itemStats");
okS(/TOMEINFO\.box\(S, i\)/.test(fs.readFileSync(W + "worldevents.js", "utf8")), "Khajiit caravan rows include the tome box");
okS(/TOMEINFO\.line\(s, it\.item\)/.test(fs.readFileSync(W + "lootvote.js", "utf8")), "loot vote rows show the tome line");
okS(/TOMEINFO\.html\(S, e\.id/.test(fs.readFileSync(W + "search.js", "utf8")), "search spell page shows the tome card");
okS(html.indexOf('src="tomeinfo.js"') > html.indexOf('src="spellbook.js"') && html.indexOf('src="tomeinfo.js"') < html.indexOf('src="ui.js"'), "tomeinfo.js loads after spellbook.js, before ui.js");
okS(/\.ti-box\{/.test(html) && /html\.art-pixel \.ti-box/.test(html), "tome info styles for ink and pixel");
console.log("tomeinfo", c.__n, "checks + screen hooks: ALL OK");
