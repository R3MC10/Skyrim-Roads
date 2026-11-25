/* paintedmap.js: a hand-painted world map as the base of the map screen. [OURS]
   Drop game/map-world.webp (or .png/.jpg; ASSETS key "map-world") and map.js draws it instead of the procedural ground.
   The picture covers the world bounds edge to edge at exactly 10:7 (recommended 2000×1400): world point (x, y) in 0..1
   sits at pixel (x·width, y·height), the same as scripts/map_reference.py's reference render. Everything else (roads if
   switched on, hold names, compass, fog, cone of sight, lighting, weather, icons, labels, markers) is drawn on top.
   An optional map-world-2x (3000×2100) is asked for the first time you zoom in to 2× or more; once it has arrived it is
   used at every zoom (only asked for when map-world itself is in), so only one big picture is drawn (and kept decoded) at a time. No file, a picture of the wrong shape,
   or Solstheim: the procedural map, unchanged.
   Close up, maptiles.js draws an 8000 px tile pyramid of the same painting on top (mapt-* files), so it stays sharp.
   Settings → Graphics → Roads on the map (prefs key "mapRoads", default on; shown only when a painting is in). */
const PAINTEDMAP = (() => {
  const W = 1000, H = 700, ASPECT = W / H, KEY = "map-world", KEY2 = "map-world-2x", ZOOM_2X = 2;
  const A = () => (typeof ASSETS !== "undefined" ? ASSETS : null);
  const fits = (im) => !!im && im.naturalWidth > 0 && Math.abs(im.naturalWidth / im.naturalHeight - ASPECT) < 0.01;
  let want2x = false, warned = false;
  function shapeOk(im, key) {
    if (fits(im)) return true;
    if (im && !warned) { warned = true; console.warn(`${key}: ${im.naturalWidth}×${im.naturalHeight} is not 10:7, keeping the drawn map`); }
    return false;
  }
  /* the picture to draw as the map's ground at this zoom, or null (draw the procedural map) */
  function image(zoom = 1) {
    const a = A(); if (!a) return null;
    const im = a.img(KEY);
    if (!im || !shapeOk(im, KEY)) return null;   // no painting: no 2× either
    if (zoom >= ZOOM_2X) want2x = true;
    if (want2x) { const hi = a.img(KEY2); if (hi && shapeOk(hi, KEY2)) return hi; }
    return im;
  }
  /* still waiting to hear whether there is a painting (the map shows plain sea meanwhile, not the procedural build) */
  const pending = () => { const a = A(); return !!a?.stateOf && a.stateOf(KEY) === "loading"; };
  const active = () => !!image(1);
  /* world (0..1) → pixel in the painting, and back: the whole mapping */
  const toPixel = (p, im) => [p[0] * im.naturalWidth, p[1] * im.naturalHeight];
  const toWorld = (px, im) => [px[0] / im.naturalWidth, px[1] / im.naturalHeight];

  // ---- Settings → Graphics → Roads on the map
  const PREFS = "rotn_prefs";
  function roads() { try { const v = JSON.parse(localStorage.getItem(PREFS) || "{}").mapRoads; return v === undefined ? true : String(v) !== "false"; } catch { return true; } }
  function setRoads(on) { try { const p = JSON.parse(localStorage.getItem(PREFS) || "{}"); p.mapRoads = !!on; localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* storage blocked */ } }
  const settingsHTML = (seg) => (active() ? `<div class="setrow"><span>Roads on the map</span>${seg("mapRoads", [[true, "On"], [false, "Off"]], roads())}</div>` : "");
  function pref(k, v) { if (k !== "mapRoads") return false; setRoads(String(v) !== "false"); return true; }

  return { KEY, KEY2, ZOOM_2X, W, H, image, pending, active, fits, toPixel, toWorld, roads, setRoads, settingsHTML, pref };
})();
if (typeof module !== "undefined") module.exports = PAINTEDMAP;
