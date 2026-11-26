/* locintro.js: every time you arrive somewhere, the place fills the screen for a moment. [OURS]
   A painted picture of the place (the same painting the Area tab uses, tinted for the time of day and the weather), its
   name in big letters, the kind of place and its hold, a short line about it, the time, weather and season, and at most
   two "what's new" lines: only real changes since your last visit (friends or party members here, new jobs on the notice
   board, fresh spell tomes on the shelves, a caravan in town).
   - First visit: the full reveal (about 3.5 s). Coming back: a short one (under 2 s). Both fade out by themselves.
     Tap anywhere or press Esc (or Back) to skip. No button to press; it never blocks the game or delays the arrival
     itself: jobs, guards, quests and the Area tab all happen as before, underneath.
   - Settings → Look → Location introductions: Always (default), First visit only, Off.
   - Party: everyone sees it on their own phone when they arrive. Skipping is personal. Players already standing in the
     place don't see it again when friends walk in (only your own arrival counts).
   - It waits its turn: never on top of a window, a result card, a first-time tip, a fight, a menu or a loading card
     (overlays.js ranks it as a window, so letters and tips wait for it too). Waits too long or you've moved on: dropped.
   - The Area tab has a "View location" button (landscape icon) next to the place's name: it opens the same picture with
     the current information and keeps it up until you tap or press Esc. It never counts as arriving.
   Visits live in the save (s.locv[place] = {n, t, jobs, sp, cv}). The rules are plain functions for tests/test_locintro.js. */
const LOCINTRO = (() => {
  const DOM = typeof document !== "undefined" && typeof window !== "undefined";
  const FULL_MS = 3600, SHORT_MS = 1800, FADE_MS = 450, MAX_WAIT = 20000;
  const MODES = ["always", "first", "off"];
  const PREFS = "rotn_prefs";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safe = (fn, d) => { try { return fn(); } catch { return d; } };
  const params = () => (DOM ? new URLSearchParams(location.search) : new URLSearchParams(""));
  const automated = () => DOM && (navigator.webdriver || params().has("notut")) && !params().has("locintro");   // screen tests opt in with ?locintro
  const reduce = () => DOM && (safe(() => matchMedia("(prefers-reduced-motion: reduce)").matches, false) || document.documentElement.classList.contains("a11y-still") || (typeof MOTION !== "undefined" && MOTION.pref() === "off"));

  // ------------------------------------------------------------ the setting
  let memMode = null;   // node tests / storage blocked
  function mode() {
    if (memMode) return memMode;
    const v = safe(() => JSON.parse(localStorage.getItem(PREFS) || "{}").locIntro, undefined);
    return MODES.includes(v) ? v : "always";
  }
  function setMode(v) {
    const m = MODES.includes(v) ? v : "always"; memMode = null;
    try { const p = JSON.parse(localStorage.getItem(PREFS) || "{}"); p.locIntro = m; localStorage.setItem(PREFS, JSON.stringify(p)); } catch { memMode = m; }
    return m;
  }
  function settingsHTML(seg) {
    return `<div class="setrow"><span>Location introductions</span>${seg("locIntro", [["always", "Always"], ["first", "First visit only"], ["off", "Off"]], mode())}</div>`;
  }
  /* ui.js settingsAction: true when it was ours */
  function pref(k, v) { if (k !== "locIntro") return false; setMode(v); return true; }

  // ------------------------------------------------------------ pure rules
  /* which introduction: "full" (first visit), "short" (back again) or "" (none) */
  function decide(m, first) {
    if (m === "off") return "";
    if (first) return "full";
    return m === "first" ? "" : "short";
  }
  const andList = (a) => (a.length < 2 ? a[0] || "" : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a[0]}, ${a[1]} and ${a.length - 2} more`);
  /* what's new since the last visit, at most two lines. prev: the last visit's record (null on a first visit).
     cur: {players: [{name, party, friend}], jobs: [ids], sp, tomes, cv} */
  function whatsNew(prev, cur) {
    const out = [];
    const ppl = (cur.players || []).filter((p) => p && p.name && (p.party || p.friend));
    if (ppl.length) {
      const party = ppl.filter((p) => p.party), names = [...party, ...ppl.filter((p) => !p.party)].map((p) => p.name);
      out.push(`${andList(names)} ${names.length === 1 ? "is" : "are"} here${party.length === ppl.length ? ", from your party" : ""}.`);
    }
    if (prev) {
      const was = new Set(prev.jobs || []), fresh = (cur.jobs || []).filter((id) => !was.has(id));
      if (fresh.length && Array.isArray(prev.jobs)) out.push(fresh.length === 1 ? "A new job on the notice board." : "New jobs on the notice board.");
      if (cur.tomes && prev.sp != null && cur.sp !== prev.sp) out.push("Fresh spell tomes on the shelves.");
      if (cur.cv && !prev.cv) out.push("A caravan is in town.");
    }
    return out.slice(0, 2);
  }

  // ------------------------------------------------------------ visits (in the save)
  const visits = (S) => { if (!S.locv || typeof S.locv !== "object") S.locv = {}; return S.locv; };
  /* what can change at a place between visits */
  function snapshot(S, l) {
    const town = safe(() => TOWNS.isTown(l), false);
    const jobs = town ? safe(() => TOWNS.jobsAt(S, l).map((j) => j.id), []) : [];
    const sp = safe(() => SPELLBOOK.period(), null);
    const tomes = safe(() => G.shopTypes(l).some((shop) => SPELLBOOK.rotation(l, shop).length > 0), false);
    const cv = (typeof UNLOCKS === "undefined" || UNLOCKS.open(S, "worldevents")) && safe(() => CARAVANS.at(l).some((x) => x.here), false);   // unlocks.js: caravans are a world event (level 11)
    return { jobs, sp, tomes, cv };
  }
  function record(S, l, snap) {
    const v = visits(S), old = v[l] || { n: 0 };
    v[l] = { n: (old.n || 0) + 1, t: Math.round(safe(() => G.now(), Date.now() / 1000)), jobs: snap.jobs, sp: snap.sp, cv: !!snap.cv };
    return v[l];
  }
  const placeOf = (S) => (S && S.location && !S.trip && !S.dungeon && typeof WORLD !== "undefined" && WORLD.places[S.location] ? S.location : "");

  // ------------------------------------------------------------ arriving
  let last;   // the place we last saw you standing at (undefined until the game is up)
  /* ui.js, once a second: notices your own arrival. ctx: {players(l) → [{name, party, friend}], persist()}.
     Returns what it decided ("full" / "short" / "" ), or null when nothing happened. */
  function tick(S, ctx = {}) {
    if (!S) return null;
    const here = placeOf(S), loc = S.location || "";
    if (last === undefined) {   // the game just started: you didn't arrive, you were already here
      last = loc;
      if (here && !visits(S)[here]) { record(S, here, snapshot(S, here)); ctx.persist?.(); }
      return null;
    }
    if (loc === last) return null;
    last = loc;
    if (!here) return null;     // set off on the road, a roam spot, a map pin
    return arrive(S, here, ctx);
  }
  /* you've just arrived at l: note the visit and show the introduction (when the setting wants one) */
  function arrive(S, l, ctx = {}) {
    const prev = visits(S)[l] || null, first = !prev, snap = snapshot(S, l);
    const lines = whatsNew(prev, { ...snap, players: safe(() => ctx.players?.(l) || [], []) });
    record(S, l, snap); ctx.persist?.();
    const kind = decide(mode(), first);
    if (kind && DOM && !automated()) queue({ S, l, kind, lines });
    return kind;
  }
  /* the Area tab's button: the picture again with what's here now; stays until dismissed. Never counts as arriving. */
  function view(S, ctx = {}) {
    const l = placeOf(S); if (!l) return false;
    const lines = whatsNew(null, { players: safe(() => ctx.players?.(l) || [], []) });
    if (DOM) { pending = null; show({ S, l, kind: "view", lines }); }
    return true;
  }

  // ------------------------------------------------------------ the picture
  const TOD = { dawn: "Dawn", day: "Day", dusk: "Evening", night: "Night" };
  const SEASON = { winter: "Winter", spring: "Spring", summer: "Summer", autumn: "Autumn" };
  const L = () => (typeof LOCSCREEN !== "undefined" ? LOCSCREEN : null);
  /* the facts under the name: [kindLine, flavour, meta parts] */
  function facts(l) {
    const LS = L(), kind = LS ? LS.kindOf(l) : "landmark", hold = safe(() => G.holdAt(WORLD.places[l]), "");
    const sk = LS ? LS.sky(l, hold) : { tod: "day", clock: "", wx: "clear", wxName: "" };
    const season = safe(() => SEASON[WEVENTS.season()] || "", "");
    const time = safe(() => G.clockText(G.now()).split(", ")[1] || "", "");
    const meta = [TOD[sk.tod] + (time ? ` · ${time}` : ""), sk.wxName, season].filter(Boolean);
    const kindName = LS ? (LS.KIND_NAME || {})[kind] || "" : "";
    return { kind, hold, sk, meta, kindName, flav: LS ? LS.FLAVOUR[l] || LS.KIND_LINE[kind] || "" : "" };
  }
  function html(o) {
    const { l, kind: k, lines } = o, f = facts(l), LS = L();
    const pics = LS ? LS.backdrop(l) : ["bs-town"];
    const bg = pics.map((p) => `url("${p}.webp")`).join(",");
    const indoor = LS && /^bs-(barrow|temple|cave|mine|dwemer|vampire)$/.test(pics.find((p) => !/^place-/.test(p)) || "") && !/^place-/.test(pics[0]);
    const sub = [f.kindName, f.hold].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join(" · ");
    return `<div class="li-stage" aria-hidden="true"><div class="li-bg" style='background-image:${bg}'></div><div class="ls-tint"></div><div class="ls-wx"></div><div class="li-shade"></div></div>
      <div class="li-text">
        ${sub ? `<small class="li-kind">${sub}</small>` : ""}
        <h1 class="li-name">${esc(l)}</h1>
        ${f.flav ? `<p class="li-flav">${esc(f.flav)}</p>` : ""}
        <p class="li-meta">${f.meta.map((x) => `<span>${esc(x)}</span>`).join('<i aria-hidden="true">·</i>')}</p>
        ${lines.length ? `<ul class="li-new">${lines.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      </div>
      <p class="li-skip">${k === "view" ? "Tap anywhere to close" : "Tap to skip"}</p>`;
  }

  // ------------------------------------------------------------ browser: wait for a clear screen, show, fade
  let pending = null, root = null, timer = 0, poll = 0;
  const vis = (el) => !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden";
  /* nothing else is up: no window, result, tip, fight, menu or loading card */
  function clear() {
    const O = typeof OVERLAYS !== "undefined" ? OVERLAYS : null;
    if (O && (O.level() >= O.LEVEL.tip || O.fightOpen() || O.menuOpen())) return false;
    if (document.querySelector("#modal .sheet") || vis(document.getElementById("loadcard"))) return false;
    if (typeof LEVELUP !== "undefined" && LEVELUP.isOpen) return false;
    return true;
  }
  function queue(o) {
    pending = { ...o, at: Date.now() };
    if (!poll) poll = setInterval(pump, 300);
    pump();
  }
  function pump() {
    if (!pending) { clearInterval(poll); poll = 0; return; }
    const p = pending;
    if (Date.now() - p.at > MAX_WAIT || placeOf(p.S) !== p.l) { pending = null; return; }   // you waited too long, or moved on
    if (isOpen() || !clear()) return;
    pending = null;
    show(p);
  }
  function show(o) {
    if (!DOM || !document.body) return;
    close(true);
    root = document.createElement("div");
    root.id = "locintro";
    const f = facts(o.l);
    root.className = `li li-${o.kind} tod-${f.sk.tod} wx-${f.sk.wx}${reduce() ? " still" : ""}`;
    root.setAttribute("role", "dialog"); root.setAttribute("aria-label", o.l); root.dataset.place = o.l;
    root.innerHTML = html(o);
    root.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); close(); });
    document.body.appendChild(root);
    document.body.classList.add("li-on");
    if (o.kind !== "view") timer = setTimeout(() => close(), o.kind === "full" ? FULL_MS : SHORT_MS);
  }
  const isOpen = () => !!(root && root.isConnected && !root.classList.contains("gone"));
  /* skip / dismiss. now: no fade. Returns true when something was closed (ui.js back button) */
  function close(now = false) {
    clearTimeout(timer); timer = 0;
    const el = root; if (!el || !el.isConnected) { root = null; return false; }
    const was = !el.classList.contains("gone");
    document.body.classList.remove("li-on");
    if (now || reduce()) { el.remove(); root = null; return was; }
    el.classList.add("gone");
    setTimeout(() => { el.remove(); if (root === el) root = null; }, FADE_MS);
    return was;
  }
  if (DOM) {
    window.addEventListener("keydown", (e) => {   // window capture, added at load: before ui.js's own Esc handling
      if (!isOpen()) return;
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    }, true);
  }

  /* the Area tab's button (scene and list): a small landscape picture */
  const ICON = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M2 19 L8.5 9.5 L12.5 15 L15.5 11 L22 19 Z" fill="currentColor" opacity=".9"/><path d="M8.5 9.5 L10.2 12 L9.2 11.6 L8 12.6 L7.4 11.1 Z" fill="#fff" opacity=".55"/><circle cx="17.5" cy="6.5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M1.5 20.5 H22.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const viewBtn = (label = false) => `<button class="${label ? "btn sm li-viewbtn li-vlabel" : "li-viewbtn"}" data-act="locview" aria-label="View location" title="View location">${ICON}${label ? "<span>View location</span>" : ""}</button>`;

  return { FULL_MS, SHORT_MS, MAX_WAIT, MODES, mode, setMode, settingsHTML, pref, decide, whatsNew, snapshot, record, visits, placeOf, tick, arrive, view, close, isOpen, viewBtn, html, facts,
    _reset() { last = undefined; pending = null; memMode = null; }, _mode(m) { memMode = m; }, get pending() { return pending; } };
})();
if (typeof module !== "undefined") module.exports = LOCINTRO;
