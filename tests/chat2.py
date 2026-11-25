import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def phone(tag, name):
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:8765/index.html?net=bc&p={tag}"); await pg.wait_for_timeout(2000)
            await pg.click(".press"); await pg.wait_for_timeout(300)
            await pg.click(".mi[data-t=new]"); await pg.wait_for_timeout(300)
            await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]")
            return pg
        A = await phone("ca", "Alfa"); B = await phone("cb", "Beta")
        await A.wait_for_timeout(1500)
        await A.click("[data-tab=log]"); await A.wait_for_timeout(300)
        await A.fill("#chatin", "Hello <b>Beta</b> & friends"); await A.press("#chatin", "Enter"); await A.wait_for_timeout(800)
        print("B toast:", await B.evaluate("document.querySelector('#toast')?.textContent"))
        print("B unread dot:", await B.evaluate("!!document.querySelector('[data-tab=log] .dot')"))
        await B.click("[data-tab=log]"); await B.wait_for_timeout(400)
        print("B chat:", (await B.inner_text("#chatlog")).replace("\n"," | "))
        print("B html escaped:", "<b>" not in await B.inner_html("#chatlog"))
        await B.click("[data-act=chatq] >> nth=0"); await B.wait_for_timeout(700)
        await A.click("[data-act=chatq] >> nth=1"); await A.wait_for_timeout(200)
        await A.click("[data-act=chatq] >> nth=2"); await A.wait_for_timeout(200)
        print("A spam guard:", await A.evaluate("document.querySelector('#toast')?.textContent"))
        print("A chat:", (await A.inner_text("#chatlog")).replace("\n"," | "))
        # B mutes A
        await B.click("[data-tab=world]"); await B.click("[data-tab=log]"); await B.wait_for_timeout(300)
        await B.click("#chatlog .cn:not([disabled]) >> nth=0"); await B.wait_for_timeout(300)
        print("B after mute:", (await B.inner_text("#chatlog")).replace("\n"," | "))
        # party channel
        await A.click("[data-act=invite] >> nth=0"); await A.wait_for_timeout(500)
        await B.click("[data-tab=world]"); await B.click("[data-tab=log]"); await B.wait_for_timeout(300)
        await B.click("[data-act=accept]"); await B.wait_for_timeout(500)
        await B.click("[data-act=chatunmute]"); await B.wait_for_timeout(300)
        await B.click("[data-act=chatch][data-id]:not([data-id=world])"); await B.wait_for_timeout(300)
        await B.fill("#chatin", "party only"); await B.click("[data-act=chatsend]"); await B.wait_for_timeout(700)
        await A.click("[data-tab=world]"); await A.click("[data-tab=log]"); await A.wait_for_timeout(300)
        await A.click("[data-act=chatch][data-id]:not([data-id=world])"); await A.wait_for_timeout(300)
        print("A party:", (await A.inner_text("#chatlog")).replace("\n"," | "))
        await A.screenshot(path="chat_A.png", full_page=True)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
