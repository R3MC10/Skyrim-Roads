/* Everyone fits on the fight screen. [OURS] (magicaim)
   Players: "During combat, casting spells on other targets is impossible while the Magic tab is open on mobile" and
   "The combat should fit in screen, other party members are offscreen."
   combat2.js lays the immersive fight screen out after each redraw and asks this module three things:
   - cover(): how much of the screen the bottom bar covers right now. With Magic / Items open that is the whole
     drawer, so the scene, your orb and the party plates move up above it instead of hiding under it (you can tap or
     drag a heal onto anyone you see).
   - listMax(): how tall the spell / item list in that drawer may be. It only depends on the screen size, so the
     drawer can't push itself around; short landscape phones get a slimmer drawer (no hint line, no filter chips).
   - wideStage(): on a PC or a wide landscape screen the scene fills the window behind a floating bar: it slides up
     so everyone's feet stand above the bar, and shrinks a little (blurred copy at the sides) when it can't fit
     between the turn strip and the bar otherwise.
   - party(): the party plates (up to 7 other players plus followers) get more columns, then slimmer plates, until
     they all fit between the turn strip and the bar and stay clear of your orb.
   fightctl.js adds the other half of the fix: while a heal waits for its target you can also tap the person's
   figure in the scene. */
const FIGHTFIT = (() => {
  const DOM = typeof document !== "undefined";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* px of the fight screen (tin) the bar covers from the bottom: Magic drawer included */
  function cover(tin, dock) {
    if (!DOM || !tin || !dock) return 0;
    const r = dock.getBoundingClientRect(); if (!r.height) return 0;
    const t = tin.getBoundingClientRect();
    return Math.max(0, Math.round(t.bottom - r.top));
  }
  /* the spell / item list's max height in the drawer */
  function listMax(W, H, wide) {
    if (H < 560) return Math.round(clamp(H * 0.22, 50, 110));   // one-line spell rows there (index.html)
    if (wide) return Math.round(clamp(H * 0.24, 96, 260));
    return Math.round(clamp(H * 0.3, 140, 300));
  }
  /* wide layout: the stage's box so the fighters stand between the turn strip (top) and the bar (dh from the bottom).
     Fighters span from ~32% (a person's head) to 80% (the ground line) of the stage's height. */
  function wideStage(W, H, cw, ch, cx, cy, top, dh) {
    const lo = top + 4, hi = H - dh - 6, need = 0.52 * ch;
    if (hi - lo < need && hi - lo > 40) { const q = Math.max(0.55, (hi - lo) / need); cw *= q; ch *= q; cx = (W - cw) / 2; }
    cy = Math.min(cy, hi - 0.8 * ch);   // feet above the bar
    cy = Math.max(cy, lo - 0.3 * ch);   // heads under the strip (when both can't hold, the feet win)
    cy = Math.min(cy, hi - 0.8 * ch);
    return { cw, ch, cx, cy };
  }
  /* the party plates: more columns, then slim plates, until they fit */
  function party(el, o) {
    const box = el && el.querySelector(".c2ov .tbparty"); if (!box) return;
    const cards = [...box.querySelectorAll(":scope > .tbu.ally")]; if (!cards.length) return;
    box.classList.remove("c2slim", "c2cols"); box.style.maxWidth = ""; box.style.gridTemplateRows = "";
    const tin = el.querySelector(".tbin"), tr = tin ? tin.getBoundingClientRect() : { top: 0, left: 0 };
    const z = box.offsetHeight ? box.getBoundingClientRect().height / box.offsetHeight : 1;   // Fight UI size zooms the plates
    const gap = 4;
    if (o.wide) {   // a column down the left side, above your orb
      const me = el.querySelector(".c2ov .tbu.me"), mr = me ? me.getBoundingClientRect() : null;
      const lim = mr && mr.height ? mr.top - 6 : tr.top + o.H - o.dh - 14;   // page px
      const fits = () => box.getBoundingClientRect().bottom <= lim + 1;
      if (fits()) return;
      for (const slim of [false, true]) {
        box.classList.toggle("c2slim", slim); box.classList.add("c2cols");
        const ch = cards[0].getBoundingClientRect().height || 30, avail = lim - box.getBoundingClientRect().top;
        const rows = Math.max(1, Math.floor((avail + gap * z) / (ch + gap * z)));
        box.style.gridTemplateRows = `repeat(${rows}, auto)`;
        if (fits() && box.getBoundingClientRect().width <= o.W * 0.42) return;
      }
      return;
    }
    // tall: right-aligned, growing up from the bar; it may grow left until your orb
    const me = el.querySelector(".c2ov .tbu.me"), mr = me ? me.getBoundingClientRect() : null;
    const maxW = Math.max(140, (o.W - 12 - (mr && mr.width ? mr.right - tr.left + 8 : 0)) / z);
    const lim = tr.top + o.top + 4;   // page px: under the turn strip
    const fits = () => box.getBoundingClientRect().top >= lim - 1;
    if (fits()) return;
    for (const slim of [false, true]) {
      box.classList.toggle("c2slim", slim);
      const cw = cards[0].offsetWidth || 64;
      for (let n = 2; n <= cards.length; n++) {
        const w = n * cw + (n - 1) * gap + 1; if (w > maxW && n > 2) break;
        box.style.maxWidth = w + "px";
        if (fits()) return;
      }
    }
  }
  /* the foe's plate never sits on a party plate: it moves right of them, or above them, when there's room */
  function unclash(el, o) {
    const plate = el && el.querySelector(".c2ov .tbu.foe"), box = el && el.querySelector(".c2ov .tbparty");
    if (!plate || !box || !box.children.length) return;
    const tin = el.querySelector(".tbin"); if (!tin) return;
    const t = (plate.offsetParent || tin).getBoundingClientRect(), p = plate.getBoundingClientRect();   // the plate's left/top are in its parent's px
    const hit = (q) => [...box.children].some((c) => { const r = c.getBoundingClientRect(); return r.width && q.left < r.right - 2 && q.right > r.left + 2 && q.top < r.bottom - 2 && q.bottom > r.top + 2; });
    if (!hit(p)) return;
    const b = box.getBoundingClientRect(), L0 = p.left - t.left, T0 = p.top - t.top;
    const tries = [[b.right - t.left + 6, T0], [L0, b.top - t.top - p.height - 6], [b.left - t.left - p.width - 6, T0]];
    for (const [L, T] of tries) {
      if (L < 4 || L + p.width > o.W - 4 || T < o.top + 2 || T + p.height > o.H - o.dh - 4) continue;
      const q = { left: t.left + L, right: t.left + L + p.width, top: t.top + T, bottom: t.top + T + p.height };
      if (hit(q)) continue;
      plate.style.left = L.toFixed(1) + "px"; plate.style.top = T.toFixed(1) + "px"; return;
    }
  }
  return { cover, listMax, wideStage, party, unclash };
})();
if (typeof module !== "undefined") module.exports = FIGHTFIT;
