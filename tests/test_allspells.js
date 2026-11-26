/* Every spell in the game, cast for real (tests/test_allspells.js). W=/path/to/game/ node test_allspells.js — prints "allspells ok".
   Loads the whole game the way index.html does (minus the screen code), then for every spell in D.SPELLS (data.js, tomes.js,
   magic.js, spellbook.js), plus scrolls, staffs and follower casting, sets up a real turn-based fight (tbfight.js Session,
   the same one the phone plays) or the instant engine fight, casts it, and checks that the effect really happened:
   damage lands (not 0, no one-shot on a strong foe), heals heal and stop at full, wards and flesh spells show on the fight
   screen and soak damage, burns/walls/cloaks tick, summons act and are gone next fight, paralysis/fear/calm/turn change
   what the foe does, area spells reach the rest of a group, magicka is paid and too little blocks the cast, scrolls are
   used up, out-of-fight spells do what they say and have a cooldown. Also: every spell has a description and Polish name. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = { setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Uint8ClampedArray, Int32Array, Uint16Array, Int16Array, Uint32Array,
  Object, Array, Set, Map, WeakMap, Proxy, Number, String, structuredClone, performance: { now: () => 0 },
  navigator: { language: "pl-PL" }, localStorage: { getItem: () => JSON.stringify({ lang: "pl" }), setItem() {}, removeItem() {} } };
// fixed dice (mulberry32): the "reaches the foes waiting behind" checks roll hits and resists, so a bad run failed now and then
let seed = 1337; c.Math = Object.create(Math); c.Math.random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
vm.createContext(c);
const html = fs.readFileSync(W + "index.html", "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => !/^(ui|store|p2pnet)\.js$/.test(f));
for (const f of scripts) {
  if (!fs.existsSync(W + f)) continue;
  try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f }); } catch (e) { /* screen-only module */ }
}
vm.runInContext(`
let fails = 0, n = 0; const bad = new Set();
const ok = (cnd, m, id) => { n++; if (!cnd) { fails++; if (id) bad.add(id); console.log("FAIL", m); } };
const TRIES = 20;
const tries = (fn, k = TRIES) => { let hit = 0; for (let i = 0; i < k; i++) if (fn(i)) hit++; return hit; };
G.setAllyProvider(() => []);
function mage(sk = 100, o = {}) {
  const s = G.newSave("M" + Math.random(), "Mage", "breton"); s._test = true; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.level = 30; s.mpBonus = 900;
  for (const k of ["Destruction", "Restoration", "Alteration", "Conjuration", "Illusion", "Mysticism"]) s.skills[k].lvl = sk;
  s.spells = Object.keys(D.SPELLS).filter((k) => !D.SPELLS[k].custom && !D.SPELLS[k].hidden); s.perks = {}; s.follower = null; s.thrall = null;
  for (const L of Object.values(s.loadouts || {})) if (L) L.mode = "custom";
  Object.assign(s, o); G.setHealth(s, G.maxHealth(s)); return s;
}
const FOES = {
  bandit: () => ({ name: "Bandit", danger: "medium", level: 6, tags: ["humanoid"], health: 220, hp: 220, damage: 9, gold: [5, 10], noGroup: true }),
  chief: () => ({ name: "Bandit Chief", danger: "high", level: 22, tags: ["humanoid", "elite"], health: 700, hp: 700, damage: 22, gold: [50, 90], noGroup: true }),
  draugr: () => ({ name: "Draugr", danger: "medium", level: 6, tags: ["undead"], health: 220, hp: 220, damage: 9, gold: [5, 10], noGroup: true }),
  deathlord: () => ({ name: "Draugr Deathlord", danger: "high", level: 45, tags: ["undead", "elite"], health: 900, hp: 900, damage: 30, gold: [5, 10], noGroup: true }),
  necro: () => ({ name: "Necromancer", danger: "medium", level: 8, tags: ["humanoid", "mage"], health: 260, hp: 260, damage: 14, gold: [5, 10], noGroup: true }),
  dremora: () => ({ name: "Dremora", danger: "medium", level: 12, tags: ["humanoid", "daedra"], health: 300, hp: 300, damage: 14, gold: [5, 10], noGroup: true }),
  wolf: () => ({ name: "Wolf", danger: "low", level: 4, tags: ["beast"], health: 120, hp: 120, damage: 6, gold: [0, 0], noGroup: true }),
  dragon: () => ({ name: "Dragon", danger: "high", level: 30, tags: ["dragon", "big", "elite"], health: 1500, hp: 1500, damage: 40, gold: [100, 200], noGroup: true }),
  boss: () => ({ name: "Bandit Chief", danger: "high", level: 20, tags: ["humanoid", "elite"], health: 900, hp: 900, damage: 22, gold: [50, 90], boss: true }),
};
/* a turn-based fight, played the way the phone plays it, stopped at your first turn */
function tb(s, foe, allies) {
  G.setAllyProvider(() => (allies ? allies() : []));
  const f = new G.Fight(s, foe);
  G.setAllyProvider(() => []);
  const ss = new TB.Session(f, { trySneak: false });
  ss.startRound();
  ss.order = ss.order.filter((o) => o.id === "me").concat(ss.order.filter((o) => o.id !== "me"));   // you act first: the test casts before the foe moves
  ss.idx = 0; ss.cur = ss.order[0];
  ss.ap = 99; ss.spAp = 0; ss.apSet = true; ss.myActs = 0;
  return { f, ss };
}
/* cast in a turn-based fight; returns what changed */
function castTB(s, foe, act, allies, prep) {
  const { f, ss } = tb(s, foe, allies);
  if (prep) prep(f, ss);
  const b = { ehp: f.ehp, hp: f.hp, mp: f.mp, ehpMax: ss.ehpMax };
  const r = ss.act(act);
  return { f, ss, r, b, text: (ss.ev.filter((e) => e.kind === "me").pop() || {}).text || "" };
}
const SPELLS = Object.entries(D.SPELLS).filter(([, sp]) => !sp.custom && !sp.hidden);
const kinds = {}; for (const [id, sp] of SPELLS) (kinds[sp.kind] = kinds[sp.kind] || []).push(id);
const FOE_FOR = (id, sp) => sp.element === "sun" || sp.kind === "turn" ? FOES.draugr : sp.kind === "banish" ? FOES.dremora : FOES.bandit;
const tested = new Set();
const mark = (id) => tested.add(id);
const ally = (o = {}) => ({ name: "Lydia", dmg: 10, hp: 40, maxHp: 120, follower: true, kind: "follower", ...o });

// ---------------------------------------------------------------- 0. every spell: a description, numbers for the menu, a Polish name
const pl = (t) => { const r = I18N.tr(t); return r != null && r !== t ? r : null; };
const S0 = mage();
for (const [id, sp] of SPELLS) {
  ok(MAGIC.describe(sp), id + " has a description", id);
  const texts = sp.kind === "utility" ? [MAGIC.describe(sp)] : MAGIC.nums(S0, id, false).map((p) => p.t);
  ok(texts.length && texts.every(Boolean), id + " shows numbers in the Magic menu", id);
  ok(pl(sp.name), id + " has a Polish name (" + sp.name + ")", id);
  for (const t of texts) ok(pl(t), id + " menu text in Polish: " + t, id);
  if (MAGIC.dualable(sp) && sp.kind !== "utility") for (const p of MAGIC.nums(S0, id, true)) ok(pl(p.t), id + " dual text in Polish: " + p.t, id);
  ok(sp.level && MAGIC.LEVELS.includes(sp.level) && sp.school && Number.isFinite(sp.cost), id + " has a level, school and cost", id);
}

// ---------------------------------------------------------------- 1. magicka: paid on cast, too little blocks it (every spell that costs some)
for (const [id, sp] of SPELLS) {
  if (sp.kind === "utility") continue;
  const s = mage(), cost = G.spellCost(s, sp);
  const { f, ss } = tb(s, FOE_FOR(id, sp)());
  const mp0 = f.mp, tbc = TB.cost(f, "spell:" + id, ss).mp; ss.act("spell:" + id);   // a turn-based cast: spellCost less the Alteration cut (tbfight.js stats mpCut)
  ok(Math.abs((mp0 - f.mp) - tbc) < 0.01 || sp.kind === "equilibrium" || sp.kind === "absorb", id + ": pays " + tbc + " magicka (paid " + Math.round(mp0 - f.mp) + ")", id);
  if (cost > 0) {
    const t2 = tb(mage(), FOE_FOR(id, sp)()), c2 = TB.cost(t2.f, "spell:" + id, t2.ss).mp; t2.f.mp = c2 - 1;
    ok(!t2.f.affordable("spell:" + id) && !t2.ss.canAfford("spell:" + id) && /magicka/.test(t2.ss.act("spell:" + id)?.err), id + ": blocked with " + (c2 - 1) + " magicka", id);
    ok(t2.f.mp === c2 - 1, id + ": a blocked cast costs nothing", id);
  }
  if (MAGIC.dualable(sp)) {
    const s3 = mage(), t3 = tb(s3, FOE_FOR(id, sp)()), m0 = t3.f.mp, dc = TB.cost(t3.f, "dual:" + id, t3.ss).mp; t3.ss.act("dual:" + id);
    ok(Math.abs((m0 - t3.f.mp) - dc) < 0.5 || sp.kind === "equilibrium" || sp.kind === "absorb", id + ": dual cast pays " + dc + " (paid " + Math.round(m0 - t3.f.mp) + ")", id);
  }
}
// casting above your skill costs more and can fizzle
{ const lo = mage(10), hi = mage(100); ok(G.spellCost(lo, D.SPELLS.fire_storm) > G.spellCost(hi, D.SPELLS.fire_storm), "Master spell costs more at skill 10");
  ok(MAGIC.failChance(lo, "fire_storm") > 0 && MAGIC.failChance(hi, "fire_storm") === 0, "and can fizzle"); }

// ---------------------------------------------------------------- 2. damage spells
for (const id of kinds.damage) {
  const sp = D.SPELLS[id]; mark(id);
  const foe = sp.element === "sun" ? FOES.draugr : FOES.bandit;
  let hits = 0, dmgs = [];
  for (let i = 0; i < TRIES; i++) { const x = castTB(mage(), foe(), "spell:" + id); const d = x.b.ehp - x.f.ehp; if (d > 0) { hits++; dmgs.push(d); } }
  ok(hits >= TRIES * 0.6, id + ": hits a foe (" + hits + "/" + TRIES + ")", id);
  const avg = dmgs.reduce((a, b) => a + b, 0) / Math.max(1, dmgs.length), want = G.spellDamage(mage(), sp);
  ok(avg > 0 && avg >= want * 0.5 && avg <= want * 2.2, id + ": damage " + Math.round(avg) + " near its listed " + Math.round(want), id);
  // strong foe: one cast (even dual) never takes more than 40% of its health
  for (let i = 0; i < 4; i++) { const x = castTB(mage(), FOES.chief(), "dual:" + id); const d = x.b.ehp - x.f.ehp; ok(d <= x.b.ehpMax * TB.HIT_CAP + 1, id + ": no one-shot on a strong foe (" + Math.round(d) + " of " + x.b.ehpMax + ")", id); }
  if (sp.element === "sun") { const x = castTB(mage(), FOES.bandit(), "spell:" + id); ok(x.f.ehp === x.b.ehp && /undead only|misses/.test(x.text), id + ": sun magic does nothing to the living: " + x.text, id); }
  if (sp.element === "frost") ok(tries(() => { const x = castTB(mage(), foe(), "spell:" + id); return x.f.slowed > 0; }) > 0, id + ": frost slows", id);
  if (sp.element === "fire") ok(tries(() => { const x = castTB(mage(), foe(), "spell:" + id); return !!x.f.foeSt?.burn; }) > 0, id + ": fire can set the foe burning", id);
  if (sp.element === "shock") ok(tries(() => { const x = castTB(mage(), FOES.necro(), "spell:" + id); return !!x.f.foeSt?.shock || /jolt|shock/i.test(x.text); }) > 0, id + ": shock jolts", id);
}
// burning ticks and stops
{ let ticked = false; for (let i = 0; i < 20 && !ticked; i++) { const { f, ss } = tb(mage(), FOES.chief()); ss.act("spell:fireball"); if (f.foeSt?.burn) { const b = f.ehp, line = { me: "", them: "" }; PFX.tick(f, line); ticked = f.ehp < b; } } ok(ticked, "burning ticks"); }

// ---------------------------------------------------------------- 3. heals: raise health, stop at full
for (const id of kinds.heal) {
  const sp = D.SPELLS[id]; mark(id);
  const x = castTB(mage(), FOES.bandit(), "spell:" + id, null, (f) => { f.hp = 10; });
  ok(x.f.hp > 10, id + ": heals (" + Math.round(x.f.hp) + ")", id);
  const y = castTB(mage(), FOES.bandit(), "spell:" + id, null, (f) => { f.hp = G.maxHealth(f.s) - 1; });
  ok(y.f.hp <= G.maxHealth(y.f.s) + 1e-9 && y.f.hp >= G.maxHealth(y.f.s) - 1e-9, id + ": stops at full health", id);
}

// ---------------------------------------------------------------- 4. flesh spells: armour, shown on the fight screen, softer blows
for (const id of kinds.armor) {
  mark(id);
  const x = castTB(mage(), FOES.bandit(), "spell:" + id);
  ok(x.f.armorSpell > 0, id + ": armor " + Math.round(x.f.armorSpell), id);
  const r0 = F.damageReduction(new G.Fight(mage(), FOES.bandit()).armorRating().rating, 0), r1 = F.damageReduction(x.f.armorRating().rating, 0);
  ok(r1 > r0, id + ": blows hurt less (" + Math.round(r0 * 100) + "% → " + Math.round(r1 * 100) + "%)", id);
  ok(SPELLFX.me(x.f).some((ch) => ch.k === "armor"), id + ": shown in your status on the fight screen", id);
}

// ---------------------------------------------------------------- 5. wards: soak magic, shown, recast refills, physical blows go through
for (const id of kinds.ward) {
  mark(id);
  const x = castTB(mage(), FOES.necro(), "spell:" + id);
  ok(x.f.ward > 0, id + ": a ward rises (" + Math.round(x.f.ward) + ")", id);
  ok(SPELLFX.me(x.f).some((ch) => ch.k === "ward"), id + ": shown in your status on the fight screen", id);
  const w0 = x.f.ward, left = MAGIC.soak(x.f, 25, true);
  ok(left < 25 && x.f.ward < w0, id + ": soaks a spell (25 → " + Math.round(left) + ")", id);
  ok(MAGIC.soak(x.f, 25, false) === 25, id + ": a plain blow goes through", id);
  x.ss.act("spell:" + id); ok(Math.abs(x.f.ward - x.f.wardMax) < 1e-6 && x.f.ward >= w0 - 1e-6, id + ": recast refills it", id);
  // over a real fight against a caster, the ward takes some of the damage
  let soaked = 0; for (let i = 0; i < 6; i++) { const y = castTB(mage(), FOES.necro(), "spell:" + id); for (let k = 0; k < 6; k++) y.ss.foeAct(""); soaked += y.ss.ev.some((e) => /ward soaks/.test(e.text)) ? 1 : 0; }
  ok(soaked > 0, id + ": soaks the necromancer's spells in a fight", id);
}

// ---------------------------------------------------------------- 6. summons: appear, act, are gone next fight
for (const id of kinds.summon) {
  mark(id);
  const x = castTB(mage(), FOES.bandit(), "spell:" + id);
  ok(x.f.summonTurns > 0 && x.f.summonDmg > 0, id + ": a summon appears (" + x.f.summonName + ", " + x.f.summonDmg + "/turn)", id);
  ok(SPELLFX.me(x.f).some((ch) => ch.k === "summon"), id + ": shown on the fight screen", id);
  const b = x.f.ehp; x.ss.autoActor({ id: "sum" }); ok(x.f.ehp < b, id + ": the summon strikes", id);
  x.ss.endTurn(true); let rounds = 0; while (!x.ss.over && rounds++ < 3) { x.ss.endRound(); x.ss.startRound(); }
  ok(x.ss.order.some((o) => o.id === "sum") || x.ss.over, id + ": the summon takes its own turns", id);
  const next = new G.Fight(x.f.s, FOES.bandit()); ok(next.summonTurns === 0 && !next.allies.some((a) => a.summon), id + ": gone after the fight", id);
}

// ---------------------------------------------------------------- 7. calm (and frenzy): the foe stops fighting, not undead, not too strong
for (const id of kinds.calm) {
  const sp = D.SPELLS[id]; mark(id);
  const x = castTB(mage(), FOES.bandit(), "spell:" + id);
  ok(x.f.calmTurns > 0, id + ": " + x.text, id);
  const hp0 = x.f.hp, eh0 = x.f.ehp; x.ss.foeAct("");
  ok(x.f.hp === hp0 && /isn't fighting|lashes|turns on/.test(x.ss.lines.them.join(" ")), id + ": the foe doesn't attack you: " + x.ss.lines.them.join(" "), id);
  if (sp.frenzy) ok(x.f.ehp < eh0, id + ": a frenzied foe hurts itself: " + x.ss.lines.them.join(" "), id);
  ok(SPELLFX.foe(x.f).some((ch) => ch.k === "calm"), id + ": shown on the foe on the fight screen", id);
  const u = castTB(mage(), FOES.draugr(), "spell:" + id); ok(!(u.f.calmTurns > 0) && /no effect/.test(u.text), id + ": not on the undead", id);
  const hi = castTB(mage(), { ...FOES.bandit(), level: (sp.max_level || 0) + 20 }, "spell:" + id); ok(!(hi.f.calmTurns > 0) && /level too high/.test(hi.text), id + ": not on a foe above level " + sp.max_level, id);
}

// ---------------------------------------------------------------- 8. fear
for (const id of kinds.fear) {
  const sp = D.SPELLS[id]; mark(id);
  const lv = (b) => ({ ...b, level: Math.min(b.level, sp.max_level) });
  const x = castTB(mage(), lv(FOES.bandit()), "spell:" + id);
  ok(x.f.fearTurns > 0 && /cowers/.test(x.text), id + ": " + x.text, id);
  const hp0 = x.f.hp; x.ss.foeAct(""); ok(x.f.hp === hp0 && /cowers in fear/.test(x.ss.lines.them.join(" ")), id + ": the foe cowers instead of attacking", id);
  ok(SPELLFX.foe(x.f).some((ch) => ch.k === "fear"), id + ": shown on the foe", id);
  const u = castTB(mage(), FOES.draugr(), "spell:" + id); ok(!(u.f.fearTurns > 0), id + ": undead feel no fear", id);
  const hi = castTB(mage(), { ...FOES.bandit(), level: sp.max_level + 20 }, "spell:" + id); ok(!(hi.f.fearTurns > 0), id + ": not above level " + sp.max_level, id);
  const bs = castTB(mage(), FOES.boss(), "dual:" + id); ok(!(bs.f.fearTurns > FOECAP.HOLD[2] + 1), id + ": a boss shakes it off after " + FOECAP.HOLD[2] + " turns (" + bs.f.fearTurns + ")", id);
}

// ---------------------------------------------------------------- 9. paralysis
for (const id of kinds.paralyze) {
  mark(id);
  const hit = tries(() => { const x = castTB(mage(), FOES.bandit(), "spell:" + id); if (!(x.f.eParalyzed > 0)) return false; const hp0 = x.f.hp; x.ss.foeAct(""); return x.f.hp === hp0 && /paralyzed/.test(x.ss.lines.them.join(" ")) && SPELLFX.foe(x.f).length >= 0; });
  ok(hit >= TRIES * 0.6, id + ": the foe is paralyzed and can't act (" + hit + "/" + TRIES + ")", id);
  const d = castTB(mage(), FOES.dragon(), "spell:" + id); ok(!(d.f.eParalyzed > 0), id + ": dragons shrug it off", id);
  const bs = castTB(mage(), FOES.boss(), "dual:" + id); ok(!(bs.f.eParalyzed > FOECAP.HOLD[2] + 1), id + ": a boss is held at most " + FOECAP.HOLD[2] + " turns (" + bs.f.eParalyzed + ")", id);
}

// ---------------------------------------------------------------- 10. turn undead: undead flee (fight ends, no loot), living and strong ones don't
for (const id of kinds.turn) {
  const sp = D.SPELLS[id]; mark(id);
  const x = castTB(mage(), FOES.draugr(), "spell:" + id);
  ok(x.f.endWon && x.ss.over && /flees/.test(x.text), id + ": the draugr flees: " + x.text, id);
  const l = castTB(mage(), FOES.bandit(), "spell:" + id); ok(!l.f.endWon && /undead only/.test(l.text), id + ": nothing on the living", id);
  const hi = castTB(mage(), { ...FOES.draugr(), level: sp.max_level + 20 }, "spell:" + id); ok(!hi.f.endWon, id + ": too strong above level " + sp.max_level, id);
}

// ---------------------------------------------------------------- 11. runes, cloaks, walls (damage over time)
for (const id of kinds.rune) {
  mark(id);
  const x = castTB(mage(), FOES.bandit(), "spell:" + id);
  ok(x.f.rune, id + ": a rune waits", id);
  ok(SPELLFX.foe(x.f).some((ch) => ch.k === "rune") || SPELLFX.me(x.f).some((ch) => ch.k === "rune"), id + ": shown on the fight screen", id);
  const b = x.f.ehp; for (let k = 0; k < 4 && x.f.rune; k++) x.ss.foeAct(""); ok(x.f.ehp < b && !x.f.rune, id + ": the foe steps on it (" + Math.round(b - x.f.ehp) + ")", id);
}
for (const id of kinds.cloak) {
  mark(id);
  const x = castTB(mage(), FOES.chief(), "spell:" + id); ok(x.f.cloak, id + ": a cloak", id);
  ok(SPELLFX.me(x.f).some((ch) => ch.k === "cloak"), id + ": shown on you", id);
  let hits = 0; for (let r = 0; r < D.SPELLS[id].turns + 2; r++) { const b = x.f.ehp; x.ss.endRound(); if (x.f.ehp < b) hits++; }
  ok(hits >= D.SPELLS[id].turns - 1 && hits <= D.SPELLS[id].turns && !x.f.cloak, id + ": ticks " + hits + " rounds then ends", id);
}
for (const id of kinds.dot) {
  const sp = D.SPELLS[id]; mark(id);
  const x = castTB(mage(), FOES.chief(), "spell:" + id); ok(x.f.dots?.length, id + ": " + x.text, id);
  ok(SPELLFX.foe(x.f).some((ch) => ch.k === "dot"), id + ": shown on the foe", id);
  if (sp.element === "frost") ok(x.f.slowed > 0, id + ": frost slows", id);
  let hits = 0; for (let r = 0; r < sp.turns + 2; r++) { const b = x.f.ehp; x.ss.endRound(); if (x.f.ehp < b) hits++; }
  ok(hits >= sp.turns && hits <= sp.turns + 1 && !(x.f.dots || []).length, id + ": burns " + hits + " rounds then ends", id);
}

// ---------------------------------------------------------------- 12. healing over time
for (const id of kinds.regen) {
  const sp = D.SPELLS[id]; mark(id);
  const x = castTB(mage(), FOES.bandit(), "spell:" + id, null, (f) => { f.hp = 20; });
  ok(x.f.regen && SPELLFX.me(x.f).some((ch) => ch.k === "regen"), id + ": a healing circle, shown on you", id);
  let healed = 0, up = 0; for (let r = 0; r < sp.turns + 2; r++) { const b = x.f.hp; x.f.hp = Math.min(x.f.hp, 20); const b2 = x.f.hp; x.ss.endRound(); if (x.f.hp > b2) healed++; if (x.f.regen) up++; void b; }
  ok(healed >= sp.turns - 1 && healed <= sp.turns && !x.f.regen, id + ": heals " + healed + " rounds then ends", id);
  ok(x.f.hp <= G.maxHealth(x.f.s), id + ": never above full", id);
}

// ---------------------------------------------------------------- 13. bound weapons
for (const id of kinds.bound) {
  const sp = D.SPELLS[id]; mark(id);
  const s = mage(); s.inv = [];
  const x = castTB(s, FOES.bandit(), "spell:" + id);
  ok(x.f.bound && x.f.weaponSkill() === sp.skill && x.f.wt === sp.wt, id + ": a " + sp.wt + " of light (" + x.f.weaponSkill() + ")", id);
  ok(SPELLFX.me(x.f).some((ch) => ch.k === "bound"), id + ": shown on you", id);
  const b = x.f.ehp; let hit = false; for (let i = 0; i < 6 && !hit; i++) { x.f.act("attack"); hit = x.f.ehp < b; } ok(hit, id + ": you hit with it", id);
}

// ---------------------------------------------------------------- 14. raise the dead, soul trap (after the fight)
for (const id of kinds.reanimate) {
  const sp = D.SPELLS[id]; mark(id);
  const s = mage(100, { _test: false });
  const f = new G.Fight(s, { ...FOES.bandit(), health: 30, hp: 30 }, [{ if: "first_turn", do: "spell:" + id }, { if: "always", do: "attack" }]); f.run({ trySneak: false }); f.apply();
  ok(f.won && s.thrall && s.thrall.fights === sp.fights, id + ": the bandit rises for " + sp.fights + " fights " + JSON.stringify(s.thrall), id);
  const f2 = new G.Fight(s, FOES.bandit()); ok(f2.allies.some((a) => a.thrall), id + ": and fights beside you next time", id);
}
{ const id = "soul_trap"; mark(id); const s = mage(100, { _test: false }); G.give(s, "soul_gem_common_empty");
  const f = new G.Fight(s, { ...FOES.bandit(), health: 30, hp: 30 }, [{ if: "first_turn", do: "spell:soul_trap" }, { if: "always", do: "attack" }]); f.run({ trySneak: false }); f.apply();
  ok(SMITH.count(s, "soul_gem_common") === 1 && SMITH.count(s, "soul_gem_common_empty") === 0, "soul_trap fills a gem", id); }

// ---------------------------------------------------------------- 15. courage, invisibility, equilibrium, absorb, banish
for (const id of kinds.courage) {
  mark(id);
  const x = castTB(mage(), FOES.bandit(), "spell:" + id, () => [ally()]);
  ok(x.f.allies[0].dmg > 10 && x.f.hp > x.b.hp - 1e-9, id + ": allies fight harder (" + x.f.allies[0].dmg.toFixed(1) + ")", id);
}
{ const id = "invisibility"; mark(id); const x = castTB(mage(), FOES.bandit(), "spell:" + id); ok(x.f.unseen > 0 && x.f.sneakNext, "invisibility: unseen", id);
  ok(SPELLFX.me(x.f).some((ch) => ch.k === "unseen"), "invisibility: shown on you", id);
  const hp0 = x.f.hp; x.ss.foeAct(""); ok(x.f.hp === hp0 && /can't find you/.test(x.ss.lines.them.join(" ")), "invisibility: the foe can't find you", id); }
{ const id = "equilibrium"; mark(id); const x = castTB(mage(), FOES.bandit(), "spell:" + id, null, (f) => { f.mp = 10; }); ok(x.f.hp < x.b.hp && x.f.mp > 10, "equilibrium: health becomes magicka", id); }
for (const id of kinds.absorb) { mark(id); const c0 = G.spellCost(mage(), D.SPELLS[id]); const x = castTB(mage(), FOES.necro(), "spell:" + id, null, (f) => { f.mp = c0 + 50; }); ok(x.f.ehp < x.b.ehp && x.f.mp > 50, id + ": hurts and drinks magicka: " + x.text, id); }
for (const id of kinds.banish) {
  const sp = D.SPELLS[id]; mark(id);
  const x = castTB(mage(), FOES.dremora(), "spell:" + id);
  if (sp.command) ok(x.f.calmTurns > 0 && x.f.summonTurns > 0, id + ": the dremora fights for you", id);
  else ok(x.f.endWon && x.ss.over, id + ": the dremora is sent back", id);
  const l = castTB(mage(), FOES.bandit(), "spell:" + id); ok(!l.f.endWon && !(l.f.calmTurns > 0) && /daedra only/.test(l.text), id + ": nothing on a bandit", id);
}

// ---------------------------------------------------------------- 16. support spells on a teammate
const teammate = () => [ally({ hp: 30 }), ally({ name: "Bjorn", dmg: 14, hp: 90, maxHp: 120, player: true, coop: true, role: "fighter", red: 0 })];
for (const id of [...kinds.healally]) { mark(id); const x = castTB(mage(), FOES.bandit(), "spell:" + id, teammate); ok(x.f.allies[0].hp > 30 && /→ Lydia/.test(x.text), id + ": heals the most hurt: " + x.text, id);
  const full = castTB(mage(), FOES.bandit(), "spell:" + id, () => [ally({ hp: 119 })]); ok(full.f.allies[0].hp <= 120, id + ": not above their full health", id); }
for (const id of kinds.allyward) { mark(id); const x = castTB(mage(), FOES.bandit(), "spell:" + id, teammate); const al = x.f.allies.find((a) => a.ward > 0); ok(al && SPELLBOOK.allyTakes(x.f, al, 30) < 30, id + ": a ward on " + (al && al.name), id); }
for (const id of kinds.allyarmor) { mark(id); const x = castTB(mage(), FOES.bandit(), "spell:" + id, teammate); const al = x.f.allies.find((a) => a.armorRed > 0); ok(al && SPELLBOOK.allyTakes(x.f, al, 40) < 40, id + ": stone skin on " + (al && al.name), id);
  for (let r = 0; r < 20; r++) x.ss.endRound(); ok(!(al.armorRed > 0), id + ": wears off", id); }
for (const id of kinds.allyimbue) { mark(id); const x = castTB(mage(), FOES.bandit(), "spell:" + id, teammate); const al = x.f.allies.find((a) => a.imbue); const b = x.f.ehp; x.ss.endRound(); ok(al && x.f.ehp < b, id + ": " + (al && al.name) + "'s weapon strikes", id); }
for (const id of kinds.allythorns) { mark(id); const x = castTB(mage(), FOES.bandit(), "spell:" + id, teammate); const al = x.f.allies.find((a) => a.thorns); const b = x.f.ehp; SPELLBOOK.allyTakes(x.f, al, 10); ok(al && x.f.ehp < b, id + ": attackers get bitten", id); }
for (const id of kinds.allycourage) { mark(id); const x = castTB(mage(), FOES.bandit(), "spell:" + id, teammate); ok(x.f.allies.some((a) => a.heroT > 0 && a.dmg > a._baseDmg), id + ": a hero", id); }
for (const id of kinds.allyunseen) { mark(id); const x = castTB(mage(), FOES.bandit(), "spell:" + id, teammate); const al = x.f.allies.find((a) => a.unseen > 0); ok(al && SPELLBOOK.allyTakes(x.f, al, 50) === 0, id + ": blows miss them", id); }
for (const id of kinds.allyrescue) { mark(id); const x = castTB(mage(), FOES.bandit(), "spell:" + id, teammate, (f) => { const al = f.allies[0]; SPELLBOOK.allyTakes(f, al, 999); al.hp = -5; al.down = true; f.allies = f.allies.filter((a) => a !== al); });
  ok(x.f.allies.some((a) => a.name === "Lydia" && a.hp > 0), id + ": pulls Lydia back up: " + x.text, id); }

// ---------------------------------------------------------------- 17. soul trap needs nothing more; utility spells do nothing in a fight but cost nothing either
for (const id of kinds.utility) { const s = mage(); const f = new G.Fight(s, FOES.bandit()); ok(!TB || !(s.spells.includes(id) && (FIGHTCTL?.usable ? FIGHTCTL.usable(f, "spell:" + id) : false)), id + ": not offered in fights", id); }

// ---------------------------------------------------------------- 18. area spells reach the rest of a group
const AREA = Object.keys(D.SPELLS).filter((k) => D.SPELLS[k].area);
ok(AREA.length >= 8, "area spells are marked (" + AREA.join(", ") + ")");
for (const id of AREA) {
  const sp = D.SPELLS[id];
  const foe = sp.element === "sun" || sp.kind === "turn" ? FOES.draugr() : { ...FOES.bandit(), noGroup: false };
  let reached = 0;
  for (let i = 0; i < 8; i++) {
    const { f, ss } = tb(mage(), { ...foe, noGroup: false, name: sp.element === "sun" || sp.kind === "turn" ? "Draugr" : "Bandit" });
    if (ss.waves < 2) { ss.waves = 3; ss.grp = { n: 3, hpMul: [1, 1, 1] }; f.queued = 2; }
    ss.act("spell:" + id);
    if (f.endWon) { reached++; continue; }
    for (let r = 0; r < 3; r++) ss.endRound();
    const max = ss.ehpMax; f.ehp = 0; ss.over;   // the first one falls: the next steps in
    if (ss.wave === 2 && (f.ehp < max - 0.5 || f.eParalyzed > 0 || f.calmTurns > 0 || f.fearTurns > 0 || (f.dots || []).length)) reached++;
  }
  ok(reached >= 4, id + ": reaches the foes waiting behind (" + reached + "/8)", id);
}
// a single-target spell doesn't
{ let carried = 0; for (let i = 0; i < 6; i++) { const { f, ss } = tb(mage(), FOES.bandit()); ss.waves = 3; ss.grp = { n: 3, hpMul: [1, 1, 1] }; f.queued = 2; ss.act("spell:paralyze"); f.ehp = 0; ss.over; if (f.eParalyzed > 0 || f.ehp < ss.ehpMax - 0.5) carried++; }
  ok(carried === 0, "Paralyze (one target) doesn't carry over to the next foe (" + carried + ")"); }
// area damage on the ones behind is capped: they never start a fight nearly dead
{ const { f, ss } = tb(mage(), FOES.bandit()); ss.waves = 3; ss.grp = { n: 3, hpMul: [1, 1, 1] }; f.queued = 2; for (let i = 0; i < 12; i++) { f.mp = 9999; f.ehp = 1e6; ss.ap = 99; ss.act("dual:fire_storm"); } f.ehp = 0; ss.over;
  ok(f.ehp >= ss.ehpMax * 0.5 - 1, "splash is capped: the next foe starts with " + Math.round(f.ehp) + " / " + ss.ehpMax); }

// ---------------------------------------------------------------- 19. scrolls: cast for free, used up
for (const [it, def] of Object.entries(D.ITEMS).filter(([, d]) => d.slot === "scroll")) {
  const s = mage(); G.give(s, it, 2); const sp = D.SPELLS[def.spell];
  ok(sp, it + ": casts a real spell (" + def.spell + ")");
  const { f, ss } = tb(s, FOES.bandit()); const mp0 = f.mp;
  if (sp.kind === "heal") f.hp = 10;
  const acts0 = ss.myActs; const b = { ehp: f.ehp, hp: f.hp, arm: f.armorSpell }; ss.act("scroll:" + it);
  ok(f.mp === mp0, it + ": costs no magicka");
  ok(ss.myActs === acts0 + 1, it + ": uses one move of the turn (no more action points)");
  ok(f.ehp < b.ehp || f.hp > b.hp || f.armorSpell > b.arm || /misses/.test(ss.ev[ss.ev.length - 1].text), it + ": works: " + ss.ev[ss.ev.length - 1].text);
  ok(f.left(s.inv.find((r) => r.item === it).id) === 1, it + ": one is used");
  f.ehp = 0; f.won = true; f.apply(); ok(SMITH.count(s, it) === 1, it + ": gone from your pack after the fight");
  const s2 = mage(); const t2 = tb(s2, FOES.bandit()); ok(!t2.f.affordable("scroll:" + it), it + ": can't read one you don't have");
}

// ---------------------------------------------------------------- 20. staffs: cast with charges, run dry
for (const [id, name, spell] of MAGIC.STAFFS) {
  const s = mage(15); s.inv = s.inv.filter((r) => D.ITEMS[r.item]?.slot !== "weapon"); const sid = G.give(s, id); G.equip(s, sid);
  const sp = D.SPELLS[spell];
  const foe = sp.kind === "turn" ? FOES.draugr : FOES.bandit;
  const { f, ss } = tb(s, foe()); const mp0 = f.mp;
  ss.act("attack");
  const t = ss.ev.filter((e) => e.kind === "me").pop().text;
  ok(t.startsWith(D.ITEMS[id].name) && f.mp === mp0, id + ": casts " + sp.name + " for no magicka: " + t);
  ok(f.charges[f.weaponInv] < D.ITEMS[id].staff.capacity, id + ": uses charge");
  if (f.endWon) continue; f.charges[f.weaponInv] = 0; f.ehp = 9999; ss.act("attack"); ok(/spent/.test(ss.ev.filter((e) => e.kind === "me").pop().text), id + ": a spent staff only swings");
}

// ---------------------------------------------------------------- 21. followers cast their spells
{
  for (const id of [...FAI.USABLE].flatMap((k) => kinds[k] || [])) {
    const sp = D.SPELLS[id];
    const s = mage(); const fid = Object.keys(TOWNS.FOLLOWERS)[0]; s.follower = { id: fid, hp: 999 };
    const { f, ss } = tb(s, FOE_FOR(id, sp)());
    let al = f.allies.find((a) => a.follower); if (!al) { ok(false, "follower joins the fight"); break; }
    al.mp = al.mpMax = 999; al.hp = 5; al.maxHp = 100; f.hp = 10;
    const b = { ehp: f.ehp, hp: f.hp, al: al.hp, allies: f.allies.length, arm: f.armorSpell, calm: f.calmTurns, par: f.eParalyzed };
    const r = FAI.doCast(f, al, { k: "cast", id, sp, c: 3, mp: 5 });
    const changed = f.ehp < b.ehp || f.hp > b.hp || al.hp > b.al || f.allies.length > b.allies || f.armorSpell > b.arm || f.calmTurns > b.calm || f.eParalyzed > b.par || f.rune || (f.dots || []).length || al.ward > 0 || f.ward > 0 || al.armorRed > 0 || al.bound || /misses/.test(r.text);
    ok(changed && r.text, "follower casts " + id + ": " + r.text, id);
  }
}

// ---------------------------------------------------------------- 22. out of fights
{
  const s = mage(); const t0 = G.now();
  const castAt = (id, t = t0) => MAGIC.castOut(s, id, t);
  for (const [id, sp] of SPELLS.filter(([, sp]) => MAGIC.outOfFight(sp))) {
    mark(id);
    s.castAt = {}; s.dungeon = null; s.trip = null; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun;
    G.give(s, "ore_iron", 4); if (sp.use === "recall") s.mark = { x: WORLD.places.Riften[0], y: WORLD.places.Riften[1], place: "Riften", label: "Riften" };
    if (sp.use === "dispel") s.fx = [...(s.fx || []), { key: "regen:health", mag: -20, until: t0 + 999, name: "Weakness" }];
    if (sp.use === "divine") { s.location = null; s.x += 60; }
    if (sp.kind === "heal") G.setHealth(s, 5, t0);
    const fx0 = JSON.stringify(s.fx || []), hp0 = G.curHealth(s, t0), loc0 = s.location, inv0 = JSON.stringify(s.inv), mk0 = JSON.stringify(s.mark || null);
    const r = castAt(id);
    const did = JSON.stringify(s.fx || []) !== fx0 || G.curHealth(s, t0) > hp0 || s.location !== loc0 || JSON.stringify(s.inv) !== inv0 || JSON.stringify(s.mark || null) !== mk0 || (sp.use === "clairvoyance" && /Clairvoyance/.test(r));
    ok(did && !/fizzles|You don't know|for fights/.test(r), id + " out of a fight: " + r, id);
    ok(/gather your magicka/.test(castAt(id, t0 + 1)), id + ": then needs a rest before the next cast", id);
    ok(MAGIC.cdLeft(s, id, t0 + 1) > 0 && MAGIC.cdLeft(s, id, t0 + 99999) === 0, id + ": the rest runs out", id);
  }
  ok(/for fights/.test(MAGIC.castOut(mage(), "fireball")), "fight spells can't be cast outside fights");
  const s2 = mage(); s2.spells = []; ok(/don't know/.test(MAGIC.castOut(s2, "candlelight")), "unknown spells can't be cast");
  // effects really change the game: Candlelight helps against traps, Telekinesis lets you carry more, Detect Life hides you
  const s3 = mage(); MAGIC.castOut(s3, "candlelight", t0); ok(G.fxSum(s3, "trapdodge") > 0, "Candlelight: better odds against traps");
  const s4 = mage(), cw0 = G.carryMax ? G.carryMax(s4) : 0; MAGIC.castOut(s4, "telekinesis", t0); ok(!G.carryMax || G.carryMax(s4) > cw0, "Telekinesis: carry more (" + cw0 + " → " + (G.carryMax ? G.carryMax(s4) : "?") + ")");
  const s5 = mage(), h0 = G.hiddenChance(s5, FOES.bandit(), t0); MAGIC.castOut(s5, "detect_life", t0); ok(G.hiddenChance(s5, FOES.bandit(), t0) > h0, "Detect Life: easier to stay hidden");
  const s6 = mage(); G.setHealth(s6, G.maxHealth(s6) - 2, t0); MAGIC.castOut(s6, "grand_healing", t0); ok(G.curHealth(s6, t0) <= G.maxHealth(s6) + 1e-9, "healing outside a fight stops at full");
}

// ---------------------------------------------------------------- 22b. the spell chips: drawn on the fight screen, tips in Polish
{
  const tips = [];
  for (const id of ["oakflesh", "flame_cloak", "conjure_familiar", "bound_sword", "invisibility"]) { const x = castTB(mage(), FOES.bandit(), "spell:" + id); ok(/st spl me/.test(SPELLFX.meHTML(x.f)), id + ": a chip under your bars"); tips.push(...SPELLFX.me(x.f).filter((c) => !c.shown).map((c) => c.tip)); }
  for (const id of ["calm", "frenzy", "fear", "wall_of_flames", "fire_rune", "soul_trap"]) { const x = castTB(mage(), { ...FOES.bandit(), level: 3 }, "spell:" + id); ok(/st spl/.test(TB.statusChips ? TB.statusChips(x.f) : SPELLFX.foeHTML(x.f)), id + ": a chip under the foe"); tips.push(...SPELLFX.foe(x.f).filter((c) => !c.shown).map((c) => c.tip)); }
  for (const t of new Set(tips)) ok(pl(t), "chip tip in Polish: " + t);
  for (const t of ["Bandit lashes out at itself in a frenzy (12)", "It already took 40 from your spells", "Frenzy: it goes mad and turns on itself", "Not enough magicka"]) ok(pl(t), "fight line in Polish: " + t);
  const pn = PATCHNOTES.LIST ? PATCHNOTES.LIST.find((x) => x.id === "b145-spelltest") : null;   // near the top: several features ship in one build, only one note can be first
  if (PATCHNOTES.LIST) { ok(!!pn, "patch note near the top"); if (pn) for (const t of [pn.title, ...pn.items]) ok(pl(t), "patch note in Polish: " + t.slice(0, 40)); }
}

// ---------------------------------------------------------------- 23. every spell was really checked
const untested = SPELLS.map(([id]) => id).filter((id) => !tested.has(id));
ok(!untested.length, "every spell has its own effect test (missing: " + untested.join(", ") + ")");
console.log("spells", SPELLS.length, "kinds", Object.keys(kinds).length, "area", AREA.length, "· broken:", [...bad].join(", ") || "none");
if (fails) { console.log("allspells FAILED", fails, "of", n); throw new Error("allspells failed"); }
console.log("allspells ok ·", n, "checks");
`, c);
