/* Realistic splatter on top of gore.js [OURS]. Remigiusz: "The gore should be realistic. Splattering."
   gore.js runs the seeded physics (every drop, where it lands); this file draws it as rendered liquid
   (scripts/make_blood.py → gfx-*.webp, listed in assets.js): glossy metaball blood, not ink pills.
   - a blow throws a rendered spray from the wound, away from the attacker, bigger with the damage. Its own drops fly
     as glossy teardrops stretched along their flight (gore.js physics, so the same on every phone), land, and leave
     a small splat (or a tailed spatter when they were going fast) that fades slowly over the fight.
   - criticals and finishers add a jet and a wider splash; heavy blows leave a splatter on the ground and run down the
     figure (drip stains, fading after the fight); a kill or a knock-down spreads a pool that grows over two seconds.
   - blunt blows raise dust and spill less; skeletons and draugr throw grave dust and bone chips, never blood;
     Dwemer machines spit black oil and sparks; Falmer and chaurus bleed green, daedra dark ichor, spriggans amber sap.
   - frost throws ice shards, fire throws embers, lightning crackles, other magic leaves motes; metal on metal sparks.
   - followers, party members and horses bleed a little but are never splattered on the body, never pooled, never killed.
   Settings → Fights → Gore: Off = nothing; Reduced = a red mist, the drops and small splats (no big sprays, no pools,
   no stains on the body); Full = all of it. Fight quality (Low / Medium / High), Lite motion, Low lighting and reduced
   motion cut how many sprites play and how many splats stay.
   Timings (gptart/blood/README): bursts open over ~150 ms and are gone by 0.5 s, mist 0.3 s, drops fall 0.3–0.7 s,
   pools grow over ~2 s and stay; body stains ~70% opacity, fade 20 s after they land.
   Hooks: GORE.scene() is wrapped here, so fightart.js needs no change; S.setLiquid() hands gore.js our drop / splat /
   streak drawing. S.down(target) spreads a pool under someone knocked down (the hero only: friends and horses get none).
   Missing pictures: gore.js keeps its ink. Quality: a sprite is never drawn bigger than 1.15x its own pixels. */
const GOREFX2 = (() => {
  // key → [file, frames, frame w, frame h, origin x, origin y, seconds, additive]
  const SH = {
    b1: ["gfx-blood-burst-1", 10, 256, 256, 0.3, 0.55, 0.5, 0], b2: ["gfx-blood-burst-2", 10, 256, 256, 0.3, 0.55, 0.5, 0],
    b3: ["gfx-blood-burst-3", 12, 256, 256, 0.38, 0.52, 0.6, 0], jet: ["gfx-blood-spray", 8, 256, 256, 0.1, 0.45, 0.45, 0],
    mist: ["gfx-blood-mist", 8, 192, 192, 0.35, 0.52, 0.32, 0],
    oil: ["gfx-oil-burst", 10, 192, 192, 0.3, 0.55, 0.5, 0], green: ["gfx-green-burst", 10, 192, 192, 0.3, 0.55, 0.5, 0],
    ichor: ["gfx-ichor-burst", 10, 192, 192, 0.3, 0.55, 0.5, 0], sap: ["gfx-sap-burst", 10, 192, 192, 0.3, 0.55, 0.5, 0],
    dust: ["gfx-dust", 10, 192, 192, 0.5, 0.72, 0.8, 0], bone: ["gfx-bonedust", 10, 192, 192, 0.5, 0.7, 0.8, 0],
    sparks: ["gfx-sparks", 8, 160, 160, 0.5, 0.5, 0.26, 1], frost: ["gfx-frost", 10, 192, 192, 0.4, 0.5, 0.65, 0],
    embers: ["gfx-embers", 10, 192, 192, 0.5, 0.6, 0.9, 1], shock: ["gfx-shock", 8, 192, 192, 0.5, 0.5, 0.42, 1],
    motes: ["gfx-motes", 10, 192, 192, 0.5, 0.5, 0.85, 1],
  };
  // 4×2 atlases: cells 0,1,4,7 splats · 2,5 pools · 3,6 tailed spatter (thrown along +x)
  const DEC = { blood: ["gfx-blood-decals", 384], oil: ["gfx-oil-decals", 192], green: ["gfx-green-decals", 192], ichor: ["gfx-ichor-decals", 192], sap: ["gfx-sap-decals", 192] };
  const DROPS = { blood: "gfx-blood-drops", oil: "gfx-oil-drops", green: "gfx-green-drops", ichor: "gfx-ichor-drops", sap: "gfx-sap-drops" };   // 4×2 of 48²: round → stretched, head to the right
  const DRIPS = ["gfx-blood-drips", 4, 128, 160];   // body stains with runs
  const KEYS = Object.values(SH).map((v) => v[0]).concat(Object.values(DEC).map((v) => v[0]), Object.values(DROPS), [DRIPS[0]]);
  const BLEED = { blood: ["b1", "b2"], dragon: ["b1", "b2"], green: ["green"], ichor: ["ichor"], sap: ["sap"] };
  const FAM = { blood: "blood", dragon: "blood", green: "green", ichor: "ichor", sap: "sap", oil: "oil" };   // material → which liquid pictures
  const img = (k) => (typeof ASSETS !== "undefined" && ASSETS.img ? ASSETS.img(k) : null);
  const G = () => (typeof GORE !== "undefined" ? GORE : null);
  const ARMOUR = /soldier|guard|legion|stormcloak|imperial|thalmor|knight|warlord|chief|mercenar|dremora|dawnguard|vigilant|orc|sellsword|marauder/i;   // a blade on plate throws sparks

  /* how much this phone draws: Fight quality, Lite motion / Low lighting, reduced motion → 0.3 … 1 (pure) */
  function budgetK(o = {}) {
    const q = o.quality ?? (typeof FIGHTSET !== "undefined" && FIGHTSET.quality ? FIGHTSET.quality() : "high");
    const lowGfx = o.lowGfx ?? ((typeof LIGHTFX !== "undefined" && LIGHTFX.level && LIGHTFX.level() !== "high") || (typeof MOTION !== "undefined" && MOTION.lite && MOTION.lite()));
    return Math.max(0.3, (q === "low" ? 0.5 : q === "med" ? 0.75 : 1) * (lowGfx ? 0.75 : 1) * (o.reduce ? 0.6 : 1));
  }

  /* what a blow shows: a list of [sheet, size (world units × s)] — pure, tested in node */
  function planOf(type, mat, o = {}) {
    const lv = o.level || "full", full = lv === "full", out = [], side = o.side || "foe", ally = side !== "foe" && side !== "hero";
    const frac = Math.max(0, Math.min(1, o.frac ?? 0.1)), big = (o.crit ? 1.25 : 1) * (o.final ? 1.35 : 1) * (o.power ? 1.1 : 1);
    const k = Math.min(2.1, (0.55 + frac * 2.2) * big) * (mat === "dragon" ? 1.35 : 1) * (ally ? 0.6 : 1);
    const bleeds = !!BLEED[mat], strong = !!(o.crit || o.final);
    if (type === "fire") out.push(["embers", 62 * k]);
    else if (type === "frost") out.push(["frost", 62 * k]);
    else if (type === "shock") out.push(["shock", 64 * k]);
    else if (type === "magic") out.push(["motes", 56 * k]);
    else if (type === "poison") out.push(["green", 44 * k]);
    const phys = !["fire", "magic", "shock"].includes(type);
    if (phys && bleeds && type !== "poison") {
      const sheets = BLEED[mat], blunt = type === "blunt", red = mat === "blood" || mat === "dragon";
      if (!full) out.push([red ? "mist" : sheets[0], (red ? 52 : 34) * k]);   // Reduced: a mist and the drops, no big spray
      else {
        out.push([sheets[(o.pick || 0) % sheets.length], (blunt ? 48 : 64) * k * (type === "frost" ? 0.6 : 1)]);
        if (red && (strong || frac >= 0.2)) out.push(["mist", 56 * k]);
        if (strong && type !== "frost") { out.push([red ? "jet" : sheets[0], 70 * k]); if (o.final || blunt) out.push([red ? "b3" : sheets[0], 74 * k]); }
      }
    }
    if (phys && mat === "bone") out.push(["bone", 60 * k]);
    if (phys && mat === "oil") { if (full) out.push(["oil", 56 * k]); out.push(["sparks", 50 * k]); }
    if (phys && type === "blunt" && mat !== "bone") out.push(["dust", 58 * k]);
    if (phys && (mat === "essence" || mat === "spirit")) out.push([mat === "essence" ? "embers" : "motes", 56 * k]);
    if (o.metal && phys && type !== "blunt" && mat !== "oil") out.push(["sparks", 30 * k]);
    return out;
  }
  /* does this blow leave a splatter on the ground / a stain on the figure? (pure) */
  function decalOf(type, mat, o = {}) {
    if ((o.level || "full") !== "full" || ["fire", "magic", "shock"].includes(type)) return { ground: 0, body: false };
    const liquid = FAM[mat] || null;
    if (!liquid) return { ground: 0, body: false };
    const strong = o.crit || o.final, ally = o.side && o.side !== "foe" && o.side !== "hero";
    return { liquid, ground: ally ? 0 : o.final ? 2 : strong || type === "blunt" || (o.frac || 0) >= 0.22 ? 1 : 0, body: !ally && (strong || (o.frac || 0) >= 0.18) };
  }
  /* a landed drop: which splat, how wide (pure). fast drops leave a tailed spatter pointing the way they flew */
  function splatOf(r, vx, s = 1) {
    const fast = Math.abs(vx) > 90 * s;
    return { cells: fast ? [3, 6] : [0, 1, 4, 7], w: r * (fast ? 5.2 : 3.6) * (1 + Math.min(0.8, Math.abs(vx) / (400 * s))), flip: vx < 0 ? -1 : 1 };
  }

  // [blood3] pool colours: [middle, body, rim] per liquid, and a soft lobe picture made once per liquid
  const POOLC = { blood: ["#120101", "#2c0303", "#4a0606"], oil: ["#070604", "#16140f", "#26231b"], green: ["#1a2408", "#34460f", "#566e1c"], ichor: ["#0a030c", "#200a26", "#3a1240"], sap: ["#2c1a02", "#5a380a", "#8a5a12"] };
  const LOBES = new Map();
  function lobeSprite(k) {
    if (LOBES.has(k)) return LOBES.get(k);
    let sp = null;
    if (typeof document !== "undefined" && document.createElement) {
      sp = document.createElement("canvas"); sp.width = sp.height = 64; const x = sp.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      if (k === "shine") { gr.addColorStop(0, "rgba(255,236,230,1)"); gr.addColorStop(0.5, "rgba(255,236,230,0.35)"); gr.addColorStop(1, "rgba(255,236,230,0)"); }
      else { const c = POOLC[k] || POOLC.blood; gr.addColorStop(0, c[0]); gr.addColorStop(0.5, c[1]); gr.addColorStop(0.84, c[2] + "e8"); gr.addColorStop(0.94, c[2] + "70"); gr.addColorStop(1, c[2] + "00"); }
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    }
    LOBES.set(k, sp); return sp;
  }
  const DECALS = new WeakMap();   // the fight → its splatters (turn-by-turn fights keep them turn to turn)
  const GROUND_MAX = 14, BODY_MAX = 6, SPAT_MAX = 48, GROUND_LIFE = 60, SPAT_LIFE = 40, BODY_LIFE = 20, POOL_GROW = 2.2;
  // drop colour (gore.js MAT and its poison drips) → liquid family
  const COLFAM = new Map();
  function famOfCol(c) {
    if (!COLFAM.size) { const M = G()?.MAT || {}; for (const [k, v] of Object.entries(M)) if (FAM[k]) { COLFAM.set(v[0], FAM[k]); COLFAM.set(v[1], FAM[k]); } COLFAM.set("#7ec23a", "green"); COLFAM.set("#4a7a1a", "green"); COLFAM.set("#a01010", "blood"); COLFAM.set("#5a0606", "blood"); COLFAM.set("#141210", "oil"); }
    return COLFAM.get(c) || null;
  }

  function wrap(S, o = {}) {
    const g0 = G();
    if (!S || S.fx2 || !g0) return S;
    const lv = S.level || g0.level();
    S.fx2 = true;
    if (lv === "off") return S;
    for (const k of KEYS) img(k);   // ask for the pictures now
    const W = o.W || 400, Hh = o.H || 180, gy = o.groundY ?? Hh * 0.8, s = o.s || Hh / 150, rm = !!o.reduce, full = lv === "full";
    const bk = budgetK({ quality: o.quality, lowGfx: o.lowGfx, reduce: rm });
    const CAP = Math.max(6, Math.round((full ? 24 : 12) * bk)), SPATS = Math.max(10, Math.round((full ? SPAT_MAX : 24) * bk));
    // sprite pool (allocated once per stage)
    const P = []; for (let i = 0; i < CAP; i++) P.push({ on: false, sh: null, x: 0, y: 0, w: 0, rot: 0, flip: 1, t: 0, dur: 1, a: 1 });
    let cur = 0, live = 0;
    const fk = o.fight && typeof o.fight === "object" ? o.fight : null;
    let D = fk && DECALS.get(fk);
    if (!D) { D = { ground: [], body: [], spat: [], down: {} }; if (fk) DECALS.set(fk, D); }
    if (!D.spat) D.spat = []; if (!D.down) D.down = {};
    const seed0 = (o.seed ?? g0.hash(`${o.foeName || "foe"}|${o.ehpMax || 0}|fx2`)) >>> 0;

    function play(key, x, y, size, dir, r, alpha = 1, ground = gy) {
      const sh = SH[key]; if (!sh) return;
      let p = null;
      for (let n = 0; n < CAP; n++) { const q = P[(cur + n) % CAP]; if (!q.on) { p = q; cur = (cur + n + 1) % CAP; break; } }
      if (!p) { p = P[cur]; cur = (cur + 1) % CAP; }   // full: the oldest goes
      p.on = true; p.sh = sh; p.x = x; p.y = y; p.w = size * s; p.flip = dir < 0 ? -1 : 1;
      p.rot = (r() - 0.5) * (sh[7] ? 3.14 : 0.35); p.t = 0; p.dur = sh[6] * (0.9 + r() * 0.2); p.a = alpha; p.proc = null;
      // [blood3] the jet and the mist are drawn live, not from the strips: thin streams that break into drops, a fine spray, a faint haze
      if (key === "jet") { p.proc = { st: streams(x, y, dir, size / 70, r, ground), sp: spray(x, y, dir, size / 70, r, 1), hz: null }; p.dur = 1.1; }
      else if (key === "mist") { p.proc = { st: null, sp: spray(x, y, dir, size / 56, r, 0.55), hz: { R: size * s * 0.3, dx: dir * 6 * s } }; p.dur = 0.32; }
    }
    // ---- [blood3] live liquid: streams, spray, haze (seeded with the blow, so every phone sees the same)
    const RED = g0.MAT ? g0.MAT.blood : ["#8e1010", "#4a0606"];
    function streams(x, y, dir, k2, r, ground) {
      const out = [], n = 2 + (r() < 0.5 ? 1 : 0) + (k2 > 1.15 ? 1 : 0), N = 9, kk = Math.sqrt(Math.max(0.4, Math.min(2.2, k2)));
      for (let j = 0; j < n; j++) {
        const th = -(0.12 + (j / Math.max(1, n - 1)) * 0.6 + (r() - 0.5) * 0.18), v0 = (190 + r() * 150) * s * kk, R = (1.1 + r() * 0.7) * s * kk, beads = [];
        for (let k = 0; k < N; k++) {
          const a = th + (r() - 0.5) * 0.05, v = v0 * (1 - k * 0.05);
          beads.push({ x, y, vx: Math.cos(a) * v * dir, vy: Math.sin(a) * v, r: R * (1 - 0.7 * k / (N - 1)) * (0.85 + r() * 0.3), born: k * 0.011, on: true });
        }
        out.push({ beads, brk: 0.07 + r() * 0.06, x0: x, y0: y, ground: ground + (r() - 0.3) * 6 * s, col: r() < 0.8 ? RED[0] : RED[1] });
      }
      return out;
    }
    function spray(x, y, dir, k2, r, amt) {
      const n = Math.max(6, Math.min(34, Math.round(24 * amt * Math.min(1.8, k2) * bk))), d = new Float32Array(n * 5);
      for (let i = 0; i < n; i++) {
        const a = -0.25 + (r() - 0.5) * 1.2, v = (90 + r() * 260) * s;
        d.set([x + (r() - 0.5) * 3 * s, y + (r() - 0.5) * 3 * s, Math.cos(a) * v * dir, Math.sin(a) * v, (0.25 + r() * 0.45) * s], i * 5);
      }
      return { d, n, life: 0.2 + r() * 0.06 };
    }
    function stepProc(p, dt) {
      const pr = p.proc;
      if (pr.sp && p.t <= pr.sp.life + dt) { const d = pr.sp.d; for (let i = 0; i < pr.sp.n; i++) { const j = i * 5; d[j + 2] *= 0.93; d[j + 3] = d[j + 3] * 0.93 + 260 * s * dt; d[j] += d[j + 2] * dt; d[j + 1] += d[j + 3] * dt; } }
      if (pr.st) for (const st of pr.st) for (const b of st.beads) {
        if (!b.on || p.t < b.born) continue;
        b.vy += 520 * s * dt; b.vx *= 0.996; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.vy > 0 && b.y >= st.ground) { b.on = false; if (b.r > 0.5 * s) liquid.land(b.x, st.ground, b.r * 1.4, st.col, b.vx); }
      }
    }
    /* a drop of liquid: a round head with a short tail behind it (st = how stretched by speed, 1 = round) */
    function blob(g, x, y, ang, rr, st, col, a) {
      const tl = rr * 1.6 * (st - 1);
      g.save(); g.globalAlpha = a; g.translate(x, y); g.rotate(ang); g.fillStyle = col;
      g.beginPath(); g.arc(0, 0, rr, -Math.PI / 2, Math.PI / 2); g.quadraticCurveTo(-rr * 0.4 - tl * 0.35, rr * 0.9, -rr - tl, 0); g.quadraticCurveTo(-rr * 0.4 - tl * 0.35, -rr * 0.9, 0, -rr); g.fill();
      if (rr > 0.9 * s) { g.globalAlpha = a * 0.28; g.fillStyle = "#ffd6d0"; g.beginPath(); g.arc(rr * 0.25, -rr * 0.38, rr * 0.28, 0, 6.283); g.fill(); }   // a glint
      g.restore();
    }
    function drawProc(g, p) {
      const pr = p.proc, u = p.t / p.dur;
      if (pr.hz) {   // a faint red haze that opens and is gone in a third of a second
        const R = pr.hz.R * (0.6 + 0.6 * Math.min(1, u * 1.4)), k = u < 0.18 ? u / 0.18 : Math.pow(1 - (u - 0.18) / 0.82, 2), cx = p.x + pr.hz.dx * u, gr = g.createRadialGradient(cx, p.y, 0, cx, p.y, R);
        gr.addColorStop(0, "rgba(120,8,8,0.2)"); gr.addColorStop(0.5, "rgba(110,6,6,0.08)"); gr.addColorStop(1, "rgba(100,4,4,0)");
        g.globalAlpha = p.a * k; g.fillStyle = gr; g.beginPath(); g.arc(cx, p.y, R, 0, 6.283); g.fill();
      }
      if (pr.sp && p.t < pr.sp.life) {   // the fine spray
        const d = pr.sp.d; g.globalAlpha = p.a * 0.8 * (1 - p.t / pr.sp.life); g.fillStyle = RED[0]; g.beginPath();
        for (let i = 0; i < pr.sp.n; i++) { const j = i * 5; g.moveTo(d[j] + d[j + 4], d[j + 1]); g.arc(d[j], d[j + 1], d[j + 4], 0, 6.283); }
        g.fill();
      }
      if (pr.st) {
        const fade = p.t > p.dur - 0.25 ? Math.max(0, (p.dur - p.t) / 0.25) : 1;
        g.lineCap = "round"; g.lineJoin = "round";
        for (const st of pr.st) {
          const B = st.beads;
          if (p.t < st.brk) {   // still one thin stream from the wound, thick at the head, thinning behind
            g.globalAlpha = p.a * 0.95; g.strokeStyle = st.col;
            let last = -1;
            for (let k = 0; k < B.length - 1; k++) {
              const b0 = B[k], b1 = B[k + 1]; if (p.t < b0.born) break; last = k;
              const x1 = p.t < b1.born ? st.x0 : b1.x, y1 = p.t < b1.born ? st.y0 : b1.y;
              g.lineWidth = (b0.r + b1.r) * (1 - 0.35 * p.t / st.brk); g.beginPath(); g.moveTo(b0.x, b0.y); g.lineTo(x1, y1); g.stroke();
            }
            if (last >= 0) blob(g, B[0].x, B[0].y, Math.atan2(B[0].vy, B[0].vx), B[0].r * 1.1, 1.2, st.col, p.a);
          } else for (let k = 0; k < B.length; k++) {   // broken up: a line of drops, big at the front, small behind
            const b = B[k]; if (!b.on) continue;
            blob(g, b.x, b.y, Math.atan2(b.vy, b.vx), b.r * (k % 3 === 2 ? 0.7 : 0.95), 1 + Math.min(0.9, Math.hypot(b.vx, b.vy) / (360 * s)), st.col, p.a * fade);
          }
        }
      }
    }
    function decal(liq, x, y, w, r, kind) {   // kind: 0 splat · 1 pool · 2 spray
      const L = D.ground; if (L.length >= GROUND_MAX) { const j = L.findIndex((q) => !q.pool); L.splice(j < 0 ? 0 : j, 1); }   // pools stay longest
      const cells = kind === 1 ? [2, 5] : kind === 2 ? [3, 6] : [0, 1, 4, 7];
      const q = { liq, cell: cells[(r() * cells.length) | 0], x: x / W, y: (y - gy) / s, w: w / s, age: 0, flip: r() < 0.5 ? -1 : 1, grow: kind === 1 ? 0 : -0.7, pool: kind === 1 };
      if (q.pool) { q.lobes = [[0, 0, 0.5, 1]]; for (let i = 0; i < 8; i++) q.lobes.push([(r() - 0.5) * 0.7, (r() - 0.5) * 0.09, 0.14 + r() * 0.2, 0.7 + r() * 0.6]); }   // [blood3] a pool is a few soft lobes that spread at their own pace: an uneven edge
      L.push(q);   // a splatter shows once its drops have landed (~0.35 s)
    }
    function smear(side, liq, r, dir) {
      if (side !== "foe" && side !== "hero") return;
      const L = D.body; if (L.length >= BODY_MAX) L.shift();
      L.push({ side, liq, cell: liq === "blood" ? (r() * 4) | 0 : [3, 6, 0][(r() * 3) | 0], dx: (r() - 0.5) * 14, dy: -10 + r() * 14, w: 12 + r() * 8, rot: liq === "blood" ? (r() - 0.5) * 0.3 : (r() - 0.5) * 1.2 + (dir < 0 ? Math.PI : 0), age: 0 });
    }
    const matOf = (t) => (t.side === "foe" || !t.side ? t.mat || S.mat : "blood");

    // ---- gore.js hands us its drops, their splats and the streaks on a hurt figure
    const ready = (fam) => !!(fam && img(DROPS[fam]) && img(DEC[fam][0]));
    const liquid = {
      drop(g, x, y, vx, vy, r, c, a, i) {
        const fam = famOfCol(c); if (!ready(fam)) return false;
        // [blood3] round drops of mixed size (mostly small), stretched only a little by speed: liquid, not pills
        const sp = Math.hypot(vx, vy), u = (((i + 1) * 2654435761) >>> 0) % 997 / 997, rr = Math.max(0.3 * s, r * 0.2 * (0.4 + 1.1 * u * u * u));
        blob(g, x, y, Math.atan2(vy, vx), rr, 1 + Math.min(0.9, sp / (360 * s)), c, a);
        return true;
      },
      land(x, y, r, c, vx) {
        const fam = famOfCol(c); if (!ready(fam)) return false;
        const L = D.spat; if (L.length >= SPATS) L.shift();
        const sp = splatOf(r, vx, s), h = g0.hash(`${(x * 7) | 0}|${(y * 3) | 0}`);
        L.push({ liq: fam, cell: sp.cells[h % sp.cells.length], x: x / W, y: (y - gy) / s, w: sp.w / s, age: 0, flip: sp.flip });
        return true;
      },
      stain(px, py, r, c, kind) {   // gore.js's ink splats and pools: ours instead (pools come from kill()/down() below)
        const fam = kind === 1 || kind === 0 || kind === 3 ? famOfCol(c) : null; if (!ready(fam)) return false;
        if (kind === 1) return true;   // Full: kill() spreads a rendered pool; Reduced: no pools
        const L = D.spat; if (L.length >= SPATS) L.shift();
        L.push({ liq: fam, cell: [0, 1, 4, 7][g0.hash(`${px | 0}`) % 4], x: px / W, y: (py - gy) / s, w: (r * 2.6) / s, age: 0, flip: 1 });
        return true;
      },
      streak(g, X, Y, len, w, i, mat) {   // a run of blood down a hurt figure: a drip stain instead of an ink line
        if (FAM[mat] !== "blood") return false;
        const im = img(DRIPS[0]); if (!im) return false;
        const cw = DRIPS[2], ch = DRIPS[3], hh = Math.max(8, len * 1.5), ww = hh * (cw / ch);
        g.save(); g.globalAlpha = 0.72; g.drawImage(im, (i % 4) * cw, 0, cw, ch, X - ww / 2, Y - hh * 0.2, ww, hh); g.restore();
        return true;
      },
    };
    if (S.setLiquid) S.setLiquid(liquid);

    const oHit = S.hit;
    S.hit = function (t, h = {}) {
      const plan = oHit.call(S, t, h);
      if (plan && t) onHit(t, h);
      return plan;
    };
    function onHit(t, h, extra = 1) {
      const side = t.side || "foe", mat = matOf(t), type = h.type || "slash", dir = h.from || (side === "foe" ? 1 : -1);
      const r = g0.rng((seed0 ^ g0.hash(`${h.key ?? live}|${side}|${type}|fx2`)) >>> 0);
      const frac = h.frac ?? 0.1, armoured = side === "hero" || (side === "foe" && ARMOUR.test(String(o.foeName || ""))), pick = (r() * 4) | 0;
      const opt = { level: lv, side, frac, crit: !!h.crit, final: !!h.final, power: !!h.power, pick, metal: armoured && (type === "slash" || type === "pierce") && (pick === 0 || !!h.crit) };
      const ground = t.ground ?? gy;
      if (t.live !== false) for (const [key, size] of planOf(type, mat, opt)) {
        const low = key === "dust" || key === "bone";
        play(key, t.x + (low ? dir * 4 * s : 0), low ? Math.min(ground, t.y + 26 * s) : t.y, size * extra, dir, r, side === "foe" || side === "hero" ? 1 : 0.8, ground);
      }
      const dc = decalOf(type, mat, opt);
      if (dc.ground) {
        const k = Math.min(1.8, 0.7 + frac * 2) * (mat === "dragon" ? 1.4 : 1);
        decal(dc.liquid, t.x + dir * (14 + r() * 18) * s, ground + (r() - 0.2) * 4 * s, (34 + r() * 14) * k * s, r, dc.ground > 1 ? 0 : r() < 0.5 ? 2 : 0);
        if (dc.ground > 1) decal(dc.liquid, t.x + dir * (40 + r() * 22) * s, ground + (r() - 0.5) * 5 * s, (30 + r() * 12) * k * s, r, 2);
      }
      if (dc.body) smear(side === "foe" ? "foe" : "hero", dc.liquid, r, dir);
    }
    const oKill = S.kill;
    S.kill = function (t, k = {}) {
      const res = oKill.call(S, t, k);
      if (res && t && !k.instant) {
        const mat = matOf(t), dir = k.from || 1, death = k.death || "topple";
        if (res.burst) onHit({ ...t, side: "foe" }, { type: k.type || "slash", frac: 0.6, final: true, crit: !!k.crit, power: !!k.power, from: dir, key: `kill${k.key ?? 0}` }, k.crit || k.slowmo ? 1.15 : 1);
        if (full && FAM[mat] && !["ash", "shatter", "fade"].includes(death) && k.type !== "fire") {
          const r = g0.rng((seed0 ^ g0.hash(`kill|${k.key ?? 0}|fx2`)) >>> 0);
          decal(FAM[mat], t.bodyX ?? t.x, (t.ground ?? gy) + 2 * s, 80 * Math.min(1.8, t.size || 1) * (mat === "dragon" ? 1.5 : 1) * s, r, 1);
        }
      } else if (res && t && k.instant && full && FAM[matOf(t)] && !["ash", "shatter", "fade"].includes(k.death || "topple")) {   // a fight shown already over: the pool is just there
        const r = g0.rng((seed0 ^ g0.hash(`kill|${k.key ?? 0}|fx2`)) >>> 0);
        decal(FAM[matOf(t)], t.bodyX ?? t.x, (t.ground ?? gy) + 2 * s, 80 * Math.min(1.8, t.size || 1) * s, r, 1);
        D.ground[D.ground.length - 1].grow = 1;
      }
      return res;
    };
    /* someone is knocked down (the hero losing a fight): a pool spreads under them. Never friends or horses. */
    S.down = function (t = {}) {
      const side = t.side || "hero";
      if (!full || (side !== "hero" && side !== "foe") || D.down[side]) return false;
      D.down[side] = true;
      const r = g0.rng((seed0 ^ g0.hash(`down|${side}`)) >>> 0);
      decal("blood", t.x, (t.ground ?? gy) + 2 * s, 60 * s, r, 1);
      if (t.instant) D.ground[D.ground.length - 1].grow = 1;
      return true;
    };
    const oUpd = S.update;
    S.update = function (dt) {
      oUpd.call(S, dt);
      live = 0;
      for (const p of P) { if (!p.on) continue; p.t += dt; if (p.t >= p.dur) p.on = false; else { live++; if (p.proc) stepProc(p, dt); } }
      for (const q of D.ground) { q.age += dt; if (q.grow < 1) q.grow = Math.min(1, q.grow + dt / (q.pool ? POOL_GROW : 0.5)); }
      for (const q of D.spat) q.age += dt;
      for (const q of D.body) q.age += dt;
      if (D.ground.length && D.ground[0].age > GROUND_LIFE) D.ground.shift();
      if (D.spat.length && D.spat[0].age > SPAT_LIFE) D.spat.shift();
      if (D.body.length && D.body[0].age > BODY_LIFE) D.body.shift();
    };
    const oSettle = S.settle;
    S.settle = function () { oSettle.call(S); for (const p of P) p.on = false; live = 0; for (const q of D.ground) q.grow = 1; };
    const oClear = S.clear;
    S.clear = function () { oClear.call(S); for (const p of P) p.on = false; D.ground.length = 0; D.body.length = 0; D.spat.length = 0; D.down = {}; };

    /* never draw a picture bigger than 1.15x its own pixels: the canvas transform holds DPR and the fight camera */
    function capW(g, w, fw) {
      let k = 1; try { const m = g.getTransform(); k = Math.hypot(m.a, m.b) || 1; } catch { /* old canvas */ }
      return Math.min(w, (fw * 1.15) / k);
    }
    function cellDraw(g, liq, cell, cx, cy, w, h, alpha, flip) {
      const d = DEC[liq], im = d && img(d[0]); if (!im) return;
      const c = d[1], sx = (cell % 4) * c, sy = ((cell / 4) | 0) * c;
      const ww = capW(g, w, c), hh = h * (ww / w);
      g.globalAlpha = alpha;
      if (flip < 0) { g.save(); g.translate(cx, cy); g.scale(-1, 1); g.drawImage(im, sx, sy, c, c, -ww / 2, -hh / 2, ww, hh); g.restore(); }
      else g.drawImage(im, sx, sy, c, c, cx - ww / 2, cy - hh / 2, ww, hh);
    }
    /* [blood3] a pool: soft lobes (dark middle, soft rim) spreading over ~2 s, and a faint wet shine */
    function drawPool(g, q, f) {
      const lob = lobeSprite(q.liq), shine = lobeSprite("shine"); if (!lob || !img(DEC[q.liq]?.[0])) return;
      const W0 = q.w * s, cx = q.x * W, cy = gy + q.y * s, e = q.grow < 1 ? 1 - Math.pow(1 - q.grow, 2.2) : 1;
      g.globalAlpha = 0.9 * f;
      for (const [dx, dy, rad, gk] of q.lobes) {
        const ee = Math.min(1, e * gk), rr = W0 * rad * (0.15 + 0.85 * ee), lx = cx + dx * W0 * (0.4 + 0.6 * ee) * q.flip, ly = cy + dy * W0;
        g.drawImage(lob, lx - rr, ly - rr * 0.3, rr * 2, rr * 0.6);
      }
      if (shine) { g.globalAlpha = 0.2 * f * e; const sw = W0 * 0.34 * (0.3 + 0.7 * e); g.drawImage(shine, cx - W0 * 0.1 * q.flip - sw / 2, cy - W0 * 0.035, sw, sw * 0.12); }
    }
    const fadeOf = (age, life) => Math.max(0, 1 - Math.max(0, age - life * 0.5) / (life * 0.5));
    const oGround = S.drawGround;
    S.drawGround = function (g) {
      oGround.call(S, g);
      if (!D.ground.length && !D.spat.length) return;
      g.save();
      for (const q of D.ground) {   // pools and big splatters, lying flat: squashed
        if (q.grow <= 0) continue;
        const f = fadeOf(q.age, GROUND_LIFE), e = q.grow < 1 ? 1 - (1 - q.grow) * (1 - q.grow) : 1, w = q.w * s * (q.pool ? 0.3 + 0.7 * e : 0.85 + 0.15 * e);
        if (q.pool && q.lobes) { if (f > 0) drawPool(g, q, f); continue; }
        if (f > 0) cellDraw(g, q.liq, q.cell, q.x * W, gy + q.y * s, w, w * 0.3, 0.94 * f * (q.pool ? 0.6 + 0.4 * e : Math.min(1, e * 1.5)), q.flip);
      }
      for (const q of D.spat) {   // where the drops landed
        const f = fadeOf(q.age, SPAT_LIFE), w = q.w * s;
        if (f > 0) cellDraw(g, q.liq, q.cell, q.x * W, gy + q.y * s, w, w * 0.32, 0.9 * f, q.flip);
      }
      g.restore();
    };
    const oMarks = S.drawMarks;
    S.drawMarks = function (g, side, fx, fy, sc, hpFrac, hidden) {
      oMarks.call(S, g, side, fx, fy, sc, hpFrac, hidden);
      if (side !== "foe" && side !== "hero") return;
      if (hidden || !D.body.length) return;
      for (const q of D.body) {
        if (q.side !== side) continue;
        const f = Math.max(0, 1 - Math.max(0, q.age - BODY_LIFE * 0.6) / (BODY_LIFE * 0.4)), w = q.w * sc;
        if (f <= 0) continue;
        g.save();
        g.translate(fx + q.dx * sc, fy + q.dy * sc); g.rotate(q.rot);
        if (q.liq === "blood" && img(DRIPS[0])) {   // a stain with runs going down the body
          const im = img(DRIPS[0]), cw = DRIPS[2], ch = DRIPS[3], ww = capW(g, w, cw), hh = ww * (ch / cw);
          g.globalAlpha = 0.72 * f; g.drawImage(im, q.cell * cw, 0, cw, ch, -ww / 2, -hh * 0.26, ww, hh);
        } else {
          const d = DEC[q.liq], im = d && img(d[0]);
          if (im) { const c = d[1], ww = capW(g, w, c); g.globalAlpha = 0.75 * f; g.drawImage(im, (q.cell % 4) * c, ((q.cell / 4) | 0) * c, c, c, -ww / 2, -ww * 0.3, ww, ww * 0.6); }
        }
        g.restore();
      }
    };
    const oFront = S.drawFront;
    S.drawFront = function (g) {
      oFront.call(S, g);
      if (!live) return;
      g.save();
      for (const p of P) {
        if (!p.on) continue;
        if (p.proc) { if (ready("blood")) { g.globalCompositeOperation = "source-over"; drawProc(g, p); } continue; }
        const sh = p.sh, im = img(sh[0]); if (!im) continue;
        const n = sh[1], fw = sh[2], fh = sh[3], u = p.t / p.dur, fi = Math.min(n - 1, (u * n) | 0);
        // the burst opens over its first ~150 ms (20% → 100% wide), as in the frames
        const open = sh[7] ? 1 : Math.min(1, 0.55 + 0.45 * Math.min(1, p.t / 0.15));
        const w = capW(g, p.w * open, fw), h = w * (fh / fw);
        g.globalCompositeOperation = sh[7] ? "lighter" : "source-over";
        g.globalAlpha = p.a;
        g.save();
        g.translate(p.x, p.y); g.rotate(p.rot * p.flip); g.scale(p.flip, 1);
        g.drawImage(im, fi * fw, 0, fw, fh, -sh[4] * w, -sh[5] * h, w, h);
        g.restore();
      }
      g.restore();
    };
    S.fx2count = () => live;
    S.fx2decals = () => ({ ground: D.ground.length, body: D.body.length, spat: D.spat.length });
    S.fx2cap = () => ({ sprites: CAP, spats: SPATS });
    return S;
  }

  // wrap every stage gore.js makes (gore.js loads first)
  if (typeof GORE !== "undefined" && GORE.scene && !GORE.scene.fx2) {
    const base = GORE.scene;
    const scene = function (o = {}) { return wrap(base(o), o); };
    scene.fx2 = true;
    GORE.scene = scene;
  }
  return { SH, DEC, DROPS, DRIPS, KEYS, FAM, planOf, decalOf, splatOf, budgetK, wrap, metal: (name) => ARMOUR.test(String(name || "")) };
})();
if (typeof module !== "undefined") module.exports = GOREFX2;
