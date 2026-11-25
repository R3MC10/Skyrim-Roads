"""Cut the painted world map into a zoom pyramid of WebP tiles (maptiles.js draws them).

    python scripts/map_tiles.py [source] [--out game] [--q 78]

source: the best painting there is (default game/map-world.webp, 2000x1400; a bigger 10:7 picture is better).
Level 0 is map-world.webp itself (unchanged). Level 1 is 4000x2800, level 2 is 8000x5600, both cut into 512 px tiles
named mapt-<level>-<col>-<row>.webp (edge tiles are smaller). When the source is smaller than a level, it is
upscaled carefully: a light clean-up of WebP blocking, Lanczos, then a mild unsharp mask so edges stay crisp
without halos. Level 1 is made from level 2 by a Lanczos shrink so the two match exactly.

Painted detail: upscaling alone adds no brushwork, so level 2 gets fine painted texture from
scripts/map_detail_swatches.webp (a 2x2 sheet of painted close-up swatches in the map's own style, made with ChatGPT:
tundra grass, snow, rock, sea). Only each swatch's fine light/dark pattern is used (never its colour), made seamless,
mixed by what the ground looks like under each pixel (blue water, white snow, grey rock, the rest grass), and kept
off busy spots (trees, peaks, coastlines, rivers) so the painting's own shapes stay exactly as painted.
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageFilter

TILE = 512
LEVELS = {1: 4000, 2: 8000}
ASPECT = 10 / 7


def clean(im):
    try:
        import cv2
        a = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
        a = cv2.fastNlMeansDenoisingColored(a, None, 2, 2, 5, 15)   # only the faint WebP blocking, not the brushwork
        return Image.fromarray(cv2.cvtColor(a, cv2.COLOR_BGR2RGB))
    except Exception:
        return im


def along_edges(im, reach=2.0):
    """smooth along edges, never across them: plain resizing keeps the source's pixel stair-steps on slanted lines
    (ridges, shores, rivers); averaging a few samples along each edge's own direction (from the structure tensor)
    turns them back into clean painted lines. Flat spots and corners are left alone."""
    import cv2
    a = np.asarray(im).astype(np.float32)
    L = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY)
    gx, gy = cv2.Sobel(L, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(L, cv2.CV_32F, 0, 1, ksize=3)
    sg = 1.4 * reach / 2
    jxx, jyy, jxy = (cv2.GaussianBlur(v, (0, 0), sg) for v in (gx * gx, gy * gy, gx * gy))
    tr = jxx + jyy; dif = np.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy)
    coh = (dif / (tr + 1e-3)) * np.clip(tr / 400, 0, 1)    # 1 on a clear edge, 0 on flat paint or noise
    ang = 0.5 * np.arctan2(2 * jxy, jxx - jyy)              # gradient direction; the edge runs across it
    tx, ty = -np.sin(ang), np.cos(ang)
    h, w = L.shape
    X, Y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    acc = a.copy(); wsum = np.ones((h, w), np.float32)
    for s in (-reach, -reach / 2, reach / 2, reach):
        wt = np.exp(-(s / reach) ** 2 * 1.2).astype(np.float32)
        smp = cv2.remap(a, X + tx * s, Y + ty * s, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        acc += smp * wt; wsum += wt
    sm = acc / wsum[..., None]
    k = np.clip(coh * 1.1, 0, 0.9)[..., None]
    return Image.fromarray(np.clip(a * (1 - k) + sm * k, 0, 255).astype(np.uint8))


def upscale(im, w):
    h = round(w / ASPECT)
    if im.width >= w:
        return im.resize((w, h), Image.LANCZOS)
    cur = clean(im)
    while cur.width < w:   # double at a time: smooth the stair-steps along edges, then sharpen a little
        nw = min(w, cur.width * 2)
        cur = cur.resize((nw, round(nw / ASPECT)), Image.LANCZOS)
        cur = along_edges(cur, 2.0 if nw <= 4000 else 2.6)
        cur = cur.filter(ImageFilter.UnsharpMask(radius=1.4, percent=60, threshold=2))
    return cur.resize((w, h), Image.LANCZOS) if cur.width != w else cur


SWATCHES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "map_detail_swatches.webp")


def seamless_detail(sw):
    """a swatch's fine light/dark pattern, seamless, zero mean, unit spread"""
    import cv2
    L = cv2.cvtColor(np.asarray(sw.convert("RGB")), cv2.COLOR_RGB2GRAY).astype(np.float32)
    d = L - cv2.GaussianBlur(L, (0, 0), 7)
    n = d.shape[0]
    # cross-fade with a half-turned copy so the edges wrap
    sh = np.roll(np.roll(d, n // 2, 0), n // 2, 1)
    y, x = np.mgrid[0:n, 0:n].astype(np.float32) / (n - 1)
    w = np.minimum(np.minimum(x, 1 - x), np.minimum(y, 1 - y)) * 2   # 0 at the edges, 1 in the middle
    w = np.clip(w * 2.2, 0, 1)
    d = d * w + sh * (1 - w)
    d -= d.mean(); d /= d.std() + 1e-6
    return d


def class_weights(base):
    """soft weights per ground kind at the base painting's size: grass, snow, rock, water; and how calm each spot is"""
    import cv2
    a = np.asarray(base.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    sat = (mx - mn) / (mx + 1)
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    water = np.clip((b - r - 6) / 25, 0, 1) * np.clip((b - 0.5 * g - 5) / 30 + 0.5, 0, 1)
    snow = np.clip((lum - 170) / 35, 0, 1) * np.clip((0.22 - sat) / 0.12, 0, 1) * (1 - water)
    rock = np.clip((0.3 - sat) / 0.15, 0, 1) * np.clip((185 - lum) / 40, 0, 1) * (1 - water) * (1 - snow)
    grass = np.clip(1 - water - snow - rock, 0, 1)
    W = [cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.5) for m in (grass, snow, rock, water)]
    tot = sum(W) + 1e-6
    W = [m / tot for m in W]
    # calm: low local contrast (open plains, snowfields, open sea); busy spots (trees, peaks, shores) keep their own paint
    mu = cv2.GaussianBlur(lum, (0, 0), 2.0)
    sd = np.sqrt(np.maximum(0, cv2.GaussianBlur(lum * lum, (0, 0), 2.0) - mu * mu))
    calm = np.clip(1.25 - sd / 16, 0.15, 1)
    calm = cv2.GaussianBlur(calm, (0, 0), 1.2)
    return W, calm


def add_detail(top, base, amp=0.14):
    """multiply fine painted texture into the top level, strip by strip (keeps memory low)"""
    import cv2
    if not os.path.exists(SWATCHES):
        return top
    sheet = Image.open(SWATCHES).convert("RGB")
    h2 = sheet.height // 2; w2 = sheet.width // 2; m = 12   # trim the seams of the sheet
    boxes = [(0, 0), (w2, 0), (0, h2), (w2, h2)]   # grass, snow, rock, water
    det = [seamless_detail(sheet.crop((x + m, y + m, x + w2 - m, y + h2 - m))) for x, y in boxes]
    # a second, bigger sampling of each swatch hides the repeat
    det2 = [cv2.resize(d, None, fx=1.37, fy=1.37, interpolation=cv2.INTER_CUBIC) for d in det]
    W, calm = class_weights(base)
    TW, TH = top.size
    out = np.asarray(top).copy()
    STRIP = 512
    for y0 in range(0, TH, STRIP):
        y1 = min(TH, y0 + STRIP); hh = y1 - y0
        # base-sized maps sampled at this strip's pixels (pixel centres line up with the resize above)
        mx = ((np.arange(TW, dtype=np.float32) + 0.5) * base.width / TW - 0.5)[None, :].repeat(hh, 0)
        my = ((np.arange(y0, y1, dtype=np.float32) + 0.5) * base.height / TH - 0.5)[:, None].repeat(TW, 1)
        up = lambda mp: cv2.remap(mp, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        D = np.zeros((hh, TW), np.float32)
        for i in range(4):
            wi = up(W[i])
            n = det[i].shape[0]; n2 = det2[i].shape[0]
            ys, xs = np.arange(y0, y1) % n, np.arange(TW) % n
            ys2, xs2 = (np.arange(y0, y1) + 211) % n2, (np.arange(TW) + 97) % n2
            d = 0.75 * det[i][np.ix_(ys, xs)] + 0.55 * det2[i][np.ix_(ys2, xs2)]
            D += wi * d
        c = up(calm)
        f = 1 + amp * D * c
        strip = out[y0:y1].astype(np.float32) * f[..., None]
        out[y0:y1] = np.clip(strip, 0, 255).astype(np.uint8)
    return Image.fromarray(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", nargs="?", default=os.path.join("game", "map-world.webp"))
    ap.add_argument("--out", default="game")
    ap.add_argument("--q", type=int, default=78)
    a = ap.parse_args()
    src = Image.open(a.source).convert("RGB")
    if abs(src.width / src.height - ASPECT) > 0.01:
        sys.exit(f"{a.source} is {src.width}x{src.height}, not 10:7")
    for f in os.listdir(a.out):
        if f.startswith("mapt-") and f.endswith(".webp"):
            os.remove(os.path.join(a.out, f))
    top = add_detail(upscale(src, LEVELS[2]), src)
    total = 0
    for lv, w in LEVELS.items():
        im = top if w == top.width else top.resize((w, round(w / ASPECT)), Image.LANCZOS)
        n = 0
        for row in range(0, im.height, TILE):
            for col in range(0, im.width, TILE):
                t = im.crop((col, row, min(im.width, col + TILE), min(im.height, row + TILE)))
                p = os.path.join(a.out, f"mapt-{lv}-{col // TILE}-{row // TILE}.webp")
                t.save(p, "WEBP", quality=a.q, method=6)
                total += os.path.getsize(p); n += 1
        print(f"level {lv}: {im.width}x{im.height}, {n} tiles")
    print(f"total {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
