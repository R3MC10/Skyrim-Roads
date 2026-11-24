/* Blood and gore in the fight picture [OURS]. Remigiusz: "combat should have gore, blood spills etc."
   fightart.js replays a fight; this file adds what the blows leave behind, in ink (or chunky pixels), never photoreal:
   - a spray from the struck figure, thrown away from the attacker, bigger for heavy blows and criticals;
     drops fly, land and leave splats on the ground that stay for the whole fight (every turn of a turn-by-turn fight);
     red ink streaks build up on a figure as its health drops; a red flash at the screen edges when you take a big hit.
   - every kind of blow looks different: slashes throw arcs, arrows stick in and burst, blunt blows splat and raise dust,
     fire scorches and chars (no blood), frost throws ice shards, lightning throws sparks, poison drips green,
     a bleeding wound keeps dripping.
   - every kind of creature: skeletons and draugr chip bone and dust, dwarven machines leak oil, spark and lose gears,
     spirits lose ectoplasm wisps, daedra bleed dark ichor, dragons splash big and dark red, Falmer and chaurus bleed green.
   - kills: a bigger burst and a pool spreading under the body; a strong finisher now and then knocks a helmet or a
     weapon flying, or takes a limb off a beast or a skeleton (ink silhouettes).
   - followers, party members and horses get hit effects too, but they are knocked down, never killed: no kill effects.
   Settings → Fights → Blood and gore: Off / Low / Full (prefs key "gore": false / "low" / true; default Full).
   Low = fewer particles, no flourishes and no beheading. Reduced motion and the Low lighting/Lite motion settings
   cut the particle count; Off draws nothing at all.
   In sync: every spray, splat and streak comes from a seeded random (the fight, the turn, the blow), never the phone's own dice,
   so the same blow looks the same on every phone in a shared fight. Purely visual: it never touches a result.
   Hooks (fightart.js): GORE.scene(o) per stage → S.hit(target, {dmg, frac, type, crit, power, final, from, key}),
   S.kill(target, opts), S.update(dt), S.drawGround(g), S.drawMarks(g, side, x, y, sc, hpFrac), S.drawFront(g).
   GORE.hit / GORE.kill go to the stage on screen, for other modules (combat camera, mounted fights). */
const GORE = (() => {
  const KEY = "rotn_prefs";
  const prefs = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  let lvlOver = null;   // tests
  function level() {
    if (lvlOver) return lvlOver;
    const v = prefs().gore;
    return v === false || v === "off" ? "off" : v === "low" ? "low" : "full";
  }
  function setLevel(v) {
    const p = prefs(); p.gore = v === "off" ? false : v === "low" ? "low" : true;
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
  }
  const on = () => level() !== "off";
  const full = () => level() === "full";
  function pref(k, v) { if (k !== "gore") return false; setLevel(v === "true" ? "full" : v === "false" ? "off" : v); return true; }
  const settingsHTML = (seg) => `<div class="setrow"><span>Blood and gore</span>${seg("gore", [["off", "Off"], ["low", "Low"], ["full", "Full"]], level())}</div>`;
  const sysReduce = () => { try { return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  /* how many particles this phone gets: the setting, reduced motion, and the Low graphics settings */
  function budget(o = {}) {
    const lv = o.level || level();
    if (lv === "off") return 0;
    let cap = lv === "low" ? 90 : 220;
    const lowGfx = o.lowGfx ?? ((typeof LIGHTFX !== "undefined" && LIGHTFX.level && LIGHTFX.level() !== "high") || (typeof MOTION !== "undefined" && MOTION.lite && MOTION.lite()));
    if (lowGfx) cap = Math.round(cap * 0.6);
    if (o.reduce ?? sysReduce()) cap = Math.round(cap * 0.5);
    return Math.max(24, cap);
  }
  const CAP_MAX = 220, SPL_MAX = 80;

  // ---------------------------------------------------------------- seeded random (the same on every phone)
  function hash(str) { let h = 2166136261 >>> 0; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed) { let a = (typeof seed === "number" ? seed : hash(seed)) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------------------------------------------------------------- what something is made of
  // [main colour, dark colour, kind]  kind: blood · bone · oil · spirit · ichor · essence
  const MAT = {
    blood: ["#8e1010", "#4a0606", "blood"], dragon: ["#6a0a0a", "#300303", "blood"], green: ["#7a9a2a", "#3e5214", "blood"],
    ichor: ["#3a1240", "#16061a", "ichor"], bone: ["#e8e0c8", "#a89e84", "bone"], oil: ["#1e1c16", "#3e3a2c", "oil"],
    spirit: ["#bfeee0", "#7fc8c0", "spirit"], essence: ["#ffb347", "#ff7a2a", "essence"],
  };
  const BLEEDS = new Set(["blood", "ichor"]);   // these leave red (or green, or black) drops; the rest never bleed
  /* the material from the foe's kind (fightart.foeOf) and name */
  function matOf(kind, name = "", tags = []) {
    const n = String(name || "").toLowerCase(), tg = new Set(tags || []);
    if (/ghost|spectral|spectre|wraith|shade|spirit|wisp|apparition/.test(n) || kind === "wisp") return "spirit";
    if (/dremora|daedr|seeker|lurker|xivilai|scamp|clannfear|spider daedra/.test(n) || kind === "sol_seeker" || kind === "sol_lurker") return "ichor";
    if (kind === "atronach" || /atronach/.test(n)) return "essence";
    if (["skeleton", "draugr", "lich"].includes(kind) || /skeleton|draugr|deathlord|wight|dragon priest|lich|bonewalker|boneman|mistman/.test(n) || tg.has("undead") && !/vampire|zombie|thrall|corpse/.test(n)) return "bone";
    if (["sphere", "centurion", "dspider"].includes(kind) || /dwarven|dwemer|centurion|sphere|construct|automaton/.test(n) || tg.has("construct")) return "oil";
    if (kind === "dragon" || tg.has("dragon")) return "dragon";
    if (kind === "falmer" || kind === "spider" || /falmer|chaurus|frostbite|spider/.test(n)) return "green";
    if (/ash spawn|ash hopper|spriggan/.test(n) || kind === "sol_spawn" || kind === "sol_spriggan") return "bone";   // ash and bark: dust and chips
    return "blood";
  }
  /* the kind of blow, from a fight beat (fightart.beatsOf) and its move */
  function typeOf(b, m = {}) {
    if (!b) return "slash";
    const el = b.el || (["fire", "frost", "shock"].includes(b.fx) ? b.fx : null);
    if (b.el === "poison" || b.fx === "poison" || b.poison) return "poison";
    if (el === "fire" || el === "frost" || el === "shock") return el;
    const pr = m.proj ? m.proj[2] : null;
    if (pr === "arrow" || pr === "bolt") return "pierce";
    if (b.fx === "fus" || pr === "wave") return "blunt";
    if (pr || b.move === "cast" || b.move === "drain") return "magic";
    const mfx = m.fx || "slash";
    if (mfx === "stab" || mfx === "bite" || mfx === "pierce") return "pierce";
    if (mfx === "dust" || mfx === "slam" || mfx === "punch" || mfx === "bash" || b.move === "stomp") return "blunt";
    return "slash";
  }
  /* what a blow of this type does to this material: a plan with the effects to spawn (pure, tested in node) */
  function effectOf(type, mat, o = {}) {
    const M = MAT[mat] || MAT.blood, kind = M[2], bleeds = BLEEDS.has(kind);
    const p = { blood: false, drops: 0, arc: false, arrow: false, dust: false, scorch: false, char: false, shards: false, sparks: false, green: false, chips: false, oil: false, gears: false, wisps: false, embers: false, heavy: false, glow: false };
    if (type === "fire") { p.scorch = true; p.char = true; p.embers = true; }   // fire sears: no blood, ever
    else if (type === "frost") { p.shards = true; if (bleeds) { p.blood = true; p.drops = 0.35; } }
    else if (type === "shock") { p.sparks = true; p.scorch = true; }
    else if (type === "magic") p.glow = true;
    else if (type === "poison") { p.green = true; if (bleeds) { p.blood = true; p.drops = 0.5; } }
    else {
      if (bleeds) { p.blood = true; p.drops = type === "blunt" ? 0.8 : type === "pierce" ? 0.6 : 1; }
      if (type === "slash") p.arc = true;
      if (type === "pierce" && o.arrow) p.arrow = true;
      if (type === "blunt") { p.dust = true; p.heavy = true; }
    }
    if (type !== "fire" && type !== "magic") {   // what comes out of things that don't bleed
      if (kind === "bone") { p.chips = true; p.dust = true; }
      if (kind === "oil") { p.oil = true; p.sparks = true; if (type === "blunt" || type === "slash" || o.crit) p.gears = true; }
      if (kind === "spirit") p.wisps = true;
      if (kind === "essence") { p.embers = true; p.sparks = true; }
    }
    if (o.ally) p.arrow = false;   // [OURS] arrows stay out of your friends: they get up again looking fine
    return p;
  }

  // ---------------------------------------------------------------- one stage's gore
  // particle kinds
  const DROP = 0, SPARK = 1, PUFF = 2, CHIP = 3, WISP = 4, SHARD = 5, GEAR = 6, EMBER = 7;
  const STAINS = new WeakMap();   // the fight → its stains, so splats stay for every turn of a turn-by-turn fight
  let active = null, vigEl = null, vigT = 0;
  function scene(o = {}) {
    const W = o.W || 400, Hh = o.H || 180, gy = o.groundY ?? Hh * 0.8, s = o.s || Hh / 150, pixel = !!o.pixel, rm = !!o.reduce;
    const lv = o.level || level(), CAP = Math.min(CAP_MAX, o.cap || budget({ level: lv, reduce: rm, lowGfx: o.lowGfx })), SPL = lv === "low" ? 32 : SPL_MAX;
    const fullOn = lv === "full", foeMat = o.mat || matOf(o.foeK, o.foeName, o.tags), seed0 = o.seed ?? hash(`${o.foeName || "foe"}|${o.ehpMax || 0}`);
    // particle pool (allocated once)
    const x = new Float32Array(CAP_MAX), y = new Float32Array(CAP_MAX), vx = new Float32Array(CAP_MAX), vy = new Float32Array(CAP_MAX), life = new Float32Array(CAP_MAX), max = new Float32Array(CAP_MAX),
      sz = new Float32Array(CAP_MAX), grav = new Float32Array(CAP_MAX), land = new Float32Array(CAP_MAX), rot = new Float32Array(CAP_MAX), vr = new Float32Array(CAP_MAX), typ = new Uint8Array(CAP_MAX), col = new Array(CAP_MAX).fill("#000");
    let cur = 0, alive = 0, spawned = 0;
    // stains on the ground: kept per fight
    const fightKey = o.fight && typeof o.fight === "object" ? o.fight : null;
    let st = fightKey && STAINS.get(fightKey);
    if (!st) { st = { spl: [], marks: { foe: mk(seed0, 1), hero: mk(seed0, 2), ally: mk(seed0, 3) } }; if (fightKey) STAINS.set(fightKey, st); }
    const spl = st.spl, flyers = [], status = { foe: {}, hero: {} };
    let dripT = 0, dripR = rng(seed0 ^ 0x5bd1e995), tSince = 0;
    function mk(sd, k) { const r = rng((sd ^ (k * 0x9e3779b1)) >>> 0), streaks = []; for (let i = 0; i < 6; i++) streaks.push([(r() - 0.5) * 14, -8 + r() * 22, 5 + r() * 9, r()]); return { streaks, arrows: [], char: 0, col: null }; }

    function spawn(t, c, px, py, pvx, pvy, l, size, g, ly) {
      if (lv === "off") return -1;
      let i = cur, n = 0; while (life[i] > 0 && n < CAP) { i = (i + 1) % CAP; n++; }
      if (n >= CAP) i = cur;   // full: the oldest goes
      cur = (i + 1) % CAP;
      x[i] = px; y[i] = py; vx[i] = pvx; vy[i] = pvy; life[i] = max[i] = l; sz[i] = size; grav[i] = g; land[i] = ly ?? gy; typ[i] = t; col[i] = c; rot[i] = 0; vr[i] = 0;
      spawned++; return i;
    }
    function stain(px, py, r, c, kind, a = 0.85, grow = 0) {   // kind 0 splat · 1 pool · 2 scorch · 3 oil
      if (lv === "off") return;
      if (spl.length >= SPL) { const j = spl.findIndex((q) => q.k !== 1); spl.splice(j < 0 ? 0 : j, 1); }   // pools stay; the oldest splat goes
      spl.push({ x: px / W, y: (py - gy) / s, r: r / s, c, k: kind, a, g: grow, rr: grow ? 0 : 1, e: 0.22 + (spl.length % 5) * 0.03 });
    }
    const tgtMat = (t) => (t.side === "foe" ? t.mat || foeMat : "blood");
    /* a blow lands on a target {side: foe|hero|ally|horse, x, y}: o = {dmg, frac, type, crit, power, final, from, key, arrow} */
    function hit(t, h = {}) {
      if (lv === "off" || !t) return null;
      const side = t.side || "foe", mat = tgtMat(t), M = MAT[mat] || MAT.blood;
      const type = h.type || "slash", plan = effectOf(type, mat, { arrow: !!h.arrow, crit: !!h.crit, ally: side === "ally" });
      const r = rng((seed0 ^ hash(`${h.key ?? spawned}|${side}|${type}`)) >>> 0), dir = h.from || (side === "foe" ? 1 : -1);
      const frac = Math.max(0, Math.min(1, h.frac ?? 0.1)), big = (h.crit ? 1.5 : 1) * (h.power ? 1.25 : 1) * (h.final ? 1.4 : 1);
      const scale = Math.min(2.6, (0.6 + frac * 3) * big) * (lv === "low" ? 0.45 : 1) * (rm ? 0.5 : 1) * (mat === "dragon" ? 1.4 : 1);
      const px = t.x, py = t.y, ground = t.ground ?? gy, S = s * (mat === "dragon" ? 1.5 : 1);
      if (plan.blood) {
        const n = Math.max(2, Math.round(14 * plan.drops * scale));
        for (let i = 0; i < n; i++) {
          let a;
          if (plan.arc) a = -Math.PI / 2 + dir * (0.15 + (i / n) * 1.35) + (r() - 0.5) * 0.25;   // a fan: the arc of the swing
          else if (plan.heavy) a = -Math.PI / 2 + dir * (0.3 + r() * 0.9);
          else a = Math.atan2(-0.35, dir) + (r() - 0.5) * 0.9;   // a short jet straight back
          const v = (plan.heavy ? 60 + r() * 70 : 80 + r() * 120) * s * (plan.arc ? 0.75 + i / n * 0.5 : 1);
          spawn(DROP, r() < 0.7 ? M[0] : M[1], px + (r() - 0.5) * 6 * s, py + (r() - 0.5) * 6 * s, Math.cos(a) * v, Math.sin(a) * v, 1.6, (plan.heavy ? 2.2 : 1.4) + r() * 1.4 * (mat === "dragon" ? 1.6 : 1), 440, ground + (r() - 0.3) * 7 * s);
        }
        if (plan.heavy) stain(px + dir * 10 * s, ground + 2 * s, (7 + r() * 5) * S * Math.min(1.6, scale), M[1], 0, 0.8);   // the splat right under the blow
      }
      if (plan.green) for (let i = 0, n = Math.max(2, Math.round(6 * scale)); i < n; i++) spawn(DROP, i & 1 ? "#7ec23a" : "#4a7a1a", px + (r() - 0.5) * 10 * s, py + r() * 8 * s, (r() - 0.5) * 30 * s, 10 * s, 1.4, 1.6, 300, ground + r() * 5 * s);
      if (plan.arrow && side === "foe") { const m = st.marks.foe; if (m.arrows.length >= 3) m.arrows.shift(); m.arrows.push([(r() - 0.5) * 10, -6 + r() * 16, -0.5 + r() * 0.6 + (dir > 0 ? Math.PI : 0)]); }
      if (plan.arrow) for (let i = 0; i < 4; i++) spawn(SPARK, "#e9dcc0", px, py, -dir * (40 + r() * 60) * s, (r() - 0.5) * 60 * s, 0.25, 1.4, 0);   // splinters
      if (plan.dust) for (let i = 0, n = Math.round(4 * Math.min(2, scale + 0.4)); i < n; i++) spawn(PUFF, plan.chips ? "#cfc6ae" : "#a8987a", px + (r() - 0.5) * 16 * s, plan.chips ? py : ground - 2 * s, (r() - 0.5) * 50 * s, -(10 + r() * 30) * s, 0.9, 4 + r() * 3, -10);
      if (plan.chips) for (let i = 0, n = Math.max(3, Math.round(9 * scale)); i < n; i++) { const a = -Math.PI / 2 + dir * (0.2 + r() * 1.2), v = (100 + r() * 150) * s, j = spawn(CHIP, r() < 0.6 ? M[0] : M[1], px, py, Math.cos(a) * v, Math.sin(a) * v, 1.3, 1.6 + r() * 1.8, 460, ground + r() * 6 * s); if (j >= 0) vr[j] = (r() - 0.5) * 18; }
      if (plan.oil) { for (let i = 0, n = Math.max(2, Math.round(8 * scale)); i < n; i++) { const a = Math.atan2(-0.4, dir) + (r() - 0.5) * 1.1, v = (80 + r() * 120) * s; spawn(DROP, r() < 0.6 ? M[0] : M[1], px, py, Math.cos(a) * v, Math.sin(a) * v, 1.6, 1.8 + r() * 1.4, 420, ground + r() * 6 * s); } }
      if (plan.gears && fullOn) for (let i = 0, n = h.crit || h.final ? 2 : 1; i < n; i++) { const j = spawn(GEAR, i ? "#c9a24c" : "#8a6a32", px, py, dir * (60 + r() * 80) * s, -(120 + r() * 80) * s, 1.8, 2.6 + r() * 1.6, 420, ground + r() * 4 * s); if (j >= 0) vr[j] = (r() - 0.5) * 14; }
      if (plan.sparks) for (let i = 0, n = Math.round(8 * Math.min(2, scale + 0.3)); i < n; i++) { const a = r() * 6.283, v = (140 + r() * 200) * s; spawn(SPARK, r() < 0.5 ? (type === "shock" ? "#d8d0ff" : "#ffe08a") : "#ffffff", px, py, Math.cos(a) * v, Math.sin(a) * v, 0.3, 1.6, type === "shock" ? 0 : 300); }
      if (plan.shards) for (let i = 0, n = Math.max(3, Math.round(8 * scale)); i < n; i++) { const a = -Math.PI / 2 + dir * (0.1 + r() * 1.4), v = (120 + r() * 160) * s, j = spawn(SHARD, r() < 0.5 ? "#e8f8ff" : "#9fd4f4", px, py, Math.cos(a) * v, Math.sin(a) * v, 1.1, 2 + r() * 2, 420, ground + r() * 5 * s); if (j >= 0) vr[j] = (r() - 0.5) * 16; }
      if (plan.wisps) for (let i = 0, n = Math.max(3, Math.round(7 * scale)); i < n; i++) spawn(WISP, r() < 0.5 ? M[0] : M[1], px + (r() - 0.5) * 12 * s, py + (r() - 0.5) * 12 * s, dir * (10 + r() * 30) * s, -(20 + r() * 40) * s, 1.3 + r() * 0.6, 3 + r() * 3, -12);
      if (plan.embers) for (let i = 0, n = Math.max(3, Math.round(7 * scale)); i < n; i++) spawn(EMBER, r() < 0.5 ? "#ff7a2a" : "#ffd27a", px + (r() - 0.5) * 16 * s, py + (r() - 0.5) * 14 * s, (r() - 0.5) * 30 * s, -(30 + r() * 40) * s, 0.9 + r() * 0.5, 1.6, -20);
      if (plan.scorch) { stain(px + (r() - 0.5) * 10 * s, ground + 2 * s, (type === "fire" ? 9 : 5) * S * Math.min(1.5, 0.7 + scale * 0.4), "#1c1712", 2, type === "fire" ? 0.6 : 0.4); }
      if (plan.char) { const m = st.marks[side === "foe" ? "foe" : side === "ally" ? "ally" : "hero"]; m.char = Math.min(1, m.char + 0.25 * Math.min(2, scale)); }
      const m = st.marks[side === "foe" ? "foe" : side === "ally" ? "ally" : "hero"];
      if ((plan.blood || plan.oil) && !m.col) m.col = M[1];
      if (side === "hero" && (frac >= 0.16 || h.final || (h.crit && frac >= 0.08))) vignette(Math.min(1, 0.45 + frac * 1.8), t.live !== false);
      return plan;
    }
    /* the killing blow: a bigger burst, a pool under the body, sometimes a flourish. Foes only. */
    function kill(t, k = {}) {
      if (lv === "off" || !t || (t.side && t.side !== "foe")) return null;   // followers, party members and horses get knocked down, never killed
      const mat = tgtMat(t), M = MAT[mat] || MAT.blood, kind = M[2], r = rng((seed0 ^ hash(`kill|${k.key ?? 0}|${k.death || ""}`)) >>> 0);
      const death = k.death || "topple", dir = k.from || 1, size = t.size || 1, ground = t.ground ?? gy, bx = t.bodyX ?? t.x;
      const res = { burst: false, pool: false, flourish: null };
      if (!k.instant && death !== "ash" && death !== "shatter" && death !== "fade") { hit(t, { type: k.type || "slash", frac: 0.6, final: true, crit: !!k.crit, power: !!k.power, from: dir, key: `kill${k.key ?? 0}` }); res.burst = true; }
      if ((BLEEDS.has(kind) || kind === "oil") && !["ash", "shatter", "fade"].includes(death) && k.type !== "fire") {
        stain(bx, ground + 1.5 * s, (16 + r() * 4) * s * Math.min(1.8, size) * (mat === "dragon" ? 1.6 : 1), kind === "oil" ? "#141210" : M[1], 1, 0.78, k.instant ? 0 : 1.4);
        if (k.instant) spl[spl.length - 1].rr = 1;
        res.pool = true;
      } else if (kind === "bone" && death !== "fade") { stain(bx, ground + 1.5 * s, 12 * s * Math.min(1.6, size), "#cfc6ae", 0, 0.35); }   // a little heap of grave dust
      const strong = k.crit || k.power || k.slowmo || k.boss;
      if (fullOn && strong && !k.instant && death !== "decap" && death !== "ash" && death !== "shatter" && death !== "fade" && r() < (k.boss ? 0.8 : 0.55)) {
        const shape = kind === "oil" ? "plate" : kind === "spirit" || kind === "essence" ? null : kind === "bone" ? "bone" : t.person ? (r() < 0.5 ? "helm" : "blade") : "limb";
        if (shape) { flyers.push({ shape, x: t.x, y: t.y - 10 * s * size, vx: dir * (70 + r() * 60) * s, vy: -(150 + r() * 70) * s, rot: 0, vr: dir * (6 + r() * 6), ly: ground + 2 * s, c: shape === "limb" ? (mat === "dragon" ? "#3e3430" : "#6a5440") : shape === "bone" ? M[0] : shape === "plate" ? "#b8893e" : shape === "helm" ? "#8a8e94" : "#c8ccd4", blood: BLEEDS.has(kind) ? M[1] : null, t: 0 }); res.flourish = shape; if (flyers.length > 3) flyers.shift(); }
      }
      return res;
    }
    /* the neck sprays as a beheaded body goes down (fightart's "decap" death) */
    function spurt(px, py, key) {
      if (lv === "off") return;
      const M = MAT[foeMat] || MAT.blood; if (!BLEEDS.has(M[2])) return;
      const r = rng((seed0 ^ hash(`spurt|${key}`)) >>> 0);
      const a = -Math.PI / 2 + (r() - 0.5) * 0.8, v = (120 + r() * 120) * s;
      spawn(DROP, r() < 0.6 ? M[0] : M[1], px, py, Math.cos(a) * v, Math.sin(a) * v, 1.5, 1.6 + r(), 440, gy + r() * 6 * s);
    }
    /* statuses from the fight log line on show: bleeding keeps dripping, poison drips green */
    function statusOf(line) {
      const me = String(line?.me || ""), them = String(line?.them || "");
      status.foe.bleed = /\bbleeds \d/.test(me); status.hero.bleed = /\byou bleed \d/i.test(me + " " + them);
      status.foe.poison = /poison/i.test(me) && !/you('re| are)? poisoned/i.test(me); status.hero.poison = /you('re| are)? poisoned/i.test(me + " " + them);
    }
    let posFoe = null, posHero = null;
    function update(dt) {
      if (lv === "off") return;
      tSince += dt;
      for (const q of spl) if (q.rr < 1) q.rr = Math.min(1, q.rr + dt / (q.g || 1));
      alive = 0;
      for (let i = 0; i < CAP; i++) {
        if (life[i] <= 0) continue;
        alive++; life[i] -= dt;
        const t = typ[i];
        if (t === WISP) { x[i] += vx[i] * dt + Math.sin((life[i] + i) * 5) * 0.4; y[i] += vy[i] * dt; vx[i] *= 0.97; continue; }
        vy[i] += grav[i] * s * dt; const dr = t === PUFF ? 0.95 : 0.99; vx[i] *= dr; vy[i] *= dr;
        x[i] += vx[i] * dt; y[i] += vy[i] * dt; rot[i] += vr[i] * dt;
        if (t === PUFF) sz[i] += dt * 5;
        if ((t === DROP || t === CHIP || t === SHARD || t === GEAR) && vy[i] > 0 && y[i] >= land[i]) {   // it lands
          if (t === DROP) { stain(x[i], land[i], sz[i] * s * (1.1 + Math.min(1.4, Math.abs(vx[i]) / (200 * s))), col[i], col[i] === MAT.oil[0] || col[i] === MAT.oil[1] ? 3 : 0, 0.82); life[i] = 0; }
          else { y[i] = land[i]; vy[i] = 0; vx[i] *= 0.3; vr[i] = 0; grav[i] = 0; life[i] = Math.min(life[i], 0.6); }
        }
      }
      for (const fl of flyers) {
        fl.t += dt; if (fl.y >= fl.ly && fl.vy > 0) { fl.y = fl.ly; fl.vy = 0; fl.vx *= 0.2; fl.vr = 0; if (!fl.landed) { fl.landed = true; if (fl.blood) stain(fl.x, fl.ly + 1 * s, 6 * s, fl.blood, 0, 0.8); } }
        else { fl.vy += 420 * s * dt; fl.x += fl.vx * dt; fl.y += fl.vy * dt; fl.rot += fl.vr * dt; }
      }
      // bleeding and poison: a slow, steady drip from the wound (seeded stream)
      dripT += dt;
      if (dripT > 0.28) {
        dripT = 0;
        for (const [side, pos] of [["foe", posFoe], ["hero", posHero]]) {
          if (!pos) continue; const S2 = status[side];
          if (S2.bleed && (side === "hero" || BLEEDS.has((MAT[foeMat] || MAT.blood)[2]))) { const M = side === "hero" ? MAT.blood : MAT[foeMat] || MAT.blood; spawn(DROP, M[0], pos[0] + (dripR() - 0.5) * 12 * s, pos[1] + dripR() * 14 * s, (dripR() - 0.5) * 6 * s, 0, 1.4, 1.3, 260, gy + dripR() * 5 * s); }
          if (S2.poison) spawn(DROP, dripR() < 0.5 ? "#7ec23a" : "#4a7a1a", pos[0] + (dripR() - 0.5) * 12 * s, pos[1] + dripR() * 14 * s, 0, 0, 1.4, 1.2, 240, gy + dripR() * 5 * s);
        }
      }
    }
    /* drop everything in the air (Skip): what has landed stays */
    function settle() { for (let i = 0; i < CAP; i++) life[i] = 0; alive = 0; for (const fl of flyers) { fl.y = fl.ly; fl.vy = 0; fl.vr = 0; fl.landed = true; } for (const q of spl) q.rr = 1; }
    function clear() { settle(); spl.length = 0; flyers.length = 0; for (const k of Object.keys(st.marks)) { st.marks[k].arrows.length = 0; st.marks[k].char = 0; st.marks[k].col = null; } }

    // ---------------------------------------------------------------- drawing (world coordinates, under the fight camera)
    const snap = (v) => (pixel ? Math.round(v / 3) * 3 : v);
    function drawGround(g) {
      if (lv === "off" || !spl.length) return;
      g.save();
      for (const q of spl) {
        const rr = q.r * s * (q.k === 1 ? 0.25 + 0.75 * q.rr : 1), cx = q.x * W, cy = gy + q.y * s;
        g.globalAlpha = q.a * (q.k === 1 ? 0.5 + 0.5 * q.rr : 1); g.fillStyle = q.c;
        if (pixel) { const w = Math.max(3, snap(rr * 2)), hh = Math.max(3, snap(rr * 0.7)); g.fillRect(snap(cx - w / 2), snap(cy - hh / 2), w, hh); continue; }
        g.beginPath(); g.ellipse(cx, cy, rr, Math.max(0.8, rr * (q.k === 1 ? 0.3 : q.e)), 0, 0, 6.283); g.fill();
        if (q.k === 3) { g.globalAlpha = q.a * 0.45; g.fillStyle = "#a89c78"; g.beginPath(); g.ellipse(cx - rr * 0.25, cy - rr * 0.05, rr * 0.35, Math.max(0.5, rr * 0.06), 0, 0, 6.283); g.fill(); }   // oil shines
        else if (q.k === 2) { g.globalAlpha = q.a * 0.4; g.strokeStyle = "#3a2a1a"; g.lineWidth = 1; g.stroke(); }   // a ring of soot round a scorch
        else if (q.k === 0 && rr > 3 * s) {   // ink splat: a couple of satellite drops
          g.beginPath(); g.ellipse(cx + rr * 1.15, cy - rr * 0.05, rr * 0.22, rr * 0.08, 0, 0, 6.283); g.ellipse(cx - rr * 0.95, cy + rr * 0.06, rr * 0.16, rr * 0.06, 0, 0, 6.283); g.fill();
        } else if (q.k === 1) { g.globalAlpha *= 0.5; g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.ellipse(cx - rr * 0.3, cy - rr * 0.06, rr * 0.25, rr * 0.05, 0, 0, 6.283); g.fill(); }   // a shine on the pool
      }
      g.restore();
    }
    /* the marks on a figure: red streaks that build up as health drops, stuck arrows, char */
    function drawMarks(g, side, fx, fy, sc, hpFrac, hidden) {
      if (side === "foe") posFoe = hidden ? null : [fx, fy]; else if (side === "hero") posHero = hidden ? null : [fx, fy];
      if (lv === "off" || hidden) return;
      const m = st.marks[side]; if (!m) return;
      const mat = side === "foe" ? foeMat : "blood", M = MAT[mat] || MAT.blood, bleeds = BLEEDS.has(M[2]) || M[2] === "oil";
      const hurt = 1 - Math.max(0, Math.min(1, hpFrac ?? 1)), n = bleeds && m.col ? Math.min(m.streaks.length, Math.floor(hurt * 7) - (lv === "low" ? 1 : 0)) : 0;
      if (n <= 0 && !m.arrows.length && m.char <= 0) return;
      g.save(); g.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const [dx, dy, len, w] = m.streaks[i], X = fx + dx * sc, Y = fy + dy * sc;
        g.globalAlpha = 0.85; g.strokeStyle = i % 2 ? M[1] : M[0]; g.fillStyle = g.strokeStyle;
        if (pixel) { g.fillRect(snap(X), snap(Y), 3, Math.max(3, snap(len * sc))); continue; }
        g.lineWidth = Math.max(1, (1.1 + w) * sc * 0.7); g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(X + (w - 0.5) * 2 * sc, Y + len * sc * 0.5, X, Y + len * sc); g.stroke();
        g.beginPath(); g.arc(X, Y + len * sc, Math.max(1, 1.3 * sc * 0.7), 0, 6.283); g.fill();   // the drop at the end of the run
      }
      for (const [dx, dy, a] of m.arrows) {   // arrows stuck in it
        const X = fx + dx * sc, Y = fy + dy * sc, L = 17 * sc, ex = X + Math.cos(a) * L, ey = Y + Math.sin(a) * L;
        g.globalAlpha = 1; g.strokeStyle = "#8a6a40"; g.lineWidth = Math.max(pixel ? 3 : 1.2, 1.6 * sc * 0.6); g.beginPath(); g.moveTo(X, Y); g.lineTo(ex, ey); g.stroke();
        g.fillStyle = "#f2ead6"; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + Math.cos(a + 0.5) * 4 * sc, ey + Math.sin(a + 0.5) * 4 * sc); g.lineTo(ex + Math.cos(a) * 3 * sc, ey + Math.sin(a) * 3 * sc); g.lineTo(ex + Math.cos(a - 0.5) * 4 * sc, ey + Math.sin(a - 0.5) * 4 * sc); g.closePath(); g.fill();   // fletching
        if (bleeds && side === "foe") { g.fillStyle = M[1]; g.beginPath(); g.arc(X, Y, 1.4 * sc, 0, 6.283); g.fill(); }
      }
      if (m.char > 0) { g.globalAlpha = 0.45 * m.char; g.fillStyle = "#1c1712"; for (let i = 0; i < 3; i++) { const [dx, dy] = m.streaks[5 - i]; g.beginPath(); g.ellipse(fx + dx * sc, fy + dy * sc * 0.6, 4 * sc, 2.4 * sc, 0.4 * i, 0, 6.283); g.fill(); } }
      g.restore();
    }
    function drawFlyer(g, fl) {
      g.save(); g.translate(fl.x, fl.y); g.rotate(fl.rot); const k = s;
      g.fillStyle = fl.c; g.strokeStyle = "#1c1712"; g.lineWidth = Math.max(pixel ? 3 : 1, 1.1 * k);
      g.beginPath();
      if (fl.shape === "helm") { g.arc(0, 0, 5 * k, Math.PI, 0); g.lineTo(5 * k, 1.5 * k); g.lineTo(-5 * k, 1.5 * k); g.closePath(); }
      else if (fl.shape === "blade") { g.rect(-9 * k, -0.9 * k, 13 * k, 1.8 * k); g.rect(4 * k, -2.6 * k, 1.4 * k, 5.2 * k); }
      else if (fl.shape === "bone") { g.rect(-6 * k, -1 * k, 12 * k, 2 * k); g.arc(-6 * k, -1.3 * k, 1.5 * k, 0, 6.283); g.arc(-6 * k, 1.3 * k, 1.5 * k, 0, 6.283); g.arc(6 * k, -1.3 * k, 1.5 * k, 0, 6.283); g.arc(6 * k, 1.3 * k, 1.5 * k, 0, 6.283); }
      else if (fl.shape === "plate") { g.moveTo(-5 * k, -3 * k); g.lineTo(5 * k, -4 * k); g.lineTo(6 * k, 3 * k); g.lineTo(-4 * k, 4 * k); g.closePath(); }
      else { g.moveTo(-8 * k, -2.2 * k); g.quadraticCurveTo(0, -4 * k, 7 * k, -1.6 * k); g.lineTo(9 * k, 2.6 * k); g.lineTo(6 * k, 2.6 * k); g.quadraticCurveTo(0, 1.4 * k, -8 * k, 2.4 * k); g.closePath(); }   // a leg
      g.fill(); g.stroke();
      if (fl.blood && (fl.shape === "limb")) { g.fillStyle = fl.blood; g.beginPath(); g.ellipse(-8 * k, 0, 1.4 * k, 2.4 * k, 0, 0, 6.283); g.fill(); }
      g.restore();
    }
    function drawFront(g) {
      if (lv === "off") return;
      for (const fl of flyers) drawFlyer(g, fl);
      if (!alive) return;
      g.save();
      for (let i = 0; i < CAP; i++) {
        if (life[i] <= 0) continue;
        const t = typ[i], a = Math.max(0, Math.min(1, life[i] / max[i] * 1.6)), r = sz[i] * s;
        g.globalAlpha = t === PUFF ? a * 0.4 : t === WISP ? a * 0.55 : a; g.fillStyle = col[i];
        if (pixel) { const q = Math.max(3, snap(r * 1.4)); g.fillRect(snap(x[i]), snap(y[i]), q, q); continue; }
        if (t === DROP) {   // a drop stretches along its flight: ink spray
          const sp = Math.hypot(vx[i], vy[i]); g.strokeStyle = col[i]; g.lineCap = "round";
          if (sp > 60 * s) { g.lineWidth = Math.max(1, r); g.beginPath(); g.moveTo(x[i], y[i]); g.lineTo(x[i] - vx[i] * 0.025, y[i] - vy[i] * 0.025); g.stroke(); }
          else { g.beginPath(); g.arc(x[i], y[i], Math.max(0.8, r * 0.6), 0, 6.283); g.fill(); }
        } else if (t === SPARK) { g.strokeStyle = col[i]; g.lineWidth = Math.max(1, r * 0.6); g.beginPath(); g.moveTo(x[i], y[i]); g.lineTo(x[i] - vx[i] * 0.03, y[i] - vy[i] * 0.03); g.stroke(); }
        else if (t === PUFF || t === WISP || t === EMBER) { g.beginPath(); g.arc(x[i], y[i], t === EMBER ? Math.max(1, r * 0.7) : r, 0, 6.283); g.fill(); }
        else if (t === GEAR) { g.save(); g.translate(x[i], y[i]); g.rotate(rot[i]); g.strokeStyle = col[i]; g.lineWidth = Math.max(1, r * 0.45); g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.stroke(); for (let k2 = 0; k2 < 6; k2++) { const an = k2 * 1.047; g.fillRect(Math.cos(an) * r - r * 0.2, Math.sin(an) * r - r * 0.2, r * 0.4, r * 0.4); } g.restore(); }
        else { g.save(); g.translate(x[i], y[i]); g.rotate(rot[i]); g.beginPath(); if (t === SHARD) { g.moveTo(0, -r); g.lineTo(r * 0.45, r * 0.6); g.lineTo(-r * 0.45, r * 0.6); } else { g.moveTo(-r * 0.6, -r * 0.4); g.lineTo(r * 0.6, -r * 0.2); g.lineTo(r * 0.3, r * 0.5); g.lineTo(-r * 0.5, r * 0.3); } g.closePath(); g.fill(); g.restore(); }
      }
      g.restore();
    }
    const S = {
      hit, kill, spurt, statusOf, update, settle, clear, drawGround, drawMarks, drawFront,
      level: lv, mat: foeMat, cap: CAP,
      count: () => { let n = 0; for (let i = 0; i < CAP; i++) if (life[i] > 0) n++; return n; },
      stains: () => spl.length, flyers: () => flyers.map((f) => f.shape), marks: (side) => st.marks[side],
      snapshot: () => { const out = []; for (let i = 0; i < CAP; i++) if (life[i] > 0) out.push([typ[i], col[i], +x[i].toFixed(3), +y[i].toFixed(3), +vx[i].toFixed(3), +vy[i].toFixed(3)]); return JSON.stringify([out, spl, flyers]); },
      activate() { active = S; return S; },
    };
    active = S;
    return S;
  }
  /* for other modules (combat camera, mounted fights): add to the stage on screen */
  const hit = (target, o) => (active ? active.hit(target, o) : null);
  const kill = (target, o) => (active ? active.kill(target, o) : null);
  /* a red flash round the edges of the screen when you take a big hit */
  function vignette(k = 0.6, live = true) {
    if (!live || typeof document === "undefined" || !document.body || level() === "off" || sysReduce()) return;
    if (typeof navigator !== "undefined" && navigator.webdriver && !/[?&]fightanim/.test(location.search || "")) return;
    const now = Date.now(); if (now - vigT < 350) return; vigT = now;
    if (!vigEl || !vigEl.isConnected) { vigEl = document.createElement("div"); vigEl.className = "gorevig"; vigEl.setAttribute("aria-hidden", "true"); document.body.appendChild(vigEl); }
    vigEl.style.setProperty("--gv", String(Math.max(0.25, Math.min(1, k)) * (level() === "low" ? 0.6 : 1)));
    vigEl.classList.remove("on"); void vigEl.offsetWidth; vigEl.classList.add("on");
  }
  function clearAll() { if (active) active.clear(); active = null; if (vigEl) vigEl.classList.remove("on"); }
  return { level, setLevel, on, full, pref, settingsHTML, budget, hash, rng, MAT, matOf, typeOf, effectOf, scene, hit, kill, vignette, clearAll, _setLevel: (v) => { lvlOver = v; } };
})();
if (typeof module !== "undefined") module.exports = GORE;
