/* homestash.js: your house chest as a SkyUI-style container menu. [OURS]
   - Two sides, like Skyrim's chest screen: the Chest and Your pack. Each has category filters with counts
     (All, Weapons, Apparel, Potions, Scrolls, Food, Ingredients, Books, Misc), one sort row (name, stat, weight,
     value, with a flip), and a list where every row has the same item icon the Items menu uses.
   - Tap a row for its details: icon, stats, weight, and Store / Take 1, an amount you pick, or all of the stack.
   - Your load and what the chest holds are shown on top. Worn gear (in any loadout) never shows on Your pack and
     can't be stored: TOWNS.stash refuses it.
   - The moves themselves live in towns.js (TOWNS.stash / TOWNS.unstash) so old callers keep working.
   The chest is yours alone (it lives in your own save); in a party everyone keeps their own house chest. */
const HSTASH = (() => {
  const E = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const itemOf = (r) => (r && typeof D !== "undefined" ? D.ITEMS[r.item] : null);
  const ARMOR = () => (typeof G !== "undefined" && G.ARMOR_SLOTS) || ["head", "chest", "hands", "feet", "shield"];
  const fmtW = (n) => String(Math.round(n * 100) / 100);

  // ------------------------------------------------------------ the lists (pure, tested in node)
  const CATS = [["all", "All"], ["weapons", "Weapons"], ["apparel", "Apparel"], ["potions", "Potions"], ["scrolls", "Scrolls"], ["food", "Food"], ["ingredients", "Ingredients"], ["books", "Books"], ["misc", "Misc"]];
  /* same groups as the Items menu */
  const catOf = (it) => !it ? "misc" : it.slot === "food" ? "food" : it.slot === "weapon" || it.slot === "ammo" ? "weapons"
    : ARMOR().includes(it.slot) || it.slot === "ring" || it.slot === "amulet" ? "apparel" : ["potion", "poison"].includes(it.slot) ? "potions"
    : it.slot === "scroll" ? "scrolls" : it.slot === "tome" || it.slot === "recipe" ? "books" : it.slot === "ingredient" ? "ingredients" : "misc";
  const SORTS = [["name", "Name"], ["stat", "Stat"], ["weight", "Weight"], ["value", "Value"]];
  const statOf = (r, it) => !it ? null : it.slot === "weapon" ? (it.damage || 0) + (r.temper || 0) : ARMOR().includes(it.slot) ? (it.armor || 0) + (r.temper || 0)
    : it.restore ? it.restore[1] : it.effects ? it.effects[0][1] : it.slot === "soulgem" ? it.charge ?? null : null;
  const nameOf = (r, it) => (typeof NAMES !== "undefined" ? NAMES.improved : String)(it.name, r) + (r.nm ? ` “${r.nm}”` : "");
  /* worn in any loadout: these stay on you */
  function worn(s) { const out = new Set(); for (const lo of Object.values(s.loadouts || {})) for (const id of Object.values(lo.equipment || {})) out.add(id); return out; }
  const chestOf = (s) => (typeof TOWNS !== "undefined" ? TOWNS.home(s) : null)?.chest || [];
  /* rows for one side; a chest row's key is its place in the chest, a pack row's key is its inventory id */
  function rows(s, side = "chest", cat = "all", sort = "name", dir = 1) {
    const on = worn(s);
    const spare = (r) => { let n = G.freeQty ? G.freeQty(s, r.id) : r.qty || 1; if (on.has(r.id)) n = Math.min(n, (r.qty || 1) - 1); return n > 0 ? (n === r.qty ? r : { ...r, qty: n }) : null; };   // two copies, one worn: the spare shows
    const src = side === "pack" ? (s.inv || []).map(spare).filter(Boolean).map((r) => [r.id, r]) : chestOf(s).map((r, i) => [i, r]);
    const out = [];
    for (const [key, r] of src) {
      const it = itemOf(r); if (!it) continue;   // an item this build doesn't know: keep it, just don't draw it
      const c = catOf(it); if (cat !== "all" && c !== cat) continue;
      out.push({ key, r, it, name: nameOf(r, it), stat: statOf(r, it), weight: +((it.weight || 0) * r.qty).toFixed(2), value: (it.value || 0) * r.qty, qty: r.qty || 1, cat: c });
    }
    return sortRows(out, sort, dir);
  }
  function sortRows(list, k = "name", dir = 1) {
    return [...list].sort((a, b) => (k === "name" ? a.name.localeCompare(b.name) * dir
      : a[k] == null && b[k] == null ? 0 : a[k] == null ? 1 : b[k] == null ? -1 : (b[k] - a[k]) * dir) || a.name.localeCompare(b.name));
  }
  function counts(s, side) { const n = { all: 0 }; for (const r of rows(s, side)) { n.all++; n[r.cat] = (n[r.cat] || 0) + 1; } return n; }
  /* total weight in the chest, and what you carry */
  const chestWeight = (s) => +chestOf(s).reduce((a, r) => a + (itemOf(r)?.weight || 0) * (r.qty || 1), 0).toFixed(2);
  const load = (s) => ({ now: +G.carried(s).toFixed(1), cap: G.capacity(s) });

  // ------------------------------------------------------------ view state
  const ui = { side: "chest", cat: "all", sort: "name", dir: 1, sel: null };
  let icon = () => "";
  function act(s, d) {
    switch (d.op) {
      case "side": ui.side = d.id === "pack" ? "pack" : "chest"; ui.sel = null; ui.cat = "all"; break;
      case "cat": ui.cat = d.id; ui.sel = null; break;
      case "sort": if (ui.sort === d.id) ui.dir = -ui.dir; else { ui.sort = d.id; ui.dir = 1; } break;
      case "dir": ui.dir = -ui.dir; break;
      case "sel": ui.sel = String(ui.sel) === String(d.id) ? null : +d.id; break;
    }
    return "";
  }
  /* after a move: keep the same thing picked if it's still there */
  function moved(s, side, key, left) { if (side === "chest" && left <= 0) ui.sel = null; else if (side === "pack" && !(s.inv || []).some((r) => r.id === key)) ui.sel = null; }

  // ------------------------------------------------------------ drawing (browser)
  const ico = (r, n) => (typeof ICONART !== "undefined" ? ICONART.item(r.item, n, r) : "") || `<span class="hs-noico" style="width:${n}px;height:${n}px"></span>`;
  const dirLabel = (k, dir) => (k === "name" ? (dir > 0 ? "A–Z" : "Z–A") : (dir > 0 ? "High first" : "Low first"));
  function sortBar() {
    return `<div class="m2-sort hs-sort" role="group" aria-label="Sort"><span class="m2-sl">Sort</span><div class="m2-sc">${SORTS.map(([k, l]) => `<button class="chip ${k === ui.sort ? "on" : ""}" data-act="hstash2" data-op="sort" data-id="${k}" aria-pressed="${k === ui.sort}">${l}</button>`).join("")}</div>`
      + `<button class="m2-dir" data-act="hstash2" data-op="dir" aria-label="Sort direction: ${dirLabel(ui.sort, ui.dir)}"><b aria-hidden="true">${ui.dir > 0 ? "▼" : "▲"}</b><span>${dirLabel(ui.sort, ui.dir)}</span></button></div>`;
  }
  function detail(s, row, esc) {
    if (!row) return `<div class="m2-pick hs-pick"><p>Pick something to move it.</p></div>`;
    const { r, it } = row, chest = ui.side === "chest", act = chest ? "unstash" : "stash", verb = chest ? "Take" : "Store";
    const st = [];
    if (it.slot === "weapon") st.push(["Damage", `${it.damage || 0}${r.temper ? ` (+${r.temper})` : ""}`]);
    if (ARMOR().includes(it.slot)) st.push(["Armor", `${it.armor || 0}${r.temper ? ` (+${r.temper})` : ""}`]);
    st.push(["Weight", fmtW((it.weight || 0) * r.qty)], ["Value", (it.value || 0) * r.qty]);
    if (r.qty > 1) st.push(["Count", r.qty]);
    const info = typeof G !== "undefined" && G.itemStats ? G.itemStats(r.item) : "";
    const acts = [`<button class="btn pri" data-act="${act}" data-id="${row.key}" data-n="1">${verb} 1</button>`];
    if (r.qty > 2) acts.push(`<span class="hs-amt"><input id="hsAmt" type="number" inputmode="numeric" min="1" max="${r.qty}" value="${Math.max(1, Math.floor(r.qty / 2))}" aria-label="How many"><button class="btn" data-act="${act}" data-id="${row.key}" data-n="amt">${verb}</button></span>`);
    if (r.qty > 1) acts.push(`<button class="btn" data-act="${act}" data-id="${row.key}" data-n="${r.qty}">${verb} all (${r.qty})</button>`);
    if (chest) acts.push(`<button class="btn" data-act="showcase" data-id="${row.key}">${r.shown ? "Hide from visitors" : "Show to visitors"}</button>`);
    return `<div class="sky-detail hs-detail"><div class="sky-ico">${ico(r, 56)}</div><h3 class="q-${typeof RARITY !== "undefined" ? RARITY.of(r.item, r) : "common"}">${esc(row.name)}</h3>${typeof RARITY !== "undefined" ? `<p class="tierline q-${RARITY.of(r.item, r)}">${esc(RARITY.line(r.item, r))}</p>` : ""}${info ? `<p class="sub">${esc(info)}</p>` : ""}
      <dl class="ft-stats">${st.map(([k, v]) => `<dt>${esc(k)}</dt><dd class="num">${esc(v)}</dd>`).join("")}</dl>${r.shown ? `<p class="sub">\uE18C In your display case.</p>` : ""}<div class="sky-acts hs-acts">${acts.join("")}</div></div>`;
  }
  /* the whole container menu, placed in the home page */
  function panel(s, esc = E, iconFn) {
    if (iconFn) icon = iconFn;
    const list = rows(s, ui.side, ui.cat, ui.sort, ui.dir), cnt = counts(s, ui.side), nC = chestOf(s).length, nP = rows(s, "pack").length;
    if (ui.cat !== "all" && !cnt[ui.cat]) { ui.cat = "all"; return panel(s, esc); }
    const sel = list.find((x) => String(x.key) === String(ui.sel)) || null; if (!sel) ui.sel = null;
    const badge = (n) => (typeof MENUS2 !== "undefined" ? MENUS2.badge(n) : n ? ` <b class="m2-n">${n}</b>` : "");
    const statH = { weapons: "Dmg", apparel: "Armor", potions: "Power" }[ui.cat] || "Stat", L = load(s);
    const head = `<div class="sky-head hs-cols"><button data-act="hstash2" data-op="sort" data-id="name">Name</button><button data-act="hstash2" data-op="sort" data-id="stat">${statH}</button><button data-act="hstash2" data-op="sort" data-id="weight">Wt</button><button data-act="hstash2" data-op="sort" data-id="value">Value</button></div>`;
    const body = list.map((x) => `<button class="sky-row hs-cols ${String(x.key) === String(ui.sel) ? "sel" : ""}" data-act="hstash2" data-op="sel" data-id="${x.key}" aria-pressed="${String(x.key) === String(ui.sel)}"><span class="nm q-${typeof RARITY !== "undefined" ? RARITY.of(x.r.item, x.r) : "common"}${x.r.stolen ? " is-stolen" : ""}">${ico(x.r, 24)}<span class="hs-nm">${x.r.shown ? "\uE18C " : ""}${esc(x.name)}${x.qty > 1 ? ` <i>(${x.qty})</i>` : ""}${x.it.enchant || x.it.aenchant ? ' <i class="ench">✦</i>' : ""}${typeof RARITY !== "undefined" ? RARITY.tag(x.r.item, x.r) : ""}${x.r.stolen ? ' <i class="stolen">\uE15E</i>' : ""}</span></span><span class="num">${x.stat ?? "–"}</span><span class="num">${fmtW(x.weight)}</span><span class="num">${x.value}</span></button>`).join("")
      || `<p class="sub sky-empty">${ui.side === "pack" ? "Nothing loose in your pack (worn gear stays on you)." : "The chest is empty. Switch to Your pack to put things away."}</p>`;
    return `<div class="hs-box" id="homechest">
      <div class="seg hs-side" role="tablist" aria-label="Chest or pack">${[["chest", "Chest", nC], ["pack", "Your pack", nP]].map(([k, l, n]) => `<button class="${ui.side === k ? "on" : ""}" role="tab" aria-selected="${ui.side === k}" data-act="hstash2" data-op="side" data-id="${k}"><span>${l}</span> <b class="num">${n}</b></button>`).join("")}</div>
      <p class="sub hs-wt"><span>Your load</span> <b class="num ${L.now > L.cap ? "danger-high" : ""}">${L.now}/${L.cap}</b> · <span>In the chest</span> <b class="num">${fmtW(chestWeight(s))}</b></p>
      <div class="sky-cats hs-cats" role="tablist">${CATS.filter(([k]) => k === "all" || cnt[k]).map(([k, l]) => `<button class="sky-cat ${k === ui.cat ? "on" : ""}" data-act="hstash2" data-op="cat" data-id="${k}" role="tab" aria-selected="${k === ui.cat}" aria-label="${l}">${icon(k)}<span>${l}</span>${badge(cnt[k] || 0)}</button>`).join("")}</div>
      ${sortBar()}${head}<div class="sky-list hs-list">${body}</div>${detail(s, sel, esc)}</div>`;
  }
  return { CATS, SORTS, catOf, statOf, worn, rows, sortRows, counts, chestWeight, load, act, moved, panel, ui };
})();
if (typeof module !== "undefined") module.exports = HSTASH;
