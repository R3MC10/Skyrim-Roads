/* GRIPDATA: where every weapon and shield picture is held. [OURS] [dollrig2]
   Pictures are never placed by their middle. Each one has, in fractions of its own width and height:
     grip           where the (main) hand closes: the middle of the leather wrap, below a sword's crossguard
     axis           [dx, dy] from the grip toward the head or tip (the painted weapons lie flat pointing right: [1, 0];
                    the bow stands up: [0, -1] toward its upper tip)
     secondaryGrip  where a second hand goes on a two-hander (nearer the pommel)
     shieldGrip     the strap / boss a shield hangs from (round shields: the middle)
   To put a picture in a hand: scale it, turn it so its axis points the way the pose wants, then move it so its grip
   lands on the fist (DOLLFRONT and RIGGEAR both do this).

   A picture with no row here (new art dropped in later) is measured from its alpha the first time it is drawn:
   the long (principal) axis, then a width profile along it: the heavy end is the head, the thin end the handle, and
   the grip sits on the handle (for a sword just below the crossguard, for a round shield in the middle). The result is
   cached; copy it into TABLE from the grip tool (?griptool on the address, developers only) to make it permanent.

     GRIPDATA.TABLE              the saved rows
     GRIPDATA.of(key, img)       the row for a picture: saved, or measured from img (null when neither)
     GRIPDATA.detect(img, kind)  measure a picture: { grip, axis, secondaryGrip?, shieldGrip?, measured: true }
     GRIPDATA.tool()             the developer grip tool (a modal listing every picture with its grip and axis) */
const GRIPDATA = (() => {
  const TABLE = {
    sword: { grip: [0.167, 0.505], axis: [1, 0] },
    "sword-iron": { grip: [0.145, 0.522], axis: [1, 0] },
    dagger: { grip: [0.23, 0.489], axis: [1, 0] },
    greatsword: { grip: [0.155, 0.493], axis: [1, 0], secondaryGrip: [0.07, 0.493] },
    axe: { grip: [0.17, 0.428], axis: [1, 0] },
    battleaxe: { grip: [0.15, 0.495], axis: [1, 0], secondaryGrip: [0.06, 0.495] },
    mace: { grip: [0.2, 0.502], axis: [1, 0] },
    staff: { grip: [0.33, 0.548], axis: [1, 0] },
    bow: { grip: [0.68, 0.5], axis: [0, -1] },
    "bow-drawn": { grip: [0.69, 0.48], axis: [0, -1] },
    shield: { shieldGrip: [0.5, 0.5] },
    "shield-kite": { shieldGrip: [0.5, 0.46] },
  };
  const MEASURED = new Map();
  const isShield = (k) => /^shield/.test(k || "");
  /* principal axis + width profile of the opaque pixels */
  function detect(img, kind = "") {
    if (!img || typeof document === "undefined") return null;
    try {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.min(1, 256 / Math.max(iw, ih));
      const W = Math.max(1, Math.round(iw * k)), H = Math.max(1, Math.round(ih * k));
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H).data, pts = [];
      let sx = 0, sy = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) if (d[(y * W + X) * 4 + 3] > 96) { pts.push(X, y); sx += X; sy += y; if (X < x0) x0 = X; if (X > x1) x1 = X; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const n = pts.length / 2; if (n < 8) return null;
      if (isShield(kind)) return { shieldGrip: [((x0 + x1) / 2 + 0.5) / W, ((y0 + y1) / 2 + 0.5) / H], measured: true };
      const mx = sx / n, my = sy / n;
      let cxx = 0, cyy = 0, cxy = 0;
      for (let i = 0; i < pts.length; i += 2) { const a = pts[i] - mx, b = pts[i + 1] - my; cxx += a * a; cyy += b * b; cxy += a * b; }
      const ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy), ax = [Math.cos(ang), Math.sin(ang)], px = [-ax[1], ax[0]];
      let t0 = Infinity, t1 = -Infinity;
      for (let i = 0; i < pts.length; i += 2) { const t = (pts[i] - mx) * ax[0] + (pts[i + 1] - my) * ax[1]; if (t < t0) t0 = t; if (t > t1) t1 = t; }
      const NB = 48, lo = new Array(NB).fill(Infinity), hi = new Array(NB).fill(-Infinity), cnt = new Array(NB).fill(0);
      for (let i = 0; i < pts.length; i += 2) {
        const a = pts[i] - mx, b = pts[i + 1] - my, t = a * ax[0] + b * ax[1], s = a * px[0] + b * px[1];
        const j = Math.min(NB - 1, Math.max(0, Math.floor(((t - t0) / Math.max(1e-6, t1 - t0)) * NB)));
        cnt[j]++; if (s < lo[j]) lo[j] = s; if (s > hi[j]) hi[j] = s;
      }
      const wd = lo.map((l, j) => (cnt[j] ? hi[j] - l : 0)), mid = lo.map((l, j) => (cnt[j] ? (hi[j] + l) / 2 : 0));
      const mass = (a, b) => cnt.slice(a, b).reduce((s, v) => s + v, 0);
      // the heavy end is the head: flip so bin 0 is the handle end
      const flip = mass(0, NB * 0.35) > mass(NB * 0.65, NB);
      const W2 = flip ? wd.slice().reverse() : wd, M2 = flip ? mid.slice().reverse() : mid, tAt = (j) => (flip ? t1 - ((j + 0.5) / NB) * (t1 - t0) : t0 + ((j + 0.5) / NB) * (t1 - t0));
      const dir = flip ? [-ax[0], -ax[1]] : ax;
      let gj;
      if (kind === "bow" || /^bow/.test(kind)) gj = NB >> 1;   // the riser: the middle of the bow
      else {
        const thin = W2.slice(1, Math.round(NB * 0.45)).filter((v) => v > 0).sort((a, b) => a - b)[0] || 1;
        let guard = -1;   // a crossguard: the first bin past the pommel at least twice as wide as the handle
        for (let j = 3; j < NB * 0.5; j++) if (W2[j] > thin * 2.2 && W2[j - 1] <= thin * 1.6) { guard = j; break; }
        gj = guard > 0 ? Math.max(1, guard - Math.max(1, Math.round(guard * 0.35))) : Math.round(NB * 0.15);
      }
      const t = tAt(gj), m = M2[gj], gx = mx + dir[0] * 0 + ax[0] * t + px[0] * m, gy = my + ax[1] * t + px[1] * m;
      const out = { grip: [(gx + 0.5) / W, (gy + 0.5) / H], axis: [Math.round(dir[0] * 1000) / 1000, Math.round(dir[1] * 1000) / 1000], measured: true };
      if (/great|battle|warhammer/.test(kind)) { const t2 = tAt(Math.max(0, gj - 4)), m2 = M2[Math.max(0, gj - 4)]; out.secondaryGrip = [(mx + ax[0] * t2 + px[0] * m2 + 0.5) / W, (my + ax[1] * t2 + px[1] * m2 + 0.5) / H]; }
      return out;
    } catch { return null; }   // a tainted canvas or no pixels: no guess
  }
  function of(key, img) {
    if (TABLE[key]) return TABLE[key];
    if (MEASURED.has(key)) return MEASURED.get(key);
    const m = img ? detect(img, key) : null;
    if (m) MEASURED.set(key, m);
    return m;
  }
  /* developers: every picture with its saved grip (green), the measured one (red) and the axis */
  function tool() {
    if (typeof document === "undefined" || typeof ASSETS === "undefined") return;
    const keys = [...new Set([...Object.keys(TABLE), "sword", "dagger", "greatsword", "axe", "battleaxe", "mace", "staff", "bow", "shield", "shield-kite"])];
    const box = document.createElement("div"); box.id = "griptool";
    box.style.cssText = "position:fixed;inset:8px;z-index:9999;overflow:auto;background:#1b1712;color:#e9dcc0;padding:10px;font:12px monospace;border:1px solid #6b5a40";
    box.innerHTML = `<b>Grip tool</b> (green = saved, red = measured; line = axis). <button data-x>Close</button><pre id="griptxt"></pre>`;
    const rows = {};
    for (const k of keys) {
      const im = ASSETS.img("rig-w-" + k); if (!im) continue;
      const iw = im.naturalWidth, ih = im.naturalHeight, s = Math.min(1, 320 / iw, 200 / ih), cv = document.createElement("canvas");
      cv.width = Math.round(iw * s) + 20; cv.height = Math.round(ih * s) + 20; const g = cv.getContext("2d");
      g.fillStyle = "#3a3128"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 10, 10, iw * s, ih * s);
      const dot = (p, col, ax) => { if (!p) return; const X = 10 + p[0] * iw * s, Y = 10 + p[1] * ih * s; g.fillStyle = col; g.beginPath(); g.arc(X, Y, 4, 0, 7); g.fill();
        if (ax) { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(X, Y); g.lineTo(X + ax[0] * 60, Y + ax[1] * 60); g.stroke(); } };
      const sv = TABLE[k], ms = detect(im, k);
      dot(sv && (sv.grip || sv.shieldGrip), "#5fd36a", sv && sv.axis); dot(sv && sv.secondaryGrip, "#3a9a44");
      dot(ms && (ms.grip || ms.shieldGrip), "#e0503a", ms && ms.axis);
      const p = document.createElement("div"); p.textContent = k; p.appendChild(document.createElement("br")); p.appendChild(cv); box.appendChild(p);
      rows[k] = sv || ms;
    }
    box.querySelector("#griptxt").textContent = JSON.stringify(rows);
    box.querySelector("[data-x]").onclick = () => box.remove();
    document.body.appendChild(box);
  }
  try { if (typeof location !== "undefined" && /[?&]griptool\b/.test(location.search) && typeof ASSETS !== "undefined") ASSETS.on(() => { if (!document.getElementById("griptool")) setTimeout(tool, 300); }); } catch { /* fine */ }
  return { TABLE, of, detect, tool };
})();
if (typeof module !== "undefined") module.exports = GRIPDATA;
