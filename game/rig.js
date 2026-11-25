/* PAINTRIG: painted, animated fighters. [OURS]
   The painted body parts (rig-<who>-<set>-<part>.webp, measured in rigdata.js) are hung on a skeleton with joints at the
   neck, shoulders, elbows, wrists, waist, hips, knees and ankles, and posed live with two-bone IK, in the same controls
   as the ink figures (figart.js): aim / back / lean / feet... so the fight replay drives both the same way.
   When every part of a set has loaded, FIGART.fight hands the figure to PAINTRIG.fight; until then (or when a look has no
   id, or anything goes wrong) the old ink figure is drawn, so nothing ever goes missing.

     PAINTRIG.fight(g, look, o, sp) → true when it drew the figure (feet at 0,0, facing right, ~61 units tall)
       o: FIGART.fight's options (aim, back, hunch, lunge, draw, wt, shield, off, glow, flask, t; clip, u, from, fu, w)
          plus move + mu + power (the replay's move and its time 0..1), knock (how hard you were just hit), down (0..1,
          knocked down), dying (0..1, a foe's death fall), ride (in the saddle)
     PAINTRIG.can(look)   → the painted parts for this look are loaded (fightart.js then lets the rig play the fall)
     PAINTRIG.draw(g, look, { clip, u, t }) → one clip frame on its own (the viewer, tests)
     PAINTRIG.setOf(sp)   → which painted set a look wears · PAINTRIG.geo(set) → its skeleton in units (tests)
   Gear: light armour, robes and plain clothes → leather; iron (and banded, chain) → iron; steel and heavier → steel;
   women → the women's leather set for now. Other races wear the Nord parts with a gentle skin tint on face and hands. */
const PAINTRIG = (() => {
  const D = typeof RIGDATA !== "undefined" ? RIGDATA : typeof require !== "undefined" ? require("./rigdata.js") : null;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const TAU = Math.PI * 2;
  let broken = false;

  // ---------------------------------------------------------------- which set
  const IRONISH = /^(iron|banded|chain|imperial|stormcloak|ancient)/;
  const FEM_FOLLOWER = /^f-(lydia|jenassa|aela|uthgerd|mjoll|serana|annekke|iona|jordis)\b/;   // followers' looks carry no sex: the women we know
  function setOf(sp, L) {
    if (!sp) return "nordm-leather";
    if (sp.fem || (L && FEM_FOLLOWER.test(String(L.id)))) return "nordf-leather";
    if (sp.heavy) return IRONISH.test(sp.ck || "") ? "nordm-iron" : "nordm-steel";
    return "nordm-leather";
  }

  // ---------------------------------------------------------------- the skeleton of one set (in that set's units)
  const GEO = new Map();
  function geo(set) {
    let G = GEO.get(set); if (G) return G;
    const S = D.SETS[set], u = 1 / S.ppu, P = S.parts;
    const len = (q) => Math.hypot(q.e[0] - q.p[0], q.e[1] - q.p[1]) * u;
    const ankleH = (P.foot.sole - P.foot.p[1]) * u, thigh = len(P.thigh), shin = len(P.shin);
    const hipY = -(ankleH + (thigh + shin) * 0.975);   // the knees a touch soft, never locked
    const pv = P.pelvis, T = P.torso;
    const waist = [(pv.p[0] - pv.hip[0]) * u, (pv.p[1] - pv.hip[1]) * u];   // the waist joint, from the hip joint
    const sh = [(T.s[0] - T.p[0]) * u, (T.s[1] - T.p[1]) * u], nk = [(T.n[0] - T.p[0]) * u, (T.n[1] - T.p[1]) * u];
    const top = hipY + waist[1] + nk[1] - P.head.p[1] * u;
    G = { set, u, ankleH, thigh, shin, upper: len(P.uparm), fore: len(P.forearm), bent: len(P["leg-bent"]), hipY, waist, sh, nk, height: -top, P };
    G.m = G.height / 61;   // set units per figure unit (the ink figures are 61 units tall)
    GEO.set(set, G); return G;
  }

  // ---------------------------------------------------------------- loading and picture caches
  const REC = new Map();
  function ready(set) {
    const r0 = REC.get(set); if (r0) return r0;
    if (typeof ASSETS === "undefined" || !D) return null;
    const imgs = {}; let ok = true;
    for (const p of D.PARTS) { const im = ASSETS.img(D.file(set, p)); if (im) imgs[p] = im; else ok = false; }
    if (!ok) return null;
    const r = { set, imgs, G: geo(set), cache: new Map() }; REC.set(set, r); return r;
  }
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  /* level 0 is the file; each level below is half the size (drawn smoothly), so a small figure never shimmers */
  function level(r, part, v, lv) {
    const key = part + "|" + v + "|" + lv; let c = r.cache.get(key); if (c) return c;
    if (v === "n") {
      if (lv === 0) c = r.imgs[part];
      else { const s = level(r, part, "n", lv - 1), w = s.width || s.naturalWidth, h = s.height || s.naturalHeight; c = mk(w / 2, h / 2); const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(s, 0, 0, c.width, c.height); }
    } else c = recolor(level(r, part, "n", lv), v);
    r.cache.set(key, c); return c;
  }
  function pic(r, part, v, need) {
    const q = D.SETS[r.set].parts[part]; let lv = 0;
    while (lv < 4 && (q.w * D.RES) / (1 << (lv + 1)) >= need * 1.15) lv++;
    return level(r, part, v, lv);
  }
  const hexRGB = (c) => { const m = /^#([0-9a-f]{6})$/i.exec(c || ""); return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4), 16)] : null; };
  /* v: "d" the far side (in shade), "t:#rrggbb" skin tinted, "dt:#rrggbb" both */
  function recolor(src, v) {
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight, c = mk(w, h), x = c.getContext("2d");
    x.drawImage(src, 0, 0);
    const tint = v.split(":")[1], rgb = hexRGB(tint);
    if (rgb) {
      const lum = (0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]) / 255;
      x.globalCompositeOperation = "color"; x.globalAlpha = 0.38; x.fillStyle = tint; x.fillRect(0, 0, w, h);
      if (lum < 0.62) { x.globalCompositeOperation = "multiply"; x.globalAlpha = clamp((0.62 - lum) * 1.6, 0, 0.6); x.fillStyle = tint; x.fillRect(0, 0, w, h); }
    }
    if (v[0] === "d") { x.globalCompositeOperation = "multiply"; x.globalAlpha = 1; x.fillStyle = "#8f877f"; x.fillRect(0, 0, w, h); }
    x.globalCompositeOperation = "destination-in"; x.globalAlpha = 1; x.drawImage(src, 0, 0);
    return c;
  }

  // ---------------------------------------------------------------- clips
  const EASE = { lin: (t) => t, io: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)), in: (t) => t * t * t, out: (t) => 1 - Math.pow(1 - t, 3),
    back: (t) => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); } };
  const BASE = { aim: -0.55, back: 0.1, lean: 0.02, dy: 0, ox: 0, rot: 0, tilt: 0, hipx: 0, fn: [5.5, 0], ff: [-5.5, 0], draw: 0, cast: 0 };
  function mix(a, b, w) {
    const o = {};
    for (const k in BASE) {
      const x = a[k] !== undefined ? a[k] : BASE[k], y = b[k] !== undefined ? b[k] : BASE[k];
      o[k] = Array.isArray(x) ? [x[0] + (y[0] - x[0]) * w, x[1] + (y[1] - x[1]) * w] : x + (y - x) * w;
    }
    return o;
  }
  /* the controls of a clip at u (0..1): eased from key to key, each key's own ease */
  function sample(name, u) {
    const C = D.CLIPS[name] || D.CLIPS.idle, ks = C.keys, n = ks.length;
    u = C.loop ? ((u % 1) + 1) % 1 : clamp(u, 0, 1);
    if (n === 1) return mix(ks[0][1], ks[0][1], 0);
    let i = 0; while (i < n - 2 && ks[i + 1][0] <= u) i++;
    const [ta, a] = ks[i], [tb, b, e] = ks[i + 1], t = clamp((u - ta) / Math.max(1e-6, tb - ta), 0, 1);
    return mix(a, b, (EASE[e] || EASE.io)(t));
  }
  /* time-warp: the replay's contact moment (hitU) lands on the clip's own contact key, so the blow connects on the frame
     the fight scene plays its blood, sparks and numbers (gorefx2) */
  function warp(u, hitU, clipHit) {
    if (hitU == null || clipHit == null || hitU <= 0 || hitU >= 1) return u;
    return u < hitU ? (u / hitU) * clipHit : clipHit + ((u - hitU) / (1 - hitU)) * (1 - clipHit);
  }
  const RANGED = new Set(["bow", "crossbow"]), TWO_MELEE = new Set(["greatsword", "battleaxe", "warhammer"]);
  /* what an ally clip (allyanim.js) is in this rig */
  function allyClip(name, wk) {
    if (name === "attack") return RANGED.has(wk) ? "bow" : TWO_MELEE.has(wk) ? "swing2h" : wk === "dagger" || wk === "spear" || !wk ? "thrust" : "swing";
    return D.CLIPS[name] ? name : "idle";
  }
  const ALLY_HIT = 0.55;   // where allyanim.js / figart.js put the contact of an attack

  /* the controls for one fight figure */
  function controls(o, sp, wk) {
    const lunge = o.lunge || 0, ranged = RANGED.has(wk);
    let P = { aim: o.aim != null ? o.aim : ranged ? 0 : -0.5 + lunge * 1.1, back: o.back || 0, lean: (o.hunch || 0) + lunge * 0.25, dy: 0, ox: 0, rot: 0, tilt: 0, hipx: lunge * 2,
      fn: [5.5 + lunge * 5, 0], ff: [-5.5, 0], draw: o.draw || 0, cast: 0 };
    let hand = null, front = (o.back || 0) < -0.8, clipName = null;
    if (o.down > 0) {   // knocked down (you, a follower, a horse's rider: never dead)
      P = sample("down", o.down); hand = "open"; clipName = "down";
    } else if (o.clip) {   // a follower or party mate acting out its clip (allyanim.js)
      const nameOf = (c, u, w) => {
        if (c === "down") return ["down", 1];
        if (c === "attack") { const n = allyClip(c, wk); return [n, warp(u, ALLY_HIT, D.CLIPS[n].hit)]; }
        return [allyClip(c, wk), c === "idle" ? (o.t || 0) / D.CLIPS.idle.len : u];
      };
      let [n, u] = nameOf(o.clip, o.u || 0), w = o.w == null ? 1 : o.w;
      if (o.clip === "down" && o.from === "hit") { n = "down"; u = w * 0.95; w = 1; }   // falling
      else if (o.clip === "idle" && o.from === "down") { n = "getup"; u = w; w = 1; }   // getting back up
      P = sample(n, u); clipName = n;
      if (o.from && w < 1) { const [fnm, fu] = nameOf(o.from, o.fu || 0); P = mix(sample(fnm, fu), P, w); }
      const C = D.CLIPS[n]; hand = C.hand || null; front = !!C.front || P.back < -0.8;
    } else {
      const name = o.move ? D.MOVE_CLIP[o.move] : null;
      if (name && o.mu != null) {   // the replay's arms, this clip's legs, hips and head
        const C = D.CLIPS[name], B = sample(name, warp(o.mu, o.hitU, C.hit)), pw = o.power ? 1.3 : 1;
        P.fn = [B.fn[0] * (B.fn[0] > 6 ? pw : 1), B.fn[1]]; P.ff = B.ff; P.dy = B.dy * pw; P.hipx = B.hipx * pw; P.tilt = B.tilt; P.ox = B.ox;
        P.lean = P.lean * 0.7 + B.lean * 0.5 * pw; clipName = name;
        if (name === "cast") { P.cast = B.cast; hand = "open"; }
      } else if (!(lunge > 0.05)) {   // standing: breathing
        const B = sample("idle", (o.t || 0) / D.CLIPS.idle.len);
        P.dy = B.dy; P.tilt = B.tilt; P.lean += B.lean; clipName = "idle";
      }
    }
    if (o.knock > 0.5 && !(o.down > 0)) {   // just hit: a flinch, a stagger when it was a hard one
      const hard = o.knock >= 13, H = sample(hard ? "stagger" : "hit", hard ? 0.18 : 0.2), w = clamp(o.knock / (hard ? 16 : 9), 0, 1) * 0.9;
      const keep = { ox: P.ox };
      P = mix(P, H, w); P.ox = keep.ox;   // the scene already pushes the whole figure back
    }
    if (o.dying > 0) {   // a foe's death (foerig.js turns the body; the limbs give up)
      const H = sample("death", clamp(o.dying, 0, 0.78)); P.aim = H.aim; P.back = H.back; P.tilt = H.tilt; hand = "open";
    }
    if (o.ride) { const B = sample("ride", (o.t || 0) / D.CLIPS.ride.len); P.lean = B.lean + (P.lean - 0.02) * 0.6; P.tilt = B.tilt; }   // the legs stay as the ink rider's: the horse's near side covers them
    P.hand = hand; P.front = front; P.clip = clipName;
    return P;
  }

  // ---------------------------------------------------------------- solving the bones
  function ik(ax, ay, bx, by, l1, l2, side) {
    let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.02;
    if (d > max) { bx = ax + dx / d * max; by = ay + dy / d * max; dx = bx - ax; dy = by - ay; d = max; }
    if (d < 0.01) { d = 0.01; dx = 0; dy = 0.01; }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / d, uy = dy / d;
    return [[ax + ux * a - uy * h * side, ay + uy * a + ux * h * side], [bx, by]];
  }
  const rot = (a, v) => [Math.cos(a) * v[0] - Math.sin(a) * v[1], Math.sin(a) * v[0] + Math.cos(a) * v[1]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  /* the near hand and the far hand ride circles around the shoulders like on the ink figures (figart.js), drawn in a
     little closer so the elbows bend: aim / back turn the same way, sized to this set's arms */
  function solve(G, P) {
    const m = G.m, sa = P.lean || 0, pa = sa * 0.3;
    const fn = [P.fn[0] * m, P.fn[1] * m], ff = [P.ff[0] * m, P.ff[1] * m];
    const H = [((P.ox || 0) + (P.hipx || 0)) * m + (fn[0] + ff[0]) * 0.3, G.hipY + (P.dy || 0) * m];
    const W = add(H, rot(pa, G.waist)), S = add(W, rot(sa, G.sh)), SF = add(S, rot(sa, [2.4 * m, -0.4 * m])), N = add(W, rot(sa, G.nk));
    const ka = (G.upper + G.fore) / 21.6, aim = P.aim, bk = P.back;
    const hn = add(S, rot(sa, [ka * (3 + Math.cos(aim) * 11 - Math.sin(aim) * 6), ka * (4 + Math.sin(aim) * 11 + Math.cos(aim) * 6)]));
    const hf = P.farHand || add(SF, rot(sa, [ka * (-0.5 - 3 * Math.cos(bk) - 13 * Math.sin(bk)), ka * (0.5 - 3 * Math.sin(bk) + 14 * Math.cos(bk))]));
    const [eN, wN] = ik(S[0], S[1], hn[0], hn[1], G.upper, G.fore, 1), [eF, wF] = ik(SF[0], SF[1], hf[0], hf[1], G.upper, G.fore, 1);
    const hipN = add(H, [0.5 * m, 0]), hipF = add(H, [-0.6 * m, 0]);
    const leg = (hip, f) => { const [k, a] = ik(hip[0], hip[1], f[0], f[1] - G.ankleH, G.thigh, G.shin, -1); return { hip, knee: k, ankle: a, toe: clamp(-f[1] / m * 0.09, -0.1, 0.5) }; };
    return { H, W, S, SF, N, sa, pa, armN: { sh: S, el: eN, wr: wN }, armF: { sh: SF, el: eF, wr: wF }, legN: leg(hipN, fn), legF: leg(hipF, ff) };
  }

  // ---------------------------------------------------------------- drawing
  const angOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  function put(g, img, q, u, x, y, a, cut) {
    g.save(); g.translate(x, y); if (a) g.rotate(a);
    if (cut) { const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight; g.drawImage(img, 0, 0, iw, ih * cut / q.h, -q.p[0] * u, -q.p[1] * u, q.w * u, cut * u); }
    else g.drawImage(img, -q.p[0] * u, -q.p[1] * u, q.w * u, q.h * u);
    g.restore();
  }
  /* a limb part along its bone: the part's p→e line turned onto the bone a→b */
  function limbAt(g, ctx, part, v, a, b) {
    const q = ctx.Q[part], img = pic(ctx.r, part, v, q.w * ctx.G.u * ctx.dev);
    put(g, img, q, ctx.G.u, a[0], a[1], angOf(a, b) - Math.atan2(q.e[1] - q.p[1], q.e[0] - q.p[0]));
  }
  function uprightAt(g, ctx, part, v, at, a, cut) {
    const q = ctx.Q[part], img = pic(ctx.r, part, v, q.w * ctx.G.u * ctx.dev);
    put(g, img, q, ctx.G.u, at[0], at[1], a, cut);
  }
  /* the hand: along the forearm, or (holding something) turned toward the grip, but never bent past what a wrist can do */
  function handAt(g, ctx, arm, part, v, want) {
    const q = ctx.Q[part], fa = angOf(arm.el, arm.wr);
    let a = fa;
    if (want != null) { let d = want - fa; d = Math.atan2(Math.sin(d), Math.cos(d)); a = fa + clamp(d, -1, 1); }
    const axis = Math.atan2(q.e[1] - q.p[1], q.e[0] - q.p[0]), img = pic(ctx.r, part, v, q.w * ctx.G.u * ctx.dev);
    put(g, img, q, ctx.G.u, arm.wr[0], arm.wr[1], a - axis);
    const len = Math.hypot(q.e[0] - q.p[0], q.e[1] - q.p[1]) * ctx.G.u * 0.55;
    return [arm.wr[0] + Math.cos(a) * len, arm.wr[1] + Math.sin(a) * len];   // the middle of the hand: where a grip sits
  }
  function armAt(g, ctx, arm, v, handPart, handV, want) {
    limbAt(g, ctx, "uparm", v, arm.sh, arm.el);
    limbAt(g, ctx, "forearm", v, arm.el, arm.wr);
    return handPart ? handAt(g, ctx, arm, handPart, handV, want) : null;
  }
  function legAt(g, ctx, L, v) {
    limbAt(g, ctx, "thigh", v, L.hip, L.knee);
    uprightAt(g, ctx, "foot", v, L.ankle, L.toe);
    limbAt(g, ctx, "shin", v, L.knee, L.ankle);
  }
  function flaskAt(g, x, y, col, k) {
    g.save(); g.translate(x, y); g.scale(k, k);
    g.beginPath(); g.moveTo(-1.6, -1); g.lineTo(1.6, -1); g.lineTo(2, -4.6); g.lineTo(0.5, -5.6); g.lineTo(0.5, -7); g.lineTo(-0.5, -7); g.lineTo(-0.5, -5.6); g.lineTo(-2, -4.6); g.closePath();
    g.fillStyle = col; g.fill(); g.strokeStyle = "rgba(30,20,12,0.8)"; g.lineWidth = 0.4; g.stroke(); g.restore();
  }
  const WSC = 1.18;   // weapons a touch bigger than on the ink figures: painted hands are big
  function figure(g, ctx, P, sp, o, wk) {
    const G = ctx.G, m = G.m, B = solve(G, P), kit = ctx.kit, st = ctx.st;
    const tintC = sp.r && sp.r !== "nord" && !sp.vamp ? sp.skin : null, sv = (d) => (tintC ? (d ? "dt:" : "t:") + tintC : d ? "d" : "n");
    const ranged = RANGED.has(wk), two = TWO_MELEE.has(wk) || wk === "staff" || wk === "spear";
    const tipA = wk && kit && kit.TIP[wk] ? Math.atan2(kit.TIP[wk][1], kit.TIP[wk][0]) : -Math.PI / 4;
    const wa = B.sa + P.aim;   // the weapon's frame, as on the ink figures
    const armedN = !!wk && wk !== "fist" && !P.flask, openAll = P.hand === "open";
    const glowC = o.glow ? sp.ench || "#7fb6ff" : null, castC = wk === "staff" ? sp.staffC : sp.ench || "#9fd0f0";
    // where the far hand goes when it helps: on the bow string, under a crossbow, low on a two-handed grip
    const nearGrip = () => { const q = ctx.Q["hand-fist"], len = Math.hypot(q.e[0] - q.p[0], q.e[1] - q.p[1]) * G.u * 0.55, wr = B.armN.wr, fa = angOf(B.armN.el, wr); return [wr[0] + Math.cos(fa) * len, wr[1] + Math.sin(fa) * len]; };
    let farOn = null;
    if (!P.ride && !(P.down > 0) && !openAll) {
      if (wk === "bow" && (P.back < -0.5 || P.draw > 0.05)) farOn = add(nearGrip(), rot(wa, [(2.9 - P.draw * 13) * m * WSC, 0]));
      else if (wk === "crossbow") farOn = add(nearGrip(), rot(wa, [7 * m * WSC, 1.5 * m]));
      else if (two && !o.shield) farOn = add(nearGrip(), rot(wa + tipA, [-4.5 * m * WSC, 0]));
    }
    if (farOn) { P.farHand = farOn; Object.assign(B, solve(G, P)); }
    const shieldOn = !!o.shield && !two && !ranged, shieldFront = shieldOn && (P.front || P.back < -0.8);
    const kS = m * 1.35;
    const shieldHere = (front) => { if (!kit) return; const wr = B.armF.wr; g.save(); g.translate(wr[0], wr[1]); g.rotate(B.sa); g.scale(kS, kS); kit.shieldAt(g, sp, 0, 0, front, st); g.restore(); };
    // the far arm, in shade, behind everything
    const farPart = shieldOn || o.off || farOn ? "hand-fist" : "hand-open";
    const fg = armAt(g, ctx, B.armF, "d", farPart, sv(true), farOn && wk === "bow" ? wa : null);
    if (o.off && kit) { g.save(); g.translate(fg[0], fg[1]); g.rotate(B.sa + 0.55 + (o.lunge || 0) * 0.7); g.scale(m * WSC, m * WSC); kit.weapon(g, sp, o.off, st, { plain: true, glow: glowC }); g.restore(); }
    if (shieldOn && !shieldFront) shieldHere(false);
    if (P.cast > 0.05 && kit) kit.glowAt(g, fg[0], fg[1], (5 + P.cast * 3) * m, castC, 0.75, st);
    // legs: the far one in shade (in the saddle only the near leg shows, bent over the horse's flank)
    if (P.ride) {
      const q = ctx.Q["leg-bent"], hip = add(B.H, [0.6 * m, 0]);
      uprightAt(g, ctx, "leg-bent", "n", hip, B.pa - 0.12, 0);
      void q;
    } else { legAt(g, ctx, B.legF, "d"); legAt(g, ctx, B.legN, "n"); }
    // the body: torso (its waist plug hidden), the hips over it, then the head
    const hk = B.sa * 0.55 + (P.tilt || 0);
    uprightAt(g, ctx, "torso", "n", B.W, B.sa, ctx.Q.torso.cut);
    uprightAt(g, ctx, "pelvis", "n", B.W, B.pa, 0);
    uprightAt(g, ctx, "head", sv(false), B.N, hk, 0);
    if (shieldFront) shieldHere(true);
    // the near arm: upper arm, forearm, then whatever is in the hand, then the hand over its grip
    limbAt(g, ctx, "uparm", "n", B.armN.sh, B.armN.el);
    limbAt(g, ctx, "forearm", "n", B.armN.el, B.armN.wr);
    const handPart = openAll || (!armedN && !P.flask && P.cast > 0.05) ? "hand-open" : armedN || P.flask ? "hand-fist" : "hand-open";
    const want = armedN ? (ranged ? wa : wa + tipA + Math.PI / 2) : null;
    // the grip point comes from the hand's angle, so work it out first, draw the weapon, then the hand on top
    const q = ctx.Q[handPart], fa = angOf(B.armN.el, B.armN.wr);
    let ha = fa; if (want != null) { let d = want - fa; d = Math.atan2(Math.sin(d), Math.cos(d)); ha = fa + clamp(d, -1, 1); }
    const glen = Math.hypot(q.e[0] - q.p[0], q.e[1] - q.p[1]) * G.u * 0.55, grip = [B.armN.wr[0] + Math.cos(ha) * glen, B.armN.wr[1] + Math.sin(ha) * glen];
    if (armedN && kit && !openAll) { g.save(); g.translate(grip[0], grip[1]); g.rotate(wa); g.scale(m * WSC, m * WSC); kit.weapon(g, sp, wk, st, { draw: P.draw, glow: glowC, plain: wk !== sp.wk }); g.restore(); }
    handAt(g, ctx, B.armN, handPart, sv(false), want);
    if (P.flask) flaskAt(g, grip[0], grip[1] - 0.5 * m, P.flask, m * 1.2);
    if (P.cast > 0.05 && kit) kit.glowAt(g, grip[0] + 1.6 * m, grip[1] - 0.6 * m, (5 + P.cast * 3.4) * m, castC, 0.85, st);
    return B;
  }
  /* draw a posed figure: g is in figure units (feet at 0,0, ~61 tall) */
  function render(g, r, sp, P, o, wk) {
    const G = r.G, kN = 1 / G.m, kit = typeof FIGART !== "undefined" ? FIGART.kit : null;
    g.save();
    if (P.rot) {   // lying down: turned about the feet, then laid on the ground (on the back, head away from the foe)
      const f = Math.min(1, Math.abs(P.rot) / (Math.PI / 2));
      g.translate(24 * f, -10 * f); g.rotate(P.rot);
    }
    g.scale(kN * (sp.bw || 1), kN * (sp.bh || 1));
    const dev0 = kit ? kit.devScale(g) : 1;
    const ctx = { r, G, Q: G.P, dev: dev0, kit, st: kit ? kit.styleOf(Math.max(0.25, Math.round(dev0 * G.m * 4) / 4)) : null };
    try { figure(g, ctx, P, sp, o, wk); } finally { g.restore(); }
  }

  // ---------------------------------------------------------------- the public entry points
  const specFor = (look) => (typeof FIGART !== "undefined" ? FIGART.specOf(FIGART.lookFor({ look })) : null);
  const paintable = (L) => !!(L && L.id != null && L.id !== "x" && !L.ww);
  function can(look) {
    if (broken || !paintable(look)) return false;
    try { return !!ready(setOf(specFor(look), look)); } catch { return false; }
  }
  function fight(g, look, o, sp) {
    if (broken || !D || !paintable(look) || typeof document === "undefined") return false;
    const r = ready(setOf(sp, look)); if (!r) return false;
    const wk = o.wt === undefined ? sp.wk : o.wt || null;
    try {
      const P = controls(o, sp, wk);
      P.flask = o.flask || null; P.down = o.down || 0;
      render(g, r, sp, P, o, wk);
      return true;
    } catch (e) { broken = true; if (typeof console !== "undefined") console.warn("paintrig", e); return false; }
  }
  /* one clip frame (the viewer and tests): o.clip, o.u (0..1) or o.t (seconds), o.wt, o.shield */
  function draw(g, look, o = {}) {
    const sp = specFor(look); if (!sp) return false;
    const r = ready(setOf(sp, look)); if (!r) return false;
    const name = D.CLIPS[o.clip] ? o.clip : "idle", C = D.CLIPS[name], u = o.u != null ? o.u : ((o.t || 0) / C.len) % 1;
    const wk = o.wt === undefined ? sp.wk : o.wt || null, P = sample(name, u);
    P.hand = C.hand || null; P.front = !!C.front || P.back < -0.8; P.clip = name; P.ride = !!C.ride;
    render(g, r, sp, P, { shield: o.shield === undefined ? !!sp.shield : o.shield, glow: o.glow, t: o.t, ride: P.ride }, wk);
    return true;
  }
  return { setOf, geo, can, fight, draw, sample, warp, controls, solve, ready, get broken() { return broken; }, reset: () => { broken = false; REC.clear(); } };
})();
if (typeof module !== "undefined") module.exports = PAINTRIG;
