import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def clear(pg):
            for _ in range(6):
                if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
                elif await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
                else: break
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:8765/index.html?net=bc&notut&p={tag}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(4000)
            await clear(pg); return pg
        async def log(pg):
            await clear(pg); await pg.click("[data-tab=map]"); await clear(pg); await pg.evaluate("()=>window.__ui.go('social')"); await pg.wait_for_timeout(200); await pg.click("[data-act=soctab][data-id=realm]"); await pg.wait_for_timeout(300); await clear(pg)   # clans and holds: \ue106 Friends → Realm
        A = await phone("wa", "Alfa"); B = await phone("wb", "Beta")
        for pg, nm, tg in ((A, "Red Hand", "RED"), (B, "Blue Wolves", "BLU")):
            await log(pg); await pg.fill("#clanname", nm); await pg.fill("#clantag", tg)
            if tg == "BLU": await pg.click("[data-act=clancol][data-i='0'][data-id='#1f4e79']")
            await pg.fill("#clanname", nm); await pg.fill("#clantag", tg); await pg.click("[data-act=clanfound]"); await pg.wait_for_timeout(500)
        # last week's results, written the way each phone would
        await A.evaluate("()=>{const S=window.__dbg.save(); Store.put('war',(WARS.week()-1)+'-'+S.id,{uid:S.id,name:S.name,week:WARS.week()-1,h:{Whiterun:30,Falkreath:12},t:G.now()});}")
        await B.evaluate("()=>{const S=window.__dbg.save(); Store.put('war',(WARS.week()-1)+'-'+S.id,{uid:S.id,name:S.name,week:WARS.week()-1,h:{Whiterun:10,'The Rift':25},t:G.now()});}")
        await A.wait_for_timeout(1500)
        # this week A wins a fight in Whiterun (real hook)
        await A.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;}")
        await A.wait_for_timeout(6000); await log(A)
        await A.evaluate("document.querySelector('#j-holds')?.scrollIntoView()"); await A.wait_for_timeout(800)
        el = await A.query_selector("#j-holds"); await el.screenshot(path="holds.png")
        t = await A.inner_text("#j-holds"); print("A holds:", " | ".join(l for l in t.split("\n") if "Ruled" in l)[:300])
        print("A sees rulers:", await A.evaluate("JSON.stringify(Object.fromEntries(Object.entries(WARS.rulers(window.__dbg.save())).map(([h,c])=>[h,c.tag])))"))
        print("B sees rulers:", await B.evaluate("JSON.stringify(Object.fromEntries(Object.entries(WARS.rulers(window.__dbg.save())).map(([h,c])=>[h,c.tag])))"))
        await clear(A); await A.click("[data-tab=map]"); await A.click("#zoomBtn"); await A.evaluate("scrollTo(0,0)"); await A.wait_for_timeout(1000)
        await A.screenshot(path="holds_map.png", clip={"x":0,"y":100,"width":390,"height":500})
        print("errors:", errs)
        await b.close()
asyncio.run(main())
