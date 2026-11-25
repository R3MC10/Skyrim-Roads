/* fabdodge.js: the round star button floats over the page (the compass button went in the five-tabs update).
   While the page scrolls they fade out of the way, so nothing stays hidden under them. */
(function () {
  if (typeof addEventListener !== "function" || typeof document === "undefined") return;
  let t = 0;
  const calm = () => document.body.classList.remove("fab-away");
  function moved() {
    if (!document.body) return;
    document.body.classList.add("fab-away");
    clearTimeout(t); t = setTimeout(calm, 700);
  }
  addEventListener("scroll", moved, { passive: true, capture: true });
})();
