/* mapdock.js — on a PC map the world event card (with its notices and the foldable pill, gevstack.js), the dragon raid
   card and the caravan / world-event strips sit together in one column at the left edge, under the party list when
   there is one, instead of over the middle of the map. Phones keep their layout: there #topcards has display:contents,
   so moving #wev into it changes nothing.
   MAPDOCK.rects() tells map.js where the docked cards (and the party and quest panels) are, so no names are drawn
   under them. */
const MAPDOCK = (() => {
  const pc = () => document.documentElement.classList.contains("pcmap");
  const shown = (el) => !!el && el.getClientRects().length > 0;
  let last = "";
  function tick() {
    const top = document.getElementById("topcards"); if (!top) return;
    const wev = document.getElementById("wev");
    if (wev && wev.parentElement !== top) top.append(wev);   // worldevents.js may have made it before #topcards existed
    if (!pc()) { if (last) { top.style.removeProperty("--dock-top"); top.style.removeProperty("--dock-max"); last = ""; } return; }
    const party = document.querySelector(".pcparty.on"), vit = document.getElementById("vitals");
    const t = Math.round(shown(party) ? party.getBoundingClientRect().bottom + 10 : 12);
    const b = Math.round(shown(vit) ? vit.getBoundingClientRect().top - 12 : innerHeight - 150);
    const key = t + "|" + b; if (key === last) return; last = key;
    top.style.setProperty("--dock-top", t + "px"); top.style.setProperty("--dock-max", Math.max(120, b - t) + "px");
  }
  /* screen rects (CSS px) the map should keep clear of names */
  function rects() {
    if (!pc()) return [];
    const out = [], add = (el) => { if (!shown(el)) return; const r = el.getBoundingClientRect(); if (r.width > 2 && r.height > 2) out.push(r); };
    const top = document.getElementById("topcards");
    if (top) for (const c of top.children) add(c);
    add(document.querySelector(".pcparty.on")); add(document.querySelector(".pcquest"));
    return out;
  }
  /* right edge of the docked cards reaching below y (0 when none): the message lane (hud2.js) starts right of it */
  function right(y = 0) {
    if (!pc()) return 0;
    let r = 0; const top = document.getElementById("topcards");
    if (top) for (const c of top.children) if (shown(c)) { const b = c.getBoundingClientRect(); if (b.bottom > y && b.height > 2) r = Math.max(r, b.right); }
    return r;
  }
  if (typeof window !== "undefined" && typeof document !== "undefined") { setInterval(tick, 400); addEventListener("resize", tick); }
  return { tick, rects, right };
})();
