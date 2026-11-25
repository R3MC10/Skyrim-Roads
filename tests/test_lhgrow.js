const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* The longhouse visibly grows (longhouse.js hallView + lhgrow-<room>-<level> art): 15 painted patches, one fixed box per
   room (no overlaps, inside the plate), only the highest level shows, mixed levels, the crossfade after a build, tap areas
   for every room, the drawn fallback while a picture hasn't loaded, old saves without rooms, small files, the manifest
   line in assets.js, and the patch note in Polish. W=/path/to/game/ node test_lhgrow.js — prints "lhgrow ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log("FAIL", m); } };

// a fake ASSETS: every key that exists as a file in the game folder "has loaded"
const have = new Set(fs.readdirSync(W).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5)));
const c = { console, Math, Date, JSON, Object, Array, Set, Map, WeakMap, Number, String, Promise, setInterval: () => 0, clearInterval: () => {},
  ASSETS: { url: (k) => (c.__off.has(k) || !have.has(k) ? "" : k + ".webp") }, __off: new Set() };
vm.createContext(c);
for (const f of ["data.js", "world.js", "formulas.js", "perks.js", "perkfx.js", "engine.js", "i18n_longhouse.js", "longhouse.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const L = c.LONGHOUSE;
const ROOMS = L.ROOM_IDS, G = L.GROW;

// ---- 1. the boxes: one per room, inside the 1024x576 frame, none overlapping
ok(ROOMS.length === 5 && ROOMS.every((r) => Array.isArray(G[r]) && G[r].length === 4), "a box for every room");
for (const r of ROOMS) { const [x, y, w, h] = G[r]; ok(x >= 0 && y >= 0 && x + w <= 1024 && y + h <= 576 && w > 40 && h > 40, `${r} box inside the plate`); }
for (let i = 0; i < ROOMS.length; i++) for (let j = i + 1; j < ROOMS.length; j++) {
  const [ax, ay, aw, ah] = G[ROOMS[i]], [bx, by, bw, bh] = G[ROOMS[j]];
  ok(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `${ROOMS[i]} and ${ROOMS[j]} don't overlap`);
}

// ---- 2. the 15 pictures: present, WebP, small, the same shape as their box
const dims = (buf) => {   // VP8X canvas size (transparent WebP)
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const ch = buf.toString("ascii", 12, 16);
  if (ch === "VP8X") return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (ch === "VP8L") { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  if (ch === "VP8 ") return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  return null;
};
let total = 0;
for (const r of ROOMS) for (let l = 1; l <= 3; l++) {
  const f = W + L.growKey(r, l) + ".webp";
  ok(fs.existsSync(f), `${f} exists`); if (!fs.existsSync(f)) continue;
  const buf = fs.readFileSync(f), d = dims(buf); total += buf.length;
  ok(buf.length < 90 * 1024, `${r}-${l} is small (${buf.length} bytes)`);
  ok(d && Math.abs(d[0] / d[1] - G[r][2] / G[r][3]) < 0.03, `${r}-${l} has the shape of its box (${d})`);
  ok(d && d[0] <= G[r][2] * 2 + 2, `${r}-${l} is no bigger than the plate's own pixels`);
}
ok(total < 900 * 1024, `all 15 patches stay under 900 KB (${Math.round(total / 1024)} KB)`);

// ---- 3. only the highest level of each room, mixed levels
const imgs = (h) => [...h.matchAll(/<image class="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
let h = L.hallView({ rooms: { forge: 3, library: 1, trophy: 0, stables: 2, plan: 1 } }, "co1");
let im = imgs(h);
ok(im.length === 4, "four built rooms, four patches");
ok(im.some(([, u]) => u === "lhgrow-forge-3.webp") && !im.some(([, u]) => /forge-[12]/.test(u)), "forge shows level 3 only");
ok(im.some(([, u]) => u === "lhgrow-stables-2.webp") && im.some(([, u]) => u === "lhgrow-library-1.webp") && im.some(([, u]) => u === "lhgrow-plan-1.webp"), "mixed levels");
ok(!im.some(([, u]) => /trophy/.test(u)), "an unbuilt room shows nothing");
ok(!/lng-in|lng-out/.test(h), "no crossfade the first time");
ok((h.match(/data-lng="room"/g) || []).length === 5 && ROOMS.every((r) => h.includes(`data-id="${r}"`)), "a tap area for every room");
ok(!/lng-shut/.test(h), "painted library: no drawn shutters on top");

// ---- 4. the crossfade after a build (same company), none when the company changes
h = L.hallView({ rooms: { forge: 3, library: 2, trophy: 1, stables: 2, plan: 1 } }, "co1");
im = imgs(h);
ok(im.some(([cl, u]) => /lng-in/.test(cl) && u === "lhgrow-library-2.webp") && im.some(([cl, u]) => /lng-out/.test(cl) && u === "lhgrow-library-1.webp"), "library 1 -> 2 crossfades");
ok(im.some(([cl, u]) => /lng-in/.test(cl) && u === "lhgrow-trophy-1.webp") && !im.some(([cl, u]) => /lng-out/.test(cl) && /trophy/.test(u)), "a new room fades in");
ok(!im.some(([cl, u]) => /lng-in/.test(cl) && /forge/.test(u)), "unchanged rooms don't fade");
const h2 = L.hallView({ rooms: { forge: 3, library: 2, trophy: 1, stables: 2, plan: 1 } }, "co1");
ok(/lng-in/.test(h2) && /animation-delay:-\d+ms/.test(h2), "a redraw mid-fade keeps going where it was");
h = L.hallView({ rooms: { forge: 3, library: 3, trophy: 3, stables: 3, plan: 3 } }, "co2");
ok(!/lng-in|lng-out/.test(h), "another company: no crossfade");
ok(imgs(h).length === 5 && imgs(h).every(([, u]) => /-3\.webp$/.test(u)), "fully built: all five at level 3");

// ---- 5. a picture that hasn't loaded keeps the drawn light; old saves
c.__off = new Set(["lhgrow-library-1", "lhgrow-forge-2"]);
h = L.hallView({ rooms: { forge: 2, library: 1, trophy: 0, stables: 0, plan: 0 } }, "co3");
ok(/lng-shut/.test(h) && /url\(#lngF\)/.test(h), "missing pictures fall back to the drawn light");
c.__off = new Set();
let threw = false; try { h = L.hallView({}, "co4"); } catch (e) { threw = e; }
ok(!threw && /lng-view/.test(h) && imgs(h).length === 0, "an old company without rooms still draws");

// ---- 6. the manifest line, CSS, Polish patch note
const A = fs.readFileSync(W + "assets.js", "utf8"), I = fs.readFileSync(W + "index.html", "utf8"), PN = fs.readFileSync(W + "patchnotes.js", "utf8");
ok(/lhgrow-<room>-<1\|2\|3>/.test(A), "assets.js lists the lhgrow pictures");
ok(/\.lng-view svg \.lng-in\{animation/.test(I) && /@keyframes lngIn/.test(I), "the crossfade CSS is there");
const pn = PN.match(/\{ id: "b\d+-lhgrow"[\s\S]*?\] \}/);
ok(!!pn, "patch note");
const PL = fs.readFileSync(W + "i18n_longhouse.js", "utf8");
if (pn) for (const s of [...pn[0].matchAll(/"((?:[^"\\]|\\.)+)"/g)].map((m) => m[1]).filter((s) => / /.test(s) && !/^b\d/.test(s) && !/Nov/.test(s)))
  ok(PL.includes(JSON.stringify(s).slice(1, -1)), `Polish for: ${s}`);

console.log(fails ? `${fails} of ${n} failed` : "lhgrow ok");
process.exit(fails ? 1 : 0);
