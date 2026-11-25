/* Meeko, the stray dog (encounters.js, meeko.js, followers2.js): an old save with Meeko keeps him through load, fights,
   travel and the bond tick; a dismissed Meeko finds you again on the road; one who walked out at 0 loyalty can come back
   after three days; old saves that lost him get him back through the same road event (and one journal line); he fights
   as a dog with the full follower system loaded; Polish text is there.
   Loads the game like the page does (every script in index.html). W=/path/to/game/ node test_meeko.js */
const W = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
const doc = { createElement: () => ({ width: 0, height: 0, style: {}, dataset: {}, getContext: () => ctx, toDataURL: () => "data:image/png;base64,AA" }), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, structuredClone,
  document: doc, addEventListener() {}, setTimeout, clearTimeout, setInterval() {}, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 2, process: { env: {} } };
vm.createContext(c);
const files = fs.readFileSync(W + "index.html", "utf8").match(/<script src="([a-z0-9_]+\.js)">/g).map((s) => s.match(/"(.*)"/)[1])
  .filter((f) => !["store.js", "p2pnet.js", "ui.js", "sound.js", "map.js", "backup.js", "skillinfo.js", "chargen.js"].includes(f));
if (!files.includes("meeko.js")) { console.log("FAIL meeko.js is not loaded by index.html"); process.exit(1); }
for (const f of files) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
vm.runInContext(`
let n = 0, fails = 0; const ok = (x, m) => { n++; if (!x) { fails++; console.log("FAIL", m); } };
const hero = (lv = 12) => { const s = G.newSave("m" + Math.random(), "Tess", "nord"); s.level = lv; s.gold = 5000; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; return s; };
const withMeeko = (s) => { s.follower = { id: "meeko", hp: 60, ts: G.now() }; s.encFlags = { dog: true, once_dog: true }; BONDS.bond(s, "meeko"); return s; };
const reload = (s) => G.migrate(JSON.parse(JSON.stringify(s)));
const onEvent = (s, id) => { const d = ENC.byId[id]; if (!s.trip) G.startTrip(s, "Riverwood", WORLD.places.Riverwood.slice(0, 2), G.now()); s.trip.status = "event"; s.trip.event = { id, enc: true, title: d.title, ...d.make(s, ENC.ctx(s)) }; };
const eligible = (s) => ENC.eligible(s).ok.some((e) => e.id === "dogback");

// 1. he exists, the module is in, and an old save keeps him through load, fights, travel and the bond tick
ok(TOWNS.FOLLOWERS.meeko && TOWNS.FOLLOWERS.meeko[6] === "dog", "Meeko is registered after every script loads");
ok(typeof MEEKO === "object" && ENC.byId.dogback && ENC.L.includes(ENC.byId.dogback), "the 'Meeko finds you' road event is in");
{ let s = withMeeko(hero()); s = reload(s); ok(s.follower && s.follower.id === "meeko", "survives a load");
  ok(MEEKO.where(s) === "with", "where: with you");
  const f = new G.Fight(s, { name: "Bandit", health: 80, hp: 80, damage: 5, tags: ["humanoid"], gold: [0, 0], level: 5 }, null, G.now());
  const al = f.allies.find((a) => a.follower);
  ok(al && al.name === "Meeko" && al.kind === "dog", "fights as a dog with the full follower system: " + (al && al.kind));
  f.run({ t: G.now() }); s._test = false;
  ok(s.follower && s.follower.id === "meeko", "still with you after a fight");
  let t = G.now(); G.startTrip(s, "Riverwood", WORLD.places.Riverwood.slice(0, 2), t); s.trip.lastTick = t;
  for (let i = 0; i < 120; i++) { t += 60; G.advance(s, t); if (s.trip && s.trip.status !== "travel") { s.trip.status = "travel"; s.trip.encounter = null; s.trip.event = null; } if (!s.trip) break; IMM.tick(s, t); BONDS2.roadTime(s, 60, t); s = reload(s); }
  ok(s.follower && s.follower.id === "meeko", "still with you after travel, the bond tick and many reloads");
  ok(!/Meeko got lost/.test(JSON.stringify(s.journal)), "no 'lost' letter while he's with you");
  ok(!eligible(s), "the find-you event never shows while he's with you");
  const card = PARTY.cardBits ? PARTY.cardBits(s, null) : null; if (card && card.fold) { const fa = FOL2.cardAllies({ id: "u2", ...card }); ok(fa[0] && fa[0].kind === "dog", "a friend's Meeko is a dog in co-op too"); } }

// 2. dismissing him: he finds you again on the road
{ let s = withMeeko(hero()); const f0 = FOL2.st(s, "meeko"); f0.loyal = 66; f0.lvl = 9;
  const msg = TOWNS.dismiss(s);
  ok(!s.follower && /find you again/.test(msg), "dismiss: he trots off and will find you: " + msg);
  ok(MEEKO.where(s) === "away" && MEEKO.canFind(s) && eligible(s), "a dismissed Meeko can find you on the road");
  s = reload(s); ok(MEEKO.canFind(s), "still true after a load");
  s.follower = { id: "lydia", hp: 100, ts: G.now() }; ok(!eligible(s), "not while someone else is with you"); s.follower = null;
  onEvent(s, "dogback"); const ch = G.eventChoices(s).map((x) => x[0]); ok(ch.includes("take") && ch.includes("wave"), "take him or not: " + ch);
  const r = G.eventChoice(s, "wave"); ok(!s.follower && /He'll be around/.test(r.text), "wave him off: he stays away");
  ok(!MEEKO.canFind(s) && MEEKO.canFind(s, G.now() + MEEKO.WAVE_WAIT + 1), "after a wave he comes by again later");
  s.encFlags.meekoNext = 0; onEvent(s, "dogback"); G.eventChoice(s, "take");
  ok(s.follower && s.follower.id === "meeko", "take him: Meeko is back");
  const f1 = FOL2.st(s, "meeko"); ok(f1.loyal >= 66 && f1.lvl === 9, "same Meeko: loyalty and level kept (" + f1.loyal + ", lvl " + f1.lvl + ")");
  ok(!s.encFlags.meekoAway && !eligible(s), "once back, the event is gone"); }

// 3. walking out at 0 loyalty: three days of sulking, then he can come back at 30
{ const s = withMeeko(hero()); BONDS.shift(s, -200, "*growls*");
  ok(!s.follower, "loyalty 0: he leaves (followerbonds.js)");
  ok(MEEKO.where(s) === "sulking" && !MEEKO.canFind(s), "sulks for a while");
  const later = G.now() + MEEKO.REJOIN_AFTER + 10; ok(MEEKO.where(s, later) === "away" && MEEKO.canFind(s, later), "after three days he can find you");
  MEEKO.rejoin(s, later); const f = FOL2.st(s, "meeko");
  ok(s.follower && s.follower.id === "meeko" && f.loyal === 30 && !f.bond.leftAt, "comes back forgiven up to 30 loyalty: " + f.loyal); }

// 4. old saves that already lost him
{ // dismissed before this fix: his follower data is there, no follower, nothing else
  const s = hero(); s.encFlags = { dog: true, once_dog: true }; s.folData = { meeko: { inv: [], next: 1, eq: {}, lvl: 7, xp: 0, perks: {}, arch: "warrior", fights: 3, loyal: 55 } };
  const r = reload(s);
  ok(r.journal.filter((j) => /Meeko got lost/.test(j.text)).length === 1, "one journal line says he's out there");
  ok(MEEKO.canFind(r) && eligible(r), "and he can find you");
  const r2 = reload(r); ok(r2.journal.filter((j) => /Meeko got lost/.test(j.text)).length === 1, "the line is written only once");
  onEvent(r2, "dogback"); G.eventChoice(r2, "take"); ok(r2.follower && r2.follower.id === "meeko" && FOL2.st(r2, "meeko").lvl >= 7, "he rejoins with his old level");
  ok(!reload(r2).journal.filter((j) => /Meeko got lost/.test(j.text)).slice(1).length, "no second letter after he's back"); }
{ // lost him, then hired someone else: no event until you travel alone
  const s = hero(); s.encFlags = { dog: true }; s.folData = { meeko: { loyal: 50 } }; s.follower = { id: "lydia", hp: 100, ts: G.now() };
  const r = reload(s); ok(!eligible(r), "not while Lydia is with you"); TOWNS.dismiss(r); ok(eligible(r), "after Lydia goes home, Meeko can find you"); }
{ // only fed him (never followed): nothing
  const s = hero(); s.encFlags = { dog: true, once_dog: true }; const r = reload(s);
  ok(MEEKO.where(r) === "never" && !eligible(r) && !/Meeko/.test(JSON.stringify(r.journal)), "a dog you only fed doesn't turn up"); }
{ // walked out on you a while back: no letter, but after three days he can still find you
  const s = hero(); s.encFlags = { dog: true }; s.folData = { meeko: { loyal: 0, bond: { log: [], leftAt: G.now() - MEEKO.REJOIN_AFTER - 50, seen: {} } } };
  const r = reload(s); ok(!/Meeko got lost/.test(JSON.stringify(r.journal)), "walked out: no letter"); ok(eligible(r), "walked out three days ago: he can find you"); }
{ // he lives at your homestead: stays there
  const s = hero(); s.encFlags = { dog: true }; s.folData = { meeko: { loyal: 50 } };
  const real = HSROOMS.livesAt; HSROOMS.livesAt = (ss, id) => (id === "meeko" ? "p1" : null);
  try { const r = reload(s); ok(MEEKO.where(r) === "home" && !eligible(r) && !/Meeko got lost/.test(JSON.stringify(r.journal)), "living at your homestead: he stays home"); }
  finally { HSROOMS.livesAt = real; } }

// 5. the Follower tab tells you, and the words are in Polish
{ const s = hero(); s.encFlags = { dog: true, meekoAway: { t: 1, why: "dismiss" } }; s.folData = { meeko: { loyal: 50 } };
  ok(/out on the roads looking for you/.test(FOLTAB.panel(s, String)), "the empty Follower tab says where he is"); }
for (const k of ["dismiss", "title", "text", "take", "wave", "took", "waved", "busy", "lost", "tab", "sulk"]) ok(I18N.PL[MEEKO.TXT[k]], "Polish for " + k);

console.log(fails ? fails + " FAILED of " + n : "meeko ok · " + n + " checks");
if (fails) process.exitCode = 1;
`, c);
if (c.process.exitCode) process.exitCode = c.process.exitCode;
