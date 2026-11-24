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
  ok(JSON.stringify(p.A.settings()) === JSON.stringify({ a11yText: 0, a11yColour: "none", a11yContrast: false, a11yMotion: "auto", a11yHand: "off", a11yTiming: false }), "defaults " + JSON.stringify(p.A.settings()));
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
  for (const s of ["Accessibility", "Text size", "Colour-blind help", "High-contrast text", "Reduce motion", "One-hand mode", "Easy timing", "Small", "Large", "Huge", "Left hand", "Right hand", "protanopia"]) ok(h.includes(s), "settings mention " + s);
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

// ---- text size: Small / Normal / Large / Huge; old saves keep working
{
  const p = page({ a11yText: -1 });
  ok(p.props["--tz"] === "0.88" && p.classes.has("a11y-zoom") && p.A.zoom() === 0.88, "small text " + p.props["--tz"]);
  ok(page({ a11yText: 1 }).A.settings().a11yText === 2, "old Big step shows as Large");
  ok(page({ a11yText: -7 }).A.settings().a11yText === -1, "too small clamps to Small");
  p.A.pref("a11yText", "1"); ok(JSON.parse(p.store.rotn_prefs).a11yText === 2, "Big saved as Large");
  p.A.pref("a11yText", "3"); ok(p.props["--tz"] === "1.38", "huge");
  ok(JSON.stringify(p.A.TEXT_OPTS.map((o) => o[1])) === JSON.stringify(["Small", "Normal", "Large", "Huge"]), "four plain names");
}
// ---- Easy timing: a saved toggle, a page class, and the two numbers mini-games ask for
{
  const p = page({});
  ok(p.A.timingEase() === 1 && p.A.zoneEase() === 1 && !p.classes.has("a11y-easy"), "timing normal by default");
  ok(p.A.pref("a11yTiming", "true") === true && p.A.timingEase() === 1.5 && p.A.zoneEase() === 1.4 && p.classes.has("a11y-easy"), "easy timing on");
  ok(JSON.parse(p.store.rotn_prefs).a11yTiming === true, "easy timing saved");
  ok(page({ a11yTiming: true }).A.timingEase() === 1.5, "easy timing loads");
  ok(page({ a11yTiming: "yes" }).A.timingEase() === 1, "bad value cleaned");
  const c = { console, Math, JSON, Object, Array, Set, Map, Number, String, localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(c); vm.runInContext(fs.readFileSync(W + "access.js", "utf8"), c);
  ok(vm.runInContext("typeof A11Y !== 'undefined' && A11Y === ACCESS && A11Y.timingEase() === 1", c), "A11Y is a global alias (works without a page too)");
}
// ---- the mini-games really use it: mining band wider + needle slower, dungeon games longer + wider, fishing zone wider
{
  const ctx = (ease) => {
    const c = { console, Math, JSON, Object, Array, Set, Map, Number, String, performance: { now: () => 0 }, A11Y: { timingEase: () => (ease ? 1.5 : 1), zoneEase: () => (ease ? 1.4 : 1) } };
    vm.createContext(c);
    for (const f of ["minegame.js", "dungeongames.js"]) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
    return c;
  };
  const off = ctx(false), on = ctx(true), r = () => 0.5;
  const z0 = off.MINEGAME.zone(30, r), z1 = on.MINEGAME.zone(30, r);
  ok(z1.good > z0.good * 1.35 && z1.good <= 0.56, `mining band wider (${z0.good.toFixed(3)} → ${z1.good.toFixed(3)})`);
  ok(on.MINEGAME.zone(100, r).good <= 0.56, "mining band capped");
  const DG0 = off.DGAMES, DG1 = on.DGAMES;
  ok(DG0 && DG1, "dungeon games load");
  for (const kind of DG0.KINDS) {
    const a = DG0.replay(kind, 42, { d: 0.5 }, []), b = DG1.replay(kind, 42, { d: 0.5, tm: 1.5 }, []);
    ok(b.endTick >= a.endTick, `${kind}: no less time with Easy timing (${a.endTick} vs ${b.endTick})`);
  }
  ok(DG1.replay("smash", 1, { d: 0.5, tm: 1.5 }, []).tick > DG0.replay("smash", 1, { d: 0.5 }, []).tick, "smash: idle timeout is later");
  ok(DG1.make("smash", 3, { d: 0.5, tm: 1.5 }).w > DG0.make("smash", 3, { d: 0.5 }).w * 1.35, "smash: wider weak spot");
  ok(DG0.make("smash", 3, { d: 0.5, tm: 9 }).tm === 2, "tm clamped");
  ok(DG0.make("smash", 3, { d: 0.5 }).tm === 1, "no tm = normal");
}
{
  const src = fs.readFileSync(W + "cooking.js", "utf8"), ui = fs.readFileSync(W + "ui.js", "utf8"), imm = fs.readFileSync(W + "immerse.js", "utf8");
  ok(/A11Y\.zoneEase\(\)/.test(src) && /rare, zone/.test(src), "fishing zone widens with Easy timing");
  ok(/5000 \* \(typeof A11Y/.test(ui) && /A11Y\.timingEase\(\) : 1\);   \/\/ rarer fish/.test(ui), "fishing bite lasts longer and the needle slows");
  ok(/sweetWidth\(o\.chance, o\.picks, o\.unbreakable\) \* \(typeof A11Y/.test(imm), "lock sweet spot widens");
}
// ---- colour is never the only signal: shapes and patterns in the colour-blind CSS
{
  const html = fs.readFileSync(W + "index.html", "utf8");
  for (const sel of ["html[data-cb] .hb.mp .track i{background-image:repeating-linear-gradient", "html[data-cb] .hb.sp .track i{background-image:repeating-linear-gradient", "html[data-cb] .hb.hp small.num::before", "html[data-cb] .danger-low::before", "html[data-cb] .danger-medium::before", "html[data-cb] .danger-high::before", ".buff:not(.ccsw)::before", ".debuff:not(.ccsw)::before"])
    ok(html.includes(sel), "symbol/pattern rule: " + sel);
  const at = html.indexOf("colour is never the only signal");
  ok(at > html.lastIndexOf("@font-face") && at < html.indexOf("</head>"), "in the second style block");
}
// ---- Polish for every word in the section
{
  const pl = fs.readFileSync(W + "i18n.js", "utf8") + fs.readFileSync(W + "i18n_followertab.js", "utf8");
  const A = page({}).A, seg = (k, opts) => opts.map(([, l]) => `<b>${l}</b>`).join("");
  for (const m of ["none", "protan", "deutan", "tritan"]) {
    const h = page({ a11yColour: m }).A.settingsHTML(seg);
    const words = [...h.matchAll(/<(?:span|b|small class="a11y-hint"|h3)>([^<]+)</g)].map((x) => x[1]);
    for (const w of words) ok(pl.includes(`"${w}":`) || pl.includes(` ${w}:`) || pl.includes(`{${w}:`), `Polish for "${w}"`);
  }
  ok(A, "page");
}
console.log("test_access: all good");
