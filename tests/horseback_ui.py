import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8821"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs = []
        for style in ["ink"]:
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=hb{style}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Rider"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.level=8; S.hpBonus=60; S.gold=5000; G.setHealth(S,G.maxHealth(S));
               HORSES.buy(S,'Juniper','palomino');
               G.give(S,'steel_spear'); const r=S.inv.find(x=>x.item==='steel_spear'); G.equip(S,r.id);
               G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2)); const base=D.ENCOUNTERS.find(e=>e.name==='Bandit outlaw');
               S.trip.status='encounter'; S.trip.encounter={...G.scaleEnemy(base,S.level), hold:'Whiterun', danger:base.danger}; }""")
            await pg.wait_for_timeout(300)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.click("[data-tab=map]"); await pg.wait_for_timeout(300)
            if await pg.query_selector("[data-act=openenc]"): await pg.click("[data-act=openenc]")
            await pg.wait_for_timeout(300)
            note = await pg.evaluate("document.querySelector('#modal .mountnote')?.textContent")
            print(style, "note:", note)
            await pg.click("[data-act=enc][data-a=fight]"); await pg.wait_for_timeout(700)
            el = await pg.query_selector("#modal .fscene")
            log = await pg.evaluate("[...document.querySelectorAll('#modal .flog div')].slice(0,3).map(d=>d.textContent).join(' | ')")
            print(style, "scene:", bool(el), "| log:", log[:220])
            if el: await el.screenshot(path=f"hb_{style}_mid.png"); await pg.wait_for_timeout(3200); await el.screenshot(path=f"hb_{style}_end.png")
            await ctx.close()
        print("errors:", errs)
        await b.close()
asyncio.run(main())
