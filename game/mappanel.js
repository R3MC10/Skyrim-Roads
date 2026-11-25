/* mappanel.js: the Map side panel, tidied. [OURS]
   - One "What to do next" card instead of two ("What to do next" + "Today" used to list the same things twice,
     like perk points). Rows come from ui.js (quest goal, ideas, guide, a place to explore) and remind.js (things
     ready to collect or running out). Same thing twice (same key, or two rows sending you to the same place) shows
     once; the list is sorted by urgency, then by distance. Five rows show; the rest are one tap away.
   - Filters on the "Where to?" list: All, Towns, Dungeons, Not visited, Other.
   Only sorts and frames; nothing here changes game rules. */
const MAPPANEL = (() => {
  const live = typeof document !== "undefined" && typeof document.addEventListener === "function";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* how urgent a row is (lower first) */
  const PRI = { trip: 0, quest: 1, ready: 2, ending: 3, hero: 4, soon: 5, town: 6, idea: 7, guide: 8, explore: 9 };
  const MAX = 5;
  const SOFT = new Set(["idea", "guide", "explore", "town"]);   // suggestions: dropped when something else already sends you to that place

  // ------------------------------------------------------------ pure helpers (tested in node)
  /* rows: [{ key, kind, place?, dist?, at?, html }] → deduped and sorted.
     Same key → the more urgent one stays. A suggestion (idea, guide step, "explore X") for a place another row
     already sends you to is dropped (the quest goal beats "explore X"; a ready reminder beats an idea). */
  function merge(rows) {
    const sorted = rows.filter(Boolean).map((r, i) => ({ ...r, i, p: PRI[r.kind] ?? 7 }))
      .sort((a, b) => a.p - b.p || (a.p === PRI.ending ? (a.at ?? 9e15) - (b.at ?? 9e15) : 0) || (a.dist ?? 0) - (b.dist ?? 0) || a.i - b.i);
    const keys = new Set(), places = new Set(), out = [];
    for (const r of sorted) {
      if (r.key && keys.has(r.key)) continue;
      if (r.place && places.has(r.place) && SOFT.has(r.kind)) continue;
      if (r.key) keys.add(r.key);
      if (r.place) places.add(r.place);
      out.push(r);
    }
    return out;
  }
  /* the place a row's Go button leads to (from its HTML), for rows built elsewhere */
  const placeOf = (html) => { const m = /data-place="([^"]+)"/.exec(html || ""); return m ? m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"') : null; };

  /* the place list filters: [id, label, test(kind, visited)] */
  const FILTERS = [
    ["all", "All", () => true],
    ["towns", "Towns", (k) => k === "city" || k === "town"],
    ["dungeons", "Dungeons", (k) => ["dungeon", "fort", "camp", "lair"].includes(k)],
    ["new", "Not visited", (k, v) => !v],
    ["other", "Other", (k) => ["farm", "stone", "shrine", "landmark"].includes(k)],
  ];
  let filter = "all", showAll = false;
  const test = (f, kind, visited) => (FILTERS.find(([id]) => id === f) || FILTERS[0])[2](kind, visited);
  const match = (kind, visited) => test(filter, kind, visited);

  // ------------------------------------------------------------ drawing
  /* the merged card. rows as for merge(); foot = extra HTML under the list (the ideas' switch-off line) */
  function card(rows, foot = "", max = 0) {   // max: rows shown before "Show more" (the World screen shows one goal: tabs5)
    const list = merge(rows); if (!list.length) return "";
    const ready = list.filter((r) => r.kind === "ready").length, lim = max > 0 ? max : MAX;
    const keep = showAll ? list : list.slice(0, lim), more = list.length - lim;
    return `<div class="panel nextcard rmd-card" id="rmd-card"><h2>What to do next${ready ? ` <b class="rmd-n">${ready} ready</b>` : ""}</h2><div class="list">${keep.map((r) => r.html).join("")}</div>
      ${more > 0 ? `<button class="linkbtn mp-more" data-mp="more" aria-expanded="${showAll}">${showAll ? "Show less" : `Show ${more} more`}</button>` : ""}${foot}</div>`;
  }
  /* the filter chips over the place list; counts = { id: n } */
  function chips(counts = {}) {
    return `<div class="mp-f" role="tablist" aria-label="Show places">${FILTERS.map(([id, lab]) => counts[id] === 0 && id !== "all" && id !== filter ? "" : `<button class="${id === filter ? "on" : ""}" role="tab" aria-selected="${id === filter}" data-mp="f" data-id="${id}">${esc(lab)}${counts[id] != null ? ` <small>${counts[id]}</small>` : ""}</button>`).join("")}</div>`;
  }
  /* counts for each filter, from [{ kind, visited }] */
  const countAll = (places) => Object.fromEntries(FILTERS.map(([id, , f]) => [id, places.filter((p) => f(p.kind, p.visited)).length]));

  if (live) document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-mp]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.dataset.mp === "more") showAll = !showAll;
    if (b.dataset.mp === "f") filter = b.dataset.id || "all";
    if (typeof SOUND !== "undefined") { try { SOUND.fx("click"); } catch { /* fine */ } }
    window.__ui?.refresh?.();
  });

  return { PRI, MAX, FILTERS, merge, placeOf, test, match, card, chips, countAll, get filter() { return filter; }, set filter(v) { filter = v; } };
})();
if (typeof module !== "undefined") module.exports = MAPPANEL;
