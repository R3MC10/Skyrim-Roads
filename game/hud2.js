/* hud2.js: the always-on-screen layer, tidied the Skyrim way: little on screen, nothing on top of anything else.
   - One message lane, top-left under the compass: the message log, then one speech bubble at a time
     (guards, followers). Bubbles that arrive while another is showing wait their turn.
   - The tracked quest's objective is a thin line under the compass; a new objective flashes there
     instead of a big banner over the middle of the map.
   - Big banners (skill up, level up, quest started) sit centred on the map, below the lane.
   - The ★ favourites button docks in the top bar next to Search and Menu. The compass button is the only
     floating one left, and it steps up out of the way when a button would be under it.
   - Bottom-bar names shrink to fit, so long Polish names never spill.
   The rect maths are plain functions so node tests can check them (tests/test_hud2.js). [OURS] */
const HUD2 = (() => {
  const live = typeof document !== "undefined" && typeof window !== "undefined" && typeof MutationObserver !== "undefined";
  const $ = (q) => (live ? document.querySelector(q) : null);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ------------------------------------------------------------ rect maths (pure)
  /* do two boxes ({left, top, right, bottom}) touch, with pad pixels to spare? */
  const hit = (a, b, pad = 0) => !!a && !!b && a.left < b.right + pad && b.left < a.right + pad && a.top < b.bottom + pad && b.top < a.bottom + pad;
  /* which step up from the base spot (0, 1, 2…) leaves a size×size box clear of every blocker; 0 if none is */
  function freeSlot(base, size, step, tries, blockers, minTop = 0) {
    for (let i = 0; i < tries; i++) {
      const top = base.top - i * step; if (top < minTop) break;
      const r = { left: base.left, right: base.left + size, top, bottom: top + size };
      if (!blockers.some((b) => hit(r, b, 4))) return i;
    }
    return 0;
  }
  /* the objective line from the tracked quest: {title, where} or null */
  function objLine(q) {
    if (!q || !q.title) return null;
    const title = String(q.title).trim(), where = q.where ? String(q.where).trim() : "";
    return { title, where: where && where !== title ? where : "" };
  }
  /* the font size (px, in half steps) at which a label fits its room; measure(px) gives its width */
  function fitSize(measure, room, px = 10.5, min = 8) { let s = px; while (s > min && measure(s) > room + 0.5) s -= 0.5; return s; }
  /* a short line for the objective flash */
  const short = (t, n = 72) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };

  // ------------------------------------------------------------ Polish for the few new words
  const PL = { Favourites: "Ulubione", "New objective": "Nowy cel", "Your favourites": "Twoje ulubione", "Current objective": "Obecny cel",
    // the patch note
    "A cleaner screen": "Czystszy ekran",
    "Messages, guard chatter and follower lines now share one spot at the top left, under the compass. Only one person talks at a time; the next one waits their turn instead of piling on top.":
      "Wiadomości, gadanie strażników i słowa towarzyszy mają teraz jedno miejsce: lewy górny róg, pod kompasem. Naraz mówi tylko jedna osoba, następna czeka na swoją kolej, zamiast nakładać się na poprzednią.",
    "Your quest goal is a thin line under the compass. A new goal flashes there instead of a big banner in the middle of the map.":
      "Cel zadania to cienka linia pod kompasem. Nowy cel błyska właśnie tam, a nie jako wielki baner na środku mapy.",
    "Big banners (skill up, level up, new quest) sit in the middle of the map, under the messages, never on top of them.":
      "Duże banery (wzrost umiejętności, nowy poziom, nowe zadanie) są na środku mapy, pod wiadomościami, nigdy na nich.",
    "Health, magicka and stamina fade away when they're full, like in Skyrim. Carry weight only shows when you're getting heavy. Tap the bars to see everything for a moment.":
      "Zdrowie, magia i wytrzymałość znikają, gdy są pełne, jak w Skyrim. Udźwig widać dopiero, gdy robi się ciężko. Dotknij pasków, żeby na chwilę zobaczyć wszystko.",
    "The ★ favourites button moved to the top bar, next to Search and Menu. The round compass button is the only floating button left: it moves up when there's a button under it, and on big screens it sits in the empty corner of the bottom bar.":
      "Przycisk ★ ulubionych jest teraz na górnym pasku, obok Szukaj i Menu. Okrągły przycisk kompasu to jedyny pływający przycisk: przesuwa się w górę, gdy pod nim jest inny przycisk, a na dużych ekranach siedzi w pustym rogu dolnego paska.",
    "The map buttons (zoom, centre, hunt, sneak) are one slim strip now, so the compass has more room.":
      "Przyciski mapy (przybliżenie, środek, polowanie, skradanie) to teraz jeden wąski pasek, więc kompas ma więcej miejsca.",
    'Bottom bar names fit on small phones (no more cut-off "Społeczność").': "Nazwy na dolnym pasku mieszczą się na małych telefonach (koniec z uciętą „Społecznością”)." };
  if (typeof I18N !== "undefined" && I18N.PL) for (const [k, v] of Object.entries(PL)) if (!(k in I18N.PL)) I18N.PL[k] = v;

  // ------------------------------------------------------------ the message lane
  let laneEl = null;
  const held = [];   // speech bubbles waiting their turn
  function lane() {
    if (!live || !document.body) return null;
    if (laneEl && laneEl.isConnected) return laneEl;
    laneEl = document.getElementById("hudlane");
    if (!laneEl) {
      laneEl = document.createElement("div"); laneEl.id = "hudlane";
      laneEl.innerHTML = '<div class="hl-log"></div><div class="hl-say"></div>';
      document.body.appendChild(laneEl);
      new MutationObserver(onSay).observe(laneEl.querySelector(".hl-say"), { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }
    return laneEl;
  }
  const logHost = () => lane()?.querySelector(".hl-log") || null;
  const sayHost = () => lane()?.querySelector(".hl-say") || null;
  const SAY = (el) => el && el.nodeType === 1 && (el.id === "bark" || el.id === "folbark" || el.classList?.contains("bark") || el.classList?.contains("folbark"));
  const now = () => Date.now();
  /* a bubble was added to the page: show it in the lane, or keep it until the current one is done */
  function adopt(el) {
    const slot = sayHost(); if (!slot) return;
    el.remove = function () { if (now() < +(this.dataset.until || 0)) return; Element.prototype.remove.call(this); };   // the lane owns its lifetime now
    const busy = [...slot.children].some((c) => !c.classList.contains("gone"));
    if (!busy) { el.dataset.until = "0"; slot.appendChild(el); return; }
    el.dataset.until = String(Infinity); Element.prototype.remove.call(el);
    held.push(el); while (held.length > 3) held.shift();
  }
  function release() {
    const slot = sayHost(); if (!slot || !held.length) return;
    if ([...slot.children].some((c) => !c.classList.contains("gone"))) return;
    const el = held.shift(), life = 4600;
    el.classList.remove("gone"); el.dataset.until = String(now() + life);
    slot.appendChild(el);
    setTimeout(() => { el.dataset.until = "0"; el.classList.add("gone"); setTimeout(() => el.remove(), 650); }, life);
  }
  function onSay(ms) {
    for (const m of ms) {
      // a bubble's own timer may try to fade it while the lane still shows it
      if (m.type === "attributes" && m.target.classList?.contains("gone") && now() < +(m.target.dataset.until || 0)) m.target.classList.remove("gone");
    }
    if (ms.some((m) => m.type === "childList" || (m.type === "attributes" && m.target.classList?.contains("gone")))) setTimeout(release, 0);
  }

  // ------------------------------------------------------------ the objective line under the compass
  let objKey = "", flashUntil = 0, flashT = 0, lastObj = null;
  function objEl() {
    const wrap = $("#mapwrap"); if (!wrap) return null;
    let el = document.getElementById("hudobj");
    if (!el || el.parentNode !== wrap) {
      el?.remove();
      el = document.createElement("div"); el.id = "hudobj"; el.className = "hudobj hide"; el.setAttribute("role", "status");
      el.innerHTML = '<i class="ho-d" aria-hidden="true"></i><span class="ho-t"></span>';
      wrap.appendChild(el); objKey = "";
    }
    return el;
  }
  /* called with the tracked quest each time the compass redraws; cheap when nothing changed */
  function objective(q) {
    if (!live) return;
    lastObj = objLine(q);
    if (now() < flashUntil) return;
    const el = objEl(); if (!el) return;
    const key = lastObj ? lastObj.title + "|" + lastObj.where : "";
    if (key === objKey && !el.classList.contains("flash")) return;
    objKey = key; el.classList.remove("flash");
    el.classList.toggle("hide", !lastObj);
    el.title = "Current objective";
    el.querySelector(".ho-t").innerHTML = lastObj ? `<b>${esc(lastObj.title)}</b>${lastObj.where ? `<span class="ho-w">${esc(lastObj.where)}</span>` : ""}` : "";
  }
  /* a new objective: flash it on the line. False when the map isn't on screen (the big banner shows instead). */
  function objFlash(text) {
    if (!live || !text) return false;
    const el = objEl(); if (!el || document.querySelector("#sky, #modal .sheet, .tw") || document.body.classList.contains("tw-char")) return false;
    const r = el.parentNode.getBoundingClientRect();
    if (r.bottom < 60 || r.top > innerHeight - 60) return false;
    el.classList.remove("hide"); el.classList.add("flash");
    el.querySelector(".ho-t").innerHTML = `<small>New objective</small><b>${esc(short(text))}</b>`;
    flashUntil = now() + 5200; objKey = "";
    clearTimeout(flashT); flashT = setTimeout(() => { flashUntil = 0; objective(lastObj); }, 5300);
    return true;
  }

  // ------------------------------------------------------------ placing the lane, the banners and the compass button
  const safeTop = () => { const p = document.querySelector(".tt-probe"); return p ? parseFloat(getComputedStyle(p).paddingTop) || 0 : 0; };
  const shown = (el) => !!el && el.getClientRects().length > 0 && !el.classList.contains("hide") && getComputedStyle(el).visibility !== "hidden";
  function place() {
    const L = lane(); if (!L) return;
    const body = document.body, mw = $("#mapwrap"), st = safeTop();
    let left = 8, top = st + 8, width = Math.min(440, innerWidth * 0.82), onMap = false, m = null;
    const tw = body.classList.contains("tw-on") || body.classList.contains("tw-char");
    if (tw) { const tb = $("#twbar") || $(".tw-top") || null; top = (tb ? tb.getBoundingClientRect().bottom : st + 52) + 6; }
    else if (shown(mw)) {
      m = mw.getBoundingClientRect();
      const ob = $("#hudobj"), comp = $("#compass"), fpt = $("#fpt"), anchor = (shown(ob) ? ob : shown(fpt) ? fpt : comp)?.getBoundingClientRect();   // fptravel.js: under the travel band
      if (anchor && anchor.bottom > st + 4 && m.bottom > anchor.bottom + 120) { left = m.left + 8; top = anchor.bottom + 6; width = Math.max(180, Math.min(440, m.width - 64)); onMap = true;
        if (typeof MAPDOCK !== "undefined") { const dr = MAPDOCK.right(top); if (dr) left = Math.max(left, dr + 12); }   // PC: messages start right of the cards docked at the left (mapdock.js)
      }
      else if (m.right > 0) { left = Math.max(8, m.left + 8); width = Math.max(180, Math.min(440, m.width - 16)); }
    }
    if (typeof SKILLUP !== "undefined") top += SKILLUP.dock({ top, m: onMap || (m && m.right > 0) ? m : null, st, tw }) || 0;   // skillup.js: the skill-up toast takes the top of the lane
    // a window is open (Hold status, a shop...): only the newest message, in the free room above the window (or below it), never over its title
    const sh = tw ? null : typeof OVERLAYS !== "undefined" ? OVERLAYS.sheet() : document.querySelector("#modal .sheet"), inModal = shown(sh);   // overlays.js: a window or a result card
    L.classList.toggle("inmodal", inModal);
    if (inModal) {
      const r = sh.getBoundingClientRect(), up = r.top - st - 8, down = innerHeight - r.bottom - 8;
      left = 8; width = Math.min(440, innerWidth - 16);
      if (up >= 26 || up >= down) { top = st + 4; L.style.maxHeight = Math.max(26, Math.round(up)) + "px"; }
      else { top = r.bottom + 4; L.style.maxHeight = Math.round(down) + "px"; }
    } else L.style.maxHeight = "";
    L.style.left = Math.round(left) + "px"; L.style.top = Math.round(top) + "px"; L.style.width = Math.round(width) + "px";
    L.classList.toggle("onmap", onMap);
    // big banners: centred on the map, below the lane, above the bars
    const pb = typeof NOCOVER === "undefined" ? document.getElementById("pbanners") : null;   // nocover.js places them (and the history button, the Gather prompt)
    if (typeof NOCOVER !== "undefined") NOCOVER.run({ lane: L, m, st, tw, onMap });
    if (pb) {
      if (m && m.bottom > 160 && m.top < innerHeight - 160 && !tw) {
        const lb = L.getBoundingClientRect(), lowest = lb.height > 4 ? lb.bottom + 10 : top;
        const t = Math.min(Math.max(lowest, m.top + m.height * 0.5), m.bottom - 76);
        pb.style.left = Math.round(m.left) + "px"; pb.style.right = "auto"; pb.style.width = Math.round(m.width) + "px"; pb.style.top = Math.round(Math.max(st + 8, t)) + "px";
      } else { pb.style.left = "0px"; pb.style.right = "0px"; pb.style.width = "auto"; pb.style.top = ""; }
    }
    dodge();
  }
  /* the compass button: in the empty margin on wide screens; on phones it steps up when a button is under it */
  let dodgeAt = 0;
  function dodge() {
    const b = document.getElementById("twBtn");
    if (!b || getComputedStyle(b).display === "none") return;
    const tabs = $("#tabs"), size = b.offsetWidth || 46, side = $("#side"), lefty = document.documentElement.classList.contains("a11y-1h-left");
    const tabsOn = shown(tabs), tr = tabsOn ? tabs.getBoundingClientRect() : null, tabTop = tr ? tr.top : innerHeight;
    b.classList.remove("indock");
    // very wide screens: the bottom bar has empty room at its right end, so the button sits there, over nothing
    const padR = tabsOn ? parseFloat(getComputedStyle(tabs).paddingRight) || 0 : 0;
    if (!lefty && padR >= size + 24) {
      b.classList.add("indock");
      b.style.right = Math.round((padR - size) / 2) + "px"; b.style.bottom = Math.round(innerHeight - tr.bottom + (tr.height - size) / 2) + "px";
      return;
    }
    let right = 12;
    if (innerWidth >= 900 && side) { const gut = innerWidth - side.getBoundingClientRect().right; if (gut >= size + 4) right = Math.round((gut - size) / 2); }
    const baseBottom = innerHeight - tabTop + 12;
    if (!lefty) b.style.right = right + "px";
    if (now() - dodgeAt < 250) return; dodgeAt = now();
    if (document.body.classList.contains("fab-away")) return;   // wait until the page stops moving
    const x = lefty ? 12 : innerWidth - right - size, base = { left: x, top: tabTop - 12 - size };
    const blockers = [];
    const seen = new Set(), minTop = safeTop() + 60;
    /* [perf] one slot at a time, lowest first, stopping at the first free one: the usual case (nothing under the button)
       costs 5 hit tests instead of 25 */
    let i = 0;
    for (let j = 0; j < 5; j++) {
      const top = base.top - j * 58; if (top < minTop) break;
      for (const [px, py] of [[0.5, 0.5], [0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]]) {
        for (const e of document.elementsFromPoint(x + size * px, top + size * py)) {
          if (e === b || b.contains(e)) continue;
          const t = e.closest?.("button, a[href], [data-act], input, select, textarea, [role=button], .chip");
          if (t && !seen.has(t) && !t.closest("#twBtn, #hudlane, #pbanners, #tabs")) { seen.add(t); blockers.push(t.getBoundingClientRect()); }
        }
      }
      if (!blockers.some((r) => hit({ left: base.left, right: base.left + size, top, bottom: top + size }, r, 4))) { i = j; break; }
    }
    b.style.bottom = Math.round(baseBottom + i * 58) + "px";
  }

  // ------------------------------------------------------------ ★ favourites docks in the top bar
  const STAR = '<svg class="hico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.6l-5.2 2.9 1.2-5.8-4.4-4 5.9-.7z"/></svg>';
  function dockFav() {
    const fb = document.getElementById("favBtn"), top = $(".app .top"), body = document.body;
    const docked = !!fb && !!top && !body.classList.contains("tw-on") && !body.classList.contains("tw-char") && !document.documentElement.classList.contains("a11y-1h");
    body.classList.toggle("fav-docked", docked);
    if (!fb || !top || document.getElementById("favTop")) return;
    // a twin in the top bar that presses the real button (which stays where favwheel.js keeps it, hidden while docked)
    const t = document.createElement("button"); t.id = "favTop"; t.className = "iconbtn tbfav"; t.type = "button";
    t.setAttribute("aria-label", "Favourites wheel"); t.title = "Your favourites";
    t.innerHTML = `${STAR}<small class="ibl" aria-hidden="true">Favourites</small>`;
    t.onclick = (e) => { e.stopPropagation(); document.getElementById("favBtn")?.click(); };
    top.insertBefore(t, top.querySelector("#sndBtn"));
  }

  // ------------------------------------------------------------ bottom-bar names fit their buttons
  function fitTabs() {
    for (const l of document.querySelectorAll("#tabs .tab .mn-l")) {
      l.style.fontSize = "";
      const room = l.clientWidth; if (!room || l.scrollWidth <= room + 0.5) continue;
      const base = parseFloat(getComputedStyle(l).fontSize) || 10;
      l.style.fontSize = fitSize((px) => { l.style.fontSize = px + "px"; return l.scrollWidth; }, room, base, 7.5) + "px";
    }
  }

  // ------------------------------------------------------------ bars: a tap shows the full (faded) ones for a moment
  function peek() {
    const v = document.getElementById("vitals"); if (!v) return;
    v.classList.add("peek"); clearTimeout(peek.t); peek.t = setTimeout(() => v.classList.remove("peek"), 3000);
  }

  // ------------------------------------------------------------ wiring
  let raf = 0, tabsKey = "";
  const soon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; try { place(); } catch { /* layout only */ } }); };
  function tick() {
    try {
      dockFav();
      const t = document.getElementById("tabs"), k = t ? innerWidth + "|" + t.textContent : "";
      if (k !== tabsKey) { tabsKey = k; fitTabs(); }
      place();
    } catch { /* layout only */ }
  }
  function start() {
    lane();
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (SAY(n) && n.parentNode === document.body) adopt(n);
      if (ms.some((m) => m.type === "attributes")) { dockFav(); soon(); }
      else if (ms.some((m) => [...m.addedNodes, ...m.removedNodes].some((n) => n.id === "modal"))) soon();   // a window opened or closed: move the messages out of its way
    }).observe(document.body, { childList: true, attributes: true, attributeFilter: ["class"] });
    new MutationObserver(() => dockFav()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    addEventListener("scroll", soon, { passive: true, capture: true });
    addEventListener("resize", () => { tabsKey = ""; soon(); });
    document.addEventListener("click", (e) => { if (e.target.closest?.("#vitals")) peek(); }, true);
    setInterval(tick, 700); tick();
  }
  if (live) { if (document.body) start(); else addEventListener("DOMContentLoaded", start); }

  return { hit, freeSlot, objLine, fitSize, short, lane, logHost, objective, objFlash, place, dodge, dockFav, fitTabs, PL, get held() { return held.length; } };
})();
