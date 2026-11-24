// Painted event and shop banners (event-and-shop art pack): every World Event kind and festival variant and every Great
// Event kind the game can produce has its wide popup banner and its compact card thumbnail in game/, under the exact name
// the loaders in worldevents.js / greatevents.js ask for; the loaders pick the thumbnail for cards and the wide crop for
// popups, and keep the drawn picture as the fallback. The new shop banners are in place for the sections that use them.
// node test_eventbanners.js
const fs = require("fs"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const src = (f) => fs.readFileSync(W + f, "utf8");
const has = (f) => fs.existsSync(W + f);

// ---- World Events: kinds and festival variants straight from the game's own lists
const wev = src("worldevents.js");
const wKinds = [...new Set([...wev.matchAll(/kind: "([a-z]+)"/g)].map((m) => m[1]))];
const fests = [...wev.matchAll(/\{ id: "([a-z]+)", name: "[^"]+", icon:/g)].map((m) => m[1]);
ok(JSON.stringify(wKinds.sort()) === JSON.stringify(["fest", "inv", "kc", "mig"]), "world event kinds: " + wKinds.join(", "));
ok(JSON.stringify(fests.sort()) === JSON.stringify(["harvest", "hearts", "merchants", "planting"]), "festival variants: " + fests.join(", "));
const wNames = [...wKinds.filter((k) => k !== "fest").map((k) => "wev-" + k), ...fests.map((v) => "wev-fest-" + v)];
// ---- Great Events
const gev = src("greatevents.js");
const gKinds = JSON.parse(gev.match(/const KINDS = (\[[^\]]+\])/)[1]);
ok(JSON.stringify(gKinds) === JSON.stringify(["dragon", "rift", "siege", "fair"]), "great event kinds: " + gKinds.join(", "));
const gNames = gKinds.map((k) => "gev-" + k);
const all = [...wNames, ...gNames];
ok(all.length === 11, "11 event variants (" + all.length + ")");
for (const a of all) ok(has(a + ".webp") && has(a + "-thumb.webp"), `${a}: wide banner and card thumbnail are in game/`);

// ---- the loaders: thumbnail for the small card, wide crop for the popup, drawn picture when the file isn't there
for (const [file, prefix] of [["worldevents.js", "wev-"], ["greatevents.js", "gev-"]]) {
  const s = src(file), body = s.slice(s.indexOf("function pic("), s.indexOf("}", s.indexOf("ART.html(w, h, draw", s.indexOf("function pic("))) + 1);
  ok(/ASSETS\.img\(w < 100 \? asset \+ "-thumb" : asset\)/.test(body), `${file}: cards (under 100 px) ask for the thumbnail, popups for the wide banner`);
  ok(/image \? \(g\) => ASSETS\.cover\(g, image, w, h\) : \(g\) => drawPic\(/.test(body), `${file}: the drawn picture stays as the fallback`);
  ok(body.includes(`\`${prefix}`), `${file}: asset names start with ${prefix}`);
  const sizes = [...s.matchAll(/pic\(ev\.kind, (\d+), (\d+)/g)].map((m) => +m[1]);
  ok(sizes.some((w) => w < 100) && sizes.some((w) => w >= 100), `${file}: one card size under 100 px and one popup size above (${sizes.join(", ")})`);
}
ok(/kind === "fest" && seed \? "-" \+ seed/.test(wev) && /ev\.kind === "fest" \? ev\.variant/.test(wev), "festivals pass their variant, so each festival gets its own banner");

// ---- shop and service banners the town sections ask for (shop-<id>, with blacksmith → forge, enchanter → wizard)
for (const id of ["wizard", "market", "stables", "home", "hall", "fence", "arena", "mine", "docks"]) ok(has(`shop-${id}.webp`), `shop-${id}.webp is in game/`);
ok(/SHOP_PIC = \{ blacksmith: "forge", enchanter: "wizard" \}/.test(src("placeart.js")), "the enchanter section uses the wizard banner");

console.log(fails ? `failed: ${fails}` : `eventbanners: all ok · ${n} checks`);
process.exit(fails ? 1 : 0);
