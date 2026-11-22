/* Android glue for Roads of the North: back button, saving when the app goes to the background, splash screen,
   phone notifications (arrival, dragon attacks) while the app is closed, and the in-app updater. */
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
    try { await LN.cancel({ notifications: [{ id: 1 }, { id: 2 }] }); } catch (e) { /* nothing scheduled */ }
  }
  async function scheduleAway() {
    if (!LN || !pref("notify", true)) return;
    try {
      if ((await LN.checkPermissions()).display !== "granted") return;
      await clearAll();
      const list = (window.__ui?.upcoming?.() || []).map((n) => ({ id: n.id, title: n.title, body: n.body, channelId: "road", schedule: { at: new Date(n.at), allowWhileIdle: true } }));
      if (list.length) await LN.schedule({ notifications: list });
    } catch (e) { /* never block going to the background */ }
  }

  // ------------------------------------------------------------ updates (GitHub releases of this repo)
  const cleanNotes = (body) => String(body || "").split(/\n-{3,}\s*\n/)[0]
    .split("\n").filter((l) => !/^(Co-Authored-By|Claude-Session):/i.test(l.trim())).join("\n").trim();
  let latestCache = null, waitingForPermission = false, staged = 0, stagedPath = "";
  const updater = {
    native: true,
    async current() {
      try { return await Updater.info(); } catch (e) { return { build: 0, version: "?", canInstall: false }; }
    },
    async latest(force = false) {
      if (latestCache && !force && Date.now() - latestCache.t < 10 * 60000) return latestCache.r;
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 404 ? "automatic updates switch on once the game's GitHub page is public" : `GitHub said ${res.status}`);
      const j = await res.json(), asset = (j.assets || []).find((a) => /\.apk$/i.test(a.name));
      const zip = (j.assets || []).map((a) => ({ a, m: /^game-shell(\d+)\.zip$/i.exec(a.name) })).find((x) => x.m);
      const build = parseInt(String(j.tag_name).replace(/\D+/g, ""), 10) || 0;
      if (!asset) throw new Error("The newest release has no app file");
      const r = { build, notes: cleanNotes(j.body), url: asset.browser_download_url, size: asset.size, date: j.published_at,
        game: zip ? { url: zip.a.browser_download_url, size: zip.a.size, shell: +zip.m[1] } : null };
      latestCache = { t: Date.now(), r };
      return r;
    },
    /* -> { current, latest, newer } */
    async check(force = false) {
      const [cur, lat] = await Promise.all([this.current(), this.latest(force)]);
      const quick = !!(lat.game && Updater?.downloadGame && cur.shell >= lat.game.shell);
      return { current: cur, latest: lat, newer: lat.build > (cur.build || 0), quick, size: quick ? lat.game.size : lat.size };
    },
    /* game-only update: download the game files in the background, then switch to them (now, or on next start) */
    async quickUpdate(lat, now, onStep = () => {}) {
      if (staged === lat.build) { await Updater.applyGame({ path: stagedPath, build: lat.build, now }); return "applied"; }
      onStep("Downloading…", 0);
      const sub = await Updater.addListener("progress", (p) => onStep(p.pct >= 0 ? `Downloading… ${p.pct}%` : "Downloading…", p.pct));
      let r;
      try { r = await Updater.downloadGame({ url: lat.game.url, size: lat.game.size, build: lat.build }); } finally { sub?.remove?.(); }
      staged = lat.build; stagedPath = r.path;
      if (now) { window.__ui?.save?.(); onStep("Restarting on the new version…", 100); }
      await Updater.applyGame({ path: r.path, build: lat.build, now });
      return "applied";
    },
    /* downloads then opens Android's installer. onStep(text, pct) reports progress. */
    async install(lat, onStep = () => {}) {
      if (!Updater) throw new Error("This build can't update itself. Install the newest one by hand once.");
      const cur = await this.current();
      if (lat.game && Updater.downloadGame && cur.shell >= lat.game.shell) {
        try { return await this.quickUpdate(lat, true, onStep); } catch (e) { onStep(`Quick update failed (${e.message}), using the full installer…`, 0); }
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

  async function autoCheck() {
    if (!pref("autoUpdate", true)) return;
    try {
      const r = await updater.check();
      if (!r.newer) return;
      if (r.quick) {
        if (staged === r.latest.build) return;
        // download quietly; it switches over the next time the game opens (or right away on the title screen)
        const onTitle = !!document.querySelector("#title") && !document.querySelector("#title input:focus");
        await updater.quickUpdate(r.latest, onTitle);
        if (!onTitle) window.__ui?.updateStaged?.(r);
        return;
      }
      window.__ui?.updateAvailable?.(r);
    } catch (e) { /* offline: try next launch */ }
  }

  App?.addListener("backButton", () => { if (!window.__ui?.back()) App.minimizeApp(); });
  App?.addListener("pause", () => { window.__ui?.save(); scheduleAway(); });
  App?.addListener("resume", () => {
    clearAll();
    document.dispatchEvent(new Event("visibilitychange"));
    if (waitingForPermission) { waitingForPermission = false; window.__ui?.permissionBack?.(); }
  });
  setTimeout(() => SplashScreen?.hide(), 400);
  setTimeout(askOnce, 2500);
  setTimeout(autoCheck, 4000);
  setTimeout(() => { try { Updater?.gameReady?.(); } catch (e) { /* older app */ } }, 5000);   // the game started fine on these files
  setInterval(autoCheck, 30 * 60000);
})();
