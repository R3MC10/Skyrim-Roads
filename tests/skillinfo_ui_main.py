import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=si"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sage"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await clear()
        await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(400); await clear()
        if await pg.query_selector("[data-act=guideno]"): await pg.click("[data-act=guideno]"); await pg.wait_for_timeout(200)
        await pg.click("button.skill[data-id=Sneak]"); await pg.wait_for_timeout(400)
        card = await pg.inner_text(".skcard"); print("hero card:", card[:260].replace("\n", " | "))
        el = await pg.query_selector(".skcard"); await el.scroll_into_view_if_needed()
        box = await el.bounding_box(); await pg.screenshot(path="skill_hero.png", clip={"x": 0, "y": max(0, box["y"] - 160), "width": 390, "height": min(844, box["height"] + 260)})
        # perk panel summary
        print("perk summary:", (await pg.inner_text(".perk-sum"))[:140])
        await pg.click(".perk-sum [data-act=skinfo]"); await pg.wait_for_timeout(300)
        print("perk link opens card for:", await pg.evaluate("document.querySelector('button.skill.on')?.dataset.id"))
        # skills menu
        await pg.click("[data-tab=pack]"); await pg.wait_for_timeout(500); await clear()
        await pg.click("[data-act=skytab][data-id=skills]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=skysel][data-id='Lockpicking']"); await pg.wait_for_timeout(300)
        d = await pg.inner_text(".sky-detail"); print("menu detail:", d[:260].replace("\n", " | "))
        await pg.screenshot(path="skill_menu.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
