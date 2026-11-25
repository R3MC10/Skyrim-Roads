/* test_eventcards.js: the painted event cards (game/eventcards.js).
   - every card's painting is in game/ at 1280x480 (8:3)
   - each event maps to the right card; events with no fitting painting get none (the caller keeps its own art)
   - while a painting is missing or loading the card is "" so the old drawing stays
   - with the painting: title below it, a severity diamond, particles of the right kind, the fade only on first show
   - particle delays follow the clock, so a card redrawn a second later keeps its particles in step
   - the game wires it in: the raid box, great events, migrations, crises and raids on your house */
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = process.env.W || path.join(__dirname, "../game/");
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log("FAIL " + m); } };

function size(file) {
  const b = fs.readFileSync(file);
  const t = b.slice(12, 16).toString();
  if (t === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (t === "VP8L") { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  if (t === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  return [0, 0];
}

let state = "none";
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String,
  ASSETS: { url: (k) => (state === "ok" ? k + ".webp" : ""), stateOf: () => state }, I18N: { lang: () => lang } };
let lang = "en";
vm.createContext(c);
vm.runInContext(fs.readFileSync(W + "eventcards.js", "utf8").replace(/^const EVCARDS =/m, "var EVCARDS ="), c);
const E = c.EVCARDS;

for (const [, [asset]] of Object.entries(E.CARDS)) {
  const f = W + asset + ".webp";
  ok(fs.existsSync(f), asset + ".webp is in game/");
  if (fs.existsSync(f)) { const [w, h] = size(f); ok(w === 1280 && h === 480, `${asset} is 1280x480 (got ${w}x${h})`); }
}
const want = { raid: "dragon", "gev:dragon": "dragon", "gev:siege": "bandits", "wev:mig": "dragon", "cr:snow": "blizzard", "cr:bandit": "bandits",
  "cr:beasts": "giant", "hs:bandits": "bandits", "hs:vampires": "vampire", "hs:trolls": "giant", "gev:rift": null, "gev:fair": null, "cr:famine": null, "cr:corruption": null, "wev:fest": null };
for (const [ev, card] of Object.entries(want)) ok(E.pick(ev) === card, `${ev} -> ${card} (got ${E.pick(ev)})`);
for (const card of Object.values(want)) if (card) ok(Object.values(E.FOR).includes(card) || E.CARDS[card], `card ${card} exists`);
ok(Object.values(E.FOR).includes("vampire") && Object.values(E.FOR).includes("blizzard"), "every painting is used by some event");

state = "loading";
ok(E.html("raid", { title: "A dragon" }) === "", "loading: no card, the old drawing stays");
state = "none";
ok(E.html("raid", { title: "A dragon" }) === "", "missing: no card");
state = "ok";
ok(E.html("gev:rift", { title: "Rift" }) === "", "an event with no painting gets no card");
const h = E.html("raid", { title: "A dragon is circling Whiterun", sev: "high", right: "<span>4:06</span>" });
ok(/^<figure class="evc evc-c-dragon evc-in"/.test(h), "a figure, fading in the first time");
ok(h.indexOf("<img") < h.indexOf("<figcaption"), "the title is below the painting");
ok(!/evc-art[^>]*>[^]*(gradient|rgba\(0,0,0)/.test(h), "nothing darkens the painting");
ok(/evc-sev sev-high/.test(h) && /aria-label="Danger"/.test(h), "a severity diamond with a spoken label");
ok(/evc-fx evc-embers/.test(h) && (h.match(/<i style=/g) || []).length === 11, "dragon: 11 embers");
ok(/<span>4:06<\/span>/.test(h), "the right-hand slot (the clock)");
const h2 = E.html("raid", { title: "A dragon is circling Whiterun", sev: "high" });
ok(!/evc-in/.test(h2), "a redraw doesn't fade in again");
ok(/evc-in/.test(E.html("raid", { title: "A dragon is attacking Whiterun" })), "a new title fades in");
ok(/evc-mist/.test(E.html("hs:vampires", { title: "x" })), "vampire: crimson mist");
ok(/evc-snow/.test(E.html("cr:beasts", { title: "x" })), "giant: snow");
ok(/evc-wind/.test(E.html("cr:snow", { title: "x" })), "blizzard: wind-driven snow");
ok(/evc-embers/.test(E.html("gev:siege", { title: "x" })), "bandits: embers");
ok(/<h2 class="evc-t">/.test(E.html("gev:dragon", { title: "y", tag: "h2" })), "sheets put the title in an h2");
ok(!/evc-sev/.test(E.html("gev:dragon", { title: "z" })), "no severity given: no diamond");
lang = "pl"; ok(/aria-label="Śmiertelnie groźnie"/.test(E.html("raid", { title: "pl", sev: "dire" })), "Polish severity label"); lang = "en";
// particles keep their phase across redraws
const dl = (s) => [...s.matchAll(/--d:([\d.]+)s;--dl:(-?[\d.]+)s/g)].map((m) => [+m[1], +m[2]]);
const a = dl(E.particles("embers", "dragon", 1000)), b = dl(E.particles("embers", "dragon", 1001));
ok(a.length === 11 && a.every(([d, x], i) => { const y = b[i][1]; const diff = ((x - 1 - y) % d + d) % d; return diff < 0.05 || diff > d - 0.05; }), "a redraw a second later keeps each particle in step");
ok(a.every(([d, x]) => x <= 0 && x > -d - 0.01), "delays are negative, within one trip");

// wired into the game
const src = (f) => fs.readFileSync(W + f, "utf8");
ok(/EVCARDS\.html\("raid"/.test(src("ui.js")), "ui.js raid box uses the card");
ok(/EVCARDS\.html\("gev:" \+ ev\.kind/.test(src("greatevents.js")), "great events use the card");
ok(/EVCARDS\.html\("wev:" \+ ev\.kind/.test(src("worldevents.js")), "world events use the card");
ok(/EVCARDS\.html\("cr:" \+ cr\.chain/.test(src("crises.js")), "crises use the card");
ok(/EVCARDS\.html\("hs:" \+ h\.raid\.kind/.test(src("hsrooms.js")), "house raids use the card");
const html = src("index.html");
ok(html.indexOf('<script src="eventcards.js">') > 0 && html.indexOf('<script src="eventcards.js">') < html.indexOf('<script src="ui.js">'), "index.html loads eventcards.js before ui.js");
ok(/prefers-reduced-motion:reduce\)\{\.evc-fx\{display:none/.test(html), "reduced motion: no particles");
ok(/html\.mo-on \.evc\.evc-in\{animation:evc-in 220ms/.test(html) && /from\{opacity:0;transform:scale\(\.98\)\}/.test(html), "220 ms fade from 98%");
ok(/raid-<card>/.test(src("assets.js")), "assets.js lists the cards");

console.log(`${n - fails}/${n} event card checks passed`);
if (fails) process.exit(1);
