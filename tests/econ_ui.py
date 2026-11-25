import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8825"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=ec"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Trader"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Markarth'; [S.x,S.y]=WORLD.places.Markarth; S.gold=99999; S.skills.Mercantile.lvl=100; S.perks=Object.assign(S.perks||{},{haggling:5,master_trader:1}); for (const i of ['ore_silver','ore_iron','pelt_wolf','iron_sword']) G.give(S,i,6);
           const t=G.now(); for(let k=0;k<5;k++) ECON.record('X'+k,'Markarth','ore_silver',-ECON.depth('ore_silver'),t); }""")
        async def clean(): await pg.evaluate("document.querySelectorAll('#modal,#sky').forEach(m=>m.remove())")
        async def jsclick(sel):
            await clean(); ok = await pg.evaluate("(s)=>{const e=document.querySelector(s); if(!e) return false; e.click(); return true;}", sel)
            if not ok: print("missing", sel)
            await pg.wait_for_timeout(300)
        await jsclick("[data-tab=town]"); await jsclick("[data-id=general]")
        await pg.evaluate("()=>{ const d=document.querySelector('.econ-card'); if(d) d.open=true; }"); await pg.wait_for_timeout(200)
        el = await pg.query_selector("#side"); await el.screenshot(path="econ_buy.png")
        card = await pg.evaluate("document.querySelector('.econ-card')?.innerText||''"); print("card:", card[:400].replace("\n"," | "))
        await jsclick("[data-act=smode][data-id=sell]")
        el = await pg.query_selector("#side"); await el.screenshot(path="econ_sell.png")
        print("badges:", await pg.evaluate("[...document.querySelectorAll('.econ-b')].map(e=>e.textContent+' '+e.title).slice(0,6)"))
        g0 = await pg.evaluate("window.__dbg.save().gold")
        r = await pg.evaluate("()=>{ const S=window.__dbg.save(); const row=S.inv.find(x=>x.item==='ore_silver'); return [G.sellPrice(S,row), G.lotPrice(S,'ore_silver',row.qty,'sell',row)]; }")
        print("silver one / lot:", r)
        opn = await pg.evaluate("G.shopsOpen()")
        if opn:
            await jsclick("[data-act=sellall]")
            print("gold +", await pg.evaluate("window.__dbg.save().gold") - g0, "pressure", await pg.evaluate("ECON.pressure('Markarth','ore_silver')"))
        else: print("shops closed now; skipped sell click")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
