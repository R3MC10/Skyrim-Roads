import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs = []
        # full map, desktop, everything revealed
        pg = await b.new_page(viewport={"width": 1300, "height": 900})
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html"); await pg.wait_for_timeout(4000)
        await pg.fill("#nm", "Remigiusz"); await pg.click("[data-race=nord]"); await pg.click("#begin")
        await pg.wait_for_timeout(2500)
        await pg.evaluate("""() => { const c=document.createElement('canvas'); }""")
        # render the bare painted base for inspection
        data = await pg.evaluate("""() => { WorldMap.ready(); const v={player:[0.5,0.5],name:'',discovered:Object.keys(WORLD.places),explored:[],others:[],bags:[],t:0,zoom:1,center:[.5,.5],reduceMotion:true};
           const c=document.createElement('canvas'); c.style.width='2000px'; c.style.height='1400px'; document.body.appendChild(c);
           v.explored = []; for(let x=0;x<=1;x+=0.02) for(let y=0;y<=1;y+=0.02) v.explored.push([x,y]);
           WorldMap.draw(c, v); return c.toDataURL('image/png'); }""")
        import base64
        open("/home/claude/tests/m_full.png","wb").write(base64.b64decode(data.split(",")[1]))
        await pg.close()
        # phone
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html"); await pg.wait_for_timeout(4000)
        await pg.screenshot(path="/home/claude/tests/p_loaded.png")
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(2500); await pg.screenshot(path="/home/claude/tests/p_main.png"); await pg.click("[data-act=go][data-place=Whiterun]"); await pg.wait_for_timeout(3000)
        await pg.screenshot(path="/home/claude/tests/p_travel.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
