import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8791"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def click(sel):
            for _ in range(8):
                await clear()
                try: await pg.click(sel, timeout=2500); return
                except Exception: await pg.wait_for_timeout(300)
            await pg.click(sel, timeout=3000)
        async def journal():
            await click("[data-tab=world]"); await click("[data-tab=log]"); await pg.wait_for_timeout(300)
            await pg.evaluate("document.querySelector('#j-quests')?.scrollIntoView()")
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=gu"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sly"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        go = "(n)=>{const S=window.__dbg.save(); S.location=n; [S.x,S.y]=WORLD.places[n]; if(!S.discovered.includes(n)) S.discovered.push(n);}"
        # join the Thieves Guild in Riften
        await pg.evaluate(go, "Riften"); await journal()
        await click("[data-act=qjoin][data-id=thieves]"); await pg.wait_for_timeout(400); await clear()
        print("joined:", await pg.evaluate("JSON.stringify(window.__dbg.save().quests.thieves)"))
        # jump ahead to Dampened Spirits at Honningbrew with a good Sneak
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.quests.thieves.stage=3; S.skills.Sneak.lvl=90;}")
        await pg.evaluate(go, "Whiterun"); await journal()
        txt = await pg.inner_text("#j-quests"); print("journal:", txt[:260].replace("\n", " | "))
        print("marker:", await pg.evaluate("JSON.stringify(WORLD.places['Honningbrew Meadery'].slice(0,2))"))
        await pg.evaluate(go, "Honningbrew Meadery"); await journal()
        for _ in range(3):
            await click("[data-act=qtalk][data-id=thieves]"); await pg.wait_for_timeout(500)
            if await pg.evaluate("window.__dbg.save().quests.thieves.stage") == 4: break
            await pg.evaluate("()=>{window.__dbg.save().quests.thieves.retryAt=0}"); await journal()
        print("toast:", await pg.evaluate("document.querySelector('#toast')?.textContent"), "btns:", await pg.evaluate("[...document.querySelectorAll('[data-act=qtalk]')].map(b=>b.dataset.id+':'+b.textContent).join(',')"), "loc:", await pg.evaluate("window.__dbg.save().location"))
        print("after talk:", await pg.evaluate("document.querySelector('#modal')?.innerText?.slice(0,200)"), "stage", await pg.evaluate("window.__dbg.save().quests.thieves.stage"))
        el = await pg.query_selector("#modal")
        if el: await el.screenshot(path="gu_story_ink.png")
        await clear()
        # a guild job from Delvin
        await pg.evaluate(go, "Riften"); await journal()
        await click("[data-act=jtab][data-id=misc]"); await click("[data-act=gtake][data-id=thieves]"); await pg.wait_for_timeout(400); await clear()
        job = await pg.evaluate("JSON.stringify(GUILDS.state(window.__dbg.save()).thieves.job)"); print("job:", job)
        await journal(); el = await pg.query_selector("#j-quests"); await el.screenshot(path="gu_journal_ink.png")
        # the Brotherhood from Windhelm
        await pg.evaluate(go, "Windhelm"); await journal()
        await click("[data-act=jtab][data-id=active]"); await click("[data-act=qjoin][data-id=brotherhood]"); await pg.wait_for_timeout(400)
        el = await pg.query_selector("#modal")
        if el: await el.screenshot(path="gu_db_ink.png")
        await clear(); print("db:", await pg.evaluate("JSON.stringify(window.__dbg.save().quests.brotherhood)"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
