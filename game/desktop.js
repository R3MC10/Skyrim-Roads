/* desktop.js: on a PC (or any keyboard), Esc works like the phone's back button: closes the top tooltip, window,
   menu or the compass, one step at a time (ui.js __ui.back, the same steps as Android's back button). With nothing
   left to close (the bare map, or a fight) it opens the Esc menu (pausemenu.js); Esc again closes that.
   In a text box Esc only clears a search or leaves the box. It never quits the game by itself. */
(function () {
  if (typeof addEventListener !== "function" || typeof document === "undefined") return;
  addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented || e.repeat) return;
    if (document.getElementById("nickbox")) return;   // the nickname box must be answered
    const t = e.target, tag = (t && t.tagName) || "";
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || t?.isContentEditable) {   // typing: clear a search box, else just leave the box
      e.preventDefault();
      if (tag === "INPUT" && t.type === "search" && t.value) { t.value = ""; t.dispatchEvent(new Event("input", { bubbles: true })); } else t.blur?.();
      return;
    }
    e.preventDefault();
    let r = true;
    try { r = window.__ui?.back?.({ esc: true }); } catch (x) { /* nothing to close */ }
    if (r === false && typeof PAUSEM !== "undefined" && window.__ui?.inGame?.()) PAUSEM.open();
  });
  /* hotkeys: a letter or 1-5 opens its tab (the letters show on the tabs, both in their tooltips: M World, A Area,
     C Hero, J Journal, O Social; I Items, P Magic), Tab opens or closes the compass menu
     (inside it W A S D / the arrows pick a direction and 1-5 the buttons below: tabmenu.js) */
  addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target, tag = (t && t.tagName) || "";
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || t?.isContentEditable) return;   // typing a name or a chat line
    if (document.getElementById("nickbox") || document.getElementById("title") || document.getElementById("tbf") || document.getElementById("tbwatch")) return;
    if (document.querySelector("#lockpick, #pickgame, #dgame, #dgwatch, .lockpick")) return;   // a minigame has the keys
    if (e.key === "Tab") {
      if (typeof TABMENU === "undefined") return;
      e.preventDefault();
      try { document.getElementById("tw") ? TABMENU.closeHub() : TABMENU.openHub(); } catch (x) { /* no menu right now */ }
      return;
    }
    const keys = typeof MENUS !== "undefined" ? MENUS.HOTKEYS : null; if (!keys) return;
    const inner = { I: "items", P: "magic" }[String(e.key).toUpperCase()];   // Items and Magic live under Hero now (tabs5); their old letters still open them
    if (inner && window.__ui?.go && window.__ui?.inGame?.()) { e.preventDefault(); try { window.__ui.go(inner); } catch (x) { /* not now */ } return; }
    const nth = /^[1-9]$/.test(e.key) && !document.getElementById("tw") ? MENUS.GROUPS[+e.key - 1]?.[0] : null;   // 1-5: the five tabs in bar order (the compass uses 1-9 for its own buttons)
    const id = nth || Object.keys(keys).find((k) => keys[k] === String(e.key).toUpperCase()); if (!id) return;
    const b = document.querySelector(`#tabs [data-tab="${id}"]`); if (!b) return;
    e.preventDefault();
    if (document.getElementById("tw") && typeof TABMENU !== "undefined") { try { TABMENU.closeHub(); } catch (x) { /* ignore */ } }
    b.click();
  });
})();
