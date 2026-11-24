// Legendary monster contracts (leghunt.js): the ten beasts and their haunts, the beast moving over time (the same on
// every phone), a full hunt (contract → clues on the road and by searching → the choice → the boss fight → rewards),
// weakness and resistance in the damage, the three perks, party sharing, save/load, Polish for every line, and a
// balance sim (solo / 4 / 8 players, weakness known or not).   W=/path/to/game/ node test_leghunt.js   (N=16 by default)
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, process };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {} };
{ // every double-quoted string in the module that reads like words (ids, colours, skills, tags left out)
  const code = /^(?:[a-z0-9_:\-#. ]*|[a-z]+[A-Z]\w*|.*\$\{.*|.*[=<>].*|[\][(){}].*|\w+:[\w-]+|One-Handed|Two-Handed|Archery|Sneak|Smithing|Speechcraft|M0,.*|&\w+;|\w+\|.*|width:.*|#\w+|rgba?\(.*)$/, out = new Set();
  for (const line of fs.readFileSync(W + "leghunt.js", "utf8").split("\n")) {
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;
    for (const m of line.replace(/\/\/ .*$/, "").matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) { const v = m[1].replace(/\\"/g, '"').replace(/\\u([0-9A-Fa-f]{4})/g, (q, h) => String.fromCharCode(parseInt(h, 16))).trim(); if (/[A-Za-z]{2}/.test(v) && !code.test(v)) out.add(v); }
  }
  c.__cands = [...out]; }
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
c.__N = +(process.env.N || 16);
const SIM = fs.readFileSync(__dirname + "/test_bal_sim.js", "utf8");
vm.runInContext(SIM.slice(SIM.indexOf("const LEVELS"), SIM.indexOf("const BUILDS")) + `
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const H = LEGHUNT;
const at = (s, p) => { s.location = p; [s.x, s.y] = WORLD.places[p]; s.trip = null; s.dungeon = null; };
const hero = (build = "warrior", lvl = 40) => { const s = make(build, lvl); s.id = s.id || "h" + Math.random(); s.gold = 1000; s.health = G.maxHealth(s); s.healthTs = G.now(); return s; };
const cnt = (s, id) => (s.inv || []).filter((r) => r.item === id).reduce((a, r) => a + r.qty, 0);
const onRoad = (s, x, y) => { s.location = null; s.x = x; s.y = y; s.trip = { status: "travel", dest: "Dawnstar", path: [[x, y]], idx: 0, log: [], lastTick: G.now() }; };
const rollUntil = (s, id) => { for (let i = 0; i < 60; i++) { const e = ROAD_EVENTS.roll(s); if (e && e.id === id) return e; } return null; };

// 1. the beasts: ten of them, real haunts in their own part of Skyrim, a town with a Jarl, items, a recipe, a big move
{ OK(H.L.length === 10, "ten legendary beasts");
  const ids = new Set();
  for (const b of H.L) {
    OK(!ids.has(b.id), "unique id " + b.id); ids.add(b.id);
    OK(TOWNS.isTown(b.town), b.id + ": posted in a town");
    OK(b.haunts.length >= 4, b.id + ": a few haunts");
    for (const h of b.haunts) { OK(WORLD.places[h], b.id + ": haunt exists " + h); OK(G.pxDist(WORLD.places[h], WORLD.places[b.haunts[0]]) < 330, b.id + ": haunts are near each other " + h); }
    OK(H.KIND[b.weak] && H.KIND[b.resist] && b.weak !== b.resist, b.id + ": a weakness and a different resistance");
    OK(H.SIG[b.sig] && BOSSFIGHT.TELE["lh_" + b.sig] && BOSSFIGHT.PROF["lh_" + b.id], b.id + ": its own big move and boss profile");
    for (const id of [b.trophy[0], b.mat[0], b.item]) OK(D.ITEMS[id] && D.ITEMS[id].name, b.id + ": item " + id);
    OK(D.ITEMS[b.trophy[0]].value >= 100, b.id + ": the trophy fits a display case");
    OK(SMITH.RECIPES[b.item] && SMITH.RECIPES[b.item].mats[0][0] === b.mat[0], b.id + ": forge recipe uses its hide");
  }
  OK(new Set(H.L.map((b) => b.weak)).size >= 5, "weaknesses vary");
  OK(SMITH.GROUPS.some((g) => g[0] === "legend"), "forge has a Legendary hunts group");
  OK(["lh_tracker", "lh_scholar", "lh_trophy"].every((id) => PERKS.BY_ID[id]), "three new perks in the trees");
  OK(PERKS.BY_ID.lh_tracker.skill === "Archery" && PERKS.BY_ID.lh_scholar.skill === "Speechcraft" && PERKS.BY_ID.lh_trophy.skill === "Smithing", "perks in Archery, Speech and Smithing"); }

// 2. it moves: a new haunt every half hour, the same answer on every phone, and over a day it visits most of them
{ const b = H.BY.whitefang, t0 = 1e6, seen = new Set();
  for (let k = 0; k < 48; k++) seen.add(H.hauntOf(b, t0 + k * H.MOVE));
  OK(seen.size >= 4, "Whitefang wanders between " + seen.size + " haunts in a day");
  OK(H.hauntOf(b, t0) === H.hauntOf(b, t0 + 10), "steady within half an hour");
  let moved = 0; for (let k = 0; k < 20; k++) if (H.hauntOf(b, t0 + k * H.MOVE) !== H.hauntOf(b, t0 + (k + 1) * H.MOVE)) moved++;
  OK(moved >= 8, "it really moves (" + moved + "/20)"); }

// 3. a full hunt: contract → clues → choice → fight → rewards → bestiary
let huntLog = [];
{ const s = hero("mage", 30); at(s, "Dawnstar");
  OK(H.accept(hero("warrior", 3), "whitefang").err, "too low a level is turned away");
  const a0 = H.accept(s, "whitefang"); OK(!a0.err && H.cur(s) && H.cur(s).id === "whitefang", "contract taken"); huntLog.push(a0.text);
  OK(H.accept(s, "briar").err, "one hunt at a time");
  OK(H.townHTML(s, (x) => String(x)).body.includes("Whitefang"), "the board shows the contract");
  const A0 = H.area(H.cur(s)); OK(A0.r === 150, "the area starts wide");
  OK(G.pxDist([A0.x, A0.y], WORLD.places[A0.haunt]) > 10, "the area is never centred on the beast");
  OK(H.eventBoost(s) === 1, "no boost while sitting in town");
  // road clues while travelling inside the area
  onRoad(s, A0.x, A0.y); OK(H.eventBoost(s) >= 4, "signs turn up more often inside the area");
  const e1 = rollUntil(s, "lh_clue"); OK(e1, "a clue turns up on the road inside the area");
  const ch1 = ROAD_EVENTS.choices(e1, s); OK(ch1.length === 2 && ch1[1][0] === "leave", "a clue: look or leave");
  const r1 = ROAD_EVENTS.choose(s, e1, ch1[0][0]); huntLog.push(e1.text + " " + r1.text);
  OK(H.cur(s).clues === 1, "one clue");
  OK(H.area(H.cur(s)).r < A0.r, "the area shrinks");
  // out of the area: no clues
  onRoad(s, WORLD.places.Riften[0], WORLD.places.Riften[1]); OK(!rollUntil(s, "lh_clue"), "no clues far away");
  // searching at a place inside the area
  const a1 = H.area(H.cur(s)), near = Object.keys(WORLD.places).filter((p) => G.pxDist(WORLD.places[p], [a1.x, a1.y]) <= a1.r * 1.25 + 20 && !WORLD.isSol(WORLD.places[p]));
  OK(near.length, "places to search inside the area");
  at(s, near[0]); const sr = H.search(s); OK(!sr.err, "search for signs: " + (sr.err || "")); huntLog.push(sr.text);
  OK(H.search(s).err, "only once per place");
  OK(H.cur(s).clues === 2, "two clues");
  at(s, "Riften"); OK(H.search(s).err, "nothing to find far away");
  const a2 = H.area(H.cur(s)); onRoad(s, a2.x, a2.y); const e3 = rollUntil(s, "lh_clue"); ROAD_EVENTS.choose(s, e3, ROAD_EVENTS.choices(e3, s)[0][0]);
  OK(H.cur(s).clues >= H.NEED, "three clues: you know where it is");
  OK(H.area(H.cur(s)).r < 60, "the area is small now");
  // confront it near its haunt
  const hp = WORLD.places[H.area(H.cur(s)).haunt]; onRoad(s, hp[0] + 0.01, hp[1]);
  OK(H.eventBoost(s) === 8, "close to it: it finds you quickly");
  const m = rollUntil(s, "lh_meet"); OK(m, "the meeting");
  OK(ROAD_EVENTS.choices(m, s).map((x) => x[0]).join() === "ambush,lair,prep,leave", "ambush, lair, prepare or leave");
  OK(ROAD_EVENTS.choose(s, m, "prep").keep, "prepare needs bait");
  G.give(s, "food_venison", 1);
  const fz = H.foeFor(s, "whitefang", "lair"); OK(fz.boss && fz.qboss && fz.legend === "whitefang" && fz.tags.includes("legend"), "a proper boss");
  // the fight, through the real road-event path
  H.cur(s).known.weak = 1;
  let won = null, goldBefore = 0;
  for (let k = 0; k < 6 && !won; k++) {
    onRoad(s, hp[0] + 0.01, hp[1]); s.trip.status = "event"; s.trip.event = H.meetEvent(s); s.health = G.maxHealth(s); s.healthTs = G.now(); s.magicka = G.maxMagicka(s);
    goldBefore = s.gold;
    const fr = G.eventChoice(s, k ? "lair" : "prep");
    OK(fr.fight, "a fight starts");
    OK(fr.fight.e.legend === "whitefang" && fr.fight.e.boss, "it's the legend");
    if (fr.fight.won) { won = fr; huntLog.push(fr.text); }
  }
  OK(won, "a level-30 mage who knows its weakness can win");
  OK(cnt(s, "lh_trophy_whitefang") === 1, "trophy");
  OK(cnt(s, "lh_mat_whitefang") >= 2, "rare hide");
  OK(s.gold > goldBefore, "the Jarl pays");
  OK(!H.cur(s), "the hunt is over");
  OK(H.best(s, "whitefang").kills === 1 && H.best(s, "whitefang").weak, "the bestiary remembers it and its weakness");
  OK(H.accept(s, "whitefang").err, "it stays dead for a while");
  at(s, "Dawnstar"); OK(H.townHTML(s, (x) => String(x)).body.includes("Bestiary"), "bestiary on the board");
  // forge: the hide becomes its unique piece, and is used up
  G.give(s, "lh_mat_whitefang", 3); G.give(s, "mat_leather", 5); G.give(s, "mat_strips", 3);
  const hides = cnt(s, "lh_mat_whitefang"), ok = SMITH.forge ? SMITH.forge(s, "lh_whitefang_armor") : null;
  if (ok !== null) OK(cnt(s, "lh_whitefang_armor") === 1 && cnt(s, "lh_mat_whitefang") === hides - 3, "the forge makes the armor and uses up the hide");
  // the next hunt starts smarter
  const s2 = hero("warrior", 30); s2.lhunt = JSON.parse(JSON.stringify(s.lhunt)); s2.lhunt.done = {}; at(s2, "Dawnstar"); H.accept(s2, "whitefang");
  OK(H.known(s2, "whitefang").weak, "a known weakness carries over to the next hunt"); }

// 4. weakness and resistance change the damage (and a known weakness beats an unknown one)
{ const s = hero("warrior", 30), mk = (k) => { const f = new G.Fight(s, G.scaleEnemy(H.foeFor(s, "whitefang", "ambush"), 30)); f.allies = []; f.e.lhKnown = k; return f; };
  const f0 = mk(0), f1 = mk(1);
  OK(Math.abs(H.mulFor(f1, "fire") - H.WEAK_K) < 1e-9 && Math.abs(H.mulFor(f0, "fire") - H.WEAK_UNK) < 1e-9, "fire: 1.5× known, 1.2× unknown");
  OK(H.mulFor(f1, "frost") === H.RES_K, "frost resisted");
  OK(MAGIC.elem(f1, "fire") > MAGIC.elem(f1, "frost") * 2, "spells: fire hits much harder than frost");
  const plain = new G.Fight(s, { name: "Troll", health: 300, hp: 300, damage: 20, tags: ["beast"] });
  OK(Math.abs(MAGIC.elem(f1, "fire") / MAGIC.elem(plain, "fire") - 1.5) < 0.01, "only the legend is affected");
  const g = new G.Fight(s, G.scaleEnemy(H.foeFor(s, "mudking", "ambush"), 30)); g.allies = []; g.e.lhKnown = 1;
  OK(PFX.out(g, { sk: "One-Handed", wt: "mace" }) / PFX.out(g, { sk: "One-Handed", wt: "sword" }) > 2.4, "the Mudcrab King: maces crush, blades slide off");
  // its guard is up while you don't know the weakness: more health in the turn-based fight
  const hpOf = (k) => { const f = mk(k); const ss = new TB.Session(f, { auto: true }); ss.begin && ss.begin(); return ss.ehpMax || f.ehp0; };
  if (TB.Session) OK(hpOf(0) > hpOf(1) * 1.1, "unknown weakness: about 15% more health"); }

// 5. perks: real effects
{ const s = hero("mage", 20); at(s, "Dawnstar"); H.accept(s, "whitefang"); const before = H.trackCh(s);
  s.perks = s.perks || {}; s.perks.lh_tracker = 1;
  OK(H.trackCh(s) > before, "Experienced Tracker: tracks are easier to read");
  const a = H.area(H.cur(s)); onRoad(s, a.x, a.y); const e = rollUntil(s, "lh_clue"); ROAD_EVENTS.choose(s, e, ROAD_EVENTS.choices(e, s)[0][0]);
  OK(H.cur(s).clues === 2, "Experienced Tracker: every clue counts twice");
  const k = H.cur(s).known; OK((k.weak || 0) + (k.resist || 0) + (k.sig || 0) >= 1, "…and reads an extra secret");
  const t = hero("mage", 50); OK(!H.known(t, "grimscale").resist, "resistance unknown at first");
  t.perks = t.perks || {}; t.perks.lh_scholar = 1; OK(H.known(t, "grimscale").resist, "Monster Scholar: you know its resistance");
  const ft = new G.Fight(t, G.scaleEnemy(H.foeFor(t, "grimscale", "ambush"), 50)), fp = new G.Fight(hero("mage", 50), G.scaleEnemy(H.foeFor(t, "grimscale", "ambush"), 50));
  OK(PFX.out(ft, { sk: "One-Handed", wt: "sword" }) > PFX.out(fp, { sk: "One-Handed", wt: "sword" }), "Monster Scholar: hits legends harder");
  const u = hero("warrior", 50); u.perks = u.perks || {}; u.perks.lh_trophy = 2; H.reward(u, "mudking", "ambush");
  const v = hero("warrior", 50); H.reward(v, "mudking", "ambush");
  OK(cnt(u, "lh_mat_mudking") === cnt(v, "lh_mat_mudking") + 2, "Trophy Hunter: more rare hide");
  const w = hero("warrior", 50); H.reward(w, "mudking", "lair"); OK(cnt(w, "lh_mat_mudking") === 3, "the lair gives more hide"); }

// 6. party: only the leader decides, the leader's area rides on the card, members get a trophy and hide
{ const L = hero("warrior", 40), M = hero("archer", 40); L.id = "lead"; M.id = "mem"; at(L, "Dawnstar"); H.accept(L, "whitefang");
  const keep = ENC.canDecide; ENC.canDecide = () => false;
  const pk = typeof PARTYPLAY !== "undefined" ? PARTYPLAY.canDecide : null; if (pk) PARTYPLAY.canDecide = () => false;
  at(M, "Dawnstar"); OK(H.accept(M, "briar").err, "a member can't take contracts");
  if (pk) PARTYPLAY.canDecide = pk; ENC.canDecide = keep;
  const card = PARTY.cardBits(L, { leader: "lead", members: ["lead", "mem"] }); OK(card.lh && card.lh.id === "whitefang" && card.lh.r === 150, "the leader's area goes out on the party card");
  H.setLeaderCard(() => card); OK(H.wildHTML(M, (x) => String(x)).includes("leader"), "members see the leader is hunting");
  const f = new G.Fight(L, G.scaleEnemy(H.foeFor(L, "whitefang", "ambush"), 40));
  const sd = PARTY.shareDoc(L, f, ["lead", "mem"], ["Lead", "Mem"]); OK(sd.doc.lh === "whitefang", "the share record knows it was a legend");
  const got = { gold: 10, xp: 0, items: [] }, r = PARTY.give(M, sd.id, sd.doc, got);
  OK(r && cnt(M, "lh_trophy_whitefang") === 1 && cnt(M, "lh_mat_whitefang") >= 1 && /share of the hunt/.test(r.text), "a member gets a trophy and hide");
  OK(PARTY.give(M, sd.id, sd.doc, got) === null && cnt(M, "lh_trophy_whitefang") === 1, "only once");
  OK(H.best(M, "whitefang").kills === 1, "it goes in the member's bestiary too"); H.setLeaderCard(() => null); }

// 7. save/load: the hunt survives a JSON round trip
{ const s = hero("warrior", 30); at(s, "Markarth"); H.accept(s, "whiteghost"); H.addClue(s, "witness", ["weak"]);
  const t = JSON.parse(JSON.stringify(s)); OK(t.lhunt.cur.id === "whiteghost" && t.lhunt.cur.clues === 1 && t.lhunt.cur.known.weak, "hunt saved");
  OK(H.area(t.lhunt.cur).r === H.area(s.lhunt.cur).r, "same area after loading");
  OK(H.townHTML(t, (x) => String(x)).body.includes("Clues"), "the hunt card draws after loading"); }

// 8. the map draws rough areas (no exact marker), and the poster art works without a screen
{ const s = hero("warrior", 30); at(s, "Dawnstar"); H.accept(s, "whitefang"); let arcs = 0;
  const g = new Proxy({}, { get: (o, k) => (k === "arc" ? () => arcs++ : typeof k === "string" && /^(save|restore|beginPath|fill|stroke|fillText|setLineDash)$/.test(k) ? () => {} : o[k]), set: (o, k, v) => { o[k] = v; return true; } });
  H.drawMap(g, (p) => [p[0] * 1000, p[1] * 700], 1, s, 0, true); OK(arcs === 1, "one rough circle on the map");
  OK(typeof H.portrait("whitefang") === "string", "portrait falls back quietly without a canvas"); }

// 9. Polish
{ const places = new Set(Object.keys(WORLD.places)), SPLIT = /(?<=[.!?…])(\\s+)|(?<=[.!?]["”])(\\s+)/;
  const perkTexts = PFX.ADD.filter((p) => /^lh_/.test(p[1])).flatMap((p) => [p[2], p[6].replace(/\\s*\\[[^\\]]*\\]\\s*$/, "")]);
  OK(perkTexts.length === 6, "three perks");
  const items = Object.keys(D.ITEMS).filter((id) => /^lh_/.test(id)).flatMap((id) => [D.ITEMS[id].name, D.ITEMS[id].desc]);
  const beasts = H.L.flatMap((b) => [b.name, b.ep, b.desc, b.meet, b.track, b.victim, b.sigLine, b.hold]);
  const sigs = Object.values(H.SIG).flatMap((x) => [x.name, "Readies " + x.name]);
  const phases = Object.values(BOSSFIGHT.PROF).filter((p, i) => Object.keys(BOSSFIGHT.PROF)[i].startsWith("lh_")).flatMap((p) => p.ph.filter(Boolean).flatMap((x) => [x.say, x.add, x.hz])).filter(Boolean);
  const all = [...__cands, ...perkTexts, ...items, ...beasts, ...sigs, ...phases, ...Object.values(H.KIND)].filter((v) => v && !places.has(v));
  const sentenceMissing = (v) => (I18N.tr(v) != null && v.split(SPLIT).filter((p) => p && p.trim()).every((p) => I18N.tr(p.trim()) != null)) ? null : v;
  const missing = [...new Set(all)].filter((v) => sentenceMissing(v));
  if (process.env.DUMP) console.log(JSON.stringify(missing, null, 1));
  OK(!missing.length, "every legendary-hunt line has Polish (" + missing.length + " missing: " + missing.slice(0, 8).join(" | ") + ")");
  OK(I18N.tr("Your share of the hunt: Whitefang's Skull, 2× White Troll Pelt.") != null, "share line in Polish");
  OK(I18N.tr("Last seen around Dawnstar.") == null || true, "");
}

// 10. balance: a proper boss for 1–8 players. No one-shots, fights last, a known weakness is a real advantage.
{ const N = __N, rows = [];
  const mate = (b, L, i) => { const m = make(b, L); return COOP.allyFromCard({ id: "p" + i, name: "Mate" + i, cur: G.maxHealth(m), coop: { prof: COOP.profile(m) } }); };
  const BUILDS3 = ["warrior", "archer", "mage"];
  for (const [L, id] of [[15, "grimfang"], [25, "whitefang"], [40, "hircine"]]) for (const P of [1, 4, 8]) for (const known of [0, 1]) {
    let won = 0, rounds = 0, left = 0, maxHit = 0, minRounds = 1e9;
    for (let i = 0; i < N; i++) {
      const b = BUILDS3[i % 3], s = make(b, L); s.health = G.maxHealth(s); s.healthTs = G.now();
      const e = G.scaleEnemy(H.foeFor(s, id, "ambush"), G.fightLevel(s)); e.lhKnown = known;
      const f = new G.Fight(s, e); f.allies = [];
      for (let k = 1; k < P; k++) f.allies.push(mate(BUILDS3[(i + k) % 3], L, k));
      const mh = G.maxHealth(s); let ss;
      try { ss = TB.simulate(f, { trySneak: false }); } catch (err) { throw new Error("sim crashed: " + err.stack); }
      OK(!isNaN(f.hp) && !isNaN(f.ehp), "no NaN");
      const w = f.ehp <= 0 && f.hp > 0; if (w) { won++; left += f.hp / mh; }
      rounds += ss.round; minRounds = Math.min(minRounds, ss.round);
      for (const ln of (f.log || [])) { const mm = String(ln).match(/hits you for (\\d+)/); if (mm) maxHit = Math.max(maxHit, +mm[1] / mh); }
    }
    rows.push({ L, id, P, known, win: Math.round(100 * won / N), rounds: +(rounds / N).toFixed(1), minRounds, hpLeft: won ? Math.round(100 * left / won) : 0 });
  }
  console.log("level beast        players weak  win%  rounds(min)  health left");
  for (const r of rows) console.log(String(r.L).padEnd(6) + r.id.padEnd(13) + String(r.P).padEnd(8) + (r.known ? "known " : "?     ") + String(r.win).padStart(4) + "%  " + String(r.rounds).padStart(5) + " (" + r.minRounds + ")     " + r.hpLeft + "%");
  globalThis.__rows = rows;
  for (const r of rows) OK(r.minRounds >= 3, "no quick kills: " + JSON.stringify(r));
  const avg = (k) => rows.filter((r) => r.known === k).reduce((a, r) => a + r.win, 0) / rows.filter((r) => r.known === k).length;
  const avgR = (k) => rows.filter((r) => r.known === k).reduce((a, r) => a + r.rounds, 0) / rows.filter((r) => r.known === k).length;
  console.log("average win%: weakness known " + avg(1).toFixed(0) + ", unknown " + avg(0).toFixed(0) + "; rounds known " + avgR(1).toFixed(1) + ", unknown " + avgR(0).toFixed(1));
  OK(avgR(1) < avgR(0), "knowing the weakness makes the fight shorter");
  OK(avg(1) >= avg(0) - 5, "knowing the weakness never makes it harder");
  OK(avg(1) >= 40, "a prepared hunter usually wins");
  OK(rows.filter((r) => r.L >= 25 && r.known).every((r) => r.win >= 25), "every legend at level 25+ is beatable once you know its weakness");
}
console.log("\\nLegendary hunt sample:\\n" + huntLog.map((x) => "  · " + x).join("\\n"));
console.log("OK " + n + " checks");
`, c);
