/* Roads of the North for Windows: the same game as the phone app in its own window.
   The game is served from app://game/ so saves (localStorage) stay put between updates.
   Esc works like the phone's back button (handled in the game, desktop.js). Closing the window is the only way out. */
const { app, BrowserWindow, protocol, net, shell } = require("electron");
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
  w.loadURL("app://game/index.html");
  return w;
}
app.whenReady().then(() => {
  protocol.handle("app", (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname), file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT)) return new Response("no", { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  let win = make();
  app.on("second-instance", () => { if (win.isMinimized()) win.restore(); win.focus(); });
  app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) win = make(); });
});
app.on("window-all-closed", () => app.quit());
