/* HORSEART: painted horses (horse-<coat>-<pose>.webp, see assets.js) instead of the drawn-by-code horse. [OURS]
   One place draws every horse picture: the fight (horseback.js), the rider sprite used by the travel strip and the
   map hero (figart.js), and the stable card (uiart.js). When a picture is missing or not loaded yet, every caller keeps
   its own procedural horse, so nothing breaks without the files.

   Pictures: side view facing right, saddled, no rider, hooves on the bottom edge (trimmed, ~1024 px).
     poses: stand · gallop · rear · down (knocked down, lying, head right)
     coats: HORSES.COATS ids (bay chestnut black grey white palomino paint). A coat or pose that has no file of its own borrows
     the grey picture of that pose, tinted to the coat (ctx.filter); a pose that has no file at all borrows "stand".

   API: HORSEART.coatOf(colourOrId) → coat id · HORSEART.ok(coat, pose) → picture ready?
        HORSEART.ride(g, coat, pose, seatH, o)  draws the horse with its feet at y 0 and its saddle seat at (0, -seatH);
                                                o.bob lifts it, o.clip = "barrel" draws only the barrel under the saddle,
                                                o.anim = { gait: "stand" | "walk" | "gallop", c: 0..1 through the cycle } moves it (below)
        HORSEART.motion(gait, c) → { bob, pitch, kH, kF, head, tail, rider }: [mapheroanim] how the painted horse moves at
                                                this moment of its cycle. One picture per pose, so the horse is cut into
                                                pieces (body, head and neck, tail, hind legs, front legs) that move on
                                                their own: standing it breathes, shifts its weight, tosses its head now and
                                                then and flicks its tail; walking and galloping the legs swing (a skew of
                                                each leg strip, the hooves move, the tops stay on the body), the body bobs
                                                and rocks. rider = how far the saddle has lifted (fraction of the picture
                                                height, up), a little behind the body so the rider sits into each stride.
        HORSEART.lying(g, coat, w)              draws the downed horse w wide, centred on x 0, feet line at y 0
        HORSEART.icon(g, coat, size, down)      the stable-card picture inside a size×size square
        HORSEART.card(coat, w, pose) → an <img> of the whole horse w wide (stand by default; the stables coat preview and header portrait), "" until loaded
        HORSEART.sig() → changes whenever a horse picture arrives (put it in sprite cache keys) */
const HORSEART = (() => {
  const POSES = ["stand", "gallop", "rear", "down"];
  /* files in the game folder: add a pose here when its picture is dropped in */
  const HAVE = { grey: ["stand", "gallop", "rear", "down"], bay: ["stand"], black: ["stand", "gallop", "rear", "down"], chestnut: ["stand", "gallop", "rear", "down"] };
  /* where the saddle seat is (fraction of the trimmed picture) and the belly line under it, per picture */
  const META = {
    "grey-stand": { sx: 0.43, sy: 0.285, belly: 0.6, w: 1022, h: 1024 },
    "grey-gallop": { sx: 0.49, sy: 0.31, belly: 0.64, w: 1024, h: 682 },
    "grey-rear": { sx: 0.47, sy: 0.32, belly: 0.6, w: 939, h: 1024 },
    "grey-down": { sx: 0.46, sy: 0.2, belly: 0.85, w: 1024, h: 451 },
    "bay-stand": { sx: 0.455, sy: 0.31, belly: 0.6, w: 1024, h: 977 },
  };
  /* black and chestnut are repaints of the grey pictures on the same canvas, so they share its seat points */
  for (const c of ["black", "chestnut"]) for (const p of ["stand", "gallop", "rear", "down"]) META[`${c}-${p}`] = META[`grey-${p}`];
  /* how a grey picture is tinted for a coat that has no painting of its own */
  const TINT = {
    bay: "sepia(0.85) saturate(1.9) hue-rotate(-12deg) brightness(0.66) contrast(1.08)",
    chestnut: "sepia(0.9) saturate(2.2) hue-rotate(-18deg) brightness(0.78) contrast(1.06)",
    black: "brightness(0.36) contrast(1.25) saturate(0.5)",
    white: "brightness(1.32) contrast(0.88) saturate(0.4)",
    palomino: "sepia(0.9) saturate(1.35) hue-rotate(-6deg) brightness(0.98)",
    paint: "sepia(0.7) saturate(1.5) hue-rotate(-8deg) brightness(0.82)",
  };
  const IDS = ["bay", "chestnut", "black", "grey", "white", "palomino", "paint"];
  const coats = () => (typeof HORSES !== "undefined" && HORSES.COATS ? HORSES.COATS : []);
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  /* a coat id from a coat id or its colour (fights and map markers pass the colour); anything else picks one by name */
  function coatOf(c) {
    if (!c) return "bay";
    const s = String(c).toLowerCase();
    if (IDS.includes(s)) return s;
    const hit = coats().find((x) => String(x[2]).toLowerCase() === s);
    if (hit) return hit[0];
    if (s === "#6b4a2e" || s === "#7a5a3a") return "bay";   // the default brown the old drawings used
    return IDS[hash(s) % IDS.length];
  }
  /* which file stands in for coat+pose, and the tint it needs */
  function source(coat, pose) {
    if (!POSES.includes(pose)) pose = "stand";
    if (HAVE[coat]?.includes(pose)) return { key: `${coat}-${pose}`, tint: "" };
    if (HAVE.grey.includes(pose)) return { key: `grey-${pose}`, tint: coat === "grey" ? "" : TINT[coat] || "" };
    return source(coat, "stand");
  }
  const img = (key) => (typeof ASSETS !== "undefined" ? ASSETS.img("horse-" + key) : null);
  let filterOk = null;
  const canFilter = () => { if (filterOk === null) { try { const g = document.createElement("canvas").getContext("2d"); filterOk = !!g && "filter" in g; } catch { filterOk = false; } } return filterOk; };
  /* tinted, halved copies of each picture so a small horse is drawn from a picture near its size (no shimmer) */
  const MIPS = new Map();
  function mips(coat, pose) {
    const src = source(coat, pose), id = `${src.key}|${src.tint}`;
    if (MIPS.has(id)) return MIPS.get(id);
    const im = img(src.key); if (!im || !im.naturalWidth) return null;
    let base = im;
    if (src.tint && canFilter()) {
      try { const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext("2d"); g.filter = src.tint; g.drawImage(im, 0, 0); g.filter = "none"; base = c; } catch { base = im; }
    }
    const list = [base];
    let cur = base, w = im.naturalWidth, h = im.naturalHeight;
    while (Math.max(w, h) > 48) {
      w = Math.max(1, Math.round(w / 2)); h = Math.max(1, Math.round(h / 2));
      try { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(cur, 0, 0, w, h); list.push(c); cur = c; } catch { break; }
    }
    const rec = { list, meta: META[src.key] || { sx: 0.45, sy: 0.3, belly: 0.6 }, w: im.naturalWidth, h: im.naturalHeight };
    MIPS.set(id, rec);
    return rec;
  }
  /* the smallest copy that is still at least as big as it will be drawn */
  function pick(rec, px) { let best = rec.list[0]; for (const c of rec.list) { if (c.height >= px) best = c; else break; } return best; }
  function devScale(g) { try { const t = g.getTransform(); const s = Math.hypot(t.a, t.b); return isFinite(s) && s > 0 ? s : 1; } catch { return 1; } }
  const ok = (coat, pose = "stand") => { const s = source(coatOf(coat), pose); return !!img(s.key); };
  let seen = 0;
  const sig = () => { let n = 0; for (const [c, ps] of Object.entries(HAVE)) for (const p of ps) if (img(`${c}-${p}`)) n++; if (n !== seen) { seen = n; MIPS.clear(); } return n; };
  /* [mapheroanim] where to cut each pose's picture (fractions of the picture): legs below legY, hind | front at split,
     the tail left of tailX (down to tailY), the head and upper neck right of neckX above neckY (it turns about that corner) */
  const CUTS = {
    stand: { legY: 0.6, split: 0.5, tailX: 0.16, tailY: 1, tp: [0.15, 0.33], neckX: 0.66, neckY: 0.36 },
    gallop: { legY: 0.6, split: 0.5, tailX: 0.26, tailY: 0.6, tp: [0.27, 0.32], neckX: 0.8, neckY: 0.4 },
  };
  const TAU = Math.PI * 2;
  function motion(gait, c) {
    c = (((c || 0) % 1) + 1) % 1;
    const sn = Math.sin;
    if (gait === "stand") {   // one long idle loop (the map plays it over ~6 s): breathing, a weight shift, a toss, a flick
      const toss = c > 0.55 && c < 0.75 ? sn(((c - 0.55) / 0.2) * Math.PI) : 0;
      const fu = c > 0.12 && c < 0.32 ? (c - 0.12) / 0.2 : -1, flick = fu >= 0 ? sn(fu * TAU * 1.5) * (1 - fu) : 0;
      const shift = c > 0.8 ? sn(((c - 0.8) / 0.2) * Math.PI) : 0, bob = 0.005 * sn(c * TAU * 3);
      return { bob, pitch: -0.01 * shift, kH: -0.06 * shift, kF: 0, head: -0.2 * toss + 0.03 * sn(c * TAU * 3 + 0.8), tail: 0.05 * sn(c * TAU * 2) + 0.22 * flick, rider: 0.005 * sn(c * TAU * 3 - 0.5) };
    }
    if (gait === "walk") {   // four beats: hind, then the front on the same side a quarter later; two bobs a stride
      return { bob: 0.012 * sn(c * TAU * 2), pitch: 0.018 * sn(c * TAU), kH: 0.26 * sn(c * TAU), kF: 0.26 * sn(c * TAU - Math.PI / 2),
        head: 0.06 * sn(c * TAU * 2 + 1), tail: 0.08 * sn(c * TAU + 0.5), rider: 0.012 * sn(c * TAU * 2 - 0.9) };
    }
    // the gallop: a rocking body (hinds push, the front lifts), legs reaching and folding
    return { bob: 0.035 * sn(c * TAU), pitch: 0.06 * sn(c * TAU + 1.2), kH: 0.4 * sn(c * TAU), kF: 0.4 * sn(c * TAU - 2.2),
      head: 0.08 * sn(c * TAU + 0.6), tail: 0.16 * sn(c * TAU + 2.4), rider: 0.03 * sn(c * TAU - 1) };
  }
  /* the picture in moving pieces (see motion); x0, y0, W, H = where the whole picture goes */
  function pieces(g, c, x0, y0, W, H, cut, M) {
    const X = (f) => x0 + f * W, Y = (f) => y0 + f * H, pad = 0.04, by = M.bob * H, px = X(0.5), py = Y(cut.legY);
    const body = () => { g.translate(0, -by); g.translate(px, py); g.rotate(-M.pitch); g.translate(-px, -py); };
    const turn = (fx, fy, a) => { g.translate(X(fx), Y(fy)); g.rotate(a); g.translate(-X(fx), -Y(fy)); };
    const put = (rects) => { g.beginPath(); for (const r of rects) g.rect(X(r[0]), Y(r[1]), (r[2] - r[0]) * W, (r[3] - r[1]) * H); g.clip(); g.drawImage(c, x0, y0, W, H); };
    // the tail, behind everything
    g.save(); body(); turn(cut.tp[0], cut.tp[1], M.tail); put([[-pad, -pad, cut.tailX + 0.04, cut.tailY + (cut.tailY >= 1 ? pad : 0)]]); g.restore();   // a bit under the body, so no gap opens when it swings
    // the body (and the chest under the head)
    g.save(); body(); put([[cut.tailX, -pad, cut.neckX, cut.legY + 0.01], [cut.neckX, cut.neckY, 1 + pad, cut.legY + 0.01]]); g.restore();
    // the legs: the tops follow the body, the hooves swing (a skew of the strip)
    const yT = cut.legY - 0.03, Hb = Y(1);
    for (const [a, b, k] of [[cut.tailY >= 1 ? cut.tailX : -pad, cut.split + 0.02, M.kH], [cut.split - 0.02, 1 + pad, M.kF]]) {   // the strips overlap a little
      const dx = (X((a + b) / 2) - px), dyTop = -by - dx * M.pitch, top = Y(yT), sy = (Hb - top - dyTop) / Math.max(1e-6, Hb - top);
      g.save(); g.translate(0, Hb); g.scale(1, sy); g.translate(0, -Hb); g.transform(1, 0, k, 1, -k * top, 0);
      put([[a, yT, b, 1 + pad]]); g.restore();
    }
    // the head and upper neck, turning about the base of the neck
    g.save(); body(); turn(cut.neckX, cut.neckY, M.head); put([[cut.neckX - 0.035, -pad, 1 + pad, cut.neckY + 0.02]]); g.restore();   // over the body's edge, so the cut never shows
  }
  /* the horse with its feet on y 0 and the saddle seat at (0, -seatH) */
  function ride(g, coat, pose, seatH, o = {}) {
    const rec = mips(coatOf(coat), pose); if (!rec) return false;
    const m = rec.meta, H = seatH / (1 - m.sy), W = H * rec.w / rec.h, x0 = -m.sx * W, y0 = -H - (o.bob || 0);
    const c = pick(rec, H * devScale(g));
    if (o.anim && !o.clip && CUTS[pose]) { g.save(); pieces(g, c, x0, y0, W, H, CUTS[pose], motion(o.anim.gait, o.anim.c)); g.restore(); return true; }
    g.save();
    if (o.clip === "barrel") {   // just the barrel and saddle flaps under the seat, over the rider's legs
      g.beginPath(); g.rect(x0 + (m.sx - 0.17) * W, y0 + (m.sy + 0.04) * H, 0.36 * W, (m.belly - m.sy - 0.04) * H); g.clip();
    }
    g.drawImage(c, x0, y0, W, H);
    g.restore();
    return true;
  }
  function lying(g, coat, w) {
    const rec = mips(coatOf(coat), "down"); if (!rec) return false;
    const h = w * rec.h / rec.w, c = pick(rec, h * devScale(g));
    g.drawImage(c, -w / 2, -h, w, h);
    return true;
  }
  /* the stable card: the head and shoulders standing, or the whole horse lying down */
  function icon(g, coat, size, down) {
    const rec = mips(coatOf(coat), down ? "down" : "stand"); if (!rec) return false;
    const ds = devScale(g);
    if (down) { const h = size * rec.h / rec.w, c = pick(rec, h * ds); g.drawImage(c, 0, size - h - size * 0.06, size, h); return true; }
    const c = pick(rec, (size / 0.46) * ds), cw = c.width, sw = cw * 0.46, sh = Math.min(c.height, sw);   // a square from the top right: ears, head and chest
    g.drawImage(c, cw - sw, 0, sw, sh, 0, 0, size, size);
    return true;
  }
  /* the whole standing horse, for the coat picker at the stables */
  function card(coat, w = 120, pose = "stand") {
    if (typeof ART === "undefined") return "";
    if (!POSES.includes(pose)) pose = "stand";
    const id = coatOf(coat), rec = mips(id, pose);
    if (!rec) return typeof ASSETS === "undefined" || ASSETS.state("horse-" + source(id, pose).key) !== "loading" ? "" : `<span class="hcoatpic hcoatwait" data-coat="${id}" data-w="${w}" data-pose="${pose}"></span>`;   // filled in when the picture arrives
    const h = Math.round(w * rec.h / rec.w);
    return ART.html(w, h, (g) => { g.drawImage(pick(rec, h * devScale(g)), 0, 0, w, h); }, { key: `hcard:${id}:${pose}:${w}:${sig()}`, cls: "hcoatpic", alt: id });
  }
  const fill = () => { if (typeof document === "undefined") return; for (const el of document.querySelectorAll(".hcoatwait")) { const h = card(el.dataset.coat, +el.dataset.w || 120, el.dataset.pose || "stand"); if (h && !/hcoatwait/.test(h)) el.outerHTML = h; } };
  if (typeof ASSETS !== "undefined" && ASSETS.on) ASSETS.on(() => { sig(); fill(); });
  return { POSES, HAVE, META, TINT, CUTS, coatOf, source, ok, sig, ride, motion, lying, icon, card };
})();
