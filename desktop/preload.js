/* preload.js: the few things the game (pcupdate.js) may ask the Windows app about updates. Nothing else gets through. */
const { contextBridge, ipcRenderer } = require("electron");
const on = (ch) => (cb) => { const f = (e, v) => { try { cb(v); } catch (x) { /* the game's problem */ } }; ipcRenderer.on(ch, f); return () => ipcRenderer.removeListener(ch, f); };
contextBridge.exposeInMainWorld("rotnPC", {
  info: () => ipcRenderer.invoke("rotn:info"),
  check: () => ipcRenderer.invoke("rotn:check"),
  download: () => ipcRenderer.invoke("rotn:download"),
  apply: () => ipcRenderer.invoke("rotn:apply"),
  ready: () => ipcRenderer.invoke("rotn:ready"),
  openPage: () => ipcRenderer.invoke("rotn:page"),
  installApp: () => ipcRenderer.invoke("rotn:installApp"),
  onProgress: on("rotn:progress"),
  onApp: on("rotn:app"),
});
