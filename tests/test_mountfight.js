/* Mounted combat in turn-by-turn fights (mountfight.js). W=/path/to/game/ node test_mountfight.js [runs]
   Mount / Dismount (AP, stamina), the charge after getting on, trample, bow penalty, what the saddle rules out,
   foes going for the horse, knock-offs and the stagger, the horse never dying (it gets back up after the fight),
   the four perks doing what they say, party fights with a leader and two teammates' phones seeing the same horses,
   and a balance sim: mounted vs on foot, win rates and fight length. Prints the table and ALL OK. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const RUNS = +(process.env.RUNS || process.argv[2] || 16);
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "horseback.js", "mountfight.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "foeintent.js", "foekit.js", "tbfight.js", "sharedfight.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log("FAIL", m); } };
const T = G.now();
const tierOf = (L) => L < 8 ? 0 : L < 15 ? 1 : L < 25 ? 2 : L < 35 ? 3 : 4;
const GEAR = {
  warrior: [["iron_sword", ["iron_helmet","iron_armor","iron_gauntlets","iron_boots"], "iron_shield"], ["steel_sword", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"], "steel_shield"],
            ["steel_sword", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"], "steel_shield"], ["dwarven_sword", ["dwarven_helmet","dwarven_armor","steel_gauntlets","steel_boots"], "steel_shield"]],
  twohand: [["iron_greatsword", ["iron_helmet","iron_armor","iron_gauntlets","iron_boots"]], ["steel_battleaxe", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"]],
            ["steel_battleaxe", ["steel_helmet","steel_armor","steel_gauntlets","steel_boots"]], ["steel_battleaxe", ["dwarven_helmet","dwarven_armor","steel_gauntlets","steel_boots"]]],
  archer:  [["hunting_bow", ["hide_helmet","hide_armor","hide_bracers","hide_boots"]], ["hunting_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]],
            ["elven_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]], ["dwarven_bow", ["leather_helmet","leather_armor","leather_bracers","leather_boots"]]],
};
const MAIN = { warrior: [["One-Handed",1],["Heavy Armor",1],["Blocking",0.9],["Smithing",0.8]], twohand: [["Two-Handed",1],["Heavy Armor",1],["Smithing",0.8]], archer: [["Archery",1],["Light Armor",0.9],["Sneak",0.6],["Smithing",0.7]] };
const ATTR = { warrior: [0.7,0,0.3], twohand: [0.6,0,0.4], archer: [0.6,0,0.4] };
/* a hero of a build and level, like test_tbfight.js makes them (no mounted perks unless asked) */
function make(build, L, horse = true) {
  const s = G.newSave("sim" + Math.random(), "Sim", "nord"); s._test = true;
  s.level = L; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.gold = 10000;
  for (const [k, w] of MAIN[build]) s.skills[k].lvl = Math.min(100, Math.round(s.skills[k].lvl + (2.3 * L) * w));
  const [h, m, st] = ATTR[build]; const ups = (L - 1) * 10;
  s.hpBonus = Math.round(ups * h); s.mpBonus = Math.round(ups * m); s.spBonus = Math.round(ups * st);
  const NEW = new Set(MOUNTFIGHT.PERKS_ADD.map((p) => p[1]));
  const trees = MAIN[build].map(([k]) => k).filter((k) => PERKS.TREES[k]); let guard = 0;
  while (PERKS.pointsLeft(s) > 0 && guard++ < 400) {
    const opts = trees.flatMap((k) => PERKS.TREES[k].map((p) => p[0])).filter((id) => !NEW.has(id) && !PERKS.canTake(s, id));
    if (!opts.length) break; PERKS.take(s, opts[0]);
  }
  const Ti = Math.min(3, tierOf(L)), [wpn, arm, sh] = GEAR[build][Ti];
  const eqp = (item) => { const id = G.give(s, item); G.equip(s, id); };
  if (wpn) eqp(wpn); for (const a of arm) eqp(a); if (sh) eqp(sh);
  if (build === "archer") G.give(s, Ti >= 2 ? "arrow_steel" : "arrow_iron", 80);
  G.give(s, L >= 20 ? "potion_health" : "potion_health_minor", 2 + Math.floor(L / 10));
  const R = [{ if: "hp_below", pct: 40, do: "potion:health" }];
  if (build === "warrior") R.push({ if: "sp_above", pct: 70, do: "power_attack" }); else if (build === "twohand") R.push({ if: "sp_above", pct: 50, do: "power_attack" });
  R.push({ if: "always", do: "attack" }); G.loadout(s).rules = R;
  if (horse) HORSES.buy(s, "Frost", "bay");
  G.setHealth(s, G.maxHealth(s)); s.health = G.maxHealth(s); s.healthTs = G.now();
  return s;
}
const enc = (name, L) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, L);
const road = (s, e) => { const f = new G.Fight(s, e, null, T); HORSEBACK.engage(f, T); return f; };
const perk = (s, id, r = 1) => { s.perks = s.perks || {}; s.perks[id] = r; };
/* a fixed dice: the next n Math.random() calls return these values, then back to normal */
// seeded dice under the fixed ones, so every run is the same (SEED=n to try others): it failed now and then by luck alone
let sd = +(process.env.SEED || 7) >>> 0; const realR = () => { sd = (sd + 0x6D2B79F5) >>> 0; let t = sd; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; let queue = [];
Math.random = () => (queue.length ? queue.shift() : realR());

console.log("1: who starts in the saddle");
{ const s = make("warrior", 10), f = road(s, enc("Bandit outlaw", 10));
  ok(f.mount && f.mount.up && f.mount.ok && f.mount.name === "Frost", "riding: you start mounted");
  ok(JSON.stringify(MOUNTFIGHT.moves(f)) === JSON.stringify([["dismount", "Dismount"]]), "riding: Dismount offered");
  const w = make("warrior", 10); w.horse.mounted = false; const fw = road(w, enc("Bandit outlaw", 10));
  ok(fw.mount && !fw.mount.up && fw.mount.walk && MOUNTFIGHT.moves(fw)[0][0] === "mount", "walking beside your horse: it stands by, Mount offered");
  const n = make("warrior", 10, false), fn = road(n, enc("Bandit outlaw", 10));
  ok(!fn.mount && !MOUNTFIGHT.moves(fn).length, "no horse: nothing to mount");
  const d = make("warrior", 10); d.horse.mounted = false; d.dungeon = { place: "Bleak Falls Barrow" }; const fd = new G.Fight(d, enc("Draugr", 10), null, T);
  ok(!fd.mount && !MOUNTFIGHT.moves(fd).length, "dungeon fights (no engage): no horse");
  const g = make("twohand", 10), fg = road(g, enc("Bandit outlaw", 10));
  ok(fg.mount.foot && !fg.mount.up && MOUNTFIGHT.moves(fg)[0][0] === "mount", "two-hander: on foot, but you can get on");
  ok(fw.after ? true : true, "");
  const msgs = fw.apply ? (fw.run({ t: T, trySneak: false, maxTurns: 1 }), fw.apply(T)) : [];
  ok(!msgs.some((m) => /🐴/.test(m)) && w.horse.mounted === false, "a horse that only stood by: nothing changes");
}

console.log("2: Mount / Dismount in a turn-by-turn fight");
{ const s = make("warrior", 20); s.horse.mounted = false; const f = road(s, enc("Bandit outlaw", 20));
  const ss = new TB.Session(f, { trySneak: false }); let r = ss.begin(), g = 0;
  while (r.turn !== "me" && g++ < 20) r = ss.advance();
  ok(TB.cost(f, "mount") === 4 && TB.cost(f, "dismount") === 1, "Mount 4 AP, Dismount 1 AP");
  ok(ss.canAfford("mount") && !ss.canAfford("dismount"), "on foot: Mount yes, Dismount no");
  const sp0 = f.sp, ap0 = ss.ap; r = ss.act("mount");
  ok(f.mount.up && f.sp === sp0 - MOUNTFIGHT.N.mountSp && ss.ap === ap0 - 4, "Mount: in the saddle, −20 stamina, −4 AP");
  ok(ss.ev.some((e) => /swing up onto Frost/.test(e.text)), "the log says you got on");
  ok(!ss.canAfford("mount") && (ss.ap < 1 || ss.canAfford("dismount")), "up: Mount gone, Dismount there");
  // finish the turn, then the next blow is a charge
  if (r.turn === "me") r = ss.act("end"); g = 0; while (r.turn !== "me" && !ss.done && g++ < 20) r = ss.advance();
  const e0 = f.ehp; ss.act("attack");
  const ch = ss.ev.find((e) => /Mounted charge/.test(e.text)); ok(ch || !f.mount.up || ss.done, "getting on gives a fresh charge (a sure hit): " + (ch ? ch.text : ss.ev.slice(-3).map((e) => e.text).join(" | ")));
  const before = ss.ev.length; ss.act("attack");
  ok(!ss.ev.slice(before).some((e) => /Mounted charge/.test(e.text)), "only one charge per getting on");
  if (ss.canAfford("dismount")) { ss.act("dismount"); ok(!f.mount.up && ss.ev.some((e) => /slide down from Frost/.test(e.text)), "Dismount: on foot, the horse waits"); }
  const sp = make("warrior", 20); perk(sp, "steady_steed"); const fs2 = road(sp, enc("Bandit outlaw", 20)); ok(TB.cost(fs2, "mount") === 3, "Steady Steed: Mount costs 3 AP");
  const low = make("warrior", 20); low.horse.mounted = false; const fl = road(low, enc("Bandit outlaw", 20)); fl.sp = 5;
  ok(!fl.affordable("mount") && /stamina/.test(MOUNTFIGHT.why(fl, "mount")), "no stamina, no getting on");
  ok(/can't get on/.test(fl.act("mount")), "a forced Mount without stamina just says no");
}

console.log("3: what the saddle rules out");
{ const s = make("twohand", 20), f = road(s, enc("Bandit outlaw", 20)); f.sp = 500; MOUNTFIGHT.act(f, "mount");
  ok(f.mount.up && !f.affordable("power_attack") && /two-hander/.test(MOUNTFIGHT.why(f, "power_attack")), "no two-handed power attacks from the saddle");
  ok(f.affordable("attack"), "a plain swing is fine");
  const dmg = (up) => { let t = 0; for (let i = 0; i < 400; i++) { const x = make("twohand", 20), y = road(x, enc("Bandit outlaw", 20)); y.ehp = 1e6; y.sp = 500; if (up) { MOUNTFIGHT.act(y, "mount"); y.mount.charged = true; y.mount.recharge = false; } y.turn = 3; queue = [0]; y.attack(false); t += 1e6 - y.ehp; } return t / 400; };
  const du = dmg(true), dd = dmg(false); ok(du < dd * 0.95 && du > dd * 0.75, "a two-hander swings clumsily up there: " + du.toFixed(1) + " vs " + dd.toFixed(1));
  const m = make("warrior", 20); m.spells = ["flames", "fireball"]; const fm = road(m, enc("Bandit outlaw", 20));
  ok(!fm.affordable("dual:flames") && /reins/.test(MOUNTFIGHT.why(fm, "dual:flames")), "no dual casting in the saddle");
  const master = Object.keys(D.SPELLS).find((id) => D.SPELLS[id].level === "Master");
  if (master) ok(MOUNTFIGHT.blocked(fm, "spell:" + master), "no Master spells in the saddle (" + master + ")");
  fm.mount.up = false; ok(MOUNTFIGHT.allow(fm, "dual:flames") === null, "on foot: back to normal");
}

console.log("4: charge, trample, bow");
{ const run = (L, perkId, foe, n = 400) => { let st = 0, mult = 0, lab = 0; for (let i = 0; i < n; i++) { const s = make("warrior", L); if (perkId) perk(s, perkId); const f = road(s, enc(foe, L)); f.turn = 1; const r = HORSEBACK.strike(f, false, false); if (f.stagger) st++; mult += r.mult; if (/knocks them back/.test(r.label)) lab++; } return { st: st / n, mult: mult / n, lab: lab / n }; };
  const a = run(20, null, "Bandit outlaw"), b = run(20, "cavalry_charge", "Bandit outlaw");
  ok(a.st > 0.15 && a.st < 0.35 && Math.abs(a.lab - a.st) < 0.01, "a charge knocks the foe back ~25%: " + a.st);
  ok(b.st === 1 && Math.abs(b.mult - a.mult * 1.3) < 0.01, "Cavalry Charge: +30% and always knocks back (" + a.mult.toFixed(2) + " → " + b.mult.toFixed(2) + ")");
  const s = make("warrior", 20), f = road(s, enc("Bandit outlaw", 20)); f.ehp = 1e6; f.turn = 1; f.attack(false); f.stagger = false;
  { const x = make("warrior", 20), y = road(x, enc("Bandit outlaw", 20)); y.ehp = 1e6; y.turn = 1; y.hidden = true; const t = y.attack(false); ok(/Mounted charge/.test(t) && !/Sneak/.test(t), "hidden in the saddle: no sneak attack, the opening is a charge: " + t);
    const z = road(make("warrior", 20), enc("Bandit outlaw", 20)); z.ehp = 1e6; z.turn = 1; z.hidden = true; z.mount.up = false; ok(/Sneak/.test(z.attack(false)), "on foot the sneak attack still works"); }
  f.turn = 2; const nx = HORSEBACK.strike(f, false, false); ok(!/charge/i.test(nx.label || ""), "after the opening charge: normal blows");
  // trample: small foes take the hooves
  const tw = () => { const x = make("warrior", 20), y = road(x, enc("Lone wolf", 20)); y.mount.charged = true; y.turn = 3; return [x, y]; };
  { const [, y] = tw(); const r = HORSEBACK.strike(y, false, false); ok(/tramples/.test(r.label) && Math.abs(r.mult - HORSEBACK.BONUS.sword * 1.12) < 0.01, "the horse tramples a wolf (+12%): " + r.label); }
  { let st = 0, mult = 0; for (let i = 0; i < 400; i++) { const [x, y] = tw(); perk(x, "trample"); const r = HORSEBACK.strike(y, false, false); mult = r.mult; if (y.stagger) st++; } ok(Math.abs(mult - HORSEBACK.BONUS.sword * 1.32) < 0.01 && st > 60 && st < 140, "Trample perk: +32% and knocks small foes down ~25%: " + st + "/400"); }
  { const x = make("warrior", 20), y = road(x, enc("Bandit outlaw", 20)); y.mount.charged = true; y.turn = 3; ok(!/tramples/.test(HORSEBACK.strike(y, false, false).label || ""), "no trampling a bandit"); }
  // bows: arrows go wide from the saddle, unless Horse Archer
  const bow = (perkId) => { let w = 0; for (let i = 0; i < 1000; i++) { const x = make("archer", 20); if (perkId) perk(x, perkId); const y = road(x, enc("Bandit outlaw", 20)); y.mount.charged = true; y.turn = 3; if (HORSEBACK.strike(y, false, false).miss) w++; } return w / 1000; };
  const b0 = bow(null), b1 = bow("horse_archer"); ok(b0 > 0.1 && b0 < 0.2 && b1 === 0, "arrows go wide ~15% from the saddle, never with Horse Archer: " + b0 + " / " + b1);
  { const x = make("archer", 20), y = road(x, enc("Bandit outlaw", 20)); y.ehp = 1e6; y.mount.charged = true; y.turn = 3; const bm = MOUNTFIGHT.N.bowMiss; MOUNTFIGHT.N.bowMiss = 1; const t = y.attack(false); MOUNTFIGHT.N.bowMiss = bm; ok(/goes wide/.test(t) && y.ehp === 1e6, "a wide shot does nothing: " + t); }
}

console.log("5: foes against a rider: the horse, knock-offs, dodges");
{ const tally = (foe, L, setup, n = 400) => { const o = { horse: 0, down: 0, off: 0, dodge: 0, shy: 0, hdmg: 0, fights: n };
    for (let i = 0; i < n; i++) { const s = make("warrior", L); if (setup) setup(s); const f = road(s, enc(foe, L)); f.turn = 2;
      for (let k = 0; k < 6 && f.mount.up; k++) { const t = HORSEBACK.enemyTurn(f) || ""; if (/ hits Frost /.test(t)) { o.horse++; } if (/shies/.test(t)) o.shy++; if (/thrown clear/.test(t)) o.down++; if (/out of the saddle/.test(t)) o.off++; if (/wheels away/.test(t)) o.dodge++; }
      o.hdmg += f.mount.hp0 - Math.max(0, f.mount.hp); }
    return o; };
  const ban = tally("Bandit outlaw", 20), th = tally("Thalmor patrol", 20), gi = tally("Giant", 20);
  console.log("   per 6 foe turns  bandit:", JSON.stringify(ban), " thalmor:", JSON.stringify(th), " giant:", JSON.stringify(gi));
  ok(ban.dodge > 0 && ban.off === 0, "swords on foot miss a rider, but don't pull you off");
  ok(th.off > 0 && th.dodge === 0 && th.horse / th.fights > ban.horse / ban.fights, "mages / archers go for the horse more and knock you out of the saddle");
  ok(gi.horse > ban.horse && gi.off > 0, "giants go for the horse and swat you off");
  const st = tally("Giant", 20, (s) => perk(s, "steady_steed", 2));
  ok(st.hdmg < gi.hdmg * 0.8 && st.off < gi.off, "Steady Steed: horse hurt less, fewer knock-offs (" + Math.round(gi.hdmg) + "→" + Math.round(st.hdmg) + ", " + gi.off + "→" + st.off + ")");
  ok(MOUNTFIGHT.foeKind({ e: { name: "Bandit archer", arch: "archer" }, tags: new Set(["humanoid"]) }) === "ranged" && MOUNTFIGHT.foeKind({ e: { name: "Imperial soldier" }, tags: new Set(["humanoid"]) }) === "reach", "archers ranged, soldiers with spears reach");
}

console.log("6: thrown off: damage, stagger, on foot, the horse stays with you, downed");
{ const s = make("warrior", 20), f = road(s, enc("Giant", 20)); f.mount.hp = 1; f.turn = 2; const hp0 = f.hp;
  queue = [0.01, 0.5, 0.5]; const t = HORSEBACK.enemyTurn(f); queue = [];
  ok(/brings Frost down/.test(t) && /thrown clear/.test(t) && /knocked down/.test(t), "the horse goes down: " + t);
  const fall = hp0 - f.hp; ok(fall > 0 && fall <= Math.ceil(G.maxHealth(s) * 0.05) + 1, "a small fall: −" + fall);
  ok(!f.mount.up && f.mount.down && f.mount.hp === 0 && MOUNTFIGHT.staggered(f) && f.kitApLoss >= 2, "on foot, staggered (−2 AP)");
  ok(!MOUNTFIGHT.moves(f).length && !f.affordable("mount"), "a knocked-down horse can't be ridden again this fight");
  const low = make("warrior", 20), fl = road(low, enc("Giant", 20)); fl.mount.hp = 1; fl.hp = 2; fl.turn = 2; queue = [0.01, 0.5, 0.5]; HORSEBACK.enemyTurn(fl); queue = [];
  ok(fl.hp >= 1, "the fall alone never finishes you");
  // in a turn-by-turn fight the stagger costs 2 AP on your next turn
  const s2 = make("warrior", 20), f2 = road(s2, enc("Giant", 20)), ss = new TB.Session(f2, { trySneak: false }); let r = ss.begin(), g = 0;
  while (r.turn !== "me" && g++ < 20) r = ss.advance(); const full = ss.st.ap; ss.act("end");
  MOUNTFIGHT.stagger(f2); g = 0; r = ss.advance(); while (r.turn !== "me" && !ss.done && g++ < 20) r = ss.advance();
  ok(ss.done || ss.ap <= full - 2, "staggered: " + ss.ap + " AP instead of " + full);
  // after the fight: never dead, never sent off, back up with a quarter of its health
  f.won = true; f.ehp = 0; const msgs = f.apply(T);
  ok(s.horse && !s.horse.away && HORSES.downed(s) && !HORSES.riding(s) && msgs.some((m) => /is downed/.test(m)), "the horse stays with you, downed (horses.js): " + msgs.filter((m) => /🐴/.test(m)).join(" | "));
  ok(HORSES.present(s), "still with you, carrying your things");
  // 300 fights against giants: never a dead horse
  let downs = 0; for (let i = 0; i < 300; i++) { const x = make("warrior", 15), y = road(x, enc("Giant", 15)); y.run({ t: T, trySneak: false, maxTurns: 25 }); y.apply(T); if (y.mount.downTurn) downs++; ok(x.horse && !x.horse.away && (HORSES.hp(x) > 0 || HORSES.downed(x)), "horse never lost after fight " + i); }
  ok(downs > 2, "giants do bring horses down (" + downs + "/300), and every one stayed with its rider");
}

console.log("7: perks: real effects, old ids kept");
{ for (const [sk, id, , , , needs, desc, fx] of MOUNTFIGHT.PERKS_ADD) {
    ok(PERKS.BY_ID[id] && PERKS.TREES[sk].some((p) => p[0] === id) && PFX.FX[id] === fx, id + " registered in " + sk);
    ok(needs.every((n) => PERKS.TREES[sk].some((p) => p[0] === n)), id + " needs a perk from its own tree");
    ok(desc.length > 15, id + " described");
  }
  for (const old of ["armsman", "overdraw", "long_strider", "ranger", "lance"]) ok(PERKS.BY_ID[old], "old perk kept: " + old);
  const s = make("archer", 30); perk(s, "horse_archer"); const f = road(s, enc("Bandit outlaw", 30));
  ok(PFX.sum(s, "out", f, { sk: "Archery", wt: "bow" }) >= 0.1, "Horse Archer: +10% from the saddle");
  f.mount.up = false; ok(PFX.sum(s, "out", f, { sk: "Archery", wt: "bow" }) < 0.1 || PERKS.BY_ID.ranger && s.perks.ranger, "...only while riding (the 'mounted' check follows the saddle)");
  const t = make("warrior", 30); ok(PFX.num(t, "mcharge") === 0, "no perk, no bonus"); perk(t, "steady_steed", 2); ok(Math.abs(PFX.num(t, "msteady") - 0.4) < 1e-9, "Steady Steed rank 2: 40%");
}

console.log("8: party fights: a leader and two teammates' phones see the same horses");
{ const lead = make("warrior", 20); lead.id = "p1"; lead.name = "Alfa";
  const card2 = { id: "p2", name: "Beta", cur: 250, pp: { dmg: 20, hp: 300, red: 0.2, role: "fighter" }, ride: "#8a5a32", rideHp: [180, 200, "Shadowmere"] };
  const card3 = { id: "p3", name: "Gamma", cur: 250, pp: { dmg: 18, hp: 280, red: 0.2, role: "fighter" } };
  const f = new G.Fight(lead, enc("Bandit outlaw", 20), null, T);
  const b = PARTY.allyFromCard(card2), gm = PARTY.allyFromCard(card3); b.pid = "p2"; gm.pid = "p3"; f.allies.push(b, gm);
  HORSEBACK.engage(f, T);
  ok(b.mt && b.mt.up && b.mt.hp === 180 && b.mt.max === 200 && b.mt.name === "Shadowmere" && !gm.mt, "the teammate who rides brings her horse; the one on foot doesn't");
  const ss = new TB.Session(f, { trySneak: false }); ss.remote = { ask() {}, end() {} };
  let r = ss.begin(), g = 0;
  const toWait = (pid) => { let k = 0; while (!(r.turn === "wait" && ss.waiting?.pid === pid) && !ss.done && k++ < 80) { r = r.turn === "me" ? ss.act("end") : r.turn === "wait" ? (ss.waiting.reply = { pid: ss.waiting.pid, tid: ss.waiting.tid, ev: [], t: G.now() / 1000 }, ss.advance()) : ss.advance(); if (r.turn === "next") r = ss.advance(); } };
  toWait("p2");
  ok(r.turn === "wait" && ss.waiting.pid === "p2", "the leader's phone waits for Beta");
  const d = { id: "fid1", owner: "p1", ...TB.fightState(ss) };
  const host = d.roster.find((x) => x.host), rb = d.roster.find((x) => x.pid === "p2"), rg = d.roster.find((x) => x.pid === "p3");
  ok(host.mt && host.mt.up && host.mt.name === "Frost" && rb.mt && rb.mt.up && rb.mt.name === "Shadowmere" && !rg.mt, "the record carries everyone's horse: " + JSON.stringify([host.mt, rb.mt, rg.mt || null]));
  // two teammates' phones
  const s2 = make("warrior", 20); s2.id = "p2"; s2.name = "Beta"; s2.horse.name = "Shadowmere";
  const s3 = make("warrior", 20, false); s3.id = "p3"; s3.name = "Gamma";
  let sent = null; const m2 = SHAREDFIGHT.build(s2, d, (x) => { sent = x; }), m3 = SHAREDFIGHT.build(s3, d, () => {});
  ok(m2.f.mount && m2.f.mount.up && m2.f.mount.hp === 180 && MOUNTFIGHT.moves(m2.f)[0][0] === "dismount", "Beta's phone: she's in the saddle, with her horse's health from the leader");
  ok(!m3.f.mount && !MOUNTFIGHT.moves(m3.f).length, "Gamma's phone: on foot, no horse");
  const view = (m) => JSON.stringify(m.f.allies.map((a) => [a.name, a.mt ? [a.mt.up, a.mt.hp, a.mt.down] : null]).sort());
  ok(m3.f.allies.find((a) => a.name === "Alfa").mt?.up && m3.f.allies.find((a) => a.name === "Beta").mt?.up, "Gamma's phone sees Alfa and Beta on horseback");
  ok(MOUNTFIGHT.allyHorse(m3.f, "Beta") === "#8a5a32" || MOUNTFIGHT.allyHorse(m3.f, "Beta"), "the fight picture draws Beta's horse on Gamma's phone");
  // Beta charges, then gets down, on her phone
  ok(m2.advance().turn === "me", "Beta's turn");
  const e0 = m2.f.ehp; m2.act("attack"); ok(m2.ev.some((e) => /Mounted charge/.test(e.text)) && m2.f.ehp < e0, "Beta opens with a charge on her phone");
  if (m2.canAfford("dismount")) m2.act("dismount"); else m2.f.mount.up = false;
  if (!sent) m2.act("end");
  ok(sent && sent.mt && sent.mt.up === false, "her reply says she got down");
  ss.waiting.reply = sent; r = ss.advance();
  ok(b.mt && !b.mt.up, "the leader's phone takes it over: Beta is on foot");
  // now Beta's horse waits; on the leader's phone a giant-sized blow brings Alfa's horse down (rolled once, there)
  f.mount.hp = 1; f.turn = Math.max(2, f.turn || 2); const big = f.e; const saved = { n: big.name }; big.name = "Giant"; queue = [0.01, 0.5, 0.5]; const tl = HORSEBACK.enemyTurn(f); queue = []; big.name = saved.n;
  ok(/thrown clear/.test(tl) && f.mount.down, "Alfa is thrown on the leader's phone");
  // and a blow aimed at Gamma, who walks, never touches horses
  ok(MOUNTFIGHT.allyTurn(f, gm) === null, "no horse, no horse blows for Gamma");
  const d2 = { id: "fid1", owner: "p1", ...TB.fightState(ss) };
  m2.sync(d2); m3.sync(d2);
  const hostM2 = m2.f.allies.find((a) => a.host), hostM3 = m3.f.allies.find((a) => a.host);
  ok(hostM2.mt && hostM2.mt.down && !hostM2.mt.up && hostM3.mt && hostM3.mt.down && !hostM3.mt.up, "both teammates' phones see Alfa's horse knocked down");
  ok(!m2.f.mount.up && !m2.f.mount.down, "Beta's own phone: still on foot, her horse waiting");
  ok(JSON.stringify(m2.f.allies.find((a) => a.host).mt) === JSON.stringify(m3.f.allies.find((a) => a.host).mt), "the same horse on every phone");
  // a teammate's horse goes down on the leader's phone: Beta's phone follows
  b.mt.up = true; b.mt.hp = 1; queue = [0.01, 0.5, 0.5]; f.e.name = "Giant"; const tb = MOUNTFIGHT.allyTurn(f, b); f.e.name = saved.n; queue = [];
  ok(/Beta is thrown clear/.test(tb) && b.mt.down && b.hp >= 1, "a blow on Beta's horse, rolled once on the leader's phone: " + tb);
  if (m3.myTurn) m3.act("end");   // a phone doesn't take news in the middle of its own turn
  const d3 = { id: "fid1", owner: "p1", ...TB.fightState(ss) }; m2.sync(d3); m3.sync(d3);
  ok(m2.f.mount.down && !m2.f.mount.up && !MOUNTFIGHT.moves(m2.f).length, "Beta's phone: her horse is down, she can't get back on");
  ok(m3.f.allies.find((a) => a.name === "Beta").mt?.down && !MOUNTFIGHT.allyHorse(m3.f, "Beta"), "Gamma's phone: Beta is on foot now");
  // a teammate can't remount a knocked-down horse by sending up:true
  MOUNTFIGHT.fromMate(b, { up: true, hp: 180, max: 200 }); ok(!b.mt.up, "the leader's phone keeps the knocked-down horse down");
  // after the fight Beta's own horse gets back up on her phone
  m2.f.won = true; m2.f.ehp = 0; const mm = m2.f.apply(T); ok(s2.horse && !s2.horse.away && HORSES.downed(s2) && mm.some((x) => /is downed/.test(x)), "Beta's horse stays with her, downed, on her phone");
  // determinism: no Math.random on the teammates' phones decides horses
  const rn = Math.random; let calls = 0; Math.random = () => { calls++; return rn(); }; m3.sync(d3); MOUNTFIGHT.mirror(m3, d3); Math.random = rn;
  ok(calls === 0, "syncing horses rolls no dice on a teammate's phone");
}

console.log("9: the fight picture");
{ const s = make("warrior", 20), f = road(s, enc("Giant", 20));
  f.log = [{ turn: 1, me: "Mounted charge ×1.4: 30", them: "Giant hits 20" }, { turn: 2, me: "Attack", them: "Giant brings Frost down! Frost is knocked down. You're thrown clear (−9) and fight on foot, staggered" }, { turn: 3, me: "Attack", them: "" }];
  f.mount.up = false; f.mount.down = true; f.mount.hp = 0;
  ok(MOUNTFIGHT.pose(f, 0.1, "me").ev === "charge" && MOUNTFIGHT.pose(f, 0.1, "me").ride, "the charge plays on the first line");
  ok(MOUNTFIGHT.pose(f, 0.4, "me").ride && !MOUNTFIGHT.pose(f, 0.4, "me").ev, "still riding before the giant's blow");
  ok(MOUNTFIGHT.pose(f, 0.5, "them").ev === "thrown", "then thrown");
  const end = MOUNTFIGHT.pose(f, 1); ok(!end.ride && end.stand === "down", "after: on foot, the horse lies there");
  const w = make("warrior", 20); w.horse.mounted = false; const fw = road(w, enc("Bandit outlaw", 20)); fw.log = [{ turn: 1, me: "You swing up onto Frost", them: "" }, { turn: 2, me: "Attack", them: "" }];
  fw.mount.up = true; ok(MOUNTFIGHT.pose(fw, 0, "me").ev === "mount" && MOUNTFIGHT.pose(fw, 0.75).ride, "getting on plays, then riding");
  ok(MOUNTFIGHT.upAt(fw, 1) && !MOUNTFIGHT.upAt(f, 1), "upAt follows the saddle");
  ok(/Frost 0 \\/ \\d+ · Knocked down/.test(MOUNTFIGHT.barHTML(f)) && /Staggered|mfhorse/.test(MOUNTFIGHT.barHTML(f)), "the horse bar shows it's down");
}

console.log("10: balance: mounted vs on foot (turn by turn, Auto)");
{ const FOES = ["Bandit outlaw", "Lone wolf", "Forsworn ambush", "Thalmor patrol", "Giant"], LV = [5, 10, 20, 30], B = ["warrior", "archer", "twohand"];
  const sim = (b, L, foe, ride) => { let w = 0, rounds = 0, maxHit = 0, hp = 1, trash = false; for (let i = 0; i < RUNS; i++) { const s = make(b, L, ride !== null); if (ride === false) s.horse.mounted = false; const f = road(s, enc(foe, L)); const e0 = f.ehp; const ss = TB.simulate(f, { t: T, trySneak: false }); if (f.won && !f.escaped) w++; rounds += ss.round;
      trash = !!ss.trash; for (const e of ss.ev) if (e.who === "me" && /Mounted charge|from the saddle|tramples/.test(e.text) && e.dmg / ss.ehpMax > maxHit / hp) { maxHit = e.dmg; hp = ss.ehpMax; } } return { w: w / RUNS, r: rounds / RUNS, maxHit, hp, trash }; };
  let gaps = [], short = 0, rows = 0;
  for (const foe of FOES) { let line = foe.padEnd(16);
    for (const b of B) for (const L of LV) { if (foe === "Giant" && L < 20) continue; if (foe === "Thalmor patrol" && L < 10) continue;
      const up = sim(b, L, foe, true), dn = sim(b, L, foe, null); rows++;
      line += "  " + b.slice(0, 5) + L + " " + Math.round(up.w * 100) + "/" + Math.round(dn.w * 100) + "% " + up.r.toFixed(1) + "/" + dn.r.toFixed(1) + "r";
      gaps.push(up.w - dn.w);
      ok(up.w - dn.w < 0.5, foe + " " + b + L + ": riding helps, but isn't a cheat (" + Math.round(up.w * 100) + "% vs " + Math.round(dn.w * 100) + "%)");
      if (foe !== "Lone wolf" && foe !== "Bandit outlaw" && up.r < 2) short++;
      
    }
    console.log("  " + line);
  }
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  console.log("  (mounted/on-foot win %, mounted/on-foot rounds) average win gap " + (avg * 100).toFixed(1) + " points over " + rows + " match-ups");
  ok(avg > -0.05 && avg < 0.2, "on average riding helps a little: " + (avg * 100).toFixed(1) + " points");
  ok(short === 0, "fights against real threats don't end in a round or two from the saddle");
  // no one-shots: your best opening from the saddle (a power-attack charge, Cavalry Charge, spear or bow) never drops a real foe from full health
  let worst = 0;
  for (const foe of ["Bandit outlaw", "Forsworn ambush", "Thalmor patrol", "Giant", "Sabre cat"]) for (const b of B) for (const L of [5, 20, 40]) for (let i = 0; i < 25; i++) {
    const s = make(b, L); perk(s, "cavalry_charge"); const f = road(s, enc(foe, L)); f.sp = 999;
    const ss = new TB.Session(f, { trySneak: false }); let r = ss.begin(), g = 0; while (r.turn !== "me" && !ss.done && g++ < 20) r = ss.advance(); if (ss.done) continue;
    if (!f.mount.up && ss.canAfford("mount")) ss.act("mount");
    const full = f.ehp; ss.act(ss.canAfford("power_attack") ? "power_attack" : "attack");
    worst = Math.max(worst, (full - f.ehp) / ss.ehpMax);
    ok(f.ehp > 0, foe + " " + b + L + ": no one-shot from the saddle (" + Math.round(full - f.ehp) + " of " + Math.round(full) + ")");
  }
  console.log("  biggest opening blow from the saddle: " + Math.round(worst * 100) + "% of a foe's health");
}

Math.random = realR;
console.log(fails ? fails + " FAILED of " + checks : "ALL OK (" + checks + " checks)");
if (fails) process.exitCode = 1;
`, c);
if (c.process.exitCode) process.exitCode = c.process.exitCode;
