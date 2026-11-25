import asyncio
from playwright.async_api import async_playwright
exec(open('perf.py').read().split('async def main')[0])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2.75)
        await pg.goto("http://localhost:8765/index.html?p=perf3&net=bc&notut"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(3000)
        for _ in range(5):
            if await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
        await pg.evaluate(SEED)
        cdp = await pg.context.new_cdp_session(pg); await cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
        print(await pg.evaluate("""()=>{const S=window.__dbg.save(); const time=(f)=>{const t0=performance.now(); for(let i=0;i<30;i++) f(); return +((performance.now()-t0)/30).toFixed(2);};
          return {visitsRecord: time(()=>VISITS.record(S)), banners: time(()=>CLANS.banners([],S,VISITS.record(S))), weather: time(()=>WEVENTS.weather([S.x,S.y])), questsActive: time(()=>QUESTS.active(S)), horseRiding: time(()=>HORSES.riding(S)), hallProgress: time(()=>HALL.progress()), speed: time(()=>G.speed(S)), carried: time(()=>G.carried(S)) };}"""))
        r = await pg.evaluate("""()=>new Promise(res=>{const orig=WorldMap.draw; const times=[]; WorldMap.draw=function(...a){const t0=performance.now(); const r=orig.apply(this,a); times.push(performance.now()-t0); return r;};
          setTimeout(()=>{WorldMap.draw=orig; times.sort((a,b)=>a-b); res({n:times.length, median:Math.round(times[times.length>>1]), p90:Math.round(times[Math.floor(times.length*0.9)]), canvas: document.querySelector('#map').width+'x'+document.querySelector('#map').height});},4000);})""")
        print("draw at 4x slower CPU, dpr 2.75:", r)
        await b.close()
asyncio.run(main())
