const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Side-systems bug hunt 2 (claude/qa-side2-*): the forge and crafting lines are Polish in Polish mode, the
   lockpicking hint is one translatable sentence, and a festival smithing contest can't leave a free
   material-saving roll for the next craft. Prints "qaside2 ok". */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = __GAME;
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log("FAIL", m); } };

// 1. Polish: load every i18n file in index.html order, up to i18n.js, with the game in Polish
const html = fs.readFileSync(path.join(W, "index.html"), "utf8");
const files = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
const end = files.indexOf("i18n.js");
ok(end > 0 && files.indexOf("i18n_qaside2.js") > 0 && files.indexOf("i18n_qaside2.js") < end, "i18n_qaside2.js loads before i18n.js");
const c = { console, localStorage: { getItem: () => JSON.stringify({ lang: "pl" }), setItem() {} }, navigator: { language: "pl" } };
c.window = c; c.globalThis = c;
vm.createContext(c);
for (const f of files.slice(0, end + 1).filter((f) => /^i18n/.test(f)))
  vm.runInContext(fs.readFileSync(path.join(W, f), "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
const tr = (x) => c.I18N.tr(x);
const want = {
  "Make": /Wykuj/, "Smelt & tan": /Przetop/, "Improve": /Ulepsz/,
  "from 2 Iron Ore · you can make 3": /możesz zrobić 3/,
  "Missing: 2 Gold Ore": /^Brakuje: 2 Gold Ore$/,
  "Make as many as you can (10)": /ile się da \(10\)/,
  "Can make now": /Do zrobienia/,
  "You make an Iron Dagger from 1 Iron Ingot, 1 Leather Strips. Masterful work! +1 damage.": /Wykuwasz: Iron Dagger.*Mistrzowska.*obrażeń/,
  "You smelt 2 Iron Ore into 1 Iron Ingot.": /Przetapiasz 2 Iron Ore na 1 Iron Ingot/,
  // forge levels are "+1".."+6" now (rarity owns Fine / Epic / Legendary)
  "→ +1 (+1 damage) · uses 1 Iron Ingot (you have 4)": /^→ \+1 \(\+1 obrażeń\).*masz 4/,
  "Your Smithing (100) can't improve it past +6.": /Kowalstwo \(100\).*\+6/, "Iron Sword is now +2": /^Iron Sword: teraz \+2$/,
  "You hammer 1 Iron Ingot into it. Iron Sword is now +2 (+2 damage).": /Iron Sword jest teraz \+2 \(\+2 obrażeń\)/,
  "Each improvement uses one piece of the item's material (ingots, leather, firewood, moonstone or dwarven metal). Blacksmiths sell the common ones; dungeons hide the rest. Your Smithing (25) sets how far: every 20 points lets you go one step further, up to +6.": /Kowalstwo \(25\)/,
  "Blacksmiths sell the common ones; dungeons hide the rest. Your Smithing (20) sets how far: every 20 points lets you go one step further, up to +6.": /^Kowale.*(20)/,
  "Each improvement uses one piece of the item's material (ingots, leather, firewood, moonstone or dwarven metal).": /^Każde/,
  "Drag on the lock to aim the pick, then hold Turn. If it shakes, let go before the pick snaps.": /./,
  // batch 2: halls, neighbours, the inn, festivals
  "Buy Breezehome": /^Kup: Breezehome$/, "Buy a hall plot in Whiterun": /działkę.*Whiterun/, "Other halls in Whiterun": /^Inne dwory w: Whiterun$/,
  "○ Mead Hall · 15,000": /Miodosytnia · 15,000/, "Shared chest": /Wspólna skrzynia/, "Rent a room": /Wynajmij/, "Write": /Napisz/,
  "Other players who own Breezehome in their own world. Drop in to see their trophies, or leave a gift.": /^Inni gracze.*Breezehome/,
  "Nobody else has a house here yet.": /^Nikt/, "Falkreath · on now · ends in 1d 13h": /^Falkreath · trwa · koniec za 1d 13h$/,
  "Great Hunt is on in Falkreath. Ends in 1d 13h.": /trwa teraz \(Falkreath\)/, "40% there": /^40% /, "Type a name": /Wpisz/,
};
for (const [en, re] of Object.entries(want)) { const r = tr(en); ok(r && r !== en && re.test(r), "pl: " + en + " => " + r); }

// 2. the lockpicking hint isn't split by <b>, so the whole sentence can be translated
{ const src = fs.readFileSync(path.join(W, "lockgame.js"), "utf8");
  const hint = (src.match(/id="lphint">([^\n]*)<\/p>/) || [])[1] || "";
  ok(hint && !/<b>/.test(hint) && /LX\(/.test(hint), "lock hint is one translated sentence: " + hint); }

// 2b. a festival held in a hold's own capital doesn't say "Falkreath, Falkreath"
{ const src = fs.readFileSync(path.join(W, "tourneyui.js"), "utf8");
  ok(/c\.hold && c\.hold !== c\.place \? `, \$\{esc\(c\.hold\)\}`/.test(src), "festival hold shown only when it differs from the place"); }

// 3. a contest or smelt game (no item id) leaves no save roll for the next real craft
{ const g = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
  vm.createContext(g);
  for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "mp.js", "craftgames.js", "smithgame.js"])
    vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), g);
  const r = vm.runInContext(`(() => {
    const mk = () => { const s = G.newSave("A", "Smith", "nord"); s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.inv = []; s.gold = 0; G.give(s, "mat_iron", 10); G.give(s, "mat_strips", 6); return s; };
    SMITHGAME._pend({ id: null, grade: "perfect", q: 1 });
    const a = CG.smithMake(mk(), "iron_sword", "perfect", () => 0);
    SMITHGAME._pend({ id: "iron_sword", grade: "perfect", q: 1 });
    const b = CG.smithMake(mk(), "iron_sword", "perfect", () => 0);
    return [a, b];
  })()`, g);
  ok(/^You make/.test(r[0]) && !/save/.test(r[0]), "no free save after a contest: " + r[0]);
  ok(/save 1/.test(r[1]), "a real forged item still can save: " + r[1]); }

if (fails) { console.log(fails + "/" + n + " failed"); process.exit(1); }
console.log("qaside2 ok (" + n + " checks)");
