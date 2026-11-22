import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox","--autoplay-policy=no-user-gesture-required"])
        errs=[]
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console:"+m.text) if m.type=="error" else None)
        await pg.goto("http://localhost:8765/index.html?p=snd8"); await pg.wait_for_timeout(2500)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(3000)
        if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]")
        print("state", await pg.evaluate("() => SOUND.state"))
        await pg.evaluate("() => { ['hit','clang','swing','spell','coin','levelup','quest','arrive','victory','death','potion','shout','dragon','click','page'].forEach((f,i)=>SOUND.fx(f, i*0.1)); SOUND.fight({fight:{log:[1,2,3,4]}}); }")
        for m in ["night","dungeon","combat","day"]:
            await pg.evaluate(f"() => SOUND.mood('{m}')"); await pg.wait_for_timeout(1200)
        print("state", await pg.evaluate("() => SOUND.state"))
        print("upcoming", await pg.evaluate("() => window.__ui.upcoming().map(n=>[n.title, Math.round((n.at-Date.now())/60000)])"))
        await pg.click("#sndBtn"); await pg.wait_for_timeout(300)
        await pg.screenshot(path="/home/claude/tests/snd.png")
        await pg.fill("#snd_music","20"); await pg.dispatch_event("#snd_music","input")
        await pg.click("[data-act=sndmute]"); await pg.wait_for_timeout(200)
        print("settings", await pg.evaluate("() => SOUND.settings"), await pg.inner_text("#sndBtn"))
        await pg.click("[data-act=sndmute]"); await pg.click("#modal [data-act=close]")
        print("state", await pg.evaluate("() => SOUND.state"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
