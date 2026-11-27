/* notices.js: one queue for everything that pops up, so nothing lands on top of anything else. [OURS]
   Builds on notify.js (which messages and banners take turns, merges) and overlays.js (what ranks above what):
   - Windows (ui.js showMessage: "Quest", a courier, a world event...): one at a time. A message that arrives on its own
     while another window, a fight or a menu is open waits its turn and opens when that closes; the same message twice
     is shown once. A window you opened yourself (a tap less than 2.5 s ago) still opens at once, as before. When a
     road encounter pushes a waiting message off the screen, that message goes back to the front of the line.
   - Banners, the message lane, first-time tips, a stranger's greeting: stacked. Each keeps its own spot unless something
     shown before it (or a key button: the top bar, the bottom bar, the dungeon's route strip, the invite bar) is in the
     way; then it slides down below it. With no room left on screen it waits, hidden, until there is.
   - Fight tips (combo banners, a boss's phase card, the pinned first-fight hints): never on top of the action
     buttons (they slide up above them), and while a fight window is open (Items, Magic, the result card) they wait.
     A boss's phase card no longer swallows taps meant for the buttons under it.
   - Reward scenes (rewards.js, NOTICES.scene): full-screen moments ride the same window queue, but never on a tap and
     never during a party vote, the dungeon screen or the level-up pillars; one at a time, and a pushed-off one comes back.
   The queue and the stacking are plain functions (core(), stack()) so tests/test_notices.js can check them. */
const NOTICES = (() => {
  const DOM = typeof document !== "undefined" && typeof window !== "undefined";
  const GAP = 400;        // ms between one window closing and the next opening
  const INPUT_MS = 2500;  // a window opened this soon after a tap is the player's own
  const PAD = 6;

  // ------------------------------------------------------------ the window queue (pure: the clock and the screen are passed in)
  function core() {
    const queue = [];
    let cur = null, closedAt = -1e9;
    /* a window wants to open: {key, run, scene?}. scr = {modal, fight, menu, input, cur, busy} → "show" | "queued" | "merged"
       A reward scene (rewards.js, scene: true) never opens just because you tapped, and also waits out busy (a party vote,
       the dungeon screen, the level-up pillars, character creation): big moments come after what you're doing, one at a time. */
    function ask(o, now, scr = {}) {
      if (o.key && cur && cur.key === o.key && scr.cur) { cur.n++; return "merged"; }   // the same one is on screen
      const dup = o.key && queue.find((q) => q.key === o.key);
      if (dup) { dup.n++; return "merged"; }
      const it = { ...o, n: 1, t: now };
      const clear = !scr.modal && !scr.menu && !queue.length;
      if (!scr.fight && (o.scene ? clear && !scr.busy && !scr.cur : scr.input || clear)) { cur = it; return "show"; }
      queue.push(it);
      return "queued";
    }
    /* what to open now (or null): the first in line that may open (a scene waits out busy, the windows behind it don't) */
    function tick(now, scr = {}) {
      if (cur && !scr.cur) { cur = null; closedAt = now; }
      if (!queue.length || scr.fight || scr.modal || scr.menu || cur || now - closedAt < GAP) return null;
      const i = queue.findIndex((q) => !(q.scene && scr.busy));
      if (i < 0) return null;
      cur = queue.splice(i, 1)[0];
      return cur;
    }
    /* another window is about to replace ours: put ours back at the front (unless the player's tap closes it; a scene always comes back) */
    function displaced(scr = {}) {
      if (!cur || (scr.input && !cur.scene)) { if (cur && scr.input) cur = null; return false; }
      queue.unshift(cur); cur = null;
      return true;
    }
    return { ask, tick, displaced, queue, get cur() { return cur; } };
  }

  // ------------------------------------------------------------ stacking (pure)
  /* boxes {l, t, r, b} */
  const hit = (a, b, pad = 0) => a.l < b.r + pad && b.l < a.r + pad && a.t < b.b + pad && b.t < a.b + pad;
  /* items in order of who keeps their spot: [{l, t, r, b, dir: "down"|"up", pin?}] (natural place, before any move).
     blockers: key buttons. view {top, bottom}. → [{dy, hide}]. A pinned item never moves (it only blocks the later ones). */
  function stack(items, blockers, view = { top: 0, bottom: 1e5 }) {
    const placed = [], out = [];
    for (const it of items) {
      const h = it.b - it.t;
      if (it.pin) { placed.push(it); out.push({ dy: 0, hide: false }); continue; }
      const walls = blockers.concat(placed);
      let y = it.t, ok = false;
      for (let i = 0; i < 24; i++) {
        const box = { l: it.l, r: it.r, t: y, b: y + h };
        const w = walls.find((b) => hit(box, b, PAD - 1));
        if (!w) { ok = true; break; }
        y = it.dir === "up" ? w.t - PAD - h : w.b + PAD;
      }
      if (ok && (y < view.top || y + h > view.bottom)) ok = false;
      if (!ok) { out.push({ dy: 0, hide: true }); continue; }
      const p = { l: it.l, r: it.r, t: y, b: y + h };
      placed.push(p); out.push({ dy: y - it.t, hide: false });
    }
    return out;
  }

  // ------------------------------------------------------------ the live game
  const C = core();
  let lastInput = -1e9, running = false;
  const vis = (el) => !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
  const anyVis = (q) => { if (!DOM) return false; for (const el of document.querySelectorAll(q)) if (vis(el)) return true; return false; };
  const fightOpen = () => (typeof TB !== "undefined" && !!TB.open) || anyVis("#tbf, #tbwatch");
  function scr() {
    if (!DOM) return {};
    const lv = typeof OVERLAYS !== "undefined" ? OVERLAYS.level() : 0;
    return {
      modal: !!document.querySelector("#modal .sheet") || lv >= 3 || anyVis("#lockpick, #pickgame, #smithgame, #minegame, #huntgame, #craftgame, #fishgame, #wwall, .cgrow"),
      fight: fightOpen(),
      menu: typeof OVERLAYS !== "undefined" && OVERLAYS.menuOpen(),
      input: Date.now() - lastInput < INPUT_MS,
      cur: !!document.querySelector("#modal[data-nq]"),
      busy: busy(),
    };
  }
  /* a party vote, the dungeon screen, the level-up pillars, character creation or the title: a reward scene waits */
  const busy = () => anyVis(".pvote, #dun, #lvlpick, .cg-over, .cgrow, #title, #nfhist") || (typeof LEVELUP !== "undefined" && !!LEVELUP.isOpen);
  const mark = (key) => { const m = DOM && document.getElementById("modal"); if (m) m.dataset.nq = key || "1"; };
  function open(it) {
    running = true;
    try { it.run(); } catch (e) { console.warn("notices", e); } finally { running = false; }
    mark(it.key);
  }
  /* ui.js showMessage: run(): draws the window. key: what makes two the same. */
  function modal(key, run) {
    if (!DOM) { run(); return "show"; }
    const r = C.ask({ key, run }, Date.now(), scr());
    if (r === "show") open(C.cur);
    return r;
  }
  /* rewards.js: a full-screen reward scene. run() draws it as #modal, so it takes its turn with every other window */
  function scene(key, run) {
    if (!DOM) { run(); return "show"; }
    const r = C.ask({ key, run, scene: true }, Date.now(), scr());
    if (r === "show") open(C.cur);
    return r;
  }
  /* ui.js openModal, just before it replaces whatever window is open */
  function opening() {
    if (!DOM || running || !document.querySelector("#modal[data-nq]")) return;
    C.displaced(scr());
  }

  // ---- fight tips wait while a fight window is open
  const FIGHT_POP = "#tbf .fc-pick, .tbsheet, #tbf .c2res, #tbf .tbdone, #lvlpick";   // Items / Magic, the fight log, the result, the level-up pick (a window under the fight is behind it)
  const fightHeld = () => DOM && fightOpen() && anyVis(FIGHT_POP);
  const later = [];
  /* reactions.js / bossfight.js: show it now, or when the fight window closes. key: only the newest of a kind waits */
  function fightTip(key, fn) {
    if (!fightHeld()) { fn(); return true; }
    const i = later.findIndex((x) => x.key === key); if (i >= 0) later.splice(i, 1);
    later.push({ key, fn, t: Date.now() });
    return false;
  }

  // ---- stacking on screen
  const zoom = () => (typeof FITCANVAS !== "undefined" && FITCANVAS.zoom ? FITCANVAS.zoom() || 1 : 1);
  const box = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const rectOf = (el) => { const rs = [...el.children].filter(vis).map((c) => c.getBoundingClientRect()); if (!rs.length) return null;   // a full-width host: its notices
    return { left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)), right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)) }; };
  /* [element or host, measure children?, dir, pin] in order of who keeps their spot */
  const MAP_ITEMS = [["#hudlane", false, "down", true], ["#invbar", false, "down", true], ["#pcupd", false, "down", true], ["#obtip", false, "down"], ["#greetask", false, "down"], ["#skillup.on", false, "down"], ["#lvln", true, "down"], ["#pbanners", true, "down"]];
  const MAP_KEYS = "#app .top button, #tabs, #dun .dstrip, #pcclose, .mn-bar";
  const FIGHT_ITEMS = [["#fhints .fhint:not([hidden])", false, "up", true], [".bfov.bfphase .bfpc", false, "up"], [".rxban", false, "up"]];   // tooltips are the player's own (a held finger): they stay by their button
  const FIGHT_KEYS = "#tbf .tbdock";
  function items(list) {
    const out = [];
    for (const [q, kids, dir, pin] of list) for (const el of document.querySelectorAll(q)) {
      if (!vis(el)) continue;
      const r = kids ? rectOf(el) : el.getBoundingClientRect(); if (!r || r.width === 0 && !kids) continue;
      const dy = +(el.dataset.nqdy || 0) * zoom();
      out.push({ el, l: r.left, r: r.right, t: r.top - dy, b: r.bottom - dy, dir, pin: !!pin });
    }
    return out;
  }
  function apply(its, res) {
    const z = zoom();
    its.forEach((it, i) => {
      const { dy, hide } = res[i], el = it.el, v = Math.round(dy / z);
      if (+(el.dataset.nqdy || 0) !== v) { el.dataset.nqdy = String(v); el.style.translate = v ? `0 ${v}px` : ""; }
      el.classList.toggle("nq-wait", !!hide);
    });
  }
  function layout() {
    if (!DOM || !document.body) return;
    const fight = fightOpen(), held = fight && anyVis(FIGHT_POP);
    document.body.classList.toggle("nq-fighthold", !!held);
    if (!held && later.length) { const x = later.shift(); try { x.fn(); } catch (e) { console.warn("notices", e); } }
    const its = items(fight ? FIGHT_ITEMS : MAP_ITEMS);
    const keys = [...document.querySelectorAll(fight ? FIGHT_KEYS : MAP_KEYS)].filter(vis).map((e) => box(e.getBoundingClientRect())).filter((b) => b.r > b.l);
    const res = stack(its, keys, { top: 0, bottom: innerHeight });
    apply(its, res);
  }
  /* [perfmap] reading the screen (scr) asks the browser for styles and boxes, which made it restyle the page 6-7 times
     a second even with nothing waiting: now only when a window waits or one of ours is open, and the stacking runs every
     4th beat (a new notice still stacks at once through the MutationObserver below) */
  let beat = 0;
  function pump() {
    if (!DOM) return;
    if (C.queue.length || C.cur) { const it = C.tick(Date.now(), scr()); if (it) open(it); }
    if (later.length || beat++ % 4 === 0) try { layout(); } catch (e) { console.warn("notices", e); }
  }

  if (DOM) {
    const seen = () => { lastInput = Date.now(); };
    for (const ev of ["pointerdown", "keydown", "click"]) addEventListener(ev, seen, true);
    /* a new notice is stacked in the very next frame, not up to 150 ms later on top of another */
    let raf = 0;
    const soon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; try { layout(); } catch (e) { console.warn("notices", e); } }); };
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(soon) : null;
    const watched = new WeakSet();
    const watch = () => { if (!mo) return; for (const q of ["#pbanners", "#lvln", "#hudlane .hl-log", "#fhints"]) { const el = document.querySelector(q); if (el && !watched.has(el)) { watched.add(el); mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] }); } } };
    const start = () => { if (mo) mo.observe(document.body, { childList: true }); setInterval(() => { watch(); pump(); }, 150); watch(); pump(); };
    if (document.body) start(); else addEventListener("DOMContentLoaded", start);
  }

  return { GAP, INPUT_MS, core, stack, hit, modal, scene, opening, fightTip, pump, layout, C, get queued() { return C.queue.length; }, get waiting() { return later.length; },
    _input(t) { lastInput = t; } };
})();
if (typeof module !== "undefined") module.exports = NOTICES;
