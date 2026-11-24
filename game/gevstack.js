/* gevstack.js: the great world event card and the notice strips under it on the map screen can be folded away. [OURS]
   - a small chevron on the card folds the whole stack into one slim pill: "[icon] Siege of Markarth 44:58 · 2 notices";
     tapping the pill opens it again
   - each notice strip (a burned town rebuilding, a reward waiting...) has an × that hides it until its news changes
     (another event, or the rebuild finishing and a new line taking its place)
   - folded or not is remembered per hero on this device (localStorage, never required)
   - a new event never forces the card open: if you folded it, the pill glows for a few seconds instead
   greatevents.js builds the parts (bannerHTML) and hands them to compose(); clicks come back through mount(). */
const GEVSTACK = (() => {
  const KEY = "rotn_gevui";
  const DAY = 86400;
  const T = (en, v) => {   // Polish from i18n_esckey.js when the player plays in Polish
    let s = en; try { if (typeof I18N !== "undefined" && I18N.lang() === "pl" && typeof I18N_EXTRA !== "undefined" && I18N_EXTRA.words[en]) s = I18N_EXTRA.words[en]; } catch { /* English */ }
    return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : s;
  };
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ------------------------------------------------------------ remembered state (per hero, this device)
  const blank = () => ({ c: false, d: {}, seen: "" });
  let mem = {};   // id → state, a copy when storage is blocked
  let store = null;
  function storage() { if (store) return store; try { if (typeof localStorage !== "undefined") return localStorage; } catch { /* blocked */ } return null; }
  function load(id) {
    const k = KEY + ":" + (id || "anon");
    if (mem[k]) return mem[k];
    let st = blank();
    try { const raw = storage()?.getItem(k); if (raw) { const j = JSON.parse(raw); if (j && typeof j === "object") st = { c: !!j.c, d: j.d && typeof j.d === "object" ? j.d : {}, seen: String(j.seen || "") }; } } catch { /* broken or blocked: start fresh */ }
    mem[k] = st; return st;
  }
  function save(id, st) {
    const k = KEY + ":" + (id || "anon"); mem[k] = st; ver++;
    try { storage()?.setItem(k, JSON.stringify(st)); } catch { /* storage blocked: it lasts until the game closes */ }
  }
  let ver = 0;

  // ------------------------------------------------------------ rules (pure, tested in node)
  /* drop dismissals older than 5 days so the list never grows */
  function prune(st, t) { for (const [k, at] of Object.entries(st.d)) if (!(at > t - 5 * DAY)) delete st.d[k]; return st; }
  /* which strips still show: a strip's key names its news (event id + outcome), so new news shows again */
  const shown = (strips, st) => strips.filter((s) => !s.key || !st.d[s.key]);
  function dismiss(st, key, t) { if (key) st.d[key] = t; return st; }
  function setCollapsed(st, on) { st.c = !!on; return st; }
  /* a new event (or a new stage of one) since the player last saw the stack: the pill glows if it's folded */
  function fresh(st, evKey) { return !!evKey && st.seen !== evKey; }
  function pillText(ev, n) {
    const parts = [];
    if (ev) parts.push(ev.name);
    if (n) parts.push(T(n === 1 ? "{n} notice" : "{n} notices", { n }));
    return parts.join(" · ");
  }

  // ------------------------------------------------------------ icons (small ink glyphs, no emoji)
  const SV = (d, extra = "") => `<svg class="gevs-ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;
  const ICONS = {
    siege: SV('<path d="M4 4l11 11M4 4v3.5M4 4h3.5M15 15l-2 2m2-2 2-2M13.5 16.5l4 4m-.5-6.5 3 3"/><path d="M20 4 9 15M20 4v3.5M20 4h-3.5M9 15l2 2m-2-2-2-2M10.5 16.5l-4 4m.5-6.5-3 3"/>'),
    dragon: SV('<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3.4 2.6-5 3.6-8.5C10.4 9 11 10.5 11 12c1-1.5 1.4-4.6.4-9 3.5 2.4 7.1 6.6 7.1 12 0 3.4-2.5 6-6.5 6z"/>'),
    rift: SV('<path d="M12 12c0-1.6 1.6-2.6 3-1.8 1.9 1 1.8 4-.3 5.1-3 1.5-6.5-.7-6.5-4.1 0-4.2 4.6-6.6 8.4-4.8 4.7 2.2 5.2 9.1.9 12.3"/>'),
    fair: SV('<path d="M3 20h18M5 20V10m14 10V10M3 10l9-6 9 6zM12 4v-1.5M9 20v-5h6v5"/>'),
    notice: SV('<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/>'),
  };
  const CHEV_UP = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>`;
  const CHEV_DN = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
  const CROSS = `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
  const icon = (kind) => ICONS[kind] || ICONS.notice;
  const still = () => { try { return typeof MOTION !== "undefined" ? !MOTION.on() : matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

  // ------------------------------------------------------------ the HTML
  let hiUntil = 0, curId = "", lastT = 0;
  /* parts: { id: hero id, ev: current event or null, evKey, end: countdown end (s), cdTxt, banner: html, strips: [{ key, html }] }
     returns the stack's HTML ("" when there's nothing to show) */
  function compose(p, t, now = Date.now()) {
    const st = prune(load(p.id), t); curId = p.id; lastT = t;
    const strips = shown(p.strips || [], st);
    if (!p.banner && !strips.length) return "";
    if (fresh(st, p.evKey)) {   // something new: mark it seen; a folded stack makes its pill glow for a while
      if (st.c && p.ev) hiUntil = now + 8000;
      st.seen = p.evKey; save(p.id, st);
    }
    if (st.c) {
      const hi = now < hiUntil, cd = p.ev && p.end ? ` <b class="gevs-cd" data-gev-end="${p.end}">${esc(p.cdTxt || "")}</b>` : "";
      return `<button type="button" class="gevs-pill${hi ? " gevs-new" + (still() ? " gevs-still" : "") : ""}${p.ev ? " gevs-" + p.ev.kind : ""}" data-gevs="open" aria-expanded="false" aria-label="${esc(T("Show world events"))}">${icon(p.ev ? p.ev.kind : "notice")}<span class="gevs-txt">${esc(pillText(p.ev, strips.length))}</span>${cd}${CHEV_DN}</button>`;
    }
    const body = (p.banner || "") + strips.map((s) => s.key ? s.html.replace(/<\/div>\s*$/, `<button type="button" class="gevs-x" data-gevs="dismiss" data-key="${esc(s.key)}" aria-label="${esc(T("Hide this notice"))}" title="${esc(T("Hide this notice"))}">${CROSS}</button></div>`) : s.html).join("");
    return `<div class="gev-card gevs-card"><button type="button" class="gevs-fold" data-gevs="fold" aria-expanded="true" aria-label="${esc(T("Hide world events"))}" title="${esc(T("Hide world events"))}">${CHEV_UP}</button>${body}</div>`;
  }
  /* part of greatevents' "did anything change?" signature */
  const sig = (now = Date.now()) => ver + (now < hiUntil ? "h" : "");

  // ------------------------------------------------------------ clicks
  let onChange = null;
  function click(e) {
    const b = e.target?.closest?.("[data-gevs]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const st = load(curId), t = lastT || Date.now() / 1000, a = b.dataset.gevs;
    if (a === "fold") setCollapsed(st, true);
    else if (a === "open") { setCollapsed(st, false); hiUntil = 0; }
    else if (a === "dismiss") dismiss(st, b.dataset.key, t);
    else return;
    save(curId, st);
    try { if (typeof SOUND !== "undefined") SOUND.fx("click"); } catch { /* quiet */ }
    if (onChange) onChange();
    if (a === "open" || a === "fold") requestAnimationFrame?.(() => document.querySelector(a === "open" ? "#gev .gevs-fold" : "#gev .gevs-pill")?.focus?.({ preventScroll: true }));
  }
  function mount(refresh) {
    onChange = refresh;
    if (!mount.done && typeof document !== "undefined" && document.addEventListener) { mount.done = true; document.addEventListener("click", click, true); }
  }
  const _test = { reset() { mem = {}; hiUntil = 0; ver = 0; }, setStorage(s) { store = s; mem = {}; } };

  return { KEY, load, save, prune, shown, dismiss, setCollapsed, fresh, pillText, compose, sig, mount, click, _test };
})();
if (typeof module !== "undefined") module.exports = GEVSTACK;
