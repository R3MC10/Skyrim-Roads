/* CGRIG: character creation drawn with the painted fight rig (rig.js). [OURS]
   chargen.js asks this module first; when the painted parts for the look have not loaded (or in node tests, or when
   the rig is broken) it returns false and the old ink figure (figart.js) is drawn instead, so nothing ever goes missing.
   The look is the same data the fights use (r, sx, a, eq), so changing race swaps the painted head and skin tint and
   keeps every other choice; the starting gear picks the leather / iron / steel set the same way a fight does.

     CGRIG.ok(look)                         → the painted parts for this look are ready
     CGRIG.paint(g, W, H, look, o)          → true when it drew. o: { pose: "idle"|"walk"|"attack", face, t, sx }
                                               pose → the rig clips idle / walk / ready; face zooms 2.5x on the head;
                                               sx flips (and narrows) the figure as it turns.
                                               o.floor / o.top (canvas px): the pose chips' top and the rotate / Face
                                               buttons' bottom; the figure stands between them.
     CGRIG.headState(sp)                    → "ok" / "wait" / "none": is this race's own painted head ready
     CGRIG.CLIP                             → the pose to clip map (tests)
     CGRIG.reach(look, clip)                → how far the clip reaches above the feet, weapon included (figure units)
   Layout (both phone and PC): feet at 92% of the height, the figure about 85% of the height, and the top of a raised
   weapon at least 4% of the height below the rotate / Face buttons (measured from the clip's frames, not guessed). */
const CGRIG = (() => {
  const CLIP = { idle: "idle", walk: "walk", attack: "ready" };
  const FEET = 0.92, TALL = 0.85, ZOOM = 2.5, REACH = 1.12;   // REACH: a raised blade reaches about 12% above the head
  const rig = () => (typeof PAINTRIG !== "undefined" && typeof RIGDATA !== "undefined" ? PAINTRIG : null);
  const spec = (look) => { try { return FIGART.specOf(FIGART.lookFor({ look })); } catch { return null; } };
  /* [raceheads] every race's painted head is asked for once, as soon as chargen opens, so switching race is instant */
  let asked = false;
  function preload() {
    if (asked || typeof ASSETS === "undefined" || typeof RIGDATA === "undefined" || !RIGDATA.HEADS) return;
    asked = true;
    for (const k of Object.keys(RIGDATA.HEADS)) { try { ASSETS.img(RIGDATA.headFile(k)); } catch { /* fine */ } }
  }
  /* the race's own head: "ok" (loaded, or the race wears the Nord head), "wait" (still loading) or "none" (no file:
     the Nord head with a skin tint, as before) */
  function headState(sp) {
    if (!sp || !sp.r || sp.r === "nord" || typeof RIGDATA === "undefined" || !RIGDATA.HEADS || typeof ASSETS === "undefined") return "ok";
    const key = sp.r + (sp.fem ? "f" : "m");
    if (!RIGDATA.HEADS[key]) return "ok";
    const st = ASSETS.stateOf(RIGDATA.headFile(key));
    return st === "ok" ? "ok" : st === "loading" ? "wait" : "none";
  }
  function ok(look) {
    const R = rig(); if (!R || R.broken) return false;
    preload();
    try { return R.can(look); } catch { return false; }
  }
  /* where the head sits in figure units (feet at 0,0) for this clip frame: the neck from the rig's own skeleton,
     moved up half the head's height */
  function headAt(sp, look, clip, u) {
    const R = rig();
    try {
      const G = R.geo(R.setOf(sp, look)), P = R.sample(clip, u), B = R.solve(G, P), q = G.P.head;
      return [B.N[0] / G.m * (sp.bw || 1), (B.N[1] - q.p[1] * G.u * 0.45) / G.m * (sp.bh || 1)];
    } catch { return [0, -55 * (sp.bh || 1)]; }
  }
  /* [nocover] how far the figure reaches above its feet (figure units) over the whole clip, held weapon included: each clip
     frame is drawn once off screen and the topmost painted row read back. Cached per look + clip; a figure whose parts were
     still arriving is measured again a couple of times (the biggest reach wins). null: can't tell (node, no canvas). */
  const BOUNDS = new Map(), NB = 10, BK = 2, BW = 220, BH = 360, BFEET = 340;
  function reach(look, clip) {
    if (typeof document === "undefined") return null;
    const key = clip + "|" + JSON.stringify(look), had = BOUNDS.get(key), now = Date.now();
    if (had && (had.n >= 3 || now - had.at < 1500)) return had.up;
    try {
      const R = rig(), C = RIGDATA.CLIPS[clip];
      const c = document.createElement("canvas"); c.width = BW; c.height = BH;
      const x = c.getContext("2d", { willReadFrequently: true }); if (!x) return had ? had.up : null;
      let top = BH;
      for (let i = 0; i < NB; i++) {
        x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, BW, BH);
        x.setTransform(BK, 0, 0, BK, BW / 2, BFEET);
        if (!R.draw(x, look, { clip, u: i / NB, t: C ? (i / NB) * C.len : 0 })) return had ? had.up : null;
        const d = x.getImageData(0, 0, BW, Math.max(1, Math.min(BH, top))).data;
        for (let j = 3; j < d.length; j += 4) if (d[j] > 40) { top = Math.floor((j >> 2) / BW); break; }
      }
      if (top >= BH) return had ? had.up : null;
      const up = Math.max((BFEET - top) / BK, had ? had.up : 0);
      BOUNDS.set(key, { up, at: now, n: (had ? had.n : 0) + 1 });
      return up;
    } catch { return had ? had.up : null; }
  }
  function paint(g, W, H, look, o = {}) {
    if (!ok(look)) return false;
    const R = rig(), sp = spec(look); if (!sp) return false;
    // [raceheads] the race's own head is still on its way: leave the stage empty for that moment, never a Nord head
    if (headState(sp) === "wait") return true;
    const clip = o.face ? "idle" : CLIP[o.pose] || "idle", C = RIGDATA.CLIPS[clip], t = o.t || 0;
    const u = C ? ((t / C.len) % 1 + 1) % 1 : 0, sx = o.sx || 1, bh = Math.max(0.8, sp.bh || 1);
    // feet at 92% (or just above the pose chips when they sit lower), about 85% tall, never higher than 4% from the top
    // [raceheads] o.top: the bottom of the rotate / Face buttons; the head and a raised blade stay below it
    const top = Math.max(H * 0.04, o.top > 0 && o.top < H * 0.4 ? o.top : 0);
    const feet = o.floor > H * 0.5 ? Math.min(H * FEET, o.floor) : H * FEET, tall = Math.min(H * TALL, (feet - top) / REACH);
    // [nocover] the clip's real reach (a raised blade included) stays at least 4% of the height below the buttons
    const up = o.face ? null : reach(look, clip);
    const k = up > 0 ? Math.min((H * TALL) / (61 * bh), (feet - top - H * 0.04) / up, (W * 0.9) / 44) : Math.min(tall / (61 * bh), (W * 0.9) / 44);
    try {
      g.save();
      if (!o.face) g.setTransform(sx * k, 0, 0, k, W / 2 + 2 * k * sx, feet);
      else {   // the face: 2.5x on the head, a little above the middle so the pose chips don't cover the chin
        const z = Math.min(k * ZOOM, (H * 0.36) / 12), [hx, hy] = headAt(sp, look, clip, u);
        g.setTransform(sx * z, 0, 0, z, W / 2 - hx * z * sx, H * 0.42 - hy * z);
      }
      const drew = R.draw(g, look, { clip, u, t, wt: o.face ? null : undefined, shield: o.face ? false : undefined });
      g.restore();
      return !!drew;
    } catch (e) { try { g.restore(); } catch { /* fine */ } if (typeof console !== "undefined") console.warn("cgrig", e); return false; }
  }
  return { ok, paint, reach, headAt, headState, preload, CLIP, FEET, TALL, ZOOM, REACH };
})();
if (typeof module !== "undefined") module.exports = CGRIG;
