"""Map hero animation strip (maphero.js + horseart.js motion): the hero on the world map drawn big, frame by frame,
standing on foot, walking, on a standing horse (breathing, head toss, tail flick), walking and galloping (legs swing,
body rocks), so you can see it move. One row per state, phone (390 wide, dpr 2) and PC.
Run:  node tests/serve.js 9562   then   python tests/mapheroanim_ui.py 9562 [outdir]
Fails on page errors, a blank figure, or a horse that doesn't change between frames."""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9562"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "mapheroanim_shots")
os.makedirs(OUT, exist_ok=True)

# draws every state as a row of frames on a fresh canvas; returns how many different pictures each row had
DRAW = """async (cw)=>{
  const coat = 'black';
  for (let i = 0; i < 60 && !(HORSEART.ok(coat, 'stand') && HORSEART.ok(coat, 'gallop')); i++) { HORSEART.sig(); await new Promise(r => setTimeout(r, 200)); }
  HORSEART.sig();
  const S = __dbg.save(), look = HEROART.lookOf(S), col = HORSES.coat(coat)[2];
  const rows = [
    ['foot idle', { moving: false }, 2.4], ['foot walk', { moving: true, heading: 0 }, 0.9],
    ['horse idle', { horse: col, moving: false }, 6], ['horse walk', { horse: col, moving: true, heading: 0 }, 1.1],
    ['horse gallop', { horse: col, moving: true, gallop: true, heading: 0 }, 0.5],
  ];
  const N = 6, cellW = cw / N, cellH = cellW * 0.95, dpr = devicePixelRatio || 1;
  const c = document.createElement('canvas'); c.id = 'mhastrip'; c.width = cw * dpr; c.height = cellH * rows.length * dpr;
  c.style.cssText = `position:fixed;left:0;top:0;width:${cw}px;height:${cellH * rows.length}px;z-index:99999;background:#c9b58a`;
  document.body.appendChild(c);
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const diffs = {};
  rows.forEach(([name, o, per], r) => {
    const seen = new Set();
    for (let i = 0; i < N; i++) {
      const x = cellW * (i + 0.5), y = cellH * (r + 0.9);
      g.save(); g.beginPath(); g.rect(cellW * i, cellH * r, cellW, cellH); g.clip();
      g.fillStyle = (i + r) % 2 ? '#c9b58a' : '#c2ad80'; g.fillRect(cellW * i, cellH * r, cellW, cellH);
      MAPHERO.figure(g, { id: 'strip' + r, look, ...o }, x, y, 3 + per * i / N, { s: 1, scale: cellW / 62 });
      g.restore();
      const px = g.getImageData(cellW * i * dpr, cellH * r * dpr, cellW * dpr, cellH * dpr).data;
      let h = 0; for (let k = 0; k < px.length; k += 16) h = (h * 31 + px[k] + px[k + 1] * 3) >>> 0; seen.add(h);
    }
    g.fillStyle = '#2a1d10'; g.font = '700 12px Georgia'; g.fillText(name, 4, cellH * r + 14);
    diffs[name] = seen.size;
  });
  return { diffs, h: cellH * rows.length };
}"""

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for tag, vw, vh, dsf in [("phone", 390, 844, 2), ("pc", 1280, 800, 1)]:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=dsf)
            pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?assets&notut&p=mha{tag}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "R3MC10"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            cw = min(vw, 900)
            r = await pg.evaluate(DRAW, cw)
            print(tag, "different frames per row:", r["diffs"])
            await pg.screenshot(path=os.path.join(OUT, f"{tag}_anim_strip.png"), clip={"x": 0, "y": 0, "width": cw, "height": min(vh, r["h"])})
            for name, n in r["diffs"].items():
                if n < 4: fails.append(f"{tag}: {name} barely moves ({n} different frames of 6)")
            if errs: fails.append(f"{tag}: page errors {errs[:4]}")
            await ctx.close()
        await b.close()
    print("screenshots in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("OK")

asyncio.run(main())
