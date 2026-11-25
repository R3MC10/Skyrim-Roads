import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html?p=tu1"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        async def clear():
            for _ in range(6):
                if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
                elif await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
                else: break
        await clear()
        tip = lambda: pg.evaluate("document.querySelector('.tut')?.innerText.replace(/\\n/g,' | ').slice(0,110)")
        print("1:", await tip())
        el = await pg.query_selector("#side"); await el.screenshot(path="tut1.png")
        await pg.click("[data-act=go][data-place='Whiterun']"); await pg.wait_for_timeout(600); await clear()
        await pg.click("[data-tab=map]"); await pg.wait_for_timeout(300)
        print("2:", await tip())
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;}"); await pg.wait_for_timeout(1500); await clear()
        await pg.click("[data-tab=map]"); await pg.wait_for_timeout(300); print("3:", await tip())
        await clear(); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300); print("4:", await tip())
        await clear(); await pg.click("[data-tab=log]"); await pg.wait_for_timeout(300); print("5:", await tip())
        g0 = await pg.evaluate("window.__dbg.save().gold")
        await clear(); await pg.click("[data-tab=tactics]"); await pg.wait_for_timeout(800)
        print("done:", await pg.evaluate("window.__dbg.save().gold") - g0, await pg.evaluate("document.querySelector('#toast')?.textContent"), "| tip now:", await tip())
        if await pg.query_selector("[data-act=guideno]"): await pg.click("[data-act=guideno]"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=tutseen]"); await pg.wait_for_timeout(200); print("after Got it:", await tip())
        await clear(); await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(200); print("hero tip:", await tip())
        # a second character skips
        print("errors:", errs)
        await b.close()
asyncio.run(main())
