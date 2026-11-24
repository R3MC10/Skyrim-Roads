import asyncio, sys, base64
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
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
        async def phone(tag, name, town):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p={tag}"); await pg.wait_for_timeout(1600)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            await pg.evaluate("(t)=>{const S=window.__dbg.save(); S.location=t; [S.x,S.y]=WORLD.places[t]; S.gold=60000; S.dragons=2; S.bounty=null; S.thaneWhiterun=true; S.discovered.push(t);}", town)
            await pg.wait_for_timeout(800); await clear(pg); return pg
        async def town(pg, sec):
            await click(pg, "[data-tab=map]"); await click(pg, "[data-tab=town]"); await pg.wait_for_timeout(200); await click(pg, f"[data-act=shop][data-id={sec}]"); await pg.wait_for_timeout(300)
        async def shot(pg, sel, path):
            el = await pg.query_selector(sel)
            if el: await el.screenshot(path=path)
        A = await phone("ha", "Alfa", "Whiterun"); B = await phone("hb", "Beta", "Whiterun")
        await town(A, "home"); await click(A, "[data-act=buyhome]"); await A.wait_for_timeout(300)
        print("A homes:", await A.evaluate("Object.keys(window.__dbg.save().homes||{})"))
        # store things and show some
        await A.evaluate("()=>{const S=window.__dbg.save(); for (const i of ['steel_sword','steel_armor','gem_ruby','gold_diamond_necklace','dragon_bone']) G.give(S,i); }")
        await town(A, "home")
        for it in ["steel_sword", "steel_armor", "gem_ruby"]:
            rid = await A.evaluate(f"String(window.__dbg.save().inv.find(r=>r.item==='{it}').id)")
            await click(A, f"[data-act=stash][data-id='{rid}']"); await A.wait_for_timeout(150)
        for i in range(3):
            await click(A, f"[data-act=showcase][data-id='{i}']"); await A.wait_for_timeout(150)
        await A.fill("#motto", "Fortune favours the bold"); await click(A, "[data-act=motto]"); await A.wait_for_timeout(300)
        await town(A, "home"); await shot(A, ".hscene", "home_before.png")
        # hotspot: bed (sleep) and garden
        await A.evaluate("document.querySelector('.hscene .hot[data-id=bed]').click()"); await A.wait_for_timeout(300)
        print("rested:", await A.evaluate("(window.__dbg.save().restBonus||0)"))
        await A.evaluate("()=>{const S=window.__dbg.save(); S.homes.Whiterun.garden=G.now()-8000;}")
        await town(A, "home"); await shot(A, ".hscene", "home_ripe.png")
        await A.evaluate("document.querySelector('.hscene .hot[data-id=garden]').click()"); await A.wait_for_timeout(300)
        await town(A, "home"); await A.evaluate("document.querySelector('.hscene .hot[data-id=display]').click()"); await A.wait_for_timeout(1500)
        print("scrolled to chest:", await A.evaluate("[Math.round(document.querySelector('#homechest').getBoundingClientRect().top), Math.round(scrollY)]"))
        # the other houses
        u = []
        for t in ["Riften", "Markarth", "Windhelm", "Solitude"]:
            await A.evaluate("(t)=>{const S=window.__dbg.save(); S.location=t; [S.x,S.y]=WORLD.places[t]; S.homes[t]={chest:[{id:900,item:'elven_bow',qty:1,shown:true},{id:901,item:'iron_helmet',qty:1,shown:true}],garden:G.now()-1500}; }", t)
            await town(A, "home"); u.append(await A.evaluate("document.querySelector('.hscene img').src"))
        open("home_houses.html", "w").write("".join(f"<img src='{x}' width=360>" for x in u))
        await A.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;}")
        await A.wait_for_timeout(1500)
        # neighbour visit
        await B.wait_for_timeout(1500); await town(B, "homes")
        print("B neighbours:", (await B.inner_text("#side"))[-200:].replace("\n", " | ")[:160])
        await click(B, "[data-act=visit]"); await B.wait_for_timeout(300)
        await B.evaluate("()=>{document.querySelector('#giftnote').value='Nice place!'}"); await B.click("[data-act=giftgold][data-id='500']"); await B.wait_for_timeout(400)
        await shot(B, "#modal", "home_visit.png")
        u = await B.evaluate("document.querySelector('#modal img.homeart')?.src || ''")
        if u: open("home_visit_img.png", "wb").write(base64.b64decode(u.split(",")[1]))
        print("visit picture:", await B.evaluate("!!document.querySelector('#modal img.homeart')"))
        # hall tiers
        hall = []
        for pts in [0, 6000, 20000, 50000, 120000]:
            await A.evaluate("(p)=>HALL.setDonors(p?[{id:'z1',name:'Zed',pts:p*0.6},{id:'z2',name:'Remigiusz',pts:p*0.3},{id:'z3',name:'Ann',pts:p*0.1}]:[], null)", pts)
            await town(A, "hall"); hall.append(await A.evaluate("document.querySelector('#side img.homeart')?.src || ''"))
        open("home_hall.html", "w").write("".join(f"<img src='{x}' width=360>" for x in hall))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
