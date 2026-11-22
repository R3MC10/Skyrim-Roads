import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:8765/index.html?net=bc&p={tag}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]")
            await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=30000; S.discovered.push('Whiterun');}")
            await pg.wait_for_timeout(1500)
            if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]")
            return pg
        A = await phone("ha", "Alfa"); B = await phone("hb", "Beta")
        async def hall(pg):
            while await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
            await pg.click("[data-tab=map]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300)
            await pg.click("[data-act=shop][data-id=hall], [data-id=hall]"); await pg.wait_for_timeout(300)
        await hall(A)
        for n in ["5000","5000","5000"]:
            await A.click(f"[data-act=hallgold][data-id='{n}']"); await A.wait_for_timeout(300)
        print("A toast:", await A.evaluate("document.querySelector('#toast')?.textContent"))
        await A.wait_for_timeout(800)
        print("B sees total:", await B.evaluate("HALL.total()"), "tier", await B.evaluate("HALL.progress().name"))
        # A puts a potion in
        await A.evaluate("()=>{const S=window.__dbg.save(); G.give(S, Object.keys(D.ITEMS).find(k=>D.ITEMS[k].slot==='potion'));}")
        await hall(A); await A.click("details summary >> text=Put something in"); await A.click("[data-act=hallput] >> nth=0"); await A.wait_for_timeout(700)
        await hall(B)
        print("B chest:", await B.evaluate("HALL.chest.map(d=>D.ITEMS[d.item].name+' from '+d.by)"))
        await B.click("[data-act=halltake] >> nth=0"); await B.wait_for_timeout(600)
        print("B took:", await B.evaluate("document.querySelector('#toast')?.textContent"))
        await A.wait_for_timeout(500); print("A chest after:", await A.evaluate("HALL.chest.length"))
        print("news on A:", await A.evaluate("Object.values(JSON.parse(localStorage.getItem('hask.w.'+Store.worldCode))?.news||{}).map(n=>n.text).filter(t=>t.includes('Hall'))"))
        await hall(B); await B.screenshot(path="hall_B.png", full_page=True)
        await hall(B); await B.click("[data-tab=map]"); await B.wait_for_timeout(800)
        await B.screenshot(path="hall_map.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
