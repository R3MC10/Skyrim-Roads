import asyncio
import sys
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:" + PORT + "/index.html?p=fe1&notut"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(3200)
        print("toast:", await pg.evaluate("document.querySelector('#toast')?.textContent"))
        print("weather:", await pg.inner_text("#clock"))
        for _ in range(5):
            if await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
        await pg.evaluate("()=>{const S=window.__dbg.save(); FEST.count(S,'arrive',7);}")
        await pg.click("[data-tab=log]"); await pg.click("[data-act=jtab][data-id=misc]"); await pg.wait_for_timeout(300)   # events sit under Journal → Misc
        el = await pg.query_selector("#side .panel"); await el.screenshot(path="fest_panel.png")
        await pg.evaluate("()=>{const S=window.__dbg.save(); FEST.count(S,'arrive',1);}"); await pg.click("[data-tab=map]"); await pg.click("[data-tab=log]"); await pg.click("[data-act=jtab][data-id=misc]"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=festclaim]"); await pg.wait_for_timeout(300)
        print("claim:", await pg.evaluate("document.querySelector('#toast')?.textContent"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
