// Everyone on the same build (game/samever.js, server/src/version.js, app.js): the build compare and update decision,
// mismatch words for party / co-op, GET /api/version (latest.json first, the API as fallback, cached, stale beats none),
// the phone app switching on the title screen / when back from the background / via Restart now, and no leftovers of
// the old "switches over when you next open it".   node test_samever.js
"use strict";
const path = require("path"), fs = require("fs"), http = require("http"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const W = process.env.W || path.join(ROOT, "game") + path.sep;
const SV = require(path.join(W, "samever.js"));
const { createVersion } = require(path.join(ROOT, "server/src/version.js"));
const { createApp } = require(path.join(ROOT, "server/src/app.js"));
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };

(async () => {
  // ---- compare
  ok(SV.versus(182, 183) === -1 && SV.versus(183, 182) === 1 && SV.versus(182, 182) === 0, "versus: older / newer / same");
  ok(SV.versus(0, 183) === 0 && SV.versus(182, undefined) === 0 && SV.versus("x", 3) === 0, "versus: an unknown build (old clients) never counts as a mismatch");
  ok(SV.versus("182", 183.9) === -1, "versus: numbers as text, fractions dropped");

  // ---- what to do with a newer build
  const d = (o) => SV.decide({ platform: "app", mine: 182, latest: 183, ...o });
  ok(d({ latest: 182 }) === "none" && d({ latest: 181 }) === "none" && d({ mine: 0 }) === "none", "decide: nothing newer (or unknown) -> none");
  ok(d({ bad: true }) === "none", "decide: a build that failed to start here isn't pushed again");
  ok(d({}) === "download" && d({ busy: true }) === "wait", "decide: apps download first (or wait for the running download)");
  ok(d({ staged: 183, onTitle: true, safe: true }) === "switch", "decide: downloaded + title screen -> switch right away");
  ok(d({ staged: 183, onTitle: false, safe: true }) === "prompt" && d({ staged: 183, onTitle: true, safe: false }) === "prompt", "decide: during play -> the Update ready card, never a forced restart");
  ok(d({ platform: "web" }) === "prompt" && d({ platform: "web", onTitle: true, safe: true }) === "switch", "decide: web needs no download, reloads on the title screen");

  // ---- mismatch words
  const me = SV.why(182, 183, "Kacper"), them = SV.why(183, 182, "Kacper");
  ok(me.behind === "me" && /Kacper is on build 183 and you're on build 182\. Update to play together\./.test(me.text), "why: I'm behind -> update to play together");
  ok(them.behind === "them" && /Kacper is still on build 182 \(you have build 183\)\. They need to update/.test(them.text), "why: they're behind -> they need to update");
  ok(SV.why(182, 182, "K") === null && SV.why(182, undefined, "K") === null, "why: same build or unknown -> nothing");
  ok(JSON.stringify(SV.cardBits()) === "{}", "cardBits: no build known yet -> nothing on the card");
  SV.set({ mine: 182 });
  ok(SV.cardBits().build === 182, "cardBits: my build rides on my player card");
  ok(SV.blockWith({ build: 182 }, "K") === false && SV.blockWith(null, "K") === false && SV.blockWith({}, "K") === false, "blockWith: same, missing or old card -> the invite goes through");
  ok(SV.blockWith({ build: 183 }, "K") === true && SV.blockWith({ build: 150 }, "K") === true, "blockWith: different builds -> stopped with a reason");

  // ---- web: newest build from our server, else GitHub
  global.ACCOUNT = { server: () => "https://srv.test" };
  let asked = [];
  const fake = (routes) => async (url) => { asked.push(url); for (const [re, f] of routes) if (re.test(url)) return f(); throw new TypeError("Failed to fetch"); };
  const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  let l = await SV.webLatest(fake([[/srv\.test\/api\/version/, () => res(200, { build: 183, date: "d" })]]));
  ok(l.build === 183 && asked.length === 1, "web: asks our server first");
  asked = [];
  l = await SV.webLatest(fake([[/srv\.test/, () => res(404, {})], [/api\.github\.com/, () => res(200, { tag_name: "build-184", published_at: "p" })]]));
  ok(l.build === 184 && asked.length === 2, "web: an older server without /api/version -> GitHub's API");
  let threw = false; try { await SV.webLatest(fake([[/api\.github\.com/, () => res(403, {})]])); } catch (e) { threw = /403/.test(e.message); }
  ok(threw, "web: GitHub refuses -> a plain error (the Updates page shows Retry)");
  delete global.ACCOUNT;

  // ---- server: GET /api/version
  let clock = 1000, calls = 0, mode = "manifest";
  const vf = async (url) => {
    calls++;
    if (/latest\.json$/.test(url)) return mode === "manifest" ? res(200, { build: 183, date: "2026-11-25" }) : res(404, {});
    if (/api\.github\.com/.test(url)) return mode === "down" ? res(503, {}) : res(200, { tag_name: "build-184", published_at: "x" });
    throw new Error("unexpected " + url);
  };
  const v = createVersion({ fetch: vf, now: () => clock });
  let r = await v.get();
  ok(r.build === 183 && r.source === "manifest" && calls === 1, "version: latest.json read first");
  clock += 60e3; r = await v.get();
  ok(r.build === 183 && calls === 1, "version: cached for a few minutes (GitHub isn't asked per player)");
  clock += 5 * 60e3; mode = "api"; r = await v.get();
  ok(r.build === 184 && r.source === "api" && calls === 3, "version: no latest.json -> the API");
  clock += 5 * 60e3; mode = "down"; r = await v.get();
  ok(r.build === 184 && r.stale === true, "version: GitHub down -> the last good answer, marked stale");
  const [a1, a2] = await Promise.all([createVersion({ fetch: vf, now: () => clock }).get().catch(() => null), Promise.resolve(1)]);
  ok(a1 === null, "version: nothing known and GitHub down -> an error (503 from the route)");
  mode = "manifest";
  const srv = http.createServer(createApp({ store: { kind: "memory" }, versionFetch: vf }));
  await new Promise((ok2) => srv.listen(0, "127.0.0.1", ok2));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const g = await fetch(base + "/api/version", { headers: { Origin: "https://game.test" } });
  const gj = await g.json();
  ok(g.status === 200 && gj.build === 183 && g.headers.get("access-control-allow-origin") === "*" && /no-store/.test(g.headers.get("cache-control")), "route: GET /api/version answers the newest build, readable from the web game");
  srv.closeAllConnections?.(); srv.close();
  const srv2 = http.createServer(createApp({ store: { kind: "memory" }, versionFetch: async () => res(500, {}) }));
  await new Promise((ok2) => srv2.listen(0, "127.0.0.1", ok2));
  const g2 = await fetch(`http://127.0.0.1:${srv2.address().port}/api/version`);
  ok(g2.status === 503 && (await g2.json()).error === "no_version", "route: GitHub unreachable -> 503 no_version");
  srv2.closeAllConnections?.(); srv2.close();

  // ---- the phone app (app.js) with a fake Updater: where it switches over
  const SRC = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const MAN = { build: 300, shell: 2, game: { name: "game-shell2.zip", size: 5000, sha256: "a".repeat(64) }, deltas: {}, apk: { name: "RoadsOfTheNorth.apk", size: 9000 } };
  function boot({ title = false, quiet = false } = {}) {
    const log = [], staged = [], prog = [];
    const U = { info: async () => ({ build: 299, apkBuild: 250, shell: 2, delta: 1, canInstall: true }), addListener: async () => ({ remove() {} }),
      downloadGame: async (x) => { log.push("download"); return { path: "/ota/" + x.build }; }, patchGame: async () => { throw new Error("no"); },
      applyGame: async (x) => { log.push("apply:" + (x.now ? "now" : "later")); }, getText: async () => ({ text: JSON.stringify(MAN) }), gameReady: async () => {} };
    const doc = { querySelector: (s) => (title && s === "#title" ? {} : null), createElement: () => ({ style: {}, remove() {} }), body: { appendChild() {} }, dispatchEvent() {} };
    const window = { Capacitor: { isNativePlatform: () => true, Plugins: { Updater: U } },
      __ui: { save() { log.push("save"); }, safeToUpdate: () => quiet, updateStaged: (r, go) => staged.push({ r, go }), updateProgress: (b, p) => prog.push([b, p]) } };
    const store = new Map();
    const ctx = { window, document: doc, fetch: async () => { throw new TypeError("x"); }, console, Promise, JSON, Date, Math, Object, Set, Map, String, Number, RegExp, Error, TypeError, Event: class {},
      setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
      localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
      sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
    vm.runInNewContext(SRC, ctx, { filename: "app.js" });
    return { app: window.__app, log, staged, prog };
  }
  let b = boot({ title: false });
  await b.app.auto();
  ok(b.log.join() === "download,apply:later" && b.staged.length === 1 && typeof b.staged[0].go === "function", "app, during play: downloads in the background and offers Restart now (no forced restart)");
  await b.staged[0].go();
  ok(b.log.slice(2).join() === "save,apply:now", "app: Restart now saves and switches straight away (no second download)");
  b = boot({ title: true });
  await b.app.auto();
  ok(b.log.join() === "download,save,apply:now" && !b.staged.length, "app, on the title screen: switches over at once");
  b = boot({ title: false, quiet: true });
  await b.app.auto(true);
  ok(b.log.join() === "download,save,apply:now", "app, back from the background with nothing going on: switches over");
  b = boot({ title: false, quiet: true });
  await b.app.auto(false);
  ok(b.log.join() === "download,apply:later", "app, a regular check mid-play: never restarts by itself");

  // ---- wiring and no leftovers
  const ui = fs.readFileSync(path.join(W, "ui.js"), "utf8"), html = fs.readFileSync(path.join(W, "index.html"), "utf8");
  const coop = fs.readFileSync(path.join(W, "coop.js"), "utf8"), pc = fs.readFileSync(path.join(W, "pcupdate.js"), "utf8");
  const idx = (f) => html.indexOf(`<script src="${f}"></script>`);
  ok(idx("samever.js") > idx("account.js") && idx("samever.js") < idx("ui.js") && idx("i18n_samever.js") > 0 && idx("i18n_samever.js") < idx("i18n.js"), "index.html: samever.js before ui.js, its Polish before i18n.js");
  ok(/SAMEVER\.cardBits\(\)/.test(ui) && /SAMEVER\.blockWith\(cardOf\(card\.id\)/.test(ui) && /SAMEVER\.blockWith\(cardOf\(p0\.leader\)/.test(ui) && /SAMEVER\.watch\(/.test(ui), "ui.js: build on the card, party invite + accept checked, party watched");
  ok((coop.match(/SAMEVER\.blockWith/g) || []).length === 2, "coop.js: co-op invite + join checked");
  ok(/visibilitychange/.test(pc) && /updateStaged/.test(pc), "pcupdate.js: checks when the window comes back, tells the Updates page");
  const stale = /next time you open the game|when you next open it|on next start/;
  const files = ["ui.js", "pcupdate.js", "i18n_qacore.js", "i18n_pcupdate.js", "samever.js"].map((f) => [f, fs.readFileSync(path.join(W, f), "utf8")]).concat([["app.js", SRC]]);
  for (const [f, src] of files) {
    const body = f === "i18n_pcupdate.js" ? src.split("// patch note")[0] + src.split("I18N_EXTRA.pat.push")[1] : src;   // old patch notes stay as they were
    ok(!stale.test(body), `${f}: no "switches over when you next open it" left`);
  }
  console.log(fails ? `failed: ${fails}` : `samever: all ok · ${n} checks`);
  setTimeout(() => process.exit(fails ? 1 : 0), 100); // let fetch sockets close first (Windows libuv)
})().catch((e) => { console.error(e); process.exit(1); });
