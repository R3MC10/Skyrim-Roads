/* test_greatevents_pl.js: every player-facing line of the great world events has a Polish version.
   Loads i18n.js with Polish switched on and checks each T("...") text in greatevents.js, plus titles and perks. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = process.env.W || path.join(__dirname, "../game/");
let ok = 0, bad = 0;
const check = (c, msg) => { if (c) ok++; else { bad++; console.log("FAIL", msg); } };

const ctx = { console, localStorage: { getItem: () => '{"lang":"pl"}', setItem() {} }, navigator: { language: "en" } };
vm.createContext(ctx);
for (const f of ["i18n_story.js", "i18n.js"]) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), ctx, { filename: f });
const I = ctx.I18N;
check(I && I.lang() === "pl", "Polish is on");

const src = fs.readFileSync(W + "greatevents.js", "utf8");
/* every T("literal") and T(cond ? "a" : "b") literal */
const lits = new Set();
for (const m of src.matchAll(/\bT\(([^;]*?)(?:,\s*\{|\)\s*[;:+,)`}]|\)$)/gm)) for (const s of m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) lits.add(s[1].replace(/\\'/g, "'"));
/* rules texts */
for (const m of src.matchAll(/^\s+(?:fair|dragon|rift|siege): "((?:[^"\\]|\\.)*)",?$/gm)) lits.add(m[1]);
const SAME = new Set(["{n} min"]);   /* same in Polish */
for (const s of [...lits]) if (/^[a-z]+$/.test(s)) lits.delete(s);   /* kind/state ids in conditions, not text */
check(lits.size > 100, `found ${lits.size} texts`);
for (const s of lits) { if (SAME.has(s)) continue; const pl = I.t(s); check(pl !== s, `no Polish for: ${s}`); }

/* fair games, prize labels and phase titles live in tables and go through T(g.name) etc. */
for (const m of src.matchAll(/(?:name|text|label|title): "([^"]+)"/g)) if (!/^(Dragon|Sigil Stone)$/.test(m[1])) check(!/[a-z]/i.test(m[1]) || I.t(m[1]) !== m[1] || I.tr(m[1]) !== m[1], `no Polish for table text: ${m[1]}`);
/* names that come from data tables, translated via the {foe}/{kind}/{game}/{title}/{phase} slots or the screen walker */
for (const w of ["Dragon", "Dragon assault", "Daedric rift", "Bandit siege", "Great fair", "Firebreaker", "Riftsealer", "Siegebreaker", "Fair Champion",
  "Dragon Ward", "Rift Warden", "Siege Breaker", "Fairgoer", "Hero of the Hour", "Charge landed", "Victory"])
  check(I.tr(w) !== w || I.t(w) !== w, `no Polish for name: ${w}`);
check(/Szarża/.test(I.t("Charge landed")), "Charge landed → Szarża udana");
check(/Smok/.test(I.t("{foe} attacks {place}", { foe: "Dragon", place: "Whiterun" })), "dragon name slot translated: " + I.t("{foe} attacks {place}", { foe: "Dragon", place: "Whiterun" }));
check(I.t("Rebuilding {pct}%", { pct: 40 }).includes("40%"), "numbers kept");
console.log(bad ? `greatevents_pl FAILED ${bad} of ${ok + bad}` : `greatevents_pl ok · ${ok} checks`);
process.exit(bad ? 1 : 0);
