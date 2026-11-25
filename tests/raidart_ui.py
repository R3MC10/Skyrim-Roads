import asyncio, sys, time
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8788"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
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
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p={tag}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            await pg.evaluate("(t)=>{const S=window.__dbg.save(); S.location=t; [S.x,S.y]=WORLD.places[t]; S.gold=3000; S.discovered.push(t,'Whiterun'); S.level=12; G.setHealth(S,G.maxHealth(S));}", town)
            await pg.wait_for_timeout(600); await clear(pg); return pg
        for style in ["ink"]:
            A = await phone("ra" + style, "Alfa", "Windhelm"); B = await phone("rb" + style, "Beta", "Windhelm")
            # a raid over Whiterun, with some damage done
            for pg in (A, B):
                await pg.evaluate("""()=>{ const t=G.now(); WEVENTS.activeRaid=()=>({id:'raid-test',town:'Whiterun',start:t-60,end:t+900}); }""")
            await A.evaluate("()=>{ const S=window.__dbg.save(); S.raid={id:'raid-test',dmg:180}; Store.put('raids','raid-test-'+S.id,{raid:'raid-test',uid:S.id,name:S.name,dmg:180,t:G.now()}); }")
            await B.evaluate("()=>{ const S=window.__dbg.save(); S.raid={id:'raid-test',dmg:90}; Store.put('raids','raid-test-'+S.id,{raid:'raid-test',uid:S.id,name:S.name,dmg:90,t:G.now()}); }")
            await A.wait_for_timeout(1500)
            await click(A, "[data-tab=map]"); await A.wait_for_timeout(300)
            await A.evaluate("()=>{ const S=window.__dbg.save(); [S.x,S.y]=WORLD.places.Whiterun; }")
            await A.wait_for_timeout(1500)
            # map frame time with the raid on screen
            ft = await A.evaluate("""()=>new Promise(res=>{ const m=document.querySelector('#map'); let n=0, t0=performance.now(); const ts=[]; const tick=(t)=>{ ts.push(t); if(ts.length<40) requestAnimationFrame(tick); else res(ts.length); }; requestAnimationFrame(tick); })""")
            mp = await A.query_selector("#mapwrap"); await mp.screenshot(path=f"ra_map_{style}.png")
            rb = await A.query_selector("#raid")
            if rb: await rb.screenshot(path=f"ra_box_{style}.png")
            print(style, "raid box:", (await A.evaluate("document.querySelector('#raid')?.innerText||''"))[:160].replace("\n", " | "))
            # arena: B challenges A, A accepts
            await A.wait_for_timeout(32000)
            for pg in (A, B):
                await click(pg, "[data-tab=map]"); await click(pg, "[data-tab=town]"); await pg.wait_for_timeout(300); await click(pg, "[data-act=shop][data-id=arena]"); await pg.wait_for_timeout(400)
            await click(B, "[data-act=duelstake][data-id='100']"); await click(B, "[data-act=duelgo]"); await B.wait_for_timeout(800)
            await click(A, "[data-act=shop][data-id=arena]"); await A.wait_for_timeout(600)
            el = await A.query_selector("#side"); await el.screenshot(path=f"ra_arena_{style}.png")
            print(style, "arena has crowd canvas:", await A.evaluate("!!document.querySelector('canvas[data-ra=arena][data-on]')"), "versus:", await A.evaluate("document.querySelectorAll('.versus').length"))
            await click(A, "[data-act=duelyes]"); await A.wait_for_timeout(1500)
            sc = await A.query_selector("#modal .fscene")
            if sc: await sc.screenshot(path=f"ra_bout_{style}.png")
            await clear(A)
            # clan + holds
            await A.evaluate("""()=>{ const S=window.__dbg.save(); }""")
            await click(A, "[data-tab=log]"); await A.wait_for_timeout(300)
            if await A.query_selector("#clanname"):
                await A.fill("#clanname", "Stormblades"); await A.fill("#clantag", "STRM")
                await click(A, "[data-act=clancol][data-i='0'][data-id='#1f4e79']"); await click(A, "[data-act=clancol][data-i='1'][data-id='#d9d4c5']")
                await click(A, "[data-act=clanfound]"); await A.wait_for_timeout(800)
            # give the clan some war points so it rules a hold (fake the rulers for the picture)
            await A.evaluate("""()=>{ const c=CLANS.all[0]; if(c){ const real=WARS.rulers; WARS.rulers=()=>({Eastmarch:c, Whiterun:c}); } }""")
            await click(A, "[data-tab=map]"); await click(A, "[data-tab=log]"); await A.wait_for_timeout(500)
            for sid, name in [("#j-clan", "clan"), ("#j-holds", "holds")]:
                el = await A.query_selector(sid)
                if el: await el.screenshot(path=f"ra_{name}_{style}.png")
                print(style, name, "panel:", bool(el), await A.evaluate(f"!!document.querySelector('{sid} img.clan-banner, {sid} img.holds-map')"))
            await A.close(); await B.close()
        print("errors:", errs)
        await b.close()
asyncio.run(main())
