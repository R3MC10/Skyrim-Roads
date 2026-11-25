import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs=[]
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await pg.add_init_script(path="/home/claude/tests/fakedb.js")
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html"); await pg.wait_for_timeout(2500)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        await pg.evaluate("""() => { const S=window.__dbg.save(); S.location='Riverwood'; const t=Date.now()/1000;
            WEVENTS.activeRaid = () => ({id:'raid-test', town:'Riverwood', start:t-60, end:t+900});
            WEVENTS.weather = () => ({id:'snow',name:'Snow',icon:'\ue190',speed:.85,sneak:.05,encounters:1});
            window.__fakedb.store.set('raids/raid-test-B',{raid:'raid-test',uid:'B',name:'Bjorn',dmg:300}); window.__fakedb.emit('raids'); }""")
        await pg.wait_for_timeout(2000)
        await pg.screenshot(path="/home/claude/tests/r4_raid.png")
        await pg.click("[data-act=raidfight]"); await pg.wait_for_timeout(500)
        await pg.screenshot(path="/home/claude/tests/r4_fight.png")
        print(await pg.evaluate("JSON.stringify([...window.__fakedb.store.entries()].filter(([k])=>k.startsWith('raids')||k.startsWith('news')).map(([k,v])=>k+':'+(v.dmg||v.text)))"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
