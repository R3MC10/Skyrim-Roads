import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=art"); await pg.wait_for_timeout(1500)
        await pg.evaluate("""()=>{ const draw=(g,H,w,h)=>{ H.sky(g,w,h,'dusk'); H.mountains(g,w,h*0.75,h*0.45,4); H.pines(g,w,h*0.85,14,5,18); H.poly(g,[[w*0.4,h*0.95],[w*0.5,h*0.55],[w*0.6,h*0.95]],H.ember); };
          for (const st of ['ink']) { const c=ART.canvas(360,180,draw,{style:st}); c.id='t_'+st; document.body.prepend(c); } }""")
        await pg.wait_for_timeout(300)
        import base64
        for st in ["ink"]:
            u = await pg.evaluate(f"document.querySelector('#t_{st}').toDataURL()")
            open(f"art_{st}.png","wb").write(base64.b64decode(u.split(",")[1]))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
