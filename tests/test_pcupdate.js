// PC "new version" card (pcupdate.js): reads the build, decides when to nag.  node test_pcupdate.js
const path = require("path"), fs = require("fs");
const W = process.env.W || path.join(__dirname, "../game/");
const P = require(path.join(W, "pcupdate.js"));
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Roads of the North/1.0.100 Chrome/130.0.6723.137 Electron/33.2.1 Safari/537.36";
ok(P.buildOf("", "1.0.131") === 131, "build from the address main.js passes");
ok(P.buildOf(UA, null) === 100, "old PC builds (no address info) read it from the user agent");
ok(P.buildOf(UA.replace("Roads of the North", "roads-of-the-north-pc"), null) === 100, "either app name");
ok(P.buildOf("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile", null) === 0 && P.buildOf("Roads of the North/1.0.5 Chrome", null) === 0, "phones and browsers aren't the PC app");
ok(P.shouldShow(130, 131, "portable") && P.shouldShow(130, 131, ""), "portable: shows as soon as a newer build is out");
ok(!P.shouldShow(130, 131, "setup") && !P.shouldShow(130, 132, "setup") && P.shouldShow(130, 133, "setup"), "installed: only when its own updater looks stuck (3+ behind)");
ok(!P.shouldShow(131, 131, "portable") && !P.shouldShow(132, 131, "portable") && !P.shouldShow(0, 131, "portable"), "nothing when up to date or unknown");
ok(/portable/.test(P.text(130, 131, "portable")) && /saves stay/.test(P.text(130, 131, "setup")), "plain words");
// wiring
const html = fs.readFileSync(path.join(W, "index.html"), "utf8"), main = fs.readFileSync(path.join(__dirname, "../desktop/main.js"), "utf8");
ok(/<script src="pcupdate.js"><\/script>/.test(html) && /#pcupd\{/.test(html), "loaded and styled");
ok(/index\.html\?pc=\$\{KIND\}&v=1\.0\.\$\{games\.activeBuild\(\)\}/.test(main) && /KIND = process\.env\.PORTABLE_EXECUTABLE_DIR \? "portable" : "setup"/.test(main), "the PC app says which kind it is and the game build it runs");
console.log(fails ? `failed: ${fails}` : `pcupdate: all ok · ${n} checks`);
process.exit(fails ? 1 : 0);
