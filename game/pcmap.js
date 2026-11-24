/* pcmap.js: on a PC or any wide window, the world map is the home screen. [OURS]
   The painted map fills the window; everything else floats over it:
   - a slim bar along the bottom: level and XP, gold, carry weight, time and weather, and buttons for the menus
   - party cards in a column on the left (their heroes walk the map too)
   - the quest tracker top-right: the quest you follow and where to go; Q or its ‹ button slides it off the edge and
     leaves a small tab there that slides it back
   - clicking the town you stand in opens its places (inn, shops, Jarl, jobs) in a side panel on the right
   - Journal, Character, Social... open full-screen over a blurred map; Items and Magic too; Tab's compass over a dimmed map
   Mouse: drag to pan (any zoom), wheel to zoom smoothly toward the cursor (from all of Skyrim to close up),
   click a place to pick it, double-click to set off. Keys: W A S D / arrows pan (the compass takes them while it's open),
   Space back to your hero, J journal, I items, K skills, M magic, Q quest tracker. Nothing fires while typing,
   in fights or mini-games.
   Phones keep their layout: all of this switches on only for a fine pointer (mouse) and a window ≥ 1100 × 620.
   Settings → Map → Map quality (Low / Medium / High) sets how alive the map is (mapfx.js). */
const PCMAP = (() => {
  const live = typeof document !== "undefined" && typeof document.createElement === "function";
  const W = 1000, H = 700, MAXZ = 8;
  const PREFS = "rotn_prefs";
  const L = (en, v) => { let s = en; try { if (typeof I18N !== "undefined" && I18N.lang() === "pl" && typeof I18N_EXTRA !== "undefined" && I18N_EXTRA.words[en]) s = I18N_EXTRA.words[en]; } catch { /* English */ } return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : s; };
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ------------------------------------------------------------ settings
  function prefs() { try { return JSON.parse(localStorage.getItem(PREFS) || "{}"); } catch { return {}; } }
  function setPrefKey(k, v) { try { const p = prefs(); p[k] = v; localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* storage blocked */ } }
  const QUALITY = ["low", "med", "high"];
  const quality = () => { const q = prefs().mapQuality; return QUALITY.includes(q) ? q : "med"; };
  const setQuality = (q) => setPrefKey("mapQuality", QUALITY.includes(q) ? q : "med");
  const settingsHTML = (seg) => (on() ? `<div class="setrow"><span>Map quality</span>${seg("mapQuality", [["low", "Low"], ["med", "Medium"], ["high", "High"]], quality())}</div>` : "");
  function pref(k, v) { if (k !== "mapQuality") return false; setQuality(String(v)); kick(); return true; }

  // ------------------------------------------------------------ pure helpers (tested in node)
  /* a PC-sized window with a mouse? */
  const wide = (w, h, fine) => !!fine && w >= 1100 && h >= 620;
  /* the farthest you can zoom out: the map's zoom 1, where the painting fills the whole window edge to edge (on a wide
     window it fills the width and you pan up and down), so there's never an empty band beside it [mapvisuals] */
  const minZoom = (cw, ch) => 1;
  /* the closest you can zoom in: about 14 screen px per map unit (a town's streets), whatever the window size */
  const maxZoom = (cw, ch) => (cw > 0 && ch > 0 ? clamp(14 / Math.max(cw / W, ch / H), 3, MAXZ) : MAXZ);
  /* the centre that keeps world point m (0..1) under screen point f at zoom z */
  function anchorCenter(m, f, z, cw, ch) { const k = Math.max(cw / W, ch / H) * z; return [m[0] - (f[0] - cw / 2) / k / W, m[1] - (f[1] - ch / 2) / k / H]; }
  /* keep the centre where the map still covers the window (or in the middle when it's smaller than the window) */
  function clampCenter(c, z, cw, ch, oy = 0) {
    const k = Math.max(cw / W, ch / H) * z, hx = cw / 2 / (k * W), hy = ch / 2 / (k * H);
    return [hx >= 0.5 ? 0.5 : clamp(c[0], hx, 1 - hx), hy >= 0.5 ? 0.5 + oy : clamp(c[1], oy + hy, oy + 1 - hy)];
  }
  /* how foggy a point is (0 clear … 1 hidden), the same rule as the map's fog: clear within 22 map px of anywhere you've
     been or found, fading out to 72 */
  function fogAt(pt, seen) {
    let d = Infinity;
    for (const p of seen || []) { if (!p) continue; const dd = Math.hypot((p[0] - pt[0]) * W, (p[1] - pt[1]) * H); if (dd < d) d = dd; }
    return d <= 22 ? 0 : d >= 72 ? 1 : (d - 22) / 50;
  }
  const fogged = (pt, seen) => fogAt(pt, seen) > 0.5;
  /* which overlay class goes on <html> for a tab: the map is home, the Area opens beside it, the rest full-screen */
  const modeOf = (tab) => (tab === "map" || tab === "places" ? "home" : tab === "town" ? "side" : "full");

  // ------------------------------------------------------------ in the game
  let ctx = null, isOn = false, timer = 0, lastBar = "", lastQuest = "", lastParty = "";
  const $ = (s) => document.querySelector(s);
  const html = () => document.documentElement;
  const reduce = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches || (typeof MOTION !== "undefined" && MOTION.pref && MOTION.pref() === "off"); } catch { return false; } };
  const on = () => isOn;
  function kick() { try { ctx?.kick?.(); } catch { /* map not up yet */ } }
  function check() {
    if (!live) return;
    let fine = false; try { fine = matchMedia("(hover: hover) and (pointer: fine)").matches; } catch { /* old browser */ }
    const now = !!ctx && wide(innerWidth, innerHeight, fine) && !/[?&]nopcmap\b/.test(location.search);
    if (now !== isOn) { isOn = now; html().classList.toggle("pcmap", now); if (now) build(); else teardown(); kick(); }
  }
  /* ctx (from ui.js): S, party, others, otherPos, livePos, view → {zoom, center, transform}, setView(z, c), recentre(), go(tab),
     openMenu(p), closeMenu(), jump(o), tab(), kick(), toast */
  function mount(c) {
    ctx = c;
    if (!live) return;
    check();
    addEventListener("resize", check);
    addEventListener("keydown", onKey, true);
    addEventListener("keyup", (e) => held.delete(keyDir(e)), true);
    addEventListener("blur", () => held.clear());
    document.addEventListener("visibilitychange", () => { if (document.hidden) held.clear(); });
    clearInterval(timer); timer = setInterval(() => { if (!document.hidden && isOn) refresh(); }, 600);
  }
  function build() {
    if (!$("#pcbar")) {
      const b = document.createElement("div"); b.id = "pcbar"; b.className = "pcbar"; b.setAttribute("role", "toolbar"); b.setAttribute("aria-label", L("Character and menus"));
      b.addEventListener("click", onBarClick); document.body.appendChild(b);
    }
    if (!$("#pcparty")) { const p = document.createElement("div"); p.id = "pcparty"; p.className = "pcparty"; p.addEventListener("click", onPartyClick); document.body.appendChild(p); }
    if (!$("#pcquest")) {
      const q = document.createElement("aside"); q.id = "pcquest"; q.className = "pcquest"; q.setAttribute("aria-label", L("Quest tracker")); q.addEventListener("click", onQuestClick); document.body.appendChild(q);
      const t = document.createElement("button"); t.id = "pcqtab"; t.className = "pcqtab"; t.setAttribute("aria-label", L("Show the quest tracker")); t.title = L("Quest tracker") + " (Q)";
      t.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V5a2 2 0 0 1 0 0z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 8h6M9 11.5h6M9 15h3" stroke="currentColor" stroke-width="1.4"/></svg>`;
      t.onclick = () => toggleQuest(true); document.body.appendChild(t);
    }
    if (!$("#pcclose")) { const x = document.createElement("button"); x.id = "pcclose"; x.className = "pcclose"; x.innerHTML = `✕ <span>${esc(L("Back to the map"))}</span>`; x.onclick = () => ctx.go("map"); document.body.appendChild(x); }
    html().classList.toggle("pcq-off", prefs().pcQuest === false);
    lastBar = lastQuest = lastParty = "";
    refresh();
  }
  function teardown() { for (const id of ["pcbar", "pcparty", "pcquest", "pcqtab", "pcclose"]) document.getElementById(id)?.remove(); for (const c of [...html().classList]) if (/^pc-/.test(c)) html().classList.remove(c); }

  function refresh() {
    const S = ctx.S(); if (!S || !$("#pcbar")) return;
    const tab = ctx.tab(), mode = modeOf(tab), h = html();
    h.classList.toggle("pc-home", mode === "home"); h.classList.toggle("pc-side", mode === "side"); h.classList.toggle("pc-full", mode === "full");
    h.classList.toggle("pc-reduce", reduce());
    paintBar(S); paintQuest(S); paintParty(S);
  }
  // ---- the bottom bar
  function paintBar(S) {
    const b = typeof TABMENU !== "undefined" && TABMENU.bar ? TABMENU.bar(S) : { level: S.level, xp: 0, need: 1, pct: 0, gold: S.gold, w: 0, cap: 0, over: false, perks: 0 };
    const clock = ($("#clock")?.textContent || "").trim();
    const btn = (act, key, label, icon) => `<button class="pcb-btn" data-pc="${act}" title="${esc(L(label))}${key ? ` (${key})` : ""}" aria-label="${esc(L(label))}">${icon}<span>${esc(L(label))}</span>${key ? `<kbd>${key}</kbd>` : ""}</button>`;
    const I = {
      log: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6z M9 8h6M9 12h6M9 16h4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
      items: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.5 12h-11zM9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
      skills: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
      magic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 4 5 6.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-5 .4 1.6 1.3 2.6 2.4 3C11 8.5 11.3 5.8 12 3z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
      town: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V10l9-6 9 6v11M9 21v-6h6v6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
      social: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5M16 5.5a3 3 0 0 1 0 5.6M18 14.8c1.6.7 2.6 2.4 3 5.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
      menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="1.6"/></svg>',
      compass: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 3.5l2.2 8.5L12 20.5 9.8 12z" fill="currentColor" opacity=".8"/></svg>',
    };
    const out = `<div class="pcb-who"><span class="pcb-lv num" title="${esc(L("Level"))}">${b.level}</span><div class="pcb-nm"><b>${esc(S.name)}</b>
        <div class="pcb-xp" title="${esc(L("Experience"))} ${b.xp}/${b.need}"><i style="width:${b.pct}%"></i></div></div>${b.perks ? `<span class="pcb-perk" title="${esc(L("Perk points to spend"))}">+${b.perks}</span>` : ""}</div>
      <span class="pcb-stat num" title="${esc(L("Gold"))}">◉ ${b.gold}</span>
      <span class="pcb-stat num${b.over ? " over" : ""}" title="${esc(L("Carry weight"))}">⚖ ${b.w}/${b.cap}</span>
      ${clock ? `<span class="pcb-stat pcb-clock">${esc(clock)}</span>` : ""}
      <span class="pcb-sp"></span>
      ${btn("log", "J", "Journal", I.log)}${btn("items", "I", "Items", I.items)}${btn("skills", "K", "Skills", I.skills)}${btn("magic", "M", "Magic", I.magic)}${btn("town", "", "Area", I.town)}${btn("social", "", "Friends", I.social)}${btn("hub", "Tab", "Compass", I.compass)}${btn("menu", "", "Menu", I.menu)}`;
    if (out === lastBar) return;
    lastBar = out; $("#pcbar").innerHTML = out;
  }
  function onBarClick(e) {
    const b = e.target.closest("[data-pc]"); if (!b) return;
    act(b.dataset.pc);
  }
  function act(a) {
    try { if (typeof SOUND !== "undefined") SOUND.fx("click"); } catch { /* quiet */ }
    if (a === "hub") { if (typeof TABMENU !== "undefined") { $("#tw") ? TABMENU.closeHub() : TABMENU.openHub(); } return; }
    if (typeof TABMENU !== "undefined" && TABMENU.closeHub && $("#tw")) TABMENU.closeHub();
    if (a === "items" || a === "magic") { if ($("#sky") && ctx.skyPage?.() === a) { ctx.closeMenu(); return; } ctx.openMenu(a); return; }
    if (a === "skills") { if (typeof TABMENU !== "undefined" && TABMENU.go) TABMENU.go("char", false); else ctx.go("hero"); return; }
    if (a === "social") { $("#socBtn")?.click(); return; }
    if (a === "menu") { $("#sndBtn")?.click(); return; }
    ctx.closeMenu();
    ctx.go(ctx.tab() === a ? "map" : a);   // the same button again: back to the map
    refresh();
  }
  // ---- the quest tracker
  function paintQuest(S) {
    const el = $("#pcquest"); if (!el) return;
    let qa = null; try { qa = typeof QUESTS !== "undefined" ? QUESTS.tracked(S) : null; } catch { /* no quests */ }
    const target = qa?.st ? QUESTS.target(qa.st) : null;
    const out = qa ? `<div class="pcq-h"><span>${esc(L("Quest"))}</span><button class="iconbtn pcq-x" data-q="hide" aria-label="${esc(L("Hide the quest tracker"))}" title="${esc(L("Hide"))} (Q)">›</button></div>
        <b class="pcq-name" data-q="log">${esc(qa.def?.name || "")}</b>
        ${qa.st?.title ? `<div class="pcq-obj"><span class="pcq-dot" aria-hidden="true">◆</span><span>${esc(qa.st.title)}</span></div>` : ""}
        ${target && WORLD.places[target] && target !== S.location ? `<button class="pcq-go" data-q="map" data-place="${esc(target)}">➜ ${esc(target)}</button>` : target === S.location ? `<div class="pcq-here">${esc(L("You're there."))}</div>` : ""}`
      : `<div class="pcq-h"><span>${esc(L("Quest"))}</span><button class="iconbtn pcq-x" data-q="hide" aria-label="${esc(L("Hide the quest tracker"))}" title="${esc(L("Hide"))} (Q)">›</button></div><div class="pcq-none">${esc(L("No quest followed. Open the Journal (J) to pick one."))}</div>`;
    if (out === lastQuest) return;
    lastQuest = out; el.innerHTML = out;
  }
  function onQuestClick(e) {
    const b = e.target.closest("[data-q]"); if (!b) return;
    if (b.dataset.q === "hide") return toggleQuest(false);
    if (b.dataset.q === "log") return act("log");
    if (b.dataset.q === "map") ctx.jump({ place: b.dataset.place });
  }
  function toggleQuest(open) {
    const want = open === undefined ? html().classList.contains("pcq-off") : !!open;
    html().classList.toggle("pcq-off", !want); setPrefKey("pcQuest", want);
    const t = want ? $("#pcquest .pcq-x") : $("#pcqtab"); try { t?.focus({ preventScroll: true }); } catch { /* fine */ }
  }
  // ---- party cards
  function paintParty(S) {
    const el = $("#pcparty"); if (!el) return;
    const party = ctx.party(), others = ctx.others() || [];
    let out = "";
    if (party?.members?.length > 1) {
      const card = (id, name, lvl, race, cur, max, where, lead, me) => `<button class="pcp-card${me ? " me" : ""}" data-id="${esc(id)}" title="${esc(me ? L("You") : L("Show them on the map"))}">
        <span class="pcp-lv num">${lvl || "?"}</span><span class="pcp-t"><b>${lead ? "⚑ " : ""}${esc(name)}</b><small>${esc([race, where].filter(Boolean).join(" · "))}</small>
        ${max ? `<span class="pcp-hp"><i style="width:${clamp(Math.round(cur / max * 100), 0, 100)}%"></i></span>` : ""}</span></button>`;
      const race = (r) => (r ? r[0].toUpperCase() + r.slice(1) : "");
      const whereOf = (loc, moving, dun) => (dun ? `🕯 ${dun}` : loc || (moving ? L("on the road") : L("in the wilds")));
      out = `<div class="pcp-h">${esc(L("Party"))} · ${party.members.length}</div>`;
      for (const m of party.members) {
        if (m.id === S.id) { out += card(S.id, S.name, S.level, race(S.race), typeof G !== "undefined" ? G.curHealth(S) : 0, typeof G !== "undefined" ? G.maxHealth(S) : 0, whereOf(S.location, S.trip?.status === "travel", S.dungeon?.place), party.leader === S.id, true); continue; }
        const o = others.find((x) => x.id === m.id);
        out += o ? card(o.id, o.name, o.level, race(o.race), o.cur, o.hp, whereOf(o.loc, o.moving, o.dungeon), party.leader === o.id, false)
          : `<div class="pcp-card off"><span class="pcp-lv">·</span><span class="pcp-t"><b>${esc(m.name || "?")}</b><small>${esc(L("away"))}</small></span></div>`;
      }
    }
    if (out === lastParty) return;
    lastParty = out; el.innerHTML = out; el.classList.toggle("on", !!out);
  }
  function onPartyClick(e) {
    const b = e.target.closest(".pcp-card[data-id]"); if (!b) return;
    const S = ctx.S(); if (b.dataset.id === S.id) { ctx.recentre(); return; }
    const o = (ctx.others() || []).find((x) => x.id === b.dataset.id); if (!o) return;
    const v = ctx.view(); ctx.setView(Math.max(v.zoom, 1.8), ctx.otherPos(o));
  }

  // ------------------------------------------------------------ mouse wheel: smooth zoom toward the cursor
  let zAnim = null;
  function wheel(e, canvas) {
    if (!isOn) return false;
    e.preventDefault();
    const v = ctx.view(), t = v.transform; if (!t) return true;
    const r = canvas.getBoundingClientRect(), f = [e.clientX - r.left, e.clientY - r.top];
    const m = [(f[0] - t.ox) / t.k / W, (f[1] - t.oy) / t.k / H];
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    const from = zAnim ? zAnim.target : v.zoom, target = clamp(from * Math.exp(-clamp(dy, -300, 300) * 0.0016), minZoom(r.width, r.height), maxZoom(r.width, r.height));
    zAnim = { target, m, f, cw: r.width, ch: r.height };
    if (reduce()) { step(true); return true; }
    if (!zAnim.raf) zAnim.raf = requestAnimationFrame(() => step(false));
    return true;
  }
  function step(now) {
    if (!zAnim) return;
    const a = zAnim, z0 = ctx.view().zoom;
    let z = now ? a.target : z0 + (a.target - z0) * 0.24;
    if (Math.abs(a.target - z) < 0.002) z = a.target;
    const oy = ctx.view().center[1] >= 1.5 ? 2 : 0;   // Solstheim sits two map-heights down (WORLD.SOL_OY)
    ctx.setView(z, clampCenter(anchorCenter(a.m, a.f, z, a.cw, a.ch), z, a.cw, a.ch, oy));
    a.raf = 0;
    if (z === a.target) { zAnim = null; return; }
    a.raf = requestAnimationFrame(() => step(false));
  }
  const minZoomFor = (canvas) => { const r = canvas.getBoundingClientRect(); return minZoom(r.width, r.height); };
  const maxZoomFor = (canvas) => { const r = canvas.getBoundingClientRect(); return maxZoom(r.width, r.height); };

  // ------------------------------------------------------------ keys
  const held = new Set();
  const DIRS = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
  const keyDir = (e) => { const k = String(e.key || "").toLowerCase(); return DIRS[k] ? k : null; };
  const BUSY = ["title", "nickbox", "tbf", "tbwatch", "lockpick", "pickgame", "craftgame", "minegame", "dgame", "dgwatch", "xgame", "forge", "dun", "acctwall", "favwheel"];
  /* not while typing, in a fight, a mini-game, a dungeon or a window that wants an answer */
  function blocked(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return true;
    const t = e.target, tag = (t && t.tagName) || "";
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || t?.isContentEditable) return true;
    if (BUSY.some((id) => document.getElementById(id))) return true;
    if (document.querySelector(".mg-on, [data-minigame], #fishbar")) return true;
    if (typeof TB !== "undefined" && TB.open) return true;
    return false;
  }
  function onKey(e) {
    if (!isOn || e.defaultPrevented || blocked(e)) return;
    const k = String(e.key || "").toLowerCase(), modal = !!$("#modal"), tw = !!$("#tw"), sky = !!$("#sky");
    const dir = keyDir(e);
    if (dir) {   // pan: only on the map itself, and never while the compass is open (it steers with W A S D)
      if (tw || sky || modal || modeOf(ctx.tab()) === "full") return;
      e.preventDefault(); e.stopPropagation();
      held.add(dir); if (!panRaf) { panT = 0; panRaf = requestAnimationFrame(panStep); }
      return;
    }
    if (e.repeat) return;
    if (k === " " || k === "spacebar") { if (tw || sky || modal) return; e.preventDefault(); e.stopPropagation(); ctx.recentre(); return; }
    if (modal || tw && !["j", "i", "k", "m"].includes(k)) return;
    const map = { j: "log", i: "items", k: "skills", m: "magic" };
    if (map[k]) { e.preventDefault(); e.stopPropagation(); act(map[k]); return; }
    if (k === "q" && !sky) { e.preventDefault(); e.stopPropagation(); toggleQuest(); }
  }
  let panRaf = 0, panT = 0;
  function panStep(ts) {
    panRaf = 0;
    if (!held.size || !isOn) { held.clear(); return; }
    const dt = panT ? Math.min(0.05, (ts - panT) / 1000) : 1 / 60; panT = ts;
    let dx = 0, dy = 0; for (const k of held) { dx += DIRS[k][0]; dy += DIRS[k][1]; }
    const v = ctx.view(), t = v.transform, m = document.getElementById("map");
    if (t && m && (dx || dy)) {
      const n = Math.hypot(dx, dy), sp = 760 * dt;   // screen px per frame
      const c = [v.center[0] + dx / n * sp / (t.k * W), v.center[1] + dy / n * sp / (t.k * H)];
      ctx.setView(v.zoom, clampCenter(c, v.zoom, m.clientWidth, m.clientHeight, v.center[1] >= 1.5 ? 2 : 0));
    }
    panRaf = requestAnimationFrame(panStep);
  }

  return { wide, minZoom, minZoomFor, maxZoom, maxZoomFor, anchorCenter, clampCenter, fogAt, fogged, modeOf, quality, setQuality, settingsHTML, pref, on, check, mount, wheel, refresh, toggleQuest, act, MAXZ };
})();
if (typeof module !== "undefined") module.exports = PCMAP;
