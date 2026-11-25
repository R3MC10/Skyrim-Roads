import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
        await pg.goto("http://localhost:8765/index.html")
        await pg.wait_for_timeout(3500)
        await pg.screenshot(path="/home/claude/tests/s1_create.png")
        await pg.fill("#nm", "Remigiusz")
        await pg.click("[data-race=khajiit]")
        await pg.click("#begin")
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path="/home/claude/tests/s2_main.png", full_page=True)
        await pg.click("[data-act=go][data-place=Whiterun]"); await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path="/home/claude/tests/s3_travel.png")
        for t in ["hero", "pack", "town", "log"]:
            await pg.click(f"[data-tab={t}]"); await pg.wait_for_timeout(400)
            await pg.screenshot(path=f"/home/claude/tests/s_{t}.png", full_page=True)
        # force an encounter
        await pg.evaluate("""() => { }""")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
