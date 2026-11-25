import asyncio
import sys
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:" + PORT + "/index.html?p=hz1"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=6000; G.shopsOpen=()=>true;}")
        await pg.wait_for_timeout(4000)
        async def close():
            while await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
        await close()
        await pg.click("[data-tab=town]"); await pg.click("[data-id=stables]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=hcoat][data-id=palomino]"); await pg.fill("#hname","Juniper"); await pg.click("[data-act=hbuy]"); await pg.wait_for_timeout(300)
        print("toast:", await pg.evaluate("document.querySelector('#toast')?.textContent"))
        await pg.click("[data-act=harmor][data-id=steel]"); await pg.wait_for_timeout(300)
        el = await pg.query_selector("#side"); await el.screenshot(path="horse_stables.png")
        await pg.click("[data-tab=world]"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=go] >> nth=0"); await pg.wait_for_timeout(800)
        await close()
        print("trip:", (await pg.inner_text("#fpt .fpt-bar")).replace("\n"," | ")[:160])
        await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(400)
        await pg.screenshot(path="horse_trip.png", clip={"x":0,"y":0,"width":390,"height":700})
        print("before:", await pg.evaluate("JSON.stringify(window.__dbg.save().horse)"), await pg.evaluate("document.querySelectorAll('[data-act=hride]').length"))
        await pg.click("[data-act=hride]"); await pg.wait_for_timeout(400)
        print("after:", await pg.evaluate("JSON.stringify(window.__dbg.save().horse)"), await pg.evaluate("document.querySelector('#toast')?.textContent"))
        print("after walk:", (await pg.inner_text("#fpt .fpt-bar")).replace("\n"," | ")[:160])
        print("errors:", errs)
        await b.close()
asyncio.run(main())
