import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8827"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=lg"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Lyra"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.level=30; S.skills["Smithing"].lvl=100; S.skills["One-Handed"].lvl=62; S.skills["One-Handed"].xp=F.skillXpNeeded("One-Handed",62)*0.8; S.legend={"Archery":2};}""")
        async def shut():
            for _ in range(5):
                m = await pg.query_selector("#modal [data-act=close]")
                if not m: break
                await m.click(); await pg.wait_for_timeout(200)
        await shut()
        await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(600); await shut()
        txt = await pg.evaluate("document.querySelector('.prog-panel')?.innerText")
        print("progress:", txt)
        el = await pg.query_selector(".prog-panel")
        if el: await el.screenshot(path="legend_progress.png")
        await pg.click(".skill[data-id=Smithing]"); await pg.wait_for_timeout(400)
        await pg.click("[data-act=legend][data-id=Smithing]"); await pg.wait_for_timeout(300)
        armed = await pg.evaluate("document.querySelector('[data-act=legend][data-id=Smithing]')?.innerText")
        print("armed:", armed)
        el = await pg.query_selector(".skcard")
        if el: await el.screenshot(path="legend_card.png")
        await pg.click("[data-act=legend][data-id=Smithing]"); await pg.wait_for_timeout(500)
        st = await pg.evaluate("(()=>{const S=window.__dbg.save(); return [S.skills.Smithing.lvl, S.legend.Smithing, document.querySelector('.skill[data-id=Smithing]')?.innerText]})()")
        print("after:", st)
        assert st[0] == 15 and st[1] == 1, st
        print("errors:", errs)
        assert not errs
        print("RESULT OK")
        await b.close()
asyncio.run(main())
