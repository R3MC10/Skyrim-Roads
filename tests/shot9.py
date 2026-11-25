import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs=[]
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html?p=z9"); await pg.wait_for_timeout(2500)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("() => { const S=window.__dbg.save(); S.location='Guardian Stones'; [S.x,S.y]=WORLD.places['Guardian Stones']; }")
        await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=stone][data-id=warrior]"); await pg.wait_for_timeout(300)
        await pg.evaluate("() => { const S=window.__dbg.save(); S.location='High Hrothgar'; [S.x,S.y]=WORLD.places['High Hrothgar']; }")
        await pg.click("[data-tab=hero]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=greybeards]"); await pg.wait_for_timeout(300); await pg.click("[data-act=close]")
        await pg.evaluate("() => { const S=window.__dbg.save(); S.souls=1; S.words.push('YOL'); }")
        await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=unlock]"); await pg.wait_for_timeout(300)
        el = await pg.query_selector("text=Powers & shouts")
        await el.scroll_into_view_if_needed(); await pg.wait_for_timeout(200)
        await pg.screenshot(path="/home/claude/tests/pw_hero.png")
        await pg.click("[data-tab=tactics]"); await pg.wait_for_timeout(300)
        opts = await pg.evaluate("[...document.querySelectorAll('select option')].map(o=>o.textContent).filter(t=>/Shout|power/i.test(t))")
        print(opts)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
