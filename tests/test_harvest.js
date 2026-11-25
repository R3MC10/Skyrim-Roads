const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Hands-on harvesting (harvest.js): yields by how the mini-game went, Quick Gather, perfect and glowing specimens and
// their potion bonus, herb orders and market demand, cooking and crafting uses, the new perks, party fairness,
// and a balance sim so the economy isn't flooded.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy };
vm.createContext(c);
const files = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "smithing.js", "roam.js"];
if (fs.existsSync(W + "solworld.js")) files.push("solworld.js");
files.push("explore.js", "cooking.js", "gather.js", "mp.js", "harvest.js");
for (const f of files) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0;
c.ok = (cond, msg) => { if (!cond) { fails++; console.log("FAIL", msg); } else console.log("ok  ", msg); };
vm.runInContext(`var ICONART = { item: (id) => "<i>" + id + "</i>" };`, c);
vm.runInContext(`
function hero(level=10){ const s=G.newSave("p"+Math.random(),"T","nord"); s.level=level; G.setHealth(s,G.maxHealth(s)); return s; }
const have = (s, id) => s.inv.filter(r=>r.item===id).reduce((a,r)=>a+r.qty,0);
const N = GATHER.nodes();
const at = (s, n) => { s.x = n.pos[0]; s.y = n.pos[1]; s.location = null; };
const plain = N.find(n => HARVEST.kindOf(n.ing) === "flower" && !HARVEST.single(n.ing));
// how plants are picked
{
  const k = HARVEST.kindOf;
  ok(k("ing_lavender")==="flower" && k("ing_canis_root")==="root" && k("ing_white_cap")==="fungus" && k("ing_nirnroot")==="nirn"
    && k("ing_snowberries")==="berry" && k("ing_pine_thrush_egg")==="egg" && k("ing_pearl")==="clam" && k("ing_namiras_rot")==="fungus", "each plant has its own gesture");
  ok(N.every(n => HARVEST.KINDS[k(n.ing)]), "every patch maps to a known gesture");
}
// yields by grade
{
  const s = hero(); let t = G.now();
  const pickAs = (grade) => { at(s, plain); t += GATHER.RESPAWN + 5; const b = have(s, plain.ing); const r = GATHER.pick(s, plain.id, t, false, { grade }); return { r, got: have(s, plain.ing) - b }; };
  ok(pickAs("fail").got === 1, "rough harvest still gives 1");
  ok(pickAs("good").got === 2, "good harvest gives 2");
  ok(pickAs("perfect").got === 3, "perfect harvest gives 3");
  const nirn = N.find(n => n.ing === "ing_nirnroot"); const s2 = hero(); at(s2, nirn);
  ok(GATHER.pick(s2, nirn.id, G.now(), false, { grade: "perfect" }).n === 1, "Nirnroot always gives one");
  ok(!HARVEST.canQuick(s2, "ing_nirnroot"), "Nirnroot never offers Quick Gather");
}
// Quick Gather unlocks after three hand harvests
{
  const s = hero(); let t = G.now();
  ok(!HARVEST.canQuick(s, plain.ing), "no Quick Gather before you've picked it by hand");
  for (let i = 0; i < 3; i++) { at(s, plain); t += GATHER.RESPAWN + 5; GATHER.pick(s, plain.id, t, false, { grade: "good" }); }
  ok(HARVEST.canQuick(s, plain.ing), "Quick Gather opens after three hand harvests");
  ok(/data-act="gquick"/.test(GATHER.card(s, t + GATHER.RESPAWN + 5)), "the card offers Quick once it's open");
  at(s, plain); t += GATHER.RESPAWN + 5; const r = GATHER.act(s, "gquick", plain.id, t);
  ok(r.ok && r.n >= 1 && r.n <= 2 && r.grade === "quick" && !r.rare, "Quick Gather: 1-2, never a rare specimen (" + r.n + ")");
  const u = hero(); at(u, plain); ok(/data-act="gpick"/.test(GATHER.card(u)) && !/data-act="gquick"/.test(GATHER.card(u)), "a new plant only offers Gather by hand");
  const sh = hero(); sh.perks = { ...(sh.perks||{}), forager: 1, sure_hands: 1 }; let t2 = G.now();
  for (let i = 0; i < 2; i++) { at(sh, plain); t2 += GATHER.RESPAWN + 5; GATHER.pick(sh, plain.id, t2, false, { grade: "fail" }); }
  ok(HARVEST.canQuick(sh, plain.ing) && HARVEST.tolOf(sh) > 1, "Sure Hands: Quick after two, wider sweet spots");
}
// perfect and glowing specimens
{
  const s = hero(), t = G.now();
  G.give(s, "ing_nirnroot", 1);
  const r = HARVEST.afterPick(s, "ing_nirnroot", "perfect", t, () => 0);
  ok(r && r.k === "l" && r.word === "Glowing", "a lucky hand harvest finds a glowing specimen");
  ok(HARVEST.primeOf(s, "ing_nirnroot").l === 1, "the specimen is remembered");
  ok(/glowing/.test(HARVEST.tagHTML(s, "ing_nirnroot")), "alchemy rows show the specimen tag");
  ok(HARVEST.afterPick(s, "ing_nirnroot", "quick", t, () => 0) === null, "quick picks never find specimens");
  for (let i = 0; i < 6; i++) { G.give(s, "ing_lavender", 1); HARVEST.afterPick(s, "ing_lavender", "perfect", t, () => 0); }
  ok(HARVEST.hs(s).rare.n === HARVEST.RARE_PER_DAY, "at most " + HARVEST.RARE_PER_DAY + " specimens a day");
  ok(HARVEST.afterPick(s, "ing_lavender", "perfect", t + 2 * 7200, () => 0) !== null, "the cap resets the next day");
  const p0 = HARVEST.rareChance(s, "ing_lavender", "good"), e = hero(); e.perks = { ...(e.perks||{}), forager: 1, herbalists_eye: 1 };
  ok(HARVEST.rareChance(e, "ing_lavender", "good").p > p0.p * 1.4, "Herbalist's Eye finds specimens half again as often");
  ok(HARVEST.rareChance(s, "ing_lavender", "perfect").p > p0.p && HARVEST.rareChance(s, "ing_lavender", "fail").p < p0.p, "better hands, better luck");
  // eaten or sold: the specimen goes with it
  const row = s.inv.find(r => r.item === "ing_nirnroot"); G.take(s, row.id, 1);
  ok(HARVEST.primeOf(s, "ing_nirnroot").l === 0, "a specimen you no longer carry is gone");
}
// the potion bonus
{
  const brewOnce = (glow) => {
    const s = hero(); s.location = "Whiterun";
    G.give(s, "ing_nirnroot", 1); G.give(s, "ing_deathbell", 1);
    if (glow) HARVEST.afterPick(s, "ing_nirnroot", "perfect", G.now(), () => 0);
    const ids = s.inv.filter(r => ["ing_nirnroot", "ing_deathbell"].includes(r.item)).map(r => r.id);
    const r = TOWNS.brew(s, ids); const m = +((r.text.match(/Damage Health (\\d+)/) || [])[1] || 0);
    return { r, m, s };
  };
  const a = brewOnce(false), b = brewOnce(true);
  ok(a.m > 0 && b.m >= Math.round(a.m * 1.2) && /stronger/.test(b.r.text), "a glowing Nirnroot makes the potion stronger: " + a.m + " -> " + b.m);
  ok(!HARVEST.primeOf(b.s, "ing_nirnroot").l, "the specimen is used up");
}
// herb orders: a daily job in every town, more pay in hard times, the plant sells for more there
{
  const s = hero(); s.location = "Whiterun"; const t = G.now();
  const o = HARVEST.order("Whiterun", t, s);
  ok(o && D.ITEMS[o.ing] && o.n >= 3 && o.n <= 5 && o.reward > 0, "Whiterun's alchemist wants " + (o && o.n) + " " + (o && o.ing) + " for " + (o && o.reward));
  ok(JSON.stringify(HARVEST.order("Whiterun", t, s)) === JSON.stringify(o), "the same order on every phone (deterministic)");
  ok(!HARVEST.order("Bleak Falls Barrow", t, s), "no orders outside towns");
  ok(HARVEST.deliver(s, t).err, "can't deliver without the herbs");
  G.give(s, o.ing, o.n); const g0 = s.gold;
  const r = HARVEST.deliver(s, t);
  ok(r.ok && s.gold === g0 + o.reward && have(s, o.ing) === 0, "deliver: herbs go, gold comes: " + r.text);
  ok(HARVEST.deliver(s, t).err && /Filled/.test(HARVEST.orderHTML(s, t)), "one order per town per day");
  ok(/hdeliver/.test(HARVEST.orderHTML(Object.assign(hero(), { location: "Riften" }), t)), "the alchemy screen shows the order");
  let max = 0; for (const town of Object.keys(WORLD.places)) for (let d = 0; d < 30; d++) { const x = HARVEST.order(town, t + d * 7200); if (x) max = Math.max(max, x.reward); }
  ok(max <= HARVEST.ORDER_CAP * 1.5, "orders never pay a fortune (max " + max + ")");
}
// cooking and crafting
{
  ok(COOK.RECIPES.snowberry_crostata && D.ITEMS.dish_snowberry_crostata && COOK.RECIPES.juniper_crostata, "berry crostatas to cook");
  ok(SMITH.REFINE.some(r => r[2][0][0] === "ing_tundra_cotton"), "Tundra Cotton twists into leather strips");
}
// the new perks keep the old ones
{
  for (const id of ["forager", "wildcrafter", "green_thumb", "master_alchemist", "herbalists_eye", "sure_hands", "anatomist", "master_gardener"]) ok(PERKS.BY_ID[id], "perk " + id);
  const a = hero(), b = hero(); b.perks = { ...(b.perks||{}), forager: 1, anatomist: 1 };
  let na = 0, nb = 0; for (let i = 0; i < 300; i++) { na += GATHER.creatureParts(a, { name: "Black bear" }).length; nb += GATHER.creatureParts(b, { name: "Black bear" }).length; }
  ok(nb > na * 1.15, "Anatomist: more creature parts (" + na + " vs " + nb + ")");
  const s = hero(); s.location = "Whiterun"; s.homes = { Whiterun: { chest: [], garden: 0 } }; s.perks = { ...(s.perks||{}), master_gardener: 1 };
  G.give(s, "ing_lavender", 1); GATHER.plant(s, "ing_lavender");
  ok(/Lavender ×3/.test(TOWNS.harvest(s, G.now() + 99999)), "Master Gardener: 3 per bed instead of 2");
}
// party: patches regrow per player, so everyone picks their own share
{
  const t = G.now(), a = hero(), b = hero(); at(a, plain); at(b, plain);
  ok(GATHER.pick(a, plain.id, t, false, { grade: "good" }).ok && GATHER.pick(b, plain.id, t, false, { grade: "good" }).ok, "two party members both pick the same patch");
  ok(/own share/.test(GATHER.card(a)), "the card says so");
}
// the road prompt: a ripe patch in reach, also while travelling
{
  const s = hero(); at(s, plain); s.trip = { status: "travel" };
  const p = HARVEST.nearPrompt(s); ok(p && p.id === plain.id && p.riding, "in reach while on the road");
  GATHER.pick(s, plain.id); ok(!HARVEST.nearPrompt(s) || HARVEST.nearPrompt(s).id !== plain.id, "no prompt once picked");
  s.trip = { status: "fight" }; ok(!HARVEST.nearPrompt(s), "no prompt mid-fight");
}
// scoring rules
{
  const S = HARVEST.SCORE;
  ok(S.snip(3)==="perfect" && S.snip(15)==="good" && S.snip(40)==="fail" && S.snip(25, 1.3)==="good", "snip scoring (wider with Sure Hands)");
  ok(S.pull(true, 1, false)==="fail" && S.pull(false, 0.2, true)==="perfect" && S.pull(false, 0.7, true)==="good", "pull scoring");
  ok(S.scrape(0.95, 0.9)==="perfect" && S.scrape(0.6, 0.6)==="good" && S.scrape(0.4, 0.9)==="fail", "scrape scoring");
  ok(S.berries(5,5,0)==="perfect" && S.berries(4,5,1)==="good" && S.berries(2,5,0)==="fail", "berry scoring");
  ok(S.pry(0.7,0.6,0.8)==="perfect" && S.pry(0.62,0.6,0.8)==="good" && S.pry(0.9,0.6,0.8)==="fail", "pry scoring");
}
// balance sim: hand harvesting is better than quick but doesn't flood the market
{
  const OLD = 2;                        // the old pick: 1-3, average 2
  const mix = { perfect: 0.3, good: 0.55, fail: 0.15 };   // a fair guess at how players do
  const s = hero(); const trials = 4000; let quickM = 0, quickU = 0;
  const hand = Object.entries(mix).reduce((a, [g, p]) => a + p * HARVEST.YIELD[g], 0);
  for (let i = 0; i < trials; i++) quickU += HARVEST.amount(s, "ing_lavender", "quick");
  for (let i = 0; i < 3; i++) HARVEST.afterPick(s, "ing_lavender", "good", G.now(), () => 1);
  for (let i = 0; i < trials; i++) quickM += HARVEST.amount(s, "ing_lavender", "quick");
  quickM /= trials; quickU /= trials;
  ok(hand <= OLD * 1.15, "hand picking averages " + hand.toFixed(2) + " (old 2.00): at most 15% more");
  ok(hand / quickM >= 1.15 && hand / quickM <= 1.45, "hand picking beats Quick Gather by " + Math.round((hand / quickM - 1) * 100) + "%");
  ok(quickU < quickM && quickU >= 1.4, "Gather all / auto-pick on new plants: " + quickU.toFixed(2));
  // specimens per 100 hand harvests (no cap hit)
  const r = hero(); let found = 0;
  for (let i = 0; i < 2000; i++) { const g = Math.random() < 0.3 ? "perfect" : Math.random() < 0.8 ? "good" : "fail"; HARVEST.hs(r).rare = { d: -1, n: 0 }; G.give(r, "ing_lavender", 1); if (HARVEST.afterPick(r, "ing_lavender", g, G.now())) found++; }
  ok(found / 20 >= 2 && found / 20 <= 12, "about " + (found / 20).toFixed(1) + " specimens per 100 hand harvests");
}
`, c);
console.log(fails ? `FAILED ${fails}` : "harvest ok");
process.exit(fails ? 1 : 0);
