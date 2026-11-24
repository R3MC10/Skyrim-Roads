// Painted dungeon rooms (dunrooms.js): file names, closest-theme fallback, and a waiting frame while a picture loads.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm"), W = __GAME;
const fail = (m) => { console.error("FAIL", m); process.exit(1); };
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Proxy, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "dunrooms.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);

// every painting in the game folder follows room-<type>-<theme>.webp with a known type and theme
const files = fs.readdirSync(W).filter((f) => /^room-/.test(f));
const themes = [...Object.keys(c.DUNGEONS.THEMES), "giantcamp", "lair"];
for (const f of files) {
  const m = f.match(/^room-([a-z]+)-([a-z]+)\.webp$/); if (!m) fail("bad name " + f);
  if (!c.DUNROOMS.TYPES.includes(m[1])) fail("unknown room type in " + f);
  if (!themes.includes(m[2])) fail("unknown theme in " + f);
  const b = fs.readFileSync(W + f); if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") fail(f + " is not a WebP");
  if (b.length > 450 * 1024) fail(f + " is over 450 KB");
}
for (const th of ["cave", "barrow", "dwemer"]) for (const ty of ["fight", "elite", "trap", "treasure", "puzzle", "rest", "boss"])
  if (!files.includes(`room-${ty}-${th}.webp`)) fail(`missing room-${ty}-${th}.webp`);
for (const th of themes) if (!c.DUNROOMS.NEAR[th] || c.DUNROOMS.NEAR[th][0] !== th) fail("no fallback list for theme " + th);
if (!/room-<type>-<theme>/.test(fs.readFileSync(W + "assets.js", "utf8"))) fail("assets.js doesn't document room pictures");

// fallback: a fake picture store that has exactly the files in the folder
const have = new Set(files.map((f) => f.replace(/\.webp$/, "")));
let pending = new Set();
c.ASSETS = { state: (k) => (pending.has(k) ? "loading" : have.has(k) ? "ok" : "none"), url: (k) => k + ".webp", on() {} };
const pick = (ty, th) => c.DUNROOMS.pick(ty, th);
const expect = (ty, th, key) => { const p = pick(ty, th); if ((p && p.key) !== key) fail(`${ty}/${th}: got ${p && p.key}, want ${key}`); };
expect("fight", "cave", "room-fight-cave");
expect("fight", "mine", "room-fight-mine");
expect("trap", "mine", "room-trap-cave");          // mine has only a fight painting: borrows the cave's trap
expect("rest", "temple", "room-rest-barrow");
expect("boss", "vampire", "room-boss-barrow");
expect("puzzle", "dwemer", "room-puzzle-dwemer");
expect("mystery", "cave", "room-fight-cave");      // no mystery paintings yet: the plain room of that dungeon
if (pick("boss", "lair") !== null) fail("a dragon lair must not borrow a cave painting");
if (pick("boss", "giantcamp") !== null) fail("a giant camp must not borrow a cave painting");
pending = new Set(["room-trap-mine"]);
if (!pick("trap", "mine")?.wait) fail("should wait while a closer painting is still loading");
pending = new Set();
// the room HTML: painted picture, or the old drawing when there's nothing
c.PLACEART = { room: (t) => `<img class="art scene sec" alt="${t}">` };
if (!/droomart painted[\s\S]*room-fight-barrow\.webp/.test(c.DUNROOMS.room("fight", "barrow"))) fail("painted room html");
if (!/droomart drawn[\s\S]*art scene sec/.test(c.DUNROOMS.room("boss", "lair"))) fail("drawn fallback html");
c.ASSETS = undefined;
if (!/droomart drawn/.test(c.DUNROOMS.room("fight", "cave"))) fail("works without the picture store");
console.log(`dunrooms ok · ${files.length} paintings · ${themes.length} themes with fallbacks`);
