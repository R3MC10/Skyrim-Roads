// Sneak mode on the road + fog of war for other heroes (sneakmode.js)
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "sneakmode.js"])
  vm.runInContext(fs.readFileSync(__GAME + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const bad = [];
const ok = (cond, msg) => { if (!cond) bad.push(msg); console.log((cond ? "ok   " : "BAD  ") + msg); };
const s = G.newSave("S", "Sly", "khajiit"); s.location = null; [s.x, s.y] = WORLD.places.Whiterun; s.x += 0.05;
const v0 = G.speed(s); s.sneak = true; const v1 = G.speed(s);
ok(v1 < v0 * 0.8 && v1 > v0 * 0.4, "sneaking is slower: " + v0.toFixed(1) + " -> " + v1.toFixed(1));
ok(SNEAKMODE.encounterMult(s) < 0.6, "fewer road encounters while sneaking: x" + SNEAKMODE.encounterMult(s).toFixed(2));
s.sneak = false; ok(SNEAKMODE.encounterMult(s) === 1 && SNEAKMODE.speedMult(s) === 1, "no effect when not sneaking"); s.sneak = true;
const far = SNEAKMODE.seenWithin({ sneaking: false }), lo = SNEAKMODE.seenWithin({ sneaking: true, sneak: 15 }), hi = SNEAKMODE.seenWithin({ sneaking: true, sneak: 100 });
ok(far === SNEAKMODE.SIGHT_PX && lo < far && hi < lo && hi >= SNEAKMODE.MIN_SEEN_PX, "spotted from: normal " + far + ", sneaky novice " + lo + ", master " + hi);
ok(SNEAKMODE.canSee([0.5, 0.5], { sneaking: true, sneak: 100 }, [0.5, 0.5]) && !SNEAKMODE.canSee([0.5, 0.5], { sneaking: true, sneak: 100 }, [0.55, 0.5]), "a master sneak 50 paces away is invisible, right next to you is not");
ok(SNEAKMODE.canSee([0.5, 0.5], { sneaking: true, sneak: 100 }, [0.9, 0.9], { party: true }), "party members are always seen");
const xp0 = s.xp?.Sneak ?? 0; let lines = []; for (let i = 0; i < 60; i++) lines = lines.concat(SNEAKMODE.train(s, 60));
ok(s._sneakXp < 3, "sneak practice accumulates while moving");
const h0 = G.hiddenChance({ ...s, sneak: false }, { danger: "low" }, G.now()), h1 = G.hiddenChance(s, { danger: "low" }, G.now());
ok(h1 > h0, "fights that find you while sneaking start hidden more often: " + h0.toFixed(2) + " -> " + h1.toFixed(2));
const p = G.newSave("P", "Perky", "khajiit"); p.sneak = true; [p.x, p.y] = s.xy || [s.x, s.y];
const base = SNEAKMODE.speedMult(p), range0 = SNEAKMODE.myRange(p), enc0 = SNEAKMODE.encounterMult(p);
p.perks = { ...(p.perks || {}), silent_roads: 1, shadow_paths: 1 };
ok(SNEAKMODE.speedMult(p) > base && SNEAKMODE.myRange(p) <= range0 && SNEAKMODE.encounterMult(p) < enc0, "perks Silent Roads and Shadow Paths work");
if (bad.length) { console.log("FAILED", bad.length); throw new Error("sneakmode"); }
console.log("sneakmode ok");
`, c);
