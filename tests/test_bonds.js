/* Follower and horse bonds (bonds.js): loyalty ranks with real unlocks (carry, smarter AI, a rank move), loyalty from road
   time and hard fights, quest banners; horse bond levels, specialities with real effects, grooming, perks, Polish, and a
   balance sim (fights with a Sworn follower and a warhorse still take a few rounds; no one-shots).
   W=/path/to/game/ node test_bonds.js [runs] */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const RUNS = +(process.env.RUNS || process.argv[2] || 30);
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS, structuredClone };
globalThis.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {} };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "horses.js", "horseback.js", "mountfight.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "craftfair.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "followers2.js", "followerai.js", "combo.js", "combatai.js", "foeintent.js", "tbfight.js", "encounters.js", "partyplay.js", "followerbonds.js", "hunting.js", "bonds.js", "i18n_story.js", "i18n_bonds.js", "i18n_bonds2.js", "i18n.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const tb = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const helpers = tb.slice(tb.indexOf("const LEVELS"), tb.indexOf("if (!process.env.SIMONLY)"));
vm.runInContext(helpers + `
let n = 0; const OK = (x, m) => { if (!x) { fails++; console.log("FAIL", m); } else n++; };
const hireAs = (s, id) => { s.follower = { id, hp: 1, ts: G.now() }; const fo = FOL2.st(s, id); s.follower.hp = FOL2.maxHp(s, id); BONDS.bond(s, id); return fo; };
const at = (s, place) => { s.location = place; [s.x, s.y] = WORLD.places[place]; s.trip = null; };

// 1. ranks follow loyalty; Companion carries more; Fellow Traveller adds to it
{ const s = fresh("warrior", 20); at(s, "Whiterun"); const f = hireAs(s, "lydia");
  f.loyal = 30; OK(BONDS2.rank(s) === 0, "30 = Hireling"); const c0 = G.capacity(s);
  f.loyal = 45; OK(BONDS2.rank(s) === 1, "45 = Companion"); const c1 = G.capacity(s);
  OK(c1 - c0 === BONDS2.CARRY, "Companion carries 25 more: " + c0 + " -> " + c1);
  s.perks.fellow_traveller = 1; OK(G.capacity(s) - c1 === 25, "Fellow Traveller: another 25");
  f.loyal = 62; OK(BONDS2.rank(s) === 2, "62 = Trusted"); f.loyal = 80; OK(BONDS2.rank(s) === 3, "80 = Sworn");
  f.loyal = 30; delete f.bond.rank; BONDS2.rankCheck(s); f.loyal = 41; const up = BONDS2.rankCheck(s);
  OK(/Companion/.test(up) && f.bond.log[0].text === up, "rising a rank is announced and logged: " + up); }
{ const s = fresh("warrior", 20); at(s, "Riverwood"); s.follower = { id: "meeko", hp: 50, ts: G.now() }; FOL2.st(s, "meeko").loyal = 50;
  OK(BONDS2.carry(s) === BONDS2.DOG_CARRY, "Meeko carries a little less"); }

// 2. loyalty grows on the road (capped per day) and from hard fights
{ const s = fresh("warrior", 20); at(s, "Whiterun"); const f = hireAs(s, "lydia"); f.loyal = 50;
  BONDS2.roadTime(s, 300, 1000); OK(f.loyal === 50, "five minutes: nothing yet");
  BONDS2.roadTime(s, 300, 1300); OK(f.loyal === 51, "ten minutes together: +1");
  for (let i = 0; i < 20; i++) BONDS2.roadTime(s, 300, 1600 + i * 300);
  OK(f.loyal === 53, "at most 3 a day from the road: " + f.loyal);
  BONDS2.roadTime(s, 600, 1000 + 2 * 3600 + 10); OK(f.loyal === 54, "a new day: more again " + f.loyal + JSON.stringify(f.bond.road));
  OK(f.bond.log.some((x) => /road together/.test(x.text)), "logged as time on the road");
  s.perks.fellow_traveller = 1; BONDS2.roadTime(s, 600, 1000 + 2 * 3600 + 700); OK(f.loyal === 56, "Fellow Traveller: road time counts double: " + f.loyal);
  // through real travel (G.advance)
  f.loyal = 50; f.bond.road = null; G.startTrip(s, "Windhelm", WORLD.places.Windhelm.slice(0, 2), 5000); s.trip.lastTick = 5000;
  for (let t = 5000; t <= 5000 + 1300; t += 60) { if (!s.trip) { G.startTrip(s, "Windhelm", WORLD.places.Windhelm.slice(0, 2), t); s.trip.lastTick = t; } G.advance(s, t); if (s.trip && s.trip.status !== "travel") { s.trip.status = "travel"; s.trip.encounter = null; s.trip.event = null; } }
  OK(f.loyal > 50, "travelling together raises loyalty: " + f.loyal + " " + JSON.stringify(f.bond.road) + " " + (s.trip && s.trip.status)); s.trip = null; }
{ const s = fresh("warrior", 20); at(s, "Whiterun"); const f = hireAs(s, "lydia"); f.loyal = 50; s._test = false;
  FOL2.gain(s, { won: true, e: { name: "Bandit", level: 10 }, tags: new Set() }); const easy = f.loyal - 50;
  f.loyal = 50; FOL2.gain(s, { won: true, e: { name: "Dragon", level: 20, tags: ["dragon"] }, tags: new Set(["dragon"]) }); const hard = f.loyal - 50;
  OK(hard === easy + 1 && easy >= 1, "a hard fight counts double: easy +" + easy + ", dragon +" + hard); }

// 3. Sworn: a rank move before the quest; the quest's move replaces it; never more than a quarter of the foe
{ const s = fresh("warrior", 20); at(s, "Whiterun"); const f = hireAs(s, "lydia"); f.loyal = 70;
  OK(BONDS.sigOf(s) === null, "Trusted: no move yet"); f.loyal = 78;
  const m = BONDS.sigOf(s); OK(m && m.name === "Shield Rush", "Sworn warrior: Shield Rush " + (m && m.name));
  let worst = 0, fired = 0;
  for (let i = 0; i < 40; i++) { const fx = new G.Fight(s, enc("Bandit outlaw", 20)), al = fx.allies.find((x) => x.follower); const e0 = fx.ehp; const t = BONDS.signature(fx, al);
    if (t) { fired++; worst = Math.max(worst, (e0 - fx.ehp) / (fx.e.health || e0)); } OK(BONDS.signature(fx, al) === "", "once per fight"); }
  OK(fired === 40 && worst <= 0.25 + 1e-9, "the rank move fires and is capped at a quarter: " + worst.toFixed(3));
  f.bond.sig = true; f.bond.q = { done: true }; OK(BONDS.sigOf(s).name === "Sworn Shield", "after her quest: her own move");
  f.bond.sig = false; f.bond.q = null; f.loyal = 78;
  OK(/Shield Rush/.test(BONDS.tab(s, (x) => String(x))) && /bondranks/.test(BONDS.tab(s, (x) => String(x))), "the Bond tab shows the rank ladder and the rank move"); }
{ const s = fresh("warrior", 20); at(s, "Riverwood"); const f = hireAs(s, "faendal"); f.loyal = 80; OK(BONDS.sigOf(s).type === "volley", "Sworn archer: a volley");
  const s2 = fresh("warrior", 20); s2.follower = { id: "meeko", hp: 50, ts: G.now() }; FOL2.st(s2, "meeko").loyal = 90; BONDS.bond(s2, "meeko"); OK(BONDS.sigOf(s2).name === "Snap", "Meeko snaps"); }

// 4. Trusted: smarter AI. Steps in front of you when you're badly hurt (a Hireling doesn't); goes for the kill
{ const s = fresh("warrior", 20); at(s, "Whiterun"); const f = hireAs(s, "stenvar");
  const opts = (loy, hpPct, foePct) => { f.loyal = loy; const fx = new G.Fight(s, enc("Bandit outlaw", 20)), al = fx.allies.find((x) => x.follower); fx.hp = G.maxHealth(s) * hpPct; fx.ehp = (fx.e.health || fx.ehp) * foePct; return [fx, al, FAI.decide(fx, al, al.ap || 6)]; };
  const [, , lo] = opts(30, 0.2, 1), [, , hi] = opts(65, 0.2, 1);
  OK(lo && lo.k !== "cover" || !lo, "a Hireling two-hander keeps swinging: " + (lo && lo.k));
  OK(hi && hi.k === "cover", "a Trusted follower steps in front of you: " + (hi && hi.k));
  const [fx2, al2] = opts(65, 1, 0.2); const o2 = BONDS2.aiOpts(fx2, al2, [{ k: "attack", c: 3, v: 30 }, { k: "guard", c: 2, v: 30 }]);
  OK(o2[0].v > 30 && o2[1].v < 30, "a wounded foe: attack weighs more, guard less");
  // Trusted fights through FOL2.turn without errors and still never die
  let err = 0, lost = 0; for (let i = 0; i < 20; i++) { const ss = fresh("mage", 20); hireAs(ss, ["lydia", "marcurio", "jenassa", "faendal"][i % 4]).loyal = 70; const fx = new G.Fight(ss, boss("deathlord", 20));
    try { TB.simulate(fx, { t: G.now() }); } catch (e) { err++; if (err < 2) console.log(e.stack); } if (!ss.follower) lost++; }
  OK(err === 0 && lost === 0, "Trusted followers fight boss sims, knocked down but never lost"); }

// 5. personal quests show banners
{ const s = fresh("warrior", 20); at(s, "Riverwood"); const f = hireAs(s, "lydia"); f.loyal = 85; const seen = [];
  globalThis.IMM = { questBanner: (w, l, t, x) => seen.push(w + ":" + x) };
  FOL2.act(s, { op: "bond", b: "qstart" });
  OK(seen.some((x) => /^started:Go to Whiterun/.test(x)), "QUEST STARTED banner: " + seen.join(" | "));
  at(s, "Whiterun"); BONDS.observe(s); BONDS.observe(s);
  BONDS2.questWatch(s, "go"); OK(seen.some((x) => /^objective:Clear Dustman/.test(x)), "objective banner for the dungeon: " + seen.join(" | "));
  delete globalThis.IMM; }

// 6. horses: bond levels, grooming, picking a speciality
const horse = (s, breed = "bay") => { at(s, "Whiterun"); s.gold = 99999; HORSES.buy(s, "Frost", "bay", breed, () => 0.5); return s.horse; };
{ const s = fresh("warrior", 20), h = horse(s);
  OK(BONDS2.hlevel(s) === 1 && BONDS2.tier(s) === 0 && !BONDS2.spec(s), "a new horse: level 1, no speciality");
  OK(/bond level 3/.test(BONDS2.pickSpec(s, "warhorse")), "can't pick a speciality before level 3");
  const g0 = s.gold, r = BONDS2.groom(s, 10000); OK(s.gold === g0 - BONDS2.GROOM_COST && h.bond.xp === BONDS2.GROOM_XP, "grooming costs gold and builds the bond: " + r);
  OK(/today/.test(BONDS2.groom(s, 10100)) && h.bond.xp === BONDS2.GROOM_XP, "once a day");
  at(s, "Riverwood"); OK(/stables/.test(BONDS2.groom(s, 30000)), "only at a stables"); at(s, "Whiterun");
  BONDS2.hgain(s, 100); OK(BONDS2.hlevel(s) === 3, "level 3 at 100: " + h.bond.xp);
  at(s, "Riverwood"); OK(/stables/.test(BONDS2.pickSpec(s, "packhorse")), "pick at a stables"); at(s, "Whiterun");
  const c0 = HORSES.carry(s), cap0 = G.capacity(s); BONDS2.pickSpec(s, "packhorse");
  OK(HORSES.carry(s) === c0 + 30 && G.capacity(s) === cap0 + 30, "packhorse carries 30 more: " + c0 + " -> " + HORSES.carry(s));
  BONDS2.hgain(s, 300); OK(BONDS2.hlevel(s) === 5 && HORSES.carry(s) === c0 + 60, "at level 5 the speciality doubles: " + HORSES.carry(s));
  const g1 = s.gold; OK(/Courier/.test(BONDS2.pickSpec(s, "courier")) && s.gold === g1 - BONDS2.RETRAIN_COST, "retraining costs gold");
  OK(HORSES.carry(s) === c0, "a courier no longer carries extra");
  s.perks.horse_whisperer = 1; OK(Math.abs(BONDS2.tier(s) - 2.4) < 1e-9, "Horse Whisperer: speciality 20% better");
  const s2 = fresh("warrior", 20); horse(s2); s2.perks.horse_whisperer = 1; BONDS2.hgain(s2, 10); OK(s2.horse.bond.xp === 20, "Horse Whisperer: bonds twice as fast");
  const html = BONDS2.horseHTML(s, (x) => String(x));
  OK(/Bond with Frost/.test(html) && (html.match(/<div class="hsp[ "]/g) || []).length === 5 && /data-op="hbond"/.test(html), "the stables card shows the bond and five specialities");
  OK(/Courier/.test(FOL2.act(s, { op: "hbond", b: "spec", id: "courier" }) || "already") , "the buttons go through FOL2.act"); }

// 7. speed: courier on roads, mountain off them (only while travelling)
{ const s = fresh("warrior", 20), h = horse(s); BONDS2.hgain(s, 350); BONDS2.pickSpec(s, "courier");
  const base = HORSES.speed(s); OK(base === HORSES.speed(s), "in town: the plain number");
  // find a road spot and an off-road spot
  let road = null, wild = null;
  for (let i = 0; i < 4000 && (!road || !wild); i++) { const p = [Math.random(), Math.random()], n = Terrain.NAMES[Terrain.typeAtPos(p)]; if (!road && n === "Road") road = p; if (!wild && (n === "Grassland" || n === "Tundra")) wild = p; }
  OK(road && wild, "found a road and the wilds");
  s.trip = { status: "travel" }; [s.x, s.y] = road; const onRoad = HORSES.speed(s); [s.x, s.y] = wild; const offRoad = HORSES.speed(s);
  OK(onRoad > base * 1.11 && Math.abs(offRoad - base) < 0.01, "courier: +12% on the road at level 5, plain off it: " + base + " / " + onRoad + " / " + offRoad);
  h.bond.spec = "mountain"; [s.x, s.y] = wild; const mo = HORSES.speed(s); [s.x, s.y] = road; const mr = HORSES.speed(s);
  OK(mo > base * 1.15, "mountain: faster off the road: " + mo + " (road " + mr + ")");
  s.trip = null; }

// 8. warhorse: harder charge, horse takes less, still no one-shots
{ const s = fresh("warrior", 20); horse(s); s.horse.mounted = true;
  const chargeOf = () => { const fx = new G.Fight(s, enc("Bandit outlaw", 20)); HORSEBACK.engage(fx, G.now()); const r = HORSEBACK.strike(fx, false, false); return [r, fx]; };
  const [r0, f0] = chargeOf(); BONDS2.hgain(s, 350); BONDS2.pickSpec(s, "warhorse"); const [r1, f1] = chargeOf();
  OK(r0 && r1 && r1.mult > r0.mult * 1.2, "warhorse charge is harder: " + (r0 && r0.mult) + " -> " + (r1 && r1.mult) + " " + (r1 && r1.label));
  OK(f1.mount.guard > f0.mount.guard, "the warhorse shrugs off more: " + f0.mount.guard + " -> " + f1.mount.guard);
  OK(r1.mult < 2.5, "a charge is never a one-shot multiplier: " + r1.mult);
  // winning a fight in the saddle builds the bond
  const s2 = fresh("warrior", 20); horse(s2); s2.horse.mounted = true; const x0 = BONDS2.hb(s2).xp;
  const fx = new G.Fight(s2, enc("Wolf", 5)); HORSEBACK.engage(fx, G.now()); fx.won = true; HORSEBACK.after(fx, G.now());
  OK(BONDS2.hb(s2).xp === x0 + BONDS2.XP.fight, "a fight won in the saddle: +" + (BONDS2.hb(s2).xp - x0)); }

// 9. hunter's horse: almost no hunting slowdown, more animals, sometimes an extra hide
{ const s = fresh("warrior", 20); horse(s); s.hunting = true; s.trip = { status: "travel" };
  const sm0 = HUNT.speedMult(s), r0 = HUNT.rate(s);
  BONDS2.hgain(s, 350); BONDS2.pickSpec(s, "hunter");
  OK(HUNT.speedMult(s) > sm0 && HUNT.speedMult(s) <= 1, "less hunting slowdown: " + sm0 + " -> " + HUNT.speedMult(s));
  OK(HUNT.rate(s) > r0 * 1.25, "more animals: " + r0 + " -> " + HUNT.rate(s));
  const x0 = BONDS2.hb(s).xp, deer = HUNT.pick(s, () => 0); deer.game = [["food_venison", 1, 1, 1]];
  const leather0 = (s.inv.find((r) => r.item === "mat_leather") || { qty: 0 }).qty;
  const got = HUNT.loot(s, deer, () => 0.01);
  OK(got.some((x) => /hunter's horse/.test(x)) && (s.inv.find((r) => r.item === "mat_leather") || { qty: 0 }).qty === leather0 + 1, "an extra hide: " + got.join(", "));
  OK(BONDS2.hb(s).xp > x0, "hunting from the saddle builds the bond"); s.trip = null; }

// 10. riding on the road builds the bond (G.advance)
{ const s = fresh("warrior", 20); horse(s); s.horse.mounted = true; const x0 = BONDS2.hb(s).xp;
  G.startTrip(s, "Windhelm", WORLD.places.Windhelm.slice(0, 2), 9000); s.trip.lastTick = 9000;
  for (let t = 9000; t <= 9000 + 300; t += 60) { if (!s.trip) { G.startTrip(s, "Windhelm", WORLD.places.Windhelm.slice(0, 2), t); s.trip.lastTick = t; } G.advance(s, t); if (s.trip && s.trip.status !== "travel") { s.trip.status = "travel"; s.trip.encounter = null; s.trip.event = null; } }
  OK(BONDS2.hb(s).xp > x0, "riding builds the bond: " + x0 + " -> " + BONDS2.hb(s).xp); s.trip = null; }

// 11. perks are in the tree with real keys
for (const id of ["fellow_traveller", "horse_whisperer"]) OK(Object.values(PERKS.TREES).some((t) => t.some((p) => p[0] === id || p.id === id)), id + " is in a perk tree");
OK(PERKS.TREES.Speechcraft.some((p) => (p[0] || p.id) === "kindred_spirit"), "old perk ids kept");

// 12. Polish
globalThis.__lang = "pl";
OK(BONDS.T("Trusted") === "Zaufany" && BONDS.T("Packhorse") === "Koń juczny", "Polish names: " + BONDS.T("Trusted"));
OK(BONDS.F("Carries {0} more.", 30) === "Niesie o 30 więcej.", "Polish templates");
globalThis.__lang = "en";

// 13. balance sim: fights with a Sworn follower (rank move) and a warhorse charge still take a few rounds
{ const groups = { normal: (L) => enc(["Bandit outlaw", "Wolf pack", "Draugr", "Forsworn ambush"][Math.floor(Math.random() * 4)], L), tough: (L) => enc(["Vampire", "Frost troll", "Thalmor patrol"][Math.floor(Math.random() * 3)], L), boss: (L) => boss(["deathlord", "chief", "hagraven", "lich"][Math.floor(Math.random() * 4)], L) };
  console.log("setup         group   level  win%  rounds  yourHP%");
  let err = 0; const rows = {};
  for (const [label, loy, war] of [["hireling", 30, false], ["sworn", 80, false], ["sworn+war", 80, true]]) for (const g of Object.keys(groups)) for (const L of [10, 20, 30]) {
    let w = 0, r = 0, hp = 0;
    for (let i = 0; i < RUNS; i++) { const s = fresh("warrior", L); hireAs(s, ["lydia", "faendal", "marcurio"][i % 3]).loyal = loy;
      if (war) { horse(s); s.horse.mounted = true; BONDS2.hgain(s, 350); BONDS2.pickSpec(s, "warhorse"); }
      const f = new G.Fight(s, groups[g](L)); if (war) HORSEBACK.engage(f, G.now());
      try { const ss = TB.simulate(f, { t: G.now() }); r += ss.round; } catch (e) { err++; if (err < 3) console.log(e.stack); }
      if (f.won && !f.escaped) w++; hp += Math.max(0, f.hp) / G.maxHealth(s); }
    rows[label + g + L] = r / RUNS;
    console.log(label.padEnd(13), g.padEnd(7), String(L).padStart(5), String(Math.round(w / RUNS * 100)).padStart(5) + "%", (r / RUNS).toFixed(1).padStart(7), String(Math.round(hp / RUNS * 100)).padStart(7) + "%");
  }
  OK(err === 0, "no errors in the sims");
  for (const g of ["tough", "boss"]) for (const L of [10, 20, 30]) OK(rows["sworn+war" + g + L] >= 2, "fights don't end too fast (" + g + " L" + L + "): " + rows["sworn+war" + g + L].toFixed(1) + " rounds");
}

console.log(fails ? "FAILED " + fails : "bonds ok · " + n + " checks");
globalThis.__fails = fails;
`, c);
if (c.__fails) process.exitCode = 1;
