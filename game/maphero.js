/* MAPHERO: you and the other heroes on the world map as little figures of your actual character (figart.js), not dots. [OURS]
   On foot: standing still they breathe and their cloak sways; on the road they walk, facing the way they go.
   On a horse (HORSES.riding): sitting in the saddle; the horse stands (tail swish, head nod), walks, or gallops when the
   going is fast. A small hop and a puff of dust when a trip ends. Works in both art styles (the figure follows ART).
   Reduce motion (Settings → Accessibility) keeps everyone still: one standing frame, no hop, no dust.
   API: MAPHERO.draw(g, x, y, s, o) → { top, head }  (feet at x,y in map units; s = one screen px in map units)
          o = { id, look, horse: coat colour | null, moving, gallop, t (seconds), reduce, heading (radians | null), scale, ring,
                label (text drawn centred above the head; leave out when the caller places names itself), labelColor, labelSize }
        MAPHERO.figure(g, hero, x, y, t, opts) → the same, for other screens (e.g. a PC full-screen map):
          hero = { id, look, horse, moving, gallop, heading }, opts = { s (one screen px in g's units, default 1), scale,
          reduce, ring, label, labelColor, labelSize }. The label is whatever the caller passes (a name, "Stranger", ...).
        MAPHERO.active() → true while an arrival puff is playing (the map keeps drawing smoothly)
        MAPHERO.flipped(id) → true when that hero faces left */
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
  function poseFor(o) {
    if (o.reduce) return o.horse ? { pose: "ride", frame: 0, gait: "stand" } : { pose: "idle", frame: 0 };
    const t = o.t || 0;
    if (o.horse) {
      const gait = !o.moving ? "stand" : o.gallop ? null : "walk", per = !o.moving ? 2.6 : o.gallop ? 0.5 : 1.1;
      return { pose: "ride", frame: Math.floor((t / per) * 4) % 4, gait };
    }
    if (o.moving) return { pose: "walk", frame: Math.floor((t / 0.9) * 8) % 8 };
    return { pose: "idle", frame: Math.floor((t / 2.4) * 4) % 4 };
  }
  function draw(g, x, y, s, o = {}) {
    const st = stateOf(o.id || "me"), sc = o.scale || 1, h = (o.horse ? 30 : 36) * sc * s;
    face(st, x, y, o.heading, s);
    const tn = now();
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
    g.save();
    g.shadowColor = "rgba(255,244,214,.85)"; g.shadowBlur = 3 * dpr;   // a pale rim so the ink figure reads on dark ground
    try { HEROART.drawFigure(g, { look: o.look }, x, y - hop, { pose: p.pose, frame: p.frame, h, horse: o.horse || undefined, gait: p.gait, flip: st.flip }); }
    catch { /* no figure renderer: the caller falls back */ }
    g.restore();
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
  return { draw, figure, ok, active: () => now() < busyUntil, flipped: (id) => !!HEROES.get(id)?.flip };
})();
