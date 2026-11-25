// Polish sweep (i18n_sweep.js): words drawn on canvas (fight picture, minigames, map labels), toasts, foe and spell names
// and fight log lines all come out in Polish; canvas code sends its text through the translator; English mode is untouched.
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = process.env.W || path.join(__dirname, "../game/");
const src = (f) => fs.readFileSync(path.join(W, f), "utf8");
let fail = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fail++; console.log("FAIL", m); } };

// the add-on is loaded after the other i18n_*.js files and before i18n.js
const html = src("index.html");
const order = [...html.matchAll(/<script src="(i18n[^"]*)"/g)].map((m) => m[1]);
ok(order.includes("i18n_sweep.js"), "i18n_sweep.js in index.html");
ok(order.indexOf("i18n_sweep.js") >= 0 && order.indexOf("i18n_sweep.js") < order.indexOf("i18n.js") && order[order.length - 1] === "i18n.js", "i18n_sweep.js loads before i18n.js: " + order.join(","));

const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "social.js", "ammo.js", "tomes.js", "guide.js", "magic.js", "spellcraft.js", "priests.js", "mp.js"];
function load(lang, game) {
  const c = { console, Math: Object.create(Math), Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, performance: { now: () => 0 },
    navigator: { language: lang === "pl" ? "pl-PL" : "en-GB" }, localStorage: { getItem: () => JSON.stringify({ lang }), setItem() {} } };
  let a = 777; c.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  vm.createContext(c);
  if (game) for (const f of FILES.filter((f) => fs.existsSync(path.join(W, f)))) vm.runInContext(src(f).replace(/^const (\w+) =/m, "var $1 ="), c);
  vm.runInContext(order.map(src).join("\n;") + "\n;globalThis.I18N = I18N; globalThis.I18N_SWEEP = I18N_SWEEP;", c);
  return c;
}
const c = load("pl", true), I = c.I18N, S = c.I18N_SWEEP, t = (s) => I.tr(s);

// every exact line translates (to ours, or to an older list's entry that wins)
let n = 0;
for (const [en, pl] of Object.entries(S.WORDS)) { const r = t(en); ok(r != null && r !== en && (r === pl || I.PL[en] === r), "word: " + en + " → " + r); n++; }

// the fight picture
const want = {
  You: "Ty", "They flee": "Uciekają", Victory: "Zwycięstwo", Miss: "Pudło", "Block!": "Blok!", CRITICAL: "CIOS KRYTYCZNY",
  "SNEAK ATTACK ×2": "ATAK Z UKRYCIA ×2", "⚑ 3 of your party with you": "⚑ 3 z drużyny z tobą", "⚑ 9 allies with you": "⚑ sojusznicy z tobą: 9",
  // minigames and map labels
  CLEARED: "OCZYSZCZONE", "Hits 4": "Trafienia: 4", "Swings left 2": "Zostało zamachów: 2", "Wrong guesses left: 3": "Pomyłki do wykorzystania: 3",
  "Found 2/5": "Znaleziono 2/5", "Picks left: 7": "Wytrychy: 7", "Now: Left": "Teraz: w lewo", Aim: "Celuj", "Sea of Ghosts": "Morze Duchów",
  "TO WINDHELM \uE12F": "DO WINDHELMU \uE12F", "Khajiit market": "Targ Khajiitów",
  // fight log
  "Raises guard": "Unosisz gardę", "Skeever hits 2": "Skeever trafia: 2", "Giant hits 14 (blocked 49%)": "Olbrzym trafia: 14 (zablokowano 49%)",
  "Mudcrab misses": "Błotny krab: pudło", "Power attack, staggers: 18": "Potężny atak, zachwianie: 18", "Sneak attack ×2: 4": "Atak z ukrycia ×2: 4",
  "Drinks Potion of Minor Healing": "Pijesz: Słaba mikstura zdrowia", "Thalmor patrol is staggered": "Patrol Thalmoru traci równowagę",
  "Black bear is paralyzed": "Czarny niedźwiedź nie może się ruszyć", "Bandit outlaw isn't fighting": "Banita nie walczy",
  "Staff of Paralysis: Paralyze: the black bear freezes, paralyzed": "Kostur paraliżu: Paraliż: czarny niedźwiedź zastyga w bezruchu",
  "Attack: 8 · familiar 14": "Atak: 8 · chowaniec 14", "Attack misses · Frost Cloak 5": "Atak: pudło · Płaszcz mrozu 5",
  "Rout: the skeever cowers": "Rozgromienie: skeever kuli się ze strachu", "Dispel does nothing in a fight": "Rozproszenie nic nie daje w walce",
  "Alfa hits 12": "Alfa trafia: 12",   // player names stay as they are
  // toasts
  "You can't afford that.": "Nie stać cię na to.", "\uE13E You're invited to join a clan. Open \uE106 Social → Realm.": "\uE13E Masz zaproszenie do klanu. Otwórz \uE106 Społeczność → Królestwo.",
};
for (const [en, pl] of Object.entries(want)) { ok(t(en) === pl, `"${en}" → "${t(en)}" (want "${pl}")`); n++; }
// the older lists still win and still work
ok(t("Health: 50") === "Zdrowie: 50" && t("Level 3") === "Poziom 3" && t("Claws misses") === "Pazury chybiają", "older lines unchanged");

// real fights: (almost) every log line reads in Polish
const lines = vm.runInContext(`(() => { const out = []; const ws = Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].type === "weapon" || D.ITEMS[k].damage != null && D.ITEMS[k].skill);
  const sps = Object.keys(D.SPELLS).filter((k) => !D.SPELLS[k].hidden), enc = D.ENCOUNTERS.filter((e) => e.health);
  for (let i = 0; i < 120; i++) { const s = G.newSave("A", "T", ["nord", "breton", "khajiit", "orc", "dunmer"][i % 5]); s.level = 1 + (i % 30); s.hpBonus = s.level * 8; s.mpBonus = 200; G.setHealth(s, G.maxHealth(s));
    s.spells = sps.slice(); for (const k of Object.keys(s.skills)) s.skills[k].lvl = 15 + (i % 60);
    const wid = ws[i % ws.length]; if (i % 7) { s.inv.push({ id: "w" + i, item: wid, qty: 1 }); G.equip(s, "w" + i); }
    const rules = i % 4 === 0 ? [{ if: "first_turn", do: "spell:" + sps[i % sps.length] }, { if: "always", do: "attack" }] : i % 4 === 1 ? [{ if: "always", do: "power_attack" }] : null;
    const f = new G.Fight(s, G.scaleEnemy(enc[i % enc.length], s.level), rules || undefined); f.run(); for (const l of f.log) out.push(l.me, l.them); }
  return out.filter((x) => x && /[a-z]{2}/i.test(x)); })()`, c);
const miss = lines.filter((l) => t(l) == null);
console.log("fight log lines", lines.length, "· untranslated", miss.length, miss.length ? "e.g. " + [...new Set(miss)].slice(0, 5).join(" | ") : "");
ok(lines.length > 500 && miss.length / lines.length < 0.02, "fight log in Polish: " + miss.length + "/" + lines.length);
// foe and spell names in the game data
for (const e of c.D.ENCOUNTERS.filter((e) => e.health)) ok(e.name === "Skeever" || e.name === "Draugr" || t(e.name) != null, "foe name: " + e.name);
for (const sp of Object.values(c.D.SPELLS)) if (sp.name && !sp.hidden) ok(t(sp.name) != null, "spell name: " + sp.name);

// the canvas helper: Polish in Polish mode, English in English mode, numbers and unknown names untouched
ok(S.c("They flee") === "Uciekają" && S.c("You") === "Ty" && S.c(12) === 12 && S.c("-12") === "-12" && S.c("Ulfric") === "Ulfric", "canvas helper (pl)");
const e = load("en", false);
ok(e.I18N_SWEEP.c("They flee") === "They flee" && e.I18N_SWEEP.c("You") === "You", "canvas helper (en) leaves English");

// canvas code sends its words through the helper
const has = (f, s) => { const ok2 = src(f).includes(s); ok(ok2, f + " has " + s); };
has("fightart.js", 'L("You")'); has("fightart.js", 'L(won ? (turned ? "They flee" : "Victory") : "Defeated")'); has("fightart.js", 'L("CRITICAL")');
has("fightart.js", "L(b.sneak)"); has("fightart.js", "ftx[i] = L(txt)"); has("fightart.js", "L(rec.foeName)");
has("dunart.js", 'LX("CLEARED")'); has("dungeongames.js", 'LX("Noticed")'); has("dungeongames.js", "LX(`Hits ${st.hits}`)"); has("craftgames.js", 'LX("Aim")');
has("map.js", 'LX("Sea of Ghosts")'); has("solart.js", 'LX("TO WINDHELM \uE12F")'); has("worldevents.js", 'LX("Khajiit market")'); has("raidart.js", "LX(`Season of ${name}`)");
// second sweep (i18n_sweep2.js): the trip line, the Journal, the inn, the market, road events, the fight log, icon-led lines
ok(order.includes("i18n_sweep2.js") && order.indexOf("i18n_sweep2.js") < order.indexOf("i18n.js"), "i18n_sweep2.js loads before i18n.js");
const want2 = {
  "the wilds → Riverwood": "Dzicz → Riverwood", "Road · fast going · on foot": "Droga · szybko · pieszo", "On the way to Riverwood": "W drodze do: Riverwood",
  "Side quests": "Zadania poboczne", "Recommended level 3": "Zalecany poziom 3", "Reward: 50 gold": "Nagroda: 50 złota", "Before the Storm": "Przed burzą",
  "✓ Before the Storm": "✓ Przed burzą", "Sleep to heal and get Rested; hear rumours.": "Prześpij się, żeby się wyleczyć i wypocząć; posłuchaj plotek.",
  "The inn, 2 people inside": "Karczma, osób w środku: 2", "Steward of Whiterun": "Zarządca: Whiterun", "Travel to Markarth": "Podróżuj do: Markarth",
  " Pay (90 gold)": " Zapłać (90 złota)", " Fight": " Walcz", " Something by the road": " Coś przy drodze",
  " A dragon is circling Markarth!": " Smok krąży nad: Markarth!", "(you 100 · foe 52)": "(ty 100 · wróg 52)", "Fight log (8 turns)": "Przebieg walki (tury: 8)",
  "Flames (dual)": "Płomienie (podwójnie)", "Rare wares, one of each · 58 min left": "Rzadkie towary, po jednej sztuce · zostało 58 min",
  " Defeated the Bandit toll gang (+50 gold)": " Pokonano: Bandyci od myta (+50 złota)", "Falkreath (from level 10)": "Falkreath (od poziomu 10)",
};
for (const [en, pl] of Object.entries(want2)) { ok(t(en) === pl, `sweep2: "${en}" → "${t(en)}" (want "${pl}")`); n++; }
// the English lines still exist in the game (so the Polish isn't stale)
const game = fs.readdirSync(W).filter((f) => f.endsWith(".js") && !f.startsWith("i18n")).map(src).join("\n");
for (const en of ["You can't afford that.", "Ready check cancelled.", "Raises guard", "They flee", "Khajiit market", "Unbreakable pick"]) ok(game.includes(en), "still in the game: " + en);
for (const en of ["Side quests", "Recommended level ${rec}", "Sleep to heal and get Rested; hear rumours.", "Fight log (${f.turn} turns)", "the wilds"]) ok(game.includes(en), "still in the game: " + en);

console.log(`polishsweep: ${n} lines checked`);
console.log(fail ? `FAILED ${fail} of ${checks}` : `polishsweep ok · ${checks} checks`);
process.exit(fail ? 1 : 0);
