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
  const ICON = { foe: "", me: "", guard: "", ally: "⚑", tick: "✶", end: "★" };

  /* one log line: an icon by who acted, numbers picked out, crits/kills/heals coloured */
  function logLine(e, fresh) {
    let t = esc(e.text);
    t = t.replace(/\b(critical|crit|sneak attack|finishing blow|power attack)\b/gi, '<em class="cr">$1</em>')
      .replace(/(\+\d+)/g, '<b class="nh">$1</b>')
      .replace(/(^|[^\w+-])(\d+)(?![\w%])/g, '$1<b class="nd">$2</b>');
    const k = e.kind || "me";
    return `<span class="tbl ${esc(k)}${fresh ? " fresh" : ""}"><span class="li" aria-hidden="true">${ICON[k] || "•"}</span><span class="lt">${t}</span></span>`;
  }

  /* a bar that just lost something: flash it white, break the lost piece off in a few shards, then let the ghost drain */
  function breakBar(bar) {
    const g = bar.querySelector(".gh[data-to]"); if (!g) return;
    const from = parseFloat(g.style.width) || 0, to = parseFloat(g.dataset.to) || 0;
    if (from - to < 0.5) return;
    bar.classList.remove("hitfx"); void bar.offsetWidth; bar.classList.add("hitfx");
    if (reduce()) return;
    const n = Math.max(2, Math.min(6, Math.round((from - to) / 6)));
    for (let i = 0; i < n; i++) {
      const c = document.createElement("span"); c.className = "shard";
      const w = (from - to) / n;
      c.style.left = (to + w * i) + "%"; c.style.width = w + "%";
      c.style.setProperty("--dx", (Math.random() * 30 - 8).toFixed(0) + "px");
      c.style.setProperty("--dy", (14 + Math.random() * 22).toFixed(0) + "px");
      c.style.setProperty("--rot", (Math.random() * 70 - 35).toFixed(0) + "deg");
      c.style.animationDelay = (i * 35) + "ms";
      bar.appendChild(c); setTimeout(() => c.remove(), 900 + i * 35);
    }
  }

  /* floating numbers over whoever they hit: coloured by element (fire, frost, shock, poison, shouts), green heals,
     big gold crits, blue magicka and yellow-green stamina spent */
  function popNums(el, pops) {
    if (!pops?.length) return;
    if (typeof FIGHTNUMS !== "undefined") return FIGHTNUMS.pop(el, pops);   // [fightnums] outlined, each on its own free spot
    const host = el.querySelector(".tbin"); if (!host) return;
    const hb = host.getBoundingClientRect();
    const spot = { me: el.querySelector(".tbu.me"), foe: el.querySelector(".tbu.foe") };
    const stage0 = el.querySelector(".tbstage"), cvs = stage0?.querySelector(".tbscene canvas");
    const stage = cvs && cvs.getBoundingClientRect().width > 40 ? cvs : stage0;   // numbers rise from the fighters in the picture
    const used = { me: 0, foe: 0 }, wheel = typeof TBRADIAL !== "undefined" && TBRADIAL.on();
    let slot = 0;
    pops.forEach((p, i) => {
      const t = spot[p.at]; if (!t) return;
      if (p.tag && p.n < 0 && p.at === "me" && wheel) return;   // the wheel already floated what you spent (tbradial.js)
      const r = t.getBoundingClientRect(), sr = stage?.getBoundingClientRect();
      if (p.tag && p.at === "me") {
        /* [rigpolish] magicka/stamina from your frame: above the frame (your name sits at its top), one fixed column each
           so two numbers never land on each other */
        const s = document.createElement("span");
        s.className = `tbpop el-${p.el}${p.n > 0 ? " up" : ""}`;
        s.textContent = (p.n > 0 ? "+" : "") + Math.round(p.n) + " " + p.tag;
        const nm = t.querySelector(".nm, .c2orb"), top = Math.min(r.top, nm ? nm.getBoundingClientRect().top : r.top);
        s.style.left = (Math.min(innerWidth - 50, r.left + 44 + 80 * slot) - hb.left) + "px";
        s.style.top = (top - 24 - hb.top) + "px";
        s.style.animationDelay = (reduce() ? 0 : i * 170) + "ms"; slot++;
        host.appendChild(s); setTimeout(() => s.remove(), 1500 + i * 170);
        return;
      }
      const k = used[p.at]++;
      const s = document.createElement("span");
      s.className = `tbpop el-${p.el}${p.crit ? " crit" : ""}${p.n > 0 ? " up" : ""}`;
      s.textContent = (p.n > 0 ? "+" : "") + Math.round(p.n) + (p.tag ? " " + p.tag : "") + (p.crit ? "!" : "");
      // damage rises from the fighter in the scene; spent magicka/stamina from your own frame
      const overScene = sr && !p.tag;
      /* [rigraces] beside the fighter at chest height, on the outer side (the scene puts the foe at 72% across and you near
         30%, the ground at 80% down): off the big number the scene draws over their head, and never up in the sky */
      const x = overScene ? (p.at === "foe" ? sr.left + sr.width * 0.83 : sr.left + sr.width * 0.17) : r.left + r.width * 0.5;
      const y = overScene ? sr.top + sr.height * 0.58 : r.top + 6;
      s.style.left = (Math.max(8, Math.min(innerWidth - 60, x + (k % 2 ? 26 : -18))) - hb.left) + "px";
      s.style.top = (y - hb.top - k * 26) + "px";   // a line apart (the numbers are 22px tall), never on top of each other
      s.style.animationDelay = (reduce() ? 0 : i * 170) + "ms";
      host.appendChild(s); setTimeout(() => s.remove(), 1500 + i * 170);
    });
  }

  /* after each redraw: let the ghost bars drain, shake on hits */
  function after(el, o) {
    if (!DOM || !el) return;
    el.querySelectorAll(".tbbar").forEach(breakBar);
    const gh = el.querySelectorAll(".tbbar .gh[data-to]");
    if (gh.length) setTimeout(() => gh.forEach((g) => { g.style.width = g.dataset.to + "%"; }), reduce() ? 0 : 520);
    popNums(el, o.pops);
    const stage = el.querySelector(".tbstage");
    if (stage && !reduce()) {
      if (o.hurt) { stage.classList.remove("hurt", "big"); void stage.offsetWidth; stage.classList.add("hurt"); if (o.big) { stage.classList.add("big"); buzz(30); } }
      else if (o.hit) { stage.classList.remove("struck"); void stage.offsetWidth; stage.classList.add("struck"); }
    }
    const lg = el.querySelector(".tblog"); if (lg) requestAnimationFrame(() => { if (typeof FOEPANEL === "undefined" || !FOEPANEL.logHeld()) lg.scrollTop = lg.scrollHeight; });   // [foepanel] not while you read back up
  }

  // ------------------------------------------------------------------ tooltips: hold a finger on something, or hover with a mouse
  let tipEl = null, tipFor = null, holdT = null, held = null;
  function showTip(t) {
    const txt = t?.dataset?.tip; if (!txt) return;
    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tbtip"; tipEl.setAttribute("role", "tooltip"); }
    tipEl.textContent = txt; tipFor = t;
    if (!tipEl.isConnected) document.body.appendChild(tipEl);
    const r = t.getBoundingClientRect(), w = Math.min(280, innerWidth - 16);
    tipEl.style.maxWidth = w + "px";
    const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    let x = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
    let y = r.top - th - 10; if (y < 8) y = Math.min(innerHeight - th - 8, r.bottom + 10);
    tipEl.style.left = x + "px"; tipEl.style.top = y + "px"; tipEl.classList.add("on");
  }
  function hideTip() { tipEl?.classList.remove("on"); tipFor = null; }
  // a phone that fakes mouse events on a tap must not leave a hover tip hanging over the log or the bar
  const canHover = () => typeof matchMedia !== "function" || matchMedia("(hover: hover) and (pointer: fine)").matches;
  // tooltip.js (with fighttips.js) shows the fight's tooltips when it's loaded; this small one is only the fallback
  const bigTips = () => typeof TIP !== "undefined" && !!TIP.eatClick;
  function tipTarget(ev) { return bigTips() ? null : ev.target.closest?.("#tbf [data-tip]") || null; }
  function overTip(ev) {   // mouse only: hover shows the tip
    if (ev.pointerType !== "mouse" || d?.on || !canHover()) return;
    const t = tipTarget(ev); if (t === tipFor) return;
    if (t) showTip(t); else hideTip();
  }
  function holdStart(ev) {
    clearTimeout(holdT); held = null;
    if (ev.pointerType === "mouse") return;
    const t = tipTarget(ev); if (!t) return;
    const x0 = ev.clientX, y0 = ev.clientY;
    held = { t, x0, y0, id: ev.pointerId };
    holdT = setTimeout(() => {
      if (!held || d?.on) return;
      d = null;                       // a hold is a look, not a drag
      held.shown = true; showTip(held.t); buzz(10);
    }, 430);
  }
  function holdMove(ev) {
    if (held && !held.shown && Math.hypot(ev.clientX - held.x0, ev.clientY - held.y0) > 10) { clearTimeout(holdT); held = null; }
  }
  function holdEnd(ev) {
    clearTimeout(holdT);
    if (held?.shown) { swallow = Date.now() + 500; setTimeout(hideTip, 900); }   // the lift after a hold doesn't press the button
    held = null;
  }

  // ------------------------------------------------------------------ dragging action cards onto a target
  let d = null;
  const HINT = { foe: "Let go on the foe", self: "Let go on yourself or a teammate", ally: "Let go on a teammate" };
  function zoneAt(x, y) { const t = document.elementFromPoint(x, y); return t?.closest?.("[data-tbzone]") || null; }
  function down(ev) {
    const card = ev.target.closest?.("#tbf .tbact[data-tz]");
    if (!card || card.disabled || ev.button > 0) return;
    d = { card, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, on: false, zone: card.dataset.tz, hot: null };
  }
  function start(ev) {
    clearTimeout(holdT); held = null; hideTip();
    const root = document.getElementById("tbf"); if (!root) return (d = null);
    const r = d.card.getBoundingClientRect();
    const g = d.card.cloneNode(true); g.classList.add("tbghost"); g.removeAttribute("data-tba"); g.setAttribute("aria-hidden", "true");
    g.style.width = r.width + "px"; g.style.height = r.height + "px";
    d.dx = ev.clientX - r.left; d.dy = ev.clientY - r.top; d.r = r;
    document.body.appendChild(g); d.g = g;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "tbaim"); svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = '<path d=""/><circle r="7"/>'; document.body.appendChild(svg); d.svg = svg;
    d.card.classList.add("lifted"); root.classList.add("dragging", "dz-" + d.zone);
    root.querySelectorAll(`[data-tbzone~="${d.zone}"]`).forEach((z) => z.classList.add("drop-ok"));
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
    const z = zoneAt(x, y), hot = z && z.dataset.tbzone.split(" ").includes(d.zone) ? z : null;
    if (hot !== d.hot) {
      d.hot?.classList.remove("drop-hot"); hot?.classList.add("drop-hot"); d.hot = hot;
      d.svg.classList.toggle("hot", !!hot); d.g.classList.toggle("hot", !!hot);
      if (hot) buzz(12);
    }
  }
  function clear(x) {
    const root = document.getElementById("tbf");
    root?.classList.remove("dragging", "dz-foe", "dz-self", "dz-ally");
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
      const root = document.getElementById("tbf");
      if (root) { if (was.hot.dataset.ally != null) root.dataset.tbt = was.hot.dataset.ally; else delete root.dataset.tbt; }
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
    if (ev.isTrusted && bigTips() && ev.target.closest?.("#tbf") && TIP.eatClick(ev)) return;   // the lift after holding for a tooltip: no cast, no target picking (fightctl.js listens after this)
    if (Date.now() < swallow && ev.isTrusted && ev.target.closest?.("#tbf")) { ev.stopPropagation(); ev.preventDefault(); swallow = 0; }
  }
  function key(ev) {
    const root = DOM && document.getElementById("tbf"); if (!root) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey || /^(INPUT|TEXTAREA)$/.test(ev.target?.tagName || "")) return;
    if (ev.key === "Escape" && d) { d.hot = null; up({ pointerId: d.id, type: "pointercancel", preventDefault() {} }); return; }
    if (/^[1-9]$/.test(ev.key) && !root.querySelector(".fc")) {   // the action bar (fightctl.js, hotbar.js) has its own keys
      const cards = [...root.querySelectorAll(".tbdock .tbact:not([disabled])")];
      const b = cards[+ev.key - 1]; if (b) { ev.preventDefault(); b.click(); }
    } else if (ev.key === "l" || ev.key === "L") { root.querySelector('[data-tbx="log"],[data-tbx="logx"]')?.click(); }
  }
  if (DOM && typeof addEventListener === "function") {
    addEventListener("pointerdown", holdStart, true);
    addEventListener("pointermove", holdMove, true);
    addEventListener("pointerup", holdEnd, true);
    addEventListener("pointercancel", holdEnd, true);
    addEventListener("pointerover", overTip, true);
    addEventListener("pointerdown", () => hideTip(), true);   // any new touch or click closes a tip that's open
    addEventListener("click", () => { if (Date.now() >= swallow) hideTip(); }, true);   // an action fires: its tip goes (the screen redraws under it)
    addEventListener("scroll", hideTip, true);
    addEventListener("pointerdown", down, true);
    addEventListener("pointermove", move, { capture: true, passive: false });
    addEventListener("pointerup", up, true);
    addEventListener("pointercancel", up, true);
    addEventListener("click", eatClick, true);
    addEventListener("keydown", key);
  }
  /* tooltip.js: a finger held still shows a tooltip; that press isn't the start of a drag any more */
  function look() { if (d && !d.on) d = null; }
  return { logLine, after, look, get dragging() { return !!d?.on; } };
})();
if (typeof module !== "undefined") module.exports = TBUI;
