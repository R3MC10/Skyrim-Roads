/* See what a move will do before you make it. [OURS, GPT round 2 brief 6]
   While you rest the mouse on a move (PC) or hold a finger on it (phone, the same hold that shows its tooltip):
   - the foe's health bar shows a striped "could lose" piece, from the low to the high end of the damage
     (TB.preview in tbfight.js: the same numbers the tooltip says, and never more than the 40% blow cap);
   - your stamina or magicka (the arcs round your health orb, or the bars) dims by what the move costs;
   - one of your move diamonds fades (two for a move that takes two);
   - a healing spell shows the health it gives back; End turn shows the guard you keep.
   Letting go clears it, and a tap still acts at once (this only draws, it never presses anything). */
const MOVEPREVIEW = (() => {
  const DOM = typeof document !== "undefined";
  const HOLD = 420;   // a touch shows it a little before the tooltip (tooltip.js waits 450 ms)
  let cur = null, holdT = 0, press = null;
  const r0 = (v) => Math.round(v);
  const pc = (v, m) => Math.max(0, Math.min(100, (100 * v) / Math.max(1, m)));
  const sess = () => (typeof TB !== "undefined" && TB.open ? TB.session : null);
  const T = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);

  /* what a move would do, in plain numbers (used by the screen test too) */
  function info(a, S = sess()) {
    if (!S || !S.f || !a || typeof TB === "undefined" || !TB.preview) return null;
    try { return TB.preview(S.f, a, S); } catch (e) { return null; }
  }
  function moveBtn(t) {
    const b = t && t.closest ? t.closest("#tbf [data-tba]") : null;
    return b && !b.closest(".tbghost") && b.closest(".tbdock, .fc, .tbwheel, .tbgrid, .tbmenu") ? b : null;
  }

  // ------------------------------------------------------------------ drawing
  function seg(bar, left, width, cls, label) {
    if (!bar || width <= 0) return;
    const s = document.createElement("b");
    s.className = "mpv " + cls; s.setAttribute("aria-hidden", "true");
    s.style.left = left.toFixed(1) + "%"; s.style.width = width.toFixed(1) + "%";
    bar.appendChild(s);
    if (label) { const l = document.createElement("em"); l.className = "mpv-n " + cls; l.textContent = label; l.setAttribute("aria-hidden", "true"); bar.appendChild(l); }
  }
  /* a dim piece over an arc of the orb: from what you'd have left up to what you have now */
  function arcDim(orb, cls, now, after) {
    const p = orb && orb.querySelector(`svg.c2arcs path.${cls}`); if (!p || now <= after) return;
    const q = p.cloneNode(false);
    q.setAttribute("class", "mpv-arc " + cls);
    q.setAttribute("stroke-dasharray", `0 ${after.toFixed(1)} ${(now - after).toFixed(1)} 200`);
    p.parentNode.appendChild(q);
  }
  function show(btn) {
    const S = sess(), el = DOM && document.getElementById("tbf");
    if (!S || !el || S.done || !btn) return clear();
    const a = btn.dataset.tba;
    if (cur && cur.btn === btn) return;
    clear();
    const p = info(a, S); if (!p) return;
    cur = { btn, a };
    el.classList.add("mpv-on");
    btn.classList.add("mpv-src");
    const f = S.f, c = p.c || {};
    // the foe: striped "could lose" piece
    const fb = el.querySelector(".tbu.foe .tbbar.hp");
    if (fb && p.hi > 0) {
      const max = S.ehpMax || f.ehp || 1, now = Math.max(0, f.ehp);
      const surely = pc(p.lo, max), maybe = pc(p.hi - p.lo, max), x = pc(now - p.hi, max);
      seg(fb, x, maybe, "lose maybe");
      seg(fb, x + maybe, surely, "lose sure", p.lo === p.hi ? `−${p.hi}` : `−${p.lo}–${p.hi}`);
      fb.classList.add("mpv-bar");
    }
    // you: what it costs, what it heals, the guard you keep
    const me = el.querySelector(".tbu.me"), mpMax = G.maxMagicka(f.s), spMax = G.maxStamina(f.s), hpMax = G.maxHealth(f.s);
    const orb = me && me.querySelector(".c2orb");
    const dim = (k, now, mx, cost) => {
      if (!(cost > 0)) return;
      const a0 = pc(Math.max(0, now - cost), mx), a1 = pc(now, mx);
      const bar = me && me.querySelector(`.tbbar.${k}`);
      if (bar) seg(bar, a0, a1 - a0, "cost " + k);
      arcDim(orb, k, a1, a0);
      const n = orb && orb.querySelector(k === "mp" ? ".c2mpn" : ".c2spn");
      if (n) { n.dataset.mpv = `−${r0(cost)}`; n.classList.add("mpv-num"); }
    };
    dim("mp", Math.min(mpMax, Math.max(0, f.mp)), mpMax, c.mp);
    dim("sp", Math.min(spMax, Math.max(0, f.sp)), spMax, c.sp);
    if (c.hp > 0 && me) { const hb = me.querySelector(".tbbar.big.hp"); if (hb) seg(hb, pc(f.hp - c.hp, hpMax), pc(c.hp, hpMax), "cost hp"); }
    if (p.heal > 0 && me) {
      const gain = Math.min(p.heal, hpMax - f.hp), hb = me.querySelector(".tbbar.big.hp");
      if (gain > 0) {
        if (hb) seg(hb, pc(f.hp, hpMax), pc(gain, hpMax), "heal", `+${r0(gain)}`);
        const gl = orb && orb.querySelector(".c2glass");
        if (gl) { const i = document.createElement("i"); i.className = "mpv-heal"; i.style.bottom = pc(f.hp, hpMax).toFixed(1) + "%"; i.style.height = pc(gain, hpMax).toFixed(1) + "%"; gl.appendChild(i); }
      }
    }
    if (a === "end" && me) {
      const g = r0(100 * (p.guard || 0));
      const chip = document.createElement("div");
      chip.className = "mpv-guard"; chip.setAttribute("aria-hidden", "true");
      chip.textContent = g > 0 ? `${T("Guard")} +${g}%: ${T("blows hit softer until your next turn")}` : T("No guard left: you spent all your AP");
      me.appendChild(chip);
      orb?.classList.add("mpv-guarded");
    }
    if (p.note && me) {   // [itemgames] a poison: what your next hit will carry
      const chip = document.createElement("div");
      chip.className = "mpv-guard mpv-note"; chip.setAttribute("aria-hidden", "true");
      chip.textContent = p.note;
      me.appendChild(chip);
    }
    // the move diamonds: the ones this move would use fade
    const n = a === "end" || a === "flee" ? 0 : Math.max(1, c.acts || 1);
    if (n) {
      const on = [...el.querySelectorAll(".tbap i.ap.on")];
      on.slice(Math.max(0, on.length - n)).forEach((d) => d.classList.add("mpv-use"));
    }
  }
  function clear() {
    clearTimeout(holdT);
    if (!cur && !(DOM && document.querySelector("#tbf.mpv-on"))) return;
    cur = null;
    const el = DOM && document.getElementById("tbf"); if (!el) return;
    el.classList.remove("mpv-on");
    el.querySelectorAll(".mpv, .mpv-n, .mpv-arc, .mpv-heal, .mpv-guard").forEach((x) => x.remove());
    el.querySelectorAll(".mpv-src, .mpv-bar, .mpv-use, .mpv-guarded, .mpv-num").forEach((x) => x.classList.remove("mpv-src", "mpv-bar", "mpv-use", "mpv-guarded", "mpv-num"));
  }

  // ------------------------------------------------------------------ mouse: hover; finger: hold
  const isMouse = (e) => e.pointerType === "mouse" || e.pointerType === "pen";
  function over(e) {
    if (!isMouse(e)) return;
    const b = moveBtn(e.target);
    if (b) show(b); else if (cur && !(e.target.closest && e.target.closest("#tbf .tbdock"))) clear();
  }
  function out(e) {
    if (!isMouse(e) || !cur) return;
    const to = e.relatedTarget, b = moveBtn(to);
    if (b !== cur.btn) { if (b) show(b); else clear(); }
  }
  function down(e) {
    if (isMouse(e)) return;
    clear(); press = null;
    const b = moveBtn(e.target); if (!b) return;
    press = { b, x: e.clientX, y: e.clientY, id: e.pointerId };
    holdT = setTimeout(() => { if (press && press.b.isConnected) show(press.b); }, HOLD);
  }
  function move(e) {
    if (!press || e.pointerId !== press.id || cur) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(holdT); press = null; }
  }
  function up(e) {
    if (isMouse(e)) return;
    if (press && e.pointerId === press.id) { press = null; clear(); }
  }
  if (DOM && typeof addEventListener === "function") {
    const o = { capture: true, passive: true };
    addEventListener("pointerover", over, o);
    addEventListener("pointerout", out, o);
    addEventListener("pointerdown", down, o);
    addEventListener("pointermove", move, o);
    addEventListener("pointerup", up, o);
    addEventListener("pointercancel", up, o);
    addEventListener("click", (e) => { if (cur && e.target.closest && e.target.closest("#tbf")) clear(); }, true);   // the move fires: the screen redraws anyway
    addEventListener("keydown", (e) => { if (e.key === "Escape") clear(); });
  }
  return { info, show, clear, get on() { return !!cur; } };
})();
if (typeof module !== "undefined") module.exports = MOVEPREVIEW;
