import asyncio
import sys
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:" + PORT + "/index.html?p=ac1&notut"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(6000)
        print("tutorial off:", await pg.query_selector(".tut") is None)
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.dragons=1; S.stats={...(S.stats||{}),fish:40};}")
        await pg.wait_for_timeout(6000)
        print("toast:", await pg.evaluate("document.querySelector('#toast')?.textContent"))
        for _ in range(5):
            if await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
        await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(300)
        txt = await pg.inner_text("#side"); i = txt.find("ACHIEVEMENTS"); print("hero:", txt[i:i+260].replace("\n"," | "))
        await pg.click("[data-act=achmore]"); await pg.wait_for_timeout(200)
        el = await pg.query_selector_all("#side .panel"); await el[-1].screenshot(path="ach_panel.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
