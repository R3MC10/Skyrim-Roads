/* uinordic.js: the Nordic UI look's little helper. [OURS]
   The bronze slider track (index.html, [uinordic]) is gold up to the knob: each range input carries how full it is
   in --fill. Set on every input and whenever new sliders appear on screen. */
const UINORDIC = (() => {
  const fill = (el) => {
    const min = +el.min || 0, max = el.max === "" ? 100 : +el.max, v = +el.value;
    el.style.setProperty("--fill", (max > min ? ((v - min) / (max - min)) * 100 : 0).toFixed(1) + "%");
  };
  const scan = (root) => { try { root.querySelectorAll?.("input[type=range]").forEach(fill); } catch (e) { /* never break the game */ } };
  function start() {
    if (typeof document === "undefined") return;
    document.addEventListener("input", (e) => { if (e.target?.type === "range") fill(e.target); }, true);
    document.addEventListener("change", (e) => { if (e.target?.type === "range") fill(e.target); }, true);
    let t = 0;
    new MutationObserver(() => { if (!t) t = setTimeout(() => { t = 0; scan(document); }, 60); }).observe(document.body, { childList: true, subtree: true });
    scan(document);
  }
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start(); }
  return { fill, scan };
})();
if (typeof module !== "undefined") module.exports = UINORDIC;
