/* Roads of the North for Windows: the same game as the phone app in its own window.
   The game is served from app://game/ so saves (localStorage) stay put between updates.
   Esc works like the phone's back button and then opens the Esc menu (desktop.js, pausemenu.js); its Quit game closes this window (window.close).
   Updates (installed and portable alike): new game files download in the background (gameupdate.js) and the game
   switches to them at a quiet moment (pcupdate.js asks through preload.js); only a release that needs a newer app
   (a higher "rotnShell" in latest.json than this app's) downloads the whole installer (electron-updater). */
const { app, BrowserWindow, protocol, net, shell, ipcMain, session } = require("electron");
const path = require("path"), { pathToFileURL } = require("url");
const { createGameUpdater } = require("./gameupdate");
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
const BUNDLED = path.join(__dirname, "www");
const REPO = "R3MC10/Skyrim-Roads", RELEASES = `https://github.com/${REPO}/releases`;
const SHELL = +require("./package.json").rotnShell || 1;   // bump when the game needs something new from this file or preload.js
const KIND = process.env.PORTABLE_EXECUTABLE_DIR ? "portable" : "setup";
const BUILD = +(/^\d+\.\d+\.(\d+)/.exec(app.getVersion()) || [])[1] || 0;   // CI sets the version to 1.0.<build>
const UPDATES = app.isPackaged || process.env.ROTN_UPDATE_TEST === "1";
if (process.env.ROTN_USER_DATA) app.setPath("userData", process.env.ROTN_USER_DATA);   // tests: a separate save folder
if (!app.requestSingleInstanceLock()) app.quit();

const games = createGameUpdater({
  base: path.join(app.getPath("userData"), "game-updates"), bundledDir: BUNDLED, bundledBuild: BUILD, shell: SHELL, kind: KIND,
  manifestUrl: process.env.ROTN_MANIFEST || `${RELEASES}/latest/download/latest.json`, releases: process.env.ROTN_RELEASES || RELEASES,
  fetch: (u, o) => net.fetch(u, o),
});
let ROOT = BUNDLED, win = null, watchdog = null;

const pageUrl = () => `app://game/index.html?pc=${KIND}&v=1.0.${games.activeBuild()}`;
function make() {
  const w = new BrowserWindow({ width: 1280, height: 860, minWidth: 360, minHeight: 600, backgroundColor: "#0b0c0e", autoHideMenuBar: true,
    title: "Roads of the North", icon: path.join(__dirname, "icon.png"),
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, "preload.js") } });
  w.setMenu(null);
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  w.webContents.on("before-input-event", (e, inp) => { if (inp.type === "keyDown" && inp.key === "F11") { w.setFullScreen(!w.isFullScreen()); e.preventDefault(); } });
  // a new build that crashes or never reaches the title screen goes back to the one before
  w.webContents.on("render-process-gone", () => failed("the game stopped"));
  w.webContents.on("did-fail-load", (e, code, desc, url, main) => { if (main) failed("didn't load"); });
  // pcupdate.js needs the build and whether this copy can install a new app itself
  w.loadURL(pageUrl());
  armWatchdog();
  return w;
}
function armWatchdog() {
  clearTimeout(watchdog); watchdog = null;
  if (games.trying()) watchdog = setTimeout(() => failed("no title screen after 90 s"), 90000);
}
function failed(why) {
  if (!games.trying()) return;
  games.rollback(why);
  ROOT = games.root();
  reload();
}
async function reload() {
  try { await session.defaultSession.clearCache(); } catch (e) { /* fine */ }
  if (win && !win.isDestroyed()) { win.loadURL(pageUrl()); armWatchdog(); }
}

app.whenReady().then(() => {
  if (UPDATES) { try { ROOT = games.boot().root; } catch (e) { ROOT = BUNDLED; } }
  protocol.handle("app", (req) => {
    const base = ROOT, p = decodeURIComponent(new URL(req.url).pathname), file = path.normalize(path.join(base, p));
    if (!file.startsWith(base)) return new Response("no", { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  ipcSetup();
  win = make();
  app.on("second-instance", () => { if (win.isMinimized()) win.restore(); win.focus(); });
  app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) win = make(); });
});
app.on("window-all-closed", () => app.quit());

/* ---------- what the game can ask (preload.js) ---------- */
const send = (ch, v) => { try { if (win && !win.isDestroyed()) win.webContents.send(ch, v); } catch (e) { /* closing */ } };
let appUpd = { state: "none", pct: 0, build: 0, error: "" };   // the whole-app update (installer): none | checking | downloading | ready | error
function ipcSetup() {
  ipcMain.handle("rotn:info", () => ({ ...games.info(), updates: UPDATES, app: appUpd, version: app.getVersion() }));
  ipcMain.handle("rotn:check", async () => {
    if (!UPDATES) throw new Error("updates are off in this copy");
    try {
      const r = await games.check();
      if (r.newer && !r.quick) appUpdate(r.latest.build);   // this build needs a newer app
      return { ...r, app: appUpd };
    } catch (e) {
      // releases before latest.json: only the installer knows about them
      if (/latest\.json: 404/.test(String(e?.message))) appUpdate(0);
      throw e;
    }
  });
  ipcMain.handle("rotn:download", (ev) => games.download((pct, text) => send("rotn:progress", { pct, text })));
  ipcMain.handle("rotn:apply", async () => {
    if (!games.apply()) return false;
    ROOT = games.root();
    setTimeout(reload, 50);
    return true;
  });
  ipcMain.handle("rotn:ready", () => { const ok = games.ready(); clearTimeout(watchdog); watchdog = null; return ok; });
  ipcMain.handle("rotn:page", () => shell.openExternal(`${RELEASES}/latest`));
  ipcMain.handle("rotn:installApp", () => {
    if (appUpd.state !== "ready" || !updater) return false;
    setImmediate(() => updater.quitAndInstall(true, true));
    return true;
  });
}

/* ---------- the whole app (installer), only when the game needs a newer app ---------- */
let updater = null;
function appUpdate(build) {
  if (KIND === "portable" || !app.isPackaged) { appUpd = { ...appUpd, state: "manual", build }; send("rotn:app", appUpd); return; }   // portable: the game shows a download link
  if (["checking", "downloading", "ready"].includes(appUpd.state) && appUpd.build === build) return;
  if (!updater) {
    try { updater = require("electron-updater").autoUpdater; } catch (e) { return; }
    updater.autoDownload = true; updater.autoInstallOnAppQuit = true;
    // the setup file's name has no version in it, so electron-updater's small-download trick would compare the new
    // file with itself and download everything twice: always fetch it whole
    updater.disableDifferentialDownload = true;
    updater.on("download-progress", (p) => { appUpd = { ...appUpd, state: "downloading", pct: Math.floor(p.percent || 0) }; send("rotn:app", appUpd); });
    updater.on("update-downloaded", (info) => { appUpd = { ...appUpd, state: "ready", pct: 100, build: +String(info?.version || "").split(".").pop() || appUpd.build }; send("rotn:app", appUpd); });
    updater.on("update-not-available", () => { appUpd = { ...appUpd, state: "none" }; });
    updater.on("error", (e) => { appUpd = { ...appUpd, state: "error", error: String(e?.message || e).slice(0, 200) }; send("rotn:app", appUpd); });
  }
  // the same release as latest.json (the "latest" link can move to a newer release in the middle of a download)
  updater.setFeedURL({ provider: "generic", url: build ? `${RELEASES}/download/build-${build}` : `${RELEASES}/latest/download` });
  appUpd = { state: "checking", pct: 0, build, error: "" };
  updater.checkForUpdates().catch(() => {});
}
// quitting with a new app downloaded installs it by itself (autoInstallOnAppQuit)
app.on("before-quit", () => { clearTimeout(watchdog); });
