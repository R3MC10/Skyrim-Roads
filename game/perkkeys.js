/* perkkeys.js: the Skills / perk stars page (tabmenu.js stars()) on a keyboard, like Skyrim. [OURS]
   Two levels:
   - skills: A/D (←/→) step through the skill tiles, W/S (↑/↓) go up/down the grid; the stars on the right follow
     the highlighted skill at once. E, Enter or Space (or W on the top row, D on the last tile) go into its stars.
   - stars: W A S D / arrows jump to the nearest star that way (stars joined by a line win ties, like Skyrim);
     the star's perk shows in the details box, E / Enter / Space takes it (same as the button). S with nothing
     below, A with nothing to the left, Tab, Esc or Backspace go back to the tiles. Esc on the tiles closes as before.
   The mouse keeps working: hover moves the ring, a click puts the keys where you clicked. A key-hint line shows
   on a PC (hidden on touch screens). Runs before the map's own W A S D (pcmap.js) and the tab letters (desktop.js). */
const PERKKEYS = (() => {
  const live = typeof document !== "undefined" && typeof document.getElementById === "function" && typeof addEventListener === "function";   // (node tests stub a bare document)
  const L = (en) => { try { if (typeof I18N !== "undefined" && I18N.lang() === "pl" && typeof I18N_EXTRA !== "undefined" && I18N_EXTRA.words[en]) return I18N_EXTRA.words[en]; } catch { /* English */ } return en; };
  const HINT = { skill: "A/D skill · W/S row · E stars · Tab menu", star: "WASD move · E take · Tab back" };
  const DIRS = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
  let mode = "skill", cardId = null, star = null, sky = null, moved = false;
  const $ = (s) => document.querySelector(s);
  const panel = () => { const p = $("#side .tw-starp"); return p && p.offsetParent !== null ? p : null; };
  const cards = (p) => [...p.querySelectorAll(".tw-car > button[data-id]")];
  const stars = (p) => [...p.querySelectorAll(".tw-big svg g.st[data-sk-perk]")];
  const xy = (g) => { const c = g.querySelector("circle.core"); return [+c.getAttribute("cx"), +c.getAttribute("cy")]; };
  const click = (el) => el && el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));

  /* is the page ours to steer right now? (not while typing, in a fight, a minigame, a popup, the compass or Items/Magic) */
  function active(e) {
    if (e && (e.ctrlKey || e.metaKey || e.altKey)) return null;
    const t = e && e.target, tag = (t && t.tagName) || "";
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || t?.isContentEditable) return null;
    if ($("#modal") || $("#tw") || $("#sky") || $("#title") || $("#nickbox") || $("#tbf") || $("#tbwatch")) return null;
    if ($("#lockpick, #pickgame, #dgame, #dgwatch, .lockpick, #pausem, #bugrep")) return null;
    return panel();
  }
  function curCard(p) {
    const cs = cards(p); if (!cs.length) return null;
    return cs.find((c) => c.dataset.id === cardId) || cs.find((c) => c.classList.contains("on")) || cs[0];
  }
  /* the ring: a class on the tile or star, and an extra circle round the star; redrawn after every panel draw */
  function paint() {
    const p = panel(); if (!p) return;
    p.querySelectorAll(".pkk-f").forEach((n) => n.classList.remove("pkk-f"));
    p.querySelectorAll("circle.pkk-ring").forEach((n) => n.remove());
    const sv = p.querySelector(".tw-big svg[data-sky]");
    if (mode === "star" && (!sv || sv.dataset.sky !== sky || !stars(p).length)) mode = "skill";
    p.dataset.pkk = mode;
    if (mode === "skill") { const c = curCard(p); if (c) { c.classList.add("pkk-f"); cardId = c.dataset.id; } }
    else {
      const g = stars(p)[star] || stars(p)[0];
      if (g) {
        g.classList.add("pkk-f"); const [x, y] = xy(g);
        const r = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        r.setAttribute("class", "pkk-ring"); r.setAttribute("cx", x); r.setAttribute("cy", y); r.setAttribute("r", "13");
        g.insertBefore(r, g.firstChild);
      }
    }
    let h = p.querySelector(".pkk-hint");
    if (!h) { h = document.createElement("div"); h.className = "pkk-hint"; h.setAttribute("aria-hidden", "true"); p.appendChild(h); }
    const txt = L(HINT[mode]); if (h.textContent !== txt) h.textContent = txt;
  }
  function show(el, box) {
    if (!el) return;
    if (!box) { try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch { /* old browser */ } return; }
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect(), m = 48;
    if (r.left < b.left + m) box.scrollLeft -= b.left + m - r.left; else if (r.right > b.right - m) box.scrollLeft += r.right - (b.right - m);
    if (r.top < b.top + m) box.scrollTop -= b.top + m - r.top; else if (r.bottom > b.bottom - m) box.scrollTop += r.bottom - (b.bottom - m);
  }
  const later = (f) => requestAnimationFrame(() => requestAnimationFrame(f));

  // ---- skill tiles
  function pickCard(c) {
    if (!c) return;
    cardId = c.dataset.id; mode = "skill";
    if (!c.classList.contains("on")) click(c);   // tabmenu.js redraws with this skill's stars
    later(() => { paint(); const p = panel(); show(p && curCard(p)); });
    try { SOUND.fx("click"); } catch { /* sound never breaks the game */ }
  }
  /* the tile above/below: the nearest one on the next row up/down (a phone's single row has none) */
  function rowStep(cs, c, dy) {
    const r = c.getBoundingClientRect(), cx = r.left + r.width / 2;
    const rows = cs.map((x) => x.getBoundingClientRect()).map((b, i) => ({ i, top: b.top, cx: b.left + b.width / 2 }))
      .filter((o) => (dy < 0 ? o.top < r.top - 4 : o.top > r.top + 4));
    if (!rows.length) return null;
    const near = dy < 0 ? Math.max(...rows.map((o) => o.top)) : Math.min(...rows.map((o) => o.top));
    const row = rows.filter((o) => Math.abs(o.top - near) < 6).sort((a, b) => Math.abs(a.cx - cx) - Math.abs(b.cx - cx));
    return cs[row[0].i];
  }
  function enter(p) {
    const ss = stars(p); if (!ss.length) return false;
    const sv = p.querySelector(".tw-big svg[data-sky]"); sky = sv.dataset.sky;
    let i = ss.findIndex((g) => g.classList.contains("sel"));
    if (i < 0) {   // the star the sky opens on: the lowest perk you can take now, else the roots
      const fx = +sv.dataset.fx, fy = +sv.dataset.fy;
      i = 0; let best = Infinity; ss.forEach((g, k) => { const [x, y] = xy(g), d = Math.hypot(x - fx, y - fy); if (d < best) { best = d; i = k; } });
    }
    mode = "star"; pickStar(p, i); return true;
  }
  // ---- stars
  function pickStar(p, i) {
    star = i; mode = "star";
    const g = stars(p)[i]; if (!g) return;
    if (!g.classList.contains("sel")) click(g);   // tabmenu.js shows its perk in the details box
    later(() => { paint(); const q = panel(); const h = q && stars(q)[star]; show(h, q?.querySelector(".tw-big")); });
    try { SOUND.fx("click"); } catch { /* sound never breaks the game */ }
  }
  function links(skill) {
    const tree = (typeof PERKS !== "undefined" && PERKS.TREES[skill]) || [], idx = {}, set = new Set();
    tree.forEach((p, i) => { idx[p[0]] = i; });
    tree.forEach((p, i) => { for (const n of (PERKS.BY_ID?.[p[0]]?.needs || p[4] || [])) if (idx[n] != null) { set.add(i + ":" + idx[n]); set.add(idx[n] + ":" + i); } });
    return set;
  }
  /* the nearest star in that direction: distance along it plus a penalty for how far off to the side, inside a
     wide cone; a star joined to this one by a line counts as a bit closer */
  function nearest(p, from, v) {
    const ss = stars(p), [x0, y0] = xy(ss[from]), ln = links(sky);
    let best = null, bs = Infinity;
    ss.forEach((g, i) => {
      if (i === from) return;
      const [x, y] = xy(g), dx = x - x0, dy = y - y0, along = dx * v[0] + dy * v[1], side = Math.abs(dx * v[1] - dy * v[0]);
      if (along < 6 || side > along * 2.4) return;
      const sc = (along + side * 1.6) * (ln.has(from + ":" + i) ? 0.7 : 1);
      if (sc < bs) { bs = sc; best = i; }
    });
    return best;
  }
  function take(p) {
    const g = stars(p)[star]; if (!g) return;
    if (!g.classList.contains("sel")) { pickStar(p, star); return; }   // hovered but not open yet: show it first
    const b = p.querySelector(".tw-perk button[data-act=perk]");
    if (b && !b.disabled) { b.click(); later(paint); }
    else { b?.classList.remove("pkk-no"); void b?.offsetWidth; b?.classList.add("pkk-no"); }
  }
  function back() { mode = "skill"; paint(); const p = panel(); show(p && curCard(p)); }

  function onKey(e) {
    if (e.defaultPrevented) return;
    const p = active(e); if (!p) return;
    const k = String(e.key || "").toLowerCase(), v = DIRS[k];
    const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); moved = false; };
    if (mode === "star") {
      const sv = p.querySelector(".tw-big svg[data-sky]");
      if (!sv || sv.dataset.sky !== sky || !stars(p)[star]) mode = "skill";
    }
    if (mode === "skill") {
      const cs = cards(p), c = curCard(p); if (!c) return;
      const i = cs.indexOf(c);
      if (k === "a" || k === "arrowleft") { eat(); if (i > 0) pickCard(cs[i - 1]); return; }
      if (k === "d" || k === "arrowright") { eat(); if (i < cs.length - 1) pickCard(cs[i + 1]); else enter(p); return; }
      if (k === "w" || k === "arrowup") { eat(); const n = rowStep(cs, c, -1); if (n) pickCard(n); else enter(p); return; }
      if (k === "s" || k === "arrowdown") { eat(); const n = rowStep(cs, c, 1); if (n) pickCard(n); return; }
      if (k === "e" || k === "enter" || k === " " || k === "spacebar") { eat(); if (!c.classList.contains("on")) pickCard(c); else enter(p); return; }
      return;   // Tab, Esc and the tab letters work as before
    }
    if (v) {
      eat();
      const n = nearest(p, star, v);
      if (n != null) pickStar(p, n); else if (k === "s" || k === "arrowdown" || k === "a" || k === "arrowleft") back();
      return;
    }
    if (k === "e" || k === "enter" || k === " " || k === "spacebar") { eat(); if (!e.repeat) take(p); return; }
    if (k === "tab" || k === "escape" || k === "backspace") { eat(); back(); return; }
    if (/^[a-z]$/.test(k)) eat();   // no tab letters (A = Area...) while steering the stars
  }
  if (live) {
    addEventListener("keydown", onKey, true);   // window, capture: before pcmap.js (map pan) and desktop.js (tab letters)
    // the mouse: hover moves the ring, a click puts the keys there
    // a page redraw under a resting mouse also fires pointerover: only a real move counts, or the ring would jump back
    let last = null;
    const shifted = (e) => { const m = !last || Math.hypot(e.clientX - last[0], e.clientY - last[1]) > 2; last = [e.clientX, e.clientY]; return m; };
    document.addEventListener("pointermove", (e) => { if (e.pointerType !== "touch" && shifted(e)) moved = true; }, { capture: true, passive: true });
    document.addEventListener("pointerover", (e) => {   // (pointerover comes before pointermove, so it checks the move itself)
      if (e.pointerType === "touch") return;
      if (shifted(e)) moved = true;
      if (!moved) return;
      const p = panel(); if (!p || !p.contains(e.target)) return;
      const c = e.target.closest?.(".tw-car > button[data-id]");
      if (c && mode === "skill" && c.dataset.id !== cardId) { cardId = c.dataset.id; paint(); return; }
      const g = e.target.closest?.(".tw-big g.st[data-sk-perk]");
      if (g && mode === "star") { const i = stars(p).indexOf(g); if (i >= 0 && i !== star) { star = i; paint(); } }
    }, true);
    document.addEventListener("click", (e) => {
      const p = panel(); if (!p || !e.target.closest || !p.contains(e.target)) return;
      const c = e.target.closest(".tw-car > button[data-id]");
      if (c) { cardId = c.dataset.id; mode = "skill"; later(paint); return; }
      const g = e.target.closest(".tw-big g.st[data-sk-perk]");
      if (g) { const sv = g.closest("svg[data-sky]"); sky = sv?.dataset.sky; star = +g.dataset.skPerk; mode = "star"; later(paint); }
    }, true);
    // tabmenu.js redraws the page often: put the ring back each time

    const watch = () => {
      const side = document.getElementById("side"); if (!side) return setTimeout(watch, 500);
      new MutationObserver((ms) => {
        if (ms.every((m) => m.target.classList?.contains("pkk-hint") || [...m.addedNodes, ...m.removedNodes].every((n) => n.nodeType === 1 && (n.classList?.contains("pkk-ring") || n.classList?.contains("pkk-hint"))))) return;
        if (panel()) paint(); else if ($("#side .tw-starp")) setTimeout(() => panel() && paint(), 120);   // right away (a microtask): no frame without the ring
      }).observe(side, { childList: true, subtree: true });
    };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", watch) : watch();
    setInterval(() => { const p = panel(); if (p && (!p.querySelector(".pkk-hint") || !p.querySelector(".pkk-f"))) paint(); }, 250);   // drawn while still hidden, or redrawn behind our back: catch up
  }
  return { get mode() { return mode; }, get star() { return star; }, get card() { return cardId; }, paint, HINT };
})();
