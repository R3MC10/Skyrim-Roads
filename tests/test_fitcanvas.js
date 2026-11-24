/* fitcanvas.js and the no-stretch rules: canvases sized from their box × screen density (capped), fixed-unit mini-game
   canvases keep their shape, and no stylesheet squashes a picture with
   background-size:100% 100%. The on-screen check of every screen is tests/noscretch_ui.py. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };

function load(dpr) {
  const c = { console, Math, JSON, Object, Array, Map, Set, Number, String, devicePixelRatio: dpr };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(W + "fitcanvas.js", "utf8") + "\nthis.FITCANVAS = FITCANVAS;", c);
  return c.FITCANVAS;
}
function fakeCanvas(cssW, cssH) {
  const t = [];
  return { width: 300, height: 150, style: {}, dataset: {}, t,
    getBoundingClientRect() { return { width: cssW, height: cssH }; },
    getContext() { return { setTransform: (...a) => t.splice(0, 6, ...a) }; } };
}

for (const dpr of [1, 1.5, 2, 2.625, 3, 4]) {
  const F = load(dpr), d = Math.min(dpr, 2.5);
  ok(Math.abs(F.dpr() - d) < 1e-9, `dpr ${dpr}: capped to ${d}`);
  // a 300x220 mini-game shown 300 wide: backing = 300 × density, same shape, drawing still in 300x220 units
  for (const shown of [240, 300, 360]) {
    const cv = fakeCanvas(shown, shown * 220 / 300); F.fixed(cv, 300, 220);
    ok(Math.abs(cv.width / cv.height - 300 / 220) < 0.01, `dpr ${dpr} fixed ${shown}: shape kept (${cv.width}x${cv.height})`);
    ok(cv.width >= Math.floor(shown * d) - 1, `dpr ${dpr} fixed ${shown}: sharp (${cv.width} for ${shown}px)`);
    ok(Math.abs(cv.t[0] * 300 - cv.width) < 1e-6 && Math.abs(cv.t[3] * 220 - cv.height) < 1e-6, `dpr ${dpr} fixed: transform maps 300x220 onto the backing`);
    ok(cv.dataset.fit === "fixed" && cv.style.height === "auto", "fixed: CSS keeps the shape (height auto)");
  }
  // a box-filling canvas (map/title): backing = box × density, drawing in CSS pixels
  for (const [w, h] of [[360, 740], [844, 390], [2560, 1440]]) {
    const cv = fakeCanvas(w, h), r = F.fill(cv);
    ok(cv.width === Math.round(w * d) && cv.height === Math.round(h * d), `dpr ${dpr} fill ${w}x${h}: backing ${cv.width}x${cv.height}`);
    ok(r.w === w && r.h === h, "fill: drawing size is the box in CSS pixels");
  }
  // a picture drawn 520 units wide into a 900px box gets enough pixels
  const box = fakeCanvas(900, 400);
  ok(Math.abs(F.ratio(box, 520) - (900 / 520) * d) < 1e-9, `dpr ${dpr} ratio: box/units × density`);
}

// stylesheet: no painted picture squashed to fit a box
const html = fs.readFileSync(W + "index.html", "utf8");
const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
for (const rule of css.split("}")) {
  if (/background-size:\s*100%\s+100%/.test(rule) && /url\(/.test(rule) && !/data:image\/svg/.test(rule)) ok(false, "background-size:100% 100% on a picture: " + rule.trim().slice(0, 120));
}
ok(/viewport-fit=cover/.test(html), "viewport covers the whole phone (safe areas come through)");
ok(/<script src="fitcanvas.js"><\/script>/.test(html), "fitcanvas.js is loaded");
// the mini-games draw through the helper (sharp on every phone)
for (const f of ["immerse.js", "pickgame.js", "craftgames.js"]) ok(/FITCANVAS\.fixed\(/.test(fs.readFileSync(W + f, "utf8")), f + " sizes its canvas with FITCANVAS.fixed");

if (fails) { console.log(`test_fitcanvas: ${fails} failed`); process.exit(1); }
console.log("test_fitcanvas: all good");
