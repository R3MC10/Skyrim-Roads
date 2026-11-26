/* The turn roster on the fight screen. [OURS module] (initiative)
   The maths is initiative.js; this draws it (tbfight.js render puts it in the top strip, on the leader's phone and on
   every teammate's phone the same way):
   - one portrait (44px) per slot: yours, every teammate's, followers, pets, summons, the foe's. A fast foe has two
     slots this round, marked 1 and 2, each with its own move chip; xN when a slot holds several moves;
   - heroes side by side share a turn: a bracket joins them, and the bracket that's playing now is lit;
   - after the round marker, the next round's order (if nothing changes) is dimmed;
   - a portrait that moves (staggered, stunned, hasted, slowed) slides to its new place over 220 ms while the status
     that moved it flashes on it; a lost slot fades, gets a cross, then folds away. Nothing reorders without showing it;
   - a phone shows 5-6 portraits and scrolls sideways, the group acting now and the next ones first; +N opens the
     whole roster (up to 16 fighters) with everyone's initiative, statuses and next move. Tapping a portrait says the same.
   Checked by tests/initiative_ui.py. */
const INITUI = (() => {
  const DOM = typeof document !== "undefined";
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const T = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang && I18N.lang() === "pl" ? I18N.tr(t) ?? t : t);
  const CFG = () => (typeof INIT !== "undefined" ? INIT.CFG : { slideMs: 220, skipMs: 700, strip: { phone: 6, pc: 12 } });
  const isFoe = (o) => (o.side ? o.side === "foe" : String(o.id).startsWith("foe"));
  const SLOT = ["", "①", "②", "③"];
  const reduce = () => (typeof ACCESS !== "undefined" && ACCESS.reduceMotion ? ACCESS.reduceMotion() : DOM && typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* the order as slots: entries of one foe slot (several moves) side by side become one unit */
  function units(sess) {
    const out = [];
    (sess.order || []).forEach((o, i) => {
      const u = o.u || `${o.id}.${i}`, last = out[out.length - 1];
      if (last && last.u === u && o.u) { last.es.push(o); last.is.push(i); return; }
      out.push({ u, es: [o], is: [i], o });
    });
    for (const x of out) {
      x.done = x.es.every((e) => e.done); x.skip = x.o.skip || null; x.out = x.o.out || null;
      x.moves = x.o.moves || x.es.length; x.left = x.es.filter((e) => !e.done).length;
    }
    return out;
  }
  /* who is acting now (not while the last moves still play out): the shared turn, or the one fighter */
  function liveNow(sess, x) {
    if (sess.done) return false;
    if (sess.mirror) { if (sess.gnow) return x.o.grp === sess.gnow && !x.done && !isFoe(x.o); const c = sess.cur; return !!c && !x.done && (x.o.id === c.id || (c.id === "me-wait" && x.o.id === "me")); }
    if (sess.gr) return x.is.some((i) => i >= sess.gr.start && i < sess.gr.end) && !x.done && !isFoe(x.o);
    return x.is.includes(sess.idx) && !x.done;
  }
  /* the foe's next moves (fightread.js), one per pending foe entry */
  function intentsFor(sess) {
    const m = new Map();
    try {
      if (typeof FIGHTREAD === "undefined" || sess.done) return m;
      const its = FIGHTREAD.intents(sess); let k = 0;
      for (let i = Math.max(0, sess.idx || 0); i < (sess.order || []).length; i++) {
        const o = sess.order[i]; if (!isFoe(o) || o.done || o.skip || o.out) continue;
        if (its[k]) m.set(o, its[k]); k++;
      }
    } catch (e) { /* no move chips */ }
    return m;
  }
  const portrait = (o, f) => (typeof COMBAT2 !== "undefined" && COMBAT2.portraitOf ? COMBAT2.portraitOf({ ...o, id: o.id === "host" ? "ally" : String(o.id) }, f) : `<span class="c2gl">${esc(String(o.name || "?")[0])}</span>`);
  const kind = (o) => (isFoe(o) ? "foe" : o.id === "me" ? "me" : "ally");
  const marksOf = (sess, o) => (typeof INIT !== "undefined" ? INIT.marks(sess, o) : []);
  const icOf = (k) => (typeof FXICONS !== "undefined" && FXICONS.TYPES[k] ? FXICONS.TYPES[k][0] : "•");
  const range = (it) => (it && it.hi > 0 ? ` ${Math.round(it.lo)}–${Math.round(it.hi)}` : "");
  const intentTxt = (it) => (it ? `${T(it.label)}${range(it)}${it.tgt && it.tgt.name ? ` → ${it.tgt.me ? T("you") : it.tgt.name}` : ""}` : "");

  /* what tapping a portrait says: initiative (roll + speed), its slot, statuses, its next move */
  function tip(sess, x, it) {
    const o = x.o, nm = o.id === "me" ? T("You") : o.name;
    const parts = [`${nm}: ${T("initiative")} ${o.init}`];
    if (o.d != null && o.spd != null) parts[0] += ` (${T("roll")} ${o.d} + ${T("speed")} ${o.spd}${o.gap ? ` − ${o.gap}` : ""})`;
    if (isFoe(o) && (o.slot || 0) > 0 && x.o.gap) parts.push(T("its 2nd turn this round"));
    if (x.moves > 1) parts.push(`${x.moves} ${T("moves in this turn")}`);
    for (const mk of marksOf(sess, o)) parts.push(T(mk.nm));
    if (x.out) parts.push(T("Knocked down: out of the order"));
    if (it) parts.push(`${T("Next")}: ${intentTxt(it)}`);
    else if (!isFoe(o) && !x.done && o.grp && x.o.grp) parts.push(T("Acts together with the heroes next to it in the order"));
    return parts.join(" · ");
  }

  /* one portrait */
  function chip(sess, x, st) {
    const o = x.o, f = sess.f, now = st.now(x), gone = st.gone(x), it = isFoe(o) ? st.its.get(x.es.find((e) => !e.done && !e.skip) || o) : null;
    const age = (t) => (t ? Date.now() - t : Infinity), sk = CFG().skipMs;
    const lost = (x.skip || x.out) && x.done && age(x.o.skipAt || x.o.outAt) > sk;
    const cls = ["tbini", "ini2", kind(o), now ? "now" : "", gone ? "gone" : "", x.skip ? "skip" : "", x.out ? "out" : "", lost ? "lost" : "", isFoe(o) && x.o.gap ? "again" : ""].filter(Boolean).join(" ");
    const mk = marksOf(sess, o).slice(0, 2).map((m) => `<b class="inimk" data-k="${m.k}">${m.ic}</b>`).join("");
    const why = o.why && typeof INIT !== "undefined" ? INIT.WHY[o.why] : "";
    const slot = isFoe(o) && st.fastSlots ? `<b class="tbag inislot">${SLOT[o.slot] || o.slot}</b>` : "";
    const mv = x.moves > 1 ? `<em class="inimv">×${x.moves}</em>` : "";
    const ic = it ? `<span class="iniint${it.big ? " big" : ""}">${it.ic || "!"}</span>` : "";
    const cross = x.skip || x.out ? `<s class="inicross" aria-hidden="true">✕</s>` : "";
    const delay = (x.skip || x.out) && x.done && !lost ? ` style="--inid:-${Math.min(sk, age(x.o.skipAt || x.o.outAt))}ms"` : "";
    return `<span class="${cls}" data-u="${esc(x.u)}" data-oi="${x.is[0]}"${why ? ` data-why="${why}"` : ""}${delay} role="listitem" data-tip="${esc(tip(sess, x, it))}"><span class="c2pt" aria-hidden="true">${portrait(o, f)}</span>${why ? `<b class="iniwhy" aria-hidden="true">${icOf(why)}</b>` : ""}${mk}${slot}${mv}${ic}<span class="c2nm">${esc(o.id === "me" ? T("You") : String(o.name || "").split(" ")[0])}</span><i>${o.init}</i>${cross}</span>`;
  }
  /* the next round, as it would go if nothing changes */
  function nextOf(sess) {
    if (sess.mirror) return sess.next || [];
    try { return typeof INIT !== "undefined" && sess.ini ? INIT.predict(sess) : []; } catch (e) { return []; }
  }
  function nxChip(sess, o) {
    return `<span class="tbini ini2 nx ${kind(o)}" data-u="${esc(o.uid || "nx." + o.id)}" role="listitem" data-tip="${esc(`${T("Next round")}: ${o.id === "me" ? T("You") : o.name} · ${T("initiative")} ${o.init}`)}"><span class="c2pt" aria-hidden="true">${portrait(o, sess.f)}</span>${isFoe(o) && o.slot > 1 ? `<b class="tbag inislot">${SLOT[o.slot] || o.slot}</b>` : ""}<i>${o.init}</i></span>`;
  }
  /* the strip (the inside of .tbord). o.acting(entry) / o.playing / o.actIdx: while the last moves play out on screen,
     the one acting in them is lit (tbfight.js render) */
  function strip(sess, o = {}) {
    const us = units(sess), its = intentsFor(sess);
    const foeSlots = new Set(us.filter((x) => isFoe(x.o)).map((x) => x.o.slot || 1)).size > 1 || us.some((x) => isFoe(x.o) && x.o.gap);
    const st = {
      its, fastSlots: foeSlots,
      now: (x) => (o.playing ? x.es.some((e) => o.acting(e)) : liveNow(sess, x)),
      gone: (x) => (o.playing ? o.actIdx >= 0 && x.is[x.is.length - 1] < o.actIdx : x.done && !x.skip && !x.out),
    };
    let html = "", i = 0;
    while (i < us.length) {
      const x = us[i], g = x.o.grp;
      if (g && !isFoe(x.o)) {   // a shared turn: a bracket round everyone in it
        let j = i; const run = [];
        while (j < us.length && ((us[j].o.grp === g) || (us[j].skip && isFoe(us[j].o) && us[j + 1] && us[j + 1].o.grp === g))) { run.push(us[j]); j++; }
        const heroes = run.filter((y) => !isFoe(y.o) && !y.out).length;
        if (heroes > 1) {
          const lit = run.some((y) => st.now(y));
          html += `<span class="inigrp${lit ? " now" : ""}" role="group" aria-label="${esc(T("Shared turn"))}">${run.map((y) => chip(sess, y, st)).join("")}</span>`;
          i = j; continue;
        }
      }
      html += chip(sess, x, st); i++;
    }
    const nx = nextOf(sess);
    if (nx.length && !sess.done) html += `<span class="inisep" role="separator" data-tip="${esc(T("Next round, if nothing changes"))}">${esc(T("Round"))} ${(sess.round || 0) + 1}</span>` + nx.map((n) => nxChip(sess, n)).join("");
    return html;
  }
  /* the +N button: everyone who doesn't fit on the strip */
  function more(sess, wide) {
    const n = units(sess).length + nextOf(sess).length, fit = wide ? CFG().strip.pc : CFG().strip.phone;
    return `<button class="inimore" data-tbx="roster" aria-label="${esc(T("Whole turn order"))}" data-tip="${esc(T("Whole turn order"))}">${n > fit ? "+" + (n - fit) : "≡"}</button>`;
  }

  /* the whole roster (the +N sheet) */
  function sheet(sess) {
    const us = units(sess), its = intentsFor(sess), f = sess.f;
    const row = (x, dim) => {
      const o = x.o, it = isFoe(o) ? its.get(x.es.find((e) => !e.done && !e.skip) || o) : null, mk = dim ? [] : marksOf(sess, o);
      const sub = [o.d != null && o.spd != null ? `${T("roll")} ${o.d} + ${T("speed")} ${o.spd}${o.gap ? ` − ${o.gap}` : ""}` : "", x.moves > 1 ? `${x.moves} ${T("moves")}` : "",
        ...mk.map((m) => T(m.nm)), x.out ? T("Knocked down") : "", it ? `${T("Next")}: ${intentTxt(it)}` : ""].filter(Boolean).join(" · ");
      const state = dim ? "" : x.done ? (x.skip ? T("Lost") : x.out ? T("Out") : T("Done")) : liveNow(sess, x) ? T("Now") : "";
      return `<li class="inirow ${kind(o)}${dim ? " nx" : ""}${x.done ? " gone" : ""}${x.skip ? " skip" : ""}"><span class="c2pt">${portrait(o, f)}</span><span class="inirt"><b>${esc(o.id === "me" ? T("You") : o.name)}${isFoe(o) && (o.slot || 0) > 0 && us.filter((y) => isFoe(y.o)).length > 1 ? ` ${SLOT[o.slot] || ""}` : ""}</b><small>${esc(sub)}</small></span><span class="iniri"><i>${o.init}</i>${state ? `<em>${esc(state)}</em>` : ""}</span></li>`;
    };
    let body = "", i = 0;
    while (i < us.length) {
      const x = us[i], g = x.o.grp;
      if (g && !isFoe(x.o)) {
        let j = i; while (j < us.length && us[j].o.grp === g) j++;
        if (j - i > 1) { body += `<li class="inishared"><span>${esc(T("Shared turn"))}</span><ul>${us.slice(i, j).map((y) => row(y)).join("")}</ul></li>`; i = j; continue; }
      }
      body += row(x); i++;
    }
    const nx = nextOf(sess);
    if (nx.length && !sess.done) body += `<li class="inisep2">${esc(T("Round"))} ${(sess.round || 0) + 1} · ${esc(T("if nothing changes"))}</li>` + nx.map((n) => row({ o: n, es: [n], is: [], moves: n.moves || 1 }, true)).join("");
    return `<div class="inisheet" role="dialog" aria-label="${esc(T("Turn order"))}"><div class="inisheetin"><div class="inihead"><b>${esc(T("Turn order"))} · ${esc(T("Round"))} ${sess.round || 1}</b><button class="tbff inix" data-tbx="rosterx" aria-label="${esc(T("Close"))}">✕</button></div>
      <p class="inihelp">${esc(T("Highest initiative acts first. Initiative is rolled once a fight (1-4) plus speed. Stuns and freezes cost a turn, a stagger pushes a turn back, haste and slow move you up or down. Heroes next to each other act together."))}</p><ol class="inilist">${body}</ol></div></div>`;
  }

  // ------------------------------------------------------------------ the slide (FLIP) and the flash
  let prev = null;
  const STEP = 47;   // a portrait (44px) and the gap (3px)
  const raf = (fn) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16));
  /* before the screen is drawn again: the place of every portrait in the strip. Places, not pixels: reading the
     layout in the middle of a redraw forces a full layout of the fight screen (and crashed headless Chromium) */
  function before(el) {
    if (!DOM || !el) return;
    const strip = el.querySelector(".tbord"); if (!strip) { prev = null; return; }
    prev = { m: new Map(), sl: strip.scrollLeft };
    [...strip.querySelectorAll(".tbini[data-u]")].forEach((c, k) => prev.m.set(c.dataset.u, k));
  }
  /* after: whoever moved slides from the old place to the new one, the reason flashing on them; the strip then
     scrolls (next frame, when the layout is done anyway) so the group acting now starts it */
  function after(el, sess) {
    if (!DOM || !el) return;
    const strip = el.querySelector(".tbord"); if (!strip) return;
    const rm = reduce(), ms = CFG().slideMs, p = prev; prev = null;
    if (p) strip.scrollLeft = p.sl;
    const moved = [];
    if (p) [...strip.querySelectorAll(".tbini[data-u]")].forEach((c, k) => {
      const k0 = p.m.get(c.dataset.u);
      if (k0 != null && k0 !== k && !c.classList.contains("gone")) moved.push([c, (k0 - k) * STEP]);
    });
    for (const [c, dx] of moved) {
      if (c.dataset.why) c.classList.add("iniflash");   // the status that moved it
      if (rm) continue;
      c.style.transition = "none"; c.style.transform = `translateX(${dx}px)`;
    }
    if (moved.length && !rm) raf(() => raf(() => {
      for (const [c] of moved) { c.style.transition = `transform ${ms}ms ease-out`; c.style.transform = ""; }
      setTimeout(() => { for (const [c] of moved) c.style.transition = ""; }, ms + 40);
    }));
    raf(() => {
      if (!strip.isConnected) return;
      const first = strip.querySelector(".tbini.now") || strip.querySelector(".tbini.ini2:not(.gone):not(.lost):not(.nx)");
      const target = first ? Math.max(0, (first.closest(".inigrp") || first).offsetLeft - 4) : 0;
      if (Math.abs(strip.scrollLeft - target) < 2) return;
      if (p && !rm && typeof strip.scrollTo === "function") strip.scrollTo({ left: target, behavior: "smooth" }); else strip.scrollLeft = target;
    });
  }
  return { units, strip, more, sheet, before, after, tip, liveNow };
})();
if (typeof module !== "undefined") module.exports = INITUI;
