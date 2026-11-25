/* The fight screen on a phone. [OURS] (phonefight)
   Design critique (25 Nov 2026): "on a 390x844 phone the fight is cramped: foe cards, the action tray, the log and the
   fight tips overlap or push buttons off screen". combat2.js lays the immersive fight out, foepanel.js places the foe's
   plate and the log; this runs after both, only on the tall (phone) layout (not .c2wide, so PCs are untouched):
   - The fight log folds: by default it shows only the newest line; the small arrow beside it opens the last few lines
     (and folds them again). Your choice is remembered on this device. Tapping the log itself still opens the full log.
   - The foe's health shows as numbers under its bar all the time (on a PC they show on hover), in a readable size.
   - The move buttons keep their 44px+ size (index.html CSS) and the dock stays at the bottom; fight tips
     (onboard.js) already keep clear of the dock, phonefight_ui.py checks it.
   - Every screen size: each status icon (fxicons.js, on the foe's plate, your orb and party plates) shows its stack
     count or turns left as a readable badge; the classic fight screen's chips (tbfight.js, fightread.js) got the
     missing stacking statuses with their numbers too. Owner: "statuses should show their stack numbers".
   The CSS sits at the end of index.html ("phonefight"). */
const PHONEFIGHT = (() => {
  const DOM = typeof document !== "undefined";
  const T = (t) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(t) : t);
  const KEY = "rotn_pfflog";
  let logOpen = null;

  function isOpen() {
    if (logOpen == null) { try { logOpen = localStorage.getItem(KEY) === "1"; } catch { logOpen = false; } }
    return logOpen;
  }
  function setOpen(v) {
    logOpen = !!v;
    try { localStorage.setItem(KEY, logOpen ? "1" : "0"); } catch { /* remembered for this session only */ }
  }
  /* the tall fight layout: phones (and narrow windows) */
  const phone = (el) => !!el && el.classList.contains("c2") && !el.classList.contains("c2wide");

  function label(b) {
    const o = isOpen();
    b.setAttribute("aria-expanded", String(o));
    b.setAttribute("aria-label", T(o ? "Fold the fight log" : "Show more of the fight log"));
  }
  /* the arrow sits at the log's top-left corner; the log keeps room for it (CSS padding) */
  function place(el) {
    if (!DOM || !el) return;
    const ov = el.querySelector(".c2ov"), b = ov && ov.querySelector(".pff-lt"), lg = ov && ov.querySelector(".tblog");
    if (!b) return;
    if (!phone(el) || !lg || lg.hidden || !lg.offsetHeight) { b.hidden = true; return; }
    b.hidden = false;
    const line = Math.min(lg.offsetHeight, 22);
    b.style.left = Math.round(lg.offsetLeft - 9) + "px";
    b.style.top = Math.round(lg.offsetTop + line / 2 - 22) + "px";
  }
  /* after each redraw (tbfight.js, after foepanel.js) */
  function decorate(el) {
    if (!DOM || !el) return;
    const ph = phone(el);
    el.classList.toggle("pff", ph);
    el.classList.toggle("pff-log", ph && isOpen());
    const ov = el.querySelector(".c2ov"); if (!ov) return;
    ov.querySelector(".pff-lt")?.remove();
    const lg = ov.querySelector(".tblog");
    if (!ph || !lg || lg.hidden) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "pff-lt"; b.dataset.pff = "log";
    b.innerHTML = '<i aria-hidden="true"></i>';
    label(b);
    b.addEventListener("click", (ev) => {
      ev.stopPropagation(); ev.preventDefault();
      setOpen(!isOpen()); el.classList.toggle("pff-log", isOpen()); label(b);
      const l = el.querySelector(".c2ov .tblog"); if (l) l.scrollTop = l.scrollHeight;
      if (typeof COMBAT2 !== "undefined" && COMBAT2.place) COMBAT2.place(el); else place(el);
    });
    ov.appendChild(b);
    // the log's height just changed with the fold: let foepanel.js find its corner again, then put the arrow on it
    if (typeof COMBAT2 !== "undefined" && COMBAT2.place) { try { COMBAT2.place(el); } catch { place(el); } } else place(el);
  }
  return { decorate, place, phone, isOpen, setOpen };
})();
if (typeof module !== "undefined") module.exports = PHONEFIGHT;
