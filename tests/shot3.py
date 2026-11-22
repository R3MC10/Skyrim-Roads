import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs = []
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        await pg.goto("http://localhost:8765/index.html"); await pg.wait_for_timeout(4000)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path="p_main.png")
        await pg.click("[data-act=go][data-place=Whiterun]"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path="p_travel.png")
        for i,ev in enumerate(["caravan","chest","sleeper"]):
            await pg.evaluate("""(id) => { document.getElementById('modal')?.remove(); const T=window.__dbg.save().trip; T.status='travel'; T.event=null; T.encounter=null; let e; do { e = G.startEvent(window.__dbg.save()); if (e.id !== id) { window.__dbg.save().trip.status='travel'; window.__dbg.save().trip.event=null; } } while (e.id !== id); document.querySelector('[data-act=openev]') ; }""", ev)
            await pg.wait_for_timeout(1300)
            await pg.click("[data-act=openev]"); await pg.wait_for_timeout(400)
            await pg.screenshot(path=f"p_ev{i}.png")
            await pg.click("[data-act=ev] >> nth=0"); await pg.wait_for_timeout(500)
            await pg.screenshot(path=f"p_ev{i}r.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
