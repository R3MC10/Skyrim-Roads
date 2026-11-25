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
                                                o.bob lifts it, o.clip = "barrel" draws only the barrel under the saddle
        HORSEART.lying(g, coat, w)              draws the downed horse w wide, centred on x 0, feet line at y 0
        HORSEART.icon(g, coat, size, down)      the stable-card picture inside a size×size square
        HORSEART.card(coat, w) → an <img> of the whole standing horse w wide (the stables coat preview), "" until loaded
        HORSEART.sig() → changes whenever a horse picture arrives (put it in sprite cache keys) */
const HORSEART = (() => {
  const POSES = ["stand", "gallop", "rear", "down"];
  /* files in the game folder: add a pose here when its picture is dropped in */
  const HAVE = { grey: ["stand", "gallop", "rear", "down"], bay: ["stand"], black: ["stand", "gallop", "down"], chestnut: ["stand", "gallop", "down"] };
  /* where the saddle seat is (fraction of the trimmed picture) and the belly line under it, per picture */
  const META = {
    "grey-stand": { sx: 0.43, sy: 0.285, belly: 0.6, w: 1022, h: 1024 },
    "grey-gallop": { sx: 0.49, sy: 0.31, belly: 0.64, w: 1024, h: 682 },
    "grey-rear": { sx: 0.47, sy: 0.32, belly: 0.6, w: 939, h: 1024 },
    "grey-down": { sx: 0.46, sy: 0.2, belly: 0.85, w: 1024, h: 451 },
    "bay-stand": { sx: 0.455, sy: 0.31, belly: 0.6, w: 1024, h: 977 },
  };
  /* black and chestnut are repaints of the grey pictures on the same canvas, so they share its seat points */
  for (const c of ["black", "chestnut"]) for (const p of ["stand", "gallop", "down"]) META[`${c}-${p}`] = META[`grey-${p}`];
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
  /* the horse with its feet on y 0 and the saddle seat at (0, -seatH) */
  function ride(g, coat, pose, seatH, o = {}) {
    const rec = mips(coatOf(coat), pose); if (!rec) return false;
    const m = rec.meta, H = seatH / (1 - m.sy), W = H * rec.w / rec.h, x0 = -m.sx * W, y0 = -H - (o.bob || 0);
    const c = pick(rec, H * devScale(g));
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
  function card(coat, w = 120) {
    if (typeof ART === "undefined") return "";
    const id = coatOf(coat), rec = mips(id, "stand");
    if (!rec) return typeof ASSETS === "undefined" || ASSETS.state("horse-" + source(id, "stand").key) !== "loading" ? "" : `<span class="hcoatpic hcoatwait" data-coat="${id}" data-w="${w}"></span>`;   // filled in when the picture arrives
    const h = Math.round(w * rec.h / rec.w);
    return ART.html(w, h, (g) => { g.drawImage(pick(rec, h * devScale(g)), 0, 0, w, h); }, { key: `hcard:${id}:${w}:${sig()}`, cls: "hcoatpic", alt: id });
  }
  const fill = () => { if (typeof document === "undefined") return; for (const el of document.querySelectorAll(".hcoatwait")) { const h = card(el.dataset.coat, +el.dataset.w || 120); if (h && !/hcoatwait/.test(h)) el.outerHTML = h; } };
  if (typeof ASSETS !== "undefined" && ASSETS.on) ASSETS.on(() => { sig(); fill(); });
  return { POSES, HAVE, META, TINT, coatOf, source, ok, sig, ride, lying, icon, card };
})();
