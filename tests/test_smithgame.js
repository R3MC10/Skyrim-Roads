const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Forging mini-game (smithgame.js): heat colours, scoring, the three steps in order, balance with a bot,
   the material-saving roll stays small, and the Forge Sense perk really changes the game. Prints "smithgame ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "mp.js", "craftgames.js", "smithgame.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };
const SG = SMITHGAME;
const seeded = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const fresh = () => { const s = G.newSave("A", "Smith", "nord"); s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.inv = []; s.gold = 0; return s; };

// 1. heat colours: grey when cold, white at the top, getting brighter
{ const a = SG.heatRGB(0), b = SG.heatRGB(1), m = SG.heatRGB(0.6);
  ok(a[0] < 100 && b.every((v) => v > 230), "cold grey, white hot " + a + " " + b);
  let last = -1, mono = true; for (let t = 0; t <= 1.0001; t += 0.05) { const s = SG.heatRGB(t).reduce((x, y) => x + y, 0); if (t > 0.3 && s < last - 1) mono = false; last = s; }
  ok(mono, "glow gets brighter as it heats"); ok(m[0] > m[1] && m[1] > m[2], "forging heat is orange " + m); }

// 2. scoring
{ const T = SG.tune(15);
  ok(T.lo < 0.69 && T.hi > 0.69 && T.qlo < SG.QUENCH_AT && T.qhi > SG.QUENCH_AT, "bands around their centres");
  ok(SG.strikeScore(1, 1, 0.69, T).q === 1, "dead-on strike in the band = 1");
  ok(SG.strikeScore(1.05, 1, 0.69, T).q === 1, "within 10% still clean");
  ok(SG.strikeScore(2.5, 1, 0.69, T).q < 0.4, "early strike scores low");
  ok(SG.strikeScore(1, 1, 0.35, T).q < 0.6 && SG.strikeScore(1, 1, 0.35, T).q >= 0.3, "cold strike barely moves the metal");
  ok(SG.strikeScore(1, 1, 0.99, T).q < 1, "white-hot smears");
  ok(SG.quenchScore(SG.QUENCH_AT, T) === 1 && SG.quenchScore(0.75, T) < 0.2 && SG.quenchScore(0.2, T) < 0.2, "quench at cherry red");
  ok(Math.abs(SG.total([1], [1, 1, 1, 1, 1, 1], 1) - 1) < 1e-9, "all perfect = 1");
  ok(Math.abs(SG.total([1], [1, 1, 1], 1) - (0.25 + 0.55 * 0.5 + 0.2)) < 1e-9, "missing strikes count 0");
  ok(SG.total([], [], 0) === 0, "nothing done = 0");
  const wide = SG.tune(100), narrow = SG.tune(0);
  ok(wide.hi - wide.lo > narrow.hi - narrow.lo && wide.ring > narrow.ring, "skill widens the band and slows the rings"); }

// 3. the material-saving chance stays small
{ ok(SG.saveChance(0.69) === 0 && SG.saveChance(0.5) === 0, "no saving below great work");
  ok(SG.saveChance(1) > 0.1 && SG.saveChance(1) <= 0.2, "perfect: about 12% " + SG.saveChance(1));
  ok(SG.saveChance(1, 1, 0.5) === 0.2, "capped at 20%");
  ok(SG.saveChance(1, 0.25) < SG.saveChance(1), "fades with the day's bonus crafts"); }

// 4. one game, step by step: heat → hammer → (carry) → quench → steam → reveal, the blade changes shape
{ const S = SG.create({ skill: 30 }, seeded(7)), seen = [], stages = new Set();
  for (let i = 0; i < 60 * 80 && !S.over; i++) {
    if (seen[seen.length - 1] !== S.phase) seen.push(S.phase);
    stages.add(S.stage);
    if (S.phase === "heat") SG.press(S, S.temp < 0.66);
    if (S.phase === "hammer") { if (S.spot && S.spot.t >= S.spot.T) SG.press(S, true); else if (SG.canReheat(S) && !S.spot && S.temp < S.T.lo - 0.1) SG.reheat(S); }
    if (S.phase === "quench" && Math.abs(S.temp - SG.QUENCH_AT) < 0.01) SG.press(S, true);
    if (S.phase === "reveal" && S.pt > 1) SG.press(S, true);
    SG.step(S, 1 / 60);
  }
  const order = seen.filter((p, i) => seen.indexOf(p) === i);
  ok(JSON.stringify(order) === JSON.stringify(["heat", "hammer", "carry", "quench", "steam", "reveal"]), "steps in order " + seen.join(">"));
  ok([1, 2, 3, 4].every((k) => stages.has(k)), "all four blade stages shown");
  ok(S.over && S.strikes.length === 6 && S.q > 0.8, "a good game ends well " + S.q.toFixed(2)); }

// 5. a player who does nothing still finishes (strikes time out, the blade drops in the water by itself)
{ const S = SG.create({ skill: 15 }, seeded(3)); let i = 0;
  for (; i < 60 * 120 && !S.over; i++) { if (S.phase === "reveal" && S.pt > 1) SG.press(S, true); SG.step(S, 1 / 60); }
  ok(S.over, "idle game ends on its own (" + (i / 60).toFixed(0) + " s)"); ok(CG.grade(S.q) === "botched", "doing nothing botches it " + S.q.toFixed(2)); }

// 6. reheating: back to the fire, then back to the anvil with the strikes kept
{ const S = SG.create({ skill: 15 }, seeded(5)); S.phase = "hammer"; S.temp = 0.4; S.strikes = [1, 1];
  ok(SG.canReheat(S), "can reheat when cool"); SG.reheat(S); ok(S.phase === "heat" && S.reheat, "back in the fire");
  for (let i = 0; i < 60 * 6 && S.phase === "heat"; i++) { SG.press(S, S.temp < 0.66); SG.step(S, 1 / 60); }
  ok(S.phase === "hammer" && S.strikes.length === 2 && S.heatQ.length === 1, "strikes kept after reheating"); }

// 7. balance with the bot: good play beats sloppy play beats doing nothing; never a sure Perfect at low skill
{ const run = (sk, p) => { const q = []; for (let i = 0; i < 30; i++) q.push(SG.simulate({ skill: sk }, p, seeded(100 + i)).q); return q.reduce((a, b) => a + b, 0) / q.length; };
  const good = run(15, 1), ok7 = run(15, 0.7), bad = run(15, 0.3), none = run(15, 0);
  console.log("forging quality at Smithing 15: perfect bot", good.toFixed(2), "decent", ok7.toFixed(2), "sloppy", bad.toFixed(2), "idle", none.toFixed(2));
  ok(good > ok7 && ok7 > bad && bad > none, "better play, better blade");
  ok(["masterful", "perfect"].includes(CG.grade(good)), "a careful smith gets masterful work");
  ok(["great", "masterful"].includes(CG.grade(ok7)), "decent play is great work");
  ok(CG.grade(none) === "botched", "idle botches");
  ok(run(100, 0.7) > run(0, 0.7), "skill helps"); }

// 8. Forge Sense: a real effect (wider bands, slower cooling, more saving)
{ const s = fresh(); s.perks = s.perks || {};
  const T0 = SG.create({ skill: 30, s }).T; s.perks.forge_sense = 2; const T2 = SG.create({ skill: 30, s }).T;
  ok(PFX.num(s, "forgeheat") === 0.5 && PFX.num(s, "forgecool") === 0.4 && Math.abs(PFX.num(s, "forgesave") - 0.06) < 1e-9, "perk ranks add up");
  ok(T2.hi - T2.lo > (T0.hi - T0.lo) * 1.4 && T2.cool < T0.cool && T2.ring > T0.ring && T2.qhalf > T0.qhalf, "Forge Sense widens and slows");
  ok(PERKS.BY_ID.forge_sense && PERKS.BY_ID.forge_sense.skill === "Smithing", "Forge Sense is a Smithing perk");
  for (const id of ["steel_smithing", "arcane_blacksmith", "elven_smithing", "dwarven_smithing", "advanced_armors", "prospector", "whetstone"]) ok(PERKS.BY_ID[id], "old perk id kept: " + id); }

// 9. crafting: great forging may save one material; the forge still uses up the rest
{ const need = SMITH.RECIPES.iron_sword.mats;
  const mk = () => { const s = fresh(); G.give(s, "mat_iron", 10); G.give(s, "mat_strips", 6); return s; };
  let s = mk(); SG._pend({ id: "iron_sword", grade: "perfect", q: 1 }); let m = CG.smithMake(s, "iron_sword", "perfect", () => 0);
  ok(/save 1 Iron Ingot/.test(m), "lucky roll saves one ingot: " + m);
  ok(SMITH.count(s, "mat_iron") === 10 - need[0][1] + 1 && SMITH.count(s, "mat_strips") === 6 - need[1][1], "only one piece comes back, strips used up");
  ok(s.inv.find((r) => r.item === "iron_sword").temper === 2, "still the usual perfect temper");
  s = mk(); SG._pend({ id: "iron_sword", grade: "perfect", q: 1 }); m = CG.smithMake(s, "iron_sword", "perfect", () => 0.99);
  ok(!/save/.test(m) && SMITH.count(s, "mat_iron") === 10 - need[0][1], "unlucky roll: all used");
  s = mk(); SG._pend({ id: "iron_dagger", grade: "perfect", q: 1 }); m = CG.smithMake(s, "iron_sword", "perfect", () => 0);
  ok(!/save/.test(m), "a result for another item doesn't count");
  s = mk(); SG._pend({ id: "iron_sword", grade: "good", q: 0.5 }); m = CG.smithMake(s, "iron_sword", "good", () => 0);
  ok(!/save/.test(m), "good work never saves");
  s = mk(); m = CG.smithMake(s, "iron_sword", CG.QUICK, () => 0);
  ok(!/save/.test(m) && SMITH.count(s, "mat_iron") === 10 - need[0][1], "quick craft = plain crafting");
  s = mk(); SG._pend({ id: "iron_sword", grade: "botched", q: 0.05 }); m = CG.smithMake(s, "iron_sword", "botched", () => 0);
  ok(/^Botched/.test(m) && !/scrap/.test(m), "botched is the old botch");
  // over many crafts the saving stays rare
  let saved = 0; s = fresh(); G.give(s, "mat_iron", 2000); G.give(s, "mat_strips", 2000); const r = seeded(9);
  for (let i = 0; i < 400; i++) { SG._pend({ id: "iron_dagger", grade: "perfect", q: 1 }); if (/save 1/.test(CG.smithMake(s, "iron_dagger", "perfect", r))) saved++; }
  ok(saved < 400 * 0.12, "saving stays rare over a long session: " + saved + "/400"); }

console.log(fails ? fails + " of " + n + " checks failed" : "smithgame ok · " + n + " checks");
if (fails) throw new Error("smithgame failed");
`, c);
