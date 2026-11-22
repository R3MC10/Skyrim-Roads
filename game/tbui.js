/* Fight screen feel (tbfight.js draws the screen, this makes it play well). [OURS]
   Remigiusz: "combat needs an AAA overhaul, with buttons, combat logs and the battle itself" and "there should be nice
   drag mechanics for combat so it can also be played in one hand".
   - Drag an action card from the bottom dock onto its target: the foe (the battle scene or the foe's bar) for attacks and
     offensive spells, yourself (your bar) for guard, potions and healing. The target glows while you hold the card over it;
     let go anywhere else and the card slides back. A tap still works the same, so you never have to drag.
   - Everything you need sits in the bottom half, under your thumb.
   - Fight log lines: damage numbers stand out, crits and kills get their own colour, the newest line flashes.
   - Health bars leave a fading "ghost" of what was lost; the screen shakes and reddens when you take a big hit.
   - On a PC: number keys 1-9 use the action cards in order, L opens the full log. */
const TBUI = (() => {
  const DOM = typeof document !== "undefined";
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reduce = () => DOM && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* no vibration */ } };
  const ICON = { foe: "☠", me: "🛡", guard: "🛡", ally: "⚑", tick: "✶", end: "★" };

  /* one log line: an icon by who acted, numbers picked out, crits/kills/heals coloured */
  function logLine(e, fresh) {
    let t = esc(e.text);
    t = t.replace(/\b(critical|crit|sneak attack|finishing blow|power attack)\b/gi, '<em class="cr">$1</em>')
      .replace(/(\+\d+)/g, '<b class="nh">$1</b>')
      .replace(/(^|[^\w+-])(\d+)(?![\w%])/g, '$1<b class="nd">$2</b>');
    const k = e.kind || "me";
    return `<span class="tbl ${esc(k)}${fresh ? " fresh" : ""}"><span class="li" aria-hidden="true">${ICON[k] || "•"}</span><span class="lt">${t}</span></span>`;
  }

  /* after each redraw: let the ghost bars drain, shake on hits */
  function after(el, o) {
    if (!DOM || !el) return;
    const gh = el.querySelectorAll(".tbbar .gh[data-to]");
    if (gh.length) setTimeout(() => gh.forEach((g) => { g.style.width = g.dataset.to + "%"; }), reduce() ? 0 : 380);
    const stage = el.querySelector(".tbstage");
    if (stage && !reduce()) {
      if (o.hurt) { stage.classList.remove("hurt", "big"); void stage.offsetWidth; stage.classList.add("hurt"); if (o.big) { stage.classList.add("big"); buzz(30); } }
      else if (o.hit) { stage.classList.remove("struck"); void stage.offsetWidth; stage.classList.add("struck"); }
    }
    const lg = el.querySelector(".tblog"); if (lg) requestAnimationFrame(() => { lg.scrollTop = lg.scrollHeight; });
  }

  // ------------------------------------------------------------------ dragging action cards onto a target
  let d = null;
  const HINT = { foe: "Let go on the foe", self: "Let go on yourself" };
  function zoneAt(x, y) { const t = document.elementFromPoint(x, y); return t?.closest?.("[data-tbzone]") || null; }
  function down(ev) {
    const card = ev.target.closest?.("#tbf .tbact[data-tz]");
    if (!card || card.disabled || ev.button > 0) return;
    d = { card, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, on: false, zone: card.dataset.tz, hot: null };
  }
  function start(ev) {
    const root = document.getElementById("tbf"); if (!root) return (d = null);
    const r = d.card.getBoundingClientRect();
    const g = d.card.cloneNode(true); g.classList.add("tbghost"); g.removeAttribute("data-tba"); g.setAttribute("aria-hidden", "true");
    g.style.width = r.width + "px"; g.style.height = r.height + "px";
    d.dx = ev.clientX - r.left; d.dy = ev.clientY - r.top; d.r = r;
    document.body.appendChild(g); d.g = g;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "tbaim"); svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = '<path d=""/><circle r="7"/>'; document.body.appendChild(svg); d.svg = svg;
    d.card.classList.add("lifted"); root.classList.add("dragging", "dz-" + d.zone);
    root.querySelectorAll(`[data-tbzone="${d.zone}"]`).forEach((z) => z.classList.add("drop-ok"));
    const h = root.querySelector(".tbhint"); if (h) h.textContent = HINT[d.zone] || "";
    d.on = true; buzz(8);
  }
  function move(ev) {
    if (!d || ev.pointerId !== d.id) return;
    if (!d.on) { if (Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < 10) return; start(ev); if (!d) return; }
    ev.preventDefault();
    const x = ev.clientX, y = ev.clientY;
    d.g.style.transform = `translate(${x - d.dx}px,${y - d.dy}px) rotate(${Math.max(-8, Math.min(8, (x - d.x0) / 20))}deg) scale(1.06)`;
    const cx = d.r.left + d.r.width / 2, cy = d.r.top;
    d.svg.querySelector("path").setAttribute("d", `M${cx},${cy} Q${cx},${(cy + y) / 2 - 40} ${x},${y}`);
    const c = d.svg.querySelector("circle"); c.setAttribute("cx", x); c.setAttribute("cy", y);
    const z = zoneAt(x, y), hot = z && z.dataset.tbzone === d.zone ? z : null;
    if (hot !== d.hot) {
      d.hot?.classList.remove("drop-hot"); hot?.classList.add("drop-hot"); d.hot = hot;
      d.svg.classList.toggle("hot", !!hot); d.g.classList.toggle("hot", !!hot);
      if (hot) buzz(12);
    }
  }
  function clear(x) {
    const root = document.getElementById("tbf");
    root?.classList.remove("dragging", "dz-foe", "dz-self");
    root?.querySelectorAll(".drop-ok,.drop-hot").forEach((z) => z.classList.remove("drop-ok", "drop-hot"));
    const h = root?.querySelector(".tbhint"); if (h) h.textContent = "";
    x?.svg?.remove(); x?.card?.classList.remove("lifted");
  }
  function up(ev) {
    if (!d || ev.pointerId !== d.id) return;
    const was = d; d = null;
    if (!was.on) return;                       // a plain tap: the normal click handles it
    ev.preventDefault();
    const fire = !!was.hot && ev.type === "pointerup";
    clear(was);
    if (fire) {
      was.g.classList.add("used"); setTimeout(() => was.g.remove(), 220);
      swallow = Date.now() + 400;
      was.card.click();                         // same path as a tap (tbfight.js onClick)
    } else {                                    // slide back to the dock
      const r = was.card.getBoundingClientRect();
      was.g.classList.add("back"); was.g.style.transform = `translate(${r.left}px,${r.top}px)`;
      setTimeout(() => was.g.remove(), reduce() ? 0 : 220);
    }
  }
  // the browser's own click after a drag lands on whatever is under the finger: ignore it
  let swallow = 0;
  function eatClick(ev) {
    if (Date.now() < swallow && ev.isTrusted && ev.target.closest?.("#tbf")) { ev.stopPropagation(); ev.preventDefault(); swallow = 0; }
  }
  function key(ev) {
    const root = DOM && document.getElementById("tbf"); if (!root) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey || /^(INPUT|TEXTAREA)$/.test(ev.target?.tagName || "")) return;
    if (ev.key === "Escape" && d) { d.hot = null; up({ pointerId: d.id, type: "pointercancel", preventDefault() {} }); return; }
    if (/^[1-9]$/.test(ev.key)) {
      const cards = [...root.querySelectorAll(".tbdock .tbact:not([disabled])")];
      const b = cards[+ev.key - 1]; if (b) { ev.preventDefault(); b.click(); }
    } else if (ev.key === "l" || ev.key === "L") { root.querySelector('[data-tbx="log"],[data-tbx="logx"]')?.click(); }
  }
  if (DOM && typeof addEventListener === "function") {
    addEventListener("pointerdown", down, true);
    addEventListener("pointermove", move, { capture: true, passive: false });
    addEventListener("pointerup", up, true);
    addEventListener("pointercancel", up, true);
    addEventListener("click", eatClick, true);
    addEventListener("keydown", key);
  }
  return { logLine, after, get dragging() { return !!d?.on; } };
})();
if (typeof module !== "undefined") module.exports = TBUI;
