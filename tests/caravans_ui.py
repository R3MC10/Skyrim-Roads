import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8785"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def clear(pg): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def click(pg, sel):
            for _ in range(8):
                await clear(pg)
                try: await pg.click(sel, timeout=2500); return
                except Exception: await pg.wait_for_timeout(300)
            await pg.click(sel, timeout=3000)
        town = None
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p={tag}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            return pg
        A = await phone("ca", "Alfa"); B = await phone("cb", "Beta")
        town = await A.evaluate("(()=>{ const c=CARAVANS.all().find(x=>x.phase==='stop'&&x.depart-G.now()>90); return c?c.from:null })()")
        if not town:
            wait = await A.evaluate("Math.min(...CARAVANS.all().map(c=>Math.max(0,(c.arrive||0)-G.now())))")
            print("all caravans on the road; waiting", round(wait), "s for the next arrival")
            await A.wait_for_timeout(int(min(wait, 200) * 1000) + 4000)
            town = await A.evaluate("(()=>{ const c=CARAVANS.all().find(x=>x.phase==='stop'); return c?c.from:null })()")
        print("caravan town:", town)
        for pg in (A, B):
            await pg.evaluate("(t)=>{const S=window.__dbg.save(); S.location=t; [S.x,S.y]=WORLD.places[t]; S.gold=5000; S.level=20; for(const k of Object.keys(S.skills)) S.skills[k].lvl+=20; G.setHealth(S,G.maxHealth(S)); if(!S.discovered.includes(t)) S.discovered.push(t);}", town)
        # cart (A): horse then cart
        await A.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; HORSES.buy(S,'Bess','bay');}")
        await click(A, "[data-tab=map]"); await click(A, "[data-tab=town]"); await A.wait_for_timeout(300)
        await click(A, "[data-act=shop][data-id=stables]"); await A.wait_for_timeout(300)
        if await A.evaluate("!!document.querySelector('[data-act=cartbuy]:not([disabled])')"): await click(A, "[data-act=cartbuy]")
        else: print("stables closed now:", await A.evaluate("CARAVANS.buyCart(window.__dbg.save())"))
        await A.wait_for_timeout(300)
        print("cart:", await A.evaluate("JSON.stringify(window.__dbg.save().cart)"), "carry", await A.evaluate("G.capacity(window.__dbg.save())"))
        el = await A.query_selector("#side"); await el.screenshot(path="cv_stables.png")
        await A.evaluate("(t)=>{const S=window.__dbg.save(); CARAVANS.toggleCart(S); S.location=t; [S.x,S.y]=WORLD.places[t];}", town)
        # both sign on
        for pg in (A, B):
            await click(pg, "[data-tab=map]"); await click(pg, "[data-tab=town]"); await pg.wait_for_timeout(300)
            await click(pg, "[data-act=shop][data-id=caravans]"); await pg.wait_for_timeout(300)
            await click(pg, "[data-act=cvsign]"); await pg.wait_for_timeout(700)
        await A.wait_for_timeout(800); await click(A, "[data-act=shop][data-id=caravans]"); await A.wait_for_timeout(400)
        print("A sees:", (await A.inner_text("#side"))[-400:].replace("\n", " | ")[:300])
        el = await A.query_selector("#side"); await el.screenshot(path="cv_town_ink.png")
        # depart now: shift the job back in time and let the game start the trip
        for pg in (A, B):
            await pg.evaluate("()=>{const S=window.__dbg.save(), j=S.caravanJob; const d=j.depart-G.now()+2; j.depart-=d; j.arrive-=d;}")
        await A.wait_for_timeout(2500)
        print("trips:", await A.evaluate("JSON.stringify({c:window.__dbg.save().trip?.caravan,s:window.__dbg.save().trip?.speed})"), await B.evaluate("!!window.__dbg.save().trip?.caravan"))
        await A.evaluate("()=>{}"); await click(A, "[data-tab=map]"); await A.wait_for_timeout(600); await A.screenshot(path="cv_map.png")
        # fast-forward A along the road, fighting ambushes
        fights = 0
        for i in range(40):
            st = await A.evaluate("(()=>{const S=window.__dbg.save(); if(!S.trip) return 'done'; if(S.trip.status==='encounter') return 'enc'; const j=S.caravanJob; S.trip.lastTick-=200; if(j){j.depart-=200;j.arrive-=200;} return 'road'})()")
            await A.wait_for_timeout(1300)
            if st == "enc" or await A.query_selector("#modal [data-act=enc][data-a=fight]"):
                if await A.query_selector("#modal [data-act=enc][data-a=fight]"):
                    if fights == 0: await A.screenshot(path="cv_ambush.png")
                    await A.click("#modal [data-act=enc][data-a=fight]"); fights += 1; await A.wait_for_timeout(1800)
                    if fights == 1: await A.screenshot(path="cv_fight.png")
                    await clear(A)
                else:
                    await A.evaluate("()=>{const S=window.__dbg.save(); G.encounterAction(S,'fight',G.now());}"); fights += 1
            if st == "done": break
        await A.wait_for_timeout(1500)
        msg = await A.evaluate("document.querySelector('#modal')?.innerText || ''")
        print("fights", fights, "| loc", await A.evaluate("window.__dbg.save().location"), "| job", await A.evaluate("JSON.stringify(window.__dbg.save().caravanJob)"), "| msg", msg[:160].replace("\n"," "))
        print("gold A:", await A.evaluate("window.__dbg.save().gold"), "guards:", await A.evaluate("new Promise(r=>Store.watch('guards', d=>r(JSON.stringify(d.map(x=>[x.uid.slice(0,4),x.status,x.pay||0])))))"))
        await clear(A); await click(A, "[data-tab=log]"); await A.wait_for_timeout(300)
        # pixel style
        await B.evaluate("()=>{ART.setStyle('pixel')}"); await click(B, "[data-tab=map]"); await click(B, "[data-tab=log]"); await B.wait_for_timeout(400)
        el = await B.query_selector("#side"); await el.screenshot(path="cv_journal_pixel.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
