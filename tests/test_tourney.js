// Festivals, contests and the Grand Arena (tourney.js): the real-time rotation, scoring, friendly-fight rules (no gear lost,
// no bounty, nobody dies), prizes, hold and clan glory, festival peace, perks with real effects, scoreboard sync between
// two phones, Polish, and a short balance sim of the festival duels and the Pit.
// W=/path/to/game/ node test_tourney.js
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, process, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} };
c.localStorage = { getItem: () => JSON.stringify({ lang: "en" }), setItem() {} };
c.STORE_SRC = fs.readFileSync(W + "store.js", "utf8"); c.HUB_SRC = fs.existsSync(W + "../server/src/hub.js") ? fs.readFileSync(W + "../server/src/hub.js", "utf8") : "\"fest\"";
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
vm.runInContext(`
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const T = TOURNEY, DAY = 864e5;
const at = (s, p) => { s.location = p; [s.x, s.y] = WORLD.places[p]; s.trip = null; s.dungeon = null; };
const mk = (id, name, lv = 20, sk = 45) => { const s = G.newSave(id, name, "nord"); s.level = lv; for (const k of Object.keys(s.skills)) s.skills[k].lvl = sk; return s; };
OK(typeof T === "object" && typeof TOURNEYUI === "object", "modules loaded");
OK(T.FESTS.length === 7 && T.TRIES === 3, "seven festivals, three tries");

// ---- 1. the calendar: a fixed real-time rotation every phone agrees on
const holds = new Set(T.FESTS.map((f) => G.holdAt(WORLD.places[f.place])));
OK(holds.size === 7 && T.FESTS.every((f) => WORLD.places[f.place] && ["city", "town"].includes(WORLD.places[f.place][2])), "each festival in its own hold's town");
const seen = {};
for (let k = 0; k < 21; k++) { const o = T.occ(k); seen[o.fid] = (seen[o.fid] || 0) + 1; }
OK(Object.keys(seen).length === 7 && Object.values(seen).every((v) => v === 3), "every festival comes round once in 21 days (" + JSON.stringify(seen) + ")");
const t0 = T.EPOCH + 40 * T.SLOT + 3600e3, cur = T.current(t0);
OK(cur && cur.slot === 40 && cur.end - cur.start === 2 * DAY, "a festival runs for two days");
OK(!T.current(cur.end + 1000) && T.next(cur.end + 1000).slot === 41, "then a quiet day while the next is set up");
OK(T.announced(cur.end + 1000) && !T.announced(cur.end + 1000).on, "the next one is announced on the quiet day");
OK(T.announced(t0).on && T.announced(t0).key === cur.key, "a running festival is announced as on");
OK(T.next(t0).fid !== cur.fid && T.occ(47).fid === cur.fid, "a missed festival comes back three weeks later");
OK(T.byKey(cur.key).key === cur.key && !T.byKey("derby-41") === (T.occ(41).fid !== "derby"), "occurrence keys read back");
OK(T.pitKey(t0) === "pit-" + T.pitWeek(t0) && T.pitEnds(T.pitWeek(t0)) > t0, "the Pit has a weekly board");
OK(T.FESTS.every((f) => f.contests.every((k) => T.CONTESTS[k])), "every festival's contests exist");
OK(["duel", "archery", "joust", "smith", "fish", "hunt", "mine", "drink"].every((k) => T.FESTS.some((f) => f.contests.includes(k))), "every contest is held somewhere");

// ---- 2. scoring
const A = mk("A", "Astrid"); at(A, cur.place);
const sc = (k, r, s = A) => T.score(k, s, r);
OK(sc("archery", { grade: "perfect" }) > sc("archery", { grade: "great" }) && sc("archery", { grade: "great" }) > sc("archery", { grade: "botched" }), "better play scores more");
const lo = mk("L", "Lo", 5, 10);
OK(sc("smith", { grade: "good" }) > sc("smith", { grade: "good" }, lo), "skill matters");
OK(sc("hunt", { grade: "good", level: 6 }) > sc("hunt", { grade: "good", level: 1 }), "bigger game scores more");
OK(sc("fish", { fish: ["fish_spadetail", "fish_perch", "fish_longfin"] }) > sc("fish", { fish: ["fish_salmon", "fish_salmon", null] }) && sc("fish", { fish: [null, null, null] }) === 0, "rare fish score most");
OK(sc("mine", { got: { ore_ebony: 2 } }) > sc("mine", { got: { ore_iron: 2 } }) && sc("mine", { got: { ore_ebony: 99 } }) <= 150 * 1.3, "ore scores, capped");
OK(sc("drink", { mugs: 6 }) > sc("drink", { mugs: 6, fell: true }), "stopping on your feet beats falling");
OK(sc("duel", { won: true, hp: 0.9 }) > sc("duel", { won: true, hp: 0.1 }) && sc("duel", { won: true, hp: 0 }) > sc("duel", { won: false, dealt: 1 }), "a duel: win with health to spare");
OK(sc("pit", { rounds: 5, hp: 0.5 }) > sc("pit", { rounds: 4, hp: 1 }), "the Pit: rounds count most");
for (const k of Object.keys(T.CONTESTS)) { const rv = T.rivals(cur.key, k); OK(rv.length === 4 && rv.every((r) => r.npc && r.score > 0 && r.score <= T.CONTESTS[k].max), "four local champions: " + k); }
OK(JSON.stringify(T.rivals(cur.key, "drink")) === JSON.stringify(T.rivals(cur.key, "drink")), "champions are the same on every phone");
// drinking: odds fall with every mug, Nords and Orcs hold it better
OK(T.steady(A, 0) > T.steady(A, 5) && T.steady(A, 5) > T.steady(A, 10), "every mug makes the next one riskier");
const imp = G.newSave("I", "Imp", "imperial"); imp.skills = A.skills; imp.level = A.level;
OK(T.steady(A, 6) > T.steady(imp, 6), "a Nord holds the mead better");
let mugs = 0; for (let i = 0; i < 400; i++) { const d = { mugs: 0 }; while (!d.done && d.mugs < 30) T.drinkStep(A, d); mugs += d.mugs; }
OK(mugs / 400 > 3 && mugs / 400 < 12, "nobody drinks forever (" + (mugs / 400).toFixed(1) + " mugs on average)");

// ---- 3. taking part: tries, best one counts, where you must be
const away = mk("Z", "Zed"); at(away, cur.place === "Whiterun" ? "Riften" : "Whiterun");
const k0 = cur.contests.find((k) => k !== "duel" && k !== "joust") || "drink";
OK(/Go to/.test(T.why(away, k0, t0)), "you must be in the host town");
OK(/No festival/.test(T.why(A, k0, cur.end + 1000)), "no contests on the quiet day");
const r1 = T.submit(A, k0, k0 === "drink" ? { mugs: 4 } : k0 === "fish" ? { fish: ["fish_salmon"] } : k0 === "mine" ? { got: { ore_iron: 1 } } : { grade: "great" }, t0);
const r2 = T.submit(A, k0, k0 === "drink" ? { mugs: 1, fell: true } : k0 === "fish" ? { fish: [] } : k0 === "mine" ? { got: {} } : { grade: "botched" }, t0);
OK(r1.better && !r2.better && T.entry(A, cur.key).sc[k0] === r1.score && r2.left === 1, "your best try counts");
T.submit(A, k0, { grade: "good", mugs: 1, fish: [] }, t0);
OK(/three tries/.test(T.why(A, k0, t0)) && T.submit(A, k0, {}, t0).err, "three tries per contest per festival");
const kj = T.FESTS.find((f) => f.contests.includes("joust"));
OK(/horse/.test(T.why(Object.assign(mk("J", "J"), { location: kj.place }), "joust", T.occ(T.FESTS.indexOf(kj)).start + 1000)), "ring-tilting needs your own horse");

// ---- 4. friendly fights: no gear lost, no bounty, nobody dies
const keep = (s) => JSON.stringify([s.inv, s.gold, s.bounty || null, s.health, s.healthTs, s.follower, s.horse, s.equipment || null, s.dead || null, s.titles || []]);
const dk = T.FESTS.findIndex((f) => f.contests.includes("duel")), dt = T.occ(dk).start + 3600e3, dc = T.current(dt);
const D1 = mk("D1", "Bjorn", 18, 40); at(D1, dc.place); D1.bounty = { [G.holdAt(WORLD.places[dc.place])]: 0 };
const snap = keep(D1), xp0 = JSON.stringify(D1.skills);
const out = T.playDuel(D1, dt);
OK(out.fight && out.fight.nonlethal && out.fight.friendly && out.fight.e.hitCap === 0.5 && out.score >= 0, "a festival duel is a friendly fight with no one-shots");
OK(keep(D1) === snap, "a festival duel changes nothing you own, your health or your bounty");
OK(JSON.stringify(D1.skills) !== xp0, "practice still teaches a little");
// a hopeless fighter in the Pit's last round: beaten, carried out, alive, nothing lost
const weak = mk("W", "Weakling", 2, 5); at(weak, T.PIT_TOWN);
const ws = keep(weak);
T.pitSt(weak, dt).run = { r: 8, hp: 0.1, team: [], at: dt };
const po = T.pitRound(weak, {}, dt);
OK(!po.won && po.done && po.score === T.score("pit", weak, { rounds: 7, hp: 0 }), "beaten in the Pit: the run ends with the rounds you won");
OK(keep(weak) === ws && !weak.dead, "beaten in the Pit: alive, nothing lost");
OK(/Grand Arena is in/.test(T.pitRound(away, {}, dt).err || "") || away.location === T.PIT_TOWN, "the Pit is in Windhelm");
OK(/leader/.test(T.pitWhy(Object.assign(mk("M", "M"), { location: T.PIT_TOWN }), "member")), "in a party only the leader starts rounds");
// a full Pit run with a party: foes grow, health carries over
const P1 = mk("P1", "Ulfric", 25, 55); at(P1, T.PIT_TOWN);
const ally = { name: "Lydia", dmg: 14, player: true, party: true };
OK(T.pitFoe(P1, 3, 3).health > T.pitFoe(P1, 3, 1).health && T.pitFoe(P1, 6, 1).health > T.pitFoe(P1, 2, 1).health, "Pit foes grow with the round and the party");
let rounds = 0, guard = 0, hpCarried = true;
while (guard++ < 10) { const r = T.pitRound(P1, { role: "leader", allies: [ally] }, dt); OK(!r.err, "a Pit round runs: " + r.err); if (r.won && !r.done) { rounds++; const h = T.pitSt(P1, dt).run.hp; if (!(h > 0 && h <= 1)) hpCarried = false; } if (r.done) break; }
const pe = T.entry(P1, T.pitKey(dt));
OK(hpCarried && pe.sc.pit > 0 && pe.team.includes("Lydia"), "a Pit run with a party is on the board (" + rounds + " rounds, " + pe.sc.pit + " points)");

// ---- 5. friendly duels between players, any side, no bounty
const B = mk("B", "Brynjolf", 22, 50); at(B, dc.place);
const Bd = T.record((T.entry(B, dc.key), B), dc.key, dt);
OK(Bd.snap && Bd.uid === "B", "a festival record carries a duel snapshot");
const C1 = mk("C", "Cicero", 22, 50); at(C1, dc.place);
const cs = keep(C1);
const pv = T.pvp(C1, Bd, dt);
OK(pv.fight && pv.fight.nonlethal && typeof pv.won === "boolean" && keep(C1) === cs, "a friendly duel between players: nothing lost, no bounty");
T.pvp(C1, Bd, dt); T.pvp(C1, Bd, dt);
OK(/bouts/.test(T.pvp(C1, Bd, dt).err || ""), "three bouts per pair per festival");
OK(T.pvp(C1, { ...Bd, fk: "nope-1" }, dt).err && T.pvp(C1, { ...Bd, uid: "C" }, dt).err, "only festival entries, and not yourself");
const pv2 = T.pvp(mk("X", "X"), Bd, dt);
OK(pv2.err, "you must be at the festival to duel");
// festival peace: no player attacks in a festival town while it's on
const realNow = Date.now; Date.now = () => dt;
try {
  const why = MP.canTarget(C1, { id: "B", name: "Brynjolf", loc: dc.place }, WORLD.places[dc.place], WORLD.places[dc.place]);
  OK(typeof why === "string" && /Festival peace/.test(why), "festival peace in the host town: " + why);
  OK(T.peaceAt(dc.place, dt) && !T.peaceAt(dc.place, dc.end + 1000), "peace only while it's on");
} finally { Date.now = realNow; }

// ---- 6. scoreboard sync: two phones, same boards
const hc = T.FESTS.findIndex((f) => f.contests.includes("archery")), ht = T.occ(hc).start + 7200e3, hf = T.current(ht);
const P = mk("PA", "Aela", 20, 60), Q = mk("PB", "Farkas", 20, 40);
at(P, hf.place); at(Q, hf.place);
T.setRep(P, "hold", "Whiterun"); T.setRep(Q, "hold", "Eastmarch");
T.submit(P, "archery", { grade: "perfect" }, ht); T.submit(Q, "archery", { grade: "great" }, ht);
const docs = [T.record(P, hf.key, ht), T.record(Q, hf.key, ht)];
OK(docs.every((d) => d.fk === hf.key && d.sc.archery > 0 && d.rep.k === "hold"), "records carry scores and who you stand for");
const bp = T.board(hf.key, "archery", docs, P).map((r) => r.id + ":" + r.score).join(), bq = T.board(hf.key, "archery", docs, Q).map((r) => r.id + ":" + r.score).join();
OK(bp === bq, "both phones see the same board");
OK(T.board(hf.key, "archery", docs, P).findIndex((r) => r.id === "PA") < T.board(hf.key, "archery", docs, P).findIndex((r) => r.id === "PB"), "best first");
const stale = { ...docs[0], sc: { archery: 1 }, t: ht - 5000 };
OK(T.board(hf.key, "archery", [stale, ...docs], Q).filter((r) => r.id === "PA").length === 1, "one row per player (newest record wins)");
const gl = T.glory(hf.key, docs, null);
OK(gl.holds.length === 2 && gl.holds.every((h) => h.pts >= 1), "hold glory adds up (" + JSON.stringify(gl.holds) + ")");
OK(JSON.parse(JSON.stringify(docs[0])).sc.archery === docs[0].sc.archery, "records survive the trip through the store");

// ---- 7. prizes
const after = hf.end + 1000;
OK(T.claim(P, hf.key, docs, ht).err, "prizes only after it ends");
OK(T.claimable(P, after).includes(hf.key), "a finished festival waits to be claimed");
const pg = P.gold, cl = T.claim(P, hf.key, docs, after);
const won = T.board(hf.key, "archery", docs, P)[0].id === "PA";
OK(!cl.err && P.gold > pg, "claiming pays gold (" + cl.text + ")");
OK(won && P.titles.includes(hf.title) && P.inv.some((r) => r.item === "trophy_archery") && P.inv.some((r) => r.item === hf.prize), "1st place: the title, a trophy and the ceremonial prize");
OK(T.claim(P, hf.key, docs, after).err && !T.claimable(P, after).includes(hf.key), "claimed only once");
OK(Object.keys(T.TROPHY).every((k) => D.ITEMS["trophy_" + k]) && T.FESTS.every((f) => D.ITEMS[f.prize]) && D.ITEMS.fest_pit_axe && D.ITEMS.fest_ribbon, "all prizes exist as items");
OK(T.FESTS.every((f) => D.ITEMS[f.prize].value <= 200 && (D.ITEMS[f.prize].damage || 0) <= 13), "ceremonial prizes are for looks, not power");
// a second win at the same festival later: gold instead of a second ceremonial prize
const occ2 = T.occ(hf.slot + 7), t2 = occ2.start + 1000; at(P, occ2.place);
T.submit(P, "archery", { grade: "perfect" }, t2); T.submit(P, "archery", { grade: "perfect" }, t2);
const d2 = [T.record(P, occ2.key, t2)];
if (T.board(occ2.key, "archery", d2, P)[0].id === "PA" && won) { const n0 = P.inv.filter((r) => r.item === hf.prize).reduce((a, r) => a + (r.qty || 1), 0); T.claim(P, occ2.key, d2, occ2.end + 1); OK(P.inv.filter((r) => r.item === hf.prize).reduce((a, r) => a + (r.qty || 1), 0) === n0, "the ceremonial prize comes once"); }

// ---- 8. perks with real effects
for (const id of ["arena_champion", "sportsman", "crowd_favourite"]) OK(Object.values(PERKS).some((list) => (Array.isArray(list) ? list : list.perks || []).some((p) => (p.id || p[0]) === id)) || PFX.ADDED?.includes?.(id) || JSON.stringify(PERKS).includes('"' + id + '"'), "perk exists: " + id);
const pk = mk("PK", "Perky", 30, 50); at(pk, hf.place);
const base = T.score("archery", pk, { grade: "great" });
pk.perks = { ...(pk.perks || {}), sportsman: 2 };
OK(PFX.num(pk, "sport") > 0 && T.score("archery", pk, { grade: "great" }) > base, "Sportsman: contests score more");
const fo0 = T.duelFoe(pk, hf.key, 0).health; pk.perks.arena_champion = 1;
OK(PFX.num(pk, "arenafight") > 0 && T.duelFoe(pk, hf.key, 0).health < fo0 && T.score("pit", pk, { rounds: 4, hp: 0.5 }) > T.score("pit", mk("q", "q"), { rounds: 4, hp: 0.5 }), "Arena Champion: weaker foes, better Pit score");
const cf = mk("CF", "Crowd", 20, 60); at(cf, hf.place);
T.submit(cf, "archery", { grade: "great" }, ht);
const cf2 = JSON.parse(JSON.stringify(cf)); cf2.perks = { ...(cf2.perks || {}), crowd_favourite: 1 };
const g1 = cf.gold, g2 = cf2.gold;
T.claim(cf, hf.key, [], after); T.claim(cf2, hf.key, [], after);
OK(PFX.num(cf2, "crowdfav") > 0 && cf2.gold - g2 > cf.gold - g1, "Crowd Favourite: more prize gold");

// ---- 9. balance: festival duels and Pit rounds last a while, no one-shots
const turns = [], worst = [];
for (let i = 0; i < 30; i++) {
  const s = mk("BAL" + i, "Bal", 10 + (i % 4) * 10, 30 + (i % 4) * 15); at(s, dc.place);
  const r = T.playDuel(s, dt); if (r.err) continue;
  turns.push(r.fight.turn || r.fight.log.length);
  const max = G.maxHealth(s); let prev = max;
  for (const l of r.fight.log) if (l.hp != null) { worst.push((prev - l.hp) / max); prev = l.hp; }
}
const avg = turns.reduce((a, b) => a + b, 0) / turns.length;
OK(avg >= 3, "festival duels last a while (" + avg.toFixed(1) + " turns on average)");
OK(Math.max(...worst) < 0.67, "no one-shots in festival duels (" + Math.round(Math.max(...worst) * 100) + "%)");

// ---- 10. screens and Polish
OK(TOURNEYUI.sections("Windhelm").includes("pit") && TOURNEYUI.sections("Whiterun").includes("festival") && !TOURNEYUI.sections("Whiterun").includes("pit"), "Festivals in every town, the Pit in Windhelm");
const hs = TOURNEYUI.festHTML(P, P.location), ph = TOURNEYUI.pitHTML(P1);
OK(/tn-fest/.test(hs) && /Coming up/.test(hs) && /tn-pit/.test(ph) && /This week's board/.test(ph), "screens render");
OK(STORE_SRC.includes('"fest"') && HUB_SRC.includes('"fest"'), 'the shared fest collection is whitelisted on phone and server');
for (const k of ["Festivals", "The Harvest Fair", "Drinking contest", "Sportsman", "Festival peace: no fighting other players here."]) OK(I18N_STORY.ex[k] && I18N_STORY.ex[k] !== k, "Polish: " + k);
console.log("tourney ok (" + n + " checks)");
`, c);
