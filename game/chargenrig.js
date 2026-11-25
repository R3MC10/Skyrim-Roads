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
   Layout (both phone and PC): feet at 92% of the height, the figure about 85% of the height. */
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
    const k = Math.min(tall / (61 * bh), (W * 0.9) / 44);
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
  return { ok, paint, headAt, headState, preload, CLIP, FEET, TALL, ZOOM, REACH };
})();
if (typeof module !== "undefined") module.exports = CGRIG;
