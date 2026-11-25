/* Foe rigs: every foe in a fight is a small 2D skeleton (bones in a hierarchy, body parts pinned to the bones, keyframed
   clips blended over time), so foes breathe, wind up and strike, bite, claw, breathe fire, cast, flinch when hit, stagger,
   dodge, fall when they're beaten and gloat when you are. Painted foe pictures are rigged as well. [OURS]
   Owner: "All enemies should have rigged animations, same as player characters."

   ---- the API (generic, so player figures can share it later) ----
   FOERIG.define(def) → rig
       def.bones  [[name, parent|null, x, y, rot?], ...]   rest pose; x,y in the parent's space; parents come first.
                  A limb bone's +y runs along the limb (FOERIG.dirRot(dx, dy) gives the rest rot that points it at dx,dy).
       def.parts  [[bone, z, draw(g, o, ctx)], ...]        drawn in the bone's space, lowest z first. A part with z given as
                  "abs:<z>" is drawn in the rig's root space instead (wing skins between bones); ctx.pt(bone, x, y) maps a
                  point on a bone into that space.
       def.clips  { name: { len: seconds, loop?, hit?: 0..1, k: { bone: [[t, rot, dx, dy, sx, sy], ...] } } }
                  t runs 0..1 over the clip; values are offsets on top of the rest pose (sx, sy default 1). Keys ease in/out.
       def.meta   { attacks: {fightMove: clip}, pic: {mode: "tall"|"long", bend, head, breath, lift, push}, arms: bool }
   FOERIG.pose(rig) → Float32Array (5 per bone: rot, dx, dy, sx, sy) · FOERIG.sample(rig, clip, u, pose, weight)
   FOERIG.solve(rig, pose, M) → bone-to-root matrices (6 per bone) · FOERIG.paint(g, rig, M, o, ctx) draws the parts.
   FOERIG.ctl(fightKind, foeName) → a controller for one foe on one stage:
       .event("hit" | "stagger" | "dodge" | "block" | "cast" | "taunt")   a one-shot clip that blends back to idle
       .update(dt)          moves one-shots and blends on (so slow motion and hit-stop slow the rig too)
       .clipFor(move)       the attack clip for a fight move (bite, claw, stomp, breath, cast, a weapon swing...)
       .draw(g, st)         st = { t, clip?, u?, hitU?, pose?, pic?, picH?, kit, dragon? }; a clip with u is locked to
                            the fight's beat (attacks to the move's timing, "death" to the fall), else one-shots, else idle.
       .state               the clip on screen (tests)
   FOERIG.kindOf(fightKind, name) → { body, skin, o }: which skeleton and skin a foe gets.
   FOERIG.BODIES: hum (people, undead, mages, giants, trolls, atronachs, spriggans, centurions), quad (wolves, bears, cats,
   skeevers, horkers, mammoths), spider (frostbite spiders, chaurus, Dwarven spiders), crab, sphere, wraith, wisp, dragon,
   wrap (Solstheim's odd ones: their old drawing hung on a root/body rig).
   Every body has these clips: idle, the attacks it uses, cast, hit, stagger, block (dodge), death, taunt.
   People: when HEROART.fightFigure(g, card, o) exists (the shared hero renderer, heroart.js/figart.js) it draws the bodies
   it knows (other players, plain bandits) and this rig moves them; otherwise this file's own humanoid parts are used.
   Painted pictures: tall ones are cut into bands that bend from the feet (spine), tilt at the neck (head) and breathe;
   long ones (beasts, spiders, crabs, dragons) are cut into slices whose front half lifts and lunges (neck/head) — all
   from the same pose as the drawn rig, with shear between slices so there are no seams. */
const FOERIG = (() => {
  const P = () => ART.PAL, H = () => ART.H;
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) * (-2 * x + 2) / 2);
  const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const dirRot = (dx, dy) => Math.atan2(dy, dx) - Math.PI / 2;
  const on = () => { try { return JSON.parse(localStorage.getItem("rotn_prefs") || "{}").foeRig !== false; } catch { return true; } };

  // ================================================================ core: bones, clips, blending, drawing
  function define(def) {
    const n = def.bones.length, idx = {}, par = new Int16Array(n), bx = new Float32Array(n), by = new Float32Array(n), br = new Float32Array(n);
    def.bones.forEach(([nm, p, x, y, r], i) => {
      if (p != null && idx[p] == null) throw new Error("foerig: parent must come before " + nm);
      idx[nm] = i; par[i] = p == null ? -1 : idx[p]; bx[i] = x; by[i] = y; br[i] = r || 0;
    });
    const parts = (def.parts || []).map(([b, z, fn], i) => { const abs = typeof z === "string"; return { b: idx[b] ?? 0, z: abs ? +z.slice(4) : z, abs, fn, i }; }).sort((a, b) => a.z - b.z || a.i - b.i);
    const clips = {};
    for (const [name, c] of Object.entries(def.clips || {})) {
      const tracks = [];
      for (const [b, keys] of Object.entries(c.k || {})) if (idx[b] != null) tracks.push({ b: idx[b], keys: keys.map((k) => [k[0], k[1] || 0, k[2] || 0, k[3] || 0, k[4] ?? 1, k[5] ?? 1]) });
      clips[name] = { name, len: c.len || 1, loop: !!c.loop, hit: c.hit ?? 0.48, tracks };
    }
    return { n, idx, par, bx, by, br, parts, clips, meta: def.meta || {} };
  }
  const pose = (R) => { const p = new Float32Array(R.n * 5); reset(p); return p; };
  function reset(p) { for (let i = 0; i < p.length; i += 5) { p[i] = p[i + 1] = p[i + 2] = 0; p[i + 3] = p[i + 4] = 1; } }
  /* add a clip at time u (0..1) with weight w, as offsets from the rest pose */
  function sample(R, clip, u, p, w = 1) {
    if (!clip) return;
    for (const tr of clip.tracks) {
      const k = tr.keys; let j = 1; while (j < k.length - 1 && k[j][0] < u) j++;
      const a = k[j - 1], b = k[j] || a, span = b[0] - a[0], e = span > 0 ? ease(c01((u - a[0]) / span)) : u >= b[0] ? 1 : 0, o = tr.b * 5;
      p[o] += w * (a[1] + (b[1] - a[1]) * e); p[o + 1] += w * (a[2] + (b[2] - a[2]) * e); p[o + 2] += w * (a[3] + (b[3] - a[3]) * e);
      p[o + 3] += w * (a[4] + (b[4] - a[4]) * e - 1); p[o + 4] += w * (a[5] + (b[5] - a[5]) * e - 1);
    }
  }
  /* bone → root-space matrices [a b c d e f] (canvas order) */
  function solve(R, p, M) {
    for (let i = 0; i < R.n; i++) {
      const o = i * 5, r = R.br[i] + p[o], c = Math.cos(r), s = Math.sin(r), sx = p[o + 3], sy = p[o + 4];
      const la = c * sx, lb = s * sx, lc = -s * sy, ld = c * sy, le = R.bx[i] + p[o + 1], lf = R.by[i] + p[o + 2], q = R.par[i], m = i * 6;
      if (q < 0) { M[m] = la; M[m + 1] = lb; M[m + 2] = lc; M[m + 3] = ld; M[m + 4] = le; M[m + 5] = lf; continue; }
      const t = q * 6, A = M[t], B = M[t + 1], C = M[t + 2], D = M[t + 3];
      M[m] = A * la + C * lb; M[m + 1] = B * la + D * lb; M[m + 2] = A * lc + C * ld; M[m + 3] = B * lc + D * ld; M[m + 4] = A * le + C * lf + M[t + 4]; M[m + 5] = B * le + D * lf + M[t + 5];
    }
  }
  function paint(g, R, M, o, ctx) {
    ctx.M = M; ctx.R = R;
    for (const pt of R.parts) {
      g.save();
      if (!pt.abs) { const m = pt.b * 6; g.transform(M[m], M[m + 1], M[m + 2], M[m + 3], M[m + 4], M[m + 5]); }
      pt.fn(g, o, ctx);
      g.restore();
    }
  }
  const ptOf = (ctx) => (b, x, y) => { const M = ctx.M, m = ctx.R.idx[b] * 6; return [M[m] * x + M[m + 2] * y + M[m + 4], M[m + 1] * x + M[m + 3] * y + M[m + 5]]; };

  // ================================================================ drawing helpers
  function seg(g, len, w, col, ink = true) {
    g.lineCap = "round"; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len);
    if (ink) { g.strokeStyle = P().ink; g.lineWidth = w + 2.4; g.stroke(); }
    g.strokeStyle = col; g.lineWidth = w; g.stroke();
  }
  function ell(g, x, y, rx, ry, rot, fill, lw = 1.5) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, 7); g.fillStyle = fill; g.fill(); if (lw) { g.strokeStyle = P().ink; g.lineWidth = lw; g.stroke(); } }
  function glow(g, x, y, r, c, a = 1) { const gr = g.createRadialGradient(x, y, 0.5, x, y, r); gr.addColorStop(0, "rgba(255,255,255," + 0.9 * a + ")"); gr.addColorStop(0.35, c); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  function eyes(g, c, pts, blur = 6) { g.fillStyle = c; g.shadowColor = c; g.shadowBlur = blur; for (const [x, y, w, h] of pts) g.fillRect(x, y, w || 2.4, h || 2); g.shadowBlur = 0; }
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return "#" + ((1 << 24) | (f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1); };
  function weaponOf(g, ctx, wt, glowOn, draw, wmat) {
    if (!wt || wt === "fist") return;
    if (ctx.kit && ctx.kit.weapon) return ctx.kit.weapon(g, wt, glowOn, draw || 0, wmat || null);
    g.lineCap = "round"; g.strokeStyle = P().ink; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(18, -18); g.stroke(); g.strokeStyle = P().steel; g.lineWidth = 3; g.stroke();
  }

  // ================================================================ clip helpers: keys are [t, rot, dx, dy, sx, sy]
  const K = (t, r = 0, dx = 0, dy = 0, sx = 1, sy = 1) => [t, r, dx, dy, sx, sy];
  const R0 = (...pairs) => pairs.map(([t, r]) => K(t, r));            // rotation-only track
  const DY = (...pairs) => pairs.map(([t, y]) => K(t, 0, 0, y));       // vertical-only track

  // ================================================================ HUMANOID skeleton (people, undead, giants, trolls, atronachs...)
  const HUM_BONES = (hunch = 0) => [
    ["root", null, 0, 0],
    ["hips", "root", 0, -26],
    ["thighB", "hips", -1, 0, 0.27], ["shinB", "thighB", 0, 13.4], ["footB", "shinB", 0, 13.4, -0.27],
    ["thighF", "hips", 1, 0, -0.33], ["shinF", "thighF", 0, 13.6], ["footF", "shinF", 0, 13.6, 0.33],
    ["robe", "hips", 0, 0],
    ["upper", "root", 0, 0, hunch],
    ["spine", "upper", 0, -26],
    ["cape", "spine", -8, -22],
    ["head", "spine", 1, -23],
    ["armB", "spine", -6, -20, 0.405], ["foreB", "armB", 0, 7.6], ["handB", "foreB", 0, 7.6, -0.405],
    ["armF", "spine", 7, -19, -1.483], ["foreF", "armF", 0, 7.2], ["hand", "foreF", 0, 8.6, 0.983],
  ];
  const HUM_CLIPS = {
    idle: { len: 2.6, loop: true, k: {
      spine: [K(0), K(0.5, 0.015, 0, 0, 1.012, 1.025), K(1)], head: R0([0, 0], [0.5, -0.05], [1, 0]),
      hips: DY([0, 0], [0.5, 0.6], [1, 0]), upper: DY([0, 0], [0.5, 0.6], [1, 0]),
      thighB: R0([0, 0], [0.5, 0.04], [1, 0]), shinB: R0([0, 0], [0.5, -0.06], [1, 0]), thighF: R0([0, 0], [0.5, -0.04], [1, 0]), shinF: R0([0, 0], [0.5, 0.08], [1, 0]),
      armF: R0([0, 0], [0.5, 0.07], [1, 0]), foreF: R0([0, 0], [0.5, -0.1], [1, 0]), armB: R0([0, 0], [0.5, -0.07], [1, 0]), foreB: R0([0, 0], [0.5, 0.12], [1, 0]),
      cape: R0([0, 0], [0.5, 0.08], [1, 0]), robe: [K(0), K(0.5, 0.02, 0, 0, 1.03, 1), K(1)] } },
    swing: { len: 1, hit: 0.48, k: {
      hips: DY([0, 0], [0.3, 1], [0.48, 2], [0.7, 1], [1, 0]), upper: [K(0), K(0.3, -0.05, -1, 1), K(0.48, 0.06, 2, 2), K(0.7, 0.03, 1, 1), K(1)],
      thighF: R0([0, 0], [0.3, -0.2], [0.48, -0.5], [0.7, -0.35], [1, 0]), shinF: R0([0, 0], [0.3, 0.2], [0.48, 0.45], [0.7, 0.3], [1, 0]),
      thighB: R0([0, 0], [0.3, 0.1], [0.48, 0.3], [0.7, 0.2], [1, 0]), shinB: R0([0, 0], [0.48, -0.05], [1, 0]),
      head: R0([0, 0], [0.3, 0.1], [0.48, -0.12], [0.7, -0.05], [1, 0]), cape: R0([0, 0], [0.3, -0.1], [0.48, 0.35], [0.7, 0.2], [1, 0]),
      foreF: R0([0, 0], [0.3, -0.5], [0.48, 0.1], [1, 0]), armB: R0([0, 0], [0.3, 0.4], [0.48, -0.5], [0.7, -0.3], [1, 0]), robe: [K(0), K(0.48, -0.1, 0, 0, 1.08, 1), K(1)] } },
    thrust: { len: 0.9, hit: 0.4, k: {
      hips: DY([0, 0], [0.25, 1], [0.4, 3], [0.65, 2], [1, 0]), upper: [K(0), K(0.25, -0.06, -1, 1), K(0.4, 0.1, 3, 3), K(0.65, 0.05, 2, 2), K(1)],
      thighF: R0([0, 0], [0.25, -0.25], [0.4, -0.7], [0.65, -0.5], [1, 0]), shinF: R0([0, 0], [0.25, 0.25], [0.4, 0.6], [0.65, 0.45], [1, 0]),
      thighB: R0([0, 0], [0.4, 0.45], [0.65, 0.3], [1, 0]), shinB: R0([0, 0], [0.4, -0.1], [1, 0]),
      head: R0([0, 0], [0.25, 0.08], [0.4, -0.1], [1, 0]), cape: R0([0, 0], [0.4, 0.4], [0.7, 0.2], [1, 0]), armB: R0([0, 0], [0.25, 0.5], [0.4, -0.3], [1, 0]) } },
    heavy: { len: 1.15, hit: 0.52, k: {
      hips: DY([0, 0], [0.35, -1.5], [0.52, 3], [0.75, 2], [1, 0]), upper: [K(0), K(0.35, -0.08, -1, -1.5), K(0.52, 0.1, 2, 3), K(0.75, 0.06, 1, 2), K(1)],
      thighF: R0([0, 0], [0.35, -0.1], [0.52, -0.55], [0.75, -0.45], [1, 0]), shinF: R0([0, 0], [0.35, 0.05], [0.52, 0.6], [0.75, 0.5], [1, 0]),
      thighB: R0([0, 0], [0.35, 0.05], [0.52, 0.4], [0.75, 0.3], [1, 0]), shinB: R0([0, 0], [0.52, 0.1], [1, 0]),
      head: R0([0, 0], [0.35, -0.15], [0.52, 0.18], [0.75, 0.1], [1, 0]), foreF: R0([0, 0], [0.35, -0.7], [0.52, 0.15], [1, 0]),
      armB: R0([0, 0], [0.35, -1.2], [0.52, 0.3], [1, 0]), foreB: R0([0, 0], [0.35, -0.8], [0.52, 0.2], [1, 0]), cape: R0([0, 0], [0.35, -0.2], [0.52, 0.45], [1, 0]) } },
    bow: { len: 1.05, hit: 0.72, k: {
      thighF: R0([0, 0], [0.3, -0.22], [0.8, -0.22], [1, 0]), thighB: R0([0, 0], [0.3, 0.16], [0.8, 0.16], [1, 0]), hips: DY([0, 0], [0.3, 1], [0.8, 1], [1, 0]), upper: DY([0, 0], [0.3, 1], [0.8, 1], [1, 0]),
      head: R0([0, 0], [0.4, 0.06], [0.72, 0.02], [0.78, -0.12], [1, 0]), cape: R0([0, 0], [0.75, 0.25], [1, 0]) } },
    cast: { len: 1, hit: 0.64, k: {
      hips: DY([0, 0], [0.35, -1], [0.5, 1], [1, 0]), upper: [K(0), K(0.35, -0.06, 0, -1), K(0.5, 0.06, 1, 1), K(1)],
      head: R0([0, 0], [0.3, -0.18], [0.5, 0.12], [0.75, 0.05], [1, 0]), robe: [K(0), K(0.35, -0.05, 0, 0, 1.12, 1), K(0.5, 0.08, 0, 0, 1.15, 1), K(1)],
      thighF: R0([0, 0], [0.5, -0.2], [1, 0]), shinF: R0([0, 0], [0.5, 0.15], [1, 0]), foreF: R0([0, 0], [0.3, -0.35], [0.5, 0], [1, 0]), foreB: R0([0, 0], [0.3, -0.5], [0.5, 0.1], [1, 0]),
      cape: R0([0, 0], [0.35, 0.35], [0.5, 0.15], [1, 0]) } },
    shout: { len: 1, hit: 0.6, k: {
      upper: [K(0), K(0.32, -0.1, -1, 0), K(0.46, 0.1, 2, 1), K(0.8, 0.06, 1, 1), K(1)], hips: DY([0, 0], [0.46, 1], [1, 0]),
      head: R0([0, 0], [0.32, -0.35], [0.46, 0.25], [0.8, 0.18], [1, 0]), thighF: R0([0, 0], [0.46, -0.32], [0.8, -0.25], [1, 0]), shinF: R0([0, 0], [0.46, 0.3], [1, 0]),
      armB: R0([0, 0], [0.32, 0.5], [0.46, -0.4], [1, 0]), cape: R0([0, 0], [0.46, 0.5], [1, 0]) } },
    claw: { len: 0.9, hit: 0.48, k: {
      armF: R0([0, 0], [0.3, -2.1], [0.48, 0.7], [0.65, 0.4], [1, 0]), foreF: R0([0, 0], [0.3, -0.5], [0.48, 0.2], [1, 0]),
      armB: R0([0, 0], [0.3, -1.8], [0.48, -0.6], [0.65, 0.7], [1, 0]), foreB: R0([0, 0], [0.3, -0.5], [0.65, 0.3], [1, 0]),
      hips: DY([0, 0], [0.3, 1], [0.48, 2.5], [1, 0]), upper: [K(0), K(0.3, -0.1, 0, 1), K(0.48, 0.12, 2, 2.5), K(0.7, 0.06, 1, 1), K(1)],
      thighF: R0([0, 0], [0.48, -0.45], [0.7, -0.3], [1, 0]), shinF: R0([0, 0], [0.48, 0.5], [1, 0]), thighB: R0([0, 0], [0.48, 0.3], [1, 0]),
      head: R0([0, 0], [0.3, -0.15], [0.48, 0.15], [1, 0]) } },
    hit: { len: 0.45, k: {
      root: [K(0), K(0.18, 0, -2.5), K(1)], upper: [K(0), K(0.15, -0.22, 0, 1), K(0.5, -0.08, 0, 0.5), K(1)], hips: DY([0, 0], [0.15, 1], [1, 0]),
      head: R0([0, 0], [0.12, -0.4], [0.5, -0.1], [1, 0]), armF: R0([0, 0], [0.15, 0.5], [1, 0]), armB: R0([0, 0], [0.15, -0.7], [1, 0]), foreB: R0([0, 0], [0.15, 0.6], [1, 0]),
      thighF: R0([0, 0], [0.15, -0.15], [1, 0]), shinB: R0([0, 0], [0.15, 0.2], [1, 0]), cape: R0([0, 0], [0.15, 0.3], [1, 0]), robe: [K(0), K(0.15, -0.08, 0, 0, 1.05, 1), K(1)] } },
    stagger: { len: 0.9, k: {
      root: [K(0), K(0.15, 0, -5), K(0.6, 0, -6), K(1)], upper: [K(0), K(0.12, -0.32, 0, 1), K(0.35, 0.18, 0, 3), K(0.6, -0.12, 0, 1.5), K(0.8, 0.05), K(1)],
      hips: DY([0, 0], [0.35, 3], [0.6, 1.5], [1, 0]), head: R0([0, 0], [0.12, -0.5], [0.35, 0.3], [0.6, -0.15], [1, 0]),
      thighF: R0([0, 0], [0.35, -0.45], [1, 0]), shinF: R0([0, 0], [0.35, 0.7], [1, 0]), thighB: R0([0, 0], [0.35, 0.25], [1, 0]), shinB: R0([0, 0], [0.35, 0.35], [1, 0]),
      armF: R0([0, 0], [0.12, 0.8], [0.35, 0.3], [1, 0]), armB: R0([0, 0], [0.12, -1.1], [0.35, -0.3], [1, 0]), cape: R0([0, 0], [0.12, 0.4], [0.35, -0.2], [1, 0]) } },
    block: { len: 0.55, k: {
      root: [K(0), K(0.15, 0, -3, -3), K(0.35, 0, -7), K(1)], hips: DY([0, 0], [0.4, 2], [1, 0]), upper: [K(0), K(0.25, -0.1, 0, 0), K(0.4, -0.08, 0, 2), K(1)],
      armB: R0([0, 0], [0.25, -1.5], [0.7, -1.4], [1, 0]), armF: R0([0, 0], [0.25, -0.4], [1, 0]), head: R0([0, 0], [0.25, 0.15], [1, 0]),
      thighF: R0([0, 0], [0.4, -0.35], [1, 0]), shinF: R0([0, 0], [0.4, 0.5], [1, 0]), thighB: R0([0, 0], [0.4, 0.2], [1, 0]) } },
    cower: { len: 1.2, loop: true, k: {
      upper: [K(0, -0.25, 0, 2), K(0.25, -0.22, 0, 2), K(0.5, -0.26, 0, 2), K(0.75, -0.22, 0, 2), K(1, -0.25, 0, 2)], hips: DY([0, 2], [1, 2]),
      head: R0([0, 0.35], [0.5, 0.3], [1, 0.35]), armB: R0([0, -1.5], [1, -1.5]), armF: R0([0, -1.0], [0.5, -1.1], [1, -1.0]),
      thighF: R0([0, -0.35], [1, -0.35]), shinF: R0([0, 0.55], [1, 0.55]), thighB: R0([0, 0.2], [1, 0.2]), shinB: R0([0, 0.3], [1, 0.3]) } },
    death: { len: 1, k: {
      hips: DY([0, 0], [0.25, 4], [0.5, 3], [1, 0]), upper: [K(0), K(0.25, -0.15, 0, 4), K(0.6, -0.1, 0, 2), K(1)],
      thighF: R0([0, 0], [0.25, -0.55], [0.6, -0.3], [1, -0.15]), shinF: R0([0, 0], [0.25, 0.9], [0.6, 0.4], [1, 0.25]),
      thighB: R0([0, 0], [0.25, 0.2], [1, 0.1]), shinB: R0([0, 0], [0.25, 0.6], [1, 0.2]),
      head: R0([0, 0], [0.25, -0.35], [0.7, 0.2], [1, -0.25]), armF: R0([0, 0], [0.3, 0.9], [0.7, 1.6], [1, 1.4]), foreF: R0([0, 0], [0.5, 0.4], [1, 0.2]),
      armB: R0([0, 0], [0.3, -1.0], [0.7, -0.4], [1, -0.6]), cape: R0([0, 0], [0.6, 0.6], [1, 0.9]),
      root: [K(0), K(0.3, -0.1), K(0.7, -1.15, -3, -4), K(1, -1.5708, -5, -7)] } },
    taunt: { len: 1.4, loop: true, k: {
      armF: R0([0, -1.5], [0.25, -1.85], [0.5, -1.4], [0.75, -1.85], [1, -1.5]), foreF: R0([0, -0.3], [0.5, -0.1], [1, -0.3]),
      armB: R0([0, -0.6], [0.5, -0.8], [1, -0.6]), head: R0([0, -0.22], [0.5, -0.32], [1, -0.22]),
      upper: [K(0, -0.08), K(0.25, -0.1, 0, 1.2), K(0.5, -0.12), K(0.75, -0.1, 0, 1.2), K(1, -0.08)], hips: DY([0, 0], [0.25, 1.2], [0.5, 0], [0.75, 1.2], [1, 0]),
      thighF: R0([0, -0.2], [1, -0.2]), cape: R0([0, 0.1], [0.5, 0.25], [1, 0.1]) } },
  };
  const HUM_ATTACKS = { dagger: "thrust", spear: "thrust", battleaxe: "heavy", greatsword: "heavy", warhammer: "heavy", club: "heavy", slam: "heavy", stomp: "heavy", bow: "bow", crossbow: "bow",
    cast: "cast", staff: "cast", drain: "cast", breath: "cast", shout: "shout", claw: "claw", bite: "claw", default: "swing" };

  // ---- humanoid heads (the old fight figure's looks, centred on the neck bone)
  function headOf(g, o) {
    const ink = P().ink, hx = 0, hy = -7, kind = o.head;
    const C = (x, y, r, f, w = 1.4) => H().circle(g, x, y, r, f, ink, w), Pl = (pts, f, w = 1.3) => H().poly(g, pts, f, ink, w);
    if (kind === "skull") { C(hx, hy, 7, "#e6e0cc"); g.fillStyle = ink; g.fillRect(hx - 4, hy - 2, 3, 3); g.fillRect(hx + 2, hy - 2, 3, 3); g.fillRect(hx + 1, hy + 3, 4, 1.4); }
    else if (kind === "falmer") { C(hx, hy, 7, o.skin); Pl([[hx - 5, hy - 3], [hx - 13, hy - 9], [hx - 6, hy + 1]], o.skin, 1); g.strokeStyle = ink; g.lineWidth = 1; g.beginPath(); g.moveTo(hx + 1, hy - 2); g.lineTo(hx + 6, hy - 2); g.stroke(); g.fillStyle = "#7a3a2a"; g.fillRect(hx + 3, hy + 2, 4, 1.6); }
    else if (kind === "bird") { C(hx, hy, 7, "#7a6a7a"); Pl([[hx + 5, hy - 2], [hx + 15, hy + 2], [hx + 5, hy + 3]], "#c9a24c", 1); for (let i = 0; i < 4; i++) H().poly(g, [[hx - 6, hy - 6 + i * 3], [hx - 16, hy - 10 + i * 4], [hx - 6, hy - 3 + i * 3]], "#3a3040", null); }
    else if (kind === "leaves") { C(hx, hy, 6, o.skin); for (let i = -2; i <= 2; i++) Pl([[hx + i * 3 - 2, hy - 4], [hx + i * 4.5 - 2, hy - 15 + Math.abs(i) * 2], [hx + i * 3 + 2, hy - 4]], i % 2 ? "#5f7a3a" : "#7a9a4a", 0.8); }
    else { C(hx, hy, 7, o.skin); if (kind === "hair") H().poly(g, [[hx - 7, hy - 1], [hx - 6, hy - 7], [hx + 4, hy - 8], [hx + 7, hy - 4], [hx - 2, hy - 4]], o.hair || "#6b4a2a", null); }
    if (kind === "helm" || kind === "horned") { Pl([[hx - 8, hy + 1], [hx - 7, hy - 7], [hx + 7, hy - 7], [hx + 8, hy + 1]], o.helmColor || P().iron); if (kind === "horned") { Pl([[hx - 7, hy - 5], [hx - 14, hy - 14], [hx - 8, hy - 8]], o.hornC || "#e6e0cc", 1); Pl([[hx + 7, hy - 5], [hx + 14, hy - 14], [hx + 8, hy - 8]], o.hornC || "#e6e0cc", 1); } }
    if (kind === "hood") Pl([[hx - 9, hy + 6], [hx - 8, hy - 6], [hx, hy - 11], [hx + 8, hy - 5], [hx + 4, hy + 1], [hx - 4, hy + 4]], o.hoodColor || o.body);
    if (kind === "mask") Pl([[hx - 7, hy + 6], [hx - 8, hy - 6], [hx + 8, hy - 6], [hx + 7, hy + 6]], "#b8893e");
    if (kind === "feathers") for (let i = -1; i <= 1; i++) Pl([[hx + i * 4 - 1, hy - 6], [hx + i * 7, hy - 20], [hx + i * 4 + 2, hy - 6]], ["#8e2b25", "#e9dcc0", "#3d5d36"][i + 1], 0.8);
    if (o.eyes) eyes(g, o.eyes, [[hx + 2, hy - 2, 3, 2], [hx - 3, hy - 2, 3, 2]]);
  }
  function shieldOf(g, o) {
    const ink = P().ink;
    if (o.shieldShape === "round") { H().circle(g, 3, -1, 9, o.shieldColor || "#8a6a44", ink, 1.4); g.strokeStyle = o.shieldTrim || P().iron; g.lineWidth = 1.6; g.beginPath(); g.arc(3, -1, 6.5, 0, 7); g.stroke(); H().circle(g, 3, -1, 2.2, o.shieldTrim || P().iron, ink, 0.8); }
    else { H().poly(g, [[-2, -11], [8, -11], [9, 2], [3, 10], [-3, 2]], o.shieldColor || "#8a6a44", ink, 1.4); H().circle(g, 3, -2, 2, P().iron, null); }
  }

  // ---- humanoid skins: which parts hang on the bones
  function personParts(o) {
    const robe = o.legs === "robe", arm = () => o.armC || o.skin, pants = o.pants || "#5a4836";
    const leg = (bn, z, col) => [bn, z, (g) => { if (!robe) seg(g, 13.5, 5, col); }];
    const boot = (bn, z) => [bn, z, (g) => { if (!robe && o.boots) H().poly(g, [[-3.5, -7], [3.5, -7], [5, 0], [-4, 0]], o.boots, P().ink, 1); }];
    const backArm = [["armB", 0, (g) => seg(g, 7.6, 4.2, arm())], ["foreB", 0.1, (g) => seg(g, 7.6, 4.2, arm())], ["handB", 0.2, (g) => { if (o.shield) { g.translate(2, -2); shieldOf(g, o); } }]];
    return [
      leg("thighB", 1, shade(pants, 0.85)), leg("shinB", 1.1, shade(pants, 0.85)), boot("footB", 1.2), leg("thighF", 2, pants), leg("shinF", 2.1, pants), boot("footF", 2.2),
      ["robe", 3, (g) => { if (robe) H().poly(g, [[-11, 26], [-8, -2], [8, -2], [12, 26]], o.body, P().ink, 1.4); }],
      ["cape", 3.5, (g) => { if (o.cape) H().poly(g, [[0, 0], [-8, 38], [4, 34]], o.cape, P().ink, 1.2); }],
      ...backArm.map(([b, dz, fn]) => [b, 4 + dz, (g, oo, ctx) => { if (!ctx.bf) fn(g); }]),
      ["spine", 5, (g, oo, ctx) => {
        H().poly(g, [[-9, 0], [-10, -22], [10, -22], [9, 0]], o.body, P().ink, 1.5);
        if (o.gear && ctx.kit && ctx.kit.gearTorso) { g.save(); g.translate(0, 26); ctx.kit.gearTorso(g, o.gear, o.gear.f || {}); g.restore(); }
        g.fillStyle = P().ink; g.fillRect(-9, -4, 18, 2.4);
        if (o.off && !o.shield) { g.save(); g.translate(-3, -5); g.rotate(0.55); weaponOf(g, ctx, o.off, o.glow, 0, o.wmat); g.restore(); }
      }],
      ...backArm.map(([b, dz, fn]) => [b, 5.5 + dz, (g, oo, ctx) => { if (ctx.bf) fn(g); }]),
      ["head", 6, (g) => headOf(g, o)],
      ["armF", 7, (g) => seg(g, 7.2, 4.2, arm())], ["foreF", 7.1, (g) => seg(g, 7.4, 4.2, arm())],
      ["hand", 7.2, (g, oo, ctx) => { if (o.claws) { g.strokeStyle = P().ink; g.lineWidth = 1.2; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(6, i * 3 + 1); g.stroke(); } } weaponOf(g, ctx, ctx.wt, o.glow, ctx.draw, o.wmat); }],
    ];
  }
  function bonesParts(o) {   // a skeleton: bones on the bones
    const bone = (len) => (g) => { seg(g, len, 2.6, "#e6e0cc"); };
    return [
      ["thighB", 1, bone(13.4)], ["shinB", 1.1, bone(13.4)], ["thighF", 2, bone(13.6)], ["shinF", 2.1, bone(13.6)],
      ["armB", 3, bone(7.6)], ["foreB", 3.1, bone(7.6)],
      ["hips", 3.5, (g) => H().poly(g, [[-6, -2], [6, -2], [4, 3], [-4, 3]], "#e6e0cc", P().ink, 1)],
      ["spine", 4, (g) => { g.save(); g.rotate(Math.PI); seg(g, 22, 2.6, "#e6e0cc"); g.restore(); for (let i = 0; i < 3; i++) { g.save(); g.translate(-7, -18 + i * 5); g.rotate(-Math.PI / 2); seg(g, 14, 2.4, "#e6e0cc"); g.restore(); } }],
      ["head", 6, (g) => headOf(g, { ...o, head: "skull" })],
      ["armF", 7, bone(7.2)], ["foreF", 7.1, bone(7.4)], ["hand", 7.2, (g, oo, ctx) => weaponOf(g, ctx, ctx.wt || "sword", false, 0)],
    ];
  }
  function constructParts(o) {   // a Dwarven centurion: brass legs and pistons, a hammer arm
    const br = "#a07a36", br2 = "#c9a24c", lim = (len, w) => (g) => { seg(g, len, w, br); g.fillStyle = "#6a5020"; g.fillRect(-1, 2, 2, len - 4); };
    return [
      ["thighB", 1, lim(13.4, 7)], ["shinB", 1.1, lim(13.4, 6)], ["footB", 1.2, (g) => H().poly(g, [[-5, -3], [6, -3], [7, 1], [-5, 1]], br, P().ink, 1)],
      ["armB", 2, lim(7.6, 6)], ["foreB", 2.1, lim(7.6, 5)], ["handB", 2.2, (g) => H().poly(g, [[-2, -2], [10, -1], [10, 2], [-2, 3]], br2, P().ink, 1)],
      ["thighF", 3, lim(13.6, 7)], ["shinF", 3.1, lim(13.6, 6)], ["footF", 3.2, (g) => H().poly(g, [[-5, -3], [6, -3], [7, 1], [-5, 1]], br, P().ink, 1)],
      ["hips", 3.5, (g) => H().poly(g, [[-10, -3], [10, -3], [8, 4], [-8, 4]], br, P().ink, 1.3)],
      ["spine", 4, (g, oo, ctx) => {
        H().poly(g, [[-13, 0], [-14, -24], [14, -24], [13, 0]], br2, P().ink, 1.5); H().poly(g, [[-6, -20], [6, -20], [5, -6], [-5, -6]], br, P().ink, 1);
        glow(g, 0, -13, 5 + Math.sin(ctx.t * 5) * 1, "rgba(232,146,58,0.8)");
        if (ctx.steam > 0) for (let i = 0; i < 3; i++) H().circle(g, -14 - i * 4, -24 - i * 5 - ctx.steam * 6, 3 + i, "rgba(240,240,240," + 0.5 * ctx.steam + ")", null);
      }],
      ["head", 6, (g) => { H().poly(g, [[-6, 0], [-6, -12], [6, -12], [6, 0]], br, P().ink, 1.3); g.fillStyle = "#e8923a"; g.shadowColor = "#e8923a"; g.shadowBlur = 6; g.fillRect(-3, -8, 7, 2); g.shadowBlur = 0; }],
      ["armF", 7, lim(7.2, 7)], ["foreF", 7.1, lim(7.4, 6)],
      ["hand", 7.2, (g) => { g.lineCap = "round"; g.strokeStyle = P().ink; g.lineWidth = 4.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(14, -14); g.stroke(); g.strokeStyle = "#6a5020"; g.lineWidth = 2.4; g.stroke(); H().poly(g, [[9, -22], [22, -10], [18, -5], [4, -17]], br2, P().ink, 1.3); }],
    ];
  }
  function golemParts(o) {   // a frost atronach: heavy limbs of ice
    const ice = o.ice || "#bfe0f0", ice2 = o.ice2 || "#7fb0d8", ink = P().ink;
    const chunk = (len, w) => (g) => { H().poly(g, [[-w, 0], [w * 0.8, -1], [w, len * 0.6], [w * 0.4, len + 1], [-w * 0.7, len]], ice, ink, 1.2); g.strokeStyle = "#ffffff"; g.globalAlpha = 0.5; g.lineWidth = 1; g.beginPath(); g.moveTo(-w * 0.3, 2); g.lineTo(-w * 0.2, len - 3); g.stroke(); g.globalAlpha = 1; };
    return [
      ["thighB", 1, chunk(13.4, 5)], ["shinB", 1.1, chunk(13.4, 4.5)], ["armB", 2, chunk(7.6, 4.5)], ["foreB", 2.1, chunk(9, 5)], ["handB", 2.2, (g) => H().circle(g, 0, 2, 5, ice2, ink, 1.2)],
      ["thighF", 3, chunk(13.6, 5)], ["shinF", 3.1, chunk(13.6, 4.5)],
      ["spine", 4, (g, oo, ctx) => {
        H().poly(g, [[-11, 2], [-15, -14], [-9, -26], [2, -30], [13, -24], [15, -10], [10, 2]], ice, ink, 1.5);
        for (const [x, y, h] of [[-12, -24, 12], [-4, -28, 14], [6, -26, 10]]) H().poly(g, [[x - 2.5, y], [x, y - h], [x + 2.5, y]], ice2, ink, 1);
        glow(g, 0, -13, 7 + Math.sin(ctx.t * 3) * 1.2, "rgba(159,208,240,0.75)");
      }],
      ["head", 6, (g) => { H().poly(g, [[-6, 0], [-7, -9], [0, -14], [7, -9], [6, 0]], ice, ink, 1.3); eyes(g, "#e8f8ff", [[1, -8, 4, 2]], 8); }],
      ["armF", 7, chunk(7.2, 5)], ["foreF", 7.1, chunk(9, 5.5)], ["hand", 7.2, (g) => H().poly(g, [[-5, -3], [5, -5], [8, 3], [1, 7], [-5, 4]], ice2, ink, 1.2)],
    ];
  }
  function flameParts(o) {   // a flame atronach: a figure of fire, floating
    const fl = (g, x, y, r, t) => { const gr = g.createRadialGradient(x, y, 0.5, x, y, r); gr.addColorStop(0, "#fff2c0"); gr.addColorStop(0.45, "#e8923a"); gr.addColorStop(1, "rgba(196,87,46,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * (1 + Math.sin(t * 9 + x) * 0.08), 0, 7); g.fill(); };
    const limb = (len, r) => (g, oo, ctx) => { for (let i = 0; i <= 2; i++) fl(g, 0, len * i / 2, r * (1 - i * 0.15), ctx.t); };
    return [
      ["armB", 2, limb(7.6, 4.5)], ["foreB", 2.1, limb(7.6, 4)],
      ["hips", 3, (g, oo, ctx) => { for (let i = 0; i < 4; i++) fl(g, Math.sin(ctx.t * 5 + i) * 2, 4 + i * 5, 7 - i * 1.4, ctx.t); }],
      ["spine", 4, (g, oo, ctx) => { fl(g, 0, -8, 12, ctx.t); fl(g, 0, -18, 10, ctx.t + 1); g.fillStyle = "#3b2c1e"; g.globalAlpha = 0.5; g.beginPath(); g.ellipse(0, -14, 5, 9, 0, 0, 7); g.fill(); g.globalAlpha = 1; }],
      ["head", 6, (g, oo, ctx) => { fl(g, 0, -7, 8, ctx.t); for (const sd of [-1, 1]) H().poly(g, [[sd * 3, -10], [sd * 9, -20 - Math.sin(ctx.t * 6) * 2], [sd * 6, -8]], "#e8923a", null); eyes(g, "#fff8d0", [[1, -8, 3, 1.6], [-3, -8, 3, 1.6]], 8); }],
      ["armF", 7, limb(7.2, 4.5)], ["foreF", 7.1, limb(7.4, 4)], ["hand", 7.2, (g, oo, ctx) => fl(g, 2, 0, 6 + (ctx.charge || 0) * 6, ctx.t)],
    ];
  }
  function stormParts(o) {   // a storm atronach: rocks held together by lightning
    const rock = (w, h) => (g) => H().poly(g, [[-w, 0], [w * 0.6, -h * 0.2], [w, h * 0.6], [0, h], [-w * 0.8, h * 0.7]], "#6a6470", P().ink, 1.2);
    const zap = (g, x1, y1, x2, y2) => { g.strokeStyle = "#c8b8ff"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x1, y1); for (let i = 1; i < 4; i++) g.lineTo(x1 + (x2 - x1) * i / 4 + (Math.random() - 0.5) * 4, y1 + (y2 - y1) * i / 4 + (Math.random() - 0.5) * 4); g.lineTo(x2, y2); g.stroke(); };
    return [
      ["hips", 2, (g, oo, ctx) => { for (let i = 0; i < 3; i++) { const a = ctx.t * 2 + i * 2.1; H().circle(g, Math.cos(a) * 9, 6 + i * 6, 3 - i * 0.5, "#5a5460", P().ink, 1); } }],
      ["armB", 3, rock(4, 7)], ["foreB", 3.1, rock(3.5, 7)],
      ["spine", 4, (g, oo, ctx) => { glow(g, 0, -12, 13, "rgba(200,184,255,0.7)"); rock(7, 9)(g); g.save(); g.translate(0, -24); rock(8, 10)(g); g.restore(); if (!ctx.still) { zap(g, -4, -4, 3, -16); zap(g, 6, -20, 9, -6); } }],
      ["head", 6, (g) => { H().poly(g, [[-5, 0], [-6, -8], [0, -12], [6, -8], [5, 0]], "#7a7480", P().ink, 1.2); eyes(g, "#e0d8ff", [[1, -7, 3, 2]], 8); }],
      ["armF", 7, rock(4, 7)], ["foreF", 7.1, rock(3.5, 8)], ["hand", 7.2, (g, oo, ctx) => glow(g, 0, 0, 5 + (ctx.charge || 0) * 6, "rgba(200,184,255,0.8)")],
    ];
  }
  function sprigganParts(o) {   // a spriggan: thin bark limbs, a leafy crown, a glowing heart
    const bark = o.skin || "#5a4632", ink = P().ink, gl = o.glowC || "#e8c24a";
    const twig = (len, w) => (g) => { seg(g, len, w, bark); g.strokeStyle = shade(bark, 0.7); g.lineWidth = 0.8; g.beginPath(); g.moveTo(-0.5, 1); g.lineTo(0.5, len - 1); g.stroke(); };
    return [
      ["thighB", 1, twig(13.4, 3.2)], ["shinB", 1.1, twig(13.4, 2.8)], ["armB", 2, twig(7.6, 2.8)], ["foreB", 2.1, twig(8, 2.4)],
      ["handB", 2.2, (g) => { g.strokeStyle = ink; g.lineWidth = 1.1; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(i * 2.5, 6); g.stroke(); } }],
      ["thighF", 3, twig(13.6, 3.2)], ["shinF", 3.1, twig(13.6, 2.8)],
      ["spine", 4, (g, oo, ctx) => { H().poly(g, [[-6, 0], [-8, -22], [8, -22], [6, 0]], bark, ink, 1.4); glow(g, 1, -12, 7 + Math.sin(ctx.t * 4) * 1.2 + (ctx.charge || 0) * 5, gl); g.strokeStyle = shade(bark, 0.7); g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-6 + i * 4, -2); g.lineTo(-4 + i * 4, -20); g.stroke(); } }],
      ["head", 6, (g) => headOf(g, { head: "leaves", skin: bark, eyes: gl })],
      ["armF", 7, twig(7.2, 2.8)], ["foreF", 7.1, twig(8, 2.4)],
      ["hand", 7.2, (g, oo, ctx) => { g.strokeStyle = ink; g.lineWidth = 1.1; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(7, i * 3); g.stroke(); } if (ctx.charge) glow(g, 6, 0, 4 + ctx.charge * 6, gl); }],
    ];
  }
  const HUM_SKINS = { person: personParts, bones: bonesParts, construct: constructParts, golem: golemParts, flame: flameParts, storm: stormParts, spriggan: sprigganParts };
  function humRig(o, skin) {
    return define({ bones: HUM_BONES(o.hunch || 0), parts: HUM_SKINS[skin](o), clips: HUM_CLIPS,
      meta: { arms: true, attacks: o.attacks || HUM_ATTACKS, pic: { mode: "tall", bend: ["upper", "spine"], head: ["head"], breath: "spine" } } });
  }

  // ================================================================ FOUR-LEGGED beasts (wolves, bears, sabre cats, skeevers, horkers, mammoths)
  function quadRig(o) {
    const L = o.len, Hh = o.height, h = o.head, ink = P().ink, c = o.color, far = shade(c, 0.72), legLen = Hh * 0.55, tl = o.tail === "long" ? L * 0.32 : L * 0.2;
    const xs = [["lbF", -0.35, 1], ["lbN", -0.2, 0], ["lfF", 0.25, 1], ["lfN", 0.4, 0]];
    const bones = [["root", null, 0, 0], ["body", "root", 0, -Hh * 0.68]];
    for (const [nm, x] of xs) { bones.push([nm, "body", L * x, Hh * 0.13]); bones.push([nm + "s", nm, 0, legLen / 2]); }
    bones.push(["neck", "body", L * 0.38, -Hh * 0.05], ["head", "neck", L * 0.12, -((o.headY || 0.85) - 0.63) * Hh], ["jaw", "head", h * 0.55, h * 0.22],
      ["tail1", "body", -L * 0.48, -Hh * 0.02, dirRot(-1, o.tail === "long" ? 0.5 : -0.4)], ["tail2", "tail1", 0, tl], ["trunk1", "head", h * 1.05, h * 0.3], ["trunk2", "trunk1", 0, h * 1.1]);
    const legPart = (nm, isFar, top) => [nm, isFar ? 1 : 1.2, (g) => seg(g, legLen / 2 + (top ? 1 : 0), o.legW, isFar ? far : c)];
    const parts = [];
    for (const [nm, , f] of xs) { parts.push(legPart(nm, f, true)); parts.push([nm + "s", f ? 1 : 1.2, (g) => { seg(g, legLen / 2, o.legW * 0.9, f ? far : c); if (o.flipper) H().poly(g, [[-o.legW, legLen / 2 - 1], [o.legW * 2, legLen / 2 - 1], [o.legW * 2.2, legLen / 2 + 1.5], [-o.legW, legLen / 2 + 1.5]], f ? far : c, ink, 1); }]); }
    if (o.tail) parts.push(["tail1", 1.5, (g) => seg(g, tl, o.tail === "long" ? 1.6 : 4, o.tail === "long" ? "#b89a8a" : c)], ["tail2", 1.5, (g) => seg(g, tl * 0.9, o.tail === "long" ? 1.4 : 3.4, o.tail === "long" ? "#b89a8a" : c)]);
    parts.push(["neck", 1.8, (g) => { const hx = L * 0.12, hy = -((o.headY || 0.85) - 0.63) * Hh; ell(g, hx * 0.5, hy * 0.5, Math.hypot(hx, hy) * 0.5 + h * 0.6, h * 0.8, Math.atan2(hy, hx), c, 1.4); }]);
    parts.push(["body", 2, (g, oo, ctx) => {
      ell(g, 0, 0, L * 0.52, Hh * 0.34, 0, c, 1.5);
      if (o.stripes) { g.strokeStyle = ink; g.lineWidth = 1.4; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * L * 0.13, -Hh * 0.27); g.lineTo(i * L * 0.13 + 3, Hh * 0.08); g.stroke(); } }
      if (o.fur) { g.strokeStyle = shade(c, 0.7); g.lineWidth = 1; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * L * 0.12, Hh * 0.2); g.lineTo(i * L * 0.12 - 2, Hh * 0.34); g.stroke(); } }
      if (o.mane) H().poly(g, [[L * 0.2, -Hh * 0.3], [L * 0.45, -Hh * 0.18], [L * 0.38, Hh * 0.05], [L * 0.18, -Hh * 0.05]], shade(c, 0.85), ink, 1);
    }]);
    parts.push(["jaw", 2.9, (g, oo, ctx) => {
      H().poly(g, [[0, -h * 0.05], [h * 1.0, -h * 0.12], [h * 1.0, h * 0.08], [0, h * 0.25]], "#6a1a18", null);   // the mouth inside
      H().poly(g, [[0, h * 0.02], [h * 0.95, h * 0.02], [0, h * 0.32]], shade(c, 0.9), ink, 1.1);
      if (o.fangs && ctx.jaw > 0.15) { g.fillStyle = "#fff"; g.fillRect(h * 0.7, -h * 0.1, 1.6, h * 0.18); }
    }]);
    parts.push(["head", 3, (g, oo, ctx) => {
      ell(g, 0, 0, h, h * 0.8, 0, c, 1.4);
      H().poly(g, [[h * 0.6, -h * 0.25], [h * 1.6, h * 0.08], [h * 0.6, h * 0.3]], c, ink, 1.3);
      if (o.ears) H().poly(g, [[-h * 0.4, -h * 0.6], [-h * 0.2, -h * 1.5], [h * 0.2, -h * 0.7]], c, ink, 1.2);
      if (o.fangs) { g.fillStyle = "#fff"; g.fillRect(h * 0.9, h * 0.25, 2, h * 0.5); }
      if (o.tusks) { g.strokeStyle = ink; g.lineWidth = 4.6; g.beginPath(); g.moveTo(h * 0.8, h * 0.4); g.quadraticCurveTo(h * 2.2, h * 1.4, h * 2.4, -h * 0.2); g.stroke(); g.strokeStyle = "#f4efe0"; g.lineWidth = 3; g.stroke(); }
      if (o.horker) { g.strokeStyle = ink; g.lineWidth = 3.4; g.beginPath(); g.moveTo(h * 1.1, h * 0.3); g.lineTo(h * 1.2, h * 1.6); g.stroke(); g.strokeStyle = "#f4efe0"; g.lineWidth = 2; g.stroke(); }
      g.fillStyle = o.eye || ink; if (o.eye) { g.shadowColor = o.eye; g.shadowBlur = 4; } g.fillRect(h * 0.25, -h * 0.3, 2.4, 2.4); g.shadowBlur = 0;
    }]);
    if (o.trunk) parts.push(["trunk1", 3.1, (g) => seg(g, h * 1.1, h * 0.42, c)], ["trunk2", 3.2, (g) => seg(g, h * 1.0, h * 0.32, c)]);
    // clips, sized to the beast
    const legs = (pairs) => { const k = {}; for (const [nm, tr] of Object.entries(pairs)) k[nm] = tr; return k; };
    const rear = o.big ? 0.3 : 0.45;
    const clips = {
      idle: { len: o.big ? 3 : 2.2, loop: true, k: legs({ body: [K(0), K(0.5, 0, 0, Hh * 0.02, 1.015, 1.04), K(1)], neck: R0([0, 0], [0.5, -0.06], [1, 0]), head: R0([0, 0], [0.5, 0.05], [1, 0]),
        jaw: R0([0, 0.05], [0.5, o.pant ? 0.25 : 0.05], [1, 0.05]), tail1: R0([0, 0], [0.5, 0.18], [1, 0]), tail2: R0([0, 0], [0.5, 0.25], [1, 0]), trunk1: R0([0, 0.1], [0.5, -0.15], [1, 0.1]), trunk2: R0([0, 0.2], [0.5, -0.1], [1, 0.2]) }) },
      bite: { len: 0.85, hit: 0.48, k: legs({
        body: [K(0), K(0.3, 0.06, -2, Hh * 0.06), K(0.48, -0.06, 3, -Hh * 0.04), K(0.62, -0.02, 2), K(1)], neck: R0([0, 0], [0.3, 0.25], [0.48, -0.15], [0.62, 0.05], [1, 0]),
        head: [K(0), K(0.3, 0.1), K(0.48, -0.05, 3, 0), K(1)], jaw: R0([0, 0], [0.3, 0.3], [0.44, 0.7], [0.5, 0], [0.62, 0.15], [1, 0]),
        lfN: R0([0, 0], [0.3, 0.3], [0.48, -0.7], [0.7, -0.2], [1, 0]), lfF: R0([0, 0], [0.3, 0.2], [0.48, -0.5], [1, 0]), lfNs: R0([0, 0], [0.3, 0.4], [0.48, -0.1], [1, 0]),
        lbN: R0([0, 0], [0.3, -0.2], [0.48, 0.55], [0.7, 0.2], [1, 0]), lbF: R0([0, 0], [0.48, 0.4], [1, 0]), lbNs: R0([0, 0], [0.3, 0.3], [0.48, 0], [1, 0]),
        tail1: R0([0, 0], [0.3, -0.2], [0.48, 0.4], [1, 0]) }) },
      claw: { len: 0.9, hit: 0.48, k: legs({
        root: [K(0), K(0.3, -rear * 0.5, -2, 0), K(0.48, 0.05, 2, 0), K(1)], body: [K(0), K(0.3, -rear, 0, -Hh * 0.05), K(0.48, 0.1, 2, Hh * 0.05), K(0.65, 0.05), K(1)],
        lfN: R0([0, 0], [0.3, -1.7], [0.48, -0.1], [0.65, 0.2], [1, 0]), lfNs: R0([0, 0], [0.3, -0.8], [0.48, 0.2], [1, 0]), lfF: R0([0, 0], [0.3, -1.2], [0.48, 0.3], [1, 0]), lfFs: R0([0, 0], [0.3, -0.6], [1, 0]),
        lbN: R0([0, 0], [0.3, rear * 0.8], [1, 0]), lbF: R0([0, 0], [0.3, rear * 0.6], [1, 0]),
        neck: R0([0, 0], [0.3, -0.2], [0.48, 0.25], [1, 0]), jaw: R0([0, 0], [0.25, 0.6], [0.5, 0.4], [0.7, 0.1], [1, 0]), tail1: R0([0, 0], [0.3, 0.4], [1, 0]) }) },
      stomp: { len: 1.1, hit: 0.52, k: legs({
        body: [K(0), K(0.36, -0.32, -2, -Hh * 0.08), K(0.52, 0.06, 2, Hh * 0.04), K(0.72, 0.02), K(1)], lfN: R0([0, 0], [0.36, -1.0], [0.52, 0.1], [1, 0]), lfF: R0([0, 0], [0.36, -0.8], [0.52, 0.1], [1, 0]),
        lfNs: R0([0, 0], [0.36, 0.6], [0.52, 0], [1, 0]), lbN: R0([0, 0], [0.36, 0.32], [0.52, 0], [1, 0]), lbF: R0([0, 0], [0.36, 0.32], [0.52, 0], [1, 0]),
        neck: R0([0, 0], [0.36, -0.35], [0.52, 0.2], [1, 0]), trunk1: R0([0, 0], [0.36, -1.4], [0.52, 0.3], [1, 0]), trunk2: R0([0, 0], [0.36, -0.8], [0.52, 0.3], [1, 0]),
        jaw: R0([0, 0], [0.36, 0.4], [0.6, 0.1], [1, 0]), tail1: R0([0, 0], [0.36, 0.3], [1, 0]) }) },
      hit: { len: 0.45, k: legs({ root: [K(0), K(0.18, 0, -3), K(1)], body: [K(0), K(0.15, -0.12, 0, -Hh * 0.04), K(1)], neck: R0([0, 0], [0.15, -0.35], [1, 0]), jaw: R0([0, 0], [0.15, 0.5], [0.6, 0.1], [1, 0]),
        lfN: R0([0, 0], [0.15, -0.3], [1, 0]), lbN: R0([0, 0], [0.15, 0.2], [1, 0]), tail1: R0([0, 0], [0.15, -0.4], [1, 0]) }) },
      stagger: { len: 0.9, k: legs({ root: [K(0), K(0.15, 0, -6), K(0.6, 0, -7), K(1)], body: [K(0), K(0.12, -0.18, 0, -Hh * 0.05), K(0.35, 0.15, 0, Hh * 0.1), K(0.6, -0.06), K(1)],
        neck: R0([0, 0], [0.12, -0.4], [0.35, 0.45], [0.6, -0.1], [1, 0]), jaw: R0([0, 0], [0.12, 0.5], [0.4, 0.2], [1, 0]), lfN: R0([0, 0], [0.35, 0.5], [1, 0]), lfNs: R0([0, 0], [0.35, -0.6], [1, 0]),
        lbN: R0([0, 0], [0.35, -0.3], [1, 0]), tail1: R0([0, 0], [0.12, -0.5], [0.35, 0.3], [1, 0]) }) },
      block: { len: 0.55, k: legs({ root: [K(0), K(0.15, 0, -4, -Hh * 0.15), K(0.35, 0, -8), K(1)], body: [K(0), K(0.15, -0.15), K(0.4, 0.05, 0, Hh * 0.05), K(1)],
        lfN: R0([0, 0], [0.15, -0.5], [0.4, 0.2], [1, 0]), lbN: R0([0, 0], [0.15, 0.4], [1, 0]), neck: R0([0, 0], [0.2, -0.3], [1, 0]), jaw: R0([0, 0], [0.2, 0.45], [0.6, 0.1], [1, 0]) }) },
      cast: null,
      death: { len: 1, k: legs({ lfN: R0([0, 0], [0.3, 0.6], [1, -1.0]), lfF: R0([0, 0], [0.3, 0.5], [1, -0.7]), lbN: R0([0, 0], [0.3, -0.5], [1, 0.9]), lbF: R0([0, 0], [0.3, -0.4], [1, 0.7]),
        lfNs: R0([0, 0], [1, 1.2]), lbNs: R0([0, 0], [1, -1.2]), lfFs: R0([0, 0], [1, 1.0]), lbFs: R0([0, 0], [1, -1.0]),
        body: [K(0), K(0.3, 0.1, 0, Hh * 0.15), K(1, 0.05)], neck: R0([0, 0], [0.3, 0.5], [1, -0.2]), jaw: R0([0, 0], [0.3, 0.6], [1, 0.4]), tail1: R0([0, 0], [1, 0.6]),
        root: [K(0), K(0.35, 0.05, 0, 0, 1, 0.92), K(0.6, 0, 0, -Hh * 0.35, 1, 0.1), K(1, 0, 0, -Hh * 0.82, 1, -0.82)] }) },
      taunt: { len: 1.6, loop: true, k: legs({ neck: R0([0, -0.55], [0.5, -0.7], [1, -0.55]), head: R0([0, -0.35], [0.5, -0.45], [1, -0.35]), jaw: R0([0, 0.55], [0.25, 0.7], [0.5, 0.4], [0.75, 0.7], [1, 0.55]),
        body: [K(0, -0.12, 0, -Hh * 0.04), K(0.5, -0.15, 0, -Hh * 0.06, 1.02, 1.05), K(1, -0.12, 0, -Hh * 0.04)], lfN: R0([0, -0.25], [1, -0.25]), lbN: R0([0, 0.2], [1, 0.2]),
        tail1: R0([0, 0.4], [0.5, 0.7], [1, 0.4]), trunk1: R0([0, -1.6], [0.5, -1.9], [1, -1.6]), trunk2: R0([0, -0.8], [0.5, -1.0], [1, -0.8]) }) },
    };
    clips.cast = clips.taunt.k && { len: 1, hit: 0.6, k: clips.bite.k };
    return define({ bones, parts, clips, meta: { attacks: { bite: "bite", claw: o.claws ? "claw" : "bite", stomp: o.trunk ? "stomp" : "claw", slam: "stomp", default: o.claws ? "claw" : "bite" },
      pic: { mode: "long", lift: ["body", "neck"], push: ["neck", "head"], breath: "body", jaw: "jaw" } } });
  }

  // ================================================================ SPIDERS, the chaurus and Dwarven spiders
  function spiderRig(o) {
    const ink = P().ink, dw = o.mode === "dwarven", ch = o.mode === "chaurus", pairs = ch ? 3 : 4, legC = o.leg, farC = shade(o.leg, 0.7);
    const bones = [["root", null, 0, 0], ["body", "root", 6, -16], ["abd", "body", ch ? -20 : -18, ch ? -1 : -2], ["head", "body", ch ? 10 : 8, ch ? 1 : 0], ["fang", "head", 6, 4], ["fang2", "head", 6, 4]];
    const legNames = [];
    for (let i = 0; i < pairs; i++) for (const side of ["F", "N"]) {
      const dir = i < pairs / 2 ? -1 : 1, x = -6 + i * (12 / (pairs - 1)), nm = "l" + i + side;
      const up = [dir * (8 + Math.abs(i - (pairs - 1) / 2) * 2.5) * (side === "F" ? 0.8 : 1), -13], foot = [dir * (16 + Math.abs(i - (pairs - 1) / 2) * 5) * (side === "F" ? 0.8 : 1), 16];
      const r1 = dirRot(up[0], up[1]), lo = [foot[0] - up[0], foot[1] - up[1]], r2 = dirRot(lo[0], lo[1]) - r1;
      bones.push([nm, "body", x, 2, r1], [nm + "s", nm, 0, Math.hypot(up[0], up[1]), r2]);
      legNames.push([nm, side === "F", Math.hypot(up[0], up[1]), Math.hypot(lo[0], lo[1]), dir, i]);
    }
    const parts = [];
    for (const [nm, f, l1, l2] of legNames) { const z = f ? 1 : 4; parts.push([nm, z, (g) => seg(g, l1, dw ? 2.2 : 2.4, f ? farC : legC)], [nm + "s", z + 0.1, (g) => { seg(g, l2, dw ? 1.8 : 2, f ? farC : legC); if (dw) H().circle(g, 0, 0, 1.6, "#c9a24c", ink, 0.8); }]); }
    parts.push(["abd", 2, (g, oo, ctx) => {
      if (ch) { for (let i = 0; i < 4; i++) ell(g, -i * 6, i * 0.6, 9 - i * 1.2, 7.5 - i, 0, i % 2 ? shade(o.body, 0.85) : o.body, 1.3); }
      else if (dw) { ell(g, 0, 0, 13, 10, 0, o.body, 1.5); g.strokeStyle = "#6a5020"; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.stroke(); glow(g, 0, 0, 5 + Math.sin(ctx.t * 4), "rgba(159,208,240,0.7)"); }
      else { ell(g, 0, 0, 15, 12, 0, o.body, 1.5); g.strokeStyle = shade(o.body, 0.75); g.lineWidth = 1.2; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-10, i * 4); g.quadraticCurveTo(0, i * 4 - 3, 10, i * 4); g.stroke(); } }
    }]);
    parts.push(["body", 2.5, (g) => ell(g, 0, 0, ch ? 10 : 9, ch ? 7 : 8, 0, ch ? shade(o.body, 1.1) : legC, 1.4)]);
    const fang = (sd) => (g) => { g.strokeStyle = ink; g.lineWidth = 2.6; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(4, 2 * sd, 2, 6); g.stroke(); g.strokeStyle = ch ? "#c9a878" : dw ? "#c9a24c" : "#3a3030"; g.lineWidth = 1.4; g.stroke(); };
    parts.push(["fang2", 2.8, fang(-1)], ["fang", 3.2, fang(1)]);
    parts.push(["head", 3, (g, oo, ctx) => {
      ell(g, 0, 0, ch ? 7 : 8, ch ? 6 : 7, 0, ch ? o.body : legC, 1.4);
      if (ch) { g.strokeStyle = ink; g.lineWidth = 1; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(3, -4); g.quadraticCurveTo(10, -14 + sd * 2, 16, -10 + sd * 3 + Math.sin(ctx.t * 3 + sd) * 2); g.stroke(); } }
      eyes(g, o.eye, ch ? [[3, -2, 2, 2]] : [[3, -3, 2, 2], [6, -2, 2, 2], [4, 0, 1.6, 1.6]], dw ? 6 : 3);
    }]);
    const legK = (fn) => { const k = {}; for (const [nm, , , , dir, i] of legNames) { const tr = fn(dir, i, nm); if (tr) { k[nm] = tr[0]; if (tr[1]) k[nm + "s"] = tr[1]; } } return k; };
    const clips = {
      idle: { len: 1.6, loop: true, k: { body: [K(0), K(0.5, 0, 0, 0.8), K(1)], abd: [K(0), K(0.5, 0.04, 0, 0, 1.03, 1.05), K(1)], fang: R0([0, 0], [0.5, 0.2], [1, 0]), fang2: R0([0, 0], [0.5, -0.2], [1, 0]),
        ...legK((dir, i) => [R0([0, 0], [0.5, (i % 2 ? 0.06 : -0.06)], [1, 0])]) } },
      bite: { len: 0.85, hit: 0.48, k: { body: [K(0), K(0.3, -0.35, -2, -2), K(0.48, 0.18, 3, 1), K(0.65, 0.05, 1), K(1)], abd: R0([0, 0], [0.3, 0.3], [0.48, -0.15], [1, 0]),
        head: R0([0, 0], [0.3, -0.1], [0.48, 0.15], [1, 0]), fang: R0([0, 0], [0.3, -0.6], [0.48, 0.5], [1, 0]), fang2: R0([0, 0], [0.3, 0.6], [0.48, -0.5], [1, 0]),
        ...legK((dir, i) => dir > 0 && i >= pairs - 2 ? [R0([0, 0], [0.3, -0.9 + (i - pairs + 2) * 0.3], [0.48, 0.3], [1, 0]), R0([0, 0], [0.3, -0.6], [0.48, 0.2], [1, 0])] : [R0([0, 0], [0.3, 0.15], [0.48, -0.1], [1, 0])]) } },
      cast: { len: 1, hit: 0.64, k: { body: [K(0), K(0.4, -0.3, -1, -2), K(0.6, 0.1, 1), K(1)], abd: [K(0), K(0.3, 0.2, 0, 0, 1.12, 1.15), K(0.55, -0.1, 0, 0, 0.92, 0.92), K(1)],
        head: R0([0, 0], [0.4, -0.25], [0.6, 0.15], [1, 0]), fang: R0([0, 0], [0.4, -0.7], [0.65, 0], [1, 0]), fang2: R0([0, 0], [0.4, 0.7], [0.65, 0], [1, 0]) } },
      hit: { len: 0.45, k: { root: [K(0), K(0.18, 0, -3), K(1)], body: [K(0), K(0.15, -0.2, 0, -1), K(1)], ...legK((dir) => [R0([0, 0], [0.15, dir * -0.25], [1, 0])]), fang: R0([0, 0], [0.15, -0.5], [1, 0]) } },
      stagger: { len: 0.9, k: { root: [K(0), K(0.15, 0, -6), K(0.6, 0, -6), K(1)], body: [K(0), K(0.12, -0.3, 0, -2), K(0.35, 0.2, 0, 2), K(0.6, -0.1), K(1)], ...legK((dir, i) => [R0([0, 0], [0.2, (i % 2 ? 0.4 : -0.4)], [0.5, (i % 2 ? -0.3 : 0.3)], [1, 0])]) } },
      block: { len: 0.55, k: { root: [K(0), K(0.15, 0, -4, -3), K(0.35, 0, -9), K(1)], ...legK((dir, i) => dir > 0 ? [R0([0, 0], [0.2, -0.6], [1, 0])] : [R0([0, 0], [0.2, 0.3], [1, 0])]), body: R0([0, 0], [0.2, -0.2], [1, 0]) } },
      death: { len: 1, k: { ...legK((dir) => [R0([0, 0], [0.4, dir * 0.6], [1, dir * 1.1]), R0([0, 0], [0.4, dir * 0.8], [1, dir * 1.6])]), body: [K(0), K(0.4, 0.15, 0, 3), K(1, 0, 0, 6)],
        root: [K(0), K(0.4, 0, 0, 0, 1, 0.9), K(0.7, 0, 0, -6, 1, 0.1), K(1, 0, 0, -18, 1, -0.85)], fang: R0([0, 0], [1, -0.4]) } },
      taunt: { len: 1.2, loop: true, k: { body: [K(0, -0.3, 0, -2), K(0.5, -0.36, 0, -3), K(1, -0.3, 0, -2)], abd: R0([0, 0.2], [0.5, 0.3], [1, 0.2]),
        ...legK((dir, i) => dir > 0 && i === pairs - 1 ? [R0([0, -1.2], [0.25, -1.5], [0.5, -1.0], [0.75, -1.5], [1, -1.2]), R0([0, -0.5], [0.5, -0.8], [1, -0.5])] : null),
        fang: R0([0, -0.4], [0.25, 0.3], [0.5, -0.4], [0.75, 0.3], [1, -0.4]), fang2: R0([0, 0.4], [0.25, -0.3], [0.5, 0.4], [0.75, -0.3], [1, 0.4]) } },
    };
    return define({ bones, parts, clips, meta: { attacks: { cast: "cast", breath: "cast", default: "bite" }, pic: { mode: "long", lift: ["body", "head"], push: ["body"], breath: "abd" } } });
  }

  // ================================================================ MUDCRABS
  function crabRig(o) {
    const ink = P().ink, c = o.color || "#8a6a5a", c2 = shade(c, 1.15), far = shade(c, 0.75);
    const bones = [["root", null, 0, 0], ["body", "root", 0, -11], ["stalk", "body", 6, -7]];
    for (const [nm, x, side] of [["cF", 12, 1], ["cN", 14, 0]]) bones.push([nm, "body", x, -2, dirRot(1, -1.2)], [nm + "f", nm, 0, 9, dirRot(1, 0.5) - dirRot(1, -1.2)], [nm + "j", nm + "f", 0, 8, 0]);
    for (let i = 0; i < 3; i++) for (const sd of ["F", "N"]) bones.push(["g" + i + sd, "body", -10 + i * 6, 4, dirRot(i < 1 ? -1 : 0.6, 1.4)]);
    const parts = [];
    for (let i = 0; i < 3; i++) for (const sd of ["F", "N"]) parts.push(["g" + i + sd, sd === "F" ? 1 : 3.5, (g) => seg(g, 10, 2.2, sd === "F" ? far : c)]);
    const claw = (isFar) => [[isFar ? "cF" : "cN", isFar ? 1.2 : 4, (g) => seg(g, 9, 3.4, isFar ? far : c)], [(isFar ? "cF" : "cN") + "f", isFar ? 1.3 : 4.1, (g) => { seg(g, 8, 3.4, isFar ? far : c); g.translate(0, 8); g.rotate(-0.5); H().poly(g, [[-3, -1], [3, -2], [12, 2], [2, 3]], isFar ? far : c2, ink, 1.1); }],
      [(isFar ? "cF" : "cN") + "j", isFar ? 1.4 : 4.2, (g) => { g.rotate(0.35); H().poly(g, [[-2, 0], [3, 1], [9, 6], [0, 4]], isFar ? far : c2, ink, 1); }]];
    parts.push(...claw(true));
    parts.push(["stalk", 2, (g, oo, ctx) => { for (const x of [0, 4]) { g.strokeStyle = ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 1, -2); g.stroke(); H().circle(g, x + 1, -3, 1.8, "#1c1414", ink, 0.6); } }]);
    parts.push(["body", 3, (g) => { H().poly(g, [[-18, 7], [-15, -6], [-4, -10], [10, -8], [17, -2], [18, 7]], c, ink, 1.5); g.strokeStyle = shade(c, 0.7); g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-12 + i * 9, -7 + Math.abs(i - 1) * 2); g.lineTo(-10 + i * 9, 5); g.stroke(); } }]);
    parts.push(...claw(false));
    const clips = {
      idle: { len: 1.8, loop: true, k: { body: [K(0), K(0.5, 0, 0, 0.6, 1.02, 1.03), K(1)], cN: R0([0, 0], [0.5, -0.12], [1, 0]), cF: R0([0, 0], [0.5, 0.1], [1, 0]), cNj: R0([0, 0], [0.25, 0.4], [0.35, 0], [1, 0]), cFj: R0([0, 0], [0.6, 0.35], [0.7, 0], [1, 0]), stalk: R0([0, 0], [0.5, 0.15], [1, 0]) } },
      claw: { len: 0.9, hit: 0.48, k: { cN: R0([0, 0], [0.3, -1.4], [0.48, 0.3], [0.7, 0.1], [1, 0]), cNf: R0([0, 0], [0.3, -0.6], [0.48, 0.2], [1, 0]), cNj: R0([0, 0], [0.3, 0.8], [0.48, 0], [0.6, 0.5], [0.7, 0], [1, 0]),
        cF: R0([0, 0], [0.3, -0.5], [0.48, 0.2], [1, 0]), body: [K(0), K(0.3, -0.12, -2, -1), K(0.48, 0.1, 3, 0), K(1)] } },
      hit: { len: 0.45, k: { root: [K(0), K(0.18, 0, -3), K(1)], body: [K(0), K(0.15, -0.15, 0, -2), K(1)], cN: R0([0, 0], [0.15, -0.6], [1, 0]), cF: R0([0, 0], [0.15, -0.5], [1, 0]) } },
      stagger: { len: 0.9, k: { root: [K(0), K(0.15, 0, -6), K(0.6, 0, -6), K(1)], body: [K(0), K(0.12, -0.3, 0, -3), K(0.35, 0.2), K(0.6, -0.1), K(1)], cN: R0([0, 0], [0.2, -0.9], [0.5, 0.3], [1, 0]) } },
      block: { len: 0.55, k: { root: [K(0), K(0.35, 0, -8), K(1)], cN: R0([0, 0], [0.2, -1.6], [0.8, -1.4], [1, 0]), cNf: R0([0, 0], [0.2, -1.0], [1, 0]), cF: R0([0, 0], [0.2, -1.2], [1, 0]), body: DY([0, 0], [0.3, 2], [1, 0]) } },
      death: { len: 1, k: { cN: R0([0, 0], [1, 1.0]), cF: R0([0, 0], [1, 0.8]), body: [K(0), K(0.4, 0.2, 0, 2), K(1, 0, 0, 4)], root: [K(0), K(0.4, 0, 0, 0, 1, 0.8), K(0.7, 0, 0, -6, 1, 0.1), K(1, 0, 0, -14, 1, -0.85)] } },
      taunt: { len: 1, loop: true, k: { cN: R0([0, -1.3], [0.5, -1.6], [1, -1.3]), cF: R0([0, -1.1], [0.5, -1.4], [1, -1.1]), cNj: R0([0, 0], [0.2, 0.8], [0.35, 0], [0.7, 0.8], [0.85, 0], [1, 0]), cFj: R0([0, 0.8], [0.3, 0], [0.6, 0.8], [1, 0.8]), body: DY([0, 0], [0.5, -2], [1, 0]) } },
    };
    clips.bite = clips.claw; clips.cast = clips.claw;
    return define({ bones, parts, clips, meta: { attacks: { default: "claw" }, pic: { mode: "long", lift: ["body", "cN"], push: ["body"], breath: "body" } } });
  }

  // ================================================================ DWARVEN SPHERES (a ball that unrolls into a soldier)
  function sphereRig(o) {
    const ink = P().ink, br = "#b8893e", br2 = "#c9a24c";
    const bones = [["root", null, 0, 0], ["ball", "root", 0, -15], ["upper", "root", 0, 0], ["spine", "upper", 0, -30], ["head", "spine", 0, -22],
      ["armB", "spine", -6, -16, 0.405], ["foreB", "armB", 0, 8], ["handB", "foreB", 0, 7, -0.405], ["armF", "spine", 6, -15, -1.483], ["foreF", "armF", 0, 7.2], ["hand", "foreF", 0, 8.6, 0.983]];
    const parts = [
      ["armB", 1, (g) => seg(g, 8, 3.4, br)], ["foreB", 1.1, (g) => seg(g, 7, 3, br)], ["handB", 1.2, (g) => { g.rotate(-0.4); H().poly(g, [[-2, -2], [14, -2], [14, 1], [-2, 2]], "#6a5020", ink, 1); H().poly(g, [[10, -6], [13, -6], [13, 6], [10, 6]], br2, ink, 0.8); }],
      ["ball", 2, (g, oo, ctx) => { H().circle(g, 0, 0, 15, br, ink, 1.6); g.save(); g.rotate(ctx.spin || 0); g.strokeStyle = "#6a5020"; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, 10, 0, 7); g.moveTo(-15, 0); g.lineTo(15, 0); g.moveTo(0, -15); g.lineTo(0, 15); g.stroke(); g.restore(); }],
      ["spine", 3, (g) => { H().poly(g, [[-6, 4], [6, 4], [5, -18], [-5, -18]], br2, ink, 1.3); H().poly(g, [[-8, -18], [8, -18], [7, -22], [-7, -22]], br, ink, 1.2); }],
      ["head", 4, (g, oo, ctx) => { H().circle(g, 0, -5, 6, br, ink, 1.3); eyes(g, "#9fd0f0", [[1, -7, 4, 2]], 6); }],
      ["armF", 5, (g) => seg(g, 7.2, 3.4, br)], ["foreF", 5.1, (g) => seg(g, 7.4, 3, br)], ["hand", 5.2, (g, oo, ctx) => weaponOf(g, ctx, "sword", false, 0)],
    ];
    const C = HUM_CLIPS, pick = (c, keep) => ({ ...c, k: Object.fromEntries(Object.entries(c.k).filter(([b]) => keep.includes(b))) });
    const keep = ["root", "upper", "spine", "head", "armB", "foreB", "armF", "foreF", "hand"];
    const clips = {};
    for (const [nm, c] of Object.entries(C)) clips[nm] = pick(c, keep);
    clips.idle = { ...clips.idle, k: { ...clips.idle.k, upper: DY([0, 0], [0.5, 1.2], [1, 0]), ball: R0([0, 0], [0.5, 0.05], [1, 0]) } };
    clips.death = { len: 1, k: { upper: [K(0), K(0.3, 0.2, 0, 6), K(1, 0.5, 6, 14)], head: R0([0, 0], [1, 0.6]), armF: R0([0, 0], [1, 1.2]), armB: R0([0, 0], [1, 0.6]), ball: [K(0), K(1, 0.8, -3, 0)] } };
    return define({ bones, parts, clips, meta: { arms: true, attacks: HUM_ATTACKS, pic: { mode: "long", lift: ["upper"], push: ["upper"], breath: "spine" } } });
  }

  // ================================================================ ICE WRAITHS (a serpent of ice) and WISPS
  function wraithRig(o) {
    const ink = P().ink, N = 6, c = o.color || "#bfe0f0";
    const bones = [["root", null, 0, -34], ["s0", "root", 10, 0, dirRot(-1, 0.25)]];
    for (let i = 1; i < N; i++) bones.push(["s" + i, "s" + (i - 1), 0, 7, 0.1]);
    bones.push(["head", "root", 12, -2], ["jaw", "head", 3, 3]);
    const parts = [];
    for (let i = N - 1; i >= 0; i--) parts.push(["s" + i, 1 + (N - i) * 0.01, (g, oo, ctx) => { const w = 7 - i * 0.9; ell(g, 0, 3.5, w * 0.8, 5, 0, i % 2 ? c : shade(c, 0.88), 1.1); H().poly(g, [[-w * 0.6, 1], [-w - 3, -3 - (i % 2) * 2], [-w * 0.3, 4]], "#e8f8ff", ink, 0.8); }]);
    parts.push(["jaw", 2.9, (g) => H().poly(g, [[0, 0], [9, 1], [0, 4]], shade(c, 0.85), ink, 1)]);
    parts.push(["head", 3, (g, oo, ctx) => { glow(g, 0, 0, 14, "rgba(159,208,240,0.55)"); H().poly(g, [[-7, 4], [-6, -5], [2, -8], [11, -2], [9, 3], [0, 5]], "#e6f2f8", ink, 1.3); for (const sd of [-1, 1]) H().poly(g, [[-3, -4], [-12, -10 + sd * 3], [-5, -1]], c, ink, 0.8); eyes(g, "#3a7ab8", [[3, -3, 3, 2]], 6); }]);
    const wave = (amp, len, ph) => { const k = {}; for (let i = 0; i < N; i++) k["s" + i] = [0, 0.25, 0.5, 0.75, 1].map((t) => K(t, Math.sin((t + ph + i * 0.15) * Math.PI * 2) * amp * (0.6 + i * 0.12))); return k; };
    const clips = {
      idle: { len: 1.8, loop: true, k: { ...wave(0.35, 1.8, 0), root: [K(0), K(0.5, 0, 0, -3), K(1)], head: R0([0, 0], [0.5, -0.1], [1, 0]), jaw: R0([0, 0.1], [0.5, 0.25], [1, 0.1]) } },
      bite: { len: 0.85, hit: 0.48, k: { root: [K(0), K(0.3, 0, -8, -8), K(0.48, 0, 14, 6), K(0.65, 0, 8, 2), K(1)], head: R0([0, 0], [0.3, -0.4], [0.48, 0.3], [1, 0]), jaw: R0([0, 0], [0.3, 0.9], [0.46, 0.9], [0.5, 0], [1, 0]), ...wave(0.5, 0.85, 0.2) } },
      cast: { len: 1, hit: 0.64, k: { root: [K(0), K(0.4, 0, -4, -10), K(0.6, 0, 4, 0), K(1)], head: R0([0, 0], [0.4, -0.5], [0.62, 0.2], [1, 0]), jaw: R0([0, 0], [0.45, 1.0], [0.8, 0.8], [1, 0]) } },
      hit: { len: 0.45, k: { root: [K(0), K(0.15, 0, -5, -3), K(1)], head: R0([0, 0], [0.15, -0.6], [1, 0]), jaw: R0([0, 0], [0.15, 0.7], [1, 0]), ...wave(0.6, 0.45, 0.5) } },
      stagger: { len: 0.9, k: { root: [K(0), K(0.15, 0.3, -8, -3), K(0.5, -0.2, -8, 4), K(1)], head: R0([0, 0], [0.15, -0.7], [0.5, 0.4], [1, 0]), ...wave(0.7, 0.9, 0.3) } },
      block: { len: 0.55, k: { root: [K(0), K(0.3, 0, -10, -8), K(1)], head: R0([0, 0], [0.3, -0.3], [1, 0]) } },
      death: { len: 1, k: { root: [K(0), K(0.4, 0.3, -2, 8, 1, 0.9), K(1, 0.5, -6, 30, 1.1, 0.4)], head: R0([0, 0], [1, 0.8]), jaw: R0([0, 0], [1, 0.9]), ...wave(0.2, 1, 0) } },
      taunt: { len: 1.4, loop: true, k: { root: [K(0, 0, 0, -10), K(0.5, 0, 0, -14), K(1, 0, 0, -10)], head: R0([0, -0.5], [0.5, -0.65], [1, -0.5]), jaw: R0([0, 0.9], [0.5, 0.6], [1, 0.9]), ...wave(0.45, 1.4, 0.1) } },
    };
    return define({ bones, parts, clips, meta: { attacks: { cast: "cast", default: "bite" }, pic: { mode: "tall", bend: ["root"], head: ["head"], breath: "root" } } });
  }
  function wispRig(o) {
    const bones = [["root", null, 0, -36], ["core", "root", 0, 0]];
    for (let i = 0; i < 4; i++) bones.push(["t" + i, "root", -6 + i * 4, 6, 0.3 - i * 0.2], ["t" + i + "b", "t" + i, 0, 12]);
    const parts = [];
    for (let i = 0; i < 4; i++) parts.push(["t" + i, 1, (g) => seg(g, 12, 1.2, "#9fd0f0", false)], ["t" + i + "b", 1.1, (g) => seg(g, 12, 1, "#cfe8ff", false)]);
    parts.push(["core", 2, (g, oo, ctx) => { const s = 1 + (ctx.charge || 0) * 0.5; glow(g, 0, 0, 26 * s, "rgba(159,208,240,0.6)"); glow(g, 0, 0, 9 * s, "rgba(255,255,255,0.9)"); }]);
    const tw = (amp) => { const k = {}; for (let i = 0; i < 4; i++) { k["t" + i] = [0, 0.5, 1].map((t, j) => K(t, (j === 1 ? amp : -amp) * (i % 2 ? 1 : -1))); k["t" + i + "b"] = [0, 0.5, 1].map((t, j) => K(t, (j === 1 ? -amp : amp))); } return k; };
    const clips = {
      idle: { len: 2, loop: true, k: { ...tw(0.3), root: [K(0), K(0.5, 0, 0, -4), K(1)], core: [K(0), K(0.5, 0, 0, 0, 1.08, 1.08), K(1)] } },
      cast: { len: 1, hit: 0.64, k: { root: [K(0), K(0.4, 0, -3, -6), K(0.64, 0, 4, 0), K(1)], core: [K(0), K(0.45, 0, 0, 0, 1.4, 1.4), K(0.65, 0, 0, 0, 0.8, 0.8), K(1)], ...tw(0.6) } },
      hit: { len: 0.45, k: { root: [K(0), K(0.15, 0, -6, -2), K(1)], core: [K(0), K(0.15, 0, 0, 0, 0.7, 1.2), K(1)] } },
      stagger: { len: 0.9, k: { root: [K(0), K(0.2, 0.3, -8, 2), K(0.5, -0.3, -6, -4), K(1)], core: [K(0), K(0.2, 0, 0, 0, 0.6, 1.3), K(0.5, 0, 0, 0, 1.2, 0.8), K(1)] } },
      block: { len: 0.55, k: { root: [K(0), K(0.3, 0, -10, -6), K(1)] } },
      death: { len: 1, k: { core: [K(0), K(0.3, 0, 0, 0, 1.5, 1.5), K(1, 0, 0, 0, 0.1, 0.1)], root: [K(0), K(1, 0, 0, 10)], ...tw(0.8) } },
      taunt: { len: 1, loop: true, k: { root: [K(0, 0, 0, -8), K(0.5, 0, 0, -12), K(1, 0, 0, -8)], core: [K(0, 0, 0, 0, 1.1, 1.1), K(0.5, 0, 0, 0, 1.25, 1.25), K(1, 0, 0, 0, 1.1, 1.1)], ...tw(0.5) } },
    };
    clips.bite = clips.cast;
    return define({ bones, parts, clips, meta: { attacks: { default: "cast" }, pic: { mode: "tall", bend: ["root"], head: ["core"], breath: "core" } } });
  }

  // ================================================================ DRAGONS
  function dragonRig(o) {
    const ink = P().ink, c = o.body || "#5a6a5a", wc = o.wing || "#7a6a5a", far = shade(c, 0.72), nd = dirRot(0.55, -1);
    const bones = [["root", null, 0, 0], ["body", "root", -6, -28, -0.1],
      ["tail1", "body", -30, 4, dirRot(-1, 0.2)], ["tail2", "tail1", 0, 18], ["tail3", "tail2", 0, 16],
      ["lbF", "body", -20, 8, 0.1], ["lbFs", "lbF", 0, 9], ["lfF", "body", 16, 8, -0.1], ["lfFs", "lfF", 0, 9],
      ["wingF", "body", -4, -12, dirRot(-0.5, -1)], ["wingFt", "wingF", 0, 22, 0.9],
      ["neck1", "body", 26, -6, nd], ["neck2", "neck1", 0, 13, -0.15], ["head", "neck2", 0, 13, -nd + 0.15 - 0.05], ["jaw", "head", 4, 3],
      ["wingN", "body", 2, -12, dirRot(-0.35, -1)], ["wingNt", "wingN", 0, 24, 0.95],
      ["lbN", "body", -14, 9, 0.05], ["lbNs", "lbN", 0, 9], ["lfN", "body", 20, 9, -0.15], ["lfNs", "lfN", 0, 9]];
    const wing = (nm, z, col) => [nm, "abs:" + z, (g, oo, ctx) => {
      const p = ptOf(ctx), s = p(nm, 0, 0), e = p(nm + "t", 0, 0), tip = p(nm + "t", 0, 26), m1 = p(nm + "t", -6, 18), m2 = p(nm + "t", -4, 9), back = p("body", -26, -6), mid = p("body", -10, -10);
      H().poly(g, [s, e, tip, m1, p("body", -30, -2), m2, back, mid], col, ink, 1.4);
      g.strokeStyle = ink; g.lineWidth = 2.2; g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(e[0], e[1]); g.lineTo(tip[0], tip[1]); g.stroke();
    }];
    const parts = [
      wing("wingF", 0.5, shade(wc, 0.7)),
      ["lbF", 1, (g) => seg(g, 9, 5, far)], ["lbFs", 1.1, (g) => seg(g, 9, 4, far)], ["lfF", 1, (g) => seg(g, 9, 5, far)], ["lfFs", 1.1, (g) => seg(g, 9, 4, far)],
      ["tail1", 1.5, (g) => seg(g, 18, 7, c)], ["tail2", 1.6, (g) => seg(g, 16, 5.5, c)], ["tail3", 1.7, (g) => { seg(g, 16, 4, c); H().poly(g, [[-4, 14], [0, 24], [4, 14]], shade(c, 0.85), ink, 1); }],
      ["neck1", 1.8, (g) => seg(g, 13, 9, c)], ["neck2", 1.9, (g) => seg(g, 13, 8, c)],
      ["body", 2, (g) => { ell(g, 0, 0, 34, 16, 0, c, 1.6); g.fillStyle = shade(c, 1.2); g.beginPath(); g.ellipse(4, 8, 24, 6, 0, 0, Math.PI); g.fill(); for (let i = 0; i < 5; i++) H().poly(g, [[-22 + i * 9, -14 + Math.abs(i - 2)], [-19 + i * 9, -21 + Math.abs(i - 2)], [-16 + i * 9, -14 + Math.abs(i - 2)]], shade(c, 0.8), ink, 0.8); }],
      ["jaw", 2.9, (g) => { H().poly(g, [[-1, -1], [16, -3], [16, 1], [-1, 4]], "#5a1010", null); H().poly(g, [[-2, 1], [17, 1], [14, 4], [-2, 5]], shade(c, 0.9), ink, 1.1); }],
      ["head", 3, (g, oo, ctx) => {
        H().poly(g, [[-6, -6], [6, -8], [22, -3], [22, 2], [4, 3], [-6, 2]], c, ink, 1.4);
        H().poly(g, [[-2, -6], [-12, -16], [0, -8]], "#e6e0cc", ink, 1); H().poly(g, [[3, -7], [-4, -18], [6, -8]], "#e6e0cc", ink, 1);
        eyes(g, o.eye || "#e8923a", [[8, -4, 3, 2]], 5);
        if (ctx.jaw > 0.2) { g.fillStyle = "#fff"; g.fillRect(16, 1, 1.5, 3); g.fillRect(12, 1, 1.5, 3); }
      }],
      ["lbN", 3.5, (g) => seg(g, 9, 5.5, c)], ["lbNs", 3.6, (g) => { seg(g, 9, 4.5, c); H().poly(g, [[-3, 8], [5, 8], [6, 10], [-3, 10]], c, ink, 1); }],
      ["lfN", 3.5, (g) => seg(g, 9, 5.5, c)], ["lfNs", 3.6, (g) => { seg(g, 9, 4.5, c); H().poly(g, [[-3, 8], [5, 8], [6, 10], [-3, 10]], c, ink, 1); }],
      wing("wingN", 4, wc),
    ];
    const wings = (a, b) => ({ wingF: R0(...a.map(([t, r]) => [t, r * 0.9])), wingN: R0(...a), wingFt: R0(...b.map(([t, r]) => [t, r * 0.9])), wingNt: R0(...b) });
    const clips = {
      idle: { len: 3, loop: true, k: { body: [K(0), K(0.5, 0, 0, 0.5, 1.01, 1.04), K(1)], neck1: R0([0, 0], [0.5, -0.06], [1, 0]), neck2: R0([0, 0], [0.5, -0.05], [1, 0]), head: R0([0, 0], [0.5, 0.06], [1, 0]),
        jaw: R0([0, 0.04], [0.5, 0.12], [1, 0.04]), tail1: R0([0, 0], [0.5, 0.1], [1, 0]), tail2: R0([0, 0], [0.5, 0.15], [1, 0]), tail3: R0([0, 0], [0.5, 0.2], [1, 0]), ...wings([[0, 0], [0.5, 0.08], [1, 0]], [[0, 0], [0.5, -0.06], [1, 0]]) } },
      fly: { len: 0.7, loop: true, k: { body: [K(0), K(0.5, 0, 0, -2), K(1)], ...wings([[0, -0.6], [0.5, 0.9], [1, -0.6]], [[0, -0.3], [0.5, 0.5], [1, -0.3]]), tail1: R0([0, -0.1], [0.5, 0.1], [1, -0.1]), tail2: R0([0, 0.1], [0.5, -0.1], [1, 0.1]),
        lbN: R0([0, 0.6], [1, 0.6]), lbF: R0([0, 0.6], [1, 0.6]), lfN: R0([0, 0.5], [1, 0.5]), lfF: R0([0, 0.5], [1, 0.5]), neck1: R0([0, 0.1], [0.5, 0.05], [1, 0.1]) } },
      breath: { len: 1.25, hit: 0.56, k: { neck1: R0([0, 0], [0.3, -0.45], [0.4, 0.3], [0.86, 0.32], [1, 0]), neck2: R0([0, 0], [0.3, -0.3], [0.4, 0.25], [0.86, 0.25], [1, 0]), head: R0([0, 0], [0.3, -0.2], [0.4, 0.05], [1, 0]),
        jaw: R0([0, 0], [0.3, 0.3], [0.38, 0.75], [0.86, 0.75], [0.95, 0.1], [1, 0]), body: [K(0), K(0.3, -0.12, -2, -2, 1.04, 1.06), K(0.4, 0.04, 2, 0), K(0.86, 0.04, 2), K(1)],
        ...wings([[0, 0], [0.3, 0.6], [0.4, -0.2], [0.86, -0.1], [1, 0]], [[0, 0], [0.3, 0.5], [0.4, -0.1], [1, 0]]), tail1: R0([0, 0], [0.3, -0.3], [0.5, 0.2], [1, 0]) } },
      bite: { len: 0.85, hit: 0.48, k: { neck1: R0([0, 0], [0.3, -0.5], [0.48, 0.5], [0.65, 0.2], [1, 0]), neck2: R0([0, 0], [0.3, -0.2], [0.48, 0.3], [1, 0]), jaw: R0([0, 0], [0.3, 0.7], [0.45, 0.7], [0.5, 0], [1, 0]),
        body: [K(0), K(0.3, -0.1, -2), K(0.48, 0.06, 4), K(1)], ...wings([[0, 0], [0.3, 0.4], [0.48, -0.2], [1, 0]], [[0, 0], [0.3, 0.3], [1, 0]]) } },
      hit: { len: 0.5, k: { neck1: R0([0, 0], [0.15, -0.5], [1, 0]), head: R0([0, 0], [0.15, -0.3], [1, 0]), jaw: R0([0, 0], [0.15, 0.6], [1, 0]), body: [K(0), K(0.15, -0.08, -3), K(1)], ...wings([[0, 0], [0.15, 0.5], [1, 0]], [[0, 0], [0.15, 0.4], [1, 0]]) } },
      stagger: { len: 1, k: { root: [K(0), K(0.15, 0, -6), K(0.6, 0, -6), K(1)], body: [K(0), K(0.15, -0.15, 0, -3), K(0.4, 0.12, 0, 3), K(0.7, -0.05), K(1)], neck1: R0([0, 0], [0.15, -0.6], [0.4, 0.6], [0.7, -0.2], [1, 0]),
        head: R0([0, 0], [0.4, 0.4], [1, 0]), jaw: R0([0, 0], [0.15, 0.7], [0.5, 0.3], [1, 0]), ...wings([[0, 0], [0.15, 0.8], [0.4, -0.3], [1, 0]], [[0, 0], [0.15, 0.6], [1, 0]]) } },
      block: { len: 0.6, k: { ...wings([[0, 0], [0.25, -1.1], [0.75, -1.0], [1, 0]], [[0, 0], [0.25, -0.6], [1, 0]]), neck1: R0([0, 0], [0.25, -0.4], [1, 0]), root: [K(0), K(0.3, 0, -6), K(1)] } },
      death: { len: 1, k: { neck1: R0([0, 0], [0.4, -0.3], [1, 1.05]), neck2: R0([0, 0], [0.4, 0.2], [1, 0.5]), head: R0([0, 0], [1, -0.4]), jaw: R0([0, 0], [0.4, 0.8], [1, 0.35]),
        body: [K(0), K(0.4, 0.05, 0, 2), K(1, 0.1, 0, 10, 1.02, 0.85)], ...wings([[0, 0], [0.4, 0.8], [1, -1.2]], [[0, 0], [0.4, 0.6], [1, 1.4]]),
        lfN: R0([0, 0], [1, -1.2]), lbN: R0([0, 0], [1, 1.2]), lfF: R0([0, 0], [1, -1.1]), lbF: R0([0, 0], [1, 1.1]), tail1: R0([0, 0], [1, -0.3]), tail2: R0([0, 0], [1, -0.2]) } },
      taunt: { len: 1.6, loop: true, k: { neck1: R0([0, -0.6], [0.5, -0.75], [1, -0.6]), neck2: R0([0, -0.4], [0.5, -0.5], [1, -0.4]), head: R0([0, -0.3], [0.5, -0.4], [1, -0.3]), jaw: R0([0, 0.6], [0.3, 0.85], [0.6, 0.5], [1, 0.6]),
        body: [K(0, -0.12), K(0.5, -0.15, 0, -1, 1.02, 1.05), K(1, -0.12)], ...wings([[0, -1.0], [0.5, -1.25], [1, -1.0]], [[0, -0.5], [0.5, -0.7], [1, -0.5]]), tail1: R0([0, 0.2], [0.5, 0.35], [1, 0.2]) } },
    };
    clips.cast = clips.breath;
    return define({ bones, parts, clips, meta: { attacks: { breath: "breath", cast: "breath", default: "bite" }, pic: { mode: "long", lift: ["neck1", "neck2"], push: ["body"], breath: "body" } } });
  }

  // ================================================================ WRAP: an old drawing hung on a simple rig (Solstheim's netch, lurkers, seekers)
  function wrapRig(o) {
    const bones = [["root", null, 0, 0], ["upper", "root", 0, 0], ["spine", "upper", 0, -28], ["head", "spine", 0, -20]];
    const parts = [["upper", 1, (g, oo, ctx) => { if (ctx.kit && ctx.kit.foeFig) ctx.kit.foeFig(g, o.kind, ctx.lunge || 0, ctx.t, null); }]];
    const clips = {
      idle: { len: 2.4, loop: true, k: { upper: [K(0), K(0.5, 0.02, 0, 0, 1.01, 1.03), K(1)] } },
      attack: { len: 1, hit: 0.48, k: { upper: [K(0), K(0.3, -0.12, -3, 0, 0.96, 1.05), K(0.48, 0.14, 6, 0, 1.05, 0.95), K(0.7, 0.05, 2), K(1)] } },
      cast: { len: 1, hit: 0.64, k: { upper: [K(0), K(0.4, -0.1, -2, -2, 0.95, 1.08), K(0.64, 0.08, 3, 0, 1.06, 0.95), K(1)] } },
      hit: { len: 0.45, k: { upper: [K(0), K(0.15, -0.18, -4, 0, 1.06, 0.94), K(1)] } },
      stagger: { len: 0.9, k: { upper: [K(0), K(0.15, -0.25, -6), K(0.4, 0.15, -6), K(0.7, -0.08, -3), K(1)] } },
      block: { len: 0.55, k: { upper: [K(0), K(0.3, -0.15, -9, -2), K(1)] } },
      death: { len: 1, k: { upper: [K(0), K(0.3, -0.1, 0, 0, 1, 0.95), K(1, -1.4, -6, -4, 1, 0.9)] } },
      taunt: { len: 1.2, loop: true, k: { upper: [K(0, -0.05), K(0.5, -0.1, 0, -2, 1.03, 1.05), K(1, -0.05)] } },
    };
    return define({ bones, parts, clips, meta: { attacks: { cast: "cast", default: "attack" }, pic: { mode: "tall", bend: ["upper"], head: ["head"], breath: "upper" } } });
  }

  // ================================================================ who is drawn how
  const SK = { nord: "#e9c6a1", imperial: "#dcb48c", breton: "#ecc9a8", altmer: "#e3cf8a" };
  const HUM_LOOK = {
    bandit: () => ({ skin: SK.imperial, body: P().leather, head: "hood", hoodColor: "#5a4836", wt: "axe" }),
    forsworn: () => ({ skin: SK.breton, body: "#7a5a3a", head: "feathers", wt: "sword", cape: "#5f6a48" }),
    draugr: () => ({ skin: "#6a7f78", body: "#4a5550", head: "horned", helmColor: "#5a5a50", wt: "battleaxe", eyes: "#9fd0f0", armC: "#6a7f78", pants: "#3a4440" }),
    vampire: () => ({ skin: "#d8d4dc", body: "#3a2030", head: "hair", hair: "#1c1418", wt: "dagger", eyes: "#e0303a", cape: "#5a1020", pants: "#2a1820" }),
    mage: () => ({ skin: SK.altmer, body: "#3a3a6a", legs: "robe", head: "hood", hoodColor: "#2a2a4a", wt: "staff" }),
    thalmor: () => ({ skin: SK.altmer, body: "#b8963e", legs: "robe", head: "hair", hair: "#e8d9a0", wt: "staff", cape: "#2a2a2a" }),
    necromancer: () => ({ skin: "#c8c0b8", body: "#2a2030", legs: "robe", head: "hood", hoodColor: "#1a1420", wt: "staff", eyes: "#b07aff" }),
    hagraven: () => ({ skin: "#8a7a80", body: "#3a3040", legs: "robe", head: "bird", wt: "staff", hunch: 0.25, claws: 1, armC: "#8a7a80" }),
    falmer: () => ({ skin: "#c8c8b8", body: "#6a6050", head: "falmer", wt: "sword", hunch: 0.35, armC: "#c8c8b8", pants: "#5a5040" }),
    lich: () => ({ skin: "#5a5a50", body: "#3a2e24", legs: "robe", head: "mask", wt: "staff", eyes: "#9fd0f0", float: 10 }),
    troll: (n) => ({ scale: 1.35, skin: /frost/.test(n) ? "#d8dcd8" : "#8a8a72", body: /frost/.test(n) ? "#c8ccc8" : "#7a7a64", head: "hair", hair: /frost/.test(n) ? "#e8ece8" : "#5a5a48", wt: "fist", hunch: 0.4, armC: /frost/.test(n) ? "#d8dcd8" : "#8a8a72", eyes: "#e8923a", pants: /frost/.test(n) ? "#a8aca8" : "#6a6a56", claws: 1 }),
    giant: () => ({ scale: 1.5, skin: "#b8a890", body: "#8a6a44", head: "hair", hair: "#8a8070", wt: "club", pants: "#6a5034" }),
    dremora: () => ({ skin: "#6a2a24", body: "#2a1a1a", head: "horned", helmColor: "#3a1414", hornC: "#2a1010", eyes: "#ff5a2a", wt: "greatsword", armC: "#6a2a24", cape: "#4a1010", pants: "#2a1414" }),
    person: () => ({ skin: SK.imperial, body: P().leather, head: "hair", wt: "sword" }),
    sol_riekling: () => ({ scale: 0.72, skin: "#8fb0c8", body: "#6a5a44", head: "horned", helmColor: "#e9dcc0", wt: "spear", eyes: "#1a1410" }),
    sol_cultist: () => ({ skin: "#c9a24c", body: "#3a2e24", legs: "robe", head: "mask", wt: "sword", cape: "#2a221c" }),
    sol_miraak: () => ({ scale: 1.15, skin: "#d6b25e", body: "#4a3a28", legs: "robe", head: "mask", wt: "sword", eyes: "#9fe08a", cape: "#2e2418" }),
    sol_spawn: () => ({ skin: "#5a524c", body: "#4a423c", head: "skull", wt: "sword", eyes: "#ff9a40", armC: "#5a524c", hunch: 0.15 }),
  };
  const QUAD_LOOK = {
    wolf: () => ({ color: "#7a7268", len: 44, height: 30, head: 8, legW: 3.4, tail: "bushy", ears: 1, fangs: 1, pant: 1 }),
    bear: () => ({ color: "#4a3426", len: 62, height: 44, head: 12, legW: 7, ears: 1, headY: 0.8, claws: 1, fur: 1, mane: 1 }),
    cat: () => ({ color: "#d8c8a0", len: 56, height: 34, head: 10, legW: 4.4, tail: "bushy", ears: 1, fangs: 1, stripes: 1, claws: 1 }),
    skeever: () => ({ color: "#7a6a5a", len: 28, height: 16, head: 6, legW: 2.4, tail: "long", ears: 1, eye: "#c4302a" }),
    mammoth: () => ({ color: "#6a5040", len: 64, height: 50, head: 14, legW: 8, tusks: 1, trunk: 1, headY: 0.75, big: 1, fur: 1, scale: 1.7 }),
    horker: () => ({ color: "#7a6656", len: 58, height: 30, head: 10, legW: 5, headY: 0.95, horker: 1, flipper: 1, big: 1 }),
    sol_hopper: () => ({ color: "#6e6a52", len: 26, height: 22, head: 6, legW: 2, tail: "long", eye: "#c4572e" }),
  };
  let lookHook = null;   // leghunt.js: legendary beasts reuse a rig, bigger and recoloured
  function kindOf(fk, name) { const k = kindOf0(fk, name); return lookHook ? lookHook(k, name) : k; }
  function kindOf0(fk, name) {
    const n = String(name || "").toLowerCase();
    // the fight's kinds are broad: a few foes get their own body by name
    if (/ice wraith|wraith/.test(n)) return { body: "wraith", skin: "wraith", o: { color: "#bfe0f0" } };
    if (/chaurus/.test(n)) return { body: "spider", skin: "chaurus", o: { mode: "chaurus", leg: "#5a4a32", body: "#7a6440", eye: "#e8d060" } };
    if (/horker/.test(n)) return { body: "quad", skin: "horker", o: QUAD_LOOK.horker() };
    if (/dremora/.test(n)) return { body: "hum", skin: "person", o: HUM_LOOK.dremora() };
    if (/werewolf/.test(n)) return { body: "wrap", skin: "werewolf", o: { kind: "werewolf" } };   // a wild werewolf (beastpaths.js): the same wolf body as a player in Beast Form (BEASTART.wolf), hung on a rig
    if (/thalmor|justiciar/.test(n) && fk === "mage") return { body: "hum", skin: "person", o: HUM_LOOK.thalmor() };
    if (/necromancer|conjurer|warlock/.test(n) && fk === "mage") return { body: "hum", skin: "person", o: HUM_LOOK.necromancer() };
    if (/spriggan/.test(n) || fk === "sol_spriggan") return { body: "hum", skin: "spriggan", o: fk === "sol_spriggan" || /burnt/.test(n) ? { skin: "#3a2e26", glowC: "#ffb040", wt: "fist", attacks: { ...HUM_ATTACKS, default: "claw", cast: "cast" } } : { skin: "#5a4632", glowC: "#e8c24a", wt: "fist", attacks: { ...HUM_ATTACKS, default: "claw", cast: "cast" } } };
    switch (fk) {
      case "skeleton": return { body: "hum", skin: "bones", o: { wt: "sword" } };
      case "centurion": return { body: "hum", skin: "construct", o: { scale: 1.6, wt: "warhammer", attacks: { ...HUM_ATTACKS, default: "heavy" } } };
      case "atronach":
        if (/frost/.test(n)) return { body: "hum", skin: "golem", o: { scale: 1.3, wt: "fist", attacks: { ...HUM_ATTACKS, default: "claw", cast: "claw" } } };
        if (/storm/.test(n)) return { body: "hum", skin: "storm", o: { scale: 1.2, float: 6, wt: "fist", attacks: { ...HUM_ATTACKS, default: "cast" } } };
        return { body: "hum", skin: "flame", o: { float: 8, wt: "fist", attacks: { ...HUM_ATTACKS, default: "cast" } } };
      case "wisp": return { body: "wisp", skin: "wisp", o: {} };
      case "spider": return { body: "spider", skin: "spider", o: { mode: "spider", leg: "#d8dcd0", body: "#c8ccc0", eye: "#c4302a" } };
      case "dspider": return { body: "spider", skin: "dwarven", o: { mode: "dwarven", leg: "#b8893e", body: "#a07a36", eye: "#9fd0f0" } };
      case "crab": return { body: "crab", skin: "crab", o: { color: "#8a6a5a" } };
      case "sphere": return { body: "sphere", skin: "sphere", o: { wt: "sword" } };
      case "dragon": return { body: "dragon", skin: "dragon", o: {} };
      case "wolf": case "wolves": case "bear": case "cat": case "skeever": case "mammoth": case "sol_hopper": return { body: "quad", skin: fk, o: QUAD_LOOK[fk === "wolves" ? "wolf" : fk](), pack: fk === "wolves" };
      case "player": return { body: "hum", skin: "person", o: null, player: true };
      default:
        if (HUM_LOOK[fk]) return { body: "hum", skin: "person", o: HUM_LOOK[fk](n) };
        if (String(fk).startsWith("sol_")) return { body: "wrap", skin: fk, o: { kind: fk } };
        return { body: "hum", skin: "person", o: HUM_LOOK.person() };
    }
  }
  function build(Kd) {
    const o = Kd.o || {};
    switch (Kd.body) {
      case "hum": return humRig(o, Kd.skin);
      case "quad": return quadRig(o);
      case "spider": return spiderRig(o);
      case "crab": return crabRig(o);
      case "sphere": return sphereRig(o);
      case "wraith": return wraithRig(o);
      case "wisp": return wispRig(o);
      case "dragon": return dragonRig(o);
      default: return wrapRig(o);
    }
  }

  // ================================================================ painted pictures as rigs
  const picCache = new WeakMap();
  function picSrc(im) {   // a smaller copy, made once: cheaper to slice every frame on a phone
    if (typeof document === "undefined" || !im.naturalWidth) return im;
    let c = picCache.get(im);
    if (!c) {
      const big = (typeof innerWidth !== "undefined" && innerWidth >= 1100) || (typeof devicePixelRatio !== "undefined" && devicePixelRatio > 1.5);   // [artfit] PCs and sharp screens get the full picture (no blow-up)
      const h = Math.min(im.naturalHeight, big ? 2048 : 384), w = Math.round(im.naturalWidth * h / im.naturalHeight);
      c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(im, 0, 0, w, h); picCache.set(im, c);
    }
    return c;
  }
  const sumRot = (R, p, names) => { let s = 0; for (const nm of names || []) { const i = R.idx[nm]; if (i != null) s += p[i * 5]; } return s; };
  const sumDx = (R, p, names) => { let s = 0; for (const nm of names || []) { const i = R.idx[nm]; if (i != null) s += p[i * 5 + 1]; } return s; };
  function drawPic(g, R, p, st, extra) {
    const src = picSrc(st.pic), meta = R.meta.pic || { mode: "tall" }, hU = st.picH, wU = hU * src.width / src.height, sw = src.width, sh = src.height, N = 10;
    const r0 = R.idx.root * 5;
    g.translate(p[r0 + 1], p[r0 + 2]); g.rotate(p[r0]); g.scale(p[r0 + 3], p[r0 + 4]);
    const bi = R.idx[meta.breath], breath = bi != null ? p[bi * 5 + 4] : 1;
    if (st.filter) g.filter = st.filter;
    if (meta.mode === "tall") {
      const bend = sumRot(R, p, meta.bend) + (extra.swing || 0), head = sumRot(R, p, meta.head) * 0.6, dy0 = (R.idx.hips != null ? p[R.idx.hips * 5 + 2] : 0) * 0.6;
      const off = (v) => bend * hU * v * v * 0.5 + head * hU * Math.max(0, v - 0.7) + (extra.push || 0) * v;
      for (let j = 0; j < N; j++) {
        const v0 = j / N, v1 = (j + 1) / N, y0 = -v0 * hU * breath + dy0 * v0, y1 = -v1 * hU * breath + dy0 * v1, x0 = off(v0), x1 = off(v1), k = (x1 - x0) / (y1 - y0);
        g.save(); g.transform(1, 0, k, 1, x0 - k * y0, 0);
        const sy0 = sh * (1 - v1), shh = sh / N;
        g.drawImage(src, 0, Math.max(0, sy0 - 0.5), sw, Math.min(sh - Math.max(0, sy0 - 0.5), shh + 1), -wU / 2, y1 - 0.5, wU, y0 - y1 + 1);
        g.restore();
      }
    } else {
      const lift = -sumRot(R, p, meta.lift), push = sumDx(R, p, meta.push) + (extra.push || 0);
      const sm = (u) => { const q = c01((u - 0.4) / 0.6); return q * q * (3 - 2 * q); };
      const xAt = (u) => -wU / 2 + u * wU + push * sm(u), yAt = (u) => -lift * wU * 0.45 * sm(u) * sm(u);
      for (let j = 0; j < N; j++) {
        const u0 = j / N, u1 = (j + 1) / N, x0 = xAt(u0), x1 = xAt(u1), y0 = yAt(u0), y1 = yAt(u1), k = (y1 - y0) / (x1 - x0);
        g.save(); g.transform(1, k, 0, 1, 0, y0 - k * x0);
        const sx0 = sw * u0, sww = sw / N, hh = hU * breath;
        g.drawImage(src, Math.max(0, sx0 - 0.5), 0, Math.min(sw - Math.max(0, sx0 - 0.5), sww + 1), sh, x0 - 0.5, -hh, x1 - x0 + 1, hh);
        g.restore();
      }
    }
    g.filter = "none";
  }

  // ================================================================ the controller: one foe on one fight stage
  const ONE = { hit: 1, stagger: 1, dodge: 1, block: 1, cast: 1, taunt: 1 };
  /* the shared character renderer (heroart.js / figart.js): HEROART.fightFigure(g, card, o) draws a person with the feet at
     0,0, about 60 units tall, posed from aim/back/hunch/lunge/draw — the same space as this rig. People whose look it knows
     (other players, plain bandits in hide armour) are drawn by it, moved by this rig's root, hips, lean and arms. */
  let heroOK = true;
  const HERO_CARDS = { bandit: { look: { r: "imperial", eq: { chest: "hide_armor", weapon: "iron_war_axe" } } } };
  const heroCan = () => heroOK && typeof HEROART !== "undefined" && typeof HEROART.fightFigure === "function";
  function heroFight(g, R, out, card, ctx, sp) {
    const I = (nm) => R.idx[nm] * 5, r = I("root"), up = I("upper"), hp = I("hips");
    try {
      g.save(); g.translate(out[r + 1], out[r + 2] + out[hp + 2] * 0.6); g.rotate(out[r]); g.scale(out[r + 3], out[r + 4]);
      HEROART.fightFigure(g, card, { t: ctx.t, aim: -0.5 + out[I("armF")], back: out[I("armB")], hunch: out[up], lunge: ctx.lunge || 0, draw: ctx.draw, wt: ctx.wt || undefined, dying: ctx.clip === "death" ? ctx.u : 0 });
      g.restore(); return true;
    } catch (e) { g.restore(); heroOK = false; return false; }   // not the API this expects: fall back to this file's own people for good
  }
  function ctl(fk, name, opts = {}) {
    const Kd = kindOf(fk, name);
    if (Kd.player) Kd.o = opts.look || HUM_LOOK.person();
    else if (opts.arch && Kd.body === "hum" && Kd.skin === "person") Kd.o = { ...Kd.o, ...opts.arch };   // a bandit archer, a draugr mage...
    const heroCard = opts.heroBodies === false ? null : Kd.player ? (opts.foeLook ? { look: opts.foeLook } : null) : fk === "bandit" && Kd.skin === "person" && !opts.arch && !/dremora/i.test(name || "") ? HERO_CARDS.bandit : null;
    const R = build(Kd), cur = pose(R), from = pose(R), tmp = pose(R), out = pose(R), M = new Float32Array(R.n * 6);
    const ctx = { t: 0, u: 0, clip: "idle", kit: null, wt: null, draw: 0, bf: false, jaw: 0, charge: 0, steam: 0, spin: 0, pt: null };
    ctx.pt = ptOf(ctx);
    let one = null, oneT = 0, last = "", fade = 1, lastUpd = -1e9, phase = Math.random();
    const ib = (nm) => R.idx[nm];
    const c = {
      kind: Kd, rig: R,
      get state() { return last; },
      clipFor(move) { const A = R.meta.attacks || {}; const nm = A[move] || A.default || "attack"; return R.clips[nm] ? nm : Object.keys(R.clips).find((k) => !["idle", "hit", "stagger", "block", "death", "taunt", "cower", "fly"].includes(k)) || "idle"; },
      event(e) { const nm = e === "dodge" ? "block" : e; if (!ONE[e] || !R.clips[nm]) return; one = R.clips[nm]; oneT = 0; },
      update(dt) { lastUpd = ctx.t; if (one) { oneT += dt / one.len; if (oneT >= 1) one = null; } if (fade < 1) fade = Math.min(1, fade + dt / 0.14); },
      draw(g, st) {
        const t = st.t || 0; ctx.t = t; ctx.kit = st.kit || null;
        if (t - lastUpd > 0.25) fade = 1;   // resting between turns: no half-finished blends
        let clip = null, u = 0;
        if (st.clip && R.clips[st.clip]) {
          clip = R.clips[st.clip];
          if (clip.loop) u = ((t / clip.len) + phase) % 1;
          else { u = c01(st.u || 0); if (st.hitU != null && st.hitU > 0 && st.hitU < 1) u = u < st.hitU ? u / st.hitU * clip.hit : clip.hit + (u - st.hitU) / (1 - st.hitU) * (1 - clip.hit); }
        } else if (one) { clip = one; u = c01(oneT); }
        else { clip = st.dragon && st.dragon.air && R.clips.fly ? R.clips.fly : R.clips.idle; u = ((t / clip.len) + phase) % 1; }
        if (clip.name !== last) { from.set(cur); fade = last ? 0 : 1; last = clip.name; }
        reset(tmp); sample(R, clip, u, tmp, 1);
        if (st.clip === "para") sample(R, R.clips.hit, 0.3, tmp, 1);
        const e = ease(fade);
        for (let i = 0; i < tmp.length; i++) cur[i] = from[i] + (tmp[i] - from[i]) * e;
        out.set(cur);
        // a person's arms follow the fight's own keyframes for each weapon (so trails and hits line up)
        const sp = st.pose;
        if (sp && R.meta.arms) {
          const aF = ib("armF"), aB = ib("armB"), up = ib("upper");
          if (aF != null) out[aF * 5] += (sp.aim ?? -0.5) + 0.5;
          if (aB != null) out[aB * 5] += sp.back || 0;
          if (up != null) out[up * 5] += sp.lean || 0;
        }
        if (st.jitter) { const up = ib("upper") ?? ib("body") ?? 0; out[up * 5] += Math.sin(t * 47) * 0.03; }
        const fl = Kd.o && Kd.o.float; if (fl && st.clip !== "death") out[2] += -fl + Math.sin(t * 3) * 3;   // root lifts off the ground
        ctx.clip = clip.name; ctx.u = u; ctx.wt = (sp && sp.wt) || (Kd.o && Kd.o.wt) || null; ctx.draw = sp ? sp.draw || 0 : 0;
        ctx.bf = R.meta.arms && ib("armB") != null && out[ib("armB") * 5] < -0.8;
        ctx.jaw = ib("jaw") != null ? out[ib("jaw") * 5] : 0;
        ctx.charge = (clip.name === "cast" || clip.name === "breath") && u > 0.1 && u < clip.hit ? (u - 0.1) / (clip.hit - 0.1) : 0;
        ctx.steam = clip.name === "heavy" && u > clip.hit ? 1 - (u - clip.hit) / (1 - clip.hit) : 0;
        ctx.spin = (t * 0.6) % 6.283; ctx.still = !!st.still; ctx.lunge = clip.name === "attack" && u > 0.3 && u < 0.7 ? Math.sin((u - 0.3) / 0.4 * Math.PI) : 0;
        solve(R, out, M);
        const draws = Kd.pack ? 2 : 1;
        for (let k = draws - 1; k >= 0; k--) {
          g.save();
          if (k) { g.translate(18, -6); g.globalAlpha *= 0.85; }
          const sc = (Kd.o && Kd.o.scale) || 1; if (sc !== 1 && !st.pic) g.scale(sc, sc);
          if (st.pic) drawPic(g, R, out, st, { swing: sp && R.meta.arms ? ((sp.aim ?? -0.5) + 0.5) * 0.04 : 0, push: 0 });
          else {
            if (!(heroCard && heroCan() && heroFight(g, R, out, heroCard, ctx, sp))) paint(g, R, M, Kd.o || {}, ctx);
          }
          g.restore();
        }
      },
    };
    return c;
  }
  const BODIES = ["hum", "quad", "spider", "crab", "sphere", "wraith", "wisp", "dragon", "wrap"];
  const CLIPS = ["idle", "hit", "stagger", "block", "death", "taunt", "cast"];
  return { on, define, pose, sample, solve, paint, ctl, kindOf, lookHook: (fn) => { lookHook = fn; }, build, dirRot, BODIES, CLIPS, HUM_CLIPS, HUM_BONES };
})();
