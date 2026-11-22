import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs=[]
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await pg.add_init_script("window.Capacitor={isNativePlatform:()=>true,Plugins:{Browser:{open:(o)=>{window.__opened=o.url}}}};")
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8777/index.html"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path="/home/claude/tests/a_create.png")
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.click("[data-act=online]"); 
        print("opened:", await pg.evaluate("window.__opened"))
        await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(200)
        print("back:", await pg.evaluate("window.__ui.back()"), await pg.evaluate("window.__ui.back()"))
        fonts = await pg.evaluate("document.fonts.check('600 16px Cinzel')")
        print("cinzel loaded:", fonts, "errors:", errs)
        await b.close()
asyncio.run(main())
