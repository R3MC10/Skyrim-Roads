"""The map on the GPU (glmap.js) against the classic 2D map: same picture, taps work, fallbacks.
Usage: python glmap_ui.py PORT
Each mode runs in its own browser with the same frozen clock (Playwright clock: noon, time only moves when the test
moves it), so clouds, birds and water glints sit in the same place in both. Views: rest, pans, zoomed in, zoomed out,
Solstheim (classic on both, the GPU hands it back), fog + clan colours. Side-by-sides: $GLMAP_OUT (default /tmp/glmap).
Checks: GPU frames really were drawn on the GPU (stats), the picture matches (mean difference and share of pixels off by
more than 24/255), a tap on a town still selects it, ?nogl=1 and Classic draw without GL layers, a lost GPU context falls
back to the classic map and comes back when the context is restored."""
import asyncio, sys, os
from playwright.async_api import async_playwright
from PIL import Image, ImageChops
PORT = sys.argv[1] if len(sys.argv) > 1 else "8897"
OUT = os.environ.get("GLMAP_OUT", "/tmp/glmap")
VW, VH, DPR = int(os.environ.get("VW", 360)), int(os.environ.get("VH", 800)), float(os.environ.get("DPR", 2))
fails = []
def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok: fails.append(msg)

async def start(p, mode, extra=""):
    b = await p.chromium.launch(args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = await b.new_context(viewport={"width": VW, "height": VH}, device_scale_factor=DPR, has_touch=True)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.clock.install(time="2026-07-15T12:00:00")
    await pg.add_init_script(f"""(()=>{{ try {{ const p = JSON.parse(localStorage.getItem('rotn_prefs')||'{{}}'); p.gfxEngine = '{mode}'; localStorage.setItem('rotn_prefs', JSON.stringify(p)); }} catch(e) {{}} }})()""")
    # same random numbers in both browsers (snow, sparkles), clear sky (the map's weather is per hold and per half hour)
    await pg.add_init_script("""(()=>{ let x = 12345; Math.random = () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); })()""")
    async def run(ms):
        await pg.clock.run_for(ms)
    pg.run = run
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=glm{mode}{extra}")
    await pg.wait_for_selector(".press")
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Glmap"); await pg.click("#begin"); await run(1500)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
      for (const n of Object.keys(WORLD.places).slice(0, 80)) if (!S.discovered.includes(n)) S.discovered.push(n);
      for (let i = 0; i < 40; i++) S.explored.push([0.3 + (i % 8) * 0.04, 0.35 + Math.floor(i / 8) * 0.05]); Store.save(S); }""")
    await run(600); await pg.reload(); await pg.wait_for_selector(".press")
    await pg.click(".press"); await run(300)
    await pg.wait_for_selector(".mi[data-t=continue]"); await pg.click(".mi[data-t=continue]")
    await run(3000); await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate("()=>{ if (typeof TABMENU!=='undefined' && TABMENU.closeHub) TABMENU.closeHub(); const t=document.querySelector('[data-tab=world]'); t && t.click(); scrollTo(0,0); }")
    await pg.evaluate("()=>{ const w = WEVENTS.weatherAt; WEVENTS.weather = (pos, t) => ({ ...w('Whiterun', t), id: 'clear', name: 'Clear' }); if (typeof SNOWFX !== 'undefined') SNOWFX.draw = () => {}; }")   # (falling snow is drawn the same way on both: not what is compared)
    await run(1500)
    return b, pg, errs

async def views(pg, tag, sol=True):
    out = []
    box = await pg.evaluate("(()=>{const r=document.querySelector('#map').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}})()")
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    async def shot(name, mode):
        await pg.evaluate(f"GLR.pref('gfxEngine', '{mode}')")
        for _ in range(6 if mode == "gpu" else 2): await pg.run(200 if mode == "gpu" else 120)   # settle: tiles, caches, a few frames (the map clock is pinned: same t)
        await pg.evaluate("()=>{ const st=document.createElement('style'); st.id='onlymap'; st.textContent='body *{visibility:hidden!important} #map,#mapgpu,#mapgpu *{visibility:visible!important}'; document.head.append(st); }")
        st = await pg.evaluate("GLMAP.stats()")
        path = f"{OUT}/{mode}_{name}.png"; await pg.screenshot(path=path, clip=box)
        await pg.evaluate("document.getElementById('onlymap').remove()")
        return path, st.get("on", False)
    async def snap(name):
        await pg.evaluate("window.__mapT = 20000 + Math.floor(performance.now() / 1000) * 1000")
        pa, on = await shot(name, "gpu"); pb, onc = await shot(name, "classic")
        if onc: fails.append(f"{name}: GL layers shown on Classic")
        await pg.evaluate("GLR.pref('gfxEngine', 'gpu'); window.__mapT = undefined")
        out.append((name, pa, pb, on))
    for _ in range(15): await pg.run(200)   # the light eases in after the map opens: let it settle first
    await snap("rest")
    for i, (dx, dy) in enumerate([(-37, 21), (53, -44)]):
        await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.move(cx + dx, cy + dy, steps=6); await pg.mouse.up()
        await snap(f"pan{i}")
    await pg.mouse.move(cx, cy); await pg.mouse.wheel(0, -400); await snap("zoomin")
    await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.move(cx - 23, cy + 31, steps=5); await pg.mouse.up(); await snap("zoomin_pan")
    await pg.mouse.move(cx, cy); await pg.mouse.wheel(0, 900); await snap("zoomout")
    if sol:
        await pg.evaluate("()=>{ const S=window.__dbg.save(); const p=WORLD.places['Raven Rock']; if (p) { S.x=p[0]; S.y=p[1]; } }")
        await snap("solstheim")
    return out, box

def diff(pa, pb):
    ia, ib = Image.open(pa).convert("RGB"), Image.open(pb).convert("RGB")
    d = ImageChops.difference(ia, ib).convert("L"); h = d.histogram(); n = sum(h)
    side = Image.new("RGB", (ia.width * 3, ia.height)); side.paste(ia, (0, 0)); side.paste(ib, (ia.width, 0))
    side.paste(Image.eval(d, lambda v: min(255, v * 8)).convert("RGB"), (ia.width * 2, 0))
    side.save(pa.replace(".png", "_side.png"))
    return sum(i * v for i, v in enumerate(h)) / n, sum(h[24:]) / n, max(i for i, v in enumerate(h) if v)

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        bg, pg, eg = await start(p, "gpu")
        sup = await pg.evaluate("GLR.supported()")
        check(sup, "WebGL2 available in this browser")
        rg, box = await views(pg, "both")
        # a tap on a town still selects it: the GPU frame keeps the map's screen <-> world transform
        await pg.evaluate("()=>{ const S=window.__dbg.save(); const p=WORLD.places.Whiterun; S.x=p[0]; S.y=p[1]; }")
        await pg.click("#centerBtn"); [await pg.run(200) for _ in range(6)]
        spot = await pg.evaluate("""()=>{ const c=document.querySelector('#map'), r=c.getBoundingClientRect(), tf=WorldMap.stats().tf, S=window.__dbg.save();
          for (const n of ['Riverwood','Rorikstead','Falkreath','Helgen','Valtheim Towers','Western Watchtower']) { const p=WORLD.places[n]; if (!p || !S.discovered.includes(n)) continue;
            const x=tf.ox+p[0]*WorldMap.W*tf.k, y=tf.oy+p[1]*WorldMap.H*tf.k; if (x>30 && y>90 && x<r.width-70 && y<r.height-30) return {n, x:r.x+x, y:r.y+y}; } return null; }""")
        on0 = (await pg.evaluate("GLMAP.stats()"))["on"]
        if spot:
            await pg.mouse.click(spot["x"], spot["y"]); await pg.run(800)
            txt = await pg.evaluate("[...document.querySelectorAll('.mpanel')].map(e=>e.innerText).join(' | ')")
            check(on0 and spot["n"].lower() in txt.lower(), f"tap on {spot['n']} with the GPU map opens its panel (gpu={on0}, panel {txt[:50]!r})")
        else: check(False, "a town on screen to tap")
        st = await pg.evaluate("GLMAP.stats()")
        check(st["frames"] > 5, f"frames drawn on the GPU: {st['frames']} (uploads {st['uploads']}, lines {st['lines']}, sprites {st['sprites']})")
        # context loss: back to classic, then GL again once restored
        await pg.evaluate("window.__lc = GLMAP._lose(); __lc.loseContext()"); await pg.mouse.move(box["x"] + 50, box["y"] + 50); await pg.run(1200)
        lost = await pg.evaluate("GLMAP.stats()")
        await pg.screenshot(path=f"{OUT}/gpu_lost.png", clip=box)
        im = Image.open(f"{OUT}/gpu_lost.png").convert("L"); ext = im.getextrema()
        check(not lost["on"] and lost["lost"] >= 1 and ext[1] - ext[0] > 60, f"context lost: classic map drawn (on={lost['on']}, lost={lost['lost']}, contrast {ext})")
        await pg.evaluate("__lc.restoreContext()"); await pg.run(1500)
        for _ in range(6): await pg.mouse.move(box["x"] + 60 + _, box["y"] + 60); await pg.run(200)
        back = await pg.evaluate("GLMAP.stats()")
        check(back["restored"] >= 1 and back["on"], f"context restored: GPU map again {back}")
        check(not eg, f"no page errors on the GPU map {eg[:2]}")
        await bg.close()

        bc, pc, ec = await start(p, "classic")
        await pc.run(1500); cst = await pc.evaluate("GLMAP.stats()")
        check(not cst["on"] and cst["frames"] == 0, "Classic engine: no GL layers, nothing drawn on the GPU")
        check(not ec, f"no page errors on the classic map {ec[:2]}")
        await bc.close()
        bn, pn, en = await start(p, "gpu", "&nogl=1")
        await pn.run(1000)
        nst = await pn.evaluate("GLMAP.stats()")
        check(not nst["on"] and nst["frames"] == 0, "?nogl=1: classic drawing")
        await bn.close()

    for n, pa, pb, on in rg:
        mean, big, mx = diff(pa, pb)
        print(f"     {n:12s} gpu={'yes' if on else 'no '} mean {mean:.3f}  >24/255: {big*100:.3f}%  max {mx}")
        check(big < 0.002 and mean < 1.0, f"{n}: same picture on the GPU and the classic map")
    want_gpu = {"rest", "pan0", "pan1", "zoomin", "zoomin_pan", "zoomout"}
    check(all(on for n, _, _, on in rg if n in want_gpu), "settled views were drawn on the GPU")
    print("FAIL" if fails else "OK"); sys.exit(1 if fails else 0)

if __name__ == "__main__":
    asyncio.run(main())
