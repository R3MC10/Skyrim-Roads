import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8790"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def clear(pg): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def click(pg, sel):
            for _ in range(8):
                await clear(pg)
                try: await pg.click(sel, timeout=2500); return
                except Exception: await pg.wait_for_timeout(300)
            await pg.click(sel, timeout=3000)
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p={tag}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.dragons=1; S.cleared={'Bleak Falls Barrow':G.now()-100};}")
            await clear(pg); return pg
        async def inn(pg):
            await click(pg, "[data-tab=world]"); await click(pg, "[data-tab=town]"); await pg.wait_for_timeout(200); await click(pg, "[data-act=shop][data-id=inn]"); await pg.wait_for_timeout(300)
        A = await phone("ba", "Alfa"); B = await phone("bb", "Beta")
        await inn(A)
        await click(A, "[data-act=deedpick][data-id='0']"); await A.wait_for_timeout(200)
        print("draft:", await A.evaluate("document.querySelector('#versein')?.value"))
        await click(A, "[data-act=versewrite]"); await A.wait_for_timeout(600)
        print("A after write:", (await A.evaluate("document.querySelector('#toast')?.textContent")))
        await B.wait_for_timeout(600); await inn(B)
        n = await B.evaluate("document.querySelectorAll('[data-act=verselike]:not([disabled])').length"); print("B can like:", n)
        await click(B, "[data-act=verselike]:not([disabled])"); await B.wait_for_timeout(500)
        print("B liked:", await B.evaluate("document.querySelector('#toast')?.textContent"))
        print("B like again possible:", await B.evaluate("document.querySelectorAll('[data-act=verselike]:not([disabled])').length"))
        await A.wait_for_timeout(500); await inn(A)
        txt = await A.inner_text("#side"); i = txt.find("SONG OF THE NORTH"); print("A song:", txt[i:i+220].replace("\n"," | "))
        for st in ["ink"]:
            await inn(A)
            el = await A.query_selector(".bardsong"); await el.scroll_into_view_if_needed(); await A.wait_for_timeout(200)
            await A.screenshot(path=f"bard_{st}.png")
        await click(A, "[data-act=bardsing]"); await A.wait_for_timeout(2500)
        await A.screenshot(path="bard_sing.png")
        print("singing lines:", await A.evaluate("document.querySelectorAll('#modal .sline').length"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
