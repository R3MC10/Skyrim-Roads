// The "Coming next" box in Patch notes must not go stale: NEXT_AT has to stay within 3 builds of the newest patch note.
const W = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm"); const c = {}; vm.createContext(c);
vm.runInContext(fs.readFileSync(W + "patchnotes.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const P = c.PATCHNOTES; let n = 0; const ok = (x, m) => { if (!x) { console.error("FAIL " + m); process.exit(1); } n++; };
const builds = P.LIST.map((x) => +x.build || 0).filter(Boolean);
const newest = Math.max(...builds);
ok(typeof P.NEXT_AT === "number", "NEXT_AT is set in patchnotes.js");
ok(newest - P.NEXT_AT <= 3, `Coming next is stale: written for build ${P.NEXT_AT}, newest patch note is b${newest}. Update NEXT and NEXT_AT in game/patchnotes.js`);
ok(P.NEXT.length >= 2 && P.NEXT.length <= 6, "2-6 lines in Coming next");
const shipped = new Set(P.LIST.slice(0, 8).flatMap((x) => [x.title, ...(x.items || [])]));
ok(P.NEXT.every((l) => !shipped.has(l)), "no Coming next line is already a shipped patch note");
console.log("comingnext ok · " + n + " checks");
