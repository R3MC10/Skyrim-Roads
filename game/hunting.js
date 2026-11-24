/* Hunting. [OURS, animals from Skyrim]
   Remigiusz: "Hunting should be triggering encounters Vs animal combats when toggled on."
   - The  button on the map turns hunting on. While it's on you travel a bit slower (you're tracking game), and on the
     road you run into animals much more often: deer, elk, mountain goats, horkers on the coast, and now and then
     something that hunts back (wolves, bears, sabre cats). Each one is a fight you play.
   - Prey gives venison (or horker meat) and hides you can tan into leather; predators give their pelts as before.
   - Hunting is off by carriage, when you follow someone, and while guarding a caravan. */
const HUNT = (() => {
  const RATE = 0.12;        // extra animal encounters per minute of road while hunting (normal encounters are 0.16)
  const SLOW = 0.9;         // you travel 10% slower while tracking
  const PREY = [
    // name, weight, level, health, damage, loot [item, min, max, chance], text
    ["Deer", 5, 2, 32, 4, [["food_venison", 1, 2, 1], ["mat_leather", 1, 1, 0.5]], "A deer lifts its head from the grass, ears twitching. You nock an arrow, but it's already wheeling to run."],
    ["Elk", 4, 4, 55, 8, [["food_venison", 2, 3, 1], ["mat_leather", 1, 2, 0.8]], "A bull elk stands broadside in a clearing. It sees you and lowers its antlers."],
    ["Mountain goat", 3, 3, 28, 6, [["food_venison", 1, 1, 1], ["mat_leather", 1, 1, 0.35]], "A shaggy goat watches you from a rock ledge, chewing. Then it charges, horns first."],
    ["Horker", 2, 5, 70, 9, [["food_horker", 1, 2, 1], ["mat_leather", 1, 1, 0.4]], "A horker heaves itself up off the shingle and bellows at you, tusks bared.", "coast"],
  ];
  const PREDATORS = [["Lone wolf", 2], ["Wolf pack", 1], ["Black bear", 1], ["Sabre cat", 0.8]];   // from the normal encounter list
  const on = (s) => !!s.hunting;
  function toggle(s) { s.hunting = !s.hunting; return s.hunting; }
  const perk = (s, k) => (typeof PFX !== "undefined" ? +PFX.num(s, k) || 0 : 0);
  /* is hunting doing anything on this trip right now */
  const active = (s) => on(s) && !!s.trip && !s.trip.carriage && !s.trip.follow && !s.trip.caravan && !s.trip.boat;
  const speedMult = (s) => (active(s) ? SLOW : 1);
  /* extra animal encounters per minute (Hunter's Eye: half again as many) */
  const rate = (s) => (active(s) ? RATE * (1 + perk(s, "huntrate")) : 0);
  /* horkers only by the sea: is there sea within a short walk */
  function nearCoast(s, r = 0.025) {
    try { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (Terrain.NAMES[Terrain.typeAtPos([s.x + Math.cos(a) * r, s.y + Math.sin(a) * r])] === "Sea") return true; } } catch { /* no map */ }
    return false;
  }
  /* the animal you find (not scaled yet: the engine scales it to you) */
  function pick(s, rnd = Math.random) {
    const coast = nearCoast(s);
    const prey = PREY.filter((p) => !p[7] || (p[7] === "coast" && coast));
    const preds = PREDATORS.map(([n, w]) => [D.ENCOUNTERS.find((e) => e.name === n), w]).filter(([e]) => e);
    const all = [...prey.map((p) => ["prey", p, p[1]]), ...preds.map(([e, w]) => ["pred", e, w])];
    let r = rnd() * all.reduce((a, x) => a + x[2], 0), got = all[0];
    for (const x of all) { if (r < x[2]) { got = x; break; } r -= x[2]; }
    if (got[0] === "pred") {
      const e = JSON.parse(JSON.stringify(got[1]));
      e.text = `You were tracking game, but something else was tracking you. ${e.text || ""}`.trim();
      e.hunt = true; e.tags = [...new Set([...(e.tags || []), "beast", "animal"])];
      return e;
    }
    const [name, , level, health, damage, loot, text] = got[1];
    return { name, danger: "low", level, health, damage, tags: ["beast", "animal", "prey"], gold: [0, 0], holds: null, text, hunt: true, prey: true, game: loot };
  }
  /* what the animal leaves: meat and hide (predators' pelts come from the normal loot) */
  function loot(s, e, rnd = Math.random) {
    const got = [];
    for (const [item, a, b, ch] of e.game || []) {
      if (!D.ITEMS[item] || rnd() >= ch) continue;
      const q = a + Math.floor(rnd() * (b - a + 1)) + (perk(s, "huntmeat") > 0 && item.startsWith("food_") ? 1 : 0);
      G.give(s, item, q); got.push(D.ITEMS[item].name + (q > 1 ? ` ×${q}` : ""));
    }
    return got;
  }
  return { RATE, SLOW, PREY, PREDATORS, on, toggle, active, speedMult, rate, pick, loot };
})();
if (typeof module !== "undefined") module.exports = HUNT;
