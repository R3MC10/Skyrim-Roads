// Phone-sized pictures for the Android app (and its quick-update zip): big paintings are shrunk in place in www/
// to sizes a phone screen can actually show, so the app downloads, unpacks and decodes far less. [OURS]
// The PC app gets the full-size www (CI uploads it before this runs); game/ and the web version are untouched.
// Only kinds of pictures the game always draws scaled to a box (never by their pixel size) are shrunk; rig parts,
// map tiles, UI pieces and strips keep their size. Same input -> same output, so update patches stay small.
//   node scripts/phoneimg.mjs WWW_DIR
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { execFileSync } from "node:child_process";

// longest side in pixels, by file name start
const RULES = [
  [/^bs-/, 1800],                    // fight backdrops (2808 wide; the fight camera pans and zooms a little)
  [/^foe-/, 900],                    // foe paintings (1254; a foe is ~300 css px tall on a phone)
  [/^(road|room|biome|place|fest|heist|gev|wev|exp|raid|longhouse)-/, 1280],   // full-width scene cards
  [/^title-wide-2x\./, 1774],        // the wide title's 2x copy (3548): a phone turned sideways never needs more
];
const dir = process.argv[2] || "www";
let before = 0, after = 0, n = 0;
const files = fs.readdirSync(dir).filter((f) => /\.webp$/i.test(f)).sort();
for (const f of files) {
  const rule = RULES.find(([re]) => re.test(f));
  const p = path.join(dir, f), size = fs.statSync(p).size;
  if (!rule) continue;
  const img = sharp(p), meta = await img.metadata(), max = rule[1], long = Math.max(meta.width, meta.height);
  if (long <= max) continue;
  const k = max / long, w = Math.round(meta.width * k), h = Math.round(meta.height * k);
  const buf = await sharp(p).resize(w, h, { kernel: "lanczos3" }).webp({ quality: 80, alphaQuality: 90, effort: 4 }).toBuffer();
  if (buf.length >= size) continue;
  fs.writeFileSync(p, buf);
  before += size; after += buf.length; n++;
}
// music: the long mus-*.mp3 pieces (~190 kb/s) are re-encoded at 128 kb/s, which phone speakers and earbuds can't
// tell apart. Needs ffmpeg (on GitHub's runners); skipped without it. Bit-exact, so the same file every build.
let mb = 0, ma = 0, mn = 0, ff = true;
try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch (e) { ff = false; }
if (ff) for (const f of fs.readdirSync(dir).filter((f) => /^mus-.*\.mp3$/i.test(f)).sort()) {
  const p = path.join(dir, f), size = fs.statSync(p).size;
  if (size < 1.5 * 1048576) continue;
  const tmp = p + ".tmp.mp3";
  try {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", p, "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", "-c:a", "libmp3lame", "-b:a", "128k", tmp]);
    const s2 = fs.statSync(tmp).size;
    if (s2 < size * 0.9) { fs.renameSync(tmp, p); mb += size; ma += s2; mn++; } else fs.rmSync(tmp);
  } catch (e) { try { fs.rmSync(tmp); } catch (x) {} }
}
console.log(ff ? `phone music: ${mn} re-encoded, ${(mb / 1048576).toFixed(1)} MB -> ${(ma / 1048576).toFixed(1)} MB` : "phone music: no ffmpeg, left as is");
console.log(`phone pictures: ${n} shrunk, ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
