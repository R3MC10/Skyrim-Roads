// Rune research and spell crafting (runecraft.js): finding runes (tomes, word walls, Dwemer ruins, College tasks),
// the design rules, the power budget, crafting, saves, the Magic tab, both fight systems, the combos (frost → Shatter,
// fire → burning ground), poison, the perks, Polish, and a balance sim: no crafted spell beats the best bought spell of
// its tier (per cast and per magicka), no one-shots on strong foes, fights don't end faster than with bought spells.
//   W=/path/to/game/ node test_runecraft.js      (N=10 fights per row by default, N=3 for a quick run)
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, process };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {}, removeItem() {} };
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
const { G, TB, D, PERKS, MAGIC, I18N, RUNECRAFT: R } = c;
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const N = +(process.env.N || 10);
const TIERS = R.TIERS;

mage.n = 0;
function mage(skill = 50, extra = {}) {
  const s = G.newSave("rc" + skill, "Mage", "breton"); s._test = true; s.id = "m" + (++mage.n);
  s.location = "Winterhold"; s.gold = 1e6; s.level = Math.max(1, Math.round(skill / 2.3));
  for (const k of ["Destruction", "Restoration", "Alteration", "Mysticism", "Alchemy"]) s.skills[k].lvl = skill;
  s.words = ["fus", "ro", "dah"]; s.cleared = {}; s.quests = { college: { stage: 2 } };
  Object.assign(s, extra);
  for (const id of ["flames", "frostbite", "sparks", "healing", "lesser_ward", "chain_lightning", "fireball"]) if (D.SPELLS[id] && !s.spells.includes(id)) s.spells.push(id);
  const dw = Object.keys(c.DUNGEONS.LIST || {}).find((k) => c.DUNGEONS.info(k)?.theme === "dwemer") || Object.keys(c.WORLD.places).find((k) => c.DUNGEONS.info(k)?.theme === "dwemer");
  if (dw) { s.cleared[dw] = 1; s._dw = dw; }
  R.research(s);
  return s;
}
const foeOf = (base, L) => G.scaleEnemy({ ...base, tags: [...base.tags], level: L, danger: "high", gold: [0, 0], text: "" }, L);
const CHIEF = { name: "Bandit chief", health: 170, damage: 22, tags: ["humanoid", "elite"] };
const SKEL = { name: "Skeleton", health: 80, damage: 12, tags: ["undead"] };
const WOLF = { name: "Ice wolf", health: 80, damage: 12, tags: ["beast"] };
const fightOf = (s, e) => { const f = new G.Fight(s, e); f.allies = []; f.mp = 1e5; return f; };
const sessOf = (f) => { const s = new TB.Session(f, { trySneak: false }); s.round = 1; f.turn = 1; s.order = [{ id: "me", name: "me", init: 99 }, { id: "foe", name: "foe", init: 1 }]; s.idx = 0; s.cur = s.order[0]; s.beginTurn(); return s; };
const landed = (s, id, base, L, tries = 30) => { for (let i = 0; i < tries; i++) { const f = fightOf(s, foeOf(base, L)), b = f.ehp, out = f.cast(id); if (f.ehp < b) return { f, out, dealt: b - f.ehp }; } return null; };

// ---- 1. the module is in; perks with real effects, old ids kept
{
  ok(R && typeof R.design === "function", "runecraft.js loaded");
  const ids = Object.values(PERKS.TREES).flat().map((p) => p[0]);
  for (const id of ["rune_scholar", "spellwright", "runic_echo"]) ok(ids.includes(id), "perk " + id);
  for (const id of ["rune_master", "spell_absorption", "novice_destruction", "augmented_frost"]) ok(ids.includes(id), "old perk kept " + id);
  ok(Object.keys(R.ELEMENTS).length === 6 && Object.keys(R.DELIVERIES).length === 6 && Object.keys(R.MODS).length === 6, "6 elements, 6 deliveries, 6 modifiers");
  ok(TB.FOE_KEYS.includes("rcRearm"), "a re-arming rune trap syncs to party phones");
}
// ---- 2. research: a fresh character knows only bolt, touch and its own spells' elements
{
  const s = G.newSave("fresh", "F", "nord"); s.spells = ["flames", "healing"]; s.words = []; s.cleared = {}; s.quests = {};
  const got = R.research(s);
  ok(got.includes("fire") && got.includes("healing") && got.includes("bolt") && got.includes("touch"), "starting runes " + got);
  ok(!s.runes.includes("frost") && !s.runes.includes("poison") && !s.runes.includes("cloak") && !s.runes.includes("chain"), "nothing else yet " + s.runes);
  // tome: read a frost tome → frost rune, the tome text says so
  const tome = Object.entries(D.ITEMS).find(([, it]) => it.slot === "tome" && it.spell === "frostbite");
  if (tome) { const id = G.give(s, tome[0]); const t = G.readTome(s, id); ok(s.runes.includes("frost") && /New rune.*Frost/.test(t), "reading a tome finds a rune: " + t); }
  else ok(false, "no frostbite tome");
  s.words = ["fus"]; R.research(s); ok(s.runes.includes("quick") && !s.runes.includes("cloak"), "1 word: Quick");
  s.words = ["fus", "ro"]; R.research(s); ok(s.runes.includes("cloak"), "2 words: Cloak");
  s.words = ["fus", "ro", "dah"]; R.research(s); ok(s.runes.includes("slow"), "3 words: Slow");
  s.quests = { college: { stage: 1 } }; R.research(s); ok(s.runes.includes("rune") && s.runes.includes("cheap") && !s.runes.includes("lingering"), "College first lesson: Rune trap and Cheap");
  s.quests = { college: { stage: 2 } }; R.research(s); ok(s.runes.includes("lingering") && s.runes.includes("over"), "Saarthal: Lingering and Over time");
  const m = mage(40); ok(m._dw && m.runes.includes("poison") && m.runes.includes("piercing") && m.runes.includes("area"), "a cleared Dwemer ruin: Poison, Piercing, Area (" + m._dw + ")");
  const a = G.newSave("alc", "A", "nord"); a.spells = []; a.skills.Alchemy.lvl = 40; R.research(a); ok(a.runes.includes("poison"), "Alchemy 40: Poison");
  ok(Object.values(R.RUNES).every((r) => r.how && r.how.length > 10), "every rune says where to find it");
  // migrate hands out runes and keeps crafted spells
  const old = JSON.parse(JSON.stringify(s)); delete old.runes; const back = G.migrate(old); ok((back.runes || []).includes("frost"), "loading an old save finds its runes");
}
// ---- 3. design rules
{
  const s = mage(50);
  ok(R.design(s, { el: "ward", dl: "rune" }).err, "no ward rune trap");
  ok(R.design(s, { el: "healing", dl: "area" }).err, "no healing area");
  ok(R.design(s, { el: "fire", dl: "cloak", mods: ["quick"] }).err, "Quick doesn't fit a cloak");
  ok(R.design(s, { el: "fire", dl: "bolt", mods: ["chain", "slow"] }).err, "two modifiers need Spellwright");
  ok(!R.design(s, { el: "fire", dl: "bolt", mods: ["chain"] }).err, "fire chain bolt is fine");
  const lock = mage(50); lock.runes = lock.runes.filter((k) => k !== "chain"); ok(/found/.test(R.design(lock, { el: "fire", dl: "bolt", mods: ["chain"] }).err || ""), "unfound rune refused");
  const lo = R.design(s, { el: "fire", dl: "bolt", pw: 0.5 }), hi = R.design(s, { el: "fire", dl: "bolt", pw: 1 });
  ok(lo.amount < hi.amount && lo.cost < hi.cost, "less power, less magicka");
  ok(R.design(s, { el: "fire", dl: "bolt", pw: 0.1 }).pw === R.PW_MIN, "power has a floor");
  const ch = R.design(s, { el: "fire", dl: "bolt", mods: ["cheap"] }); ok(ch.cost < hi.cost && ch.amount < hi.amount, "Cheap: less magicka, a bit weaker");
  ok(R.design(s, { el: "frost", dl: "bolt", mods: ["chain"] }).area, "chain spells reach the foes behind");
}
// ---- 4. the budget follows your skill and the perks
{
  let prev = 0;
  for (const sk of [5, 20, 30, 45, 55, 70, 80, 95, 100]) { const d = R.design(mage(sk), { el: "fire", dl: "bolt" }); ok(d.amount >= prev, `budget grows with skill (${sk}: ${d.amount})`); prev = d.amount; }
  ok(R.design(mage(24), { el: "fire", dl: "bolt" }).level === "Novice" && R.design(mage(25), { el: "fire", dl: "bolt" }).level === "Apprentice", "tier from your skill");
  ok(R.design(mage(60), { el: "healing", dl: "bolt" }).school === "Restoration", "healing runs on Restoration");
  const s = mage(70), base = R.design(s, { el: "fire", dl: "bolt" }).amount;
  PERKS.take(s, "rune_scholar"); PERKS.take(s, "rune_scholar");
  const s2 = mage(70); s2.perks = { ...(s2.perks || {}), rune_scholar: 2, novice_destruction: 1 };
  const sch = R.design(s2, { el: "fire", dl: "bolt" }).amount;
  ok(sch > base * 1.08 && sch <= base * 1.11, `Rune Scholar adds 10% (${base} → ${sch})`);
  s2.perks.spellwright = 1; s2.perks.spell_absorption = 1;
  ok(R.modSlots(s2) === 2 && !R.design(s2, { el: "fire", dl: "bolt", mods: ["chain", "slow"] }).err, "Spellwright: two modifiers");
}
// ---- 5. balance table: never better than the best bought spell of its tier
const totalOf = (d, s) => {   // what one cast does to one foe, over its whole life
  const k = d.kind, echo = s && c.PFX.num(s, "rcturns") > 0 ? 1 : 0;
  let t = k === "cloak" || k === "dot" || k === "regen" ? d.amount * ((d.turns || 5) + echo) : d.amount;
  if (d.mods.includes("chain") && k === "damage") t += d.amount * R.CHAIN;
  if (d.mods.includes("lingering") && k === "damage") t += d.amount * R.LINGER.share * R.LINGER.turns;
  if (d.mods.includes("lingering") && k === "heal") t += d.amount * 0.15 * 3 / 2;
  if (k === "ward" && (d.dl === "cloak" || d.mods.includes("lingering"))) t += d.amount * 0.06 * 6;
  return t;
};
const boughtTot = (sp) => (["cloak", "dot", "regen"].includes(sp.kind) ? sp.amount * (sp.turns || 1) : sp.amount);
const famOf = { damage: "dmg", rune: "dmg", cloak: "dmg", dot: "dmg", heal: "heal", regen: "heal", ward: "ward" };
{
  const SK = [24, 49, 74, 99, 100], worst = {};
  for (const perks of [false, true]) for (let t = 0; t < 5; t++) {
    const s = mage(SK[t]); if (perks) s.perks = { ...(s.perks || {}), novice_destruction: 1, rune_scholar: 2, spell_absorption: 1, spellwright: 1, rune_master: 1, runic_echo: 1, apprentice_destruction: 1 };
    s.runes = Object.keys(R.RUNES);
    const modSets = [[], ...Object.keys(R.MODS).map((m) => [m]), ...(perks ? Object.keys(R.MODS).flatMap((a, i) => Object.keys(R.MODS).slice(i + 1).map((b) => [a, b])) : [])];
    for (const el of Object.keys(R.ELEMENTS)) for (const dl of Object.keys(R.DELIVERIES)) for (const mods of modSets) {
      const d = R.design(s, { el, dl, mods, pw: 1 }); if (d.err) continue;
      const fam = famOf[d.kind];
      // the bought spells it's measured against: same tier, same family; the strongest single hit and the best per magicka
      const pool = Object.values(D.SPELLS).filter((x) => !x.custom && !x.hidden && x.level === d.level && famOf[x.kind] === fam && x.amount > 0 && x.cost > 0 && (fam !== "dmg" || !x.element || ["fire", "frost", "shock"].includes(x.element)));
      const same = pool.filter((x) => x.kind === d.kind);
      const ref = R.refs()[fam][t];
      const tot = totalOf(d, s), eff = tot / d.cost;
      // same-kind bought spell of this tier, if there is one: not stronger, not cheaper per point
      const cmp = same.length ? { tot: Math.max(...same.map(boughtTot)), eff: Math.max(...same.map((x) => boughtTot(x) / x.cost)) } : null;
      // the plain bolt line (instant spells): one cast never beats the tier's best hit
      const instant = ["damage", "heal", "ward"].includes(d.kind);
      const key = `${el}/${dl}/${mods.join("+") || "-"}`;
      const r1 = instant ? tot / ref.amt : cmp ? tot / cmp.tot : tot / (ref.amt * 2);
      const r2 = cmp ? eff / cmp.eff : eff / ref.eff / (instant ? 1 : 1.6);
      const w = Math.max(r1, r2); if (!worst[perks] || w > worst[perks][0]) worst[perks] = [w, key + " " + d.level, r1.toFixed(2), r2.toFixed(2)];
      if (r1 > 1.0 || r2 > 1.0) ok(false, `${perks ? "perks " : ""}${key} ${d.level}: ${Math.round(tot)} for ${d.cost} magicka beats the best bought (${(r1 * 100).toFixed(0)}% strength, ${(r2 * 100).toFixed(0)}% per magicka)`);
    }
  }
  console.log("closest to the best bought spell:", JSON.stringify(worst));
}
// ---- 6. both fight systems; the modifiers do what they say; combos
{
  const s = mage(60);
  const frost = R.craft(s, { el: "frost", dl: "bolt", mods: ["slow"] }), fire = R.craft(s, { el: "fire", dl: "bolt", mods: ["lingering"] }),
    shock = R.craft(s, { el: "shock", dl: "area", mods: ["chain"] }), cloak = R.craft(s, { el: "fire", dl: "cloak" }), pois = R.craft(s, { el: "poison", dl: "bolt" }),
    quick = R.craft(s, { el: "shock", dl: "bolt", mods: ["quick"] }), pierce = R.craft(s, { el: "frost", dl: "bolt", mods: ["piercing"] }), heal = R.craft(s, { el: "healing", dl: "over" }),
    ward = R.craft(s, { el: "ward", dl: "cloak" }), rune = R.craft(s, { el: "fire", dl: "rune" });
  for (const x of [frost, fire, shock, cloak, pois, quick, pierce, heal, ward, rune]) ok(x.id && D.SPELLS[x.id] && s.spells.includes(x.id), "crafted " + (x.err || D.SPELLS[x.id]?.name));
  ok(s.runeSpells.length === 10 && R.craft(s, { el: "fire", dl: "bolt" }).err, "10 rune spells at most");
  ok(new Set(s.runeSpells.map((x) => x.name)).size === 10, "every spell has its own name");
  // instant fight
  let L = landed(s, frost.id, CHIEF, 30); ok(L && L.f.foeSt?.chill && L.f.slowed >= 2, "frost + slow chills (Shatter is ready) and numbs");
  L = landed(s, fire.id, CHIEF, 30); ok(L && (L.f.dots || []).some((x) => x.el === "fire"), "fire + lingering leaves a burn (instant fight)");
  L = landed(s, shock.id, CHIEF, 30); ok(L && /arcs again/.test(L.out) && D.SPELLS[shock.id].area, "chain arcs again");
  const cf = fightOf(s, foeOf(CHIEF, 30)); cf.cast(cloak.id); ok(cf.cloak && cf.cloak.turns === 10, "fire cloak wraps you for 10 rounds");
  const lp = landed(s, pois.id, CHIEF, 30), sp = landed(s, pois.id, SKEL, 30), wp = landed(s, pois.id, WOLF, 30);
  ok(lp && sp && wp && sp.dealt < lp.dealt * 0.5 && wp.dealt >= lp.dealt, `poison: skeleton ${sp && Math.round(sp.dealt)} < bandit ${lp && Math.round(lp.dealt)} <= wolf ${wp && Math.round(wp.dealt)}`);
  { const h0 = c.F.SPELL_HIT_CHANCE; c.F.SPELL_HIT_CHANCE = 0; const f = fightOf(s, foeOf(CHIEF, 30)), b = f.ehp; f.cast(quick.id); ok(f.ehp < b && c.F.SPELL_HIT_CHANCE === 0, "Quick never misses"); c.F.SPELL_HIT_CHANCE = h0; }
  { const m = fightOf(s, foeOf({ ...CHIEF, name: "Frost atronach", tags: ["daedra"] }, 30)), plain = R.craft(mage(60), { el: "frost", dl: "bolt" });
    const tries = (id) => { let best = 0; for (let i = 0; i < 20; i++) { const f = fightOf(s, foeOf({ ...CHIEF, name: "Frost atronach", tags: ["daedra"] }, 30)), b = f.ehp; f.cast(id); best = Math.max(best, b - f.ehp); } return best; };
    void m; void plain; const pr = tries(pierce.id); ok(pr > 0, "Piercing frost still hurts a frost atronach: " + Math.round(pr)); }
  const hf = fightOf(s, foeOf(CHIEF, 30)); hf.hp = 10; hf.cast(heal.id); ok(hf.regen || (hf.stacks && Object.keys(hf.stacks).length) || hf.hp > 10, "healing over time");
  const wf = fightOf(s, foeOf(CHIEF, 30)); wf.cast(ward.id); ok(wf.ward > 0 && wf.rcMend && wf.rcMend.turns > 0, "ward cloak mends itself");
  // turn-by-turn fight: fire + lingering lays burning ground; cast through the session
  let got = false;
  for (let i = 0; i < 20 && !got; i++) { const f = fightOf(s, foeOf(CHIEF, 30)), ss = sessOf(f), r = ss.act("spell:" + fire.id); if (r && !r.err && f.rx?.fire?.left > 0) got = true; }
  ok(got, "fire + lingering lays burning ground in turn-by-turn fights");
  { const f = fightOf(s, foeOf(CHIEF, 30)), ss = sessOf(f); ok(TB.cost(f, "spell:" + frost.id).mp > 0, "crafted spells cost magicka in turn-by-turn fights"); const b = f.ehp; let r; for (let i = 0; i < 6 && f.ehp === b; i++) { f.mp = 1e4; r = ss.act("spell:" + frost.id); } ok(f.ehp < b, "crafted spells hit in turn-by-turn fights"); }
  ok(MAGIC.dualable(D.SPELLS[frost.id]), "crafted bolts can be dual cast");
  // Runic Echo
  const e = mage(60); e.perks = { ...(e.perks || {}), runic_echo: 1, rune_master: 1 }; const ec = R.craft(e, { el: "fire", dl: "cloak" }), er = R.craft(e, { el: "fire", dl: "rune" });
  const ef = fightOf(e, foeOf(CHIEF, 30)); ef.cast(ec.id); ok(ef.cloak && ef.cloak.turns === 11, "Runic Echo: the cloak lasts a round longer");
  const rf = fightOf(e, foeOf(CHIEF, 30)); rf.cast(er.id); ok(rf.rune && rf.rcRearm && rf.rcRearm.dmg === rf.rune.dmg * 0.5, "Runic Echo: the rune trap re-arms at half");
  // the Magic tab and the saves
  ok(/rc-desc/.test(MAGIC.infoHTML(s, frost.id)) && /chill/.test(MAGIC.infoHTML(s, frost.id)), "the Magic tab shows what it does");
  const copy = JSON.parse(JSON.stringify(s)); for (const x of copy.runeSpells) delete D.SPELLS[x.id];
  const back = G.migrate(copy); ok(back.runeSpells.every((x) => D.SPELLS[x.id] && back.spells.includes(x.id)), "crafted spells come back after loading");
  ok(/fade/.test(R.forget(s, frost.id)) && !s.spells.includes(frost.id) && !D.SPELLS[frost.id], "forget a rune spell");
  // only at the College or an enchanter
  const away = mage(50); away.location = "Riverwood"; ok(R.craft(away, { el: "fire", dl: "bolt" }).err, "no Rune table on the road");
  const poor = mage(50); poor.gold = 5; ok(/gold/.test(R.craft(poor, { el: "fire", dl: "bolt" }).err || ""), "the work costs gold");
}
// ---- 7. no one-shots: a dual-cast crafted spell never takes half a strong foe at your level, and never more than the
//         best bought spell of its tier does
{
  const share = (s, id, L) => { let worst = 0; for (let i = 0; i < 12; i++) { const f = fightOf(s, foeOf(CHIEF, L)), hp = f.ehp; f.cast(id, false, true); if (f.rune) f.ehp -= f.rune.dmg * (D.SPELLS[id].element ? MAGIC.elem(f, D.SPELLS[id].element) : 1); worst = Math.max(worst, (hp - f.ehp) / hp); } return worst; };
  for (const [sk, L] of [[24, 8], [49, 18], [74, 28], [99, 38], [100, 45]]) {
    const s = mage(sk); s.perks = { ...(s.perks || {}), rune_scholar: 2, augmented_flames: 2, augmented_frost: 2, augmented_shock: 2, rune_master: 1 }; s.runes = Object.keys(R.RUNES);
    const tier = R.TIERS[[0, 25, 50, 75, 100].filter((v) => sk >= v).length - 1];
    const bought = Object.entries(D.SPELLS).filter(([, x]) => !x.custom && !x.hidden && x.level === tier && ["damage", "rune"].includes(x.kind) && ["fire", "frost", "shock"].includes(x.element)).sort((p, q) => q[1].amount - p[1].amount)[0];
    const top = bought ? share(s, bought[0], L) : 0.4;
    for (const spec of [{ el: "fire", dl: "touch" }, { el: "frost", dl: "rune" }, { el: "shock", dl: "bolt", mods: ["chain"] }, { el: "fire", dl: "area" }]) {
      const x = R.craft(s, spec); if (x.err) { ok(false, x.err); continue; }
      const worst = share(s, x.id, L);
      ok(worst < Math.max(0.5, top * 1.05) && worst <= Math.max(0.4, top * 1.05), `${D.SPELLS[x.id].name} (${spec.el} ${spec.dl}) dual cast at skill ${sk}: ${(worst * 100).toFixed(0)}% of a level ${L} chief (best bought ${bought?.[1].name}: ${(top * 100).toFixed(0)}%)`);
      R.forget(s, x.id);
    }
  }
}
// ---- 8. fight sims: a mage with crafted spells vs the same mage with bought ones (both fight systems)
{
  const rows = [];
  const bestCloak = (s) => s.spells.filter((id) => D.SPELLS[id]?.kind === "cloak" && !D.SPELLS[id].custom && MAGIC.failChance(s, id) === 0).sort((p, q) => D.SPELLS[q].amount - D.SPELLS[p].amount)[0];
  for (const L of [10, 20, 30, 40]) {
    const build = (craft) => {
      const s = c.make("mage", L); s.location = "Winterhold"; s.gold = 1e6; s.runes = Object.keys(R.RUNES);
      let id = null;
      if (craft === "cloak") id = bestCloak(s);
      else if (craft) { const x = R.craft(s, craft); if (x.err) throw new Error(x.err); id = x.id; }
      if (craft && !id) return null;
      if (id) { const rules = G.loadout(s).rules; const i = rules.findIndex((r) => r.if === "always" && /^spell:/.test(r.do)); if (i >= 0) rules[i] = { if: "always", do: "spell:" + id }; else rules.unshift({ if: "always", do: "spell:" + id }); }
      s.health = G.maxHealth(s); s.healthTs = G.now(); return s;
    };
    for (const [label, spec] of [["bought", null], ["fire bolt", { el: "fire", dl: "bolt" }], ["frost slow", { el: "frost", dl: "bolt", mods: ["slow"] }], ["shock chain", { el: "shock", dl: "bolt", mods: ["chain"] }], ["bought cloak", "cloak"], ["fire cloak", { el: "fire", dl: "cloak" }]]) {
      if (!build(spec)) continue;
      let wI = 0, tI = 0, wT = 0, rT = 0;
      for (let i = 0; i < N; i++) {
        const s1 = build(spec), f1 = new G.Fight(s1, foeOf(CHIEF, L)); f1.run({ trySneak: false, t: G.now() }); if (f1.won) wI++; tI += f1.turn || 0;
        const s2 = build(spec), f2 = new G.Fight(s2, foeOf(CHIEF, L)); const ss = TB.simulate(f2, { t: G.now() }); if (f2.won && !f2.escaped) wT++; rT += ss.round;
      }
      rows.push({ L, label, win: wI / N, turns: tI / N, tbWin: wT / N, rounds: rT / N });
    }
  }
  for (const r of rows) console.log(`L${r.L} ${r.label.padEnd(12)} instant: won ${(r.win * 100).toFixed(0).padStart(3)}% in ${r.turns.toFixed(1)} turns · turn-by-turn: won ${(r.tbWin * 100).toFixed(0).padStart(3)}% in ${r.rounds.toFixed(1)} rounds`);
  for (const L of [10, 20, 30, 40]) {
    for (const r of rows.filter((x) => x.L === L && !/bought/.test(x.label))) {
      // cloaks are measured against the bought cloaks (when you can cast one), the rest against your bought damage spells
      const b = rows.find((q) => q.L === L && q.label === (/cloak/.test(r.label) ? "bought cloak" : "bought"));
      if (b) {
        ok(r.turns >= b.turns * 0.8 - 0.5, `L${L} ${r.label}: instant fights don't end much faster (${r.turns.toFixed(1)} vs ${b.turns.toFixed(1)})`);
        ok(r.rounds >= b.rounds * 0.8 - 0.5, `L${L} ${r.label}: turn-by-turn fights don't end much faster (${r.rounds.toFixed(1)} vs ${b.rounds.toFixed(1)})`);
      }
      ok(r.rounds >= 3, `L${L} ${r.label}: a chief lasts more than a couple of rounds (${r.rounds.toFixed(1)})`);
    }
  }
}
// ---- 9. Polish
{
  c.__lang = "pl";
  const s = mage(50), x = R.craft(s, { el: "frost", dl: "bolt", mods: ["slow"] }), rec = s.runeSpells.find((r) => r.id === x.id);
  ok(rec.pl && I18N.tr(rec.name) === rec.pl, `the spell's Polish name: ${rec.name} → ${rec.pl}`);
  const lines = ["Rune table", "Craft", "Runes", "Your spells", "Element", "Delivery", "Modifier", "Power budget", "Not found yet", "Learned", "Forget", "Less power, less magicka.", "Never stronger than the best bought spell of your tier.",
    ...Object.values(R.NAMES), ...Object.values(R.RUNES).map((r) => r.how), "Rune Scholar", "Spellwright", "Runic Echo", "College of Winterhold", "Arcane enchanter", "Next tier at", "Where:", "magicka", "gold", "runes", "Magicka", "Power", "Gold"];
  const miss = lines.filter((l) => I18N.tr(l) == null || I18N.tr(l) === l);
  ok(!miss.length, "Polish for: " + miss.join(" | "));
  const desc = R.describe(rec), tr = I18N.tr(desc); ok(tr && tr !== desc, "Polish for the description: " + desc + " → " + tr);
  const msg = R.craft(s, { el: "fire", dl: "bolt" }).text; ok(I18N.tr(msg) && I18N.tr(msg) !== msg, "Polish for the crafted message: " + I18N.tr(msg));
  const tome = R.freshText(["frost", "cloak"]).trim(); ok(I18N.tr(tome) && I18N.tr(tome) !== tome, "Polish for new runes: " + I18N.tr(tome));
  c.__lang = "en";
}
console.log(fails ? `${fails} of ${n} checks FAILED` : `all ${n} rune-crafting checks passed`);
process.exit(fails ? 1 : 0);
