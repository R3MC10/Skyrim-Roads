/* Nothing covers a button (nocover.js). [OURS]
   Floating things used to land on whatever sat under them: the round message-history button on LEAVE in a dungeon,
   on the Area info button and on Sneak in a fight; "Quest completed" over the dungeon route; the Gather prompt over
   the bottom tabs. hud2.js places the message lane, then asks this module to finish the job:
     hist(lane)        the history button (notify.js) starts the lane at its left edge, or on a PC sits right of the
                       "World news" chip; it steps down or right when a control is under it; hidden while a full-screen
                       menu, character creation, the perk sky or a mini-game is open.
     banners(o)        big banners (polish.js) use a slim band at the top, below the header, at most 64 px tall, and
                       pick the first spot in that band with no button under it (narrowing to fit between buttons).
                       On the map and in a dungeon they never go lower than the top 20% of the screen.
     gnear()           phones: the Gather prompt is a full-width strip right on top of the bottom bar, and the page gets
                       that much more room at its end so nothing hides under it.
   The geometry (area, pick, gap) is plain functions so node tests can check it (tests/test_nocover.js). */
const NOCOVER = (() => {
  const DOM = typeof document !== "undefined" && typeof window !== "undefined";
  const FLOAT = "#hudlane, #pbanners, #gnear, #nfhist";
  const CTRL = "button, [role=button], [role=tab], .tab, .dnode, a[href], input, select, textarea";
  // full-screen things the history button stays away from
  const AWAY = "#sky, .cg, #lockpick, #craftgame, #dgame, #dwgame, #fishgame, #hgame, #huntgame, #minegame, #pickgame, #smithgame, #xgame";
  const HB = 36, BAN_H = 64;

  // ------------------------------------------------------------ pure geometry
  const rect = (left, top, w, h) => ({ left, top, right: left + w, bottom: top + h, width: w, height: h });
  /* how much two boxes overlap (px²) */
  function area(a, b) {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  }
  /* the first spot that touches no blocker, else the one that touches least */
  function pick(cands, blockers) {
    let best = null, least = Infinity;
    for (const c of cands) {
      let s = 0; for (const b of blockers) s += area(c, b);
      if (!s) return c;
      if (s < least) { least = s; best = c; }
    }
    return best;
  }
  /* the widest free stretch [x0, x1] of [l, r] along a row, given the blockers that cross the row */
  function gap(l, r, row, blockers) {
    const xs = blockers.filter((b) => b.bottom > row.top && b.top < row.bottom && b.right > l && b.left < r).map((b) => [b.left, b.right]).sort((a, b) => a[0] - b[0]);
    let best = [l, l], x = l;
    for (const [a, b] of xs) {
      if (Math.min(a, r) - x > best[1] - best[0]) best = [x, Math.min(a, r)];
      x = Math.max(x, b); if (x >= r) break;
    }
    if (r - x > best[1] - best[0]) best = [x, r];
    return best;
  }

  // ------------------------------------------------------------ the page
  const shown = (e) => {
    if (!e || !e.isConnected || !e.getClientRects().length) return false;
    const c = getComputedStyle(e); return c.display !== "none" && c.visibility !== "hidden" && !e.classList.contains("hide");
  };
  /* boxes of the controls really painted inside `zone` (not under a window, not scrolled out of their box) */
  function controls(zone) {
    const out = [];
    for (const t of document.querySelectorAll(CTRL)) {
      const r = t.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || !area(r, zone) || t.closest(FLOAT)) continue;
      const px = Math.min(innerWidth - 1, Math.max(0, (Math.max(r.left, zone.left) + Math.min(r.right, zone.right)) / 2));
      const py = Math.min(innerHeight - 1, Math.max(0, (Math.max(r.top, zone.top) + Math.min(r.bottom, zone.bottom)) / 2));
      const top = document.elementsFromPoint(px, py).find((e) => !e.closest(FLOAT));
      if (top && (top === t || t.contains(top))) out.push(r);
    }
    return out;
  }
  const hull = (rs) => rs.reduce((a, r) => rect(Math.min(a.left, r.left), Math.min(a.top, r.top), Math.max(a.right, r.right) - Math.min(a.left, r.left), Math.max(a.bottom, r.bottom) - Math.min(a.top, r.top)), rs[0]);

  /* screen titles: the button never sits on their text (layout-3) */
  const HEADS = ".uxh-t, #dun .hd > h2";
  function textBoxes(el) {
    const r = document.createRange(); r.selectNodeContents(el);
    return [...r.getClientRects()].filter((q) => q.width > 1 && q.height > 1);
  }
  function headText(zone) {
    const out = [];
    for (const h of document.querySelectorAll(HEADS)) {
      if (!shown(h) || h.closest(FLOAT)) continue;
      for (const q of textBoxes(h)) if (area(q, zone)) out.push(q);
    }
    return out;
  }
  /* a left-aligned title under the button's home spot starts its text after the button (kept while the title lives) */
  function roomForHome(home) {
    for (const h of document.querySelectorAll(HEADS)) {
      if (!shown(h) || h.closest(FLOAT)) continue;
      const r = h.getBoundingClientRect();
      if (!h.dataset.ncpad && (r.left > home.right || !textBoxes(h).some((q) => area(q, home)))) continue;
      if (h.dataset.ncbase == null) h.dataset.ncbase = parseFloat(getComputedStyle(h).paddingLeft) || 0;
      const pad = Math.max(+h.dataset.ncbase, Math.ceil(home.right + 8 - r.left));
      h.dataset.ncpad = "1";
      if (h.style.paddingLeft !== pad + "px") h.style.paddingLeft = pad + "px";
    }
  }

  /* the round message-history button */
  function hist(lane) {
    const b = DOM && document.getElementById("nfhbtn"); if (!b || !lane) return;
    const body = document.body;
    const off = body.classList.contains("tw-on") || body.classList.contains("tw-char") || lane.classList.contains("inmodal") || !!document.querySelector(AWAY);
    b.classList.toggle("nc-off", off);
    if (off) { lane.classList.remove("nc-hb"); return; }
    const lr = lane.getBoundingClientRect(), cands = [];
    if (innerWidth >= 900) {   // PC: right of the "World news" chip (gevstack.js)
      const wn = document.querySelector(".gevs-news");
      if (shown(wn)) { const r = wn.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) cands.push(rect(r.right + 8, r.top + (r.height - HB) / 2, HB, HB)); }
    }
    const home = rect(lr.left, lr.top, HB, HB);
    cands.push(home);
    for (let i = 1; i <= 6; i++) cands.push(rect(lr.left, lr.top + i * (HB + 8), HB, HB));   // step down the left edge
    for (let i = 1; i <= 4; i++) cands.push(rect(lr.left + i * (HB + 8), lr.top, HB, HB));   // or along the top
    // a screen title under the home spot makes room: its row starts after the button (layout-3)
    if (innerWidth < 900) roomForHome(home);
    const c = pick(cands, controls(hull(cands)).concat(headText(hull(cands))));
    b.style.left = Math.round(c.left) + "px"; b.style.top = Math.round(c.top) + "px";
    lane.classList.toggle("nc-hb", c === home);   // the messages flow to its right
  }

  /* big banners: the first free spot in a slim band at the top */
  function banners(o = {}) {
    const pb = DOM && document.getElementById("pbanners"); if (!pb) return;
    const reset = () => { pb.classList.remove("nc-fit"); for (const k of ["left", "right", "width", "top", "bottom"]) pb.style[k] = ""; };
    if (o.tw || document.querySelector("#modal .sheet")) { reset(); return; }   // a window: the old rule drops them to the bottom edge
    const kids = [...pb.children].filter(shown);
    if (!kids.length) return;
    const st = o.st || 0, m = o.m && o.m.right > 0 && o.m.bottom > 0 ? o.m : null, dun = shown(document.getElementById("dun"));
    const hdr = document.querySelector(".app .top"), hr = shown(hdr) ? hdr.getBoundingClientRect() : null;
    const fpt = document.getElementById("fpt"), fr = shown(fpt) ? fpt.getBoundingClientRect() : null;   // fptravel.js: never over the travel band
    const y0 = Math.max(hr && hr.bottom > 0 && hr.bottom < innerHeight * 0.3 ? hr.bottom + 4 : st + 6, fr && fr.bottom < innerHeight * 0.6 ? fr.bottom + 6 : 0);
    const y1 = Math.max(y0, innerHeight * (m || dun ? 0.2 : 0.3));
    const L = m ? Math.max(0, m.left) : 0, R = m ? Math.min(innerWidth, m.right) : innerWidth;
    pb.classList.add("nc-fit");
    pb.style.right = "auto"; pb.style.bottom = "auto"; pb.style.left = L + "px"; pb.style.width = R - L + "px";
    const H = Math.min(BAN_H * kids.length + 8 * (kids.length - 1), pb.getBoundingClientRect().height || BAN_H);
    const nat = Math.max(...kids.map((k) => k.offsetWidth)), want = Math.min(nat, R - L), minW = Math.min(want, 240);
    const zone = rect(L, y0, R - L, y1 - y0 + H), blockers = controls(zone);
    const hb = document.getElementById("nfhbtn"); if (shown(hb)) blockers.push(hb.getBoundingClientRect());
    let full = null, part = null, wide = null;
    for (let y = y0; y <= y1; y += 4) {
      const [a, b] = gap(L, R, rect(L, y, R - L, H), blockers), s = { y, a, b };
      if (!wide || b - a > wide.b - wide.a) wide = s;
      if (b - a >= want - 1) { full = s; break; }
      if (!part && b - a >= minW) part = s;
    }
    // a spot where the whole banner fits wins; else the first where a narrowed one fits; else the widest gap
    const s = full || part || wide, w = Math.min(want, s.b - s.a), mid = Math.min(Math.max((L + R) / 2, s.a + w / 2), s.b - w / 2);
    pb.style.left = Math.round(mid - w / 2) + "px"; pb.style.width = Math.round(w) + "px"; pb.style.top = Math.round(s.y) + "px";
  }

  /* phones: the Gather prompt sits right on the bottom bar, full width; the page gets room for it */
  function gnear() {
    const g = DOM && document.getElementById("gnear"); if (!g) return;
    const de = document.documentElement, on = !!g.firstElementChild && innerWidth < 900;
    if (!on) { if (document.body.classList.contains("nc-gdock")) { document.body.classList.remove("nc-gdock"); g.style.bottom = ""; de.style.removeProperty("--nc-gnear"); } return; }
    const tabs = document.getElementById("tabs"), tr = shown(tabs) ? tabs.getBoundingClientRect() : null;
    g.style.bottom = Math.max(0, Math.round(tr && tr.height ? innerHeight - tr.top : 0)) + "px";
    document.body.classList.add("nc-gdock");
    de.style.setProperty("--nc-gnear", Math.round(g.offsetHeight) + "px");
  }

  /* hud2.js calls this after placing the lane */
  function run(o = {}) {
    if (!DOM || !document.body) return;
    try { gnear(); } catch { /* layout only */ }
    try { hist(o.lane || document.getElementById("hudlane")); } catch { /* layout only */ }
    try { banners(o); } catch { /* layout only */ }
  }
  // a banner that just arrived is placed before it's painted (hud2.js remembers the map box for us)
  let last = {};
  if (DOM) {
    const watch = () => {
      const pb = document.getElementById("pbanners");
      if (!pb || pb.dataset.nc) return;
      pb.dataset.nc = "1";
      new MutationObserver(() => { try { banners(last); } catch { /* layout only */ } }).observe(pb, { childList: true });
    };
    setInterval(watch, 1000);
  }
  return { area, pick, gap, rect, run: (o) => { last = o || {}; run(last); }, hist, banners, gnear, AWAY };
})();
if (typeof module !== "undefined") module.exports = NOCOVER;
