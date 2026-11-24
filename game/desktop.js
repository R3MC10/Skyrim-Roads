/* desktop.js: on a PC (or any keyboard), Esc works like the phone's back button: closes the top menu or window,
   one step at a time. It never quits the game; at the main screen it does nothing. */
(function () {
  if (typeof addEventListener !== "function" || typeof document === "undefined") return;
  addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented || e.repeat) return;
    if (document.getElementById("nickbox")) return;   // the nickname box must be answered
    e.preventDefault();
    try { window.__ui?.back?.(); } catch (x) { /* nothing to close */ }
  });
  /* hotkeys: a letter opens its tab (the letters show on the tabs), Tab opens or closes the compass menu
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
    const id = Object.keys(keys).find((k) => keys[k] === String(e.key).toUpperCase()); if (!id) return;
    const b = document.querySelector(`#tabs [data-tab="${id}"]`); if (!b) return;
    e.preventDefault();
    if (document.getElementById("tw") && typeof TABMENU !== "undefined") { try { TABMENU.closeHub(); } catch (x) { /* ignore */ } }
    b.click();
  });
})();
