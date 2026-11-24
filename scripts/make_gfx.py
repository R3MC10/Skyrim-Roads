"""Roads of the North - combat effect sprites (blood, dust, sparks, frost, embers, shock, motes, oil).
Pure numpy/PIL particle renderer (Blender MCP was not connected). Writes transparent WebP strips.
Usage: python make_gfx.py OUTDIR"""
import sys, os, math
import numpy as np
from PIL import Image, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
os.makedirs(OUT, exist_ok=True)
SS = 2  # supersampling


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w * SS, h * SS
        self.c = np.zeros((self.h, self.w, 3), np.float32)  # premultiplied colour
        self.a = np.zeros((self.h, self.w), np.float32)

    def blob(self, cx, cy, rx, ry, ang, col, alpha, soft=0.35, hi=0.0, add=False):
        """rotated ellipse with a soft edge; hi = specular highlight strength"""
        cx, cy, rx, ry = cx * SS, cy * SS, max(0.35, rx) * SS, max(0.35, ry) * SS
        R = max(rx, ry) * (1 + soft) + 2
        x0, x1 = int(max(0, cx - R)), int(min(self.w, cx + R + 1))
        y0, y1 = int(max(0, cy - R)), int(min(self.h, cy + R + 1))
        if x0 >= x1 or y0 >= y1:
            return
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        dx, dy = xx - cx, yy - cy
        ca, sa = math.cos(ang), math.sin(ang)
        u, v = (dx * ca + dy * sa) / rx, (-dx * sa + dy * ca) / ry
        d = np.sqrt(u * u + v * v)
        m = np.clip((1 + soft - d) / max(1e-3, soft * 2), 0, 1) if soft > 0 else (d <= 1).astype(np.float32)
        m = m * m * (3 - 2 * m) * alpha
        col = np.array(col, np.float32)
        cc = np.broadcast_to(col, dx.shape + (3,)).copy()
        if hi > 0:  # a small shine up-left: wet
            hu, hv = u + 0.35, v + 0.35
            hd = np.clip(1 - np.sqrt(hu * hu + hv * hv) / 0.45, 0, 1) * hi
            cc = cc + (np.array([1, 0.85, 0.8], np.float32) - cc) * hd[..., None]
            # darker rim
            rim = np.clip((d - 0.6) / 0.4, 0, 1) * 0.35
            cc = cc * (1 - rim[..., None])
        if add:
            self.c[y0:y1, x0:x1] += cc * m[..., None]
            self.a[y0:y1, x0:x1] = np.clip(self.a[y0:y1, x0:x1] + m * 0.6, 0, 1)
            return
        ia = 1 - m
        self.c[y0:y1, x0:x1] = self.c[y0:y1, x0:x1] * ia[..., None] + cc * m[..., None]
        self.a[y0:y1, x0:x1] = self.a[y0:y1, x0:x1] * ia + m

    def line(self, x0, y0, x1, y1, w, col, alpha, add=True):
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) / max(0.6, w * 0.6)))
        for i in range(n + 1):
            t = i / n
            self.blob(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w, w, 0, col, alpha, soft=0.8, add=add)

    def image(self, blur=0):
        a = np.clip(self.a, 0, 1)
        c = np.where(a[..., None] > 1e-4, self.c / np.maximum(a[..., None], 1e-4), 0)
        c = np.clip(c, 0, 1)
        arr = np.dstack([c, a]) * 255
        im = Image.fromarray(arr.astype(np.uint8), "RGBA")
        im = im.resize((self.w // SS, self.h // SS), Image.LANCZOS)
        if blur:
            im = im.filter(ImageFilter.GaussianBlur(blur))
        return im


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def strip(frames, name):
    fw, fh = frames[0].size
    s = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f, (i * fw, 0))
    s.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=82, method=6, alpha_quality=90)
    s.save(os.path.join(OUT, "_" + name + ".png"))
    print(name, s.size, os.path.getsize(os.path.join(OUT, name + ".webp")) // 1024, "KB")


# ------------------------------------------------------------------ liquid bursts (blood, oil, ichor)
def liquid_burst(name, seed, size, frames, cols, origin=(0.32, 0.55), spread=1.2, n_drops=110, n_mist=160, speed=1.0, mist_col=None, direction=0.0, stretch=1.0):
    rng = np.random.default_rng(seed)
    W = H = size
    ox, oy = origin[0] * W, origin[1] * H
    # droplets: angle around the direction (spray thrown away from the attacker, +x)
    ang = direction + rng.normal(0, spread * 0.5, n_drops) - 0.25
    sp = (rng.pareto(2.2, n_drops) * 0.35 + 0.45) * speed * W * 1.9
    sp = np.minimum(sp, W * 2.2 * speed)
    rad = np.clip(rng.lognormal(0.0, 0.6, n_drops) * W / 105, 0.6, W / 24)
    rad = rad * np.clip(1.3 - sp / (W * 2.4), 0.4, 1.2)  # fast drops are small
    col_i = rng.integers(0, len(cols), n_drops)
    delay = rng.uniform(0, 0.12, n_drops)
    # mist: tiny, many, soft, slower
    mang = direction + rng.normal(0, spread * 0.6, n_mist) - 0.2
    msp = rng.uniform(0.15, 0.75, n_mist) * W * speed
    mrad = rng.uniform(0.6, 2.2, n_mist) * W / 200
    # streamers: a few long ropes of liquid
    n_str = 7
    sang = direction + rng.normal(0, spread * 0.35, n_str) - 0.2
    ssp = rng.uniform(0.8, 1.4, n_str) * W * speed
    g = W * 1.1  # gravity (px / unit^2)
    out = []
    for fi in range(frames):
        t = (fi + 0.6) / frames * 0.62
        cv = Canvas(W, H)
        fade = max(0.0, 1 - max(0, t - 0.4) / 0.24) ** 0.7
        # core splash: a fat blob at the wound, early
        if t < 0.25:
            k = 1 - t / 0.25
            for j in range(9):
                a = direction + (j / 8 - 0.5) * spread * 1.2
                r = W * (0.04 + 0.09 * (1 - k)) * (0.7 + 0.6 * ((j * 37) % 7) / 7)
                cv.blob(ox + math.cos(a) * r * 0.9, oy + math.sin(a) * r * 0.6, r * 0.75, r * 0.45, a, cols[0], 0.85 * k, soft=0.5, hi=0.4)
        # mist
        mcol = mist_col or cols[0]
        for i in range(n_mist):
            tt = t * (1.1 - 0.3 * (i % 3) / 2)
            dr = 1 - math.exp(-tt * 4.5)
            x = ox + math.cos(mang[i]) * msp[i] * dr * 1.2
            y = oy + math.sin(mang[i]) * msp[i] * dr * 1.2 + 0.25 * g * tt * tt
            r = mrad[i] * (1 + t * 6)
            cv.blob(x, y, r * 1.4, r * 1.4, 0, mcol, 0.16 * (1 - t / 0.62) * min(1, t * 10), soft=1.0)
        # streamers (drawn as tapered chains)
        for i in range(n_str):
            L = 14
            for j in range(L):
                tt = max(0.0, t - j * 0.006)
                x = ox + math.cos(sang[i]) * ssp[i] * tt * 0.9
                y = oy + math.sin(sang[i]) * ssp[i] * tt * 0.9 + 0.5 * g * tt * tt
                r = W / 75 * (1 - j / L) * (1.3 if j < 2 else 1) * fade
                if t < 0.08:
                    r *= t / 0.08
                cv.blob(x, y, r * 1.3, r, sang[i], cols[j % len(cols)], 0.95 * fade, soft=0.3, hi=0.25 if j == 0 else 0)
        # droplets
        for i in range(n_drops):
            tt = t - delay[i]
            if tt <= 0:
                continue
            vx, vy = math.cos(ang[i]) * sp[i], math.sin(ang[i]) * sp[i]
            x = ox + vx * tt
            y = oy + vy * tt + 0.5 * g * tt * tt
            cvx, cvy = vx, vy + g * tt
            v = math.hypot(cvx, cvy)
            elong = 1 + min(2.6, v / (W * 0.9)) * stretch
            r = rad[i] * (1 - 0.25 * t) * fade
            if r < 0.3:
                continue
            cv.blob(x, y, r * elong, r, math.atan2(cvy, cvx), cols[col_i[i]], 0.97 * fade, soft=0.25, hi=0.3 if rad[i] > W / 70 else 0.08)
        out.append(cv.image())
    strip(out, name)
    return out


# ------------------------------------------------------------------ ground / wall splatter decals
def decal(rng, D, cols, kind):
    cv = Canvas(D, D)
    cx, cy = D / 2, D / 2
    base = D * (0.15 if kind != "spray" else 0.1)
    # irregular main pool: radial noise
    harm = [(k, rng.uniform(0.03, 0.16) / (k ** 0.6), rng.uniform(0, 6.28)) for k in range(2, 11)]
    def rad(a):
        return base * (1 + sum(amp * math.sin(k * a + ph) for k, amp, ph in harm))
    dark, mid, light = cols
    if kind == "spray":  # directional splash: a smeared impact and a fan of elongated drops along +x
        hx = cx - D * 0.28
        for k in range(26):
            cv.blob(hx + rng.uniform(-0.04, 0.1) * D, cy + rng.normal(0, 0.025) * D, D * rng.uniform(0.02, 0.055), D * rng.uniform(0.015, 0.035), rng.normal(0, 0.3), mid, 0.95, soft=0.2)
        for i in range(170):
            a = rng.normal(0, 0.3)
            d = (0.06 + rng.pareto(2.5) * 0.12) * D
            if d > 0.62 * D:
                continue
            r = D / 85 * rng.lognormal(0, 0.55) * max(0.25, 1.05 - d / D * 1.2)
            el = 1 + d / D * 4
            cv.blob(hx + math.cos(a) * d, cy + math.sin(a) * d, r * el, r, a, mid if i % 3 else dark, 0.95, soft=0.2)
            if el > 2 and rng.random() < 0.35:  # a tiny tail drop
                cv.blob(hx + math.cos(a) * (d + r * el * 1.6), cy + math.sin(a) * (d + r * el * 1.6), r * 0.5, r * 0.4, a, mid, 0.9, soft=0.2)
    else:
        # the main shape: a few overlapping irregular blobs (not a perfect coin)
        nb = 1 if kind == "pool" else int(rng.integers(3, 6))
        offs = [(0.0, 0.0, 1.0)] + [(rng.normal(0, 0.45), rng.normal(0, 0.45), rng.uniform(0.35, 0.7)) for _ in range(nb - 1)]
        for (ox_, oy_, sc_) in offs:
            for k in range(160):
                a = k / 160 * 6.283
                r = rad(a) * sc_
                for f in (0.35, 0.7):
                    cv.blob(cx + ox_ * base + math.cos(a) * r * f, cy + oy_ * base + math.sin(a) * r * f, r * 0.42, r * 0.42, 0, mid, 0.9, soft=0.15)
        cv.blob(cx, cy, base * 0.8, base * 0.8, 0, mid, 1, soft=0.2)
        # thin, tapering runs thrown out of it
        nt = rng.integers(4, 10) if kind != "pool" else rng.integers(1, 4)
        for _ in range(nt):
            a = rng.uniform(0, 6.283)
            L = rad(a) + rng.uniform(0.06, 0.26) * D * (0.5 if kind == "pool" else 1)
            w0 = base * rng.uniform(0.08, 0.18)
            steps = 34
            wig = rng.normal(0, 0.06)
            for j in range(steps):
                t = j / steps
                rr = rad(a) * 0.8 + (L - rad(a) * 0.8) * t
                aa = a + wig * t
                w = w0 * (1 - 0.85 * t) ** 1.3
                cv.blob(cx + math.cos(aa) * rr, cy + math.sin(aa) * rr, w * 1.2, w, aa, mid, 0.95, soft=0.2)
            if rng.random() < 0.5:
                cv.blob(cx + math.cos(a + wig) * (L + w0 * 0.8), cy + math.sin(a + wig) * (L + w0 * 0.8), w0 * 0.55, w0 * 0.45, a, mid, 0.95, soft=0.2)
        # satellite drops, more and smaller further out
        ns = 110 if kind == "splat" else 30
        for _ in range(ns):
            a = rng.uniform(0, 6.283)
            k = rng.uniform(1.1, 3.0) if kind != "pool" else rng.uniform(1.05, 1.6)
            d = rad(a) * k
            r = D / 260 * rng.lognormal(0.25, 0.65) * (1.6 - k * 0.35)
            px_, py_ = cx + math.cos(a) * d, cy + math.sin(a) * d
            if not (D * 0.04 < px_ < D * 0.96 and D * 0.04 < py_ < D * 0.96):
                continue
            cv.blob(px_, py_, r * rng.uniform(1, 1.6), r, a, mid if rng.random() < 0.6 else dark, 0.95, soft=0.25)
    im = cv.image()
    # shading: darker dried rim, lighter wet centre with a shine
    arr = np.asarray(im).astype(np.float32) / 255
    a = arr[..., 3]
    ab = np.asarray(im.split()[3].filter(ImageFilter.GaussianBlur(D / 60))).astype(np.float32) / 255
    rim = np.clip((a - ab) * 3 + (1 - ab) * 0.6, 0, 1)  # edges
    dk, lt = np.array(dark), np.array(light)
    rgb = arr[..., :3]
    rgb = rgb * (1 - rim[..., None] * 0.55) + dk * rim[..., None] * 0.55
    inner = np.clip((ab - 0.85) / 0.15, 0, 1)
    noise = np.asarray(Image.effect_noise((D, D), 40).filter(ImageFilter.GaussianBlur(D / 90))).astype(np.float32) / 255
    rgb = rgb * (0.86 + 0.28 * noise[..., None])
    rgb = rgb + (lt - rgb) * (inner * 0.25)[..., None]
    out = np.dstack([np.clip(rgb, 0, 1), np.clip(a * (0.92 + 0.08 * noise), 0, 1)])
    return Image.fromarray((out * 255).astype(np.uint8), "RGBA")


def decals(name, cols, D=256, seed=7):
    rng = np.random.default_rng(seed)
    kinds = ["splat", "splat", "pool", "spray", "splat", "pool", "spray", "splat"]
    sheet = Image.new("RGBA", (D * 4, D * 2), (0, 0, 0, 0))
    for i, k in enumerate(kinds):
        sheet.paste(decal(rng, D, cols, k), ((i % 4) * D, (i // 4) * D))
    sheet.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=82, method=6, alpha_quality=90)
    sheet.save(os.path.join(OUT, "_" + name + ".png"))
    print(name, sheet.size, os.path.getsize(os.path.join(OUT, name + ".webp")) // 1024, "KB")


# ------------------------------------------------------------------ dry particles
def dust(name, seed, size=192, frames=10, cols=("#8a7a62", "#b3a588", "#6e604c"), chips=0):
    rng = np.random.default_rng(seed)
    W = H = size
    n = 46
    ang = rng.uniform(-math.pi, 0, n)
    sp = rng.uniform(0.15, 0.5, n) * W
    r0 = rng.uniform(0.03, 0.07, n) * W
    cs = [hexc(c) for c in cols]
    ch_ang = rng.uniform(-math.pi * 0.95, -0.05, chips)
    ch_sp = rng.uniform(0.5, 1.1, chips) * W
    ch_r = rng.uniform(0.006, 0.016, chips) * W
    out = []
    for fi in range(frames):
        t = (fi + 0.7) / frames
        cv = Canvas(W, H)
        for i in range(n):
            dr = 0.3 + 0.7 * (1 - math.exp(-t * 3.2))
            x = W / 2 + math.cos(ang[i]) * sp[i] * dr
            y = H * 0.72 + math.sin(ang[i]) * sp[i] * dr * 0.6 - t * W * 0.05
            r = r0[i] * (1 + t * 2.4)
            cv.blob(x, y, r, r * 0.85, 0, cs[i % 3], 0.13 * min(1, 0.4 + t * 3) * (1 - t) ** 1.3, soft=1.2)
        for i in range(chips):
            tt = t * 0.55
            x = W / 2 + math.cos(ch_ang[i]) * ch_sp[i] * tt
            y = H * 0.7 + math.sin(ch_ang[i]) * ch_sp[i] * tt + 0.5 * W * 2.2 * tt * tt
            cv.blob(x, y, ch_r[i] * 1.6, ch_r[i], i * 1.3 + t * 9, hexc("#e2d8bc") if i % 2 else hexc("#a89e84"), (1 - t) ** 0.5, soft=0.15, hi=0.3)
        out.append(cv.image(blur=0.6))
    strip(out, name)


def sparks(name, seed, size=160, frames=8, hot=("#fff6d0", "#ffd36a", "#ff8a20")):
    rng = np.random.default_rng(seed)
    W = H = size
    n = 34
    ang = rng.uniform(0, 6.283, n)
    sp = rng.uniform(0.35, 1.0, n) * W * 1.3
    cs = [hexc(c) for c in hot]
    out = []
    for fi in range(frames):
        t = (fi + 0.5) / frames * 0.5
        cv = Canvas(W, H)
        if fi < 3:
            k = 1 - fi / 3
            cv.blob(W / 2, H / 2, W * 0.12 * k + 2, W * 0.12 * k + 2, 0, cs[1], 0.6 * k, soft=1.0, add=True)
            cv.blob(W / 2, H / 2, W * 0.04 * k + 1, W * 0.04 * k + 1, 0, cs[0], 0.9 * k, soft=0.6, add=True)
        for i in range(n):
            g = W * 1.4
            x0 = W / 2 + math.cos(ang[i]) * sp[i] * max(0, t - 0.03)
            y0 = H / 2 + math.sin(ang[i]) * sp[i] * max(0, t - 0.03) + 0.5 * g * max(0, t - 0.03) ** 2
            x1 = W / 2 + math.cos(ang[i]) * sp[i] * t
            y1 = H / 2 + math.sin(ang[i]) * sp[i] * t + 0.5 * g * t * t
            life = 1 - t / 0.5 * (0.6 + 0.4 * (i % 5) / 4)
            if life <= 0:
                continue
            col = cs[0] if life > 0.6 else cs[1] if life > 0.3 else cs[2]
            cv.line(x0, y0, x1, y1, W / 260 + 0.4, col, life, add=True)
        out.append(cv.image())
    strip(out, name)


def frost(name, seed, size=192, frames=10):
    rng = np.random.default_rng(seed)
    W = H = size
    n = 26
    ang = rng.normal(0, 0.9, n) - 0.2
    sp = rng.uniform(0.4, 1.0, n) * W * 0.9
    ln = rng.uniform(0.02, 0.05, n) * W
    spin = rng.uniform(-8, 8, n)
    out = []
    for fi in range(frames):
        t = (fi + 0.5) / frames * 0.6
        cv = Canvas(W, H)
        for i in range(50):  # cold mist
            a = (i * 2.39996) % 6.283
            d = (i % 7) / 7 * W * 0.25 * (0.4 + t * 1.6)
            cv.blob(W * 0.4 + math.cos(a) * d, H / 2 + math.sin(a) * d, W * 0.05 * (1 + t * 2), W * 0.05 * (1 + t * 2), 0, hexc("#d8f0ff"), 0.07 * (1 - t / 0.6), soft=1.0)
        for i in range(n):
            g = W * 1.0
            x = W * 0.4 + math.cos(ang[i]) * sp[i] * t
            y = H / 2 + math.sin(ang[i]) * sp[i] * t + 0.5 * g * t * t
            a = spin[i] * t + ang[i]
            life = 1 - max(0, t - 0.35) / 0.25
            if life <= 0:
                continue
            L = ln[i]
            # a shard: long thin diamond, pale edge, glinting
            cv.blob(x, y, L, L * 0.28, a, hexc("#9fd4f4"), 0.85 * life, soft=0.12)
            cv.blob(x, y, L * 0.7, L * 0.12, a, hexc("#f2fbff"), 0.95 * life, soft=0.2, add=True)
        out.append(cv.image())
    strip(out, name)


def embers(name, seed, size=192, frames=10):
    rng = np.random.default_rng(seed)
    W = H = size
    n = 40
    x0 = rng.normal(W / 2, W * 0.08, n)
    y0 = rng.normal(H * 0.6, H * 0.06, n)
    vx = rng.normal(0, 0.25, n) * W
    vy = -rng.uniform(0.3, 0.9, n) * H
    wob = rng.uniform(0, 6.28, n)
    out = []
    for fi in range(frames):
        t = (fi + 0.5) / frames
        cv = Canvas(W, H)
        # fire flash and smoke
        k = max(0, 1 - t * 2.2)
        cv.blob(W / 2, H * 0.6, W * 0.2 * (0.5 + t), W * 0.17 * (0.5 + t), 0, hexc("#ff8a2a"), 0.5 * k, soft=1.0, add=True)
        cv.blob(W / 2, H * 0.6, W * 0.08 * (0.5 + t), W * 0.07 * (0.5 + t), 0, hexc("#fff0b0"), 0.7 * k, soft=0.9, add=True)
        for j in range(14):
            sm = t - 0.1
            if sm <= 0:
                continue
            cv.blob(W / 2 + (j - 7) * W * 0.02 + math.sin(j + t * 4) * W * 0.03, H * 0.55 - sm * H * 0.4 - j * 1.5, W * 0.06 * (1 + sm * 2), W * 0.05 * (1 + sm * 2), 0, hexc("#2a2420"), 0.1 * (1 - t), soft=1.0)
        for i in range(n):
            tt = t * 0.8
            x = x0[i] + vx[i] * tt + math.sin(wob[i] + tt * 12) * W * 0.02
            y = y0[i] + vy[i] * tt + 0.2 * H * tt * tt
            life = (1 - t) ** 0.8
            col = hexc("#fff2b0") if life > 0.7 else hexc("#ffb040") if life > 0.35 else hexc("#e04a10")
            r = W / 220 * (1 + (i % 3))
            cv.blob(x, y, r * 2.2, r * 2.2, 0, col, 0.25 * life, soft=1.0, add=True)
            cv.blob(x, y, r, r, 0, col, life, soft=0.5, add=True)
        out.append(cv.image())
    strip(out, name)


def shock(name, seed, size=192, frames=8):
    rng = np.random.default_rng(seed)
    W = H = size
    out = []
    for fi in range(frames):
        t = fi / frames
        cv = Canvas(W, H)
        life = 1 - t * 0.85
        k = max(0, 1 - t * 2)
        cv.blob(W / 2, H / 2, W * 0.22, W * 0.22, 0, hexc("#7a8cff"), 0.35 * k + 0.08, soft=1.0, add=True)
        for arc in range(5 if fi < 5 else 3):
            a = rng.uniform(0, 6.283)
            L = rng.uniform(0.25, 0.48) * W
            x, y = W / 2, H / 2
            segs = 9
            pts = [(x, y)]
            for s_ in range(segs):
                a += rng.normal(0, 0.55)
                x += math.cos(a) * L / segs
                y += math.sin(a) * L / segs
                pts.append((x, y))
            for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                cv.line(ax, ay, bx, by, W / 70, hexc("#6a7cff"), 0.22 * life, add=True)
                cv.line(ax, ay, bx, by, W / 220 + 0.5, hexc("#f4f2ff"), 0.95 * life, add=True)
            if rng.random() < 0.6:  # a fork
                fx, fy = pts[segs // 2]
                b = a + rng.choice([-1, 1]) * 0.9
                for s_ in range(4):
                    nx, ny = fx + math.cos(b) * L / segs, fy + math.sin(b) * L / segs
                    cv.line(fx, fy, nx, ny, W / 300 + 0.4, hexc("#dcd8ff"), 0.8 * life, add=True)
                    fx, fy = nx, ny
                    b += rng.normal(0, 0.6)
        out.append(cv.image())
    strip(out, name)


def motes(name, seed, size=192, frames=10, cols=("#d6c2ff", "#8ad0ff", "#ffffff")):
    rng = np.random.default_rng(seed)
    W = H = size
    n = 36
    ang = rng.uniform(0, 6.283, n)
    sp = rng.uniform(0.12, 0.42, n) * W
    swirl = rng.uniform(1.5, 3.5, n)
    cs = [hexc(c) for c in cols]
    out = []
    for fi in range(frames):
        t = (fi + 0.5) / frames
        cv = Canvas(W, H)
        k = max(0, 1 - t * 2.5)
        cv.blob(W / 2, H / 2, W * 0.16, W * 0.16, 0, cs[0], 0.45 * k, soft=1.0, add=True)
        for i in range(n):
            a = ang[i] + swirl[i] * t
            d = sp[i] * (1 - math.exp(-t * 3))
            x, y = W / 2 + math.cos(a) * d, H / 2 + math.sin(a) * d - t * H * 0.12
            life = (1 - t) ** 0.7 * (0.6 + 0.4 * math.sin(i + t * 20) ** 2)
            r = W / 260 * (1 + i % 3)
            cv.blob(x, y, r * 3, r * 3, 0, cs[i % 2], 0.2 * life, soft=1.0, add=True)
            cv.blob(x, y, r, r, 0, cs[2], 0.9 * life, soft=0.5, add=True)
        out.append(cv.image())
    strip(out, name)


BLOOD = [hexc("#5e0808"), hexc("#460505"), hexc("#6e0c0c"), hexc("#320303")]
GREEN = [hexc("#5d7a1c"), hexc("#3e5214"), hexc("#7a9a2a"), hexc("#2c3a0c")]
ICHOR = [hexc("#3a1240"), hexc("#26082c"), hexc("#4e1c56"), hexc("#16061a")]
OIL = [hexc("#1e1c16"), hexc("#2c281e"), hexc("#3e3a2c"), hexc("#141210")]

if __name__ == "__main__":
    only = set(sys.argv[2:])
    def want(n):
        return not only or n in only
    if want("blood"):
        liquid_burst("gfx-blood-burst-1", 11, 256, 10, BLOOD, spread=1.3, n_drops=120, mist_col=hexc("#5a0808"))
        liquid_burst("gfx-blood-burst-2", 23, 256, 10, BLOOD, spread=0.8, n_drops=100, speed=1.15, stretch=1.3, mist_col=hexc("#5a0808"))
        liquid_burst("gfx-blood-burst-3", 37, 256, 12, BLOOD, origin=(0.4, 0.5), spread=2.2, n_drops=150, speed=0.85, mist_col=hexc("#5a0808"))
        liquid_burst("gfx-blood-spray", 51, 256, 8, BLOOD, origin=(0.12, 0.45), spread=0.45, n_drops=90, n_mist=90, speed=1.35, stretch=1.6, mist_col=hexc("#5a0808"))
    if want("other"):
        liquid_burst("gfx-oil-burst", 61, 192, 10, OIL, spread=1.2, n_drops=80, mist_col=hexc("#2c281e"))
        liquid_burst("gfx-green-burst", 71, 192, 10, GREEN, spread=1.2, n_drops=90)
        liquid_burst("gfx-ichor-burst", 81, 192, 10, ICHOR, spread=1.2, n_drops=90)
    if want("decals"):
        decals("gfx-blood-decals", [hexc("#2e0303"), hexc("#5e0808"), hexc("#8a1414")], 384, 7)
        decals("gfx-oil-decals", [hexc("#0c0b08"), hexc("#1e1c16"), hexc("#4a4636")], 128, 9)
    if want("dry"):
        dust("gfx-dust", 5, 192, 10)
        dust("gfx-bonedust", 6, 192, 10, cols=("#cfc6ae", "#e2d8bc", "#a89e84"), chips=16)
        sparks("gfx-sparks", 9, 160, 8)
        frost("gfx-frost", 13, 192, 10)
        embers("gfx-embers", 17, 192, 10)
        shock("gfx-shock", 19, 192, 8)
        motes("gfx-motes", 29, 192, 10)
