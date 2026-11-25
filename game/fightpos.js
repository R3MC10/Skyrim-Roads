/* Where everyone stands in a fight scene. [OURS] (fightpos)
   Owner: "During combat every character should be positioned correctly and enemies also".
   One function places every fighter on the stage (fightart.js draws them, combat2.js / foeintent.js hang the health
   plates, pop-ups and the target ring on the same spots):
   - Your side on the left facing right, the foes on the right facing left. Feet on the scene's ground line (80% of
     the stage, the same line in every painted scene); the depth rows behind stand a little higher and a little
     smaller (farther away), never lower (the foreground strip covers the bottom of the stage).
   - Your company (up to 7 other players, followers, summons, thralls) fills rows behind you from the front: as
     close as they comfortably fit, then a second and a third row staggered into the gaps, squeezed only as much as
     needed. Fliers circle overhead. A live summon stands just ahead of you, one row back.
   - The foe stands across the gap; the ones still waiting their turn (a group, or one foe per hero in a party) stand
     in rows behind it. Big foes keep their size until they would not fit, then shrink just enough.
   - Everything stays inside the part of the stage you can actually see (on a phone the immersive screen crops the
     stage's sides; fightart.js passes the visible band).
   Sizes are in drawing units at scale 1, feet at the origin: [back, front, height], "front" = toward the other side.
   Pure numbers, no drawing: tests/test_fightpos.js checks many party and foe combinations. */
const FIGHTPOS = (() => {
  const ROW_LIFT = 7, ROW_SC = 0.9, MAX_ROWS = 3, PAD = 4, GAP = 26, CROWD_LIFT = 1.9;
  // the foe's figure (fightart.js foeFig / foerig.js / a painted picture), its size already in
  const FOE = { person: [13, 15, 72], player: [13, 15, 72], bandit: [13, 15, 72], giant: [24, 26, 108], troll: [20, 22, 96], centurion: [22, 28, 104],
    mammoth: [52, 56, 100], dragon: [90, 90, 124], werewolf: [24, 30, 84], wolf: [26, 30, 34], wolves: [30, 30, 40], bear: [32, 34, 46], cat: [30, 30, 38],
    skeever: [16, 18, 18], crab: [32, 32, 22], spider: [30, 26, 32], dspider: [30, 26, 32], sphere: [16, 20, 62], wisp: [26, 26, 62], atronach: [24, 24, 76],
    lich: [14, 16, 84], hagraven: [13, 15, 70], goblin: [10, 12, 46] };
  // helpers on your side (fightart.js allyFig, its own scale included)
  const ALLY = { mate: [13, 15, 72], follower: [13, 15, 72], soldier: [10, 12, 45], zombie: [11, 12, 50], valor: [13, 15, 60], dremora: [12, 16, 60],
    icewolf: [16, 20, 26], beast: [18, 22, 32], familiar: [16, 20, 26], werewolf: [18, 20, 50], vlord: [16, 16, 55], gargoyle: [16, 16, 58],
    flame_atronach: [14, 14, 66], frost_atronach: [16, 16, 62], storm_atronach: [18, 18, 62], dog: [12, 14, 18], odah: [50, 40, 60], dragon: [50, 40, 60] };
  const HERO = [12, 14, 72], HORSE = [40, 42, 100];
  const FLY = new Set(["odah", "dragon"]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const foeSize = (k, o = {}) => (o.back != null ? [o.back, o.front, o.h] : FOE[k] || FOE.person);
  const allySize = (a) => (a.ride ? HORSE : ALLY[a.kind] || ALLY.soldier);

  /* lay out one line of figures from x0 going away from the gap (dir -1: to the left, +1: to the right), spacing k */
  function line(items, x0, dir, sc, k) {
    const out = []; let x = x0;
    items.forEach((it, i) => {
      const [b, fr] = it.sz;
      if (i) { const [pb] = items[i - 1].sz; x += dir * (pb + fr) * sc * k; } else x += dir * fr * sc;
      out.push(x);
    });
    return out;
  }
  /* the spacing (<= 1) that fits a line of items in room px; widths in units, s px per unit */
  function fitK(items, room, sc, s) {
    if (items.length < 2) return 1;
    let inner = 0; for (let i = 1; i < items.length; i++) inner += (items[i - 1].sz[0] + items[i].sz[1]) * sc * s;
    const ends = (items[0].sz[1] + items[items.length - 1].sz[0]) * sc * s;
    return Math.min(1.3, (room - ends) / inner);   // can go below 0: no room at all (the caller clamps)
  }
  /* rows from the front: each next one goes to the row with the most room left for it (front row on a tie) */
  function split(list, rows, room, sc) {
    const out = Array.from({ length: rows }, () => []), used = new Array(rows).fill(0);
    for (const it of list) {
      let bi = 0, bv = -Infinity;
      for (let r = 0; r < rows; r++) { const w = (it.sz[0] + it.sz[1]) * sc(r), v = (room(r) - used[r] - w) / Math.max(1, room(r)) - r * 0.02; if (v > bv + 1e-9) { bv = v; bi = r; } }
      out[bi].push(it); used[bi] += (it.sz[0] + it.sz[1]) * sc(bi);
    }
    while (out.length > 1 && !out[out.length - 1].length) out.pop();
    return out;
  }
  /* [fightfeel] how much of figure f shows past the ones of `others` standing in front of it (feet lower = nearer): the
     middle 60 % of each box, sampled 12x16; head = its top quarter. → { body, head } 0..1 */
  function seen(f, others) {
    const mid = (g) => [(g.left + g.right) / 2 - (g.right - g.left) * 0.3, (g.left + g.right) / 2 + (g.right - g.left) * 0.3];
    const front = others.filter((g) => g && g !== f && g.y > f.y + 0.01).map((g) => [...mid(g), g.top, g.y]), [x0, x1] = mid(f);
    let tot = 0, sn = 0, ht = 0, hs = 0;
    for (let i = 0; i < 12; i++) for (let j = 0; j < 16; j++) {
      const x = x0 + (x1 - x0) * (i + 0.5) / 12, y = f.top + (f.y - f.top) * (j + 0.5) / 16, cov = front.some(([a, b, t, y1]) => x > a && x < b && y > t && y < y1);
      tot++; if (!cov) sn++; if (j < 4) { ht++; if (!cov) hs++; }
    }
    return { body: sn / tot, head: hs / ht };
  }

  /* o: { W, Hh, l, r (the visible band, stage px), t (the visible top, stage px: under the turn strip), groundY, ride (you on a horse), allies: [{ name, kind, ride }],
          foe: { kind, back, front, h } (sizes optional), waiting: foes still to come, summon: kind or null, maxWait }
     → { s, gy, l, r, hero, foe, allies, flyers, summon, waiting, more, rows, tag } — every figure { x, y (feet), sc,
       top (head), left, right } in stage px */
  function layout(o) {
    const W = o.W, Hh = o.Hh, s = Hh / 150, gy = o.groundY ?? Hh * 0.8;
    const l = clamp(o.l ?? 0, 0, W * 0.45), r = clamp(o.r ?? W, W * 0.55, W), BW = r - l, pad = PAD * s;
    const fig = (x, y, sc, sz, extra) => ({ x, y, sc, top: y - sz[2] * sc * s, left: x - sz[0] * sc * s, right: x + sz[1] * sc * s, ...extra });
    // ---- the foe: fits the band (at most ~55% of it wide, its head below the top tenth)
    const fk = o.foe?.kind || "person", fz = foeSize(fk, o.foe || {});
    const minFs = fz[2] >= 90 ? Math.min(1, (1.1 * HERO[2]) / fz[2]) : 0.8;   // a dragon or a giant always stays bigger than you
    let fs = 1;
    if ((fz[0] + fz[1]) * s > 0.6 * BW) fs = Math.max(minFs, (0.6 * BW) / ((fz[0] + fz[1]) * s));
    const tv = Math.max(Hh * 0.1, (o.t || 0) + 4 * s);   // [magicaim] the visible top: under the turn strip when the stage slid up
    if (fz[2] * s * fs > gy - tv) fs = Math.min(fs, Math.max(0.35, (gy - tv) / (fz[2] * s)));
    const wOff = (q) => (o.waiting > 0 ? 0.5 * (fz[0] + fz[1]) * q * s : 0);   // room for the next one to peek out behind it
    let fx = Math.min(l + BW * 0.74, r - pad - fz[0] * fs * s - wOff(fs));
    // ---- you: a quarter in, further in when people stand behind you, never into the foe
    const hz = o.ride ? HORSE : HERO, allies = (o.allies || []).filter((a) => !FLY.has(a.kind)), fl = (o.allies || []).filter((a) => FLY.has(a.kind));
    const per = allies.length ? allies.reduce((t, a) => t + allySize(a)[0] + allySize(a)[1], 0) / allies.length : 0;
    const need = allies.length ? (Math.ceil(allies.length / MAX_ROWS) - 1) * per * 0.62 * s + per * s : 0;   // the company's room at a comfortable squeeze
    const want = Math.max(l + BW * (allies.length > 3 ? 0.4 : allies.length ? 0.34 : 0.27), l + pad + need + (hz[0] + 2) * s);
    const reach = fz[1] > 40 ? fz[1] * 0.45 : fz[1];   // a dragon's or a mammoth's head is high up: you can stand under its neck
    const maxH = (q) => fx - (reach * q + hz[1] + GAP) * s;
    let hx = want;
    if (hx > maxH(fs)) fx = r - pad - fz[0] * fs * s - wOff(fs);   // no room: the foe steps back,
    if (hx > maxH(fs)) fx = r - pad - fz[0] * fs * s;   // right to the edge,
    if (hx > maxH(fs)) {   // then it shrinks a little (down to 70%), then you give way
      const fx2 = (q) => r - pad - fz[0] * q * s, avail = fx2(fs) - (reach * fs + hz[1] + GAP) * s - hx;
      const q = clamp(fs * (1 - Math.max(0, -avail) / ((fz[0] + reach) * fs * s)), Math.min(fs, Math.max(minFs, fs * 0.7)), fs);
      fs = q; fx = fx2(fs); hx = Math.min(hx, maxH(fs));
    }
    {   // [fightnums] the whole foe stays on screen: a painted one wider than the band shrinks until it fits, edge to edge
      const fw0 = (fz[0] + fz[1]) * s;
      if (fw0 * fs > BW - 2 * pad) { fs = (BW - 2 * pad) / fw0; fx = r - pad - fz[0] * fs * s; hx = Math.min(hx, maxH(fs)); }
      else if (fx - fz[1] * fs * s < l + pad) fx = l + pad + fz[1] * fs * s;
    }
    if (allies.length > 3) hx = Math.max(hx, Math.min(maxH(fs), Math.max(l + BW * 0.46, l + pad + (Math.ceil(allies.length / MAX_ROWS) * per + hz[0] + 2) * s)));   // a crowd: you step up so they all fit behind you
    hx = Math.max(hx, l + pad + hz[0] * s);
    const hero = fig(hx, gy, 1, hz, { ride: !!o.ride });
    // ---- your company in rows behind you
    const L0 = l + pad, items = allies.map((a) => ({ a, sz: allySize(a) }));
    const near = (row) => (row ? hx - (hz[0] * (row === 1 ? 0.75 : 0.3) - 6 * row) * s : hx - (hz[0] + 2) * s);   // [fightfeel] the first back row peeks out just behind your shoulder, not hidden right behind you
    // a crowd that will not fit behind you: the back rows spread out across the gap too (smaller, higher, drawn behind you)
    const foeL = fx - reach * fs * s, wide = (row) => (row ? Math.max(near(row), foeL - (14 + 8 * row) * s) : near(row));
    /* [fightfeel] a crowd: the back rows get smaller (down to 78%) and stand higher, so every head clears the row in
       front and nobody is hidden behind another; a small party keeps the classic spots */
    let CS = 1;
    const rsc = (row) => (row ? ROW_SC ** row * CS : 1);
    function pick(rightOf) {
      let best = null;
      for (let R = 1; R <= MAX_ROWS + 2 && items.length; R++) {
        if (R > MAX_ROWS && best.worst >= (R > MAX_ROWS + 1 ? 0.35 : 0.6)) break;   // a fourth row only when three are packed, a fifth for a mounted crowd on a phone
        const parts = split(items, R, (row) => Math.max(0, rightOf(row) - L0), (row) => rsc(row) * s), ks = parts.map((p, row) => fitK(p, rightOf(row) - L0, rsc(row), s));
        const worst = Math.min(...parts.map((p, row) => !p.length ? 9 : (rightOf(row) - L0) / Math.max(1, p.reduce((t, it) => t + (it.sz[0] + it.sz[1]) * rsc(row) * s, 0))));   // room / what the row needs
        if (!best || worst > best.worst + 0.04) best = { R: parts.length, parts, ks, worst, rightOf };
        if (worst >= 0.95) break;
      }
      return best;
    }
    let rows = items.length ? 1 : 0, best = null;
    for (const c of [1, 0.88, 0.78]) {
      CS = c; best = pick(near);
      if (best && best.worst < 0.55) { const b2 = pick(wide); if (b2.worst > best.worst + 0.02) best = b2; }
      if (!best || best.R < 2 || best.worst >= 0.9) break;
    }
    if (best) best.ks = best.ks.map((k) => clamp(k, 0.25, 1.3));   // a phone-wide party of 11 overlaps a little, never stacks
    const crowd = !!best && best.R > 1, lift = crowd ? ROW_LIFT * CROWD_LIFT : ROW_LIFT;
    const placed = [];
    if (best) {
      rows = best.R;
      best.parts.forEach((p, row) => {
        const sc = rsc(row), y = gy - row * lift * s, k = best.ks[row];
        const pitch = ((p[0]?.sz[0] || 12) + (p[0]?.sz[1] || 14)) * sc * s * k, stag = crowd && best.R > 2 && k >= 0.9 ? ((row * pitch) / best.R) % pitch : row % 2 ? 0.5 * (p[0]?.sz[0] || 12) * sc * s * k : 0;   // [fightfeel] three rows: each a third of a step over, so they fill each other's gaps
        const xs = line(p, best.rightOf(row) - stag, -1, sc * s, k), n1 = xs.length - 1, lo = n1 >= 0 ? L0 + p[n1].sz[0] * sc * s : 0;
        if (n1 > 0 && xs[n1] < lo) { const top = Math.max(xs[0], lo + n1 * 8 * sc * s); for (let i = 0; i <= n1; i++) xs[i] = top - ((top - lo) * i) / n1; }   // too many for the room: squeeze the whole line evenly (never a pile at the edge)
        p.forEach((it, i) => placed.push(fig(Math.max(L0 + it.sz[0] * sc * s, xs[i]), y, sc, it.sz, { name: it.a.name, kind: it.a.kind, ride: !!it.a.ride, row })));
      });
    }
    const flyers = fl.map((a, i) => ({ ...fig(hx - (10 + i * 30) * s, gy - 44 * s, 1, ALLY[a.kind], {}), name: a.name, kind: a.kind, fly: true }));
    // ---- a live summon: just ahead of you, one row back
    let summon = null;
    if (o.summon) { const z = ALLY[o.summon] || ALLY.familiar; summon = fig(Math.min(hx + (hz[1] * 0.4 + z[0]) * ROW_SC * s + 6 * s, fx - (fz[1] * fs + z[1]) * s), gy - ROW_LIFT * s, ROW_SC, z, { kind: o.summon }); }
    // ---- the foe and the ones waiting behind it
    const foe = fig(fx, gy, fs, [fz[1], fz[0], fz[2]], { kind: fk, fs });   // on screen its front is to the left
    foe.left = fx - fz[1] * fs * s; foe.right = fx + fz[0] * fs * s;
    const nWait = Math.max(0, o.waiting | 0), maxW = o.maxWait ?? (BW < 600 ? 4 : 5), waiting = [];
    const fw = (fz[0] + fz[1]) * fs * s;
    let shown = 0;
    let wsc = 1, wlift = ROW_LIFT;   // [fightfeel] a big group: the ones waiting get smaller and stand higher so more of them show
    const put = (x, row, y) => { const sc = ROW_SC ** row * (row ? wsc : 1), f2 = fig(x, y ?? gy - row * wlift * s, sc * fs, [fz[1], fz[0], fz[2]], { row }); f2.left = x - fz[1] * fs * sc * s; f2.right = x + fz[0] * fs * sc * s; waiting.push(f2); };
    {   // one row back: from half behind the foe to the edge, shoulder to shoulder; then the second row in the gaps between them
      const want = Math.min(nWait, maxW);
      let sc = ROW_SC, w = fw * sc, last = r - pad - fz[0] * fs * sc * s, x0 = Math.min(last, fx + 0.55 * fw), n = 0;
      for (const c of [1, 0.88, 0.78]) {
        sc = ROW_SC * c; w = fw * sc; last = r - pad - fz[0] * fs * sc * s; x0 = Math.min(last, fx + 0.55 * fw);   // its feet: the furthest it can stand and stay on screen
        n = Math.min(want, 1 + Math.floor((last - x0) / (w * 0.62))); wsc = c; wlift = c < 1 ? ROW_LIFT * CROWD_LIFT : ROW_LIFT;
        if (x0 >= fx + 0.3 * fw && (n >= Math.min(want, 2) || want - n <= 0)) break;
      }
      if (want && x0 >= fx + 0.3 * fw) {   // (not when it would hide right behind the foe)
        const gap = n > 1 ? Math.min(w * 0.9, (last - x0) / (n - 1)) : 0, xs = [];
        for (let j = 0; j < n; j++) { xs.push(x0 + j * gap); put(x0 + j * gap, 1); }
        shown = n;
        const mids = [...xs.slice(1).map((x, j) => (x + xs[j]) / 2), (fx + xs[0]) / 2].filter((x) => x - fx >= 0.25 * fw);   // between two of them (the gaps further out first)
        for (const x of mids) {
          if (shown >= want) break;
          put(x, 2);
          if (seen(waiting[waiting.length - 1], [foe, ...waiting.filter((q) => q.row === 1)]).head < 0.5) waiting.pop();   // [fightfeel] never with its head hidden behind the foe
          else shown++;
        }
      }
      if (shown < want) {   // [fightfeel] no more room beside the foe (a big party pushed it to the edge): the rest stand further back and higher, over its shoulders
        wsc = Math.min(wsc, 0.88); wlift = ROW_LIFT * CROWD_LIFT;
        for (const row of [1, 2]) {   // their feet further back, so each head clears the foe's (as far as the top of the stage allows)
          const sc = ROW_SC ** row * wsc, h = fz[2] * fs * sc * s, y = Math.max(tv + h, gy - (row + 1) * wlift * s, Math.min(gy - row * wlift * s, foe.top + (row === 1 ? 0.72 : 0.45) * h));   // never floating: at most one row further back than usual
          const lo = Math.max(l + pad + fz[1] * fs * sc * s, y < foe.y - 0.3 * (foe.y - foe.top) ? Math.max(hero.right + 0.5 * fw * sc, fx - 0.9 * fw) : fx + 0.08 * fw), hi = r - pad - fz[0] * fs * sc * s, K = 5;
          for (let j = 0; j < K && shown < want && hi > lo; j++) {
            const x = lo + (hi - lo) * (row === 1 ? j / (K - 1) : (j + 0.5) / K);
            if (waiting.some((q) => q.row === row && Math.abs(q.x - x) < 0.5 * fw * sc)) continue;
            put(x, row, y);
            const me = waiting[waiting.length - 1];
            if (seen(me, [hero, foe, ...waiting.filter((q) => q.row < row)]).head < 0.5) waiting.pop(); else shown++;
          }
        }
      }
    }
    waiting.sort((p, q) => q.row - p.row);   // drawn back to front
    // ---- the "N of your party" tag: over the middle of the company, inside the band
    let tag = null;
    if (placed.length) { const xs = placed.map((p) => p.x), top = Math.min(...placed.map((p) => p.top)); tag = { x: clamp((Math.min(...xs) + Math.max(...xs)) / 2, l + 40, r - 40), y: Math.max(Hh * 0.12, top - 8 * s) }; }
    return { W, Hh, s, gy, l, r, hero, foe, allies: placed, flyers, summon, waiting, more: nWait - shown, rows, tag, lift, wlift, rowSc: Array.from({ length: Math.max(1, rows) }, (_, i) => rsc(i)), wsc };
  }

  /* --------------------------------------------------------------- shared with the screen: where each one is */
  function publish(cv, L) {
    if (!cv || !L) return;
    cv.__fp = L;
    const q = (v) => Math.round(v);
    try { cv.dataset.fp = JSON.stringify({ W: q(L.W), H: q(L.Hh), l: q(L.l), r: q(L.r), gy: q(L.gy), h: [q(L.hero.x), q(L.hero.top)], f: [q(L.foe.x), q(L.foe.top), +L.foe.fs.toFixed(2)], a: L.allies.map((a) => [q(a.x), q(a.y), +a.sc.toFixed(2)]), w: L.waiting.map((w) => [q(w.x), q(w.y)]), rows: L.rows }); } catch (e) { /* no dataset */ }
  }
  /* a fighter in page pixels: who = "me", "foe", or an ally's name; null when the scene has not laid out yet */
  function screenOf(cv, who) {
    const L = cv && cv.__fp; if (!L || !cv.getBoundingClientRect) return null;
    const rc = cv.getBoundingClientRect(); if (!rc.width) return null;
    const k = rc.width / L.W;
    const p = who === "me" ? L.hero : who === "foe" ? L.foe : L.allies.find((a) => a.name === who) || L.flyers.find((a) => a.name === who) || null;
    if (!p) return null;
    const C = cv.__cam;   // [fightcam] the fight camera has moved: where it shows now (fightcam.js; same size labels, so k stays)
    if (C) { const c = C(p.x, p.y), z = Math.hypot(C(p.x + 1, p.y)[0] - c[0], C(p.x + 1, p.y)[1] - c[1]); return { x: rc.left + c[0] * k, y: rc.top + c[1] * k, top: rc.top + C(p.x, p.top)[1] * k, left: rc.left + C(p.left, p.y)[0] * k, right: rc.left + C(p.right, p.y)[0] * k, sc: p.sc * z, k, s: L.s * k * z }; }
    return { x: rc.left + p.x * k, y: rc.top + p.y * k, top: rc.top + p.top * k, left: rc.left + p.left * k, right: rc.left + p.right * k, sc: p.sc, k, s: L.s * k };
  }
  /* [fightfeel] how much of each fighter shows: the middle 60 % of each figure's box, covered by the figures standing in
     front of it (a lower row, nearer the camera). [{ who, body, head }] (head: its top quarter), 0..1 */
  function visible(L) {
    const figs = [["hero", L.hero], ...L.allies.map((a, i) => ["a" + i, a]), ["foe", L.foe], ...L.waiting.map((w, i) => ["w" + i, w])];
    return figs.map(([who, f]) => ({ who, ...seen(f, figs.map(([, g]) => g)) }));
  }
  return { layout, publish, screenOf, visible, FOE, ALLY, HERO, HORSE, ROW_LIFT, ROW_SC };
})();
if (typeof module !== "undefined") module.exports = FIGHTPOS;
