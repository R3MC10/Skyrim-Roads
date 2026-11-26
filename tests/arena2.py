import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def clear(pg):
            for _ in range(6):
                if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
                elif await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
                else: break
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:8765/index.html?net=bc&p={tag}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Windhelm'; [S.x,S.y]=WORLD.places.Windhelm; S.gold=1000; S.discovered.push('Windhelm');}")
            await pg.wait_for_timeout(1500); await clear(pg)
            return pg
        async def arena(pg):
            await clear(pg); await pg.click("[data-tab=world]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(200); await pg.click("[data-id=arena]"); await pg.wait_for_timeout(300)
        A = await phone("aa", "Alfa"); B = await phone("ab", "Beta")
        await A.evaluate("()=>{}"); await A.wait_for_timeout(32000)   # cards refresh every 30 s
        await arena(A)
        await A.click("[data-act=duelstake][data-id='500']"); await A.click("[data-act=duelgo]"); await A.wait_for_timeout(400)
        print("A gold after challenge:", await A.evaluate("window.__dbg.save().gold"))
        await B.wait_for_timeout(500); print("B toast:", await B.evaluate("document.querySelector('#toast')?.textContent"))
        await arena(B); await B.click("[data-act=duelyes]"); await B.wait_for_timeout(500)
        print("B result:", (await B.inner_text("#modal h2")), "|", (await B.inner_text("#modal p"))[:120])
        await B.screenshot(path="arena_B.png")
        await A.wait_for_timeout(800)
        ga, gb = await A.evaluate("window.__dbg.save().gold"), await B.evaluate("window.__dbg.save().gold")
        print("gold A,B:", ga, gb, "sum", ga+gb, "| A toast:", await A.evaluate("document.querySelector('#toast')?.textContent"))
        print("ratings:", await A.evaluate("JSON.stringify(window.__dbg.save().arena)"), await B.evaluate("JSON.stringify(window.__dbg.save().arena)"))
        await clear(B); await arena(B); el = await B.query_selector("#side"); await el.screenshot(path="arena_side.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
