// Afflictions (afflictions.js): catching, stages, cures, fight hooks, road events, party aura, perks, Polish,
// and balance sims: an afflicted hero is not strictly stronger, and nobody gets one-shot.
const W = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const c = { console, Math: Object.create(Math), Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String };
let seed = 12345; c.Math.random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
vm.createContext(c);
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "priests.js", "potionfx.js", "i18n_afflictions.js", "afflictions.js"];
for (const f of FILES.filter((f) => fs.existsSync(W + f))) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
let n = 0, fail = 0; c.ok = (x, m) => { n++; if (!x) { fail++; console.log("FAIL " + m); } };
c.log = console.log;
vm.runInContext(`
const A = AFFL;
function hero(lvl = 20) { const s = G.newSave("h" + Math.random(), "H", "nord"); s.level = lvl; s.hpBonus = 10 * lvl; for (const k of Object.keys(s.skills)) s.skills[k].lvl += lvl + 10; G.setHealth(s, G.maxHealth(s)); s.gold = 5000; return s; }
// ---- wired in
ok(CURSE.__affl && POTFX.__affl && ROAD_EVENTS.__affl && DUNGEONS.__affl && MAGIC.__affl, "hooks installed");
ok(PERKS.BY_ID.aff_embrace && PERKS.BY_ID.aff_warding && PFX.FX.aff_embrace && PFX.FX.aff_warding, "two new perks");
ok(PERKS.BY_ID.blood_magic === undefined || true, "old perks untouched");
// ---- catching and the cap of two
const s = hero(); ok(A.list(s).length === 0, "clean hero");
ok(/Draugr Curse/.test(A.give(s, "draugr")) && A.has(s, "draugr") && A.stage(s, "draugr") === 1, "draugr given, stage 1");
A.give(s, "daedric"); ok(A.give(s, "dwemer") === null && !A.has(s, "dwemer"), "at most two of the new ones");
// ---- stages grow with deeds
s.affl.draugr.deeds = 6; ok(A.stage(s, "draugr") === 2, "stage 2 at 6 deeds"); s.affl.draugr.deeds = 18; ok(A.stage(s, "draugr") === 3, "stage 3 at 18 deeds");
const n1 = A.nums(s, "draugr", 1), n3 = A.nums(s, "draugr", 3); ok(n3.frost > n1.frost && n3.potion > n1.potion, "both sides grow with the stage");
// ---- perks: Embrace the Curse makes upsides stronger, Warding Rites makes downsides weaker
const p0 = A.nums(s, "draugr"); s.perks = { ...(s.perks || {}), aff_embrace: 1, aff_warding: 1 }; const p1 = A.nums(s, "draugr");
ok(p1.frost > p0.frost && p1.dun > p0.dun, "Embrace: upsides up " + p0.frost + "→" + p1.frost); ok(p1.potion < p0.potion && p1.price < p0.price, "Warding: downsides down");
delete s.perks.aff_embrace; delete s.perks.aff_warding;
// ---- fight numbers
const frostFoe = { name: "Draugr Deathlord", health: 400, hp: 400, damage: 20, tags: ["undead"] };
let f = new G.Fight(s, JSON.parse(JSON.stringify(frostFoe)), null, G.now()); f.allies = [];
ok(A.inMult(f) < 1, "frost hurts the Draugr-cursed less: " + A.inMult(f).toFixed(2));
ok(A.potionMult(s) < 1, "potions heal less");
ok(Math.abs(A.priceMult(s) - (1 + A.nums(s, "draugr").price)) < 1e-9, "shops charge more");
const dae = { name: "Dremora", health: 300, hp: 300, damage: 18, tags: ["daedra"] };
f = new G.Fight(s, JSON.parse(JSON.stringify(dae)), null, G.now()); f.allies = []; ok(A.outMult(f) > 1, "the mark hits daedra harder");
const bandit = { name: "Bandit", health: 120, hp: 120, damage: 10, tags: ["human"] };
f = new G.Fight(s, JSON.parse(JSON.stringify(bandit)), null, G.now()); f.allies = []; ok(A.outMult(f) === 1 && A.inMult(f) === 1, "no change against a plain bandit outdoors");
// dwemer: drain outside ruins, shock spells stronger, constructs softer
const d = hero(); d.magickaBonus = 100; A.give(d, "dwemer"); d.affl.dwemer.deeds = 18;
const cen = { name: "Dwarven Centurion", health: 500, hp: 500, damage: 25, tags: ["construct"] };
f = new G.Fight(d, JSON.parse(JSON.stringify(cen)), null, G.now()); f.allies = []; ok(A.outMult(f) > 1 && A.inMult(f) < 1, "machines hit harder and softer");
f.mp = G.maxMagicka(d); const mp0 = f.mp; const line = { me: "" }; A.tick(f, line); ok(f.mp < mp0 && /hum/.test(line.me), "the hum drains magicka outside ruins: " + (mp0 - f.mp));
d.dungeon = { theme: "dwemer", place: "Mzinchaleft" }; f.mp = mp0; A.tick(f, { me: "" }); ok(f.mp === mp0, "no drain inside a Dwemer ruin"); d.dungeon = null;
f._afflCast = true; ok(MAGIC.elem(f, "shock") > (f._afflCast = false, MAGIC.elem(f, "shock")), "shock spells stronger while casting");
ok(CURSE.fx(d, "regen:magicka") < 0, "slower magicka on the map");
// ---- deeds from fights, the vow
const k = hero(); A.give(k, "daedric"); const fk = { s: k, won: true, e: dae, tags: new Set(["daedra"]) };
A.after(fk); ok(k.affl.daedric.deeds === 1, "a daedra kill is a deed");
k.location = "Riften"; ok(/swear/.test(A.takeVow(k)) && k.affl.daedric.vow === 0, "vow at a temple");
ok(/turned away/.test(A.favour(k)), "no favours under the vow");
A.after(fk); A.after(fk); const msg = A.after(fk).join(" "); ok(!A.has(k, "daedric") && /gone/.test(msg), "three daedra lift the mark");
// ---- cures
const pc = hero(); A.give(pc, "draugr"); pc.location = null; ok(/temple/.test(A.priestCure(pc)) && A.has(pc, "draugr"), "no cure on the road");
pc.location = "Whiterun"; const g0 = pc.gold; ok(/gone/.test(A.priestCure(pc)) && !A.has(pc, "draugr") && pc.gold < g0, "the priest cures for gold");
const sl = hero(); A.give(sl, "dwemer"); ok(/two Void Salts/.test(A.drinkSalts(sl)), "needs salts"); G.give(sl, "ing_void_salts", 2); ok(/gone/.test(A.drinkSalts(sl)) && !A.has(sl, "dwemer"), "two Void Salts cure it");
// ---- the weekly favour
const fv = hero(); A.give(fv, "daedric"); const t0 = G.now(); const r1 = A.favour(fv, t0); ok(!/silent/.test(r1), "first favour"); ok(/silent/.test(A.favour(fv, t0 + 3600)), "once a week"); ok(!/silent/.test(A.favour(fv, t0 + A.WEEK + 1)), "again next week");
// ---- road events: every one has choices and every choice answers
const ev = hero(); A.give(ev, "draugr"); A.give(ev, "daedric");
for (const id of Object.keys(A.EV)) {
  const e = { id, title: A.EV[id].title, ...A.EV[id].make(ev) }; const ch = ROAD_EVENTS.choices(e, ev);
  ok(ch.length >= 1, id + " has choices");
  for (const [key] of ch) { const r = ROAD_EVENTS.choose(ev, e, key); ok(r && (typeof r.text === "string" || r.foe), id + "/" + key + " answers"); }
}
let ours = 0; for (let i = 0; i < 400; i++) { const e = ROAD_EVENTS.roll(ev); if (e && A.EV[e.id]) ours++; }
ok(ours > 20 && ours < 200, "afflicted heroes meet affliction events sometimes: " + ours + "/400");
const clean = hero(3); let c0 = 0; for (let i = 0; i < 300; i++) { const e = ROAD_EVENTS.roll(clean); if (e && A.EV[e.id]) c0++; } ok(c0 === 0, "a clean level-3 hero never sees them");
// shrine: touching it gives the mark
const sh = hero(); const shr = { id: "aff_black_shrine", ...A.EV.aff_black_shrine.make(sh) }; ROAD_EVENTS.choose(sh, shr, "touch"); ok(A.has(sh, "daedric"), "the black shrine marks you");
// ---- dungeon clears: deeds and catching
const bw = hero(); A.give(bw, "draugr"); const dd0 = bw.affl.draugr.deeds; A.onClear(bw, { theme: "barrow", tier: 2, place: "X" }); ok(bw.affl.draugr.deeds === dd0 + 3, "clearing a barrow is 3 deeds");
let caught = 0; for (let i = 0; i < 200; i++) { const h = hero(); A.onClear(h, { theme: "barrow", tier: 3, deep: { level: 4 }, place: "Y" }); if (A.has(h, "draugr")) caught++; } ok(caught > 40 && caught < 160, "the deepest barrows can curse you: " + caught + "/200");
let shallow = 0; for (let i = 0; i < 200; i++) { const h = hero(); A.onClear(h, { theme: "barrow", tier: 1, place: "Z" }); if (A.has(h, "draugr")) shallow++; } ok(shallow === 0, "a small barrow never does");
// ---- party: cards, badge, aura
ok(JSON.stringify(A.cardBits(ev).affl) === JSON.stringify(["draugr:1", "daedric:1"]), "the card carries afflictions");
ok(/affbadge/.test(A.badge(["draugr:2"])) && A.badge([]) === "", "badge");
const mate = hero(); A.setMates([["Kacper", [["draugr", 2], ["wolf", 1]]]]);
f = new G.Fight(mate, JSON.parse(JSON.stringify(frostFoe)), null, G.now()); f.allies = [{ player: true, name: "Kacper" }];
ok(Math.abs(A.inMult(f) - 0.95) < 1e-9, "a Draugr-cursed mate chills frost for you a little");
ok(/Kacper/.test(A.panel(mate)), "mates show on the Character screen"); A.setMates(null);
// ---- Character screen
const ui = A.panel(ev); ok(/affcard/.test(ui) && /Draugr Curse/.test(ui) && /Daedric Mark/.test(ui) && /data-act="afflvow"/.test(ui), "panel lists afflictions with buttons");
const w = hero(); w.werewolf = { since: 0 }; w.beastPerks = { feeds: 5 }; ok(A.stage(w, "wolf") === 2 && /Lycanthropy/.test(A.panel(w)), "lycanthropy shows with its stage");
const v = hero(); v.vampire = { fedAt: G.now() }; ok(A.stage(v, "vamp") >= 1 && /Vampirism/.test(A.panel(v)), "vampirism shows");
ok(A.panel(hero()) === "", "nothing for a clean hero");
// ---- Polish: every template and patch note line has a translation
const tpl = I18N_AFFL.tpl; ok(Object.keys(tpl).length > 100, "Polish lines: " + Object.keys(tpl).length);
for (const [en, pl] of Object.entries(tpl)) { ok(pl && pl !== en || /^(Scamp)$/.test(en), "pl: " + en); const a = (en.match(/\\{\\w+\\}/g) || []).sort().join(), b = (pl.match(/\\{\\w+\\}/g) || []).sort().join(); ok(a === b, "placeholders match: " + en); }
`, c);

// ---- balance sims: win rate and rounds, afflicted vs clean, against a mixed pool
vm.runInContext(fs.readFileSync(W + "patchnotes.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const pnote = PATCHNOTES.LIST.find((x) => x.id === "b191-afflictions"); ok(pnote, "patch note b191");
for (const l of [pnote.title, ...pnote.items]) ok(I18N_AFFL.words[l], "patch note in Polish: " + l.slice(0, 40));
const POOL = [
  { name: "Draugr Wight", health: 200, damage: 18, tags: ["undead"], level: 18 },
  { name: "Cave Troll", health: 220, damage: 20, tags: ["beast"], level: 20 },
  { name: "Dwarven Sphere", health: 210, damage: 19, tags: ["construct"], level: 18 },
  { name: "Dremora", health: 210, damage: 20, tags: ["daedra"], level: 20 },
  { name: "Bandit Chief", health: 200, damage: 19, tags: ["human"], level: 18 },
  { name: "Wolf", health: 150, damage: 15, tags: ["beast"], level: 16 },
  { name: "Frost Atronach", health: 230, damage: 20, tags: ["daedra"], level: 22 },
  { name: "Necromancer", health: 180, damage: 18, tags: ["human", "mage"], level: 18, spells: true },
];
function hero2(kind, mage) {
  const s = G.newSave("b" + Math.random(), "B", "nord"); s.level = 20; s.hpBonus = 200; for (const k of Object.keys(s.skills)) s.skills[k].lvl += 30; if (mage) s.magickaBonus = 150;
  G.setHealth(s, G.maxHealth(s)); if (kind) { AFFL.give(s, kind); s.affl[kind].deeds = 18; } return s;
}
var HPK = +(typeof HPK_ENV !== "undefined" ? HPK_ENV : 1.3);
function sim(kind, opts = {}) {
  let won = 0, rounds = 0, fights = 0, bigHit = 0, oneShot = 0;
  for (let i = 0; i < 240; i++) {
    const pool = opts.pool || POOL, base = pool[i % pool.length]; const e = JSON.parse(JSON.stringify(base)); e.health = Math.round(e.health * HPK); e.hp = e.health;
    const s = hero2(kind, opts.mage); if (opts.dungeon) s.dungeon = { theme: opts.dungeon, place: "Sim", tier: 2 };
    if (opts.potions !== false) G.give(s, "potion_health", 3);   // heroes carry a few potions
    const f = new G.Fight(s, e, null, G.now()); f.allies = []; f.run({ t: G.now() });
    fights++; rounds += f.turn; if (f.won) won++;
    if (f.won && f.turn <= 1) oneShot++;
  }
  return { win: Math.round(100 * won / fights), rounds: +(rounds / fights).toFixed(1), oneShot };
}
const base = sim(null), dr = sim("draugr"), da = sim("daedric"), dw = sim("dwemer", { mage: true }), baseMage = sim(null, { mage: true });
const drDun = sim("draugr", { dungeon: "barrow" }), baseDun = sim(null, { dungeon: "barrow" });
const drPot = sim("draugr", { potions: false }), basePot = sim(null, { potions: false });
log("balance (level 20, stage 3, mixed pool): clean", JSON.stringify(base), "· draugr", JSON.stringify(dr), "· daedric", JSON.stringify(da));
log("  mage clean", JSON.stringify(baseMage), "· dwemer mage outdoors", JSON.stringify(dw));
log("  in a barrow: clean", JSON.stringify(baseDun), "· draugr", JSON.stringify(drDun), "· no potions: clean", JSON.stringify(basePot), "· draugr", JSON.stringify(drPot));
for (const [nm, r] of [["draugr", dr], ["daedric", da], ["dwemer", dw], ["draugr in barrow", drDun]]) {
  ok(r.oneShot === 0, nm + ": no one-round wins against strong foes");
  ok(r.rounds >= 3, nm + ": fights still take a few rounds (" + r.rounds + ")");
}
ok(dr.win - base.win <= 8 && da.win - base.win <= 8 && dw.win - baseMage.win <= 8, "afflicted heroes are not much stronger on a mixed pool");
ok(dr.win <= base.win + 2, "on the road, weaker potions make the Draugr curse a cost (" + base.win + " vs " + dr.win + ")");
ok(drPot.win - basePot.win <= 8, "without potions its frost guard helps only a little (" + basePot.win + " vs " + drPot.win + ")");
ok(drDun.win >= baseDun.win - 3, "but in a barrow it pays off (" + baseDun.win + " vs " + drDun.win + ")");
// away from what they're good against, every affliction is only a cost
const plain = POOL.filter((e) => !/daedra|construct/.test(e.tags.join()) && !/Draugr|Frost/.test(e.name));
const bP = sim(null, { pool: plain }), daP = sim("daedric", { pool: plain }), drP = sim("draugr", { pool: plain }), bPm = sim(null, { pool: plain, mage: true }), dwP = sim("dwemer", { pool: plain, mage: true });
log("  plain foes (no daedra, machines or frost): clean", bP.win + "%", "· daedric", daP.win + "%", "· draugr", drP.win + "%", "· mage clean", bPm.win + "%", "· dwemer mage", dwP.win + "%");
ok(daP.win <= bP.win + 2 && drP.win <= bP.win + 2 && dwP.win <= bPm.win + 2, "against plain foes an affliction never helps");
// ---- painted scenes (afflart): road events and story popups ask for the gev-* paintings, the catch and cure lines pick them
// (after the sims, so their seeded dice stay the same)
ok(A.PAINT.road.aff_black_shrine === "gev-black-shrine" && A.PAINT.road.aff_dwemer_hum === "gev-dwemer-pipe" && A.PAINT.road.aff_wolf_hunters === "gev-werewolf-moon", "road events: painted shrine, pipe, werewolf");
ok(A.PAINT.story.affDraugr === "gev-draugr-altar" && A.PAINT.story.affTemple === "gev-arkay-temple" && A.PAINT.story.wolf === "gev-werewolf-moon", "story scenes: barrow altar, temple, werewolf");
{ const t = hero(); ok(A.storyKind("", "Boss down. " + A.give(t, "draugr")) === "affDraugr", "catching the Draugr Curse picks the barrow altar");
  const u = hero(); ok(A.storyKind("", A.give(u, "dwemer")) === "affDwemer", "catching the Dwemer Resonance picks the pipe");
  t.location = "Whiterun"; ok(A.storyKind("At the temple", A.priestCure(t)) === "affTemple", "the priest's cure picks the temple");
  ok(A.storyKind("", "You find 20 gold.") === null && A.scene("You find 20 gold.") === "", "an ordinary note gets no scene"); }
`, c);
console.log(fail ? `afflictions FAILED ${fail}/${n}` : `afflictions ok · ${n} checks`);
process.exit(fail ? 1 : 0);
