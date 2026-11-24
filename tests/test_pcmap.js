// PCMAP: the pure parts of the PC map screen: when it switches on, zoom limits, keeping the map over the window,
// zooming toward the cursor, which screens go where, and the fog of war lifting as you travel. MAPFX quality levels.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs");
const PCMAP = require(__GAME + "pcmap.js");
const MAPFX = require(__GAME + "mapfx.js");
const ok = (c, m) => { if (!c) throw new Error("FAIL " + m); console.log("ok", m); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

const html = fs.readFileSync(__GAME + "index.html", "utf8");
for (const f of ["pcmap.js", "mapfx.js", "greet.js", "i18n_pcmap.js"]) ok(html.includes(`<script src="${f}">`), "index.html loads " + f);

// on only for a mouse and a big window
ok(PCMAP.wide(1920, 1080, true) && PCMAP.wide(2560, 1080, true), "on for 1920x1080 and 2560x1080 with a mouse");
ok(!PCMAP.wide(1920, 1080, false), "off with a touch screen");
ok(!PCMAP.wide(390, 844, true) && !PCMAP.wide(1000, 1080, true), "off for narrow windows");

// zoom: zoomed all the way out the painting fills the window edge to edge (no empty band beside it) [mapvisuals]
const mz = PCMAP.minZoom(2560, 1080);
ok(near(mz, 1) && near(PCMAP.minZoom(3440, 1440), 1) && near(PCMAP.minZoom(1000, 700), 1), "min zoom: the map fills the window on any shape");
ok(PCMAP.MAXZ >= 6, "zooms in close");
for (const [cw, ch] of [[1920, 1080], [2000, 810], [2560, 1080], [3440, 1440]]) {
  const z = PCMAP.maxZoom(cw, ch), px = Math.max(cw / 1000, ch / 700) * z;
  ok(z >= 3 && z <= PCMAP.MAXZ && (px <= 14.01 || z === 3), `max zoom at ${cw}x${ch}: about 14 px per map unit (${px.toFixed(1)})`);
}

// zoom toward the cursor: the point under the mouse stays under the mouse
for (const [cw, ch] of [[1920, 1080], [2560, 1080]]) {
  const m = [0.42, 0.37], f = [700, 300], z = 2.5;
  const c = PCMAP.anchorCenter(m, f, z, cw, ch), k = Math.max(cw / 1000, ch / 700) * z;
  const sx = (m[0] - c[0]) * 1000 * k + cw / 2, sy = (m[1] - c[1]) * 700 * k + ch / 2;
  ok(near(sx, f[0], 1e-6) && near(sy, f[1], 1e-6), `wheel zoom keeps the cursor's spot at ${cw}x${ch}`);
}

// the map keeps covering the window when zoomed in, and sits in the middle when zoomed out
let c = PCMAP.clampCenter([-1, 2], 2, 1920, 1080);
const k2 = Math.max(1.92, 1080 / 700) * 2;
ok(near(c[0], 1920 / 2 / (k2 * 1000)) && near(c[1], 1 - 1080 / 2 / (k2 * 700)), "can't drag past the edge of the map");
c = PCMAP.clampCenter([0.1, 0.9], mz, 2560, 1080);
ok(near(c[0], 0.5) && c[1] > 0.5 && c[1] < 1, "zoomed all the way out on an ultrawide, the map fills the width and pans up and down");
c = PCMAP.clampCenter([0.1, 0.9], 0.6, 2560, 1080);
ok(near(c[0], 0.5) && near(c[1], 0.5), "smaller than the window, the map sits in the middle");
c = PCMAP.clampCenter([0.5, 2.5], 2, 1920, 1080, 2);
ok(c[1] > 2 && c[1] < 3, "Solstheim keeps its own map space");

// which screen goes where
ok(PCMAP.modeOf("map") === "home" && PCMAP.modeOf("places") === "home", "the map is home");
ok(PCMAP.modeOf("town") === "side", "the Area opens in a side panel");
ok(["log", "hero", "social", "skills"].every((t) => PCMAP.modeOf(t) === "full"), "the rest go full-screen over the map");

// fog of war lifts as you travel (uses where you've been and found)
const seen = [[0.5, 0.5]];
ok(PCMAP.fogAt([0.5, 0.5], seen) === 0, "clear where you are");
ok(PCMAP.fogged([0.6, 0.5], seen), "fogged 100 map px away");
ok(PCMAP.fogAt([0.5 + 0.045, 0.5], seen) > 0 && PCMAP.fogAt([0.5 + 0.045, 0.5], seen) < 1, "a soft edge in between");
ok(PCMAP.fogAt([0.2, 0.2], []) === 1, "with nothing found, everything is fogged");
// walk east along a road: the fog in front lifts step by step and never comes back behind you
const target = [0.62, 0.5]; let last = PCMAP.fogAt(target, seen);
for (let x = 0.51; x <= 0.62; x += 0.01) {
  seen.push([x, 0.5]);
  const f = PCMAP.fogAt(target, seen); ok(f <= last, `fog at the far end ${f.toFixed(2)} after reaching x=${x.toFixed(2)}`); last = f;
}
ok(last === 0 && !PCMAP.fogged([0.55, 0.5], seen) && PCMAP.fogged([0.55, 0.7], seen), "the road is clear, the hills beside it still fogged");

// map quality levels
ok(MAPFX.LV.low.wx === 0 && MAPFX.LV.low.smoke === 0, "Low: a still map");
ok(MAPFX.LV.high.wx > MAPFX.LV.med.wx && MAPFX.LV.high.smoke > MAPFX.LV.med.smoke && MAPFX.LV.high.birds > 0, "High has the most going on");
ok(!MAPFX.on() && !MAPFX.busy(false), "off outside the PC map screen");
ok(PCMAP.settingsHTML(() => "x") === "", "no Map quality row when the PC map is off (phones)");

// Polish for every new line
const vmc = { I18N_EXTRA: { words: {}, pat: [] } }; require("vm").runInNewContext(fs.readFileSync(__GAME + "i18n_pcmap.js", "utf8"), vmc);
global.I18N_EXTRA = vmc.I18N_EXTRA;
const pcSrc = fs.readFileSync(__GAME + "pcmap.js", "utf8") + fs.readFileSync(__GAME + "greet.js", "utf8");
const lines = [...new Set([...pcSrc.matchAll(/L\("([^"]+)"/g)].map((m) => m[1]))];
const btns = [...pcSrc.matchAll(/btn\("\w+", "[^"]*", "([^"]+)"/g)].map((m) => m[1]);
const missing = [...lines, ...btns, "Map quality", "Low", "Medium", "High"].filter((s) => !global.I18N_EXTRA.words[s]);
ok(!missing.length, "Polish for every new line" + (missing.length ? ": missing " + missing.join(" | ") : ""));
const pn = fs.readFileSync(__GAME + "patchnotes.js", "utf8");
ok(/id: "b165-pcmap"/.test(pn), "patch note b165-pcmap");
console.log("test_pcmap: all passed");
