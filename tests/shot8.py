import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs=[]
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await pg.add_init_script("window.Capacitor={isNativePlatform:()=>true,Plugins:{}};")
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8777/index.html"); await pg.wait_for_timeout(3000)
        await pg.screenshot(path="/home/claude/tests/a2_create.png")
        print("mode:", await pg.evaluate("Store.online"), await pg.evaluate("Store.worldCode"), "P2PNET:", await pg.evaluate("!!window.P2PNET"))
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.click("[data-tab=log]"); await pg.wait_for_timeout(300)
        await pg.screenshot(path="/home/claude/tests/a2_log.png")
        await pg.click("[data-tab=world]"); await pg.click("[data-act=go] >> nth=0"); await pg.wait_for_timeout(2000)
        print("travelling:", await pg.evaluate("window.__dbg.save().trip && window.__dbg.save().trip.destName"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
