import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
        errs = []
        async def clear(pg):
            for _ in range(6):
                if await pg.query_selector("#modal [data-act=close]") and not await pg.query_selector("#modal #pinlabel"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
                elif await pg.query_selector("#modal") and not await pg.query_selector("#modal #pinlabel"): await pg.evaluate("document.querySelector('#modal').remove()")
                else: break
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:8765/index.html?net=bc&p={tag}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(4000)
            await clear(pg); return pg
        A = await phone("pa", "Alfa"); B = await phone("pb", "Beta")
        box = await A.locator("#map").bounding_box()
        x, y = box["x"] + box["width"] * 0.7, box["y"] + box["height"] * 0.3
        await A.mouse.move(x, y); await A.mouse.down(); await A.wait_for_timeout(800); await A.mouse.up(); await A.wait_for_timeout(300)
        print("pin dialog:", await A.query_selector("#pinlabel") is not None)
        await A.click("[data-act=pinicon][data-id='\ue12b']"); await A.fill("#pinlabel", "Herb patch"); await A.click("[data-act=pinsave]"); await A.wait_for_timeout(400)
        print("picked:", (await A.inner_text("#picked")).replace("\n"," | "))
        print("pins:", await A.evaluate("JSON.stringify(window.__dbg.save().pins)"))
        await A.click("#picked [data-act=unpick]"); await A.wait_for_timeout(300)
        await A.mouse.click(x, y - 10); await A.wait_for_timeout(300)
        print("tap pin again:", (await A.inner_text("#picked")).split("\n")[0])
        await A.screenshot(path="pin_map.png", clip={"x":0,"y":0,"width":390,"height":620})
        # party, share, B adds
        await clear(A); await A.click("[data-tab=log]"); await A.wait_for_timeout(300); await A.click("[data-act=invite] >> nth=0"); await A.wait_for_timeout(500)
        await clear(B); await B.click("[data-tab=log]"); await B.wait_for_timeout(300); await B.click("[data-act=accept]"); await B.wait_for_timeout(500)
        print("party A/B:", await A.evaluate("document.querySelector('#side').innerText.includes('Led by')"), await B.evaluate("window.__dbg.save().id"))
        await A.click("[data-tab=world]"); await A.evaluate("scrollTo(0,0)"); await A.wait_for_timeout(400); await A.mouse.click(x, y - 10); await A.wait_for_timeout(300)
        print("picked now:", (await A.inner_text("#picked")).replace("\n"," | "))
        await A.click("#picked [data-act=pinshare]"); await A.wait_for_timeout(700)
        await clear(B); await B.click("[data-tab=world]"); await B.click("[data-tab=log]"); await B.wait_for_timeout(300)
        await B.click("[data-act=chatch]:not([data-id=world])"); await B.wait_for_timeout(300)
        print("B chat:", (await B.inner_text("#chatlog")).replace("\n"," | "))
        await B.click("[data-act=pinadd]"); await B.wait_for_timeout(500)
        print("B pins:", await B.evaluate("(window.__dbg.save().pins||[]).map(p=>p.icon+' '+p.label)"), "| B picked:", (await B.inner_text("#picked")).split("\n")[0])
        # travel to the pin
        await A.click("[data-tab=world]"); await A.evaluate("scrollTo(0,0)"); await A.wait_for_timeout(400); await A.mouse.click(x, y - 10); await A.wait_for_timeout(300); await A.click("#picked [data-act=go]"); await A.wait_for_timeout(500)
        print("A trip:", await A.evaluate("window.__dbg.save().trip?.destName"))
        # B moves: A should see B's route? (B is in A's party)
        await B.evaluate("()=>{const S=window.__dbg.save(); S.location=null; S.trip=null;}")
        await B.click("[data-tab=world]"); await B.wait_for_timeout(200); await B.click("[data-act=go][data-place='Helgen']"); await B.wait_for_timeout(1500)
        await A.evaluate("()=>{const S=window.__dbg.save(); S.trip=null;}"); await A.evaluate("scrollTo(0,0)"); await A.wait_for_timeout(1500)
        await A.screenshot(path="route_map.png", clip={"x":0,"y":100,"width":390,"height":520})
        print("errors:", errs)
        await b.close()
asyncio.run(main())
