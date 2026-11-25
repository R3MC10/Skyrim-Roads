/* Menus open at the top. On a phone the tab screens sit under the map, so a new tab or sub-tab used to start
   wherever the page happened to be (half way down an old list, or on the map with the screen out of sight).
   Now: a new screen starts at its top; the same screen drawn again (you equipped, sold, took a perk) keeps your place.
   The item/spell list does the same: a new category starts at the top, picking or equipping keeps the row in view.
   Windows open at their top too (their first button gets focus without scrolling to it). [OURS] */
const MENUTOP = (() => {
  const live = typeof document !== "undefined" && typeof document.addEventListener === "function";

  // ------------------------------------------------------------ pure helpers (tested in node)
  /* the key of one screen: tab plus the sub-tab bits that swap the whole screen */
  const panelKey = (tab, ...subs) => [tab, ...subs].map((x) => x ?? "").join("|");
  /* the key of one item/spell list: a different list (page, category, tier, search, sort) starts at the top */
  const listKey = (sky) => sky ? [sky.page, sky.cat, sky.tier || "all", sky.q || "", sky.sort || "", sky.dir || 1, sky.msort || ""].join("|") : "";
  /* where the window goes for a fresh screen: the top of #side (on a phone it sits under the map; "show the map" buttons scroll up to it themselves) */
  const target = (sideTop, scrollY) => Math.max(0, Math.round(sideTop + scrollY));

  // ------------------------------------------------------------ browser
  const pcLayout = () => live && document.documentElement.classList.contains("pcmap");
  const charPage = () => live && document.body.classList.contains("tw-char");
  /* call before #side is redrawn: true when this is a different screen from the one shown (and resets #side's own scroll) */
  function fresh(side, key) {
    if (!side) return false;
    const was = side.dataset.mtKey; side.dataset.mtKey = key;
    if (was === key) return false;
    side.scrollTop = 0;   // the PC side panel and the phone's full-screen Skills page scroll inside #side
    return true;
  }
  /* after a fresh screen is drawn: bring its top into view */
  function top() {
    if (!live) return;
    const side = document.getElementById("side"); if (!side) return;
    side.scrollTop = 0;
    if (pcLayout()) return;   // on a PC the page itself doesn't scroll
    if (charPage()) { window.scrollTo(0, 0); return; }
    let off = 0; for (let e = side; e; e = e.offsetParent) off += e.offsetTop;   // layout position: a panel sliding in (a transform) doesn't count
    const y = target(off, 0);
    if (Math.abs((window.scrollY || 0) - y) > 1) window.scrollTo({ top: y, behavior: "auto" });
  }
  /* call before the item/spell menu is redrawn; call what it returns after: the same list keeps its place, a new list starts at the top */
  function keepList(el, sky) {
    const key = listKey(sky), same = el.dataset.mtKey === key;
    const y = same ? el.querySelector(".sky-list")?.scrollTop || 0 : 0;
    el.dataset.mtKey = key;
    return () => { const l = el.querySelector(".sky-list"); if (l) l.scrollTop = y; };
  }
  /* a new window: focus its first control without scrolling the window down to it */
  function focusFirst(root, sel = "button") {
    const b = root?.querySelector(sel); if (!b) return;
    try { b.focus({ preventScroll: true }); } catch { b.focus(); }
    const sc = root.querySelector(".sheet") || root; sc.scrollTop = 0;
  }
  return { panelKey, listKey, target, fresh, top, keepList, focusFirst };
})();
if (typeof module !== "undefined") module.exports = MENUTOP;
