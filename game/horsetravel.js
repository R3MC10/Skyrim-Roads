/* HORSETRAVEL: horses are for travel. [OURS module]
   Remigiusz (25 Nov 2026): "remove mounted combat from the game, mounts are only for travelling".
   Every fight is on foot. If you're riding when a road fight starts you get down, your horse waits beside you, safe
   (nobody goes for it and the fight never hurts it), and you ride on afterwards. horseback.js and mountfight.js are gone.
   The perks that used to work from the saddle keep their ids (old saves keep them) and now help you on the road:
     Cavalry Charge (One-Handed)   you ride 8% faster
     Horse Archer   (Archery)      while you ride, 20% fewer fights find you on the road
     Steady Steed   (Athletics, 2) your horse carries 25/50 more
     Trample        (Athletics)    off the road (grass, hills, snow) your horse is 10% faster
     Saddle Caster  (Destruction)  dual-cast destruction spells cost 5% less
   FX keys: ridespeed, offride, horsecarry, rideamb (read here) and dualcost (engine.js). Loaded after perkfx.js and horses.js.
   API: HORSETRAVEL.encounterMult(s) → multiplier on the road fight chance (engine.js; bonds.js adds the warhorse). */
const HORSETRAVEL = (() => {
  const PERKS_ADD = [
    ["One-Handed", "cavalry_charge", "Cavalry Charge", 1, [30], ["armsman"], "You ride 8% faster. [OURS]", [["ridespeed", 0.08, {}]]],
    ["Archery", "horse_archer", "Horse Archer", 1, [35], ["overdraw"], "Bandits and beasts see the bow on your back: while you ride, 20% fewer fights find you on the road. [OURS]", [["rideamb", 0.2, {}]]],
    ["Athletics", "steady_steed", "Steady Steed", 2, [25, 55], ["long_strider"], "Your horse carries 25/50 more. [OURS]", [["horsecarry", [25, 50], {}]]],
    ["Destruction", "saddle_caster", "Saddle Caster", 1, [35], ["destruction_dual_casting"], "Dual-cast destruction spells cost 5% less magicka. [OURS]", [["dualcost", 0.05, { school: "Destruction" }]]],
    ["Athletics", "trample", "Trample", 1, [50], ["steady_steed"], "Your horse ploughs through rough ground: off the road (grass, hills, snow) it goes 10% faster. [OURS]", [["offride", 0.1, {}]]],
  ];
  if (typeof PERKS !== "undefined") {
    for (const [sk, id, name, ranks, req, needs, desc, fx] of PERKS_ADD) {
      const tree = PERKS.TREES[sk];
      if (!tree || PERKS.BY_ID[id]) continue;
      tree.push([id, name, ranks, req, needs, desc]);
      PERKS.BY_ID[id] = { id, name, ranks, req, needs, desc, skill: sk };
      if (typeof PFX !== "undefined" && PFX.FX) PFX.FX[id] = fx;
    }
  }
  const pnum = (s, k) => (typeof PFX !== "undefined" && s ? PFX.num(s, k) : 0);
  const riding = (s) => typeof HORSES !== "undefined" && !!s && HORSES.riding(s);
  function offRoad(s) {
    if (typeof Terrain === "undefined" || !s || s.x == null) return false;
    try { const g = Terrain.NAMES[Terrain.typeAtPos([s.x, s.y])]; return g !== "Road" && g !== "Bridge"; } catch (e) { return false; }
  }
  /* road fights while you ride: Horse Archer (bonds.js adds the warhorse speciality) */
  function encounterMult(s) {
    if (!riding(s)) return 1;
    return Math.max(0.5, 1 - Math.min(0.4, pnum(s, "rideamb")));
  }
  if (typeof HORSES !== "undefined") {
    const sp0 = HORSES.speed;
    HORSES.speed = function (s, ...rest) {
      let v = sp0.call(this, s, ...rest);
      if (!s?.horse) return v;
      try { v *= 1 + Math.min(0.2, pnum(s, "ridespeed")) + (offRoad(s) ? Math.min(0.2, pnum(s, "offride")) : 0); } catch (e) { /* plain speed */ }
      return +v.toFixed(3);
    };
    const ca0 = HORSES.carry;
    HORSES.carry = function (s, ...rest) { const v = ca0.call(this, s, ...rest); return s?.horse ? v + Math.round(pnum(s, "horsecarry")) : v; };
  }
  return { PERKS_ADD, encounterMult, offRoad };
})();
if (typeof module !== "undefined") module.exports = HORSETRAVEL;
