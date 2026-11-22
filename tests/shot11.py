import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs=[]
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html?p=r3"); await pg.wait_for_timeout(2500)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("() => { const S=window.__dbg.save(); S.location='Riften'; [S.x,S.y]=WORLD.places.Riften; S.gold=9000; G.give(S,'ing_wheat',3); }")
        await pg.click("[data-tab=town]"); await pg.click("[data-act=shop][data-id=home]"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=buyhome]"); await pg.wait_for_timeout(200); await pg.click("[data-act=close]")
        await pg.click("[data-act=shop][data-id=home]"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=stash] >> nth=0"); await pg.click("[data-act=harvest]"); await pg.click("[data-act=homebed]"); await pg.wait_for_timeout(300)
        await pg.screenshot(path="/home/claude/tests/r3_home.png", full_page=True)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
