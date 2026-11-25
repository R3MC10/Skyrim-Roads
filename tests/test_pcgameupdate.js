// Windows app game updates (desktop/gameupdate.js + game/pcupdate.js) against a fake GitHub release on a local server.
// Checks: latest.json is read, a small patch is used when there is one, sizes and SHA-256 are checked, a damaged
// patch falls back to the whole game, the new folder is switched to, a build that never reaches the title screen
// goes back to the one before, a newer app install wins, and a release that needs a newer app isn't downloaded.
//   node test_pcgameupdate.js
const path = require("path"), fs = require("fs"), os = require("os"), http = require("http"), zlib = require("zlib"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const G = require(path.join(ROOT, "desktop/gameupdate.js"));
const W = process.env.W || path.join(ROOT, "game/");
const P = require(path.join(W, "pcupdate.js"));
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };

/* ---- a tiny zip writer (deflate), like CI's "zip -qr9" ---- */
const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
function zip(files) {   // files: { "a/b.js": Buffer|string }
  const locals = [], cds = []; let off = 0;
  for (const [name, d] of Object.entries(files)) {
    const data = Buffer.from(d), comp = zlib.deflateRawSync(data, { level: 9 }), nm = Buffer.from(name), crc = CRC(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, nm, comp); cds.push(ch, nm); off += 30 + nm.length + comp.length;
  }
  const cd = Buffer.concat(cds), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(cds.length / 2, 8); e.writeUInt16LE(cds.length / 2, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, e]);
}
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const tree = (dir) => { const out = {}; const walk = (d, r) => { for (const x of fs.readdirSync(d)) { const p = path.join(d, x), rr = r ? r + "/" + x : x; if (fs.statSync(p).isDirectory()) walk(p, rr); else out[rr] = fs.readFileSync(p, "utf8"); } }; walk(dir, ""); return out; };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rotn-pcupd-"));
  // the game inside the app: build 100
  const bundled = path.join(tmp, "www");
  const V100 = { "index.html": "<b>100</b>", "ui.js": "ui100", "old.js": "gone soon", "art/a.webp": "pic" };
  for (const [k, v] of Object.entries(V100)) { fs.mkdirSync(path.dirname(path.join(bundled, k)), { recursive: true }); fs.writeFileSync(path.join(bundled, k), v); }
  const V101 = { "index.html": "<b>101</b>", "ui.js": "ui101", "new.js": "fresh", "art/a.webp": "pic" };

  // the fake release server: /latest.json and /download/build-N/<file>
  const files = {}; let manifest = null; const hits = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url);
    if (req.url === "/latest.json") { if (!manifest) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(manifest)); }
    const m = /^\/download\/build-(\d+)\/([\w.-]+)$/.exec(req.url), f = m && files[`${m[1]}/${m[2]}`];
    if (!f) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-length": f.length }); res.end(f);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const URLB = `http://127.0.0.1:${server.address().port}`;
  const publish = (build, game, deltas = {}, extra = {}) => {
    const fz = zip(game); files[`${build}/game-shell2.zip`] = fz;
    const ds = {};
    for (const [from, d] of Object.entries(deltas)) { const dz = zip(d); files[`${build}/game-shell2-from${from}.zip`] = dz; ds[from] = { name: `game-shell2-from${from}.zip`, size: dz.length, sha256: sha(dz) }; }
    manifest = { build, shell: 2, pcshell: 1, date: "2026-11-25T18:00:00Z", notes: `- build ${build}\n\n---\nhow to install`, game: { name: "game-shell2.zip", size: fz.length, sha256: sha(fz) }, deltas: ds, apk: { name: "RoadsOfTheNorth.apk", size: 9 }, ...extra };
  };
  const base = path.join(tmp, "userData", "game-updates");
  const make = (o = {}) => G.createGameUpdater({ base, bundledDir: bundled, bundledBuild: 100, shell: 1, manifestUrl: URLB + "/latest.json", releases: URLB, fetch, ...o });

  // 1. nothing downloaded yet: the app's own files
  let u = make(); let b = u.boot();
  ok(b.root === bundled && b.build === 100 && !b.rolledBack, "first start serves the files inside the app");
  await u.check().then(() => ok(false, "no latest.json should fail")).catch((e) => ok(/latest\.json: 404/.test(e.message), "no latest.json: a clear error (main.js falls back to the installer)"));

  // 2. build 101 with a patch from 100
  publish(101, V101, { 100: { "_delta.json": JSON.stringify({ from: 100, to: 101, remove: ["old.js"] }), "index.html": V101["index.html"], "ui.js": V101["ui.js"], "new.js": V101["new.js"] } });
  let r = await u.check();
  ok(r.newer && r.quick && r.patch && !r.bad && r.latest.build === 101 && r.size === files["101/game-shell2-from100.zip"].length, "newer build found, game files only, the small patch is picked");
  ok(r.latest.notes === "- build 101", "release notes without the install help");
  const pcts = [];
  hits.length = 0;
  await u.download((p) => pcts.push(p));
  ok(hits.some((h) => /from100/.test(h)) && !hits.some((h) => /game-shell2\.zip$/.test(h)), "only the patch was downloaded");
  ok(pcts.includes(100) && pcts.some((p) => p > 0 && p < 100) === pcts.some((p) => p > 0 && p < 100), "progress reported");
  ok(u.info().staged === 101 && u.root() === bundled, "downloaded and waiting, still on the old files");
  ok(u.apply() && u.root() === path.join(base, "b101") && u.activeBuild() === 101 && u.trying(), "switched to build 101 (on trial)");
  const t101 = tree(u.root());
  ok(t101["index.html"] === "<b>101</b>" && t101["new.js"] === "fresh" && !("old.js" in t101) && t101["art/a.webp"] === "pic" && !("_delta.json" in t101), "patched folder = build 101 exactly");
  ok(u.ready() && !u.trying(), "title screen drew: build 101 counts as working");

  // 3. build 102: damaged patch falls back to the whole game; the whole game damaged -> nothing changes
  const V102 = { ...V101, "index.html": "<b>102</b>" };
  publish(102, V102, { 101: { "_delta.json": JSON.stringify({ from: 101, to: 102, remove: [] }), "index.html": "<b>102</b>" } });
  manifest.deltas[101].sha256 = "0".repeat(64);   // the patch arrives damaged
  const goodGame = manifest.game.sha256; manifest.game.sha256 = "1".repeat(64);
  u = make(); u.boot();
  ok(u.root() === path.join(base, "b101") && u.activeBuild() === 101, "next start stays on build 101");
  await u.check();
  await u.download().then(() => ok(false, "a damaged download must fail")).catch((e) => ok(/damaged|checksum/.test(e.message), "damaged patch and damaged game: the download fails"));
  ok(!u.info().staged && u.root() === path.join(base, "b101") && !fs.readdirSync(base).some((x) => /^(tmp|dl|px)-/.test(x)), "nothing half-done left behind, still on 101");
  manifest.game.sha256 = goodGame;
  hits.length = 0;
  await u.check(); await u.download();
  ok(hits.some((h) => /from101/.test(h)) && hits.some((h) => /game-shell2\.zip$/.test(h)), "damaged patch -> the whole game");
  ok(u.info().staged === 102, "build 102 is ready");

  // 4. a downloaded build waiting from last time goes live on the next start; one that never reaches the title screen goes back
  u = make(); b = u.boot();
  ok(b.build === 102 && b.root === path.join(base, "b102") && u.trying(), "waiting build switched to at start");
  u = make(); u.boot(); u = make(); b = u.boot();
  ok(b.rolledBack && b.build === 101 && b.root === path.join(base, "b101") && u.info().bad.includes(102), "3 starts without the title screen: back to build 101, 102 marked bad");
  ok(!fs.existsSync(path.join(base, "b102")), "the bad build's files are removed");
  r = await u.check();
  ok(r.newer && r.bad, "the bad build isn't pushed again (the game skips it)");

  // 5. the in-game watchdog (main.js: no title screen within 90 s, crash) rolls back at once
  publish(103, { ...V101, "index.html": "<b>103</b>" });
  await u.check(); await u.download(); u.apply();
  ok(u.activeBuild() === 103 && u.rollback("no title screen") && u.activeBuild() === 101 && u.root() === path.join(base, "b101"), "watchdog: straight back to the build before");

  // 6. a build that needs a newer app: nothing downloaded, main.js runs the installer path instead
  publish(104, { ...V101, "index.html": "<b>104</b>" }, {}, { pcshell: 2 });
  r = await u.check();
  ok(r.newer && !r.quick && r.size === 0, "needs a newer app: not a game-only update");
  await u.download().then(() => ok(false, "must refuse")).catch((e) => ok(/new app/.test(e.message), "refuses to download game files the app can't run"));

  // 7. a newer app installed over it (its own files are build 105): downloaded files are dropped
  u = make({ bundledBuild: 105 }); b = u.boot();
  ok(b.root === bundled && b.build === 105 && !fs.readdirSync(base).some((x) => /^b\d+$/.test(x)), "a newer app install wins and old downloads are cleared");

  // 8. zip safety and the manifest
  ok(G.safeRel("../evil.js") === null && G.safeRel("/abs") === null && G.safeRel("C:/x") === null && G.safeRel("a/../b") === null && G.safeRel("a/b.js") === path.join("a", "b.js"), "zip names can't climb out of the folder");
  const evil = path.join(tmp, "evil.zip"); fs.writeFileSync(evil, zip({ "../x.js": "bad" }));
  let threw = false; try { G.extractZip(evil, path.join(tmp, "ex")); } catch (e) { threw = true; }
  ok(threw && !fs.existsSync(path.join(tmp, "x.js")), "a zip with ../ in it is refused");
  const pm = G.parseManifest({ build: 7, game: { name: "g.zip", size: 3, sha256: "A".repeat(64) }, deltas: { 6: { name: "bad name!.zip", size: 1, sha256: "a".repeat(64) } } }, "https://x/releases");
  ok(pm.game.url === "https://x/releases/download/build-7/g.zip" && pm.game.sha256 === "a".repeat(64) && !pm.deltas[6] && pm.pcshell === 1, "manifest: pinned release links, odd names ignored, old files count as PC shell 1");

  // 9. the in-game side (pcupdate.js) with a fake window.rotnPC
  const calls = [];
  const fakeB = (o = {}) => ({
    info: async () => ({ build: 101, kind: "setup" }),
    check: async () => ({ current: { build: 101, kind: o.kind || "setup" }, latest: { build: 102, notes: "", game: { size: 50 } }, newer: true, quick: o.quick !== false, bad: false, size: 10, app: { state: "none" } }),
    download: async () => { calls.push("download"); return { build: 102 }; },
    apply: async () => { calls.push("apply"); return true; },
    ready: async () => { calls.push("ready"); return true; },
    openPage: async () => { calls.push("page"); },
    installApp: async () => { calls.push("installApp"); },
    onProgress: () => () => {}, onApp: () => {},
  });
  let title = true;
  let up = P.makeUpdater(fakeB(), { onTitle: () => title, safe: () => title, ui: { save: () => calls.push("save") } });
  await up.auto();
  ok(calls.join() === "download,save,apply", "on the title screen: downloads, saves, switches over");
  calls.length = 0; title = false;
  up = P.makeUpdater(fakeB(), { onTitle: () => title, safe: () => title, ui: { save: () => calls.push("save") } });
  await up.auto();
  ok(calls.join() === "download" && up.staged === 102, "mid-game: downloads but waits (card: Restart to update)");
  await up.auto();
  ok(calls.join() === "download", "doesn't download the same build twice");
  calls.length = 0;
  ok((await up.install({ build: 102 }, () => {})) === "applied" && calls.join() === "save,apply", "Update now on the title page: switches right away");
  up.ready(); up.ready();
  ok(calls.filter((c) => c === "ready").length === 1, "ready is sent once");
  calls.length = 0;
  up = P.makeUpdater(fakeB({ quick: false, kind: "portable" }), { onTitle: () => true, safe: () => true });
  await up.auto();
  ok(!calls.includes("download") && !calls.includes("apply"), "a build that needs a newer app isn't downloaded as game files");
  ok((await up.install({ build: 102 }, () => {})) === "page" && calls.includes("page"), "portable + new app needed: opens the download page");
  ok(/portable/.test(P.text(101, 102, "portable")) && /saves stay/.test(P.text(101, 102, "setup")), "plain words");

  // 10. wiring
  const main = fs.readFileSync(path.join(ROOT, "desktop/main.js"), "utf8"), pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "desktop/package.json"), "utf8"));
  const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/android.yml"), "utf8"), lj = fs.readFileSync(path.join(ROOT, "scripts/latestjson.mjs"), "utf8");
  ok(/preload: path\.join\(__dirname, "preload\.js"\)/.test(main) && /require\("\.\/gameupdate"\)/.test(main) && /disableDifferentialDownload = true/.test(main), "main.js: preload, game updates, no broken small-download trick");
  ok(["main.js", "preload.js", "gameupdate.js"].every((f) => pkg.build.files.includes(f)) && pkg.rotnShell >= 1, "desktop package ships the updater files and has a shell number");
  ok(/pcshell/.test(lj) && /rotnShell/.test(lj) && /latestjson\.mjs/.test(yml) && /game-shell\*\.zip/.test(yml), "latest.json says which PC app the game files need");
  const { makeManifest } = await import("file://" + path.join(ROOT, "scripts/latestjson.mjs").replace(/\\/g, "/"));
  const rel = path.join(tmp, "rel"); fs.mkdirSync(rel); fs.writeFileSync(path.join(rel, "game-shell2.zip"), "zip!"); fs.writeFileSync(path.join(rel, "RoadsOfTheNorth.apk"), "apk");
  const mm = makeManifest(rel, 300, 2, "- n", undefined, 1);
  ok(mm.pcshell === 1 && G.parseManifest(mm, "https://x").game.sha256 === sha("zip!"), "latestjson.mjs output reads back on PC");

  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `failed: ${fails}` : `pcgameupdate: all ok · ${n} checks`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
