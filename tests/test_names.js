// names.js: one table for the names of towns, holds, regions, factions, races, gods, foes and items.
// Every id resolves in English and Polish, ids stay ids (saves keep them), a reskin changes only what's shown,
// quest text templates fill, and new code doesn't add hardcoded place names in UI text (baseline must not grow).
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = process.env.W || path.join(__dirname, "../game/");
const src = (f) => fs.readFileSync(path.join(W, f), "utf8");
let fail = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fail++; console.log("FAIL", m); } };

const html = src("index.html");
const scripts = [...html.matchAll(/<script src="([^"]+\.js)"/g)].map((m) => m[1]);
ok(scripts.includes("names.js"), "names.js in index.html");
ok(scripts.indexOf("names.js") > scripts.indexOf("solworld.js") && scripts.indexOf("names.js") < scripts.indexOf("i18n.js"), "names.js loads after world data and before i18n.js");
ok(scripts.indexOf("names.js") < scripts.indexOf("map.js") && scripts.indexOf("names.js") < scripts.indexOf("ui.js") && scripts.indexOf("names.js") < scripts.indexOf("quests.js"), "names.js loads before its users");

const i18nOrder = scripts.filter((f) => /^i18n/.test(f));
function load(lang, patch) {
  const c = { console, Math, Date, JSON, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RegExp, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, performance: { now: () => 0 },
    navigator: { language: lang === "pl" ? "pl-PL" : "en-GB" }, localStorage: { getItem: () => JSON.stringify({ lang }), setItem() {} } };
  vm.createContext(c);
  const pre = ["data.js", "world.js", "terrain.js", "solworld.js"].filter((f) => fs.existsSync(path.join(W, f)));
  for (const f of pre) vm.runInContext(src(f).replace(/^const (\w+) =/m, "var $1 ="), c);
  let n = src("names.js");
  if (patch) n = patch(n);
  vm.runInContext(n, c);
  vm.runInContext(i18nOrder.map(src).join("\n;") + "\n;globalThis.I18N = I18N;", c);
  for (const f of ["formulas.js", "quests.js"]) try { vm.runInContext(src(f).replace(/^const (\w+) =/m, "var $1 ="), c); } catch (e) { /* quests needs more of the game; checked below by text */ }
  c.NAMES.apply();
  return c;
}
const en = load("en"), pl = load("pl"), N = en.NAMES, NP = pl.NAMES;

// every id resolves in both languages, to a non-empty name
let total = 0;
for (const t of N.TYPES) for (const id of N.ids(t)) {
  total++;
  const e1 = N.get(id, { type: t, lang: "en" }), p1 = N.get(id, { type: t, lang: "pl" });
  ok(typeof e1 === "string" && e1.length > 0, `en ${t}:${id} → ${e1}`);
  ok(typeof p1 === "string" && p1.length > 0, `pl ${t}:${id} → ${p1}`);
}
ok(total > 300, "registry is filled from the game data: " + total);
for (const t of ["town", "hold", "region", "faction", "race", "god", "foe", "item"]) ok(N.ids(t).length > 0, "has entries of type " + t);

// nothing visible changes: places, holds, regions show their id; items, races show the game's own name
for (const id of Object.keys(en.WORLD.places)) { ok(N.place(id) === id, "place shows its id: " + id); ok(NP.local(id, { type: N.entry(id, "town") ? "town" : "place" }) === id, "place keeps its name in Polish: " + id); }
for (const id of Object.keys(en.WORLD.holds)) ok(N.hold(id) === id, "hold shows its id: " + id);
for (const [id, it] of Object.entries(en.D.ITEMS)) if (!id.startsWith("ench|")) ok(N.item(id) === it.name, "item name unchanged: " + id);
for (const [id, r] of Object.entries(en.D.RACES)) ok(N.race(id) === r.name, "race name unchanged: " + id);
// Polish comes from the i18n tables (one source of truth)
ok(NP.get("The Pale", { type: "hold", lang: "pl" }) === pl.I18N.tr("The Pale"), "Polish hold name is the translator's: " + NP.get("The Pale", { type: "hold", lang: "pl" }));
ok(NP.get("Sea of Ghosts", { type: "region", lang: "pl" }) === "Morze Duchów", "Polish region from i18n");
ok(NP.get("Windhelm", { type: "town", lang: "pl", case: "gen" }) === "Windhelmu", "Polish genitive");
ok(NP.get("Windhelm", { type: "town", lang: "pl", case: "loc" }) === "Windhelm", "missing case falls back to the name");
const someFoe = Object.keys(pl.I18N_FOES ? pl.I18N_FOES.NAMES : {})[0];
if (someFoe) ok(NP.foe(someFoe, { lang: "pl" }) === pl.I18N.tr(someFoe), "Polish foe name from i18n_foes: " + someFoe);
// unknown ids fall back to the id (no crash), type prefix stripped
ok(N.get("No Such Place") === "No Such Place" && N.get("town:Nowhere") === "Nowhere", "unknown id falls back");
ok(N.get("town:Whiterun") === "Whiterun" && N.get("hold:Whiterun") === "Whiterun", "type prefix works");

// templates
ok(N.fill("Go to {town:Whiterun}, then {place:Bleak Falls Barrow} in {hold:The Pale}.") === "Go to Whiterun, then Bleak Falls Barrow in The Pale.", "fill: " + N.fill("Go to {town:Whiterun}, then {place:Bleak Falls Barrow} in {hold:The Pale}."));
ok(N.fill("no braces") === "no braces" && N.fill(null) === null, "fill leaves plain text");
const q = src("quests.js");
ok(/\{town:Whiterun\}/.test(q) && /fillName\(st\.text\)/.test(q), "quests.js uses templates and fills them");
if (en.QUESTS || en.Q) { /* filled at load when quests.js could run */ }

// a reskin: change the shown name, the id (and saves) stay
const rs = load("en", (s) => s.replace('Whiterun: { en: "Whiterun" }, Windhelm', 'Whiterun: { en: "Brightmeadow" }, Windhelm')
  .replace("const OVERRIDE = { town: {}, place: {}, hold: {}, item: {}, foe: {}, npc: {} };", 'const OVERRIDE = { town: {}, place: {}, hold: {}, item: { iron_sword: { en: "Iron Blade", pl: { name: "Żelazne ostrze" } } }, foe: {}, npc: {} };'));
const R = rs.NAMES;
ok(R.place("Whiterun") === "Brightmeadow" && R.fill("Go to {town:Whiterun}.") === "Go to Brightmeadow.", "reskinned town shows its new name");
ok(R.hold("Whiterun") === "Whiterun", "the hold of the same id is a separate entry");
ok("Whiterun" in rs.WORLD.places && !("Brightmeadow" in rs.WORLD.places), "the world still keys the town by its id");
if (rs.D.ITEMS.iron_sword) {
  ok(rs.D.ITEMS.iron_sword.name === "Iron Blade" && R.item("iron_sword") === "Iron Blade", "item override copied onto D.ITEMS");
  ok(R.get("iron_sword", { type: "item", lang: "pl" }) === "Żelazne ostrze", "item override's Polish");
  ok(rs.I18N.tr("Iron Blade") === "Żelazne ostrze", "override's Polish reaches the screen translator");
}
// a save round-trips by id
const save = JSON.parse(JSON.stringify({ location: "Whiterun", discovered: ["Whiterun", "Riverwood"], inv: [{ item: "iron_sword", qty: 1 }] }));
ok(save.location === "Whiterun" && R.place(save.location) === "Brightmeadow" && rs.WORLD.places[save.location], "save keeps the id; it shows the new name");
ok(save.inv[0].item === "iron_sword", "inventory keeps item ids");

// routed code paths keep ids in data and keys, the shown name only in text
const routed = { "map.js": ["PN(", "HN(", "RN("], "locscreen.js": ["PN(", "HN("], "areaui.js": ["PN("], "ui.js": ["NM.place(", "NM.item(", "NM.foe("], "tbfight.js": ["NAMES.foe("] };
for (const [f, calls] of Object.entries(routed)) {
  const s = src(f);
  for (const c of calls) ok(s.includes(c), `${f} uses ${c}`);
  ok(!/data-[\w-]+="\$\{[^}]*(?:PN|HN|RN|NM\.\w+|NAMES\.\w+)\(/.test(s), `${f}: no shown name in a data-* attribute`);
  ok(!/\[(?:PN|HN|NM\.\w+|NAMES\.\w+)\([^\]]*\)\]\s*=/.test(s), `${f}: no shown name used as an object key`);
  ok(!/\.(?:location|dest|go|talk|clear)\s*=\s*(?:PN|HN|NM\.\w+|NAMES\.\w+)\(/.test(s), `${f}: no shown name stored as a place id`);
}

// baseline scan: string literals in UI code that mention a town or hold by name in a sentence (not a bare id)
const BASELINE = 263;    // count when names.js landed; route new text through {town:…} / NAMES instead of raising this
const EXEMPT = /^(i18n.*|names|world|solworld|data|patchnotes|terrain|samever)\.js$/;
const words = [...new Set([...Object.keys(N.TABLES.TOWN), ...Object.keys(N.TABLES.HOLD)])].sort((a, b) => b.length - a.length);
const nameRe = new RegExp("\\b(?:" + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b");
let hits = 0; const per = {};
for (const f of fs.readdirSync(W).filter((f) => f.endsWith(".js") && !EXEMPT.test(f))) {
  const s = fs.readFileSync(path.join(W, f), "utf8");
  for (const m of s.matchAll(/"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    const lit = m[1] ?? m[2];
    if (!nameRe.test(lit)) continue;
    if (words.includes(lit)) continue;              // a bare id ("Whiterun") is data, not text
    if (!/\s/.test(lit.replace(nameRe, ""))) continue; // no other words around the name
    if (/\{(?:town|place|hold):/.test(lit) && !nameRe.test(lit.replace(/\{[a-z]+:[^{}]+\}/g, ""))) continue;   // already a template
    hits++; per[f] = (per[f] || 0) + 1;
  }
}
console.log("hardcoded place names in UI text:", hits, "(baseline " + BASELINE + ")");
ok(hits <= BASELINE, `hardcoded place names in UI text grew: ${hits} > ${BASELINE}. Top: ` + Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, n]) => f + " " + n).join(", "));

// forge levels: "+N" after the name, never a rarity word (rarity.js owns Common / Fine / Rare / Epic / Legendary)
ok(N.improved("Iron Sword", { tq: 2 }) === "Iron Sword +2", "improved: Iron Sword +2");
ok(N.improved("Iron Sword", { tq: 0 }) === "Iron Sword" && N.improved("Iron Sword", null) === "Iron Sword" && N.improved("Iron Sword", {}) === "Iron Sword", "improved: plain gear keeps its name");
{
  const towns = src("towns.js"), q = /const QUALITY = (\[[^\]]*\]);/.exec(towns);
  const QL = q ? JSON.parse(q[1]) : [];
  ok(QL.length === 7 && QL.slice(1).every((x, i) => x === "+" + (i + 1)), "TOWNS.QUALITY is +1..+6 " + JSON.stringify(QL));
  const RW = /\b(Fine|Superior|Exquisite|Flawless|Epic|Legendary)\b/;
  ok(!QL.some((x) => RW.test(x)), "no rarity / old quality word in forge levels");
  // nothing builds "<level word> <name>" any more: every shown name goes through NAMES.improved
  const stale = fs.readdirSync(W).filter((f) => /\.js$/.test(f) && !/^i18n|patchnotes/.test(f)).filter((f) => /QUALITY\[[^\]]*tq\] \+ " "/.test(src(f)));
  ok(!stale.length, "forge level still put in front of a name in: " + stale.join(", "));
}

console.log(fail ? `${fail} FAILED of ${checks}` : `ok: ${checks} checks`);
process.exit(fail ? 1 : 0);
