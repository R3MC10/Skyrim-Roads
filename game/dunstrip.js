/* dunstrip.js: the dungeon route strip for phones. [OURS] [dungeonphone]
   On a phone the parchment chart sits under the room, so you lost sight of the route. The strip sits above the room
   card: one pip per depth (walked, here, ahead, the boss at the end), then the rooms you can go to next as small ink
   medallions (tap one to go there when you're choosing; while you're in a room they show what comes after it), and a
   Map button that jumps to the full chart. PC shows the chart beside the room, so the strip hides there (index.html).
     DUNSTRIP.html(d) → HTML      DUNSTRIP.jump(root) scrolls the full chart into view
   The room's action buttons become a 2-column grid in CSS (index.html, .dun .evc): the main action full width when the
   count is odd, so four actions make a 2x2 block. */
const DUNSTRIP = (() => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const label = (t) => (typeof DUNGEONS !== "undefined" && DUNGEONS.LABEL[t]) || t;
  const medal = (t, theme, sz) => (typeof DUNART !== "undefined" && DUNART.medalHTML ? DUNART.medalHTML(t, theme, sz, "dsmed") : "");
  /* the rooms ahead: when choosing, the ones you can tap; inside a room, the ones its doors lead to */
  function ahead(d) {
    if (!d || d.done) return { cols: [], row: -1, live: false };
    if (!d.room) return { cols: typeof DUNGEONS !== "undefined" ? DUNGEONS.nextChoices({ dungeon: d }) : [], row: d.row + 1, live: true };
    const here = d.rows[d.row]?.[d.col];
    return { cols: here ? here.links || [] : [], row: d.row + 1, live: false };
  }
  function html(d) {
    if (!d || !d.rows?.length) return "";
    const total = d.rows.length, a = ahead(d), row = d.rows[a.row];
    const pips = d.rows.map((r, i) => {
      const boss = i === total - 1 && r.some((n) => n.type === "boss");
      const st = i < d.row || (i === d.row && d.done) ? "done" : i === d.row ? "here" : "ahead";
      return `<i class="dspip ${st}${boss ? " boss" : ""}"></i>`;
    }).join("");
    let chips = "";
    if (row && a.cols.length) {
      chips = a.cols.map((c) => {
        const n = row[c]; if (!n) return "";
        const inner = `${medal(n.type, d.theme, 22)}<span>${esc(label(n.type))}</span>`;
        return a.live ? `<button class="dschip live" data-act="droom" data-c="${c}" aria-label="Go to: ${esc(label(n.type))}">${inner}</button>`
          : `<span class="dschip">${inner}</span>`;
      }).join("");
    }
    const lead = d.done ? "Cleared" : a.live ? "Go" : "Next";
    return `<div class="dstrip" role="group" aria-label="Your route">
      <div class="dspips" aria-label="Depth ${Math.max(0, d.row + 1)} of ${total}">${pips}</div>
      <div class="dsnext"><small>${lead}</small>${chips}</div>
      <button class="btn sm dsmap" data-act="dmapjump" aria-label="Show the full map"><span>Map</span></button>
    </div>`;
  }
  function jump(root) {
    const m = root && root.querySelector(".dmapcard"); if (!m) return;
    try { m.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); } catch { m.scrollIntoView(); }
  }
  return { html, jump, ahead };
})();
