const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Core-loop QA sweep (qa-core): regressions for bugs found by playing the real game.
   1. The phone's back button: the barber/mirror screen, mini-games and the rune table close first, and inside a shop
      back steps to the town's board before the compass (ui.js __ui.back).
   2. The guided first trip and the first-time tips are Polish in Polish mode, and step 3 names the Area tab.
   3. The "set off" and "arrived" toasts have Polish patterns.
   4. Every perk description has Polish with the same numbers, rank text says "Następna ranga", hireling lines,
      title/settings lines and patch-note dates are Polish, and the level-up tip names the Hero tab.
   5. Crafting, riding and road-event messages are Polish, the ride button re-syncs on refresh, and only painted icons are requested.
   W=/path/to/game/ node test_qacore.js — prints "qacore ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
let n = 0; const ok = (c, m) => { n++; if (!c) throw new Error("FAIL " + m); };
const ui = fs.readFileSync(W + "ui.js", "utf8"), html = fs.readFileSync(W + "index.html", "utf8");

// 1. back button order
const back = ui.slice(ui.indexOf("window.__ui = {"), ui.indexOf("save() { if (S) Store.save(S); }"));
ok(/CHARGEN\.close\(false\)/.test(back), "back closes the barber / mirror");
ok(back.indexOf("backOutOfGame()") > 0 && back.indexOf("backOutOfGame()") < back.indexOf("TABMENU.back"), "back leaves a mini-game before the compass");
ok(back.indexOf('$("#side .au-back")') > 0 && back.indexOf('$("#side .au-back")') < back.indexOf("TABMENU.back"), "back steps from a shop to the town board before the compass");
for (const id of ["fishgame", "huntgame", "minegame", "lockpick", "pickgame", "smithgame", "craftgame", "xgame"]) ok(ui.includes(`"#${id} `), "a way out of #" + id);
// each exit button really exists in its mini-game
const src = (f) => fs.readFileSync(W + f, "utf8");
for (const [f, id] of [["fishing.js", "fhdone"], ["huntgame.js", "hgdone"], ["minegame.js", "mgdone"], ["immerse.js", "lpleave"], ["pickgame.js", "ppleave"], ["smithgame.js", "sgquick"], ["craftgames.js", "cgquick"]])
  ok(src(f).includes(`id="${id}"`), `${f} still has #${id}`);

// 2 + 3. Polish
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String, RegExp, navigator: { languages: ["pl-PL"], language: "pl-PL" },
  localStorage: { getItem: () => JSON.stringify({ lang: "pl" }), setItem() {}, removeItem() {} } };
vm.createContext(c);
ok(html.indexOf('src="i18n_qacore.js"') > 0 && html.indexOf('src="i18n_qacore.js"') < html.indexOf('src="i18n.js"'), "i18n_qacore.js loads before i18n.js");
for (const f of ["i18n_qacore.js", "i18n.js"]) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext("I18N.add(I18N_QACORE.tpl)", c);
const tutStart = ui.indexOf("const TUT = ["), tut = ui.slice(tutStart, ui.indexOf("];", tutStart));
const lts = [...tut.matchAll(/LT\("((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
ok(lts.length >= 8, "tutorial lines go through LT: " + lts.length);
for (const en of lts) ok(c.I18N_QACORE.tpl[en], "Polish for tutorial line: " + en.slice(0, 50));
ok(!/the <b>Town<\/b> tab/.test(tut) && tut.includes("<b>Area</b>"), "step 3 names the Area tab");
ok(vm.runInContext(`I18N.t("Welcome to Skyrim, {name}. Everything happens in real time. Tap <b>Whiterun</b> on the map and press <b>Travel</b>, or press <b>Go</b> next to it in the list below.", { name: "Remi" })`, c).startsWith("Witaj w Skyrim, Remi."), "I18N.t fills the name");
const ob = src("onboard.js"), tipsAt = ob.indexOf("const TIPS = ["), tips = ob.slice(tipsAt, ob.indexOf("];", tipsAt));
for (const m of tips.matchAll(/=> "((?:[^"\\]|\\.)*)"/g)) if (!m[1].includes("\\u")) ok(c.I18N_QACORE.tpl[m[1]], "Polish for tip: " + m[1].slice(0, 50));
ok(/I18N\.t\(tip\.text\)/.test(ob), "onboard tips go through I18N.t");
ok(vm.runInContext(`I18N.tr("You set off for Whiterun. About 3 min.")`, c) === "Wyruszasz do Whiterun. Około 3 min.", "set-off toast in Polish");
ok(vm.runInContext(`I18N.tr("Arrived at Whiterun. Shops are in the Area tab.")`, c) === "Docierasz do: Whiterun. Sklepy są w zakładce Okolica.", "arrived toast in Polish");
ok(vm.runInContext(`I18N.tr("Got it")`, c) === "Rozumiem", "Got it in Polish");

// 4. batch 2: perk descriptions, hireling lines, title screen, patch-note dates, the level-up tip
ok(html.indexOf('src="i18n_perkdesc.js"') > 0 && html.indexOf('src="i18n_perkdesc.js"') < html.indexOf('src="perks.js"'), "i18n_perkdesc.js loads before perks.js");
vm.runInContext(fs.readFileSync(W + "i18n_perkdesc.js", "utf8"), c);
vm.runInContext(fs.readFileSync(W + "perks.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const nums = (s) => (String(s).match(/\d+(?:[.,]\d+)?/g) || []).map((x) => x.replace(",", ".")).sort().join(" ");
const strip = (d) => String(d).replace(/\s*\[[^\]]*\]\s*$/, "");
const perks = vm.runInContext("Object.values(PERKS.BY_ID)", c);
ok(perks.length >= 100, "perks load: " + perks.length);
for (const p of perks) {
  const pl = c.PERKDESC_PL[strip(p.desc)];
  ok(pl, "Polish description for perk " + p.id + ": " + strip(p.desc));
  ok(nums(pl) === nums(strip(p.desc)), `perk ${p.id} keeps its numbers: ${strip(p.desc)} / ${pl}`);
}
const arm = vm.runInContext(`PERKS.nowText({ perks: { armsman: 2 } }, "armsman")`, c);
ok(/40%/.test(arm) && /Następna ranga: 60%/.test(arm) && !/per rank|Next:/.test(arm), "rank text in Polish: " + arm);
for (const f of ["i18n_story.js", "i18n_qacore.js", "i18n.js"]) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);   // story lines hold the base hirelings, sentence by sentence
vm.runInContext("I18N.add(I18N_QACORE.tpl)", c);
const T = (s) => vm.runInContext(`I18N.tr(${JSON.stringify(s)})`, c);
ok(T("Build 242 · 25 Nov 2026") === "Wersja 242 · 25 lis 2026", "patch-note date in Polish: " + T("Build 242 · 25 Nov 2026"));
ok(T("needs One-Handed 40") === "wymaga: Broń jednoręczna 40" || /^wymaga: .+ 40$/.test(T("needs One-Handed 40")), "perk requirement in Polish: " + T("needs One-Handed 40"));
for (const en of ["A shared journey across Skyrim", "New Character", "Start over?", "Controls", "What's new", "Update now", "Keep my build"]) ok(T(en) && T(en) !== en, "Polish for title/settings line: " + en);
const tw = src("towns.js"), fAt = tw.indexOf("const FOLLOWERS = {"), fBlock = tw.slice(fAt, tw.indexOf("\n  };", fAt));
ok(fAt > 0, "towns.js still has FOLLOWERS");
const descs = [...fBlock.matchAll(/^\s+\w+: \[.*"((?:[^"\\]|\\.){25,})"\],?$/gm)].map((m) => m[1]);
ok(descs.length >= 7, "hireling lines found: " + descs.length);
for (const d of descs) ok(T(d) && T(d) !== d, "Polish for hireling line: " + d.slice(0, 50));
ok(ob.includes('"Open <b>Hero</b>') && ob.includes('["hero", "Open Hero"]') && !ob.includes("Open <b>Character</b>"), "the level-up tip names the Hero tab (tabs5)");
ok(/from the Hero tab/.test(src("dawnguard.js")) && !/the Character tab/.test(src("dawnguard.js")), "Dawnguard names the Hero tab (tabs5)");
// 5. batch 3: crafting, riding, road events and missing pictures
{
  const files = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const g = { console: { log() {}, warn() {}, error() {} }, Math, Date, JSON, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RegExp, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Uint8ClampedArray,
    setTimeout() {}, clearTimeout() {}, setInterval() {}, navigator: { languages: ["pl-PL"], language: "pl-PL", userAgent: "node" },
    localStorage: { getItem: () => JSON.stringify({ lang: "pl" }), setItem() {}, removeItem() {} }, location: { search: "", hostname: "localhost", href: "" },
    addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  g.window = g; g.self = g; vm.createContext(g);
  for (const f of files) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/gm, "var $1 ="), g, { filename: f }); } catch (e) { /* screen-only files need a browser */ } }
  const P = (s) => vm.runInContext(`I18N.tr(${JSON.stringify(s)})`, g);
  // crafting: every enchantment and every alchemy effect has Polish; brew / cook / temper / enchant messages are whole Polish
  const tpl = vm.runInContext(`[...Object.values(ENCH.WEAPON).map(v=>v[5]), ...Object.values(ENCH.ARMOR).map(v=>v[7])]`, g);
  ok(tpl.length >= 40, "enchantments load: " + tpl.length);
  for (const t of tpl) ok(P(t.replace(/\{m\}/g, "12")) != null, "Polish for enchantment: " + t);
  const fx = vm.runInContext(`[...new Set(Object.values(TOWNS.INGREDIENT_FX).flatMap(v=>v[1]))]`, g);
  for (const e of fx) ok(P(e) != null, "Polish for alchemy effect: " + e);
  for (const [en, re] of [["You brew a Potion of Restore Health: Restore Health 22. Worth 40 gold. Great work. +12% strength.", /^Warzysz: .+ Wartość: 40 złota\. Świetna robota\. \+12% mocy\.$/],
    ["The soul pours into the Iron Sword. You made Iron Sword of Fire: 12 fire damage on a hit, and it may set them burning. Enchanting 15 → 16", /^Dusza wlewa się w/],
    ["Sell Iron Sword ×2?", /^Sprzedać: /], ["You need an inn's cooking pot or a campfire.", /^Potrzebujesz kotła/]])
    ok(re.test(P(en) || ""), "crafting message in Polish: " + en + " → " + P(en));
  // riding: getting on / off / a downed horse
  for (const en of ["You get down and walk beside Biscuit. It still carries your things.", "Your horse isn't with you.", "Biscuit is downed and can't carry a rider yet. Sleep, wait a few hours, or have a stablehand tend them."])
    ok(P(en) && !/walk beside|carries your|isn't with|stablehand/.test(P(en)), "riding message in Polish: " + P(en));
  ok(/RIDING\.sync\(S\)/.test(ui.slice(ui.indexOf("function renderPanel("), ui.indexOf("function renderPanel(") + 600)), "the panel refresh re-syncs the ride button (shows right after buying a horse)");
  ok(/RIDING\.sync\(S\)/.test(ui.slice(ui.indexOf("function renderTrip("), ui.indexOf("function renderTrip(") + 300)), "the trip strip re-syncs the ride button");
  // road events: every choice label, every plain text and every outcome we can roll has Polish
  const I = " ";
  for (const en of Object.keys(vm.runInContext("I18N_EXTRA.QACORE_EVL", g))) { ok(P(en) && P(en) !== en, "Polish for choice: " + en); ok(P(I + en + " (40%)") === I + P(en).replace(/^Ukryj$/, "Ukryj się") + " (40%)" || /\(40%\)$/.test(P(I + en + " (40%)") || ""), "Polish for choice with icon and chance: " + en); }
  for (const en of ["Pray to Mara", "Pay 40 gold", I + "Buy (440 gold)", I + "Pick the lock (3 picks, 40%)", "You buy the Ebony Arrow.", "A Thalmor patrol", "A rich herb patch",
    "You walk together a while. At the crossroads, they insist you take 30 gold.", "In the ruins of a wayside shrine sits an iron-banded chest. The lock looks simple (Novice).",
    "A ship's hull lies broken on the rocks below the road. Half-buried in the shingle: a captain's strongbox with an iron lock.", "Tap an item for options. You're in town: you can sell here.",
    "You have no ingredients. Gather them on the road, in dungeons, or buy them at the general store and court wizard.", "12% there"])
    ok(P(en) && !/\b(gold|the|you|lock|there)\b/i.test(P(en)), "road / pack line in Polish: " + en + " → " + P(en));
  let rolled = 0;
  vm.runInContext(`var __seen = []; for (let i = 0; i < 1500; i++) { const s = G.newSave("q" + i, "Q", "nord"); s.level = 1 + i % 30; const e = ROAD_EVENTS.roll(s); if (!e) continue;
    for (const [key, label] of (ROAD_EVENTS.choices(e, s) || [])) { const s2 = JSON.parse(JSON.stringify(s)); const r = ROAD_EVENTS.choose(s2, e, key); __seen.push([e.id, e.title || "", label, r && r.text || ""]); } }`, g);
  for (const [id, title, label, text] of vm.runInContext("__seen", g)) {
    rolled++;
    const pl = (x) => P(x) != null || P(x.trim()) != null || /[ąćęłńóśźż„]/i.test(x);
    if (/^(dbg|aff)_/.test(id)) continue;   // bargains.js / afflictions.js write their events in Polish directly
    if (title && id !== "book") ok(pl(title), `Polish for event title ${id}: ${title}`);   // book events are titled with the book's name
    ok(pl(label), `Polish for choice ${id}: ${label}`);
    ok(!/undefined|NaN|\[object/.test(text), `clean outcome ${id}: ${text}`);
  }
  ok(rolled > 500, "road events rolled and answered: " + rolled);
  // pictures: only icons that are really painted are asked for, so no 404s
  const assets = src("assets.js"), painted = [...(assets.match(/const PAINTED = new Set\(\[([^\]]*)\]\)/) || [, ""])[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  const onDisk = fs.readdirSync(W).filter((f) => /^icon-.+\.(webp|png|jpg)$/.test(f) && !/^icon-\d+\./.test(f)).map((f) => f.replace(/\.(webp|png|jpg)$/, "")).sort();
  ok(JSON.stringify(painted) === JSON.stringify([...new Set(onDisk)]), "assets.js PAINTED lists exactly the icon files in game/: " + painted.join(",") + " / " + onDisk.join(","));
  ok(/guessed\(key\) && !PAINTED\.has\(key\)\) return rec/.test(assets), "unpainted icons are not requested");
  ok(/key === "map-world-2x"/.test(assets) && (fs.existsSync(W + "map-world-2x.webp") ? painted.includes("map-world-2x") : !painted.includes("map-world-2x")), "map-world-2x is only asked for when it exists");
}
console.log(`qacore ok (${n} checks)`);
