import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs=[]
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html?p=q7"); await pg.wait_for_timeout(2500)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(4000)
        if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]")
        await pg.evaluate("() => { const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; }")
        await pg.wait_for_timeout(3500)
        if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]")
        await pg.click("[data-tab=log]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=qjoin]"); await pg.wait_for_timeout(300); await pg.click("[data-act=close]")
        await pg.click("[data-tab=map]"); await pg.click("[data-tab=log]"); await pg.wait_for_timeout(300)
        await pg.screenshot(path="/home/claude/tests/q_journal.png", full_page=True)
        await pg.click("[data-act=qtalk]"); await pg.wait_for_timeout(500)
        print((await pg.inner_text("#modal"))[:200].replace("\n"," | "))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
