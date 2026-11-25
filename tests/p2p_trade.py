import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:8765/index.html?net=bc&p={tag}{name}"); await pg.wait_for_timeout(2000)
            await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1000); return pg
        A = await phone("t", "Alfa"); B = await phone("t", "Beta")
        await B.evaluate("() => { window.__dbg.save().gold = 500; }")
        await A.wait_for_timeout(1500)
        await A.click("[data-tab=log]"); await A.wait_for_timeout(300)
        await A.click("[data-act=trade] >> nth=0"); await A.wait_for_timeout(200)
        await A.click("[data-act=tradepick] >> nth=0"); await A.wait_for_timeout(100)
        await A.fill("#task", "120"); await A.click("[data-act=tradesend]"); await A.wait_for_timeout(800)
        await B.click("[data-tab=log]"); await B.wait_for_timeout(300)
        await B.screenshot(path="/home/claude/tests/tr_B.png", full_page=True)
        await B.click("[data-act=tradeyes]"); await B.wait_for_timeout(1200)
        ga = await A.evaluate("window.__dbg.save().gold"); gb = await B.evaluate("window.__dbg.save().gold")
        print("A gold", ga, "B gold", gb, "B items", await B.evaluate("window.__dbg.save().inv.length"), "A items", await A.evaluate("window.__dbg.save().inv.length"))
        # decline flow
        await A.click("[data-tab=world]"); await A.click("[data-tab=log]"); await A.click("[data-act=trade] >> nth=0"); await A.fill("#tgive","10"); await A.click("[data-act=tradesend]"); await A.wait_for_timeout(800)
        before = await A.evaluate("window.__dbg.save().gold")
        await B.click("[data-tab=world]"); await B.click("[data-tab=log]"); await B.wait_for_timeout(300); await B.click("[data-act=tradeno]"); await B.wait_for_timeout(1200)
        print("A gold during offer", before, "-> after decline", await A.evaluate("window.__dbg.save().gold"))
        await A.click("[data-tab=world]"); await A.click("[data-tab=log]"); await A.wait_for_timeout(300)
        t = await A.inner_text("#side"); i = t.find("LEADERBOARD"); print(t[i:i+160].replace("\n"," | ") if i>=0 else t[:100])
        print("errors:", errs)
        await b.close()
asyncio.run(main())
