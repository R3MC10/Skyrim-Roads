/* Android glue: back button, saving when the app goes to the background, splash screen,
   and phone notifications (arrival, dragon attacks) while the app is closed. */
(() => {
  const C = window.Capacitor;
  if (!C?.isNativePlatform?.()) return;
  const { App, SplashScreen, LocalNotifications: LN } = C.Plugins;

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
    if (!LN) return;
    try {
      if ((await LN.checkPermissions()).display !== "granted") return;
      await clearAll();
      const list = (window.__ui?.upcoming?.() || []).map((n) => ({ id: n.id, title: n.title, body: n.body, channelId: "road", schedule: { at: new Date(n.at), allowWhileIdle: true } }));
      if (list.length) await LN.schedule({ notifications: list });
    } catch (e) { /* never block going to the background */ }
  }

  App?.addListener("backButton", () => { if (!window.__ui?.back()) App.minimizeApp(); });
  App?.addListener("pause", () => { window.__ui?.save(); scheduleAway(); });
  App?.addListener("resume", () => { clearAll(); document.dispatchEvent(new Event("visibilitychange")); });
  setTimeout(() => SplashScreen?.hide(), 400);
  setTimeout(askOnce, 2500);
})();
