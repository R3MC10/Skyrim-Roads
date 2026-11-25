/* MAPHERO: you and the other heroes on the world map as little figures of your actual character (figart.js), not dots. [OURS]
   On foot: standing still they breathe and their cloak sways; on the road they walk, facing the way they go.
   On a horse (HORSES.riding): sitting in the saddle; the horse stands (tail swish, head nod), walks, or gallops when the
   going is fast. A small hop and a puff of dust when a trip ends. Works in both art styles (the figure follows ART).
   Reduce motion (Settings → Accessibility) keeps everyone still: one standing frame, no hop, no dust.
   API: MAPHERO.draw(g, x, y, s, o) → { top, head }  (feet at x,y in map units; s = one screen px in map units)
          o = { id, look, horse: coat colour | null, led: coat colour | null (on foot, the horse walking behind you), moving, gallop, t (seconds), reduce, heading (radians | null), scale, ring,
                label (text drawn centred above the head; leave out when the caller places names itself), labelColor, labelSize }
        MAPHERO.figure(g, hero, x, y, t, opts) → the same, for other screens (e.g. a PC full-screen map):
          hero = { id, look, horse, moving, gallop, heading }, opts = { s (one screen px in g's units, default 1), scale,
          reduce, ring, label, labelColor, labelSize }. The label is whatever the caller passes (a name, "Stranger", ...).
        MAPHERO.active() → true while an arrival puff or a mount / dismount is playing (the map keeps drawing smoothly)
   [riding] Getting on or off (o.horse turns on or off) plays a short move instead of a swap: the horse walks up from
   behind and you climb into the saddle, or you slide down and it steps back. In the saddle the frames are cut finer
   (RIDE_STEPS) so the gait and the rider's sway move smoothly together.
        MAPHERO.flipped(id) → true when that hero faces left
   [mapheroanim] The painted horse moves in pieces (horseart.js motion): standing it breathes, shifts its weight, tosses
   its head and flicks its tail over a ~6 s loop; walking and galloping its legs swing and its body bobs and rocks, with
   the rider sitting into each stride. Little dust puffs kick up behind the hooves (or boots) while you travel. Idle and
   walk frames are cut finer too, so the breathing and steps read smoothly. The travel strip is left as it was. */
const MAPHERO = (() => {
  const HEROES = new Map();   // id → { flip, last, moving, arrive }
  let busyUntil = 0;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
  const ok = () => typeof HEROART !== "undefined" && !!HEROART.drawFigure;
  function stateOf(id) {
    let st = HEROES.get(id);
    if (!st) { st = { flip: false, last: null, moving: false, arrive: 0 }; HEROES.set(id, st); if (HEROES.size > 64) HEROES.delete(HEROES.keys().next().value); }
    return st;
  }
  /* which way they face: from the travel heading when known, else from how they moved since the last picture */
  function face(st, x, y, a, s) {
    if (a != null && isFinite(a)) { const c = Math.cos(a); if (c < -0.2) st.flip = true; else if (c > 0.2) st.flip = false; }
    else if (st.last) { const dx = x - st.last[0]; if (Math.abs(dx) > 0.4 * s) st.flip = dx < 0; }
    st.last = [x, y];
  }
  /* the puff of dust when a trip ends: little clouds rolling out from the feet */
  function dust(g, x, y, s, u) {
    const a = (1 - u) * 0.55, r = (5 + 15 * u) * s;
    g.save();
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2 + 0.4, cx = x + Math.cos(ang) * r, cy = y + Math.sin(ang) * r * 0.38;
      g.fillStyle = `rgba(214,196,160,${a})`; g.beginPath(); g.arc(cx, cy - 1.5 * s * u, (2.2 + 3 * u) * s, 0, 7); g.fill();
    }
    g.strokeStyle = `rgba(60,44,28,${a * 0.7})`; g.lineWidth = 1.2 * s; g.beginPath(); g.ellipse(x, y, r * 1.1, r * 0.42, 0, 0, 7); g.stroke();
    g.restore();
  }
  /* the frame for this moment: idle 4 frames over 2.4 s, walking 8 over 0.9 s, the horse standing / walking / galloping */
  const RIDE_STEPS = 12, MOUNT_T = 0.8;
  /* [mapheroanim] per gait: seconds per loop and frames per loop (the standing horse's long loop holds a head toss and a tail flick) */
  const RIDE = { stand: [6, 48], walk: [1.1, 16], gallop: [0.5, RIDE_STEPS] };
  const cut = (t, per, n) => Math.floor((t / per) * n) % n;
  function poseFor(o) {
    if (o.reduce) return o.horse ? { pose: "ride", frame: 0, gait: "stand" } : { pose: "idle", frame: 0 };
    const t = Math.max(0, o.t || 0);
    if (o.horse) {
      const gait = !o.moving ? "stand" : o.gallop ? null : "walk", [per, n] = RIDE[gait || "gallop"];
      return { pose: "ride", frame: cut(t, per, n), steps: n, gait };
    }
    if (o.moving) return { pose: "walk", frame: cut(t, 0.9, 16), steps: 16 };
    return { pose: "idle", frame: cut(t, 2.4, 16), steps: 16 };
  }
  /* [mapheroanim] dust kicked up behind the hooves (or boots) while travelling: a few small puffs drifting back and fading */
  function kick(g, x, y, s, dir, o) {
    const t = o.t || 0, n = o.horse ? 4 : 2, per = o.horse ? (o.gallop ? 0.5 : 0.8) : 0.9, back = (o.horse ? 11 : 3) * s;
    g.save();
    for (let i = 0; i < n; i++) {
      const u = (((t / per) + i / n) % 1 + 1) % 1, a = (1 - u) * (o.horse ? (o.gallop ? 0.5 : 0.34) : 0.24);
      const hx = x - dir * (back + (i % 2 ? 9 * s : 0) * (o.horse ? 1 : 0) + u * (o.gallop ? 14 : 7) * s), hy = y - u * 4 * s;
      g.fillStyle = `rgba(206,188,150,${a.toFixed(3)})`; g.beginPath(); g.arc(hx, hy, (1.4 + u * (o.gallop ? 3.4 : 2.2)) * s, 0, 7); g.fill();
    }
    g.restore();
  }
  const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  /* getting on or off on the map: the horse beside you and you climbing up / sliding down (false once it is over) */
  function mounting(g, st, x, y, s, sc, o, tn) {
    const M = st.mt; if (!M) return false;
    const u = (tn - M.t0) / MOUNT_T; if (u >= 1 || o.reduce) { st.mt = null; return false; }
    const hr = 30 * sc * s, hf = 36 * sc * s, k = hr / 61, dir = st.flip ? -1 : 1;
    const v = M.on ? u : 1 - u;   // 0 on foot .. 1 in the saddle
    const walk = M.on ? ease(v / 0.4) : 1 - ease((u - 0.6) / 0.4), hx = x - dir * 22 * sc * s * (1 - walk);   // the horse comes up from behind / steps back
    const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    g.save(); g.shadowColor = "rgba(255,244,214,.85)"; g.shadowBlur = 3 * dpr;
    try {
      if (v >= 0.72) {   // astride: the saddle figure, settling down into the seat
        const sink = (1 - ease((v - 0.72) / 0.28)) * 3 * sc * s;
        HEROART.drawFigure(g, { look: o.look }, hx, y - sink, { pose: "ride", frame: 0, h: hr, horse: M.horse, gait: "stand", flip: st.flip, hanim: true });
      } else {
        if (typeof FIGART !== "undefined" && FIGART.drawHorse) FIGART.drawHorse(g, M.horse, hx, y, { k, flip: st.flip, gait: "stand", anim: true });
        const up = ease((v - 0.4) / 0.32), lift = up * 26 * k;   // a foot in the stirrup, then up
        g.save(); g.translate(x + dir * 3 * sc * s * (1 - up), y - lift); g.rotate(dir * 0.18 * Math.sin(Math.PI * up));
        HEROART.drawFigure(g, { look: o.look }, 0, 0, { pose: "idle", frame: 0, h: hf, flip: st.flip });
        g.restore();
      }
    } catch { /* no figure renderer */ }
    g.restore();
    return true;
  }
  function draw(g, x, y, s, o = {}) {
    const st = stateOf(o.id || "me"), sc = o.scale || 1, h = (o.horse ? 30 : 36) * sc * s;
    face(st, x, y, o.heading, s);
    const tn = now(), hz = o.horse || null;
    if (st.hz !== undefined && !!st.hz !== !!hz && !o.reduce) { st.mt = { t0: tn, on: !!hz, horse: hz || st.hz }; busyUntil = Math.max(busyUntil, tn + MOUNT_T + 0.05); }
    st.hz = hz;
    if (st.moving && !o.moving && !o.reduce) { st.arrive = tn; busyUntil = Math.max(busyUntil, tn + 0.9); }
    st.moving = !!o.moving;
    const u = st.arrive ? (tn - st.arrive) / 0.9 : 2;
    const hop = u < 1 ? Math.sin(Math.min(1, u / 0.4) * Math.PI) * 4.5 * sc * s : 0;
    if (u < 1) dust(g, x, y, s * sc, u);
    // a soft ring on the ground in the hero's colour, so you can tell who is who at a glance
    const pulse = o.reduce ? 0.5 : (Math.sin((o.t || 0) * 3) + 1) / 2, rw = (o.horse ? 22 : 13) * sc * s;
    g.fillStyle = o.ring ? o.ring.replace(/^#(..)(..)(..)$/, (m, r, gg, b) => `rgba(${parseInt(r, 16)},${parseInt(gg, 16)},${parseInt(b, 16)},${0.22 + 0.14 * pulse})`) : "rgba(110,200,255,.3)";
    g.beginPath(); g.ellipse(x, y, rw + 3 * pulse * s, rw * 0.36 + pulse * s, 0, 0, 7); g.fill();
    const p = poseFor(o), dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    const busy = mounting(g, st, x, y - hop, s, sc, o, tn);
    if (!busy && !o.horse && o.led && typeof FIGART !== "undefined" && FIGART.drawHorse) {   // [riding] on foot: your horse walks along just behind you
      const dir = st.flip ? -1 : 1, k = 30 * sc * s / 61, cyc = o.reduce || !o.moving ? 0 : (((o.t || 0) / 1.1) % 1);
      g.save(); g.globalAlpha = 0.96;
      const lc = o.reduce ? 0 : o.moving ? cyc : ((o.t || 0) / 6.4) % 1;   // [mapheroanim] standing behind you it idles on its own loop
      try { FIGART.drawHorse(g, o.led, x - dir * 20 * sc * s, y - 1.5 * sc * s, { k, flip: st.flip, gait: o.moving && !o.reduce ? "walk" : "stand", cyc: lc, anim: !o.reduce }); } catch { /* no horse art */ }
      g.restore();
    }
    if (!busy && o.moving && !o.reduce) kick(g, x, y, sc * s, st.flip ? -1 : 1, o);
    if (!busy) {
      g.save();
      g.shadowColor = "rgba(255,244,214,.85)"; g.shadowBlur = 3 * dpr;   // a pale rim so the ink figure reads on dark ground
      try { HEROART.drawFigure(g, { look: o.look }, x, y - hop, { pose: p.pose, frame: p.frame, steps: p.steps, h, horse: o.horse || undefined, gait: p.gait, flip: st.flip, hanim: !o.reduce }); }
      catch { /* no figure renderer: the caller falls back */ }
      g.restore();
    }
    const top = y - hop - h * (o.horse ? 1.5 : 1.06), head = y - hop - h * (o.horse ? 1.32 : 0.9);
    if (o.label) label(g, String(o.label), x, top - 7 * s, s, o.labelSize || 14 * sc, o.labelColor || "#d8f0ff");
    return { top, head };
  }
  function label(g, text, x, y, s, size, color) {
    g.save(); g.font = `700 ${size * s}px "Cormorant Garamond", Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineJoin = "round"; g.lineWidth = 3.4 * s; g.strokeStyle = "rgba(24,17,10,.95)"; g.fillStyle = color;
    g.strokeText(text, x, y); g.fillText(text, x, y); g.restore();
  }
  const figure = (g, hero, x, y, t, opts = {}) => draw(g, x, y, opts.s || 1, { ...hero, ...opts, t });
  return { draw, figure, ok, poseFor, MOUNT_T, mountingNow: (id) => !!HEROES.get(id || "me")?.mt, active: () => now() < busyUntil, flipped: (id) => !!HEROES.get(id)?.flip };
})();
