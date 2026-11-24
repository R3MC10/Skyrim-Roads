"""Makes every app icon from one vector source, game/icon.svg.

    python scripts/make_icons.py            # writes all icons (needs: pip install playwright pillow; playwright install chromium)

The SVG has two groups: <g id="bg"> (the backdrop, full square) and <g id="emblem"> (the round
badge, inside a circle of radius ~445 around the centre of a 1024 canvas). Shapes with class="ring"
are the badge's shield/ring; the notification icon leaves them out and keeps only the mark.
Chromium (through Playwright) draws the SVG; Pillow scales, masks and writes PNG/ICO.

What it writes:
  Android  res/mipmap-*/ic_launcher(.png, _round, _foreground, _background, _monochrome)
           res/drawable-*/ic_stat_roads.png (white notification icon), res/drawable*/splash.png
           app/src/main/ic_launcher-playstore.png (512)
  PC       desktop/build/icon.ico (16-256, exe + installer), desktop/icon.png (window/taskbar)
  Web      game/favicon.ico, game/icon-192.png, game/icon-512.png, game/apple-touch-icon.png
  Sources  assets/icon-*.png, assets/splash*.png (what `npx capacitor-assets` would read)
"""
import io, os, re, sys
from PIL import Image, ImageDraw, ImageChops

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
BIG = 1024
SPLASH_BG = (0x12, 0x14, 0x17)
DENS = {"ldpi": 0.75, "mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
EMBLEM_R = 445            # the badge's outer radius in the 1024 source, stroke included
PARCHMENT = (0xE9, 0xD6, 0xA3)


class Renderer:
    """Draws the SVG with one headless Chromium page, hiding groups with CSS."""
    def __init__(self, svg):
        from playwright.sync_api import sync_playwright
        self.svg = re.sub(r"<\?xml[^>]*>", "", svg)
        self._pw = sync_playwright().start()
        self._b = self._pw.chromium.launch()
        self._p = self._b.new_page(viewport={"width": BIG, "height": BIG})

    def draw(self, hide="", scale=1.0, size=BIG):
        css = f"{hide}{{display:none}}" if hide else ""
        html = (f"<html><head><style>html,body{{margin:0;background:transparent}}{css}"
                f"svg{{width:{size}px;height:{size}px;display:block;transform:scale({scale});transform-origin:50% 50%}}</style></head>"
                f"<body>{self.svg}</body></html>")
        self._p.set_viewport_size({"width": size, "height": size})
        self._p.set_content(html)
        png = self._p.screenshot(omit_background=True, clip={"x": 0, "y": 0, "width": size, "height": size})
        return Image.open(io.BytesIO(png)).convert("RGBA")

    def close(self):
        self._b.close(); self._pw.stop()


def ink_mask(img):
    """Alpha of everything that is not parchment: the silhouette used for one-colour icons."""
    r, g, b, a = img.split()
    pr, pg, pb = PARCHMENT
    d = ImageChops.add(ImageChops.add(ImageChops.difference(r, Image.new("L", r.size, pr)),
                                      ImageChops.difference(g, Image.new("L", r.size, pg))),
                       ImageChops.difference(b, Image.new("L", r.size, pb)))
    d = d.point(lambda v: 0 if v < 60 else 255 if v > 120 else int((v - 60) * 255 / 60))
    return ImageChops.multiply(d, a)


def white(mask):
    out = Image.new("RGBA", mask.size, (255, 255, 255, 0)); out.putalpha(mask); return out


def shaped(full, shape, size, cover=0.92, radius=0.2):
    """The full icon cut to a rounded square or a circle, with a little margin (legacy launchers)."""
    s = BIG
    m = Image.new("L", (s * 2, s * 2), 0); d = ImageDraw.Draw(m)
    pad = (1 - cover) * s
    box = (pad * 2, pad * 2, (s - pad) * 2, (s - pad) * 2)
    if shape == "circle": d.ellipse(box, fill=255)
    else: d.rounded_rectangle(box, radius=radius * cover * s * 2, fill=255)
    m = m.resize((s, s), Image.LANCZOS)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0)); out.paste(full, (0, 0), m)
    return out.resize((size, size), Image.LANCZOS)


def save(img, *parts, size=None):
    path = os.path.join(ROOT, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if size: img = img.resize((size, size), Image.LANCZOS)
    img.save(path, optimize=True)
    return path


def splash(emblem, w, h, frac=0.42):
    out = Image.new("RGB", (w, h), SPLASH_BG)
    e = int(min(w, h) * frac)
    out.paste(emblem.resize((e, e), Image.LANCZOS), ((w - e) // 2, (h - e) // 2), emblem.resize((e, e), Image.LANCZOS))
    return out


def main():
    svg = open(os.path.join(ROOT, "game", "icon.svg"), encoding="utf-8").read()
    R = Renderer(svg)
    try:
        full = R.draw()                                  # backdrop + badge, full bleed
        bg = R.draw("#emblem")                           # backdrop only
        emblem = R.draw("#bg")                           # badge only, transparent around
        safe = 33 / 54 * (BIG / 2) / EMBLEM_R            # adaptive icons: badge inside the 66dp safe circle of 108dp
        fg = R.draw("#bg", scale=safe)
        mark = R.draw("#bg,.ring", scale=1.0)            # the mark alone (no shield) for the notification icon
    finally:
        R.close()
    mono = white(ink_mask(fg))
    full_rgb = full.convert("RGB")
    legacy_sq = shaped(full, "square", BIG)
    legacy_round = shaped(full, "circle", BIG)

    # notification icon: the mark alone, cropped to its bounds and centred in a 24dp box with 2dp padding
    nm = ink_mask(mark)
    bb = nm.getbbox(); side = max(bb[2] - bb[0], bb[3] - bb[1])
    cx, cy = (bb[0] + bb[2]) // 2, (bb[1] + bb[3]) // 2
    nm = nm.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2))
    note = Image.new("L", (int(side * 24 / 20),) * 2, 0); note.paste(nm, ((note.size[0] - side) // 2,) * 2)
    note = white(note)

    out = []
    for d, k in DENS.items():
        out.append(save(legacy_sq, RES, f"mipmap-{d}", "ic_launcher.png", size=round(48 * k)))
        out.append(save(legacy_round, RES, f"mipmap-{d}", "ic_launcher_round.png", size=round(48 * k)))
        out.append(save(fg, RES, f"mipmap-{d}", "ic_launcher_foreground.png", size=round(108 * k)))
        out.append(save(bg, RES, f"mipmap-{d}", "ic_launcher_background.png", size=round(108 * k)))
        out.append(save(mono, RES, f"mipmap-{d}", "ic_launcher_monochrome.png", size=round(108 * k)))
        if d != "ldpi":
            out.append(save(note, RES, f"drawable-{d}", "ic_stat_roads.png", size=round(24 * k)))
    out.append(save(full_rgb, "android", "app", "src", "main", "ic_launcher-playstore.png", size=512))

    # splash screens: keep every existing file's size, redraw it with the badge on the dark backdrop
    for folder in sorted(os.listdir(RES)):
        p = os.path.join(RES, folder, "splash.png")
        if folder.startswith("drawable") and os.path.exists(p):
            w, h = Image.open(p).size
            splash(emblem, w, h).save(p, optimize=True); out.append(p)

    # PC (Electron): exe/installer icon + window icon
    ico = os.path.join(ROOT, "desktop", "build", "icon.ico"); os.makedirs(os.path.dirname(ico), exist_ok=True)
    full.save(ico, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]); out.append(ico)
    out.append(save(full, "desktop", "icon.png", size=512))

    # web (game/ is flat)
    fav = os.path.join(ROOT, "game", "favicon.ico")
    full.save(fav, sizes=[(16, 16), (32, 32), (48, 48)]); out.append(fav)
    out.append(save(full, "game", "icon-192.png", size=192))
    out.append(save(full, "game", "icon-512.png", size=512))
    out.append(save(full_rgb, "game", "apple-touch-icon.png", size=180))

    # sources for @capacitor/assets, kept in step
    out.append(save(full_rgb, "assets", "icon-only.png"))
    out.append(save(fg, "assets", "icon-foreground.png"))
    out.append(save(bg.convert("RGB"), "assets", "icon-background.png"))
    for n in ("splash.png", "splash-dark.png"):
        out.append(save(splash(emblem, 2732, 2732, 0.3), "assets", n))
    print(f"wrote {len(out)} icon files")


if __name__ == "__main__":
    sys.exit(main())
