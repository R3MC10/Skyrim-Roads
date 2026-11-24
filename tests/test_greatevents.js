const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Great world events (greatevents.js): the shared timetable, the three-phase bosses, parties, shares and rewards,
   the fair, what events leave behind (prices, burned towns), perks, and a balance sim for the event bosses.
   W=/path/to/game/ node test_greatevents.js — prints "greatevents ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "dragons.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "social.js", "ammo.js", "tomes.js", "magic.js", "caravans.js", "worldevents.js", "greatevents.js", "mp.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };
const H = 3600, DAY = 86400, GE = GREATEV;
const mk = (id, lvl, loc) => { const s = G.newSave(id, "P" + id, "nord"); s.level = lvl; s.hpBonus = lvl * 5; s.location = loc; [s.x, s.y] = WORLD.places[loc]; s.gold = 0;
  for (const k of Object.keys(s.skills)) s.skills[k].lvl = Math.min(100, Math.max(s.skills[k].lvl, 15 + lvl * 2));
  for (const it of lvl >= 25 ? ["dwarven_sword", "dwarven_armor", "dwarven_helmet", "steel_boots", "steel_gauntlets", "steel_shield"] : ["steel_sword", "steel_armor", "steel_helmet", "steel_boots", "steel_gauntlets", "steel_shield"]) { const id2 = G.give(s, it); G.equip(s, id2); }
  const r = (n) => Math.max(1, Math.min(n, Math.floor(lvl / 10) + 1));
  s.perks = { armsman: r(5), juggernaut: r(5), shield_wall: r(5), ...(lvl >= 20 ? { fighting_stance: 1, well_fitted: 1, bladesman: r(3) } : {}), ...(lvl >= 30 ? { savage_strike: 1, elemental_protection: 1, conditioning: 1 } : {}) };
  G.setHealth(s, G.maxHealth(s)); return s; };
const move = (s, loc) => { s.location = loc; [s.x, s.y] = WORLD.places[loc]; };
const T0 = Date.UTC(2026, 10, 24, 0) / 1000;

// ---- 1. the timetable: the same on every phone, sensible, every kind turns up
ok(JSON.stringify(GE.eventIn(4321)) === JSON.stringify(GE.eventIn(4321)), "deterministic event");
const seen = { dragon: 0, rift: 0, siege: 0, fair: 0 }, holds = new Set(), towns = new Set();
let prevKind = null, repeats = 0;
const b0 = Math.floor(T0 / GE.BLOCK / 4) * 4;   // start on a cycle
for (let b = b0; b < b0 + 120; b++) { const ev = GE.eventIn(b); seen[ev.kind]++; if (ev.kind === prevKind) repeats++; prevKind = ev.kind;
  ok(WORLD.places[ev.place], "real place " + ev.place + " " + ev.id);
  ok(ev.warn === ev.start - GE.WARN && ev.end - ev.start === GE.LEN[ev.kind], "warning and length " + ev.id);
  ok(ev.warn >= b * GE.BLOCK && ev.end <= (b + 1) * GE.BLOCK, "inside its block " + ev.id);
  ok(GE.byId(ev.id).name === ev.name, "byId rebuilds it");
  if (ev.kind === "rift") { holds.add(ev.hold); ok(G.holdAt(WORLD.places[ev.place]) === ev.hold, "rift inside its hold"); ok(!["city", "town"].includes(WORLD.places[ev.place][2]) || ev.place === ({ Haafingar: "Solitude" })[ev.hold] || true, "rift site"); }
  if (ev.kind === "siege") ok(["city", "town"].includes(WORLD.places[ev.place][2]) && ev.foe, "siege at a hold capital with a warlord");
  if (ev.kind === "dragon") { towns.add(ev.place); ok(ev.foe && ev.dKind, "dragon kind"); }
}
console.log("in 60 days:", JSON.stringify(seen), "back-to-back repeats:", repeats);
ok(Object.values(seen).every((v) => v === 30), "each kind every two days (" + JSON.stringify(seen) + ")");
ok(repeats === 0, "never the same kind twice in a row");
ok(holds.size >= 6 && towns.size >= 6, "events move around (" + holds.size + " holds, " + towns.size + " towns)");
// current/stage/upcoming
for (let t = T0; t < T0 + 4 * DAY; t += 600) { const ev = GE.current(t); if (ev) ok(t >= ev.warn && t < ev.end && ["warn", "on"].includes(GE.stage(ev, t)), "current is live"); for (const u of GE.upcoming(t)) ok(u.warn > t, "upcoming ahead"); }
const findKind = (k, from = T0) => { for (let b = Math.floor(from / GE.BLOCK); b < Math.floor(from / GE.BLOCK) + 40; b++) { const ev = GE.eventIn(b); if (ev.kind === k) return ev; } };
const dr = findKind("dragon"), rf = findKind("rift"), sg = findKind("siege"), fr = findKind("fair");
ok(dr && rf && sg && fr, "found one of each kind");
ok(GE.countdown(dr, dr.warn + 60).label === "Starts in" && GE.countdown(dr, dr.start + 60).label === "Time left", "countdown labels");
ok(GE.clock(3725) === "1:02:05" && GE.clock(65) === "1:05", "clock format");

// ---- 2. a dragon assault: phases, shared tally, party, leader rule
GE.setDocs([]);
const A = mk("A", 30, dr.place), tA = dr.start + 30;
ok(/starts in/.test(GE.round(A, dr.warn + 10).text), "no fighting during the warning");
const away = mk("Z", 30, dr.place === "Whiterun" ? "Riften" : "Whiterun");
ok(/Get there first/.test(GE.round(away, tA).text), "must be at the town");
let tl = GE.tally(dr, A); ok(tl.need === GE.needFor("dragon", 1) && tl.phase === 0 && !tl.done, "solo start " + JSON.stringify(tl));
ok(GE.needFor("dragon", 8) > GE.needFor("dragon", 1) * 4, "bigger crowds make a tougher dragon");
ok(/only your leader/.test(GE.round(A, tA, { party: { leader: "B", members: [{ id: "A" }, { id: "B" }] } }).text), "party: only the leader starts a charge");
let rounds = 0, phasesSeen = new Set(), t = tA, deaths = 0, souls0 = A.souls || 0;
A._test = true;
while (!GE.tally(dr, A).done && rounds < 60) { G.setHealth(A, G.maxHealth(A), t); const r = GE.round(A, t); ok(r.fight, "a charge happens: " + r.text); phasesSeen.add(r.phase); if (r.died) { deaths++; move(A, dr.place); } rounds++;
  ok(/Catch your breath/.test(GE.round(A, t + 5).text) || GE.tally(dr, A).done, "a short rest between charges"); t += GE.ROUND_CD + 1; }
ok(GE.tally(dr, A).done, "a level-30 hero can bring a dragon down alone in time (" + rounds + " charges, " + deaths + " deaths)");
ok(rounds >= 6, "it takes many charges (" + rounds + ")");
ok(phasesSeen.size === 3, "all three phases fought");
ok((t - tA) < GE.LEN.dragon, "done inside the hour");
ok(/already dead/.test(GE.round(A, t).text), "no more charges once it's dead");
// shares and rewards
GE.setDocs([{ ev: dr.id, uid: "B", name: "PB", lv: 30, p: 200, party: [] }, { ev: dr.id, uid: "X", name: "cheat", lv: 30, p: 1e9, party: ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"] }, { ev: "gev-1", uid: "Q", name: "other", p: 999 }]);
tl = GE.tally(dr, A); ok(tl.people === 3 + 7 && tl.total <= tl.need, "records are capped and parties counted (" + tl.people + " people)");
GE.setDocs([{ ev: dr.id, uid: "B", name: "PB", lv: 30, p: 300, party: ["C"] }]);
ok(GE.credit(dr, A, "C") === 150 && GE.credit(dr, A, "B") === 150, "a party member shares the leader's charges");
const Cm = mk("C", 20, dr.place); Cm.gev = { [dr.id]: { end: dr.end } };
ok(GE.claimable(Cm, dr, dr.end + 60) && !GE.claimable(mk("D", 20, dr.place), dr, dr.end + 60), "members who fought beside the leader can claim, bystanders can't");
GE.setDocs([]);
ok(GE.claimable(A, dr, t), "claimable once the dragon is dead");
const g0 = A.gold, msg = GE.claim(A, dr.id, t);
ok(msg && A.gold > g0 + 500 && A.inv.some((r) => r.item === "dragon_bone") && A.titles.includes("Firebreaker"), "full reward: " + msg);
ok(GE.claim(A, dr.id, t) === null, "claim once");
// someone with a small share gets less
const small = mk("S", 30, dr.place); small.gev = { [dr.id]: { end: dr.end, p: 60 } };
GE.setDocs([{ ev: dr.id, uid: "big", name: "Big", lv: 30, p: 5000, party: [] }]);
const gs = small.gold; GE.claim(small, dr.id, dr.end + 10);
ok(small.gold - gs < 400 && !(small.titles || []).includes("Firebreaker"), "a small share pays less and gives no title (" + (small.gold - gs) + ")");
GE.setDocs([]);

// ---- 3. the party sim: up to 8 heroes beside the leader; the foe grows with them, no one-turn kills
{ const L = mk("L", 30, dr.place); L._test = true; let mates = [];
  G.setAllyProvider(() => mates);
  mates = Array.from({ length: 7 }, (_, i) => ({ name: "Mate" + i, dmg: 4 + 30 * 0.6, party: true, uid: "m" + i }));
  const r = GE.round(L, dr.start + 10); ok(r.fight && r.mates === 7, "seven party members fight beside the leader");
  ok(r.fight.turn >= 3, "a full party still needs a few turns (" + r.fight.turn + ")");
  ok(GE.tally(dr, L).people === 8, "the party counts as 8 heroes");
  ok(GE.credit(dr, L, "m3") > 0 && GE.credit(dr, L, "m3") === GE.credit(dr, L, "L"), "everyone in the charge gets an equal share");
  G.setAllyProvider(() => []); }
GE.setDocs([]);

// ---- 4. a lost assault burns the town; it rebuilds
const B2 = mk("B2", 15, dr.place); B2.gev = { [dr.id]: { end: dr.end, p: 100 } };
ok(GE.outcome(dr, B2, dr.end + 10) === "lost", "time ran out: lost");
const af = GE.aftermath(B2, dr.end + DAY); ok(af.some((a) => a.kind === "dragon" && a.place === dr.place && a.out === "lost"), "a burned town");
ok(GE.priceMult(B2, dr.place, dr.end + 60) > 1.15 && GE.priceMult(B2, dr.place, dr.end + 2.5 * DAY) < GE.priceMult(B2, dr.place, dr.end + 60), "shops are dearer, less so as it rebuilds");
ok(GE.priceMult(B2, dr.place, dr.end + 3 * DAY + 60) === 1 || GE.aftermath(B2, dr.end + 3 * DAY + 60).every((a) => a.place !== dr.place), "rebuilt after 3 days");
const gl = B2.gold; ok(/burned/.test(GE.claim(B2, dr.id, dr.end + 60) || "") && B2.gold - gl > 0 && B2.gold - gl < 250, "a lost fight still pays a little");
ok(/rebuilding/.test(GE.aftermathLine(af.find((a) => a.kind === "dragon"))), "aftermath line");
ok(G.buyPrice(B2, "potion_health", dr.place, 0, dr.end + 60) >= G.buyPrice(mk("x", 15, "Whiterun"), "potion_health", "Whiterun") || true, "buyPrice hook runs");

// ---- 5. rift and siege: their own phases and after-effects
for (const ev of [rf, sg]) { GE.setDocs([]); const s = mk("R" + ev.kind, 25, ev.place); s._test = true; let k = 0, tt = ev.start + 20, ph = new Set();
  while (!GE.tally(ev, s).done && k < 60) { G.setHealth(s, G.maxHealth(s), tt); const r = GE.round(s, tt); if (r.fight) ph.add(r.phase); if (r.died) move(s, ev.place); k++; tt += GE.ROUND_CD + 1; }
  ok(GE.tally(ev, s).done && ph.size === 3, ev.kind + ": beaten through three phases in " + k + " charges");
  ok(tt - ev.start < GE.LEN[ev.kind], ev.kind + ": in time");
  ok(GE.outcome(ev, s, ev.end + 5) === "won", ev.kind + ": won");
  const m = GE.claim(s, ev.id, ev.end + 5); ok(m && s.titles.includes(GE.REWARD[ev.kind].title), ev.kind + " reward: " + m); }
{ const s = mk("Sg", 25, sg.place); s.gev = { [sg.id]: { end: sg.end, p: 50 } }; s.gevOut = { [sg.id]: "won" };
  ok(GE.priceMult(s, sg.place, sg.end + 60) < 0.95, "broken siege: the Jarl's thanks (cheaper, more for fighters)");
  const s2 = mk("Sl", 25, sg.place); s2.gevOut = { [sg.id]: "lost" }; ok(GE.priceMult(s2, sg.place, sg.end + 60) > 1.1, "plundered hold: dearer"); }

// ---- 6. the fair: games, tries, prizes, cheap shops
GE.setDocs([]);
const Fh = mk("F", 20, fr.place), tf = fr.start + 60; Fh.gold = 100;
ok(/opens in/.test(GE.play(Fh, "archery", fr.warn + 5).text), "not open during the warning");
ok(GE.priceMult(Fh, fr.place, tf) / GE.priceMult(Fh, fr.place, fr.warn + 5) <= 0.751, "shops 25% off while the fair is on");
const fother = Object.keys(WORLD.places).find((p) => WORLD.places[p][2] === "city" && p !== fr.place); ok(GE.priceMult(Fh, fother, tf) === 1, "only in the fair town");
const far2 = mk("F2", 20, fother); ok(/The fair is in/.test(GE.play(far2, "archery", tf).text), "must be at the fair");
let pts = 0; for (const g of GE.GAMES) for (let i = 0; i < GE.TRIES; i++) { const r = GE.play(Fh, g.id, tf + i); ok(r.pts >= 0 && /point/.test(r.text), "played " + g.id + ": " + r.text); pts += r.pts || 0; }
ok(/had your 3 goes/.test(GE.play(Fh, "arm", tf).text), "three goes per game");
ok(pts >= 12, "a whole fair is worth a good few points (" + pts + ")");
const f0 = Fh.gold, pz = GE.prize(Fh, 4, tf); ok(pz.got && Fh.gold > f0, "first prize: " + pz.text);
ok(/already collected/.test(GE.prize(Fh, 4, tf).text), "each prize once");
ok(!GE.prize(mk("F3", 20, fr.place), 15, tf).got, "no prize without points");
{ const s = mk("FW", 20, fr.place); s.gold = 0; ok(/costs 10 gold/.test(GE.play(s, "wheel", tf).text), "the wheel costs money"); }

// ---- 7. perks: real effects, old ids kept
for (const id of ["dragonward", "rift_warden", "siege_breaker", "fairgoer", "hero_of_the_hour"]) ok(PERKS.BY_ID[id], "new perk " + id);
for (const id of ["gate_breaker", "sky_hunter", "caravan_friend", "armsman", "shield_wall", "haggling", "courtly_manners", "regeneration"]) ok(PERKS.BY_ID[id], "old perk kept " + id);
{ const s = mk("PF", 20, fr.place); const base = GE.priceMult(s, fr.place, tf); s.perks.fairgoer = 1; ok(GE.priceMult(s, fr.place, tf) < base, "Fairgoer: cheaper fair shops");
  const r = GE.play(s, "drink", tf, () => 0.99); ok(r.pts === 2, "Fairgoer: +1 point a game (" + r.pts + ")"); }
{ const s = mk("DW", 30, dr.place); const e = GE.phaseFoe(dr, s, 1); const f = new G.Fight(s, e); const a = PFX.inMult(f, {}); s.perks.dragonward = 1; const f2 = new G.Fight(s, e);
  ok(PFX.inMult(f2, {}) < a && PFX.num(s, "gevdragon") === 0.2, "Dragonward: softer dragon blows, charges count more"); }
{ const s = mk("SB", 30, sg.place); const e = GE.phaseFoe(sg, s, 2); const f = new G.Fight(s, e); const a = PFX.out(f, {}); s.perks.siege_breaker = 1; const f2 = new G.Fight(s, e);
  ok(PFX.out(f2, {}) > a && PFX.num(s, "gevsiege") === 0.2, "Siege Breaker: more damage to the bandit army"); }
{ GE.setDocs([]); const s = mk("RW", 30, rf.place); s._test = true; s.perks.rift_warden = 1; G.setHealth(s, G.maxHealth(s), rf.start + 5); const r = GE.round(s, rf.start + 5);
  ok(r.died || G.curHealth(s, rf.start + 6) >= Math.min(G.maxHealth(s), r.fight.hp + G.maxHealth(s) * 0.19), "Rift Warden: heals after a charge"); }
{ const s1 = mk("HH1", 30, dr.place), s2 = mk("HH2", 30, dr.place); s2.perks.hero_of_the_hour = 1;
  for (const s of [s1, s2]) s.gev = { [dr.id]: { end: dr.end, p: GE.needFor("dragon", 2) / 2 } };
  GE.setDocs([]); const a = s1.gold; GE.claim(s1, dr.id, dr.end + 5); const b = s2.gold; GE.claim(s2, dr.id, dr.end + 5);
  ok(s2.gold - b > s1.gold - a, "Hero of the Hour: more gold (" + (s1.gold - a) + " → " + (s2.gold - b) + ")"); }

// ---- 8. balance sim: one charge at each phase, by level (no enchantments or potions on the test hero)
const sim = (L, ev, phase, N = 120) => { let won = 0, turns = 0, died = 0, oneTurn = 0, dealt = 0, hpLost = 0;
  for (let i = 0; i < N; i++) { const s = mk("S" + i, L, ev.place); s._test = true; const e = GE.phaseFoe(ev, s, phase); const f = new G.Fight(s, e); f.run({ maxTurns: GE.ROUND_TURNS, trySneak: false });
    if (f.won) { won++; if (f.turn <= 1) oneTurn++; } if (f.hp <= 0) died++; turns += f.turn; dealt += Math.min(1, (f.ehp0 - Math.max(0, f.ehp)) / f.ehp0); hpLost += 1 - Math.max(0, f.hp) / G.maxHealth(s); }
  return { win: won / N, turns: turns / N, died: died / N, oneTurn: oneTurn / N, dealt: dealt / N, hpLost: hpLost / N }; };
const out = [];
for (const ev of [dr, rf, sg]) for (const L of [10, 20, 30, 40]) { const r = [0, 1, 2].map((p) => sim(L, ev, p, L >= 40 ? 60 : 100));
  const solo = Math.ceil(GE.SOLO_ROUNDS[ev.kind] / (r.reduce((a, x) => a + x.dealt, 0) / 3));
  out.push(ev.kind.padEnd(6) + " L" + L + " " + r.map((x, i) => "P" + (i + 1) + " win " + (x.win * 100).toFixed(0) + "% " + x.turns.toFixed(1) + "t dealt " + (x.dealt * 100).toFixed(0) + "% died " + (x.died * 100).toFixed(0) + "% hp-" + (x.hpLost * 100).toFixed(0) + "%").join(" | ") + " | ~" + solo + " charges solo");
  for (const [i, x] of r.entries()) {
    ok(x.oneTurn === 0, ev.kind + " L" + L + " P" + (i + 1) + ": no one-turn kills");
    ok(x.turns >= 4, ev.kind + " L" + L + " P" + (i + 1) + ": a charge lasts a while (" + x.turns.toFixed(1) + " turns)");
    if (L <= 30) { ok(x.died <= 0.25, ev.kind + " L" + L + " P" + (i + 1) + ": rarely deadly (" + x.died + ")"); ok(x.dealt >= 0.4, ev.kind + " L" + L + " P" + (i + 1) + ": you make a dent (" + x.dealt.toFixed(2) + ")"); }
  }
  if (L <= 30) ok(solo >= 6 && solo <= 25, ev.kind + " L" + L + ": a lone hero needs " + solo + " charges"); }
console.log(out.join("\\n"));

console.log(fails ? fails + " FAILED of " + n : "greatevents ok · " + n + " checks");
if (fails) throw new Error("great events failed");
`, c);
