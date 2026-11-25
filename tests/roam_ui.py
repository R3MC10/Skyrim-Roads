import asyncio
from playwright.async_api import async_playwright
import sys
PORT = sys.argv[1] if len(sys.argv) > 1 else "8769"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=ro"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Roamer"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.click("[data-tab=world]"); await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(400)
        print("hint:", "roam there" in await pg.inner_text("#side"))
        box = await pg.locator("#map").bounding_box()
        picked = None
        for fx, fy in [(0.62, 0.55), (0.4, 0.62), (0.55, 0.35), (0.3, 0.4), (0.7, 0.7)]:
            await pg.mouse.click(box["x"] + box["width"] * fx, box["y"] + box["height"] * fy); await pg.wait_for_timeout(300)
            txt = await pg.inner_text("#picked")
            if "\ue14c" in txt and "Walk here" in txt: picked = txt; break
        print("picked:", (picked or txt).replace("\n", " | "))
        await pg.screenshot(path="roam_pick.png")
        await pg.click("#picked [data-act=go]"); await pg.wait_for_timeout(500)
        print("trip:", await pg.evaluate("JSON.stringify({n:window.__dbg.save().trip?.destName, roam:window.__dbg.save().trip?.roam, loc:window.__dbg.save().location})"))
        await pg.wait_for_timeout(1500); await pg.screenshot(path="roam_walk.png")
        for i in range(20):
            done = await pg.evaluate("()=>{const S=window.__dbg.save(); if(!S.trip) return true; if(S.trip.status!=='travel'){S.trip.status='travel'; S.trip.encounter=null; S.trip.event=null;} S.trip.lastTick-=1200; return false;}")
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            if done: break
            await pg.wait_for_timeout(1300)
        print("arrived:", await pg.evaluate("JSON.stringify({trip:!!window.__dbg.save().trip, loc:window.__dbg.save().location, j:window.__dbg.save().journal.slice(-3).map(j=>j.text)})"))
        print("toast:", await pg.evaluate("document.querySelector('#toast')?.textContent"))
        # tapping a town still works: select Whiterun via the map list? use the Where-to list Go button for a named place
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        go = await pg.query_selector("[data-act=go][data-place]:not([data-place='__spot'])")
        name = await go.get_attribute("data-place"); await go.click(); await pg.wait_for_timeout(400)
        print("town trip:", name, await pg.evaluate("window.__dbg.save().trip?.destName"), await pg.evaluate("!!window.__dbg.save().trip?.roam"))
        # water: tap the sea at the very top of the map
        await pg.click("[data-act=stop]") if await pg.query_selector("[data-act=stop]") else None
        await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(300)
        await pg.mouse.click(box["x"] + box["width"] * 0.5, box["y"] + 4); await pg.wait_for_timeout(300)
        print("sea tap:", (await pg.inner_text("#picked")).replace("\n", " | "))
        # long-press still drops a pin
        x, y = box["x"] + box["width"] * 0.45, box["y"] + box["height"] * 0.5
        await pg.mouse.move(x, y); await pg.mouse.down(); await pg.wait_for_timeout(800); await pg.mouse.up(); await pg.wait_for_timeout(300)
        print("pin dialog:", await pg.query_selector("#pinlabel") is not None)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
