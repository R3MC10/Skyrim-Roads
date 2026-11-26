/* Android glue for Roads of the North: back button, saving when the app goes to the background, splash screen,
   phone notifications (arrival, dragon attacks) while the app is closed, invite notifications with Accept / Decline,
   and the in-app updater. */
(() => {
  const C = window.Capacitor;
  if (!C?.isNativePlatform?.()) return;
  const { App, SplashScreen, LocalNotifications: LN, Updater } = C.Plugins;
  const REPO = "R3MC10/Skyrim-Roads";
  const pref = (k, d) => { try { const v = JSON.parse(localStorage.getItem("rotn_prefs") || "{}")[k]; return v === undefined ? d : v; } catch (e) { return d; } };

  // ------------------------------------------------------------ notifications
  async function askOnce() {
    if (!LN) return;
    try {
      const p = await LN.checkPermissions();
      if (p.display === "prompt" || p.display === "prompt-with-rationale") await LN.requestPermissions();
      await LN.createChannel?.({ id: "road", name: "Travel and dragons", description: "When you arrive somewhere, or a dragon attacks a town", importance: 4, visibility: 1 });
    } catch (e) { /* notifications are optional */ }
  }
  async function clearAll() {
    if (!LN) return;
    try { const ids = [1, 2, ...(typeof REMIND !== "undefined" ? REMIND.NOTE_IDS : [])]; await LN.cancel({ notifications: ids.map((id) => ({ id })) }); } catch (e) { /* nothing scheduled */ }
  }
  async function scheduleAway() {
    if (!LN || !pref("notify", true)) return;
    try {
      if ((await LN.checkPermissions()).display !== "granted") return;
      await clearAll();
      const plain = (t) => String(t || "").replace(/[-]\s?/g, "");   // game icons only exist in the game's font
      const list = (window.__ui?.upcoming?.() || []).map((n) => ({ id: n.id, title: plain(n.title), body: plain(n.body), channelId: "road", schedule: { at: new Date(n.at), allowWhileIdle: true } }));
      if (list.length) await LN.schedule({ notifications: list });
    } catch (e) { /* never block going to the background */ }
  }

  // ------------------------------------------------------------ invites: Accept / Decline right on the notification
  /* invites.js calls window.ROTN_NATIVE.invite() when an invite arrives while the app is in the background (the game
     keeps its connection for a while there). The buttons open the game and answer it through INVITES.answer(). */
  const inviteShown = new Set();
  let pendingAnswer = null;
  const IV = () => (typeof INVITES !== "undefined" ? INVITES : null);
  const pl = () => typeof I18N !== "undefined" && I18N.lang() === "pl";
  const trPl = (t) => (pl() ? I18N.tr(t) ?? t : t);
  async function setupInvites() {
    if (!LN) return;
    try {
      await LN.createChannel?.({ id: "invites", name: pl() ? "Zaproszenia" : "Invites", description: pl() ? "Drużyna, wyprawy, klan, Arena i wymiany" : "Party, dungeon, clan, Arena and trade invites", importance: 4, visibility: 1 });
      await LN.registerActionTypes?.({ types: [{ id: "invite", actions: [{ id: "accept", title: pl() ? "Przyjmij" : "Accept", foreground: true }, { id: "decline", title: pl() ? "Odrzuć" : "Decline", foreground: true }] }] });
      await LN.addListener?.("localNotificationActionPerformed", (a) => {
        const key = a?.notification?.extra?.inviteKey;
        if (!key) return;
        const yes = a.actionId === "accept", no = a.actionId === "decline";
        pendingAnswer = { key, yes, open: !yes && !no, tries: 0 };
        answerPending();
      });
    } catch (e) { /* older plugin: plain notifications only */ }
  }
  /* the game may still be starting (cold start from the notification): wait until it knows the invite */
  function answerPending() {
    const p = pendingAnswer, I = IV();
    if (!p) return;
    if (I && I.has(p.key)) { pendingAnswer = null; if (p.open) I.open(); else I.answer(p.key, p.yes); return; }
    if (++p.tries > 25) { pendingAnswer = null; if (I) I.open(); return; }   // gone (or never synced): show the invites list
    setTimeout(answerPending, 1200);
  }
  window.ROTN_NATIVE = {
    bg: false,   // the app is in the background (set on pause / resume below)
    async invite(n) {
      if (!LN || !pref("notify", true) || !n) return;
      try {
        if ((await LN.checkPermissions()).display !== "granted") return;
        inviteShown.add(n.id);
        await LN.schedule({ notifications: [{ id: n.id, title: trPl(n.title), body: trPl(n.body), channelId: "invites", actionTypeId: "invite", extra: { inviteKey: n.key }, autoCancel: true }] });
      } catch (e) { /* notifications are optional */ }
    },
    cancelInvite(id) { if (!LN || !inviteShown.has(id)) return; inviteShown.delete(id); LN.cancel({ notifications: [{ id }] }).catch(() => {}); },
    clearInvites() { for (const id of [...inviteShown]) this.cancelInvite(id); },
  };

  // ------------------------------------------------------------ updates (GitHub releases of this repo)
  /* Game-only updates (new game files, same app) never need Android's installer: a small patch first, the whole
     game zip if that fails, and if that fails too it simply tries again later. The installer is only for a release
     that needs a newer app (its shell number is higher than this app's), or an app too old to update itself.
     Each release has a small latest.json (build, shell, file names, sizes and SHA-256 checksums); newer apps check
     the checksum before unpacking. Older apps ignore the extra fields, so this file works with both. */
  const DL = `https://github.com/${REPO}/releases`;
  const MANIFEST = `${DL}/latest/download/latest.json`;   // a plain download: no GitHub API rate limit
  const cleanNotes = (body) => String(body || "").split(/\n-{3,}\s*\n/)[0]
    .split("\n").filter((l) => !/^(Co-Authored-By|Claude-Session):/i.test(l.trim())).join("\n").trim();
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const SAFE = /^[\w.-]+$/, HEX = /^[0-9a-f]{64}$/i;
  let latestCache = null, waitingForPermission = false, staged = 0, stagedPath = "", lastFail = "", running = null, readyDone = false;

  /* latest.json -> { build, notes, url, size, date, game: { url, size, sha256, shell, deltas: { from: {url,size,sha256} } } } */
  function parseManifest(j) {
    const build = Math.floor(+j?.build) || 0;
    if (build <= 0 || !j.apk || !SAFE.test(j.apk.name || "")) throw new Error("latest.json looks wrong");
    const base = `${DL}/download/build-${build}/`;
    const file = (f) => (f && SAFE.test(f.name || "") ? { url: base + f.name, size: +f.size || 0, sha256: HEX.test(f.sha256 || "") ? f.sha256.toLowerCase() : "" } : null);
    const g = file(j.game), deltas = {}, apk = file(j.apk);
    for (const [from, f] of Object.entries(j.deltas || {})) { const d = file(f); if (d && +from > 0) deltas[+from] = d; }
    return { build, notes: cleanNotes(j.notes), url: apk.url, size: apk.size, date: j.date || null,
      game: g ? { ...g, shell: Math.floor(+j.shell) || 0, deltas } : null, source: "manifest" };
  }
  /* the GitHub API's view of the latest release -> the same shape (no checksums) */
  function parseApi(j) {
    const asset = (j.assets || []).find((a) => /\.apk$/i.test(a.name));
    const zip = (j.assets || []).map((a) => ({ a, m: /^game-shell(\d+)\.zip$/i.exec(a.name) })).find((x) => x.m);
    const build = parseInt(String(j.tag_name).replace(/\D+/g, ""), 10) || 0;
    // small patches: game-shellS-fromN.zip holds only what changed since build N
    const deltas = {};
    for (const a of j.assets || []) { const m = /^game-shell(\d+)-from(\d+)\.zip$/i.exec(a.name); if (m && zip && +m[1] === +zip.m[1]) deltas[+m[2]] = { url: a.browser_download_url, size: a.size, sha256: "" }; }
    if (!asset) throw new Error("The newest release has no app file");
    return { build, notes: cleanNotes(j.body), url: asset.browser_download_url, size: asset.size, date: j.published_at,
      game: zip ? { url: zip.a.browser_download_url, size: zip.a.size, sha256: "", shell: +zip.m[1], deltas } : null, source: "api" };
  }
  /* newer apps read it natively (github.com sends no CORS headers); older ones try the WebView's fetch */
  async function readManifest() {
    let text = null;
    if (Updater?.getText) { try { text = (await Updater.getText({ url: MANIFEST })).text; } catch (e) { text = null; } }
    if (text == null) {
      const res = await fetch(MANIFEST, { cache: "no-store" });
      if (!res.ok) throw new Error(`latest.json: ${res.status}`);
      text = await res.text();
    }
    return parseManifest(JSON.parse(text));
  }
  /* builds that failed to start on this phone: the app's own list (newer apps) plus what the game noticed itself */
  const badBuilds = (cur) => {
    const s = new Set(store.get("rotn_upd_bad", []).map(Number));
    for (const b of String(cur?.bad || "").split(",")) if (+b > 0) s.add(+b);
    return s;
  };
  /* on start: we switched to build `try` but are on older files now, so the app went back: that build is bad */
  function noteStart(cur) {
    const t = +store.get("rotn_upd_try", 0) || 0;
    if (!t || !cur?.build) return;
    if (cur.build < t) { const b = store.get("rotn_upd_bad", []).filter((x) => x !== t); b.push(t); store.set("rotn_upd_bad", b.slice(-10)); store.set("rotn_upd_try", 0); }
    else if (cur.build > t) store.set("rotn_upd_try", 0);
  }
  function markTry(build, now) {
    store.set("rotn_upd_try", build);
    if (!now) try { sessionStorage.setItem("rotn_upd_pending", "1"); } catch (e) { /* ignore */ }
  }
  const opt = (k, v) => (v ? { [k]: v } : {});

  const updater = {
    native: true,
    parseManifest, parseApi,
    async current() {
      try { return await Updater.info(); } catch (e) { return { build: 0, version: "?", canInstall: false }; }
    },
    /* plain words for the update screen: can this app update itself without the installer? */
    async how() {
      const c = await this.current();
      if (!Updater?.downloadGame || !c.shell) return `App build ${c.apkBuild || c.build}: this older app still needs the installer. Install the newest app once; after that it updates itself.`;
      return `App build ${c.apkBuild || c.build}, game build ${c.build}: updates download by themselves, no installer.${c.delta ? " Only the files that changed get downloaded." : " Install the newest app once more to get much smaller updates (only what changed)."}${lastFail ? ` The last download didn't work (${lastFail}); it tries again by itself.` : ""}`;
    },
    async latest(force = false) {
      if (latestCache && !force && Date.now() - latestCache.t < 10 * 60000) return latestCache.r;
      let r = null;
      try { r = await readManifest(); } catch (e) { r = null; }   // older releases have no latest.json: ask the API
      if (!r) {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
        if (!res.ok) throw new Error(res.status === 404 ? "automatic updates switch on once the game's GitHub page is public" : `GitHub said ${res.status}`);
        r = parseApi(await res.json());
      }
      latestCache = { t: Date.now(), r };
      return r;
    },
    /* new game files this app can take without the installer */
    gameOnly(cur, lat) {
      return !!(lat?.game && Updater?.downloadGame && (cur?.shell || 0) >= lat.game.shell);
    },
    /* -> { current, latest, newer, quick, size, bad } */
    async check(force = false) {
      const [cur, lat] = await Promise.all([this.current(), this.latest(force)]);
      const quick = this.gameOnly(cur, lat);
      const patch = quick ? this.patchFor(cur, lat) : null;
      return { current: cur, latest: lat, newer: lat.build > (cur.build || 0), quick, size: patch ? patch.size : quick ? lat.game.size : lat.size, bad: badBuilds(cur).has(lat.build) };
    },
    /* the small patch from the build this phone is on, if the release has one and the app can apply it */
    patchFor(cur, lat) {
      return (cur?.delta && Updater?.patchGame && lat.game?.deltas?.[cur.build]) || null;
    },
    /* patch, else the whole game (twice if the first copy arrived damaged). Resolves { path }. */
    async fetchGame(lat, onStep) {
      onStep("Downloading…", 0);
      const sub = await Updater.addListener("progress", (p) => onStep(p.pct >= 0 ? `Downloading… ${p.pct}%` : "Downloading…", p.pct));
      try {
        const cur = await this.current(), patch = this.patchFor(cur, lat);
        if (patch) {   // only the files that changed; anything off and it downloads the whole game instead
          try { return await Updater.patchGame({ url: patch.url, size: patch.size, build: lat.build, from: cur.build, ...opt("sha256", patch.sha256) }); }
          catch (e) { onStep("Downloading the full game…", 0); }
        }
        const full = { url: lat.game.url, size: lat.game.size, build: lat.build, ...opt("sha256", lat.game.sha256) };
        try { return await Updater.downloadGame(full); }
        catch (e) {
          if (!/damaged|cut short|checksum/i.test(String(e?.message || e))) throw e;
          onStep("Downloading the full game again…", 0);
          return await Updater.downloadGame(full);
        }
      } finally { sub?.remove?.(); }
    },
    /* game-only update: download the game files in the background, then switch to them now (now = true), or stage them
       for the app's next start: the "Update ready" card and the title screen switch over sooner (autoCheck below) */
    async quickUpdate(lat, now, onStep = () => {}) {
      if (running) await running.catch(() => {});   // a download is already going (say, in the background): use it
      if (staged !== lat.build) {
        running = this.fetchGame(lat, onStep);
        let r;
        try { r = await running; } finally { running = null; }
        staged = lat.build; stagedPath = r.path;
      }
      lastFail = "";
      if (now) { window.__ui?.save?.(); onStep("Restarting on the new version…", 100); }
      markTry(lat.build, now);
      await Updater.applyGame({ path: stagedPath, build: lat.build, now });
      return "applied";
    },
    /* "Update now": game-only updates never open the installer; it's only for a release that needs a newer app.
       onStep(text, pct) reports progress. */
    async install(lat, onStep = () => {}) {
      if (!Updater) throw new Error("This build can't update itself. Install the newest one by hand once.");
      const cur = await this.current();
      if (this.gameOnly(cur, lat)) {
        try { return await this.quickUpdate(lat, true, onStep); }
        catch (e) {
          lastFail = String(e?.message || e);
          // apps up to build 189 misread the build number and refuse every game-only update with this message:
          // install the newest app instead (that one has the fix), so nobody is stuck on an old build
          if (!/Not an update address/i.test(lastFail)) throw new Error(`couldn't download it right now (${lastFail}). Nothing changed, and the game tries again by itself in a few minutes`);
          onStep("This app needs a one-time reinstall to update. Getting the newest app…", 0);
        }
      }
      if (!cur.canInstall) {
        waitingForPermission = true;
        onStep("Allow “Install unknown apps” for Roads of the North, then come back.", -1);
        await Updater.openInstallSettings();
        return "permission";
      }
      onStep("Downloading…", 0);
      const sub = await Updater.addListener("progress", (p) => onStep(p.pct >= 0 ? `Downloading… ${p.pct}%` : "Downloading…", p.pct));
      try { await Updater.download({ url: lat.url, size: lat.size }); } finally { sub?.remove?.(); }
      window.__ui?.save?.();
      onStep("Opening the installer…", 100);
      await Updater.install();
      return "installer";
    },
    /* the title screen has drawn on these files: they work. Tells the app (so it stops counting failed starts and
       keeps these files to fall back on), unless new files are waiting for the next start: then these aren't them. */
    ready() {
      if (readyDone) return; readyDone = true;
      let pending = false;
      try { pending = sessionStorage.getItem("rotn_upd_pending") === "1"; } catch (e) { pending = false; }
      if (pending) return;
      try { Updater?.gameReady?.()?.catch?.(() => {}); } catch (e) { /* older app */ }
      this.current().then((c) => { const t = +store.get("rotn_upd_try", 0) || 0; if (t && c.build >= t) store.set("rotn_upd_try", 0); }).catch(() => {});
    },
    noteStart,
  };
  window.__app = updater;

  /* everyone plays the same build: new game files download in the background as soon as a release is out. On the
     title screen the game switches over at once; during play a small "Update ready" card offers Restart now (never mid
     fight or dungeon: samever.js asks the game) and it switches by itself once back on the title screen, or when the app
     comes back from the background at a quiet moment. Progress is saved first. */
  const onTitleNow = () => !!document.querySelector("#title") && !document.querySelector("#title input:focus");
  const quiet = () => { try { return !!window.__ui?.safeToUpdate?.(); } catch (e) { return false; } };
  let titleTimer = null;
  function offerStaged(r) {
    const go = () => updater.quickUpdate(r.latest, true);
    window.__ui?.updateStaged?.(r, go);   // the "Update ready" card + the Updates page (ui.js -> samever.js)
    clearInterval(titleTimer);
    titleTimer = setInterval(async () => {
      if (!onTitleNow() || !quiet()) return;
      clearInterval(titleTimer); titleTimer = null;
      try { await go(); } catch (e) { /* try again on the next check */ }
    }, 15000);
  }
  const dlStep = (b) => (txt, pct) => { try { window.__ui?.updateProgress?.(b, pct); } catch (e) { /* older game files */ } };
  async function autoCheck(back = false) {
    try {
      const r = await updater.check(true);
      if (!r.newer || r.bad) return;   // a build that already failed to start here isn't pushed again (Update now still can)
      if (r.quick) {
        const now = onTitleNow() || (back && quiet());   // the title screen, or just back from the background with nothing going on
        if (staged === r.latest.build) { if (now) await updater.quickUpdate(r.latest, true); else offerStaged(r); return; }
        await updater.quickUpdate(r.latest, now, dlStep(r.latest.build));
        if (!now) offerStaged(r);
        return;
      }
      window.__ui?.updateAvailable?.(r);
    } catch (e) { if (e?.message) lastFail = String(e.message); try { window.__ui?.updateProgress?.(0, -1, lastFail); } catch (x) { /* older game files */ } /* offline or a bad download: try again on the next check */ }
  }
  updater.auto = autoCheck;

  App?.addListener("backButton", () => { if (!window.__ui?.back()) App.minimizeApp(); });
  App?.addListener("pause", () => { window.ROTN_NATIVE.bg = true; window.__ui?.save(); scheduleAway(); });
  App?.addListener("resume", () => {
    window.ROTN_NATIVE.bg = false;
    clearAll();
    document.dispatchEvent(new Event("visibilitychange"));
    if (waitingForPermission) { waitingForPermission = false; window.__ui?.permissionBack?.(); }
    setTimeout(() => autoCheck(true), 3000);   // back in the game: look for a new version (and switch to one already here)
  });
  setTimeout(() => SplashScreen?.hide(), 400);
  setTimeout(askOnce, 2500);
  setupInvites();
  /* on launch: look for a new version straight away and, if there is one, install it before the player gets going.
     A small "Updating…" card covers the title screen meanwhile; offline or slow, it gives up after a few seconds. */
  async function launchUpdate() {
    try { noteStart(await updater.current()); } catch (e) { /* older app */ }
    if (!Updater?.downloadGame) return autoCheck();
    const card = document.createElement("div");
    card.id = "launchupd";
    card.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(8,8,8,.82);color:#f3d98b;font:600 16px/1.4 sans-serif;text-align:center;padding:24px";
    card.textContent = "Checking for updates…";
    let shown = false; const show = () => { if (!shown) { shown = true; document.body.appendChild(card); } };
    const t = setTimeout(show, 600);   // a quick "no update" never flashes the card
    try {
      const r = await Promise.race([updater.check(true), new Promise((_, no) => setTimeout(() => no(new Error("slow")), 6000))]);
      if (r.newer && r.quick && !r.bad) {
        show();
        await updater.quickUpdate(r.latest, true, (txt) => { card.textContent = `Updating to build ${r.latest.build}… ${txt}`; });
        return;   // the game restarts on the new files
      }
      if (r.newer && !r.bad) window.__ui?.updateAvailable?.(r);
    } catch (e) { /* offline, slow or a bad download: the regular checks will catch it */ }
    finally { clearTimeout(t); card.remove(); }
  }
  setTimeout(launchUpdate, 300);
  // the game calls __app.ready() once its title screen has drawn (ui.js): only then do these files count as working
  if (window.__rotnTitleDrawn) updater.ready();
  setInterval(() => autoCheck(), 10 * 60000);
})();
