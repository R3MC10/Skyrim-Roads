// App icon: every icon file made by scripts/make_icons.py from game/icon.svg exists with the right pixel size,
// and the Android, PC and web configs point at them.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const G = process.env.W || path.join(ROOT, "game") + path.sep;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };

function pngSize(f) {
  const b = fs.readFileSync(f);
  if (b.toString("ascii", 1, 4) !== "PNG") return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
function icoSizes(f) {
  const b = fs.readFileSync(f), n = b.readUInt16LE(4), out = [];
  if (b.readUInt16LE(2) !== 1) return [];
  for (let i = 0; i < n; i++) out.push(b[6 + i * 16] || 256);
  return out;
}
function png(rel, w, h = w) {
  const f = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  if (!fs.existsSync(f)) return ok(false, `missing ${rel}`);
  const s = pngSize(f);
  ok(s && s[0] === w && s[1] === h, `${rel} should be ${w}x${h}, is ${s && s.join("x")}`);
}

const RES = "android/app/src/main/res";
const D = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(D)) {
  png(`${RES}/mipmap-${d}/ic_launcher.png`, Math.round(48 * k));
  png(`${RES}/mipmap-${d}/ic_launcher_round.png`, Math.round(48 * k));
  for (const l of ["foreground", "background", "monochrome"]) png(`${RES}/mipmap-${d}/ic_launcher_${l}.png`, Math.round(108 * k));
  if (d !== "ldpi") png(`${RES}/drawable-${d}/ic_stat_roads.png`, Math.round(24 * k));
}
png("android/app/src/main/ic_launcher-playstore.png", 512);
png("desktop/icon.png", 512);
png(path.join(G, "icon-192.png"), 192);
png(path.join(G, "icon-512.png"), 512);
png(path.join(G, "apple-touch-icon.png"), 180);

// the notification icon must be a white silhouette on transparent (Android draws it as a mask)
{
  const f = path.join(ROOT, `${RES}/drawable-mdpi/ic_stat_roads.png`);
  const b = fs.readFileSync(f);
  ok(b[25] === 6, "ic_stat_roads.png should be RGBA (colour type 6)");
}

// adaptive icon: background + foreground + monochrome (Android 13 themed icons)
for (const n of ["ic_launcher", "ic_launcher_round"]) {
  const x = fs.readFileSync(path.join(ROOT, `${RES}/mipmap-anydpi-v26/${n}.xml`), "utf8");
  for (const l of ["background", "foreground", "monochrome"]) ok(x.includes(`<${l} android:drawable="@mipmap/ic_launcher_${l}"`), `${n}.xml lacks its ${l} layer`);
}
const man = fs.readFileSync(path.join(ROOT, "android/app/src/main/AndroidManifest.xml"), "utf8");
ok(man.includes('android:icon="@mipmap/ic_launcher"') && man.includes('android:roundIcon="@mipmap/ic_launcher_round"'), "AndroidManifest should use the launcher icons");

// notifications use the white icon
const cap = JSON.parse(fs.readFileSync(path.join(ROOT, "capacitor.config.json"), "utf8"));
ok(cap.plugins?.LocalNotifications?.smallIcon === "ic_stat_roads", "capacitor.config.json: LocalNotifications.smallIcon should be ic_stat_roads");

// PC: multi-size .ico wired into electron-builder, window icon shipped
const ico = path.join(ROOT, "desktop/build/icon.ico");
ok(fs.existsSync(ico), "missing desktop/build/icon.ico");
if (fs.existsSync(ico)) { const s = icoSizes(ico); for (const w of [16, 32, 48, 256]) ok(s.includes(w), `icon.ico lacks ${w}px (has ${s})`); }
const pk = JSON.parse(fs.readFileSync(path.join(ROOT, "desktop/package.json"), "utf8")).build;
ok(pk.win.icon === "build/icon.ico" && pk.nsis.installerIcon === "build/icon.ico", "desktop/package.json should point the exe and installer at build/icon.ico");
ok(pk.files.includes("icon.png"), "desktop/package.json should ship icon.png (window icon)");

// web
const fav = path.join(G, "favicon.ico");
ok(fs.existsSync(fav) && icoSizes(fav).includes(32), "game/favicon.ico should exist with a 32px image");
ok(fs.existsSync(path.join(G, "icon.svg")), "game/icon.svg (the source) is missing");
const html = fs.readFileSync(path.join(G, "index.html"), "utf8");
for (const h of ["favicon.ico", "icon.svg", "apple-touch-icon.png", "manifest.webmanifest"]) ok(html.includes(`href="${h}"`), `index.html should link ${h}`);
const wm = JSON.parse(fs.readFileSync(path.join(G, "manifest.webmanifest"), "utf8"));
for (const i of wm.icons) ok(fs.existsSync(path.join(G, i.src)), `manifest icon ${i.src} missing`);

console.log(fails ? `${fails} failed` : "app icon: all ok");
process.exit(fails ? 1 : 0);
