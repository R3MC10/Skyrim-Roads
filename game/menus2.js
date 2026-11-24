/* menus2.js: tidier tab menus, SkyUI style. [OURS]
   - Items / Magic: one sort row (Name, Value, Weight, Damage, Armour… plus a ▲▼ direction toggle) instead of two,
     item counts on the category column, and the helpers ui.js uses to lay the menu out as
     categories | list | details (side by side on a wide screen, stacked on a phone).
   - Character: long sections fold away under one heading each (open/closed is remembered while you play).
   - Journal: a "Find a quest" box over the quest list.
   Nothing here changes game rules; ui.js still draws the rows and handles the taps. */
const MENUS2 = (() => {
  const live = typeof document !== "undefined" && typeof document.addEventListener === "function";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ------------------------------------------------------------ sorting (pure, tested in node)
  /* [key, label]. Damage only where weapons can show, Armour only where apparel can show. */
  const ITEM_SORTS = [["name", "Name"], ["value", "Value"], ["weight", "Weight"], ["dmg", "Damage"], ["arm", "Armour"], ["ratio", "Value/wt"], ["new", "Newest"]];
  const MAGIC_SORTS = [["name", "Name"], ["cost", "Cost"], ["school", "School"]];
  const TEXT_KEYS = new Set(["name", "school"]), LOW_FIRST = new Set(["cost"]);   // cheapest spells first, like before
  function itemSorts(cat) { return ITEM_SORTS.filter(([k]) => k === "dmg" ? ["all", "weapons"].includes(cat) : k === "arm" ? ["all", "apparel"].includes(cat) : true); }
  /* dir 1 = the natural way: A→Z for words, highest first for numbers; -1 flips it */
  function compare(k, dir) {
    return (a, b) => {
      if (TEXT_KEYS.has(k)) return String(a[k] ?? "").localeCompare(String(b[k] ?? "")) * dir || String(a.name).localeCompare(String(b.name));
      const x = a[k] ?? null, y = b[k] ?? null;
      if (x == null && y == null) return String(a.name).localeCompare(String(b.name));
      if (x == null) return 1; if (y == null) return -1;   // rows without that number go last either way
      return (y - x) * dir * (LOW_FIRST.has(k) ? -1 : 1) || String(a.name).localeCompare(String(b.name));
    };
  }
  /* sort item rows ({name, value, weight, dmg, arm, ratio, new, eq}); what you wear stays on top */
  function sortItems(rows, k, dir) { const c = compare(k, dir); return [...rows].sort((a, b) => (b.eq - a.eq) || c(a, b)); }
  function sortMagic(rows, k, dir) { return [...rows].sort(compare(k || "name", dir || 1)); }
  const dirLabel = (k, dir) => TEXT_KEYS.has(k) ? (dir > 0 ? "A–Z" : "Z–A") : (dir * (LOW_FIRST.has(k) ? -1 : 1) > 0 ? "High first" : "Low first");
  /* the one sort row: chips + a direction toggle */
  function sortBar(sorts, cur, dir, act, dirAct) {
    const k = sorts.some(([x]) => x === cur) ? cur : sorts[0][0];
    return `<div class="m2-sort" role="group" aria-label="Sort"><span class="m2-sl">Sort</span><div class="m2-sc">${sorts.map(([x, l]) => `<button class="chip ${x === k ? "on" : ""}" data-act="${act}" data-id="${x}" aria-pressed="${x === k}">${l}</button>`).join("")}</div>`
      + `<button class="m2-dir" data-act="${dirAct}" aria-label="Sort direction: ${dirLabel(k, dir)}" title="${dirLabel(k, dir)}"><b aria-hidden="true">${dir > 0 ? "▼" : "▲"}</b><span>${dirLabel(k, dir)}</span></button></div>`;
  }
  const itemSortBar = (sky) => sortBar(itemSorts(sky.cat), sky.sort, sky.dir || 1, "skysort", "m2dir");
  const magicSortBar = (sky) => sortBar(MAGIC_SORTS, sky.msort || "name", sky.mdir || 1, "skymsort", "m2mdir");
  /* how many things sit in each item category (for the badges on the category column) */
  function counts(inv, items, catOf) {
    const n = { all: 0 };
    for (const r of inv || []) { const it = items[r.item]; if (!it) continue; n.all++; const c = catOf(it); n[c] = (n[c] || 0) + 1; }
    return n;
  }
  const badge = (n) => n ? `<b class="m2-n" aria-hidden="true">${n > 99 ? "99+" : n}</b>` : "";
  /* the right-hand column when nothing is picked (wide screens only) */
  const pickHint = (page) => `<div class="m2-pick" aria-hidden="true"><p>${page === "magic" ? "Pick a spell, power or shout to read it here." : page === "skills" ? "Pick a skill to see what it does." : "Pick an item to see it here."}</p></div>`;

  // ------------------------------------------------------------ folding sections (Character)
  const DEFAULT_OPEN = { progress: true, effects: true, powers: false, skills: false, perks: false };
  const open = {};
  const isOpen = (id) => id in open ? open[id] : !!DEFAULT_OPEN[id];
  /* a panel whose body folds away under its heading. html is the body only. */
  function fold(id, title, html, note = "") {
    return `<details class="panel m2-fold" data-m2f="${esc(id)}" ${isOpen(id) ? "open" : ""}><summary><h2>${title}</h2>${note ? `<span class="m2-note">${note}</span>` : ""}</summary><div class="m2-body">${html}</div></details>`;
  }
  /* taps that should open a fold even when they come from elsewhere (Closest to going up → Skills) */
  const OPENS = { skinfo: "skills", pskill: "perks", perk: "perks", unlock: "powers", roadshout: "powers" };
  if (live) {
    document.addEventListener("toggle", (e) => { const d = e.target; if (d && d.dataset && d.dataset.m2f) open[d.dataset.m2f] = d.open; }, true);
    document.addEventListener("click", (e) => {
      const t = e.target && e.target.closest ? e.target : null; if (!t) return;
      const b = t.closest("[data-act]"), f = t.closest("details[data-m2f]");
      if (f && b) open[f.dataset.m2f] = true;
      if (b && OPENS[b.dataset.act] && t.closest("#side")) open[OPENS[b.dataset.act]] = true;
    }, true);
  }

  // ------------------------------------------------------------ Journal: find a quest
  let jq = "";
  function matches(text, q) { q = String(q || "").trim().toLowerCase(); return !q || String(text || "").toLowerCase().includes(q); }
  function filterJournal(root) {
    const box = root && root.querySelector("#j-quests"); if (!box) return 0;
    let shown = 0;
    box.querySelectorAll(".qcard").forEach((c) => { const on = matches(c.innerText || c.textContent, jq); c.classList.toggle("m2-hide", !on); if (on) shown++; });
    box.querySelectorAll(".list > .item").forEach((c) => c.classList.toggle("m2-hide", !matches(c.innerText || c.textContent, jq)));
    box.querySelectorAll("h3.qcat").forEach((h) => { let n = h.nextElementSibling, any = false; while (n && !n.matches("h3")) { if (!n.classList.contains("m2-hide") && !(n.matches(".list") && !n.querySelector(".item:not(.m2-hide)"))) any = true; n = n.nextElementSibling; } h.classList.toggle("m2-hide", !!jq && !any); });
    let none = box.querySelector(".m2-none");
    if (jq && !shown && !box.querySelector(".list > .item:not(.m2-hide)")) { if (!none) box.querySelector(".m2-jq")?.insertAdjacentHTML("afterend", `<p class="sub m2-none">No quest matches that.</p>`); }
    else none?.remove();
    return shown;
  }
  /* after #side is drawn */
  function afterPanel(tab, side) {
    if (!live || !side) return;
    if (tab === "log") {
      const seg = side.querySelector("#j-quests .jseg");
      if (seg && !side.querySelector("#m2jq")) seg.insertAdjacentHTML("afterend", `<input id="m2jq" class="uxsearch m2-jq" type="search" placeholder=" Find a quest" value="${esc(jq)}" autocomplete="off" aria-label="Find a quest">`);
      filterJournal(side);
    }
  }
  if (live) document.addEventListener("input", (e) => { if (e.target && e.target.id === "m2jq") { jq = e.target.value; filterJournal(document.getElementById("side")); } });

  return { ITEM_SORTS, MAGIC_SORTS, itemSorts, compare, sortItems, sortMagic, dirLabel, sortBar, itemSortBar, magicSortBar, counts, badge, pickHint, fold, isOpen, open, matches, filterJournal, afterPanel };
})();
if (typeof module !== "undefined") module.exports = MENUS2;
