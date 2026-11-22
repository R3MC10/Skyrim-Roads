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
})();
