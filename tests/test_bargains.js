// Daedric bargains (bargains.js): shrine contracts from real deeds, pact artifacts Dormant → Awakened → Ascendant,
// the curse you accept or refuse, the Daedric Mark tie-in, perks, Polish, and balance sims in both fight systems
// (the instant G.Fight.run and turn-by-turn TB.simulate): no one-shots, fights still take a while, and an Ascendant
// artifact with its curse helps less than going from good gear to the best crafted weapon.
//   W=/path/to/game/ node test_bargains.js        RUNS=60 for longer sims
const W = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const RUNS = +(process.env.RUNS || 24);
const c = { console, Math: Object.create(Math), Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, structuredClone, RUNS, process: { env: {} } };
let seed = 4242; c.Math.random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
vm.createContext(c);
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "stacks.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "daedric.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "beastpaths.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "priests.js", "potionfx.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "foeintent.js", "tbfight.js", "i18n_afflictions.js", "afflictions.js", "i18n_bargains.js", "bargains.js"];
for (const f of FILES.filter((f) => fs.existsSync(W + f))) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
vm.runInContext(fs.readFileSync(W + "patchnotes.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
c.__src = fs.readFileSync(W + "bargains.js", "utf8");
let n = 0, fail = 0; c.ok = (x, m) => { n++; if (!x) { fail++; console.log("FAIL " + m); } };
c.log = console.log;
vm.runInContext(`
const B = BARGAIN;
function hero(lvl = 20) { const s = G.newSave("h" + Math.random(), "H", "nord"); s.level = lvl; s.hpBonus = 10 * lvl; for (const k of Object.keys(s.skills)) s.skills[k].lvl += lvl + 10; G.setHealth(s, G.maxHealth(s)); s.gold = 5000; return s; }
const fightOf = (s, foe) => { const f = new G.Fight(s, JSON.parse(JSON.stringify(foe)), null, G.now()); f.allies = []; return f; };
const win = (s, foe, extra = {}) => { const f = { s, won: true, e: foe, tags: new Set(foe.tags || []), allies: [], hp: G.maxHealth(s), t: extra.t ?? G.now(), ehp0: foe.health, ...extra }; return B.after(f); };
const BANDIT = { name: "Bandit outlaw", health: 150, damage: 12, tags: ["humanoid"] };
const WOLF = { name: "Lone wolf", health: 90, damage: 9, tags: ["beast"] };
const TROLL = { name: "Frost troll", health: 300, damage: 20, tags: ["beast", "big", "troll"] };
const DRAUGR = { name: "Draugr", health: 160, damage: 14, tags: ["undead"] };
const DEATHLORD = { name: "Draugr Deathlord", health: 400, damage: 24, tags: ["undead", "elite"] };
const DREMORA = { name: "Dremora", health: 300, damage: 18, tags: ["daedra"] };
const nightT = (() => { let t = G.now(); for (let i = 0; i < 48 && !G.isNight(t); i++) t += 600; return t; })();
const dayT = (() => { let t = G.now(); for (let i = 0; i < 48 && G.isNight(t); i++) t += 600; return t; })();

// ---- wired in
ok(CURSE.__dbg && POTFX.__dbg && ROAD_EVENTS.__dbg && DUNGEONS.__dbg && BEASTPATH.__dbg && G.useSkill.__dbg, "hooks installed");
ok(CURSE.__affl && DAEDRIC && DAEDRIC.LINES.length === 13, "afflictions and the old Daedric quests still there");
ok(B.IDS.length === 6 && B.IDS.every((p) => B.PR[p].steps.length === 3 && B.PR[p].need[0] < B.PR[p].need[1]), "six princes, three deeds each, two thresholds");
for (const id of ["princely_favour", "bound_will", "awakened_bond"]) ok(PERKS.BY_ID[id] && PFX.FX[id], "perk " + id);
for (const id of ["aff_embrace", "aff_warding", "rune_scholar", "fair_dues"]) ok(PERKS.BY_ID[id], "old perk kept: " + id);
ok(isNaN(nightT) === false && G.isNight(nightT) && !G.isNight(dayT), "night and day clocks for the tests");

// ---- the shrine on the road
{ const low = hero(5); let k = 0; for (let i = 0; i < 300; i++) { const e = ROAD_EVENTS.roll(low); if (e && e.id === B.EV_ID) k++; } ok(k === 0, "no shrine offers under level 8");
  const s = hero(); let k2 = 0; for (let i = 0; i < 400; i++) { const e = ROAD_EVENTS.roll(s); if (e && e.id === B.EV_ID) k2++; } ok(k2 > 6 && k2 < 60, "shrine offers come now and then: " + k2 + "/400");
  const m = hero(); AFFL.give(m, "daedric"); let k3 = 0; for (let i = 0; i < 400; i++) { const e = ROAD_EVENTS.roll(m); if (e && e.id === B.EV_ID) k3++; } ok(k3 > k2, "the Daedric Mark draws more offers: " + k3 + " vs " + k2);
  const e = B.makeEvent(s); ok(e.id === B.EV_ID && B.PR[e.p] && /\\S/.test(e.text), "the event names a prince");
  const ch = ROAD_EVENTS.choices(e, s); ok(ch.length === 2 && ch[0][0] === "accept", "accept or walk on");
  const r = ROAD_EVENTS.choose(s, e, "accept"); ok(/First:/.test(r.text) && s.bargain.c && s.bargain.c.p === e.p, "accepting starts the contract: " + r.text.slice(0, 60));
  ok(!B.canOffer(s), "no second offer while you serve a prince");
  const r2 = B.offer(s, B.IDS.find((p) => p !== e.p)); ok(/already serve/.test(r2), "one contract at a time");
  ok(/turn your back/.test(B.breakIt(s)) && !s.bargain.c && !B.canOffer(s), "breaking it quiets the shrines for a while");
  ok(B.canOffer(s, G.now() + 3 * 3600), "...and they call again later"); }

// ---- Mehrunes Dagon: kills, dangerous foes, a dungeon cleared
{ const s = hero(); B.offer(s, "dagon");
  for (let i = 0; i < 7; i++) win(s, BANDIT); ok(s.bargain.c.step === 0 && Math.floor(s.bargain.c.n) === 7, "7 of 8 kills");
  const m1 = win(s, BANDIT).join(" "); ok(s.bargain.c.step === 1 && /Next:/.test(m1), "8th kill: next deed");
  win(s, BANDIT); ok(s.bargain.c.step === 1 && s.bargain.c.n === 0, "a plain bandit isn't a dangerous foe");
  win(s, TROLL, { e: { ...TROLL, danger: "high" } }); win(s, DEATHLORD); ok(s.bargain.c.step === 2, "two dangerous foes");
  // the dungeon: a cleared stamp change while acting in a dungeon
  B.deed(s, "clear", { theme: "cave" }, []); ok(!s.bargain.c && B.artOf(s, "dagon") && B.bound(s) === "dagon" && s.bargain.done.includes("dagon"), "clearing a dungeon hands over the Cinder, bound at once");
  ok(B.stage(s, "dagon") === 1, "it starts Dormant");
  const f = fightOf(s, BANDIT); ok(Math.abs(B.outMult(f) - 1.05) < 1e-9, "Dormant: +5% damage");
  const line = { me: "" }; f.hp = G.maxHealth(s); const e0 = f.ehp; B.tick(f, line); ok(f.ehp === e0 && line.me === "", "no burn while Dormant");
  s.bargain.arts.dagon.deeds = 14; ok(B.stage(s, "dagon") === 2, "Awakened at 14 deeds");
  B.tick(f, line); ok(f.ehp < e0 && /smoulders/.test(line.me), "Awakened: the foe smoulders every round (" + (e0 - f.ehp) + ")");
  s.bargain.arts.dagon.deeds = 39; const msg = win(s, BANDIT).join(" "); ok(B.ready(s, "dagon") && /could ascend/.test(msg) && B.stage(s, "dagon") === 2, "ready to ascend, but it waits for you");
  ok(/refuse/.test(B.refuse(s, "dagon")) && B.stage(s, "dagon") === 2 && B.ready(s, "dagon"), "refusing keeps it Awakened");
  const g = fightOf(s, BANDIT); ok(B.inMult(g) === 1, "no curse while refused");
  const am = B.ascend(s, "dagon"); ok(B.stage(s, "dagon") === 3 && /Ascendant/.test(am) && /Curse/.test(am), "accepting the curse: Ascendant");
  ok(AFFL.has(s, "daedric") && /Daedric Mark/.test(am), "accepting a curse brands you with the Daedric Mark");
  const h = fightOf(s, BANDIT); ok(B.inMult(h) > 1.1, "Dagon's Hunger: foes hit you harder (" + B.inMult(h).toFixed(2) + ")");
  h.ehp = h.ehp0 * 0.2; ok(B.outMult(h) > 1.2, "Ruin: more damage on a foe under a third");
  const md = s.affl.daedric.deeds; ok(/sleep/.test(B.sleep(s, "dagon")) && B.stage(s, "dagon") === 2 && B.inMult(fightOf(s, BANDIT)) === 1, "letting it sleep lifts the curse");
  B.ascend(s, "dagon"); ok(s.affl.daedric.deeds === md + 6, "ascending again with the Mark deepens it"); }

// ---- Azura: the night
{ const s = hero(); B.offer(s, "azura");
  win(s, BANDIT, { t: dayT }); ok(s.bargain.c.n === 0, "a day fight doesn't count");
  for (let i = 0; i < 3; i++) win(s, BANDIT, { t: nightT }); ok(s.bargain.c.step === 1, "3 night wins");
  win(s, DEATHLORD, { t: dayT }); ok(s.bargain.c.step === 1, "dangerous but by day: no");
  win(s, DEATHLORD, { t: nightT }); ok(s.bargain.c.step === 2, "dangerous at night");
  win(s, DRAUGR, { t: dayT }); win(s, DREMORA, { t: dayT }); ok(B.artOf(s, "azura") && B.bound(s) === "azura", "two undead or daedra: the Moonshard");
  const f = fightOf(s, BANDIT); f.t = dayT; f.sp = 0; f.mp = 0; f.hp = G.maxHealth(s); B.tick(f, { me: "" }); ok(f.sp > 0 && f.mp > 0, "Dormant: stamina and magicka come back each round");
  s.bargain.arts.azura.deeds = 12; const fn = fightOf(s, BANDIT); fn.t = nightT; const fd = fightOf(s, BANDIT); fd.t = dayT;
  ok(B.inMult(fn) < 1 && B.inMult(fd) === 1, "Awakened: softer blows at night only");
  s.bargain.arts.azura.deeds = 32; B.ascend(s, "azura");
  const fs2 = fightOf(s, BANDIT); fs2.t = dayT; ok(B.outMult(fs2) < 1, "Sunblind: weaker in daylight");
  const fs3 = fightOf(s, BANDIT); fs3.t = dayT; s.dungeon = { theme: "cave", place: "X" }; ok(B.outMult(fs3) === 1, "...but not underground"); s.dungeon = null;
  const fg = fightOf(s, BANDIT); fg.t = nightT; fg.hp = G.maxHealth(s) * 0.2; const l = { me: "" }; B.tick(fg, l); const h1 = fg.hp; ok(h1 > G.maxHealth(s) * 0.4 && /Twilight/.test(l.me), "Twilight's Grace heals once");
  fg.hp = G.maxHealth(s) * 0.2; B.tick(fg, { me: "" }); ok(fg.hp < G.maxHealth(s) * 0.25, "...only once a fight"); }

// ---- Nocturnal: thefts and locks from the real skill calls, a fight from hiding
{ const s = hero(); B.offer(s, "nocturnal");
  G.useSkill(s, "Pickpocket", 0.25); ok(s.bargain.c.n === 0, "a failed try with no real XP doesn't count");
  let msgs = []; for (let i = 0; i < 4; i++) msgs = G.useSkill(s, "Pickpocket", 25); ok(s.bargain.c.step === 1 && msgs.some((m) => /Next:/.test(m)), "4 pockets picked: the next deed shows with the skill messages");
  G.useSkill(s, "Lockpicking", 0.25); ok(s.bargain.c.n === 0, "a broken pick doesn't count");
  for (let i = 0; i < 3; i++) G.useSkill(s, "Lockpicking", 5); ok(s.bargain.c.step === 2, "3 locks picked");
  win(s, BANDIT); ok(s.bargain.c.step === 2, "a fight not opened from hiding: no");
  win(s, BANDIT, { _dbgHid: true }); ok(B.bound(s) === "nocturnal", "a fight from hiding: the Eye");
  const f = fightOf(s, BANDIT); f.turn = 1; const o1 = B.outMult(f); f.turn = 3; const o3 = B.outMult(f); ok(o1 > 1.1 && o3 === 1, "Dormant: the first round hits harder");
  { const h = fightOf(s, BANDIT); h.turn = 1; h.hidden = true; B.outMult(h); ok(B.ctxOf(h).hidden, "the fight remembers you opened from hiding"); }
  s.bargain.arts.nocturnal.deeds = 12; const fd = fightOf(s, BANDIT); fd.t = dayT; const fn = fightOf(s, BANDIT); fn.t = nightT; ok(B.inMult(fd) < 1 && B.inMult(fn) < B.inMult(fd), "Awakened: shadows soften blows, more at night");
  const p0 = G.buyPrice ? G.buyPrice(s, "iron_sword", "Whiterun") : null;
  s.bargain.arts.nocturnal.deeds = 30; B.ascend(s, "nocturnal"); ok(Math.abs(B.priceMult(s) - 1.15) < 1e-9, "the Tithe of Shadows: shops 15% dearer");
  if (p0 != null) ok(G.buyPrice(s, "iron_sword", "Whiterun") > p0, "buying really costs more: " + p0 + " → " + G.buyPrice(s, "iron_sword", "Whiterun"));
  const g0 = s.gold; const m = win(s, BANDIT).join(" "); ok(s.gold > g0 && /Eye of Nocturnal/.test(m), "Ascendant: gold after every win");
  const fx = fightOf(s, BANDIT); fx.t = nightT; fx.turn = 3; ok(B.outMult(fx) > 1.05, "Ascendant: harder at night"); }

// ---- Hircine: beasts, a great beast, a beast at night; the potion curse
{ const s = hero(); B.offer(s, "hircine");
  win(s, BANDIT); ok(s.bargain.c.n === 0, "a bandit isn't a beast");
  for (let i = 0; i < 5; i++) win(s, WOLF, { t: dayT }); ok(s.bargain.c.step === 1, "5 beasts");
  win(s, WOLF, { t: dayT }); ok(s.bargain.c.step === 1, "a wolf isn't a great beast");
  win(s, TROLL, { t: dayT }); ok(s.bargain.c.step === 2, "a troll is");
  win(s, WOLF, { t: nightT }); ok(B.bound(s) === "hircine", "a beast at night: the Totem");
  ok(B.outMult(fightOf(s, WOLF)) > 1.05 && B.outMult(fightOf(s, BANDIT)) === 1, "Dormant: beasts only");
  s.bargain.arts.hircine.deeds = 12; const f = fightOf(s, WOLF); f.hp = G.maxHealth(s) * 0.5; f.ehp = f.ehp0 * 0.4; const h0 = f.hp; B.tick(f, { me: "" }); ok(f.hp > h0, "Awakened: blood scent heals while the foe is badly hurt");
  ok(B.potionMult(s) === 1, "no curse yet");
  s.bargain.arts.hircine.deeds = 32; B.ascend(s, "hircine"); ok(B.potionMult(s) < 0.75, "the Beast's Hunger: potions heal less");
  const g = fightOf(s, BANDIT); g.hp = G.maxHealth(s) * 0.4; ok(B.outMult(g) > 1.1, "the Hunt: harder while hurt"); }

// ---- Boethiah: alone, warriors, a close call; the curse hits party play
{ const s = hero(); B.offer(s, "boethiah");
  win(s, BANDIT, { allies: [{ follower: true, name: "Lydia" }] }); ok(s.bargain.c.n === 0, "with a follower: not alone");
  for (let i = 0; i < 3; i++) win(s, WOLF); ok(s.bargain.c.step === 1, "3 wins alone");
  for (let i = 0; i < 3; i++) win(s, BANDIT); ok(s.bargain.c.step === 2, "3 warriors");
  win(s, BANDIT, { hp: G.maxHealth(s) * 0.2 }); ok(B.bound(s) === "boethiah", "a close call: the Sigil");
  ok(B.outMult(fightOf(s, WOLF)) > 1.05, "Dormant: alone you hit harder");
  const fa = fightOf(s, WOLF); fa.allies = [{ player: true, name: "Kacper" }]; ok(B.outMult(fa) === 1, "...not with a friend");
  s.bargain.arts.boethiah.deeds = 14; const f = fightOf(s, WOLF); f.sp = 0; f.hp = 100; B.tick(f, { me: "" }); f.hp = 80; B.tick(f, { me: "" }); ok(f.sp > 0, "Awakened: getting hurt gives stamina");
  s.bargain.arts.boethiah.deeds = 36; B.ascend(s, "boethiah");
  const fp = fightOf(s, BANDIT); fp.allies = [{ player: true, name: "Kacper" }]; ok(B.outMult(fp) < 1.0, "Boethiah's Contempt: weaker with a friend at your side (" + B.outMult(fp).toFixed(2) + ")");
  ok(B.outMult(fightOf(s, BANDIT)) > 1.15, "alone against a bandit: both bonuses"); }

// ---- Meridia: undead, a barrow, a powerful undead; the Sneak curse
{ const s = hero(); B.offer(s, "meridia");
  for (let i = 0; i < 5; i++) win(s, DRAUGR); ok(s.bargain.c.step === 1, "5 undead");
  B.deed(s, "clear", { barrow: false }, []); ok(s.bargain.c.step === 1, "a cave isn't a barrow");
  s.dungeon = { theme: "barrow", place: "Bleak Falls Barrow", tier: 2 }; B.deed(s, "clear", { barrow: true }, []); s.dungeon = null; ok(s.bargain.c.step === 2, "a barrow cleared");
  win(s, DEATHLORD); ok(B.bound(s) === "meridia", "a Deathlord: the Lantern");
  ok(B.outMult(fightOf(s, DRAUGR)) > 1.1 && B.outMult(fightOf(s, BANDIT)) === 1, "Dormant: the undead only");
  s.bargain.arts.meridia.deeds = 12; const fu = fightOf(s, DRAUGR), fb = fightOf(s, BANDIT); fu.hp = fb.hp = G.maxHealth(s); const u0 = fu.ehp, b0 = fb.ehp; B.tick(fu, { me: "" }); B.tick(fb, { me: "" }); ok(u0 - fu.ehp === 2 * (b0 - fb.ehp) && b0 > fb.ehp, "Radiance: light every round, double on the undead");
  const sn0 = G.skill(s, "Sneak"); s.bargain.arts.meridia.deeds = 32; B.ascend(s, "meridia");
  ok(G.skill(s, "Sneak") <= sn0 - 25 || CURSE.fx(s, "skill:Sneak") < 0, "Blinding Light: Sneak drops (" + sn0 + " → " + G.skill(s, "Sneak") + ")");
  ok(B.inMult(fightOf(s, DREMORA)) < 0.9, "Dawn's Ward vs daedra"); }

// ---- only the bound artifact works and grows; switching
{ const s = hero(); s.bargain = { c: null, arts: { dagon: { deeds: 0 }, hircine: { deeds: 0 } }, bound: "dagon", done: ["dagon", "hircine"], offAt: 0 };
  win(s, WOLF); ok(s.bargain.arts.dagon.deeds === 1 && s.bargain.arts.hircine.deeds === 0, "only the bound one grows");
  ok(B.outMult(fightOf(s, WOLF)) === 1.05, "only the bound one works");
  B.bind(s, "hircine"); ok(B.bound(s) === "hircine" && Math.abs(B.outMult(fightOf(s, WOLF)) - 1.1) < 1e-9, "binding another switches powers");
  ok(/don't have/.test(B.bind(s, "azura")), "can't bind what you don't own"); }

// ---- the Daedric Mark and the Vow
{ const s = hero(); AFFL.give(s, "daedric"); B.offer(s, "dagon"); win(s, BANDIT); ok(Math.abs(s.bargain.c.n - 1.25) < 1e-9, "the Mark: deeds count a quarter more");
  s.location = "Riften"; AFFL.takeVow(s); ok(/turned away/.test(B.offer(hero(), "azura")) === false, "a clean hero can still deal");
  const n0 = s.bargain.c.n; win(s, BANDIT); ok(s.bargain.c.n === n0, "under the Vow nothing grows"); ok(!B.canOffer(s, G.now() + 99999), "under the Vow: no offers");
  s.bargain.c = null; ok(/Vow of Cleansing/.test(B.offer(s, "azura")), "under the Vow the princes turn away"); }

// ---- perks
{ const s = hero(); s.bargain = { c: null, arts: { dagon: { deeds: 40, asc: true } }, bound: "dagon", done: ["dagon"], offAt: 0 };
  const a = B.nums(s, "dagon"); s.perks = { ...(s.perks || {}), princely_favour: 1, bound_will: 1, awakened_bond: 1 }; const b = B.nums(s, "dagon");
  ok(b.out > a.out && b.burn > a.burn, "Awakened Bond: stronger powers"); ok(b.curse < a.curse, "Bound Will: weaker curse"); ok(B.deedMult(s) === 1.5, "Princely Favour: deeds count 50% more"); }

// ---- the Character screen
{ ok(B.panel(hero(5)) === "", "nothing before level 8");
  const s = hero(); const p0 = B.panel(s); ok(/Daedric bargains/.test(p0) && /dbg-chip/.test(p0) && /black shrine/.test(p0), "empty panel explains where offers come from");
  B.offer(s, "hircine"); const p1 = B.panel(s); ok(/dbg-con/.test(p1) && /data-act="dbgbreak"/.test(p1) && /0\\/5/.test(p1), "contract card with steps and Break");
  s.bargain.c = null; s.bargain.arts = { hircine: { deeds: 32 }, dagon: { deeds: 3 } }; s.bargain.bound = "hircine";
  const p2 = B.panel(s); ok(/data-act="dbgasc"/.test(p2) && /data-act="dbgref"/.test(p2) && /data-act="dbgbind" data-id="dagon"/.test(p2) && /dbg-track/.test(p2), "artifact cards: ascend, refuse, bind");
  const btn = { dataset: { act: "dbgasc", id: "hircine" } }; let shown = null; B.act(s, btn, { show: (t, m) => (shown = [t, m]), say: () => {} }); ok(shown && B.stage(s, "hircine") === 3, "the Ascend button works");
  ok(/data-act="dbgsleep"/.test(B.panel(s)), "Ascendant shows Let it sleep");
  ok(JSON.stringify(B.cardBits(s)) === JSON.stringify({ dbg: "hircine:3" }), "party card bits"); }

// ---- Polish: every line in bargains.js and the perks and patch note
{ const tpl = I18N_BARG.tpl, words = I18N_BARG.words;
  const Q = '"((?:[^"\\\\\\\\]|\\\\\\\\.)*)"', src = __src, want = new Set();
  for (const m of src.matchAll(new RegExp("T\\\\(" + Q, "g"))) want.add(JSON.parse('"' + m[1] + '"'));
  for (const p of B.IDS) { const d = B.PR[p]; for (const k of ["prince", "theme", "contract", "whisper", "art", "desc", "grow"]) want.add(d[k]); for (const st of d.steps) want.add(st[0]); want.add(d.curse[0]); want.add(d.curse[1]); }
  for (const x of B.STAGES) want.add(x);
  const miss = [...want].filter((x) => !(x in tpl)); ok(miss.length === 0, "every line has Polish (missing: " + miss.slice(0, 4).join(" | ") + ")");
  const keep = new Set(["Mehrunes Dagon", "Azura", "Nocturnal", "Meridia"]);
  for (const [en, pl] of Object.entries(tpl)) { ok(pl && (pl !== en || keep.has(en)), "pl: " + en); const a = (en.match(/\\{\\w+\\}/g) || []).sort().join(), b = (pl.match(/\\{\\w+\\}/g) || []).sort().join(); ok(a === b, "placeholders match: " + en); }
  for (const id of ["princely_favour", "bound_will", "awakened_bond"]) { const p = PERKS.BY_ID[id]; ok(words[p.name], "perk name in Polish: " + p.name); ok(words[p.desc.replace(/ \\[OURS\\]$/, "")], "perk text in Polish: " + id); }
  const pn = PATCHNOTES.LIST.find((x) => x.id === "b214-daedric"); ok(pn && PATCHNOTES.LIST[0] === pn || (pn && pn.build >= 214), "patch note b214");
  if (pn) for (const l of [pn.title, ...pn.items]) ok(words[l], "patch note in Polish: " + l.slice(0, 40));
  ok(!PATCHNOTES.NEXT.some((l) => /Daedric bargains/i.test(l)), "Daedric bargains off Coming next"); }
`, c);

// ---- balance sims: both fight systems, realistic heroes (gear, perks, potions) from tests/test_tbfight.js
vm.runInContext(`
const GEAR = {
  warrior: [["steel_sword", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"], "steel_shield"], ["dwarven_sword", ["dwarven_helmet","dwarven_armor","steel_gauntlets","steel_boots"], "steel_shield"]],
  twohand: [["steel_battleaxe", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"]], ["steel_battleaxe", ["dwarven_helmet","dwarven_armor","steel_gauntlets","steel_boots"]]],
  archer: [["elven_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]], ["dwarven_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]]],
};
const MAIN = { warrior: [["One-Handed",1],["Heavy Armor",1],["Blocking",0.9],["Smithing",0.8],["Restoration",0.3]], twohand: [["Two-Handed",1],["Heavy Armor",1],["Smithing",0.8],["Blocking",0.3]], archer: [["Archery",1],["Light Armor",0.9],["Sneak",0.6],["Smithing",0.7]] };
const ATTR = { warrior: [0.7,0,0.3], twohand: [0.6,0,0.4], archer: [0.6,0,0.4] };
/* the strongest weapon of this kind anyone can forge (no artifacts, nothing unique) */
function topWeapon(build) {
  const kind = { warrior: (it) => it.skill === "One-Handed" && it.hands !== 2, twohand: (it) => it.skill === "Two-Handed", archer: (it) => it.skill === "Archery" }[build];
  return Object.entries(D.ITEMS).filter(([k, it]) => it.slot === "weapon" && kind(it) && !it.noTrade && !it.unique && !it.quest && !it.dae && !it.enchant && !/_(flames|frost|shock|absorb|fear|soul|paralyze)/.test(k)).sort((a, b) => b[1].damage - a[1].damage)[0][0];
}
function make(build, L, opts = {}) {
  const s = G.newSave("sim" + Math.random(), "Sim", "nord"); s._test = true; s.level = L; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun;
  for (const [k, w] of MAIN[build]) s.skills[k].lvl = Math.min(100, Math.round(s.skills[k].lvl + (2.3 * L) * w));
  const [h, m, st] = ATTR[build]; const ups = (L - 1) * 10; s.hpBonus = Math.round(ups * h); s.mpBonus = Math.round(ups * m); s.spBonus = Math.round(ups * st);
  const trees = MAIN[build].map(([k]) => k).filter((k) => PERKS.TREES[k]); let guard = 0;
  while (PERKS.pointsLeft(s) > 0 && guard++ < 400) { const o = trees.flatMap((k) => PERKS.TREES[k].map((p) => p[0])).filter((id) => !PERKS.canTake(s, id)); if (!o.length) break; PERKS.take(s, o[0]); }
  const T = L >= 30 ? 1 : 0, [wpn0, arm, sh] = GEAR[build][T], q = Math.min(6, 1 + Math.floor(G.skill(s, "Smithing") / 20));
  const wpn = opts.top ? topWeapon(build) : wpn0, wq = opts.top ? 6 : q;
  const eqp = (item, temper, tq) => { const id = G.give(s, item); const r = G.invRow(s, id); if (temper) { r.tq = tq; r.temper = temper; } G.equip(s, id); return r; };
  eqp(wpn, wq * (opts.top ? 2 : 1), wq); for (const a of arm) eqp(a, q * 2, q); if (sh) eqp(sh, q * 2, q);
  if (build === "archer") G.give(s, "arrow_steel", 80);
  G.give(s, "potion_health", 2 + Math.floor(L / 10));
  const R = [{ if: "hp_below", pct: 40, do: "potion:health" }]; if (build !== "archer") R.push({ if: "sp_above", pct: 60, do: "power_attack" }); R.push({ if: "always", do: "attack" }); G.loadout(s).rules = R;
  if (opts.art) { s.bargain = { c: null, arts: { [opts.art]: { deeds: opts.stage === 3 ? 999 : opts.stage === 2 ? BARGAIN.PR[opts.art].need[0] : 0, asc: opts.stage === 3 } }, bound: opts.art, done: [opts.art], offAt: 0 }; if (opts.perk) s.perks.awakened_bond = 1; }
  G.setHealth(s, G.maxHealth(s)); s.healthTs = G.now();
  return s;
}
const enc = (name, L) => { const b = D.ENCOUNTERS.find((e) => e.name === name); return b ? G.scaleEnemy({ ...b }, L) : null; };
const POOL = ["Bandit outlaw", "Black bear", "Sabre cat", "Draugr", "Forsworn ambush", "Frost troll", "Vampire", "Wolf pack", "Skeleton", "Thalmor patrol"];
var simT = G.now();
const STRONG = new Set(["Frost troll", "Vampire", "Thalmor patrol"]);
function sim(build, L, opts, tb) {
  let won = 0, rounds = 0, k = 0, one = 0, ss_r = 99;
  for (let i = 0; i < RUNS; i++) for (const nm of POOL) {
    const s = make(build, L, opts), e = enc(nm, L); if (!e) continue;
    if (!tb) { e.health = Math.round(e.health * 1.8); e.hp = e.health; }
    const f = new G.Fight(s, e, null, simT + (i % 2) * 7200); f.allies = [];
    try { if (tb) { const ss = TB.simulate(f, { t: f.t }); rounds += ss.round; ss_r = ss.round; } else { f.run({ t: f.t }); rounds += f.turn; } } catch (er) { continue; }
    k++; if (f.won && !f.escaped) won++; if (f.won && STRONG.has(nm) && (tb ? ss_r <= 1 : f.turn <= 1)) one++;
  }
  return { win: Math.round(100 * won / Math.max(1, k)), rounds: +(rounds / Math.max(1, k)).toFixed(1), one };
}
/* the largest share of a strong foe's health one blow takes in a turn-based fight */
function maxBlow(build, L, opts) {
  let max = 0;
  for (let i = 0; i < 12; i++) { const s = make(build, L, opts), e = enc("Frost troll", L), f = new G.Fight(s, e, null, simT); f.allies = []; const ss = new TB.Session(f, { trySneak: false }); ss.begin();
    for (let r = 0; r < 6 && f.ehp > 0 && f.hp > 0; r++) { if (ss.cur?.id !== "me") ss.advance(); if (ss.cur?.id !== "me") continue; const b = f.ehp; try { ss.act("power_attack"); } catch (x) { break; } max = Math.max(max, (b - f.ehp) / ss.ehpMax); try { ss.endTurn ? ss.endTurn() : ss.advance(); } catch (x) { break; } } }
  return max;
}
for (const [build, L] of [["warrior", 20], ["twohand", 30], ["archer", 25]]) {
  for (const tb of [false, true]) {
    const base = sim(build, L, {}, tb), top = sim(build, L, { top: true }, tb), gain = top.win - base.win;
    const rows = [];
    for (const p of BARGAIN.IDS) {
      const a3 = sim(build, L, { art: p, stage: 3 }, tb), a3p = sim(build, L, { art: p, stage: 3, perk: true }, tb);
      rows.push(p + " " + a3.win + "%/" + a3.rounds + "r" + " (perk " + a3p.win + "%)");
      const tol = Math.max(2, Math.ceil(RUNS * STRONG.size * 0.1)); ok(a3.one <= base.one + tol && a3p.one <= base.one + tol, build + " " + p + (tb ? " tb" : "") + ": no one-round wins on strong foes (" + base.one + " → " + a3.one + "/" + a3p.one + ")");
      ok(a3.rounds >= (tb ? 4 : 2), build + " " + p + (tb ? " tb" : "") + ": fights still take a while (" + a3.rounds + ")");
      ok(a3.win - base.win <= Math.max(gain, 0) + 6, build + " " + p + (tb ? " tb" : "") + ": Ascendant with its curse isn't much better than the best crafted weapon (" + base.win + "% → artifact " + a3.win + "%, top gear " + top.win + "%)");
      ok(a3p.win - base.win <= Math.max(gain, 0) + 9, build + " " + p + (tb ? " tb" : "") + ": even with Awakened Bond (" + a3p.win + "%)");
      ok(a3.rounds >= base.rounds * 0.65, build + " " + p + (tb ? " tb" : "") + ": fights don't get much shorter (" + base.rounds + " → " + a3.rounds + ")");
    }
    log((tb ? "TB  " : "RUN ") + build + " L" + L + ": base " + base.win + "%/" + base.rounds + "r · top gear " + top.win + "%/" + top.rounds + "r · " + rows.join(" · "));
  }
}
for (const p of ["dagon", "boethiah", "hircine"]) { const m = maxBlow("twohand", 30, { art: p, stage: 3, perk: true }); ok(m <= 0.41, "no one-shots in turn-based fights: " + p + " biggest blow " + Math.round(100 * m) + "% of a troll"); }
`, c);
console.log(fail ? `bargains FAILED ${fail}/${n}` : `bargains ok · ${n} checks`);
process.exit(fail ? 1 : 0);
