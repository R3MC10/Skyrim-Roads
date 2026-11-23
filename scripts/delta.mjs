// Small game patches for phones: compares an older build's game files with the new ones and copies only what
// changed into an output folder, plus _delta.json ({ from, to, remove: [...] }). CI zips that folder as
// game-shellS-fromN.zip next to the full game zip; the app (UpdaterPlugin.patchGame) copies its current game,
// unpacks the patch over it and deletes the removed files. Anything that doesn't line up falls back to the full zip.
//   node scripts/delta.mjs OLD_DIR NEW_DIR FROM_BUILD TO_BUILD OUT_DIR
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

/** every file under dir: { "relative/path": sha1 } (forward slashes) */
export function hashTree(dir) {
  const out = {};
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name), r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile()) out[r] = crypto.createHash("sha1").update(fs.readFileSync(p)).digest("hex");
    }
  };
  walk(dir, "");
  return out;
}

/** what a patch from old to new needs: files to send (new or changed) and files to delete */
export function diff(oldH, newH) {
  const changed = Object.keys(newH).filter((k) => oldH[k] !== newH[k]).sort();
  const remove = Object.keys(oldH).filter((k) => !(k in newH)).sort();
  return { changed, remove };
}

export function makeDelta(oldDir, newDir, from, to, outDir) {
  const { changed, remove } = diff(hashTree(oldDir), hashTree(newDir));
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const k of changed) {
    const dst = path.join(outDir, ...k.split("/"));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(newDir, ...k.split("/")), dst);
  }
  fs.writeFileSync(path.join(outDir, "_delta.json"), JSON.stringify({ from: +from, to: +to, remove }));
  return { changed, remove };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [oldDir, newDir, from, to, outDir] = process.argv.slice(2);
  if (!outDir || !(+from > 0) || !(+to > 0)) { console.error("usage: node scripts/delta.mjs OLD_DIR NEW_DIR FROM TO OUT_DIR"); process.exit(2); }
  const r = makeDelta(oldDir, newDir, from, to, outDir);
  console.log(`build ${from} → ${to}: ${r.changed.length} changed, ${r.remove.length} removed`);
}
