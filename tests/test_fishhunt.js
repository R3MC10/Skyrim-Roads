// Fishing and hunting mini-games: fish tables, the reel, rods, perks, animals, stalking, shooting, skinning, tanning. node test_fishhunt.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).concat(["smithing.js", "cooking.js", "gather.js", "hunting.js", "fishing.js", "huntgame.js", "coop.js", "party.js", "partyplay.js", "lootvote.js"]).filter((f, i, a) => a.indexOf(f) === i);
for (const f of FILES) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, D, FISHGAME: F, HUNTGAME: H, SMITH, COOK, PFX, HUNT } = c, TOWNS = vm.runInContext("TOWNS", c);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hero = (perks = {}) => { const s = c.make("warrior", 12); s.trip = null; s.location = "Riverwood"; s.perks = perks; return s; };
const ids = (list) => list.map(([id]) => id);
const share = (list, id) => { const t = list.reduce((a, [, w]) => a + w, 0), f = list.find(([i]) => i === id); return f ? f[1] / t : 0; };

// ---------------------------------------------------------------- fishing: what bites where
{ const s = hero(); G.give(s, "fishing_rod");
  const ctx = (water, hold, night = false, wx = "clear") => ({ water, hold, night, wx, cast: 0.5 });
  const river = F.table(s, ctx("river", "Whiterun")), lake = F.table(s, ctx("lake", "Whiterun")), sea = F.table(s, ctx("sea", "Haafingar"));
  ok(ids(river).includes("fish_salmon") && ids(river).includes("fish_brookbass") && !ids(river).includes("fish_longfin"), "rivers: salmon and brook bass, no longfin");
  ok(ids(lake).includes("fish_carp") && ids(lake).includes("fish_histcarp") && !ids(lake).includes("fish_salmon"), "lakes: carp and histcarp");
  ok(ids(sea).includes("fish_longfin") && ids(sea).includes("fish_pearlfish") && !ids(sea).includes("fish_carp"), "the sea: longfin and pearlfish");
  ok(!ids(river).includes("fish_char") && ids(F.table(s, ctx("river", "Winterhold"))).includes("fish_char"), "arctic char only in the cold north");
  ok(!ids(F.table(s, ctx("sea", "Haafingar"))).includes("fish_glassfish") && ids(F.table(s, ctx("sea", "Solstheim"))).includes("fish_glassfish"), "glassfish only in cold seas");
  ok(!ids(lake).includes("fish_glasscat") && ids(F.table(s, ctx("lake", "Whiterun", true))).includes("fish_glasscat"), "glass catfish only bite at night");
  ok(share(F.table(s, ctx("river", "Whiterun", true)), "fish_brookbass") < share(river, "fish_brookbass") / 3, "day fish bite much less at night");
  ok(!ids(river).includes("fish_goldfish") && ids(F.table(s, ctx("river", "Whiterun", false, "rain"))).includes("fish_goldfish"), "the goldfish only bites in the rain");
  ok(share(F.table(s, ctx("lake", "Whiterun", false, "rain")), "fish_pogfish") > share(lake, "fish_pogfish") * 2, "pogfish love rain");
  ok(share(F.table(s, ctx("river", "Hjaalmarch", true)), "fish_vampire") > share(F.table(s, ctx("river", "Whiterun", true)), "fish_vampire") * 1.5, "vampire fish like the Hjaalmarch marsh");
  // rods and Deep Waters make rare fish commoner
  const rareShare = (s2) => { const t = F.table(s2, ctx("lake", "Whiterun", true)); return t.filter(([id]) => F.isRare(id)).reduce((a, [, w]) => a + w, 0) / t.reduce((a, [, w]) => a + w, 0); };
  const s2 = hero(); G.give(s2, "rod_master"); const s3 = hero({ deep_waters: 1 }); G.give(s3, "fishing_rod");
  ok(F.rodOf(s2).id === "rod_master" && rareShare(s2) > rareShare(s) * 1.3, `a master rod brings more rare fish: ${rareShare(s).toFixed(2)} -> ${rareShare(s2).toFixed(2)}`);
  ok(rareShare(s3) > rareShare(s) * 1.3, "Deep Waters brings more rare fish");
  let got = new Set(); for (let k = 0; k < 400; k++) got.add(F.roll(s, ctx("river", "Whiterun"), rnd));
  ok(got.size >= 5 && [...got].every((id) => D.ITEMS[id] && D.ITEMS[id].slot === "food"), "rolls give real fish items: " + [...got].join(", "));
  ok(F.canFish(s, [0.5, 0.5]).err || F.canFish(s, [0.5, 0.5]).water, "canFish answers");
  ok(!F.rodOf(hero()), "no rod in a fresh pack");
  const w = F.waitFor({ wx: "clear", cast: 0.5 }, rnd); ok(w.at > 1.5 && w.at < 7 && w.nib.every((t) => t < w.at), "the bite comes after a few seconds, nibbles first");
  ok(Math.abs(F.biteWindow(hero({ line_sense: 1 })) - F.BITE * 1.5) < 1e-9 && F.biteWindow(s) === F.BITE, "Line Sense gives longer to hook");
}
// ---------------------------------------------------------------- fishing: the reel
{ const s = hero(); G.give(s, "fishing_rod");
  const fight = (s1, str, policy) => { let r = { landed: 0, snap: 0, slip: 0 }; for (let k = 0; k < 150; k++) { const g = F.hook(s1, str >= 5 ? "fish_goldfish" : str >= 3 ? "fish_spadetail" : "fish_betty", rnd); let q = [], held = false;
    while (!g.over) { q.push(policy(g)); held = q.length > 12 ? q.shift() : held; F.step(g, held, 1 / 30); } r[g.over]++; } return r; };
  const smart = (g) => g.tension < (g.band[0] + g.band[1]) / 2 + (rnd() - 0.5) * 0.1;
  const easy = fight(s, 1, smart), hard = fight(s, 5, smart);
  ok(easy.landed > 140, "a weak fish is landed by careful reeling: " + JSON.stringify(easy));
  ok(hard.landed > 60 && hard.landed < 146, "a strong fish takes skill: " + JSON.stringify(hard));
  const always = fight(s, 3, () => true), never = fight(s, 3, () => false);
  ok(always.snap === 150, "reeling non-stop snaps the line");
  ok(never.slip === 150, "never reeling lets the fish slip away");
  const sm = hero({ angler: 2 }); G.give(sm, "rod_master");
  const gA = F.hook(sm, "fish_goldfish"), g0 = F.hook(s, "fish_goldfish");
  ok(gA.band[1] - gA.band[0] > (g0.band[1] - g0.band[0]) * 1.5 && gA.line > g0.line && gA.tire > g0.tire, "Angler and a master rod: wider band, stronger line, fish tire faster");
  ok(fight(sm, 5, smart).landed > hard.landed, "and that lands more strong fish");
  ok(F.hook(hero({ line_sense: 1 }), "fish_carp").slackMax > F.hook(s, "fish_carp").slackMax, "Line Sense: slack line loses the fish later");
}
// ---------------------------------------------------------------- fishing: landing and cleaning
{ const s = hero(); let roe = 0, pearls = 0;
  for (let k = 0; k < 400; k++) { if (F.gut(s, "fish_salmon", rnd).includes("ing_salmon_roe")) roe++; if (F.gut(s, "fish_pearlfish", rnd).some((i) => /pearl/.test(i))) pearls++; }
  ok(roe > 100 && roe < 190, "salmon gives roe about a third of the time: " + roe);
  ok(pearls > 180, "pearlfish give pearls: " + pearls);
  const d = hero({ deep_waters: 1 }); let roe2 = 0; for (let k = 0; k < 400; k++) if (F.gut(d, "fish_salmon", rnd).includes("ing_salmon_roe")) roe2++;
  ok(roe2 > roe * 1.2, "Deep Waters: more roe");
  const r = F.land(s, "fish_carp", rnd); ok(s.inv.some((x) => x.item === "fish_carp") && r.first && s.stats.fish === 1 && /Carp/.test(r.text), "landing puts the fish in the pack");
  ok(COOK.FISH.includes("fish_carp") && COOK.countOf(s, "fish") >= 1, "new fish count as 'any fish' for cooking");
  ok(TOWNS.INGREDIENT_FX.ing_slaughterfish_egg && D.ITEMS.ing_slaughterfish_egg.slot === "ingredient", "slaughterfish eggs are an alchemy ingredient");
  for (const e of TOWNS.INGREDIENT_FX.ing_slaughterfish_egg[1].concat(TOWNS.INGREDIENT_FX.ing_small_antlers[1], TOWNS.INGREDIENT_FX.ing_large_antlers[1])) ok(TOWNS.EFFECTS[e], "known alchemy effect: " + e);
  ok(D.SHOP_STOCK.general.includes("rod_fine") && D.SHOP_STOCK.general.includes("skin_knife"), "general stores sell a fine rod and a skinning knife");
}
// ---------------------------------------------------------------- hunting: animals and grounds
{ const s = hero(); const seen = {};
  for (let k = 0; k < 500; k++) { const id = H.pickAnimal(s, c.WORLD.places.Falkreath, rnd); seen[id] = (seen[id] || 0) + 1; }
  ok(seen.deer > seen.fox && seen.elk && seen.hare && !seen.snowfox && !seen.boar, "Falkreath: deer, elk, hares and foxes: " + JSON.stringify(seen));
  const pale = {}; for (let k = 0; k < 300; k++) { const id = H.pickAnimal(s, c.WORLD.places.Winterhold, rnd); pale[id] = 1; }
  ok(pale.snowfox && !pale.deer, "Winterhold: snow foxes, no deer");
  ok(H.fromEncounter({ prey: true, name: "Elk" }) === "elk" && H.fromEncounter({ name: "Wolf" }) === null, "road prey maps to a hunt");
  ok(H.sections("Riverwood")[0] === "hunt" && !H.sections("Solitude").length, "villages near the wild have hunting grounds");
  ok(/bow/.test(H.block(s)), "no bow, no hunt");
  G.give(s, "hunting_bow"); ok(/arrows/.test(H.block(s)), "no arrows, no hunt");
  G.give(s, "arrow_iron", 20); ok(H.block(s) === "", "bow and arrows: ready");
  const t = G.now(); for (let k = 0; k < H.PER_DAY; k++) H.useGround(s, "Riverwood", t);
  ok(H.groundLeft(s, "Riverwood", t) === 0 && H.groundLeft(s, "Riverwood", t + 24 * 3600 / G.GAME_SPEED) === H.PER_DAY, "a few animals per ground a day, back tomorrow");
  const xb = hero(); G.give(xb, "crossbow"); G.give(xb, "bolt_steel", 5); ok(H.weapon(xb).kind === "bolt" && H.block(xb) === "", "a crossbow shoots bolts");
}
// ---------------------------------------------------------------- hunting: stalking
{ const mk = (perks = {}, sneak = 15) => { const s = hero(perks); G.give(s, "hunting_bow"); G.give(s, "arrow_iron", 5); s.skills.Sneak.lvl = sneak; return s; };
  const stalk = (s, policy, id = "deer") => { let close = 0, bolted = 0; for (let k = 0; k < 200; k++) { const g = H.plan(s, id, {}, rnd); g.wind = { dir: -1, str: 1 };
      while (!g.over && g.dist > 30 && g.t < 120) H.stalkStep(g, policy(g), 1 / 20); g.over ? bolted++ : close++; } return { close, bolted }; };
  const careful = (g) => g.head === "down" && g.alert < 0.6, reckless = () => true;
  const a = stalk(mk(), careful), b = stalk(mk(), reckless);
  ok(a.close > 150, "creeping while it grazes gets you close: " + JSON.stringify(a));
  ok(b.bolted > 150, "walking straight in scares it off: " + JSON.stringify(b));
  const s1 = mk(), g1 = H.plan(s1, "deer", {}, rnd), g2 = H.plan(mk({ stalker: 2 }), "deer", {}, rnd), g3 = H.plan(mk({}, 80), "deer", {}, rnd);
  for (const g of [g1, g2, g3]) { g.head = "up"; g.dist = 50; g.wind = { dir: 1, str: 2 }; }
  ok(H.alertRate(g2, true) < H.alertRate(g1, true) * 0.75 && H.alertRate(g3, true) < H.alertRate(g1, true), "Stalker and Sneak slow its alarm");
  const gUp = { ...g1, wind: { dir: -1, str: 2 } }; ok(H.alertRate(g1, true) > H.alertRate(gUp, true), "the wind at your back carries your scent");
  ok(H.alertRate(g1, false) < H.alertRate(g1, true) / 5, "standing still barely worries it");
}
// ---------------------------------------------------------------- hunting: shooting
{ const mk = (perks = {}, archery = 20) => { const s = hero(perks); G.give(s, "hunting_bow"); G.give(s, "arrow_iron", 5); s.skills.Archery.lvl = archery; return s; };
  const shots = (s, comp, id = "deer") => { const r = { vital: 0, body: 0, miss: 0 }; for (let k = 0; k < 300; k++) { const g = H.plan(s, id, {}, rnd); g.dist = 40; const b = H.box(g);
      const sw = H.swayAt(g, rnd() * 20, 1.5); r[H.shoot(g, b.vx - (comp ? H.drift(g) : 0), b.vy, sw).hit]++; } return r; };
  const plain = shots(mk(), true), noComp = shots(mk(), false), pro = shots(mk({ clean_kill: 2, wind_reader: 1 }, 80), true);
  ok(plain.vital > 60 && plain.vital < 280, "aiming at the heart often kills cleanly: " + JSON.stringify(plain));
  ok(noComp.vital < plain.vital, "ignoring the wind costs clean kills: " + JSON.stringify(noComp));
  ok(pro.vital > plain.vital, "Clean Kill, Wind Reader and Archery help: " + JSON.stringify(pro));
  const g = H.plan(mk(), "deer", {}, rnd), g2 = H.plan(mk({ wind_reader: 1 }), "deer", {}, rnd); g.wind = g2.wind = { dir: 1, str: 3 }; g.dist = g2.dist = 50;
  ok(Math.abs(H.drift(g2)) < Math.abs(H.drift(g)) * 0.6, "Wind Reader halves the drift");
  const gx = H.plan((() => { const s = hero(); G.give(s, "crossbow"); G.give(s, "bolt_steel", 3); return s; })(), "deer", {}, rnd); gx.wind = g.wind; gx.dist = g.dist;
  ok(Math.abs(H.drift(gx)) < Math.abs(H.drift(g)), "bolts drift less than arrows");
  const gv = H.plan(mk(), "deer", {}, rnd), gk = H.plan(mk({ clean_kill: 2 }), "deer", {}, rnd); gv.dist = gk.dist = 40;
  ok(Math.abs(H.box(gk).vr / H.box(gv).vr - 1.5) < 1e-9, "Clean Kill: the heart spot is half again as big");
  let tracked = 0, tracked2 = 0; for (let k = 0; k < 400; k++) { if (H.outcome(gv, "body", rnd) === "rough") tracked++; if (H.outcome(gk, "body", rnd) === "rough") tracked2++; }
  ok(tracked > 150 && tracked2 > tracked, `a wounded animal can be tracked (${tracked}), better with Clean Kill (${tracked2})`);
  ok(H.outcome(gv, "vital", rnd) === "clean" && H.outcome(gv, "miss", rnd) === "fled", "a heart shot kills, a miss scares it off");
}
// ---------------------------------------------------------------- skinning
{ const tot = (s, id, q, runs = 400) => { const r = {}; for (let k = 0; k < runs; k++) for (const [i, n] of Object.entries(H.skin(s, id, q, rnd))) r[i] = (r[i] || 0) + n; return r; };
  const bare = tot(hero(), "deer", "clean"), knife = (() => { const s = hero(); G.give(s, "skin_knife"); return tot(s, "deer", "clean"); })(), steel = (() => { const s = hero(); G.give(s, "skin_knife_steel"); return tot(s, "deer", "clean"); })();
  ok(bare.pelt_deer > 200 && bare.pelt_deer < 320 && knife.pelt_deer === 400 && steel.pelt_deer > 520, `knives keep more hides: ${bare.pelt_deer} / ${knife.pelt_deer} / ${steel.pelt_deer}`);
  ok(steel.food_venison > knife.food_venison && (steel.ing_small_antlers || 0) > (bare.ing_small_antlers || 0), "a steel knife: more meat and antlers");
  const rough = tot(hero(), "deer", "rough"); ok(rough.pelt_deer < bare.pelt_deer && (rough.ing_small_antlers || 0) < bare.ing_small_antlers && rough.food_venison < bare.food_venison, "a rough kill wastes more");
  const sk = (() => { const s = hero({ skinner: 1, hunters_eye: 2 }); G.give(s, "skin_knife"); return tot(s, "deer", "clean"); })();
  ok(sk.pelt_deer === 800 && sk.ing_small_antlers > knife.ing_small_antlers * 1.4 && sk.food_venison > knife.food_venison, "Skinner: an extra hide, more trophies; Hunter's Eye: more meat");
  ok(!tot(hero(), "horker", "clean").pelt_deer && tot(hero(), "horker", "clean").food_horker > 600, "horkers give meat and tusks, no hide");
  ok(!tot(hero(), "fox", "clean").food_venison && tot(hero(), "fox", "clean").pelt_fox, "foxes give pelts, no meat");
  for (const a of Object.values(H.ANIMALS)) for (const p of [a.meat, a.pelt, a.trophy]) if (p) ok(D.ITEMS[p[0]], "real item: " + p[0]);
  // settle: ammo used, xp, loot into the pack
  const s = hero(); G.give(s, "hunting_bow"); G.give(s, "arrow_iron", 10); const g = H.plan(s, "elk", {}, rnd); g.moved = 30;
  const xp0 = s.skills.Archery.xp + s.skills.Archery.lvl * 1000; const r = H.settle(s, g, "vital", "clean", () => 0.9);
  ok(r.kill && s.inv.some((x) => x.item === "food_venison") && s.inv.find((x) => x.item === "arrow_iron").qty === 9 && s.stats.hunted === 1, "a kill: meat in the pack, one arrow used: " + r.text);
  ok(s.skills.Archery.xp + s.skills.Archery.lvl * 1000 > xp0, "and Archery improves");
  const r2 = H.settle(s, g, "miss", "fled", rnd); ok(!r2.kill && /wide/.test(r2.text), "a miss: nothing");
}
// ---------------------------------------------------------------- the forge and the kitchen
{ for (const p of ["pelt_deer", "pelt_elk", "pelt_goat", "pelt_hare", "pelt_fox", "pelt_snowfox", "pelt_boar"]) ok(SMITH.REFINE.some((r) => r[3] === "tan" && r[2][0][0] === p), "tans at the forge: " + p);
  const s = hero(); s.location = "Whiterun"; G.give(s, "pelt_elk", 2);
  const k = SMITH.REFINE.findIndex((r) => r[2][0][0] === "pelt_elk"), lea0 = SMITH.count(s, "mat_leather");
  if (SMITH.atForge(s)) { SMITH.refine(s, k, true); ok(SMITH.count(s, "pelt_elk") === 0 && SMITH.count(s, "mat_leather") === lea0 + 4, "tanning uses up the hides"); }
  ok(SMITH.GROUPS.some(([g]) => g === "tools") && ["skin_knife", "skin_knife_steel", "rod_fine", "rod_master"].every((id) => SMITH.RECIPES[id]?.group === "tools"), "knives and rods at the forge (Tools)");
  for (const id of ["goat_roast", "rabbit_roast", "boar_stew"]) ok(COOK.RECIPES[id] && D.ITEMS["dish_" + id], "a recipe for the new meat: " + id);
}
// ---------------------------------------------------------------- perks
{ const keys = ["huntvital", "hunttrack", "huntwind", "huntsway", "skinyield", "trophy", "huntstalk", "fishband", "fishtire", "fishbite", "fishslack", "fishrare", "fishgut"];
  for (const [id, ranks, k, v] of [["clean_kill", 2, "huntvital", 0.5], ["wind_reader", 1, "huntwind", 0.5], ["skinner", 1, "skinyield", 1], ["stalker", 2, "huntstalk", 0.5], ["angler", 2, "fishband", 0.4], ["line_sense", 1, "fishbite", 0.5], ["deep_waters", 1, "fishrare", 1]]) {
    const s = hero({ [id]: ranks });
    ok(Math.abs(PFX.num(s, k) - v) < 1e-9, `${id} gives ${k} ${v} (got ${PFX.num(s, k)})`);
  }
  const src = ["fishing.js", "huntgame.js"].map((f) => fs.readFileSync(W + f, "utf8")).join("\n");
  for (const k of keys) ok(src.includes(`"${k}"`), "perk effect is read in the games: " + k);
}
// ---------------------------------------------------------------- network: two phones, same seed, same result
{ const net = (x) => JSON.parse(JSON.stringify(x));   // what goes over the wire
  const two = () => { const a = hero({ skinner: 1 }), b = hero({ skinner: 1 }); a.id = "pA"; a.name = "Ana"; b.id = "pB"; b.name = "Bo"; for (const s of [a, b]) G.give(s, "skin_knife"); return [a, b]; };
  const t = 1.8e9;
  // hunting grounds: party mates in the same village, same day, same hunt of the day -> same animal, wind, distance, result
  { const [a, b] = two(), sa = H.seedFor(a, {}, t), sb = H.seedFor(b, {}, t);
    ok(sa === sb && /^ground\|Riverwood\|/.test(sa), "two phones in Riverwood get the same hunt seed: " + sa);
    const ra = H.rng(sa), rb = H.rng(sb), ia = H.pickAnimal(a, [a.x, a.y], ra), ib = H.pickAnimal(b, [b.x, b.y], rb);
    const ga = H.plan(a, ia, {}, ra), gb = H.plan(b, ib, {}, rb);
    ok(ia === ib && JSON.stringify(ga.wind) === JSON.stringify(gb.wind) && ga.dist === gb.dist && ga.facing === gb.facing && ga.headT === gb.headT, `same animal, wind and distance on both phones (${ia}, wind ${ga.wind.dir}x${ga.wind.str}, ${ga.dist.toFixed(1)})`);
    ga.seed = sa; gb.seed = sb;
    for (const hit of ["heart", "body"]) {
      const qa = H.outcome(ga, hit, H.rng(sa + "|res")), qb = H.outcome(gb, hit, H.rng(sb + "|res"));
      ok(qa === qb, `the ${hit} shot ends the same way on both phones (${qa})`);
    }
    const ra2 = H.settle(a, { ...ga }, "heart", "clean", H.rng(sa + "|res")), rb2 = H.settle(b, { ...gb }, "heart", "clean", H.rng(sb + "|res"));
    ok(JSON.stringify(ra2.got) === JSON.stringify(rb2.got) && ra2.text === rb2.text, "same hide, meat and trophy on both phones: " + ra2.text);
    H.useGround(a, undefined, t); H.useGround(b, undefined, t);
    const na = H.seedFor(a, {}, t), nb = H.seedFor(b, {}, t);
    ok(na === nb && na !== sa, "the next hunt of the day is new, and still the same for both");
    ok(H.seedFor(a, {}, t + 24 * 3600 / G.GAME_SPEED) !== na, "a new day, new animals");
    // the same seed, replayed a hundred times, never drifts
    let same = true; for (let k = 0; k < 100; k++) { const r1 = H.rng("x" + k), r2 = H.rng("x" + k); for (let j = 0; j < 20; j++) if (r1() !== r2()) same = false; }
    ok(same, "the seeded roll is the same every time");
  }
  // the road: only the leader plays the hunt; the member's phone gets the leader's halt and the result, word for word
  { const P = c.PARTYPLAY, [lead, mem] = two();
    if (!P) ok(false, "partyplay loaded");
    else {
      let p = { id: "party1", leader: lead.id, leaderName: lead.name, members: [{ id: lead.id, name: lead.name }, { id: mem.id, name: mem.name }] };
      lead.trip = { destName: "Whiterun", start: [0.41, 0.52], idx: 3, status: "encounter", encounter: { name: "Elk", lvl: 5 } };
      const s1 = H.seedFor(lead, { road: true }), s2 = H.seedFor(net(lead), { road: true });
      ok(s1 === s2 && s1.startsWith("road|Whiterun|"), "a road hunt's seed comes from the trip and the beast (same from a copy sent over the wire)");
      const g = H.plan(lead, "elk", { road: true }, H.rng(s1)); g.seed = s1;
      const q = H.outcome(g, "heart", H.rng(s1 + "|res")), res = H.settle(lead, g, "heart", q, H.rng(s1 + "|res"));
      p = P.halt(p, lead.id, { kind: "encounter", name: "Elk", opts: [["fight", "Fight", "btn"], ["huntroad", "Stalk and shoot", "btn"]] }, t);
      mem.trip = { follow: lead.id, status: "hold", destName: "Whiterun" };
      ok(P.canVote(net(p), mem.id, t) && !P.canDecide(mem, p) && P.canDecide(lead, p), "the member following sees the halt and can only vote; the leader decides");
      const text = H.told({ ...res, kill: res.kill }, "Elk");
      p = P.resolve(p, lead.id, text, t + 5);
      const onB = net(p);   // the member's phone
      ok(onB.halt.done.text === text && (res.kill ? text.includes(D.ITEMS.pelt_elk.name) || !res.got.pelt_elk : /got away/.test(text)), "the member hears exactly what the leader got: " + onB.halt.done.text);
      ok(P.resolve(onB, mem.id, "something else").halt.done.text === text, "a member can't rewrite the result");
      ok(!mem.inv.some((r) => r.item === "pelt_elk"), "the hides stay with the leader who shot (no double loot)");
    }
  }
  // fishing side by side: same water, hour and cast -> same fish, same bite, same fight
  { const [a, b] = two(); for (const s of [a, b]) G.give(s, "fishing_rod");
    const ctx = { water: "river", hold: "Whiterun", night: false, wx: "clear", cast: 0.7 };
    const ka = F.castSeed(ctx, 1, t), kb = F.castSeed(net(ctx), 1, t);
    ok(ka === kb && F.castSeed(ctx, 2, t) !== ka, "two anglers' first casts share a seed; the next cast is new");
    const fa = F.roll(a, ctx, F.rng(ka + "|fish")), fb = F.roll(b, ctx, F.rng(kb + "|fish"));
    const wa = F.waitFor(ctx, F.rng(ka + "|wait")), wb = F.waitFor(ctx, F.rng(kb + "|wait"));
    const ha = F.hook(a, fa, F.rng(ka + "|hook")), hb = F.hook(b, fb, F.rng(kb + "|hook"));
    ok(fa === fb && wa.at === wb.at && JSON.stringify(wa.nib) === JSON.stringify(wb.nib) && JSON.stringify(ha.band) === JSON.stringify(hb.band) && ha.runIn === hb.runIn, `same fish (${fa}), bite and fight on both phones`);
    const la = F.land(a, fa, F.rng(ka + "|land")), lb = F.land(b, fb, F.rng(kb + "|land"));
    ok(la.item === lb.item && JSON.stringify(la.extra) === JSON.stringify(lb.extra), "same catch and cleaning on both phones");
  }
  // nothing shared is rolled with Math.random any more (only the defaults of the pure helpers, which play() always overrides)
  for (const f of ["fishing.js", "huntgame.js"]) {
    const src = fs.readFileSync(W + f, "utf8").replace(/rnd = Math\.random/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    ok(!/Math\.random/.test(src), f + ": no stray Math.random in the game");
  }
}
console.log(fails ? `${fails}/${n} FAILED` : `fishhunt: all ${n} passed`);
process.exit(fails ? 1 : 0);
