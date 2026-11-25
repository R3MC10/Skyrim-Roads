/* pausemenu.js: the Esc menu on a PC, like Skyrim's. [OURS]
   Esc goes back one step at a time (the same steps as the phone's back button, ui.js __ui.back); once there's nothing
   left to close, Esc opens this menu: Resume, Settings, Journal, Patch notes, How to play, Report a problem,
   Save and quit to the title, and Quit game in the Windows app. Esc again (or Resume) closes it.
   - it only covers the screen: the world keeps going and nobody else in a party or online is paused
   - in a fight it opens on top of the fight and nothing in it flees or ends the fight (quitting waits until it's over)
   - arrows / W S move, Enter or Space picks, Home/End jump; mouse and touch work too
   PAUSEM.items(ctx) is the pure list (tested in node). */
const PAUSEM = (() => {
  const DOM = typeof document !== "undefined" && typeof document.createElement === "function";
  const T = (en) => { try { if (typeof I18N !== "undefined" && I18N.lang() === "pl" && typeof I18N_EXTRA !== "undefined" && I18N_EXTRA.words[en]) return I18N_EXTRA.words[en]; } catch { /* English */ } return en; };
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* is this the Windows app (Electron)? only there can the game close its own window */
  function desktopApp() { try { return /Electron/i.test(navigator.userAgent || "") && typeof window.close === "function"; } catch { return false; } }

  /* the menu for this moment: ctx = { fight, report, desktop, notes } */
  function items(ctx = {}) {
    const L = [{ id: "resume", label: "Resume" }, { id: "settings", label: "Settings" }];
    if (!ctx.fight) L.push({ id: "journal", label: "Journal" });
    if (ctx.notes !== false) L.push({ id: "notes", label: "Patch notes" });
    if (!ctx.fight) L.push({ id: "help", label: "How to play" });
    if (ctx.report) L.push({ id: "report", label: "Report a problem" });
    L.push({ id: "title", label: "Save and quit to title", off: !!ctx.fight });
    if (ctx.desktop) L.push({ id: "quit", label: "Quit game", off: !!ctx.fight });
    return L;
  }
  /* moving the highlight: skips greyed rows, wraps around */
  function step(list, i, d) {
    const n = list.length; if (!n) return -1;
    for (let k = 1; k <= n; k++) { const j = (((i + d * k) % n) + n) % n; if (!list[j].off) return j; }
    return i;
  }

  // ------------------------------------------------------------ on screen
  let el = null, list = [], at = 0, before = null;
  const isOpen = () => !!(DOM && el && el.isConnected);
  const inFight = () => typeof TB !== "undefined" && !!TB.open;
  function ctxNow() {
    return { fight: inFight(), report: typeof BUGREPORT !== "undefined", desktop: desktopApp(), notes: typeof PATCHNOTES !== "undefined" };
  }
  function render() {
    const ctx = ctxNow(); list = items(ctx);
    if (at < 0 || at >= list.length || list[at].off) at = 0;
    el.innerHTML = `<div class="pm-box" role="dialog" aria-modal="true" aria-labelledby="pmh">
      <h2 id="pmh" class="pm-h">${esc(T("Paused"))}</h2>
      <div class="pm-list" role="menu">${list.map((x, i) => `<button type="button" role="menuitem" class="pm-it${i === at ? " on" : ""}" data-pm="${x.id}" data-i="${i}"${x.off ? ' disabled aria-disabled="true"' : ""} tabindex="${i === at ? 0 : -1}">${esc(T(x.label))}</button>`).join("")}</div>
      <p class="pm-foot">${esc(T(ctx.fight ? "The fight waits for you: nothing here makes you flee. Finish it before you quit." : "The world keeps going while this is open: nobody else is paused."))}</p>
      <p class="pm-keys">${esc(T("Esc: back to the game"))}</p></div>`;
    focus();
  }
  function focus() {
    if (!isOpen()) return;
    el.querySelectorAll(".pm-it").forEach((b, i) => { const on = i === at; b.classList.toggle("on", on); b.tabIndex = on ? 0 : -1; });
    el.querySelectorAll(".pm-it")[at]?.focus?.({ preventScroll: true });
  }
  function open() {
    if (!DOM || isOpen()) return false;
    before = document.activeElement;
    el = document.createElement("div"); el.id = "pausem"; el.className = "pausem";
    at = 0; document.body.appendChild(el); render();
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pm]");
      if (b) { if (!b.disabled) pick(b.dataset.pm); return; }
      if (e.target === el) close();   // a click on the dimmed backdrop
    });
    el.addEventListener("pointermove", (e) => { const b = e.target.closest?.(".pm-it"); if (b && !b.disabled && +b.dataset.i !== at) { at = +b.dataset.i; focus(); } });
    try { if (typeof SOUND !== "undefined") SOUND.fx("page"); } catch { /* quiet */ }
    return true;
  }
  function close() {
    if (!isOpen()) return false;
    el.remove(); el = null;
    try { if (before && before.isConnected && before.focus) before.focus({ preventScroll: true }); } catch { /* fine */ }
    before = null;
    return true;
  }
  /* things opened from the menu during a fight sit above the fight screen */
  function lift(sel) { if (inFight()) setTimeout(() => document.querySelector(sel)?.classList.add("pm-top"), 0); }
  function pick(id) {
    const U = window.__ui || {};
    try { if (typeof SOUND !== "undefined") SOUND.fx("click"); } catch { /* quiet */ }
    if (id === "resume") return void close();
    if (id === "title" || id === "quit") { if (inFight()) return; close(); return void (id === "quit" ? quit() : U.toTitle?.()); }
    close();
    if (id === "settings") { U.settings?.(); lift("#modal"); }
    else if (id === "journal") U.go?.("log");
    else if (id === "notes") { U.notes?.(); lift("#modal"); }
    else if (id === "help") U.guide?.();
    else if (id === "report") { if (typeof BUGREPORT !== "undefined") BUGREPORT.open(); lift("#bugrep"); }
  }
  function quit() {
    try { window.__ui?.save?.(); } catch { /* still quit */ }
    setTimeout(() => { try { window.close(); } catch { /* the window stays */ } }, 150);
  }
  /* keys while it's open: it has them all (the fight, the map and the compass don't see them) */
  function onKey(e) {
    if (!isOpen()) return;
    const k = e.key;
    if (k === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) close(); return; }
    if (k === "F12") { close(); return; }   // the report window still opens (in place of this menu)
    if (k === "Tab") { e.preventDefault(); e.stopImmediatePropagation(); at = step(list, at, e.shiftKey ? -1 : 1); focus(); return; }
    const kl = String(k || "").toLowerCase();
    let d = 0;
    if (kl === "arrowdown" || kl === "s") d = 1; else if (kl === "arrowup" || kl === "w") d = -1;
    if (d) { e.preventDefault(); e.stopImmediatePropagation(); at = step(list, at, d); focus(); return; }
    if (kl === "home" || kl === "end") { e.preventDefault(); e.stopImmediatePropagation(); at = kl === "home" ? step(list, -1, 1) : step(list, list.length, -1); focus(); return; }
    if (kl === "enter" || kl === " " || kl === "spacebar") { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat && list[at] && !list[at].off) pick(list[at].id); return; }
    e.stopImmediatePropagation();   // nothing else reacts while paused (hotkeys, fight keys, map panning)
  }
  if (DOM && typeof addEventListener === "function") addEventListener("keydown", onKey, true);

  return { items, step, open, close, isOpen, pick, desktopApp, onKey };
})();
if (typeof module !== "undefined") module.exports = PAUSEM;
