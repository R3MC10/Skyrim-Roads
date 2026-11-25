/* MAPHERO: you and the other heroes on the world map as little figures of your actual character, not dots. [OURS]
   On foot: the painted figure as the hero looks right now (race, armour, weapon, shield; mapride.js walker), standing
   and breathing or walking, facing the way they go (the ink figure from figart.js until the painted parts load).
   On a horse (HORSES.riding): [maprider] a horse drawn by code with real legs (mapride.js) and the painted hero in the
   saddle; the travel pace picks the gait (standing, walk, trot, gallop) and the rider sits into it. A small hop and a
   puff of dust when a trip ends. Reduce motion (Settings → Accessibility): one still pose per gait, no hop, no dust.
   API: MAPHERO.draw(g, x, y, s, o) → { top, head }  (feet at x,y in map units; s = one screen px in map units)
          o = { id, look, horse: coat colour | null, led: coat colour | null (on foot, the horse walking behind you), moving, gallop,
                pace (travel speed against walking on open ground; guessed from moving / gallop when left out), t (seconds),
                reduce, simple (fewer details: a crowded party line), heading (radians | null), scale, ring,
                label (text drawn centred above the head; leave out when the caller places names itself), labelColor, labelSize }
        MAPHERO.figure(g, hero, x, y, t, opts) → the same, for other screens (e.g. a PC full-screen map):
          hero = { id, look, horse, moving, gallop, pace, heading }, opts = { s (one screen px in g's units, default 1), scale,
          reduce, ring, label, labelColor, labelSize }. The label is whatever the caller passes (a name, "Stranger", ...).
        MAPHERO.active() → true while an arrival puff, a mount / dismount or a gait change is playing (the map keeps drawing)
        MAPHERO.gait(id) → the horse's gait right now ("idle" | "walk" | "trot" | "gallop", null on foot)
   [riding] Getting on or off (o.horse turns on or off) plays a short move instead of a swap: the horse walks up from
   behind and you climb into the saddle, or you slide down and it steps back.
        MAPHERO.flipped(id) → true when that hero faces left
   Little dust puffs kick up behind the hooves (or boots) while you travel. */
const MAPHERO = (() => {
  const HEROES = new Map();   // id → { flip, last, moving, arrive, ride / led / mount: gait states (mapride.js) }
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
  const MR = () => typeof MAPRIDE !== "undefined";
  const MOUNT_T = 0.8;
  /* on foot: the frame for this moment (idle over 2.4 s, walking over 0.9 s, each hero on its own phase); in the saddle
     the horse's gait comes from mapride.js */
  function poseFor(o) {
    if (o.horse) return { pose: "ride" };
    if (o.reduce) return { pose: "idle", frame: 0, u: 0 };
    const t = Math.max(0, o.t || 0), ph = MR() ? MAPRIDE.offset(o.id) : 0;
    if (o.moving) return { pose: "walk", frame: Math.floor((t / 0.9 + ph) * 16) % 16, steps: 16, u: t / 0.9 + ph };
    return { pose: "idle", frame: Math.floor((t / 2.4 + ph) * 16) % 16, steps: 16, u: t / 2.4 + ph };
  }
  /* how fast you're going against walking on open ground (mapride.js picks the gait from it); guessed from moving /
     gallop when the caller doesn't know */
  const paceOf = (o) => (o.pace != null ? o.pace : !o.moving ? 0 : o.gallop ? 2.4 : o.horse ? 1.5 : 1);
  const KH = 0.6;   // canvas px per horse unit at scale 1: horse and rider stand ~44 px tall
  /* dust kicked up behind the hooves (or boots) while travelling: a few small puffs drifting back and fading */
  function kick(g, x, y, s, dir, o) {
    const t = o.t || 0, gal = !!o.horse && paceOf(o) >= 2, n = o.horse ? 4 : 2, per = o.horse ? (gal ? 0.45 : 0.8) : 0.9, back = (o.horse ? 11 : 3) * s;
    g.save();
    for (let i = 0; i < n; i++) {
      const u = (((t / per) + i / n) % 1 + 1) % 1, a = (1 - u) * (o.horse ? (gal ? 0.5 : 0.34) : 0.24);
      const hx = x - dir * (back + (i % 2 ? 9 * s : 0) * (o.horse ? 1 : 0) + u * (gal ? 14 : 7) * s), hy = y - u * 4 * s;
      g.fillStyle = `rgba(206,188,150,${a.toFixed(3)})`; g.beginPath(); g.arc(hx, hy, (1.4 + u * (gal ? 3.4 : 2.2)) * s, 0, 7); g.fill();
    }
    g.restore();
  }
  const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const dprOf = () => Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  /* the hero on foot: the painted figure as they look now (mapride.js), or the ink figure until its parts load */
  function onFoot(g, o, x, y, h, p, flip) {
    g.save(); g.shadowColor = "rgba(255,244,214,.85)"; g.shadowBlur = 3 * dprOf();   // a pale rim so the figure reads on dark ground
    try {
      if (!(MR() && MAPRIDE.walker(g, o.look, x, y, h, { clip: p.pose === "walk" ? "walk" : "idle", u: p.u || 0, flip })))
        HEROART.drawFigure(g, { look: o.look }, x, y, { pose: p.pose, frame: p.frame, steps: p.steps, h, flip });
    } catch { /* no figure renderer: the caller falls back */ }
    g.restore();
  }
  /* a horse (with you in the saddle, or no one: noRider), its own gait state kept in st[key] */
  function horseFig(g, st, key, x, y, k, o, extra) {
    if (!MR()) return null;
    try { return MAPRIDE.mounted(g, x, y, k, { look: o.look, coat: o.coat, st: (st[key] = st[key] || {}), flip: st.flip, t: o.t || 0, moving: !!o.moving, pace: o.pace, reduce: !!o.reduce, simple: !!o.simple, id: o.id, ...extra }); }
    catch { return null; }
  }
  /* getting on or off on the map: the horse beside you and you climbing up / sliding down (false once it is over) */
  function mounting(g, st, x, y, s, sc, o, tn) {
    const M = st.mt; if (!M) return false;
    const u = (tn - M.t0) / MOUNT_T; if (u >= 1 || o.reduce || !MR()) { st.mt = null; return false; }
    const k = KH * sc * s, hf = 36 * sc * s, dir = st.flip ? -1 : 1;
    const v = M.on ? u : 1 - u;   // 0 on foot .. 1 in the saddle
    const walk = M.on ? ease(v / 0.4) : 1 - ease((u - 0.6) / 0.4), hx = x - dir * 22 * sc * s * (1 - walk);   // the horse comes up from behind / steps back
    const base = { look: o.look, coat: M.horse, t: o.t, id: o.id, moving: walk > 0.02 && walk < 0.98, pace: 0.9 };
    if (v >= 0.72) {   // astride, settling down into the seat
      const sink = (1 - ease((v - 0.72) / 0.28)) * 3 * sc * s;
      horseFig(g, st, "ride", hx, y - sink, k, { ...base, moving: false });
    } else {
      horseFig(g, st, "mount", hx, y, k, base, { noRider: true });
      const up = ease((v - 0.4) / 0.32), lift = up * 16 * sc * s;   // a foot in the stirrup, then up
      g.save(); g.translate(x + dir * 3 * sc * s * (1 - up), y - lift); g.rotate(dir * 0.18 * Math.sin(Math.PI * up));
      onFoot(g, o, 0, 0, hf, { pose: "idle", u: 0, frame: 0 }, st.flip);
      g.restore();
    }
    return true;
  }
  function draw(g, x, y, s, o = {}) {
    const st = stateOf(o.id || "me"), sc = o.scale || 1, ride = !!o.horse && MR(), h = (o.horse ? 30 : 36) * sc * s, k = KH * sc * s;
    face(st, x, y, o.heading, s);
    const tn = now(), hz = o.horse || null;
    if (st.hz !== undefined && !!st.hz !== !!hz && !o.reduce) { st.mt = { t0: tn, on: !!hz, horse: hz || st.hz }; busyUntil = Math.max(busyUntil, tn + MOUNT_T + 0.05); }
    st.hz = hz;
    if (st.moving && !o.moving && !o.reduce) { st.arrive = tn; busyUntil = Math.max(busyUntil, tn + 0.9); }
    st.moving = !!o.moving;
    const u = st.arrive ? (tn - st.arrive) / 0.9 : 2;
    const hop = u < 1 ? Math.sin(Math.min(1, u / 0.4) * Math.PI) * (o.horse ? 2 : 4.5) * sc * s : 0;
    if (u < 1) dust(g, x, y, s * sc, u);
    // a soft ring on the ground in the hero's colour, so you can tell who is who at a glance
    const pulse = o.reduce ? 0.5 : (Math.sin((o.t || 0) * 3) + 1) / 2, rw = (o.horse ? 22 : 13) * sc * s;
    g.fillStyle = o.ring ? o.ring.replace(/^#(..)(..)(..)$/, (m, r, gg, b) => `rgba(${parseInt(r, 16)},${parseInt(gg, 16)},${parseInt(b, 16)},${0.22 + 0.14 * pulse})`) : "rgba(110,200,255,.3)";
    g.beginPath(); g.ellipse(x, y, rw + 3 * pulse * s, rw * 0.36 + pulse * s, 0, 0, 7); g.fill();
    const p = poseFor(o), pace = paceOf(o);
    const busy = mounting(g, st, x, y - hop, s, sc, o, tn);
    if (!busy && !o.horse && o.led) {   // [riding] on foot: your horse walks along just behind you, saddled, no one on it
      const dir = st.flip ? -1 : 1;
      horseFig(g, st, "led", x - dir * 22 * sc * s, y - 1.5 * sc * s, k * 0.92, { ...o, coat: o.led, pace: Math.min(1, pace) }, { noRider: true });
    }
    if (!busy && o.moving && !o.reduce) kick(g, x, y, sc * s, st.flip ? -1 : 1, o);
    let top = y - hop - h * 1.06, head = y - hop - h * 0.9;
    if (!busy && ride) {
      const r = horseFig(g, st, "ride", x, y - hop, k, { ...o, coat: o.horse, pace });
      if (r) { top = r.top; head = r.head; }
      if (!o.reduce && st.ride?.from) busyUntil = Math.max(busyUntil, tn + 0.3);   // a gait change is blending in
    } else if (!busy) onFoot(g, o, x, y - hop, h, p, st.flip);
    if (o.label) label(g, String(o.label), x, top - 7 * s, s, o.labelSize || 14 * sc, o.labelColor || "#d8f0ff");
    return { top, head };
  }
  function label(g, text, x, y, s, size, color) {
    g.save(); g.font = `700 ${size * s}px "Cormorant Garamond", Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineJoin = "round"; g.lineWidth = 3.4 * s; g.strokeStyle = "rgba(24,17,10,.95)"; g.fillStyle = color;
    g.strokeText(text, x, y); g.fillText(text, x, y); g.restore();
  }
  const figure = (g, hero, x, y, t, opts = {}) => draw(g, x, y, opts.s || 1, { ...hero, ...opts, t });
  return { draw, figure, ok, poseFor, paceOf, KH, MOUNT_T, mountingNow: (id) => !!HEROES.get(id || "me")?.mt, active: () => now() < busyUntil, flipped: (id) => !!HEROES.get(id)?.flip, gait: (id) => HEROES.get(id || "me")?.ride?.gait || null };
})();
