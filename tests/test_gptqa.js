// GPT round 1, brief 6: dungeon rooms use indoor lines (no road text), weapon tooltips don't repeat the skill,
// and the turn order marks a foe's 2nd/3rd move as the same foe. Polish exists for every new line.
// W=/path/to/game/ node test_gptqa.js — prints "gptqa ok".
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const src = (f) => fs.readFileSync(path.join(W, f), "utf8");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };

// ---- the game, with dungeons and tooltips
const c = vm.createContext({ console, Math, Date, JSON, Object, Array, Set, Map, Proxy, Number, String, structuredClone, process: { env: process.env } });
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dunlines.js", "dungeons.js", "skillinfo.js", "tooltip.js"])
  if (fs.existsSync(W + f)) vm.runInContext(src(f).replace(/^const (\w+) =/m, "var $1 ="), c);
const { G, D, DUNGEONS, DUNLINES, TIP } = c;

// 1) dungeon rooms: never the road text, in every theme, for fight, tough fight and boss rooms
const road = /\broad\b|roadside|tundra grass|behind the rocks|traveller|your papers/i;
const roadTexts = new Set(D.ENCOUNTERS.map((e) => e.text));
for (const l of DUNLINES.all()) ok(!road.test(l), "an indoor line still talks about the road: " + l);
const s = G.newSave("dq", "Delver", "nord"); s._test = true; s.level = 14;
let rooms = 0;
for (const theme of Object.keys(DUNGEONS.THEMES)) {
  for (let i = 0; i < 60; i++) {
    s.dungeon = { place: "Test Hole", theme, tier: 1 + (i % 3), rows: [], row: 0, col: 0, room: null, found: [], gold: 0, t: 0 };
    for (const type of ["fight", "elite", "boss"]) {
      let r; try { r = DUNGEONS.buildRoom ? DUNGEONS.buildRoom(s, type) : null; } catch (e) { ok(false, `${theme} ${type} threw ${e.message}`); continue; }
      if (!r) continue;
      rooms++;
      ok(r.text && !roadTexts.has(r.text) && !road.test(r.text), `${theme} ${type}: road text in a dungeon: ${r.text}`);
    }
  }
}
ok(rooms > 0 || !DUNGEONS.buildRoom, "rooms were built");
if (!DUNGEONS.buildRoom) {
  // buildRoom isn't exported: check the keys instead
  for (const [theme, T] of Object.entries(DUNGEONS.THEMES))
    for (const [k] of T.foes) { const e = DUNGEONS.ENEMY?.[k]; if (e && roadTexts.has(e.text)) ok(!!DUNLINES.line(k, theme), `${theme}: ${k} has no indoor line`); }
}
ok(DUNLINES.line("bandit", "mine") !== DUNLINES.line("bandit", "thalmor"), "themes get their own lines");
ok(DUNLINES.line("skeever", "cave") === null, "dungeon-only foes keep their own text");
ok(/dungeons\.js/.test(src("index.html")) && src("index.html").indexOf("dunlines.js") < src("index.html").indexOf("\"dungeons.js\""), "dunlines.js loads before dungeons.js");

// 2) weapon tooltips: the skill once
{ const one = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "weapon" && D.ITEMS[k].skill === "One-Handed");
  const two = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "weapon" && D.ITEMS[k].skill === "Two-Handed");
  const bow = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "weapon" && D.ITEMS[k].skill === "Archery");
  TIP.state = () => s;
  const txt = (id) => String(TIP.html("item:" + id) || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  ok(/One-handed weapon/.test(txt(one)) && !/One-handed weapon · One-Handed/i.test(txt(one)), "one-handed: no repeat " + txt(one).slice(0, 80));
  ok(/Two-handed weapon/.test(txt(two)) && !/· Two-Handed/i.test(txt(two)), "two-handed: no repeat " + txt(two).slice(0, 80));
  ok(/bow · Archery/.test(txt(bow)), "a bow still names Archery " + txt(bow).slice(0, 80)); }

// 3) turn order: one chip per move, the later ones marked as the same foe's 2nd/3rd move
{ const tb = src("tbfight.js");
  ok(/const moveNo = /.test(tb) && /tbini[^`]*again/.test(tb) && /class="tbag"/.test(tb), "the turn order marks a foe's later moves");
  ok(/acts again: its \$\{ORD\(mv\)\} move this round\./.test(tb), "and says so in the tip");
  ok(/\.tbag/.test(src("combat2.js")), "the portrait ribbon keeps the mark");
  ok(/\.tbini\.again/.test(src("index.html")), "CSS for the mark"); }

// 4) Polish for every new line, through the real translator
{ const ctx = vm.createContext({ console, navigator: { language: "pl-PL" }, localStorage: { getItem: () => JSON.stringify({ lang: "pl" }), setItem() {} } });
  let I18N = null;
  try { vm.runInContext(src("i18n_gptqa.js") + "\n" + src("i18n_story.js") + "\n" + src("i18n.js") + "\n;globalThis.I18N = I18N;", ctx); I18N = ctx.I18N; } catch (e) { console.log("(i18n.js not loadable in node: " + e.message + ")"); }
  if (I18N) {
    for (const l of DUNLINES.all()) { const p = I18N.tr(l); ok(p && p !== l, "no Polish for " + l); }
    ok(I18N.tr("One-handed weapon") === "Broń jednoręczna", "weapon kind in Polish");
    ok(I18N.tr("Two-handed bow · Archery")?.startsWith("Łuk"), "bow kind in Polish: " + I18N.tr("Two-handed bow · Archery"));
    ok(/rusza się znowu: to jego 2\. ruch/.test(I18N.tr("Bandit outlaw acts again: its 2nd move this round.") || ""), "the tip in Polish: " + I18N.tr("Bandit outlaw acts again: its 2nd move this round."));
    const PN = vm.runInContext(src("patchnotes.js").replace(/^const PATCHNOTES =/m, "var PATCHNOTES =") + ";PATCHNOTES", vm.createContext({}));
    const top = (PN.LIST || PN.list || [])[0];
    if (top && top.id === "b240-gptqa") { ok(I18N.tr(top.title) !== top.title, "patch note title in Polish"); for (const it of top.items) ok(I18N.tr(it) && I18N.tr(it) !== it, "patch note line in Polish: " + it.slice(0, 50)); }
  } }

console.log(`rooms built: ${rooms}`);
console.log(fails ? `gptqa: ${fails} failed` : "gptqa ok");
process.exit(fails ? 1 : 0);
