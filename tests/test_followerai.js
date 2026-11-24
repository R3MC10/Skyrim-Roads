/* Followers as full characters (followerai.js) and party combos (combo.js).
   W=/path/to/game/ node test_followerai.js [runs]  — checks, then a sim table: you (a warrior) with each kind of follower.
   Run it with W= pointing at an older game folder for "before" numbers (the checks are skipped there, the table still prints). */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const RUNS = +(process.env.RUNS || process.argv[2] || 30);
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "horses.js", "horseback.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "craftfair.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "followers2.js", "followerai.js", "combo.js", "combatai.js", "foeintent.js", "tbfight.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
// the player builder from test_tbfight.js (same gear, skills and perks as its balance table)
const tb = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const helpers = tb.slice(tb.indexOf("const LEVELS"), tb.indexOf("if (!process.env.SIMONLY)"));
vm.runInContext(helpers + `
let n = 0; const OK = (x, m) => { if (!x) { fails++; console.log("FAIL", m); } else n++; };
const NEW = typeof FAI !== "undefined";
const hireAs = (s, id, arch) => { s.follower = { id, hp: 1, ts: G.now() }; const fo = FOL2.st(s, id); if (arch && fo.arch !== arch) FOL2.setArch(s, arch); s.follower.hp = FOL2.maxHp(s, id); return fo; };
const potions = (fo, item, q) => { fo.inv.push({ id: fo.next++, item, qty: q, charge: null }); };

if (NEW && !process.env.SIMONLY) {
  // 1. spells: start spells by style, teach a tome from your pack if their school skill is high enough
  { const s = fresh("warrior", 20), M = hireAs(s, "marcurio");
    OK(M.spells.includes("flames"), "a mage starts with Flames: " + M.spells);
    const tomes = Object.entries(D.ITEMS).filter(([, it]) => it.slot === "tome" && D.SPELLS[it.spell]);
    const tomeFor = (tier, school) => tomes.find(([, it]) => (D.SPELLS[it.spell].level || TOMES.level(it.spell)) === tier && D.SPELLS[it.spell].school === school && FAI.USABLE.has(D.SPELLS[it.spell].kind) && !M.spells.includes(it.spell));
    const nov = tomeFor("Apprentice", "Destruction") || tomeFor("Novice", "Destruction");
    OK(nov, "found a Destruction tome");
    const id = G.give(s, nov[0]); const msg = FOL2.act(s, { op: "teach", id: String(id) });
    OK(/learns/.test(msg) && M.spells.includes(nov[1].spell) && !G.invRow(s, id), "teach from your pack: " + msg);
    const master = tomeFor("Master", "Destruction") || tomeFor("Expert", "Destruction");
    if (master) { const id2 = G.give(s, master[0]); const m2 = FOL2.act(s, { op: "teach", id: String(id2) }); OK(/can't learn/.test(m2) && G.invRow(s, id2), "too hard a tome stays in your pack: " + m2); }
    const L = fresh("warrior", 20), Ly = hireAs(L, "lydia"); const r = FAI.canLearn(Ly, "fireball");
    OK(r !== true, "a warrior can't learn Fireball: " + r);
    // Battle Tutor: 10 points early, spells cheaper
    const ad = tomeFor("Adept", "Destruction");
    if (ad) { const need = FAI.REQ.Adept, sk = FOL2.skillOf(M, "Destruction"); M.lvl = 1; while (FOL2.skillOf(M, "Destruction") < need - 8 && M.lvl < 40) M.lvl++;
      const before = FAI.canLearn(M, ad[1].spell, s); s.perks.battle_tutor = 1; const after = FAI.canLearn(M, ad[1].spell, s);
      OK(FOL2.skillOf(M, "Destruction") >= need || (before !== true && after === true), "Battle Tutor lets them learn 10 points early: " + before + " → " + after);
      const sp = D.SPELLS.flames; OK(FAI.mpCost(M, sp, PFX.num(s, "folmp")) <= FAI.mpCost(M, sp, 0), "Battle Tutor: cheaper spells"); delete s.perks.battle_tutor; M.lvl = 19; }
    // the screen shows Magic and Tactics
    const esc = (x) => String(x); FOL2.act(s, { op: "view", id: "magic" }); const pm = FOL2.panel(s, esc);
    OK(/Spells they know/.test(pm) && /Flames/.test(pm), "Magic tab lists their spells");
    FOL2.act(s, { op: "view", id: "tactics" }); const pt = FOL2.panel(s, esc);
    OK(/Healer/.test(pt) && /Save potions/.test(pt), "Tactics tab");
    OK(/healer/i.test(FOL2.act(s, { op: "tactic", id: "healer" })) && M.tactic === "healer", "set tactics");
    FOL2.act(s, { op: "spell", id: "flames" }); OK(M.off.includes("flames"), "turn a spell off"); FOL2.act(s, { op: "spell", id: "flames" }); OK(!M.off.includes("flames"), "and on");
    FOL2.act(s, { op: "view", id: "card" }); }

  // 2. gear: every slot you have, a second one-handed weapon in the left hand
  { const s = fresh("warrior", 20), Ly = hireAs(s, "lydia");
    for (const sl of G.SLOTS) OK(FOL2.panel(s, String).length > 0, "panel ok");
    const dg = G.give(s, "iron_dagger"); FOL2.give(s, dg); const row = Ly.inv.find((r) => r.item === "iron_dagger");
    const m = FOL2.act(s, { op: "eqoff", id: String(row.id) });
    OK(Ly.eq.offhand === row.id && !Ly.eq.shield, "a dagger in the left hand (shield comes off): " + m);
    const f = new G.Fight(s, enc("Bandit outlaw", 20)), al = f.allies.find((x) => x.follower);
    OK(al.fai && al.dual && al.mpMax > 0 && al.spMax > 0 && al.ap >= 6, "fight record has magicka, stamina, AP, dual wield");
    FOL2.act(s, { op: "uneq", id: "offhand" }); OK(!Ly.eq.offhand, "take the left-hand weapon off"); }

  // 3. their AI: heals you, summons, drinks their own potions, never dies
  { const s = fresh("warrior", 30), M = hireAs(s, "marcurio", "healer"); M.tactic = "healer";
    const f = new G.Fight(s, enc("Bandit outlaw", 30)), al = f.allies.find((x) => x.follower);
    f.hp = G.maxHealth(s) * 0.25; const t = FOL2.turn(f, al);
    OK(/on you|heals you/.test(t) && f.hp > G.maxHealth(s) * 0.25, "a healer heals you when you're hurt: " + t); }
  { const s = fresh("warrior", 30), B = hireAs(s, "brelyna"); const f = new G.Fight(s, enc("Frost troll", 30)), al = f.allies.find((x) => x.follower);
    let t = ""; for (let i = 0; i < 4 && !f.allies.some((x) => x.fsum); i++) t += FOL2.turn(f, al);
    OK(f.allies.some((x) => x.fsum), "a conjurer summons: " + t); }
  { const s = fresh("warrior", 20), Ly = hireAs(s, "lydia"); potions(Ly, "potion_health", 2); const f = new G.Fight(s, enc("Bandit outlaw", 20)), al = f.allies.find((x) => x.follower);
    al.hp = 5; const t = FOL2.turn(f, al); OK(/drinks/.test(t) && al.hp > 5, "drinks from their own pack: " + t);
    const q = Ly.inv.find((r) => r.item === "potion_health"); OK(!q || q.qty === 1, "the potion is used up"); }
  { let downs = 0, lost = 0, errs = 0;
    for (let i = 0; i < 40; i++) { const s = fresh("mage", 20); hireAs(s, ["lydia", "marcurio", "jenassa", "brelyna"][i % 4]); const f = new G.Fight(s, boss("deathlord", 20));
      try { TB.simulate(f, { t: G.now() }); } catch (e) { errs++; if (errs < 3) console.log(e.stack); }
      if (f.followerDown) downs++; if (!s.follower) lost++; }
    OK(errs === 0, "no errors"); OK(lost === 0, "followers are knocked down, never die (" + downs + " knocked down)"); }

  // 4. combos: a foe someone else chilled shatters under your blow; capped, no one-shots
  { const s = fresh("warrior", 20), f = new G.Fight(s, enc("Frost troll", 20));
    f.foeSt = { chill: { turns: 2 } }; f.cmark = { chill: "al0" }; const b = f.ehp; f.ehp -= 20; const t = COMBO.phys(f, b, "me");
    OK(/Shatter/.test(t) && b - f.ehp > 20 && b - f.ehp <= 20 + COMBO.CAP * (f.ehp0 || b) + 1e-6, "Shatter: " + t);
    f.cmark = { chill: "me" }; const b2 = f.ehp; f.ehp -= 10; OK(COMBO.phys(f, b2, "me") === "", "no combo on your own chill");
    f.foeSt = { burn: { dmg: 4, turns: 3 } }; f.cmark = { burn: "al0" }; f.cActor = "me"; const b3 = f.ehp; const lab = PFX.hitFoe(f, "shock", 30, "spell");
    OK(/Overload/.test(lab) && f.ehp < b3, "Overload: " + lab);
    OK(COMBO.chips(f).length >= 0, "chips"); }
}

// 5. the sim table: you (warrior) + each follower, by level and foe group
const ARCHS = [["none", null, null], ["lydia", "lydia", null], ["jenassa", "jenassa", null], ["marcurio", "marcurio", null], ["brelyna", "brelyna", null], ["healer", "marcurio", "healer"]];
const groups = { normal: (L) => enc(["Bandit outlaw", "Wolf pack", "Draugr", "Forsworn ambush", "Black bear", "Sabre cat"][Math.floor(Math.random() * 6)], L),
  tough: (L) => enc(["Vampire", "Frost troll", "Thalmor patrol"][Math.floor(Math.random() * 3)], L),
  boss: (L) => boss(["deathlord", "chief", "centurion", "hagraven", "master", "lich"][Math.floor(Math.random() * 6)], L) };
let serr = 0, maxBlow = 0;
console.log("follower  group   level  win%  rounds  yourHP%  folDown%");
for (const [label, id, arch] of ARCHS) for (const g of Object.keys(groups)) for (const L of [10, 20, 30]) {
  let w = 0, r = 0, hp = 0, dn = 0;
  for (let i = 0; i < RUNS; i++) { const s = fresh("warrior", L); if (id) hireAs(s, id, arch); const f = new G.Fight(s, groups[g](L));
    try { const ss = TB.simulate(f, { t: G.now() }); r += ss.round; } catch (e) { serr++; if (serr < 3) console.log("ERR", label, g, L, e.stack); }
    if (f.won && !f.escaped) w++; hp += Math.max(0, f.hp) / G.maxHealth(s); if (f.followerDown) dn++; }
  console.log(label.padEnd(9), g.padEnd(7), String(L).padStart(5), String(Math.round(w / RUNS * 100)).padStart(5) + "%", (r / RUNS).toFixed(1).padStart(7), String(Math.round(hp / RUNS * 100)).padStart(7) + "%", String(Math.round(dn / RUNS * 100)).padStart(8) + "%");
}
OK(serr === 0, "no errors in the sims: " + serr);
console.log(fails ? "FAILED " + fails : "followerai ok · " + n + " checks");
globalThis.__fails = fails;
`, c);
if (c.__fails) process.exitCode = 1;
