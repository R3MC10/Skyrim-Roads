/* pcupdate.js: game updates on the Windows app. [OURS]
   Newer PC apps (desktop/main.js + preload.js give the page window.rotnPC) update the game files by themselves,
   installed or portable: a small card shows the download, then "Restart to update"; on the title screen it just
   switches over (and by itself once the player is back there), so friends stay on the same build (samever.js). Files
   not switched yet still go live if the game is closed first. A build that doesn't reach
   the title screen goes back to the one before by itself (desktop/gameupdate.js). Only a release that needs a newer
   app downloads the installer (installed copy) or shows a download link (portable).
   It also sets window.__app like the phone app does, so the title screen's Update page works on PC too.
   Older PC apps (no rotnPC) keep the old card: a link to the download page when they fall behind.
   main.js adds ?pc=portable|setup&v=1.0.BUILD to the page address. */
const PCUPDATE = (() => {
  const REPO = "R3MC10/Skyrim-Roads", PAGE = `https://github.com/${REPO}/releases/latest`;
  // ?pc= and ?v= from the address, read at start (the game may tidy the address later; plain parsing so it loads anywhere)
  const SEARCH = (() => { try { return String(location.search || ""); } catch (e) { return ""; } })();
  const param = (k) => { const m = new RegExp("[?&]" + k + "=([^&#]*)").exec(SEARCH); return m ? decodeURIComponent(m[1]) : null; };
  /* this PC build's number: ?v=1.0.129 from main.js, else the user agent ("Roads of the North/1.0.129 ... Electron/33"), else 0 */
  function buildOf(ua, v) {
    const q = /^\d+\.\d+\.(\d+)$/.exec(String(v || ""));
    if (q) return +q[1];
    if (!/Electron\//.test(String(ua || ""))) return 0;
    const m = /(?:roads-of-the-north-pc|Roads of the North)\/\d+\.\d+\.(\d+)/i.exec(String(ua || ""));
    return m ? +m[1] : 0;
  }
  /* old apps: should the card show? kind: "portable" | "setup" | "" (old builds don't say) */
  function shouldShow(cur, latest, kind) {
    if (!(cur > 0) || !(latest > cur)) return false;
    return kind === "setup" ? latest - cur >= 3 : true;
  }
  function text(cur, latest, kind) {
    return kind === "setup"
      ? `Build ${latest} is out, you're on ${cur}, and the game hasn't updated itself. Download the new setup once and run it: your saves stay.`
      : `Build ${latest} is out (you're on ${cur}). This portable version needs the new one: download it once, and from then on it updates the game by itself. Your saves stay.`;
  }

  /* ---------- the card (bottom right) ---------- */
  const has = () => typeof document !== "undefined" && !!document.body;
  /* o: { title, text, pct (number shows a bar), buttons: [[label, key, primary]] , onClick(key) } */
  function card(o) {
    if (!has()) return null;
    let box = document.getElementById("pcupd");
    if (!box) {
      box = document.createElement("div"); box.id = "pcupd";
      box.innerHTML = `<div class="t"></div><div class="d"></div><div class="pbar"><i></i></div><div class="b"></div>`;
      document.body.appendChild(box);
    }
    box.querySelector(".t").textContent = o.title || "New version";
    box.querySelector(".d").textContent = o.text || "";
    const bar = box.querySelector(".pbar"); bar.style.display = typeof o.pct === "number" ? "" : "none";
    if (typeof o.pct === "number") bar.firstChild.style.width = `${Math.max(3, Math.min(100, o.pct))}%`;
    const b = box.querySelector(".b"), sig = (o.buttons || []).map((x) => x.join("|")).join(";");
    if (b.dataset.sig !== sig) {
      b.dataset.sig = sig; b.innerHTML = "";
      for (const [label, key, pri] of o.buttons || []) {
        const btn = document.createElement("button"); btn.className = `btn sm${pri ? " pri" : ""}`; btn.dataset.k = key; btn.textContent = label; b.appendChild(btn);
      }
    }
    box.onclick = (e) => { const k = e.target?.dataset?.k; if (k && o.onClick) o.onClick(k); };
    return box;
  }
  const closeCard = () => { if (has()) document.getElementById("pcupd")?.remove(); };

  /* ---------- old PC apps: just a download link ---------- */
  function show(cur, latest, kind) {
    if (!has() || document.getElementById("pcupd")) return;
    card({ text: text(cur, latest, kind), buttons: [["Download", "get", true], ["Later", "no"]], onClick(k) {
      if (k === "get") window.open(PAGE, "_blank");   // main.js opens links in the real browser
      try { sessionStorage.setItem("rotn_pcupd", String(latest)); } catch (x) { /* fine */ }
      closeCard();
    } });
  }
  async function checkOld() {
    if (typeof navigator === "undefined" || typeof fetch !== "function") return;
    const kind = param("pc") || "";
    const cur = buildOf(navigator.userAgent, param("v")); if (!cur) return;   // not the PC app
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json(), latest = parseInt(String(j.tag_name).replace(/\D+/g, ""), 10) || 0;
      let seen = ""; try { seen = sessionStorage.getItem("rotn_pcupd") || ""; } catch (x) { /* fine */ }
      if (seen !== String(latest) && shouldShow(cur, latest, kind)) show(cur, latest, kind);
    } catch (e) { /* offline: try next start */ }
  }

  /* ---------- newer PC apps: updates by themselves ---------- */
  /* B: window.rotnPC (preload.js). Returns the updater object (also window.__app). */
  function makeUpdater(B, env = {}) {
    const ui = () => (typeof window !== "undefined" ? window.__ui : null) || env.ui || null;
    const onTitle = () => (env.onTitle ? env.onTitle() : has() && !!document.getElementById("title"));
    const safe = () => { try { return env.safe ? env.safe() : !!ui()?.safeToUpdate?.(); } catch (e) { return false; } };
    /* pressing Restart: fine in a menu (it saves first), never mid-fight or in a dungeon (ui.js safeToRestart) */
    const restartOk = () => { try { const u = ui(); return env.safe ? env.safe() : u?.safeToRestart ? !!u.safeToRestart() : safe(); } catch (e) { return false; } };
    let staged = 0, busy = null, lastFail = "", hidden = 0, appState = null, readyDone = false, waitTimer = null;
    const clean = (e) => String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

    /* download the new game files; the card shows how far along it is unless the player hid it */
    function fetchGame(r, onStep = () => {}) {
      if (staged === r.latest.build) return Promise.resolve({ build: staged });
      if (busy) return busy;
      const b = r.latest.build;
      const step = (pct, txt) => {
        try { ui()?.updateProgress?.(b, pct); } catch (e) { /* the Updates page is optional */ }
        onStep(pct >= 0 ? `Downloading… ${pct}%` : txt || "Downloading…", pct);
        if (hidden !== b) card({ title: "Updating", text: pct >= 0 && pct < 100 ? `Downloading build ${b}… ${pct}%` : txt === "Unpacking" ? "Unpacking the new files…" : `Downloading build ${b}…`, pct: Math.max(0, pct),
          buttons: [["Hide", "hide"]], onClick(k) { if (k === "hide") { hidden = b; closeCard(); } } });
      };
      const off = B.onProgress?.((p) => step(+p?.pct, p?.text));
      step(0);
      busy = B.download().then((x) => { staged = b; lastFail = ""; return x; })
        .catch((e) => { lastFail = clean(e); closeCard(); try { ui()?.updateProgress?.(0, -1, lastFail); } catch (x) { /* fine */ } throw new Error(lastFail); })
        .finally(() => { busy = null; try { off?.(); } catch (e) { /* fine */ } });
      return busy;
    }
    async function restart() {
      try { ui()?.save?.(); } catch (e) { /* nothing to save yet */ }
      card({ title: "Updating", text: "Restarting on the new version…", pct: 100, buttons: [] });
      if (!(await B.apply())) { closeCard(); staged = 0; }
    }
    /* the new files are here: switch now on the title screen, else ask (and switch by itself once back on the title screen).
       Friends on other builds can't play together (samever.js), so it never waits for the next start */
    function offer(b) {
      clearInterval(waitTimer); waitTimer = null;
      if (onTitle() && safe()) return restart();
      try { ui()?.updateStaged?.(lastR, restart, true); } catch (e) { /* the Updates page shows it too (samever.js); this card is the PC's own */ }
      if (hidden !== b) card({ title: "Update ready", text: `Build ${b} is downloaded. Restart now to play it, or keep playing: it switches over by itself once you're back on the title screen.`,
        buttons: [["Restart to update", "go", true], ["Later", "no"]],
        onClick(k) { if (k === "go") { if (restartOk() || onTitle()) restart(); else card({ title: "Update ready", text: "Finish the fight or dungeon first, then press it again. Your progress is saved either way.", buttons: [["Restart to update", "go", true], ["Later", "no"]], onClick: this.onClick }); } else { hidden = b; closeCard(); } } });
      waitTimer = setInterval(() => { if (onTitle() && safe()) { clearInterval(waitTimer); waitTimer = null; restart(); } }, 15000);
    }
    /* a release that needs a newer app */
    function appCard(r, a) {
      const b = r.latest.build, kind = r.current?.kind;
      if (hidden === -b) return;
      const later = (k) => { if (k === "no") { hidden = -b; closeCard(); } };
      if (kind === "portable" || a?.state === "manual") {
        return card({ title: "New version", text: text(r.current.build, b, "portable"), buttons: [["Download", "get", true], ["Later", "no"]],
          onClick(k) { if (k === "get") { B.openPage(); hidden = -b; closeCard(); } else later(k); } });
      }
      if (a?.state === "ready") return card({ title: "Update ready", text: `The new app (build ${b}) is downloaded. Restart to install it: your saves stay. It also installs by itself when you close the game.`,
        buttons: [["Restart to update", "go", true], ["Later", "no"]], onClick(k) { if (k === "go") { try { ui()?.save?.(); } catch (e) { /* fine */ } B.installApp(); } else later(k); } });
      if (a?.state === "downloading" || a?.state === "checking") return card({ title: "Updating", text: `Build ${b} needs a new version of the app. Downloading it in the background… ${a.pct || 0}%`, pct: a.pct || 0, buttons: [["Hide", "no"]], onClick: later });
      if (a?.state === "error") return card({ title: "New version", text: `Build ${b} needs a new version of the app, and it couldn't download by itself. Get the new setup once: your saves stay.`,
        buttons: [["Download", "get", true], ["Later", "no"]], onClick(k) { if (k === "get") { B.openPage(); hidden = -b; closeCard(); } else later(k); } });
      return null;
    }
    let lastR = null;
    B.onApp?.((a) => { appState = a; if (lastR && !lastR.quick) appCard(lastR, a); });

    const upd = {
      native: true, pc: true,
      async current() { const i = await B.info(); return { ...i, build: i.build }; },
      async how() {
        const i = await B.info();
        return `Game build ${i.build}${i.kind === "portable" ? " (portable)" : ""}: new game files download by themselves and switch over on the title screen, no reinstall.${lastFail ? ` The last download didn't work (${lastFail}); it tries again by itself.` : ""}`;
      },
      /* -> { current, latest: { build, notes, date, size }, newer, quick, size, bad } (the shape ui.js knows) */
      async check() {
        const r = await B.check().catch((e) => { throw new Error(clean(e)); });
        const out = { ...r, latest: { ...r.latest, size: r.size || r.latest?.game?.size || 0 } };
        lastR = out;
        return out;
      },
      /* "Update now" on the title screen. onStep(text, pct). */
      async install(lat, onStep = () => {}) {
        const r = lastR && lastR.latest.build === lat.build ? lastR : await upd.check();
        if (r.quick) {
          try { await fetchGame(r, onStep); } catch (e) { throw new Error(`couldn't download it right now (${e.message}). Nothing changed, and the game tries again by itself in a few minutes`); }
          onStep("Restarting on the new version…", 100);
          await restart();
          return "applied";
        }
        if (appState?.state === "ready") { onStep("Installing the new app…", 100); try { ui()?.save?.(); } catch (e) { /* fine */ } await B.installApp(); return "applied"; }
        await B.openPage();
        onStep("This build needs the new app: get it from the page that just opened (your saves stay).", -1);
        return "page";
      },
      ready() {
        if (readyDone) return; readyDone = true;
        try { B.ready()?.catch?.(() => {}); } catch (e) { /* older app */ }
      },
      /* background check: on start, every 10 minutes and when the window comes back */
      async auto() {
        let r;
        try { r = await upd.check(); } catch (e) { return null; }   // offline: next time
        if (!r.newer || r.bad) return r;
        if (!r.quick) { appCard(r, appState || r.app); return r; }
        try { await fetchGame(r); } catch (e) { return r; }
        offer(r.latest.build);
        return r;
      },
      get staged() { return staged; },
    };
    return upd;
  }

  function start() {
    const B = window.rotnPC;
    if (!B) { window.addEventListener("load", () => setTimeout(checkOld, 6000)); return; }
    const upd = makeUpdater(B);
    window.__app = upd;
    if (window.__rotnTitleDrawn) upd.ready();   // ui.js calls __app.ready() when the title screen draws
    window.addEventListener("load", () => setTimeout(() => upd.auto(), 8000));
    setInterval(() => upd.auto(), 10 * 60000);
    let back = 0;   // back to the game window: look again (at most once a minute)
    document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - back > 60000) { back = Date.now(); upd.auto(); } });
  }
  if (typeof window !== "undefined" && typeof document !== "undefined" && typeof window.addEventListener === "function") start();
  return { buildOf, shouldShow, text, check: checkOld, makeUpdater };
})();
if (typeof module !== "undefined") module.exports = PCUPDATE;
