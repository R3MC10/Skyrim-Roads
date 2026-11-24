/* Weather that matters, part 2 ([OURS]; load after wevents.js, weatherfx.js, solstheim.js, powers.js, hud.js, vision.js).
   weatherfx.js already does fights (rain dulls fire and feeds shock, storms, fog spoils aim), the cold meter and blizzard
   slowdowns; vision.js shortens your sight in fog and storms. This file adds the rest and tells the player about it:
     WXM.effects(s, t)     → { id, name, icon, night, bad, lines } what the weather where you stand does, in plain words
     WXM.tip(s, t)         → the same as one line, for the HUD tooltip
     WXM.coastStorm(place) → true while a storm keeps ships in harbour there (Windhelm and Raven Rock docks)
     WXM.chipHTML(s, t)    → the HUD weather chip (line icon + name; tap or hold for what it does)
   - Storms on the coast: the Northern Maiden won't sail from a dock in a thunderstorm, blizzard or ash storm.
     Clear Skies shouted at the docks clears it (shouts2.js overrides the weather around you).
   - Clear nights: in fights your magicka comes back 50% faster (Starlit Mind: twice as fast), through POWERS.tick.
   - HUD: a weather chip next to the status icons, and the top-bar clock carries the same tooltip. */
const WXM = (() => {
  const now = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const ROUGH = ["storm", "blizzard", "ashstorm"];
  const BAD = ["rain", "fog", "storm", "snow", "blizzard", "ashstorm"];
  const DOCKS = ["Windhelm", "Raven Rock"];
  const pnum = (s, k) => (typeof PFX !== "undefined" && s ? PFX.num(s, k) : 0);
  const wxAt = (pos, t) => (typeof WEVENTS !== "undefined" && pos ? WEVENTS.weather(pos, t) : { id: "clear", name: "Clear", icon: "☀️", speed: 1, sneak: 0 });
  const night = (t) => (typeof G !== "undefined" && G.isNight ? G.isNight(t) : false);
  const posOf = (s) => (s && s.x != null ? [s.x, s.y] : null);

  // ---- what it does, in plain words (short lines; numbers where they help)
  function effects(s, t = now()) {
    const pos = posOf(s), w = wxAt(pos, t), id = w.id, fx = typeof WFX !== "undefined" ? WFX.of(id) : { el: {}, aim: 1 };
    const indoors = !!(s && s.dungeon), lines = [], nt = night(t);
    if (indoors) return { id, name: w.name, icon: w.icon, night: nt, bad: false, lines: ["Indoors: the weather can't reach you here."] };
    if (w.speed < 1) {
      const k = Math.min(0.75, pnum(s, "wxslow")), slow = Math.round((1 - w.speed) * (1 - k) * 100);
      lines.push(`Travel ${slow}% slower`);
    }
    if (w.sneak > 0) lines.push(`Easier to stay hidden (+${Math.round(w.sneak * 100)}%)`);
    const el = fx.el || {};
    for (const [k, name] of [["fire", "Fire"], ["frost", "Frost"], ["shock", "Shock"]]) {
      const m = el[k]; if (!m || m === 1) continue;
      lines.push(`${name} ${Math.round(Math.abs(m - 1) * 100)}% ${m > 1 ? "stronger" : "weaker"}`);
    }
    if (fx.storm) lines.push("Shock spells may call down lightning");
    if (fx.aim && fx.aim < 1) lines.push("Arrows miss more often");
    const sight = typeof VISION !== "undefined" ? VISION.WEATHER[id] ?? 1 : 1;
    if (sight < 0.9) lines.push(`You see ${Math.round((1 - sight) * 100)}% less far on the map`);
    if (id === "snow" || id === "blizzard" || id === "ashstorm") lines.push("Cold without warm clothes");
    if (ROUGH.includes(id)) lines.push("Ships stay in harbour");
    if (id === "clear" && nt) {
      lines.push(`Clear night: magicka comes back ${Math.round((0.5 + pnum(s, "starmp")) * 100)}% faster in fights`);
      lines.push("Deep shadows help you hide");
    }
    const bad = BAD.includes(id);
    if (bad && s && typeof POWERS !== "undefined" && POWERS.SHOUTS.clear_skies && POWERS.level(s, "clear_skies") > 0) lines.push("Shout Clear Skies to clear it around you");
    if (!lines.length) lines.push("Fine weather: nothing in your way");
    return { id, name: w.name, icon: w.icon, night: nt, bad, lines };
  }
  const tip = (s, t = now()) => { const e = effects(s, t); return `${e.name}: ${e.lines.join(". ")}.`; };

  // ---- storms on the coast keep the ship in harbour
  function coastStorm(place, t = now()) {
    if (!DOCKS.includes(place) || typeof WORLD === "undefined" || !WORLD.places[place]) return false;
    return ROUGH.includes(wxAt(WORLD.places[place], t).id);
  }
  const stormMsg = (place, t) => `A ${String(wxAt(WORLD.places[place], t).name).toLowerCase()} lashes the coast. The captain won't cast off until it passes (the weather changes every half hour), unless someone shouts the sky clear.`;
  if (typeof SOL !== "undefined") {
    const can0 = SOL.canSail, sail0 = SOL.sail, docks0 = SOL.docksHTML;
    SOL.canSail = (s, t = now()) => can0(s) || (coastStorm(s.location, t) ? stormMsg(s.location, t) : null);
    SOL.sail = (s, t = now()) => { const why = can0(s); if (why) return why; if (coastStorm(s.location, t)) return stormMsg(s.location, t); return sail0(s, t); };
    if (docks0) SOL.docksHTML = (s, esc, opts = {}) => {
      const r = docks0(s, esc, opts), t = now();
      if (!coastStorm(s.location, t)) return r;
      return { note: `${r.note} ⛈ ${stormMsg(s.location, t)}`, body: String(r.body).replace('data-act="sail"', 'data-act="sail" disabled data-storm="1"') };
    };
  }

  // ---- clear nights: magicka flows faster in fights (every turn, after the other powers tick)
  if (typeof POWERS !== "undefined") {
    const tick0 = POWERS.tick;
    POWERS.tick = (f, line) => {
      tick0(f, line);
      if (f && f.wx && f.wx.clearNight && f.regenMp > 0 && f.mp != null && typeof G !== "undefined") f.mp = Math.min(G.maxMagicka(f.s), f.mp + f.regenMp * (f.wx.mpNight || 0.5));
    };
  }

  // ---- the HUD chip: white line icons in the HUD's own style
  const ICONS = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    moon: '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.8A7 7 0 0 1 15.5 3.5z"/><path d="M5 5h.01M8 2.8h.01M3.5 9h.01"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7 18z"/>',
    rain: '<path d="M7 14h10a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6 1.3A3 3 0 0 0 7 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
    storm: '<path d="M7 13h10a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6 1.3A3 3 0 0 0 7 13z"/><path d="M12.5 14l-2.5 4h3l-2 4"/>',
    fog: '<path d="M4 8h12M7 12h13M3 16h14M8 20h9"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M10 4.5l2 1.5 2-1.5M10 19.5l2-1.5 2 1.5"/>',
    blizzard: '<path d="M3 7h11a2.5 2.5 0 1 0-2.5-2.5M3 12h16a2.5 2.5 0 1 1-2.5 2.5M3 17h9"/><path d="M17 19h.01M20 17h.01M14 21h.01"/>',
    ash: '<path d="M4 20l5-9 3 4 3-7 5 12z"/><path d="M8 5h.01M12 3.5h.01M16 5h.01M10 7.5h.01"/>',
  };
  const iconKey = (id, nt) => ({ clear: nt ? "moon" : "sun", cloudy: "cloud", rain: "rain", storm: "storm", fog: "fog", snow: "snow", blizzard: "blizzard", ashstorm: "ash" })[id] || "cloud";
  const attr = (x) => String(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function chipHTML(s, t = now()) {
    const e = effects(s, t), tp = tip(s, t);
    return `<button type="button" class="wxchip${e.bad ? " bad" : ""}${e.id === "clear" && e.night ? " night" : ""}" data-wx="${e.id}" data-tip="${attr(tp)}" aria-label="${attr(tp)}"><svg class="hico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[iconKey(e.id, e.night)]}</svg><span>${attr(e.name)}</span></button>`;
  }
  /* "Next: Rain in 12 min" from the forecast (no emoji: the card uses line icons) */
  function nextHTML(s) {
    if (typeof WFX === "undefined" || !s || s.x == null) return "";
    let fc = ""; try { fc = WFX.forecast([s.x, s.y]); } catch { return ""; }
    const nx = fc.split(" · ")[1];
    return nx ? `<small>Next: ${attr(nx.replace(/^[^A-Za-z]+/, ""))}</small>` : "";
  }
  /* a tap on the chip (or the clock) opens a short card; another tap anywhere closes it */
  function popover(anchor, s) {
    if (typeof document === "undefined") return;
    const old = document.getElementById("wxpop");
    if (old) { old.remove(); if (old._for === anchor) return; }
    const e = effects(s), el = document.createElement("div");
    el.id = "wxpop"; el.className = "wxpop"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Weather"); el._for = anchor;
    el.innerHTML = `<div class="wxp-h">${ICONS[iconKey(e.id, e.night)] ? `<svg class="hico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[iconKey(e.id, e.night)]}</svg>` : ""}<b>${attr(e.name)}</b>${nextHTML(s)}</div><ul>${e.lines.map((l) => `<li>${attr(l)}</li>`).join("")}</ul>`;
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect(), W = window.innerWidth, w = Math.min(280, W - 24);
    el.style.width = w + "px";
    el.style.left = Math.max(12, Math.min(W - w - 12, r.left + r.width / 2 - w / 2)) + "px";
    const below = r.bottom + 8, h = el.offsetHeight;
    el.style.top = (below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 8) : below) + "px";
    setTimeout(() => document.addEventListener("pointerdown", function off(ev) { if (!el.contains(ev.target) && ev.target.closest?.(".wxchip,#clock") !== anchor) { el.remove(); document.removeEventListener("pointerdown", off, true); } }, true), 0);
  }
  const save = () => (typeof window !== "undefined" && window.__dbg?.save ? window.__dbg.save() : null);
  if (typeof HUD !== "undefined" && HUD.bars) {
    const bars0 = HUD.bars;
    HUD.bars = (el, v) => {
      bars0(el, v);
      const s = save(); if (!el || !s) return;
      const st = el.querySelector(".hstat"); if (!st) return;
      const html = chipHTML(s), c = st.querySelector(".wxchip");
      if (!c || c.dataset.k !== html) { if (c) c.remove(); st.insertAdjacentHTML("afterbegin", html); st.querySelector(".wxchip").dataset.k = html; }
      const clk = document.getElementById("clock"); if (clk) { const tp = tip(s); if (clk.dataset.tip !== tp) clk.dataset.tip = tp; }
    };
  }
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") document.addEventListener("click", (ev) => {
    const a = ev.target.closest?.(".wxchip,#clock"); if (!a) return;
    const s = save(); if (!s) return;
    popover(a, s);
  });

  return { ROUGH, BAD, DOCKS, ICONS, effects, tip, coastStorm, chipHTML, popover };
})();
