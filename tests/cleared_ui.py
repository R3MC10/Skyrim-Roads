import asyncio
import sys
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:" + PORT + "/index.html?net=bc&notut&p=cl"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Cleo"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        name = await pg.evaluate("""()=>{const S=window.__dbg.save(); const ns=Object.keys(WORLD.places).filter(n=>DUNGEONS.enterable(n)); const n=ns[0];
          S.location=n; [S.x,S.y]=WORLD.places[n]; S.discovered.push(...ns.slice(0,4)); S.cleared={[n]:G.now()-3600*20,[ns[1]]:G.now()-DUNGEONS.REFILL_SECONDS+75,[ns[2]]:G.now()-3600*59}; return n;}""")
        await pg.wait_for_timeout(600)
        for _ in range(4):
            if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
        await pg.click("[data-tab=map]"); await pg.wait_for_timeout(500)
        t1 = await pg.evaluate("document.querySelector('.refill')?.innerText"); print("card:", t1)
        await pg.wait_for_timeout(2200)
        print("ticks:", await pg.evaluate("document.querySelector('.refill .cd')?.textContent"))
        el = await pg.query_selector(".refill"); 
        if el: await el.screenshot(path="cleared_card.png")
        await pg.evaluate("()=>window.__ui.go('places')"); await pg.wait_for_timeout(400)   # cleared places: Map → Locations
        print("journal:", await pg.evaluate("document.querySelector('#j-cleared')?.innerText"))
        el = await pg.query_selector("#j-cleared")
        if el: await el.screenshot(path="cleared_journal.png")
        await pg.wait_for_timeout(75000)
        print("after 75s:", await pg.evaluate("document.querySelector('#j-cleared')?.innerText"))
        await pg.click("[data-tab=map]"); await pg.evaluate("()=>{}")
        await pg.wait_for_timeout(500); await pg.screenshot(path="cleared_map.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
