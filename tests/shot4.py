import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs = []
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html"); await pg.wait_for_timeout(3500)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(2000)
        await pg.evaluate("""() => { const S = window.__dbg.save(); S.location = 'Bleak Falls Barrow'; [S.x, S.y] = WORLD.places['Bleak Falls Barrow']; }""")
        await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300)
        await pg.screenshot(path="d0.png")
        await pg.click("[data-act=enter]"); await pg.wait_for_timeout(400)
        await pg.screenshot(path="d1.png", full_page=False)
        n = 0
        while n < 40:
            n += 1
            st = await pg.evaluate("() => { const d = window.__dbg.save().dungeon; return d ? (d.done ? 'done' : d.room ? 'room' : 'pick') : 'none'; }")
            if st == 'none' or st == 'done': break
            if st == 'pick': await pg.click(".evc [data-act=droom] >> nth=0")
            else: await pg.click(".evc [data-act=dact] >> nth=0")
            await pg.wait_for_timeout(250)
            if n in (2, 3, 6): await pg.screenshot(path=f"d{n}.png")
        await pg.screenshot(path="dend.png")
        print("state", st, "steps", n, "errors:", errs)
        await b.close()
asyncio.run(main())
