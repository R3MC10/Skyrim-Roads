"""Pixel check for performance work: the same map views drawn by two builds must match.
Usage: python perf_same_ui.py PORT_A PORT_B   (serve the build to check on A and a reference build on B)
Time is frozen (Playwright clock) so clouds, birds and water glints stand still; the map is panned and zoomed so the
cached layers (ground, fog) are slid, not freshly drawn. Fails if any view differs by more than a rounding hair."""
import asyncio, sys, os
from playwright.async_api import async_playwright
from PIL import Image, ImageChops
A, B = sys.argv[1], sys.argv[2]
OUT = os.environ.get("SAME_OUT", "/tmp/perf_same")
async def shots(p, port):
    b = await p.chromium.launch(args=["--no-sandbox"])
    ctx = await b.new_context(viewport={"width": 360, "height": 800}, device_scale_factor=2, has_touch=True, reduced_motion="reduce")   # still clouds and birds: only the caches differ
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{port}/index.html?net=bc&notut&p=same{port}"); await pg.wait_for_selector(".press")
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Same"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
      for (const n of Object.keys(WORLD.places).slice(0, 80)) if (!S.discovered.includes(n)) S.discovered.push(n); Store.save(S); }""")
    await pg.wait_for_timeout(600); await pg.reload(); await pg.wait_for_selector(".press")
    await pg.click(".press"); await pg.wait_for_timeout(300)
    await pg.wait_for_selector(".mi[data-t=continue]"); await pg.click(".mi[data-t=continue]")
    await pg.wait_for_timeout(3000); await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate("()=>{ if (typeof TABMENU!=='undefined' && TABMENU.closeHub) TABMENU.closeHub(); const t=document.querySelector('[data-tab=world]'); t && t.click(); scrollTo(0,0); }")
    await pg.wait_for_timeout(1500)
    out = []
    box = await pg.evaluate("(()=>{const r=document.querySelector('#map').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}})()")
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    async def snap(name):
        await pg.wait_for_timeout(1200)   # settle (map tiles, caches)
        await pg.evaluate("document.querySelectorAll('.tip,#tooltip,.toast').forEach(e=>e.remove())")
        path = f"{OUT}/{port}_{name}.png"; await pg.screenshot(path=path, clip=box); out.append((name, path))
    await snap("rest")
    for i, (dx, dy) in enumerate([(-37, 21), (53, -44), (12, 90)]):
        await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.move(cx + dx, cy + dy, steps=6); await pg.mouse.up()
        await snap(f"pan{i}")
    await pg.mouse.move(cx, cy); await pg.mouse.wheel(0, -300); await snap("zoomin")
    await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.move(cx - 23, cy + 31, steps=5); await pg.mouse.up(); await snap("zoomin_pan")
    await b.close(); return out, errs
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        ra, ea = await shots(p, A); rb, eb = await shots(p, B)
    bad = 0
    for (n, pa), (_, pb) in zip(ra, rb):
        ia, ib = Image.open(pa).convert("RGB"), Image.open(pb).convert("RGB")
        if ia.size != ib.size: print(n, "size differs", ia.size, ib.size); bad += 1; continue
        h = ImageChops.difference(ia, ib).convert("L").histogram(); n_ = sum(h)
        mean = sum(i * v for i, v in enumerate(h)) / n_; big = sum(h[24:]) / n_
        print(f"{n:12s} mean {mean:.3f}  >24/255: {big*100:.3f}%  max {max(i for i, v in enumerate(h) if v)}")
        if big > 0.01: bad += 1
    if ea or eb: print("page errors", ea[:3], eb[:3])
    print("FAIL" if bad else "OK: same picture"); sys.exit(1 if bad else 0)
if __name__ == "__main__":
    asyncio.run(main())
