/* huntart.js: the painted look of the hunting mini-game. [OURS] huntgame.js keeps every rule (stalk, aim, shot, skinning);
   this file only draws. Owner: "Use gpt to create art for minigames, they also should get a graphical and animation overhaul."
   - The painted clearing (mg-hunting-bg) in three layers that spread apart as you creep closer (parallax), drifting mist,
     leaves and seeds blowing with the wind, grass that leans with it.
   - Painted animals (animal-deer/elk/fox/hare.webp; the snow fox is the fox, bleached) cut into body, head, ear, tail and
     legs: they graze with a nibbling bob, lift the head when they look up, flick ears and tail, raise the tail in alarm,
     gallop away (legs scissor, body rocks), flinch on a hit and fold up when the shot is clean. Other animals keep the
     drawn ink animal (huntgame.js drawAnimal), and with no backdrop the whole old ink picture comes back.
   - Your bow (or crossbow) bottom left, painted (rig-w-bow, rig-w-bow-drawn; the line drawing until they load): raised and drawn over 0.8 s, breathing at full draw, the string snaps on release.
     The arrow flies a real arc, shrinking with distance, and sticks where it lands. Blood follows Settings → Gore:
     Off (fur and dust only), Reduced (a few dark drops) or Full (a spray, drops on the grass and a pool).
   - Skinning: the hide (cut from the painting, spine in the middle) stretched on a pole frame, a knife pass along its edge.
     The scene is graded for the clock and the weather (scenegrade.js); the arrows are the painted rig-w-arrow.
   - Painted foreground (hunt-fg-branch-left/-right, hunt-fg-grass): branches hanging from the top corners, each swaying
     about a degree on its own 5-9 s wind cycle, and grass along the bottom edge bending a few pixels; darker and a touch
     soft, kept to the sides so the middle (where the animals walk and you aim) stays clear.
   All drawing is in huntgame.js units (560×300); FITCANVAS keeps it sharp from 360 px phones to 3440 px screens.
   Visual-only randomness: a local generator (the shared rolls stay in huntgame.js). */
const HUNTART = (() => {
  const DOM = typeof document !== "undefined";
  const BG = "mg-hunting-bg", BGW = 2048, BGH = 1152;
  const PI = Math.PI;
  /* sprite rigs, in the trimmed sprite's pixels (side view, facing right):
     c = torso centre and hw = torso half width (they sit on the rules' body ellipse: bx, by, rx), feet = ground line,
     legTop = where the legs leave the body, nose = tip of the snout; head/ear/tail = a polygon cut out and turned round piv.
     graze = how far the head turns down to eat. */
  const RIG = {
    deer: { key: "animal-deer", c: [330, 310], hw: 215, feet: 578, legTop: 385, nose: [640, 205], graze: 0.95,
      head: { poly: [[340, 0], [653, 0], [653, 380], [560, 360], [405, 222], [380, 150], [340, 100]], piv: [415, 235] },
      ear: { poly: [[485, 126], [534, 126], [534, 180], [485, 180]], piv: [526, 174] },
      tail: { poly: [[84, 236], [136, 236], [136, 346], [84, 346]], piv: [126, 250] } },
    elk: { key: "animal-elk", c: [335, 310], hw: 245, feet: 590, legTop: 405, nose: [705, 235], graze: 0.85,
      head: { poly: [[250, 0], [720, 0], [720, 400], [595, 385], [440, 212], [400, 175], [250, 140]], piv: [440, 225] },
      ear: { poly: [[545, 180], [593, 180], [593, 226], [545, 226]], piv: [585, 220] },
      tail: { poly: [[68, 238], [114, 238], [114, 332], [68, 332]], piv: [104, 252] } },
    fox: { key: "animal-fox", c: [355, 150], hw: 170, feet: 318, legTop: 215, nose: [640, 125], graze: 0.7,
      head: { poly: [[455, 0], [648, 0], [648, 235], [530, 225], [478, 80], [455, 40]], piv: [478, 92] },
      ear: { poly: [[535, 0], [616, 0], [616, 70], [535, 70]], piv: [575, 68] },
      tail: { poly: [[0, 30], [215, 30], [226, 170], [150, 215], [110, 260], [60, 300], [0, 300]], piv: [208, 95] } },
    hare: { key: "animal-hare", c: [250, 205], hw: 170, feet: 362, legTop: 262, nose: [495, 160], graze: 0.45,
      head: { poly: [[330, 0], [511, 0], [511, 265], [430, 255], [365, 150], [345, 100], [330, 60]], piv: [365, 160] },
      ear: { poly: [[352, 0], [452, 0], [452, 105], [395, 128], [352, 110]], piv: [405, 118] },
      tail: { poly: [[42, 162], [106, 162], [106, 242], [42, 242]], piv: [98, 200] } },
  };
  const MAP = { deer: "deer", elk: "elk", fox: "fox", snowfox: "fox", hare: "hare" };
  const img = (k) => (typeof ASSETS !== "undefined" ? ASSETS.img(k) : null);
  const still = () => { try { return typeof A11Y !== "undefined" && A11Y.reduceMotion(); } catch { return false; } };
  const goreLevel = () => { try { return typeof GORE !== "undefined" ? GORE.level() : "low"; } catch { return "low"; } };
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  function mkRnd(seed) { let a = seed >>> 0 || 1; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
  const hash01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  /* a short flick now and then: 0..1 pulse */
  function flick(T, every, len, off) {
    const n = Math.floor((T + off) / every), ph = T + off - n * every;
    return hash01(n + off * 7) > 0.45 && ph < len ? Math.sin(ph / len * PI) : 0;
  }
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
  const path = (x, poly) => { x.beginPath(); poly.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); };

  // ---------------------------------------------------------------- the backdrop, cut into layers once
  let layers = null;
  function bgLayers() {
    if (layers) return layers;
    const im = img(BG); if (!im || !DOM) return null;
    const lw = Math.min(im.naturalWidth, 1600), lh = Math.round(lw * im.naturalHeight / im.naturalWidth);
    const band = (y0, y1) => {
      const c = mk(lw, lh), x = c.getContext("2d");
      x.drawImage(im, 0, 0, lw, lh);
      const gr = x.createLinearGradient(0, lh * y0, 0, lh * y1); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "#000");
      x.globalCompositeOperation = "destination-in"; x.fillStyle = gr; x.fillRect(0, 0, lw, lh);
      return c;
    };
    layers = { far: im, mid: band(0.5, 0.6), fore: band(0.86, 0.95) };
    return layers;
  }
  function layer(g, src, W, H, z, ax, ay, dx, dy) {
    const c = Math.max(W / BGW, H / BGH), dw = BGW * c, dh = BGH * c, x0 = (W - dw) / 2, y0 = (H - dh) / 2;
    g.drawImage(src, ax + (x0 - ax) * z + dx, ay + (y0 - ay) * z + dy, dw * z, dh * z);
  }

  // ---------------------------------------------------------------- animal pieces, cut once per animal
  const pieces = {};
  function rigFor(id) {
    const rid = MAP[id]; if (!rid || !DOM) return null;
    const key = id === "snowfox" ? "snowfox" : rid;
    if (pieces[key]) return pieces[key];
    const R = RIG[rid], im = img(R.key); if (!im) return null;
    const w = im.naturalWidth, h = im.naturalHeight;
    let src = mk(w, h); src.getContext("2d").drawImage(im, 0, 0);
    if (id === "snowfox") {   // bleach the red fox into a snow fox: no colour, lighter, a cold tint, its own outline kept
      const t = mk(w, h), x = t.getContext("2d");
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = "saturation"; x.fillStyle = "#808080"; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = "screen"; x.fillStyle = "#8e9298"; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = "destination-in"; x.drawImage(src, 0, 0);
      src = t;
    }
    const cut = (poly, grow, minus) => {
      const m = mk(w, h), mx = m.getContext("2d");
      mx.fillStyle = mx.strokeStyle = "#000"; path(mx, poly); mx.fill();
      if (grow) { mx.lineWidth = grow; mx.lineJoin = "round"; mx.stroke(); }
      const c = mk(w, h), x = c.getContext("2d");
      x.drawImage(src, 0, 0); x.globalCompositeOperation = "destination-in"; x.drawImage(m, 0, 0);
      if (minus) { x.globalCompositeOperation = "destination-out"; for (const p of minus) { path(x, p); x.fill(); } }
      return c;
    };
    const body = mk(w, h), bx = body.getContext("2d");
    bx.drawImage(src, 0, 0); bx.globalCompositeOperation = "destination-out";
    for (const p of [R.head.poly, R.tail.poly]) { path(bx, p); bx.fill(); }
    pieces[key] = { R, w, h, body, head: cut(R.head.poly, 6, [R.ear.poly]), ear: cut(R.ear.poly, 5), tail: cut(R.tail.poly, 5), full: src };
    return pieces[key];
  }
  function part(g, cv, piv, a) {
    if (Math.abs(a) < 1e-4) { g.drawImage(cv, 0, 0); return; }
    g.save(); g.translate(piv[0], piv[1]); g.rotate(a); g.translate(-piv[0], -piv[1]); g.drawImage(cv, 0, 0); g.restore();
  }
  /* draw a rigged animal; pose: x, y (torso centre on screen), s (screen units per sprite px), f (facing), rot, headA, earA,
     tailA, kf/kh (front / hind leg skew), fold (0..1 legs folded), alpha. Returns where its nose and a stuck point land. */
  function drawRig(g, P, pose, stuck) {
    const R = P.R, out = {};
    g.save(); g.globalAlpha = pose.alpha ?? 1;
    g.translate(pose.x, pose.y); g.rotate(pose.rot || 0); g.scale(pose.f * pose.s, pose.s); g.translate(-R.c[0], -R.c[1]);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    part(g, P.tail, R.tail.piv, pose.tailA || 0);
    const kf = pose.kf || 0, kh = pose.kh || 0, fold = pose.fold || 0, lt = R.legTop;
    if (!kf && !kh && !fold) g.drawImage(P.body, 0, 0);
    else {
      for (const [k, x0, x1] of [[kh, -400, R.c[0]], [kf, R.c[0], P.w + 400]]) {
        g.save();
        g.translate(0, lt); g.scale(1, 1 - fold * 0.82); g.transform(1, 0, k, 1, 0, 0); g.translate(0, -lt);
        g.beginPath(); g.rect(x0, lt - 2, x1 - x0, P.h); g.clip();
        g.drawImage(P.body, 0, 0); g.restore();
      }
      g.save(); g.beginPath(); g.rect(-10, -10, P.w + 20, lt + 10); g.clip(); g.drawImage(P.body, 0, 0); g.restore();
    }
    if (stuck && stuck.wound) {   // a wound on the flank (Reduced: small and dark; Full: wetter, with a run)
      const r = R.hw * (stuck.wound === "full" ? 0.07 : 0.045);
      const gr = g.createRadialGradient(stuck.lx, stuck.ly, 0, stuck.lx, stuck.ly, r);
      gr.addColorStop(0, stuck.wound === "full" ? "rgba(70,4,4,.95)" : "rgba(50,14,10,.85)"); gr.addColorStop(1, "rgba(80,8,6,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(stuck.lx, stuck.ly, r, 0, 7); g.fill();
      if (stuck.wound === "full") { g.strokeStyle = "rgba(90,6,6,.75)"; g.lineWidth = r * 0.28; g.lineCap = "round"; g.beginPath(); g.moveTo(stuck.lx, stuck.ly); g.quadraticCurveTo(stuck.lx + r * 0.2, stuck.ly + r * 1.4, stuck.lx - r * 0.1, stuck.ly + r * (1.6 + (stuck.run || 0))); g.stroke(); }
    }
    g.save(); g.translate(R.head.piv[0], R.head.piv[1]); g.rotate(pose.headA || 0); g.translate(-R.head.piv[0], -R.head.piv[1]);
    g.drawImage(P.head, 0, 0);
    part(g, P.ear, R.ear.piv, pose.earA || 0);
    try { const m = g.getTransform(); out.nose = m.transformPoint(new DOMPoint(R.nose[0], R.nose[1])); } catch { /* old webview */ }
    g.restore();
    try { if (stuck) { const m = g.getTransform(); out.stuck = m.transformPoint(new DOMPoint(stuck.lx, stuck.ly)); } } catch { /* old webview */ }
    g.restore();
    return out;
  }

  // ---------------------------------------------------------------- per-hunt visual state
  function vis(st) {
    if (!st.vis) st.vis = { T: 0, last: 0, headA: null, leaves: null, parts: [], splats: [], mv: 0, phase: st.phase, phT: 0, rnd: mkRnd(Math.floor((st.g.dist || 50) * 1000)), puffT: 0 };
    return st.vis;
  }
  function spawnLeaves(V, W, H, wind) {
    const n = wind.str ? 5 + wind.str * 5 : 6, r = V.rnd;
    V.leaves = [];
    for (let i = 0; i < n; i++) V.leaves.push({ x: r() * W, y: 20 + r() * (H - 40), z: 0.5 + r() * 0.9, a: r() * 7, sp: (r() - 0.5) * 6, k: r(), ph: r() * 7 });
  }
  const LEAF = ["#d9a43a", "#c27a2a", "#9a8a3a", "#e3c066", "#b5562a"];

  // ---------------------------------------------------------------- one frame. false = no backdrop yet (huntgame draws ink)
  function draw(g, st, ts, A) {
    const L = bgLayers(); if (!L) return false;
    const W = A.W, H = A.H, G2 = st.g, V = vis(st);
    const T = ts / 1000, dt = V.last ? clamp(T - V.last, 0, 0.05) : 0.016; V.last = T; V.T += dt;
    if (V.phase !== st.phase) { V.phase = st.phase; V.phT = 0; } else V.phT += dt;
    let base = 1; try { base = g.getTransform().a || 1; } catch { /* old webview */ }
    // the clock and the sky here (looked up once every few seconds): graded over the painting below
    if (!V.sky || V.T - V.skyT > 4) { V.skyT = V.T; V.sky = typeof SCENEGRADE !== "undefined" ? SCENEGRADE.look(st.opts && st.opts.pos) : { night: (() => { try { return G.isNight(); } catch { return false; } })(), wx: "clear" }; }
    const night = V.sky.night, wx = V.sky.wx;
    const gore = goreLevel(), wind = G2.wind, wd = wind.dir * wind.str;
    // ---- the clearing: three layers spreading apart as you close in, a bob while you creep, a breath while you aim
    V.mv = lerp(V.mv, st.phase === "stalk" && st.moving && G2.dist > 18 ? 1 : 0, Math.min(1, dt * 6));
    const near = clamp((86 - G2.dist) / 68, 0, 1), aiming = st.phase === "aim";
    const bobY = Math.sin(V.T * 7.5) * 1.6 * V.mv + (aiming ? Math.sin(V.T * 3.1) * 0.6 : 0), bobX = Math.sin(V.T * 3.75) * 1.2 * V.mv;
    const ax = 330, ay = 172;
    g.fillStyle = "#2a2a22"; g.fillRect(0, 0, W, H);
    layer(g, L.far, W, H, 1 + 0.05 * near, ax, ay, bobX * 0.3, bobY * 0.3);
    // mist drifting over the meadow
    for (let k = 0; k < 2; k++) {
      const mx = ((V.T * (4 + wind.str * 3) * (wind.dir || 1) + k * 300) % (W + 400) + W + 400) % (W + 400) - 200, my = 128 + k * 22;
      const gr = g.createRadialGradient(mx, my, 4, mx, my, 170); gr.addColorStop(0, "rgba(235,228,214,.16)"); gr.addColorStop(1, "rgba(235,228,214,0)");
      g.fillStyle = gr; g.fillRect(mx - 200, my - 60, 400, 120);
    }
    layer(g, L.mid, W, H, 1 + 0.15 * near, ax, ay, bobX * 0.6, bobY * 0.6);

    // ---- the animal
    const b = A.box(G2), P = rigFor(G2.id), done = st.phase === "done", res = st.res;
    const kill = done && res && res.kill, clean = kill && res.quality === "clean";
    const shot = st.shot;
    if (done && !V.hitDone) {   // the moment the arrow lands: blood, fur or dust, and the wound it keeps
      V.hitDone = true;
      if (shot && shot.hit !== "miss" && P) {
        const s0 = b.rx / P.R.hw;
        V.stuck = { lx: P.R.c[0] + (shot.x - b.bx) / (G2.facing * s0), ly: P.R.c[1] + (shot.y - b.by) / s0, wound: gore === "off" ? null : gore === "low" ? "low" : "full" };
      } else if (shot && shot.hit !== "miss") V.stuckInk = { dx: shot.x - b.bx, dy: shot.y - b.by };
      if (shot) burst(V, shot, shot.hit, gore, b);
    }
    let pose = null, feetY = b.by, fade = 1, inIt = null;
    if (P) {
      const R = P.R, s = b.rx / R.hw;
      feetY = b.by + (R.feet - R.c[1]) * s;
      const look = G2.head === "up";
      if (V.headA == null) V.headA = look ? -0.06 : R.graze;
      const alarm = clamp((G2.alert - 0.4) / 0.4, 0, 1);
      pose = { x: b.bx, y: b.by + Math.sin(V.T * 2.1) * b.ry * 0.02, s, f: G2.facing, rot: 0, headA: 0, earA: 0, tailA: 0 };
      if (!done) {
        const tgt = look ? -0.06 - alarm * 0.06 : R.graze + Math.sin(V.T * 6.3) * 0.05 + Math.max(0, Math.sin(V.T * 1.3)) * 0.06;
        V.headA = lerp(V.headA, tgt, Math.min(1, dt * (look ? 11 : 3.2)));
        pose.headA = V.headA;
        pose.earA = -flick(V.T, look ? 0.9 : 1.6, 0.22, 0.3) * 0.3 - alarm * 0.1;
        pose.tailA = flick(V.T, 2.3, 0.3, 1.1) * 0.35 + alarm * 0.55;
        pose.rot = alarm * Math.sin(V.T * 30) * 0.004;   // a tense shiver when it's about to run
        pose.kf = look ? 0 : Math.sin(V.T * 0.7) * 0.03;   // weight shifts while it eats
      } else {
        const t = V.phT;
        if (clean) {   // flinch, then the legs fold and it settles in the grass
          const fl = t < 0.18 ? Math.sin(t / 0.18 * PI) : 0, c = ease((t - 0.18) / 0.85);
          pose.y -= fl * b.ry * 0.25;
          pose.fold = c; pose.y += (R.feet - R.legTop) * s * 0.82 * c;
          pose.rot = G2.facing * 0.07 * c;
          pose.headA = lerp(lerp(V.headA, -0.3, Math.min(1, t / 0.18)), R.graze * 0.8 + 0.25, c);
          pose.tailA = t > 1.4 && t < 1.7 ? Math.sin((t - 1.4) / 0.3 * PI) * 0.3 : 0;
          if (t > 0.9 && !V.dust) { V.dust = true; puff(V, b.bx, feetY, b.rx * 1.4, "#b9a98a", 10); if (gore === "full") V.pool = { x: b.bx + G2.facing * b.rx * 0.3, y: feetY - 2, r: b.rx * 0.65, t0: V.T }; }
        } else {   // turns and bolts: legs scissor, body rocks, tail up; wounded ones leave drops on the grass
          const t0 = shot && shot.hit !== "miss" ? 0.16 : shot ? 0.08 : 0, tf = Math.max(0, t - t0), dir = -G2.facing;
          if (t < t0) { pose.y -= Math.sin(t / t0 * PI) * b.ry * 0.3; pose.headA = -0.25; pose.tailA = 0.6; }
          else {
            const ph = tf * 16, sc = Math.max(0.45, 1 - tf * 0.35);
            pose.f = dir; pose.s = s * sc;
            pose.x = b.bx + dir * (115 * tf + 130 * tf * tf);
            pose.y = b.by - tf * 26 - Math.abs(Math.sin(ph)) * b.ry * 0.35 * sc + (1 - sc) * 0;
            pose.rot = Math.sin(ph) * 0.07 * dir;
            pose.kf = Math.sin(ph) * 0.55; pose.kh = -Math.sin(ph + 0.6) * 0.55;
            pose.headA = -0.12 + Math.sin(ph) * 0.06; pose.tailA = 0.7; pose.earA = -0.15;
            fade = clamp(1.9 - tf * 1.1, 0, 1); pose.alpha = fade;
            feetY = pose.y + (R.feet - R.c[1]) * pose.s;
            if ((V.puffT -= dt) <= 0 && fade > 0.2) {
              V.puffT = 0.09; puff(V, pose.x - dir * b.rx * 0.6 * sc, feetY, b.rx * 0.6 * sc, "#c2b393", 3);
              if (V.stuck && V.stuck.wound) drip(V, pose.x, feetY, gore);
            }
          }
        }
      }
      // shadow under it
      if ((pose.alpha ?? 1) > 0.05) {
        const sw = pose.s * R.hw * 1.15, sy = feetY;
        const gr = g.createRadialGradient(pose.x, sy, 1, pose.x, sy, sw);
        gr.addColorStop(0, `rgba(20,18,10,${0.32 * (pose.alpha ?? 1)})`); gr.addColorStop(1, "rgba(20,18,10,0)");
        g.save(); g.translate(pose.x, sy); g.scale(1, 0.16); g.translate(-pose.x, -sy); g.fillStyle = gr; g.fillRect(pose.x - sw, sy - sw, sw * 2, sw * 2); g.restore();
      }
      if (V.pool) {   // Full gore: a dark pool spreading under the fallen animal
        const k = ease((V.T - V.pool.t0) / 2.2), r = V.pool.r * (0.3 + 0.7 * k);
        g.save(); g.translate(V.pool.x, V.pool.y); g.scale(1, 0.22);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, "rgba(40,4,4,.75)"); gr.addColorStop(0.6, "rgba(52,6,5,.45)"); gr.addColorStop(1, "rgba(52,6,5,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.restore();
      }
      if (V.stuck) V.stuck.run = done ? Math.min(1.2, V.phT * 0.6) : 0;
      const out = drawRig(g, P, pose, V.stuck);
      // the arrow in it is drawn after the grass in front, so the fletching never hides in the tufts
      if (out.stuck && (pose.alpha ?? 1) > 0.05) inIt = [out.stuck.x / base, out.stuck.y / base, stuckLen(b) * (pose.s / s), pose.alpha ?? 1];
      if (!done && G2.alert > 0.66 && Math.sin(V.T * 10) > -0.2 && out.nose) alertMark(g, out.nose.x / base, out.nose.y / base - b.rx * 0.9);
    } else {
      // no painted animal for this one: the ink animal, with a shadow and the old flee / fall
      const fleeing = done && !kill;
      const tf = done ? V.phT : 0, ox = fleeing ? -G2.facing * tf * 320 : 0;
      fade = fleeing ? clamp(1.3 - tf, 0, 1) : 1;
      if (fade > 0) {
        g.save(); g.globalAlpha = fade;
        const gr = g.createRadialGradient(b.bx + ox, b.by + b.ry * 1.9, 1, b.bx + ox, b.by + b.ry * 1.9, b.rx * 1.3);
        gr.addColorStop(0, "rgba(20,18,10,.3)"); gr.addColorStop(1, "rgba(20,18,10,0)"); g.fillStyle = gr;
        g.fillRect(b.bx + ox - b.rx * 1.4, b.by + b.ry * 1.5, b.rx * 2.8, b.ry * 0.8);
        A.drawAnimal(g, G2.id, b.bx + ox, b.by, b.rx, b.ry, G2.head === "up" && !kill, fleeing ? -G2.facing : G2.facing, V.T, kill, fleeing);
        if (V.stuckInk) stuckArrow(g, b.bx + ox + V.stuckInk.dx, b.by + V.stuckInk.dy + (kill ? b.ry * 0.5 : 0), stuckLen(b), fade, st.g.kind);
        g.restore();
      }
      feetY = b.by + b.ry * 1.9;
      if (!done && G2.alert > 0.66 && Math.sin(V.T * 10) > -0.2) alertMark(g, b.hx, b.hy - b.hr - 10);
    }
    // grass in front of its feet, so it stands in the meadow rather than on it
    if (!done || clean || fade > 0.05) tufts(g, b.bx, feetY + 1, b.rx, V.T, wd, near);
    if (inIt) stuckArrow(g, inIt[0], inIt[1], inIt[2], inIt[3], st.g.kind);
    // the arrow stuck in the ground after a miss, or still flying past
    if (done && shot && shot.hit === "miss") missArrow(g, st, V, b);
    drawSplats(g, V);
    // ---- the near layer (ferns and heather of the blind), then grass blowing in front of you
    layer(g, L.fore, W, H, 1 + 0.3 * near, ax, ay, bobX, bobY);
    blades(g, W, H, V.T, wind, V.mv);
    foreground(g, W, H, V.T, wd, bobX * 1.4, bobY * 1.4, still());
    // leaves and seeds on the wind
    if (!V.leaves) spawnLeaves(V, W, H, wind);
    for (const l of V.leaves) {
      const vx = (wind.str ? wind.dir * (22 + wind.str * 26) : 4) * l.z + Math.sin(V.T * 1.7 + l.ph) * 6;
      l.x += vx * dt; l.y += (6 * l.z + Math.sin(V.T * 2.3 + l.ph) * 14) * dt * (wind.str ? 1 : -0.4); l.a += (l.sp + vx * 0.03) * dt;
      if (l.x > W + 20) l.x = -20; if (l.x < -20) l.x = W + 20; if (l.y > H + 10) l.y = 10; if (l.y < -10) l.y = H - 20;
      g.save(); g.translate(l.x, l.y); g.rotate(l.a); g.scale(1, Math.abs(Math.sin(V.T * 3 + l.ph)) * 0.8 + 0.2);
      if (wind.str) { g.fillStyle = LEAF[(l.k * LEAF.length) | 0]; g.beginPath(); g.ellipse(0, 0, 3.2 * l.z, 1.6 * l.z, 0, 0, 7); g.fill(); g.strokeStyle = "rgba(60,40,20,.5)"; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-3 * l.z, 0); g.lineTo(3 * l.z, 0); g.stroke(); }
      else { g.fillStyle = "rgba(255,246,220,.75)"; g.beginPath(); g.arc(0, 0, 1.1 * l.z, 0, 7); g.fill(); }
      g.restore();
    }
    stepParts(g, V, dt);
    // ---- light: night, and a soft frame that tightens while you aim
    if (typeof SCENEGRADE !== "undefined") {
      SCENEGRADE.grade(g, W, H, { night, wx, sun: [77 + bobX * 0.3, 44 + bobY * 0.3], moon: [420, 34], hz: 125, T: V.T, calm: still(), soft: true });
      SCENEGRADE.front(g, W, H, { wx, T: V.T, calm: still(), wind: wd });
    } else if (night) { g.fillStyle = "rgba(10,16,34,.5)"; g.fillRect(0, 0, W, H); }
    const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.62);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(8,6,4,${aiming ? 0.62 : 0.42})`); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // ---- your bow, the aim and the arrow
    if (st.phase === "aim" || st.phase === "flight" || st.phase === "stalk") {
      const lit = typeof SCENEGRADE !== "undefined" ? SCENEGRADE.lamp({ night, wx }) : "none";
      g.save(); if (lit !== "none" && "filter" in g) g.filter = lit;
      bow(g, st, V, A, W, H);
      if (st.phase === "flight" && st.arrow) flyingArrow(g, st, A);
      g.restore();
      if (aiming) { const [tx, ty] = aimAt(st, A); reticle(g, st, A, tx, ty); }
    }
    windChip(g, wind, V.T, A.L);
    // ---- skinning, once it's down (or tracked down)
    if (kill) skinView(g, st, V, W, H, clean ? V.phT - 1.9 : V.phT - 1.6, P, A);
    return true;
  }

  // ---------------------------------------------------------------- the painted foreground (branches, grass)
  /* sizes in drawing units: branches 42% of the height (≈20% of the width each, the middle 60% stays clear), grass the
     full width and squashed a little so the middle third stays low (under the animals' feet) */
  const FG = { left: { key: "hunt-fg-branch-left", h: 0.42 }, right: { key: "hunt-fg-branch-right", h: 0.42 }, grass: { key: "hunt-fg-grass", sq: 0.78 } };
  const fgSoft = {};
  /* a darker, slightly soft copy (made once): the foreground is out of focus and in shade */
  function fgPic(k) {
    if (fgSoft[k]) return fgSoft[k];
    const im = img(k); if (!im || !DOM) return null;
    const w = Math.min(im.naturalWidth || im.width, 900), h = Math.round(w * (im.naturalHeight || im.height) / (im.naturalWidth || im.width));
    let c = im;
    try {
      c = mk(w, h); const x = c.getContext("2d");
      if ("filter" in x) x.filter = "blur(0.8px) brightness(0.8) saturate(0.9)";
      x.drawImage(im, 0, 0, w, h);
      if (!("filter" in x)) { x.globalCompositeOperation = "source-atop"; x.fillStyle = "rgba(10,10,6,.2)"; x.fillRect(0, 0, w, h); }
    } catch (e) { c = im; }
    return (fgSoft[k] = c);
  }
  /* dx/dy: a few units of parallax (the creep bob); wd: the wind (-1..1 dir × strength) */
  function foreground(g, W, H, T, wd, dx, dy, calm) {
    const sway = (per, ph) => (calm ? 0 : Math.sin(T * 2 * PI / per + ph));
    for (const side of ["left", "right"]) {
      const F = FG[side], pic = fgPic(F.key); if (!pic) continue;
      const h = H * F.h, w = h * pic.width / pic.height, L = side === "left";
      const a = (L ? 1 : -1) * (0.012 * sway(L ? 6.7 : 8.3, L ? 0.4 : 2.1) + 0.006 * sway(L ? 2.9 : 3.4, 1.3)) + wd * 0.006;
      g.save(); g.translate(L ? -2 + dx : W + 2 + dx, -2 + dy * 0.6); g.rotate(a);
      g.drawImage(pic, L ? 0 : -w, 0, w, h);
      g.restore();
    }
    const gp = fgPic(FG.grass.key);
    if (gp) {
      const w = W + 8, h = w * gp.height / gp.width * FG.grass.sq, y0 = H - h + 3 + Math.max(0, dy);
      const bend = (wd * 2.5 + 2 * sway(5.3, 0.7) + 1 * sway(2.2, 2.6)) / h;   // 2-5 units at the tips, nothing at the roots
      g.save(); g.transform(1, 0, -bend, 1, bend * (H + 3), 0); g.drawImage(gp, -4 + dx * 1.2, y0, w, h); g.restore();
    }
  }

  // ---------------------------------------------------------------- pieces of the scene
  function tufts(g, x, y, rx, T, wd, near) {
    g.save(); g.lineCap = "round";
    const n = 16, w = rx * 2.8, h = Math.max(4, rx * 0.45) * (0.8 + near * 0.3);
    for (let i = 0; i < n; i++) {
      const u = hash01(i * 3.1), px = x - w / 2 + (i + 0.5) * w / n + (u - 0.5) * 6, hh = h * (0.55 + hash01(i * 7.7) * 0.6);
      const lean = wd * 0.09 * hh + Math.sin(T * (1.8 + Math.abs(wd) * 0.6) + i) * hh * 0.08;
      g.strokeStyle = i % 3 ? "rgba(150,132,84,.9)" : "rgba(104,98,60,.9)"; g.lineWidth = Math.max(0.7, rx * 0.025);
      g.beginPath(); g.moveTo(px, y + 1); g.quadraticCurveTo(px + lean * 0.3, y - hh * 0.6, px + lean, y - hh); g.stroke();
    }
    g.restore();
  }
  function blades(g, W, H, T, wind, mv) {
    g.save();
    const lean = wind.dir * wind.str;
    for (let i = 0; i < 34; i++) {
      const u = hash01(i + 0.5), side = i < 17 ? u * 150 : W - u * 130, h = 26 + hash01(i * 2.3) * 46;
      const sw = lean * 4.5 + Math.sin(T * (1.4 + wind.str * 0.7) + i * 1.7) * (2 + wind.str * 2.2) + mv * Math.sin(T * 7.5 + i) * 3;
      const x = side, y = H + 6;
      const gr = g.createLinearGradient(x, y, x, y - h); gr.addColorStop(0, "rgba(18,22,10,.95)"); gr.addColorStop(1, i % 2 ? "rgba(92,98,48,.85)" : "rgba(128,112,58,.8)");
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - 2.4, y); g.quadraticCurveTo(x + sw * 0.35, y - h * 0.55, x + sw, y - h); g.quadraticCurveTo(x + sw * 0.35 + 1.2, y - h * 0.5, x + 2.4, y); g.closePath(); g.fill();
    }
    g.restore();
  }
  function alertMark(g, x, y) {
    g.save(); g.font = "800 20px 'Barlow Condensed', serif"; g.textAlign = "center"; g.lineWidth = 3.5; g.strokeStyle = "rgba(20,10,6,.85)"; g.strokeText("!", x, y); g.fillStyle = "#ffcf6a"; g.fillText("!", x, y); g.restore();
  }
  function windChip(g, wind, T, L) {
    const txt = wind.str ? `${L("Wind")} ${wind.dir > 0 ? "→" : "←"} ${wind.str}` : L("No wind");
    g.save(); g.font = "600 15px 'Barlow Condensed', serif";
    const tw = g.measureText(txt).width, x = 10, y = 10, w = tw + 46, h = 26;
    g.fillStyle = "rgba(10,10,12,.55)"; g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, 13); else g.rect(x, y, w, h); g.fill();
    g.strokeStyle = "rgba(228,220,200,.25)"; g.lineWidth = 1; g.stroke();
    // three streaks moving the wind's way
    g.strokeStyle = "rgba(232,224,204,.85)"; g.lineCap = "round"; g.lineWidth = 1.4;
    for (let k = 0; k < 3; k++) {
      const len = wind.str ? 6 + wind.str * 2 : 3, ph = wind.str ? ((T * (0.8 + wind.str * 0.5) + k / 3) % 1) : 0.5;
      const cx = x + 8 + ph * 18 * (wind.dir > 0 ? 1 : -1) + (wind.dir > 0 ? 0 : 18), cy = y + 8 + k * 5;
      g.globalAlpha = wind.str ? Math.sin(ph * PI) : 0.5; g.beginPath(); g.moveTo(cx - len / 2, cy); g.lineTo(cx + len / 2, cy); g.stroke();
    }
    g.globalAlpha = 1; g.fillStyle = "#efe6cf"; g.textBaseline = "middle"; g.fillText(txt, x + 34, y + h / 2 + 1);
    g.restore();
  }
  /* the bow bottom left: lowered while you stalk, raised and drawn over 0.8 s, breathing at full draw, snapping on release */
  function bow(g, st, V, A, W, H) {
    const G2 = st.g, aim = st.phase === "aim", fl = st.phase === "flight";
    const up = aim ? ease(Math.min(1, st.drawT / 0.35)) : fl ? 1 : 0;
    const draw = aim ? ease(Math.min(1, st.drawT / 0.8)) : 0;
    let tx = st.aim[0], ty = st.aim[1];
    if (aim) { const sw = A.swayAt(G2, st.drawT * 1.7, st.drawT); tx += sw[0]; ty += sw[1]; }
    if (fl && st.shot) { tx = st.shot.x; ty = st.shot.y; }
    const gx = lerp(26, 52, up), gy = lerp(H + 24, H - 34, up) + (aim && draw >= 1 ? Math.sin(V.T * PI) * 1.2 : 0);
    let a = Math.atan2(ty - gy, tx - gx); if (!aim && !fl) a = -0.9;
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;   // n: along the limbs
    g.save(); g.lineCap = "round"; g.lineJoin = "round";
    if (G2.kind === "bolt") {   // a crossbow: stock along the aim, a short bow across it
      const L2 = 70;
      g.strokeStyle = "#2b1c11"; g.lineWidth = 11; g.beginPath(); g.moveTo(gx - dx * 40, gy - dy * 40); g.lineTo(gx + dx * L2, gy + dy * L2); g.stroke();
      g.strokeStyle = "#6a4a2c"; g.lineWidth = 7; g.stroke();
      const fx = gx + dx * (L2 - 8), fy = gy + dy * (L2 - 8), bend = 10;
      g.strokeStyle = "#3a3634"; g.lineWidth = 4.5; g.beginPath(); g.moveTo(fx + nx * 34 - dx * bend, fy + ny * 34 - dy * bend); g.quadraticCurveTo(fx + dx * 6, fy + dy * 6, fx - nx * 34 - dx * bend, fy - ny * 34 - dy * bend); g.stroke();
      g.strokeStyle = "rgba(225,215,190,.8)"; g.lineWidth = 1; g.beginPath(); g.moveTo(fx + nx * 34 - dx * bend, fy + ny * 34 - dy * bend); g.lineTo(gx + dx * 20, gy + dy * 20); g.lineTo(fx - nx * 34 - dx * bend, fy - ny * 34 - dy * bend); g.stroke();
      if (aim) { g.strokeStyle = "#4b3a2a"; g.lineWidth = 3; g.beginPath(); g.moveTo(gx + dx * 20, gy + dy * 20); g.lineTo(fx + dx * 14, fy + dy * 14); g.stroke(); }
      g.restore(); return;
    }
    const pic = img("rig-w-bow"), pd = img("rig-w-bow-drawn");
    if (pic && pd) {   // the painted bow (riggear.js pictures): relaxed, cross-fading into the drawn one (arrow nocked) as you pull
      // held further in than the line drawing so the string and the nocked arrow stay in the picture
      const px = lerp(40, 96, up), py = lerp(H + 40, H - 76, up) + (gy - lerp(H + 24, H - 34, up)), pa = aim || fl ? Math.atan2(ty - py, tx - px) : -0.9;
      paintedBow(g, pic, pd, px, py, pa, draw, fl ? Math.max(0, 1 - st.arrow.t * 4) : 0, V.T);
      g.restore(); return;
    }
    const lim = 78, curl = 12 + draw * 16;
    const t1 = [gx + nx * lim - dx * curl, gy + ny * lim - dy * curl], t2 = [gx - nx * lim - dx * curl, gy - ny * lim - dy * curl];
    // limbs: dark wood with a lighter face
    for (const [c, w] of [["#1d130b", 8], ["#5a3d22", 5], ["#8a6238", 1.6]]) {
      g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(t1[0], t1[1]);
      g.bezierCurveTo(gx + nx * lim * 0.55 + dx * 10, gy + ny * lim * 0.55 + dy * 10, gx + nx * 14 + dx * 6, gy + ny * 14 + dy * 6, gx, gy);
      g.bezierCurveTo(gx - nx * 14 + dx * 6, gy - ny * 14 + dy * 6, gx - nx * lim * 0.55 + dx * 10, gy - ny * lim * 0.55 + dy * 10, t2[0], t2[1]); g.stroke();
    }
    // the string: pulled back to the nock, or quivering after the shot
    const pull = 6 + draw * 44, snap = fl ? Math.max(0, 1 - st.arrow.t * 4) : 0;
    const nk = [gx - dx * (pull + Math.sin(V.T * 90) * 5 * snap), gy - dy * (pull + Math.sin(V.T * 90) * 5 * snap)];
    g.strokeStyle = "rgba(232,224,204,.92)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(t1[0], t1[1]); g.lineTo(nk[0], nk[1]); g.lineTo(t2[0], t2[1]); g.stroke();
    // the arrow on the string
    if (aim) {
      const len = 92, hx = nk[0] + dx * len, hy = nk[1] + dy * len;
      g.strokeStyle = "#3a2a1a"; g.lineWidth = 2.6; g.beginPath(); g.moveTo(nk[0], nk[1]); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = "#9c7a4e"; g.lineWidth = 1; g.stroke();
      g.fillStyle = "#b9bcc0"; g.beginPath(); g.moveTo(hx + dx * 9, hy + dy * 9); g.lineTo(hx + nx * 3.2, hy + ny * 3.2); g.lineTo(hx - nx * 3.2, hy - ny * 3.2); g.closePath(); g.fill();
      g.fillStyle = "#c9c0a8"; for (const sg of [1, -1]) { g.beginPath(); g.moveTo(nk[0] + dx * 4, nk[1] + dy * 4); g.lineTo(nk[0] + dx * 16 + nx * 5 * sg, nk[1] + dy * 16 + ny * 5 * sg); g.lineTo(nk[0] + dx * 18, nk[1] + dy * 18); g.closePath(); g.fill(); }
    }
    // the glove on the grip
    g.fillStyle = "#3b2618"; g.beginPath(); g.ellipse(gx - dx * 2, gy - dy * 2, 9, 7, a, 0, 7); g.fill();
    g.fillStyle = "rgba(160,120,80,.35)"; g.beginPath(); g.ellipse(gx - dx * 4 - nx * 2, gy - dy * 4 - ny * 2, 4, 2.5, a, 0, 7); g.fill();
    g.restore();
  }
  /* where the aim ring sits (the sway included), drawn over the bow and unshaded by the night */
  function aimAt(st, A) {
    let tx = st.aim[0], ty = st.aim[1];
    const sw = A.swayAt(st.g, st.drawT * 1.7, st.drawT); return [tx + sw[0], ty + sw[1]];
  }
  /* BOWPIC in riggear.js: the riser sits at .68 (relaxed) / .69 (drawn) of the width, the drawn arrow at .48 of the height */
  const BOWH = 160, BR = { riser: 0.68, nock: 0.04 }, BD = { riser: 0.69, nock: 0.02, y: 0.48 };
  function paintedBow(g, pic, pd, gx, gy, a, draw, snap, T) {
    const rw = BOWH * (pic.naturalWidth || pic.width) / Math.max(1, pic.naturalHeight || pic.height);
    const dW = BOWH * (pd.naturalWidth || pd.width) / Math.max(1, pd.naturalHeight || pd.height);
    const t = clamp((draw - 0.12) / 0.45, 0, 1);   // half-drawn already shows the drawn bow
    g.translate(gx, gy); g.rotate(a); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 8; g.shadowOffsetY = 3;
    if (t < 1) {   // relaxed: its own string, bending back a little as you start to pull, quivering after the shot
      const sx = 1 + draw * 0.9 + Math.sin(T * 90) * 0.18 * snap;
      g.globalAlpha = 1 - t; g.save(); g.scale(sx, 1); g.drawImage(pic, -rw * BR.riser, -BOWH / 2, rw, BOWH); g.restore();
    }
    if (t > 0) {   // drawn: stretched from a half pull to the full one
      g.globalAlpha = t; g.save(); g.scale(lerp(0.6, 1, draw), 1); g.drawImage(pd, -dW * BD.riser, -BOWH * BD.y, dW, BOWH); g.restore();
    }
    g.globalAlpha = 1; g.shadowColor = "transparent";
  }
  /* a forgiving ring: bigger while your aim wanders, tighter when it settles */
  function reticle(g, st, A, x, y) {
    const G2 = st.g, s1 = A.swayAt(G2, st.drawT * 1.7, st.drawT), s2 = A.swayAt(G2, st.drawT * 1.7 + 0.2, st.drawT);
    const r = 8 + Math.min(14, Math.hypot(s1[0] - s2[0], s1[1] - s2[1]) * 2.2) + Math.max(0, st.drawT - 5) * 1.5;
    g.save(); g.lineCap = "round";
    for (const [c, w] of [["rgba(10,8,6,.65)", 3.4], ["rgba(244,236,214,.95)", 1.4]]) {
      g.strokeStyle = c; g.lineWidth = w;
      for (let k = 0; k < 4; k++) { const a0 = k * PI / 2 + 0.25; g.beginPath(); g.arc(x, y, r, a0, a0 + PI / 2 - 0.5); g.stroke(); }
      g.beginPath(); g.moveTo(x - r - 7, y); g.lineTo(x - r + 2, y); g.moveTo(x + r - 2, y); g.lineTo(x + r + 7, y); g.moveTo(x, y + r - 2); g.lineTo(x, y + r + 7); g.stroke();
    }
    g.fillStyle = "#e0442e"; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill();
    g.restore();
  }
  /* the arrow in a real arc: higher for a longer shot, shrinking as it goes, nose following the curve */
  function arcAt(st, k) {
    const a = st.arrow, d = st.g.dist, hgt = 18 + d * 0.55;
    const x = lerp(a.from[0], a.to[0], k), y = lerp(a.from[1], a.to[1], k) - hgt * 4 * k * (1 - k);
    return [x, y];
  }
  function shaft(g, x, y, ang, len, alpha, bolt, fat) {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    const ar = !bolt && img("rig-w-arrow");
    if (ar) {   // the painted arrow (tip at its right end), with the line drawing as the fallback
      const h = Math.max(fat ? 7 : 1.8, len * (ar.naturalHeight || ar.height) / Math.max(1, ar.naturalWidth || ar.width) * (fat ? 2.6 : 1.15));
      g.save(); g.globalAlpha = alpha; g.translate(x, y); g.rotate(ang); g.imageSmoothingEnabled = true;
      if (fat) { g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 3; g.shadowOffsetY = 1; }   // a soft edge so it reads on dark fur and in fog
      g.drawImage(ar, -len, -h / 2, len, h); g.restore();
      return;
    }
    g.save(); g.globalAlpha = alpha; g.lineCap = "round";
    g.strokeStyle = "#2c2016"; g.lineWidth = Math.max(fat ? 1.6 : 1, len * 0.07); g.beginPath(); g.moveTo(x - dx * len, y - dy * len); g.lineTo(x, y); g.stroke();
    g.fillStyle = bolt ? "#5a5148" : "#d7ceb8"; const f = len * (fat ? 0.3 : 0.22), b0 = [x - dx * len, y - dy * len];
    for (const sg of [1, -1]) { g.beginPath(); g.moveTo(b0[0] + dx * f * 0.2, b0[1] + dy * f * 0.2); g.lineTo(b0[0] + dx * f + nx * f * 0.35 * sg, b0[1] + dy * f + ny * f * 0.35 * sg); g.lineTo(b0[0] + dx * f * 1.2, b0[1] + dy * f * 1.2); g.closePath(); g.fill(); }
    g.restore();
  }
  function flyingArrow(g, st, A) {
    const k = clamp(st.arrow.t, 0, 1), [x, y] = arcAt(st, k), [x2, y2] = arcAt(st, Math.min(1, k + 0.02));
    const len = lerp(40, Math.max(6, A.box(st.g).rx * 0.45), Math.pow(k, 0.7));
    // a faint streak along the path just flown
    g.save(); g.strokeStyle = "rgba(240,232,210,.28)"; g.lineWidth = 1; g.beginPath();
    for (let j = 0; j <= 6; j++) { const p = arcAt(st, Math.max(0, k - 0.18 + j * 0.03)); j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
    g.stroke(); g.restore();
    shaft(g, x, y, Math.atan2(y2 - y, x2 - x), len, 1, st.g.kind === "bolt");
  }
  /* how long the stuck arrow looks: about half the animal's body, so you can see it (and its fletching) */
  const stuckLen = (b) => Math.max(26, b.rx * 1.2);
  function stuckArrow(g, x, y, len, alpha, kind) {
    // it came down out of its arc from your side: tip buried a little in the hide, shaft and feathers up and back towards you
    const ang = 1.0, dx = Math.cos(ang), dy = Math.sin(ang);
    shaft(g, x + dx * len * 0.12, y + dy * len * 0.12, ang, len, alpha, kind === "bolt", true);
  }
  function missArrow(g, st, V, b) {
    const s = st.shot, t = V.phT;
    if (s.y > A_HORIZON + 6) {   // in the grass: stuck at a slant, a little dirt
      if (!V.dirt) { V.dirt = true; puff(V, s.x, s.y, 10, "#a8946c", 6); }
      shaft(g, s.x, s.y, -2.5, Math.max(6, b.rx * 0.4), 1, st.g.kind === "bolt");
    } else if (t < 0.35) {   // over its back: it sails on into the trees
      const a = st.arrow, ang = Math.atan2(a.to[1] - a.from[1], a.to[0] - a.from[0]);
      shaft(g, s.x + Math.cos(ang) * t * 120, s.y + Math.sin(ang) * t * 60 + t * t * 80, ang + t, Math.max(4, b.rx * 0.4) * (1 - t), 1 - t / 0.35, st.g.kind === "bolt");
    }
  }
  const A_HORIZON = 150;

  // ---------------------------------------------------------------- particles: blood, fur, dust
  function burst(V, shot, hit, gore, b) {
    const r = V.rnd;
    if (hit === "miss") return;
    const groundY = b.by + b.ry * 2.4;
    for (let i = 0; i < 8; i++) V.parts.push({ x: shot.x, y: shot.y, vx: (r() - 0.3) * 50, vy: -20 - r() * 30, g: 30, life: 0.7 + r() * 0.4, t: 0, r: 0.8 + r() * 1.2, c: "#d8c7a4", fur: true });
    if (gore === "off") return;
    const n = gore === "full" ? 14 : 4, sz = clamp(b.rx / 30, 0.35, 1.4), dir = -st_dirOf(shot, b);
    for (let i = 0; i < n; i++) V.parts.push({ x: shot.x, y: shot.y, vx: (dir * 0.6 + (r() - 0.5)) * (gore === "full" ? 90 : 40) * sz, vy: (-25 - r() * (gore === "full" ? 55 : 25)) * sz, g: 240 * sz, life: 1.2, t: 0, r: (gore === "full" ? 0.5 + r() * 1.1 : 0.5 + r() * 0.4) * sz, c: gore === "full" ? (i % 3 ? "#5e0606" : "#7a0a08") : "#3a120e", blood: true, gy: groundY - r() * 5 * sz, land: gore === "full", sz });
    if (gore === "full") V.parts.push({ x: shot.x, y: shot.y, vx: 0, vy: 0, g: 0, life: 0.4, t: 0, r: b.rx * 0.22, c: "rgba(110,8,8,.22)", mist: true });
  }
  const st_dirOf = (shot, b) => (shot.x < b.bx ? -1 : 1);   // drops fly out the far side of the wound
  function puff(V, x, y, w, c, n) {
    const r = V.rnd;
    for (let i = 0; i < n; i++) V.parts.push({ x: x + (r() - 0.5) * w, y: y - r() * 3, vx: (r() - 0.5) * 20, vy: -6 - r() * 10, g: -4, life: 0.7 + r() * 0.5, t: 0, r: 2 + r() * w * 0.08, c, dust: true });
  }
  function drip(V, x, y, gore) {
    const r = V.rnd;
    V.splats.push({ x: x + (r() - 0.5) * 6, y: y - 1, r: gore === "full" ? 0.7 + r() * 0.6 : 0.5, c: gore === "full" ? "rgba(70,6,6,.7)" : "rgba(50,20,14,.6)" });
  }
  function stepParts(g, V, dt) {
    const keep = [];
    for (const p of V.parts) {
      p.t += dt; if (p.t > p.life) continue;
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.blood && p.gy && p.y >= p.gy) { if (p.land && V.splats.length < 60) V.splats.push({ x: p.x, y: p.gy, r: p.r * 0.9, c: "rgba(62,6,6,.7)", rot: (p.x * 13) % 1 - 0.5 }); continue; }
      const k = 1 - p.t / p.life;
      if (p.dust) {   // a low, soft puff that thins out (no hard circles)
        const rr = p.r * (1 + p.t * 1.6), gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
        gr.addColorStop(0, p.c); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.globalAlpha = k * 0.22; g.fillStyle = gr; g.save(); g.translate(p.x, p.y); g.scale(1.6, 0.6); g.translate(-p.x, -p.y); g.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2); g.restore();
        keep.push(p); continue;
      }
      g.globalAlpha = p.mist ? k : Math.min(1, k * 1.5);
      g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.mist ? p.r * (1 + p.t * 3) : p.r, 0, 7); g.fill();
      keep.push(p);
    }
    g.globalAlpha = 1; V.parts = keep;
  }
  function drawSplats(g, V) {
    for (const s of V.splats) { g.fillStyle = s.c; g.beginPath(); g.ellipse(s.x, s.y, s.r * 1.3, s.r * 0.45, (s.rot || 0) * 0.3, 0, 7); g.fill(); }
  }

  // ---------------------------------------------------------------- skinning: the hide on a pole frame
  const FLAPS = [[0, 0.3, 0.2], [PI, 0.26, 0.22], [0.72, 0.4, 0.15], [PI - 0.72, 0.4, 0.15], [-0.72, 0.4, 0.15], [-(PI - 0.72), 0.4, 0.15]];
  function hidePts(cx, cy, w, h, tail) {
    const pts = [];
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * 2 * PI; let r = 0.82;
      for (const [fa, amp, wid] of FLAPS) { const d = Math.abs(((a - fa + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI); r += (fa === PI ? amp * tail : amp) * Math.exp(-((d / wid) ** 2)); }
      r *= 1 + 0.025 * Math.sin(a * 9 + 1);
      pts.push([cx + Math.cos(a) * w * r, cy + Math.sin(a) * h * r]);
    }
    return pts;
  }
  function smooth(g, pts) {
    g.beginPath();
    const n = pts.length, mid = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
    const m0 = mid(0); g.moveTo(m0[0], m0[1]);
    for (let i = 1; i <= n; i++) { const m = mid(i); g.quadraticCurveTo(pts[i % n][0], pts[i % n][1], m[0], m[1]); }
    g.closePath();
  }
  function skinView(g, st, V, W, H, t, P, A) {
    if (t <= 0) return;
    const a = A.ANIMALS[st.g.id] || {}, res = st.res || {}, pelt = a.pelt, got = res.got || {};
    const fade = ease(t / 0.5);
    g.save(); g.globalAlpha = fade; g.fillStyle = "rgba(14,11,8,.72)"; g.fillRect(0, 0, W, H);
    const warm = g.createRadialGradient(W / 2, H * 0.55, 20, W / 2, H * 0.55, W * 0.55); warm.addColorStop(0, "rgba(120,80,40,.22)"); warm.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = warm; g.fillRect(0, 0, W, H);
    if (!pelt) { g.restore(); return; }   // nothing to stretch (a horker): the loot list says what you got
    const size = a.size || 1, hw = clamp(50 + 75 * size, 80, 130), hh = hw * (st.g.id === "fox" || st.g.id === "snowfox" ? 0.55 : 0.68);
    const cx = W / 2, cy = H / 2 + 6, open = ease((t - 0.1) / 0.6), whole = !!got[pelt[0]];
    const tail = st.g.id === "fox" || st.g.id === "snowfox" ? 2.2 : st.g.id === "hare" ? 0.4 : 0.6;
    // the frame: four poles lashed at the corners
    const fx = hw * 1.42 + 6, fy = hh * 1.42 + 8;
    g.lineCap = "round";
    for (const [x0, y0, x1, y1] of [[cx - fx, cy - fy - 8, cx - fx, cy + fy + 8], [cx + fx, cy - fy - 8, cx + fx, cy + fy + 8], [cx - fx - 10, cy - fy, cx + fx + 10, cy - fy], [cx - fx - 10, cy + fy, cx + fx + 10, cy + fy]]) {
      g.strokeStyle = "#20160d"; g.lineWidth = 9; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = "#6b4c2e"; g.lineWidth = 6; g.stroke(); g.strokeStyle = "rgba(170,130,85,.5)"; g.lineWidth = 1.5; g.stroke();
    }
    g.strokeStyle = "#cdb88c"; g.lineWidth = 1.4;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = cx + sx * fx, y = cy + sy * fy; g.beginPath(); g.moveTo(x - 6, y - 6); g.lineTo(x + 6, y + 6); g.moveTo(x + 6, y - 6); g.lineTo(x - 6, y + 6); g.stroke(); }
    // the hide, unrolling onto the frame
    g.save(); g.translate(cx, cy); g.rotate(Math.sin(V.T * 0.9) * 0.008); g.scale(1, 0.15 + 0.85 * open); g.translate(-cx, -cy);
    const pts = hidePts(cx, cy, hw, hh, tail);
    // cords from each flap to the frame
    if (open > 0.6) {
      g.strokeStyle = `rgba(205,184,140,${(open - 0.6) / 0.4})`; g.lineWidth = 1;
      for (const [fa] of FLAPS) {
        let best = null, bd = -1; for (const p of pts) { const d = (p[0] - cx) * Math.cos(fa) / hw + (p[1] - cy) * Math.sin(fa) / hh; if (d > bd) { bd = d; best = p; } }
        const ex = Math.abs(Math.cos(fa)) > 0.9 ? cx + Math.sign(Math.cos(fa)) * fx : best[0] + Math.cos(fa) * 18, ey = Math.abs(Math.cos(fa)) > 0.9 ? best[1] : cy + Math.sign(Math.sin(fa)) * fy;
        g.beginPath(); g.moveTo(best[0], best[1]); g.lineTo(ex, ey); g.stroke();
      }
    }
    g.save(); smooth(g, pts); g.clip();
    if (P) {   // fur cut from the painting: the back in the middle, flanks out to both edges
      const R = P.R, sx = R.c[0] - R.hw * 0.7, sw = R.hw * 1.4, top = R.c[1] - R.hw * 0.26, bh = R.hw * 0.5;
      g.drawImage(P.full, sx, top, sw, bh, cx - hw * 1.4, cy, hw * 2.8, hh * 1.45);
      g.save(); g.translate(0, cy * 2); g.scale(1, -1); g.drawImage(P.full, sx, top, sw, bh, cx - hw * 1.4, cy, hw * 2.8, hh * 1.45); g.restore();
    } else {
      g.fillStyle = a.col || "#8a6a48"; g.fillRect(cx - hw * 1.5, cy - hh * 1.5, hw * 3, hh * 3);
      g.lineWidth = 0.8; for (let k = 0; k < 260; k++) {   // short fur strokes, combed out from the spine
        const u = hash01(k * 1.7), v = hash01(k * 3.3 + 1), x = cx + (u - 0.5) * hw * 2.6, y = cy + (v - 0.5) * hh * 2.6, dy = y > cy ? 1 : -1;
        g.strokeStyle = k % 2 ? "rgba(35,29,23,.16)" : "rgba(255,250,235,.14)"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y + dy * 5); g.stroke(); }
    }
    const sp = g.createLinearGradient(0, cy - hh * 0.3, 0, cy + hh * 0.3);   // the darker line along the spine
    sp.addColorStop(0, "rgba(40,22,10,0)"); sp.addColorStop(0.5, "rgba(40,22,10,.38)"); sp.addColorStop(1, "rgba(40,22,10,0)");
    g.fillStyle = sp; g.fillRect(cx - hw * 1.5, cy - hh * 0.3, hw * 3, hh * 0.6);
    const sh = g.createRadialGradient(cx, cy, hw * 0.2, cx, cy, hw * 1.3); sh.addColorStop(0, "rgba(255,240,210,.08)"); sh.addColorStop(1, "rgba(30,15,5,.55)");
    g.fillStyle = sh; g.fillRect(cx - hw * 1.6, cy - hh * 1.6, hw * 3.2, hh * 3.2);
    if (!whole) {   // torn: it didn't come off whole
      g.globalAlpha = 1; g.fillStyle = "rgba(14,11,8,.9)";
      for (const [ox, oy, r] of [[-0.35, -0.2, 0.16], [0.3, 0.25, 0.12], [0.05, -0.05, 0.08]]) { g.beginPath(); g.ellipse(cx + ox * hw, cy + oy * hh, r * hw, r * hh * 0.6, 0.6, 0, 7); g.fill(); }
    }
    g.restore();
    smooth(g, pts); g.strokeStyle = "rgba(225,205,170,.55)"; g.lineWidth = 1.6; g.stroke();
    g.restore();
    // the knife runs round the edge
    const kt = (t - 0.5) / 1.1;
    if (kt > 0 && kt < 1) {
      const i = Math.floor(kt * pts.length * 0.999), p = pts[i], q = pts[(i + 2) % pts.length];
      const py = cy + (p[1] - cy) * (0.15 + 0.85 * open), qy = cy + (q[1] - cy) * (0.15 + 0.85 * open), ang = Math.atan2(qy - py, q[0] - p[0]);
      g.save(); g.translate(p[0], py); g.rotate(ang - 0.5);
      g.fillStyle = "#3a2516"; g.fillRect(-26, -3, 16, 6);
      const bl = g.createLinearGradient(-10, -4, 14, 4); bl.addColorStop(0, "#9aa0a6"); bl.addColorStop(0.5, "#eef2f4"); bl.addColorStop(1, "#7d848b");
      g.fillStyle = bl; g.beginPath(); g.moveTo(-10, -3.5); g.lineTo(12, -1); g.quadraticCurveTo(16, 1, 12, 3); g.lineTo(-10, 3); g.closePath(); g.fill();
      g.globalAlpha = Math.abs(Math.sin(t * 9)); g.fillStyle = "#fff"; g.beginPath(); g.arc(8, -1, 1.6, 0, 7); g.fill();
      g.restore();
    }
    g.restore();
  }

  return { RIG, MAP, draw, rigFor, ready: () => !!bgLayers() };
})();
if (typeof module !== "undefined") module.exports = HUNTART;
