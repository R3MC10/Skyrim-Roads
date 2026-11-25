/* The fight screen in three zones. [OURS] (fightscreen)
   Combat overhaul step 1 (with ChatGPT): "read the threat, make a choice, feel the hit". Before this, the foe's plate,
   the log, the party plates and the first-fight tips floated over the battle picture wherever there was a gap, so on a
   phone something always sat on a fighter.
   combat2.js still builds the immersive screen; on every layout pass it asks this module where things go:
   - Phone (the tall layout):
       top     the turn order, the boss bar, the foe's card (its next move, health with numbers, statuses) and the
               one-line event log (its fold arrow from phonefight.js);
       middle  the battlefield: the picture is sized and moved so every fighter stands inside this band;
       bottom  your orb and the party plates, the first-fight tips, then the move dock (44px+ buttons, phonefight.js).
   - PC (the wide layout): the party roster down the left with your orb under it, the selected foe's card and the whole
     fight history down the right, the battlefield in the centre. The picture is clipped to the centre, so fightart.js
     (its bandOf) lays everyone out there and no side panel ever covers a fighter.
   Nothing permanent covers the fighters: pop-ups and numbers still fly, and big banners (fightpres.js) show one at a
   time at the top of the battlefield. Nothing scrolls during a fight.
   Pure helpers (sides, span, stage) are checked in tests/test_fightzones.js; tests/fightscreen_ui.py checks the screen.
   ?nozones in the address shows the old floating layout (for comparing). */
const FIGHTZONES = (() => {
  const DOM = typeof document !== "undefined";
  const A = 1 / 0.66;   // the fight picture is 0.66 as tall as it is wide (fightart.js)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function on() {
    if (!DOM) return false;
    if (typeof location !== "undefined" && /[?&]nozones\b/.test(location.search)) return false;
    return typeof COMBAT2 === "undefined" || COMBAT2.on();
  }

  // ------------------------------------------------------------------ pure geometry
  /* PC: the widths of the left (party) and right (target + history) columns */
  const sides = (W) => ({ L: Math.round(clamp(W * 0.17, 250, 340)), R: Math.round(clamp(W * 0.19, 280, 380)) });
  /* how much of the picture's height the fighters use (heads and raised weapons to feet), from fightart.js's layout */
  function span(fp) {
    let t = 0.32, b = 0.8;
    if (fp && fp.Hh) {
      const all = [fp.hero, fp.foe, ...(fp.allies || []), ...(fp.flyers || []), ...(fp.waiting || []), ...(fp.summon ? [fp.summon] : [])].filter((p) => p && isFinite(p.top) && isFinite(p.y));
      if (all.length) { t = Math.min(...all.map((p) => p.top)) / fp.Hh; b = Math.max(...all.map((p) => p.y)) / fp.Hh; }
    }
    return { t: clamp(t - 0.07, 0.02, 0.6), b: clamp(b + 0.04, 0.5, 1) };
  }
  /* the picture's box (in the middle zone's own x, the screen's y) so the fighters stand inside mid {t, b, w}. It is at
     most 1.6x as wide as the part you see (fightart.js lays everyone out in the visible part) */
  function stage(mid, sp) {
    const mh = Math.max(60, mid.b - mid.t), f = Math.max(0.2, sp.b - sp.t);
    let ch = (mh * 0.94) / f;
    ch = Math.max(110, Math.min(ch, (1.6 * mid.w) / A));
    const cw = ch * A;
    return { cx: (mid.w - cw) / 2, cy: mid.t + (mh - f * ch) / 2 - sp.t * ch, cw, ch };
  }

  // ------------------------------------------------------------------ the first-fight tips (onboard.js) get their own band
  const tips = () => (DOM ? [...document.querySelectorAll("#fhints .fhint:not([hidden])")].filter((e) => e.getClientRects().length) : []);
  function tipBands() {
    let top = 0, bot = 0;
    for (const e of tips()) { const h = (e.offsetHeight || 40) + 8; if (e.classList.contains("below")) top += h; else bot += h; }
    return { top, bot };
  }
  /* a short phone: only one tip at a time (onboard.js) */
  const short = () => DOM && typeof innerHeight === "number" && innerHeight < 720 && !!document.querySelector("#tbf.fz:not(.fzw)");

  // ------------------------------------------------------------------ where everything goes (combat2.js place)
  let last = null;   // the zones of the last pass, in .tbin px: {tin, tipTop:[t,b], tipBot:[t,b], line}
  /* o = {W, H, top, dh, wide}. Returns the picture's box {cx, cy, cw, ch} in .tbin px and ox (where the clipped scene
     starts), or null when zones are off */
  function place(el, o) {
    if (!DOM || !el || !on()) { if (el) el.classList.remove("fz", "fzw"); return null; }
    const tin = el.querySelector(".tbin"); if (!tin) return null;
    el.classList.add("fz"); el.classList.toggle("fzw", !!o.wide);
    const tr = tin.getBoundingClientRect(), z = tin.offsetWidth ? tr.width / tin.offsetWidth || 1 : 1;
    const rel = (n) => {
      if (!n || !n.getClientRects().length) return null;
      const b = n.getBoundingClientRect();
      return b.width || b.height ? { l: (b.left - tr.left) / z, t: (b.top - tr.top) / z, r: (b.right - tr.left) / z, b: (b.bottom - tr.top) / z } : null;
    };
    const W = o.W, H = o.H, dockTop = H - o.dh;
    const st = tin.style, px = (v) => v.toFixed(1) + "px";
    const strip = rel(el.querySelector(".tbtop")), top0 = (strip ? strip.b : o.top) + 4;
    const tb = tipBands();
    const bf = el.querySelector(".bfwrap"), foe = el.querySelector(".c2ov .tbu.foe"), log = el.querySelector(".c2ov .tblog"),
      me = el.querySelector(".c2ov .tbu.me"), party = el.querySelector(".c2ov .tbparty");
    const logOn = log && !log.hidden && log.offsetHeight > 0;
    let mid;
    if (!o.wide) {
      let y = top0;
      const tipTop = [y, y + tb.top]; y += tb.top;
      if (bf) { bf.style.left = ""; bf.style.width = ""; bf.style.top = px(y); y += bf.offsetHeight + 4; }
      if (foe) { foe.style.left = "8px"; foe.style.top = px(y); foe.style.width = ""; y += foe.offsetHeight + 4; }
      if (logOn) {   // the fold arrow (44px, phonefight.js) sits on the first line: the row keeps room for all of it
        const lh = log.offsetHeight, line = Math.min(lh, 22), off = Math.max(0, 22 - line / 2);
        log.style.left = "8px"; log.style.top = px(y + off); log.style.width = ""; log.style.height = ""; log.style.maxHeight = "";
        y += Math.max(44, off + lh) + 2;
      }
      const low = dockTop - tb.bot;
      st.setProperty("--fzbot", px(H - low + 4));
      if (typeof FIGHTFIT !== "undefined") { try { FIGHTFIT.party(el, { ...o, top: y }); } catch (e) { /* plates keep their row */ } }
      const hud = [rel(me), ...(party ? [...party.children].map(rel) : [])].filter(Boolean);
      const hudTop = hud.length ? Math.min(...hud.map((r) => r.t)) : low;
      mid = { l: 0, r: W, t: y + 2, b: Math.max(y + 60, hudTop - 4), ox: 0, tipTop, tipBot: [low, dockTop] };
    } else {
      const S = sides(W), Lx = S.L, Rx = W - S.R;
      st.setProperty("--fzl", px(Lx)); st.setProperty("--fzr", px(S.R)); st.setProperty("--fzpt", px(top0 + 4));
      st.setProperty("--fzbot", px(H - dockTop + 12));
      let y = top0;
      if (bf) { bf.style.left = px(Lx + 8); bf.style.width = px(Rx - Lx - 16); bf.style.top = px(y); y += bf.offsetHeight + 4; }
      const tipTop = [y, y + tb.top]; y += tb.top;
      let ry = top0 + 4;   // right: the selected foe, then the fight's history down to the dock
      if (foe) { foe.style.left = px(Rx + 12); foe.style.top = px(ry); foe.style.width = px(S.R - 24); ry += foe.offsetHeight + 10; }
      if (log) { log.style.left = px(Rx + 12); log.style.top = px(ry); log.style.width = px(S.R - 24); log.style.height = ""; log.style.maxHeight = px(Math.max(60, dockTop - 12 - tb.bot - ry)); }   // grows with the fight, newest at the bottom, clear of the tips over the dock
      if (typeof FIGHTFIT !== "undefined") { try { FIGHTFIT.party(el, o); } catch (e) { /* plates keep their column */ } }
      const low = dockTop - tb.bot - 6;
      mid = { l: Lx, r: Rx, t: y + 2, b: Math.max(y + 120, low), ox: Lx, tipTop, tipBot: [low, dockTop] };
    }
    st.setProperty("--fzmt", px(mid.t)); st.setProperty("--fzmb", px(mid.b));
    const fp = el.querySelector(".fscene canvas")?.__fp;
    const g = stage({ t: mid.t, b: mid.b, w: mid.r - mid.l }, span(fp));
    last = { tin, mid, line: mid.t + 8 };
    return { cx: g.cx + mid.l, cy: g.cy, cw: g.cw, ch: g.ch, ox: mid.ox, mid };
  }

  /* page px of the tip bands, for onboard.js: {top: [t, b], bot: [t, b], x: [l, r]} (or null: tips float as before) */
  function bands() {
    if (!DOM || !last || !last.tin.isConnected || !document.querySelector("#tbf.fz")) return null;
    const tr = last.tin.getBoundingClientRect(), z = last.tin.offsetWidth ? tr.width / last.tin.offsetWidth || 1 : 1, m = last.mid;
    const Y = (v) => tr.top + v * z;
    return { top: [Y(m.tipTop[0]), Y(m.tipTop[1])], bot: [Y(m.tipBot[0]), Y(m.tipBot[1])], x: [tr.left + m.l * z, tr.left + m.r * z] };
  }
  /* page y for a big banner's middle (fightpres.js): the top of the battlefield, over the fighters' heads */
  function bannerY() {
    if (!DOM || !last || !last.tin.isConnected || !document.querySelector("#tbf.fz")) return null;
    const tr = last.tin.getBoundingClientRect(), z = last.tin.offsetWidth ? tr.width / last.tin.offsetWidth || 1 : 1;
    return { y: tr.top + (last.mid.t + 34) * z, x: tr.left + ((last.mid.l + last.mid.r) / 2) * z };
  }
  /* the tips changed (onboard.js): lay the screen out again so they get their band */
  function relayout() {
    if (!DOM) return;
    const el = document.getElementById("tbf");
    if (el && el.classList.contains("fz") && typeof COMBAT2 !== "undefined" && COMBAT2.place) { try { COMBAT2.place(el, true); } catch (e) { /* next pass */ } }
  }

  // back from the background (or a rotated phone): lay the fight out again for the screen it has now
  if (DOM && typeof addEventListener === "function") addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(relayout, 60); });

  return { on, sides, span, stage, place, bands, bannerY, relayout, short, tipBands };
})();
if (typeof module !== "undefined") module.exports = FIGHTZONES;
