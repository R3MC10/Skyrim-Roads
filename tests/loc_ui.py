import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8767/index.html?net=bc&notut&p=lc"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Scout"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.click("[data-tab=map]"); await pg.wait_for_timeout(300)
        listed = await pg.evaluate("[...document.querySelectorAll('[data-act=go]')].map(b=>b.dataset.place)")
        hid = await pg.evaluate("[...WORLD.hidden]")
        print("where-to shows", len(listed), "places; hidden ones among them:", [n for n in listed if n in hid])
        print("discovered at start:", await pg.evaluate("window.__dbg.save().discovered.length"), "of", await pg.evaluate("Object.keys(WORLD.places).length"))
        # walk toward Valtheim Towers region: put the hero just next to a hidden place on a trip and tick
        await pg.evaluate("()=>{const S=window.__dbg.save(); const [x,y]=WORLD.places['Honningbrew Meadery']; S.location=null; G.startTrip(S,'Valtheim Towers',WORLD.places['Valtheim Towers'].slice(0,2)); S.x=x-0.01; S.y=y; S.trip.path=Terrain.route([S.x,S.y], S.trip.dest); S.trip.idx=0; S.trip.lastTick=G.now()-60;}")
        await pg.wait_for_timeout(2500)
        print("toast:", await pg.evaluate("document.querySelector('#toast')?.textContent"))
        await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(300)
        t = await pg.inner_text("#side"); i = t.find("Places discovered"); print("hero:", t[i:i+40].replace("\n"," "))
        # everything discovered, max zoom: look + frame time
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.discovered=Object.keys(WORLD.places); S.explored=Object.values(WORLD.places).map(p=>p.slice(0,2));}")
        await pg.wait_for_timeout(800); await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.click("[data-tab=map]"); await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.evaluate("window.scrollTo(0,0)")
        await pg.screenshot(path="loc_all_z1.png")
        for _ in range(3):
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.click("#zoomBtn"); await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(600); await pg.screenshot(path="loc_all_zoom.png")
        ms = await pg.evaluate("""()=>{ const c=document.querySelector('#map'); const v={...window.__lastView}; return null; }""")
        perf = await pg.evaluate("""async()=>{ let n=0, t0=performance.now(); const times=[]; await new Promise(r=>{ function f(){ times.push(performance.now()); if(++n<60) requestAnimationFrame(f); else r(); } requestAnimationFrame(f); }); const d=[]; for(let i=1;i<times.length;i++) d.push(times[i]-times[i-1]); d.sort((a,b)=>a-b); return {median:d[d.length>>1].toFixed(1), p90:d[Math.floor(d.length*0.9)].toFixed(1)}; }""")
        print("frame ms (all places, zoomed):", perf)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
