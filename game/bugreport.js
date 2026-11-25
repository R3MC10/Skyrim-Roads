/* bugreport.js: "Report a problem". [OURS]
   F12 on a PC, or Settings → Report a problem on a phone, opens a small window: a short title, what happened and a
   kind (bug, balance, art, text, idea). Sending it posts to our server (POST /api/report), which turns it into a
   GitHub issue labelled player-report that Claude picks up and fixes.
   The report carries who sent it (the player's account name, or the hero's name when not signed in, plus the
   hero's name) and what helps find the problem, nothing else personal: the game build,
   PC or Android, screen size, art style, language, which screen is open, where you are, your level, the last 40
   lines of the game's own error log (kept here: console.error, uncaught errors, failed promises) and a small
   snapshot of the game (fight summary, item counts, quest stages). No screenshot (that would need a new library).
   Offline or the server can't be reached → the report is kept on the device and sent later by itself. */
const BUGREPORT = (() => {
  const QKEY = "bugrep.queue", LOG_MAX = 40, LINE_MAX = 300, QUEUE_MAX = 10, RETRY_MS = 5 * 60e3;
  const CATS = [["bug", "Bug"], ["balance", "Balance"], ["art", "Art"], ["text", "Text"], ["idea", "Idea"]];
  const LIM = { title: 100, text: 4000 };
  const HAS_DOM = typeof document !== "undefined" && typeof document.createElement === "function";
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------------------------------------------------------------- the small error log (ring buffer)
  const ring = [];
  const stamp = () => { const d = new Date(); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((x) => String(x).padStart(2, "0")).join(":"); };
  const str = (a) => { if (a instanceof Error) return a.stack || a.message || String(a); if (typeof a === "string") return a; try { return JSON.stringify(a); } catch (e) { return String(a); } };
  function log(kind, ...args) {
    const line = `${stamp()} ${kind}: ${args.map(str).join(" ")}`.replace(/\s+/g, " ").slice(0, LINE_MAX);
    ring.push(line); while (ring.length > LOG_MAX) ring.shift();
  }
  const lines = () => ring.slice();
  let hooked = false;
  function hook(con, win) {
    if (hooked) return; hooked = true;
    if (con && typeof con.error === "function") {
      const orig = con.error;
      con.error = function (...a) { try { log("error", ...a); } catch (e) { /* never break logging */ } return orig.apply(this, a); };
    }
    if (win && typeof win.addEventListener === "function") {
      win.addEventListener("error", (e) => log("uncaught", e?.message || "error", e?.filename ? `${String(e.filename).split("/").pop()}:${e.lineno}:${e.colno}` : "", e?.error?.stack ? e.error.stack.split("\n").slice(1, 3).join(" ") : ""));
      win.addEventListener("unhandledrejection", (e) => log("promise", e?.reason ?? "rejected"));
    }
  }

  // ---------------------------------------------------------------- what goes with a report
  const game = () => { try { return typeof window !== "undefined" ? window.__dbg?.save?.() || null : null; } catch (e) { return null; } };
  const byId = (id) => (HAS_DOM && typeof document.getElementById === "function" ? document.getElementById(id) : null);
  function screenId() {
    if (!HAS_DOM) return "none";
    const order = [["tbf", "fight"], ["tbwatch", "fight-watch"], ["lockpick", "lockpick"], ["pickgame", "minigame"], ["dun", "dungeon"], ["title", "title"], ["tw", "tab-menu"], ["sky", "skills"], ["modal", "popup"]];
    const open = order.filter(([id]) => byId(id)).map(([, n]) => n);
    let tab = "";
    try { tab = document.querySelector?.("#tabs [data-tab].on, #tabs [data-tab][aria-selected=true]")?.dataset?.tab || ""; } catch (e) { /* no tabs */ }
    return [...open, tab && "tab:" + tab].filter(Boolean).join(" > ") || "map";
  }
  function platform() {
    if (typeof window === "undefined") return "node";
    if (window.Capacitor?.isNativePlatform?.()) return "Android app";
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    if (/Electron\//.test(ua)) return "PC app";
    return (/Android|iPhone|iPad|Mobile/.test(ua) ? "phone browser" : "PC browser");
  }
  function fightSummary() {
    try {
      if (typeof TB === "undefined" || !TB.open) return null;
      const s = TB.session, f = s?.f; if (!s) return { open: true };
      return { round: s.round, kind: s.kind, wave: s.wave, waves: s.waves, foe: f?.e?.name || f?.e?.id || null, foeHp: Math.round(f?.ehp || 0), foeHpMax: Math.round(s.ehpMax || 0),
        myHp: f?.hp != null ? Math.round(f.hp) : null, allies: (f?.allies || []).length, done: !!s.done };
    } catch (e) { return { error: String(e?.message || e) }; }
  }
  function stateSnapshot(S) {
    if (!S) return { character: null };
    const inv = S.inv || [], by = {};
    for (const it of inv) { const k = (typeof D !== "undefined" && D.ITEMS?.[it.item]?.type) || it.type || "other"; by[k] = (by[k] || 0) + (it.qty || 1); }
    const quests = {};
    for (const [id, q] of Object.entries(S.quests || {})) quests[id] = q?.done ? "done" : q?.stage ?? "?";
    return {
      location: S.location || null, trip: S.trip ? { status: S.trip.status || null, dest: S.trip.dest?.name || S.trip.dest || null } : null,
      dungeon: S.dungeon ? { name: S.dungeon.name || S.dungeon.id || null, room: S.dungeon.idx ?? S.dungeon.room?.i ?? null } : null,
      health: S.health, gold: S.gold, pendingLevels: S.pendingLevels || 0, items: inv.length, itemsByType: by,
      follower: S.follower ? (S.follower.id || S.follower.name || true) : null, quests, fight: fightSummary(),
    };
  }
  function buildNo() {
    try { return typeof PATCHNOTES !== "undefined" ? PATCHNOTES.latest().build : null; } catch (e) { return null; }
  }
  /* everything about the game and device (no personal data: just the hero's name) */
  function info(S, extra = {}) {
    const w = typeof window !== "undefined" ? window : {};
    return {
      build: buildNo(), notes: (() => { try { return PATCHNOTES.latest().id; } catch (e) { return null; } })(),
      appBuild: extra.appBuild ?? null, platform: platform(),
      screen: w.innerWidth ? `${w.innerWidth}x${w.innerHeight}@${Math.round((w.devicePixelRatio || 1) * 100) / 100}` : null,
      artStyle: (() => { try { return ART.style(); } catch (e) { return null; } })(),
      lang: (() => { try { return I18N.lang(); } catch (e) { return null; } })(),
      view: screenId(), location: S?.location || null, level: S?.level ?? null,
    };
  }
  /* who's sending: the account name used for friends and parties when signed in, else the hero's name, else null */
  function playerName(S) {
    let n = null;
    try { if (typeof ACCOUNT !== "undefined" && (!ACCOUNT.signedIn || ACCOUNT.signedIn())) n = ACCOUNT.user?.()?.username || null; } catch (e) { /* no account module */ }
    if (!n && S?.name) n = S.name;
    n = n == null ? "" : String(n).replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 40);
    return n || null;
  }
  /* the payload the server gets; form = { title, text, category } */
  function payload(form, ctx = {}) {
    const S = "S" in ctx ? ctx.S : game();
    const cat = CATS.some(([k]) => k === form.category) ? form.category : "bug";
    return {
      title: String(form.title || "").trim().slice(0, LIM.title),
      text: String(form.text || "").trim().slice(0, LIM.text),
      category: cat,
      player: playerName(S),
      character: S?.name ? String(S.name).slice(0, 40) : null,
      info: info(S, ctx),
      log: lines(),
      state: stateSnapshot(S),
      at: Date.now(),
    };
  }

  // ---------------------------------------------------------------- sending, and the offline queue
  const store = () => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (e) { return null; } };
  function queue() { try { const v = JSON.parse(store()?.getItem(QKEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function setQueue(q) { try { const ls = store(); if (!ls) return; if (q.length) ls.setItem(QKEY, JSON.stringify(q.slice(-QUEUE_MAX))); else ls.removeItem(QKEY); } catch (e) { /* storage full or blocked */ } }
  function server() {
    try { if (typeof ACCOUNT !== "undefined" && ACCOUNT.server) return ACCOUNT.server(); } catch (e) { /* no account module */ }
    return "";
  }
  /* one try: "sent" | "retry" (offline, server busy) | "dropped" (the server refused it for good) */
  async function post(p, base = server()) {
    if (!base || typeof fetch !== "function") return { status: "retry" };
    let r;
    try { r = await fetch(base + "/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }); }
    catch (e) { return { status: "retry" }; }
    let j = {}; try { j = await r.json(); } catch (e) { /* no body */ }
    if (r.ok) return { status: "sent", issue: j.issue ?? null };
    if (r.status === 429 || r.status >= 500) return { status: "retry" };
    return { status: "dropped", error: j.error || r.status };
  }
  /* send now; if that fails, keep it for later. → "sent" | "queued" | "dropped" */
  async function send(p) {
    const r = await post(p);
    if (r.status === "retry") { setQueue([...queue(), p]); armRetry(); return { result: "queued" }; }
    if (r.status === "sent") flush();   // the line is up: send anything older too
    return { result: r.status, issue: r.issue ?? null };
  }
  let flushing = false;
  /* send what's waiting, oldest first; stops at the first one that still can't go */
  async function flush() {
    if (flushing) return 0;
    flushing = true; let sent = 0;
    try {
      let q = queue();
      while (q.length) {
        const r = await post(q[0]);
        if (r.status === "retry") break;
        if (r.status === "sent") sent++;
        q = queue().slice(1); setQueue(q);
      }
    } finally { flushing = false; }
    return sent;
  }
  let timer = null;
  function armRetry() {
    if (timer || typeof setInterval !== "function") return;
    timer = setInterval(() => { if (!queue().length) { clearInterval(timer); timer = null; return; } flush(); }, RETRY_MS);
    timer?.unref?.();
  }

  // ---------------------------------------------------------------- the window
  let box = null, extraCtx = {};
  const isOpen = () => !!box;
  function html(who = playerName(game())) {
    return `<div class="sheet brsheet" role="dialog" aria-modal="true" aria-labelledby="brh">
      <h2 id="brh">Report a problem</h2>
      <p class="mute brsub">Tell us what went wrong or what could be better. It goes straight to the people fixing the game.</p>
      <label class="brl" for="brtitle">Short title</label>
      <input id="brtitle" maxlength="${LIM.title}" autocomplete="off" placeholder="e.g. Can't sell the iron sword">
      <label class="brl" for="brtext">What happened?</label>
      <textarea id="brtext" rows="5" maxlength="${LIM.text}" placeholder="What did you do, what did you expect, what happened instead?"></textarea>
      <div class="brl">Kind</div>
      <div class="seg brcats" role="group">${CATS.map(([k, l], i) => `<button type="button" data-brcat="${k}" class="${i ? "" : "on"}" aria-pressed="${!i}">${l}</button>`).join("")}</div>
      <p class="mute brnote">We also attach the game build, your device type and screen size, your art style, where you are, your level and the game's recent error log. Nothing personal beyond your player and hero names.</p>
      ${who ? `<p class="brfrom">Sent as ${esc(who)}</p>` : ""}
      <p class="brmsg" id="brmsg" role="status"></p>
      <div class="grid2"><button type="button" class="btn" data-brep="cancel">Cancel</button><button type="button" class="btn pri" data-brep="send">Send</button></div>
    </div>`;
  }
  function open() {
    if (!HAS_DOM || box) return false;
    box = document.createElement("div"); box.id = "bugrep"; box.className = "modal bugrep";
    box.innerHTML = html();
    document.body.appendChild(box);
    box.addEventListener?.("click", onBoxClick);
    box.addEventListener?.("keydown", (e) => { if (e.key !== "Escape" && e.key !== "F12") e.stopPropagation(); });   // typing doesn't trigger hotkeys
    try { box.querySelector("#brtitle")?.focus?.(); } catch (e) { /* no focus */ }
    if (typeof window !== "undefined" && window.__app?.current) window.__app.current().then((c) => { extraCtx.appBuild = c?.build ?? null; }).catch(() => {});
    return true;
  }
  function close() { if (box) { box.remove?.(); box = null; } }
  let category = "bug";
  function msg(t, kind = "") { const m = box?.querySelector?.("#brmsg"); if (m) { m.textContent = t; m.className = "brmsg " + kind; } }
  async function submit() {
    if (!box) return null;
    const title = box.querySelector("#brtitle")?.value || "", text = box.querySelector("#brtext")?.value || "";
    if (title.trim().length < 3 && text.trim().length < 3) { msg("Write a short title or a few words about what happened.", "bad"); return null; }
    const btn = box.querySelector("[data-brep=send]"); if (btn) btn.disabled = true;
    msg("Sending…");
    const p = payload({ title: title.trim() || text.trim().slice(0, 60), text, category }, extraCtx);
    const r = await send(p);
    const t = r.result === "sent" ? "Report sent, thanks!" : r.result === "queued" ? "Saved, will send when online" : "The server didn't take that report. Try writing it a bit differently.";
    msg(t, r.result === "dropped" ? "bad" : "good");
    if (r.result === "dropped") { if (btn) btn.disabled = false; return r; }
    const b = box; setTimeout(() => { if (box === b) close(); }, 1600);
    return r;
  }
  function onBoxClick(e) {
    const c = e.target?.closest?.("[data-brcat]");
    if (c) {
      category = c.dataset.brcat;
      box.querySelectorAll?.("[data-brcat]").forEach((b) => { const on = b === c; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
      return;
    }
    const a = e.target?.closest?.("[data-brep]")?.dataset?.brep;
    if (a === "cancel") close();
    else if (a === "send") submit();
    else if (e.target === box) close();   // tap outside the sheet
  }
  /* F12 opens it (and closes it again); Esc closes it before anything else sees the key */
  function onKey(e) {
    if (e.key === "F12") { e.preventDefault?.(); e.stopPropagation?.(); if (box) close(); else open(); return true; }
    if (e.key === "Escape" && box) { e.preventDefault?.(); e.stopPropagation?.(); close(); return true; }
    return false;
  }
  /* the Settings button (Settings is the phone's way in) */
  const settingsHTML = () => `<h3>Help</h3><button class="btn" data-brep="open" style="width:100%">\uE105 Report a problem</button><p class="mute" style="font-size:13px;margin-top:4px">On a PC, F12 opens it from anywhere.</p>`;

  // ---------------------------------------------------------------- start
  hook(typeof console !== "undefined" ? console : null, typeof window !== "undefined" ? window : null);
  if (HAS_DOM && typeof addEventListener === "function") {
    addEventListener("keydown", onKey, true);   // capture: runs before the game's own keys (desktop.js)
    document.addEventListener?.("click", (e) => { if (e.target?.closest?.("[data-brep=open]")) { e.preventDefault?.(); open(); } });
    addEventListener("online", () => flush());
    setTimeout(() => { if (queue().length) flush(); }, 5000);
  }
  return { CATS, LIM, QKEY, log, lines, hook, payload, playerName, html, info, stateSnapshot, screenId, queue, post, send, flush, open, close, isOpen, submit, onKey, settingsHTML,
    _reset() { ring.length = 0; close(); setQueue([]); category = "bug"; extraCtx = {}; } };
})();
if (typeof module !== "undefined") module.exports = BUGREPORT;
