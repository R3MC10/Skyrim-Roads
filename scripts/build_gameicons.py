"""Packs the icon outlines made by build_gameicons.mjs into game/font-gameicons.woff2 (fontTools + brotli).
   py scripts/build_gameicons.py outlines.json game/font-gameicons.woff2   (normally run by the .mjs script)"""
import json
import sys

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

src, out = sys.argv[1], sys.argv[2]
data = json.load(open(src, encoding="utf8"))
upem, adv = data["upem"], data["adv"]
names = sorted(data["glyphs"], key=lambda n: data["glyphs"][n]["cp"])
order = [".notdef", "space"] + names

fb = FontBuilder(upem, isTTF=True)
fb.setupGlyphOrder(order)
cmap = {0x20: "space"}
cmap.update({data["glyphs"][n]["cp"]: n for n in names})
fb.setupCharacterMap(cmap)

glyphs, metrics = {}, {}
empty = TTGlyphPen(None)
glyphs[".notdef"] = empty.glyph()
glyphs["space"] = TTGlyphPen(None).glyph()
metrics[".notdef"] = (adv, 0)
metrics["space"] = (adv // 3, 0)
for n in names:
    pen = TTGlyphPen(None)
    for c in data["glyphs"][n]["contours"]:
        pen.moveTo(tuple(c[0]))
        for p in c[1:]:
            pen.lineTo(tuple(p))
        pen.closePath()
    g = pen.glyph()
    if g.numberOfContours > 0:
        g.flags[0] |= 0x40  # OVERLAP_SIMPLE: outlines overlap on purpose
    glyphs[n] = g
    metrics[n] = (adv, 0)
fb.setupGlyf(glyphs)
for n in order:
    g = fb.font["glyf"][n]
    g.recalcBounds(fb.font["glyf"])
    metrics[n] = (metrics[n][0], getattr(g, "xMin", 0))
fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=800, descent=-200)
fb.setupNameTable({"familyName": "GameIcons", "styleName": "Regular"})
fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, sTypoLineGap=0, usWinAscent=900, usWinDescent=200, achVendID="RotN")
fb.setupPost()
fb.font.flavor = "woff2"
fb.save(out)
print("wrote", out, len(names), "glyphs")
