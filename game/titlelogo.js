/* titlelogo.js: the main-menu title "ROADS / of the / N✦RTH". [OURS]
     TITLELOGO.html()        → the title's markup (ui.js renderTitle puts it in #thead)
     TITLELOGO.mount(el)     → draws the map trail, mountains and pines around the words; redraws when the size changes
   The O of NORTH is the menu compass (ui-compass-ring + ui-compass-star); without the pictures it is a plain gold O.
   A dashed road leaves the bottom of the compass star, loops round the left of NORTH, runs under ROADS (behind
   "of the") and climbs round the right of ROADS to a waypoint. The route was traced from a painted concept, in that
   picture's units (NORTH spans x 205..972 there), and is scaled onto the real letters, so it fits any screen size.
   Mountains and pines are drawn as vectors (sharp at any size): each mountain sits on the road and is cut along it, so
   nothing ever crosses the trail. On first show the road draws itself and the star spins into place (not with
   reduced motion). */
const TITLELOGO = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const G = "#d9b56a";
  // the trail in concept-picture units, from the compass star to the waypoint
  const ROUTE = [[455, 562], [440, 600], [400, 625], [330, 645], [260, 650], [180, 632], [120, 597], [86, 552], [76, 500], [82, 440], [102, 398], [132, 360], [167, 334], [212, 320], [280, 318], [350, 322], [420, 327], [470, 327], [690, 325], [760, 325], [820, 328], [886, 327], [946, 308], [995, 276], [1014, 228], [1008, 186], [978, 151], [930, 129], [872, 117], [836, 106], [820, 97]];
  // [x, y, width, height, peaks [x 0..100, height 0..1, half-width], seed]
  const MOUNTAINS = [[262, 320, 96, 22, [[30, 0.55, 24], [58, 1, 28], [80, 0.42, 18]], 3], [726, 322, 100, 20, [[28, 0.7, 24], [52, 0.95, 22], [76, 0.5, 20]], 7],
    [846, 300, 124, 74, [[22, 0.45, 22], [50, 1, 28], [72, 0.62, 20]], 11], [150, 640, 150, 58, [[18, 0.5, 18], [40, 1, 26], [62, 0.62, 22], [82, 0.38, 16]], 5]];
  // [x, y, height, lean]; small ones first so the tall one stands in front
  const PINES = [[236, 318, 18, 0], [198, 318, 22, -0.5], [222, 318, 26, 0.5], [210, 320, 36, 0], [990, 266, 18, 0.4], [964, 262, 22, -0.5], [977, 258, 32, 0.3],
    [110, 533, 18, -0.3], [84, 532, 20, 0.4], [97, 530, 30, -0.4], [331, 652, 14, 0], [304, 652, 16, 0.4], [318, 650, 24, -0.4]];

  function html() {
    return `<div class="tlogo" role="heading" aria-level="1" aria-label="Roads of the North"><svg class="tl-road" aria-hidden="true"></svg>` +
      `<div class="tl-l1" aria-hidden="true">ROADS</div><div class="tl-of" aria-hidden="true"><span>of the</span></div>` +
      `<div class="tl-l2" aria-hidden="true"><span class="tl-g">N</span><span class="tl-cmp"><i class="tl-o">O</i><i class="tl-r"></i><i class="tl-s"></i></span><span class="tl-g">RTH</span></div></div>`;
  }

  const rng = (sd) => () => { sd |= 0; sd = (sd + 0x6d2b79f5) | 0; let t = Math.imul(sd ^ (sd >>> 15), 1 | sd); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const f1 = (v) => v.toFixed(1);
  const poly = (pts) => "M" + pts.map(([p, q]) => `${f1(p)} ${f1(q)}`).join(" L");
  /* a smooth curve through the points (Catmull-Rom as cubic Béziers) */
  function smooth(p) {
    let d = `M${f1(p[0][0])} ${f1(p[0][1])}`;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || [p[0][0], p[0][1] - 12], b = p[i], c = p[i + 1], e = p[i + 2] || [2 * c[0] - b[0], 2 * c[1] - b[1]];
      d += ` C ${f1(b[0] + (c[0] - a[0]) / 6)} ${f1(b[1] + (c[1] - a[1]) / 6)}, ${f1(c[0] - (e[0] - b[0]) / 6)} ${f1(c[1] - (e[1] - b[1]) / 6)}, ${f1(c[0])} ${f1(c[1])}`;
    }
    return d;
  }

  function mountain(m, sc, below, [x, yy, wd, ht, peaks, seed], clips) {
    const r = rng(seed), J = (a) => (r() * 2 - 1) * a;
    let [X, Y] = m(x, yy); const s2 = sc * wd / 100, H0 = 100 * ht / wd;
    const tb = below(X + 50 * s2, Y); if (tb != null) Y = tb - 2.5;   // sits right on the road under its middle
    const R = [], HT = [], SN = [];
    peaks.forEach(([px, ph, hw]) => {
      const top = -ph * H0, twin = r() < 0.35, lean = J(hw * 0.12);
      const Lp = [[px - hw * 1.25, H0 * 0.3], [px - hw, 0]];
      for (const t of [0.3, 0.52, 0.7, 0.86]) { const nx = px + lean * t - hw * (1 - t) + J(hw * 0.06), ny = top * t + J(-top * 0.05); Lp.push([nx, ny]); if (r() < 0.4) Lp.push([nx + hw * 0.05, ny - top * 0.04]); }
      const sx = px + lean, summit = twin ? [[sx - hw * 0.1, top * 0.95], [sx - hw * 0.04, top * 0.88], [sx + hw * 0.03, top]] : [[sx, top]];
      Lp.push(...summit);
      const right = [];
      for (const t of [0.84, 0.66, 0.48, 0.28]) { const nx = px + lean * t + hw * (1 - t) + J(hw * 0.06), ny = top * t + J(-top * 0.05); right.push([nx, ny]); if (r() < 0.35) right.push([nx - hw * 0.04, ny - top * 0.05]); }
      Lp.push(...right, [px + hw, 0], [px + hw * 1.25, H0 * 0.3]);
      R.push(Lp);
      // engraving: short strokes down the shadow (right) flank
      const fl = [summit[summit.length - 1], ...right, [px + hw, 0]]; let h = "";
      for (let k = 0; k < fl.length - 1; k++) { const [a1, b1] = fl[k], [a2, b2] = fl[k + 1]; for (let f = 0.25; f < 1; f += 0.5) { const hx = a1 + (a2 - a1) * f, hy = b1 + (b2 - b1) * f, len = Math.max(1.4, -hy * 0.42); h += `M${f1(hx - 0.8)} ${f1(hy + 1.3)} l${f1(-len * 0.3)} ${f1(len)}`; } }
      HT.push(h);
      // snow: the summit and the points just under it, with a ragged lower edge
      const sl = Lp.filter(([, q]) => q < top * 0.7), sb = [...sl].reverse().map(([p, q], k) => [p + (k % 2 ? -1 : 1) * hw * 0.03, q - top * (0.06 + (k % 2) * 0.05)]);
      SN.push(poly([...sl, ...sb]) + "Z");
    });
    let body = "";
    for (const k of peaks.map((p, i) => i).sort((a, b) => peaks[a][1] - peaks[b][1])) {   // back peaks first
      body += `<path d="${poly(R[k])}Z" fill="url(#tl-mg)"/><path d="${HT[k]}" fill="none" stroke="#b08a4a" stroke-width="${f1(0.6 / s2)}" opacity=".8"/>` +
        `<path d="${SN[k]}" fill="#f2e2b8"/><path d="${poly(R[k].slice(2, -2))}" fill="none" stroke="${G}" stroke-width="${(1.05 / s2).toFixed(2)}" stroke-linejoin="round"/>`;
    }
    const ci = clips.push({ x0: X - 40 * s2, x1: X + 140 * s2, y: Y, top: Y - H0 * s2, cx: X + 50 * s2 }) - 1;
    return `<g class="tl-deco" clip-path="url(#tl-mc${ci})"><g transform="translate(${f1(X)} ${f1(Y)}) scale(${s2.toFixed(4)})" stroke-linecap="round">${body}</g></g>`;
  }

  function pine(m, sc, below, [x, yy, ht, lean], seed) {
    const r = rng(seed), J = (a) => (r() * 2 - 1) * a;
    let [X, Y] = m(x, yy); const s2 = sc * ht / 30;
    const tb = below(X, Y - 6); if (tb != null && Math.abs(tb - Y) < 10) Y = tb - 2;   // stands on the road when it's right there
    const n = 5 + ((r() * 3) | 0), W = 6 + r() * 2.2, top = -30, base = -3, L = [[lean, top]], Rr = [], H = [];
    for (let k = 1; k <= n; k++) {
      const f = k / n, y = top + (base - top) * f, w = W * (0.25 + 0.75 * f) * (0.9 + r() * 0.2), th = (base - top) / n, ax = lean * (1 - f);
      L.push([ax - w * 0.3 + J(0.3), y - th * 0.7], [ax - w * 0.75 + J(0.4), y - th * 0.15], [ax - w + J(0.5), y + th * 0.12 + J(0.3)]);
      Rr.push([ax + w * 0.3 + J(0.3), y - th * 0.7], [ax + w * 0.75 + J(0.4), y - th * 0.15], [ax + w + J(0.5), y + th * 0.12 + J(0.3)]);
      H.push(`M${f1(ax + w * 0.3)} ${f1(y - th * 0.4)} l${f1(w * 0.4)} ${f1(th * 0.5)}`);
    }
    const d = poly([...L, [-0.7, base], [-0.7, 0.8], [0.7, 0.8], [0.7, base], ...Rr.reverse()]) + "Z";
    return `<g class="tl-deco" transform="translate(${f1(X)} ${f1(Y)}) scale(${s2.toFixed(4)})"><path d="${d}" fill="url(#tl-tg)"/><path d="${H.join("")}" stroke="#3a2a14" stroke-width="${(0.35 / s2).toFixed(2)}" opacity=".7" fill="none" stroke-linecap="round"/></g>`;
  }

  const DEFS = `<linearGradient id="tl-rg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#f3d78f" stop-opacity=".45"/><stop offset=".5" stop-color="#e6c37a" stop-opacity=".85"/><stop offset="1" stop-color="#f3d78f"/></linearGradient>` +
    `<linearGradient id="tl-mg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e5733"/><stop offset=".45" stop-color="#4a3a22"/><stop offset=".55" stop-color="#2e2416"/><stop offset="1" stop-color="#1f1810"/></linearGradient>` +
    `<linearGradient id="tl-tg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f0d38e"/><stop offset=".46" stop-color="#d1a65a"/><stop offset=".54" stop-color="#94692c"/><stop offset="1" stop-color="#6a4a1e"/></linearGradient>`;

  function draw(el) {
    const svg = el.querySelector(".tl-road"); if (!svg) return;
    const t = el.getBoundingClientRect(); if (t.width < 20) return;
    const R = (q) => { const r = el.querySelector(q).getBoundingClientRect(); return { l: r.left - t.left, r: r.right - t.left, t: r.top - t.top, b: r.bottom - t.top, cx: (r.left + r.right) / 2 - t.left, cy: (r.top + r.bottom) / 2 - t.top }; };
    const O = R(".tl-of span"), K = R(".tl-cmp"), golds = el.querySelectorAll(".tl-l2 .tl-g");
    const N = R(".tl-l2 .tl-g"), Hr = golds[golds.length - 1].getBoundingClientRect().right - t.left;
    const sc = (Hr - N.l) / (972 - 205), ox = N.l - 205 * sc, oy = N.cy - 465 * sc, m = (x, y) => [ox + x * sc, oy + y * sc];
    const P = ROUTE.map(([x, y]) => m(x, y)); P[0] = [K.cx, K.b + 2];
    const road = smooth(P), [wx, wy] = P[P.length - 1];
    // the road as points, so mountains and pines can stand on it
    const pe = document.createElementNS(NS, "path"); pe.setAttribute("d", road);
    const Ln = pe.getTotalLength(), pts = [];
    for (let l = 0; l <= Ln; l += 1.5) { const q = pe.getPointAtLength(l); pts.push([q.x, q.y]); }
    const below = (x, y0) => { let b = null; for (const [px, py] of pts) if (Math.abs(px - x) < 2 && py > y0 - 4 && (b == null || py < b)) b = py; return b; };
    const clips = [];
    let deco = "";
    PINES.slice(0, 4).forEach((p, i) => { deco += pine(m, sc, below, p, 40 + i); });
    deco += mountain(m, sc, below, MOUNTAINS[0], clips) + mountain(m, sc, below, MOUNTAINS[1], clips) + mountain(m, sc, below, MOUNTAINS[2], clips);
    PINES.slice(4, 10).forEach((p, i) => { deco += pine(m, sc, below, p, 44 + i); });
    deco += mountain(m, sc, below, MOUNTAINS[3], clips);
    PINES.slice(10).forEach((p, i) => { deco += pine(m, sc, below, p, 50 + i); });
    // each mountain is cut a little above the road under it, and never reaches past the road beside it
    let cdefs = "";
    clips.forEach((c, k) => {
      let xl = -1e9, xr = 1e9;
      for (const [px, py] of pts) if (py < c.y - (c.y - c.top) * 0.35 && py > c.top - 10) { if (px < c.cx) xl = Math.max(xl, px + 4); else xr = Math.min(xr, px - 4); }
      const x0 = Math.max(c.x0, xl), x1 = Math.min(c.x1, xr), xs = [];
      for (let x = x0; x <= x1; x += 2) { let b = null; for (const [px, py] of pts) if (Math.abs(px - x) <= 2 && py > c.y - 8 && (b == null || py < b)) b = py; xs.push([x, (b == null ? c.y + 4 : b) - 3.2]); }
      cdefs += `<clipPath id="tl-mc${k}" clipPathUnits="userSpaceOnUse"><polygon points="${[[x0, c.top - 60], [x1, c.top - 60], ...xs.reverse()].map((p) => p.map(f1).join(",")).join(" ")}"/></clipPath>`;
    });
    const hide = `<mask id="tl-mk" maskUnits="userSpaceOnUse" x="-200" y="-200" width="${f1(t.width + 400)}" height="${f1(t.height + 400)}"><rect x="-200" y="-200" width="${f1(t.width + 400)}" height="${f1(t.height + 400)}" fill="#fff"/><rect x="${f1(O.l + 4)}" y="${f1(O.t - 2)}" width="${f1(O.r - O.l - 8)}" height="${f1(O.b - O.t + 4)}" rx="6" fill="#000"/></mask>`;
    // the road draws itself on first show: a solid stroke in a mask reveals the dashes
    const draw1 = !el.dataset.drawn && !(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
    const grow = `<mask id="tl-gm" maskUnits="userSpaceOnUse" x="-200" y="-200" width="${f1(t.width + 400)}" height="${f1(t.height + 400)}"><path class="tl-grow${draw1 ? " go" : ""}" d="${road}" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" pathLength="1"/></mask>`;
    svg.innerHTML = `<defs>${DEFS}${cdefs}${hide}${grow}</defs><g mask="url(#tl-gm)"><path d="${road}" fill="none" stroke="url(#tl-rg)" stroke-width="2" stroke-linecap="round" stroke-dasharray="4.5 6" mask="url(#tl-mk)"/></g>` +
      `<g class="tl-decos${draw1 ? " go" : ""}">${deco}<circle cx="${f1(wx)}" cy="${f1(wy)}" r="7" fill="none" stroke="#e6c785" stroke-opacity=".45" stroke-width="1"/><circle cx="${f1(wx)}" cy="${f1(wy)}" r="3" fill="#f3d78f"/></g>`;
    el.dataset.drawn = "1";
  }

  function mount(el) {
    if (!el || el.dataset.mounted) return;
    el.dataset.mounted = "1";
    let last = "";
    const redraw = () => { const r = el.getBoundingClientRect(), k = Math.round(r.width) + "x" + Math.round(r.height); if (k === last || !el.isConnected) return; last = k; try { draw(el); } catch (e) { /* the words still show without the trail */ } };
    try { (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(redraw)); } catch { redraw(); }
    if (typeof ResizeObserver !== "undefined") { const ro = new ResizeObserver(() => { if (!el.isConnected) { ro.disconnect(); return; } redraw(); }); ro.observe(el); }
  }

  return { html, mount, ROUTE, MOUNTAINS, PINES };
})();
if (typeof module !== "undefined") module.exports = TITLELOGO;
