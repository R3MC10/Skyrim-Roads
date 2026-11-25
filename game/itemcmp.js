/* itemcmp.js: an item next to what you wear in the same place. [itemdetail]
   Used by the Items details panel (ui.js itemDetail) and the item tooltip / phone sheet (tooltip.js itemHTML).
   "Against what you wear: Iron Sword" then Damage 7 → 8 (+1), Weight 9 → 10 (+1), Value 25 → 45 (+20):
   better green, worse red. Damage is what it really hits for in your hands (skill and perks, the "Hits for about N"
   number), armour is the piece's rating plus any improvement. A two-handed weapon is compared against both hands
   (your weapon and your shield or left-hand weapon); a ring against your rings (a free finger counts as nothing worn). */
const ITEMCMP = (() => {
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const mod = (n) => { try { return { D: typeof D !== "undefined" ? D : undefined, G: typeof G !== "undefined" ? G : undefined, F: typeof F !== "undefined" ? F : undefined }[n]; } catch { return undefined; } };

  /* what a weapon hits for in your hands: the same sum as the fight (engine.js weaponDamage, without the dice) */
  function hits(s, itemId, r = null) {
    const D_ = mod("D"), G_ = mod("G"), F_ = mod("F"), it = D_?.ITEMS?.[itemId];
    if (!it || it.slot !== "weapon" || it.staff || !it.damage) return 0;
    try {
      const sk = it.skill, lv = s && G_?.skill ? G_.skill(s, sk) : 15, P = (k) => (s && G_?.P ? G_.P(s, k) : 0);
      const perk = { "One-Handed": 0.2 * P("armsman"), "Two-Handed": 0.2 * P("barbarian"), "Archery": 0.2 * P("overdraw"), "Spear": 0.15 * P("long_reach") }[sk] || 0;
      return Math.round(F_.weaponDamage(it.damage + (r?.temper || 0), lv, sk === "Archery") * (1 + perk));
    } catch { return it.damage + (r?.temper || 0); }
  }
  const armorOf = (it, r) => (it ? (it.armor || 0) + (r?.temper || 0) : 0);

  /* the worn rows this item would replace: [] = nothing worn there; null = not something you wear */
  function worn(s, row) {
    const D_ = mod("D"), G_ = mod("G"); if (!s || !row || !D_ || !G_?.equipment) return null;
    const it = D_.ITEMS[row.item]; if (!it || !(G_.SLOTS || []).includes(it.slot)) return null;
    let eq; try { eq = G_.equipment(s); } catch { return null; }
    const lo = (() => { try { return G_.loadout ? G_.loadout(s).equipment : {}; } catch { return {}; } })();
    const off = lo.offhand != null ? (s.inv || []).find((x) => x.id === lo.offhand) : null;
    if (it.slot === "ring") { if (!eq.ring || !eq.ring2) return []; return [eq.ring]; }   // a free finger: nothing to give up
    if (it.slot === "weapon") {
      const main = eq.weapon ? [eq.weapon] : [];
      if (it.hands === 2) return [...main, ...(eq.shield ? [eq.shield] : off && off.id !== eq.weapon?.id ? [off] : [])];
      return main;
    }
    if (it.slot === "shield" && eq.weapon && D_.ITEMS[eq.weapon.item]?.hands === 2) return [];   // a two-hander leaves no hand for it
    return eq[it.slot] ? [eq[it.slot]] : [];
  }

  /* { wearing, names, rows: [[label, now, with, higherIsBetter]] } or null */
  function data(s, row) {
    const D_ = mod("D"); const w = worn(s, row); if (!w) return null;
    if (w.some((x) => x.id === row.id)) return { wearing: true, names: [], rows: [] };
    const it = D_.ITEMS[row.item], items = w.map((x) => [x, D_.ITEMS[x.item]]).filter(([, x]) => x);
    const rows = [];
    if (it.slot === "weapon") {
      const mainW = items.find(([, x]) => x.slot === "weapon");
      if (!it.staff) rows.push(["Damage", mainW ? hits(s, mainW[0].item, mainW[0]) : 0, hits(s, row.item, row), true]);
      const sh = items.find(([, x]) => x.slot === "shield");
      if (sh) rows.push(["Armor", armorOf(sh[1], sh[0]), 0, true]);   // the shield comes off for a two-hander
    } else if ((mod("G")?.ARMOR_SLOTS || []).includes(it.slot)) rows.push(["Armor", items.reduce((a, [x, i]) => a + armorOf(i, x), 0), armorOf(it, row), true]);
    const sum = (f) => +items.reduce((a, [x, i]) => a + f(i, x), 0).toFixed(2);
    rows.push(["Weight", sum((i) => i.weight || 0), +(it.weight || 0).toFixed(2), false], ["Value", sum((i) => i.value || 0), it.value || 0, true]);
    return { wearing: false, names: items.map(([x, i]) => (x.nm ? `${i.name} “${x.nm}”` : i.name)), rows };
  }

  /* the block as html (cls: extra class, e.g. "tt-cmp" inside the tooltip) */
  function html(s, row, cls = "") {
    const d = data(s, row); if (!d) return "";
    if (d.wearing) return `<p class="tt-eq ic-wearing">◆ ${esc("You're wearing this")}</p>`;
    if (!d.names.length) return `<div class="ic-cmp ${cls}"><p class="ic-h tt-up">${esc("Nothing worn there yet")}</p></div>`;
    const fmt = (n) => String(+(+n).toFixed(2));
    const lines = d.rows.map(([k, a, b, up]) => {
      const dv = +(b - a).toFixed(2), good = dv === 0 ? "" : (dv > 0) === up ? "ic-up tt-up" : "ic-dn tt-dn";
      return `<div class="ic-r ${good}"><span>${esc(k)}</span><b class="num">${fmt(a)} → ${fmt(b)}${dv ? ` (${dv > 0 ? "+" : ""}${fmt(dv)})` : ""}</b></div>`;
    }).join("");
    return `<div class="ic-cmp ${cls}"><p class="ic-h">${esc("Against what you wear:")} <b>${esc(d.names.join(" + "))}</b></p>${lines}</div>`;
  }

  /* ---- PC: the Items details sit in a side panel (index.html makes .sky-in a grid from 1000 px). Resting the mouse on a
     row shows that item there; a click pins it (ui.js sky.sel) until another row is clicked or Esc is pressed. The
     floating tooltip stays off for those rows, so nothing covers the list. */
  const DOM = typeof document !== "undefined" && typeof window !== "undefined";
  function side(sky) {
    if (!DOM || !sky) return false;
    const inn = sky.querySelector(".sky-in"); if (!inn) return false;
    try { return getComputedStyle(inn).display === "grid" && !!sky.querySelector(".sky-page.on[data-id=items]") && !sky.querySelector(".sky-doll"); } catch { return false; }
  }
  const finePointer = () => { try { return !!window.matchMedia?.("(hover: hover)").matches; } catch { return true; } };
  /* is this element an Items row whose details the side panel shows on hover? (tooltip.js stays quiet for it) */
  function ownsHover(el) {
    const row = el?.closest?.("#sky .sky-row[data-act=skysel]");
    return !!row && side(row.closest("#sky"));
  }
  /* api: { preview(id|null) } — ui.js swaps the details panel in place (the list keeps its scroll) */
  function bind(sky, api) {
    if (!DOM || !sky || sky.__icHover) return; sky.__icHover = true;
    let last = null, t = 0;
    const go = (id) => { if (id === last) return; last = id; clearTimeout(t); t = setTimeout(() => api.preview(id), id == null ? 120 : 0); };
    sky.addEventListener("pointerover", (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      if (!e.pointerType && !finePointer()) return;
      const row = e.target.closest?.(".sky-row[data-act=skysel]");
      if (!row || !side(sky)) return;
      go(row.dataset.id);
    });
    sky.addEventListener("pointerleave", () => { last = null; });   // leaving the menu keeps what's shown
  }

  return { hits, worn, data, html, side, ownsHover, bind };
})();
if (typeof module !== "undefined") module.exports = ITEMCMP;
