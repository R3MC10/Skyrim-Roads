/* arrowfx.js: bows and crossbows shoot a real painted arrow or bolt. [OURS]
   Remigiusz: "Bows and crossbows should shoot a projectile".
   - Every bow or crossbow shot in a fight (you, your followers and party, archer foes, a Dwarven ballista) fires one.
   - An arrow leaves the string with a little snap, arcs slightly and turns along its path. A bolt flies flatter and faster.
   - It hits and sticks (gore.js keeps the arrows stuck in a foe), breaks on a shield, or sails past on a miss and
     drops into the ground behind, where it stays for the fight.
   - Fire, frost, shock, poison and life-drain arrows leave a trail. Power shots and sneak shots are bigger and faster.
   - fightart.js calls fire() at the release moment of the draw pose (the rig owns the pose; this only hooks the release),
     tick() and draw(). Without this file the old flat arrow is drawn. At most 8 shots, 6 arrows in the ground, 64 bits. */
const ARROWFX = (() => {
  const TRAIL = { fire: ["#fff2c0", "#ffb347", "#e8653a"], frost: ["#ffffff", "#cfeeff", "#8ccaf0"], shock: ["#ffffff", "#dcd0ff", "#a890ff"],
    poison: ["#e8ffc0", "#a6e870", "#5a9a3a"], drain: ["#ffd0d0", "#ff6a6a", "#a01a2a"] };
  /* what a shot looks like. o: { wt: bow|crossbow, el, power, sneak, crit, second, ballista } */
  function spec(o = {}) {
    const bolt = o.wt === "crossbow" || !!o.ballista, big = !!(o.power || o.sneak), heavy = !!o.ballista;
    const el = TRAIL[o.el] ? o.el : null;
    return {
      kind: bolt ? "bolt" : "arrow",
      len: (bolt ? 15 : 22) * (heavy ? 1.9 : big ? 1.25 : 1),
      w: (bolt ? 1.9 : 1.5) * (heavy ? 1.8 : big ? 1.25 : 1),
      arc: bolt ? 3 : 13,   // an arrow lofts a little, a bolt flies nearly flat
      speed: bolt ? 1.35 : 1, scale: heavy ? 1.9 : big ? 1.25 : 1, big, heavy,
      trail: el, glow: el ? TRAIL[el][1] : null, crit: !!o.crit,
    };
  }
  /* a fight move that shoots (fightart MOVES entry): its projectile kind, else null */
  const shotOf = (m) => (m && m.proj && (m.proj[2] === "arrow" || m.proj[2] === "bolt") ? m.proj[2] : null);

  function scene(o) {
    const s = o.s || 1, gy = o.groundY ?? 200, lite = !!(o.reduce || o.low), NB = lite ? 24 : 64, pmul = lite ? 0.4 : 1;
    const shots = [], ground = [], snaps = [], seen = new Set();
    let firedN = 0;
    // small bits: trail sparks, splinters, the halves of a broken arrow. type 0 glow · 1 splinter · 2 mist · 3 drip · 4 half
    const bx = new Float32Array(NB), by = new Float32Array(NB), bvx = new Float32Array(NB), bvy = new Float32Array(NB), bl = new Float32Array(NB), bm = new Float32Array(NB),
      bs = new Float32Array(NB), bg = new Float32Array(NB), ba = new Float32Array(NB), bva = new Float32Array(NB), bt = new Uint8Array(NB), bc = new Array(NB).fill("#fff");
    let bcur = 0;
    function bit(t, c, x, y, vx, vy, l, size, g = 0, a = 0, va = 0) {
      let i = bcur, n = 0; while (bl[i] > 0 && n < NB) { i = (i + 1) % NB; n++; }
      bcur = (i + 1) % NB;
      bx[i] = x; by[i] = y; bvx[i] = vx; bvy[i] = vy; bl[i] = bm[i] = l; bs[i] = size; bg[i] = g; bt[i] = t; bc[i] = c; ba[i] = a; bva[i] = va;
    }
    const R = Math.random;
    /* fire one shot. key: once per shot (a beat, or a beat + an ally's name). o: { x0, y0, x1, y1, dur (s), sp, miss, blocked, gore } */
    function fire(key, q) {
      if (key != null) { if (seen.has(key)) return false; seen.add(key); }
      if (![q.x0, q.y0, q.x1, q.y1].every(isFinite)) return false;
      if (shots.length >= 8) shots.shift();
      const sp = q.sp || spec({});
      const dur = Math.max(0.06, (q.dur || 0.2) / sp.speed);
      shots.push({ ...q, sp, dur, t: 0, state: "fly", x: q.x0, y: q.y0, ang: Math.atan2(q.y1 - q.y0, q.x1 - q.x0), hist: [], life: 0, vx: 0, vy: 0, wob: 0 });
      firedN++;
      // the string snaps forward: a flick at the bow and a few grains of dust; a power or sneak shot pushes a ring of air
      snaps.push({ x: q.x0, y: q.y0, dir: Math.sign(q.x1 - q.x0) || 1, t: 0, big: sp.big || sp.heavy });
      if (snaps.length > 4) snaps.shift();
      return true;
    }
    function land(sh) {
      const sp = sh.sp, dir = Math.sign(sh.x1 - sh.x0) || 1;
      if (sh.miss) {   // sails on past, then drops into the ground
        sh.state = "past"; sh.vx = (sh.x1 - sh.x0) / sh.dur; sh.vy = (sh.y1 - sh.y0) / sh.dur - 40 * s; sh.life = 0.9; return;
      }
      if (sh.blocked) {   // breaks on the shield: two halves tumble, splinters fly
        sh.state = "gone";
        bit(4, "#a27a4a", sh.x1, sh.y1, -dir * (40 + R() * 40) * s, -(80 + R() * 40) * s, 0.8, sp.len * 0.55, 420, sh.ang, -dir * 14);
        bit(4, "#a27a4a", sh.x1, sh.y1, -dir * (20 + R() * 30) * s, -(40 + R() * 40) * s, 0.8, sp.len * 0.45, 420, sh.ang + Math.PI, dir * 10);
        for (let i = 0; i < Math.round(6 * pmul) + 1; i++) bit(1, i % 2 ? "#e9dcc0" : "#a27a4a", sh.x1, sh.y1, -dir * (60 + R() * 100) * s, (R() - 0.7) * 140 * s, 0.4, 1.6, 300, R() * 6, (R() - 0.5) * 30);
        return;
      }
      // a hit: a few splinters and feather wisps; it stays stuck in the target for a moment (gore.js keeps it in a foe)
      for (let i = 0; i < Math.round((sp.big ? 7 : 4) * pmul) + 1; i++) bit(1, i % 2 ? "#e9dcc0" : "#c8a878", sh.x1, sh.y1, -dir * (40 + R() * 70) * s, (R() - 0.6) * 90 * s, 0.35, 1.4, 260, R() * 6, (R() - 0.5) * 30);
      if (sp.trail) { const c = TRAIL[sp.trail]; for (let i = 0; i < Math.round(8 * pmul) + 2; i++) bit(sp.trail === "frost" ? 2 : sp.trail === "poison" ? 3 : 0, c[i % 3], sh.x1, sh.y1, (R() - 0.5) * 160 * s, (R() - 0.7) * 140 * s, 0.45, 2.6, sp.trail === "poison" ? 200 : 0); }
      if (sh.gore) { sh.state = "gone"; return; }
      sh.state = "stuck"; sh.life = 0.7; sh.wob = 1;
    }
    function tick(dt) {
      if (!(dt > 0)) return;
      for (let i = shots.length - 1; i >= 0; i--) {
        const sh = shots[i], sp = sh.sp;
        if (sh.state === "fly") {
          sh.t += dt; const p = Math.min(1, sh.t / sh.dur), x = sh.x0 + (sh.x1 - sh.x0) * p, y = sh.y0 + (sh.y1 - sh.y0) * p - Math.sin(p * Math.PI) * sp.arc * s * (sh.miss ? 0.6 : 1);
          const dx = x - sh.x, dy = y - sh.y; if (dx || dy) sh.ang = Math.atan2(dy, dx);
          sh.hist.unshift(sh.x, sh.y); if (sh.hist.length > 12) sh.hist.length = 12;
          sh.x = x; sh.y = y;
          if (sp.trail && R() < 1.2 * pmul) { const c = TRAIL[sp.trail], back = -Math.cos(sh.ang), tb = sp.trail;
            bit(tb === "frost" ? 2 : tb === "poison" ? 3 : 0, c[(R() * 3) | 0], x + back * sp.len * 0.4 * s, y, back * (20 + R() * 30) * s, (R() - 0.5) * 30 * s + (tb === "fire" ? -30 * s : 0), tb === "frost" ? 0.6 : 0.4, tb === "frost" ? 4 : 2.4, tb === "poison" ? 160 : tb === "fire" ? -40 : 0); }
          if (p >= 1) land(sh);
        } else if (sh.state === "past") {
          sh.life -= dt; sh.vy += 520 * s * dt; sh.hist.unshift(sh.x, sh.y); if (sh.hist.length > 12) sh.hist.length = 12;
          sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.ang = Math.atan2(sh.vy, sh.vx);
          if (sh.y >= gy - 2 * s) {   // into the ground, slanted, and it stays there
            if (ground.length >= 6) ground.shift(); ground.push({ x: sh.x, ang: sh.vx >= 0 ? Math.max(0.35, Math.min(1.2, sh.ang)) : Math.min(Math.PI - 0.35, Math.max(Math.PI - 1.2, sh.ang)), sp });
            for (let k = 0; k < Math.round(4 * pmul) + 1; k++) bit(2, "#a08e74", sh.x, gy - 2 * s, (R() - 0.5) * 50 * s, -(20 + R() * 30) * s, 0.5, 3, 60);
            sh.state = "gone";
          } else if (sh.life <= 0) sh.state = "gone";
        } else if (sh.state === "stuck") { sh.life -= dt; sh.wob *= Math.exp(-dt * 9); if (sh.life <= 0) sh.state = "gone"; }
        if (sh.state === "gone") shots.splice(i, 1);
      }
      for (let i = snaps.length - 1; i >= 0; i--) { snaps[i].t += dt; if (snaps[i].t > 0.3) snaps.splice(i, 1); }
      for (let i = 0; i < NB; i++) {
        if (bl[i] <= 0) continue;
        bl[i] -= dt; bvy[i] += bg[i] * s * dt; bvx[i] *= 0.985; bvy[i] *= 0.985; bx[i] += bvx[i] * dt; by[i] += bvy[i] * dt; ba[i] += bva[i] * dt;
        if (bt[i] === 2) bs[i] += dt * 5;
        if ((bt[i] === 1 || bt[i] === 4) && by[i] > gy && bvy[i] > 0) { by[i] = gy; bvy[i] *= -0.3; bvx[i] *= 0.5; bva[i] *= 0.5; }
      }
    }
    function clear() { shots.length = 0; snaps.length = 0; seen.clear(); for (let i = 0; i < NB; i++) bl[i] = 0; }
    function reset() { clear(); ground.length = 0; }

    // ---------------------------------------------------------------- drawing
    /* one arrow or bolt pointing along +x from (0,0) = the tip; drawn in the current transform */
    function body(g, sp, a = 1) {
      const L = sp.len * s, w = Math.max(1, sp.w * s), bolt = sp.kind === "bolt";
      g.lineCap = "round"; g.globalAlpha = a;
      g.strokeStyle = "rgba(30,22,16,0.55)"; g.lineWidth = w * 1.9; g.beginPath(); g.moveTo(-L, 0); g.lineTo(-3 * s, 0); g.stroke();   // a dark edge so it reads on snow
      g.strokeStyle = bolt ? "#7a5a36" : "#a27a4a"; g.lineWidth = w; g.beginPath(); g.moveTo(-L, 0); g.lineTo(-3 * s, 0); g.stroke();
      g.strokeStyle = "rgba(255,240,210,0.5)"; g.lineWidth = Math.max(0.6, w * 0.35); g.beginPath(); g.moveTo(-L * 0.9, -w * 0.25); g.lineTo(-5 * s, -w * 0.25); g.stroke();
      // the head
      const hl = (bolt ? 5 : 6) * s * Math.min(1.5, sp.scale), hw = (bolt ? 2.6 : 2.4) * s * Math.min(1.5, sp.scale);
      g.fillStyle = "#2a2622"; g.beginPath(); g.moveTo(1 * s, 0); g.lineTo(-hl, -hw - 0.6 * s); g.lineTo(-hl * 0.75, 0); g.lineTo(-hl, hw + 0.6 * s); g.closePath(); g.fill();
      g.fillStyle = bolt ? "#9aa2ac" : "#c8ccd2"; g.beginPath(); g.moveTo(0, 0); g.lineTo(-hl, -hw); g.lineTo(-hl * 0.75, 0); g.lineTo(-hl, hw); g.closePath(); g.fill();
      // the fletching
      const fl = (bolt ? 4 : 7) * s * Math.min(1.5, sp.scale), fh = (bolt ? 2.4 : 3) * s * Math.min(1.5, sp.scale);
      g.fillStyle = sp.trail ? TRAIL[sp.trail][2] : bolt ? "#5a4a3a" : "#e9dcc0";
      g.beginPath(); g.moveTo(-L, 0); g.lineTo(-L + fl, 0); g.lineTo(-L - 1 * s, -fh); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-L, 0); g.lineTo(-L + fl, 0); g.lineTo(-L - 1 * s, fh); g.closePath(); g.fill();
    }
    function glowAt(g, x, y, r, c, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, "rgba(0,0,0,0)"); g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    function draw(g) {
      if (!shots.length && !ground.length && !snaps.length && !live()) return;
      g.save();
      // arrows in the ground behind the foe (or you)
      for (const gd of ground) { g.save(); g.translate(gd.x, gy); g.rotate(gd.ang); g.translate(gd.sp.len * 0.3 * s, 0); body(g, gd.sp, 0.9); g.restore(); }
      // the string snapping forward
      for (const sn of snaps) {
        const k = sn.t / 0.3; g.globalAlpha = (1 - k) * 0.8; g.strokeStyle = "#f4ecd8"; g.lineWidth = Math.max(1, 1.4 * s); g.lineCap = "round";
        g.beginPath(); g.arc(sn.x - sn.dir * 6 * s, sn.y, (5 + k * 6) * s, sn.dir > 0 ? -0.9 : Math.PI - 0.9, sn.dir > 0 ? 0.9 : Math.PI + 0.9); g.stroke();
        if (sn.big) { g.globalAlpha = (1 - k) * 0.5; g.beginPath(); g.ellipse(sn.x + sn.dir * k * 30 * s, sn.y, (4 + k * 6) * s, (8 + k * 14) * s, 0, 0, Math.PI * 2); g.stroke(); }
      }
      for (const sh of shots) {
        const sp = sh.sp;
        if (sh.state !== "stuck" && sh.hist.length >= 4) {   // the motion streak behind it
          g.globalCompositeOperation = "lighter"; g.lineCap = "round";
          const n = sh.hist.length / 2, c = sp.trail ? TRAIL[sp.trail][1] : "#fff6e0";
          for (let i = 0; i < n - 1; i++) { g.globalAlpha = (1 - i / n) * (sp.trail ? 0.5 : 0.28) * (sp.big ? 1.3 : 1); g.strokeStyle = c; g.lineWidth = Math.max(0.8, sp.w * s * (1 - i / n) * (sp.trail ? 1.6 : 1));
            g.beginPath(); g.moveTo(i ? sh.hist[i * 2 - 2] : sh.x, i ? sh.hist[i * 2 - 1] : sh.y); g.lineTo(sh.hist[i * 2], sh.hist[i * 2 + 1]); g.stroke(); }
          g.globalCompositeOperation = "source-over";
        }
        g.save(); g.translate(sh.x, sh.y); g.rotate(sh.ang + (sh.state === "stuck" ? Math.sin(sh.life * 60) * 0.12 * sh.wob : 0));
        if (sh.state === "stuck") g.translate(sp.len * 0.35 * s, 0);   // the head is buried in the target
        if (sp.glow && sh.state === "fly") { g.globalCompositeOperation = "lighter"; glowAt(g, -2 * s, 0, 9 * s * sp.scale, sp.glow, 0.8); g.globalCompositeOperation = "source-over"; }
        body(g, sp, sh.state === "stuck" ? Math.min(1, sh.life / 0.3) : 1);
        g.restore();
      }
      // trail bits, splinters, halves
      for (let i = 0; i < NB; i++) {
        if (bl[i] <= 0) continue;
        const f = bl[i] / bm[i], r = bs[i] * s;
        if (bt[i] === 0) { g.globalCompositeOperation = "lighter"; glowAt(g, bx[i], by[i], r * 2, bc[i], Math.min(1, f * 1.4)); g.globalCompositeOperation = "source-over"; }
        else if (bt[i] === 2) glowAt(g, bx[i], by[i], r * 1.6, bc[i], f * 0.45);
        else if (bt[i] === 3) { g.globalAlpha = f; g.fillStyle = bc[i]; g.beginPath(); g.ellipse(bx[i], by[i], r * 0.5, r * 0.8, 0, 0, Math.PI * 2); g.fill(); }
        else if (bt[i] === 1) { g.globalAlpha = Math.min(1, f * 1.5); g.strokeStyle = bc[i]; g.lineWidth = Math.max(0.8, s * 0.8); g.save(); g.translate(bx[i], by[i]); g.rotate(ba[i]); g.beginPath(); g.moveTo(-r * 1.4, 0); g.lineTo(r * 1.4, 0); g.stroke(); g.restore(); }
        else if (bt[i] === 4) { g.save(); g.translate(bx[i], by[i]); g.rotate(ba[i]); g.globalAlpha = Math.min(1, f * 2); g.strokeStyle = "rgba(30,22,16,0.55)"; g.lineWidth = Math.max(1, 2.6 * s); g.beginPath(); g.moveTo(-bs[i] * s * 0.5, 0); g.lineTo(bs[i] * s * 0.5, 0); g.stroke(); g.strokeStyle = bc[i]; g.lineWidth = Math.max(1, 1.5 * s); g.stroke(); g.restore(); }
      }
      g.restore();
    }
    function live() { let n = 0; for (let i = 0; i < NB; i++) if (bl[i] > 0) n++; return n; }
    return { fire, tick, draw, clear, reset, fired: () => firedN, flying: () => shots.filter((q) => q.state === "fly").length, shots: () => shots.length, inGround: () => ground.length, bits: live, cap: NB };
  }
  return { spec, shotOf, scene, TRAIL };
})();
if (typeof module !== "undefined") module.exports = ARROWFX;
