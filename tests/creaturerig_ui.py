"""Painted creature rigs (creaturerig.js): frame strips of every painted creature through its clips (idle, attack wind-up,
strike, follow-through, hit, stagger, death), cut-up rig vs the old sliced picture, plus checks that the cut-up path is
really used and draws without errors.  Sheets go to tests/out_creaturerig/.  Usage: python3 creaturerig_ui.py PORT"""
import asyncio, sys, os, io, base64
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_creaturerig") + os.sep
os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
CRE = [("wolf", "wolf", "Lone wolf"), ("sabrecat", "cat", "Sabre cat"), ("skeever", "skeever", "Skeever"), ("bear", "bear", "Black bear"),
       ("mammoth", "mammoth", "Mammoth"), ("horker", "beast", "Horker"), ("troll", "troll", "Troll"), ("frosttroll", "troll", "Frost troll"),
       ("giant", "giant", "Giant"), ("centurion", "centurion", "Dwarven Centurion"), ("frostatronach", "atronach", "Frost Atronach"),
       ("flameatronach", "atronach", "Flame Atronach"), ("stormatronach", "atronach", "Storm Atronach"), ("spider", "spider", "Frostbite spider"),
       ("chaurus", "spider", "Chaurus"), ("dwarvenspider", "dspider", "Dwarven Spider"), ("mudcrab", "crab", "Mudcrab"),
       ("icewraith", "wisp", "Ice Wraith"), ("dragon", "dragon", "Dragon")]
FRAMES = [("idle", None, 0.5), ("wind", "A", 0.25), ("strike", "A", 0.48), ("after", "A", 0.7), ("hit", "hit", 0.3), ("stagger", "stagger", 0.4), ("death", "death", 0.6)]
PAGE = f"""<!doctype html><html><body style="margin:0;background:#334">
<script src="http://localhost:{PORT}/art.js"></script><script src="http://localhost:{PORT}/creaturerigdata.js"></script>
<script src="http://localhost:{PORT}/creaturerig.js"></script><script src="http://localhost:{PORT}/foerig.js"></script>
<canvas id="c" width="220" height="210"></canvas></body></html>"""
JS = r"""async ([slug, fk, name, frames, useRig]) => {
  const im = new Image(); im.src = location.origin === 'null' ? '' : '';
  const url = 'http://localhost:__PORT__/foe-' + slug + '.webp';
  await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = url; });
  const ctl = FOERIG.ctl(fk, name), cv = document.getElementById('c'), g = cv.getContext('2d'), out = [];
  const errs = [];
  const real = CREATURERIG.draw; let used = 0;
  CREATURERIG.draw = (...a) => { if (!useRig) return false; const r = real(...a); if (r) used++; return r; };
  const atk = ctl.clipFor('default');
  const picH = slug === 'dragon' ? 120 : 66;
  for (const [lab, clip, u] of frames) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = '#3a4a3a'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#2a332a'; g.fillRect(0, 186, cv.width, 30);
    const s = slug === 'dragon' ? 1.2 : 2.3;
    g.save(); g.translate(110, 188); g.scale(-s, s);
    try { ctl.draw(g, { t: 1.3, clip: clip === 'A' ? atk : clip, u, hitU: 0.48, kit: { weapon(){}, foeFig(){}, gearTorso(){} }, pose: null, pic: im, picKey: 'foe-' + slug, picH }); }
    catch (e) { errs.push(lab + ': ' + e.message); }
    g.restore();
    out.push(cv.toDataURL('image/png'));
  }
  CREATURERIG.draw = real;
  return { out, used, errs, atk };
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route(f"http://localhost:{PORT}/__creaturerig.html", lambda r: r.fulfill(status=200, content_type="text/html", body=PAGE))
        await pg.goto(f"http://localhost:{PORT}/__creaturerig.html")
        await pg.wait_for_function("typeof FOERIG!=='undefined' && typeof CREATURERIG!=='undefined'")
        rows = []
        for slug, fk, name in CRE:
            row = []
            for use in (True, False):
                r = await pg.evaluate(JS.replace("__PORT__", PORT), [slug, fk, name, [[a, b2, c] for a, b2, c in FRAMES], use])
                if use:
                    ok(r["used"] == len(FRAMES), f"{slug}: cut-up rig drew all {len(FRAMES)} frames (attack clip {r['atk']})")
                    ok(not r["errs"], f"{slug}: no errors {r['errs'][:2]}")
                row.append([Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))) for d in r["out"]])
            rows.append((slug, row))
        ok(not errs, f"no page errors {errs[:3]}")
        # one sheet per creature group: top row = cut-up rig, bottom row = old slices
        w, h = 220, 210
        for gi in range(0, len(rows), 5):
            grp = rows[gi:gi + 5]
            im = Image.new("RGB", (len(FRAMES) * (w + 4) + 4, len(grp) * (2 * h + 30) + 20), (17, 17, 17)); d = ImageDraw.Draw(im)
            for j, (lab, _, _) in enumerate(FRAMES): d.text((8 + j * (w + 4), 4), lab, fill=(220, 220, 220))
            for i, (slug, (rig, old)) in enumerate(grp):
                y = 20 + i * (2 * h + 30); d.text((6, y), slug + "  (top: parts rig, bottom: old slices)", fill=(240, 220, 160))
                for j, sh in enumerate(rig): im.paste(sh.convert("RGB"), (4 + j * (w + 4), y + 14))
                for j, sh in enumerate(old): im.paste(sh.convert("RGB"), (4 + j * (w + 4), y + 14 + h + 2))
            im.save(f"{OUT}strip{gi // 5}.png")
        await b.close()
    print("RESULT", "OK" if not fails else "FAILED %d" % len(fails))
asyncio.run(main())
