const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Accessibility (access.js): saved settings, page classes, the reduce-motion answer, the canvas colour map,
// colour-blind palettes that really stay apart (Machado 2009 simulation), and the hooks in index.html / ui.js.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const SRC = fs.readFileSync(W + "access.js", "utf8").replace(/^const (\w+) =/m, "var $1 =");
const ok = (c, m) => { if (!c) throw new Error("FAIL " + m); };

// ---- a tiny fake page: just what access.js touches
function page(prefs, sysReduce = false) {
  const store = { rotn_prefs: JSON.stringify(prefs || {}) };
  const classes = new Set(), props = {}, dataset = {};
  const listeners = [];
  const realMQ = (q) => ({ media: q, matches: /reduced-motion/.test(q) ? sysReduce : false, addEventListener: (t, f) => listeners.push(f) });
  class Ctx {} let fill = "#000000", stroke = "#000000";
  Object.defineProperty(Ctx.prototype, "fillStyle", { configurable: true, get() { return fill; }, set(v) { fill = v; } });
  Object.defineProperty(Ctx.prototype, "strokeStyle", { configurable: true, get() { return stroke; }, set(v) { stroke = v; } });
  class Grad { addColorStop(o, c) { this.last = c; } }
  const html = {
    classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) },
    style: { setProperty: (k, v) => (props[k] = v) }, dataset,
  };
  const win = { matchMedia: realMQ, CanvasRenderingContext2D: Ctx, CanvasGradient: Grad, dispatchEvent() {} };
  const c = {
    console, Math, JSON, Object, Array, Set, Map, Number, String, Event: class { constructor(t) { this.type = t; } },
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)) },
    document: { documentElement: html, styleSheets: [] }, window: win,
  };
  vm.createContext(c);
  vm.runInContext(SRC, c);
  return { A: c.ACCESS, win, classes, props, dataset, store, Ctx, Grad, sysListeners: listeners };
}

// ---- defaults: nothing changes for players who never open the section
{
  const p = page({});
  ok(JSON.stringify(p.A.settings()) === JSON.stringify({ a11yText: 0, a11yColour: "none", a11yContrast: false, a11yMotion: "auto", a11yHand: "off" }), "defaults " + JSON.stringify(p.A.settings()));
  ok(p.props["--tz"] === "1" && !p.classes.has("a11y-zoom") && !p.dataset.cb && !p.classes.has("a11y-hc") && !p.classes.has("a11y-1h"), "default page untouched");
  ok(p.win.matchMedia("(prefers-reduced-motion: reduce)").matches === false, "auto follows the phone (off)");
  ok(p.A.remap("#d65a4a") === "#d65a4a", "no colour mode, no remap");
}
// ---- the phone asks for less motion: respected by default
{
  const p = page({}, true);
  ok(p.win.matchMedia("(prefers-reduced-motion:reduce)").matches === true && p.classes.has("a11y-still"), "auto follows the phone (reduce)");
  p.A.pref("a11yMotion", "off");
  ok(p.win.matchMedia("(prefers-reduced-motion: reduce)").matches === false && !p.classes.has("a11y-still"), "player can turn it back on");
  ok(p.win.matchMedia("(min-width: 700px)").matches === false, "other media queries pass straight through");
}
// ---- saved choices load before first paint, bad values are cleaned up
{
  const p = page({ a11yText: 3, a11yColour: "tritan", a11yContrast: true, a11yMotion: "on", a11yHand: "left", lang: "pl" });
  ok(p.props["--tz"] === "1.38" && p.classes.has("a11y-zoom") && p.dataset.a11yText === "3", "text size applied");
  ok(p.dataset.cb === "tritan" && p.classes.has("a11y-hc") && p.classes.has("a11y-still"), "colour, contrast, motion applied");
  ok(p.classes.has("a11y-1h") && p.classes.has("a11y-1h-left"), "left-hand mode applied");
  const q = page({ a11yText: 9, a11yColour: "rainbow", a11yMotion: "sometimes", a11yHand: "both" });
  const s = q.A.settings();
  ok(s.a11yText === 3 && s.a11yColour === "none" && s.a11yMotion === "auto" && s.a11yHand === "off", "bad values cleaned " + JSON.stringify(s));
}
// ---- changing a setting: saved in rotn_prefs next to the others, page updates at once
{
  const p = page({ lang: "pl", zoomFar: true });
  let heard = null;
  const mq = p.win.matchMedia("(prefers-reduced-motion: reduce)"); mq.addEventListener("change", (e) => (heard = e.matches));
  ok(p.A.pref("a11yText", "2") === true && p.props["--tz"] === "1.25", "text size by tap");
  ok(p.A.pref("a11yColour", "deutan") && p.dataset.cb === "deutan", "colour by tap");
  ok(p.A.pref("a11yContrast", "true") && p.classes.has("a11y-hc"), "contrast by tap");
  ok(p.A.pref("a11yMotion", "on") && heard === true && mq.matches === true, "motion listeners told");
  ok(p.A.pref("a11yHand", "right") && p.classes.has("a11y-1h") && !p.classes.has("a11y-1h-left"), "right hand");
  ok(p.A.pref("zoomFar", "true") === false && p.A.pref("lang", "en") === false, "other settings are not ours");
  const saved = JSON.parse(p.store.rotn_prefs);
  ok(saved.lang === "pl" && saved.zoomFar === true, "other settings kept");
  ok(saved.a11yText === 2 && saved.a11yColour === "deutan" && saved.a11yContrast === true && saved.a11yMotion === "on" && saved.a11yHand === "right", "saved " + p.store.rotn_prefs);
  p.A.pref("a11yColour", "none"); ok(!p.dataset.cb, "colour off again");
}
// ---- canvas drawing goes through the colour map (map markers, fight bars), both fill and stroke and gradients
{
  const p = page({ a11yColour: "protan" });
  const g = new p.Ctx();
  g.fillStyle = "#d65a4a"; ok(g.fillStyle === p.A.PAL.protan.high, "danger pin remapped " + g.fillStyle);
  g.strokeStyle = "#C0392B"; ok(g.strokeStyle === p.A.PAL.protan.hp, "fight health bar remapped (any case)");
  g.fillStyle = "#123456"; ok(g.fillStyle === "#123456", "scenery colours untouched");
  g.fillStyle = "rgba(1,2,3,.5)"; ok(g.fillStyle === "rgba(1,2,3,.5)", "rgba untouched");
  const gr = new p.Grad(); gr.addColorStop(0, "#8e6b2b"); ok(gr.last === p.A.PAL.protan.foe, "gradient stops remapped");
  p.A.pref("a11yColour", "none"); g.fillStyle = "#d65a4a"; ok(g.fillStyle === "#d65a4a", "map off again");
  ok(p.A.col("hp", "#c4413a") === "#c4413a", "col() falls back with no mode");
}
for (const m of ["protan", "deutan", "tritan"]) for (const slot of ["hp", "mp", "sp", "ember", "low", "med", "high", "buff", "debuff", "foe", "raid", "ripe"]) ok(/^#[0-9a-f]{6}$/.test(page({}).A.PAL[m][slot]), `palette ${m}.${slot}`);
for (const slot of new Set(Object.values(page({}).A.CANVAS))) ok(page({}).A.PAL.protan[slot], "canvas slot exists " + slot);

// ---- the colours really stay apart for each kind of colour-blindness (simulated)
const MX = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lab = (h, m) => {
  const c0 = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
  const [r, g, b] = MX[m].map((row) => Math.max(0, Math.min(1, row[0] * c0[0] + row[1] * c0[1] + row[2] * c0[2])));
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
const minGap = (cols, m) => { let w = 1e9; for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) { const a = lab(cols[i], m), b = lab(cols[j], m); w = Math.min(w, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); } return w; };
{
  const A = page({}).A, html = fs.readFileSync(W + "index.html", "utf8");
  const OLD = { bars: ["#c4413a", "#3f7fd6", "#4fa35c"], rarity: ["#ece8de", "#7fdc7f", "#6fb6ff", "#c48cff", "#ffcf5a", "#ff9a3c"], danger: ["#8fd08f", "#e2bb64", "#d65a4a"] };
  for (const m of ["protan", "deutan", "tritan"]) {
    const P = A.PAL[m];
    const bars = minGap([P.hp, P.mp, P.sp], m), danger = minGap([P.low, P.med, P.high], m), rar = minGap(Object.values(A.RARITY), m), fight = minGap([P.hp, P.foe], m), bd = minGap([P.buff, P.debuff], m);
    ok(bars >= 30, `${m}: health/magicka/stamina apart (${bars.toFixed(1)})`);
    ok(danger >= 25, `${m}: danger levels apart (${danger.toFixed(1)})`);
    ok(rar >= 18 && rar > minGap(OLD.rarity, m), `${m}: rarity apart and better than before (${rar.toFixed(1)} vs ${minGap(OLD.rarity, m).toFixed(1)})`);
    ok(fight >= 30 && bd >= 30, `${m}: you vs foe, buff vs debuff (${fight.toFixed(1)}, ${bd.toFixed(1)})`);
    ok(bars > minGap(OLD.bars, m) || m === "tritan" && bars > 40, `${m}: bars better than before`);
    // the CSS uses the same colours as the JS palette
    for (const [v, slot] of [["--sp", "sp"], ["--cb-low", "low"], ["--cb-med", "med"]]) ok(new RegExp(`html\\[data-cb=${m}\\][^{]*\\{[^}]*${v}:${P[slot]}`).test(html), `${m}: CSS ${v} matches palette`);
    console.log(`${m}: bars ${bars.toFixed(0)} (was ${minGap(OLD.bars, m).toFixed(0)}), rarity ${rar.toFixed(0)} (was ${minGap(OLD.rarity, m).toFixed(0)}), danger ${danger.toFixed(0)} (was ${minGap(OLD.danger, m).toFixed(0)})`);
  }
  for (const [k, v] of Object.entries(A.RARITY)) ok(html.includes(`--${k}:${v}`), "CSS rarity " + k);
}

// ---- settings section: plain words, every option present
{
  const A = page({ a11yColour: "protan" }).A;
  const seg = (k, opts, cur) => `<div class="seg">${opts.map(([v, l]) => `<button data-k="${k}" data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${l}</button>`).join("")}</div>`;
  const h = A.settingsHTML(seg);
  for (const s of ["Accessibility", "Text size", "Colour-blind help", "High-contrast text", "Reduce motion", "One-hand mode", "Biggest", "Left hand", "Right hand", "protanopia"]) ok(h.includes(s), "settings mention " + s);
  ok((h.match(/data-k="a11yText"/g) || []).length === 4 && (h.match(/data-k="a11yColour"/g) || []).length === 4, "4 text sizes, 4 colour modes");
  ok(/data-k="a11yColour" data-v="protan" class="on"/.test(h), "current mode marked");
}

// ---- hooks: loaded in <head> before the page paints; ui.js only has two tiny calls
{
  const html = fs.readFileSync(W + "index.html", "utf8"), ui = fs.readFileSync(W + "ui.js", "utf8");
  const at = html.indexOf('<script src="access.js"></script>');
  ok(at > 0 && at < html.indexOf("</head>") && at < html.indexOf('<script src="data.js">'), "access.js in <head>, before every game script");
  ok(html.indexOf("[access]") > html.lastIndexOf("@font-face") && html.indexOf("[access]") < html.indexOf("</head>"), "CSS in the second style block");
  ok(/ACCESS\.settingsHTML\(seg\)/.test(ui) && /ACCESS\.pref\(k, b\.dataset\.v\)/.test(ui), "settings hooks in ui.js");
  ok((ui.match(/ACCESS\./g) || []).length === 2, "ui.js stays a tiny hook");
}
console.log("test_access: all good");
