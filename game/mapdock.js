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
    const party = document.querySelector(".pcparty.on"), vit = document.getElementById("vitals"), gp = document.getElementById("gpop");
    const t = Math.round(shown(party) ? party.getBoundingClientRect().bottom + 10 : 12);
    let b = Math.round(shown(vit) ? vit.getBoundingClientRect().top - 12 : innerHeight - 150);
    /* [phonelayout] the floating Gathering card (#gpop, ui.js) sits at the bottom of the same column: the cards stop above it
       (and scroll) instead of running under it, and it never grows into the last 130px the cards need */
    /* screen px -> CSS px: the text-size setting zooms the whole page, big screens zoom the column again */
    const zh = parseFloat(getComputedStyle(document.documentElement).zoom) || 1, zt = parseFloat(getComputedStyle(top).zoom) || 1;
    if (shown(gp)) {
      gp.style.boxSizing = "border-box";
      gp.style.maxHeight = Math.round(Math.max(90, Math.min(innerHeight * 0.52, b - t - 130)) / zh) + "px";
      b = Math.round(gp.getBoundingClientRect().top - 10);
    } else if (gp && gp.style.maxHeight) gp.style.maxHeight = "";
    const key = t + "|" + b + "|" + zh + "|" + zt;
    if (key !== last) {
      last = key;
      top.style.setProperty("--dock-top", Math.round(t / (zh * zt)) + "px");
      top.style.setProperty("--dock-max", Math.floor(Math.max(120, b - t) / zh) + "px");
    }
    /* big screens zoom the column (index.html), which also scales its top offset and padding: if it still reaches past
       the bottom line, trim it by what sticks out (only when it really reaches that far, so the check runs every tick) */
    if (shown(gp)) {
      const r = top.getBoundingClientRect();
      if (r.height > 2 && r.bottom > b + 0.5) {
        const cur = parseFloat(top.style.getPropertyValue("--dock-max")) || (b - t);
        top.style.setProperty("--dock-max", Math.max(60, Math.floor(cur - (r.bottom - b) - 1)) + "px");
      }
    }
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
  /* for tests: how far any visible part of the docked cards reaches into the Gathering card ([] = no overlap) */
  function overlaps() {
    const box = document.getElementById("topcards"), gp = document.getElementById("gpop");
    if (!shown(gp) || !shown(box)) return [];
    const g = gp.getBoundingClientRect(), clip = box.getBoundingClientRect();
    return [...box.children].filter(shown).map((e) => e.getBoundingClientRect())
      .filter((r) => Math.min(r.bottom, clip.bottom) > g.top + 1 && Math.max(r.top, clip.top) < g.bottom && r.right > g.left && r.left < g.right)
      .map((r) => Math.round(Math.min(r.bottom, clip.bottom) - g.top));
  }
  return { tick, rects, right, overlaps };
})();
