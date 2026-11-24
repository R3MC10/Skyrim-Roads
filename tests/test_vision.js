// Cone of sight on the map (vision.js): point-in-cone, range modifiers, perks, spotting places while travelling
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "wevents.js", "horses.js", "sneakmode.js", "vision.js"])
  if (fs.existsSync(__GAME + f)) vm.runInContext(fs.readFileSync(__GAME + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const bad = [];
const ok = (cond, msg) => { if (!cond) bad.push(msg); console.log((cond ? "ok   " : "BAD  ") + msg); };
const V = VISION, W = 1000, H = 700;
const at = (c, dist, ang) => [(c.x + Math.cos(ang) * dist) / W, (c.y + Math.sin(ang) * dist) / H];

// 1. point in cone
const p = V.params({ hour: 12, weather: "clear", height: 0 });
const k = V.cone([0.5, 0.5], 0, p);   // facing east
ok(V.inCone(k, at(k, p.range * 0.5, 0)), "straight ahead, half range: seen");
ok(V.see(k, at(k, p.range * 0.5, 0)) === 1, "...and seen clearly (1)");
ok(!V.inCone(k, at(k, p.range * 0.5, Math.PI)), "straight behind, half range: not seen");
ok(V.inCone(k, at(k, p.near * 0.8, Math.PI)), "right behind you, inside the near ring: seen");
ok(!V.inCone(k, at(k, p.range * 1.05, 0)), "past the tip: not seen");
ok(V.inCone(k, at(k, p.range * 0.5, p.half * 0.9)) && !V.inCone(k, at(k, p.range * 0.5, p.half * 1.1)), "edges at ±half the width: just inside seen, just outside not");
const soft = V.see(k, at(k, p.range * 0.95, 0)), side = V.see(k, at(k, p.range * 0.5, p.half * 0.92));
ok(soft > 0 && soft < 1 && side > 0 && side < 1, "soft fade at the tip (" + soft.toFixed(2) + ") and the sides (" + side.toFixed(2) + ")");
const kw = V.cone([0.5, 0.5], Math.PI * 0.999, p);   // facing west: angle wrap-around
ok(V.inCone(kw, at(kw, p.range * 0.5, -Math.PI * 0.999)), "angles wrap around ±180°");
const kn = V.cone([0.5, 0.5], null, p);
ok(!V.inCone(kn, at(kn, p.range * 0.5, 0)) && V.inCone(kn, at(kn, p.near * 0.5, 2)), "no heading yet: only the near ring");
ok(Math.abs(V.wrap(3 * Math.PI) - Math.PI) < 1e-9 || Math.abs(V.wrap(3 * Math.PI) + Math.PI) < 1e-9, "wrap keeps angles in -π..π");

// 2. range and width modifiers
const day = V.params({ hour: 12 }), dusk = V.params({ hour: 19.5 }), night = V.params({ hour: 0 });
ok(night.range < dusk.range && dusk.range < day.range, "night shorter than dusk shorter than day: " + [day, dusk, night].map((q) => q.range.toFixed(0)).join(" > "));
ok(night.half < day.half, "night cone is narrower: " + day.half.toFixed(2) + " → " + night.half.toFixed(2));
const wx = ["clear", "cloudy", "rain", "snow", "storm", "fog", "blizzard"].map((w) => [w, V.params({ hour: 12, weather: w }).range]);
console.log("     range by weather:", wx.map(([w, r]) => w + " " + r.toFixed(0)).join(", "));
ok(wx.every(([w, r], i) => i === 0 || r <= wx[0][1]) && V.params({ weather: "blizzard" }).range < V.params({ weather: "snow" }).range, "bad weather shortens sight; a blizzard most of all");
ok(V.params({ hour: 0, weather: "blizzard" }).range >= V.MIN_RANGE, "never below the minimum: " + V.params({ hour: 0, weather: "blizzard" }).range.toFixed(0));
const flat = V.params({ height: 0.1 }), hill = V.params({ height: 0.4 }), peak = V.params({ height: 0.9 });
ok(hill.range > flat.range && peak.range >= hill.range && peak.range <= flat.range * 1.36, "hills see further, capped at +35%: " + [flat, hill, peak].map((q) => q.range.toFixed(0)).join(" < "));
ok(V.params({ archery: 100 }).range > V.params({ archery: 0 }).range, "a trained eye (Archery) sees further");
ok(V.params({ mounted: true }).range > V.params({}).range, "from the saddle you see a bit further");
ok(V.params({ range: 0.3 }).range > V.params({}).range && V.params({ wide: 0.2 }).half > V.params({}).half, "perk bonuses: further and wider");
const owl0 = V.params({ hour: 0, weather: "fog" }), owl = V.params({ hour: 0, weather: "fog", dark: 0.5 });
ok(owl.range > owl0.range && owl.range < V.params({}).range, "Owl Eyes: darkness and fog hurt less (" + owl0.range.toFixed(0) + " → " + owl.range.toFixed(0) + ")");
ok(V.params({ hour: 12, height: 1, archery: 100, mounted: true, range: 0.3 }).range <= V.MAX_RANGE, "never above the maximum");

// 3. terrain: real heights from the map
const flatPos = WORLD.places.Whiterun, hiPos = WORLD.places["High Hrothgar"] || WORLD.places.Whiterun;
const hf = Terrain.heightAt([flatPos[0] * W, flatPos[1] * H]), hh = Terrain.heightAt([hiPos[0] * W, hiPos[1] * H]);
console.log("     heights: Whiterun " + hf.toFixed(2) + ", High Hrothgar " + hh.toFixed(2));
ok(V.params({ height: hh }).range > V.params({ height: hf }).range, "High Hrothgar sees further than Whiterun's plain");

// 4. perks from a save (perkfx.js)
const s = G.newSave("V", "Watcher", "nord"); s.location = null; [s.x, s.y] = [0.5, 0.5];
const r0 = V.forPos(s, [0.5, 0.5], 1000);
s.perks = { ...(s.perks || {}), far_sight: 2, owl_eyes: 1 };
const r1 = V.forPos(s, [0.5, 0.5], 1000);
ok(PFX.num(s, "sightrange") > 0.25 && PFX.num(s, "sightwide") > 0.15 && PFX.num(s, "sightdark") === 0.5, "Far Sight rank 2 and Owl Eyes give their effects");
ok(r1.range > r0.range && r1.half > r0.half, "Far Sight: you see further and wider (" + r0.range.toFixed(0) + " → " + r1.range.toFixed(0) + ")");
ok(PERKS.BY_ID.far_sight?.skill === "Archery" && PERKS.BY_ID.owl_eyes?.skill === "Sneak", "new perks sit in the Archery and Sneak trees");

// 5. heading tracker: follows movement, keeps the last heading when you stop, ignores jumps
const a1 = V.track("t", [0.5, 0.5]), a2 = V.track("t", [0.51, 0.5]), a3 = V.track("t", [0.51, 0.5]), a4 = V.track("t", [0.8, 0.9]);
const a5 = V.track("t", [0.79, 0.9], null, false);
ok(a1 == null && Math.abs(a2) < 1e-9 && Math.abs(a3) < 1e-9 && Math.abs(a4) < 1e-9 && Math.abs(a5) < 1e-9, "heading follows movement east, stays when you stop, jump, or get nudged while standing");
ok(Math.abs(V.track("u", [0.5, 0.5], [0.5, 0.4]) + Math.PI / 2) < 1e-9, "just set off: you look where you're going (north)");

// 6. spotting places inside the cone while travelling
const t0 = 50000;   // midday on day 1? use whatever; just compare with and without the cone
const tgt = Object.entries(WORLD.places).find(([n, q]) => q[2] === "city" && !WORLD.isSol(q));
const sv = G.newSave("V2", "Scout", "nord"); sv.location = null; sv.discovered = sv.discovered.filter((n) => n !== tgt[0]);
const P2 = V.forPos(sv, [tgt[1][0] - 0.1, tgt[1][1]], t0);
const dist = Math.min(P2.range * 0.8, 130);   // in front of you, beyond the old walk-by radius (90 for a city)
sv.x = tgt[1][0] - (dist + 1) / W; sv.y = tgt[1][1];
const was = [sv.x - 0.002, sv.y]; sv.discovered = sv.discovered.filter((n) => n !== tgt[0]);
const logs = []; const found = V.step(sv, was, t0, (_, m) => logs.push(m));
ok(sv.discovered.includes(tgt[0]) && logs.some((m) => m.includes(tgt[0])), "walking east towards " + tgt[0] + ", you spot it " + dist.toFixed(0) + " paces ahead: " + logs.join(" | "));
ok(Math.abs(sv.facing) < 0.01, "you face the way you walked");
const sb = G.newSave("V3", "Back", "nord"); sb.location = null; sb.discovered = sb.discovered.filter((n) => n !== tgt[0]);
sb.x = tgt[1][0] - (dist + 1) / W; sb.y = tgt[1][1];
V.step(sb, [sb.x + 0.002, sb.y], t0, null);
ok(!sb.discovered.includes(tgt[0]), "walking away from it, you don't");
ok(Object.keys(V.SPOT).every((k) => V.SPOT[k] > 0 && V.SPOT[k] <= 1), "spot distances are a share of the cone's range");

if (bad.length) { console.log("FAILED", bad.length); throw new Error("vision"); }
console.log("vision ok");
`, c);
