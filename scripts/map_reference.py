"""Clean reference render of the world map, for repainting it by hand (or in ChatGPT).

Draws the map's terrain with the game's own code (world.js + terrain.js + map.js, WorldMap.paintBase) with no labels,
icons, fog, compass, frame, UI or player marker, and saves:
  art_gpt/map_reference.png         terrain + regions + roads, exactly the world bounds
  art_gpt/map_reference_marked.png  the same with dots and names for the cities and towns (alignment check)
  art_gpt/map_reference_noroads.png the same without roads (roads can stay a toggle drawn over the painting)

World → pixel: the world map is 0..1 across and 0..1 down (map units 1000×700, aspect 10:7). The image covers it
edge to edge, so  px = x * WIDTH,  py = y * HEIGHT  (WIDTH = 1000 * scale, HEIGHT = 700 * scale).

Usage: python scripts/map_reference.py [--out DIR] [--width 1540]
"""
import argparse, base64, json, os, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
GAME = ROOT / "game"

PAGE = """<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000">
<script src="{g}/world.js"></script><script src="{g}/terrain.js"></script><script src="{g}/map.js"></script>
<script>
window.render = (scale) => {{
  const out = {{}};
  const plain = WorldMap.paintBase({{ scale, labels: false, compass: false, frame: false }});
  out.ref = plain.toDataURL("image/png");
  out.noroads = WorldMap.paintBase({{ scale, labels: false, compass: false, frame: false, roads: false }}).toDataURL("image/png");
  const c = document.createElement("canvas"); c.width = plain.width; c.height = plain.height;
  const g = c.getContext("2d"); g.drawImage(plain, 0, 0);
  const towns = Object.entries(WORLD.places).filter(([n, p]) => (p[2] === "city" || p[2] === "town") && p[1] <= 1);
  g.font = "bold " + Math.round(13 * scale / 1.54) + "px Georgia, serif"; g.textBaseline = "middle";
  for (const [n, [x, y, kind]] of towns) {{
    const px = x * c.width, py = y * c.height, r = kind === "city" ? 5 : 3.5;
    g.fillStyle = kind === "city" ? "#ff2a2a" : "#ffd21a"; g.strokeStyle = "#000"; g.lineWidth = 1.5;
    g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); g.stroke();
    g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.85)"; g.fillStyle = "#fff"; g.strokeText(n, px + r + 3, py); g.fillText(n, px + r + 3, py);
  }}
  out.marked = c.toDataURL("image/png");
  out.towns = towns.map(([n, [x, y, kind]]) => [n, kind, x, y, Math.round(x * c.width), Math.round(y * c.height)]);
  out.w = c.width; out.h = c.height;
  return out;
}};
</script>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "art_gpt"))
    ap.add_argument("--width", type=int, default=1540, help="image width; height = width * 0.7 (use a multiple of 10)")
    a = ap.parse_args()
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    scale = a.width / 1000
    html = out / "_map_reference.html"
    html.write_text(PAGE.format(g=GAME.as_uri()), encoding="utf-8")
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=["--allow-file-access-from-files"])
            pg = b.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(html.as_uri())
            pg.wait_for_function("typeof WorldMap !== 'undefined'", timeout=60000)
            r = pg.evaluate(f"render({scale})")
            b.close()
            if errs: print("page errors:", errs, file=sys.stderr)
    finally:
        html.unlink(missing_ok=True)
    for key, name in (("ref", "map_reference.png"), ("marked", "map_reference_marked.png"), ("noroads", "map_reference_noroads.png")):
        (out / name).write_bytes(base64.b64decode(r[key].split(",", 1)[1]))
    (out / "map_reference_towns.json").write_text(json.dumps({"width": r["w"], "height": r["h"], "mapping": "px = x * width, py = y * height (x, y are WORLD 0..1)",
                                                             "towns": r["towns"]}, indent=1), encoding="utf-8")
    w, h = r["w"], r["h"]
    wr = next((t for t in r["towns"] if t[0] == "Whiterun"), None)
    (out / "MAP_REFERENCE.txt").write_text(f"""World map reference renders (scripts/map_reference.py)

Files ({w} x {h} px PNG, exact 10:7 world bounds edge to edge; no labels, icons, fog, compass, frame, UI or player):
  {out / 'map_reference.png'}          terrain, sea, lakes, rivers, mountains, forests, snow, marsh, ash, hold borders, Skyrim border, roads
  {out / 'map_reference_noroads.png'}  the same without roads and bridges (the game can draw roads on top as a toggle)
  {out / 'map_reference_marked.png'}   map_reference.png + red dots (cities) / yellow dots (towns) with names
  {out / 'map_reference_towns.json'}   every marked town: world x,y and pixel x,y

World to pixel (world = WORLD coords 0..1 across, 0..1 down; game map units 1000 x 700):
  px = x * {w}    py = y * {h}    ({scale:g} px per map unit; pixel (0,0) = world (0,0) top-left, ({w},{h}) = world (1,1))
  e.g. Whiterun ({wr[2]}, {wr[3]}) -> ({wr[4]}, {wr[5]})
  Any other size works if it keeps 10:7 and covers the same bounds: px = x * width, py = y * height.

Where the final painting goes (assets.js key "map-world"):
  game/map-world.webp (or .png / .jpg): exact 10:7, recommended 2000 x 1400 (1540 x 1078 is fine too), WebP quality ~82
  optional game/map-world-2x.webp: 3000 x 2100, used only when zoomed in (zoom >= 2)
  The picture is stretched over the full world bounds, so it must cover exactly the area of map_reference.png (no crop, no padding).
  Without roads painted in, players can switch the game's roads on (Map: Roads toggle).
""", encoding="utf-8")
    print(f"saved {w}x{h} to {out}")


if __name__ == "__main__":
    main()
