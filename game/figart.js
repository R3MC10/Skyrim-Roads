/* FIGART: the one shared character renderer (side view) for you, party members, followers and other players. [OURS]
   Real proportions (about 7½ heads tall), shaded volumes, an ink outline with a soft wash (hand-drawn style),
   race (skin, ears, snouts, horns, tails), sex, hair and beard, and the
   actual worn gear (helmet, armour set colours and features, cloak, shield, weapon, amulet/ring when those slots exist).
   Every look comes from the same "look" object players share (HEROART.lookOf), so everyone sees the same character.

   API (also attached to HEROART, see heroart.js):
     FIGART.sprite(src, { pose, frame, h, k, horse, armed }) → a cached offscreen canvas of one frame.
        src: a save, a player card ({look}) or a look. h: CSS height of the standing figure (default 64), or k: canvas px per unit.
        canvas.ax / canvas.ay = where the feet are (canvas px); canvas.k = px per unit (the figure is 61 units tall).
     FIGART.draw(g, src, x, y, { pose, frame, h, horse, armed, flip }) → draws the cached frame with its feet at (x, y),
        h tall in g's units, at the right resolution for g's current transform (sharp on phones).
     FIGART.fight(g, src, o) → a fight-scene figure (feet at 0,0, facing right, ~60 units tall) posed live from the fight
        replay's numbers (o.aim, o.back, o.hunch, o.lunge, o.draw, o.t, o.wt, o.shield, o.off, o.glow, o.flask); the
        torso/head and cloak are cached layers, only the limbs are drawn each frame.
     FIGART.POSES → { idle: 4, walk: 8, attack: 4, cast: 3, block: 2, hit: 2, down: 1, ride: 4, sit: 1 } (frames per pose).
        sprite/draw also take steps (cut the cycle into more frames than the clip has, for smooth motion; frame 0..steps-1)
        and gait for "ride" ("stand" | "walk" | gallop by default).
     FIGART.STRIDE → units travelled per cycle ({ walk, horse: { walk, gallop } }): a scene scrolling the ground at v px/s
        with px per unit u plays v / (stride · u) cycles a second, so planted feet and hooves move with the ground.
     FIGART.drawHorse(g, colour, x, y, { k, cyc, gait, flip }) → a horse on its own (hooves at x, y; k = g units per unit).
     FIGART.contact(src, { pose, frame, steps, gait }) → { foot, seat, hip, planted } in units (feet at 0,0), for tests.
   Missing gear slots (amulet, ring...) are simply not drawn. */
const FIGART = (() => {
  const TAU = Math.PI * 2;
  const POSES = { idle: 4, walk: 8, attack: 4, cast: 3, block: 2, hit: 2, down: 1, ride: 4, sit: 1 };
  const LX = 0.55, LY = -0.83;   // light from the upper front
  const DARK = [34, 24, 16];

  // ---------------------------------------------------------------- colour helpers
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function rgbOf(c) { return typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] : null; }
  const hexOf = (v) => "#" + v.map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0")).join("");
  /* lighter (t > 0) or darker (t < 0) */
  function tone(c, t) { const v = rgbOf(c); if (!v) return c; return hexOf(t >= 0 ? v.map((x) => x + (255 - x) * t) : v.map((x, i) => x + (DARK[i] - x) * -t)); }

  // ---------------------------------------------------------------- drawing helpers
  /* light and shadow over the current path: (x0,y0) is the lit side, (x1,y1) the shadow side */
  function wash(g, x0, y0, x1, y1, st, k = 1) {
    if (!isFinite(x0 + y0 + x1 + y1)) return;
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    // a soft watercolour wash
    gr.addColorStop(0, `rgba(255,246,226,${0.34 * k})`); gr.addColorStop(0.32, "rgba(255,246,226,0)"); gr.addColorStop(0.58, "rgba(40,26,14,0.04)"); gr.addColorStop(1, `rgba(40,26,14,${0.42 * k})`);
    g.fillStyle = gr; g.fill();
  }
  function fillPath(g, col, st, lit, lw) {
    g.fillStyle = col; g.fill();
    if (lit) wash(g, lit[0], lit[1], lit[2], lit[3], st, lit[4] || 1);
    if (lw !== 0) { g.strokeStyle = st.ink; g.lineWidth = lw == null ? st.lw : lw; g.stroke(); }
  }
  /* a smooth closed (or open) curve through control points */
  function smooth(g, pts, closed = true) {
    const n = pts.length; g.beginPath();
    if (closed) {
      g.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
      for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
      g.closePath();
    } else {
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) { const p = pts[i], q = pts[i + 1]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
      g.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }
  const poly = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  /* a tapered, shaded limb (capsule) from a to b */
  function limb(g, ax, ay, bx, by, wa, wb, col, st, lw) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 0.01, a0 = Math.atan2(dy, dx);
    g.beginPath(); g.arc(ax, ay, wa / 2, a0 + Math.PI / 2, a0 + Math.PI * 1.5); g.arc(bx, by, wb / 2, a0 - Math.PI / 2, a0 + Math.PI / 2); g.closePath();
    let nx = -dy / L, ny = dx / L; if (nx * LX + ny * LY < 0) { nx = -nx; ny = -ny; }
    const mx = (ax + bx) / 2, my = (ay + by) / 2, w = Math.max(wa, wb) / 2;
    fillPath(g, col, st, [mx + nx * w, my + ny * w, mx - nx * w, my - ny * w], lw);
  }
  function dot(g, x, y, r, col, st, lw = 0) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = col; g.fill(); if (lw) { g.strokeStyle = st.ink; g.lineWidth = lw; g.stroke(); } }
  function line(g, pts, col, w) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  function glowAt(g, x, y, r, col, a, st) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.25, col); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.globalAlpha = 1;
  }
  /* two-bone reach (shoulder→elbow→hand, hip→knee→ankle); side +1 bends the joint down/back (arms), -1 forward (knees) */
  function ik(ax, ay, bx, by, l1, l2, side) {
    let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.02;
    if (d > max) { bx = ax + dx / d * max; by = ay + dy / d * max; dx = bx - ax; dy = by - ay; d = max; }
    if (d < 0.01) { d = 0.01; dx = 0; dy = 0.01; }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / d, uy = dy / d;
    return [ax + ux * a - uy * h * side, ay + uy * a + ux * h * side, bx, by];
  }

  // ---------------------------------------------------------------- who: a look → everything the drawing needs
  const ELEMENT = { fire: "#e8923a", flames: "#e8923a", frost: "#9fd0f0", shock: "#c9b6ff", sparks: "#c9b6ff", absorb: "#c4372e", sun: "#f3e7a4" };
  const baseOf = (id) => (id && String(id).startsWith("ench|") ? String(id).split("|")[1] : id);
  const hasGL = () => typeof GEARLOOK !== "undefined";
  const setKey = (id) => (id && hasGL() ? GEARLOOK.setOf(id) : null);
  const setRec = (id) => (id && hasGL() ? GEARLOOK.set(GEARLOOK.setOf(id)) : null);
  const cloakOf = (eq) => (eq && eq.cloak && typeof D !== "undefined" && D.ITEMS[eq.cloak] && D.ITEMS[eq.cloak].cloakLook) || null;   // side cloaks (cloaks.js)
  function lookOf(src) {
    if (!src) return { r: "nord", id: "x", eq: {}, gl: {} };
    if (src.look) return src.look;
    if (src.eq && (src.r || src.gl)) return src;
    if (src.loadouts && typeof HEROART !== "undefined") return HEROART.lookOf(src);
    const L0 = { r: src.race || "nord", id: src.id || src.name || "x", eq: {}, gl: {}, sx: src.sex === "f" ? "f" : undefined };
    if (src.app) L0.a = src.app;
    return L0;
  }
  const keyOf = (L) => JSON.stringify([L.r, L.id, L.eq, L.gl, L.v, L.ww, L.sx || "", L.a || 0]);
  const RACE0 = { skin: ["#e2b894"], hair: ["#8a5a34"], beard: 0.5, ears: "round", h: 1, w: 1 };
  const SPECS = new Map();
  function specOf(L) {
    const key = keyOf(L); let sp = SPECS.get(key); if (sp) return sp;
    const RACES = (typeof HEROART !== "undefined" && HEROART.RACE) || {}, race = RACES[L.r] || RACES.nord || RACE0;
    const rnd = ART.seeded(L.id + L.r);   // the same draws as the front view, so both show the same skin and hair
    const skin = L.v ? "#d8d3cc" : race.skin[Math.floor(rnd() * race.skin.length)];
    const hairC = race.hair.length ? race.hair[Math.floor(rnd() * race.hair.length)] : null;
    const beardRoll = rnd() < race.beard, hs = String(L.id).startsWith("preview") ? 0 : [0, 0, 1, 2, 2, 0, 1, 3][Math.floor(rnd() * 8)];
    const paint = rnd() < 0.3 ? ["#1c2128", "#2f4f8a", "#8e2b25"][Math.floor(rnd() * 3)] : null;
    const r2 = ART.seeded(L.id + "|fig"), fem = L.sx === "f";
    const eq = L.eq || {}, gl = L.gl || {};
    const cm = eq.chest ? setRec(eq.chest) : null, ck = setKey(eq.chest), F = (cm && cm.f) || {};
    const robe = !!cm && cm.w === "robe", heavy = !!cm && cm.w === "heavy", light = !!cm && cm.w === "light";
    const tunic = { c: "#a8906a", d: "#7d6a4c", trim: "#cdb98f" };
    const body = cm || tunic;
    const gloves = setRec(eq.hands), boots = setRec(eq.feet), bootsK = setKey(eq.feet);
    let helm = null;
    if (eq.head) {
      const id = baseOf(eq.head), hs2 = setRec(id) || {}, hk = setKey(id), hf = hs2.f || {};
      const kind = (typeof D !== "undefined" && D.ITEMS[id]?.mask) || /^mask_/.test(id) ? "mask" : (hf.hood && !/helm/.test(id)) || /hood/.test(id) ? "hood" : /coif/.test(id) ? "coif"
        : ["hide", "leather", "fur", "studded", "stormcloak", "scaled"].includes(hk) ? "cap" : "metal";
      const visor = kind === "metal" && ["ebony", "daedric", "dwarven", "orcish", "dragonplate", "steelplate", "stalhrim", "glass"].includes(hk);
      helm = { id, set: hs2, k: hk, f: hf, kind, visor };
    }
    let shield = null;
    if (eq.shield) { const s = setRec(eq.shield) || { c: "#8a6a44", d: "#5e4630", trim: "#8f8a84" }, k = setKey(eq.shield) || "iron";
      shield = { set: s, k, kite: (s.w === "heavy" && !["iron", "hide", "banded", "chain"].includes(k)) || k === "elven" || k === "glass" }; }
    let wk = null; try { wk = eq.weapon && typeof HEROART !== "undefined" ? HEROART.weaponKind(eq.weapon) : null; } catch { wk = null; }
    const wset = setRec(eq.weapon), wkey = setKey(eq.weapon);
    let staffC = "#c9b6ff";
    try { const sp0 = D.SPELLS[D.ITEMS[baseOf(eq.weapon)]?.staff?.spell]; staffC = ELEMENT[sp0?.element] || (sp0?.kind === "reanimate" ? "#8fd08a" : sp0?.kind === "turn" ? "#f3e7a4" : "#c9b6ff"); } catch { /* no data */ }
    const jewel = (id) => (id ? (/silver|moonstone/.test(id) ? "#d0d5d8" : "#d6b25e") : null);
    const amulet = eq.amulet || eq.neck || eq.necklace || null, ring = eq.ring || eq.ring1 || eq.ring2 || null;
    sp = {
      key, r: L.r, ears: race.ears, eyes: L.v ? "#e0302a" : race.eyes || "#3b4a5a", vamp: !!L.v, wolf: !!L.ww, fem,
      skin, skinD: tone(skin, -0.22), hairC, hairStyle: fem ? ["long", "braid", "long", "bun"][[0, 0, 1, 2, 2, 0, 1, 3].indexOf(hs) % 4] || "long" : ["short", "braid", "long", "shaved"][hs] || "short",
      beard: beardRoll && !fem && !!hairC, beardLen: 1 + Math.floor(r2() * 5), paint, tail: !!race.tail,
      bw: (race.w || 1) * (fem ? 0.93 : 1), bh: (race.h || 1) * (fem ? 0.97 : 1),
      cm, ck, F, robe, heavy, light, bare: !cm, body,
      sleeveC: robe ? body.c : heavy ? body.d : body.c, foreC: gloves ? gloves.c : cm ? (robe ? body.c : light || heavy ? body.d : null) : null,
      legC: robe ? body.d : cm ? body.d : "#5a4836", greave: heavy ? cm : null,
      gloves, boots, bootsK, barefoot: !eq.feet && (L.r === "khajiit" || L.r === "argonian"),
      helm, hood: !eq.head && F.hood && (robe || ["nightingale", "shrouded", "guild"].includes(ck)) ? F.hood : null,
      cape: (cloakOf(eq) || {}).c || F.cape || (heavy && !robe ? "#7a2a22" : null), capeSide: (cloakOf(eq) || {}).side || null, capeTrim: (cloakOf(eq) || {}).trim || null,   // a side cloak (cloaks.js) wins
      shield, wk, wset, wkey, staffC, ench: gl.w ? ELEMENT[gl.w] || "#c9b6ff" : null, aglow: !!gl.a,
      amulet: jewel(amulet), ring: jewel(ring),
    };
    if (L.a && typeof APPEAR !== "undefined") appearOn(sp, L, race);   // a look chosen in character creation (appear.js)
    if (SPECS.size > 200) SPECS.delete(SPECS.keys().next().value);
    SPECS.set(key, sp); return sp;
  }

  /* [OURS] character creation (appear.js): the chosen face, hair, build... on top of the seeded defaults */
  const mixC = (a, b, t) => { const x = rgbOf(a), y = rgbOf(b); return x && y ? hexOf(x.map((v, i) => v + (y[i] - v) * t)) : a; };
  function appearOn(sp, L, race) {
    const A = APPEAR.norm(L.a, L.r), r = L.r;
    sp.A = A; sp.fem = A.sx === "f";
    if (!L.v) { sp.skin = APPEAR.skinOf(r, A.skin); sp.eyes = APPEAR.eyeOf(r, A.eyes); }
    sp.skinD = tone(sp.skin, -0.22);
    let hc = (race.hair || []).length ? APPEAR.hairColOf(r, A.hairC) : null;
    if (hc && A.age >= 2) hc = mixC(hc, A.age === 3 ? "#dcd8d0" : "#a8a49c", A.age === 3 ? 0.72 : 0.28);   // greying with age
    sp.hairC = hc; sp.hairStyle = A.hair;
    if (r === "argonian") { sp.horns = A.horns; sp.hornI = A.hairC; sp.hornC = APPEAR.hairColOf(r, A.hairC); }
    sp.beardStyle = A.beard; sp.beard = A.beard !== "none" && A.beard !== "stubble" && !!hc; sp.beardLen = APPEAR.beardLen(A);
    sp.face = A.face; sp.nose = A.nose; sp.mouth = A.mouth; sp.brows = A.brows; sp.age = A.age; sp.scar = A.scar; sp.tattoo = A.tattoo;
    sp.paint = A.paint !== "none" ? APPEAR.paintOf(A.paintC) : null; sp.paintS = A.paint;
    sp.bw = (race.w || 1) * (sp.fem ? 0.93 : 1) * APPEAR.bw(A); sp.bh = (race.h || 1) * (sp.fem ? 0.97 : 1) * APPEAR.bh(A);
  }
  /* the extra face marks: age lines, scars, warpaint styles, tattoos */
  function faceMarks(g, sp, st, eyeX, eyeY, covered) {
    if (sp.age >= 2) {
      const c = "rgba(60,40,30,0.38)";
      line(g, [[eyeX - 1.3, eyeY + 0.1], [eyeX - 2, eyeY + 0.5]], c, st.fine * 0.8); line(g, [[eyeX - 1.3, eyeY - 0.3], [eyeX - 2.1, eyeY - 0.5]], c, st.fine * 0.8);
      line(g, [[0.4, -3.6], [2.8, -3.8]], c, st.fine * 0.7);
      if (sp.age >= 3) { line(g, [[0.6, -2.8], [2.6, -2.9]], c, st.fine * 0.7); if (sp.ears !== "lizard") line(g, [[4.2, 2.1], [3.5, 3.7]], c, st.fine * 0.8); }
    }
    if (sp.tattoo && sp.tattoo !== "none" && !covered) {
      g.globalAlpha = 0.6; const c = "#2f4f8a";
      if (sp.tattoo === "rune") { line(g, [[1.6, -4.6], [1.6, -2.8]], c, st.fine * 1.1); line(g, [[0.9, -4.2], [2.3, -3.2]], c, st.fine * 1.1); line(g, [[2.3, -4.2], [0.9, -3.2]], c, st.fine * 1.1); }
      else if (sp.tattoo === "dots") for (const [x, y] of [[1.4, 1.2], [2.2, 1.6], [1.2, 2.2], [2, 2.6]]) dot(g, x, y, 0.28, c, st);
      else if (sp.tattoo === "lines") for (const x of [2.4, 3.1, 3.8]) line(g, [[x, 4.1], [x - 0.1, 5.2]], c, st.fine * 1.1);
      else if (sp.tattoo === "spiral") { g.strokeStyle = c; g.lineWidth = st.fine * 1.1; g.beginPath(); for (let i = 0; i <= 24; i++) { const a = i * 0.45, rr = 0.15 + i * 0.045; const x = 1.6 + Math.cos(a) * rr, y = 1.5 + Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
      g.globalAlpha = 1;
    }
    if (sp.paintS && sp.paintS !== "band" && sp.paint && !covered) {
      g.globalAlpha = 0.6; g.fillStyle = sp.paint;
      if (sp.paintS === "stripes") for (let i = 0; i < 3; i++) g.fillRect(0.6 + i * 0.15, 0.7 + i * 0.85, 2.8, 0.38);
      else if (sp.paintS === "jaw") { g.beginPath(); g.moveTo(0.2, 2.6); g.quadraticCurveTo(1.8, 3.4, 4.3, 3.9); g.quadraticCurveTo(4, 5.4, 2.6, 5.5); g.quadraticCurveTo(0.6, 5.5, -0.6, 3.4); g.closePath(); g.fill(); }
      else if (sp.paintS === "eye") { g.strokeStyle = sp.paint; g.lineWidth = 0.75; g.beginPath(); g.ellipse(eyeX, eyeY, 1.5, 1.15, 0, 0, TAU); g.stroke(); line(g, [[eyeX - 0.2, eyeY + 1.1], [eyeX - 0.5, eyeY + 2.6]], sp.paint, 0.5); }
      g.globalAlpha = 1;
    }
    if (sp.scar && sp.scar !== "none" && !(sp.helm && sp.helm.visor)) {
      const c = sp.ears === "lizard" || sp.ears === "cat" ? "rgba(232,214,190,0.8)" : "rgba(150,64,52,0.8)", w = st.fine * 1.2;
      if (sp.scar === "eye") { line(g, [[eyeX - 0.7, eyeY - 2.2], [eyeX + 0.1, eyeY - 0.4]], c, w); line(g, [[eyeX + 0.2, eyeY + 0.5], [eyeX + 0.6, eyeY + 1.6]], c, w); }
      else if (sp.scar === "cheek") line(g, [[1.3, 0.8], [3.3, 2.4]], c, w);
      else if (sp.scar === "lip") line(g, [[4.0, 2.8], [3.8, 4.1]], c, w);
      else if (sp.scar === "brow") line(g, [[eyeX - 0.3, eyeY - 2], [eyeX + 0.5, eyeY - 0.9]], c, w);
      else if (sp.scar === "claw") for (let i = 0; i < 3; i++) line(g, [[0.6 + i * 0.75, -0.2 + i * 0.1], [1.6 + i * 0.75, 2.6 + i * 0.1]], c, w);
    }
  }
  /* Argonian head-dress other than the old frills */
  function lizardCrest(g, sp, st) {
    const c = sp.hornC || "#4d6a44", c2 = tone(c, 0.15);
    if (sp.horns === "horns") for (const [dx, k] of [[0, 1], [1.4, 0.8]]) { g.beginPath(); g.moveTo(-1.6 + dx, -5); g.quadraticCurveTo(-6 + dx, -8.4 * k, -9 + dx, -4.6 * k); g.quadraticCurveTo(-6 + dx, -6 * k, -2.6 + dx, -3.4); g.closePath(); fillPath(g, dx ? c2 : "#e8dcc0", st, null, st.lw * 0.7); }
    else if (sp.horns === "crest") { for (let i = 0; i < 6; i++) { poly(g, [[2.2 - i * 1.3, -5.6 + i * 0.3], [1.6 - i * 1.3, -8.6 + i * 0.5], [0.8 - i * 1.3, -5.4 + i * 0.4]]); fillPath(g, i % 2 ? c : c2, st, null, st.lw * 0.6); } }
    else if (sp.horns === "spikes") for (let i = 0; i < 5; i++) { const a = -1.9 + i * 0.42, x = -1 + Math.cos(a) * 5, y = -0.4 + Math.sin(a) * 5.4; poly(g, [[x, y], [x + Math.cos(a) * 2.4 - 0.6, y + Math.sin(a) * 2.4], [x - 0.6 * Math.sin(a) + 0.4, y + 0.6 * Math.cos(a)]]); fillPath(g, i % 2 ? c : c2, st, null, st.lw * 0.6); }
  }

  // ---------------------------------------------------------------- animation clips
  /* A clip is a list of keyframes over one loop (t = 0..1). Each key sets the rig's controls:
       root:  ox, dy (body offset), rot (whole body, used when knocked down)
       spine: lean      head: tilt
       arms:  aim (weapon hand, the fight scene's number), back (shield hand); the rig reaches them with two-bone IK
       legs:  fn / ff = near / far foot goals [x, y] on the ground (IK again, knees bend forwards)
       extras: cape (cloak swing), draw (bow string), cast (spell glow)
     Sampling eases between keys; blend() mixes two samples, so one clip fades into the next over time. */
  const TWO = new Set(["greatsword", "battleaxe", "warhammer", "bow", "crossbow", "spear"]);
  const CLIPS = new Map();
  function clipsFor(sp) {
    const ck = (sp.wk || "") + "|" + (sp.shield ? 1 : 0); let C = CLIPS.get(ck); if (C) return C;
    const wk = sp.wk, ranged = wk === "bow" || wk === "crossbow", sh = !!sp.shield;
    const cyc = (n, fn) => Array.from({ length: n }, (_, i) => [i / n, fn(i / n * TAU, i)]);
    const keyed = (ts, ks) => ks.map((k, i) => [ts[i], k]);
    let attack;
    if (ranged) attack = keyed([0, 0.3, 0.55, 0.8], [0.35, 1, 0, 0.1].map((d) => ({ aim: 0, back: 0, draw: d, fn: [6, 0], ff: [-6, 0], lean: -0.03 })));
    else if (wk === "spear") attack = keyed([0, 0.3, 0.55, 0.8], [[-0.1, -0.08, 4, 0], [0.1, 0.05, 7, 0], [0.35, 0.22, 12, 3], [0.2, 0.1, 8, 0]].map(([aim, lean, f, ox]) => ({ aim, lean, ox, back: sh ? -0.9 : 0.4, fn: [f, 0], ff: [-6, 0] })));
    else attack = keyed([0, 0.3, 0.55, 0.8], [
      [-2.35, 0.55, -0.12, 4, -6, 0, 0.2, 0], [-1.0, 0.1, 0.06, 8, -6, 0.4, 0.5, 0],
      [0.95, -0.25, 0.24, 11, -7, 1.3, 1, 2], [0.3, 0.1, 0.1, 8, -6, 0.6, 0.6, 0]].map(([aim, back, lean, f1, f2, dy, cape, ox]) => ({ aim, back: sh ? Math.min(back, -0.7) : back, lean, fn: [f1, 0], ff: [f2, 0], dy, cape, ox, tilt: lean * 0.3 })));
    C = {
      idle: { keys: cyc(4, (p) => { const b = Math.sin(p); return { dy: b * 0.35, aim: ranged ? 0.9 : -0.55, back: sh ? -0.95 : 0.25, fn: [5, 0], ff: [-5, 0], cape: 0.15 + b * 0.1, lean: 0.02, tilt: b * 0.03 }; }) },
      walk: { armed: false, keys: cyc(8, (p) => { const s = Math.sin(p), c = Math.cos(p); return { fn: [1 + 7.2 * s, -Math.max(0, c) * 3.2], ff: [1 - 7.2 * s, -Math.max(0, -c) * 3.2], dy: 0.9 * Math.abs(s) - 0.3, lean: 0.06, aim: 0.95 - 0.38 * s, back: sh ? -0.95 + 0.15 * s : -0.35 + 0.42 * s, cape: 0.6 + 0.4 * Math.abs(c), tilt: 0.02 * c }; }) },
      attack: { keys: attack },
      cast: { keys: cyc(3, (p) => ({ aim: wk === "staff" ? -1.25 : -0.85, back: -1.35, lean: 0.05, cast: 0.6 + 0.4 * Math.sin(p), fn: [6, 0], ff: [-5, 0], cape: 0.3, tilt: -0.04 })) },
      block: { front: true, keys: keyed([0, 0.5], [-0.08, -0.02].map((lean) => ({ back: -1.45, aim: TWO.has(wk) ? -1.4 : -0.15, lean, fn: [7, 0], ff: [-7, 0], dy: 0.8 }))) },
      hit: { keys: keyed([0, 0.5], [-0.27, -0.16].map((lean) => ({ lean, aim: -1.7, back: 0.95, fn: [3, -0.6], ff: [-7, 0], tilt: -0.25, ox: -2, cape: 0.5 }))) },
      down: { armed: false, keys: [[0, { rot: -Math.PI / 2, aim: 1.4, back: 0.5, fn: [4, -4], ff: [-1, 0], lean: 0, tilt: 0.25 }]] },
      ride: { armed: false, ride: true, noFar: true, keys: cyc(4, (p) => { const b = Math.sin(p * 2); return { dy: -12 + b * 0.6, ox: -3, lean: 0.1 + b * 0.03, fn: [5.5, -19.5], ff: [5.5, -19.5], aim: 0.55, back: -0.25, cape: 0.9 }; }) },
      sit: { armed: false, keys: [[0, { dy: 15, fn: [11, 0], ff: [9, 0], aim: 0.6, back: -0.3, lean: 0.04 }]] },
    };
    CLIPS.set(ck, C); return C;
  }
  const BASE = { aim: -0.5, back: 0, lean: 0.02, dy: 0, ox: 0, rot: 0, tilt: 0, fn: [5, 0], ff: [-5, 0], draw: 0, cast: 0, cape: 0 };
  function mix(a, b, w) {
    const o = {};
    for (const k in BASE) {
      const x = a[k] !== undefined ? a[k] : BASE[k], y = b[k] !== undefined ? b[k] : BASE[k];
      o[k] = Array.isArray(x) ? [x[0] + (y[0] - x[0]) * w, x[1] + (y[1] - x[1]) * w] : x + (y - x) * w;
    }
    return o;
  }
  /* the controls of a clip at time t (0..1, looping), eased between keys */
  function sampleClip(clip, t) {
    const ks = clip.keys, n = ks.length; t = ((t % 1) + 1) % 1;
    if (n === 1) return mix(ks[0][1], ks[0][1], 0);
    let i = n - 1; for (let j = 0; j < n; j++) if (ks[j][0] <= t) i = j;
    const [ta, a] = ks[i], [tb0, b] = ks[(i + 1) % n], tb = i + 1 < n ? tb0 : 1 + ks[0][0], u = (t - ta) / Math.max(1e-6, tb - ta);
    return mix(a, b, (1 - Math.cos(Math.PI * clamp(u, 0, 1))) / 2);
  }
  /* a finished pose: sampled controls plus the clip's flags */
  function poseAt(name, t, sp, o = {}) {
    const all = clipsFor(sp), clip = all[name] || all.idle, P = sampleClip(clip, t);
    P.armed = o.armed !== undefined ? !!o.armed : clip.armed !== false;
    P.ride = !!clip.ride; P.noFar = !!clip.noFar; P.tailP = t * TAU;
    if (!P.armed && sp.wk === "staff") P.stick = true;   // a mage walks with the staff like a walking stick
    P.front = clip.front !== undefined ? clip.front : P.back < -0.8;
    return P;
  }
  const poseOf = (name, frame, sp, o) => { const n = POSES[name] || 1; return poseAt(name, (((frame % n) + n) % n) / n, sp, o); };   // fractional frames (o.steps) sample between keys
  /* fade pose a into pose b (w = 0..1) */
  function blend(a, b, w) { const P = mix(a, b, clamp(w, 0, 1)); return Object.assign({}, w < 0.5 ? a : b, P); }

  // ---------------------------------------------------------------- the rig: a bone hierarchy (parents before children)
  /* Every bone points down (+y) at rest and has a local offset (in its parent's frame) and a local angle.
     root → spine → neck → head; spine → upper → fore → hand (N = near arm, F = far arm); spine → pelvis → thigh → shin → foot.
     Parts are drawn in their bone's frame: torso, cloak and pauldron on the spine, the head on the head bone, limbs
     along their bones, the weapon in the near hand, the shield on the far hand. solve() turns controls into bone angles. */
  const RIG = [["root", null], ["spine", "root"], ["neck", "spine"], ["head", "neck"],
    ["upperF", "spine"], ["foreF", "upperF"], ["handF", "foreF"], ["upperN", "spine"], ["foreN", "upperN"], ["handN", "foreN"],
    ["pelvis", "spine"], ["thighF", "pelvis"], ["shinF", "thighF"], ["footF", "shinF"], ["thighN", "pelvis"], ["shinN", "thighN"], ["footN", "shinN"]];
  const BONE_LEN = { upper: 11, fore: 10.6, thigh: 13.4, shin: 13.2 };
  const SH_N = [1.6, -45.6], SH_F = [-1.0, -46.3], HIP = [0, -28.5], NECK = [0.6, -48.4], HEAD = [2.5, -55.4];
  const handN = (P) => P.handN || [7 + Math.cos(P.aim) * 13 - Math.sin(P.aim) * 9, -45 + Math.sin(P.aim) * 13 + Math.cos(P.aim) * 9];
  const handF = (P) => P.farHand || [-6 - 6 * Math.cos(P.back) - 14 * Math.sin(P.back), -46 - 6 * Math.sin(P.back) + 14 * Math.cos(P.back)];
  const angTo = (dx, dy) => Math.atan2(-dx, dy);   // the angle that turns "down" toward (dx, dy)
  function fk(local) {
    const w = {};
    for (const [n, p] of RIG) {
      const l = local[n] || { x: 0, y: 0, a: 0 }, q = p ? w[p] : null;
      w[n] = q ? { x: q.x + Math.cos(q.a) * l.x - Math.sin(q.a) * l.y, y: q.y + Math.sin(q.a) * l.x + Math.cos(q.a) * l.y, a: q.a + l.a } : { x: l.x, y: l.y, a: l.a };
    }
    return w;
  }
  function solve(sp, P) {
    const L = {};
    L.root = { x: P.ox || 0, y: P.dy || 0, a: 0 };
    L.spine = { x: 0, y: 0, a: P.lean || 0 };
    L.neck = { x: NECK[0], y: NECK[1], a: 0 };
    L.head = { x: HEAD[0] - NECK[0], y: HEAD[1] - NECK[1], a: P.tilt || 0 };
    const armChain = (s, sh, hand, handA) => {   // IK in the spine frame
      const [ex, ey, hx, hy] = ik(sh[0], sh[1], hand[0], hand[1], BONE_LEN.upper, BONE_LEN.fore, 1);
      const a1 = angTo(ex - sh[0], ey - sh[1]), a2 = angTo(hx - ex, hy - ey);
      L["upper" + s] = { x: sh[0], y: sh[1], a: a1 }; L["fore" + s] = { x: 0, y: BONE_LEN.upper, a: a2 - a1 };
      L["hand" + s] = { x: 0, y: Math.hypot(hx - ex, hy - ey), a: handA - a2 };
    };
    armChain("F", SH_F, handF(P), 0);
    armChain("N", SH_N, handN(P), P.aim + (P.wrot || 0));
    L.pelvis = { x: HIP[0], y: HIP[1], a: -(P.lean || 0) };   // the pelvis stays level so the feet stay planted
    const pv = fk(L).pelvis;
    const legChain = (s, hx, goal) => {   // IK in the pelvis frame, to the ankle just above the foot goal
      const gx = goal[0] - pv.x, gy = goal[1] - 2.2 - pv.y;
      const [kx, ky, ax, ay] = ik(hx, 0.6, gx, gy, BONE_LEN.thigh, BONE_LEN.shin, -1);
      const a1 = angTo(kx - hx, ky - 0.6), a2 = angTo(ax - kx, ay - ky);
      L["thigh" + s] = { x: hx, y: 0.6, a: a1 }; L["shin" + s] = { x: 0, y: BONE_LEN.thigh, a: a2 - a1 };
      L["foot" + s] = { x: 0, y: Math.hypot(ax - kx, ay - ky), a: -a2 };   // the foot stays flat
    };
    legChain("F", -1.3, P.ff); legChain("N", 0.9, P.fn);
    return fk(L);
  }
  const at = (g, b) => { g.translate(b.x, b.y); g.rotate(b.a); };

  function torsoPath(g, sp) {
    const b = sp.heavy ? 1.3 : sp.light ? 0.55 : sp.robe ? 0.6 : 0.2, f = sp.fem;
    smooth(g, [[-1.4, -50.4], [-4.3 - b, -47.4], [-5.1 - b, -42], [-4.4 - b * 0.6, -36.5], [f ? -3.4 : -4.0, -33], [f ? -6.1 : -5.3, -28.6], [-4.4, -25],
      [2.4, -24.6], [f ? 4.8 : 4.5, -29], [f ? 3.6 : 4.3, -34], [f ? 6.9 : 5.7 + b, -40.2], [5.3 + b, -45.4], [2.9, -50.2]]);
  }
  function torso(g, sp, P, st) {
    const cm = sp.body, F = sp.F, ink = st.ink;
    torsoPath(g, sp); fillPath(g, cm.c, st, [6, -48, -5, -30]);
    g.save(); torsoPath(g, sp); g.clip();
    if (sp.bare) { g.strokeStyle = cm.d; g.lineWidth = 0.35; for (let y = -46; y < -32; y += 3) { g.beginPath(); g.moveTo(-6, y); g.lineTo(7, y + 0.6); g.stroke(); } line(g, [[1.4, -50], [3.6, -46.5], [4.6, -50]], cm.d, 0.6); }
    if (F.chain) { g.fillStyle = cm.d; for (let y = -49; y < -31; y += 1.6) for (let x = -6 + ((y / 1.6) % 2) * 0.8; x < 8; x += 1.6) g.fillRect(x, y, 0.55, 0.55); }
    if (F.scales) { g.strokeStyle = cm.d; g.lineWidth = 0.4; for (let y = -48; y < -32; y += 2) for (let x = -6 + ((y / 2) % 2); x < 8; x += 2) { g.beginPath(); g.arc(x, y, 1, 0, Math.PI); g.stroke(); } }
    if (F.seg) { g.strokeStyle = cm.d; g.lineWidth = 0.6; for (const y of [-44, -40.5, -37, -33.5]) { g.beginPath(); g.moveTo(-6, y - 1); g.quadraticCurveTo(1, y + 1.4, 8, y); g.stroke(); } }
    if (sp.heavy) {   // the breastplate catches the light
      poly(g, [[-0.4, -48.6], [5.4, -46], [6.8, -40], [5.2, -33.6], [-0.6, -32.4]]); fillPath(g, cm.trim, st, [7, -47, 0, -33], 0.4);
      if (cm.metal) { const gr = g.createLinearGradient(1, -48, 6, -36); gr.addColorStop(0.3, "rgba(255,255,255,0)"); gr.addColorStop(0.48, `rgba(255,255,255,${0.45})`); gr.addColorStop(0.62, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fill(); }
      for (let i = 0; i < (F.plates || 0); i++) { const y = -33.2 + i * 1.7; poly(g, [[-6, y], [6.5, y - 0.4], [6.2, y + 1.6], [-6, y + 1.8]]); fillPath(g, cm.d, st, null, 0.35); }
      if (F.ridges) { g.strokeStyle = cm.d; g.lineWidth = 0.55; for (let i = 0; i < (F.ridges > 1 ? 3 : 2); i++) { g.beginPath(); g.moveTo(0.4, -46 + i * 3.4); g.quadraticCurveTo(4.6, -45 + i * 3.4, 6.2, -42 + i * 3.4); g.stroke(); } }
      if (F.rivets) { g.fillStyle = "#3b2c1e"; for (const [x, y] of [[0.6, -47.4], [5, -45.4], [6, -39], [4.8, -34.4], [-3.8, -45], [-4.2, -38]]) g.fillRect(x - 0.4, y - 0.4, 0.8, 0.8); }
      if (F.gears) { dot(g, 1.6, -40, 2.3, cm.c, st, 0.4); g.fillStyle = cm.d; for (let a = 0; a < 8; a++) g.fillRect(1.6 + Math.cos(a * 0.785) * 2.6 - 0.35, -40 + Math.sin(a * 0.785) * 2.6 - 0.35, 0.7, 0.7); dot(g, 1.6, -40, 0.8, cm.trim, st); }
      if (F.bone) { g.strokeStyle = cm.trim; g.lineWidth = 0.5; for (const y of [-44, -41.5, -39]) { g.beginPath(); g.moveTo(-3.6, y); g.quadraticCurveTo(1, y - 1.4, 5.8, y + 0.6); g.stroke(); } }
    } else if (sp.light) {
      if (F.ridges) { poly(g, [[0.6, -47.8], [5.6, -45.2], [6.2, -39.6], [4.6, -35], [0.4, -35]]); fillPath(g, cm.trim, st, [7, -47, 0, -35], 0.35); if (cm.metal) { const gr = g.createLinearGradient(1, -48, 6, -36); gr.addColorStop(0.35, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,0.4)"); gr.addColorStop(0.65, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fill(); } }
      if (F.rivets) { g.fillStyle = cm.trim; for (let y = -46; y < -33; y += 2.6) for (let x = -4; x < 6; x += 2.6) g.fillRect(x - 0.35, y - 0.35, 0.7, 0.7); }
    }
    if (sp.robe) { line(g, [[2.9, -50], [5.2, -45], [5.6, -40], [4.6, -33], [4.2, -25]], cm.trim, 1.1); }
    if (F.sash) { g.strokeStyle = F.sash; g.lineWidth = 2.2; g.beginPath(); g.moveTo(3, -48.5); g.lineTo(-4.6, -31); g.stroke(); g.strokeStyle = cm.trim; g.lineWidth = 0.35; g.stroke(); }
    if (F.translucent) { g.globalAlpha = 0.32; g.fillStyle = "#fff"; g.fillRect(2, -48, 1.4, 14); g.globalAlpha = 1; }
    if (sp.fem && !sp.heavy) { g.strokeStyle = tone(cm.c, -0.35); g.lineWidth = 0.4; g.beginPath(); g.moveTo(4.2, -38.2); g.quadraticCurveTo(5.8, -37.4, 6.6, -39.2); g.stroke(); }
    // belt and buckle
    const beltC = sp.ck === "guild" || sp.ck === "nightingale" ? "#1c1714" : sp.robe ? cm.trim : sp.bare ? "#5e4630" : cm.d;
    poly(g, [[-8, -31.8], [8, -32.2], [8, -29.6], [-8, -29.2]]); fillPath(g, beltC, st, null, 0.35);
    g.restore();
    torsoPath(g, sp); g.strokeStyle = ink; g.lineWidth = st.lw; g.stroke();
    poly(g, [[3.4, -32.4], [5, -32.6], [5.1, -29.4], [3.5, -29.2]]); fillPath(g, ART.PAL.gold, st, null, 0.3);
    // below the belt: tassets, leather strips, a tabard
    if (sp.heavy) { for (const [x0, x1] of [[-4.4, 1], [0.4, 5.2]]) { poly(g, [[x0, -29.4], [x1, -29.6], [x1 + 0.8, -22.6], [x0 + 0.4, -22]]); fillPath(g, cm.c, st, [x1, -29, x0, -23], 0.4); line(g, [[x0 + 0.5, -23.4], [x1 + 0.6, -24]], cm.trim, 0.5); } }
    else if (sp.light) { poly(g, [[-4.6, -29.4], [4.8, -29.6], [5.4, -24.4], [-4.8, -24]]); fillPath(g, cm.d, st, [5, -29, -4, -24], 0.4); g.strokeStyle = tone(cm.d, -0.3); g.lineWidth = 0.3; for (let x = -3; x < 5; x += 2) { g.beginPath(); g.moveTo(x, -29.2); g.lineTo(x + 0.2, -24.3); g.stroke(); } }
    if (F.tabard) { poly(g, [[1.4, -31], [5.4, -31.2], [6, -15], [1.6, -15]]); fillPath(g, F.tabard, st, [6, -30, 1, -16], 0.45); line(g, [[1.6, -15.6], [5.9, -15.6]], cm.trim, 0.7); }
    // collar, fur and feathers
    if (F.fur) { const n = F.fur > 1 ? 7 : 5; for (let i = 0; i < n; i++) dot(g, -3.6 + i * (7.6 / (n - 1)), -49.4 + Math.sin(i * 1.7) * 0.6, F.fur > 1 ? 1.5 : 1.2, i % 2 ? "#d8c8a8" : "#b8a080", st, 0.3); }
    if (F.feathers) for (let k = 0; k < 3; k++) { poly(g, [[-3 + k * 1.2, -48], [-6 + k * 1.6, -53.5 - k * 0.6], [-1.8 + k * 1.2, -48]]); fillPath(g, ["#8e2b25", "#e9dcc0", "#3d5d36"][k], st, null, 0.3); }
    if (F.gem) { poly(g, [[5.4, -42.6], [6.4, -41], [5.4, -39.4], [4.4, -41]]); fillPath(g, F.gem, st, null, 0.3); }
    if (sp.amulet) { line(g, [[0.6, -49.6], [3, -45.5], [4.7, -43.2]], sp.amulet, 0.35); dot(g, 4.9, -42.6, 0.85, sp.amulet, st, 0.25); dot(g, 4.9, -42.6, 0.4, "#c4372e", st); }
    if (sp.wk === "bow") line(g, [[2.6, -49], [-4.8, -31]], "#5e4630", 1);   // the quiver strap
    if (F.glow) glowAt(g, 1, -39, 9, F.glow, 0.32, st);
    if (sp.aglow) glowAt(g, 1, -39, 9, "#9fd0f0", 0.25, st);
  }

  // ---- the head (drawn around HEAD, face to the right)
  function headShape(g, sp) {
    g.beginPath();
    if (sp.ears === "lizard") {
      g.moveTo(-1, -5.6); g.quadraticCurveTo(3, -6, 4.2, -3); g.quadraticCurveTo(5.4, -1.4, 8.8, 0.2); g.quadraticCurveTo(9.9, 1, 9.1, 2.2);
      g.lineTo(4.6, 3.4); g.quadraticCurveTo(4.5, 5.2, 2.4, 5.2); g.quadraticCurveTo(0, 5, -0.8, 3); g.quadraticCurveTo(-4.6, 2.4, -4.4, -1.2); g.quadraticCurveTo(-4.2, -5.4, -1, -5.6);
    } else if (sp.ears === "cat") {
      g.moveTo(-1, -6); g.quadraticCurveTo(3, -6.2, 3.9, -3.2); g.quadraticCurveTo(4.3, -1.6, 5.2, -0.4); g.quadraticCurveTo(7, 0.4, 6.9, 1.6);
      g.quadraticCurveTo(6.6, 2.6, 5.4, 2.8); g.quadraticCurveTo(5.4, 3.8, 4.5, 4.2); g.quadraticCurveTo(4, 5.4, 2.4, 5.4); g.quadraticCurveTo(0.2, 5.4, -0.8, 3.4);
      g.quadraticCurveTo(-4.8, 2.6, -4.6, -1.2); g.quadraticCurveTo(-4.4, -5.8, -1, -6);
    } else {
      const orc = sp.ears === "orc", jaw = (orc ? 0.6 : sp.fem ? -0.3 : 0) + [0, 0.55, -0.4, 0.35][sp.face || 0];
      const nx = (orc ? 5.3 : sp.fem ? 5.3 : 5.7) + [0, 0.35, 0.15, -0.45][sp.nose || 0], ny = 1.7 + [0, 0.35, 0.1, -0.1][sp.nose || 0];
      g.moveTo(-1, -6.1); g.quadraticCurveTo(3.2, -6.2, 4, -3); g.quadraticCurveTo(orc ? 5 : 4.5, -1.6, 4.2, -0.8);
      if (sp.nose === 1) g.quadraticCurveTo(nx - 0.2, 0.2, nx, ny); else g.lineTo(nx, ny); g.lineTo(4.5, 2.3); g.quadraticCurveTo(4.8, 2.8, 4.4, 3.3); g.quadraticCurveTo(4.7, 3.9, 4.1 + jaw * 0.4, 4.4);
      if (sp.face === 3) { g.lineTo(4 + jaw, 5.3 + jaw * 0.3); g.lineTo(2.6, 5.6 + jaw * 0.2); } else g.quadraticCurveTo(4 + jaw, 5.4 + jaw * 0.3, 2.6, 5.5 + jaw * 0.2); g.quadraticCurveTo(0.6, 5.5, -0.6, 3.4); g.quadraticCurveTo(-4.6, 2.6, -4.4, -1.2); g.quadraticCurveTo(-4.2, -5.8, -1, -6.1);
    }
    g.closePath();
  }
  function hairCap(g, sp) {
    g.beginPath(); g.moveTo(3.8, -3.4); g.quadraticCurveTo(3.4, -7, -1, -6.8); g.quadraticCurveTo(-5.4, -6, -4.9, -0.6); g.quadraticCurveTo(-4.7, 1.8, -3.5, 2.8);
    g.quadraticCurveTo(-2.6, 0.4, -1.6, -1.2); g.quadraticCurveTo(0.8, -3.4, 3.8, -3.4); g.closePath();
  }
  function head(g, sp, P, st) {
    const ink = st.ink, skin = sp.skin, hc = sp.hairC, helm = sp.helm, hood = sp.hood || (helm && helm.kind === "hood" ? helm.f.hood || helm.set.c : null) || (helm && helm.kind === "mask" ? "#2c2420" : null);
    g.save(); g.translate(HEAD[0], HEAD[1]); g.rotate(P.tilt || 0);
    const covered = !!helm || !!hood;
    // behind the head: long hair, braid, bun, hood drape, lizard horns
    if (hc && !covered) {
      if (sp.hairStyle === "long") { smooth(g, [[-1.6, -6.4], [-5.4, -4], [-5.8, 2], [-6, 8.4], [-3.2, 9.6], [-2.4, 4], [-1.4, 0]]); fillPath(g, hc, st, [-1, -6, -6, 8]); }
      if (sp.hairStyle === "braid") { for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(-4.4 - i * 0.25, 2.6 + i * 1.6, 1.25, 1, 0.3, 0, TAU); fillPath(g, hc, st, null, st.lw * 0.7); } }
      if (sp.hairStyle === "bun") { dot(g, -4.4, -4.4, 2.2, hc, st, st.lw * 0.8); }
      if (sp.hairStyle === "ponytail") { smooth(g, [[-3.6, -4.8], [-6.6, -3.4], [-7.8, 1.4], [-7, 6.4], [-5.6, 4.4], [-5.4, 0], [-3.8, -2.2]]); fillPath(g, hc, st, [-3, -5, -7, 5]); dot(g, -5.4, -3.6, 0.7, tone(hc, -0.35), st); }
      if (sp.hairStyle === "wild") { for (let i = 0; i < 6; i++) { const a = -2.6 + i * 0.42, x = -1 + Math.cos(a) * 4.6, y = -0.6 + Math.sin(a) * 5.4; poly(g, [[x + 1.1 * Math.sin(a), y - 1.1 * Math.cos(a)], [x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2], [x - 1.1 * Math.sin(a), y + 1.1 * Math.cos(a)]]); fillPath(g, hc, st, null, st.lw * 0.7); } }
    }
    if (hood) { smooth(g, [[4.6, -3.6], [3.6, -8.4], [-1.6, -8.2], [-6.4, -6.4], [-6.6, 0], [-6.4, 5], [-4.8, 8.2], [-0.6, 7.4], [2.2, 5.6], [1.4, 1], [2.6, -2.4]]); fillPath(g, tone(hood, -0.25), st, [3, -8, -6, 6], 0); }
    if (sp.ears === "lizard" && !covered && sp.horns && sp.horns !== "frills") lizardCrest(g, sp, st);
    else if (sp.ears === "lizard" && !covered) for (let i = 0; i < 4; i++) { poly(g, [[-2.6 + i * 0.6, -5 + i * 1.6], [-8.4 - i * 0.4, -6.4 + i * 3], [-3.4 + i * 0.6, -3.4 + i * 1.6]]); fillPath(g, sp.hornI ? (i % 2 ? sp.hornC : tone(sp.hornC, 0.15)) : i % 2 ? "#4d6a44" : "#5e7a50", st, null, st.lw * 0.7); }
    // the head
    headShape(g, sp); fillPath(g, skin, st, [4, -5, -4, 4]);
    // ears
    if (!covered || helm?.kind === "metal" && !helm.visor) {
      if (sp.ears === "elf") { poly(g, [[-0.6, -0.4], [-4.8, -5.2], [-1.6, 1.8]]); fillPath(g, skin, st, [-1, -1, -4, -4]); }
      else if (sp.ears === "orc") { poly(g, [[-0.4, -0.6], [-3.6, -3.4], [-1.2, 2]]); fillPath(g, skin, st, null); }
      else if (sp.ears === "round") { g.beginPath(); g.ellipse(-0.7, 0.4, 1.15, 1.85, 0.15, 0, TAU); fillPath(g, skin, st, [0, -1, -1.5, 2]); line(g, [[-0.4, -0.6], [-1, 0.4], [-0.5, 1.4]], sp.skinD, 0.3); }
    }
    if (sp.ears === "cat" && !covered) { for (const dx of [0, -2.6]) { poly(g, [[0.6 + dx, -5.6], [1.2 + dx, -9.8], [3.4 + dx, -5]]); fillPath(g, dx ? sp.skinD : skin, st, null); if (!dx) { poly(g, [[1.3, -6], [1.6, -8.4], [2.7, -5.6]]); g.fillStyle = "#c98a7a"; g.fill(); } } }
    // the face
    const eyeX = sp.ears === "lizard" ? 3.6 : 2.9, eyeY = sp.ears === "lizard" ? -1.6 : -0.7;
    g.beginPath(); g.ellipse(eyeX, eyeY, 0.85, 0.55, 0, 0, TAU); g.fillStyle = sp.ears === "lizard" || sp.ears === "cat" ? sp.eyes : "#f4f0e6"; g.fill();
    g.fillStyle = sp.ears === "lizard" || sp.ears === "cat" ? "#1c1714" : sp.eyes; g.beginPath();
    if (sp.ears === "lizard" || sp.ears === "cat") g.ellipse(eyeX + 0.2, eyeY, 0.18, 0.5, 0, 0, TAU); else g.arc(eyeX + 0.3, eyeY, 0.42, 0, TAU);
    g.fill();
    if (sp.vamp) glowAt(g, eyeX, eyeY, 2, "#e0302a", 0.5, st);
    g.strokeStyle = ink; g.lineWidth = st.fine;
    g.beginPath(); g.moveTo(eyeX - 0.9, eyeY - 0.5); g.quadraticCurveTo(eyeX, eyeY - 0.95, eyeX + 0.9, eyeY - 0.35); g.stroke();   // lid
    if (sp.ears !== "lizard") { g.lineWidth = (sp.ears === "orc" ? st.fine * 2 : st.fine * 1.4) * [1, 1.7, 0.7, 1][sp.brows || 0]; g.beginPath(); g.moveTo(eyeX - 1, eyeY - 1.3 + (sp.brows === 1 ? 0.15 : 0)); if (sp.brows === 3) g.quadraticCurveTo(eyeX, eyeY - 2.1, eyeX + 1.2, eyeY - 1.2); else g.lineTo(eyeX + 1.2, eyeY - 1.1); g.stroke(); }   // brow
    g.lineWidth = st.fine;
    if (sp.ears === "lizard") { g.beginPath(); g.moveTo(4.6, 3.2); g.lineTo(8.6, 1.8); g.stroke(); dot(g, 8.6, 0.6, 0.3, ink, st); for (const [x, y] of [[0, -3], [2, -4], [-2, -1], [1, 1], [5, -1.6]]) dot(g, x, y, 0.55, "rgba(0,0,0,0.14)", st); }
    else if (sp.ears === "cat") {
      dot(g, 6.6, 0.9, 0.55, "#3b2c1e", st); line(g, [[5.4, 2.8], [4.6, 3.1]], ink, st.fine);
      g.strokeStyle = "rgba(244,240,230,0.85)"; g.lineWidth = st.fine * 0.8; for (const dy of [1.2, 2.1]) { g.beginPath(); g.moveTo(5.4, dy); g.lineTo(9, dy - 0.6 + (dy - 1.5)); g.stroke(); }
      g.strokeStyle = "rgba(59,44,30,0.45)"; g.lineWidth = st.fine * 1.4; for (const x of [0.4, 2]) { g.beginPath(); g.moveTo(x, -6); g.lineTo(x + 0.5, -4); g.stroke(); }
    } else {
      if (!sp.mouth) line(g, [[3.7, 3.4], [4.4, 3.3]], ink, st.fine);   // mouth
      else { g.strokeStyle = ink; g.lineWidth = st.fine * (sp.mouth === 2 ? 1.3 : 1); g.beginPath(); g.moveTo(sp.mouth === 2 ? 3.4 : 3.6, sp.mouth === 3 ? 3.6 : 3.35); g.quadraticCurveTo(4, sp.mouth === 1 ? 3.85 : sp.mouth === 3 ? 3.05 : 3.4, 4.45, sp.mouth === 1 ? 3.05 : sp.mouth === 3 ? 3.65 : 3.3); g.stroke(); }
      if (sp.nose === 2) line(g, [[4.4, 1.9], [5, 2.4]], ink, st.fine * 1.3); else line(g, [[4.6, 1.9], [4.9, 2.2]], ink, st.fine);   // nostril
      if (sp.ears === "orc") { poly(g, [[3.7, 4.2], [4.2, 2.4], [4.6, 4.3]]); fillPath(g, "#f4f0e6", st, null, st.fine); }
      if (sp.fem) dot(g, 2.4, 1.6, 1, "rgba(200,90,80,0.22)", st);
    }
    if (sp.paint && !covered && (!sp.paintS || sp.paintS === "band")) { g.globalAlpha = 0.55; g.fillStyle = sp.paint; g.fillRect(1.2, -1.4, 3.2, 1.3); g.globalAlpha = 1; }
    if (sp.A) faceMarks(g, sp, st, eyeX, eyeY, covered);
    // beard and moustache
    if (sp.beard && hc && !(helm && helm.visor)) {
      const L = sp.beardLen;
      g.beginPath(); g.moveTo(0.2, 0.8); g.quadraticCurveTo(0.6, 4.6, 2.4, 5.6 + L * 0.4); g.lineTo(3.6, 5.8 + L); g.quadraticCurveTo(4.9, 5.6 + L * 0.5, 4.7, 3.9); g.lineTo(3.8, 3.8); g.quadraticCurveTo(2.6, 4.1, 1.8, 2.4); g.closePath();
      fillPath(g, hc, st, [4, 2, 1, 6 + L]); line(g, [[3.9, 2.5], [5, 2.8], [5.1, 3.4]], hc, 0.9);
      g.strokeStyle = tone(hc, -0.3); g.lineWidth = st.fine * 0.8; for (const x of [1.6, 2.6, 3.5]) { g.beginPath(); g.moveTo(x, 3.6); g.lineTo(x + 0.4, 5 + L * 0.7); g.stroke(); }
      if (sp.beardStyle === "braided") for (const y of [5.6 + L * 0.45, 5.6 + L * 0.8]) line(g, [[2.4, y], [4, y - 0.3]], "#8f8a84", st.fine * 1.6);   // braid rings
    } else if (sp.beardStyle === "stubble" && !(helm && helm.visor)) { g.beginPath(); g.moveTo(0.4, 1.2); g.quadraticCurveTo(0.8, 4.6, 2.6, 5.3); g.quadraticCurveTo(4.2, 5.2, 4.4, 3.8); g.quadraticCurveTo(2.6, 4, 1.8, 2.2); g.closePath(); g.fillStyle = "rgba(50,36,26,0.22)"; g.fill(); }
    else if (!sp.fem && sp.ears === "round" && !covered) dot(g, 2.6, 3.8, 1.6, "rgba(60,40,30,0.08)", st);   // stubble
    // hair on top
    if (hc && !covered) {
      if (sp.hairStyle === "bald") { /* nothing on top */ }
      else if (sp.hairStyle === "mohawk") { smooth(g, [[3, -5.2], [1.6, -7.8], [-1.6, -8.2], [-4.6, -6.4], [-5.4, -3.2], [-4.2, -4.8], [-1.4, -6.4], [1.4, -6.2]]); fillPath(g, hc, st, [2, -8, -4, -4]); }
      else if (sp.hairStyle === "shaved") { hairCap(g, sp); g.globalAlpha = 0.45; g.fillStyle = hc; g.fill(); g.globalAlpha = 1; }
      else if (sp.ears !== "cat" || sp.hairStyle !== "short") {
        hairCap(g, sp); fillPath(g, hc, st, [3, -7, -4, 2]);
        g.strokeStyle = tone(hc, -0.32); g.lineWidth = st.fine * 0.9; for (const [a, b] of [[[2.6, -5.4], [-2, -4.6]], [[1.2, -6], [-3.6, -2.4]], [[3.2, -4.2], [-1.4, -2.6]]]) { g.beginPath(); g.moveTo(...a); g.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 0.8, ...b); g.stroke(); }
        g.strokeStyle = tone(hc, 0.35); g.beginPath(); g.moveTo(1.8, -6.2); g.quadraticCurveTo(-0.6, -6.6, -2.6, -5.6); g.stroke();
      }
    }
    // headgear
    if (helm) helmet(g, sp, helm, st);
    else if (sp.hood) hoodFront(g, sp.hood, st);
    g.restore();
  }
  function hoodFront(g, c, st) {
    g.beginPath(); g.moveTo(4.6, -3.6); g.quadraticCurveTo(4.2, -8.6, -1.4, -8.4); g.quadraticCurveTo(-6.6, -7.6, -6.6, -0.4); g.quadraticCurveTo(-6.8, 4.6, -4.4, 8.2);
    g.lineTo(-0.4, 7.6); g.quadraticCurveTo(2, 6.6, 1.4, 4.8); g.quadraticCurveTo(0.4, 1.6, 1.6, -1); g.quadraticCurveTo(2.6, -3, 4.6, -3.6); g.closePath();
    fillPath(g, c, st, [3, -8, -6, 6]);
    g.strokeStyle = tone(c, -0.35); g.lineWidth = st.fine; g.beginPath(); g.moveTo(-2.4, -6.4); g.quadraticCurveTo(-4.8, -1, -3.6, 6.4); g.stroke();
  }
  function helmet(g, sp, h, st) {
    const s = h.set, f = h.f, k = h.k, ink = st.ink, c = s.c || "#8f8a84", dk = s.d || tone(c, -0.3), tr = s.trim || tone(c, 0.3);
    if (h.kind === "hood") {
      hoodFront(g, f.hood || c, st);
      if (k === "nightingale" || k === "guild" || k === "shrouded") { poly(g, [[1.6, 0.6], [5.6, 1.4], [5, 5.4], [1.8, 5.4]]); fillPath(g, dk, st, null, st.fine); }
      if (f.feathers) for (let i = -1; i <= 1; i++) { poly(g, [[-1 + i * 1.6, -7.6], [-2 + i * 2.4, -13], [0.2 + i * 1.6, -7.6]]); fillPath(g, ["#8e2b25", "#e9dcc0", "#3d5d36"][i + 1], st, null, st.fine); }
      return;
    }
    if (h.kind === "mask") {
      hoodFront(g, "#2c2420", st);
      g.beginPath(); g.moveTo(3.4, -5); g.quadraticCurveTo(5.6, -3, 5.4, 0); g.lineTo(6.2, 1.8); g.lineTo(5, 2.6); g.quadraticCurveTo(5.4, 5, 3, 6); g.lineTo(2, 5.6); g.quadraticCurveTo(1, 0, 3.4, -5); g.closePath();
      fillPath(g, "#b8893e", st, [5, -4, 2, 5]); line(g, [[3.4, -1], [4.8, -0.8]], "#1c1714", 0.6);
      return;
    }
    if (h.kind === "coif") {
      g.beginPath(); g.moveTo(4.4, -3.4); g.quadraticCurveTo(4, -7.6, -1.2, -7.4); g.quadraticCurveTo(-6, -6.6, -5.8, -0.4); g.quadraticCurveTo(-5.8, 4.2, -3.8, 7); g.lineTo(1.4, 6.6); g.quadraticCurveTo(2.4, 4.6, 1.6, 2.4); g.quadraticCurveTo(1.2, -1, 2.4, -2.6); g.closePath();
      fillPath(g, c, st, [3, -7, -5, 5]);
      g.save(); g.clip(); g.fillStyle = dk; for (let y = -7; y < 7; y += 1.3) for (let x = -6 + ((y / 1.3) % 2) * 0.65; x < 4; x += 1.3) g.fillRect(x, y, 0.45, 0.45); g.restore();
      return;
    }
    if (h.kind === "cap") {
      g.beginPath(); g.moveTo(4.4, -2.6); g.quadraticCurveTo(4, -7.8, -1, -7.6); g.quadraticCurveTo(-5.8, -7, -5.4, -1.2); g.lineTo(-5.6, 1.4); g.lineTo(-3, 1.2); g.lineTo(-1.6, -1.6); g.lineTo(4.4, -2.6); g.closePath();
      fillPath(g, c, st, [3, -7, -5, 0]);
      const band = k === "hide" || k === "fur" || k === "stormcloak" ? "#d8c8a8" : tr;
      g.beginPath(); g.moveTo(4.8, -3.4); g.quadraticCurveTo(0, -4.6, -5.8, -1.4); g.lineTo(-5.8, 0.4); g.quadraticCurveTo(0, -2.8, 4.8, -1.6); g.closePath(); fillPath(g, band, st, null, st.fine);
      return;
    }
    // metal helmets: a dome, a neck guard, maybe cheek plates, a nasal or a full visor
    const horn = (x0, y0, pts, col) => { smooth(g, [[x0 - 1.2, y0 + 0.8], ...pts, [x0 + 1.2, y0 - 0.4]], true); fillPath(g, col, st, [x0, y0 - 6, x0 + 3, y0], st.lw * 0.8); };
    if (f.horns || k === "iron" || k === "nord") {   // the far horn first
      const big = f.horns > 1 ? 1.5 : 1, hc = k === "iron" ? "#e8dcc0" : k === "nord" ? tr : f.horns > 1 ? tr : "#e6e0cc";
      if (k === "nord") horn(-2, -5.4, [[-5, -9.6 * big], [-8.4, -9.2 * big]], tone(hc, -0.3));
      else horn(-1.4, -6, [[0, -10.6 * big], [3 * big, -12.6 * big]], tone(hc, -0.3));
    }
    g.beginPath(); g.moveTo(4.8, -1.2); g.quadraticCurveTo(5, -7.6, -0.8, -7.6); g.quadraticCurveTo(-6, -7.2, -5.6, -1); g.lineTo(-5.8, 3.4); g.lineTo(-2.6, 3.6); g.lineTo(-1.6, -0.2); g.quadraticCurveTo(1.6, -1.4, 4.8, -1.2); g.closePath();
    fillPath(g, c, st, [3, -8, -5, 2]);
    if (s.metal) { g.save(); g.clip(); const gr = g.createLinearGradient(0, -8, 3, -3); gr.addColorStop(0.2, "rgba(255,255,255,0)"); gr.addColorStop(0.42, `rgba(255,255,255,${0.5})`); gr.addColorStop(0.6, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(-7, -9, 13, 8); g.restore(); }
    g.beginPath(); g.moveTo(5.1, -2.2); g.quadraticCurveTo(0, -3, -5.9, -0.6); g.lineTo(-5.9, 0.8); g.quadraticCurveTo(0, -1.6, 5.1, -0.8); g.closePath(); fillPath(g, dk, st, null, st.fine);   // the brim band
    if (h.visor) {
      g.beginPath(); g.moveTo(4.8, -1.4); g.lineTo(6.2, 1.6); g.lineTo(5.2, 3); g.quadraticCurveTo(5.2, 5.6, 2.4, 6); g.lineTo(-0.6, 5.6); g.lineTo(-1.6, -0.2); g.closePath();
      fillPath(g, c, st, [5, -1, 0, 6]); line(g, [[1.6, -0.6], [5.4, -0.4]], "#14100c", 0.75);
      if (f.glow) { glowAt(g, 4, -0.5, 2.6, f.glow, 0.8, st); line(g, [[2.4, -0.6], [5, -0.5]], f.glow, 0.5); }
    } else if (k === "steel" || k === "nord" || k === "imperial" || s.w === "heavy" || f.spikes) {
      poly(g, [[-0.6, -0.6], [2.6, -0.8], [2.8, 4.6], [0.6, 5.2], [-1.2, 2.4]]); fillPath(g, c, st, [3, 0, -1, 4], st.lw * 0.8);   // cheek plate
      if (k === "steel" || k === "imperial") { poly(g, [[4.4, -1.4], [5.2, -1.3], [5.5, 2], [4.9, 2]]); fillPath(g, dk, st, null, st.fine); }   // nasal guard
    }
    if (k === "iron") horn(1.4, -6.2, [[3.4, -10.6], [6.6, -12]], "#e8dcc0");
    else if (k === "nord") horn(0.6, -5.8, [[-2.4, -10.4], [-6.4, -10.8]], tr);
    else if (f.horns) { const big = f.horns > 1 ? 1.5 : 1; horn(1, -6, [[3 * big, -10.6 * big], [6 * big, -12.6 * big]], f.horns > 1 ? tr : "#e6e0cc"); }
    if (k === "dwarven") { poly(g, [[-2.4, -7.4], [2, -7.6], [1, -10.6], [-1.4, -10.4]]); fillPath(g, tr, st, null, st.fine); }
    if (k === "elven") { g.beginPath(); g.moveTo(3, -6.4); g.quadraticCurveTo(0, -12.6, -5.4, -12.4); g.quadraticCurveTo(-2, -10, -2.2, -7); g.closePath(); fillPath(g, tr, st, [1, -12, -4, -7]); }
    if (f.spikes) for (let i = 0; i < (f.spikes > 1 ? 3 : 2); i++) { poly(g, [[-3.6 + i * 2.6, -7], [-3.2 + i * 2.6, -10.4 - (i === 1 ? 1 : 0)], [-1.8 + i * 2.6, -7.2]]); fillPath(g, tr, st, null, st.fine); }
    if (f.bone) { poly(g, [[-3.6, -7], [-1, -12], [1.4, -7.4]]); fillPath(g, tr, st, null, st.fine); }
    if (f.ridges) line(g, [[2, -7.2], [-1.4, -7.4], [-4.6, -5.4]], dk, 0.6);
    if (f.translucent) { g.globalAlpha = 0.32; g.fillStyle = "#fff"; g.beginPath(); g.ellipse(0.6, -5.4, 1, 1.8, -0.6, 0, TAU); g.fill(); g.globalAlpha = 1; }
    if (f.fur) for (let i = 0; i < 4; i++) dot(g, -5.4 + i * 1.6, 1.4 + i * 0.2, 1, "#d8c8a8", st, 0.25);
  }

  // ---- limbs, along their bones
  function leg(g, sp, th, sh, ft, st, far) {
    const dk = far ? -0.24 : 0, kx = sh.x, ky = sh.y, ax = ft.x, ay = ft.y;
    const legC = tone(sp.legC, dk), gv = sp.greave;
    limb(g, th.x, th.y, kx, ky, sp.fem ? 6.2 : 6, 4.5, legC, st);
    limb(g, kx, ky, ax, ay, 4.5, 3.3, gv ? tone(gv.c, dk) : legC, st);
    if (gv) { dot(g, kx + 0.4, ky, 2, tone(gv.trim, dk), st, st.lw * 0.8); if (gv.metal) line(g, [[kx + 1.2, ky + 2.2], [ax + 1.1, ay - 2]], tone("#ffffff", -0.1), 0.45); }
    // boots
    const b = sp.boots, bc = b ? tone(b.c, dk) : sp.barefoot ? tone(sp.skin, dk) : tone("#5e4630", dk);
    if (b) { const bx = ax + (kx - ax) * 0.45, by = ay + (ky - ay) * 0.45; limb(g, ax, ay, bx, by, 3.9, 4.2, bc, st); line(g, [[bx - 1.9, by + 0.2], [bx + 2, by - 0.2]], tone(b.trim || bc, dk), 0.8);
      if (sp.bootsK === "hide" || sp.bootsK === "fur") for (let i = 0; i < 3; i++) dot(g, bx - 1.6 + i * 1.6, by, 0.9, "#d8c8a8", st, 0.2); }
    g.save(); g.translate(ax, ay); g.rotate(ft.a);   // the foot, in the foot bone's frame
    g.beginPath(); g.moveTo(-2.1, -1.3); g.lineTo(1.4, -0.9); g.quadraticCurveTo(4.6, 0.2, 5.4, 1.6); g.lineTo(5.4, 2.2); g.lineTo(-2.4, 2.2); g.closePath();
    fillPath(g, bc, st, [2, -1, 0, 2.2]);
    if (sp.barefoot) for (const dx of [4.2, 5.2]) line(g, [[dx, 2], [dx + 0.8, 2.4]], "#f4f0e6", 0.35);
    g.restore();
  }
  function arm(g, sp, st, up, fo, hand, far) {
    const dk = far ? -0.24 : 0, ex = fo.x, ey = fo.y;
    const upC = tone(sp.sleeveC, dk), foC = tone(sp.foreC || sp.skin, dk);
    limb(g, up.x, up.y, ex, ey, sp.heavy ? 4.8 : 4.3, 3.7, upC, st);
    limb(g, ex, ey, hand.x, hand.y, 3.7, 3, foC, st);
    if (sp.bare) { const mx = up.x + (ex - up.x) * 0.7, my = up.y + (ey - up.y) * 0.7; limb(g, mx, my, ex, ey, 3.9, 3.8, tone(sp.skin, dk), st, st.fine); }   // short sleeves
    if (sp.gloves) { const cx = ex + (hand.x - ex) * 0.45, cy = ey + (hand.y - ey) * 0.45; line(g, [[cx - 1.5, cy - 0.6], [cx + 1.5, cy + 0.6]], tone(sp.gloves.trim || foC, dk), 0.9); }
    return tone(sp.gloves ? sp.gloves.c : sp.skin, dk);
  }
  function fist(g, x, y, col, st, ring) { dot(g, x, y, 1.75, col, st, st.lw * 0.9); if (ring) dot(g, x + 0.6, y + 0.9, 0.45, ring, st); }
  function pauldron(g, sp, st) {
    const cm = sp.cm, F = sp.F; if (!cm || !(sp.heavy || (sp.light && F.ridges))) return;
    const r = sp.heavy ? 4.2 : 3.2, [x, y] = SH_N;
    g.beginPath(); g.ellipse(x - 0.2, y + 0.4, r, r * 0.82, -0.2, Math.PI * 0.95, Math.PI * 2.08); g.closePath(); fillPath(g, F.bone ? cm.c : cm.d, st, [x + 2, y - 3, x - 2, y + 2]);
    if (cm.metal) line(g, [[x - 2, y - 2.2], [x + 2, y - 2.6]], tone(cm.c, 0.45), 0.5);
    if (F.spikes) for (let i = 0; i < (F.spikes > 1 ? 3 : 2); i++) { poly(g, [[x - 2.6 + i * 2, y - 2.6], [x - 2.6 + i * 2.2, y - 6.4 - i * 0.5], [x - 1.2 + i * 2, y - 2.8]]); fillPath(g, cm.trim, st, null, st.fine); }
    if (F.fur && !sp.heavy) for (let i = 0; i < 3; i++) dot(g, x - 2 + i * 2, y - 2.4, 1, "#d8c8a8", st, 0.25);
  }

  // ---- weapons, in the hand's frame (the same tips as the fight scene's weapons)
  const TIP = { dagger: [10, -8], sword: [20, -20], greatsword: [28, -28], axe: [19, -16], battleaxe: [28, -22], mace: [16, -16], warhammer: [18, -18], spear: [32, -30], club: [18, -24], staff: [10, -32] };
  function bladeCol(sp) { const m = sp.wset; if (!m || m.w === "cloth" || ["wood", "hide", "leather", "forsworn"].includes(sp.wkey)) return { c: "#cfd3d6", d: "#8f969b", t: "#eef1f2" }; const c = m.d && /^#[0-3]/.test(m.c) ? m.c : m.trim; return { c, d: tone(c, -0.35), t: tone(c, 0.45) }; }
  function weapon(g, sp, wk, st, o = {}) {
    if (!wk || wk === "fist") return;
    const bc = o.plain ? { c: "#cfd3d6", d: "#8f969b", t: "#eef1f2" } : bladeCol(sp), wood = "#7a5232", grip = "#4a3424", gc = sp.wset ? sp.wset.d || "#6f6a64" : "#6f6a64";
    const glow = o.glow || sp.ench, ink = st.ink;
    g.save();
    if (glow) { g.shadowColor = glow; g.shadowBlur = 4 * (st.k || 1); }
    if (wk === "bow") {
      const dr = o.draw || 0, bowC = /elven/.test(sp.wkey || "") ? "#c9a75e" : sp.wkey === "dwarven" ? "#c08a3c" : "#7a5232";
      g.lineCap = "round"; g.strokeStyle = ink; g.lineWidth = 2.6; g.beginPath(); g.arc(-6, 0, 20, -1.1, 1.1); g.stroke(); g.strokeStyle = bowC; g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = tone(bowC, 0.35); g.lineWidth = 0.4; g.beginPath(); g.arc(-6.4, 0, 20, -0.9, 0.9); g.stroke();
      limb(g, 0, -2, 0, 2, 2, 2, "#3b2c1e", st, st.fine);
      const sx = -6 + 20 * Math.cos(1.1), sy = 20 * Math.sin(1.1), px = sx - dr * 13;
      g.strokeStyle = "#e9dcc0"; g.lineWidth = 0.4; g.beginPath(); g.moveTo(sx, -sy); g.lineTo(px, 0); g.lineTo(sx, sy); g.stroke();
      if (dr > 0.05) { line(g, [[px, 0], [px + 26, 0]], ink, 1.3); line(g, [[px, 0], [px + 26, 0]], "#c9a878", 0.7); poly(g, [[px + 29, 0], [px + 25, -1.4], [px + 25, 1.4]]); fillPath(g, "#cfd3d6", st, null, st.fine); poly(g, [[px, 0], [px + 3, -1.2], [px + 3.4, 0], [px + 3, 1.2]]); g.fillStyle = "#a8442e"; g.fill(); }
      g.restore(); return;
    }
    if (wk === "crossbow") {
      const dw = sp.wkey === "dwarven";
      limb(g, -8, 0, 16, 0, 2.6, 2.2, dw ? "#8f6328" : wood, st); g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.arc(14, 0, 10, -1.4, 1.4); g.stroke(); g.strokeStyle = dw ? "#e0b060" : "#8f8a84"; g.lineWidth = 1.2; g.stroke();
      g.strokeStyle = "#e9dcc0"; g.lineWidth = 0.4; g.beginPath(); g.moveTo(14 + 10 * Math.cos(-1.4), 10 * Math.sin(-1.4)); g.lineTo(4 + (1 - (o.draw || 0)) * 6, 0); g.lineTo(14 + 10 * Math.cos(1.4), 10 * Math.sin(1.4)); g.stroke();
      if ((o.draw || 0) > 0.05) { line(g, [[2, -1.2], [20, -1.2]], "#cfd3d6", 0.8); }
      g.restore(); return;
    }
    const t = TIP[wk] || TIP.sword, L = Math.hypot(t[0], t[1]);
    g.rotate(Math.atan2(t[1], t[0]));
    if (wk === "dagger" || wk === "sword" || wk === "greatsword") {
      const big = wk === "greatsword", w = big ? 3 : wk === "dagger" ? 1.8 : 2.4, gs = big ? 5 : 3, ge = big ? 4.6 : wk === "dagger" ? 2.4 : 3.4;
      limb(g, -gs + 0.5, 0, gs - 0.5, 0, 1.5, 1.5, grip, st, st.fine);
      dot(g, -gs, 0, big ? 1.3 : 1, gc, st, st.fine);
      g.beginPath(); g.moveTo(gs + 0.6, -w / 2); g.lineTo(L - w * 1.2, -w / 2); g.lineTo(L, 0); g.lineTo(L - w * 1.2, w / 2); g.lineTo(gs + 0.6, w / 2); g.closePath();
      fillPath(g, bc.c, st, [gs, -w / 2, gs, w / 2]);
      line(g, [[gs + 1.4, -w * 0.18], [L - w * 1.6, -w * 0.12]], bc.t, Math.max(0.3, w * 0.22));
      if (wk !== "dagger") line(g, [[gs + 1.4, w * 0.15], [L - w * 2, w * 0.1]], bc.d, 0.3);
      limb(g, gs, -ge, gs, ge, 1.3, 1.3, gc, st, st.fine);
    } else if (wk === "axe" || wk === "battleaxe") {
      const big = wk === "battleaxe", hl = big ? L + 2 : L + 1;
      limb(g, -3, 0, hl, 0, big ? 1.9 : 1.6, big ? 1.7 : 1.4, wood, st, st.fine);
      const hx = hl - (big ? 5 : 4), s = big ? 1.35 : 1;
      g.beginPath(); g.moveTo(hx - 2 * s, 0.6); g.quadraticCurveTo(hx - 3 * s, 4 * s, hx - 4.6 * s, 7.4 * s); g.quadraticCurveTo(hx + 1.6 * s, 7.6 * s, hx + 4.4 * s, 4.8 * s); g.quadraticCurveTo(hx + 2.2 * s, 3 * s, hx + 2.2 * s, 0.6); g.closePath();
      fillPath(g, bc.c, st, [hx + 3, 5, hx - 3, 1]); line(g, [[hx - 4.2 * s, 7 * s], [hx + 4 * s, 4.6 * s]], bc.t, 0.5);
      if (big) { g.beginPath(); g.moveTo(hx - 2 * s, -0.6); g.quadraticCurveTo(hx - 3 * s, -4 * s, hx - 4.6 * s, -7.4 * s); g.quadraticCurveTo(hx + 1.6 * s, -7.6 * s, hx + 4.4 * s, -4.8 * s); g.quadraticCurveTo(hx + 2.2 * s, -3 * s, hx + 2.2 * s, -0.6); g.closePath(); fillPath(g, bc.c, st, [hx + 3, -5, hx - 3, -1]); }
    } else if (wk === "mace") {
      limb(g, -3, 0, L - 1, 0, 1.6, 1.5, wood, st, st.fine);
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; poly(g, [[L, 0], [L + Math.cos(a) * 3.6, Math.sin(a) * 3.6], [L + Math.cos(a + 0.5) * 2.2, Math.sin(a + 0.5) * 2.2]]); fillPath(g, bc.d, st, null, st.fine); }
      dot(g, L, 0, 2.4, bc.c, st, st.lw); dot(g, L - 0.6, -0.7, 0.7, bc.t, st);
    } else if (wk === "warhammer") {
      limb(g, -4, 0, L + 1, 0, 1.8, 1.7, wood, st, st.fine);
      poly(g, [[L - 2.6, -2.6], [L + 2.6, -2.6], [L + 2.8, 5.4], [L - 2.8, 5.4]]); fillPath(g, bc.c, st, [L + 2, -2, L - 2, 5]);
      poly(g, [[L - 1.4, -2.6], [L, -7], [L + 1.4, -2.6]]); fillPath(g, bc.d, st, null, st.fine);
    } else if (wk === "spear") {
      limb(g, -17, 0, L - 5, 0, 1.5, 1.4, wood, st, st.fine);
      g.beginPath(); g.moveTo(L - 6, 0); g.quadraticCurveTo(L - 3.6, -2.2, L + 1, 0); g.quadraticCurveTo(L - 3.6, 2.2, L - 6, 0); g.closePath(); fillPath(g, bc.c, st, [L - 3, -2, L - 3, 2]);
    } else if (wk === "staff") {
      g.rotate(-(Math.atan2(t[1], t[0]))); g.rotate(Math.atan2(-48, 14));
      const SL = 31.6;
      limb(g, -19.6, 0, SL - 2, 0, 1.6, 1.9, wood, st, st.fine);
      line(g, [[SL - 3, -1.2], [SL + 1.4, -2.6], [SL + 3.6, -1.6]], tone(wood, -0.3), 0.7); line(g, [[SL - 3, 1.2], [SL + 1.4, 2.6], [SL + 3.6, 1.6]], tone(wood, -0.3), 0.7);
      glowAt(g, SL + 2, 0, 6, sp.staffC, 0.7, st); dot(g, SL + 2, 0, 1.6, sp.staffC, st, st.fine);
    } else if (wk === "club") {
      limb(g, -2, 0, L, 0, 2.4, 4.2, wood, st);
    } else { limb(g, -2, 0, L, 0, 1.5, 1.5, bc.c, st); }
    g.restore();
  }
  /* weapons put away: one-handers at the hip, two-handers and bows on the back */
  function slungBack(g, sp, st) {
    const wk = sp.wk; if (!wk) return;
    if (wk === "bow" || wk === "crossbow") {
      g.save(); g.translate(-4.4, -38); g.rotate(-1.15);
      if (wk === "bow") { g.strokeStyle = st.ink; g.lineWidth = 2.2; g.beginPath(); g.arc(-6, 0, 18, -1, 1); g.stroke(); g.strokeStyle = /elven/.test(sp.wkey || "") ? "#c9a75e" : "#7a5232"; g.lineWidth = 1.3; g.stroke(); }
      else { limb(g, -10, 0, 10, 0, 2.4, 2.2, "#7a5232", st); g.strokeStyle = "#8f8a84"; g.lineWidth = 1.2; g.beginPath(); g.arc(8, 0, 8, -1.4, 1.4); g.stroke(); }
      g.restore(); return;
    }
    if (TWO.has(wk) && wk !== "staff") {
      g.save(); g.translate(-4.6, -40); g.rotate(-1.92 + Math.PI);   // hilt up over the shoulder
      weapon(g, sp, wk, st, {}); g.restore();
    }
  }
  function quiver(g, sp, st) {
    if (sp.wk !== "bow") return;
    g.save(); g.translate(-4.2, -40); g.rotate(0.32);
    poly(g, [[-1.8, -6], [1.8, -6], [1.6, 10], [-1.6, 10]]); fillPath(g, "#6b4a2e", st, [2, -6, -2, 10]);
    for (const x of [-1, 0, 1]) { line(g, [[x, -6], [x * 1.4, -9.6]], "#c9a878", 0.4); poly(g, [[x * 1.4, -9.4], [x * 1.4 - 0.8, -11.4], [x * 1.4 + 0.8, -11.4]]); g.fillStyle = "#a8442e"; g.fill(); }
    g.restore();
  }
  function sheathed(g, sp, st) {
    const wk = sp.wk; if (!wk || TWO.has(wk) || wk === "staff" || wk === "fist") return;
    if (wk === "sword" || wk === "dagger") {
      const L = wk === "dagger" ? 8 : 16;
      g.save(); g.translate(0.6, -30.4); g.rotate(2.15);
      limb(g, 0, 0, L, 0, 2.4, 2, "#4a3424", st); dot(g, L, 0, 1.1, "#8f8a84", st, st.fine); line(g, [[1, -0.7], [L - 1, -0.6]], "#6b4a34", 0.35);
      g.restore();
      g.save(); g.translate(0.6, -30.4); g.rotate(2.15 - Math.PI); limb(g, 1.4, 0, 4.8, 0, 1.3, 1.3, "#4a3424", st, st.fine); dot(g, 5.4, 0, 0.9, "#8f8a84", st, st.fine); limb(g, 1.2, -2.2, 1.2, 2.2, 1, 1, sp.wset?.d || "#6f6a64", st, st.fine); g.restore();
      return;
    }
    g.save(); g.translate(1.4, -33); g.rotate(1.75); weapon(g, sp, wk === "axe" || wk === "mace" ? wk : "mace", st, {}); g.restore();
  }
  function shieldAt(g, sp, x, y, front, st) {
    const S = sp.shield || { set: { c: "#7a5232", d: "#553823", trim: "#8f8a84" }, k: "wood", kite: false }, s = S.set, c = S.k === "hide" ? "#7a5232" : s.c, tr = s.trim || "#8f8a84", sf = s.f || {};
    g.save(); g.translate(x + 1.2, y - 1); if (front) g.scale(1.12, 1.08);
    if (S.kite) {
      smooth(g, [[-4.6, -9.6], [0.6, -10.4], [5.4, -9.6], [5.8, 0.4], [3, 7], [0.4, 10.6], [-2.4, 7], [-5, 0.4]]); fillPath(g, c, st, [5, -9, -4, 8]);
      line(g, [[0.4, -9], [0.4, 9]], s.d || tone(c, -0.3), 0.9); line(g, [[-4.4, -2.6], [5.2, -2.6]], s.d || tone(c, -0.3), 0.9);
      g.strokeStyle = tr; g.lineWidth = 0.6; smooth(g, [[-3.8, -8.8], [0.6, -9.5], [4.8, -8.8], [5, 0.2], [2.6, 6.2], [0.4, 9.4], [-1.8, 6.2], [-4.2, 0.2]]); g.stroke();
      if (sf.spikes) for (const sx of [-4.4, 5.2]) { poly(g, [[sx - 1, -9.4], [sx + (sx > 0 ? 2 : -2), -12.4], [sx + 1, -9.4]]); fillPath(g, tr, st, null, st.fine); }
      if (sf.glow) glowAt(g, 0.4, -1, 6, sf.glow, 0.35, st);
    } else {
      g.beginPath(); g.ellipse(0, 0, 6.6, 9.2, 0, 0, TAU); fillPath(g, c, st, [5, -8, -5, 8]);
      if (S.k === "hide" || S.k === "wood") { g.strokeStyle = tone(c, -0.35); g.lineWidth = 0.4; for (const xx of [-3.4, 0, 3.4]) { g.beginPath(); g.moveTo(xx, -8.6 + Math.abs(xx) * 0.6); g.lineTo(xx, 8.6 - Math.abs(xx) * 0.6); g.stroke(); } g.strokeStyle = S.k === "hide" ? "#c9b48f" : tr; }
      else g.strokeStyle = s.d || tone(c, -0.3);
      g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, 0, 5.6, 8.2, 0, 0, TAU); g.stroke();
      dot(g, 0, 0, 2, tr, st, st.fine); dot(g, -0.5, -0.6, 0.6, tone(tr, 0.5), st);
    }
    if (s.metal) { const gr = g.createLinearGradient(-3, -8, 4, 6); gr.addColorStop(0.3, "rgba(255,255,255,0)"); gr.addColorStop(0.45, "rgba(255,255,255,0.3)"); gr.addColorStop(0.6, "rgba(255,255,255,0)"); g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 6, 9, 0, 0, TAU); g.fill(); }
    g.restore();
  }
  function cape(g, sp, P, st) {
    const c = sp.cape; if (!c) return;
    const sw = (P.cape || 0) * 4.5, t = Math.sin((P.tailP || 0) * 2) * 0.8;
    smooth(g, [[-0.4, -50.6], [-4.6, -49], [-6.4, -42], [-8.4 - sw * 0.5, -26], [-10.8 - sw + t, -7], [-7.6 - sw * 0.8, -5.4], [-5 - sw * 0.5 + t, -7.4], [-3.4, -26], [-1.6, -44]]);
    fillPath(g, c, st, [-1, -48, -10, -10]);
    g.strokeStyle = tone(c, -0.35); g.lineWidth = st.fine * 1.4;
    for (const k of [0.35, 0.7]) { g.beginPath(); g.moveTo(-4.6 + k, -44); g.quadraticCurveTo(-6.6 - sw * 0.4 * k, -26, -8.6 - sw * k + t, -8); g.stroke(); }
    if (sp.capeTrim) { g.strokeStyle = sp.capeTrim; g.lineWidth = st.fine * 1.6; g.beginPath(); g.moveTo(-10.8 - sw + t, -7); g.lineTo(-7.6 - sw * 0.8, -5.4); g.lineTo(-5 - sw * 0.5 + t, -7.4); g.stroke(); }   // side cloak hem
    if (sp.capeSide && typeof SIDES !== "undefined") SIDES.drawEmblem(g, sp.capeSide, -6.4 - sw * 0.45, -27, 2.6);   // the side's emblem on the cloak
  }
  function tail(g, sp, P, st) {
    if (!sp.tail) return;
    const sw = Math.sin(P.tailP || 0) * 2.2, liz = sp.r === "argonian";
    if (liz) { g.beginPath(); g.moveTo(-3.6, -32); g.quadraticCurveTo(-9, -24, -12 - sw, -8); g.quadraticCurveTo(-13.4 - sw, -3, -15.6 - sw, -1.6); g.quadraticCurveTo(-11 - sw, -6, -8.6 - sw * 0.6, -14); g.quadraticCurveTo(-6, -22, -2.6, -27); g.closePath(); fillPath(g, sp.skinD, st, [-4, -30, -12, -8]); return; }
    const pts = [[-4, -30], [-9, -28], [-12 - sw, -20], [-11 - sw, -13], [-13.6 - sw * 1.4, -9.6]];
    g.lineCap = "round"; line(g, pts, st.ink, 3.4); line(g, pts, sp.skin, 2.2);
    g.strokeStyle = sp.skinD; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-11.6 - sw * 1.2, -12); g.lineTo(-13.6 - sw * 1.4, -9.6); g.stroke();
  }
  function robeSkirt(g, sp, P, st, W) {
    if (!sp.robe) return;
    const w0 = W(-4.6, -30), w1 = W(4.8, -30), xs = [P.fn[0], P.ff[0]], lo = Math.min(...xs) - 4.6, hi = Math.max(...xs) + 6.4;
    smooth(g, [w0, w1, [hi - 0.6, -12], [hi + 0.8, -1.2], [(lo + hi) / 2, -0.4], [lo - 1, -1.4], [lo + 0.4, -12]]);
    fillPath(g, sp.body.c, st, [hi, -20, lo, -4]);
    line(g, [[lo - 0.4, -1.8], [(lo + hi) / 2, -1], [hi + 0.2, -1.6]], sp.body.trim, 0.8);
    g.strokeStyle = tone(sp.body.c, -0.35); g.lineWidth = st.fine; g.beginPath(); g.moveTo(w1[0] - 1.6, -26); g.lineTo((lo + hi) / 2 + 1, -2); g.stroke();
  }

  // ---- the horse (feet at 0,0, facing right; the saddle seat sits at about y = -40)
  /* Gaits: each hoof lands (u = 0), stays planted and is carried back under the body at the ground's speed for `duty` of
     the cycle, then lifts and swings forward. S = half the hoof's travel under its hip (units), so one cycle moves the
     horse STRIDE = 2·S/duty units: a scene scrolling the ground at v px/s plays v / (STRIDE · px per unit) cycles a
     second and the hooves never slide. td = when each hoof lands (n = near/left side, f = far side; h = hind, f = front). */
  const GAIT = {
    stand: { S: 0, duty: 1, lift: 0, bob: 0, td: { nh: 0, nf: 0, fh: 0, ff: 0 } },
    walk: { S: 7.4, duty: 0.62, lift: 3.4, bob: 0.4, td: { nh: 0, nf: 0.25, fh: 0.5, ff: 0.75 } },   // the four-beat walk
    gallop: { S: 8, duty: 0.4, lift: 6.4, bob: 0.4, ext: 0.9, td: { fh: 0, nh: 0.1, ff: 0.38, nf: 0.48 } },   // hinds, then fronts, then a moment in the air
  };
  const gaitOf = (gt) => GAIT[gt] || GAIT.gallop;
  const HIPS = { nf: [15, false, false], nh: [-15, true, false], ff: [11, false, true], fh: [-12, true, true] };   // x, hind, far
  const HL1 = 11, HL2 = 13.3;
  /* where each leg is at this frame (0..4 = one cycle; fractions are fine): hip (x, y), knee (kx, ky), hoof top (fx, fy) */
  function horseLegs(frame, gait) {
    const G = gaitOf(gait), c = (((frame / 4) % 1) + 1) % 1, bob = Math.sin(c * TAU * 2) * G.bob, out = { bob };
    for (const id in HIPS) {
      const [x, hind, far] = HIPS[id], hy = -24 + bob, u = (((c - G.td[id]) % 1) + 1) % 1;
      let dx, lift = 0;
      if (G.S === 0) dx = hind ? 1 : -0.5;
      else if (u < G.duty) dx = G.S - 2 * G.S * (u / G.duty);   // planted: the ground carries it back
      else { const s = (u - G.duty) / (1 - G.duty), e = (1 - Math.cos(Math.PI * s)) / 2; dx = -G.S + 2 * G.S * e; lift = G.lift * Math.sin(Math.PI * s); }
      const [kx, ky, fx, fy] = ik(x, hy, x + dx, -0.6 - lift, HL1, HL2 + (G.ext || 0), hind ? 1 : -1);   // knees bend forward in front, hocks point back
      out[id] = { x, y: hy, kx, ky, fx, fy, hind, far, down: G.S === 0 || u < G.duty };
    }
    return out;
  }
  function horse(g, col, frame, st, part, gait) {   // gait: "stand" (idle: still legs, tail swish, head nod), "walk", or a gallop (default)
    const still = gait === "stand", slow = gait === "walk";
    const ph = frame / 4 * TAU, mane = tone(col, -0.55), dk = tone(col, -0.25), LG = horseLegs(frame, gait), bob = LG.bob;
    const nod = still ? Math.sin(ph) * 0.07 : slow ? Math.sin(ph * 2) * 0.04 : Math.sin(ph * 2) * 0.03;
    const legH = (L) => {
      const c = L.far ? dk : col;
      limb(g, L.x, L.y, L.kx, L.ky, L.hind ? 6.4 : 5.4, 3.2, c, st); limb(g, L.kx, L.ky, L.fx, L.fy, 3, 2.4, c, st);
      poly(g, [[L.fx - 1.7, L.fy - 1.2], [L.fx + 1.9, L.fy - 1.2], [L.fx + 2.2, L.fy + 0.6], [L.fx - 1.9, L.fy + 0.6]]); fillPath(g, "#2a2420", st, null, st.fine);
    };
    if (part !== "front") {
      legH(LG.ff); legH(LG.fh);
      // the tail (streaming back more at speed)
      const tw = Math.sin(ph) * (still ? 3.6 : 2), fl = still ? 0 : slow ? 1.5 : 5;
      const tl = [[-23, -35 + bob], [-29 - tw - fl * 0.4, -30 + fl * 0.1], [-31 - tw - fl, -18 - fl * 0.5], [-30 - tw * 1.4 - fl * 1.5, -12 - fl * 0.8]];
      g.lineCap = "round"; line(g, tl, st.ink, 4.6); line(g, tl, mane, 3.2);
    }
    if (part === "back") return;
    g.save(); g.translate(0, bob);
    // body
    smooth(g, [[21, -31], [21.6, -24], [10, -19.4], [-8, -19.6], [-19.6, -22], [-24.6, -31], [-20.6, -39], [-6, -37.2], [10, -40.6], [17.6, -37]]);
    fillPath(g, col, st, [12, -42, -6, -19]);
    // neck and head (nodding a little when standing or walking)
    if (nod) { g.save(); g.translate(14, -38); g.rotate(nod); g.translate(-14, 38); }
    smooth(g, [[11, -40], [17, -52], [23.4, -60.6], [28.6, -57.4], [24, -44], [22.4, -33.6], [17, -31]]); fillPath(g, col, st, [24, -58, 16, -36]);
    smooth(g, [[23.2, -61], [29.6, -59.4], [36.4, -50.4], [38.8, -46.6], [36, -44.4], [29.4, -48.4], [24.4, -52]]); fillPath(g, col, st, [32, -58, 28, -46]);
    poly(g, [[24.4, -59.6], [24.6, -64.6], [27, -60.4]]); fillPath(g, col, st, null, st.fine);
    dot(g, 29.6, -55.6, 0.7, "#1c1714", st); dot(g, 37.4, -47.4, 0.45, "#1c1714", st);
    // mane and forelock
    const mf = still ? 0 : Math.sin(ph * 2 + 1) * (slow ? 0.4 : 0.9);   // the mane flicks with the stride
    g.beginPath(); g.moveTo(24.2, -61.4); for (let i = 0; i <= 6; i++) { const t2 = i / 6, x = 24.2 - t2 * 14, y = -61.4 + t2 * 21; g.lineTo(x - 2.2 - (i % 2) * 1.2 - mf * t2, y + 1.2); g.lineTo(x - 0.4, y + 3.2); }
    g.lineTo(11.6, -38); g.quadraticCurveTo(18, -50, 24.2, -61.4); g.closePath(); fillPath(g, mane, st, null, st.fine);
    // tack: bridle, saddle cloth, saddle
    line(g, [[26, -58.8], [30.6, -51.4], [36.6, -46.8]], "#3b2c1e", 0.6); line(g, [[28.4, -50.4], [33.4, -52.6]], "#3b2c1e", 0.5);
    if (nod) g.restore();
    smooth(g, [[-8, -39.4], [9, -41.4], [9.6, -30.4], [-8.6, -29.6]]); fillPath(g, "#7a2a22", st, [8, -41, -8, -30]); line(g, [[-8.4, -31], [9.4, -31.6]], ART.PAL.gold, 0.8);
    smooth(g, [[-6.4, -40.2], [-3, -39], [4, -39.4], [7.4, -42.6], [6.2, -38], [-5.4, -37]]); fillPath(g, "#5e3e26", st, [4, -42, -4, -37]);
    g.restore();
    legH(LG.nh); legH(LG.nf);   // the near legs over the body (their hips already ride the bob, so the hooves stay on the ground)
  }
  /* a horse on its own (a caravan's, a carriage's): feet at (x, y), k = g units per horse unit, cyc = 0..1 through the stride */
  function drawHorse(g, col, x, y, o = {}) {
    const k = o.k || 0.5, st = styleOf(k * devScale(g)), f = (o.cyc || 0) * 4;
    g.save(); g.translate(x, y); if (o.flip) g.scale(-1, 1); g.scale(k, k); g.lineJoin = "round"; g.lineCap = "round";
    horse(g, col, f, st, "back", o.gait); horse(g, col, f, st, "front", o.gait);
    g.restore();
  }
  /* where things touch, in figure units with the feet at 0,0 (for tests and scenes): the lowest foot or hoof (0 = on the
     ground, negative = in the air), the saddle seat and the rider's hips (riding), and the planted hooves' x */
  function contact(src, o = {}) {
    const sp = specOf(lookFor(src, o)), pose = POSES[o.pose] ? o.pose : "idle", frame = frameOf(pose, o), P = posed(sp, pose, frame, o), B = solve(sp, P);
    const feet = [B.footN, B.footF].map((b) => (b.y + 2.2) * sp.bh), out = { foot: Math.max(...feet) };
    if (pose === "ride") {
      const L = horseLegs(frame, o.gait || null), hooves = ["nf", "nh", "ff", "fh"].map((id) => L[id]);
      out.foot = Math.max(...hooves.map((h) => h.fy + 0.6));
      out.planted = {}; for (const id of ["nf", "nh", "ff", "fh"]) if (L[id].down) out.planted[id] = [L[id].fx, L[id].fy + 0.6];   // hooves on the ground: leg → [x, y]
      out.seat = -40 + L.bob; out.hip = B.pelvis.y * sp.bh;
    }
    return out;
  }

  // ---------------------------------------------------------------- one whole figure, drawn from its solved rig
  function drawPose(g, sp, P, st, layers) {
    g.save(); g.lineJoin = "round"; g.lineCap = "round";
    if (P.rot) { g.translate(26 * Math.min(1, Math.abs(P.rot) / (Math.PI / 2)), -4.6 * Math.min(1, Math.abs(P.rot) / (Math.PI / 2))); g.rotate(P.rot); }
    if (P.ride && P.horseC) horse(g, P.horseC, P.frame || 0, st, "back", P.gait);
    g.scale(sp.bw, sp.bh);
    const B = solve(sp, P), S = B.spine, hn = B.handN, hf = B.handF;
    const inSpine = (fn) => { g.save(); at(g, S); fn(); g.restore(); };
    const W = (x, y) => [S.x + Math.cos(S.a) * x - Math.sin(S.a) * y, S.y + Math.sin(S.a) * x + Math.cos(S.a) * y];
    const shieldOn = !!(sp.shield || P.shieldOn) && P.shieldOk !== false, shieldBehind = handF(P)[0] < -1.5 && !P.front;
    const shieldHere = (front) => { g.save(); g.translate(hf.x, hf.y); g.rotate(S.a); shieldAt(g, sp, 0, 0, front, st); g.restore(); };
    // behind: the cloak, a tail, what's slung on the back
    inSpine(() => { if (layers?.back) layers.back(); else { cape(g, sp, P, st); tail(g, sp, P, st); quiver(g, sp, st); if (!P.armed) slungBack(g, sp, st); } });
    // the far arm (and a shield held out behind)
    const hcF = arm(g, sp, st, B.upperF, B.foreF, hf, true);
    if (P.off) { g.save(); at(g, hf); g.rotate(0.55 + (P.lunge || 0) * 0.7); weapon(g, sp, P.off, st, { plain: true, glow: P.glow }); g.restore(); }
    fist(g, hf.x, hf.y, hcF, st);
    if (shieldOn && shieldBehind) shieldHere(false);
    if (P.cast && !P.front) glowAt(g, hf.x, hf.y, 5 + P.cast * 3, P.castC || "#9fd0f0", 0.75, st);
    if (P.ride && P.horseC) { g.save(); g.scale(1 / sp.bw, 1 / sp.bh); horse(g, P.horseC, P.frame || 0, st, "front", P.gait); g.restore(); }
    if (!P.noFar) leg(g, sp, B.thighF, B.shinF, B.footF, st, true);
    leg(g, sp, B.thighN, B.shinN, B.footN, st, false);
    robeSkirt(g, sp, P, st, W);
    inSpine(() => {
      if (layers?.front) layers.front();
      else { g.save(); if (P.breath) { g.translate(0, -26); g.scale(1 + P.breath * 0.012, 1 + P.breath * 0.02); g.translate(0, 26); } torso(g, sp, P, st); g.restore(); neckAndHead(g, sp, P, st); if (!P.armed) sheathed(g, sp, st); }
    });
    if (shieldOn && !shieldBehind) shieldHere(P.front);
    if (P.cast && P.front) glowAt(g, hf.x, hf.y, 5 + P.cast * 3, P.castC || "#9fd0f0", 0.8, st);
    // the near arm, its weapon (held in the hand bone), then the hand over the grip
    const hcN = arm(g, sp, st, B.upperN, B.foreN, hn, false), wk = P.wk !== undefined ? P.wk : sp.wk;
    if (P.flask) { g.save(); at(g, hn); poly(g, [[-1.6, -1], [1.6, -1], [2, -4.6], [0.5, -5.6], [0.5, -7], [-0.5, -7], [-0.5, -5.6], [-2, -4.6]]); fillPath(g, P.flask, st, null, st.fine); g.restore(); }
    else if (P.armed && wk) { g.save(); at(g, hn); weapon(g, sp, wk, st, { draw: P.draw, glow: P.glow, plain: P.plainW }); g.restore(); }
    else if (P.stick) { g.save(); g.translate(hn.x, hn.y); g.rotate(-0.18); weapon(g, sp, "staff", st, {}); g.restore(); }
    fist(g, hn.x, hn.y, hcN, st, sp.ring);
    inSpine(() => pauldron(g, sp, st));
    if (P.cast) glowAt(g, hn.x + 1.6, hn.y - 0.6, 5 + P.cast * 3.4, P.castC || "#9fd0f0", 0.85, st);
    if (P.ride && P.horseC) line(g, [[hn.x, hn.y], [36.6 / sp.bw, (-46.8 + Math.sin((P.frame || 0) / 4 * TAU * 2) * 0.8) / sp.bh]], "#3b2c1e", 0.5);   // the reins
    if (sp.wolf) inSpine(() => { g.fillStyle = "rgba(90,60,30,0.45)"; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-3 + i * 1.6, -49 + (i % 2), 1, 0, TAU); g.fill(); } });
    g.restore();
  }
  /* the neck and head, in the spine's frame (the neck → head bones: head() turns by the head bone's tilt) */
  function neckAndHead(g, sp, P, st) {
    limb(g, NECK[0], NECK[1], 1.8, -53.2, 3.7, 3.4, sp.skin, st);
    if (sp.heavy) { g.beginPath(); g.ellipse(0.9, -49.4, 3.8, 1.6, -0.15, 0, TAU); fillPath(g, sp.cm.d, st, null, st.fine); }
    head(g, sp, P, st);
  }
  // ---------------------------------------------------------------- styles, sprites, the cache
  function styleOf(k) {
    return { k, ink: ART.PAL.ink, lw: Math.max(0.6, 0.85 / k), fine: Math.max(0.28, 0.55 / k) };
  }
  const BOX = { walk: [-30, -84, 74, 90], ride: [-38, -96, 84, 99], sit: [-24, -66, 48, 70], down: [-74, -26, 108, 30], idle: [-46, -112, 100, 118] };
  const boxOf = (pose) => BOX[pose] || BOX.idle;
  const SPRITES = new Map(), MAX_SPRITES = 220;
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  /* seconds per loop of each clip (for o.t in seconds) */
  const LOOP = { idle: 2.4, walk: 0.9, attack: 0.8, cast: 0.9, block: 1.2, hit: 0.5, down: 1, ride: 0.6, sit: 1 };
  /* o.steps (more than the clip's frames) cuts the cycle finer for smooth motion: frame 0..steps-1 → a fractional clip frame */
  const frameOf = (pose, o) => { const n = POSES[pose], m = o.steps > n ? o.steps | 0 : n; const f = o.t != null ? Math.floor((o.t / LOOP[pose]) * m) : o.frame | 0; return (((f % m) + m) % m) * n / m; };
  /* a look, with optional overrides: o.look (a whole look), o.gear ({slot: itemId}, e.g. for a bandit or draugr card), o.race, o.sex */
  function lookFor(src, o = {}) {
    let L = o.look || lookOf(src);
    if (o.gear || o.race || o.sex) L = { ...L, eq: { ...(L.eq || {}), ...(o.gear || {}) }, r: o.race || L.r, sx: o.sex === "f" ? "f" : o.sex === "m" ? undefined : L.sx };
    return L;
  }
  function render(sp, P, pose, k) {
    const [bx, by, bw, bh] = boxOf(pose), sx = Math.max(1, sp.bw), sy = Math.max(1, sp.bh);
    const c = mk(bw * k * sx, bh * k * sy), g = c.getContext("2d"), st = styleOf(k);
    g.save(); g.scale(k, k); g.translate(-bx * sx, -by * sy);
    if (pose !== "down" && pose !== "ride") { g.fillStyle = "rgba(30,20,12,0.22)"; g.beginPath(); g.ellipse(1, 0.4, 12, 2, 0, 0, TAU); g.fill(); }
    try { drawPose(g, sp, P, st); } catch (e) { if (typeof console !== "undefined") console.warn("figart", e); }
    g.restore();
    c.ax = -bx * sx * k; c.ay = -by * sy * k; c.k = k;
    return c;
  }
  function posed(sp, pose, frame, o) {
    const P = poseOf(pose, frame, sp, o); P.frame = frame;
    if (pose === "ride") { P.horseC = o.horse || "#6b4a2e"; P.gait = o.gait || null; }
    if (sp.wk === "staff" || P.cast) P.castC = sp.wk === "staff" ? sp.staffC : sp.ench || "#9fd0f0";
    return P;
  }
  function sprite(src, o = {}) {
    const sp = specOf(lookFor(src, o)), pose = POSES[o.pose] ? o.pose : "idle", frame = frameOf(pose, o);
    const dpr = o.dpr || Math.min(2, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1);
    let k = o.k || ((o.h || 64) / 61) * (o.scale || 1) * dpr; k = Math.max(0.12, Math.round(k * 16) / 16);
    if (o.from && POSES[o.from.pose] && o.w != null && o.w < 1) {   // fading from another clip: drawn fresh, not cached
      const fp = o.from.pose, a = posed(sp, fp, frameOf(fp, o.from), o), b = posed(sp, pose, frame, o);
      return render(sp, blend(a, b, o.w), o.w < 0.5 ? fp : pose, k);
    }
    const key = `${sp.key}|${pose}|${frame}|${k}|${o.horse || ""}${o.gait ? ":" + o.gait : ""}|${o.armed === undefined ? "" : +o.armed}`;
    let c = SPRITES.get(key);
    if (c) { SPRITES.delete(key); SPRITES.set(key, c); return c; }
    c = render(sp, posed(sp, pose, frame, o), pose, k);
    SPRITES.set(key, c); if (SPRITES.size > MAX_SPRITES) SPRITES.delete(SPRITES.keys().next().value);
    return c;
  }
  /* how many device pixels one unit of g is right now */
  function devScale(g) { try { const t = g.getTransform(); const s = Math.hypot(t.a, t.b); return isFinite(s) && s > 0 ? s : 1; } catch { return 1; } }
  function draw(g, src, x, y, o = {}) {
    const h = o.h || 64, dev = devScale(g), c = sprite(src, { ...o, k: h / 61 * dev });
    const s = 1 / dev, w = c.width * s, hh = c.height * s;
    g.save();
    g.translate(x, y); if (o.flip) g.scale(-1, 1);
    g.drawImage(c, -c.ax * s, -c.ay * s, w, hh);
    g.restore();
    return c;
  }
  /* an animation player for one character: play(pose, now) switches clips, fading over `fade` seconds; draw() draws the current frame */
  function animator(fade = 0.18) {
    let cur = null, prev = null, since = 0;
    return {
      get pose() { return cur ? cur.pose : "idle"; },
      play(pose, now, o = {}) { if (cur && cur.pose === pose && !o.restart) return this; prev = cur; cur = { pose, start: now }; since = now; return this; },
      draw(g, src, x, y, now, o = {}) {
        if (!cur) this.play("idle", now);
        const w = prev ? (now - since) / fade : 1, a = { pose: cur.pose, t: now - cur.start };
        if (w >= 1) prev = null;
        return draw(g, src, x, y, prev ? { ...o, ...a, from: { pose: prev.pose, t: now - prev.start }, w } : { ...o, ...a });
      },
    };
  }

  // ---------------------------------------------------------------- fight scenes: cached body, live limbs
  const LAYERS = new Map();
  const UPPER_BOX = [-18, -78, 34, 64], BACK_BOX = [-24, -62, 34, 64];
  function layer(sp, which, k, P) {
    const key = `${sp.key}|${which}|${k}`; let c = LAYERS.get(key); if (c) return c;
    const [bx, by, bw, bh] = which === "front" ? UPPER_BOX : BACK_BOX, st = styleOf(k);
    c = mk(bw * k, bh * k); const g = c.getContext("2d");
    g.save(); g.scale(k, k); g.translate(-bx, -by); g.lineJoin = "round"; g.lineCap = "round";
    try { if (which === "front") { torso(g, sp, P, st); neckAndHead(g, sp, { ...P, tilt: 0 }, st); } else { cape(g, sp, { ...P, cape: 0.25 }, st); tail(g, sp, P, st); quiver(g, sp, st); } } catch (e) { if (typeof console !== "undefined") console.warn("figart layer", e); }
    g.restore();
    c.box = which === "front" ? UPPER_BOX : BACK_BOX;
    LAYERS.set(key, c); if (LAYERS.size > 64) LAYERS.delete(LAYERS.keys().next().value);
    return c;
  }
  /* the fight replay drives the same rig: its numbers become the controls, the rig solves the bones */
  function fight(g, src, o = {}) {
    const sp = specOf(lookFor(src, o)), dev = devScale(g) * Math.max(sp.bw, sp.bh);
    const k = Math.max(0.25, Math.round(dev * 4) / 4), st = styleOf(k);
    const lunge = o.lunge || 0, wk = o.wt === undefined ? sp.wk : o.wt || null;
    const P = { aim: o.aim != null ? o.aim : wk === "bow" || wk === "crossbow" ? 0 : -0.5 + lunge * 1.1, back: o.back || 0, lean: (o.hunch || 0) + lunge * 0.25, dy: 0, ox: 0, tilt: 0,
      fn: [5 + lunge * 4, 0], ff: [-5, 0], armed: true, wk, draw: o.draw || 0, glow: o.glow ? sp.ench || "#7fb6ff" : null, flask: o.flask, off: o.off || null, front: (o.back || 0) < -0.8,
      shieldOn: !!o.shield, shieldOk: o.shield === undefined ? true : !!o.shield, plainW: wk !== sp.wk, tailP: (o.t || 0) * 2, breath: o.t != null && !(lunge > 0.05) ? Math.sin(o.t * 2.2) : 0, lunge };
    if (o.clip) {   // [OURS] a named clip (allyanim.js: a follower's attack, cast, block, flinch, fall, getting up), faded in from another
      const sp2 = wk === sp.wk ? sp : { ...sp, wk }, w = o.w == null ? 1 : o.w;
      let C = poseAt(o.clip, o.u || 0, sp2);
      if (o.from && w < 1) C = blend(poseAt(o.from, o.fu || 0, sp2), C, w);
      for (const key in BASE) if (C[key] !== undefined) P[key] = C[key];
      P.armed = C.armed !== false; P.front = !!C.front; P.breath = 0; P.lunge = 0;
      if (P.cast) P.castC = wk === "staff" ? sp.staffC : sp.ench || "#9fd0f0";
    }
    const put = (c) => { const [bx, by, bw, bh] = c.box; g.drawImage(c, bx, by, bw, bh); };
    drawPose(g, sp, P, st, { back: () => put(layer(sp, "back", k, P)), front: () => put(layer(sp, "front", k, P)) });
  }

  const STRIDE = { walk: 28.8, horse: { stand: 0, walk: 2 * GAIT.walk.S / GAIT.walk.duty, gallop: 2 * GAIT.gallop.S / GAIT.gallop.duty } };   // units travelled per cycle
  return { POSES, LOOP, RIG, STRIDE, sprite, draw, drawHorse, contact, fight, animator, specOf, lookOf, lookFor, poseOf, poseAt, blend, solve, clipsFor, tone, clear: () => { SPRITES.clear(); LAYERS.clear(); SPECS.clear(); CLIPS.clear(); },
    /* [OURS] forget the cached frames of one look (character creation makes a new look on every click; chargen.js) */
    drop: (src) => { const k = specOf(lookFor(src)).key + "|"; for (const m of [SPRITES, LAYERS]) for (const key of [...m.keys()]) if (key.startsWith(k)) m.delete(key); } };
})();
if (typeof HEROART !== "undefined") {   // the shared hero art API lives on HEROART too (see the notes at the top of heroart.js)
  HEROART.sprite = FIGART.sprite; HEROART.drawFigure = FIGART.draw; HEROART.fightFigure = FIGART.fight; HEROART.animator = FIGART.animator; HEROART.POSES = FIGART.POSES;
}
