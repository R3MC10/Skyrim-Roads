/* [fightfeel] Weight in the fight replay (fightart.js): blows wind up, land with a short hit-stop for the two fighters
   in them, knock the target back and let it recover; blocks, dodges and elements each look different; a worn-out
   fighter stands hunched. Pure helpers (also run in node for tests/test_fightfeel.js) plus a small pool of drawn effects.
   - stopFor(b, o)      seconds the fighters in this blow hold still (0.04-0.07; 0 on a miss, a block's own move, a potion,
                        or with reduced motion). Only their clock stops: the scene's own clock, sparks and others run on,
                        and the beat makes the time back in its recovery (payback), so the next turn never comes later.
   - windOf(m)          where the swing reaches the top of its wind-up (the key before the hit), or null
   - holdOf(wt)         how long the wind-up holds before the snap: a dagger barely, a sword a beat, a warhammer longest
   - warp(u, wu, hu, h) the pose's time: holds at the top of the wind-up, then snaps through; warp(hu) = hu exactly
   - crouch(u, wu, hu)  0..1 anticipation (drawing back before the strike)
   - push(t, peak)      how far a blow pushes the target back, t seconds after it: quick rise, a short hold, a small
                        overshoot forward as it recovers its stance, nothing after ~0.6 s
   - lean(t, peak)      the matching lean back (radians)
   - jitter(left, t)    the struck fighter's shiver while frozen
   - tired(frac)        0..1, how worn out a fighter at this share of health looks (from 35 % down)
   - scene(o)           drawn effects: fire petals, frost shards, shock arcs, a shield flash, dodge streaks, a swoosh */
const FIGHTFEEL = (() => {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const NOSTOP = new Set(["potion", "self", "wait", "block", "cast_self"]);
  const HEAVY = /warhammer|battleaxe|greatsword|club/, LIGHT = /dagger|fist|claw|bite/;
  function stopFor(b, o) {
    o = o || {};
    if (!b || o.reduce || b.miss || NOSTOP.has(b.move)) return 0;
    const wt = b.wt || b.move || "";
    let t = HEAVY.test(wt) ? 0.06 : LIGHT.test(wt) ? 0.04 : 0.05;
    if (b.blocked) t = 0.045;
    if (b.power || b.crit || b.sneak) t += 0.01;
    if (b.final) t = 0.07;
    if (o.multi) t -= 0.005;   // a flurry (several hits in one beat): each a touch shorter
    return clamp(t, 0.04, 0.07);
  }
  function windOf(m) {
    if (!m || !m.kf || !m.hits || !m.hits.length) return null;
    const hu = m.hits[0]; let i = m.kf.findIndex((k) => k[0] >= hu - 1e-6);
    if (i < 1) return null;
    const wu = m.kf[i - 1][0];
    return wu > 0 && wu < hu ? wu : null;
  }
  const holdOf = (wt) => (HEAVY.test(wt || "") ? 0.42 : LIGHT.test(wt || "") ? 0.14 : 0.3);
  function warp(u, wu, hu, hold) {
    if (wu == null || !(hu > wu) || u <= wu || u >= hu) return u;
    const h = hold == null ? 0.3 : hold, p = (u - wu) / (hu - wu);
    return p < h ? wu : wu + (hu - wu) * (p - h) / (1 - h);
  }
  function crouch(u, wu, hu) {
    if (wu == null || !(hu > wu)) return 0;
    if (u <= wu * 0.5 || u >= hu) return 0;
    if (u < wu) { const p = (u - wu * 0.5) / (wu * 0.5); return p * p * (3 - 2 * p); }
    const p = (u - wu) / (hu - wu); return 1 - p * p;
  }
  function push(t, peak) {
    if (!(peak > 0) || t < 0 || t > 0.6) return 0;
    if (t < 0.06) return peak * (0.55 + 0.45 * (t / 0.06));
    if (t < 0.16) return peak;
    if (t < 0.42) { const p = (t - 0.16) / 0.26; return peak * (1 - 1.12 * (p * p * (3 - 2 * p))); }   // back to its stance, a touch past it
    const p = (t - 0.42) / 0.18; return -0.12 * peak * (1 - p * p * (3 - 2 * p));
  }
  const lean = (t, peak) => -0.012 * push(t, peak);
  const jitter = (left, t) => (left > 0 ? Math.sin(t * 190) * 0.9 : 0);
  const tired = (frac) => (frac > 0 && frac < 0.35 ? clamp((0.35 - frac) / 0.25, 0, 1) : 0);

  /* ---- drawn effects: one pool of 12, allocated once */
  function scene(o) {
    const s = o.s || 1, rm = !!o.reduce, low = !!o.low, N = 12, FX = [];
    for (let i = 0; i < N; i++) FX.push({ on: false, kind: "", x: 0, y: 0, dir: 1, big: false, t: 0, life: 0, seed: 0 });
    const LIFE = { fire: 0.42, frost: 0.5, shock: 0.3, shield: 0.28, dodge: 0.3, swoosh: 0.2 };
    let n = 0, seedN = 1;
    function add(kind, x, y, dir, big) {
      if (!LIFE[kind]) return false;
      if (rm && (kind === "dodge" || kind === "swoosh")) return false;   // reduced motion: outcomes still show (impacts, the shield), no streaks
      let q = FX.find((e) => !e.on); if (!q) { q = FX.reduce((a, e) => (e.t / e.life > a.t / a.life ? e : a)); }
      Object.assign(q, { on: true, kind, x, y, dir: dir || 1, big: !!big, t: 0, life: LIFE[kind] * (rm ? 0.8 : 1), seed: (seedN = (seedN * 16807) % 2147483647) });
      return true;
    }
    function tick(dt) { n = 0; for (const e of FX) if (e.on) { e.t += dt; if (e.t >= e.life) e.on = false; else n++; } }
    const rnd = (e, i) => { const x = Math.sin(e.seed * 0.001 + i * 12.9898) * 43758.5453; return x - Math.floor(x); };
    function draw(g) {
      if (!n) return;
      g.save(); g.lineCap = "round"; g.lineJoin = "round";
      for (const e of FX) if (e.on) { const p = e.t / e.life, a = 1 - p, k = (e.big ? 1.35 : 1) * s; g.globalAlpha = 1; KIND[e.kind](g, e, p, a, k); }
      g.restore();
    }
    const KIND = {
      fire(g, e, p, a, k) {   // petals of flame thrown out from the hit, curling up as they burn off
        g.globalCompositeOperation = "lighter";
        const m = low ? 5 : 8, r = (6 + 18 * (1 - (1 - p) * (1 - p))) * k;
        for (let i = 0; i < m; i++) {
          const an = (i / m) * 6.283 + rnd(e, i) * 0.6, rr = r * (0.7 + 0.5 * rnd(e, i + 9)), cx = e.x + Math.cos(an) * rr, cy = e.y + Math.sin(an) * rr * 0.8 - p * 10 * k;
          const len = (7 - 3 * p) * k, w = 2.6 * k * a;
          g.globalAlpha = a * 0.85; g.fillStyle = i % 3 ? "#ff8a2a" : "#ffd27a";
          g.beginPath(); g.moveTo(cx - Math.cos(an) * len * 0.4, cy - Math.sin(an) * len * 0.4);
          g.quadraticCurveTo(cx + Math.cos(an + 1.2) * w, cy + Math.sin(an + 1.2) * w - len * 0.3, cx + Math.cos(an) * len, cy + Math.sin(an) * len - len * 0.6);
          g.quadraticCurveTo(cx + Math.cos(an - 1.2) * w, cy + Math.sin(an - 1.2) * w, cx - Math.cos(an) * len * 0.4, cy - Math.sin(an) * len * 0.4); g.fill();
        }
        g.globalAlpha = a * a * 0.7; g.fillStyle = "#fff2c0"; g.beginPath(); g.arc(e.x, e.y, (4 + 4 * (1 - p)) * k, 0, 6.283); g.fill();
        g.globalCompositeOperation = "source-over";
      },
      frost(g, e, p, a, k) {   // a white star, then sharp shards flying out and hanging a moment
        const m = low ? 5 : 7, out = 1 - Math.pow(1 - Math.min(1, p * 2.2), 3);
        g.fillStyle = "#d8f2ff"; g.strokeStyle = "#7fb0d8"; g.lineWidth = 0.6 * k;
        for (let i = 0; i < m; i++) {
          const an = (i / m) * 6.283 + rnd(e, i) * 0.5, d = (5 + 16 * out) * k * (0.7 + 0.5 * rnd(e, i + 3)), cx = e.x + Math.cos(an) * d, cy = e.y + Math.sin(an) * d + p * p * 6 * k, L = (5 + 3 * rnd(e, i + 5)) * k, W = 1.4 * k;
          g.globalAlpha = a; g.beginPath(); g.moveTo(cx + Math.cos(an) * L, cy + Math.sin(an) * L); g.lineTo(cx + Math.cos(an + 1.57) * W, cy + Math.sin(an + 1.57) * W); g.lineTo(cx - Math.cos(an) * L * 0.4, cy - Math.sin(an) * L * 0.4); g.lineTo(cx - Math.cos(an + 1.57) * W, cy - Math.sin(an + 1.57) * W); g.closePath(); g.fill(); g.stroke();
        }
        if (p < 0.45) { const q = 1 - p / 0.45, r = (10 + 8 * (1 - q)) * k; g.globalAlpha = q; g.strokeStyle = "#ffffff"; g.lineWidth = 1.4 * k; g.beginPath();
          for (let i = 0; i < 4; i++) { const an = i * 0.785 + 0.2; g.moveTo(e.x - Math.cos(an) * r, e.y - Math.sin(an) * r); g.lineTo(e.x + Math.cos(an) * r, e.y + Math.sin(an) * r); } g.stroke(); }
      },
      shock(g, e, p, a, k) {   // a bright core and jagged arcs that fork, re-struck every few frames
        g.globalCompositeOperation = "lighter";
        const m = low ? 3 : 5, fr = Math.floor(e.t * 40);
        g.globalAlpha = a; g.strokeStyle = "#cfc4ff"; g.lineWidth = 1.3 * k;
        for (let i = 0; i < m; i++) {
          const an = (i / m) * 6.283 + rnd(e, i + fr) * 0.9; let x = e.x, y = e.y; g.beginPath(); g.moveTo(x, y);
          for (let j = 0; j < 4; j++) { x += Math.cos(an) * 5 * k + (rnd(e, i * 7 + j + fr) - 0.5) * 7 * k; y += Math.sin(an) * 5 * k + (rnd(e, i * 5 + j + fr + 3) - 0.5) * 7 * k; g.lineTo(x, y);
            if (j === 1 && i % 2 === 0) { g.lineTo(x + (rnd(e, j + fr) - 0.3) * 8 * k, y + 6 * k); g.moveTo(x, y); } }
          g.stroke();
        }
        g.globalAlpha = a * 0.9; g.fillStyle = "#ffffff"; g.beginPath(); g.arc(e.x, e.y, (3 + 3 * a) * k, 0, 6.283); g.fill();
        g.globalCompositeOperation = "source-over";
      },
      shield(g, e, p, a, k) {   // a bright crescent on the shield's face and a few glints off its rim
        g.globalCompositeOperation = "lighter";
        const r = (9 + 7 * p) * k, d = e.dir;
        g.globalAlpha = a; g.strokeStyle = "#e8f6ff"; g.lineWidth = (3.4 * a + 0.6) * k;
        g.beginPath(); g.arc(e.x, e.y, r, d > 0 ? -1.2 : Math.PI - 1.2, d > 0 ? 1.2 : Math.PI + 1.2); g.stroke();
        g.globalAlpha = a * 0.5; g.fillStyle = "#bfe4ff"; g.beginPath(); g.ellipse(e.x + d * 2 * k, e.y, 4 * k * a + 1, 9 * k * a + 1, 0, 0, 6.283); g.fill();
        g.globalAlpha = a; g.strokeStyle = "#ffffff"; g.lineWidth = 1 * k;
        for (let i = 0; i < (low ? 2 : 4); i++) { const an = (d > 0 ? 0 : Math.PI) + (rnd(e, i) - 0.5) * 2.4, r0 = r + 2 * k, r1 = r0 + (4 + 8 * p) * k; g.beginPath(); g.moveTo(e.x + Math.cos(an) * r0, e.y + Math.sin(an) * r0); g.lineTo(e.x + Math.cos(an) * r1, e.y + Math.sin(an) * r1); g.stroke(); }
        g.globalCompositeOperation = "source-over";
      },
      dodge(g, e, p, a, k) {   // speed streaks trailing the side-step
        g.strokeStyle = "#f2ead8"; g.lineWidth = 1.1 * k;
        for (let i = 0; i < (low ? 3 : 5); i++) { const y = e.y - 28 * k + i * 12 * k + rnd(e, i) * 4 * k, x0 = e.x + e.dir * (6 + 10 * p) * k, L = (14 + 10 * rnd(e, i + 4)) * k * a; g.globalAlpha = a * 0.6; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + e.dir * L, y); g.stroke(); }
      },
      swoosh(g, e, p, a, k) {   // a painted foe's blow: a quick pale arc in front of it (it has no blade to trail)
        const r = 22 * k, st = e.dir > 0 ? -1.4 : Math.PI - 0.2, en = e.dir > 0 ? 0.2 : Math.PI + 1.4, cut = st + (en - st) * Math.min(1, 0.4 + p * 1.6);
        g.globalAlpha = a * 0.7; g.strokeStyle = "#f4f6ff"; g.lineWidth = 3 * k * a + 0.5; g.beginPath(); g.arc(e.x, e.y, r, Math.min(st, cut), Math.max(st, cut)); g.stroke();
      },
    };
    return { add, tick, draw, count: () => n, clear: () => { for (const e of FX) e.on = false; n = 0; }, cap: N };
  }
  return { stopFor, windOf, holdOf, warp, crouch, push, lean, jitter, tired, scene, HEAVY, LIGHT };
})();
if (typeof module !== "undefined") module.exports = FIGHTFEEL;
