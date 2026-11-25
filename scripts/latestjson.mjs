// latest.json for phones: a small release file the app reads (no GitHub API rate limit) to see the newest build,
// which files it has, their sizes and SHA-256 checksums (the app checks the game zip before unpacking it).
//   node scripts/latestjson.mjs BUILD SHELL [DIR] > latest.json      (release notes come from $CHANGES)
// {build, shell, date, notes, game:{name,size,sha256}, deltas:{from:{name,size,sha256}}, apk:{name,size}}
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const fileInfo = (dir, name, hash = true) => {
  const p = path.join(dir, name), out = { name, size: fs.statSync(p).size };
  if (hash) out.sha256 = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
  return out;
};

export function makeManifest(dir, build, shell, notes = "", date = new Date().toISOString()) {
  const files = fs.readdirSync(dir);
  const full = `game-shell${shell}.zip`;
  if (!files.includes(full)) throw new Error(`${full} is missing`);
  const apk = files.find((f) => /\.apk$/i.test(f));
  if (!apk) throw new Error("no .apk");
  const deltas = {};
  for (const f of files.sort()) {
    const m = new RegExp(`^game-shell${shell}-from(\\d+)\\.zip$`).exec(f);
    if (m) deltas[m[1]] = fileInfo(dir, f);
  }
  return { build: +build, shell: +shell, date, notes: String(notes || "").trim(), game: fileInfo(dir, full), deltas, apk: fileInfo(dir, apk, false) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [build, shell, dir = "."] = process.argv.slice(2);
  if (!(+build > 0) || !(+shell > 0)) { console.error("usage: node scripts/latestjson.mjs BUILD SHELL [DIR]"); process.exit(2); }
  process.stdout.write(JSON.stringify(makeManifest(dir, build, shell, process.env.CHANGES || ""), null, 1) + "\n");
}
