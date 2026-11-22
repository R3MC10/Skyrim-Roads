import asyncio
from playwright.async_api import async_playwright
MOCK = """window.__app = { native:true,
 async current(){ return {build:15, version:'1.15', canInstall:true}; },
 async check(){ return {current:{build:15}, latest:{build:16, notes:'Main menu with music\\nAuto-update\\nSettings', url:'https://github.com/x', size:5300000, date:'2026-11-20T21:30:00Z'}, newer:true}; },
 async install(l, step){ for (const p of [0,30,70,100]) { step('Downloading… '+p+'%', p); await new Promise(r=>setTimeout(r,150)); } step('Opening the installer…',100); return 'installer'; } };"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs=[]
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.add_init_script(MOCK)
        await pg.goto("http://localhost:8765/index.html?p=menu18"); await pg.wait_for_timeout(2000)
        await pg.click(".press"); await pg.wait_for_timeout(300)
        await pg.evaluate("async()=>window.__ui.updateAvailable(await window.__app.check())"); await pg.wait_for_timeout(300)
        print("badge:", await pg.inner_text(".mi[data-t=update]"))
        await pg.click(".mi[data-t=update]"); await pg.wait_for_timeout(500)
        await pg.screenshot(path="t_upd_app.png")
        await pg.click("[data-t=doupdate]"); await pg.wait_for_timeout(1200)
        print("after:", (await pg.inner_text(".page")).replace("\n"," | ")[-160:])
        print("errors:", errs)
        await b.close()
asyncio.run(main())
