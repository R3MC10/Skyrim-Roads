// Move effects (movefx.js) and real arrows (arrowfx.js): every spell has its own effect, every bow and crossbow shot
// (you, followers, archer foes, the Dwarven ballista) fires a painted projectile that lands, breaks or flies past.
// node test_movefx.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const ctx = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; return (...a) => { for (const v of a) if (typeof v === "number" && !isFinite(v)) throw new Error("NaN in " + String(k)); return { addColorStop() {}, width: 10 }; }; }, set: (t, k, v) => { t[k] = v; return true; } });
const doc = { createElement: () => ({ width: 0, height: 0, style: {}, dataset: {}, getContext: () => ctx, toDataURL: () => "data:image/png;base64,AA" }) };
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RegExp, document: doc, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 2, performance: { now: () => 0 } };
vm.createContext(c);
const files = fs.readFileSync(W + "index.html", "utf8").match(/<script src="([a-z0-9_]+\.js)">/g).map((s) => s.match(/"(.*)"/)[1]).filter((f) => !["store.js", "p2pnet.js", "ui.js", "sound.js", "map.js", "backup.js", "skillinfo.js"].includes(f));
for (const f of files) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { MOVEFX: M, ARROWFX: A, FIGHTART: F, D } = c;
ok(M && A && F, "movefx.js, arrowfx.js and fightart.js load");
ok(files.indexOf("arrowfx.js") >= 0 && files.indexOf("movefx.js") >= 0 && files.indexOf("movefx.js") < files.indexOf("fightart.js") && files.indexOf("arrowfx.js") < files.indexOf("fightart.js"), "both load before fightart.js");

// ---- 1. every spell has its own effect
const spells = Object.entries(D.SPELLS).filter(([, sp]) => sp.kind !== "custom");
const missing = spells.filter(([id]) => !M.SPELL[id]).map(([id]) => id);
ok(!missing.length, "every spell has an effect recipe (missing: " + missing.join(", ") + ")");
const stale = Object.keys(M.SPELL).filter((id) => !D.SPELLS[id]);
ok(!stale.length, "no recipe for a spell that doesn't exist (" + stale.join(", ") + ")");
const sigs = new Map();
for (const k of M.keys()) { const r = M.recipe(k), sg = M.sig(r); if (sigs.has(sg)) ok(false, `${k} looks the same as ${sigs.get(sg)}`); sigs.set(sg, k); }
ok(sigs.size === M.keys().length, `${sigs.size} spell and dual-cast effects, each its own`);
for (const [id, r] of Object.entries(M.SPELL)) ok(M.PAL[r.p], `${id}: its palette exists`);
// deliberate sharing: a scroll looks like its spell, a crafted spell like its first damage part
const scroll = Object.entries(D.ITEMS).find(([, it]) => it.spell && M.SPELL[it.spell]);
if (scroll) ok(M.keyOf({ who: "me" }, { a: "scroll:" + scroll[0] }) === "spell:" + scroll[1].spell, "a scroll plays its spell's effect");
ok(M.keyOf({ who: "me" }, { a: "dual:fireball" }) === "dual:fireball" && M.keyOf({ who: "me", dual: true }, { a: "spell:fireball" }) === "dual:fireball", "dual casting has its own, bigger effect");
ok(M.keyOf({ who: "them" }, { a: "spell:fireball" }) === null && M.keyOf({ who: "me", allyOnly: true }, { a: "spell:fireball" }) === null, "only your own casts are drawn this way");
ok(M.keyOf({ who: "me" }, { a: "attack" }) === null, "weapon blows keep their own effects (for now)");
// fire, frost and shock spells of the same element look different
const by = (el) => spells.filter(([, sp]) => sp.element === el && sp.kind === "damage").map(([id]) => M.SPELL[id].d + "/" + M.SPELL[id].i);
for (const el of ["fire", "frost", "shock"]) { const d = by(el); ok(new Set(d).size >= Math.min(d.length, 5), `${el} damage spells fly differently (${d.join(" ")})`); }

// ---- 2. a scene plays every spell without errors and stays inside its caps
const G = { hand: [120, 160], hand2: [108, 165], from: [100, 170], to: [380, 170], ally: [70, 180], gy: 192 };
for (const low of [false, true]) {
  const S = M.scene({ s: 1.6, W: 520, H: 240, groundY: 192, low });
  let maxN = 0, threw = null;
  for (const [id] of spells) for (const dual of [false, true]) for (const miss of [false, true]) {
    const b = { who: "me", miss, final: id === "fireball" }, m = F.MOVES[M.SPELL[id].d === "none" || M.SPELL[id].d === "rift" ? "self" : "cast"];
    try {
      for (let u = 0; u <= 1; u += 0.05) { S.tick(0.05); S.step(0.05, b, { a: (dual ? "dual:" : "spell:") + id }, m, u, G); if (Math.abs(u - m.hits[0]) < 0.026) S.hit(b, true); S.drawGround(ctx); S.drawFront(ctx, u * 1000); }
    } catch (e) { threw = threw || id + ": " + e.message; }
    maxN = Math.max(maxN, S.count());
  }
  ok(!threw, (low ? "low: " : "") + "every spell plays and draws without errors " + (threw || ""));
  ok(maxN <= S.cap && S.cap === (low ? 70 : 180), `${low ? "Low quality" : "normal"}: particles stay within the cap (${maxN}/${S.cap})`);
  ok(S.shapes() <= 28, "shapes stay within their pool");
  S.clear(); ok(S.shapes() === 0 && S.key() === null, "clear() empties the scene");
}

// ---- 3. bows and crossbows shoot a real projectile
const ranged = Object.entries(F.MOVES).filter(([, m]) => A.shotOf(m)).map(([k]) => k);
ok(ranged.includes("bow") && ranged.includes("crossbow"), "bow and crossbow are ranged moves: " + ranged.join(", "));
for (const k of ranged) {
  const m = F.MOVES[k], sp = A.spec({ wt: k });
  ok(sp.kind === (k === "crossbow" ? "bolt" : "arrow"), `${k} shoots ${sp.kind}`);
  ok(m.proj[0] < m.hits[0] + 1e-9 && m.proj[1] <= m.hits[0] + 1e-9, `${k}: released before the hit lands`);
}
const arrow = A.spec({ wt: "bow" }), bolt = A.spec({ wt: "crossbow" });
ok(arrow.arc > bolt.arc && bolt.speed > arrow.speed, "an arrow arcs, a bolt flies flatter and faster");
ok(A.spec({ wt: "bow", power: true }).len > arrow.len && A.spec({ wt: "bow", sneak: true }).len > arrow.len, "power and sneak shots are bigger");
ok(A.spec({ wt: "crossbow", ballista: true }).len > A.spec({ wt: "crossbow", power: true }).len, "a ballista bolt is bigger still");
for (const el of ["fire", "frost", "shock", "poison", "drain"]) ok(A.spec({ wt: "bow", el }).trail === el, `a ${el} arrow leaves a trail`);
ok(A.spec({ wt: "bow" }).trail === null, "a plain arrow leaves no coloured trail");
for (const low of [false, true]) {
  const S = A.scene({ s: 1.6, groundY: 192, low });
  const shot = (o) => S.fire(null, { x0: 120, y0: 150, x1: 380, y1: 160, dur: 0.2, sp: arrow, ...o });
  ok(shot({}) && S.flying() === 1 && S.fired() === 1, "a shot is in the air after the release");
  for (let i = 0; i < 6; i++) { S.tick(0.05); S.draw(ctx); }
  ok(S.flying() === 0, "it reaches the target");
  shot({ miss: true }); for (let i = 0; i < 40; i++) { S.tick(0.05); S.draw(ctx); }
  ok(S.inGround() === 1 && S.shots() === 0, "a miss flies past and sticks in the ground");
  shot({ blocked: true }); for (let i = 0; i < 5; i++) S.tick(0.05);
  ok(S.bits() > 0, "a blocked arrow breaks into bits");
  for (let i = 0; i < 20; i++) shot({ sp: A.spec({ wt: "bow", el: "fire", power: true }) });
  for (let i = 0; i < 30; i++) { S.tick(0.03); S.draw(ctx); }
  ok(S.shots() <= 8 && S.bits() <= S.cap && S.cap === (low ? 24 : 64), "shots and bits stay within their caps");
  ok(S.fire("k", { x0: 1, y0: 1, x1: 2, y2: 2, x1: 5, y1: 5, sp: bolt }) && !S.fire("k", { x0: 1, y0: 1, x1: 5, y1: 5, sp: bolt }), "one shot per key");
  ok(!S.fire(null, { x0: NaN, y0: 1, x1: 5, y1: 5, sp: bolt }), "a bad position fires nothing");
}

// ---- 4. who shoots: the fight beats give every bow and crossbow attack a ranged move
const hero = (wt) => ({ wt, list: [] });
const fight = (name, wt, log) => ({ e: { name }, hp0: 200, ehp0: 120, wt0: wt, wt, allies: [], log });
const meBeat = (f, wt) => F.beatsOf(f, hero(wt)).filter((b) => b.who === "me");
const foeBeat = (f) => F.beatsOf(f, hero("sword")).filter((b) => b.who === "them");
ok(meBeat(fight("Bandit outlaw", "bow", [{ me: "Attack: 20", them: "", hp: 200, ehp: 100, a: "attack", wt: "bow" }]), "bow")[0].move === "bow", "your bow shot is a ranged move");
ok(meBeat(fight("Bandit outlaw", "crossbow", [{ me: "Attack: 20", them: "", hp: 200, ehp: 100, a: "attack", wt: "crossbow" }]), "crossbow")[0].move === "crossbow", "your crossbow shot is a ranged move");
{ const b = meBeat(fight("Bandit outlaw", "bow", [{ me: "Power attack: 30 +fire", them: "", hp: 200, ehp: 90, a: "power_attack", wt: "bow" }]), "bow")[0]; ok(b.move === "bow" && b.power && b.enchant === "fire", "a power shot with a fire bow: bigger, with a fire trail"); }
{ const b = meBeat(fight("Bandit outlaw", "bow", [{ me: "Sneak attack ×3: 60", them: "", hp: 200, ehp: 60, a: "attack", wt: "bow" }]), "bow")[0]; ok(b.move === "bow" && b.sneak, "a sneak shot is a ranged move, marked as sneak"); }
{ const b = meBeat(fight("Bandit outlaw", "bow", [{ me: "Attack misses", them: "", hp: 200, ehp: 120, a: "attack", wt: "bow" }]), "bow")[0]; ok(b.move === "bow" && b.miss, "a missed shot still flies (past)"); }
for (const name of ["Bandit archer", "Forsworn hunter", "Falmer archer", "Draugr marksman", "Thalmor sniper", "Bandit bowman"]) {
  const b = foeBeat(fight(name, "sword", [{ me: "", them: `${name} hits 9`, hp: 191, ehp: 120 }]))[0];
  ok(b && b.move === "bow" && A.shotOf(F.MOVES[b.move]), `${name} shoots an arrow`);
  const mb = foeBeat(fight(name, "sword", [{ me: "", them: `${name} misses`, hp: 200, ehp: 120 }]))[0];
  ok(mb && mb.move === "bow" && mb.miss, `${name}'s miss flies past`);
}
{ const b = foeBeat(fight("Dwarven ballista", "sword", [{ me: "", them: "Dwarven ballista hits 19", hp: 181, ehp: 120 }]))[0]; ok(b && b.move === "crossbow" && b.ballista, "the Dwarven ballista fires a big bolt"); }
{ const b = foeBeat(fight("Imperial crossbowman", "sword", [{ me: "", them: "Imperial crossbowman hits 12", hp: 188, ehp: 120 }]))[0]; ok(b && b.move === "crossbow", "a crossbowman fires a bolt"); }
// followers and party members: a bow line plays the shoot clip, and fightart.js looses an arrow on its release
ok(c.ALLYANIM.anim({ allyActs: [{ name: "Aela", clip: "shoot" }] }, "Aela", 0.6, 0.5).shoot === true, "a follower's bow line plays the shoot clip");
const src = fs.readFileSync(W + "fightart.js", "utf8");
ok(/an\.shoot && an\.u >= 0\.55[\s\S]{0,400}AFX\.fire/.test(src), "fightart.js fires an arrow when a follower's shoot clip releases");
ok(/seatLift/.test(src) && /y0 = handY\(side\) - \(me \? seatLift : 0\)/.test(src), "shots leave from the saddle when you ride");

console.log(`${n - fails}/${n} move effect checks passed`);
if (fails) process.exit(1);
