// Builds www/ (what goes inside the app) from game/ (the same files as the online game).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const www = path.join(root, "www"), game = path.join(root, "game");
fs.rmSync(www, { recursive: true, force: true }); fs.mkdirSync(path.join(www, "fonts"), { recursive: true });
for (const f of fs.readdirSync(game)) fs.copyFileSync(path.join(game, f), path.join(www, f));
fs.copyFileSync(path.join(root, "app.js"), path.join(www, "app.js"));
// fonts bundled so the app looks right offline
const fonts = [["cinzel", "Cinzel", [["600", "normal"], ["700", "normal"]]], ["cormorant-garamond", "Cormorant Garamond", [["600", "normal"], ["700", "normal"], ["600", "italic"]]],
  ["barlow-semi-condensed", "Barlow Semi Condensed", [["400", "normal"], ["500", "normal"], ["600", "normal"]]]];
let css = "";
for (const [pkg, family, faces] of fonts) for (const [w, st] of faces) for (const sub of ["latin", "latin-ext"]) {
  const file = `${pkg}-${sub}-${w}-${st}.woff2`, src = path.join(root, "node_modules/@fontsource", pkg, "files", file);
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, path.join(www, "fonts", file));
  css += `@font-face{font-family:"${family}";font-style:${st};font-weight:${w};font-display:swap;src:url(${file}) format("woff2")}\n`;
}
fs.writeFileSync(path.join(www, "fonts", "fonts.css"), css);
let html = fs.readFileSync(path.join(www, "index.html"), "utf8");
html = html.replace(/<link rel="preconnect"[^>]*>\s*/g, "").replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="fonts/fonts.css">');
html = html.replace('<script src="store.js"></script>', '<script src="p2pnet.js"></script>\n<script src="store.js"></script>');   // phone-to-phone networking
html = html.replace("</body>", '<script src="app.js"></script>\n</body>');
if (!process.env.NOBUNDLE) html = (await import("./bundle.mjs")).bundle(www, html);   // one minified script instead of ~520 (faster start on phones)
fs.writeFileSync(path.join(www, "index.html"), html);
console.log("www built:", fs.readdirSync(www).length, "files");
