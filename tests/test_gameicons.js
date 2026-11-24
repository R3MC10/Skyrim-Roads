const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Game icons instead of emoji: UI code must not use emoji (they look like phone emotes, not game icons).
// Use a game icon from game/gameicons.js instead: " Fight" (swords) or GI.ch("swords").
// Allowed: patch notes text, and the emoji → icon table in gameicons.js itself. Player chat is typed by players, not code.
const fs = require("fs"), path = require("path"), assert = require("assert");
const W = __GAME;
const GI = require(path.join(W, "gameicons.js"));
const ALLOW = new Set(["gameicons.js", "patchnotes.js"]);
const EMO = /\p{Extended_Pictographic}/u;

// 1) no emoji in game code or the page
const bad = [];
for (const f of fs.readdirSync(W).filter((f) => /\.(js|html)$/.test(f) && !ALLOW.has(f))) {
  fs.readFileSync(path.join(W, f), "utf8").split("\n").forEach((line, i) => {
    const m = line.match(/\p{Extended_Pictographic}/gu);
    if (m) bad.push(`${f}:${i + 1}  ${m.join(" ")}  →  ${m.map((e) => (GI.FROM[e] ? "\\u" + GI.FROM[e].charCodeAt(0).toString(16).toUpperCase() : "(draw a new icon)")).join(" ")}`);
  });
}
if (bad.length) { console.log("Emoji in UI code. Swap each for a game icon (gameicons.js):\n  " + bad.slice(0, 40).join("\n  ")); process.exit(1); }

// 2) the icon set is sound
const cps = Object.values(GI.ICONS).map((x) => x[0]);
assert.strictEqual(new Set(cps).size, cps.length, "two icons share a code point");
for (const [n, [cp, d]] of Object.entries(GI.ICONS)) {
  assert.ok(cp >= 0xE100 && cp <= 0xE1FF, `${n}: code point outside U+E100-E1FF`);
  assert.ok(/<(path|circle|ellipse|rect|line|polyline|polygon)\b/.test(d), `${n}: no drawing`);
  assert.strictEqual(GI.ch(n), String.fromCharCode(cp));
}
for (const [e, c] of Object.entries(GI.FROM)) assert.ok(EMO.test(e) && cps.includes(c.charCodeAt(0)), `bad emoji mapping ${e}`);

// 3) every icon used in code exists in the font, and the font was rebuilt after the drawings last changed
const used = new Set();
for (const f of fs.readdirSync(W).filter((f) => /\.(js|html)$/.test(f) && f !== "gameicons.js")) {
  const s = fs.readFileSync(path.join(W, f), "utf8").replace(/U\+E100-E1FF|\\uE100-\\uE1FF/g, "");
  for (const m of s.matchAll(/\\u(E1[0-9A-Fa-f]{2})|\\(E1[0-9A-Fa-f]{2})\b|&#x(E1[0-9A-Fa-f]{2});|([-])/g)) used.add(m[4] ? m[4].charCodeAt(0) : parseInt(m[1] || m[2] || m[3], 16));
}
const missing = [...used].filter((cp) => !cps.includes(cp));
assert.deepStrictEqual(missing.map((c) => c.toString(16)), [], "code uses icons that aren't drawn");
assert.ok(fs.existsSync(path.join(W, "font-gameicons.woff2")) && fs.statSync(path.join(W, "font-gameicons.woff2")).size > 5000, "font-gameicons.woff2 missing");
assert.strictEqual(GI.FONT_HASH, GI.hashOf(), "icon drawings changed: run `node scripts/build_gameicons.mjs` to rebuild the font");

// 4) the page wires the font into every UI font face, and loads gameicons.js first
const html = fs.readFileSync(path.join(W, "index.html"), "utf8");
const faces = [...html.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1]);
for (const f of faces.filter((f) => !/gameicons/.test(f))) {
  const fam = /font-family:"([^"]+)"/.exec(f)[1], st = /font-style:(\w+)/.exec(f)[1], w = /font-weight:(\d+)/.exec(f)[1];
  assert.ok(faces.some((g) => /font-gameicons/.test(g) && g.includes(`"${fam}"`) && g.includes(`font-style:${st}`) && g.includes(`font-weight:${w};`) && /unicode-range:U\+E100-E1FF/.test(g)), `no icon twin for ${fam} ${st} ${w}`);
}
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
assert.strictEqual(scripts[0], "gameicons.js", "gameicons.js should load first");

// 5) helpers
assert.strictEqual(GI.swap("⚔️ Fight ⚠ trap"), " Fight  trap");
assert.strictEqual(GI.plain(" Fight"), "Fight");
assert.ok(GI.svg("swords").startsWith("<svg"));
console.log(`game icons ok: ${cps.length} icons, ${used.size} used in code, ${Object.keys(GI.FROM).length} emoji mapped`);
