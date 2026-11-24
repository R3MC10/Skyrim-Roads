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
  const cleanNotes = (body) => String(body || "").split(/\n-{3,}\s*\n/)[0]
    .split("\n").filter((l) => !/^(Co-Authored-By|Claude-Session):/i.test(l.trim())).join("\n").trim();
  let latestCache = null, waitingForPermission = false, staged = 0, stagedPath = "", quickFailed = "";
  const updater = {
    native: true,
    async current() {
      try { return await Updater.info(); } catch (e) { return { build: 0, version: "?", canInstall: false }; }
    },
    /* plain words for the update screen: can this app update itself without the installer? */
    async how() {
      const c = await this.current();
      if (!Updater?.downloadGame || !c.shell) return `App build ${c.apkBuild || c.build}: this older app still needs the installer. Install the newest app once; after that it updates itself.`;
      return `App build ${c.apkBuild || c.build}, game build ${c.build}: updates download by themselves, no installer.${c.delta ? " Only the files that changed get downloaded." : " Install the newest app once more to get much smaller updates (only what changed)."}${quickFailed ? ` Last quick update failed: ${quickFailed}` : ""}`;
    },
    async latest(force = false) {
      if (latestCache && !force && Date.now() - latestCache.t < 10 * 60000) return latestCache.r;
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 404 ? "automatic updates switch on once the game's GitHub page is public" : `GitHub said ${res.status}`);
      const j = await res.json(), asset = (j.assets || []).find((a) => /\.apk$/i.test(a.name));
      const zip = (j.assets || []).map((a) => ({ a, m: /^game-shell(\d+)\.zip$/i.exec(a.name) })).find((x) => x.m);
      const build = parseInt(String(j.tag_name).replace(/\D+/g, ""), 10) || 0;
      // small patches: game-shellS-fromN.zip holds only what changed since build N
      const deltas = {};
      for (const a of j.assets || []) { const m = /^game-shell(\d+)-from(\d+)\.zip$/i.exec(a.name); if (m && zip && +m[1] === +zip.m[1]) deltas[+m[2]] = { url: a.browser_download_url, size: a.size }; }
      if (!asset) throw new Error("The newest release has no app file");
      const r = { build, notes: cleanNotes(j.body), url: asset.browser_download_url, size: asset.size, date: j.published_at,
        game: zip ? { url: zip.a.browser_download_url, size: zip.a.size, shell: +zip.m[1], deltas } : null };
      latestCache = { t: Date.now(), r };
      return r;
    },
    /* -> { current, latest, newer } */
    async check(force = false) {
      const [cur, lat] = await Promise.all([this.current(), this.latest(force)]);
      const quick = !!(lat.game && Updater?.downloadGame && cur.shell >= lat.game.shell);
      const patch = quick ? this.patchFor(cur, lat) : null;
      return { current: cur, latest: lat, newer: lat.build > (cur.build || 0), quick, size: patch ? patch.size : quick ? lat.game.size : lat.size };
    },
    /* the small patch from the build this phone is on, if the release has one and the app can apply it */
    patchFor(cur, lat) {
      return (cur?.delta && Updater?.patchGame && lat.game?.deltas?.[cur.build]) || null;
    },
    /* game-only update: download the game files in the background, then switch to them (now, or on next start) */
    async quickUpdate(lat, now, onStep = () => {}) {
      if (staged === lat.build) { await Updater.applyGame({ path: stagedPath, build: lat.build, now }); return "applied"; }
      onStep("Downloading…", 0);
      const sub = await Updater.addListener("progress", (p) => onStep(p.pct >= 0 ? `Downloading… ${p.pct}%` : "Downloading…", p.pct));
      let r;
      try {
        const cur = await this.current(), patch = this.patchFor(cur, lat);
        if (patch) {   // only the files that changed; anything off and it downloads the whole game instead
          try { r = await Updater.patchGame({ url: patch.url, size: patch.size, build: lat.build, from: cur.build }); }
          catch (e) { r = null; onStep("Downloading the full game…", 0); }
        }
        if (!r) r = await Updater.downloadGame({ url: lat.game.url, size: lat.game.size, build: lat.build });
      } finally { sub?.remove?.(); }
      staged = lat.build; stagedPath = r.path;
      if (now) { window.__ui?.save?.(); onStep("Restarting on the new version…", 100); }
      await Updater.applyGame({ path: r.path, build: lat.build, now });
      return "applied";
    },
    /* downloads then opens Android's installer. onStep(text, pct) reports progress. */
    async install(lat, onStep = () => {}) {
      if (!Updater) throw new Error("This build can't update itself. Install the newest one by hand once.");
      const cur = await this.current();
      if (lat.game && Updater.downloadGame && cur.shell >= lat.game.shell && !quickFailed) {
        try { return await this.quickUpdate(lat, true, onStep); }
        catch (e) { quickFailed = String(e?.message || e); throw new Error(`quick update failed: ${quickFailed}. Tap Update now again to install the full app instead`); }
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
  };
  window.__app = updater;

  /* updates are forced: once the new game files are downloaded, switch over at the first safe moment
     (the game says when: not mid-fight, dungeon, trade, menu or typing). Progress is saved first. */
  let forceTimer = null;
  function applyWhenSafe(r) {
    clearInterval(forceTimer);
    const tryNow = async () => {
      let safe = false;
      try { safe = !!window.__ui?.safeToUpdate?.(); } catch (e) { safe = false; }
      if (!safe) return;
      clearInterval(forceTimer); forceTimer = null;
      try { window.__ui?.save?.(); } catch (e) { /* nothing to save yet */ }
      try { await updater.quickUpdate(r.latest, true); } catch (e) { /* try again on the next check */ }
    };
    forceTimer = setInterval(tryNow, 15000);
    tryNow();
  }
  async function autoCheck() {
    try {
      const r = await updater.check();
      if (!r.newer) return;
      if (r.quick) {
        if (staged === r.latest.build) { if (!forceTimer) applyWhenSafe(r); return; }
        // download quietly; it switches over the next time the game opens (or right away on the title screen)
        const onTitle = !!document.querySelector("#title") && !document.querySelector("#title input:focus");
        await updater.quickUpdate(r.latest, onTitle);
        if (!onTitle) { window.__ui?.updateStaged?.(r); applyWhenSafe(r); }
        return;
      }
      window.__ui?.updateAvailable?.(r);
    } catch (e) { /* offline: try next launch */ }
  }

  App?.addListener("backButton", () => { if (!window.__ui?.back()) App.minimizeApp(); });
  App?.addListener("pause", () => { window.ROTN_NATIVE.bg = true; window.__ui?.save(); scheduleAway(); });
  App?.addListener("resume", () => {
    window.ROTN_NATIVE.bg = false;
    clearAll();
    document.dispatchEvent(new Event("visibilitychange"));
    if (waitingForPermission) { waitingForPermission = false; window.__ui?.permissionBack?.(); }
    setTimeout(autoCheck, 3000);   // back in the game: look for a new version
  });
  setTimeout(() => SplashScreen?.hide(), 400);
  setTimeout(askOnce, 2500);
  setupInvites();
  /* on launch: look for a new version straight away and, if there is one, install it before the player gets going.
     A small "Updating…" card covers the title screen meanwhile; offline or slow, it gives up after a few seconds. */
  async function launchUpdate() {
    if (!Updater?.downloadGame) return autoCheck();
    const card = document.createElement("div");
    card.id = "launchupd";
    card.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(8,8,8,.82);color:#f3d98b;font:600 16px/1.4 sans-serif;text-align:center;padding:24px";
    card.textContent = "Checking for updates…";
    let shown = false; const show = () => { if (!shown) { shown = true; document.body.appendChild(card); } };
    const t = setTimeout(show, 600);   // a quick "no update" never flashes the card
    try {
      const r = await Promise.race([updater.check(true), new Promise((_, no) => setTimeout(() => no(new Error("slow")), 6000))]);
      if (r.newer && r.quick) {
        show();
        await updater.quickUpdate(r.latest, true, (txt) => { card.textContent = `Updating to build ${r.latest.build}… ${txt}`; });
        return;   // the game restarts on the new files
      }
      if (r.newer) window.__ui?.updateAvailable?.(r);
    } catch (e) { /* offline or slow: the regular checks will catch it */ }
    finally { clearTimeout(t); card.remove(); }
  }
  setTimeout(launchUpdate, 300);
  setTimeout(() => { try { Updater?.gameReady?.(); } catch (e) { /* older app */ } }, 5000);   // the game started fine on these files
  setInterval(autoCheck, 10 * 60000);
})();
