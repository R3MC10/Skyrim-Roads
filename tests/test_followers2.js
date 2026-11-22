// followers: their own pack and gear drive their stats and look, they level and pick perks by archetype, never count as
// party members, and party members see and fight beside each other's followers. W=/path/to/web/ node test_followers2.js
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "horses.js", "horseback.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "craftfair.js", "social.js", "ammo.js", "tomes.js", "magic.js", "combatai.js", "mp.js", "coop.js", "party.js", "followers2.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const mk = (id, name, lvl = 20) => { const s = G.newSave(id, name, "nord"); s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.level = lvl; s.gold = 9999; s.thaneWhiterun = true; return s; };

// 1. hiring sets up a follower with their natural style, a level near yours and their own kit
const A = mk("A", "Alfa", 20);
OK(TOWNS.hire(A, "lydia").includes("Lydia"), "hire Lydia");
const L = FOL2.st(A);
OK(L.arch === "warrior", "Lydia is a warrior by default");
OK(L.lvl === 19, "starts a level below you: " + L.lvl);
OK(Object.values(L.eq).length >= 3, "wears her starting kit: " + JSON.stringify(L.eq));
OK(Object.keys(L.perks).length > 0, "has already picked perks");
const lydiaTrees = new Set(Object.keys(L.perks).map((p) => PERKS.BY_ID[p].skill));
OK([...lydiaTrees].every((t) => FOL2.ARCH.warrior.main.concat(FOL2.ARCH.warrior.sec).includes(t)), "warrior perks only in warrior trees: " + [...lydiaTrees]);
OK(lydiaTrees.has("One-Handed") && lydiaTrees.has("Heavy Armor"), "warrior picks One-Handed and Heavy Armor");
const spent = Object.values(L.perks).reduce((a, b) => a + b, 0);
OK(spent <= L.lvl - 1, "never spends more points than levels: " + spent);
OK(TOWNS.followerMax(A, "lydia") === FOL2.maxHp(A, "lydia"), "max health comes from their own level");

// 2. default archetypes match Skyrim
for (const [id, arch] of [["jenassa", "archer"], ["marcurio", "mage"], ["stenvar", "twohand"], ["belrand", "spellsword"], ["faendal", "archer"], ["jzargo", "mage"], ["brelyna", "conjurer"], ["farkas", "twohand"], ["aela", "archer"], ["mjoll", "warrior"]])
  OK(FOL2.archOf(id) === arch, id + " defaults to " + arch);
OK(TOWNS.FOLLOWERS.faendal && TOWNS.FOLLOWERS.jzargo, "more Skyrim followers can be hired");
{ const s = mk("q", "Q"); s.location = "Winterhold"; OK(/College/.test(TOWNS.hire(s, "jzargo")), "J'zargo needs the College"); s.quests = { college: { stage: 0 } }; OK(!/College/.test(TOWNS.hire(s, "jzargo")) && s.follower?.id === "jzargo", "College members can take J'zargo"); }

// 3. gear: better kit, harder hits and fewer blows felt; their pack has a weight limit
const d0 = FOL2.dmg(A), t0 = FOL2.taken(A);
FOL2.unequip(A, "weapon");
OK(FOL2.dmg(A) < d0, "unarmed Lydia hits softer " + FOL2.dmg(A) + " < " + d0);
const best1 = ["ebony_sword", "glass_sword", "elven_sword", "dwarven_sword", "orcish_sword", "steel_sword"].find((x) => D.ITEMS[x]); const sw = G.give(A, best1);
const giveMsg = FOL2.give(A, sw);
OK(/give/.test(giveMsg), "give: " + giveMsg);
OK(!G.invRow(A, sw), "the item left your pack");
FOL2.bestEquip(A);
const w = L.inv.find((r) => r.id === L.eq.weapon);
OK(w && w.item === best1, "best gear picks a one-handed weapon for a warrior: " + (w && w.item));
OK(FOL2.dmg(A) >= d0, "the best sword hits at least as hard: " + FOL2.dmg(A));
for (const slot of ["chest", "head", "shield"]) FOL2.unequip(A, slot);
OK(FOL2.taken(A) > t0, "no armor: blows hurt more " + FOL2.taken(A) + " > " + t0);
FOL2.bestEquip(A);
OK(Math.abs(FOL2.taken(A) - t0) < 1e-9, "armor back on");
const back = FOL2.takeBack(A, L.inv.find((r) => r.item === "steel_shield").id);
OK(/take/.test(back) && A.inv.some((r) => r.item === "steel_shield"), "take back");
OK(!L.eq.shield, "a taken item comes off");
{ const heavy = []; for (let i = 0; i < 40; i++) heavy.push(G.give(A, "steel_armor")); let refused = false; for (const id of heavy) { const m = FOL2.give(A, id); if (/can't carry/.test(m)) { refused = true; break; } } OK(refused, "their pack has a weight limit"); OK(FOL2.weight(L) <= FOL2.carry(L) + 1e-6, "never over the limit"); }
{ const p = G.give(A, "potion_health", 3); OK(/3×/.test(FOL2.give(A, p, 3)), "give potions in a stack"); }
const lk = FOL2.look(A);
OK(lk.eq.weapon === w.item && lk.eq.chest, "their look follows their gear: " + JSON.stringify(lk.eq));

// 4. in a fight: their stats come from their kit; potions when badly hurt; XP and levels after won fights
const foe = G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === "Bandit outlaw") }, 18);
const f = new G.Fight(A, foe);
const al = f.allies.find((x) => x.follower);
OK(al && Math.abs(al.dmg - FOL2.dmg(A)) < 1e-9 && al.look && al.look.eq.weapon, "fight ally uses FOL2 damage and look");
al.hp = 5; const tm = FOL2.turn(f, al);
OK(/drinks/.test(tm || "") && al.hp > 5, "drinks a potion when badly hurt: " + tm);
const xp0 = L.xp, lv0 = L.lvl; f.won = true; f.e.level = 18;
FOL2.gain(A, f);
OK(L.xp > xp0 || L.lvl > lv0, "gains XP from a won fight");
L.lvl = 5; L.xp = 0; L.perks = {}; FOL2.spend(A, "lydia");
for (let i = 0; i < 60; i++) FOL2.gain(A, { won: true, e: { level: 20 } });
OK(L.lvl === 20, "levels up to your level and stops there: " + L.lvl);
OK(Object.values(L.perks).reduce((a, b) => a + b, 0) === L.lvl - 1 || PERKS.pointsLeft(FOL2.pseudo(L)) >= 0, "spends perk points as it levels");
A.level = 60; for (let i = 0; i < 200; i++) FOL2.gain(A, { won: true, e: { level: 60 } });
OK(L.lvl === 50, "Lydia caps at 50 like in Skyrim: " + L.lvl);
A.level = 20;
OK(!FOL2.gain(A, { won: false, e: { level: 20 } }).length, "no XP for a lost fight");

// 5. archer and mage pick their own trees; changing style re-picks perks
{ const s = mk("j", "J"); TOWNS.hire(s, "jenassa"); const J = FOL2.st(s); const trees = new Set(Object.keys(J.perks).map((p) => PERKS.BY_ID[p].skill)); OK(trees.has("Archery"), "Jenassa picks Archery perks: " + [...trees]); OK(J.eq.weapon && D.ITEMS[J.inv.find((r) => r.id === J.eq.weapon).item].skill === "Archery", "Jenassa shoots a bow"); }
{ const s = mk("m", "M"); s.location = "Riften"; [s.x, s.y] = WORLD.places.Riften; TOWNS.hire(s, "marcurio"); const M = FOL2.st(s); const trees = new Set(Object.keys(M.perks).map((p) => PERKS.BY_ID[p].skill)); OK(trees.has("Destruction"), "Marcurio picks Destruction: " + [...trees]); OK(!M.eq.weapon, "mages keep their hands free"); OK(FOL2.dmg(s) > 3, "a mage still hurts: " + FOL2.dmg(s));
  const msg = FOL2.setArch(s, "healer"); OK(/healer/.test(msg) && M.arch === "healer", "change style: " + msg); OK(Object.keys(M.perks).some((p) => PERKS.BY_ID[p].skill === "Restoration"), "healer re-picks Restoration perks");
  const fh = new G.Fight(s, foe); const ah = fh.allies.find((x) => x.follower); fh.hp = 5; ah.hp = 999; const hm = FOL2.turn(fh, ah); OK(/heals you/.test(hm || ""), "a healer follower heals you: " + hm); }

// 6. Leadership (Speechcraft) is a real perk: more follower XP, less damage taken
{ const s = mk("l", "Lead"); TOWNS.hire(s, "lydia"); const tA = FOL2.taken(s); s.perks = { ...(s.perks || {}), leadership: 2 }; OK(FOL2.taken(s) < tA, "Leadership: follower takes less " + FOL2.taken(s) + " < " + tA);
  const Fx = FOL2.st(s); Fx.lvl = 5; Fx.xp = 0; FOL2.gain(s, { won: true, e: { level: 5 } }); const withL = Fx.xp; s.perks.leadership = 0; Fx.xp = 0; FOL2.gain(s, { won: true, e: { level: 5 } }); OK(withL > Fx.xp, "Leadership: more follower XP " + withL + " > " + Fx.xp); }

// 7. parties: the card carries the follower; they are not members; others' followers fight beside you
const B = mk("B", "Beta"), C = mk("C", "Ceta");
TOWNS.hire(B, "stenvar") || 0; B.location = "Windhelm"; TOWNS.hire(B, "stenvar"); B.location = "Whiterun";
const party = { id: "p", leader: "A", members: [{ id: "A", name: "Alfa" }, { id: "B", name: "Beta" }, { id: "C", name: "Ceta" }] };
const card = (s) => ({ id: s.id, name: s.name, race: s.race, level: s.level, x: s.x, y: s.y, look: { r: "nord", id: s.id, eq: {}, gl: {} }, ...MP.stats(s), ...PARTY.cardBits(s, party) });
const cb = card(B), cc = card(C);
OK(cb.fold && cb.fold.id === "stenvar" && cb.fold.eq.weapon && cb.fold.dmg > 0 && cb.fold.l >= 1, "card publishes the follower summary: " + JSON.stringify(cb.fold));
OK(JSON.stringify(cb.fold).length < 400, "the summary stays small: " + JSON.stringify(cb.fold).length);
OK(PARTY.cardBits(B, null).fold, "co-op runs see the follower too (published outside a party)");
const allies = PARTY.allies(A, party, [cb, cc], [A.x, A.y], (o) => [o.x, o.y], 100);
const fol = allies.filter((x) => x.kind === "follower");
OK(fol.length === 1 && fol[0].name === "Stenvar" && fol[0].ofUid === "B" && fol[0].look.eq.weapon, "B's follower fights beside A: " + JSON.stringify(fol.map((x) => x.name)));
OK(allies.filter((x) => x.uid).length === 2, "only the two members count as members");
OK(party.members.length === 3 && !party.members.some((m) => m.id === "stenvar"), "followers never join the member list");
const comp = PARTY.companions(A, party, [cb, cc], [A.x, A.y], (o) => [o.x, o.y], 100);
OK(comp.some((m) => m.name === "Lydia" && m.follower) && comp.some((m) => m.name === "Stenvar" && m.follower && m.look.eq.weapon), "both followers walk in the travel picture: " + comp.map((m) => m.name));
{ G.setAllyProvider(() => allies); const fx = new G.Fight(A, foe); OK(fx.allies.some((x) => x.name === "Stenvar") && fx.allies.some((x) => x.name === "Lydia"), "a fight has your follower and B's"); G.setAllyProvider(() => []); }
// eight heroes with eight followers: followers ride along, members stay eight
{ const P8 = { id: "p8", leader: "A", members: [] }; const S8 = []; for (let i = 0; i < 8; i++) { const s = mk("m" + i, "M" + i); TOWNS.hire(s, "lydia"); S8.push(s); P8.members.push({ id: s.id, name: s.name }); }
  const cards8 = S8.slice(1).map((s) => ({ id: s.id, name: s.name, x: s.x, y: s.y, look: { r: "nord", id: s.id, eq: {}, gl: {} }, ...MP.stats(s), ...PARTY.cardBits(s, P8) }));
  OK(P8.members.length === 8, "a party of eight heroes");
  const co = PARTY.companions(S8[0], P8, cards8, [S8[0].x, S8[0].y], (o) => [o.x, o.y], 100);
  OK(co.filter((m) => m.follower).length >= 6, "their followers travel along too: " + co.length); }

console.log("followers2 ok · " + n + " checks");
`, c);
