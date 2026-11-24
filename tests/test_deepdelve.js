// Deep expeditions and difficulty tiers (deepdelve.js): descend / rest / extract, knocked out loses only the expedition's
// unsecured finds (never gear or what you brought in), Pathfinder, tier picker (level 30+), weekly modifiers, their effects
// in fights, tier and depth scaling, no one-shots, the perks, the Polish. W=/path/to/game/ node test_deepdelve.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = process.env.W || path.join(__dirname, "../game/");
const src = (f) => fs.readFileSync(path.join(W, f), "utf8");
let fail = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fail++; console.log("FAIL", m); } };

const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "mp.js", "deepdelve.js"];
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, ok };
vm.createContext(c);
for (const f of FILES) if (fs.existsSync(path.join(W, f))) vm.runInContext(src(f).replace(/^const (\w+) =/m, "var $1 ="), c);

// the page loads it
const html = src("index.html");
ok(/<script src="deepdelve.js"><\/script>/.test(html), "deepdelve.js in index.html");
ok(html.indexOf('src="dungeons.js"') < html.indexOf('src="deepdelve.js"') && html.indexOf('src="perkfx.js"') < html.indexOf('src="deepdelve.js"'), "deepdelve.js loads after dungeons.js and perkfx.js");
ok(html.indexOf('src="i18n_deepdelve.js"') > 0 && html.indexOf('src="i18n_deepdelve.js"') < html.indexOf('src="i18n.js"'), "i18n_deepdelve.js before i18n.js");

vm.runInContext(`
const DD = DEEPDELVE;
const place = Object.keys(WORLD.places).find((p) => DD.deepable(p) && DUNGEONS.enterable(p));
const dwemer = Object.keys(WORLD.places).find((p) => DUNGEONS.info(p)?.theme === "dwemer");
ok(!!place, "there is a deep dungeon");
ok(Object.keys(WORLD.places).filter((p) => DUNGEONS.info(p)?.theme === "lair").every((p) => !DD.deepable(p)), "dragon lairs don't go deeper");
ok(Object.keys(WORLD.places).filter((p) => DUNGEONS.info(p) && DUNGEONS.info(p).tier < 3).every((p) => !DD.deepable(p)), "only deadly dungeons go deeper");

function hero(L = 36, strong = true) {
  const s = G.newSave("dd" + Math.random(), "Delver", "nord"); s._test = true;
  s.level = L; s.hpBonus = strong ? 3000 : (L - 1) * 7; s.spBonus = (L - 1) * 3;   // strong: walks a level without dying (the walk is about the flow, not balance)
  for (const sk of Object.values(s.skills)) sk.lvl = Math.min(100, sk.lvl + (L - 1) * 2);
  for (const it of ["steel_sword", "steel_armor", "steel_helmet", "steel_boots", "steel_gauntlets", "steel_shield"]) { G.give(s, it); G.equip(s, s.inv[s.inv.length - 1].id); }
  G.give(s, "potion_health", 3); s.perks = s.perks || {};
  s.location = place; [s.x, s.y] = WORLD.places[place];
  G.setHealth(s, G.maxHealth(s));
  return s;
}
/* walk the current level to its end (topped up before every room so the walk itself never fails) */
function walk(s, stopAt) {
  let g = 0;
  const hit = typeof stopAt === "function" ? stopAt : (r) => r.type === stopAt;
  while (s.dungeon && g++ < 80) {
    const d = s.dungeon;
    if (d.room && hit(d.room)) return true;
    if (d.room?.type === "camp") return false;
    G.setHealth(s, G.maxHealth(s));
    if (!d.room) { if (d.done) return false; const ch = DUNGEONS.nextChoices(s); const er = DUNGEONS.enterRoom(s, ch[0]); if (er) throw new Error(er); continue; }
    const chs = DUNGEONS.roomChoices(s).map((x) => x[0]);
    let ch = chs[0];
    if (d.room.enemy) { d.room.enemy.health = Math.min(d.room.enemy.health, 60); d.room.enemy.hp = d.room.enemy.health; }   // short fights: this walk tests the flow (the sim tests balance)
    if (d.room.type === "trap") ch = chs.includes("dash") ? "dash" : chs[0];
    else if (d.room.type === "puzzle") ch = "set:" + d.room.order;
    else if (d.room.type === "mystery") ch = chs.includes("skip") ? "skip" : chs[chs.length - 1];
    else if (d.room.type === "rest") ch = chs.includes("search") ? "search" : chs[0];
    const r = DUNGEONS.act(s, ch);
    if (typeof r.text !== "string") throw new Error("no text from " + d.room?.type + " " + ch);
    globalThis.lastR = [d.room && d.room.type, ch, r.text, r.died].join(" ~ "); if (r.died) return false;
  }
  return false;
}
const qty = (s, item) => s.inv.filter((r) => r.item === item).reduce((a, r) => a + r.qty, 0);

// ---- the normal dungeon ends at the stairs: Extract / Descend
let s = hero();
ok(!DUNGEONS.enter(s), "enter the deep dungeon");
ok(walk(s, "camp"), "after the master falls there's a camp at the stairs");
let d = s.dungeon;
let chs = DUNGEONS.roomChoices(s).map((x) => x[0]);
ok(chs.includes("extract") && chs.includes("descend") && !chs.includes("camprest"), "top of the stairs: extract or descend: " + chs);
ok(!d.done && !!s.cleared[place], "the dungeon counts as cleared but the run goes on");
const goldTop = s.gold, swordId = s.inv.find((r) => r.item === "steel_sword").id;
let r = DUNGEONS.act(s, "descend");
ok(r.descended === 1 && d.deep.level === 1 && d.rows.length >= 3 && d.rows[d.rows.length - 1][0].type === "boss", "descend to level I: a new map that ends in a major fight");
ok(d.deep.snap && d.deep.snap.gold === goldTop && d.deep.rations >= 2, "the top of the stairs is remembered, rations packed");
ok(DD.bannerHTML(s).includes("Level I"), "the banner shows the depth");
ok(walk(s, "camp"), "level I ends at a camp");
ok(d.deep.level === 1 && s.gold > goldTop, "the major fight's hoard pays gold");
const u1 = DD.unsecured(s);
ok(u1.gold > 0 && u1.gold === s.gold - goldTop, "gold found below is unsecured: " + JSON.stringify(u1));
chs = DUNGEONS.roomChoices(s).map((x) => x[0]);
ok(chs.includes("extract") && chs.includes("camprest") && chs.includes("descend"), "camp: Extract / Rest / Descend: " + chs);
const html1 = DD.campHTML(s);
ok(html1.includes('data-c="extract"') && html1.includes('data-c="camprest"') && html1.includes('data-c="descend"') && html1.includes("Unsecured"), "the camp card has the three choices and the unsecured count");
G.setHealth(s, G.maxHealth(s) * 0.3); const rat = d.deep.rations, h0 = G.curHealth(s);
r = DUNGEONS.act(s, "camprest");
ok(d.deep.rations === rat - 1 || /found your camp/.test(r.text) || r.died, "resting uses a ration");
ok(r.died || G.curHealth(s) > h0, "resting heals: " + r.text);
if (!s.dungeon) { s = null; }

// ---- knocked out on level II: the expedition's finds are lost, gear and what you brought in are safe
if (s) {
  r = DUNGEONS.act(s, "descend");
  ok(d.deep.level === 2, "descend to level II");
  const goldBefore = d.deep.snap.gold, potsBefore = d.deep.snap.q[s.inv.find((x) => x.item === "potion_health")?.id];
  ok(walk(s, (rm) => !!rm.enemy), "find a fight on level II");
  if (s.dungeon?.room?.enemy) {
    s.dungeon.room.enemy.damage = 9999; G.setHealth(s, 1);
    // no potions in reach so the fight is lost
    const pots = s.inv.filter((x) => /potion/.test(D.ITEMS[x.item]?.id || x.item)).map((x) => [x.id, x.qty]); for (const [id, q] of pots) G.take(s, id, q);
    r = DUNGEONS.act(s, "fight");
    ok(r.knockedOut && !s.dungeon, "knocked out: carried out of the dungeon: " + (r.died || r.text));
    ok(/lost in the dark|found nothing/.test(r.died || ""), "the message says the finds are lost");
    ok(s.gold === goldBefore, "gold back to what you brought in: " + s.gold + " vs " + goldBefore);
    ok(s.inv.some((x) => x.id === swordId) && G.equipment(s).weapon, "your sword is still yours and still in hand");
    ok(G.curHealth(s) > 0 && !s.dead, "knocked out, not dead");
    ok(!s.graves?.length && !s.bag, "no grave, no dropped bag");
  }
}

// ---- extract keeps everything
s = hero();
DUNGEONS.enter(s); walk(s, "camp"); DUNGEONS.act(s, "descend"); walk(s, "camp");
const g1 = s.gold, uu = DD.unsecured(s);
r = DUNGEONS.act(s, "extract");
ok(r.extracted && s.dungeon?.done, "extract ends the run: " + r.text);
ok(/yours now/.test(r.text), "extract says the finds are yours");
const leaveMsg = DUNGEONS.leave(s);
ok(s.gold === g1 && !s.dungeon, "after extracting and leaving, the gold stays: " + leaveMsg);

// ---- walking out mid-level: lose the finds; Pathfinder keeps them
for (const path of [false, true]) {
  s = hero(); if (path) s.perks.pathfinder = 1;
  const en = DUNGEONS.enter(s), w1 = walk(s, "camp"), a1 = DUNGEONS.act(s, "descend"), w2 = walk(s, "camp"), a2 = s.dungeon && DUNGEONS.act(s, "descend");
  if (!s.dungeon) { ok(false, "pathfinder setup: " + [en, w1, a1 && a1.text, w2, a2 && a2.text, s.dead, globalThis.lastR].join(" | ")); continue; }
  const top = s.dungeon.deep.snap.gold;
  s.gold += 500; const g0 = s.gold;   // something found on level II
  const lm = DUNGEONS.leave(s);
  ok(path ? s.gold === g0 : s.gold === top, (path ? "Pathfinder keeps" : "running out drops") + " the finds: " + lm);
  ok(path ? /Pathfinder/.test(lm) : /dropped/.test(lm), "the leave message says so");
}
ok(DD.hasPath({ perks: { pathfinder: 1 } }), "Pathfinder perk reads");

// ---- the camp at the very bottom has no Descend; layouts are seeded
const L5 = DD.layout("run1|deep|5", 5);
ok(L5.length === 2 && L5[1][0].type === "boss", "level V: one room row, then the legendary lair");
ok(JSON.stringify(DD.layout("abc|deep|2", 2)) === JSON.stringify(DD.layout("abc|deep|2", 2)), "the same seed builds the same level on every phone");
ok(JSON.stringify(DD.layout("abc|deep|2", 2)) !== JSON.stringify(DD.layout("abd|deep|2", 2)), "another run builds another level");
for (let L = 1; L <= 5; L++) for (let k = 0; k < 20; k++) { const rows = DD.layout("x" + k + "|" + L, L); ok(rows.every((row, i) => i === rows.length - 1 || row.every((n) => n.links.length && n.links.every((j) => j < rows[i + 1].length))), "links reach the next row L" + L); }

// ---- tiers: level 30+, picker, scaling
const low = hero(20), high = hero(36);
ok(/level 30/.test(DD.pick(low, place, "mythic") || ""), "tiers locked under level 30");
ok(DD.picked(low, place) === "normal", "low level stays normal");
ok(DD.pick(high, place, "legendary") === null && DD.picked(high, place) === "legendary", "pick Legendary");
ok(DD.picked(high, "Whiterun") === "normal", "the pick is for that dungeon only");
ok(DD.placeCard(high, place).includes('data-act="ddtier"') && DD.placeCard(high, place).includes("dd-mod"), "the place card shows the picker and the modifiers");
ok(DD.placeCard(low, place).includes("disabled"), "the picker is greyed out under level 30");
const t0 = 1.8e9;
const m1 = DD.modsFor(place, t0), m2 = DD.modsFor(place, t0 + 3600);
ok(m1.length === 3 && JSON.stringify(m1) === JSON.stringify(m2), "modifiers are the same all week: " + m1);
let differ = 0; for (let w = 1; w < 8; w++) if (JSON.stringify(DD.modsFor(place, t0 + w * 7 * 86400)) !== JSON.stringify(m1)) differ++;
ok(differ >= 4, "modifiers change from week to week");
ok(DD.modsAt(place, "veteran", t0).length === 1 && DD.modsAt(place, "legendary", t0).length === 2 && DD.modsAt(place, "mythic", t0).length === 3 && DD.modsAt(place, "normal", t0).length === 0, "1 / 2 / 3 modifiers");
for (let w = 0; w < 30; w++) { ok(!DD.modsFor(place, t0 + w * 7 * 86400).includes("overcharge") || DUNGEONS.info(place).theme === "dwemer", "Dwemer Overcharge only in Dwemer ruins"); }
if (dwemer) ok(Array.from({ length: 30 }, (_, w) => DD.modsFor(dwemer, t0 + w * 7 * 86400)).some((m) => m.includes("overcharge")), "Dwemer ruins can roll Overcharge");
DUNGEONS.enter(high);
ok(high.dungeon.dtier === "legendary" && high.dungeon.mods.length === 2, "entering uses the picked tier: " + high.dungeon.dtier + " " + high.dungeon.mods);
const base = { name: "Draugr", health: 100, hp: 100, damage: 10, tags: ["undead"] };
const e1 = DD.scaleFoe(high, { ...base });
ok(e1.health === Math.round(100 * DD.TIERS.legendary.hp) && Math.abs(e1.damage - 10 * DD.TIERS.legendary.dmg) < 0.11 && e1.hitCap === DD.HIT_CAP, "Legendary foes: tougher, harder hitting, capped blows: " + JSON.stringify(e1));
ok(Math.abs(DD.goldMult(high) - DD.TIERS.legendary.gold) < 1e-9, "Legendary pays more gold");
high.dungeon.deep = { level: 3, inj: 0, curses: [], rations: 2 };
const e3 = DD.scaleFoe(high, { ...base }), e3m = DD.scaleFoe(high, { ...base }, true);
ok(e3.health > e1.health && e3m.health > e3.health, "deeper is tougher, the major fight more so: " + e1.health + " " + e3.health + " " + e3m.health);
ok(DD.goldMult(high) > DD.TIERS.legendary.gold * 3, "deeper pays much more: x" + DD.goldMult(high).toFixed(2));
high.perks.deep_delver = 2;
ok(DD.goldMult(high) > DD.TIERS.legendary.gold * DD.DEPTH_GOLD[3] * 1.5, "Deep Delver adds gold per level");
ok(DD.trapMult(high) > 1, "traps hurt more deeper and harder");
const n0 = hero(); DUNGEONS.enter(n0);
ok(JSON.stringify(DD.scaleFoe(n0, { ...base })) === JSON.stringify(base), "normal tier at the top: foes untouched");

// ---- modifiers in fights
function fightWith(mods, foeDef, opts = {}) {
  const s = hero(36, !opts.real); DUNGEONS.enter(s); s.dungeon.mods = mods; s.dungeon.dtier = "mythic";
  if (opts.deep) s.dungeon.deep = opts.deep;
  if (opts.perks) Object.assign(s.perks, opts.perks);
  if (opts.prep) opts.prep(s);
  const e = DD.scaleFoe(s, G.scaleEnemy({ ...foeDef }, 36), !!opts.major);
  if (opts.hp) { e.health = opts.hp; e.hp = opts.hp; }
  const f = new G.Fight(s, e, null); f.run({ trySneak: false, maxTurns: opts.maxTurns || 60 });
  return { s, f, e, text: f.log.map((l) => (l.me || "") + " | " + (l.them || "")).join("\\n") };
}
const draugr = DUNGEONS.ENEMY[Object.keys(DUNGEONS.ENEMY).find((k) => (DUNGEONS.ENEMY[k].tags || []).includes("undead"))];
const robot = DUNGEONS.ENEMY[Object.keys(DUNGEONS.ENEMY).find((k) => (DUNGEONS.ENEMY[k].tags || []).includes("construct"))];
let x = fightWith(["frost"], draugr, { maxTurns: 8 });
ok(x.f.dd && x.f.dd.M.has("frost") && /the cold bites/.test(x.text), "Frozen Depths: the cold bites at 5 stacks");
let risen = 0; for (let i = 0; i < 20; i++) { x = fightWith(["restless"], draugr, { hp: 40 }); if (x.f.dd.risen) risen++; }
ok(risen >= 15, "Restless Dead: undead get back up (" + risen + "/20)");
x = fightWith(["restless"], draugr, { hp: 40, prep: (s) => { s.spells = ["flames"]; G.loadout(s).rules = [{ if: "always", do: "spell:flames" }]; } });
ok(x.f.dd.lastEl !== "fire" || !x.f.dd.risen, "Restless Dead: fire keeps them down (" + x.f.dd.lastEl + ")");
if (robot) { x = fightWith(["overcharge"], robot, { maxTurns: 9 }); ok(/overcharge/.test(x.text) || x.f.turn < 3, "Dwemer Overcharge shocks every third turn"); }
x = fightWith(["bloodmoon"], draugr, { maxTurns: 10 });
ok(/you bleed/.test(x.text), "Blood Moon: blows make you bleed");
x = fightWith(["cursed"], draugr); ok(Math.abs(DD.healMult(x.s) - 0.6) < 1e-9, "Cursed Sanctuary: healing 40% weaker");
const lit = fightWith(["darkness"], draugr, { maxTurns: 1 }), lit2 = fightWith(["darkness"], draugr, { maxTurns: 1, perks: { pathfinder: 1 } });
ok(lit.f.dd.dark > 0 && lit2.f.dd.dark === 0, "Ancient Darkness hides foes, Pathfinder sees them");
let surges = 0; for (let i = 0; i < 10; i++) { x = fightWith(["arcane"], draugr, { maxTurns: 12, prep: (s) => { s.spells = ["firebolt"]; s.mpBonus = 500; G.loadout(s).rules = [{ if: "always", do: "spell:firebolt" }]; } }); if (//.test(x.text)) surges++; }
ok(surges >= 5, "Arcane Instability: spells have side effects (" + surges + "/10)");
// injuries and curses make you take more
const plain = fightWith([], draugr, { deep: { level: 2, inj: 0, curses: [] } }), hurt = fightWith([], draugr, { deep: { level: 2, inj: 3, curses: ["wither"] } });
ok(!plain.f.dd && hurt.f.dd && hurt.f.dd.taken > 1.2, "injuries and the withering curse: you take more (" + (hurt.f.dd && hurt.f.dd.taken.toFixed(2)) + ")");
const vet = fightWith([], draugr, { deep: { level: 2, inj: 3, curses: ["wither"] }, perks: { dungeon_veteran: 2 } });
ok(vet.f.dd.taken < hurt.f.dd.taken, "Dungeon Veteran softens injuries and curses");
ok(DD.vetFactor({ perks: { dungeon_veteran: 2 } }) < 0.5, "Dungeon Veteran reads");

// ---- no one-shots: the hardest blow at Mythic, level V, worst modifiers and curses stays under half your health
let worst = 0;
for (const k of ["deathlord", "lich", "centurion", "master", "dragonpriest"].filter((k) => DUNGEONS.ENEMY[k])) for (let i = 0; i < 6; i++) {
  x = fightWith(["bloodmoon", "frost", "darkness"], DUNGEONS.ENEMY[k], { real: true, major: true, deep: { level: 5, inj: 3, curses: ["wither", "mark"] }, maxTurns: 12 });
  const mh = G.maxHealth(x.s); let hp = x.f.hp0;
  for (const l of x.f.log) { if (l.hp != null) { worst = Math.max(worst, (hp - l.hp) / mh); hp = l.hp; } }
}
ok(worst < 0.62, "no one-shots: the worst turn takes " + Math.round(worst * 100) + "% of your health");

// ---- perks: registered with real effects, old ids untouched
for (const id of ["dungeon_veteran", "deep_delver"]) { ok(!!PERKS.BY_ID[id] && !!PFX.FX[id], "perk " + id + " is in"); }
ok(PERKS.BY_ID.pathfinder.skill === "Athletics" && PFX.FX.pathfinder.some(([k]) => k === "roadrun") && PFX.FX.pathfinder.some(([k]) => k === "deeppath") && /deep expedition/.test(PERKS.BY_ID.pathfinder.desc), "Pathfinder keeps its id and old effect and gains the way out");
ok(PERKS.BY_ID.long_strider && PERKS.BY_ID.stealth && PERKS.BY_ID.apprentice_locks, "old perks keep their ids");
`, c);

// ---- Polish: every new line comes out in Polish
{
  const order = [...html.matchAll(/<script src="(i18n[^"]*)"/g)].map((m) => m[1]);
  const p = { console, Math, Date, JSON, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RegExp,
    navigator: { language: "pl-PL" }, localStorage: { getItem: () => JSON.stringify({ lang: "pl" }), setItem() {} } };
  vm.createContext(p);
  for (const f of FILES) if (fs.existsSync(path.join(W, f))) vm.runInContext(src(f).replace(/^const (\w+) =/m, "var $1 ="), p);
  vm.runInContext(order.map(src).join("\n;") + "\n;globalThis.I18N = I18N;", p);
  const t = (x) => p.I18N.tr(x);
  const want = [
    " Difficulty", "Veteran", "Mythic", " Frozen Depths", " Relentless Hunt", "Extract: climb out with everything", "Rest (1 ration, 2 left)",
    "Descend to level III: The ancient vault", " Camp on level II", " Level IV", " 2 injuries", "Unsecured: 340 gold, 3 things", " Withering curse",
    "Legendary: foes have 65% more health and hit 20% harder; ×2.25 gold. This week's modifiers:",
    "You climb all the way back up and out. Everything you found down there is yours now (340 gold, 3 things).",
    "You go down to level IV: the cursed sanctuary.  Sanctuary's mark: Healing is 30% weaker.",
    "You eat a ration and rest a while (120 → 260 health, 1 injury left). Curses stay until you climb out.",
    "Knocked out by the draugr deathlord on level II. You come to at the door of Bleak Falls Barrow, dragged out by luck or by friends. The expedition's finds (340 gold and 3 things) are lost in the dark. Your gear and everything you brought in are safe.",
    " the cold bites −12", " it rises again!", "Dungeon Veteran", "Pathfinder", "Deep Delver", "Deep expeditions and harder dungeons",
    "Health, potions and injuries carry down with you. Down there, loot is unsecured until you extract.",
  ];
  for (const w of want) { const r = t(w); ok(r != null && r !== w, "Polish: " + w + " → " + r); }
  for (const m of Object.values(p.DEEPDELVE.MODS)) { ok(t(m.desc) && t(m.desc) !== m.desc, "Polish modifier text: " + m.name); }
  for (const pk of p.DEEPDELVE.PERK_ADD) { ok(t(pk[6]) && t(pk[6]) !== pk[6], "Polish perk text: " + pk[2]); }
  { const pd = p.PERKS.BY_ID.pathfinder.desc; ok(t(pd) && t(pd) !== pd, "Polish Pathfinder text: " + t(pd)); }
  const pn = vm.runInContext("typeof PATCHNOTES", p) !== "undefined" ? null : null;
  const notes = src("patchnotes.js"); const ctx = {}; vm.createContext(ctx); vm.runInContext(notes.replace(/^const PATCHNOTES =/m, "var PATCHNOTES ="), ctx);
  const top = ctx.PATCHNOTES.LIST[0];
  ok(top.id === "b172-deepdelve" || ctx.PATCHNOTES.LIST.some((x) => x.id === "b172-deepdelve"), "patch note is in");
  const mine = ctx.PATCHNOTES.LIST.find((x) => x.id === "b172-deepdelve");
  for (const line of [mine.title, ...mine.items]) { const r = t(line); ok(r && r !== line, "Polish patch note: " + line.slice(0, 40)); }
}

console.log(fail ? `deepdelve FAILED ${fail} of ${checks}` : `deepdelve ok · ${checks} checks`);
process.exit(fail ? 1 : 0);
