/* Fight numbers you can read on a phone and a PC. [OURS] (fightnums)
   Owner: "make fight numbers easy to read on phone and PC".
   - Every floating number (damage, heal, crit, block, miss, magicka / stamina spent) gets a thick dark outline, a size
     that grows with the screen, and a bigger, gold, bouncing crit.
   - Colours by type: damage in its element's colour, heals green with a "+", magicka and stamina as small blue / green
     chips, block and miss in grey-steel words. Poison is a yellow-lime so it never reads as a heal.
   - Each number looks for its own free spot near whoever it hit: never on another number (also ones still floating
     from the last move), never on the foe's plate (foepanel.js), the boss bar, the turn strip, the log, your health
     orb or the fight buttons, and always fully inside the screen.
   - Reduced motion: the numbers just appear and fade, no bounce or rise.
   - The painted foes (giant, spider, dragon...) are wider than their old size boxes: picFoot() measures the real
     picture so fightpos.js keeps every foe fully on screen, also at 360 px wide.
   tbui.js hands its pops here (pop), tbfight.js adds the Miss / Blocked ones (extra), combat2.js nudges its status
   pop-ups clear of the plate (nudge), fightart.js asks for the picture's size (picFoot) and its own scene numbers' size
   (sceneSize). Pure helpers (place, extra, picFootOf) work without a page: tests/test_fightnums.js. */
const FIGHTNUMS = (() => {
  const DOM = typeof document !== "undefined";
  const reduce = () => DOM && typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const RISE = 26, GAP = 4, LIFE = 1500, STEP = 150;   // how far a number floats up (px), the gap kept between numbers, how long one lives, the delay between two

  /* ------------------------------------------------------------------ a free spot (pure: page px in, page px out)
     want: {x, y} the centre it would like; w, h its size; hard: boxes it must not cover (plate, buttons...); soft: other
     numbers; bounds: the box it must stay in. Tries a column above / below the spot, then beside it; the first spot
     that touches nothing wins, else the one that covers the least. Against the plate and the buttons its float-up
     counts (box); against other numbers only where it starts (core): they all float up together. */
  function place(want, w, h, hard, soft, bounds, side) {
    const rise = reduce() ? 0 : RISE, dx = w + 6, sd = side < 0 ? -1 : 1, cols = [0, sd * dx, -sd * dx, sd * 2 * dx, -sd * 2 * dx];
    let best = null;
    for (let c = 0; c < cols.length; c++) for (let j = 0; j < 11; j++) {
      const dy = j === 0 ? 0 : (j % 2 ? -1 : 1) * Math.ceil(j / 2) * (h + GAP);   // 0, up, down, up 2, down 2...
      const L = clamp(want.x + cols[c] - w / 2, bounds.left, bounds.right - w), T = clamp(want.y + dy - h / 2, bounds.top + rise, bounds.bottom - h);
      const box = { left: L, top: T - rise, right: L + w, bottom: T + h }, core = { left: L - GAP / 2, top: T - GAP / 2, right: L + w + GAP / 2, bottom: T + h + GAP / 2 };
      let hit = 0; for (const a of hard) hit += area(box, a) * 6; for (const a of soft) hit += area(core, a) * 10;
      const score = (hit ? 1e5 + hit : 0) + Math.abs(L + w / 2 - want.x) * 0.6 + Math.abs(T + h / 2 - want.y) + c * 8;   // any overlap loses to a free spot further away
      if (!best || score < best.score) best = { left: L, top: T, box, core, score, hit };
      if (!hit && c === 0 && j === 0) return best;
    }
    return best;
  }

  /* ------------------------------------------------------------------ Miss / Blocked from the fight's lines */
  const MISS = /\b(miss(es|ed)?|dodges?|dodged|whiffs?)\b/i, BLOCK = /\b(block(s|ed)?|glances? off|parr(y|ies|ied)|deflect(s|ed)?)\b/i;
  function extra(evs, out) {
    for (const e of evs || []) {
      if (!e || e.dmg > 0 || e.healed > 0 || e.kind === "round" || e.kind === "tick") continue;
      const t = e.text || "", at = e.kind === "foe" ? "me" : e.kind === "me" || e.kind === "ally" ? "foe" : null; if (!at) continue;
      if (BLOCK.test(t) && !/\bfor \d+/.test(t)) out.push({ at, n: 0, el: "block", word: "Blocked" });
      else if (MISS.test(t)) out.push({ at, n: 0, el: "miss", word: at === "me" && /\bdodge/i.test(t) ? "Dodged" : "Miss" });
    }
    return out;
  }
  const tr = (s) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(s) : s);

  /* ------------------------------------------------------------------ what to avoid on the fight screen */
  function boxes(el, sel) { return [...el.querySelectorAll(sel)].map((n) => n.getBoundingClientRect()).filter((b) => b.width > 2 && b.height > 2); }
  function hardOf(el) {
    return boxes(el, ".c2ov .tbu.foe, .tbdock, .tbtop, .bfwrap, .bftele, .tblog, .c2ov .tbu.me .c2orb, .tbparty, .tbskip, .c2res");
  }
  function boundsOf(el) {
    const tin = el.querySelector(".tbin"), r = tin ? tin.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const dock = el.querySelector(".tbdock")?.getBoundingClientRect(), top = el.querySelector(".tbtop")?.getBoundingClientRect();
    return { left: Math.max(r.left, 0) + 6, right: Math.min(r.right, innerWidth) - 6, top: Math.max(r.top, top && top.height ? top.bottom : 0, 0) + 4, bottom: Math.min(r.bottom, innerHeight, dock && dock.height ? dock.top : Infinity) - 4 };
  }
  let live = [];   // numbers still floating (from this move and the last): {box, until}

  /* where a fighter is in the picture: page px, or null */
  function spotOf(el, who) {
    const cv = el.querySelector(".fscene canvas");
    if (typeof FIGHTPOS !== "undefined" && cv) { const p = FIGHTPOS.screenOf(cv, who); if (p && p.right > p.left) return p; }
    const t = el.querySelector(who === "me" ? ".tbu.me" : ".tbu.foe"); if (!t) return null;
    const r = t.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.bottom, top: r.top, left: r.left, right: r.right } : null;
  }

  function label(p) {
    if (p.word) return tr(p.word);
    const n = Math.round(p.n);
    return (n > 0 ? "+" : "") + n + (p.tag ? " " + p.tag : "") + (p.crit ? "!" : "");
  }

  /* ------------------------------------------------------------------ the pops */
  function pop(el, pops) {
    if (!DOM || !el || !pops?.length) return;
    const host = el.querySelector(".tbin"); if (!host) return;
    const hb = host.getBoundingClientRect(), z = host.offsetWidth ? hb.width / host.offsetWidth || 1 : 1;   // Settings → text size zooms the page
    const now = Date.now(); live = live.filter((q) => q.until > now);
    const hard = hardOf(el), bounds = boundsOf(el), rm = reduce();
    const wheel = typeof TBRADIAL !== "undefined" && TBRADIAL.on && TBRADIAL.on();
    const orb = el.querySelector(".c2ov .tbu.me .c2orb, .tbu.me")?.getBoundingClientRect();
    const sp = { me: spotOf(el, "me"), foe: spotOf(el, "foe") };
    let i = 0;
    for (const p of pops) {
      if (p.tag && p.n < 0 && p.at === "me" && wheel) continue;   // the wheel already floated what you spent (tbradial.js)
      const f = sp[p.at]; if (!f) continue;
      const s = document.createElement("span");
      const kind = p.word ? "word" : p.tag ? "res" : p.n > 0 ? "heal" : "dmg";
      s.className = `tbpop fn fn-${kind} el-${p.el}${p.crit ? " crit" : ""}${p.n > 0 ? " up" : ""}`;
      s.textContent = label(p);
      s.style.left = "0px"; s.style.top = "0px"; s.style.visibility = "hidden";
      host.appendChild(s);
      const w = s.offsetWidth * z, h = s.offsetHeight * z;
      // magicka / stamina: just above your orb; the rest beside the fighter at chest height, on the outer side
      let want, side;
      if (kind === "res" && orb && orb.width) { want = { x: orb.left + orb.width * (p.el === "mp" ? 0.25 : 0.75), y: orb.top - h }; side = p.el === "mp" ? -1 : 1; }
      else {
        const H = Math.max(20, f.y - f.top);
        want = { x: f.x, y: f.top + H * (p.crit ? 0.3 : 0.42) };
        side = p.at === "foe" ? 1 : -1;
      }
      const got = place(want, w, h, hard, live.map((q) => q.box), bounds, side);
      s.style.left = ((got.left - hb.left) / z).toFixed(1) + "px"; s.style.top = ((got.top - hb.top) / z).toFixed(1) + "px";
      s.style.visibility = "";
      const delay = rm ? 0 : i * STEP; s.style.animationDelay = delay + "ms";
      live.push({ box: got.core, until: now + LIFE + delay });
      setTimeout(() => s.remove(), LIFE + delay + 100);
      i++;
    }
  }

  /* combat2.js's "+Oakflesh" / "Poisoned" pop-ups: off the plate and the buttons, inside the screen */
  function nudge(p) {
    if (!DOM || !p || !p.isConnected) return;
    const el = document.getElementById("tbf"); if (!el) return;
    const r = p.getBoundingClientRect(); if (!r.width) return;
    const hard = hardOf(el).filter((b) => !(b.left <= r.left && b.right >= r.right && b.top <= r.top && b.bottom >= r.bottom)), bounds = boundsOf(el);
    const got = place({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, r.width, r.height, hard, live.filter((q) => q.until > Date.now()).map((q) => q.box), bounds, 1);
    if (!got) return;
    p.style.left = (parseFloat(p.style.left) + got.left - r.left).toFixed(0) + "px"; p.style.top = (parseFloat(p.style.top) + got.top - r.top).toFixed(0) + "px";
  }

  /* ------------------------------------------------------------------ the painted foe's real footprint
     The picture is drawn centred on the foe's feet, flipped (it faces your side), hU drawing units tall. Its see-through
     margins don't count. Returns {back, front, h} in drawing units at scale 1 (never smaller than base). */
  const foot = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function opaqueOf(im) {   // the picture's solid part, 0..1 of its width / height
    if (foot && foot.has(im)) return foot.get(im);
    let o = { x0: 0, x1: 1, y0: 0 };
    try {
      const W = 96, H = Math.max(8, Math.round((96 * im.naturalHeight) / im.naturalWidth)), c = document.createElement("canvas"); c.width = W; c.height = H;
      const g = c.getContext("2d"); g.drawImage(im, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data;
      let x0 = W, x1 = -1, y0 = H;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; }
      if (x1 >= x0) o = { x0: x0 / W, x1: (x1 + 1) / W, y0: y0 / H };
    } catch (e) { /* a picture we can't read: its whole box counts */ }
    if (foot) foot.set(im, o);
    return o;
  }
  function picFootOf(aspect, hU, o, base) {
    const wU = hU * aspect, back = wU / 2 - o.x0 * wU, front = o.x1 * wU - wU / 2, h = hU * (1 - o.y0);
    return { back: Math.max(base[0], back + 2), front: Math.max(base[1], front + 2), h: Math.max(base[2], h) };
  }
  function picFoot(im, hU, base) {
    if (!im || !im.naturalWidth || !im.naturalHeight || !(hU > 0)) return null;
    return picFootOf(im.naturalWidth / im.naturalHeight, hU, DOM ? opaqueOf(im) : { x0: 0, x1: 1, y0: 0 }, base);
  }

  /* fightart.js's own numbers in the scene: a size you can read (css px), outlined. size: drawing units, vs: css px per unit */
  function sceneSize(size, vs, big) {
    const px = size * vs, lo = big ? 26 : 18, hi = big ? 54 : 38;
    return clamp(px, lo, hi) / Math.max(0.01, vs);
  }

  return { place, extra, pop, nudge, picFoot, picFootOf, sceneSize, label, RISE };
})();
if (typeof module !== "undefined") module.exports = FIGHTNUMS;
