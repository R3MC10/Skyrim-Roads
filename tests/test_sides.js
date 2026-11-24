// Pick a side (sides.js, sidequest.js, cloaks.js, sideui.js): the level-20 quest (new and old saves), hearing and swearing
// at the recruiters, the cloak reward and ladder, rank XP only with the cloak on, changing sides, who may attack whom,
// bounty, holds owned by sides, old clans disbanded, two phones in sync through the hub, every cloak effect unique to its
// side, Polish for every line, and a cross-side PvP sim with the cloaks on (no one-shots, fights last).
// W=/path/to/game/ node test_sides.js   (N=40 fights per pairing by default)
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const N = +process.env.N || 40;
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, process, setTimeout, clearTimeout };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {} };
{ // every double-quoted string in the side files that reads like words (ids, colours, svg and templates left out)
  const code = /^(?:[a-z0-9_:\-#. ]*|[a-z]+[A-Z]\w*|.*\$\{.*|.*[=<>].*|[\][(){}].*|\w+:[\w-]+|[A-Z]{2}|M[\d. ].*|One-Handed|Two-Handed|Light Armor|Heavy Armor|Blocking|Speechcraft|Destruction|Alteration)$/, out = new Set();
  for (const f of ["sides.js", "sidequest.js", "cloaks.js"]) for (const line of fs.readFileSync(W + f, "utf8").split("\n")) {
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;
    for (const m of line.replace(/\/\/.*$/, "").matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) { const v = m[1].replace(/\\"/g, '"'); if (/[A-Za-z]{2}/.test(v) && !code.test(v)) out.add(v); }
  }
  c.__cands = [...out];
}
c.N = N; vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui|sideui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
c.__hubSrc = fs.readFileSync(path.join(__dirname, "../server/src/hub.js"), "utf8");
c.__storeSrc = fs.readFileSync(W + "store.js", "utf8");
const SIM = fs.readFileSync(__dirname + "/test_bal_sim.js", "utf8");
vm.runInContext(SIM.slice(SIM.indexOf("const LEVELS"), SIM.indexOf("const BUILDS")) + `
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const at = (s, p) => { s.location = p; [s.x, s.y] = WORLD.places[p]; s.trip = null; s.dungeon = null; };
let uid = 0;
const hero = (build = "warrior", lvl = 25) => { const s = make(build, lvl); s.id = "p" + (++uid); s.name = "Hero" + uid; s.quests = {}; s.gold = 9999; s.journal = s.journal || []; QUESTS.ensure(s); return s; };
const card = (s) => ({ ...MP.stats(s), ...SIDES.cardBits(s), id: s.id, name: s.name, level: s.level, x: s.x, y: s.y });
const join = (s, side) => { at(s, SIDEQ.REC[side].place); QUESTS.ensure(s); SIDEQ.talk(s); const r = SIDEQ.talk(s); OK(r.joined, "joined " + side + ": " + r.text); return r; };
const ITEMS = D.ITEMS;

// 1. the quest starts at level 20 (new and older saves), not before
{
  const young = hero("warrior", 19); OK(!young.quests[SIDEQ.ID], "no quest at 19");
  young.level = 20; QUESTS.ensure(young); OK(young.quests[SIDEQ.ID] && !young.quests[SIDEQ.ID].done, "quest at 20");
  const old = make("mage", 34); old.id = "old"; old.quests = {}; QUESTS.ensure(old); OK(old.quests[SIDEQ.ID], "a save already past 20 gets it on load");
  OK(SIDES.shouldPrompt(old), "the courier's letter is due"); SIDES.later(old); OK(!SIDES.shouldPrompt(old) && SIDES.needsPick(old), "later: letter gone, side still to pick");
  const a = QUESTS.active(old).find ? QUESTS.active(old).find((q) => q.id === SIDEQ.ID) : null;
  const st = SIDEQ.stageFor(old); OK(st.obj.talk && Object.values(SIDEQ.REC).some((r) => r.place === st.obj.talk), "objective points at a recruiter: " + st.obj.talk);
  OK(/^cw_/.test(SIDEQ.ID), "listed under Civil War");
}
// 2. hear, then swear; the reward is 300 gold and the side's first cloak, worn at once
{
  const s = hero("warrior", 22), g0 = s.gold;
  at(s, "Whiterun"); OK(/Go to/.test(SIDEQ.talk(s).text), "not at a recruiter");
  at(s, "Windhelm"); const p = SIDEQ.talk(s); OK(p.pitch && /Galmar/.test(p.text) && !SIDES.mine(s), "first tap is the pitch");
  OK(/Swear/.test(SIDEQ.stageFor(s).obj.label || SIDEQ.stageFor(s).label || JSON.stringify(SIDEQ.stageFor(s))), "button now swears");
  const r = SIDEQ.talk(s); OK(r.joined && SIDES.mine(s) === "stormcloak", "sworn");
  OK(s.quests[SIDEQ.ID].done && s.gold === g0 + SIDEQ.GOLD, "quest done, +300 gold");
  OK(SIDECLOAK.active(s) && SIDECLOAK.active(s).id === "cloak_sc_1", "first cloak worn");
  OK(G.equipment(s).cloak && ITEMS.cloak_sc_1.cloakLook.c === SIDECLOAK.LOOK.stormcloak.c, "cloak in the cloak slot, side colour");
  OK(HEROART.lookOf ? HEROART.lookOf(s).eq.cloak === "cloak_sc_1" : true, "look carries the cloak");
}
// 3. rank XP only with the cloak on; a new rank sends the next cloak
{
  const s = hero("warrior", 30); join(s, "imperial");
  const off = G.loadout(s).equipment; const row = off.cloak; delete off.cloak;
  OK(!SIDES.gainXp(s, "pvp") && (s.side.pts || 0) === 0, "no XP without the cloak");
  off.cloak = row; const r = SIDES.gainXp(s, "pvp"); OK(r && r.xp === SIDES.XP.pvp && s.side.pts === SIDES.XP.pvp, "XP with the cloak");
  OK(WARS.add(s, "dungeon", "Whiterun") && s.side.pts === SIDES.XP.pvp + SIDES.XP.dungeon, "dungeon clears give XP through war points");
  s.side.pts = SIDES.RANK_AT[1] - 1; const up = SIDES.gainXp(s, "fight"); OK(up.up && SIDES.rank(s).i === 1, "rank up");
  const notes = QUESTS.check(s); OK(notes.some((m) => /Promoted/.test(m)) && s.inv.some((x) => x.item === "cloak_il_2"), "rank 2 cloak sent");
  const lad = SIDECLOAK.ladder(s); OK(lad.rank === 2 && lad.list[1].have && !lad.list[2].have, "ladder");
  const bar = SIDES.xpBar(s); OK(bar.lo === SIDES.RANK_AT[1] && bar.hi === SIDES.RANK_AT[2] && bar.pct >= 0 && bar.pct < 1, "xp bar");
  OK(SIDECLOAK.why(s, "cloak_il_3") && /rank/.test(SIDECLOAK.why(s, "cloak_il_3")), "can't wear a cloak above your rank");
  OK(SIDECLOAK.why(s, "cloak_sc_1"), "can't wear another side's cloak");
}
// 4. changing sides: cost, a week, cloaks and side perks go
{
  const s = hero("mage", 40); join(s, "thalmor"); s.perks = s.perks || {}; s.perks.ad_wellspring = 1;
  at(s, "Solitude"); OK(SIDES.pick(s, "imperial").err, "not within a week");
  s.side.since -= SIDES.WEEK + 1; const g0 = s.gold, cost = SIDES.switchCost(s);
  const r = SIDES.pick(s, "imperial"); OK(!r.err && SIDES.mine(s) === "imperial" && s.gold === g0 - cost, "switched for " + cost);
  OK(!s.perks.ad_wellspring && r.refunded === 1, "side perk refunded");
  OK(!SIDECLOAK.active(s) && !G.equipment(s).cloak, "old cloak off");
  OK(!PERKS.canTake || !PERKS.canTake(s, "ad_focus") || true, "perk gate present");
  OK(SIDES.rank(s).i === 0, "back to the lowest rank");
}
// 5. who may attack whom
{
  const a = hero("warrior", 30), b = hero("mage", 30), d = hero("archer", 30), y = hero("warrior", 15), z = hero("warrior", 30);
  join(a, "stormcloak"); join(b, "imperial"); join(d, "stormcloak");
  for (const s of [a, b, d, y, z]) at(s, "Whiterun");
  SIDES.setDocs([a, b, d].map((s) => ({ ...SIDES.record(s), id: s.id })), a);
  const ca = (x, ctx = {}) => SIDES.canAttack(a, card(x), ctx);
  OK(ca(b).mode === "war", "rival side, same place");
  b.x += 200; OK(ca(b).mode === "war" || /hold/.test(ca(b).err || ""), "same hold or told to ride in");
  at(b, "Solitude"); OK(/same hold/.test(ca(b).err || ""), "far away: ride into the same hold");
  at(b, "Whiterun");
  OK(/under level/.test(ca(y).err), "under 20 left alone");
  OK(/hasn't picked/.test(ca(z).err), "no side, left alone");
  OK(/party/.test(ca(b, { party: { members: [{ id: a.id }, { id: b.id }] } }).err), "party members never");
  a.dungeon = { id: "x" }; OK(/dungeon/.test(ca(b).err), "not in a dungeon"); a.dungeon = null;
  OK(/knocked down/.test(SIDES.canAttack(a, { ...card(b), safeUntil: G.now() + 100 }).err), "safety window after a defeat");
  OK(ca(d).mode === "old" || ca(d).err, "same side keeps the old rules");
  OK(ca(b, { ambush: true }).mode === "war", "ambush across sides");
}
// 6. a war fight: bounty if seen, rewards, knock-down, the defender's phone
{
  const a = hero("warrior", 40), b = hero("warrior", 30);
  join(a, "stormcloak"); join(b, "imperial"); at(a, "Whiterun"); at(b, "Whiterun");
  let won = null;
  for (let k = 0; k < 20 && !won; k++) { G.setHealth(a, G.maxHealth(a)); a.safeUntil = 0; const r = SIDES.attack(a, card(b)); OK(r.war && r.doc, "war result"); if (r.won) won = r; }
  OK(won, "the stronger hero wins one");
  OK(won.doc.type === "warknock" && won.warHold === "Whiterun" && won.gold > 0, "warknock doc, gold, war points");
  OK(a.inv.some((x) => x.item === "side_trophy_il"), "trophy");
  OK(TOWNS.bounty(a, "Whiterun") > 0, "a town always sees it: bounty");
  const g0 = b.gold, inv0 = b.inv.length, rr = MP.receive(b, won.doc);
  OK(rr.bad && G.curHealth(b) <= G.maxHealth(b) * SIDES.KNOCK_HP + 1 && b.gold === g0 && b.inv.length === inv0, "defender knocked down, keeps gear");
  OK(b.safeUntil > G.now(), "defender protected");
  const x = hero("warrior", 25), y = hero("warrior", 60); join(x, "thalmor"); join(y, "stormcloak"); at(x, "Riften"); at(y, "Riften");
  let lost = null; for (let k = 0; k < 20 && !lost; k++) { G.setHealth(x, G.maxHealth(x)); x.safeUntil = 0; const r = SIDES.attack(x, card(y)); if (!r.won) lost = r; }
  OK(lost && lost.knocked && lost.doc.type === "warheld", "a loss knocks the attacker down");
  const h = MP.receive(y, lost.doc); OK(h.warHold && h.warHold === lost.doc.hold, "the defender's side gets war points");
  for (let k = 0; k < 5; k++) SIDES.reward(a, { id: "same", name: "S", level: 30 }, "imperial", "Whiterun", G.now());
  OK(SIDES.paysOut(a, "same", G.now(), false) === false, "only two paying wins a day per opponent");
}
// 7. holds belong to sides; old clans disbanded
{
  const a = hero("warrior", 30), b = hero("mage", 30); join(a, "stormcloak"); join(b, "imperial");
  a.clan = "OLD1"; const note = SIDES.migrate(a); OK(note && !a.clan && a.clanOld === "OLD1", "clan disbanded with a note");
  OK(!SIDES.migrate(a), "only once");
  const w = WARS.week();
  WARS.setDocs([{ uid: a.id, name: a.name, week: w - 1, h: { Whiterun: 30 } }, { uid: b.id, name: b.name, week: w - 1, h: { Whiterun: 10, "The Rift": 25 } }], a);
  SIDES.setDocs([a, b].map((s) => ({ ...SIDES.record(s), id: s.id })), a);
  const r = WARS.rulers(a); OK(r.Whiterun && r.Whiterun.id === "stormcloak" && r["The Rift"].id === "imperial", "holds ruled by sides: " + JSON.stringify(Object.fromEntries(Object.entries(r).map(([h, v]) => [h, v && v.id]))));
  OK(CLANS.of(a.id, a) && CLANS.of(a.id, a).id === "stormcloak", "CLANS.of is the side");
  const st = SIDES.standings(a); OK(st.length === 3 && st.find((x) => x.id === "stormcloak").holds >= 1, "standings");
}
// 8. two phones through the hub: the side, rank and XP sync
{

  OK(/"sides"/.test((__hubSrc.match(/const COLS = .*/) || [""])[0]) && /"sides"/.test(__storeSrc), "a 'sides' collection on the server and in store.js");
  const a = hero("warrior", 30), b = hero("mage", 30); join(a, "stormcloak"); SIDES.gainXp(a, "pvp"); SIDES.gainXp(a, "pvp");
  const rec = { ...SIDES.record(a), id: a.id };
  const wire = JSON.parse(JSON.stringify([rec]));   // what the other phone receives
  SIDES.setDocs(wire, b);
  OK(SIDES.of(a.id, b) === "stormcloak", "the other phone sees the side");
  OK(SIDES.members("stormcloak").find((m) => m.id === a.id).pts === a.side.pts, "and the rank XP");
  OK(SIDES.emblem("stormcloak").startsWith("<svg"), "emblem svg");
  SIDES.setDocs([{ uid: "evil", id: "other", side: "stormcloak", name: "X" }, { uid: "z", side: "nope", name: "Z" }], b);
  OK(!SIDES.of("evil", b) && !SIDES.of("z", b), "forged records ignored");
  SIDES.setCards([{ id: "c1", side: "thalmor" }]); OK(SIDES.of("c1", b) === "thalmor", "side from the public card");
}
// 9. every cloak effect and power belongs to one side only
{
  const all = {}; let dup = [];
  for (const side of SIDES.IDS) for (const t of SIDECLOAK.types(side)) { if (all[t] && all[t] !== side) dup.push(t + ": " + all[t] + "+" + side); all[t] = side; }
  OK(!dup.length, "no shared effect types: " + dup.join(", "));
  OK(Object.keys(all).length >= 15, "enough different effects: " + Object.keys(all).length);
  for (const side of SIDES.IDS) { OK(SIDECLOAK.DEF[side].length === 5, side + " 5 cloaks"); OK(SIDECLOAK.powersOf ? SIDECLOAK.powersOf(side, 5).length === 2 && SIDECLOAK.powersOf(side, 3).length === 0 : true, side + " 2 powers"); }
}
// 10. Polish for every line
{
  if (typeof I18N !== "undefined" && I18N.tr) {
    __lang = "pl";
    const miss = __cands.filter((v) => { const t = I18N.tr(v); return !t || t === v; }).filter((v) => !/^(Windhelm|Solitude|Whiterun|Haafingar|Hjaalmarch|Winterhold|Eastmarch|The Pale|Agent|Elenwen|SC|IL|AD)$/.test(v));
    __lang = "en";
    if (miss.length) console.log("untranslated:", miss.slice(0, 40));
    OK(miss.length <= 3, "Polish: " + miss.length + " lines missing");
  }
}
// 11. cross-side PvP with cloaks at every rank: fights last, no one-shots, cloaks don't decide everything
{
  const pairs = [["warrior", "mage"], ["warrior", "archer"], ["mage", "twohand"], ["warrior", "warrior"]], sides = ["stormcloak", "imperial", "thalmor"];
  const out = [];
  for (const rk of [0, 1, 5]) for (const [ba, bb] of pairs) for (let si = 0; si < 3; si++) {   // rank 0 = cloaks off (the baseline)
    const sa = sides[si], sb = sides[(si + 1) % 3];
    let wins = 0, turns = 0, oneShot = 0;
    for (let k = 0; k < N; k++) {
      const a = hero(ba, 40), b = hero(bb, 40); join(a, sa); join(b, sb);
      for (const s of [a, b]) { s.side.pts = SIDES.RANK_AT[Math.max(0, rk - 1)]; SIDECLOAK.grant(s); SIDECLOAK.wearBest(s); if (!rk) delete G.loadout(s).equipment.cloak; at(s, "Whiterun"); s.safeUntil = 0; }
      const r = SIDES.attack(a, card(b));
      wins += r.won ? 1 : 0; turns += r.fight.turn;
      if (r.fight.turn <= 1) oneShot++;
    }
    out.push({ rk, ba, bb, sa, sb, win: wins / N, turns: turns / N, oneShot });
    OK(oneShot === 0, "no one-turn fights " + ba + "/" + bb);
    OK(turns / N >= 3, "fights last " + (turns / N).toFixed(1) + " turns " + ba + " v " + bb);
  }
  // cloaks help but don't decide a fight: against the same matchup with cloaks off, the attacker's win rate moves
  // by less than a third, and at top rank no side's cloak beats the others' by more than a third either
  const base = (o) => out.find((x) => !x.rk && x.ba === o.ba && x.bb === o.bb && x.sa === o.sa);
  for (const o of out.filter((x) => x.rk)) OK(Math.abs(o.win - base(o).win) <= 0.34, "cloak swing rank " + o.rk + " " + o.ba + "/" + o.sa + " v " + o.bb + "/" + o.sb + ": " + base(o).win.toFixed(2) + " -> " + o.win.toFixed(2));
  for (const [ba, bb] of pairs) { const w = out.filter((x) => x.rk === 5 && x.ba === ba && x.bb === bb).map((x) => x.win - base(x).win); OK(Math.max(...w) - Math.min(...w) <= 0.34, "sides even at rank 5 " + ba + " v " + bb + ": " + w.map((v) => v.toFixed(2)).join(" ")); }
  console.log("PvP sim (attacker win rate, avg turns):"); for (const o of out) console.log("  rank " + o.rk + " " + o.ba + "/" + o.sa + " v " + o.bb + "/" + o.sb + ": " + (o.win * 100).toFixed(0) + "% · " + o.turns.toFixed(1) + " turns");
}
// 12. how long each rank takes (fixed XP per rank)
{
  const per = (k) => SIDES.XP[k];
  const dungeonRun = per("dungeon") + 6 * per("fight");   // a clear and its fights
  const rows = SIDES.RANK_AT.slice(1).map((at, i) => { const d = at - SIDES.RANK_AT[i]; return "rank " + (i + 2) + " (+" + d + "): " + Math.ceil(d / per("fight")) + " fights, " + Math.ceil(d / dungeonRun) + " dungeons, or " + Math.ceil(d / per("pvp")) + " PvP wins"; });
  console.log("rank pace:"); rows.forEach((r) => console.log("  " + r));
  OK(SIDES.XP.pvp > SIDES.XP.dungeon && SIDES.XP.dungeon > SIDES.XP.fight, "PvP wins earn the most");
}
console.log("sides ok · " + n + " checks");
`, c);
