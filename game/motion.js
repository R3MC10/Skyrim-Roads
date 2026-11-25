/* Motion: the movement of the interface. Menus slide in from the side you opened them, lists ripple in,
   buttons give under your thumb, tab underlines glide, gold and level count up, the XP bar fills with a
   shimmer, a constellation lights up for a big reward (rewards.js), things you buy or make fly to your pack, toasts bounce in,
   popups pop over a soft blur, pins drop on the map, the route draws itself, fog wipes away from new places,
   and the title breathes with mist and embers. (Arriving somewhere shows the place full screen: locintro.js.)
   Rules: only transform and opacity move (so phones stay at 60 fps), everything is decoration that never blocks
   taps, and it all switches off with the system's reduced-motion setting or Settings → Look → Motion.
   Under browser automation it stays off unless

   the URL has ?motion, so UI tests stay stable. [OURS] */
const MOTION = (() => {
  const DOM = typeof document !== "undefined" && typeof window !== "undefined";
  const params = () => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } };
  const sysReduce = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  const automated = () => DOM && typeof navigator !== "undefined" && navigator.webdriver && !params().has("motion");
  const KEY = "rotn_motion";
  let pref = "full";
  try { const v = DOM && localStorage.getItem(KEY); if (v === "lite" || v === "off" || v === "full") pref = v; } catch { /* storage blocked */ }

  // ---- tokens
  const DUR = { xs: 110, sm: 170, md: 260, lg: 420, xl: 700 };
  const EASE = { out: "cubic-bezier(.2,.8,.2,1)", inOut: "cubic-bezier(.65,0,.35,1)", back: "cubic-bezier(.34,1.56,.64,1)", in: "cubic-bezier(.4,0,1,1)" };
  const ease = {
    linear: (t) => t,
    out: (t) => 1 - Math.pow(1 - t, 3),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  /* a damped spring from 0 to 1 (overshoots a little, settles by t = 1) */
  const spring = (t, k = 7, z = 0.42) => (t >= 1 ? 1 : 1 - Math.exp(-z * k * t * 2.2) * Math.cos(k * t * 2.2 * Math.sqrt(1 - z * z)));

  const on = () => DOM && !sysReduce() && !automated() && pref !== "off";
  const lite = () => pref === "lite";
  function apply() {
    if (!DOM) return;
    const h = document.documentElement;
    h.classList.toggle("mo-on", on());
    h.classList.toggle("mo-lite", on() && lite());
  }
  function setPref(v) {
    pref = v === "off" || v === "lite" ? v : "full";
    try { localStorage.setItem(KEY, pref); } catch { /* fine */ }
    apply();
  }

  /* run fn(p) every frame for ms, p = eased 0→1; returns a cancel function */
  function tween(ms, fn, e = ease.out, done) {
    if (!on()) { fn(1); done?.(); return () => {}; }
    const t0 = performance.now(); let id = 0, dead = false;
    const step = (now) => {
      if (dead) return;
      const t = Math.min(1, (now - t0) / ms);
      fn(e(t));
      if (t < 1) id = requestAnimationFrame(step); else done?.();
    };
    id = requestAnimationFrame(step);
    return () => { dead = true; cancelAnimationFrame(id); };
  }
  const restart = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  // ---- numbers that count up (gold, level)
  function count(el, value, suffix = "", opts = {}) {
    if (!el) return;
    const v = Math.round(Number(value) || 0);
    if (el._moTarget === v && el.textContent !== "") return;
    const from = el._moShown;
    el._moTarget = v;
    if (from == null || !on() || from === v || Math.abs(v - from) > 1e6) { el._moShown = v; el.textContent = `${v}${suffix}`; return; }
    el._moCancel?.();
    const ms = Math.min(900, 380 + Math.log10(Math.abs(v - from) + 1) * 160);
    if (opts.pop !== false) restart(el, v > from ? "mo-up" : "mo-down");
    el._moCancel = tween(ms, (p) => { const n = Math.round(from + (v - from) * p); el._moShown = n; el.textContent = `${n}${suffix}`; }, ease.out);
  }

  // ---- the character XP bar under the top bar
  let xpLast = null;
  function xp(top, frac, level) {
    if (!top) return;
    let bar = top.querySelector("#moxp");
    if (!bar) { bar = document.createElement("i"); bar.id = "moxp"; bar.setAttribute("aria-hidden", "true"); bar.innerHTML = "<b></b><s></s>"; top.appendChild(bar); }
    const f = Math.max(0, Math.min(1, frac || 0)), key = `${level}:${f.toFixed(3)}`;
    if (key === bar._k) return; bar._k = key;
    const fill = bar.firstChild;
    if (xpLast && on() && (level > xpLast.level || f > xpLast.f + 0.0005)) {
      if (level > xpLast.level) {   // fill to the end, then start the new level from empty
        fill.style.transform = "scaleX(1)";
        setTimeout(() => { fill.style.transition = "none"; fill.style.transform = "scaleX(0)"; void fill.offsetWidth; fill.style.transition = ""; fill.style.transform = `scaleX(${f})`; }, 520);
      } else fill.style.transform = `scaleX(${f})`;
      restart(bar, "mo-shine");
    } else fill.style.transform = `scaleX(${f})`;
    bar.title = `Level ${level}: ${Math.round(f * 100)}% to the next level`;
    xpLast = { level, f };
  }

  // ---- a sliding underline for a row of tabs (FLIP from where it was)
  function underline(row, selector = ".on", key = "default") {
    if (!row) return;
    const act = row.querySelector(selector); if (!act) return;
    let u = row.querySelector(":scope > .mo-uline");
    if (!u) { u = document.createElement("i"); u.className = "mo-uline"; u.setAttribute("aria-hidden", "true"); row.appendChild(u); if (getComputedStyle(row).position === "static") row.style.position = "relative"; }
    const x = act.offsetLeft, w = act.offsetWidth;
    const prev = underline.mem[key];
    const put = (px, pw) => { u.style.transform = `translateX(${px}px) scaleX(${pw / 100})`; };
    if (prev && on() && (prev.x !== x || prev.w !== w)) { u.style.transition = "none"; put(prev.x, prev.w); void u.offsetWidth; u.style.transition = ""; }
    put(x, w);
    underline.mem[key] = { x, w };
  }
  underline.mem = {};
  function tabs(row) { if (row && on()) underline(row, ".tab.on", "tabs"); }

  // ---- list items ripple in
  function stagger(root, selector = ".item, h3, .card, .trip, .grid2, .setrow, .list > *", max = 14) {
    if (!root || !on()) return;
    const kids = [...root.querySelectorAll(selector)].slice(0, lite() ? 6 : max);
    kids.forEach((k, i) => { k.style.setProperty("--mo-i", i); k.classList.remove("mo-st"); });
    void root.offsetWidth;
    kids.forEach((k) => k.classList.add("mo-st"));
    setTimeout(() => kids.forEach((k) => k.classList.remove("mo-st")), 700 + kids.length * 40);
  }

  // ---- the full-screen menu (Items / Magic / Skills): enter from the side, page slides, category ripples
  const PAGE_FROM = { items: "r", magic: "l", skills: "t", map: "b", character: "t" };
  const PAGE_ORDER = ["items", "magic", "skills"];
  let menuState = null;
  function menu(el, page, cat) {
    if (!el) return;
    const prev = el._mo;
    el._mo = { page, cat };
    const pages = el.querySelector(".sky-pages"), cats = el.querySelector(".sky-cats");
    if (pages) underline(pages, ".sky-page.on", "skypages");
    if (cats) underline(cats, ".sky-cat.on", "skycats:" + page);
    if (!on()) return;
    if (!prev) { el.classList.add("mo-enter", `mo-from-${PAGE_FROM[page] || "r"}`); setTimeout(() => el.classList.remove("mo-enter", "mo-from-l", "mo-from-r", "mo-from-t", "mo-from-b"), 520); stagger(el.querySelector(".sky-list"), ".sky-row, .sky-doll, .sky-skill, .sky-spell", 12); return; }
    if (prev.page !== page) {
      const dir = PAGE_ORDER.indexOf(page) >= PAGE_ORDER.indexOf(prev.page) ? "r" : "l";
      const body = [el.querySelector(".sky-title"), el.querySelector(".sky-head"), el.querySelector(".sky-list")].filter(Boolean);
      body.forEach((b) => { b.classList.add(`mo-page-${dir}`); setTimeout(() => b.classList.remove(`mo-page-${dir}`), 420); });
      stagger(el.querySelector(".sky-list"), ".sky-row, .sky-doll, .sky-skill, .sky-spell", 12);
    } else if (prev.cat !== cat) stagger(el.querySelector(".sky-list"), ".sky-row, .sky-doll, .sky-skill, .sky-spell", 12);
    menuState = { page, cat };
  }
  /* a panel (tab page) swapped in: ripple its rows */
  function panel(el) { stagger(el); }

  // ---- things you get fly into your pack
  const FLY_ACTS = /^(buy|buyn|mbuy|cvbuy|evbuy|smake|srefine|srefineall|brew|cook|harvest|mine|grab|gtake|halltake|festclaim|giftopen|unstash|enchant|bclaim|craftgo)$/;
  const FAIL = /can['’]t|cannot|not enough|too heavy|too far|need|no room|isn['’]t|aren['’]t|nothing|closed|first|fail|won['’]t|only|already/i;
  let pendingFly = null;
  function onTap(e) {
    const b = e.target.closest?.("button");
    if (!b || b.disabled) return;
    if (on()) { restart(b, "mo-press"); setTimeout(() => b.classList.remove("mo-press"), 460); }
    const act = b.dataset.act;
    if (!act || !FLY_ACTS.test(act) || !on()) return;
    const row = b.closest(".item, .sky-row, .card, .sheet") || b.parentElement;
    const icon = row && row.querySelector("img, canvas, svg.ic, .art");
    const r = (icon || b).getBoundingClientRect();
    pendingFly = { at: performance.now(), r, src: icon && icon.tagName === "IMG" ? icon.src : null };
  }
  function packTarget() {
    const t = document.querySelector('#tabs [data-tab="pack"]') || document.querySelector("#tabs") || null;
    if (t) { const r = t.getBoundingClientRect(); if (r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    return { x: innerWidth - 40, y: innerHeight - 40 };
  }
  function fly(fromRect, src) {
    if (!on() || !fromRect || !fromRect.width) return;
    const el = document.createElement(src ? "img" : "i");
    el.className = "mo-fly"; el.setAttribute("aria-hidden", "true");
    if (src) el.src = src;
    const z = typeof FITCANVAS !== "undefined" ? FITCANVAS.zoom() : 1;   // zoomed page (PC, bigger text): screen px → page px
    const t0 = packTarget(), x0 = (fromRect.left + fromRect.width / 2) / z, y0 = (fromRect.top + fromRect.height / 2) / z, to = { x: t0.x / z, y: t0.y / z };
    el.style.left = `${x0 - 14}px`; el.style.top = `${y0 - 14}px`;
    document.body.appendChild(el);
    const dx = to.x - x0, dy = to.y - y0, lift = Math.min(160, Math.abs(dx) * 0.4 + 60);
    tween(lite() ? 420 : 640, (p) => {
      const x = dx * p, y = dy * p - Math.sin(p * Math.PI) * lift, s = 1 + Math.sin(p * Math.PI) * 0.35 - p * 0.55;
      el.style.transform = `translate(${x}px,${y}px) scale(${s})`; el.style.opacity = String(p > 0.85 ? (1 - p) / 0.15 : 1);
    }, ease.inOut, () => {
      el.remove();
      const t = document.querySelector('#tabs [data-tab="pack"]'); if (t) restart(t, "mo-catch");
    });
  }
  function onToast(text) {
    if (!pendingFly) return;
    const f = pendingFly; pendingFly = null;
    if (performance.now() - f.at > 700 || FAIL.test(String(text || ""))) return;
    fly(f.r, f.src);
  }

  // ---- level up: a constellation lights star by star
  function constellation() {
    if (!on()) return;
    const W = Math.min(innerWidth, 420), H = 220, n = lite() ? 6 : 9;
    let seed = Date.now() % 997;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const pts = []; for (let i = 0; i < n; i++) pts.push([30 + (i / (n - 1)) * (W - 60) + (rnd() - 0.5) * 30, 40 + rnd() * (H - 80)]);
    const lines = pts.slice(1).map((p, i) => { const a = pts[i], len = Math.hypot(p[0] - a[0], p[1] - a[1]); return `<line x1="${a[0]}" y1="${a[1]}" x2="${p[0]}" y2="${p[1]}" style="--len:${len.toFixed(0)};--d:${(i * 0.11).toFixed(2)}s"/>`; }).join("");
    const stars = pts.map((p, i) => `<g transform="translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})"><circle r="${i % 3 ? 2.4 : 3.6}" style="--d:${(i * 0.11).toFixed(2)}s"/></g>`).join("");
    const el = document.createElement("div"); el.className = "mo-const"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${lines}${stars}</svg>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ---- the map: route drawing, pin drops, fog wiping off new places
  const routeSeen = new Map(), pinSeen = new Map(), lifts = [];
  let mapPrimedAt = 0, lastDisc = null;
  function routeT(key) {
    if (!key) return 1;
    if (!routeSeen.has(key)) { if (routeSeen.size > 30) routeSeen.clear(); routeSeen.set(key, performance.now()); }
    if (!on()) return 1;
    const t = (performance.now() - routeSeen.get(key)) / (lite() ? 450 : 800);
    return t >= 1 ? 1 : ease.inOut(t);
  }
  /* cut a polyline down to the first fraction t of its length */
  function cutPath(pts, t) {
    if (t >= 1 || pts.length < 2) return pts;
    let total = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
    let left = total * Math.max(0, t); const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (left >= seg[i - 1]) { out.push(pts[i]); left -= seg[i - 1]; continue; }
      const k = seg[i - 1] ? left / seg[i - 1] : 0; out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]); break;
    }
    return out;
  }
  /* offset (in pin heights) and scale for a pin that just appeared */
  function pinDrop(key) {
    const now = performance.now();
    if (!mapPrimedAt) mapPrimedAt = now;
    if (!pinSeen.has(key)) pinSeen.set(key, now - mapPrimedAt < 400 ? -1e9 : now);
    if (!on()) return { dy: 0, sc: 1 };
    const t = (now - pinSeen.get(key)) / 650;
    if (t >= 1) return { dy: 0, sc: 1 };
    const s = spring(t);
    return { dy: -(1 - s) * 2.4, sc: 0.6 + 0.4 * Math.min(1, s) };
  }
  function trackDiscoveries(list) {
    if (!mapPrimedAt) mapPrimedAt = performance.now();
    const n = list?.length || 0;
    if (lastDisc != null && n > lastDisc && n - lastDisc <= 6 && on()) for (const name of list.slice(lastDisc)) lifts.push({ name, at: performance.now() });
    lastDisc = n;
  }
  /* draw dark fog rings opening outward around freshly discovered places */
  function fogLift(g, s, W, H) {
    if (!lifts.length || typeof WORLD === "undefined") return;
    const now = performance.now();
    for (let i = lifts.length - 1; i >= 0; i--) {
      const L = lifts[i], age = (now - L.at) / 1400, p = WORLD.places[L.name];
      if (age >= 1 || !p || !on()) { lifts.splice(i, 1); continue; }
      const x = p[0] * W, y = p[1] * H, R = 70 * s, hole = R * ease.out(age);
      const gr = g.createRadialGradient(x, y, Math.max(0.1, hole), x, y, R);
      gr.addColorStop(0, `rgba(18,20,24,${0.85 * (1 - age)})`); gr.addColorStop(1, "rgba(18,20,24,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
    }
  }
  const mapBusy = () => on() && (lifts.length > 0 || [...routeSeen.values()].some((t) => performance.now() - t < 900) || [...pinSeen.values()].some((t) => performance.now() - t < 700));

  // ---- title: drifting mist and embers with a little parallax
  function titleAmbient(title) {
    if (!title || title.querySelector(".mo-amb") || !on()) return;
    const amb = document.createElement("div"); amb.className = "mo-amb"; amb.setAttribute("aria-hidden", "true");
    const n = lite() ? 6 : 14;
    let em = "";
    for (let i = 0; i < n; i++) em += `<span style="left:${(5 + (i * 37) % 90)}%;--d:${(i * 0.73) % 6}s;--t:${6 + (i % 5)}s;--x:${(i % 2 ? 1 : -1) * (10 + (i % 4) * 8)}px"></span>`;
    amb.innerHTML = `<i class="mist m1"></i><i class="mist m2"></i><div class="emb">${em}</div>`;
    const anim = title.querySelector("#tanim");
    if (anim && anim.nextSibling) title.insertBefore(amb, anim.nextSibling); else title.insertBefore(amb, title.firstChild);
    let raf = 0, tx = 0, ty = 0;
    const move = (e) => {
      const pt = e.touches ? e.touches[0] : e; if (!pt) return;
      tx = (pt.clientX / innerWidth - 0.5) * 2; ty = (pt.clientY / innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; amb.style.setProperty("--px", tx.toFixed(3)); amb.style.setProperty("--py", ty.toFixed(3)); });
    };
    title.addEventListener("pointermove", move, { passive: true });
  }

  // ---- popups, the menu and loading cards leave with a short fade instead of vanishing
  const GHOST = new Set(["modal", "sky", "loadcard"]);
  function ghost(node) {
    if (!on() || !node || node.nodeType !== 1 || node.classList.contains("mo-ghost")) return;
    node.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    node.id = ""; node.setAttribute("aria-hidden", "true"); node.classList.add("mo-ghost"); node.style.pointerEvents = "none";
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 240);
  }
  let lastModalGone = 0;
  function watch() {
    if (!DOM || !window.MutationObserver) return;
    new MutationObserver((recs) => {
      const added = new Set(), removed = [];
      for (const r of recs) {
        r.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.id) added.add(n.id); if (n.nodeType === 1 && n.id === "modal") onModal(n); if (n.nodeType === 1 && n.id === "title") titleAmbient(n); });
        r.removedNodes.forEach((n) => { if (n.nodeType === 1 && GHOST.has(n.id)) removed.push(n); });
      }
      for (const n of removed) { if (n.id === "modal") lastModalGone = performance.now(); if (!added.has(n.id)) ghost(n); }
    }).observe(document.body, { childList: true });
  }
  function onModal(m) {
    if (!on()) return;
    const swap = performance.now() - lastModalGone < 280;
    m.classList.add(swap ? "mo-swap" : "mo-pop");
    setTimeout(() => m.classList.remove("mo-swap", "mo-pop"), 520);
  }

  // ---- hook the decorations polish.js already owns
  function wrapPolish() {
    if (typeof POLISH === "undefined" || POLISH._mo) return;
    POLISH._mo = true;
    const t = POLISH.toast;
    POLISH.toast = (el, text) => { t(el, text); onToast(text); };
  }
  /* rewards.js: a big reward scene lights the constellation and bumps the level badge (nothing with motion off) */
  function celebrate() {
    if (!on()) return null;
    constellation();
    const lb = document.getElementById("lvlb"); if (lb) restart(lb, "mo-lvl");
    return document.querySelector("body > .mo-const:last-of-type");
  }

  function init() {
    if (!DOM) return;
    apply();
    try { matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", apply); } catch { /* old browsers */ }
    document.addEventListener("pointerdown", onTap, { capture: true, passive: true });
    watch();
    const t = document.getElementById("title"); if (t) titleAmbient(t);
    wrapPolish();
  }
  if (DOM) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else setTimeout(init, 0); }

  return { DUR, EASE, ease, spring, tween, on, lite, pref: () => pref, setPref, apply, count, xp, underline, tabs, stagger, menu, panel, fly, constellation, celebrate,
    routeT, cutPath, pinDrop, trackDiscoveries, fogLift, mapBusy, titleAmbient, _onToast: onToast };
})();
if (typeof module !== "undefined") module.exports = MOTION;
