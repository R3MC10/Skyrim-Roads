/* Accessibility [OURS]: Settings → Accessibility. Loaded in <head>, before the page paints, so the choices are
   already in place on the very first frame.
     Text size     4 steps. The whole interface is zoomed (so buttons grow with their text and nothing gets cut off);
                   viewport units in the stylesheets are divided back so popups still fit the screen, and canvases
                   are un-zoomed so map taps and drawing stay pixel-exact.
     Colour help   protanopia / deuteranopia / tritanopia: CSS variables for health / magicka / stamina, danger,
                   buffs, loot rarity and enemy colours, plus a small colour map that canvas drawing goes through
                   (map markers, fight bars) — swapped at the canvas fillStyle / strokeStyle level, so the art files
                   need no changes.
     High contrast brighter grey text, solid dark panels, firmer outlines.
     Reduce motion "auto" follows the phone's setting; "on" / "off" override it. Every module that asks
                   matchMedia("(prefers-reduced-motion: reduce)") gets this answer, so screen shake, hit flashes,
                   parallax and drifting effects all switch off together; CSS animations are cut to nothing.
     One hand      main buttons (menu, friends, map zoom, favourites, compass) gather at the bottom, left or right.
     Easy timing   timed mini-games give more time and wider sweet spots. Any mini-game can ask:
                     A11Y.timingEase()  → 1, or 1.5 with Easy timing: multiply time limits by it (or divide sweep speeds)
                     A11Y.zoneEase()    → 1, or 1.4 with Easy timing: multiply sweet-spot / safe-zone widths by it
     Colour is never the only signal: with a colour-blind mode on, bars get patterns (magicka striped, stamina ticked),
                   danger words get a shape (○ minor, ◆ dangerous, ⚠ deadly) and good/bad effects an arrow (CSS).
   Saved in the same "rotn_prefs" store as the other settings.
   ACCESS.settingsHTML(seg) / ACCESS.pref(key, value) are the two hooks Settings uses. */
const ACCESS = (() => {
  const DOM = typeof document !== "undefined" && typeof window !== "undefined";
  const KEY = "rotn_prefs";
  const SIZES = [1, 1.12, 1.25, 1.38], SMALL = 0.88;   // index -1 is Small; 1 ("Big" in old saves) now shows as Large
  const SIZE_NAMES = ["Normal", "Big", "Bigger", "Biggest"];
  const TEXT_OPTS = [[-1, "Small"], [0, "Normal"], [2, "Large"], [3, "Huge"]];
  const sizeOf = (i) => (i < 0 ? SMALL : SIZES[i] || 1);
  const TIME_EASE = 1.5, ZONE_EASE = 1.4;
  const MODES = ["none", "protan", "deutan", "tritan"];
  const DEF = { a11yText: 0, a11yColour: "none", a11yContrast: false, a11yMotion: "auto", a11yHand: "off", a11yTiming: false };

  // ---- colours. One rarity set works for all three types (checked with colour-blind simulation in the tests).
  const RARITY = { "q-common": "#ece8de", "q-fine": "#20c0a0", "q-superior": "#5b8cff", "q-exquisite": "#f0a8ff", "q-legendary": "#ffd84a", "q-unique": "#ff5a3a" };
  const RG = {   // red-green (protanopia and deuteranopia): health turns orange, stamina yellow, safe things blue
    hp: "#e0601a", mp: "#3f7fd6", sp: "#fff27a", ember: "#ff6a2a", low: "#6fb6ff", med: "#f2d27a", high: "#e0501a",
    buff: "#6fb6ff", debuff: "#ff8a2a", foe: "#9a5cd0", raid: "#ff8a2a", ripe: "#6fb6ff",
  };
  const PAL = {
    protan: { ...RG, hp: "#f07020", high: "#ff6a1a", ember: "#ff7a3a" },   // reds look dark to protans: lift them
    deutan: { ...RG },
    tritan: {   // blue-yellow: magicka goes cyan, stamina pale, safe things teal
      hp: "#e0303a", mp: "#2a9ad8", sp: "#ece6dc", ember: "#ff4d5a", low: "#5fd0c8", med: "#ff9ad0", high: "#ff3a3a",
      buff: "#5fd0c8", debuff: "#ff5a5a", foe: "#2a9ad8", raid: "#ff4d5a", ripe: "#5fd0c8",
    },
  };
  /* the canvas colour map: exact colours the art uses for meaning → the semantic slot they become */
  const CANVAS = {
    "#c0392b": "hp",      // your health bar in fight replays
    "#c4413a": "hp",
    "#8e6b2b": "foe",     // the enemy's health bar in fight replays
    "#d65a4a": "high",    // danger pins on the map
    "#c9392b": "high",    // treasure-map X marks
    "#e0302a": "high",    // lair markers
    "#4fa35c": "sp",
    "#3f7fd6": "mp",
    "#6fb04a": "ripe",    // ripe harvest bushes on the map
    "#8fd08f": "low",
  };

  // ---- prefs
  function read() {
    let p = {};
    try { p = JSON.parse((DOM && localStorage.getItem(KEY)) || "{}") || {}; } catch { p = {}; }
    const o = { ...DEF };
    for (const k of Object.keys(DEF)) if (p[k] !== undefined) o[k] = p[k];
    o.a11yText = Math.max(-1, Math.min(3, Math.round(Number(o.a11yText) || 0)));
    if (o.a11yText === 1) o.a11yText = 2;   // the old "Big" step folds into Large
    if (!MODES.includes(o.a11yColour)) o.a11yColour = "none";
    o.a11yContrast = o.a11yContrast === true || o.a11yContrast === "true";
    if (!["auto", "on", "off"].includes(o.a11yMotion)) o.a11yMotion = "auto";
    if (!["off", "left", "right"].includes(o.a11yHand)) o.a11yHand = "off";
    o.a11yTiming = o.a11yTiming === true || o.a11yTiming === "true";
    return o;
  }
  let cur = read();
  function save(k, v) {
    try { const p = JSON.parse(localStorage.getItem(KEY) || "{}"); p[k] = v; localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
  }

  // ---- reduce motion: answer the media query for everyone
  const RM = /prefers-reduced-motion\s*:\s*reduce/i;
  const realMM = DOM && typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : null;
  const sysReduce = () => { try { return !!(realMM && realMM("(prefers-reduced-motion: reduce)").matches); } catch { return false; } };
  const reduceMotion = () => (cur.a11yMotion === "on" ? true : cur.a11yMotion === "off" ? false : sysReduce());
  const mqListeners = new Set();
  function fakeMQL(q, real) {
    const fire = () => { const ev = { matches: reduceMotion(), media: q }; for (const fn of [...mqListeners]) if (fn.q === m) try { fn.f.call(m, ev); } catch (e) { console.warn("reduce-motion listener", e); } if (typeof m.onchange === "function") try { m.onchange(ev); } catch { /* ignore */ } };
    const m = {
      media: q, onchange: null,
      get matches() { return reduceMotion(); },
      addEventListener(type, f) { if (type === "change" && f) mqListeners.add({ q: m, f, key: f }); },
      removeEventListener(type, f) { for (const x of mqListeners) if (x.q === m && x.key === f) mqListeners.delete(x); },
      addListener(f) { this.addEventListener("change", f); },
      removeListener(f) { this.removeEventListener("change", f); },
      dispatchEvent() { fire(); return true; },
    };
    try { real.addEventListener("change", () => { if (cur.a11yMotion === "auto") { apply(); fire(); } }); } catch { /* old browsers */ }
    m._fire = fire;
    return m;
  }
  const fakes = [];
  if (realMM) {
    window.matchMedia = function (q) {
      const real = realMM(q);
      if (!RM.test(String(q))) return real;
      const f = fakeMQL(String(q), real); fakes.push(f); if (fakes.length > 60) fakes.shift();
      return f;
    };
  }
  const notifyMotion = () => { for (const f of fakes) f._fire(); };

  // ---- colour helpers (also usable directly: ACCESS.col("hp", "#c4413a"))
  const pal = () => PAL[cur.a11yColour] || null;
  function col(slot, fallback) { const p = pal(); return (p && p[slot]) || fallback; }
  function remap(c) {
    const p = pal(); if (!p || typeof c !== "string" || c.length !== 7 || c[0] !== "#") return c;
    const slot = CANVAS[c.toLowerCase()];
    return slot && p[slot] ? p[slot] : c;
  }
  let patched = false;
  function patchCanvas() {
    if (patched || !DOM) return;
    const wrap = (proto, prop) => {
      const d = proto && Object.getOwnPropertyDescriptor(proto, prop);
      if (!d || !d.set) return;
      Object.defineProperty(proto, prop, { ...d, set(v) { d.set.call(this, pal() ? remap(v) : v); } });
    };
    try {
      for (const C of [window.CanvasRenderingContext2D, window.OffscreenCanvasRenderingContext2D]) if (C) { wrap(C.prototype, "fillStyle"); wrap(C.prototype, "strokeStyle"); }
      const G = window.CanvasGradient;
      if (G && G.prototype.addColorStop) { const a = G.prototype.addColorStop; G.prototype.addColorStop = function (o, c) { return a.call(this, o, pal() ? remap(c) : c); }; }
      patched = true;
    } catch (e) { console.warn("colour help", e); }
  }

  // ---- text size: zoom the page, keep viewport units honest
  let unitsFixed = false;
  const VU = /(-?\d*\.?\d+)(d|s|l)?(vh|vw|vmin|vmax)\b/g;
  function fixUnits(rules) {
    for (const r of rules) {
      try {
        if (r.cssRules && r.cssRules.length) fixUnits(r.cssRules);
        const st = r.style; if (!st) continue;
        for (let i = 0; i < st.length; i++) {
          const p = st[i], v = st.getPropertyValue(p);
          if (!v || !/v(h|w|min|max)\b/.test(v) || v.includes("--tz")) continue;
          st.setProperty(p, v.replace(VU, (m) => `calc(${m} / var(--tz, 1))`), st.getPropertyPriority(p));
        }
      } catch { /* a rule we can't touch */ }
    }
  }
  function fixViewportUnits() {
    if (unitsFixed || !DOM) return;
    unitsFixed = true;
    for (const sh of document.styleSheets) { try { fixUnits(sh.cssRules); } catch { /* cross-origin sheet */ } }
  }

  /* big PC monitors: scale the whole game up so it isn't tiny on a 1440p or 4K screen (mouse screens only, never phones) */
  function screenScale() {
    if (!DOM || typeof matchMedia !== "function" || !matchMedia("(hover:hover) and (pointer:fine)").matches) return 1;
    const f = Math.min(innerWidth / 1600, innerHeight / 1000);
    return Math.max(1, Math.min(2, Math.round(f * 20) / 20));
  }
  let lastScale = 1;
  // ---- put it all on the page
  function apply() {
    if (!DOM) return;
    const h = document.documentElement, sc = screenScale(), z = +(sizeOf(cur.a11yText) * sc).toFixed(3);
    lastScale = sc;
    if (z !== 1) fixViewportUnits();
    h.style.setProperty("--tz", String(z));
    h.style.setProperty("--tzcap", String(+(1.12 * sc).toFixed(3)));
    h.classList.toggle("a11y-zoom", z !== 1);
    h.dataset.a11yText = String(cur.a11yText);
    if (cur.a11yColour !== "none") { h.dataset.cb = cur.a11yColour; patchCanvas(); } else delete h.dataset.cb;
    h.classList.toggle("a11y-hc", cur.a11yContrast);
    h.classList.toggle("a11y-still", reduceMotion());
    h.classList.toggle("a11y-1h", cur.a11yHand !== "off");
    h.classList.toggle("a11y-1h-left", cur.a11yHand === "left");
    h.classList.toggle("a11y-easy", cur.a11yTiming);
  }
  /* timed mini-games ask these (see the top of the file) */
  const timingEase = () => (cur.a11yTiming ? TIME_EASE : 1);
  const zoneEase = () => (cur.a11yTiming ? ZONE_EASE : 1);

  // ---- settings
  function settingsHTML(seg) {
    const c = cur;
    const row = (label, html, hint) => `<div class="setrow a11y-col"><span>${label}</span>${html}${hint ? `<small class="a11y-hint">${hint}</small>` : ""}</div>`;
    const cbHint = { none: "", protan: "For red-blindness (protanopia): health is orange, stamina yellow, safe things blue.", deutan: "For green-blindness (deuteranopia): health is orange, stamina yellow, safe things blue.", tritan: "For blue-blindness (tritanopia): magicka is cyan, stamina pale, safe things teal." }[c.a11yColour];
    return `<h3>Accessibility</h3>
      ${row("Text size", seg("a11yText", TEXT_OPTS, c.a11yText))}
      ${row("Colour-blind help", seg("a11yColour", [["none", "Off"], ["protan", "Red"], ["deutan", "Green"], ["tritan", "Blue"]], c.a11yColour), cbHint || "Pick the colour that's hard for you to see.")}
      ${row("High-contrast text", seg("a11yContrast", [[false, "Off"], [true, "On"]], c.a11yContrast))}
      ${row("Reduce motion", seg("a11yMotion", [["auto", "Auto"], ["on", "On"], ["off", "Off"]], c.a11yMotion), "No screen shake, flashes or drifting. Auto follows your phone's setting. A few effects change the next time you open the game.")}
      ${row("One-hand mode", seg("a11yHand", [["off", "Off"], ["left", "Left hand"], ["right", "Right hand"]], c.a11yHand), "Moves the main buttons to the bottom, where your thumb is.")}
      ${row("Easy timing", seg("a11yTiming", [[false, "Off"], [true, "On"]], c.a11yTiming), "Timed mini-games (mining, fishing, locks, dungeon rooms) give you more time and a wider sweet spot.")}`;
  }
  /* returns true when the key was ours (the caller re-renders the settings) */
  function pref(k, v) {
    if (!(k in DEF)) return false;
    let val = v;
    if (k === "a11yText") { val = Math.max(-1, Math.min(3, parseInt(v, 10) || 0)); if (val === 1) val = 2; }
    if (k === "a11yContrast" || k === "a11yTiming") val = v === true || v === "true";
    save(k, val);
    const was = cur; cur = read();
    apply();
    if (k === "a11yMotion" && was.a11yMotion !== cur.a11yMotion) notifyMotion();
    if (k === "a11yColour" && typeof ART !== "undefined" && ART.clear) ART.clear();   // redraw cached pictures in the new colours
    if (k === "a11yText" && DOM) try { window.dispatchEvent(new Event("resize")); } catch { /* fine */ }
    return true;
  }

  apply();
  if (DOM && typeof addEventListener === "function") {
    let rt = null;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (screenScale() !== lastScale) { apply(); try { window.dispatchEvent(new Event("resize")); } catch { /* fine */ } } }, 200); });
  }
  return { SIZES, SIZE_NAMES, MODES, PAL, RARITY, CANVAS, read, settings: () => ({ ...cur }), pref, settingsHTML, apply, col, remap, reduceMotion, timingEase, zoneEase, TIME_EASE, ZONE_EASE, TEXT_OPTS, zoom: () => sizeOf(cur.a11yText) };
})();
var A11Y = ACCESS;   // the short name other modules use: A11Y.timingEase(), A11Y.zoneEase(), A11Y.reduceMotion()
