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
   women get the women's sets the same way. Dunmer, Khajiit and Argonians wear their own painted head (RIGDATA.HEADS, scaled
   to the set's neck) on the Nord body, hands tinted to their skin; other races wear the Nord head with a gentle skin tint. */
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
    const who = sp.fem || (L && FEM_FOLLOWER.test(String(L.id))) ? "nordf" : "nordm";
    if (sp.heavy) return who + (IRONISH.test(sp.ck || "") ? "-iron" : "-steel");
    return who + "-leather";
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
  /* another race's painted head (dunmer, khajiit, argonian; m/f), or null: the Nord head with a skin tint then */
  const HREC = new Map();
  function raceHead(sp) {
    if (!sp || !sp.r || sp.r === "nord" || !D || !D.HEADS || typeof ASSETS === "undefined") return null;
    const key = sp.r + (sp.fem ? "f" : "m"), q = D.HEADS[key]; if (!q) return null;
    let h = HREC.get(key); if (h) return h;
    const im = ASSETS.img(D.headFile(key)); if (!im) return null;
    h = { key, set: key, Q: { head: q }, imgs: { head: im }, cache: new Map() }; HREC.set(key, h); return h;
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
  /* [rigcohesion] the part as drawn: at the level that fits, softened and graded for the fight scene it stands in
     (riglook.js), made once per part, level and scene */
  const LOOK = () => (typeof RIGLOOK !== "undefined" ? RIGLOOK : null);
  function pic(r, part, v, need) {
    const q = (r.Q || D.SETS[r.set].parts)[part]; let lv = 0;
    while (lv < 4 && (q.w * D.RES) / (1 << (lv + 1)) >= need * 1.15) lv++;
    const L = LOOK(); if (!L) return level(r, part, v, lv);
    const key = part + "|" + v + "|" + lv + "|" + L.key(); let c = r.cache.get(key);
    if (!c) { c = L.bake(level(r, part, v, lv), { soft: true, rim: 2.4 }); r.cache.set(key, c); }
    return c;
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
  const BASE = { aim: -0.55, back: 0.1, lean: 0.02, dy: 0, ox: 0, rot: 0, tilt: 0, hipx: 0, fn: [5.5, 0], ff: [-5.5, 0], draw: 0, cast: 0, hk: 0, hx: 0, hy: 0, twist: 0, loose: 0 };
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

  /* the fight scene hands us how hard you were just hit (o.knock) and lets it die away as exp(-7 t) from the blow; the
     first value after a rise is the blow's strength, so the time since the blow is ln(peak / knock) / 7, and the hit
     clip (a stagger for a hard blow) plays at its own pace: head snap, step back, follow-through, settle */
  const KN = new Map();
  function recoil(o) {
    const id = o.who || "me", k = o.knock; let r = KN.get(id);
    if (!r || k > r.last + 0.25) { r = { peak: k, last: k }; KN.set(id, r); }
    r.last = k;
    const hard = r.peak >= 13, t = Math.log(Math.max(1, r.peak / Math.max(1e-3, k))) / 7, C = D.CLIPS[hard ? "stagger" : "hit"];
    return { hard, u: clamp(t / C.len, 0, 1) };
  }
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
        const C = D.CLIPS[name], B = sample(name, C.nowarp ? o.mu : warp(o.mu, o.hitU, C.hit)), pw = o.power ? 1.3 : 1;
        P.fn = [B.fn[0] * (B.fn[0] > 6 ? pw : 1), B.fn[1]]; P.ff = B.ff; P.dy = B.dy * pw; P.hipx = B.hipx * pw; P.tilt = B.tilt; P.ox = B.ox;
        P.lean = P.lean * 0.7 + B.lean * 0.5 * pw; clipName = name;
        if (name === "cast") { P.cast = B.cast; hand = "open"; }
        if (C.arms) {   // swings and the bow play their own arm path (the contact still lands on the scene's hit frame)
          P.aim = B.aim; P.back = B.back; P.hk = B.hk; P.hx = B.hx; P.hy = B.hy; P.twist = B.twist * (o.power ? 1.2 : 1); P.loose = B.loose;
          if (C.bow) P.draw = B.draw;
        }
      } else if (!(lunge > 0.05)) {   // standing: breathing
        const B = sample("idle", (o.t || 0) / D.CLIPS.idle.len);
        P.dy = B.dy; P.tilt = B.tilt; P.lean += B.lean; clipName = "idle";
      }
    }
    if (o.knock > 0.3 && !(o.down > 0)) {   // just hit: the reaction plays in real time from the blow (see recoil)
      const R = recoil(o), H = sample(R.hard ? "stagger" : "hit", R.u), w = clamp((1 - R.u) * 4, 0, 1);
      const keep = { ox: P.ox };
      P = mix(P, H, w); P.ox = keep.ox + (H.ox || 0) * w * 0.5;   // the scene already pushes the whole figure back
    } else if (o.knock != null) KN.delete(o.who || "me");
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
    const tw = P.twist || 0;   // the shoulders turning: the near one back and the far one forward (-), or the other way (+)
    const W = add(H, rot(pa, G.waist)), S = add(W, rot(sa, [G.sh[0] + tw * 1.4 * m, G.sh[1]])), SF = add(S, rot(sa, [(2.4 - tw * 2.2) * m, -0.4 * m])), N = add(W, rot(sa, [G.nk[0] + tw * 0.4 * m, G.nk[1]]));
    const ka = (G.upper + G.fore) / 21.6, aim = P.aim, bk = P.back, hk = clamp(P.hk || 0, 0, 1);
    let hn = add(S, rot(sa, [ka * (3 + Math.cos(aim) * 11 - Math.sin(aim) * 6), ka * (4 + Math.sin(aim) * 11 + Math.cos(aim) * 6)]));
    if (hk > 0) { const own = add(S, rot(sa, [ka * (P.hx || 0), ka * (P.hy || 0)])); hn = [hn[0] + (own[0] - hn[0]) * hk, hn[1] + (own[1] - hn[1]) * hk]; }   // the hand on its own path
    if (P.nearHand) hn = P.nearHand;
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
  function limbAt(g, ctx, part, v, a, b, from) {
    const q = ctx.Q[part], img = pic(ctx.r, part, v, q.w * ctx.G.u * ctx.dev), axis = Math.atan2(q.e[1] - q.p[1], q.e[0] - q.p[0]), ang = angOf(a, b);
    if (from) {   // [rigcohesion] a bent elbow or knee: the limb's top end once more, turned halfway back toward the bone above and kept to a disc round the joint, so the outside of the bend shows no notch
      const par = angOf(from, a); let d = ang - par; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) > 0.18) {
        const r = Math.min(q.w, Math.abs(q.e[0] - q.p[0]) + q.w * 0.5) * 0.42 * ctx.G.u;
        g.save(); g.beginPath(); g.arc(a[0], a[1], r, 0, TAU); g.clip(); put(g, img, q, ctx.G.u, a[0], a[1], par + d * 0.5 - axis); g.restore();
      }
    }
    put(g, img, q, ctx.G.u, a[0], a[1], ang - axis);
  }
  /* [rigcohesion] an upright part drawn in pieces: R = [[x0, y0, x1, y1, k, ky], ...] in the part's measured pixels; a piece
     with k is sheared about row ky (hair, braids, belt flaps and fur swinging), so it stays joined to the row above it */
  function putR(g, img, q, u, x, y, a, R) {
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight, fx = iw / q.w, fy = ih / q.h;
    g.save(); g.translate(x, y); if (a) g.rotate(a);
    for (const r of R) {
      const x0 = Math.max(0, r[0]), y0 = Math.max(0, r[1]), x1 = Math.min(q.w, r[2]), y1 = Math.min(q.h, r[3]), k = r[4] || 0;
      if (x1 - x0 < 0.5 || y1 - y0 < 0.5) continue;
      if (k) { g.save(); g.transform(1, 0, k, 1, -k * (r[5] - q.p[1]) * u, 0); }
      g.drawImage(img, x0 * fx, y0 * fy, (x1 - x0) * fx, (y1 - y0) * fy, (x0 - q.p[0]) * u, (y0 - q.p[1]) * u, (x1 - x0) * u, (y1 - y0) * u);
      if (k) g.restore();
    }
    g.restore();
  }
  /* a head in pieces: the hair and braids hanging behind the neck swing with k; layer "back" is only what hangs below
     the collar cut (drawn behind the torso, so long braids are never cut off at the collar), "front" the rest */
  function headR(q, k, layer) {
    const cut = q.cut || q.h, nb = q.p[0] - (q.nw || q.w * 0.35) * 0.5, ky = q.p[1] - (q.nw || 100) * 0.25;
    if (layer === "back") return cut < q.h ? [[0, cut, nb, q.h, k, ky]] : [];
    return [[0, 0, q.w, Math.min(ky, cut) + 1], [0, ky, nb, cut, k, ky], [nb - 1, ky, q.w, cut]];
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
    limbAt(g, ctx, "forearm", v, arm.el, arm.wr, arm.sh);
    return handPart ? handAt(g, ctx, arm, handPart, handV, want) : null;
  }
  function legAt(g, ctx, L, v) {
    limbAt(g, ctx, "thigh", v, L.hip, L.knee);
    uprightAt(g, ctx, "foot", v, L.ankle, L.toe);
    limbAt(g, ctx, "shin", v, L.knee, L.ankle, L.hip);
  }
  function flaskAt(g, x, y, col, k) {
    g.save(); g.translate(x, y); g.scale(k, k);
    g.beginPath(); g.moveTo(-1.6, -1); g.lineTo(1.6, -1); g.lineTo(2, -4.6); g.lineTo(0.5, -5.6); g.lineTo(0.5, -7); g.lineTo(-0.5, -7); g.lineTo(-0.5, -5.6); g.lineTo(-2, -4.6); g.closePath();
    g.fillStyle = col; g.fill(); g.strokeStyle = "rgba(30,20,12,0.8)"; g.lineWidth = 0.4; g.stroke(); g.restore();
  }
  const WSC = 1.18;
  const TIPS = new Map(); let drawN = 0;   // the last blade tip drawn for each fighter (PAINTRIG.tip)   // weapons a touch bigger than on the ink figures: painted hands are big
  function figure(g, ctx, P, sp, o, wk) {
    const G = ctx.G, m = G.m, B = solve(G, P), kit = ctx.kit, st = ctx.st;
    const tintC = sp.r && sp.r !== "nord" && !sp.vamp ? sp.skin : null, sv = (d) => (tintC ? (d ? "dt:" : "t:") + tintC : d ? "d" : "n");
    const rh = raceHead(sp);
    const ranged = RANGED.has(wk), two = TWO_MELEE.has(wk) || wk === "staff" || wk === "spear";
    const tipA = wk && kit && kit.TIP[wk] ? Math.atan2(kit.TIP[wk][1], kit.TIP[wk][0]) : -Math.PI / 4;
    let wa = B.sa + P.aim;   // the weapon's frame, as on the ink figures
    const gear = typeof RIGGEAR !== "undefined" ? RIGGEAR : null;
    const armedN = !!wk && wk !== "fist" && !P.flask, openAll = P.hand === "open";
    const glowC = o.glow ? sp.ench || "#7fb6ff" : null, castC = wk === "staff" ? sp.staffC : sp.ench || "#9fd0f0";
    // where the far hand goes when it helps: on the bow string, under a crossbow, low on a two-handed grip
    const nearGrip = () => { const q = ctx.Q["hand-fist"], len = Math.hypot(q.e[0] - q.p[0], q.e[1] - q.p[1]) * G.u * 0.55, wr = B.armN.wr, fa = angOf(B.armN.el, wr); return [wr[0] + Math.cos(fa) * len, wr[1] + Math.sin(fa) * len]; };
    let farOn = null, bowPull = null, bowArrow = false;
    if (wk === "bow" && gear && !P.ride && !(P.down > 0) && !openAll) {
      /* a real draw: the bow arm goes out straight from the shoulder at cheek height, the string hand pulls back to the
         cheek, the arrow runs level from the cheek to the bow; on the loose the string hand flies back past the ear */
      const r = clamp((-(P.back || 0) - 0.25) / 0.6, 0, 1), dr = clamp(P.draw || 0, 0, 1), ls = clamp(P.loose || 0, 0, 1);
      const reach = (G.upper + G.fore) * 0.985, cheek = add(B.N, rot(B.sa, [2.6 * m, -2.4 * m]));
      if (r > 0) {
        const A = Math.asin(clamp((cheek[1] + 0.6 * m - B.S[1]) / reach, -0.9, 0.9)) + (P.aim || 0) * 0.5;
        const want = add(B.S, [Math.cos(A) * reach, Math.sin(A) * reach]), h0 = B.armN.wr;
        P.nearHand = [h0[0] + (want[0] - h0[0]) * r, h0[1] + (want[1] - h0[1]) * r];
        Object.assign(B, solve(G, P));
        const gp = nearGrip(); let d = angOf(cheek, gp) - wa; d = Math.atan2(Math.sin(d), Math.cos(d)); wa += d * r;
        const gp2 = nearGrip(), k = m * WSC, rest = add(gp2, rot(wa, [-gear.BRACE * k, 0]));
        let str = [rest[0] + (cheek[0] - rest[0]) * dr, rest[1] + (cheek[1] - rest[1]) * dr];
        bowPull = Math.hypot(gp2[0] - str[0], gp2[1] - str[1]) / k; bowArrow = dr > 0.4;   // the arrow shows once it is half drawn
        if (ls > 0) { const fly = add(cheek, rot(wa, [-6 * m, -1.6 * m])); str = [str[0] + (fly[0] - str[0]) * ls, str[1] + (fly[1] - str[1]) * ls]; }
        const q = ctx.Q["hand-fist"], len = Math.hypot(q.e[0] - q.p[0], q.e[1] - q.p[1]) * G.u * 0.55;
        if (r > 0.05 || dr > 0.05) farOn = add(str, rot(wa, [-len, 0]));
      }
    } else if (!P.ride && !(P.down > 0) && !openAll) {
      if (wk === "bow" && (P.back < -0.5 || P.draw > 0.05)) farOn = add(nearGrip(), rot(wa, [(2.9 - P.draw * 13) * m * WSC, 0]));
      else if (wk === "crossbow") farOn = add(nearGrip(), rot(wa, [7 * m * WSC, 1.5 * m]));
      else if (two && !o.shield) farOn = add(nearGrip(), rot(wa + tipA, [-4.5 * m * WSC, 0]));
    }
    if (farOn) { P.farHand = farOn; Object.assign(B, solve(G, P)); }
    const shieldOn = !!o.shield && !two && !ranged, shieldFront = shieldOn && (P.front || P.back < -0.8);
    const kS = m * 1.35;
    const shieldHere = (front) => { if (!kit) return; const wr = B.armF.wr; g.save(); g.translate(wr[0], wr[1]); g.rotate(B.sa); g.scale(kS, kS); if (gear) gear.shield(g, sp, front, st); else kit.shieldAt(g, sp, 0, 0, front, st); g.restore(); };
    // the far arm, in shade, behind everything
    const farPart = shieldOn || o.off || farOn ? "hand-fist" : "hand-open";
    const fg = armAt(g, ctx, B.armF, "d", farPart, sv(true), farOn && wk === "bow" ? wa : null);
    if (o.off && kit) { g.save(); g.translate(fg[0], fg[1]); g.rotate(B.sa + 0.55 + (o.lunge || 0) * 0.7); g.scale(m * WSC, m * WSC); (gear || kit).weapon(g, sp, o.off, st, { plain: true, glow: glowC }); g.restore(); }
    if (shieldOn && !shieldFront) shieldHere(false);
    if (P.cast > 0.05 && kit) kit.glowAt(g, fg[0], fg[1], (5 + P.cast * 3) * m, castC, 0.75, st);
    // legs: the far one in shade (in the saddle only the near leg shows, bent over the horse's flank)
    if (P.ride) {
      const q = ctx.Q["leg-bent"], hip = add(B.H, [0.6 * m, 0]);
      if (q.noBoot) {   // [rigcohesion] a bent-leg picture with no boot (the women's leather): the thigh, shin and boot, folded over the horse's flank
        const want = add(hip, rot(B.pa, [0.16 * G.thigh, 0.6 * (G.thigh + G.shin)])), [kn, an] = ik(hip[0], hip[1], want[0], want[1], G.thigh, G.shin, -1);
        legAt(g, ctx, { hip, knee: kn, ankle: an, toe: 0.05 }, "n");
      } else uprightAt(g, ctx, "leg-bent", "n", hip, B.pa - 0.12, 0);
    } else { legAt(g, ctx, B.legF, "d"); legAt(g, ctx, B.legN, "n"); }
    // the body: torso (its waist plug hidden), the hips over it, then the head
    const hk = B.sa * 0.55 + (P.tilt || 0), sw = ctx.sway ? ctx.sway.a : 0;
    // the head: the race's own (scaled so its neck fills this set's collar like the Nord neck) or the set's; its braids below the collar go behind the torso
    const hq = rh ? rh.Q.head : ctx.Q.head, hu = rh ? G.u * (ctx.Q.head.nw || hq.nw) / hq.nw : G.u, himg = rh ? pic(rh, "head", "n", hq.w * hu * ctx.dev) : pic(ctx.r, "head", sv(false), hq.w * hu * ctx.dev);
    const hairK = clamp(sw - hk * 0.4, -0.45, 0.45);   // hair hangs: it keeps to the vertical a little as the head turns
    putR(g, himg, hq, hu, B.N[0], B.N[1], hk, headR(hq, hairK, "back"));
    uprightAt(g, ctx, "torso", "n", B.W, B.sa, ctx.Q.torso.cut);
    { const q = ctx.Q.pelvis, ky = q.hip[1] - 10; putR(g, pic(ctx.r, "pelvis", "n", q.w * G.u * ctx.dev), q, G.u, B.W[0], B.W[1], B.pa, [[0, 0, q.w, ky + 1], [0, ky, q.w, q.h, clamp(sw * 0.55 - B.pa * 0.3, -0.25, 0.25), ky]]); }   // belt flaps, pouches and fur swing a little
    putR(g, himg, hq, hu, B.N[0], B.N[1], hk, headR(hq, hairK, "front"));
    if (shieldFront) shieldHere(true);
    // the near arm: upper arm, forearm, then whatever is in the hand, then the hand over its grip
    limbAt(g, ctx, "uparm", "n", B.armN.sh, B.armN.el);
    limbAt(g, ctx, "forearm", "n", B.armN.el, B.armN.wr, B.armN.sh);
    const handPart = openAll || (!armedN && !P.flask && P.cast > 0.05) ? "hand-open" : armedN || P.flask ? "hand-fist" : "hand-open";
    const want = armedN ? (ranged ? wa : wa + tipA + Math.PI / 2) : null;
    // the grip point comes from the hand's angle, so work it out first, draw the weapon, then the hand on top
    const q = ctx.Q[handPart], fa = angOf(B.armN.el, B.armN.wr);
    let ha = fa; if (want != null) { let d = want - fa; d = Math.atan2(Math.sin(d), Math.cos(d)); ha = fa + clamp(d, -1, 1); }
    const glen = Math.hypot(q.e[0] - q.p[0], q.e[1] - q.p[1]) * G.u * 0.55, grip = [B.armN.wr[0] + Math.cos(ha) * glen, B.armN.wr[1] + Math.sin(ha) * glen];
    if (armedN && kit && !openAll) { g.save(); g.translate(grip[0], grip[1]); g.rotate(wa); g.scale(m * WSC, m * WSC); (gear || kit).weapon(g, sp, wk, st, { draw: P.draw, pull: bowPull, arrow: bowArrow, glow: glowC, plain: wk !== sp.wk }); g.restore(); }
    if (armedN && !openAll && !ranged && kit && kit.TIP[wk]) {   // where the blade really is (the fight scene's swing trail follows it), in canvas pixels
      const SP = (gear && gear.SPAN) || {}, GR = (gear && gear.GRIP) || {}, L = (SP[wk] || 33) * (1 - (GR[wk] || 0.16)) * m * WSC, a = wa + tipA;
      const T = g.getTransform(), at = (x, y) => [T.a * x + T.c * y + T.e, T.b * x + T.d * y + T.f];
      const tp = at(grip[0] + Math.cos(a) * L, grip[1] + Math.sin(a) * L), bs = at(grip[0] + Math.cos(a) * L * 0.42, grip[1] + Math.sin(a) * L * 0.42), gp = at(grip[0], grip[1]);
      TIPS.set(o.who || "me", { x: tp[0], y: tp[1], bx: bs[0], by: bs[1], gx: gp[0], gy: gp[1], n: ++drawN });   // gx,gy: the grip (fightart.js lays an enchanted weapon's glow from here to the tip)
    }
    handAt(g, ctx, B.armN, handPart, sv(false), want);
    if (P.flask) flaskAt(g, grip[0], grip[1] - 0.5 * m, P.flask, m * 1.2);
    if (P.cast > 0.05 && kit) kit.glowAt(g, grip[0] + 1.6 * m, grip[1] - 0.6 * m, (5 + P.cast * 3.4) * m, castC, 0.85, st);
    return B;
  }
  /* [rigcohesion] secondary motion: one damped spring per fighter, driven by how fast the neck moves (the step in, the
     lunge, the lean, the scene moving the figure: o.dx) and kicked by a blow. Its angle swings the hair and braids, the
     belt flaps and fur (k > 0: the loose ends swing forward). No clock (o.t), no swing. */
  const SW = new Map();
  function sway(id, o, P) {
    const t = o.t, x = (o.dx || 0) + (P.ox || 0) + (P.hipx || 0) + (P.fn[0] + P.ff[0]) * 0.3 + (P.lean || 0) * 32 + (o.lunge || 0) * 6;
    let s = SW.get(id);
    if (!s) { s = { x, t, a: 0, v: 0, kn: 0 }; SW.set(id, s); if (SW.size > 24) SW.delete(SW.keys().next().value); }
    if (t == null || !(t > 0)) { s.a = 0; s.v = 0; s.x = x; s.t = t; return s; }
    const dt = t - s.t;
    if (!(dt > 0) || dt > 0.3) { s.x = x; s.t = t; return s; }
    const vx = clamp((x - s.x) / dt, -260, 260); s.x = x; s.t = t;
    const k = o.knock || 0; if (k > s.kn + 0.25) s.v += Math.min(5, k * 0.28); s.kn = k;   // a blow throws the body back: the loose ends fly forward
    const want = clamp(-vx * 0.0055, -0.32, 0.32) + Math.sin(t * 1.25 + (id.length || 0)) * 0.025, w = 10, z = 0.3;
    for (let left = Math.min(dt, 0.1); left > 1e-4; left -= 1 / 120) {
      const h = Math.min(1 / 120, left); s.v += (w * w * (want - s.a) - 2 * z * w * s.v) * h; s.a = clamp(s.a + s.v * h, -0.45, 0.45);
    }
    return s;
  }
  /* [rigcohesion] contact shadows (riglook.js), in figure units on the ground line: a faint one under the body, a
     darker soft one under each boot (lighter as the foot lifts); lying down, one long shadow under the body */
  function shadows(g, sp, P) {
    const L = LOOK(); if (!L || P.ride) return;
    const f = P.rot ? Math.min(1, Math.abs(P.rot) / (Math.PI / 2)) : 0, bw = sp.bw || 1;
    const hx = ((P.ox || 0) + (P.hipx || 0) + (P.fn[0] + P.ff[0]) * 0.3) * bw, bx = hx * (1 - f) - 6 * f;
    L.shadow(g, bx + 1, 0.3, (17 + 16 * f) * bw, 3.6 + 1.4 * f, 0.62);
    if (f < 0.6) for (const ft of [P.fn, P.ff]) {
      const lift = clamp(-ft[1] / 6, 0, 1), sz = 1 - lift * 0.35;
      L.shadow(g, (ft[0] + 2.4) * bw, 0.5, 7.5 * sz * bw, 2.3 * sz, 0.9 * (1 - lift * 0.8) * (1 - f / 0.6));
    }
  }
  /* draw a posed figure: g is in figure units (feet at 0,0, ~61 tall) */
  function render(g, r, sp, P, o, wk, sw) {
    const G = r.G, kN = 1 / G.m, kit = typeof FIGART !== "undefined" ? FIGART.kit : null;
    g.save();
    shadows(g, sp, P);
    if (P.rot) {   // lying down: turned about the feet, then laid on the ground (on the back, head away from the foe)
      const f = Math.min(1, Math.abs(P.rot) / (Math.PI / 2));
      g.translate(24 * f, -10 * f); g.rotate(P.rot);
    }
    g.scale(kN * (sp.bw || 1), kN * (sp.bh || 1));
    const dev0 = kit ? kit.devScale(g) : 1;
    const ctx = { r, G, Q: G.P, dev: dev0, kit, sway: sw || null, st: kit ? kit.styleOf(Math.max(0.25, Math.round(dev0 * G.m * 4) / 4)) : null };
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
      TIPS.delete(o.who || "me");
      const P = controls(o, sp, wk);
      P.flask = o.flask || null; P.down = o.down || 0;
      render(g, r, sp, P, o, wk, sway(o.who || String(look.id), o, P));
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
  /* the blade of the figure last drawn for who ("me" by default): tip x,y and a point 42% up the blade (bx,by), in the
     canvas's pixels at draw time; n counts draws, so a caller can tell a fresh one (null: no blade) */
  const tip = (who) => TIPS.get(who || "me") || null;
  return { setOf, geo, raceHead, tip, can, fight, draw, sample, warp, controls, solve, ready, get broken() { return broken; }, reset: () => { broken = false; REC.clear(); HREC.clear(); } };
})();
if (typeof module !== "undefined") module.exports = PAINTRIG;
