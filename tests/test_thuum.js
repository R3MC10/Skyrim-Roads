const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Shouts API + weather that matters, round 3 (thuum.js, wxmatters.js): cooldowns with perks for every shout, breath shouts and
// Storm Call follow the weather, Fire Breath warms you on the road, coast storms keep ships in harbour (Clear Skies clears
// them), clear nights speed magicka in fights, Weathered Traveller / Starlit Mind perks, and a no-one-shot balance sim.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, setTimeout, clearTimeout };
vm.createContext(c);
const load = (f) => { if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); };
for (const f of ["data.js", "world.js", "terrain.js", "solworld.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js"]) load(f);
// a switch for the weather everywhere (under Clear Skies, which shouts2.js lays on top)
vm.runInContext(`var FORCED = null; const __w0 = WEVENTS.weather;
WEVENTS.weather = (pos, t) => FORCED ? { id: FORCED, name: WEVENTS.W[FORCED][0], icon: WEVENTS.W[FORCED][1], speed: WEVENTS.W[FORCED][2], sneak: WEVENTS.W[FORCED][3], encounters: WEVENTS.W[FORCED][4] } : __w0(pos, t);`, c);
for (const f of ["weatherfx.js", "enchanting.js", "quests.js", "horses.js", "horseback.js", "cooking.js", "smithing.js", "ammo.js", "tomes.js", "magic.js", "combatai.js", "roam.js", "solstheim.js", "shouts2.js", "vision.js", "thuum.js", "wxmatters.js"]) load(f);
vm.runInContext(`
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const P = POWERS;
const learnAll = (s, ids) => { for (const id of ids) for (const w of P.SHOUTS[id][1]) { P.learnWord(s, w); s.unlocked = [...new Set([...(s.unlocked || []), w])]; } };
const mk = (where = "Whiterun", lvl = 30) => { const s = G.newSave("t" + Math.random(), "Thu", "nord"); s.location = null; [s.x, s.y] = WORLD.places[where]; s.level = lvl; s.perks = {}; return s; };
const foe = (name) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, 30);

// ---- the API
{ const s = mk(); learnAll(s, ["slow_time", "fire_breath", "clear_skies"]);
  const L = SHOUTS.list(s); OK(L.length >= 21 && L.every((x) => x.words.length === 3), "list: every shout with 3 words " + L.length);
  const st = L.find((x) => x.id === "slow_time"); OK(st.level === 3 && st.cd === 60 && st.fight && !st.outside, "Slow Time: 3 words, 60 s, a fight shout");
  OK(SHOUTS.outside("whirlwind_sprint") && SHOUTS.outside("clear_skies") && SHOUTS.outside("fire_breath") && !SHOUTS.outside("dragonrend"), "outside() knows road shouts and Fire Breath");
  OK(SHOUTS.fightable("fire_breath") && !SHOUTS.fightable("clear_skies"), "fightable()");
  const un = L.find((x) => x.id === "storm_call"); OK(un.level === 0 && un.hint.length > 5, "unlearned shout carries a hint: " + un.hint);
}
// ---- cooldowns: Commanding Voice + Thu'um Mastery, for every shout, capped at half
{ const s = mk(); learnAll(s, ["slow_time", "unrelenting_force"]);
  OK(PERKS.BY_ID.thuum_mastery && PERKS.BY_ID.weathered_traveller && PERKS.BY_ID.starlit_mind, "new perks are in the trees");
  OK(PERKS.BY_ID.commanding_voice, "old perk id kept");
  OK(SHOUTS.mastery(s) === 0 && SHOUTS.cd(s, "slow_time") === 60, "no perks: full cooldown");
  s.perks.commanding_voice = 1; OK(Math.abs(SHOUTS.mastery(s) - 0.15) < 1e-9 && SHOUTS.cd(s, "slow_time") === 51, "Commanding Voice −15%: " + SHOUTS.cd(s, "slow_time"));
  s.perks.thuum_mastery = 2; OK(Math.abs(SHOUTS.mastery(s) - 0.35) < 1e-9 && SHOUTS.cd(s, "slow_time") === 39, "Thu'um Mastery 2: −35%: " + SHOUTS.cd(s, "slow_time"));
  s.perks.commanding_voice = 3; OK(SHOUTS.mastery(s) === 0.5 && SHOUTS.cd(s, "slow_time") === 30, "the cut stops at half"); s.perks.commanding_voice = 1;
  s.perks.thuum_mastery = 2;
  // in a fight: a shouts2 shout (used to skip the perk) and an old one both follow SHOUTS.cd
  for (const id of ["slow_time", "unrelenting_force"]) {
    s.voiceAt = 0; const f = new G.Fight(s, foe("Bandit outlaw")); const r = P.act(f, "shout", id);
    OK(/!/.test(r) && Math.abs(s.voiceAt - (f.t + SHOUTS.cd(s, id))) < 1e-6, id + " cooldown in a fight follows SHOUTS.cd: " + (s.voiceAt - f.t));
  }
  OK(SHOUTS.left(s, s.voiceAt - 10) === 10 && SHOUTS.left(s, s.voiceAt + 1) === 0, "left()");
}
// ---- road shouts: Clear Skies gets the perk too; Fire Breath warms you up
{ const s = mk(); learnAll(s, ["clear_skies", "fire_breath"]); s.perks = { commanding_voice: 1, thuum_mastery: 2 }; s.voiceAt = 0;
  const t = G.now(); const m = SHOUTS.use(s, "clear_skies", t);
  OK(/^LOK VAH KOOR/.test(m) && Math.abs(s.voiceAt - (t + SHOUTS.cd(s, "clear_skies"))) < 1e-6, "Clear Skies on the road, cooldown with perks: " + m);
  OK(/Your voice needs/.test(SHOUTS.use(s, "fire_breath", t + 1)), "voice still recovering");
  s.voiceAt = 0; s.coldV = 80; s.coldT = t + 2; s.location = null; s.trip = { status: "travel" };
  const m2 = SHOUTS.use(s, "fire_breath", t + 2); OK(/^YOL TOOR SHUL!/.test(m2) && s.coldV <= 15, "Fire Breath on the road warms you: " + s.coldV);
  OK(/for fights/.test(SHOUTS.use(s, "slow_time", t)), "a fight-only shout says so");
  OK(/Outside a fight/.test(P.SHOUTS.fire_breath[3]), "Fire Breath's text mentions the road use");
}
SHOUTS2.bindSave(null);   // forget the Clear Skies shouted above
// ---- breath shouts and Storm Call follow the sky
const breath = (wx, id) => { FORCED = wx; const s = mk(); learnAll(s, [id]); s.voiceAt = 0; const f = new G.Fight(s, foe("Giant")); f.ehp = f.ehp0 = 5000; const e0 = f.ehp; const r = P.act(f, "shout", id); return { dealt: e0 - f.ehp, r, f }; };
{ const c = breath("clear", "fire_breath"), r = breath("rain", "fire_breath");
  OK(r.dealt < c.dealt && /rain dulls it/.test(r.r), "rain dulls Fire Breath " + c.dealt + " → " + r.dealt + " " + r.r + JSON.stringify(r.f.wx));
  const fc = breath("clear", "frost_breath"), fb = breath("blizzard", "frost_breath");
  OK(fb.dealt > fc.dealt && /feeds it/.test(fb.r), "a blizzard feeds Frost Breath " + fc.dealt + " → " + fb.dealt);
  const sc = breath("clear", "storm_call"), ss = breath("storm", "storm_call");
  OK(ss.f.pw.stormDmg > sc.f.pw.stormDmg && sc.f.pw.stormDmg === 25, "a thunderstorm feeds Storm Call " + sc.f.pw.stormDmg + " → " + ss.f.pw.stormDmg);
}
// ---- the weather card
const eff = (wx, s) => { FORCED = wx; return WXM.effects(s || mk()); };
{ const r = eff("rain"); OK(r.bad && r.lines.some((l) => /^Travel \\d+% slower$/.test(l)) && r.lines.includes("Fire 15% weaker") && r.lines.includes("Shock 15% stronger") && r.lines.some((l) => /hidden/.test(l)), "rain card: " + r.lines.join(" | "));
  const f = eff("fog"); OK(f.lines.some((l) => /less far on the map/.test(l)) && f.lines.includes("Arrows miss more often"), "fog card: " + f.lines.join(" | "));
  const b = eff("blizzard"); OK(b.lines.includes("Cold without warm clothes") && b.lines.includes("Ships stay in harbour") && b.lines.includes("Travel 30% slower"), "blizzard card: " + b.lines.join(" | "));
  const st = eff("storm"); OK(st.lines.includes("Shock spells may call down lightning") && st.lines.includes("Ships stay in harbour"), "storm card");
  const sk = mk(); learnAll(sk, ["clear_skies"]); OK(eff("snow", sk).lines.some((l) => /Clear Skies/.test(l)), "knowing Clear Skies: the card says so");
  const sw = mk(); sw.perks = { weathered_traveller: 2 }; OK(eff("blizzard", sw).lines.includes("Travel 15% slower"), "Weathered Traveller shows on the card");
  const sd = mk(); sd.dungeon = { place: "Bleak Falls Barrow" }; OK(/Indoors/.test(eff("blizzard", sd).lines[0]), "indoors card");
  OK(/^Blizzard: Travel 30% slower\\./.test((FORCED = "blizzard", WXM.tip(mk()))), "tip line: " + WXM.tip(mk()));
  // clear night lines
  FORCED = "clear"; let tn = G.now(); for (let k = 0; k < 48 && !G.isNight(tn); k++) tn += 600;
  const cn = WXM.effects(mk(), tn); OK(cn.night && cn.lines.some((l) => /^Clear night: magicka comes back 50% faster/.test(l)), "clear night card: " + cn.lines.join(" | "));
  const cd = mk(); cd.perks = { starlit_mind: 1 }; OK(WXM.effects(cd, tn).lines.some((l) => /100% faster/.test(l)), "Starlit Mind on the card");
  let td = G.now(); for (let k = 0; k < 48 && G.isNight(td); k++) td += 600;
  OK(WXM.effects(mk(), td).lines[0] === "Fine weather: nothing in your way", "clear day: nothing in your way");
}
// ---- clear nights: magicka comes back faster each turn
{ FORCED = "clear"; let tn = G.now(); for (let k = 0; k < 48 && !G.isNight(tn); k++) tn += 600;
  const run = (perks, night) => { const s = mk(); s.perks = perks; const f = new G.Fight(s, foe("Bandit outlaw"), null, night ? tn : null); if (!night) f.wx = { ...f.wx, clearNight: false, mpNight: 0 }; f.mp = 0; const line = { me: "", them: "" }; P.tick(f, line); return { mp: f.mp, f }; };
  const a = run({}, false), b = run({}, true), d = run({ starlit_mind: 1 }, true);
  OK(b.f.wx.clearNight && b.f.wx.lines.some((l) => /Clear night/.test(l)), "a fight on a clear night knows it");
  OK(a.mp === 0 && b.mp > 0 && Math.abs(d.mp - 2 * b.mp) < 1e-6, "clear night magicka per turn: " + a.mp + " / " + b.mp.toFixed(2) + " / Starlit Mind " + d.mp.toFixed(2));
}
// ---- Weathered Traveller: travel and the cold
{ FORCED = "blizzard"; const a = mk("Winterhold"), b = mk("Winterhold"); a.survival = b.survival = false; b.perks = { weathered_traveller: 2 };
  const ratio = G.speed(b) / G.speed(a); OK(Math.abs(ratio - 0.85 / 0.7) < 0.02, "Weathered Traveller 2: blizzard slowdown halved, speed ×" + ratio.toFixed(3));
  const ca = mk("Winterhold"), cb = mk("Winterhold"); cb.perks = { weathered_traveller: 2 };
  OK(Math.abs(WFX.exposure(cb) - WFX.exposure(ca) * 0.5) < 1e-9 && WFX.exposure(ca) > 0, "the cold creeps in half as fast");
  FORCED = "clear"; const d0 = mk(), d1 = mk(); d1.perks = { weathered_traveller: 2 }; OK(G.speed(d0) === G.speed(d1), "fair weather: the perk changes nothing");
}
// ---- storms on the coast keep the ship in harbour; Clear Skies clears it
{ FORCED = "storm"; const s = mk("Windhelm"); s.location = "Windhelm"; s.gold = 1000; s.trip = null;
  OK(WXM.coastStorm("Windhelm") && !WXM.coastStorm("Whiterun"), "a storm at Windhelm's docks");
  const why = SOL.sail(s); OK(/lashes the coast/.test(why || "") && s.gold === 1000 && !s.trip, "no sailing in a storm: " + why);
  OK(/lashes the coast/.test(SOL.canSail(s) || ""), "canSail says why");
  const html = SOL.docksHTML(s, (x) => x); OK(/data-act="sail" disabled/.test(html.body) && /lashes the coast/.test(html.note), "the docks screen shows the storm and greys out Sail");
  learnAll(s, ["clear_skies"]); s.voiceAt = 0; const m = P.roadShout(s, "clear_skies"); OK(/^LOK/.test(m), "Clear Skies at the docks");
  OK(!WXM.coastStorm("Windhelm") && SOL.sail(s) === null && s.trip && s.trip.boat, "the sky clears and the ship sails");
  FORCED = "rain"; const s2 = mk("Windhelm"); s2.location = "Windhelm"; s2.gold = 1000; s2.trip = null; SHOUTS2.bindSave(null);
  OK(SOL.sail(s2) === null, "rain doesn't stop ships");
}
// ---- balance: a full-strength shouter in the best weather never one-shots a strong foe, and fights still take a while
let worst = 0;
{ const strong = ["Giant", "Dragon", "Frost troll"], ALL = ["unrelenting_force", "fire_breath", "frost_breath", "marked_for_death", "storm_call", "elemental_fury", "dragon_aspect"];
  for (const wx of ["clear", "storm", "blizzard", "ashstorm"]) for (const name of strong) for (const first of ["fire_breath", "frost_breath", "unrelenting_force"]) {
    FORCED = wx; const s = mk("Whiterun", 30); learnAll(s, ALL); s.perks = { commanding_voice: 1, thuum_mastery: 2 }; s.voiceAt = 0;
    const f = new G.Fight(s, foe(name)); const e0 = f.ehp; P.act(f, "shout", first);
    OK(f.ehp > 0 && (e0 - f.ehp) < e0 * 0.6, "no one-shot: " + first + " in " + wx + " vs " + name + " " + Math.round(e0 - f.ehp) + "/" + Math.round(e0));
    worst = Math.max(worst, (e0 - f.ehp) / e0);
  }
  let turns = 0, k = 0;
  for (let i = 0; i < 60; i++) { FORCED = ["storm", "blizzard", "clear"][i % 3]; const s = mk("Whiterun", 30); learnAll(s, ALL); s.perks = { commanding_voice: 1, thuum_mastery: 2 }; s.hpBonus = 3000; G.setHealth(s, G.maxHealth(s)); s.voiceAt = 0;
    G.loadout(s).mode = "custom"; G.loadout(s).rules = [{ if: "first_turn", do: "shout:" + ["fire_breath", "frost_breath", "storm_call"][i % 3] }, ...G.loadout(s).rules];
    const f = new G.Fight(s, foe(strong[i % 3])); f.run({}); if (f.ehp <= 0) { turns += f.log.length; k++; } }
  OK(k >= 30 && turns / k >= 3, "strong foes still take " + (k ? (turns / k).toFixed(1) : "-") + " turns on average when shouts open (" + k + " wins)");
  console.log("balance: biggest opening shout took " + Math.round(worst * 100) + "% of a strong foe; " + k + "/60 sim wins, " + (k ? (turns / k).toFixed(1) : "-") + " turns on average");
}
FORCED = null;
console.log("thuum ok · " + n + " checks");
`, c);
