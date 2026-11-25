import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8826"
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
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=cf"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Forger"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; G.give(S,'mat_iron',6); G.give(S,'mat_strips',4); G.give(S,'recipe_ancient_nord',1); G.give(S,'mat_steel',4);}")
        for _ in range(4): await clear(pg); await pg.wait_for_timeout(300)
        await click(pg, "[data-tab=world]"); await click(pg, "[data-tab=town]"); await pg.wait_for_timeout(300); await click(pg, "[data-id=forge]"); await pg.wait_for_timeout(300)
        await click(pg, "[data-act=smake][data-id=iron_sword]"); await pg.wait_for_timeout(300)
        print("forge btns:", await pg.evaluate("[...document.querySelectorAll('#side [data-id=forge]')].map(e=>e.outerHTML.slice(0,120)).join(' || ')"))
        for _ in range(3):
            if await pg.query_selector("[data-act=fgroup][data-id=found]"): break
            await pg.evaluate("document.querySelector('#side [data-act=shop][data-id=forge]')?.click()"); await pg.wait_for_timeout(500)
        await click(pg, "[data-act=fgroup][data-id=found]"); await pg.wait_for_timeout(300)
        print("dbg:", await pg.evaluate("[SMITH.GROUPS.map(g=>g[0]).join(), [...document.querySelectorAll('[data-act=fgroup]')].map(e=>e.dataset.id+(e.classList.contains('on')?'*':'')).join(), [...document.querySelectorAll('[data-act=smake]')].length, document.querySelector('[data-act=ftab].on')?.dataset.id]"))
        side = await pg.inner_text("#side"); print("found group shows lock:", "Ancient Nord Smithing" in side and "recipe needed" in side, "| forge text:", side[:300].replace("\n"," / "))
        await (await pg.query_selector("#side")).screenshot(path="cf_found.png")
        # open the pack menu, read the recipe
        await pg.evaluate("__ui.go('items')"); await pg.wait_for_timeout(300)
        rid = await pg.evaluate("window.__dbg.save().inv.find(r=>r.item==='recipe_ancient_nord').id")
        sid = await pg.evaluate("window.__dbg.save().inv.find(r=>r.item==='iron_sword'&&r.cv!=null).id")
        await pg.evaluate("document.querySelector('[data-act=skycat][data-id=all], [data-id=all]')?.click()"); await pg.wait_for_timeout(300)
        await click(pg, f"[data-act=skysel][data-id='{rid}']"); await pg.wait_for_timeout(200)
        await click(pg, f"[data-act=cfread][data-id='{rid}']"); await pg.wait_for_timeout(300)
        print("recipe learned:", await pg.evaluate("(window.__dbg.save().recipes||[]).join()"))
        await click(pg, f"[data-act=skysel][data-id='{sid}']"); await pg.wait_for_timeout(200)
        await pg.screenshot(path="cf_dbg.png"); print("sky?", await pg.evaluate("!!document.querySelector('#sky')"), await pg.evaluate("[...document.querySelectorAll('[data-act=skysel]')].map(e=>e.dataset.id).join()"))
        await pg.fill(f"#cfname-{sid}", "Oathkeeper", timeout=5000); await pg.wait_for_timeout(2500)
        print("input survives re-render:", await pg.evaluate(f"document.getElementById('cfname-{sid}')?.value"))
        await click(pg, f"[data-act=cfname][data-id='{sid}']"); await pg.wait_for_timeout(400)
        print("named:", await pg.evaluate(f"window.__dbg.save().inv.find(r=>r.id==={sid}).nm"))
        print("shown in list:", "Oathkeeper" in await pg.inner_text("body"))
        await pg.screenshot(path="cf_named.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
