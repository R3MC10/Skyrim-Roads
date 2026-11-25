/* RIGLOOK: makes the painted fighters sit in the painted fight scene instead of on top of it. [OURS]
   The painted body parts (rig.js) and the painted foes are sharper and cleaner than the painted backdrops, so:
   - soft: each part is softened a little at the size it is drawn (a gentle downsample, the sharp part laid back over
     it at part strength, so the silhouette stays clean but the photo-sharp detail goes);
   - grade: each fight scene has its own light (a cold snow pass, a warm torch-lit cave, a dim barrow...): the parts
     get that scene's colour (multiply), lose a little colour (grey), pick up its haze, and a faint rim of the scene's
     ambient light on their back edges;
   - shadow: a soft contact shadow under each boot and a faint one under the body, in the scene's shadow colour.
   Everything is baked once per scene into small cached pictures (rig.js keeps them per part, size and scene), so a
   phone draws the same number of pictures per frame as before.

     RIGLOOK.scene(id)      → the scene the next fighters are drawn in (fightart.js sets it, null for no scene)
     RIGLOOK.key()          → the current grade's cache key ("-" none)
     RIGLOOK.bake(src, o)   → a softened, graded copy of a part picture (canvas); o: { soft, rim }
     RIGLOOK.graded(img)    → a graded copy of a painted foe for the current scene (cached), or img
     RIGLOOK.shadow(g, x, y, rx, ry, a) → a soft ground shadow (ellipse) in the scene's shadow colour */
const RIGLOOK = (() => {
  /* mul: multiplied over the parts (close to white = gentle); sat: how much colour goes (0..1); haze: [colour, alpha]
     screened over (the scene's air); rim: [colour, alpha] on the back edges; sh: [r,g,b] of the shadows, sa: their strength */
  const GRADES = {
    none: { mul: null, sat: 0.06, haze: null, rim: null, sh: [18, 14, 10], sa: 0.5 },
    town: { mul: "#ece3d6", sat: 0.12, haze: ["#7d8794", 0.05], rim: ["#dfe6ee", 0.26], sh: [20, 18, 18], sa: 0.5 },
    tundra: { mul: "#e9e7df", sat: 0.14, haze: ["#9aa3a6", 0.06], rim: ["#e4e9ea", 0.26], sh: [22, 22, 22], sa: 0.46 },
    snow: { mul: "#dbe3ee", sat: 0.2, haze: ["#8ea5be", 0.08], rim: ["#d8e8fa", 0.34], sh: [24, 34, 52], sa: 0.42 },
    forest: { mul: "#dde3d3", sat: 0.16, haze: ["#6f8c82", 0.06], rim: ["#cfe6d6", 0.24], sh: [14, 20, 16], sa: 0.5 },
    autumn: { mul: "#efe0c8", sat: 0.1, haze: ["#a07e52", 0.05], rim: ["#ffdca6", 0.26], sh: [26, 16, 8], sa: 0.48 },
    marsh: { mul: "#d8dcc8", sat: 0.2, haze: ["#748066", 0.08], rim: ["#d2dfb4", 0.22], sh: [16, 20, 14], sa: 0.48 },
    ash: { mul: "#e2d2c2", sat: 0.2, haze: ["#5e5048", 0.06], rim: ["#ffa266", 0.28], sh: [18, 12, 10], sa: 0.52 },
    rocky: { mul: "#e6e2da", sat: 0.14, haze: ["#8f9194", 0.05], rim: ["#e6e6e4", 0.24], sh: [20, 20, 22], sa: 0.48 },
    arena: { mul: "#efe4d0", sat: 0.08, haze: ["#8a7a66", 0.04], rim: ["#ffe2b4", 0.24], sh: [24, 16, 10], sa: 0.5 },
    giantcamp: { mul: "#e9e4da", sat: 0.14, haze: ["#9a9c98", 0.05], rim: ["#e8e6e0", 0.24], sh: [22, 20, 18], sa: 0.48 },
    cave: { mul: "#bcae98", sat: 0.18, haze: ["#3a2c22", 0.04], rim: ["#ffb072", 0.36], sh: [10, 6, 4], sa: 0.6 },
    mine: { mul: "#c2b096", sat: 0.16, haze: ["#3e2e22", 0.04], rim: ["#ffb06a", 0.36], sh: [10, 6, 4], sa: 0.6 },
    banditcamp: { mul: "#cdbca2", sat: 0.14, haze: ["#4a3a2c", 0.04], rim: ["#ffbc7c", 0.32], sh: [12, 8, 6], sa: 0.56 },
    forsworn: { mul: "#c4b9a2", sat: 0.18, haze: ["#40382c", 0.04], rim: ["#ffb87a", 0.3], sh: [12, 8, 6], sa: 0.56 },
    lair: { mul: "#c4b4a0", sat: 0.18, haze: ["#3e302a", 0.04], rim: ["#ffaa66", 0.32], sh: [12, 8, 6], sa: 0.58 },
    vampire: { mul: "#b4aab4", sat: 0.24, haze: ["#2e2230", 0.05], rim: ["#d07888", 0.3], sh: [10, 6, 10], sa: 0.6 },
    barrow: { mul: "#b0b6b4", sat: 0.24, haze: ["#2a3434", 0.05], rim: ["#a6d2d8", 0.32], sh: [6, 10, 12], sa: 0.62 },
    temple: { mul: "#c2c0b8", sat: 0.2, haze: ["#3c3c38", 0.04], rim: ["#d8e2e6", 0.28], sh: [10, 10, 12], sa: 0.58 },
    fort: { mul: "#d2cec4", sat: 0.16, haze: ["#5a5a58", 0.04], rim: ["#e0e4e6", 0.26], sh: [14, 14, 16], sa: 0.54 },
    thalmor: { mul: "#cfcbc0", sat: 0.16, haze: ["#54524e", 0.04], rim: ["#f0e6c8", 0.26], sh: [14, 12, 12], sa: 0.54 },
    dwemer: { mul: "#d2b896", sat: 0.12, haze: ["#4a3218", 0.05], rim: ["#ffc477", 0.34], sh: [14, 8, 4], sa: 0.58 },
  };
  const BY_KIND = { cave: "cave", ruin: "barrow", dwemer: "dwemer", snow: "snow", forest: "forest", autumn: "autumn", marsh: "marsh", ash: "ash", rocky: "rocky", tundra: "tundra", camp: "giantcamp", arena: "arena" };
  function gradeOf(id) {
    if (!id) return null;
    if (GRADES[id]) return GRADES[id];
    const d = typeof BSCENE_DATA !== "undefined" ? BSCENE_DATA.scenes[id] : null;
    return d && BY_KIND[d.scene] ? GRADES[BY_KIND[d.scene]] : null;
  }
  let cur = null, curG = GRADES.none;
  function scene(id) { const G = gradeOf(id); cur = G ? id : null; curG = G || GRADES.none; }
  const key = () => cur || "-";

  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const dims = (s) => [s.width || s.naturalWidth || 0, s.height || s.naturalHeight || 0];
  /* the softened, graded copy (same size as src). soft: soften (parts are cached at 1.15-2.3x their drawn size, so a
     0.6x downsample is well under a screen pixel of blur); rim: the rim width in pixels of src (0: no rim) */
  function bake(src, o = {}, G = curG) {
    const [w, h] = dims(src); if (!w || !h || typeof document === "undefined") return src;
    const c = mk(w, h), x = c.getContext("2d"); if (!x) return src;
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
    if (o.soft && w > 12 && h > 12) {
      const t = mk(w * 0.6, h * 0.6), tx = t.getContext("2d"); tx.imageSmoothingQuality = "high"; tx.drawImage(src, 0, 0, t.width, t.height);
      x.drawImage(t, 0, 0, w, h); x.globalAlpha = 0.42; x.drawImage(src, 0, 0); x.globalAlpha = 1;
    } else x.drawImage(src, 0, 0, w, h);
    if (!G.mul && !G.sat && !G.haze && !(G.rim && o.rim)) return c;
    const m = mk(w, h), mx = m.getContext("2d"); mx.drawImage(c, 0, 0);   // the shape, to keep the fills inside it
    if (G.sat) { x.globalCompositeOperation = "saturation"; x.globalAlpha = G.sat * 0.6; x.fillStyle = "#808080"; x.fillRect(0, 0, w, h); }
    if (G.mul) { x.globalCompositeOperation = "multiply"; x.globalAlpha = 1; x.fillStyle = G.mul; x.fillRect(0, 0, w, h); }
    if (G.haze) { x.globalCompositeOperation = "screen"; x.globalAlpha = G.haze[1] * 0.5; x.fillStyle = G.haze[0]; x.fillRect(0, 0, w, h); }
    if (G.rim && o.rim > 0) {   // the back (left) edges: where the shape is, but not once it is moved right by the rim width
      const r = mk(w, h), rx = r.getContext("2d"), d = Math.max(1, o.rim);
      rx.drawImage(m, 0, 0); rx.globalCompositeOperation = "destination-out"; rx.drawImage(m, d, d * 0.35); rx.drawImage(m, d * 0.5, 0);
      rx.globalCompositeOperation = "source-in"; rx.fillStyle = G.rim[0]; rx.fillRect(0, 0, w, h);
      x.globalCompositeOperation = "screen"; x.globalAlpha = G.rim[1]; x.drawImage(r, 0, 0);
    }
    x.globalCompositeOperation = "destination-in"; x.globalAlpha = 1; x.drawImage(m, 0, 0);
    x.globalCompositeOperation = "source-over";
    return c;
  }
  /* a painted foe in the scene's light: a graded copy, made once per picture and scene (no softening: these are
     big pictures drawn small, the downscale already softens them) */
  const FOES = new WeakMap();
  function graded(img) {
    if (!img || !cur || typeof document === "undefined") return img;
    const [w0, h0] = dims(img); if (!w0 || !h0) return img;
    let byScene = FOES.get(img); if (!byScene) { byScene = new Map(); FOES.set(img, byScene); }
    let c = byScene.get(cur);
    if (!c) {
      try {
        const h = Math.min(h0, 1024), w = Math.round(w0 * h / h0), s = mk(w, h), sx = s.getContext("2d"); sx.imageSmoothingQuality = "high"; sx.drawImage(img, 0, 0, w, h);
        c = bake(s, { rim: Math.max(1.5, h / 260) });
        c.naturalWidth = w; c.naturalHeight = h;   // drawn where a picture is expected
      } catch (e) { c = img; }
      byScene.set(cur, c);
    }
    return c;
  }
  /* a soft round shadow sprite (black, alpha from the centre out), tinted per scene */
  const SPR = new Map();
  function sprite(rgb) {
    const k = rgb.join(","); let c = SPR.get(k); if (c) return c;
    c = mk(64, 64); const x = c.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${k},1)`); gr.addColorStop(0.45, `rgba(${k},0.7)`); gr.addColorStop(1, `rgba(${k},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); SPR.set(k, c); return c;
  }
  function shadow(g, x, y, rx, ry, a) {
    if (typeof document === "undefined" || !(a > 0.005) || !(rx > 0) || !(ry > 0)) return;
    const s = sprite(curG.sh); g.save(); g.globalAlpha *= Math.min(1, a * curG.sa * 2); g.drawImage(s, x - rx, y - ry, rx * 2, ry * 2); g.restore();
  }
  return { GRADES, gradeOf, scene, key, get current() { return cur; }, bake, graded, shadow };
})();
if (typeof module !== "undefined") module.exports = RIGLOOK;
