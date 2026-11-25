import asyncio
from playwright.async_api import async_playwright
exec(open('perf.py').read().split('async def main')[0])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await pg.goto("http://localhost:8765/index.html?p=perf4&net=bc&notut"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(3000)
        for _ in range(5):
            if await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
        await pg.evaluate(SEED)
        cdp = await pg.context.new_cdp_session(pg); await cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
        probe = """(ms)=>new Promise(res=>{const long=[]; const ob=new PerformanceObserver(l=>l.getEntries().forEach(e=>long.push(e.duration))); ob.observe({entryTypes:['longtask']}); let n=0; const o=WorldMap.draw; WorldMap.draw=function(...a){n++; return o.apply(this,a)}; setTimeout(()=>{ob.disconnect(); WorldMap.draw=o; res({draws:n, busyMs:Math.round(long.reduce((a,b)=>a+b,0))});}, ms);})"""
        await pg.evaluate("document.querySelector('[data-tab=map]').click(); scrollTo(0,0)"); await pg.wait_for_timeout(500)
        print("standing still, map on screen 5 s:", await pg.evaluate(probe, 5000))
        await pg.evaluate("document.querySelector('[data-tab=log]').click()"); await pg.wait_for_timeout(800)
        print("reading the Journal (map scrolled away) 5 s:", await pg.evaluate(probe, 5000))
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location=null; G.startTrip(S,'Helgen',WORLD.places.Helgen);}"); await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(500)
        print("travelling, map on screen 5 s:", await pg.evaluate(probe, 5000))
        await b.close()
asyncio.run(main())
