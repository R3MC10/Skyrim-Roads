import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs=[]
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html?p=r5"); await pg.wait_for_timeout(2500)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        await pg.evaluate("() => { const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; G.give(S,'iron_sword_flames'); G.give(S,'ench|hide_bracers|onehanded|12|0'); G.give(S,'soul_gem_common',2); G.give(S,'steel_sword'); }")
        await pg.click("[data-tab=town]"); await pg.click("[data-act=shop][data-id=enchanter]"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=disench] >> nth=0"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=disench] >> nth=0"); await pg.wait_for_timeout(200)
        await pg.select_option("#ench_item", label="Steel Sword"); await pg.wait_for_timeout(200)
        await pg.screenshot(path="/home/claude/tests/r5_ench.png", full_page=True)
        await pg.click("[data-act=enchant]"); await pg.wait_for_timeout(300)
        print(await pg.inner_text("#modal p"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
