/* DOLLFRONT: your hero standing face-on, the way the Items / Pack paper doll, the race showcase, the Hero page and
   the loadout previews show it, with a calm idle on the Pack tab. [OURS] [dollrig2]

   Built from the painted pictures we have:
     body    the painted fight rig's parts (rig-<who>-<set>-*.webp, rigdata.js), stood up front-on: the hips, thighs and
             shins are front-ish already; the breastplate is the front half of the side-view torso, mirrored about the
             breastbone; arms, hands and boots are the side pictures turned and mirrored onto each side
     head    the painted race bust (bust-<race>.webp, 3/4 view) of your portrait (AVATAR.of: your race and sex, or the
             nearest painted one), cut out above the collar; a worn helmet is drawn over it
     gear    the painted weapons and shields (rig-w-*.webp), placed by their grip (gripdata.js): scale, turn the grip
             axis to the pose's angle, then move the grip onto the fist. Gear with no picture uses RIGGEAR's drawings.
   Until every picture it needs has loaded (or outside a browser) ok() is false and the ink front figure is drawn.

   The pose (hero's right hand = the viewer's left):
     one-hand weapon   hangs at the side in the right hand, the head / blade BELOW the fist, pointing down and a little
                       out (PRESET angle); shortened just enough that it never goes through the floor
     two-hander        resting point-down in front of the body, both hands on the grip (the right on secondaryGrip)
     staff, spear      upright, planted beside the right foot, the right hand round the haft at chest height
     bow / crossbow    the bow in the LEFT hand at the side; a crossbow hangs from the right hand
     shield            on the left forearm, IN FRONT of the body, covering about a third of the torso, tilted a little
   Layers, back to front: cape and tail, legs, torso, hips, head, left arm, shield, right arm, weapon, fists (a fist
   always covers the grip it holds).

   Idle (Pack tab only, mount()): each layer is its own canvas made once; CSS moves them (no repaint per frame):
   a 3 s breath (chest swells, shoulders, head and arms rise), a slow weight shift, the cape and tail lagging behind,
   and every 9 s the weapon hand settles its grip. Off under prefers-reduced-motion, paused when not on screen.

     DOLLFRONT.ok(look, src)           → its pictures are ready
     DOLLFRONT.paint(g, look, w, h, src) → draws the still figure into a w×h box (true when it drew)
     DOLLFRONT.html(look, w, h, src)   → the live figure for the Pack tab (a still <img> until mounted)
     DOLLFRONT.probe(look, w, h, src)  → the numbers the screen test checks (grips, angles, shield cover, clipping)
     DOLLFRONT.PRESET, HOLD            → each weapon class's angle (degrees, 0 = right, 90 = straight down) and hold */
const DOLLFRONT = (() => {
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const RIG = () => (typeof PAINTRIG !== "undefined" && typeof RIGDATA !== "undefined" && !PAINTRIG.broken ? PAINTRIG : null);
  const GEAR = () => (typeof RIGGEAR !== "undefined" ? RIGGEAR : null);
  const live = () => typeof document !== "undefined";
  const WSC = 1.18;   // the fight rig's weapon scale
  const PRESET = { sword: 106, dagger: 110, axe: 104, mace: 104, club: 104, crossbow: 98, greatsword: 90, battleaxe: 90, warhammer: 90, staff: -90, spear: -90, bow: -84 };
  const HOLD = { greatsword: "rest", battleaxe: "rest", warhammer: "rest", staff: "plant", spear: "plant", bow: "bow" };
  const holdOf = (wk) => (!wk || wk === "fist" ? "none" : HOLD[wk] || "hang");
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const dims = (p) => [p.naturalWidth || p.width, p.naturalHeight || p.height];

  // ---------------------------------------------------------------- the look
  const lookOf = (src) => (src?.look ? src.look : src?.loadouts && typeof HEROART !== "undefined" ? HEROART.lookOf(src) : src?.eq && src?.r ? src : { r: src?.race || "nord", id: src?.id || "x", eq: {}, gl: {}, sx: src?.sex === "f" ? "f" : undefined });
  const specOf = (L) => { try { return FIGART.specOf(FIGART.lookFor({ look: L })); } catch { return null; } };
  /* which painted bust is the face: your chosen portrait, else your race and sex, else the nearest painted one */
  function bustOf(L, src) {
    try { if (typeof AVATAR !== "undefined") return AVATAR.of({ look: L, race: L.r, avatar: src && src.avatar }); } catch { /* the race */ }
    return L.r || "nord";
  }

  // ---------------------------------------------------------------- picture helpers
  /* a picture halved until it is about the size it is drawn (never shimmers when small) */
  const MIPS = new WeakMap();
  function mip(img, need) {
    let L = MIPS.get(img); if (!L) { L = [img]; MIPS.set(img, L); }
    for (let i = 0; ; i++) {
      const s = L[i], [w, h] = dims(s);
      if (w / 2 < need * 1.3 || w < 24) return s;
      if (!L[i + 1]) { const c = mk(w / 2, h / 2), x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(s, 0, 0, c.width, c.height); L[i + 1] = c; }
    }
  }
  const devScale = (g) => { try { const t = g.getTransform(); return Math.hypot(t.a, t.b) || 1; } catch { return 1; } };
  /* bare hands and skin in the race's colour (the Nord pictures are the base) */
  const TINT = new Map();
  function tinted(img, c, key) {
    if (!c) return img;
    const id = key + "|" + c; if (TINT.has(id)) return TINT.get(id);
    const [w, h] = dims(img), cv = mk(w, h), x = cv.getContext("2d");
    x.drawImage(img, 0, 0); x.globalCompositeOperation = "color"; x.globalAlpha = 0.38; x.fillStyle = c; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = "destination-in"; x.globalAlpha = 1; x.drawImage(img, 0, 0);
    if (TINT.size > 80) TINT.delete(TINT.keys().next().value);
    TINT.set(id, cv); return cv;
  }
  /* a rig part with its joint p at (x, y), its p→e line turned to angle a (or upright when a is null); flip mirrors it */
  function part(g, img, q, u, x, y, a, flip, sx = 1, crop) {
    const nat = q.e ? Math.atan2(q.e[1] - q.p[1], q.e[0] - q.p[0]) : 0, rot = a == null ? 0 : flip ? a - (Math.PI - nat) : a - nat;
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale(flip ? -sx : sx, 1);
    const src = mip(img, q.w * u * devScale(g)), [iw, ih] = dims(src), fx = iw / q.w, fy = ih / q.h;
    if (crop) g.drawImage(src, crop[0] * fx, crop[1] * fy, (crop[2] - crop[0]) * fx, (crop[3] - crop[1]) * fy, (crop[0] - q.p[0]) * u, (crop[1] - q.p[1]) * u, (crop[2] - crop[0]) * u, (crop[3] - crop[1]) * u);
    else g.drawImage(src, -q.p[0] * u, -q.p[1] * u, q.w * u, q.h * u);
    g.restore();
  }
  /* the bust cut out above the collar (cached per bust): the head and neck, the tunic faded away */
  const BUSTS = new Map();
  const BUSTFIT = { def: { nx: 0.555, ny: 0.66, hh: 0.56 }, khajiit: { nx: 0.57, ny: 0.66, hh: 0.6 }, argonian: { nx: 0.6, ny: 0.68, hh: 0.6 } };
  function bustHead(id) {
    if (BUSTS.has(id)) return BUSTS.get(id);
    const im = typeof ASSETS !== "undefined" ? ASSETS.img("bust-" + id) : null; if (!im) return null;
    const [w, h] = dims(im), c = mk(w, h), x = c.getContext("2d"), F = BUSTFIT[id] || BUSTFIT.def;
    x.drawImage(im, 0, 0);
    const m = mk(w, h), y = m.getContext("2d");
    const top = y.createLinearGradient(0, h * 0.56, 0, h * 0.66); top.addColorStop(0, "#000"); top.addColorStop(1, "rgba(0,0,0,0)");
    y.fillStyle = top; y.fillRect(0, 0, w, h * 0.66);
    y.fillStyle = "#000"; y.fillRect(0, 0, w, h * 0.56);
    const nk = y.createLinearGradient(0, h * 0.6, 0, h * 0.76); nk.addColorStop(0, "#000"); nk.addColorStop(1, "rgba(0,0,0,0)");
    y.fillStyle = nk; y.beginPath(); y.ellipse(w * F.nx, h * 0.62, w * 0.12, h * 0.15, 0, 0, TAU); y.fill();
    x.globalCompositeOperation = "destination-in"; x.drawImage(m, 0, 0);
    const out = { img: c, F, w, h }; BUSTS.set(id, out); return out;
  }

  // ---------------------------------------------------------------- weapons and shields as pictures with a grip
  /* { img, meta: {grip, axis, secondaryGrip}, len (units along the axis for the whole picture), key } */
  function weaponPic(sp, wk, m) {
    const gear = GEAR(); if (!gear || !wk || wk === "fist") return null;
    const GD = typeof GRIPDATA !== "undefined" ? GRIPDATA : null;
    if (wk === "bow") {
      const pic = gear.sprite("bow"); if (pic && GD) { const meta = GD.of("bow", pic); if (meta) return { img: pic, meta, len: gear.BOW_H * m * WSC, key: "bow" }; }
    } else {
      let P = null; try { P = gear.picFor(sp, wk, gear.metalOf(sp, false)); } catch { P = null; }
      if (P && GD) { const meta = GD.of(P.key, P.pic); if (meta && meta.grip) return { img: P.pic, meta, len: gear.SPAN[wk] * m * WSC, key: P.key }; }
    }
    return drawnPic(sp, wk, m);
  }
  /* gear with no painted picture: RIGGEAR's (or the ink kit's) drawing, laid along +x with the grip at a known point */
  const DRAWN = new Map();
  function drawnPic(sp, wk, m) {
    const gear = GEAR(), FK = typeof FIGART !== "undefined" ? FIGART.kit : null; if (!gear && !FK) return null;
    const key = wk + "|" + (sp.wkey || "") + "|" + (sp.ench || ""); let d = DRAWN.get(key);
    if (!d) {
      const tip = (gear && gear.TIP[wk]) || (FK && FK.TIP && FK.TIP[wk]) || (wk === "bow" ? [0, -1] : [1, 0]), ta = Math.atan2(tip[1], tip[0]);
      const span = wk === "bow" ? gear.BOW_H : (gear && gear.SPAN[wk]) || 32, s = 10, W = (span * 1.25 + 12) * s * 2, H = 30 * s;
      const c = mk(W, H), g = c.getContext("2d");
      g.translate(W / 2, H / 2); g.scale(s, s); if (wk !== "bow") g.rotate(-ta);
      const st = FK && FK.styleOf ? FK.styleOf(1) : null;   // the ink style (line colour and width) the kit draws with
      try { (gear || FK).weapon(g, sp, wk, st, {}); } catch { /* nothing to draw */ }
      // trimmed to what was drawn (keeping the grip inside), so the far edge along the axis is the real tip
      let x0 = W / 2, x1 = W / 2, y0 = H / 2, y1 = H / 2;
      try {
        const px = g.getImageData(0, 0, W, H).data;
        for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (px[(y * W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      } catch { x0 = 0; x1 = W - 1; y0 = 0; y1 = H - 1; }
      const cw = Math.max(2, x1 - x0 + 2), ch = Math.max(2, y1 - y0 + 2), t = mk(cw, ch); t.getContext("2d").drawImage(c, -x0, -y0);
      const gx = (W / 2 - x0) / cw, gy = (H / 2 - y0) / ch;
      d = { img: t, meta: wk === "bow" ? { grip: [gx, gy], axis: [0, -1] } : { grip: [gx, gy], axis: [1, 0], secondaryGrip: [gx - 3.6 * s / cw, gy] }, unit: cw / s, key: "drawn-" + wk };
      DRAWN.set(key, d);
    }
    return { img: d.img, meta: d.meta, len: d.unit * m * WSC, key: d.key, perPx: true };
  }
  /* a shield drawn front-on, its strap at the middle */
  const SHIELDS = new Map();
  function shieldPic(sp) {
    const gear = GEAR(); if (!gear || !sp.shield) return null;
    const key = JSON.stringify([sp.shield.k, sp.shield.kite, sp.shield.set && sp.shield.set.c]) + "|" + (gear.sprite(sp.shield.kite ? "shield-kite" : "shield") ? "p" : "d");
    let d = SHIELDS.get(key);
    if (!d) {
      const s = 24, W = 20 * s, H = 26 * s, c = mk(W, H), g = c.getContext("2d");
      g.translate(W / 2 - 1.2 * s * 1.12, H / 2 + 1 * s * 1.08); g.scale(s, s);
      // RIGGEAR adds a drop shadow sized for a fight; here it would smear the whole shield, so it is switched off
      for (const k of ["shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY"]) Object.defineProperty(g, k, { get: () => (k === "shadowColor" ? "rgba(0,0,0,0)" : 0), set: () => {} });
      try { gear.shield(g, sp, true, null); } catch { /* nothing */ }
      d = { img: c, meta: { shieldGrip: [0.5, 0.5] }, unit: W / s };
      SHIELDS.set(key, d);
    }
    return d;
  }
  /* put a gripped picture: scale, turn its axis to angle th, move its grip onto (x, y); returns where its points went */
  function placeGrip(P, x, y, th, scl = 1) {
    const [iw, ih] = dims(P.img), sc = (P.len * scl) / (P.perPx ? iw : Math.abs(P.meta.axis[0]) > 0.5 ? iw : ih);
    const ax = Math.atan2(P.meta.axis[1] * ih, P.meta.axis[0] * iw), rot = th - ax;
    const at = (f) => { const dx = (f[0] - P.meta.grip[0]) * iw * sc, dy = (f[1] - P.meta.grip[1]) * ih * sc; return [x + Math.cos(rot) * dx - Math.sin(rot) * dy, y + Math.sin(rot) * dx + Math.cos(rot) * dy]; };
    // the far end of the picture along its axis (the tip / head)
    const g0 = P.meta.grip, a = P.meta.axis, far = [clamp(g0[0] + a[0] * 2, 0, 1) * (a[0] ? 1 : 0) + (a[0] ? 0 : g0[0]), a[1] ? (a[1] < 0 ? 0 : 1) : g0[1]];
    const tipF = a[0] ? [a[0] > 0 ? 1 : 0, g0[1]] : far;
    return { sc, rot, grip: [x, y], tip: at(tipF), sec: P.meta.secondaryGrip ? at(P.meta.secondaryGrip) : null, at, draw: (g) => { g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc); g.drawImage(mip(P.img, iw * devScale(g)), -g0[0] * iw, -g0[1] * ih, iw, ih); g.restore(); } };
  }

  // ---------------------------------------------------------------- the pose
  /* two-bone arm from the shoulder S to the wrist T, the elbow bent outward (away from the body's middle) */
  function ik(S, T, l1, l2, out) {
    let dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy); const mx = (l1 + l2) * 0.999;
    if (d > mx) { T = [S[0] + dx / d * mx, S[1] + dy / d * mx]; dx = T[0] - S[0]; dy = T[1] - S[1]; d = mx; }
    const a = Math.atan2(dy, dx), c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), b = Math.acos(c);
    const e1 = [S[0] + Math.cos(a + b) * l1, S[1] + Math.sin(a + b) * l1], e2 = [S[0] + Math.cos(a - b) * l1, S[1] + Math.sin(a - b) * l1];
    return { S, E: out * e1[0] > out * e2[0] ? e1 : e2, W: T };
  }
  const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  /* everything about one look: which set, the joints (units, feet at 0,0, y down), the gear pictures, how each hand holds */
  function rigOf(L, src) {
    const R = RIG(), sp = specOf(L); if (!R || !sp || !live()) return null;
    const set = R.setOf(sp, L), r = R.ready(set); if (!r) return null;
    const bust = bustHead(bustOf(L, src)); if (!bust) return null;
    const G = R.geo(set), Q = RIGDATA.SETS[set].parts, u = G.u, m = G.m, H = G.height;
    const wk = sp.wk && sp.wk !== "fist" ? sp.wk : null, hold = holdOf(wk);
    const fistQ = Q["hand-fist"], glen = Math.hypot(fistQ.e[0] - fistQ.p[0], fistQ.e[1] - fistQ.p[1]) * u * 0.55;
    // the legs and hips
    const hx = Q.pelvis.w * u * 0.15, hipY = G.hipY, ankY = -G.ankleH, ax = hx * 1.18;
    const W = [0, hipY + G.waist[1]];
    const c = Q.torso.n[0], half = (Q.torso.w - c) * u * 1.12;   // half the chest's width: the front half of the side view
    const N = [0, W[1] + G.nk[1]], shY = W[1] + G.sh[1] * 0.92, S = { r: [-half * 0.9, shY], l: [half * 0.9, shY] };
    const legs = ["r", "l"].map((s) => { const k = s === "r" ? -1 : 1, Hp = [k * hx, hipY], A = [k * ax, ankY], f = G.thigh / (G.thigh + G.shin); return { s, H: Hp, K: [Hp[0] + (A[0] - Hp[0]) * f, Hp[1] + (A[1] - Hp[1]) * f], A }; });
    const arm = { r: null, l: null }, hand = { r: { part: "hand-open", a: 96 * DEG }, l: { part: "hand-open", a: 84 * DEG } };
    const hang = (s, outDeg) => { const k = s === "r" ? -1 : 1, a = (90 - k * outDeg) * DEG, l = G.upper + G.fore; return ik(S[s], [S[s][0] + Math.cos(a) * l * 0.985, S[s][1] + Math.sin(a) * l * 0.985], G.upper, G.fore, k); };
    const wristFor = (grip, ha) => [grip[0] - Math.cos(ha) * glen, grip[1] - Math.sin(ha) * glen];
    let weapon = null, P = wk ? weaponPic(sp, wk, m) : null, scl = 1;
    const th = wk ? (PRESET[wk] != null ? PRESET[wk] : 104) * DEG : 0;
    if (hold === "hang" && P) {   // hanging at the right side, head / blade below the fist
      arm.r = hang("r", 7); const fa = ang(arm.r.E, arm.r.W), ha = th - 32 * DEG;
      hand.r = { part: "hand-fist", a: ha, grip: true };
      const gp = [arm.r.W[0] + Math.cos(ha) * glen, arm.r.W[1] + Math.sin(ha) * glen];
      let pl = placeGrip(P, gp[0], gp[1], th, 1);
      const floor = -H * 0.035; if (pl.tip[1] > floor) { scl = clamp((floor - gp[1]) / (pl.tip[1] - gp[1]), 0.45, 1); pl = placeGrip(P, gp[0], gp[1], th, scl); }
      weapon = { P, pl, th, hands: ["r"] }; void fa;
    } else if (hold === "rest" && P) {   // point-down in front, both hands on the grip
      let pl = placeGrip(P, 0, 0, th, 1); const tipD = pl.tip[1];   // grip→tip distance (straight down)
      const want = shY + (G.upper + G.fore) * 0.72; scl = clamp(-want / tipD, 0.5, 1);   // the hands low, near the belt, arms nearly straight
      const gy = -tipD * scl - H * 0.005; pl = placeGrip(P, 0, gy, th, scl);
      const sec = pl.sec || [0, gy - glen * 1.6];
      hand.r = { part: "hand-fist", a: 0, grip: true, at: sec }; hand.l = { part: "hand-fist", a: Math.PI, grip: true, at: pl.grip };
      arm.r = ik(S.r, wristFor(sec, 0), G.upper, G.fore, -1); arm.l = ik(S.l, wristFor(pl.grip, Math.PI), G.upper, G.fore, 1);
      weapon = { P, pl, th, hands: ["r", "l"] };
    } else if (hold === "plant" && P) {   // upright beside the right foot, the right hand round the haft at chest height
      const bx = -ax - H * 0.06, gy = W[1] - (W[1] - shY) * 0.15;
      let pl = placeGrip(P, bx, 0, th, 1); const bd = -pl.at([P.meta.axis[0] ? 0 : P.meta.grip[0], P.meta.axis[0] ? P.meta.grip[1] : 1])[1];   // grip→butt distance
      void bd;
      const butt0 = P.meta.axis[0] ? [P.meta.axis[0] > 0 ? 0 : 1, P.meta.grip[1]] : [P.meta.grip[0], P.meta.axis[1] < 0 ? 1 : 0];
      pl = placeGrip(P, bx, gy, th, 1);
      const b = pl.at(butt0); pl = placeGrip(P, bx, gy - b[1] - H * 0.005, th, 1);   // the butt on the ground
      // the hand slides along the haft to chest height: the haft is straight up, so the fist anchor is on it at gy
      const ha = 0; hand.r = { part: "hand-fist", a: ha, grip: true, at: [bx, gy] };
      arm.r = ik(S.r, wristFor([bx, gy], Math.PI), G.upper, G.fore, -1); hand.r.a = Math.PI;
      weapon = { P, pl, th, hands: ["r"], slide: true };
    } else if (hold === "bow" && P) {   // the bow in the left hand at the side
      arm.l = hang("l", 9); const ha = (90 + 30) * DEG;
      hand.l = { part: "hand-fist", a: ha, grip: true };
      const gp = [arm.l.W[0] + Math.cos(ha) * glen, arm.l.W[1] + Math.sin(ha) * glen];
      let pl = placeGrip(P, gp[0], gp[1], th, 1);
      const lowEnd = pl.at([P.meta.grip[0], 1]); if (lowEnd[1] > -H * 0.02) { scl = clamp((-H * 0.02 - gp[1]) / (lowEnd[1] - gp[1]), 0.5, 1); pl = placeGrip(P, gp[0], gp[1], th, scl); }
      weapon = { P, pl, th, hands: ["l"] };
    }
    if (!arm.r) arm.r = hang("r", 6);
    // the shield on the left forearm, in front of the body
    let shield = null;
    if (sp.shield && (hold === "hang" || hold === "none")) {
      const SP = shieldPic(sp);
      if (SP) {
        const sh = H * 0.36, sc = sh / dims(SP.img)[1] * (SP.unit ? 1 : 1);   // the shield ~36% of the figure's height
        const C = [half * 1.02, W[1] + (shY - W[1]) * 0.22];
        arm.l = ik(S.l, [C[0] - glen * 0.2, C[1] + glen * 0.2], G.upper, G.fore, 1);
        hand.l = { part: "hand-fist", a: -40 * DEG, hidden: true };
        shield = { SP, C, sc, tilt: -7 * DEG, h: sh };
      }
    }
    // a second one-handed blade (dual wielding): in the LEFT hand, the right hand's hold mirrored
    let offWeapon = null;
    const offId = !sp.shield && hold === "hang" && L.eq ? L.eq.offhand : null, offWk = offId && typeof GEARLOOK !== "undefined" ? GEARLOOK.wkOf(offId) : null;
    const OP = offWk && holdOf(offWk) === "hang" ? weaponPic(sp, offWk, m) : null;
    if (OP) {
      arm.l = hang("l", 7); const th2 = (180 - (PRESET[offWk] != null ? PRESET[offWk] : 104)) * DEG, ha = th2 + 32 * DEG;
      hand.l = { part: "hand-fist", a: ha, grip: true, off: true };
      const gp = [arm.l.W[0] + Math.cos(ha) * glen, arm.l.W[1] + Math.sin(ha) * glen];
      let pl = placeGrip(OP, gp[0], gp[1], th2, 1);
      const floor = -H * 0.035; if (pl.tip[1] > floor) pl = placeGrip(OP, gp[0], gp[1], th2, clamp((floor - gp[1]) / (pl.tip[1] - gp[1]), 0.45, 1));
      offWeapon = { P: OP, pl, th: th2, wk: offWk, hands: ["l"] };
    }
    if (!arm.l) arm.l = hang("l", 6);
    for (const s of ["r", "l"]) if (!hand[s].grip && !hand[s].hidden) hand[s].a = ang(arm[s].E, arm[s].W);
    return { sp, set, r, Q, G, u, m, H, wk, hold, W, N, S, shY, half, legs, arm, hand, weapon, offWeapon, shield, bust, glen, L };
  }

  // ---------------------------------------------------------------- drawing the layers (in units, feet at 0,0)
  /* back to front. The off-hand group (left arm, a second blade, the left fist over its grip, the shield on that arm) sits
     over the body and under the main group (right arm, weapon, the fists closed on it); a bow or a two-hander is the
     main weapon, so the left fist on it is drawn with the main group */
  const LAYERS = ["back", "legs", "torso", "pelvis", "head", "armL", "offWeapon", "offFist", "shield", "armR", "weapon", "fists"];
  function drawLayer(g, F, name) {
    const { sp, r, Q, u, H, W, N, half } = F, im = r.imgs, skinT = sp.r && sp.r !== "nord" && !sp.vamp ? sp.skin : null;
    const handImg = (p) => (F.set.includes("leather") && skinT ? tinted(im[p], skinT, F.set + p) : im[p]);
    switch (name) {
      case "back": {
        if (sp.cape) {   // a cape hanging behind, from the shoulders to the calves
          const t = F.shY - H * 0.01, b = -H * 0.13, gr = g.createLinearGradient(-half * 1.5, 0, half * 1.5, 0);
          gr.addColorStop(0, shade(sp.cape, -0.45)); gr.addColorStop(0.3, sp.cape); gr.addColorStop(0.6, shade(sp.cape, 0.12)); gr.addColorStop(1, shade(sp.cape, -0.5));
          g.beginPath(); g.moveTo(-half * 0.95, t); g.quadraticCurveTo(0, t - H * 0.02, half * 0.95, t);
          g.quadraticCurveTo(half * 1.35, (t + b) / 2, half * 1.42, b); g.quadraticCurveTo(0, b + H * 0.02, -half * 1.42, b); g.quadraticCurveTo(-half * 1.35, (t + b) / 2, -half * 0.95, t); g.closePath();
          g.fillStyle = gr; g.fill(); g.strokeStyle = "rgba(20,14,8,0.55)"; g.lineWidth = H * 0.004; g.stroke();
          g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = H * 0.005; for (const x of [-0.6, 0, 0.6]) { g.beginPath(); g.moveTo(x * half, t + H * 0.05); g.lineTo(x * half * 1.3, b); g.stroke(); }
        }
        if (sp.tail) {   // a tail curling out from behind the right leg
          const y0 = F.legs[0].H[1] + H * 0.02;
          g.lineCap = "round"; g.strokeStyle = shade(sp.skin, -0.45); g.lineWidth = H * 0.045;
          const path = () => { g.beginPath(); g.moveTo(half * 0.2, y0); g.bezierCurveTo(half * 1.6, y0 + H * 0.08, half * 1.9, -H * 0.12, half * 1.3, -H * 0.05); };
          path(); g.stroke(); g.strokeStyle = sp.skin; g.lineWidth = H * 0.032; path(); g.stroke();
        }
        return;
      }
      case "legs": {
        g.fillStyle = "rgba(40,28,18,0.32)"; g.beginPath(); g.ellipse(0, 0, half * 2.0, H * 0.025, 0, 0, TAU); g.fill();
        for (const Lg of F.legs) {
          const flip = Lg.s === "r";
          part(g, im.thigh, Q.thigh, u, Lg.H[0], Lg.H[1], ang(Lg.H, Lg.K), flip);
          part(g, im.foot, Q.foot, u, Lg.A[0], Lg.A[1], null, flip, 0.62);
          part(g, im.shin, Q.shin, u, Lg.K[0], Lg.K[1], ang(Lg.K, Lg.A), flip);
        }
        return;
      }
      case "torso": {   // the front half of the side-view breastplate, mirrored about the breastbone
        const q = Q.torso, c = q.n[0], k = 1.12;
        for (const flip of [false, true]) {
          g.save(); g.translate(W[0], W[1]); g.scale(flip ? -k : k, 1);
          const src = mip(im.torso, q.w * u * devScale(g)), [iw, ih] = dims(src), fx = iw / q.w, fy = ih / q.h, x0 = c - 1;
          g.drawImage(src, x0 * fx, 0, (q.w - x0) * fx, q.cut * fy, 0, -q.p[1] * u, (q.w - x0) * u, q.cut * u);
          g.restore();
        }
        // a soft shadow down the breastbone hides the join
        const gr = g.createLinearGradient(-half * 0.12, 0, half * 0.12, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "rgba(20,14,8,0.16)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.save(); g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect(-half * 0.12, N[1], half * 0.24, W[1] - N[1]); g.restore();
        return;
      }
      case "pelvis": { const q = Q.pelvis; part(g, im.pelvis, q, u, W[0] + (q.p[0] - q.w / 2) * u, W[1], null, false); return; }
      case "head": {
        const B = F.bust, s = (H * 0.165) / (B.h * B.F.hh), nx = B.F.nx * B.w * s, ny = B.F.ny * B.h * s;   // the head ~1/6.5 of the figure
        const x0 = N[0] - nx, y0 = N[1] + H * 0.012 - ny;
        const src = mip(B.img, B.w * s * devScale(g));
        g.drawImage(src, x0, y0, B.w * s, B.h * s);
        if (sp.helm) helmet(g, sp, { cx: x0 + B.w * s * (B.F.nx - 0.01), top: y0 + B.h * s * 0.06, brow: y0 + B.h * s * 0.3, w: B.w * s * 0.42 });
        F.headBox = [x0, y0, B.w * s, B.h * s];
        return;
      }
      case "armL": case "armR": {
        const s = name === "armR" ? "r" : "l", A = F.arm[s], flip = s === "r";
        part(g, im.uparm, Q.uparm, u, A.S[0], A.S[1], ang(A.S, A.E), flip);
        part(g, im.forearm, Q.forearm, u, A.E[0], A.E[1], ang(A.E, A.W), flip);
        const h = F.hand[s]; if (!h.grip && !h.hidden) part(g, handImg(h.part), Q[h.part], u, A.W[0], A.W[1], h.a, flip);
        return;
      }
      case "shield": {
        const S = F.shield; if (!S) return;
        const [iw, ih] = dims(S.SP.img), gp = S.SP.meta.shieldGrip;
        g.save(); g.translate(S.C[0], S.C[1]); g.rotate(S.tilt); g.scale(S.sc, S.sc);
        g.drawImage(mip(S.SP.img, iw * devScale(g)), -gp[0] * iw, -gp[1] * ih, iw, ih); g.restore();
        return;
      }
      case "weapon": {
        const Wp = F.weapon; if (!Wp) return;
        if (sp.ench) { g.save(); g.shadowColor = sp.ench; g.shadowBlur = 10 * devScale(g) / Math.max(1, devScale(g)); Wp.pl.draw(g); g.restore(); }
        else Wp.pl.draw(g);
        return;
      }
      case "offWeapon": { if (F.offWeapon) F.offWeapon.pl.draw(g); return; }
      case "offFist": case "fists": {
        for (const s of ["r", "l"]) {
          const h = F.hand[s]; if (!h.grip || !!h.off !== (name === "offFist")) continue;
          part(g, handImg("hand-fist"), Q["hand-fist"], u, F.arm[s].W[0], F.arm[s].W[1], h.a, s === "r" && h.a > Math.PI / 2 ? false : s === "r");
        }
        return;
      }
    }
  }
  function shade(c, k) { const g = GEAR(); return g ? g.tone(c, k) : c; }
  /* a worn helmet, front-on, over the painted head: a dome to the brow, a band, and the set's nasal, cheek plates or horns */
  function helmet(g, sp, b) {
    const h = sp.helm, S = h.set || {}, c = S.c || "#8f8a84", tr = S.trim || shade(c, 0.3), k = h.k || "", w = b.w, cx = b.cx, top = b.top, brow = b.brow;
    const lit = (path, base, y0, y1) => { const gr = g.createLinearGradient(cx - w * 0.5, y0, cx + w * 0.5, y1); gr.addColorStop(0, shade(base, 0.35)); gr.addColorStop(0.5, base); gr.addColorStop(1, shade(base, -0.45)); path(); g.fillStyle = gr; g.fill(); g.strokeStyle = "rgba(22,16,10,0.75)"; g.lineWidth = w * 0.02; g.stroke(); };
    if (h.kind === "hood" || h.kind === "mask") {
      const hc = h.kind === "mask" ? "#2c2420" : (h.f && h.f.hood) || c;
      lit(() => { g.beginPath(); g.moveTo(cx - w * 0.62, brow + w * 0.9); g.quadraticCurveTo(cx - w * 0.7, top - w * 0.1, cx, top - w * 0.12); g.quadraticCurveTo(cx + w * 0.7, top - w * 0.1, cx + w * 0.62, brow + w * 0.9);
        g.lineTo(cx + w * 0.42, brow + w * 0.9); g.quadraticCurveTo(cx + w * 0.46, brow - w * 0.1, cx, brow - w * 0.12); g.quadraticCurveTo(cx - w * 0.46, brow - w * 0.1, cx - w * 0.42, brow + w * 0.9); g.closePath(); }, hc, top, brow);
      return;
    }
    const dome = () => { g.beginPath(); g.moveTo(cx - w * 0.56, brow + w * 0.06); g.bezierCurveTo(cx - w * 0.6, top - w * 0.12, cx + w * 0.6, top - w * 0.12, cx + w * 0.56, brow + w * 0.06); g.quadraticCurveTo(cx, brow - w * 0.06, cx - w * 0.56, brow + w * 0.06); g.closePath(); };
    if (h.kind === "cap") {
      lit(dome, c, top, brow);
      const fur = ["hide", "fur", "stormcloak"].includes(k);
      lit(() => { g.beginPath(); g.moveTo(cx - w * 0.6, brow + w * 0.1); g.quadraticCurveTo(cx, brow - w * 0.1, cx + w * 0.6, brow + w * 0.1); g.lineTo(cx + w * 0.6, brow - w * 0.06); g.quadraticCurveTo(cx, brow - w * 0.26, cx - w * 0.6, brow - w * 0.06); g.closePath(); }, fur ? "#cdb995" : tr, brow - w * 0.2, brow + w * 0.1);
      return;
    }
    if (h.kind === "coif") { lit(() => { dome(); g.rect(cx - w * 0.56, brow, w * 0.18, w * 0.7); g.rect(cx + w * 0.38, brow, w * 0.18, w * 0.7); }, c, top, brow + w * 0.6); return; }
    const horned = !!(h.f && h.f.horns) || k === "iron" || k === "nord", hornC = k === "iron" ? "#e8dcc0" : tr;
    if (horned) for (const sx of [-1, 1]) {
      g.beginPath(); g.moveTo(cx + sx * w * 0.42, top + w * 0.28); g.quadraticCurveTo(cx + sx * w * 0.95, top + w * 0.1, cx + sx * w * 0.9, top - w * 0.42);
      g.quadraticCurveTo(cx + sx * w * 0.72, top - w * 0.02, cx + sx * w * 0.36, top + w * 0.08); g.closePath();
      const gr = g.createLinearGradient(cx, top, cx + sx * w, top - w * 0.4); gr.addColorStop(0, shade(hornC, -0.3)); gr.addColorStop(1, shade(hornC, 0.3)); g.fillStyle = gr; g.fill(); g.strokeStyle = "rgba(22,16,10,0.7)"; g.lineWidth = w * 0.02; g.stroke();
    }
    const rg = g.createRadialGradient(cx - w * 0.15, top + w * 0.12, w * 0.04, cx, top + w * 0.3, w * 0.7);
    rg.addColorStop(0, shade(c, 0.6)); rg.addColorStop(0.4, shade(c, 0.12)); rg.addColorStop(0.8, c); rg.addColorStop(1, shade(c, -0.45));
    dome(); g.fillStyle = rg; g.fill(); g.strokeStyle = "rgba(22,16,10,0.75)"; g.lineWidth = w * 0.02; g.stroke();
    g.strokeStyle = shade(c, -0.35); g.lineWidth = w * 0.035; g.beginPath(); g.moveTo(cx, top - w * 0.02); g.lineTo(cx, brow - w * 0.06); g.stroke();   // the ridge over the top
    lit(() => { g.beginPath(); g.moveTo(cx - w * 0.6, brow + w * 0.12); g.quadraticCurveTo(cx, brow - w * 0.04, cx + w * 0.6, brow + w * 0.12); g.lineTo(cx + w * 0.6, brow - w * 0.02); g.quadraticCurveTo(cx, brow - w * 0.18, cx - w * 0.6, brow - w * 0.02); g.closePath(); }, shade(c, -0.25), brow - w * 0.15, brow + w * 0.1);
    for (let i = -2; i <= 2; i++) { g.fillStyle = shade(tr, 0.2); g.beginPath(); g.arc(cx + i * w * 0.22, brow + w * 0.02 + Math.abs(i) * w * 0.015, w * 0.03, 0, TAU); g.fill(); }
    if (h.visor) lit(() => { g.beginPath(); g.moveTo(cx - w * 0.5, brow + w * 0.08); g.lineTo(cx + w * 0.5, brow + w * 0.08); g.lineTo(cx + w * 0.4, brow + w * 0.72); g.quadraticCurveTo(cx, brow + w * 0.86, cx - w * 0.4, brow + w * 0.72); g.closePath(); }, c, brow, brow + w * 0.8);
    else if (k === "steel" || k === "imperial" || S.w === "heavy") {
      lit(() => { g.beginPath(); g.rect(cx - w * 0.045, brow - w * 0.02, w * 0.09, w * 0.42); }, shade(c, -0.15), brow, brow + w * 0.4);   // the nasal guard
      for (const sx of [-1, 1]) lit(() => { g.beginPath(); g.moveTo(cx + sx * w * 0.56, brow + w * 0.08); g.lineTo(cx + sx * w * 0.38, brow + w * 0.1); g.lineTo(cx + sx * w * 0.34, brow + w * 0.56); g.lineTo(cx + sx * w * 0.5, brow + w * 0.6); g.closePath(); }, c, brow, brow + w * 0.6);
    }
  }

  // ---------------------------------------------------------------- fitting it in a box
  /* scale and place so the figure stands at the bottom, as big as fits, and nothing (a raised staff, a cape, a wide
     shield) ever touches the edge: the drawn bounds are measured once off screen */
  const FITS = new Map(), BOUNDS = new Map();
  /* [perf] the figure's drawn bounds depend only on the look, not the box: measured once per look at 2 px per unit
     (was 4, and again for every box size: ~0.8 M pixels scanned in script each time the Hero tab opened) */
  function boundsOf(F) {
    const bkey = JSON.stringify([F.L.r, F.L.eq, F.L.sx || "", F.set, F.bust.img.width]);
    let b = BOUNDS.get(bkey); if (b) return b;
    const k0 = 2, X = 110, Y0 = 210, cv = mk(X * 2 * k0, (Y0 + 8) * k0), g = cv.getContext("2d", { willReadFrequently: true });
    g.setTransform(k0, 0, 0, k0, X * k0, Y0 * k0); for (const n of LAYERS) { g.save(); drawLayer(g, F, n); g.restore(); }
    const W = cv.width, H = cv.height, d = new Uint32Array(g.getImageData(0, 0, W, H).data.buffer);
    const opaque = (v) => (v >>> 24) > 24;   // alpha (little-endian RGBA)
    let y0 = 0, y1 = H - 1, x0 = W, x1 = -1;
    rows: for (; y0 < H; y0++) for (let x = 0; x < W; x++) if (opaque(d[y0 * W + x])) break rows;
    rows2: for (; y1 > y0; y1--) for (let x = 0; x < W; x++) if (opaque(d[y1 * W + x])) break rows2;
    for (let y = y0; y <= y1; y++) { const r = y * W;
      for (let x = 0; x < x0; x++) if (opaque(d[r + x])) { x0 = x; break; }
      for (let x = W - 1; x > x1; x--) if (opaque(d[r + x])) { x1 = x; break; } }
    if (x1 < 0) { x0 = 0; x1 = W - 1; y0 = 0; y1 = H - 1; }
    const bw = F.sp.bw || 1, bh = F.sp.bh || 1;   // the race's build stretches the figure after the fit, so the bounds are stretched too
    b = [(x0 / k0 - X) * bw, (y0 / k0 - Y0) * bh, ((x1 + 1) / k0 - X) * bw, ((y1 + 1) / k0 - Y0) * bh];
    if (BOUNDS.size > 100) BOUNDS.delete(BOUNDS.keys().next().value); BOUNDS.set(bkey, b); return b;
  }
  function fitOf(F, w, h) {
    const key = JSON.stringify([F.L.r, F.L.eq, F.L.sx || "", F.set, w, h, F.bust.img.width]);
    let f = FITS.get(key); if (f) return f;
    const [ux0, uy0, ux1, uy1] = boundsOf(F), bh = F.sp.bh || 1;
    const mg = Math.max(2, Math.min(w, h) * 0.035), fy = h * 0.95;
    let k = (h * 0.86) / (F.H * bh);
    k = Math.min(k, (fy - mg) / Math.max(1, -uy0), (h - mg - fy) / Math.max(0.1, uy1), (w - 2 * mg) / Math.max(1, ux1 - ux0));
    const cx = clamp(w / 2, mg - ux0 * k, w - mg - ux1 * k);
    f = { k, cx, fy, bounds: [ux0, uy0, ux1, uy1] }; if (FITS.size > 200) FITS.delete(FITS.keys().next().value); FITS.set(key, f); return f;
  }

  // ---------------------------------------------------------------- public
  function ok(L, src) { try { return !!rigOf(L, src); } catch { return false; } }
  /* the still figure, drawn into g (already scaled to CSS px), in a w×h box */
  function paint(g, L, w, h, src) {
    let F; try { F = rigOf(L, src); } catch (e) { console.warn("dollfront", e); return false; }
    if (!F) return false;
    const f = fitOf(F, w, h), bw = F.sp.bw || 1, bh = F.sp.bh || 1;
    g.save(); g.translate(f.cx, f.fy); g.scale(f.k * bw, f.k * bh);
    try { for (const n of LAYERS) { g.save(); drawLayer(g, F, n); g.restore(); } } finally { g.restore(); }
    return true;
  }
  /* the live figure: one canvas per layer, moved by CSS. Layers are cached per look, size and pixel ratio */
  const LIVE = new Map();
  function layersOf(L, w, h, src) {
    const F = rigOf(L, src); if (!F) return null;
    const dpr = Math.min(3, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1), key = JSON.stringify([L.r, L.id, L.eq, L.gl, L.sx || "", L.a || 0, w, h, dpr, F.bust.img.width]);
    let rec = LIVE.get(key); if (rec) return rec;
    const f = fitOf(F, w, h), bw = F.sp.bw || 1, bh = F.sp.bh || 1, cv = {};
    for (const n of LAYERS) {
      const c = mk(w * dpr, h * dpr), g = c.getContext("2d");
      g.setTransform(dpr * f.k * bw, 0, 0, dpr * f.k * bh, dpr * f.cx, dpr * f.fy); drawLayer(g, F, n); cv[n] = c;
    }
    const px = (p) => [f.cx + p[0] * f.k * bw, f.fy + p[1] * f.k * bh];
    rec = { cv, w, h, px, F, f, origin: { feet: px([0, 0]), waist: px(F.W), neck: px(F.N), shL: px(F.S.l), shR: px(F.S.r), grip: F.weapon ? px(F.weapon.pl.grip) : px(F.arm.r.W), wrist: px(F.arm.r.W) } };
    if (LIVE.size > 12) LIVE.delete(LIVE.keys().next().value);
    LIVE.set(key, rec); return rec;
  }
  /* the Pack tab's figure: a still picture now; mount() swaps in the moving layers when it lands on the page */
  const PEND = new Map(); let pendN = 0;
  function html(L, w, h, src, still, back) {
    const id = "df" + (++pendN); PEND.set(id, { L, w, h, src: src && src.avatar ? { avatar: src.avatar } : null }); if (PEND.size > 40) PEND.delete(PEND.keys().next().value);
    return `<div class="dfront dfh-${holdOf(specOf(L)?.wk)}" data-dfk="${id}" style="width:${w}px">${still}${back ? `<span class="dfback">${back}</span>` : ""}</div>`;
  }
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  let IO = null;
  function mount(el) {
    const p = PEND.get(el.dataset.dfk); if (!p || el.dataset.dfm) return;
    let rec; try { rec = layersOf(p.L, p.w, p.h, p.src); } catch (e) { console.warn("dollfront mount", e); return; }
    if (!rec) return;
    el.dataset.dfm = "1";
    const box = document.createElement("div"); box.className = "dfrig"; const o = rec.origin, pc = (q) => `${(q[0] / p.w * 100).toFixed(2)}% ${(q[1] / p.h * 100).toFixed(2)}%`;
    const grp = (cls, org, kids) => { const d = document.createElement("div"); d.className = "dfg " + cls; d.style.transformOrigin = pc(org); kids.forEach((k) => d.appendChild(k)); return d; };
    const lay = (n, org) => { const c = document.createElement("canvas"); c.width = rec.cv[n].width; c.height = rec.cv[n].height; c.getContext("2d").drawImage(rec.cv[n], 0, 0); c.className = "dfl dfl-" + n; if (org) c.style.transformOrigin = pc(org); return c; };
    const up = grp("dfg-up", o.waist, [lay("head", o.neck), lay("armL", o.shL), lay("offWeapon", o.shL), lay("offFist", o.shL), lay("shield", o.shL),
      lay("armR", o.shR), grp("dfg-grip", o.wrist, [lay("weapon", o.grip), lay("fists", o.wrist)])]);
    const body = grp("dfg-all", o.feet, [lay("back", o.neck), lay("legs"), lay("torso", o.waist), lay("pelvis"), up]);
    box.appendChild(body);
    el.appendChild(box); el.classList.add("dfon");
    if (reduced()) el.classList.add("dfcalm");
    try {
      if (!IO && typeof IntersectionObserver !== "undefined") IO = new IntersectionObserver((es) => { for (const e of es) e.target.classList.toggle("dfrun", e.isIntersecting); });
      if (IO) IO.observe(el); else el.classList.add("dfrun");
    } catch { el.classList.add("dfrun"); }
  }
  if (live() && typeof MutationObserver !== "undefined") {
    const scan = (n) => { if (n.nodeType !== 1) return; if (n.matches?.(".dfront")) mount(n); n.querySelectorAll?.(".dfront").forEach(mount); };
    const start = () => new MutationObserver((ms) => { for (const m of ms) m.addedNodes.forEach(scan); }).observe(document.body || document.documentElement, { childList: true, subtree: true });
    if (document.body) start(); else addEventListener("DOMContentLoaded", start, { once: true });
    try { if (typeof ASSETS !== "undefined") ASSETS.on(() => document.querySelectorAll(".dfront:not([data-dfm])").forEach(mount)); } catch { /* no pictures */ }   // pictures arrived after it landed
    if (typeof document.addEventListener === "function") document.addEventListener("visibilitychange", () => { document.documentElement.classList.toggle("dfhidden", document.hidden); });
  }

  /* what the screen test checks, in CSS px of a w×h box: each gripping fist against the weapon's grip line, the
     weapon's angle against its class preset, the head below / above the fist, how much of the torso the shield covers
     and whether it is in front, and whether anything touches the box's edge */
  function probe(L, w, h, src) {
    const rec = layersOf(L, w, h, src); if (!rec) return null;
    const F = rec.F, px = rec.px, out = { set: F.set, wk: F.wk, hold: F.hold, hands: [], layers: LAYERS.slice() };
    if (F.weapon) {
      const Wp = F.weapon, pl = Wp.pl, g = px(pl.grip), t = px(pl.tip), a = Math.atan2(t[1] - g[1], t[0] - g[0]) / DEG;
      out.angle = Math.round(a * 10) / 10; out.preset = PRESET[F.wk]; out.tipBelow = t[1] > g[1];
      const line = (p) => { const dx = t[0] - g[0], dy = t[1] - g[1], L2 = dx * dx + dy * dy || 1, s = ((p[0] - g[0]) * dx + (p[1] - g[1]) * dy) / L2; return Math.hypot(g[0] + dx * s - p[0], g[1] + dy * s - p[1]); };
      for (const s of Wp.hands) {
        const A = F.arm[s].W, hd = F.hand[s], fist = px([A[0] + Math.cos(hd.a) * F.glen, A[1] + Math.sin(hd.a) * F.glen]);
        const want = hd.at ? px(hd.at) : g, err = Wp.slide ? line(fist) : Math.hypot(fist[0] - want[0], fist[1] - want[1]);
        out.hands.push({ side: s, err: Math.round(err * 100) / 100 });
      }
    }
    if (F.offWeapon) {   // the left hand's blade: its grip in the left fist, the hold mirrored
      const pl = F.offWeapon.pl, g = px(pl.grip), t = px(pl.tip), A = F.arm.l.W, hd = F.hand.l, fist = px([A[0] + Math.cos(hd.a) * F.glen, A[1] + Math.sin(hd.a) * F.glen]);
      out.off = { wk: F.offWeapon.wk, side: "l", err: Math.round(Math.hypot(fist[0] - g[0], fist[1] - g[1]) * 100) / 100, angle: Math.round(Math.atan2(t[1] - g[1], t[0] - g[0]) / DEG * 10) / 10, preset: 180 - PRESET[F.offWeapon.wk], tipBelow: t[1] > g[1], leftOfBody: g[0] > px([0, 0])[0] };
    }
    out.mainRight = !F.weapon || F.hold === "bow" || F.weapon.hands[0] === "r";
    // pixels: the torso's and the shield's masks, and the whole figure's edge
    const mask = (n) => { const c = rec.cv[n], x = c.getContext("2d", { willReadFrequently: true }); return { d: x.getImageData(0, 0, c.width, c.height).data, W: c.width, H: c.height }; };
    if (F.shield) {
      const T = mask("torso"), S = mask("shield"); let nt = 0, ov = 0;
      for (let i = 3; i < T.d.length; i += 4) if (T.d[i] > 128) { nt++; if (S.d[i] > 128) ov++; }
      out.shieldCover = nt ? Math.round((ov / nt) * 1000) / 1000 : 0;
      out.shieldFront = LAYERS.indexOf("shield") > LAYERS.indexOf("torso");
    }
    let edge = 0; const W = rec.cv.legs.width, H = rec.cv.legs.height;
    for (const n of LAYERS) {
      const M = mask(n);
      for (let x = 0; x < W; x++) { if (M.d[x * 4 + 3] > 24) edge++; if (M.d[((H - 1) * W + x) * 4 + 3] > 24) edge++; }
      for (let y = 0; y < H; y++) { if (M.d[(y * W) * 4 + 3] > 24) edge++; if (M.d[(y * W + W - 1) * 4 + 3] > 24) edge++; }
    }
    out.edgePx = edge;
    return out;
  }
  return { ok, paint, html, probe, mount, layersOf, PRESET, HOLD, holdOf, LAYERS, bustOf };
})();
if (typeof module !== "undefined") module.exports = DOLLFRONT;
