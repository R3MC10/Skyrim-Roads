/* Painted battle scenes: hand-painted backdrops, props, lights and foreground strips behind every fight. [OURS]
   Data: bscdata.js (BSCENE_DATA, generated from the scene pack by scripts/import_battlescenes.py). Pictures: bs-<scene>,
   bsf-<strip>, bsp-<prop>.webp next to index.html, loaded through ASSETS (missing or not yet loaded → fightart.js keeps
   its own drawn background, so nothing changes without the pictures).
   - Which scene: an arena fight → the Windhelm Arena; inside a dungeon, camp or lair → its theme (Embershard Mine has
     its own scene, Bleak Falls Barrow uses the barrow...); anywhere else → the ground under you (snow pass, pine forest,
     autumn woods, marsh, ashlands, rocky highlands, tundra road). In a town or city, or on the road right outside one,
     the town street (guards, bounty hunters, brawls, festival duels).
   - Layers: the backdrop plate (far), the props in manifest order (far/middle), then fightart draws the fighters and
     effects, then the foreground strip (near), then the HUD on the screen. Each plane moves a little with the fight
     camera (parallax); a torch and its flame share a plane, so they stay together.
   - Motion: flames flicker, glows breathe, lanterns sway, banners and reeds move in the wind, steam rises. Off with
     reduced motion. Lights are drawn with screen blending.
   - The plate keeps the stage's ground line: it is drawn to the full stage height (floor at 80%, where fighters
     stand) and cropped evenly at the sides for the taller turn-by-turn stage. Time of day and weather tint the
     plate outdoors (skyart.js). A caravan or your cart is not drawn over the plate (a flat drawn wagon clashed with the
     painted town; it waits for a painted wagon prop) — the drawn background (fightart.js) still has it. */
const BSCENE = (() => {
  const DATA = typeof BSCENE_DATA !== "undefined" ? BSCENE_DATA : null;
  const SRC = DATA ? DATA.frames.source : { width: 1850, height: 850 }, RATIO = SRC.width / SRC.height;
  const has = (id) => !!(DATA && DATA.scenes[id]);
  const scene = (id) => (DATA ? DATA.scenes[id] || null : null);

  /* ---------------------------------------------------------------- which scene */
  /* the art for a fight: arena first, then the dungeon's theme, then the ground under you */
  function artOf(s, o = {}) {
    if (!DATA) return null;
    if (o.arena) return has(DATA.arena) ? DATA.arena : null;
    if (s && s.dungeon) {
      const th = s.dungeon.theme;
      if (has(th)) return th;
      return { camp: "giantcamp", ruin: "barrow", mine: "mine" }[th] || null;   // an unknown theme keeps the drawn background
    }
    return roadArt(s);
  }
  /* in a town or city, or on the road just outside one (within NEAR map px of its centre) */
  const NEAR = 22;
  function townAt(s) {
    if (!s || typeof WORLD === "undefined" || !WORLD.places) return false;
    const P = WORLD.places, isT = (n) => ["city", "town"].includes(P[n]?.[2]);
    if (s.location && isT(s.location)) return true;
    if (s.location || typeof s.x !== "number" || typeof s.y !== "number") return false;   // at a farm, fort, shrine...: not a town
    for (const n in P) if (isT(n) && Math.hypot((P[n][0] - s.x) * 1000, (P[n][1] - s.y) * 700) < NEAR) return true;
    return false;
  }
  function roadArt(s) {
    if (!DATA) return null;
    if (has("town") && townAt(s)) return "town";
    let name = "ROAD";
    try {
      if (s && typeof Terrain !== "undefined") { const T = Terrain.T, t = Terrain.typeAtPos([s.x, s.y]); name = Object.keys(T).find((k) => T[k] === t) || "ROAD"; }
    } catch (e) { /* no map yet */ }
    const id = DATA.terrain[name] || "tundra";
    return has(id) ? id : null;
  }
  /* the art for a named place (dungeon, camp, lair, or the arena) */
  function artOfPlace(name) {
    if (!DATA) return null;
    if (/arena/i.test(name || "")) return DATA.arena;
    let th = null; try { th = typeof DUNGEONS !== "undefined" ? DUNGEONS.info(name)?.theme : null; } catch (e) { /* not a dungeon */ }
    return th ? artOf({ dungeon: { theme: th } }) : null;
  }

  /* ---------------------------------------------------------------- pictures */
  const keys = (id) => { const sc = scene(id); return sc ? [sc.bg, sc.fg, ...new Set(sc.els.map((e) => e.k))] : []; };
  const img = (k) => (typeof ASSETS !== "undefined" ? ASSETS.img(k) : null);
  /* ask for every picture of a scene (cheap to repeat; ASSETS remembers) */
  function prefetch(id) { for (const k of keys(id)) img(k); }
  /* the scene when every picture of it has arrived, else null (fightart keeps drawing its own background meanwhile) */
  function ready(id) {
    const sc = scene(id); if (!sc) return null;
    for (const k of keys(id)) if (!img(k)) return null;
    return sc;
  }
  /* a picture of the scene is missing (or pictures are off): it will never be ready this session */
  function failed(id) {
    if (typeof ASSETS === "undefined" || !ASSETS.status) return true;
    const ks = new Set(keys(id)), st = new Map(ASSETS.status());
    for (const k of ks) if (st.get(k) === "none") return true;
    return false;
  }
  const animated = (id) => !!scene(id)?.els.some((e) => e.m);

  /* ---------------------------------------------------------------- drawing */
  /* a strip the width of the plate; where a camera shift opens a gap at an edge, the edge is mirrored into it */
  function strip(g, im, x, y, w, h, W) {
    g.drawImage(im, x, y, w, h);
    const gapL = x > 0 ? x : 0, gapR = x + w < W ? W - (x + w) : 0;
    for (const [gap, left] of [[gapL, true], [gapR, false]]) {
      if (gap <= 0) continue;
      const span = Math.max(1, Math.ceil((gap + 1) * im.width / w)), dest = span * w / im.width;
      g.save(); g.translate(left ? x : x + w, y); g.scale(-1, 1);
      g.drawImage(im, left ? 0 : im.width - span, 0, span, im.height, left ? 0 : -dest, 0, dest, h);
      g.restore();
    }
  }
  /* the plate is drawn to the stage height (ground line kept) and centred: the taller stage crops its sides */
  function frameOf(W, Hh) { const pw = Hh * RATIO; return { pw, left: (W - pw) / 2 }; }
  function element(g, e, im, t, left, pw, Hh) {
    const x = left + e.x * pw, y = e.y * Hh, ih = e.h * Hh, iw = e.w ? e.w * pw : ih * im.width / im.height;
    const swing = Math.sin(t * (e.m === "sway" ? 1.45 : 2.8) + e.x * 17);
    g.save();
    g.globalAlpha = e.o ?? 1;
    if (e.b) g.globalCompositeOperation = e.b === "screen" ? "screen" : e.b;
    g.translate(x, y);
    if (t > 0 && e.m) {
      if (e.m === "flicker") g.scale(1 + 0.095 * swing, 1 + 0.075 * Math.sin(t * 17 + e.x * 9));
      else if (e.m === "glow") g.globalAlpha *= 0.88 + 0.12 * swing;
      else if (e.m === "sway" || e.m === "wind") g.rotate(swing * (e.m === "sway" ? 0.078 : 0.049));
      else if (e.m === "steam") {
        const rise = (t * 0.22 + e.x) % 1;
        g.translate(swing * iw * 0.18, -rise * ih * 0.36); g.scale(0.8 + rise * 0.22, 0.8 + rise * 0.24);
        g.globalAlpha *= Math.sin(rise * Math.PI) ** 0.8;
      }   // "cart": the ore cart stays parked (rolling it is a demo in the pack's preview, not a fight thing)
    }
    g.drawImage(im, -e.a[0] * iw, -e.a[1] * ih, iw, ih);
    g.restore();
  }
  /* the ground band (the plate's lower 20%) is painted flat in some plates: a soft texture over it so it doesn't read
     as a plain block. Clods and stones get bigger toward the viewer, and the band darkens toward the bottom edge and
     the corners. Built once (1600x180, seeded), drawn stretched to the band; nothing at the ground line, so no seam. */
  let groundTex;
  function groundTexture() {
    if (groundTex !== undefined) return groundTex;
    groundTex = null;
    if (typeof document === "undefined") return null;
    try {
      const w = 1600, h = 180, cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const g = cv.getContext("2d"); if (!g) return null;
      let seed = 9137; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 900; i++) {
        const d = rnd() ** 0.8, y = 4 + d * (h - 4), x = rnd() * w, r = 3 + d * d * 26 + rnd() * 6 * (0.3 + d);
        const dark = rnd() < 0.62, a = (0.05 + rnd() * 0.08) * (0.35 + d * 0.65);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, dark ? `rgba(8,6,4,${a})` : `rgba(235,220,195,${a * 0.75})`); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(1, 0.42 + d * 0.2); g.translate(-x, -y);
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore();
      }
      const v = g.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(0.35, "rgba(0,0,0,0.06)"); v.addColorStop(1, "rgba(0,0,0,0.4)");
      g.fillStyle = v; g.fillRect(0, 0, w, h);
      for (const left of [true, false]) {
        const s = g.createLinearGradient(left ? 0 : w, 0, left ? w * 0.14 : w * 0.86, 0);
        s.addColorStop(0, "rgba(0,0,0,0.22)"); s.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = s; g.fillRect(0, h * 0.25, w, h * 0.75);
      }
      groundTex = cv;
    } catch (e) { groundTex = null; }
    return groundTex;
  }
  /* time of day and weather over an outdoor plate (cached per stage size) */
  const ovCache = new Map();
  function overlayFor(W, Hh, o) {
    if (!o.sky) return null;
    const k = `${W}|${Hh}|${o.sky.key}`;
    if (ovCache.has(k)) return ovCache.get(k);
    let cv = null;
    try {
      const draw = (g, H) => { if (typeof SKY !== "undefined") SKY.overlay(g, H, W, Hh, o.sky, { seed: "bscene", ground: Hh * 0.8, cover: false, weather: false, season: false }); };
      cv = typeof ART !== "undefined" && ART.canvas ? ART.canvas(W, Hh, draw) : null;
    } catch (e) { cv = null; }
    if (ovCache.size > 8) ovCache.delete(ovCache.keys().next().value);
    ovCache.set(k, cv);
    return cv;
  }
  /* behind the fighters: plate, light and weather, then every prop in manifest order. o: { W, Hh, t, sky, lay }
     [fightcam] o.lay: the fight camera's painter (fightcam.js layers): the plate is cut into rows that move at their own
     depth (sky least, the ground with the fighters), each prop moves with the row it stands on, the edges are mirrored */
  function back(g, sc, o) {
    const { W, Hh } = o, { pw, left } = frameOf(W, Hh), t = o.t || 0, L = o.lay || null, bg = img(sc.bg);
    if (L) L.paint(bg, 0, 0, bg.width, bg.height, left, 0, pw, Hh, { top: true }); else strip(g, bg, left, 0, pw, Hh, W);
    const gt = groundTexture(), gy = Hh * DATA.frames.groundY;
    if (gt) { if (L) L.paint(gt, 0, 0, gt.width, gt.height, left, gy, pw, Hh - gy, { bottom: true }); else strip(g, gt, left, gy, pw, Hh - gy, W); }
    const ov = overlayFor(W, Hh, o);
    if (ov) { if (L) { L.set(1); const m = W * 0.08; g.drawImage(ov, -m, -m, W + 2 * m, Hh + 2 * m); } else g.drawImage(ov, 0, 0, W, Hh); }   // a soft tint: a little larger, so a tilt never shows its edge
    for (const e of sc.els) { const im = img(e.k); if (!im) continue; if (L) L.set(L.pOf(Math.min(1, e.y))); element(g, e, im, t, left, pw, Hh); }
  }
  /* in front of the fighters: the near-edge strip along the bottom (with the camera: it moves a little more than they do) */
  function front(g, sc, o) {
    const { W, Hh } = o, { pw, left } = frameOf(W, Hh), h = sc.fgH * Hh, im = img(sc.fg), L = o.lay || null;
    if (!im) return;
    if (L) L.paint(im, 0, 0, im.width, im.height, left, Hh - h, pw, h, { p: L.near || 1.15, bottom: true }); else strip(g, im, left, Hh - h, pw, h, W);
  }

  /* ---------------------------------------------------------------- for tests and tools */
  const list = () => (DATA ? Object.keys(DATA.scenes) : []);
  return { DATA, artOf, roadArt, townAt, artOfPlace, keys, prefetch, ready, failed, animated, back, front, frameOf, list, has };
})();
if (typeof module !== "undefined") module.exports = BSCENE;
