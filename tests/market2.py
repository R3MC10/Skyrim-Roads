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
        async def phone(tag, name, house):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:8765/index.html?net=bc&notut&p={tag}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            await pg.evaluate("(h)=>{const S=window.__dbg.save(); S.location='Windhelm'; [S.x,S.y]=WORLD.places.Windhelm; S.gold=1000; S.discovered.push('Windhelm'); if(h) S.homes={Windhelm:{chest:[],garden:0}}; S.inv=S.inv.filter(r=>r.item!=='potion_health_minor'); G.give(S,'potion_health_minor',4);}", house)
            await pg.wait_for_timeout(1200); await clear(pg)
            return pg
        async def market(pg):
            await clear(pg); await pg.click("[data-tab=world]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(200); await pg.click("[data-id=market]"); await pg.wait_for_timeout(300)
        A = await phone("ma", "Alfa", True); B = await phone("mb", "Beta", False)
        await market(A)
        await A.click("details summary")
        rid = await A.evaluate("String(window.__dbg.save().inv.find(r=>r.item==='potion_health_minor').id)")
        await A.click(f"[data-act=mpick][data-id='{rid}']"); await A.wait_for_timeout(200)
        await A.fill("#mprice", "120"); await A.click("[data-act=mlist]"); await A.wait_for_timeout(500)
        el = await A.query_selector("#side"); await el.screenshot(path="market_A.png")
        print("A stall:", (await A.inner_text("#side"))[:400].replace("\n"," | "))
        await B.wait_for_timeout(800); await market(B)
        print("B sees:", (await B.inner_text("#side"))[:300].replace("\n"," | "))
        el = await B.query_selector("#side"); await el.screenshot(path="market_B.png")
        await B.click("[data-act=mbuy]"); await B.wait_for_timeout(900)
        print("B toast:", await B.evaluate("document.querySelector('#toast')?.textContent"))
        await A.wait_for_timeout(800)
        ga, gb = await A.evaluate("window.__dbg.save().gold"), await B.evaluate("window.__dbg.save().gold")
        qb = await B.evaluate("window.__dbg.save().inv.filter(r=>r.item==='potion_health_minor').reduce((a,r)=>a+r.qty,0)")
        print("gold A,B:", ga, gb, "| B potions:", qb, "| A toast:", await A.evaluate("document.querySelector('#toast')?.textContent"))
        print("stalls left:", await A.evaluate("Object.keys(localStorage).filter(k=>/stalls/.test(k)).length"))
        await A.evaluate("()=>G.give(window.__dbg.save(),'potion_health_minor',2)")
        # withdraw flow
        await market(A); await A.click("details summary")
        await A.click("[data-act=mpick]:not([data-id=''])"); await A.fill("#mprice","50"); await A.click("[data-act=mlist]"); await A.wait_for_timeout(400)
        await A.click("[data-act=mpull]"); await A.wait_for_timeout(900)
        print("after take back:", await A.evaluate("document.querySelector('#toast')?.textContent"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
