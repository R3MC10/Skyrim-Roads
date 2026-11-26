/* The market board screen [OURS] (b358): tabs on top of the Market stalls page.
   - Here: this town's stalls and your own stall (ui.js marketHere, as before).
   - Market board: every open listing in every town, with name search, type and rarity filters and sort by newest or
     price. Each row shows the real icon, rarity colour, forge level, stats, quantity, the seller and their town, and a
     small "last sold for about X" line when this phone has seen one sell. Buy from any town (MARKET.buyAny).
   - Parcels: what you bought on the board waits here; open it in any town with a market.
   The rules live in market.js (node-tested in tests/test_marketboard.js); this file only draws and handles taps. */
const MKTBOARD = (() => {
  let tab = "here", q = { text: "", kind: "all", rarity: "all", sort: "new" }, busy = new Set(), shown = 30;
  const RARS = [["all", "Any rarity"], ["common", "Common"], ["fine", "Fine"], ["rare", "Rare"], ["epic", "Epic"], ["legendary", "Legendary"]];
  const SORTS = [["new", "Newest"], ["cheap", "Cheapest"], ["dear", "Dearest"]];
  const esc0 = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const view = () => tab;
  const setQ = (v) => { q.text = String(v || "").slice(0, 40); shown = 30; };
  function head(s) {
    const n = (s.parcels || []).length;
    const b = (id, l) => `<button class="${tab === id ? "on" : ""}" data-act="mkbtab" data-id="${id}" aria-pressed="${tab === id}">${l}</button>`;
    return `<div class="seg mkb-seg" role="group" aria-label="Market">${b("here", "Here")}${b("board", "Market board")}${b("parcels", `Parcels${n ? ` <b class="mkb-n">${n}</b>` : ""}`)}</div>`;
  }
  function row(s, d, h) {
    const r = d.row, esc = h.esc || esc0, last = MARKET.lastSold(s, r.item);
    const name = (h.rarN ? h.rarN(r.item, r, MARKET.itemName(r)) : esc(MARKET.itemName(r)));
    const here = s.location === d.town;
    return `<div class="item mkb-row">${typeof ICONART !== "undefined" ? `<span class="mk-ico"${typeof RTIP !== "undefined" ? RTIP.attr(r.item, r.qty || 1) : ""}>${ICONART.item(r.item, 34, r)}</span>` : ""}<div class="t">${name}${r.qty > 1 ? ` ×${r.qty}` : ""}
      <span>${esc(G.itemStats(r.item))}</span><span class="mkb-where">${esc(d.sellerName)} · ${esc(d.town)}${here ? " (here)" : ""}${last ? ` · last sold for ~${last}${r.qty > 1 ? " each" : ""}` : ""}</span></div>
      <span class="num gold">${d.price}</span><button class="btn sm pri" data-act="mkbbuy" data-id="${esc(d.id)}" ${s.gold >= d.price && !busy.has(d.id) ? "" : "disabled"}>Buy</button></div>`;
  }
  function body(s, stalls, l, h = {}) {
    const esc = h.esc || esc0;
    if (tab === "parcels") {
      const box = s.parcels || [], can = MARKET.hasMarket(s.location);
      return `<h3>Market parcels</h3><p class="sub" style="margin-top:0">What you buy on the market board waits here, so a full pack never loses a thing. Open it in any town with a market.</p>
        ${box.length ? `<div class="list">${box.map((p) => `<div class="item">${typeof ICONART !== "undefined" ? ICONART.item(p.row.item, 30, p.row) : ""}<div class="t">${h.rarN ? h.rarN(p.row.item, p.row, MARKET.itemName(p.row)) : esc(MARKET.itemName(p.row))}${p.row.qty > 1 ? ` ×${p.row.qty}` : ""}<span>from ${esc(p.from)} in ${esc(p.town)} · ${p.price} gold</span></div></div>`).join("")}</div>
          <button class="btn pri" data-act="mkbopen" style="width:100%;margin-top:8px" ${can ? "" : "disabled"}>Take everything into your pack</button>` : `<p class="sub">Empty. Buy something on the market board and it comes here.</p>`}`;
    }
    const list = MARKET.board(stalls, q, s.id);
    const chips = (arr, key) => `<div class="chips mkb-chips">${arr.map(([k, lab]) => `<button class="chip ${q[key] === k ? "on" : ""}" data-act="mkbq" data-k="${key}" data-id="${k}">${lab}</button>`).join("")}</div>`;
    return `<h3>Market board</h3><p class="sub" style="margin-top:0">Every player stall in every town. Buy from anywhere: it waits in your Parcels. The seller gets the gold, less the market's ${Math.round(MARKET.FEE * 100)}%.</p>
      <div class="chatrow"><input id="mkbq" value="${esc(q.text)}" placeholder="Search by name or town" autocomplete="off" aria-label="Search the market board"></div>
      ${chips(MARKET.KINDS, "kind")}${chips(RARS, "rarity")}${chips(SORTS, "sort")}
      <div class="list mkb-list">${list.slice(0, shown).map((d) => row(s, d, h)).join("") || `<p class="sub">${q.text || q.kind !== "all" || q.rarity !== "all" ? "Nothing matches. Try fewer filters." : "No one has anything on a stall right now."}</p>`}</div>
      ${list.length > shown ? `<button class="btn" data-act="mkbmore" style="width:100%;margin-top:6px">Show more (${list.length - shown} left)</button>` : ""}`;
  }
  async function buy(id, c) {
    if (busy.has(id)) return;   // a double tap buys once
    busy.add(id); c.render();
    const out = {}, S = c.S;
    try { if (typeof Store !== "undefined") await Store.change("stalls", id, (d) => MARKET.buyAny(S, { ...d }, out) || d); }
    finally { busy.delete(id); }
    if (out.err) { c.toast(out.err); c.render(); return; }
    if (!out.text) { c.toast("Someone bought it first."); c.render(); return; }
    c.persist(true); c.sound?.("coin"); c.toast(out.text); c.render();
  }
  function act(b, c) {
    const a = b.dataset.act, id = b.dataset.id;
    if (a === "mkbtab") { tab = id; shown = 30; c.sound?.("click"); c.render(); }
    else if (a === "mkbq") { q[b.dataset.k] = id; shown = 30; c.sound?.("click"); c.render(); }
    else if (a === "mkbmore") { shown += 30; c.render(); }
    else if (a === "mkbbuy") buy(id, c);
    else if (a === "mkbopen") { const r = MARKET.openParcels(c.S); if (r.err) return c.toast(r.err); c.persist(true); c.sound?.("coin"); c.toast(r.text); c.render(); }
  }
  return { view, setQ, head, body, act, get q() { return { ...q }; }, _tab: (t) => { tab = t; } };
})();
