import asyncio, sys, base64
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8830"
OUT = "/home/claude/tests/map11_"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=m11"); await pg.wait_for_timeout(2000)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Cartographer"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        # the whole painted map, full size
        data = await pg.evaluate("()=>WorldMap.base().toDataURL('image/png')")
        open(OUT + "full.png", "wb").write(base64.b64decode(data.split(",")[1]))
        await pg.evaluate("()=>{const S=window.__dbg.save(); for(const n of Object.keys(WORLD.places)) if(!S.discovered.includes(n)) S.discovered.push(n); S.explored=Object.values(WORLD.places).map(p=>[p[0],p[1]]);}")
        async def clear(): await pg.evaluate("document.querySelectorAll('#modal,.modal').forEach(m=>m.remove())")
        async def shot(name):
            await clear(); await pg.wait_for_timeout(700)
            el = await pg.query_selector("#mapwrap"); await el.screenshot(path=OUT + name + ".png")
        await shot("ink_near")
        await pg.click("#zoomBtn"); await pg.wait_for_timeout(700); await shot("ink_far"); await pg.click("#zoomBtn"); await pg.wait_for_timeout(400)
        # roam into Hammerfell is refused, roam inside works
        r = await pg.evaluate("()=>{const S=window.__dbg.save(); return [ROAM.plan(S,[0.15,0.85]).err||'', ROAM.plan(S,[0.6,0.6]).pos ? 'ok':'no']}")
        print("roam:", r)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
