import asyncio
import sys
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:" + PORT + "/index.html?p=bl1&notut"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(3000)
        async def clear():
            for _ in range(6):
                if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
                elif await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
                else: break
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.quests={...(S.quests||{}),companions:{stage:9,done:true}}; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;}")
        await pg.wait_for_timeout(6000); await clear()
        print("toast:", await pg.evaluate("document.querySelector('#toast')?.textContent"))
        await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(300)
        el = await pg.query_selector_all("#side .panel"); 
        for e in el:
            if "CIRCLE" in (await e.inner_text()).upper(): await e.screenshot(path="blood_offer.png")
        await pg.click("[data-act=wolfyes]"); await pg.wait_for_timeout(300); await clear()
        await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(250); await pg.click("[data-act=tabgo][data-id=tactics]"); await pg.wait_for_timeout(300)
        print("tactics has Beast Form:", "Beast Form" in await pg.inner_text("#side"))
        # vampire path
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.werewolf=null; S.sanguinare={at:G.now()-CURSE.TURN_AFTER-1};}")
        await pg.wait_for_timeout(6000)
        print("change:", (await pg.inner_text("#modal")).replace("\n"," ")[:140] if await pg.query_selector("#modal") else "none")
        await clear(); await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(300)
        for e in await pg.query_selector_all("#side .panel"):
            if "HUNGER" in (await e.inner_text()).upper(): await e.screenshot(path="blood_vamp.png"); print("vamp panel ok")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
