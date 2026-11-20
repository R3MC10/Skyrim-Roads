/* Android glue: back button, saving when the app goes to the background, splash screen,
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
  let latestCache = null, waitingForPermission = false;
  const updater = {
    native: true,
    async current() {
      try { return await Updater.info(); } catch (e) { return { build: 0, version: "?", canInstall: false }; }
    },
    async latest(force = false) {
      if (latestCache && !force && Date.now() - latestCache.t < 10 * 60000) return latestCache.r;
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 404 ? "No releases found yet" : `GitHub said ${res.status}`);
      const j = await res.json(), asset = (j.assets || []).find((a) => /\.apk$/i.test(a.name));
      const build = parseInt(String(j.tag_name).replace(/\D+/g, ""), 10) || 0;
      if (!asset) throw new Error("The newest release has no app file");
      const r = { build, notes: cleanNotes(j.body), url: asset.browser_download_url, size: asset.size, date: j.published_at };
      latestCache = { t: Date.now(), r };
      return r;
    },
    /* -> { current, latest, newer } */
    async check(force = false) {
      const [cur, lat] = await Promise.all([this.current(), this.latest(force)]);
      return { current: cur, latest: lat, newer: lat.build > (cur.build || 0) };
    },
    /* downloads then opens Android's installer. onStep(text, pct) reports progress. */
    async install(lat, onStep = () => {}) {
      if (!Updater) throw new Error("This build can't update itself. Install the newest one by hand once.");
      const cur = await this.current();
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
    try { const r = await updater.check(); if (r.newer) window.__ui?.updateAvailable?.(r); } catch (e) { /* offline: try next launch */ }
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
})();
