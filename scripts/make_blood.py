"""Roads of the North - realistic liquid sprites (blood, oil, ichor, green blood, sap) for gorefx2.js.
Blender was not connected, so this is a small physics + shading renderer in numpy:
- every frame is a simulated spray: droplets fly under gravity with drag, long ligaments stretch, thin out and break into
  beads (Rayleigh-Plateau), a fine mist drifts and fades;
- the liquid is a metaball field (droplets merge instead of looking like pills); the surface height comes from the
  distance to the edge (flat wet tops, rounded edges), so it gets real normals: a glossy specular highlight up-left,
  darker where thick, redder and see-through where thin;
- ground decals: drop impacts with scalloped edges, spines and satellites; directional spatter with tails; pools with a
  darker coagulated rim and a wet sheen; body stains with drip runs that end in a bead.
Usage: python make_blood.py OUTDIR [blood other decals drops drips sheet]
Writes WebP strips / atlases named as in gorefx2.js (SH, DEC, DROPS, DRIPS) plus _name.png previews."""
import sys, os, math
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, distance_transform_edt

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
os.makedirs(OUT, exist_ok=True)
SS = 2  # supersampling


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


PAL = {
    "blood": dict(deep="#2c0104", body="#690409", thin="#b0141b", spec="#fff0ea", mist="#6e070c", gloss=1.0),
    "oil": dict(deep="#040403", body="#12110d", thin="#3c3727", spec="#e8f0ff", mist="#1a1812", gloss=1.4),
    "green": dict(deep="#1a2304", body="#4c6416", thin="#9db437", spec="#f4ffe0", mist="#4c6416", gloss=0.9),
    "ichor": dict(deep="#100212", body="#380c40", thin="#7c3a8c", spec="#f4e6ff", mist="#2e0a34", gloss=1.1),
    "sap": dict(deep="#2a1702", body="#74440a", thin="#d29a2c", spec="#fff6dc", mist="#6a3e0a", gloss=0.9),
}


class Field:
    """a metaball field (liquid) plus a mist field, at SS x resolution"""

    def __init__(self, w, h):
        self.W, self.H = w, h
        self.w, self.h = w * SS, h * SS
        self.f = np.zeros((self.h, self.w), np.float32)
        self.m = np.zeros((self.h, self.w), np.float32)

    def stamp(self, cx, cy, ra, rc=None, ang=0.0, wgt=1.0, mist=False):
        rc = ra if rc is None else rc
        cx, cy, ra, rc = cx * SS, cy * SS, max(0.45, ra * SS), max(0.45, rc * SS)
        R = 2.6 * max(ra, rc) + 1
        x0, x1 = int(max(0, cx - R)), int(min(self.w, cx + R + 1))
        y0, y1 = int(max(0, cy - R)), int(min(self.h, cy + R + 1))
        if x0 >= x1 or y0 >= y1:
            return
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        dx, dy = xx - cx, yy - cy
        ca, sa = math.cos(ang), math.sin(ang)
        u, v = (dx * ca + dy * sa) / ra, (-dx * sa + dy * ca) / rc
        (self.m if mist else self.f)[y0:y1, x0:x1] += wgt * np.exp(-(u * u + v * v))

    def capsule(self, x0, y0, x1, y1, r0, r1, wgt=1.0):
        d = math.hypot(x1 - x0, y1 - y0)
        n = max(2, int(d / max(0.35, min(r0, r1) * 0.55)) + 1)
        for i in range(n + 1):
            t = i / n
            self.stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t, wgt=wgt * 0.8)

    def drop(self, x, y, vx, vy, r, k=1.0, wgt=1.0):
        """a flying drop: round when slow, a teardrop stretched along its flight when fast (head in front)"""
        v = math.hypot(vx, vy)
        ang = math.atan2(vy, vx)
        el = 1 + min(2.4, v * k)
        self.stamp(x, y, r * (1 + 0.18 * (el - 1)), r * (1 - 0.06 * (el - 1)), ang, wgt)
        if el > 1.25:
            ca, sa = math.cos(ang), math.sin(ang)
            for j, (dd, rr, ww) in enumerate(((0.9, 0.62, 0.8), (1.7, 0.4, 0.75), (2.5, 0.24, 0.7))):
                if el < 1.25 + j * 0.55:
                    break
                L = r * (el - 1) * dd
                self.stamp(x - ca * L, y - sa * L, r * rr * 1.2, r * rr, ang, wgt * ww)


def shade(F, pal, fade=1.0, gloss=None, rim=0.0, flat=1.0, mist_a=0.32, sheen=0.0):
    """metaball field -> glossy liquid RGBA (PIL, downsampled)"""
    P = {k: (hexc(v) if isinstance(v, str) else v) for k, v in pal.items()}
    gl = P["gloss"] if gloss is None else gloss
    f = gaussian_filter(F.f, 0.5 * SS)
    a = sstep(0.36, 0.56, f)
    mask = f > 0.46
    d = distance_transform_edt(mask).astype(np.float32) / SS  # distance to the edge (output px)
    # height: rounded edges, flat wet tops; a little extra where the field is very thick (merged drops)
    h = np.sqrt(np.minimum(d, 7.0)) * 1.25 * flat + np.log1p(np.maximum(f - 1, 0)) * 0.5
    h = gaussian_filter(h, 0.8 * SS)
    gy, gx = np.gradient(h * SS)
    n = np.dstack([-gx, -gy, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    L = np.array([-0.5, -0.62, 0.6], np.float32); L /= np.linalg.norm(L)
    Hh = L + np.array([0, 0, 1], np.float32); Hh /= np.linalg.norm(Hh)
    ndl = np.clip(n @ L, 0, 1)
    ndh = np.clip(n @ Hh, 0, 1)
    tilt = np.clip(ndh - Hh[2], 0, 1)   # only where the surface rolls toward the light (flat tops stay dark)
    spec = ndh ** 70 * 1.1 + sstep(0.0, 0.25, tilt) * (0.1 + sheen)
    # colour by thickness: see-through bright red at the thin edges, near black where it's thick
    thick = sstep(0.6, 6.0, d) * 0.7 + sstep(1.0, 3.0, f) * 0.3
    base = P["thin"] * (1 - sstep(0, 0.45, thick))[..., None] + P["body"] * (sstep(0, 0.45, thick) * (1 - sstep(0.45, 1, thick)))[..., None] + P["deep"] * sstep(0.45, 1, thick)[..., None]
    lit = np.clip(0.62 + 0.55 * (ndl - L[2]) / (1 - L[2] + 1e-3), 0.35, 1.25)
    col = base * lit[..., None]
    if rim > 0:  # coagulated edge: a darker band just inside the rim
        band = sstep(0.0, 1.2, d) * (1 - sstep(1.6, 4.5, d))
        col = col * (1 - band * rim)[..., None] + P["deep"] * (band * rim * 0.6)[..., None]
    col = col + (P["spec"] - col) * np.clip(spec * gl * sstep(0.4, 1.4, d), 0, 1)[..., None]
    alpha = a * (0.6 + 0.4 * sstep(0.2, 2.2, d))  # thin edges are see-through
    # mist (behind the liquid)
    mf = gaussian_filter(F.m, 1.2 * SS)
    ma = np.clip(mf * mist_a, 0, 0.55)
    out_a = alpha + ma * (1 - alpha)
    out_c = (col * alpha[..., None] + P["mist"] * (ma * (1 - alpha))[..., None]) / np.maximum(out_a, 1e-4)[..., None]
    out_a = out_a * fade
    arr = np.dstack([np.clip(out_c, 0, 1), np.clip(out_a, 0, 1)])
    im = Image.fromarray((arr * 255).astype(np.uint8), "RGBA")
    return im.resize((F.W, F.H), Image.LANCZOS)


def strip(frames, name):
    fw, fh = frames[0].size
    s = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f, (i * fw, 0))
    save(s, name)


def save(im, name, q=84):
    p = os.path.join(OUT, name + ".webp")
    im.save(p, "WEBP", quality=q, method=6, alpha_quality=92)
    im.save(os.path.join(OUT, "_" + name + ".png"))
    print(name, im.size, os.path.getsize(p) // 1024, "KB")


# ------------------------------------------------------------------ a spray from a wound (side view, flies to the right)
def burst(name, seed, size, frames, pal, origin=(0.3, 0.55), spread=1.0, up=0.35, n_drops=90, n_lig=6, n_mist=140,
          speed=1.0, T=0.5, sheet=1.0, stream=0.0):
    rng = np.random.default_rng(seed)
    W = H = size
    ox, oy = origin[0] * W, origin[1] * H
    g = W * 2.3
    # droplets: a few big slow ones, many small fast ones
    ang = -up + rng.normal(0, spread * 0.42, n_drops)
    sp = W * speed * (1.4 + rng.lognormal(0, 0.45, n_drops) * 1.8)
    rad = np.clip(rng.lognormal(0.25, 0.6, n_drops) * W / 120, W / 400, W / 24) * np.clip(1.5 - sp / (W * speed * 2.2), 0.45, 1.3)
    t0 = rng.uniform(0, 0.05, n_drops)
    # ligaments: ropes of liquid that stretch and break into beads
    lang = -up + rng.normal(0, spread * 0.32, n_lig)
    lv1 = W * speed * rng.uniform(2.6, 4.2, n_lig)
    lv0 = lv1 * rng.uniform(0.18, 0.4, n_lig)
    lr = W / 52 * rng.uniform(0.7, 1.3, n_lig)
    lph = rng.uniform(0, 6.28, n_lig)
    # mist
    mang = -up * 0.6 + rng.normal(0, spread * 0.55, n_mist)
    msp = W * speed * rng.uniform(0.8, 2.6, n_mist)
    out = []
    for fi in range(frames):
        t = (fi + 0.9) / frames * T
        F = Field(W, H)
        fade = 1 - sstep(0.55 * T, T, t)
        drag = lambda v, tt, k=4.5: v * (1 - math.exp(-k * tt)) / k
        # the sheet right at the wound, early: an irregular tongue that tears into the ligaments
        if t < 0.2 * sheet + 0.02:
            k = 1 - t / (0.2 * sheet + 0.02)
            for j in range(14):
                a = -up + (j / 13 - 0.5) * spread * 1.1 + rng.normal(0, 0.05)
                rr = W * (0.05 + 0.16 * (1 - k) * (0.6 + 0.4 * math.sin(j * 2.3 + seed)))
                F.stamp(ox + math.cos(a) * rr * 0.7, oy + math.sin(a) * rr * 0.7, W / 34 * (0.5 + k), W / 48 * (0.5 + k), a, 1.1)
        # a continuous stream (arterial jet) leaving the wound
        if stream > 0 and t < T * 0.7:
            pts = []
            for j in range(26):
                age = min(t, j * 0.012)
                v0 = W * speed * 4.0
                x = ox + drag(v0 * math.cos(-up * 0.6), age, 1.2)
                y = oy + drag(v0 * math.sin(-up * 0.6), age, 1.2) + 0.5 * g * age * age
                pts.append((x, y, age))
            for j in range(len(pts) - 1):
                (xa, ya, aa), (xb, yb, _) = pts[j], pts[j + 1]
                r = W / 55 * stream * (1 - j / 26) ** 0.6 * (1 + 0.45 * math.sin(j * 1.9 + t * 40)) * (1 - t / (T * 0.7))
                if r * (1 - aa * 2.5) > W / 300:
                    F.capsule(xa, ya, xb, yb, r, r * 0.9)
                elif j % 2 == 0:
                    F.drop(xa, ya, xb - xa, yb - ya, r * 1.3, 0.25)
        for i in range(n_lig):
            K = 12
            prev = None
            for j in range(K + 1):
                u = j / K
                v = lv0[i] + (lv1[i] - lv0[i]) * u
                a = lang[i] + (u - 0.5) * 0.08 + math.sin(u * 5 + lph[i]) * 0.04
                x = ox + drag(v * math.cos(a), t)
                y = oy + drag(v * math.sin(a), t) + 0.5 * g * t * t
                Lnow = (lv1[i] - lv0[i]) * (1 - math.exp(-4.5 * t)) / 4.5 + 1e-3
                L0 = W * 0.03
                r = lr[i] * math.sqrt(L0 / (L0 + Lnow)) * (1 + 0.55 * math.sin(u * 19 + lph[i])) * (1.6 if j == K else 1)
                if prev is not None:
                    px, py, pr = prev
                    if lr[i] * math.sqrt(L0 / (L0 + Lnow)) > W / 120 and j > 1:   # still a rope
                        F.capsule(px, py, x, y, pr, r)
                    else:   # broken into beads
                        F.drop(x, y, (x - px) * 30, (y - py) * 30, lr[i] * (0.42 + 0.25 * (j == K)) * (0.7 + 0.6 * ((j * 7 + i) % 5) / 5), 0.004)
                prev = (x, y, max(0.3, r))
        for i in range(n_drops):
            tt = t - t0[i]
            if tt <= 0:
                continue
            vx0, vy0 = math.cos(ang[i]) * sp[i], math.sin(ang[i]) * sp[i]
            x = ox + drag(vx0, tt)
            y = oy + drag(vy0, tt) + 0.5 * g * tt * tt
            vx, vy = vx0 * math.exp(-4.5 * tt), vy0 * math.exp(-4.5 * tt) + g * tt
            r = rad[i] * min(1, tt / 0.03 + 0.3)
            F.drop(x, y, vx, vy, r, 1.0 / (W * 1.6))
        for i in range(n_mist):
            tt = t * (0.8 + 0.4 * ((i * 13) % 7) / 7)
            x = ox + drag(math.cos(mang[i]) * msp[i], tt, 4.0)
            y = oy + drag(math.sin(mang[i]) * msp[i], tt, 4.0) + 0.12 * g * tt * tt
            F.stamp(x, y, W / 110 * (1 + tt * 9), mist=True, wgt=0.5 * (1 - t / T) * min(1, t * 25))
            if i % 4 == 0:   # specks in the mist
                F.stamp(x, y, W / 330 * (1 + (i % 3)), wgt=0.9)
        out.append(shade(F, pal, fade=fade))
    strip(out, name)
    return out


def mist(name, seed, size, frames, pal, T=0.35):
    rng = np.random.default_rng(seed)
    W = H = size
    ox, oy = W * 0.35, H * 0.52
    n = 160
    ang = -0.2 + rng.normal(0, 0.6, n)
    sp = W * rng.uniform(0.3, 1.3, n)
    out = []
    for fi in range(frames):
        t = (fi + 0.5) / frames * T
        F = Field(W, H)
        for i in range(n):
            tt = t * (0.7 + 0.6 * ((i * 11) % 9) / 9)
            k = (1 - math.exp(-5 * tt)) / 5
            x, y = ox + math.cos(ang[i]) * sp[i] * k, oy + math.sin(ang[i]) * sp[i] * k + W * 0.3 * tt * tt
            F.stamp(x, y, W / 70 * (1 + tt * 7), mist=True, wgt=0.55)
            if i % 3 == 0:
                F.stamp(x, y, W / 260 * (1 + i % 2), wgt=0.85)
        out.append(shade(F, pal, fade=1 - sstep(0.35 * T, T, t), mist_a=0.38))
    strip(out, name)


# ------------------------------------------------------------------ decals (seen from above; the game squashes them flat)
def fbm(rng, D, octaves=4):
    out = np.zeros((D * SS, D * SS), np.float32)
    for o in range(octaves):
        s = 2 ** o
        n = rng.normal(0, 1, (D * SS, D * SS)).astype(np.float32)
        out += gaussian_filter(n, D * SS / (14 * s)) * (0.55 ** o)
    out /= np.abs(out).max() + 1e-6
    return out


def decal(rng, D, pal, kind):
    F = Field(D, D)
    cx, cy = D / 2, D / 2
    if kind == "spray":   # spatter thrown along +x: an impact smear, then drops with tails, smaller further out
        hx = cx - D * 0.3
        for k in range(16):
            F.stamp(hx + rng.uniform(-0.03, 0.09) * D, cy + rng.normal(0, 0.03) * D, D * rng.uniform(0.025, 0.05), D * rng.uniform(0.015, 0.03), rng.normal(0, 0.25))
        for i in range(150):
            a = rng.normal(0, 0.28)
            dist = (0.07 + rng.pareto(2.2) * 0.13) * D
            if dist > 0.68 * D:
                continue
            r = D / 95 * rng.lognormal(0, 0.5) * max(0.3, 1.1 - dist / D * 1.3)
            el = 1 + dist / D * 3.5
            x, y = hx + math.cos(a) * dist, cy + math.sin(a) * dist
            F.stamp(x, y, r * el * 0.8, r, a)
            if el > 1.7 and rng.random() < 0.5:   # the tail points the way it was flying, with a little bead at the end
                L = r * el * 1.1
                F.capsule(x, y, x + math.cos(a) * L, y + math.sin(a) * L, r * 0.45, r * 0.15)
                F.stamp(x + math.cos(a) * L * 1.25, y + math.sin(a) * L * 1.25, r * 0.32)
        im = shade(F, pal, flat=0.45, gloss=0.9)
        return im
    # splat / pool: a lobed main shape from a noisy field
    base = D * (0.2 if kind == "pool" else 0.12)
    nb = int(rng.integers(3, 6)) if kind == "pool" else int(rng.integers(2, 4))
    for b in range(nb):
        ox_, oy_ = (rng.normal(0, 0.55) * base, rng.normal(0, 0.35) * base) if b else (0, 0)
        rr = base * (rng.uniform(0.45, 0.8) if b else 1)
        F.stamp(cx + ox_, cy + oy_, rr * 1.15, rr, rng.uniform(0, 3.14), 1.6)
    noise = fbm(rng, D)
    F.f += noise * (0.55 if kind == "pool" else 0.35) * np.clip(F.f * 2.2, 0, 1)
    # spines and satellites (a drop that hit hard): thin rays ending in a bead
    for k in range(int(rng.integers(18, 30)) if kind == "splat" else 0):   # scallops on the edge
        a = rng.uniform(0, 6.283); rr = base * rng.uniform(0.85, 1.05)
        F.stamp(cx + math.cos(a) * rr, cy + math.sin(a) * rr, base * rng.uniform(0.12, 0.24), wgt=1.2)
    nsp = int(rng.integers(5, 11)) if kind == "splat" else int(rng.integers(2, 6))
    for _ in range(nsp):
        a = rng.uniform(0, 6.283)
        L0 = base * rng.uniform(0.8, 1.05)
        L1 = L0 + D * rng.uniform(0.03, 0.1) * (0.5 if kind == "pool" else 1)
        w = base * rng.uniform(0.09, 0.16)
        F.capsule(cx + math.cos(a) * L0, cy + math.sin(a) * L0, cx + math.cos(a) * L1, cy + math.sin(a) * L1, w, w * 0.35)
        F.stamp(cx + math.cos(a) * (L1 + w * 0.8), cy + math.sin(a) * (L1 + w * 0.8), w * rng.uniform(0.6, 1.2))
    ns = 70 if kind == "splat" else 26
    for _ in range(ns):
        a = rng.uniform(0, 6.283)
        dd = base * rng.uniform(1.25, 3.2 if kind == "splat" else 1.9)
        r = D / 300 * rng.lognormal(0.3, 0.6) * max(0.3, 2.2 - dd / base * 0.5)
        x, y = cx + math.cos(a) * dd, cy + math.sin(a) * dd
        if D * 0.05 < x < D * 0.95 and D * 0.05 < y < D * 0.95:
            F.stamp(x, y, r * rng.uniform(1, 1.5), r, a)
    if kind == "pool":
        return shade(F, pal, rim=0.55, flat=0.6, sheen=0.35)
    return shade(F, pal, rim=0.3, flat=0.6, sheen=0.1)


def decals(name, pal, D, seed):
    rng = np.random.default_rng(seed)
    kinds = ["splat", "splat", "pool", "spray", "splat", "pool", "spray", "splat"]
    sheet = Image.new("RGBA", (D * 4, D * 2), (0, 0, 0, 0))
    for i, k in enumerate(kinds):
        sheet.paste(decal(rng, D, pal, k), ((i % 4) * D, (i // 4) * D))
    save(sheet, name)


# ------------------------------------------------------------------ single flying drops (head right) and body stains
def drops(name, pal, C=48, seed=3):
    rng = np.random.default_rng(seed)
    sheet = Image.new("RGBA", (C * 4, C * 2), (0, 0, 0, 0))
    for row in range(2):
        for i, el in enumerate((0.0, 0.8, 1.6, 2.6)):
            F = Field(C, C)
            r = C * (0.15 if row == 0 else 0.13)
            hx = C * (0.5 + 0.12 * min(1, el))
            F.drop(hx, C / 2, el, 0, r, 1.0)
            if row == 1 and el > 1:   # a tiny satellite bead behind
                F.stamp(hx - r * (el + 1.6) * 1.1, C / 2 + rng.normal(0, 0.6), r * 0.28)
            sheet.paste(shade(F, pal), (i * C, row * C))
    save(sheet, name)


def drips(name, pal, Cw=128, Ch=160, seed=5):
    rng = np.random.default_rng(seed)
    sheet = Image.new("RGBA", (Cw * 4, Ch), (0, 0, 0, 0))
    for c in range(4):
        F = Field(Cw, Ch)
        cx, cy = Cw / 2, Ch * 0.26
        for b in range(int(rng.integers(3, 6))):
            F.stamp(cx + rng.normal(0, 0.12) * Cw, cy + rng.normal(0, 0.06) * Ch, Cw * rng.uniform(0.08, 0.15), Cw * rng.uniform(0.06, 0.11), rng.uniform(0, 3.14), 1.4)
        for _ in range(40):
            a = rng.uniform(0, 6.283); dd = Cw * rng.uniform(0.16, 0.36)
            F.stamp(cx + math.cos(a) * dd, cy + math.sin(a) * dd * 0.7, Cw * rng.uniform(0.006, 0.02))
        for _ in range(int(rng.integers(2, 5))):   # runs: they wander a little, thin out and end in a bead
            x = cx + rng.normal(0, 0.12) * Cw
            y = cy + Ch * 0.04
            L = Ch * rng.uniform(0.25, 0.62)
            w = Cw * rng.uniform(0.02, 0.035)
            steps = 18
            for j in range(steps):
                y1 = y + L / steps
                x1 = x + rng.normal(0, 0.6)
                F.capsule(x, y, x1, y1, w, w * 0.97)
                x, y = x1, y1
                w *= 0.975
            F.stamp(x, y + w, w * 1.7, w * 1.9)
        sheet.paste(shade(F, pal, flat=0.5, gloss=0.75, rim=0.25), (c * Cw, 0))
    save(sheet, name)


# ------------------------------------------------------------------ preview on a dark, game-like background
def contact(names, path, bg=(34, 30, 27)):
    ims = []
    for n in names:
        p = os.path.join(OUT, "_" + n + ".png")
        if os.path.exists(p):
            ims.append((n, Image.open(p)))
    Wd = 1600
    rows = []
    for n, im in ims:
        k = min(1.0, Wd / im.width)
        rows.append(im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS))
    Ht = sum(r.height + 8 for r in rows)
    sheet = Image.new("RGB", (Wd, Ht), bg)
    # a faint stone floor gradient so translucency reads
    g = np.linspace(0, 1, Ht)[:, None, None] * np.array([12, 10, 8])[None, None, :]
    sheet = Image.fromarray(np.clip(np.asarray(sheet).astype(np.float32) + g, 0, 255).astype(np.uint8))
    y = 0
    for r in rows:
        sheet.paste(r, (0, y), r)
        y += r.height + 8
    sheet.save(path, quality=88)
    print("contact", path)


if __name__ == "__main__":
    only = set(sys.argv[2:])
    want = lambda n: not only or n in only
    B = PAL["blood"]
    if want("blood"):
        burst("gfx-blood-burst-1", 11, 256, 10, B, spread=1.1, n_drops=90, n_lig=6)
        burst("gfx-blood-burst-2", 23, 256, 10, B, spread=0.7, n_drops=80, n_lig=7, speed=1.15)
        burst("gfx-blood-burst-3", 37, 256, 12, B, origin=(0.38, 0.52), spread=1.8, up=0.55, n_drops=130, n_lig=9, speed=0.95, T=0.6, sheet=1.3)
        burst("gfx-blood-spray", 51, 256, 8, B, origin=(0.1, 0.45), spread=0.3, up=0.25, n_drops=60, n_lig=4, n_mist=70, speed=1.3, T=0.45, stream=1.0)
        mist("gfx-blood-mist", 61, 192, 8, B)
    if want("other"):
        burst("gfx-oil-burst", 71, 192, 10, PAL["oil"], spread=1.0, n_drops=70, n_lig=5)
        burst("gfx-green-burst", 72, 192, 10, PAL["green"], spread=1.0, n_drops=70, n_lig=5)
        burst("gfx-ichor-burst", 73, 192, 10, PAL["ichor"], spread=1.0, n_drops=70, n_lig=5)
        burst("gfx-sap-burst", 74, 192, 10, PAL["sap"], spread=1.0, n_drops=60, n_lig=5)
    if want("decals"):
        decals("gfx-blood-decals", B, 384, 7)
        decals("gfx-oil-decals", PAL["oil"], 192, 9)
        decals("gfx-green-decals", PAL["green"], 192, 11)
        decals("gfx-ichor-decals", PAL["ichor"], 192, 12)
        decals("gfx-sap-decals", PAL["sap"], 192, 13)
    if want("drops"):
        drops("gfx-blood-drops", B)
        for m in ("oil", "green", "ichor", "sap"):
            drops(f"gfx-{m}-drops", PAL[m])
    if want("drips"):
        drips("gfx-blood-drips", B)
    if want("sheet") or not only:
        contact(["gfx-blood-burst-1", "gfx-blood-burst-2", "gfx-blood-burst-3", "gfx-blood-spray", "gfx-blood-mist",
                 "gfx-blood-decals", "gfx-blood-drops", "gfx-blood-drips", "gfx-oil-burst", "gfx-green-burst",
                 "gfx-ichor-burst", "gfx-sap-burst", "gfx-oil-decals"], os.path.join(OUT, "_contact_sheet.jpg"))
