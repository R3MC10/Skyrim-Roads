/* The fight camera. [OURS] (fight-camera)
   Owner: "Make the combat more cinematic with the camera." Design with ChatGPT; every number lives in CFG below.
   - One camera move at a time. Each special moment has a zoom, a time to get there and an easing, then it holds a beat
     and eases back to the neutral shot (300 ms). Priority: victory > boss intro > boss kill > crit > break > kill >
     heavy/power wind-up > your turn. Moves that arrive together (within MERGE ms) are merged into one; a smaller move
     while a bigger one plays is dropped (nothing ever waits in a queue); optional moves (your turn, a wind-up, a plain
     kill, focus()) keep 1.5 s between them. Ordinary swings only get a tiny +0.02 punch.
   - The camera aims between the attacker and the target, clamped so both stay in the part of the stage you can see,
     zooms out a little if they would not fit, and never shows past the picture's edges (frame()).
   - A crit plays the fighters' animations at 0.65x for ~220 ms, counting the hit-stop (fightfeel.js) already in it; the
     lost time is paid back right after, so the next turn never comes later. Rules, timers and minigames never slow.
   - Parallax: the painted backdrop is cut into rows that move by height: sky 0.05, far mountains 0.15, mid ground 0.45,
     the ground and fighters 1.0, the near strip 1.15 (pOf). Past the picture's edges it is mirrored, up to 15 % of the
     stage (overscan), so shake and tilt never open a gap. Drawn straight from the picture: no extra full-size buffers.
   - Only the battlefield moves. Numbers and name tags follow their fighters at a fixed size (toScreen); the DOM ring
     under the foe follows too (fightart.js). The turn strip, cards, boss bar and buttons never move.
   - Settings → Fights → Fight camera: Cinematic (up to 1.15x, ±0.5° tilt on big hits, shake, slow motion), Calm (up to
     1.05x, gentle, no tilt/shake/slow motion), Off (fixed). The phone's or the game's Reduce motion forces Calm.
   - Co-op: every phone runs its own camera from the fight it plays back; nothing is synced. While you choose a move or
     play a minigame, another player's move never moves your camera; during a minigame (or hold()) it stays neutral.
   Small API for other features: FIGHTCAM.focus(who, o), FIGHTCAM.punch(kind, o), FIGHTCAM.hold(key, on).
   Pure parts (create, frame, pOf, matrix) are checked in tests/test_fightcam.js; tests/fightcam_ui.py checks the screen. */
const FIGHTCAM = (() => {
  const DOM = typeof document !== "undefined";
  const CFG = {
    // kind: zoom (x of neutral), ms to get there, easing, how long it holds, priority, optional (cooldown), tilt (deg)
    moments: {
      turn: { z: 1.04, ms: 220, ease: "inout", hold: 650, pri: 1, opt: true },
      focus: { z: 1.04, ms: 260, ease: "inout", hold: 650, pri: 1, opt: true },
      heavy: { z: 1.08, ms: 180, ease: "out", hold: 420, pri: 2, opt: true },
      kill: { z: 1.05, ms: 250, ease: "out", hold: 500, pri: 3, opt: true },
      brk: { z: 1.1, ms: 280, ease: "out", hold: 420, pri: 4, tilt: 0.3 },
      crit: { z: 1.12, ms: 350, ease: "out", hold: 380, pri: 5, tilt: 0.5, slow: [0.65, 220] },
      bosskill: { z: 1.15, ms: 350, ease: "out", hold: 1100, pri: 6, tilt: 0.5 },
      intro: { z0: 1.15, z: 1, ms: 1400, ease: "inout", hold: 0, pri: 7, rev: true },
      victory: { z: 1.06, ms: 900, ease: "inout", hold: Infinity, pri: 8 },
    },
    impact: { dz: 0.02, ms: 100 },   // an ordinary blow that lands: a tiny punch, not a move
    out: 300,                         // back to neutral
    cooldown: 1500,                   // between optional moves
    merge: 150,                       // moves this close together become one
    modes: {
      cin: { max: 1.15, k: 1, tilt: true, shake: true, slow: true, bump: true },
      calm: { max: 1.05, k: 0.5, tilt: false, shake: false, slow: false, bump: false },
      off: { max: 1, k: 0, tilt: false, shake: false, slow: false, bump: false },
    },
    // parallax by height on the stage (0 top .. 1 bottom): sky, far mountains, mid ground, the ground the fighters stand on
    rows: [[0, 0.05], [0.3, 0.05], [0.46, 0.15], [0.62, 0.45], [0.77, 1], [1, 1]],
    near: 1.15,      // the foreground strip
    overscan: 0.15,  // mirrored past the picture's edges, as a share of the stage
    slices: 16,      // rows the backdrop is cut into while the camera moves
    pad: 6,          // stage units kept around the fighters in view
  };
  const MODES = ["cin", "calm", "off"];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const EASE = {
    out: (t) => 1 - (1 - t) * (1 - t) * (1 - t),
    inout: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    lin: (t) => t,
  };

  /* ------------------------------------------------------------------ settings */
  const prefs = () => { try { return JSON.parse(localStorage.getItem("rotn_prefs") || "{}"); } catch { return {}; } };
  const reduce = () => {
    try { if (DOM && document.documentElement && document.documentElement.classList.contains("a11y-still")) return true; } catch { /* no page */ }
    try { return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  };
  /* the chosen setting ("cin" by default) and what is in force (reduced motion turns Cinematic into Calm) */
  const pref = () => (MODES.includes(prefs().fsCamMode) ? prefs().fsCamMode : "cin");
  const modeOf = (p, rm) => (p === "off" ? "off" : rm ? "calm" : p);
  const mode = () => modeOf(pref(), reduce());

  /* ------------------------------------------------------------------ pure geometry */
  /* parallax factor of a row at height yf (0..1 of the stage) */
  function pOf(yf) {
    const R = CFG.rows;
    if (!(yf > R[0][0])) return R[0][1];
    for (let i = 1; i < R.length; i++) if (yf <= R[i][0]) { const [a, pa] = R[i - 1], [b, pb] = R[i]; return pa + (pb - pa) * ((yf - a) / (b - a)); }
    return R[R.length - 1][1];
  }
  /* where the camera looks: o = {W, H, vis: [l, t, r, b] (the part of the stage you can see), z, focus: [x, y],
     keep: [l, t, r, b] (fighters that must stay in view) or null}. Returns {z, cx, cy, ax, ay}: the stage point (cx, cy)
     is shown at the middle (ax, ay) of the visible part, z times larger. z = 1 is always exactly the neutral shot. */
  function frame(o) {
    const W = o.W, H = o.H, v = o.vis || [0, 0, W, H], pad = o.pad == null ? CFG.pad : o.pad;
    const l = clamp(v[0], 0, W), r = clamp(v[2], l + 1, W), t = clamp(v[1], 0, H), b = clamp(v[3], t + 1, H);
    const ax = (l + r) / 2, ay = (t + b) / 2, k = o.keep;
    let z = Math.max(1, o.z || 1);
    if (k) {   // the fighters that matter must fit: zoom out to what fits (never below neutral)
      const kw = Math.max(1, k[2] - k[0] + 2 * pad), kh = Math.max(1, k[3] - k[1] + 2 * pad);
      z = Math.max(1, Math.min(z, (r - l) / kw, (b - t) / kh));
    }
    let cx = o.focus ? o.focus[0] : ax, cy = o.focus ? o.focus[1] : ay;
    if (k) {   // keep them inside the visible part
      const lo = k[2] + pad - (r - ax) / z, hi = k[0] - pad + (ax - l) / z;
      cx = lo <= hi ? clamp(cx, lo, hi) : (lo + hi) / 2;
      const lo2 = k[3] + pad - (b - ay) / z, hi2 = k[1] - pad + (ay - t) / z;
      cy = lo2 <= hi2 ? clamp(cy, lo2, hi2) : (lo2 + hi2) / 2;
    }
    // never past the picture: the whole canvas window stays on the stage
    cx = clamp(cx, ax / z, W - (W - ax) / z); cy = clamp(cy, ay / z, H - (H - ay) / z);
    return { z, cx, cy, ax, ay, W, H };
  }
  /* the stage -> screen matrix [a, b, c, d, e, f] for a layer moving at p of the camera (1: the fighters) */
  function matrix(V, p, sx, sy) {
    p = p == null ? 1 : p;
    const z = 1 + (V.z - 1) * p, cx = V.ax + (V.cx - V.ax) * p, cy = V.ay + (V.cy - V.ay) * p, r = (V.rot || 0) * p;
    const co = Math.cos(r) * z, si = Math.sin(r) * z;
    return [co, si, -si, co, V.ax + (sx || 0) - (co * cx - si * cy), V.ay + (sy || 0) - (si * cx + co * cy)];
  }
  const NEUTRAL = (W, H, vis) => { const v = vis || [0, 0, W, H]; return { z: 1, cx: (v[0] + v[2]) / 2, cy: (v[1] + v[3]) / 2, ax: (v[0] + v[2]) / 2, ay: (v[1] + v[3]) / 2, rot: 0, kind: null, W, H }; };
  const isFlat = (V) => Math.abs(V.z - 1) < 1e-4 && Math.abs(V.rot || 0) < 1e-5 && Math.abs(V.cx - V.ax) < 1e-3 && Math.abs(V.cy - V.ay) < 1e-3;
  /* a stage point on the screen (stage units, no shake) */
  function toScreen(V, x, y) { const m = matrix(V, 1); return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  /* a screen point (backing px, scale k, with this shake) back on the stage */
  function toStage(V, k, qx, qy, sx, sy) {
    const m = matrix(V, 1, sx, sy), det = m[0] * m[3] - m[1] * m[2] || 1, x = qx / k - m[4], y = qy / k - m[5];
    return [(m[3] * x - m[2] * y) / det, (-m[1] * x + m[0] * y) / det];
  }

  /* ------------------------------------------------------------------ busy: a minigame, a hold, choosing a move */
  const holds = new Set();
  function hold(key, on) { if (on) holds.add(String(key)); else holds.delete(String(key)); }
  /* "game": a minigame or a hold (the camera goes neutral); "choose": you are picking a move; null */
  function busy() {
    if (holds.size) return "game";
    if (!DOM) return null;
    try {
      if (document.querySelector(".tbtime, #xgame, #dgame, #dwgame, #hgame, #craftgame, #minegame, #smithgame, #fishgame, #huntgame, #pickgame")) return "game";
      if (document.querySelector(".fc-aiming, #tbf:not(.tbplay) .tbdock [data-tba]")) return "choose";
    } catch { /* no page */ }
    return null;
  }

  /* ------------------------------------------------------------------ one camera (a state machine on its own clock) */
  /* o: { mode: () => "cin"|"calm"|"off", busy: () => "game"|"choose"|null } (both default to the real ones) */
  function create(o) {
    o = o || {};
    const modeFn = o.mode || mode, busyFn = o.busy || busy;
    let T = 0;                // ms, advanced by tick()
    let cur = null;           // the move: {kind, c (cfg), t0, z0, c0:[x,y], r0, zT, rT, focus:[...], own, merged}
    let lastOpt = -Infinity, lastMove = -Infinity, bumpT = -Infinity, bumpZ = 0;
    let G = { W: 300, H: 200, vis: null, boxes: {} };
    let last = null;          // the last view (moves start from it)
    const log = [];           // what happened, for tests: {t, kind, did}
    const note = (kind, did) => { if (log.length > 200) log.shift(); log.push({ t: Math.round(T), kind, did }); };
    const wake = new Set();

    const box = (f) => (Array.isArray(f) ? f : typeof f === "string" ? G.boxes[f] || null : f && f.l != null ? [f.l, f.t, f.r, f.b] : null);
    function aim(focus) {
      const bs = (focus || []).map(box).filter(Boolean);
      if (!bs.length) return { pt: null, keep: null };
      const keep = [Math.min(...bs.map((q) => q[0])), Math.min(...bs.map((q) => q[1])), Math.max(...bs.map((q) => q[2])), Math.max(...bs.map((q) => q[3]))];
      let x = 0, y = 0; for (const q of bs) { x += (q[0] + q[2]) / 2; y += (q[1] + q[3]) / 2; }
      return { pt: [x / bs.length, y / bs.length], keep };
    }
    const span = (m) => m.c.ms + (m.c.hold === Infinity ? Infinity : m.c.hold) + (m.c.rev ? 0 : CFG.out);
    const phaseOf = (m) => { const t = T - m.t0; return t < m.c.ms ? "in" : t < m.c.ms + m.c.hold ? "hold" : t < span(m) ? "out" : "done"; };
    const live = (m) => !!m && phaseOf(m) !== "done";
    const scaleZ = (z, M) => Math.min(M.max, 1 + (z - 1) * M.k);

    /* a moment happened: kind (CFG.moments), o = {focus: ["hero", "foe", [l,t,r,b]...], own, dir (attacker side), hitstop (ms)}
       -> {ok, slow: [factor, ms] | null} */
    function ev(kind, e) {
      e = e || {};
      const c = CFG.moments[kind]; if (!c) return { ok: false, slow: null };
      const M = CFG.modes[modeFn()] || CFG.modes.cin;
      if (!M.k) { note(kind, "off"); return { ok: false, slow: null }; }
      const by = busyFn(), big = kind === "victory" || kind === "intro";
      if (by === "game" && !big) { note(kind, "busy"); return { ok: false, slow: null }; }
      if (by === "choose" && e.own === false && !big) { note(kind, "not yours"); return { ok: false, slow: null }; }
      const slow = M.slow && c.slow ? [c.slow[0], Math.max(0, c.slow[1] - (e.hitstop || 0))] : null;
      const rT = M.tilt && c.tilt ? (c.tilt * Math.PI / 180) * (e.dir < 0 ? -1 : 1) : 0;
      if (live(cur) && phaseOf(cur) !== "out") {
        if (T - cur.t0 <= CFG.merge) {   // together: one move, the bigger kind, both fighters in it
          const top = c.pri > cur.c.pri ? { kind, c } : { kind: cur.kind, c: cur.c };
          cur.focus = [...cur.focus, ...(e.focus || [])]; cur.kind = top.kind; cur.c = top.c;
          cur.zT = Math.max(cur.zT, scaleZ(c.z, M)); if (Math.abs(rT) > Math.abs(cur.rT)) cur.rT = rT;
          cur.own = cur.own || e.own !== false; cur.merged = (cur.merged || 1) + 1;
          note(kind, "merged"); fire(); return { ok: true, slow };
        }
        if (c.pri <= cur.c.pri) { note(kind, "dropped"); return { ok: false, slow: null }; }
        if (cur.own && e.own === false && !big) { note(kind, "not yours"); return { ok: false, slow: null }; }
      }
      if (c.opt && T - lastOpt < CFG.cooldown) { note(kind, "cooldown"); return { ok: false, slow: null }; }
      // a new move starts from wherever the camera is now (no jump), or for the intro: from the close-up
      const V = last || NEUTRAL(G.W, G.H, G.vis), A = aim(e.focus);
      const z0 = c.rev ? scaleZ(c.z0, M) : V.z;
      cur = { kind, c, t0: T, z0, c0: c.rev && A.pt ? A.pt : [V.cx, V.cy], r0: c.rev ? rT : V.rot || 0, zT: scaleZ(c.z, M), rT: c.rev ? 0 : rT, focus: (e.focus || []).slice(), own: e.own !== false };
      lastMove = T; if (c.opt) lastOpt = T;
      note(kind, "move"); fire();
      return { ok: true, slow };
    }
    /* an ordinary blow landed: a tiny punch in (Cinematic only), never a move of its own */
    function bump() {
      const M = CFG.modes[modeFn()] || CFG.modes.cin;
      if (!M.bump || busyFn() === "game") return false;
      bumpT = T; bumpZ = CFG.impact.dz; fire(); return true;
    }
    function fire() { for (const f of wake) { try { f(); } catch { /* a scene that's gone */ } } }

    /* where the camera is now: {z, cx, cy, ax, ay, rot, kind, W, H} (clamped to the stage and the fighters in view) */
    function view() {
      const N = NEUTRAL(G.W, G.H, G.vis);
      if (busyFn() === "game" && cur && !["victory", "intro"].includes(cur.kind) && phaseOf(cur) !== "out" && phaseOf(cur) !== "done") cur.t0 = T - cur.c.ms - cur.c.hold;   // a minigame opened: ease back now
      let z = 1, fx = N.cx, fy = N.cy, rot = 0, keep = null, kind = null;
      if (live(cur)) {
        const m = cur, t = T - m.t0, A = aim(m.focus), tgt = m.c.rev ? [N.cx, N.cy] : A.pt || [N.cx, N.cy];
        keep = m.c.rev ? null : A.keep; kind = m.kind;
        const ph = phaseOf(m);
        if (ph === "in") { const q = (EASE[m.c.ease] || EASE.out)(clamp(t / Math.max(1, m.c.ms), 0, 1)); z = m.z0 + (m.zT - m.z0) * q; fx = m.c0[0] + (tgt[0] - m.c0[0]) * q; fy = m.c0[1] + (tgt[1] - m.c0[1]) * q; rot = m.r0 + (m.rT - m.r0) * q; }
        else if (ph === "hold") { z = m.zT; [fx, fy] = tgt; rot = m.rT; }
        else { const q = EASE.inout(clamp((t - m.c.ms - m.c.hold) / CFG.out, 0, 1)); z = m.zT + (1 - m.zT) * q; fx = tgt[0] + (N.cx - tgt[0]) * q; fy = tgt[1] + (N.cy - tgt[1]) * q; rot = m.rT * (1 - q); }
      } else if (cur) cur = null;
      const bt = T - bumpT; if (bt >= 0 && bt < CFG.impact.ms) z += bumpZ * Math.sin(Math.PI * bt / CFG.impact.ms);
      const M = CFG.modes[modeFn()] || CFG.modes.cin;
      z = Math.min(z, Math.max(M.max, 1)); if (!M.tilt) rot = 0;
      const F = frame({ W: G.W, H: G.H, vis: G.vis, z, focus: [fx, fy], keep });
      // a zoom that came out at neutral is exactly neutral (no drift)
      last = { z: F.z, cx: F.z === 1 ? F.ax : F.cx, cy: F.z === 1 ? F.ay : F.cy, ax: F.ax, ay: F.ay, rot: F.z === 1 && !rot ? 0 : rot, kind, W: G.W, H: G.H };
      return last;
    }
    return {
      ev, bump, view,
      tick(ms) { if (ms > 0 && isFinite(ms)) T += Math.min(ms, 250); },
      /* the stage this frame: {W, H, vis: [l, t, r, b], boxes: {hero: [l,t,r,b], foe: [...] , <ally name>: [...]}} */
      geo(g) { G = { ...G, ...g }; },
      active: () => live(cur) || T - bumpT < CFG.impact.ms,
      get kind() { return live(cur) ? cur.kind : null; },
      get phase() { return cur ? phaseOf(cur) : "done"; },
      /* holding still for good (the win): nothing to redraw */
      get still() { return live(cur) && cur.c.hold === Infinity && phaseOf(cur) === "hold" && T - bumpT >= CFG.impact.ms; },
      get now() { return T; },
      get log() { return log; },
      onWake(f) { wake.add(f); return () => wake.delete(f); },
      reset() { cur = null; last = null; bumpT = -Infinity; lastOpt = -Infinity; lastMove = -Infinity; },
    };
  }

  /* ------------------------------------------------------------------ drawing: the layers, moved by the canvas matrix */
  /* g: the 2D context, k: backing px per stage unit, V: view, sx/sy: shake (stage units). Returns
     { flat, set(p), paint(im, sx, sy, sw, sh, dx, dy, dw, dh, o), toScreen(x, y), toStage(qx, qy) } */
  function layers(g, k, V, shx, shy) {
    shx = shx || 0; shy = shy || 0;
    const flat = isFlat(V) && !shx && !shy, W = V.W, H = V.H, os = CFG.overscan;
    const set = (p) => { const m = matrix(V, p, shx, shy); g.setTransform(m[0] * k, m[1] * k, m[2] * k, m[3] * k, m[4] * k, m[5] * k); };
    /* what a layer at p shows of the stage (with room for the shake and the tilt) */
    const win = (p) => {
      const z = 1 + (V.z - 1) * p, cx = V.ax + (V.cx - V.ax) * p, cy = V.ay + (V.cy - V.ay) * p, m = (Math.abs(shx) + Math.abs(shy) + Math.abs(V.rot || 0) * (W + H) * 0.6) / z + (flat ? 0 : 1);
      return [cx - V.ax / z - m, cy - V.ay / z - m, cx + (W - V.ax) / z + m, cy + (H - V.ay) / z + m];
    };
    /* one row of the backdrop: across, it moves at its own parallax; up and down, each of its edges sits where the
       parallax at that height puts it (Ys), so neighbouring rows always meet with no seam. One tilt for every row. */
    const zP = (p) => 1 + (V.z - 1) * p, cxP = (p) => V.ax + (V.cx - V.ax) * p, cyP = (p) => V.ay + (V.cy - V.ay) * p;
    const Ys = (y) => { const p = pOf(y / H); return V.ay + zP(p) * (y - cyP(p)); };
    const co = Math.cos(V.rot || 0), si = Math.sin(V.rot || 0);
    const row = (p, y0, y1) => {
      const ux = zP(p), vs = (Ys(y1) - Ys(y0)) / (y1 - y0), X0 = -ux * cxP(p), Y0 = Ys(y0) - V.ay - vs * y0;
      g.setTransform(co * ux * k, si * ux * k, -si * vs * k, co * vs * k, (V.ax + shx + co * X0 - si * Y0) * k, (V.ay + shy + si * X0 + co * Y0) * k);
    };
    /* draw a picture's (sx, sy, sw, sh) into the stage rect (dx, dy, dw, dh), cut into rows that each move at their own
       parallax (o.p fixes one factor); where the camera would see past the rect, the picture's edge is mirrored, up to
       the overscan. o.top / o.bottom: mirror over those edges too */
    function paint(im, sx, sy, sw, sh, dx, dy, dw, dh, o) {
      o = o || {};
      if (!im || dw <= 0 || dh <= 0) return;
      const n = o.p != null || flat ? 1 : Math.max(1, Math.round(CFG.slices * dh / H)), rh = dh / n, sk = sh / dh, kx = sw / dw;
      const maxX = os * W, maxY = os * H;
      for (let i = 0; i < n; i++) {
        const y0 = dy + i * rh, y1 = i === n - 1 ? dy + dh : y0 + rh + 1 / k, p = o.p != null ? o.p : pOf((y0 + rh / 2) / H);
        const srcY = sy + (y0 - dy) * sk, srcH = Math.min(sy + sh - srcY, (y1 - y0) * sk);
        if (o.p != null || flat) set(p); else row(p, y0, y0 + rh);
        g.drawImage(im, sx, srcY, sw, srcH, dx, y0, dw, y1 - y0);
        const w = win(p), gl = Math.min(maxX + Math.max(0, dx), dx - w[0]), gr = Math.min(maxX + Math.max(0, W - dx - dw), w[2] - (dx + dw));   // the gap a narrow plate always leaves, plus the overscan
        if (gl > 0) { const sp = Math.min(sw, Math.ceil((gl + 1) * kx)); g.save(); g.translate(dx, 0); g.scale(-1, 1); g.drawImage(im, sx, srcY, sp, srcH, 0, y0, sp / kx, y1 - y0); g.restore(); }
        if (gr > 0) { const sp = Math.min(sw, Math.ceil((gr + 1) * kx)); g.save(); g.translate(dx + dw, 0); g.scale(-1, 1); g.drawImage(im, sx + sw - sp, srcY, sp, srcH, -sp / kx, y0, sp / kx, y1 - y0); g.restore(); }
        const L = dx - Math.max(0, gl), R = dx + dw + Math.max(0, gr);   // the mirrored rows above / below cover the corners too
        if (i === 0 && o.top) { const gt = Math.min(maxY + Math.max(0, dy), dy - w[1]); if (gt > 0) { const sp = Math.min(sh, Math.ceil((gt + 1) * sk)); g.save(); g.translate(0, dy); g.scale(1, -1); g.drawImage(im, sx, sy, sw, sp, L, 0, R - L, sp / sk); g.restore(); } }
        if (i === n - 1 && o.bottom) { const gb = Math.min(maxY + Math.max(0, H - dy - dh), w[3] - (dy + dh)); if (gb > 0) { const sp = Math.min(sh, Math.ceil((gb + 1) * sk)); g.save(); g.translate(0, dy + dh); g.scale(1, -1); g.drawImage(im, sx, sy + sh - sp, sw, sp, L, -sp / sk, R - L, sp / sk); g.restore(); } }
      }
    }
    return { flat, set, paint, pOf, Ys, near: CFG.near, toScreen: (x, y) => toScreen(V, x, y), toStage: (qx, qy) => toStage(V, k, qx, qy, shx, shy), V };
  }

  /* ------------------------------------------------------------------ the fight screen's camera and its events */
  const main = create();
  /* fightpres.js: a big banner went up -> the moment it stands for */
  function banner(kind, node) {
    const c = node && node.classList;
    if (kind === "intro") return main.ev("intro", { focus: ["foe"] });
    if (kind === "end") return c && c.contains("lost") ? null : main.ev("victory", { focus: ["hero", "foe"] });
    if (kind === "phase") return main.ev("brk", { focus: ["foe"] });
    if (kind === "turn" && c && c.contains("me")) return main.ev("turn", { focus: ["hero"], own: true });
    return null;
  }
  /* for other features: look at someone for a moment ("hero", "foe", an ally's name, or a stage box [l, t, r, b]) */
  const focus = (who, o) => main.ev("focus", { focus: Array.isArray(who) && typeof who[0] !== "number" ? who : [who], own: !(o && o.own === false) });
  /* for other features: play a moment ("crit", "brk", "heavy", "kill", "bosskill", "victory", "intro") or "impact" */
  const punch = (kind, o) => (kind === "impact" ? main.bump() : main.ev(kind, o || {}));

  return { CFG, MODES, EASE, pref, mode, modeOf, reduce, pOf, frame, matrix, toScreen, toStage, isFlat, NEUTRAL, create, layers, busy, hold, main, banner, focus, punch };
})();
if (typeof module !== "undefined") module.exports = FIGHTCAM;
