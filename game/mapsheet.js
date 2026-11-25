/* mapsheet.js: one SkyUI-style panel for everything you tap on the map. [OURS]
   A caravan (wagons.js), a place, a pin or a spot in the wilds (ui.js renderPicked), another hero (greet.js) all open in it.
   - PC map: docked on the right, full height between the top bar and the bottom nav; the quest tracker and the map
     buttons move aside (html.wg-open, CSS in index.html). Phones / narrow windows: a sheet sitting on top of the bottom
     nav bar, never under it.
   - Header (icon + title + subtitle, optional extra line) stays put; the body (info rows, big action rows with a
     sub-line, anything extra) scrolls.
   - One at a time: opening another marker swaps the content (the old owner hears onClose("swap")). Opening the same id
     again refreshes it and keeps your place in the list.
   - X, Esc and the Android back button (ui.js back()) close it.
   MAPSHEET.open({ id, owner, domId, decision, label, icon, title, sub, head, rows: [[label, value, cls]], pre, actions:
     [{ act, label, sub, pri, danger, off, data: {k: v} }], post, onClick(e, button), onClose(why) }) */
const MAPSHEET = (() => {
  const live = typeof document !== "undefined" && typeof document.createElement === "function";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const T = (en, v) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(en, v) : v ? en.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : en);
  let cur = null, el = null, bound = false;

  /* the HTML pieces, also used by owners that want a row or a button somewhere else */
  const row = (k, v, cls = "") => `<div class="wg-row"><span>${esc(k)}</span><b class="${esc(cls)}">${esc(v)}</b></div>`;
  function btn(a) {
    const data = Object.entries(a.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
    return `<button class="wg-act${a.pri ? " pri" : ""}${a.danger ? " danger" : ""}"${a.act ? ` data-wg="${esc(a.act)}"` : ""}${data}${a.off ? " disabled" : ""}><span>${esc(a.label)}</span>${a.sub ? `<small>${esc(a.sub)}</small>` : ""}</button>`;
  }
  function html(sp) {
    const rows = (sp.rows || []).filter(Boolean).map((r) => row(r[0], r[1], r[2])).join("");
    const acts = (sp.actions || []).filter(Boolean);
    return `<div class="wg-top"><button class="iconbtn wg-x" data-wg="x" aria-label="${esc(T("Close"))}">✕</button>
      <div class="wg-h">${sp.icon ? `<span class="wg-pic">${sp.icon}</span>` : ""}<div><b>${esc(sp.title)}</b>${sp.sub ? `<span>${esc(sp.sub)}</span>` : ""}</div></div>${sp.head || ""}</div>
      <div class="wg-body">${sp.pre || ""}${rows}${acts.length ? `<div class="wg-acts">${acts.map(btn).join("")}</div>` : ""}${sp.post || ""}</div>`;
  }

  function bind() {
    if (bound || !live) return; bound = true;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && cur && !e.defaultPrevented && !document.querySelector("#modal, #sky, #pausem")) { e.preventDefault(); close(); } });   // Esc closes the panel and nothing else (desktop.js skips a handled Esc)
    addEventListener("resize", () => { if (el && cur) place(el); });
  }
  function onClick(e) {
    const b = e.target.closest("button"); if (!b || b.disabled || !cur) return;
    if (b.dataset.wg === "x") { e.stopPropagation(); if (typeof SOUND !== "undefined") try { SOUND.fx("click"); } catch (er) { /* ignore */ } return close(); }
    cur.onClick?.(e, b);
  }
  function open(sp) {
    if (!live || !sp) return null;
    bind();
    const same = cur && el && el.isConnected && cur.id === sp.id, old = same ? null : cur;
    if (!same) {
      el?.remove();
      el = document.createElement("div"); el.className = "wgcard mpanel"; el.setAttribute("role", "dialog"); el.onclick = onClick;
      document.body.appendChild(el);
    }
    cur = sp;
    /* the old owner tidies up after the swap (it can ask isOpen(itsOwner): true when the new panel is its own too) */
    if (old) try { old.onClose?.("swap"); } catch (er) { /* ignore */ }
    if (cur !== sp) return el;   // the old owner opened something else meanwhile
    el.id = sp.domId || "mapsheet";
    el.dataset.owner = sp.owner || "";
    el.setAttribute("aria-label", sp.label || sp.title || "");
    const keep = same ? el.querySelector(".wg-body")?.scrollTop || 0 : 0;   // a refresh (shared state, a purchase) keeps your place in the list
    el.innerHTML = html(sp);
    const body = el.querySelector(".wg-body"); if (body && keep) body.scrollTop = keep;
    place(el);
    document.documentElement.classList.add("wg-open");
    return el;
  }
  /* close the panel (only if it belongs to that owner, when one is named) */
  function close(owner) {
    if (!cur || (owner && cur.owner !== owner)) return false;
    const old = cur; cur = null;
    el?.remove(); el = null;
    if (live) document.documentElement.classList.remove("wg-open");
    try { old.onClose?.("close"); } catch (er) { /* ignore */ }
    return true;
  }
  /* PC map: a panel docked on the right (CSS). Anywhere else: a sheet sitting on top of the bottom nav bar, never under it */
  function place(p) {
    if (!p) return;
    const pc = document.documentElement.classList.contains("pcmap");
    p.classList.toggle("sheet", !pc);
    p.classList.toggle("wide", !pc && innerWidth >= 760);
    if (pc) { p.style.bottom = ""; p.style.maxHeight = ""; return; }
    let navTop = innerHeight;
    for (const n of document.querySelectorAll("#tabs, .tabs, .mn-bar")) {
      const r = n.getBoundingClientRect(), cs = getComputedStyle(n);
      if (r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden" && (cs.position === "fixed" || cs.position === "sticky") && r.top > innerHeight / 2) navTop = Math.min(navTop, r.top);
    }
    const bottom = Math.max(0, Math.round(innerHeight - navTop));
    p.style.bottom = bottom + "px";
    p.style.maxHeight = Math.max(240, Math.min(Math.round(innerHeight * 0.72), navTop - 56)) + "px";
  }
  const isOpen = (owner) => !!cur && (!owner || cur.owner === owner);
  return { open, close, isOpen, place: () => place(el), current: () => cur, el: () => el, row, btn, html, esc };
})();
if (typeof module !== "undefined") module.exports = MAPSHEET;
