// Builds game/font-gameicons.woff2 from the line drawings in game/gameicons.js.
//   node scripts/build_gameicons.mjs        (needs Python 3 with fontTools + brotli: pip install fonttools brotli)
// Fonts can only fill shapes, so every stroke is turned into outlines here: each line segment becomes a thin
// rectangle and each corner / end a small disc (round caps and joins). Overlapping outlines all wind the same way,
// so they merge when the glyph is filled. The Python half (build_gameicons.py) packs the outlines into a font.
import fs from "fs";
import path from "path";
import os from "os";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "game", "gameicons.js");
const OUT = path.join(ROOT, "game", "font-gameicons.woff2");
const GI = createRequire(import.meta.url)(SRC);

const STROKE = 1.8, HW = STROKE / 2, UPEM = 1000, SCALE = 37.5, X0 = 50, Y0 = 800, ADV = 1000;

// ---- tiny SVG reader: path (all commands), circle, ellipse, rect, line, polyline, polygon
// a cursor over the path text; arc flags are single digits that may be glued to the next number ("a2 2 0 010 4")
function reader(d) {
  let i = 0;
  const skip = () => { while (i < d.length && /[\s,]/.test(d[i])) i++; };
  return {
    done() { skip(); return i >= d.length; },
    isCmd() { skip(); return /[a-zA-Z]/.test(d[i]); },
    cmd() { skip(); return d[i++]; },
    num() { skip(); const m = /^[-+]?(\d*\.\d+|\d+\.?)([eE][-+]?\d+)?/.exec(d.slice(i)); if (!m) throw new Error("bad path near " + d.slice(i, i + 12)); i += m[0].length; return +m[0]; },
    flag() { skip(); const c = d[i++]; if (c !== "0" && c !== "1") throw new Error("bad arc flag in " + d); return +c; },
  };
}
function flattenArc(x1, y1, rx, ry, phi, fa, fs_, x2, y2, pts) {
  if (!rx || !ry) { pts.push([x2, y2]); return; }
  rx = Math.abs(rx); ry = Math.abs(ry); const p = (phi * Math.PI) / 180, cs = Math.cos(p), sn = Math.sin(p);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cs * dx + sn * dy, y1p = -sn * dx + cs * dy;
  const L = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry); if (L > 1) { rx *= Math.sqrt(L); ry *= Math.sqrt(L); }
  const num = Math.max(0, rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p);
  let co = Math.sqrt(num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)); if (fa === fs_) co = -co;
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cs * cxp - sn * cyp + (x1 + x2) / 2, cy = sn * cxp + cs * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs_ && dt > 0) dt -= 2 * Math.PI; else if (fs_ && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(2, Math.ceil(Math.abs(dt) / (Math.PI / 16)));
  for (let i = 1; i <= n; i++) { const t = t1 + (dt * i) / n; pts.push([cx + rx * Math.cos(t) * cs - ry * Math.sin(t) * sn, cy + rx * Math.cos(t) * sn + ry * Math.sin(t) * cs]); }
}
function bez(p0, p1, p2, p3, pts) {
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
  const n = Math.max(3, Math.ceil(len / 0.7));
  for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); }
}
export function parsePath(d) {
  const R = reader(d), subs = []; let cmd = null, cx = 0, cy = 0, sx = 0, sy = 0, cur = null, lc = null, lq = null;
  const start = (x, y) => { cur = { pts: [[x, y]], closed: false }; subs.push(cur); sx = x; sy = y; };
  const num = () => R.num();
  while (!R.done()) {
    if (R.isCmd()) cmd = R.cmd(); else if (!cmd) throw new Error("path must start with a command: " + d);
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? cx : 0, oy = rel ? cy : 0;
    if (C === "Z") { if (cur) cur.closed = true; cx = sx; cy = sy; cur = null; lc = lq = null; continue; }
    if (C !== "M" && !cur) start(cx, cy);                        // drawing on after a Z starts from the subpath start
    let nlc = null, nlq = null;
    if (C === "M") { cx = ox + num(); cy = oy + num(); start(cx, cy); cmd = rel ? "l" : "L"; }
    else if (C === "L") { cx = ox + num(); cy = oy + num(); cur.pts.push([cx, cy]); }
    else if (C === "H") { cx = ox + num(); cur.pts.push([cx, cy]); }
    else if (C === "V") { cy = oy + num(); cur.pts.push([cx, cy]); }
    else if (C === "C" || C === "S") {
      const c1 = C === "C" ? [ox + num(), oy + num()] : lc ? [2 * cx - lc[0], 2 * cy - lc[1]] : [cx, cy];
      const c2 = [ox + num(), oy + num()], e = [ox + num(), oy + num()];
      bez([cx, cy], c1, c2, e, cur.pts); nlc = c2; [cx, cy] = e;
    } else if (C === "Q" || C === "T") {
      const q = C === "Q" ? [ox + num(), oy + num()] : lq ? [2 * cx - lq[0], 2 * cy - lq[1]] : [cx, cy];
      const e = [ox + num(), oy + num()];
      bez([cx, cy], [cx + (2 / 3) * (q[0] - cx), cy + (2 / 3) * (q[1] - cy)], [e[0] + (2 / 3) * (q[0] - e[0]), e[1] + (2 / 3) * (q[1] - e[1])], e, cur.pts); nlq = q; [cx, cy] = e;
    } else if (C === "A") {
      const rx = num(), ry = num(), rot = num(), fa = R.flag(), fs_ = R.flag(), e = [ox + num(), oy + num()];
      flattenArc(cx, cy, rx, ry, rot, fa, fs_, e[0], e[1], cur.pts); [cx, cy] = e;
    } else throw new Error("unknown command " + cmd);
    lc = nlc; lq = nlq;
  }
  return subs;
}
const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
function ellipsePts(cx, cy, rx, ry) { const n = 32, pts = []; for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); } return { pts, closed: true }; }
export function shapes(svg) {
  const out = [];
  for (const m of svg.matchAll(/<(\w+)([^>]*)\/>/g)) {
    const [, tag, rest] = m, a = attrs(rest), fill = !!a.fill && a.fill !== "none";
    let subs;
    if (tag === "path") subs = parsePath(a.d);
    else if (tag === "circle") subs = [ellipsePts(+a.cx, +a.cy, +a.r, +a.r)];
    else if (tag === "ellipse") subs = [ellipsePts(+a.cx, +a.cy, +a.rx, +a.ry)];
    else if (tag === "rect") { const x = +a.x, y = +a.y, w = +a.width, h = +a.height; subs = [{ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true }]; }
    else if (tag === "line") subs = [{ pts: [[+a.x1, +a.y1], [+a.x2, +a.y2]], closed: false }];
    else if (tag === "polyline" || tag === "polygon") { const n = a.points.trim().split(/[\s,]+/).map(Number), pts = []; for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]); subs = [{ pts, closed: tag === "polygon" }]; }
    else throw new Error("unknown element " + tag);
    out.push({ subs, fill });
  }
  return out;
}

// ---- strokes to outlines
const area = (c) => { let s = 0; for (let i = 0; i < c.length; i++) { const [x1, y1] = c[i], [x2, y2] = c[(i + 1) % c.length]; s += x1 * y2 - x2 * y1; } return s / 2; };
function disc(x, y, r, n = 16) { const pts = []; for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; pts.push([x + r * Math.cos(t), y + r * Math.sin(t)]); } return pts; }
function strokeSub(sub) {
  const pts = sub.pts.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-6);
  if (sub.closed && pts.length > 1 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 1e-6) pts.pop();
  if (pts.length === 1 || (pts.length === 2 && Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) < 0.05)) return [disc(pts[0][0], pts[0][1], HW * 1.2)];   // a dot
  const out = [], segs = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
  if (sub.closed) segs.push([pts.at(-1), pts[0]]);
  for (const [a, b] of segs) { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = (-dy / L) * HW, ny = (dx / L) * HW; out.push([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]); }
  for (let i = 0; i < pts.length; i++) {
    const end = !sub.closed && (i === 0 || i === pts.length - 1);
    let turn = Math.PI;
    if (!end) { const p = pts[(i - 1 + pts.length) % pts.length], q = pts[i], r = pts[(i + 1) % pts.length]; const a1 = Math.atan2(q[1] - p[1], q[0] - p[0]), a2 = Math.atan2(r[1] - q[1], r[0] - q[0]); turn = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1))); }
    if (end || turn > 0.2) out.push(disc(pts[i][0], pts[i][1], HW));
  }
  return out;
}
export function glyph(svg) {
  const contours = [];
  for (const sh of shapes(svg)) for (const sub of sh.subs) {
    if (sh.fill && sub.pts.length > 2) contours.push(sub.pts);
    contours.push(...strokeSub(sub));
  }
  // to font units (y up), all clockwise so the overlaps merge when filled
  return contours.map((c) => { let r = c.map(([x, y]) => [Math.round(X0 + x * SCALE), Math.round(Y0 - y * SCALE)]); r = r.filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]); if (area(r) > 0) r.reverse(); return r; })
    .filter((c) => c.length >= 3 && Math.abs(area(c)) > 0.5);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = { upem: UPEM, adv: ADV, glyphs: {} };
  for (const [name, [cp, svg]] of Object.entries(GI.ICONS)) data.glyphs[name] = { cp, contours: glyph(svg) };
  const tmp = path.join(os.tmpdir(), "gameicons-" + process.pid + ".json");
  fs.writeFileSync(tmp, JSON.stringify(data));
  const py = process.platform === "win32" ? "py" : "python3";
  const r = spawnSync(py, [path.join(ROOT, "scripts", "build_gameicons.py"), tmp, OUT], { stdio: "inherit" });
  fs.unlinkSync(tmp);
  if (r.status !== 0) process.exit(r.status || 1);
  // remember which drawings the font was built from (tests/test_gameicons.js checks this)
  const src = fs.readFileSync(SRC, "utf8"), h = GI.hashOf();
  fs.writeFileSync(SRC, src.replace(/FONT_HASH = "[0-9a-f]*"/, `FONT_HASH = "${h}"`));
  console.log(`font-gameicons.woff2: ${Object.keys(GI.ICONS).length} icons, ${fs.statSync(OUT).size} bytes, hash ${h}`);
}
