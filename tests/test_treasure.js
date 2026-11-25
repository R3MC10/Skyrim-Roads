// Treasure maps and archaeology (treasure.js): the spot a map points to is real ground near a real place, the sketch's
// landmarks and X match the world, torn pieces combine, digging at the wrong and the right spot, the finds, sealed tombs
// through the dungeon rooms, relics restored and sold, the three perks with real effects, the party vote (and two votes
// merged by netsync), save/load with migration, and Polish for every line.   W=/path/to/game/ node test_treasure.js
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, process };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {} };
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
const SIM = fs.readFileSync(__dirname + "/test_bal_sim.js", "utf8");
vm.runInContext(SIM.slice(SIM.indexOf("const LEVELS"), SIM.indexOf("const BUILDS")) + `
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const T = TREASURE, px = (a, b) => Math.hypot((a[0] - b[0]) * 1000, (a[1] - b[1]) * 700);
const hero = (lvl = 20) => { const s = make("warrior", lvl); s.id = "h" + Math.random(); s.gold = 5000; s.trip = null; s.dungeon = null; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s._test = 1; return s; };
const has = (s, id) => (s.inv || []).some((r) => r.item === id);
const cnt = (s, id) => (s.inv || []).filter((r) => r.item === id).reduce((a, r) => a + r.qty, 0);
const stand = (s, pos) => { s.location = null; s.x = pos[0]; s.y = pos[1]; };
let fakeT = 1e6; const tk = (d = 100) => (fakeT += d);

// 1. the spot: real ground near a real place in Skyrim, the same for everybody with the same seed
const SEEDS = []; for (let i = 0; i < 300; i++) SEEDS.push("sd" + i.toString(36) + "q");
const kinds = new Set();
for (const seed of SEEDS) {
  const t = T.target(seed), a = WORLD.places[t.anchor];
  OK(a && a[1] <= 1 && !WORLD.isSol(a), "anchor is a real Skyrim place: " + t.anchor);
  OK(t.pos[0] > 0 && t.pos[0] < 1 && t.pos[1] > 0 && t.pos[1] < 1, "spot on the map " + seed);
  OK(px(t.pos, a) <= 26, "spot a short walk from " + t.anchor + " (" + px(t.pos, a).toFixed(1) + ")");
  const k = Terrain.typeAtPos(t.pos), TT = Terrain.T;
  OK(px(t.pos, a) < 0.01 || (k !== TT.SEA && k !== TT.LAKE && k !== TT.PEAK && k !== TT.BEYOND), "spot is on ground you can stand on " + seed);
  OK(JSON.stringify(T.target(seed)) === JSON.stringify(t), "same seed, same spot");
  OK(t.hold, "spot is in a hold"); kinds.add(t.kind);
}
OK(kinds.size >= 5, "maps hang on many kinds of landmark: " + [...kinds]);
{ const u = new Set(SEEDS.map((x) => T.target(x).anchor)).size; OK(u > 90, "maps spread over the land (" + u + " places of " + T.anchors().length + ")"); }

// 2. the sketch matches the world: every mark is a real place drawn where it is, the X is the spot, never a name
for (const seed of SEEDS.slice(0, 80)) {
  const m = T.sketch(seed), t = T.target(seed);
  OK(m.marks.length >= 1 && m.marks[0].anchor && m.marks[0].place === t.anchor, "the anchor is on the sketch");
  for (const mk of m.marks) { const p = WORLD.places[mk.place]; const back = [(m.box.x0 + mk.at[0] * m.box.w) / 1000, (m.box.y0 + mk.at[1] * m.box.h) / 700]; OK(px(back, p) < 0.5, "mark " + mk.place + " sits where the place is"); }
  const xb = [(m.box.x0 + m.x[0] * m.box.w) / 1000, (m.box.y0 + m.x[1] * m.box.h) / 700];
  OK(px(xb, t.pos) < 0.5 && m.x[0] > 0 && m.x[0] < 1 && m.x[1] > 0 && m.x[1] < 1, "the X is the spot, inside the sheet");
  OK(m.cells.length === m.cols * m.rows && m.cells.some((c) => c !== "w"), "terrain cells drawn");
  OK(T.sketch(seed, true).marks.length >= m.marks.length, "the Cartographer's sketch shows as much or more");
  const r = T.riddle(seed); OK(r.en.length >= 4 && r.en.length === r.pl.length && r.en.every((l) => !l.includes(t.anchor)), "riddle without names");
}
OK(SEEDS.slice(0, 80).some((x) => T.sketch(x).rivers.length), "some sketches show rivers");
OK(SEEDS.slice(0, 80).some((x) => T.sketch(x).marks.length > 1), "some sketches show a second landmark");

// 3. items from ids: anything carries everything (trade/gift-safe)
{ const id = "tmap|abcd123"; OK(D.ITEMS[id] && D.ITEMS[id].slot === "map" && /Old treasure map/.test(D.ITEMS[id].name), "map item made from its id");
  OK(D.ITEMS["tjour|abcd123"].name && D.ITEMS["tfrag|abcd123|2|3"].name.includes("2/3"), "journal and piece items");
  OK(!D.ITEMS["tmap|NOPE!"] && !D.ITEMS["tfrag|abcd|5|3"] && !D.ITEMS["tfrag|abcd|1|9"], "bad ids make nothing");
  OK(T.parse("tfrag|abcd|1|4").n === 4 && T.parse("tmap|x") === null, "parse"); }

// 4. torn pieces combine
{ const s = hero(); const seed = "frag77";
  G.give(s, "tfrag|frag77|1|3"); G.give(s, "tfrag|frag77|3|3");
  OK(T.combine(s, seed).err, "a missing piece: can't combine");
  OK(/Put the torn pieces together/.test(T.dig(s, { t: tk() }).err), "can't dig from a scrap");
  G.give(s, "tfrag|frag77|2|3");
  const r = T.combine(s, seed); OK(!r.err && has(s, "tmap|frag77") && !s.inv.some((x) => x.item.startsWith("tfrag|")), "three pieces make a map");
  // a new piece fills the gap you have
  const s2 = hero(); G.give(s2, "tfrag|gap11|1|2"); let fills = 0; for (let i = 0; i < 60; i++) { const id = T.newLead(s2, Math.random); if (id === "tfrag|gap11|2|2") fills++; if (id !== "tfrag|gap11|1|2") G.take(s2, s2.inv.find((x) => x.item === id).id); } OK(fills >= 10, "new pieces tend to complete a set you hold (" + fills + ")"); }

// 5. digging: wrong spot, hints, rest; right spot, the find, can't dig twice
{ const s = hero(20); const seed = "dig4242", t = T.target(seed); G.give(s, "tmap|" + seed);
  s.trip = { status: "travel" }; OK(/on the move/.test(T.dig(s, { t: tk() }).err), "no digging on the move"); s.trip = null;
  stand(s, [t.pos[0] + 0.15, t.pos[1]]);
  OK(T.hints(s, seed).length === 0, "no hints at first");
  let r = T.dig(s, { t: tk() }); OK(r.wrong && s.tre.tries[seed] === 1 && r.rest > 0, "wrong spot: a try and a rest");
  OK(/worn out/.test(T.dig(s, { t: fakeT + 5 }).err), "resting blocks the next dig");
  r = T.dig(s, { t: tk() }); OK(r.wrong && r.hint && /somewhere in/.test(r.hint), "two wrong digs: the hold (" + r.hint + ")");
  T.dig(s, { t: tk() }); r = T.dig(s, { t: tk() }); OK(/ of /.test(r.hint), "four: a town and a direction (" + r.hint + ")");
  T.dig(s, { t: tk() }); r = T.dig(s, { t: tk() }); OK(r.hint === "Look near " + t.anchor + ".", "six: the landmark");
  OK(has(s, "tmap|" + seed), "wrong digs cost only time");
  const g0 = s.gold; stand(s, [t.pos[0] + 0.01, t.pos[1]]);
  r = T.dig(s, { t: tk(), r: () => 0.5 }); OK(r.ok && s.gold > g0 && r.got.length >= 2 && !has(s, "tmap|" + seed) && s.tre.dug[seed], "right spot: the cache (" + r.text + ")");
  G.give(s, "tmap|" + seed); OK(T.dig(s, { t: tk() }).err || !T.leads(s).length, "a dug map leads nowhere");
  // innkeeper rumours
  const s2 = hero(); G.give(s2, "tmap|inn9999"); const inn = Object.keys(TOWNS.INNS)[0]; s2.location = inn; [s2.x, s2.y] = WORLD.places[inn];
  const gg = s2.gold, ir = T.askInn(s2, "inn9999"); OK(!ir.err && s2.gold === gg - T.HINT_GOLD && /somewhere in/.test(ir.hint), "the innkeeper sells the first hint");
  s2.location = null; OK(T.askInn(s2, "inn9999").err, "no inn, no rumour");
  // a party member can't dig
  const s3 = hero(); G.give(s3, "tmap|mem1234"); const P = PARTYPLAY.role; PARTYPLAY.role = () => "member"; OK(/only your leader/.test(T.dig(s3, { t: tk() }).err), "members don't dig"); PARTYPLAY.role = P; }

// 6. finds: tombs, uniques once, Excavator pays more
{ let tombs = 0, uniq = new Set(), gold0 = 0, gold1 = 0; const N = 400;
  for (let i = 0; i < N; i++) for (const ex of [0, 2]) {
    const s = hero(25); if (ex) s.perks.excavator = ex; const seed = "ff" + i + "x" + ex, t = T.target(seed); G.give(s, "tmap|" + seed); stand(s, t.pos);
    const g = s.gold, r = T.dig(s, { t: tk() }); OK(r.ok, "dig ok"); if (ex) gold1 += s.gold - g; else { gold0 += s.gold - g; if (r.tomb) tombs++; if (r.uniq) uniq.add(r.uniq); }
  }
  OK(gold1 > gold0 * 1.3, "Excavator: more gold (" + gold0 + " → " + gold1 + ")");
  OK(tombs > N * 0.08 && tombs < N * 0.26, "sealed tombs now and then (" + tombs + "/" + N + ")");
  OK(uniq.size === T.UNIQUES.length, "every lost unique can turn up");
  const s = hero(25); for (let i = 0; i < 60; i++) { const seed = "uu" + i + "q", t = T.target(seed); G.give(s, "tmap|" + seed); stand(s, t.pos); T.dig(s, { t: tk() }); }
  OK(T.UNIQUES.every((u) => cnt(s, u) <= 1), "each unique only once");
  const low = hero(3); let lt = 0; for (let i = 0; i < 100; i++) { const seed = "ll" + i + "q", t = T.target(seed); G.give(low, "tmap|" + seed); stand(low, t.pos); if (T.dig(low, { t: tk() }).tomb) lt++; } OK(lt === 0, "no tombs for a beginner");
  // Excavator: the rest after a wrong dig is halved
  const a = hero(), b = hero(); b.perks.excavator = 2; for (const x of [a, b]) { G.give(x, "tmap|rest5555"); stand(x, [0.1, 0.1]); }
  OK(T.dig(b, { t: 50 }).rest < T.dig(a, { t: 50 }).rest, "Excavator: shorter rest"); }

// 7. a sealed tomb: a one-off barrow through the dungeon rooms
{ const s = hero(25); let seed = null;
  for (let i = 0; i < 200 && !seed; i++) { const sd = "tbb" + i + "q", t = T.target(sd); G.give(s, "tmap|" + sd); stand(s, t.pos); const r = T.dig(s, { t: tk(), r: (() => { let k = 0; return () => [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.01][Math.min(6, k++)] ?? 0.01; })() }); if (r.tomb) seed = sd; }
  OK(seed, "a tomb found");
  const t = T.target(seed); stand(s, t.pos); OK(T.tombHere(s), "the tomb is at the dig");
  OK(!T.enterTomb(s).err && s.dungeon && s.dungeon.tomb === seed && s.dungeon.theme === "barrow" && s.dungeon.rows.length, "down into the tomb");
  OK(/Sealed tomb near/.test(s.dungeon.place), "named after its landmark");
  // walk to the boss and beat it (the rooms on the way are skipped; the boss is made soft: this is about the tomb, not the fight)
  let g = 0, res = null; const place = s.dungeon.place;
  while (s.dungeon && !s.dungeon.done && g++ < 60) { const d = s.dungeon;
    if (d.room && d.room.type === "boss") { d.room.enemy.health = 1; d.room.enemy.hp = 1; d.room.enemy.damage = 0; res = DUNGEONS.act(s, "fight", tk(5)); continue; }
    d.room = null; const ch = DUNGEONS.nextChoices(s); if (!ch.length) break; const e = DUNGEONS.enterRoom(s, ch[0]); if (e) throw new Error(e); }
  OK(s.dungeon && s.dungeon.done, "the tomb's boss is beaten");
  OK(s.tre.tombs[seed].done, "a cleared tomb stays shut"); OK(!s.cleared?.[place], "not left on the map as a cleared place");
  DUNGEONS.leave(s); stand(s, t.pos); OK(!T.tombHere(s), "no way back in"); }

// 8. relics
{ const s = hero(); G.give(s, "relic_nord_frag", 2);
  OK(T.restore(s, "relic_nord_mask").err, "two pieces aren't enough without Antiquarian");
  G.give(s, "relic_nord_frag"); s.location = "Riften"; OK(/collector/.test(T.restore(s, "relic_nord_mask").err), "only at a collector");
  s.location = "Winterhold"; const g = s.gold; OK(!T.restore(s, "relic_nord_mask").err && has(s, "relic_nord_mask") && s.gold === g - T.COLLECT_FEE && !has(s, "relic_nord_frag"), "the collector restores it for a fee");
  const p0 = T.relicPrice(s, "relic_nord_mask"), g1 = s.gold; OK(!T.sellRelic(s, "relic_nord_mask").err && s.gold === g1 + p0, "sold to the collector");
  const a = hero(); a.perks.antiquarian = 1; a.location = "Riften"; G.give(a, "relic_dwemer_frag", 2); OK(!T.restore(a, "relic_dwemer_astrolabe").err && has(a, "relic_dwemer_astrolabe"), "Antiquarian: two pieces, anywhere, free");
  OK(T.relicPrice(a, "relic_dwemer_astrolabe") > T.relicPrice(hero(), "relic_dwemer_astrolabe") * 1.4, "Antiquarian: collectors pay more");
  // fragments come from barrows and Dwemer ruins
  const s2 = hero(); s2.dungeon = { theme: "barrow", found: [], done: false, room: null }; let got = 0;
  for (let i = 0; i < 300; i++) { const d = { theme: i % 2 ? "barrow" : "dwemer", found: [], done: true, room: null }; got += T.onDungeon(s2, d, "boss", false, {}, 1).length; }
  OK(cnt(s2, "relic_nord_frag") > 30 && cnt(s2, "relic_dwemer_frag") > 30 && got > 150, "bosses in barrows and ruins drop relic fragments");
  const s3 = hero(); for (let i = 0; i < 300; i++) T.onDungeon(s3, { theme: "cave", found: [], done: true, room: null }, "boss", false, {}, 1); OK(!has(s3, "relic_nord_frag") && T.leads(s3).length + T.sets(s3).length > 20, "caves: no relics, but leads"); }

// 9. perks: registered, effects read in code
for (const id of ["cartographer", "antiquarian", "excavator"]) OK(Object.values(PERKS.TREES).some((tr) => tr.some((p) => p[0] === id)), id + " perk in a tree");
{ const s = hero(); s.perks.cartographer = 1; OK(T.hintLevel(s, "carto99") === 1 && T.sketch("carto99", true).clear, "Cartographer: the hold at once, a clearer sketch"); }

// 10. loot: leads drop from people, bosses more often
{ const s = hero(); delete s._test; let boss = 0, man = 0;
  for (let i = 0; i < 3000; i++) { boss += T.loot(s, { name: "x", tags: ["boss"] }).length; man += T.loot(s, { name: "y", tags: ["humanoid"] }).length; }
  OK(boss > 150 && boss < 500 && man > 10 && man < 90, "loot rates (boss " + boss + ", humanoid " + man + " of 3000)");
  OK(T.loot(s, { name: "wolf", tags: ["animal"] }).length === 0, "animals carry no maps");
  OK(G.rollLoot.toString().includes("TREASURE.loot"), "engine loot asks for leads"); }

// 11. save/load and migration
{ const s = hero(); G.give(s, "tmap|save1234"); G.give(s, "tfrag|save5678|1|2"); const t = T.target("save1234"); stand(s, [0.1, 0.1]); T.dig(s, { t: tk() });
  const back = JSON.parse(JSON.stringify(s)); G.migrate(back);
  OK(back.tre.tries.save1234 === 1 && has(back, "tmap|save1234") && has(back, "tfrag|save5678|1|2"), "leads and tries survive save/load");
  OK(D.ITEMS["tmap|save1234"].name === D.ITEMS[back.inv.find((r) => r.item === "tmap|save1234").item].name, "same item after load");
  const old = hero(); delete old.tre; old.inv.push({ id: 9999, item: "tmap|BAD!!", qty: 1 }); G.migrate(old);
  OK(old.tre && old.tre.v === 1 && old.tre.dug && !has(old, "tmap|BAD!!"), "an old save gets a clean record and loses broken leads");
  const bad = hero(); bad.tre = { dug: [], tries: null, rest: "x", tombs: { zz: 5 } }; G.migrate(bad); OK(!Array.isArray(bad.tre.dug) && bad.tre.rest === 0 && !bad.tre.tombs.zz, "a damaged record is repaired"); }

// 12. party: the leader puts "where do we dig?" to a vote; two votes merge
{ const s = hero(); s.discovered = ["Whiterun", "Riverwood", "Rorikstead", "Honningbrew Meadery"].filter((p) => WORLD.places[p]); s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun;
  const party = { id: "p1", leader: s.id, leaderName: "L", members: [{ id: s.id }, { id: "m1" }, { id: "m2" }] };
  let p = T.openVote(party, s.id, s, ["m1", "m2"], 100);
  OK(p.halt && p.halt.kind === "dig" && p.halt.opts[0][0] === "here" && p.halt.opts.length >= 2, "a dig vote with places");
  const k2 = p.halt.opts[1][0];
  const a = PARTYPLAY.vote(p, "m1", k2, 101), b = PARTYPLAY.vote(p, "m2", k2, 102);
  p = { ...p, _v: 100 }; p._f = NETSYNC.stamp("parties", null, p, 100);
  const sa = { ...a, _v: 101, _by: "m1" }; sa._f = NETSYNC.stamp("parties", p, sa, 101);
  const sb = { ...b, _v: 102, _by: "m2" }; sb._f = NETSYNC.stamp("parties", p, sb, 102);
  const merged = NETSYNC.mergeDoc("parties", sa, sb);
  OK(Object.keys(merged.halt.votes).length === 2, "two members voting at once: both votes kept");
  const r = T.settle(merged, s.id, 103); OK(r.key === k2 && r.p.halt.done && r.p.halt.picked.key === k2, "the most votes win: " + r.label); }

// 13. Polish
{ const lines = [];
  for (const seed of SEEDS.slice(0, 40)) { const r = T.riddle(seed); lines.push(...r.en, r.title[0], D.ITEMS["tmap|" + seed].name, D.ITEMS["tfrag|" + seed + "|1|3"].name); }
  for (const id of ["relic_nord_frag", "relic_dwemer_frag", "relic_nord_mask", "relic_dwemer_astrolabe", ...T.UNIQUES]) lines.push(D.ITEMS[id].name);
  for (const p of Object.values(PERKS.TREES).flat().filter((p) => ["cartographer", "antiquarian", "excavator"].includes(p[0]))) lines.push(p[1], p[5]);
  const s = hero(25); G.give(s, "tmap|plpl1234"); s.tre = undefined; T.st(s); s.tre.tries.plpl1234 = 6;
  lines.push(...T.hints(s, "plpl1234"), "The torn edges line up. You have a whole treasure map now.", "You dig for an hour and hit only roots and stones. Not here.",
    "No marker on your map: match the sketch or the riddle to the land, go there and dig.", "Treasure hunt", " Dig here", " Go down into the tomb", "Where do we dig?", "Sealed tomb near Riverwood",
    "You have 2 of 3 pieces.", "Your spade hits wood: a rotten chest.", "🍺 Ask the innkeeper · 60 gold", "Look near Riverwood.");
  c_lang("pl");
  OK(I18N.tr("Treasure hunt") === "Poszukiwanie skarbu" && /Zakopałem to kawałek drogi/.test(I18N.tr(T.riddle("sd5q1").en.find((l) => /buried/.test(l)))), "Polish is on: " + I18N.tr(T.riddle("sd5q1").en.join(" ")));
  const miss = lines.filter((l) => { const o = I18N.tr(l); return o == null || o === l; });
  c_lang("en");
  OK(miss.length === 0, "Polish for every line; missing: " + JSON.stringify(miss.slice(0, 8))); }

console.log("treasure ok · " + n + " checks");
`.replace("c_lang(\"pl\")", "__lang = \"pl\"").replace("c_lang(\"en\")", "__lang = \"en\""), c);
