/* Roads of the North for Windows: the same game as the phone app in its own window.
   The game is served from app://game/ so saves (localStorage) stay put between updates.
   Esc works like the phone's back button (handled in the game, desktop.js). Closing the window is the only way out. */
const { app, BrowserWindow, protocol, net, shell, dialog } = require("electron");
const path = require("path"), { pathToFileURL } = require("url");
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
const ROOT = path.join(__dirname, "www");
if (!app.requestSingleInstanceLock()) app.quit();
function make() {
  const w = new BrowserWindow({ width: 1280, height: 860, minWidth: 360, minHeight: 600, backgroundColor: "#0b0c0e", autoHideMenuBar: true,
    title: "Roads of the North", webPreferences: { contextIsolation: true, sandbox: true } });
  w.setMenu(null);
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  w.webContents.on("before-input-event", (e, inp) => { if (inp.type === "keyDown" && inp.key === "F11") { w.setFullScreen(!w.isFullScreen()); e.preventDefault(); } });
  // the game shows its own "new version" card on PC (pcupdate.js): it needs to know the build and whether this copy can update itself
  w.loadURL(`app://game/index.html?pc=${process.env.PORTABLE_EXECUTABLE_DIR ? "portable" : "setup"}&v=${encodeURIComponent(app.getVersion())}`);
  return w;
}
app.whenReady().then(() => {
  protocol.handle("app", (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname), file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT)) return new Response("no", { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  let win = make();
  startUpdates(() => win);
  app.on("second-instance", () => { if (win.isMinimized()) win.restore(); win.focus(); });
  app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) win = make(); });
});
app.on("window-all-closed", () => app.quit());

/* Updates: the installed version checks the newest GitHub release (latest.yml next to the setup file) when it starts
   and every hour, downloads a newer build quietly, and installs it when the game closes (or right away if the player
   says so). The portable .exe can't update itself; any network trouble is ignored and the game just plays on. */
let updateAsked = false;
function startUpdates(getWin) {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return;
  let up;
  try { up = require("electron-updater").autoUpdater; } catch (e) { return; }
  up.autoDownload = true; up.autoInstallOnAppQuit = true;
  up.on("error", () => { /* offline or no update file yet: try again later */ });
  up.on("update-downloaded", (info) => {
    if (updateAsked) return;
    updateAsked = true;
    const w = getWin(), build = String(info?.version || "").split(".").pop();
    dialog.showMessageBox(w && !w.isDestroyed() ? w : undefined, {
      type: "info", title: "Roads of the North", buttons: ["Restart now", "Later"], defaultId: 0, cancelId: 1,
      message: `A new version${build ? " (build " + build + ")" : ""} is ready.`,
      detail: "Restart now to play it, or keep playing: it installs by itself when you close the game.",
    }).then((r) => { if (r.response === 0) setImmediate(() => up.quitAndInstall(true, true)); }).catch(() => {});
  });
  const check = () => up.checkForUpdates().catch(() => {});
  setTimeout(check, 8000);
  setInterval(check, 60 * 60 * 1000);
}
