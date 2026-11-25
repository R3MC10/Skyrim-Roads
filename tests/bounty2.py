import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:8765/index.html?net=bc&p={tag}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            return pg
        async def log(pg):
            while await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
            await pg.click("[data-tab=world]"); await pg.click("[data-tab=log]"); await pg.wait_for_timeout(300)
        A = await phone("ba", "Alfa"); B = await phone("bb", "Beta")
        k = await A.evaluate("BOUNTY.goalsFor(BOUNTY.week())[0]"); T = await A.evaluate(f"BOUNTY.GOALS['{k}'].target")
        await A.evaluate(f"window.__dbg.tally('{k}', {T-1})"); await B.evaluate(f"window.__dbg.tally('{k}', 1)")
        await A.wait_for_timeout(800)
        print("goal", k, "A sees", await A.evaluate(f"JSON.stringify(BOUNTY.goal(BOUNTY.week(),'{k}','x'))"))
        await log(B)
        await B.click(f"[data-act=bclaim][data-id={k}]"); await B.wait_for_timeout(300)
        print("B claim:", (await B.inner_text("#modal, #toast")).replace("\n"," ")[:160] if await B.query_selector("#modal") else await B.evaluate("document.querySelector('#toast')?.textContent"))
        await log(A); await A.click(f"[data-act=bclaim][data-id={k}]"); await A.wait_for_timeout(300)
        print("A titles:", await A.evaluate("window.__dbg.save().titles"))
        await log(A); await A.screenshot(path="bounty_A.png", full_page=True)
        # town notice
        await A.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;}"); await A.wait_for_timeout(1200)
        while await A.query_selector("#modal [data-act=close]"): await A.click("#modal [data-act=close]"); await A.wait_for_timeout(200)
        await A.wait_for_timeout(2000)
        while await A.query_selector("#modal [data-act=close]"): await A.click("#modal [data-act=close]"); await A.wait_for_timeout(300)
        await A.click("[data-tab=town]"); await A.click("[data-id=notice]"); await A.wait_for_timeout(300)
        print("notice:", (await A.inner_text("#side"))[:200].replace("\n"," | "))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
