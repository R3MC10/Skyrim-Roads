const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Every foe you can meet has a Polish name (qa-core batch 4).
   1. Every foe name written in the game's code (E("…", …), foe("…", …), { name, health, damage } and { name, danger, tags }
      objects, ["Name", hp, dmg, [tags]] rows) translates in Polish mode. People with their own names count when
      i18n_foes.js lists them on purpose.
   2. Foes met by rolling road events, every dungeon foe, and the names the game builds (escorts, hold guards,
      dragon raids, deeper-level bosses) translate, and the fight log reads in Polish with them.
   W=/path/to/game/ node test_foenames.js — prints "foenames ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
let n = 0; const ok = (c, m) => { n++; if (!c) throw new Error("FAIL " + m); };
const html = fs.readFileSync(W + "index.html", "utf8");
ok(html.indexOf('src="i18n_foes.js"') > 0 && html.indexOf('src="i18n_foes.js"') < html.indexOf('src="i18n.js"'), "i18n_foes.js loads before i18n.js");

// the whole game, in Polish
const files = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
const g = { console: { log() {}, warn() {}, error() {} }, Math, Date, JSON, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RegExp, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Uint8ClampedArray,
  setTimeout() {}, clearTimeout() {}, setInterval() {}, navigator: { languages: ["pl-PL"], language: "pl-PL", userAgent: "node" },
  localStorage: { getItem: () => JSON.stringify({ lang: "pl" }), setItem() {}, removeItem() {} }, location: { search: "", hostname: "localhost", href: "" },
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
g.window = g; g.self = g; vm.createContext(g);
for (const f of files) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/gm, "var $1 ="), g, { filename: f }); } catch (e) { /* screen-only files need a browser */ } }
const P = (s) => vm.runInContext(`I18N.tr(${JSON.stringify(s)})`, g);
const polish = (name) => P(name) != null;   // a name that is the same in Polish (Draugr, Mercer Frey) is listed on purpose, so it translates to itself

// 1. names in the code
const names = new Map();
const add = (nm, f) => { if (nm && /[a-z]/i.test(nm) && !names.has(nm)) names.set(nm, f); };
const FOE_TAG = /\b"?tags"?:\s*\[\s*"(humanoid|beast|undead|daedra|animal|dwemer|bandit|dragon|vampire|giant|automaton|spirit)"/;
for (const f of fs.readdirSync(W).filter((x) => x.endsWith(".js") && !/^i18n/.test(x))) {
  const s = fs.readFileSync(W + f, "utf8");
  for (const m of s.matchAll(/\b(?:E|DE)\("([^"]+)",\s*(?:\d|"(?:low|medium|high|deadly|boss)")/g)) add(m[1], f);
  for (const m of s.matchAll(/\bfoe\("([^"]+)",\s*\d/g)) add(m[1], f);
  for (const m of s.matchAll(/\["([A-Z][^"]+)",\s*\d+,\s*\d+,\s*\[\s*"/g)) add(m[1], f);
  for (const m of s.matchAll(/\{[^{}]*\bname: "([^"]+)"[^{}]*\bdanger: "/g)) add(m[1], f);
  for (const m of s.matchAll(/\{[^{}]*\b"?name"?:\s*"([^"]+)"[^{}]*\}/g))
    if ((/\b"?(health|hp)"?:\s/.test(m[0]) && /\b"?damage"?:\s/.test(m[0])) || FOE_TAG.test(m[0])) add(m[1], f);
}
ok(names.size >= 130, "foe names found in the code: " + names.size);
const missing = [...names].filter(([nm]) => !polish(nm)).map(([nm, f]) => `${nm} (${f})`);
ok(!missing.length, "foes without a Polish name: " + missing.join(", "));

// 2. foes met in play
const dun = vm.runInContext("Object.values(DUNGEONS.ENEMY).map((e) => e.name)", g);
ok(dun.length >= 20, "dungeon foes load: " + dun.length);
ok(dun.every(polish), "dungeon foes without a Polish name: " + dun.filter((x) => !polish(x)).join(", "));
const met = vm.runInContext(`(() => { const out = new Set(); for (let i = 0; i < 2500; i++) { const s = G.newSave("f" + i, "F", "nord"); s.level = 1 + i % 40;
  const e = ROAD_EVENTS.roll(s); if (!e) continue; if (e.enemy?.name) out.add(e.enemy.name);
  for (const [key] of (ROAD_EVENTS.choices(e, s) || [])) { try { const r = ROAD_EVENTS.choose(JSON.parse(JSON.stringify(s)), e, key) || {}; for (const x of [r.foe, r.enemy, r.fight]) if (x?.name) out.add(x.name); } catch (err) { /* fine */ } } }
  for (const e of D.ENCOUNTERS || []) out.add(e.name);
  return [...out]; })()`, g);
ok(met.length >= 30, "foes met on the road: " + met.length);
ok(met.every(polish), "road foes without a Polish name: " + met.filter((x) => !polish(x)).join(", "));
// names built on the fly
for (const [en, re] of [["Imperial escort", /^Cesarska eskorta$/], ["Stormcloak escort", /Gromowładnych/], ["Whiterun guard", /^Strażnik z Whiterun$/], ["The Rift guard", /^Strażnik z The Rift$/],
  ["Champion of Whiterun", /^Czempion/], ["Vokun, dragon priest", /^Vokun, smoczy kapłan$/], ["Blood Dragon over Riften", / nad Riften$/], ["Dragon over Whiterun", / nad Whiterun$/],
  ["Hagraven guardian", /^Wiedźmokruczyca, strażnik schodów$/], ["Dragon priest, warden of the vault", /^Smoczy kapłan, strażnik skarbca$/]])
  ok(re.test(P(en) || ""), `built foe name in Polish: ${en} → ${P(en)}`);
for (const L of [1, 3, 4, 5]) for (const base of dun) {
  const nm = L === 1 ? `${base} guardian` : L === 3 ? `${base}, warden of the vault` : L === 4 ? `Cursed ${base.toLowerCase()}` : `Legendary ${base.toLowerCase()}`;
  ok(P(nm) != null, "Polish for a deeper-level boss: " + nm);
}
// the fight log with them
for (const [en, re] of [["Imperial escort hits 12", /^Cesarska eskorta trafia: 12$/], ["Flame atronach misses", /^Ognisty atronach: pudło$/], ["Bandit chief is staggered", /^Herszt bandytów traci równowagę$/]])
  ok(re.test(P(en) || ""), `fight log in Polish: ${en} → ${P(en)}`);
// dungeon screens, fight log endings and road lines from the batch-4 sweep
const ICN = " ";
for (const [en, re] of [["The draugr falls.", /^Draugr pada\.$/], ["Room 1 of 6", /^Komnata 1 z 6$/], ["Battle Cry: the Bandit chief flees in terror", /Herszt bandytów ucieka/],
  [ICN + "you burn for 4", /płoniesz: 4$/], [ICN + "the draugr burns for 4", /Draugr płonie: 4$/], ["Draugr hits 14 (power attack) (critical)", /\(potężny atak\) \(krytyczne\)$/],
  ["He wolfs it down, then trots off and comes back with a muddy purse: 12 gold. Good dog.", /^Pożera .*12 złota\. Dobry pies\.$/],
  ["Beside a cold campfire lies a waterlogged book: \"The Black Arrow\".", /^Obok zimnego ogniska .*„The Black Arrow”\.$/], ["\"No.\" It lunges.", /^„Nie\.” Rzuca się/]])
  ok(re.test(P(en) || ""), `dungeon / road line in Polish: ${en} → ${P(en)}`);
const lockLines = [0, 1, 2, 3, 4].map((t) => vm.runInContext(`lockLooks(${t})`, g));
ok(lockLines.every((x) => typeof x === "string" && !/looks (novice|apprentice|adept|expert|master)\b/.test(x)), "lock lines read naturally: " + lockLines.join(" | "));
ok(lockLines.every((x) => P(x) != null && P(x) !== x), "lock lines have Polish: " + lockLines.map(P).join(" | "));
console.log(`foenames ok (${n} checks)`);
