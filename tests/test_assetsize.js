/* test_assetsize.js: painted files in game/ are big enough for the screens they're shown on, and never the wrong shape.
   Owner: "make sure that all assets are properly scaled and dont throw low quality".
   Reads each .webp/.png/.jpg header (no libraries) and checks
     * every file has at least the pixel size its kind needs (a smaller file dropped in would be blown up into a blur);
     * shapes: places/biomes 16:9, shop banners wide, foes drawn true to shape (foe-dragon 3:2 since the squashed square went);
     * art_gpt/REGEN_LIST.md: every "allow:" line names a real file, with a sane limit (tests/art_quality_ui.py reads them).
   The on-screen check (shown px x density vs the file's px, phone and PC) is tests/art_quality_ui.py. */
const fs = require("fs"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const ROOT = path.join(__dirname, "..");
let fails = 0, n = 0;
const bad = (m) => { fails++; console.log("FAIL " + m); };

function size(file) {
  const b = fs.readFileSync(file);
  if (b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP") {
    const t = b.slice(12, 16).toString();
    if (t === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (t === "VP8L") { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
    if (t === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  }
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length;) { const m = b[i + 1], L = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + L; }
  }
  return null;
}

// [prefix, min width, min height, aspect (w/h) or null, aspect tolerance]
const RULES = [
  [/^title$/, 1080, 1920, null], [/^bg-loading-\d$/, 1080, 1920, 9 / 16, 0.02], [/^ui-nightsky$/, 1080, 1920, 9 / 16, 0.02],
  [/^(place|biome)-/, 1600, 900, 16 / 9, 0.01], [/^shop-/, 1200, 320, null],
  [/^foe-dragon$/, 1536, 1024, 1.5, 0.01], [/^foe-/, 1254, 1254, 1, 0.01],
  [/^bs-(forest|snow|tundra|cave|barrow|dwemer|town)$/, 2808, 1290, 2808 / 1290, 0.01], [/^bs-/, 1480, 680, 1480 / 680, 0.01], [/^bsf-/, 1480, 40, null], [/^bsp-/, 60, 60, null],
  [/^(gev|wev)-.*-thumb$/, 280, 200, null], [/^(gev|wev)-/, 1280, 440, null],
  [/^map-world$/, 2000, 1400, 10 / 7, 0.01], [/^map-world-2x$/, 3000, 2100, 10 / 7, 0.01],
  [/^ui-compass3d$/, 2240, 2240, 1, 0], [/^ui-(compass|frame|panel|parchment)$/, 1024, 1024, 1, 0],
  [/^fest-/, 1600, 600, 8 / 3, 0.01],
  [/^room-/, 1280, 720, null],
  [/^rig-w-(bow|bow-drawn|shield|shield-side|shield-kite|shield-kite-side)$/, 30, 190, null], [/^rig-w-/, 190, 20, null], [/^icon-192/, 192, 192, 1, 0], [/^icon-/, 256, 256, 1, 0],
];
const files = fs.readdirSync(W).filter((f) => /\.(webp|png|jpe?g)$/i.test(f));
const keys = new Set();
for (const f of files) {
  const key = f.replace(/(@2x)?\.(webp|png|jpe?g)$/i, ""), hi = /@2x\./.test(f); keys.add(key);
  const sz = size(path.join(W, f));
  if (!sz) { bad(`${f}: can't read its size`); continue; }
  n++;
  const r = RULES.find(([re]) => re.test(key));
  if (!r) continue;   // an extra picture with no rule yet
  const [, mw, mh, asp, tol] = r, k = hi ? 2 : 1;
  if (sz[0] < mw * k * 0.98 && sz[1] < mh * k * 0.98) bad(`${f}: ${sz[0]}x${sz[1]} is smaller than the ${mw * k}x${mh * k} it needs (it would be blown up)`);
  if (asp && Math.abs(sz[0] / sz[1] / asp - 1) > (tol || 0) + 0.005) bad(`${f}: shape ${sz[0]}x${sz[1]} should be ${asp.toFixed(3)} wide per high`);
}
if (n < 150) bad(`only ${n} painted files found in ${W}`);

// art_gpt/REGEN_LIST.md allow lines
const rl = path.join(ROOT, "art_gpt", "REGEN_LIST.md");
if (fs.existsSync(rl)) {
  let a = 0;
  for (const ln of fs.readFileSync(rl, "utf8").split(/\r?\n/)) {
    const m = /^allow:\s+(\S+)\s+([\d.]+)/.exec(ln.trim()); if (!m) continue; a++;
    if (!keys.has(m[1])) bad(`REGEN_LIST allow: ${m[1]} is not a file in game/`);
    if (!(+m[2] >= 1.5 && +m[2] <= 8)) bad(`REGEN_LIST allow: ${m[1]} limit ${m[2]} should be between 1.5 and 8`);
  }
  console.log(`  REGEN_LIST: ${a} allowed files`);
} else if (!process.env.W) bad("art_gpt/REGEN_LIST.md is missing");

// index.html CSS: every { has its }. One missing brace once left a phone-hiding @media block open, so every rule after
// it (the art-fit caps among them) only worked on big screens.
{
  const html = fs.readFileSync(path.join(W, "index.html"), "utf8");
  const blocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
  blocks.forEach((m, i) => {
    const css = m[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    let d = 0, line = 1, openAt = 0;
    for (const ch of css) { if (ch === "\n") line++; else if (ch === "{") { if (!d) openAt = line; d++; } else if (ch === "}") d--; if (d < 0) break; }
    if (d !== 0) bad(`index.html <style> block ${i + 1}: braces don't match (${d > 0 ? "a block opened near its line " + openAt + " is never closed" : "an extra }"})`);
  });
}

console.log(fails ? `test_assetsize: ${fails} problems` : `test_assetsize: all ${n} painted files ok`);
process.exit(fails ? 1 : 0);
