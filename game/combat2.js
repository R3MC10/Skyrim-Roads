/* The immersive fight screen. [OURS]
   A player: "this is old school — redesign the whole combat to make it immersive, buttons are stale, be creative, try to
   fit everything on one screen" and "all the info cards should be IN the combat".
   tbfight.js still builds the fight screen (and fightctl.js / fightread.js / foeintent.js / bossfight.js / tbui.js still
   add their parts); this module only rearranges it after each redraw and adds the extras:
   - The battle scene fills the screen. Where it doesn't reach (tall phones, wide PCs) a soft, blurred copy of it does,
     so there are no empty bars.
   - The foe's card becomes a nameplate floating over the foe: slim health bar, status icons, its next moves.
     (Your own numbers live only in the orb below: fightdeclutter.js.)
   - Your vitals sit in a HUD in the corner: a health orb (with what's about to come off it striped), magicka and
     stamina arcs around it, your statuses next to it.
   - Followers and party members are small plates in the scene (still drop targets for heals).
   - The fight log is a short fading feed in a scene corner; tap it for the full log.
   - The turn order is a slim ribbon of portraits.
   - The action bar is a skill bar: round drawn-icon moves with their stamina / magicka / health cost, quick slots, Magic and Items open as a drawer
     over the scene, and a big End turn seal that shows the guard you'd get.
   - Hits flash, crits shake, a stunned foe gets circling stars.
   Settings → Fights → Fight screen: Immersive / Classic. */
const COMBAT2 = (() => {
  const DOM = typeof document !== "undefined";
  const A = 1 / 0.66;          // fightart.js: the turn-by-turn stage is 0.66 as tall as it is wide
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const prefs = () => { try { return JSON.parse(localStorage.getItem("rotn_prefs") || "{}"); } catch { return {}; } };
  const reduce = () => DOM && ((typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) || document.documentElement.classList.contains("a11y-still"));
  const T = (t) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(t) : t);

  /* on unless switched off in Settings (or ?classic in the address, for comparing) */
  function on() {
    if (!DOM) return false;
    if (typeof location !== "undefined" && /[?&]classic\b/.test(location.search)) return false;
    return prefs().tbC2 !== false;
  }
  function settingsHTML(seg) {
    if (typeof seg !== "function") return "";
    return `<div class="setrow"><span>Fight screen</span>${seg("tbC2", [[true, "Immersive"], [false, "Classic"]], prefs().tbC2 !== false)}</div>`;
  }

  // ------------------------------------------------------------------ numbers from the bars tbfight.js drew
  function num(el) {
    const m = /(\d+)\s*\/\s*(\d+)/.exec(el?.textContent || "");
    return m ? { v: +m[1], m: Math.max(1, +m[2]) } : null;
  }
  const pc = (o) => (o ? Math.max(0, Math.min(100, (100 * o.v) / o.m)) : 0);

  // ------------------------------------------------------------------ pieces
  let mem = { sess: null, dock: 0, hp: null, mp: null, sp: null, mine: false };
  function portraitOf(o, f) {
    try {
      if (o.id === "me" && typeof HEROART !== "undefined") return HEROART.portrait(f.s, 30);
      const al = o.al;
      if (al && al.fid && typeof UIART !== "undefined" && UIART.follower) { const p = UIART.follower(al.fid, 30); if (p) return p; }
    } catch { /* fall back to a letter */ }
    const g = o.id.startsWith("foe") ? (f.e?.player ? "" : "") : o.id === "sum" ? "✦" : esc(String(o.name || "?").trim()[0] || "?");
    return `<span class="c2gl">${g}</span>`;
  }
  /* the turn order: portraits in a ribbon */
  function ribbon(el, sess) {
    const chips = el.querySelectorAll(".tbtop .tbord .tbini");
    chips.forEach((c, i) => {
      const o = sess.order[i]; if (!o) return;
      const ini = c.querySelector("i")?.textContent || "", ag = c.querySelector(".tbag")?.textContent || "";   // the same foe's 2nd/3rd move this round (tbfight.js)
      c.innerHTML = `<span class="c2pt" aria-hidden="true">${portraitOf(o, sess.f)}</span><span class="c2nm">${esc(String(o.name || "").split(" ")[0])}</span>${ag ? `<b class="tbag">${esc(ag)}</b>` : ""}<i>${esc(ini)}</i>`;
    });
    const rb = el.querySelector(".tbtop > b");
    if (rb && !rb.classList.contains("c2rd")) { rb.classList.add("c2rd"); rb.innerHTML = `<small>${esc(T("Round"))}</small>${esc(String(sess.round))}`; }
  }
  /* your corner HUD: a health orb with magicka and stamina arcs */
  function arc(a0, a1, r) {   // degrees, clockwise on screen
    const p = (a) => [50 + r * Math.cos((a * Math.PI) / 180), 50 + r * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 ${a1 > a0 ? 1 : 0} ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  const L_ARC = arc(112, 248, 46), R_ARC = arc(68, -68, 46);
  function orb(me, sess, playing) {
    const hp = num(me.querySelector(".tbbar.big.hp .num")), mp = num(me.querySelector(".tbbar.mp .num")), sp = num(me.querySelector(".tbbar.sp .num"));
    if (!hp) return;
    let inc = 0;
    try { if (!playing && !sess.done && typeof FIGHTREAD !== "undefined") { const fc = FIGHTREAD.forecast(sess); inc = Math.round((fc.me.hit || 0) + (fc.me.dot || 0)); } } catch { inc = 0; }
    const h = pc(hp), incP = Math.min(h, (100 * inc) / hp.m);
    const was = mem.hp != null && mem.sess === sess ? mem.hp : h;
    const low = h <= 30 ? " low" : "";
    const d = document.createElement("div");
    d.className = "c2orb" + low; d.setAttribute("aria-hidden", "true");
    d.innerHTML = `<svg viewBox="0 0 100 100" class="c2arcs"><path class="tr" d="${L_ARC}" pathLength="100"/><path class="tr" d="${R_ARC}" pathLength="100"/>
        <path class="mp" d="${L_ARC}" pathLength="100" stroke-dasharray="${pc(mp).toFixed(1)} 100"/><path class="sp" d="${R_ARC}" pathLength="100" stroke-dasharray="${pc(sp).toFixed(1)} 100"/></svg>
      <div class="c2glass"><i class="liq" style="height:${was.toFixed(1)}%" data-to="${h.toFixed(1)}"></i>${incP >= 1 ? `<i class="inc" style="bottom:${(h - incP).toFixed(1)}%;height:${incP.toFixed(1)}%"></i>` : ""}<b class="num">${hp.v}</b><small class="num">/${hp.m}</small></div>
      <span class="c2mpn num">${mp ? mp.v : ""}</span><span class="c2spn num">${sp ? sp.v : ""}</span>`;
    me.prepend(d);
    if (h !== was) requestAnimationFrame(() => requestAnimationFrame(() => { const q = d.querySelector(".liq"); if (q) q.style.height = h.toFixed(1) + "%"; }));
    mem.hp = h;
    return { h, m: pc(mp), s: pc(sp) };
  }

  // ------------------------------------------------------------------ the blurred copy of the scene behind it
  let bdT = null;
  function backdrop(stage) {
    let bd = stage.querySelector(".c2bd");
    if (typeof FIGHTSET !== "undefined" && !FIGHTSET.backdrop()) { clearInterval(bdT); bd?.remove(); return; }   // Fight quality: Low
    if (!bd) { bd = document.createElement("canvas"); bd.className = "c2bd"; bd.width = 48; bd.height = 32; bd.setAttribute("aria-hidden", "true"); stage.prepend(bd); }
    clearInterval(bdT);
    const copy = () => {
      const el = document.getElementById("tbf");
      if (!el || !bd.isConnected) { clearInterval(bdT); return; }
      if (document.hidden) return;
      const cv = el.querySelector(".tbscene .fscene canvas"); if (!cv || !cv.width) return;
      try { const g = bd.getContext("2d"); g.drawImage(cv, 0, 0, bd.width, bd.height); bd.classList.add("on"); } catch { /* not ready */ }
    };
    copy(); setTimeout(copy, 120);
    bdT = setInterval(copy, reduce() ? 2000 : 450);
  }

  // ------------------------------------------------------------------ where everything goes
  /* [pc] On a PC (any wide window) the fight picture fills the whole window, like the map home screen (pcmap.js): the
     stage is drawn at the window's own shape instead of the phone's 0.66, and the cards and skill bar float over it. */
  const wideOf = (W, H) => W >= 900 && W / H >= 1.25;
  const shapeOf = (W, H) => Math.max(0.36, Math.min(0.66, H / W));
  function aspect() {
    if (!DOM || !on()) return null;
    const tin = document.querySelector("#tbf .tbin");
    const W = (tin && tin.clientWidth) || (typeof innerWidth === "number" ? innerWidth : 0), H = (tin && tin.clientHeight) || (typeof innerHeight === "number" ? innerHeight : 0);
    return W && H && wideOf(W, H) ? shapeOf(W, H) : null;
  }
  function place(el, late) {
    const tin = el.querySelector(".tbin"); if (!tin || !el.classList.contains("c2")) return;
    const W = tin.clientWidth, H = tin.clientHeight; if (!W || !H) return;
    const wide = wideOf(W, H);
    el.classList.toggle("c2wide", wide); el.classList.toggle("c2tall", !wide);
    const dock = el.querySelector(".tbdock");
    const mainUp = !!dock?.querySelector(".fc:not(.fc-pick), .tbgrid, .tbwheel");
    const dockH = dock ? dock.getBoundingClientRect().height : 0;   // (Fight UI size zooms the bar: measure what's on screen)
    if (mainUp && dockH > 40) mem.dock = dockH;
    const top = (el.querySelector(".tbtop")?.offsetHeight || 40) + 4;
    /* [magicaim] the list in Magic / Items is capped from the screen's height (never from the bar itself: no loop), and
       the scene, your orb and the party plates make room for what the bar covers right now, Magic drawer included,
       so the drawer never hides anyone you could cast on (fightfit.js) */
    const FF = typeof FIGHTFIT !== "undefined" ? FIGHTFIT : null;
    if (FF) tin.style.setProperty("--c2list", FF.listMax(W, H, wide) + "px");
    const cover = FF ? FF.cover(tin, dock) : 0;
    const dh = Math.max(mem.dock || 0, cover, wide ? 118 : 178);
    const aH = H - dh;
    let ch, cw, cx, cy;
    if (wide) {   // the whole window: the picture is drawn at this shape (aspect() above), so nothing is cut off
      cw = W; ch = W * shapeOf(W, H); cx = 0; cy = ch > H ? (H - ch) * 0.6 : (H - ch) / 2;
      if (FF) ({ cw, ch, cx, cy } = FF.wideStage(W, H, cw, ch, cx, cy, top, dh));   // feet above the bar, heads under the turn strip
    } else {
      ch = Math.max(110, Math.min(aH * 0.8, (W * 1.34) / A));
      cw = ch * A; cx = (W - cw) / 2;
      cy = top + Math.max(0, aH - top - ch) * 0.5;
      if (cy + ch > aH + 10) cy = Math.max(0, aH + 10 - ch);
    }
    const s = ch / 150, gy = cy + ch * 0.8;
    let hx = cx + cw * 0.27, hy = gy - 66 * s, fx = cx + cw * 0.72, fy = gy - 74 * s;
    // [fightpos] where fightart.js really put you and the foe (fightpos.js): the plate, pop-ups and flashes follow them
    const FL = tin.querySelector(".fscene canvas")?.__fp;
    if (FL && FL.W && FL.Hh) { const kx = cw / FL.W, ky = ch / FL.Hh; hx = cx + FL.hero.x * kx; hy = cy + (FL.hero.top + 6 * FL.s) * ky; fx = cx + FL.foe.x * kx; fy = cy + FL.foe.top * ky; }
    const st = tin.style, px = (v) => v.toFixed(1) + "px";
    st.setProperty("--c2cw", px(cw)); st.setProperty("--c2ch", px(ch)); st.setProperty("--c2cx", px(cx)); st.setProperty("--c2cy", px(cy));
    st.setProperty("--c2dock", px(dh)); st.setProperty("--c2top", px(top)); st.setProperty("--c2ah", px(aH));
    st.setProperty("--c2hx", px(hx)); st.setProperty("--c2hy", px(hy)); st.setProperty("--c2fx", px(fx)); st.setProperty("--c2fy", px(fy));
    st.setProperty("--c2side", px(wide ? Math.max(240, Math.min(340, W * 0.18)) : Math.max(150, cx - 24)));
    // the foe's arrow (foeintent.js) is measured off the picture: draw it again when the picture moved
    const geo = [cx, cy, cw].map((v) => Math.round(v)).join();
    if (geo !== mem.geo || late) {
      mem.geo = geo;
      try { tin.querySelector(".fscene canvas")?.__fpRe?.(); } catch { /* the scene lays out on its next frame */ }
      const ar = el.querySelector(".fitarrow");
      if (ar && mem.sess && typeof FOEINTENT !== "undefined") { try { FOEINTENT.decorate(el, mem.sess); } catch { /* the arrow is a nicety */ } }
    }
    // the foe's plate: over its head, inside the screen, under the ribbon (and the boss bar)
    const plate = typeof FOEPANEL !== "undefined" ? null : el.querySelector(".c2ov .tbu.foe");   // [foepanel] places it (below)
    if (plate) {
      const bf = el.querySelector(".bfwrap"), minTop = Math.max(top, bf ? bf.getBoundingClientRect().bottom - tin.getBoundingClientRect().top : 0) + 4;
      const pw = plate.offsetWidth, ph = plate.offsetHeight;
      const L = Math.max(6, Math.min(W - pw - 6, fx - pw / 2));
      const Tp = Math.max(minTop, Math.min(fy - ph - 6, aH - ph - 8));
      plate.style.left = px(L); plate.style.top = px(Tp);
      const lg = el.querySelector(".c2ov .tblog");
      if (lg && !wide) lg.style.maxWidth = px(Math.max(120, Math.min(W * 0.62, Tp < top + 70 ? L - 14 : W * 0.62)));
    }
    if (FF) { FF.party(el, { W, H, top, dh, wide }); FF.unclash(el, { W, H, top, dh }); }   // a full party: more columns / slimmer plates instead of running off screen
    if (typeof FOEPANEL !== "undefined") FOEPANEL.place(el, { W, H, top, dh, wide });   // [foepanel] the plate over the foe's head (never on a fighter), the log in a free corner
  }
  let rsT = null;
  if (DOM && typeof addEventListener === "function") addEventListener("resize", () => { clearTimeout(rsT); rsT = setTimeout(() => { const el = document.getElementById("tbf"); if (el) place(el); }, 60); });

  // ------------------------------------------------------------------ "+Oakflesh", "Poisoned", "Oakflesh fades"
  const fxSeen = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function fxPops(ov, now, done) {
    if (!fxSeen) return;
    const first = !mem.fxOn; mem.fxOn = true;
    let i = 0;
    for (const [who, list, card] of now) {
      const key = typeof who === "string" ? (mem["fx_" + who] = mem["fx_" + who] || {}) : who;
      const was = fxSeen.get(key) || new Map(), is = new Map(list.map((x) => [x.id, x]));
      fxSeen.set(key, is);
      if (first || done || reduce()) continue;
      const pops = [];
      for (const [id, x] of is) if (!was.has(id)) pops.push([x.buff ? `+${x.lbl || x.nm}` : x.lbl || x.nm, x.buff ? "buff" : "debuff", x.ic]);
      for (const [id, x] of was) if (!is.has(id) && x.k !== "guard" && x.k !== "sneak" && x.k !== "staggered" && x.k !== "stunned") pops.push([FXICONS.tr ? FXICONS.tr(`${x.nm} fades`) : `${x.nm} fades`, "gone", x.ic]);
      if (!pops.length) continue;
      // the screen redraws often, so the pop-ups live in their own layer over it, at the fighter's spot
      const tin = ov.closest(".tbin"), r = tin?.getBoundingClientRect(); if (!r) continue;
      const v = (n) => parseFloat(tin.style.getPropertyValue(n)) || 0;
      let x, y;
      if (who === "me") { x = r.left + v("--c2hx"); y = r.top + v("--c2hy") - 14; }
      else if (who === "foe") { x = r.left + v("--c2fx"); y = r.top + v("--c2fy") + v("--c2ch") * 0.12; }
      else { const cr = card?.getBoundingClientRect(); if (!cr || !cr.width) continue; x = cr.left + cr.width / 2; y = cr.top - 4; }
      let layer = document.getElementById("c2pops");
      if (!layer) { layer = document.createElement("div"); layer.id = "c2pops"; layer.setAttribute("aria-hidden", "true"); document.body.appendChild(layer); }
      pops.slice(0, 4).forEach(([txt, cls, ic], j) => {
        const p = document.createElement("span");
        p.className = `c2pop ${cls}`;
        p.style.left = x.toFixed(0) + "px"; p.style.top = (y - j * 22).toFixed(0) + "px";
        p.style.animationDelay = (0.2 * (i + j)).toFixed(2) + "s";
        p.innerHTML = `<i>${ic}</i>${esc(txt)}`;
        layer.appendChild(p);
        if (typeof FIGHTNUMS !== "undefined") FIGHTNUMS.nudge(p);   // [fightnums] off the foe's plate and the buttons
        setTimeout(() => p.remove(), 2700 + 200 * (i + j));
      });
      i += Math.min(4, pops.length);
    }
  }

  // ------------------------------------------------------------------ the result card
  /* what the fight came to, from the event list: damage you (and your side) dealt and took, the biggest single blow */
  function tally(sess) {
    const f = sess.f || {};
    let dealt = 0, taken = 0, best = 0, pe = sess.ehpMax ?? f.ehp0 ?? null, ph = f.hp0 ?? null;
    for (const e of sess.ev || []) {
      if (e.ehp != null) { if (pe != null && e.ehp < pe) { const d = pe - e.ehp; dealt += d; if (e.kind !== "foe" && e.kind !== "tick") best = Math.max(best, d); } pe = e.ehp; }
      if (e.hp != null) { if (ph != null && e.hp < ph) taken += ph - e.hp; ph = e.hp; }
    }
    return { rounds: sess.round || 1, dealt: Math.round(dealt), taken: Math.round(taken), best: Math.round(best) };
  }
  /* after the last blow (played in slow motion by fightart.js) a card says how it went; Continue moves onto it */
  let resT = null;
  function result(el, sess, o) {
    const tin = el.querySelector(".tbin"); if (!tin) return;
    tin.querySelector(":scope > .c2res")?.remove(); clearTimeout(resT);
    if (!sess.done || o.playing) return;
    const f = sess.f || {}, t = tally(sess), done = el.querySelector(".tbdock .tbdone");
    const kind = f.won ? (f.escaped ? "away" : "win") : "lose";
    const title = kind === "win" ? T("Victory") : kind === "away" ? T("You got away") : T("Defeated");
    const card = document.createElement("div");
    card.className = `c2res ${kind}`; card.setAttribute("role", "dialog"); card.setAttribute("aria-label", title);
    const row = (v, l) => `<span><b class="num">${esc(String(v))}</b><small>${esc(T(l))}</small></span>`;
    card.innerHTML = `<div class="c2rescard"><small class="c2resr">${esc(T(t.rounds === 1 ? "1 round" : `${t.rounds} rounds`))}</small><h2>${esc(title)}</h2>
      <p class="c2resfoe">${esc(f.e?.name || "")}</p><div class="c2resst">${row(t.dealt, "Damage dealt")}${row(t.taken, "Damage taken")}${row(t.best, "Best hit")}</div></div>`;
    if (done) card.querySelector(".c2rescard").appendChild(done);
    tin.appendChild(card);
    // wait for the slow-motion finisher to play out, then show it (at most 4 s)
    const t0 = Date.now();
    const show = () => {
      if (!card.isConnected) return;
      const anim = typeof FIGHTART !== "undefined" && FIGHTART.playing && FIGHTART.playing();
      if (anim && Date.now() - t0 < 4000) { resT = setTimeout(show, 150); return; }
      card.classList.add("on"); el.querySelectorAll(".tbhurry").forEach((b) => b.remove());
    };
    show();
  }

  // ------------------------------------------------------------------ after each redraw (tbfight.js render)
  const later = { raf: 0, t: [] };   // the layout passes still to come after the last redraw
  function layout(el, sess, o = {}) {
    if (!DOM || !el) return;
    const use = on();
    el.classList.toggle("c2", use);
    if (!use) return;
    if (mem.sess !== sess) mem = { sess, dock: 0, hp: null, mp: null, sp: null, mine: false };
    const tin = el.querySelector(".tbin"), stage = el.querySelector(".tbstage"); if (!tin || !stage) return;
    if (typeof FIGHTSET !== "undefined") FIGHTSET.apply();   // Fight UI size, camera (fightset.js)
    backdrop(stage);
    ribbon(el, sess);
    // the cards move into the scene
    const ov = document.createElement("div"); ov.className = "c2ov";
    const me = el.querySelector(".tbvit .tbu.me"), foe = el.querySelector(".tbvit .tbu.foe"), party = el.querySelector(".tbparty"), log = el.querySelector(".tblog");
    if (log) { log.classList.add("c2feed"); ov.appendChild(log); }
    if (party) ov.appendChild(party);
    const f = sess.f, fxNow = [];   // every buff and debuff as icons on whoever has it (fxicons.js)
    const FX = typeof FXICONS !== "undefined" ? FXICONS : null;
    const putFx = (card, list, cls, after) => {
      if (!card || !FX) return;
      card.querySelectorAll(":scope > .tbst, :scope > .nm .fx, :scope > .c2fx").forEach((x) => x.remove());
      const h = FX.html(list, cls); if (!h) return;
      const at = after && card.querySelector(after);
      if (at) at.insertAdjacentHTML("afterend", h); else card.insertAdjacentHTML("beforeend", h);
    };
    if (FX && f) {
      if (foe) { const l = FX.foe(f); putFx(foe, l, "foe", ".tbbar.big"); fxNow.push(["foe", l, null]); }
      if (me) { const l = FX.me(f, sess); putFx(me, l, "me", ".nm"); fxNow.push(["me", l, null]); }
      if (party) for (const card of party.querySelectorAll(".tbu.ally[data-ally]")) {
        const i = +card.dataset.ally, down = i >= 1000, a = down ? (f._downed || [])[i - 1000] : (f.allies || [])[i];
        if (!a) continue;
        const l = FX.ally(f, a, down); putFx(card, l, "ally", ".tbbar"); fxNow.push([a, l, card]);
      }
    }
    if (party && f && typeof STRAT !== "undefined") {   // orders for your follower: Attack / Defend me / Hold back (strategy.js)
      const live = !!o.mine && !o.playing && !sess.done;
      for (const card of party.querySelectorAll(".tbu.ally[data-ally]")) {
        const i = +card.dataset.ally; if (i >= 1000) continue;
        card.querySelector(":scope > .c2ord")?.remove();
        const h = STRAT.ordersHTML((f.allies || [])[i], i, live); if (h) card.insertAdjacentHTML("beforeend", h);
      }
    }
    if (foe) {
      ov.appendChild(foe);
      const fh = num(foe.querySelector(".tbbar.big .num"));
      const stun = f ? f.eParalyzed > 0 || f.tbStunLeft > 0 || !!f.stagger : !!foe.querySelector(".st.stun, .st.para, .st.stag");
      foe.classList.toggle("c2stun", stun);
      if (stun && !o.playing) { const sx = document.createElement("div"); sx.className = "c2stars"; sx.setAttribute("aria-hidden", "true"); sx.innerHTML = "<i>✦</i><i>✦</i><i>✦</i>"; ov.appendChild(sx); }
      if (fh && fh.v / fh.m <= 0.25) foe.classList.add("c2low");
    }
    if (me) {
      me.classList.add("c2hud");
      orb(me, sess, o.playing);   // [fightdeclutter] the orb is the one place for your numbers: no slim bars over your head any more
      ov.appendChild(me);
    }
    // a hot spot over you in the scene: drag a heal or a potion onto yourself there
    const hot = document.createElement("div"); hot.className = "c2hot"; hot.dataset.tbzone = "self"; hot.setAttribute("aria-hidden", "true"); ov.appendChild(hot);
    stage.appendChild(ov);
    el.querySelector(".tbvit")?.remove();
    // turn mood: your turn warm, theirs red
    const mine = !!o.mine && !o.playing && !sess.done;
    el.classList.toggle("c2mine", mine); el.classList.toggle("c2theirs", !mine && !sess.done);
    if (mine && !mem.mine) { el.classList.remove("c2turn"); void el.offsetWidth; el.classList.add("c2turn"); }
    mem.mine = mine;
    // hits: a flash where it landed, a shake on crits and big blows
    const pops = o.pops || [];
    if (!reduce() && pops.length) {
      const crit = pops.some((p) => p.crit), foeHit = pops.some((p) => p.at === "foe" && p.n < 0 && !p.tag), meHit = pops.some((p) => p.at === "me" && p.n < 0 && !p.tag);
      const fl = (cls) => { const x = document.createElement("i"); x.className = "c2flash " + cls; stage.appendChild(x); setTimeout(() => x.remove(), 700); };
      if (foeHit) fl("foe" + (crit ? " crit" : ""));
      if (meHit) fl("me");
      if ((crit || o.big) && (typeof FIGHTSET === "undefined" || FIGHTSET.cam() > 0)) { stage.classList.remove("c2shake"); void stage.offsetWidth; stage.classList.add("c2shake"); }
    }
    result(el, sess, o);
    place(el);
    fxPops(ov, fxNow, !!sess.done);
    // [perf] the follow-up passes of an older redraw are dropped: quick turns used to stack up four layout passes each
    cancelAnimationFrame(later.raf); later.t.forEach(clearTimeout);
    later.raf = requestAnimationFrame(() => place(el, true));
    later.t = [setTimeout(() => place(el, true), 140), setTimeout(() => place(el, true), 450)];   // the scene draws its canvas a moment later; the boss bar lands after this
  }

  return { on, settingsHTML, layout, place, portraitOf, aspect, wideOf, shapeOf, tally };
})();
if (typeof module !== "undefined") module.exports = COMBAT2;
