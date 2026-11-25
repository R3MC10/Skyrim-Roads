// Painted world map (paintedmap.js + map.js): the "map-world" asset key, the fallback to the procedural map, and the
// world → picture mapping. Runs map.js's real draw() against a recording fake canvas.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const bad = [];
const ok = (cond, msg) => { if (!cond) bad.push(msg); console.log((cond ? "ok   " : "BAD  ") + msg); };

// ---- a canvas that records what is drawn
let calls = [], canvases = [];
function fakeCtx(cv) {
  const st = { lineWidth: 1, font: "", letterSpacing: "0px" };
  return new Proxy(st, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === "createImageData") return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern") return () => ({ addColorStop() {} });
      if (k === "measureText") return (s) => ({ width: String(s).length * 7 });
      if (k === "canvas") return cv;
      return (...a) => { calls.push([k, cv, ...a]); };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function makeCanvas() { const cv = { width: 300, height: 150, clientWidth: 800, clientHeight: 560 }; cv.getContext = () => (cv._g = cv._g || fakeCtx(cv)); canvases.push(cv); return cv; }
class Path2D { constructor() {} moveTo() {} lineTo() {} closePath() {} rect() {} addPath() {} quadraticCurveTo() {} }
let store = {};
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Uint8ClampedArray, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, Path2D,
  document: { createElement: () => makeCanvas() }, window: { devicePixelRatio: 1 },
  localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } };
vm.createContext(c);
for (const f of ["world.js", "terrain.js", "map.js", "paintedmap.js"])
  vm.runInContext(fs.readFileSync(__GAME + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);

// ---- 1. the asset key
const assetsSrc = fs.readFileSync(__GAME + "assets.js", "utf8");
ok(/^\s*map-world\s+2000×1400/m.test(assetsSrc), "assets.js manifest lists map-world (2000×1400)");
ok(/map-world-2x/.test(assetsSrc), "...and the optional map-world-2x");
ok(/stateOf/.test(assetsSrc) && /return \{[^}]*stateOf/.test(assetsSrc), "ASSETS.stateOf(key) is exported");
ok(c.PAINTEDMAP.KEY === "map-world" && c.PAINTEDMAP.KEY2 === "map-world-2x", "paintedmap.js asks for map-world / map-world-2x");
ok(fs.readFileSync(__GAME + "index.html", "utf8").includes('<script src="paintedmap.js"></script>'), "index.html loads paintedmap.js");

// ---- fake ASSETS: which pictures exist
let files = {}, asked = new Set();
c.ASSETS = { img: (k) => { asked.add(k); return files[k]?.st === "ok" ? files[k].im : null; }, stateOf: (k) => { asked.add(k); return files[k]?.st || "none"; } };
const pic = (w, h) => ({ naturalWidth: w, naturalHeight: h, tag: "painting " + w + "x" + h });
const view = (zoom = 1) => ({ player: c.WORLD.places.Whiterun.slice(0, 2), name: "Test", discovered: ["Whiterun", "Solitude", "Riften", "Markarth", "Windhelm"], explored: [], others: [], bags: [],
  zoom, center: [0.5, 0.5], t: 0, reduceMotion: true, season: "summer", weather: "clear" });
function frame(v) {
  calls = []; canvases = [];
  const cv = makeCanvas(); canvases = [];
  c.WorldMap.draw(cv, v);
  return { v, cv, onScreen: calls.filter((x) => x[1] === cv), built: canvases.filter((k) => k.width >= 2000) };
}
const isBase = (im) => !!im && (im.tag || im.width === 2400);   // a painting or the procedural base (not fog, tints, seasons)
const baseDraws = (f) => f.onScreen.filter((x) => x[0] === "drawImage" && isBase(x[2]) && x[3] === 0 && x[4] === 0 && x[5] === 1000 && x[6] === 700);

// ---- 2. no picture: the procedural map, unchanged
let f = frame(view());
ok(f.built.length === 1 && f.built[0].width === 2400 && f.built[0].height === 1680, "no file: the procedural base is built (2400×1680)");
ok(baseDraws(f)[0]?.[2] === f.built[0], "...and drawn over the world bounds (0,0 → 1000×700)");
ok(!asked.has("map-world-2x"), "zoomed out: map-world-2x is not asked for");
const tProc = f.v.transform;
ok(c.PAINTEDMAP.settingsHTML((k, o, cur) => "SEG") === "", "no painting: no Roads switch in Settings");

// ---- 3. a painting of the right shape
files["map-world"] = { st: "ok", im: pic(2000, 1400) };
f = frame(view());
ok(f.built.length === 0, "painting in: the procedural base is not built");
ok(baseDraws(f)[0]?.[2] === files["map-world"].im, "the painting is drawn as the base, stretched over the world bounds");
ok(JSON.stringify(f.v.transform) === JSON.stringify(tProc), "same screen ↔ world transform as the procedural map (taps, icons, travel unchanged)");
const roadStrokesOn = f.onScreen.filter((x) => x[0] === "stroke").length;
ok(f.onScreen.some((x) => x[0] === "fillText" && /WHITERUN|THE PALE|EASTMARCH/.test(x[2])), "hold names drawn over the painting");
ok(f.onScreen.some((x) => x[0] === "fillText" && x[2] === "N"), "compass drawn over the painting");
// mapping: every place's icon lands on the picture pixel for its world point
const im = files["map-world"].im;
let worst = 0;
for (const [n, p] of Object.entries(c.WORLD.places)) {
  if (!(p[1] <= 1)) continue;
  const [px, py] = c.PAINTEDMAP.toPixel(p, im), mapX = px * 1000 / im.naturalWidth, mapY = py * 700 / im.naturalHeight;   // where drawImage(im,0,0,1000,700) puts that pixel
  worst = Math.max(worst, Math.abs(mapX - p[0] * 1000), Math.abs(mapY - p[1] * 700));
  const back = c.PAINTEDMAP.toWorld([px, py], im); worst = Math.max(worst, Math.abs(back[0] - p[0]) * 1000, Math.abs(back[1] - p[1]) * 700);
}
ok(worst < 1e-6, "every place: world (x,y) → picture (x·w, y·h) → map units matches its icon (worst " + worst.toExponential(1) + ")");
const wr = c.PAINTEDMAP.toPixel(c.WORLD.places.Whiterun, { naturalWidth: 1540, naturalHeight: 1078 });
ok(Math.round(wr[0]) === Math.round(c.WORLD.places.Whiterun[0] * 1540) && Math.round(wr[1]) === Math.round(c.WORLD.places.Whiterun[1] * 1078), "reference size 1540×1078: Whiterun at (" + wr.map(Math.round) + ")");
ok(c.PAINTEDMAP.settingsHTML(() => "SEG").includes("Roads on the map"), "painting in: Settings → Graphics shows Roads on the map");

// ---- 4. the roads toggle
ok(c.PAINTEDMAP.roads() === true, "roads on by default");
ok(c.PAINTEDMAP.pref("mapRoads", "false") === true && c.PAINTEDMAP.roads() === false, "Roads off is remembered");
f = frame(view());
const roadStrokesOff = f.onScreen.filter((x) => x[0] === "stroke").length;
ok(roadStrokesOn - roadStrokesOff >= c.Terrain.roads.length, "roads off: the game's roads are not drawn over the painting (" + roadStrokesOn + " → " + roadStrokesOff + " strokes)");
c.PAINTEDMAP.pref("mapRoads", "true");
ok(c.PAINTEDMAP.pref("lighting", "low") === false, "other settings are left alone");

// ---- 5. zoom: map-world-2x
f = frame(view(2.5));
ok(asked.has("map-world-2x"), "zoomed in: map-world-2x is asked for");
ok(baseDraws(f)[0]?.[2] === im, "...while it is missing, the 1× painting stays");
files["map-world-2x"] = { st: "ok", im: pic(3000, 2100) };
f = frame(view(2.5));
ok(baseDraws(f)[0]?.[2] === files["map-world-2x"].im, "2× painting used when zoomed in");
f = frame(view(1));
ok(baseDraws(f)[0]?.[2] === files["map-world-2x"].im, "...and kept when zooming out (one big picture at a time)");
ok(baseDraws(f).length === 1, "the base is drawn once a frame");

// ---- 6. wrong shape, loading, Solstheim
files = { "map-world": { st: "ok", im: pic(1536, 1024) } };
c.console = { ...console, warn: () => {} };
const fresh = () => vm.runInContext(fs.readFileSync(__GAME + "paintedmap.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
fresh();
f = frame(view());
ok(f.built.length === 1 && baseDraws(f)[0]?.[2] === f.built[0], "a 3:2 picture is refused: procedural map");
files = { "map-world": { st: "loading" } }; fresh();
f = frame(view());
ok(f.built.length === 0 && baseDraws(f).length === 0 && f.onScreen.some((x) => x[0] === "fillRect" && x[4] === 1000), "still loading: plain sea, no procedural build yet");
files = {}; fresh();
f = frame(view());
ok(baseDraws(f)[0]?.[2]?.width === 2400, "missing after all: procedural map");
files = { "map-world": { st: "ok", im: pic(2000, 1400) } }; fresh();
f = frame(view());
ok(f.built.length === 0, "painting arrives later: it takes over (procedural picture released)");
ok(c.PAINTEDMAP.image(1) === files["map-world"].im && c.PAINTEDMAP.active(), "PAINTEDMAP.image / active");

// ---- 7. the tile pyramid (maptiles.js): every tile file there, the right level per zoom, only the tiles in view
const MT = require(__GAME + "maptiles.js");
const idx = fs.readFileSync(__GAME + "index.html", "utf8");
ok(idx.includes('<script src="maptiles.js"></script>') && idx.indexOf("maptiles.js") < idx.indexOf('src="map.js"'), "index.html loads maptiles.js before map.js");
ok(/mapt-<L>-<col>-<row>/.test(assetsSrc), "assets.js manifest lists the mapt- tiles");
let missingTiles = 0, tileCount = 0;
for (let L = 1; L <= MT.TOP; L++) {
  const [lw, lh] = MT.LEVELS[L];
  for (let r = 0; r < Math.ceil(lh / MT.TILE); r++) for (let cc = 0; cc < Math.ceil(lw / MT.TILE); cc++) { tileCount++; if (!fs.existsSync(__GAME + `mapt-${L}-${cc}-${r}.webp`)) missingTiles++; }
}
ok(missingTiles === 0, `all ${tileCount} pyramid tiles are in the game folder (${missingTiles} missing)`);
ok(MT.LEVELS[MT.TOP][0] >= 7680 && MT.LEVELS[MT.TOP][0] / MT.LEVELS[MT.TOP][1] === 10 / 7, "top level is 8K-class and exactly 10:7");
ok(MT.levelFor(2000) === 1 && MT.levelFor(6000) === 1 && MT.levelFor(6100) === 2 && MT.levelFor(30000) === 2, "level per zoom: level 1 up to 1.5x its pixels, then level 2");
const tv = MT.tilesIn(2, [480, 330, 520, 360]);   // a small box around Whiterun
ok(tv.length >= 1 && tv.length <= 4 && tv.every(([x, y]) => x >= 7 && x <= 8 && y >= 5 && y <= 5), `only the tiles in view are asked for (${JSON.stringify(tv)})`);
ok(MT.tilesIn(2, [-50, -50, 1050, 750]).length === 176, "whole map at level 2 = 16x11 tiles, clamped at the edges");

console.log(bad.length ? `\n${bad.length} FAILED` : "\nall ok");
process.exit(bad.length ? 1 : 0);
