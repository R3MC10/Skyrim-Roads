import asyncio, sys, base64
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = _SHOTS
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs = []
        async def page(tag, style="ink", reduce=False, q="?net=bc&notut"):
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, reduced_motion="reduce" if reduce else "no-preference")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            await pg.goto(f"http://localhost:{PORT}/index.html{q}&p={tag}"); await pg.wait_for_timeout(1800)
            return pg
        # 1) title animates (two frames differ), ink
        for st in ["ink"]:
            pg = await page("ta" + st, st)
            a = await pg.evaluate("document.querySelector('#tanim').toDataURL()")
            await pg.screenshot(path=f"{OUT}ta_title_{st}_1.png"); await pg.wait_for_timeout(2500)
            b2 = await pg.evaluate("document.querySelector('#tanim').toDataURL()")
            await pg.screenshot(path=f"{OUT}ta_title_{st}_2.png")
            print(st, "title animates:", a != b2, "stats", await pg.evaluate("JSON.stringify(TITLEART.stats())"))
            # selectors still work at once
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.wait_for_timeout(200)
            for race in ["nord", "khajiit", "argonian"]:
                await pg.click(f"[data-race={race}]"); await pg.wait_for_timeout(450)
                el = await pg.query_selector(".cscene"); await el.screenshot(path=f"{OUT}ta_create_{st}_{race}.png")
            print(st, "title gone after create:", await pg.evaluate("!document.querySelector('#title')"), "heroprev ok:", await pg.evaluate("!!document.querySelector('.heroprev img')"))
            await pg.context.close()
        # 2) reduce motion: static
        pg = await page("tared", reduce=True)
        a = await pg.evaluate("document.querySelector('#tanim').toDataURL()"); await pg.wait_for_timeout(1500)
        print("reduced static:", a == await pg.evaluate("document.querySelector('#tanim').toDataURL()"))
        await pg.context.close()
        # 3) intro (forced with ?intro), then the game
        pg = await page("taint", q="?net=bc&intro=1")
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Intro"); await pg.click("#begin"); await pg.wait_for_timeout(500)
        print("intro shown:", await pg.evaluate("!!document.querySelector('.intro')"))
        await pg.screenshot(path=f"{OUT}ta_intro_1.png"); await pg.wait_for_timeout(2000); await pg.screenshot(path=f"{OUT}ta_intro_2.png")
        await pg.wait_for_timeout(4500)
        print("intro gone by 6 s:", await pg.evaluate("!document.querySelector('.intro')"), "game up:", await pg.evaluate("!!document.querySelector('[data-tab=map]')"))
        await pg.context.close()
        # tap to skip
        pg = await page("taskip", q="?net=bc&intro=1")
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Skip"); await pg.click("#begin"); await pg.wait_for_timeout(400)
        await pg.click(".intro"); await pg.wait_for_timeout(400)
        print("skipped:", await pg.evaluate("!document.querySelector('.intro')"))
        await pg.context.close()
        # 4) automation without ?intro: no intro
        pg = await page("tanoint", q="?net=bc")
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "NoIntro"); await pg.click("#begin"); await pg.wait_for_timeout(300)
        print("no intro under automation:", await pg.evaluate("!document.querySelector('.intro')"))
        await pg.context.close()
        print("errors:", errs)
        await b.close()
asyncio.run(main())
