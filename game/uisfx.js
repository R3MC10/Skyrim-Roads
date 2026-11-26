/* Menu sounds: the game's many SOUND.fx("click") / ("page") calls stay as they are; this picks the right recorded
   menu sound for what was actually pressed (sfx-ui-*.mp3, listed in audio.json):
     ui-tap      lists, small buttons (the default)        ui-confirm  big buttons: Begin, Okay, the gold ones
     ui-close    back / close / cancel                     ui-open     a window or page opening (was "page")
     ui-tab      switching tabs                            ui-toggle   settings switches
     ui-deny     pressing a greyed-out button              ui-hover    mouse over a button (PC only)
     ui-tick / ui-grind  the volume sliders (uinordic.js)
   Without the files the "ui" family falls back to the old click (sound.js). Clicks with no recent press behind them
   (mini-games, timers, the lockpick) are left alone. Close buttons that used to be silent get their sound too. */
const UISFX = (() => {
  if (typeof SOUND === "undefined" || typeof document === "undefined" || typeof document.addEventListener !== "function") return { kind: () => null };
  const BTN = "button,[role=button],[role=tab],[role=switch],a[href],.btn,[data-act],[data-tab],summary,input[type=checkbox]";
  const CLOSE_TXT = /^(?:✕|×|✖|x|back|close|cancel|leave|not now|[‹←«].*)$/i;
  const CLOSE_LBL = /\b(?:close|back|cancel)\b/i;
  const CLOSE_CLS = /(?:^|\s)(?:back|close|pnback|pnx|invx|obx|bpx|ptx|rfnx|ls-wx)(?:\s|$)|-x(?:\s|$)/;
  const OK_TXT = /^(?:begin|okay|ok|confirm|accept|continue|start|yes)\b/i;
  function closeish(b) {
    if (CLOSE_CLS.test(b.className && b.className.baseVal != null ? b.className.baseVal : b.className || "")) return true;
    for (const v of Object.values(b.dataset || {})) if (v === "close" || v === "back" || v === "x") return true;
    if (CLOSE_LBL.test(b.getAttribute("aria-label") || b.getAttribute("title") || "")) return true;
    return CLOSE_TXT.test((b.textContent || "").trim());
  }
  /* which menu sound a press on el should make (null: not a menu control) */
  function kind(el) {
    const b = el && el.closest ? el.closest(BTN) : null;
    if (!b) return null;
    if (b.disabled || b.getAttribute("aria-disabled") === "true") return "ui-deny";
    if (closeish(b)) return "ui-close";
    if (b.dataset.act === "pref" || b.getAttribute("role") === "switch" || b.matches("input[type=checkbox]")) return "ui-toggle";
    if (b.matches("[data-tab],[role=tab],.mn-sub button,.tabs button,.seg button")) return "ui-tab";
    if (b.matches(".btn.pri:not(.sm),.fhbig") || OK_TXT.test((b.textContent || "").trim())) return "ui-confirm";
    return "ui-tap";
  }
  let press = null;   // { el, at, played }
  const recent = () => press && performance.now() - press.at < 700 ? press : null;
  const raw = SOUND.fx.bind(SOUND);
  SOUND.fx = function (name, delay) {
    const p = recent();
    if (p && (name === "click" || name === "page")) {
      const k = kind(p.el);
      if (k && k !== "ui-deny") { p.played = true; return raw(name === "page" ? "ui-open" : k, delay); }
    }
    if (p && name !== "ui-hover") p.played = true;   // some other sound (coin, quest …) answered the press
    return raw(name, delay);
  };
  const mark = (e) => { press = { el: e.target, at: performance.now(), played: false }; };
  document.addEventListener("pointerdown", (e) => {
    mark(e);
    if (kind(e.target) === "ui-deny") { press.played = true; raw("ui-deny"); }
  }, true);
  document.addEventListener("click", (e) => {
    if (!press || press.el !== e.target || performance.now() - press.at > 700) mark(e);   // keyboard / Enter
    const p = press;
    if (kind(e.target) === "ui-close") setTimeout(() => { if (!p.played) { p.played = true; raw("ui-close"); } }, 0);   // a close that made no sound
  }, true);
  /* PC hover: only a real mouse, only when it moves onto a new button */
  let hovered = null;
  const fine = () => { try { return matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) { return false; } };
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse" || !fine()) return;
    const b = e.target.closest ? e.target.closest(BTN) : null;
    if (b === hovered) return;
    hovered = b;
    if (b && !b.disabled && b.getAttribute("aria-disabled") !== "true" && !b.matches("input")) raw("ui-hover");
  }, true);
  return { kind };
})();
