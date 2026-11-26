// Phone updater (app.js): runs its update logic against a fake Updater plugin and fake fetch.  node test_updater.js
// Checks: game-only updates never open Android's installer, latest.json is read (API as fallback), a damaged
// patch falls back to the full zip, failed builds aren't pushed again, the title screen marks files as working.
const path = require("path"), fs = require("fs"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };

const SHA = "a".repeat(64), SHA2 = "b".repeat(64);
const MANIFEST = { build: 300, shell: 2, date: "2026-11-25T10:00:00Z", notes: "- Better updates\n\n---\nInstall help", game: { name: "game-shell2.zip", size: 5000, sha256: SHA },
  deltas: { 299: { name: "game-shell2-from299.zip", size: 300, sha256: SHA2 } }, apk: { name: "RoadsOfTheNorth.apk", size: 9000 } };
const API = { tag_name: "build-300", body: "- From the API", published_at: "2026-11-25T10:00:00Z", assets: [
  { name: "RoadsOfTheNorth.apk", size: 9000, browser_download_url: "https://github.com/R3MC10/Skyrim-Roads/releases/download/build-300/RoadsOfTheNorth.apk" },
  { name: "game-shell2.zip", size: 5000, browser_download_url: "https://github.com/R3MC10/Skyrim-Roads/releases/download/build-300/game-shell2.zip" },
  { name: "game-shell2-from299.zip", size: 300, browser_download_url: "https://github.com/R3MC10/Skyrim-Roads/releases/download/build-300/game-shell2-from299.zip" }] };

/* a fresh app.js with a fake phone. opts: info (what Updater.info says), plugin overrides, manifest/api answers */
function boot(opts = {}) {
  const calls = [], ls = new Map(opts.ls || []), ss = new Map();
  const info = { build: 299, apkBuild: 250, shell: 2, delta: 1, canInstall: true, ...(opts.info || {}) };
  const U = {
    info: async () => ({ ...info }),
    addListener: async () => ({ remove() {} }),
    patchGame: async (a) => { calls.push(["patchGame", a]); return { path: "/ota/build-" + a.build }; },
    downloadGame: async (a) => { calls.push(["downloadGame", a]); return { path: "/ota/build-" + a.build }; },
    applyGame: async (a) => { calls.push(["applyGame", a]); },
    download: async (a) => { calls.push(["download", a]); },
    install: async () => { calls.push(["install"]); },
    openInstallSettings: async () => { calls.push(["openInstallSettings"]); },
    gameReady: async () => { calls.push(["gameReady"]); },
    getText: async (a) => { calls.push(["getText", a]); if (opts.manifest === null) throw new Error("Server said 404"); return { text: JSON.stringify(opts.manifest || MANIFEST) }; },
    ...(opts.plugin || {}),
  };
  for (const k of opts.drop || []) delete U[k];
  const fetch = async (url) => {
    calls.push(["fetch", url]);
    if (/api\.github\.com/.test(url)) return { ok: true, status: 200, json: async () => opts.api || API };
    if (opts.webManifest) return { ok: true, status: 200, text: async () => JSON.stringify(opts.webManifest) };
    throw new TypeError("Failed to fetch");   // github.com sends no CORS headers
  };
  const doc = { querySelector: () => null, createElement: () => ({ style: {}, remove() {} }), body: { appendChild() {} }, dispatchEvent() {} };
  const window = { Capacitor: { isNativePlatform: () => true, Plugins: { Updater: U, App: null, SplashScreen: null, LocalNotifications: null } }, __ui: { save() {} } };
  const ctx = {
    window, document: doc, fetch, console, Promise, JSON, Date, Math, Object, Set, Map, String, Number, RegExp, Error, TypeError, Event: class {},
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    localStorage: { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) },
    sessionStorage: { getItem: (k) => (ss.has(k) ? ss.get(k) : null), setItem: (k, v) => ss.set(k, String(v)), removeItem: (k) => ss.delete(k) },
  };
  if (opts.titleDrawn) window.__rotnTitleDrawn = true;
  vm.runInNewContext(SRC, ctx, { filename: "app.js" });
  return { app: window.__app, calls, ls, ss, U, info, names: () => calls.map((c) => c[0]) };
}

(async () => {
  // latest.json parsing
  {
    const { app } = boot();
    const r = app.parseManifest(MANIFEST);
    ok(r.build === 300 && r.game.shell === 2 && r.game.size === 5000 && r.game.sha256 === SHA, "latest.json: build, shell, size, checksum");
    ok(r.game.url === "https://github.com/R3MC10/Skyrim-Roads/releases/download/build-300/game-shell2.zip", "latest.json: game zip address on github.com");
    ok(r.game.deltas[299]?.sha256 === SHA2 && /from299\.zip$/.test(r.game.deltas[299].url), "latest.json: patches by build");
    ok(r.url.endsWith("/build-300/RoadsOfTheNorth.apk") && r.size === 9000, "latest.json: the app file");
    ok(r.notes === "- Better updates", "latest.json: notes cleaned like the release page");
    let threw = false; try { app.parseManifest({ build: 300, apk: { name: "../evil" } }); } catch (e) { threw = true; } ok(threw, "latest.json: odd file names refused");
    threw = false; try { app.parseManifest({ build: 0, apk: { name: "a.apk" } }); } catch (e) { threw = true; } ok(threw, "latest.json: no build refused");
    const bad = app.parseManifest({ ...MANIFEST, game: { ...MANIFEST.game, sha256: "nothex" } });
    ok(bad.game.sha256 === "", "latest.json: a broken checksum is ignored, not trusted");
  }
  // version check: latest.json natively, then the WebView, then the API
  {
    const b = boot(), r = await b.app.check(true);
    ok(r.latest.source === "manifest" && r.newer && r.quick && r.size === 300, "check: latest.json read natively, patch size shown");
    ok(!b.calls.some((c) => c[0] === "fetch" && /api\.github/.test(c[1])), "check: no GitHub API call when latest.json is there");
    ok(b.calls.find((c) => c[0] === "getText")[1].url === "https://github.com/R3MC10/Skyrim-Roads/releases/latest/download/latest.json", "check: the plain download address");
  }
  {
    const b = boot({ manifest: null }), r = await b.app.check(true);
    ok(r.latest.source === "api" && r.latest.build === 300 && r.latest.game.deltas[299], "check: API fallback when there's no latest.json");
  }
  {
    const b = boot({ drop: ["getText"], webManifest: MANIFEST }), r = await b.app.check(true);
    ok(r.latest.source === "manifest", "check: older app reads latest.json through the WebView when it can");
    const b2 = boot({ drop: ["getText"] }), r2 = await b2.app.check(true);
    ok(r2.latest.source === "api", "check: older app falls back to the API when the WebView can't read it");
  }
  // quick update passes checksums; damaged patch -> full zip
  {
    const b = boot();
    const r = await b.app.install(b.app.parseManifest(MANIFEST), () => {});
    const p = b.calls.find((c) => c[0] === "patchGame");
    ok(r === "applied" && p && p[1].sha256 === SHA2 && p[1].from === 299, "update: the patch goes first, with its checksum");
    ok(!b.names().includes("downloadGame") && !b.names().includes("install"), "update: no full download or installer when the patch works");
    ok(b.calls.find((c) => c[0] === "applyGame")[1].now === true, "update now: switches straight away");
    ok(b.ls.get("rotn_upd_try") === "300", "update: remembers which build it is trying");
  }
  {
    const b = boot({ plugin: { patchGame: async () => { throw new Error("The download was damaged (checksum didn't match)"); } } });
    const r = await b.app.install(b.app.parseManifest(MANIFEST), () => {});
    const d = b.calls.find((c) => c[0] === "downloadGame");
    ok(r === "applied" && d && d[1].sha256 === SHA && d[1].url.endsWith("game-shell2.zip"), "damaged patch: the full game zip is downloaded instead, with its checksum");
    ok(!b.names().includes("install") && !b.names().includes("download"), "damaged patch: never the installer");
  }
  {
    let tries = 0;
    const b = boot({ info: { build: 200 }, plugin: { downloadGame: async (a) => { tries++; if (tries === 1) throw new Error("The download was damaged (checksum didn't match)"); return { path: "/ota/x" }; } } });
    const r = await b.app.install(b.app.parseManifest(MANIFEST), () => {});
    ok(r === "applied" && tries === 2, "damaged full zip: downloaded once more");
  }
  // everything fails: plain message, no installer, and it stays that way on the next tap
  {
    const boom = async () => { throw new Error("Server said 503"); };
    const b = boot({ plugin: { patchGame: boom, downloadGame: boom } });
    const lat = b.app.parseManifest(MANIFEST);
    let msg = ""; try { await b.app.install(lat, () => {}); } catch (e) { msg = e.message; }
    ok(/tries again by itself/.test(msg) && !/installer|full app/i.test(msg), "failed game update: plain 'tries again' message");
    msg = ""; try { await b.app.install(lat, () => {}); } catch (e) { msg = e.message; }
    ok(msg && !b.names().some((x) => x === "install" || x === "download" || x === "openInstallSettings"), "failed twice: still never the APK installer");
    ok(/didn't work/.test(await b.app.how()), "the update screen says the last try didn't work");
  }
  // the installer only when the release needs a newer app
  {
    const b = boot({ info: { shell: 1 } });
    const r = await b.app.install(b.app.parseManifest(MANIFEST), () => {});
    ok(r === "installer" && b.names().includes("download") && !b.names().includes("downloadGame"), "newer shell: the APK installer");
    const c = await b.app.check(true); ok(!c.quick && c.size === 9000, "newer shell: not a quick update, full app size");
  }
  {
    const b = boot({ drop: ["downloadGame", "patchGame"] });
    const r = await b.app.install(b.app.parseManifest(MANIFEST), () => {});
    ok(r === "installer", "an app that can't update itself: the installer");
  }
  // older app without checksum support: the extra field is just passed along, nothing breaks
  {
    const b = boot({ info: { build: 280, delta: 0 } });
    await b.app.install(b.app.parseManifest(MANIFEST), () => {});
    ok(b.names().includes("downloadGame") && !b.names().includes("patchGame"), "app without patches: full zip");
    const b2 = boot({ manifest: null }); const lat = (await b2.app.check(true)).latest;
    await b2.app.install(lat, () => {});
    ok(!("sha256" in b2.calls.find((c) => c[0] === "patchGame")[1]), "API data (no checksum): no sha256 sent");
  }
  // failed builds: remembered and not pushed again
  {
    const b = boot({ info: { build: 250 }, ls: [["rotn_upd_try", "300"]] });
    b.app.noteStart(await b.app.current());
    ok(JSON.parse(b.ls.get("rotn_upd_bad")).includes(300) && b.ls.get("rotn_upd_try") === "0", "back on older files after trying 300: 300 is bad");
    ok((await b.app.check(true)).bad, "check: marks a known-bad build");
    const b2 = boot({ info: { bad: "300,301" } });
    ok((await b2.app.check(true)).bad, "check: the app's own list of failed builds counts too");
    const b3 = boot({ info: { build: 300 }, ls: [["rotn_upd_try", "300"]] });
    b3.app.noteStart(await b3.app.current());
    ok(!b3.ls.has("rotn_upd_bad") && b3.ls.get("rotn_upd_try") === "300", "on the tried build: not bad (the title screen decides)");
  }
  // the title screen marks files as working
  {
    const b = boot({ info: { build: 300 }, ls: [["rotn_upd_try", "300"]] });
    ok(!b.names().includes("gameReady"), "no 5-second timer: nothing marked before the title draws");
    b.app.ready(); b.app.ready();
    await new Promise((r) => setImmediate(r));
    ok(b.names().filter((x) => x === "gameReady").length === 1, "title drawn: gameReady once");
    ok(b.ls.get("rotn_upd_try") === "0", "title drawn on the tried build: it's good");
    const b2 = boot({ titleDrawn: true });
    ok(b2.names().includes("gameReady"), "title drew before app.js loaded: still marked");
  }
  {
    // downloaded for the next start: this session's title isn't the new files
    const b = boot();
    await b.app.quickUpdate(b.app.parseManifest(MANIFEST), false);
    ok(b.ss.get("rotn_upd_pending") === "1", "staged for next start: flagged for this session");
    b.app.ready();
    ok(!b.names().includes("gameReady"), "staged for next start: the old files' title doesn't vouch for the new ones");
  }
  // wiring
  const ui = fs.readFileSync(path.join(ROOT, "game/ui.js"), "utf8"), java = fs.readFileSync(path.join(ROOT, "android/app/src/main/java/com/r3mc10/roadsofthenorth/UpdaterPlugin.java"), "utf8");
  const main = fs.readFileSync(path.join(ROOT, "android/app/src/main/java/com/r3mc10/roadsofthenorth/MainActivity.java"), "utf8");
  const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/android.yml"), "utf8");
  ok(/__rotnTitleDrawn[\s\S]{0,80}__app\?\.ready/.test(ui), "ui.js tells the updater when the title has drawn");
  ok(/int SHELL = 2;/.test(java), "SHELL not bumped (that would make every phone reinstall)");
  ok(/call\.getString\("sha256"/.test(java) && /MessageDigest\.getInstance\("SHA-256"\)/.test(java) && /public void getText/.test(java), "native: checksum check and latest.json reader");
  ok(/goodPath/.test(main) && /"bad"/.test(main), "native: goes back to the last build that worked and remembers the bad one");
  ok(/latestjson\.mjs/.test(yml) && /^\s+latest\.json$/m.test(yml), "CI writes and publishes latest.json");
  // scripts/latestjson.mjs on a fake release folder
  const { makeManifest } = await import("file://" + path.join(ROOT, "scripts/latestjson.mjs").replace(/\\/g, "/"));
  const os = require("os"), dir = fs.mkdtempSync(path.join(os.tmpdir(), "rotn-latest-"));
  fs.writeFileSync(path.join(dir, "game-shell2.zip"), "full"); fs.writeFileSync(path.join(dir, "game-shell2-from298.zip"), "patch"); fs.writeFileSync(path.join(dir, "RoadsOfTheNorth.apk"), "apk");
  const m = makeManifest(dir, 300, 2, "- notes");
  const sha = require("crypto").createHash("sha256").update("full").digest("hex");
  ok(m.build === 300 && m.shell === 2 && m.game.sha256 === sha && m.game.size === 4 && m.deltas["298"].size === 5 && m.apk.name === "RoadsOfTheNorth.apk", "latestjson.mjs: sizes and checksums");
  const back = boot().app.parseManifest(JSON.parse(JSON.stringify(m)));
  ok(back.game.sha256 === sha && back.game.deltas[298], "latestjson.mjs output reads back in the app");
  fs.rmSync(dir, { recursive: true, force: true });

  // Capacitor getLong() returns the default for JSON Integers (189), which refused every game update: numbers go through num()
  ok(!/call.getLong(/.test(java) && /private static long num(PluginCall/.test(java), "the plugin reads build/size/from with num(), never call.getLong()");
  ok(/Not an update address/.test(fs.readFileSync(path.join(ROOT, "app.js"), "utf8")), "old apps that refuse game updates fall back to the newest app");
  console.log(fails ? `failed: ${fails}` : `updater: all ok · ${n} checks`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
