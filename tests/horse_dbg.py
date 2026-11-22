import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844})
        logs=[]; pg.on("console", lambda m: logs.append(m.text)); pg.on("pageerror", lambda e: logs.append("ERR "+str(e)))
        await pg.goto("http://localhost:8765/index.html?p=hz2"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=6000; S.horse={name:'Ju',coat:'bay'};}")
        await pg.wait_for_timeout(1300)
        while await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
        print("modal:", await pg.evaluate("document.querySelector('#modal')?.innerText?.slice(0,80)"))
        await pg.evaluate("()=>{document.querySelector('#modal')?.remove(); const S=window.__dbg.save(); S.location=null; console.log(G.startTrip(S,'Riverwood',WORLD.places.Riverwood));}")
        await pg.wait_for_timeout(1500)
        print("before", await pg.evaluate("window.__dbg.save().horse"), await pg.evaluate("window.__dbg.save().trip?.status"))
        print(await pg.evaluate("document.querySelector('[data-act=hride]')?.outerHTML"))
        await pg.click('[data-act=hride]'); await pg.wait_for_timeout(300)
        print("after", await pg.evaluate("window.__dbg.save().horse"), await pg.evaluate("document.querySelector('#toast')?.textContent"))
        print(logs[-5:])
        await b.close()
asyncio.run(main())
