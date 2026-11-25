const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Location introductions (locintro.js): the place shows full screen on EVERY arrival (full the first time, short after),
// the Always / First visit only / Off setting, party members already standing there don't get it again, "what's new"
// only lists real changes (max two), and the Area tab's View location button never counts as arriving.
// W=/path/to/game/ node test_locintro.js — prints "locintro ok (N checks)".
const fs = require("fs"), vm = require("vm");
const W = __GAME;
const files = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js",
  "cooking.js", "smithing.js", "ammo.js", "gather.js", "halls.js", "homestead.js", "horses.js", "bounty.js", "festivals.js", "market.js", "social.js", "caravans.js", "rumours.js", "worldevents.js", "mp.js", "remind.js",
  "spellbook.js", "assets.js", "areaui.js", "gatherui.js", "locscreen.js", "locintro.js"];
/* one game per "phone" (a party member is someone else's phone) */
function phone() {
  const mem = {};
  const localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
  const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RegExp, localStorage };
  vm.createContext(c);
  for (const f of files) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
  return c;
}
let pass = 0;
const ok = (v, m) => { if (!v) throw new Error("FAIL " + m); pass++; };

const A = phone(), LI = A.LOCINTRO, WORLD = A.WORLD, G = A.G;
ok(LI && typeof LI.tick === "function", "locintro.js loads");
const newHero = (c, id) => { const S = c.G.newSave(id, "Remy", "nord"); S.location = "Riverwood"; [S.x, S.y] = c.WORLD.places.Riverwood; S.trip = null; S.dungeon = null; return S; };
const go = (S, l) => { S.trip = null; S.dungeon = null; S.location = l; if (l) [S.x, S.y] = WORLD.places[l]; };
const leave = (S) => { S.location = null; S.trip = { destName: "x" }; };

// ---- 1. the rule
ok(LI.decide("always", true) === "full" && LI.decide("always", false) === "short", "Always: full first, short after");
ok(LI.decide("first", true) === "full" && LI.decide("first", false) === "", "First visit only");
ok(LI.decide("off", true) === "" && LI.decide("off", false) === "", "Off");
ok(LI.mode() === "always", "Always is the default");

// ---- 2. every entry shows it
LI._reset();
const S = newHero(A, "li1");
ok(LI.tick(S) === null, "the game starting where you stand is not an arrival");
ok(S.locv && S.locv.Riverwood, "the starting place counts as visited");
ok(LI.tick(S) === null, "standing still: nothing");
leave(S); ok(LI.tick(S) === null, "setting off: nothing");
S.trip = null; go(S, "Whiterun");
ok(LI.tick(S) === "full", "first time in Whiterun: the full reveal");
ok(S.locv.Whiterun.n === 1, "the visit is saved");
const kinds = [];
for (let i = 0; i < 5; i++) { leave(S); LI.tick(S); go(S, "Whiterun"); kinds.push(LI.tick(S)); }
ok(kinds.every((k) => k === "short"), "every later entry shows the short one (" + kinds + ")");
ok(S.locv.Whiterun.n === 6, "six visits counted");
leave(S); LI.tick(S); go(S, "Riverwood"); ok(LI.tick(S) === "short", "back to the start town: short");
// any kind of place on the map, dungeon entrances and camps included
const byKind = {};
for (const [n, p] of Object.entries(WORLD.places)) if (!byKind[p[2]]) byKind[p[2]] = n;
for (const [k, n] of Object.entries(byKind)) { leave(S); LI.tick(S); go(S, n); const r = LI.tick(S); ok(r === "full" || (r === "short" && n === "Riverwood") || (r === "short" && n === "Whiterun"), k + " (" + n + ") shows it: " + r); }
// a roam spot or a pin: not a place
leave(S); LI.tick(S); S.trip = null; S.location = "Roaming (12, 40)"; ok(LI.tick(S) === null, "a roam spot: nothing");
// teleports (Recall, a respawn) change the place without a trip: still an arrival
const tp0 = Object.keys(WORLD.places).find((n) => !S.locv[n] && ["city", "town"].includes(WORLD.places[n][2]));
S.location = tp0; [S.x, S.y] = WORLD.places[tp0]; ok(LI.tick(S) === "full", "a teleport into " + tp0 + " shows it too");
// inside a dungeon you stay at its door's place: leaving the dungeon is not a new arrival
const dn = Object.keys(WORLD.places).find((n) => A.DUNGEONS.enterable(n));
leave(S); LI.tick(S); go(S, dn); LI.tick(S);
S.dungeon = { place: dn }; ok(LI.tick(S) === null, "going into the dungeon: nothing");
S.dungeon = null; ok(LI.tick(S) === null, "coming back out: nothing");

// ---- 3. the setting
LI._reset(); const S2 = newHero(A, "li2"); LI.tick(S2);
LI.setMode("first"); ok(LI.mode() === "first", "First visit only is remembered");
leave(S2); LI.tick(S2); go(S2, "Markarth"); ok(LI.tick(S2) === "full", "First visit only: a new place shows it");
leave(S2); LI.tick(S2); go(S2, "Markarth"); ok(LI.tick(S2) === "", "First visit only: not again");
LI.setMode("off");
leave(S2); LI.tick(S2); go(S2, "Riften"); ok(LI.tick(S2) === "", "Off: nothing, not even the first time");
ok(S2.locv.Riften && S2.locv.Riften.n === 1, "Off still notes the visit (so What's new stays right)");
LI.setMode("always"); leave(S2); LI.tick(S2); go(S2, "Riften"); ok(LI.tick(S2) === "short", "back on Always: Riften was visited, so short");
ok(LI.pref("locIntro", "first") && LI.mode() === "first" && !LI.pref("other", "x"), "settings button routes through pref()");
LI.setMode("nonsense"); ok(LI.mode() === "always", "an unknown value falls back to Always");
ok(/Location introductions/.test(LI.settingsHTML((k, o, cur) => `${k}:${o.map((x) => x[0]).join("/")}=${cur}`)) && /locIntro:always\/first\/off=always/.test(LI.settingsHTML((k, o, cur) => `${k}:${o.map((x) => x[0]).join("/")}=${cur}`)), "the settings row has the three choices");

// ---- 4. what's new: only real changes, at most two lines
const NW = LI.whatsNew;
ok(NW(null, { jobs: ["a"], sp: 1, tomes: true, cv: true }).length === 0, "first visit: no change lines");
ok(NW({ jobs: ["a"], sp: 1, cv: false }, { jobs: ["a"], sp: 1, tomes: true, cv: false }).length === 0, "nothing changed: no lines");
ok(NW({ jobs: ["a"], sp: 1 }, { jobs: ["a", "b"], sp: 1 })[0] === "A new job on the notice board.", "a new job");
ok(NW({ jobs: [], sp: 1 }, { jobs: ["b", "c"], sp: 1 })[0] === "New jobs on the notice board.", "new jobs");
ok(NW({ jobs: ["a", "b"], sp: 1 }, { jobs: ["a"], sp: 1 }).length === 0, "a job taken off the board is not news");
ok(NW({ jobs: [], sp: 1 }, { jobs: [], sp: 2, tomes: true })[0] === "Fresh spell tomes on the shelves.", "tomes restocked");
ok(NW({ jobs: [], sp: 1 }, { jobs: [], sp: 2, tomes: false }).length === 0, "no tome seller: no restock line");
ok(NW({ jobs: [], cv: false }, { jobs: [], cv: true })[0] === "A caravan is in town.", "a caravan came in");
ok(NW({ jobs: [], cv: true }, { jobs: [], cv: true }).length === 0, "the caravan was there last time too");
const pl = [{ name: "Kacper", party: true }, { name: "Ana", friend: true }, { name: "Stranger" }];
const four = NW({ jobs: [], sp: 1, cv: false }, { jobs: ["x"], sp: 2, tomes: true, cv: true, players: pl });
ok(four.length === 2, "never more than two lines (" + four.length + ")");
ok(four[0] === "Kacper and Ana are here.", "friends / party first, strangers left out: " + four[0]);
ok(NW(null, { players: [{ name: "Kacper", party: true }] })[0] === "Kacper is here, from your party.", "one party member");
ok(NW(null, { players: [{ name: "Stranger" }] }).length === 0, "strangers aren't news");
ok(NW(null, { players: [{ name: "A", friend: true }, { name: "B", friend: true }, { name: "C", friend: true }, { name: "D", friend: true }] })[0] === "A, B and 2 more are here.", "many friends");
// the real notice board: a board that turned over since last time is news
LI._reset(); LI.setMode("always"); const S3 = newHero(A, "li3"); LI.tick(S3);
leave(S3); LI.tick(S3); go(S3, "Whiterun"); LI.tick(S3);
ok(Array.isArray(S3.locv.Whiterun.jobs) && S3.locv.Whiterun.jobs.length > 0, "Whiterun's board is noted (" + S3.locv.Whiterun.jobs.length + " jobs)");
S3.locv.Whiterun.jobs = ["Whiterun-0-c"];   // as if the last visit saw an older board
const snap = LI.snapshot(S3, "Whiterun");
ok(LI.whatsNew(S3.locv.Whiterun, snap).includes("New jobs on the notice board."), "an older board → New jobs");

// ---- 5. a party: everyone who arrives sees it on their own; those already there don't
const B = phone(); B.LOCINTRO._reset();
const me = newHero(A, "pa"), friend = newHero(B, "pb");
LI._reset(); LI.tick(me); B.LOCINTRO.tick(friend);
leave(me); LI.tick(me); go(me, "Dawnstar"); ok(LI.tick(me) === "full", "I walk into Dawnstar: I see it");
// my friend arrives later; on my phone nothing about me changed
const ctxMe = { players: () => [{ name: "Friend", party: true }] };
for (let i = 0; i < 3; i++) ok(LI.tick(me, ctxMe) === null, "already in Dawnstar when my party member walks in: nothing for me");
friend.location = null; friend.trip = { destName: "Dawnstar" }; B.LOCINTRO.tick(friend);
friend.trip = null; friend.location = "Dawnstar"; [friend.x, friend.y] = WORLD.places.Dawnstar;
let seen = null; const ctxB = { players: () => [{ name: "Remy", party: true }], persist: () => { seen = "saved"; } };
ok(B.LOCINTRO.tick(friend, ctxB) === "full", "my party member arriving sees it on their own phone");
ok(seen === "saved", "their visit is saved");
ok(B.LOCINTRO.whatsNew(null, { players: ctxB.players() })[0] === "Remy is here, from your party.", "and it says I'm there");

// ---- 6. the Area tab's View location button: never an arrival
LI._reset(); const S4 = newHero(A, "li4"); LI.tick(S4);
leave(S4); LI.tick(S4); go(S4, "Windhelm"); LI.tick(S4);
const before = JSON.stringify(S4.locv);
let saves = 0; const ctx4 = { persist: () => saves++, players: () => [] };
ok(LI.view(S4, ctx4) === true, "View location works while standing at a place");
ok(JSON.stringify(S4.locv) === before, "View location doesn't count a visit");
ok(saves === 0, "View location saves nothing");
ok(LI.tick(S4, ctx4) === null, "and the next tick sees no arrival");
for (let i = 0; i < 3; i++) LI.view(S4, ctx4);
ok(JSON.stringify(S4.locv) === before, "pressing it again and again: still no visits");
leave(S4); LI.tick(S4); ok(LI.view(S4, ctx4) === false, "on the road: nothing to view");
// the picture's words come from the place
const h = LI.html({ l: "Whiterun", kind: "view", lines: ["Kacper is here."] });
ok(h.includes(">Whiterun</h1>") && h.includes("place-whiterun.webp") && h.includes("Kacper is here.") && h.includes("Tap anywhere to close"), "the view shows Whiterun's own painting, name and line");
ok(LI.html({ l: "Whiterun", kind: "short", lines: [] }).includes("Tap to skip"), "arrivals say Tap to skip");
const f = LI.facts("Whiterun");
ok(f.meta.length >= 2 && /^(Dawn|Day|Evening|Night)( · \d\d:\d\d)?$/.test(f.meta[0]) && ["Winter", "Spring", "Summer", "Autumn"].includes(f.meta[f.meta.length - 1]), "time of day, weather and season: " + f.meta.join(" | "));
ok(/tod|day|night|dusk|dawn/.test(f.sk.tod) && f.sk.wx, "a time-of-day and weather tint");
ok(LI.viewBtn().includes('data-act="locview"') && LI.viewBtn().includes("<svg") && /View location/.test(LI.viewBtn()), "the button: a landscape icon, labelled View location");

// ---- 7. wired in
const ui = fs.readFileSync(W + "ui.js", "utf8"), idx = fs.readFileSync(W + "index.html", "utf8");
ok(/LOCINTRO\.tick\(S, locIntroCtx\(\)\)/.test(ui), "ui.js ticks it");
ok(/a === "locview"[^\n]*LOCINTRO\.view\(S/.test(ui), "ui.js routes the Area button to view()");
ok(/LOCINTRO\.close\(\)\) return true/.test(ui), "Back skips it");
ok(/LOCINTRO\.settingsHTML\(seg\)/.test(ui) && /LOCINTRO\.pref\(k/.test(ui), "Settings has the row");
ok(/LOCINTRO\.viewBtn\(true\)/.test(ui), "the Area list has the button too");
ok(!/MOTION\.place\(/.test(ui) && !/function place\(name/.test(fs.readFileSync(W + "motion.js", "utf8")) && !/mo-veil/.test(idx), "the old quick name veil is gone");
const pos = (f) => idx.indexOf(`<script src="${f}"></script>`);
ok(pos("locintro.js") > pos("locscreen.js") && pos("locintro.js") < pos("ui.js"), "locintro.js loads after locscreen.js, before ui.js");
ok(pos("i18n_locintro.js") > 0 && pos("i18n_locintro.js") < pos("i18n.js"), "its Polish loads before i18n.js");
ok(/"#locintro"/.test(fs.readFileSync(W + "overlays.js", "utf8")), "overlays.js ranks it as a window (tips and letters wait)");
ok(/LOCINTRO\.viewBtn\(\)/.test(fs.readFileSync(W + "locscreen.js", "utf8")), "the place's scene has the button by its name");

// ---- 8. Polish
const P = phone(); vm.runInContext(fs.readFileSync(W + "i18n_locintro.js", "utf8"), P);
const words = P.I18N_EXTRA.words, pats = P.I18N_EXTRA.pat;
for (const t of ["Location introductions", "First visit only", "View location", "Tap to skip", "Tap anywhere to close", "A new job on the notice board.", "New jobs on the notice board.",
  "Fresh spell tomes on the shelves.", "A caravan is in town.", "Evening", "Autumn", "Every arrival shows the place"]) ok(words[t], "Polish for " + t);
const pn = fs.readFileSync(W + "patchnotes.js", "utf8").match(/\{ id: "b\d+-locintro"[^]*?\] \}/);
ok(pn, "patch note");
for (const line of pn[0].match(/^      "(.*)",$/gm).map((x) => JSON.parse(x.trim().replace(/,$/, "")))) ok(words[line], "Polish for the patch note line: " + line.slice(0, 40));
const tp = (t) => { for (const [re, fn] of pats) { const m = t.match(re); if (m) return fn(m); } return null; };
ok(tp("Kacper is here, from your party.") === "Kacper jest tutaj, z twojej drużyny.", "pattern: one party member");
ok(tp("Kacper and Ana are here.") === "Kacper i Ana są tutaj.", "pattern: two friends");
ok(tp("A, B and 2 more are here.") === "A, B i jeszcze 2 są tutaj.", "pattern: many");
ok(tp("Evening · 18:40") === "Wieczór · 18:40", "pattern: time of day");

console.log(`locintro ok (${pass} checks)`);
