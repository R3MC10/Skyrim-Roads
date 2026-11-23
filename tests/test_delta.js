// Small game patches (scripts/delta.mjs): only changed files go in, removed ones are listed, and the old game plus
// the patch is exactly the new game.  node test_delta.js
const fs = require("fs"), path = require("path"), os = require("os");
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
(async () => {
  const D = await import(require("url").pathToFileURL(path.join(__dirname, "../scripts/delta.mjs")).href);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rotn-delta-"));
  const put = (root, files) => { for (const [k, v] of Object.entries(files)) { const p = path.join(root, ...k.split("/")); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, v); } };
  const oldD = path.join(tmp, "old"), newD = path.join(tmp, "new"), out = path.join(tmp, "out");
  put(oldD, { "index.html": "<html>v1", "ui.js": "same", "engine.js": "old engine", "gone.js": "bye", "art/wolf.webp": "pic", "art/old.webp": "x" });
  put(newD, { "index.html": "<html>v2", "ui.js": "same", "engine.js": "new engine", "combatfx.js": "new file", "art/wolf.webp": "pic", "art/bear.webp": "pic2" });
  // the diff itself
  const d = D.diff(D.hashTree(oldD), D.hashTree(newD));
  ok(JSON.stringify(d.changed) === JSON.stringify(["art/bear.webp", "combatfx.js", "engine.js", "index.html"]), "changed and new files go in: " + d.changed);
  ok(JSON.stringify(d.remove) === JSON.stringify(["art/old.webp", "gone.js"]), "files that are gone get listed: " + d.remove);
  ok(D.diff({ a: "1" }, { a: "1" }).changed.length === 0, "nothing changed, nothing sent");
  // the patch folder
  const r = D.makeDelta(oldD, newD, 128, 130, out);
  const meta = JSON.parse(fs.readFileSync(path.join(out, "_delta.json"), "utf8"));
  ok(meta.from === 128 && meta.to === 130 && meta.remove.length === 2, "the patch says which build it's for");
  ok(!fs.existsSync(path.join(out, "ui.js")) && !fs.existsSync(path.join(out, "art/wolf.webp")), "unchanged files stay out of the patch");
  ok(fs.readFileSync(path.join(out, "engine.js"), "utf8") === "new engine" && fs.existsSync(path.join(out, "art/bear.webp")), "changed files are in it, folders kept");
  // what the phone does: copy the old game, lay the patch over it, delete the removed files
  const phone = path.join(tmp, "phone");
  fs.cpSync(oldD, phone, { recursive: true }); fs.cpSync(out, phone, { recursive: true });
  for (const k of meta.remove) fs.rmSync(path.join(phone, ...k.split("/")));
  fs.rmSync(path.join(phone, "_delta.json"));
  ok(JSON.stringify(D.hashTree(phone)) === JSON.stringify(D.hashTree(newD)), "old game + patch = the new game, byte for byte");
  // re-running clears the old output
  D.makeDelta(newD, newD, 130, 131, out);
  ok(fs.readdirSync(out).join() === "_delta.json", "a patch with no changes is just its list");
  fs.rmSync(tmp, { recursive: true, force: true });
  // the release asset names the app looks for
  const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8"), ci = fs.readFileSync(path.join(__dirname, "../.github/workflows/android.yml"), "utf8");
  const re = /\^game-shell\(\\d\+\)-from\(\\d\+\)\\\.zip\$/;
  ok(re.test(app) && /game-shell\$\{SHELL_V\}-from\$\{FROM\}\.zip/.test(ci), "app and CI agree on the patch file name");
  ok(!/^game-shell(\d+)\.zip$/i.test("game-shell2-from128.zip"), "a patch is never mistaken for the full game");
  const java = fs.readFileSync(path.join(__dirname, "../android/app/src/main/java/com/r3mc10/roadsofthenorth/UpdaterPlugin.java"), "utf8");
  ok(/public void patchGame\(PluginCall call\)/.test(java) && /ret\.put\("delta", 1\)/.test(java), "the app can apply patches and says so");
  console.log(fails ? `failed: ${fails}` : `delta: all ok · ${n} checks`);
  process.exit(fails ? 1 : 0);
})();
