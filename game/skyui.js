/* SkyUI touches that need a little script: the perk constellation above each skill's perk list (like Skyrim's
   skill trees: stars joined by lines, growing upward; lit stars are perks you have, bright-outlined ones you can
   take now). Tapping a star brings its perk row into view. Nothing here changes game state. [OURS]
   Layout (perklayout): every perk sits one tier above the highest perk it needs (roots at the bottom); each tier is
   ordered by an 8-pass barycenter sort (ties keep tree order, so it never jitters), then every label is wrapped to
   at most 2 lines and placed below, above, right or left of its star where it hits no other label or star. If a
   label fits nowhere the whole graph is drawn wider and tried again. Works for any tree, new perks included.
   The sky is drawn at real pixel size inside a scrolling box: pinch (or Ctrl + wheel) zooms 0.5x to 2x, a finger
   pans; below 0.85x only the perks you can take (and the one picked) keep their names. */
const SKYUI = (() => {
  function seeded(str) { let a = 0; for (const ch of str) a = (a * 31 + ch.charCodeAt(0)) | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const esc = (s) => String(s).replace(/[<>&"]/g, "");
  const hasDoc = typeof document !== "undefined" && typeof document.createElement === "function";
  const wideScreen = () => { try { return typeof innerWidth === "number" && innerWidth >= 900; } catch { return false; } };
  // phone 120x96 grid, 12px labels up to 104px wide; PC 150x100, 15px labels up to 130px
  // cols: a tier with more perks than this is split into stacked lines (offset half a step), so the sky stays narrow
  const MODES = { phone: { sx: 120, sy: 96, fs: 12, mw: 104, cols: 3 }, pc: { sx: 150, sy: 100, fs: 15, mw: 130, cols: 4 } };
  const STAR_R = 9, GAP = 4, LS = 0.08;   // star keep-out radius, space around labels, letter-spacing (em, as in the CSS)

  // ---- text width: the real font when a canvas is there, else a safe guess (Barlow Condensed is narrow)
  let cv = null;
  function textW(s, fs) {
    if (hasDoc) try {
      cv = cv || document.createElement("canvas").getContext("2d");
      if (cv) { cv.font = `500 ${fs}px "Barlow Condensed","Barlow Semi Condensed",system-ui,sans-serif`; const w = cv.measureText(s).width; if (w > 0) return Math.ceil(w + s.length * LS * fs + 2); }
    } catch { /* no canvas: guess */ }
    let w = 0; for (const ch of s) w += /[MW@]/.test(ch) ? 0.78 : /[A-Z0-9]/.test(ch) ? 0.56 : /[ijlI.,'!:|]/.test(ch) ? 0.26 : ch === " " ? 0.24 : 0.48;
    return Math.ceil((w + s.length * LS) * fs + 2);
  }
  // one line if it fits, else the 2-line split with the shortest longest line (never a third line, never "…")
  function wrap(text, fs, mw) {
    const one = textW(text, fs); if (one <= mw) return { lines: [text], w: one };
    const ws = text.split(" "); if (ws.length < 2) return { lines: [text], w: one };
    let best = null;
    for (let i = 1; i < ws.length; i++) {
      const a = ws.slice(0, i).join(" "), b = ws.slice(i).join(" "), w = Math.max(textW(a, fs), textW(b, fs));
      if (!best || w < best.w) best = { lines: [a, b], w };
    }
    return best;
  }
  const labelText = (p) => p[1] + (p[2] > 1 ? ` 0/${p[2]}` : "");

  // ---- tiers + barycenter order
  function tiers(tree, cols) {
    const byId = Object.fromEntries(tree.map((p) => [p[0], p])), tier = {};
    const t = (id, seen = new Set()) => {
      if (tier[id] != null) return tier[id];
      if (seen.has(id)) return 0; seen.add(id);
      const needs = (byId[id]?.[4] || []).filter((n) => byId[n] && n !== id);
      return (tier[id] = needs.length ? 1 + Math.max(...needs.map((n) => t(n, seen))) : 0);
    };
    tree.forEach((p) => t(p[0]));
    const rows = []; tree.forEach((p) => (rows[tier[p[0]]] = rows[tier[p[0]]] || []).push(p[0]));
    for (let i = 0; i < rows.length; i++) rows[i] = rows[i] || [];
    const parents = {}, kids = {};
    tree.forEach((p) => { parents[p[0]] = (p[4] || []).filter((n) => byId[n] && n !== p[0]); parents[p[0]].forEach((n) => (kids[n] = kids[n] || []).push(p[0])); });
    const idx = {}; const reindex = () => rows.forEach((r) => r.forEach((id, i) => (idx[id] = i - (r.length - 1) / 2)));
    reindex();
    const bary = (ids, nb) => { const o = {}; ids.forEach((id, i) => { const n = (nb[id] || []).filter((x) => idx[x] != null); o[id] = n.length ? n.reduce((a, x) => a + idx[x], 0) / n.length : i - (ids.length - 1) / 2; }); return o; };
    for (let pass = 0; pass < 8; pass++) {
      const up = pass % 2 === 0;
      const order = up ? rows.map((_, i) => i).slice(1) : rows.map((_, i) => i).slice(0, -1).reverse();
      for (const k of order) {
        const r = rows[k], b = bary(r, up ? parents : kids), pos = Object.fromEntries(r.map((id, i) => [id, i]));
        r.sort((a, c) => b[a] - b[c] || pos[a] - pos[c]);   // stable: ties keep the previous order
        reindex();
      }
    }
    const lines = [], line = {};   // a wide tier becomes several lines, bottom one first
    rows.forEach((r) => { for (let i = 0, j = 0; i < r.length; i += cols, j++) { const ids = r.slice(i, i + cols); ids.forEach((id) => (line[id] = lines.length)); lines.push({ ids, odd: j % 2 === 1 }); } });
    return { rows, lines, line, parents, kids, byId, tier, cols };
  }

  // ---- stars on the grid: each tier is pulled toward its parents, at least sx apart
  function placeStars(T, sx, sy) {
    const x = {};
    T.lines.forEach(({ ids: r, odd }, k) => {
      const want = r.map((id, i) => { const ps = T.parents[id].filter((n) => x[n] != null); return (ps.length ? ps.reduce((a, n) => a + x[n], 0) / ps.length : (i - (r.length - 1) / 2) * sx) + (odd ? sx / 2 : 0); });
      const got = want.slice();
      for (let i = 1; i < got.length; i++) got[i] = Math.max(got[i], got[i - 1] + sx);
      const shift = got.reduce((a, g, i) => a + (want[i] - g), 0) / (got.length || 1);   // the row as a block, centred on where it wants to be
      // ...but never wider than a full line of cols stars, so the sky fits the screen
      const lim = (T.cols - 1) / 2 * sx, lo = got[0] + shift, hi = got[got.length - 1] + shift;
      const fix = hi - lo > 2 * lim ? -(lo + hi) / 2 : lo < -lim ? -lim - lo : hi > lim ? lim - hi : 0;
      r.forEach((id, i) => (x[id] = got[i] + shift + fix));
      // only the roots are free: keep the bottom row centred on 0
      if (k === 0) { const m = (x[r[0]] + x[r[r.length - 1]]) / 2; r.forEach((id) => (x[id] -= m)); }
    });
    const y = {}; T.lines.forEach(({ ids }, k) => ids.forEach((id) => (y[id] = -k * sy)));
    return { x, y };
  }

  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  // ---- the whole layout. opt.mode "phone" | "pc" (default: by screen width)
  function layout(tree, opt = {}) {
    const M = MODES[opt.mode || (wideScreen() ? "pc" : "phone")], lh = Math.round(M.fs * 1.2);
    const T = tiers(tree, M.cols), info = {};
    tree.forEach((p) => { const w = wrap(labelText(p), M.fs, M.mw); info[p[0]] = { lines: w.lines, w: w.w + 2 * GAP, h: w.lines.length * lh + 2 * GAP }; });
    let sx = M.sx, sy = M.sy, res = null;
    for (let tryN = 0; tryN < 10 && !res; tryN++) {
      const { x, y } = placeStars(T, sx, sy), boxes = [], lab = {};
      const stars = tree.map((p) => ({ x: x[p[0]] - STAR_R, y: y[p[0]] - STAR_R, w: 2 * STAR_R, h: 2 * STAR_R }));
      // bottom tier first, left to right
      const order = tree.map((p) => p[0]).sort((a, b) => T.line[a] - T.line[b] || x[a] - x[b]);
      let failed = false;
      for (const id of order) {
        const L = info[id], cx = x[id], cy = y[id], d = STAR_R + 1;
        const cand = [
          { at: "below", x: cx - L.w / 2, y: cy + d },
          { at: "above", x: cx - L.w / 2, y: cy - d - L.h },
          { at: "right", x: cx + d, y: cy - L.h / 2 },
          { at: "left", x: cx - d - L.w, y: cy - L.h / 2 },
        ];
        const ok = cand.find((c) => { const b = { x: c.x, y: c.y, w: L.w, h: L.h }; return !boxes.some((o) => hit(b, o)) && !stars.some((s) => hit(b, s)); });
        if (!ok) { failed = true; break; }
        const b = { x: ok.x, y: ok.y, w: L.w, h: L.h }; boxes.push(b); lab[id] = { ...b, at: ok.at, lines: L.lines };
      }
      if (failed && tryN < 9) { sx = Math.round(sx * 1.15); sy = Math.round(sy * 1.06); continue; }
      if (failed) {   // still nothing after many tries: below, whatever happens (the tests catch this)
        for (const id of order) if (!lab[id]) { const L = info[id]; lab[id] = { x: x[id] - L.w / 2, y: y[id] + STAR_R + 1, w: L.w, h: L.h, at: "below", lines: L.lines }; }
      }
      res = { x, y, lab, sx, sy };
    }
    // bounds: every star and label, plus a margin; then move it all so the top left is (0,0)
    const PAD = 10; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (b) => { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); };
    tree.forEach((p) => { grow({ x: res.x[p[0]] - STAR_R, y: res.y[p[0]] - STAR_R, w: 2 * STAR_R, h: 2 * STAR_R }); grow(res.lab[p[0]]); });
    const dx = PAD - x0, dy = PAD - y0, pos = {}, labels = {};
    tree.forEach((p) => {
      const id = p[0], b = res.lab[id];
      pos[id] = [Math.round(res.x[id] + dx), Math.round(res.y[id] + dy), 1];
      labels[id] = { x: Math.round(b.x + dx), y: Math.round(b.y + dy), w: Math.round(b.w), h: Math.round(b.h), at: b.at, lines: b.lines };
    });
    return { pos, labels, W: Math.ceil(x1 - x0 + 2 * PAD), H: Math.ceil(y1 - y0 + 2 * PAD), byId: T.byId, fs: M.fs, lh, mode: opt.mode || (wideScreen() ? "pc" : "phone"), sx: res.sx, sy: res.sy };
  }

  // ---- drawing. opt.sel: index of the picked perk; opt.mode as in layout
  function svg(skill, s, opt = {}) {
    const tree = (typeof PERKS !== "undefined" && PERKS.TREES[skill]) || opt.tree; if (!tree || !tree.length) return "";
    const L = layout(tree, opt), { pos, labels, W, H } = L, r = seeded(skill), phone = L.mode === "phone";
    let bg = ""; const nBg = Math.min(160, Math.round((W * H) / 2800));
    for (let i = 0; i < nBg; i++) bg += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * H).toFixed(1)}" r="${(0.4 + r() * 0.9).toFixed(2)}" fill="#cfd8ea" opacity="${(0.25 + r() * 0.5).toFixed(2)}" ${r() < 0.3 ? 'class="twinkle"' : ""}/>`;
    let lines = "";
    for (const p of tree) for (const n of p[4] || []) if (pos[n] && n !== p[0]) { const on = PERKS.rank(s, p[0]) > 0 && PERKS.rank(s, n) > 0; lines += `<line x1="${pos[n][0]}" y1="${pos[n][1]}" x2="${pos[p[0]][0]}" y2="${pos[p[0]][1]}" class="${on ? "on" : ""}"/>`; }
    let stars = "";
    tree.forEach((p, i) => {
      const [x, y] = pos[p[0]], rk = PERKS.rank(s, p[0]), can = !PERKS.canTake(s, p[0]) && rk < p[2], lb = labels[p[0]];
      const text = lb.lines.slice();   // laid out with "0/N"; the real rank has the same digits' width
      if (p[2] > 1) text[text.length - 1] = text[text.length - 1].replace(/(^| )0\/(\d+)$/, `$1${rk}/$2`);
      const anchor = lb.at === "right" ? "start" : lb.at === "left" ? "end" : "middle";
      const tx = lb.at === "right" ? lb.x + GAP : lb.at === "left" ? lb.x + lb.w - GAP : lb.x + lb.w / 2;
      const ty0 = lb.y + GAP + L.fs * 0.95;
      const tsp = text.map((t, k) => `<tspan x="${Math.round(tx)}" y="${Math.round(ty0 + k * L.lh)}">${esc(t)}</tspan>`).join("");
      const tip = phone ? "" : ` data-tip-k="perk:${esc(p[0])}"`;   // no floating tooltip over the stars on a phone: the panel below says it
      stars += `<g class="st ${rk ? "on" : ""} ${can ? "can" : ""} ${opt.sel === i ? "sel" : ""}" data-sk-perk="${i}"${tip} role="button" tabindex="0" aria-label="${esc(p[1])}${rk ? " (taken)" : can ? " (can take)" : ""}">
        <circle class="glow" cx="${x}" cy="${y}" r="14"/><circle cx="${x}" cy="${y}" r="18" fill="transparent"/>
        <circle class="core" cx="${x}" cy="${y}" r="${rk ? 4.2 : 3.2}"/>${can ? `<circle cx="${x}" cy="${y}" r="7.5" fill="none" stroke="#cfe3ff" stroke-width="1" stroke-dasharray="2 2"/>` : ""}${opt.sel === i ? `<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="#ffe7a8" stroke-width="1.5"/>` : ""}
        <text class="lbl" text-anchor="${anchor}">${tsp}</text></g>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-w="${W}" data-h="${H}" data-sky="${esc(skill)}" data-mode="${L.mode}" style="--skfs:${L.fs}px" aria-label="${esc(skill)} perk stars"><defs><radialGradient id="skglow"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".4" stop-color="#bcd6ff" stop-opacity=".35"/><stop offset="1" stop-color="#bcd6ff" stop-opacity="0"/></radialGradient></defs>${bg}${lines}${stars}</svg>`;
  }

  // ---- zoom + pan: the .skc box scrolls, the svg is sized W*z by H*z. Zoom and scroll are kept per sky across redraws.
  const ZMIN = 0.5, ZMAX = 2, FAR = 0.85, view = {};
  function setZoom(box, z, cx, cy) {
    const el = box.querySelector("svg[data-w]"); if (!el) return;
    const k = el.dataset.sky + "|" + el.dataset.mode, v = view[k] = view[k] || {};
    const old = v.z || 1; z = Math.max(ZMIN, Math.min(ZMAX, z)); v.z = z;
    const W = +el.dataset.w, H = +el.dataset.h;
    // keep the point under the fingers where it was
    const fx = cx == null ? box.clientWidth / 2 : cx, fy = cy == null ? box.clientHeight / 2 : cy;
    const ax = (box.scrollLeft + fx) / old, ay = (box.scrollTop + fy) / old;
    el.style.width = Math.round(W * z) + "px"; el.style.height = Math.round(H * z) + "px";
    box.classList.toggle("far", el.dataset.mode === "phone" && z < FAR);   // a PC has room: names always show
    box.scrollLeft = ax * z - fx; box.scrollTop = ay * z - fy;
    v.sl = box.scrollLeft; v.st = box.scrollTop;
  }
  function fit(root) {
    for (const box of (root || document).querySelectorAll(".skc")) {
      const el = box.querySelector(":scope>svg[data-w]"); if (!el || el.dataset.fit) continue;
      el.dataset.fit = "1"; box.classList.add("skv");
      const k = el.dataset.sky + "|" + el.dataset.mode, v = view[k], W = +el.dataset.w, H = +el.dataset.h;
      if (v && v.z) {
        el.style.width = Math.round(W * v.z) + "px"; el.style.height = Math.round(H * v.z) + "px"; box.classList.toggle("far", el.dataset.mode === "phone" && v.z < FAR);
        box.scrollLeft = v.sl || 0; box.scrollTop = v.st || 0;
      } else {
        // first look: as big as fits (never past 1x, never so small the names hide), roots (bottom) in view
        const cw = box.clientWidth || W, ch = el.dataset.mode === "pc" && box.clientHeight > 80 ? box.clientHeight : Infinity;
        const z = Math.max(el.dataset.mode === "pc" ? 0.6 : FAR, Math.min(1, cw / W, ch / H));
        view[k] = { z };
        el.style.width = Math.round(W * z) + "px"; el.style.height = Math.round(H * z) + "px";
        box.scrollLeft = Math.max(0, (W * z - cw) / 2); box.scrollTop = H * z;
        view[k].sl = box.scrollLeft; view[k].st = box.scrollTop;
      }
      if (!box.dataset.zoomable) wire(box);
    }
  }
  function wire(box) {
    box.dataset.zoomable = "1";
    const key = () => { const el = box.querySelector("svg[data-w]"); return el ? el.dataset.sky + "|" + el.dataset.mode : ""; };
    box.addEventListener("scroll", () => { const v = view[key()]; if (v) { v.sl = box.scrollLeft; v.st = box.scrollTop; } }, { passive: true });
    let pinch = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    box.addEventListener("touchstart", (e) => { if (e.touches.length === 2) { const r = box.getBoundingClientRect(); pinch = { d: dist(e.touches), z: view[key()]?.z || 1, cx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top }; } }, { passive: true });
    box.addEventListener("touchmove", (e) => { if (pinch && e.touches.length === 2) { e.preventDefault(); setZoom(box, pinch.z * dist(e.touches) / pinch.d, pinch.cx, pinch.cy); } }, { passive: false });
    box.addEventListener("touchend", (e) => { if (e.touches.length < 2) pinch = null; }, { passive: true });
    box.addEventListener("wheel", (e) => { if (!e.ctrlKey) return; e.preventDefault(); const r = box.getBoundingClientRect(); setZoom(box, (view[key()]?.z || 1) * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  }

  /* after each panel draw: put the stars above the perk list of the chosen skill */
  function decorate(root) {
    fit(root);
    const s = window.__dbg?.save?.(); if (!s || typeof PERKS === "undefined") return;
    const chip = root.querySelector('.chip.on[data-act="pskill"]'); if (!chip) return;
    const skill = chip.dataset.id, chips = chip.parentElement;
    if (chips.scrollWidth > chips.clientWidth && !chips.dataset.scrolled) { chips.scrollLeft = Math.max(0, chip.offsetLeft - chips.clientWidth / 2 + chip.offsetWidth / 2); chips.dataset.scrolled = "1"; }
    const key = skill + "|" + JSON.stringify((PERKS.TREES[skill] || []).map((p) => PERKS.rank(s, p[0]))) + "|" + (PERKS.pointsLeft?.(s) ?? "");
    const old = chips.nextElementSibling?.classList.contains("skc") ? chips.nextElementSibling : null;
    if (old && old.dataset.key === key) return;
    const div = document.createElement("div"); div.className = "skc"; div.dataset.key = key; div.innerHTML = svg(skill, s);
    if (old) old.replaceWith(div); else chips.after(div);
    fit(div.parentElement);
  }
  let pending = false;
  function init() {
    const side = document.getElementById("side"); if (!side || side.dataset.skyui) return;
    side.dataset.skyui = "1";
    new MutationObserver(() => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; try { decorate(side); } catch (e) { /* never break the game for decoration */ } }); }).observe(side, { childList: true, subtree: true });
    decorate(side);
  }
  const live = typeof document !== "undefined" && typeof document.addEventListener === "function" && typeof requestAnimationFrame === "function";
  if (live) document.addEventListener("click", (e) => {
    const st = e.target.closest?.("[data-sk-perk]"); if (!st) return;
    const box = st.closest(".skc"), list = box?.parentElement?.querySelector(".skc ~ .list") || box?.nextElementSibling;
    const row = list?.children?.[+st.dataset.skPerk]; if (!row) return;
    row.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    row.classList.remove("skflash"); void row.offsetWidth; row.classList.add("skflash");
  });
  const boot = () => { init(); if (!document.getElementById("side")) setTimeout(boot, 400); };
  if (live) {
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
    setInterval(() => { const side = document.getElementById("side"); if (side && !side.dataset.skyui) init(); }, 1000);
  }
  return { svg, layout, decorate, fit, setZoom, MODES };
})();
