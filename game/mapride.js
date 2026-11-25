/* MAPRIDE: the mounted hero on the world map. [OURS]
   A light horse rig drawn by code (body, neck, head, mane, tail, four legs of two bones each, saddle, bridle and reins)
   posed from a few key poses per gait and blended, with the hero sitting on it: the hero's real painted figure (rig.js:
   race head or helmet, armour, shield, weapon, cloak; the ink figure until the painted parts load), drawn once per look
   and size into a small picture and reused every frame, seated on the saddle so it moves with the horse's back.
   On foot the map uses the same painted figure walking / standing (MAPRIDE.walker), so the map always shows the hero as
   they look now.

   Gaits (GAITS): idle (3 poses over 2.8 s: breathing, a head nod, a tail flick), walk (8 poses, 1.1 s, four beats, head
   bob), trot (4 poses, 0.65 s, diagonal pairs, the rider bounces), gallop (6 poses, 0.45 s, a long stride with a moment
   when all four hooves are off the ground, the rider leans forward). Which one comes from the real travel pace (pick):
   pace = how fast you are going compared with walking on open ground (a horse on a road ≈ 2.3), with ~10% hysteresis so
   the horse doesn't flicker between two gaits at a border. A change blends over 0.2 s (stopping: 0.25 s, the stride
   shortens and the head comes up). Hooves on the ground move back at the stride's pace, so they don't slide; the cadence
   follows the pace a little (±20%). Each horse has its own phase (offset(id)), so a party doesn't march in lockstep.
   Turning round takes 0.18 s. Reduce motion: one still pose per gait, no bob or bounce.

   API: MAPRIDE.pick(prev, moving, pace) → "idle" | "walk" | "trot" | "gallop"
        MAPRIDE.step(st, { moving, pace, t, id }) → { gait, from, w, c } (st: a per-hero object kept by the caller)
        MAPRIDE.pose(gait, c) → the pose at c (0..1 through the cycle) · MAPRIDE.mix(a, b, w) → blended pose
        MAPRIDE.offset(id) → 0..1 phase offset · MAPRIDE.hooves(pose) → hoof heights (tests: who's on the ground)
        MAPRIDE.mounted(g, x, y, k, o) → { top, head }: horse and rider, hooves at x,y; k = canvas units per horse unit
          o = { look, coat (colour), st, flip, t, moving, pace, reduce, simple, id, noRider }
        MAPRIDE.walker(g, look, x, y, h, o) → true when it drew the painted figure on foot ({ clip: "walk" | "idle", u, flip })
        MAPRIDE.seat → horse units: the saddle seat height (callers place things over the rider) */
const MAPRIDE = (() => {
  const TAU = Math.PI * 2, clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, w) => a + (b - a) * w;
  const smooth = (x) => x * x * (3 - 2 * x);
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;

  // ---------------------------------------------------------------- gaits
  /* per gait: seconds per stride, how many key poses, how long each hoof stays down (duty), stride length and hoof lift
     (horse units), when each hoof lands (nf near fore, nh near hind, ff far fore, fh far hind), and the pace it is timed for */
  const GAITS = {
    idle: { per: 2.8, n: 3, duty: 1, stride: 0, lift: 0, land: { nf: 0, nh: 0, ff: 0, fh: 0 }, ref: 0 },
    walk: { per: 1.1, n: 8, duty: 0.64, stride: 13, lift: 4.5, land: { nh: 0, nf: 0.25, fh: 0.5, ff: 0.75 }, ref: 0.9 },
    trot: { per: 0.65, n: 4, duty: 0.42, stride: 17, lift: 6.5, land: { nh: 0, ff: 0, fh: 0.5, nf: 0.5 }, ref: 1.5 },
    gallop: { per: 0.45, n: 6, duty: 0.3, stride: 30, lift: 8, land: { fh: 0, nh: 0.1, ff: 0.33, nf: 0.43 }, ref: 2.4 },
  };
  /* pace thresholds going up; going down a gait holds on until 90% of its own threshold */
  const TH = { trot: 1.1, gallop: 2.0 }, HYST = 0.9, MOVE_MIN = 0.02;
  function pick(prev, moving, pace) {
    if (!moving || !(pace > MOVE_MIN)) return "idle";
    let g = pace >= TH.gallop ? "gallop" : pace >= TH.trot ? "trot" : "walk";
    if (prev === "gallop" && g !== "gallop" && pace >= TH.gallop * HYST) g = "gallop";
    else if ((prev === "trot" || prev === "gallop") && g === "walk" && pace >= TH.trot * HYST) g = "trot";
    return g;
  }
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const offset = (id) => (hash(id || "me") % 997) / 997;
  const BLEND = 0.2, STOP = 0.25, TURN = 0.18;
  /* how fast the cycle turns at this pace: the gait's own beat, nudged up or down with the pace */
  const rateOf = (gait, pace) => { const G = GAITS[gait]; return (1 / G.per) * (G.ref ? clamp((pace || G.ref) / G.ref, 0.85, 1.2) : 1); };
  function step(st, { moving, pace, t, id }) {
    t = +t || 0;
    if (st.c0 == null) { st.gait = pick(null, moving, pace); st.from = null; st.since = -99; st.c0 = offset(id); st.t0 = t; st.rate = rateOf(st.gait, pace); }
    const g = pick(st.gait, moving, pace);
    if (g !== st.gait) { st.from = st.gait; st.since = t; st.gait = g; }
    const len = st.gait === "idle" ? STOP : BLEND, w = st.from ? clamp((t - st.since) / len, 0, 1) : 1;
    if (w >= 1) st.from = null;
    // the cycle: c = c0 + (t - t0)·rate, re-anchored whenever the rate changes, so it never jumps
    const want = st.from ? lerp(rateOf(st.from, pace), rateOf(st.gait, pace), w) : rateOf(st.gait, pace);
    if (Math.abs(want - st.rate) > 1e-4) { st.c0 = st.c0 + (t - st.t0) * st.rate; st.t0 = t; st.rate = want; }
    const c = ((st.c0 + (t - st.t0) * st.rate) % 1 + 1) % 1;
    return { gait: st.gait, from: st.from, w, c };
  }

  // ---------------------------------------------------------------- key poses
  /* the body's key poses per gait (bob: up -, pitch: nose down +, neck / head: turn forward-down +, tail: lift +,
     ry: the rider's bounce, lean: the rider leaning forward); built once from a few curves, then eased between */
  const KEY = (gait, u) => {
    const s = Math.sin, c = TAU * u;
    if (gait === "idle") return [   // breathe in (chest up, head up), breathe out with a nod, a flick of the tail
      { bob: 0, pitch: 0, neck: 0, head: 0, tail: 0, ry: 0, lean: 0, cock: 0 },
      { bob: -0.45, pitch: -0.012, neck: -0.05, head: -0.08, tail: 0.1, ry: -0.35, lean: -0.01, cock: 1 },
      { bob: 0.2, pitch: 0.01, neck: 0.1, head: 0.14, tail: -0.32, ry: 0.15, lean: 0.01, cock: 0.4 },
    ][Math.round(u * 3) % 3];
    if (gait === "walk") return { bob: 0.55 * s(2 * c), pitch: 0.012 * s(c), neck: 0.06 * s(2 * c + 0.6), head: 0.06 * s(2 * c + 1), tail: 0.07 * s(c + 0.5), ry: 0.5 * s(2 * c - 0.7), lean: 0.03, cock: 0 };
    if (gait === "trot") return { bob: 1.3 * s(2 * c), pitch: 0.008 * s(2 * c), neck: 0.03 * s(2 * c), head: 0.03 * s(2 * c + 0.5), tail: 0.25 + 0.06 * s(2 * c), ry: 1.6 * s(2 * c - 0.9), lean: 0.06, cock: 0 };
    return { bob: -1.2 + 2.6 * s(c + 0.6), pitch: 0.075 * s(c + 1.3), neck: -0.12 + 0.16 * s(c + 0.4), head: -0.25 + 0.08 * s(c + 0.9), tail: 0.85 + 0.15 * s(c + 2.4), ry: 1.2 * s(c - 0.4), lean: 0.2 + 0.04 * s(c), cock: 0 };
  };
  const KEYS = {};
  for (const g of Object.keys(GAITS)) KEYS[g] = Array.from({ length: GAITS[g].n }, (_, i) => KEY(g, i / GAITS[g].n));
  const FIELDS = ["bob", "pitch", "neck", "head", "tail", "ry", "lean", "cock"];
  /* where each hoof is (x from its rest spot, y up -) at c through the stride: down and sliding back with the ground,
     then up and forward in an arc */
  function hoof(G, leg, c) {
    if (!G.stride) return [0, 0];
    const p = ((c - G.land[leg]) % 1 + 1) % 1;
    if (p < G.duty) return [G.stride * (0.5 - p / G.duty), 0];
    const q = (p - G.duty) / (1 - G.duty);
    return [G.stride * (-0.5 + smooth(q)), -G.lift * Math.sin(Math.PI * q) * (leg[1] === "f" ? 1 : 0.8)];
  }
  const LEGS = ["nf", "nh", "ff", "fh"];
  function pose(gait, c) {
    const G = GAITS[gait] || GAITS.idle, K = KEYS[gait] || KEYS.idle, n = K.length;
    c = ((c % 1) + 1) % 1;
    const f = c * n, i = Math.floor(f) % n, j = (i + 1) % n, w = smooth(f - Math.floor(f)), P = { gait };
    for (const k of FIELDS) P[k] = lerp(K[i][k], K[j][k], w);
    for (const leg of LEGS) P[leg] = hoof(G, leg, c);
    if (P.cock) P.nh = [P.nh[0] + 0.8 * P.cock, P.nh[1] - 1.3 * P.cock];   // standing: resting a hind hoof on its toe now and then
    return P;
  }
  function mix(a, b, w) {
    const P = { gait: w < 0.5 ? a.gait : b.gait };
    for (const k of FIELDS) P[k] = lerp(a[k], b[k], w);
    for (const leg of LEGS) P[leg] = [lerp(a[leg][0], b[leg][0], w), lerp(a[leg][1], b[leg][1], w)];
    return P;
  }
  const hooves = (P) => LEGS.map((l) => P[l][1]);

  // ---------------------------------------------------------------- colours
  const hex = (c) => {
    const s = String(c || ""), m = /^#?([0-9a-f]{6})$/i.exec(s);
    if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
    const r = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(s);
    return r ? [+r[1], +r[2], +r[3]] : [138, 90, 59];
  };
  const shade = (c, k) => { const [r, g, b] = hex(c), t = k < 0 ? 0 : 255, a = Math.abs(k); return `rgb(${Math.round(r + (t - r) * a)},${Math.round(g + (t - g) * a)},${Math.round(b + (t - b) * a)})`; };
  const TONES = new Map();
  function tones(coat) {
    coat = coat || "#8a5a3b";   // no coat given: a bay
    let T = TONES.get(coat); if (T) return T;
    const [r, g, b] = hex(coat), light = (r + g + b) / 3;
    const hair = light > 200 ? "#cfc8ba" : light > 145 && r > b + 60 ? "#f1e6c6" : light > 130 ? shade(coat, -0.5) : shade(coat, -0.55);   // white: greyish, palomino: cream
    T = { base: coat, dark: shade(coat, -0.3), far: shade(coat, -0.36), light: shade(coat, 0.22), hair, hairFar: shade(hair, -0.3), patch: /^#b77d52$/i.test(coat) ? "#efe8da" : null };
    TONES.set(coat, T); return T;
  }
  const INK = "rgba(30,21,13,0.92)", HOOF = "#2a2018", LEATHER = "#4a2e1a", LEATHER2 = "#6b4428", CLOTH = "#7a2b22", CLOTH2 = "#c9a24a";

  // ---------------------------------------------------------------- the horse (horse units: hooves on y 0, facing right)
  const SEAT = [0, -44], PIV = [0, -34], NECK = [16, -40];
  const FJ = [13, -28], HJ = [-14, -30];   // where the fore and hind legs hang from
  const LEG = { f: [13, 13], h: [15, 14] };
  /* two-bone reach: the joint between a and b (side +1: joint behind, the hock; -1: in front, the knee) */
  function ik(a, b, l1, l2, side) {
    let dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1e-6;
    const dd = Math.min(d, l1 + l2 - 1e-3); dx /= d; dy /= d;
    const along = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    return [a[0] + dx * along - dy * h * side, a[1] + dy * along + dx * h * side];
  }
  const rotAbout = (p, o, a) => { const c = Math.cos(a), s = Math.sin(a), x = p[0] - o[0], y = p[1] - o[1]; return [o[0] + x * c - y * s, o[1] + x * s + y * c]; };
  const line = (g, a, b) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
  /* one leg: from the body (hip / shoulder) to the hoof (on the ground or swinging); far legs in shade. The ink goes
     under every bone first and the colour over it, so the joints read as one leg, not a string of sticks */
  function leg(g, T, P, id, body, simple) {
    const fore = id[1] === "f", far = id[0] === "f", top0 = fore ? FJ : HJ, [l1, l2] = LEG[fore ? "f" : "h"];
    const top = body([top0[0] + (far ? 2 : 0), top0[1] + (far ? -0.6 : 0)]);
    const hx = P[id][0] + top0[0] + (far ? 2 : 0) + (fore ? 1 : 0), hy = P[id][1] + (far ? -0.5 : 0);
    const up = clamp(-P[id][1] / 6, 0, 1), fold = (fore ? 1 : -0.6) * up;   // a lifted fore hoof folds back under the knee
    const fet = [hx - Math.sin(fold) * 3.4, hy - Math.cos(fold) * 3.4], toe = [hx + (fore ? 0.4 : -0.2), hy - 0.5];
    const mid = ik(top, fet, l1, l2, fore ? -1 : 1), col = far ? T.far : T.base, wU = fore ? 4.8 : 5.6, wL = simple ? 2.8 : 2.6;
    const top2 = [top[0], top[1] - 3];   // the upper leg starts inside the body, so no gap opens when it swings
    g.strokeStyle = INK; g.lineWidth = wU + 1.4; line(g, [top[0] + (mid[0] - top[0]) * 0.35, top[1] + (mid[1] - top[1]) * 0.35], mid); g.lineWidth = wL + 1.4; line(g, mid, fet); line(g, fet, toe);
    g.strokeStyle = col; g.lineWidth = wU; line(g, top2, mid); g.lineWidth = wL; line(g, mid, fet);
    g.strokeStyle = far ? T.far : T.dark; g.lineWidth = 2.1; line(g, fet, toe);
    g.fillStyle = HOOF; g.beginPath(); g.moveTo(hx - 1.7, hy); g.lineTo(hx + 2.1, hy); g.lineTo(hx + 1.3, hy - 1.9); g.lineTo(hx - 1.3, hy - 1.9); g.closePath(); g.fill();
  }
  /* the body outline: croup, back, withers, chest, belly, buttock (body units, before the bob and pitch) */
  function bodyPath(g) {
    g.beginPath(); g.moveTo(-25, -41);
    g.bezierCurveTo(-24, -47.5, -14, -47.5, -8, -44.4);
    g.bezierCurveTo(-2, -42.8, 6, -43.4, 13, -46.2);
    g.lineTo(18, -43);
    g.bezierCurveTo(25, -39, 25.5, -29, 21, -25);
    g.bezierCurveTo(16, -21, 4, -22.5, -4, -22.2);
    g.bezierCurveTo(-12, -22, -19, -23, -22.5, -27);
    g.bezierCurveTo(-27.5, -31, -27.5, -37, -25, -41);
    g.closePath();
  }
  const poly = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
  function horse(g, coat, P, o = {}) {
    const T = tones(coat), simple = !!o.simple;
    const by = P.bob, pa = P.pitch;
    const body = (p) => { const q = rotAbout(p, PIV, pa); return [q[0], q[1] + by]; };
    const inBody = (fn) => { g.save(); g.translate(0, by); g.translate(PIV[0], PIV[1]); g.rotate(pa); g.translate(-PIV[0], -PIV[1]); fn(); g.restore(); };
    g.lineJoin = "round"; g.lineCap = "round";
    // far legs first, in shade, behind the body
    leg(g, T, P, "fh", body, simple); leg(g, T, P, "ff", body, simple);
    // the tail: from the croup, hanging back and down, lifting with the pace
    {
      const root = body([-24.5, -41.5]), a = 0.35 + P.tail, len = 21;
      const end = [root[0] - Math.sin(a) * len * 0.9 - 2, root[1] + Math.cos(a) * len], mid = [root[0] - 6 - P.tail * 3, root[1] + 4];
      g.beginPath(); g.moveTo(root[0], root[1]); g.quadraticCurveTo(mid[0], mid[1], end[0], end[1]);
      g.strokeStyle = INK; g.lineWidth = 5.2; g.stroke(); g.strokeStyle = T.hair; g.lineWidth = 3.9; g.stroke();
      if (!simple) { g.strokeStyle = T.hairFar; g.lineWidth = 1; g.beginPath(); g.moveTo(root[0] - 0.5, root[1] + 1.2); g.quadraticCurveTo(mid[0] + 0.7, mid[1] + 0.8, end[0] + 0.8, end[1] - 1.2); g.stroke(); }
    }
    // the neck and head turn about the base of the neck
    const nk = body(NECK), na = pa + P.neck, pollB = body(rotAbout([NECK[0] + 12, NECK[1] - 16], NECK, P.neck)), ha = 1.05 + P.head + pa + P.neck * 0.6;
    const H = (x, y) => [pollB[0] + x * Math.cos(ha) - y * Math.sin(ha), pollB[1] + x * Math.sin(ha) + y * Math.cos(ha)];
    const crestA = body([11, -46.4]), chest = body([22.5, -33]), throat = H(1, 4);
    const crestC = [(crestA[0] + pollB[0]) / 2 - 1.5 + 1.5 * Math.sin(na), (crestA[1] + pollB[1]) / 2 - 3.5];
    const neckPath = () => {
      g.beginPath(); g.moveTo(crestA[0], crestA[1]);
      g.quadraticCurveTo(crestC[0], crestC[1], pollB[0] - 1.5, pollB[1] - 1.8);
      g.lineTo(throat[0], throat[1]);
      g.quadraticCurveTo((throat[0] + chest[0]) / 2 + 2.5, (throat[1] + chest[1]) / 2, chest[0], chest[1]);
      g.lineTo(nk[0] - 6, nk[1] + 4); g.closePath();
    };
    const head = [H(-1.2, -3), H(8, -3.2), H(14.5, -2.3), H(16.4, 0.2), H(15, 2.6), H(9, 3.4), H(4, 5), H(-0.5, 3.6)];
    const ear = [H(-1.5, -2.5), H(-4.4, -6.8), H(0.6, -3.4)];
    // one silhouette: the ink round body, neck and head together, then their colour, so no seams show between them
    g.strokeStyle = INK; g.lineWidth = 2.2;
    inBody(() => { bodyPath(g); g.stroke(); }); neckPath(); g.stroke(); poly(g, head); g.stroke(); poly(g, ear); g.lineWidth = 1.6; g.stroke();
    g.fillStyle = T.dark; g.fill();
    g.fillStyle = T.base;
    inBody(() => {
      bodyPath(g); g.fill();
      if (!simple) {   // soft shade under the belly and light along the back
        g.save(); g.clip();
        const gr = g.createLinearGradient(0, -47, 0, -21); gr.addColorStop(0, "rgba(255,246,226,0.2)"); gr.addColorStop(0.45, "rgba(255,246,226,0)"); gr.addColorStop(0.7, "rgba(20,12,6,0)"); gr.addColorStop(1, "rgba(20,12,6,0.32)");
        g.fillStyle = gr; g.fillRect(-30, -50, 58, 30);
        if (T.patch) { g.fillStyle = T.patch; g.beginPath(); g.ellipse(-6, -29, 8, 5, 0.3, 0, TAU); g.fill(); g.beginPath(); g.ellipse(12, -36, 4, 3, -0.4, 0, TAU); g.fill(); }
        g.restore();
      }
    });
    g.fillStyle = T.base; neckPath(); g.fill(); poly(g, head); g.fill();
    if (!simple) { g.fillStyle = "rgba(20,12,6,0.18)"; poly(g, [H(9, 3.4), H(15, 2.6), H(16.4, 0.2), H(12, 0.6)]); g.fill(); }   // the muzzle a shade darker
    // the mane along the crest, falling a little over the near side
    g.strokeStyle = T.hair; g.lineWidth = simple ? 2.2 : 2.8; g.beginPath(); g.moveTo(crestA[0] + 0.3, crestA[1] + 0.8);
    g.quadraticCurveTo(crestC[0] - 0.2, crestC[1] + 1, pollB[0] - 1.6, pollB[1] - 1.1); g.stroke();
    if (!simple) {
      const eye = H(4, -1.2); g.fillStyle = "#120c08"; g.beginPath(); g.arc(eye[0], eye[1], 0.8, 0, TAU); g.fill();
      const nose = H(14.6, 0.3); g.fillStyle = "rgba(20,12,6,0.5)"; g.beginPath(); g.arc(nose[0], nose[1], 0.8, 0, TAU); g.fill();
      g.strokeStyle = LEATHER; g.lineWidth = 0.8; const b1 = H(11.5, -2.8), b2 = H(11, 3.1), c1 = H(1.5, -3), c2 = H(3, 4.2);
      g.beginPath(); g.moveTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]); g.moveTo(c1[0], c1[1]); g.lineTo(c2[0], c2[1]); g.moveTo(c1[0], c1[1]); g.lineTo(b1[0], b1[1]); g.stroke();
    }
    // saddle cloth, saddle and girth on the back
    if (!o.bare) inBody(() => {
      g.fillStyle = CLOTH; g.beginPath(); g.moveTo(-8, -44.6); g.lineTo(8, -45.2); g.lineTo(7.5, -36); g.lineTo(-7, -36); g.closePath(); g.fill();
      if (!simple) { g.strokeStyle = CLOTH2; g.lineWidth = 0.7; line(g, [7.2, -37.2], [-6.6, -37.2]); }
      g.strokeStyle = LEATHER; g.lineWidth = 1.4; line(g, [1, -37], [1.5, -22.5]);
      g.fillStyle = LEATHER2; g.strokeStyle = INK; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-7, -48); g.quadraticCurveTo(-5.5, -44.6, 0, -44.4); g.quadraticCurveTo(5, -44.6, 6.5, -47.5); g.lineTo(7.5, -46.5); g.lineTo(7, -42.8); g.lineTo(-6.5, -42.6); g.closePath(); g.fill(); g.stroke();
    });
    // the near legs over the body
    leg(g, T, P, "nh", body, simple); leg(g, T, P, "nf", body, simple);
    return { seat: body(SEAT), bit: H(12.5, 2.2), pitch: pa };
  }

  // ---------------------------------------------------------------- the rider (and the hero on foot): cached pictures
  const PICS = new Map(), MAX_PICS = 160;
  const RS = 0.95;   // the rider's size against the horse (horse units per figure unit)
  const HIP = [-2, -43], STIRRUP = [3.5, -21];   // figure units: where the rider's seat is, and the boot (a bent knee)
  function devScale(g) { try { const t = g.getTransform(); const s = Math.hypot(t.a, t.b); return isFinite(s) && s > 0 ? s : 1; } catch { return 1; } }
  const lookKey = (look) => { try { return FIGART.specOf(FIGART.lookFor({ look })).key; } catch { return JSON.stringify(look || {}); } };
  const painted = (look) => typeof PAINTRIG !== "undefined" && PAINTRIG.can(look);
  /* one picture: fn draws in figure units (feet at 0,0) into a box [x, y, w, h], scaled by px device pixels per unit */
  function pic(key, px, box, fn) {
    const id = `${key}|${Math.round(px * 16) / 16}`;
    let c = PICS.get(id);
    if (c) { PICS.delete(id); PICS.set(id, c); return c; }
    if (typeof document === "undefined") return null;
    const [bx, by, bw, bh] = box, q = Math.round(px * 16) / 16;
    c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(bw * q)); c.height = Math.max(1, Math.ceil(bh * q));
    const g = c.getContext("2d"); if (!g) return null;
    g.save(); g.scale(q, q); g.translate(-bx, -by);
    try { fn(g); } catch (e) { if (typeof console !== "undefined") console.warn("mapride", e); }
    g.restore();
    c.bx = bx; c.by = by; c.q = q;
    PICS.set(id, c); if (PICS.size > MAX_PICS) PICS.delete(PICS.keys().next().value);
    return c;
  }
  const put = (g, c, x, y, sc) => { if (c) g.drawImage(c, x + c.bx * sc, y + c.by * sc, c.width / c.q * sc, c.height / c.q * sc); };
  const RIDE_BOX = [-40, -100, 100, 104], FOOT_BOX = [-44, -96, 100, 104];
  function riderPic(look, px) {
    const pnt = painted(look), key = `ride|${lookKey(look)}|${pnt ? "p" : "i"}`;
    return pic(key, px, RIDE_BOX, (g) => {
      let sp = null; try { sp = FIGART.specOf(FIGART.lookFor({ look })); } catch { /* no spec */ }
      if (pnt && PAINTRIG.draw(g, look, { clip: "ride", u: 0, stirrup: STIRRUP, shield: !!(sp && sp.shield) })) return;
      if (typeof FIGART !== "undefined" && FIGART.fight) FIGART.fight(g, { look }, { ride: true, shield: !!(sp && sp.shield) });
    });
  }
  /* the painted hero on foot (the map's walking / standing figure); false until the painted parts are in */
  const FOOT_N = { walk: 8, idle: 4 };
  function walker(g, look, x, y, h, o = {}) {
    if (!painted(look)) return false;
    const clip = o.clip === "walk" ? "walk" : "idle", n = FOOT_N[clip], fr = Math.floor((((o.u || 0) % 1) + 1) % 1 * n) % n;
    const sc = h / 61, px = sc * devScale(g);
    const c = pic(`foot|${lookKey(look)}|${clip}|${fr}`, px, FOOT_BOX, (gg) => { PAINTRIG.draw(gg, look, { clip, u: fr / n }); });
    if (!c) return false;
    g.save(); g.translate(x, y); if (o.flip) g.scale(-1, 1); put(g, c, 0, 0, sc); g.restore();
    return true;
  }

  // ---------------------------------------------------------------- horse + rider together
  function mounted(g, x, y, k, o = {}) {
    const st = o.st || {}, t = o.t || 0;
    const S = step(st, { moving: !!o.moving, pace: o.pace, t, id: o.id });
    let P;
    if (o.reduce) P = pose(S.gait, S.gait === "idle" ? 0 : 0.18);
    else { P = pose(S.gait, S.c); if (S.from) { P = mix(pose(S.from, S.c), P, smooth(S.w)); if (S.gait === "idle") P.head -= 0.16 * Math.sin(Math.PI * S.w); } }   // stopping: the head comes up
    if (o.reduce) { P.bob = 0; P.pitch = 0; P.ry = 0; }
    // turning round: the figure narrows to its edge and opens the other way
    const dir = o.flip ? -1 : 1;
    if (st.dir == null) st.dir = dir;
    if (dir !== st.dir) { st.turn = { t0: t, from: st.dir }; st.dir = dir; }
    let sx = dir;
    if (st.turn && !o.reduce) { const u = (t - st.turn.t0) / TURN; if (u >= 1 || u < 0) st.turn = null; else sx = lerp(st.turn.from, dir, smooth(u)); }
    if (Math.abs(sx) < 0.08) sx = sx < 0 ? -0.08 : 0.08;
    const dev0 = devScale(g);
    g.save(); g.translate(x, y); g.scale(k * sx, k);
    const H = horse(g, o.coat, P, { simple: o.simple, bare: false });
    if (!o.noRider && o.look) {
      const rider = riderPic(o.look, Math.abs(k) * RS * dev0);
      if (rider) {
        g.save(); g.translate(H.seat[0], H.seat[1] + P.ry * 0.7); g.rotate(H.pitch * 0.5 + P.lean); g.scale(RS, RS); g.translate(-HIP[0], -HIP[1]);
        put(g, rider, 0, 0, 1);
        g.restore();
        if (!o.simple) {   // the reins: from the rider's hands to the bit
          const ha = rotAbout([H.seat[0] + 9 * RS, H.seat[1] - 9 * RS + P.ry * 0.7], H.seat, H.pitch * 0.5 + P.lean);
          g.strokeStyle = "rgba(40,24,12,0.9)"; g.lineWidth = 0.7; g.beginPath(); g.moveTo(ha[0], ha[1]);
          g.quadraticCurveTo((ha[0] + H.bit[0]) / 2, Math.max(ha[1], H.bit[1]) + 3, H.bit[0], H.bit[1]); g.stroke();
        }
      }
    }
    g.restore();
    return { top: y + Math.min(H.seat[1] - 33 * RS, -60) * k, head: y + (H.seat[1] - 27 * RS) * k, gait: S.gait };
  }
  return { GAITS, TH, HYST, KEYS, pick, step, pose, mix, offset, hooves, mounted, walker, horse, riderPic, tones, seat: -SEAT[1], RS, HIP, STIRRUP, clear: () => PICS.clear(), size: () => PICS.size };
})();
if (typeof module !== "undefined") module.exports = MAPRIDE;
