/* Android glue: back button, saving when the app goes to the background, splash screen. */
(() => {
  const C = window.Capacitor;
  if (!C?.isNativePlatform?.()) return;
  const { App, SplashScreen } = C.Plugins;
  App?.addListener("backButton", () => { if (!window.__ui?.back()) App.minimizeApp(); });
  App?.addListener("pause", () => window.__ui?.save());
  App?.addListener("resume", () => document.dispatchEvent(new Event("visibilitychange")));
  setTimeout(() => SplashScreen?.hide(), 400);
})();
