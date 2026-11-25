/* samever.js: everyone plays the same build. [OURS]
   One source of truth for "the newest build": the latest GitHub release (build-N). The phone app (app.js) and the PC app
   (pcupdate.js) read it themselves and download new game files in the background; the web version asks our server
   (GET /api/version, server/src/version.js), or GitHub's API when the server can't answer.
   - Pure part (node-tested): versus() compares two builds, decide() says what to do with a newer one, why() words a
     mismatch between two players, cardBits() puts my build on my public player card.
   - State for the title screen's Updates page: { platform, mine, latest, checking, err, dl, ready } (set() / onChange()).
   - The "Update ready" bar: during play a small card offers Restart now / Later; it never restarts mid-fight or in a
     dungeon (the game saves first). On the title screen the apps switch over by themselves, and the web version reloads.
   - Web: checks on start, when the tab comes back, and every 10 minutes; a newer release reloads the page with fresh
     files (cache-busted) at the next safe moment.
   - Online: my build rides on my player card. A party or co-op invite between different builds says why, and whoever is
     behind gets "Update to play together" with an Update button. Solo offline play is never locked. */
const SAMEVER = (() => {
  const REPO = "R3MC10/Skyrim-Roads";
  const CHECK_MS = 10 * 60000, BACK_MS = 60000, SAFE_MS = 15000;
  const num = (b) => Math.max(0, Math.floor(+b) || 0);

  // ---------------------------------------------------------------- pure part
  /* -1: mine is older · 1: theirs is older · 0: the same, or one of them unknown (old clients send no build) */
  function versus(mine, theirs) {
    const a = num(mine), b = num(theirs);
    if (!a || !b || a === b) return 0;
    return a < b ? -1 : 1;
  }
  /* what to do about the newest build. o: { platform: "app"|"pc"|"web", mine, latest, staged, busy, bad, onTitle, safe }
     -> "none" | "download" | "wait" | "switch" | "prompt" */
  function decide(o) {
    const mine = num(o.mine), latest = num(o.latest);
    if (!mine || !latest || latest <= mine || o.bad) return "none";
    if (o.platform !== "web" && num(o.staged) !== latest) return o.busy ? "wait" : "download";
    return o.onTitle && o.safe ? "switch" : "prompt";
  }
  /* a mismatch with another player, in plain words -> null | { behind: "me"|"them", mine, theirs, text } */
  function why(mine, theirs, name = "They") {
    const v = versus(mine, theirs), m = num(mine), t = num(theirs);
    if (!v) return null;
    return v < 0
      ? { behind: "me", mine: m, theirs: t, text: `${name} is on build ${t} and you're on build ${m}. Update to play together.` }
      : { behind: "them", mine: m, theirs: t, text: `${name} is still on build ${t} (you have build ${m}). They need to update before you can play together.` };
  }
  const cardBits = () => (state.mine ? { build: state.mine } : {});

  // ---------------------------------------------------------------- state
  const state = { platform: "web", mine: 0, latest: 0, date: null, checking: false, err: "", dl: null, ready: null, checkedAt: 0 };
  const subs = [];
  function set(p) { Object.assign(state, p); for (const f of subs) { try { f(state); } catch (e) { /* a screen's problem */ } } }
  const onChange = (f) => { subs.push(f); };
  const DOM = typeof window !== "undefined" && typeof document !== "undefined";
  const app = () => (DOM ? window.__app || null : null);
  const ui = () => (DOM ? window.__ui || null : null);
  const onTitle = () => DOM && !!document.getElementById("title") && !document.querySelector("#title input:focus");
  /* safe to restart: the title screen, or no fight, dungeon, event or mini-game going on (menus are fine: it saves first) */
  const canRestart = () => { try { const u = ui(); return !!(u?.safeToRestart ? u.safeToRestart() : u?.safeToUpdate?.()); } catch (e) { return false; } };
  const safeNow = () => { try { return !!ui()?.safeToUpdate?.(); } catch (e) { return false; } };
  function platform() {
    if (!DOM) return "web";
    if (window.Capacitor?.isNativePlatform?.()) return "app";
    if (window.rotnPC || (typeof PCUPDATE !== "undefined" && PCUPDATE.buildOf(navigator.userAgent, (/[?&]v=([^&#]*)/.exec(location.search) || [])[1]))) return "pc";
    return "web";
  }
  function fresh() {
    state.platform = platform();
    const a = app();
    if (a?.current) a.current().then((c) => { if (num(c?.build) && num(c.build) !== state.mine) set({ mine: num(c.build) }); }).catch(() => {});
    else if (state.platform === "pc" && !state.mine && typeof PCUPDATE !== "undefined") set({ mine: PCUPDATE.buildOf(navigator.userAgent, (/[?&]v=([^&#]*)/.exec(location.search) || [])[1]) });
  }

  // ---------------------------------------------------------------- web: where the newest build comes from
  const timeout = (ms) => { try { return AbortSignal.timeout(ms); } catch (e) { return undefined; } };
  async function webLatest(fetchFn = fetch) {
    const srv = typeof ACCOUNT !== "undefined" && ACCOUNT.server ? ACCOUNT.server() : "";
    if (srv) {
      try {
        const r = await fetchFn(`${srv}/api/version`, { cache: "no-store", signal: timeout(8000) });
        if (r.ok) { const j = await r.json(); if (num(j.build)) return { build: num(j.build), date: j.date || null }; }
      } catch (e) { /* the server is asleep or older: ask GitHub */ }
    }
    const r = await fetchFn(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store", signal: timeout(10000) });
    if (!r.ok) throw new Error(`GitHub said ${r.status}`);
    const j = await r.json(), b = num(String(j.tag_name || "").replace(/\D+/g, ""));
    if (!b) throw new Error("the newest release has no build number");
    return { build: b, date: j.published_at || null };
  }
  /* the web version's own build: the newest release when this page loaded (?rv=N after an update reload) */
  const rvParam = () => (DOM ? num((/[?&]rv=(\d+)/.exec(location.search) || [])[1]) : 0);

  /* re-check now. App/PC: their updater (forced, no cache). Web: our server / GitHub. Resolves the updater's result. */
  async function check(force = true) {
    fresh();
    set({ checking: true, err: "" });
    try {
      const a = app();
      if (a?.check) {
        const r = await a.check(force);
        set({ checking: false, mine: num(r.current?.build) || state.mine, latest: num(r.latest?.build), date: r.latest?.date || null, checkedAt: Date.now() });
        return r;
      }
      if (state.platform !== "web") { set({ checking: false }); return null; }   // an old PC app: pcupdate.js shows its own card
      const l = await webLatest();
      const mine = state.mine || rvParam() || l.build;
      set({ checking: false, mine, latest: l.build, date: l.date, checkedAt: Date.now() });
      webAct();
      return { web: true, current: { build: mine }, latest: l, newer: l.build > mine };
    } catch (e) {
      set({ checking: false, err: String(e?.message || e || "no answer").slice(0, 140) });
      throw e;
    }
  }

  // ---------------------------------------------------------------- web: reload with fresh files
  let reloading = false;
  async function freshReload(build) {
    if (!DOM || reloading) return;
    reloading = true;
    set({ dl: { build, pct: -1 } });
    try { ui()?.save?.(); } catch (e) { /* nothing to save yet */ }
    try {   // ask for every game file again past the browser's cache, so the reload really gets the new ones
      const html = await (await fetch("index.html", { cache: "reload" })).text();
      const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^(https?:)?\/\//.test(s));
      await Promise.all(srcs.map((s) => fetch(s, { cache: "reload" }).catch(() => null)));
    } catch (e) { /* offline for a moment: the address change below still gets a fresh page */ }
    try { sessionStorage.setItem("rotn_open", "menu"); } catch (e) { /* fine */ }
    const q = location.search.replace(/([?&])rv=\d+&?/, "$1").replace(/[?&]$/, "");
    location.replace(`${location.pathname}${q ? q + "&" : "?"}rv=${num(build)}${location.hash || ""}`);
  }
  let safeTimer = null;
  /* web: a newer release is out: reload on the title screen, else offer it and reload once back on the title screen */
  function webAct() {
    const d = decide({ platform: "web", mine: state.mine, latest: state.latest, onTitle: onTitle(), safe: safeNow() });
    if (d === "switch") return freshReload(state.latest);
    if (d === "prompt") ready(state.latest, () => freshReload(state.latest), { web: true });
  }

  // ---------------------------------------------------------------- the "Update ready" bar
  /* go(): switches to the downloaded build (restarts the game). opts.quiet: the PC app shows its own card */
  function ready(build, go, opts = {}) {
    build = num(build);
    if (!build) return;
    const was = state.ready?.build;
    set({ ready: { build, go, web: !!opts.web }, dl: null });
    if (opts.quiet) return;   // the app / PC updater switches over on the title screen by itself
    clearInterval(safeTimer);
    safeTimer = setInterval(() => { if (state.ready && onTitle() && safeNow()) { clearInterval(safeTimer); safeTimer = null; restartNow(); } }, SAFE_MS);
    if (was !== build && hidden !== build) bar();
  }
  let hidden = 0, busy = false;
  async function restartNow() {
    const r = state.ready;
    if (!r || busy) return false;
    if (!canRestart()) { bar("Finish the fight or dungeon first, then press Restart now. Your progress is saved either way."); return false; }
    busy = true; closeCard();
    try { ui()?.save?.(); } catch (e) { /* nothing to save yet */ }
    try { await r.go(); return true; }
    catch (e) { set({ err: String(e?.message || e).slice(0, 140) }); return false; }
    finally { busy = false; }
  }
  const has = () => DOM && !!document.body;
  function closeCard() { if (has()) document.getElementById("samever")?.remove(); }
  /* o: { title, text, buttons: [[label, key, primary]], onClick(key) } */
  function card(o) {
    if (!has()) return null;
    let box = document.getElementById("samever");
    if (!box) { box = document.createElement("div"); box.id = "samever"; box.setAttribute("role", "status"); document.body.appendChild(box); }
    box.innerHTML = `<div class="t"></div><div class="d"></div><div class="b"></div>`;
    box.querySelector(".t").textContent = o.title;
    box.querySelector(".d").textContent = o.text;
    for (const [label, key, pri] of o.buttons || []) {
      const b = document.createElement("button"); b.className = `btn sm${pri ? " pri" : ""}`; b.dataset.k = key; b.textContent = label;
      box.querySelector(".b").appendChild(b);
    }
    box.onclick = (e) => { const k = e.target?.dataset?.k; if (k) o.onClick(k); };
    return box;
  }
  function bar(note) {
    const r = state.ready;
    if (!r) return;
    const web = r.web;
    card({ title: "Update ready", text: note || (web ? `Build ${r.build} is out. Reload now to play it: your progress is saved.` : `Build ${r.build} is downloaded. Restart now to play it: your progress is saved.`),
      buttons: [[web ? "Reload now" : "Restart now", "go", true], ["Later", "no"]],
      onClick(k) { if (k === "go") restartNow(); else { hidden = r.build; closeCard(); } } });
  }

  // ---------------------------------------------------------------- playing together
  /* the Update button: switch to a downloaded build, else open the title screen's Updates page (apps), else reload (web) */
  async function updateNow() {
    closeCard();
    if (state.ready) return restartNow();
    if (!canRestart()) { toast("Finish the fight or dungeon first, then update."); return false; }
    if (app()) { try { ui()?.save?.(); sessionStorage.setItem("rotn_open", "update"); } catch (e) { /* fine */ } location.reload(); return true; }
    try { await check(true); } catch (e) { toast("Couldn't reach the update server. Check your internet and try again."); return false; }
    if (state.latest > state.mine) return freshReload(state.latest);
    toast("You already have the newest version. Your friend needs to update.");
    return false;
  }
  const toast = (t) => card({ title: "Updates", text: t, buttons: [["OK", "no", true]], onClick: () => closeCard() });
  /* show a mismatch: me behind -> "Update to play together" with Update; them behind -> why it can't work */
  function explain(w) {
    if (!w) return false;
    if (w.behind === "me") card({ title: "Update to play together", text: w.text, buttons: [["Update", "up", true], ["Not now", "no"]], onClick(k) { if (k === "up") updateNow(); else closeCard(); } });
    else card({ title: "Different versions", text: w.text, buttons: [["OK", "no", true]], onClick: () => closeCard() });
    return true;
  }
  /* before an invite / accepting one: true (and the reason on screen) when the two of you are on different builds */
  function blockWith(theirCard, name) {
    if (!theirCard) return false;
    return explain(why(state.mine, theirCard.build, name || theirCard.name || "They"));
  }
  /* party members on a newer build: tell me once per build (ui.js mounts it with the party and the player cards) */
  let told = 0, watching = false;
  function watch(ctx) {
    if (watching) return; watching = true;
    const tick = () => {
      const p = ctx.party?.(), me = ctx.S?.();
      if (!p || !me || !state.mine) return;
      const ahead = (p.members || []).filter((m) => m.id !== me.id).map((m) => ({ m, c: ctx.cardOf?.(m.id) })).filter((x) => x.c && versus(state.mine, x.c.build) < 0);
      if (!ahead.length) return;
      const top = ahead.sort((a, b) => num(b.c.build) - num(a.c.build))[0];
      if (told === num(top.c.build)) return;
      told = num(top.c.build);
      explain(why(state.mine, top.c.build, top.m.name || top.c.name));
    };
    setInterval(tick, 30000);
    setTimeout(tick, 12000);
  }

  // ---------------------------------------------------------------- start
  let lastBack = 0;
  function start() {
    if (!DOM) return;
    state.platform = platform();
    if (state.platform !== "web") { setTimeout(fresh, 2500); setInterval(fresh, CHECK_MS); return; }   // app.js / pcupdate.js check and download
    state.mine = rvParam();
    if (navigator.webdriver && !/[?&]vercheck=1/.test(location.search)) return;   // screen tests stay offline (like the account server)
    const go = () => { check(true).catch(() => {}); };
    setTimeout(go, 4000);
    setInterval(go, CHECK_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - lastBack > BACK_MS) { lastBack = Date.now(); go(); } });
  }
  start();
  return { versus, decide, why, cardBits, state, set, onChange, check, ready, restartNow, updateNow, explain, blockWith, watch, webLatest, freshReload, bar, closeCard, dl: (build, pct) => set({ dl: { build: num(build), pct: Math.round(+pct) } }), dlDone: () => set({ dl: null }) };
})();
if (typeof module !== "undefined") module.exports = SAMEVER;
