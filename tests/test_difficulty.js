/* Difficulty: Story / Normal / Hard (difficulty.js). W=/path/to/game/ node test_difficulty.js [runs]
   Multipliers, the snapshot at fight start, the party leader's setting, shared fights carry the snapshot, world events
   stay Normal, rewards identical, skill practice evened out, minigame windows, tactics, and a sim summary per
   difficulty (win rates, rounds, the biggest single foe blow). Prints the table and ALL OK. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const RUNS = +(process.env.RUNS || process.argv[2] || 24);
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "difficulty.js", "engine.js", "foecap.js", "stacks.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "foekit.js", "fightread.js", "foeintent.js", "minigame.js", "tbfight.js", "sharedfight.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0; const ok = (cnd, m) => { if (!cnd) { fails++; console.log("FAIL", m); } };
// ---- heroes like a real player has them (same as tests/test_tbfight.js, short)
const tierOf = (L) => L < 8 ? 0 : L < 15 ? 1 : L < 25 ? 2 : L < 35 ? 3 : 4;
const GEAR = {
  warrior: [["iron_sword", ["iron_helmet","iron_armor","iron_gauntlets","iron_boots"], "iron_shield"], ["steel_sword", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"], "steel_shield"], ["steel_sword", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"], "steel_shield"], ["dwarven_sword", ["dwarven_helmet","dwarven_armor","steel_gauntlets","steel_boots"], "steel_shield"], ["dwarven_war_axe", ["dwarven_helmet","dwarven_armor","steel_gauntlets","steel_boots"], "steel_shield"]],
  archer: [["hunting_bow", ["hide_helmet","hide_armor","hide_bracers","hide_boots"]], ["hunting_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]], ["elven_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]], ["dwarven_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]], ["elven_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]]],
  mage: [[null, ["mage_robes"]], [null, ["mage_robes"]], [null, ["mage_robes"]], [null, ["mage_robes"]], [null, ["archmage_robes"]]],
};
const MAIN = { warrior: [["One-Handed",1],["Heavy Armor",1],["Blocking",0.9],["Smithing",0.8],["Restoration",0.3]], archer: [["Archery",1],["Light Armor",0.9],["Sneak",0.6],["Smithing",0.7]], mage: [["Destruction",1],["Restoration",0.9],["Conjuration",0.7],["Alteration",0.7]] };
const ATTR = { warrior: [0.7,0,0.3], archer: [0.6,0,0.4], mage: [0.4,0.6,0] };
function bestSpell(s, kinds, school) { let best = null; for (const id of s.spells) { const sp = D.SPELLS[id]; if (!sp || !kinds.includes(sp.kind) || (school && sp.school !== school)) continue; if (typeof MAGIC !== "undefined" && MAGIC.failChance(s, id) > 0.05) continue; const v = (sp.amount || 0) / Math.max(1, G.spellCost(s, sp)) * Math.sqrt(sp.amount || 1); if (!best || v > best[1]) best = [id, v]; } return best?.[0] || null; }
function make(build, L, diff) {
  const s = G.newSave("sim", "Sim", "nord"); s._test = true; s.level = L; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun;
  if (diff) s.diff = diff;
  for (const [k, w] of MAIN[build]) s.skills[k].lvl = Math.min(100, Math.round(s.skills[k].lvl + (2.3 * L) * w));
  const [h, m, st] = ATTR[build], ups = (L - 1) * 10; s.hpBonus = Math.round(ups * h); s.mpBonus = Math.round(ups * m); s.spBonus = Math.round(ups * st);
  const trees = MAIN[build].map(([k]) => k).filter((k) => PERKS.TREES[k]); let guard = 0;
  while (PERKS.pointsLeft(s) > 0 && guard++ < 400) { const opts = trees.flatMap((k) => PERKS.TREES[k].map((p) => p[0])).filter((id) => !PERKS.canTake(s, id)); if (!opts.length) break; PERKS.take(s, opts[0]); }
  const T = tierOf(L), [wpn, arm, sh] = GEAR[build][T], q = Math.min(6, 1 + Math.floor(G.skill(s, "Smithing") / 20)) - (T === 0 ? 1 : 0);
  const eqp = (item, temper) => { const id = G.give(s, item); const r = G.invRow(s, id); if (temper) { r.tq = q; r.temper = temper; } G.equip(s, id); return r; };
  if (wpn) eqp(wpn, q); for (const a of arm) eqp(a, D.ITEMS[a].type === "cloth" ? 0 : q * 2); if (sh) eqp(sh, q * 2);
  if (build === "archer") G.give(s, T >= 2 ? "arrow_steel" : "arrow_iron", 60);
  G.give(s, L >= 20 ? "potion_health" : "potion_health_minor", 2 + Math.floor(L / 10));
  const schools = MAIN[build].map(([k]) => k);
  for (const [id, sp] of Object.entries(D.SPELLS)) if (schools.includes(sp.school) && sp.kind !== "utility" && (typeof MAGIC === "undefined" || MAGIC.failChance(s, id) === 0) && !s.spells.includes(id)) s.spells.push(id);
  const R = [{ if: "hp_below", pct: 40, do: "potion:health" }]; const heal = bestSpell(s, ["heal"], "Restoration"); if (heal) R.push({ if: "hp_below", pct: 55, do: "spell:" + heal });
  if (build === "mage") { const sum = bestSpell(s, ["summon"]); if (sum) R.push({ if: "no_summon", do: "spell:" + sum }); const dmg = bestSpell(s, ["damage", "dot"], "Destruction"); if (dmg) R.push({ if: "always", do: "spell:" + dmg }); }
  else if (build === "warrior") R.push({ if: "sp_above", pct: 70, do: "power_attack" });
  R.push({ if: "always", do: "attack" }); G.loadout(s).rules = R;
  s.health = G.maxHealth(s); s.healthTs = G.now(); return s;
}
const enc = (name, L) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, L);
const boss = (key, L) => { const e = G.scaleEnemy({ ...DUNGEONS.ENEMY[key] }, L); e.health = Math.round(e.health * 0.8); e.hp = e.health; e.damage = Math.round(e.damage * 0.8 * 10) / 10; e.boss = true; return e; };
const near = (a, b, t = 0.02) => Math.abs(a - b) <= t * Math.max(1, Math.abs(b));

// 1. the three levels and their numbers
{ const L = DIFF.LEVELS;
  ok(L.story.hp === 0.85 && L.story.dmg === 0.7 && L.story.win === 1.4 && L.story.tac === "basic", "Story: health 85%, damage 70%, windows 140%, plain tactics");
  ok(L.normal.hp === 1 && L.normal.dmg === 1 && L.normal.win === 1, "Normal: everything 100%");
  ok(L.hard.hp === 1.1 && L.hard.dmg === 1.25 && L.hard.win === 0.8 && L.hard.tac === "smart", "Hard: health 110%, damage 125%, windows 80%, smart tactics");
  const s = make("warrior", 10); ok(DIFF.own(s) === "normal", "a hero without a setting plays Normal");
  ok(DIFF.set(s, "hard") && s.diff === "hard" && !DIFF.set(s, "nightmare") && s.diff === "hard", "set() keeps only real levels"); }

// 2. foe damage is set when the fight starts, from the foe's own number (never stacks)
{ const s = make("warrior", 10, "hard"), e = enc("Bandit outlaw", 10), d0 = e.damage;
  const f = new G.Fight(s, e); ok(f.diff.id === "hard" && near(e.damage, d0 * 1.25, 0.03), "Hard: foe damage ×1.25 (" + d0 + " → " + e.damage + ")");
  new G.Fight(s, e); new G.Fight(s, e); ok(near(e.damage, d0 * 1.25, 0.03), "meeting the same foe again doesn't stack (" + e.damage + ")");
  s.diff = "story"; new G.Fight(s, e); ok(near(e.damage, d0 * 0.7, 0.03), "the same foe on Story: ×0.7 of its own number (" + e.damage + ")");
  // foe groups build archetypes from e.baseDamage: it follows the difficulty too
  s.diff = "normal"; const e2 = enc("Bandit outlaw", 10), f2 = new G.Fight(s, e2); FOEGROUPS.prep(f2, 0); const b0 = e2.baseDamage;
  s.diff = "hard"; const f3 = new G.Fight(s, e2); FOEGROUPS.prep(f3, 0); ok(near(e2.baseDamage, b0 * 1.25, 0.03), "foe groups use the difficulty's damage (" + b0 + " → " + e2.baseDamage + ")");
  ok(e.gold === enc("Bandit outlaw", 10).gold || JSON.stringify(e.gold) === JSON.stringify(enc("Bandit outlaw", 10).gold), "gold on the foe is untouched"); }

// 3. foe health: the turn-based fight sizes the foe, then the difficulty scales it
{ const hpOf = (diff) => { let t = 0; for (let i = 0; i < 30; i++) { const s = make("warrior", 20, diff), f = new G.Fight(s, enc("Draugr", 20)); f.allies = []; const ss = new TB.Session(f, { trySneak: false }); t += ss.ehpBase; } return t / 30; };
  const n = hpOf("normal"), st = hpOf("story"), h = hpOf("hard");
  ok(near(st / n, 0.85, 0.08) && near(h / n, 1.1, 0.08), "foe health Story/Normal/Hard ≈ 85/100/110% (" + Math.round(st) + "/" + Math.round(n) + "/" + Math.round(h) + ")"); }

// 4. snapshot: changing the setting mid-fight changes nothing in the fight already on
{ const s = make("warrior", 20, "hard"), f = new G.Fight(s, enc("Bandit outlaw", 20)), ss = new TB.Session(f, { trySneak: false }); ss.begin();
  const dmg = f.e.damage, max = ss.ehpMax; s.diff = "story";
  let g = 0; while (!ss.done && g++ < 300) { const r = ss.advance(); if (r.turn === "me") { ss.act("attack"); if (ss.cur?.id === "me") ss.act("end"); } }
  ok(f.diff.id === "hard" && f.e.damage === dmg && ss.ehpMax >= max * 0.5, "a fight keeps its Hard snapshot after the setting changes to Story");
  ok(/d-hard/.test(DIFF.chip(f)) && /Hard/.test(DIFF.chip(f)), "the fight chip shows the snapshot: Hard");
  const st = TB.fightState(ss); ok(st.diff === "hard", "the shared fight record carries the snapshot (" + st.diff + ")");
  const f2 = new G.Fight(s, enc("Bandit outlaw", 20)); ok(f2.diff.id === "story", "the next fight uses the new setting"); }

// 5. party: the leader's setting counts; world events and other players are Normal
{ const lead = make("warrior", 20, "hard"); lead.id = "L1"; const mem = make("mage", 20, "story"); mem.id = "M1";
  const party = { id: "p", leader: "L1", leaderName: "Lead", members: [{ id: "L1" }, { id: "M1" }] };
  const cards = { L1: { id: "L1", diff: "hard" }, M1: { id: "M1", diff: "story" } };
  DIFF.mount({ party: () => party, cardOf: (id) => cards[id] });
  ok(DIFF.level(mem) === "hard" && DIFF.level(lead) === "hard", "in a party the leader's Hard counts for the Story member");
  const f = new G.Fight(mem, enc("Bandit outlaw", 20)); ok(f.diff.id === "hard" && f.diff.lead, "a member's fight takes the leader's snapshot");
  ok(/leader/.test(DIFF.settingsHTML((k, o, cur) => "", mem)) && /Story|story/.test(DIFF.own(mem)), "Settings shows your own choice and that the leader's counts");
  ok(/Hard/.test(DIFF.partyLine(mem, party)) && /leader/.test(DIFF.partyLine(mem, party)), "the Party panel shows the leader's difficulty");
  ok(PARTY.cardBits(lead, party).diff === "hard", "the player card tells the party your setting");
  cards.L1 = { id: "L1" }; ok(DIFF.level(mem) === "normal", "a leader on an older build plays Normal");
  party.members = [{ id: "M1" }]; party.leader = "M1"; ok(DIFF.level(mem) === "story", "alone again: your own setting");
  DIFF.mount({});
  const gev = enc("Bandit outlaw", 20); gev.gev = "x"; ok(new G.Fight(lead, gev).diff.id === "normal", "world bosses (great events) are Normal for everyone");
  const wev = enc("Bandit outlaw", 20); wev.wev = true; ok(new G.Fight(lead, wev).diff.id === "normal", "world events are Normal for everyone");
  const pvp = { name: "Beta", player: true, health: 300, hp: 300, damage: 20, level: 20, tags: ["humanoid"] }; ok(new G.Fight(lead, pvp).diff.id === "normal" && pvp.damage === 20, "fights against other players are never scaled");
  const raid = { name: "Dragon", pool: 9000, health: 500, hp: 500, damage: 30, level: 40, tags: ["dragon"] }; ok(new G.Fight(lead, raid).diff.id === "normal", "a shared raid dragon is Normal"); }

// 6. a teammate's phone takes the leader's snapshot from the shared fight record
if (typeof SHAREDFIGHT !== "undefined" && SHAREDFIGHT.build) {
  const lead = make("warrior", 20, "hard"), f = new G.Fight(lead, enc("Bandit outlaw", 20)), ss = new TB.Session(f, { trySneak: false }); ss.begin();
  const d = { ...TB.fightState(ss), id: "fx", owner: "L1" }; const mem = make("mage", 20, "story");
  try { const m = SHAREDFIGHT.build(mem, d, () => {}); ok(m.f.diff.id === "hard", "the teammate's mirror plays the leader's Hard (" + m.f.diff.id + ")"); }
  catch (x) { ok(false, "mirror build threw " + x.message); }
}

// 7. rewards: gold and loot don't depend on the difficulty
{ const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const out = {};
  for (const id of DIFF.IDS) { const s = make("warrior", 20, id), e = enc("Bandit outlaw", 20); e.tags = [...(e.tags || []), "elite"]; new G.Fight(s, e);
    const R = Math.random; Math.random = seeded(42); try { const g = e.gold[0] + Math.floor(Math.random() * (e.gold[1] - e.gold[0] + 1)); out[id] = JSON.stringify([g, G.rollLoot(s, e), e.level, e.gold]); } finally { Math.random = R; } }
  ok(out.story === out.normal && out.normal === out.hard, "the same gold and loot on Story, Normal and Hard"); }

// 8. minigame windows: Story wider, Hard tighter
{ const s = make("warrior", 10); const w = {};
  for (const id of DIFF.IDS) { s.diff = id; const f = new G.Fight(s, enc("Bandit outlaw", 10)); w[id] = MINIGAME.width(f, "attack", { kind: "bar" }); }
  ok(near(w.story / w.normal, 1.4, 0.01) && near(w.hard / w.normal, 0.8, 0.01), "fight minigame windows 140% / 100% / 80% (" + w.story.toFixed(2) + "/" + w.normal.toFixed(2) + "/" + w.hard.toFixed(2) + ")"); }

// 9. tactics: Hard foes go for the most hurt hero more often; Story foes leave healers alone
{ const pick = (id, hurt) => { let n = 0; const s = make("warrior", 20, id); for (let i = 0; i < 2000; i++) { s.health = G.maxHealth(s); const f = new G.Fight(s, enc("Bandit outlaw", 20));
      const a = { name: "Healer", player: true, role: "healer", hp: hurt ? 30 : 300, hp0: 300 }; f.allies = [a]; if (FOEINTENT.roll(f) === a) n++; } return n / 2000; };
  const nh = pick("normal", true), hh = pick("hard", true), sh = pick("story", true);
  ok(hh > nh + 0.05, "Hard foes go for a badly hurt hero more often (" + Math.round(nh * 100) + "% → " + Math.round(hh * 100) + "%)");
  ok(sh < nh - 0.1, "Story foes don't single out healers (" + Math.round(sh * 100) + "% vs " + Math.round(nh * 100) + "%)"); }

// 10. sims per difficulty: win rates, rounds, biggest single foe blow (share of the hero's health), skill practice
const groups = { normal: (L) => enc(["Bandit outlaw", "Wolf pack", "Draugr", "Forsworn ambush", "Black bear", "Sabre cat"][Math.floor(Math.random() * 6)], L),
  tough: (L) => enc(["Vampire", "Frost troll", "Thalmor patrol"][Math.floor(Math.random() * 3)], L),
  boss: (L) => boss(["deathlord", "chief", "centurion", "hagraven", "master", "lich"][Math.floor(Math.random() * 6)], L) };
const res = {}, HERO = {}; let errs = 0;
for (const id of DIFF.IDS) for (const g of Object.keys(groups)) {
  let w = 0, n = 0, rounds = 0, maxHit = 0, xp = 0, xpN = 0;
  for (const b of ["warrior", "archer", "mage"]) for (const L of [5, 20, 40]) for (let i = 0; i < RUNS; i++) {
    const s = HERO[b + L + id] || (HERO[b + L + id] = make(b, L, id)); s.health = G.maxHealth(s); s.healthTs = G.now();   // TB.simulate doesn't touch the save
    const f = new G.Fight(s, groups[g](L)); f.allies = [];
    try { const ss = TB.simulate(f, { t: G.now() }); n++; if (f.won && !f.escaped) w++; rounds += ss.round;
      const mh = G.maxHealth(s); let prev = f.hp0;
      for (const e of ss.ev) { if (e.hp == null) continue; if (e.kind === "foe" && prev - e.hp > 0) maxHit = Math.max(maxHit, (prev - e.hp) / mh); prev = e.hp; }
      if (f.won) { let t = 0; for (const [k, v] of Object.entries(f.xp)) t += v * DIFF.xp(f, k); xp += t; xpN++; }
    } catch (x) { errs++; if (errs < 4) console.log("ERR", id, g, b, L, x.stack.split("\\n").slice(0, 3).join(" | ")); } }
  res[id + " " + g] = { win: w / Math.max(1, n), rounds: rounds / Math.max(1, n), maxHit, xp: xp / Math.max(1, xpN) };
}
ok(errs === 0, "no errors in the sims (" + errs + ")");
console.log("difficulty group   win%  rounds  biggest blow  practice/fight");
for (const [k, r] of Object.entries(res)) console.log(k.padEnd(16), String(Math.round(r.win * 100)).padStart(4) + "%", r.rounds.toFixed(1).padStart(6), (Math.round(r.maxHit * 100) + "%").padStart(10), String(Math.round(r.xp)).padStart(12));
for (const g of Object.keys(groups)) {
  ok(res["story " + g].win >= res["normal " + g].win - 0.05 && res["normal " + g].win >= res["hard " + g].win - 0.05, g + ": Story wins at least as often as Normal, Normal as Hard");
  ok(res["hard " + g].maxHit < 0.95, g + ": Hard never one-shots a hero at full health (biggest blow " + Math.round(res["hard " + g].maxHit * 100) + "%)");
  ok(res["hard " + g].rounds <= res["normal " + g].rounds * 1.25 + 0.5, g + ": Hard isn't much longer than Normal (" + res["hard " + g].rounds.toFixed(1) + " vs " + res["normal " + g].rounds.toFixed(1) + " rounds)");
}
ok(Math.abs(res["story normal"].xp / res["normal normal"].xp - 1) < 0.3 && Math.abs(res["hard normal"].xp / res["normal normal"].xp - 1) < 0.3, "skill practice per won fight about the same on every difficulty");
globalThis.__res = res;
console.log(fails ? fails + " FAILED" : "ALL OK");
if (fails) process.exitCode = 1;
`, c);
if (c.process.exitCode) process.exitCode = c.process.exitCode;
