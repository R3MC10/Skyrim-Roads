// followers learn like you (folbuild.js): skills rise with use, level-ups from skill XP with automatic attribute picks,
// builds follow the gear you give them, perks are spent and respecced by themselves, old saves migrate, party card, AI.
// W=/path/to/game/ node test_folbuild.js
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
// seeded Math.random so every run rolls the same fights
let seed = 12345; const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const M = Object.create(Math); M.random = rnd;
const c = { console, Math: M, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "horses.js", "horseback.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "craftfair.js", "social.js", "ammo.js", "tomes.js", "magic.js", "combatai.js", "mp.js", "coop.js", "party.js", "followers2.js", "followerai.js", "folbuild.js", "combo.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const mk = (id, lvl = 20) => { const s = G.newSave(id, "Tester", "nord"); s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.level = lvl; s.gold = 9999; s.thaneWhiterun = true; return s; };
const perkTrees = (f) => new Set(Object.keys(f.perks).filter((p) => f.perks[p] > 0).map((p) => PERKS.BY_ID[p].skill));
const giveEq = (s, item) => { const id = G.give(s, item); FOL2.give(s, id); const f = FOL2.st(s); const r = f.inv.slice().reverse().find((x) => x.item === item); return FOL2.equip(s, r.id); };

// 1. a new follower has the same skill list as you, a level near yours and level-up picks that fit their build
const A = mk("A", 20); TOWNS.hire(A, "lydia");
const L = FOL2.st(A);
OK(L.skills && D.ALL_SKILLS.every((k) => L.skills[k] && L.skills[k].lvl >= 15), "every skill of yours, at least 15");
OK(L.lvl === 19 && L.arch === "warrior", "level 19 warrior");
OK(L.skills["One-Handed"].lvl > L.skills.Archery.lvl && L.skills["Heavy Armor"].lvl > 30, "her build's skills are higher: " + L.skills["One-Handed"].lvl);
OK(L.ups.health + L.ups.magicka + L.ups.stamina === L.lvl - 1 && L.ups.health > L.ups.stamina && L.ups.magicka === 0, "a warrior picks health, then stamina: " + JSON.stringify(L.ups));
OK(FOL2.skillOf(L, "Blocking") === L.skills.Blocking.lvl, "followers2 reads her real skills");
OK(TOWNS.followerMax(A, "lydia") === Math.round(150 * (1 + 0.015 * 18) + 10 * L.ups.health), "health from her Health picks");

// 2. skills rise with use in a real fight, exactly with your numbers (F.skillXpGained / skillXpNeeded)
const foe = G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === "Bandit outlaw") }, 18);
const fi = new G.Fight(A, foe);
const al = fi.allies.find((x) => x.follower);
OK(al && al.wsk === "One-Handed" && al.wbase > 0 && al.armorKind === "heavy" && al.px, "fight record knows her weapon skill and armour: " + al.wsk + " " + al.armorKind);
for (let i = 0; i < 6 && fi.ehp > 0; i++) FAI.turn(null, fi, al);
OK(fi._fsx && fi._fsx.lydia && fi._fsx.lydia["One-Handed"] > 0, "swinging her sword trains One-Handed: " + JSON.stringify(fi._fsx.lydia));
const xp0 = L.skills["One-Handed"].xp, lv0 = L.skills["One-Handed"].lvl;
fi._fsx.lydia["One-Handed"] = 10; const msgs0 = FOL2.gain(A, fi);
const want = F.skillXpGained("One-Handed", 10) * FBUILD.mult(A, L);
OK(L.skills["One-Handed"].lvl > lv0 || Math.abs(L.skills["One-Handed"].xp - xp0 - want) < 1e-6, "same Skyrim formula as yours × their learning rate");
// blows on a raised shield train Blocking, on heavy armour Heavy Armor
const fi2 = new G.Fight(A, foe), al2 = fi2.allies.find((x) => x.follower); al2.guard = 1;
const got = FAI.takes(fi2, al2, 20);
OK(got < 20 && fi2._fsx.lydia.Blocking > 0 && fi2._fsx.lydia["Heavy Armor"] > 0, "a blow on her shield trains Blocking and Heavy Armor: " + JSON.stringify(fi2._fsx.lydia));
// a spell trains its school
{ const o = { k: "cast", sp: D.SPELLS.flames }; FBUILD.acted(fi2, al2, o, { text: "Lydia casts Flames: 9" }); OK(fi2._fsx.lydia.Destruction === 20, "a spell trains its school"); }
// a big chunk: several increases, with the toast line
{ const before = L.skills.Archery.lvl; fi2._fsx.lydia = { Archery: 3000 }; const m = FBUILD.after(A, fi2);
  OK(L.skills.Archery.lvl > before && m.some((x) => x === "Lydia: Archery increased to " + L.skills.Archery.lvl), "toast: " + m[0]); }

// 3. level-ups come from skill XP; they pick an attribute for their build and spend the perk point; never past you
{ const s = mk("lv", 30); TOWNS.hire(s, "lydia"); const f = FOL2.st(s); const lv = f.lvl, ups = { ...f.ups }, pk = Object.values(f.perks).reduce((a, b) => a + b, 0);
  f.cxp = F.charXpNeeded(f.lvl) - 1; f.skills["One-Handed"].xp = F.skillXpNeeded("One-Handed", f.skills["One-Handed"].lvl) - 0.01;
  const r = FBUILD.rise(s, "lydia", "One-Handed", 1);
  OK(f.lvl === lv + 1 && r.lv.length === 1, "a skill increase brings the level-up: " + f.lvl);
  OK(f.ups.health + f.ups.stamina + f.ups.magicka === lv, "one more attribute pick");
  OK(f.ups.magicka === 0 && (f.ups.health > ups.health || f.ups.stamina > ups.stamina), "a warrior never picks magicka");
  OK(Object.values(f.perks).reduce((a, b) => a + b, 0) >= pk, "perk point spent or waiting");
  s.level = f.lvl; f.cxp = 0;
  for (let i = 0; i < 40; i++) FBUILD.rise(s, "lydia", "Heavy Armor", 400);
  OK(f.lvl === s.level && f.cxp <= F.charXpNeeded(f.lvl), "never past your level, the XP waits: " + f.lvl);
  f.cxp = F.charXpNeeded(f.lvl) + 50; FBUILD.rise(s, "lydia", "Heavy Armor", 1); OK(f.lvl === s.level && f.cxp === F.charXpNeeded(f.lvl), "a full bar waits");
  s.level = f.lvl + 1; FBUILD.rise(s, "lydia", "Heavy Armor", 1);
  OK(f.lvl === s.level, "and comes with the next thing they learn once you level up"); }
// mages pick magicka
{ const s = mk("mg", 25); s.location = "Whiterun"; s.follower = { id: "marcurio", hp: 1, ts: G.now() }; const f = FOL2.st(s, "marcurio"); OK(f.ups.magicka >= f.ups.health && f.ups.stamina === 0, "a mage picks magicka and health: " + JSON.stringify(f.ups)); }

// 4. builds follow gear: free, any time, a respec into the new trees each time
const B = mk("B", 25); TOWNS.hire(B, "lydia"); const Ly = FOL2.st(B);
Ly.skills.Archery.lvl = 40; Ly.skills["Two-Handed"].lvl = 40; Ly.skills.Destruction.lvl = 40; Ly.skills.Sneak.lvl = 35; Ly.skills["Light Armor"].lvl = 35;
let m = giveEq(B, "hunting_bow");
OK(Ly.arch === "archer" && /archer/.test(m), "bow → archer: " + m);
OK([...perkTrees(Ly)].every((t) => FOL2.ARCH.archer.main.concat(FOL2.ARCH.archer.sec).includes(t)) && perkTrees(Ly).has("Archery"), "archer perks only: " + [...perkTrees(Ly)]);
OK(Object.values(Ly.perks).reduce((a, b) => a + b, 0) <= Ly.lvl - 1, "never more perks than points");
m = giveEq(B, "iron_greatsword"); OK(Ly.arch === "twohand" && perkTrees(Ly).has("Two-Handed") && !perkTrees(Ly).has("Archery"), "two-hander → two-handed build, archery perks gone: " + m);
giveEq(B, "steel_sword"); giveEq(B, "steel_shield"); OK(Ly.arch === "warrior" && Ly.eq.shield, "sword and shield → warrior (tank)");
FOL2.unequip(B, "shield"); giveEq(B, "iron_dagger"); OK(Ly.arch === "thief" && perkTrees(Ly).has("Sneak") === (Ly.skills.Sneak.lvl >= 20 || perkTrees(Ly).has("Sneak")), "dagger → thief: " + Ly.arch);
m = giveEq(B, "staff_flames"); OK(Ly.arch === "mage" && /mage/.test(m), "a Destruction staff → mage: " + m);
OK(Ly.spells.includes("flames"), "a new mage remembers Flames");
giveEq(B, "staff_zombies"); OK(Ly.arch === "conjurer", "a Conjuration staff → conjurer");
FOL2.unequip(B, "weapon"); OK(Ly.arch === "conjurer", "bare hands with spells: stays a caster");
const builds = Ly.builds; FOL2.unequip(B, "weapon"); OK(Ly.builds === builds, "no gear change, no respec");
// the style chips still work: they put on the best gear for it
OK(/archer/.test(FOL2.setArch(B, "archer")) && Ly.inv.find((r) => r.id === Ly.eq.weapon).item === "hunting_bow", "tap Archer: she takes up her bow");
// taking back the bow she holds changes the build again
{ const bow = Ly.inv.find((r) => r.id === Ly.eq.weapon); const msg = FOL2.takeBack(B, bow.id); OK(Ly.arch !== "archer" || !Ly.eq.weapon, "take her bow back: " + msg); }

// 5. perks have real effects in the fight (perkfx.js through a stand-in), capped
{ const s = mk("px", 40); TOWNS.hire(s, "lydia"); const f = FOL2.st(s); for (const k of ["One-Handed", "Heavy Armor", "Blocking"]) f.skills[k].lvl = 90; f.lvl = 39; f.perks = {}; FOL2.spend(s, "lydia");
  const x = FBUILD.mods(s, f);
  OK(x.out >= 1 && x.out <= 1.35 && x.inn <= 1 && x.inn >= 0.75 && x.block >= 0 && x.block <= 0.1, "perk effects within caps: " + JSON.stringify(x));
  OK(x.out > 1 || x.inn < 1 || x.block > 0, "a level-39 warrior's perks do something: " + JSON.stringify(x)); }

// 6. AI by build: tanks draw blows, archers and mages stay back
{ const s = mk("ai", 20); TOWNS.hire(s, "lydia"); const fx = new G.Fight(s, foe), a = fx.allies.find((x) => x.follower);
  OK(a.shield && a.build === "warrior", "Lydia is a shield tank");
  const solo = fx.allies.length; const w1 = FAI.aggro(fx);
  OK(w1 > solo * 1.0 + 0.2, "a tank draws more blows than a plain fighter: " + w1);
  const s2 = mk("ai2", 20); s2.follower = { id: "jenassa", hp: 1, ts: G.now() }; FOL2.st(s2, "jenassa"); s2.follower.hp = FOL2.maxHp(s2, "jenassa");
  const f2 = new G.Fight(s2, foe), a2 = f2.allies.find((x) => x.follower); OK(a2.row === "back" && FAI.aggro(f2) < 1, "an archer stands in the back row"); }

// 7. old saves: a follower without skills gets them from level and build; health stays about the same
{ const s = mk("old", 30); TOWNS.hire(s, "lydia"); const f = s.folData.lydia; delete f.skills; delete f.ups; delete f.cxp; f.lvl = 29; f.xp = 120;
  const old = Math.round(150 * (1 + 0.05 * 28));
  const g = FOL2.st(s, "lydia");
  OK(g.skills && g.skills["One-Handed"].lvl === Math.round(20 + 2.6 * 28) && g.cxp === 0, "skills from level and build");
  const mx = FOL2.maxHp(s, "lydia"); OK(Math.abs(mx - old) / old < 0.15, "health close to before: " + mx + " vs " + old);
  OK(JSON.parse(JSON.stringify(s)).folData.lydia.skills.Archery.lvl >= 15, "saved with the game"); }

// 8. party card (netsync): top skills and perk count ride along; followers never count as members
{ const cd = FOL2.card(A); OK(Array.isArray(cd.sk) && cd.sk.length === 3 && cd.pk >= 0 && cd.l === L.lvl, "card: " + JSON.stringify(cd.sk));
  const allies = FOL2.cardAllies({ id: "A", fold: cd }); OK(allies.length === 1 && allies[0].kind === "follower" && !allies[0].player, "a party member's follower fights beside you, not as a member"); }

// 9. the Skills view: level, every skill with a bar, build, perks
{ const esc = (x) => String(x); const html = FBUILD.view(A, L, esc, "lydia");
  OK(/Level 19|Level 2\\d/.test(html) && (html.match(/class="fb-sk[ "]/g) || []).length === D.ALL_SKILLS.length && /fb-badge/.test(html) && /Perks/.test(html), "Skills view shows level, all skills, build, perks");
  FOL2.act(A, { op: "view", id: "perks" }); OK(/fb-skills/.test(FOL2.panel(A, esc)), "Follower → Skills tab draws it"); FOL2.reset(); }
console.log("folbuild ok · " + n + " checks");
`, c);
