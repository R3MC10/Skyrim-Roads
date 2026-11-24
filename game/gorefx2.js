/* Realistic splatter on top of gore.js [OURS]. Remigiusz: "The gore should be realistic. Splattering."
   gore.js keeps its ink drops, streaks and pools; this file adds rendered effect sprites (scripts/make_gfx.py →
   gfx-*.webp, listed in assets.js) to the same stage:
   - blows spray a rendered blood burst thrown away from the attacker, bigger with the damage; criticals and finishing
     blows add a directional jet, a wider splash, a splatter on the ground and a smear on the foe that fade over the fight.
   - blunt blows raise dust and spill less blood; skeletons and draugr throw grave dust and bone chips, never red blood;
     Dwemer machines spit oil and sparks; Falmer and chaurus bleed green, daedra dark ichor.
   - frost throws ice shards, fire throws embers, lightning crackles, other magic leaves motes; metal on metal sparks.
   - followers, party members and horses bleed a little but are never splattered on the body and never lose a limb.
   Settings → Blood and gore: Off = nothing; Low = only the dust, sparks and spell effects (no rendered blood);
   Full = all of it. Reduced motion and the Lite graphics settings halve how many sprites play at once.
   Seeded from the blow like gore.js, so every phone in a shared fight sees the same splash.
   Hook: GORE.scene() is wrapped here, so fightart.js needs no change; the sprites draw in the same calls
   (drawGround → decals, drawMarks → smears on the figure, drawFront → bursts). Missing pictures: nothing extra is drawn.
   Quality: a sprite is never drawn bigger than 1.15x its own pixels (the canvas scale and DPR counted). */
const GOREFX2 = (() => {
  // key → [frames, frame w, frame h, origin x, origin y, seconds, additive]
  const SH = {
    b1: ["gfx-blood-burst-1", 10, 256, 256, 0.32, 0.55, 0.62, 0], b2: ["gfx-blood-burst-2", 10, 256, 256, 0.32, 0.55, 0.62, 0],
    b3: ["gfx-blood-burst-3", 12, 256, 256, 0.4, 0.5, 0.75, 0], jet: ["gfx-blood-spray", 8, 256, 256, 0.12, 0.45, 0.5, 0],
    oil: ["gfx-oil-burst", 10, 192, 192, 0.32, 0.55, 0.62, 0], green: ["gfx-green-burst", 10, 192, 192, 0.32, 0.55, 0.62, 0],
    ichor: ["gfx-ichor-burst", 10, 192, 192, 0.32, 0.55, 0.62, 0],
    dust: ["gfx-dust", 10, 192, 192, 0.5, 0.72, 0.8, 0], bone: ["gfx-bonedust", 10, 192, 192, 0.5, 0.7, 0.8, 0],
    sparks: ["gfx-sparks", 8, 160, 160, 0.5, 0.5, 0.4, 1], frost: ["gfx-frost", 10, 192, 192, 0.4, 0.5, 0.65, 0],
    embers: ["gfx-embers", 10, 192, 192, 0.5, 0.6, 0.9, 1], shock: ["gfx-shock", 8, 192, 192, 0.5, 0.5, 0.42, 1],
    motes: ["gfx-motes", 10, 192, 192, 0.5, 0.5, 0.85, 1],
  };
  const DEC = { blood: ["gfx-blood-decals", 384], oil: ["gfx-oil-decals", 128] };   // 4×2 atlases: 0,1,4,7 splats · 2,5 pools · 3,6 sprays
  const KEYS = Object.values(SH).map((v) => v[0]).concat(Object.values(DEC).map((v) => v[0]));
  const BLEED = { blood: ["b1", "b2"], dragon: ["b1", "b2"], green: ["green"], ichor: ["ichor"] };
  const img = (k) => (typeof ASSETS !== "undefined" && ASSETS.img ? ASSETS.img(k) : null);
  const G = () => (typeof GORE !== "undefined" ? GORE : null);
  const ARMOUR = /bandit|soldier|guard|legion|stormcloak|imperial|thalmor|knight|warlord|chief|mercenar|dremora|dawnguard|vigilant|orc|sellsword|marauder/i;   // a blade on plate throws sparks

  /* what a blow shows: a list of [sheet, size (world units × s), angle jitter] — pure, tested in node */
  function planOf(type, mat, o = {}) {
    const lv = o.level || "full", full = lv === "full", out = [], side = o.side || "foe", ally = side !== "foe" && side !== "hero";
    const frac = Math.max(0, Math.min(1, o.frac ?? 0.1)), big = (o.crit ? 1.35 : 1) * (o.final ? 1.5 : 1) * (o.power ? 1.15 : 1);
    const k = Math.min(2.4, (0.55 + frac * 2.4) * big) * (mat === "dragon" ? 1.35 : 1) * (ally ? 0.6 : 1);
    const bleeds = !!BLEED[mat], strong = !!(o.crit || o.final);
    if (type === "fire") out.push(["embers", 62 * k]);
    else if (type === "frost") out.push(["frost", 62 * k]);
    else if (type === "shock") out.push(["shock", 64 * k]);
    else if (type === "magic") out.push(["motes", 56 * k]);
    else if (type === "poison") out.push(["green", 44 * k]);
    const phys = !["fire", "magic", "shock"].includes(type);
    if (phys && full && bleeds && type !== "poison") {
      const sheets = BLEED[mat], blunt = type === "blunt";
      out.push([sheets[(o.pick || 0) % sheets.length], (blunt ? 48 : 64) * k * (type === "frost" ? 0.6 : 1)]);
      if (strong && type !== "frost") { out.push([mat === "blood" || mat === "dragon" ? "jet" : sheets[0], 70 * k]); if (o.final || blunt) out.push([mat === "blood" || mat === "dragon" ? "b3" : sheets[0], 74 * k]); }
    }
    if (phys && mat === "bone") out.push(["bone", 60 * k]);
    if (phys && mat === "oil") { if (full) out.push(["oil", 56 * k]); out.push(["sparks", 50 * k]); }
    if (phys && type === "blunt" && mat !== "bone") out.push(["dust", 58 * k]);
    if (phys && (mat === "essence" || mat === "spirit")) out.push([mat === "essence" ? "embers" : "motes", 56 * k]);
    if (o.metal && phys && type !== "blunt" && mat !== "oil") out.push(["sparks", 40 * k]);
    return out;
  }
  /* does this blow leave a splatter on the ground / a smear on the figure? (pure) */
  function decalOf(type, mat, o = {}) {
    if ((o.level || "full") !== "full" || ["fire", "magic", "shock"].includes(type)) return { ground: 0, body: false };
    const liquid = BLEED[mat] ? "blood" : mat === "oil" ? "oil" : null;
    if (!liquid) return { ground: 0, body: false };
    const strong = o.crit || o.final, ally = o.side && o.side !== "foe" && o.side !== "hero";
    return { liquid, ground: o.final ? 2 : strong || type === "blunt" || (o.frac || 0) >= 0.22 ? 1 : 0, body: !ally && (strong || (o.frac || 0) >= 0.18) };
  }

  const DECALS = new WeakMap();   // the fight → its splatters (turn-by-turn fights keep them turn to turn)
  const GROUND_MAX = 14, BODY_MAX = 6, GROUND_LIFE = 45, BODY_LIFE = 16;

  function wrap(S, o = {}) {
    const g0 = G();
    if (!S || S.fx2 || !g0) return S;
    const lv = S.level || g0.level();
    S.fx2 = true;
    if (lv === "off") return S;
    for (const k of KEYS) img(k);   // ask for the pictures now
    const W = o.W || 400, Hh = o.H || 180, gy = o.groundY ?? Hh * 0.8, s = o.s || Hh / 150, rm = !!o.reduce;
    const lowGfx = o.lowGfx ?? ((typeof LIGHTFX !== "undefined" && LIGHTFX.level && LIGHTFX.level() !== "high") || (typeof MOTION !== "undefined" && MOTION.lite && MOTION.lite()));
    const CAP = Math.max(6, Math.round((lv === "full" ? 24 : 12) * (lowGfx ? 0.6 : 1) * (rm ? 0.5 : 1)));
    // sprite pool (allocated once per stage)
    const P = []; for (let i = 0; i < CAP; i++) P.push({ on: false, sh: null, x: 0, y: 0, w: 0, rot: 0, flip: 1, t: 0, dur: 1, a: 1 });
    let cur = 0, live = 0;
    const fk = o.fight && typeof o.fight === "object" ? o.fight : null;
    let D = fk && DECALS.get(fk);
    if (!D) { D = { ground: [], body: [] }; if (fk) DECALS.set(fk, D); }
    const seed0 = (o.seed ?? g0.hash(`${o.foeName || "foe"}|${o.ehpMax || 0}|fx2`)) >>> 0;
    const pos = { foe: null, hero: null };

    function play(key, x, y, size, dir, r, alpha = 1) {
      const sh = SH[key]; if (!sh) return;
      let p = null;
      for (let n = 0; n < CAP; n++) { const q = P[(cur + n) % CAP]; if (!q.on) { p = q; cur = (cur + n + 1) % CAP; break; } }
      if (!p) { p = P[cur]; cur = (cur + 1) % CAP; }   // full: the oldest goes
      p.on = true; p.sh = sh; p.x = x; p.y = y; p.w = size * s; p.flip = dir < 0 ? -1 : 1;
      p.rot = (r() - 0.5) * (sh[7] ? 3.14 : 0.35); p.t = 0; p.dur = sh[6] * (0.9 + r() * 0.2); p.a = alpha;
    }
    function decal(liq, x, y, w, r, kind) {   // kind: 0 splat · 1 pool · 2 spray
      const L = D.ground; if (L.length >= GROUND_MAX) L.shift();
      const cells = kind === 1 ? [2, 5] : kind === 2 ? [3, 6] : [0, 1, 4, 7];
      L.push({ liq, cell: cells[(r() * cells.length) | 0], x: x / W, y: (y - gy) / s, w: w / s, age: 0, flip: r() < 0.5 ? -1 : 1, grow: kind === 1 ? 0 : 1 });
    }
    function smear(side, liq, r, dir) {
      if (side !== "foe" && side !== "hero") return;
      const L = D.body; if (L.length >= BODY_MAX) L.shift();
      L.push({ side, liq, cell: [3, 6, 0][(r() * 3) | 0], dx: (r() - 0.5) * 12, dy: -6 + r() * 16, w: 13 + r() * 9, rot: (r() - 0.5) * 1.2 + (dir < 0 ? Math.PI : 0), age: 0 });
    }
    const matOf = (t) => (t.side === "foe" || !t.side ? t.mat || S.mat : "blood");

    const oHit = S.hit;
    S.hit = function (t, h = {}) {
      const plan = oHit.call(S, t, h);
      if (plan && t) onHit(t, h);
      return plan;
    };
    function onHit(t, h, extra = 1) {
      const side = t.side || "foe", mat = matOf(t), type = h.type || "slash", dir = h.from || (side === "foe" ? 1 : -1);
      const r = g0.rng((seed0 ^ g0.hash(`${h.key ?? live}|${side}|${type}|fx2`)) >>> 0);
      const frac = h.frac ?? 0.1, armoured = side === "hero" || (side === "foe" && ARMOUR.test(String(o.foeName || ""))), pick = (r() * 4) | 0;
      const opt = { level: lv, side, frac, crit: !!h.crit, final: !!h.final, power: !!h.power, pick, metal: armoured && (type === "slash" || type === "pierce") && (pick === 0 || !!h.crit) };
      const ground = t.ground ?? gy;
      if (t.live !== false) for (const [key, size] of planOf(type, mat, opt)) {
        const sh = SH[key], low = key === "dust" || key === "bone";
        play(key, t.x + (low ? dir * 4 * s : 0), low ? Math.min(ground, t.y + 26 * s) : t.y, size * extra, dir, r, side === "foe" || side === "hero" ? 1 : 0.8);
        if (sh && key === "jet") P[(cur + CAP - 1) % CAP].rot = (r() - 0.5) * 0.5 - 0.15;
      }
      const dc = decalOf(type, mat, opt);
      if (dc.ground) {
        const k = Math.min(1.8, 0.7 + frac * 2) * (mat === "dragon" ? 1.4 : 1);
        decal(dc.liquid, t.x + dir * (14 + r() * 18) * s, ground + (r() - 0.2) * 4 * s, (38 + r() * 14) * k * s, r, dc.ground > 1 ? 0 : r() < 0.5 ? 2 : 0);
        if (dc.ground > 1) decal(dc.liquid, t.x + dir * (40 + r() * 22) * s, ground + (r() - 0.5) * 5 * s, (30 + r() * 12) * k * s, r, 2);
      }
      if (dc.body) smear(side === "foe" ? "foe" : "hero", dc.liquid, r, dir);
    }
    const oKill = S.kill;
    S.kill = function (t, k = {}) {
      const res = oKill.call(S, t, k);
      if (res && t && !k.instant) {
        const mat = matOf(t), dir = k.from || 1, death = k.death || "topple";
        if (res.burst) onHit({ ...t, side: "foe" }, { type: k.type || "slash", frac: 0.6, final: true, crit: !!k.crit, power: !!k.power, from: dir, key: `kill${k.key ?? 0}` }, k.crit || k.slowmo ? 1.15 : 1);
        if (lv === "full" && (BLEED[mat] || mat === "oil") && !["ash", "shatter", "fade"].includes(death) && k.type !== "fire") {
          const r = g0.rng((seed0 ^ g0.hash(`kill|${k.key ?? 0}|fx2`)) >>> 0);
          decal(BLEED[mat] ? "blood" : "oil", t.bodyX ?? t.x, (t.ground ?? gy) + 2 * s, 70 * Math.min(1.8, t.size || 1) * (mat === "dragon" ? 1.5 : 1) * s, r, 1);
        }
      }
      return res;
    };
    const oUpd = S.update;
    S.update = function (dt) {
      oUpd.call(S, dt);
      live = 0;
      for (const p of P) { if (!p.on) continue; p.t += dt; if (p.t >= p.dur) p.on = false; else live++; }
      for (const q of D.ground) { q.age += dt; if (q.grow < 1) q.grow = Math.min(1, q.grow + dt / 1.6); }
      for (const q of D.body) q.age += dt;
      if (D.ground.length && D.ground[0].age > GROUND_LIFE) D.ground.shift();
      if (D.body.length && D.body[0].age > BODY_LIFE) D.body.shift();
    };
    const oSettle = S.settle;
    S.settle = function () { oSettle.call(S); for (const p of P) p.on = false; live = 0; for (const q of D.ground) q.grow = 1; };
    const oClear = S.clear;
    S.clear = function () { oClear.call(S); for (const p of P) p.on = false; D.ground.length = 0; D.body.length = 0; };

    /* never draw a picture bigger than 1.15x its own pixels: the canvas transform holds DPR and the fight camera */
    function capW(g, w, fw) {
      let k = 1; try { const m = g.getTransform(); k = Math.hypot(m.a, m.b) || 1; } catch { /* old canvas */ }
      return Math.min(w, (fw * 1.15) / k);
    }
    function cellDraw(g, liq, cell, cx, cy, w, h, alpha, flip) {
      const d = DEC[liq], im = img(d[0]); if (!im) return;
      const c = d[1], sx = (cell % 4) * c, sy = ((cell / 4) | 0) * c;
      const ww = capW(g, w, c), hh = h * (ww / w);
      g.globalAlpha = alpha;
      if (flip < 0) { g.save(); g.translate(cx, cy); g.scale(-1, 1); g.drawImage(im, sx, sy, c, c, -ww / 2, -hh / 2, ww, hh); g.restore(); }
      else g.drawImage(im, sx, sy, c, c, cx - ww / 2, cy - hh / 2, ww, hh);
    }
    const oGround = S.drawGround;
    S.drawGround = function (g) {
      oGround.call(S, g);
      if (!D.ground.length) return;
      g.save();
      for (const q of D.ground) {
        const fade = Math.max(0, 1 - Math.max(0, q.age - GROUND_LIFE * 0.5) / (GROUND_LIFE * 0.5)), w = q.w * s * (0.35 + 0.65 * q.grow);
        if (fade > 0) cellDraw(g, q.liq, q.cell, q.x * W, gy + q.y * s, w, w * 0.3, 0.92 * fade, q.flip);   // lying flat: squashed
      }
      g.restore();
    };
    const oMarks = S.drawMarks;
    S.drawMarks = function (g, side, fx, fy, sc, hpFrac, hidden) {
      oMarks.call(S, g, side, fx, fy, sc, hpFrac, hidden);
      if (side !== "foe" && side !== "hero") return;
      pos[side] = hidden ? null : [fx, fy];
      if (hidden || !D.body.length) return;
      for (const q of D.body) {
        if (q.side !== side) continue;
        const fade = Math.max(0, 1 - q.age / BODY_LIFE), w = q.w * sc;
        if (fade <= 0) continue;
        const d = DEC[q.liq], im = img(d[0]); if (!im) continue;
        const c = d[1], ww = capW(g, w, c);
        g.save();
        g.translate(fx + q.dx * sc, fy + q.dy * sc); g.rotate(q.rot); g.globalAlpha = 0.8 * fade;
        g.drawImage(im, (q.cell % 4) * c, ((q.cell / 4) | 0) * c, c, c, -ww / 2, -ww * 0.3, ww, ww * 0.6);
        g.restore();
      }
    };
    const oFront = S.drawFront;
    S.drawFront = function (g) {
      oFront.call(S, g);
      if (!live) return;
      g.save();
      for (const p of P) {
        if (!p.on) continue;
        const sh = p.sh, im = img(sh[0]); if (!im) continue;
        const n = sh[1], fw = sh[2], fh = sh[3], fi = Math.min(n - 1, ((p.t / p.dur) * n) | 0);
        const w = capW(g, p.w, fw), h = w * (fh / fw);
        g.globalCompositeOperation = sh[7] ? "lighter" : "source-over";
        g.globalAlpha = p.a;
        g.save();
        g.translate(p.x, p.y); g.rotate(p.rot * p.flip); g.scale(p.flip, 1);
        g.drawImage(im, fi * fw, 0, fw, fh, -sh[4] * w, -sh[5] * h, w, h);
        g.restore();
      }
      g.restore();
    };
    S.fx2count = () => live;
    S.fx2decals = () => ({ ground: D.ground.length, body: D.body.length });
    return S;
  }

  // wrap every stage gore.js makes (gore.js loads first)
  if (typeof GORE !== "undefined" && GORE.scene && !GORE.scene.fx2) {
    const base = GORE.scene;
    const scene = function (o = {}) { return wrap(base(o), o); };
    scene.fx2 = true;
    GORE.scene = scene;
  }
  return { SH, DEC, KEYS, planOf, decalOf, wrap };
})();
if (typeof module !== "undefined") module.exports = GOREFX2;
